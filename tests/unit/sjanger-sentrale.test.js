// Sentrale lytteeksempler for sjangeren (v7.28, brukerønske 2026-11-10). Tre
// nivåer per lytteeksempel: kontekst, sentral for artisten (`sentral`) og
// sentral for sjangeren (`sjangersentral`). Merket står på eksempelet, og
// sjangeren er eksempelets egen (`genre`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sjangerEksempler, sjangerSentrale, erSjangerSentral, eksempelNokkel, sentraleEndringer } from "../../js/sjangre/sjanger-sentrale.js";
import { MUSIC_SPEC, musicSpecWithGenres, normalizeRows, rowInnerHtml } from "../../js/ui/row-editor.js";
import { FLATER, NIVAA_SEKT } from "../../js/visning/presentasjon-modell.js";
import { lesJs } from "../helpers/js-filer.js";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const yt = (id) => `https://www.youtube.com/watch?v=${id}`;
const artist = (id, name, musicExamples, extra = {}) => ({ id, name, status: "active", musicExamples, ...extra });

const ARTISTER = [
  artist("muddy", "Muddy Waters", [
    { label: "Hoochie Coochie Man", year: 1954, url: yt("aaaaaaaaaaa"), genre: "Electric blues", sjangersentral: true },
    { label: "Mannish Boy", year: 1955, url: yt("bbbbbbbbbbb"), genre: "Electric blues", sentral: true },
    { label: "Rollin' Stone", year: 1950, url: yt("ccccccccccc"), genre: "Delta blues", sjangersentral: true },
  ]),
  artist("wolf", "Howlin' Wolf", [
    { label: "Smokestack Lightnin'", year: 1956, url: yt("ddddddddddd"), genre: "electric blues ", sjangersentral: true, sentral: true },
    { label: "Uten år", url: yt("eeeeeeeeeee"), genre: "Electric blues", sjangersentral: true },
    { label: "Farlig lenke", year: 1951, url: "javascript:alert(1)", genre: "Electric blues", sjangersentral: true },
    { label: "Spoonful", year: 1960, performanceYear: 1950, url: yt("fffffffffff"), genre: "Electric blues" },
  ]),
  artist("skjult", "Skjult artist", [
    { label: "Skjult sang", year: 1949, url: yt("ggggggggggg"), genre: "Electric blues", sjangersentral: true },
  ], { hidden: true }),
  artist("ventende", "Ventende", [
    { label: "Ventende sang", year: 1948, url: yt("hhhhhhhhhhh"), genre: "Electric blues", sjangersentral: true },
  ], { status: "pending" }),
];

test("sjangerEksempler: sjangeren i raden, synlige artister, gyldig lenke, etter år (uten år sist)", () => {
  const titler = sjangerEksempler(ARTISTER, "Electric blues").map(({ m }) => m.label);
  assert.deepEqual(titler, ["Hoochie Coochie Man", "Mannish Boy", "Smokestack Lightnin'", "Spoonful", "Uten år"]);
  assert.deepEqual(sjangerEksempler(ARTISTER, "").map(({ m }) => m.label), []);
  assert.deepEqual(sjangerEksempler(null, "Electric blues"), []);
});

test("sjangerSentrale: bare de merket sentrale for sjangeren, ikke de sentrale for artisten", () => {
  const ut = sjangerSentrale(ARTISTER, "Electric blues");
  assert.deepEqual(ut.map(({ a, m }) => `${a.id}:${m.label}`), ["muddy:Hoochie Coochie Man", "wolf:Smokestack Lightnin'", "wolf:Uten år"]);
  assert.deepEqual(sjangerSentrale(ARTISTER, "Delta blues").map(({ m }) => m.label), ["Rollin' Stone"]);
});

test("erSjangerSentral: bare true teller", () => {
  assert.equal(erSjangerSentral({ sjangersentral: true }), true);
  for (const v of [false, "true", 1, undefined]) assert.equal(erSjangerSentral({ sjangersentral: v }), false);
  assert.equal(erSjangerSentral(null), false);
});

test("sentraleEndringer: setter og fjerner merket på de viste, og lar alt annet stå", () => {
  const vist = new Set(sjangerEksempler(ARTISTER, "Electric blues").map(({ a, m }) => eksempelNokkel(a.id, m)));
  const valgt = new Set([eksempelNokkel("muddy", ARTISTER[0].musicExamples[1]), eksempelNokkel("wolf", ARTISTER[1].musicExamples[0])]);
  const ut = sentraleEndringer(ARTISTER, "Electric blues", valgt, vist);
  assert.deepEqual(Object.keys(ut).sort(), ["muddy", "wolf"], "den skjulte og den ventende røres ikke");
  const [hoochie, mannish, rollin] = ut.muddy;
  assert.equal("sjangersentral" in hoochie, false, "fjernet");
  assert.equal(hoochie.label, "Hoochie Coochie Man");
  assert.equal(mannish.sjangersentral, true, "satt");
  assert.equal(mannish.sentral, true, "sentral for artisten står");
  assert.equal(rollin, ARTISTER[0].musicExamples[2], "en annen sjanger røres ikke");
  assert.equal(ut.wolf[0], ARTISTER[1].musicExamples[0], "uendret er samme objekt");
  assert.equal("sjangersentral" in ut.wolf[1], false);
  assert.equal(ut.wolf[2].sjangersentral, true, "et eksempel som ikke sto i lista (farlig lenke), røres ikke");
  assert.equal(ARTISTER[0].musicExamples[0].sjangersentral, true, "kilden er ikke endret");
  assert.deepEqual(sentraleEndringer(ARTISTER, "Electric blues", new Set([...vist].filter((k) => /Hoochie|Smokestack|Uten år/.test(k))), vist), {}, "ingen endring, ingen skriving");
});

test("raden: to avkrysninger for læreren, skjult (men til stede) for studentene, lagres som true", () => {
  const f = MUSIC_SPEC.fields.find((x) => x.key === "sjangersentral");
  assert.equal(f.type, "check");
  assert.equal(f.tekst, "Sentral for sjangeren");
  assert.equal(MUSIC_SPEC.fields.find((x) => x.key === "sentral").tekst, "Sentral for artisten");
  assert.ok(f.breakAfter, "linjeskiftet kommer etter den siste avkrysningen");
  assert.ok(!MUSIC_SPEC.fields.find((x) => x.key === "sentral").breakAfter);
  const eks = { label: "So What", url: yt("ylXk1LBvIqU"), genre: "Modal jazz", sjangersentral: true };
  assert.match(rowInnerHtml(musicSpecWithGenres(["Modal jazz"], { laerer: true }), eks), /<label class="row-check me-sjangersentral-wrap"><input type="checkbox" class="me-sjangersentral" checked/);
  assert.match(rowInnerHtml(musicSpecWithGenres(["Modal jazz"]), eks), /<label class="row-check me-sjangersentral-wrap" hidden><input type="checkbox" class="me-sjangersentral" checked/);
  const spec = musicSpecWithGenres(["Modal jazz"]);
  const ut = normalizeRows(spec, [eks, { ...eks, sjangersentral: false }, { ...eks, sjangersentral: "true" }]);
  assert.equal(ut[0].sjangersentral, true);
  assert.equal("sjangersentral" in ut[1], false);
  assert.equal("sjangersentral" in ut[2], false);
});

test("sjangerkortet: egen seksjon under beskrivelsen, fra nivå 1 i visningen", () => {
  const ids = FLATER.sjanger.map((s) => s.id);
  assert.equal(ids.indexOf("sentrale"), ids.indexOf("beskrivelse") + 1);
  assert.ok(NIVAA_SEKT.sjanger[1].includes("sentrale"));
  assert.ok(NIVAA_SEKT.sjanger[2].includes("sentrale"));
  const g = lesJs("genealogy.js");
  assert.match(g, /\$\{sekt\("sentrale", n\.g \? sentraleHtml\(sjangerSentrale\(artists, n\.l\), \{ velg: !!onVelgSentrale \}\) : ""\)\}/);
  assert.match(g, /class="lytt-lenke" href="\$\{escapeHtml\(safeUrl\(m\.url\)\)\}"/, "appens spiller tar lenka");
  assert.match(g, /data-related-id="\$\{escapeHtml\(String\(a\.id\)\)\}"/, "artistnavnet åpner kortet (wireRelated)");
  assert.match(g, /if \(!par\.length && !velg\) return "";/, "studentene ser ingenting før noe er valgt");
});

test("«Velg sentrale» er bare lærerens, og lagrer i én batch", () => {
  assert.match(lesJs("teacher.js"), /onVelgSentrale: \(label, navn\) => apneVelgSentrale\(label, navn\),/);
  assert.match(lesJs("explore-context.js"), /onVelgSentrale: opts\.onVelgSentrale,/);
  for (const f of ["landing.js", "tre-page.js"]) assert.doesNotMatch(lesJs(f), /onVelgSentrale/, f);
  const v = lesJs("sjanger-sentrale-velger.js");
  assert.match(v, /sentraleEndringer\(state\.artists, label, valgt\(\), vist\)/, "fra artistene slik de er ved lagring");
  assert.match(v, /type: "doc\.merge", coll: "artists", id, data: \{ musicExamples \}/);
  assert.match(v, /guardTeacherAction\(runMigrationPlan\(ops\)\.then\(\(\) => true\)\)/);
  assert.match(v, /backdrop\._beforeClose = \(\) => \{ sporOgLukk\(\); return false; \};/, "Escape spør ved endringer");
  assert.match(les("css/styles.css"), /body\.presentasjon \.gx-velg-sentrale \{ display: none; \}/);
});

test("«Bare sentrale lytteeksempler» i Gått gjennom tar med de sentrale for sjangeren", () => {
  assert.match(lesJs("gjennomgang-modell.js"), /if \(m\.sentral === true \|\| m\.sjangersentral === true\) e\.sentral = true;/);
});
