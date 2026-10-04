// Appens egne meldingsbokser (v6.25, brukervalg 2026-10-04): nettleserens
// alert, confirm og prompt er erstattet av melding, bekreft, sporTekst og
// visLenke i ui-modal.js, så alle boksene ser ut som appen. Låsen hindrer at
// en ny grå nettleserboks sniker seg inn igjen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const mappe = new URL("../../js/", import.meta.url);
const filer = readdirSync(mappe).filter((f) => f.endsWith(".js"));

test("ingen av nettleserens alert/confirm/prompt i appens kode", () => {
  const funn = [];
  for (const f of filer) {
    const linjer = readFileSync(new URL(f, mappe), "utf8").split("\n");
    linjer.forEach((l, i) => {
      if (l.trimStart().startsWith("//")) return;
      if (/(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\(/.test(l)) funn.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(funn, [], "bruk melding/bekreft/sporTekst/visLenke fra ui-modal.js");
});

test("hjelperne finnes og bygger på samme dialog", () => {
  const src = readFileSync(new URL("ui-modal.js", mappe), "utf8");
  for (const navn of ["melding", "bekreft", "sporTekst", "visLenke"]) {
    assert.match(src, new RegExp(`export function ${navn}\\(`), `${navn} mangler`);
  }
  assert.match(src, /dialog\.className = "modal modal-valg modal-melding";/,
    "modal-valg holder dem små i presentasjonen");
});
