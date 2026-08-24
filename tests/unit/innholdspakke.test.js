// Validerer nyeste innholdseksport (json files/musikkhistorie-*.json, også de
// eldre Innholdspakke-*.json) mot appen: sidene og historiene skal rendre
// gjennom rich-text, og varmekart-radene skal matche tre-sjangrene med gyldige
// nivåer. Fila er gitignored (innhold, ikke kode) — finnes ingen i utsjekket,
// hoppes testene over. (Testene sov i praksis fra eksporten byttet filnavn
// til musikkhistorie-<dato>.json uten at mønsteret her ble med.)
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { STORY_ORDER } from "../../js/story-format.js?v=4.75";
import { renderRichText } from "../../js/rich-text.js?v=4.75";
import { GENEALOGY_MAIN_GENRES } from "../../js/genre-model.js?v=4.75";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "json files");
let pakke = null;
try {
  const kandidater = readdirSync(dir)
    .filter((f) => (f.startsWith("musikkhistorie") || f.startsWith("Innholdspakke")) && f.endsWith(".json"));
  // Nyeste etter mtime, ikke navn — BACKUP-varianter sorterer ellers feil.
  const fil = kandidater
    .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => a.m - b.m).pop()?.f;
  if (fil) pakke = JSON.parse(readFileSync(join(dir, fil), "utf8"));
} catch { /* mappa finnes ikke i denne utsjekken */ }

const skip = pakke ? false : "ingen innholdseksport til stede (gitignored innhold)";

test("innholdspakke: sidene finnes og rendrer med mellomtitler og lenker", { skip }, () => {
  for (const id of ["omHistorie", "rotter"]) {
    const body = pakke.pages?.[id]?.body;
    assert.ok(body && body.length > 1000, `${id} mangler/for kort`);
    const html = renderRichText(body);
    assert.ok(html.includes("<h3>"), `${id}: ingen mellomtitler`);
    assert.ok(html.includes('rel="noopener"'), `${id}: ingen lyttelenker`);
    assert.equal(html.includes("]("), false, `${id}: uparset lenkesyntaks`);
    assert.equal(html.includes("**"), false, `${id}: uparset fet-syntaks`);
  }
});

test("innholdspakke: historie for hele den kuraterte lista", { skip }, () => {
  for (const g of STORY_ORDER) {
    const body = pakke.genreDescriptions?.meta?.[g]?.story?.body;
    assert.ok(body && body.length > 1000, `${g} mangler historie`);
    assert.ok(renderRichText(body).includes("<h3>"), `${g}: ingen mellomtitler`);
  }
});

test("innholdspakke: varmekart-rader er gyldige og matcher treet", { skip }, (t) => {
  const heat = pakke.varmekart?.heat;
  assert.ok(heat && Object.keys(heat).length >= 40, "varmekartet mangler rader");
  // Pakkas eget tre er fasiten når den bærer et; ellers kodefrøet. (En pakke
  // importeres atomisk med sitt eget tre — det er DEN konsistensen som teller.)
  const pakkeVokab = (pakke.genealogy?.nodes || []).filter((n) => n.g).map((n) => n.l);
  const vokab = pakkeVokab.length ? pakkeVokab : GENEALOGY_MAIN_GENRES;
  const ukjente = [];
  for (const [genre, row] of Object.entries(heat)) {
    if (!vokab.includes(genre)) ukjente.push(genre);
    assert.equal(row.length, 13, `${genre}: raden må ha 13 tiår`);
    assert.ok(row.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 5)), `${genre}: ugyldig nivå`);
  }
  // Ukjente nøkler er SKITT (foreldreløse rader etter navnebytter), ikke brudd:
  // visningen ignorerer dem og importen skader ingenting. De flagges så de kan
  // ryddes — en hard feil her ville blokkert pushene for et datavask-problem.
  if (ukjente.length) {
    t.diagnostic(`foreldreløse varmekart-rader (rydd i live-data): ${ukjente.join(", ")}`);
  }
  // Alle tre-sjangre skal ha en rad i pakken (fullt kart ved import).
  const missing = vokab.filter((g) => !heat[g]);
  assert.deepEqual(missing, [], `tre-sjangre uten varmekart-rad: ${missing.join(", ")}`);
});
