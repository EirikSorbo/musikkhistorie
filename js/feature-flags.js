// ============================================================================
//  MIDLERTIDIGE BRYTERE — skjuler funksjoner i STUDENTVISNINGEN
// ----------------------------------------------------------------------------
//  Satt opp 2026-08-26, rett før lansering, fordi innholdet bak disse ennå
//  ikke er kvalitetssikret. INGEN kode er fjernet: hver funksjon ligger intakt
//  og slås på igjen ved å sette flagget under til false. Dette er det ENESTE
//  stedet som må endres for å få dem tilbake.
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
//    metasjangerhistorier  «Metasjangere»-knappen i sjangermodalen
//                          (js/explore.js)
//    storeBildet           hele hubkortet på forsiden (js/landing.js).
//                          Varmekart og tidslinje nås fortsatt: tidslinja fra
//                          eget kort på forsiden, varmekartet fra knapperaden
//                          i sjangermodalen.
//    horEtter              «Hør etter»-lista på tre-sjangrene (js/genealogy.js)
// ============================================================================

export const SKJUL_I_STUDENTVISNING = {
  viktighetsgrad:       true,
  koblingsbeskrivelser: true,
  metasjangerhistorier: true,
  storeBildet:          true,
  horEtter:             true,
};
