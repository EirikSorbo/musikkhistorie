// ============================================================================
//  ARTIST-NORMALISERING — ren datalogikk, uten Firebase-avhengigheter
// ----------------------------------------------------------------------------
//  Skilt ut fra store.js så logikken kan enhetstestes i Node (store.js
//  importerer Firebase fra CDN og kan ikke lastes utenfor nettleser).
// ============================================================================

import { safeUrl } from "./util.js?v=3.65";
import { ARTIST_FIELDS, emptyValueFor } from "./artist-schema.js?v=3.65";

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

  // Behold kun rene, ikke-tomme tekster i sjangerarrayene. null/tall/nestede
  // lister/objekter (f.eks. fra en håndredigert importfil) ville ellers bli
  // liggende og krasje sjanger-filter/søk nedstrøms (s.toLowerCase()).
  const cleanGenres = (v) =>
    Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()) : [];
  out.mainGenre = cleanGenres(out.mainGenre);
  out.subGenre = cleanGenres(out.subGenre);

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
  out.keyWorks = out.keyWorks
    .map((w) => (typeof w === "string" ? { title: w } : w))   // enkelt-streng (gammel form) → {title}
    .filter((w) => w && typeof w === "object")                // dropp null/tall/annet søppel
    .map((w) => {
      const { url, ...rest } = w;
      const safe = safeUrl(url);
      return safe ? { ...rest, url: safe } : rest;
    });

  // kilder: array av strenger → array av {text, url?}
  if (Array.isArray(out.kilder)) {
    out.kilder = out.kilder
      .filter((k) => k != null && (typeof k === "string" || typeof k === "object"))
      .map((k) =>
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
    .filter((m) => m && typeof m === "object")   // dropp null/søppel før spredning
    .map((m) => {
      const o = { ...m, url: safeUrl(m.url) };
      // genre (sjangerknytning for spillelister): kun ikke-tom streng beholdes.
      if (typeof o.genre === "string" && o.genre.trim()) o.genre = o.genre.trim();
      else delete o.genre;
      return o;
    })
    .filter((m) => m.url);
  delete out.links;

  // Bilder
  out.imageUrl = safeUrl(out.imageUrl);
  out.imageCredit = out.imageCredit || "";

  return out;
}

// Bygger Firestore-dokumentet for en artist ut fra skjemaet (artist-schema.js)
// + systemfeltene. Delt av addArtist og addArtistsBulk (store.js), som legger
// på createdAt: serverTimestamp() selv — holdt utenfor her, så modulen forblir
// avhengighetsfri og enhetstestbar.
export function buildArtistDoc(data) {
  const n = normalizeArtist(data);
  const docData = {};
  for (const f of ARTIST_FIELDS) {
    docData[f.key] = n[f.key] ?? emptyValueFor(f.type);
  }
  // Status bevares ved lærer-import (active/removed); alt annet → pending.
  const status = ["active", "removed"].includes(data.status) ? data.status : "pending";
  return {
    ...docData,
    proposedBy: n.proposedBy || "Anonym",
    status,
    removedBy: status === "removed" ? "teacher" : null,
    teacherChecked: n.teacherChecked || false,
    priority: n.priority || 0,
    // Bevar innkommende stemmer ved lærer-import (tapsfri backup/restore).
    // Studentinnsending kan IKKE smugle inn stemmer: skjemaet setter aldri
    // votedUpBy, og Firestore-reglene krever tom votedUpBy for ikke-lærere.
    votedUpBy: Array.isArray(n.votedUpBy)
      ? n.votedUpBy.filter((v) => typeof v === "string")
      : [],
    addedYear: Number.isInteger(n.addedYear) ? n.addedYear : new Date().getFullYear(),
  };
}
