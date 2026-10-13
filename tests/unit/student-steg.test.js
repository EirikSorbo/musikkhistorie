// ============================================================================
//  ARTISTSKJEMAET I FEM STEG (v6.57; felles skjema fra v6.96)
// ----------------------------------------------------------------------------
//  Skjemaet for artister er delt i fem steg (brukervalg 2026-10-08), og fra
//  v6.96 (brukervalg 2026-10-13) er det samme skjema overalt: studentskjemaet,
//  lærerens redigering og nye artist, og «Foreslå endring». Her låses
//  inndelingen og fellene rundt den. Kildesjekk: modulen bygger DOM og kan
//  ikke kjøres i Node, så markupen og koden leses som tekst.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lesJs } from "../helpers/js-filer.js";
import { fraUtkastV1 } from "../../js/ui/artist-skjema.js";

const src = lesJs("artist-skjema.js");
const markup = src.slice(src.indexOf("function markup(modus)"), src.indexOf("// ----", src.indexOf("function markup(modus)")));
const seksjoner = markup.split('<section class="steg"').slice(1);

const STEGENE = [
  ["STEGNAVN[0]", ["name", "gender", "birthYear", "deathYear", "geography"]],
  ["STEGNAVN[1]", ["metaGenre", "instrument", "instrument2", "recordLabel", "influenceStart", "influenceEnd", "mainGenre", "subGenre"]],
  ["STEGNAVN[2]", ["description", "punkter"]],
  ["STEGNAVN[3]", []],
  ["STEGNAVN[4]", ["imageUrl", "imageCredit", "proposedBy", "studentComment"]],
];

test("fem steg i avtalt rekkefølge, med feltene i riktig steg", () => {
  assert.match(src, /const STEGNAVN = \["Artisten", "Sjanger og periode", "Beskrivelse", "Lytteeksempler", "Kilder og innsending"\];/);
  assert.equal(seksjoner.length, STEGENE.length, "antall steg");
  STEGENE.forEach(([tittel, felt], i) => {
    const s = seksjoner[i];
    assert.ok(s.includes(`\${${tittel}}`), `steg ${i + 1} skal ha tittelen ${tittel}`);
    for (const f of felt) assert.ok(s.includes(`data-felt="${f}"`), `${f} skal stå i steg ${i + 1}`);
  });
  assert.ok(seksjoner[3].includes('data-rader="musicExamples"'), "lytteeksemplene i steg 4");
  assert.ok(seksjoner[4].includes('data-rader="kilder"'), "kildene i steg 5");
  assert.ok(seksjoner[2].indexOf("data-as-skrivehjelp") < seksjoner[2].indexOf('data-felt="description"'),
    "skriveveiledningen rett over beskrivelsen");
});

test("«Sentrale verk» står ikke i skjemaet (fases ut, brukervalg 2026-10-13)", () => {
  assert.doesNotMatch(src, /keyWorks|WORK_SPEC|Sentrale verk \//);
});

test("bare første steg er synlig før skriptet har kjørt, og skjemaet har novalidate", () => {
  seksjoner.forEach((s, i) => {
    const start = s.slice(0, s.indexOf(">"));
    assert.equal(/\bhidden\b/.test(start), i > 0, `steg ${i + 1}`);
  });
  // Uten novalidate stopper nettleseren innsendingen på et tomt påkrevd felt i
  // et SKJULT steg, uten å kunne vise hvor feilen er.
  assert.match(markup, /<form class="steg-skjema" novalidate>/);
  assert.equal((markup.match(/type="submit"/g) || []).length, 1);
  assert.match(markup, /class="btn primary as-send" data-as-send hidden>/, "send-knappen vises først i siste steg");
});

test("fri hopping: alle stegene er knapper, og sjekken kommer ved innsending", () => {
  const steglista = src.slice(src.indexOf("function tegnStegliste()"), src.indexOf("async function gaTil("));
  assert.doesNotMatch(steglista, /disabled/, "ingen steg er låst");
  const gaTil = src.slice(src.indexOf("async function gaTil("), src.indexOf("async function sjekkDuplikat("));
  assert.doesNotMatch(gaTil, /finnFeil|forsteFeil/, "hopping sjekker ikke feltene");
  // Den myke duplikatsjekken når man forlater første steg i et nytt skjema.
  assert.match(gaTil, /tilstand\.aktivt === 0 && maal > 0 && !\(await sjekkDuplikat\(\)\)/);
  // Innsendingen sjekker ALT og lister det som mangler.
  assert.match(src, /const feil = finnFeil\(\);\n\s*if \(feil\.length\) return visFeil\(feil\);/);
  assert.match(src, /Fyll ut \$\{mangler\.length === 1 \? "dette" : "disse"\} før du/);
});

test("obligatoriske felt per modus", () => {
  assert.match(src, /if \(modus === "forslag"\) return new Set\(\["proposedBy"\]\);/);
  assert.match(src, /if \(LAERERMODUS\.includes\(modus\)\) return new Set\(\["name", "gender", "metaGenre", "influenceStart"\]\);/);
});

test("lærerfeltene bare for læreren, plateselskapet også i «Foreslå endring»", () => {
  assert.match(markup, /\$\{laerer \? `<label>Instrument 2/);
  assert.match(markup, /\$\{laerer \|\| modus === "forslag" \? `<label>Plateselskap/);
  assert.match(markup, /\$\{laerer \? `<div class="full punktfelt">/);
});

test("utkast: nye skjemaer lagres i localStorage, og gamle utkast oversettes", () => {
  const student = lesJs("student.js");
  assert.match(student, /const UTKAST_NY = "pensum-artistutkast"/);
  assert.match(student, /pensum-artistutkast:retur:\$\{id\}/);
  assert.match(lesJs("teacher-artists.js"), /const UTKAST_LAERER = "pensum-artistutkast:laerer"/);
  const u = fraUtkastV1({
    v: 1,
    felt: { "in-name": "Robert Johnson", "in-subGenre": "Delta blues, Akustisk blues", "in-by": "Ola", "in-start": "1936" },
    sjangre: ["Blues"], verk: [{ title: "x" }], eksempler: [{ label: "Cross Road Blues" }], kilder: [{ text: "SNL" }],
    steg: 3, maks: 3, godkjentNavn: "robert johnson",
  });
  assert.equal(u.v, 2);
  assert.equal(u.verdier.name, "Robert Johnson");
  assert.deepEqual(u.verdier.subGenre, ["Delta blues", "Akustisk blues"]);
  assert.deepEqual(u.verdier.mainGenre, ["Blues"]);
  assert.equal(u.verdier.proposedBy, "Ola");
  assert.deepEqual(u.besokt, [0, 1, 2, 3]);
  assert.equal("verk" in u, false, "verkene er ute av skjemaet");
});

test("redigering spør før vinduet lukkes med ulagrede endringer", () => {
  const vindu = src.slice(src.indexOf("export function apneArtistSkjema("));
  assert.match(vindu, /m\._beforeClose = \(\) => \{\n\s*if \(!api\.harEndringer\(\)\) return true;/);
  // Ny artist på lærersiden har utkast og lukkes uten spørsmål.
  assert.match(lesJs("teacher-artists.js"), /document\.getElementById\("modal-artist-skjema"\)\._beforeClose = null;/);
});

test("student.html har lukk-knappen og beholderen, ikke det gamle skjemaet", () => {
  const html = readFileSync(new URL("../../student.html", import.meta.url), "utf8");
  assert.match(html, /id="skjema-lukk"/);
  assert.match(html, /<div id="artist-skjema">/);
  assert.doesNotMatch(html, /id="add-form"/);
});
