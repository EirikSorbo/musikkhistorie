// ============================================================================
//  GJENNOMGANG FOR STUDENTENE (v7.48), i emulatoren
// ----------------------------------------------------------------------------
//  «Gå gjennom timen» i timevinduet starter visningen med timen som
//  kjøreplan, uten lærerens verktøy: ingen lerretknapp, ingen fullskjerm av
//  seg selv, slidene hoppes over, og Avslutt går tilbake til timen. Bare
//  delte timer kan spilles av andre enn læreren (planTilgang).
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, skrivDok, rydd, INNHOLD } from "./frø.mjs";
import { forbered, apne, loggInnSomLaerer, appFeil } from "./hjelp.mjs";

const PLANER = {
  t1: {
    tittel: "Bluestimen", dato: "2026-11-12", laget: "2026-11-12T10:00:00.000Z", delt: true,
    stopp: [{ vis: "artist:muddy" }, { vis: "slide:sabc123" }, { vis: "tiår:1950:society" }, { vis: "artist:bessie" }],
  },
  p2: { tittel: "Privat plan", laget: "2026-11-13T10:00:00.000Z", stopp: [{ vis: "artist:otis" }] },
};

test.beforeEach(async () => {
  await såFrø();
  await skrivDok("content", "presentasjoner", { planer: PLANER });
  // «Fra timene» på (false er synlig): frøet har den av.
  await skrivDok("content", "synlighet", { ...INNHOLD.synlighet, student: { ...INNHOLD.synlighet.student, fraTimene: false } });
});
test.afterAll(async () => { await rydd(); });

const teller = (page) => page.locator("#pres-teller");

test("studenten går gjennom en delt time: i rekkefølge, uten slidene og lærerens verktøy, og tilbake til timen", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/index.html?vis=time:t1");
  const vindu = page.locator("#modal-time");
  await expect(vindu).toHaveClass(/open/);
  const knapp = vindu.locator("[data-tm-gjennomgang]");
  await expect(knapp).toHaveText("Gå gjennom timen");
  await expect(knapp).not.toHaveAttribute("target", /.+/);
  await knapp.click();

  await expect(page).toHaveURL(/presentasjon=t1/);
  await expect(page).toHaveURL(/gjennomgang=1/);
  await expect(page.locator("body")).toHaveClass(/pres-gjennomgang/);
  await expect(teller(page)).toHaveText("Oversikt");
  await expect(page.locator("#pres-lerret")).toHaveCount(0);
  // Fanens ikon står (læreren får et tomt ikon ved prosjektoren).
  expect(await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"]')].some((l) => l.href.startsWith("data:")))).toBe(false);

  await page.locator("#pres-neste").click();
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await expect(page.locator("#modal-detail")).toContainText("Muddy Waters");
  await expect(teller(page)).toHaveText("1/3");
  // Klikket ga ingen fullskjerm, og QA-bryteren står ikke i tannhjulet.
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.locator("#pres-tannhjul").click();
  await expect(page.locator("#pres-panel")).toBeVisible();
  await expect(page.locator("#pres-qa")).toHaveCount(0);
  await page.locator("#pres-tannhjul").click();

  // Sliden (stopp 2) hoppes over.
  await page.locator("#pres-neste").click();
  await expect(page.locator("#modal-decade-view")).toHaveClass(/open/);
  await expect(teller(page)).toHaveText("2/3");
  await page.locator("#pres-forrige").click();
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await expect(teller(page)).toHaveText("1/3");

  // Posisjonen og merket følger en omlasting.
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/pres-gjennomgang/);
  await expect(teller(page)).toHaveText("1/3");

  // Avslutt: ingen «Lagre som time», rett tilbake til timevinduet.
  await page.keyboard.press("x");
  await expect(page).toHaveURL(/vis=time(%3A|:)t1/);
  await expect(page.locator("body")).not.toHaveClass(/presentasjon/);
  await expect(page.locator("#modal-time")).toHaveClass(/open/);
  expect(appFeil(feil)).toEqual([]);
});

test("en plan som ikke er delt, spilles ikke for studenten", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/index.html?presentasjon=p2");
  await expect(teller(page)).toHaveText("ikke delt");
  await expect(page.locator("#pres-varsel")).toContainText("ikke delt med studentene");
  await page.waitForTimeout(1000);
  await expect(page.locator("#modal-detail")).not.toHaveClass(/open/);
  await expect(page.locator("#modal-pres-oversikt.open")).toHaveCount(0);
  expect(appFeil(feil)).toEqual([]);
});

test("læreren: planen som ikke er delt, spilles, og en gjennomgang er studentenes utgave", async ({ page }) => {
  const feil = await forbered(page, { rolle: "teacher" });
  await loggInnSomLaerer(page);
  await apne(page, "/index.html?presentasjon=p2");
  await expect(teller(page)).toHaveText("Oversikt");
  await expect(page.locator("#pres-lerret")).toHaveCount(1);
  await page.locator("#pres-neste").click();
  await expect(page.locator("#modal-detail")).toContainText("Otis Redding");

  // Fra lærersiden åpnes gjennomgangen i en ny fane.
  await apne(page, "/teacher.html?vis=time:t1");
  await expect(page.locator("#modal-time")).toHaveClass(/open/);
  await expect(page.locator("#modal-time [data-tm-gjennomgang]")).toHaveAttribute("target", "_blank");

  // Gjennomgangen: lærerens verktøy er borte, og Avslutt spør ikke om timen.
  await apne(page, "/index.html?presentasjon=t1&gjennomgang=1");
  await expect(teller(page)).toHaveText("Oversikt");
  await expect(page.locator("#pres-lerret")).toHaveCount(0);
  await page.locator("#pres-neste").click();
  await expect(page.locator("#modal-detail")).toContainText("Muddy Waters");
  await page.locator("#pres-neste").click();
  await expect(teller(page)).toHaveText("2/3");
  await page.keyboard.press("x");
  await expect(page).toHaveURL(/vis=time(%3A|:)t1/);
  await expect(page.locator(".modal-backdrop.open .modal-valg")).toHaveCount(0);
  // En vanlig avspilling etterpå er lærerens igjen.
  await apne(page, "/index.html?presentasjon=t1");
  await expect(teller(page)).toHaveText("Oversikt");
  await expect(page.locator("body")).not.toHaveClass(/pres-gjennomgang/);
  await expect(page.locator("#pres-lerret")).toHaveCount(1);
  expect(appFeil(feil)).toEqual([]);
});
