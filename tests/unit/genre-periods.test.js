import { SEED_GENRE_DESCS } from "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GENEALOGY } from "../../js/genre-model.js?v=5.29";
import { storyOrder, STORY_SKJULT } from "../../js/story-format.js?v=5.29";
import { periodGroups, periodAxis, pctAv, periodColor, periodSignatur, PERIOD_COLORS } from "../../js/genre-periods.js?v=5.29";

// «Sjangerperioder» (v5.20) skal være DYNAMISK: sjangrene fra treet, årstallene
// fra beskrivelsene, metasjangrene fra de synlige historiene. Testene låser
// avledningen mot endringer i data, ikke dagens pensuminnhold.

const NAA = 2026;
const jazzFamilie = () => GENEALOGY.filter((n) => n.g === "Jazz");
const periode = (fra, til) => ({ main: { activeFrom: fra, activeTo: til } });

test("gruppene er de synlige historiene, og hver gruppe er nøyaktig metasjangerens noder", () => {
  const metas = storyOrder(SEED_GENRE_DESCS);
  const grupper = periodGroups(metas, SEED_GENRE_DESCS, GENEALOGY, NAA);
  assert.ok(grupper.length > 0);
  for (const skjult of STORY_SKJULT) {
    assert.ok(!grupper.some((g) => g.meta === skjult), `${skjult} skal ikke være med`);
  }
  for (const g of grupper) {
    assert.deepEqual(
      g.rows.map((r) => r.genre).sort(),
      GENEALOGY.filter((n) => n.g === g.meta).map((n) => n.l).sort(),
      g.meta,
    );
  }
});

test("radene sorteres kronologisk, uavhengig av treets rekkefølge", () => {
  const fam = jazzFamilie();
  assert.ok(fam.length >= 3, "frøet skal ha en jazzfamilie");
  const d = Object.fromEntries(fam.map((n, i) => [n.l, periode(2000 - i * 10, 2005 - i * 10)]));
  const [g] = periodGroups(["Jazz"], d, GENEALOGY, NAA);
  const fra = g.rows.map((r) => r.from);
  assert.deepEqual(fra, [...fra].sort((a, b) => a - b));
  assert.ok(g.rows.every((r) => r.status === "ok"));
});

test("åpen periode («i dag») er gyldig, og kommer etter en lukket med samme start", () => {
  const [a, b] = jazzFamilie();
  const [g] = periodGroups(["Jazz"], { [a.l]: periode(1960, null), [b.l]: periode(1960, 1970) }, GENEALOGY, NAA);
  assert.equal(g.rows[0].genre, b.l);
  assert.equal(g.rows[1].genre, a.l);
  assert.equal(g.rows[1].to, null);
  assert.equal(g.rows[1].status, "ok");
});

test("samme fra- og til-år er en gyldig periode", () => {
  const [a] = jazzFamilie();
  const [g] = periodGroups(["Jazz"], { [a.l]: periode(1955, 1955) }, GENEALOGY, NAA);
  assert.equal(g.rows[0].status, "ok");
});

test("hull merkes og legges nederst: mangler, ugyldig og fram i tid", () => {
  const [a, b, c, d, e] = jazzFamilie();
  const descs = {
    [a.l]: periode(1950, 1940),          // slutt før start
    [b.l]: periode(1930, 1960),          // gyldig
    [c.l]: periode(2062, null),          // tastefeil for 1962
    [d.l]: periode(1970, 2099),          // tastefeil for 1999
    [e.l]: { main: { activeFrom: 1935, activeTo: "1945" } },   // streng fra en import
  };
  const [g] = periodGroups(["Jazz"], descs, GENEALOGY, NAA);
  const status = (n) => g.rows.find((r) => r.genre === n.l).status;
  assert.equal(g.rows[0].genre, b.l, "den eneste gyldige kommer først");
  assert.equal(status(a), "ugyldig");
  assert.equal(status(c), "framtid");
  assert.equal(status(d), "framtid");
  assert.equal(status(e), "ugyldigSlutt", "et korrupt sluttår skal ikke bli «fortsatt aktiv»");
  assert.ok(g.rows.slice(1).every((r) => r.status !== "ok" && r.from === null && !r.color));
  assert.equal(g.rows.length, jazzFamilie().length, "ingen sjanger faller ut");
});

test("årstall fram i tid kan ikke strekke aksen for resten av figuren", () => {
  const [a, b] = jazzFamilie();
  const grupper = periodGroups(["Jazz"], { [a.l]: periode(1970, 2099), [b.l]: periode(1935, 1945) }, GENEALOGY, NAA);
  const axis = periodAxis(grupper, NAA);
  assert.equal(axis.slutt, NAA + 5);
  assert.equal(axis.ticks.at(-1), 2020);
});

test("dynamisk: en ny sjanger i treet dukker opp uten kodeendring", () => {
  const tre = [...GENEALOGY, { id: "testjazz", l: "Testjazz", g: "Jazz", p: [], r: 12 }];
  const [g] = periodGroups(["Jazz"], { Testjazz: periode(2015, null) }, tre, NAA);
  const rad = g.rows.find((r) => r.genre === "Testjazz");
  assert.ok(rad, "den nye sjangeren skal være med");
  assert.equal(rad.from, 2015);
});

test("dynamisk: flyttes en sjanger til en annen metasjanger, flytter raden med", () => {
  const flytt = jazzFamilie()[1];
  const tre = GENEALOGY.map((n) => (n.id === flytt.id ? { ...n, g: "Blues" } : n));
  const grupper = periodGroups(["Jazz", "Blues"], SEED_GENRE_DESCS, tre, NAA);
  assert.ok(!grupper.find((g) => g.meta === "Jazz").rows.some((r) => r.genre === flytt.l));
  assert.ok(grupper.find((g) => g.meta === "Blues").rows.some((r) => r.genre === flytt.l));
});

test("oppslaget er sjangerkortets: fullt navn (n.f) brukes når kortnavnet mangler beskrivelse", () => {
  const tre = [...GENEALOGY, { id: "kort", l: "Kort", f: "Et langt navn", g: "Jazz", p: [], r: 8 }];
  const [g] = periodGroups(["Jazz"], { "Et langt navn": periode(1961, 1969) }, tre, NAA);
  assert.equal(g.rows.find((r) => r.genre === "Kort").from, 1961);
});

test("egen farge per stolpe også når en familie vokser forbi paletten", () => {
  const tre = [...GENEALOGY.filter((n) => n.g !== "Jazz"),
    ...Array.from({ length: 30 }, (_, i) => ({ id: `j${i}`, l: `Jazz ${i}`, g: "Jazz", p: [], r: 5 }))];
  const descs = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`Jazz ${i}`, periode(1900 + i * 3, 1910 + i * 3)]));
  const [g] = periodGroups(["Jazz"], descs, tre, NAA);
  const farger = g.rows.map((r) => r.color);
  assert.equal(new Set(farger).size, 30, "ingen farge gjentas");
  assert.ok(farger.every((c) => /^#[0-9a-f]{6}$/.test(c)), "6-sifret hex, så toningen kan legge til alfa");
  assert.equal(periodColor(0), PERIOD_COLORS[0]);
});

test("aksen følger dataene: tidlig start drar den bakover, i dag setter slutten", () => {
  const a = periodAxis([{ meta: "X", rows: [
    { status: "ok", from: 1885, to: 1950 }, { status: "ok", from: 1990, to: null },
  ] }], NAA);
  assert.equal(a.start, 1880);
  assert.equal(a.ticks[0], 1880);
  assert.equal(a.ticks.at(-1), 2020, "siste tiårsmerke er siste hele tiår");
  assert.equal(pctAv(a, a.start), 0);
  assert.equal(pctAv(a, a.slutt), 100);
  assert.equal(periodAxis([{ meta: "X", rows: [{ status: "ok", from: 1935, to: 1960 }] }], NAA).start, 1900,
    "aksen starter aldri senere enn 1900, som varmekartet");
  assert.equal(periodAxis([{ meta: "X", rows: [{ status: "mangler", from: null, to: null }] }], NAA).start, 1900);
});

test("signaturen endres bare når figuren endres, ikke når bare beskrivelsesteksten gjør det", () => {
  const [a] = jazzFamilie();
  const lag = (descs) => { const g = periodGroups(["Jazz"], descs, GENEALOGY, NAA); return periodSignatur(g, periodAxis(g, NAA)); };
  const grunn = lag({ [a.l]: { main: { activeFrom: 1940, activeTo: 1955, description: "Første tekst" } } });
  assert.equal(grunn, lag({ [a.l]: { main: { activeFrom: 1940, activeTo: 1955, description: "Ny tekst" } } }));
  assert.notEqual(grunn, lag({ [a.l]: { main: { activeFrom: 1940, activeTo: 1956, description: "Første tekst" } } }));
});

// Dynamikken i visningen kan ikke kjøres i Node (DOM, snapshots), så koblingene
// låses på kildenivå.
test("sjangerperioder kobles til snapshotene, huben og lasteflagget", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  const ctx = les("js/explore-context.js");
  const kropp = (navn) => { const i = ctx.indexOf(`export function ${navn}()`); assert.ok(i > -1, navn); return ctx.slice(i, ctx.indexOf("\n}", i)); };
  assert.match(kropp("genreDescsChanged"), /renderSjangerperioderBody\(\)/, "nye årstall");
  assert.match(kropp("contentChanged"), /renderSjangerperioderBody\(\)/, "treet lastet eller mangler");
  const vis = les("js/explore-sjangerperioder.js");
  assert.match(vis, /onGenreModelChanged\(/, "endret tre");
  assert.match(vis, /pctAv\(axis, r\.to \+ 1\)/, "sluttåret er inklusivt");
  assert.match(les("js/shared-data.js"), /genreDescsLoaded/, "figuren må kunne skille «laster» fra «tomt»");
  assert.match(les("js/explore.js"), /paaKort\("sb-sjangerperioder", openSjangerperioder\)/);
  assert.match(les("js/explore.js"), /"modal-sjangerperioder"/, "modalen må kobles (lukking, bakgrunnsklikk)");
});
