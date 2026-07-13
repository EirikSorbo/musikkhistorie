// normalizeConfig er slanket (v3.20): config bærer kun instrument-vokabularet.
// Testene låser at gamle grense-/listefelter fra forslagsfasen IGNORERES (de
// skal aldri nå state), og at instruments-lista vaskes og valideres.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig } from "../../js/config-normalize.js?v=3.20";

test("kun instruments slipper gjennom — gamle grense-felter ignoreres", () => {
  const c = normalizeConfig({
    maxTotal: 80, maxPerDecade: 8, maxPerMetaGenre: 16,
    decadeLimits: { 1960: 5 }, metaGenres: ["Blues"], decades: [1900],
    instruments: ["Gitar", "Vokal"],
  });
  assert.deepEqual(c, { instruments: ["Gitar", "Vokal"] });
});

test("instruments vaskes: trimmes og tomme droppes", () => {
  const c = normalizeConfig({ instruments: [" Gitar ", "", "  ", "Bass"] });
  assert.deepEqual(c.instruments, ["Gitar", "Bass"]);
});

test("uten gyldig instruments-liste returneres tomt objekt (DEFAULT vinner)", () => {
  assert.deepEqual(normalizeConfig({}), {});
  assert.deepEqual(normalizeConfig({ instruments: [] }), {});
  assert.deepEqual(normalizeConfig({ instruments: "Gitar" }), {});
  assert.deepEqual(normalizeConfig(null), {});
});
