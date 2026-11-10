// ============================================================================
//  SENTRALE LYTTEEKSEMPLER FOR SJANGEREN (v7.28, brukerønske 2026-11-10)
// ----------------------------------------------------------------------------
//  Et lytteeksempel har tre nivåer: kontekst, sentral for artisten
//  (`sentral: true`, v7.05) og sentral for sjangeren (`sjangersentral: true`).
//  De to merkene er uavhengige, så et eksempel kan ha begge. Uten noen av dem
//  er eksempelet kontekst.
//
//  Låste valg:
//   - Merket står på lytteeksempelet, ikke i en liste på sjangeren. Eksemplene
//     har ingen ID, så en liste ville brytes når tittel eller lenke endres.
//   - Sjangeren er eksempelets egen (`genre`, sjangeren i raden, som styrer
//     spillelistene). Får eksempelet en annen sjanger, følger merket med dit.
//   - Sjangerkortet viser dem sortert etter årstall, så tittel og artist.
//   - Bare synlige artister (isVisible), som spillelistene og artistlista på
//     kortet. Viktighetsnivået gjelder ikke: lista er allerede et utvalg.
//   - Lagres som true, aldri som false (fraværende = ikke sentral for
//     sjangeren), som `sentral`.
//  Ren modul uten DOM, testet i Node.
// ============================================================================
import { isVisible } from "../felles/limits.js";
import { safeUrl } from "../felles/util.js";

export const erSjangerSentral = (m) => !!m && m.sjangersentral === true;

const aarFor = (m) => Number(m?.year || m?.performanceYear) || null;

// Alle lytteeksemplene med denne sjangeren i raden, fra synlige artister, med
// lenke. [{ a, m }] sortert etter år (uten år sist), tittel og artist.
export function sjangerEksempler(artists, label) {
  const sj = String(label || "").trim().toLowerCase();
  if (!sj) return [];
  const par = [];
  for (const a of artists || []) {
    if (!a || !isVisible(a)) continue;
    for (const m of a.musicExamples || []) {
      if (!m || String(m.genre || "").trim().toLowerCase() !== sj || !safeUrl(m.url)) continue;
      par.push({ a, m });
    }
  }
  return par.sort((x, y) => {
    const ax = aarFor(x.m), ay = aarFor(y.m);
    if (ax !== ay) return ax == null ? 1 : ay == null ? -1 : ax - ay;
    return String(x.m.label || "").localeCompare(String(y.m.label || ""), "nb")
      || String(x.a.name || "").localeCompare(String(y.a.name || ""), "nb");
  });
}

// De som er merket sentrale for sjangeren, i samme rekkefølge.
export function sjangerSentrale(artists, label) {
  return sjangerEksempler(artists, label).filter(({ m }) => erSjangerSentral(m));
}

// Eksempelet kjennes igjen på artist, lenke og tittel (det finnes ingen ID).
export const eksempelNokkel = (artistId, m) =>
  `${artistId}|${String(m?.url || "").trim()}|${String(m?.label || "").trim()}`;

// Valgene fra «Velg sentrale» som skrivinger: { artistId: musicExamples } for
// hver artist der minst ett merke endres. `vist` er nøklene som sto i lista,
// `valgt` de av dem som skal være sentrale. Bare viste eksempler med denne
// sjangeren røres (et merke på en skjult artist står), og resten av
// eksempelet står urørt.
export function sentraleEndringer(artists, label, valgt, vist) {
  const sj = String(label || "").trim().toLowerCase();
  const ut = {};
  for (const a of artists || []) {
    const liste = Array.isArray(a?.musicExamples) ? a.musicExamples : [];
    let endret = false;
    const ny = liste.map((m) => {
      if (!m || String(m.genre || "").trim().toLowerCase() !== sj) return m;
      const nokkel = eksempelNokkel(a.id, m);
      if (!vist.has(nokkel)) return m;
      const skal = valgt.has(nokkel);
      if (skal === erSjangerSentral(m)) return m;
      endret = true;
      const kopi = { ...m };
      if (skal) kopi.sjangersentral = true;
      else delete kopi.sjangersentral;
      return kopi;
    });
    if (endret) ut[a.id] = ny;
  }
  return ut;
}
