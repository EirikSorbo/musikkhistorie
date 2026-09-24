// ============================================================================
//  KILDELÅSER FOR AUDIT v5.19, BOLK D OG E (v5.34–v5.35)
// ----------------------------------------------------------------------------
//  Rettelsene her bor i kode som ikke kan enhetstestes (DOM, Firestore-
//  lyttere, CSS, HTML), så de låses på kildenivå, som de andre flersteds-
//  invariantene i testene. Hver test sier hvilket funn den vokter og hva som
//  gikk galt før, så en rød test forteller HVORFOR linja må stå.
//  Rettelser med ren logikk har ekte atferdstester i modulens egen testfil
//  (kanoniskJson i util.test, importvalideringen i import-format.test,
//  undersjanger-avkryssingen i genre-migrate.test, diff-cellene i ui-edit.test).
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const antall = (src, re) => (src.match(re) || []).length;
// Kroppen til én funksjon: fra signaturen til neste toppnivå-funksjon.
function kropp(src, signatur) {
  const start = src.indexOf(signatur);
  assert.ok(start >= 0, `fant ikke «${signatur}»`);
  const slutt = src.slice(start + signatur.length).search(/\n(export )?(async )?function /);
  return slutt < 0 ? src.slice(start) : src.slice(start, start + signatur.length + slutt);
}

// --- Bolk D (v5.34) ----------------------------------------------------------

test("funn 8: en åpen sjangerhistorie tegnes på nytt av begge snapshotene", () => {
  const ctx = les("js/explore-context.js");
  assert.match(ctx, /import \{[^}]*\brefreshHistorie\b[^}]*\} from "\.\/explore-innhold\.js/,
    "refreshHistorie må importeres (uten importen: ReferenceError i hvert snapshot)");
  assert.equal(antall(ctx, /\bmodal-historier"\)[^;\n]*\) refreshHistorie\(\);/g), 2,
    "både contentChanged og genreDescsChanged skal kalle den bak isOpen-sjekken");
  const inn = les("js/explore-innhold.js");
  assert.match(inn, /export function refreshHistorie\(\) \{\n\s*if \(currentStoryGenre != null\) renderHistorie\(currentStoryGenre, \{ fraSnapshot: true \}\);/);
  // Audit v5.42 funn 14: bare ved endring, og aldri til toppen ved omtegning.
  assert.match(inn, /if \(fraSnapshot && sig === historieSignatur\) return;/);
  assert.match(inn, /if \(box && !fraSnapshot\) box\.scrollTop = 0;/);
});

test("funn 11: kodeoppslaget har in-flight-sperre og ignorerer auto-repeat", () => {
  const src = les("js/landing.js");
  assert.match(src, /if \(henterRetur\) return;/);
  assert.match(src, /henterRetur = false;/, "sperra må løses i finally");
  assert.match(src, /if \(e\.repeat\) return;/);
});

test("funn 13: omtegning hever aldri sjangerkortet over modaler oppå det", () => {
  const src = les("js/genealogy.js");
  assert.match(src, /showSjangerInfo\(openSjanger\.label, openSjanger\.opts, \{ reopen: false \}\)/);
  assert.match(src, /if \(reopen \|\| !modal\.classList\.contains\("open"\)\) modalOpen\(modal\);/);
});

test("funn 17: mobilblokka nuller ikke main- og footer-paddingen", () => {
  const css = les("css/styles.css");
  assert.match(css, /\.wrap \{ padding-inline: 14px; \}/);
  assert.match(css, /main \{ padding-block: 20px 50px; \}/);
  assert.doesNotMatch(css, /\.wrap \{ padding: 0 14px; \}/, "korthånden slo main (spesifisitet)");
});

test("funn 18: slektstre-SVG-en skjuler ikke nodeknappene for skjermlesere", () => {
  const svg = les("tre.html").match(/<svg id="gx-svg"[^>]*>/)?.[0] || "";
  assert.match(svg, /role="group"/);
  assert.doesNotMatch(svg, /role="img"/, "img har Children Presentational: True");
});

// --- Bolk E (v5.35) ----------------------------------------------------------

test("funn 19: kjønn, metasjanger og instrument bevarer verdier utenfor vokabularet", () => {
  const src = les("js/teacher-artists.js");
  for (const id of ["ed-gender", "ed-metaGenre", "ed-instrument"]) {
    assert.match(src, new RegExp(`settSelectMedVern\\(\\$\\("#${id}"\\)`), `${id} må gå via vernet`);
  }
  assert.doesNotMatch(src, /\$\("#ed-(gender|instrument)"\)\.value = a\./,
    "rå tilordning ga tom select, og Lagre tømte feltet stille");
});

test("funn 20: metasjanger-editoren gjenoppretter ikke en omdøpt eller slettet metasjanger", () => {
  const src = kropp(les("js/teacher-genres.js"), "async function lagreMeta(");
  assert.match(src, /if \(redigererMeta && !gammel\) \{/);
});

test("funn 21: lukketimerne på lærersiden huskes og avbrytes", () => {
  for (const f of ["js/teacher-artists.js", "js/teacher-content.js"]) {
    assert.doesNotMatch(les(f), /setTimeout\(\(\) => closeAdminModal\(/, `${f}: uavbrutt lukketimer`);
  }
  assert.equal(antall(les("js/teacher-artists.js") + les("js/teacher-content.js"), /lukkEtter\("modal-/g), 5,
    "artist, kobling, sjanger, innovasjonskort og tiår");
  const state = les("js/teacher-state.js");
  assert.match(kropp(state, "export function openAdminModal("), /avbrytLukkEtter\(id\);/,
    "åpning av en modal skal rydde timeren dens sentralt");
  assert.match(kropp(state, "export function lukkEtter("), /avbrytLukkEtter\(id\);/,
    "en ny timer erstatter den forrige for samme modal");
});

test("funn 22: navnebytte-planen bygges ikke fra et snapshot som ikke har tatt igjen lagringen", () => {
  assert.match(kropp(les("js/store.js"), "export async function saveGenealogyTree("), /return updatedAt;/);
  const src = les("js/teacher-genres.js");
  assert.equal(antall(src, /stempel = await saveGenealogyTree\(nyttTre\);/g), 2);
  assert.equal(antall(src, /\(snap\?\.updatedAt \|\| ""\) >= stempel \? snap : nyttTre/g), 2,
    "både sjanger- og metasjanger-grenen");
  assert.doesNotMatch(src, /state\.content\?\.genealogy \|\| nyttTre/,
    "fallbacken traff bare når treet manglet HELT, ikke når det var foreldet");
});

test("funn 23: ferskhetssjekken sammenligner kanonisk JSON", () => {
  const src = kropp(les("js/teacher-genres.js"), "async function utforPlan(");
  assert.match(src, /const utenTid = \(ops\) => kanoniskJson\(/);
});

test("funn 24 og 25: retur-innsending setter ikke flagget, og oppslaget går parallelt", () => {
  const src = les("js/store.js");
  for (const f of ["resubmitArtist", "resubmitTech", "resubmitPendingEdit"]) {
    assert.doesNotMatch(kropp(src, `export async function ${f}(`), /merkHarSendtInn\(\);/,
      `${f}: flagget ga tre bortkastede lesinger per sidelast på en fremmed enhet`);
  }
  assert.match(kropp(src, "export async function addArtist("), /merkHarSendtInn\(\);/,
    "førstegangs-innsending skal fortsatt sette flagget");
  const sporring = kropp(src, "async function returSporring(");
  assert.match(sporring, /await Promise\.all\(/);
  assert.doesNotMatch(sporring, /for \(const .* of Object\.entries\(RETUR_SAMLING\)\) \{\n\s*const snap = await/);
});

test("funn 26: én eksportvakt dekker alle samlingene, også før de automatiske backupene", () => {
  const src = les("js/teacher-import.js");
  const vakt = kropp(src, "function kanEksportere(");
  for (const flagg of ["artistsLoaded", "contentLoaded", "genreDescsLoaded", "edgeDescsLoaded",
    "techLoaded", "decadesLoaded", "podcastsLoaded", "teacherChecksLoaded"]) {
    assert.ok(vakt.includes(`state.${flagg}`), `vakten mangler ${flagg}`);
  }
  assert.match(vakt, /return confirm\(/, "en nesten tom eksport (tom cache) må bekreftes");
  assert.equal(antall(src, /if \(!kanEksportere\(\)\) return/g), 3,
    "manuell eksport, «Slett alt» og «Erstatt alle»");
  assert.equal(antall(src, /downloadJson\(buildExportData\(\)/g), 3,
    "ny eksportvei? Den må også gå via kanEksportere");
  const shared = les("js/shared-data.js");
  for (const flagg of ["edgeDescsLoaded", "techLoaded", "decadesLoaded", "podcastsLoaded"]) {
    assert.match(shared, new RegExp(`${flagg}: false,`), `${flagg} mangler i standardverdiene`);
    assert.match(shared, new RegExp(`state\\.${flagg} = true;`), `${flagg} settes aldri`);
  }
  assert.match(les("js/teacher.js"), /state\.teacherChecksLoaded = true;/);
});

test("funn 28: «skriver til» vises bare der ID-en er et lesbart navn", () => {
  const src = les("js/teacher-review.js");
  const liste = src.match(/const navnebasert = \[([^\]]*)\]/)?.[1] || "";
  for (const t of ["subgenre", "instrument", "decade-society", "decade-tech"]) {
    assert.ok(liste.includes(`"${t}"`), `${t} mangler`);
  }
  for (const t of ["artist", "tech"]) {
    assert.ok(!liste.includes(`"${t}"`), `${t} bærer en tilfeldig Firestore-ID`);
  }
});

test("funn 30: koblinger med kilder men uten tekst følger med i eksport og import", () => {
  const src = les("js/teacher-import.js");
  assert.match(src, /\.filter\(\(\[, rest\]\) => rest\.description \|\| \(rest\.kilder \|\| \[\]\)\.length\)/);
  assert.match(src, /\.filter\(\(\[, data\]\) => data && \(data\.description \|\| \(data\.kilder \|\| \[\]\)\.length\)\)/);
});

test("funn 31: historiestripene bruker varmekartets tomhets-predikat", () => {
  const src = les("js/explore-innhold.js");
  assert.match(src, /const hasData = !!heat && Object\.keys\(heat\)\.length > 0;/);
  assert.match(src, /: hasData \? heatBlockHtml\(/);
});

test("funn 33: instrumentkortet viser ferske lister", () => {
  const src = les("js/explore-instrument.js");
  assert.match(src, /\[t\.id, t\.name, t\.adoptedYear, t\.adoptedLabel, t\.type\]/,
    "signaturen må dekke det tidslinja viser");
  assert.match(src, /openArtistListModal\(\n?\s*`Artister: \$\{group\}`, artistsInInstrumentGroup\(getState\(\)\.artists, group\)/,
    "artistlista hentes ved klikk");
  assert.match(src, /openTechListModal\(group, instrumentInnovations\(getState\(\)\.techItems, group\)\)/,
    "nyvinningslista hentes ved klikk");
  assert.match(kropp(src, "export function openInstrumenter("), /renderUtvikling\(true\);/,
    "åpning skal tvinge omtegning forbi signaturvakten");
});

test("funn 34: slektstreet dimmes bare ved tastaturfokus", () => {
  const src = les("js/genealogy-bundled.js");
  assert.match(src, /g\.addEventListener\("focus", \(\) => \{ if \(g\.matches\(":focus-visible"\)\) light\(n\.id\); \}\);/);
  assert.doesNotMatch(src, /g\.addEventListener\("focus", \(\) => light\(n\.id\)\);/);
});

test("funn 37: JSON-oppskriften lover ingen «Les mer»-knapp", () => {
  const doc = les("JSON-OPPSKRIFT.md");
  assert.doesNotMatch(doc, /Les mer»-knappen/);
  assert.doesNotMatch(doc, /…More/);
});

test("funn 38: viktighetsbaren brytes til egen rad ETTER ←/✕ på mobil", () => {
  const css = les("css/styles.css");
  const blokk = css.match(/@media \(max-width: 640px\) \{\n  #modal-artister #sp-prio-bar \{[^}]*\}/)?.[0] || "";
  assert.ok(blokk, "fant ikke mobilregelen for #sp-prio-bar");
  assert.match(blokk, /flex: 0 0 100%;/);
  assert.match(blokk, /order: 1;/);
});
