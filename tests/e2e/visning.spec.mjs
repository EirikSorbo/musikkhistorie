// ============================================================================
//  VISNINGEN (v7.15), innlogget som lærer i emulatoren
// ----------------------------------------------------------------------------
//  Presentasjonsmodusen (nivå og svart skjerm), sikkerhetskopien av det som
//  vises, Avslutt med «Lagre som time» i en gruppe, spørsmålet om visninger
//  som ble lukket uten Avslutt, og gruppene med oversikten «Gått gjennom».
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesDok, lesSamling, skrivDok, rydd } from "./frø.mjs";
import { forbered, apne, loggInnSomLaerer, appFeil } from "./hjelp.mjs";
import { skrivKopi } from "../../js/visning/visningskopi-modell.js";

test.beforeEach(async () => { await såFrø(); });
test.afterAll(async () => { await rydd(); });

// Appens egne dialoger: meldingsboksene (tekstfelt) og valgboksene.
const oeverst = (page) => page.locator(".modal-backdrop.open .modal-melding, .modal-backdrop.open .modal-valg").last();
async function svar(page, knapp, tekst) {
  const d = oeverst(page);
  await expect(d).toBeVisible();
  if (tekst != null) await d.locator(".melding-felt").fill(tekst);
  await d.getByRole("button", { name: knapp, exact: true }).click();
}
const kopier = async () => (await lesSamling("notater")).filter((n) => n.id.startsWith("visning:"));
const planer = async () => (await lesDok("content", "presentasjoner"))?.planer || {};
const idag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

test("visningen: nivå og svart skjerm, kopi underveis, og Avslutt lagrer timen i en gruppe", async ({ page }) => {
  // Læreren har valgt rolle på forsiden før (ellers står rollevelgeren der).
  const feil = await forbered(page, { rolle: "teacher" });
  await loggInnSomLaerer(page);
  await apne(page, "/index.html?presentasjon=1");
  await expect(page.locator("body")).toHaveClass(/presentasjon/);
  // Modusen følger fanen over sidelastene, som når læreren blar.
  await apne(page, "/index.html?vis=artist:muddy");
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await page.keyboard.press("1");
  await expect(page.locator("body")).toHaveAttribute("data-pres-nivaa", "1");
  await page.keyboard.press("3");
  await expect(page.locator("body")).toHaveAttribute("data-pres-nivaa", "3");
  await page.keyboard.press("b");
  await expect(page.locator("#pres-svart")).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.locator("#pres-svart")).toHaveCount(0);

  // Sikkerhetskopien skrives mens læreren viser, uten at noe avsluttes.
  await expect.poll(async () => (await kopier()).map((k) => k.tekst).join(" "), { timeout: 20000 }).toContain("artist:muddy");
  await apne(page, "/index.html?vis=tiår:1950:society");
  await expect(page.locator("#modal-decade-view")).toHaveClass(/open/);
  await expect.poll(async () => (await kopier()).map((k) => k.tekst).join(" "), { timeout: 25000 }).toContain("tiår:1950:society");
  expect((await kopier()).length).toBe(1);

  // Avslutt: tittel og gruppe, og kopien er borte etterpå.
  await page.keyboard.press("x");
  await svar(page, "Lagre som time");
  await svar(page, "Videre", "Bluestime");
  await svar(page, "Lagre timen", "Klassen høst 2026");
  await expect(page).not.toHaveURL(/presentasjon/);
  await expect(page.locator("body")).not.toHaveClass(/presentasjon/);
  const timer = Object.values(await planer());
  expect(timer).toHaveLength(1);
  expect(timer[0]).toMatchObject({ tittel: "Bluestime", gruppe: "Klassen høst 2026", dato: idag() });
  expect(timer[0].stopp.map((s) => s.vis)).toEqual(expect.arrayContaining(["artist:muddy", "tiår:1950:society"]));
  await expect.poll(async () => (await kopier()).length).toBe(0);
  expect(appFeil(feil)).toEqual([]);
});

test("en visning lukket uten Avslutt: appen spør neste gang, og timen får visningens dato", async ({ page }) => {
  const start = new Date(Date.now() - 3 * 86400000);
  await skrivDok("notater", "visning:otest123", {
    tekst: skrivKopi({ start: start.toISOString(), stopp: ["artist:muddy", "artist:bessie"] }),
    oppdatert: new Date(start.getTime() + 3600000).toISOString(),
  });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await expect(oeverst(page)).toContainText("En visning ble ikke lagret");
  await expect(oeverst(page)).toContainText("2 kort vist");
  await svar(page, "Lagre som time");
  await svar(page, "Videre");   // tittelforslaget («Time <dato>») står
  await svar(page, "Lagre timen", "Klassen");
  await svar(page, "OK");
  const [time] = Object.values(await planer());
  const d = start;
  expect(time).toMatchObject({ gruppe: "Klassen", dato: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
  expect(time.tittel).toMatch(/^Time /);
  expect(time.stopp.map((s) => s.vis)).toEqual(["artist:muddy", "artist:bessie"]);
  await expect.poll(async () => (await kopier()).length).toBe(0);
  expect(appFeil(feil)).toEqual([]);
});

test("flere ulagrede visninger: «Senere» spør ikke igjen i økta, og lista har Forkast og Lagre som time", async ({ page }) => {
  const gammel = (dager) => new Date(Date.now() - dager * 86400000).toISOString();
  await skrivDok("notater", "visning:oaaaa11", { tekst: skrivKopi({ start: gammel(9), stopp: ["artist:otis"] }), oppdatert: gammel(9) });
  await skrivDok("notater", "visning:obbbb22", { tekst: skrivKopi({ start: gammel(2), stopp: ["artist:muddy"] }), oppdatert: gammel(2) });
  // En kopi skrevet for et øyeblikk siden kan høre til en visning som pågår: ikke spurt om, men i lista.
  await skrivDok("notater", "visning:occcc33", { tekst: skrivKopi({ start: gammel(0.01), stopp: ["artist:bessie"] }), oppdatert: new Date().toISOString() });
  await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await expect(oeverst(page)).toContainText("2 visninger ble ikke lagret");
  await svar(page, "Senere");
  await apne(page, "/teacher.html");
  await expect(page.locator("body")).toHaveClass(/is-teacher/);
  await page.waitForTimeout(2000);
  await expect(page.locator(".modal-backdrop.open .modal-valg")).toHaveCount(0);

  await page.locator("a[data-visning]").click();
  const rader = page.locator("#vis-ulagrede .pres-adm-rad");
  await expect(rader).toHaveCount(3);
  await expect(rader.first()).toContainText("kan fortsatt pågå et annet sted");
  await page.locator('[data-kopi-forkast="oaaaa11"]').click();
  await svar(page, "Forkast");
  await expect(rader).toHaveCount(2);
  await page.locator('[data-kopi-lagre="obbbb22"]').click();
  await svar(page, "Videre", "Muddy-timen");
  await svar(page, "Lagre timen", "");
  await svar(page, "OK");
  await expect(rader).toHaveCount(1);
  const [time] = Object.values(await planer());
  expect(time.tittel).toBe("Muddy-timen");
  expect(time.gruppe).toBeUndefined();
  expect((await kopier()).map((k) => k.id)).toEqual(["visning:occcc33"]);
});

test("gruppene: oversikten «Gått gjennom», filtrene, nytt navn og gruppefeltet i editoren", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    t1: { tittel: "Blues 1", dato: "2026-10-03", laget: "2026-10-03T10:00:00.000Z", gruppe: "Klassen", stopp: [{ vis: "artist:bessie" }, { vis: "tiår:1950:society" }] },
    t2: { tittel: "Blues 2", dato: "2026-10-10", laget: "2026-10-10T10:00:00.000Z", gruppe: "Klassen", stopp: [{ vis: "yt:abcdefghijk::20" }] },
    soul: { tittel: "Soul", laget: "2026-10-12T10:00:00.000Z", stopp: [{ vis: "artist:otis" }] },
  } });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("a[data-visning]").click();
  const gruppe = page.locator('.vis-gruppe[data-gruppe="Klassen"]');
  await expect(gruppe).toContainText("2 timer");
  await expect(page.locator(".vis-uten-gruppe")).toBeVisible();

  // Oversikten: Bessie er vist, Muddy bare lyttet (lytteeksempelet), Otis ikke.
  await gruppe.locator("[data-gruppe-oversikt]").click();
  const gj = page.locator("#modal-gjennomgang");
  await expect(gj).toHaveClass(/open/);
  await expect(gj.locator("#gj-tittel")).toHaveText("Gått gjennom i «Klassen»");
  await gj.locator('[data-gj-status="gjennomgatt"]').click();
  await gj.locator('[data-gj-type="artist"]').click();
  await expect(gj.locator(".gj-vist")).toContainText(["Bessie Smith"]);
  await expect(gj.locator(".gj-lyttet")).toContainText(["Muddy Waters"]);
  await expect(gj.locator(".gj-lyttet .gj-merke")).toHaveText("bare lyttet");
  await expect(gj.locator("#gj-liste")).not.toContainText("Otis Redding");
  await gj.locator('[data-gj-status="ikke"]').click();
  await expect(gj.locator("#gj-liste")).toContainText("Otis Redding");
  await expect(gj.locator("#gj-liste")).not.toContainText("Bessie Smith");
  // Bare viktigst: Otis har ingen grad og er ute.
  await gj.locator("#gj-nivaa").selectOption("3");
  await expect(gj.locator("#gj-liste")).not.toContainText("Otis Redding");
  await gj.locator("#gj-nivaa").selectOption("0");
  // Tiårene: samfunn er vist, teknologi ikke.
  await gj.locator('[data-gj-type="samfunn"]').click();
  await expect(gj.locator("#gj-liste")).toContainText("Alt her er gått gjennom.");
  await gj.locator('[data-gj-type="alt"]').click();
  // Et klikk åpner kortet oppå oversikten.
  await gj.locator(".gj-apne", { hasText: "Otis Redding" }).click();
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await expect(page.locator("#modal-detail")).toContainText("Otis Redding");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Nytt navn på gruppen: begge planene følger med, planen uten gruppe står.
  await gruppe.locator("[data-gruppe-meny]").click();
  await page.locator(".vis-meny [data-gruppe-navn]").click();
  await svar(page, "Gi nytt navn", "Klassen 2026");
  await expect.poll(async () => { const p = await planer(); return [p.t1.gruppe, p.t2.gruppe, p.soul.gruppe]; })
    .toEqual(["Klassen 2026", "Klassen 2026", undefined]);

  // Gruppefeltet i editoren: legg Soul i gruppen, og ta den ut igjen.
  await page.locator('[data-pres-rediger="soul"]').click();
  await page.locator("#pres-adm-gruppe").fill("Klassen 2026");
  await page.locator("#pres-adm-lagre").click();
  await expect.poll(async () => (await planer()).soul.gruppe).toBe("Klassen 2026");
  await expect(page.locator('.vis-gruppe[data-gruppe="Klassen 2026"]')).toContainText("2 timer og 1 kjøreplan");
  await page.locator('[data-pres-rediger="soul"]').click();
  await page.locator("#pres-adm-gruppe").fill("");
  await page.locator("#pres-adm-lagre").click();
  await expect.poll(async () => "gruppe" in (await planer()).soul).toBe(false);
  expect(appFeil(feil)).toEqual([]);
});

test("referansen: gruppen måles mot den, med «Alt i appen» og det som er vist utenom", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    t1: { tittel: "Soul 1", dato: "2026-10-03", laget: "2026-10-03T10:00:00.000Z", gruppe: "Soul", stopp: [{ vis: "artist:otis" }, { vis: "artist:bessie" }] },
    ref: { tittel: "Alt om soul", laget: "2026-09-01T10:00:00.000Z", gruppe: "Soul", stopp: [{ vis: "artist:otis" }, { vis: "artist:muddy" }] },
  } });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("a[data-visning]").click();
  await page.locator('[data-plan-meny="ref"]').click();
  await page.locator('[data-pres-referanse="ref"]').click();
  await expect.poll(async () => (await planer()).ref.referanse).toBe(true);
  const gruppe = page.locator('.vis-gruppe[data-gruppe="Soul"]');
  await expect(gruppe).toContainText("1 time og referansen");
  await expect(gruppe.locator(".pres-adm-rad").first()).toContainText("Alt om soul");

  await gruppe.locator("[data-gruppe-oversikt]").click();
  const gj = page.locator("#modal-gjennomgang");
  await expect(gj.locator("#gj-sammendrag")).toContainText("målt mot referansen «Alt om soul». 1 av 2 er gått gjennom");
  await gj.locator('[data-gj-status="alle"]').click();
  await expect(gj.locator(".gj-vist").first()).toContainText("Otis Redding");
  await expect(gj.locator(".gj-ikke")).toContainText(["Muddy Waters"]);
  // Bessie ble vist i timen, men står ikke i referansen.
  await expect(gj.locator(".gj-utenom")).toContainText("Bessie Smith");
  // Alt i appen: det gamle, og referansen teller ikke.
  await gj.locator('[data-gj-mot="alt"]').click();
  await expect(gj.locator("#gj-sammendrag")).toContainText("referansen «Alt om soul» teller ikke");
  await expect(gj.locator(".gj-utenom")).toHaveCount(0);
  await gj.locator('[data-gj-mot="referanse"]').click();
  await page.keyboard.press("Escape");

  // Flyttes referansen ut av gruppen, er den ikke lenger referanse.
  await page.locator('[data-pres-rediger="ref"]').click();
  await page.locator("#pres-adm-gruppe").fill("Annet");
  await page.locator("#pres-adm-lagre").click();
  await expect.poll(async () => { const p = (await planer()).ref; return [p.gruppe, "referanse" in p]; }).toEqual(["Annet", false]);
  expect(appFeil(feil)).toEqual([]);
});

// Dra og slipp med musa: dragstart kommer først når musa flytter seg med knappen nede.
async function dra(page, fra, til) {
  await fra.hover();
  await page.mouse.down();
  const b = await fra.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 14, { steps: 4 });
  await til.hover();
  await page.mouse.up();
}

test("dra planene mellom gruppene: inn i en gruppe, ut av den, og til en ny", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    a: { tittel: "Plan A", laget: "2026-10-01T10:00:00.000Z", gruppe: "Soul", stopp: [{ vis: "artist:otis" }] },
    ref: { tittel: "Referansen", laget: "2026-09-01T10:00:00.000Z", gruppe: "Soul", referanse: true, stopp: [{ vis: "artist:otis" }] },
    c: { tittel: "Plan C", laget: "2026-10-05T10:00:00.000Z", stopp: [{ vis: "artist:bessie" }] },
  } });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("a[data-visning]").click();
  const rad = (id) => page.locator(`[data-plan-id="${id}"]`);

  // Inn i gruppen.
  await dra(page, rad("c"), page.locator('.vis-gruppe[data-gruppe="Soul"] > summary'));
  await expect.poll(async () => (await planer()).c.gruppe).toBe("Soul");
  await expect(page.locator('.vis-gruppe[data-gruppe="Soul"]')).toContainText("Plan C");

  // Ut av gruppen: referansen mister merket når den forlater gruppen sin.
  await dra(page, rad("ref"), page.locator(".vis-uten .vis-slippsone"));
  await expect.poll(async () => { const p = (await planer()).ref; return ["gruppe" in p, "referanse" in p]; }).toEqual([false, false]);

  // Til en ny gruppe.
  await dra(page, rad("a"), page.locator(".vis-ny-gruppe"));
  await svar(page, "Lag gruppen", "Jazz");
  await expect.poll(async () => (await planer()).a.gruppe).toBe("Jazz");
  await expect(page.locator('.vis-gruppe[data-gruppe="Jazz"]')).toContainText("Plan A");
  expect(appFeil(feil)).toEqual([]);
});

test("menyene på radene: valgene, Del med studentene, Escape og Oppløs gruppen", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    a: { tittel: "Plan A", laget: "2026-10-01T10:00:00.000Z", gruppe: "Soul", stopp: [{ vis: "artist:otis" }] },
    b: { tittel: "Plan B", laget: "2026-10-02T10:00:00.000Z", gruppe: "Soul", referanse: true, stopp: [{ vis: "artist:otis" }] },
  } });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await page.locator("a[data-visning]").click();
  // Én linje per plan (v7.25): Spill av, Rediger, Legg til og Slett som
  // ikoner, og menyen med resten.
  const rad = page.locator('[data-plan-id="a"]');
  await expect(rad.locator("button:visible")).toHaveCount(5);
  await expect(rad.locator(".vis-ikon")).toHaveText(["", "", "", ""]);
  expect(await rad.locator(".vis-ikon").evaluateAll((k) => k.map((b) => b.getAttribute("aria-label"))))
    .toEqual(["Spill av", "Rediger", "Legg til: visningsknappen på kortene legger dem rett inn i planen", "Slett"]);
  // Menyen: valgene i rekkefølge, og Escape lukker bare den, ikke vinduet.
  await rad.locator("[data-plan-meny]").click();
  const meny = page.locator(".vis-meny");
  await expect(meny.locator(".vis-meny-valg")).toHaveText(["Ta opp", "Dupliser", "Til utskrift", "Gjør til referanse", "Del med studentene"]);
  await expect(meny.locator(".vis-meny-valg").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(meny.locator(".vis-meny-valg").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(meny).toHaveCount(0);
  await expect(page.locator("#modal-visning")).toHaveClass(/open/);
  // Legg til: planen blir aktiv og vinduet lukkes. Ikonet er farget til et nytt
  // klikk gjør læreren ferdig.
  await rad.locator('[data-pres-bygg="a"]').click();
  await expect(page.locator("#aktiv-plan-pille")).toContainText("Plan A");
  await page.locator("a[data-visning]").click();
  const paa = page.locator('[data-plan-id="a"] [data-pres-bygg-ferdig]');
  await expect(paa).toHaveAttribute("aria-pressed", "true");
  await paa.click();
  await expect(page.locator("#aktiv-plan-pille")).toHaveCount(0);
  await expect(page.locator('[data-plan-id="a"] [data-pres-bygg="a"]')).toHaveAttribute("aria-pressed", "false");
  // Del med studentene: av og på fra menyen, med merket «delt» på raden.
  await rad.locator("[data-plan-meny]").click();
  await page.locator('[data-pres-del-valg="a"]').click();
  await expect.poll(async () => (await planer()).a.delt).toBe(true);
  await expect(page.locator('[data-plan-id="a"]')).toContainText("delt");
  // Et klikk utenfor lukker menyen.
  await page.locator('[data-plan-id="a"] [data-plan-meny]').click();
  await page.locator("#modal-visning h2").click();
  await expect(page.locator(".vis-meny")).toHaveCount(0);
  // Oppløs gruppen: planene står igjen uten gruppe, og referansen mister merket.
  await page.locator('[data-gruppe-meny="Soul"]').click();
  await page.locator(".vis-meny [data-gruppe-opplos]").click();
  await svar(page, "Oppløs gruppen");
  await expect.poll(async () => { const p = await planer(); return ["gruppe" in p.a, "gruppe" in p.b, "referanse" in p.b]; }).toEqual([false, false, false]);
  // Slett: spør først, og bare planen på raden forsvinner.
  await page.locator('[data-pres-slett="a"]').click();
  await svar(page, "Slett");
  await expect.poll(async () => Object.keys(await planer())).toEqual(["b"]);
  expect(appFeil(feil)).toEqual([]);
});

test("Rediger i linja nede til venstre: stopp flyttes uten å slutte å bygge på eller ta opp (v7.24)", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    p: { tittel: "Blues", laget: "2026-10-01T10:00:00.000Z", stopp: [{ vis: "artist:muddy" }, { vis: "artist:bessie" }] },
  } });
  const feil = await forbered(page, { rolle: "teacher" });
  await loggInnSomLaerer(page);
  const rekke = async () => (await planer()).p.stopp.map((s) => s.vis);

  // Legg til: Otis havner sist, og Rediger i pilla flytter ham først.
  await apne(page, "/index.html");
  await page.locator("a[data-visning]").click();
  await page.locator('[data-pres-bygg="p"]').click();
  await expect(page.locator("#modal-visning")).not.toHaveClass(/open/);
  await apne(page, "/index.html?vis=artist:otis");
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await page.locator("#modal-detail .modal-head .modal-lenke").click();
  const pille = page.locator("#aktiv-plan-pille");
  await expect(pille).toContainText("Legger til i «Blues» · 3 stopp");
  await pille.locator("#aktiv-plan-rediger").click();
  await expect(page.locator("#pres-adm-rediger")).toBeVisible();
  await expect(page.locator(".pres-adm-stopprad")).toHaveCount(3);
  await page.locator('[data-pres-opp="2"]').click();
  await page.locator('[data-pres-opp="1"]').click();
  await page.locator("#pres-adm-lagre").click();
  // Tilbake der læreren var: vinduet lukket, kortet åpent, og byggingen står.
  await expect(page.locator("#modal-visning")).not.toHaveClass(/open/);
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await expect(pille).toContainText("Legger til i «Blues» · 3 stopp");
  await expect.poll(rekke).toEqual(["artist:otis", "artist:muddy", "artist:bessie"]);
  // Avbryt lukker også vinduet og lar planen stå.
  await pille.locator("#aktiv-plan-rediger").click();
  await page.locator("#pres-adm-avbryt").click();
  await expect(page.locator("#modal-visning")).not.toHaveClass(/open/);
  await expect(pille).toBeVisible();
  await pille.locator("#aktiv-plan-ferdig").click();
  await expect(pille).toHaveCount(0);

  // Ta opp: opptaket hviler mens editoren står åpen («Vis» tas ikke opp), og
  // tar opp igjen etter Lagre.
  await page.keyboard.press("Escape");
  await page.locator("a[data-visning]").click();
  await page.locator('[data-plan-meny="p"]').click();
  await page.locator('.vis-meny [data-pres-samle="p"]').click();
  await svar(page, "Start opptaket");
  await apne(page, "/index.html?vis=tiår:1950:society");
  await expect(page.locator("#modal-decade-view")).toHaveClass(/open/);
  const linje = page.locator("#samle-bar");
  await expect(linje).toContainText("4 stopp");
  await linje.locator("[data-rediger-plan]").click();
  await expect(page.locator(".pres-adm-stopprad")).toHaveCount(4);
  await expect(linje).toContainText("tar ikke opp mens du redigerer");
  await page.locator('[data-pres-vis="0"]').click();
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal-detail")).not.toHaveClass(/open/);
  await expect(page.locator(".pres-adm-stopprad")).toHaveCount(4);
  await page.locator('[data-pres-opp="3"]').click();
  await page.locator("#pres-adm-lagre").click();
  await expect(page.locator("#modal-visning")).not.toHaveClass(/open/);
  await expect(linje).not.toContainText("tar ikke opp");
  await expect.poll(rekke).toEqual(["artist:otis", "artist:muddy", "tiår:1950:society", "artist:bessie"]);
  await apne(page, "/index.html?vis=artist:muddy");
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await expect(linje).toContainText("5 stopp");
  await linje.locator("#samle-ferdig").click();
  await expect.poll(rekke).toEqual(["artist:otis", "artist:muddy", "tiår:1950:society", "artist:bessie", "artist:muddy"]);
  expect(appFeil(feil)).toEqual([]);
});

test("redigeringen (v7.26): flytt til plass, nivået bak en knapp, ingen spørsmål uten endringer, og Angre etter Slett", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    p: { tittel: "Blues", laget: "2026-10-01T10:00:00.000Z", gruppe: "Klassen", delt: true, stopp: [
      { vis: "tiår:1950:society", nivaa: 2, unntak: { "tiår.teknologi": true } },
      { vis: "artist:muddy" }, { vis: "artist:bessie" }, { vis: "artist:otis" },
    ] },
  } });
  await skrivDok("notater", "paminnelser:p", {
    tekst: JSON.stringify([{ id: "p1", type: "etter", min: 10, tekst: "Husk pausen", lerret: false }]),
    oppdatert: new Date().toISOString(),
  });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  const vindu = page.locator("#modal-visning");
  const rader = page.locator(".pres-adm-stopprad");

  // Åpnet bare for å se: Escape lukker uten å spørre.
  await page.locator("a[data-visning]").click();
  await page.locator('[data-pres-rediger="p"]').click();
  await expect(rader).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(vindu).not.toHaveClass(/open/);
  await expect(oeverst(page)).toHaveCount(0);

  // Flytt til plass: Otis (4) til 1, og raden lyser opp der den havnet.
  await page.locator("a[data-visning]").click();
  await page.locator('[data-pres-rediger="p"]').click();
  await page.locator('[data-pres-plass="3"]').click();
  await expect(oeverst(page)).toContainText("Skriv 1 for øverst og 4 for nederst.");
  await svar(page, "Flytt", "1");
  await expect(rader.first()).toContainText("Otis Redding");
  await expect(rader.first()).toHaveClass(/pres-adm-flyttet/);
  await expect(rader.first().locator("[data-pres-plass]")).toBeFocused();
  // Et tall utenfor planen havner nederst.
  await page.locator('[data-pres-plass="0"]').click();
  await svar(page, "Flytt", "99");
  await expect(rader.last()).toContainText("Otis Redding");

  // Nivået bak en knapp: Muddy (nå 2) får nivå 3, og tiåret mister unntaket.
  const knapp = (i) => page.locator(`[data-pres-nivaa-knapp="${i}"]`);
  await expect(knapp(0)).toHaveText("Nivå 2");
  await expect(knapp(1)).toHaveText("Nivå");
  await knapp(1).click();
  const meny = page.locator(".vis-meny");
  await expect(meny.locator(".vis-meny-valg")).toHaveText(["Uendret", "Nivå 1: Overskrift", "Nivå 2: Kjerne", "Nivå 3: Alt"]);
  await expect(meny.locator('[aria-checked="true"]')).toHaveText("Uendret");
  await meny.locator('[data-pres-nivaa-valg="1:3"]').click();
  await expect(meny).toHaveCount(0);
  await expect(knapp(1)).toHaveText("Nivå 3");
  await expect(knapp(1)).toBeFocused();
  await expect(rader.first()).toContainText("1 unntak");
  await knapp(0).click();
  await meny.locator("[data-pres-unntak]").click();
  await expect(rader.first()).not.toContainText("unntak");
  // Escape lukker menyen, ikke vinduet.
  await knapp(2).click();
  await page.keyboard.press("Escape");
  await expect(meny).toHaveCount(0);
  await expect(vindu).toHaveClass(/open/);

  // Med endringer spør vinduet før det lukkes.
  await page.keyboard.press("Escape");
  await expect(oeverst(page)).toContainText("Lukke uten å lagre?");
  await svar(page, "Avbryt");
  await page.locator("#pres-adm-lagre").click();
  await expect.poll(async () => (await planer()).p.stopp).toEqual([
    { vis: "tiår:1950:society", nivaa: 2 }, { vis: "artist:muddy", nivaa: 3 }, { vis: "artist:bessie" }, { vis: "artist:otis" },
  ]);

  // Slett, og Angre: planen og påminnelsen er tilbake.
  const pam = async () => (await lesSamling("notater")).find((n) => n.id === "paminnelser:p")?.tekst || "";
  await page.locator('[data-pres-slett="p"]').click();
  await expect(oeverst(page)).toContainText("Du kan angre i ti sekunder etterpå.");
  await svar(page, "Slett");
  await expect.poll(async () => Object.keys(await planer())).toEqual([]);
  await expect.poll(pam).toBe("");
  await page.locator("#pres-adm-msg [data-pres-angre]").click();
  await expect(page.locator("#pres-adm-msg")).toHaveText("Kjøreplanen «Blues» er tilbake.");
  await expect.poll(async () => (await planer()).p).toMatchObject({ tittel: "Blues", gruppe: "Klassen", delt: true, laget: "2026-10-01T10:00:00.000Z" });
  expect((await planer()).p.stopp).toHaveLength(4);
  await expect.poll(pam).toContain("Husk pausen");
  await expect(page.locator('.vis-gruppe[data-gruppe="Klassen"]')).toContainText("Blues");
  expect(appFeil(feil)).toEqual([]);
});

test("Lag kjøreplan på utskriftssiden: en tittel som finnes, spør om stoppene skal erstattes (v7.26)", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    p: { tittel: "Blues", laget: "2026-10-01T10:00:00.000Z", gruppe: "Klassen", stopp: [{ vis: "artist:otis", nivaa: 2 }] },
  } });
  const feil = await forbered(page, { rolle: null });
  await loggInnSomLaerer(page);
  await apne(page, "/utskrift.html?u=artist:muddy|artist:bessie&t=blues");
  const lag = page.locator("#utskrift-plan");
  await expect(page.locator("#hefte")).not.toContainText("Laster innholdet", { timeout: 15000 });
  await expect(lag).toBeVisible();
  await expect(lag).toBeEnabled();
  // Avbryt: ingenting skjer.
  await lag.click();
  await expect(oeverst(page)).toContainText("Du har en kjøreplan som heter «Blues» fra før, med 1 stopp.");
  await svar(page, "Avbryt");
  expect(Object.keys(await planer())).toEqual(["p"]);
  // Erstatt stoppene: tittel og gruppe står, bare stoppene er byttet.
  await lag.click();
  await svar(page, "Erstatt stoppene");
  await expect.poll(async () => (await planer()).p.stopp.map((s) => s.vis).sort()).toEqual(expect.arrayContaining(["artist:bessie", "artist:muddy"]));
  const p = (await planer()).p;
  expect(p).toMatchObject({ tittel: "Blues", gruppe: "Klassen" });
  expect(p.stopp.map((s) => s.vis)).not.toContain("artist:otis");
  // Lag en ny: to planer.
  await lag.click();
  await svar(page, "Lag en ny");
  await expect.poll(async () => Object.keys(await planer()).length).toBe(2);
  expect(appFeil(feil)).toEqual([]);
});

test("slidene er treff på forsiden og slektstresiden også, i søket og som stopp (v7.29)", async ({ page }) => {
  await skrivDok("content", "presentasjoner", { planer: {
    p: { tittel: "Blues", laget: "2026-10-01T10:00:00.000Z", stopp: [{ vis: "artist:muddy" }] },
  } });
  await skrivDok("notater", "slide:skurs01", { tekst: "Kursinfo\n\nFrister for innleveringene", oppdatert: new Date().toISOString() });
  const feil = await forbered(page, { rolle: "teacher" });
  await loggInnSomLaerer(page);

  // Forsiden, uten visningsmodus: søket for å legge til stopp finner sliden.
  await apne(page, "/index.html");
  await page.locator("a[data-visning]").first().click();
  await page.locator('[data-pres-rediger="p"]').click();
  await page.locator("#pres-adm-sok").fill("kursinfo");
  const treff = page.locator('[data-pres-legg="slide:skurs01"]');
  await expect(treff).toContainText("Slide");
  await expect(treff).toContainText("Kursinfo");
  await treff.click();
  await expect(page.locator(".pres-adm-stopprad")).toHaveCount(2);
  await expect(page.locator(".pres-adm-stopprad").last()).toContainText("Kursinfo");
  await page.locator("#pres-adm-lagre").click();
  await expect.poll(async () => (await planer()).p?.stopp.map((s) => s.vis)).toEqual(["artist:muddy", "slide:skurs01"]);

  // Slektstresiden: det vanlige søket finner sliden på innholdet.
  await apne(page, "/tre.html");
  await page.locator("[data-sok]").first().click();
  await page.locator("#sok-felt").fill("innleveringene");
  await expect(page.locator('#sok-treff [data-sok-gruppe="slide"]')).toContainText("Kursinfo");
  expect(appFeil(feil)).toEqual([]);
});
