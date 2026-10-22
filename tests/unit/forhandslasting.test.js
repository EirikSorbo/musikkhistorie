// ============================================================================
//  RASKERE SIDER (v7.14)
// ----------------------------------------------------------------------------
//  Målt med mobilprofil (4× tregere prosessor, 150 ms ventetid, HTTP/2 som
//  GitHub Pages): Firebase-bibliotekene lå på den kritiske veien fordi
//  nettleseren først fant dem når store.js var lastet. De forhåndslastes nå
//  fra HTML-en. Forslagsskjemaene og sjangerhimmelen lastes først når de
//  trengs. Testene låser begge deler.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const SIDER = ["index.html", "teacher.html", "tre.html", "student.html", "utskrift.html"];

test("Firebase forhåndslastes på alle sidene, etter importkartet og med versjonen i store.js", () => {
  const store = les("js/data/store.js");
  const brukt = [...store.matchAll(/from "(https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+)"/g)].map((m) => m[1]).sort();
  assert.equal(brukt.length, 3, "store.js henter app, firestore og auth");
  for (const side of SIDER) {
    const html = les(side);
    const lenker = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)" crossorigin>/g)].map((m) => m[1]).sort();
    assert.deepEqual(lenker, brukt, `${side}: forhåndslastingen må være de samme filene som store.js importerer`);
    const kart = html.indexOf('<script type="importmap">');
    const forste = html.indexOf('rel="modulepreload"');
    const modul = html.indexOf('<script type="module"');
    assert.ok(kart >= 0 && kart < forste, `${side}: forhåndslastingen står etter importkartet (ellers ignoreres kartet)`);
    assert.ok(modul < 0 || forste < modul, `${side}: forhåndslastingen står før modulskriptene`);
  }
});

test("forslagsskjemaene og sjangerhimmelen lastes ved behov, ikke ved sidelast", () => {
  const statisk = (src, mod) => new RegExp(`^import [^;]*from "[^"]*${mod}"`, "m").test(src);
  const landing = les("js/landing.js");
  assert.ok(!statisk(landing, "forslag/proposals.js"));
  assert.match(landing, /const forslag = \(\) => import\("\.\/forslag\/proposals\.js"\);/);
  const tre = les("js/tre-page.js");
  assert.ok(!statisk(tre, "forslag/proposals.js"));
  assert.match(tre, /\(await import\("\.\/forslag\/proposals\.js"\)\)\.openProposalEditor\(cfg\)/);
  const innhold = les("js/utforsk/explore-innhold.js");
  assert.ok(!statisk(innhold, "constellation.js"));
  assert.match(innhold, /await import\("\.\.\/sjangre\/constellation\.js"\)/);
});
