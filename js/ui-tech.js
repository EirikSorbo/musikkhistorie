// ============================================================================
//  UI — TEKNOLOGI
// ----------------------------------------------------------------------------
//  Rendering av teknologi-kort (liste og detalj). Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml, safeUrl } from "./util.js?v=3.62";
import { fmtCredit, linkDesc, wireLinks, imgTag } from "./ui-helpers.js?v=3.62";

// Delt bilde-snutt for teknologikort (liste, detalj og admin).
export function techImage(t) {
  const url = safeUrl(t.imageUrl);
  if (!url) return "";
  return `<figure class="artist-image">${imgTag(url, t.name, 480)}${fmtCredit(t.imageCredit)}</figure>`;
}

export const TECH_CATEGORIES = [
  "Opptak og avspilling",
  "Kringkasting og spredning",
  "Instrumenter og lydutstyr",
];

// Fane-visning (explore): kort etikett per kategori. AVLEDET fra
// TECH_CATEGORIES, så en omdøping der forplanter seg hit automatisk (ingen
// hardkodede kopier å glemme). Kategorier uten kort etikett viser full verdi.
const TECH_SHORT = {
  "Opptak og avspilling": "Opptak",
  "Kringkasting og spredning": "Kringkasting",
  "Instrumenter og lydutstyr": "Instrumenter",
};
export const TECH_CATEGORY_TABS = TECH_CATEGORIES.map((value) => ({ value, label: TECH_SHORT[value] || value }));

export function renderTechList(el, items, activeCategory, lc) {
  const filtered = activeCategory ? items.filter(t => t.category === activeCategory) : items;
  if (!filtered.length) {
    el.innerHTML = `<p class="muted empty">Ingen teknologier i denne kategorien ennå.</p>`;
    return;
  }
  el.innerHTML = filtered.map(t => {
    const img = techImage(t);
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
  const img = techImage(t);
  const yearTag = t.adoptedLabel ? `<span class="tag tag-tech-year">${escapeHtml(t.adoptedLabel)}</span>` : "";
  const catTag = `<span class="tag tag-tech-cat">${escapeHtml(t.category || "")}</span>`;
  el.innerHTML = `${img}<div class="meta" style="margin:10px 0">${yearTag}${catTag}</div>${t.description ? `<p>${linkDesc(t.description, lc)}</p>` : ""}`;
  wireLinks(el, lc);
}
