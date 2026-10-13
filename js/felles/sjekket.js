// ============================================================================
//  BARE SJEKKET INNHOLD FOR STUDENTENE (v6.89, brukervalg 2026-10-13)
// ----------------------------------------------------------------------------
//  Når bryteren «Bare sjekket innhold» (Skrivebordet, «Synlig for studentene»)
//  er på, ser studentene bare det læreren har sjekket. En bryter som slår noe
//  på (for eksempel sjangerhistoriene), viser da bare de sjekkede. Hver type
//  følger sin egen sjekk:
//    artistkort            teacherChecked på artistdokumentet
//    innovasjonskort       teacherChecks.tech
//    sjangerbeskrivelser   teacherChecks.genres (treets sjangre) og .subgenres
//    sjangerhistoriene     teacherChecks.metaGenres
//    koblingstekstene      teacherChecks.edges
//    tiårstekstene         teacherChecks.decades (samfunn) og .decadesTech
//    sidene                teacherChecks.pages: Røtter, Om historie og
//                          instrumenttekstene
//    plateselskapene       teacherChecks.plateselskaper
//  Utenfor regelen med vilje: podkastene og «Fra timene» (læreren publiserer
//  dem selv), skriveveiledningen (hjelp til skjemaet, ikke pensum),
//  bruksveiledningen (v6.95: delene hukes av hver for seg),
//  varmekartet og sjangertreet (tall og struktur), og det som bygges av
//  innholdet over (tidslinja, slektstreet, sjangerperiodene, referansene).
//
//  Lærersiden ser alltid alt (settSjekketLaerer). Lerretet følger studentene,
//  og QA-bryteren i visningen slår regelen av for økta, siden den nuller alle
//  student-flaggene, også dette.
//
//  Filtreringen skjer i datalaget (js/data/shared-data.js med
//  js/data/sjekket-filter.js): det usjekkede tas ut av state før noen visning
//  ser det, så hver visning, søket, lenkene i teksten og utskriften arver
//  regelen. Artistene er unntaket: de blir stående i state (studentens egne
//  forslag skal ikke forsvinne), og isVisible i limits.js spør artistSjekketOk.
//
//  Modulen importerer bare flaggene, så limits.js kan bruke den uten ringer.
// ============================================================================

import { SKJUL_I_STUDENTVISNING } from "./feature-flags.js";

let laerer = false;
// config/teacherChecks. null til dokumentet har landet: da er ingenting
// sjekket ennå, og regelen viser heller for lite enn for mye.
let sjekker = null;

export function sjekketRegelAktiv() {
  return !!SKJUL_I_STUDENTVISNING.usjekket && !laerer;
}

export function sjekkene() { return sjekker || {}; }

export function erSjekket(kategori, id) {
  const liste = sjekker?.[kategori];
  return Array.isArray(liste) && liste.includes(id);
}

// Slipper regelen gjennom denne? Alltid ja når regelen er av.
export function sjekketOk(kategori, id) {
  return !sjekketRegelAktiv() || erSjekket(kategori, id);
}

export function artistSjekketOk(a) {
  return !sjekketRegelAktiv() || a?.teacherChecked === true;
}

// Koblingsteksten (streken i slektstreet, lenka ved sjangernavnet): med
// regelen på er den åpen bare når teksten er sjekket. Datalaget har da
// allerede tatt de usjekkede ut av edgeDescs, så «har tekst» betyr «sjekket».
export function koblingSjekketOk(key, edgeDescs) {
  return !sjekketRegelAktiv() || !!edgeDescs?.[key]?.description;
}

// Alt som har tegnet noe etter hva studentene ser, lytter allerede på
// «pensum:synlighet» (feature-flags.js), så samme hendelse brukes her.
function varsle() {
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("pensum:synlighet"));
}

// Lærersiden (shared-data, laererside) og innlogget lærer i utskriften.
export function settSjekketLaerer(v = true) {
  const ny = !!v;
  if (ny === laerer) return;
  laerer = ny;
  varsle();
}

// Kalles av datalaget ved hvert snapshot av config/teacherChecks.
export function brukSjekker(doc) {
  const ny = doc && typeof doc === "object" ? doc : {};
  const endret = JSON.stringify(ny) !== JSON.stringify(sjekker);
  sjekker = ny;
  if (endret && sjekketRegelAktiv()) varsle();
}
