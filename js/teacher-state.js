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
  getClientId,
} from "./store.js?v=2.56";
import { renderArtists, renderLimits, fillSelect, modalOpen, modalClose, modalCloseTop, setupModal } from "./ui.js?v=2.56";
import { GENEALOGY_MAIN_GENRES } from "./genealogy.js?v=2.56";
import { $ } from "./shared.js?v=2.56";

export const state = {
  artists: [],
  config: null,
  decadeDescs: {},
  subgenreDescs: {},
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

export const handlers = {
  approve:     (id) => teacherApprove(id),
  reject:      (id) => { if (confirm("Avvise dette forslaget?")) teacherReject(id); },
  remove:      (id) => setArtistPriority(id, -1),
  restore:     (id) => setArtistPriority(id, 0),
  del:         (id) => { if (confirm("Slette dette forslaget permanent?")) teacherDelete(id); },
  edit:        (id) => ctx.openEditModal?.(id),
  priority3:   (id) => { const a = state.artists.find(x => x.id === id); setArtistPriority(id, a?.priority === 3 ? 0 : 3); },
  priority2:   (id) => { const a = state.artists.find(x => x.id === id); setArtistPriority(id, a?.priority === 2 ? 0 : 2); },
  priority1:   (id) => { const a = state.artists.find(x => x.id === id); setArtistPriority(id, a?.priority === 1 ? 0 : 1); },
  toggleCheck: (id) => {
    const a = state.artists.find(x => x.id === id);
    updateArtistFields(id, { teacherChecked: !(a?.teacherChecked) });
  },
};

// ----------------------------------------------------------------------------
//  Små hjelpere
// ----------------------------------------------------------------------------

export function int(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
export function splitList(v, fallback) {
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : fallback;
}

// ----------------------------------------------------------------------------
//  Modaler
// ----------------------------------------------------------------------------

export function openAdminModal(id) {
  const el = document.getElementById(id);
  modalOpen(el);
  if (id === "modal-fyllingsgrad") renderLimits($("#modal-limits"), state);
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

export function updatePendingBadge() {
  const count = state.artists.filter(a => a.status === "pending").length;
  const badge = $("#pending-badge");
  const btn = $("#btn-pending");
  if (!btn) return;
  badge.textContent = count;
  badge.style.display = count ? "" : "none";
  btn.classList.toggle("active", !!state.filters.showPending);

  const pendingTech = state.techItems.filter(t => t.status === "pending").length;
  const editCount = state.pendingEdits.length + pendingTech;
  const eBadge = $("#pending-edits-badge");
  const eBtn = $("#btn-pending-edits");
  if (eBadge && eBtn) {
    eBadge.textContent = editCount;
    eBadge.style.display = editCount ? "" : "none";
  }
}

export function renderAll() {
  if (!state.config) return;
  if (document.getElementById("modal-fyllingsgrad").classList.contains("open"))
    renderLimits($("#modal-limits"), state);
  updatePendingBadge();
  renderList();
}

export function refreshControls() {
  const { config } = state;
  fillSelect($("#f-sjanger"), GENEALOGY_MAIN_GENRES, { placeholder: "Alle sjangre" });
  fillSelect($("#f-genre"), config.metaGenres, { placeholder: "Alle metasjangre" });
  fillSelect(
    $("#f-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
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
