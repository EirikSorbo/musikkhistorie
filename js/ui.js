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
  limitForDecade,
  limitForGenre,
  limitForInstrument,
  decadesForRange,
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
  const subgenreCount = new Set(
    artists.filter(a => a.status === "active").flatMap(a => a.subgenres || [])
  ).size;

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
      <div class="stat-card">
        <div class="stat-num">${subgenreCount}</div>
        <div class="stat-label">Undersjangre</div>
        <button class="btn ghost small" id="btn-subgenre-list" style="margin-top:8px">Vis alle</button>
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
      limitRow(`${d}-tallet`, counts.perDecade[d] || 0, limitForDecade(config, d))
    )
    .join("");

  const genreRows = config.genres
    .map((g) => limitRow(g, counts.perGenre[g] || 0, limitForGenre(config, g)))
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

// ----------------------------------------------------------------------------
//  Forslagsliste
// ----------------------------------------------------------------------------

// Kompakt klikkbar liste når filtre er aktive
export function renderResultList(el, artists, config, onSelect) {
  el.className = "result-list";
  if (!artists.length) {
    el.innerHTML = `<p class="muted empty">Ingen forslag matcher filteret.</p>`;
    return;
  }
  const sorted = [...artists].sort(
    (a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no")
  );
  el.innerHTML = sorted.map((a) => {
    const works = (a.keyWorks || "").split(",").map(s => s.trim()).filter(Boolean);
    const workSnippet = works.length
      ? escapeHtml(works[0]) + (works.length > 1 ? ` <span class="muted">(+${works.length - 1} til)</span>` : "")
      : "";
    return `
    <div class="result-row" data-id="${escapeHtml(a.id)}" tabindex="0" role="button">
      <span class="result-name">${escapeHtml(a.name)}</span>
      <span class="result-meta">
        ${a.genre ? `<button class="tag tag-link" data-filter-key="genre" data-filter-val="${escapeHtml(a.genre)}">${escapeHtml(a.genre)}</button>` : ""}
        ${a.instrument ? `<button class="tag tag-link" data-filter-key="instrument" data-filter-val="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
        ${workSnippet ? `<span class="result-work">${workSnippet}</span>` : ""}
      </span>
      <span class="result-arrow">›</span>
    </div>`;
  }).join("");
  el.querySelectorAll(".result-row").forEach((div) => {
    const open = () => {
      const artist = artists.find((a) => a.id === div.dataset.id);
      if (artist) onSelect(artist);
    };
    div.addEventListener("click", (e) => { if (!e.target.closest(".tag-link")) open(); });
    div.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}

// Full innholdsvisning for detaljmodal (kun lesemodus)
export function renderArtistDetail(el, artist, config) {
  const a = artist;
  const links = (a.links || [])
    .map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label || "Lytt")}</a>`)
    .join("");
  el.innerHTML = `
    <div class="meta" style="margin-bottom:12px">
      ${a.genre ? `<button class="tag tag-link" data-filter-key="genre" data-filter-val="${escapeHtml(a.genre)}">${escapeHtml(a.genre)}</button>` : ""}
      ${a.instrument ? `<button class="tag tag-link" data-filter-key="instrument" data-filter-val="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
      ${periodTag(a)}
      ${lifespan(a)}
      <span class="tag gender-${a.gender}">${GENDER_LABEL[a.gender] || "Ukjent"}</span>
      ${a.geography ? `<span class="tag">${escapeHtml(a.geography)}</span>` : ""}
      ${(a.subgenres || []).map(s => `<button class="tag tag-sub tag-link" data-subgenre-info="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
    </div>
    ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ""}
    ${a.keyWorks ? `<p class="works"><strong>Sentrale verk:</strong> ${escapeHtml(a.keyWorks)}</p>` : ""}
    ${links ? `<div class="links">${links}</div>` : ""}
    ${(a.kilder || []).length ? `<div class="kilder"><strong>Kilder:</strong><ul>${a.kilder.map(k => `<li>${escapeHtml(k)}</li>`).join("")}</ul></div>` : ""}
    <p class="muted" style="font-size:0.8rem;margin-top:12px">Foreslått av ${escapeHtml(a.proposedBy || "Anonym")}</p>
  `;
}

// Viser 2 tilfeldig valgte artistkort (kun lesemodus, ingen knapper)
export function renderSpotlightCards(el, artists, config) {
  el.className = "spotlight-grid";
  if (!artists.length) {
    el.innerHTML = `<p class="muted empty" style="grid-column:1/-1">Ingen forslag matcher filteret ennå.</p>`;
    return;
  }
  el.innerHTML = artists.map((a) => spotlightCard(a, config)).join("");
}

function spotlightCard(a, config) {
  const links = (a.links || [])
    .map(
      (l) =>
        `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
          ${escapeHtml(l.label || "Lytt")}
        </a>`
    )
    .join("");

  return `
    <article class="card">
      <header class="card-head">
        <h3>${escapeHtml(a.name)}</h3>
        <div class="meta">
          <button class="tag tag-link" data-filter-key="genre" data-filter-val="${escapeHtml(a.genre)}">${escapeHtml(a.genre)}</button>
          ${a.instrument ? `<button class="tag tag-link" data-filter-key="instrument" data-filter-val="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
          ${periodTag(a)}
          ${lifespan(a)}
          <span class="tag gender-${a.gender}">${GENDER_LABEL[a.gender] || "Ukjent"}</span>
          ${a.geography ? `<span class="tag">${escapeHtml(a.geography)}</span>` : ""}
          ${(a.subgenres || []).map(s => `<button class="tag tag-sub tag-link" data-subgenre-info="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
        </div>
      </header>
      ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ""}
      ${a.keyWorks ? `<p class="works"><strong>Sentrale verk:</strong> ${escapeHtml(a.keyWorks)}</p>` : ""}
      ${links ? `<div class="links">${links}</div>` : ""}
      ${(a.kilder || []).length ? `<div class="kilder"><strong>Kilder:</strong><ul>${(a.kilder).map(k => `<li>${escapeHtml(k)}</li>`).join("")}</ul></div>` : ""}
    </article>
  `;
}

export function renderArtists(el, state) {
  const { artists, filters, isTeacher, clientId, config, handlers } = state;

  let list = [...artists];

  if (!filters.showRemoved) {
    list = list.filter((a) => a.status === "active");
  }
  if (filters.genre) list = list.filter((a) => a.genre === filters.genre);
  if (filters.instrument) list = list.filter((a) => a.instrument === filters.instrument);
  if (filters.decade) {
    const fd = Number(filters.decade);
    list = list.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(fd));
  }
  if (filters.subgenre) {
    const sg = filters.subgenre;
    list = list.filter((a) => (a.subgenres || []).includes(sg));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.geography || "").toLowerCase().includes(q) ||
        (a.subgenres || []).some(s => s.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));

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
  const upvotes = (a.votedUpBy || []).length;
  const hasUpvoted = (a.votedUpBy || []).includes(clientId);
  const removed = a.status === "removed";
  const vetoed = a.teacherVetoed === true;

  const links = (a.links || [])
    .map(
      (l) =>
        `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
          ${escapeHtml(l.label || "Lytt")}
        </a>`
    )
    .join("");

  const removedBadge = removed
    ? `<span class="badge removed">${
        a.removedBy === "teacher" ? "Fjernet av lærer" : "Fjernet"
      }</span>`
    : "";

  const vetoBadge = vetoed
    ? `<span class="badge veto" title="Inkludert av lærer">Veto</span>`
    : "";

  // Studenthandlinger
  let voteBtn = "";
  if (!removed) {
    voteBtn = hasUpvoted
      ? `<button class="btn ghost" data-action="undoVoteUp" data-id="${a.id}">Angre stemme</button>`
      : `<button class="btn ghost accent" data-action="voteUp" data-id="${a.id}">Svært relevant</button>`;
  }

  // Lærerhandlinger
  let teacherBtns = "";
  if (isTeacher) {
    teacherBtns = `
      <div class="teacher-actions">
        ${removed
          ? `<button class="btn small" data-action="restore" data-id="${a.id}">Gjenopprett</button>`
          : `<button class="btn small" data-action="remove" data-id="${a.id}">Fjern</button>`
        }
        ${vetoed
          ? `<button class="btn small accent" data-action="undoVeto" data-id="${a.id}" title="Fjern veto">Veto</button>`
          : `<button class="btn small" data-action="veto" data-id="${a.id}" title="Inkluder uansett">Veto</button>`
        }
        <button class="btn small" data-action="edit" data-id="${a.id}">Rediger</button>
        <button class="btn small danger" data-action="del" data-id="${a.id}">Slett</button>
      </div>`;
  }

  return `
    <article class="card ${removed ? "is-removed" : ""} ${vetoed ? "is-vetoed" : ""}">
      <header class="card-head">
        <div>
          <h3>${escapeHtml(a.name)} ${removedBadge} ${vetoBadge}</h3>
          <div class="meta">
            <span class="tag">${escapeHtml(a.genre)}</span>
            ${a.instrument ? `<span class="tag">${escapeHtml(a.instrument)}</span>` : ""}
            ${periodTag(a)}
            ${lifespan(a)}
            <span class="tag gender-${a.gender}">${GENDER_LABEL[a.gender] || "Ukjent"}</span>
            ${a.geography ? `<span class="tag">${escapeHtml(a.geography)}</span>` : ""}
            ${(a.subgenres || []).map(s => `<button class="tag tag-sub tag-link" data-subgenre-info="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
          </div>
        </div>
      </header>

      ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ""}
      ${a.keyWorks ? `<p class="works"><strong>Sentrale verk:</strong> ${escapeHtml(a.keyWorks)}</p>` : ""}
      ${links ? `<div class="links">${links}</div>` : ""}
      ${(a.kilder || []).length ? `<div class="kilder"><strong>Kilder:</strong><ul>${(a.kilder).map(k => `<li>${escapeHtml(k)}</li>`).join("")}</ul></div>` : ""}

      <footer class="card-foot">
        ${isTeacher ? `<span class="proposed muted">Foreslått av ${escapeHtml(a.proposedBy || "Anonym")}</span>` : ""}
        <span class="vote-count muted" title="Positive stemmer">${upvotes} stemmer</span>
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

function lifespan(a) {
  if (!a.birthYear && !a.deathYear) return "";
  if (a.birthYear && a.deathYear) return `<span class="tag">f. ${a.birthYear} – d. ${a.deathYear}</span>`;
  if (a.birthYear) return `<span class="tag">f. ${a.birthYear}</span>`;
  return `<span class="tag">d. ${a.deathYear}</span>`;
}

function periodTag(a) {
  if (!a.influenceStart) return "";
  if (!a.influenceEnd || a.influenceEnd === a.influenceStart) {
    return `<span class="tag">ca. ${a.influenceStart}</span>`;
  }
  return `<span class="tag">${a.influenceStart}–${a.influenceEnd}</span>`;
}

function pct(n, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((n / max) * 100));
}
