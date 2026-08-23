// ============================================================================
//  VALIDERING AV SJANGERTREET
// ----------------------------------------------------------------------------
//  Treet er data fra v4.49, og importen skriver det til content/genealogy.
//  Validatoren er det eneste som står mellom en ødelagt fil og et kart som er
//  nede for hele klassen, så den testes på hvert feilslag den skal fange.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { validateTree, assertTreeOk } from "../../js/genre-validate.js?v=4.71";
import { GENEALOGY, FAMILIES, META_ORDER_HINT } from "../../js/genealogy-data.js?v=4.71";

const feilene = (tree) => validateTree(tree).filter((p) => p.nivå === "feil").map((p) => p.melding);
const ekte = () => ({
  nodes: JSON.parse(JSON.stringify(GENEALOGY)),
  families: FAMILIES,
  metaOrderHint: META_ORDER_HINT,
});

test("det ekte treet validerer uten feil", () => {
  assert.deepEqual(feilene(ekte()), []);
});

test("tomt tre er en feil, ikke en stille tom modell", () => {
  assert.equal(feilene({ nodes: [] }).length, 1);
  assert.equal(feilene(null).length, 1);
  assert.equal(feilene({}).length, 1);
});

test("dupliserte id-er fanges", () => {
  const t = ekte();
  t.nodes.push({ ...t.nodes[0], l: "Et annet navn" });
  assert.ok(feilene(t).some((m) => m.includes("har id")));
});

test("duplisert etikett fanges — etiketten er dokument-ID i genreDescriptions", () => {
  const t = ekte();
  t.nodes.push({ id: "nyid", l: t.nodes[0].l, f: "Noe", fam: "gray", r: 5, p: [] });
  assert.ok(feilene(t).some((m) => m.includes("brukes av både")));
});

test("etikett med skråstrek fanges — Firestore forbyr «/» i dokument-ID", () => {
  const t = ekte();
  t.nodes.push({ id: "nyid", l: "House/techno", f: "House/techno", fam: "teal", r: 9, p: [] });
  assert.ok(feilene(t).some((m) => m.includes("«/»")));
});

test("forelder som ikke finnes fanges", () => {
  const t = ekte();
  t.nodes[5].p = ["finnes-ikke"];
  assert.ok(feilene(t).some((m) => m.includes("finnes-ikke")));
});

test("node som er sin egen forelder fanges", () => {
  const t = ekte();
  t.nodes[5].p = [t.nodes[5].id];
  assert.ok(feilene(t).some((m) => m.includes("sin egen forelder")));
});

test("sykel fanges, med hele stien i meldingen", () => {
  const t = {
    nodes: [
      { id: "a", l: "A", f: "A", fam: "gray", r: 1, p: ["c"] },
      { id: "b", l: "B", f: "B", fam: "gray", r: 2, p: ["a"] },
      { id: "c", l: "C", f: "C", fam: "gray", r: 3, p: ["b"] },
    ],
    families: FAMILIES, metaOrderHint: [],
  };
  const m = feilene(t);
  assert.ok(m.some((x) => x.startsWith("Sykel i slektskapet")), m.join("|"));
});

test("sykel via motreaksjon (rx) fanges også", () => {
  const t = {
    nodes: [
      { id: "a", l: "A", f: "A", fam: "gray", r: 1, p: [], rx: ["b"] },
      { id: "b", l: "B", f: "B", fam: "gray", r: 2, p: ["a"] },
    ],
    families: FAMILIES, metaOrderHint: [],
  };
  assert.ok(feilene(t).some((x) => x.startsWith("Sykel")));
});

test("node uten rad fanges", () => {
  const t = ekte();
  delete t.nodes[3].r;
  assert.ok(feilene(t).some((m) => m.includes("mangler rad")));
});

test("ukjent metasjanger og ukjent familie er ADVARSLER, ikke feil", () => {
  const t = ekte();
  t.metaGenres = [{ name: "Blues" }];
  t.nodes[10].fam = "finnes-ikke";
  const alle = validateTree(t);
  assert.deepEqual(alle.filter((p) => p.nivå === "feil"), []);
  assert.ok(alle.some((p) => p.nivå === "advarsel" && p.melding.includes("families")));
  assert.ok(alle.some((p) => p.nivå === "advarsel" && p.melding.includes("metaGenres")));
});

test("assertTreeOk kaster på feil, men ikke på advarsler", () => {
  assert.doesNotThrow(() => assertTreeOk(ekte()));
  const t = ekte();
  t.nodes[5].p = ["finnes-ikke"];
  assert.throws(() => assertTreeOk(t, "importfila"), /importfila/);
});
