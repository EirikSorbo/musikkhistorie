// ============================================================================
//  VARMEKART: mainGenre (rad) × tiår (kolonne)
// ----------------------------------------------------------------------------
//  Flyttet ut av explore.js (v3.54). Den delte kjernen (opts, getState) og de
//  de-dupliserte hjelperne (groupColor, metaGroupHeadHtml, wireMetaAccordion)
//  kommer fra explore-context.js.
// ============================================================================
import { escapeHtml, modalOpen, modalClose } from "./ui.js?v=3.63";
import { DECADES } from "./limits.js?v=3.63";
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, MAIN_GENRE_INFO, FAMILIES } from "./genealogy.js?v=3.63";
import { opts, getState, groupColor, metaGroupHeadHtml, wireMetaAccordion } from "./explore-context.js?v=3.63";

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
// Cellene fargelegges i hver sjangers familiefarge (fra slektstreet), mens
// varmenivået (0–5) styrer lysheten: lyst = lite toneangivende, mørkt = mye.
// Slik bærer ruten to akser samtidig — hvilken familie (kulør) og hvor sterk
// (valør). VK_INK er en nøytral grå brukt i nivå-forklaringen.
const VK_INK = "#5b6b7a";
const hexToRgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgbToHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function heatColor(famHex, level) {
  const base = hexToRgb(famHex), white = [255, 255, 255], black = [0, 0, 0];
  const t = level / 5;                              // 0 (lys) … 1 (mørk)
  const tint = mix(white, base, 0.12 + 0.88 * t);  // hvitt → familiefarge
  return rgbToHex(mix(tint, black, 0.12 * t));      // mørkne toppen litt for valør
}

// Rad-oppslag: alltid 13 celler (VK_DECADES), manglende/korte rader fylles
// med null («ingen data») — så cellene alltid kan klikkes og redigeres.
function vkRow(heat, sj) {
  const raw = heat?.[sj];
  return VK_DECADES.map((_, i) => {
    const v = Array.isArray(raw) ? raw[i] : null;
    return Number.isInteger(v) && v >= 0 && v <= 5 ? v : null;
  });
}

// Husker hvilken metagruppe som står åpen, så redigering (som re-rendrer
// gjennom contentChanged) ikke klapper akkordeonen sammen igjen.
let vkOpenMeta = null;


export function renderVarmekartBody() {
  const body = document.getElementById("vk-body");
  if (!body) return;
  const s = getState();
  const heat = s.content?.varmekart?.heat || null;
  const hasData = !!heat && Object.keys(heat).length > 0;
  const cols = VK_DECADES.length;
  const gridStyle = `display:grid;grid-template-columns:128px repeat(${cols},minmax(32px,1fr));gap:3px`;

  let html = "";
  if (!hasData) {
    html += `<p class="gx-missing" style="margin-bottom:14px">${s.contentLoaded
      ? "Varmekart-nivåene er ikke lagt inn ennå. Læreren legger dem inn via innholds-importen" + (opts.onHeatEdit ? " — eller ved å trykke på cellene under" : "") + "."
      : "Laster innhold …"}</p>`;
  }
  html += `<div style="overflow-x:auto"><div style="min-width:600px">`;
  html += `<div style="${gridStyle};align-items:end;margin-bottom:3px"><div></div>`;
  html += VK_DECADES.map((d) => `<div style="text-align:center;font-size:0.72rem;color:var(--muted)">${d}</div>`).join("");
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

  // Grupper mainGenre etter metaGenre (supersjanger). Treet gir både
  // grupperingen (MAIN_GENRE_INFO[sj].meta) og fargene (…​.color), så
  // varmekartet snakker samme visuelle språk som slektstreet.
  const groups = new Map();
  for (const sj of GENEALOGY_MAIN_GENRES) {
    const meta = MAIN_GENRE_INFO[sj]?.meta || "Andre";
    if (!groups.has(meta)) groups.set(meta, []);
    groups.get(meta).push(sj);
  }
  // Metaorden følger treet (≈ kronologisk); evt. ukjente legges sist.
  const metaOrder = [...GENEALOGY_META_GENRES, ...[...groups.keys()].filter((m) => !GENEALOGY_META_GENRES.includes(m))];
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
      html += `<div style="${gridStyle};align-items:center;margin-bottom:3px">`;
      html += `<div style="font-size:0.82rem;color:var(--text);line-height:1.2;border-left:3px solid ${rowColor};padding:1px 8px 1px 9px">${escapeHtml(sj)}</div>`;
      html += vals.map((v, i) => {
        const has = v != null;
        const bg = has ? heatColor(rowColor, v) : "#f5f8f6";
        const title = `${sj} · ${meta} · ${VK_DECADES[i]}-tallet${has ? ` · nivå ${v}/5` : " · ingen data"}${opts.onHeatEdit ? " · klikk for å endre" : ""}`;
        // Lærer: cellene er klikkbare (nivåvelger). Student: rene ruter.
        return opts.onHeatEdit
          ? `<button type="button" class="vk-cell" data-vk-genre="${escapeHtml(sj)}" data-vk-idx="${i}" title="${escapeHtml(title)}" style="height:30px;border-radius:6px;padding:0;cursor:pointer;background:${bg};border:${has ? "1px solid transparent" : "1px dashed var(--line-strong)"}"></button>`
          : `<div title="${escapeHtml(title)}" style="height:30px;border-radius:6px;background:${bg}${has ? "" : ";border:1px dashed var(--line-strong)"}"></div>`;
      }).join("");
      html += `</div>`;
    }
    html += `</div>`;   // .vk-group-rows
    html += `</div>`;   // .vk-group
  }
  html += `</div></div>`;

  // Forklaring 1: varmenivå (valør) — nøytral grå, da kuløren nå viser familie.
  html += `<div style="display:flex;align-items:center;gap:8px;margin-top:18px;font-size:0.8rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span>Mindre toneangivende</span>`;
  html += [1, 2, 3, 4, 5].map((v) => `<span style="width:22px;height:14px;border-radius:4px;background:${heatColor(VK_INK, v)}"></span>`).join("");
  html += `<span>Mer</span>`;
  html += `<span style="margin-left:14px;display:inline-flex;align-items:center;gap:6px"><span style="width:22px;height:14px;border-radius:4px;background:#f5f8f6;border:1px dashed var(--line-strong)"></span>ingen data ennå</span>`;
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
