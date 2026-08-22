#!/usr/bin/env node
// ============================================================================
//  REGENERERER TESTFASITEN tests/fixtures/genre-model.json
// ----------------------------------------------------------------------------
//  Kjøres BEVISST når treet eller en avledningsformel er endret med vilje:
//
//      node tools/dump-genre-fixture.js
//
//  Les diffen som en pensumendring før commit — testene i
//  tests/unit/genre-model.test.js låser hver avledede struktur mot denne fila.
//  Modellen bygges via byggGenealogyDoc (v2-formen produksjonen leser), samme
//  vei som tests/helpers/seed-model.js.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENEALOGY as SEED_NODES, FAMILIES as SEED_FAMILIES, META_ORDER_HINT } from "../js/genealogy-data.js";
import { byggGenealogyDoc } from "./build-genealogy-doc.js";
import {
  rebuild, GENEALOGY, GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, META_GENRE_ORDER,
  GENEALOGY_EDGES, MAIN_GENRE_INFO, META_GENRE_COLOR, isMainGenre, findTreeGenreNode,
} from "../js/genre-model.js";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UTFIL = path.join(ROT, "tests", "fixtures", "genre-model.json");

const doc = byggGenealogyDoc({ GENEALOGY: SEED_NODES, FAMILIES: SEED_FAMILIES, META_ORDER_HINT });
rebuild(doc);

// Oppslagstabellene: alle navn i treet i original og annen case, pluss noen
// som IKKE skal treffe — så testene låser både treff og bom.
const isMainGenreTable = {};
const findTreeGenreNodeTable = {};
for (const n of GENEALOGY) {
  for (const navn of [n.l, n.l.toLowerCase(), n.l.toUpperCase()]) {
    isMainGenreTable[navn] = isMainGenre(navn);
    findTreeGenreNodeTable[navn] = findTreeGenreNode(navn)?.id ?? null;
  }
  if (n.f !== n.l) findTreeGenreNodeTable[n.f] = findTreeGenreNode(n.f)?.id ?? null;
}
for (const navn of ["Rockabilly-tull", "Finnes ikke", ""]) {
  isMainGenreTable[navn] = isMainGenre(navn);
  findTreeGenreNodeTable[navn] = findTreeGenreNode(navn)?.id ?? null;
}

const fasit = {
  nodes: GENEALOGY,
  families: doc.families,
  metaOrderHint: doc.metaOrderHint,
  mainGenres: GENEALOGY_MAIN_GENRES,
  metaGenres: GENEALOGY_META_GENRES,
  metaGenreOrder: META_GENRE_ORDER,
  edges: GENEALOGY_EDGES,
  mainGenreInfo: MAIN_GENRE_INFO,
  metaGenreColor: META_GENRE_COLOR,
  isMainGenreTable,
  findTreeGenreNodeTable,
};
fs.writeFileSync(UTFIL, JSON.stringify(fasit, null, 2) + "\n");
console.log(`Skrevet: ${path.relative(ROT, UTFIL)}`);
console.log(`  noder=${fasit.nodes.length} sjangre=${fasit.mainGenres.length} metasjangre=${fasit.metaGenres.length} kanter=${fasit.edges.length}`);
