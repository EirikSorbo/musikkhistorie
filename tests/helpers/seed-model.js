// ============================================================================
//  TESTHJELPER — fyller sjangermodellen
// ----------------------------------------------------------------------------
//  Fra v4.49 kommer treet fra Firestore, så js/genre-model.js starter TOM. I
//  node finnes verken database eller localStorage, og en test som leser
//  GENEALOGY ville derfor sett et tomt tre.
//
//  Importer denne fila FØR resten (bare for sideeffekten), så bygges modellen
//  fra frøet i js/genealogy-data.js:
//
//      import "../helpers/seed-model.js";
//
//  Modellen bygges via byggGenealogyDoc — SAMME transformasjon som seed-
//  generatoren — så testene kjører v2-formen produksjonen faktisk leser
//  (metaGenres med farge, fam kun som unntak). v1-formen med fam på alle
//  noder skjulte i sin tid at rebuild() leste metaByName for sent (v4.65).
//
//  NB: frøet er treet slik det sto i v4.47. Fra fase 3 redigerer læreren
//  treet live, så live-dokumentet kan ha glidd fra frøet — testene låser
//  FORMLENE mot en kjent form, ikke dagens pensuminnhold.
//
//  NB: importene MÅ ha samme ?v=-suffiks som testene bruker. Node ser
//  «genre-model.js» og «genre-model.js?v=5.08» som TO moduler med hver sin
//  tilstand, og da ville hjelperen fylt en kopi ingen leser. bump.sh holder
//  suffikset i synk (den dekker tests/*/*.js).
// ============================================================================
import { GENEALOGY, FAMILIES, META_ORDER_HINT } from "../../js/genealogy-data.js?v=5.08";
import { rebuild } from "../../js/genre-model.js?v=5.08";
import { byggGenealogyDoc } from "../../tools/build-genealogy-doc.js";

export const SEED_DOC = byggGenealogyDoc({ GENEALOGY, FAMILIES, META_ORDER_HINT });
rebuild(SEED_DOC);

// Epoken (era) og lytteforslagene (t) flyttet UT av treet i v4.64 og bor nå i
// genreDescriptions. Testene som måler sjangertidslinjen trenger dem fortsatt,
// så de bygges her fra frøet: samme verdier, ny adresse. Da måler testene
// fortsatt mot det ekte pensumet, og mot den formen appen faktisk leser.
export const SEED_GENRE_DESCS = Object.fromEntries(
  GENEALOGY.map((n) => [n.l, { main: { era: n.era || "", lytt: n.t || [] } }]),
);
