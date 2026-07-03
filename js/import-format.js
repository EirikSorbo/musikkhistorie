// ============================================================================
//  IMPORT-FORMAT — ren parselogikk for JSON-filene
// ----------------------------------------------------------------------------
//  Skilt ut fra teacher-import.js så logikken kan enhetstestes i Node.
// ============================================================================

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
    for (const [id, doc] of Object.entries(obj[lv] || {})) flat[id] = doc;
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
