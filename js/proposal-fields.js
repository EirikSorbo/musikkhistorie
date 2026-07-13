// ============================================================================
//  FORESLÅBARE FELTER — hviteliste per entityType
// ----------------------------------------------------------------------------
//  Sannhetskilde for HVILKE felter en student lovlig kan foreslå endringer på.
//  Utelater bevisst alle system-/privilegiefelter (status, priority, votedUpBy,
//  teacherChecked, proposedBy, removedBy, addedYear, createdAt) — disse skal
//  ALDRI kunne skrives til et dokument via et godkjent endringsforslag.
//  approvePendingEdit (store.js) filtrerer godkjente nøkler mot denne lista, så
//  et ondsinnet pendingEdit ikke kan smugle privilegiefelter forbi læreren.
//  Må holdes i synk med FIELD_SPECS i proposals.js (samme feltnøkler).
//  Avhengighetsfri (kun artist-schema) → enhetstestbar i Node.
// ============================================================================

import { ARTIST_FIELDS } from "./artist-schema.js?v=3.08";

export const PROPOSABLE_KEYS = {
  // «complex»-felter (verk/musikkeksempler/kilder) foreslås ikke via editoren.
  artist: ARTIST_FIELDS.filter((f) => f.type !== "complex").map((f) => f.key),
  tech: ["name", "category", "decade", "adoptedYear", "adoptedLabel", "description", "imageUrl", "imageCredit"],
  subgenre: ["description"],
  "decade-society": ["society", "societyMore"],
  "decade-tech": ["tech", "techMore"],
};

// Nøklene som lovlig kan skrives for en gitt entityType (tom liste = ukjent).
export function proposableKeysFor(entityType) {
  return PROPOSABLE_KEYS[entityType] || [];
}
