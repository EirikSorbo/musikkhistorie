// Ny ren logikk fra strukturgjennomgangen 3.10.2026 (v6.05–v6.22) som manglet
// tester, og låser på rettingene etter Fable-gjennomgangen (v6.23).
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { timeStopp, delteTimer, ytSpillelisteIder } from "../../js/presentasjon-modell.js?v=6.24";
import { tiarEksempler, spillAlleHtml } from "../../js/ui.js?v=6.24";
import { iSpalter } from "../../js/explore-sjanger.js?v=6.24";
import { timeEksempler, timeTilgjengelig } from "../../js/explore-timer.js?v=6.24";
import { SKJUL_I_STUDENTVISNING } from "../../js/feature-flags.js?v=6.24";

const kilde = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const yt = (id) => `https://www.youtube.com/watch?v=${id}`;
const id = (n) => `vid${String(n).padStart(8, "0")}`;   // 11 tegn, gyldig YouTube-ID

// ---------------------------------------------------------------------------
//  «Fra timene» (U1)
// ---------------------------------------------------------------------------
test("timeStopp: gyldige mål, hvert én gang, i rekkefølgen de ble vist", () => {
  assert.deepEqual(timeStopp(["artist:a1", "tull", "artist:a1", "tiår:1960", 7, null]),
    [{ vis: "artist:a1" }, { vis: "tiår:1960" }]);
  assert.deepEqual(timeStopp(null), []);
});

test("delteTimer: bare delte planer med stopp, nyeste dato først", () => {
  const t = delteTimer({
    a: { tittel: "A", delt: true, dato: "2026-09-01", stopp: [{ vis: "artist:x" }] },
    b: { tittel: "B", delt: true, dato: "2026-10-01", stopp: [{ vis: "artist:y" }] },
    c: { tittel: "C", delt: false, dato: "2026-10-02", stopp: [{ vis: "artist:z" }] },
    d: { tittel: "D", delt: true, dato: "2026-10-03", stopp: [] },
  });
  assert.deepEqual(t.map((x) => x.id), ["b", "a"]);
});

test("timeEksempler: eksemplene til de viste artistene og de spilte videoene, hvert én gang", () => {
  const artister = [
    { id: "a1", name: "En", musicExamples: [{ url: yt(id(1)), label: "Låt 1" }, { url: yt(id(2)), label: "Låt 2" }] },
    { id: "a2", name: "To", musicExamples: [{ url: yt(id(3)), label: "Låt 3" }] },
  ];
  const plan = { stopp: [{ vis: "artist:a1" }, { vis: `yt:${id(3)}` }, { vis: `yt:${id(1)}` }] };
  assert.deepEqual(timeEksempler(plan, artister).map((p) => p.m.label), ["Låt 1", "Låt 2", "Låt 3"]);
});

// v6.23 (Fable F6): en ?vis=time:-lenke åpnet før hvilken som helst plan.
test("timeTilgjengelig: studenten får bare delte timer, og bare med bryteren på", () => {
  const for_ = SKJUL_I_STUDENTVISNING.fraTimene;
  try {
    SKJUL_I_STUDENTVISNING.fraTimene = false;
    assert.equal(timeTilgjengelig({ delt: true }), true);
    assert.equal(timeTilgjengelig({ delt: false }), false, "ikke delt");
    assert.equal(timeTilgjengelig(undefined), false, "finnes ikke");
    SKJUL_I_STUDENTVISNING.fraTimene = true;
    assert.equal(timeTilgjengelig({ delt: true }), false, "bryteren er av");
  } finally {
    SKJUL_I_STUDENTVISNING.fraTimene = for_;
  }
});

// ---------------------------------------------------------------------------
//  Tiår og «Spill alle»
// ---------------------------------------------------------------------------
test("tiarEksempler: innspillingsåret (ellers framføringsåret) i tiåret, bare med lenke, sortert på år", () => {
  const artister = [
    { id: "a", name: "B-artist", status: "active", musicExamples: [
      { url: yt(id(1)), label: "Seksti", year: 1965 },
      { url: yt(id(2)), label: "Sytti", year: 1971 },
      { url: "", label: "Uten lenke", year: 1962 },
    ] },
    { id: "b", name: "A-artist", status: "active", musicExamples: [
      { url: yt(id(3)), label: "Framført", performanceYear: 1961 },
      { url: yt(id(3)), label: "Framført", performanceYear: 1961 },
    ] },
    { id: "c", name: "Skjult", status: "active", priority: -1, musicExamples: [{ url: yt(id(4)), label: "Skjult", year: 1963 }] },
  ];
  assert.deepEqual(tiarEksempler(artister, 1960).map((p) => p.m.label), ["Framført", "Seksti"]);
});

// v6.21–v6.23: knappene sier hvilke rader de spiller, og radnumrene følger
// lista (Fable F5: før talte de bare videoene).
test("spillAlleHtml: spennene er radnumrene i lista, og rader uten video hoppes over", () => {
  const rader = Array.from({ length: 60 }, (_, i) => (i === 2 ? null : id(i)));
  const html = spillAlleHtml(rader);
  const tekster = [...html.matchAll(/>På YouTube \(([^)]+)\)</g)].map((m) => m[1]);
  assert.deepEqual(tekster, ["1–51", "52–60"], "rad 3 er ikke en video, så første del når rad 51");
  const lenker = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  assert.equal(ytSpillelisteIder(lenker[0]).length, 50);
  assert.equal(ytSpillelisteIder(lenker[1]).length, 9);
});

test("spillAlleHtml: én del, duplikater spilles én gang, og under to videoer ingen knapp", () => {
  assert.match(spillAlleHtml([id(1), id(2), id(1), null]), />På YouTube \(1–2\)</);
  assert.equal(spillAlleHtml([id(1), null]), "");
  assert.equal(spillAlleHtml([]), "");
});

// ---------------------------------------------------------------------------
//  Sjangre-spaltene (v6.12)
// ---------------------------------------------------------------------------
test("iSpalter: faste spalter med Pop under Gospel, og en ukjent metasjanger i den korteste", () => {
  const g = (meta, n) => ({ meta, n });
  const grupper = ["Blues", "Jazz", "R&B", "Hip-hop", "Klubbmusikk", "Gospel", "Country", "Pop", "Rock"]
    .map((m) => g(m, { Jazz: 11, Country: 9 }[m] || 3)).concat(g("Ny", 2));
  const sp = iSpalter(grupper, (x) => x.n).map((s) => s.map((x) => x.meta));
  assert.deepEqual(sp, [["Blues", "Jazz"], ["R&B", "Hip-hop", "Ny"], ["Klubbmusikk", "Gospel", "Pop"], ["Country", "Rock"]],
    "R&B + Hip-hop er den korteste spalten, så den nye havner der");
  assert.deepEqual(iSpalter([g("Jazz", 4)], (x) => x.n).map((s) => s.map((x) => x.meta)), [["Jazz"], [], [], []],
    "metasjangre uten noder står ikke med, og spaltene beholder plassen");
});

// ---------------------------------------------------------------------------
//  Tilbakeknappen og Sjangre-fanene (ui-modal.js, Fable F1 og F3)
// ---------------------------------------------------------------------------
test("histApnet hever et kort som alt ligger lenger ned, også i historikkstabelen", () => {
  const src = kilde("js/ui-modal.js");
  const start = src.indexOf("function histApnet");
  const kropp = src.slice(start, src.indexOf("\n}\n", start));
  assert.match(kropp, /histStabel\.splice\(i, 1\);\s*histStabel\.push\(el\);/);
});

test("modalBytt lukker alt over målet når målet alt står åpent lenger ned", () => {
  const src = kilde("js/ui-modal.js");
  const start = src.indexOf("export function modalBytt");
  const kropp = src.slice(start, src.indexOf("\n}\n", start));
  assert.match(kropp, /lukkFlere\(/);
  assert.match(kropp, /> z\)\);\s*apne\(\);/);
});

// v6.24 (brukervalg 2026-10-04): «Lagre som time» tilbys også etter en
// kjøreplan. Timen blir en egen plan (nyPlanId) med dagens dato, og
// kjøreplanen endres ikke. Før gjaldt spørsmålet bare fri visning.
test("Avslutt tilbyr «Lagre som time» også etter en kjøreplan, som en egen plan", () => {
  const src = kilde("js/presentasjon.js");
  const start = src.indexOf("export async function avsluttPresentasjon");
  const kropp = src.slice(start, src.indexOf("\n}\n", start));
  assert.match(kropp, /if \(erLaerer && stopp\.length\) \{/);
  assert.doesNotMatch(kropp, /!aktivPlanId\(\)/);
  assert.match(kropp, /savePlan\(nyPlanId\(\), \{ tittel, laget: idag\.toISOString\(\), dato, stopp \}\)/);
  assert.match(kropp, /kjoreplan\.tittel/);
});
