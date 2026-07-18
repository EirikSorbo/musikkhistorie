import { test } from "node:test";
import assert from "node:assert/strict";
import { diffFields } from "../../js/ui-edit.js?v=3.65";

test("diffFields: kun endrede felter tas med", () => {
  const current = { name: "X", birthYear: 1930, mainGenre: ["Blues"] };
  const proposed = { name: "X", birthYear: 1931, mainGenre: ["Blues"] };
  assert.deepEqual(diffFields(current, proposed), { birthYear: 1931 });
});

test("diffFields: null/undefined/tom streng regnes som likt", () => {
  assert.deepEqual(diffFields({ recordLabel: null }, { recordLabel: "" }), {});
  assert.deepEqual(diffFields({}, { recordLabel: "" }), {});
  assert.deepEqual(diffFields({ influenceEnd: undefined }, { influenceEnd: null }), {});
});

test("diffFields: arrays sammenlignes dypt", () => {
  assert.deepEqual(diffFields({ subGenre: ["a", "b"] }, { subGenre: ["a", "b"] }), {});
  assert.deepEqual(diffFields({ subGenre: ["a"] }, { subGenre: ["a", "b"] }), { subGenre: ["a", "b"] });
});

test("diffFields: objekt-arrays (verk) sammenlignes dypt", () => {
  const cur = { keyWorks: [{ title: "A", year: 1950 }] };
  assert.deepEqual(diffFields(cur, { keyWorks: [{ title: "A", year: 1950 }] }), {});
  assert.deepEqual(
    diffFields(cur, { keyWorks: [{ title: "A", year: 1951 }] }),
    { keyWorks: [{ title: "A", year: 1951 }] }
  );
});
