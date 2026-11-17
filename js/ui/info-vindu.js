// ============================================================================
//  OM APPEN — informasjonsikonet i toppmenyen (v7.33, vindu fra v7.34)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-11-17: KI-erklæringen får et informasjonsikon i
//  toppmenyen, og «Slik bruker du appen» og Referanser flyttes dit fra «Det
//  store bildet». I v7.33 åpnet ikonet en nedtrekksmeny. Fra v7.34 åpner det
//  et vindu i samme stil som Innstillinger: ett kort per valg, med ikon,
//  tittel, en linje om innholdet og Åpne. Ikonet står rett før Innstillinger,
//  så Innstillinger er ytterst til høyre.
//
//  Synligheten følger de samme bryterne som kortene hadde i huben (sb-guide og
//  sb-referanser i SKJUL_I_HUBEN), så valgene som er lagret i
//  content/synlighet, gjelder uendret. KI-erklæringen er for alle, men står
//  ikke for studentene før teksten er lagt inn. Læreren ser alltid alle.
//
//  Lærerhåndboken (v7.42, brukerbestilling 2026-11-17) er flyttet hit fra
//  Innstillinger på lærersiden. Den står bare for læreren (`laerer: true`),
//  også på forsiden når læreren er logget inn.
//
//  Åpne er en lenke til forsiden med ?vis= (samme mål som søket og
//  kjøreplanene). På sidene med utforsk-laget (forsiden, lærersiden og
//  slektstresiden) gir initExplore en åpner: kortet åpnes oppå vinduet, og ←
//  fører tilbake hit, som i huben. Forslagsskjemaet og utskriftssiden har
//  ikke kortene, og der følges lenka.
//
//  synligeInfoValg er ren og testes i Node. Resten rører DOM-en og kjører
//  først når initInfoVindu kalles.
// ============================================================================

import { escapeHtml } from "../felles/util.js";
import { SKJUL_I_HUBEN } from "../felles/feature-flags.js";
import { parseVisVerdi } from "../felles/vis-lenke.js";
import { getState } from "../data/app-state.js";
import { modalOpen, modalClose, setupModal, initModalHeaders } from "./ui-modal.js";

export const INFO_VALG = [
  {
    id: "guide", tekst: "Slik bruker du appen", desc: "Kort om funksjonene og tanken bak.",
    vis: "side:appGuide", hub: "sb-guide", farge: "--icon-guide",
    ikon: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',
  },
  {
    id: "laererhandbok", tekst: "Lærerhåndbok", desc: "Hva du kan gjøre som lærer, og hvor du finner det.",
    vis: "side:laererHandbok", laerer: true, farge: "--icon-l-handbok",
    ikon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/><path d="M9 7h7"/>',
  },
  {
    id: "referanser", tekst: "Referanser", desc: "Kildene appen bygger på.",
    vis: "referanser", hub: "sb-referanser", farge: "--icon-referanser",
    ikon: '<path d="M5 4a2 2 0 012-2h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2z"/><path d="M14 2v5h5"/><path d="M9 12h6M9 16h6"/>',
  },
  {
    id: "ki", tekst: "KI-erklæring", desc: "Hvordan KI er brukt i arbeidet med historieappen.",
    vis: "side:kiErklaering", side: "kiErklaering", farge: "--icon-ki",
    ikon: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 10h4v4h-4z"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  },
];

// Valgene som vises. `content` er innholdet når det er lest, ellers null:
// da vet vi ikke om KI-erklæringen finnes, og den står med (siden sier selv
// fra om teksten mangler).
export function synligeInfoValg({ laerer = false, skjulHub = {}, content = null } = {}) {
  return INFO_VALG.filter((v) => {
    if (laerer) return true;
    if (v.laerer) return false;
    if (v.hub && skjulHub[v.hub]) return false;
    if (v.side && content && !String(content[v.side]?.body || "").trim()) return false;
    return true;
  });
}

// Ett kort i vinduet, i samme form som radene i Innstillinger.
export function infoKortHtml(v) {
  return `<section class="innst-gruppe" data-info-kort="${escapeHtml(v.id)}">
    <div class="innst-kort"><div class="innst-rad">
      <span class="innst-ikon" style="--farge:var(${v.farge})" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v.ikon}</svg></span>
      <span class="innst-tekst"><span class="innst-tittel">${escapeHtml(v.tekst)}</span><span class="innst-desc">${escapeHtml(v.desc)}</span></span>
      <a class="btn ghost small" href="index.html?vis=${encodeURIComponent(v.vis)}" data-info-vis="${escapeHtml(v.vis)}" aria-label="Åpne ${escapeHtml(v.tekst)}">Åpne</a>
    </div></div>
  </section>`;
}

const MODAL_ID = "modal-info";

// Læreren: lærersiden (is-teacher) eller innlogget lærer på de andre sidene.
export const erLaerer = () => {
  const b = document.body.classList;
  return b.contains("is-teacher") || b.contains("laerer-okt");
};

let apneValg = null;   // åpneren fra initExplore, eller null (lenka følges)

function byggModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="modal-backdrop" id="${MODAL_ID}">
  <div class="modal modal-narrow modal-innstillinger" role="dialog" aria-labelledby="info-tittel">
    <div class="modal-head">
      <h2 id="info-tittel">Om appen</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div class="innst" id="info-kort"></div>
  </div>
</div>`;
  const m = wrap.firstElementChild;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  return m;
}

function tegnKort() {
  const el = document.getElementById("info-kort");
  if (!el) return;
  const s = getState();
  const valg = synligeInfoValg({
    laerer: erLaerer(),
    skjulHub: SKJUL_I_HUBEN,
    content: s.contentLoaded ? s.content || {} : null,
  });
  const html = valg.map(infoKortHtml).join("");
  if (el.innerHTML === html) return;
  // Tegnes kortene på nytt mens vinduet står åpent, blir fokuset på samme knapp.
  const fokus = el.contains(document.activeElement) ? document.activeElement.dataset.infoVis : null;
  el.innerHTML = html;
  if (fokus) el.querySelector(`[data-info-vis="${CSS.escape(fokus)}"]`)?.focus({ preventScroll: true });
}

export function apneInfoVindu() {
  const m = document.getElementById(MODAL_ID) || byggModal();
  tegnKort();
  modalOpen(m);
}

// Bryterne og innholdet kan lande mens vinduet står åpent (rett etter at
// siden er lastet): da tegnes kortene på nytt. Kalles ved «pensum:synlighet»
// og fra utforsk-lagets innholds-snapshot (explore.js).
export function oppdaterInfoVindu() {
  if (document.getElementById(MODAL_ID)?.classList.contains("open")) tegnKort();
}

// Kalles av initExplore (med åpneren) og av forslagsskjemaet og utskriften
// (uten). `escape`: forslagsskjemaet har ingen egen Escape-kobling for
// vinduene, så den legges på her. Trygg å kalle flere ganger.
export function initInfoVindu({ apne: apner = null, escape = false } = {}) {
  if (apner) apneValg = apner;
  if (document.body.dataset.infoVindu) return;
  document.body.dataset.infoVindu = "1";

  document.addEventListener("click", (e) => {
    if (e.target.closest?.("[data-info]")) {
      e.preventDefault();
      apneInfoVindu();
      return;
    }
    const valg = e.target.closest?.(`#${MODAL_ID} [data-info-vis]`);
    if (!valg || !apneValg) return;
    // Ctrl/Cmd/Shift-klikk åpner lenka i en ny fane, som andre lenker.
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    const maal = parseVisVerdi(valg.dataset.infoVis);
    if (!maal) return;
    e.preventDefault();
    apneValg(maal);
  });

  document.addEventListener("pensum:synlighet", oppdaterInfoVindu);

  if (escape) {
    document.addEventListener("keydown", (e) => {
      const m = document.getElementById(MODAL_ID);
      if (e.key === "Escape" && m?.classList.contains("open")) modalClose(m);
    });
  }
}
