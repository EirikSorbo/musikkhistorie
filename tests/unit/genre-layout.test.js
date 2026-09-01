// ============================================================================
//  KOLONNEUTREGNINGEN (js/genre-layout.js)
// ----------------------------------------------------------------------------
//  Layouten erstattet de håndsatte cx-koordinatene (fase 2) og deles av
//  slektstreet og Sjangerhimmelen. En regresjon her (NaN, noder utenfor sonen,
//  soner i feil rekkefølge) er kun synlig VISUELT og oppdages sent — disse
//  invariantene fanger den i node i stedet.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { GENEALOGY as SEED_NODES, FAMILIES as SEED_FAMILIES, META_ORDER_HINT } from "../../js/genealogy-data.js?v=5.02";
import { byggGenealogyDoc } from "../../tools/build-genealogy-doc.js";
import { computeColumns, LAYOUT_WIDTH } from "../../js/genre-layout.js?v=5.02";

const doc = byggGenealogyDoc({ GENEALOGY: SEED_NODES, FAMILIES: SEED_FAMILIES, META_ORDER_HINT });
const X = computeColumns(doc.nodes, doc.metaGenres, { width: LAYOUT_WIDTH });

test("hver node får en endelig x innenfor kartbredden", () => {
  for (const n of doc.nodes) {
    const x = X.get(n.id);
    assert.ok(Number.isFinite(x), `${n.l}: x er ${x}`);
    assert.ok(x >= 0 && x <= LAYOUT_WIDTH, `${n.l}: x=${x} utenfor [0, ${LAYOUT_WIDTH}]`);
  }
  assert.equal(X.size, doc.nodes.length, "alle noder skal være plassert");
});

test("metasjangrenes soner står i kolonnerekkefølgen, venstre mot høyre", () => {
  // Gjennomsnitts-x per metasjanger skal være strengt stigende når metaene
  // sorteres på column — ellers har to soner byttet plass i kartet.
  const snitt = (navn) => {
    const xs = doc.nodes.filter((n) => n.g === navn).map((n) => X.get(n.id));
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  const iKolonneOrden = [...doc.metaGenres].sort((a, b) => a.column - b.column).map((m) => m.name);
  for (let i = 1; i < iKolonneOrden.length; i++) {
    assert.ok(snitt(iKolonneOrden[i - 1]) < snitt(iKolonneOrden[i]),
      `sonen «${iKolonneOrden[i - 1]}» skal ligge til venstre for «${iKolonneOrden[i]}»`);
  }
});

test("noder i samme rad får ulik x (ingen stabling)", () => {
  const perRad = new Map();
  for (const n of doc.nodes) {
    const r = Math.floor(n.r || 0);
    (perRad.get(r) || perRad.set(r, []).get(r)).push(X.get(n.id));
  }
  for (const [r, xs] of perRad) {
    assert.equal(new Set(xs).size, xs.length, `rad ${r}: to noder deler x`);
  }
});

test("tåler tomt tre og tre uten metaGenres-liste", () => {
  assert.equal(computeColumns([], [], { width: LAYOUT_WIDTH }).size, 0);
  const uten = computeColumns(doc.nodes, [], { width: LAYOUT_WIDTH });
  for (const n of doc.nodes) assert.ok(Number.isFinite(uten.get(n.id)), n.l);
});
