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
import { linkifyAll, linkifyArtists, wireAllLinks, wireArtistLinks, wireTechLinks } from "./linkify.js?v=222";
export { linkifyArtists };

export function buildGenreList(artists) {
  const set = new Set(GENEALOGY_GENRES);
  for (const a of (artists || [])) {
    if (a.status !== "active") continue;
    for (const s of (a.sjangre || [])) set.add(s);
    for (const s of (a.undersjangre || [])) set.add(s);
  }
  return [...set];
}

function linkDesc(text, lc) {
  if (!lc) return escapeHtml(text);
  return linkifyAll(text, lc);
}

function wireLinks(el, lc) {
  if (!lc) return;
  wireAllLinks(el, lc);
}

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

export function fmtCredit(raw) {
  if (!raw) return "";
  const text = raw.replace(/^Foto:\s*/i, "");
  return `<span class="image-credit">Foto: ${escapeHtml(text)}</span>`;
}

function artistImage(a, big = false) {
  if (!a.imageUrl) return "";
  return `<figure class="artist-image ${big ? "big" : ""}">
    <img src="${escapeHtml(a.imageUrl)}" alt="${escapeHtml(a.name)}" loading="lazy" />
    ${fmtCredit(a.imageCredit)}
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

function splitLines(text) {
  return text.split("\n").map(l => l.replace(/^[•\-–]\s*/, "").trim()).filter(Boolean);
}

export function formatInfoText(text) {
  if (!text) return "";
  const lines = splitLines(text);
  if (lines.length > 1) {
    return "<ul>" + lines.map(l => `<li>${escapeHtml(l)}</li>`).join("") + "</ul>";
  }
  return `<p>${escapeHtml(lines[0] || text.trim())}</p>`;
}

function extractBullets(text) {
  return splitLines(text);
}

const TECH_CATEGORIES = [
  "Opptak og avspilling",
  "Kringkasting og spredning",
  "Instrumenter og lydutstyr",
];

export { TECH_CATEGORIES };

export function renderTechList(el, items, activeCategory, lc) {
  const filtered = activeCategory ? items.filter(t => t.category === activeCategory) : items;
  if (!filtered.length) {
    el.innerHTML = `<p class="muted empty">Ingen teknologier i denne kategorien ennå.</p>`;
    return;
  }
  el.innerHTML = filtered.map(t => {
    const img = t.imageUrl
      ? `<figure class="artist-image"><img src="${escapeHtml(t.imageUrl)}" alt="${escapeHtml(t.name)}" loading="lazy" />${fmtCredit(t.imageCredit)}</figure>`
      : "";
    const catTag = `<span class="tag tag-tech-cat">${escapeHtml(t.category || "")}</span>`;
    const yearTag = t.adoptedLabel ? `<span class="tag tag-tech-year">${escapeHtml(t.adoptedLabel)}</span>` : "";
    return `<article class="card" data-tech-id="${escapeHtml(t.id)}">
      <header class="card-head">
        ${img}
        <h3>${escapeHtml(t.name)}</h3>
        <div class="meta">${yearTag}${catTag}</div>
      </header>
      ${t.description ? `<p class="desc">${linkDesc(t.description, lc)}</p>` : ""}
    </article>`;
  }).join("");
  wireLinks(el, lc);
}

export function renderTechDetail(el, t, lc) {
  const img = t.imageUrl
    ? `<figure class="artist-image"><img src="${escapeHtml(t.imageUrl)}" alt="${escapeHtml(t.name)}" loading="lazy" />${fmtCredit(t.imageCredit)}</figure>`
    : "";
  const yearTag = t.adoptedLabel ? `<span class="tag tag-tech-year">${escapeHtml(t.adoptedLabel)}</span>` : "";
  const catTag = `<span class="tag tag-tech-cat">${escapeHtml(t.category || "")}</span>`;
  el.innerHTML = `${img}<div class="meta" style="margin:10px 0">${yearTag}${catTag}</div>${t.description ? `<p>${linkDesc(t.description, lc)}</p>` : ""}`;
  wireLinks(el, lc);
}

function shortDesc(text) {
  const first = text.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (first.length <= 70) return first;
  const cut = first.lastIndexOf(" ", 67);
  return first.slice(0, cut > 30 ? cut : 67) + "…";
}

function layoutTimeline(events) {
  const stems = [24, 44, 64];
  const result = [];
  let lastAboveAt = -Infinity, lastBelowAt = -Infinity;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const aboveGap = e.pct - lastAboveAt;
    const belowGap = e.pct - lastBelowAt;
    let dir, stem;
    if (aboveGap >= 18 && belowGap >= 18) {
      dir = "above"; stem = stems[0];
    } else if (aboveGap >= belowGap) {
      dir = "above";
      stem = aboveGap < 10 ? stems[2] : aboveGap < 18 ? stems[1] : stems[0];
    } else {
      dir = "below";
      stem = belowGap < 10 ? stems[2] : belowGap < 18 ? stems[1] : stems[0];
    }
    if (dir === "above") lastAboveAt = e.pct; else lastBelowAt = e.pct;
    result.push({ ...e, dir, stem });
  }
  return result;
}

function buildProportionalTimeline(items, startYear) {
  if (items.length < 2) return "";
  const minY = Math.min(...items.map(e => e.year || startYear));
  const maxY = Math.max(...items.map(e => e.year || startYear + 9));
  const span = Math.max(maxY - minY, 1);
  const pad = 4;
  const mapped = items.map(e => ({
    ...e,
    pct: pad + ((e.year || startYear) - minY) / span * (100 - 2 * pad),
  }));
  const laid = layoutTimeline(mapped);
  const maxStem = Math.max(...laid.map(e => e.stem));
  let html = `<div class="timeline tl-prop" style="--tl-max-stem:${maxStem}px"><div class="tl-track">`;
  for (const ev of laid) {
    const edge = ev.pct <= 12 ? " tl-start" : ev.pct >= 88 ? " tl-end" : "";
    const posStyle = `left:${ev.pct.toFixed(1)}%;--stem:${ev.stem}px`;
    const extra = ev.attrs ? ev.attrs.replace(/style="/, `style="${posStyle};`) : `style="${posStyle}"`;
    html += `<div class="tl-item tl-${ev.dir}${edge}" ${extra}>` +
      `<div class="tl-dot"></div><div class="tl-stem"></div>` +
      `<div class="tl-label"><span class="tl-year">${escapeHtml(ev.label)}</span>` +
      `<span class="tl-desc">${escapeHtml(ev.desc)}</span></div></div>`;
  }
  html += "</div></div>";
  return html;
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
  const items = events.map(ev => ({
    year: ev.year,
    label: ev.year ? String(ev.year) : `${startYear}‑årene`,
    desc: shortDesc(ev.text),
  }));
  return buildProportionalTimeline(items, startYear);
}

export function buildTechTimeline(techItems, decadeId) {
  const d = String(decadeId);
  const filtered = techItems.filter(t => t.decade === d);
  if (filtered.length < 2) return "";
  filtered.sort((a, b) => (a.adoptedYear || 0) - (b.adoptedYear || 0));
  const startYear = parseInt(d, 10);
  const items = filtered.map(t => ({
    year: t.adoptedYear || null,
    label: t.adoptedYear ? String(t.adoptedYear) : `${d}+`,
    desc: t.name,
    attrs: ` data-tech-id="${escapeHtml(t.id)}" style="cursor:pointer"`,
  }));
  return buildProportionalTimeline(items, startYear);
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

export function renderDashboard(el, { artists, config, subgenreDescs = {} }) {
  const counts = computeCounts(artists);
  const dist = genderDistribution(artists);
  const removed = artists.filter((a) => a.status === "removed").length;
  const pending = artists.filter((a) => a.status === "pending").length;
  const checked = artists.filter((a) => a.status === "active" && a.teacherChecked === true).length;
  const activeArtists = artists.filter(a => a.status === "active");
  const subgenreCount = new Set(
    activeArtists.flatMap(a => [...(a.sjangre || []), ...(a.undersjangre || [])])
  ).size;

  const artistsNoSjanger = activeArtists
    .filter(a => !a.sjangre || a.sjangre.length === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));

  const allArtistTags = new Set(activeArtists.flatMap(a => [...(a.sjangre || []), ...(a.undersjangre || [])]));
  const orphanedSubgenres = Object.keys(subgenreDescs)
    .filter(s => !allArtistTags.has(s))
    .sort((a, b) => a.localeCompare(b, "no"));

  const noSjangerHtml = artistsNoSjanger.length
    ? artistsNoSjanger.map(a =>
        `<div class="result-row"><span class="result-name">${escapeHtml(a.name)}</span><span class="result-meta">${a.genre ? `<span class="tag">${escapeHtml(a.genre)}</span>` : ""}</span></div>`
      ).join("")
    : `<p class="muted">Ingen.</p>`;

  const orphanHtml = orphanedSubgenres.length
    ? orphanedSubgenres.map(s =>
        `<div class="result-row"><span class="result-name">${escapeHtml(s)}</span></div>`
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
        <div class="stat-label">Fjernet / utstemt</div>
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
    if (!visible) panel.innerHTML = `<div class="result-list">${orphanHtml}</div>`;
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
export function renderArtistDetail(el, artist, config, lc) {
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
    ${a.description ? `<p class="desc">${linkDesc(a.description, lc)}</p>` : ""}
    ${worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : ""}
    ${examplesHtml ? `<div class="links">${examplesHtml}</div>` : ""}
    ${kilderHtml(a.kilder)}
  `;
  wireLinks(el, lc);
}

// Viser 2 tilfeldig valgte artistkort (kun lesemodus, ingen knapper)
export function renderSpotlightCards(el, artists, config, lc) {
  el.className = "spotlight-grid";
  if (!artists.length) {
    el.innerHTML = `<p class="muted empty" style="grid-column:1/-1">Ingen forslag matcher filteret ennå.</p>`;
    return;
  }
  el.innerHTML = artists.map((a) => spotlightCard(a, config, lc)).join("");
  wireLinks(el, lc);
}

function spotlightCard(a, config, lc) {
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
      ${a.description ? `<p class="desc">${linkDesc(a.description, lc)}</p>` : ""}
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
  if (filters.hideChecked) list = list.filter((a) => !a.teacherChecked);
  if (filters.priority) list = list.filter((a) => (a.priority || 0) === filters.priority);
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
    const qn = q.replace(/[.\-]/g, "");
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.name.toLowerCase().replace(/[.\-]/g, "").includes(qn) ||
        (a.geography || "").toLowerCase().includes(q) ||
        (a.sjangre || []).some(s => s.toLowerCase().includes(q)) ||
        (a.undersjangre || []).some(s => s.toLowerCase().includes(q))
    );
  }

  const hasFilter = filters.search || filters.sjanger || filters.genre || filters.instrument || filters.decade || filters.subgenre || filters.priority;
  if (hasFilter) {
    list.sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));
  } else {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  if (list.length === 0) {
    el.innerHTML = `<p class="muted empty">Ingen forslag matcher filteret ennå.</p>`;
    return;
  }

  const linkCtx = state.linkCtx;
  el.innerHTML = list
    .map((a) => artistCard(a, { isTeacher, clientId, config, linkCtx }))
    .join("");
  wireLinks(el, linkCtx);

  // Koble på knappehandlinger
  el.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { action, id } = btn.dataset;
      handlers[action]?.(id);
    });
  });
}

function artistCard(a, { isTeacher, clientId, config, linkCtx }) {
  const upvotes = (a.votedUpBy || []).length;
  const hasUpvoted = (a.votedUpBy || []).includes(clientId);
  const removed = a.status === "removed";
  const pending = a.status === "pending";
  const prio = a.priority || 0;

  const examplesHtml = (a.musicExamples || [])
    .map(
      (m) =>
        `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">
          ${escapeHtml(m.label || "Lytt")}${musicExampleLabel(m)}
        </a>`
    )
    .join("");

  const checked = a.teacherChecked === true;

  const removedBadge = removed
    ? `<span class="badge removed">${
        a.removedBy === "teacher" ? "Fjernet av lærer" : "Fjernet"
      }</span>`
    : "";

  const pendingBadge = pending
    ? `<span class="badge pending">Venter på godkjenning</span>`
    : "";

  const PRIO_LABELS = { 3: "Viktigst", 2: "Viktig", 1: "Mindre viktig" };
  const prioBadge = prio
    ? `<span class="badge prio-${prio}" title="${PRIO_LABELS[prio]}">${PRIO_LABELS[prio]}</span>`
    : "";

  // Studenthandlinger
  let voteBtn = "";
  if (!removed && !pending) {
    voteBtn = hasUpvoted
      ? `<button class="btn ghost" data-action="undoVoteUp" data-id="${a.id}">Angre stemme</button>`
      : `<button class="btn ghost accent" data-action="voteUp" data-id="${a.id}">Svært relevant</button>`;
  }

  const ico = (d, stroke = "currentColor") => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const ICO_CHECK = ico("M20 6L9 17l-5-5");
  const ICO_EDIT = ico("M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7") + ico("M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5");
  const ICO_BAN = ico("M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636");
  const ICO_TRASH = ico("M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2");
  const ICO_RESTORE = ico("M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8") + ico("M21 3v5h-5");
  const ICO_APPROVE = ico("M22 11.08V12a10 10 0 11-5.93-9.14") + ico("M22 4L12 14.01l-3-3");
  const ICO_REJECT = ico("M18 6L6 18M6 6l12 12");
  const ICO_STAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  const ICO_ALERT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const ICO_THUMB = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>`;

  // Lærerhandlinger
  let teacherBtns = "";
  if (isTeacher && pending) {
    teacherBtns = `
      <div class="teacher-actions">
        <button class="icon-btn primary" data-action="approve" data-id="${a.id}" title="Godkjenn">${ICO_APPROVE}</button>
        <button class="icon-btn danger" data-action="reject" data-id="${a.id}" title="Avvis">${ICO_REJECT}</button>
        <button class="icon-btn" data-action="edit" data-id="${a.id}" title="Rediger">${ICO_EDIT}</button>
      </div>`;
  } else if (isTeacher) {
    teacherBtns = `
      <div class="teacher-actions">
        <div class="ta-left">
          <button class="icon-btn ${checked ? "active" : ""}" data-action="toggleCheck" data-id="${a.id}" title="${checked ? "Fjern avhuking" : "Merk som sjekket"}">${ICO_CHECK}</button>
        </div>
        <div class="ta-center">
          <button class="icon-btn ${prio === 3 ? "active" : ""}" data-action="priority3" data-id="${a.id}" title="Viktigst">${ICO_STAR}</button>
          <button class="icon-btn ${prio === 2 ? "active" : ""}" data-action="priority2" data-id="${a.id}" title="Viktig">${ICO_ALERT}</button>
          <button class="icon-btn ${prio === 1 ? "active" : ""}" data-action="priority1" data-id="${a.id}" title="Mindre viktig">${ICO_THUMB}</button>
        </div>
        <div class="ta-right">
          ${removed
            ? `<button class="icon-btn" data-action="restore" data-id="${a.id}" title="Gjenopprett">${ICO_RESTORE}</button>`
            : `<button class="icon-btn" data-action="remove" data-id="${a.id}" title="Fjern">${ICO_BAN}</button>`
          }
          <button class="icon-btn" data-action="edit" data-id="${a.id}" title="Rediger">${ICO_EDIT}</button>
          <button class="icon-btn danger" data-action="del" data-id="${a.id}" title="Slett">${ICO_TRASH}</button>
        </div>
      </div>`;
  }

  const worksHtml = keyWorksText(a.keyWorks);

  return `
    <article class="card ${removed ? "is-removed" : ""} ${pending ? "is-pending" : ""} ${prio ? "is-prio-" + prio : ""} ${checked ? "is-checked" : ""}">
      <header class="card-head">
        ${artistImage(a)}
        <div>
          <h3>${escapeHtml(a.name)} ${pendingBadge} ${removedBadge} ${prioBadge}</h3>
          ${factsLines(a, { showGender: isTeacher })}
          <div class="meta">
            ${a.instrument ? `<button class="tag tag-instrument" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
            ${genreTags(a)}
          </div>
        </div>
      </header>

      ${a.description ? `<p class="desc">${linkDesc(a.description, linkCtx)}</p>` : ""}
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
  if (a.birthYear && a.deathYear) rows.push(["Levetid", `${a.birthYear}–${a.deathYear}`]);
  else if (a.birthYear) rows.push(["Levetid", `${a.birthYear}–`]);
  else if (a.deathYear) rows.push(["Levetid", `?–${a.deathYear}`]);
  if (a.influenceStart) {
    const p = (!a.influenceEnd || a.influenceEnd === a.influenceStart)
      ? `ca. ${a.influenceStart}`
      : `${a.influenceStart}–${a.influenceEnd}`;
    rows.push(["Innflytelse", p]);
  }
  if (a.recordLabel) rows.push(["Plateselskap", a.recordLabel]);
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
export function showSubsjangerInfo(label, opts = {}) {
  const { root = document, subgenreDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onGenreClick, onShowArtists, onShowPlaylist, onEdit, onPropose, hasPendingEdit } = opts;
  const modal = root.querySelector("#modal-sjanger");
  const mTitle = root.querySelector("#sj-title");
  const mBody = root.querySelector("#sj-body");
  if (!modal || !mTitle || !mBody) return;

  const desc = subgenreDescs[label];
  const descText = desc?.description || "Ingen beskrivelse ennå.";
  const kilder = Array.isArray(desc?.kilder) ? desc.kilder : [];
  wireProposeFoot(root, onPropose, hasPendingEdit, "subgenre", label, label, { description: desc?.description || "" });

  const btnArea = [
    onShowArtists ? `<button type="button" class="btn ghost small gx-artists-btn">Vis artister</button>` : "",
    onShowPlaylist ? `<button type="button" class="btn ghost small gx-playlist-btn">Vis spilleliste</button>` : "",
    onEdit ? `<button type="button" class="btn ghost small gx-edit-btn">Rediger</button>` : "",
  ].filter(Boolean).join(" ");

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onGenreClick };
  mTitle.textContent = label;
  mBody.innerHTML = `
    <p class="gx-desc">${linkDesc(descText, lc)}</p>
    ${buildKilderList(kilder, "Kilder")}
    ${btnArea ? `<div style="margin-top:10px;display:flex;gap:8px">${btnArea}</div>` : ""}`;
  wireLinks(mBody, lc);
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

// ----------------------------------------------------------------------------
//  ENDRINGSFORSLAG — diff-hjelpere
// ----------------------------------------------------------------------------

const FIELD_LABELS = {
  artist: {
    name: "Navn", birthYear: "Fødselsår", deathYear: "Dødsår", gender: "Kjønn",
    genre: "Metasjanger", instrument: "Instrument",
    sjangre: "Sjangre", undersjangre: "Undersjangre",
    influenceStart: "Innflytelse fra", influenceEnd: "Innflytelse til",
    recordLabel: "Plateselskap", geography: "Geografi", description: "Beskrivelse",
    keyWorks: "Sentrale verk", musicExamples: "Musikkeksempler", kilder: "Kilder",
    imageUrl: "Bilde-URL", imageCredit: "Bildekreditering",
  },
  tech: {
    name: "Navn", category: "Kategori", adoptedYear: "Innført år",
    adoptedLabel: "Tidsangivelse", decade: "Tiår", description: "Beskrivelse",
    imageUrl: "Bilde-URL", imageCredit: "Bildekreditering", kilder: "Kilder",
  },
  subgenre: {
    description: "Beskrivelse",
  },
  "decade-society": {
    society: "Samfunnsutvikling", societyMore: "Samfunn (les mer)",
    kilder: "Kilder",
  },
  "decade-tech": {
    tech: "Teknologiutvikling", techMore: "Teknologi (les mer)",
    kilder: "Kilder",
  },
};

export function fieldLabelFor(entityType, key) {
  return (FIELD_LABELS[entityType] && FIELD_LABELS[entityType][key]) || key;
}

// Hjelper som viser/skjuler #sj-foot i sjanger-modalen og binder klikk.
export function wireProposeFoot(root, onPropose, hasPendingEdit, entityType, entityId, entityName, currentValues) {
  const foot = root.querySelector("#sj-foot");
  const btn = root.querySelector("#sj-propose");
  if (!foot || !btn) return;
  if (!onPropose) { foot.style.display = "none"; return; }
  const locked = hasPendingEdit?.(entityType, entityId);
  foot.style.display = "";
  btn.disabled = !!locked;
  btn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
  btn.onclick = () => onPropose({ entityType, entityId, entityName, currentValues });
}

// Deep-equal for primitiver, arrays, og enkle objekter (verdens-modellen vår).
function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return (a ?? "") === (b ?? "");
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => valuesEqual(x, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => valuesEqual(a[k], b[k]));
  }
  return false;
}

// Bygg en differanse-objekt: kun feltene som faktisk er endret.
export function diffFields(current, proposed) {
  const out = {};
  for (const k of Object.keys(proposed || {})) {
    if (!valuesEqual(current?.[k], proposed[k])) out[k] = proposed[k];
  }
  return out;
}

function formatDiffValue(v) {
  if (v == null || v === "") return `<span class="diff-empty">(tom)</span>`;
  if (Array.isArray(v)) {
    if (!v.length) return `<span class="diff-empty">(tom liste)</span>`;
    if (typeof v[0] === "object") {
      return v.map((it) => escapeHtml(it.title || it.label || it.text || it.name || JSON.stringify(it))).join(", ");
    }
    return v.map((x) => escapeHtml(String(x))).join(", ");
  }
  if (typeof v === "object") {
    return escapeHtml(JSON.stringify(v));
  }
  const str = String(v);
  if (str.length > 200) {
    return `<details><summary>${escapeHtml(str.slice(0, 200))}…</summary><div class="diff-full">${escapeHtml(str)}</div></details>`;
  }
  return escapeHtml(str);
}

// Renderer en redigerbar diff-tabell. Hver rad har en data-field attributt
// og en .diff-action-knapp som veksler tilstand mellom none/approved/rejected.
// Kalleren binder klikk-handler og leser ut valgte felter ved lagring.
export function renderEditDiff(entityType, currentValues, proposedFields) {
  const keys = Object.keys(proposedFields || {});
  if (!keys.length) {
    return `<p class="muted empty">Ingen endringer i dette forslaget.</p>`;
  }
  const rows = keys.map((k) => {
    const label = fieldLabelFor(entityType, k);
    const cur = formatDiffValue(currentValues?.[k]);
    const pro = formatDiffValue(proposedFields[k]);
    return `<tr class="diff-row" data-field="${escapeHtml(k)}">
      <td class="diff-field">${escapeHtml(label)}</td>
      <td class="diff-current">${cur}</td>
      <td class="diff-proposed">${pro}</td>
      <td class="diff-actions">
        <button type="button" class="btn ghost small diff-approve" data-action="approve" title="Godta">✓</button>
        <button type="button" class="btn ghost small diff-reject" data-action="reject" title="Avvis">✕</button>
      </td>
    </tr>`;
  });
  return `<table class="diff-table">
    <thead><tr><th>Felt</th><th>Gjeldende</th><th>Foreslått</th><th>Valg</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

// Etter at brukeren har klikket seg gjennom radene, hent ut feltnøklene som
// er markert som godkjent.
export function readApprovedFields(rootEl) {
  return [...rootEl.querySelectorAll(".diff-row.is-approved")].map((r) => r.dataset.field);
}

// Bind klikk-håndtering på diff-tabellen. Veksler is-approved/is-rejected
// klasser per rad. Idempotent — trygt å kalle flere ganger på samme element.
export function wireEditDiff(rootEl) {
  if (!rootEl || rootEl.dataset.diffWired === "1") return;
  rootEl.dataset.diffWired = "1";
  rootEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".diff-actions button");
    if (!btn) return;
    const row = btn.closest(".diff-row");
    if (!row) return;
    const action = btn.dataset.action;
    row.classList.toggle("is-approved", action === "approve" && !row.classList.contains("is-approved"));
    row.classList.toggle("is-rejected", action === "reject" && !row.classList.contains("is-rejected"));
    if (action === "approve") row.classList.remove("is-rejected");
    if (action === "reject") row.classList.remove("is-approved");
  });
}
