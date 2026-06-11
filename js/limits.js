// ============================================================================
//  GRENSER OG KONFIGURASJON
// ----------------------------------------------------------------------------
//  Standardverdier for pensum-grensene. Alle kan endres av lærer i appen
//  (lagres i Firestore), men dette er utgangspunktet hvis databasen er tom.
// ============================================================================

export const DEFAULT_CONFIG = {
  // Maks antall aktive forslag totalt i pensum
  maxTotal: 80,

  // Maks antall aktive forslag per tiår
  maxPerDecade: 8,

  // Maks antall aktive forslag per sjanger
  maxPerGenre: 16,

  // Hvor mange "ikke relevant"-stemmer som skal til før et forslag fjernes
  voteOutThreshold: 8,

  // Sjangerkategorier (utgangspunkt — kan endres av lærer)
  genres: [
    "Blues",
    "Country",
    "Jazz",
    "Afroamerikansk populærmusikk",
    "Elektronisk musikk",
  ],

  // Tiår som dekkes av kurset (fra ca. 1900)
  decades: [
    1900, 1910, 1920, 1930, 1940, 1950,
    1960, 1970, 1980, 1990, 2000, 2010, 2020,
  ],
};

// Kjønnskategorier brukt i skjema og statistikk
export const GENDERS = [
  { value: "kvinne", label: "Kvinne" },
  { value: "mann", label: "Mann" },
  { value: "annet", label: "Annet / ikke-binær" },
  { value: "ukjent", label: "Ukjent / kollektiv" },
];

// ----------------------------------------------------------------------------
//  TELLING OG GRENSESJEKK
// ----------------------------------------------------------------------------

// Bare aktive forslag teller mot grensene. Utstemte/fjernede frigjør plass.
export function activeArtists(artists) {
  return artists.filter((a) => a.status === "active");
}

function countBy(list, key) {
  const map = {};
  for (const item of list) {
    const k = item[key];
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

// Returnerer en oversikt over hvor fullt pensum er
export function computeCounts(artists) {
  const active = activeArtists(artists);
  return {
    total: active.length,
    perDecade: countBy(active, "decade"),
    perGenre: countBy(active, "genre"),
  };
}

// Sjekker om et nytt forslag får plass innenfor grensene.
// Returnerer { ok: boolean, reasons: string[] }
export function checkCanAdd(artists, config, candidate) {
  const counts = computeCounts(artists);
  const reasons = [];

  if (counts.total >= config.maxTotal) {
    reasons.push(
      `Pensum er fullt (${counts.total}/${config.maxTotal} totalt).`
    );
  }

  const decadeCount = counts.perDecade[candidate.decade] || 0;
  if (decadeCount >= config.maxPerDecade) {
    reasons.push(
      `Tiåret ${candidate.decade}-tallet er fullt ` +
        `(${decadeCount}/${config.maxPerDecade}).`
    );
  }

  const genreCount = counts.perGenre[candidate.genre] || 0;
  if (genreCount >= config.maxPerGenre) {
    reasons.push(
      `Sjangeren «${candidate.genre}» er full ` +
        `(${genreCount}/${config.maxPerGenre}).`
    );
  }

  return { ok: reasons.length === 0, reasons };
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

// Utleder tiåret et fødselsår tilhører (hjelpefunksjon for forslag)
export function decadeFromYear(year) {
  if (!year) return null;
  return Math.floor(year / 10) * 10;
}
