// ============================================================================
//  MIDLERTIDIGE BRYTERE — skjuler funksjoner i STUDENTVISNINGEN
// ----------------------------------------------------------------------------
//  Satt opp 2026-08-26, rett før lansering, fordi innholdet bak disse ennå
//  ikke er kvalitetssikret. INGEN kode er fjernet: hver funksjon ligger intakt.
//  Fra v6.10 slås de av og på i appen («Synlig for studentene» på
//  Skrivebordet, dokumentet content/synlighet); verdiene her er standarden for
//  nøklene dokumentet ikke har. Panelet lagrer bare nøklene det har en bryter
//  for (v6.23), så for de andre gjelder verdiene her fortsatt.
//
//  LÆRERSIDEN ER ALDRI PÅVIRKET. Læreren skal nettopp kunne se og sjekke
//  innholdet mens studentene ikke ser det, så hvert bruksted spør både om
//  flagget og om vi er i lærerkontekst.
//
//  Hvert flagg, og hvor det virker:
//    viktighetsgrad        artistkortenes prioritetsmerke + filterknappene
//                          på forsiden (js/ui.js, js/landing.js)
//    koblingsbeskrivelser  strekene i slektstreet blir ikke klikkbare
//                          (js/genealogy-bundled.js, js/genealogy.js)
//    metasjangerhistorier  «Sjangerhistorier»-knappen ved Sjangre-fanene
//                          og hubkortet (js/explore.js)
//    storeBildet           hele hubkortet på forsiden (js/landing.js).
//                          STÅR PÅ IGJEN fra 2026-09-10: studentene skal inn i
//                          huben, men bare til de tre visualiseringene. Hvilke
//                          kort de ser inne i den, styres av SKJUL_I_HUBEN.
//    horEtter              «Hør etter»-lista på tre-sjangrene (js/genealogy.js)
//    utskrift              hele utskriftsfunksjonen for STUDENTROLLEN
//                          (body.role-student): skriverikonet i toppmenyen,
//                          «Ta med»-knappen i kortene, «Til utskrift» i Finn
//                          artister og Visning-vinduet, og selve utskrift.html
//                          (css/styles.css via html.skjul-utskrift, og
//                          js/utskrift.js). Lærerrollen ser alt. Brukervalg
//                          2026-09-25: skjult inntil videre, rett etter at
//                          funksjonen kom i v5.56.
//    merking               «Merk ★»-knappen (stemming) nederst på artistkortene
//                          (js/ui.js). Brukervalg 2026-09-27 (v5.72): stemming
//                          er ikke i bruk nå, og uten knappen får
//                          utskriftsknappen plass på samme linje som «Vis i
//                          tidslinje» / «Foreslå endring». Læreren ser den.
// ============================================================================

// Oppsummeringspunktene (v5.50, js/punkter.js) vises bare i presentasjonen,
// på nivå 2, til innholdet er gjennomgått (brukervalg 2026-09-24). Gjelder
// ALLE utenfor presentasjonen, også lærersiden: læreren ser punktene i
// presentasjonen og i editorene. Sett til false for å vise dem på kortene i
// vanlig visning også. Virker via klassen «skjul-punkter» på <html>
// (css/styles.css), så ingen renderer trenger å vite om det.
export const PUNKTER_BARE_I_PRESENTASJON = true;

export const SKJUL_I_STUDENTVISNING = {
  viktighetsgrad:       true,
  koblingsbeskrivelser: true,
  metasjangerhistorier: true,
  storeBildet:          false,
  horEtter:             true,
  utskrift:             true,
  merking:              true,
  // «Fra timene» (v6.10, U1): timene læreren deler, på forsiden og i Lytt.
  // Skjult til læreren slår det på (brukervalg 2026-10-03).
  fraTimene:            true,
};

// Kortene INNE i «Det store bildet» (js/explore.js). Huben ble åpnet for
// studentene 2026-09-10, men brukeren ville bare slippe til de tre
// visualiseringene: tidslinje, slektstre og varmekart. Sjangerperioder kom til som
// fjerde synlige kort i v5.20 (brukervalg). Resten står skjult til
// innholdet er kvalitetssikret, og slippes inn ett og ett ved å sette flagget
// til false. Læreren ser alltid alle.
//
// Nøkkelen er kortets id i markupen (js/explore-modals.js), så et navnebytte
// der ikke kan gjøre et flagg til en stille no-op. En enhetstest sjekker at
// nøklene og kortene stemmer overens.
//
// NB: skjulingen må henge sammen med de ANDRE inngangene til det samme.
// Sjangerhistoriene nås også fra «Metasjangre» i sjangermodalen, som allerede
// er skjult av metasjangerhistorier-flagget over, og Røtter/Om historie/
// bruksveiledningen holdes ute av søket (js/search.js) med de samme flaggene.
export const SKJUL_I_HUBEN = {
  // Spesialsidene for visningsmodus (v5.96): aldri for studentene. Kortet
  // finnes bare på lerretet, der lærerøkta viser det (presentasjon.js).
  "sb-visning":     true,
  "sb-om-historie": true,
  "sb-rotter":      true,
  "sb-historier":   true,
  "sb-tidslinje":   false,
  "sb-slektstre":   false,
  "sb-varmekart":   false,
  "sb-sjangerperioder": false,
  "sb-himmel":      true,
  "sb-referanser":  true,
  "sb-guide":       true,
};

// ============================================================================
//  BRYTERNE I DATABASEN (v6.10, strukturgjennomgangen U4)
// ----------------------------------------------------------------------------
//  Verdiene over er STANDARDEN. Læreren slår av og på fra Skrivebordet
//  («Synlig for studentene»), som skriver content/synlighet:
//    { student: { <flagg>: bool }, hub: { <kort-id>: bool }, punkter: bool }
//  true betyr skjult, som over. Ukjente nøkler ignoreres; mangler dokumentet,
//  gjelder standarden. Siste kjente verdier speiles i localStorage, så siden
//  ikke viser og så skjuler noe mens innholdet lastes.
//
//  Objektene over MUTERES (alle bruksstedene leser dem ved tegning), og
//  hendelsen «pensum:synlighet» sendes, så de som bygde noe ved oppstart
//  (hubkortene, prioritetsfilteret) kan følge med uten sidelast.
//  Presentasjonens QA-bryter overstyrer for økta (settSynlighetOverstyrt).
// ============================================================================
const STANDARD = {
  student: { ...SKJUL_I_STUDENTVISNING },
  hub: { ...SKJUL_I_HUBEN },
  punkter: PUNKTER_BARE_I_PRESENTASJON,
};
const SPEIL = "pensum-synlighet";

// Fletter et dokument inn i standarden. Ren funksjon (testet i
// feature-flags.test.js).
export function synlighetVerdier(doc) {
  const ut = { student: { ...STANDARD.student }, hub: { ...STANDARD.hub }, punkter: STANDARD.punkter };
  if (!doc || typeof doc !== "object") return ut;
  for (const k of Object.keys(ut.student)) if (typeof doc.student?.[k] === "boolean") ut.student[k] = doc.student[k];
  for (const k of Object.keys(ut.hub)) if (typeof doc.hub?.[k] === "boolean") ut.hub[k] = doc.hub[k];
  if (typeof doc.punkter === "boolean") ut.punkter = doc.punkter;
  return ut;
}

let grunn = synlighetVerdier(null);
let overstyrt = false;

function brukKlasser() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("skjul-punkter", grunn.punkter);
  document.documentElement.classList.toggle("skjul-utskrift", SKJUL_I_STUDENTVISNING.utskrift);
}

function brukPaaObjektene() {
  if (!overstyrt) {
    Object.assign(SKJUL_I_STUDENTVISNING, grunn.student);
    Object.assign(SKJUL_I_HUBEN, grunn.hub);
  }
  brukKlasser();
}

// Verdiene slik læreren har satt dem (eller standarden), uten QA-overstyring.
export function synlighetGrunn() { return grunn; }

// Kalles av datalaget (shared-data.js) ved hvert innholds-snapshot.
export function brukSynlighet(doc) {
  const ny = synlighetVerdier(doc);
  const endret = JSON.stringify(ny) !== JSON.stringify(grunn);
  grunn = ny;
  // Speilet skrives bare når noe er endret (ikke ved hvert content-snapshot).
  if (endret) {
    try { localStorage.setItem(SPEIL, JSON.stringify(ny)); } catch (e) { /* privat modus */ }
  }
  brukPaaObjektene();
  if (endret && typeof document !== "undefined") document.dispatchEvent(new CustomEvent("pensum:synlighet"));
}

// Presentasjonens QA-bryter: på = alt synlig for økta; av = lærerens verdier.
export function settSynlighetOverstyrt(paa) {
  overstyrt = !!paa;
  if (overstyrt) {
    for (const k of Object.keys(SKJUL_I_STUDENTVISNING)) SKJUL_I_STUDENTVISNING[k] = false;
    for (const k of Object.keys(SKJUL_I_HUBEN)) SKJUL_I_HUBEN[k] = false;
  }
  brukPaaObjektene();
}

// Ved oppstart: siste kjente verdier fra speilet, så standarden aldri blinker
// fram når læreren har slått noe på.
if (typeof document !== "undefined") {
  let speil = null;
  try { speil = JSON.parse(localStorage.getItem(SPEIL) || "null"); } catch (e) { speil = null; }
  grunn = synlighetVerdier(speil);
  brukPaaObjektene();
}
