// «Bare sjekket innhold» (v6.89, brukervalg 2026-10-13): når bryteren er på,
// ser studentene bare det læreren har sjekket. Regelen (js/felles/sjekket.js),
// filtrene i datalaget (js/data/sjekket-filter.js) og sjekkene som faller ved
// import og godkjente forslag.
import "../helpers/seed-model.js";
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SKJUL_I_STUDENTVISNING } from "../../js/felles/feature-flags.js";
import { sjekketRegelAktiv, artistSjekketOk, settSjekketLaerer, brukSjekker, sjekketOk, koblingSjekketOk } from "../../js/felles/sjekket.js";
import { isVisible } from "../../js/felles/limits.js";
import {
  filtrerGenreDescs, filtrerEdgeDescs, filtrerTech, filtrerDecades, filtrerContent,
  sideSjekk, sjekkerEndretAvImport, sjekkerUten,
} from "../../js/data/sjekket-filter.js";
import { storyOrderSynlig, storyOrder } from "../../js/felles/story-format.js";
import { plateselskapSideId } from "../../js/felles/plateselskaper.js";

const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

afterEach(() => {
  SKJUL_I_STUDENTVISNING.usjekket = false;
  settSjekketLaerer(false);
  brukSjekker({});
});

const artist = (id, teacherChecked) => ({ id, name: id, status: "active", teacherChecked });

test("standarden er av: ingenting forsvinner før læreren slår regelen på", () => {
  assert.equal(SKJUL_I_STUDENTVISNING.usjekket, false);
  assert.equal(sjekketRegelAktiv(), false);
  assert.equal(isVisible(artist("a", false)), true);
});

test("med regelen på er usjekkede artister skjult for studentene, men ikke for læreren", () => {
  SKJUL_I_STUDENTVISNING.usjekket = true;
  assert.equal(sjekketRegelAktiv(), true);
  assert.equal(isVisible(artist("a", false)), false);
  assert.equal(isVisible(artist("b", true)), true);
  assert.equal(artistSjekketOk(artist("c")), false, "uten feltet er kortet ikke sjekket");
  settSjekketLaerer(true);
  assert.equal(sjekketRegelAktiv(), false);
  assert.equal(isVisible(artist("a", false)), true);
});

test("sjekkene leses per kategori, og før de har landet er ingenting sjekket", () => {
  SKJUL_I_STUDENTVISNING.usjekket = true;
  brukSjekker(null);
  assert.equal(sjekketOk("tech", "t1"), false);
  brukSjekker({ tech: ["t1"] });
  assert.equal(sjekketOk("tech", "t1"), true);
  assert.equal(sjekketOk("tech", "t2"), false);
  assert.equal(sjekketOk("plateselskaper", "t1"), false);
});

test("sjangerbeskrivelsene: teksten tas bort, årstallene blir stående", () => {
  const descs = {
    // Treets sjanger sjekkes med etiketten, beskrivelsen kan stå under det fulle navnet.
    "Europeisk folkemusikk": { main: { description: "tekst", punkter: ["p"], lytt: ["l"], kilder: [{ text: "k" }], activeFrom: 1900 } },
    "Blues": { meta: { description: "m" }, main: { description: "b" }, story: { body: "historie" } },
    "Doo-wop": { sub: { description: "s", activeFrom: 1950 } },
  };
  const ingen = filtrerGenreDescs(descs, {});
  assert.deepEqual(ingen["Europeisk folkemusikk"].main, { activeFrom: 1900 });
  assert.equal(ingen.Blues.story, undefined);
  assert.equal(ingen.Blues.meta.description, undefined);
  assert.equal(ingen.Blues.main.description, undefined);
  assert.deepEqual(ingen["Doo-wop"].sub, { activeFrom: 1950 });
  assert.equal(descs.Blues.story.body, "historie", "rådataene røres ikke");

  const noen = filtrerGenreDescs(descs, { genres: ["Europeisk"], metaGenres: ["Blues"], subgenres: ["doo-wop"] });
  assert.equal(noen["Europeisk folkemusikk"].main.description, "tekst");
  assert.equal(noen.Blues.story.body, "historie");
  assert.equal(noen.Blues.main.description, undefined, "historien er sjekket, sjangerbeskrivelsen ikke");
  assert.equal(noen["Doo-wop"].sub.description, "s", "store og små bokstaver spiller ingen rolle");
});

test("koblinger, innovasjonskort og tiår følger hver sin sjekk", () => {
  assert.deepEqual(Object.keys(filtrerEdgeDescs({ a__b: { description: "x" }, b__c: { description: "y" } }, { edges: ["b__c"] })), ["b__c"]);
  assert.deepEqual(filtrerTech([{ id: "t1" }, { id: "t2" }], { tech: ["t2"] }).map((t) => t.id), ["t2"]);
  const tiaar = filtrerDecades({
    1950: { id: "1950", society: "s", tech: "t", kilder: [{ text: "k" }] },
    1960: { id: "1960", society: "s", tech: "t", kilder: [{ text: "k" }] },
  }, { decades: ["1950"] });
  assert.equal(tiaar[1950].society, "s");
  assert.equal(tiaar[1950].tech, undefined);
  assert.equal(tiaar[1950].kilder.length, 1, "kildene følger den sjekkede teksten");
  assert.deepEqual(tiaar[1960], { id: "1960" });
});

test("innholdssidene: pensumsidene følger sjekken, resten av content står", () => {
  const content = {
    rotter: { body: "r" }, omHistorie: { body: "o" }, appGuide: { body: "g" },
    "instrument-gitar": { body: "i" },
    [plateselskapSideId("columbia")]: { body: "c" },
    skriveveiledning: { body: "s" }, varmekart: { heat: {} }, genealogy: { nodes: [] }, synlighet: {}, referanser: { kilder: [] },
  };
  const ut = filtrerContent(content, { pages: ["omHistorie"], plateselskaper: ["columbia"] });
  assert.deepEqual(Object.keys(ut).sort(), [
    "genealogy", "omHistorie", plateselskapSideId("columbia"), "referanser", "skriveveiledning", "synlighet", "varmekart",
  ].sort());
  assert.deepEqual(sideSjekk("instrument-vokal"), { kategori: "pages", id: "instrument-vokal" });
  assert.deepEqual(sideSjekk(plateselskapSideId("columbia")), { kategori: "plateselskaper", id: "columbia" });
  assert.equal(sideSjekk("skriveveiledning"), null);
});

test("koblingslenka er åpen bare med sjekket tekst når regelen er på", () => {
  assert.equal(koblingSjekketOk("a__b", {}), true);
  SKJUL_I_STUDENTVISNING.usjekket = true;
  assert.equal(koblingSjekketOk("a__b", {}), false);
  assert.equal(koblingSjekketOk("a__b", { a__b: { description: "x" } }), true);
});

test("sjangerhistoriene: med regelen på bare de som har (sjekket) tekst", () => {
  const descs = { Blues: { story: { body: "x" } } };
  assert.deepEqual(storyOrderSynlig(descs), storyOrder(descs));
  SKJUL_I_STUDENTVISNING.usjekket = true;
  assert.deepEqual(storyOrderSynlig(descs), ["Blues"]);
  assert.deepEqual(storyOrderSynlig({}), [], "ingen sjekket: ingen historier");
});

test("import: sjekken faller når teksten endres, ikke når den er lik eller tom i fila", () => {
  const naa = {
    decadeDescs: { 1950: { society: "gammel", tech: "t" } },
    genreDescs: { "Europeisk folkemusikk": { main: { description: "a" } }, Blues: { story: { body: "h" } } },
    edgeDescs: { a__b: { description: "x" } },
    content: { rotter: { body: "r" } },
    techItems: [{ id: "t1", name: "Mikrofon", description: "d" }],
  };
  const fjern = sjekkerEndretAvImport({
    decades: { 1950: { society: "ny", tech: "" } },
    genreDescriptions: { "Europeisk folkemusikk": { main: { description: "b" } }, Blues: { story: { body: "h" } } },
    edgeDescriptions: { a__b: { description: "x" } },
    pages: { rotter: { body: "ny" }, skriveveiledning: { body: "s" } },
    tech: [{ name: "Mikrofon", description: "ny" }, { name: "Ny ting", description: "z" }],
  }, naa);
  assert.deepEqual([...fjern.decades], ["1950"]);
  assert.equal(fjern.decadesTech, undefined, "tom tekst i fila skriver ingenting");
  assert.deepEqual([...fjern.genres].sort(), ["Europeisk", "Europeisk folkemusikk"]);
  assert.equal(fjern.metaGenres, undefined, "lik historie beholder sjekken");
  assert.equal(fjern.edges, undefined);
  assert.deepEqual([...fjern.pages], ["rotter"]);
  assert.deepEqual([...fjern.tech], ["t1"]);

  const { data, antall } = sjekkerUten(
    { decades: ["1950", "1960"], genres: ["europeisk"], pages: [], tech: ["t1"] }, fjern);
  assert.equal(antall, 3);
  assert.deepEqual(data, { decades: ["1960"], genres: [], tech: [] });
});

test("godkjent studentforslag fjerner sjekken (store.js)", () => {
  const s = les("js/data/store.js");
  const kropp = s.slice(s.indexOf("export async function approvePendingEdit"), s.indexOf("export function sjekkVedGodkjenning"));
  assert.match(kropp, /toApply\.teacherChecked = false/);
  assert.match(kropp, /arrayRemove\(\.\.\.sjekk\.ider\)/);
});

test("datalaget: studentflatene leser sjekkene, lærersiden får rådataene", () => {
  const s = les("js/data/shared-data.js");
  assert.match(s, /if \(!laererside\) subscribeTeacherChecks\(brukSjekker\)/);
  assert.match(s, /sjekketRegelAktiv\(\) \? FILTER\[navn\]\(raa\[navn\], sjekkene\(\)\) : raa\[navn\]/);
  assert.match(les("js/teacher.js"), /laererside: true/);
});
