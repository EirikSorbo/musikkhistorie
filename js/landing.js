import { subscribeArtists, subscribeConfig } from "./store.js";
import { DEFAULT_CONFIG, decadesForRange } from "./limits.js";
import { renderSpotlightCards, renderResultList, renderArtistDetail, fillSelect } from "./ui.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = {
  artists: [],
  config: null,
  filters: { search: "", genre: "", instrument: "", decade: "" },
};

// ----------------------------------------------------------------------------
//  Detaljmodal
// ----------------------------------------------------------------------------

function openDetail(artist) {
  $("#detail-name").textContent = artist.name;
  renderArtistDetail($("#detail-body"), artist, state.config);
  document.getElementById("modal-detail").classList.add("open");
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
  return !!(f.search || f.genre || f.instrument || f.decade);
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
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    pool = pool.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.geography || "").toLowerCase().includes(q) ||
        (a.subgenres || []).some(s => s.toLowerCase().includes(q))
    );
  }

  const shuffleBtn = $("#sp-shuffle");

  if (hasFilters()) {
    shuffleBtn.style.display = "none";
    renderResultList($("#spotlight"), pool, state.config, openDetail);
  } else {
    shuffleBtn.style.display = "";
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    currentPicks = shuffled.slice(0, 2);
    renderSpotlightCards($("#spotlight"), currentPicks, state.config);
  }
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
//  Oppstart
// ----------------------------------------------------------------------------

function init() {
  setupFilters();
  setupDetailModal();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshFilterControls();
    renderSpotlight();
    showSetupBanner();
    return;
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshFilterControls();
    renderSpotlight();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderSpotlight();
  });
}

init();
