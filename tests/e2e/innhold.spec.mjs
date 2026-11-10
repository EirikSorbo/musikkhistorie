// ============================================================================
//  LÆRERENS INNHOLDSVERKTØY (v7.13), innlogget i emulatoren
// ----------------------------------------------------------------------------
//  Synlighet og «Bare sjekket innhold», sjekking, plateselskapene (v7.12:
//  nytt, endre, slett og vern mot like skrivemåter), «Gi nytt navn» på en
//  undersjanger, importen og lærerhåndboken.
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesDok, skrivDok, rydd, ARTISTER } from "./frø.mjs";
import { forbered, loggInnSomLaerer, appFeil, apne } from "./hjelp.mjs";

test.beforeEach(async () => { await såFrø(); });
test.afterAll(async () => { await rydd(); });

async function ventPaa(samling, id, krav, tid = 10000) {
  const slutt = Date.now() + tid;
  let sist;
  while (Date.now() < slutt) {
    sist = await lesDok(samling, id);
    if (krav(sist)) return sist;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${samling}/${id} ble aldri som ventet: ${JSON.stringify(sist)?.slice(0, 400)}`);
}

// Appens egne meldingsbokser (ui-modal.js dialogBoks).
const dialog = (page) => page.locator(".modal-backdrop.open .modal-melding").last();
async function svar(page, knapp, tekst) {
  const d = dialog(page);
  await expect(d).toBeVisible();
  if (tekst != null) await d.locator(".melding-felt").fill(tekst);
  await d.getByRole("button", { name: knapp, exact: true }).click();
}

test("Synlig for studentene: avhukingene, guide-delene og «Bare sjekket innhold» lagres", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator(".desk-synlighet > summary").click();
  await page.locator('[data-synlig="plateselskaper"]').uncheck();
  await ventPaa("content", "synlighet", (d) => d?.hub?.["sb-plateselskaper"] === true);
  // Guide-delene i nedtrekken (v7.02): en ny del legges til, den gamle står.
  await page.locator(".desk-guide-deler > summary").click();
  await page.locator('[data-guide-del="Søk"]').check();
  const s = await ventPaa("content", "synlighet", (d) => (d?.guide || []).includes("Søk"));
  expect(s.guide).toEqual(["Forsiden", "Søk"]);
  expect(s.hub["sb-plateselskaper"]).toBe(true, "en lagring tar med alt, ikke bare det som endres");
  // «Bare sjekket innhold» spør først.
  await page.locator("[data-synlig-sjekket]").check();
  await svar(page, "Slå på");
  await ventPaa("content", "synlighet", (d) => d?.student?.usjekket === true);
  expect(appFeil(feil)).toEqual([]);
});

test("sjekking på artistkortet", async ({ page }) => {
  await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator('[data-action="toggleCheck"][data-id="bessie"]').click();
  await ventPaa("artists", "bessie", (d) => d?.teacherChecked === true);
});

test("plateselskapene: nytt, endre, like skrivemåter avvises, og slett", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("#btn-t-store-bildet").click();
  await page.locator("#sb-plateselskaper").click();
  await page.locator("#pss-extra [data-ps-ny]").click();
  await svar(page, "Opprett", "Vee-Jay");
  // Redigeringen åpnes med navnet fylt inn.
  const red = page.locator("#modal-story-edit");
  await expect(red).toHaveClass(/open/);
  await expect(red.locator("#se-selskap-navn")).toHaveValue("Vee-Jay");
  await red.locator("#se-selskap-aliaser").fill("VJ, Vee Jay");
  await red.locator("#se-text").fill("Vee-Jay var et svart eid plateselskap i Chicago.");
  await red.locator("#se-save").click();
  const vj = await ventPaa("content", "plateselskap-vee-jay", (d) => d?.body);
  expect(vj).toMatchObject({ navn: "Vee-Jay", aliaser: ["VJ", "Vee Jay"] });

  // Kortet finnes i oversikten; en skrivemåte som Stax alt har, avvises.
  await page.locator('#pss-body [data-ps-id="vee-jay"]').click();
  await expect(page.locator("#ps-tittel")).toHaveText("Vee-Jay");
  await page.locator("#ps-extra .tcr-edit").click();
  await red.locator("#se-selskap-aliaser").fill("Volt");
  await red.locator("#se-save").click();
  await expect(red.locator("#se-msg")).toContainText("«Volt» brukes alt av Stax");
  expect((await lesDok("content", "plateselskap-vee-jay")).aliaser).toEqual(["VJ", "Vee Jay"]);

  // Slett: spør først, og kortet lukkes.
  await red.locator("#se-slett-selskap").click();
  await svar(page, "Slett plateselskapet");
  await ventPaa("content", "plateselskap-vee-jay", (d) => d === null);
  await expect(page.locator("#modal-plateselskap")).not.toHaveClass(/open/);
  expect(appFeil(feil)).toEqual([]);
});

test("Gi nytt navn på en undersjanger: artistene følger med", async ({ page }) => {
  await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("#btn-t-genres").click();
  await page.locator('#modal-subgenre-list [data-sj-fane="undersjangre"]').click();
  await page.locator('#ul-chips [data-under="Chicago blues"]').click();
  // Undersjangeren åpnes i sjangerkortet, med Rediger i hodet.
  await page.locator("#modal-sjanger #sj-extra .sj-edit-btn").click();
  await expect(page.locator("#modal-subgenre-single")).toHaveClass(/open/);
  await page.locator("#ss-rename").click();
  await svar(page, "Vis hva som endres", "Chicagoblues");
  await svar(page, "Bytt navn");
  await ventPaa("artists", "muddy", (d) => (d?.subGenre || []).includes("Chicagoblues"));
  expect((await lesDok("artists", "muddy")).subGenre).not.toContain("Chicago blues");
});

test("import av en innholdsfil, og lærerhåndboken under Innstillinger", async ({ page }) => {
  await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator('[data-open-modal="modal-settings"]').click();
  await page.locator("#btn-laerer-handbok").click();
  await expect(page.locator("#lh-body")).toContainText("Håndboken for læreren");
  // En tekst uten `## ` har ingen faner (v7.27).
  await expect(page.locator('#lh-body [role="tablist"]')).toHaveCount(0);
  await page.locator("#modal-laerer-handbok .modal-close").click();
  const fil ={ pages: { omHistorie: { body: "Historie er tolkning av fortiden." } } };
  await page.locator("#input-import").setInputFiles({ name: "innhold.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fil)) });
  await svar(page, "Importer");
  await ventPaa("content", "omHistorie", (d) => d?.body === "Historie er tolkning av fortiden.");
});

test("lærerhåndboken i faner: `## ` lager en fane, og den valgte står når teksten endres (v7.27)", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator('[data-open-modal="modal-settings"]').click();
  await page.locator("#btn-laerer-handbok").click();
  await expect(page.locator("#lh-body")).toContainText("Håndboken for læreren");
  // Teksten endres mens håndboken står åpen: den tegnes på nytt, nå i faner.
  await skrivDok("content", "laererHandbok", {
    body: "Over fanene.\n\n## Lærersiden\n### Skrivebordet\nSlik bruker du Skrivebordet.\n\n## Visning\n### Kjøreplaner\nSlik lager du en kjøreplan.\n\n## Timene\n### Gått gjennom\nSlik ser du hva som er gått gjennom.",
  });
  const body = page.locator("#lh-body");
  const faner = body.locator('[role="tablist"] [role="tab"]');
  await expect(faner).toHaveText(["Lærersiden", "Visning", "Timene"]);
  await expect(faner.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(body.locator(":scope > p").first()).toHaveText("Over fanene.");
  const panel = body.locator('[role="tabpanel"]');
  await expect(panel).toContainText("Slik bruker du Skrivebordet.");
  await expect(panel).not.toContainText("Slik lager du en kjøreplan.");
  // Fanelinja er ikke en mellomtittel i teksten.
  await expect(body.locator("h3")).toHaveText(["Skrivebordet"]);

  await faner.nth(1).click();
  await expect(faner.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("Slik lager du en kjøreplan.");
  await expect(panel).not.toContainText("Slik bruker du Skrivebordet.");
  await expect(panel).toHaveAttribute("aria-labelledby", await faner.nth(1).getAttribute("id"));

  // Piltastene flytter mellom fanene, og fokuset følger med.
  await page.keyboard.press("ArrowRight");
  await expect(faner.nth(2)).toBeFocused();
  await expect(panel).toContainText("Slik ser du hva som er gått gjennom.");
  await page.keyboard.press("ArrowRight");
  await expect(faner.nth(0)).toBeFocused();
  await page.keyboard.press("End");
  await expect(faner.nth(2)).toHaveAttribute("aria-selected", "true");

  // En lagring som endrer en annen fane, beholder den valgte.
  await skrivDok("content", "laererHandbok", {
    body: "Over fanene.\n\n## Lærersiden\n### Skrivebordet\nNy tekst om Skrivebordet.\n\n## Visning\n### Kjøreplaner\nSlik lager du en kjøreplan.\n\n## Timene\n### Gått gjennom\nSlik ser du hva som er gått gjennom.",
  });
  await expect(faner.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("Slik ser du hva som er gått gjennom.");

  // Lukket og åpnet igjen: håndboken åpner der du var.
  await page.locator("#modal-laerer-handbok .modal-close").click();
  await page.locator("#btn-laerer-handbok").click();
  await expect(faner.nth(2)).toHaveAttribute("aria-selected", "true");

  // Forsvinner fanen, velges den første.
  await skrivDok("content", "laererHandbok", { body: "## Lærersiden\nBare én fane." });
  await expect(faner).toHaveText(["Lærersiden"]);
  await expect(panel).toHaveText("Bare én fane.");
  expect(appFeil(feil)).toEqual([]);
});

// Sentrale lytteeksempler for sjangeren (v7.28): tre eksempler i Electric blues.
const yt = (id) => `https://www.youtube.com/watch?v=${id}`;
const MUDDY_EKS = [
  { label: "Hoochie Coochie Man", year: 1954, url: yt("abcdefghijk"), genre: "Electric blues", sentral: true },
  { label: "Mannish Boy", year: 1955, url: yt("bcdefghijkl"), genre: "Electric blues", note: "Hør på riffet." },
  { label: "Rollin' Stone", year: 1950, url: yt("cdefghijklm"), genre: "Electric blues" },
];

test("Velg sentrale på sjangerkortet: valgene lagres på lytteeksemplene, og Rediger lar dem stå (v7.28)", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await skrivDok("artists", "muddy", { ...ARTISTER.muddy, musicExamples: MUDDY_EKS });
  await loggInnSomLaerer(page);
  await apne(page, "/teacher.html?vis=sjanger:Electric%20blues");
  const kort = page.locator("#modal-sjanger");
  await expect(kort).toHaveClass(/open/);
  const seksjon = kort.locator('[data-sekt="sentrale"] .gx-sentrale');
  await expect(seksjon).toContainText("Ingen er valgt ennå.");

  await seksjon.getByRole("button", { name: "Velg sentrale" }).click();
  const velger = page.locator(".modal-backdrop.open .sentrale-velger");
  await expect(velger.locator("h2")).toHaveText("Sentrale lytteeksempler for Electric blues");
  // Etter årstall, med artisten, og ingen er valgt.
  const rader = velger.locator(".sentrale-velger-liste li");
  await expect(rader).toHaveText(["Rollin' Stone (1950) · Muddy Waters", "Hoochie Coochie Man (1954) · Muddy Waters", "Mannish Boy (1955) · Muddy Waters"]);
  await expect(velger.locator("input:checked")).toHaveCount(0);
  await rader.nth(0).locator("input").check();
  await rader.nth(2).locator("input").check();
  // Escape med endringer spør først; Avbryt lar velgeren stå.
  await page.keyboard.press("Escape");
  await svar(page, "Avbryt");
  await expect(velger).toBeVisible();
  await velger.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(velger).toHaveCount(0);

  const a = await ventPaa("artists", "muddy", (d) => (d?.musicExamples || []).filter((m) => m.sjangersentral === true).length === 2);
  expect(a.musicExamples).toEqual([
    { label: "Hoochie Coochie Man", year: 1954, url: yt("abcdefghijk"), genre: "Electric blues", sentral: true },
    { label: "Mannish Boy", year: 1955, url: yt("bcdefghijkl"), genre: "Electric blues", note: "Hør på riffet.", sjangersentral: true },
    { label: "Rollin' Stone", year: 1950, url: yt("cdefghijklm"), genre: "Electric blues", sjangersentral: true },
  ]);
  expect(a.teacherChecked).toBe(true, "sjekken står");
  // Kortet følger med, etter årstall.
  await expect(seksjon.locator("li")).toHaveText(["Rollin' Stone (1950) · Muddy Waters", "Mannish Boy (1955) · Muddy Waters"]);
  await seksjon.getByRole("button", { name: "Muddy Waters" }).first().click();
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);

  // Rediger viser de to avkrysningene, og en lagring lar merkene stå.
  await apne(page, "/teacher.html");
  await expect(page.locator("body")).toHaveClass(/is-teacher/);
  await page.locator('#artist-list [data-action="edit"][data-id="muddy"]').click();
  const vindu = page.locator("#modal-artist-skjema");
  await expect(vindu).toHaveClass(/open/);
  // Stegknappene telles fra 0: 3 er Lytteeksempler, 4 er Kilder og innsending.
  await vindu.locator('[data-steg-knapp="3"]').click();
  await expect(vindu.getByText("Sentral for artisten", { exact: true }).first()).toBeVisible();
  await expect(vindu.getByText("Sentral for sjangeren", { exact: true }).first()).toBeVisible();
  await expect(vindu.locator(".me-sjangersentral:checked")).toHaveCount(2);
  await expect(vindu.locator(".me-sentral:checked")).toHaveCount(1);
  await vindu.locator('[data-steg-knapp="0"]').click();
  await vindu.locator('[data-felt="geography"]').fill("Chicago, Illinois");
  await vindu.locator('[data-steg-knapp="4"]').click();
  await vindu.locator("[data-as-send]").click();
  const b = await ventPaa("artists", "muddy", (d) => d?.geography === "Chicago, Illinois");
  expect(b.musicExamples.map((m) => [m.label, !!m.sentral, !!m.sjangersentral])).toEqual([
    ["Hoochie Coochie Man", true, false], ["Mannish Boy", false, true], ["Rollin' Stone", false, true],
  ]);
  expect(appFeil(feil)).toEqual([]);
});

test("studentene ser de sentrale lytteeksemplene på sjangerkortet, uten Velg sentrale (v7.28)", async ({ page }) => {
  const feil = await forbered(page);
  await skrivDok("artists", "muddy", { ...ARTISTER.muddy, musicExamples: MUDDY_EKS.map((m, i) => (i ? { ...m, sjangersentral: true } : m)) });
  await apne(page, "/index.html?vis=sjanger:Electric%20blues");
  const seksjon = page.locator('#modal-sjanger [data-sekt="sentrale"] .gx-sentrale');
  await expect(seksjon.locator("li")).toHaveText(["Rollin' Stone (1950) · Muddy Waters", "Mannish Boy (1955) · Muddy Waters"]);
  await expect(seksjon.getByRole("button", { name: "Velg sentrale" })).toHaveCount(0);
  // Uten valgte står ingen seksjon for studentene.
  await skrivDok("artists", "muddy", { ...ARTISTER.muddy, musicExamples: MUDDY_EKS });
  await expect(page.locator("#modal-sjanger .gx-sentrale")).toHaveCount(0);
  expect(appFeil(feil)).toEqual([]);
});
