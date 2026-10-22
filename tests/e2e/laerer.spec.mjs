// ============================================================================
//  LÆRERFLYTENE (v7.13), innlogget som lærer i emulatoren
// ----------------------------------------------------------------------------
//  Flytene som aldri var prøvd innlogget før: Rediger, Ny artist, sjekking,
//  synlighet, plateselskapene og overgangen deres. Hver test sjekker hva appen
//  faktisk skrev i databasen (lesDok), ikke bare hva som står på skjermen.
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesDok, lesSamling, rydd } from "./frø.mjs";
import { forbered, loggInnSomLaerer, appFeil } from "./hjelp.mjs";

test.beforeEach(async () => { await såFrø(); });
test.afterAll(async () => { await rydd(); });

// Venter til et dokument i emulatoren oppfyller kravet (skrivingen er asynkron).
async function ventPaa(samling, id, krav, tid = 8000) {
  const slutt = Date.now() + tid;
  let sist = null;
  while (Date.now() < slutt) {
    sist = await lesDok(samling, id);
    if (krav(sist)) return sist;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${samling}/${id} ble aldri som ventet: ${JSON.stringify(sist)?.slice(0, 400)}`);
}

test("innloggingen viser lærersiden, og de 13 første plateselskapene får navn i dokumentet", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await expect(page.locator("#artist-list")).toContainText("Muddy Waters");
  await expect(page.locator("#desk-body")).toContainText("Skrivebord");
  // Overgangen (v7.12): navnet og skrivemåtene flettes inn, teksten står.
  const stax = await ventPaa("content", "plateselskap-stax", (d) => d?.navn === "Stax");
  expect(stax.aliaser).toEqual(["Volt"]);
  expect(stax.body).toContain("Memphis");
  expect(stax.fakta).toEqual({ grunnlagt: "1957", sted: "Memphis" });
  const chess = await ventPaa("content", "plateselskap-chess", (d) => d?.navn === "Chess");
  expect(chess.aliaser).toBeUndefined();
  expect(appFeil(feil)).toEqual([]);
});

test("Rediger: femstegsskjemaet lagrer endringen og lar verkene og stemmene stå", async ({ page }) => {
  await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator('#artist-list [data-action="edit"][data-id="muddy"]').click();
  const vindu = page.locator("#modal-artist-skjema");
  await expect(vindu).toHaveClass(/open/);
  await expect(vindu.locator('[data-felt="name"]')).toHaveValue("Muddy Waters");
  await vindu.locator('[data-felt="geography"]').fill("Chicago, Illinois");
  await vindu.locator('[data-steg-knapp="4"]').click();
  await vindu.locator("[data-as-send]").click();
  const a = await ventPaa("artists", "muddy", (d) => d?.geography === "Chicago, Illinois");
  expect(a.name).toBe("Muddy Waters");
  expect(a.status).toBe("active");
  expect(a.musicExamples[0]).toMatchObject({ label: "Hoochie Coochie Man", sentral: true });
  expect(a.teacherChecked).toBe(true, "egne redigeringer lar sjekken stå");
  await expect(vindu).not.toHaveClass(/open/);
});

test("Ny artist: lagres som aktiv, og manglende felt gir en liste og røde steg", async ({ page }) => {
  await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("#btn-ny-artist").click();
  const vindu = page.locator("#modal-artist-skjema");
  await expect(vindu).toHaveClass(/open/);
  // Rett til siste steg og send: feilmeldingen lister det som mangler.
  await vindu.locator('[data-steg-knapp="4"]').click();
  await vindu.locator("[data-as-send]").click();
  await expect(vindu.locator("[data-as-msg]")).toContainText("Navn");
  await expect(vindu.locator(".steg-knapp.feil")).not.toHaveCount(0);
  // Fyll inn det som kreves for læreren.
  await vindu.locator('[data-steg-knapp="0"]').click();
  await vindu.locator('[data-felt="name"]').fill("Howlin' Wolf");
  await vindu.locator('[data-felt="gender"]').selectOption("mann");
  await vindu.locator('[data-steg-knapp="1"]').click();
  await vindu.locator('[data-felt="metaGenre"]').selectOption("Blues");
  await vindu.locator('[data-felt="influenceStart"]').fill("1951");
  await vindu.locator('[data-steg-knapp="4"]').click();
  await vindu.locator("[data-as-send]").click();
  await expect(vindu).not.toHaveClass(/open/);
  const ny = (await lesSamling("artists")).find((a) => a.name === "Howlin' Wolf");
  expect(ny).toBeTruthy();
  expect(ny).toMatchObject({ status: "active", metaGenre: "Blues", gender: "mann", influenceStart: 1951 });
});
