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
