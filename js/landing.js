import { subscribeArtists, subscribeConfig, subscribeDecades, subscribeSubgenres } from "./store.js";
import { DEFAULT_CONFIG, decadesForRange } from "./limits.js";
import { renderSpotlightCards, renderResultList, renderArtistDetail, fillSelect, escapeHtml } from "./ui.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = {
  artists: [],
  config: null,
  decadeDescs: {},
  subgenreDescs: {},
  filters: { search: "", genre: "", instrument: "", decade: "", subgenre: "" },
};

// ----------------------------------------------------------------------------
//  Detaljmodal
// ----------------------------------------------------------------------------

function openDetail(artist) {
  $("#detail-name").textContent = artist.name;
  renderArtistDetail($("#detail-body"), artist, state.config);
  document.getElementById("modal-detail").classList.add("open");
}

function setupTagFilters() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-key]");
    if (!btn) return;
    const key = btn.dataset.filterKey;
    const val = btn.dataset.filterVal;
    document.getElementById("modal-detail").classList.remove("open");
    // Reset alle filtre før nytt filter settes
    state.filters = { search: "", genre: "", instrument: "", decade: "", subgenre: "" };
    $("#sp-search").value = "";
    $("#sp-genre").value = "";
    $("#sp-instrument").value = "";
    $("#sp-decade").value = "";
    $("#sp-subgenre").value = "";
    if (key === "genre") {
      state.filters.genre = val;
      $("#sp-genre").value = val;
    } else if (key === "instrument") {
      state.filters.instrument = val;
      $("#sp-instrument").value = val;
    } else if (key === "search") {
      state.filters.search = val;
      $("#sp-search").value = val;
    }
    renderSpotlight();
  });
}

function setupDetailModal() {
  const backdrop = document.getElementById("modal-detail");
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });
  backdrop.querySelector(".modal-close").addEventListener("click", () => backdrop.classList.remove("open"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") backdrop.classList.remove("open");
  });
}

// ----------------------------------------------------------------------------
//  Spotlight / listevisning
// ----------------------------------------------------------------------------

function hasFilters() {
  const f = state.filters;
  return !!(f.search || f.genre || f.instrument || f.decade || f.subgenre);
}

let currentPicks = [];

function renderSpotlight() {
  if (!state.config) return;
  let pool = state.artists.filter((a) => a.status === "active");

  if (state.filters.genre)      pool = pool.filter((a) => a.genre === state.filters.genre);
  if (state.filters.instrument) pool = pool.filter((a) => a.instrument === state.filters.instrument);
  if (state.filters.decade) {
    const d = Number(state.filters.decade);
    pool = pool.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(d));
  }
  if (state.filters.subgenre) {
    const sg = state.filters.subgenre;
    pool = pool.filter((a) => (a.subgenres || []).includes(sg));
  }
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    pool = pool.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.geography || "").toLowerCase().includes(q) ||
        (a.subgenres || []).some(s => s.toLowerCase().includes(q))
    );
  }

  const spotlightHeader = $(".spotlight-header");

  if (hasFilters()) {
    if (spotlightHeader) spotlightHeader.style.display = "none";
    renderResultList($("#spotlight"), pool, state.config, openDetail);
    renderContextBox();
  } else {
    if (spotlightHeader) spotlightHeader.style.display = "";
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    currentPicks = shuffled.slice(0, 1);
    renderSpotlightCards($("#spotlight"), currentPicks, state.config);
    clearContextBox();
  }
}

function getContextBox() {
  let box = document.getElementById("context-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "context-box";
    box.className = "context-box";
    const spotlight = $("#spotlight");
    spotlight.parentNode.insertBefore(box, spotlight);
  }
  return box;
}

function clearContextBox() {
  const box = document.getElementById("context-box");
  if (box) box.innerHTML = "";
}

function renderContextBox() {
  const box = getContextBox();
  const parts = [];

  if (state.filters.decade) {
    const d = state.decadeDescs[state.filters.decade];
    if (d && (d.society || d.music)) {
      let html = `<div class="context-card"><h3>${state.filters.decade}-tallet</h3>`;
      if (d.society) html += `<p><strong>Samfunn og teknologi:</strong> ${escapeHtml(d.society)}</p>`;
      if (d.music) html += `<p><strong>Musikkutvikling:</strong> ${escapeHtml(d.music)}</p>`;
      html += `</div>`;
      parts.push(html);
    }
  }

  if (state.filters.subgenre) {
    const s = state.subgenreDescs[state.filters.subgenre];
    if (s && s.description) {
      parts.push(`<div class="context-card"><h3>${escapeHtml(state.filters.subgenre)}</h3><p>${escapeHtml(s.description)}</p></div>`);
    }
  }

  box.innerHTML = parts.join("");
}

function refreshFilterControls() {
  const { config } = state;
  fillSelect($("#sp-genre"), config.genres, { placeholder: "Sjanger" });
  fillSelect($("#sp-instrument"), config.instruments || [], { placeholder: "Instrument" });
  fillSelect(
    $("#sp-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Tiår" }
  );
  const allSubs = [...new Set(
    state.artists.filter(a => a.status === "active")
      .flatMap(a => a.subgenres || [])
  )].sort((a, b) => a.localeCompare(b, "no"));
  fillSelect($("#sp-subgenre"), allSubs, { placeholder: "Underkategori" });
}

function setupFilters() {
  ["sp-search", "sp-genre", "sp-instrument", "sp-decade", "sp-subgenre"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(id === "sp-search" ? "input" : "change", (e) => {
      const key = id.replace("sp-", "");
      state.filters[key] = e.target.value;
      renderSpotlight();
    });
  });
  $("#sp-shuffle").addEventListener("click", renderSpotlight);
}

// ----------------------------------------------------------------------------
//  Cache — vis umiddelbart, oppdater fra Firebase i bakgrunnen
// ----------------------------------------------------------------------------

const CACHE_ARTISTS = "pensum_cache_artists";
const CACHE_CONFIG  = "pensum_cache_config";

function saveCache() {
  try {
    localStorage.setItem(CACHE_ARTISTS, JSON.stringify(state.artists));
    if (state.config) localStorage.setItem(CACHE_CONFIG, JSON.stringify(state.config));
  } catch { /* full storage, ignorer */ }
}

function loadCache() {
  try {
    const a = localStorage.getItem(CACHE_ARTISTS);
    const c = localStorage.getItem(CACHE_CONFIG);
    if (a) state.artists = JSON.parse(a);
    if (c) state.config = JSON.parse(c);
  } catch { /* korrupt cache, ignorer */ }
}

// ----------------------------------------------------------------------------
//  Oppstart
// ----------------------------------------------------------------------------

function init() {
  setupFilters();
  setupTagFilters();
  setupDetailModal();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshFilterControls();
    renderSpotlight();
    showSetupBanner();
    return;
  }

  loadCache();
  if (state.config && state.artists.length) {
    refreshFilterControls();
    renderSpotlight();
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshFilterControls();
    renderSpotlight();
    saveCache();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderSpotlight();
    saveCache();
  });
  subscribeDecades((d) => { state.decadeDescs = d; renderSpotlight(); });
  subscribeSubgenres((s) => { state.subgenreDescs = s; renderSpotlight(); });
}

init();
