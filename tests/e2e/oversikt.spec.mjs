// ============================================================================
//  RØYKPRØVE (v7.13): alle vinduene åpnes uten feil, for student og lærer
// ----------------------------------------------------------------------------
//  Hver inngang på forsiden og i Det store bildet, lærerens fliser, Visning
//  og utskriftssiden. Kravet er at alt åpner og at konsollen er tom. Slides
//  lages og slettes, siden de bor i lærerens private notater.
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesSamling, lesDok, skrivDok, INNHOLD, ARTISTER, rydd } from "./frø.mjs";
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
  for (const id of ["btn-t-inn-oversikt", "btn-t-inn-mangler", "btn-t-inn-sjangertre", "btn-t-inn-slides", "btn-t-inn-podkast"]) {
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

// «Om appen» (v7.33, vindu fra v7.34): «i» rett før Innstillinger åpner et
// vindu med kort for «Slik bruker du appen», Referanser og KI-erklæringen.
const infoKort = (page) => page.locator("#modal-info .innst-tittel");
const aapne = (page, tittel) => page.locator("#modal-info .innst-rad").filter({ hasText: tittel }).getByRole("link", { name: `Åpne ${tittel}` });

test("Om appen for studentene: tre kort, KI-erklæringen åpnes oppå vinduet, og bryterne skjuler guiden", async ({ page }) => {
  await skrivDok("content", "kiErklaering", { body: "Historieappen.no er utviklet med **Claude**.\n\n- **Ansvar.** Jeg har det fulle ansvaret.", updatedAt: new Date().toISOString() });
  const feil = await forbered(page);
  await apne(page, "/index.html");
  await expect(page.locator("#dagens-artist")).not.toBeEmpty();
  const ikon = page.locator(".nav-info");
  await expect(ikon).toBeVisible();
  await ikon.click();
  await expect(page.locator("#modal-info")).toHaveClass(/open/);
  await expect(page.locator("#modal-info h2")).toHaveText("Om appen");
  await expect(infoKort(page)).toHaveText(["Slik bruker du appen", "Referanser", "KI-erklæring"]);
  await expect(page.locator("#modal-info .innst-kort")).toHaveCount(3);
  // KI-erklæringen åpnes oppå vinduet, og ← fører tilbake til det.
  await aapne(page, "KI-erklæring").click();
  await expect(page.locator("#modal-ki-erklaering")).toHaveClass(/open/);
  await expect(page.locator("#ki-erklaering-body strong").first()).toHaveText("Claude");
  await expect(page.locator("#ki-erklaering-extra button")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal-ki-erklaering")).not.toHaveClass(/open/);
  await expect(page.locator("#modal-info")).toHaveClass(/open/);
  // Referanser og guiden åpner også.
  await aapne(page, "Referanser").click();
  await expect(page.locator("#modal-referanser")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await aapne(page, "Slik bruker du appen").click();
  await expect(page.locator("#modal-app-guide")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal-info")).not.toHaveClass(/open/);
  // Huben har dem ikke lenger.
  await page.locator("#btn-store-bildet").click();
  await expect(page.locator("#modal-store-bildet")).toHaveClass(/open/);
  await expect(page.locator("#modal-store-bildet #sb-guide, #modal-store-bildet #sb-referanser")).toHaveCount(0);
  await lukkAlle(page);
  // Læreren skjuler guiden: kortet forsvinner fra vinduet uten sidelast.
  await skrivDok("content", "synlighet", { ...INNHOLD.synlighet, hub: { ...INNHOLD.synlighet.hub, "sb-guide": true } });
  await ikon.click();
  await expect(infoKort(page)).toHaveText(["Referanser", "KI-erklæring"]);
  await page.keyboard.press("Escape");
  // Forslagsskjemaet har ikke kortene: Åpne går til forsiden og åpner der.
  await apne(page, "/student.html");
  await page.locator(".nav-info").click();
  await expect(page.locator("#modal-info")).toHaveClass(/open/);
  await aapne(page, "KI-erklæring").click();
  await expect(page).toHaveURL(/index\.html\?vis=side(%3A|:)kiErklaering/);
  await expect(page.locator("#modal-ki-erklaering")).toHaveClass(/open/);
  expect(appFeil(feil)).toEqual([]);
});

test("Escape lukker Om appen på forslagsskjemaet", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/student.html");
  await page.locator(".nav-info").click();
  await expect(page.locator("#modal-info")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal-info")).not.toHaveClass(/open/);
  expect(appFeil(feil)).toEqual([]);
});

test("Om appen for læreren: alle tre også når de er skjult, og KI-erklæringen uten tekst har Rediger", async ({ page }) => {
  await skrivDok("content", "synlighet", { ...INNHOLD.synlighet, hub: { ...INNHOLD.synlighet.hub, "sb-guide": true, "sb-referanser": true } });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  // Innstillinger står ytterst til høyre, Om appen rett før.
  const ikoner = await page.locator(".topbar .nav .nav-icon:visible").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(ikoner.slice(-2)).toEqual(["Om appen", "Innstillinger"]);
  await page.locator(".nav-info").click();
  await expect(infoKort(page)).toHaveText(["Slik bruker du appen", "Referanser", "KI-erklæring"]);
  await aapne(page, "KI-erklæring").click();
  await expect(page.locator("#modal-ki-erklaering")).toHaveClass(/open/);
  await expect(page.locator("#ki-erklaering-body")).toContainText("Teksten er ikke lagt inn ennå");
  // Rediger (ikonknappen) åpner editoren for siden, og ingen Sjekk-knapp.
  await expect(page.locator("#ki-erklaering-extra .tcr-edit")).toBeVisible();
  await expect(page.locator("#ki-erklaering-extra .tcr-check, #ki-erklaering-extra [data-sjekk]")).toHaveCount(0);
  await page.locator("#ki-erklaering-extra .tcr-edit").click();
  await expect(page.locator(".modal-backdrop.open").last()).toContainText("KI-erklæring");
  expect(appFeil(feil)).toEqual([]);
});

// Nettstedene står i fanen «Claude sine referanser» (v7.39).
const claudeFane = (page) => page.locator("#ref-body").getByRole("tab", { name: "Claude sine referanser" }).click();

// Retting av kilder fra Referanser (v7.35): blyanten retter eller sletter en
// kilde på alle kortene den står.
test("Referanser: læreren retter en kilde som står på to kort, og sletter den, uten å åpne kortene", async ({ page }) => {
  const SNL = "https://snl.no/Muddy_Waters";
  await skrivDok("artists", "otis", { ...ARTISTER.otis, kilder: [{ text: "Store norske leksikon.", url: SNL }] });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator(".nav-info").click();
  await page.locator("#modal-info").getByRole("link", { name: "Åpne Referanser" }).click();
  await expect(page.locator("#modal-referanser")).toHaveClass(/open/);
  await claudeFane(page);
  await page.locator("#ref-body .refp-group-head").filter({ hasText: "Andre nettsteder" }).click();
  const rad = page.locator("#ref-body .ref-rad").filter({ hasText: "Muddy Waters" });
  await expect(rad).toContainText("2 kort");
  // v7.37: Bessie Smith er ikke sjekket, så Britannica-kilden hennes står ikke.
  await expect(page.locator('#ref-body a[href*="britannica.com"]')).toHaveCount(0);
  // Ingen ingress over fanene (v7.39).
  await expect(page.locator("#ref-body")).not.toContainText("kilder samlet fra");
  // v7.36: antallet står bare i «2 kort», og blyanten har ingen tekst.
  await expect(rad).not.toContainText("×");
  await expect(rad.locator(".ref-rett")).toHaveText("");
  await rad.locator(".ref-rett").click();
  const vindu = page.locator("#modal-kilde-retting");
  await expect(vindu).toHaveClass(/open/);
  await expect(vindu.locator("#kr-bruk")).toHaveText("Brukt på 2 steder: Muddy Waters, Otis Redding. Endringen gjelder alle.");
  await expect(vindu.locator(".source-text")).toHaveValue("Store norske leksikon");
  await vindu.locator(".source-text").fill("Store norske leksikon: «Muddy Waters»");
  await vindu.locator(".source-forfatter").fill("Kjetil Hansen");
  await vindu.getByRole("button", { name: "Lagre overalt" }).click();
  await expect(vindu).not.toHaveClass(/open/);
  const kilderPaa = async (id) => (await lesDok("artists", id))?.kilder;
  await expect.poll(() => kilderPaa("otis")).toEqual([{ text: "Store norske leksikon: «Muddy Waters»", forfatter: "Kjetil Hansen", url: SNL, kategori: "" }]);
  expect((await kilderPaa("muddy"))[0]).toMatchObject({ text: "Store norske leksikon: «Muddy Waters»", forfatter: "Kjetil Hansen", url: SNL });
  // Lista er tegnet på nytt med gruppa fortsatt åpen.
  await expect(page.locator("#ref-body .ref-rad").filter({ hasText: "Kjetil Hansen" })).toBeVisible();
  // Slett fra alle, med bekreftelse.
  await page.locator("#ref-body .ref-rad").filter({ hasText: "Kjetil Hansen" }).locator(".ref-rett").click();
  await vindu.getByRole("button", { name: "Slett fra alle" }).click();
  await page.locator(".modal-backdrop.open .modal-melding, .modal-backdrop.open .modal-valg").last().getByRole("button", { name: "Slett", exact: true }).click();
  await expect.poll(() => kilderPaa("otis")).toEqual([]);
  expect(await kilderPaa("muddy")).toEqual([]);
  expect(appFeil(feil)).toEqual([]);
});

// Ny referanse rett fra Referanser (v7.38).
test("Referanser: læreren legger til en ny referanse fra lista", async ({ page }) => {
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await apne(page, "/teacher.html?vis=referanser");
  await expect(page.locator("#modal-referanser")).toHaveClass(/open/);
  await page.locator("#ref-body").getByRole("button", { name: "Ny referanse" }).click();
  const vindu = page.locator("#modal-kilde-retting");
  await expect(vindu).toHaveClass(/open/);
  await expect(vindu.locator("#kr-tittel")).toHaveText("Ny referanse");
  await expect(vindu.getByRole("button", { name: "Slett fra alle" })).toBeHidden();
  await vindu.locator(".source-text").fill("The Land Where the Blues Began");
  await vindu.locator(".source-forfatter").fill("Alan Lomax");
  await vindu.getByRole("button", { name: "Legg til" }).click();
  await expect(vindu.locator("#kr-msg")).toContainText("Velg kategori");
  await vindu.locator(".source-kat").selectOption("Bøker");
  await vindu.getByRole("button", { name: "Legg til" }).click();
  await expect(vindu).not.toHaveClass(/open/);
  await expect.poll(async () => (await lesDok("content", "referanser"))?.kilder)
    .toEqual([{ text: "The Land Where the Blues Began", forfatter: "Alan Lomax", url: "", kategori: "Bøker" }]);
  await expect(page.locator("#ref-body .ref-rad").filter({ hasText: "The Land Where the Blues Began" })).toBeVisible();
  expect(appFeil(feil)).toEqual([]);
});

test("Referanser: studentene ser ingen blyant, og bare kilder fra sjekket og synlig tekst", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/index.html?vis=referanser");
  await expect(page.locator("#modal-referanser")).toHaveClass(/open/);
  // v7.39: to faner. Referanser først, med lærerens kilder; nettstedene i Claudes fane.
  await expect(page.locator("#ref-body [role=tab][aria-selected=true]")).toHaveText("Referanser");
  await expect(page.locator("#ref-body .ref-seksjon").filter({ hasText: "Nettsteder" })).toHaveCount(0);
  await expect(page.locator("#ref-body .ref-seksjon").filter({ hasText: "Dokumentarer" })).toHaveCount(1);
  await expect(page.locator("#ref-body .ref-seksjon").filter({ hasText: "Videoer" })).toHaveCount(0);
  await claudeFane(page);
  await expect(page.locator("#ref-body [role=tab][aria-selected=true]")).toHaveText("Claude sine referanser");
  await expect(page.locator("#ref-body .ref-seksjon").filter({ hasText: "Bøker" })).toHaveCount(0);
  await expect(page.locator("#ref-body .refp-group-head").first()).toBeVisible();
  expect(await page.locator("#ref-body .ref-rad").count()).toBeGreaterThan(0);
  await expect(page.locator("#ref-body .ref-rett, #ref-body [data-ref-ny]")).toHaveCount(0);
  // v7.37: Muddy Waters er sjekket og synlig, Bessie Smith er ikke sjekket.
  await expect(page.locator('#ref-body a[href="https://snl.no/Muddy_Waters"]')).toHaveCount(1);
  await expect(page.locator('#ref-body a[href*="britannica.com"]')).toHaveCount(0);
  expect(appFeil(feil)).toEqual([]);
});

test("Referanser: en skjult artist teller ikke som synlig, og blyanten står ikke på forsiden", async ({ page }) => {
  // Sjekket, men skjult for studentene: kilden står ikke, heller ikke for læreren.
  await skrivDok("artists", "muddy", { ...ARTISTER.muddy, hidden: true });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await apne(page, "/teacher.html?vis=referanser");
  await expect(page.locator("#modal-referanser")).toHaveClass(/open/);
  await expect(page.locator("#ref-body")).toContainText("Ingen kilder står her ennå");
  await expect(page.locator('#ref-body a[href="https://snl.no/Muddy_Waters"]')).toHaveCount(0);
  // På forsiden er læreren innlogget, men ser studentenes utgave og ingen blyant.
  await skrivDok("artists", "muddy", ARTISTER.muddy);
  // Forsiden viser rollevalget uten valgt rolle; læreren har vært inne som student før.
  await page.evaluate(() => localStorage.setItem("pensum-role", "student"));
  await apne(page, "/index.html?vis=referanser");
  await claudeFane(page);
  await expect(page.locator('#ref-body a[href="https://snl.no/Muddy_Waters"]')).toHaveCount(1);
  await expect(page.locator("body")).toHaveClass(/laerer-okt/);
  await expect(page.locator("#ref-body .ref-rett")).toHaveCount(0);
  expect(appFeil(feil)).toEqual([]);
});
