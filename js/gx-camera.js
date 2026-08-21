// ============================================================================
//  KARTKAMERA — panorering, zoom og pinch for slektstre-flatene
// ----------------------------------------------------------------------------
//  Delt av begge slektstre-visningene (genealogy.js og genealogy-bundled.js).
//  Sto tidligere som identisk kode i hver renderer; da ville en fiks i den ene
//  (f.eks. pinch-hoppet da to fingre delte ett startpunkt) stille tause feil
//  igjen i den andre.
//
//  Kameraet eier IKKE utvalg eller utheving — det melder bare fra når et klikk
//  traff tom flate (onBackgroundClick), så rendereren kan nullstille sitt eget
//  lys. `isMoved()` skiller et klikk fra slutten på en dragning, og
//  `pointerType()` lar rendereren skille touch (to trykk) fra mus (hover).
// ============================================================================

export function attachCamera({
  root = document,
  stage,
  cam,
  width,
  // Kartets høyde i egne koordinater. Brukes kun til å sentrere loddrett når
  // hele kartet får plass i scenen — uten den klemmes kartet mot toppen med et
  // stort tomrom under (bundle-visningen er bredere enn den er høy).
  height = 0,
  onBackgroundClick = null,
  // Elementer som IKKE skal telle som «tom flate» ved klikk.
  ignoreSelector = ".gx-node, .gx-card",
  minScale = 0.3,
  maxScale = 1.8,
}) {
  let sc = 0.56, tx = 20, ty = 10;
  let moved = false;
  let lastPointerType = "mouse";

  function apply() {
    cam.setAttribute("transform", `translate(${tx},${ty}) scale(${sc})`);
  }

  // Sentrer og skaler så hele bredden får plass. Kalles ved hver åpning og når
  // scenens BREDDE endres (ikke høyden — se resize-vakten i sidene).
  //
  // Returnerer false hvis scenen ikke har noen bredde ennå. Det skjer i praksis:
  // klassekodesperren (gate.js) skjuler innholdet, og da er clientWidth 0 når
  // rendereren kjører. En fallback-bredde her ga feil skala i STILLHET — kartet
  // ble tegnet for stort og høyre kant (Reggae/Disco/EDM) lå utenfor scenen
  // uten at noe så galt ut. Kalleren må prøve igjen når scenen blir synlig.
  function fit() {
    const sw = stage.clientWidth;
    if (!sw) return false;
    sc = sw / (width + 30);
    tx = (sw - width * sc) / 2;
    const sh = stage.clientHeight || 0;
    ty = height && sh ? Math.max(10, (sh - height * sc) / 2) : 10;
    apply();
    return true;
  }

  function zoom(f, cx, cy) {
    const sw = stage.clientWidth || 760, sh = stage.clientHeight || 440;
    cx = cx == null ? sw / 2 : cx;
    cy = cy == null ? sh / 2 : cy;
    const ns = Math.max(minScale, Math.min(maxScale, sc * f));
    tx = cx - (cx - tx) * (ns / sc);
    ty = cy - (cy - ty) * (ns / sc);
    sc = ns;
    apply();
  }

  // ALLE lyttere samles her, så destroy() kan koble fra hver eneste én.
  //
  // Dette må være uttømmende. Scenen (#gx-stage) og zoom-knappene OVERLEVER en
  // omtegning — bare innholdet i #gx-cam byttes — så en lytter som bindes rett
  // på dem hoper seg opp for hvert nytt sjangertre-snapshot. Da fikk vi denne
  // feilen: det gamle kameraet mistet pointerup (den var ryddet), men beholdt
  // pointerdown og pointermove. Pekeren ble dermed liggende i dets `pointers`-
  // kart for alltid, og kartet panorerte etter musa uten at noen knapp var nede,
  // helt til pekeren forlot scenen. Zoom-knappene zoomet tilsvarende flere hakk
  // per klikk.
  const opprydding = [];
  const koble = (mål, type, fn, opts) => {
    mål.addEventListener(type, fn, opts);
    opprydding.push(() => mål.removeEventListener(type, fn, opts));
  };

  const zin = root.querySelector("#gx-zin");
  const zout = root.querySelector("#gx-zout");
  const zrst = root.querySelector("#gx-rst");
  if (zin) koble(zin, "click", () => zoom(1.25));
  if (zout) koble(zout, "click", () => zoom(0.8));
  if (zrst) koble(zrst, "click", () => { fit(); onBackgroundClick?.(); });

  koble(stage, "wheel", (ev) => {
    ev.preventDefault();
    const rect = stage.getBoundingClientRect();
    zoom(ev.deltaY < 0 ? 1.12 : 0.9, ev.clientX - rect.left, ev.clientY - rect.top);
  }, { passive: false });

  // Peker-styrt pan + pinch-zoom. Ett Map fra pointerId → siste posisjon, så to
  // fingre ALDRI deler ett (sx,sy)-par (som ga ville pan-hopp: finger nr. 2
  // overskrev startpunktet og begge fingres move regnet dx/dy på kryss). Én
  // peker = pan; to pekere = pinch-zoom om midtpunktet.
  const pointers = new Map();
  let pinchDist = 0;

  koble(stage, "pointerdown", (ev) => {
    lastPointerType = ev.pointerType || "mouse";
    const first = pointers.size === 0;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (first) { moved = false; stage.classList.add("gx-drag"); }
    else pinchDist = 0;   // andre finger ned: nullstill pinch-referansen
  });

  koble(stage, "pointermove", (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const prev = pointers.get(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) {
      const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      tx += dx; ty += dy; apply();
    } else if (pointers.size === 2) {
      moved = true;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (pinchDist > 0) {
        const rect = stage.getBoundingClientRect();
        zoom(d / pinchDist, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      }
      pinchDist = d;
    }
  });

  const endPtr = (ev) => {
    pointers.delete(ev.pointerId);
    pinchDist = 0;
    if (!pointers.size) stage.classList.remove("gx-drag");
  };
  koble(window, "pointerup", endPtr);
  koble(stage, "pointercancel", endPtr);

  koble(stage, "click", (ev) => {
    if (!ev.target.closest(ignoreSelector) && !moved) onBackgroundClick?.();
  });

  apply();

  return {
    fit,
    zoom,
    // Kobler fra ALT kameraet har bundet. Kall FØR en ny render på samme scene.
    // Rydder også pekertilstanden, så et halvferdig drag ikke overlever inn i
    // det nye kameraet.
    destroy() {
      opprydding.forEach((av) => av());
      opprydding.length = 0;
      pointers.clear();
      pinchDist = 0;
      stage.classList.remove("gx-drag");
    },
    isMoved: () => moved,
    pointerType: () => lastPointerType,
    isTouch: () => lastPointerType === "touch" || lastPointerType === "pen",
  };
}
