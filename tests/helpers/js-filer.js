// ============================================================================
//  TESTHJELPER — js-filene, uansett hvilken mappe de ligger i
// ----------------------------------------------------------------------------
//  Fra v6.30 ligger modulene i mapper under js/ (utforsk/, laerer/, ui/ …).
//  Kildetestene slår opp en fil på NAVN her, så de ikke må vite hvilken mappe
//  den bor i, og skanningene går gjennom alle mappene. En skanning som bare så
//  på js/ selv, ville ellers ha bestått uten å lese mer enn sidefilene.
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROT = fileURLToPath(new URL("../../js/", import.meta.url));

// Alle .js-filene under js/, som stier relativt til js/ («utforsk/explore.js»).
// vendor/ er tredjepartskode og holdes utenfor.
export function jsFiler() {
  const ut = [];
  const gaa = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const sti = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "vendor") gaa(sti); }
      else if (e.name.endsWith(".js")) ut.push(relative(ROT, sti).split(sep).join("/"));
    }
  };
  gaa(ROT);
  return ut.sort();
}

// Full sti til en fil, gitt filnavnet («ui-modal.js») eller stien under js/
// («ui/ui-modal.js»). Filnavnene er unike i hele js/; to treff er en feil.
export function jsSti(navn) {
  const n = navn.replace(/^js\//, "");
  const treff = jsFiler().filter((f) => (n.includes("/") ? f === n : basename(f) === n));
  if (treff.length !== 1) throw new Error(`jsSti: ${treff.length} filer heter «${navn}»`);
  return join(ROT, treff[0]);
}

export const lesJs = (navn) => readFileSync(jsSti(navn), "utf8");
