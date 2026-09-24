// ============================================================================
//  REGELTESTER — kjøres mot Firestore-emulatoren
// ----------------------------------------------------------------------------
//  Kjør:  npm run test:rules   (krever `npm install` og Java for emulatoren)
//  Kjøres også av GitHub Actions ved hver push (.github/workflows/tester.yml).
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
// Klienten skriver createdAt som serverTimestamp() (store.js). Kontekstene fra
// rules-unit-testing er compat-instanser, så sentinelen hentes derfra.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const serverTs = () => firebase.firestore.FieldValue.serverTimestamp();

// Regelteksten uten kommentarer, for testene som henter feltlister fra den.
const REGLER = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
const FORSLAG_REGLER = REGLER.slice(REGLER.indexOf("match /pendingEdits/"));
const FORSLAG_STRENGER = [...FORSLAG_REGLER.matchAll(/\bcapOk\("([^"]+)"/g)].map((m) => m[1]);

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
  // Avsenderens anonyme uid (v5.13) — reglene krever egen eller tom.
  ownerUid: "anon-1",
};

before(async () => {
  env = await initializeTestEnvironment({
    // Samme demo-prosjekt som `firebase emulators:exec --project demo-pensum`
    // (package.json): et annet navn ga bare advarsler, men forvirrende logg.
    projectId: "demo-pensum",
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

// Typevaktene (v5.34, audit-funn 9 + 10): i regelspråket har både map og liste
// en size() (antall nøkler/elementer), så takene alene kunne omgås ved å sende
// et strengfelt som map med ÉN nøkkel som bærer ~1 MB. Årstallene og createdAt
// sto dessuten i hvitelistene uten tak i det hele tatt. Positive kontroller er
// testene over og under: appens egne skriveformer går fortsatt gjennom.
test("typevakter: map/liste/streng i feil felt avvises i alle tre samlingene", async () => {
  const stor = "x".repeat(9000);
  // Strengfelt som map eller liste: size() ville gitt 1.
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, description: { a: stor } }));
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, geography: [stor] }));
  // Listefelt som map.
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, keyWorks: { a: stor } }));
  // Årstall som streng (funn 10): feltet hadde ikke engang et tak.
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, birthYear: stor }));
  await assertFails(anonDb().collection("artists").add({ ...studentArtist, createdAt: stor }));
  await assertFails(anonDb().collection("tech").add({ name: "Mikrofon", status: "pending", inventedYear: stor }));
  await assertFails(anonDb().collection("tech").add({ name: "Mikrofon", status: "pending", createdAt: stor }));
  await assertFails(anonDb().collection("tech").add({ name: "Mikrofon", status: "pending", description: { a: stor } }));
  // Samme hull i forslagsflaten (capOk/capListOk/pfTallOk).
  await assertFails(anonDb().collection("pendingEdits").add({
    entityType: "artist", entityId: "a1", proposedFields: { description: { a: stor } }, proposedBy: "Anonym",
  }));
  await assertFails(anonDb().collection("pendingEdits").add({
    entityType: "artist", entityId: "a1", proposedFields: { kilder: { a: stor } }, proposedBy: "Anonym",
  }));
  await assertFails(anonDb().collection("pendingEdits").add({
    entityType: "artist", entityId: "a1", proposedFields: { birthYear: stor }, proposedBy: "Anonym",
  }));
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

test("kun lærer kan skrive config/decades/genreDescriptions/podcasts/content", async () => {
  for (const col of ["config", "decades", "genreDescriptions", "podcasts", "content"]) {
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

// Aksept-stier for ALLE entityTypene, med de faktiske skriveformene fra
// proposals.js (readField: tekst → streng, tall → tall/null, kilder → liste av
// { text, url }). Fanger at feltmaks-/hviteliste-stramming aldri avviser et
// legitimt forslag.
test("pendingEdits: alle entityTyper kan opprettes slik editoren skriver dem", async () => {
  const db = anonDb();
  await assertSucceeds(db.collection("pendingEdits").add({
    entityType: "artist", entityId: "a1", entityName: "Robert Johnson",
    proposedFields: { name: "Robert Johnson", birthYear: 1911, mainGenre: ["Blues"], geography: "Mississippi Delta", imageUrl: "https://ex.com/b.jpg" },
    proposedBy: "Anonym",
  }));
  await assertSucceeds(db.collection("pendingEdits").add({
    entityType: "subgenre", entityId: "Cont. hip-hop", entityName: "Contemporary hip-hop",
    proposedFields: { description: "Ny tekst", kilder: [{ text: "SNL", url: "https://snl.no" }], activeFrom: 1994, activeTo: null },
    proposedBy: "Anonym", level: "main",
  }));
  await assertSucceeds(db.collection("pendingEdits").add({
    entityType: "tech", entityId: "t1", entityName: "Mikrofon",
    proposedFields: { type: "hendelse", instrument: "Gitar", adoptedYear: 1931, adoptedLabel: "tidlig 1930-tall", kilder: [{ text: "SNL", url: "" }] },
    proposedBy: "Anonym",
  }));
  await assertSucceeds(db.collection("pendingEdits").add({
    entityType: "instrument", entityId: "instrument-gitar", entityName: "Gitarens utvikling",
    proposedFields: { body: "x".repeat(19000) }, proposedBy: "Anonym",
  }));
  await assertSucceeds(db.collection("pendingEdits").add({
    entityType: "decade-society", entityId: "1950", entityName: "1950-tallet — samfunn",
    proposedFields: { society: "x".repeat(19000) }, proposedBy: "Anonym",
  }));
  await assertSucceeds(db.collection("pendingEdits").add({
    entityType: "decade-tech", entityId: "1950", entityName: "1950-tallet — teknologi",
    proposedFields: { tech: "Ny tekst" }, proposedBy: "Anonym",
  }));
});

test("pendingEdits: ukjent proposedFields-nøkkel og oppblåste felter avvises", async () => {
  const db = anonDb();
  const base = { entityType: "subgenre", entityId: "Blues", proposedBy: "Anonym", level: "main" };
  // Nøkkel utenfor PROPOSABLE_KEYS-unionen — kunne ellers båret ~1 MB tekst.
  await assertFails(db.collection("pendingEdits").add({ ...base, proposedFields: { smuglet: "x".repeat(100) } }));
  await assertFails(db.collection("pendingEdits").add({ ...base, proposedFields: { description: "x".repeat(5001) } }));
  await assertFails(db.collection("pendingEdits").add({ ...base, proposedFields: { kilder: Array.from({ length: 51 }, () => ({ text: "k" })) } }));
  await assertFails(db.collection("pendingEdits").add({
    entityType: "decade-society", entityId: "1950", proposedBy: "Anonym",
    proposedFields: { society: "x".repeat(20001) },
  }));
  await assertFails(db.collection("pendingEdits").add({
    entityType: "instrument", entityId: "instrument-gitar", proposedBy: "Anonym",
    proposedFields: { body: "x".repeat(20001) },
  }));
  await assertFails(db.collection("pendingEdits").add({
    entityType: "artist", entityId: "a1", proposedBy: "Anonym",
    proposedFields: { imageUrl: "https://ex.com/" + "x".repeat(2000) },
  }));
});


// ============================================================================
//  RETURFLYTEN (v5.13) — audit v5.19 funn 12: reglene fikk en helt ny anonym
//  skrivevei (kode som bevis), uten en eneste test. Disse låser den, med de
//  faktiske skriveformene fra store.js (resubmitArtist/Tech/PendingEdit).
// ============================================================================

const RETUR = { status: "returnert", returKode: "AB2CD", teacherFeedback: "Utdyp kildene.", ownerUid: "anon-1" };

// Nøyaktig det resubmitArtist skriver (v5.31: KUN feltene studentskjemaet
// har — recordLabel er lærerens felt og sendes ikke).
function artistResubmit(kode) {
  const {
    recordLabel, proposedBy, status, removedBy, teacherChecked, priority,
    votedUpBy, addedYear, ownerUid, ...skjema
  } = studentArtist;
  return { ...skjema, proposedBy: "Student", status: "pending", innsendtKode: kode, studentComment: "Rettet." };
}

async function seedTech(id, extra = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("tech").doc(id).set({
      name: "Mikrofon", type: "innovasjon", category: "Opptak og avspilling",
      instrument: "", decade: "1930", description: "Kort.", kilder: [],
      imageUrl: "", imageCredit: "", proposedBy: "Student", status: "pending",
      ...extra,
    });
  });
}

async function seedPendingEdit(id, extra = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("pendingEdits").doc(id).set({
      entityType: "artist", entityId: "a1", entityName: "Robert Johnson",
      proposedFields: { description: "Gammel tekst" }, proposedBy: "Anonym",
      ...extra,
    });
  });
}

test("retur (artist): riktig kode fra en ANNEN enhet gir ny innsending", async () => {
  await seedArtist("r1", RETUR);
  // anon-99 er en annen uid enn ownerUid — koden er beviset, ikke uid-en.
  await assertSucceeds(anonDb("anon-99").collection("artists").doc("r1").update(artistResubmit("AB2CD")));
});

test("retur (artist): feil, tom eller manglende kode avvises — også for eieren", async () => {
  await seedArtist("r2", RETUR);
  const ref = (uid) => anonDb(uid).collection("artists").doc("r2");
  await assertFails(ref("anon-1").update(artistResubmit("FEIL1")));
  await assertFails(ref("anon-1").update(artistResubmit("")));
  const utenKode = artistResubmit("AB2CD");
  delete utenKode.innsendtKode;
  await assertFails(ref("anon-1").update(utenKode));
  await assertFails(unauthDb().collection("artists").doc("r2").update(artistResubmit("AB2CD")));
});

test("retur (artist): bare fra «returnert», bare til «pending» — en brukt kode er død", async () => {
  // Status alt tilbake til pending (koden er brukt): ny innsending avvises.
  await seedArtist("r3", { ...RETUR, status: "pending" });
  await assertFails(anonDb("anon-1").collection("artists").doc("r3").update(artistResubmit("AB2CD")));
  // Og målstatusen kan aldri være noe annet enn pending.
  await seedArtist("r4", RETUR);
  await assertFails(anonDb("anon-1").collection("artists").doc("r4")
    .update({ ...artistResubmit("AB2CD"), status: "active" }));
});

test("retur (artist): lærerens felter, stemmer, privilegier og ownerUid er urørlige", async () => {
  await seedArtist("r5", RETUR);
  const ref = anonDb("anon-1").collection("artists").doc("r5");
  for (const smuglet of [
    { returKode: "NY123" },
    { teacherFeedback: "" },
    { votedUpBy: ["anon-1"] },
    { priority: 3 },
    { teacherChecked: true },
    { ownerUid: "anon-99" },
  ]) {
    await assertFails(ref.update({ ...artistResubmit("AB2CD"), ...smuglet }));
  }
});

test("retur (artist): innholdskrav og tegntak gjelder også ny innsending", async () => {
  await seedArtist("r6", RETUR);
  const ref = anonDb("anon-1").collection("artists").doc("r6");
  await assertFails(ref.update({ ...artistResubmit("AB2CD"), description: "x".repeat(5001) }));
  await assertFails(ref.update({ ...artistResubmit("AB2CD"), name: "" }));
});

test("retur (artist): create kan ikke plante retur-feltene, og ownerUid må være egen", async () => {
  const db = anonDb("anon-1");
  await assertFails(db.collection("artists").add({ ...studentArtist, returKode: "AB2CD" }));
  await assertFails(db.collection("artists").add({ ...studentArtist, status: "returnert" }));
  await assertFails(db.collection("artists").add({ ...studentArtist, ownerUid: "anon-99" }));
  await assertSucceeds(db.collection("artists").add({ ...studentArtist, ownerUid: "" }));
});

test("retur: «send tilbake» er en lærerhandling i alle tre samlingene", async () => {
  await seedArtist("r7");
  await seedTech("t7", { status: "pending" });
  await seedPendingEdit("p7");
  const retur = { status: "returnert", returKode: "XY9ZW", teacherFeedback: "Utdyp." };
  await assertFails(anonDb("anon-1").collection("artists").doc("r7").update(retur));
  await assertFails(anonDb("anon-1").collection("tech").doc("t7").update(retur));
  await assertFails(anonDb("anon-1").collection("pendingEdits").doc("p7").update(retur));
  await assertSucceeds(teacherDb().collection("artists").doc("r7").update(retur));
  await assertSucceeds(teacherDb().collection("tech").doc("t7").update(retur));
  await assertSucceeds(teacherDb().collection("pendingEdits").doc("p7").update(retur));
});

test("retur (tech): resubmitTech-formen går gjennom, feil kode og fremmede felter ikke", async () => {
  await seedTech("t1", RETUR);
  const nyInnsending = {
    name: "Kondensatormikrofonen", type: "innovasjon", category: "Opptak og avspilling",
    instrument: "", decade: "1930", description: "Utdypet tekst.", kilder: [{ text: "SNL" }],
    imageUrl: "", imageCredit: "",
    proposedBy: "Student", status: "pending", innsendtKode: "AB2CD", studentComment: "Rettet.",
  };
  await assertSucceeds(anonDb("anon-99").collection("tech").doc("t1").update(nyInnsending));
  await seedTech("t2", RETUR);
  await assertFails(anonDb("anon-1").collection("tech").doc("t2").update({ ...nyInnsending, innsendtKode: "FEIL1" }));
  await assertFails(anonDb("anon-1").collection("tech").doc("t2").update({ ...nyInnsending, returKode: "NY123" }));
  await assertFails(anonDb("anon-1").collection("tech").doc("t2").update({ ...nyInnsending, description: "x".repeat(5001) }));
});

test("retur (pendingEdits): til «open», aldri «returnert» ved create, koden er beviset", async () => {
  await seedPendingEdit("p1", { ...RETUR, returKode: "CD3EF" });
  const nyInnsending = {
    proposedFields: { description: "Ny og bedre tekst" },
    proposedBy: "Anonym", status: "open", innsendtKode: "CD3EF", studentComment: "Fikset.",
  };
  await assertSucceeds(anonDb("anon-99").collection("pendingEdits").doc("p1").update(nyInnsending));
  await seedPendingEdit("p2", { ...RETUR, returKode: "CD3EF" });
  const ref = anonDb("anon-1").collection("pendingEdits").doc("p2");
  await assertFails(ref.update({ ...nyInnsending, innsendtKode: "FEIL1" }));
  await assertFails(ref.update({ ...nyInnsending, status: "pending" }));
  await assertFails(ref.update({ ...nyInnsending, proposedFields: { description: "x".repeat(5001) } }));
  // Create kan ikke plante status «returnert» (ville forfalsket returSporring):
  // status står ikke i create-hvitelisten i det hele tatt.
  await assertFails(anonDb("anon-1").collection("pendingEdits").add({
    entityType: "artist", entityId: "a1", proposedFields: { description: "x" },
    proposedBy: "Anonym", status: "returnert",
  }));
});


// ============================================================================
//  AUDIT v5.42, funn 25 og 43–47: typevaktene per kallplass, klientens eksakte
//  nyttelaster, returvaktene i ALLE tre samlingene, tak og ownerUid.
//  NB: skrevet uten at emulatoren har kjørt (Java mangler). Første kjøring kan
//  gi røde tester; les dem som funn, ikke som støy.
// ============================================================================

// Nøyaktig det addTechProposal (store.js) skriver for et skjema fylt ut
// slik proposals.js leser det: tall eller null i årstallene, kilder som
// { text, url }, tomme strenger for tomme tekstfelt.
function klientTech(extra = {}) {
  return {
    type: "innovasjon", name: "Kondensatormikrofonen", category: "Opptak og avspilling",
    instrument: "", decade: "1930", inventedYear: 1916, adoptedYear: null,
    adoptedLabel: "tidlig 1930-tall", description: "Kort.", kilder: [{ text: "SNL", url: "" }],
    imageUrl: "", imageCredit: "", proposedBy: "Ola",
    status: "pending", ownerUid: "anon-1", createdAt: serverTs(),
    ...extra,
  };
}

// Nøyaktig det addPendingEdit skriver.
function klientForslag(extra = {}) {
  return {
    entityType: "artist", entityId: "a1", entityName: "Robert Johnson",
    proposedFields: { description: "Ny tekst" }, proposedBy: "Ola",
    ownerUid: "anon-1", createdAt: serverTs(),
    ...extra,
  };
}

test("funn 43: klientens eksakte skriveformer går gjennom i alle tre samlingene", async () => {
  const db = anonDb("anon-1");
  await assertSucceeds(db.collection("artists").add({ ...studentArtist, createdAt: serverTs() }));
  await assertSucceeds(db.collection("tech").add(klientTech()));
  await assertSucceeds(db.collection("pendingEdits").add(klientForslag()));
  await assertSucceeds(db.collection("pendingEdits").add(klientForslag({
    entityType: "subgenre", entityId: "Blues", entityName: "Blues", level: "main",
    proposedFields: { description: "x", era: "1920-tallet", activeFrom: 1920, activeTo: null },
  })));
});

test("funn 43: hver typevakt holder på hver kallplass (map, liste eller streng i feil felt)", async () => {
  const stor = "x".repeat(9000);
  const db = anonDb("anon-1");
  const artistStreng = ["description", "imageUrl", "proposedBy", "geography", "recordLabel", "instrument", "gender", "imageCredit"];
  const artistListe = ["mainGenre", "subGenre", "keyWorks", "musicExamples", "kilder"];
  const artistTall = ["birthYear", "deathYear", "influenceEnd", "addedYear"];
  for (const f of artistStreng) {
    await assertFails(db.collection("artists").add({ ...studentArtist, [f]: { a: stor } }));
    await assertFails(db.collection("artists").add({ ...studentArtist, [f]: [stor] }));
  }
  const artistListeTak = { mainGenre: 20, subGenre: 20, keyWorks: 50, musicExamples: 50, kilder: 50 };
  for (const f of artistListe) {
    await assertFails(db.collection("artists").add({ ...studentArtist, [f]: { a: stor } }));
    await assertFails(db.collection("artists").add({ ...studentArtist, [f]: Array.from({ length: artistListeTak[f] + 1 }, () => "x") }));
  }
  for (const f of artistTall) {
    await assertFails(db.collection("artists").add({ ...studentArtist, [f]: "1950" }));
  }
  const techStreng = ["description", "imageUrl", "proposedBy", "type", "category", "instrument", "decade", "adoptedLabel", "imageCredit"];
  for (const f of techStreng) {
    await assertFails(db.collection("tech").add(klientTech({ [f]: { a: stor } })));
    await assertFails(db.collection("tech").add(klientTech({ [f]: [stor] })));
  }
  await assertFails(db.collection("tech").add(klientTech({ kilder: { a: stor } })));
  await assertFails(db.collection("tech").add(klientTech({ kilder: Array.from({ length: 21 }, () => ({ text: "k" })) })));
  for (const f of ["inventedYear", "adoptedYear"]) {
    await assertFails(db.collection("tech").add(klientTech({ [f]: "1950" })));
  }
  // pendingEdits: proposedFields per hjelper.
  // ALLE capOk-feltene, hentet fra reglene (kontrollrunden for v5.46).
  assert.ok(FORSLAG_STRENGER.length >= 17, `fant bare ${FORSLAG_STRENGER.length} capOk-felt i pendingEdits`);
  for (const f of FORSLAG_STRENGER) {
    await assertFails(db.collection("pendingEdits").add(klientForslag({ proposedFields: { [f]: { a: stor } } })));
    await assertFails(db.collection("pendingEdits").add(klientForslag({ proposedFields: { [f]: [stor] } })));
  }
  for (const f of ["mainGenre", "subGenre", "keyWorks", "musicExamples", "kilder"]) {
    await assertFails(db.collection("pendingEdits").add(klientForslag({ proposedFields: { [f]: { a: stor } } })));
    await assertFails(db.collection("pendingEdits").add(klientForslag({ proposedFields: { [f]: Array.from({ length: 51 }, () => "x") } })));
  }
  for (const f of ["birthYear", "deathYear", "influenceStart", "influenceEnd", "inventedYear", "adoptedYear", "activeFrom", "activeTo"]) {
    await assertFails(db.collection("pendingEdits").add(klientForslag({ proposedFields: { [f]: "1950" } })));
  }
  // Selve forslagsdokumentet.
  await assertFails(db.collection("pendingEdits").add(klientForslag({ proposedFields: "x" })));
  await assertFails(db.collection("pendingEdits").add(klientForslag({ level: "story" })));
  await assertFails(db.collection("pendingEdits").add(klientForslag({ entityId: 5 })));
});

test("funn 25: pendingEdits har typevakt på createdAt, entityName og proposedBy", async () => {
  const stor = "x".repeat(9000);
  const db = anonDb("anon-1");
  await assertFails(db.collection("pendingEdits").add(klientForslag({ createdAt: stor })));
  await assertFails(db.collection("pendingEdits").add(klientForslag({ entityName: { a: stor } })));
  await assertFails(db.collection("pendingEdits").add(klientForslag({ proposedBy: { a: stor } })));
  await seedPendingEdit("pe25", { ...RETUR, returKode: "CD3EF" });
  await assertFails(anonDb("anon-1").collection("pendingEdits").doc("pe25").update({
    proposedFields: { description: "x" }, proposedBy: { a: stor }, status: "open", innsendtKode: "CD3EF",
  }));
});

test("funn 46: tech-create har hviteliste og ownerUid-vakt; pendingEdits-create har ownerUid-vakt", async () => {
  const db = anonDb("anon-1");
  await assertFails(db.collection("tech").add(klientTech({ hackerField: "x" })));
  await assertFails(db.collection("tech").add(klientTech({ returKode: "AB2CD" })));
  await assertFails(db.collection("tech").add(klientTech({ teacherFeedback: "x" })));
  await assertFails(db.collection("tech").add(klientTech({ ownerUid: "anon-99" })));
  await assertFails(db.collection("pendingEdits").add(klientForslag({ ownerUid: "anon-99" })));
  await assertSucceeds(db.collection("tech").add(klientTech({ ownerUid: "" })));
});

test("funn 47: et nytt forslag kan ikke starte med stemmer", async () => {
  await assertFails(anonDb("anon-1").collection("artists").add({ ...studentArtist, votedUpBy: ["x1", "x2"] }));
});

// Returtestene for artists (brukt kode, målstatus, urørlige felter) kjørt for
// tech og pendingEdits, som har egne kopier av erReturInnsending (funn 44).
function techResubmit(kode, extra = {}) {
  const { status, ownerUid, createdAt, ...skjema } = klientTech();
  return { ...skjema, proposedBy: "Ola", status: "pending", innsendtKode: kode, studentComment: "Rettet.", ...extra };
}
function forslagResubmit(kode, extra = {}) {
  return { proposedFields: { description: "Bedre" }, proposedBy: "Ola", status: "open", innsendtKode: kode, studentComment: "Fikset.", ...extra };
}

test("funn 44: tech-retur bare fra «returnert», bare til «pending», og urørlige felter", async () => {
  await seedTech("t44a", { ...RETUR, status: "pending" });   // koden er brukt
  await assertFails(anonDb("anon-1").collection("tech").doc("t44a").update(techResubmit("AB2CD")));
  await seedTech("t44b", RETUR);
  const ref = anonDb("anon-1").collection("tech").doc("t44b");
  await assertFails(ref.update(techResubmit("AB2CD", { status: "active" })));
  for (const smuglet of [{ returKode: "NY123" }, { teacherFeedback: "" }, { ownerUid: "anon-99" }, { priority: 3 }]) {
    await assertFails(ref.update(techResubmit("AB2CD", smuglet)));
  }
  await assertFails(unauthDb().collection("tech").doc("t44b").update(techResubmit("AB2CD")));
  await assertSucceeds(ref.update(techResubmit("AB2CD")));
});

test("funn 44: forslagsretur bare fra «returnert», bare til «open», identiteten er urørlig", async () => {
  await seedPendingEdit("p44a", { ...RETUR, returKode: "CD3EF", status: "open" });   // koden er brukt
  await assertFails(anonDb("anon-1").collection("pendingEdits").doc("p44a").update(forslagResubmit("CD3EF")));
  await seedPendingEdit("p44b", { ...RETUR, returKode: "CD3EF" });
  const ref = anonDb("anon-1").collection("pendingEdits").doc("p44b");
  for (const smuglet of [
    { entityId: "a2" }, { entityType: "tech" }, { entityName: "x" }, { level: "sub" },
    { returKode: "NY123" }, { teacherFeedback: "" }, { ownerUid: "anon-99" },
  ]) {
    await assertFails(ref.update(forslagResubmit("CD3EF", smuglet)));
  }
  await assertFails(unauthDb().collection("pendingEdits").doc("p44b").update(forslagResubmit("CD3EF")));
  await assertSucceeds(ref.update(forslagResubmit("CD3EF")));
});

test("funn 45 + 25: studentComment har tak og typevakt, og en retur uten kode kan ikke overtas", async () => {
  const stor = "x".repeat(9000);
  await seedArtist("r45", RETUR);
  await seedTech("t45", RETUR);
  await seedPendingEdit("p45", { ...RETUR });
  const a = anonDb("anon-1").collection("artists").doc("r45");
  const t = anonDb("anon-1").collection("tech").doc("t45");
  const p = anonDb("anon-1").collection("pendingEdits").doc("p45");
  for (const kommentar of ["x".repeat(1001), { a: stor }]) {
    await assertFails(a.update({ ...artistResubmit("AB2CD"), studentComment: kommentar }));
    await assertFails(t.update(techResubmit("AB2CD", { studentComment: kommentar })));
    await assertFails(p.update(forslagResubmit("AB2CD", { studentComment: kommentar })));
  }
  // «returnert» uten returKode (mulig etter en lærerimport): uten vakta
  // returKode != "" ville en manglende innsendtKode gitt "" == "".
  const { returKode, ...utenKode } = RETUR;
  await seedArtist("r45b", utenKode);
  await seedTech("t45b", utenKode);
  await seedPendingEdit("p45b", utenKode);
  const { innsendtKode: _a, ...artistUtenKode } = artistResubmit("");
  await assertFails(anonDb("anon-1").collection("artists").doc("r45b").update(artistUtenKode));
  const { innsendtKode: _t, ...techUtenKode } = techResubmit("");
  await assertFails(anonDb("anon-1").collection("tech").doc("t45b").update(techUtenKode));
  const { innsendtKode: _p, ...forslagUtenKode } = forslagResubmit("");
  await assertFails(anonDb("anon-1").collection("pendingEdits").doc("p45b").update(forslagUtenKode));
});
