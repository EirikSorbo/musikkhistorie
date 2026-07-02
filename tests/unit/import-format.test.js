import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenGenreDescriptions } from "../../js/import-format.js?v=2.73";

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
