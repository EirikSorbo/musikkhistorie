// To instrumenter per artist og «Gruppe» (v6.39, brukervalg 2026-10-05).
// Ray Charles er sentral på både tangenter og vokal, og skal stå under begge;
// band og grupper har «Gruppe», tydelige vokalgrupper Vokal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { instrumenterFor, INSTRUMENTS, INSTRUMENT_TIMELINE_GROUPS, filterArtists, computeCounts } from "../../js/felles/limits.js";
import { ARTIST_COMPARE_FIELDS, ARTIST_EXPORT_FIELDS } from "../../js/data/artist-schema.js";
import { lesJs } from "../helpers/js-filer.js";

test("instrumenterFor gir begge, hovedinstrumentet først, uten tomme eller doble", () => {
  assert.deepEqual(instrumenterFor({ instrument: "Tangenter", instrument2: "Vokal" }), ["Tangenter", "Vokal"]);
  assert.deepEqual(instrumenterFor({ instrument: "Vokal", instrument2: "Vokal" }), ["Vokal"]);
  assert.deepEqual(instrumenterFor({ instrument: "Gitar", instrument2: "" }), ["Gitar"]);
  assert.deepEqual(instrumenterFor({}), []);
});

test("Gruppe er lovlig, men har ingen egen instrumentside", () => {
  assert.ok(INSTRUMENTS.includes("Gruppe"));
  assert.ok(!INSTRUMENT_TIMELINE_GROUPS.includes("Annet"));
});

test("filter og telling ser begge instrumentene", () => {
  const a = [
    { id: "1", name: "Ray Charles", status: "active", instrument: "Tangenter", instrument2: "Vokal" },
    { id: "2", name: "Aretha", status: "active", instrument: "Vokal" },
  ];
  assert.deepEqual(filterArtists(a, { instrument: "Vokal" }).map((x) => x.id).sort(), ["1", "2"]);
  const c = computeCounts(a);
  assert.equal(c.perInstrument.Vokal, 2);
  assert.equal(c.perInstrument.Tangenter, 1);
});

test("instrument2 følger med i eksport og fletting, og lærerskjemaet har feltet", () => {
  assert.ok(ARTIST_COMPARE_FIELDS.includes("instrument2"));
  assert.ok(ARTIST_EXPORT_FIELDS.includes("instrument2"));
  assert.match(lesJs("teacher-artists.js"), /instrument2: +\$\("#ed-instrument2"\)\.value/);
});
