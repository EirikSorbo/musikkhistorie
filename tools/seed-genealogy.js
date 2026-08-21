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

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Metasjangrene som egne oppføringer, i den pedagogiske rekkefølgen. Fargen
// utledes her (den vanligste familien blant metasjangerens noder, røtter unntatt)
// slik at dokumentet BÆRER den, i stedet for at hver leser regner den ut på nytt.
// Fra fase 3 er dette feltet lærerens å redigere.
function byggMetaGenres() {
  const brukte = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.g))];
  const rang = new Map(META_ORDER_HINT.map((m, i) => [m, i]));
  const sortert = [...brukte].sort((a, b) => (rang.get(a) ?? Infinity) - (rang.get(b) ?? Infinity));

  const tally = {};
  for (const n of GENEALOGY) {
    if (!n.g || n.fam === "gray") continue;
    (tally[n.g] ||= {})[n.fam] = (tally[n.g][n.fam] || 0) + 1;
  }
  return sortert.map((navn, i) => {
    const fams = Object.entries(tally[navn] || {}).sort((a, b) => b[1] - a[1]);
    const fam = fams[0]?.[0] || "gray";
    return { name: navn, order: i, fam, color: FAMILIES[fam]?.stroke || FAMILIES.gray.stroke };
  });
}

// Noden slik den lagres. Utelater felter som er tomme, så dokumentet er lesbart
// og lite. rx og t tas bare med når de har innhold.
function byggNode(n) {
  const ut = {
    id: n.id, l: n.l, f: n.f, fam: n.fam,
    g: n.g ?? null,
    r: n.r, cx: n.cx,
    p: n.p || [],
  };
  if (n.yOffset) ut.yOffset = n.yOffset;
  if (n.rx?.length) ut.rx = n.rx;
  if (n.era) ut.era = n.era;
  if (n.t?.length) ut.t = n.t;
  return ut;
}

const tree = {
  version: 1,
  nodes: GENEALOGY.map(byggNode),
  families: FAMILIES,
  metaOrderHint: META_ORDER_HINT,
  metaGenres: byggMetaGenres(),
};

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
console.log(`  metasjangre i rekkefølge: ${tree.metaGenres.map((m) => m.name).join(" · ")}`);
