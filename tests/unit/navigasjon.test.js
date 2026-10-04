// ============================================================================
//  NAVIGASJONEN I UTFORSK (v6.29)
// ----------------------------------------------------------------------------
//  Kjernen (explore-context.js) og «Fra timene» (explore-timer.js) åpner
//  featurene gjennom `nav`, som explore.js fyller idet modulen lastes. Slik
//  slapp kjernen å importere featurene, og importringen på 13 filer forsvant.
//  Glemmer man å registrere en funksjon, merkes det først når noen klikker
//  (nav.x er undefined). Testen låser at alt som slås opp i nav, registreres.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsFiler, lesJs } from "../helpers/js-filer.js";

const utenKommentarer = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

test("alt som slås opp i nav, registreres i explore.js", () => {
  const kall = utenKommentarer(lesJs("explore.js")).match(/registrerNavigasjon\(\{([^}]*)\}\)/);
  assert.ok(kall, "explore.js kaller registrerNavigasjon({ … })");
  const registrert = new Set(kall[1].split(",").map((x) => x.trim()).filter(Boolean));

  const brukt = new Set();
  for (const f of jsFiler()) {
    for (const m of utenKommentarer(lesJs(f)).matchAll(/(?<![\w$.])nav\.([A-Za-z0-9_$]+)/g)) brukt.add(m[1]);
  }
  assert.ok(brukt.size >= 6, `fant nav-oppslagene (${[...brukt].join(", ")})`);
  assert.deepEqual([...brukt].filter((n) => !registrert.has(n)), [], "slås opp i nav, men registreres ikke i explore.js");
});

test("kjernen importerer ingen Utforsk-feature", () => {
  const importer = [...utenKommentarer(lesJs("explore-context.js")).matchAll(/from\s+["'](\.{1,2}\/[^"'?]+\.js)/g)].map((m) => m[1]);
  assert.ok(importer.length >= 4, "fant importene");
  assert.deepEqual(importer.filter((m) => /(^|\/)explore-/.test(m)), [],
    "explore-context.js skal slå opp i nav i stedet: featurene importerer kjernen, så en import tilbake lager en ring");
});
