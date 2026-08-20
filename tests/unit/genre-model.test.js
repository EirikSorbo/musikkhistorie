// ============================================================================
//  SJANGERMODELLEN — avledningene må være uendret
// ----------------------------------------------------------------------------
//  tests/fixtures/genre-model.json er en FASIT tatt fra js/genealogy.js slik den
//  så ut FØR treet ble flyttet ut av koden (v4.47). Testene her bygger modellen
//  fra frøet og krever at hver avledede struktur er dypt lik fasiten.
//
//  Feiler en av dem, er det én av to ting: enten er en formel endret ved et
//  uhell, eller så er treet bevisst endret. I det andre tilfellet skal fasiten
//  regenereres BEVISST (tools/dump-genre-fixture.js) og diffen leses som en
//  pensumendring, ikke kvitteres bort.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GENEALOGY as SEED_NODES, FAMILIES as SEED_FAMILIES, META_ORDER_HINT } from "../../js/genealogy-data.js";
import {
  rebuild, GENEALOGY, GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, META_GENRE_ORDER,
  GENEALOGY_EDGES, MAIN_GENRE_INFO, META_GENRE_COLOR, DECADE_ROWS,
  isMainGenre, findTreeGenreNode, canonMainGenre, genreNodeById, edgeKey,
  isGenreModelReady, onGenreModelChanged,
} from "../../js/genre-model.js";

const HER = path.dirname(fileURLToPath(import.meta.url));
const fasit = JSON.parse(fs.readFileSync(path.join(HER, "../fixtures/genre-model.json"), "utf8"));

const seed = () => rebuild({ nodes: SEED_NODES, families: SEED_FAMILIES, metaOrderHint: META_ORDER_HINT });
seed();

test("frøet gir nøyaktig fasitens noder", () => {
  assert.equal(GENEALOGY.length, fasit.nodes.length);
  // rebuild normaliserer rx til alltid å finnes; sammenlign feltvis mot fasiten.
  GENEALOGY.forEach((n, i) => {
    const f = fasit.nodes[i];
    assert.equal(n.id, f.id, `node ${i} id`);
    assert.equal(n.l, f.l);
    assert.equal(n.f, f.f);
    assert.equal(n.fam, f.fam);
    assert.equal(n.g, f.g ?? null);
    assert.deepEqual(n.p, f.p);
    assert.deepEqual(n.rx, f.rx || []);
  });
});

test("sjangervokabularet er uendret", () => {
  assert.deepEqual(GENEALOGY_MAIN_GENRES, fasit.mainGenres);
});

test("metasjangrene og den pedagogiske rekkefølgen er uendret", () => {
  assert.deepEqual(GENEALOGY_META_GENRES, fasit.metaGenres);
  assert.deepEqual(META_GENRE_ORDER, fasit.metaGenreOrder);
});

test("kantene er uendret, i samme rekkefølge", () => {
  assert.deepEqual(GENEALOGY_EDGES, fasit.edges);
});

test("fargeoppslagene er uendret", () => {
  assert.deepEqual(MAIN_GENRE_INFO, fasit.mainGenreInfo);
  assert.deepEqual(META_GENRE_COLOR, fasit.metaGenreColor);
});

test("isMainGenre svarer likt for alle navn i treet, også i annen case", () => {
  for (const [navn, ventet] of Object.entries(fasit.isMainGenreTable)) {
    assert.equal(isMainGenre(navn), ventet, navn);
  }
});

test("findTreeGenreNode peker på samme node som før", () => {
  for (const [navn, ventetId] of Object.entries(fasit.findTreeGenreNodeTable)) {
    assert.equal(findTreeGenreNode(navn)?.id ?? null, ventetId, navn);
  }
});

test("edgeKey er dokument-ID-en i edgeDescriptions", () => {
  assert.equal(edgeKey("blues", "rnb"), "blues__rnb");
});

test("canonMainGenre kanoniserer case og avviser ikke-sjangre", () => {
  assert.equal(canonMainGenre("blues"), "Blues");
  assert.equal(canonMainGenre("BLUES"), "Blues");
  assert.equal(canonMainGenre("Rockabilly"), undefined);
});

test("genreNodeById slår opp på id", () => {
  assert.equal(genreNodeById("blues")?.l, "Blues");
  assert.equal(genreNodeById("finnes-ikke"), null);
});

test("tiårsaksen dekker alle radene i treet", () => {
  const maxRad = Math.max(...SEED_NODES.map((n) => Math.floor(n.r)));
  assert.equal(DECADE_ROWS.length, maxRad + 1);
  assert.equal(DECADE_ROWS[0], "Røtter");
  assert.equal(DECADE_ROWS[1], "1900");
  assert.equal(DECADE_ROWS[2], "1910-t");
  assert.equal(DECADE_ROWS[maxRad], "2010-t");
});

test("aksen vokser med treet: en node på en ny rad gir en ny tiårsetikett", () => {
  rebuild({
    nodes: [{ id: "x", l: "X", f: "X", fam: "gray", r: 13, p: [], g: "Pop" }],
    families: SEED_FAMILIES, metaOrderHint: META_ORDER_HINT,
  });
  assert.equal(DECADE_ROWS.length, 14);
  assert.equal(DECADE_ROWS[13], "2020-t");
  seed();
});

test("tomt tre gir tom modell og ikke-klar status, uten å kaste", () => {
  rebuild({ nodes: [], families: {}, metaOrderHint: [] });
  assert.equal(isGenreModelReady(), false);
  assert.deepEqual(GENEALOGY_MAIN_GENRES, []);
  assert.deepEqual(GENEALOGY_EDGES, []);
  assert.equal(isMainGenre("Blues"), false);
  assert.equal(findTreeGenreNode("Blues"), null);
  rebuild(undefined);          // helt uten argument skal også overleves
  assert.equal(isGenreModelReady(), false);
  seed();
  assert.equal(isGenreModelReady(), true);
});

test("lyttere varsles ved hver ombygging, og kan melde seg av", () => {
  let n = 0;
  const av = onGenreModelChanged(() => { n++; });
  seed();
  assert.equal(n, 1);
  seed();
  assert.equal(n, 2);
  av();
  seed();
  assert.equal(n, 2, "avmeldt lytter skal ikke varsles");
});

test("en lytter som kaster stopper ikke de andre", () => {
  let naadde = false;
  const a = onGenreModelChanged(() => { throw new Error("med vilje"); });
  const b = onGenreModelChanged(() => { naadde = true; });
  seed();
  a(); b();
  assert.equal(naadde, true);
});
