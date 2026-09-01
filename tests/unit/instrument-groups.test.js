import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSTRUMENT_GROUPS, INSTRUMENTS, INSTRUMENT_TIMELINE_GROUPS, instrumentsInUse,
} from "../../js/limits.js?v=5.04";
import { instrumentInnovations, buildInstrumentTimeline } from "../../js/ui-timeline.js?v=5.04";
import { PROPOSABLE_KEYS } from "../../js/proposal-fields.js?v=5.04";

// To nivåer, som metaGenre over mainGenre: artistkortet beholder det PRESISE
// instrumentet, tidslinjene ligger på GRUPPEN.

test("INSTRUMENTS utledes av gruppene — én kilde, ingen duplikater", () => {
  const fasit = Object.values(INSTRUMENT_GROUPS).flat();
  assert.deepEqual(INSTRUMENTS, fasit);
  assert.equal(new Set(INSTRUMENTS).size, INSTRUMENTS.length, "ingen instrument kan stå i to grupper");
});

test("«Annet» er en gyldig artistverdi, men har ingen tidslinje", () => {
  // Ensembler og produsenter må ha et sted å være, men det finnes ikke
  // instrumentnyvinninger for «et band».
  assert.ok(INSTRUMENTS.includes("Annet"));
  assert.ok(!INSTRUMENT_TIMELINE_GROUPS.includes("Annet"));
  assert.equal(INSTRUMENT_TIMELINE_GROUPS.length, Object.keys(INSTRUMENT_GROUPS).length - 1);
});

// Knapperekkefølgen i Instrumenter-kortet er et BRUKERVALG (2026-09-01):
// rytmeseksjonen først, så de melodiførende, til slutt de som ikke er ett
// fysisk instrument. Låses her så den ikke stille faller tilbake til
// nøkkelrekkefølgen i INSTRUMENT_GROUPS ved en senere opprydding.
test("instrumentgruppene vises i den valgte rekkefølgen", () => {
  assert.deepEqual(INSTRUMENT_TIMELINE_GROUPS, [
    "Trommer", "Bass", "Tangenter", "Gitar", "Vokal",
    "Soloinstrument", "Elektronisk produksjon", "Låtskriving",
  ]);
  // Visningsvalget skal IKKE stokke om artistskjemaets vokabular.
  assert.equal(INSTRUMENTS[0], "Vokal");
  assert.deepEqual(INSTRUMENTS, Object.values(INSTRUMENT_GROUPS).flat());
});

test("verdiene som fantes før omleggingen er fortsatt gyldige", () => {
  // Ingen av de 318 artistene skal bli ugyldige av grupperingen — bare
  // «Annet»-artistene med eget instrument flyttes manuelt.
  for (const gammel of ["Vokal", "Gitar", "Tangenter", "Bass", "Trommer/perkusjon",
                        "Saksofon", "Trompet", "Strykeinstrumenter",
                        "Elektronisk produksjon", "Annet"]) {
    assert.ok(INSTRUMENTS.includes(gammel), `${gammel} må fortsatt være gyldig`);
  }
});

// --- Nyvinnings-tidslinjen per instrument ------------------------------------

const kort = [
  { id: "a", name: "Elektrisk gitar", adoptedYear: 1938, instrument: "Gitar", status: "active" },
  { id: "b", name: "Gibson Les Paul", adoptedYear: 1952, instrument: "Gitar", status: "active" },
  { id: "c", name: "Ventende kort", adoptedYear: 1960, instrument: "Gitar", status: "pending" },
  { id: "d", name: "El-bassen", adoptedYear: 1955, instrument: "Bass", status: "active" },
  { id: "e", name: "Grammofonen", adoptedYear: 1900, status: "active" },   // uten instrument
];

test("kun godkjente kort for RIKTIG instrument havner på tidslinjen", () => {
  const gitar = instrumentInnovations(kort, "Gitar").map((t) => t.name);
  assert.deepEqual(gitar, ["Elektrisk gitar", "Gibson Les Paul"], "ventende kort skal ikke vises");
  assert.deepEqual(instrumentInnovations(kort, "Bass").map((t) => t.name), ["El-bassen"]);
  assert.deepEqual(instrumentInnovations(kort, "Vokal"), []);
  // Et kort uten instrument hører kun hjemme under Teknologi.
  assert.ok(!INSTRUMENT_TIMELINE_GROUPS.some((g) => instrumentInnovations(kort, g).some((t) => t.id === "e")));
});

test("tidslinjen tegnes først ved minst to kort", () => {
  assert.equal(buildInstrumentTimeline(kort, "Bass"), "", "ett kort gir ingen tidslinje");
  assert.equal(buildInstrumentTimeline(kort, "Låtskriving"), "", "null kort gir ingen tidslinje");
  const gitar = buildInstrumentTimeline(kort, "Gitar");
  assert.ok(gitar.includes("Elektrisk gitar") && gitar.includes("Gibson Les Paul"));
  assert.ok(!gitar.includes("Ventende kort"));
  // Grønn som innovasjonstidslinjen — ingen egen farge satt.
  assert.ok(!gitar.includes("--tl-color"), "instrumenttidslinjen skal arve --accent");
  assert.ok(gitar.includes("tl-rich"), "skal bruke den forfinede utformingen");
});

test("instrument og kilder er foreslåbare felter", () => {
  // Uten disse ville et studentforslag blitt filtrert bort i approvePendingEdit.
  assert.ok(PROPOSABLE_KEYS.tech.includes("instrument"));
  assert.ok(PROPOSABLE_KEYS.tech.includes("kilder"));
});

// --- Sammendragssiden per instrumentgruppe -----------------------------------

test("instrumentPageId gir lovlige, stabile Firestore-ID-er", async () => {
  const { instrumentPageId } = await import("../../js/limits.js?v=5.04");
  assert.equal(instrumentPageId("Gitar"), "instrument-gitar");
  assert.equal(instrumentPageId("Låtskriving"), "instrument-latskriving");
  assert.equal(instrumentPageId("Elektronisk produksjon"), "instrument-elektronisk-produksjon");
  for (const g of INSTRUMENT_TIMELINE_GROUPS) {
    const id = instrumentPageId(g);
    // Firestore-ID-er tåler ikke skråstrek, og æøå gir vondt-å-feilsøke ID-er.
    assert.ok(!id.includes("/"), `${g} → ${id} inneholder skråstrek`);
    assert.match(id, /^instrument-[a-z0-9-]+$/, `${g} → ${id}`);
  }
  // Ingen to grupper kan dele side.
  const ids = INSTRUMENT_TIMELINE_GROUPS.map(instrumentPageId);
  assert.equal(new Set(ids).size, ids.length);
});

test("«instrument» er en komplett forslagstype", async () => {
  // Alle fire stedene må kjenne typen, ellers blir forslaget avvist av reglene
  // eller filtrert bort ved godkjenning.
  const fs = await import("node:fs");
  // body = selve sammendraget, kilder = kildelista under det (v5.00).
  assert.deepEqual(PROPOSABLE_KEYS.instrument, ["body", "kilder"]);
  const rules = fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /entityType in \[[^\]]*"instrument"/, "firestore.rules mangler typen");
  const store = fs.readFileSync(new URL("../../js/store.js", import.meta.url), "utf8");
  assert.match(store, /case "instrument":/, "pendingEditTargetRef mangler typen");
  // entityId er student-skrevet og MÅ valideres mot instrumentgruppene her —
  // uvalidert kunne et forslag fått lærerens godkjenning til å skrive til en
  // vilkårlig content-side (confused deputy).
  assert.match(store, /INSTRUMENT_TIMELINE_GROUPS\.some\(\(g\) => instrumentPageId\(g\) === entityId\)/,
    "entityId-valideringen mot instrumentgruppene mangler");
});

// --- Korttype: innovasjon vs. hendelse ---------------------------------------

test("kort uten type ER en innovasjon — de 66 gamle trengte ingen migrering", async () => {
  const { techType, isHendelse } = await import("../../js/ui-tech.js?v=5.04");
  assert.equal(techType({ name: "Elektrisk gitar" }), "innovasjon");
  assert.equal(techType({ type: "" }), "innovasjon");
  assert.equal(techType({ type: "innovasjon" }), "innovasjon");
  assert.equal(techType({ type: "hendelse" }), "hendelse");
  // Ukjent verdi skal ikke kunne gjøre et kort til hendelse ved et uhell.
  assert.equal(techType({ type: "tull" }), "innovasjon");
  assert.equal(isHendelse({ type: "hendelse" }), true);
  assert.equal(isHendelse({}), false);
});

test("begge typer havner på instrumenttidslinjen, kun hendelser merkes", async () => {
  const { buildInstrumentTimeline } = await import("../../js/ui-timeline.js?v=5.04");
  const kort = [
    { id: "a", name: "Elektrisk gitar", adoptedYear: 1938, instrument: "Gitar", status: "active" },
    { id: "b", name: "Charlie Christian som soloinstrument", adoptedYear: 1939, instrument: "Gitar", status: "active", type: "hendelse" },
  ];
  const html = buildInstrumentTimeline(kort, "Gitar");
  assert.ok(html.includes("Elektrisk gitar") && html.includes("Charlie Christian"));
  assert.equal((html.match(/tl-item-hendelse/g) || []).length, 1, "kun hendelsen merkes");
  assert.ok(html.includes("tl-legend"), "tegnforklaring vises når begge typer finnes");
});

test("tegnforklaringen vises IKKE når bare én type finnes", async () => {
  const { buildInstrumentTimeline } = await import("../../js/ui-timeline.js?v=5.04");
  const bare = (type) => [1938, 1952].map((y, i) => ({
    id: "x" + i, name: "Kort " + i, adoptedYear: y, instrument: "Gitar", status: "active", ...(type ? { type } : {}),
  }));
  assert.ok(!buildInstrumentTimeline(bare(null), "Gitar").includes("tl-legend"));
  assert.ok(!buildInstrumentTimeline(bare("hendelse"), "Gitar").includes("tl-legend"));
});

test("hendelseskort vises ikke i Teknologi-seksjonen", async () => {
  const { renderTechList } = await import("../../js/ui-tech.js?v=5.04");
  const el = { innerHTML: "" };
  const kort = [
    { id: "a", name: "Vinylplata", category: "Opptak og avspilling" },
    { id: "b", name: "Hendrix paa Monterey", category: "", type: "hendelse" },
  ];
  renderTechList(el, kort, "", null);
  assert.ok(el.innerHTML.includes("Vinylplata"));
  assert.ok(!el.innerHTML.includes("Hendrix"), "hendelsen hoerer hjemme paa instrumenttidslinjen");
});

test("type er foreslåbar og står i regel-hvitelista", async () => {
  const fs = await import("node:fs");
  assert.ok(PROPOSABLE_KEYS.tech.includes("type"));
  const rules = fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /"name", "type", "category"/, "firestore.rules mangler type");
});

// --- instrumentsInUse: filtrene og oversiktsboblene ------------------------
// Skillet som lett går tapt ved senere endringer: FILTRENE viser bare
// instrumenter noen faktisk spiller, mens SKJEMAENE må by fram hele
// vokabularet — ellers kan den første banjospilleren aldri legges inn.

test("instrumentsInUse tar bare med instrumenter som er i bruk", () => {
  const artister = [
    { name: "A", status: "active", instrument: "Gitar" },
    { name: "B", status: "active", instrument: "Vokal" },
    { name: "C", status: "active", instrument: "Gitar" },
  ];
  assert.deepEqual(instrumentsInUse(artister), ["Vokal", "Gitar"], "vokabularets rekkefølge, ikke artistenes");
  assert.ok(!instrumentsInUse(artister).includes("Banjo"));
});

test("instrumentsInUse teller ikke skjulte eller fjernede artister", () => {
  const artister = [
    { name: "A", status: "active", instrument: "Vokal" },
    { name: "B", status: "removed", instrument: "Banjo" },
    { name: "C", status: "active", priority: -1, instrument: "Mandolin" },
    { name: "D", status: "pending", instrument: "Trombone" },
  ];
  assert.deepEqual(instrumentsInUse(artister), ["Vokal"]);
});

test("instrumentsInUse beholder et aktivt filtervalg som mistet siste artist", () => {
  const artister = [{ name: "A", status: "active", instrument: "Vokal" }];
  assert.deepEqual(instrumentsInUse(artister, "Banjo"), ["Vokal", "Banjo"]);
  assert.deepEqual(instrumentsInUse(artister, "Vokal"), ["Vokal"], "ingen dublett når valget finnes");
  assert.deepEqual(instrumentsInUse(artister, ""), ["Vokal"]);
});

test("instrumentsInUse tåler tom og manglende artistliste", () => {
  assert.deepEqual(instrumentsInUse([]), []);
  assert.deepEqual(instrumentsInUse(undefined), []);
  assert.deepEqual(instrumentsInUse(null), []);
});

test("skjemaene beholder HELE vokabularet — ellers låses ubrukte instrumenter ute", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL("../../js/" + f, import.meta.url), "utf8");
  // Innsending (student) og redigering (lærer) SETTER instrument: hele lista.
  assert.match(les("student.js"), /fillSelect\(\$\("#in-instrument"\), INSTRUMENTS/);
  assert.match(les("teacher-artists.js"), /fillSelect\(\$\("#ed-instrument"\), INSTRUMENTS/);
  // Filtrene LESER av data: bare det som er i bruk.
  assert.match(les("landing.js"), /fillSelect\(\$\("#sp-instrument"\), instrumentsInUse\(/);
  assert.match(les("teacher-state.js"), /fillSelect\(\$\("#f-instrument"\), instrumentsInUse\(/);
});
