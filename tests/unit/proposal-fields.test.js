import { test } from "node:test";
import assert from "node:assert/strict";
import { PROPOSABLE_KEYS, proposableKeysFor } from "../../js/proposal-fields.js?v=2.91";

// Privilegie-/systemfelter som ALDRI skal kunne skrives via et endringsforslag.
const FORBIDDEN = ["status", "priority", "votedUpBy", "teacherChecked", "proposedBy", "removedBy", "addedYear", "createdAt"];

test("artist-hvitelisten utelater alle privilegiefelter", () => {
  for (const key of FORBIDDEN) {
    assert.equal(PROPOSABLE_KEYS.artist.includes(key), false, `artist skal ikke tillate ${key}`);
  }
});

test("artist-hvitelisten inneholder de reelle innholdsfeltene", () => {
  for (const key of ["name", "description", "mainGenre", "metaGenre", "influenceStart", "imageUrl"]) {
    assert.equal(PROPOSABLE_KEYS.artist.includes(key), true, `artist skal tillate ${key}`);
  }
  // complex-felter foreslås ikke via editoren
  for (const key of ["keyWorks", "musicExamples", "kilder"]) {
    assert.equal(PROPOSABLE_KEYS.artist.includes(key), false, `artist skal ikke tillate complex-felt ${key}`);
  }
});

test("tech/subgenre/decade-hvitelistene utelater status og andre systemfelter", () => {
  assert.equal(PROPOSABLE_KEYS.tech.includes("status"), false);
  assert.deepEqual(PROPOSABLE_KEYS.subgenre, ["description"]);
  assert.deepEqual(PROPOSABLE_KEYS["decade-society"], ["society", "societyMore"]);
  assert.deepEqual(PROPOSABLE_KEYS["decade-tech"], ["tech", "techMore"]);
});

test("proposableKeysFor gir tom liste for ukjent entityType", () => {
  assert.deepEqual(proposableKeysFor("finnes-ikke"), []);
});
