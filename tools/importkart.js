#!/usr/bin/env node
// ============================================================================
//  IMPORTKART — cache-busting for modulene, skrevet ett sted per side
// ----------------------------------------------------------------------------
//  Modulene importerer hverandre UTEN versjon (`from "./ui.js"`). Hver side har
//  et importkart som nettleseren slår opp i før den henter en modul, og der får
//  hver modul ?v= fra js/version.js:
//      ./js/ui/ui.js  →  ./js/ui/ui.js?v=6.28
//  En ny versjon endrer da bare js/version.js og noen få linjer per side, og
//  historikken til en js-fil viser bare ekte endringer. (Til og med v6.27 sto
//  ?v= i hver importlinje, og hver versjon rørte rundt 125 filer.)
//
//  Kartet er ÉN linje rett under <title>. Det må stå før første modulskript,
//  ellers ser nettleseren bort fra det. Alle .js-filene under js/ er med, også
//  i mappene (fra v6.30), unntatt vendor/ og de klassiske skriptene sidene
//  laster med <script src> (gate.js, load-guard.js): de er ikke moduler. Hele lista står på alle sidene, så ingen modul kan
//  lastes uten ?v= fordi den manglet i kartet til én side. <script src> selv
//  går ikke gjennom kartet, så inngangsmodulen (landing.js osv.) har fortsatt
//  sin egen ?v= i HTML-en; bump.sh setter den.
//
//  Nettlesere uten importkart (Safari før 16.4) henter modulene uten ?v=:
//  appen virker, men uten cache-busting.
//
//  Kjør:  node tools/importkart.js           skriver kartet i alle *.html
//         node tools/importkart.js --sjekk   exit 1 hvis et kart er utdatert
//  bump.sh kjører den første, check-versjon.sh (pre-push og CI) den andre.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sjekk = process.argv.includes("--sjekk");

const VERSION = fs.readFileSync(path.join(ROT, "js", "version.js"), "utf8").match(/"([0-9][0-9.]*)"/)?.[1];
if (!VERSION) {
  console.error("importkart: fant ikke VERSION i js/version.js");
  process.exit(1);
}

const sider = fs.readdirSync(ROT).filter((f) => f.endsWith(".html")).sort();
const html = Object.fromEntries(sider.map((f) => [f, fs.readFileSync(path.join(ROT, f), "utf8")]));

// Klassiske skript: <script src="js/x.js…"> uten type="module".
const klassiske = new Set();
for (const kilde of Object.values(html)) {
  for (const m of kilde.matchAll(/<script\b([^>]*)\bsrc="js\/([^"?]+\.js)[^"]*"([^>]*)>/g)) {
    if (!/type="module"/.test(m[1] + m[3])) klassiske.add(m[2]);
  }
}

// Stier relativt til js/ («utforsk/explore.js»), med mappene.
const moduler = [];
(function gaa(rel) {
  for (const e of fs.readdirSync(path.join(ROT, "js", rel), { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "vendor") continue;
    const sti = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) gaa(sti);
    else if (e.name.endsWith(".js") && !klassiske.has(sti)) moduler.push(sti);
  }
})("");
moduler.sort();
const kart = { imports: Object.fromEntries(moduler.map((f) => [`./js/${f}`, `./js/${f}?v=${VERSION}`])) };
const KARTLINJE = `  <script type="importmap">${JSON.stringify(kart)}</script>`;
const KOMMENTAR = "  <!-- Importkartet gir modulene ?v= (cache-busting). Skrives av tools/importkart.js via bump.sh, ikke for hånd. -->";
const erModulskript = (l) => /<script\b[^>]*type="module"/.test(l);

const feil = [];
for (const side of sider) {
  const kilde = html[side];
  if (!erModulskript(kilde)) continue;               // en side uten moduler trenger ikke kart
  const linjer = kilde.split("\n");
  const i = linjer.findIndex((l) => l.includes('<script type="importmap">'));

  if (sjekk) {
    if (i < 0) feil.push(`${side}: mangler importkart`);
    else if (linjer[i] !== KARTLINJE) feil.push(`${side}: importkartet er utdatert (versjon eller modulliste)`);
    else if (linjer.findIndex(erModulskript) < i) feil.push(`${side}: importkartet står etter et modulskript`);
    continue;
  }

  if (i >= 0) {
    linjer[i] = KARTLINJE;
  } else {
    const t = linjer.findIndex((l) => l.includes("</title>"));
    if (t < 0) { feil.push(`${side}: fant ikke </title> å sette kartet under`); continue; }
    linjer.splice(t + 1, 0, KOMMENTAR, KARTLINJE);
  }
  const ny = linjer.join("\n");
  if (ny !== kilde) fs.writeFileSync(path.join(ROT, side), ny);
}

if (feil.length) {
  console.error(`importkart:\n  ${feil.join("\n  ")}`);
  process.exit(1);
}
console.log(sjekk
  ? `importkart: kartene er à jour (v${VERSION}, ${moduler.length} moduler)`
  : `importkart: skrev kartet for v${VERSION} (${moduler.length} moduler)`);
