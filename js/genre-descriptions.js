// ============================================================================
//  SJANGERBESKRIVELSER — oppslag per nivå (INGEN innebygde defaults)
// ----------------------------------------------------------------------------
//  Beskrivelser kommer KUN fra data (Firestore-«subgenres» / import-JSON), per
//  nivå: doc = sjangernavn, med valgfrie felt meta/main/sub = { description,
//  kilder }. Eldre flat { description, kilder } leses som delt fallback.
//  Det finnes BEVISST ingen seed/standardtekst — mangler en beskrivelse, skal
//  det vises en tydelig feilmelding (missingDesc), ikke en fallback som skjuler
//  at sjangeren ikke er synkronisert. Nivå: meta (metasjanger), main (tre-
//  sjanger), sub (fri undersjanger).
// ============================================================================

const LVL = { meta: "metasjanger", main: "sjanger", sub: "undersjanger" };

// Tydelig melding når ingen beskrivelse er lagt inn på gjeldende nivå.
export function missingDesc(level) {
  return `⚠️ Ingen beskrivelse lagt inn ennå (${LVL[level] || level})`;
}

function fromOverride(o, level) {
  if (!o) return null;
  if (o[level] && o[level].description) return { description: o[level].description, kilder: o[level].kilder || [] };
  if (o.description) return { description: o.description, kilder: o.kilder || [] }; // eldre flat (delt)
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
