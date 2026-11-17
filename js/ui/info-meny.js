// ============================================================================
//  INFO-MENYEN — «i» ytterst til høyre i toppmenyen (v7.33)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-11-17: KI-erklæringen får et informasjonsikon øverst
//  til høyre, og «Slik bruker du appen» og Referanser flyttes dit fra «Det
//  store bildet». Ikonet åpner en liten meny med de tre (samme boks som
//  menyene i Visning, .vis-meny).
//
//  Synligheten følger de samme bryterne som kortene hadde (sb-guide og
//  sb-referanser i SKJUL_I_HUBEN), så valgene som er lagret i
//  content/synlighet, gjelder uendret. KI-erklæringen er for alle, men står
//  ikke i menyen for studentene før teksten er lagt inn. Læreren ser alltid
//  alle tre.
//
//  Valgene er lenker til forsiden med ?vis= (samme mål som søket og
//  kjøreplanene). På sidene med utforsk-laget (forsiden, lærersiden og
//  slektstresiden) gir initExplore en åpner, og valget åpnes der man står.
//  Forslagsskjemaet og utskriftssiden har ikke kortene, og der følges lenka.
//
//  synligeInfoValg er ren og testes i Node. Resten rører DOM-en og kjører
//  først når initInfoMeny kalles.
// ============================================================================

import { escapeHtml } from "../felles/util.js";
import { SKJUL_I_HUBEN } from "../felles/feature-flags.js";
import { parseVisVerdi } from "../felles/vis-lenke.js";
import { getState } from "../data/app-state.js";

export const INFO_VALG = [
  { id: "guide", tekst: "Slik bruker du appen", vis: "side:appGuide", hub: "sb-guide" },
  { id: "referanser", tekst: "Referanser", vis: "referanser", hub: "sb-referanser" },
  { id: "ki", tekst: "KI-erklæring", vis: "side:kiErklaering", side: "kiErklaering" },
];

// Valgene som vises. `content` er innholdet når det er lest, ellers null:
// da vet vi ikke om KI-erklæringen finnes, og den står med (siden sier selv
// fra om teksten mangler).
export function synligeInfoValg({ laerer = false, skjulHub = {}, content = null } = {}) {
  return INFO_VALG.filter((v) => {
    if (laerer) return true;
    if (v.hub && skjulHub[v.hub]) return false;
    if (v.side && content && !String(content[v.side]?.body || "").trim()) return false;
    return true;
  });
}

const erLaerer = () => {
  const b = document.body.classList;
  return b.contains("is-teacher") || b.contains("laerer-okt");
};

let apneValg = null;   // åpneren fra initExplore, eller null (lenka følges)
let apen = null;       // { wrap, knapp, meny } mens menyen står åpen

function lukk({ fokus = false } = {}) {
  if (!apen) return;
  const { knapp, meny } = apen;
  meny.remove();
  knapp.setAttribute("aria-expanded", "false");
  apen = null;
  if (fokus) knapp.focus({ preventScroll: true });
}

function valgHtml() {
  const s = getState();
  const valg = synligeInfoValg({
    laerer: erLaerer(),
    skjulHub: SKJUL_I_HUBEN,
    content: s.contentLoaded ? s.content || {} : null,
  });
  return valg.map((v) =>
    `<a role="menuitem" class="vis-meny-valg" href="index.html?vis=${encodeURIComponent(v.vis)}" data-info-vis="${escapeHtml(v.vis)}">${escapeHtml(v.tekst)}</a>`).join("");
}

function apne(knapp) {
  const wrap = knapp.closest(".nav-info-wrap") || knapp.parentElement;
  const meny = document.createElement("div");
  meny.className = "vis-meny nav-info-meny";
  meny.setAttribute("role", "menu");
  meny.setAttribute("aria-label", "Om appen");
  meny.innerHTML = valgHtml();
  wrap.appendChild(meny);
  knapp.setAttribute("aria-expanded", "true");
  apen = { wrap, knapp, meny };
  meny.querySelector(".vis-meny-valg")?.focus({ preventScroll: true });
}

// Bryterne og innholdet kan lande mens menyen står åpen (rett etter at siden
// er lastet). Da tegnes valgene på nytt, og sto fokuset i menyen, blir det på
// det samme valget (eller det første). Kalles ved «pensum:synlighet» og fra
// utforsk-lagets innholds-snapshot (explore.js).
export function oppdaterInfoMeny() {
  if (!apen) return;
  const html = valgHtml();
  if (html === apen.meny.innerHTML) return;
  const iMenyen = apen.meny.contains(document.activeElement);
  const fokusVis = iMenyen ? document.activeElement.dataset.infoVis : null;
  apen.meny.innerHTML = html;
  if (!iMenyen) return;
  const ny = [...apen.meny.querySelectorAll("[data-info-vis]")];
  (ny.find((a) => a.dataset.infoVis === fokusVis) || ny[0] || apen.knapp).focus({ preventScroll: true });
}

// Kalles av initExplore (med åpneren) og av forslagsskjemaet og utskriften
// (uten). Trygg å kalle flere ganger: lytterne kobles én gang.
export function initInfoMeny({ apne: apner = null } = {}) {
  if (apner) apneValg = apner;
  if (document.body.dataset.infoMeny) return;
  document.body.dataset.infoMeny = "1";

  document.addEventListener("click", (e) => {
    const knapp = e.target.closest?.("[data-info]");
    if (knapp) {
      e.preventDefault();
      const varApen = apen?.knapp === knapp;
      lukk();
      if (!varApen) apne(knapp);
      return;
    }
    const valg = e.target.closest?.("[data-info-vis]");
    if (valg && apen) {
      // Ctrl/Cmd/Shift-klikk åpner lenka i en ny fane, som andre lenker.
      if (e.metaKey || e.ctrlKey || e.shiftKey) { lukk(); return; }
      const maal = parseVisVerdi(valg.dataset.infoVis);
      lukk();
      if (apneValg && maal) { e.preventDefault(); apneValg(maal); }
      return;
    }
    // Klikk utenfor lukker menyen.
    if (apen && !apen.wrap.contains(e.target)) lukk();
  });

  document.addEventListener("pensum:synlighet", oppdaterInfoMeny);

  // Tastaturet: piltastene, Home og End flytter mellom valgene, Escape lukker
  // og gir fokuset tilbake til ikonet, og Tab ut av menyen lukker den.
  document.addEventListener("keydown", (e) => {
    if (!apen || !apen.wrap.contains(document.activeElement)) return;
    const alle = [...apen.meny.querySelectorAll(".vis-meny-valg")];
    const i = alle.indexOf(document.activeElement);
    const til = (j) => { e.preventDefault(); alle[(j + alle.length) % alle.length]?.focus(); };
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); lukk({ fokus: true }); }
    else if (e.key === "ArrowDown") til(i + 1);
    else if (e.key === "ArrowUp") til(i < 0 ? alle.length - 1 : i - 1);
    else if (e.key === "Home") til(0);
    else if (e.key === "End") til(alle.length - 1);
    else if (e.key === "Tab") lukk();
  }, true);
}
