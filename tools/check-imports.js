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
//  I tillegg fire vakter:
//    · FORELDRELØS — js-modul som verken importeres av noen eller lastes fra
//      en HTML-side (død fil ingen verktøy ellers ser)
//    · genealogy-data-REGELEN — ingen runtime-modul får importere frøet
//      js/genealogy-data.js (appen skal ikke ha noen kopi av pensumet i koden;
//      kun tools/ og tests/ leser det)
//    · IMPORTRING — filer som importerer hverandre i ring (fra v6.29)
//    · VIDERESENDING — en modul som eksporterer noe den selv har importert
//      (fra v6.29)
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

// Plukker ut uttrykkene i ${…} og leverer dem som løs tekst.
//
// GRUNNEN: utenStrenger over blanker anførselstegn uten å vite om de står i en
// vanlig streng eller inne i en MAL. Halve appen bygger HTML i maler, og der
// står symbolene typisk i et attributt:
//
//     `<div title="${escapeHtml(t)}" style="width:${pct(a, b)}%">`
//
// De to anførselstegnene rundt uttrykket parer seg, og blankingen spiste hele
// ${…}-et med symbolet i. Resultatet var at fem importer sto meldt som ubrukte
// i v4.61 mens de var i høyst levende bruk — INSTRUMENT_COLOR, HEAT_NODATA,
// escapeHtml, pct og PRIO_LABELS. Å «rydde» dem ville brutt fem filer.
//
// Uttrykkene legges derfor tilbake i kroppen etter blankingen. Funksjonen tar
// også med ${…} som måtte stå i en vanlig streng; det er med vilje. Den feilen
// gir «brukt» der svaret er usikkert, og det er den trygge veien for et verktøy
// hvis svar avgjør om noe kan slettes.
function malUttrykk(src) {
  const ut = [];
  for (let i = 0; i < src.length - 1; i++) {
    if (src[i] !== "$" || src[i + 1] !== "{") continue;
    let dybde = 1, j = i + 2;
    while (j < src.length && dybde > 0) {
      if (src[j] === "{") dybde++;
      else if (src[j] === "}") dybde--;
      j++;
    }
    ut.push(src.slice(i + 2, j - 1));
    i = j - 1;
  }
  return ut.join(" ; ");
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
  // Mal-uttrykkene legges tilbake — se malUttrykk for hvorfor.
  const utenImport = s.replace(IMPORT_RE, " ").replace(BARE_RE, " ");
  const kropp = utenStrenger(utenImport) + " ; " + malUttrykk(utenImport);
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

  const utenImport2 = s.replace(IMPORT_RE, " ").replace(BARE_RE, " ");
  const kropp = utenStrenger(utenImport2);
  // Bruk måles mot kroppen MED mal-uttrykkene, men deklarasjonene under leses
  // fra den rene kroppen: «${foo(x)}» ville ellers gjort foo til et lokalt navn
  // og skjult et ekte funn.
  const kroppMedMaler = kropp + " ; " + malUttrykk(utenImport2);
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
    if (new RegExp("(?<![A-Za-z0-9_$.])" + navn + gr).test(kroppMedMaler)) {
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

// genealogy-data-regelen: appen har MED VILJE ingen kopi av pensumet i koden.
const dataImportorer = filer.filter((f) =>
  f !== "genealogy-data.js" && /from\s+["']\.\/genealogy-data\.js/.test(utenKommentarer(kilde[f])));
const regelbrudd = dataImportorer.map((f) =>
  `${f}: importerer js/genealogy-data.js — frøet er KUN for tools/ og tests/`);

// Foreldreløse moduler: verken importert av en js-fil eller lastet fra HTML.
const importerte = new Set();
for (const f of filer) {
  for (const m of utenKommentarer(kilde[f]).matchAll(/from\s+["']\.\/([^"'?]+\.js)/g)) importerte.add(m[1]);
  for (const m of utenKommentarer(kilde[f]).matchAll(/import\s+["']\.\/([^"'?]+\.js)/g)) importerte.add(m[1]);
}
// Importkartet (tools/importkart.js) nevner ALLE modulene. Telles det med, ser
// hver modul ut som om en side laster den, og vakta blir blind.
let htmlKilde = "";
for (const h of fs.readdirSync(ROT).filter((x) => x.endsWith(".html"))) {
  htmlKilde += fs.readFileSync(path.join(ROT, h), "utf8")
    .replace(/<script type="importmap">[\s\S]*?<\/script>/g, " ");
}
const foreldrelose = filer.filter((f) =>
  !importerte.has(f) &&
  !htmlKilde.includes(`js/${f}`) &&
  f !== "genealogy-data.js");           // frøet leses av tools/ og tests/, med vilje

// Importringer: A importerer B, som (via andre) importerer A. ES-moduler tåler
// det så lenge ingen kode på toppnivå bruker noe fra ringen, men da kan én ny
// linje på toppnivå stoppe oppstarten («Cannot access … before
// initialization»), og ingen fil i ringen kan forstås uten de andre. Til og med
// v6.28 hang 13 Utforsk-filer i én ring. Tarjans algoritme finner de sterkt
// sammenhengende komponentene; hver med mer enn én fil er en ring.
const kanter = Object.fromEntries(filer.map((f) => [f, [...new Set(
  [...utenKommentarer(kilde[f]).matchAll(/(?:from|import)\s+["']\.\/([^"'?]+\.js)/g)]
    .map((m) => m[1]).filter((m) => kilde[m]))]]));
const ringer = [];
{
  let teller = 0;
  const stabel = [], paaStabel = new Set(), indeks = {}, lav = {};
  const besok = (v) => {
    indeks[v] = lav[v] = teller++;
    stabel.push(v); paaStabel.add(v);
    for (const w of kanter[v]) {
      if (indeks[w] === undefined) { besok(w); lav[v] = Math.min(lav[v], lav[w]); }
      else if (paaStabel.has(w)) lav[v] = Math.min(lav[v], indeks[w]);
    }
    if (lav[v] !== indeks[v]) return;
    const komp = [];
    let w;
    do { w = stabel.pop(); paaStabel.delete(w); komp.push(w); } while (w !== v);
    if (komp.length > 1) ringer.push(komp.sort());
  };
  for (const f of filer) if (indeks[f] === undefined) besok(f);
}

// Videresending: en modul som eksporterer noe den selv har importert
// (`export { x }` eller `export … from`). Kallerne henter da x via en
// mellommann og drar med seg alt mellommannen importerer. Til og med v6.28
// sendte ui.js videre 26 navn fra seks andre moduler. Importer fra modulen som
// definerer navnet.
const videresending = [];
for (const f of filer) {
  const s = utenKommentarer(kilde[f]);
  const importertHer = new Set();
  for (const m of s.matchAll(IMPORT_RE)) {
    for (const del of m[1].split(",")) {
      const t = del.trim(); if (!t) continue;
      const [orig, alias] = t.split(/\s+as\s+/).map((x) => x.trim());
      importertHer.add(alias || orig);
    }
  }
  for (const m of s.matchAll(/export\s*\{([^}]*)\}\s*(from\s*["'][^"']+["'])?/g)) {
    if (m[2]) { videresending.push(`${f}: ${m[0].replace(/\s+/g, " ")}`); continue; }
    for (const del of m[1].split(",")) {
      const lokal = del.trim().split(/\s+as\s+/)[0].trim();
      if (importertHer.has(lokal)) videresending.push(`${f}: eksporterer «${lokal}», som den selv importerer`);
    }
  }
  for (const m of s.matchAll(/export\s*\*\s*(?:as\s+[A-Za-z0-9_$]+\s*)?from\s*["'][^"']+["']/g)) {
    videresending.push(`${f}: ${m[0]}`);
  }
}

skriv("BRUTTE IMPORTER", brutt);
skriv("UKJENTE MODULER", ukjent);
skriv("UBRUKTE IMPORTER", ubrukt);
skriv("REGELBRUDD (genealogy-data)", regelbrudd);
skriv("FORELDRELØSE MODULER", foreldrelose.map((f) => `js/${f}: verken importert eller lastet fra HTML`));
skriv("IMPORTRINGER", ringer.map((r) => `${r.length} filer: ${r.join(", ")}`));
skriv("VIDERESENDING", videresending);

const feiler = brutt.length || ukjent.length || regelbrudd.length || foreldrelose.length || ringer.length || videresending.length;
if (!feiler && !ubrukt.length) {
  console.log("Importgrafen er ren.");
} else {
  console.log(`\n${filer.length} filer sjekket.`);
}

process.exit(feiler ? 1 : 0);
