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
