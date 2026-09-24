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
//                          STÅR PÅ IGJEN fra 2026-09-10: studentene skal inn i
//                          huben, men bare til de tre visualiseringene. Hvilke
//                          kort de ser inne i den, styres av SKJUL_I_HUBEN.
//    horEtter              «Hør etter»-lista på tre-sjangrene (js/genealogy.js)
// ============================================================================

// Oppsummeringspunktene (v5.50, js/punkter.js) vises bare i presentasjonen,
// på nivå 2, til innholdet er gjennomgått (brukervalg 2026-09-24). Gjelder
// ALLE utenfor presentasjonen, også lærersiden: læreren ser punktene i
// presentasjonen og i editorene. Sett til false for å vise dem på kortene i
// vanlig visning også. Virker via klassen «skjul-punkter» på <html>
// (css/styles.css), så ingen renderer trenger å vite om det.
export const PUNKTER_BARE_I_PRESENTASJON = true;
if (typeof document !== "undefined") {
  document.documentElement.classList.toggle("skjul-punkter", PUNKTER_BARE_I_PRESENTASJON);
}

export const SKJUL_I_STUDENTVISNING = {
  viktighetsgrad:       true,
  koblingsbeskrivelser: true,
  metasjangerhistorier: true,
  storeBildet:          false,
  horEtter:             true,
};

// Kortene INNE i «Det store bildet» (js/explore.js). Huben ble åpnet for
// studentene 2026-09-10, men brukeren ville bare slippe til de tre
// visualiseringene: tidslinje, slektstre og varmekart. Sjangerperioder kom til som
// fjerde synlige kort i v5.20 (brukervalg). Resten står skjult til
// innholdet er kvalitetssikret, og slippes inn ett og ett ved å sette flagget
// til false. Læreren ser alltid alle ni.
//
// Nøkkelen er kortets id i markupen (js/explore-modals.js), så et navnebytte
// der ikke kan gjøre et flagg til en stille no-op. En enhetstest sjekker at
// nøklene og kortene stemmer overens.
//
// NB: skjulingen må henge sammen med de ANDRE inngangene til det samme.
// Sjangerhistoriene nås også fra «Metasjangere» i sjangermodalen, som allerede
// er skjult av metasjangerhistorier-flagget over, og Røtter/Om historie/
// bruksveiledningen holdes ute av søket (js/search.js) med de samme flaggene.
export const SKJUL_I_HUBEN = {
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
