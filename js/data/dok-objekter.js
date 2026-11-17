// ============================================================================
//  FRA FIRESTORE-DOKUMENTER TIL APPENS OBJEKTER (v7.46, samlepakken fase 0)
// ----------------------------------------------------------------------------
//  Lytterne i store.js gjør om dokumentene i en samling til det sidene har i
//  state: artistene normaliseres, tiårene og beskrivelsene blir et oppslag på
//  id, innovasjonskortene sorteres etter år og så videre. Oversettelsen bor
//  her som rene funksjoner, så samlepakken til studentene (studentpakke-
//  modell.js) kan gi nøyaktig de samme objektene som de direkte lytterne.
//
//  Inndata er alltid en liste med { id, data }, der data er dokumentets
//  innhold slik Firestore gir det (d.data()). dokListe lager lista av et
//  øyeblikksbilde fra Firestore. Ingen import fra Firebase, så modulen kjører
//  i Node (enhetstestene).
// ============================================================================

import { normalizeArtist } from "./artist-normalize.js";
import { sorterPodkaster } from "../felles/podkast-rekkefolge.js";

// [{ id, data }] fra et øyeblikksbilde av en samling.
export const dokListe = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));

// Oppslag på id, med id også inne i objektet (tiårene, sjangerbeskrivelsene
// og koblingsbeskrivelsene).
function oppslagMedId(docs) {
  const m = {};
  for (const d of docs) m[d.id] = { id: d.id, ...d.data };
  return m;
}

export const artisterFraDok = (docs) => docs.map((d) => normalizeArtist({ id: d.id, ...d.data }));

export const tiarFraDok = oppslagMedId;
export const sjangerbeskrivelserFraDok = oppslagMedId;
export const koblingerFraDok = oppslagMedId;

// Nyeste øverst, og lærerens egen rekkefølge (v6.48, podkast-rekkefolge.js).
export const podkasterFraDok = (docs) => sorterPodkaster(docs.map((d) => ({ id: d.id, ...d.data })));

// Innovasjonskortene etter året de ble tatt i bruk.
export function innovasjonerFraDok(docs) {
  const items = docs.map((d) => ({ id: d.id, ...d.data }));
  items.sort((a, b) => (a.adoptedYear || 0) - (b.adoptedYear || 0));
  return items;
}

// Innholdet er et oppslag på id uten id inne i dokumentet.
export function innholdFraDok(docs) {
  const content = {};
  for (const d of docs) content[d.id] = d.data;
  return content;
}

// config/teacherChecks: dokumentets innhold, eller tomme lister når det ikke
// finnes. data er null når dokumentet mangler.
export const sjekkerFraDok = (data) => data || { genres: [], subgenres: [] };
