// ============================================================================
//  GRENSER OG KONFIGURASJON
// ----------------------------------------------------------------------------
//  Standardverdier for pensum-grensene. Alle kan endres av lærer i appen
//  (lagres i Firestore), men dette er utgangspunktet hvis databasen er tom.
// ============================================================================

import { GENEALOGY_META_GENRES } from "./genealogy.js?v=2.39";

export const DEFAULT_CONFIG = {
  maxTotal: 80,
  maxPerDecade: 8,
  maxPerMetaGenre: 16,
  maxPerInstrument: 20,
  decadeLimits: {},
  metaGenreLimits: {},
  instrumentLimits: {},
  voteOutThreshold: 8,

  // Én sannhetskilde: de brede metasjangrene utledes fra slektstreet.
  // Læreren kan fortsatt overstyre lista i admin (lagres i Firestore).
  metaGenres: [...GENEALOGY_META_GENRES],

  decades: [
    1900, 1910, 1920, 1930, 1940, 1950,
    1960, 1970, 1980, 1990, 2000, 2010, 2020,
  ],

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

// Bare aktive, synlige forslag teller mot grensene. Skjulte/utstemte frigjør plass.
export function activeArtists(artists) {
  return artists.filter((a) => a.status === "active" && (a.priority || 0) !== -1);
}

export function limitForDecade(config, decade) {
  const v = config.decadeLimits?.[decade];
  return Number.isFinite(v) ? v : config.maxPerDecade;
}

export function limitForMetaGenre(config, genre) {
  const v = config.metaGenreLimits?.[genre];
  return Number.isFinite(v) ? v : config.maxPerMetaGenre;
}

export function limitForInstrument(config, instrument) {
  const v = config.instrumentLimits?.[instrument];
  return Number.isFinite(v) ? v : config.maxPerInstrument;
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

// Myk grensesjekk — advarer men blokkerer ikke.
// Returnerer { warnings: string[] }
export function checkWarnings(artists, config, candidate) {
  const counts = computeCounts(artists);
  const warnings = [];

  if (counts.total >= config.maxTotal) {
    warnings.push(
      `Grensen på ${config.maxTotal} totale forslag er nådd (${counts.total} nå).`
    );
  }

  const candidateDecades = decadesForRange(candidate.influenceStart, candidate.influenceEnd);
  for (const d of candidateDecades) {
    const c = counts.perDecade[d] || 0;
    const max = limitForDecade(config, d);
    if (c >= max) {
      warnings.push(`${d}-tallet har nådd grensen (${c}/${max}).`);
    }
  }

  const metaGenreCount = counts.perMetaGenre[candidate.metaGenre] || 0;
  const metaGenreMax = limitForMetaGenre(config, candidate.metaGenre);
  if (metaGenreCount >= metaGenreMax) {
    warnings.push(
      `Sjangeren «${candidate.metaGenre}» har nådd grensen (${metaGenreCount}/${metaGenreMax}).`
    );
  }

  if (candidate.instrument) {
    const instrCount = counts.perInstrument[candidate.instrument] || 0;
    const instrMax = limitForInstrument(config, candidate.instrument);
    if (instrCount >= instrMax) {
      warnings.push(
        `Instrumentet «${candidate.instrument}» har nådd grensen (${instrCount}/${instrMax}).`
      );
    }
  }

  return { warnings };
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

export function decadeFromYear(year) {
  if (!year) return null;
  return Math.floor(year / 10) * 10;
}
