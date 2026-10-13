// Navnebytte på en fri undersjanger (v6.90, brukervalg 2026-10-13): «Motown»
// ble «Motown Sound», så undersjangeren ikke lenger deler navn med
// plateselskapet. planSubRename er ren planlegging; skrivingen gjør
// runMigrationPlan (én atomisk batch).
import { test } from "node:test";
import assert from "node:assert/strict";
import { planSubRename } from "../../js/sjangre/genre-migrate.js";

const STATE = {
  tree: { nodes: [{ id: "soul", l: "Soul", g: "R&B", p: [] }] },
  artists: [
    { id: "a1", name: "Marvin Gaye", mainGenre: ["Soul"], subGenre: ["Motown"], teacherChecked: true },
    { id: "a2", name: "Stevie Wonder", mainGenre: ["Soul", "Funk"], subGenre: ["Motown", "Psychedelic soul"],
      musicExamples: [{ title: "x", genre: "Motown" }, { title: "y", genre: "Funk" }] },
    { id: "a3", name: "Otis Redding", mainGenre: ["Soul"], subGenre: ["Southern soul"] },
  ],
  genreDescs: { Motown: { id: "Motown", sub: { description: "Soul-lyden fra Motown.", kilder: [] } } },
  teacherChecks: { subgenres: ["Doo-wop", "Motown"] },
  pendingEdits: [
    { id: "p1", entityType: "subgenre", entityId: "Motown", entityName: "Motown", level: "sub" },
    { id: "p2", entityType: "artist", entityId: "a3", entityName: "Otis Redding", proposedFields: { subGenre: ["Motown"] } },
    { id: "p3", entityType: "artist", entityId: "a1", proposedFields: { description: "ny" } },
  ],
  notater: { "undersjanger:Motown": { tekst: "Husk Hitsville", oppdatert: "2026-10-01" } },
  content: { presentasjoner: { planer: {} } },
};

const finn = (plan, coll, id) => plan.ops.filter((o) => o.coll === coll && o.id === id);

test("Motown blir Motown Sound: beskrivelse, tagger, eksempler, sjekk, forslag og notat følger med", () => {
  const plan = planSubRename(STATE, "Motown", "Motown Sound");
  assert.deepEqual(plan.feil, []);

  assert.deepEqual(finn(plan, "genreDescriptions", "Motown Sound")[0].data, { sub: STATE.genreDescs.Motown.sub });
  assert.equal(finn(plan, "genreDescriptions", "Motown")[0].type, "doc.delete");

  assert.deepEqual(finn(plan, "artists", "a1")[0].data, { subGenre: ["Motown Sound"] });
  const a2 = finn(plan, "artists", "a2")[0].data;
  assert.deepEqual(a2.subGenre, ["Motown Sound", "Psychedelic soul"]);
  assert.equal(a2.mainGenre, undefined, "mainGenre har ikke taggen og skrives ikke");
  assert.deepEqual(a2.musicExamples.map((m) => m.genre), ["Motown Sound", "Funk"]);
  assert.equal(finn(plan, "artists", "a3").length, 0);
  // Sjekken på artistkortene røres ikke: bare navnet på taggen endres.
  for (const o of plan.ops.filter((x) => x.coll === "artists")) assert.equal("teacherChecked" in o.data, false);

  assert.deepEqual(finn(plan, "config", "teacherChecks")[0].data, { subgenres: ["Doo-wop", "Motown Sound"] });
  assert.deepEqual(finn(plan, "pendingEdits", "p1")[0].data, { entityId: "Motown Sound", entityName: "Motown Sound" });
  assert.deepEqual(finn(plan, "pendingEdits", "p2")[0].data.proposedFields.subGenre, ["Motown Sound"]);
  assert.equal(finn(plan, "pendingEdits", "p3").length, 0);

  assert.deepEqual(finn(plan, "notater", "undersjanger:Motown%20Sound")[0].data, STATE.notater["undersjanger:Motown"]);
  assert.equal(finn(plan, "notater", "undersjanger:Motown")[0].type, "doc.delete");
});

test("et dokument med andre nivåer beholdes, bare sub-feltet flyttes", () => {
  const state = { ...STATE, genreDescs: { Motown: { sub: { description: "s" }, story: { body: "h" } } } };
  const plan = planSubRename(state, "Motown", "Motown Sound");
  assert.deepEqual(finn(plan, "genreDescriptions", "Motown")[0], {
    type: "field.delete", coll: "genreDescriptions", id: "Motown", data: { felt: "sub" },
    hva: "«Motown» beholdes for de andre nivåene på samme navn",
  });
});

test("avviser treets sjangre, kollisjoner og tomme eller ulovlige navn", () => {
  assert.match(planSubRename(STATE, "Soul", "Soul music").feil.join(" "), /sjanger i treet/);
  assert.match(planSubRename(STATE, "Motown", "Soul").feil.join(" "), /allerede navnet på en sjanger i treet/);
  assert.match(planSubRename(STATE, "Motown", "R&B").feil.join(" "), /allerede navnet på en sjanger i treet/);
  assert.match(planSubRename(STATE, "Motown", "Southern soul").feil.join(" "), /finnes allerede som undersjanger/);
  assert.match(planSubRename(STATE, "Motown", "").feil.join(" "), /tomt/);
  assert.match(planSubRename(STATE, "Motown", "Motown/Tamla").feil.join(" "), /«\/»/);
  assert.match(planSubRename(STATE, "Finnes ikke", "Noe").feil.join(" "), /Fant ingen undersjanger/);
  assert.match(planSubRename(STATE, "Motown", "Motown").feil.join(" "), /det samme som det gamle/);
});

test("stopp i kjøreplanene skrives ikke om, men nevnes", () => {
  const state = { ...STATE, content: { presentasjoner: { planer: { x: { stopp: [{ vis: "undersjanger:Motown" }] } } } } };
  assert.match(planSubRename(state, "Motown", "Motown Sound").advarsler.join(" "), /1 stopp i kjøreplanene/);
});
