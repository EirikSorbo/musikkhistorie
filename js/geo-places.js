// ============================================================================
//  STEDSTABELL — kobler artistenes geography-tekst til kartposisjoner
// ----------------------------------------------------------------------------
//  Nøklene er små bokstaver av de atomære stedsdelene slik de faktisk står i
//  dataene (geography splittes på «;» — hver del slås opp her). Tre typer:
//    { label, lat, lng }             by på kartet (storbyområder samles: alle
//                                    NYC-bydeler → «New York», Compton → «Los
//                                    Angeles» osv. — scenen er poenget)
//    { label, lat, lng, region: true }  diffust område (delstat/region) —
//                                    tegnes som stiplet ring, ikke fylt prikk
//    { label, abroad: "Land" }       utenfor kartutsnittet → chip-lista
//  Ukjente steder rapporteres ærlig som «ikke plassert» + konsollvarsel —
//  legg dem til her når nye steder dukker opp i dataene.
//  Avhengighetsfri (kun limits.js for tiårsberegning) → enhetstestbar.
// ============================================================================

import { decadesForRange } from "./limits.js?v=3.40";

export const PLACES = {
  // --- New York-området ---
  "new york":                { label: "New York", lat: 40.71, lng: -74.01 },
  "queens, new york":        { label: "New York", lat: 40.71, lng: -74.01 },
  "bronx, new york":         { label: "New York", lat: 40.71, lng: -74.01 },
  "brooklyn, new york":      { label: "New York", lat: 40.71, lng: -74.01 },
  "staten island, new york": { label: "New York", lat: 40.71, lng: -74.01 },
  "long island, new york":   { label: "New York", lat: 40.71, lng: -74.01 },
  "newark, new jersey":      { label: "New York", lat: 40.71, lng: -74.01 },
  "englewood, new jersey":   { label: "New York", lat: 40.71, lng: -74.01 },
  "south orange, new jersey": { label: "New York", lat: 40.71, lng: -74.01 },

  // --- Los Angeles-området ---
  "los angeles":             { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "los angeles, california": { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "hollywood, california":   { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "compton, california":     { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "inglewood, california":   { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "long beach, california":  { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "oakland/los angeles, california": { label: "Los Angeles", lat: 34.05, lng: -118.24 },

  // --- Øvrige byer, USA ---
  "chicago":                 { label: "Chicago", lat: 41.88, lng: -87.63 },
  "chicago, illinois":       { label: "Chicago", lat: 41.88, lng: -87.63 },
  "nashville":               { label: "Nashville", lat: 36.16, lng: -86.78 },
  "nashville, tennessee":    { label: "Nashville", lat: 36.16, lng: -86.78 },
  "new orleans":             { label: "New Orleans", lat: 29.95, lng: -90.07 },
  "new orleans, louisiana":  { label: "New Orleans", lat: 29.95, lng: -90.07 },
  "memphis, tennessee":      { label: "Memphis", lat: 35.15, lng: -90.05 },
  "detroit, michigan":       { label: "Detroit", lat: 42.33, lng: -83.05 },
  "houston, texas":          { label: "Houston", lat: 29.76, lng: -95.36 },
  "dallas, texas":           { label: "Dallas", lat: 32.78, lng: -96.80 },
  "fort worth, texas":       { label: "Fort Worth", lat: 32.76, lng: -97.33 },
  "austin, texas":           { label: "Austin", lat: 30.27, lng: -97.74 },
  "san francisco, california": { label: "San Francisco", lat: 37.77, lng: -122.42 },
  "oakland, california":     { label: "San Francisco", lat: 37.77, lng: -122.42 },
  "seattle, washington":     { label: "Seattle", lat: 47.61, lng: -122.33 },
  "portland, oregon":        { label: "Portland", lat: 45.52, lng: -122.68 },
  "miami, florida":          { label: "Miami", lat: 25.76, lng: -80.19 },
  "fort lauderdale, florida": { label: "Miami", lat: 25.76, lng: -80.19 },
  "atlanta, georgia":        { label: "Atlanta", lat: 33.75, lng: -84.39 },
  "macon, georgia":          { label: "Macon", lat: 32.84, lng: -83.63 },
  "columbus, georgia":       { label: "Columbus (GA)", lat: 32.46, lng: -84.99 },
  "augusta":                 { label: "Augusta (GA)", lat: 33.47, lng: -81.97 },
  "philadelphia":            { label: "Philadelphia", lat: 39.95, lng: -75.17 },
  "philadelphia, pennsylvania": { label: "Philadelphia", lat: 39.95, lng: -75.17 },
  "camden, new jersey":      { label: "Philadelphia", lat: 39.95, lng: -75.17 },
  "richmond, virginia":      { label: "Richmond", lat: 37.54, lng: -77.44 },
  "virginia beach, virginia": { label: "Virginia Beach", lat: 36.85, lng: -75.98 },
  "kansas city, missouri":   { label: "Kansas City", lat: 39.10, lng: -94.58 },
  "sedalia, missouri":       { label: "Sedalia (MO)", lat: 38.70, lng: -93.23 },
  "chattanooga, tennessee":  { label: "Chattanooga", lat: 35.05, lng: -85.31 },
  "meridian, mississippi":   { label: "Meridian (MS)", lat: 32.36, lng: -88.70 },
  "ferriday, louisiana":     { label: "Ferriday (LA)", lat: 31.63, lng: -91.55 },
  "bakersfield, california": { label: "Bakersfield", lat: 35.37, lng: -119.02 },
  "aspen, colorado":         { label: "Aspen", lat: 39.19, lng: -106.82 },
  "gary, indiana":           { label: "Gary (IN)", lat: 41.60, lng: -87.35 },
  "champaign, illinois":     { label: "Champaign (IL)", lat: 40.12, lng: -88.24 },
  "rochester, new york":     { label: "Rochester (NY)", lat: 43.16, lng: -77.61 },
  "las vegas":               { label: "Las Vegas", lat: 36.17, lng: -115.14 },
  "bristol, virginia/tennessee": { label: "Bristol (VA/TN)", lat: 36.60, lng: -82.19 },

  // --- Canada ---
  "toronto, canada":         { label: "Toronto", lat: 43.65, lng: -79.38 },
  "montreal, canada":        { label: "Montreal", lat: 45.50, lng: -73.57 },
  "burnaby, canada":         { label: "Vancouver", lat: 49.25, lng: -123.00 },
  "windsor, canada":         { label: "Windsor (ON)", lat: 42.32, lng: -83.04 },

  // --- Karibia (på kartet) ---
  "kingston, jamaica":       { label: "Kingston", lat: 17.97, lng: -76.79 },
  "havana, cuba":            { label: "Havana", lat: 23.11, lng: -82.37 },

  // --- Rene bynavn (live-dataene bruker ofte by uten delstat/land) ---
  "aspen":                   { label: "Aspen", lat: 39.19, lng: -106.82 },
  "atlanta":                 { label: "Atlanta", lat: 33.75, lng: -84.39 },
  "austin":                  { label: "Austin", lat: 30.27, lng: -97.74 },
  "bakersfield":             { label: "Bakersfield", lat: 35.37, lng: -119.02 },
  "columbus":                { label: "Columbus (GA)", lat: 32.46, lng: -84.99 },
  "compton":                 { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "dallas":                  { label: "Dallas", lat: 32.78, lng: -96.80 },
  "detroit":                 { label: "Detroit", lat: 42.33, lng: -83.05 },
  "fort lauderdale":         { label: "Miami", lat: 25.76, lng: -80.19 },
  "fort worth":              { label: "Fort Worth", lat: 32.76, lng: -97.33 },
  "havana":                  { label: "Havana", lat: 23.11, lng: -82.37 },
  "houston":                 { label: "Houston", lat: 29.76, lng: -95.36 },
  "kansas city":             { label: "Kansas City", lat: 39.10, lng: -94.58 },
  "kingston":                { label: "Kingston", lat: 17.97, lng: -76.79 },
  "long beach":              { label: "Los Angeles", lat: 34.05, lng: -118.24 },
  "macon":                   { label: "Macon", lat: 32.84, lng: -83.63 },
  "memphis":                 { label: "Memphis", lat: 35.15, lng: -90.05 },
  "miami":                   { label: "Miami", lat: 25.76, lng: -80.19 },
  "montreal":                { label: "Montreal", lat: 45.50, lng: -73.57 },
  "newark":                  { label: "New York", lat: 40.71, lng: -74.01 },
  "oakland":                 { label: "San Francisco", lat: 37.77, lng: -122.42 },
  "san francisco":           { label: "San Francisco", lat: 37.77, lng: -122.42 },
  "seattle":                 { label: "Seattle", lat: 47.61, lng: -122.33 },
  "toronto":                 { label: "Toronto", lat: 43.65, lng: -79.38 },
  "vancouver":               { label: "Vancouver", lat: 49.28, lng: -123.12 },
  "virginia beach":          { label: "Virginia Beach", lat: 36.85, lng: -75.98 },
  // «Bristol» alene er tvetydig i dataene: Carter Family/Jimmie Rodgers/Ralph
  // Peer hører til Bristol sessions (VA/TN), Massive Attack til Bristol,
  // England. Bare-navnet mappes til VA/TN (flertallet + musikkhistorisk
  // tyngde) — England-artister bør presiseres til «Bristol, England» i dataene.
  "bristol":                 { label: "Bristol (VA/TN)", lat: 36.60, lng: -82.19 },

  // --- Nye byer i live-dataene ---
  "clarksdale":              { label: "Clarksdale (MS)", lat: 34.20, lng: -90.57 },
  "lubbock":                 { label: "Lubbock (TX)", lat: 33.58, lng: -101.85 },
  "san antonio":             { label: "San Antonio", lat: 29.42, lng: -98.49 },
  "st. louis":               { label: "St. Louis", lat: 38.63, lng: -90.20 },

  // --- Regioner (diffuse områder — stiplet ring) ---
  "mississippi-deltaet":     { label: "Mississippi-deltaet", lat: 34.20, lng: -90.57, region: true },
  "appalachene":             { label: "Appalachene", lat: 37.00, lng: -81.50, region: true },
  "appalachene, virginia/tennessee": { label: "Appalachene", lat: 37.00, lng: -81.50, region: true },
  "texas":                   { label: "Texas", lat: 31.00, lng: -99.00, region: true },
  "mississippi":             { label: "Mississippi", lat: 32.70, lng: -89.70, region: true },
  "kentucky":                { label: "Kentucky", lat: 37.50, lng: -85.30, region: true },
  "georgia":                 { label: "Georgia", lat: 32.70, lng: -83.40, region: true },
  "oklahoma":                { label: "Oklahoma", lat: 35.50, lng: -97.50, region: true },
  "alabama":                 { label: "Alabama", lat: 32.80, lng: -86.80, region: true },
  "virginia":                { label: "Virginia", lat: 37.50, lng: -78.90, region: true },
  "north carolina":          { label: "North Carolina", lat: 35.60, lng: -79.40, region: true },
  "tennessee":               { label: "Tennessee", lat: 35.86, lng: -86.35, region: true },
  "louisiana":               { label: "Louisiana", lat: 31.00, lng: -92.00, region: true },
  "california":              { label: "California", lat: 36.50, lng: -119.50, region: true },
  "new jersey":              { label: "New Jersey", lat: 40.10, lng: -74.50, region: true },
  "washington state":        { label: "Washington (delstat)", lat: 47.40, lng: -120.50, region: true },
  "canada":                  { label: "Canada", lat: 51.80, lng: -100.00, region: true },

  // --- Utenfor kartet (chips) ---
  "oslo":                    { label: "Oslo", abroad: "Norge" },
  "bergen":                  { label: "Bergen", abroad: "Norge" },
  "london":                  { label: "London", abroad: "England" },
  "manchester":              { label: "Manchester", abroad: "England" },
  "paris":                   { label: "Paris", abroad: "Frankrike" },
  "münchen":                 { label: "München", abroad: "Tyskland" },
  "düsseldorf":              { label: "Düsseldorf", abroad: "Tyskland" },
  "stockholm":               { label: "Stockholm", abroad: "Sverige" },
  "reykjavik":               { label: "Reykjavik", abroad: "Island" },
  "oslo, norge":             { label: "Oslo", abroad: "Norge" },
  "tønsberg/oslo, norge":    { label: "Oslo", abroad: "Norge" },
  "bergen, norge":           { label: "Bergen", abroad: "Norge" },
  "stockholm, sverige":      { label: "Stockholm", abroad: "Sverige" },
  "københavn":               { label: "København", abroad: "Danmark" },
  "reykjavik, island":       { label: "Reykjavik", abroad: "Island" },
  "london, england":         { label: "London", abroad: "England" },
  "bristol, england":        { label: "Bristol", abroad: "England" },
  "manchester, england":     { label: "Manchester", abroad: "England" },
  "essex, england":          { label: "Essex", abroad: "England" },
  "skottland":               { label: "Skottland", abroad: "Skottland" },
  "paris, frankrike":        { label: "Paris", abroad: "Frankrike" },
  "ibiza":                   { label: "Ibiza", abroad: "Spania" },
  "monaco":                  { label: "Monaco", abroad: "Monaco" },
  "münchen, tyskland":       { label: "München", abroad: "Tyskland" },
  "düsseldorf, tyskland":    { label: "Düsseldorf", abroad: "Tyskland" },
  "berlin":                  { label: "Berlin", abroad: "Tyskland" },
  "santiago, chile":         { label: "Santiago", abroad: "Chile" },
};

// Splitter en geography-streng i atomære oppslagsnøkler («A; B» → to steder).
export function parseGeography(str) {
  return String(str || "")
    .split(";")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

// Grupperer artister per sted, valgfritt filtrert til ett tiår. Returnerer
// { onMap, abroad, unplaced } — hver post { label, count, artists, … }.
// En artist telles maks én gang per sted-label, men kan stå på flere steder
// (migrasjon er poenget). Ukjente/tomme steder havner i unplaced.
export function aggregatePlaces(artists, { decade = null } = {}) {
  const onMap = new Map(), abroad = new Map(), unplaced = new Map();
  for (const a of artists) {
    if (decade != null && !decadesForRange(a.influenceStart, a.influenceEnd).includes(decade)) continue;
    const keys = parseGeography(a.geography);
    if (!keys.length) {
      addTo(unplaced, "(ikke angitt)", { label: "(ikke angitt)" }, a);
      continue;
    }
    for (const key of keys) {
      const place = PLACES[key];
      if (!place) { addTo(unplaced, key, { label: key }, a); continue; }
      if (place.abroad) addTo(abroad, place.label, place, a);
      else addTo(onMap, place.label, place, a);
    }
  }
  const toList = (m) => [...m.values()]
    .map(({ seen, ...e }) => ({ ...e, count: e.artists.length }))
    .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label, "no"));
  return { onMap: toList(onMap), abroad: toList(abroad), unplaced: toList(unplaced) };
}

function addTo(map, label, place, artist) {
  if (!map.has(label)) map.set(label, { ...place, artists: [], seen: new Set() });
  const e = map.get(label);
  // Dedup-nøkkel: id når den finnes (Firestore), ellers objektidentitet —
  // seed-/testdata uten id skal ikke kollapse til én artist per sted.
  const key = artist.id ?? artist;
  if (!e.seen.has(key)) { e.seen.add(key); e.artists.push(artist); }
}

// Steder i dataene som ikke finnes i PLACES — for konsollvarsel ved åpning,
// så tabellen kan holdes i synk når nye steder dukker opp.
export function unknownPlaces(artists) {
  const unknown = new Set();
  for (const a of artists) {
    for (const key of parseGeography(a.geography)) {
      if (!PLACES[key] && key !== "udefinert") unknown.add(key);
    }
  }
  return [...unknown].sort();
}
