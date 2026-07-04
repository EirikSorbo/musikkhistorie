// ============================================================================
//  UI — DASHBOARD / GRENSEOVERSIKT
// ----------------------------------------------------------------------------
//  Statistikk-kort: totaltelling, kjønnsfordeling, grenser per tiår/sjanger/
//  instrument. Re-eksporteres fra ui.js.
// ============================================================================

import {
  computeCounts,
  genderDistribution,
  limitForDecade,
  limitForMetaGenre,
  limitForInstrument,
} from "./limits.js?v=2.81";
import { escapeHtml, GENDER_LABEL, pct } from "./ui-helpers.js?v=2.81";
import { GENEALOGY, isMainGenre } from "./genealogy.js?v=2.81";
import { resolveDesc, resolveDescAny } from "./genre-descriptions.js?v=2.81";

const GENDER_COLORS = {
  kvinne: "var(--c-kvinne)",
  mann: "var(--c-mann)",
  annet: "var(--c-annet)",
  ukjent: "var(--c-ukjent)",
};

export function renderDashboard(el, { artists, config, genreDescs = {}, onSubgenreClick, onEditDesc }) {
  const counts = computeCounts(artists);
  const dist = genderDistribution(artists);
  const removed = artists.filter((a) => (a.priority || 0) === -1).length;
  const pending = artists.filter((a) => a.status === "pending").length;
  const checked = artists.filter((a) => a.status === "active" && a.teacherChecked === true).length;
  const activeArtists = artists.filter(a => a.status === "active");
  const subgenreCount = new Set(
    activeArtists.flatMap(a => [...(a.mainGenre || []), ...(a.subGenre || [])])
  ).size;

  const artistsNoSjanger = activeArtists
    .filter(a => !a.mainGenre || a.mainGenre.length === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));

  const allArtistTags = new Set(activeArtists.flatMap(a => [...(a.mainGenre || []), ...(a.subGenre || [])]));
  const orphanedSubgenres = Object.keys(genreDescs)
    .filter(s => !allArtistTags.has(s))
    .sort((a, b) => a.localeCompare(b, "no"));

  const noSjangerHtml = artistsNoSjanger.length
    ? artistsNoSjanger.map(a =>
        `<div class="result-row"><span class="result-name">${escapeHtml(a.name)}</span><span class="result-meta">${a.metaGenre ? `<span class="tag">${escapeHtml(a.metaGenre)}</span>` : ""}</span></div>`
      ).join("")
    : `<p class="muted">Ingen.</p>`;

  const orphanHtml = orphanedSubgenres.length
    ? orphanedSubgenres.map(s =>
        `<div class="result-row orphan-link" data-subgenre="${escapeHtml(s)}" style="cursor:pointer"><span class="result-name" style="text-decoration:underline;color:var(--accent)">${escapeHtml(s)}</span></div>`
      ).join("")
    : `<p class="muted">Ingen.</p>`;

  // --- Sjangre uten beskrivelse, per nivå ---
  const byNo = (a, b) => a.localeCompare(b, "no");
  const metaMissing = (config.metaGenres || [])
    .filter(n => !resolveDesc(genreDescs, n, "meta").description).sort(byNo);
  const mainMissing = GENEALOGY
    .filter(n => !resolveDescAny(genreDescs, [n.l, n.f], "main").description)
    .map(n => n.l).sort(byNo);
  const subTags = [...new Set(activeArtists.flatMap(a => [
    ...(a.mainGenre || []).filter(x => !isMainGenre(x)),
    ...(a.subGenre || []),
  ]))];
  const subMissing = subTags
    .filter(n => !resolveDesc(genreDescs, n, "sub").description).sort(byNo);

  const missRow = (name, level) =>
    `<div class="result-row miss-link" data-miss-name="${escapeHtml(name)}" data-miss-level="${level}" style="cursor:pointer"><span class="result-name" style="text-decoration:underline;color:var(--accent)">${escapeHtml(name)}</span></div>`;
  const missList = (arr, level) => arr.length
    ? `<div class="result-list">${arr.map(n => missRow(n, level)).join("")}</div>`
    : `<p class="muted">Ingen – alle har beskrivelse ✓</p>`;

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-num">${counts.total}<span>/${config.maxTotal}</span></div>
        <div class="stat-label">Aktive forslag totalt</div>
        <div class="bar"><div class="bar-fill" style="width:${pct(
          counts.total,
          config.maxTotal
        )}%"></div></div>
      </div>
      ${pending ? `<div class="stat-card stat-pending">
        <div class="stat-num">${pending}</div>
        <div class="stat-label">Venter på godkjenning</div>
      </div>` : ""}
      <div class="stat-card">
        <div class="stat-num">${removed}</div>
        <div class="stat-label">Skjult for studenter</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${subgenreCount}</div>
        <div class="stat-label">Undersjangre</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${checked}</div>
        <div class="stat-label">Artistkort sjekket</div>
      </div>
      <div class="stat-card stat-wide">
        <div class="stat-label">Kjønnsfordeling (aktive)</div>
        ${renderGenderChart(dist)}
      </div>
      <div class="stat-card stat-wide">
        <button class="btn ghost small" id="ov-btn-no-sjanger">Artister uten sjanger (${artistsNoSjanger.length})</button>
        <div id="ov-no-sjanger-list" style="display:none;margin-top:10px"></div>
        <button class="btn ghost small" id="ov-btn-orphan-sub" style="margin-top:8px">Undersjangre uten artistkort (${orphanedSubgenres.length})</button>
        <div id="ov-orphan-sub-list" style="display:none;margin-top:10px"></div>
      </div>
      <div class="stat-card stat-wide" id="ov-miss-card">
        <div class="stat-label">Sjangre uten beskrivelse — klikk et navn for å redigere</div>
        <button class="btn ghost small" id="ov-btn-miss-meta">Metasjangre (${metaMissing.length})</button>
        <div id="ov-miss-meta" style="display:none;margin-top:10px">${missList(metaMissing, "meta")}</div>
        <button class="btn ghost small" id="ov-btn-miss-main" style="margin-top:8px">Sjangre (${mainMissing.length})</button>
        <div id="ov-miss-main" style="display:none;margin-top:10px">${missList(mainMissing, "main")}</div>
        <button class="btn ghost small" id="ov-btn-miss-sub" style="margin-top:8px">Undersjangre (${subMissing.length})</button>
        <div id="ov-miss-sub" style="display:none;margin-top:10px">${missList(subMissing, "sub")}</div>
      </div>
    </div>
  `;

  for (const [btn, panel] of [["#ov-btn-miss-meta", "#ov-miss-meta"], ["#ov-btn-miss-main", "#ov-miss-main"], ["#ov-btn-miss-sub", "#ov-miss-sub"]]) {
    el.querySelector(btn).addEventListener("click", () => {
      const p = el.querySelector(panel);
      p.style.display = p.style.display === "none" ? "block" : "none";
    });
  }
  const missCard = el.querySelector("#ov-miss-card");
  if (onEditDesc) missCard.addEventListener("click", (e) => {
    const row = e.target.closest("[data-miss-name]");
    if (row) onEditDesc(row.dataset.missName, row.dataset.missLevel);
  });

  el.querySelector("#ov-btn-no-sjanger").addEventListener("click", () => {
    const panel = el.querySelector("#ov-no-sjanger-list");
    const visible = panel.style.display !== "none";
    panel.style.display = visible ? "none" : "block";
    if (!visible) panel.innerHTML = `<div class="result-list">${noSjangerHtml}</div>`;
  });

  el.querySelector("#ov-btn-orphan-sub").addEventListener("click", () => {
    const panel = el.querySelector("#ov-orphan-sub-list");
    const visible = panel.style.display !== "none";
    panel.style.display = visible ? "none" : "block";
    if (!visible) {
      panel.innerHTML = `<div class="result-list">${orphanHtml}</div>`;
      if (onSubgenreClick) {
        panel.querySelectorAll(".orphan-link").forEach(row => {
          row.addEventListener("click", () => onSubgenreClick(row.dataset.subgenre));
        });
      }
    }
  });
}

function renderGenderChart(dist) {
  if (dist.total === 0) {
    return `<p class="muted">Ingen forslag ennå.</p>`;
  }
  const segments = ["kvinne", "mann", "annet", "ukjent"]
    .filter((k) => dist[k] > 0)
    .map(
      (k) =>
        `<div class="gender-seg" style="width:${pct(
          dist[k],
          dist.total
        )}%;background:${GENDER_COLORS[k]}" title="${GENDER_LABEL[k]}: ${
          dist[k]
        }"></div>`
    )
    .join("");

  const legend = ["kvinne", "mann", "annet", "ukjent"]
    .map(
      (k) => `
      <span class="legend-item">
        <span class="dot" style="background:${GENDER_COLORS[k]}"></span>
        ${GENDER_LABEL[k]}: <strong>${dist[k]}</strong>
        (${pct(dist[k], dist.total)}%)
      </span>`
    )
    .join("");

  return `
    <div class="gender-bar">${segments}</div>
    <div class="legend">${legend}</div>
  `;
}

export function renderLimits(el, { artists, config }) {
  const counts = computeCounts(artists);

  const decadeRows = config.decades
    .map((d) =>
      limitRow(`${d}-tallet`, counts.perDecade[d] || 0, limitForDecade(config, d))
    )
    .join("");

  const genreRows = config.metaGenres
    .map((g) => limitRow(g, counts.perMetaGenre[g] || 0, limitForMetaGenre(config, g)))
    .join("");

  const instrumentRows = (config.instruments || [])
    .map((i) => limitRow(i, counts.perInstrument[i] || 0, limitForInstrument(config, i)))
    .join("");

  el.innerHTML = `
    <div class="limits-cols">
      <div>
        <h3>Per tiår</h3>
        <div class="limit-list">${decadeRows}</div>
      </div>
      <div>
        <h3>Per sjanger</h3>
        <div class="limit-list">${genreRows}</div>
      </div>
      <div>
        <h3>Per instrument</h3>
        <div class="limit-list">${instrumentRows}</div>
      </div>
    </div>
  `;
}

function limitRow(label, count, max) {
  const full = count >= max;
  return `
    <div class="limit-row ${full ? "full" : ""}">
      <span class="limit-label">${escapeHtml(label)}</span>
      <span class="bar small"><span class="bar-fill" style="width:${pct(
        count,
        max
      )}%"></span></span>
      <span class="limit-count">${count}/${max}${full ? " 🔒" : ""}</span>
    </div>
  `;
}
