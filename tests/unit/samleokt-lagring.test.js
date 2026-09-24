// Samleøktas lagring og kjøreplan-skrivingene (v5.43, audit v5.42 funn 1, 2,
// 3, 4 og 6). Kjernen er rene funksjoner i presentasjon-modell.js; resten er
// kildelåser på de fem stedene som skriver eller tar opp.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brukSamleOps, normaliserSamleOps, samleMerke, samleVentende, normaliserPlaner } from "../../js/presentasjon-modell.js?v=5.48";

const kilde = (f) => readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");
const S = (...vis) => vis.map((v) => ({ vis: v }));
const vis = (liste) => liste.map((s) => s.vis);

test("brukSamleOps: øktas handlinger lagt oppå den ferske planen", () => {
  assert.deepEqual(vis(brukSamleOps(S("a"), [{ t: "legg", vis: "x" }, { t: "legg", vis: "y" }])), ["a", "x", "y"]);
  // Erstatningsregelen: åpning av varmekartet, så valg av Country.
  assert.deepEqual(vis(brukSamleOps(S("a", "varmekart"), [{ t: "erstatt", fra: "varmekart", til: "varmekart:Country" }])),
    ["a", "varmekart:Country"]);
  // Erstatt når stoppet er fjernet i editoren imens: legges til.
  assert.deepEqual(vis(brukSamleOps(S("a"), [{ t: "erstatt", fra: "varmekart", til: "varmekart:Country" }])),
    ["a", "varmekart:Country"]);
  // Angre fjerner siste stopp med målet, også når editoren har flyttet det.
  assert.deepEqual(vis(brukSamleOps(S("x", "a", "x", "b"), [{ t: "fjern", vis: "x" }])), ["x", "a", "b"]);
  assert.deepEqual(vis(brukSamleOps(S("a"), [{ t: "fjern", vis: "borte" }])), ["a"], "fjern av noe som ikke finnes, gjør ingenting");
  // Planen er redigert et annet sted (b fjernet, d flyttet, m lagt til):
  // øktas tillegg legges oppå, alt annet står (funn 3).
  assert.deepEqual(vis(brukSamleOps(S("d", "a", "c", "m"), [{ t: "legg", vis: "x" }])), ["d", "a", "c", "m", "x"]);
  // Nivået editoren satte, står.
  assert.deepEqual(brukSamleOps([{ vis: "a", nivaa: 1 }], [{ t: "legg", vis: "x" }]), [{ vis: "a", nivaa: 1 }, { vis: "x" }]);
  // Inndata røres ikke.
  const f = S("a"); brukSamleOps(f, [{ t: "legg", vis: "x" }, { t: "fjern", vis: "a" }]);
  assert.deepEqual(f, S("a"));
});

test("samleMerke og samleVentende: planen sier hvilke av øktas skrivinger den viser", () => {
  const plan = { stopp: S("a"), samle: { s1: 3, s2: 7 } };
  assert.equal(samleMerke(plan, "s1"), 3);
  assert.equal(samleMerke(plan, "s9"), 0, "en annen økts merke teller ikke");
  assert.equal(samleMerke(null, "s1"), 0, "planen finnes ikke");
  assert.equal(samleMerke({ samle: { s1: "3" } }, "s1"), 0);
  const sendt = [{ n: 2, ops: [] }, { n: 3, ops: [] }, { n: 4, ops: [] }];
  assert.deepEqual(samleVentende(sendt, 3).map((b) => b.n), [4], "4 er ikke speilet ennå, eller avvist");
  assert.deepEqual(samleVentende(sendt, 0).map((b) => b.n), [2, 3, 4], "ingenting kom fram (forrige side, eller tilbakerullet)");
});

test("samleøkt-scenarioene fra kontrollrundene, i den rene modellen", () => {
  // To avviste skrivinger på rad: planen ruller tilbake til [a] og merket til 0,
  // så begge skrivingenes handlinger sendes på nytt, én gang, i rekkefølge.
  const sendt = [{ n: 1, ops: [{ t: "legg", vis: "b" }, { t: "legg", vis: "c" }] }, { n: 2, ops: [{ t: "legg", vis: "d" }] }];
  const vent = samleVentende(sendt, samleMerke({ stopp: S("a") }, "s1"));
  assert.deepEqual(vis(brukSamleOps(S("a"), vent.flatMap((b) => b.ops))), ["a", "b", "c", "d"]);
  // Sidebytte: skriving 1 nådde fram, og en annen fane la til e imens. Merket
  // viser 1, så ingenting sendes to ganger.
  const fersk = { stopp: S("a", "b", "e"), samle: { s1: 1 } };
  assert.deepEqual(samleVentende([{ n: 1, ops: [{ t: "legg", vis: "b" }] }], samleMerke(fersk, "s1")), []);
  // Uten nett: legg til x, angre, legg til x igjen: siste handling vinner.
  assert.deepEqual(vis(brukSamleOps(S("a", "b"), [{ t: "legg", vis: "x" }, { t: "fjern", vis: "x" }, { t: "legg", vis: "x" }])), ["a", "b", "x"]);
});

test("normaliserSamleOps og normaliserPlaner: vasker handlinger og beholder merkene", () => {
  assert.deepEqual(normaliserSamleOps([{ t: "legg", vis: "a", rart: 1 }, { t: "fjern" }, null, { t: "erstatt", fra: "a", til: "b" }, { t: "ukjent", vis: "x" }]),
    [{ t: "legg", vis: "a" }, { t: "erstatt", fra: "a", til: "b" }]);
  assert.deepEqual(normaliserSamleOps("tull"), []);
  const p = normaliserPlaner({ p1: { tittel: "T", stopp: S("a"), samle: { s1: 2, s2: -1, s3: "x" } }, p2: { tittel: "U", stopp: [] } });
  assert.deepEqual(p.p1.samle, { s1: 2 });
  assert.equal("samle" in p.p2, false, "planer uten merke får ikke feltet");
});

test("funn 2: opptaket teller bare ekte endringer i kortet øverst", () => {
  const samle = kilde("plan-innsamling.js");
  assert.match(samle, /attributeFilter: \["data-vis"\], attributeOldValue: true/,
    "observatøren må få den gamle verdien");
  assert.match(samle, /if \(el !== topp \|\| !el\.classList\?\.contains\("open"\)\) continue;/,
    "bare kortet øverst: kortet under tegnes om av snapshots");
  assert.match(samle, /if \(!el\.dataset\.vis \|\| m\.oldValue === el\.dataset\.vis\) continue;/,
    "en omtegning med samme verdi er ikke et valg");
});

test("funn 1 og 2: samleøkta skriver ikke per kort, og aldri en kø av gamle kopier", () => {
  const samle = kilde("plan-innsamling.js");
  assert.equal((samle.match(/savePlan\(/g) || []).length, 1, "én skrivevei, i skrivEnGang");
  assert.doesNotMatch(samle, /lagreKø/, "den gamle køen med én kopi per tillegg er borte");
  const leggTil = samle.slice(samle.indexOf("function leggTil("), samle.indexOf("function angreSiste("));
  assert.match(leggTil, /endret\(økt\);/);
  assert.doesNotMatch(leggTil, /lagreNaa\(/, "et tillegg sendes ikke med en gang");
  assert.match(samle, /const SAMLE_LAGRE_MS = 120_000;/);
  assert.match(samle, /document\.visibilityState === "hidden"/, "sendes når fanen skjules");
  // Den ferske planen med det den ikke viser lagt oppå, stemplet med merket.
  assert.match(samle, /const stopp = brukSamleOps\(fersk\?\.stopp \|\| \[\], \[\.\.\.vent\.flatMap\(\(b\) => b\.ops\), \.\.\.ø\.nye\]\);/);
  // Hver bøtte har bare sine egne handlinger (kontrollrunde 3), og det som alt
  // er i Firestores kø fra denne sida, sendes ikke én gang til.
  assert.match(samle, /ø\.sendt = \[\.\.\.ø\.sendt, \{ n, ops: ø\.nye, live: true \}\];/);
  assert.match(samle, /if \(!ø\.nye\.length && !vent\.some\(\(b\) => !b\.live\)\) return null;/);
  assert.match(samle, /return lastet\(\) \? ventende\(ø\)\.some\(\(b\) => !b\.live\) : ø\.sendt\.length > 0;/);
  assert.match(samle, /samle: \{ \[ø\.øktId\]: n \},/);
  assert.match(samle, /ø\.sendt = ø\.sendt\.filter\(\(b\) => b\.n > n\);/, "kvitteringer i rekkefølge");
  // Skrivere utenfor økta sender aldri merket (det kunne senke det).
  assert.equal((kilde("plan-meny.js").match(/savePlan\(planId, uttenMerke\(/g) || []).length, 2);
});

test("funn 4: hver skriving rører bare sin egen plan, og ingenting skrives før planene er lastet", () => {
  const store = kilde("store.js");
  assert.doesNotMatch(store, /savePresentasjoner/, "hele-dokumentet-skrivingen er borte");
  assert.match(store, /\{ planer: \{ \[id\]: plan \}, updatedAt: new Date\(\)\.toISOString\(\) \}, \{ merge: true \}/);
  assert.match(store, /\{ planer: \{ \[id\]: deleteField\(\) \}, updatedAt: new Date\(\)\.toISOString\(\) \}, \{ merge: true \}/);
  for (const f of ["visning.js", "plan-meny.js", "plan-innsamling.js", "presentasjon.js"]) {
    assert.doesNotMatch(kilde(f), /savePresentasjoner/, f);
  }
  const vis = kilde("visning.js");
  assert.match(vis, /if \(!planeneLastet\(\)\) \{ msg\(IKKE_LASTET, false\); return; \}   \/\/ kladden beholdes/);
  assert.match(vis, /id="pres-adm-ny" \$\{lastet \? "" : "disabled"\}/, "Ny er av mens planene laster");
  const meny = kilde("plan-meny.js");
  assert.match(meny, /if \(!planeneLastet\(\)\) throw new Error/, "«Legg til her» venter også");
});

test("funn 6: en kjøreplan som spilles, tas ikke opp; fri visning tar opp som før", () => {
  const vis = kilde("visning.js");
  assert.match(vis, /window\.open\(ø && !spiller \? medOvertakelse\(url\) : url, "_blank", "noopener"\);/,
    "ny fane: synkront i klikket, uten kopiert sessionStorage; fri visning tar økta med i URL-en");
  assert.match(vis, /if \(!spiller\) \{ window\.location\.href = url; return; \}/,
    "fri visning i samme fane: økta følger med og tar opp timen");
  assert.match(vis, /return forlatSamleokt\(\)\.then/, "kjøreplan i samme fane: spør og send før sidebyttet");
  assert.match(vis, /gaaTilVisning\(`index\.html\?presentasjon=\$\{encodeURIComponent\(spill\.dataset\.presSpill\)\}`, \{ spiller: true \}\);/);
  assert.match(vis, /\.\.\.\(spilles \? \[\] : \[\{ label: "Ta opp alt jeg åpner", value: "opptak" \}\]\)/,
    "opptak tilbys ikke mens en plan spilles");
  const samle = kilde("plan-innsamling.js");
  assert.match(samle, /if \(økt\.modus === "opptak" && !spillerPlan\(\)\) leggTil\(vis, "apning"\);/);
  assert.match(samle, /if \(økt\?\.modus !== "opptak" \|\| spillerPlan\(\)\) return;/);
  assert.match(samle, /if \(erTreSide && modus === "opptak" && !spillerPlan\(\)\)/);
});

test("funn 3: Rediger og Slett på planen som samles avslutter økta først", () => {
  const vis = kilde("visning.js");
  assert.match(vis, /if \(aktivSamleokt\(\)\?\.planId === id\) \{\n\s*await medFrist\(avsluttInnsamling\(\), 4000\);/,
    "Rediger: det samlede sendes før kladden lages");
  assert.match(vis, /forkastSamlinger\(id\);\n\s*if \(!\(await vakt\(deletePlan\(id\)\)\)\) return;/,
    "Slett: ingenting sendes, heller ikke fra avsluttede økter, ellers lages planen på nytt");
  assert.match(vis, /\$\{id === samles \? " · samles nå" : ""\}/);
});

test("kontrollrunden: det usendte overlever en Ferdig før planene har landet", () => {
  const samle = kilde("plan-innsamling.js");
  assert.match(samle, /const USENDT = "pensumSamleUsendt";/);
  assert.match(samle, /if \(harUsendt\(ø\) \|\| ø\.sendt\.some\(\(b\) => b\.live\)\) \{\n\s*etterslep\.push\(ø\);/,
    "avsluttInnsamling husker det usendte, hver økt for seg");
  assert.match(samle, /if \(!e\.forsøkt\) lagreNaa\(e\);/, "ett forsøk per side, ikke ved hvert snapshot");
  assert.match(samle, /etterslep = lesEtterslep\(\);/, "neste side tar det opp");
  assert.match(samle, /if \(ø\.avsluttet && !ø\.varslet\) \{/, "feilmeldingen kommer én gang");
  assert.match(samle, /planFantes: ø\.planFantes, varslet: !!ø\.varslet,/, "også over sidebytter");
});

test("kontrollrunden: overlevering til ny fane bare for lærer, og lista følger økta", () => {
  const samle = kilde("plan-innsamling.js");
  assert.match(samle, /if \(startet \|\| !erLaererBruker\(user\) \|\| økt\) return;/);
  assert.match(samle, /for \(const k of Object\.values\(OVERTA\)\) u\.searchParams\.delete\(k\);/,
    "en omlasting starter ikke økta på nytt");
  assert.match(samle, /modus !== "plukk" && modus !== "opptak"\)\) return null;/);
  assert.equal((samle.match(/meldEndring\(\);/g) || []).length, 2, "start og slutt");
  assert.match(kilde("visning.js"), /vedSamleEndring\(\(\) => visningTikk\(\)\);/);
});

test("kontrollrunde 3: én fane per økt, og tilbake fra bfcache lastes sida på nytt", () => {
  const samle = kilde("plan-innsamling.js");
  assert.match(samle, /new BroadcastChannel\("pensum-samle"\)/);
  assert.match(samle, /if \(m\.eier === økt\.øktId && økt\.venterEier\) erKopi\(økt\);/);
  assert.match(samle, /ø\.øktId = nyØktId\(\);\n\s*ø\.n = 0;\n\s*ø\.sendt = \[\];\n\s*ø\.nye = ø\.nye\.slice\(ø\.nyeVedStart \|\| 0\);/,
    "en kopi sender ikke den andre fanens handlinger");
  assert.match(samle, /if \(ø\.forkastet \|\| !lastet\(\) \|\| ø\.venterEier\) return null;/, "ingen skriving før eierskapet er avklart");
  assert.match(samle, /if \(e\.persisted && \(økt \|\| les\(LAGRING\.plan\)\)\) window\.location\.reload\(\);/);
  assert.match(samle, /export function forkastSamlinger\(planId\)/);
});
