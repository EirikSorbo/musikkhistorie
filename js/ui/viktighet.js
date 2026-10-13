// ============================================================================
//  VIKTIGHETSNIVÅET — ett aktivt nivå for hele appen, med merke i toppfeltet
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-10-13 (v6.85). Filterknappene for viktighetsgrad
//  (Artister-vinduet på forsiden og lærerlista) setter ETT nivå for appen,
//  trinnvis:
//      3  Viktigst        bare viktigst
//      2  Viktig          viktig og viktigst
//      1  Mindre viktig   alle med grad (mindre viktig, viktig og viktigst)
//  Artister uten grad er ute når et nivå er valgt (iViktighetsnivaa i
//  js/felles/limits.js). Nivået gjelder artistlistene og alle spillelistene
//  som lages av artistene (js/ui/ui.js), og en firkant midt i toppfeltet viser
//  symbolet. Et klikk på firkanten slår nivået av.
//
//  Nivået står i localStorage, så det følger nettleseren over sidene og til
//  lerretet. Det gjelder bare når viktighetsgraden er synlig: alltid for
//  læreren, for studentene når bryteren «Viktighetsgraden» (Skrivebordet,
//  «Synlig for studentene») er på. Ellers er nivået 0, uansett hva som er lagret.
// ============================================================================

import { SKJUL_I_STUDENTVISNING } from "../felles/feature-flags.js";
import { iViktighetsnivaa } from "../felles/limits.js";
import { getState } from "../data/app-state.js";
import { PRIO_ICONS } from "./ui-helpers.js";

const NOKKEL = "pensum-viktighet";
const MERKE_ID = "viktighet-merke";

export const NIVAA_TEKST = {
  3: "Bare viktigst",
  2: "Viktig og viktigst",
  1: "Alle med viktighetsgrad",
};

let laererside = false;
// Lærersiden ser alltid viktighetsgraden (teacher.js kaller denne ved oppstart).
export function settLaererside(v = true) { laererside = !!v; }

export function viktighetSynlig() {
  return laererside || !!getState().isTeacher || !SKJUL_I_STUDENTVISNING.viktighetsgrad;
}

function lagretNivaa() {
  try {
    const n = Number(localStorage.getItem(NOKKEL));
    return [1, 2, 3].includes(n) ? n : 0;
  } catch (e) { return 0; }
}

// Nivået som gjelder nå (0 = ingen).
export function aktivtNivaa() {
  return viktighetSynlig() ? lagretNivaa() : 0;
}

export function settNivaa(n) {
  const v = [1, 2, 3].includes(Number(n)) ? Number(n) : 0;
  try {
    if (v) localStorage.setItem(NOKKEL, String(v));
    else localStorage.removeItem(NOKKEL);
  } catch (e) { /* uten lagring gjelder nivået ikke */ }
  varsle();
}

// Lytteren får det gjeldende nivået ved hver endring: knappene, en annen fane
// (storage) og bryteren for synlighet (pensum:synlighet).
const lyttere = new Set();
export function vedNivaaEndring(f) { lyttere.add(f); }
function varsle() {
  oppdaterMerke();
  const n = aktivtNivaa();
  lyttere.forEach((f) => { try { f(n); } catch (e) { console.warn(e); } });
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === NOKKEL) varsle(); });
  // Bryterne for hva studentene ser, kan lande eller endres mens siden står
  // åpen (feature-flags.js): da kan nivået ha gått fra 0 til lagret eller motsatt.
  document.addEventListener("pensum:synlighet", varsle);
}

// Artistene på det aktive nivået (alle når det ikke er noe nivå).
export function etterNivaa(liste) {
  const n = aktivtNivaa();
  const l = liste || [];
  return n ? l.filter((a) => iViktighetsnivaa(a, n)) : l;
}

// --- Firkanten midt i toppfeltet ----------------------------------------------

export function initViktighetsMerke() {
  const wrap = document.querySelector(".topbar .wrap");
  if (!wrap || document.getElementById(MERKE_ID)) return oppdaterMerke();
  const knapp = document.createElement("button");
  knapp.type = "button";
  knapp.id = MERKE_ID;
  knapp.hidden = true;
  knapp.addEventListener("click", () => settNivaa(0));
  // Mellom logoen og ikonene i flex-rekka; CSS sentrerer den på brede skjermer.
  const nav = wrap.querySelector(".nav");
  wrap.insertBefore(knapp, nav || null);
  oppdaterMerke();
}

export function oppdaterMerke() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(MERKE_ID);
  if (!el) return;
  const n = aktivtNivaa();
  el.hidden = !n;
  if (!n) return;
  el.className = `viktighet-merke prio-${n}`;
  el.innerHTML = PRIO_ICONS[n];
  const tekst = `Viktighetsnivå: ${NIVAA_TEKST[n].toLowerCase()}. Gjelder artistlista og spillelistene. Klikk for å slå av.`;
  el.title = tekst;
  el.setAttribute("aria-label", tekst);
}
