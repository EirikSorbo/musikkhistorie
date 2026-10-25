// ============================================================================
//  GÅTT GJENNOM — oversikten for en gruppe av planer (v7.15)
// ----------------------------------------------------------------------------
//  Åpnes fra gruppen i Visning-vinduet. Viser alt appen kan åpne (søke-
//  indeksen, over det synlige innholdet) som gått gjennom eller ikke i
//  gruppens planer, med filter på status, type og viktighetsgrad, og hvilke
//  timer som viste hva. Beregningen og valgene bak den: gjennomgang-modell.js.
//  Et klikk åpner kortet oppå vinduet. Filtrene huskes i nettleseren.
// ============================================================================

import { getState } from "../data/app-state.js";
import { escapeHtml } from "../felles/util.js";
import { byggIndeks, TYPE_FLERTALL } from "../felles/search.js";
import { isVisible } from "../felles/limits.js";
import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "../felles/feature-flags.js";
import { modalOpen, setupModal, initModalHeaders } from "../ui/ui-modal.js";
import { PRIO_ICONS, PRIO_LABELS, sentralMerke } from "../ui/ui-helpers.js";
import { aktivtNivaa, NIVAA_TEKST } from "../ui/viktighet.js";
import { apneMaal } from "../utforsk/explore-apne.js";
import { normaliserPlaner } from "./presentasjon-modell.js";
import { beregnGjennomgang, filtrerGjennomgang, planTelling } from "./gjennomgang-modell.js";
import { slider } from "./slides-liste.js";

const MODAL_ID = "modal-gjennomgang";
const FILTER_NOKKEL = "pensum-gj-filter";
const NAVN = { ...TYPE_FLERTALL, samfunn: "Tiår: samfunn", teknologi: "Tiår: teknologi" };
const STATUSER = [["gjennomgatt", "Gått gjennom"], ["ikke", "Ikke gått gjennom"], ["alle", "Alle"]];
const SJEKK_SVG = '<svg class="gj-sjekk" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

let gruppe = "";
let res = { planer: [], typer: [] };
let viste = [];   // postene i lista, for klikkene (data-gj-i)
let filter = null;

function lesFilter() {
  let f = {};
  try { f = JSON.parse(localStorage.getItem(FILTER_NOKKEL) || "{}") || {}; } catch (e) { f = {}; }
  return {
    status: STATUSER.some(([s]) => s === f.status) ? f.status : "gjennomgatt",
    type: typeof f.type === "string" ? f.type : "alt",
    nivaa: [0, 1, 2, 3].includes(f.nivaa) ? f.nivaa : aktivtNivaa(),
    bareSentrale: f.bareSentrale === true,
  };
}
function lagreFilter() {
  try { localStorage.setItem(FILTER_NOKKEL, JSON.stringify(filter)); } catch (e) { /* huskes ikke */ }
}

// Det synlige innholdet, som studentene ser det i appen (uten forslag som
// venter og skjulte kort), men med alt læreren kan vise: historiene,
// koblingene og slidene.
function beregn() {
  const s = getState();
  const artister = (s.artists || []).filter(isVisible);
  const tilstand = {
    ...s, artists: artister, slides: slider(),
    techItems: (s.techItems || []).filter((t) => (t.status || "active") === "active"),
  };
  const indeks = byggIndeks(tilstand, { erLærer: true, skjul: SKJUL_I_STUDENTVISNING, skjulHub: SKJUL_I_HUBEN });
  return beregnGjennomgang({ planer: normaliserPlaner(s.content?.presentasjoner?.planer), gruppe, indeks, artister });
}

const kortDato = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });

// Planene som viste noe: kort («3. okt., 10. okt. +2») og langt (tittelen).
function hvor(ids) {
  const planer = ids.map((id) => res.planer.find((p) => p.id === id)).filter(Boolean);
  const merke = (p) => (p.dato ? kortDato(p.dato) : p.tittel);
  const kort = planer.slice(0, 2).map(merke).join(", ") + (planer.length > 2 ? ` +${planer.length - 2}` : "");
  const lang = planer.map((p) => (p.dato ? `${kortDato(p.dato)}: ${p.tittel}` : p.tittel)).join("\n");
  return { kort, lang };
}

function postHtml(p) {
  const i = viste.push(p) - 1;
  const gjennom = p.status !== "ikke";
  const h = gjennom ? hvor(p.status === "vist" ? p.vistI : p.lyttetI) : null;
  const prio = p.prio > 0
    ? `<span class="gj-prio prio-${p.prio}" title="${escapeHtml(PRIO_LABELS[p.prio])}" aria-label="${escapeHtml(PRIO_LABELS[p.prio])}">${PRIO_ICONS[p.prio]}</span>` : "";
  return `<li class="gj-post gj-${p.status}">
    ${gjennom ? SJEKK_SVG : '<span class="gj-sjekk"></span>'}
    <button type="button" class="gj-apne" data-gj-i="${i}">${p.sentral ? sentralMerke({ sentral: true }) : ""}${escapeHtml(p.tittel)}</button>
    ${prio}
    ${p.sti ? `<span class="muted gj-sti">${escapeHtml(p.sti)}</span>` : ""}
    ${p.status === "lyttet" ? '<span class="gj-merke" title="Et lytteeksempel er spilt, men kortet er ikke vist">bare lyttet</span>' : ""}
    ${h?.kort ? `<span class="muted gj-hvor" title="${escapeHtml(h.lang)}">${escapeHtml(h.kort)}</span>` : ""}
  </li>`;
}

function tegn() {
  const m = document.getElementById(MODAL_ID);
  if (!m) return;
  const f0 = filtrerGjennomgang(res, filter);
  // En type som ikke finnes lenger (eller ikke har noe på dette nivået), gir «Alt».
  if (filter.type !== "alt" && !f0.typer.some((t) => t.type === filter.type && t.totalt)) filter.type = "alt";
  const f = filtrerGjennomgang(res, filter);

  m.querySelector("#gj-tittel").textContent = `Gått gjennom i «${gruppe}»`;
  const planTekst = res.planer.length ? planTelling(res.planer.map((p) => [p.id, p])) : "Ingen planer";
  const pst = f.totalt ? Math.round((100 * f.gjennomgatt) / f.totalt) : 0;
  m.querySelector("#gj-sammendrag").textContent = `${planTekst} i gruppen. ${f.gjennomgatt} av ${f.totalt} er gått gjennom (${pst}\u00a0%).`;

  m.querySelectorAll("[data-gj-status]").forEach((b) => {
    const paa = b.dataset.gjStatus === filter.status;
    b.classList.toggle("active", paa);
    b.setAttribute("aria-pressed", String(paa));
  });
  m.querySelector("#gj-nivaa").value = String(filter.nivaa);
  m.querySelector("#gj-sentrale").checked = filter.bareSentrale;
  m.querySelector("#gj-merknad").hidden = !filter.nivaa;

  const faner = [{ type: "alt", navn: "Alt", g: f.gjennomgatt, t: f.totalt },
    ...f.typer.filter((t) => t.totalt).map((t) => ({ type: t.type, navn: NAVN[t.type] || t.type, g: t.gjennomgatt, t: t.totalt }))];
  m.querySelector("#gj-typer").innerHTML = faner.map((x) => `
    <button type="button" class="dv-fane${x.type === filter.type ? " active" : ""}"${x.type === filter.type ? ' aria-current="true"' : ""} data-gj-type="${escapeHtml(x.type)}">${escapeHtml(x.navn)} <span class="gj-tall">${x.g}/${x.t}</span></button>`).join("");

  viste = [];
  const tom = filter.status === "ikke" ? "Alt her er gått gjennom." : filter.status === "gjennomgatt" ? "Ingenting her er gått gjennom ennå." : "Ingenting her.";
  const seksjoner = f.valgt.filter((t) => t.totalt && (t.poster.length || filter.type !== "alt")).map((t) => `
    <section class="gj-seksjon">
      <h3 class="gj-hode">${escapeHtml(NAVN[t.type] || t.type)} <span class="muted">${t.gjennomgatt} av ${t.totalt} gått gjennom</span></h3>
      ${t.poster.length ? `<ul class="gj-poster">${t.poster.map(postHtml).join("")}</ul>` : `<p class="muted">${tom}</p>`}
    </section>`).join("");
  m.querySelector("#gj-liste").innerHTML = seksjoner || `<p class="muted">${res.planer.length ? tom : "Gruppen har ingen planer."}</p>`;
}

function byggModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="modal-backdrop" id="${MODAL_ID}">
  <div class="modal modal-wide modal-innhold">
    <div class="modal-head">
      <h2 id="gj-tittel">Gått gjennom</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted gj-sammendrag" id="gj-sammendrag"></p>
    <div class="gj-filtre">
      <div class="gj-status" role="group" aria-label="Hva som vises">
        ${STATUSER.map(([s, navn]) => `<button type="button" class="btn ghost small" data-gj-status="${s}" aria-pressed="false">${navn}</button>`).join("")}
      </div>
      <label class="gj-felt">Viktighetsgrad
        <select id="gj-nivaa">
          <option value="0">Alle artister</option>
          ${[3, 2, 1].map((n) => `<option value="${n}">${NIVAA_TEKST[n]}</option>`).join("")}
        </select>
      </label>
      <label class="gj-felt"><input type="checkbox" id="gj-sentrale" /> Bare sentrale lytteeksempler</label>
    </div>
    <p class="muted gj-merknad" id="gj-merknad" hidden>Viktighetsgraden gjelder artistene og lytteeksemplene deres. Resten har ingen grad og vises uansett.</p>
    <div class="sj-fanerad gj-typer" id="gj-typer" role="group" aria-label="Type"></div>
    <div id="gj-liste"></div>
  </div>
</div>`;
  const m = wrap.firstElementChild;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  m.addEventListener("click", (e) => {
    const status = e.target.closest("[data-gj-status]");
    if (status) { filter.status = status.dataset.gjStatus; lagreFilter(); tegn(); return; }
    const type = e.target.closest("[data-gj-type]");
    if (type) { filter.type = type.dataset.gjType; lagreFilter(); tegn(); return; }
    const post = e.target.closest("[data-gj-i]");
    if (post) { const p = viste[Number(post.dataset.gjI)]; if (p) apneMaal(p.apne); }
  });
  m.addEventListener("change", (e) => {
    if (e.target.id === "gj-nivaa") filter.nivaa = Number(e.target.value) || 0;
    else if (e.target.id === "gj-sentrale") filter.bareSentrale = e.target.checked;
    else return;
    lagreFilter();
    tegn();
  });
  return m;
}

export function apneGjennomgang(navn) {
  gruppe = navn;
  filter = lesFilter();
  const m = document.getElementById(MODAL_ID) || byggModal();
  res = beregn();
  tegn();
  modalOpen(m);
}

// Fra Visning-vinduets tikk: innholdet eller planene endret seg mens
// oversikten står åpen.
export function gjennomgangTikk() {
  const m = document.getElementById(MODAL_ID);
  if (!m?.classList.contains("open")) return;
  res = beregn();
  tegn();
}
