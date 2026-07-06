// ============================================================================
//  SJANGERHIMMELEN — stjernekart i slektstreets rekkefølge.
//
//  Samme oppsett som sjangertreet (js/genealogy.js): tid nedover, familier
//  bortover. Vi LESER bare GENEALOGY (cx/rad/foreldre) — treet self (tre.html)
//  røres ikke. Hver sjanger er en «stjerne» plassert der noden står i treet, med
//  svake avstamningslinjer som tegner skjelettet.
//
//  I ro vises BARE sjangerstjernene (rolig, lesbart). Når du holder over (eller
//  trykker på mobil) en stjerne, spretter sjangerens artister frem som et
//  stjernebilde rundt den — så du aldri ser mer enn én sjangers navn om gangen
//  (maks ~42 i stedet for 257 oppå hverandre). Bro-artister (flere mainGenre)
//  skyter samtidig en tråd til de ANDRE sjangrene sine, som lyser opp — broene
//  i historien, uten permanent floke.
//
//  Fargene følger slektstreets familier (FAMILIES/node.fam). Egen liten
//  layout — ingen avhengigheter. Zoom/pan for detaljer.
// ============================================================================
import { GENEALOGY, GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, MAIN_GENRE_INFO, FAMILIES } from "./genealogy.js?v=2.89";
import { escapeHtml } from "./ui-helpers.js?v=2.89";

const SVGNS = "http://www.w3.org/2000/svg";
// Lerret i treets rekkefølge (samme cx-orden som genealogy.js), men radene er
// komprimert vertikalt (64 px mot treets 95) så hele kartet får plass i modalen
// uten scroll — fokus-zoom tar seg av lesbarheten i detalj.
const ROW_Y = (r) => 55 + r * 64;
const VBW = 1660, VBH = 900;
const ZOOM_MIN = 0.7, ZOOM_MAX = 7;

const canonMain = new Map(GENEALOGY_MAIN_GENRES.map((g) => [g.toLowerCase(), g]));
const canonMeta = new Map(GENEALOGY_META_GENRES.map((g) => [g.toLowerCase(), g]));
// Familie per metaGenre (hyppigst blant metaens tre-sjangre) — for løse artister.
const META_FAM = (() => {
  const tally = new Map();
  for (const info of Object.values(MAIN_GENRE_INFO)) {
    if (!tally.has(info.meta)) tally.set(info.meta, {});
    tally.get(info.meta)[info.fam] = (tally.get(info.meta)[info.fam] || 0) + 1;
  }
  const out = {};
  for (const [meta, fams] of tally) out[meta] = Object.entries(fams).sort((a, b) => b[1] - a[1])[0][0];
  return out;
})();

const famColor = (fam) => FAMILIES[fam]?.stroke || FAMILIES.gray.stroke;
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};

// ----------------------------------------------------------------------------
//  Bygg grafen: sjangernoder (fra GENEALOGY) med artistene sine, i treets
//  posisjoner. Bro-artister får en dott per sjanger de er tagget i, hver med
//  peker til sine ANDRE sjangre (for trådene som lyser opp ved fokus).
// ----------------------------------------------------------------------------
function buildGraph(artists) {
  const nodeById = new Map();
  for (const n of GENEALOGY) {
    nodeById.set(n.id, {
      id: n.id, label: n.l, fam: n.fam, isGenre: !!n.g,
      x: n.cx, y: ROW_Y(n.r), parents: n.p || [], reactions: n.rx || [],
      artists: [],
    });
  }
  // Slå artist-tagger til node-id via label.
  const nodeByLabel = new Map();
  for (const node of nodeById.values()) if (node.isGenre) nodeByLabel.set(node.label.toLowerCase(), node);

  const loose = [];
  for (const a of artists) {
    const genreNodes = [...new Set((a.mainGenre || [])
      .map((g) => canonMain.get(String(g).toLowerCase()))
      .filter(Boolean)
      .map((lbl) => nodeByLabel.get(lbl.toLowerCase()))
      .filter(Boolean))];
    if (!genreNodes.length) { loose.push(a); continue; }
    for (const node of genreNodes) node.artists.push({ artist: a, others: genreNodes.filter((n) => n !== node) });
  }

  const genres = [...nodeById.values()].filter((n) => n.isGenre && n.artists.length);
  const roots = [...nodeById.values()].filter((n) => !n.isGenre || !n.artists.length);
  return { nodeById, genres, roots, loose, allNodes: [...nodeById.values()] };
}

const starR = (count) => 9 + Math.sqrt(count) * 2.3;

// Phyllotaxis-utlegg: jevn «solsikke»-spredning av artistene rundt stjernen,
// stabil (deterministisk) og kompakt uansett antall.
function fanOffset(i, n) {
  const golden = 2.399963229728653;
  const rad = 30 + 18 * Math.sqrt(i);
  const a = i * golden;
  return { dx: Math.cos(a) * rad, dy: Math.sin(a) * rad, a };
}

// Ett rAF/håndtak-sett per container, så gjenåpning ikke lekker lyttere.
const teardown = new WeakMap();

// ----------------------------------------------------------------------------
export function renderSjangerhimmel(container, artists, { onArtistClick, onGenreClick } = {}) {
  teardown.get(container)?.();
  if (!artists.length) { container.innerHTML = `<p class="muted">Ingen artister ennå.</p>`; return; }

  const { genres, roots, loose } = buildGraph(artists);
  const famsPresent = Object.keys(FAMILIES).filter((f) => genres.some((n) => n.fam === f));
  const bridgeCount = new Set(
    genres.flatMap((n) => n.artists.filter((m) => m.others.length).map((m) => m.artist))
  ).size;

  container.innerHTML = `
    <div class="sh-chips" id="sh-chips"></div>
    <div class="sh-toolbar">
      <label class="sh-bro-toggle"><input type="checkbox" id="sh-bro"> Vis alle broer (${bridgeCount})</label>
      <span class="sh-counts">${genres.length} sjangre · hold over en stjerne for artistene${loose.length ? ` · <button type="button" id="sh-loose" class="sh-linkbtn">${loose.length} uten tre-sjanger</button>` : ""}</span>
      <span class="sh-zoom-btns">
        <button type="button" class="btn ghost small" id="sh-zoom-out" aria-label="Zoom ut">−</button>
        <button type="button" class="btn ghost small" id="sh-zoom-in" aria-label="Zoom inn">+</button>
        <button type="button" class="btn ghost small" id="sh-zoom-reset" aria-label="Nullstill">⟲</button>
      </span>
    </div>
    <div id="sh-svg-wrap">
      <div id="sh-focus-panel" class="sh-focus-panel" hidden></div>
    </div>
    <div class="sh-legend">
      <span><span class="sh-lg-star"></span>sjanger (større = flere artister)</span>
      <span><span class="sh-lg-dot"></span>artist</span>
      <span><span class="sh-lg-thread"></span>bro til annen sjanger</span>
      <span>hold over / trykk en stjerne</span>
    </div>`;

  const svg = el("svg", { id: "sh-svg", viewBox: `0 0 ${VBW} ${VBH}`,
    preserveAspectRatio: "xMidYMid meet", role: "img",
    "aria-label": "Stjernekart over sjangrene i slektstreets rekkefølge; hold over en sjanger for artistene" });
  svg.style.width = "100%"; svg.style.display = "block";
  container.querySelector("#sh-svg-wrap").prepend(svg);
  const root = el("g"); svg.appendChild(root);

  // --- Lag: avstamningslinjer (skjelett), stjerner, tråder, artister ---------
  const lineageG = el("g"); root.appendChild(lineageG);
  const threadG = el("g"); root.appendChild(threadG);
  const starG = el("g"); root.appendChild(starG);
  const artistG = el("g"); root.appendChild(artistG);

  const nodeById = new Map([...genres, ...roots].map((n) => [n.id, n]));
  // Avstamning: forelder→node som svak heltrukken; motreaksjon (rx) svak stiplet.
  for (const n of [...genres, ...roots]) {
    for (const pid of n.parents) {
      const p = nodeById.get(pid); if (!p) continue;
      lineageG.appendChild(el("line", { x1: p.x, y1: p.y, x2: n.x, y2: n.y,
        stroke: "var(--line-strong,#ccddd2)", "stroke-width": 1.4, "stroke-opacity": 0.55 }));
    }
    for (const rid of n.reactions) {
      const p = nodeById.get(rid); if (!p) continue;
      lineageG.appendChild(el("line", { x1: p.x, y1: p.y, x2: n.x, y2: n.y,
        stroke: "#d97706", "stroke-width": 1.2, "stroke-opacity": 0.4, "stroke-dasharray": "5 5" }));
    }
  }

  // Røtter: små, nøytrale «opphavs»-stjerner (ingen artister, ikke fokuserbare).
  for (const n of roots) {
    const g = el("g", { class: "sh-root" });
    g.appendChild(el("circle", { cx: n.x, cy: n.y, r: 6, fill: "var(--muted-2,#7d9885)", "fill-opacity": 0.5 }));
    const t = el("text", { class: "sh-rootlbl", x: n.x, y: n.y - 12, "text-anchor": "middle" });
    t.textContent = n.label; g.appendChild(t);
    starG.appendChild(g);
  }

  // Sjangerstjerner + (skjulte) artist-stjernebilder.
  const starEls = new Map();     // id → { circle, halo, group(artistG-child), members:[{dot,label,x,y,others}] }
  for (const n of genres) {
    const members = n.artists
      .slice()
      .sort((a, b) => (a.artist.name || "").localeCompare(b.artist.name || "", "no"));

    // Skjult artist-gruppe for denne sjangeren.
    const ag = el("g", { class: "sh-artgroup", "data-genre": n.id }); ag.style.display = "none";
    const memberEls = members.map((m, i) => {
      const { dx, dy } = fanOffset(i, members.length);
      const x = n.x + dx, y = n.y + dy;
      const isBridge = m.others.length > 0;
      const dot = el("circle", { cx: x, cy: y, r: isBridge ? 6.5 : 5,
        fill: isBridge ? famColor(n.fam) : famColor(n.fam),
        stroke: isBridge ? "var(--text,#101a13)" : "#fff", "stroke-width": isBridge ? 1.6 : 1,
        class: "sh-artdot", "data-name": m.artist.name || "" });
      dot.style.cursor = "pointer";
      dot.addEventListener("click", (e) => { e.stopPropagation(); onArtistClick?.(m.artist); });
      const anchor = dx >= 0 ? "start" : "end";
      const lbl = el("text", { class: "sh-artlbl", x: x + (dx >= 0 ? 8 : -8), y: y + 3.5, "text-anchor": anchor });
      lbl.textContent = m.artist.name || "(uten navn)";
      const title = el("title"); title.textContent = `${m.artist.name}${isBridge ? " · også " + m.others.map((o) => o.label).join(", ") : ""}`;
      dot.appendChild(title);
      ag.append(dot, lbl);
      return { x, y, others: m.others, isBridge };
    });
    artistG.appendChild(ag);

    // Selve stjernen.
    const sg = el("g", { class: "sh-star", "data-genre": n.id }); sg.style.cursor = "pointer";
    const halo = el("circle", { cx: n.x, cy: n.y, r: starR(n.artists.length) + 7, class: "sh-halo",
      fill: famColor(n.fam), "fill-opacity": 0 });
    const circle = el("circle", { cx: n.x, cy: n.y, r: starR(n.artists.length), fill: famColor(n.fam), "fill-opacity": 0.9 });
    const lbl = el("text", { class: "sh-starlbl", x: n.x, y: n.y + starR(n.artists.length) + 20, "text-anchor": "middle" });
    lbl.textContent = n.label;
    sg.append(halo, circle, lbl);
    starG.appendChild(sg);
    starEls.set(n.id, { node: n, sg, circle, halo, ag, members: memberEls });
  }

  // ---- Zoom-tilstand (delt av fokus-zoom og manuell pan/zoom nedenfor) ------
  let k = 1, tx = 0, ty = 0, animTimer = 0;
  const apply = () => root.setAttribute("transform", `translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${k.toFixed(3)})`);
  const animateTo = (nk, ntx, nty) => {
    root.style.transition = "transform .32s ease";
    k = nk; tx = ntx; ty = nty; apply();
    clearTimeout(animTimer); animTimer = setTimeout(() => { root.style.transition = ""; }, 360);
  };
  const stopAnim = () => { root.style.transition = ""; };
  // Zoom inn på én sjangers stjernebilde så navnene blir lesbare.
  const fitToFocus = (s) => {
    let x0 = s.node.x, y0 = s.node.y, x1 = s.node.x, y1 = s.node.y;
    for (const m of s.members) { x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x); y1 = Math.max(y1, m.y); }
    x0 -= 180; x1 += 180; y0 -= 70; y1 += 70;   // rom til navnene
    const bw = x1 - x0, bh = y1 - y0, cxb = (x0 + x1) / 2, cyb = (y0 + y1) / 2;
    const nk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(VBW / bw, VBH / bh)));
    animateTo(nk, VBW / 2 - cxb * nk, VBH / 2 - cyb * nk);
  };

  // --- Fokus: lys opp én sjanger, vis artistene, tegn broer til andre --------
  const focusPanel = container.querySelector("#sh-focus-panel");
  let focusedId = null, locked = false, didAutoZoom = false;
  const activeFams = new Set(famsPresent);
  let showAllBridges = false;

  function clearThreads() { while (threadG.firstChild) threadG.removeChild(threadG.firstChild); }

  function drawAllBridges() {
    clearThreads();
    if (!showAllBridges) return;
    for (const { node, members } of starEls.values()) {
      if (!activeFams.has(node.fam)) continue;
      for (const m of members) {
        if (!m.isBridge) continue;
        for (const o of m.others) {
          if (!activeFams.has(o.fam)) continue;
          threadG.appendChild(el("line", { x1: m.x, y1: m.y, x2: o.x, y2: o.y,
            stroke: famColor(o.fam), "stroke-width": 1, "stroke-opacity": 0.16 }));
        }
      }
    }
  }

  function setFocus(id, lock) {
    if (focusedId && focusedId !== id) starEls.get(focusedId)?.ag && (starEls.get(focusedId).ag.style.display = "none");
    focusedId = id; locked = lock;
    // Nullstill uthevede stjerner
    for (const s of starEls.values()) { s.sg.classList.remove("sh-hot", "sh-linked"); s.halo.setAttribute("fill-opacity", 0); }
    clearThreads();
    drawAllBridges();

    const s = starEls.get(id);
    if (!s) { focusPanel.hidden = true; return; }
    s.ag.style.display = "";
    // Navn vises først når man låser (klikk/tap → zoom inn); hover er en rask
    // forhåndsvisning med prikker + broer, uten navnestabling på oversiktszoom.
    s.ag.classList.toggle("sh-locked", lock);
    s.sg.classList.add("sh-hot");
    s.halo.setAttribute("fill-opacity", 0.1);

    // Broer fra denne sjangeren → andre stjerner lyser opp.
    const linked = new Set();
    for (const m of s.members) {
      if (!m.isBridge) continue;
      for (const o of m.others) {
        linked.add(o.id);
        threadG.appendChild(el("line", { x1: m.x, y1: m.y, x2: o.x, y2: o.y,
          stroke: famColor(o.fam), "stroke-width": 1.6, "stroke-opacity": 0.7, class: "sh-thread" }));
      }
    }
    for (const oid of linked) starEls.get(oid)?.sg.classList.add("sh-linked");

    // Mini-panel: navn + antall + «les om sjangeren».
    const bridges = s.members.filter((m) => m.isBridge).length;
    focusPanel.hidden = false;
    focusPanel.innerHTML =
      `<span class="sh-fp-dot" style="background:${famColor(s.node.fam)}"></span>` +
      `<strong>${escapeHtml(s.node.label)}</strong> <span class="sh-fp-meta">${s.members.length} artist${s.members.length === 1 ? "" : "er"}${bridges ? ` · ${bridges} bro` : ""}</span>` +
      `<button type="button" class="sh-linkbtn" id="sh-fp-open">les om sjangeren →</button>` +
      (locked ? `<button type="button" class="sh-linkbtn" id="sh-fp-close">lukk ✕</button>` : "");
    focusPanel.querySelector("#sh-fp-open")?.addEventListener("click", (e) => { e.stopPropagation(); onGenreClick?.(s.node.label); });
    focusPanel.querySelector("#sh-fp-close")?.addEventListener("click", (e) => { e.stopPropagation(); clearFocus(); });

    // Klikk/tap zoomer inn på stjernebildet; hover er bare en rask forhåndsvisning.
    if (lock) { fitToFocus(s); didAutoZoom = true; }
  }

  function clearFocus() {
    if (focusedId) starEls.get(focusedId)?.ag && (starEls.get(focusedId).ag.style.display = "none");
    focusedId = null; locked = false;
    for (const s of starEls.values()) { s.sg.classList.remove("sh-hot", "sh-linked"); s.halo.setAttribute("fill-opacity", 0); }
    focusPanel.hidden = true;
    drawAllBridges();
    if (didAutoZoom) { animateTo(1, 0, 0); didAutoZoom = false; }
  }

  // Hover (desktop) previews; klikk/tap låser (fungerer på mobil).
  for (const s of starEls.values()) {
    s.sg.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch" && !locked) setFocus(s.node.id, false); });
    s.sg.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch" && !locked) clearFocus(); });
    s.sg.addEventListener("click", (e) => {
      e.stopPropagation();
      if (locked && focusedId === s.node.id) clearFocus();
      else setFocus(s.node.id, true);
    });
  }

  // ---- Zoom og panorering (hjul, dra, knip, knapper) ------------------------
  const toView = (e) => {
    const r = svg.getBoundingClientRect();
    // meet-skalering: passer høyden når container er bredere enn viewBox-forhold.
    const scale = Math.min(r.width / VBW, r.height / VBH);
    const offX = (r.width - VBW * scale) / 2, offY = (r.height - VBH * scale) / 2;
    return { x: (e.clientX - r.left - offX) / scale, y: (e.clientY - r.top - offY) / scale };
  };
  const zoomAt = (px, py, factor) => {
    stopAnim();
    const k2 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k * factor));
    tx = px - ((px - tx) / k) * k2; ty = py - ((py - ty) / k) * k2; k = k2; apply();
  };
  const onWheel = (e) => { e.preventDefault(); const p = toView(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0016)); };
  svg.addEventListener("wheel", onWheel, { passive: false });

  const pointers = new Map(); let pinch = 0, panMoved = false;
  svg.addEventListener("pointerdown", (e) => { stopAnim(); svg.setPointerCapture(e.pointerId); pointers.set(e.pointerId, toView(e)); panMoved = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(b.x - a.x, b.y - a.y); } });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId), p = toView(e); pointers.set(e.pointerId, p);
    if (pointers.size === 1) { const dx = p.x - prev.x, dy = p.y - prev.y; if (Math.abs(dx) + Math.abs(dy) > 1) panMoved = true; tx += dx * k; ty += dy * k; apply(); }
    else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(b.x - a.x, b.y - a.y); if (pinch > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch); pinch = d; }
  });
  const endPtr = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  svg.addEventListener("pointerup", endPtr); svg.addEventListener("pointercancel", endPtr);
  // Klikk på tom himmel (uten å ha panorert) lukker fokus.
  svg.addEventListener("click", (e) => { if (!panMoved && e.target === svg || e.target === root) clearFocus(); });

  container.querySelector("#sh-zoom-in").addEventListener("click", () => zoomAt(VBW / 2, VBH / 2, 1.4));
  container.querySelector("#sh-zoom-out").addEventListener("click", () => zoomAt(VBW / 2, VBH / 2, 1 / 1.4));
  container.querySelector("#sh-zoom-reset").addEventListener("click", () => { k = 1; tx = 0; ty = 0; apply(); });

  // ---- Familie-chips + «vis alle broer» -------------------------------------
  function updateFamVis() {
    for (const s of starEls.values()) {
      const on = activeFams.has(s.node.fam);
      s.sg.setAttribute("opacity", on ? 1 : 0.12);
      s.ag.setAttribute("opacity", on ? 1 : 0.12);
    }
    drawAllBridges();
    if (focusedId) setFocus(focusedId, locked);
  }
  const chipBox = container.querySelector("#sh-chips");
  for (const f of famsPresent) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sh-chip";
    b.innerHTML = `<span class="sh-chip-dot" style="background:${famColor(f)}"></span>${escapeHtml(FAMILIES[f]?.label || f)}`;
    b.addEventListener("click", () => { activeFams.has(f) ? activeFams.delete(f) : activeFams.add(f); b.classList.toggle("off"); updateFamVis(); });
    chipBox.appendChild(b);
  }
  container.querySelector("#sh-bro").addEventListener("change", (e) => { showAllBridges = e.target.checked; drawAllBridges(); });

  // Løse artister (kun metaGenre): enkel navneliste i fokus-panelet.
  container.querySelector("#sh-loose")?.addEventListener("click", () => {
    focusPanel.hidden = false; locked = true; focusedId = null; clearThreads();
    const names = loose.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "no"));
    focusPanel.innerHTML = `<strong>Uten tre-sjanger (${names.length})</strong> <span class="sh-fp-meta">kun hovedsjanger satt</span>` +
      `<button type="button" class="sh-linkbtn" id="sh-fp-close">lukk ✕</button>` +
      `<div class="sh-loose-list">` + names.map((a, i) => `<button type="button" class="sh-linkbtn sh-loose-item" data-i="${i}">${escapeHtml(a.name || "(uten navn)")}</button>`).join("") + `</div>`;
    focusPanel.querySelector("#sh-fp-close").addEventListener("click", clearFocus);
    focusPanel.querySelectorAll(".sh-loose-item").forEach((btn) => btn.addEventListener("click", () => onArtistClick?.(names[+btn.dataset.i])));
  });

  apply();
  teardown.set(container, () => {
    svg.removeEventListener("wheel", onWheel);
  });
}
