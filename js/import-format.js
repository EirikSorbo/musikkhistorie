// ============================================================================
//  IMPORT-FORMAT — ren parselogikk for JSON-filene
// ----------------------------------------------------------------------------
//  Skilt ut fra teacher-import.js så logikken kan enhetstestes i Node.
// ============================================================================

// ---------------------------------------------------------------------------
//  VARMEKART — fletting av rader
// ---------------------------------------------------------------------------
//  Varmekartet er ETT Firestore-dokument (content/varmekart) med én rad per
//  sjanger. Import skrev tidligere heat-objektet fra fila rått over dokumentet,
//  så en fil med bare den nye sjangerens rad slettet alle de andre radene i
//  samme slengen. Nå flettes radene: fila overstyrer sine egne sjangre, og alt
//  den ikke nevner, blir stående. Samme prinsipp som sjanger- og koblings-
//  beskrivelsene, der import bare rører dokumentene som faktisk ligger i fila.
//
//  Rader som ikke er lister forkastes (og rapporteres) — de ville skjult hele
//  sjangerens tall bak en ugyldig verdi. Nivåene i seg selv normaliseres ikke
//  her; visningen (vkRow i explore-varmekart.js) godtar kun heltall 0–5 og viser resten
//  som «ingen data».
export function mergeHeatRows(current, incoming) {
  const base = current && typeof current === "object" ? current : {};
  const rows = incoming && typeof incoming === "object" ? incoming : {};
  const heat = { ...base };
  const written = [], skipped = [];
  for (const [genre, row] of Object.entries(rows)) {
    if (!Array.isArray(row)) { skipped.push(genre); continue; }
    heat[genre] = row;
    written.push(genre);
  }
  const kept = Object.keys(base).filter((g) => !written.includes(g));
  return { heat, written, kept, skipped };
}

// Gjør sjangerbeskrivelser om til et flatt { navn: dokument }-oppslag uansett
// kildeformat: nytt nestet { meta:{…}, main:{…}, sub:{…} }, eldre flatt
// { navn: dokument }, eller legacy «subgenres». Nestet kjennes igjen på at ALLE
// toppnøkler er meta/main/sub (ingen sjanger heter det).
export function flattenGenreDescriptions(obj) {
  if (!obj || typeof obj !== "object") return {};
  const keys = Object.keys(obj);
  const nested = keys.length > 0 && keys.every((k) => ["meta", "main", "sub"].includes(k));
  if (!nested) return obj; // alt flatt format
  const flat = {};
  for (const lv of ["meta", "main", "sub"]) {
    // FLETT ved samme navn i flere bolker (mulig i håndskrevne/gamle filer) —
    // en ren overskriving ville latt sub-bolkens dokument skygge for main-
    // bolkens tekst, og main-teksten nådde aldri Firestore (juni 2026-fella).
    // Nivåfeltene er disjunkte nøkler, så en grunn fletting er tapsfri.
    for (const [id, doc] of Object.entries(obj[lv] || {})) flat[id] = { ...flat[id], ...doc };
  }
  return flat;
}

// ---------------------------------------------------------------------------
//  IMPORT-VALIDERING
//  Kjøres på HELE artistlista FØR noe skrives/slettes, så en «Erstatt alle»
//  aldri sletter eksisterende data og deretter feiler på en skjev fil.
//  Fanger nøyaktig de formene Firestore avviser eller som krasjer flettingen:
//   • name som ikke er en ikke-tom tekst  (krasjer name.trim() i flettingen)
//   • nestede lister/objekter i mainGenre/subGenre  (Firestore avviser)
//   • keyWorks/musicExamples/kilder som ikke er lister
//   • dokumenter over Firestore-grensen (~1 MiB)
// ---------------------------------------------------------------------------

// Firestore avviser dokumenter større enn ~1 MiB. Vi holder litt margin.
const MAX_DOC_BYTES = 1_000_000;

// Portabelt UTF-8 byte-estimat (fungerer i både nettleser og Node).
function byteLength(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str).length;
  return unescape(encodeURIComponent(str)).length;
}

// En liste der ALLE elementer er primitive tekster/tall (ikke nestede
// lister/objekter, som Firestore avviser i array-felter).
function isFlatPrimitiveList(v) {
  return Array.isArray(v) && v.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x));
}

// Validerer en rå artistliste fra en importfil.
// Returnerer { ok, errors: [{ row, name, problems: string[] }] }.
export function validateArtistsForImport(list) {
  if (!Array.isArray(list)) {
    return { ok: false, errors: [{ row: 0, name: "", problems: ["Fila inneholder ingen artistliste."] }] };
  }
  const errors = [];
  list.forEach((a, i) => {
    const row = i + 1;
    const problems = [];
    const name = a && typeof a.name === "string" ? a.name : "";

    if (!a || typeof a !== "object" || Array.isArray(a)) {
      problems.push("Raden er ikke et artistobjekt.");
    } else {
      if (typeof a.name !== "string" || !a.name.trim()) {
        problems.push("mangler gyldig «name» (må være en ikke-tom tekst).");
      }
      for (const key of ["mainGenre", "subGenre"]) {
        const v = a[key];
        if (v != null && typeof v !== "string" && !isFlatPrimitiveList(v)) {
          problems.push(`«${key}» må være tekst eller en enkel liste av tekster (ingen nestede lister/objekter).`);
        }
      }
      for (const key of ["keyWorks", "musicExamples", "kilder"]) {
        const v = a[key];
        if (v != null && typeof v !== "string" && !Array.isArray(v)) {
          problems.push(`«${key}» må være en liste.`);
        }
      }
      let bytes = 0;
      try { bytes = byteLength(JSON.stringify(a)); } catch { bytes = 0; }
      if (bytes > MAX_DOC_BYTES) {
        problems.push(`dokumentet er for stort (${Math.round(bytes / 1024)} KB, maks ~1000 KB).`);
      }
    }
    if (problems.length) errors.push({ row, name, problems });
  });
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
//  IMPORTFILENS FORM
// ---------------------------------------------------------------------------

// Innholdsdeler en importfil kan bære utover artistene.
export const CONTENT_KEYS = ["decades", "genreDescriptions", "edgeDescriptions", "tech", "pages", "varmekart", "podcasts", "referanser", "genealogy"];

// Et tiårsdokument er samfunn, teknologi og kilder — ikke noe mer. Feltene
// plukkes ut ETT FOR ETT, både på vei ut i en eksport og på vei inn fra en fil:
// «les mer»-tekstene (societyMore/techMore) ble prøvd ut, forkastet i v4.78 og
// slettet i v4.93, og en rå kopiering av objektet ville dratt dem inn igjen fra
// en eldre sikkerhetskopi. Samme grunn til at den bor her og ikke i
// teacher-import: eksport og import kan ikke drive fra hverandre.
export function decadeDoc(d = {}) {
  return {
    society: d.society || "",
    tech: d.tech || "",
    kilder: Array.isArray(d.kilder) ? d.kilder : [],
  };
}

// Normaliserer en innlest importfil til appens interne form, eller returnerer
// null når formatet ikke gjenkjennes. Skilt ut fra handleImportFile (v4.52) og
// EKSPORTERT fordi den er ren og dermed testbar: objektet under er en
// HVITELISTE, og en nøkkel som ikke nevnes her forsvinner stille på vei til
// skrivingen. Det skjedde med sjangertreet — eksporten la det i fila og
// importExtras leste det, men mellomleddet slapp det aldri gjennom.
//
// En bar array leses som en ren artistliste (det eldste formatet).
export function normalizeImportFile(raw) {
  if (Array.isArray(raw)) {
    return { artists: raw, decades: {}, genreDescriptions: {}, tech: [] };
  }
  const harInnhold = raw && typeof raw === "object" &&
    (Array.isArray(raw.artists) || CONTENT_KEYS.some((k) => raw[k]));
  if (!harInnhold) return null;

  // Filer UTEN artister godtas også — rene innholdsfiler (sider, varmekart,
  // historier/beskrivelser, podkaster, sjangertreet).
  return {
    artists: Array.isArray(raw.artists) ? raw.artists : [],
    decades: raw.decades || {},
    // Formatet er nestet pr. nivå ({ meta, main, sub }) — flat ut til
    // { navn: dokument } før skriving.
    genreDescriptions: flattenGenreDescriptions(raw.genreDescriptions || {}),
    edgeDescriptions: raw.edgeDescriptions || {},
    tech: raw.tech || [],
    pages: raw.pages || {},
    varmekart: raw.varmekart || null,
    referanser: raw.referanser || null,
    podcasts: raw.podcasts || [],
    teacherChecks: raw.teacherChecks || null,
    genealogy: raw.genealogy || null,
  };
}
