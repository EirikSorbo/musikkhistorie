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
import { GENEALOGY_GENRES } from "./genealogy.js";

// Slektstre-sjangrene danner «sjanger»-laget; resten av taggene er undersjangre.
const SJANGER_SET = new Set(GENEALOGY_GENRES.map((g) => g.toLowerCase()));

window._modalZ = window._modalZ || 100;
export function modalOpen(el) { el.style.zIndex = ++window._modalZ; el.classList.add("open"); }
export function modalClose(el) { el.classList.remove("open"); }
export function modalCloseTop() {
  const open = [...document.querySelectorAll(".modal-backdrop.open")];
  if (!open.length) return;
  open.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));
  modalClose(open[open.length - 1]);
}
export function modalCloseAll() {
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => modalClose(m));
}

// Konverter eksisterende ✕-knapp til ←-tilbakeknapp og injiser ny ✕ for "lukk alle".
function initModalHeaders() {
  document.querySelectorAll(".modal-head").forEach((head) => {
    const closeBtn = head.querySelector(".modal-close");
    if (!closeBtn || head.querySelector(".modal-close-all")) return;
    closeBtn.innerHTML = "&larr;";
    closeBtn.title = "Tilbake";
    const closeAll = document.createElement("button");
    closeAll.type = "button";
    closeAll.className = "modal-close-all btn ghost small";
    closeAll.innerHTML = "&times;";
    closeAll.title = "Lukk alle";
    closeAll.addEventListener("click", modalCloseAll);
    closeBtn.parentNode.insertBefore(closeAll, closeBtn.nextSibling);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModalHeaders);
} else {
  initModalHeaders();
}

// Bygger en strukturert kilde-liste (brukt på artist, sjanger og tiår).
export function buildKilderList(kilder, label = "Kilder") {
  if (!Array.isArray(kilder) || !kilder.length) return "";
  const items = kilder.map((k) => {
    const text = escapeHtml(k.text || "");
    return k.url
      ? `<li><a href="${escapeHtml(k.url)}" target="_blank" rel="noopener">${text}</a></li>`
      : `<li>${text}</li>`;
  }).join("");
  return `<div class="kilder"><strong>${escapeHtml(label)}:</strong><ul>${items}</ul></div>`;
}

// Bygger sjanger- og undersjanger-bobler (begge klikkbare filtre).
function genreTags(a) {
  const sjanger = Array.isArray(a.sjangre) ? a.sjangre : [];
  const under = Array.isArray(a.undersjangre) ? a.undersjangre : [];
  return [
    ...sjanger.map((s) => `<button class="tag tag-sjanger" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
    ...under.map((s) => `<button class="tag tag-under" data-under="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
  ].join("");
}

function yearLabel(w) {
  const y = w.year || null;
  if (y) return `(${y})`;
  return "";
}

function musicExampleLabel(m) {
  const y = m.year || null;
  const p = m.performanceYear || null;
  if (y && p && p !== y) return ` (${y}, framføring ${p})`;
  if (y) return ` (${y})`;
  if (p) return ` (framføring ${p})`;
  return "";
}

function keyWorksText(works) {
  if (!Array.isArray(works) || !works.length) return "";
  return works.map((w) => {
    const t = escapeHtml(w.title || "");
    const y = yearLabel(w);
    const ySuffix = y ? ` ${y}` : "";
    return w.url
      ? `<a href="${escapeHtml(w.url)}" target="_blank" rel="noopener">${t}</a>${ySuffix}`
      : `${t}${ySuffix}`;
  }).join(", ");
}

const kilderHtml = (kilder) => buildKilderList(kilder, "Kilder");

function artistImage(a, big = false) {
  if (!a.imageUrl) return "";
  const credit = a.imageCredit ? `<span class="image-credit">${escapeHtml(a.imageCredit)}</span>` : "";
  return `<figure class="artist-image ${big ? "big" : ""}">
    <img src="${escapeHtml(a.imageUrl)}" alt="${escapeHtml(a.name)}" loading="lazy" />
    ${credit}
  </figure>`;
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const ABBREVS = /(?:ca|f\.eks|bl\.a|dvs|mfl|nr|St|vs|evt|pga|ifm|ift|jf|kl|mrd|mill)\.\s*$/;
const CONT = /^(Fortsatt|Også|Samtidig|Dessuten|I tillegg|Likevel|Imidlertid|Derimot|Dermed|Slik|Dette|Disse|Den samme|Det samme)\b/i;

function splitSentences(text) {
  const raw = text.split(/(?<=\.)\s+/).filter(s => s.trim());
  const merged = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    if (ABBREVS.test(merged[merged.length - 1]) || /^\d/.test(raw[i].trim()) || !/^[A-ZÆØÅ]/.test(raw[i].trim())) {
      merged[merged.length - 1] += " " + raw[i].trim();
    } else {
      merged.push(raw[i].trim());
    }
  }
  const grouped = [merged[0]];
  for (let i = 1; i < merged.length; i++) {
    if (CONT.test(merged[i].trim())) {
      grouped[grouped.length - 1] += " " + merged[i].trim();
    } else {
      grouped.push(merged[i].trim());
    }
  }
  return grouped;
}

export function formatInfoText(text) {
  if (!text) return "";
  const hasBullets = /^[•\-–]\s/m.test(text);
  if (!hasBullets) {
    const grouped = splitSentences(text);
    if (grouped.length > 1) {
      return "<ul>" + grouped.map(s => `<li>${escapeHtml(s)}</li>`).join("") + "</ul>";
    }
    return `<p>${escapeHtml(text.trim())}</p>`;
  }
  const lines = text.split("\n");
  let html = "";
  let inList = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (inList) { html += "</ul>"; inList = false; }
      continue;
    }
    const bullet = trimmed.match(/^[•\-–]\s*(.*)/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${escapeHtml(bullet[1])}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${escapeHtml(trimmed)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function extractBullets(text) {
  const hasBullets = /^[•\-–]\s/m.test(text);
  if (hasBullets) {
    return text.split("\n").map(l => l.trim()).filter(l => /^[•\-–]\s/.test(l)).map(l => l.replace(/^[•\-–]\s*/, ""));
  }
  return splitSentences(text);
}

function shortDesc(text) {
  const first = text.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (first.length <= 70) return first;
  const cut = first.lastIndexOf(" ", 67);
  return first.slice(0, cut > 30 ? cut : 67) + "…";
}

export function buildTimeline(text, decadeId) {
  if (!text) return "";
  const bullets = extractBullets(text);
  if (bullets.length < 2) return "";
  const startYear = parseInt(decadeId, 10);
  const events = bullets.map(b => {
    const m = b.match(/\b(1[5-9]\d{2}|20[0-2]\d)\b/);
    return { year: m ? parseInt(m[1], 10) : null, text: b };
  });
  events.sort((a, b) => (a.year || startYear) - (b.year || startYear));
  let html = '<div class="timeline"><div class="tl-track">';
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const label = ev.year ? String(ev.year) : `${startYear}‑årene`;
    const pos = i % 2 === 0 ? "below" : "above";
    html += `<div class="tl-item tl-${pos}"><div class="tl-dot"></div><div class="tl-label"><span class="tl-year">${escapeHtml(label)}</span><span class="tl-desc">${escapeHtml(shortDesc(ev.text))}</span></div></div>`;
  }
  html += "</div></div>";
  return html;
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
  const pending = artists.filter((a) => a.status === "pending").length;
  const subgenreCount = new Set(
    artists.filter(a => a.status === "active").flatMap(a => [...(a.sjangre || []), ...(a.undersjangre || [])])
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
      ${pending ? `<div class="stat-card stat-pending">
        <div class="stat-num">${pending}</div>
        <div class="stat-label">Venter på godkjenning</div>
      </div>` : ""}
      <div class="stat-card">
        <div class="stat-num">${removed}</div>
        <div class="stat-label">Fjernet / utstemt</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${subgenreCount}</div>
        <div class="stat-label">Undersjangre</div>
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
    const works = Array.isArray(a.keyWorks) ? a.keyWorks : [];
    const firstTitle = works[0]?.title || "";
    const workSnippet = firstTitle
      ? escapeHtml(firstTitle) + (works.length > 1 ? ` <span class="muted">(+${works.length - 1} til)</span>` : "")
      : "";
    const sjanger = Array.isArray(a.sjangre) ? a.sjangre : [];
    const under = Array.isArray(a.undersjangre) ? a.undersjangre : [];
    const tags = [
      ...sjanger.map((s) => `<button class="tag tag-sjanger" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
      ...under.map((s) => `<button class="tag tag-under" data-under="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
      a.instrument ? `<button class="tag tag-instrument" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : "",
    ].filter(Boolean).join("");
    return `
    <div class="result-row" data-id="${escapeHtml(a.id)}" tabindex="0" role="button">
      <span class="result-name result-link">${escapeHtml(a.name)}</span>
      <span class="result-meta">
        ${tags}
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
    div.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
    div.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}

// Full innholdsvisning for detaljmodal (kun lesemodus)
export function renderArtistDetail(el, artist, config) {
  const a = artist;
  const examplesHtml = (a.musicExamples || [])
    .map((m) => `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.label || "Lytt")}${musicExampleLabel(m)}</a>`)
    .join("");
  const worksHtml = keyWorksText(a.keyWorks);
  el.innerHTML = `
    ${artistImage(a, true)}
    ${factsLines(a)}
    <div class="meta" style="margin-bottom:12px">
      ${a.instrument ? `<button class="tag tag-instrument" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
      ${genreTags(a)}
    </div>
    ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ""}
    ${worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : ""}
    ${examplesHtml ? `<div class="links">${examplesHtml}</div>` : ""}
    ${kilderHtml(a.kilder)}
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
  const examplesHtml = (a.musicExamples || [])
    .map(
      (m) =>
        `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">
          ${escapeHtml(m.label || "Lytt")}${musicExampleLabel(m)}
        </a>`
    )
    .join("");
  const worksHtml = keyWorksText(a.keyWorks);

  return `
    <article class="card">
      <header class="card-head">
        ${artistImage(a)}
        <h3>${escapeHtml(a.name)}</h3>
        ${factsLines(a)}
        <div class="meta">
          ${a.instrument ? `<button class="tag tag-instrument" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
          ${genreTags(a)}
        </div>
      </header>
      ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ""}
      ${worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : ""}
      ${examplesHtml ? `<div class="links">${examplesHtml}</div>` : ""}
      ${kilderHtml(a.kilder)}
    </article>
  `;
}

export function renderArtists(el, state) {
  const { artists, filters, isTeacher, clientId, config, handlers } = state;

  let list = [...artists];

  if (filters.showPending) {
    list = list.filter((a) => a.status === "pending");
  } else if (!filters.showRemoved) {
    list = list.filter((a) => a.status === "active");
  }
  if (filters.sjanger) {
    const sj = filters.sjanger.toLowerCase();
    list = list.filter((a) => a.genre === filters.sjanger
      || (a.sjangre || []).some((s) => s.toLowerCase() === sj)
      || (a.undersjangre || []).some((s) => s.toLowerCase() === sj));
  }
  if (filters.genre) list = list.filter((a) => a.genre === filters.genre);
  if (filters.instrument) list = list.filter((a) => a.instrument === filters.instrument);
  if (filters.decade) {
    const fd = Number(filters.decade);
    list = list.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(fd));
  }
  if (filters.subgenre) {
    const sg = filters.subgenre;
    list = list.filter((a) => (a.undersjangre || []).includes(sg) || (a.sjangre || []).includes(sg));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.geography || "").toLowerCase().includes(q) ||
        (a.sjangre || []).some(s => s.toLowerCase().includes(q)) ||
        (a.undersjangre || []).some(s => s.toLowerCase().includes(q))
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
  const pending = a.status === "pending";
  const vetoed = a.teacherVetoed === true;

  const examplesHtml = (a.musicExamples || [])
    .map(
      (m) =>
        `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">
          ${escapeHtml(m.label || "Lytt")}${musicExampleLabel(m)}
        </a>`
    )
    .join("");

  const removedBadge = removed
    ? `<span class="badge removed">${
        a.removedBy === "teacher" ? "Fjernet av lærer" : "Fjernet"
      }</span>`
    : "";

  const pendingBadge = pending
    ? `<span class="badge pending">Venter på godkjenning</span>`
    : "";

  const vetoBadge = vetoed
    ? `<span class="badge veto" title="Inkludert av lærer">Veto</span>`
    : "";

  // Studenthandlinger
  let voteBtn = "";
  if (!removed && !pending) {
    voteBtn = hasUpvoted
      ? `<button class="btn ghost" data-action="undoVoteUp" data-id="${a.id}">Angre stemme</button>`
      : `<button class="btn ghost accent" data-action="voteUp" data-id="${a.id}">Svært relevant</button>`;
  }

  // Lærerhandlinger
  let teacherBtns = "";
  if (isTeacher && pending) {
    teacherBtns = `
      <div class="teacher-actions">
        <button class="btn small primary" data-action="approve" data-id="${a.id}">Godkjenn</button>
        <button class="btn small danger" data-action="reject" data-id="${a.id}">Avvis</button>
        <button class="btn small" data-action="edit" data-id="${a.id}">Rediger</button>
      </div>`;
  } else if (isTeacher) {
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

  const worksHtml = keyWorksText(a.keyWorks);

  return `
    <article class="card ${removed ? "is-removed" : ""} ${pending ? "is-pending" : ""} ${vetoed ? "is-vetoed" : ""}">
      <header class="card-head">
        ${artistImage(a)}
        <div>
          <h3>${escapeHtml(a.name)} ${pendingBadge} ${removedBadge} ${vetoBadge}</h3>
          ${factsLines(a, { showGender: isTeacher })}
          <div class="meta">
            ${a.instrument ? `<button class="tag tag-instrument" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
            ${genreTags(a)}
          </div>
        </div>
      </header>

      ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ""}
      ${worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : ""}
      ${examplesHtml ? `<div class="links">${examplesHtml}</div>` : ""}
      ${kilderHtml(a.kilder)}

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

// Faktalinjer under tittel: levetid, innflytelse, kjønn (kun lærer), virkested.
// Vises som tekst (samme format som «Sentrale verk»), ikke som bobler.
function factsLines(a, { showGender = false } = {}) {
  const rows = [];
  if (a.birthYear && a.deathYear) rows.push(["Levetid", `f. ${a.birthYear} – d. ${a.deathYear}`]);
  else if (a.birthYear) rows.push(["Født", `${a.birthYear}`]);
  else if (a.deathYear) rows.push(["Død", `${a.deathYear}`]);
  if (a.influenceStart) {
    const p = (!a.influenceEnd || a.influenceEnd === a.influenceStart)
      ? `ca. ${a.influenceStart}`
      : `${a.influenceStart}–${a.influenceEnd}`;
    rows.push(["Innflytelse", p]);
  }
  if (showGender) rows.push(["Kjønn", GENDER_LABEL[a.gender] || "Ukjent"]);
  if (a.geography) rows.push(["Virkested", a.geography]);
  if (!rows.length) return "";
  return `<div class="facts">${rows.map(([l, v]) => `<p><strong>${l}:</strong> ${escapeHtml(v)}</p>`).join("")}</div>`;
}

function pct(n, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((n / max) * 100));
}

// Vis undersjanger-beskrivelse i #modal-sjanger (samme popup som sjanger).
export function showSubsjangerInfo(label, { root = document, subgenreDescs = {}, onShowArtists, onShowPlaylist, onEdit } = {}) {
  const modal = root.querySelector("#modal-sjanger");
  const mTitle = root.querySelector("#sj-title");
  const mBody = root.querySelector("#sj-body");
  if (!modal || !mTitle || !mBody) return;

  const desc = subgenreDescs[label];
  const descText = desc?.description || "Ingen beskrivelse ennå.";
  const kilder = Array.isArray(desc?.kilder) ? desc.kilder : [];

  const btnArea = [
    onShowArtists ? `<button type="button" class="btn ghost small gx-artists-btn">Vis artister</button>` : "",
    onShowPlaylist ? `<button type="button" class="btn ghost small gx-playlist-btn">Vis spilleliste</button>` : "",
    onEdit ? `<button type="button" class="btn ghost small gx-edit-btn">Rediger</button>` : "",
  ].filter(Boolean).join(" ");

  mTitle.textContent = label;
  mBody.innerHTML = `
    <p class="gx-desc">${escapeHtml(descText)}</p>
    ${buildKilderList(kilder, "Kilder")}
    ${btnArea ? `<div style="margin-top:10px;display:flex;gap:8px">${btnArea}</div>` : ""}`;
  const b = mBody.querySelector(".gx-artists-btn");
  if (b) b.addEventListener("click", () => onShowArtists({ label }));
  const bp = mBody.querySelector(".gx-playlist-btn");
  if (bp) bp.addEventListener("click", () => onShowPlaylist({ label, fullName: label, node: { l: label } }));
  const be = mBody.querySelector(".gx-edit-btn");
  if (be) be.addEventListener("click", () => onEdit(label));
  modalOpen(modal);
}

// Bygger en slim artist-liste (result-row) for sjanger-popup og slektstre.
// Returnerer HTML-streng med rader som har data-artist-id for klikk-kobling.
export function buildArtistListRows(list) {
  return list.map((a) => {
    const years = a.influenceStart
      ? `${a.influenceStart}${a.influenceEnd ? "–" + a.influenceEnd : ""}`
      : "";
    const sjanger = Array.isArray(a.sjangre) ? a.sjangre : [];
    const under = Array.isArray(a.undersjangre) ? a.undersjangre : [];
    const tags = [
      ...sjanger.map((s) => `<button class="tag tag-sjanger" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
      ...under.map((s) => `<button class="tag tag-under" data-under="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
      a.instrument ? `<button class="tag tag-instrument" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : "",
    ].filter(Boolean).join("");
    return `<div class="result-row" data-artist-id="${escapeHtml(a.id)}" tabindex="0" role="button">
      <span class="result-name result-link">${escapeHtml(a.name)}</span>
      <span class="result-meta">
        ${tags}
        ${years ? `<span class="result-work">${years}</span>` : ""}
      </span>
    </div>`;
  }).join("");
}

// Bygger HTML for spilleliste-popup: keyWorks/lenker fra artister, med sjanger-tag per rad.
export function buildPlaylistHtml(node, artists) {
  const enc = encodeURIComponent;
  const sj = (node.l || "").toLowerCase();
  const ytLink = (q, text) =>
    `<a href="https://www.youtube.com/results?search_query=${enc(q)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;

  const matchesSj = (a) => {
    if (a.genre === node.l) return true;
    const all = [...(a.sjangre || []), ...(a.undersjangre || [])];
    return all.some((s) => String(s).toLowerCase() === sj);
  };

  const genreArtists = (artists || [])
    .filter((a) => a.status === "active" && matchesSj(a))
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));

  const seen = new Set();
  const items = genreArtists.flatMap((a) => {
    const rows = [];
    const nameLow = a.name.toLowerCase();
    const sjangerTag = (a.sjangre || [])
      .map((s) => `<button class="tag tag-sjanger tag-pl" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
      .join("");
    (a.musicExamples || []).forEach((m) => {
      const key = `${nameLow}|${(m.label || m.url).toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const yInfo = musicExampleLabel(m);
      rows.push(`<li class="pl-item"><a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.label || m.url)}${yInfo}</a> <span class="muted">— ${escapeHtml(a.name)}</span> ${sjangerTag}</li>`);
    });
    (a.keyWorks || []).forEach((w) => {
      const title = w.title || "";
      if (!title) return;
      const key = `${nameLow}|${title.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const yLabel = yearLabel(w);
      const yr = yLabel ? ` <span class="muted">${escapeHtml(yLabel)}</span>` : "";
      const link = w.url
        ? `<a href="${escapeHtml(w.url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`
        : ytLink(`${title} ${a.name}`, title);
      rows.push(`<li class="pl-item">${link}${yr} <span class="muted">— ${escapeHtml(a.name)}</span> ${sjangerTag}</li>`);
    });
    return rows;
  });

  const total = items.length;
  if (!total) return { total: 0, html: `<p class="muted empty">Ingen musikkeksempler registrert for denne sjangeren ennå.</p>` };
  return { total, html: `<ul class="pl-list">${items.join("")}</ul>` };
}
