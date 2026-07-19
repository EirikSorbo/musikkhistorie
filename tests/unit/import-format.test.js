import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenGenreDescriptions, validateArtistsForImport, mergeHeatRows } from "../../js/import-format.js?v=3.70";

// Varmekartet er ETT dokument. Importen skrev det tidligere rått over, så en
// fil med bare den nye sjangerens rad slettet alle de andre. Disse testene
// låser flette-oppførselen — det er hele vernet mot det datatapet.
test("mergeHeatRows: rader fila ikke nevner, blir stående", () => {
  const current = { Blues: [1, 2, 3], Jazz: [4, 5, 6], Punk: [0, 0, 0] };
  const { heat, written, kept } = mergeHeatRows(current, { Punk: [3, 4, 5] });
  assert.deepEqual(heat, { Blues: [1, 2, 3], Jazz: [4, 5, 6], Punk: [3, 4, 5] });
  assert.deepEqual(written, ["Punk"]);
  assert.deepEqual(kept.sort(), ["Blues", "Jazz"]);
});

test("mergeHeatRows: ny sjanger legges til uten å røre resten", () => {
  const { heat } = mergeHeatRows({ Blues: [1] }, { Punk: [2] });
  assert.deepEqual(heat, { Blues: [1], Punk: [2] });
});

test("mergeHeatRows: full eksport skriver alle radene (uendret oppførsel)", () => {
  const { heat, written } = mergeHeatRows({ Blues: [1], Jazz: [2] }, { Blues: [9], Jazz: [8] });
  assert.deepEqual(heat, { Blues: [9], Jazz: [8] });
  assert.deepEqual(written.sort(), ["Blues", "Jazz"]);
});

test("mergeHeatRows: rader som ikke er lister forkastes, ikke lagres", () => {
  const { heat, skipped } = mergeHeatRows({ Blues: [1] }, { Blues: "tull", Punk: [2] });
  assert.deepEqual(heat, { Blues: [1], Punk: [2] }, "ugyldig rad skal ikke overskrive den gyldige");
  assert.deepEqual(skipped, ["Blues"]);
});

test("mergeHeatRows: tomt/manglende kart sletter ingenting", () => {
  assert.deepEqual(mergeHeatRows({ Blues: [1] }, {}).heat, { Blues: [1] });
  assert.deepEqual(mergeHeatRows({ Blues: [1] }, null).heat, { Blues: [1] });
  assert.deepEqual(mergeHeatRows(null, { Punk: [2] }).heat, { Punk: [2] });
});

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

test("samme navn i to bolker FLETTES — sub-bolken skygger ikke for main-teksten", () => {
  // Håndskrevne/gamle filer kan ha samme sjanger som separate dokumenter i
  // main- og sub-bolken. Da skal nivåfeltene slås sammen, ikke overskrives.
  const nested = {
    meta: {},
    main: { Disco: { main: { description: "lang main-tekst" } } },
    sub: { Disco: { sub: { description: "kort sub-tekst" } } },
  };
  const flat = flattenGenreDescriptions(nested);
  assert.equal(flat.Disco.main.description, "lang main-tekst");
  assert.equal(flat.Disco.sub.description, "kort sub-tekst");
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
