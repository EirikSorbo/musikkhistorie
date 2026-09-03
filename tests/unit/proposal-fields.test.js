import { test } from "node:test";
import assert from "node:assert/strict";
import { PROPOSABLE_KEYS, proposableKeysFor } from "../../js/proposal-fields.js?v=5.10";

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
  // v5.00: rad-feltene er foreslåbare. Uten dem kunne en student ikke foreslå
  // et lytteeksempel til en artist som allerede lå inne.
  for (const key of ["keyWorks", "musicExamples", "kilder"]) {
    assert.equal(PROPOSABLE_KEYS.artist.includes(key), true, `artist skal tillate rad-feltet ${key}`);
  }
});

test("tech/subgenre/decade-hvitelistene utelater status og andre systemfelter", () => {
  assert.equal(PROPOSABLE_KEYS.tech.includes("status"), false);
  // v4.97: BEGGE årstallene må være foreslåbare. Fram til da sto kun
  // adoptedYear i lista, med etiketten «Oppfunnet» i skjemaet — en student som
  // rettet oppfinnelsesåret skrev i praksis til året kortet plasseres etter på
  // teknologitidslinjen. Holdes i synk med FIELD_SPECS.tech og firestore.rules
  // (BÅDE tech-create og pendingEdits-create).
  for (const key of ["inventedYear", "adoptedYear", "adoptedLabel"]) {
    assert.equal(PROPOSABLE_KEYS.tech.includes(key), true, `tech skal tillate ${key}`);
  }
  // Sjangre: beskrivelse, epoke-årstallene og kilder er foreslåbare — men
  // ingen systemfelter. Holdes i synk med FIELD_SPECS.subgenre i proposals.js.
  assert.deepEqual(PROPOSABLE_KEYS.subgenre, ["description", "kilder", "activeFrom", "activeTo", "era"]);
  for (const key of FORBIDDEN) {
    assert.equal(PROPOSABLE_KEYS.subgenre.includes(key), false, `subgenre skal ikke tillate ${key}`);
  }
  // «Les mer»-feltene ble fjernet i v4.78 (kildehenvisningene overtok rollen)
  // og slettet helt i v4.93 — de finnes ikke lenger i data, eksport eller kode.
  assert.deepEqual(PROPOSABLE_KEYS["decade-society"], ["society"]);
  assert.deepEqual(PROPOSABLE_KEYS["decade-tech"], ["tech"]);
});

test("proposableKeysFor gir tom liste for ukjent entityType", () => {
  assert.deepEqual(proposableKeysFor("finnes-ikke"), []);
});

// Navnet på den som foreslår er PÅKREVD i ALLE studentflatene (brukervalg
// 2026-09-02): læreren skal kunne gå i dialog med den som sendte inn. Kravet
// bor i tre innsendingsstier og kan ikke enhetstestes (de leser DOM), så vi
// låser kilden — samme grep som instrument-groups.test.js bruker.
test("navnet er påkrevd i alle tre studentflatene", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");

  // 1) Nytt artistforslag (student.html)
  const student = les("student.js");
  assert.match(student, /if \(!candidate\.proposedBy\)/,
    "student.js mangler vakten for forslagsstillerens navn");
  assert.doesNotMatch(student, /#in-by"\)\.value\.trim\(\) \|\| "Anonym"/,
    "student.js skal ikke lenger falle tilbake på «Anonym» ved innsending");

  // 2 og 3) Endring på eksisterende kort OG helt nytt kort deler samme vakt.
  const proposals = les("proposals.js");
  assert.match(proposals, /function lesForslagsstiller\(\)/,
    "proposals.js mangler den delte navnevakten");
  assert.equal((proposals.match(/lesForslagsstiller\(\);/g) || []).length, 2,
    "begge forslagsflytene må kalle vakten — endring OG nytt kort");
  assert.doesNotMatch(proposals, /prop-by"\)\.value\.trim\(\) \|\| "Anonym"/,
    "proposals.js skal ikke lenger falle tilbake på «Anonym» ved innsending");

  // Datalaget beholder BEVISST sin fallback: gamle og importerte rader har
  // «Anonym» lagret, og de skal fortsatt vises.
  const store = fs.readFileSync(new URL("../../js/store.js", import.meta.url), "utf8");
  assert.match(store, /proposedBy \|\| "Anonym"/,
    "store.js skal beholde fallbacken for eldre data");
});
