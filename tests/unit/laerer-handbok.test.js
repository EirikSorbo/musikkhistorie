// ============================================================================
//  LÆRERHÅNDBOKEN (v7.01, brukerønske 2026-10-14)
// ----------------------------------------------------------------------------
//  En håndbok for læreren, i «Om appen» fra v7.42 (før under Innstillinger).
//  Teksten bor i Firestore (content/laererHandbok) som de andre innholds-
//  sidene: ingen tekst i koden, Rediger i hodet, med i eksporten. Den er bare
//  for læreren: ingen Sjekk, ikke i «Bare sjekket innhold», ikke i heftet og
//  aldri på lerretet.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sideSjekk } from "../../js/data/sjekket-filter.js";
import { SIDER_I_HEFTET } from "../../js/utskrift/utskrift-modell.js";
import { LERRET_PRIVAT } from "../../js/visning/presentasjon-modell.js";
import { sideFaner, valgtFaneIndeks } from "../../js/felles/side-faner.js";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

// v7.42 (brukerbestilling 2026-11-17): håndboken flyttet fra Innstillinger
// til «Om appen» (tests/unit/info-vindu.test.js tester den nye plassen).
test("håndboken er borte fra Innstillinger og fra teacher.html", () => {
  const html = les("teacher.html");
  assert.ok(!html.includes(">Hjelp</h3>"));
  assert.ok(!html.includes("btn-laerer-handbok"));
  assert.ok(!html.includes('id="modal-laerer-handbok"'), "vinduet bor i explore-modals.js");
  const js = les("js/teacher.js");
  assert.ok(!/openLaererHandbok|tegnLaererHandbok|btn-laerer-handbok/.test(js));
});

test("editoren kjenner siden, og gjenåpner den etter lagring", () => {
  const src = les("js/laerer/teacher-content.js");
  assert.match(src, /laererHandbok: "Lærerhåndbok"/);
  assert.match(src, /editorTarget\.id === "laererHandbok"\) ctx\.explore\.openLaererHandbok\(\);/);
});

test("bare for læreren: ingen Sjekk, utenfor regelen, ikke i heftet, ikke på lerretet", () => {
  assert.match(les("js/utforsk/explore-innhold.js"), /const USJEKKEDE_SIDER = \["appGuide", "laererHandbok", "kiErklaering"\];/);
  assert.equal(sideSjekk("laererHandbok"), null);
  assert.ok(!("laererHandbok" in SIDER_I_HEFTET));
  assert.ok(LERRET_PRIVAT.has("modal-laerer-handbok"));
  assert.ok(LERRET_PRIVAT.has("modal-settings"), "innstillingene viser lærerkontoen");
});

// Fanene (v7.27, brukerønske 2026-11-09): `## ` først på linja starter en fane.
test("sideFaner: `## ` deler teksten, `### ` blir stående, og teksten før første fane er innledningen", () => {
  const { innledning, faner } = sideFaner("Over fanene.\n\n## Lærersiden\n### Skrivebordet\nTekst.\n\n  ##  Visning  \n### Kjøreplaner\nMer.\r\n## Tom");
  assert.equal(innledning, "Over fanene.");
  assert.deepEqual(faner.map((f) => f.tittel), ["Lærersiden", "Visning", "Tom"]);
  assert.equal(faner[0].tekst, "### Skrivebordet\nTekst.");
  assert.equal(faner[1].tekst, "### Kjøreplaner\nMer.");
  assert.equal(faner[2].tekst, "");
});

test("sideFaner: uten `## ` er det ingen faner, og `###` eller `##tekst` er ingen fane", () => {
  const gammel = "Håndboken.\n\n### Skrivebordet\nTekst.\n\n##Uten mellomrom\n#### Dyp";
  assert.deepEqual(sideFaner(gammel), { innledning: gammel, faner: [] });
  assert.deepEqual(sideFaner(""), { innledning: "", faner: [] });
  assert.deepEqual(sideFaner(undefined), { innledning: "", faner: [] });
});

test("valgtFaneIndeks: fanen kjennes igjen på navnet, ellers den første", () => {
  const faner = [{ tittel: "Lærersiden" }, { tittel: "Visning" }];
  assert.equal(valgtFaneIndeks(faner, "Visning"), 1);
  assert.equal(valgtFaneIndeks(faner, "Borte"), 0);
  assert.equal(valgtFaneIndeks(faner, undefined), 0);
});

test("bare lærerhåndboken får faner, med ARIA-mønsteret og piltastene", () => {
  const src = les("js/utforsk/explore-innhold.js");
  assert.match(src, /const FANESIDER = \{ laererHandbok: "Delene av lærerhåndboken" \};/);
  assert.match(src, /const deler = FANESIDER\[pageId\] \? sideFaner\(page\.body\) : null;\n\s*if \(deler\?\.faner\.length\) \{\n\s*tegnFaner\(body, pageId, deler, lc\);/);
  const tegn = src.slice(src.indexOf("function tegnFaner("), src.indexOf("function guideHtml("));
  assert.match(tegn, /role="tablist"/);
  assert.match(tegn, /role="tab" id="\$\{id\}-\$\{j\}" aria-controls="\$\{id\}-panel" aria-selected="\$\{j === i\}" tabindex="\$\{j === i \? 0 : -1\}"/);
  assert.match(tegn, /role="tabpanel" id="\$\{id\}-panel" aria-labelledby="\$\{id\}-\$\{i\}"/);
  assert.match(tegn, /kobleFanePiler\(rad\);/);
  assert.match(tegn, /wireLinks\(body, lc\);/, "navnene i teksten er lenker også i fanene");
  assert.match(les("css/styles.css"), /\.side-faner \{ gap: 18px; margin: 0 0 16px; overflow-x: auto; scrollbar-width: none; \}/);
});
