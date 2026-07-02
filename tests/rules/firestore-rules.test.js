// ============================================================================
//  REGELTESTER — kjøres mot Firestore-emulatoren
// ----------------------------------------------------------------------------
//  Kjør:  npm run test:rules   (krever `npm install` og Java for emulatoren)
//  Verifiserer at firestore.rules matcher appens faktiske skrivinger — det er
//  denne typen test som fanger drift mellom regelfila og datamodellen.
// ============================================================================

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

let env;

// Samme form som store.js buildArtistDoc skriver for en student.
const studentArtist = {
  name: "Robert Johnson",
  birthYear: 1911, deathYear: 1938, gender: "mann",
  metaGenre: "Blues", instrument: "Gitar",
  mainGenre: ["Blues"], subGenre: ["Delta blues"],
  influenceStart: 1936, influenceEnd: 1938,
  recordLabel: "", geography: "Mississippi Delta", description: "Viktig.",
  keyWorks: [], musicExamples: [], kilder: [{ text: "Ward 1998" }],
  imageUrl: "", imageCredit: "",
  proposedBy: "Student", status: "pending", removedBy: null,
  teacherChecked: false, priority: 0, votedUpBy: [], addedYear: 2026,
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "pensum-rules-test",
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") },
  });
});

after(async () => { await env.cleanup(); });

function studentDb() { return env.unauthenticatedContext().firestore(); }
function teacherDb() {
  return env.authenticatedContext("teacher-uid", { email: "eirik.sorbo@gmail.com" }).firestore();
}
function otherUserDb() {
  return env.authenticatedContext("other-uid", { email: "ikke-laerer@example.com" }).firestore();
}

test("student kan lese artister", async () => {
  await assertSucceeds(studentDb().collection("artists").get());
});

test("student kan sende inn forslag slik appen skriver det", async () => {
  await assertSucceeds(studentDb().collection("artists").add(studentArtist));
});

test("student kan IKKE sende inn med status active", async () => {
  await assertFails(studentDb().collection("artists").add({ ...studentArtist, status: "active" }));
});

test("student kan IKKE sende inn uten metaGenre", async () => {
  const { metaGenre, ...uten } = studentArtist;
  await assertFails(studentDb().collection("artists").add(uten));
});

test("student kan stemme (votedUpBy), men ikke endre status eller innhold", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("artists").doc("a1")
      .set({ ...studentArtist, status: "active" });
  });
  const ref = studentDb().collection("artists").doc("a1");
  await assertSucceeds(ref.update({ votedUpBy: ["c_123"] }));
  await assertFails(ref.update({ status: "removed" }));
  await assertFails(ref.update({ name: "Hærverk" }));
  await assertFails(ref.update({ priority: 3 }));
  await assertFails(ref.delete());
});

test("lærer kan endre alt; innlogget ikke-lærer kan ikke", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("artists").doc("a2")
      .set({ ...studentArtist, status: "active" });
  });
  await assertSucceeds(teacherDb().collection("artists").doc("a2").update({ status: "removed", removedBy: "teacher" }));
  await assertFails(otherUserDb().collection("artists").doc("a2").update({ status: "removed" }));
});

test("kun lærer kan skrive config/decades/genreDescriptions/podcasts", async () => {
  for (const col of ["config", "decades", "genreDescriptions", "podcasts"]) {
    await assertFails(studentDb().collection(col).doc("x").set({ a: 1 }));
    await assertSucceeds(teacherDb().collection(col).doc("x").set({ a: 1 }));
  }
});

test("student kan foreslå nytt tech-kort (pending), men ikke aktivt", async () => {
  await assertSucceeds(studentDb().collection("tech").add({ name: "Mikrofon", status: "pending" }));
  await assertFails(studentDb().collection("tech").add({ name: "Mikrofon", status: "active" }));
});

test("student kan opprette pendingEdit slik appen skriver det", async () => {
  await assertSucceeds(studentDb().collection("pendingEdits").add({
    entityType: "subgenre", entityId: "Blues", entityName: "Blues",
    proposedFields: { description: "Ny tekst" }, proposedBy: "Anonym", level: "main",
  }));
  await assertFails(studentDb().collection("pendingEdits").add({
    entityType: "noe-annet", entityId: "x", proposedFields: {},
  }));
});
