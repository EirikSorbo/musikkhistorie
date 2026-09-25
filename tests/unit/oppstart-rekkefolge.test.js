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
