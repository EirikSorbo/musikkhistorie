// ============================================================================
//  SLEKTSTRE — BUNDLEDE BÅND
// ----------------------------------------------------------------------------
//  Slektstreets renderer (tre.html) siden v4.58 — en låst designbeslutning.
//  Startet som prototype ved siden av det pakkede kartet; kartet er slettet.
//  Formen er
//  «tangled tree»: nodene er piller på tiårslinjer, og alle foreldrene til én
//  sjanger samles i ETT bånd i BARNETS familiefarge før de går inn i pilla.
//
//  Poenget med fargevalget: en sammensmeltning som R&B (blues + gospel) eller
//  Rock'n'roll (R&B + honky tonk) skal lese som at foreldrene er LIKESTILTE.
//  I det gamle kartet arvet noden én families farge og de øvrige foreldrene ble
//  grå streker; her får hver forelder samme vekt og samme farge inn i barnet,
//  og pilla får tykk kant når den har to eller flere foreldre.
//
//  Datamodellen er urørt: GENEALOGY, foreldre (p), motreaksjoner (rx) og
//  koblingsbeskrivelsene (edgeDescs) er de samme. Kun geometrien og
//  strekspråket er nytt, så visningen kan byttes uten å røre innholdet.
// ============================================================================

import { showSjangerInfo, showEdgeInfo } from "./genealogy.js?v=4.84";
import { SKJUL_I_STUDENTVISNING } from "./feature-flags.js?v=4.84";
import { GENEALOGY, DECADE_ROWS, nodeColor, layoutX } from "./genre-model.js?v=4.84";
import { attachCamera } from "./gx-camera.js?v=4.84";
import { LAYOUT_WIDTH } from "./genre-layout.js?v=4.84";

const SVGNS = "http://www.w3.org/2000/svg";
const W = LAYOUT_WIDTH;    // logisk kartbredde = layoutens (kameraet skalerer til scenen)
const ROW_H = 100;         // avstand mellom tiårslinjene
const TOP = 96;            // y for rad 0
const NH = 44;             // pillehøyde
const PILL_PAD = 13;       // vannrett luft inni pilla, i tillegg til teksten
const GAP = 16;            // minste luft mellom to piller i samme rad
const BUNDLE_LIFT = 26;    // hvor høyt over pilla båndet samles

//  STØRRELSESFORHOLDET (v4.70): sjangernavnene er hovedsaken i kartet, båndene
//  er sammenhengen mellom dem. Etiketten er derfor satt opp (15 → 22 px, se
//  .gxb-label) og pilla med den, mens ROW_H og kartbredden W står stille — da
//  vokser navnene i FORHOLD til strekene uten at kartet blir større.
//  PILL_PAD og GAP er strammet inn for å kjøpe tilbake den vannrette plassen
//  den større skriften spiser: de tetteste radene (11 sjangre i jazz-sonen)
//  må fortsatt få plass innenfor W uten at klemmen på linje ~146 slår inn.
const CORNER = 9;          // hjørneradius i båndene

// Nederste rad i aksen NÅ. DECADE_ROWS er en live binding fra genre-model og
// utvides av seg selv når en node settes på en ny rad (2020-t) — en hardkodet
// liste her stoppet på 2010-t og ville tegnet en ny rad uten linje og etikett,
// delvis utenfor kameraet. Leses ved KALL (aldri modulnivå-konstant).
const maxRow = () => Math.max(DECADE_ROWS.length - 1, 12);

const el = (tag, attrs) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};

// ----------------------------------------------------------------------------
//  Skyv noder i samme rad fra hverandre til ingen piller overlapper. Seeden er
//  nodens cx fra datamodellen, så familiene beholder sin kjente venstre-mot-
//  høyre-plassering; her rettes bare kollisjonene opp.
// ----------------------------------------------------------------------------
function spreadRows(nodes) {
  const rows = new Map();
  nodes.forEach((n) => {
    const key = n._row.toFixed(2);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(n);
  });
  for (const list of rows.values()) {
    list.sort((a, b) => a._x - b._x);
    for (let pass = 0; pass < 60; pass++) {
      let moved = false;
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i], b = list[i + 1];
        const need = a._w / 2 + b._w / 2 + GAP;
        const have = b._x - a._x;
        if (have < need) {
          const push = (need - have) / 2 + 0.5;
          a._x -= push; b._x += push; moved = true;
        }
      }
      if (!moved) break;
    }
  }
}

export function renderGenealogyBundled({ root = document, getOpts }) {
  const stage = root.querySelector("#gx-stage");
  const cam = root.querySelector("#gx-cam");
  if (!stage || !cam) return null;
  cam.innerHTML = "";

  const nodes = GENEALOGY.map((n) => ({ ...n, rx: n.rx || [] }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const parentsOf = (n) => {
    const a = n.p.slice();
    n.rx.forEach((id) => { if (!a.includes(id)) a.push(id); });
    return a;
  };
  const kids = {};
  nodes.forEach((n) => { kids[n.id] = []; });
  nodes.forEach((n) => parentsOf(n).forEach((pid) => { if (kids[pid]) kids[pid].push(n.id); }));
  const anc = (id, seen = {}) => {
    parentsOf(byId[id]).forEach((pid) => { if (!seen[pid]) { seen[pid] = 1; anc(pid, seen); } });
    return seen;
  };

  // Lagene tegnes i denne rekkefølgen: rutenett → bånd → piller. Båndgruppa
  // opprettes FØR nodene, så strekene alltid ligger bak dem uansett når de
  // faktisk fylles (geometrien krever at pillene er målt først).
  const gGrid = el("g", { class: "gxb-grid-layer" });
  const gBands = el("g", { class: "gxb-band-layer" });
  const gNodes = el("g", { class: "gxb-node-layer" });
  cam.appendChild(gGrid);
  cam.appendChild(gBands);
  cam.appendChild(gNodes);

  // Tiårsrutenett — så langt aksen faktisk rekker (DECADE_ROWS utvider seg
  // selv når treet får en node på en ny rad).
  for (let r = 0; r <= maxRow(); r++) {
    const y = TOP + r * ROW_H - 48;
    gGrid.appendChild(el("line", { x1: 0, y1: y, x2: W, y2: y, class: "gx-grid" }));
    const t = el("text", { x: 14, y: y + 20, class: "gx-decade" });
    t.textContent = DECADE_ROWS[r] || "";
    gGrid.appendChild(t);
  }

  // --- Pass 1: bygg pillene og MÅL etikettene. Bredden må være kjent før
  //     layouten kan løse kollisjoner, og getComputedTextLength krever at
  //     teksten står i et synlig dokument.
  const gnodes = {};
  nodes.forEach((n) => {
    const g = el("g", { class: "gxb-node" });
    g.dataset.id = n.id;
    const rect = el("rect", { rx: NH / 2, height: NH, class: "gxb-pill" });
    const text = el("text", { "text-anchor": "middle", "dominant-baseline": "central", class: "gxb-label" });
    text.textContent = n.l;
    g.appendChild(rect);
    g.appendChild(text);
    gNodes.appendChild(g);
    gnodes[n.id] = { g, rect, text };
  });

  // x kommer fra den UTREGNEDE layouten (js/genre-layout.js), ikke fra en
  // håndsatt koordinat. Kollisjonene under løses med MÅLTE etikettbredder, som
  // layout-modulen ikke kan kjenne.
  nodes.forEach((n) => {
    const measured = gnodes[n.id].text.getComputedTextLength?.() || n.l.length * 8;
    n._w = measured + PILL_PAD * 2;
    n._row = n.r + (n.yOffset || 0);
    n._x = layoutX(n.id);   // W === LAYOUT_WIDTH, ingen skalering
    n._y = TOP + n._row * ROW_H;
  });
  spreadRows(nodes);
  nodes.forEach((n) => { n._x = Math.max(90, Math.min(W - 90, n._x)); });

  // --- Pass 2: plasser pillene
  nodes.forEach((n) => {
    const { rect, text } = gnodes[n.id];
    rect.setAttribute("x", n._x - n._w / 2);
    rect.setAttribute("y", n._y - NH / 2);
    rect.setAttribute("width", n._w);
    rect.setAttribute("stroke", nodeColor(n));
    // Samme rammetykkelse på ALLE piller (brukervalg v4.70). Tykkelsen og fet
    // skrift markerte tidligere «to eller flere foreldre», men den opplysningen
    // bæres allerede av det røde knutepunktet der båndene møtes — det står i
    // tegnforklaringen, mens rammetykkelsen aldri gjorde det.
    rect.setAttribute("stroke-width", 3.4);
    text.setAttribute("x", n._x);
    text.setAttribute("y", n._y);
  });

  // --- Pass 3: båndene. Én ledig korridor per lang loddrett strek, så en
  //     kobling som spenner flere tiår ikke skjærer gjennom mellomliggende
  //     piller (det gjør den i praksis ofte: Gospel → Cont. gospel spenner
  //     fire tiår, Nashville → Cont. country tre).
  const boxes = nodes.map((n) => ({ id: n.id, x: n._x, y: n._y, w: n._w }));

  // Treffer et loddrett strekk ved x noen pille mellom yA og yB?
  function vHits(x, yA, yB, skip) {
    return boxes.some((b) => !skip.includes(b.id)
      && Math.abs(b.x - x) < b.w / 2 + 10
      && b.y + NH / 2 + 8 > Math.min(yA, yB)
      && b.y - NH / 2 - 8 < Math.max(yA, yB));
  }
  // Treffer den vannrette båndlinja fra xA til xB ved y noen pille?
  function hHits(xA, xB, y, skip) {
    const lo = Math.min(xA, xB), hi = Math.max(xA, xB);
    return boxes.some((b) => !skip.includes(b.id)
      && Math.abs(b.y - y) < NH / 2 + 7
      && b.x + b.w / 2 + 8 > lo && b.x - b.w / 2 - 8 < hi);
  }
  function clearCorridor(x0, yA, yB, skip) {
    if (!vHits(x0, yA, yB, skip)) return x0;
    for (let d = 10; d <= 160; d += 10) {
      if (!vHits(x0 - d, yA, yB, skip)) return x0 - d;
      if (!vHits(x0 + d, yA, yB, skip)) return x0 + d;
    }
    return x0;   // gir opp: en litt uryddig strek er bedre enn ingen kobling
  }

  const edges = [], edgeHits = [];
  // stubs: den delte biten ned i pilla når to eller flere foreldre møtes.
  // Den er IKKE en egen kant, men må lyse og dimme sammen med barnets kanter —
  // ellers blir 47 av 54 stubber stående i full styrke mens resten av kartet
  // dimmes, og uthevingen mister nettopp den effekten den finnes for.
  const stubs = [];
  function addEdge(d, pid, cid, barn, react) {
    const path = el("path", { d, class: "gxb-edge" + (react ? " gxb-react" : ""), stroke: nodeColor(barn) });
    path.dataset.p = pid; path.dataset.c = cid;
    gBands.appendChild(path);
    edges.push(path);
    // Usynlig, bred trykkbane: en 3 px strek er umulig å treffe med finger.
    const hit = el("path", { d, class: "gx-edge-hit" });
    hit.dataset.p = pid; hit.dataset.c = cid;
    gBands.appendChild(hit);
    edgeHits.push(hit);
  }

  nodes.forEach((n) => {
    const ps = parentsOf(n).map((id) => byId[id]).filter(Boolean);
    if (!ps.length) return;
    const topY = n._y - NH / 2;
    let bandY = topY - BUNDLE_LIFT;

    // Tre slags foreldre, i økende avstand over barnet:
    //  · near   — i samme høyde eller under (Hard bop ⟂ Cool jazz): bue under.
    //  · direct — så tett over at båndlinja ikke får plass (nøyaktig ett halvt
    //             tiår, f.eks. Soul → Funk): rett ned i pilla. Uten dette
    //             kollapser banen til et null-langt strekk som forsvinner under
    //             forelderens egen pille, og koblingen blir uklikkbar.
    //  · far    — normalt: ned i en ledig korridor, bortover, inn i båndet.
    const near = [], direct = [], far = [];
    for (const p of ps) {
      const startY = p._y + NH / 2;
      if (p._y >= n._y - 20) near.push(p);
      else if (bandY - startY < CORNER + 4) direct.push(p);
      else far.push(p);
    }

    // Båndlinja kan selv krysse piller i raden over. Løft den i små steg til
    // den er klar (eller gi opp og behold utgangspunktet).
    if (far.length) {
      const xs = far.map((p) => p._x).concat(n._x);
      const lo = Math.min(...xs), hi = Math.max(...xs);
      const skip = [n.id, ...far.map((p) => p.id)];
      for (let lift = 0; lift <= 34; lift += 6) {
        if (!hHits(lo, hi, bandY - lift, skip)) { bandY -= lift; break; }
      }
    }

    near.forEach((p) => {
      const y1 = p._y + NH / 2, y2 = n._y + NH / 2;
      // Samme kolonne: en bue ville gått ned forbi barnet og kommet inn
      // nedenfra som en stump. Da tegnes streken rett ned (som i det pakkede
      // kartet).
      const d = Math.abs(p._x - n._x) < 4
        ? `M${p._x},${y1} L${n._x},${topY}`
        : `M${p._x},${y1} C${p._x},${Math.max(y1, y2) + 44} ${n._x},${Math.max(y1, y2) + 44} ${n._x},${y2}`;
      addEdge(d, p.id, n.id, n, n.rx.includes(p.id));
    });

    direct.forEach((p) => {
      const startY = p._y + NH / 2;
      const d = Math.abs(p._x - n._x) < 4
        ? `M${p._x},${startY} L${n._x},${topY}`
        : `M${p._x},${startY} C${p._x},${(startY + topY) / 2} ${n._x},${(startY + topY) / 2} ${n._x},${topY}`;
      addEdge(d, p.id, n.id, n, n.rx.includes(p.id));
    });

    // Én fjern forelder: da er «båndet» bare denne ene koblingen, og hele veien
    // inn i pilla tegnes som del av DEN kanten — så den er klikkbar helt fram
    // og lyser i ett stykke. Først ved to eller flere trengs en delt stubbe.
    const solo = far.length === 1;
    far.forEach((p) => {
      const startY = p._y + NH / 2;
      const cx0 = clearCorridor(p._x, startY, bandY, [p.id, n.id]);
      const h = n._x >= cx0 ? 1 : -1;
      const seg = [`M${p._x},${startY}`];
      // Er korridoren flyttet til side, gli ut i den med en myk kurve i stedet
      // for et hakk rett under pilla.
      if (Math.abs(cx0 - p._x) > 1) {
        seg.push(`C${p._x},${startY + 26} ${cx0},${startY + 26} ${cx0},${startY + 52}`);
      }
      seg.push(`L${cx0},${bandY - CORNER}`);
      if (Math.abs(n._x - cx0) > 2 * CORNER) {
        seg.push(`Q${cx0},${bandY} ${cx0 + h * CORNER},${bandY}`);
        seg.push(`L${n._x - h * CORNER},${bandY}`);
        seg.push(`Q${n._x},${bandY} ${n._x},${bandY + CORNER}`);
      } else {
        seg.push(`L${n._x},${bandY}`);
      }
      if (solo) seg.push(`L${n._x},${topY}`);
      addEdge(seg.join(" "), p.id, n.id, n, n.rx.includes(p.id));
    });

    if (far.length < 2) return;
    // Den delte stubben ned i pilla: her ER båndet ett, og knutepunktet er
    // sammensmeltningen. pointer-events er av (CSS) fordi et klikk her ikke kan
    // vite hvilken av foreldrene det gjelder — hver forelder er klikkbar på sin
    // egen strekning fram til båndet.
    const stub = el("path", {
      d: `M${n._x},${bandY} L${n._x},${topY}`,
      class: "gxb-stub", stroke: nodeColor(n), "stroke-width": 5.5,
    });
    const knot = el("circle", { cx: n._x, cy: bandY, r: 4.5, fill: nodeColor(n), class: "gxb-knot" });
    gBands.appendChild(stub);
    gBands.appendChild(knot);
    stubs.push({ cid: n.id, els: [stub, knot] });
  });

  // Sett lys/dim på stubbene ut fra om barnets kanter er tent.
  function paintStubs(isOn) {
    stubs.forEach(({ cid, els }) => {
      const on = isOn(cid);
      els.forEach((e) => {
        e.classList.toggle("gx-hl", !!on);
        e.classList.toggle("gx-dim", !on);
      });
    });
  }

  // --------------------------------------------------------------------------
  //  Utheving: samme regel som i det gamle kartet — hele anelinjen bakover,
  //  men kun DIREKTE barn fremover. Full etterkommer-lukning lyste opp 60–90 %
  //  av kartet for de tidlige sjangrene og mistet all effekt.
  // --------------------------------------------------------------------------
  function light(id) {
    const ancSelf = anc(id); ancSelf[id] = 1;
    const line = { ...ancSelf };
    kids[id].forEach((c) => { line[c] = 1; });
    nodes.forEach((n) => {
      gnodes[n.id].g.classList.toggle("gx-dim", !line[n.id]);
      gnodes[n.id].g.classList.toggle("gxb-focus", n.id === id);
    });
    edges.forEach((e) => {
      const on = ancSelf[e.dataset.c] || e.dataset.p === id;
      e.classList.toggle("gx-hl", !!on);
      e.classList.toggle("gx-dim", !on);
    });
    // Stubben hører til barnets bånd: den lyser når barnet er på den opplyste
    // banen, altså på nøyaktig samme vilkår som kantene inn i den.
    paintStubs((cid) => !!ancSelf[cid]);
  }

  function lightEdge(pid, cid) {
    nodes.forEach((n) => {
      gnodes[n.id].g.classList.toggle("gx-dim", n.id !== pid && n.id !== cid);
      gnodes[n.id].g.classList.remove("gxb-focus");
    });
    edges.forEach((e) => {
      const on = e.dataset.p === pid && e.dataset.c === cid;
      e.classList.toggle("gx-hl", on);
      e.classList.toggle("gx-dim", !on);
    });
    paintStubs((c) => c === cid);
  }

  function clearLight() {
    nodes.forEach((n) => gnodes[n.id].g.classList.remove("gx-dim", "gxb-focus"));
    edges.forEach((e) => e.classList.remove("gx-hl", "gx-dim"));
    stubs.forEach(({ els }) => els.forEach((e) => e.classList.remove("gx-hl", "gx-dim")));
  }

  // --- Touch: uten hover trykker man for å lyse opp. Første trykk på en pille
  //     dimmer alt utenom slekta, andre trykk (eller «Detaljer») åpner kortet.
  let selectedId = null;
  // Kortet henger i SCENEN, ikke i #gx-cam, og overlever derfor en omtegning.
  // Uten denne oppryddingen hopet det seg opp ett kort per snapshot, hvert med
  // sin egen «Detaljer»-knapp som pekte på en gammel utgave av kartet.
  stage.querySelectorAll(".gx-card").forEach((gammelt) => gammelt.remove());
  const card = document.createElement("div");
  card.className = "gx-card";
  card.innerHTML = `<span class="gx-card-dot"></span><span class="gx-card-name"></span>` +
    `<button type="button" class="btn ghost small gx-card-btn">Detaljer</button>`;
  stage.appendChild(card);
  const cardDot = card.querySelector(".gx-card-dot");
  const cardName = card.querySelector(".gx-card-name");
  card.querySelector(".gx-card-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (selectedId) openNode(selectedId);
  });
  function clearTouchSel() { selectedId = null; card.classList.remove("show"); }
  function reset() { clearLight(); clearTouchSel(); }

  function openNode(id) {
    showSjangerInfo(byId[id].l, getOpts());
  }
  function openEdge(pid, cid) {
    showEdgeInfo(pid, cid, getOpts());
  }

  const camera = attachCamera({
    root, stage, cam, width: W,
    height: TOP + maxRow() * ROW_H + NH,   // nederste tiårsrad + pillehøyde
    onBackgroundClick: reset,
  });

  nodes.forEach((n) => {
    const { g } = gnodes[n.id];
    g.addEventListener("mouseenter", () => { if (!selectedId) light(n.id); });
    g.addEventListener("mouseleave", () => { if (!selectedId) clearLight(); });
    g.addEventListener("click", (ev) => {
      if (camera.isMoved()) return;
      ev.stopPropagation();
      if (!camera.isTouch()) { openNode(n.id); return; }
      if (selectedId === n.id) openNode(n.id);
      else {
        selectedId = n.id;
        light(n.id);
        cardName.textContent = n.l;
        cardDot.style.background = nodeColor(n);
        card.classList.add("show");
      }
    });
  });

  // MIDLERTIDIG (feature-flags.js): for studenter er strekene bare strek.
  // Uten klikk skal de heller ikke se klikkbare ut, så treffsonen mister
  // både peker-markøren og hover-uthevningen. Selve tegningen er urørt.
  // Lærersignalet er onEdit (sjangerOpts sender ikke onEditEdge hit).
  const kanApneKobling = !SKJUL_I_STUDENTVISNING.koblingsbeskrivelser
    || !!(getOpts() || {}).onEdit;
  edgeHits.forEach((h) => {
    const pid = h.dataset.p, cid = h.dataset.c;
    if (!kanApneKobling) { h.style.cursor = "default"; h.style.pointerEvents = "none"; return; }
    h.addEventListener("mouseenter", () => { if (!selectedId) lightEdge(pid, cid); });
    h.addEventListener("mouseleave", () => { if (!selectedId) clearLight(); });
    h.addEventListener("click", (ev) => {
      if (camera.isMoved()) return;
      ev.stopPropagation();
      openEdge(pid, cid);
    });
  });

  // Forklaring: her er det FARGEN som bærer betydningen, ikke strektypen.
  // Båndet har barnets familiefarge nettopp for å vise at foreldrene er
  // likestilte — derfor forklares knutepunktet, ikke «avstamning vs. reaksjon»
  // (motreaksjonen er fortsatt stiplet, som i det pakkede kartet).
  const legend = root.querySelector("#gx-legend");
  if (legend) {
    legend.innerHTML =
      `<div class="gx-leg"><span class="gxb-sw-band"></span>bånd i barnets farge: foreldrene er likestilte</div>` +
      `<div class="gx-leg"><span class="gx-sw-line"></span>motreaksjon</div>` +
      `<div class="gx-leg"><span class="gxb-sw-knot"></span>knutepunkt: to eller flere foreldre møtes</div>` +
      `<div class="gx-leg gx-leg-hint">klikk på et bånd for å lese om koblingen</div>`;
  }

  reset();
  return { fit: camera.fit, destroy: camera.destroy };
}
