// ============================================================================
//  RETT KILDEN — blyanten på radene i Referanser (v7.35)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-11-17: læreren retter og sletter en kilde direkte fra
//  Referanser, og endringen gjelder alle kortene kilden står på (og de
//  frittstående referansene). Logikken er ren og bor i
//  js/felles/kilde-retting.js; her er vinduet og lagringen.
//
//  Vinduet bygges første gang det trengs, på alle sidene med Referanser.
//  Blyanten vises bare for læreren på lærersiden (body.is-teacher, fra
//  v7.37), og reglene i Firestore lar uansett bare læreren skrive. Alle skrivingene går i én atomisk batch (runMigrationPlan).
// ============================================================================
import { escapeHtml } from "../felles/util.js";
import { SOURCE_SPEC, collectRows, normalizeSources, feltHtml } from "../ui/row-editor.js";
import { modalOpen, modalClose, setupModal, initModalHeaders, bekreft } from "../ui/ui-modal.js";
import { kildeSteder, kildeEndringer, forsteKilde, stedNavn, nyReferanseEndring } from "../felles/kilde-retting.js";
import { runMigrationPlan } from "../data/store.js";
import { getState } from "../data/app-state.js";

// Bare på lærersiden (v7.37): der er alle kortene lastet, også de usjekkede.
// På forsiden ser også læreren studentenes utgave, og en retting derfra ville
// ikke nådd kildene på kortene som er tatt ut.
export const kanRetteKilder = () => {
  if (typeof document === "undefined") return false;
  return document.body.classList.contains("is-teacher");
};

const MODAL_ID = "modal-kilde-retting";
let aktiv = null;   // { rad, etterLagring, start } eller { ny: true, etterLagring } mens vinduet står åpent
let lagrer = false;

function byggModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="modal-backdrop" id="${MODAL_ID}">
  <div class="modal modal-narrow kilde-retting" role="dialog" aria-labelledby="kr-tittel">
    <div class="modal-head">
      <h2 id="kr-tittel">Rett kilden</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="kr-bruk" id="kr-bruk"></p>
    <div id="kr-skjema"></div>
    <p id="kr-msg" class="form-msg" role="status"></p>
    <div class="kr-knapper">
      <button type="button" class="btn danger small" data-kr-slett>Slett fra alle</button>
      <span class="kr-mellom"></span>
      <button type="button" class="btn ghost" data-kr-avbryt>Avbryt</button>
      <button type="button" class="btn primary" data-kr-lagre>Lagre overalt</button>
    </div>
  </div>
</div>`;
  const m = wrap.firstElementChild;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  m.addEventListener("click", (e) => {
    if (e.target.closest("[data-kr-avbryt]")) modalClose(m);
    else if (e.target.closest("[data-kr-lagre]")) lagre();
    else if (e.target.closest("[data-kr-slett]")) slett();
  });
  m.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches?.("input")) { e.preventDefault(); lagre(); }
  });
  return m;
}

function msg(tekst, ok = true) {
  const el = document.getElementById("kr-msg");
  if (!el) return;
  el.textContent = tekst;
  el.className = "form-msg " + (tekst ? (ok ? "ok" : "err") : "");
}

// Feltene med synlige etiketter, i én .source-row så collectRows leser dem.
function skjemaHtml(k) {
  const verdier = normalizeSources([k || {}])[0] || {};
  return `<div class="${SOURCE_SPEC.rowClass} kr-felter">${SOURCE_SPEC.fields.map((f) =>
    `<label class="kr-felt kr-${f.key}"><span>${escapeHtml(f.label)}</span>${feltHtml(f, verdier)}</label>`).join("")}</div>`;
}

// «Brukt på 3 steder: Muddy Waters, Blues (sjangerkortet), 1950-tallet.»
export function brukTekst(rad) {
  const steder = kildeSteder(rad);
  const navn = steder.map(stedNavn);
  const vis = navn.slice(0, 8).join(", ") + (navn.length > 8 ? ` og ${navn.length - 8} til` : "");
  return `Brukt på ${steder.length === 1 ? "ett sted" : `${steder.length} steder`}: ${vis}.${steder.length > 1 ? " Endringen gjelder alle." : ""}`;
}

const lest = () => collectRows(document.getElementById("kr-skjema"), SOURCE_SPEC)[0] || null;

function sett(laaser) {
  lagrer = laaser;
  document.querySelectorAll(`#${MODAL_ID} .kr-knapper .btn`).forEach((b) => { b.disabled = laaser; });
}

async function skriv(ny) {
  const { rad, etterLagring } = aktiv;
  const ops = kildeEndringer(getState(), rad, ny);
  if (!ops.length) { modalClose(document.getElementById(MODAL_ID)); return; }
  sett(true);
  msg(ny ? "Lagrer …" : "Sletter …");
  try {
    await runMigrationPlan(ops);
    aktiv = null;
    modalClose(document.getElementById(MODAL_ID));
    etterLagring?.();
  } catch (e) {
    msg(`${ny ? "Ble ikke lagret" : "Ble ikke slettet"} (${e?.message || e}). Er du logget inn som lærer?`, false);
  } finally {
    sett(false);
  }
}

async function lagre() {
  if (!aktiv || lagrer) return;
  if (aktiv.ny) { await leggTil(); return; }
  const ny = lest();
  if (!ny) { msg("Kildeteksten kan ikke være tom.", false); return; }
  if (JSON.stringify(ny) === aktiv.start) { modalClose(document.getElementById(MODAL_ID)); return; }
  await skriv(ny);
}

async function slett() {
  if (!aktiv || lagrer) return;
  const n = kildeSteder(aktiv.rad).length;
  const ja = await bekreft(`Kilden fjernes fra ${n === 1 ? "det ene stedet" : `alle de ${n} stedene`} den står. Det kan ikke angres.`,
    { tittel: "Slette kilden?", ja: "Slett", farlig: true });
  if (ja) await skriv(null);
}

// Samme vindu i to utgaver: retting av en rad, eller en ny referanse (v7.38).
function settModus(m, ny) {
  m.querySelector("#kr-tittel").textContent = ny ? "Ny referanse" : "Rett kilden";
  m.querySelector("[data-kr-lagre]").textContent = ny ? "Legg til" : "Lagre overalt";
  m.querySelector("[data-kr-slett]").style.display = ny ? "none" : "";
}

// Legger den nye referansen til blant de frittstående (content/referanser).
async function leggTil() {
  const ny = lest();
  if (!ny) { msg("Skriv kildeteksten eller lenka.", false); return; }
  if (!ny.kategori) { msg("Velg kategori før du legger til.", false); return; }
  const s = getState();
  // Lista sendes hel (merge erstatter den), så innholdet må være lest først.
  if (!s.contentLoaded) { msg("Innholdet laster fortsatt. Vent et øyeblikk og prøv igjen.", false); return; }
  const { ops, feil } = nyReferanseEndring(s, ny);
  if (feil === "finnes") { msg("Denne kilden står allerede blant de frittstående referansene.", false); return; }
  if (!ops) { msg("Skriv kildeteksten eller lenka.", false); return; }
  sett(true);
  msg("Lagrer …");
  try {
    await runMigrationPlan(ops);
    const { etterLagring } = aktiv;
    aktiv = null;
    modalClose(document.getElementById(MODAL_ID));
    etterLagring?.();
  } catch (e) {
    msg(`Ble ikke lagret (${e?.message || e}). Er du logget inn som lærer?`, false);
  } finally {
    sett(false);
  }
}

// Åpner vinduet tomt for en ny referanse. Den hører ikke til noe kort og
// står alltid i Referanser.
export function apneNyReferanse({ etterLagring } = {}) {
  const m = document.getElementById(MODAL_ID) || byggModal();
  settModus(m, true);
  document.getElementById("kr-bruk").textContent = "Referansen legges i Referanser uten å høre til et bestemt kort, og den står der alltid.";
  document.getElementById("kr-skjema").innerHTML = skjemaHtml({});
  SOURCE_SPEC.kobleRad(document.querySelector("#kr-skjema .kr-felter"));
  msg("");
  aktiv = { ny: true, etterLagring };
  modalOpen(m);
  m.querySelector(".source-text")?.focus();
}

// Åpner vinduet for én rad i Referanser. `etterLagring` tegner lista på nytt.
export function apneKildeRetting(rad, { etterLagring } = {}) {
  const m = document.getElementById(MODAL_ID) || byggModal();
  settModus(m, false);
  const k = forsteKilde(getState(), rad);
  document.getElementById("kr-bruk").textContent = brukTekst(rad);
  document.getElementById("kr-skjema").innerHTML = skjemaHtml(k);
  SOURCE_SPEC.kobleRad(document.querySelector("#kr-skjema .kr-felter"));
  msg("");
  aktiv = { rad, etterLagring, start: "" };
  aktiv.start = JSON.stringify(lest());
  modalOpen(m);
  m.querySelector(".source-text")?.focus();
}
