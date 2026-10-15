// To nivåer for lytteeksempler (brukervalg 2026-10-15): «sentral» er et ja/nei-felt
// per eksempel. Fraværende = kontekst. Feltet skal overleve normalisering,
// skjemaets rad-normalisering, import og visningen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MUSIC_SPEC, musicSpecWithGenres, normalizeRows, rowInnerHtml } from "../../js/ui/row-editor.js";
import { normalizeArtist } from "../../js/data/artist-normalize.js";
import { musicExamplesHtml, sentralMerke, SENTRAL_MERKE } from "../../js/ui/ui-helpers.js";

const eks = (extra = {}) => ({ label: "So What", year: 1959, url: "https://www.youtube.com/watch?v=ylXk1LBvIqU", genre: "Modal jazz", ...extra });

test("normalizeArtist beholder sentral: true på lytteeksempler", () => {
  const n = normalizeArtist({ name: "Miles Davis", musicExamples: [eks({ sentral: true }), eks({ label: "Blue in Green" })] });
  assert.equal(n.musicExamples[0].sentral, true);
  assert.equal(n.musicExamples[1].sentral, undefined);
});

test("normalizeRows: sentral lagres som true, aldri som false, og forsvinner ikke", () => {
  const spec = musicSpecWithGenres(["Modal jazz"]);
  const ut = normalizeRows(spec, [eks({ sentral: true }), eks({ sentral: false }), eks({ sentral: "true" }), eks()]);
  assert.equal(ut[0].sentral, true);
  for (const i of [1, 2, 3]) assert.equal("sentral" in ut[i], false, `rad ${i}`);
});

test("normalizeRows er idempotent med sentral", () => {
  const spec = musicSpecWithGenres(["Modal jazz"]);
  const en = normalizeRows(spec, [eks({ sentral: true })]);
  assert.deepEqual(normalizeRows(spec, en), en);
});

test("rowInnerHtml: avkrysningen vises for læreren og er skjult (men til stede) ellers", () => {
  const laerer = rowInnerHtml(musicSpecWithGenres(["Modal jazz"], { laerer: true }), eks({ sentral: true }));
  assert.match(laerer, /<label class="row-check me-sentral-wrap"><input type="checkbox" class="me-sentral" checked/);
  const student = rowInnerHtml(musicSpecWithGenres(["Modal jazz"]), eks({ sentral: true }));
  assert.match(student, /<label class="row-check me-sentral-wrap" hidden><input type="checkbox" class="me-sentral" checked/);
  const ikke = rowInnerHtml(musicSpecWithGenres(["Modal jazz"], { laerer: true }), eks());
  assert.doesNotMatch(ikke, /class="me-sentral" checked/);
});

test("MUSIC_SPEC: sentral er et check-felt som ikke er et hjelpefelt (lagres)", () => {
  const f = MUSIC_SPEC.fields.find((x) => x.key === "sentral");
  assert.equal(f.type, "check");
  assert.ok(!f.ui);
});

test("musicExamplesHtml: bare sentrale eksempler får prikken", () => {
  const html = musicExamplesHtml({ musicExamples: [eks({ sentral: true }), eks({ label: "Blue in Green", url: "https://www.youtube.com/watch?v=abc123def45" })] });
  assert.equal(html.split(SENTRAL_MERKE).length - 1, 1);
  assert.match(html, /<a class="lytt-lenke"[^>]*>\s*<span class="sentral-merke"[^>]*><\/span>So What<\/a>/);
  assert.doesNotMatch(html, /sentral-merke[^]*Blue in Green[^]*sentral-merke/);
});

test("sentralMerke: tom for kontekst, null og sentral: false", () => {
  assert.equal(sentralMerke(eks()), "");
  assert.equal(sentralMerke(eks({ sentral: false })), "");
  assert.equal(sentralMerke(null), "");
  assert.equal(sentralMerke(eks({ sentral: true })), SENTRAL_MERKE);
});
