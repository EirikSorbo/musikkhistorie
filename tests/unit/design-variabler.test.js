// Designvariablene (v6.59, brukerønske 2026-10-08): hele utseendet skal kunne
// endres i :root-blokka øverst i css/styles.css. Testene holder det slik: ingen
// fargekoder, rgb()-verdier eller skriftnavn utenfor :root, og ingen var() til
// en variabel som ikke finnes (en skrivefeil gir ellers stille feil farge).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const utenKommentarer = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

function delOpp(css) {
  const ren = utenKommentarer(css);
  const i = ren.indexOf(":root");
  const j = ren.indexOf("}", i) + 1;
  return { rot: ren.slice(i, j), resten: ren.slice(0, i) + ren.slice(j) };
}

const styles = delOpp(les("css/styles.css"));
const utskrift = utenKommentarer(les("css/utskrift.css"));
const definert = new Set([...styles.rot.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

// Variabler som settes lokalt (i en regel eller fra JS/HTML per element), ikke i :root.
const LOKALE = new Set(["--farge", "--fam", "--ikon", "--vs-farge", "--tl-color", "--stolpe", "--stem",
  "--sj-farge", "--ref-farge", "--mo-farge", "--mo-mork", "--hist-color", "--dr-cols", "--icon-mono"]);
for (const m of utskrift.matchAll(/(--h-[\w-]+)\s*:/g)) LOKALE.add(m[1]);

test("ingen fargekoder eller rgb()-verdier utenfor :root", () => {
  const farge = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g;
  assert.deepEqual(styles.resten.match(farge) || [], [], "styles.css: flytt fargen til en variabel i :root");
  assert.deepEqual(utskrift.match(farge) || [], [], "utskrift.css: flytt fargen til en variabel i :root");
});

test("ingen skriftnavn utenfor :root", () => {
  for (const [navn, tekst] of [["styles.css", styles.resten], ["utskrift.css", utskrift]]) {
    const treff = [...tekst.matchAll(/font-family\s*:\s*([^;}]+)/g)].map((m) => m[1].trim())
      .filter((v) => v !== "inherit" && !/^var\(--font-[\w-]+\)$/.test(v));
    assert.deepEqual(treff, [], `${navn}: bruk var(--font-body), var(--font-display) eller var(--font-mono)`);
  }
});

test("hver var() uten reserve peker på en variabel som finnes", () => {
  const filer = {
    "css/styles.css": utenKommentarer(les("css/styles.css")),
    "css/utskrift.css": utskrift,
    "index.html": les("index.html"),
    "teacher.html": les("teacher.html"),
  };
  for (const [navn, tekst] of Object.entries(filer)) {
    const mangler = [...tekst.matchAll(/var\((--[\w-]+)\s*\)/g)].map((m) => m[1])
      .filter((v) => !definert.has(v) && !LOKALE.has(v));
    assert.deepEqual([...new Set(mangler)], [], `${navn}: udefinert variabel`);
  }
});

test("ikonfargene på kortene kommer fra variablene", () => {
  for (const f of ["index.html", "teacher.html", "js/utforsk/explore-modals.js"]) {
    const kilde = les(f);
    assert.doesNotMatch(kilde, /class="dash-icon"[^>]*stroke="#/, `${f}: sett --ikon, ikke stroke="#…"`);
    assert.doesNotMatch(kilde, /--farge:#/, `${f}: --farge skal peke på en --icon-*-variabel`);
  }
  assert.match(les("css/styles.css"), /\.dash-icon \{[^}]*stroke: var\(--ikon, currentColor\);/);
});

test("lagene (z-index) har uendrede verdier: koden og visningen regner med rekkefølgen", () => {
  const z = Object.fromEntries([...styles.rot.matchAll(/(--z-[\w-]+)\s*:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(z, {
    "--z-topbar": 20, "--z-menu": 30, "--z-modal": 100, "--z-modal-fade": 101, "--z-role-gate": 200,
    "--z-pass-gate": 300, "--z-tooltip": 2000, "--z-drawer": 10000, "--z-canvas-frame": 99998,
    "--z-bar": 99999, "--z-blackout": 100000, "--z-notes": 100001,
  });
});
