import { subscribeArtists, subscribeConfig, subscribeDecades, subscribeSubgenres, voteUp, undoVoteUp, getClientId } from "./store.js";
import { DEFAULT_CONFIG, decadesForRange } from "./limits.js";
import { renderSpotlightCards, renderResultList, renderArtistDetail, renderArtists, fillSelect, escapeHtml } from "./ui.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const clientId = getClientId();

const state = {
  artists: [],
  config: null,
  decadeDescs: {},
  subgenreDescs: {},
  filters: { search: "", genre: "", instrument: "", decade: "", subgenre: "", showRemoved: false },
  isTeacher: false,
  clientId,
};

const handlers = {
  voteUp: (id) => voteUp(id, clientId),
  undoVoteUp: (id) => undoVoteUp(id, clientId),
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
    renderList();
  });
}

function setupExplore() {
  // Koble alle nye modaler til backdrop-klikk og close-knapp
  ["modal-decade-list", "modal-decade-view", "modal-subgenre-list"].forEach((id) => {
    const m = document.getElementById(id);
    if (!m) return;
    m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("open"); });
    m.querySelector(".modal-close").addEventListener("click", () => m.classList.remove("open"));
  });

  // Tilbake-knapp i tiår-visning
  const dvBack = document.getElementById("dv-back");
  if (dvBack) dvBack.addEventListener("click", () => {
    document.getElementById("modal-decade-view").classList.remove("open");
    document.getElementById("modal-decade-list").classList.add("open");
  });

  const btnContext = document.getElementById("btn-context");
  if (btnContext) btnContext.addEventListener("click", openDecadeList);

  const btnGenres = document.getElementById("btn-genres");
  if (btnGenres) btnGenres.addEventListener("click", openSubgenreList);
}

function openDecadeList() {
  const modal = document.getElementById("modal-decade-list");
  if (!modal) return;
  const decades = (state.config?.decades || []).slice().sort((a, b) => a - b);
  const el = document.getElementById("dl-buttons");
  el.innerHTML = decades.map((d) => {
    const desc = state.decadeDescs[String(d)];
    const hasDesc = desc && (desc.society || desc.tech);
    return `<button class="btn ghost decade-list-btn ${hasDesc ? "" : "muted"}" data-decade-view="${d}">${d}-tallet</button>`;
  }).join("");
  el.querySelectorAll("[data-decade-view]").forEach((btn) => {
    btn.addEventListener("click", () => openDecadeView(btn.dataset.decadeView));
  });
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
  modal.classList.add("open");
}

function openDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  const desc = state.decadeDescs[String(decadeId)] || {};
  document.getElementById("dv-title").textContent = `${decadeId}-tallet`;
  const societyEl = document.getElementById("dv-society");
  const techEl = document.getElementById("dv-tech");
  societyEl.textContent = desc.society || "Ingen beskrivelse ennå.";
  societyEl.className = "info-text" + (desc.society ? "" : " muted");
  techEl.textContent = desc.tech || "Ingen beskrivelse ennå.";
  techEl.className = "info-text" + (desc.tech ? "" : " muted");
  document.getElementById("modal-decade-list").classList.remove("open");
  modal.classList.add("open");
}

function openSubgenreList() {
  const modal = document.getElementById("modal-subgenre-list");
  if (!modal) return;
  const allSubs = [...new Set(
    state.artists.filter((a) => a.status === "active").flatMap((a) => a.subgenres || [])
  )].sort((a, b) => a.localeCompare(b, "no"));
  const el = document.getElementById("sl-chips");
  el.innerHTML = allSubs.length
    ? allSubs.map((s) => `<button class="tag tag-sub tag-link" data-subgenre-info="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")
    : `<p class="muted">Ingen sjangere registrert ennå.</p>`;
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
  modal.classList.add("open");
}

function setupDetailModal() {
  const backdrop = document.getElementById("modal-detail");
  if (!backdrop) return;
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });
  backdrop.querySelector(".modal-close").addEventListener("click", () => backdrop.classList.remove("open"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
    }
  });
}

function setupSubgenreInfo() {
  const backdrop = document.getElementById("modal-subgenre-info");
  if (backdrop) {
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });
    backdrop.querySelector(".modal-close").addEventListener("click", () => backdrop.classList.remove("open"));
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-subgenre-info]");
    if (!btn) return;
    e.stopPropagation();
    openSubgenreInfo(btn.dataset.subgenreInfo);
  });
}

function openSubgenreInfo(subgenreId) {
  const modal = document.getElementById("modal-subgenre-info");
  if (!modal) return;

  document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));

  const desc = state.subgenreDescs[subgenreId];
  $("#sgi-title").textContent = subgenreId;
  $("#sgi-desc").textContent = desc?.description || "Ingen beskrivelse ennå.";
  $("#sgi-desc").className = desc?.description ? "" : "muted";

  const artists = state.artists
    .filter(a => a.status === "active" && (a.subgenres || []).includes(subgenreId))
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
          <span class="result-arrow">›</span>
        </div>`).join("")}
      </div>`;
    el.querySelector(".sgi-toggle").addEventListener("click", (e) => {
      const list = el.querySelector(".sgi-list");
      const visible = list.style.display !== "none";
      list.style.display = visible ? "none" : "block";
      e.target.textContent = visible ? `Vis artister (${artists.length})` : "Skjul artister";
    });
    el.querySelectorAll(".sgi-artist-row").forEach((row) => {
      row.addEventListener("click", () => {
        const artist = artists.find(a => a.id === row.dataset.id);
        if (artist) {
          document.getElementById("modal-subgenre-info").classList.remove("open");
          openDetail(artist);
        }
      });
    });
  }

  document.getElementById("modal-subgenre-info").classList.add("open");
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
    if (d && (d.society || d.tech)) {
      let html = `<div class="context-card"><h3>${state.filters.decade}-tallet</h3>`;
      if (d.society) html += `<p><strong>Samfunnsutvikling:</strong> ${escapeHtml(d.society)}</p>`;
      if (d.tech) html += `<p><strong>Teknologiutvikling:</strong> ${escapeHtml(d.tech)}</p>`;
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

// ----------------------------------------------------------------------------
//  Alle forslag — fullstendig liste med stemmefunksjon
// ----------------------------------------------------------------------------

function renderList() {
  if (!state.config) return;
  renderArtists($("#artist-list"), { ...state, handlers });
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
      renderList();
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
  setupSubgenreInfo();
  setupExplore();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshFilterControls();
    renderSpotlight();
    renderList();
    showSetupBanner();
    return;
  }

  loadCache();
  if (state.config && state.artists.length) {
    refreshFilterControls();
    renderSpotlight();
    renderList();
  }

  document.addEventListener("firestore-error", (e) => {
    const banner = $("#banner");
    if (banner) {
      banner.textContent = `⚠️ Kunne ikke laste data fra databasen (${e.detail?.code || "ukjent feil"}). Firestore-reglene tillater trolig ikke lesing uten innlogging. Publiser oppdaterte regler i Firebase Console.`;
      banner.className = "banner banner-error";
      banner.style.display = "block";
    }
  });

  subscribeConfig((config) => {
    state.config = config;
    refreshFilterControls();
    renderSpotlight();
    renderList();
    saveCache();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderSpotlight();
    renderList();
    saveCache();
  });
  subscribeDecades((d) => { state.decadeDescs = d; renderSpotlight(); });
  subscribeSubgenres((s) => { state.subgenreDescs = s; renderSpotlight(); });
}

init();
