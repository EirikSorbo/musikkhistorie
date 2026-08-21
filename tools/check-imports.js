#!/usr/bin/env node
// ============================================================================
//  IMPORTSJEKK — finner brutte og ubrukte importer i hele modulgrafen
// ----------------------------------------------------------------------------
//  Appen har ingen bundler og ingen typesjekk, så en import av et symbol som
//  ikke lenger eksporteres oppdages først som en hvit side i nettleseren. Denne
//  sjekken leser alle js/*.js, finner hva hver fil importerer og eksporterer, og
//  rapporterer:
//    · BRUTT   — importert navn som kildemodulen ikke eksporterer
//    · UBRUKT  — importert navn som ikke forekommer i filas kropp
//    · UKJENT  — import av en lokal fil som ikke finnes
//
//  Kjør: node tools/check-imports.js      (exit 1 hvis noe er brutt)
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS = path.join(ROT, "js");

const filer = fs.readdirSync(JS).filter((f) => f.endsWith(".js"));
const kilde = Object.fromEntries(filer.map((f) => [f, fs.readFileSync(path.join(JS, f), "utf8")]));

// Fjerner KOMMENTARER, men beholder strenger: modulstien i en import er en
// streng, så blanker vi strenger her, forsvinner selve importen. (Det var
// nettopp den feilen som gjorde at verktøyets første utgave meldte «ren» om et
// tre med brutte importer.)
function utenKommentarer(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

// Blanker vanlige strenger. MALER (backticks) beholdes med vilje: halve appen
// bygger HTML i maler, og et symbol brukt i ${...} er ekte bruk. Blanket vi dem,
// ville nesten hver eneste import blitt meldt som ubrukt.
function utenStrenger(src) {
  return src
    // HTML-kommentarer inne i malene er tekst, ikke kode. Uten dette ble et
    // symbolnavn nevnt i en <!-- forklaring --> lest som bruk.
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, ' "" ')
    .replace(/'(?:\\.|[^'\\])*'/g, " '' ");
}

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const BARE_RE = /export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;

function eksporterteNavn(src) {
  const ut = new Set();
  const s = utenKommentarer(src);
  for (const m of s.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) ut.add(m[1]);
  for (const m of s.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) ut.add(m[1]);
  // export { a, b as c }  og  export { a } from "..."
  for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const del of m[1].split(",")) {
      const t = del.trim();
      if (!t) continue;
      const som = t.split(/\s+as\s+/);
      ut.add((som[1] || som[0]).trim());
    }
  }
  return ut;
}

const eksport = Object.fromEntries(filer.map((f) => [f, eksporterteNavn(kilde[f])]));

const brutt = [], ubrukt = [], ukjent = [];

for (const f of filer) {
  const s = utenKommentarer(kilde[f]);
  // Kroppen: importlinjene og strengene ut, så «bruk» betyr faktisk bruk.
  const kropp = utenStrenger(s.replace(IMPORT_RE, " ").replace(BARE_RE, " "));
  for (const m of s.matchAll(IMPORT_RE)) {
    const spec = m[2];
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;   // eksterne (Firebase) hoppes over
    const fil = path.basename(spec.split("?")[0]);
    if (!kilde[fil]) { ukjent.push(`${f} → ${spec}`); continue; }
    for (const del of m[1].split(",")) {
      const t = del.trim();
      if (!t) continue;
      const [orig, alias] = t.split(/\s+as\s+/).map((x) => x.trim());
      const lokalt = alias || orig;
      if (!eksport[fil].has(orig)) brutt.push(`${f}: importerer «${orig}» fra ${fil}, som ikke eksporterer det`);
      // Egen ordgrense: \b virker ikke rundt «$» (som er et gyldig, og brukt,
      // symbolnavn her), så $-hjelperen ble alltid meldt som ubrukt.
      const n = lokalt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const brukt = new RegExp(`(?<![A-Za-z0-9_$])${n}(?![A-Za-z0-9_$])`).test(kropp);
      if (!brukt) ubrukt.push(`${f}: importerer «${lokalt}» fra ${fil}, men bruker den ikke`);
    }
  }
}

// «Brukt, men ikke importert» — en ReferenceError som først viser seg når
// kodelinjen KJØRER, og som verken node --check eller importsjekken over
// fanger (begge ser bare på importer som finnes).
//
// Dette har slått til to ganger: edgeKey ble stående i genealogy.js etter at
// en re-eksport forsvant, og GENRE_ADMIN_HTML ble brukt i teacher.js uten at
// importen kom med — sistnevnte tok ned HELE lærersiden, fordi startApp kastet
// på første linje og alt etter forble ukoblet.
//
// Vi ser på navn som en ANNEN modul i prosjektet eksporterer. Det gir få falske
// positive (navnet finnes tross alt som eksport et sted) og fanger nettopp den
// feilen: symbolet er hentet fra en modul, men importlinja mangler.
const alleEksporter = new Map();          // navn → [filer som eksporterer det]
for (const f of filer) {
  for (const navn of eksport[f]) {
    if (!alleEksporter.has(navn)) alleEksporter.set(navn, []);
    alleEksporter.get(navn).push(f);
  }
}

const manglende = [];
for (const f of filer) {
  const s = utenKommentarer(kilde[f]);
  const importert = new Set();
  for (const m of s.matchAll(IMPORT_RE)) {
    for (const del of m[1].split(",")) {
      const t = del.trim(); if (!t) continue;
      const [orig, alias] = t.split(/\s+as\s+/).map((x) => x.trim());
      importert.add(alias || orig);
    }
  }
  // Standard-importer (import X from "...") og navnerom teller også.
  for (const m of s.matchAll(/import\s+([A-Za-z0-9_$]+)\s*(?:,|from)/g)) importert.add(m[1]);
  for (const m of s.matchAll(/import\s*\*\s*as\s+([A-Za-z0-9_$]+)/g)) importert.add(m[1]);

  const kropp = utenStrenger(s.replace(IMPORT_RE, " ").replace(BARE_RE, " "));
  // Alt filen selv deklarerer, inkludert parametre og destrukturering, skygger.
  const lokale = new Set();
  for (const re of [
    /(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g,
    /\b([A-Za-z0-9_$]+)\s*(?:=>|\()/g,
    /\{([^{}]*)\}\s*=/g,
  ]) {
    for (const m of kropp.matchAll(re)) {
      for (const bit of m[1].split(/[,:\s]+/)) if (bit) lokale.add(bit.trim());
    }
  }
  for (const [navn, hvor] of alleEksporter) {
    // Kun navn som begynner med STOR bokstav: konstanter og markup-symboler
    // (GENRE_ADMIN_HTML, MODAL_HTML, GENEALOGY). De er nesten aldri lokale
    // variabler, så treffene er ekte. Små forbokstaver ($ , state, opts, ctx,
    // getState …) er ofte parametre eller lokale navn, og ga bare støy.
    if (!/^[A-Z]/.test(navn)) continue;
    if (hvor.includes(f) || importert.has(navn) || lokale.has(navn)) continue;
    // «(?!{)» holder «${» i maler utenfor: der er $ interpolasjon, ikke
    // hjelperen $ fra shared.js.
    const gr = "(?![A-Za-z0-9_$" + "{])";      // «{» holder ${ i maler utenfor
    if (new RegExp("(?<![A-Za-z0-9_$.])" + navn + gr).test(kropp)) {
      manglende.push(`${f}: bruker «${navn}» (eksportert av ${hvor.join(", ")}) uten å importere det`);
    }
  }
}
brutt.push(...manglende);

const skriv = (tittel, liste) => {
  if (!liste.length) return;
  console.log(`\n${tittel} (${liste.length}):`);
  liste.forEach((l) => console.log("  " + l));
};

skriv("BRUTTE IMPORTER", brutt);
skriv("UKJENTE MODULER", ukjent);
skriv("UBRUKTE IMPORTER", ubrukt);

if (!brutt.length && !ukjent.length && !ubrukt.length) console.log("Importgrafen er ren.");
else console.log(`\n${filer.length} filer sjekket.`);

process.exit(brutt.length || ukjent.length ? 1 : 0);
