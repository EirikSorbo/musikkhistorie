import { subscribeArtists, subscribeConfig, subscribeDecades, subscribeSubgenres, subscribePodcasts, subscribeTech, voteUp, undoVoteUp, getClientId } from "./store.js";
import { DEFAULT_CONFIG, decadesForRange } from "./limits.js";
import { renderSpotlightCards, renderResultList, renderArtistDetail, renderArtists, fillSelect, escapeHtml, formatInfoText, buildPlaylistHtml, buildArtistListRows, modalOpen, modalClose, modalCloseTop, buildGenreList } from "./ui.js?v=220";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";
import { GENEALOGY_GENRES, renderGenealogy } from "./genealogy.js";
import { initExplore } from "./explore.js?v=220";

const clientId = getClientId();

const state = {
  artists: [],
  config: null,
  decadeDescs: {},
  subgenreDescs: {},
  podcasts: [],
  techItems: [],
  filters: { search: "", sjanger: "", genre: "", instrument: "", decade: "", showRemoved: false, priority: 0 },
  isTeacher: false,
  clientId,
};

const handlers = {
  voteUp: (id) => voteUp(id, clientId),
  undoVoteUp: (id) => undoVoteUp(id, clientId),
};

let explore = null;

function openDetail(artist) {
  $("#detail-name").textContent = artist.name;
  renderArtistDetail($("#detail-body"), artist, state.config, explore.buildLinkCtx());
  modalOpen(document.getElementById("modal-detail"));
}

function setupTagFilters() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-key]");
    if (!btn) return;
    const key = btn.dataset.filterKey;
    const val = btn.dataset.filterVal;
    document.getElementById("modal-detail").classList.remove("open");
    state.filters = { search: "", sjanger: "", genre: "", instrument: "", decade: "", priority: 0 };
    $("#sp-search").value = "";
    $("#sp-sjanger").value = "";
    $("#sp-genre").value = "";
    $("#sp-instrument").value = "";
    $("#sp-decade").value = "";
    if (key === "sjanger") {
      state.filters.sjanger = val;
      $("#sp-sjanger").value = val;
    } else if (key === "genre") {
      state.filters.genre = val;
      $("#sp-genre").value = val;
    } else if (key === "instrument") {
      state.filters.instrument = val;
      $("#sp-instrument").value = val;
    } else if (key === "search") {
      state.filters.search = val;
      $("#sp-search").value = val;
    }
    renderFilterResults();
    renderList();
    modalOpen(document.getElementById("modal-artister"));
  });
}

function setupExplore() {
  explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onSlektstre: openSlektstre,
  });

  const btnSociety = document.getElementById("btn-society");
  if (btnSociety) btnSociety.addEventListener("click", () => explore.openDecadeList("society"));
  const btnTech = document.getElementById("btn-tech");
  if (btnTech) btnTech.addEventListener("click", () => explore.openDecadeList("tech"));
  const btnGenres = document.getElementById("btn-genres");
  if (btnGenres) btnGenres.addEventListener("click", explore.openSubgenreList);
  const btnPodkast = document.getElementById("btn-podkast");
  if (btnPodkast) btnPodkast.addEventListener("click", explore.openPodkast);

  const btnDagens = document.getElementById("btn-dagens-navn");
  if (btnDagens) btnDagens.addEventListener("click", openDagensNavn);

  const btnArtister = document.getElementById("btn-artister");
  if (btnArtister) btnArtister.addEventListener("click", () => {
    modalOpen(document.getElementById("modal-artister"));
    document.getElementById("sp-search")?.focus();
  });

  const artisterModal = document.getElementById("modal-artister");
  if (artisterModal) {
    artisterModal.addEventListener("click", (e) => { if (e.target === artisterModal) modalClose(artisterModal); });
    artisterModal.querySelector(".modal-close").addEventListener("click", () => modalClose(artisterModal));
  }

  const dagensModal = document.getElementById("modal-dagens-navn");
  if (dagensModal) {
    dagensModal.addEventListener("click", (e) => { if (e.target === dagensModal) modalClose(dagensModal); });
    dagensModal.querySelector(".modal-close").addEventListener("click", () => modalClose(dagensModal));
  }
}

let gxApi = null;
function openSlektstre() {
  const modal = document.getElementById("modal-slektstre");
  if (!modal) return;
  modalOpen(modal);
  if (!gxApi) {
    gxApi = renderGenealogy({
      root: document,
      subgenreDescs: state.subgenreDescs,
      getArtists: () => state.artists,
      getTechItems: () => state.techItems,
      getGenres: () => buildGenreList(state.artists),
      onArtistClick: openDetail,
      onTechClick: explore.openTechDetail,
      onGenreClick: explore.onGenreClick,
      onShowArtists: explore.showArtistsForSjanger,
      onShowPlaylist: explore.showPlaylistForGenre,
    });
  }
  requestAnimationFrame(() => gxApi.fit());
}

function applyIncomingFilter() {
  const params = new URLSearchParams(location.search);
  const sj = params.get("sjanger"), g = params.get("genre"),
        inst = params.get("instrument"), artistId = params.get("artist");
  if (!sj && !g && !inst && !artistId) return;
  state.filters.sjanger = sj || "";
  state.filters.genre = g || "";
  state.filters.instrument = inst || "";
  const tryApply = () => {
    if (!state.config || !state.artists.length) return false;
    if (sj) $("#sp-sjanger").value = sj;
    if (g) $("#sp-genre").value = g;
    if (inst) $("#sp-instrument").value = inst;
    renderFilterResults();
    renderList();
    if (artistId) {
      const a = state.artists.find((x) => x.id === artistId);
      if (a) { openDetail(a); return true; }
    }
    modalOpen(document.getElementById("modal-artister"));
    return true;
  };
  if (!tryApply()) {
    const iv = setInterval(() => { if (tryApply()) clearInterval(iv); }, 150);
    setTimeout(() => clearInterval(iv), 5000);
  }
}

function setupDetailModal() {
  const backdrop = document.getElementById("modal-detail");
  if (!backdrop) return;
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) modalClose(backdrop); });
  backdrop.querySelector(".modal-close").addEventListener("click", () => modalClose(backdrop));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modalCloseTop();
  });
}

function openDagensNavn() {
  renderSpotlight();
  modalOpen(document.getElementById("modal-dagens-navn"));
}

// ----------------------------------------------------------------------------
//  Spotlight / listevisning
// ----------------------------------------------------------------------------

function hasFilters() {
  const f = state.filters;
  return !!(f.search || f.sjanger || f.genre || f.instrument || f.decade);
}

let currentPicks = [];

function renderSpotlight() {
  if (!state.config) return;
  const pool = state.artists.filter((a) => a.status === "active");
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  currentPicks = shuffled.slice(0, 1);
  renderSpotlightCards($("#spotlight"), currentPicks, state.config, explore.buildLinkCtx());
}

let dagensArtistId = null;
function renderDagensArtist() {
  if (!state.config) return;
  const pool = state.artists.filter((a) => a.status === "active");
  if (!pool.length) return;
  if (!dagensArtistId) dagensArtistId = pool[Math.floor(Math.random() * pool.length)].id;
  const artist = pool.find((a) => a.id === dagensArtistId) || pool[0];
  const section = document.getElementById("dagens-artist-section");
  if (section) section.style.display = "";
  renderSpotlightCards($("#dagens-artist"), [artist], state.config, explore.buildLinkCtx());
}

function renderFilterResults() {
  if (!state.config) return;
  const el = document.getElementById("filter-results");
  if (!el) return;

  if (!hasFilters()) {
    el.innerHTML = "";
    clearContextBox();
    return;
  }

  let pool = state.artists.filter((a) => a.status === "active");

  if (state.filters.sjanger) {
    const sj = state.filters.sjanger.toLowerCase();
    pool = pool.filter((a) => a.genre === state.filters.sjanger
      || (a.sjangre || []).some((s) => s.toLowerCase() === sj)
      || (a.undersjangre || []).some((s) => s.toLowerCase() === sj));
  }
  if (state.filters.genre)      pool = pool.filter((a) => a.genre === state.filters.genre);
  if (state.filters.instrument) pool = pool.filter((a) => a.instrument === state.filters.instrument);
  if (state.filters.decade) {
    const d = Number(state.filters.decade);
    pool = pool.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(d));
  }
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    const qn = q.replace(/[.\-]/g, "");
    pool = pool.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.name.toLowerCase().replace(/[.\-]/g, "").includes(qn) ||
        (a.geography || "").toLowerCase().includes(q) ||
        (a.sjangre || []).some(s => s.toLowerCase().includes(q)) ||
        (a.undersjangre || []).some(s => s.toLowerCase().includes(q))
    );
  }

  renderResultList(el, pool, state.config, openDetail);
  renderContextBox();
}

function getContextBox() {
  let box = document.getElementById("context-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "context-box";
    box.className = "context-box";
    const filterResults = document.getElementById("filter-results");
    filterResults.parentNode.insertBefore(box, filterResults);
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
    if (d && (d.society || d.tech)) {
      let html = `<div class="context-card"><h3>${state.filters.decade}-tallet</h3>`;
      if (d.society) html += `<div><strong>Samfunnsutvikling:</strong>${formatInfoText(d.society)}</div>`;
      if (d.tech) html += `<div><strong>Teknologiutvikling:</strong>${formatInfoText(d.tech)}</div>`;
      html += `</div>`;
      parts.push(html);
    }
  }

  box.innerHTML = parts.join("");
}

// ----------------------------------------------------------------------------
//  Alle forslag
// ----------------------------------------------------------------------------

function renderList() {
  if (!state.config) return;
  renderArtists($("#artist-list"), { ...state, handlers, linkCtx: explore.buildLinkCtx() });
}

function refreshFilterControls() {
  const { config } = state;
  fillSelect($("#sp-sjanger"), GENEALOGY_GENRES, { placeholder: "Sjanger" });
  const GENRE_SHORT = { "Afroamerikansk populærmusikk": "Populærmusikk", "Elektronisk musikk": "Elektronisk" };
  fillSelect($("#sp-genre"), config.genres.map(g => ({ value: g, label: GENRE_SHORT[g] || g })), { placeholder: "Metasjanger" });
  fillSelect($("#sp-instrument"), config.instruments || [], { placeholder: "Instrument" });
  fillSelect(
    $("#sp-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Tiår" }
  );
  if (state.filters.sjanger)  $("#sp-sjanger").value = state.filters.sjanger;
  if (state.filters.genre)    $("#sp-genre").value = state.filters.genre;
}

function updatePrioButtons() {
  document.querySelectorAll("#sp-prio-bar .prio-filter-btn").forEach((btn) => {
    const p = parseInt(btn.dataset.prio, 10);
    btn.className = `prio-filter-btn${state.filters.priority === p ? ` active-${p}` : ""}`;
  });
}

function setupFilters() {
  ["sp-search", "sp-sjanger", "sp-genre", "sp-instrument", "sp-decade"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(id === "sp-search" ? "input" : "change", (e) => {
      const key = id.replace("sp-", "");
      state.filters[key] = e.target.value;
      renderFilterResults();
      renderList();
    });
  });
  document.querySelectorAll("#sp-prio-bar .prio-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.prio, 10);
      state.filters.priority = state.filters.priority === p ? 0 : p;
      updatePrioButtons();
      renderFilterResults();
      renderList();
    });
  });
  $("#sp-shuffle").addEventListener("click", renderSpotlight);
}

// ----------------------------------------------------------------------------
//  Cache
// ----------------------------------------------------------------------------

const CACHE_ARTISTS = "pensum_cache_artists";
const CACHE_CONFIG  = "pensum_cache_config";

function saveCache() {
  try {
    localStorage.setItem(CACHE_ARTISTS, JSON.stringify(state.artists));
    if (state.config) localStorage.setItem(CACHE_CONFIG, JSON.stringify(state.config));
  } catch { /* full storage */ }
}

function loadCache() {
  try {
    const a = localStorage.getItem(CACHE_ARTISTS);
    const c = localStorage.getItem(CACHE_CONFIG);
    if (a) state.artists = JSON.parse(a);
    if (c) state.config = JSON.parse(c);
  } catch { /* corrupt cache */ }
}

// ----------------------------------------------------------------------------
//  Oppstart
// ----------------------------------------------------------------------------

function init() {
  setupFilters();
  setupTagFilters();
  setupDetailModal();
  setupExplore();

  // Slektstre-modal
  const slektsModal = document.getElementById("modal-slektstre");
  if (slektsModal) {
    slektsModal.addEventListener("click", (e) => { if (e.target === slektsModal) modalClose(slektsModal); });
    slektsModal.querySelector(".modal-close").addEventListener("click", () => modalClose(slektsModal));
  }

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshFilterControls();
    renderList();
    showSetupBanner();
    return;
  }

  loadCache();
  if (state.config && state.artists.length) {
    refreshFilterControls();
    renderList();
    renderDagensArtist();
  }

  document.addEventListener("firestore-error", (e) => {
    const banner = $("#banner");
    if (banner) {
      banner.textContent = `Kunne ikke laste data fra databasen (${e.detail?.code || "ukjent feil"}). Firestore-reglene tillater trolig ikke lesing uten innlogging. Publiser oppdaterte regler i Firebase Console.`;
      banner.className = "banner banner-error";
      banner.style.display = "block";
    }
  });

  subscribeConfig((config) => {
    state.config = config;
    refreshFilterControls();
    renderFilterResults();
    renderList();
    saveCache();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderFilterResults();
    renderList();
    renderDagensArtist();
    saveCache();
  });
  subscribeDecades((d) => { state.decadeDescs = d; renderFilterResults(); });
  subscribeSubgenres((s) => { state.subgenreDescs = s; renderFilterResults(); });
  subscribePodcasts((pods) => { state.podcasts = pods; });
  subscribeTech((items) => { state.techItems = items; });

  applyIncomingFilter();
}

// Rollevelger
(function roleGate() {
  const role = localStorage.getItem("pensum-role");
  const gate = document.getElementById("role-gate");

  function applyRole(r) {
    if (r === "student") document.body.classList.add("role-student");
    if (gate) gate.classList.add("hidden");
  }

  if (role) {
    applyRole(role);
    init();
    return;
  }

  if (!gate) { init(); return; }

  document.getElementById("role-student")?.addEventListener("click", () => {
    localStorage.setItem("pensum-role", "student");
    applyRole("student");
    init();
  });
  document.getElementById("role-teacher")?.addEventListener("click", () => {
    localStorage.setItem("pensum-role", "teacher");
    applyRole("teacher");
    window.location.href = "teacher.html";
  });
})();
