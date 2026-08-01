// ============================================================================
//  KONFIGURASJON, VOKABULAR OG TELLING
// ----------------------------------------------------------------------------
//  Config-en er slanket til det som faktisk er en lærer-innstilling
//  (instrument-vokabularet). Metasjangre utledes alltid fra slektstreet
//  (GENEALOGY_META_GENRES) og tiårene fra DECADES-konstanten — de er
//  strukturakser i appen, ikke innstillinger. Grense-apparatet (maks totalt /
//  per tiår / per sjanger / per instrument + checkWarnings) er fjernet (v3.20):
//  det hørte til den opprinnelige forslagsfasen med spredningspress, og hadde
//  til slutt ingen reell funksjon i den kuraterte pensum-appen.
// ============================================================================

// ----------------------------------------------------------------------------
//  INSTRUMENT-VOKABULARET — to nivåer, som sjangertreet
// ----------------------------------------------------------------------------
//  Fast liste i kode, som DECADES og sjangertreet (v3.68: erstattet config-
//  dokumentet i Firestore, det siste som lå der). Artister med verdier utenfor
//  lista flagges i Oversikten og ved import, så lista og dataene ikke kan drive
//  fra hverandre slik config-tekstfeltet tillot (Saxofon/Saksofon...).
//
//  v3.78 innførte GRUPPENIVÅET (samme form som metaGenre over mainGenre):
//   - Artistkortet beholder det PRESISE instrumentet — «Trompet», «Klarinett».
//   - Gruppen samler dem — Trompet, Saksofon og Klarinett er «Soloinstrument».
//  Instrument-tidslinjene ligger på GRUPPEN; artistvisningen er uendret presis.
//  Nøklene her er gruppenavnene, verdiene er det som kan stå på en artist.
//  Grupper med bare seg selv (Vokal, Bass …) er helt vanlige — de har bare
//  ingen underinndeling.
export const INSTRUMENT_GROUPS = {
  "Vokal": ["Vokal"],
  "Gitar": ["Gitar", "Banjo"],
  "Tangenter": ["Tangenter"],
  "Bass": ["Bass"],
  "Trommer": ["Trommer/perkusjon"],
  "Soloinstrument": [
    "Saksofon", "Trompet", "Strykeinstrumenter",
    "Klarinett", "Trombone", "Munnspill", "Mandolin",
  ],
  "Elektronisk produksjon": ["Elektronisk produksjon"],
  "Låtskriving": ["Låtskriving"],
  // Ensembler, bandledere og produsenter uten ett bestemt instrument. Har
  // bevisst INGEN nyvinnings-tidslinje — det finnes ikke instrumentnyvinninger
  // for «et band».
  "Annet": ["Annet"],
};

// Gruppene som får egen nyvinnings-tidslinje i Instrumenter-seksjonen.
// «Annet» er utelatt (se over) — alt annet følger med automatisk når en ny
// gruppe legges inn over.
export const INSTRUMENT_TIMELINE_GROUPS =
  Object.keys(INSTRUMENT_GROUPS).filter((g) => g !== "Annet");

// Flat liste over lovlige artistverdier — utledet, så gruppene er ÉN kilde.
// Brukt av forslagsskjema, lærerredigering, filtre og import-valideringen.
export const INSTRUMENTS = Object.values(INSTRUMENT_GROUPS).flat();

// Presist instrument → gruppe. Ukjente verdier gir null (og flagges allerede
// som «utenfor vokabularet» i Oversikten).
const INSTRUMENT_TO_GROUP = Object.fromEntries(
  Object.entries(INSTRUMENT_GROUPS).flatMap(([group, list]) => list.map((i) => [i, group]))
);

export function instrumentGroup(instrument) {
  return INSTRUMENT_TO_GROUP[instrument] || null;
}

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
//  TELLING OG STATISTIKK
// ----------------------------------------------------------------------------

// Synlig for studenter: aktiv status og ikke lærer-skjult (priority -1).
// Delt predikat — brukes av alle student-visninger og tellinger.
export function isVisible(a) {
  return a.status === "active" && (a.priority || 0) !== -1;
}

// Bare aktive, synlige forslag teller i statistikken. Skjulte utelates.
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
// Er noe innholdsfilter aktivt? (søk/sjanger/meta/instrument/tiår/undersjanger/
// prioritet). Delt av landing (spotlight vs. kompakt liste) og ui.renderArtists
// (sortert vs. tilfeldig rekkefølge), så de to flatene aldri driver fra
// hverandre om hva «filtrert» betyr — landing utelot før prioritet og
// undersjanger, som ga inkonsistent visning ved prioritet-bare-filter.
export function hasActiveFilters(f = {}) {
  return !!(f.search || f.mainGenre || f.metaGenre || f.instrument || f.decade || f.subgenre || f.priority);
}

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
