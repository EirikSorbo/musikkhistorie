import { subscribeArtists, subscribeConfig } from "./store.js";
import { DEFAULT_CONFIG, decadesForRange, GENDERS } from "./limits.js";
import { renderSpotlightCards, fillSelect } from "./ui.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = {
  artists: [],
  config: null,
  filters: { search: "", genre: "", instrument: "", decade: "" },
};

// ----------------------------------------------------------------------------
//  Spotlight — to tilfeldige kort fra filtrert pool
// ----------------------------------------------------------------------------

let currentPicks = [];

function renderSpotlight() {
  if (!state.config) return;
  let pool = state.artists.filter((a) => a.status === "active");

  if (state.filters.genre) pool = pool.filter((a) => a.genre === state.filters.genre);
  if (state.filters.instrument) pool = pool.filter((a) => a.instrument === state.filters.instrument);
  if (state.filters.decade) {
    const d = Number(state.filters.decade);
    pool = pool.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(d));
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

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  currentPicks = shuffled.slice(0, 2);
  renderSpotlightCards($("#spotlight"), currentPicks, state.config);
}

function refreshFilterControls() {
  const { config } = state;
  fillSelect($("#sp-genre"), config.genres, { placeholder: "Alle sjangre" });
  fillSelect($("#sp-instrument"), config.instruments || [], { placeholder: "Alle instrumenter" });
  fillSelect(
    $("#sp-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Alle tiår" }
  );
}

function setupFilters() {
  ["sp-search", "sp-genre", "sp-instrument", "sp-decade"].forEach((id) => {
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
//  Render
// ----------------------------------------------------------------------------

function renderAll() {
  if (!state.config) return;
  renderSpotlight();
}

// ----------------------------------------------------------------------------
//  Oppstart
// ----------------------------------------------------------------------------

function init() {
  setupFilters();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshFilterControls();
    renderAll();
    showSetupBanner();
    return;
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshFilterControls();
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderAll();
  });
}

init();
