// ============================================================================
//  DELT KONTEKST FOR UTFORSK-MODULENE
// ----------------------------------------------------------------------------
//  Utforsk-funksjonene deler én modulnivå-`opts` (satt av initExplore) og en
//  håndfull hjelpere. Da explore.js ble delt opp (v3.54) flyttet den delte
//  kjernen hit, så feature-modulene (varmekart, tidslinje, …) kan importere
//  den. ES-modulers live bindings gjør at `opts` satt via setOpts sees av alle
//  moduler: fang ALDRI opts i en modulnivå-konstant (den er null før setOpts) —
//  les alltid opts.xxx ved kall-tid, slik koden alltid har gjort.
// ============================================================================
import { escapeHtml, modalClose, buildMainGenreList, openPlaylistModal, openArtistListModal, artistsInGenre, artistsByInstrument, showSubsjangerInfo } from "./ui.js?v=4.93";
import { showSjangerInfo, refreshSjangerInfo } from "./genealogy.js?v=4.93";
import { MAIN_GENRE_INFO, FAMILIES } from "./genre-model.js?v=4.93";
import { teacherActionRow, wireTeacherRow } from "./ui-helpers.js?v=4.93";
import { openTechDetail } from "./explore-tech.js?v=4.93";
import { renderPage } from "./explore-innhold.js?v=4.93";
import { openTidslinje } from "./explore-tidslinje.js?v=4.93";
import { renderVarmekartBody } from "./explore-varmekart.js?v=4.93";
import { renderReferanser } from "./explore-referanser.js?v=4.93";
import { setHeatData } from "./heat-strip.js?v=4.93";

export let opts = null;
export function setOpts(o) { opts = o; }

export function getState() { return opts.getState(); }

// Injiserer den delte lærer-knapperaden (Sjekk | Rediger · Slett) i en «extra»-
// beholder i en detaljmodal. Gjør ingenting for studenter (opts.onCheck
// mangler). category/id styrer sjekk-lagringen; onEdit/onDelete kobles kun når
// callbacken finnes (Slett bare for hele enheter, dvs. innovasjonskort).
export function injectTeacherRow(extraEl, { category, id, onEdit = null, onDelete = null }) {
  if (!extraEl) return;
  extraEl.innerHTML = "";
  if (!opts.onCheck) return;
  const checked = (opts.getCheckedState?.()?.[category] || []).includes(id);
  extraEl.innerHTML = teacherActionRow({ checked, edit: !!onEdit, del: !!onDelete });
  wireTeacherRow(extraEl, {
    onCheck: (on) => opts.onCheck(category, id, on),
    onEdit,
    onDelete,
  });
}

export function buildLinkCtx() {
  const s = getState();
  return {
    artists: s.artists,
    techItems: s.techItems,
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onMainGenreClick,
    isTeacher: !!s.isTeacher,
  };
}

export function sjangerOpts() {
  const s = getState();
  return {
    root: document,
    genreDescs: s.genreDescs,
    // Koblingsbeskrivelsene følger med i SAMME opts-objekt som sjangerkortet,
    // så showEdgeInfo (strekene i slektstreet) kan leses fra enhver side uten
    // at kalleren må sette dem sammen selv. Forsiden manglet dem helt før v4.44.
    edgeDescs: s.edgeDescs,
    artists: s.artists,
    techItems: s.techItems,
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onMainGenreClick,
    onShowArtists: showArtistsForSjanger,
    onShowPlaylist: showPlaylistForMainGenre,
    // Tidslinjen åpnes OPPÅ sjanger-popupen (modaler stables), fokusert på
    // denne sjangerens seksjon — ← går tilbake til popupen.
    onShowTimeline: ({ label }) => openTidslinje({ genre: label }),
    onEdit: opts.onSubgenreEdit ? (label, level) => {
      modalClose(document.getElementById("modal-sjanger"));
      opts.onSubgenreEdit(label, level);
    } : undefined,
    onPropose: opts.onProposeEdit,
    hasPendingEdit: opts.hasPendingEdit,
  };
}

export function onMainGenreClick(genre) {
  showSjangerInfo(genre, sjangerOpts()) || showSubsjangerInfo(genre, sjangerOpts());
  if (opts.onMainGenreCheck) opts.onMainGenreCheck(genre);
}

export function showPlaylistForMainGenre({ fullName, node }) {
  openPlaylistModal(fullName, node, getState().artists);
}

export function showArtistsForSjanger({ label }) {
  openArtistListModal(label, artistsInGenre(getState().artists, label), opts.onArtistClick, "Ingen forslag i denne sjangeren ennå.");
}

export function showArtistsForInstrument(instrument) {
  openArtistListModal(instrument, artistsByInstrument(getState().artists, instrument), opts.onArtistClick, "Ingen forslag med dette instrumentet ennå.");
}

// Kalles av sidene når genreDescriptions-snapshotet endres: et åpent
// sjangerkort skal vise den nye beskrivelsen med én gang, ikke først når
// kortet lukkes og åpnes igjen. (Egen inngang fordi beskrivelsene bor i sin
// egen samling — content-snapshotet fyrer ikke når de endres.)
export function genreDescsChanged() {
  refreshSjangerInfo(sjangerOpts());
}

// Kalles av sidene når content-snapshotet endres (import, redigering,
// celleklikk): re-rendrer innholdsvisninger som står åpne, så endringen
// slår gjennom uten å lukke/åpne modalen.
export function contentChanged() {
  // Varmenivåene legges igjen i heat-strip.js, der sjangerkortet (genealogy.js)
  // henter dem. Kortet bygges et lag UNDER app-laget og kan ikke lese state
  // herfra — explore-context importerer genealogy, så en import den andre veien
  // ville lukket sirkelen. Dette er første og eneste snapshot-punktet, så linja
  // på kortet er fersk fra første lasting og etter hver redigering.
  setHeatData(getState().content?.varmekart?.heat || null);
  // Står et sjangerkort åpent, tegnes det på nytt — da følger varmelinja med når
  // læreren endrer nivåer, i stedet for å vise gamle tall til kortet lukkes.
  // sjangerOpts() sendes med så omtegningen leser GJELDENDE state: de fangede
  // opts fra åpningsøyeblikket pekte på utbyttede referanser og viste aldri en
  // fersk beskrivelse.
  refreshSjangerInfo(sjangerOpts());
  const isOpen = (id) => document.getElementById(id)?.classList.contains("open");
  if (isOpen("modal-om-historie")) renderPage("omHistorie", "om-historie-body", "omh-extra");
  if (isOpen("modal-rotter")) renderPage("rotter", "rotter-body", "rotter-extra");
  if (isOpen("modal-app-guide")) renderPage("appGuide", "app-guide-body", "app-guide-extra");
  if (isOpen("modal-varmekart")) renderVarmekartBody();
  // Frittstående referanser bor i content: lagrer læreren en ny, skal kortet
  // vise den med én gang, ikke ved neste åpning.
  if (isOpen("modal-referanser")) renderReferanser();
}

// ----------------------------------------------------------------------------
//  Delt av varmekart + tidslinje (før duplisert i begge). Én kilde, så meta-
//  akkordeonen og fargevalgene aldri driver fra hverandre.
// ----------------------------------------------------------------------------

// Representativ familiefarge for en gruppe = den hyppigste i gruppa.
export const groupColor = (labels) => {
  const tally = {};
  for (const l of labels) { const c = MAIN_GENRE_INFO[l]?.color; if (c) tally[c] = (tally[c] || 0) + 1; }
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || FAMILIES.gray.stroke;
};

// Gruppehode for meta-akkordeonen (varmekart + tidslinje): caret + farget prikk
// + metanavn + en fritekst-telling. `prefix` gir klassenavnene (vk/tid),
// `metaAttr` legger et evt. data-attributt på wrapperen (varmekartet bruker det
// til å huske hvilken gruppe som står åpen). Åpner .${prefix}-group + knappen —
// kalleren legger til .${prefix}-group-rows etterpå, som før.
// `dot: false` dropper den fargede prikken (Referanser-kortet: der bærer
// seksjonsoverskriften fargen, og en prikk per linje ble bare støy).
export function metaGroupHeadHtml({ prefix, meta, gColor, open, groupIdx, count, metaAttr = "", dot = true }) {
  let h = `<div class="${prefix}-group"${metaAttr}>`;
  h += `<button type="button" class="${prefix}-group-head" aria-expanded="${open}" style="width:100%;display:flex;align-items:center;gap:9px;margin:${groupIdx === 0 ? "6px" : "10px"} 0 6px;padding:4px 0 5px;border:0;border-bottom:2px solid ${gColor}40;background:none;cursor:pointer;text-align:left">`;
  h += `<span class="${prefix}-caret" style="flex:none;width:12px;font-size:0.7rem;color:var(--muted);transition:transform .15s;transform:rotate(${open ? 90 : 0}deg)">▶</span>`;
  if (dot) h += `<span style="width:12px;height:12px;border-radius:50%;background:${gColor};flex:none;box-shadow:0 0 0 3px ${gColor}22"></span>`;
  h += `<span style="font-size:0.84rem;font-weight:700;color:var(--text)">${escapeHtml(meta)}</span>`;
  h += `<span style="font-size:0.72rem;color:var(--muted)">${count}</span>`;
  h += `</button>`;
  return h;
}

// Delt akkordeon-klikklogikk: én gruppe åpen om gangen (klikk på åpen gruppe
// lukker den). `onToggle(wasOpen, group)` kalles før omtegningen — varmekartet
// bruker den til å huske åpen gruppe; tidslinjen dropper den.
export function wireMetaAccordion(body, prefix, onToggle) {
  body.querySelectorAll(`.${prefix}-group-head`).forEach((head) => {
    head.addEventListener("click", () => {
      const wasOpen = head.getAttribute("aria-expanded") === "true";
      if (onToggle) onToggle(wasOpen, head.closest(`.${prefix}-group`));
      body.querySelectorAll(`.${prefix}-group`).forEach((grp) => {
        const h = grp.querySelector(`.${prefix}-group-head`);
        const rows = grp.querySelector(`.${prefix}-group-rows`);
        const isThis = h === head && !wasOpen;
        h.setAttribute("aria-expanded", isThis ? "true" : "false");
        const caret = h.querySelector(`.${prefix}-caret`);
        if (caret) caret.style.transform = `rotate(${isThis ? 90 : 0}deg)`;
        if (rows) rows.style.display = isThis ? "block" : "none";
      });
    });
  });
}
