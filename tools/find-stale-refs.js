#!/usr/bin/env node
// ============================================================================
//  FINN GAMLE REFERANSER
// ----------------------------------------------------------------------------
//  grep er UPÅLITELIG i dette repoet: flere kildefiler inneholder byte-sekvenser
//  som får grep til å behandle dem som binære og hoppe stille over dem (uten
//  -a). Det skjulte at explore-tidslinje.js fortsatt brukte canonMain, og
//  feilen dukket først opp som en ReferenceError da tidslinjen ble åpnet.
//
//  Dette verktøyet leser filene med node i stedet, så ingenting hoppes over.
//
//  Kjør:  node tools/find-stale-refs.js canonMain FAM_STROKE ...
//         node tools/find-stale-refs.js            (bruker standardlista under)
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Navn som ble fjernet i overgangen til js/genre-model.js (v4.48–4.50). Ingen
// av dem skal finnes i kode lenger; treff i en kommentar er greit og markeres.
const STANDARD = ["canonMain", "FAM_STROKE", "MAIN_GENRE_SET", "META_SET"];
// (META_ORDER_HINT og nodeById står IKKE her: de finnes fortsatt lovlig —
//  den første som eksport i genealogy-data.js, den andre som lokalt
//  variabelnavn i constellation.js og ui-dashboard.js.)

const navn = process.argv.slice(2).length ? process.argv.slice(2) : STANDARD;

const mapper = ["js", "tests/unit", "tests/helpers", "tools"];
const filer = [];
for (const m of mapper) {
  const d = path.join(ROT, m);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith(".js")) continue;
    if (m === "tools" && f === "find-stale-refs.js") continue;   // verktøyet nevner navnene selv
    filer.push(path.join(m, f));
  }
}
for (const f of fs.readdirSync(ROT)) if (f.endsWith(".html")) filer.push(f);

let treff = 0, kodetreff = 0;
for (const rel of filer) {
  const linjer = fs.readFileSync(path.join(ROT, rel), "utf8").split("\n");
  linjer.forEach((linje, i) => {
    for (const n of navn) {
      // Ordgrense som også tåler $ og som ikke matcher lengre navn
      // (canonMain skal ikke treffe canonMainGenre).
      const re = new RegExp(`(?<![A-Za-z0-9_$])${n}(?![A-Za-z0-9_$])`);
      if (!re.test(linje)) continue;
      const erKommentar = /^\s*(\/\/|\*|\/\*)/.test(linje) || /<!--/.test(linje);
      treff++;
      if (!erKommentar) kodetreff++;
      console.log(`${erKommentar ? "  kommentar" : "  KODE     "} ${rel}:${i + 1}  ${linje.trim().slice(0, 100)}`);
    }
  });
}

console.log(`\n${filer.length} filer lest. ${treff} treff, hvorav ${kodetreff} i KODE.`);
if (kodetreff) console.log("Kodetreff må ryddes — de er referanser til noe som ikke finnes lenger.");
process.exit(kodetreff ? 1 : 0);
