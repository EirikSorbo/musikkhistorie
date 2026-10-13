// Engangsoppryddingen av samfunnskildene på tiårene (v6.92, brukervalg
// 2026-10-13): samfunnskildene fjernes, teknologikildene blir stående.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { planTiaarskilder, SAMFUNNSKILDER } from "../../js/laerer/tiaarskilder-opprydding.js";

const LP = { text: "«The history of the LP». Hi-Fi+.", url: "https://example.com/lp" };
const GM = { text: "Library of Congress.", url: "https://www.loc.gov/classroom-materials/great-migration/" };
const CR = { text: "«Civil Rights Movement Timeline». HISTORY.", url: "https://www.history.com/articles/civil-rights-movement-timeline" };

test("samfunnskildene fjernes, teknologikildene står, og et tiår kan bli tomt", () => {
  const plan = planTiaarskilder({
    1900: { society: "s", kilder: [GM] },
    1950: { society: "s", tech: "t", kilder: [LP, CR] },
    1990: { tech: "t", kilder: [LP] },
    2020: { society: "s" },
  });
  assert.deepEqual(plan.map((t) => t.id), ["1900", "1950"]);
  assert.deepEqual(plan[0], { id: "1900", kilder: [], fjernes: [GM] });
  assert.deepEqual(plan[1].kilder, [LP]);
  assert.deepEqual(plan[1].fjernes, [CR]);
});

test("lista har de 16 samfunnskildene, og Skrivebordet viser kortet", () => {
  assert.equal(SAMFUNNSKILDER.size, 16);
  const desk = fs.readFileSync(new URL("../../js/laerer/teacher-desk.js", import.meta.url), "utf8");
  assert.match(desk, /\$\{tiaarskilderHtml\(\)\}/);
  assert.match(desk, /settTiaarskilder\(plan\.map\(\(\{ id, kilder \}\) => \(\{ id, kilder \}\)\)\)/);
  assert.match(fs.readFileSync(new URL("../../js/teacher.js", import.meta.url), "utf8"), /onDecades: \(\) => \{[^}]*refreshDesk\(\)/);
});
