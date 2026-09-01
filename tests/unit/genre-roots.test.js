// Røttene som Røtter-kortet viser som bobler, utledet av treet.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GENEALOGY, GENEALOGY_ROOT_GENRES, GENEALOGY_MAIN_GENRES, rebuild } from "../../js/genre-model.js?v=5.05";

test("røttene er treets lag før sjangrene", () => {
  assert.deepEqual(GENEALOGY_ROOT_GENRES.map((n) => n.l), [
    "Europeisk", "Vestafrikansk", "Hymner", "Vaudeville",
    "Brassband", "Work songs", "Spirituals", "Ragtime",
  ]);
});

test("ingen rot er samtidig en sjanger", () => {
  for (const n of GENEALOGY_ROOT_GENRES) {
    assert.equal(n.g, null, `${n.l} har metasjanger og er ingen rot`);
    assert.ok(!GENEALOGY_MAIN_GENRES.includes(n.l), `${n.l} står også i sjangerlista`);
  }
});

test("alle røttenes forfedre er også røtter", () => {
  const ider = new Set(GENEALOGY_ROOT_GENRES.map((n) => n.id));
  for (const n of GENEALOGY_ROOT_GENRES) {
    for (const pid of n.p) {
      assert.ok(ider.has(pid), `${n.l} har forelderen ${pid}, som ikke er en rot`);
    }
  }
  // Rekkefølgen er treets egen, og en forelder står alltid før barnet sitt.
  const sett = [];
  for (const n of GENEALOGY_ROOT_GENRES) {
    for (const pid of n.p) assert.ok(sett.includes(pid), `${n.l} står før forelderen ${pid}`);
    sett.push(n.id);
  }
});

// Reggae sto i live-treet uten metasjanger, men med R&B som forelder. Den er en
// sjanger som mangler plassering, ikke en rot — regelen må skille de to.
// Testen bygger modellen på nytt og står derfor sist i fila.
test("en metasjanger-løs node under en ekte sjanger er ingen rot", () => {
  rebuild({
    nodes: [
      { id: "rot", l: "Rot", f: "Rot", g: null, p: [] },
      { id: "sjanger", l: "Sjanger", f: "Sjanger", g: "Meta", p: ["rot"] },
      { id: "hjemløs", l: "Hjemløs", f: "Hjemløs", g: null, p: ["rot", "sjanger"] },
      { id: "rot2", l: "Rot 2", f: "Rot 2", g: null, p: ["rot"] },
    ],
    families: { gray: { stroke: "#9bada1", label: "Røtter" } },
    metaGenres: [{ name: "Meta" }],
  });
  assert.deepEqual(GENEALOGY_ROOT_GENRES.map((n) => n.l), ["Rot", "Rot 2"]);
  assert.equal(GENEALOGY.length, 4, "treet skal være uendret ellers");
});
