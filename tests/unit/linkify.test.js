import { test } from "node:test";
import assert from "node:assert/strict";
import { linkifyAll, medSelv, nevnteArtister } from "../../js/linkify.js?v=6.21";
import { relatedArtists } from "../../js/ui-helpers.js?v=6.21";

const artists = [
  { id: "a1", name: "Muddy Waters", status: "active" },
  { id: "a2", name: "B.B. King", status: "active" },
];

test("artistnavn i tekst blir klikkbare lenker", () => {
  const html = linkifyAll("Inspirert av Muddy Waters.", { artists });
  assert.ok(html.includes('data-artist-id="a1"'));
});

test("delord matcher ikke (ordgrenser)", () => {
  const html = linkifyAll("Muddy Watersfestivalen", { artists });
  assert.equal(html.includes("data-artist-id"), false);
});

test("genitiv-s etter navn matcher", () => {
  const html = linkifyAll("Muddy Waters’ gitar", { artists });
  assert.ok(html.includes('data-artist-id="a1"'));
});

test("skjulte artister linkes ikke", () => {
  const hidden = [{ id: "a3", name: "Skjult Artist", status: "active", priority: -1 }];
  const html = linkifyAll("Skjult Artist var viktig.", { artists: hidden });
  assert.equal(html.includes("data-artist-id"), false);
});

test("HTML i tekst escapes før linking", () => {
  const html = linkifyAll("<script>x</script> og Muddy Waters", { artists });
  assert.ok(html.startsWith("&lt;script&gt;"));
  assert.ok(html.includes('data-artist-id="a1"'));
});

// --- v6.05: kortet lenker ikke til seg selv (K7) og omtaler (K3) -----------

test("medSelv: kortets eget navn lenkes ikke, de andre gjør", () => {
  const ctx = { artists, genres: ["Bebop"] };
  const html = linkifyAll("Muddy Waters spilte med B.B. King. Bebop.", medSelv(ctx, { artist: "a1", genre: ["Bebop"] }));
  assert.equal(html.includes('data-artist-id="a1"'), false, "seg selv");
  assert.ok(html.includes('data-artist-id="a2"'), "andre artister");
  assert.equal(html.includes('data-genre="Bebop"'), false, "egen sjanger");
  assert.ok(html.startsWith("Muddy Waters spilte"), "teksten står urørt");
});

test("medSelv: et kortere navn lenkes ikke inni kortets eget navn", () => {
  const liste = [{ id: "x", name: "Dizzy Gillespie", status: "active" }, { id: "y", name: "Gillespie", status: "active" }];
  const html = linkifyAll("Dizzy Gillespie spilte.", medSelv({ artists: liste }, { artist: "x" }));
  assert.equal(html.includes("data-artist-id"), false);
});

test("nevnteArtister: samme treffregler som lenkingen", () => {
  assert.deepEqual(nevnteArtister("Lærte av Muddy Waters og B.B. King, og Muddy Waters igjen.", { artists }), ["a1", "a2"]);
  assert.deepEqual(nevnteArtister("Muddy Watersfestivalen", { artists }), []);
});

test("relatedArtists: de som nevnes i beskrivelsen kommer foran delt undersjanger", () => {
  const alle = [
    { id: "p", name: "Charlie Parker", status: "active", metaGenre: "Jazz", mainGenre: ["Bebop"], subGenre: ["Kansas City jazz"], influenceStart: 1944, description: "Sammen med Dizzy Gillespie." },
    { id: "d", name: "Dizzy Gillespie", status: "active", metaGenre: "Jazz", mainGenre: ["Bebop"], influenceStart: 1944 },
    { id: "k", name: "Count Basie", status: "active", metaGenre: "Jazz", mainGenre: ["Swing"], subGenre: ["Kansas City jazz"], influenceStart: 1944 },
    { id: "m", name: "Thelonious Monk", status: "active", metaGenre: "Jazz", mainGenre: ["Bebop"], influenceStart: 1947 },
  ];
  assert.deepEqual(relatedArtists(alle[0], alle).map((a) => a.id), ["d", "m", "k"]);
});
