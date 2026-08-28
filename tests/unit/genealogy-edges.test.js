// GENEALOGY_EDGES er delt kilde for slektstreets trykkbaner, lærer-oversiktens
// koblingsliste og eksport/import av koblingsbeskrivelser. Testene låser at
// alle koblinger peker på ekte noder, at motreaksjoner flagges, og at
// edgeKey-formatet (Firestore-dokument-ID) er stabilt.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GENEALOGY, GENEALOGY_EDGES, edgeKey } from "../../js/genre-model.js?v=4.93";

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
  assert.ok(reacts.length >= 1, "treet skal ha motreaksjoner");
  assert.ok(GENEALOGY_EDGES.some((e) => e.from === "blues" && e.to === "jazz" && !e.react));
});

test("en motreaksjon peker ALDRI på nodens egen forelder", () => {
  // Regelen fra pensumgjennomgangen (v4.00, brukervalg). Står samme node i både
  // p og rx, slår de sammen til ÉN strek — og den blir stiplet. Da forsvinner
  // avstamningen visuelt: Bebop ← Swing og Cool jazz ← Bebop viste bare
  // motreaksjon, ikke at de faktisk vokste ut av forelderen sin.
  // Motreaksjonen skal peke på et SØSKEN og tilføre noe streken ikke alt sier.
  for (const n of GENEALOGY) {
    for (const r of n.rx || []) {
      assert.ok(!(n.p || []).includes(r),
        `${n.l}: «${r}» står som både forelder og motreaksjon — skriv motreaksjonen i teksten i stedet`);
    }
  }
  // Swing → Bebop er nettopp tilfellet som ble ryddet: nå heltrukken avstamning.
  const sb = GENEALOGY_EDGES.find((e) => e.from === "swing" && e.to === "bebop");
  assert.ok(sb && !sb.react, "Swing → Bebop skal være heltrukken avstamning");
});

test("edgeKey: stabilt dokument-ID-format", () => {
  assert.equal(edgeKey("blues", "jazz"), "blues__jazz");
});
