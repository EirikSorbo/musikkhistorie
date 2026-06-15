import {
  subscribeArtists,
  subscribeConfig,
  addArtist,
  teacherRemove,
  teacherRestore,
  teacherDelete,
  updateConfig,
  updateArtistFields,
  getClientId,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
} from "./store.js";
import { DEFAULT_CONFIG } from "./limits.js";
import { escapeHtml, renderDashboard, renderLimits, renderArtists, fillSelect } from "./ui.js";
import { TEACHER_EMAILS } from "./firebase-config.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = {
  artists: [],
  config: null,
  filters: { genre: "", decade: "", instrument: "", search: "", showRemoved: true },
  isTeacher: true,
  clientId: getClientId(),
  started: false,
};

const handlers = {
  remove: (id) => teacherRemove(id),
  restore: (id) => teacherRestore(id),
  del: (id) => {
    if (confirm("Slette dette forslaget permanent?")) teacherDelete(id);
  },
};

// ----------------------------------------------------------------------------
//  Innlogging
// ----------------------------------------------------------------------------

let signedInNotTeacher = false;

function setupGate() {
  const msg = $("#gate-msg");
  const signinBtn = $("#google-signin");

  signinBtn.addEventListener("click", () => {
    if (signedInNotTeacher) { signOutTeacher(); return; }
    signInWithGoogle().catch((e) => {
      if (e.code !== "auth/popup-closed-by-user")
        msg.textContent = "Innlogging mislyktes: " + e.message;
    });
  });

  $("#logout").addEventListener("click", () => signOutTeacher());

  onAuthChange((user) => {
    if (user && TEACHER_EMAILS.includes(user.email)) {
      signedInNotTeacher = false;
      msg.textContent = "";
      document.body.classList.add("is-teacher");
      if (!state.started) startApp();
    } else if (user) {
      signedInNotTeacher = true;
      document.body.classList.remove("is-teacher");
      msg.textContent = `Kontoen ${user.email} har ikke lærertilgang.`;
      signinBtn.textContent = "Logg ut og prøv en annen konto";
    } else {
      signedInNotTeacher = false;
      document.body.classList.remove("is-teacher");
      msg.textContent = "";
      signinBtn.textContent = "Logg inn med Google";
    }
  });
}

// ----------------------------------------------------------------------------
//  Modaler
// ----------------------------------------------------------------------------

function openModal(id) {
  document.getElementById(id).classList.add("open");
  if (id === "modal-fyllingsgrad") renderLimits($("#modal-limits"), state);
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

function setupModals() {
  document.querySelectorAll("[data-open-modal]").forEach((btn) =>
    btn.addEventListener("click", () => openModal(btn.dataset.openModal))
  );
  document.querySelectorAll(".modal-backdrop").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); })
  );
  document.querySelectorAll(".modal-close").forEach((btn) =>
    btn.addEventListener("click", () => closeModal(btn.closest(".modal-backdrop").id))
  );
  // ESC-tast lukker åpen modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document.querySelectorAll(".modal-backdrop.open").forEach((m) => closeModal(m.id));
  });
}

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function renderAll() {
  if (!state.config) return;
  renderDashboard($("#dashboard"), state);
  // Oppdater fyllingsgrad-modal hvis den er åpen
  if (document.getElementById("modal-fyllingsgrad").classList.contains("open"))
    renderLimits($("#modal-limits"), state);
  renderList();
}

function renderList() {
  renderArtists($("#artist-list"), { ...state, handlers });
}

function refreshControls() {
  const { config } = state;
  fillSelect($("#f-genre"), config.genres, { placeholder: "Alle sjangre" });
  fillSelect(
    $("#f-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Alle tiår" }
  );
  fillSelect($("#f-instrument"), config.instruments || [], { placeholder: "Alle instrumenter" });
}

// ----------------------------------------------------------------------------
//  Filtre
// ----------------------------------------------------------------------------

function setupFilters() {
  $("#f-genre").addEventListener("change", (e) => { state.filters.genre = e.target.value; renderList(); });
  $("#f-decade").addEventListener("change", (e) => { state.filters.decade = e.target.value; renderList(); });
  $("#f-instrument").addEventListener("change", (e) => { state.filters.instrument = e.target.value; renderList(); });
  $("#f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; renderList(); });
  const showRemoved = $("#f-show-removed");
  showRemoved.checked = state.filters.showRemoved;
  showRemoved.addEventListener("change", (e) => { state.filters.showRemoved = e.target.checked; renderList(); });
}

// ----------------------------------------------------------------------------
//  Admin — grenser
// ----------------------------------------------------------------------------

function setupAdmin() {
  setupModals();

  // Rebuild limit-grids når lister/standarder endres
  $("#mdec-decades").addEventListener("input", buildDecadeLimits);
  $("#mdec-default").addEventListener("input", buildDecadeLimits);
  $("#mgen-genres").addEventListener("input", buildGenreLimits);
  $("#mgen-default").addEventListener("input", buildGenreLimits);
  $("#minstr-instruments").addEventListener("input", buildInstrumentLimits);
  $("#minstr-default").addEventListener("input", buildInstrumentLimits);

  // Lagre-knapper
  $("#save-general").addEventListener("click", () => saveSection("general"));
  $("#save-decade").addEventListener("click", () => saveSection("decade"));
  $("#save-genre").addEventListener("click", () => saveSection("genre"));
  $("#save-instrument").addEventListener("click", () => saveSection("instrument"));
}

async function saveSection(section) {
  const msgEl = $(`#msg-${section}`);
  let updates = {};

  if (section === "general") {
    updates = {
      maxTotal: int($("#cfg-total").value, state.config.maxTotal),
      voteOutThreshold: int($("#cfg-threshold").value, state.config.voteOutThreshold),
    };
  } else if (section === "decade") {
    updates = {
      maxPerDecade: int($("#mdec-default").value, state.config.maxPerDecade),
      decades: splitList($("#mdec-decades").value, state.config.decades).map(Number),
      decadeLimits: collectLimitMap("#mdec-limits", "data-decade"),
    };
  } else if (section === "genre") {
    updates = {
      maxPerGenre: int($("#mgen-default").value, state.config.maxPerGenre),
      genres: splitList($("#mgen-genres").value, state.config.genres),
      genreLimits: collectLimitMap("#mgen-limits", "data-genre"),
    };
  } else if (section === "instrument") {
    updates = {
      maxPerInstrument: int($("#minstr-default").value, state.config.maxPerInstrument),
      instruments: splitList($("#minstr-instruments").value, state.config.instruments || []),
      instrumentLimits: collectLimitMap("#minstr-limits", "data-instrument"),
    };
  }

  if (!CONFIGURED) { msgEl.textContent = "Firebase ikke koblet til."; return; }
  await updateConfig({ ...state.config, ...updates });
  msgEl.textContent = "Lagret ✓";
  setTimeout(() => (msgEl.textContent = ""), 2500);
}

function fillAdminForm() {
  const c = state.config;
  $("#cfg-total").value = c.maxTotal;
  $("#cfg-threshold").value = c.voteOutThreshold;
  $("#mdec-default").value = c.maxPerDecade;
  $("#mdec-decades").value = c.decades.join(", ");
  $("#mgen-default").value = c.maxPerGenre;
  $("#mgen-genres").value = c.genres.join(", ");
  $("#minstr-default").value = c.maxPerInstrument;
  $("#minstr-instruments").value = (c.instruments || []).join(", ");
  buildDecadeLimits();
  buildGenreLimits();
  buildInstrumentLimits();
}

function buildDecadeLimits() {
  const decades = splitList($("#mdec-decades").value, state.config.decades).map(Number);
  const def = int($("#mdec-default").value, state.config.maxPerDecade);
  renderLimitInputs(
    $("#mdec-limits"), "data-decade",
    decades.map((d) => ({ key: d, label: `${d}-tallet`, explicit: state.config.decadeLimits?.[d] })),
    def
  );
}

function buildGenreLimits() {
  const genres = splitList($("#mgen-genres").value, state.config.genres);
  const def = int($("#mgen-default").value, state.config.maxPerGenre);
  renderLimitInputs(
    $("#mgen-limits"), "data-genre",
    genres.map((g) => ({ key: g, label: g, explicit: state.config.genreLimits?.[g] })),
    def
  );
}

function buildInstrumentLimits() {
  const instruments = splitList($("#minstr-instruments").value, state.config.instruments || []);
  const def = int($("#minstr-default").value, state.config.maxPerInstrument);
  renderLimitInputs(
    $("#minstr-limits"), "data-instrument",
    instruments.map((i) => ({ key: i, label: i, explicit: state.config.instrumentLimits?.[i] })),
    def
  );
}

function renderLimitInputs(container, attr, items, placeholder) {
  const prev = {};
  container.querySelectorAll("input").forEach((inp) => {
    if (inp.value !== "") prev[inp.getAttribute(attr)] = inp.value;
  });
  container.innerHTML = items
    .map((it) => {
      const stored = Number.isFinite(it.explicit) ? it.explicit : "";
      const value = prev[it.key] ?? stored;
      return `
        <label class="limit-input">
          <span>${escapeHtml(it.label)}</span>
          <input type="number" min="1" ${attr}="${escapeHtml(String(it.key))}"
                 placeholder="${placeholder}" value="${value}">
        </label>`;
    })
    .join("");
}

function collectLimitMap(containerSel, attr) {
  const map = {};
  $(containerSel).querySelectorAll(`input[${attr}]`).forEach((inp) => {
    const key = inp.getAttribute(attr);
    const val = parseInt(inp.value, 10);
    if (Number.isFinite(val) && val >= 1) map[key] = val;
  });
  return map;
}

// ----------------------------------------------------------------------------
//  Hjelpere + oppstart
// ----------------------------------------------------------------------------

function int(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function splitList(v, fallback) {
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : fallback;
}

function startApp() {
  state.started = true;
  setupFilters();
  setupAdmin();
  setupDataButtons();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshControls();
    fillAdminForm();
    renderAll();
    showSetupBanner();
    return;
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshControls();
    fillAdminForm();
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderAll();
  });
}

// ----------------------------------------------------------------------------
//  Import / Eksport / Merge
// ----------------------------------------------------------------------------

const EXPORT_FIELDS = [
  "name", "birthYear", "deathYear", "gender", "genre", "instrument",
  "subgenres", "influenceStart", "influenceEnd", "geography",
  "description", "keyWorks", "links", "kilder", "proposedBy",
];

const MERGE_LABELS = {
  birthYear: "Fødselsår", deathYear: "Dødsår", gender: "Kjønn",
  genre: "Sjanger", instrument: "Instrument", subgenres: "Undersjangre",
  influenceStart: "Innflytelse fra", influenceEnd: "Innflytelse til",
  geography: "Geografi", description: "Beskrivelse",
  keyWorks: "Sentrale verk", links: "Lenker", kilder: "Kilder",
};

const COMPARE_FIELDS = Object.keys(MERGE_LABELS);

const mergeState = { queue: [], newArtists: [], index: 0 };

function setupDataButtons() {
  $("#btn-export").addEventListener("click", handleExport);

  const importInput = $("#input-import");
  const mergeInput  = $("#input-merge");

  $("#btn-import").addEventListener("click", () => { importInput.value = ""; importInput.click(); });
  $("#btn-merge").addEventListener("click",  () => { mergeInput.value  = ""; mergeInput.click(); });

  importInput.addEventListener("change", (e) => handleImportFile(e.target.files[0]));
  mergeInput.addEventListener("change",  (e) => handleMergeFile(e.target.files[0]));

  $("#merge-keep-all").addEventListener("click", () => bulkMerge("existing"));
  $("#merge-use-all").addEventListener("click",  () => bulkMerge("imported"));
  $("#merge-next").addEventListener("click", advanceMerge);
}

// --- Eksport ---

function handleExport() {
  const data = state.artists
    .filter((a) => a.status === "active")
    .map((a) => Object.fromEntries(EXPORT_FIELDS.map((f) => [f, a[f] ?? null])));

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `musikkhistorie-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Import (uten sjekk for duplikater) ---

async function handleImportFile(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { alert("Ugyldig JSON-fil."); return; }
  if (!Array.isArray(data)) { alert("Filen må inneholde en JSON-array."); return; }

  let added = 0;
  for (const a of data) {
    if (!a.name) continue;
    await addArtist({ proposedBy: "Import", ...a });
    added++;
  }
  alert(`${added} artister lagt til.`);
}

// --- Merge (sjekker duplikater, viser konflikter) ---

async function handleMergeFile(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { alert("Ugyldig JSON-fil."); return; }
  if (!Array.isArray(data)) { alert("Filen må inneholde en JSON-array."); return; }

  mergeState.queue      = [];
  mergeState.newArtists = [];
  mergeState.index      = 0;

  for (const imp of data) {
    if (!imp.name) continue;
    const existing = state.artists.find(
      (a) => a.status === "active" &&
              a.name.trim().toLowerCase() === imp.name.trim().toLowerCase()
    );
    if (!existing) { mergeState.newArtists.push(imp); continue; }

    const conflicts = COMPARE_FIELDS
      .filter((f) => JSON.stringify(existing[f] ?? null) !== JSON.stringify(imp[f] ?? null))
      .map((f) => ({ field: f, existing: existing[f], imported: imp[f] }));

    if (conflicts.length) mergeState.queue.push({ existing, imported: imp, conflicts, resolved: {} });
  }

  if (!mergeState.queue.length && !mergeState.newArtists.length) {
    alert("Ingen endringer å flette inn."); return;
  }
  if (!mergeState.queue.length) { await finishMerge(); return; }

  openModal("modal-merge");
  renderMergeConflict();
}

function renderMergeConflict() {
  const { queue, index } = mergeState;
  const item = queue[index];

  $("#merge-title").textContent    = item.existing.name;
  $("#merge-progress").textContent = `Konflikt ${index + 1} av ${queue.length}`;

  $("#merge-fields").innerHTML = item.conflicts.map((c) => {
    const n = `cf-${c.field}`;
    return `
      <div class="conflict-row">
        <div class="conflict-field-name">${MERGE_LABELS[c.field] || c.field}</div>
        <label class="conflict-opt">
          <input type="radio" name="${n}" value="existing" checked>
          <span class="conflict-val"><strong>Behold:</strong> ${escapeHtml(fmtVal(c.existing))}</span>
        </label>
        <label class="conflict-opt">
          <input type="radio" name="${n}" value="imported">
          <span class="conflict-val new"><strong>Importer:</strong> ${escapeHtml(fmtVal(c.imported))}</span>
        </label>
      </div>`;
  }).join("");

  $("#merge-next").textContent = index === queue.length - 1 ? "Fullfør" : "Neste →";
}

function fmtVal(v) {
  if (v === null || v === undefined) return "(tom)";
  if (Array.isArray(v)) {
    if (!v.length) return "(tom)";
    return v.map((i) => (typeof i === "object" ? i.label || JSON.stringify(i) : i)).join(", ");
  }
  return String(v);
}

function collectCurrentChoices() {
  const item = mergeState.queue[mergeState.index];
  item.conflicts.forEach((c) => {
    const radio = document.querySelector(`input[name="cf-${c.field}"]:checked`);
    item.resolved[c.field] = radio?.value === "imported" ? c.imported : c.existing;
  });
}

async function advanceMerge() {
  collectCurrentChoices();
  if (mergeState.index < mergeState.queue.length - 1) {
    mergeState.index++;
    renderMergeConflict();
  } else {
    await finishMerge();
  }
}

async function bulkMerge(choice) {
  collectCurrentChoices();
  for (let i = mergeState.index; i < mergeState.queue.length; i++) {
    const item = mergeState.queue[i];
    item.conflicts.forEach((c) => {
      item.resolved[c.field] = choice === "imported" ? c.imported : c.existing;
    });
  }
  await finishMerge();
}

async function finishMerge() {
  closeModal("modal-merge");
  let added = 0, updated = 0;

  for (const a of mergeState.newArtists) {
    await addArtist({ proposedBy: "Import", ...a });
    added++;
  }
  for (const item of mergeState.queue) {
    if (Object.keys(item.resolved).length) {
      await updateArtistFields(item.existing.id, item.resolved);
      updated++;
    }
  }

  const parts = [];
  if (added)   parts.push(`${added} nye artister lagt til`);
  if (updated) parts.push(`${updated} artister oppdatert`);
  if (parts.length) alert(parts.join(", ") + ".");
}

setupGate();
