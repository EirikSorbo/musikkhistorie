// ============================================================================
//  SJANGERHISTORIER OG INNHOLDSSIDER — oppslag
// ----------------------------------------------------------------------------
//  Historiene og innholdssidene (Om historie, Røtter) skrives i samme
//  markdown-light som resten av appens tekster. Selve formateringen bor i
//  js/rich-text.js (renderRichText) — den er delt med beskrivelsene, så
//  historier og beskrivelser aldri får hver sin syntaks. Denne modulen holder
//  bare på STRUKTUREN: hvilke historier som finnes og hvor tekstene hentes fra.
//
//  Det finnes BEVISST ingen standardtekster i koden (brukervalg): innholdet
//  bor i Firestore (importert fra innholds-JSON eller skrevet i editoren), og
//  mangler det, skal appen vise en tydelig «mangler tekst»-melding — aldri en
//  utdatert reservetekst.
// ============================================================================

// Hvilke historier som finnes og rekkefølgen deres (struktur, ikke innhold):
// én per metasjanger med forfattet fortelling. Pop og Rock dekkes gjennom de
// andre og har bevisst ingen egen historie.
//
// Hip-hop står etter R&B fordi den ble skilt ut derfra (v3.88) og fortsatt
// leses best i forlengelsen av soul og funk. Historien er ikke skrevet ennå —
// knappen skal likevel stå: appen viser hull i innholdet i stedet for å skjule
// dem, og lærer-oversikten teller den som en manglende historie.
export const STORY_ORDER = ["Blues", "Country", "Gospel", "Jazz", "R&B", "Hip-hop", "Klubbmusikk"];

// Oppslaget: historien er den lærer-lagrede/importerte teksten på
// genreDescriptions/<sjanger>.story.body — ingen fallback. Mangler den (eller
// er tom), returneres null og visningen skal si tydelig ifra.
export function storyFor(genre, genreDescs = {}) {
  const body = genreDescs?.[genre]?.story?.body;
  return typeof body === "string" && body.trim() ? { body } : null;
}

// Alle seks historiene åpner med en håndskrevet linje av formen
//   *Sjangertre-løype: Work songs → Blues → Chicago blues → …*
// Den er nå erstattet av den genererte sjangertidslinjen (buildGenreTimeline),
// og fjernes her i stedet for i Firestore. Grunnen til at det gjøres i koden:
// teksten ligger i innhold vi ikke skriver til, og en re-import av en eldre
// backup ville ellers dratt linjen inn igjen. Tåler både «løype» og «loype»,
// valgfri kursiv, og at linjen ikke står helt først.
// `[^\n]*` MÅ være grådig: med lat kvantor stoppet den på kolonet og lot resten
// av løypen stå igjen som brødtekst.
const GENRE_PATH_LINE = /^[ \t]*\*?[ \t]*Sjangertre-l[øo]ype[ \t]*:[^\n]*\r?\n?/im;

export function stripGenrePath(text) {
  return typeof text === "string" ? text.replace(GENRE_PATH_LINE, "").replace(/^\s*\n/, "") : text;
}

// Samme oppslag for innholdssidene (content/<id>.body fra Firestore).
export function pageFor(pageId, content = {}) {
  const body = content?.[pageId]?.body;
  return typeof body === "string" && body.trim() ? { body } : null;
}
