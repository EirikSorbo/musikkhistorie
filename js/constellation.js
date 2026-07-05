// ============================================================================
//  SJANGERHIMMELEN — konstellasjonskart over artister og sjangre.
//
//  Hver tre-sjanger (mainGenre med g≠null i GENEALOGY) er en «stjerne» hvis
//  størrelse viser antall artister; artistene er satellitter rundt. Poenget
//  med kartet er bro-artistene: de med flere mainGenre spennes fysisk ut
//  mellom stjernene sine og binder klyngene sammen — noe verken tidslinjen,
//  varmekartet eller slektstreet viser.
//
//  Artister UTEN tre-sjanger (kun metaGenre, f.eks. croonerne og europeisk
//  jazz) utelates ikke: de tegnes som hule ringer løst knyttet til familien
//  sin, så hullene i sjangertaggingen er synlige i stedet for stille borte.
//
//  Fargene og grupperingen (familie/anker) kommer fra slektstreet
//  (MAIN_GENRE_INFO/FAMILIES), så kartet snakker samme visuelle språk som
//  varmekartet og tidslinjen. Layouten er en liten egen kraftsimulering
//  (fjær + frastøting) — ingen avhengigheter, animert med rAF til den roer
//  seg. Zoom styrer navnevisning: stjernenavn alltid, bro-artister fra
//  ZOOM_MID, alle navn fra ZOOM_FAR (CSS-klasser sh-zmid/sh-zfar).
// ============================================================================
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, MAIN_GENRE_INFO, FAMILIES } from "./genealogy.js?v=2.88";
import { escapeHtml } from "./ui-helpers.js?v=2.88";

const W = 900, H = 470, SVGNS = "http://www.w3.org/2000/svg";
const ZOOM_MIN = 0.7, ZOOM_MAX = 5, ZOOM_MID = 1.5, ZOOM_FAR = 2.6;

// Kanoniser tagger til treets stavemåte (samme mønster som tidslinjen).
const canonMain = new Map(GENEALOGY_MAIN_GENRES.map((g) => [g.toLowerCase(), g]));
const canonMeta = new Map(GENEALOGY_META_GENRES.map((g) => [g.toLowerCase(), g]));

// Representativ familie per metaGenre (hyppigste blant metaens tre-sjangre) —
// brukes til å plassere artister som bare har metaGenre.
const META_FAM = (() => {
  const tally = new Map();
  for (const info of Object.values(MAIN_GENRE_INFO)) {
    if (!tally.has(info.meta)) tally.set(info.meta, {});
    tally.get(info.meta)[info.fam] = (tally.get(info.meta)[info.fam] || 0) + 1;
  }
  const out = {};
  for (const [meta, fams] of tally) {
    out[meta] = Object.entries(fams).sort((a, b) => b[1] - a[1])[0][0];
  }
  return out;
})();

const famColor = (fam) => FAMILIES[fam]?.stroke || FAMILIES.gray.stroke;
const hubR = (count) => 7 + Math.sqrt(count) * 1.9;

// ----------------------------------------------------------------------------
//  Graf: anker per familie (usynlig, fast), stjerne per sjanger med artister,
//  node per artist. Lenker: artist→stjerne (én per sjanger — broene får
//  flere), stjerne→anker, og artist-uten-sjanger→anker (løs, stiplet).
// ----------------------------------------------------------------------------
function buildGraph(artists) {
  const hubArtists = new Map();
  const artistNodes = [];
  for (const a of artists) {
    const genres = [...new Set((a.mainGenre || [])
      .map((g) => canonMain.get(String(g).toLowerCase()))
      .filter(Boolean))];
    let fam;
    if (genres.length) {
      fam = MAIN_GENRE_INFO[genres[0]]?.fam || "gray";
      for (const g of genres) {
        if (!hubArtists.has(g)) hubArtists.set(g, []);
        hubArtists.get(g).push(a);
      }
    } else {
      const metaRaw = Array.isArray(a.metaGenre) ? a.metaGenre[0] : a.metaGenre;
      const meta = metaRaw ? canonMeta.get(String(metaRaw).toLowerCase()) : null;
      fam = META_FAM[meta] || "gray";
    }
    artistNodes.push({
      type: "artist", artist: a, name: a.name || "(uten navn)",
      genres, fam, bridge: genres.length > 1, loose: !genres.length,
      x: 0, y: 0, vx: 0, vy: 0,
    });
  }

  const hubNodes = [...hubArtists.entries()].map(([genre, list]) => ({
    type: "hub", genre, count: list.length,
    fam: MAIN_GENRE_INFO[genre]?.fam || "gray",
    x: 0, y: 0, vx: 0, vy: 0,
  }));

  const famCount = {};
  for (const n of artistNodes) famCount[n.fam] = (famCount[n.fam] || 0) + 1;
  const famsPresent = Object.keys(FAMILIES).filter(
    (f) => famCount[f] || hubNodes.some((h) => h.fam === f)
  );

  // Deterministisk stjerneplassering: en stabil ring der hver familie får sin
  // egen bue (bredde ∝ antall sjangre i familien) og stjernene innen familien
  // fordeles jevnt langs buen, sortert etter størrelse. Stjernene PINNES (fx/fy)
  // — bare artistene simuleres rundt dem. Det fjerner både at knutepunkter
  // slynges ut i hjørnene og at kartet ser helt ulikt ut hver gang det åpnes,
  // slik de andre visningene (tidslinje, tre, varmekart) også er forutsigbare.
  // Rekkefølgen følger FAMILIES → samme orden som fargeforklaringen.
  const hubsByFam = {};
  for (const f of famsPresent) hubsByFam[f] = [];
  for (const h of hubNodes) hubsByFam[h.fam].push(h);
  for (const f of famsPresent) {
    hubsByFam[f].sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre, "no"));
  }
  const famWeight = (f) => Math.max(hubsByFam[f].length, 1);   // ≥1 så rene løs-familier også får plass
  const totalWeight = famsPresent.reduce((s, f) => s + famWeight(f), 0) || 1;

  const cx = W / 2, cy = H / 2, RX = W * 0.40, RY = H * 0.39;
  const famCentroid = {};
  let angle = -Math.PI / 2;   // start øverst
  for (const f of famsPresent) {
    const span = (famWeight(f) / totalWeight) * 2 * Math.PI;
    const hubs = hubsByFam[f];
    const pad = Math.min(span * 0.18, 0.14);   // liten luft mot nabofamiliene
    const a0 = angle + pad, a1 = angle + span - pad;
    hubs.forEach((h, i) => {
      const t = hubs.length === 1 ? 0.5 : i / (hubs.length - 1);
      const a = a0 + t * (a1 - a0);
      h.fx = cx + Math.cos(a) * RX;
      h.fy = cy + Math.sin(a) * RY;
      h.x = h.fx; h.y = h.fy; h.fixed = true;
    });
    const mid = angle + span / 2;
    // Familiesentroide litt innenfor ringen — mål for de løse (kun-metaGenre).
    famCentroid[f] = { x: cx + Math.cos(mid) * RX * 0.82, y: cy + Math.sin(mid) * RY * 0.82 };
    angle += span;
  }

  const hubByGenre = new Map(hubNodes.map((h) => [h.genre, h]));

  // Startposisjoner: artistene sås like innenfor hjemme-stjernen sin (mot
  // sentrum), så de faller raskt på plass i stedet for å nøste opp kaos.
  for (const n of artistNodes) {
    const home = n.loose ? famCentroid[n.fam] : hubByGenre.get(n.genres[0]);
    const base = home || { x: cx, y: cy };
    n.x = base.x + (cx - base.x) * 0.15 + (Math.random() - 0.5) * 40;
    n.y = base.y + (cy - base.y) * 0.15 + (Math.random() - 0.5) * 40;
  }

  const links = [];
  for (const n of artistNodes) {
    if (n.loose) { links.push({ a: n, b: famCentroid[n.fam] || { x: cx, y: cy }, len: 34, k: 0.22, kind: "loose" }); continue; }
    // Bro-artister forankres i PRIMÆRsjangeren (første tagg, som også gir
    // familiefargen): den lenken er stiv og kort, mens lenkene til de øvrige
    // sjangrene er svake, lange tråder som viser broen som en korde over kartet
    // uten å dra artisten vekk fra hjemmeklyngen — i stedet for at 42 % av
    // artistene samler seg i én midtfloke.
    n.genres.forEach((g, i) => {
      const primary = i === 0;
      links.push({ a: n, b: hubByGenre.get(g), len: primary ? 30 : 150,
        k: primary ? 0.5 : 0.06, kind: "member", bridge: n.bridge && !primary });
    });
  }

  return { artistNodes, hubNodes, links };
}

// ----------------------------------------------------------------------------
//  Kraftsimulering: bare ARTISTENE beveger seg — stjernene er pinnet (fixed).
//  Fjærlenkene trekker artistene til hjemme-stjernen (og svakt mot bro-stjernen),
//  og en kortrekkende artist-mot-artist-frastøting hindrer at prikkene legger
//  seg oppå hverandre. Ingen krefter på de faste stjernene.
// ----------------------------------------------------------------------------
function simTick(nodes, links, alpha) {
  for (const l of links) {
    const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
    const d = Math.max(Math.hypot(dx, dy), 1);
    const f = ((d - l.len) / d) * l.k * alpha;
    if (!l.a.fixed) { l.a.vx += dx * f; l.a.vy += dy * f; }
    if (l.b.vx !== undefined && !l.b.fixed) { l.b.vx -= dx * f; l.b.vy -= dy * f; }
  }
  for (let i = 0; i < nodes.length; i++) {
    const ni = nodes[i];
    if (ni.fixed) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const nj = nodes[j];
      if (nj.fixed) continue;
      let dx = nj.x - ni.x, dy = nj.y - ni.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d2 = 1; }
      if (d2 > 55 * 55) continue;   // kun lokal anti-overlapp — kortrekkende
      const f = (-15 / d2) * alpha;
      const fx = dx * f, fy = dy * f;
      ni.vx += fx; ni.vy += fy;
      nj.vx -= fx; nj.vy -= fy;
    }
  }
  for (const n of nodes) {
    if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
    n.x = Math.min(W - 16, Math.max(16, n.x + n.vx));
    n.y = Math.min(H - 14, Math.max(14, n.y + n.vy));
    n.vx *= 0.6; n.vy *= 0.6;
  }
}

// Ett rAF-håndtak per container, så en gjenåpning av modalen ikke etterlater
// en gammel simulering som skriver til utbyttede DOM-noder.
const rafHandles = new WeakMap();

const el = (tag, attrs = {}) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};

// ----------------------------------------------------------------------------
//  Hovedinngang: render kontroller + SVG + forklaring inn i `container`.
//  onArtistClick(artist) og onGenreClick(genre) åpnes OPPÅ modalen (z-stack),
//  samme navigasjonsmønster som tidslinjen og kartet.
// ----------------------------------------------------------------------------
export function renderSjangerhimmel(container, artists, { onArtistClick, onGenreClick } = {}) {
  if (rafHandles.has(container)) cancelAnimationFrame(rafHandles.get(container));
  if (!artists.length) {
    container.innerHTML = `<p class="muted">Ingen artister ennå.</p>`;
    return;
  }
  const { artistNodes, hubNodes, links } = buildGraph(artists);
  const nodes = [...hubNodes, ...artistNodes];
  const bridges = artistNodes.filter((n) => n.bridge).length;
  const loose = artistNodes.filter((n) => n.loose).length;

  const famsPresent = Object.keys(FAMILIES).filter((f) => nodes.some((n) => n.fam === f));
  container.innerHTML = `
    <div class="sh-chips" id="sh-chips"></div>
    <div class="sh-toolbar">
      <label class="sh-bro-toggle"><input type="checkbox" id="sh-bro"> Kun bro-artister (${bridges})</label>
      <span class="sh-counts">${artistNodes.length} artister · ${hubNodes.length} sjangre${loose ? ` · ${loose} uten tre-sjanger` : ""}</span>
      <span class="sh-zoom-btns">
        <button type="button" class="btn ghost small" id="sh-zoom-out" aria-label="Zoom ut">−</button>
        <button type="button" class="btn ghost small" id="sh-zoom-in" aria-label="Zoom inn">+</button>
        <button type="button" class="btn ghost small" id="sh-zoom-reset" aria-label="Nullstill zoom">⟲</button>
      </span>
    </div>
    <div id="sh-svg-wrap"></div>
    <div class="sh-legend">
      <span><span class="sh-lg-dot"></span>artist</span>
      <span><span class="sh-lg-dot sh-lg-bridge"></span>flere sjangre (bro)</span>
      <span><span class="sh-lg-dot sh-lg-loose"></span>kun hovedsjanger</span>
      <span>større stjerne = flere artister</span>
    </div>`;

  const svg = el("svg", { id: "sh-svg", viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": "Konstellasjonskart der artister grupperes rundt sjangrene sine" });
  svg.style.width = "100%";
  svg.style.display = "block";
  container.querySelector("#sh-svg-wrap").appendChild(svg);
  const root = el("g");
  svg.appendChild(root);

  // Lenker tegnes under nodene. Fargen følger stjernens familie, så en bro
  // som krysser familier bærer begge fargene sine synlig.
  const linkG = el("g");
  root.appendChild(linkG);
  // Tegn bro-lenkene sist, så de ligger oppå de svake medlemslenkene.
  const drawnLinks = links
    .filter((l) => l.kind !== "spine")
    .sort((a, b) => (a.bridge ? 1 : 0) - (b.bridge ? 1 : 0))
    .map((l) => {
    const line = el("line", { stroke: l.kind === "loose" ? "var(--muted-2,#7d9885)" : famColor(l.b.fam),
      "stroke-width": l.bridge ? 1.5 : 0.8 });
    if (l.kind === "loose") line.setAttribute("stroke-dasharray", "2 4");
    linkG.appendChild(line);
    return { l, line };
  });

  const hubG = el("g");
  root.appendChild(hubG);
  const drawnHubs = hubNodes.map((n) => {
    const g = el("g", { class: "sh-node" });
    const c = el("circle", { r: hubR(n.count).toFixed(1), fill: famColor(n.fam), "fill-opacity": "0.88" });
    const title = el("title");
    title.textContent = `${n.genre} · ${n.count} artist${n.count === 1 ? "" : "er"}`;
    const label = el("text", { class: "sh-hlbl", y: (hubR(n.count) + 12).toFixed(1), "text-anchor": "middle" });
    label.textContent = n.genre;
    g.append(c, title, label);
    g.addEventListener("click", () => onGenreClick?.(n.genre));
    hubG.appendChild(g);
    return { n, g };
  });

  const artG = el("g");
  root.appendChild(artG);
  const drawnArtists = artistNodes.map((n) => {
    const g = el("g", { class: "sh-node" });
    const c = el("circle", {
      r: n.bridge ? 5.5 : 4,
      fill: n.loose ? "var(--bg-soft,#f2f6f3)" : famColor(n.fam),
      stroke: n.loose ? famColor(n.fam) : n.bridge ? "var(--text,#101a13)" : "none",
      "stroke-width": n.loose ? 1.5 : n.bridge ? 1.2 : 0,
    });
    const title = el("title");
    title.textContent = `${n.name} · ${n.loose ? "kun hovedsjanger" : n.genres.join(" + ")}`;
    const label = el("text", { class: `sh-albl${n.bridge ? " sh-br" : ""}`, y: -8, "text-anchor": "middle" });
    label.textContent = n.name;
    g.append(c, title, label);
    g.addEventListener("click", () => onArtistClick?.(n.artist));
    artG.appendChild(g);
    return { n, g };
  });

  function positionAll() {
    for (const { l, line } of drawnLinks) {
      line.setAttribute("x1", l.a.x.toFixed(1)); line.setAttribute("y1", l.a.y.toFixed(1));
      line.setAttribute("x2", l.b.x.toFixed(1)); line.setAttribute("y2", l.b.y.toFixed(1));
    }
    for (const { n, g } of [...drawnHubs, ...drawnArtists]) {
      g.setAttribute("transform", `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
    }
  }

  // Simulér animert til systemet har roet seg (alpha-nedkjøling som d3).
  let alpha = 1;
  const loop = () => {
    for (let i = 0; i < 4 && alpha > 0.02; i++) {
      simTick(nodes, links, alpha);
      alpha *= 0.982;
    }
    positionAll();
    if (alpha > 0.02) rafHandles.set(container, requestAnimationFrame(loop));
    else rafHandles.delete(container);
  };
  loop();

  // ---- Zoom og panorering (hjul, dra, knip og knapper) --------------------
  let k = 1, tx = 0, ty = 0;
  function applyTransform() {
    root.setAttribute("transform", `translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${k.toFixed(3)})`);
    svg.classList.toggle("sh-zmid", k >= ZOOM_MID);
    svg.classList.toggle("sh-zfar", k >= ZOOM_FAR);
  }
  // Skjermpiksler → viewBox-koordinater. SVG-en beholder viewBox-forholdet,
  // så én felles skala (bredde) gjelder begge akser.
  const toView = (e) => {
    const r = svg.getBoundingClientRect();
    const scale = W / r.width;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
  };
  function zoomAt(px, py, factor) {
    const k2 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k * factor));
    tx = px - ((px - tx) / k) * k2;
    ty = py - ((py - ty) / k) * k2;
    k = k2;
    applyTransform();
  }
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = toView(e);
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0018));
  }, { passive: false });

  const pointers = new Map();
  let pinchDist = 0;
  svg.addEventListener("pointerdown", (e) => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, toView(e));
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const p = toView(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      tx += p.x - prev.x; ty += p.y - prev.y;
      applyTransform();
    } else if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (pinchDist > 0) zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, d / pinchDist);
      pinchDist = d;
    }
  });
  const endPointer = (e) => { pointers.delete(e.pointerId); pinchDist = 0; };
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);

  container.querySelector("#sh-zoom-in").addEventListener("click", () => zoomAt(W / 2, H / 2, 1.4));
  container.querySelector("#sh-zoom-out").addEventListener("click", () => zoomAt(W / 2, H / 2, 1 / 1.4));
  container.querySelector("#sh-zoom-reset").addEventListener("click", () => { k = 1; tx = 0; ty = 0; applyTransform(); });

  // ---- Filtre: familie-chips + «kun bro-artister» --------------------------
  const activeFams = new Set(famsPresent);
  let broOnly = false;
  function updateVis() {
    const on = (f) => activeFams.has(f);
    for (const { n, g } of drawnArtists) {
      g.setAttribute("opacity", ((on(n.fam) ? 1 : 0.06) * (broOnly && !n.bridge ? 0.1 : 1)).toFixed(2));
    }
    for (const { n, g } of drawnHubs) g.setAttribute("opacity", on(n.fam) ? "1" : "0.06");
    // Bro-trådene bærer hele poenget, så bare de tegnes tydelig. Primær- og
    // løse lenker holdes nesten usynlige — artistene leses da som prikk-klynger
    // rundt stjernen sin, ikke som et tett spindelvev. Broene ligger oppå.
    for (const { l, line } of drawnLinks) {
      let o = on(l.a.fam) && on(l.b.fam) ? (l.bridge ? 0.6 : l.kind === "loose" ? 0.1 : 0.05) : 0.012;
      if (broOnly && !l.bridge) o = Math.min(o, 0.02);
      line.setAttribute("stroke-opacity", o.toFixed(2));
    }
  }
  updateVis();

  const chipBox = container.querySelector("#sh-chips");
  for (const f of famsPresent) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sh-chip";
    b.innerHTML = `<span class="sh-chip-dot" style="background:${famColor(f)}"></span>${escapeHtml(FAMILIES[f]?.label || f)}`;
    b.addEventListener("click", () => {
      activeFams.has(f) ? activeFams.delete(f) : activeFams.add(f);
      b.classList.toggle("off");
      updateVis();
    });
    chipBox.appendChild(b);
  }
  container.querySelector("#sh-bro").addEventListener("change", (e) => {
    broOnly = e.target.checked;
    updateVis();
  });
}
