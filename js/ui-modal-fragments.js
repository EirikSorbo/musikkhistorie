// ============================================================================
//  DELTE MODAL-FRAGMENTER
// ----------------------------------------------------------------------------
//  Markup for modalene som finnes på BÅDE forsiden/lærersiden (injisert via
//  explore.js) og slektstresiden (injisert via tre.js). Én kilde, så sidene
//  ikke driver fra hverandre når markupen endres.
//
//  «Foreslå endring»-føttene (sj-foot/td-foot) er skjult som standard og
//  kobles bare der en onPropose-callback finnes (genealogy.js/ui-tech.js
//  vakter dette) — på slektstresiden forblir de skjult.
// ============================================================================

// Sjanger-beskrivelse (åpnes fra slektstreet og sjanger-tags).
// #sj-extra er lærerens Rediger-ikon (renderGenreEditBtn), samme hode-plassering
// som Om historie/Røtter. Beholderen er tom for studenter og på slektstresiden,
// og .head-actions-reglene er gated på :not(:empty) — da ser hodet ut som før.
export const SJANGER_MODAL_HTML = `
<div class="modal-backdrop" id="modal-sjanger">
  <div class="modal">
    <div class="modal-head">
      <h2 id="sj-title"></h2>
      <div id="sj-extra" class="head-actions"></div>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="sj-body"></div>
    <div class="modal-foot-right" id="sj-foot" style="display:none">
      <button type="button" class="btn ghost small" id="sj-propose">Foreslå endring</button>
    </div>
  </div>
</div>`;

// Artistliste-popup (artister i sjanger/instrument).
export const ARTISTLISTE_MODAL_HTML = `
<div class="modal-backdrop" id="modal-artistliste">
  <div class="modal">
    <div class="modal-head">
      <h2 id="al-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="al-body"></div>
  </div>
</div>`;

// Spilleliste-popup (musikkeksempler/verk for en sjanger).
export const SPILLELISTE_MODAL_HTML = `
<div class="modal-backdrop" id="modal-spilleliste">
  <div class="modal">
    <div class="modal-head">
      <h2 id="pl-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="pl-body"></div>
  </div>
</div>`;

// Teknologi-detalj.
export const TECH_DETAIL_MODAL_HTML = `
<div class="modal-backdrop" id="modal-tech-detail">
  <div class="modal">
    <div class="modal-head">
      <h2 id="td-title"></h2>
      <button class="modal-close btn ghost small">&#x2715;</button>
    </div>
    <div id="td-body"></div>
    <div class="modal-foot-right" id="td-foot" style="display:none">
      <button type="button" class="btn ghost small" id="td-propose">Foreslå endring</button>
    </div>
  </div>
</div>`;
