import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES, parseGeography, aggregatePlaces, unknownPlaces } from "../../js/geo-places.js?v=3.11";

test("parseGeography: splitter på semikolon, trimmer og senker", () => {
  assert.deepEqual(parseGeography("New Orleans, Louisiana; Chicago, Illinois"),
    ["new orleans, louisiana", "chicago, illinois"]);
  assert.deepEqual(parseGeography("  Oslo, Norge "), ["oslo, norge"]);
  assert.deepEqual(parseGeography(""), []);
  assert.deepEqual(parseGeography(null), []);
});

test("aggregatePlaces: migrasjon teller artisten på BEGGE steder", () => {
  const a = { id: "x", name: "Muddy", geography: "Mississippi-deltaet; Chicago, Illinois", influenceStart: 1941, influenceEnd: 1982 };
  const { onMap } = aggregatePlaces([a]);
  const labels = onMap.map((p) => p.label).sort();
  assert.deepEqual(labels, ["Chicago", "Mississippi-deltaet"]);
});

test("aggregatePlaces: metro-sammenslåing og dedup per sted", () => {
  const arts = [
    { id: "1", geography: "Brooklyn, New York", influenceStart: 1980 },
    { id: "2", geography: "Queens, New York; New York", influenceStart: 1985 },
  ];
  const { onMap } = aggregatePlaces(arts);
  assert.equal(onMap.length, 1);
  assert.equal(onMap[0].label, "New York");
  assert.equal(onMap[0].count, 2); // artist 2 telles én gang tross to NYC-nøkler
});

test("aggregatePlaces: utland havner i abroad, ukjent i unplaced", () => {
  const arts = [
    { id: "1", geography: "Oslo, Norge", influenceStart: 1990 },
    { id: "2", geography: "Atlantis", influenceStart: 1990 },
    { id: "3", geography: "", influenceStart: 1990 },
  ];
  const { onMap, abroad, unplaced } = aggregatePlaces(arts);
  assert.equal(onMap.length, 0);
  assert.equal(abroad[0].label, "Oslo");
  assert.equal(abroad[0].abroad, "Norge");
  const uLabels = unplaced.map((u) => u.label).sort();
  assert.deepEqual(uLabels, ["(ikke angitt)", "atlantis"]);
});

test("aggregatePlaces: tiårsfilter bruker aktiv-perioden", () => {
  const arts = [
    { id: "1", geography: "Chicago, Illinois", influenceStart: 1948, influenceEnd: 1982 },
    { id: "2", geography: "Chicago, Illinois", influenceStart: 1990 },
  ];
  const i1950 = aggregatePlaces(arts, { decade: 1950 });
  assert.equal(i1950.onMap[0].count, 1); // kun artist 1 (1948–82) er aktiv på 1950-tallet
  const i1990 = aggregatePlaces(arts, { decade: 1990 });
  assert.equal(i1990.onMap[0].count, 1); // kun artist 2; uten sluttår telles bare start-tiåret (appens semantikk)
});

test("aggregatePlaces: artister uten id dedupes på objektidentitet", () => {
  const a = { geography: "New York; Brooklyn, New York", influenceStart: 1980 }; // ingen id
  const b = { geography: "New York", influenceStart: 1985 };
  const { onMap } = aggregatePlaces([a, b]);
  assert.equal(onMap[0].label, "New York");
  assert.equal(onMap[0].count, 2); // a én gang (tross to NYC-nøkler), b én gang
});

test("regioner er merket region:true, byer ikke", () => {
  assert.equal(PLACES["texas"].region, true);
  assert.equal(PLACES["mississippi-deltaet"].region, true);
  assert.equal(PLACES["chicago, illinois"].region, undefined);
});

test("unknownPlaces: rapporterer ukjente, ignorerer «udefinert»", () => {
  const arts = [
    { id: "1", geography: "udefinert" },
    { id: "2", geography: "Narnia; Oslo, Norge" },
  ];
  assert.deepEqual(unknownPlaces(arts), ["narnia"]);
});
