// ============================================================================
//  UI — LAVNIVÅ-HJELPERE
// ----------------------------------------------------------------------------
//  Rene, gjenbrukbare byggeklosser for rendering (HTML-snutter, formattering).
//  Avhenger kun av util + linkify + limits (GENDERS) — INGEN render-funksjoner,
//  så modulen kan importeres fritt uten import-sykler. Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml } from "./util.js?v=2.41";
import { linkifyAll, wireAllLinks } from "./linkify.js?v=2.41";
import { GENDERS } from "./limits.js?v=2.41";

export { escapeHtml };

export const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]));

export function linkDesc(text, lc) {
  if (!lc) return escapeHtml(text);
  return linkifyAll(text, lc);
}

export function wireLinks(el, lc) {
  if (!lc) return;
  wireAllLinks(el, lc);
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

export function keyWorksText(works) {
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

export function fmtCredit(raw) {
  if (!raw) return "";
  const text = raw.replace(/^Foto:\s*/i, "");
  return `<span class="image-credit">Foto: ${escapeHtml(text)}</span>`;
}

export function artistImage(a, big = false) {
  if (!a.imageUrl) return "";
  return `<figure class="artist-image ${big ? "big" : ""}">
    <img src="${escapeHtml(a.imageUrl)}" alt="${escapeHtml(a.name)}" loading="lazy" />
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
