// ============================================================================
//  SAMLEPAKKEN TIL STUDENTENE, FASE 1 (v7.46), i emulatoren
// ----------------------------------------------------------------------------
//  Læreren er logget inn, og nettleseren bygger studentversjonen i config
//  (js/data/studentpakke.js). Testene leser den rett fra emulatoren og pakker
//  den ut med den samme modellen (js/data/studentpakke-modell.js), så de kan
//  sjekke at den er nøyaktig det samlingene inneholder. Studentene bygger
//  aldri, og i fase 1 leser de den heller ikke.
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesDok, lesRaa, skrivDok, rydd, ARTISTER } from "./frø.mjs";
import { forbered, loggInnSomLaerer, appFeil, apne } from "./hjelp.mjs";
import {
  PAKKE_KILDER, gjeldendePakke, lesPakke, stabilJson, botteFor, delDokId, delDok,
} from "../../js/data/studentpakke-modell.js";

test.beforeEach(async () => { await såFrø(); });
test.afterAll(async () => { await rydd(); });

async function ventPaa(samling, id, krav, tid = 15000) {
  const slutt = Date.now() + tid;
  let sist;
  while (Date.now() < slutt) {
    sist = await lesDok(samling, id);
    if (krav(sist)) return sist;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${samling}/${id} ble aldri som ventet: ${JSON.stringify(sist)?.slice(0, 400)}`);
}

// Pakken slik den ligger i emulatoren.
async function pakken() {
  return gjeldendePakke((await lesRaa("config")).filter((d) => d.data.studentpakke === true));
}

// Det samlingene inneholder, i pakkens form.
async function samlingene() {
  const ut = {};
  for (const k of PAKKE_KILDER) {
    if (k.dok) {
      const d = await lesDok(k.samling, k.dok);
      ut[k.id] = d ? [{ id: k.dok, data: d }] : [];
    } else {
      ut[k.id] = (await lesRaa(k.samling)).sort((a, b) => (a.id < b.id ? -1 : 1));
    }
  }
  return ut;
}

async function sammenlign() {
  const les = lesPakke(await pakken());
  expect(les.ok).toBe(true);
  const fasit = await samlingene();
  for (const k of PAKKE_KILDER) expect(stabilJson(les.raa[k.id]), k.id).toBe(stabilJson(fasit[k.id]));
  return les;
}

const status = (page) => page.locator("#desk-pakke .desk-pakke-status");

async function aapnePanelet(page) {
  await page.locator(".desk-synlighet > summary").click();
  await expect(page.locator(".desk-synlighet")).toHaveAttribute("open", "");
}

test("læreren bygger studentversjonen, og den er nøyaktig det samlingene inneholder", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  const m = await ventPaa("config", "studentpakke", (d) => d?.type === "manifest");
  expect(m.aktiv).toBe(true);
  expect(m.format).toBe(1);
  expect(Object.keys(m.deler)).toHaveLength(15);
  expect(m.botter.artists).toBe(8);
  await sammenlign();
  await aapnePanelet(page);
  await expect(status(page)).toContainText("Studentversjonen er oppdatert.");
  await expect(status(page)).toContainText("15 deler");
  await expect(page.locator(".desk-synlighet > summary .desk-pakke-merke")).toHaveCount(0);
  // «Bygg på nytt» sammenligner igjen, men skriver ikke når alt stemmer.
  await page.locator("#desk-pakke [data-pakke-bygg]").click();
  await page.waitForTimeout(1500);
  await expect(status(page)).toContainText("Studentversjonen er oppdatert.");
  expect((await lesDok("config", "studentpakke")).bygget).toBe(m.bygget);
  expect(appFeil(feil)).toEqual([]);
});

test("en endret artist gir en ny utgave av bare den ene bøtta artisten ligger i", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  const m = await ventPaa("config", "studentpakke", (d) => d?.type === "manifest");
  const for_ = await pakken();
  const botte = `artists-${botteFor("bessie", 8)}`;
  await skrivDok("artists", "bessie", { ...ARTISTER.bessie, description: "Keiserinnen av bluesen." });
  await ventPaa("config", "studentpakke", (d) => d?.deler?.[botte]?.sjekksum !== m.deler[botte].sjekksum);
  const etter = await pakken();
  const endret = Object.keys(etter.deler).filter((id) => etter.deler[id].json !== for_.deler[id].json);
  expect(endret).toEqual([botte]);
  const les = await sammenlign();
  expect(les.raa.artists.find((a) => a.id === "bessie").data.description).toBe("Keiserinnen av bluesen.");
  expect(appFeil(feil)).toEqual([]);
});

test("et for stort dokument stopper byggingen med en melding, og et stort, men lovlig dokument går gjennom", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  const m = await ventPaa("config", "studentpakke", (d) => d?.type === "manifest");
  await aapnePanelet(page);
  await skrivDok("content", "stor", { body: "x".repeat(950_000) });
  await expect(status(page)).toContainText("Dokumentet content/stor er for stort til studentversjonen", { timeout: 20000 });
  await expect(page.locator(".desk-synlighet > summary .desk-pakke-merke")).toHaveText("Studentversjonen er ikke oppdatert");
  expect((await lesDok("config", "studentpakke")).bygget).toBe(m.bygget);
  // Rundt 600 kB i ett dokument: delen skrives, og pakken stemmer igjen.
  await skrivDok("content", "stor", { body: "x".repeat(600_000) });
  const ny = await ventPaa("config", "studentpakke", (d) => d?.deler?.["content-0"]?.bytes > 600_000, 20000);
  expect(ny.botter.content).toBe(1);
  await expect(status(page)).toContainText("Studentversjonen er oppdatert.");
  await expect(page.locator(".desk-synlighet > summary .desk-pakke-merke")).toHaveCount(0);
  await sammenlign();
  expect(appFeil(feil)).toEqual([]);
});

test("selvsjekken: en ødelagt del på serveren blir skrevet riktig igjen", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await ventPaa("config", "studentpakke", (d) => d?.type === "manifest");
  const riktig = (await lesDok("config", delDokId("decades-0"))).json;
  await skrivDok("config", delDokId("decades-0"), delDok({ id: "decades-0", kilde: "decades", json: "[]" }));
  await ventPaa("config", delDokId("decades-0"), (d) => d?.json === riktig);
  await sammenlign();
  expect(appFeil(feil)).toEqual([]);
});

test("studentene bygger ikke studentversjonen", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/index.html");
  await expect(page.locator("#dagens-artist")).not.toBeEmpty();
  await page.waitForTimeout(4000);
  expect(await lesDok("config", "studentpakke")).toBeNull();
  expect(appFeil(feil)).toEqual([]);
});
