#!/usr/bin/env node
// ============================================================================
//  SEED-GENERATOR FOR SJANGERTREET
// ----------------------------------------------------------------------------
//  Bygger dokumentet content/genealogy fra frøet i js/genealogy-data.js og
//  skriver det som JSON. Fila importeres av læreren i Innholdspakke-flyten;
//  agenter og skript skriver ALDRI til Firestore direkte.
//
//  Kjør:  node tools/seed-genealogy.js
//  Ut:    json files/genealogy-seed.json
//
//  Formen MÅ være { formatVersion, genealogy: {...} } med genealogy på
//  TOPPNIVÅ — importøren leser toppnøkler (se CONTENT_KEYS i
//  js/teacher-import.js), ikke en content-innpakning.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENEALOGY, FAMILIES, META_ORDER_HINT } from "../js/genealogy-data.js";
import { validateTree } from "../js/genre-validate.js";
import { byggGenealogyDoc } from "./build-genealogy-doc.js";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Transformasjonen er delt med testene (tests/helpers/seed-model.js), så
// suiten kjører NØYAKTIG formen denne fila skriver og produksjonen leser.
const tree = byggGenealogyDoc({ GENEALOGY, FAMILIES, META_ORDER_HINT });

const problemer = validateTree(tree);
const feil = problemer.filter((p) => p.nivå === "feil");
problemer.forEach((p) => console.log(`  [${p.nivå}] ${p.melding}`));
if (feil.length) {
  console.error(`\nAVBRUTT: ${feil.length} feil i treet. Ingen fil skrevet.`);
  process.exit(1);
}

const utfil = path.join(ROT, "json files", "genealogy-seed.json");
fs.mkdirSync(path.dirname(utfil), { recursive: true });
fs.writeFileSync(utfil, JSON.stringify({ formatVersion: 1, genealogy: tree }, null, 2) + "\n");

console.log(`Skrevet: ${path.relative(ROT, utfil)}`);
console.log(`  noder=${tree.nodes.length} metasjangre=${tree.metaGenres.length} familier=${Object.keys(tree.families).length}`);
console.log(`  pedagogisk rekkefølge: ${tree.metaOrderHint.join(" · ")}`);
console.log(`  kolonner (v→h):        ${[...tree.metaGenres].sort((a, b) => a.column - b.column).map((m) => m.name).join(" · ")}`);
console.log(`  noder med egen farge:  ${tree.nodes.filter((n) => n.fam && n.g).map((n) => n.l).join(", ") || "ingen"}`);
console.log("");
console.log("  ADVARSEL: Fila bygges fra KODEFRØET (js/genealogy-data.js, treet");
console.log("  slik det sto i v4.47). Har læreren endret treet i tre-editoren");
console.log("  etterpå, vil en import av denne fila STILLE RULLE TILBAKE de");
console.log("  endringene (importen erstatter hele content/genealogy). Ta en");
console.log("  fersk eksport fra lærersiden i stedet hvis treet er redigert.");
