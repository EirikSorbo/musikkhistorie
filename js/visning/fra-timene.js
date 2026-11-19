// ============================================================================
//  FRA TIMENE FOR STUDENTENE (v7.49, brukerbestilling 2026-11-19)
// ----------------------------------------------------------------------------
//  Visning-ikonet øverst til høyre er studentenes inngang til gjennomgangen
//  (v7.48), på samme sted som lærerens Visning. Ikonet åpner et kort med
//  timene læreren har delt, og en time åpnes som visning uten lærerens
//  verktøy (gjennomgangLenke). Avslutt i visningen fører tilbake hit. I v7.48
//  lå «Gå gjennom timen» i timevinduet under «Fra timene» på forsiden.
//
//  Kortet åpnes av apneVisning (visning.js) for studentrollen. Ikonet vises
//  for studentene bare når bryteren «Fra timene» er på (html.skjul-fra-timene,
//  feature-flags.js), og kortet viser timene på samme vilkår som forsiden.
// ============================================================================

import { modalOpen, setupModal, initModalHeaders } from "../ui/ui-modal.js";
import { fraTimeneSynlig, delteTimerNaa, fraTimeneRaderHtml, antallKort } from "../utforsk/explore-timer.js";
import { gjennomgangLenke } from "./presentasjon-modell.js";
import { getState } from "../data/app-state.js";

const MODAL_ID = "modal-fra-timene";

// Studentrollen: valgt i rollevalget på forsiden (pensum-role). Læreren som
// er logget inn, får sitt eget Visning-vindu uansett rolle.
export function erStudentRolle() {
  if (typeof document !== "undefined" && document.body.classList.contains("role-student")) return true;
  try { return localStorage.getItem("pensum-role") === "student"; } catch (e) { return false; }
}

function byggModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="modal-backdrop" id="${MODAL_ID}">
  <div class="modal modal-fra-timene" role="dialog" aria-labelledby="ft-tittel">
    <div class="modal-head">
      <h2 id="ft-tittel">Fra timene</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="ft-ingress">Gå gjennom en time i samme rekkefølge som læreren viste den.</p>
    <div class="fra-timene-liste" id="ft-liste"></div>
  </div>
</div>`;
  const m = wrap.firstElementChild;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  return m;
}

function tegn() {
  const el = document.getElementById("ft-liste");
  if (!el) return;
  // Slidene er lærerens: en time med bare slides har ingenting å gå gjennom.
  const timer = fraTimeneSynlig() ? delteTimerNaa().filter((t) => antallKort(t) > 0) : [];
  const html = timer.length
    ? fraTimeneRaderHtml(timer, { lenke: (t) => gjennomgangLenke(t.id) })
    : `<p class="muted ft-tom">${getState().contentLoaded ? "Ingen timer er delt ennå." : "Henter timene …"}</p>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}

export function apneFraTimene() {
  const m = document.getElementById(MODAL_ID) || byggModal();
  tegn();
  modalOpen(m);
}

// Timene og bryteren kan lande mens kortet står åpent (rett etter at siden
// er lastet, eller når læreren deler en time): da tegnes lista på nytt.
export function fraTimeneTikk() {
  if (document.getElementById(MODAL_ID)?.classList.contains("open")) tegn();
}
