// ============================================================================
//  TESTDATAENE FOR NETTLESERTESTENE (v7.13)
// ----------------------------------------------------------------------------
//  Et lite, fast pensum i Firebase-emulatoren (prosjekt demo-pensum): tre
//  artister, sjangertreet fra frøet, to plateselskaper uten navn (som de 13
//  første live før v7.12), et tiår, guiden og lærerhåndboken. Hver testfil
//  starter med såFrø(), så testene ikke avhenger av hverandre.
//
//  lesDok og lesSamling leser rett fra emulatoren, forbi reglene, så testene
//  kan sjekke hva appen faktisk skrev.
// ============================================================================
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { SEED_DOC } from "../helpers/seed-model.js";

export const PROSJEKT = "demo-pensum";
let env = null;

async function miljo() {
  if (env) return env;
  env = await initializeTestEnvironment({
    projectId: PROSJEKT,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
    },
  });
  return env;
}

const ARTIST = {
  status: "active", votedUpBy: [], priority: 0, teacherChecked: false, removedBy: null,
  birthYear: null, deathYear: null, influenceEnd: null, imageUrl: "", imageCredit: "",
  keyWorks: [], subGenre: [], addedYear: 2026, proposedBy: "Læreren",
};

export const ARTISTER = {
  muddy: {
    ...ARTIST, name: "Muddy Waters", gender: "mann", metaGenre: "Blues", instrument: "Gitar",
    mainGenre: ["Electric blues"], subGenre: ["Chicago blues"], influenceStart: 1948, influenceEnd: 1960,
    geography: "Chicago", recordLabel: "Chess", priority: 3, teacherChecked: true,
    description: "Muddy Waters tok deltabluesen med seg til Chicago og gjorde den elektrisk.",
    musicExamples: [{ label: "Hoochie Coochie Man", url: "https://www.youtube.com/watch?v=abcdefghijk", sentral: true }],
    kilder: [{ text: "Store norske leksikon", url: "https://snl.no/Muddy_Waters" }],
  },
  bessie: {
    ...ARTIST, name: "Bessie Smith", gender: "kvinne", metaGenre: "Blues", instrument: "Vokal",
    mainGenre: ["Blues"], influenceStart: 1923, influenceEnd: 1933, geography: "Chattanooga",
    recordLabel: "Columbia", description: "Bessie Smith var den mest solgte bluessangeren på 1920-tallet.",
    musicExamples: [], kilder: [{ text: "Britannica", url: "https://www.britannica.com/biography/Bessie-Smith" }],
  },
  otis: {
    ...ARTIST, name: "Otis Redding", gender: "mann", metaGenre: "R&B", instrument: "Vokal",
    mainGenre: ["Soul"], influenceStart: 1962, influenceEnd: 1967, geography: "Macon",
    recordLabel: "Volt", description: "Otis Redding var soulens store stemme på Stax.",
    musicExamples: [], kilder: [],
  },
};

export const INNHOLD = {
  genealogy: SEED_DOC,
  // Plateselskapene og alle hubkortene er synlige for studentene i testene.
  synlighet: {
    student: { utskrift: false, viktighetsgrad: false, merking: true, koblingsbeskrivelser: false, metasjangerhistorier: false, fraTimene: true, usjekket: false, horEtter: false },
    hub: { "sb-rotter": false, "sb-referanser": false, "sb-himmel": false, "sb-historier": false, "sb-guide": false, "sb-om-historie": false, "sb-plateselskaper": false },
    punkter: true,
    guide: ["Forsiden"],
  },
  // Som live før v7.12: tekst og fakta, men ikke noe navn i dokumentet.
  "plateselskap-chess": { body: "Chess ga ut Muddy Waters i Chicago.", fakta: { grunnlagt: "1950", sted: "Chicago" } },
  "plateselskap-stax": { body: "Stax og søstermerket Volt laget soul i Memphis.", fakta: { grunnlagt: "1957", sted: "Memphis" } },
  appGuide: { body: "Velkommen til appen.\n\n### Forsiden\nSlik bruker du forsiden.\n\n### Søk\nSlik søker du." },
  laererHandbok: { body: "Håndboken for læreren.\n\n### Skrivebordet\nSlik bruker du Skrivebordet." },
};

export async function såFrø() {
  const e = await miljo();
  await e.clearFirestore();
  await e.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, a] of Object.entries(ARTISTER)) await db.collection("artists").doc(id).set(a);
    for (const [id, d] of Object.entries(INNHOLD)) await db.collection("content").doc(id).set(d);
    await db.collection("decades").doc("1950").set({ society: "Etterkrigstid og ungdomskultur.", tech: "Vinylsingelen kom.", kilder: [] });
    await db.collection("genreDescriptions").doc("Electric blues").set({ main: { description: "Elektrisk blues fra Chicago." } });
    await db.collection("config").doc("teacherChecks").set({});
  });
}

export async function lesDok(samling, id) {
  const e = await miljo();
  let ut = null;
  await e.withSecurityRulesDisabled(async (ctx) => {
    const s = await ctx.firestore().collection(samling).doc(id).get();
    ut = s.exists ? s.data() : null;
  });
  return ut;
}

export async function lesSamling(samling) {
  const e = await miljo();
  let ut = [];
  await e.withSecurityRulesDisabled(async (ctx) => {
    const s = await ctx.firestore().collection(samling).get();
    ut = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  return ut;
}

export async function rydd() {
  if (env) await env.cleanup();
  env = null;
}

// Skriver et dokument forbi reglene, for å sette opp en tilstand (for
// eksempel et forslag som venter) uten å gå gjennom skjermbildene.
export async function skrivDok(samling, id, data) {
  const e = await miljo();
  await e.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(samling).doc(id).set(data);
  });
}
