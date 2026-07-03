// ============================================================================
//  REGELTESTER — kjøres mot Firestore-emulatoren
// ----------------------------------------------------------------------------
//  Kjør:  npm run test:rules   (krever `npm install` og Java for emulatoren)
//  Verifiserer at firestore.rules matcher appens faktiske skrivinger — det er
//  denne typen test som fanger drift mellom regelfila og datamodellen.
//
//  Identitetsmodell: studenter er ANONYMT innlogget (uid uten e-postclaim);
//  lærer er Google-innlogget med e-post i isTeacher()-lista.
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

// Uinnlogget klient (skal ikke kunne skrive noe lenger).
function unauthDb() { return env.unauthenticatedContext().firestore(); }
// Anonymt innlogget student: uid uten e-postclaim.
function anonDb(uid = "anon-1") { return env.authenticatedContext(uid).firestore(); }
function teacherDb() {
  return env.authenticatedContext("teacher-uid", { email: "eirik.sorbo@gmail.com" }).firestore();
}
function otherUserDb() {
  return env.authenticatedContext("other-uid", { email: "ikke-laerer@example.com" }).firestore();
}

// Seed et artistdokument utenom reglene.
async function seedArtist(id, extra = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("artists").doc(id)
      .set({ ...studentArtist, status: "active", ...extra });
  });
}

test("alle kan lese artister (også uinnlogget)", async () => {
  await assertSucceeds(unauthDb().collection("artists").get());
});

test("anonym student kan sende inn forslag slik appen skriver det", async () => {
  await assertSucceeds(anonDb().collection("artists").add(studentArtist));
});

test("uinnlogget kan IKKE sende inn forslag", async () => {
  await assertFails(unauthDb().collection("artists").add(studentArtist));
});

test("student kan IKKE sende inn med status active eller uten metaGenre", async () => {
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, status: "active" }));
  const { metaGenre, ...uten } = studentArtist;
  await assertFails(anonDb().collection("artists").add(uten));
});

test("student kan IKKE plante lærer-privilegier ved oppretting", async () => {
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, priority: 3 }));
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, teacherChecked: true }));
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, removedBy: "teacher" }));
});

test("student kan IKKE smugle ukjente felter eller oppblåse dokumentet", async () => {
  // Ukjent felt blokkeres av hasOnly
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, hackerField: "x" }));
  // Overdimensjonert tekstfelt blokkeres av størrelsestaket
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, description: "x".repeat(5001) }));
  // Lærer har ingen slike restriksjoner (import)
  await assertSucceeds(teacherDb().collection("artists").add({ ...studentArtist, description: "x".repeat(5001) }));
});

test("stemme: kan legge til og fjerne EGEN uid", async () => {
  await seedArtist("a1", { votedUpBy: ["c_gammel"] });
  const ref = anonDb("anon-1").collection("artists").doc("a1");
  await assertSucceeds(ref.update({ votedUpBy: ["c_gammel", "anon-1"] }));
  await assertSucceeds(ref.update({ votedUpBy: ["c_gammel"] }));
});

test("stemme: kan IKKE røre andres stemmer eller stemme i bulk", async () => {
  await seedArtist("a2", { votedUpBy: ["c_gammel", "anon-2"] });
  const ref = anonDb("anon-1").collection("artists").doc("a2");
  await assertFails(ref.update({ votedUpBy: [] }));                                   // tømme
  await assertFails(ref.update({ votedUpBy: ["c_gammel"] }));                         // fjerne andres
  await assertFails(ref.update({ votedUpBy: ["c_gammel", "anon-2", "x1", "x2"] }));   // dikte opp
  await assertFails(ref.update({ votedUpBy: ["c_gammel", "anon-2", "anon-9"] }));     // stemme for andre
  await assertFails(ref.update({ votedUpBy: ["anon-1"] }));                           // bytte alt mot egen
});

test("stemme: uinnlogget kan ikke stemme; status/innhold låst for alle unntatt lærer", async () => {
  await seedArtist("a3");
  await assertFails(unauthDb().collection("artists").doc("a3").update({ votedUpBy: ["u1"] }));
  const ref = anonDb("anon-1").collection("artists").doc("a3");
  await assertFails(ref.update({ status: "removed" }));
  await assertFails(ref.update({ name: "Hærverk" }));
  await assertFails(ref.update({ priority: 3 }));
  await assertFails(ref.delete());
});

test("lærer kan endre alt; innlogget ikke-lærer (Google) kan ikke", async () => {
  await seedArtist("a4");
  await assertSucceeds(teacherDb().collection("artists").doc("a4").update({ status: "removed", removedBy: "teacher" }));
  await assertFails(otherUserDb().collection("artists").doc("a4").update({ status: "removed" }));
});

test("kun lærer kan skrive config/decades/genreDescriptions/podcasts", async () => {
  for (const col of ["config", "decades", "genreDescriptions", "podcasts"]) {
    await assertFails(anonDb().collection(col).doc("x").set({ a: 1 }));
    await assertSucceeds(teacherDb().collection(col).doc("x").set({ a: 1 }));
  }
});

test("tech-forslag: anonym kan opprette pending, ikke aktivt; uinnlogget avvises", async () => {
  await assertSucceeds(anonDb().collection("tech").add({ name: "Mikrofon", status: "pending" }));
  await assertFails(anonDb().collection("tech").add({ name: "Mikrofon", status: "active" }));
  await assertFails(unauthDb().collection("tech").add({ name: "Mikrofon", status: "pending" }));
});

test("pendingEdits: anonym kan opprette slik appen skriver det; uinnlogget avvises", async () => {
  await assertSucceeds(anonDb().collection("pendingEdits").add({
    entityType: "subgenre", entityId: "Blues", entityName: "Blues",
    proposedFields: { description: "Ny tekst" }, proposedBy: "Anonym", level: "main",
  }));
  await assertFails(unauthDb().collection("pendingEdits").add({
    entityType: "subgenre", entityId: "Blues", proposedFields: { description: "x" },
  }));
  await assertFails(anonDb().collection("pendingEdits").add({
    entityType: "noe-annet", entityId: "x", proposedFields: {},
  }));
  // Ukjent felt blokkeres av hasOnly
  await assertFails(anonDb().collection("pendingEdits").add({
    entityType: "artist", entityId: "a1", proposedFields: { description: "x" }, hacker: 1,
  }));
});
