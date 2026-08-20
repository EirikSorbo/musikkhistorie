// ============================================================================
//  SLEKTSTRE-PROTOTYPE — bundlede bånd
// ----------------------------------------------------------------------------
//  Samme side, samme data og samme popuper som tre.html; kun rendereren er en
//  annen. Siden er BEVISST ikke lenket fra menyen eller huben — den skal kunne
//  prøves i undervisning ved siden av den som er i drift.
// ============================================================================
import { initTrePage } from "./tre-page.js?v=4.48";
import { renderGenealogyBundled } from "./genealogy-bundled.js?v=4.48";

initTrePage({ render: renderGenealogyBundled });
