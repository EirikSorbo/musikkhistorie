import { test } from "node:test";
import assert from "node:assert/strict";
import { diffFields, renderEditDiff } from "../../js/ui-edit.js?v=5.36";

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

// Diff-cellene for objektrader (v5.34, audit-funn 14): etikett + url alene
// skjulte endringer i sjanger, årstall, lytteanvisning, forfatter og kategori.
// Diffen viste to identiske kolonner, og læreren godkjente i blinde.
test("renderEditDiff: endret sjanger på et lytteeksempel synes i begge kolonnene", () => {
  const html = renderEditDiff("artist",
    { musicExamples: [{ title: "Hoochie Coochie Man", url: "https://ex.com/h", genre: "Blues" }] },
    { musicExamples: [{ title: "Hoochie Coochie Man", url: "https://ex.com/h", genre: "Chicago blues" }] });
  const celle = (klasse) => html.match(new RegExp(`<td class="${klasse}">([\\s\\S]*?)</td>`))?.[1] || "";
  assert.notEqual(celle("diff-current"), celle("diff-proposed"), "kolonnene må kunne skilles");
  assert.match(celle("diff-current"), /Blues/);
  assert.match(celle("diff-proposed"), /Chicago blues/);
  assert.match(celle("diff-proposed"), /https:\/\/ex\.com\/h/, "lenken står fortsatt i klartekst");
});
