// Appens egne meldingsbokser (v6.25, brukervalg 2026-10-04): nettleserens
// alert, confirm og prompt er erstattet av melding, bekreft, sporTekst og
// visLenke i ui-modal.js, så alle boksene ser ut som appen. Låsen hindrer at
// en ny grå nettleserboks sniker seg inn igjen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsFiler, lesJs } from "../helpers/js-filer.js";

// Alle mappene under js/ (fra v6.30), ikke bare sidefilene på toppnivå.
const filer = jsFiler();

test("ingen av nettleserens alert/confirm/prompt i appens kode", () => {
  assert.ok(filer.length > 80, `leste bare ${filer.length} filer`);
  const funn = [];
  for (const f of filer) {
    const linjer = lesJs(f).split("\n");
    linjer.forEach((l, i) => {
      if (l.trimStart().startsWith("//")) return;
      if (/(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\(/.test(l)) funn.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(funn, [], "bruk melding/bekreft/sporTekst/visLenke fra ui-modal.js");
});

test("hjelperne finnes og bygger på samme dialog", () => {
  const src = lesJs("ui-modal.js");
  for (const navn of ["melding", "bekreft", "sporTekst", "visLenke"]) {
    assert.match(src, new RegExp(`export function ${navn}\\(`), `${navn} mangler`);
  }
  assert.match(src, /dialog\.className = "modal modal-valg modal-melding";/,
    "modal-valg holder dem små i presentasjonen");
});
