// ============================================================================
//  KONFIGURASJON, VOKABULAR OG TELLING
// ----------------------------------------------------------------------------
//  Config-en er slanket til det som faktisk er en lærer-innstilling
//  (instrument-vokabularet). Hovedsjangre utledes alltid fra slektstreet
//  (GENEALOGY_META_GENRES) og tiårene fra DECADES-konstanten — de er
//  strukturakser i appen, ikke innstillinger. Grense-apparatet (maks totalt /
//  per tiår / per sjanger / per instrument + checkWarnings) er fjernet (v3.20):
//  det hørte til den opprinnelige forslagsfasen med spredningspress, og hadde
//  til slutt ingen reell funksjon i den kuraterte pensum-appen.
// ============================================================================

export const DEFAULT_CONFIG = {
  instruments: [
    "Vokal",
    "Gitar",
    "Piano/keyboards",
    "Bass",
    "Trommer/perkusjon",
    "Saksofon",
    "Trompet",
    "Strykeinstrumenter",
    "Elektronisk produksjon",
    "Annet",
  ],
};

// Tiårene appen dekker — strukturakse for histogram, filtre, tiårs-
// beskrivelser og Skrivebordet. Utvides her når 2030-tallet melder seg.
export const DECADES = [
  1900, 1910, 1920, 1930, 1940, 1950,
  1960, 1970, 1980, 1990, 2000, 2010, 2020,
];

// Kjønnskategorier brukt i skjema og statistikk
export const GENDERS = [
  { value: "kvinne", label: "Kvinne" },
  { value: "mann", label: "Mann" },
  { value: "annet", label: "Gruppe" },
  { value: "ukjent", label: "Ukjent / kollektiv" },
];

// ----------------------------------------------------------------------------
//  TELLING OG GRENSESJEKK
// ----------------------------------------------------------------------------

// Synlig for studenter: aktiv status og ikke lærer-skjult (priority -1).
// Delt predikat — brukes av alle student-visninger og tellinger.
export function isVisible(a) {
  return a.status === "active" && (a.priority || 0) !== -1;
}

// Bare aktive, synlige forslag teller mot grensene. Skjulte frigjør plass.
export function activeArtists(artists) {
  return artists.filter(isVisible);
}

// Regner ut hvilke tiår en innflytelsesperiode spenner over
export function decadesForRange(startYear, endYear) {
  if (!startYear) return [];
  const end = endYear || startYear;
  const first = Math.floor(startYear / 10) * 10;
  const last = Math.floor(end / 10) * 10;
  const result = [];
  for (let d = first; d <= last; d += 10) result.push(d);
  return result;
}

// Delt innholdsfilter for artistlister (sjanger/meta/instrument/undersjanger/
// prioritet/tiår/søk). Status-/synlighetsfiltrering gjøres av kalleren FØR dette,
// siden student- og lærer-visningen har ulike regler der. Ren funksjon —
// enhetstestbar, og holder filterlogikken ett sted (landing.js + ui.js delte den
// før i to kopier som allerede hadde driftet fra hverandre).
export function filterArtists(list, filters = {}) {
  if (filters.mainGenre) {
    const sj = filters.mainGenre.toLowerCase();
    list = list.filter((a) => a.metaGenre === filters.mainGenre
      || (a.mainGenre || []).some((s) => s.toLowerCase() === sj)
      || (a.subGenre || []).some((s) => s.toLowerCase() === sj));
  }
  if (filters.metaGenre) list = list.filter((a) => a.metaGenre === filters.metaGenre);
  if (filters.instrument) list = list.filter((a) => a.instrument === filters.instrument);
  if (filters.subgenre) {
    const sg = filters.subgenre;
    list = list.filter((a) => (a.subGenre || []).includes(sg) || (a.mainGenre || []).includes(sg));
  }
  if (filters.priority) list = list.filter((a) => (a.priority || 0) === filters.priority);
  if (filters.decade) {
    const d = Number(filters.decade);
    list = list.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(d));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const qn = q.replace(/[.\-]/g, "");
    list = list.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.name.toLowerCase().replace(/[.\-]/g, "").includes(qn) ||
      (a.geography || "").toLowerCase().includes(q) ||
      (a.mainGenre || []).some((s) => s.toLowerCase().includes(q)) ||
      (a.subGenre || []).some((s) => s.toLowerCase().includes(q)));
  }
  return list;
}

function countBy(list, key) {
  const map = {};
  for (const item of list) {
    const k = item[key];
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

// En artist teller i ALLE tiår perioden deres spenner over
function countByDecade(list) {
  const map = {};
  for (const a of list) {
    for (const d of decadesForRange(a.influenceStart, a.influenceEnd)) {
      map[d] = (map[d] || 0) + 1;
    }
  }
  return map;
}

export function computeCounts(artists) {
  const active = activeArtists(artists);
  return {
    total: active.length,
    perDecade: countByDecade(active),
    perMetaGenre: countBy(active, "metaGenre"),
    perInstrument: countBy(active, "instrument"),
  };
}

// Kjønnsfordeling blant aktive forslag — { kvinne: n, mann: n, ... , total }
export function genderDistribution(artists) {
  const active = activeArtists(artists);
  const dist = { kvinne: 0, mann: 0, annet: 0, ukjent: 0 };
  for (const a of active) {
    if (dist[a.gender] !== undefined) dist[a.gender] += 1;
    else dist.ukjent += 1;
  }
  return { ...dist, total: active.length };
}
