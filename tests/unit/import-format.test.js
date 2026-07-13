import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenGenreDescriptions, validateArtistsForImport } from "../../js/import-format.js?v=3.14";

test("nestet format (meta/main/sub) flates ut", () => {
  const nested = {
    meta: { "R&B": { meta: { description: "m" } } },
    main: { Blues: { main: { description: "b" } } },
    sub: { "Delta blues": { sub: { description: "d" } } },
  };
  const flat = flattenGenreDescriptions(nested);
  assert.deepEqual(Object.keys(flat).sort(), ["Blues", "Delta blues", "R&B"]);
});

test("flatt format passerer uendret", () => {
  const already = { Blues: { main: { description: "b" } } };
  assert.equal(flattenGenreDescriptions(already), already);
});

test("tomt/ugyldig gir tomt objekt", () => {
  assert.deepEqual(flattenGenreDescriptions(null), {});
  assert.deepEqual(flattenGenreDescriptions(undefined), {});
  assert.deepEqual(flattenGenreDescriptions("x"), {});
});

// --- validateArtistsForImport ---

test("gyldig artistliste passerer", () => {
  const list = [
    { name: "Robert Johnson", mainGenre: ["Blues"], subGenre: "Delta blues", keyWorks: [{ title: "Cross Road Blues" }] },
    { name: "Elvis Presley", mainGenre: [] },
  ];
  const res = validateArtistsForImport(list);
  assert.equal(res.ok, true);
  assert.equal(res.errors.length, 0);
});

test("ikke-liste avvises", () => {
  const res = validateArtistsForImport({ name: "x" });
  assert.equal(res.ok, false);
  assert.equal(res.errors[0].row, 0);
});

test("name som mangler eller er tall avvises med radnummer", () => {
  const res = validateArtistsForImport([
    { name: "Ok Artist" },
    { name: 123 },
    { mainGenre: ["Blues"] },
    { name: "   " },
  ]);
  assert.equal(res.ok, false);
  assert.deepEqual(res.errors.map((e) => e.row), [2, 3, 4]);
  assert.match(res.errors[0].problems.join(" "), /name/);
});

test("nestet liste i mainGenre/subGenre avvises (Firestore-hostil)", () => {
  const res = validateArtistsForImport([
    { name: "A", mainGenre: ["Blues", ["nested"]] },
    { name: "B", subGenre: [{ x: 1 }] },
  ]);
  assert.equal(res.ok, false);
  assert.equal(res.errors.length, 2);
});

test("flat tekstliste og ren streng i mainGenre er ok", () => {
  const res = validateArtistsForImport([
    { name: "A", mainGenre: ["Blues", "Jazz"] },
    { name: "B", mainGenre: "Blues, Jazz" },
  ]);
  assert.equal(res.ok, true);
});

test("komplekst felt som ikke er liste avvises", () => {
  const res = validateArtistsForImport([{ name: "A", keyWorks: { title: "x" } }]);
  assert.equal(res.ok, false);
  assert.match(res.errors[0].problems.join(" "), /keyWorks/);
});

test("for stort dokument avvises", () => {
  const res = validateArtistsForImport([{ name: "Big", description: "x".repeat(1_000_001) }]);
  assert.equal(res.ok, false);
  assert.match(res.errors[0].problems.join(" "), /for stort/);
});
