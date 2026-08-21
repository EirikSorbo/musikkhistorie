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

  // To ULIKE akser, begge lærerens å styre senere:
  //  · order  — den pedagogiske rekkefølgen (varmekart og tidslinje leser den)
  //  · column — venstre-mot-høyre i slektstreet
  // De er bevisst forskjellige: pedagogisk står den afroamerikanske linja
  // samlet først, mens kartet har Country ytterst til venstre. Kolonnene
  // utledes her av medianen av de gamle håndsatte cx-ene, slik at det nye
  // utregnede kartet arver den venstre-mot-høyre-plasseringen som allerede satt.
  const medianCx = (navn) => {
    const v = GENEALOGY.filter((n) => n.g === navn).map((n) => n.cx).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)] ?? 0;
  };
  const kolonne = new Map([...brukte].sort((a, b) => medianCx(a) - medianCx(b)).map((m, i) => [m, i]));

  const tally = {};
  for (const n of GENEALOGY) {
    if (!n.g || n.fam === "gray") continue;
    (tally[n.g] ||= {})[n.fam] = (tally[n.g][n.fam] || 0) + 1;
  }
  return sortert.map((navn, i) => {
    const fams = Object.entries(tally[navn] || {}).sort((a, b) => b[1] - a[1]);
    const fam = fams[0]?.[0] || "gray";
    return {
      name: navn, order: i, column: kolonne.get(navn) ?? i,
      fam, color: FAMILIES[fam]?.stroke || FAMILIES.gray.stroke,
    };
  });
}

// Familien metasjangeren gir sine noder — brukes til å avgjøre hvilke noder som
// trenger sin EGEN fam som unntak.
function metaFam(metaGenres, navn) {
  return metaGenres.find((m) => m.name === navn)?.fam || null;
}

// Noden slik den lagres. Utelater felter som er tomme, så dokumentet er lesbart
// og lite. rx og t tas bare med når de har innhold.
function byggNode(n, metaGenres) {
  const ut = {
    id: n.id, l: n.l, f: n.f,
    g: n.g ?? null,
    r: n.r,
    p: n.p || [],
  };
  // fam lagres KUN som unntak. Noden arver ellers metasjangerens farge, og en
  // lærer som bytter farge på metasjangeren skal se hele familien følge etter.
  // I dagens pensum er unntakene to: Reggae (grønn i turkis Klubbmusikk) og
  // Tin Pan Alley (grå i Pop). Røttene har ingen metasjanger og beholder grå.
  //
  // cx er BORTE: x regnes ut av js/genre-layout.js fra kolonne + slektskap.
  const arvet = n.g ? metaFam(metaGenres, n.g) : null;
  if (n.fam && n.fam !== arvet) ut.fam = n.fam;
  if (n.yOffset) ut.yOffset = n.yOffset;
  if (n.rx?.length) ut.rx = n.rx;
  if (n.era) ut.era = n.era;
  if (n.t?.length) ut.t = n.t;
  return ut;
}

const metaGenres = byggMetaGenres();
const tree = {
  version: 2,
  nodes: GENEALOGY.map((n) => byggNode(n, metaGenres)),
  families: FAMILIES,
  metaOrderHint: META_ORDER_HINT,
  metaGenres,
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
console.log(`  pedagogisk rekkefølge: ${[...tree.metaGenres].sort((a, b) => a.order - b.order).map((m) => m.name).join(" · ")}`);
console.log(`  kolonner (v→h):        ${[...tree.metaGenres].sort((a, b) => a.column - b.column).map((m) => m.name).join(" · ")}`);
console.log(`  noder med egen farge:  ${tree.nodes.filter((n) => n.fam && n.g).map((n) => n.l).join(", ") || "ingen"}`);
