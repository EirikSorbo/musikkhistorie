// ============================================================================
//  RØYKPRØVE (v7.13): alle vinduene åpnes uten feil, for student og lærer
// ----------------------------------------------------------------------------
//  Hver inngang på forsiden og i Det store bildet, lærerens fliser, Visning
//  og utskriftssiden. Kravet er at alt åpner og at konsollen er tom. Slides
//  lages og slettes, siden de bor i lærerens private notater.
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesSamling, rydd } from "./frø.mjs";
import { forbered, apne, loggInnSomLaerer, appFeil } from "./hjelp.mjs";

test.beforeEach(async () => { await såFrø(); });
test.afterAll(async () => { await rydd(); });

const lukkAlle = async (page) => {
  const x = page.locator(".modal-backdrop.open .modal-close-all").first();
  if (await x.count()) await x.click();
};

test("studentene: alle inngangene og hubkortene åpner uten feil", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/index.html");
  await expect(page.locator("#dagens-artist")).not.toBeEmpty();
  for (const id of ["btn-artister", "btn-genres", "btn-tiar", "btn-lytt", "btn-instrumenter"]) {
    await page.locator(`#${id}`).click();
    await expect(page.locator(".modal-backdrop.open").first()).toBeVisible();
    await lukkAlle(page);
  }
  await page.locator("#btn-store-bildet").click();
  const kort = await page.locator("#modal-store-bildet .dash-card:visible").evaluateAll((els) => els.map((e) => e.id));
  expect(kort.length).toBeGreaterThan(5);
  for (const id of kort.filter((x) => x !== "sb-slektstre")) {
    await page.locator(`#${id}`).click();
    await page.waitForTimeout(250);
    await page.keyboard.press("Escape");   // ← tilbake til huben, som studentene gjør
  }
  await lukkAlle(page);
  // Plateselskapene: kortene fra dokumentene, med selskapenes artister.
  await apne(page, "/index.html?vis=plateselskap:stax");
  await expect(page.locator("#ps-tittel")).toHaveText("Stax");
  await expect(page.locator("#ps-body")).toContainText("Otis Redding");
  expect(appFeil(feil)).toEqual([]);
});

test("slektstresiden og utskriftssiden laster uten feil", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/tre.html");
  await expect(page.locator("#gx-stage svg").first()).toBeVisible();
  await apne(page, "/utskrift.html");
  await expect(page.locator("#hefte")).not.toContainText("Laster innholdet");
  expect(appFeil(feil)).toEqual([]);
});

test("læreren: flisene, Innstillinger og Visning åpner uten feil", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  for (const id of ["btn-t-inn-oversikt", "btn-t-inn-mangler", "btn-t-inn-sjangertre", "btn-t-inn-slides", "btn-t-inn-podkast", "btn-ny-referanse"]) {
    await page.locator(`#${id}`).click();
    await expect(page.locator(".modal-backdrop.open").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await lukkAlle(page);
  }
  await page.locator('[data-open-modal="modal-settings"]').click();
  await expect(page.locator("#modal-settings")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await page.locator("a[data-visning]").click();
  await expect(page.locator("#modal-visning")).toHaveClass(/open/);
  expect(appFeil(feil)).toEqual([]);
});

test("slides: læreren lager en, den ligger i de private notatene, og slettes igjen", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("#btn-t-inn-slides").click();
  await page.locator("[data-slide-ny]").click();
  await page.locator("#slide-tittel").fill("Innleveringer");
  await page.locator("#slide-innhold").fill("- Oppgave 1: **15. nov**");
  await page.locator("[data-slide-lagre]").click();
  // Kvitteringen «Sliden er lagret.» lukkes med OK.
  await page.locator(".modal-backdrop.open .modal-melding").last().getByRole("button", { name: "OK" }).click();
  await expect.poll(async () => (await lesSamling("notater")).filter((n) => n.id.startsWith("slide:")).length).toBe(1);
  const [slide] = (await lesSamling("notater")).filter((n) => n.id.startsWith("slide:"));
  expect(slide.tekst).toBe("Innleveringer\n\n- Oppgave 1: **15. nov**");
  const slett = page.locator(`[data-slide-slett="${slide.id.slice(6)}"]`);
  if (!(await slett.isVisible())) await page.locator("#btn-t-inn-slides").click();
  await slett.click();
  await page.locator(".modal-backdrop.open .modal-valg").last().getByRole("button", { name: "Slett", exact: true }).click();
  await expect.poll(async () => (await lesSamling("notater")).length).toBe(0);
  expect(appFeil(feil)).toEqual([]);
});
