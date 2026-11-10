// ============================================================================
//  «VELG SENTRALE» PÅ SJANGERKORTET (v7.28, brukerønske 2026-11-10)
// ----------------------------------------------------------------------------
//  Læreren ser alle lytteeksemplene med sjangeren i raden og krysser av dem
//  som er sentrale for sjangeren. Merket lagres på lytteeksempelet hos
//  artisten (`sjangersentral`, se js/sjangre/sjanger-sentrale.js), det samme
//  som avkrysningen «Sentral for sjangeren» i Rediger. Alle artistene som
//  endres, skrives i én batch, så valget enten lagres helt eller ikke.
//
//  Lukkes vinduet med endringer som ikke er lagret, spør det først.
// ============================================================================
import { modalOpen, modalClose, bekreft } from "../ui/ui-modal.js";
import { escapeHtml } from "../felles/util.js";
import { musicExampleLabel } from "../ui/ui-helpers.js";
import { sjangerEksempler, eksempelNokkel, erSjangerSentral, sentraleEndringer } from "../sjangre/sjanger-sentrale.js";
import { runMigrationPlan } from "../data/store.js";
import { state, guardTeacherAction } from "./teacher-state.js";

export function apneVelgSentrale(label, navn = label) {
  const par = sjangerEksempler(state.artists, label);
  const vist = new Set(par.map(({ a, m }) => eksempelNokkel(a.id, m)));
  const start = new Set(par.filter(({ m }) => erSjangerSentral(m)).map(({ a, m }) => eksempelNokkel(a.id, m)));

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal modal-valg sentrale-velger" role="dialog" aria-labelledby="sentrale-velger-tittel">
    <div class="modal-head"><h2 id="sentrale-velger-tittel">Sentrale lytteeksempler for ${escapeHtml(navn)}</h2></div>
    ${par.length
      ? `<p class="muted">Lytteeksemplene som har ${escapeHtml(navn)} som sjanger, etter årstall. Kryss av dem som er sentrale for sjangeren.</p>
    <ul class="sentrale-velger-liste">${par.map(({ a, m }) => {
      const nokkel = eksempelNokkel(a.id, m);
      return `<li><label><input type="checkbox" data-sentral-nokkel="${escapeHtml(nokkel)}"${start.has(nokkel) ? " checked" : ""} /> <span><strong>${escapeHtml(m.label || "Lytt")}</strong>${escapeHtml(musicExampleLabel(m))} · ${escapeHtml(a.name)}</span></label></li>`;
    }).join("")}</ul>`
      : `<p class="muted">Ingen lytteeksempler har ${escapeHtml(navn)} som sjanger ennå. Sjangeren velges for hvert lytteeksempel i Rediger på artisten.</p>`}
    <p class="sentrale-velger-msg muted" aria-live="polite"></p>
    <div class="modal-foot-right melding-knapper">
      <button type="button" class="btn small ghost" data-sentrale="avbryt">${par.length ? "Avbryt" : "Lukk"}</button>
      ${par.length ? `<button type="button" class="btn small primary" data-sentrale="lagre">Lagre</button>` : ""}
    </div>
  </div>`;

  const valgt = () => new Set([...backdrop.querySelectorAll("[data-sentral-nokkel]:checked")].map((i) => i.dataset.sentralNokkel));
  const endret = () => {
    const v = valgt();
    return v.size !== start.size || [...v].some((k) => !start.has(k));
  };
  let ferdig = false;
  const lukk = () => {
    if (ferdig) return;
    ferdig = true;
    backdrop._beforeClose = null;
    backdrop._skipBeforeClose = true;
    modalClose(backdrop);
    backdrop.remove();
  };
  const sporOgLukk = async () => {
    if (!endret() || await bekreft("Valgene du har gjort, blir ikke lagret.", { tittel: "Lukke uten å lagre?", ja: "Lukk", farlig: true })) lukk();
  };
  const lagre = async () => {
    const knapp = backdrop.querySelector('[data-sentrale="lagre"]');
    // Fra artistene slik de er nå, ikke da vinduet ble åpnet: en lagring
    // ellers i mellomtiden skal ikke overskrives.
    const ops = Object.entries(sentraleEndringer(state.artists, label, valgt(), vist))
      .map(([id, musicExamples]) => ({ type: "doc.merge", coll: "artists", id, data: { musicExamples } }));
    if (!ops.length) { lukk(); return; }
    knapp.disabled = true;
    backdrop.querySelector(".sentrale-velger-msg").textContent = "Lagrer …";
    // runMigrationPlan er appens atomiske batch (navnet er fra sjangertreet).
    const ok = await guardTeacherAction(runMigrationPlan(ops).then(() => true));
    if (ok) { lukk(); return; }
    knapp.disabled = false;
    backdrop.querySelector(".sentrale-velger-msg").textContent = "";
  };

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) { sporOgLukk(); return; }
    const hva = e.target.closest("[data-sentrale]")?.dataset.sentrale;
    if (hva === "avbryt") sporOgLukk();
    else if (hva === "lagre") lagre();
  });
  // Escape går via modalCloseTop → modalClose, altså gjennom kroken.
  backdrop._beforeClose = () => { sporOgLukk(); return false; };

  document.body.append(backdrop);
  modalOpen(backdrop);
  (backdrop.querySelector("[data-sentral-nokkel]") || backdrop.querySelector('[data-sentrale="avbryt"]'))?.focus();
}
