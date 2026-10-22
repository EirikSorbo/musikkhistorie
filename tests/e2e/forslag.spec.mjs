// ============================================================================
//  FORSLAGENE (v7.13): student og lærer i hver sin nettleser
// ----------------------------------------------------------------------------
//  En student sender inn en ny artist og læreren godkjenner. Læreren sender et
//  forslag tilbake, studenten henter det med koden og sender inn på nytt. En
//  student foreslår en endring, og læreren godtar den felt for felt. Studenten
//  er anonymt innlogget og læreren innlogget, som i timen, og reglene gjelder.
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesDok, lesSamling, skrivDok, rydd } from "./frø.mjs";
import { forbered, apne, loggInnSomLaerer, appFeil } from "./hjelp.mjs";

test.beforeEach(async () => { await såFrø(); });
test.afterAll(async () => { await rydd(); });

async function ventPaa(fn, tid = 10000) {
  const slutt = Date.now() + tid;
  let sist;
  while (Date.now() < slutt) {
    sist = await fn();
    if (sist) return sist;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Ventet forgjeves");
}

async function laererSide(browser) {
  const ctx = await browser.newContext();
  const side = await ctx.newPage();
  await forbered(side, { rolle: null });
  await loggInnSomLaerer(side);
  return side;
}

test("en student sender inn en ny artist, og læreren godkjenner den", async ({ page, browser }) => {
  const feil = await forbered(page);
  await apne(page, "/student.html");
  const s = page.locator("#artist-skjema");
  await s.locator('[data-felt="name"]').fill("Little Walter");
  await s.locator('[data-felt="gender"]').selectOption("mann");
  await s.locator('[data-steg-knapp="1"]').click();
  await s.locator('[data-felt="metaGenre"]').selectOption("Blues");
  await s.locator('[data-felt="instrument"]').selectOption("Vokal");
  await s.locator('[data-felt="influenceStart"]').fill("1952");
  await s.locator('[data-steg-knapp="4"]').click();
  await s.locator('[data-legg-til="kilder"]').click();
  await s.locator(".source-text").last().fill("Store norske leksikon");
  await s.locator('[data-felt="proposedBy"]').fill("Ida");
  await s.locator("[data-as-send]").click();
  await expect(s.locator("[data-as-msg]")).toContainText("er sendt inn");
  const forslag = await ventPaa(async () => (await lesSamling("artists")).find((a) => a.name === "Little Walter"));
  expect(forslag).toMatchObject({ status: "pending", metaGenre: "Blues", proposedBy: "Ida", votedUpBy: [] });
  expect(forslag.ownerUid).toBeTruthy();
  expect(appFeil(feil)).toEqual([]);

  const laerer = await laererSide(browser);
  await expect(laerer.locator("#desk-body")).toContainText("1 nytt artistforslag");
  await laerer.locator('[data-desk="review-artists"]').click();
  await laerer.locator(`[data-action="approve"][data-id="${forslag.id}"]`).click();
  await ventPaa(async () => (await lesDok("artists", forslag.id))?.status === "active");
});

test("returflyten: læreren sender tilbake med kode, studenten retter og sender inn igjen", async ({ page, browser }) => {
  await skrivDok("artists", "lw", {
    name: "Little Walter", gender: "mann", metaGenre: "Blues", instrument: "Vokal", influenceStart: 1952,
    status: "pending", proposedBy: "Ida", votedUpBy: [], priority: 0, teacherChecked: false, removedBy: null,
    mainGenre: [], subGenre: [], keyWorks: [], musicExamples: [], kilder: [{ text: "SNL" }], description: "",
    imageUrl: "", imageCredit: "", geography: "", recordLabel: "", ownerUid: "",
  });
  const laerer = await laererSide(browser);
  await laerer.locator('[data-desk="review-artists"]').click();
  await laerer.locator('[data-action="sendBack"][data-id="lw"]').click();
  await laerer.locator("#retur-feedback").fill("Legg til en kilde til.");
  await laerer.locator("#retur-send").click();
  await expect(laerer.locator("#retur-kode")).not.toBeEmpty();
  const kode = (await laerer.locator("#retur-kode").textContent()).trim();
  const returnert = await ventPaa(async () => { const d = await lesDok("artists", "lw"); return d?.status === "returnert" && d; });
  expect(returnert.returKode).toBe(kode);
  expect(returnert.teacherFeedback).toBe("Legg til en kilde til.");

  // Studenten sitter på en annen enhet: koden er beviset.
  await forbered(page);
  await apne(page, "/index.html");
  await page.locator("#btn-retur-kode").click();
  await page.locator("#retur-kode-input").fill(kode);
  await page.locator("#btn-retur-hent").click();
  await page.locator('[data-retur-id="lw"]').click();
  await expect(page).toHaveURL(/student\.html\?retur=lw/);
  const s = page.locator("#artist-skjema");
  await expect(s.locator('[data-felt="name"]')).toHaveValue("Little Walter");
  await s.locator('[data-steg-knapp="4"]').click();
  await s.locator('[data-legg-til="kilder"]').click();
  await s.locator(".source-text").last().fill("Britannica");
  await s.locator('[data-felt="studentComment"]').fill("La til Britannica.");
  await s.locator("[data-as-send]").click();
  const igjen = await ventPaa(async () => { const d = await lesDok("artists", "lw"); return d?.status === "pending" && d; });
  expect(igjen.studentComment).toBe("La til Britannica.");
  expect(igjen.kilder.map((k) => k.text)).toEqual(["SNL", "Britannica"]);
});

test("endringsforslag: studenten foreslår, læreren godtar feltet", async ({ page, browser }) => {
  await forbered(page);
  await apne(page, "/index.html?vis=artist:muddy");
  await expect(page.locator("#detail-name")).toHaveText("Muddy Waters");
  await page.locator("#detail-propose").click();
  const vindu = page.locator("#modal-artist-skjema");
  await expect(vindu).toHaveClass(/open/);
  await vindu.locator('[data-felt="geography"]').fill("Chicago, Illinois");
  await vindu.locator('[data-steg-knapp="4"]').click();
  await vindu.locator('[data-felt="proposedBy"]').fill("Ola");
  await vindu.locator("[data-as-send]").click();
  const edit = await ventPaa(async () => (await lesSamling("pendingEdits"))[0]);
  // Bare det som er endret, sendes (ingen falsk diff i lytteeksemplene eller kildene).
  expect(Object.keys(edit.proposedFields)).toEqual(["geography"]);
  expect(edit).toMatchObject({ entityType: "artist", entityId: "muddy", proposedBy: "Ola" });

  const laerer = await laererSide(browser);
  await laerer.locator('[data-desk="review-edits"]').click();
  await laerer.locator(`[data-action="open-edit"][data-id="${edit.id}"]`).click();
  await laerer.locator('#diff-body .diff-row[data-field="geography"] .diff-approve').click();
  await laerer.locator("#diff-save").click();
  await ventPaa(async () => (await lesDok("artists", "muddy"))?.geography === "Chicago, Illinois");
  await ventPaa(async () => (await lesSamling("pendingEdits")).length === 0);
});
