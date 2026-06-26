import { escapeHtml, formatInfoText, buildTimeline, buildTechTimeline, renderTechList, renderTechDetail, TECH_CATEGORIES, buildPlaylistHtml, buildArtistListRows, showSubsjangerInfo, modalOpen, modalClose, buildKilderList, buildGenreList } from "./ui.js?v=215";
import { GENEALOGY_GENRES, showSjangerInfo } from "./genealogy.js";

const MODAL_HTML = `
<!-- Teknologi -->
<div class="modal-backdrop" id="modal-teknologi">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Teknologiske innovasjoner</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="tek-admin-extra"></div>
    <div class="tech-category-tabs">
      <button class="btn ghost small tech-tab active" data-tech-cat="">Alle</button>
      <button class="btn ghost small tech-tab" data-tech-cat="Opptak og avspilling">Opptak</button>
      <button class="btn ghost small tech-tab" data-tech-cat="Kringkasting og spredning">Kringkasting</button>
      <button class="btn ghost small tech-tab" data-tech-cat="Instrumenter og lydutstyr">Instrumenter</button>
    </div>
    <div id="tech-list" class="tech-grid"></div>
  </div>
</div>

<!-- Podkast -->
<div class="modal-backdrop" id="modal-podkast">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Podkast</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="podkast-list" class="podkast-list"></div>
  </div>
</div>

<!-- Tiår-liste -->
<div class="modal-backdrop" id="modal-decade-list">
  <div class="modal">
    <div class="modal-head">
      <h2>Kontekst</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:14px;font-size:0.9rem">Velg et tiår for å lese mer.</p>
    <div id="dl-buttons" class="explore-decade-grid"></div>
  </div>
</div>

<!-- Enkelt tiår (les) -->
<div class="modal-backdrop" id="modal-decade-view">
  <div class="modal">
    <div class="modal-head">
      <h2 id="dv-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div class="info-section" id="dv-society-section">
      <h4 class="info-label">Samfunnsutvikling</h4>
      <div id="dv-society-timeline"></div>
      <div id="dv-society" class="info-text"></div>
      <button class="btn ghost small" id="dv-society-more" style="display:none">Les mer →</button>
    </div>
    <div class="info-section" id="dv-tech-section">
      <h4 class="info-label">Teknologiutvikling</h4>
      <div id="dv-tech-timeline"></div>
      <div id="dv-tech" class="info-text"></div>
      <button class="btn ghost small" id="dv-tech-more" style="display:none">Les mer →</button>
    </div>
    <div id="dv-kilder"></div>
    <div style="margin-top:16px">
      <button class="btn ghost small" id="dv-back">← Tilbake til oversikt</button>
    </div>
  </div>
</div>

<!-- Utvidet tiårsbeskrivelse -->
<div class="modal-backdrop" id="modal-decade-more">
  <div class="modal">
    <div class="modal-head">
      <h2 id="dm-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="dm-text" class="info-text"></div>
  </div>
</div>

<!-- Sjangere-liste -->
<div class="modal-backdrop" id="modal-subgenre-list">
  <div class="modal">
    <div class="modal-head">
      <h2>Sjangre</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div class="genre-tabs">
      <button class="btn ghost small genre-tab active" data-genre-tab="sjangre">Sjangre</button>
      <button class="btn ghost small genre-tab" data-genre-tab="under">Undersjangre</button>
    </div>
    <div id="sl-extra"></div>
    <p class="muted" style="margin-bottom:14px;font-size:0.9rem" id="sl-hint">Trykk på en sjanger for å lese beskrivelsen.</p>
    <div id="sl-chips" class="subgenre-tag-list"></div>
    <div id="ul-chips" class="subgenre-tag-list" style="display:none"></div>
  </div>
</div>

<!-- Sjanger-info -->
<div class="modal-backdrop" id="modal-subgenre-info">
  <div class="modal">
    <div class="modal-head">
      <h2 id="sgi-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p id="sgi-desc"></p>
    <div id="sgi-artists"></div>
    <div id="sgi-extra"></div>
  </div>
</div>

<!-- Artistliste-popup -->
<div class="modal-backdrop" id="modal-artistliste">
  <div class="modal">
    <div class="modal-head">
      <h2 id="al-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="al-body"></div>
  </div>
</div>

<!-- Spilleliste-popup -->
<div class="modal-backdrop" id="modal-spilleliste">
  <div class="modal">
    <div class="modal-head">
      <h2 id="pl-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="pl-body"></div>
  </div>
</div>

<!-- Sjanger-beskrivelse -->
<div class="modal-backdrop" id="modal-sjanger">
  <div class="modal">
    <div class="modal-head">
      <h2 id="sj-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="sj-body"></div>
  </div>
</div>

<!-- Teknologi-detalj -->
<div class="modal-backdrop" id="modal-tech-detail">
  <div class="modal">
    <div class="modal-head">
      <h2 id="td-title"></h2>
      <button class="modal-close btn ghost small">&#x2715;</button>
    </div>
    <div id="td-body"></div>
  </div>
</div>
`;

let opts = null;
let contextMode = "society";

function getState() { return opts.getState(); }

function buildLinkCtx() {
  const s = getState();
  return {
    artists: s.artists,
    techItems: s.techItems,
    genres: buildGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onGenreClick,
  };
}

function sjangerOpts() {
  const s = getState();
  return {
    root: document,
    subgenreDescs: s.subgenreDescs,
    artists: s.artists,
    techItems: s.techItems,
    genres: buildGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onGenreClick,
    onShowArtists: showArtistsForSjanger,
    onShowPlaylist: showPlaylistForGenre,
    onEdit: opts.onSubgenreEdit ? (label) => {
      modalClose(document.getElementById("modal-sjanger"));
      opts.onSubgenreEdit(label);
    } : undefined,
  };
}

function onGenreClick(genre) {
  showSjangerInfo(genre, sjangerOpts()) || showSubsjangerInfo(genre, sjangerOpts());
  if (opts.onGenreCheck) opts.onGenreCheck(genre);
}

function showPlaylistForGenre({ label, fullName, node }) {
  const s = getState();
  const { total, html } = buildPlaylistHtml(node, s.artists);
  document.getElementById("pl-title").textContent = `${fullName} — spilleliste (${total})`;
  document.getElementById("pl-body").innerHTML = html;
  modalOpen(document.getElementById("modal-spilleliste"));
}

function showArtistsForSjanger({ label }) {
  const s = getState();
  const sj = label.toLowerCase();
  const list = s.artists
    .filter((a) => a.status === "active" && (
      a.genre === label
      || (a.sjangre || []).some((x) => x.toLowerCase() === sj)
      || (a.undersjangre || []).some((x) => x.toLowerCase() === sj)
    ))
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));
  document.getElementById("al-title").textContent = `${label} (${list.length})`;
  const body = document.getElementById("al-body");
  if (!list.length) {
    body.innerHTML = `<p class="muted empty">Ingen forslag i denne sjangeren ennå.</p>`;
  } else {
    body.innerHTML = `<div class="result-list">${buildArtistListRows(list)}</div>`;
    body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
      const open = () => {
        const a = list.find((x) => x.id === row.dataset.artistId);
        if (a) opts.onArtistClick(a);
      };
      row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
      row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  modalOpen(document.getElementById("modal-artistliste"));
}

function showArtistsForInstrument(instrument) {
  const s = getState();
  const list = s.artists
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
      if (a) opts.onArtistClick(a);
    };
    row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  modalOpen(document.getElementById("modal-artistliste"));
}

function openTechDetail(t) {
  document.getElementById("td-title").textContent = t.name;
  renderTechDetail(document.getElementById("td-body"), t, buildLinkCtx());
  modalOpen(document.getElementById("modal-tech-detail"));
}

function openDecadeList(mode) {
  contextMode = mode;
  const s = getState();
  const modal = document.getElementById("modal-decade-list");
  if (!modal) return;
  modal.querySelector(".modal-head h2").textContent = mode === "society" ? "Samfunn" : "Teknologi";
  const decades = (s.config?.decades || []).slice().sort((a, b) => a - b);
  const el = document.getElementById("dl-buttons");
  el.innerHTML = decades.map((d) => {
    const desc = s.decadeDescs[String(d)];
    const hasDesc = mode === "society" ? desc && desc.society : desc && desc.tech;
    return `<button class="btn ghost decade-list-btn ${hasDesc ? "" : "muted"}" data-decade-view="${d}">${d}-tallet</button>`;
  }).join("");
  el.querySelectorAll("[data-decade-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (opts.onDecadeEdit) {
        opts.onDecadeEdit(btn.dataset.decadeView, contextMode);
      } else {
        openDecadeView(btn.dataset.decadeView);
      }
    });
  });
  modalOpen(modal);
}

function openDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  const s = getState();
  const desc = s.decadeDescs[String(decadeId)] || {};
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
    ttl.innerHTML = buildTechTimeline(s.techItems, decadeId);
    ttl.querySelectorAll("[data-tech-id]").forEach(el => {
      el.addEventListener("click", () => {
        const t = s.techItems.find(x => x.id === el.dataset.techId);
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

function openPodkast() {
  renderPodkastList();
  modalOpen(document.getElementById("modal-podkast"));
}

function renderPodkastList() {
  const el = document.getElementById("podkast-list");
  if (!el) return;
  const s = getState();
  if (!s.podcasts.length) {
    el.innerHTML = `<p class="muted empty" style="background:#fff">Episodene publiseres fortløpende etter hvert som studentgruppene leverer sine bidrag.</p>`;
    return;
  }
  el.innerHTML = s.podcasts.map((ep) => {
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

function renderTeknologiList(category) {
  const el = document.getElementById("tech-list");
  if (!el) return;
  const s = getState();
  renderTechList(el, s.techItems, category || "", buildLinkCtx());
}

function openSubgenreList() {
  const modal = document.getElementById("modal-subgenre-list");
  if (!modal) return;
  const s = getState();
  const sjangerSet = new Set(GENEALOGY_GENRES.map(g => g.toLowerCase()));
  const active = s.artists.filter((a) => a.status === "active");
  const checkedState = opts.getCheckedState ? opts.getCheckedState() : null;

  const sjangre = [...new Set(active.flatMap(a => (a.sjangre || []).filter(x => sjangerSet.has(x.toLowerCase()))))]
    .sort((a, b) => a.localeCompare(b, "no"));
  const slEl = document.getElementById("sl-chips");
  const checkedGenres = checkedState?.genres || [];
  slEl.innerHTML = sjangre.length
    ? sjangre.map((s) => `<button class="tag tag-sjanger ${checkedGenres.includes(s) ? "is-checked" : ""}" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")
    : `<p class="muted">Ingen sjangere registrert ennå.</p>`;

  const under = [...new Set(active.flatMap(a => [
    ...(a.sjangre || []).filter(x => !sjangerSet.has(x.toLowerCase())),
    ...(a.undersjangre || []),
  ]))].sort((a, b) => a.localeCompare(b, "no"));
  const ulEl = document.getElementById("ul-chips");
  const checkedSubs = checkedState?.subgenres || [];
  ulEl.innerHTML = under.length
    ? under.map((s) => `<button class="tag tag-under ${checkedSubs.includes(s) ? "is-checked" : ""}" data-under="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")
    : `<p class="muted">Ingen undersjangre registrert ennå.</p>`;

  document.querySelectorAll(".genre-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('.genre-tab[data-genre-tab="sjangre"]').classList.add("active");
  slEl.style.display = "";
  ulEl.style.display = "none";
  document.getElementById("sl-hint").textContent = "Trykk på en sjanger for å lese beskrivelsen.";

  modalOpen(modal);
}

function openSubgenreInfo(subgenreId) {
  const modal = document.getElementById("modal-subgenre-info");
  if (!modal) return;
  const s = getState();
  const desc = s.subgenreDescs[subgenreId];
  document.getElementById("sgi-title").textContent = subgenreId;
  document.getElementById("sgi-desc").textContent = desc?.description || "Ingen beskrivelse ennå.";
  document.getElementById("sgi-desc").className = desc?.description ? "" : "muted";

  const artists = s.artists
    .filter(a => a.status === "active" && ((a.undersjangre || []).includes(subgenreId) || (a.sjangre || []).includes(subgenreId)))
    .sort((a, b) => a.name.localeCompare(b.name, "no"));

  const el = document.getElementById("sgi-artists");
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
        if (artist) opts.onArtistClick(artist);
      });
    });
  }

  const extra = document.getElementById("sgi-extra");
  extra.innerHTML = "";
  if (opts.onSubgenreEdit) {
    extra.innerHTML = `<div class="modal-foot-right"><button id="sgi-edit-btn" class="btn ghost small">Rediger</button></div>`;
    extra.querySelector("#sgi-edit-btn").addEventListener("click", () => {
      modalClose(modal);
      opts.onSubgenreEdit(subgenreId);
    });
  }

  modalOpen(modal);
}

function injectModals() {
  const wrap = document.createElement("div");
  wrap.innerHTML = MODAL_HTML;
  while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
}

function wireModals() {
  ["modal-teknologi", "modal-podkast", "modal-decade-list", "modal-decade-view",
   "modal-decade-more", "modal-subgenre-list", "modal-subgenre-info",
   "modal-artistliste", "modal-spilleliste", "modal-sjanger", "modal-tech-detail"].forEach((id) => {
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

  const slExtra = document.getElementById("sl-extra");
  if (opts.onSlektstre && slExtra) {
    slExtra.innerHTML = `<button class="btn ghost" id="btn-slektstre" style="width:100%;margin-bottom:14px">Vis sjangertre →</button>`;
    slExtra.querySelector("#btn-slektstre").addEventListener("click", () => opts.onSlektstre());
  }

  const tekExtra = document.getElementById("tek-admin-extra");
  if (opts.onTechAdmin && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost" id="btn-tech-admin" style="width:100%;margin-bottom:14px">Vis teknologikort (admin) →</button>`;
    tekExtra.querySelector("#btn-tech-admin").addEventListener("click", () => {
      modalClose(document.getElementById("modal-teknologi"));
      opts.onTechAdmin();
    });
  }

  const tekModal = document.getElementById("modal-teknologi");
  if (tekModal) {
    tekModal.querySelectorAll(".tech-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        tekModal.querySelectorAll(".tech-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderTeknologiList(btn.dataset.techCat || "");
      });
    });
  }

  document.addEventListener("click", (e) => {
    const sjBtn = e.target.closest("[data-sjanger]");
    if (sjBtn) {
      const name = sjBtn.dataset.sjanger;
      showSjangerInfo(name, sjangerOpts()) || showSubsjangerInfo(name, sjangerOpts());
      if (opts.onGenreCheck) opts.onGenreCheck(name);
      return;
    }
    const underBtn = e.target.closest("[data-under]");
    if (underBtn) {
      const name = underBtn.dataset.under;
      showSubsjangerInfo(name, sjangerOpts()) || showSjangerInfo(name, sjangerOpts());
      if (opts.onGenreCheck) opts.onGenreCheck(name);
      return;
    }
    const inst = e.target.closest("[data-instrument]");
    if (inst) showArtistsForInstrument(inst.dataset.instrument);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-subgenre-info]");
    if (!btn) return;
    e.stopPropagation();
    openSubgenreInfo(btn.dataset.subgenreInfo);
  });
}

export function initExplore(options) {
  opts = options;
  injectModals();
  wireModals();
  return {
    openDecadeList,
    openSubgenreList,
    openPodkast,
    openTeknologi,
    openTechDetail,
    buildLinkCtx,
    showArtistsForSjanger,
    showPlaylistForGenre,
    onGenreClick,
  };
}
