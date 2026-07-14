// ============================================================================
//  SJANGERHIMMELEN — stjernekart i slektstreets rekkefølge.
//
//  Samme oppsett som sjangertreet (js/genealogy.js): tid nedover, familier
//  bortover. Vi LESER bare GENEALOGY (cx/rad/foreldre) — treet self (tre.html)
//  røres ikke. Hver sjanger er en «stjerne» plassert der noden står i treet, med
//  svake avstamningslinjer som tegner skjelettet.
//
//  I ro vises BARE sjangerstjernene (rolig, lesbart). Når du klikker (eller
//  trykker på mobil) en stjerne, spretter sjangerens artister frem som et
//  stjernebilde: tråder går fra stjernen ut til HVER artist — bare til denne
//  stjernen, også for bro-artister som hører til flere (ellers ble det en floke
//  på tvers). Du ser aldri mer enn én sjangers navn om gangen (~42 mot 257).
//  Alle kryssforbindelser mellom sjangre finnes via «Vis alle broer»-bryteren.
//
//  Fargene følger slektstreets familier (FAMILIES/node.fam). Egen liten
//  layout — ingen avhengigheter. Zoom/pan for detaljer.
// ============================================================================
import { GENEALOGY, GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, MAIN_GENRE_INFO, FAMILIES } from "./genealogy.js?v=3.49";
import { escapeHtml } from "./ui-helpers.js?v=3.49";
import { safeUrl, wikimediaThumb } from "./util.js?v=3.49";

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

// Artistbildet (samme URL som artistkortet bruker) OVER navnet ved hover.
// Bygges først idet musen er der: å laste 250+ bilder på forhånd ville kostet
// mye båndbredde for noe som vises ett om gangen. Artister uten bilde får som
// før bare navnet.
//
// Bildet beskjæres IKKE: ruta får bildets egne proporsjoner (liggende bilder
// blir liggende, stående blir stående), med THUMB_MAX som lengste side. SVG-ens
// <image> har ingen naturalWidth, så målene leses fra et vanlig Image-objekt på
// samme URL — nettleseren gjenbruker den samme forespørselen, så det koster
// ingen ekstra nedlasting. Ruta vises først når målene er kjent (opacity), så
// den aldri blinker innom feil format.
const THUMB_MAX = 88;
let thumbSeq = 0;
function artistThumb(artist, x, y) {
  const url = safeUrl(artist.imageUrl);
  if (!url) return null;

  const g = el("g", { class: "sh-thumb" });
  g.style.opacity = "0";
  const clipId = `sh-thumb-clip-${++thumbSeq}`;
  const clip = el("clipPath", { id: clipId });
  const clipRect = el("rect", { rx: 8 });
  clip.appendChild(clipRect);
  const img = el("image", {
    preserveAspectRatio: "xMidYMid meet",   // hele bildet, ingen beskjæring
    "clip-path": `url(#${clipId})`,
  });
  const frame = el("rect", { rx: 8, fill: "none", stroke: "#fff", "stroke-width": 2 });
  g.append(clip, img, frame);

  // Plasser ruta når vi kjenner bildets format: sentrert over prikken, med
  // underkanten klar av navnet.
  const place = (w, h) => {
    const box = { x: x - w / 2, y: y - h - 16, width: w, height: h };
    for (const [k, v] of Object.entries(box)) {
      img.setAttribute(k, v);
      clipRect.setAttribute(k, v);
      frame.setAttribute(k, v);
    }
    g.style.opacity = "1";
  };

  const probe = new Image();
  probe.addEventListener("load", () => {
    const ratio = (probe.naturalWidth / probe.naturalHeight) || 1;
    const w = ratio >= 1 ? THUMB_MAX : Math.round(THUMB_MAX * ratio);
    const h = ratio >= 1 ? Math.round(THUMB_MAX / ratio) : THUMB_MAX;
    img.setAttribute("href", probe.src);
    place(w, h);
  });
  // Samme fallback som <img>-veien (se ui-helpers.js): svarer Wikimedia med feil
  // på thumbnailen, prøv originalen ÉN gang. Feiler den også, dropper vi ruta i
  // stedet for å la nettleserens «bilde mangler»-ikon stå.
  probe.addEventListener("error", () => {
    if (probe.src !== url) probe.src = url;
    else g.remove();
  });
  probe.src = wikimediaThumb(url, 160) || url;

  return g;
}

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
      <label class="sh-bro-toggle"><input type="checkbox" id="sh-bro"> Alle broer (${bridgeCount})</label>
      <span class="sh-counts">${genres.length} sjangre · klikk en stjerne for artistene${loose.length ? ` · <button type="button" id="sh-loose" class="sh-linkbtn">${loose.length} uten tre-sjanger</button>` : ""}</span>
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
      <span><span class="sh-lg-bridge"></span>artist i flere sjangre</span>
      <span>klikk en stjerne · hold over en prikk for navn</span>
    </div>`;

  const svg = el("svg", { id: "sh-svg", viewBox: `0 0 ${VBW} ${VBH}`,
    preserveAspectRatio: "xMidYMid meet", role: "img",
    "aria-label": "Stjernekart over sjangrene i slektstreets rekkefølge; hold over en sjanger for artistene" });
  svg.style.width = "100%"; svg.style.display = "block";
  container.querySelector("#sh-svg-wrap").prepend(svg);
  const root = el("g"); svg.appendChild(root);

  // --- Lag: avstamningslinjer (skjelett), stjerner, tråder, artister ---------
  const lineageG = el("g", { class: "sh-lineage" }); root.appendChild(lineageG);
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
      const baseR = isBridge ? 6.5 : 5;
      const dot = el("circle", { cx: x, cy: y, r: baseR, fill: famColor(n.fam),
        stroke: isBridge ? "var(--text,#101a13)" : "#fff", "stroke-width": isBridge ? 1.6 : 1,
        class: "sh-artdot", "data-name": m.artist.name || "" });
      dot.style.cursor = "pointer";
      const anchor = dx >= 0 ? "start" : "end";
      const lbl = el("text", { class: "sh-artlbl", x: x + (dx >= 0 ? 9 : -9), y: y + 3.5, "text-anchor": anchor });
      lbl.textContent = m.artist.name || "(uten navn)";
      const title = el("title"); title.textContent = `${m.artist.name}${isBridge ? " · også " + m.others.map((o) => o.label).join(", ") : ""}`;
      dot.appendChild(title);
      // Hold musen over en prikk → navnet OG artistbildet (og prikken forstørres
      // og løftes fram). Berøring hopper over dette (mobil viser alle navn ved
      // fokus, se setFocus).
      let thumb = null;
      dot.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch") return;
        lbl.classList.add("sh-show"); dot.setAttribute("r", baseR + 2.5); ag.appendChild(lbl);
        thumb = artistThumb(m.artist, x, y);
        if (thumb) ag.appendChild(thumb);
      });
      dot.addEventListener("pointerleave", () => {
        lbl.classList.remove("sh-show"); dot.setAttribute("r", baseR);
        thumb?.remove(); thumb = null;
      });
      dot.addEventListener("click", (e) => { e.stopPropagation(); onArtistClick?.(m.artist); });
      ag.append(dot, lbl);
      return { x, y, others: m.others, isBridge, dot, lbl };
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
  let k = 1, tx = 0, ty = 0, animTimer = 0, lastPointerType = "mouse";
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
  let focusedId = null, didAutoZoom = false;
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

  function setFocus(id) {
    if (focusedId && focusedId !== id) starEls.get(focusedId)?.ag && (starEls.get(focusedId).ag.style.display = "none");
    focusedId = id;
    // Nullstill uthevede stjerner
    for (const s of starEls.values()) { s.sg.classList.remove("sh-hot", "sh-linked"); s.halo.setAttribute("fill-opacity", 0); }
    clearThreads();
    drawAllBridges();

    const s = starEls.get(id);
    if (!s) { svg.classList.remove("sh-focusmode"); focusPanel.hidden = true; return; }
    // Fokusmodus: CSS gråner alle ANDRE stjerner (+ røtter/skjelett), så
    // artist-prikkene som spretter frem skiller seg tydelig fra stjernene.
    svg.classList.add("sh-focusmode");
    s.ag.style.display = "";
    // Klikk åpner sjangeren og den BLIR stående (ikke hover — da forsvant den
    // idet man beveget musen mot en artist). På desktop vises prikkene, og navn
    // kommer når man holder over en prikk. Berøring har ingen hover, så da vises
    // alle navn med én gang (sh-locked).
    s.ag.classList.toggle("sh-locked", lastPointerType === "touch");
    s.sg.classList.add("sh-hot");
    s.halo.setAttribute("fill-opacity", 0.1);

    // Tråder fra DENNE stjernen ut til HVER av artistene sine — sjangerens eget
    // stjernebilde. Bro-artister (flere mainGenre) knyttes også bare til denne
    // stjernen her, ikke til de andre sjangrene sine (det ville laget en floke
    // på tvers). Alle kryssforbindelser finnes fortsatt via «Vis alle broer».
    for (const m of s.members) {
      threadG.appendChild(el("line", { x1: s.node.x, y1: s.node.y, x2: m.x, y2: m.y,
        stroke: famColor(s.node.fam), "stroke-width": 1.1, "stroke-opacity": 0.45, class: "sh-thread" }));
    }

    // Mini-panel: navn + antall + «les om sjangeren».
    const bridges = s.members.filter((m) => m.isBridge).length;
    focusPanel.hidden = false;
    focusPanel.innerHTML =
      `<span class="sh-fp-dot" style="background:${famColor(s.node.fam)}"></span>` +
      `<strong>${escapeHtml(s.node.label)}</strong> <span class="sh-fp-meta">${s.members.length} artist${s.members.length === 1 ? "" : "er"}${bridges ? ` · ${bridges} bro` : ""}${lastPointerType === "touch" ? "" : " · hold over en prikk for navn"}</span>` +
      `<button type="button" class="sh-linkbtn" id="sh-fp-open">les om sjangeren</button>` +
      `<button type="button" class="sh-linkbtn" id="sh-fp-close">lukk ✕</button>`;
    focusPanel.querySelector("#sh-fp-open")?.addEventListener("click", (e) => { e.stopPropagation(); onGenreClick?.(s.node.label); });
    focusPanel.querySelector("#sh-fp-close")?.addEventListener("click", (e) => { e.stopPropagation(); clearFocus(); });

    fitToFocus(s); didAutoZoom = true;
  }

  function clearFocus() {
    if (focusedId) starEls.get(focusedId)?.ag && (starEls.get(focusedId).ag.style.display = "none");
    focusedId = null;
    svg.classList.remove("sh-focusmode");
    for (const s of starEls.values()) { s.sg.classList.remove("sh-hot", "sh-linked"); s.halo.setAttribute("fill-opacity", 0); }
    focusPanel.hidden = true;
    drawAllBridges();
    if (didAutoZoom) { animateTo(1, 0, 0); didAutoZoom = false; }
  }

  // Klikk/tap på en stjerne åpner (og BEHOLDER) sjangeren; klikk igjen lukker.
  for (const s of starEls.values()) {
    s.sg.addEventListener("click", (e) => {
      e.stopPropagation();
      if (focusedId === s.node.id) clearFocus();
      else setFocus(s.node.id);
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

  // VIKTIG: IKKE fang pekeren på pointerdown — det svelger `click` på stjernene
  // (særlig Safari/Mac), så «ingenting skjer». Vi fanger den først når en ekte
  // dra-bevegelse starter (over terskel), slik at vanlige klikk går rett gjennom.
  const pointers = new Map(); let pinch = 0, panMoved = false, captured = false;
  svg.addEventListener("pointerdown", (e) => {
    lastPointerType = e.pointerType || "mouse"; stopAnim();
    pointers.set(e.pointerId, toView(e)); panMoved = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(b.x - a.x, b.y - a.y); }
  });
  const grab = (id) => { if (!captured) { try { svg.setPointerCapture(id); } catch {} captured = true; } };
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId), p = toView(e);
    if (pointers.size === 1) {
      if (!panMoved) {
        if (Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) < 4) return;   // fortsatt et «klikk»
        panMoved = true; grab(e.pointerId);
      }
      tx += p.x - prev.x; ty += p.y - prev.y; apply();          // dra i viewBox-enheter (ikke ·k)
      pointers.set(e.pointerId, p);
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, p); panMoved = true; grab(e.pointerId);
      const [a, b] = [...pointers.values()]; const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (pinch > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch); pinch = d;
    }
  });
  const endPtr = (e) => { pointers.delete(e.pointerId); pinch = 0; if (!pointers.size) captured = false; };
  svg.addEventListener("pointerup", endPtr); svg.addEventListener("pointercancel", endPtr);
  // Klikk på tom himmel (uten å ha panorert) lukker fokus.
  svg.addEventListener("click", (e) => { if (!panMoved && (e.target === svg || e.target === root)) clearFocus(); });

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
    if (focusedId) setFocus(focusedId);
  }
  // Familie-chips med tredelt veksling PER chip:
  //   1. trykk → vis KUN denne familien (de andre dempes)
  //   2. trykk → skjul denne familien (de andre vises)
  //   3. trykk → tilbake til standard (alle vises)
  // Å trykke en annen chip starter dens egen syklus på trinn 1.
  const chipBox = container.querySelector("#sh-chips");
  const chipEls = new Map();
  let filterMode = "default", filterFam = null;   // "default" | "solo" | "hide"
  function applyFilter() {
    activeFams.clear();
    if (filterMode === "solo") activeFams.add(filterFam);
    else if (filterMode === "hide") { for (const f of famsPresent) if (f !== filterFam) activeFams.add(f); }
    else for (const f of famsPresent) activeFams.add(f);
    for (const [f, b] of chipEls) {
      b.classList.toggle("solo", filterMode === "solo" && f === filterFam);
      b.classList.toggle("off", (filterMode === "solo" && f !== filterFam) || (filterMode === "hide" && f === filterFam));
    }
    updateFamVis();
  }
  for (const f of famsPresent) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sh-chip";
    b.title = "Klikk: vis kun denne → skjul denne → vis alle";
    b.innerHTML = `<span class="sh-chip-dot" style="background:${famColor(f)}"></span>${escapeHtml(FAMILIES[f]?.label || f)}`;
    b.addEventListener("click", () => {
      if (filterFam !== f || filterMode === "default") { filterMode = "solo"; filterFam = f; }
      else if (filterMode === "solo") filterMode = "hide";     // filterFam blir stående
      else { filterMode = "default"; filterFam = null; }        // hide → standard
      applyFilter();
    });
    chipEls.set(f, b);
    chipBox.appendChild(b);
  }
  container.querySelector("#sh-bro").addEventListener("change", (e) => { showAllBridges = e.target.checked; drawAllBridges(); });

  // Løse artister (kun metaGenre): enkel navneliste i fokus-panelet.
  container.querySelector("#sh-loose")?.addEventListener("click", () => {
    clearFocus();   // rydder evt. åpen stjerne (tråder, gråtone, zoom)
    focusPanel.hidden = false;
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
