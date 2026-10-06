// Podkastenes rekkefølge (v6.48): nyeste øverst, og læreren flytter opp og ned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sorterPodkaster, flyttPodkast } from "../../js/felles/podkast-rekkefolge.js";

const POD = [
  { id: "a", title: "Episode 1", order: 1 },
  { id: "b", title: "Episode 2", order: 2 },
  { id: "c", title: "Episode 3", order: 3 },
];
const ider = (liste) => liste.map((p) => p.id);

test("nyeste øverst: høyest order først, manglende order nederst", () => {
  assert.deepEqual(ider(sorterPodkaster(POD)), ["c", "b", "a"]);
  assert.deepEqual(ider(sorterPodkaster([...POD, { id: "x", title: "Uten tall" }])), ["c", "b", "a", "x"]);
  assert.deepEqual(ider(sorterPodkaster([{ id: "q", title: "B", order: 2 }, { id: "p", title: "A", order: 2 }])), ["p", "q"], "likt tall: tittel avgjør");
  assert.deepEqual(sorterPodkaster(null), []);
});

test("flytting nummererer på nytt og skriver bare det som endres", () => {
  // a (nederst) opp: c, a, b.
  assert.deepEqual(flyttPodkast(POD, "a", -1), [{ id: "a", order: 2 }, { id: "b", order: 1 }]);
  // c (øverst) ned: b, c, a.
  assert.deepEqual(flyttPodkast(POD, "c", 1), [{ id: "b", order: 3 }, { id: "c", order: 2 }]);
});

test("øverst kan ikke opp, nederst kan ikke ned, ukjent gir ingenting", () => {
  assert.deepEqual(flyttPodkast(POD, "c", -1), []);
  assert.deepEqual(flyttPodkast(POD, "a", 1), []);
  assert.deepEqual(flyttPodkast(POD, "finnes-ikke", 1), []);
});

test("like eller manglende tall: flyttingen virker likevel", () => {
  const rot = [{ id: "a", title: "A", order: 5 }, { id: "b", title: "B", order: 5 }, { id: "c", title: "C" }];
  // Vist: a, b, c. b opp gir b, a, c med 3, 2, 1.
  const endringer = flyttPodkast(rot, "b", -1);
  assert.deepEqual(endringer, [{ id: "b", order: 3 }, { id: "a", order: 2 }, { id: "c", order: 1 }]);
  const etter = rot.map((p) => ({ ...p, ...(endringer.find((e) => e.id === p.id) || {}) }));
  assert.deepEqual(ider(sorterPodkaster(etter)), ["b", "a", "c"]);
});

test("en ny episode får høyeste tall + 1 og havner øverst; listene sorteres i store", () => {
  const kilde = (f) => readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");
  assert.match(kilde("laerer/teacher-content.js"), /order: Math\.max\(0, \.\.\.state\.podcasts\.map\(\(p\) => p\.order \|\| 0\)\) \+ 1/);
  assert.match(kilde("data/store.js"), /callback\(sorterPodkaster\(snapshot\.docs/);
});
