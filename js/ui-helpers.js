// ============================================================================
//  UI — LAVNIVÅ-HJELPERE
// ----------------------------------------------------------------------------
//  Rene, gjenbrukbare byggeklosser for rendering (HTML-snutter, formattering).
//  Avhenger kun av util + linkify + limits (GENDERS) — INGEN render-funksjoner,
//  så modulen kan importeres fritt uten import-sykler. Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml, buildKilderList, safeUrl } from "./util.js?v=2.78";
import { linkifyAll, wireAllLinks } from "./linkify.js?v=2.78";
import { GENDERS } from "./limits.js?v=2.78";

export { escapeHtml, buildKilderList, safeUrl };

export const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]));

export function linkDesc(text, lc) {
  if (!lc) return escapeHtml(text);
  return linkifyAll(text, lc);
}

export function wireLinks(el, lc) {
  if (!lc) return;
  wireAllLinks(el, lc);
}

export const kilderHtml = (kilder) => buildKilderList(kilder, "Kilder");

// Bygger sjanger- og undersjanger-bobler (begge klikkbare filtre).
export function genreTags(a) {
  const sjanger = Array.isArray(a.mainGenre) ? a.mainGenre : [];
  const under = Array.isArray(a.subGenre) ? a.subGenre : [];
  return [
    ...sjanger.map((s) => `<button class="tag tag-sjanger" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
    ...under.map((s) => `<button class="tag tag-under" data-under="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
  ].join("");
}

export function yearLabel(w) {
  const y = w.year || null;
  if (y) return `(${y})`;
  return "";
}

export function musicExampleLabel(m) {
  const y = m.year || null;
  const p = m.performanceYear || null;
  if (y && p && p !== y) return ` (${y}, framføring ${p})`;
  if (y) return ` (${y})`;
  if (p) return ` (framføring ${p})`;
  return "";
}

// Delt musikkeksempel-lenkeliste (brukt av detalj-, spotlight- og artistkort).
export function musicExamplesHtml(a) {
  return (a.musicExamples || [])
    .filter((m) => safeUrl(m.url))
    .map((m) => `<a href="${escapeHtml(safeUrl(m.url))}" target="_blank" rel="noopener">${escapeHtml(m.label || "Lytt")}${musicExampleLabel(m)}</a>`)
    .join("");
}

// Prioritets-ikoner/-etiketter, delt av spotlight- og artistkort.
export const PRIO_LABELS = { 3: "Viktigst", 2: "Viktig", 1: "Mindre viktig", "-1": "Skjult" };
const prioIco = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const PRIO_ICONS = {
  3: prioIco(`<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>`),
  2: prioIco(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`),
  1: prioIco(`<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>`),
  "-1": prioIco(`<path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>`),
};

export function keyWorksText(works) {
  if (!Array.isArray(works) || !works.length) return "";
  return works.map((w) => {
    const t = escapeHtml(w.title || "");
    const y = yearLabel(w);
    const ySuffix = y ? ` ${y}` : "";
    const url = safeUrl(w.url);
    return url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${t}</a>${ySuffix}`
      : `${t}${ySuffix}`;
  }).join(", ");
}

export function fmtCredit(raw) {
  if (!raw) return "";
  const text = raw.replace(/^Foto:\s*/i, "");
  return `<span class="image-credit">Foto: ${escapeHtml(text)}</span>`;
}

export function artistImage(a, big = false) {
  const url = safeUrl(a.imageUrl);
  if (!url) return "";
  return `<figure class="artist-image ${big ? "big" : ""}">
    <img src="${escapeHtml(url)}" alt="${escapeHtml(a.name)}" loading="lazy" />
    ${fmtCredit(a.imageCredit)}
  </figure>`;
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

export function extractBullets(text) {
  return splitLines(text);
}

export function pct(n, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((n / max) * 100));
}

// Faktalinjer under tittel: levetid, innflytelse, kjønn (kun lærer), virkested.
// Vises som tekst (samme format som «Sentrale verk»), ikke som bobler.
export function factsLines(a, { showGender = false } = {}) {
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
