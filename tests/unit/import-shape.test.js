// ============================================================================
//  IMPORTFILENS FORM
// ----------------------------------------------------------------------------
//  normalizeImportFile er en HVITELISTE: en toppnøkkel som ikke nevnes der,
//  forsvinner stille på veien til skrivingen. Det skjedde med sjangertreet i
//  v4.51 — eksporten la det i fila, importExtras leste det, men mellomleddet
//  slapp det aldri gjennom, og en ren tre-fil ble i tillegg avvist som «ugyldig
//  format». Feilen var usynlig i alle andre tester fordi den lå i det ene laget
//  som ikke var dekket.
//
//  Derfor: hver del appen kan importere har en test her, og seed-fila testes
//  ende-til-ende mot både formsjekken og tre-validatoren.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeImportFile } from "../../js/import-format.js?v=4.84";
import { validateTree } from "../../js/genre-validate.js?v=4.84";
import { GENEALOGY, FAMILIES, META_ORDER_HINT } from "../../js/genealogy-data.js?v=4.84";

const HER = path.dirname(fileURLToPath(import.meta.url));
const tre = () => ({ version: 1, nodes: GENEALOGY, families: FAMILIES, metaOrderHint: META_ORDER_HINT });

test("en bar array leses som artistliste (det eldste formatet)", () => {
  const d = normalizeImportFile([{ name: "Muddy Waters" }]);
  assert.equal(d.artists.length, 1);
});

test("ukjent format avvises", () => {
  assert.equal(normalizeImportFile(null), null);
  assert.equal(normalizeImportFile("tekst"), null);
  assert.equal(normalizeImportFile({ noeHeltAnnet: 1 }), null);
});

test("en fil med BARE sjangertreet godtas — det er en gyldig innholdsfil", () => {
  const d = normalizeImportFile({ formatVersion: 1, genealogy: tre() });
  assert.ok(d, "fila skal ikke avvises som ugyldig format");
  assert.equal(d.genealogy.nodes.length, GENEALOGY.length);
});

test("hver innholdsdel overlever normaliseringen", () => {
  const raw = {
    artists: [{ name: "A" }],
    decades: { 1950: { body: "x" } },
    edgeDescriptions: { blues__rnb: { description: "x" } },
    tech: [{ name: "T" }],
    pages: { omHistorie: { body: "x" } },
    varmekart: { heat: { Blues: [1] } },
    referanser: { kilder: [{ tittel: "K" }] },
    podcasts: [{ title: "P" }],
    teacherChecks: { genres: ["Blues"] },
    genealogy: tre(),
  };
  const d = normalizeImportFile(raw);
  for (const nøkkel of Object.keys(raw)) {
    const v = d[nøkkel];
    assert.ok(v && (Array.isArray(v) ? v.length : Object.keys(v).length),
      `«${nøkkel}» falt ut av normaliseringen`);
  }
});

test("manglende deler blir tomme, ikke undefined", () => {
  const d = normalizeImportFile({ artists: [] });
  assert.deepEqual(d.pages, {});
  assert.deepEqual(d.podcasts, []);
  assert.equal(d.genealogy, null);
  assert.equal(d.varmekart, null);
});

// { skip }-opsjonen, ikke en stille return: en return rapporteres som PASS
// uten å ha prøvd noe, og synes ikke i skipped-telleren.
const seedSti = path.join(HER, "../../json files/genealogy-seed.json");
const seedSkip = fs.existsSync(seedSti)
  ? false : "json files/genealogy-seed.json finnes ikke (gitignored; regenereres med tools/seed-genealogy.js)";

test("seed-fila har den formen importen faktisk godtar", { skip: seedSkip }, () => {
  const raw = JSON.parse(fs.readFileSync(seedSti, "utf8"));
  assert.ok(raw.genealogy, "genealogy må ligge på TOPPNIVÅ, ikke pakket i content");
  const d = normalizeImportFile(raw);
  assert.ok(d, "seed-fila må godtas av formsjekken");
  assert.equal(d.genealogy.nodes.length, GENEALOGY.length);
  assert.deepEqual(validateTree(d.genealogy).filter((p) => p.nivå === "feil"), []);
});
