// ============================================================================
//  KART: musikkens geografi
// ----------------------------------------------------------------------------
//  Flyttet ut av explore.js (v3.55, runde 2). kartDecade er modul-tilstand her.
// ============================================================================
import { modalOpen, renderDecadeRibbon, escapeHtml, openArtistListModal } from "./ui.js?v=3.68";
import { isVisible } from "./limits.js?v=3.68";
import { MAP_VIEW, MAP_COUNTRIES, projectPoint } from "./geo-map-data.js?v=3.68";
import { aggregatePlaces, unknownPlaces } from "./geo-places.js?v=3.68";
import { opts, getState } from "./explore-context.js?v=3.68";

// ----------------------------------------------------------------------------
//  Kart: musikkens geografi. Nord-Amerika-utsnitt (Natural Earth-omriss i
//  geo-map-data.js) med én prikk per sted (geo-places.js kobler geography-
//  tekstene til koordinater). Tiårsfilter viser migrasjonen; steder utenfor
//  utsnittet (Oslo, London …) vises som klikkbare chips OVER kartet, så de
//  ikke forsvinner stille. Klikk på prikk/chip → artistliste → artistkort.
// ----------------------------------------------------------------------------
let kartDecade = null;   // null = alle tiår

export function openKart() {
  const modal = document.getElementById("modal-kart");
  if (!modal) return;
  renderKart();
  modalOpen(modal);
  // Hold tabellen i synk: nye steder i dataene skal legges til i PLACES.
  const unknown = unknownPlaces(getState().artists.filter(isVisible));
  if (unknown.length) {
    console.warn(`Kart: ${unknown.length} sted(er) mangler i PLACES (js/geo-places.js) og vises som «ikke plassert»:`, unknown);
  }
}

// Full render: tegner det STATISKE landomrisset (~68 KB path-data) ÉN gang, med
// et tomt prikk-lag under. Tiårsbytte kaller renderKartDots(), som kun oppdaterer
// prikkene/chips/stripa — ikke re-parser hele omrisset (merkbart på svak mobil).
function renderKart() {
  let svg = `<div style="overflow-x:auto"><svg viewBox="0 0 ${MAP_VIEW.w} ${MAP_VIEW.h}" style="width:100%;min-width:560px;display:block" role="img" aria-label="Kart over Nord-Amerika med artistenes virkesteder">`;
  svg += MAP_COUNTRIES.map((c) =>
    `<path d="${c.d}" style="fill:var(--bg-soft,#eef1f4);stroke:var(--line-strong,#cbd5df);stroke-width:0.7" />`).join("");
  svg += `<g id="kart-dots"></g></svg></div>`;
  document.getElementById("kart-svg").innerHTML = svg;
  renderKartDots();
}

function renderKartDots() {
  const s = getState();
  const active = s.artists.filter(isVisible);
  const { onMap, abroad, unplaced } = aggregatePlaces(active, { decade: kartDecade });
  const DOT = "#1d4ed8";   // én kulør — størrelse bærer informasjonen

  // Tiårsvelger: samme klikkbare tidslinje-stripe som Samfunn/Teknologi bruker,
  // pluss en «Alle»-prikk helt til venstre. kartDecade === null betyr alle tiår.
  renderDecadeRibbon(document.getElementById("kart-decades"), kartDecade, (d) => {
    kartDecade = d;
    renderKartDots();
  }, { all: true });

  // Prikkene: radius ~ kvadratrot av antall (arealet skalerer med antallet);
  // tekstetikett på de største. Skrives inn i det statiske omrissets prikk-lag.
  const r = (n) => Math.min(3 + 2.1 * Math.sqrt(n), 17);
  const placed = onMap.map((p, i) => ({ ...p, ...projectPoint(p.lat, p.lng), i }));
  // Store prikker tegnes først så små forblir klikkbare oppå.
  placed.sort((a, b) => b.count - a.count);
  let dots = placed.map((p) => {
    const style = p.region
      ? `fill:${DOT};fill-opacity:0.10;stroke:${DOT};stroke-width:1.2;stroke-dasharray:4 3`
      : `fill:${DOT};fill-opacity:0.68;stroke:#fff;stroke-width:1`;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r(p.count).toFixed(1)}" data-place="${p.i}" style="${style};cursor:pointer"><title>${escapeHtml(`${p.label} · ${p.count} artist${p.count === 1 ? "" : "er"}`)}</title></circle>`;
  }).join("");
  dots += placed.filter((p) => p.count >= 6).map((p) =>
    `<text x="${(p.x + r(p.count) + 3).toFixed(1)}" y="${(p.y + 3.5).toFixed(1)}" style="font-size:13px;fill:var(--text,#1f2937);pointer-events:none">${escapeHtml(p.label)}</text>`).join("");
  const dotsG = document.getElementById("kart-dots");
  dotsG.innerHTML = dots;
  dotsG.querySelectorAll("[data-place]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = placed.find((x) => String(x.i) === el.dataset.place);
      if (p) openArtistListModal(p.label, p.artists, opts.onArtistClick, "Ingen artister her i valgt tiår.");
    });
  });

  // Utenfor kartet: klikkbare chips, samme oppførsel som prikkene.
  const abEl = document.getElementById("kart-abroad");
  abEl.innerHTML = abroad.length
    ? `<p class="muted" style="font-size:0.82rem;margin-bottom:6px">Også knyttet til steder utenfor kartet:</p>` +
      `<div style="display:flex;gap:6px;flex-wrap:wrap">` +
      abroad.map((p, i) =>
        `<button type="button" class="tag tag-sjanger" data-abroad="${i}" title="${escapeHtml(p.abroad)}">${escapeHtml(p.label)} (${p.count})</button>`).join("") +
      `</div>`
    : "";
  abEl.querySelectorAll("[data-abroad]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = abroad[Number(el.dataset.abroad)];
      if (p) openArtistListModal(`${p.label} (${p.abroad})`, p.artists, opts.onArtistClick, "Ingen artister her i valgt tiår.");
    });
  });

  // Ærlig regnskap over artister uten plasserbart sted (klikkbar liste).
  const footEl = document.getElementById("kart-unplaced-row");
  const unplacedCount = unplaced.reduce((sum, u) => sum + u.count, 0);
  footEl.innerHTML = unplacedCount
    ? `<button type="button" class="btn ghost small" id="kart-unplaced">${unplacedCount} artist${unplacedCount === 1 ? "" : "er"} uten plasserbart sted</button>`
    : "";
  const upBtn = footEl.querySelector("#kart-unplaced");
  if (upBtn) upBtn.addEventListener("click", () => {
    const all = [];
    const seen = new Set();
    for (const u of unplaced) for (const a of u.artists) {
      const k = a.id ?? a;
      if (!seen.has(k)) { seen.add(k); all.push(a); }
    }
    openArtistListModal("Uten plasserbart sted", all, opts.onArtistClick, "Ingen.");
  });
}
