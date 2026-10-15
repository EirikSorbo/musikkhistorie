// Designvariablene (v6.59, brukerønske 2026-10-08): hele utseendet skal kunne
// endres i :root-blokka øverst i css/styles.css (og fargeblokkene rett under). Testene holder det slik: ingen
// fargekoder, rgb()-verdier eller skriftnavn utenfor :root, og ingen var() til
// en variabel som ikke finnes (en skrivefeil gir ellers stille feil farge).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const utenKommentarer = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

// :root-blokka og fargeblokkene :root[data-farge="…"] (v6.71) regnes som rot.
function delOpp(css) {
  const ren = utenKommentarer(css);
  const blokker = ren.match(/:root[^{]*\{[^}]*\}/g) || [];
  return { rot: blokker.join("\n"), blokker, resten: ren.replace(/:root[^{]*\{[^}]*\}/g, "") };
}

const styles = delOpp(les("css/styles.css"));
const utskrift = utenKommentarer(les("css/utskrift.css"));
const definert = new Set([...styles.rot.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

// Variabler som settes lokalt (i en regel eller fra JS/HTML per element), ikke i :root.
const LOKALE = new Set(["--farge", "--fam", "--ikon", "--vs-farge", "--tl-color", "--stolpe", "--stem",
  "--sj-farge", "--ref-farge", "--mo-farge", "--mo-mork", "--hist-color", "--dr-cols", "--icon-mono",
  // Slidekortet (v7.06): innrykket fra venstre og høyre, satt på .modal-slide
  "--slide-venstre", "--slide-hoyre"]);
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

// Fargerotasjonen (v6.71, brukerønske 2026-10-11): én blokk per farge, samme
// navn som i js/farge.js, og bare farger med nok kontrast.
const lysstyrke = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const motHvitt = (hex) => 1.05 / (lysstyrke(hex) + 0.05);
const fargeblokker = Object.fromEntries(styles.blokker
  .map((b) => [b.match(/^:root\[data-farge="([a-z]+)"\]/)?.[1], b]).filter(([navn]) => navn)
  .map(([navn, b]) => [navn, Object.fromEntries([...b.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))]));

test("fargeblokkene: samme farger som js/farge.js, og hver setter de samme seks variablene", async () => {
  const vm = await import("node:vm");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(les("js/farge.js"), ctx);
  assert.deepEqual(Object.keys(fargeblokker), [...ctx.pensumFarge.FARGER]);
  for (const [navn, v] of Object.entries(fargeblokker)) {
    assert.deepEqual(Object.keys(v).sort(),
      ["--accent-100", "--accent-200", "--accent-50", "--accent-600", "--accent-700", "--accent-rgb"], navn);
    const rgb = [1, 3, 5].map((i) => parseInt(v["--accent-600"].slice(i, i + 2), 16)).join(", ");
    assert.equal(v["--accent-rgb"], rgb, `${navn}: --accent-rgb skal være trinn 600`);
  }
});

test("fargeblokkene: trinn 600 og 700 har minst 4,5:1 mot hvitt (hvit tekst på fargen, fargen som tekst)", () => {
  for (const [navn, v] of Object.entries(fargeblokker)) {
    for (const trinn of ["--accent-600", "--accent-700"]) {
      assert.ok(motHvitt(v[trinn]) >= 4.5, `${navn} ${trinn} ${v[trinn]}: ${motHvitt(v[trinn]).toFixed(2)}:1`);
    }
  }
});

test("standarden i :root er rød, lik blokka for rod (uten farge.js)", () => {
  const rot = styles.blokker.find((b) => /^:root\s*\{/.test(b));
  for (const [k, verdi] of Object.entries(fargeblokker.rod)) {
    assert.match(rot, new RegExp(`${k}:\\s*${verdi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`), k);
  }
  assert.doesNotMatch(utenKommentarer(les("css/styles.css")), /--vermilion-/, "skalaen heter --accent-* fra v6.71");
});
