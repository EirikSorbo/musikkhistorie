// ============================================================================
//  SJANGERKORTETS LERRET (v5.89) — oppsettet i presentasjonsvisningen
// ----------------------------------------------------------------------------
//  Brukerønske 2026-09-29: artistene i sjangeren som navneliste i en egen
//  spalte til høyre, så punktene (nivå 2) eller beskrivelsen (nivå 3) står
//  til venstre som før. Varmestripa står øverst over hele bredden, med
//  epokelinja under som bildetekst (v5.91), som innflytelseslinja på
//  artistkortet (js/pres-artist.js, samme mønster).
//  Seksjonene flyttes i DOM-en når kortet vises på lerretet, og på nytt ved
//  hver omtegning: showSjangerInfo bygger kroppen fra bunnen.
//
//  Knapperaden (Artister, Spilleliste, Tidslinje) er ingen seksjon og blir
//  stående under spaltene: lerretet settes inn der den første seksjonen sto.
//  Undersjanger- og koblingskortet i samme modal har ingen seksjoner og
//  røres ikke. Hvilken spalte hver seksjon hører til, avgjør
//  sjangerPlassering i presentasjon-modell.js (testet).
//
//  Egen modul uten Firebase-avhengigheter, som pres-artist.js. Kalles fra
//  presentasjon.js (brukNivaaPaa) og er inert ellers.
// ============================================================================

import { sjangerPlassering } from "./presentasjon-modell.js?v=5.97";

// Bygger spaltene. Idempotent: står oppsettet alt, gjøres ingenting — modalens
// observatør kaller oss igjen etter våre egne flyttinger.
export function ordneSjangerLerret(modal) {
  if (!modal || modal.querySelector(".pres-sjanger")) return;
  const forste = modal.querySelector("[data-sekt]");
  const kropp = forste?.parentElement;
  if (!kropp) return;
  const lag = (tag, klasse) => Object.assign(document.createElement(tag), { className: klasse });
  const lerret = lag("div", "pres-sjanger");
  const spalter = lag("div", "pres-sjanger-spalter");
  const venstre = lag("div", "pres-sjanger-venstre");
  const hoyre = lag("div", "pres-sjanger-hoyre");
  kropp.insertBefore(lerret, forste);
  // querySelectorAll er en statisk liste, så flyttingen underveis er trygg.
  for (const s of kropp.querySelectorAll(":scope > [data-sekt]")) {
    const plass = sjangerPlassering(s.dataset.sekt);
    if (plass === "topp") lerret.appendChild(s);
    else if (plass === "hoyre") hoyre.appendChild(s);
    else venstre.appendChild(s);
  }
  spalter.append(venstre, hoyre);
  lerret.appendChild(spalter);
}
