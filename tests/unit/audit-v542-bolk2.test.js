// Audit v5.42, bolk 2 (v5.45): funn 5 (kjøreplanene i eksporten) + forslag 1
// («Dupliser»), og opptaks- og lenkefunnene 14, 15, 16, 17, 18 og 27.
// Rene tester der koden kan kjøres i Node, ellers kildelåser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeImportFile, CONTENT_KEYS } from "../../js/import-format.js?v=5.55";

const kilde = (f) => readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");

test("funn 5: kjøreplanene er med i eksporten og slipper gjennom importens hviteliste", () => {
  assert.ok(CONTENT_KEYS.includes("presentasjoner"), "en fil med bare planer er en gyldig innholdsfil");
  const fil = { presentasjoner: { planer: { p1: { tittel: "Uke 39", laget: "x", stopp: [{ vis: "artist:a" }] } } } };
  assert.deepEqual(normalizeImportFile(fil).presentasjoner, fil.presentasjoner);
  assert.equal(normalizeImportFile({ artists: [] }).presentasjoner, null);
  const imp = kilde("teacher-import.js");
  assert.match(imp, /const planer = eksportPlaner\(state\.content\?\.presentasjoner\?\.planer\);/);
  assert.match(imp, /out\.presentasjoner = \{ planer, updatedAt:/);
  // Eksporten tar ikke med samleøktenes merker.
  assert.match(imp, /\.map\(\(\[id, p\]\) => \[id, \{ tittel: p\.tittel, laget: p\.laget, stopp: p\.stopp \}\]\)/);
  // Importen fletter plan for plan, etter at læreren har sett lista.
  assert.match(imp, /async function importExtras\(\{[^}]*presentasjoner \}\)/);
  assert.match(imp, /if \(window\.confirm\(`Kjøreplaner i fila:/);
  // Én skriving for alle planene (kontrollrunden for v5.45).
  assert.match(imp, /await savePlaner\(Object\.fromEntries\(\[\.\.\.nye, \.\.\.erstattes\]\)\);/);
  assert.match(kilde("store.js"), /export async function savePlaner\(planer\) \{\n\s*return setDoc\(presentasjonerRef\(\),\n\s*\{ planer, updatedAt: new Date\(\)\.toISOString\(\) \}, \{ merge: true \}\);/);
});

test("forslag 1: «Dupliser» lager en ny plan med kopi av stoppene", () => {
  const vis = kilde("visning.js");
  assert.match(vis, /data-pres-dupliser="\$\{escapeHtml\(id\)\}"/);
  assert.match(vis, /const kopi = \{ tittel, laget: new Date\(\)\.toISOString\(\), stopp: p\.stopp\.map\(\(x\) => \(\{ \.\.\.x \}\)\) \};/);
  assert.match(vis, /if \(!\(await vakt\(savePlan\(nyPlanId\(\), kopi\)\)\)\) return;/);
  // Samles planen, avsluttes økta først, så kopien har med alt.
  const dup = vis.slice(vis.indexOf('hit("[data-pres-dupliser]")'));
  assert.match(dup, /if \(aktivSamleokt\(\)\?\.planId === id\) await medFrist\(avsluttInnsamling\(\), 4000\);\n\s*const p = planerNaa\(\)\[id\];/);
});

test("funn 15: varmekartet tar bare en kjent metasjanger, aldri klikkhendelsen", () => {
  const vk = kilde("explore-varmekart.js");
  assert.match(vk, /const m = typeof meta === "string" && META_GENRE_ORDER\.includes\(meta\) \? meta : null;/);
  const ex = kilde("explore.js");
  assert.doesNotMatch(ex, /addEventListener\("click", openVarmekart\)/);
  assert.doesNotMatch(ex, /paaKort\("sb-varmekart", openVarmekart\)/);
});

test("funn 16: tiåret og teknologikategorien følger med i data-vis", () => {
  const dec = kilde("explore-decade.js");
  const render = dec.slice(dec.indexOf("function renderDecadeView("));
  assert.match(render, /const vis = `tiår:\$\{d\}:\$\{contextMode\}`;\n\s*if \(modal\.dataset\.vis !== vis\) modal\.dataset\.vis = vis;/,
    "settes i renderDecadeView, som båndet og forrige/neste kaller");
  const tech = kilde("explore-tech.js");
  assert.match(tech, /const vis = category \? `teknologi:\$\{category\}` : "teknologi";/);
});

test("funn 17: artistkortet på lærersiden bærer målet for synlige artister", () => {
  const ta = kilde("teacher-artists.js");
  assert.match(ta, /if \(isVisible\(artist\)\) modal\.dataset\.vis = `artist:\$\{artist\.id\}`;\n\s*else delete modal\.dataset\.vis;\n\s*modalOpen\(modal\);/);
});

test("funn 18: dype lenker venter på dataene kortet tegnes av, og tech-snapshotet dytter dem", () => {
  const apne = kilde("explore-apne.js");
  assert.match(apne, /case "teknologi":\n\s*return s\.techLoaded \? "klar" : "vent";/);
  assert.match(apne, /case "kobling":\n\s*return isGenreModelReady\(\) && s\.edgeDescsLoaded && s\.genreDescsLoaded \? "klar" : "vent";/);
  assert.match(apne, /case "himmel": case "tidslinje":\n\s*return isGenreModelReady\(\) && s\.artistsLoaded \? "klar" : "vent";/);
  assert.match(apne, /\(apne\.modus !== "tech" \|\| s\.techLoaded\)/);
  for (const f of ["landing.js", "tre-page.js"]) {
    const src = kilde(f);
    assert.match(src, /onTech: \(\) => \{[^}]*refreshTeknologi\?\.\(\);[^}]*provVisMaal\(\);/, f);
    assert.match(src, /onEdgeDescs: \(\) => provVisMaal\(\),/, f);
  }
  assert.match(kilde("teacher.js"), /ctx\.explore\?\.refreshTeknologi\?\.\(\);/);
});

test("funn 27: Angre fjerner bare øktas egne stopp, og knappen er av uten noe å angre", () => {
  const samle = kilde("plan-innsamling.js");
  assert.match(samle, /if \(!økt \|\| !økt\.egne\.length\) return;\n\s*const vis = økt\.egne\.pop\(\);/);
  assert.match(samle, /if \(angre\) angre\.disabled = !økt\.egne\.length;/);
  assert.match(samle, /økt\.nye\.push\(\{ t: "legg", vis \}\);\n\s*økt\.egne\.push\(vis\);/);
});
