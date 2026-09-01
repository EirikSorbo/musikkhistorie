import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { artistStripHtml, spanText } from "../../js/artist-strip.js?v=5.08";
import { rebuild } from "../../js/genre-model.js?v=5.08";

// Artistkortets stripe plasserer innflytelsesperioden på en FAST akse:
// 1900–2030, altså 130 år. Prosentene under er regnet for hånd derfra, så en
// endring i aksen eller i regnestykket slår ut her og ikke først på skjermen.
const pst = (aar) => (((aar - 1900) / 130) * 100).toFixed(2);

const NÅ = 2026;   // fast «i dag» i testene, ellers endrer fasiten seg med tiden

test("perioden plasseres på året sitt, ikke i en tiårsbolk", () => {
  const html = artistStripHtml({ metaGenre: "Blues", influenceStart: 1955, influenceEnd: 1970 }, { nowYear: NÅ });
  assert.match(html, new RegExp(`left:${pst(1955)}%`));            // 42.31 %
  assert.match(html, new RegExp(`width:${(Number(pst(1970)) - Number(pst(1955))).toFixed(2)}%`));
  assert.doesNotMatch(html, /is-cut-/, "en periode innenfor aksen skal ha to lukkede ender");
  assert.match(html, /aria-label="Aktiv ca\. 1955–1970"/);
});

test("aksen skriver annethvert tiår, sentrert på sitt eget år", () => {
  const html = artistStripHtml({ metaGenre: "Blues", influenceStart: 1950 }, { nowYear: NÅ });
  const aar = [...html.matchAll(/<span style="left:[\d.]+%">(\d{4})<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(aar, ["1900", "1920", "1940", "1960", "1980", "2000", "2020"]);
  // Første årstall står på 0 %, ikke midt i en bolk: det er forskjellen fra
  // varmestripas akse, og grunnen til at den ikke kunne gjenbrukes her.
  assert.match(html, /<span style="left:0\.00%">1900<\/span>/);
  assert.match(html, new RegExp(`<span style="left:${pst(1980)}%">1980</span>`));
});

test("åpent sluttår løper til i dag og tegnes med flat høyrekant", () => {
  const html = artistStripHtml({ metaGenre: "Pop", influenceStart: 2006 }, { nowYear: NÅ });
  assert.match(html, /class="ai-bar is-cut-end"/);
  assert.match(html, new RegExp(`width:${(Number(pst(NÅ)) - Number(pst(2006))).toFixed(2)}%`));
  assert.match(html, /pågår \/ sluttår ikke satt/);
});

test("dødsåret er tak når innflytelsen mangler sluttår (samme regel som tidslinjen)", () => {
  const html = artistStripHtml({ metaGenre: "Jazz", influenceStart: 1940, deathYear: 1971 }, { nowYear: NÅ });
  assert.match(html, new RegExp(`width:${(Number(pst(1971)) - Number(pst(1940))).toFixed(2)}%`));
  assert.doesNotMatch(html, /is-cut-end/, "et dødsår er en KJENT slutt, ikke en åpen ende");
});

test("perioder som begynner før aksen klippes og får flat venstrekant", () => {
  // Buddy Bolden (1895) og Scott Joplin (1899) er de to i pensumet i dag.
  const html = artistStripHtml({ metaGenre: "Jazz", influenceStart: 1895, influenceEnd: 1907 }, { nowYear: NÅ });
  assert.match(html, /class="ai-bar is-cut-start"/);
  assert.match(html, /left:0\.00%/);
  assert.match(html, new RegExp(`width:${pst(1907)}%`));
});

test("ett enkelt år blir ikke usynlig", () => {
  const html = artistStripHtml({ metaGenre: "Jazz", influenceStart: 1950, influenceEnd: 1950 }, { nowYear: NÅ });
  assert.match(html, /width:1\.50%/);
  assert.match(html, /aria-label="Aktiv ca\. 1950"/);
});

test("uten startår tegnes ingen stripe (ikke en tom akse)", () => {
  assert.equal(artistStripHtml({ metaGenre: "Jazz" }, { nowYear: NÅ }), "");
  assert.equal(artistStripHtml(null, { nowYear: NÅ }), "");
  assert.equal(artistStripHtml({ influenceStart: 0 }, { nowYear: NÅ }), "");
});

test("fargen kommer fra metasjangeren i treet", () => {
  const html = artistStripHtml({ metaGenre: "Jazz", influenceStart: 1940 }, { nowYear: NÅ });
  assert.match(html, /background:#[0-9a-f]{6}2e;border-color:#[0-9a-f]{6}b3/i);
  assert.doesNotMatch(html, /#9bada1/, "Jazz har egen farge i treet og skal ikke falle til grå");
});

test("spanText sier «ca.» — årstallene er anslag", () => {
  assert.equal(spanText({ start: 1955, end: 1970, open: false }), "ca. 1955–1970");
  assert.equal(spanText({ start: 1950, end: 1950, open: false }), "ca. 1950");
  assert.equal(spanText({ start: 2006, end: 2026, open: true }), "ca. 2006 → pågår / sluttår ikke satt");
});

// Fargene kommer fra treet i Firestore, altså fra DATA, og limes inn i et
// style-attributt. Denne testen står sist fordi rebuild() bytter ut modellen
// for resten av fila.
test("en farge som ikke er #rrggbb slipper aldri inn i style-attributtet", () => {
  rebuild({
    nodes: [{ id: "x", l: "X", f: "X", g: "Tull", p: [] }],
    families: { gray: { stroke: "#9bada1", label: "Røtter" } },
    metaGenres: [{ name: "Tull", color: "red;background:url(//angriper)" }],
  });
  const html = artistStripHtml({ metaGenre: "Tull", influenceStart: 1950 }, { nowYear: NÅ });
  assert.doesNotMatch(html, /url\(/);
  assert.match(html, /background:#9bada12e/, "ugyldig farge skal falle tilbake på røttenes grå");
});
