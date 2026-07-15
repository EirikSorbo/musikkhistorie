// GENEALOGY_EDGES er delt kilde for slektstreets trykkbaner, lærer-oversiktens
// koblingsliste og eksport/import av koblingsbeskrivelser. Testene låser at
// alle koblinger peker på ekte noder, at motreaksjoner flagges, og at
// edgeKey-formatet (Firestore-dokument-ID) er stabilt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GENEALOGY, GENEALOGY_EDGES, edgeKey } from "../../js/genealogy.js?v=3.54";

test("GENEALOGY_EDGES: alle koblinger peker på eksisterende noder", () => {
  const ids = new Set(GENEALOGY.map((n) => n.id));
  for (const e of GENEALOGY_EDGES) {
    assert.ok(ids.has(e.from), `ukjent fra-node: ${e.from}`);
    assert.ok(ids.has(e.to), `ukjent til-node: ${e.to}`);
  }
});

test("GENEALOGY_EDGES: dekker p + rx uten duplikater", () => {
  const keys = GENEALOGY_EDGES.map((e) => edgeKey(e.from, e.to));
  assert.equal(new Set(keys).size, keys.length, "duplikat-koblinger");
  // Summen av unike foreldre (p ∪ rx) per node = antall koblinger.
  const expected = GENEALOGY.reduce((sum, n) =>
    sum + new Set([...n.p, ...(n.rx || [])]).size, 0);
  assert.equal(GENEALOGY_EDGES.length, expected);
});

test("GENEALOGY_EDGES: motreaksjoner flagges med react", () => {
  const reacts = GENEALOGY_EDGES.filter((e) => e.react);
  assert.ok(reacts.length >= 6, `ventet minst 6 motreaksjoner, fikk ${reacts.length}`);
  assert.ok(reacts.some((e) => e.from === "swing" && e.to === "bebop"));
  assert.ok(GENEALOGY_EDGES.some((e) => e.from === "blues" && e.to === "jazz" && !e.react));
});

test("edgeKey: stabilt dokument-ID-format", () => {
  assert.equal(edgeKey("blues", "jazz"), "blues__jazz");
});
