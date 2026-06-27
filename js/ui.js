// ============================================================================
//  UI — rendering (artist- og listevisninger)
// ----------------------------------------------------------------------------
//  Rene funksjoner som bygger og oppdaterer grensesnittet ut fra tilstand.
//  Ingen direkte databasekall her — handlinger sendes inn via `handlers`.
//
//  Lavnivå-hjelpere, tidslinjer, teknologi, dashboard, modaler og diff-tabell
//  bor i egne moduler (ui-helpers/ui-timeline/ui-tech/ui-dashboard/ui-modal/
//  ui-edit). De re-eksporteres herfra, så resten av appen importerer alt fra
//  ./ui.js som før.
// ============================================================================

import { decadesForRange } from "./limits.js?v=2.42";
import { GENEALOGY_MAIN_GENRES } from "./genealogy.js?v=2.42";
import { linkifyArtists } from "./linkify.js?v=2.42";
import {
  escapeHtml,
  linkDesc,
  wireLinks,
  buildKilderList,
  kilderHtml,
  genreTags,
  yearLabel,
  musicExampleLabel,
  keyWorksText,
  fmtCredit,
  artistImage,
  formatInfoText,
  factsLines,
} from "./ui-helpers.js?v=2.42";
import { modalOpen, modalClose, modalCloseTop, modalCloseAll, setupModal } from "./ui-modal.js?v=2.42";
import { TECH_CATEGORIES, renderTechList, renderTechDetail } from "./ui-tech.js?v=2.42";
import { buildTimeline, buildTechTimeline } from "./ui-timeline.js?v=2.42";
import { renderDashboard, renderLimits } from "./ui-dashboard.js?v=2.42";
import { fieldLabelFor, wireProposeFoot, diffFields, renderEditDiff, readApprovedFields, wireEditDiff } from "./ui-edit.js?v=2.42";

// Re-eksport: alt over importeres av resten av appen direkte fra ./ui.js.
export { linkifyArtists };
export { escapeHtml, buildKilderList, fmtCredit, formatInfoText };
export { modalOpen, modalClose, modalCloseTop, modalCloseAll, setupModal };
export { TECH_CATEGORIES, renderTechList, renderTechDetail };
export { buildTimeline, buildTechTimeline };
export { renderDashboard, renderLimits };
export { fieldLabelFor, wireProposeFoot, diffFields, renderEditDiff, readApprovedFields, wireEditDiff };

export function buildMainGenreList(artists) {
  const set = new Set(GENEALOGY_MAIN_GENRES);
  for (const a of (artists || [])) {
    if (a.status !== "active") continue;
    for (const s of (a.mainGenre || [])) set.add(s);
    for (const s of (a.subGenre || [])) set.add(s);
  }
  return [...set];
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
    const sjanger = Array.isArray(a.mainGenre) ? a.mainGenre : [];
    const under = Array.isArray(a.subGenre) ? a.subGenre : [];
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
  const prio = a.priority || 0;
  const PRIO_LABELS = { 3: "Viktigst", 2: "Viktig", 1: "Mindre viktig" };
  const PRIO_ICONS = {
    3: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    2: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    1: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>`,
  };
  const prioTag = prio
    ? `<span class="tag tag-prio prio-${prio}" title="${PRIO_LABELS[prio]}">${PRIO_ICONS[prio]}</span>`
    : "";

  return `
    <article class="card">
      <header class="card-head">
        ${artistImage(a)}
        <h3>${escapeHtml(a.name)}</h3>
        ${factsLines(a)}
        <div class="meta">
          ${prioTag}
          ${a.instrument ? `<button class="tag tag-instrument" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : ""}
          ${genreTags(a)}
        </div>
      </header>
      ${a.description ? `<p class="desc">${linkDesc(a.description, lc)}</p>` : ""}
      ${worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : ""}
      ${examplesHtml ? `<div class="links">${examplesHtml}</div>` : ""}
      ${kilderHtml(a.kilder)}
      <footer class="card-foot">
        <div class="spacer"></div>
        <button class="btn ghost small" data-propose-type="artist" data-propose-id="${a.id}">Foreslå endring</button>
      </footer>
    </article>
  `;
}

export function renderArtists(el, state) {
  const { artists, filters, isTeacher, clientId, config, handlers } = state;

  let list = [...artists];

  if (filters.showPending) {
    list = list.filter((a) => a.status === "pending");
  } else if (!filters.showRemoved && filters.priority !== -1) {
    list = list.filter((a) => a.status === "active" && (a.priority || 0) !== -1);
  } else {
    list = list.filter((a) => a.status !== "pending");
  }
  if (filters.hideChecked) list = list.filter((a) => !a.teacherChecked);
  if (filters.priority) list = list.filter((a) => (a.priority || 0) === filters.priority);
  if (filters.mainGenre) {
    const sj = filters.mainGenre.toLowerCase();
    list = list.filter((a) => a.metaGenre === filters.mainGenre
      || (a.mainGenre || []).some((s) => s.toLowerCase() === sj)
      || (a.subGenre || []).some((s) => s.toLowerCase() === sj));
  }
  if (filters.metaGenre) list = list.filter((a) => a.metaGenre === filters.metaGenre);
  if (filters.instrument) list = list.filter((a) => a.instrument === filters.instrument);
  if (filters.decade) {
    const fd = Number(filters.decade);
    list = list.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(fd));
  }
  if (filters.subgenre) {
    const sg = filters.subgenre;
    list = list.filter((a) => (a.subGenre || []).includes(sg) || (a.mainGenre || []).includes(sg));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const qn = q.replace(/[.\-]/g, "");
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.name.toLowerCase().replace(/[.\-]/g, "").includes(qn) ||
        (a.geography || "").toLowerCase().includes(q) ||
        (a.mainGenre || []).some(s => s.toLowerCase().includes(q)) ||
        (a.subGenre || []).some(s => s.toLowerCase().includes(q))
    );
  }

  const hasFilter = filters.search || filters.mainGenre || filters.metaGenre || filters.instrument || filters.decade || filters.subgenre || filters.priority;
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
  const prio = a.priority || 0;
  const removed = prio === -1;
  const pending = a.status === "pending";

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
    ? `<span class="badge removed">Skjult for studenter</span>`
    : "";

  const pendingBadge = pending
    ? `<span class="badge pending">Venter på godkjenning</span>`
    : "";

  const PRIO_LABELS = { 3: "Viktigst", 2: "Viktig", 1: "Mindre viktig", "-1": "Skjult" };
  const prioBadge = "";
  const PRIO_ICONS = {
    3: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    2: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    1: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>`,
    "-1": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>`,
  };
  const prioTag = prio
    ? `<span class="tag tag-prio prio-${prio}" title="${PRIO_LABELS[prio]}">${PRIO_ICONS[prio]}</span>`
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
          <button class="icon-btn ${removed ? "active" : ""}" data-action="${removed ? "restore" : "remove"}" data-id="${a.id}" title="${removed ? "Gjør synlig" : "Skjul for studenter"}">${ICO_BAN}</button>
        </div>
        <div class="ta-right">
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
          <h3>${escapeHtml(a.name)} ${pendingBadge} ${removedBadge}</h3>
          ${factsLines(a, { showGender: isTeacher })}
          <div class="meta">
            ${prioTag}
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
        ${!isTeacher ? `<button class="btn ghost small" data-propose-type="artist" data-propose-id="${a.id}">Foreslå endring</button>` : ""}
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

// Vis undersjanger-beskrivelse i #modal-sjanger (samme popup som sjanger).
export function showSubsjangerInfo(label, opts = {}) {
  const { root = document, subgenreDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onShowArtists, onShowPlaylist, onEdit, onPropose, hasPendingEdit } = opts;
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

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onMainGenreClick };
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
    const sjanger = Array.isArray(a.mainGenre) ? a.mainGenre : [];
    const under = Array.isArray(a.subGenre) ? a.subGenre : [];
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

const byInfluenceThenName = (a, b) =>
  (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no");

// Aktive, synlige artister som hører til en sjanger (meta/main/sub matcher label).
export function artistsInGenre(artists, label) {
  const sj = label.toLowerCase();
  return (artists || [])
    .filter((a) => a.status === "active" && (a.priority || 0) !== -1 && (
      a.metaGenre === label
      || (a.mainGenre || []).some((s) => s.toLowerCase() === sj)
      || (a.subGenre || []).some((s) => s.toLowerCase() === sj)
    ))
    .sort(byInfluenceThenName);
}

// Aktive, synlige artister på et instrument.
export function artistsByInstrument(artists, instrument) {
  return (artists || [])
    .filter((a) => a.status === "active" && (a.priority || 0) !== -1 && a.instrument === instrument)
    .sort(byInfluenceThenName);
}

// Fyller og åpner artistliste-popupen (#modal-artistliste). Delt av forsiden og slektstre-siden.
export function openArtistListModal(title, list, onArtistClick, emptyText = "Ingen forslag ennå.") {
  document.getElementById("al-title").textContent = `${title} (${list.length})`;
  const body = document.getElementById("al-body");
  if (!list.length) {
    body.innerHTML = `<p class="muted empty">${escapeHtml(emptyText)}</p>`;
  } else {
    body.innerHTML = `<div class="result-list">${buildArtistListRows(list)}</div>`;
    body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
      const open = () => {
        const a = list.find((x) => x.id === row.dataset.artistId);
        if (a) onArtistClick(a);
      };
      row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
      row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  modalOpen(document.getElementById("modal-artistliste"));
}

// Fyller og åpner spilleliste-popupen (#modal-spilleliste).
export function openPlaylistModal(fullName, node, artists) {
  const { total, html } = buildPlaylistHtml(node, artists);
  document.getElementById("pl-title").textContent = `${fullName} — spilleliste (${total})`;
  document.getElementById("pl-body").innerHTML = html;
  modalOpen(document.getElementById("modal-spilleliste"));
}

// Bygger HTML for spilleliste-popup: keyWorks/lenker fra artister, med sjanger-tag per rad.
export function buildPlaylistHtml(node, artists) {
  const enc = encodeURIComponent;
  const sj = (node.l || "").toLowerCase();
  const ytLink = (q, text) =>
    `<a href="https://www.youtube.com/results?search_query=${enc(q)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;

  const matchesSj = (a) => {
    if (a.metaGenre === node.l) return true;
    const all = [...(a.mainGenre || []), ...(a.subGenre || [])];
    return all.some((s) => String(s).toLowerCase() === sj);
  };

  const genreArtists = (artists || [])
    .filter((a) => a.status === "active" && (a.priority || 0) !== -1 && matchesSj(a))
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));

  const seen = new Set();
  const items = genreArtists.flatMap((a) => {
    const rows = [];
    const nameLow = a.name.toLowerCase();
    const sjangerTag = (a.mainGenre || [])
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
