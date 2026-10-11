// Påminnelser i en kjøreplan (v6.70, brukerbestilling 2026-10-11): rensing,
// lagring som tekst og når de forfaller.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rensPaminnelser, lesPaminnelser, skrivPaminnelser, paminnelseTid, forfalnePaminnelser,
  paminnelseEtikett, paminnelseNokkel, paminnelserForLange, PAMINNELSE_MAKS, PAMINNELSE_TEKST_MAKS,
} from "../../js/visning/presentasjon-modell.js";

test("rensPaminnelser: beholder gyldige, kaster tomme og ugyldige", () => {
  const ut = rensPaminnelser([
    { id: "a", type: "etter", min: "37", tekst: "  Pause  ", lerret: 1 },
    { id: "b", type: "klokka", kl: "10:15", tekst: "Nevn Miles Davis" },
    { id: "c", type: "etter", min: 5, tekst: "   " },
    { id: "d", type: "klokka", kl: "25:00", tekst: "feil klokke" },
    { id: "e", type: "etter", min: -3, tekst: "negativ" },
    { id: "a", type: "etter", min: 1, tekst: "samme id" },
    null,
  ]);
  assert.deepEqual(ut, [
    { id: "a", type: "etter", min: 37, tekst: "Pause", lerret: true },
    { id: "b", type: "klokka", kl: "10:15", tekst: "Nevn Miles Davis", lerret: false },
  ]);
  assert.equal(rensPaminnelser([{ id: "x", type: "etter", min: 1, tekst: "x".repeat(5000) }])[0].tekst.length, PAMINNELSE_TEKST_MAKS);
  assert.equal(rensPaminnelser(Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, type: "etter", min: i, tekst: "t" }))).length, PAMINNELSE_MAKS);
  assert.deepEqual(rensPaminnelser("ikke en liste"), []);
});

test("lagres som JSON-tekst i notatet; tom liste sletter", () => {
  const liste = [{ id: "a", type: "etter", min: 10, tekst: "Hei", lerret: false }];
  assert.deepEqual(lesPaminnelser(skrivPaminnelser(liste)), liste);
  assert.equal(skrivPaminnelser([]), "");
  assert.deepEqual(lesPaminnelser("{ødelagt"), []);
  assert.equal(paminnelseNokkel("plan-abc"), "paminnelser:plan-abc");
  // Reglene for notater tillater høyst 10 000 tegn: editoren må kunne si fra.
  const lag = (n, len) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, type: "etter", min: i, tekst: "x".repeat(len) }));
  assert.equal(paminnelserForLange(lag(10, 300)), false);
  assert.equal(paminnelserForLange(lag(PAMINNELSE_MAKS, PAMINNELSE_TEKST_MAKS)), true);
});

test("paminnelseTid: minutter etter start, og klokkeslett bare fra starten", () => {
  const start = new Date(2026, 9, 11, 10, 0).getTime();
  assert.equal(paminnelseTid({ type: "etter", min: 37 }, start), start + 37 * 60000);
  assert.equal(paminnelseTid({ type: "klokka", kl: "10:15" }, start), new Date(2026, 9, 11, 10, 15).getTime());
  assert.equal(paminnelseTid({ type: "klokka", kl: "09:45" }, start), null, "før starten: kommer ikke");
  assert.equal(paminnelseTid({ type: "klokka", kl: "10:00" }, start), start);
});

test("forfalnePaminnelser: bare forfalte og ikke viste, i tidsrekkefølge", () => {
  const start = new Date(2026, 9, 11, 10, 0).getTime();
  const liste = [
    { id: "sen", type: "etter", min: 50, tekst: "Sen" },
    { id: "kl", type: "klokka", kl: "10:20", tekst: "Klokka" },
    { id: "tidlig", type: "etter", min: 5, tekst: "Tidlig" },
  ];
  const kl1030 = new Date(2026, 9, 11, 10, 30).getTime();
  assert.deepEqual(forfalnePaminnelser(liste, start, kl1030).map((p) => p.id), ["tidlig", "kl"]);
  assert.deepEqual(forfalnePaminnelser(liste, start, kl1030, ["tidlig"]).map((p) => p.id), ["kl"]);
  assert.deepEqual(forfalnePaminnelser(liste, start, start).map((p) => p.id), []);
});

test("etiketten sier når påminnelsen kommer", () => {
  assert.equal(paminnelseEtikett({ type: "etter", min: 37 }), "37 min etter start");
  assert.equal(paminnelseEtikett({ type: "klokka", kl: "10:15" }), "Kl. 10.15");
});

// --- v6.72: fri visning, raske påminnelser (R) og oversikten oppå stoppet (O) ---
import { readFileSync } from "node:fs";
import {
  raskPaminnelse, FRI_PLAN, RASK_MAKS, nyPlanId, presTast, PRES_TASTER, PAMINNELSE_PRESET_MIN, foerHeleTimen, HEL_TIME_TEKST,
} from "../../js/visning/presentasjon-modell.js";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const KL1000 = new Date(2026, 9, 12, 10, 0, 0).getTime();

test("fri visning har sin egen id, og en plan-id kan aldri bli «fri»", () => {
  assert.equal(FRI_PLAN, "fri");
  assert.equal(paminnelseNokkel(FRI_PLAN), "paminnelser:fri");
  for (let i = 0; i < 50; i++) assert.notEqual(nyPlanId(), FRI_PLAN);
  assert.equal(RASK_MAKS, 20);
});

test("raskPaminnelse: «om N min» og «kl.» blir et fast tidspunkt", () => {
  const om = raskPaminnelse({ type: "om", min: "15", tekst: " Pause ", lerret: true }, KL1000);
  assert.deepEqual(om.p, { id: `r${KL1000.toString(36)}`, type: "naar", naar: KL1000 + 15 * 60000, tekst: "Pause", lerret: true });
  const kl = raskPaminnelse({ type: "kl", kl: "10:45", tekst: "Spør om Motown" }, KL1000);
  assert.equal(kl.p.naar, new Date(2026, 9, 12, 10, 45).getTime());
  assert.equal(kl.p.lerret, false);
});

test("raskPaminnelse: sier fra om tom tekst, ugyldige minutter og passert klokkeslett", () => {
  assert.match(raskPaminnelse({ type: "om", min: 5, tekst: "  " }, KL1000).feil, /Skriv hva/);
  assert.match(raskPaminnelse({ type: "om", min: 0, tekst: "x" }, KL1000).feil, /1 til 600/);
  assert.match(raskPaminnelse({ type: "om", min: 601, tekst: "x" }, KL1000).feil, /1 til 600/);
  assert.match(raskPaminnelse({ type: "om", min: "", tekst: "x" }, KL1000).feil, /1 til 600/);
  assert.match(raskPaminnelse({ type: "kl", kl: "09:59", tekst: "x" }, KL1000).feil, /passert/);
  assert.match(raskPaminnelse({ type: "kl", kl: "10:00", tekst: "x" }, KL1000).feil, /passert/);
  assert.match(raskPaminnelse({ type: "kl", kl: "", tekst: "x" }, KL1000).feil, /klokkeslett/);
});

test("en rask påminnelse (naar) forfaller på tidspunktet sitt, uansett når visningen startet", () => {
  const { p } = raskPaminnelse({ type: "om", min: 10, tekst: "Lagre timen" }, KL1000);
  assert.deepEqual(rensPaminnelser([p]), [p]);
  assert.equal(paminnelseTid(p, KL1000 - 3600000), p.naar);
  assert.equal(paminnelseTid(p, NaN), p.naar, "trenger ingen starttid");
  assert.deepEqual(forfalnePaminnelser([p], KL1000, p.naar - 1), []);
  assert.deepEqual(forfalnePaminnelser([p], KL1000, p.naar), [p]);
  assert.deepEqual(forfalnePaminnelser([p], KL1000, p.naar + 5000, [p.id]), [], "vist én gang");
  assert.equal(paminnelseEtikett(p), "Kl. 10.10");
  assert.deepEqual(rensPaminnelser([{ id: "x", type: "naar", naar: "tull", tekst: "x" }]), []);
});

test("tastene: O viser oversikten (bare med plan), R gir ny påminnelse; ikke i skrivefelt eller holdt inne", () => {
  const t = (key, ekstra = {}) => ({ key, ...ekstra });
  assert.equal(presTast(t("o"), { plan: true }), "kikkOversikt");
  assert.equal(presTast(t("O"), { plan: true }), "kikkOversikt");
  assert.equal(presTast(t("o"), { plan: false }), null);
  assert.equal(presTast(t("o", { repeat: true }), { plan: true }), null);
  assert.equal(presTast(t("o"), { plan: true, iSkrivefelt: true }), null);
  assert.equal(presTast(t("r")), "paminnelse");
  assert.equal(presTast(t("R"), { plan: true }), "paminnelse");
  assert.equal(presTast(t("r"), { iSkrivefelt: true }), null);
  assert.equal(presTast(t("r", { metaKey: true })), null, "Cmd+R laster siden på nytt");
  const taster = PRES_TASTER.flatMap((g) => g.rader.flatMap((r) => r.taster));
  assert.ok(taster.includes("O") && taster.includes("R"));
});

test("visningen: påminnelsene starter også i fri visning, og O og R er koblet til handlingene", () => {
  const kilde = les("js/visning/presentasjon.js");
  assert.match(kilde, /startPaminnelser\(\{ planId: planId \|\| FRI_PLAN,[^}]*raskNokkel: LAGRING\.raskePaminnelser/);
  assert.match(kilde, /case "kikkOversikt": return kikkOversikt\(\);/);
  assert.match(kilde, /case "paminnelse": return erLerret \? undefined : vekslPanel\("rask"\);/);
  // O flytter ikke posisjonen: kikkOversikt kaller aldri gaTilStopp.
  const kikk = kilde.match(/function kikkOversikt\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.ok(kikk && !/gaTilStopp/.test(kikk), "kikkOversikt skal ikke gå til et stopp");
  // v6.74 (brukervalg 2026-10-11): tidsknappene erstatter den faste lista for
  // fri visning. Visning-vinduet har ingen slik redigering, og en gammel
  // paminnelser:fri leses ikke i visningen. Kjøreplanenes påminnelser står.
  const vis = les("js/visning/visning.js");
  assert.doesNotMatch(vis, /vis-fri-pam|lagreFri|FRI_PLAN/);
  assert.match(vis, /id="pres-adm-pam-ny"/, "kjøreplanens påminnelser står");
  assert.match(les("js/visning/paminnelser.js"), /planAktiv !== FRI_PLAN \? \(data\[planAktiv\] \|\| \[\]\) : \[\]/);
});

test("tidsknappene: hvert tiende og hvert femtende minutt opp til 120, kvarterene markert", () => {
  assert.deepEqual(PAMINNELSE_PRESET_MIN, [10, 15, 20, 30, 40, 45, 50, 60, 70, 75, 80, 90, 100, 105, 110, 120]);
  for (let n = 10; n <= 120; n += 5) assert.equal(PAMINNELSE_PRESET_MIN.includes(n), n % 10 === 0 || n % 15 === 0, `${n} min`);
  assert.match(les("js/visning/presentasjon.js"), /\$\{n % 15 === 0 \? " kvarter" : ""\}/);
  assert.match(les("css/styles.css"), /\.pres-rask-preset\.kvarter \{ color: var\(--text-accent\); font-weight: 600; \}/);
  const kilde = les("js/visning/presentasjon.js");
  assert.match(kilde, /PAMINNELSE_PRESET_MIN\.map\(/);
  assert.match(kilde, /foerHeleTimen\(naa\)/);
});

test("foerHeleTimen: to minutter før førstkommende hele time, og timen etter", () => {
  const kl = (t, m, s = 0) => new Date(2026, 9, 12, t, m, s).getTime();
  assert.deepEqual(foerHeleTimen(kl(10, 17)), [kl(10, 58), kl(11, 58)], "brukerens eksempel: 10.17 gir 10.58");
  assert.deepEqual(foerHeleTimen(kl(10, 0)), [kl(10, 58), kl(11, 58)]);
  assert.deepEqual(foerHeleTimen(kl(10, 57, 59)), [kl(10, 58), kl(11, 58)]);
  assert.deepEqual(foerHeleTimen(kl(10, 58)), [kl(11, 58), kl(12, 58)], "alt passert: neste time");
  assert.deepEqual(foerHeleTimen(kl(10, 59)), [kl(11, 58), kl(12, 58)]);
});

test("en lenke i påminnelsen lukker påminnelsen etter at kortet er åpnet (v6.74)", () => {
  const kilde = les("js/visning/paminnelser.js");
  assert.match(kilde, /const LENKE = "\.artist-link, \.tech-link, \.genre-link, \.plateselskap-link";/);
  assert.match(kilde, /lukkEtterLenke\(e\.target\)/);
  assert.match(kilde, /setTimeout\(\(\) => lukk\(id\), 150\)/);
  assert.match(kilde, /if \(!id \|\| !planAktiv \|\| !nokler\) return;/, "aldri på lerretet");
});

test("Oversikt-ikonet er borte fra toppfeltet (v6.72): Oversikt er en knapp i Innhold", () => {
  for (const side of ["index.html", "teacher.html", "tre.html", "student.html", "utskrift.html"]) {
    const nav = les(side).match(/<nav class="nav">[\s\S]*?<\/nav>/)?.[0] || "";
    assert.ok(nav, side);
    assert.doesNotMatch(nav, /title="Oversikt"/, side);
  }
  assert.match(les("teacher.html"), /id="btn-t-inn-oversikt"/, "knappen i Innhold står");
});

test("knappene «før hel time» legger rett inn med fast tekst, også over midnatt (v6.75)", () => {
  assert.deepEqual(HEL_TIME_TEKST, ["Pause om 2 minutter", "Timen er over om 2 minutter"]);
  const kl2330 = new Date(2026, 9, 12, 23, 30).getTime();
  const [forste, andre] = foerHeleTimen(kl2330);
  assert.equal(andre, new Date(2026, 9, 13, 0, 58).getTime());
  const r = raskPaminnelse({ type: "naar", naar: andre, tekst: HEL_TIME_TEKST[1] }, kl2330);
  assert.deepEqual(r.p, { id: `r${kl2330.toString(36)}`, type: "naar", naar: andre, tekst: "Timen er over om 2 minutter", lerret: false });
  assert.match(raskPaminnelse({ type: "naar", naar: kl2330, tekst: "x" }, kl2330).feil, /passert/);
  assert.equal(raskPaminnelse({ type: "naar", naar: forste, tekst: HEL_TIME_TEKST[0] }, kl2330).p.naar, forste);
  const kilde = les("js/visning/presentasjon.js");
  assert.match(kilde, /data-rask-hel="\$\{i\}" data-rask-naar="\$\{ms\}"/);
  assert.match(kilde, /raskPaminnelse\(\{ type: "naar", naar, tekst, lerret: true \}\)/, "også på lerretet (v6.76)");
});
