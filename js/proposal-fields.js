// ============================================================================
//  FORESLÅBARE FELTER — hviteliste per entityType
// ----------------------------------------------------------------------------
//  Sannhetskilde for HVILKE felter en student lovlig kan foreslå endringer på.
//  Utelater bevisst alle system-/privilegiefelter (status, priority, votedUpBy,
//  teacherChecked, proposedBy, removedBy, addedYear, createdAt) — disse skal
//  ALDRI kunne skrives til et dokument via et godkjent endringsforslag.
//  approvePendingEdit (store.js) filtrerer godkjente nøkler mot denne lista, så
//  et ondsinnet pendingEdit ikke kan smugle privilegiefelter forbi læreren.
//  Må holdes i synk med FIELD_SPECS i proposals.js (samme feltnøkler) OG med
//  proposedFields-hvitelisten i firestore.rules (pendingEdits create): et nytt
//  foreslåbart felt må inn begge steder, ellers avviser reglene forslaget.
//  Avhengighetsfri (kun artist-schema) → enhetstestbar i Node.
// ============================================================================

import { ARTIST_FIELDS } from "./artist-schema.js?v=4.41";

export const PROPOSABLE_KEYS = {
  // «complex»-felter (verk/musikkeksempler/kilder) foreslås ikke via editoren.
  artist: ARTIST_FIELDS.filter((f) => f.type !== "complex").map((f) => f.key),
  tech: ["name", "type", "category", "instrument", "decade", "adoptedYear", "adoptedLabel", "description", "kilder", "imageUrl", "imageCredit"],
  // Sjangre (main = tre-node, sub = fri undersjanger). «kilder» ble åpnet for
  // forslag da sjangerkortene fikk kildelister på linje med artistkortene;
  // activeFrom/activeTo er epoken, og gjelder i praksis bare main-nivået.
  subgenre: ["description", "kilder", "activeFrom", "activeTo"],
  // Instrumentsammendraget bor i content-samlingen; body er hele teksten.
  instrument: ["body"],
  "decade-society": ["society", "societyMore"],
  "decade-tech": ["tech", "techMore"],
};

// Nøklene som lovlig kan skrives for en gitt entityType (tom liste = ukjent).
export function proposableKeysFor(entityType) {
  return PROPOSABLE_KEYS[entityType] || [];
}
