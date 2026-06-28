// ============================================================================
//  UI — TIDSLINJER
// ----------------------------------------------------------------------------
//  Bygger proporsjonale tidslinjer for tiår (hendelser fra tekst) og teknologi.
//  Intern layout-logikk holdes privat her. Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml } from "./util.js?v=2.50";
import { extractBullets } from "./ui-helpers.js?v=2.50";

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
