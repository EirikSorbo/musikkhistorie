// ============================================================================
//  VARMEKART: mainGenre (rad) × tiår (kolonne)
// ----------------------------------------------------------------------------
//  Flyttet ut av explore.js (v3.54). Den delte kjernen (opts, getState) og de
//  de-dupliserte hjelperne (groupColor, metaGroupHeadHtml, wireMetaAccordion)
//  kommer fra explore-context.js.
// ============================================================================
import { escapeHtml, modalOpen, modalClose } from "./ui.js?v=5.00";
import { DECADES } from "./limits.js?v=5.00";
import { GENEALOGY_MAIN_GENRES, META_GENRE_ORDER, MAIN_GENRE_INFO, FAMILIES } from "./genre-model.js?v=5.00";
import { opts, getState, groupColor, metaGroupHeadHtml, wireMetaAccordion, onMainGenreClick } from "./explore-context.js?v=5.00";
import { heatColor, heatRow, heatStripHtml, heatAxisHtml, HEAT_NODATA } from "./heat-strip.js?v=5.00";

// Varmekart: mainGenre (rad) × tiår (kolonne). Radene hentes dynamisk fra
// treet (GENEALOGY_MAIN_GENRES) — nye sjangre dukker opp automatisk.
// «Varmen» er redaksjonell: nivå 0–5 for hvor toneangivende sjangeren var det
// tiåret. Nivåene bor i Firestore (content/varmekart.heat, importert fra
// innholds-JSON eller redigert via celleklikk som lærer) — sjangre uten data
// vises som «ingen data».
// Varmekart-kolonnene ER tiårsaksen (DECADES) — samme kilde, så en utvidelse
// (2030-t) slår gjennom begge steder samtidig. Heat-radene er indeksbaserte og
// vkRow padder korte rader, så en utvidelse er bakoverkompatibel.
const VK_DECADES = DECADES;
// Selve stripa — fargeskala, gradient og rad-oppslag — bor i heat-strip.js,
// delt med sjangerkortet. VK_INK er en nøytral grå brukt i nivå-forklaringen.
const VK_INK = "#5b6b7a";
const vkRow = heatRow;

// Husker hvilken metagruppe som står åpen, så redigering (som re-rendrer
// gjennom contentChanged) ikke klapper akkordeonen sammen igjen.
let vkOpenMeta = null;


export function renderVarmekartBody() {
  const body = document.getElementById("vk-body");
  if (!body) return;
  const s = getState();
  const heat = s.content?.varmekart?.heat || null;
  const hasData = !!heat && Object.keys(heat).length > 0;
  // Raden er nå to spor: etiketten og ÉN sammenhengende stripe. Tiårsoverskriftene
  // ligger i et eget 13-kolonners rutenett UTEN luft inni stripe-sporet, så
  // etikettmidtene treffer segmentmidtene på prosenten.
  const gridStyle = `display:grid;grid-template-columns:128px 1fr;gap:10px;align-items:center`;

  let html = "";
  if (!hasData) {
    html += `<p class="gx-missing" style="margin-bottom:14px">${s.contentLoaded
      ? "Varmekart-nivåene er ikke lagt inn ennå. Læreren legger dem inn via innholds-importen" + (opts.onHeatEdit ? ", eller ved å trykke på cellene under" : "") + "."
      : "Laster innhold …"}</p>`;
  }
  html += `<div style="overflow-x:auto"><div style="min-width:600px">`;
  html += `<div style="${gridStyle};align-items:end;margin-bottom:6px"><div></div>`;
  html += heatAxisHtml();   // delt tiårsakse, samme som på sjangerkortet
  html += `</div>`;

  const firstHot = (sj) => { const i = vkRow(heat, sj).findIndex((v) => v > 0); return i < 0 ? 99 : i; };

  // Datadrevne konsistensvarsler (bare når data finnes): tre-sjangre uten rad
  // vises som «ingen data»; rader uten tre-sjanger kan aldri rendres.
  if (hasData) {
    const missing = GENEALOGY_MAIN_GENRES.filter((sj) => !heat[sj]);
    if (missing.length) console.warn(`Varmekart: ${missing.length} sjanger(e) mangler rad i content/varmekart og vises som «ingen data»:`, missing);
    const orphan = Object.keys(heat).filter((k) => !GENEALOGY_MAIN_GENRES.includes(k));
    if (orphan.length) console.warn(`Varmekart: ${orphan.length} rad(er) i content/varmekart matcher ingen tre-sjanger og vises aldri:`, orphan);
  }

  // Grupper mainGenre etter metaGenre (metasjanger). Treet gir både
  // grupperingen (MAIN_GENRE_INFO[sj].meta) og fargene (…​.color), så
  // varmekartet snakker samme visuelle språk som slektstreet.
  const groups = new Map();
  for (const sj of GENEALOGY_MAIN_GENRES) {
    const meta = MAIN_GENRE_INFO[sj]?.meta || "Andre";
    if (!groups.has(meta)) groups.set(meta, []);
    groups.get(meta).push(sj);
  }
  // Metaorden er den pedagogiske (META_GENRE_ORDER) — samme rekkefølge som
  // artistenes tidslinje, så de to flatene leses likt; evt. ukjente legges sist.
  const metaOrder = [...META_GENRE_ORDER, ...[...groups.keys()].filter((m) => !META_GENRE_ORDER.includes(m))];
  const usedFams = new Set();

  let groupIdx = 0;
  for (const meta of metaOrder) {
    const labels = (groups.get(meta) || []).sort((a, b) => firstHot(a) - firstHot(b) || a.localeCompare(b, "no"));
    if (!labels.length) continue;
    const gColor = groupColor(labels);
    // Akkordeon: gruppa som sist sto åpen (redigering re-rendrer), ellers første.
    const open = vkOpenMeta ? meta === vkOpenMeta : groupIdx === 0;

    // Gruppeoverskrift: klikkbar akkordeon-bryter — caret + farget prikk + navn + antall.
    html += metaGroupHeadHtml({
      prefix: "vk", meta, gColor, open, groupIdx,
      count: `${labels.length} sjanger${labels.length === 1 ? "" : "e"}`,
      metaAttr: ` data-vk-meta="${escapeHtml(meta)}"`,
    });
    groupIdx++;

    html += `<div class="vk-group-rows" style="display:${open ? "block" : "none"}">`;
    for (const sj of labels) {
      const rowColor = MAIN_GENRE_INFO[sj]?.color || gColor;
      usedFams.add(MAIN_GENRE_INFO[sj]?.fam);
      const vals = vkRow(heat, sj);
      // Raden er ett fremhevings-mål (.vk-row): båndet under pekeren må dekke
      // BÅDE etiketten og stripa, ellers hjelper det ikke å finne igjen linja.
      // Den loddrette luften ligger derfor som padding inni raden, ikke som
      // margin utenfor — margin ville falt utenfor båndet.
      html += `<div class="vk-row" style="${gridStyle};margin-bottom:2px;padding:2px 0">`;
      // Etiketten er en knapp: klikk åpner sjangerkortet (v4.83). Stripa er
      // fortsatt lærerens redigeringsflate, så de to klikkmålene ligger side om
      // side uten å slåss om samme hendelse.
      html += `<button type="button" class="vk-rowlabel" data-vk-open="${escapeHtml(sj)}" title="Åpne sjangerkortet for ${escapeHtml(sj)}" style="font-size:0.82rem;color:var(--text);line-height:1.2;border-left:3px solid ${rowColor};padding:1px 8px 1px 9px">${escapeHtml(sj)}</button>`;
      // Stripa er den delte (heat-strip.js). Her byttes bare tiårsfeltene ut med
      // varmekartets egne: full hjelpetekst, og for læreren klikkbare knapper.
      html += heatStripHtml(rowColor, vals, (v, i, pos) => {
        const has = v != null;
        const title = `${sj} · ${meta} · ${VK_DECADES[i]}-tallet${has ? ` · nivå ${v}/5` : " · ingen data"}${opts.onHeatEdit ? " · klikk for å endre" : ""}`;
        return opts.onHeatEdit
          ? `<button type="button" class="vk-cell" data-vk-genre="${escapeHtml(sj)}" data-vk-idx="${i}" title="${escapeHtml(title)}" style="${pos}"></button>`
          : `<div class="vk-cell" title="${escapeHtml(title)}" style="${pos}"></div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;   // .vk-group-rows
    html += `</div>`;   // .vk-group
  }
  html += `</div></div>`;

  // Forklaring 1: varmenivå (valør) — nøytral grå, da kuløren nå viser familie.
  html += `<div style="display:flex;align-items:center;gap:8px;margin-top:18px;font-size:0.8rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span>Mindre toneangivende</span>`;
  // Sammenhengende skala, som stripene selv. Seks stopp (0–5) i stedet for to,
  // fordi heatColor ikke er helt lineær — den mørkner toppen litt ekstra.
  const scale = [0, 1, 2, 3, 4, 5].map((v) => `${heatColor(VK_INK, v)} ${(v / 5 * 100).toFixed(0)}%`).join(",");
  html += `<span style="width:132px;height:10px;border-radius:5px;background:linear-gradient(to right,${scale})"></span>`;
  html += `<span>Mer</span>`;
  html += `<span style="margin-left:14px;display:inline-flex;align-items:center;gap:6px"><span style="width:22px;height:10px;border-radius:5px;background:${HEAT_NODATA};border:1px dashed var(--line-strong)"></span>ingen data ennå</span>`;
  html += `</div>`;

  // Forklaring 2: fargene = slektstreets familier (kun de som faktisk vises).
  const famLegend = Object.entries(FAMILIES)
    .filter(([k]) => usedFams.has(k))
    .map(([, v]) => `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:13px;height:3px;border-radius:2px;background:${v.stroke}"></span>${escapeHtml(v.label)}</span>`)
    .join("");
  html += `<div style="display:flex;align-items:center;gap:14px;margin-top:8px;font-size:0.78rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span>Fargene følger slektstreet:</span>${famLegend}`;
  html += `</div>`;

  body.innerHTML = html;

  // Akkordeon: klikk på en metagruppe åpner den og lukker de andre (klikk på en
  // åpen gruppe lukker den). Navigerer via .vk-group-strukturen for å unngå
  // selector-problemer med metanavn som «R&B».
  wireMetaAccordion(body, "vk", (wasOpen, group) => {
    vkOpenMeta = wasOpen ? "__ingen" : (group?.dataset.vkMeta || null);
  });

  // Fremheving av én rad. Hover-enheter får den fra CSS; berøring har ingen
  // hover, så der låser et trykk raden i stedet (nytt trykk på samme rad slår
  // den av, trykk på en annen flytter den). Klikk oppfører seg likt på
  // pekerenheter — da kan man «feste» en rad mens man leser den.
  // Lærerens celleklikk lever videre ved siden av: begge lytterne får hendelsen,
  // så raden festes samtidig som nivåvelgeren åpnes.
  body.querySelectorAll(".vk-row").forEach((row) => {
    row.addEventListener("click", () => {
      const wasActive = row.classList.contains("is-active");
      body.querySelectorAll(".vk-row.is-active").forEach((r) => r.classList.remove("is-active"));
      if (!wasActive) row.classList.add("is-active");
    });
  });

  // Klikk på sjangernavnet åpner sjangerkortet — samme inngang som overalt
  // ellers (onMainGenreClick). Raden festes samtidig av lytteren over, så den
  // står uthevet når kortet lukkes igjen.
  body.querySelectorAll("[data-vk-open]").forEach((btn) => {
    btn.addEventListener("click", () => onMainGenreClick(btn.dataset.vkOpen));
  });

  // Lærer: klikk på en celle åpner nivåvelgeren.
  if (opts.onHeatEdit) {
    body.querySelectorAll(".vk-cell").forEach((cell) => {
      cell.addEventListener("click", () =>
        openVkEdit(cell.dataset.vkGenre, Number(cell.dataset.vkIdx)));
    });
  }
}

export function openVarmekart() {
  const modal = document.getElementById("modal-varmekart");
  if (!modal) return;
  vkOpenMeta = null;   // frisk åpning: første gruppe åpen
  renderVarmekartBody();
  modalOpen(modal);
}

// Nivåvelgeren (lærer): «Blues · 1950-tallet» med knappene 0–5 + «Ingen
// data». Lagring skjer via opts.onHeatEdit(sjanger, nyRad) — hele raden
// sendes, så datalaget slipper å kjenne tiårsindeksen. Snapshotet oppdaterer
// state.content → contentChanged() → varmekartet re-rendres bak velgeren.
function openVkEdit(genre, idx) {
  const modal = document.getElementById("modal-vk-edit");
  if (!modal) return;
  const heat = getState().content?.varmekart?.heat || {};
  const row = vkRow(heat, genre);
  const current = row[idx];
  document.getElementById("vke-title").textContent = `${genre} · ${VK_DECADES[idx]}-tallet`;
  const msg = document.getElementById("vke-msg");
  msg.textContent = "";
  msg.className = "form-msg";
  const btns = document.getElementById("vke-buttons");
  btns.innerHTML = [0, 1, 2, 3, 4, 5].map((v) =>
    `<button type="button" class="btn ${current === v ? "primary" : "ghost"}" data-vke-level="${v}" style="min-width:44px">${v}</button>`
  ).join("") +
    `<button type="button" class="btn ${current == null ? "primary" : "ghost"}" data-vke-level="" style="flex:1">Ingen data</button>`;
  btns.querySelectorAll("[data-vke-level]").forEach((b) => {
    b.addEventListener("click", async () => {
      const level = b.dataset.vkeLevel === "" ? null : Number(b.dataset.vkeLevel);
      const newRow = row.slice();
      newRow[idx] = level;
      msg.textContent = "Lagrer …";
      msg.className = "form-msg ok";
      try {
        await opts.onHeatEdit(genre, newRow);
        modalClose(modal);
      } catch (err) {
        console.error("Varmekart-lagring feilet:", err);
        msg.textContent = "Feil: " + (err?.message || err);
        msg.className = "form-msg error";
      }
    });
  });
  modalOpen(modal);
}
