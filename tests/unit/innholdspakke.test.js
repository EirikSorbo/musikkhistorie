// Validerer innholdspakke-JSON-en (json files/Innholdspakke *.json) mot appen:
// sidene og historiene skal rendre gjennom renderStoryHtml, og varmekart-
// radene skal matche tre-sjangrene med gyldige nivåer. Fila er gitignored
// (innhold, ikke kode) — finnes den ikke i utsjekket, hoppes testene over.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderStoryHtml, STORY_ORDER } from "../../js/story-format.js?v=3.40";
import { GENEALOGY_MAIN_GENRES } from "../../js/genealogy.js?v=3.40";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "json files");
let pakke = null;
try {
  const fil = readdirSync(dir).filter((f) => f.startsWith("Innholdspakke") && f.endsWith(".json")).sort().pop();
  if (fil) pakke = JSON.parse(readFileSync(join(dir, fil), "utf8"));
} catch { /* mappa finnes ikke i denne utsjekken */ }

const skip = pakke ? false : "Innholdspakke-JSON ikke til stede (gitignored innhold)";

test("innholdspakke: sidene finnes og rendrer med mellomtitler og lenker", { skip }, () => {
  for (const id of ["omHistorie", "rotter"]) {
    const body = pakke.pages?.[id]?.body;
    assert.ok(body && body.length > 1000, `${id} mangler/for kort`);
    const html = renderStoryHtml(body);
    assert.ok(html.includes("<h3>"), `${id}: ingen mellomtitler`);
    assert.ok(html.includes('rel="noopener"'), `${id}: ingen lyttelenker`);
    assert.equal(html.includes("]("), false, `${id}: uparset lenkesyntaks`);
    assert.equal(html.includes("**"), false, `${id}: uparset fet-syntaks`);
  }
});

test("innholdspakke: historie for alle seks hovedsjangre", { skip }, () => {
  for (const g of STORY_ORDER) {
    const body = pakke.genreDescriptions?.meta?.[g]?.story?.body;
    assert.ok(body && body.length > 1000, `${g} mangler historie`);
    assert.ok(renderStoryHtml(body).includes("<h3>"), `${g}: ingen mellomtitler`);
  }
});

test("innholdspakke: varmekart-rader er gyldige og matcher treet", { skip }, () => {
  const heat = pakke.varmekart?.heat;
  assert.ok(heat && Object.keys(heat).length >= 40, "varmekartet mangler rader");
  for (const [genre, row] of Object.entries(heat)) {
    assert.ok(GENEALOGY_MAIN_GENRES.includes(genre), `«${genre}» er ikke en tre-sjanger`);
    assert.equal(row.length, 13, `${genre}: raden må ha 13 tiår`);
    assert.ok(row.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 5)), `${genre}: ugyldig nivå`);
  }
  // Alle tre-sjangre skal ha en rad i pakken (fullt kart ved import).
  const missing = GENEALOGY_MAIN_GENRES.filter((g) => !heat[g]);
  assert.deepEqual(missing, [], `tre-sjangre uten varmekart-rad: ${missing.join(", ")}`);
});
