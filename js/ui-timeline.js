// ============================================================================
//  UI — TIDSLINJER
// ----------------------------------------------------------------------------
//  Bygger proporsjonale tidslinjer for tiår (hendelser fra tekst) og teknologi.
//  Intern layout-logikk holdes privat her. Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml } from "./util.js?v=3.50";
import { extractBullets, formatInfoText } from "./ui-helpers.js?v=3.50";
import { DECADES } from "./limits.js?v=3.50";

// Tiårsvelgeren (klikkbar tidslinje-stripe): delt av studentenes tiårsvisning
// (explore.js), lærerens tiårsmodal (teacher-content.js) og kartet, så flatene
// aldri driver fra hverandre. onSelect får tiåret som tall.
//
// opts.all = true legger en egen prikk HELT TIL VENSTRE som betyr «vis alle
// tiår» (kartet). Den har sin egen farge (.dr-all i CSS) og står utenfor selve
// tidsaksen — streken starter først ved 1900. onSelect får da null.
// Kolonnetallet og strekens startpunkt sendes til CSS som variabler, så det
// samme sporet fungerer med og uten Alle-prikken.
export function renderDecadeRibbon(el, active, onSelect, { all = false, allLabel = "Alle" } = {}) {
  if (!el) return;
  const cols = DECADES.length + (all ? 1 : 0);
  const allNode = all
    ? `<button type="button" class="dr-node dr-all${active == null ? " active" : ""}" data-decade=""` +
      ` aria-label="Vis alle tiår"${active == null ? ` aria-current="true"` : ""}>` +
      `<span class="dr-dot"></span><span class="dr-year">${escapeHtml(allLabel)}</span></button>`
    : "";
  el.innerHTML =
    `<div class="dr-track" style="--dr-cols:${cols};--dr-line-start:${all ? 1 : 0}">` +
    allNode +
    DECADES.map((y) =>
      `<button type="button" class="dr-node${y === active ? " active" : ""}" data-decade="${y}"` +
      ` aria-label="${y}-tallet"${y === active ? ` aria-current="true"` : ""}>` +
      `<span class="dr-dot"></span><span class="dr-year">${y}</span></button>`
    ).join("") + `</div>`;
  el.querySelectorAll("[data-decade]").forEach((btn) => {
    btn.addEventListener("click", () =>
      onSelect(btn.dataset.decade === "" ? null : Number(btn.dataset.decade)));
  });
}

function shortDesc(text) {
  const first = text.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (first.length <= 70) return first;
  const cut = first.lastIndexOf(" ", 67);
  return first.slice(0, cut > 30 ? cut : 67) + "…";
}

// Etikettene er 130px brede (CSS .tl-prop .tl-label) — ca. 24 % av minste
// sporbredde (560px). Grupper hvis intervaller overlapper horisontalt må
// stables i høyden. Linjehøyden er et estimat uten DOM-måling: ~20 tegn per
// linje ved 130px/0.75rem, bevisst i underkant så estimatet heller tar for
// mye høyde enn for lite.
const LABEL_W_PCT = 24;
const CHARS_PER_LINE = 20;
const LINE_H = 17;

function estimateLabelHeight(entries) {
  const lines = entries.reduce((n, e) => n + Math.max(1, Math.ceil(e.desc.length / CHARS_PER_LINE)), 0);
  return LINE_H + 2 + lines * LINE_H;
}

// Kant-etiketter (tl-start/tl-end) venstre-/høyrestilles i CSS-en, så det
// horisontale fotavtrykket deres strekker seg innover fra punktet — ikke
// symmetrisk rundt det.
function labelInterval(pct) {
  if (pct <= 12) return [pct - 1, pct + LABEL_W_PCT - 1];
  if (pct >= 88) return [pct - LABEL_W_PCT + 1, pct + 1];
  return [pct - LABEL_W_PCT / 2, pct + LABEL_W_PCT / 2];
}

// Høydebevisst layout: hver gruppe legges på den siden (over/under) der den
// får kortest stilk, og stilken må løfte etiketten klar av alle tidligere
// etiketter på samme side som overlapper horisontalt. Da kan ingenting
// kollidere, uansett hvor mange hendelser som deler årstall eller hvor mange
// linjer tekstene brekker over.
function layoutTimeline(groups) {
  const placed = { above: [], below: [] };
  return groups.map((g) => {
    const [lo, hi] = labelInterval(g.pct);
    const stemFor = (side) => {
      let stem = 24;
      for (const p of placed[side]) {
        if (lo < p.hi && hi > p.lo) stem = Math.max(stem, p.stem + p.height + 8);
      }
      return stem;
    };
    const aStem = stemFor("above"), bStem = stemFor("below");
    const dir = bStem < aStem ? "below" : "above";
    const stem = Math.min(aStem, bStem);
    placed[dir].push({ lo, hi, stem, height: g.height });
    return { ...g, dir, stem };
  });
}

function buildProportionalTimeline(items, startYear) {
  if (items.length < 2) return "";
  // Hendelser med samme årstall samles til én gruppe — ett punkt, én stilk,
  // navnene under hverandre — i stedet for flere etiketter på samme x.
  const byLabel = new Map();
  for (const e of items) {
    if (!byLabel.has(e.label)) byLabel.set(e.label, { year: e.year, label: e.label, entries: [] });
    byLabel.get(e.label).entries.push(e);
  }
  const groups = [...byLabel.values()];
  const minY = Math.min(...groups.map(g => g.year || startYear));
  const maxY = Math.max(...groups.map(g => g.year || startYear + 9));
  const span = Math.max(maxY - minY, 1);
  const pad = 4;
  // Deler alle hendelsene årstall (én gruppe), sentreres punktet på aksen i
  // stedet for å klistres til venstrekanten av en meningsløs spennvidde.
  const mapped = groups.map(g => ({
    ...g,
    pct: groups.length === 1 ? 50 : pad + ((g.year || startYear) - minY) / span * (100 - 2 * pad),
    height: estimateLabelHeight(g.entries),
  }));
  const laid = layoutTimeline(mapped);
  // Sporhøyden må dekke høyeste stilk + etikett på en side (10px luft mellom
  // stilk og etikett, jf. CSS-ens bottom/top-calc).
  const half = Math.max(...laid.map(g => g.stem + g.height + 10)) + 8;
  let html = `<div class="timeline tl-prop" style="--tl-half:${half}px"><div class="tl-track">`;
  for (const g of laid) {
    const edge = g.pct <= 12 ? " tl-start" : g.pct >= 88 ? " tl-end" : "";
    html += `<div class="tl-item tl-${g.dir}${edge}" style="left:${g.pct.toFixed(1)}%;--stem:${g.stem}px">` +
      `<div class="tl-dot"></div><div class="tl-stem"></div>` +
      `<div class="tl-label"><span class="tl-year">${escapeHtml(g.label)}</span>` +
      g.entries.map((e) =>
        `<span class="tl-desc"${e.techId ? ` data-tech-id="${escapeHtml(e.techId)}"` : ""}>${escapeHtml(e.desc)}</span>`
      ).join("") +
      `</div></div>`;
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

// Delt tiårs-render: samfunn/teknologi-tekst + tidslinjer + «les mer»-knapper.
// Kalt fra forsidens tiårsvisning (explore) OG lærer-tiårsmodalen (også etter
// lagring), så de tre tidligere kopiene holdes ett sted. `refs` er DOM-elementer
// (ulike ID-prefikser dv-/ds- per bruk); manglende refs hoppes over.
export function renderDecadeSections(refs, desc, decadeId, techItems, { isSociety = true, onTechClick, onMore } = {}) {
  const noText = "Ingen beskrivelse ennå.";
  if (refs.societyEl) {
    refs.societyEl.innerHTML = desc.society ? formatInfoText(desc.society) : noText;
    refs.societyEl.className = "info-text" + (desc.society ? "" : " muted");
  }
  if (refs.techEl) {
    refs.techEl.innerHTML = desc.tech ? formatInfoText(desc.tech) : noText;
    refs.techEl.className = "info-text" + (desc.tech ? "" : " muted");
  }
  if (refs.societyTl) refs.societyTl.innerHTML = buildTimeline(desc.society, decadeId);
  if (refs.techTl) {
    refs.techTl.innerHTML = buildTechTimeline(techItems, decadeId);
    if (onTechClick) {
      refs.techTl.querySelectorAll("[data-tech-id]").forEach((el) => {
        el.addEventListener("click", () => {
          const t = techItems.find((x) => x.id === el.dataset.techId);
          if (t) onTechClick(t);
        });
      });
    }
  }
  if (refs.societyMoreBtn) {
    refs.societyMoreBtn.style.display = desc.societyMore && isSociety ? "" : "none";
    if (onMore) refs.societyMoreBtn.onclick = () => onMore("society", desc.societyMore);
  }
  if (refs.techMoreBtn) {
    refs.techMoreBtn.style.display = desc.techMore && !isSociety ? "" : "none";
    if (onMore) refs.techMoreBtn.onclick = () => onMore("tech", desc.techMore);
  }
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
    techId: t.id,
  }));
  return buildProportionalTimeline(items, startYear);
}
