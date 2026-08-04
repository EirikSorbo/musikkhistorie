// ============================================================================
//  UI — TIDSLINJER
// ----------------------------------------------------------------------------
//  Bygger proporsjonale tidslinjer for tiår (hendelser fra tekst), teknologi og
//  sjangerfamilier. Intern layout-logikk holdes privat her. Re-eksporteres fra
//  ui.js. Importerer GENEALOGY (treet er fasit for sjangertidslinjen) — trygt,
//  fordi genealogy.js ikke importerer denne modulen.
// ============================================================================

import { escapeHtml } from "./util.js?v=4.19";
import { extractBullets, formatInfoText } from "./ui-helpers.js?v=4.19";
import { DECADES } from "./limits.js?v=4.19";
import { GENEALOGY, META_GENRE_COLOR, FAMILIES } from "./genealogy.js?v=4.19";
import { isHendelse } from "./ui-tech.js?v=4.19";

// Tiårsvelgeren (klikkbar tidslinje-stripe): delt av studentenes tiårsvisning
// (explore-decade.js), lærerens tiårsmodal (teacher-content.js) og kartet, så flatene
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

// lineH må følge den FAKTISKE skriftstørrelsen på .tl-desc. Sjangertidslinjen
// setter navnene større (0.82rem, halvfet) enn tiår-/teknologitidslinjene, og
// med standardhøyden 17px undervurderte estimatet stabler på tre navn nok til
// at etiketten kolliderte med naboen (Neo-soul/Gangsta rap/Cont. R&B mot Trap).
function estimateLabelHeight(entries, lineH = LINE_H) {
  const lines = entries.reduce((n, e) => n + Math.max(1, Math.ceil(e.desc.length / CHARS_PER_LINE)), 0);
  return lineH + 2 + lines * lineH;
}

// Kant-etiketter (tl-start/tl-end) venstre-/høyrestilles i CSS-en, så det
// horisontale fotavtrykket deres strekker seg innover fra punktet — ikke
// symmetrisk rundt det. Er etikettene alltid midtstilte (sjangertidslinjen),
// er fotavtrykket symmetrisk overalt, og kant-unntaket ville regnet feil.
function labelInterval(pct, edgeAlign = true) {
  if (edgeAlign && pct <= 12) return [pct - 1, pct + LABEL_W_PCT - 1];
  if (edgeAlign && pct >= 88) return [pct - LABEL_W_PCT + 1, pct + 1];
  return [pct - LABEL_W_PCT / 2, pct + LABEL_W_PCT / 2];
}

const BASE_STEM = 24;

// Høydebevisst layout: hver gruppe legges på den siden (over/under) der den
// får kortest stilk, og stilken må løfte etiketten klar av alle tidligere
// etiketter på samme side som overlapper horisontalt. Da kan ingenting
// kollidere, uansett hvor mange hendelser som deler årstall eller hvor mange
// linjer tekstene brekker over.
//
// stemLevels > 0 slår på FASTE stilklengder i stedet. Den frie stablingen over
// vokser monotont — hver ny etikett må klarere alle de forrige — så i en tett
// familie som Jazz ble stilkene lengre og lengre utover i sporet. Med faste
// nivåer prøves plassene i rekkefølgen kort-over, kort-under, lang-over,
// lang-under, og en etikett som ikke overlapper noen i sin egen plass havner
// på den korteste ledige. Da veksler stilkene i stedet for å eskalere, og
// mønsteret nullstiller seg av seg selv når sporet åpner seg igjen.
// Finnes det ingen ledig fast plass, faller vi tilbake på den frie stablingen,
// så garantien om at ingenting kolliderer står uansett.
function layoutTimeline(groups, { stemLevels = 0, edgeAlign = true } = {}) {
  const placed = { above: [], below: [] };
  const step = Math.max(...groups.map((g) => g.height)) + 8;
  return groups.map((g) => {
    const [lo, hi] = labelInterval(g.pct, edgeAlign);
    const overlaps = (p) => lo < p.hi && hi > p.lo;

    for (let lvl = 0; lvl < stemLevels; lvl++) {
      for (const side of ["above", "below"]) {
        if (placed[side].some((p) => p.level === lvl && overlaps(p))) continue;
        const stem = BASE_STEM + lvl * step;
        placed[side].push({ lo, hi, stem, height: g.height, level: lvl });
        return { ...g, dir: side, stem };
      }
    }

    const stemFor = (side) => {
      let stem = BASE_STEM;
      for (const p of placed[side]) {
        if (overlaps(p)) stem = Math.max(stem, p.stem + p.height + 8);
      }
      return stem;
    };
    const aStem = stemFor("above"), bStem = stemFor("below");
    const dir = bStem < aStem ? "below" : "above";
    const stem = Math.min(aStem, bStem);
    placed[dir].push({ lo, hi, stem, height: g.height, level: -1 });
    return { ...g, dir, stem };
  });
}

// Punkter som ligger noen få år fra hverandre havner praktisk talt oppå
// hverandre på aksen (British invasion 1963 / Blues rock 1964). Her dyttes de
// fra hverandre til minst `gap` prosentpoeng: ett gjennomløp forover som skyver
// høyre vei, så ett bakover fra høyre kant som fanger dem som ble skjøvet ut av
// sporet. To gjennomløp konvergerer så lenge det er plass til alle, og `gap`
// begrenses nettopp slik at det alltid er det.
function enforceMinGap(sorted, desiredGap, pad, limit) {
  const n = sorted.length;
  if (n < 2 || !desiredGap) return;
  const gap = Math.min(desiredGap, (limit - pad) / (n - 1));
  for (let i = 1; i < n; i++) sorted[i].pct = Math.max(sorted[i].pct, sorted[i - 1].pct + gap);
  sorted[n - 1].pct = Math.min(sorted[n - 1].pct, limit);
  for (let i = n - 2; i >= 0; i--) sorted[i].pct = Math.min(sorted[i].pct, sorted[i + 1].pct - gap);
}

// opts.color farger strek, prikker, stilker og årstall (CSS-variabelen
// --tl-color, som faller tilbake på --accent når den ikke er satt — derfor er
// tiårs- og teknologitidslinjene uendret grønne).
// opts.minGapPct, opts.stemLevels og opts.edgeAlign settes kun av
// sjangertidslinjen, så innovasjons- og tiårstidslinjene beholder plasseringen
// og kant-justeringen de har i dag.
function buildProportionalTimeline(items, startYear, {
  color = null, extraClass = "", minGapPct = 0, lineH = LINE_H,
  stemLevels = 0, edgeAlign = true,
} = {}) {
  if (items.length < 2) return "";
  // Hendelser på samme punkt samles til én gruppe — ett punkt, én stilk, navnene
  // under hverandre — i stedet for flere etiketter oppå hverandre på samme x.
  // Grupperes på ÅRSTALL (posisjonen), ikke på etiketten: for tiår- og
  // teknologitidslinjene er de to identiske, men sjangertidslinjen viser nodens
  // `era` ordrett («sent 1960-tall»), og da må to noder på samme x havne i samme
  // gruppe selv om teksten er ulik.
  const byPos = new Map();
  for (const e of items) {
    const key = e.year == null ? "?" : e.year;
    if (!byPos.has(key)) byPos.set(key, { year: e.year, label: e.label, entries: [] });
    byPos.get(key).entries.push(e);
  }
  const groups = [...byPos.values()];
  const pad = 4;
  const limit = 100 - pad;
  const minY = Math.min(...groups.map(g => g.year || startYear));
  const maxY = Math.max(...groups.map(g => g.year || startYear + 9));
  const span = Math.max(maxY - minY, 1);

  // Deler alle hendelsene årstall (én gruppe), sentreres punktet på aksen i
  // stedet for å klistres til venstrekanten av en meningsløs spennvidde.
  const mapped = groups.map(g => ({
    ...g,
    pct: groups.length === 1 ? 50 : pad + ((g.year || startYear) - minY) / span * (limit - pad),
    height: estimateLabelHeight(g.entries, lineH),
  }));
  mapped.sort((a, b) => a.pct - b.pct);
  enforceMinGap(mapped, minGapPct, pad, limit);
  const laid = layoutTimeline(mapped, { stemLevels, edgeAlign });
  // Sporhøyden må dekke høyeste stilk + etikett på en side (10px luft mellom
  // stilk og etikett, jf. CSS-ens bottom/top-calc).
  const half = Math.max(...laid.map(g => g.stem + g.height + 10)) + 8;
  const style = `--tl-half:${half}px` + (color ? `;--tl-color:${color}` : "");
  let html = `<div class="timeline tl-prop${extraClass ? " " + extraClass : ""}" style="${style}"><div class="tl-track">`;
  for (const g of laid) {
    const edge = !edgeAlign ? "" : g.pct <= 12 ? " tl-start" : g.pct >= 88 ? " tl-end" : "";
    // Er HELE gruppen hendelser, markeres prikken som det. Blandede grupper
    // (samme årstall, ulik type) beholder standardprikken — den ville ellers
    // lyve om halvparten av innholdet.
    const mark = g.entries.every((e) => e.hendelse) ? " tl-item-hendelse" : "";
    html += `<div class="tl-item tl-${g.dir}${edge}${mark}" style="left:${g.pct.toFixed(1)}%;--stem:${g.stem}px">` +
      `<div class="tl-dot"></div><div class="tl-stem"></div>` +
      `<div class="tl-label"><span class="tl-year">${escapeHtml(g.label)}</span>` +
      g.entries.map((e) =>
        `<span class="tl-desc${e.hendelse ? " tl-desc-hendelse" : ""}"` +
        (e.techId ? ` data-tech-id="${escapeHtml(e.techId)}"` : "") +
        (e.genre ? ` data-genre="${escapeHtml(e.genre)}"` : "") +
        `>${escapeHtml(e.desc)}</span>`
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
// Kalt fra forsidens tiårsvisning (explore-decade.js) OG lærer-tiårsmodalen (også etter
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

// ----------------------------------------------------------------------------
//  INSTRUMENTTIDSLINJE — nyvinningene for én instrumentgruppe
// ----------------------------------------------------------------------------
//  Samme kort som teknologiseksjonen (samlingen `tech`), men gruppert på
//  `instrument` i stedet for `decade`: ett kort = én stilk. Kortene skrives av
//  studentene, så tidslinjen må bygges av dataene og ikke av noen liste i
//  koden — en ny godkjent nyvinning skal dukke opp av seg selv.
//
//  Utformingen er den forfinede fra sjangertidslinjen (navnet nærmest streken,
//  midtstilte etiketter, vekslende stilker), men UTEN farge — da faller den
//  tilbake på --accent og er grønn som innovasjonstidslinjen den stammer fra.
export function instrumentInnovations(techItems, group) {
  return (techItems || [])
    .filter((t) => t.instrument === group && (t.status || "active") === "active")
    .sort((a, b) => (a.adoptedYear || 0) - (b.adoptedYear || 0));
}

export function buildInstrumentTimeline(techItems, group) {
  const items = instrumentInnovations(techItems, group);
  if (items.length < 2) return "";
  const html = buildProportionalTimeline(
    items.map((t) => ({
      year: t.adoptedYear || null,
      // KUN årstallet (brukervalg): adoptedLabel er fritekst som ofte er en hel
      // setning («utviklet 1993, gjennombrudd sent på 1990-tallet»), og den
      // sprengte den lille etiketten. Den lange formen står på selve kortet.
      label: t.adoptedYear ? String(t.adoptedYear) : "",
      desc: t.name,
      techId: t.id,
      hendelse: isHendelse(t),
    })),
    items[0].adoptedYear || 1900,
    { extraClass: "tl-rich", minGapPct: 6, lineH: 21, stemLevels: 2, edgeAlign: false }
  );
  // Tegnforklaring kun når BEGGE typene er på tidslinjen — med bare én type
  // forklarer den et skille som ikke finnes.
  const harBegge = items.some(isHendelse) && items.some((t) => !isHendelse(t));
  return html + (harBegge
    ? `<p class="tl-legend"><span class="tl-legend-dot"></span>teknologisk innovasjon` +
      `<span class="tl-legend-dot tl-legend-hendelse"></span>viktig hendelse</p>`
    : "");
}

// ----------------------------------------------------------------------------
//  SJANGERTIDSLINJE — sjangerfamilien over hver sjangerhistorie
// ----------------------------------------------------------------------------
//  Erstatter den håndskrevne «Sjangertre-løype»-linjen som lå øverst i hver
//  historie: den var manuelt vedlikeholdt og hadde drevet fra treet på fire av
//  seks historier (Cont. jazz, Cont. gospel, Cont. country, Neotrad. country,
//  Cont. R&B og Cont. hip-hop manglet). Her utledes den av GENEALOGY, så en ny
//  node dukker opp i historien sin uten at noen må huske å oppdatere teksten.

// rad → tiårets startår. Samme mapping som DEC i genealogy.js (r1 = 1900).
const rowYear = (r) => 1890 + r * 10;

// Årstallet en node plasseres på. `era` er den mest presise kilden (den er
// forfattet per node: «1957», «ca. 1979», «midten av 1940-tallet»), men den er
// fritekst — finnes det ikke et firesifret årstall der, faller vi tilbake på
// radens tiår, som alltid er satt. Uten era-lesing ville rot-nodene kollidert
// med sjangeren de føder (Work songs og Blues står begge på rad 1).
function nodeYear(n) {
  const m = String(n.era || "").match(/\b(1[5-9]\d{2}|20[0-2]\d)\b/);
  return m ? parseInt(m[1], 10) : rowYear(n.r);
}

// Etiketten over punktet er nodens `era` ORDRETT («1957», «sent 1960-tall»,
// «midten av 1940-tallet»). Vi viser altså ikke det utleste årstallet: der era
// er upresis, ville tallet både sett feil ut og kunne havnet til høyre for et
// høyere tall etter avstamnings-låsingen under.
function nodeLabel(n) {
  const era = String(n.era || "").trim();
  return era || `${rowYear(n.r)}-t`;
}

// Sjangerfamilien til én metasjanger, i tidsrekkefølge. KUN ekte sjangre —
// rot-nodene familien vokste ut av (`g: null`, f.eks. Work songs → Blues) er
// bevisst utelatt (v3.77, brukervalg): de ga lite, og fordi de ligger et helt
// århundre foran resten krevde de et eget aksebrudd som gjorde løypen rotete.
//
// AVSTAMNING LÅSER REKKEFØLGEN: `era` er fritekst, og upresise formuleringer kan
// snu om på slektskapet — «sent 1960-tall» (Blues rock) leses som 1960 og havner
// da FORAN forelderen British invasion («1963–66»). Derfor dyttes hver node til
// minst ett år etter sin seneste forelder i familien. Da kan en strek i treet
// aldri peke bakover på tidslinjen, uansett hvordan era er formulert.
export function genreFamilyNodes(metaGenre) {
  const family = GENEALOGY.filter((n) => n.g === metaGenre);
  if (!family.length) return [];
  // GENEALOGY er sortert slik at foreldre kommer før barn, så ett gjennomløp
  // holder for å propagere låsingen nedover kjeden.
  const year = new Map(family.map((n) => [n.id, nodeYear(n)]));
  for (const n of family) {
    const parents = (n.p || []).filter((pid) => year.has(pid));
    if (!parents.length) continue;
    const earliest = Math.max(...parents.map((pid) => year.get(pid))) + 1;
    if (year.get(n.id) < earliest) year.set(n.id, earliest);
  }
  return family
    .map((n) => ({ n, year: year.get(n.id), label: nodeLabel(n) }))
    .sort((a, b) => a.year - b.year);
}

// Bygger tidslinjen for én metasjanger. Farges av familiefargen fra treet, så
// den snakker samme fargespråk som knappene, varmekartet og sjangerhimmelen.
export function buildGenreTimeline(metaGenre) {
  const nodes = genreFamilyNodes(metaGenre);
  if (nodes.length < 2) return "";
  const items = nodes.map(({ n, year, label }) => ({
    year, label, desc: n.l, genre: n.l,
  }));
  const color = META_GENRE_COLOR[metaGenre] || FAMILIES.gray.stroke;
  return buildProportionalTimeline(items, items[0].year, {
    color,
    extraClass: "tl-rich tl-genre",   // tl-rich = den forfinede utformingen, delt med instrumenttidslinjen
    minGapPct: 6,
    lineH: 21,          // .tl-genre .tl-desc er 0.82rem/600 — se estimateLabelHeight
    stemLevels: 2,      // kort/lang i stedet for stadig lengre stilker
    edgeAlign: false,   // etikettene midtstilles også ytterst, ikke kantstilles
  });
}
