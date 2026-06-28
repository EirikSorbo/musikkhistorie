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
} from "./limits.js?v=2.45";
import { escapeHtml, GENDER_LABEL, pct } from "./ui-helpers.js?v=2.45";

const GENDER_COLORS = {
  kvinne: "var(--c-kvinne)",
  mann: "var(--c-mann)",
  annet: "var(--c-annet)",
  ukjent: "var(--c-ukjent)",
};

export function renderDashboard(el, { artists, config, subgenreDescs = {}, onSubgenreClick }) {
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
  const orphanedSubgenres = Object.keys(subgenreDescs)
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
    </div>
  `;

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
