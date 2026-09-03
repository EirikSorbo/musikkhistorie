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
import { normalizeImportFile, decadeDoc } from "../../js/import-format.js?v=5.10";
import { validateTree } from "../../js/genre-validate.js?v=5.10";
import { GENEALOGY, FAMILIES, META_ORDER_HINT } from "../../js/genealogy-data.js?v=5.10";

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

// «Les mer»-tekstene ble forkastet i v4.78 og slettet i v4.93. Et tiårsdokument
// bygges derfor felt for felt, både ut i eksporten og inn fra en fil — ellers
// ville en eldre sikkerhetskopi dratt dem inn igjen.
test("tiårsdokumentet har KUN samfunn, teknologi og kilder", () => {
  const d = decadeDoc({
    society: "Samfunn", tech: "Teknologi", kilder: [{ text: "SNL" }],
    societyMore: "gammel les mer-tekst", techMore: "gammel les mer-tekst", noeAnnet: 1,
  });
  assert.deepEqual(Object.keys(d).sort(), ["kilder", "society", "tech"]);
  assert.equal(d.society, "Samfunn");
  assert.equal(d.kilder.length, 1);
});

test("et tomt tiår gir tomme felter, ikke undefined", () => {
  assert.deepEqual(decadeDoc(), { society: "", tech: "", kilder: [] });
  assert.deepEqual(decadeDoc({ kilder: "ikke en liste" }), { society: "", tech: "", kilder: [] });
});

// Importen skriver tiår med { merge: true }, og Firestore SKRIVER en tom verdi
// framfor å hoppe over den. Full form betydde at en fil med bare { society }
// nullstilte tiårets teknologitekst og kilder, stille.
test("decadeDoc partial: felter fila ikke nevner, skrives ikke", () => {
  assert.deepEqual(decadeDoc({ society: "ny tekst" }, { partial: true }), { society: "ny tekst" });
  assert.deepEqual(decadeDoc({ tech: "T" }, { partial: true }), { tech: "T" });
  assert.deepEqual(
    decadeDoc({ society: "S", kilder: [{ text: "SNL" }] }, { partial: true }),
    { society: "S", kilder: [{ text: "SNL" }] }
  );
  // Eksplisitt tomme verdier teller heller ikke: fletting kan aldri tømme.
  assert.deepEqual(decadeDoc({ society: "S", tech: "", kilder: [] }, { partial: true }), { society: "S" });
  assert.deepEqual(decadeDoc({}, { partial: true }), {});
  // Gamle «les mer»-felter siles bort også i partial-form.
  assert.deepEqual(decadeDoc({ society: "S", societyMore: "x" }, { partial: true }), { society: "S" });
});

test("decadeDoc uten partial er UENDRET — eksporten skal ha full form", () => {
  assert.deepEqual(decadeDoc({ society: "S" }), { society: "S", tech: "", kilder: [] });
  assert.deepEqual(decadeDoc(), { society: "", tech: "", kilder: [] });
});

// Konfliktdialogen løses av læreren lenge etter at handleMergeFile returnerer.
// Uten et løft imellom skrev importen alt annet innhold mens dialogen sto åpen,
// og et avbrudd meldte «ingen endringer er lagret» selv om alt lå i databasen.
// Flyten leser DOM og kan ikke enhetstestes, så vi låser kilden.
test("importen venter på flettedialogen før resten skrives", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../js/teacher-import.js", import.meta.url), "utf8");
  assert.match(src, /function ventPaMerge\(\)/, "løftet mangler");
  assert.match(src, /const fullfort = await handleMergeFile\(/,
    "resultatet av flettingen må fanges");
  assert.match(src, /if \(fullfort\) \{\s*\n\s*await importDescriptions/,
    "resten av importen må ligge bak fullfort-sjekken");
  assert.match(src, /meldMergeFerdig\(true\)/, "finishMerge må melde fullført");
  assert.match(src, /meldMergeFerdig\(false\)/, "avbrudds-vakten må melde avbrutt");
  assert.match(src, /if \(mergeCommitting\) return;/,
    "vakten må la finishMerge melde selv, ellers starter resten midt i skrivingen");
});
