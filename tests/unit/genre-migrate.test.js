// ============================================================================
//  MIGRERING AV SJANGERTREET
// ----------------------------------------------------------------------------
//  Etiketten er en IDENTITET seks andre steder peker på. Glemmer planleggeren
//  én av dem, blir data foreldreløse i stillhet — artisten står med en sjanger
//  som ikke finnes, varmekartraden blir en død nøkkel, beskrivelsen usynlig.
//
//  Testene her er derfor uttømmende per identitet, og de dekker i tillegg de to
//  fellene som er lette å gå på:
//    · ett beskrivelsesdokument kan holde BÅDE main og sub for samme navn
//      (shadowing) — et navnebytte skal flytte kun main
//    · node-ID-er skal ALDRI endres, fordi edgeDescriptions er nøklet «fra__til»
//
//  Fire av flatene ble oppdaget først av en kartlegging, ikke av meg: sjangeren
//  på lytteeksemplene, sjangerhistorien (story-feltet), metaOrderHint, og at
//  varmekartet må skrives med replace fordi merge ikke kan fjerne en nøkkel.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  findReferences, planGenreRename, planMetaRename, planGenreDelete,
  planPasserIBatch, BATCH_MAX,
} from "../../js/genre-migrate.js?v=4.61";

// --- En liten, men komplett verden ------------------------------------------
function lagState(overstyr = {}) {
  const tree = {
    version: 2,
    nodes: [
      { id: "blues", l: "Blues", f: "Blues", g: "Blues", r: 1, p: [] },
      { id: "rnb", l: "R&B", f: "Rhythm & blues", g: "R&B", r: 6, p: ["blues"] },
      { id: "soul", l: "Soul", f: "Soul", g: "R&B", r: 7, p: ["rnb"] },
      { id: "rock", l: "Rock", f: "Rock", g: "Rock", r: 7, p: ["blues"], rx: ["rnb"] },
    ],
    metaGenres: [
      { name: "Blues", order: 0, column: 0, fam: "blue" },
      { name: "R&B", order: 1, column: 1, fam: "red" },
      { name: "Rock", order: 2, column: 2, fam: "rock" },
    ],
    families: { blue: { stroke: "#1" }, red: { stroke: "#2" }, rock: { stroke: "#3" }, gray: { stroke: "#9" } },
    metaOrderHint: ["Blues", "R&B", "Rock"],
  };
  return {
    tree,
    artists: [
      {
        id: "a1", name: "Ray Charles", mainGenre: ["R&B", "Soul"], metaGenre: "R&B",
        musicExamples: [{ title: "What'd I Say", genre: "R&B" }, { title: "Georgia", genre: "Soul" }],
      },
      { id: "a2", name: "Muddy Waters", mainGenre: ["Blues"], metaGenre: "Blues" },
      { id: "a3", name: "Etta James", mainGenre: ["r&b"], metaGenre: "R&B" },   // annen case
      { id: "a4", name: "En som bare har fri undersjanger", mainGenre: ["Blues"], subGenre: ["R&B"], metaGenre: "Blues" },
      { id: "a5", name: "Bare lytteeksempel", mainGenre: ["Blues"], metaGenre: "Blues",
        musicExamples: [{ title: "Noe", genre: "R&B" }] },
    ],
    genreDescs: {
      "R&B": { main: { description: "tekst om R&B" }, story: { body: "fortellingen om R&B" } },
      Blues: { main: { description: "blues" }, sub: { description: "en fri undersjanger" } },
    },
    edgeDescs: { blues__rnb: { description: "x" }, rnb__soul: { description: "y" } },
    content: { varmekart: { heat: { "R&B": [1, 2], Blues: [3] }, updatedAt: "i går" } },
    teacherChecks: { genres: ["R&B", "Blues"], metaGenres: ["R&B"] },
    pendingEdits: [
      { id: "p1", entityType: "subgenre", entityId: "R&B", entityName: "R&B" },
      { id: "p2", entityType: "artist", entityId: "a1" },
    ],
    ...overstyr,
  };
}

const ops = (plan, coll) => plan.ops.filter((o) => o.coll === coll);
const treet = (plan) => plan.ops.find((o) => o.coll === "content" && o.id === "genealogy")?.data;

// --- findReferences ----------------------------------------------------------

test("findReferences finner alt som peker på en sjanger", () => {
  const r = findReferences(lagState(), "R&B");
  assert.equal(r.node.id, "rnb");
  assert.equal(r.artister.length, 2, "både «R&B» og «r&b» skal telle");
  assert.deepEqual(r.barn.map((n) => n.id).sort(), ["rock", "soul"], "rx teller som referanse");
  assert.equal(r.harMain, true);
  assert.equal(r.harVarmekart, true);
  assert.equal(r.sjekket, true);
  assert.equal(r.forslag.length, 1, "kun sjangerforslaget, ikke artistforslaget");
  assert.deepEqual(r.koblinger.sort(), ["blues__rnb", "rnb__soul"]);
});

// --- Navnebytte --------------------------------------------------------------

test("navnebytte dekker ALLE identitetene som peker på etiketten", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  assert.deepEqual(plan.feil, []);

  assert.equal(treet(plan).nodes.find((n) => n.id === "rnb").l, "Rhythm and blues", "treet");
  assert.ok(ops(plan, "genreDescriptions").some((o) => o.id === "Rhythm and blues"), "beskrivelsen flyttet");
  // a1 + a3 (mainGenre-tagg) + a5 (kun lytteeksempel). a4 har «R&B» som FRI
  // undersjanger og skal med vilje IKKE røres.
  assert.deepEqual(ops(plan, "artists").map((o) => o.id).sort(), ["a1", "a3", "a5"]);
  assert.ok(ops(plan, "content").some((o) => o.id === "varmekart"), "varmekartet");
  assert.ok(ops(plan, "config").some((o) => o.id === "teacherChecks"), "avkryssingen");
  assert.equal(ops(plan, "pendingEdits").length, 1, "det åpne forslaget");
});

test("navnebytte tagger artistene om, også de med annen case", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const a1 = ops(plan, "artists").find((o) => o.id === "a1");
  const a3 = ops(plan, "artists").find((o) => o.id === "a3");
  assert.deepEqual(a1.data.mainGenre, ["Rhythm and blues", "Soul"], "de andre taggene røres ikke");
  assert.deepEqual(a3.data.mainGenre, ["Rhythm and blues"], "«r&b» skal også byttes");
});

test("varmekartraden flyttes til den nye nøkkelen og den gamle fjernes", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const heat = ops(plan, "content").find((o) => o.id === "varmekart").data.heat;
  assert.deepEqual(heat["Rhythm and blues"], [1, 2]);
  assert.equal("R&B" in heat, false, "den gamle nøkkelen skal være borte");
  assert.deepEqual(heat.Blues, [3], "andre rader røres ikke");
});

test("node-ID-en endres ALDRI — koblingsbeskrivelsene ville blitt foreldreløse", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  assert.equal(treet(plan).nodes.find((n) => n.l === "Rhythm and blues").id, "rnb");
  assert.equal(ops(plan, "edgeDescriptions").length, 0, "ingen koblingsbeskrivelse skal røres");
});

test("shadowing: et dokument med både main og sub mister KUN main", () => {
  const plan = planGenreRename(lagState(), "Blues", "Blues (tidlig)");
  const gamle = ops(plan, "genreDescriptions").filter((o) => o.id === "Blues");
  assert.equal(gamle.length, 1);
  assert.equal(gamle[0].type, "field.delete", "dokumentet skal IKKE slettes");
  assert.equal(gamle[0].data.felt, "main");
  assert.ok(plan.advarsler.some((a) => a.includes("undersjanger")), "læreren skal få vite hvorfor");
});

test("uten sub slettes det gamle beskrivelsesdokumentet helt", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const gamle = ops(plan, "genreDescriptions").find((o) => o.id === "R&B");
  assert.equal(gamle.type, "doc.delete");
});

test("navnekollisjon blokkeres", () => {
  const plan = planGenreRename(lagState(), "R&B", "Soul");
  assert.ok(plan.feil.some((f) => f.includes("allerede")));
  assert.equal(plan.ops.length, 0, "ingenting skal planlegges når det er feil");
});

test("skråstrek blokkeres — etiketten er dokument-ID", () => {
  const plan = planGenreRename(lagState(), "R&B", "R&B/soul");
  assert.ok(plan.feil.some((f) => f.includes("/")));
});

test("navnebytte til et navn som allerede har en main-beskrivelse blokkeres", () => {
  const s = lagState();
  s.genreDescs["Nytt navn"] = { main: { description: "finnes fra før" } };
  const plan = planGenreRename(s, "R&B", "Nytt navn");
  assert.ok(plan.feil.some((f) => f.includes("allerede")));
});

test("tomt navn, samme navn og ukjent sjanger blokkeres", () => {
  assert.ok(planGenreRename(lagState(), "R&B", "  ").feil.length);
  assert.ok(planGenreRename(lagState(), "R&B", "r&b").feil.length);
  assert.ok(planGenreRename(lagState(), "Finnes ikke", "Noe").feil.length);
});

// --- Metasjanger -------------------------------------------------------------

test("metasjanger-bytte flytter nodene, artistene og beskrivelsen", () => {
  const s = lagState();
  s.genreDescs["R&B"].meta = { description: "om metasjangeren" };
  const plan = planMetaRename(s, "R&B", "Soul og funk");
  assert.deepEqual(plan.feil, []);
  const tre = treet(plan);
  assert.equal(tre.nodes.filter((n) => n.g === "Soul og funk").length, 2, "rnb + soul");
  assert.ok(tre.metaGenres.some((m) => m.name === "Soul og funk"));
  assert.equal(ops(plan, "artists").length, 2, "artistene med metaGenre R&B");
  assert.ok(ops(plan, "genreDescriptions").some((o) => o.id === "Soul og funk"));
  // main-nivået på samme dokument skal overleve
  assert.ok(ops(plan, "genreDescriptions").some((o) => o.type === "field.delete" && o.data.felt === "meta"));
});

test("metasjanger-bytte blokkeres ved kollisjon", () => {
  assert.ok(planMetaRename(lagState(), "R&B", "Rock").feil.length);
});

// --- Sletting ----------------------------------------------------------------

test("sletting BLOKKERES av artister og av barn, med liste over hva som må ryddes", () => {
  const plan = planGenreDelete(lagState(), "R&B");
  assert.equal(plan.ops.length, 0, "ingenting skal skrives når det er blokkert");
  const tekster = plan.blokkeringer.map((b) => b.hva).join(" | ");
  assert.ok(tekster.includes("artist"), tekster);
  assert.ok(tekster.includes("forelder"), tekster);
  const barnBlokk = plan.blokkeringer.find((b) => b.hva.includes("forelder"));
  assert.deepEqual(barnBlokk.detaljer.sort(), ["Rock", "Soul"]);
});

test("en løvnode uten artister kan slettes, og tar med seg sitt eget innhold", () => {
  const s = lagState();
  s.artists = [];                                   // ingen tagger
  s.tree.nodes = s.tree.nodes.filter((n) => n.id !== "rock");  // fjern rx-referansen
  s.tree.nodes = s.tree.nodes.filter((n) => n.id !== "soul");  // og barnet
  const plan = planGenreDelete(s, "R&B");
  assert.deepEqual(plan.blokkeringer, []);
  assert.equal(treet(plan).nodes.some((n) => n.id === "rnb"), false, "noden fjernes");
  assert.ok(ops(plan, "genreDescriptions").some((o) => o.id === "R&B"));
  assert.equal(ops(plan, "edgeDescriptions").length, 2, "begge koblingsbeskrivelsene");
  assert.ok(ops(plan, "pendingEdits").length, "det åpne forslaget ryddes");
  const heat = ops(plan, "content").find((o) => o.id === "varmekart").data.heat;
  assert.equal("R&B" in heat, false);
});

test("sletting av ukjent sjanger gir feil, ikke en tom plan som ser vellykket ut", () => {
  const plan = planGenreDelete(lagState(), "Finnes ikke");
  assert.ok(plan.feil.length);
});

// --- Batchgrensen ------------------------------------------------------------

test("en plan over Firestores batchgrense flagges i stedet for å skrives halvveis", () => {
  const s = lagState();
  s.artists = Array.from({ length: BATCH_MAX + 10 }, (_, i) => ({
    id: "a" + i, name: "Artist " + i, mainGenre: ["R&B"], metaGenre: "R&B",
  }));
  const plan = planGenreRename(s, "R&B", "Nytt");
  assert.equal(planPasserIBatch(plan), false);
  assert.equal(planPasserIBatch(planGenreRename(lagState(), "R&B", "Nytt")), true);
});


// --- Funnene fra kartleggingen ----------------------------------------------

test("lytteeksemplenes sjanger følger med ved navnebytte", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const a1 = ops(plan, "artists").find((o) => o.id === "a1");
  assert.deepEqual(a1.data.musicExamples.map((e) => e.genre), ["Rhythm and blues", "Soul"],
    "kun eksempelet med den gamle sjangeren skal byttes");
  const a5 = ops(plan, "artists").find((o) => o.id === "a5");
  assert.ok(a5, "en artist som BARE har et lytteeksempel må også skrives");
  assert.equal(a5.data.musicExamples[0].genre, "Rhythm and blues");
});

test("artisten får ÉN skriving selv om både tagg og lytteeksempel endres", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const a1 = ops(plan, "artists").filter((o) => o.id === "a1");
  assert.equal(a1.length, 1, "to skrivinger til samme dokument i én batch er sløsing og kan kollidere");
  assert.ok(a1[0].data.mainGenre && a1[0].data.musicExamples, "begge feltene i samme operasjon");
});

test("fri undersjanger med samme navn røres IKKE, men varsles", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const a4 = ops(plan, "artists").find((o) => o.id === "a4");
  assert.equal(a4, undefined, "artisten som bare har «R&B» som fri undersjanger skal ikke skrives");
  assert.ok(plan.advarsler.some((a) => a.includes("FRI undersjanger")), plan.advarsler.join(" | "));
});

test("varmekartet skrives med replace, ikke merge — ellers overlever den gamle nøkkelen", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const vk = ops(plan, "content").find((o) => o.id === "varmekart");
  assert.equal(vk.type, "doc.replace",
    "merge dyp-fletter map-felter, så «R&B»-nøkkelen ville blitt liggende ved siden av den nye");
});

test("metasjanger-bytte tar med sjangerhistorien (story-feltet)", () => {
  const s = lagState();
  s.genreDescs["R&B"].meta = { description: "om metasjangeren" };
  const plan = planMetaRename(s, "R&B", "Soul og funk");
  const ny = ops(plan, "genreDescriptions").find((o) => o.id === "Soul og funk");
  assert.ok(ny.data.story, "sjangerhistorien bor på metasjangerens dokument og må flyttes");
  assert.ok(ny.data.meta);
});

test("metasjanger-bytte oppdaterer metaOrderHint — ellers mistes den pedagogiske rangeringen", () => {
  const s = lagState();
  const plan = planMetaRename(s, "R&B", "Soul og funk");
  const tre = treet(plan);
  assert.deepEqual(tre.metaOrderHint, ["Blues", "Soul og funk", "Rock"]);
  assert.equal(plan.ops.find((o) => o.id === "genealogy").type, "doc.replace",
    "treet må skrives helt, ellers kan ikke en fjernet metasjanger forsvinne fra listene");
});
