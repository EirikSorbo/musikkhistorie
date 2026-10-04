// Bryterne i databasen (v6.10, U4): content/synlighet fletter seg inn i
// standarden i feature-flags.js. Bare boolske verdier for kjente nøkler slår
// gjennom; alt annet faller tilbake til standarden.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { synlighetVerdier, SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN, PUNKTER_BARE_I_PRESENTASJON } from "../../js/feature-flags.js?v=6.27";

const kilde = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("synlighetVerdier: uten dokument er det standarden", () => {
  const v = synlighetVerdier(null);
  assert.deepEqual(Object.keys(v.student).sort(), Object.keys(SKJUL_I_STUDENTVISNING).sort());
  assert.deepEqual(Object.keys(v.hub).sort(), Object.keys(SKJUL_I_HUBEN).sort());
  assert.equal(v.punkter, PUNKTER_BARE_I_PRESENTASJON);
  assert.deepEqual(synlighetVerdier("tull"), v, "et dokument som ikke er et objekt");
});

test("synlighetVerdier: kjente boolske nøkler overstyrer, resten følger standarden", () => {
  const nokkel = Object.keys(SKJUL_I_STUDENTVISNING)[0];
  const hubNokkel = Object.keys(SKJUL_I_HUBEN)[0];
  const v = synlighetVerdier({
    student: { [nokkel]: !SKJUL_I_STUDENTVISNING[nokkel], ukjent: true, horEtter: "ja" },
    hub: { [hubNokkel]: !SKJUL_I_HUBEN[hubNokkel] },
    punkter: !PUNKTER_BARE_I_PRESENTASJON,
  });
  assert.equal(v.student[nokkel], !SKJUL_I_STUDENTVISNING[nokkel]);
  assert.equal(v.hub[hubNokkel], !SKJUL_I_HUBEN[hubNokkel]);
  assert.equal(v.punkter, !PUNKTER_BARE_I_PRESENTASJON);
  assert.equal("ukjent" in v.student, false, "ukjente nøkler kommer ikke med");
  if ("horEtter" in SKJUL_I_STUDENTVISNING) {
    assert.equal(v.student.horEtter, SKJUL_I_STUDENTVISNING.horEtter, "ikke-boolsk verdi: standarden");
  }
});

// v6.23 (Fable F12): panelet lagrer bare nøklene det har en bryter for, så
// standarden i koden fortsatt gjelder for resten (storeBildet, de åpne
// hubkortene). Før skrev første lagring hele standardobjektet.
test("bryterpanelet lagrer bare nøklene det har en bryter for", () => {
  const src = kilde("js/teacher-desk.js");
  const start = src.indexOf("async function endreSynlighet");
  const kropp = src.slice(start, src.indexOf("\n}\n", start));
  assert.match(kropp, /PANEL_STUDENT\.map/);
  assert.match(kropp, /PANEL_HUB\.map/);
  assert.match(kropp, /savePage\("synlighet", lagre\)/);
  assert.doesNotMatch(kropp, /savePage\("synlighet", v\)/);
});
