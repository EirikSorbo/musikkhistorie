// ============================================================================
//  ARTIST-NORMALISERING — ren datalogikk, uten Firebase-avhengigheter
// ----------------------------------------------------------------------------
//  Skilt ut fra store.js så logikken kan enhetstestes i Node (store.js
//  importerer Firebase fra CDN og kan ikke lastes utenfor nettleser).
// ============================================================================

import { safeUrl } from "./util.js?v=5.54";
import { ARTIST_FIELDS, RETUR_FELTER, emptyValueFor } from "./artist-schema.js?v=5.54";
import { normaliserPunkter } from "./punkter.js?v=5.54";

// Normaliserer rå Firestore-data til intern modell: vasker URL-felter (kun
// http/https slipper gjennom) og filtrerer søppel ut av listefeltene, så ett
// skjevt dokument ikke kan krasje hele artistlista. Idempotent.
//
// Migreringene fra eldre datamodeller (metaGenre-omdøping, `links` →
// musicExamples, keyWorks som kommaseparert streng) er fjernet i v4.23 —
// verifisert mot live-Firestore samme dag: 0 av 319 artister hadde noen av
// formene. Elementnivå-koersjonene under BEHOLDES: de gjelder håndskrevne
// importfiler, ikke gammel data (se JSON-OPPSKRIFT.md).
export function normalizeArtist(a) {
  const out = { ...a };

  // Behold kun rene, ikke-tomme tekster i sjangerarrayene. null/tall/nestede
  // lister/objekter (f.eks. fra en håndredigert importfil) ville ellers bli
  // liggende og krasje sjanger-filter/søk nedstrøms (s.toLowerCase()).
  // En enkelt streng godtas og pakkes inn: importvalidatoren slipper
  // «mainGenre»: "Blues" gjennom, og uten dette ble verdien stille kastet her
  // — artisten havnet inn uten sjanger, med grønt lys i kvitteringen.
  const cleanGenres = (v) => {
    const liste = typeof v === "string" ? [v] : (Array.isArray(v) ? v : []);
    return liste.filter((s) => typeof s === "string" && s.trim());
  };
  out.mainGenre = cleanGenres(out.mainGenre);
  out.subGenre = cleanGenres(out.subGenre);

  if (!Array.isArray(out.keyWorks)) out.keyWorks = [];
  out.keyWorks = out.keyWorks
    .map((w) => (typeof w === "string" ? { title: w } : w))   // enkelt-streng (gammel form) → {title}
    .filter((w) => w && typeof w === "object")                // dropp null/tall/annet søppel
    .map((w) => {
      const { url, ...rest } = w;
      const safe = safeUrl(url);
      return safe ? { ...rest, url: safe } : rest;
    });

  // kilder: array av strenger → array av {text, url?, kategori?}. Kategorien
  // (se KILDE_KATEGORIER i kilder.js) må bæres videre — uten den ville
  // normaliseringen stille tømt feltet Referanser-kortet grupperer på.
  if (Array.isArray(out.kilder)) {
    out.kilder = out.kilder
      .filter((k) => k != null && (typeof k === "string" || typeof k === "object"))
      .map((k) => {
        if (typeof k === "string") return { text: k };
        const kat = typeof k.kategori === "string" ? k.kategori.trim() : "";
        const forf = typeof k.forfatter === "string" ? k.forfatter.trim() : "";
        const aar = parseInt(k.year, 10);
        const rad = { text: k.text || "", url: safeUrl(k.url) };
        if (forf) rad.forfatter = forf;
        if (Number.isFinite(aar)) rad.year = aar;
        if (kat) rad.kategori = kat;
        return rad;
      }).filter((k) => k.text);
  } else {
    out.kilder = [];
  }

  if (!Array.isArray(out.musicExamples)) out.musicExamples = [];
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

  // Bilder
  out.imageUrl = safeUrl(out.imageUrl);
  out.imageCredit = out.imageCredit || "";

  // Oppsummeringspunktene (v5.50): en ren liste med korte tekster.
  if ("punkter" in out) out.punkter = normaliserPunkter(out.punkter);

  return out;
}

// Bygger Firestore-dokumentet for en artist ut fra skjemaet (artist-schema.js)
// + systemfeltene. Delt av addArtist og addArtistsBulk (store.js), som legger
// på createdAt: serverTimestamp() selv — holdt utenfor her, så modulen forblir
// avhengighetsfri og enhetstestbar.
// Ny innsending av et returnert forslag (returflyten): bygg KUN feltene
// skjemaet faktisk sendte. resubmitArtist skrev fram til v5.30 alle
// skjemafeltene, og tømte dermed stille felter studentskjemaet ikke har —
// recordLabel var det eneste i dag, satt av læreren via «Rediger» (audit
// v5.19 funn 4). `in`-sjekken gjør skrivingen immun mot at de to skjemaene
// driver fra hverandre igjen.
export function resubmitArtistFields(data) {
  const n = normalizeArtist(data);
  const felter = {};
  for (const f of ARTIST_FIELDS) {
    if (f.key in (data || {})) felter[f.key] = n[f.key] ?? emptyValueFor(f.type);
  }
  return felter;
}

export function buildArtistDoc(data) {
  const n = normalizeArtist(data);
  const docData = {};
  for (const f of ARTIST_FIELDS) {
    docData[f.key] = n[f.key] ?? emptyValueFor(f.type);
  }
  // Status bevares ved lærer-import (active/removed/returnert — den siste er
  // returflytens «hos studenten», v5.13); alt annet → pending.
  const status = ["active", "removed", "returnert"].includes(data.status) ? data.status : "pending";
  // Returflytens felter følger KUN med når de finnes (lærer-import av backup).
  // En studentinnsending sender dem aldri, og reglene ville avvist dem der.
  const retur = {};
  for (const f of ["ownerUid", ...RETUR_FELTER]) {
    if (data[f] != null && data[f] !== "") retur[f] = data[f];
  }
  // Oppsummeringspunktene følger KUN med når de finnes (lærer-import). En
  // studentinnsending har dem aldri, og create-hvitelisten i reglene kjenner
  // dem ikke: skrev vi alltid feltet, ville hver studentinnsending blitt avvist.
  if (n.punkter?.length) retur.punkter = n.punkter;
  return {
    ...docData,
    ...retur,
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
