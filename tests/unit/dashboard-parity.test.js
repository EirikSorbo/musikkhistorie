// Dashbord-paritet: student- (index.html) og lærer-dashbordet (teacher.html)
// skal ha NØYAKTIG samme kort i samme rekkefølge (brukerkrav 2026-07-13).
// Testen leser den statiske HTML-en, så en omrokkering på bare én av sidene
// feiler `npm test` i stedet for å skli ubemerket fra hverandre.
// («Det store bildet»-hubens kort ligger i JS-injisert markup og telles ikke.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Kort-titlene i det FØRSTE (og eneste statiske) dash-gridet i fila.
function dashTitles(fil) {
  const html = readFileSync(join(rot, fil), "utf8");
  const start = html.indexOf('<div class="dash-grid">');
  assert.ok(start >= 0, `${fil}: fant ikke dash-grid`);
  const grid = html.slice(start, html.indexOf("</section>", start));
  return [...grid.matchAll(/<span class="dash-title">([^<]+)<\/span>/g)].map((m) => m[1]);
}

test("student- og lærer-dashbordet har samme kort i samme rekkefølge", () => {
  const student = dashTitles("index.html");
  const laerer = dashTitles("teacher.html");
  assert.ok(student.length >= 5, "student-dashbordet ser tomt/feilparset ut");
  assert.deepEqual(
    laerer, student,
    "Kortene i teacher.html må stå i samme rekkefølge som i index.html — endrer du den ene, endre den andre.",
  );
});
