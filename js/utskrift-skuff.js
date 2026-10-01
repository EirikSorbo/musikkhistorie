// ============================================================================
//  SKUFFEN — utskriftsutvalget under skriverikonet (v5.76)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-09-27: det som ligger i utskriften, skal kunne ses
//  uten å forlate siden. Et klikk på skriverikonet i toppmenyen åpner en
//  liten liste over det som er valgt, med «ta ut» på hver rad, dra for
//  rekkefølgen (den brukes når heftet er «som valgt»), «Åpne utskriften» og
//  «Tøm». Tidligere førte ikonet rett til utskriftssiden; Ctrl/Cmd-klikk gjør
//  det fortsatt, og på selve utskriftssiden er ikonet uendret.
//
//  Utvalget bor i localStorage (js/utskrift-utvalg.js); lista her er en
//  visning av det, og tegnes på nytt ved hver endring (UTSKRIFT_HENDELSE).
//  Navnene slås opp med de samme etikettene som kjøreplanene bruker
//  (js/stopp-etikett.js), pluss heftets egne typer (metasjanger, side, tiår
//  uten modus). «N følger med» er det utvalget drar med seg (sjangre,
//  artister, tiår), regnet av modellen.
//
//  Lastes av forsiden, slektstresiden og lærersiden (de har utforsk-laget
//  som etikettene trenger). Skjemasiden har ikonet som vanlig lenke.
// ============================================================================

import { lesUtvalg, lagreUtvalg, fjern, toem, UTSKRIFT_HENDELSE } from "./utskrift-utvalg.js?v=5.98";
import { utvidUtvalg, parseUtskriftVis, SIDER_I_HEFTET, TYPE_ETIKETT } from "./utskrift-modell.js?v=5.98";
import { stoppEtikett } from "./stopp-etikett.js?v=5.98";
import { getState } from "./explore-context.js?v=5.98";
import { isVisible } from "./limits.js?v=5.98";
import { escapeHtml } from "./util.js?v=5.98";
import { askChoice } from "./ui-modal.js?v=5.98";

const ID = "utskrift-skuff";
const GREP_SVG = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/></svg>';

// Navn og type for en post i utvalget.
function etikett(vis) {
  const m = parseUtskriftVis(vis);
  if (!m) return { type: "", navn: String(vis) };
  if (m.hva === "metasjanger") return { type: "Metasjanger", navn: m.id };
  if (m.hva === "side") return { type: "Side", navn: SIDER_I_HEFTET[m.id] || m.id };
  if (m.hva === "tiår") return { type: "Tiår", navn: `${m.id}-tallet` };
  const e = stoppEtikett({ vis });
  return { type: TYPE_ETIKETT[m.hva] || m.hva, navn: e.navn, feil: e.feil, laster: e.laster };
}

const skuffEl = () => document.getElementById(ID);

function bygg() {
  const el = document.createElement("div");
  el.id = ID;
  el.className = "skuff";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Utskriften");
  document.body.appendChild(el);
  koble(el);
  return el;
}

function tegn() {
  const el = skuffEl();
  if (!el || el.hidden) return;
  const u = lesUtvalg();
  const s = getState();
  let folger = 0;
  if (u.valg.length) {
    try {
      const artister = (s.artists || []).filter(isVisible);
      const kilde = utvidUtvalg(u.valg, u.fravalg, artister, new Date().getFullYear(), s.genreDescs || {}).kilde;
      folger = Math.max(0, kilde.size - u.valg.length);
    } catch (e) {
      folger = 0;
    }
  }
  const rader = u.valg.map((vis) => {
    const e = etikett(vis);
    return `<li class="skuff-rad" draggable="true" data-vis="${escapeHtml(vis)}">
      <span class="skuff-grep" title="Dra for å flytte">${GREP_SVG}</span>
      <span class="skuff-type">${escapeHtml(e.type)}</span>
      <span class="skuff-navn${e.feil ? " muted" : ""}">${escapeHtml(e.navn)}${e.feil ? ` <span class="pres-adm-feil">(${escapeHtml(e.feil)})</span>` : ""}</span>
      <button type="button" class="skuff-fjern" data-skuff-fjern="${escapeHtml(vis)}" title="Ta ut av utskriften" aria-label="Ta ${escapeHtml(e.navn)} ut av utskriften">✕</button>
    </li>`;
  }).join("");
  el.innerHTML = `
    <div class="skuff-hode">
      <strong>Utskriften</strong>
      <span class="muted">${u.valg.length ? `${u.valg.length} valgt${folger ? ` · ${folger} følger med` : ""}` : "tom"}</span>
      <button type="button" class="btn ghost small skuff-lukk" aria-label="Lukk">✕</button>
    </div>
    ${u.valg.length
      ? `<ul class="skuff-liste">${rader}</ul>
    <p class="muted skuff-hint">Dra radene for rekkefølgen «som valgt». Det som følger med (sjangre, artister, tiår), styrer du på utskriftssiden.</p>`
      : `<p class="muted skuff-tom">Ingenting valgt ennå. Trykk skriverikonet på et kort for å legge det her.</p>`}
    <div class="skuff-fot">
      <a class="btn primary small" href="utskrift.html">Åpne utskriften</a>
      ${u.valg.length ? `<button type="button" class="btn ghost small danger" data-skuff-toem="1">Tøm</button>` : ""}
    </div>`;
}

function flytt(fraVis, tilVis) {
  if (!fraVis || !tilVis || fraVis === tilVis) return;
  const u = lesUtvalg();
  const fra = u.valg.indexOf(fraVis), til = u.valg.indexOf(tilVis);
  if (fra < 0 || til < 0) return;
  const [v] = u.valg.splice(fra, 1);
  u.valg.splice(til, 0, v);
  lagreUtvalg(u);
}

function koble(el) {
  el.addEventListener("click", async (e) => {
    if (e.target.closest(".skuff-lukk")) { lukk(); return; }
    const ut = e.target.closest("[data-skuff-fjern]");
    if (ut) { fjern(ut.dataset.skuffFjern); return; }
    if (e.target.closest("[data-skuff-toem]")) {
      const n = lesUtvalg().valg.length;
      const ok = await askChoice({
        title: "Tømme utskriften?",
        text: `${n} ${n === 1 ? "kort tas" : "kort tas"} ut av utskriften. Tittelen og valgene nullstilles også.`,
        buttons: [{ label: "Tøm", value: true, className: "primary" }, { label: "Avbryt", value: false }],
        dismissValue: false,
      });
      if (ok) toem();
    }
  });

  // Dra og slipp, samme mønster som kjøreplan-editoren (js/visning.js).
  let drar = null;
  el.addEventListener("dragstart", (e) => {
    const rad = e.target.closest?.(".skuff-rad");
    if (!rad) return;
    drar = rad.dataset.vis;
    rad.classList.add("pres-adm-drar");
    try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drar); } catch (x) {}
  });
  el.addEventListener("dragover", (e) => {
    const rad = e.target.closest?.(".skuff-rad");
    if (!rad || drar === null) return;
    e.preventDefault();
    el.querySelectorAll(".pres-adm-over").forEach((r) => { if (r !== rad) r.classList.remove("pres-adm-over"); });
    rad.classList.add("pres-adm-over");
  });
  el.addEventListener("dragleave", (e) => {
    e.target.closest?.(".skuff-rad")?.classList.remove("pres-adm-over");
  });
  el.addEventListener("drop", (e) => {
    const rad = e.target.closest?.(".skuff-rad");
    if (!rad || drar === null) return;
    e.preventDefault();
    const fra = drar;
    drar = null;
    flytt(fra, rad.dataset.vis);
  });
  el.addEventListener("dragend", () => {
    drar = null;
    el.querySelectorAll(".pres-adm-drar, .pres-adm-over").forEach((r) => r.classList.remove("pres-adm-drar", "pres-adm-over"));
  });
}

function apne(anker) {
  const el = skuffEl() || bygg();
  const r = anker?.getBoundingClientRect?.();
  if (r) {
    el.style.top = `${Math.round(r.bottom + 8)}px`;
    el.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  }
  el.hidden = false;
  tegn();
}

function lukk() {
  const el = skuffEl();
  if (el) el.hidden = true;
}

export function initUtskriftSkuff() {
  if (document.body.dataset.utskriftSkuff) return;
  document.body.dataset.utskriftSkuff = "1";
  document.querySelectorAll("a.nav-utskrift:not(.active)").forEach((a) => {
    a.addEventListener("click", (e) => {
      // Ctrl/Cmd/Shift-klikk åpner utskriftssiden som før (ny fane).
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const el = skuffEl();
      if (el && !el.hidden) lukk(); else apne(a);
    });
  });
  // Klikk utenfor lukker; Escape lukker skuffen, ikke kortet bak (capture,
  // samme grep som kjøreplan-menyen).
  document.addEventListener("click", (e) => {
    const el = skuffEl();
    if (!el || el.hidden) return;
    if (el.contains(e.target) || e.target.closest?.("a.nav-utskrift")) return;
    lukk();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const el = skuffEl();
    if (el && !el.hidden) { e.stopPropagation(); lukk(); }
  }, true);
  document.addEventListener(UTSKRIFT_HENDELSE, tegn);
}
