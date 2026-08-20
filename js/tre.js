// ============================================================================
//  SLEKTSTRE-SIDEN — det pakkede kartet (i drift)
// ----------------------------------------------------------------------------
//  All oppkobling bor i tre-page.js, delt med tre-prototype.html. Denne fila
//  velger bare hvilken renderer siden skal bruke.
// ============================================================================
import { initTrePage } from "./tre-page.js?v=4.47";
import { renderGenealogy } from "./genealogy.js?v=4.47";

initTrePage({ render: renderGenealogy });
