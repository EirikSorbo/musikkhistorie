import { escapeHtml, formatInfoText, buildTimeline, buildTechTimeline, renderTechList, renderTechDetail, TECH_CATEGORIES, openArtistListModal, openPlaylistModal, artistsInGenre, artistsByInstrument, showSubsjangerInfo, modalOpen, modalClose, setupModal, initModalHeaders, buildKilderList, buildMainGenreList } from "./ui.js?v=2.47";
import { GENEALOGY_MAIN_GENRES, isMainGenre, showSjangerInfo } from "./genealogy.js?v=2.47";

// Varmekart: mainGenre (rad) × tiår (kolonne). Radene hentes dynamisk fra
// treet (GENEALOGY_MAIN_GENRES) — nye sjangre dukker opp automatisk.
// «Varmen» er derimot redaksjonell: nivå 0–5 for hvor toneangivende sjangeren
// var det tiåret. Sjangre som mangler i HEAT vises som «ingen data».
const VK_DECADES = [1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const VK_COLORS = ["#eef3f0", "#d4efe0", "#a3e0c2", "#5cc596", "#23a06d", "#0c7a4f"];
const VK_HEAT = {
  "Blues":         [2, 3, 4, 4, 4, 5, 4, 3, 2, 2, 2, 2, 2],
  "Ragtime":       [4, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Tin Pan Alley": [0, 3, 4, 4, 4, 3, 1, 0, 0, 0, 0, 0, 0],
  "Jazz":          [0, 2, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2],
  "Country":       [0, 0, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Gospel":        [0, 0, 0, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2],
  "Swing":         [0, 0, 1, 4, 5, 2, 1, 0, 0, 0, 0, 0, 0],
  "Bluegrass":     [0, 0, 0, 0, 2, 3, 3, 2, 2, 2, 2, 2, 2],
  "Honky tonk":    [0, 0, 0, 0, 3, 4, 3, 2, 1, 1, 1, 1, 1],
  "Bebop":         [0, 0, 0, 0, 3, 5, 3, 1, 1, 1, 1, 1, 1],
  "R&B":           [0, 0, 0, 0, 3, 4, 4, 3, 3, 3, 3, 3, 3],
  "Nashville":     [0, 0, 0, 0, 0, 2, 4, 3, 3, 2, 2, 2, 2],
  "Chicago blues": [0, 0, 0, 0, 1, 4, 4, 2, 2, 1, 1, 1, 1],
  "Cool jazz":     [0, 0, 0, 0, 0, 3, 3, 1, 1, 1, 1, 1, 1],
  "Hard bop":      [0, 0, 0, 0, 0, 2, 4, 2, 1, 1, 1, 1, 1],
  "Soul":          [0, 0, 0, 0, 0, 1, 5, 4, 2, 2, 2, 2, 2],
  "Modal jazz":    [0, 0, 0, 0, 0, 1, 3, 2, 1, 1, 1, 1, 1],
  "Free jazz":     [0, 0, 0, 0, 0, 0, 3, 2, 1, 1, 1, 1, 1],
  "Funk":          [0, 0, 0, 0, 0, 0, 2, 4, 3, 2, 2, 2, 2],
  "Reggae":        [0, 0, 0, 0, 0, 0, 2, 4, 3, 2, 2, 2, 2],
  "Outlaw":        [0, 0, 0, 0, 0, 0, 0, 3, 2, 1, 1, 1, 1],
  "Fusion":        [0, 0, 0, 0, 0, 0, 1, 4, 3, 2, 2, 2, 2],
  "Hip-hop":       [0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 5, 5, 5],
  "Disco":         [0, 0, 0, 0, 0, 0, 0, 4, 2, 0, 0, 0, 0],
  "House":         [0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4],
  "Techno":        [0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4],
  "Americana":     [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3],
  "Neo-soul":      [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 3, 3],
  "Trance / DnB":  [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4],
  "Nu-jazz":       [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 3],
};

// Varmen er redaksjonell og kan ikke utledes fra treet. Varsle derfor i
// konsollen om sjangre (noder) som mangler en VK_HEAT-rad, så de ikke stille
// vises som «ingen data» i varmekartet.
{
  const missing = GENEALOGY_MAIN_GENRES.filter((sj) => !VK_HEAT[sj]);
  if (missing.length) {
    console.warn(
      `Varmekart: ${missing.length} sjanger(e) mangler VK_HEAT-rad i explore.js og vises som «ingen data»:`,
      missing
    );
  }
}

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
    <div id="dl-tech-extra"></div>
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
      <button class="btn ghost small" id="dv-society-propose" style="display:none;margin-left:6px">Foreslå endring</button>
    </div>
    <div class="info-section" id="dv-tech-section">
      <h4 class="info-label">Teknologiutvikling</h4>
      <div id="dv-tech-timeline"></div>
      <div id="dv-tech" class="info-text"></div>
      <button class="btn ghost small" id="dv-tech-more" style="display:none">Les mer →</button>
      <button class="btn ghost small" id="dv-tech-propose" style="display:none;margin-left:6px">Foreslå endring</button>
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

<!-- Varmekart: supersjanger × tiår -->
<div class="modal-backdrop" id="modal-varmekart">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Tyngdepunkt gjennom tiårene</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:16px;font-size:0.9rem">Hvor sjangrenes tyngdepunkt lå, tiår for tiår. Mørkere = mer toneangivende.</p>
    <div id="vk-body"></div>
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
    <div class="modal-foot-right" id="sj-foot" style="display:none">
      <button type="button" class="btn ghost small" id="sj-propose">Foreslå endring</button>
    </div>
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
    <div class="modal-foot-right" id="td-foot" style="display:none">
      <button type="button" class="btn ghost small" id="td-propose">Foreslå endring</button>
    </div>
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
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onMainGenreClick,
    isTeacher: !!s.isTeacher,
  };
}

function sjangerOpts() {
  const s = getState();
  return {
    root: document,
    subgenreDescs: s.subgenreDescs,
    artists: s.artists,
    techItems: s.techItems,
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onMainGenreClick,
    onShowArtists: showArtistsForSjanger,
    onShowPlaylist: showPlaylistForMainGenre,
    onEdit: opts.onSubgenreEdit ? (label) => {
      modalClose(document.getElementById("modal-sjanger"));
      opts.onSubgenreEdit(label);
    } : undefined,
    onPropose: opts.onProposeEdit,
    hasPendingEdit: opts.hasPendingEdit,
  };
}

function onMainGenreClick(genre) {
  showSjangerInfo(genre, sjangerOpts()) || showSubsjangerInfo(genre, sjangerOpts());
  if (opts.onMainGenreCheck) opts.onMainGenreCheck(genre);
}

function showPlaylistForMainGenre({ fullName, node }) {
  openPlaylistModal(fullName, node, getState().artists);
}

function showArtistsForSjanger({ label }) {
  openArtistListModal(label, artistsInGenre(getState().artists, label), opts.onArtistClick, "Ingen forslag i denne sjangeren ennå.");
}

function showArtistsForInstrument(instrument) {
  openArtistListModal(instrument, artistsByInstrument(getState().artists, instrument), opts.onArtistClick, "Ingen forslag med dette instrumentet ennå.");
}

function openTechDetail(t) {
  document.getElementById("td-title").textContent = t.name;
  renderTechDetail(document.getElementById("td-body"), t, buildLinkCtx());
  const foot = document.getElementById("td-foot");
  const btn = document.getElementById("td-propose");
  if (foot && btn && opts.onProposeEdit) {
    foot.style.display = "";
    const locked = opts.hasPendingEdit?.("tech", t.id);
    btn.disabled = !!locked;
    btn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
    btn.onclick = () => opts.onProposeEdit({
      entityType: "tech",
      entityId: t.id,
      entityName: t.name,
      currentValues: t,
    });
  } else if (foot) {
    foot.style.display = "none";
  }
  modalOpen(document.getElementById("modal-tech-detail"));
}

function openDecadeList(mode) {
  contextMode = mode;
  const s = getState();
  const modal = document.getElementById("modal-decade-list");
  if (!modal) return;
  modal.querySelector(".modal-head h2").textContent = mode === "society" ? "Samfunn" : "Teknologi";
  const techExtra = document.getElementById("dl-tech-extra");
  if (techExtra) {
    if (mode === "tech") {
      techExtra.innerHTML = `<button class="btn ghost" id="dl-btn-innovasjon" style="width:100%;margin-bottom:14px">Vis innovasjonskort →</button>`;
      techExtra.querySelector("#dl-btn-innovasjon").addEventListener("click", () => openTeknologi());
    } else {
      techExtra.innerHTML = "";
    }
  }
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

  const propSociety = document.getElementById("dv-society-propose");
  const propTech = document.getElementById("dv-tech-propose");
  if (propSociety) {
    if (isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-society", decadeId);
      propSociety.style.display = "";
      propSociety.disabled = !!locked;
      propSociety.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propSociety.onclick = () => opts.onProposeEdit({
        entityType: "decade-society",
        entityId: String(decadeId),
        entityName: `${decadeId}-tallet — samfunn`,
        currentValues: { society: desc.society || "", societyMore: desc.societyMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propSociety.style.display = "none";
    }
  }
  if (propTech) {
    if (!isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-tech", decadeId);
      propTech.style.display = "";
      propTech.disabled = !!locked;
      propTech.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propTech.onclick = () => opts.onProposeEdit({
        entityType: "decade-tech",
        entityId: String(decadeId),
        entityName: `${decadeId}-tallet — teknologi`,
        currentValues: { tech: desc.tech || "", techMore: desc.techMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propTech.style.display = "none";
    }
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

function openVarmekart() {
  const modal = document.getElementById("modal-varmekart");
  if (!modal) return;
  const body = document.getElementById("vk-body");
  const cols = VK_DECADES.length;
  const gridStyle = `display:grid;grid-template-columns:128px repeat(${cols},minmax(32px,1fr));gap:3px`;

  let html = `<div style="overflow-x:auto"><div style="min-width:560px">`;
  html += `<div style="${gridStyle};align-items:end;margin-bottom:3px"><div></div>`;
  html += VK_DECADES.map((d) => `<div style="text-align:center;font-size:0.72rem;color:var(--muted)">${d}</div>`).join("");
  html += `</div>`;

  const firstHot = (sj) => { const i = (VK_HEAT[sj] || []).findIndex((v) => v > 0); return i < 0 ? 99 : i; };
  const rows = [...GENEALOGY_MAIN_GENRES].sort((a, b) => firstHot(a) - firstHot(b) || a.localeCompare(b, "no"));
  for (const sj of rows) {
    const vals = VK_HEAT[sj] || VK_DECADES.map(() => null);
    html += `<div style="${gridStyle};align-items:center;margin-bottom:3px">`;
    html += `<div style="font-size:0.82rem;color:var(--text);padding-right:8px;line-height:1.2">${escapeHtml(sj)}</div>`;
    html += vals.map((v, i) => {
      const has = v != null;
      const bg = has ? VK_COLORS[v] : "#f5f8f6";
      const title = `${sj} · ${VK_DECADES[i]}-tallet${has ? ` · nivå ${v}/5` : " · ingen data"}`;
      return `<div title="${escapeHtml(title)}" style="height:30px;border-radius:6px;background:${bg}${has ? "" : ";border:1px dashed var(--line-strong)"}"></div>`;
    }).join("");
    html += `</div>`;
  }
  html += `</div></div>`;

  html += `<div style="display:flex;align-items:center;gap:8px;margin-top:18px;font-size:0.8rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span>Mindre</span>`;
  html += [1, 2, 3, 4, 5].map((v) => `<span style="width:22px;height:14px;border-radius:4px;background:${VK_COLORS[v]}"></span>`).join("");
  html += `<span>Mer</span>`;
  html += `<span style="margin-left:14px;display:inline-flex;align-items:center;gap:6px"><span style="width:22px;height:14px;border-radius:4px;background:#f5f8f6;border:1px dashed var(--line-strong)"></span>ingen data ennå</span>`;
  html += `</div>`;

  body.innerHTML = html;
  modalOpen(modal);
}

function openSubgenreList() {
  const modal = document.getElementById("modal-subgenre-list");
  if (!modal) return;
  const s = getState();
  const active = s.artists.filter((a) => a.status === "active" && (a.priority || 0) !== -1);
  const checkedState = opts.getCheckedState ? opts.getCheckedState() : null;

  // Tre-drevet: alle sjangre fra treet vises alltid. De artist-taggede er en
  // delmengde (isMainGenre), men tas med for sikkerhets skyld.
  const withArtists = new Set(active.flatMap(a => (a.mainGenre || []).filter(isMainGenre)));
  const sjangre = [...new Set([...GENEALOGY_MAIN_GENRES, ...withArtists])]
    .sort((a, b) => a.localeCompare(b, "no"));
  const slEl = document.getElementById("sl-chips");
  const checkedMainGenres = checkedState?.genres || [];
  slEl.innerHTML = sjangre.length
    ? sjangre.map((s) => {
        const empty = !withArtists.has(s);
        return `<button class="tag tag-sjanger ${checkedMainGenres.includes(s) ? "is-checked" : ""}${empty ? " is-empty" : ""}" data-sjanger="${escapeHtml(s)}"${empty ? ' title="Ingen artister ennå"' : ""}>${escapeHtml(s)}</button>`;
      }).join("")
    : `<p class="muted">Ingen sjangere registrert ennå.</p>`;

  const under = [...new Set(active.flatMap(a => [
    ...(a.mainGenre || []).filter(x => !isMainGenre(x)),
    ...(a.subGenre || []),
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
    .filter(a => a.status === "active" && (a.priority || 0) !== -1 && ((a.subGenre || []).includes(subgenreId) || (a.mainGenre || []).includes(subgenreId)))
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
            ${a.metaGenre ? `<span class="tag">${escapeHtml(a.metaGenre)}</span>` : ""}
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
  // Gi de nettopp injiserte modalene samme header-behandling (←/✕ lukk alle)
  // som de statiske, ellers blir headeren inkonsekvent.
  initModalHeaders();
}

function wireModals() {
  ["modal-teknologi", "modal-podkast", "modal-decade-list", "modal-decade-view",
   "modal-decade-more", "modal-subgenre-list", "modal-subgenre-info", "modal-varmekart",
   "modal-artistliste", "modal-spilleliste", "modal-sjanger", "modal-tech-detail"].forEach((id) => setupModal(id));

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
  if (slExtra) {
    let btns = `<div style="display:flex;gap:10px;margin-bottom:14px">`;
    if (opts.onSlektstre) btns += `<button class="btn ghost" id="btn-slektstre" style="flex:1">Vis sjangertre →</button>`;
    btns += `<button class="btn ghost" id="btn-varmekart" style="flex:1">Vis varmekart →</button>`;
    btns += `</div>`;
    slExtra.innerHTML = btns;
    const treBtn = slExtra.querySelector("#btn-slektstre");
    if (treBtn) treBtn.addEventListener("click", () => opts.onSlektstre());
    slExtra.querySelector("#btn-varmekart").addEventListener("click", openVarmekart);
  }

  const tekExtra = document.getElementById("tek-admin-extra");
  if (opts.onTechAdmin && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost" id="btn-tech-admin" style="width:100%;margin-bottom:14px">Vis teknologikort (admin) →</button>`;
    tekExtra.querySelector("#btn-tech-admin").addEventListener("click", () => {
      modalClose(document.getElementById("modal-teknologi"));
      opts.onTechAdmin();
    });
  } else if (opts.onProposeNewTech && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost" id="btn-tech-new" style="width:100%;margin-bottom:14px">Foreslå nytt innovasjonskort →</button>`;
    tekExtra.querySelector("#btn-tech-new").addEventListener("click", () => opts.onProposeNewTech());
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
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
      return;
    }
    const underBtn = e.target.closest("[data-under]");
    if (underBtn) {
      const name = underBtn.dataset.under;
      showSubsjangerInfo(name, sjangerOpts()) || showSjangerInfo(name, sjangerOpts());
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
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
    openVarmekart,
    openPodkast,
    openTeknologi,
    openTechDetail,
    buildLinkCtx,
    showArtistsForSjanger,
    showPlaylistForMainGenre,
    onMainGenreClick,
    openSubgenreInfo,
  };
}
