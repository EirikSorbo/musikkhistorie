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
  findReferences, planGenreRename, planMetaRename, planGenreDelete, planMetaDelete,
  planPasserIBatch, BATCH_MAX, byggMetaTre, planTreeCleanup,
} from "../../js/genre-migrate.js?v=4.66";

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

test("uten andre nivåer slettes det gamle beskrivelsesdokumentet helt", () => {
  const s = lagState();
  s.genreDescs["R&B"] = { main: { description: "tekst om R&B" } };   // KUN main
  const plan = planGenreRename(s, "R&B", "Rhythm and blues");
  const gamle = ops(plan, "genreDescriptions").find((o) => o.id === "R&B");
  assert.equal(gamle.type, "doc.delete");
});

test("story på samme dokument overlever navnebyttet", () => {
  // Fixturens R&B-dokument har main + story (normen: etiketter som deler navn
  // med en metasjanger). Et doc.delete som bare sjekket sub, utslettet
  // sjangerhistorien i «Det store bildet».
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  const gamle = ops(plan, "genreDescriptions").filter((o) => o.id === "R&B");
  assert.equal(gamle.length, 1);
  assert.equal(gamle[0].type, "field.delete", "story-feltet skal overleve");
  assert.equal(gamle[0].data.felt, "main");
  assert.ok(plan.advarsler.some((a) => a.includes("metasjanger")), "læreren skal få vite hvorfor");
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

test("tomt navn, eksakt samme navn og ukjent sjanger blokkeres", () => {
  assert.ok(planGenreRename(lagState(), "R&B", "  ").feil.length);
  assert.ok(planGenreRename(lagState(), "R&B", "R&B").feil.length);
  assert.ok(planGenreRename(lagState(), "Finnes ikke", "Noe").feil.length);
});

test("en ren case-retting er et gyldig navnebytte", () => {
  // Firestore-ID-er er case-sensitive, så «R&B» → «R&b» er en ekte
  // identitetsflytting maskineriet kan utføre — den skal ikke avvises.
  const plan = planGenreRename(lagState(), "R&B", "R&b");
  assert.deepEqual(plan.feil, []);
  // Varmekartraden må flytte, ikke forsvinne, når nøklene er ulike strenger.
  const heat = ops(plan, "content").find((o) => o.id === "varmekart").data.heat;
  assert.deepEqual(heat["R&b"], [1, 2]);
  assert.ok(!("R&B" in heat));
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

// --- Treet skrives HELT ------------------------------------------------------
// Merge dyp-fletter map-felter, og families ER en map. Arrays byttes riktignok
// ut ved merge, så nodene forsvinner i dag uansett — men den dagen en familie
// fjernes, ville den blitt liggende igjen usett. Alle tre planene skriver derfor
// treet med replace, ikke bare metasjanger-byttet.
test("navnebytte på en sjanger skriver treet med replace", () => {
  const plan = planGenreRename(lagState(), "R&B", "Rhythm and blues");
  assert.equal(plan.ops.find((o) => o.id === "genealogy").type, "doc.replace");
});

test("sletting av en sjanger skriver treet med replace", () => {
  const s = lagState();
  s.artists = [];                       // ellers blokkerer taggene
  // Barn blokkerer sletting, og «barn» er både p og rx: Soul har R&B som
  // forelder, og Rock har den som motreaksjon.
  s.tree.nodes = s.tree.nodes
    .filter((n) => n.id !== "soul")
    .map((n) => ({ ...n, rx: [] }));
  const plan = planGenreDelete(s, "R&B");
  assert.equal(plan.ops.find((o) => o.id === "genealogy").type, "doc.replace");
});

// --- Sletting av metasjanger -------------------------------------------------
// En metasjanger med sjangre i seg kan ikke bare strykes fra metaGenres-lista:
// modellen utleder hvilke metasjangre som finnes fra NODENE (n.g), så kartet
// ville fortsatt tegnet den, nå uten farge og kolonne.
function medTomMeta() {
  const s = lagState();
  s.tree.metaGenres.push({ name: "Klubbmusikk", order: 3, column: 3, fam: "gray" });
  s.tree.metaOrderHint.push("Klubbmusikk");
  s.genreDescs.Klubbmusikk = { meta: { description: "om klubbmusikk" }, story: { body: "fortellingen" } };
  s.teacherChecks.metaGenres.push("Klubbmusikk");
  return s;
}

test("metasjanger med sjangre i seg blokkeres, med sjangrene listet", () => {
  const plan = planMetaDelete(lagState(), "R&B");
  assert.equal(plan.ops.length, 0, "ingenting skal skrives når noe blokkerer");
  const b = plan.blokkeringer.find((x) => x.hva.includes("sjanger"));
  assert.ok(b, plan.blokkeringer.map((x) => x.hva).join(" | "));
  assert.deepEqual(b.detaljer.sort(), ["R&B", "Soul"]);
});

test("metasjanger med taggede artister blokkeres selv om den er tom for sjangre", () => {
  const s = medTomMeta();
  s.artists.push({ id: "a9", name: "Kraftwerk", mainGenre: [], metaGenre: "Klubbmusikk" });
  const plan = planMetaDelete(s, "Klubbmusikk");
  assert.equal(plan.ops.length, 0);
  assert.ok(plan.blokkeringer.some((b) => b.detaljer.includes("Kraftwerk")));
});

test("tom metasjanger fjernes fra BÅDE metaGenres og metaOrderHint", () => {
  const plan = planMetaDelete(medTomMeta(), "Klubbmusikk");
  assert.deepEqual(plan.blokkeringer, []);
  const t = treet(plan);
  assert.deepEqual(t.metaGenres.map((m) => m.name), ["Blues", "R&B", "Rock"]);
  assert.deepEqual(t.metaOrderHint, ["Blues", "R&B", "Rock"],
    "glemmes hintet, blir navnet stående i den pedagogiske rangeringen");
  assert.equal(plan.ops.find((o) => o.id === "genealogy").type, "doc.replace");
});

test("tom metasjanger tar med beskrivelsen og sjangerhistorien", () => {
  const plan = planMetaDelete(medTomMeta(), "Klubbmusikk");
  const d = ops(plan, "genreDescriptions");
  assert.equal(d.length, 1);
  assert.equal(d[0].type, "doc.delete");
  assert.equal(d[0].id, "Klubbmusikk");
  assert.ok(plan.advarsler.some((a) => a.includes("Sjangerhistorien")), plan.advarsler.join(" | "));
});

test("shadowing: main-teksten på samme navn overlever slettingen", () => {
  const s = medTomMeta();
  s.genreDescs.Klubbmusikk.main = { description: "en tre-sjanger som tilfeldigvis heter det samme" };
  const plan = planMetaDelete(s, "Klubbmusikk");
  const d = ops(plan, "genreDescriptions");
  assert.ok(!d.some((o) => o.type === "doc.delete"), "dokumentet må bli liggende for main-teksten");
  assert.deepEqual(d.map((o) => o.data.felt).sort(), ["meta", "story"]);
});

test("tom metasjanger fjerner avkryssingen sin", () => {
  const plan = planMetaDelete(medTomMeta(), "Klubbmusikk");
  const c = ops(plan, "config").find((o) => o.id === "teacherChecks");
  assert.deepEqual(c.data.metaGenres, ["R&B"]);
});

test("ukjent metasjanger gir feil, ikke en tom plan", () => {
  const plan = planMetaDelete(lagState(), "Finnes ikke");
  assert.equal(plan.ops.length, 0);
  assert.ok(plan.feil.length);
});

// --- byggMetaTre: de to rekkefølgene ----------------------------------------
// Kartets kolonner og den pedagogiske rangeringen er ULIKE akser. Går én av dem
// galt, stokker kartet eller varmekartet om seg selv uten at noe ser ødelagt ut,
// og det er ikke synlig i noen feilmelding.
const metaNavn = (t) => t.metaGenres.map((m) => m.name);
const kolonner = (t) => t.metaGenres.map((m) => m.column);

test("byggMetaTre: kolonnene nummereres 0..n-1 på nytt, uten hull", () => {
  const t = lagState().tree;
  t.metaGenres = [
    { name: "Blues", column: 0, fam: "blue" },
    { name: "R&B", column: 7, fam: "red" },      // hull med vilje
    { name: "Rock", column: 9, fam: "rock" },
  ];
  const gammel = t.metaGenres[2];
  const ut = byggMetaTre(t, { gammel, navn: "Rock", fam: "rock", kartPlass: 0, hintPlass: 2 });
  assert.deepEqual(metaNavn(ut), ["Rock", "Blues", "R&B"]);
  assert.deepEqual(kolonner(ut), [0, 1, 2]);
});

test("byggMetaTre: en ny metasjanger settes inn på valgt plass", () => {
  const t = lagState().tree;
  const ut = byggMetaTre(t, { gammel: null, navn: "Klubbmusikk", fam: "gray", kartPlass: 1, hintPlass: 3 });
  assert.deepEqual(metaNavn(ut), ["Blues", "Klubbmusikk", "R&B", "Rock"]);
  assert.deepEqual(ut.metaOrderHint, ["Blues", "R&B", "Rock", "Klubbmusikk"]);
  assert.equal(ut.metaGenres[1].color, "#9", "fargen hentes fra treets families (gray), ikke fra modellen");
});

test("byggMetaTre: treet beholder det GAMLE navnet ved navnebytte", () => {
  const t = lagState().tree;
  const gammel = t.metaGenres.find((m) => m.name === "R&B");
  const ut = byggMetaTre(t, { gammel, navn: "Soul og funk", fam: "red", kartPlass: 1, hintPlass: 1 });
  assert.ok(metaNavn(ut).includes("R&B"),
    "navnebyttet gjøres av planMetaRename etterpå — skriver treet det nye navnet her, bytter det to ganger");
  assert.ok(!metaNavn(ut).includes("Soul og funk"));
});

test("byggMetaTre: de andre metasjangrene beholder rekkefølgen seg imellom", () => {
  const t = lagState().tree;
  t.metaOrderHint = ["Rock", "Blues", "R&B"];
  const gammel = t.metaGenres.find((m) => m.name === "Blues");
  const ut = byggMetaTre(t, { gammel, navn: "Blues", fam: "blue", kartPlass: 2, hintPlass: 2 });
  assert.deepEqual(ut.metaOrderHint, ["Rock", "R&B", "Blues"],
    "bare den redigerte flyttes — Rock skal fortsatt ligge foran R&B");
});

test("byggMetaTre: en metasjanger utenfor hintet legges inn der læreren velger", () => {
  const t = lagState().tree;
  t.metaOrderHint = ["Blues", "Rock"];              // R&B mangler
  const gammel = t.metaGenres.find((m) => m.name === "R&B");
  const ut = byggMetaTre(t, { gammel, navn: "R&B", fam: "red", kartPlass: 1, hintPlass: 1 });
  assert.deepEqual(ut.metaOrderHint, ["Blues", "R&B", "Rock"]);
});

// --- Fase 4: epoke og lytteforslag ut av treet -------------------------------
// Treet skal holde struktur. era var innhold (og en unøyaktig utgave av
// activeFrom/activeTo, som allerede lå i genreDescriptions), og t var rundt 100
// forfattede lytteforslag som ingenting i appen leste.
function medEraOgT() {
  const s = lagState();
  s.tree.nodes = s.tree.nodes.map((n) => ({ ...n, era: `epoke-${n.id}`, t: [`spor-${n.id}`] }));
  s.tree.nodes[0].t = [];                 // Blues: bare epoke
  delete s.tree.nodes[1].era;             // R&B: bare lytteforslag
  return s;
}

test("epoke og lytteforslag flyttes til beskrivelsens main-nivå", () => {
  const plan = planTreeCleanup(medEraOgT());
  const d = ops(plan, "genreDescriptions");
  assert.equal(d.length, 4);
  const blues = d.find((o) => o.id === "Blues");
  assert.deepEqual(blues.data, { main: { era: "epoke-blues" } }, "tom lytteliste skal ikke skrives");
  const rnb = d.find((o) => o.id === "R&B");
  assert.deepEqual(rnb.data, { main: { lytt: ["spor-rnb"] } }, "manglende epoke skal ikke skrives");
});

test("beskrivelsene skrives med MERGE — description og kilder skal overleve", () => {
  const plan = planTreeCleanup(medEraOgT());
  for (const o of ops(plan, "genreDescriptions")) {
    assert.equal(o.type, "doc.merge", `${o.id}: replace ville slettet beskrivelsen`);
  }
});

test("treet skrives med replace, og era/t er borte fra HVER node", () => {
  const plan = planTreeCleanup(medEraOgT());
  const t = plan.ops.find((o) => o.id === "genealogy");
  assert.equal(t.type, "doc.replace", "merge kan ikke fjerne et felt");
  for (const n of t.data.nodes) {
    assert.ok(!("era" in n), `${n.id} har fortsatt era`);
    assert.ok(!("t" in n), `${n.id} har fortsatt t`);
  }
  // Strukturen skal være urørt.
  assert.deepEqual(t.data.nodes.map((n) => n.id), ["blues", "rnb", "soul", "rock"]);
  assert.deepEqual(t.data.nodes.find((n) => n.id === "soul").p, ["rnb"]);
});

test("skriving bruker ETIKETTEN som dokument-ID, aldri fullnavnet", () => {
  const plan = planTreeCleanup(medEraOgT());
  const ider = ops(plan, "genreDescriptions").map((o) => o.id);
  assert.ok(ider.includes("R&B"), "etiketten");
  assert.ok(!ider.includes("Rhythm & blues"), "fullnavnet er ikke dokument-ID");
});

test("en sjanger uten beskrivelse får dokument likevel, med varsel", () => {
  const s = medEraOgT();
  delete s.genreDescs["R&B"];
  const plan = planTreeCleanup(s);
  assert.ok(ops(plan, "genreDescriptions").some((o) => o.id === "R&B"));
  assert.ok(plan.advarsler.some((a) => a.includes("ingen beskrivelse")), plan.advarsler.join(" | "));
});

test("å kjøre migreringen to ganger er ufarlig — andre gang er det ingenting å gjøre", () => {
  const s = medEraOgT();
  const t = planTreeCleanup(s).ops.find((o) => o.id === "genealogy").data;
  s.tree = t;
  const igjen = planTreeCleanup(s);
  assert.equal(igjen.ops.length, 0);
  assert.ok(igjen.feil[0].includes("allerede rent"), igjen.feil.join(" | "));
});

test("hele migreringen får plass i én atomisk batch", () => {
  assert.ok(planPasserIBatch(planTreeCleanup(medEraOgT())));
});
