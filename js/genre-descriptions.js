// ============================================================================
//  SJANGERBESKRIVELSER — oppslag per nivå (INGEN innebygde defaults)
// ----------------------------------------------------------------------------
//  Beskrivelser kommer KUN fra data (Firestore-«genreDescriptions» / import-JSON), per
//  nivå: doc = sjangernavn, med valgfrie felt meta/main/sub = { description,
//  kilder }. Det finnes INGEN fallback: hvert nivå leses kun fra sitt eget
//  felt (meta/main/sub). Et eldre flatt { description } brukes IKKE.
//  Det finnes BEVISST ingen seed/standardtekst — mangler en beskrivelse, skal
//  det vises en tydelig feilmelding (missingDesc), ikke en fallback som skjuler
//  at sjangeren ikke er synkronisert. Nivå: meta (metasjanger), main (tre-
//  sjanger), sub (fri undersjanger).
// ============================================================================

const LVL = { meta: "hovedsjanger", main: "sjanger", sub: "undersjanger" };

// Tydelig melding når ingen beskrivelse er lagt inn på gjeldende nivå.
export function missingDesc(level) {
  return `⚠️ Ingen beskrivelse lagt inn ennå (${LVL[level] || level})`;
}

function fromOverride(o, level) {
  if (!o) return null;
  // KUN nivå-spesifikk tekst. Ingen fallback til flat/annet nivå — mangler
  // beskrivelsen på DETTE nivået, skal kalleren vise missingDesc (bevisst valg).
  if (o[level] && o[level].description) return { description: o[level].description, kilder: o[level].kilder || [] };
  return null;
}

// Beskrivelse for (navn, nivå) fra data. Tom { description: "" } hvis ingenting
// finnes — kalleren viser da missingDesc.
export function resolveDesc(overrides, name, level) {
  return fromOverride(overrides && overrides[name], level) || { description: "", kilder: [] };
}

// Som resolveDesc, men over flere navn (f.eks. nodens label OG fulle navn).
export function resolveDescAny(overrides, names, level) {
  for (const n of names) { const r = fromOverride(overrides && overrides[n], level); if (r) return r; }
  return { description: "", kilder: [] };
}
