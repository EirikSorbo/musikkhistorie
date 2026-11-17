// Antall episoder på dokumentarer (v7.41, brukerbestilling 2026-11-17): skiller
// en film på 60 minutter fra en serie på 10 x 60, og står i parentes rett
// etter tittelen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { episodeTekst, buildKilderList } from "../../js/felles/util.js";
import { samleKilder } from "../../js/felles/kilder.js";
import { SOURCE_SPEC, normalizeSources } from "../../js/ui/row-editor.js";
import { normalizeArtist } from "../../js/data/artist-normalize.js";

test("episodeTekst: entall, flertall og ugyldige verdier", () => {
  assert.equal(episodeTekst({ episoder: 10 }), "10 episoder");
  assert.equal(episodeTekst({ episoder: "1" }), "1 episode");
  for (const v of [undefined, null, "", 0, -3, "abc"]) assert.equal(episodeTekst({ episoder: v }), "");
  assert.equal(episodeTekst(null), "");
});

test("kildelista på kortene: parentesen står rett etter tittelen, før forfatter og år", () => {
  const html = buildKilderList([{ text: "Jazz", url: "https://www.pbs.org/kenburns/jazz", forfatter: "Ken Burns", year: 2001, episoder: 10 }]);
  assert.match(html, /<\/a> <span class="kilde-episoder">\(10 episoder\)<\/span> <span class="kilde-detalj">\(Ken Burns, 2001\)<\/span>/);
  assert.ok(!buildKilderList([{ text: "En film", kategori: "Dokumentarer" }]).includes("episode"));
});

test("Referanser: raden får antall episoder", () => {
  const { seksjoner } = samleKilder([{ text: "Jazz", kategori: "Dokumentarer", episoder: 10 }, { text: "En film", kategori: "Dokumentarer" }]);
  const rader = seksjoner.find((s) => s.navn === "Dokumentarer").rader;
  assert.deepEqual(rader.map((r) => [r.tittel, r.episoder]), [["En film", ""], ["Jazz", "10 episoder"]]);
});

test("feltet: bare for Dokumentarer, tas bort ved lagring for andre kategorier", () => {
  const felt = SOURCE_SPEC.fields.find((f) => f.key === "episoder");
  assert.equal(felt.type, "number");
  assert.equal(felt.min, 1);
  assert.deepEqual(normalizeSources([{ text: "Jazz", kategori: "Dokumentarer", episoder: "10" }]),
    [{ text: "Jazz", forfatter: "", url: "", kategori: "Dokumentarer", episoder: 10 }]);
  assert.deepEqual(normalizeSources([{ text: "Bok", kategori: "Bøker", episoder: 4 }]),
    [{ text: "Bok", forfatter: "", url: "", kategori: "Bøker" }]);
  // Gammelt navn på kategorien teller som Dokumentarer.
  assert.equal(normalizeSources([{ text: "Serie", kategori: "Videoer", episoder: 3 }])[0].episoder, 3);
});

test("artistkortenes kilder beholder antall episoder", () => {
  const a = normalizeArtist({ name: "X", kilder: [{ text: "Jazz", kategori: "Dokumentarer", episoder: "10" }] });
  assert.equal(a.kilder[0].episoder, 10);
});
