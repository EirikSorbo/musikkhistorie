// ============================================================================
//  LÆRER — DELT KJERNE
// ----------------------------------------------------------------------------
//  Felles tilstand (`state`), delte referanser (`ctx`), knappehandlinger og de
//  generiske render-/modal-funksjonene som alle lærer-feature-modulene bygger
//  på. Holder ingen feature-spesifikk logikk — den bor i teacher-*.js-modulene.
// ============================================================================

import {
  teacherApprove,
  teacherReject,
  teacherDelete,
  setArtistPriority,
  updateArtistFields,
  setTeacherChecks,
  getClientId,
} from "./store.js?v=3.61";
import { renderArtists, fillSelect, modalOpen, modalClose, modalCloseTop, setupModal } from "./ui.js?v=3.61";
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES } from "./genealogy.js?v=3.61";
import { DECADES } from "./limits.js?v=3.61";
import { $ } from "./shared.js?v=3.61";

export const state = {
  artists: [],
  config: null,
  // true når config-lesingen feilet og state.config bare er standardverdier —
  // da må admin-lagring blokkeres, ellers overskrives lærerens ekte config.
  configIsFallback: false,
  decadeDescs: {},
  genreDescs: {},
  // Koblingsbeskrivelser (strekene i slektstreet), doc-ID «fra__til».
  edgeDescs: {},
  // Innholdssidene (Om historie, Røtter) + varmekartet fra content-samlingen.
  // contentLoaded skiller «laster fortsatt» fra «mangler faktisk tekst».
  content: {},
  contentLoaded: false,
  // artistsLoaded: har artist-snapshotet landet? Destruktive handlinger
  // (Erstatt alle / Slett alt) må vente på dette — ellers bygges backupen fra
  // en tom state mens slettingen går mot serveren.
  artistsLoaded: false,
  podcasts: [],
  techItems: [],
  teacherChecks: { genres: [], subgenres: [] },
  pendingEdits: [],
  filters: { mainGenre: "", metaGenre: "", decade: "", instrument: "", subgenre: "", search: "", showRemoved: true, showPending: false, hideChecked: false, priority: 0 },
  isTeacher: true,
  clientId: getClientId(),
  started: false,
};

// Delte referanser satt ved oppstart / av feature-moduler:
//  - explore: slektstre/utforsk-API (settes i teacher.js etter initExplore)
//  - openEditModal: settes av teacher-artists.js, kalles av handlers.edit
export const ctx = { explore: null, openEditModal: null };

// Feil fra lærerhandlinger (regel-avvisning, utlogget økt, nettverk) skal ikke
// svelges stille — da tror læreren at klikket ble lagret. Samme prinsipp som
// voteFailed på forsiden; UI-tilstanden retter seg når neste snapshot kommer.
export function guardTeacherAction(promise) {
  return Promise.resolve(promise).catch((err) => {
    console.error("Lærerhandling feilet:", err);
    alert("Handlingen ble ikke lagret (" + (err?.message || err) + "). Prøv igjen.");
  });
}

export const handlers = {
  approve:     (id) => guardTeacherAction(teacherApprove(id)),
  reject:      (id) => { if (confirm("Avvise dette forslaget?")) guardTeacherAction(teacherReject(id)); },
  remove:      (id) => guardTeacherAction(setArtistPriority(id, -1)),
  restore:     (id) => guardTeacherAction(setArtistPriority(id, 0)),
  del:         (id) => { if (confirm("Slette dette forslaget permanent?")) guardTeacherAction(teacherDelete(id)); },
  edit:        (id) => ctx.openEditModal?.(id),
  priority3:   (id) => { const a = state.artists.find(x => x.id === id); guardTeacherAction(setArtistPriority(id, a?.priority === 3 ? 0 : 3)); },
  priority2:   (id) => { const a = state.artists.find(x => x.id === id); guardTeacherAction(setArtistPriority(id, a?.priority === 2 ? 0 : 2)); },
  priority1:   (id) => { const a = state.artists.find(x => x.id === id); guardTeacherAction(setArtistPriority(id, a?.priority === 1 ? 0 : 1)); },
  toggleCheck: (id) => {
    const a = state.artists.find(x => x.id === id);
    guardTeacherAction(updateArtistFields(id, { teacherChecked: !(a?.teacherChecked) }));
  },
};

// Sett/fjern «sjekket» for et innholdselement. Artistkort bor på artist-
// dokumentet (teacherChecked); alle andre kategorier er navnelister i
// config/teacherChecks (genres/subgenres/metaGenres/tech/decades/pages).
// Deterministisk (on), så optimistiske knapper i detaljmodalene og Skrivebordet
// aldri kommer i utakt. Delt av teacher-desk og detaljvisningenes Sjekk-knapp.
export function setContentCheck(category, id, on) {
  if (category === "artists") {
    return guardTeacherAction(updateArtistFields(id, { teacherChecked: on }));
  }
  const cur = state.teacherChecks?.[category] || [];
  const has = cur.includes(id);
  if (on === has) return Promise.resolve();
  const next = on ? [...cur, id] : cur.filter((x) => x !== id);
  return guardTeacherAction(setTeacherChecks({ [category]: next }));
}

// ----------------------------------------------------------------------------
//  Små hjelpere
// ----------------------------------------------------------------------------

export function splitList(v, fallback) {
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : fallback;
}

// ----------------------------------------------------------------------------
//  Modaler
// ----------------------------------------------------------------------------

export function openAdminModal(id) {
  modalOpen(document.getElementById(id));
}

export function closeAdminModal(id) {
  modalClose(document.getElementById(id));
}

export function setupModals() {
  document.querySelectorAll("[data-open-modal]").forEach((btn) =>
    btn.addEventListener("click", () => openAdminModal(btn.dataset.openModal))
  );
  document.querySelectorAll(".modal-backdrop").forEach((m) => setupModal(m));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modalCloseTop();
  });
}

// ----------------------------------------------------------------------------
//  Kjerne-render
// ----------------------------------------------------------------------------

export function renderList() {
  renderArtists($("#artist-list"), { ...state, handlers, linkCtx: ctx.explore ? ctx.explore.buildLinkCtx() : {} });
}

export function renderAll() {
  if (!state.config) return;
  // Ventende-filteret slås på fra Skrivebordet (som også slår det av igjen).
  // Når siste forslag er behandlet, slås det av automatisk — ellers ville
  // lista stått igjen tom uten noen synlig grunn.
  if (state.filters.showPending && !state.artists.some((a) => a.status === "pending")) {
    state.filters.showPending = false;
  }
  renderList();
}

export function refreshControls() {
  const { config } = state;
  fillSelect($("#f-sjanger"), GENEALOGY_MAIN_GENRES, { placeholder: "Alle sjangre" });
  fillSelect($("#f-genre"), GENEALOGY_META_GENRES, { placeholder: "Alle hovedsjangre" });
  fillSelect(
    $("#f-decade"),
    DECADES.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Alle tiår" }
  );
  fillSelect($("#f-instrument"), config.instruments || [], { placeholder: "Alle instrumenter" });
  const allSubs = [...new Set(
    (state.artists || []).flatMap((a) => [...(a.mainGenre || []), ...(a.subGenre || [])])
  )].sort((a, b) => a.localeCompare(b, "no"));
  fillSelect($("#f-subgenre"), allSubs, { placeholder: "Alle undersjangre" });
  if (state.filters.mainGenre)  $("#f-sjanger").value = state.filters.mainGenre;
  if (state.filters.metaGenre)    $("#f-genre").value = state.filters.metaGenre;
  if (state.filters.subgenre) $("#f-subgenre").value = state.filters.subgenre;
}
