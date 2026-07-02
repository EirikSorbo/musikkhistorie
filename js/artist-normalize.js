// ============================================================================
//  ARTIST-NORMALISERING — ren datalogikk, uten Firebase-avhengigheter
// ----------------------------------------------------------------------------
//  Skilt ut fra store.js så logikken kan enhetstestes i Node (store.js
//  importerer Firebase fra CDN og kan ikke lastes utenfor nettleser).
// ============================================================================

import { safeUrl } from "./util.js?v=2.73";

// Omdøpte metasjangre (lese-tids-migrering, så eksisterende artister/config
// vises riktig uten å skrive om databasen).
export const META_RENAME = {
  "Afroamerikansk populærmusikk": "R&B",
  "Elektronisk musikk": "Klubbmusikk",
};

// Normaliserer rå Firestore-data til intern ny modell.
// Idempotent — kan kjøres på data som allerede er i ny form.
// Vasker også alle URL-felter (kun http/https slipper gjennom).
export function normalizeArtist(a) {
  const out = { ...a };

  if (META_RENAME[out.metaGenre]) out.metaGenre = META_RENAME[out.metaGenre];

  out.mainGenre = Array.isArray(out.mainGenre) ? out.mainGenre : [];
  out.subGenre = Array.isArray(out.subGenre) ? out.subGenre : [];

  // keyWorks: streng → array av {title, year?, url?}
  if (typeof out.keyWorks === "string") {
    out.keyWorks = out.keyWorks
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title) => ({ title }));
  } else if (!Array.isArray(out.keyWorks)) {
    out.keyWorks = [];
  }
  out.keyWorks = out.keyWorks.map((w) => {
    const { url, ...rest } = w;
    const safe = safeUrl(url);
    return safe ? { ...rest, url: safe } : rest;
  });

  // kilder: array av strenger → array av {text, url?}
  if (Array.isArray(out.kilder)) {
    out.kilder = out.kilder.map((k) =>
      typeof k === "string" ? { text: k } : { text: k.text || "", url: safeUrl(k.url) }
    ).filter((k) => k.text);
  } else {
    out.kilder = [];
  }

  // musicExamples: bakoverkompatibilitet fra gamle «links»
  if (!Array.isArray(out.musicExamples)) {
    const old = Array.isArray(out.links) ? out.links : [];
    out.musicExamples = old.map((l) => ({
      label: l.label || "",
      url: l.url || "",
      year: l.year || null,
      performanceYear: l.performanceYear || null,
    }));
  }
  out.musicExamples = out.musicExamples
    .map((m) => ({ ...m, url: safeUrl(m.url) }))
    .filter((m) => m.url);
  delete out.links;

  // Bilder
  out.imageUrl = safeUrl(out.imageUrl);
  out.imageCredit = out.imageCredit || "";

  return out;
}
