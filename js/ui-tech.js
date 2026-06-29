// ============================================================================
//  UI — TEKNOLOGI
// ----------------------------------------------------------------------------
//  Rendering av teknologi-kort (liste og detalj). Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml } from "./util.js?v=2.61";
import { fmtCredit, linkDesc, wireLinks } from "./ui-helpers.js?v=2.61";

export const TECH_CATEGORIES = [
  "Opptak og avspilling",
  "Kringkasting og spredning",
  "Instrumenter og lydutstyr",
];

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
    const propBtn = lc?.isTeacher
      ? ""
      : `<footer class="card-foot"><div class="spacer"></div><button class="btn ghost small" data-propose-type="tech" data-propose-id="${escapeHtml(t.id)}">Foreslå endring</button></footer>`;
    return `<article class="card" data-tech-id="${escapeHtml(t.id)}">
      <header class="card-head">
        ${img}
        <h3>${escapeHtml(t.name)}</h3>
        <div class="meta">${yearTag}${catTag}</div>
      </header>
      ${t.description ? `<p class="desc">${linkDesc(t.description, lc)}</p>` : ""}
      ${propBtn}
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
