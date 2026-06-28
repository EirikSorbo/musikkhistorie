// ============================================================================
//  LÆRER — ARTISTER
// ----------------------------------------------------------------------------
//  Detalj-/sjekk-visning, rediger-artist-skjema, filtre og oversikt/dashboard.
// ============================================================================

import { state, ctx, openAdminModal, closeAdminModal, renderList, updatePendingBadge } from "./teacher-state.js?v=2.53";
import { updateArtistFields, setTeacherChecks } from "./store.js?v=2.53";
import { escapeHtml, renderArtistDetail, renderDashboard, fillSelect, modalOpen, modalClose } from "./ui.js?v=2.53";
import { isMainGenre } from "./genealogy.js?v=2.53";
import { $ } from "./shared.js?v=2.53";

// ----------------------------------------------------------------------------
//  Detalj / sjekk / oversikt
// ----------------------------------------------------------------------------

export function openDetail(artist) {
  const modal = document.getElementById("modal-detail");
  document.getElementById("detail-name").textContent = artist.name;
  renderArtistDetail(document.getElementById("detail-body"), artist, state.config, ctx.explore.buildLinkCtx());
  const editBtn = document.getElementById("detail-edit-btn");
  editBtn.onclick = () => { modalClose(modal); openEditModal(artist.id); };
  const checkBtn = document.getElementById("detail-check-btn");
  const checked = artist.teacherChecked === true;
  checkBtn.textContent = checked ? "✓ Sjekket" : "Sjekk";
  checkBtn.className = `btn ghost small ${checked ? "accent" : ""}`;
  checkBtn.onclick = () => {
    updateArtistFields(artist.id, { teacherChecked: !artist.teacherChecked });
    const nowChecked = !artist.teacherChecked;
    checkBtn.textContent = nowChecked ? "✓ Sjekket" : "Sjekk";
    checkBtn.className = `btn ghost small ${nowChecked ? "accent" : ""}`;
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
  renderDashboard($("#oversikt-body"), { ...state, onSubgenreClick: (s) => ctx.explore.openSubgenreInfo(s) });
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
  $("#f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; renderList(); });
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

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-key]");
    if (!btn) return;
    const key = btn.dataset.filterKey, val = btn.dataset.filterVal;
    const sel = { mainGenre: "#f-sjanger", subgenre: "#f-subgenre", instrument: "#f-instrument", metaGenre: "#f-genre" }[key];
    if (!sel) return;
    state.filters[key] = val;
    const elSel = $(sel);
    if (elSel) elSel.value = val;
    renderList();
  });
}

// ----------------------------------------------------------------------------
//  Rediger artist
// ----------------------------------------------------------------------------

const GENDERS_EDIT = [
  { value: "kvinne", label: "Kvinne" },
  { value: "mann", label: "Mann" },
  { value: "annet", label: "Gruppe" },
  { value: "ukjent", label: "Ukjent" },
];

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

  fillSelect($("#ed-gender"), GENDERS_EDIT, { placeholder: "Velg kjønn …" });
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

function buildEditMusicExampleRows(examples) {
  const wrap = $("#ed-me-rows");
  wrap.innerHTML = "";
  (examples.length ? examples : [{ label: "", url: "", year: "", performanceYear: "" }]).forEach((m) =>
    addEditMusicExampleRow(m.label || "", m.url || "", m.year || "", m.performanceYear || "")
  );
}

function addEditMusicExampleRow(label = "", url = "", year = "", perfYear = "") {
  const wrap = $("#ed-me-rows");
  const row = document.createElement("div");
  row.className = "me-row";
  row.innerHTML = `
    <input type="text" class="me-label" placeholder="Tittel" value="${escapeHtml(label)}">
    <input type="number" class="me-year" placeholder="Årstall" min="1800" max="2030" value="${escapeHtml(String(year || ""))}">
    <input type="url" class="me-url" placeholder="https://…" value="${escapeHtml(url)}">
    <input type="number" class="me-perf-year" placeholder="Framf.år" min="1800" max="2030" value="${escapeHtml(String(perfYear || ""))}" title="Året for framføring/konsert (kun hvis annet enn utgivelsesår)">
    <button type="button" class="btn ghost small remove-me">✕</button>
  `;
  row.querySelector(".remove-me").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function buildEditSourceRows(kilder) {
  const wrap = $("#ed-source-rows");
  wrap.innerHTML = "";
  (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addEditSourceRow(k.text || "", k.url || ""));
}

function addEditSourceRow(text = "", url = "") {
  const wrap = $("#ed-source-rows");
  const row = document.createElement("div");
  row.className = "source-row";
  row.innerHTML = `
    <input type="text" class="source-text" placeholder="Kilde …" value="${escapeHtml(text)}">
    <input type="url" class="source-url" placeholder="https://… (valgfritt)" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-source">✕</button>
  `;
  row.querySelector(".remove-source").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function buildEditWorkRows(works) {
  const wrap = $("#ed-work-rows");
  wrap.innerHTML = "";
  (works.length ? works : [{ title: "", year: "", url: "" }])
    .forEach((w) => addEditWorkRow(w.title || "", w.year || "", w.url || ""));
}

function addEditWorkRow(title = "", year = "", url = "") {
  const wrap = $("#ed-work-rows");
  const row = document.createElement("div");
  row.className = "work-row";
  row.innerHTML = `
    <input type="text" class="work-title" placeholder="Tittel" value="${escapeHtml(title)}">
    <input type="number" class="work-year" placeholder="Utgivelsesår" min="1800" max="2030" value="${escapeHtml(String(year || ""))}">
    <input type="url" class="work-url" placeholder="https://… (valgfritt)" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-work">✕</button>
  `;
  row.querySelector(".remove-work").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function collectEditMusicExamples() {
  return [...$("#ed-me-rows").querySelectorAll(".me-row")]
    .map((r) => {
      const label = r.querySelector(".me-label").value.trim();
      const url = r.querySelector(".me-url").value.trim();
      const yearStr = r.querySelector(".me-year").value.trim();
      const perfYearStr = r.querySelector(".me-perf-year").value.trim();
      const out = { label, url };
      const yr = parseInt(yearStr, 10);
      if (Number.isFinite(yr)) out.year = yr;
      const pyr = parseInt(perfYearStr, 10);
      if (Number.isFinite(pyr)) out.performanceYear = pyr;
      return out;
    })
    .filter((m) => m.url);
}

function collectEditSources() {
  return [...$("#ed-source-rows").querySelectorAll(".source-row")]
    .map((r) => ({
      text: r.querySelector(".source-text").value.trim(),
      url: r.querySelector(".source-url").value.trim(),
    }))
    .filter((k) => k.text);
}

function collectEditWorks() {
  return [...$("#ed-work-rows").querySelectorAll(".work-row")]
    .map((r) => {
      const title = r.querySelector(".work-title").value.trim();
      const yearStr = r.querySelector(".work-year").value.trim();
      const url = r.querySelector(".work-url").value.trim();
      const out = { title };
      const yr = parseInt(yearStr, 10);
      if (Number.isFinite(yr)) out.year = yr;
      if (url) out.url = url;
      return out;
    })
    .filter((w) => w.title);
}

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
