import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// v5.52: lærersiden døde ved oppstart («Cannot read properties of null
// (reading 'getState')») når en samleøkt sto på idet sida ble lastet.
// initPlanInnsamling gjenoppretter økta og leser planene med én gang, og på
// lærersiden kjørte den FØR initExplore, som setter state-kilden.

const les = (rel) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

for (const fil of ["js/teacher.js", "js/landing.js", "js/tre-page.js"]) {
  test(`${fil}: samleøkta og planmenyen startes etter initExplore`, () => {
    const s = les(fil);
    const explore = s.indexOf("initExplore({");
    assert.ok(explore > 0, "initExplore kalles");
    for (const kall of ["initPlanInnsamling(", "initPlanMeny("]) {
      // Selve kallet: første linje som begynner med det (ikke importen).
      const m = new RegExp(`^\\s*${kall.replace("(", "\\(")}`, "m").exec(s);
      assert.ok(m, `${kall} kalles`);
      assert.ok(m.index > explore, `${kall} står etter initExplore`);
    }
  });
}

test("explore-context: getState kaster ikke før initExplore", () => {
  assert.match(les("js/explore-context.js"), /export function getState\(\) \{ return opts \? opts\.getState\(\) : \{\}; \}/);
});

// v5.53: plussknappen på artistkortene og -radene i listene (plukk-modus).
test("artistlistene har plussknapp i plukk-modus, koblet via body.samler-plukk", () => {
  const ui = les("js/ui.js");
  assert.match(ui, /export function kortPlussHtml\(a\) \{\n  if \(!a \|\| !isVisible\(a\)\) return "";/);
  assert.ok((ui.match(/\$\{kortPlussHtml\(a\)\}/g) || []).length >= 3, "kort, resultatrad og artistliste-rad");
  const pi = les("js/plan-innsamling.js");
  assert.match(pi, /document\.body\.classList\.toggle\("samler-plukk", økt\.modus === "plukk"\)/);
  assert.match(pi, /document\.body\.classList\.remove\("samler-plukk"\)/);
  assert.match(pi, /closest\?\.\("\.kort-pluss"\)[^]*?leggTil\(b\.dataset\.vis, "plukk"\)/);
  const css = les("css/styles.css");
  assert.match(css, /\.kort-pluss \{ display: none; \}/);
  assert.match(css, /body\.samler-plukk \.kort-pluss \{/);
});

// v5.55 (brukerkrav 2026-09-25): ingenting øverst til venstre under visning.
test("visningen blanker fanen og går i fullskjerm ved første handling, men respekterer et nei", () => {
  const p = les("js/presentasjon.js");
  assert.match(p, /document\.title = "\\u2800";/, "blank tittel som ikke trimmes bort");
  assert.match(p, /link\[rel~="icon"\][^]*?l\.href = TOMT_IKON/, "tomt fane-ikon");
  const init = p.slice(p.indexOf("export function initPresentasjon"));
  assert.match(init, /blankFaneOgVindu\(\);\n  fullskjermVedForsteHandling\(\);/);
  assert.match(p, /if \(!les\(LAGRING\.fullNei\)\) slaaPaaFullskjerm\(\);/, "læreren som har gått ut, får være i fred");
  assert.match(p, /e\.key === "Escape"/, "Esc teller ikke som første handling");
  assert.match(p, /fullNei: "pensumPresFullNei"/, "nullstilles med resten av LAGRING ved avslutning");
});
