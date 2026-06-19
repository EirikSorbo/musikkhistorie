import {
  subscribeArtists,
  subscribeConfig,
  subscribeDecades,
  subscribeSubgenres,
  addArtist,
  teacherRemove,
  teacherRestore,
  teacherDelete,
  deleteAllArtists,
  updateConfig,
  updateArtistFields,
  saveDecadeDesc,
  saveSubgenreDesc,
  teacherVeto,
  undoVeto,
  getClientId,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
} from "./store.js";
import { DEFAULT_CONFIG } from "./limits.js";
import { escapeHtml, renderDashboard, renderLimits, renderArtists, fillSelect, buildPlaylistHtml, buildArtistListRows, showSubsjangerInfo, modalOpen, modalClose, modalCloseTop } from "./ui.js?v=163";
import { TEACHER_EMAILS } from "./firebase-config.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";
import { GENEALOGY_GENRES, showSjangerInfo } from "./genealogy.js";

const state = {
  artists: [],
  config: null,
  decadeDescs: {},
  subgenreDescs: {},
  filters: { sjanger: "", genre: "", decade: "", instrument: "", subgenre: "", search: "", showRemoved: true },
  isTeacher: true,
  clientId: getClientId(),
  started: false,
};

const handlers = {
  remove:    (id) => teacherRemove(id),
  restore:   (id) => teacherRestore(id),
  del:       (id) => { if (confirm("Slette dette forslaget permanent?")) teacherDelete(id); },
  edit:      (id) => openEditModal(id),
  veto:      (id) => teacherVeto(id),
  undoVeto:  (id) => undoVeto(id),
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

function openAdminModal(id) {
  const el = document.getElementById(id);
  modalOpen(el);
  if (id === "modal-fyllingsgrad") renderLimits($("#modal-limits"), state);
  if (id === "modal-decade-desc") renderDecadeDescList();
  if (id === "modal-subgenre-desc") renderSubgenreDescList();
}

function closeAdminModal(id) {
  modalClose(document.getElementById(id));
}

function setupModals() {
  document.querySelectorAll("[data-open-modal]").forEach((btn) =>
    btn.addEventListener("click", () => openAdminModal(btn.dataset.openModal))
  );
  document.querySelectorAll(".modal-backdrop").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m) modalClose(m); })
  );
  document.querySelectorAll(".modal-close").forEach((btn) =>
    btn.addEventListener("click", () => modalClose(btn.closest(".modal-backdrop")))
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modalCloseTop();
  });
}

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function renderAll() {
  if (!state.config) return;
  renderDashboard($("#dashboard"), state);
  setupSubgenreListBtn();
  if (document.getElementById("modal-fyllingsgrad").classList.contains("open"))
    renderLimits($("#modal-limits"), state);
  buildDecadeButtons();
  renderList();
}

function setupSubgenreListBtn() {
  const btn = $("#btn-subgenre-list");
  if (!btn) return;
  btn.addEventListener("click", toggleSubgenreExpand);
}

function toggleSubgenreExpand() {
  const dashboard = $("#dashboard");
  let expand = dashboard.querySelector(".subgenre-expand");
  if (expand) { expand.remove(); return; }

  const allSubs = [...new Set(
    state.artists.filter(a => a.status === "active").flatMap(a => [...(a.sjangre || []), ...(a.undersjangre || [])])
  )].sort((a, b) => a.localeCompare(b, "no"));

  if (!allSubs.length) return;

  expand = document.createElement("div");
  expand.className = "subgenre-expand";
  expand.innerHTML = `<h3>Alle undersjangre (${allSubs.length})</h3>
    <div class="subgenre-tag-list">
      ${allSubs.map(s => {
        return `<div class="subgenre-chip">
          <button class="tag tag-sub tag-link" data-subgenre-info="${escapeHtml(s)}">${escapeHtml(s)}</button>
        </div>`;
      }).join("")}
    </div>`;
  dashboard.appendChild(expand);
}

function openSingleSubgenreModal(subgenreId) {
  const desc = state.subgenreDescs[subgenreId] || {};
  $("#subgenre-single-title").textContent = subgenreId;
  $("#ss-desc").value = desc.description || "";
  $("#ss-msg").textContent = "";
  const kilderWrap = $("#ss-kilder-rows");
  if (kilderWrap) {
    kilderWrap.innerHTML = "";
    const kilder = Array.isArray(desc.kilder) ? desc.kilder : [];
    (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addKilderRow(kilderWrap, k.text || "", k.url || "", "ss"));
  }
  $("#modal-subgenre-single").dataset.subgenre = subgenreId;
  openAdminModal("modal-subgenre-single");
}

function setupSubgenreSingleSave() {
  const addKilderBtn = $("#ss-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#ss-kilder-rows"), "", "", "ss"));

  $("#ss-save").addEventListener("click", async () => {
    const modal = $("#modal-subgenre-single");
    const subgenreId = modal.dataset.subgenre;
    const description = $("#ss-desc").value.trim();
    const kilder = collectKilderRows($("#ss-kilder-rows"));
    const msg = $("#ss-msg");
    try {
      await saveSubgenreDesc(subgenreId, { description, kilder });
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";
      setTimeout(() => closeAdminModal("modal-subgenre-single"), 800);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

function setupSubgenreInfo() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-subgenre-info]");
    if (!btn) return;
    e.stopPropagation();
    openSubgenreInfo(btn.dataset.subgenreInfo);
  });
}

function openSubgenreInfo(subgenreId) {
  const desc = state.subgenreDescs[subgenreId];
  $("#sgi-title").textContent = subgenreId;
  $("#sgi-desc").textContent = desc?.description || "Ingen beskrivelse ennå.";
  $("#sgi-desc").className = desc?.description ? "" : "muted";

  const artists = state.artists
    .filter(a => a.status === "active" && ((a.undersjangre || []).includes(subgenreId) || (a.sjangre || []).includes(subgenreId)))
    .sort((a, b) => a.name.localeCompare(b.name, "no"));

  const el = $("#sgi-artists");
  if (!artists.length) {
    el.innerHTML = "";
  } else {
    el.innerHTML = `
      <button class="btn ghost small sgi-toggle" style="margin-top:12px">Vis artister (${artists.length})</button>
      <div class="sgi-list" style="display:none;margin-top:10px">
        ${artists.map(a => `<div class="result-row sgi-artist-row" data-id="${escapeHtml(a.id)}">
          <span class="result-name">${escapeHtml(a.name)}</span>
          <span class="result-meta">
            ${a.genre ? `<span class="tag">${escapeHtml(a.genre)}</span>` : ""}
            ${a.instrument ? `<span class="tag">${escapeHtml(a.instrument)}</span>` : ""}
          </span>
        </div>`).join("")}
      </div>`;
    el.querySelector(".sgi-toggle").addEventListener("click", (e) => {
      const list = el.querySelector(".sgi-list");
      const visible = list.style.display !== "none";
      list.style.display = visible ? "none" : "block";
      e.target.textContent = visible ? `Vis artister (${artists.length})` : "Skjul artister";
    });
  }

  const editBtn = document.getElementById("sgi-edit-btn");
  if (editBtn) {
    editBtn.onclick = () => {
      closeAdminModal("modal-subgenre-info");
      openSingleSubgenreModal(subgenreId);
    };
  }

  openAdminModal("modal-subgenre-info");
}

function buildDecadeButtons() {
  const el = $("#decade-buttons");
  if (!el || !state.config) return;
  const decades = (state.config.decades || []).slice().sort((a, b) => a - b);
  el.innerHTML = decades.map((d) =>
    `<button type="button" class="btn primary small decade-btn" data-decade="${d}">${d}-tallet</button>`
  ).join("");
  el.querySelectorAll(".decade-btn").forEach((btn) => {
    btn.addEventListener("click", () => openSingleDecadeModal(btn.dataset.decade));
  });
}

function openSingleDecadeModal(decadeId) {
  const desc = state.decadeDescs[String(decadeId)] || {};
  const modal = $("#modal-decade-single");
  $("#decade-single-title").textContent = `${decadeId}-tallet`;

  const noText = "Ingen beskrivelse ennå.";
  const societyText = $("#ds-society-text");
  const techText = $("#ds-tech-text");
  societyText.textContent = desc.society || noText;
  societyText.className = "info-text" + (desc.society ? "" : " muted");
  techText.textContent = desc.tech || noText;
  techText.className = "info-text" + (desc.tech ? "" : " muted");

  $("#ds-society").value = desc.society || "";
  $("#ds-tech").value = desc.tech || "";
  $("#ds-society-more").value = desc.societyMore || "";
  $("#ds-tech-more").value = desc.techMore || "";
  buildDecadeKilderRows(desc.kilder || []);
  $("#ds-msg").textContent = "";

  $("#ds-view").style.display = "";
  $("#ds-edit").style.display = "none";

  modal.dataset.decade = decadeId;
  openAdminModal("modal-decade-single");
}

function buildDecadeKilderRows(kilder) {
  const wrap = $("#ds-kilder-rows");
  if (!wrap) return;
  wrap.innerHTML = "";
  (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addKilderRow(wrap, k.text || "", k.url || "", "ds"));
}

function addKilderRow(wrap, text = "", url = "", prefix = "ds") {
  const row = document.createElement("div");
  row.className = "source-row";
  row.innerHTML = `
    <input type="text" class="${prefix}-kilde-text source-text" placeholder="Kilde …" value="${escapeHtml(text)}">
    <input type="url" class="${prefix}-kilde-url source-url" placeholder="https://… (valgfritt)" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-source">✕</button>
  `;
  row.querySelector(".remove-source").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function collectKilderRows(wrap) {
  return [...wrap.querySelectorAll(".source-row")]
    .map((r) => ({
      text: r.querySelector(".source-text").value.trim(),
      url: r.querySelector(".source-url").value.trim(),
    }))
    .filter((k) => k.text);
}

function setupDecadeSingleSave() {
  $("#ds-to-edit").addEventListener("click", () => {
    $("#ds-view").style.display = "none";
    $("#ds-edit").style.display = "";
  });
  const addKilderBtn = $("#ds-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#ds-kilder-rows"), "", "", "ds"));

  $("#ds-save").addEventListener("click", async () => {
    const modal = $("#modal-decade-single");
    const decadeId = modal.dataset.decade;
    const society = $("#ds-society").value.trim();
    const tech = $("#ds-tech").value.trim();
    const societyMore = $("#ds-society-more").value.trim();
    const techMore = $("#ds-tech-more").value.trim();
    const kilder = collectKilderRows($("#ds-kilder-rows"));
    const msg = $("#ds-msg");
    try {
      await saveDecadeDesc(decadeId, { society, tech, societyMore, techMore, kilder });
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";

      const noText = "Ingen beskrivelse ennå.";
      const societyText = $("#ds-society-text");
      const techText = $("#ds-tech-text");
      societyText.textContent = society || noText;
      societyText.className = "info-text" + (society ? "" : " muted");
      techText.textContent = tech || noText;
      techText.className = "info-text" + (tech ? "" : " muted");

      setTimeout(() => {
        $("#ds-view").style.display = "";
        $("#ds-edit").style.display = "none";
        msg.textContent = "";
      }, 800);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

function renderList() {
  renderArtists($("#artist-list"), { ...state, handlers });
}

function refreshControls() {
  const { config } = state;
  fillSelect($("#f-sjanger"), GENEALOGY_GENRES, { placeholder: "Alle sjangre" });
  fillSelect($("#f-genre"), config.genres, { placeholder: "Alle metasjangre" });
  fillSelect(
    $("#f-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Alle tiår" }
  );
  fillSelect($("#f-instrument"), config.instruments || [], { placeholder: "Alle instrumenter" });
  const allSubs = [...new Set(
    (state.artists || []).flatMap((a) => [...(a.sjangre || []), ...(a.undersjangre || [])])
  )].sort((a, b) => a.localeCompare(b, "no"));
  fillSelect($("#f-subgenre"), allSubs, { placeholder: "Alle undersjangre" });
  if (state.filters.sjanger)  $("#f-sjanger").value = state.filters.sjanger;
  if (state.filters.genre)    $("#f-genre").value = state.filters.genre;
  if (state.filters.subgenre) $("#f-subgenre").value = state.filters.subgenre;
}

// ----------------------------------------------------------------------------
//  Filtre
// ----------------------------------------------------------------------------

function setupFilters() {
  $("#f-sjanger").addEventListener("change", (e) => { state.filters.sjanger = e.target.value; renderList(); });
  $("#f-genre").addEventListener("change", (e) => { state.filters.genre = e.target.value; renderList(); });
  $("#f-decade").addEventListener("change", (e) => { state.filters.decade = e.target.value; renderList(); });
  $("#f-instrument").addEventListener("change", (e) => { state.filters.instrument = e.target.value; renderList(); });
  $("#f-subgenre").addEventListener("change", (e) => { state.filters.subgenre = e.target.value; renderList(); });
  $("#f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; renderList(); });
  const showRemoved = $("#f-show-removed");
  showRemoved.checked = state.filters.showRemoved;
  showRemoved.addEventListener("change", (e) => { state.filters.showRemoved = e.target.checked; renderList(); });

  // Klikk på sjanger-/undersjanger-/instrument-bobler i kortene filtrerer lista
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-key]");
    if (!btn) return;
    const key = btn.dataset.filterKey, val = btn.dataset.filterVal;
    const sel = { sjanger: "#f-sjanger", subgenre: "#f-subgenre", instrument: "#f-instrument", genre: "#f-genre" }[key];
    if (!sel) return;
    state.filters[key] = val;
    const elSel = $(sel);
    if (elSel) elSel.value = val;
    renderList();
  });
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

function showPlaylistForGenre({ label, fullName, node }) {
  const { total, html } = buildPlaylistHtml(node, state.artists);
  document.getElementById("pl-title").textContent = `${fullName} — spilleliste (${total})`;
  document.getElementById("pl-body").innerHTML = html;
  modalOpen(document.getElementById("modal-spilleliste"));
}

function showArtistsForInstrument(instrument) {
  const list = state.artists
    .filter((a) => a.status === "active" && a.instrument === instrument)
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));
  document.getElementById("al-title").textContent = `${instrument} (${list.length})`;
  const body = document.getElementById("al-body");
  body.innerHTML = list.length
    ? `<div class="result-list">${buildArtistListRows(list)}</div>`
    : `<p class="muted empty">Ingen forslag med dette instrumentet ennå.</p>`;
  modalOpen(document.getElementById("modal-artistliste"));
}

function showArtistsForSjanger({ label }) {
  const sj = label.toLowerCase();
  const list = state.artists
    .filter((a) => a.status === "active" && (
      a.genre === label
      || (a.sjangre || []).some((s) => s.toLowerCase() === sj)
      || (a.undersjangre || []).some((s) => s.toLowerCase() === sj)
    ))
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));
  document.getElementById("al-title").textContent = `${label} (${list.length})`;
  const body = document.getElementById("al-body");
  body.innerHTML = list.length
    ? `<div class="result-list">${buildArtistListRows(list)}</div>`
    : `<p class="muted empty">Ingen forslag i denne sjangeren ennå.</p>`;
  modalOpen(document.getElementById("modal-artistliste"));
}

function setupSjangerModal() {
  const sjangerOpts = () => ({
    root: document,
    subgenreDescs: state.subgenreDescs,
    onShowArtists: showArtistsForSjanger,
    onShowPlaylist: showPlaylistForGenre,
  });
  document.addEventListener("click", (e) => {
    const sjBtn = e.target.closest("[data-sjanger]");
    if (sjBtn) {
      showSjangerInfo(sjBtn.dataset.sjanger, sjangerOpts());
      return;
    }
    const underBtn = e.target.closest("[data-under]");
    if (underBtn) {
      showSubsjangerInfo(underBtn.dataset.under, sjangerOpts());
      return;
    }
    const inst = e.target.closest("[data-instrument]");
    if (inst) showArtistsForInstrument(inst.dataset.instrument);
  });
}

function startApp() {
  state.started = true;
  setupFilters();
  setupSjangerModal();
  setupAdmin();
  setupDataButtons();
  setupImportChoice();
  setupEditForm();
  setupDecadeSingleSave();
  setupSubgenreSingleSave();
  setupSubgenreInfo();

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
    refreshControls();
    renderAll();
  });
  subscribeDecades((d) => { state.decadeDescs = d; });
  subscribeSubgenres((s) => { state.subgenreDescs = s; });
}

// ----------------------------------------------------------------------------
//  Import / Eksport / Merge
// ----------------------------------------------------------------------------

const EXPORT_FIELDS = [
  "name", "birthYear", "deathYear", "gender", "genre", "instrument",
  "sjangre", "undersjangre", "influenceStart", "influenceEnd", "geography",
  "description", "keyWorks", "links", "kilder",
  "imageUrl", "imageCredit", "proposedBy",
];

const MERGE_LABELS = {
  birthYear: "Fødselsår", deathYear: "Dødsår", gender: "Kjønn",
  genre: "Metasjanger", instrument: "Instrument",
  sjangre: "Sjangre", undersjangre: "Undersjangre",
  influenceStart: "Innflytelse fra", influenceEnd: "Innflytelse til",
  geography: "Geografi", description: "Beskrivelse",
  keyWorks: "Sentrale verk", links: "Lenker", kilder: "Kilder",
  imageUrl: "Bilde-URL", imageCredit: "Bildekreditering",
};

const COMPARE_FIELDS = Object.keys(MERGE_LABELS);

const mergeState = { queue: [], newArtists: [], index: 0 };

function setupDataButtons() {
  $("#btn-export").addEventListener("click", handleExport);

  const importInput = $("#input-import");
  $("#btn-import").addEventListener("click", () => { importInput.value = ""; importInput.click(); });
  importInput.addEventListener("change", (e) => handleImportFile(e.target.files[0]));

  $("#btn-nuke").addEventListener("click", async () => {
    if (!confirm("Er du HELT sikker? Dette sletter ALL artistdata permanent. Handlingen kan ikke angres.")) return;
    if (!confirm("Siste sjanse — skriv OK i neste boks for å bekrefte.")) return;
    try {
      await deleteAllArtists();
      alert("All data er slettet.");
    } catch (err) {
      alert("Feil ved sletting: " + err.message);
    }
  });

  $("#merge-keep-all").addEventListener("click", () => bulkMerge("existing"));
  $("#merge-use-all").addEventListener("click",  () => bulkMerge("imported"));
  $("#merge-next").addEventListener("click", advanceMerge);
}

// --- Eksport ---

function handleExport() {
  const artists = state.artists
    .filter((a) => a.status === "active")
    .map((a) => Object.fromEntries(EXPORT_FIELDS.map((f) => [f, a[f] ?? null])));

  const decades = {};
  for (const [id, d] of Object.entries(state.decadeDescs)) {
    if (d.society || d.tech) decades[id] = { society: d.society || "", tech: d.tech || "" };
  }

  const subgenres = {};
  for (const [id, s] of Object.entries(state.subgenreDescs)) {
    if (s.description) subgenres[id] = { description: s.description };
  }

  const data = { artists, decades, subgenres };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `musikkhistorie-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Import (velg erstatt eller slå sammen via modal) ---

let pendingImportData = null;

async function handleImportFile(file) {
  if (!file) return;
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { alert("Ugyldig JSON-fil."); return; }

  let artists, decades, subgenres;
  if (Array.isArray(raw)) {
    artists = raw;
    decades = {};
    subgenres = {};
  } else if (raw && typeof raw === "object" && Array.isArray(raw.artists)) {
    artists = raw.artists;
    decades = raw.decades || {};
    subgenres = raw.subgenres || {};
  } else {
    alert("Ugyldig format — filen må være en array eller et objekt med «artists»."); return;
  }

  pendingImportData = { artists, decades, subgenres };
  const parts = [];
  const artistCount = artists.filter(a => a.name).length;
  if (artistCount) parts.push(`${artistCount} artister`);
  const decadeCount = Object.keys(decades).length;
  if (decadeCount) parts.push(`${decadeCount} tiårsbeskrivelser`);
  const subCount = Object.keys(subgenres).length;
  if (subCount) parts.push(`${subCount} sjangerbeskrivelser`);
  $("#import-choice-desc").textContent = `Filen inneholder ${parts.join(", ")}.`;
  openAdminModal("modal-import-choice");
}

function setupImportChoice() {
  $("#import-replace").addEventListener("click", async () => {
    closeAdminModal("modal-import-choice");
    if (pendingImportData) {
      await handleReplace(pendingImportData.artists);
      await importDescriptions(pendingImportData);
    }
    pendingImportData = null;
  });
  $("#import-merge").addEventListener("click", async () => {
    closeAdminModal("modal-import-choice");
    if (pendingImportData) {
      await handleMergeFile(pendingImportData.artists);
      await importDescriptions(pendingImportData);
    }
    pendingImportData = null;
  });
}

async function importDescriptions({ decades, subgenres }) {
  let ok = 0, fail = 0;
  for (const [id, data] of Object.entries(decades || {})) {
    if (data.society || data.tech) {
      try { await saveDecadeDesc(id, data); ok++; }
      catch (e) { fail++; console.error("Tiår-import feilet for", id, e); }
    }
  }
  for (const [id, data] of Object.entries(subgenres || {})) {
    if (data.description) {
      try { await saveSubgenreDesc(id, data); ok++; }
      catch (e) { fail++; console.error("Sjanger-import feilet for", id, e); }
    }
  }
  if (fail > 0) {
    alert(`${fail} beskrivelse(r) kunne ikke lagres.\n\nSannsynlig årsak: Firestore-reglene tillater ikke skriving til 'subgenres' eller 'decades'.\n\nGå til Firebase Console → Firestore → Rules og publiser oppdaterte regler.`);
  } else if (ok > 0) {
    alert(`${ok} beskrivelse(r) importert.`);
  }
}

async function handleReplace(data) {
  if (!confirm("Dette sletter ALLE eksisterende artister og erstatter med filen. Er du sikker?")) return;
  let deleted = 0;
  for (const a of state.artists) {
    await teacherDelete(a.id);
    deleted++;
  }
  let added = 0, failed = 0;
  for (const a of data) {
    if (!a.name) continue;
    try {
      await addArtist({ proposedBy: "Eirik Sørbø", ...a });
      added++;
    } catch (err) {
      failed++;
      console.error("Import feilet for", a.name, err);
    }
  }
  const parts = [`${deleted} slettet`, `${added} importert`];
  if (failed) parts.push(`${failed} mislyktes`);
  alert(parts.join(", ") + ".");
}

// --- Merge (sjekker duplikater, viser konflikter) ---

async function handleMergeFile(data) {
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

    const autoFill = {};
    const conflicts = [];
    for (const f of COMPARE_FIELDS) {
      const ev = existing[f] ?? null;
      const iv = imp[f] ?? null;
      if (JSON.stringify(ev) === JSON.stringify(iv)) continue;
      const existingEmpty = ev === null || ev === "" || (Array.isArray(ev) && !ev.length);
      const importedEmpty = iv === null || iv === "" || (Array.isArray(iv) && !iv.length);
      if (existingEmpty && !importedEmpty) {
        autoFill[f] = iv;
      } else if (!importedEmpty) {
        conflicts.push({ field: f, existing: ev, imported: iv });
      }
    }
    if (Object.keys(autoFill).length || conflicts.length) {
      mergeState.queue.push({ existing, imported: imp, conflicts, resolved: { ...autoFill } });
    }
  }

  const hasConflicts = mergeState.queue.some(item => item.conflicts.length > 0);

  if (!mergeState.queue.length && !mergeState.newArtists.length) {
    alert("Ingen endringer å flette inn."); return;
  }
  if (!hasConflicts) { await finishMerge(); return; }

  mergeState.index = mergeState.queue.findIndex(item => item.conflicts.length > 0);
  openAdminModal("modal-merge");
  renderMergeConflict();
}

function renderMergeConflict() {
  const { queue, index } = mergeState;
  const item = queue[index];

  const conflictItems = queue.filter(i => i.conflicts.length > 0);
  const conflictIdx = conflictItems.indexOf(item) + 1;
  $("#merge-title").textContent    = item.existing.name;
  $("#merge-progress").textContent = `Konflikt ${conflictIdx} av ${conflictItems.length}`;

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
  let next = mergeState.index + 1;
  while (next < mergeState.queue.length && !mergeState.queue[next].conflicts.length) next++;
  if (next < mergeState.queue.length) {
    mergeState.index = next;
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
  closeAdminModal("modal-merge");
  let added = 0, updated = 0;

  for (const a of mergeState.newArtists) {
    await addArtist({ proposedBy: "Eirik Sørbø", ...a });
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

// ----------------------------------------------------------------------------
//  Rediger artist
// ----------------------------------------------------------------------------

function openEditModal(artistId) {
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
  $("#ed-sjangre").value = (a.sjangre || []).join(", ");
  $("#ed-undersjangre").value = (a.undersjangre || []).join(", ");
  $("#ed-desc").value = a.description || "";
  $("#ed-by").value = a.proposedBy || "";
  $("#ed-image-url").value = a.imageUrl || "";
  $("#ed-image-credit").value = a.imageCredit || "";

  fillSelect($("#ed-gender"), GENDERS_EDIT, { placeholder: "Velg kjønn …" });
  $("#ed-gender").value = a.gender || "";
  fillSelect($("#ed-genre"), c.genres, { placeholder: "Velg sjanger …" });
  $("#ed-genre").value = a.genre || "";
  fillSelect($("#ed-instrument"), c.instruments || [], { placeholder: "Ingen / ukjent" });
  $("#ed-instrument").value = a.instrument || "";

  buildEditLinkRows(a.links || []);
  buildEditWorkRows(a.keyWorks || []);
  buildEditSourceRows(a.kilder || []);

  $("#ed-msg").textContent = "";
  openAdminModal("modal-edit");
}

function buildEditLinkRows(links) {
  const wrap = $("#ed-link-rows");
  wrap.innerHTML = "";
  (links.length ? links : [{ label: "", url: "" }]).forEach(({ label = "", url = "" }) =>
    addEditLinkRow(label, url)
  );
}

function addEditLinkRow(label = "", url = "") {
  const wrap = $("#ed-link-rows");
  const row = document.createElement("div");
  row.className = "link-row";
  row.innerHTML = `
    <input type="text" class="link-label" placeholder="Tittel" value="${escapeHtml(label)}">
    <input type="url" class="link-url" placeholder="https://…" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-link">✕</button>
  `;
  row.querySelector(".remove-link").addEventListener("click", () => row.remove());
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
  (works.length ? works : [{ title: "", year: "", recordingYear: "", url: "" }])
    .forEach((w) => addEditWorkRow(w.title || "", w.year || "", w.recordingYear || "", w.url || ""));
}

function addEditWorkRow(title = "", year = "", recordingYear = "", url = "") {
  const wrap = $("#ed-work-rows");
  const row = document.createElement("div");
  row.className = "work-row";
  row.innerHTML = `
    <input type="text" class="work-title" placeholder="Tittel" value="${escapeHtml(title)}">
    <input type="number" class="work-year" placeholder="Utgivelsesår" min="1800" max="2030" value="${escapeHtml(String(year || ""))}">
    <input type="number" class="work-recording-year" placeholder="Opptaksår" min="1800" max="2030" value="${escapeHtml(String(recordingYear || ""))}" title="Året opptaket/konserten ble holdt (hvis annerledes enn utgivelsesår)">
    <input type="url" class="work-url" placeholder="https://… (valgfritt)" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-work">✕</button>
  `;
  row.querySelector(".remove-work").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function collectEditLinks() {
  return [...$("#ed-link-rows").querySelectorAll(".link-row")]
    .map((r) => ({ label: r.querySelector(".link-label").value.trim(), url: r.querySelector(".link-url").value.trim() }))
    .filter((l) => l.url);
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
      const recYearStr = r.querySelector(".work-recording-year")?.value.trim();
      const url = r.querySelector(".work-url").value.trim();
      const out = { title };
      const yr = parseInt(yearStr, 10);
      if (Number.isFinite(yr)) out.year = yr;
      const recYr = parseInt(recYearStr, 10);
      if (Number.isFinite(recYr)) out.recordingYear = recYr;
      if (url) out.url = url;
      return out;
    })
    .filter((w) => w.title);
}

function setupEditForm() {
  if (!$("#edit-form")) return;
  $("#ed-add-link").addEventListener("click", () => addEditLinkRow());
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
      genre:         $("#ed-genre").value,
      instrument:    $("#ed-instrument").value,
      sjangre:       $("#ed-sjangre").value.split(",").map(s => s.trim()).filter(Boolean),
      undersjangre:  $("#ed-undersjangre").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#ed-start").value, 10) || null,
      influenceEnd:   parseInt($("#ed-end").value, 10) || null,
      geography:     $("#ed-geo").value.trim(),
      description:   $("#ed-desc").value.trim(),
      keyWorks:      collectEditWorks(),
      links:         collectEditLinks(),
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

const GENDERS_EDIT = [
  { value: "kvinne", label: "Kvinne" },
  { value: "mann", label: "Mann" },
  { value: "annet", label: "Annet / ikke-binær" },
  { value: "ukjent", label: "Ukjent" },
];

// ----------------------------------------------------------------------------
//  Tiårs- og undersjangerbeskrivelser
// ----------------------------------------------------------------------------

function renderDecadeDescList() {
  const el = $("#decade-desc-list");
  const decades = (state.config?.decades || []).slice().sort((a, b) => a - b);
  if (!decades.length) { el.innerHTML = `<p class="muted">Ingen tiår definert i innstillingene.</p>`; return; }

  el.innerHTML = decades.map((d) => {
    const desc = state.decadeDescs[String(d)] || {};
    return `
      <div class="desc-edit-item" data-decade="${d}">
        <h3>${d}-tallet</h3>
        <label>Samfunnsutvikling
          <textarea class="dd-society" rows="3" placeholder="Beskriv samfunnsutvikling for ${d}-tallet …">${escapeHtml(desc.society || "")}</textarea>
        </label>
        <label>Teknologiutvikling
          <textarea class="dd-tech" rows="3" placeholder="Beskriv teknologiutvikling for ${d}-tallet …">${escapeHtml(desc.tech || "")}</textarea>
        </label>
        <div class="desc-edit-actions">
          <button type="button" class="btn primary small dd-save">Lagre</button>
          <span class="dd-msg form-msg ok"></span>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll(".dd-save").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".desc-edit-item");
      const decadeId = item.dataset.decade;
      const society = item.querySelector(".dd-society").value.trim();
      const tech = item.querySelector(".dd-tech").value.trim();
      const msg = item.querySelector(".dd-msg");
      try {
        await saveDecadeDesc(decadeId, { society, tech });
        msg.textContent = "Lagret ✓";
        setTimeout(() => (msg.textContent = ""), 2500);
      } catch (err) {
        msg.textContent = "Feil: " + err.message;
        msg.className = "form-msg error";
      }
    });
  });
}

function renderSubgenreDescList() {
  const el = $("#subgenre-desc-list");
  const allSubs = [...new Set(
    state.artists.filter(a => a.status === "active")
      .flatMap(a => [...(a.sjangre || []), ...(a.undersjangre || [])])
  )].sort((a, b) => a.localeCompare(b, "no"));

  if (!allSubs.length) { el.innerHTML = `<p class="muted">Ingen undersjangre registrert blant artistene.</p>`; return; }

  el.innerHTML = allSubs.map((s) => {
    const desc = state.subgenreDescs[s] || {};
    return `
      <div class="desc-edit-item" data-subgenre="${escapeHtml(s)}">
        <h3>${escapeHtml(s)}</h3>
        <label>Beskrivelse
          <textarea class="sg-desc" rows="3" placeholder="Beskriv ${s} …">${escapeHtml(desc.description || "")}</textarea>
        </label>
        <div class="desc-edit-actions">
          <button type="button" class="btn primary small sg-save">Lagre</button>
          <span class="sg-msg form-msg ok"></span>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll(".sg-save").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".desc-edit-item");
      const subgenreId = item.dataset.subgenre;
      const description = item.querySelector(".sg-desc").value.trim();
      const msg = item.querySelector(".sg-msg");
      try {
        await saveSubgenreDesc(subgenreId, { description });
        msg.textContent = "Lagret ✓";
        setTimeout(() => (msg.textContent = ""), 2500);
      } catch (err) {
        msg.textContent = "Feil: " + err.message;
        msg.className = "form-msg error";
      }
    });
  });
}

setupGate();
