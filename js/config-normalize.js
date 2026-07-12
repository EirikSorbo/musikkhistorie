// ============================================================================
//  CONFIG-NORMALISERING — ren datalogikk, uten Firebase-avhengigheter
// ----------------------------------------------------------------------------
//  Skilt ut fra store.js så logikken kan enhetstestes i Node (store.js
//  importerer Firebase fra CDN og kan ikke lastes utenfor nettleser).
//  Re-eksporteres fra store.js, så eksisterende importer fortsatt virker.
// ============================================================================

import { GENEALOGY_META_GENRES } from "./genealogy.js?v=3.2";
import { META_RENAME } from "./artist-normalize.js?v=3.2";

// Bakoverkompat for config: gamle nøkler → nye (genres→metaGenres osv.).
export function normalizeConfig(d) {
  const c = { ...d };
  if (c.metaGenres == null && c.genres != null) c.metaGenres = c.genres;
  if (c.metaGenreLimits == null && c.genreLimits != null) c.metaGenreLimits = c.genreLimits;
  if (c.maxPerMetaGenre == null && c.maxPerGenre != null) c.maxPerMetaGenre = c.maxPerGenre;
  delete c.genres; delete c.genreLimits; delete c.maxPerGenre;
  // Treet er sannhetskilde: metasjangre derfra skal alltid være med, selv om
  // læreren har lagret en egen liste. Lærertillegg beholdes, treets vinner.
  // Lagrede navn migreres gjennom META_RENAME, så omdøpte metasjangre ikke
  // henger igjen fra eldre config.
  const saved = (Array.isArray(c.metaGenres) ? c.metaGenres : [])
    .map((m) => META_RENAME[m] || m);
  c.metaGenres = [...new Set([...GENEALOGY_META_GENRES, ...saved])];
  return c;
}
