// ============================================================================
//  LÆRERHÅNDBOKEN (v7.01, brukerønske 2026-10-14)
// ----------------------------------------------------------------------------
//  En håndbok for læreren under Innstillinger, sammen med import og eksport.
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

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("Innstillinger har Lærerhåndbok øverst, under Hjelp", () => {
  const html = les("teacher.html");
  const innst = html.slice(html.indexOf('id="modal-settings"'), html.indexOf('id="modal-laerer-handbok"'));
  const hjelp = innst.indexOf(">Hjelp</h3>");
  assert.ok(hjelp > 0, "fant ikke Hjelp-gruppa i innstillingene");
  assert.ok(hjelp < innst.indexOf(">Konto</h3>"), "Hjelp står først");
  assert.ok(hjelp < innst.indexOf(">Import og eksport</h3>"));
  assert.match(innst, /id="btn-laerer-handbok"/);
});

test("vinduet er et innholdskort uten tekst i markupen", () => {
  const html = les("teacher.html");
  assert.match(html, /<div class="modal-backdrop" id="modal-laerer-handbok">\s*<div class="modal modal-innhold">/);
  assert.match(html, /<div id="lh-extra" class="head-actions"><\/div>/);
  assert.match(html, /<div id="lh-body" class="story-body"><\/div>/, "teksten kommer fra Firestore, ikke fra koden");
});

test("teacher.js tegner content/laererHandbok og kobler knappen", () => {
  const js = les("js/teacher.js");
  assert.match(js, /import \{ renderPage \} from "\.\/utforsk\/explore-innhold\.js";/);
  assert.match(js, /renderPage\("laererHandbok", "lh-body", "lh-extra"\)/);
  assert.match(js, /getElementById\("btn-laerer-handbok"\)\?\.addEventListener\("click", openLaererHandbok\)/);
  assert.match(js, /openAdminModal\("modal-laerer-handbok"\)/);
  assert.match(js, /ctx\.openLaererHandbok = openLaererHandbok;/);
  // Et åpent vindu følger snapshotet (import eller lagring i en annen fane).
  assert.match(js, /getElementById\("modal-laerer-handbok"\)\?\.classList\.contains\("open"\)\) tegnLaererHandbok\(\);/);
});

test("editoren kjenner siden, og gjenåpner den etter lagring", () => {
  const src = les("js/laerer/teacher-content.js");
  assert.match(src, /laererHandbok: "Lærerhåndbok"/);
  assert.match(src, /editorTarget\.id === "laererHandbok"\) ctx\.openLaererHandbok\?\.\(\)/);
});

test("bare for læreren: ingen Sjekk, utenfor regelen, ikke i heftet, ikke på lerretet", () => {
  assert.match(les("js/utforsk/explore-innhold.js"), /const USJEKKEDE_SIDER = \["appGuide", "laererHandbok"\];/);
  assert.equal(sideSjekk("laererHandbok"), null);
  assert.ok(!("laererHandbok" in SIDER_I_HEFTET));
  assert.ok(LERRET_PRIVAT.has("modal-laerer-handbok"));
  assert.ok(LERRET_PRIVAT.has("modal-settings"), "innstillingene viser lærerkontoen");
});
