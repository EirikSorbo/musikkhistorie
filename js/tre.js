// ============================================================================
//  SLEKTSTRE-SIDEN
// ----------------------------------------------------------------------------
//  All oppkobling bor i tre-page.js. Denne fila velger rendereren.
//
//  Fra v4.55 tegnes treet som BUNDLEDE BÅND (js/genealogy-bundled.js): alle
//  foreldrene til en sjanger samles i ett bånd i barnets farge, så en
//  sammensmeltning leser som likestilte foreldre. Den forrige visningen — det
//  pakkede kartet med håndsatte koordinater — er pensjonert; den kunne ikke
//  overleve at treet ble redigerbart, siden hver ny sjanger krevde at naboene
//  ble flyttet for hånd.
// ============================================================================
import { initTrePage } from "./tre-page.js?v=4.68";
import { renderGenealogyBundled } from "./genealogy-bundled.js?v=4.68";

initTrePage({ render: renderGenealogyBundled });
