// ============================================================================
//  KARTKAMERAET — destroy() må koble fra ALT
// ----------------------------------------------------------------------------
//  Kameraet bindes til #gx-stage og zoom-knappene, og de elementene OVERLEVER en
//  omtegning (bare innholdet i #gx-cam byttes). Binder kameraet noe direkte i
//  stedet for gjennom sin egen opprydding, hoper lytterne seg opp for hvert
//  sjangertre-snapshot.
//
//  Det ga en ekte og ubehagelig feil i v4.58: det gamle kameraet hadde mistet
//  pointerup, men beholdt pointerdown og pointermove. Pekeren ble derfor
//  liggende i dets `pointers`-kart for alltid, og kartet panorerte etter musa
//  uten at noen knapp var nede — helt til pekeren forlot scenen, og med et hopp
//  når den kom tilbake. Zoom-knappene zoomet 1,25² i stedet for 1,25.
//
//  Testene bruker en liten DOM-stubb, så de kjører i node uten nettleser.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { attachCamera } from "../../js/gx-camera.js?v=4.97";

// --- Minimal DOM ------------------------------------------------------------
function lagElement(id) {
  const lyttere = new Map();     // type → Set<fn>
  return {
    id,
    clientWidth: 800, clientHeight: 600,
    classList: { add() {}, remove() {}, contains: () => false },
    _lyttere: lyttere,
    addEventListener(type, fn) {
      if (!lyttere.has(type)) lyttere.set(type, new Set());
      lyttere.get(type).add(fn);
    },
    removeEventListener(type, fn) { lyttere.get(type)?.delete(fn); },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setAttribute() {},
    dispatch(type, ev = {}) {
      for (const fn of [...(lyttere.get(type) || [])]) fn({ preventDefault() {}, ...ev });
    },
    antall(type) { return (lyttere.get(type) || new Set()).size; },
    alle() { return [...lyttere.entries()].reduce((n, [, s]) => n + s.size, 0); },
  };
}

function lagRigg() {
  const stage = lagElement("gx-stage");
  const knapper = { "#gx-zin": lagElement("zin"), "#gx-zout": lagElement("zout"), "#gx-rst": lagElement("rst") };
  let camTransform = null;
  const cam = { setAttribute: (k, v) => { if (k === "transform") camTransform = v; } };
  const root = { querySelector: (sel) => knapper[sel] || null };
  const vindu = lagElement("window");
  const forrigeWindow = globalThis.window;
  globalThis.window = vindu;
  return {
    stage, cam, root, knapper, vindu,
    transform: () => camTransform,
    avslutt() { globalThis.window = forrigeWindow; },
  };
}

const ned = (r, x, y, id = 1) => r.stage.dispatch("pointerdown", { pointerId: id, clientX: x, clientY: y, pointerType: "mouse" });
const flytt = (r, x, y, id = 1) => r.stage.dispatch("pointermove", { pointerId: id, clientX: x, clientY: y });
const opp = (r, id = 1) => r.vindu.dispatch("pointerup", { pointerId: id });

test("destroy() kobler fra ALLE lyttere, ikke bare den på window", () => {
  const r = lagRigg();
  const kamera = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  assert.ok(r.stage.alle() > 0, "scenen skal ha lyttere");
  assert.ok(r.vindu.alle() > 0, "window skal ha pointerup");
  assert.ok(r.knapper["#gx-zin"].alle() > 0, "zoom-knappen skal ha lytter");

  kamera.destroy();
  assert.equal(r.stage.alle(), 0, "scenen skal være tom etter destroy");
  assert.equal(r.vindu.alle(), 0, "window skal være tom etter destroy");
  assert.equal(r.knapper["#gx-zin"].alle(), 0, "zoom-knappen skal være tom etter destroy");
  r.avslutt();
});

test("et destroyet kamera panorerer ikke lenger — feilen der kartet fulgte musa", () => {
  const r = lagRigg();
  const gammelt = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  gammelt.destroy();
  const nytt = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  nytt.fit();

  // Fullført klikk: ned og opp uten bevegelse.
  ned(r, 300, 400); opp(r);
  const etterKlikk = r.transform();
  // Så bevegelse UTEN knapp nede.
  flytt(r, 500, 500); flytt(r, 520, 510);
  assert.equal(r.transform(), etterKlikk, "kartet skal ikke panorere uten at en peker er nede");
  r.avslutt();
});

test("zoom-knappen gir ett hakk, ikke ett per gammelt kamera", () => {
  const r = lagRigg();
  const a = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  a.destroy();
  const b = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  b.fit();
  const før = parseFloat(r.transform().match(/scale\(([\d.]+)\)/)[1]);
  r.knapper["#gx-zin"].dispatch("click");
  const etter = parseFloat(r.transform().match(/scale\(([\d.]+)\)/)[1]);
  assert.ok(Math.abs(etter / før - 1.25) < 1e-6, `forventet 1.25×, fikk ${(etter / før).toFixed(4)}×`);
  r.avslutt();
});

test("ekte dragning panorerer fortsatt", () => {
  const r = lagRigg();
  const k = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  k.fit();
  const før = r.transform();
  ned(r, 300, 400); flytt(r, 360, 430);
  assert.notEqual(r.transform(), før, "dragning skal flytte kartet");
  assert.equal(k.isMoved(), true, "dragning skal settes som moved, så klikket ikke åpner kort");
  opp(r);
  r.avslutt();
});

test("destroy() rydder pekertilstanden, så et halvferdig drag ikke overlever", () => {
  const r = lagRigg();
  const a = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  ned(r, 300, 400);                 // peker nede når kartet tegnes på nytt
  a.destroy();
  const b = attachCamera({ root: r.root, stage: r.stage, cam: r.cam, width: 2400 });
  b.fit();
  const etter = r.transform();
  flytt(r, 500, 500);
  assert.equal(r.transform(), etter, "det nye kameraet skal ikke arve en peker som var nede");
  r.avslutt();
});
