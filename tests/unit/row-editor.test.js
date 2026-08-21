import { test } from "node:test";
import assert from "node:assert/strict";
import { rowInnerHtml, normalizeSources, WORK_SPEC, MUSIC_SPEC, SOURCE_SPEC, musicSpecWithGenres } from "../../js/row-editor.js?v=4.63";
import { KILDE_KATEGORIER } from "../../js/kilder.js?v=4.63";

test("rowInnerHtml escaper verdier (lukker XSS-fella)", () => {
  const html = rowInnerHtml(SOURCE_SPEC, { text: `"><img src=x onerror=alert(1)>`, url: "https://ex.com" });
  assert.equal(html.includes("<img"), false, "rå HTML skal ikke slippe gjennom");
  assert.match(html, /&quot;&gt;&lt;img/);
  assert.match(html, /value="https:\/\/ex\.com"/);
});

test("rowInnerHtml bygger riktige felter og fjern-knapp per spec", () => {
  const work = rowInnerHtml(WORK_SPEC, { title: "Cross Road Blues", year: 1936 });
  assert.match(work, /class="work-title"[^>]*value="Cross Road Blues"/);
  assert.match(work, /class="work-year"[^>]*value="1936"/);
  assert.match(work, /min="1800" max="2030"/);
  assert.match(work, /class="btn ghost small remove-work"/);

  const me = rowInnerHtml(MUSIC_SPEC, {});
  for (const cls of ["me-label", "me-year", "me-url", "me-perf-year", "me-genre"]) {
    assert.match(me, new RegExp(`class="${cls}"`));
  }
});

test("genre-select: options fylles, verdi utenfor lista beholdes, escaping holder", () => {
  const spec = musicSpecWithGenres(["Blues", "Cool jazz"]);
  const tom = rowInnerHtml(spec, {});
  assert.match(tom, /<select class="me-genre"/);
  assert.match(tom, /<option value="Blues">Blues<\/option>/);
  assert.match(tom, /<option value="Cool jazz">Cool jazz<\/option>/);

  const valgt = rowInnerHtml(spec, { genre: "Cool jazz" });
  assert.match(valgt, /<option value="Cool jazz" selected>/);

  // Verdi som ikke står i options (f.eks. sjanger fjernet fra treet) skal
  // ikke forsvinne stille ved re-lagring.
  const utenfor = rowInnerHtml(spec, { genre: "Skiffle" });
  assert.match(utenfor, /<option value="Skiffle" selected>/);

  const stygg = rowInnerHtml(musicSpecWithGenres([`"><img src=x>`]), {});
  assert.equal(stygg.includes("<img"), false, "options skal escapes");
});

test("tomme verdier gir tomme value-attributter", () => {
  const html = rowInnerHtml(SOURCE_SPEC, {});
  for (const cls of ["source-text", "source-forfatter", "source-year", "source-url"]) {
    assert.match(html, new RegExp(`class="${cls}"[^>]*value=""`));
  }
});

test("kilde-raden har kategori-nedtrekk med hele vokabularet", () => {
  const html = rowInnerHtml(SOURCE_SPEC, { kategori: "Bøker" });
  assert.match(html, /<select class="source-kat"/);
  for (const kat of KILDE_KATEGORIER) {
    assert.match(html, new RegExp(`<option value="${kat}"`));
  }
  assert.match(html, /<option value="Bøker" selected>/);
});

// normalizeSources skal gi NØYAKTIG formen collectRows leverer for SOURCE_SPEC,
// så en urørt kilde-liste aldri diffes som endret i forslagseditoren.
test("normalizeSources: manglende liste og tomme rader blir tom liste", () => {
  assert.deepEqual(normalizeSources(undefined), []);
  assert.deepEqual(normalizeSources(null), []);
  assert.deepEqual(normalizeSources("SNL"), []);
  assert.deepEqual(normalizeSources([{ url: "https://ex.com" }, { text: "" }]), []);
});

test("normalizeSources: strenger og objekter fylles ut med de faste feltene", () => {
  const tom = { forfatter: "", url: "", kategori: "" };
  assert.deepEqual(normalizeSources(["SNL"]), [{ text: "SNL", ...tom }]);
  assert.deepEqual(normalizeSources([{ text: "SNL" }]), [{ text: "SNL", ...tom }]);
  assert.deepEqual(
    normalizeSources([{ text: "SNL", url: "https://snl.no" }]),
    [{ text: "SNL", ...tom, url: "https://snl.no" }]
  );
});

// Kategorien er det Referanser-kortet grupperer på, og forfatter/år vises etter
// tittelen: mister normalizeSources dem, diffes en urørt kilde som endret.
test("normalizeSources: kategori, forfatter og årstall bæres videre", () => {
  assert.deepEqual(
    normalizeSources([{ text: "SNL", url: "https://snl.no", kategori: "Nettsteder", forfatter: "Arne Forsgren", year: 2021 }]),
    [{ text: "SNL", forfatter: "Arne Forsgren", year: 2021, url: "https://snl.no", kategori: "Nettsteder" }]
  );
  // Årstall tas KUN med når det er et gyldig tall (som collectRows gjør).
  assert.equal("year" in normalizeSources([{ text: "SNL", year: "" }])[0], false);
  assert.equal(normalizeSources([{ text: "SNL", year: "1998" }])[0].year, 1998);
});
