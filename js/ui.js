// ============================================================================
//  UI — rendering
// ----------------------------------------------------------------------------
//  Rene funksjoner som bygger og oppdaterer grensesnittet ut fra tilstand.
//  Ingen direkte databasekall her — handlinger sendes inn via `handlers`.
// ============================================================================

import {
  computeCounts,
  genderDistribution,
  activeArtists,
  GENDERS,
} from "./limits.js";

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]));
const GENDER_COLORS = {
  kvinne: "var(--c-kvinne)",
  mann: "var(--c-mann)",
  annet: "var(--c-annet)",
  ukjent: "var(--c-ukjent)",
};

// ----------------------------------------------------------------------------
//  Dashboard: totaltelling + kjønnsfordeling
// ----------------------------------------------------------------------------

export function renderDashboard(el, { artists, config }) {
  const counts = computeCounts(artists);
  const dist = genderDistribution(artists);
  const removed = artists.filter((a) => a.status === "removed").length;

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
      <div class="stat-card">
        <div class="stat-num">${removed}</div>
        <div class="stat-label">Fjernet / utstemt</div>
      </div>
      <div class="stat-card stat-wide">
        <div class="stat-label">Kjønnsfordeling (aktive)</div>
        ${renderGenderChart(dist)}
      </div>
    </div>
  `;
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

// ----------------------------------------------------------------------------
//  Grenseoversikt: per tiår og per sjanger
// ----------------------------------------------------------------------------

export function renderLimits(el, { artists, config }) {
  const counts = computeCounts(artists);

  const decadeRows = config.decades
    .map((d) =>
      limitRow(`${d}-tallet`, counts.perDecade[d] || 0, config.maxPerDecade)
    )
    .join("");

  const genreRows = config.genres
    .map((g) => limitRow(g, counts.perGenre[g] || 0, config.maxPerGenre))
    .join("");

  el.innerHTML = `
    <div class="limits-cols">
      <div>
        <h3>Per tiår <span class="muted">(maks ${config.maxPerDecade})</span></h3>
        <div class="limit-list">${decadeRows}</div>
      </div>
      <div>
        <h3>Per sjanger <span class="muted">(maks ${config.maxPerGenre})</span></h3>
        <div class="limit-list">${genreRows}</div>
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

// ----------------------------------------------------------------------------
//  Forslagsliste
// ----------------------------------------------------------------------------

export function renderArtists(el, state) {
  const { artists, filters, isTeacher, clientId, config, handlers } = state;

  let list = [...artists];

  // Skjul fjernede med mindre lærer har huket av "vis fjernede"
  if (!filters.showRemoved) {
    list = list.filter((a) => a.status === "active");
  }
  if (filters.genre) list = list.filter((a) => a.genre === filters.genre);
  if (filters.decade)
    list = list.filter((a) => String(a.decade) === String(filters.decade));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.geography || "").toLowerCase().includes(q)
    );
  }

  // Sortering: tiår, så navn
  list.sort((a, b) => a.decade - b.decade || a.name.localeCompare(b.name, "no"));

  if (list.length === 0) {
    el.innerHTML = `<p class="muted empty">Ingen forslag matcher filteret ennå.</p>`;
    return;
  }

  el.innerHTML = list
    .map((a) => artistCard(a, { isTeacher, clientId, config }))
    .join("");

  // Koble på knappehandlinger
  el.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { action, id } = btn.dataset;
      handlers[action]?.(id);
    });
  });
}

function artistCard(a, { isTeacher, clientId, config }) {
  const votes = (a.votedOutBy || []).length;
  const hasVoted = (a.votedOutBy || []).includes(clientId);
  const removed = a.status === "removed";

  const links = (a.links || [])
    .map(
      (l) =>
        `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
          🎵 ${escapeHtml(l.label || "Lytt")}
        </a>`
    )
    .join("");

  const removedBadge = removed
    ? `<span class="badge removed">${
        a.removedBy === "teacher" ? "Fjernet av lærer" : "Stemt ut"
      }</span>`
    : "";

  const protectedBadge = a.teacherProtected
    ? `<span class="badge protected" title="Beskyttet av lærer mot utstemming">🛡️</span>`
    : "";

  // Studenthandlinger
  let voteBtn = "";
  if (!removed) {
    voteBtn = hasVoted
      ? `<button class="btn ghost" data-action="undoVote" data-id="${a.id}">↩︎ Angre stemme</button>`
      : `<button class="btn ghost danger" data-action="vote" data-id="${a.id}">⚑ Ikke relevant</button>`;
  }

  // Lærerhandlinger
  let teacherBtns = "";
  if (isTeacher) {
    teacherBtns = `
      <div class="teacher-actions">
        ${
          removed
            ? `<button class="btn small" data-action="restore" data-id="${a.id}">Gjenopprett</button>`
            : `<button class="btn small" data-action="remove" data-id="${a.id}">Fjern (veto)</button>`
        }
        <button class="btn small danger" data-action="del" data-id="${a.id}">Slett</button>
      </div>`;
  }

  return `
    <article class="card ${removed ? "is-removed" : ""}">
      <header class="card-head">
        <div>
          <h3>${escapeHtml(a.name)} ${removedBadge} ${protectedBadge}</h3>
          <div class="meta">
            <span class="tag">${escapeHtml(a.genre)}</span>
            <span class="tag">${a.decade}-tallet</span>
            ${a.birthYear ? `<span class="tag">f. ${a.birthYear}</span>` : ""}
            <span class="tag gender-${a.gender}">${
    GENDER_LABEL[a.gender] || "Ukjent"
  }</span>
            ${a.geography ? `<span class="tag">📍 ${escapeHtml(a.geography)}</span>` : ""}
          </div>
        </div>
      </header>

      ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ""}
      ${
        a.keyWorks
          ? `<p class="works"><strong>Sentrale verk:</strong> ${escapeHtml(
              a.keyWorks
            )}</p>`
          : ""
      }
      ${links ? `<div class="links">${links}</div>` : ""}

      <footer class="card-foot">
        <span class="proposed muted">Foreslått av ${escapeHtml(
          a.proposedBy || "Anonym"
        )}</span>
        <span class="vote-count muted" title="Utstemminger">
          ⚑ ${votes}/${config.voteOutThreshold}
        </span>
        <div class="spacer"></div>
        ${voteBtn}
      </footer>
      ${teacherBtns}
    </article>
  `;
}

// ----------------------------------------------------------------------------
//  Hjelpere for skjema (fyll inn select-bokser fra konfig)
// ----------------------------------------------------------------------------

export function fillSelect(select, values, { placeholder } = {}) {
  const current = select.value;
  select.innerHTML =
    (placeholder ? `<option value="">${placeholder}</option>` : "") +
    values
      .map((v) => {
        const value = typeof v === "object" ? v.value : v;
        const label = typeof v === "object" ? v.label : v;
        return `<option value="${escapeHtml(value)}">${escapeHtml(
          label
        )}</option>`;
      })
      .join("");
  if (current) select.value = current;
}

function pct(n, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((n / max) * 100));
}
