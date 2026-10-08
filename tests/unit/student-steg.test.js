// ============================================================================
//  STEGVIS ARTISTSKJEMA (v6.57) — student.html
// ----------------------------------------------------------------------------
//  Skjemaet for nye artister er delt i fem steg (brukervalg 2026-10-08). Her
//  låses inndelingen og fellene rundt den. Kildesjekk: siden kan ikke lastes i
//  Node, så markup og student.js leses som tekst.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lesJs } from "../helpers/js-filer.js";

const html = readFileSync(new URL("../../student.html", import.meta.url), "utf8");
const skjema = html.slice(html.indexOf('<form id="add-form"'), html.indexOf("</form>"));
const seksjoner = skjema.split('<section class="steg"').slice(1);

const STEGENE = [
  ["Artisten", ["in-name", "in-gender", "in-birthyear", "in-deathyear", "in-geo"]],
  ["Sjanger og periode", ["in-metaGenre", "in-instrument", "in-start", "in-end", "in-mainGenre", "in-subGenre"]],
  ["Beskrivelse", ["skrivehjelp", "in-desc"]],
  ["Verk og lytteeksempler", ["work-rows", "me-rows"]],
  ["Kilder og innsending", ["source-rows", "in-image-url", "in-image-credit", "oppsummering", "in-by", "retur-comment"]],
];

test("skjemaet har fem steg i avtalt rekkefølge, med feltene i riktig steg", () => {
  assert.equal(seksjoner.length, STEGENE.length, "antall steg");
  STEGENE.forEach(([tittel, felt], i) => {
    const s = seksjoner[i];
    assert.match(s, new RegExp(`class="steg-tittel"[^>]*>${tittel}</h3>`), `steg ${i + 1} skal hete «${tittel}»`);
    for (const id of felt) assert.ok(s.includes(`id="${id}"`), `${id} skal stå i steget «${tittel}»`);
  });
});

test("bare første steg er synlig før skriptet har kjørt", () => {
  seksjoner.forEach((s, i) => {
    const start = s.slice(0, s.indexOf(">"));
    assert.equal(/\bhidden\b/.test(start), i > 0, `steg ${i + 1}`);
  });
});

// Uten novalidate stopper nettleseren innsendingen på et tomt påkrevd felt i
// et SKJULT steg, uten å kunne vise studenten hvor feilen er.
test("skjemaet har novalidate og nøyaktig én send-knapp", () => {
  assert.match(html, /<form id="add-form"[^>]*\bnovalidate\b/);
  assert.equal((skjema.match(/type="submit"/g) || []).length, 1);
  assert.match(skjema, /id="send-knapp"[^>]*hidden/, "send-knappen vises først i siste steg");
});

test("student.js: én sjekk per steg, duplikatsjekk ved «Neste», utkast i localStorage", () => {
  const js = lesJs("student.js");
  const sjekker = js.slice(js.indexOf("const STEG_SJEKK = ["), js.indexOf("];", js.indexOf("const STEG_SJEKK = [")));
  assert.equal((sjekker.match(/^\s{2}\(\) =>/gm) || []).length, STEGENE.length, "STEG_SJEKK skal ha én sjekk per steg");
  // Navnet sjekkes mot artistlista når studenten går videre fra første steg.
  assert.match(js, /steg\.aktivt === 0 && !\(await sjekkDuplikat\(\)\)/);
  // Innsendingen sjekker ALLE stegene, ikke bare det siste.
  assert.match(js, /forsteFeil\(0, STEG_SJEKK\.length\)/);
  // Utkastet: egen nøkkel per returnert forslag, og slettes etter innsending.
  assert.match(js, /const UTKAST_NY = "pensum-artistutkast"/);
  assert.match(js, /pensum-artistutkast:retur:\$\{id\}/);
  assert.ok((js.match(/slettUtkast\(\);/g) || []).length >= 3, "utkastet slettes ved innsending, ny innsending og tømming");
  // Hvert felt utkastet tar vare på, må finnes i skjemaet.
  const felt = js.slice(js.indexOf("const UTKAST_FELT = ["), js.indexOf("];", js.indexOf("const UTKAST_FELT = [")));
  for (const [, id] of felt.matchAll(/"([^"]+)"/g)) assert.ok(skjema.includes(`id="${id}"`), `utkastfeltet ${id} finnes ikke i skjemaet`);
});
