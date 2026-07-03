// ============================================================================
//  ARTIST-SKJEMA — én sannhetskilde for artistfeltene
// ----------------------------------------------------------------------------
//  Feltnøkler, etiketter og typer for artist-objektet. Herfra utledes:
//   - felt-etiketter i diff-tabellen (ui-edit.js)
//   - feltspesifikasjonen i forslagseditoren (proposals.js)
//   - eksport-/sammenlignings-felter i import/eksport (teacher-import.js)
//   - feltlista ved innsending (store.js addArtist)
//  HTML-skjemaene (student.html / teacher.html «Rediger artist») er fortsatt
//  håndskrevne pga. egne rad-editorer, men bruker de samme nøklene.
//
//  Typer: text | number | csv (kommaseparert liste) | textarea | gender |
//  complex (strukturerte rader — redigeres ikke i forslagseditoren).
//  Avhengighetsfri, så alle moduler kan importere uten sykler.
// ============================================================================

export const ARTIST_FIELDS = [
  { key: "name",           label: "Navn",             type: "text" },
  { key: "birthYear",      label: "Fødselsår",        type: "number" },
  { key: "deathYear",      label: "Dødsår",           type: "number" },
  { key: "gender",         label: "Kjønn",            type: "gender" },
  { key: "metaGenre",      label: "Metasjanger",      type: "text" },
  { key: "instrument",     label: "Instrument",       type: "text" },
  { key: "mainGenre",      label: "Sjangre",          type: "csv" },
  { key: "subGenre",       label: "Undersjangre",     type: "csv" },
  { key: "influenceStart", label: "Innflytelse fra",  type: "number" },
  { key: "influenceEnd",   label: "Innflytelse til",  type: "number" },
  { key: "recordLabel",    label: "Plateselskap",     type: "text" },
  { key: "geography",      label: "Virkested",        type: "text" },
  { key: "description",    label: "Beskrivelse",      type: "textarea", full: true },
  { key: "keyWorks",       label: "Sentrale verk",    type: "complex" },
  { key: "musicExamples",  label: "Musikkeksempler",  type: "complex" },
  { key: "kilder",         label: "Kilder",           type: "complex" },
  { key: "imageUrl",       label: "Bilde-URL",        type: "text", full: true },
  { key: "imageCredit",    label: "Bildekreditering", type: "text", full: true },
];

// { key: label } — brukt av diff-tabell og merge-dialog.
export const ARTIST_LABELS = Object.fromEntries(
  ARTIST_FIELDS.map((f) => [f.key, f.label])
);

// Tom-verdi per felttype (brukt når addArtist bygger Firestore-dokumentet).
export function emptyValueFor(type) {
  if (type === "number") return null;
  if (type === "csv" || type === "complex") return [];
  return "";
}

// Felter som kan sammenlignes/flettes ved import (alt unntatt navn — navnet
// er selve matchenøkkelen).
export const ARTIST_COMPARE_FIELDS = ARTIST_FIELDS
  .map((f) => f.key)
  .filter((k) => k !== "name");

// Felter som tas med i JSON-eksport, i tillegg til skjemafeltene:
// forslagsstiller + lærer-metadata + status (så skjulte ikke gjenoppstår
// som aktive ved re-import) + votedUpBy/addedYear, så en eksport→import er
// tapsfri: studentstemmer og opprettelsesår overlever en backup/restore.
export const ARTIST_EXPORT_FIELDS = [
  ...ARTIST_FIELDS.map((f) => f.key),
  "proposedBy", "priority", "teacherChecked", "status",
  "votedUpBy", "addedYear",
];
