import { subscribeArtists, subscribeConfig, subscribeDecades, subscribeSubgenres, subscribePodcasts, subscribeTech, voteUp, undoVoteUp, getClientId } from "./store.js";
import { DEFAULT_CONFIG, decadesForRange } from "./limits.js";
import { renderSpotlightCards, renderResultList, renderArtistDetail, renderArtists, renderTechList, renderTechDetail, TECH_CATEGORIES, fillSelect, escapeHtml, formatInfoText, buildTimeline, buildTechTimeline, buildPlaylistHtml, buildArtistListRows, showSubsjangerInfo, modalOpen, modalClose, modalCloseTop, buildKilderList, buildGenreList } from "./ui.js?v=207";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";
import { GENEALOGY_GENRES, showSjangerInfo, renderGenealogy } from "./genealogy.js";

const clientId = getClientId();

const state = {
  artists: [],
  config: null,
  decadeDescs: {},
  subgenreDescs: {},
  podcasts: [],
  techItems: [],
  filters: { search: "", sjanger: "", genre: "", instrument: "", decade: "", showRemoved: false },
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
  renderArtistDetail($("#detail-body"), artist, state.config, buildLc());
  modalOpen(document.getElementById("modal-detail"));
}

function showPlaylistForGenre({ label, fullName, node }) {
  const { total, html } = buildPlaylistHtml(node, state.artists);
  document.getElementById("pl-title").textContent = `${fullName} — spilleliste (${total})`;
  document.getElementById("pl-body").innerHTML = html;
  modalOpen(document.getElementById("modal-spilleliste"));
}

function showArtistsForGenre({ label }) {
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
  if (!list.length) {
    body.innerHTML = `<p class="muted empty">Ingen forslag i denne sjangeren ennå.</p>`;
  } else {
    body.innerHTML = `<div class="result-list">${buildArtistListRows(list)}</div>`;
    body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const a = list.find((x) => x.id === row.dataset.artistId);
        if (a) openDetail(a);
      });
    });
  }
  modalOpen(document.getElementById("modal-artistliste"));
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
  body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
    const open = () => {
      const a = list.find((x) => x.id === row.dataset.artistId);
      if (a) openDetail(a);
    };
    row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
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
  body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
    const open = () => {
      const a = list.find((x) => x.id === row.dataset.artistId);
      if (a) openDetail(a);
    };
    row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  modalOpen(document.getElementById("modal-artistliste"));
}

function setupSjangerModal() {
  const sj = document.getElementById("modal-sjanger");
  const pl = document.getElementById("modal-spilleliste");
  const al = document.getElementById("modal-artistliste");
  if (!sj || !pl) return;
  sj.addEventListener("click", (e) => { if (e.target === sj) modalClose(sj); });
  sj.querySelector(".modal-close").addEventListener("click", () => modalClose(sj));
  pl.addEventListener("click", (e) => { if (e.target === pl) modalClose(pl); });
  pl.querySelector(".modal-close").addEventListener("click", () => modalClose(pl));
  if (al) {
    al.addEventListener("click", (e) => { if (e.target === al) modalClose(al); });
    al.querySelector(".modal-close").addEventListener("click", () => modalClose(al));
  }
  const sjangerOpts = () => ({
    root: document,
    subgenreDescs: state.subgenreDescs,
    artists: state.artists,
    techItems: state.techItems,
    genres: buildGenreList(state.artists),
    onArtistClick: openDetail,
    onTechClick: openTechDetail,
    onGenreClick,
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

function setupTagFilters() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-key]");
    if (!btn) return;
    const key = btn.dataset.filterKey;
    const val = btn.dataset.filterVal;
    document.getElementById("modal-detail").classList.remove("open");
    // Reset alle filtre før nytt filter settes
    state.filters = { search: "", sjanger: "", genre: "", instrument: "", decade: "" };
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
  ["modal-decade-list", "modal-decade-view", "modal-subgenre-list", "modal-decade-more", "modal-slektstre"].forEach((id) => {
    const m = document.getElementById(id);
    if (!m) return;
    m.addEventListener("click", (e) => { if (e.target === m) modalClose(m); });
    m.querySelector(".modal-close").addEventListener("click", () => modalClose(m));
  });

  const dvBack = document.getElementById("dv-back");
  if (dvBack) dvBack.addEventListener("click", () => {
    modalClose(document.getElementById("modal-decade-view"));
    modalOpen(document.getElementById("modal-decade-list"));
  });

  const btnSociety = document.getElementById("btn-society");
  if (btnSociety) btnSociety.addEventListener("click", () => openDecadeList("society"));
  const btnTech = document.getElementById("btn-tech");
  if (btnTech) btnTech.addEventListener("click", () => openDecadeList("tech"));

  const btnGenres = document.getElementById("btn-genres");
  if (btnGenres) btnGenres.addEventListener("click", openSubgenreList);

  // Fane-veksling sjangre / undersjangre
  document.querySelectorAll(".genre-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".genre-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const isSjangre = tab.dataset.genreTab === "sjangre";
      document.getElementById("sl-chips").style.display = isSjangre ? "" : "none";
      document.getElementById("ul-chips").style.display = isSjangre ? "none" : "";
      document.getElementById("sl-hint").textContent = isSjangre
        ? "Trykk på en sjanger for å lese beskrivelsen."
        : "Trykk på en undersjanger for å lese beskrivelsen.";
    });
  });

  // Slektstre-knapp
  const btnSlektstre = document.getElementById("btn-slektstre");
  if (btnSlektstre) btnSlektstre.addEventListener("click", openSlektstre);

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

  const btnPodkast = document.getElementById("btn-podkast");
  if (btnPodkast) btnPodkast.addEventListener("click", openPodkast);

  const podkastModal = document.getElementById("modal-podkast");
  if (podkastModal) {
    podkastModal.addEventListener("click", (e) => { if (e.target === podkastModal) modalClose(podkastModal); });
    podkastModal.querySelector(".modal-close").addEventListener("click", () => modalClose(podkastModal));
  }

  const btnTeknologi = document.getElementById("btn-teknologi");
  if (btnTeknologi) btnTeknologi.addEventListener("click", openTeknologi);

  const tekModal = document.getElementById("modal-teknologi");
  if (tekModal) {
    tekModal.addEventListener("click", (e) => { if (e.target === tekModal) modalClose(tekModal); });
    tekModal.querySelector(".modal-close").addEventListener("click", () => modalClose(tekModal));
    tekModal.querySelectorAll(".tech-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        tekModal.querySelectorAll(".tech-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderTeknologiList(btn.dataset.techCat || "");
      });
    });
  }
}

// Filter sendt fra slektstre-siden (index.html?genre=… / ?subgenre=…):
// vent til data er lastet, sett filter og scroll til artistlista.
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

let contextMode = "society";

function openDecadeList(mode) {
  contextMode = mode;
  const modal = document.getElementById("modal-decade-list");
  if (!modal) return;
  modal.querySelector(".modal-head h2").textContent = mode === "society" ? "Samfunn" : "Teknologi";
  const decades = (state.config?.decades || []).slice().sort((a, b) => a - b);
  const el = document.getElementById("dl-buttons");
  el.innerHTML = decades.map((d) => {
    const desc = state.decadeDescs[String(d)];
    const hasDesc = mode === "society" ? desc && desc.society : desc && desc.tech;
    return `<button class="btn ghost decade-list-btn ${hasDesc ? "" : "muted"}" data-decade-view="${d}">${d}-tallet</button>`;
  }).join("");
  el.querySelectorAll("[data-decade-view]").forEach((btn) => {
    btn.addEventListener("click", () => openDecadeView(btn.dataset.decadeView));
  });
  modalOpen(modal);
}

function openDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  const desc = state.decadeDescs[String(decadeId)] || {};
  const isSociety = contextMode === "society";
  document.getElementById("dv-title").textContent = `${decadeId}-tallet — ${isSociety ? "samfunn" : "teknologi"}`;

  const societySection = document.getElementById("dv-society-section");
  const techSection = document.getElementById("dv-tech-section");
  if (societySection) societySection.style.display = isSociety ? "" : "none";
  if (techSection) techSection.style.display = isSociety ? "none" : "";

  const societyEl = document.getElementById("dv-society");
  const techEl = document.getElementById("dv-tech");
  societyEl.innerHTML = desc.society ? formatInfoText(desc.society) : "Ingen beskrivelse ennå.";
  societyEl.className = "info-text" + (desc.society ? "" : " muted");
  techEl.innerHTML = desc.tech ? formatInfoText(desc.tech) : "Ingen beskrivelse ennå.";
  techEl.className = "info-text" + (desc.tech ? "" : " muted");

  const stl = document.getElementById("dv-society-timeline");
  if (stl) stl.innerHTML = buildTimeline(desc.society, decadeId);
  const ttl = document.getElementById("dv-tech-timeline");
  if (ttl) {
    ttl.innerHTML = buildTechTimeline(state.techItems, decadeId);
    ttl.querySelectorAll("[data-tech-id]").forEach(el => {
      el.addEventListener("click", () => {
        const t = state.techItems.find(x => x.id === el.dataset.techId);
        if (t) openTechDetail(t);
      });
    });
  }

  const moreSociety = document.getElementById("dv-society-more");
  const moreTech = document.getElementById("dv-tech-more");
  if (moreSociety) {
    moreSociety.style.display = desc.societyMore && isSociety ? "" : "none";
    moreSociety.onclick = () => openDecadeMore(`${decadeId}-tallet — samfunnsutvikling`, desc.societyMore);
  }
  if (moreTech) {
    moreTech.style.display = desc.techMore && !isSociety ? "" : "none";
    moreTech.onclick = () => openDecadeMore(`${decadeId}-tallet — teknologiutvikling`, desc.techMore);
  }

  const kilderEl = document.getElementById("dv-kilder");
  if (kilderEl) kilderEl.innerHTML = buildKilderList(desc.kilder, "Kilder");

  modalClose(document.getElementById("modal-decade-list"));
  modalOpen(modal);
}

function openDecadeMore(title, text) {
  const modal = document.getElementById("modal-decade-more");
  if (!modal) return;
  document.getElementById("dm-title").textContent = title;
  document.getElementById("dm-text").innerHTML = formatInfoText(text);
  modalOpen(modal);
}

function openDagensNavn() {
  renderSpotlight();
  modalOpen(document.getElementById("modal-dagens-navn"));
}

function openPodkast() {
  renderPodkastList();
  modalOpen(document.getElementById("modal-podkast"));
}

function renderPodkastList() {
  const el = document.getElementById("podkast-list");
  if (!el) return;
  if (!state.podcasts.length) {
    el.innerHTML = `<p class="muted empty" style="background:#fff">Episodene publiseres fortløpende etter hvert som studentgruppene leverer sine bidrag.</p>`;
    return;
  }
  el.innerHTML = state.podcasts.map((ep) => {
    const duration = ep.duration ? `<span class="podkast-duration">${escapeHtml(ep.duration)}</span>` : "";
    const desc = ep.description ? `<p class="podkast-desc">${escapeHtml(ep.description)}</p>` : "";
    return `
      <article class="podkast-episode">
        <div class="podkast-header">
          <h3 class="podkast-title">${escapeHtml(ep.title || "Uten tittel")}</h3>
          ${duration}
        </div>
        ${desc}
        ${ep.audioUrl ? `<audio controls preload="none" src="${escapeHtml(ep.audioUrl)}"></audio>` : ""}
      </article>`;
  }).join("");
}

function openTeknologi() {
  renderTeknologiList("");
  const modal = document.getElementById("modal-teknologi");
  modal.querySelectorAll(".tech-tab").forEach(b => b.classList.toggle("active", !b.dataset.techCat));
  modalOpen(modal);
}

function onGenreClick(genre) {
  const opts = {
    root: document,
    subgenreDescs: state.subgenreDescs,
    artists: state.artists,
    techItems: state.techItems,
    genres: buildGenreList(state.artists),
    onArtistClick: openDetail,
    onTechClick: openTechDetail,
    onGenreClick,
    onShowArtists: showArtistsForSjanger,
    onShowPlaylist: showPlaylistForGenre,
  };
  showSjangerInfo(genre, opts) || showSubsjangerInfo(genre, opts);
}

function buildLc() {
  return {
    artists: state.artists,
    techItems: state.techItems,
    genres: buildGenreList(state.artists),
    onArtistClick: openDetail,
    onTechClick: openTechDetail,
    onGenreClick,
  };
}

function openTechDetail(t) {
  document.getElementById("td-title").textContent = t.name;
  renderTechDetail(document.getElementById("td-body"), t, buildLc());
  modalOpen(document.getElementById("modal-tech-detail"));
}

function renderTeknologiList(category) {
  const el = document.getElementById("tech-list");
  if (!el) return;
  renderTechList(el, state.techItems, category || "", buildLc());
}

function openSubgenreList() {
  const modal = document.getElementById("modal-subgenre-list");
  if (!modal) return;
  const sjangerSet = new Set(GENEALOGY_GENRES.map(g => g.toLowerCase()));
  const active = state.artists.filter((a) => a.status === "active");

  // Sjangre-fane
  const sjangre = [...new Set(active.flatMap(a => (a.sjangre || []).filter(s => sjangerSet.has(s.toLowerCase()))))]
    .sort((a, b) => a.localeCompare(b, "no"));
  const slEl = document.getElementById("sl-chips");
  slEl.innerHTML = sjangre.length
    ? sjangre.map((s) => `<button class="tag tag-sjanger" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")
    : `<p class="muted">Ingen sjangere registrert ennå.</p>`;

  // Undersjangre-fane
  const under = [...new Set(active.flatMap(a => [
    ...(a.sjangre || []).filter(s => !sjangerSet.has(s.toLowerCase())),
    ...(a.undersjangre || []),
  ]))].sort((a, b) => a.localeCompare(b, "no"));
  const ulEl = document.getElementById("ul-chips");
  ulEl.innerHTML = under.length
    ? under.map((s) => `<button class="tag tag-under" data-under="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")
    : `<p class="muted">Ingen undersjangre registrert ennå.</p>`;

  // Reset til sjangre-fane
  document.querySelectorAll(".genre-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('.genre-tab[data-genre-tab="sjangre"]').classList.add("active");
  slEl.style.display = "";
  ulEl.style.display = "none";
  document.getElementById("sl-hint").textContent = "Trykk på en sjanger for å lese beskrivelsen.";

  modalOpen(modal);
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
      onTechClick: openTechDetail,
      onGenreClick,
      onShowArtists: showArtistsForGenre,
      onShowPlaylist: showPlaylistForGenre,
    });
  }
  requestAnimationFrame(() => gxApi.fit());
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

function setupSubgenreInfo() {
  const backdrop = document.getElementById("modal-subgenre-info");
  if (backdrop) {
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) modalClose(backdrop); });
    backdrop.querySelector(".modal-close").addEventListener("click", () => modalClose(backdrop));
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
        if (artist) openDetail(artist);
      });
    });
  }

  modalOpen(modal);
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
  renderSpotlightCards($("#spotlight"), currentPicks, state.config, buildLc());
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
  renderSpotlightCards($("#dagens-artist"), [artist], state.config, buildLc());
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
    pool = pool.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
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
//  Alle forslag — fullstendig liste med stemmefunksjon
// ----------------------------------------------------------------------------

function renderList() {
  if (!state.config) return;
  renderArtists($("#artist-list"), { ...state, handlers, linkCtx: buildLc() });
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
  // Behold valgte filtre etter at listene er fylt på nytt
  if (state.filters.sjanger)  $("#sp-sjanger").value = state.filters.sjanger;
  if (state.filters.genre)    $("#sp-genre").value = state.filters.genre;
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
  setupSjangerModal();
  setupDetailModal();
  setupSubgenreInfo();
  setupExplore();

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
