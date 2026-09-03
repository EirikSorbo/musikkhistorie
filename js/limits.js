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

import { resolveSpan } from "./timeline-lanes.js?v=5.10";

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
  "Produksjon": ["Produksjon"],
  "Låtskriving": ["Låtskriving"],
  // Ensembler, bandledere og produsenter uten ett bestemt instrument. Har
  // bevisst INGEN nyvinnings-tidslinje — det finnes ikke instrumentnyvinninger
  // for «et band».
  "Annet": ["Annet"],
};

// Overskriften over hvert instrumentsammendrag. Skrives ut i sin helhet fordi
// norsk genitiv ikke lar seg utlede mekanisk — «Vokalens», «Tangentenes» og
// «Trommenes» følger tre ulike mønstre.
export const INSTRUMENT_TITLE = {
  "Vokal": "Vokalens utvikling",
  "Gitar": "Gitarens utvikling",
  "Tangenter": "Tangentenes utvikling",
  "Bass": "Bassens utvikling",
  "Trommer": "Trommenes utvikling",
  "Soloinstrument": "Soloinstrumentenes utvikling",
  "Produksjon": "Produksjonens utvikling",
  "Låtskriving": "Låtskrivingens utvikling",
};

// Rekkefølgen gruppene VISES i (brukervalg 2026-09-01): rytmeseksjonen først,
// så de melodiførende, og til slutt de som ikke er ett fysisk instrument.
//
// Skilt fra INSTRUMENT_GROUPS, som er VOKABULARET: artistskjemaets nedtrekk
// leser INSTRUMENTS rett fra gruppene, og det skal ikke stokkes om av et rent
// visningsvalg. Rekkefølgen her styrer knappene i Instrumenter-kortet og
// instrument-nedtrekket på innovasjonskortene, altså der gruppene selv vises.
//
// En gruppe som IKKE står her havner sist i stedet for å forsvinne — lista er
// en prioritering, ikke en hviteliste.
const INSTRUMENT_REKKEFOLGE = [
  "Trommer", "Bass", "Tangenter", "Gitar", "Vokal",
  "Soloinstrument", "Låtskriving", "Produksjon",
];

// Gruppene som får egen nyvinnings-tidslinje i Instrumenter-seksjonen.
// «Annet» er utelatt (se over) — alt annet følger med automatisk når en ny
// gruppe legges inn over.
export const INSTRUMENT_TIMELINE_GROUPS = Object.keys(INSTRUMENT_GROUPS)
  .filter((g) => g !== "Annet")
  .sort((a, b) => instrumentRang(a) - instrumentRang(b));

// Uplassert gruppe får en rang bakenfor alle andre. Likt tall gir 0, og
// Array.sort er stabil, så de beholder rekkefølgen fra INSTRUMENT_GROUPS.
function instrumentRang(group) {
  const i = INSTRUMENT_REKKEFOLGE.indexOf(group);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

// Flat liste over lovlige artistverdier — utledet, så gruppene er ÉN kilde.
// Brukt av forslagsskjema, lærerredigering, filtre og import-valideringen.
export const INSTRUMENTS = Object.values(INSTRUMENT_GROUPS).flat();

// Instrumentene som FAKTISK er i bruk, i vokabularets rekkefølge. Et filtervalg
// eller en statistikkboble som garantert gir null treff er bare støy, så
// filtrene og oversiktens instrumentbobler leser denne i stedet for hele
// vokabularet. Skjemaene der man SETTER instrument på en artist bruker fortsatt
// INSTRUMENTS: uten Banjo i lista kunne ingen noensinne lagt inn den første
// banjospilleren, og instrumentet ville vært låst ute for alltid.
// `behold` sikrer at et aktivt filtervalg blir stående i nedtrekket selv om
// siste artist med instrumentet fjernes — ellers spriker nedtrekket og filteret.
export function instrumentsInUse(artists, behold = "") {
  const brukt = new Set(activeArtists(artists || []).map((a) => a.instrument).filter(Boolean));
  const liste = INSTRUMENTS.filter((i) => brukt.has(i));
  if (behold && !liste.includes(behold)) liste.push(behold);
  return liste;
}

// (instrumentGroup/INSTRUMENT_TO_GROUP er fjernet: ingen runtime-kode mappet
// noensinne et presist instrument til gruppe — tech-kortene lagrer GRUPPE-
// navnet direkte, og artistkortet beholder det presise instrumentet.)

// Dokument-ID for instrumentgruppens sammendrag i `content`-samlingen — samme
// sted som Om historie og Røtter. Utledet, men rensket: Firestore-ID-er tåler
// ikke skråstrek («Trommer/perkusjon» er en artistverdi, ikke et gruppenavn, så
// gruppene er trygge i dag — men rensingen står her så en fremtidig gruppe med
// skråstrek eller æøå ikke kan lage et ulovlig dokumentnavn i stillhet).
export function instrumentPageId(group) {
  const slug = String(group || "")
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `instrument-${slug}`;
}

// Tiårene appen dekker — strukturakse for histogram, filtre, tiårs-
// beskrivelser og Skrivebordet. Utvides her når 2030-tallet melder seg.
export const DECADES = [
  1900, 1910, 1920, 1930, 1940, 1950,
  1960, 1970, 1980, 1990, 2000, 2010, 2020,
];

// Tiårene som nedtrekk (teknologikortenes `decade`-felt). VERDIEN må være
// STRENGEN «1950», ikke tallet: buildTechTimeline filtrerer med
// `t.decade === String(decadeId)`, og et tall ville falt ut av den
// sammenligningen og tømt tiårets tidslinje uten feilmelding.
export const DECADE_OPTIONS = DECADES.map((d) => ({ value: String(d), label: `${d}-tallet` }));

// Kjønnskategorier brukt i skjema og statistikk. Etikettene er det eneste
// brukeren ser (GENDER_LABEL i ui-helpers utleder alt fra denne lista) —
// VERDIENE ligger fast i Firestore og kan ikke endres uten en migrering.
// Derfor heter siste kategori fortsatt «ukjent» i data, men «Annet» i
// skjemaet (v4.95); verdien «annet» var allerede opptatt av «Gruppe».
export const GENDERS = [
  { value: "kvinne", label: "Kvinne" },
  { value: "mann", label: "Mann" },
  { value: "annet", label: "Gruppe" },
  { value: "ukjent", label: "Annet" },
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

// Regner ut hvilke tiår et ÅRSSPENN dekker. Ren primitiv: begge endene må være
// avklart av kalleren. Bruk decadesForArtist under for artister — den vet hva
// en manglende sluttdato betyr.
export function decadesForRange(startYear, endYear) {
  if (!startYear) return [];
  const end = endYear || startYear;
  const first = Math.floor(startYear / 10) * 10;
  const last = Math.floor(end / 10) * 10;
  const result = [];
  for (let d = first; d <= last; d += 10) result.push(d);
  return result;
}

// Tiårene EN ARTIST teller i. Tom influenceEnd betyr «pågår» — artisten regnes
// da fra influenceStart og HELT FRAM TIL I DAG, ikke bare i startåret sitt
// (v3.95). Før falt decadesForRange tilbake på `end = startYear`, så en artist
// uten sluttår forsvant ut av alle senere tiår: Beyoncé (fra 1997) og Kendrick
// Lamar (fra 2012) fantes ikke i 2020-tallsfiltrene, tellingene, kartet eller
// dashbordet — nettopp de tiårene de definerer.
//
// Spennet kommer fra resolveSpan, SAMME kilde som artistenes tidslinje bruker.
// Det er hele poenget med å gå via den: tidslinjen og tiårsfiltrene kan ikke
// lenger svare ulikt på «når var denne artisten aktiv». Det gir også dødsåret
// som tak på kjøpet — en avdød artist uten influenceEnd løper til dødsåret, ikke
// til i dag. (Ingen i pensumet har den kombinasjonen nå, men regelen bør stå.)
export function decadesForArtist(artist, nowYear = new Date().getFullYear()) {
  const span = resolveSpan(artist, nowYear);
  return span ? decadesForRange(span.start, span.end) : [];
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
    // Kun tre-taggene — metasjangeren har sitt eget filter rett under, så det
    // å blande dem inn her gjorde Sjanger-nedtrekket til et duplikat av
    // Metasjanger for de seks navnene som finnes på begge nivåer.
    list = list.filter((a) => (a.mainGenre || []).some((s) => s.toLowerCase() === sj)
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
    list = list.filter((a) => decadesForArtist(a).includes(d));
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
    for (const d of decadesForArtist(a)) {
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

// Tak for instrumentsammendraget (content/instrument-<slug>.body). Satt av
// brukeren 2026-09-01: sammendraget skal være et sammendrag, ikke en oppgave.
// Håndheves i BEGGE skjemaene (lærerens innholdseditor og studentenes
// forslagsskjema) med maxlength + synlig teller. firestore.rules har fortsatt
// et løsere tak på 20 000 for `body`; det er misbruksgrensen, ikke skriveregelen.
export const SAMMENDRAG_MAKS = 4000;
