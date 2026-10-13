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

// Skjulingen i eget felt (v6.86, brukervalg 2026-10-13): forarbeid til flere
// sett med viktighetsgrad. «Skjult» er feltet hidden; den gamle -1 leses som
// skjult til læreren har flyttet den over (Skrivebordet).
import { erSkjult, isVisible } from "../../js/felles/limits.js";

test("erSkjult: hidden eller den gamle -1; isVisible bruker den", () => {
  assert.equal(erSkjult({ hidden: true, priority: 3 }), true, "skjult med grad");
  assert.equal(erSkjult({ priority: -1 }), true, "gammel -1");
  assert.equal(erSkjult({ priority: 0 }), false);
  assert.equal(erSkjult({ hidden: false, priority: 2 }), false);
  assert.equal(isVisible({ status: "active", hidden: true, priority: 3 }), false);
  assert.equal(isVisible({ status: "active", priority: 2 }), true);
  const l = [{ name: "a", hidden: true, priority: 3 }, { name: "b", priority: -1 }, { name: "c", priority: 3 }];
  assert.deepEqual(filterArtists(l, { priority: -1 }).map((a) => a.name), ["a", "b"], "lærerens «Skjult»-filter");
  assert.deepEqual(filterArtists(l, { priority: 3 }).map((a) => a.name), ["a", "c"], "graden står for seg");
});

test("skjulingen: lærerens knapper skriver hidden, flyttingen er én knapp på Skrivebordet", () => {
  const st = les("js/laerer/teacher-state.js");
  assert.match(st, /remove: {6}\(id\) => guardTeacherAction\(updateArtistFields\(id, \{ hidden: true \}\)\)/);
  assert.match(st, /\{ hidden: false, priority: 0 \} : \{ hidden: false \}/, "vis igjen rydder også -1");
  assert.doesNotMatch(st, /setArtistPriority\(id, -1\)/);
  assert.match(les("js/data/store.js"), /batch\.update\(doc\(db, "artists", id\), \{ hidden: true, priority: 0 \}\)/);
  const desk = les("js/laerer/teacher-desk.js");
  assert.match(desk, /const gamleSkjulte = \(\) => state\.artists\.filter\(\(a\) => \(a\.priority \|\| 0\) === -1\)/);
  assert.match(desk, /\$\{migreringHtml\(\)\}/);
  // Ingen kode utenom erSkjult og flyttingen tester -1 som skjult lenger.
  for (const f of ["js/ui/ui.js", "js/ui/ui-helpers.js", "js/ui/ui-dashboard.js", "js/felles/linkify.js"]) {
    assert.doesNotMatch(les(f), /\(\w+\.priority \|\| 0\) [!=]== -1/, f);
  }
});

test("normaliseringen tar med hidden bare når den er sann (studentenes forslag har ikke feltet)", async () => {
  const kilde = les("js/data/artist-normalize.js");
  assert.match(kilde, /\.\.\.\(n\.hidden === true \? \{ hidden: true \} : \{\}\)/);
  assert.doesNotMatch(les("firestore.rules"), /"hidden"/, "studentenes hasOnly-liste skal ikke ha feltet");
  assert.match(les("js/data/artist-schema.js"), /"proposedBy", "priority", "hidden", "teacherChecked", "status"/, "med i eksporten");
});
