import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeArtist, META_RENAME } from "../../js/artist-normalize.js?v=3.49";

test("idempotent på allerede normalisert artist", () => {
  const a = {
    name: "Robert Johnson",
    metaGenre: "Blues",
    mainGenre: ["Blues"],
    subGenre: ["Delta blues"],
    keyWorks: [{ title: "Cross Road Blues", year: 1937 }],
    kilder: [{ text: "Ward 1998", url: "https://example.com" }],
    musicExamples: [{ label: "Lytt", url: "https://youtube.com/x", year: 1937, performanceYear: null }],
    imageUrl: "https://example.com/rj.jpg",
    imageCredit: "Wikipedia",
  };
  const once = normalizeArtist(a);
  const twice = normalizeArtist(once);
  assert.deepEqual(twice, once);
});

test("metaGenre omdøpes via META_RENAME", () => {
  for (const [old, ny] of Object.entries(META_RENAME)) {
    assert.equal(normalizeArtist({ metaGenre: old }).metaGenre, ny);
  }
});

test("søppel i mainGenre/subGenre filtreres bort (hindrer nedstrøms krasj)", () => {
  const n = normalizeArtist({
    mainGenre: ["Blues", null, "", "  ", 42, ["nested"], { x: 1 }],
    subGenre: [null, "Delta blues"],
  });
  assert.deepEqual(n.mainGenre, ["Blues"]);
  assert.deepEqual(n.subGenre, ["Delta blues"]);
});

test("keyWorks som streng splittes til objekter", () => {
  const n = normalizeArtist({ keyWorks: "Cross Road Blues, Hellhound on My Trail" });
  assert.deepEqual(n.keyWorks, [
    { title: "Cross Road Blues" },
    { title: "Hellhound on My Trail" },
  ]);
});

test("kilder som strenger blir {text}", () => {
  const n = normalizeArtist({ kilder: ["Ward 1998", { text: "Bok", url: "https://x.no" }] });
  assert.deepEqual(n.kilder, [
    { text: "Ward 1998" },
    { text: "Bok", url: "https://x.no" },
  ]);
});

test("gamle links konverteres til musicExamples", () => {
  const n = normalizeArtist({ links: [{ label: "Lytt", url: "https://y.tube" }] });
  assert.equal(n.musicExamples.length, 1);
  assert.equal(n.musicExamples[0].url, "https://y.tube");
  assert.equal("links" in n, false);
});

test("javascript:-URLer vaskes bort overalt", () => {
  const n = normalizeArtist({
    imageUrl: "javascript:alert(1)",
    musicExamples: [{ label: "Ond", url: "javascript:alert(1)" }, { label: "OK", url: "https://ok.no" }],
    keyWorks: [{ title: "Verk", url: "javascript:alert(1)" }],
    kilder: [{ text: "Kilde", url: "data:text/html,x" }],
  });
  assert.equal(n.imageUrl, "");
  assert.deepEqual(n.musicExamples.map((m) => m.url), ["https://ok.no"]);
  assert.equal("url" in n.keyWorks[0], false);
  assert.equal(n.kilder[0].url, "");
});

test("manglende felter gir tomme arrays", () => {
  const n = normalizeArtist({ name: "X" });
  assert.deepEqual(n.mainGenre, []);
  assert.deepEqual(n.subGenre, []);
  assert.deepEqual(n.keyWorks, []);
  assert.deepEqual(n.kilder, []);
  assert.deepEqual(n.musicExamples, []);
});
