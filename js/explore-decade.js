// ============================================================================
//  TIÅR: Teknologi / Samfunn / Musikk
// ----------------------------------------------------------------------------
//  Ett vindu for et tiår (v6.07, brukervalg 2026-10-03, strukturgjennomgangen
//  S1): tidslinje-stripa øverst er tiårsvelgeren, og tre faner under den i
//  rekkefølgen Teknologi, Samfunn, Musikk. Før var Teknologi og Samfunn to kort
//  på forsiden som åpnet hver sin halvdel av samme visning, og musikken fra
//  tiåret var ikke koblet til i det hele tatt (K1).
//
//  To regler: tiåret står når fanen byttes, og fanen står når tiåret byttes
//  (så man kan lese teknologien gjennom tiårene med forrige/neste).
//
//  Hver fane har teksten (eller sjangrene) til venstre og det som hører til i
//  en smal høyrespalte (D2): innovasjonskortene fra tiåret, kildene, eller
//  artistene og lytteeksemplene. data-sekt-merkene (markupen i
//  explore-modals.js) styrer detaljnivået i presentasjonsvisningen.
// ============================================================================
import { modalOpen, renderDecadeRibbon, buildKilderList, buildTechTimeline, formatInfoText, escapeHtml,
  openArtistListModal, tiarEksempler, spillAlleHtml } from "./ui.js?v=6.20";
import { ytMaal } from "./presentasjon-modell.js?v=6.20";
import { wireLinks, wireRelated } from "./ui-helpers.js?v=6.20";
import { DECADES, isVisible, filterArtists, byInfluenceThenName } from "./limits.js?v=6.20";
import { GENEALOGY, META_GENRE_ORDER, MAIN_GENRE_INFO, nodeColor } from "./genre-model.js?v=6.20";
import { heatRow, getHeatData } from "./heat-strip.js?v=6.20";
import { openTechDetail } from "./explore-tech.js?v=6.20";
import { openVarmekart } from "./explore-varmekart.js?v=6.20";
import { opts, getState, buildLinkCtx } from "./explore-context.js?v=6.20";

// Fanene i brukerens rekkefølge. Nøklene tech/society er de gamle modusene, så
// lenker og kjøreplanstopp som «tiår:1950:tech» virker som før.
const FANER = ["tech", "society", "musikk"];
const erFane = (m) => FANER.includes(m);

// Valgt fane og sist viste tiår huskes innen økten, så «lukk og åpne igjen»
// fortsetter der man slapp. Første gang: den første fanen og 1960-tallet
// (v6.20, brukervalg 2026-10-03; før det første tiåret, 1900).
let contextMode = FANER[0];
let currentDecade = null;
const STANDARD_TIAR = DECADES.includes(1960) ? 1960 : DECADES[0];

// Fra Tiår-kortet: der man slapp (eller den gitte fanen).
export function openDecadeList(mode) {
  if (erFane(mode)) contextMode = mode;
  openDecadeView(currentDecade ?? STANDARD_TIAR);
}

// Åpner ET bestemt tiår. Uten modus betyr en gammel lenke samfunnsfanen
// (lenkeformen «tiår:1950» fantes før fanene).
export function openDecade(decadeId, mode = "society") {
  if (erFane(mode)) contextMode = mode;
  openDecadeView(Number(decadeId));
}

function openDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  kobleFaner(modal);
  renderDecadeView(decadeId);
  modalOpen(modal);
}

// Faneknappene står i den faste markupen, så de kobles én gang.
function kobleFaner(modal) {
  if (modal.dataset.fanerKoblet) return;
  modal.dataset.fanerKoblet = "1";
  modal.querySelectorAll("[data-dv-fane]").forEach((b) =>
    b.addEventListener("click", () => {
      contextMode = b.dataset.dvFane;
      renderDecadeView(currentDecade ?? STANDARD_TIAR);
    }));
}

function renderDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  const d = Number(decadeId);
  currentDecade = d;
  // «Kopier lenke» (v5.22): fanen hører med, ellers åpner lenka tiåret i feil
  // fane. Settes HER, ikke bare ved åpning: stripa, fanene og forrige/neste
  // bytter uten å åpne kortet på nytt (audit v5.42 funn 16). Bare ved endring,
  // så en omtegning ikke ser ut som et valg.
  const vis = `tiår:${d}:${contextMode}`;
  if (modal.dataset.vis !== vis) modal.dataset.vis = vis;
  const s = getState();
  const desc = s.decadeDescs[String(d)] || {};
  const lc = buildLinkCtx();
  document.getElementById("dv-decade").textContent = `${d}-tallet`;

  // Tidslinje-stripa: alle tiår som klikkbare punkter på én akse, aktivt
  // tiår uthevet. Re-render (ikke modalOpen) ved bytte — modalen står åpen.
  renderDecadeRibbon(document.getElementById("dv-ribbon"), d, renderDecadeView);

  modal.querySelectorAll("[data-dv-fane]").forEach((b) => {
    const paa = b.dataset.dvFane === contextMode;
    b.classList.toggle("active", paa);
    b.setAttribute("aria-selected", paa ? "true" : "false");
  });
  for (const f of FANER) {
    const panel = document.getElementById(`dv-${f}-section`);
    if (panel) panel.hidden = f !== contextMode;
  }

  if (contextMode === "tech") tegnTeknologi(d, desc, s, lc);
  else if (contextMode === "society") tegnSamfunn(d, desc, lc);
  else tegnMusikk(d, s, lc);

  // Forrige/neste nederst inviterer til å lese tiårene som én fortelling.
  // visibility (ikke display) i endene, så knappene beholder plassen sin.
  const idx = DECADES.indexOf(d);
  const prevBtn = document.getElementById("dv-prev");
  const nextBtn = document.getElementById("dv-next");
  if (prevBtn) {
    prevBtn.style.visibility = idx > 0 ? "" : "hidden";
    prevBtn.textContent = idx > 0 ? `← ${DECADES[idx - 1]}-tallet` : "";
    prevBtn.onclick = idx > 0 ? () => renderDecadeView(DECADES[idx - 1]) : null;
  }
  if (nextBtn) {
    const more = idx >= 0 && idx < DECADES.length - 1;
    nextBtn.style.visibility = more ? "" : "hidden";
    nextBtn.textContent = more ? `${DECADES[idx + 1]}-tallet →` : "";
    nextBtn.onclick = more ? () => renderDecadeView(DECADES[idx + 1]) : null;
  }
}

// Teksten, med autolenker (K1: tiårstekstene var den eneste lange
// teksttypen uten dem).
function tegnTekst(el, tekst, lc) {
  if (!el) return;
  el.innerHTML = tekst ? formatInfoText(tekst, lc) : "Ingen beskrivelse ennå.";
  el.className = "info-text" + (tekst ? "" : " muted");
  if (tekst) wireLinks(el, lc);
}

// Lærer: Rediger (lærerens tiårsmodal). Student: Foreslå endring, med låsen
// for ventende forslag som før.
function tegnHandling(el, d, mode, desc) {
  if (!el) return;
  el.innerHTML = "";
  if (opts.onDecadeEdit) {
    el.innerHTML = `<button type="button" class="btn ghost small">Rediger</button>`;
    el.firstElementChild.onclick = () => opts.onDecadeEdit(d, mode);
    return;
  }
  if (!opts.onProposeEdit) return;
  const type = mode === "tech" ? "decade-tech" : "decade-society";
  const locked = opts.hasPendingEdit?.(type, d);
  el.innerHTML = `<button type="button" class="btn ghost small"${locked ? " disabled" : ""}>${locked ? "Forslag venter" : "Foreslå endring"}</button>`;
  el.firstElementChild.onclick = () => opts.onProposeEdit(mode === "tech"
    ? { entityType: type, entityId: String(d), entityName: `${d}-tallet (teknologi)`, currentValues: { tech: desc.tech || "", kilder: desc.kilder || [] } }
    : { entityType: type, entityId: String(d), entityName: `${d}-tallet (samfunn)`, currentValues: { society: desc.society || "", kilder: desc.kilder || [] } });
}

function aapneTech(id) {
  const t = (getState().techItems || []).find((x) => x.id === id);
  if (t) openTechDetail(t);
}

function tegnTeknologi(d, desc, s, lc) {
  const tl = document.getElementById("dv-tech-timeline");
  tl.innerHTML = buildTechTimeline(s.techItems || [], d);
  tl.querySelectorAll("[data-tech-id]").forEach((el) => el.addEventListener("click", () => aapneTech(el.dataset.techId)));
  tegnTekst(document.getElementById("dv-tech"), desc.tech, lc);
  tegnHandling(document.getElementById("dv-tech-handling"), d, "tech", desc);

  document.getElementById("dv-kilder-tech").innerHTML = buildKilderList(desc.kilder, "Kilder");
}

function tegnSamfunn(d, desc, lc) {
  tegnTekst(document.getElementById("dv-society"), desc.society, lc);
  tegnHandling(document.getElementById("dv-society-handling"), d, "society", desc);
  document.getElementById("dv-kilder-society").innerHTML = buildKilderList(desc.kilder, "Kilder");
}

// Musikk-fanen (K1): ingen løpende tekst, bare innganger. Sjangrene som var
// toneangivende (varmekartets nivåer, 3 eller mer), artistene som kom til, og
// lytteeksemplene fra tiåret.
function tegnMusikk(d, s, lc) {
  const venstre = document.getElementById("dv-musikk-sjangre");
  const heat = getHeatData();
  const idx = DECADES.indexOf(d);
  const rang = (m) => { const i = META_GENRE_ORDER.indexOf(m); return i < 0 ? 99 : i; };
  let sjangre = [];
  if (heat && idx >= 0) {
    const alle = GENEALOGY.filter((n) => n.g)
      .map((n) => ({ n, v: heatRow(heat, n.l)[idx] }))
      .filter((x) => x.v != null && x.v > 0)
      .sort((a, b) => b.v - a.v || rang(a.n.g) - rang(b.n.g) || String(a.n.f || a.n.l).localeCompare(String(b.n.f || b.n.l), "no"));
    sjangre = alle.filter((x) => x.v >= 3);
    if (!sjangre.length) sjangre = alle.slice(0, 6);
  }
  venstre.innerHTML = `<h4 class="related-head">Toneangivende sjangre</h4>` + (sjangre.length
    ? `<div class="dv-sjangre">${sjangre.map(({ n, v }) => {
        const farge = MAIN_GENRE_INFO[n.l]?.color || nodeColor(n);
        return `<button type="button" class="dv-sjanger" data-sjanger="${escapeHtml(n.l)}">
          <span class="dv-prikk" style="background:${escapeHtml(farge)}"></span>
          <span class="dv-navn">${escapeHtml(n.f || n.l)}<span class="dv-sub">${escapeHtml(n.g)}</span></span>
          <span class="dv-varme" role="img" aria-label="Nivå ${v} av 5"><i style="width:${v * 20}%;background:${escapeHtml(farge)}"></i></span>
        </button>`;
      }).join("")}</div>`
    : `<p class="muted dv-tom">Varmekartet har ingen nivåer for dette tiåret ennå.</p>`)
    + `<button type="button" class="dv-lenke" data-dv-varmekart>Hele varmekartet <span aria-hidden="true">›</span></button>`;
  venstre.querySelector("[data-dv-varmekart]").onclick = () => openVarmekart();

  const synlige = (s.artists || []).filter(isVisible);
  const aktive = filterArtists(synlige, { search: "", mainGenre: "", metaGenre: "", instrument: "", decade: String(d), priority: 0 })
    .sort(byInfluenceThenName);
  const nye = synlige.filter((a) => a.influenceStart >= d && a.influenceStart <= d + 9).sort(byInfluenceThenName);
  const par = tiarEksempler(synlige, d);
  const aar = (a) => [a.influenceStart, a.influenceEnd].filter(Boolean).join("–");

  // Artistene og lytteeksemplene som lister i samme stil som spillelistene
  // (v6.11, brukervalg 2026-10-03): navn eller tittel til venstre, årstall
  // eller artist til høyre, en tynn strek mellom radene.
  const artisterEl = document.getElementById("dv-musikk-artister");
  artisterEl.innerHTML = `<h4 class="related-head">Kom til på ${d}-tallet (${nye.length})</h4>`
    + (nye.length
      ? `<ul class="pl-list dv-pl">${nye.map((a) => `<li class="pl-item"><button type="button" class="dv-artist" data-related-id="${escapeHtml(String(a.id))}">${escapeHtml(a.name)}</button><span class="pl-hoyre"><span class="pl-artist">${escapeHtml(aar(a))}</span></span></li>`).join("")}</ul>`
      : `<p class="muted dv-tom">Ingen nye artister dette tiåret.</p>`)
    + (aktive.length ? `<button type="button" class="dv-lenke" data-dv-aktive>Alle ${aktive.length} som var aktive <span aria-hidden="true">›</span></button>` : "");
  wireRelated(artisterEl, lc);
  const alleAktive = artisterEl.querySelector("[data-dv-aktive]");
  if (alleAktive) alleAktive.onclick = () => openArtistListModal(`Aktive på ${d}-tallet`, aktive, opts.onArtistClick, "Ingen artister ennå.");

  const lyttEl = document.getElementById("dv-musikk-lytt");
  lyttEl.innerHTML = `<h4 class="related-head">Lytt (${par.length})</h4>`
    + (par.length
      ? spillAlleHtml(par.map(({ m }) => ytMaal(m.url)?.video).filter(Boolean))
        + `<ul class="pl-list dv-pl">${par.map(({ a, m, y }) => `<li class="pl-item"><a class="lytt-lenke" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.label || "Lytt")} <span class="pl-aar">(${y})</span></a><span class="pl-hoyre"><span class="pl-artist">${escapeHtml(a.name)}</span></span></li>`).join("")}</ul>`
      : `<p class="muted dv-tom">Ingen lytteeksempler fra dette tiåret ennå.</p>`);
}
