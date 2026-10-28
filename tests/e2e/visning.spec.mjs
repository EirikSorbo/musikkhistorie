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
  await gruppe.locator("[data-gruppe-navn]").click();
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
