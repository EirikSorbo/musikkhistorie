// ============================================================================
//  UI — TEKNOLOGI
// ----------------------------------------------------------------------------
//  Rendering av teknologi-kort (liste og detalj). Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml, safeUrl, buildKilderList } from "./util.js?v=4.76";
import { fmtCredit, linkDesc, wireLinks, imgTag, techFactsLines } from "./ui-helpers.js?v=4.76";

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

// ----------------------------------------------------------------------------
//  KORTTYPE — innovasjon eller hendelse
// ----------------------------------------------------------------------------
//  Et instrumentkort er enten et ARTEFAKT («Fender Stratocaster, 1954») eller et
//  SKIFTE («Charlie Christian gjør gitaren til soloinstrument, 1939»). De to har
//  nøyaktig samme felter, så de deler dokument og skiller seg kun på `type`.
//
//  MANGLER feltet, er kortet en innovasjon. Det er derfor de 66 kortene som
//  fantes før v3.84 ikke trengte migrering — og hvorfor techType() alltid må
//  brukes i stedet for å lese t.type rått.
export const TECH_TYPES = [
  { value: "innovasjon", label: "Teknologisk innovasjon" },
  { value: "hendelse",   label: "Viktig hendelse" },
];

export const techType = (t) => (t?.type === "hendelse" ? "hendelse" : "innovasjon");
export const isHendelse = (t) => techType(t) === "hendelse";

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
  // Hendelseskort filtreres bort her: seksjonen heter «Teknologiske
  // innovasjoner», og et skifte som «Hendrix på Monterey» er ikke en teknologi.
  // De vises på instrumenttidslinjen i stedet.
  const innovasjoner = items.filter((t) => !isHendelse(t));
  const filtered = activeCategory ? innovasjoner.filter(t => t.category === activeCategory) : innovasjoner;
  if (!filtered.length) {
    el.innerHTML = `<p class="muted empty">Ingen teknologier i denne kategorien ennå.</p>`;
    return;
  }
  el.innerHTML = filtered.map(t => {
    const img = techImage(t);
    const propBtn = lc?.isTeacher
      ? ""
      : `<footer class="card-foot"><div class="spacer"></div><button class="btn ghost small" data-propose-type="tech" data-propose-id="${escapeHtml(t.id)}">Foreslå endring</button></footer>`;
    return `<article class="card" data-tech-id="${escapeHtml(t.id)}">
      <header class="card-head">
        ${img}
        <h3>${escapeHtml(t.name)}</h3>
        ${techFactsLines(t)}
      </header>
      ${t.description ? `<div class="desc rt">${linkDesc(t.description, lc)}</div>` : ""}
      ${propBtn}
    </article>`;
  }).join("");
  wireLinks(el, lc);
}

export function renderTechDetail(el, t, lc) {
  const img = techImage(t);
  el.innerHTML = `${img}${techFactsLines(t)}`
    + (t.description ? `<div class="rt">${linkDesc(t.description, lc)}</div>` : "")
    + buildKilderList(t.kilder, "Kilder");
  wireLinks(el, lc);
}
