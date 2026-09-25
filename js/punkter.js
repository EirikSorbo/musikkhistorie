// ============================================================================
//  OPPSUMMERINGSPUNKTER (v5.50) — 3–5 korte punkter per beskrivelse
// ----------------------------------------------------------------------------
//  Brukerens bestilling 2026-09-24: artistkortet, sjangerkortet (tre-sjangrene,
//  main-nivået) og teknologikortet får et eget felt `punkter` (en liste med
//  korte tekster) som oppsummerer beskrivelsen. Vises i presentasjonen på
//  nivå 2, der det ERSTATTER beskrivelsen; nivå 3 viser hele beskrivelsen uten
//  punktene (js/presentasjon-modell.js, erSynlig). Utenfor presentasjonen er
//  punktene skjult inntil videre (js/feature-flags.js).
//
//  Bare læreren skriver feltet: det står utenfor ARTIST_FIELDS, som styrer hva
//  studentene kan foreslå, så Firestore-reglene er uendret.
//
//  Ren modul (ingen DOM, ingen Firebase; flagg-importen rører bare <html> i
//  nettleseren), så normaliseringen er enhetstestbar
//  og delt av editorene, normaliseringen av artister og sjangeroppslaget.
// ============================================================================

import { renderInline } from "./rich-text.js?v=5.55";
// Bryteren som skjuler punktene utenfor presentasjonen setter en klasse på
// <html> når modulen lastes. Importen her sørger for at den er lastet på HVER
// side som kan tegne punkter, også sider som ellers ikke bruker flaggene.
import "./feature-flags.js?v=5.55";

// Anbefalt antall (brukerens «3–5 punkter»). Editoren varsler utenfor
// spennet, men lagrer likevel: et kort under arbeid kan ha to.
export const PUNKT_ANBEFALT = { min: 3, maks: 5 };
// Harde tak: flere enn seks er ikke en oppsummering, og et punkt over 200
// tegn er ikke kort. Det som går over, kuttes ved lagring (og varsles før).
export const PUNKT_MAKS_ANTALL = 6;
export const PUNKT_MAKS_TEGN = 200;

// Punkttegn læreren kan ha limt inn foran teksten («- », «• », «* », «1. »).
const PUNKTTEGN = /^\s*(?:[-–•*·]|\d{1,2}[.)])\s+/;

// Vasker en liste fra data (Firestore, import): bare tekster, trimmet, uten
// tomme, høyst PUNKT_MAKS_ANTALL, hver høyst PUNKT_MAKS_TEGN tegn. Alt annet
// (en streng, et map, null) gir tom liste.
export function normaliserPunkter(raa) {
  if (!Array.isArray(raa)) return [];
  return raa
    .filter((p) => typeof p === "string")
    .map((p) => p.replace(PUNKTTEGN, "").trim())
    .filter(Boolean)
    .slice(0, PUNKT_MAKS_ANTALL)
    .map((p) => p.slice(0, PUNKT_MAKS_TEGN));
}

// Tekstfeltet i editorene: én linje per punkt.
export function lesPunkter(tekst) {
  return normaliserPunkter(String(tekst ?? "").split("\n"));
}

export function punkterTilTekst(liste) {
  return normaliserPunkter(liste).join("\n");
}

// Varsel under tekstfeltet mens læreren skriver, eller null når alt er i
// orden (tomt er også i orden: feltet er valgfritt).
export function punktVarsel(tekst) {
  const linjer = String(tekst ?? "").split("\n").map((l) => l.replace(PUNKTTEGN, "").trim()).filter(Boolean);
  if (!linjer.length) return null;
  const deler = [];
  if (linjer.length > PUNKT_MAKS_ANTALL) {
    deler.push(`${linjer.length} punkter: bare de første ${PUNKT_MAKS_ANTALL} lagres.`);
  } else if (linjer.length < PUNKT_ANBEFALT.min || linjer.length > PUNKT_ANBEFALT.maks) {
    deler.push(`${linjer.length} ${linjer.length === 1 ? "punkt" : "punkter"}. ${PUNKT_ANBEFALT.min}–${PUNKT_ANBEFALT.maks} anbefales.`);
  }
  const lange = linjer.filter((l) => l.length > PUNKT_MAKS_TEGN).length;
  if (lange) deler.push(`${lange === 1 ? "Ett punkt er" : `${lange} punkter er`} over ${PUNKT_MAKS_TEGN} tegn og blir kortet ned.`);
  return deler.length ? deler.join(" ") : null;
}

// Punktlista som HTML. Samme inline-formatering som beskrivelsene (kursiv,
// fet, «»-titler, lenker til artister og sjangre via lc); renderInline
// escaper teksten. Tom liste gir tom streng, så sekt() utelater seksjonen.
export function punkterHtml(liste, lc = {}) {
  const punkter = normaliserPunkter(liste);
  if (!punkter.length) return "";
  return `<ul class="punkter">${punkter.map((p) => `<li>${renderInline(p, lc)}</li>`).join("")}</ul>`;
}
