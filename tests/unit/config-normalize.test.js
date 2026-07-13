import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig } from "../../js/config-normalize.js?v=3.13";
import { GENEALOGY_META_GENRES } from "../../js/genealogy.js?v=3.13";
import { META_RENAME } from "../../js/artist-normalize.js?v=3.13";

test("gamle nøkler migreres til nye og fjernes", () => {
  const c = normalizeConfig({
    genres: ["Blues"],
    genreLimits: { Blues: 5 },
    maxPerGenre: 10,
  });
  assert.equal("genres" in c, false);
  assert.equal("genreLimits" in c, false);
  assert.equal("maxPerGenre" in c, false);
  assert.deepEqual(c.metaGenreLimits, { Blues: 5 });
  assert.equal(c.maxPerMetaGenre, 10);
  assert.ok(c.metaGenres.includes("Blues"));
});

test("nye nøkler vinner når begge finnes", () => {
  const c = normalizeConfig({
    genres: ["Gammel"],
    metaGenres: ["Ny"],
    maxPerGenre: 1,
    maxPerMetaGenre: 7,
  });
  assert.equal(c.maxPerMetaGenre, 7);
  assert.ok(c.metaGenres.includes("Ny"));
  assert.equal(c.metaGenres.includes("Gammel"), false);
});

test("treets metasjangre er alltid med, lærertillegg beholdes uten duplikater", () => {
  const c = normalizeConfig({ metaGenres: ["Egen sjanger", GENEALOGY_META_GENRES[0]] });
  for (const g of GENEALOGY_META_GENRES) assert.ok(c.metaGenres.includes(g), g);
  assert.ok(c.metaGenres.includes("Egen sjanger"));
  const unique = new Set(c.metaGenres);
  assert.equal(unique.size, c.metaGenres.length);
});

test("omdøpte metasjangre migreres via META_RENAME", () => {
  for (const [old, ny] of Object.entries(META_RENAME)) {
    const c = normalizeConfig({ metaGenres: [old] });
    assert.equal(c.metaGenres.includes(old), false, old);
    assert.ok(c.metaGenres.includes(ny), ny);
  }
});

test("config uten sjangerfelter får treets metasjangre", () => {
  const c = normalizeConfig({ maxTotal: 99 });
  assert.equal(c.maxTotal, 99);
  assert.deepEqual([...c.metaGenres].sort(), [...GENEALOGY_META_GENRES].sort());
});
