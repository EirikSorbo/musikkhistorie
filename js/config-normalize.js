// ============================================================================
//  CONFIG-NORMALISERING — ren datalogikk, uten Firebase-avhengigheter
// ----------------------------------------------------------------------------
//  Skilt ut fra store.js så logikken kan enhetstestes i Node (store.js
//  importerer Firebase fra CDN og kan ikke lastes utenfor nettleser).
//  Re-eksporteres fra store.js, så eksisterende importer fortsatt virker.
//
//  Config-en er slanket (v3.20) til kun instrument-vokabularet. Eldre
//  Firestore-dokumenter/backuper bærer fortsatt grense- og listefelter fra
//  forslagsfasen (maxTotal, decades, metaGenres …) — de IGNORERES her, så de
//  aldri når state, og vaskes ut av dokumentet ved neste innstillings-lagring
//  (updateConfig skriver hele objektet).
// ============================================================================

export function normalizeConfig(d) {
  const instruments = Array.isArray(d?.instruments)
    ? d.instruments.map((i) => String(i).trim()).filter(Boolean)
    : [];
  return instruments.length ? { instruments } : {};
}
