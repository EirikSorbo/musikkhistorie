// ============================================================================
//  LÆRER — ARTISTER
// ----------------------------------------------------------------------------
//  Detalj-/sjekk-visning, rediger-artist-skjema, filtre og oversikt/dashboard.
// ============================================================================

import { state, ctx, openAdminModal, closeAdminModal, renderList, updatePendingBadge, guardTeacherAction } from "./teacher-state.js?v=2.97";
import { updateArtistFields, setTeacherChecks } from "./store.js?v=2.97";
import { renderArtistDetail, renderDashboard, fillSelect, modalOpen, modalClose } from "./ui.js?v=2.97";
import { isMainGenre } from "./genealogy.js?v=2.97";
import { openSingleSubgenreModal } from "./teacher-content.js?v=2.97";
import { GENDERS } from "./limits.js?v=2.97";
import { debounce } from "./util.js?v=2.97";
import { $ } from "./shared.js?v=2.97";
import { WORK_SPEC, MUSIC_SPEC, SOURCE_SPEC, addRow, buildRows, collectRows } from "./row-editor.js?v=2.97";

// ----------------------------------------------------------------------------
//  Detalj / sjekk / oversikt
// ----------------------------------------------------------------------------

export function openDetail(artist) {
  const modal = document.getElementById("modal-detail");
  document.getElementById("detail-name").textContent = artist.name;
  renderArtistDetail(document.getElementById("detail-body"), artist, state.config, ctx.explore.buildLinkCtx());
  // «Vis i tidslinje» → fokus-API-et (samme som studentsiden); skjules for
  // artister uten startår (de har ingen blokk på tidslinjen).
  const tlBtn = document.getElementById("detail-tidslinje");
  if (tlBtn) {
    tlBtn.style.display = Number(artist.influenceStart) > 0 ? "" : "none";
    tlBtn.onclick = () => ctx.explore.openTidslinje({ artistId: artist.id });
  }
  const editBtn = document.getElementById("detail-edit-btn");
  editBtn.onclick = () => { modalClose(modal); openEditModal(artist.id); };
  const checkBtn = document.getElementById("detail-check-btn");
  const setBtn = (checked) => {
    checkBtn.textContent = checked ? "✓ Sjekket" : "Sjekk";
    checkBtn.className = `btn ghost small ${checked ? "accent" : ""}`;
  };
  setBtn(artist.teacherChecked === true);
  checkBtn.onclick = () => {
    // Les FERSK tilstand fra state — closure-objektet `artist` oppdateres ikke
    // av sanntidslytteren, så uten dette kunne knappen ikke slås av igjen.
    const cur = state.artists.find((x) => x.id === artist.id) || artist;
    const next = !(cur.teacherChecked === true);
    guardTeacherAction(updateArtistFields(artist.id, { teacherChecked: next }));
    setBtn(next);
  };
  modalOpen(modal);
}

export function addMainGenreCheckToggle(genre) {
  const body = document.getElementById("sj-body");
  if (!body) return;
  const field = isMainGenre(genre) ? "genres" : "subgenres";
  const list = state.teacherChecks[field] || [];
  const checked = list.includes(genre);
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:12px";
  wrap.innerHTML = `<button class="btn ghost small ${checked ? "accent" : ""}" id="sj-check-btn">${checked ? "✓ Sjekket" : "Sjekk"}</button>`;
  body.appendChild(wrap);
  wrap.querySelector("#sj-check-btn").addEventListener("click", () => {
    const cur = [...(state.teacherChecks[field] || [])];
    const idx = cur.indexOf(genre);
    const btn = wrap.querySelector("#sj-check-btn");
    if (idx >= 0) { cur.splice(idx, 1); btn.textContent = "Sjekk"; btn.className = "btn ghost small"; }
    else { cur.push(genre); btn.textContent = "✓ Sjekket"; btn.className = "btn ghost small accent"; }
    setTeacherChecks({ [field]: cur });
  });
}

export function openOversikt() {
  renderDashboard($("#oversikt-body"), {
    ...state,
    onSubgenreClick: (s) => ctx.explore.openSubgenreInfo(s),
    onEditDesc: (name, level) => openSingleSubgenreModal(name, level),
  });
  openAdminModal("modal-oversikt");
}

// ----------------------------------------------------------------------------
//  Filtre
// ----------------------------------------------------------------------------

function updatePrioButtons() {
  document.querySelectorAll("#t-prio-bar .prio-filter-btn").forEach((btn) => {
    const p = parseInt(btn.dataset.prio, 10);
    btn.className = `prio-filter-btn${state.filters.priority === p ? ` active-${p}` : ""}`;
  });
}

export function setupFilters() {
  $("#f-sjanger").addEventListener("change", (e) => { state.filters.mainGenre = e.target.value; renderList(); });
  $("#f-genre").addEventListener("change", (e) => { state.filters.metaGenre = e.target.value; renderList(); });
  $("#f-decade").addEventListener("change", (e) => { state.filters.decade = e.target.value; renderList(); });
  $("#f-instrument").addEventListener("change", (e) => { state.filters.instrument = e.target.value; renderList(); });
  $("#f-subgenre").addEventListener("change", (e) => { state.filters.subgenre = e.target.value; renderList(); });
  const searchRender = debounce(renderList, 200);
  $("#f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; searchRender(); });
  document.querySelectorAll("#t-prio-bar .prio-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.prio, 10);
      state.filters.priority = state.filters.priority === p ? 0 : p;
      updatePrioButtons();
      renderList();
    });
  });
  const showRemoved = $("#f-show-removed");
  showRemoved.checked = state.filters.showRemoved;
  showRemoved.addEventListener("change", (e) => { state.filters.showRemoved = e.target.checked; renderList(); });
  const hideChecked = $("#f-hide-checked");
  hideChecked.checked = state.filters.hideChecked;
  hideChecked.addEventListener("change", (e) => { state.filters.hideChecked = e.target.checked; renderList(); });

  $("#btn-pending").addEventListener("click", () => {
    state.filters.showPending = !state.filters.showPending;
    updatePendingBadge();
    renderList();
  });
}

// ----------------------------------------------------------------------------
//  Rediger artist
// ----------------------------------------------------------------------------

export function openEditModal(artistId) {
  const a = state.artists.find((x) => x.id === artistId);
  if (!a) return;
  const c = state.config;

  $("#ed-id").value = a.id;
  $("#ed-name").value = a.name || "";
  $("#ed-birthyear").value = a.birthYear || "";
  $("#ed-deathyear").value = a.deathYear || "";
  $("#ed-geo").value = a.geography || "";
  $("#ed-start").value = a.influenceStart || "";
  $("#ed-end").value = a.influenceEnd || "";
  $("#ed-recordLabel").value = a.recordLabel || "";
  $("#ed-mainGenre").value = (a.mainGenre || []).join(", ");
  $("#ed-subGenre").value = (a.subGenre || []).join(", ");
  $("#ed-desc").value = a.description || "";
  $("#ed-by").value = a.proposedBy || "";
  $("#ed-image-url").value = a.imageUrl || "";
  $("#ed-image-credit").value = a.imageCredit || "";

  fillSelect($("#ed-gender"), GENDERS, { placeholder: "Velg kjønn …" });
  $("#ed-gender").value = a.gender || "";
  fillSelect($("#ed-metaGenre"), c.metaGenres, { placeholder: "Velg sjanger …" });
  $("#ed-metaGenre").value = a.metaGenre || "";
  fillSelect($("#ed-instrument"), c.instruments || [], { placeholder: "Ingen / ukjent" });
  $("#ed-instrument").value = a.instrument || "";

  buildEditMusicExampleRows(a.musicExamples || []);
  buildEditWorkRows(a.keyWorks || []);
  buildEditSourceRows(a.kilder || []);

  const pending = state.pendingEdits.find(p => p.entityType === "artist" && p.entityId === a.id);
  const msgEl = $("#ed-msg");
  if (pending) {
    msgEl.className = "form-msg warn";
    msgEl.textContent = `Obs: Det finnes et åpent endringsforslag for ${a.name} fra ${pending.proposedBy || "Anonym"}. Behandle det først via «Endringsforslag».`;
  } else {
    msgEl.className = "form-msg";
    msgEl.textContent = "";
  }
  openAdminModal("modal-edit");
}

// Rad-editorene bor nå i den delte row-editor.js (spec-drevet, med escaping).
// Disse er tynne innpakninger mot rediger-modalens wrap-er.
function buildEditMusicExampleRows(examples) { buildRows($("#ed-me-rows"), MUSIC_SPEC, examples); }
function addEditMusicExampleRow(v) { addRow($("#ed-me-rows"), MUSIC_SPEC, v || {}); }
function collectEditMusicExamples() { return collectRows($("#ed-me-rows"), MUSIC_SPEC); }

function buildEditSourceRows(kilder) { buildRows($("#ed-source-rows"), SOURCE_SPEC, kilder); }
function addEditSourceRow(v) { addRow($("#ed-source-rows"), SOURCE_SPEC, v || {}); }
function collectEditSources() { return collectRows($("#ed-source-rows"), SOURCE_SPEC); }

function buildEditWorkRows(works) { buildRows($("#ed-work-rows"), WORK_SPEC, works); }
function addEditWorkRow(v) { addRow($("#ed-work-rows"), WORK_SPEC, v || {}); }
function collectEditWorks() { return collectRows($("#ed-work-rows"), WORK_SPEC); }

export function setupEditForm() {
  if (!$("#edit-form")) return;
  $("#ed-add-me").addEventListener("click", () => addEditMusicExampleRow());
  $("#ed-add-source").addEventListener("click", () => addEditSourceRow());
  $("#ed-add-work").addEventListener("click", () => addEditWorkRow());

  $("#edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#ed-msg");
    msg.textContent = "";
    const id = $("#ed-id").value;
    const fields = {
      name:          $("#ed-name").value.trim(),
      birthYear:     parseInt($("#ed-birthyear").value, 10) || null,
      deathYear:     parseInt($("#ed-deathyear").value, 10) || null,
      gender:        $("#ed-gender").value,
      metaGenre:     $("#ed-metaGenre").value,
      instrument:    $("#ed-instrument").value,
      mainGenre:     $("#ed-mainGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      subGenre:      $("#ed-subGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#ed-start").value, 10) || null,
      influenceEnd:   parseInt($("#ed-end").value, 10) || null,
      recordLabel:   $("#ed-recordLabel").value.trim(),
      geography:     $("#ed-geo").value.trim(),
      description:   $("#ed-desc").value.trim(),
      keyWorks:      collectEditWorks(),
      musicExamples: collectEditMusicExamples(),
      kilder:        collectEditSources(),
      imageUrl:      $("#ed-image-url").value.trim(),
      imageCredit:   $("#ed-image-credit").value.trim(),
      proposedBy:    $("#ed-by").value.trim() || "Anonym",
    };
    try {
      await updateArtistFields(id, fields);
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";
      setTimeout(() => closeAdminModal("modal-edit"), 1000);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

// La handlers.edit (i teacher-state) nå rediger-modalen uten import-syklus.
ctx.openEditModal = openEditModal;
