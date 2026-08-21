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
//  Testene måler dermed fortsatt mot det ekte pensumet, samtidig som appen i
//  drift ikke har noen kopi av det i koden.
//
//  NB: importene MÅ ha samme ?v=-suffiks som testene bruker. Node ser
//  «genre-model.js» og «genre-model.js?v=4.61» som TO moduler med hver sin
//  tilstand, og da ville hjelperen fylt en kopi ingen leser. bump.sh holder
//  suffikset i synk (den dekker tests/*/*.js).
// ============================================================================
import { GENEALOGY, FAMILIES, META_ORDER_HINT } from "../../js/genealogy-data.js?v=4.61";
import { rebuild } from "../../js/genre-model.js?v=4.61";

rebuild({ nodes: GENEALOGY, families: FAMILIES, metaOrderHint: META_ORDER_HINT });
