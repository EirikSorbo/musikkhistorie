import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONFIG,
  isVisible,
  decadesForRange,
  computeCounts,
  checkWarnings,
  genderDistribution,
  filterArtists,
} from "../../js/limits.js?v=3.11";

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

test("checkWarnings varsler ved nådd grense, men blokkerer ikke", () => {
  const config = { ...DEFAULT_CONFIG, maxTotal: 1, maxPerMetaGenre: 1 };
  const artists = [{ status: "active", metaGenre: "Blues", instrument: "Gitar", influenceStart: 1930 }];
  const { warnings } = checkWarnings(artists, config, {
    metaGenre: "Blues", influenceStart: 1935, instrument: "Vokal",
  });
  assert.ok(warnings.some((w) => w.includes("totale")));
  assert.ok(warnings.some((w) => w.includes("Blues")));
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

test("voteOutThreshold er fjernet fra standardkonfig", () => {
  assert.equal("voteOutThreshold" in DEFAULT_CONFIG, false);
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
  const list = [
    { name: "Robert Johnson", metaGenre: "Blues", instrument: "Gitar", priority: 3, mainGenre: [], subGenre: [], geography: "Mississippi", influenceStart: 1936 },
    { name: "Bill Evans", metaGenre: "Jazz", instrument: "Piano", priority: 1, mainGenre: [], subGenre: [], geography: "New Jersey", influenceStart: 1958 },
  ];
  assert.deepEqual(filterArtists(list, { priority: 3 }).map((a) => a.name), ["Robert Johnson"]);
  assert.deepEqual(filterArtists(list, { instrument: "Piano" }).map((a) => a.name), ["Bill Evans"]);
  assert.deepEqual(filterArtists(list, { decade: 1950 }).map((a) => a.name), ["Bill Evans"]);
  assert.deepEqual(filterArtists(list, { search: "mississippi" }).map((a) => a.name), ["Robert Johnson"]);
  assert.equal(filterArtists(list, {}).length, 2); // ingen filtre → alt
});
