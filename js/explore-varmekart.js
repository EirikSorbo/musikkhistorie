// ============================================================================
//  VARMEKART: mainGenre (rad) × tiår (kolonne)
// ----------------------------------------------------------------------------
//  Flyttet ut av explore.js (v3.54). Den delte kjernen (opts, getState) og de
//  de-dupliserte hjelperne (groupColor, metaGroupHeadHtml, wireMetaAccordion)
//  kommer fra explore-context.js.
// ============================================================================
import { escapeHtml, modalOpen } from "./ui.js?v=5.39";
import { GENEALOGY_MAIN_GENRES, META_GENRE_ORDER, MAIN_GENRE_INFO, FAMILIES } from "./genre-model.js?v=5.39";
import { opts, getState, groupColor, metaGroupHeadHtml, wireMetaAccordion } from "./explore-context.js?v=5.39";
import { heatColor, heatRow, HEAT_NODATA } from "./heat-strip.js?v=5.39";
// Aksen, radene og lærerens nivåvelger er delt med sjangerhistoriene (v5.16).
import { heatBlockHtml, heatAxisRowHtml, heatRowsHtml, wireHeatRows } from "./heat-rows.js?v=5.39";

// Varmekart: mainGenre (rad) × tiår (kolonne). Radene hentes dynamisk fra
// treet (GENEALOGY_MAIN_GENRES) — nye sjangre dukker opp automatisk.
// «Varmen» er redaksjonell: nivå 0–5 for hvor toneangivende sjangeren var det
// tiåret. Nivåene bor i Firestore (content/varmekart.heat, importert fra
// innholds-JSON eller redigert via celleklikk som lærer) — sjangre uten data
// vises som «ingen data».
// Tiårsaksen og radene bor i heat-rows.js/heat-strip.js, som begge leser
// DECADES direkte. Heat-radene er indeksbaserte og heatRow padder korte rader,
// så en utvidelse (2030-t) slår gjennom alle flatene samtidig.
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

  let html = "";
  if (!hasData) {
    html += `<p class="gx-missing" style="margin-bottom:14px">${s.contentLoaded
      ? "Varmekart-nivåene er ikke lagt inn ennå. Læreren legger dem inn via innholds-importen" + (opts.onHeatEdit ? ", eller ved å trykke på cellene under" : "") + "."
      : "Laster innhold …"}</p>`;
  }
  // Scrolleren, aksen og radene er de delte (heat-rows.js) — historiene viser
  // nøyaktig samme rad over fortellingen sin.
  let rader = heatAxisRowHtml();

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
    rader += metaGroupHeadHtml({
      prefix: "vk", meta, gColor, open, groupIdx,
      count: `${labels.length} sjanger${labels.length === 1 ? "" : "e"}`,
      metaAttr: ` data-vk-meta="${escapeHtml(meta)}"`,
    });
    groupIdx++;

    labels.forEach((sj) => usedFams.add(MAIN_GENRE_INFO[sj]?.fam));
    rader += `<div class="vk-group-rows" style="display:${open ? "block" : "none"}">`;
    rader += heatRowsHtml(labels, {
      heat, meta,
      colorFor: (sj) => MAIN_GENRE_INFO[sj]?.color || gColor,
    });
    rader += `</div>`;   // .vk-group-rows
    rader += `</div>`;   // .vk-group
  }
  html += heatBlockHtml(rader);

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
    // Målet følger VALGET (v5.28): «Kopier lenke», plussknappen og opptaket
    // skal peke på gruppa læreren faktisk viser, ikke på standardvisningen.
    const modal = document.getElementById("modal-varmekart");
    if (modal) {
      const meta = !wasOpen && group?.dataset.vkMeta;
      modal.dataset.vis = meta ? `varmekart:${meta}` : "varmekart";
    }
  });

  // Radfremheving, sjangerkort-klikk og lærerens celleklikk: alt sammen delt
  // med historiene (heat-rows.js).
  wireHeatRows(body);
}

// Med `meta` (dyp lenke «varmekart:Country», kjøreplan-stopp) åpnes den
// gruppa i stedet for den første.
export function openVarmekart(meta) {
  const modal = document.getElementById("modal-varmekart");
  if (!modal) return;
  vkOpenMeta = meta || null;   // frisk åpning uten meta: første gruppe åpen
  modal.dataset.vis = meta ? `varmekart:${meta}` : "varmekart";
  renderVarmekartBody();
  modalOpen(modal);
}

