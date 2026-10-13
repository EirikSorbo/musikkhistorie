// Viktighetsnivået (v6.85, brukerønske 2026-10-13): ett nivå for appen,
// trinnvist (viktigst; viktig og viktigst; alle med grad), som gjelder
// artistlistene og spillelistene, med merke i toppfeltet. Fargene: viktigst i
// dagens farge, viktig i blekk, mindre viktig i grått.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iViktighetsnivaa, filterArtists } from "../../js/felles/limits.js";
import { SKJUL_I_STUDENTVISNING } from "../../js/felles/feature-flags.js";
import { aktivtNivaa, settNivaa, etterNivaa, settLaererside, viktighetSynlig, NIVAA_TEKST, vedNivaaEndring } from "../../js/ui/viktighet.js";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const lager = new Map();
globalThis.localStorage = {
  getItem: (k) => (lager.has(k) ? lager.get(k) : null),
  setItem: (k, v) => lager.set(k, String(v)),
  removeItem: (k) => lager.delete(k),
};

const A = (name, priority) => ({ name, priority, status: "active", mainGenre: [], subGenre: [] });
const liste = [A("Viktigst", 3), A("Viktig", 2), A("Mindre", 1), A("Uten", 0), A("Skjult", -1)];
const navn = (l) => l.map((a) => a.name);

test("iViktighetsnivaa: nivået og alt over; uten grad er ute når et nivå er valgt", () => {
  assert.deepEqual(navn(liste.filter((a) => iViktighetsnivaa(a, 3))), ["Viktigst"]);
  assert.deepEqual(navn(liste.filter((a) => iViktighetsnivaa(a, 2))), ["Viktigst", "Viktig"]);
  assert.deepEqual(navn(liste.filter((a) => iViktighetsnivaa(a, 1))), ["Viktigst", "Viktig", "Mindre"]);
  assert.equal(liste.filter((a) => iViktighetsnivaa(a, 0)).length, 5, "0 = alle");
});

test("filterArtists: prioritet er trinnvis, «Skjult» (-1) treffer bare de skjulte", () => {
  assert.deepEqual(navn(filterArtists(liste, { priority: 2 })), ["Viktigst", "Viktig"]);
  assert.deepEqual(navn(filterArtists(liste, { priority: 1 })), ["Viktigst", "Viktig", "Mindre"]);
  assert.deepEqual(navn(filterArtists(liste, { priority: -1 })), ["Skjult"]);
});

test("nivået gjelder bare når graden er synlig: læreren alltid, studentene når bryteren er på", () => {
  const gml = SKJUL_I_STUDENTVISNING.viktighetsgrad;
  try {
    settLaererside(false);
    SKJUL_I_STUDENTVISNING.viktighetsgrad = true;
    settNivaa(2);
    assert.equal(lager.get("pensum-viktighet"), "2", "lagres");
    assert.equal(viktighetSynlig(), false);
    assert.equal(aktivtNivaa(), 0, "skjult for studentene: ingen nivå");
    assert.equal(etterNivaa(liste).length, 5);
    SKJUL_I_STUDENTVISNING.viktighetsgrad = false;
    assert.equal(aktivtNivaa(), 2);
    assert.deepEqual(navn(etterNivaa(liste)), ["Viktigst", "Viktig"]);
    SKJUL_I_STUDENTVISNING.viktighetsgrad = true;
    settLaererside(true);
    assert.equal(aktivtNivaa(), 2, "læreren ser alltid");
  } finally {
    SKJUL_I_STUDENTVISNING.viktighetsgrad = gml;
    settLaererside(false);
  }
});

test("settNivaa: 0 og ugyldige verdier slår av; lytterne får nivået", () => {
  settLaererside(true);
  const fikk = [];
  vedNivaaEndring((n) => fikk.push(n));
  settNivaa(3); settNivaa(7); settNivaa(1); settNivaa(0);
  assert.deepEqual(fikk.slice(-4), [3, 0, 1, 0]);
  assert.equal(lager.has("pensum-viktighet"), false);
  assert.deepEqual(NIVAA_TEKST, { 3: "Bare viktigst", 2: "Viktig og viktigst", 1: "Alle med viktighetsgrad" });
  settLaererside(false);
});

test("spillelistene og artistkortet: nivået i byggerne, merket på kortet", () => {
  const ui = les("js/ui/ui.js");
  assert.match(ui, /const genreArtists = etterNivaa\(/, "sjangerens spilleliste");
  assert.match(ui, /export function countArtistExamples\(list\) \{\n  return playlistRows\(\[\.\.\.etterNivaa\(list\)\]/);
  assert.match(ui, /export function openArtistsPlaylistModal\(title, list\) \{\n  const \{ total, html, ider \} = playlistRows\(\[\.\.\.etterNivaa\(list\)\]/);
  assert.match(ui, /for \(const a of etterNivaa\(\(artists \|\| \[\]\)\.filter\(isVisible\)\)\)/, "tiårenes lister");
  assert.match(ui, /\$\{sekt\("tags", `<div class="meta" style="margin-bottom:12px">\$\{prioMerkeHtml\(a\)\}\$\{metaRader\(a\)\}<\/div>`\)\}/);
  assert.match(les("js/utforsk/explore-lytt.js"), /openEksemplerSpilleliste\(`Spilleliste: \$\{x\.d\}-tallet`, x\.par, \{ nivaa: true \}\)/);
});

test("merket i toppfeltet startes på forsiden, i slektstreet og på lærersiden", () => {
  for (const f of ["js/landing.js", "js/tre-page.js", "js/teacher.js"]) assert.match(les(f), /initViktighetsMerke\(\);/, f);
  assert.match(les("js/teacher.js"), /settLaererside\(true\);\n  initViktighetsMerke\(\);\n  setupFilters\(\);/);
});

test("fargene: viktigst i dagens farge, viktig i blekk, mindre viktig i grått", () => {
  const css = les("css/styles.css");
  const v = (k) => css.match(new RegExp(`${k}:\\s*([^;]+);`))?.[1].trim();
  assert.equal(v("--prio-3-line"), "var(--accent-600)");
  assert.equal(v("--prio-3-text"), "var(--accent-700)");
  assert.equal(v("--prio-2-text"), "var(--ink)");
  assert.equal(v("--prio-1-text"), "var(--stone-600)");
  assert.equal(v("--prio-1-line"), "var(--stone-300)");
});
