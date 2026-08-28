import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSTRUMENTS,
  DECADES,
  isVisible,
  decadesForRange,
  decadesForArtist,
  computeCounts,
  genderDistribution,
  filterArtists,
} from "../../js/limits.js?v=4.88";

test("isVisible: aktiv og ikke lærer-skjult", () => {
  assert.equal(isVisible({ status: "active" }), true);
  assert.equal(isVisible({ status: "active", priority: 2 }), true);
  assert.equal(isVisible({ status: "active", priority: -1 }), false);
  assert.equal(isVisible({ status: "pending" }), false);
  assert.equal(isVisible({ status: "removed" }), false);
});

test("decadesForRange spenner alle tiår", () => {
  assert.deepEqual(decadesForRange(1955, 1972), [1950, 1960, 1970]);
  assert.deepEqual(decadesForRange(1955), [1950]);
  assert.deepEqual(decadesForRange(null), []);
  assert.deepEqual(decadesForRange(1970, 1960), []); // slutt før start → tomt
});

test("decadesForArtist: tom influenceEnd løper til i dag", () => {
  // Kjernen i v3.95: uten sluttår skal artisten telle i ALLE tiår fra start og
  // fram til nå — ikke bare i startåret sitt, slik decadesForRange alene gjør.
  assert.deepEqual(
    decadesForArtist({ influenceStart: 1997 }, 2026),
    [1990, 2000, 2010, 2020]);
  assert.deepEqual(
    decadesForArtist({ influenceStart: 2012 }, 2026),
    [2010, 2020]);

  // Satt sluttår avslutter som før.
  assert.deepEqual(
    decadesForArtist({ influenceStart: 1955, influenceEnd: 1972 }, 2026),
    [1950, 1960, 1970]);

  // Dødsåret er tak når influenceEnd mangler — en avdød artist «pågår» ikke.
  assert.deepEqual(
    decadesForArtist({ influenceStart: 1936, deathYear: 1938 }, 2026),
    [1930]);

  // Uten startår kan artisten ikke plasseres i det hele tatt.
  assert.deepEqual(decadesForArtist({}, 2026), []);
  assert.deepEqual(decadesForArtist({ influenceEnd: 1980 }, 2026), []);
});

test("computeCounts teller kun synlige", () => {
  const artists = [
    { status: "active", metaGenre: "Blues", instrument: "Gitar", influenceStart: 1930 },
    { status: "active", priority: -1, metaGenre: "Blues", instrument: "Gitar", influenceStart: 1930 },
    { status: "pending", metaGenre: "Blues", instrument: "Gitar", influenceStart: 1930 },
  ];
  const c = computeCounts(artists);
  assert.equal(c.total, 1);
  assert.equal(c.perMetaGenre.Blues, 1);
  assert.equal(c.perDecade[1930], 1);
});

test("genderDistribution: ukjente kategorier telles som ukjent", () => {
  const d = genderDistribution([
    { status: "active", gender: "kvinne" },
    { status: "active", gender: "noe-rart" },
  ]);
  assert.equal(d.kvinne, 1);
  assert.equal(d.ukjent, 1);
  assert.equal(d.total, 2);
});

test("vokabularene bor i koden: INSTRUMENTS-konstanten og DECADES", () => {
  assert.ok(INSTRUMENTS.includes("Gitar"));
  assert.ok(INSTRUMENTS.includes("Tangenter"));
  assert.ok(INSTRUMENTS.includes("Saksofon"));
  assert.equal(new Set(INSTRUMENTS).size, INSTRUMENTS.length, "ingen duplikater");
  assert.equal(DECADES[0], 1900);
  assert.equal(DECADES[DECADES.length - 1], 2020);
});

test("filterArtists: sjanger matcher case-insensitivt i main/sub/meta", () => {
  const list = [
    { name: "A", metaGenre: "Blues", mainGenre: ["Delta blues"], subGenre: [], influenceStart: 1930 },
    { name: "B", metaGenre: "Jazz", mainGenre: ["Bebop"], subGenre: [], influenceStart: 1945 },
  ];
  assert.deepEqual(filterArtists(list, { mainGenre: "delta blues" }).map((a) => a.name), ["A"]);
  assert.deepEqual(filterArtists(list, { metaGenre: "Jazz" }).map((a) => a.name), ["B"]);
});

test("filterArtists: prioritet, instrument, tiår og søk", () => {
  // deathYear på Robert Johnson er ikke pynt: uten den ville han (start 1936,
  // ingen influenceEnd) regnes som pågående helt fram til i dag etter v3.95, og
  // tiårsfilteret under ville ikke lenger prøve det det skal prøve.
  const list = [
    { name: "Robert Johnson", metaGenre: "Blues", instrument: "Gitar", priority: 3, mainGenre: [], subGenre: [], geography: "Mississippi", influenceStart: 1936, deathYear: 1938 },
    { name: "Bill Evans", metaGenre: "Jazz", instrument: "Piano", priority: 1, mainGenre: [], subGenre: [], geography: "New Jersey", influenceStart: 1958, influenceEnd: 1980 },
  ];
  assert.deepEqual(filterArtists(list, { priority: 3 }).map((a) => a.name), ["Robert Johnson"]);
  assert.deepEqual(filterArtists(list, { instrument: "Piano" }).map((a) => a.name), ["Bill Evans"]);
  assert.deepEqual(filterArtists(list, { decade: 1950 }).map((a) => a.name), ["Bill Evans"]);
  assert.deepEqual(filterArtists(list, { search: "mississippi" }).map((a) => a.name), ["Robert Johnson"]);
  assert.equal(filterArtists(list, {}).length, 2); // ingen filtre → alt
});

test("filterArtists: artist uten sluttår er med i alle tiår fram til nå", () => {
  // Regresjonsvakt for v3.95. Før falt tiårsfilteret tilbake på startåret, så
  // en pågående artist var USYNLIG i alle tiår etter debuten sin.
  const list = [
    { name: "Beyoncé", mainGenre: [], subGenre: [], influenceStart: 1997 },
    { name: "Bessie Smith", mainGenre: [], subGenre: [], influenceStart: 1923, influenceEnd: 1933 },
  ];
  const nyeTiår = [1990, 2000, 2010, 2020];
  for (const d of nyeTiår) {
    assert.deepEqual(filterArtists(list, { decade: d }).map((a) => a.name), ["Beyoncé"], `tiår ${d}`);
  }
  assert.deepEqual(filterArtists(list, { decade: 1920 }).map((a) => a.name), ["Bessie Smith"]);
  assert.deepEqual(filterArtists(list, { decade: 1960 }).map((a) => a.name), []);
});

// --- Sjangernavn som finnes på TO nivåer -----------------------------------
// Seks navn er både node i sjangertreet og metasjanger (Blues, Gospel, Jazz,
// Pop, R&B, Rock). Treffer man dem mot metaGenre, svarer «Jazz» med hele
// jazzfamilien i stedet for tidlig jazz. Metasjangeren har sitt eget filter.

test("Sjanger-filteret leser tre-taggene, ikke metasjangeren", () => {
  const artister = [
    { name: "Tidlig",  metaGenre: "Jazz", mainGenre: ["Jazz"],   subGenre: [] },
    { name: "Bebop",   metaGenre: "Jazz", mainGenre: ["Bebop"],  subGenre: [] },
    { name: "Cool",    metaGenre: "Jazz", mainGenre: ["Cool jazz"], subGenre: [] },
  ];
  assert.deepEqual(
    filterArtists(artister, { mainGenre: "Jazz" }).map((a) => a.name),
    ["Tidlig"],
    "«Jazz»-noden er tidlig jazz, ikke paraplyen"
  );
  // Paraplyen finnes fortsatt — som metasjanger.
  assert.equal(filterArtists(artister, { metaGenre: "Jazz" }).length, 3);
});

test("Sjanger-filteret treffer undersjanger og tåler ulik store bokstaver", () => {
  const artister = [
    { name: "A", metaGenre: "R&B", mainGenre: ["Soul"], subGenre: ["Southern soul"] },
    { name: "B", metaGenre: "R&B", mainGenre: ["Funk"], subGenre: [] },
  ];
  assert.deepEqual(filterArtists(artister, { mainGenre: "southern soul" }).map((a) => a.name), ["A"]);
  assert.deepEqual(filterArtists(artister, { mainGenre: "Funk" }).map((a) => a.name), ["B"]);
});
