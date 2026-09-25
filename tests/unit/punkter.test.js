import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normaliserPunkter, lesPunkter, punkterTilTekst, punktVarsel, punkterHtml, PUNKT_MAKS_ANTALL, PUNKT_MAKS_TEGN } from "../../js/punkter.js?v=5.63";
import { normalizeArtist, buildArtistDoc } from "../../js/artist-normalize.js?v=5.63";
import { PROPOSABLE_KEYS } from "../../js/proposal-fields.js?v=5.63";
import { ARTIST_EXPORT_FIELDS, ARTIST_COMPARE_FIELDS, ARTIST_LABELS } from "../../js/artist-schema.js?v=5.63";
import { resolveDesc } from "../../js/genre-descriptions.js?v=5.63";
import { validateArtistsForImport } from "../../js/import-format.js?v=5.63";

// Oppsummeringspunktene (v5.50): 3–5 punkter per beskrivelse på artist-,
// sjanger- (main) og teknologikortet. Bare læreren skriver dem.

const les = (rel) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("normaliserPunkter: bare tekster, trimmet, uten punkttegn og tomme linjer", () => {
  assert.deepEqual(normaliserPunkter(null), []);
  assert.deepEqual(normaliserPunkter("ett punkt"), []);
  assert.deepEqual(normaliserPunkter({ a: 1 }), []);
  assert.deepEqual(
    normaliserPunkter(["  - Første ", "• Andre", "* Tredje", "1. Fjerde", "2) Femte", "", "   ", 7, null]),
    ["Første", "Andre", "Tredje", "Fjerde", "Femte"]);
  // Et tall FORAN teksten uten punktum er innhold, ikke nummerering.
  assert.deepEqual(normaliserPunkter(["1950-tallet var gjennombruddet"]), ["1950-tallet var gjennombruddet"]);
  // Kursiv-markering (*ord*) i starten er ikke et punkttegn (ingen mellomrom etter *).
  assert.deepEqual(normaliserPunkter(["*Kind of Blue* ble en milepæl"]), ["*Kind of Blue* ble en milepæl"]);
});

test("normaliserPunkter: harde tak på antall og lengde", () => {
  const mange = Array.from({ length: 9 }, (_, i) => `Punkt ${i + 1}`);
  assert.equal(normaliserPunkter(mange).length, PUNKT_MAKS_ANTALL);
  const langt = "x".repeat(PUNKT_MAKS_TEGN + 50);
  assert.equal(normaliserPunkter([langt])[0].length, PUNKT_MAKS_TEGN);
});

test("tekstfeltet: én linje per punkt, fram og tilbake", () => {
  const liste = ["Født i Mississippi", "Spilte inn 29 låter", "Påvirket rocken"];
  assert.equal(punkterTilTekst(liste), liste.join("\n"));
  assert.deepEqual(lesPunkter(punkterTilTekst(liste)), liste);
  assert.deepEqual(lesPunkter("- a\n\n- b\r\n"), ["a", "b"]);
  assert.deepEqual(lesPunkter(""), []);
  assert.deepEqual(lesPunkter(undefined), []);
  assert.equal(punkterTilTekst(undefined), "");
});

test("punktVarsel: tomt og 3–5 er i orden, ellers en forklaring", () => {
  assert.equal(punktVarsel(""), null);
  assert.equal(punktVarsel("a\nb\nc"), null);
  assert.equal(punktVarsel("a\nb\nc\nd\ne"), null);
  assert.match(punktVarsel("a"), /1 punkt\. 3–5 anbefales/);
  assert.match(punktVarsel("a\nb"), /2 punkter\. 3–5 anbefales/);
  assert.match(punktVarsel("a\nb\nc\nd\ne\nf"), /6 punkter\. 3–5 anbefales/);
  assert.match(punktVarsel("1\n2\n3\n4\n5\n6\n7"), /bare de første 6 lagres/);
  assert.match(punktVarsel(`a\nb\n${"x".repeat(PUNKT_MAKS_TEGN + 1)}`), /Ett punkt er over 200 tegn/);
  for (const v of [punktVarsel("a"), punktVarsel("1\n2\n3\n4\n5\n6\n7")]) {
    assert.equal(v.includes(" — "), false, "ingen tankestrek i apptekst");
  }
});

test("punkterHtml: ul.punkter med inline-formatering og escaping; tom gir tom streng", () => {
  assert.equal(punkterHtml([]), "");
  assert.equal(punkterHtml(null), "");
  const html = punkterHtml(["**Viktig** poeng", "<script>x</script>"]);
  assert.match(html, /^<ul class="punkter"><li>/);
  assert.match(html, /<strong>Viktig<\/strong> poeng/);
  assert.equal(html.includes("<script>"), false);
  assert.equal((html.match(/<li>/g) || []).length, 2);
});

test("artistene: punktene normaliseres, og en studentinnsending får aldri feltet", () => {
  assert.deepEqual(normalizeArtist({ name: "X", punkter: ["- a", "", "b"] }).punkter, ["a", "b"]);
  assert.equal("punkter" in normalizeArtist({ name: "X" }), false);
  const student = buildArtistDoc({ name: "X", metaGenre: "Blues", influenceStart: 1930 });
  assert.equal("punkter" in student, false, "create-hvitelisten i reglene kjenner ikke feltet");
  assert.equal("punkter" in buildArtistDoc({ name: "X", punkter: [] }), false);
  assert.deepEqual(buildArtistDoc({ name: "X", status: "active", punkter: ["a", "b", "c"] }).punkter, ["a", "b", "c"]);
});

test("artistene: punktene er lærerens felt (ikke foreslåbare), men med i eksport og fletting", () => {
  assert.equal(PROPOSABLE_KEYS.artist.includes("punkter"), false);
  assert.equal(ARTIST_EXPORT_FIELDS.includes("punkter"), true);
  assert.equal(ARTIST_COMPARE_FIELDS.includes("punkter"), true);
  assert.equal(typeof ARTIST_LABELS.punkter, "string");
  // Reglene: create-hvitelisten for artister nevner ikke feltet.
  const regler = les("firestore.rules");
  assert.equal(regler.includes('"punkter"'), false);
});

test("sjangrene: main-nivået bærer punktene, og punkter alene teller som innhold", () => {
  const descs = { Delta: { main: { description: "Tekst", punkter: ["- a", "b"] } } };
  assert.deepEqual(resolveDesc(descs, "Delta", "main").punkter, ["a", "b"]);
  assert.deepEqual(resolveDesc({}, "Ukjent", "main").punkter, []);
  const bare = resolveDesc({ Y: { main: { punkter: ["a"] } } }, "Y", "main");
  assert.deepEqual(bare.punkter, ["a"]);
});

test("import: punkter må være en liste med tekster", () => {
  const base = { name: "X", metaGenre: "Blues", influenceStart: 1930 };
  const feil = validateArtistsForImport([{ ...base, punkter: "a\nb" }]);
  assert.equal(feil.ok, false);
  assert.ok(feil.errors[0].problems.some((p) => p.includes("«punkter»")));
  const ok = validateArtistsForImport([{ ...base, punkter: ["a", "b", "c"] }]);
  assert.equal(ok.errors.some((e) => e.problems.some((p) => p.includes("«punkter»"))), false);
});

test("oppsettet: editorfelt, kort og skjuling utenfor presentasjonen", () => {
  const html = les("teacher.html");
  for (const id of ["ed-punkter", "tech-punkter", "ss-punkter"]) {
    assert.match(html, new RegExp(`class="[^"]*punktfelt[^"]*"[^]*?<textarea id="${id}"[^>]*data-format="inline"`), id);
  }
  assert.match(html, /id="ss-punkter-wrap" class="punktfelt" hidden/);
  assert.match(les("js/ui.js"), /sekt\("punkter", punkterHtml\(a\.punkter, lc\)\)/);
  assert.match(les("js/genealogy.js"), /sekt\("punkter", punkterHtml\(resolved\.punkter, lc\)\)/);
  assert.match(les("js/ui-tech.js"), /sekt\("punkter", punkterHtml\(t\.punkter, lc\)\)/);
  assert.match(les("js/feature-flags.js"), /export const PUNKTER_BARE_I_PRESENTASJON = true;/);
  assert.match(les("js/feature-flags.js"), /classList\.toggle\("skjul-punkter", PUNKTER_BARE_I_PRESENTASJON\)/);
  assert.match(les("css/styles.css"), /html\.skjul-punkter body:not\(\.presentasjon\) \[data-sekt="punkter"\] \{ display: none !important; \}/);
  // Editorene lagrer via de delte hjelperne.
  assert.match(les("js/teacher-artists.js"), /punkter: +lesPunktfelt\(\$\("#ed-punkter"\)\)/);
  assert.match(les("js/teacher-content.js"), /data\.punkter = lesPunktfelt\(\$\("#ss-punkter"\)\)/);
  assert.match(les("js/teacher-content.js"), /lesPunktfelt\(document\.getElementById\("tech-punkter"\)\)/);
});

test("undersjanger- og koblingskortet har ingen nivåmerker: alt vises fra nivå 1 (brukervalg 2026-09-24)", () => {
  const kropp = (fil, start) => {
    const s = les(fil);
    const i = s.indexOf(start);
    assert.ok(i >= 0, `${start} finnes i ${fil}`);
    const j = s.indexOf("\nexport function", i + start.length);
    return s.slice(i, j < 0 ? undefined : j);
  };
  for (const [fil, start] of [["js/genealogy.js", "export function showEdgeInfo"], ["js/ui.js", "function showGenreLevelInfo"]]) {
    const k = kropp(fil, start);
    assert.equal(/sekt\(|data-sekt/.test(k), false, `${start} skal ikke ha data-sekt`);
  }
});

test("delposter (v5.51): navn + punkter er en delpost, et ekte kort er det ikke", async () => {
  const { erDelpost } = await import("../../js/import-format.js?v=5.63");
  assert.equal(erDelpost({ name: "X", punkter: ["a", "b", "c"] }), true);
  assert.equal(erDelpost({ name: "X", metaGenre: "", description: "  " }), true);
  assert.equal(erDelpost({ name: "X", metaGenre: "Jazz" }), false);
  assert.equal(erDelpost({ name: "X", description: "Tekst" }), false);
  assert.equal(erDelpost(null), false);
  // Importen: «Erstatt alle» stopper på delposter, «Flett» lager aldri nye
  // artister av dem.
  const imp = les("js/teacher-import.js");
  assert.match(imp, /const delposter = toAdd\.filter\(erDelpost\);\n  if \(delposter\.length\) \{[^]*?return false;/);
  assert.match(imp, /if \(erDelpost\(imp\)\) uteliggere\.push\(imp\.name\);\n      else mergeState\.newArtists\.push\(imp\);/);
});
