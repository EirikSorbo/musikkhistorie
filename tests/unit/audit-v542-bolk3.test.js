// Audit v5.42, bolk 3 (v5.48): fremvisningen i timen og editoren.
// Funn 7, 8, 12, 13 og 35 her; 9, 10, 11, 21 og 36 i presentasjon-modell-
// testene, 19 i limits.test.js og 22 i util.test.js. Kildelåser: modulene
// importerer Firebase og DOM og kan ikke kjøres i Node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const kilde = (f) => readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");

test("funn 7: et stoppbytte pauser lyd og avbrytes når et kort nekter å lukkes", () => {
  const p = kilde("presentasjon.js");
  const ga = p.slice(p.indexOf("function gaTilStopp("), p.indexOf("function lagrePosisjon("));
  assert.match(ga, /document\.querySelectorAll\("\.modal-backdrop\.open audio"\)\.forEach\(\(a\) => \{ try \{ a\.pause\(\); \} catch \(e\) \{\} \}\);/);
  // Ovenfra og ned, og stopp ved første nekt (kontrollrunden for v5.48).
  assert.match(ga, /for \(let top = topOpenModal\(\), n = 0; top && n < 50; top = topOpenModal\(\), n\+\+\) \{\n\s*modalClose\(top\);\n\s*if \(top\.classList\.contains\("open"\)\) return;\n\s*\}\n\s*\n\s*stoppIdx = p\.pos;/,
    "posisjonen settes først når alle kortene faktisk er lukket");
  assert.doesNotMatch(ga, /querySelectorAll\("\.modal-backdrop\.open"\)\.forEach\(\(m\) => modalClose\(m\)\)/, "ikke i dokumentrekkefølge");
});

test("funn 12: tilbake i samme plan beholder posisjonen, og slektstre-stoppet hopper ikke tilbake", () => {
  const p = kilde("presentasjon.js");
  assert.match(p, /const tilbakeISammePlan = erTilbakeNavigering\(\) && les\(LAGRING\.plan\) === param;/);
  assert.match(p, /if \(!tilbakeISammePlan\) \{/);
  assert.match(p, /const tilbakeTilTreet = hoppOverSlektstre && stopp\?\.vis === "slektstre";/);
  assert.match(p, /else if \(!tilbakeTilTreet\) apneVisNaarKlart\(parseVisVerdi\(stopp\.vis\)\);/);
  assert.match(p, /if \(!e\.persisted \|\| !planId\) return;/);
  assert.match(p, /if \(les\(LAGRING\.plan\) !== planId\) \{\n\s*skriv\(LAGRING\.aktiv, "1"\);\n\s*skriv\(LAGRING\.plan, planId\);\n\s*lagrePosisjon\(\);\n\s*return;\n\s*\}\n\s*stoppIdx = Math\.max\(0, Number\(les\(LAGRING\.stopp\)\) \|\| 0\);/,
    "tilbake fra bfcache leser posisjonen på nytt, men bare for samme plan");
});

test("funn 8: editoren sjekker hvert mål mot det åpneren slår opp i, og venter på dataene", () => {
  const v = kilde("visning.js");
  assert.match(v, /case "sjanger":\n\s*return \{ tekst: `\$\{navn\}: \$\{m\.id\}`, feil: GENEALOGY\.some\(\(n\) => n\.l === m\.id \|\| n\.f === m\.id\) \? "" : DOD \};/,
    "røttene og Reggae er sjanger-noder uten metasjanger");
  for (const hva of ["varmekart", "undersjanger", "kobling", "instrument"]) {
    assert.match(v, new RegExp(`case "${hva}":`), `${hva} har egen sjekk`);
  }
  assert.match(v, /feil: edgeExists\(m\.id\) \? "" : DOD/);
  assert.match(v, /return s\.artistsLoaded \? \{ tekst: `\$\{navn\}: \$\{m\.id\}`, feil: DOD \} : \{ tekst: `\$\{navn\}: laster …`, laster: true \};/);
  assert.match(v, /if \(kladd\) \{ if \(kladdVenter\) renderKladd\(\); return; \}/);
  assert.doesNotMatch(v, /GENEALOGY_MAIN_GENRES/, "det smale vokabularet ga de falske varslene");
  for (const f of ["landing.js", "tre-page.js", "teacher.js"]) {
    assert.ok((kilde(f).match(/visningTikk\(\);/g) || []).length >= 3, `${f}: kladden følger artist-, tech- og beskrivelsessnapshotene`);
  }
});

test("funn 13: tittelfeltet i kjøreplan-editoren følger kladden", () => {
  assert.match(kilde("visning.js"), /m\.querySelector\("#pres-adm-tittel"\)\?\.addEventListener\("input", \(e\) => \{\n\s*if \(kladd\) kladd\.tittel = e\.target\.value;/);
});

test("funn 35: verktøylinjene viker for YouTubes kontroller i kinovisning", () => {
  const css = readFileSync(new URL("../../css/styles.css", import.meta.url), "utf8");
  // Løftet over YouTubes kontrollstripe og dempet, aldri helt usynlige
  // (en usynlig linje tok klikkene; kontrollrunden for v5.48).
  assert.match(css, /body\.presentasjon:has\(#modal-yt\.yt-kino\.open\) :is\(#pres-bar, #samle-bar\) \{ bottom: 64px; opacity: 0\.35;/);
  assert.doesNotMatch(css, /:is\(#pres-bar, #samle-bar\) \{ opacity: 0;/);
  assert.match(css, /:is\(#pres-bar, #samle-bar\):is\(:hover, :focus-within\) \{ opacity: 1; \}/);
});
