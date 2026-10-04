#!/usr/bin/env node
// ============================================================================
//  MODULKART — MODULKART.md lages av innledningen øverst i hver fil
// ----------------------------------------------------------------------------
//  Et håndskrevet modulkart går ut på dato: README-lista manglet hele Visning-
//  delen (ti filer) før v6.30. Dette kartet skrives derfor av koden selv. Hver
//  fil i js/ begynner med en innledning, og tittellinjen i den er det kartet
//  viser. Mappenes beskrivelser står i MAPPER under.
//
//  Kjør:  node tools/modulkart.js           skriver MODULKART.md
//         node tools/modulkart.js --sjekk   exit 1 hvis kartet er utdatert,
//                                           en fil mangler innledning eller en
//                                           mappe mangler beskrivelse
//  bump.sh kjører den første; pre-push-kroken og CI den andre.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS = path.join(ROT, "js");
const UT = path.join(ROT, "MODULKART.md");
const sjekk = process.argv.includes("--sjekk");

// Mappene i den rekkefølgen kartet viser dem, med en kort beskrivelse.
// En ny mappe under js/ må få en linje her, ellers feiler --sjekk.
const MAPPER = [
  ["", "Sidene og oppsettet",
    "Én fil per HTML-side (landing, student, teacher, tre med tre-page, utskrift), sperrene hver side laster først (gate, load-guard), appversjonen og Firebase-oppsettet."],
  ["utforsk", "Utforsk",
    "Det store bildet, tiårene, sjangrene, varmekartet, tidslinja, Lytt, Instrumenter, referansene, søket og ?vis=-ruteren. explore.js kobler dem sammen, og explore-context.js er limet de deler."],
  ["sjangre", "Sjangrene og slektstreet",
    "Sjangermodellen (treet bor i Firestore, og alt annet avledes av det), beskrivelsene, sjangerkortet, slektstreet, sjangerhimmelen og migreringen når en sjanger bytter navn."],
  ["visning", "Visning",
    "Presentasjonsvisningen på lerretet, kjøreplanene og Visning-vinduet bak presentasjonsikonet."],
  ["laerer", "Lærersiden",
    "Skrivebordet, artistene, innholdsredigeringen, sjangertre-editoren, gjennomgangen av endringsforslag og import/eksport."],
  ["forslag", "Endringsforslag",
    "Studentenes forslag til endringer på kortene, og hvilke felter som kan foreslås."],
  ["utskrift", "Utskrift",
    "Utvalget til heftet og heftets oppbygning. Selve siden er js/utskrift.js."],
  ["ui", "Byggeklosser for skjermen",
    "Artistkortene og listene, modalene og meldingsboksene, tidslinjene, teknologikortene, oversikten på lærersiden, skjemadelene og YouTube-spilleren."],
  ["data", "Data",
    "Firestore (store.js er den eneste fila som snakker med databasen), den delte dataroten, appens tilstand, artistskjemaet og importformatet."],
  ["felles", "Felles hjelpere",
    "Små hjelpere og vokabular som flere deler av appen bruker: tekst og lenker, kilder, søkeindeksen, tiår og instrumenter, dype lenker og bryterne."],
  ["vendor", "Tredjepart",
    "Kode skrevet av andre, brukt uendret."],
];

const REGLER = [
  "Bare `data/store.js` snakker med Firestore, og alle sidene leser de delte samlingene gjennom `data/shared-data.js`.",
  "Importer en funksjon fra fila som definerer den, ikke via en annen modul. `tools/check-imports.js` stopper videresending.",
  "Ingen filer importerer hverandre i ring. Utforsk-kjernen (`utforsk/explore-context.js`) åpner featurene gjennom `nav`, som `utforsk/explore.js` fyller, i stedet for å importere dem. `tools/check-imports.js` stopper importringer.",
  "Det `sjangre/genre-model.js` avleder av treet, byttes ut når treet lastes (live bindings), og det samme gjelder `opts` i `data/app-state.js` og `nav` i `utforsk/explore-context.js`. Les dem ved kall-tid, aldri i en konstant på modulnivå.",
  "Alt pensuminnhold bor i Firestore. `sjangre/genealogy-data.js` er frøet (treet slik det sto i v4.47) og leses bare av `tools/` og `tests/`; `tools/check-imports.js` stopper en import av det i appen.",
  "Importlinjene står uten `?v=`. Versjonen settes i importkartet i HTML-sidene når `./bump.sh` kjøres.",
  "Hver fil begynner med en innledning. Tittellinjen i den er det som står i dette kartet.",
];

// Tittellinjen: første kommentarlinje med tekst øverst i fila (skillelinjer og
// tomme kommentarlinjer hoppes over). null hvis koden begynner før en kommentar.
function tittel(kilde) {
  for (const linje of kilde.split("\n").slice(0, 10)) {
    if (!linje.trim()) continue;
    const m = linje.match(/^\s*(?:\/\/+|\/\*+|\*)\s?(.*?)\s*(?:\*\/)?\s*$/);
    if (!m) return null;
    const t = m[1].trim();
    if (!t || /^[=\-*/\s]+$/.test(t)) continue;
    return t;
  }
  return null;
}

// Filene per mappe (relativt til js/), hver mappe ett nivå ned.
const perMappe = new Map();
(function gaa(rel) {
  for (const e of fs.readdirSync(path.join(JS, rel), { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const sti = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) gaa(sti);
    else if (e.name.endsWith(".js")) {
      if (!perMappe.has(rel)) perMappe.set(rel, []);
      perMappe.get(rel).push(e.name);
    }
  }
})("");

const feil = [];
const kjente = new Set(MAPPER.map(([m]) => m));
for (const m of perMappe.keys()) if (!kjente.has(m)) feil.push(`js/${m}/ mangler beskrivelse i MAPPER i tools/modulkart.js`);

const celle = (t) => t.replace(/\|/g, "\\|");
const ut = [];
let antall = 0;
const seksjoner = [];
for (const [mappe, navn, om] of MAPPER) {
  const filer = (perMappe.get(mappe) || []).sort((a, b) => a.localeCompare(b, "en"));
  if (!filer.length) continue;
  antall += filer.length;
  const sti = mappe ? `js/${mappe}/` : "js/";
  const rader = filer.map((f) => {
    const t = tittel(fs.readFileSync(path.join(JS, mappe, f), "utf8"));
    if (!t) feil.push(`${sti}${f} mangler innledning (en kommentar øverst med en tittellinje)`);
    return `| \`${f}\` | ${celle(t || "(mangler innledning)")} |`;
  });
  seksjoner.push({ sti, navn, om, antall: filer.length, rader });
}

ut.push("# Modulkart", "");
ut.push("Alle filene i `js/`, mappe for mappe. Teksten i hver rad er tittellinjen øverst i fila.");
ut.push("Kartet lages av `tools/modulkart.js` og skal ikke redigeres for hånd: endre innledningen");
ut.push("i fila og kjør `./bump.sh` (eller `node tools/modulkart.js`). Pre-push-kroken og GitHub");
ut.push("stopper et kart som ikke stemmer med filene.", "");
ut.push(`${antall} filer i ${seksjoner.length} mapper.`, "");
ut.push("| Mappe | Innhold | Filer |", "|---|---|---|");
for (const s of seksjoner) ut.push(`| \`${s.sti}\` | ${s.navn} | ${s.antall} |`);
ut.push("", "## Reglene koden holder seg til", "");
for (const r of REGLER) ut.push(`- ${r}`);
for (const s of seksjoner) {
  ut.push("", `## \`${s.sti}\` ${s.navn}`, "", s.om, "", "| Fil | Hva den gjør |", "|---|---|", ...s.rader);
}
ut.push("");
const tekst = ut.join("\n");

if (sjekk) {
  const naa = fs.existsSync(UT) ? fs.readFileSync(UT, "utf8") : "";
  if (naa !== tekst) feil.push("MODULKART.md stemmer ikke med filene. Kjør node tools/modulkart.js (eller ./bump.sh).");
} else if (!feil.length) {
  fs.writeFileSync(UT, tekst);
}

if (feil.length) {
  console.error(`modulkart:\n  ${feil.join("\n  ")}`);
  process.exit(1);
}
console.log(sjekk ? `modulkart: MODULKART.md er à jour (${antall} filer)` : `modulkart: skrev MODULKART.md (${antall} filer)`);
