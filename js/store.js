// ============================================================================
//  DATALAG — Firebase Firestore
// ----------------------------------------------------------------------------
//  All kommunikasjon med databasen skjer her. Bruker Firestore i sanntid,
//  slik at alle i klassen ser endringer umiddelbart.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js?v=2.72";
import { DEFAULT_CONFIG } from "./limits.js?v=2.72";
import { GENEALOGY_META_GENRES, isMainGenre } from "./genealogy.js?v=2.72";
import { normalizeArtist, META_RENAME } from "./artist-normalize.js?v=2.72";
import { ARTIST_FIELDS, emptyValueFor } from "./artist-schema.js?v=2.72";

// Normaliseringen bor i artist-normalize.js (ren modul, enhetstestbar);
// re-eksporteres her så eksisterende importer fortsatt virker.
export { normalizeArtist };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const artistsCol = collection(db, "artists");
const decadesCol = collection(db, "decades");
// Sjangerbeskrivelser (alle nivåer: meta/main/sub). Het tidligere «subgenres»
// — navnet kolliderte med artistfeltet `subGenre`. `legacySubgenresCol` peker
// på den gamle samlingen, kun for engangsmigrering (se migrateGenreDescriptions).
const genreDescsCol = collection(db, "genreDescriptions");
const legacySubgenresCol = collection(db, "subgenres");
const podcastsCol = collection(db, "podcasts");
const techCol = collection(db, "tech");
const pendingEditsCol = collection(db, "pendingEdits");
const configRef = doc(db, "config", "settings");

// ----------------------------------------------------------------------------
//  ANONYM KLIENT-ID
//  Vi krever ikke innlogging, men gir hver nettleser en tilfeldig id som
//  lagres lokalt. Brukes kun til å hindre dobbeltstemming fra samme enhet.
// ----------------------------------------------------------------------------

export function getClientId() {
  let id = localStorage.getItem("pensum_client_id");
  if (!id) {
    id = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("pensum_client_id", id);
  }
  return id;
}

// ----------------------------------------------------------------------------
//  SANNTIDS-LYTTERE
// ----------------------------------------------------------------------------

// Lytter på alle artister. Kaller callback hver gang noe endres.
export function subscribeArtists(callback) {
  return onSnapshot(artistsCol, (snapshot) => {
    const artists = snapshot.docs.map((d) => normalizeArtist({ id: d.id, ...d.data() }));
    callback(artists);
  }, (err) => {
    console.error("Kunne ikke lese artister – sjekk Firestore-regler:", err.code, err.message);
    document.dispatchEvent(new CustomEvent("firestore-error", { detail: err }));
  });
}

// Bakoverkompat for config: gamle nøkler → nye (genres→metaGenres osv.).
function normalizeConfig(d) {
  const c = { ...d };
  if (c.metaGenres == null && c.genres != null) c.metaGenres = c.genres;
  if (c.metaGenreLimits == null && c.genreLimits != null) c.metaGenreLimits = c.genreLimits;
  if (c.maxPerMetaGenre == null && c.maxPerGenre != null) c.maxPerMetaGenre = c.maxPerGenre;
  delete c.genres; delete c.genreLimits; delete c.maxPerGenre;
  // Treet er sannhetskilde: metasjangre derfra skal alltid være med, selv om
  // læreren har lagret en egen liste. Lærertillegg beholdes, treets vinner.
  // Lagrede navn migreres gjennom META_RENAME, så omdøpte metasjangre ikke
  // henger igjen fra eldre config.
  const saved = (Array.isArray(c.metaGenres) ? c.metaGenres : [])
    .map((m) => META_RENAME[m] || m);
  c.metaGenres = [...new Set([...GENEALOGY_META_GENRES, ...saved])];
  return c;
}

// Lytter på konfigurasjon. Bruker standardgrenser til læreren lagrer egne.
export function subscribeConfig(callback) {
  return onSnapshot(configRef, (snap) => {
    if (!snap.exists()) {
      callback({ ...DEFAULT_CONFIG });
    } else {
      callback({ ...DEFAULT_CONFIG, ...normalizeConfig(snap.data()) });
    }
  }, (err) => {
    console.error("Kunne ikke lese konfig – sjekk Firestore-regler:", err.code, err.message);
    callback({ ...DEFAULT_CONFIG });
  });
}

// ----------------------------------------------------------------------------
//  LÆRER-INNLOGGING (Google / Firebase Auth)
// ----------------------------------------------------------------------------

// Kaller callback med gjeldende bruker (eller null) ved hver endring
export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

// Åpner Google-innloggingsvindu
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

// Logger ut læreren
export function signOutTeacher() {
  return signOut(auth);
}

// ----------------------------------------------------------------------------
//  STUDENTHANDLINGER
// ----------------------------------------------------------------------------

// Bygger Firestore-dokumentet for en artist ut fra skjemaet (artist-schema.js)
// + systemfeltene. Delt av addArtist og addArtistsBulk.
function buildArtistDoc(data) {
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
    votedUpBy: [],
    addedYear: new Date().getFullYear(),
    createdAt: serverTimestamp(),
  };
}

// Legg inn et nytt forslag. Normaliserer inn til ny modell før skriving.
export async function addArtist(data) {
  return addDoc(artistsCol, buildArtistDoc(data));
}

// Firestore tillater maks 500 operasjoner per batch.
const BATCH_LIMIT = 500;

// Legg inn mange artister på én gang (import). Batchet — dramatisk raskere
// enn å skrive ett og ett dokument.
export async function addArtistsBulk(list) {
  for (let i = 0; i < list.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const data of list.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(artistsCol), buildArtistDoc(data));
    }
    await batch.commit();
  }
  return list.length;
}

// Stem frem et forslag ("svært relevant")
export async function voteUp(artistId, clientId) {
  const ref = doc(db, "artists", artistId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const voters = new Set(snap.data().votedUpBy || []);
    voters.add(clientId);
    tx.update(ref, { votedUpBy: [...voters] });
  });
}

// Angre positiv stemme
export async function undoVoteUp(artistId, clientId) {
  const ref = doc(db, "artists", artistId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const votedUpBy = (snap.data().votedUpBy || []).filter((id) => id !== clientId);
    tx.update(ref, { votedUpBy });
  });
}

// ----------------------------------------------------------------------------
//  LÆRERHANDLINGER (krever lærerkode i appen)
// ----------------------------------------------------------------------------

// Lærer godkjenner et ventende forslag
export async function teacherApprove(artistId) {
  const ref = doc(db, "artists", artistId);
  return setDoc(ref, { status: "active" }, { merge: true });
}

// Lærer avviser et ventende forslag
export async function teacherReject(artistId) {
  const ref = doc(db, "artists", artistId);
  return setDoc(ref, { status: "removed", removedBy: "teacher" }, { merge: true });
}

// Sett prioritetsnivå (3=viktigst, 2=viktig, 1=mindre viktig, 0=ingen)
export async function setArtistPriority(artistId, level) {
  return setDoc(doc(db, "artists", artistId), { priority: level }, { merge: true });
}

// Lærer sletter et forslag permanent
export async function teacherDelete(artistId) {
  return deleteDoc(doc(db, "artists", artistId));
}

// Oppdater enkeltfelt på en artist (brukt av merge)
export async function updateArtistFields(artistId, fields) {
  return setDoc(doc(db, "artists", artistId), fields, { merge: true });
}

// Slett alle artister (full reset). Batchet.
export async function deleteAllArtists() {
  const snapshot = await getDocs(artistsCol);
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
  return docs.length;
}

// ----------------------------------------------------------------------------
//  TIÅR- OG UNDERSJANGER-BESKRIVELSER
// ----------------------------------------------------------------------------

export function subscribeDecades(callback) {
  return onSnapshot(decadesCol, (snapshot) => {
    const decades = {};
    snapshot.docs.forEach((d) => { decades[d.id] = { id: d.id, ...d.data() }; });
    callback(decades);
  }, (err) => console.error("Kunne ikke lese tiårsbeskrivelser (sjekk Firestore-regler):", err.message));
}

export function subscribeGenreDescs(callback) {
  // Overgangsløsning: les BÅDE den nye «genreDescriptions» og den gamle
  // «subgenres». Nye verdier vinner; navn som ennå ikke er migrert dekkes av
  // legacy. Slik blir det ingen nedetid uansett når Firestore-reglene publiseres
  // eller migreringen kjøres. Forenkle til kun genreDescriptions når den gamle
  // samlingen er tømt (se migrateGenreDescriptions).
  let primary = {}, legacy = {};
  const emit = () => callback({ ...legacy, ...primary });
  const toMap = (snapshot) => {
    const m = {};
    snapshot.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
    return m;
  };
  const unsubPrimary = onSnapshot(genreDescsCol, (snap) => { primary = toMap(snap); emit(); },
    // Før reglene er publisert mangler lesetilgang her — legacy dekker, så feilen
    // logges stille (debug) i stedet for å spamme konsollen.
    (err) => console.debug("genreDescriptions ikke lesbar ennå (faller tilbake til legacy):", err.message));
  const unsubLegacy = onSnapshot(legacySubgenresCol, (snap) => { legacy = toMap(snap); emit(); },
    (err) => console.error("Kunne ikke lese sjangerbeskrivelser (sjekk Firestore-regler):", err.message));
  return () => { unsubPrimary(); unsubLegacy(); };
}

export function subscribePodcasts(callback) {
  return onSnapshot(podcastsCol, (snapshot) => {
    const pods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    pods.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    callback(pods);
  }, (err) => console.error("Kunne ikke lese podkaster (sjekk Firestore-regler):", err.message));
}

export async function addPodcast(data) {
  return addDoc(podcastsCol, data);
}

export async function updatePodcast(id, data) {
  return setDoc(doc(db, "podcasts", id), data, { merge: true });
}

export async function deletePodcast(id) {
  return deleteDoc(doc(db, "podcasts", id));
}

export function subscribeTech(callback) {
  return onSnapshot(techCol, (snapshot) => {
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a.adoptedYear || 0) - (b.adoptedYear || 0));
    callback(items);
  }, (err) => console.error("Kunne ikke lese tech (sjekk Firestore-regler):", err.message));
}

export async function addTech(data) {
  return addDoc(techCol, data);
}

export async function updateTech(id, data) {
  return setDoc(doc(db, "tech", id), data, { merge: true });
}

export async function deleteTech(id) {
  return deleteDoc(doc(db, "tech", id));
}

export async function saveDecadeDesc(decadeId, data) {
  return setDoc(doc(db, "decades", String(decadeId)), data, { merge: true });
}

// Skriver hele sjangerbeskrivelse-dokumentet (brukt av import).
export async function saveGenreDesc(genreId, data) {
  return setDoc(doc(db, "genreDescriptions", genreId), data, { merge: true });
}

// Skriver beskrivelse for ETT nivå (meta/main/sub) — resten av dokumentet
// (andre nivåer) beholdes via merge.
export async function saveGenreDescLevel(genreId, level, data) {
  return setDoc(doc(db, "genreDescriptions", genreId), { [level]: data }, { merge: true });
}

export async function deleteGenreDesc(genreId) {
  return deleteDoc(doc(db, "genreDescriptions", genreId));
}

// Engangsmigrering: kopier alle dokumenter fra den gamle «subgenres»-samlingen
// til «genreDescriptions». Idempotent — hopper over hvis målet alt har data, så
// den trygt kan kjøres ved hver lærer-oppstart til migreringen er gjort. Kan
// fjernes når live-dataen er flyttet. Krever lærer-skrivetilgang (Firestore-
// reglene må tillate skriving til genreDescriptions).
export async function migrateGenreDescriptions() {
  const target = await getDocs(genreDescsCol);
  const legacy = await getDocs(legacySubgenresCol);
  if (!target.empty) {
    // Status-melding for pensjonering av migreringskoden: når legacy melder 0
    // (eller bare utdaterte kopier), kan dobbeltlyttingen og denne funksjonen
    // fjernes helt (og «subgenres»-samlingen slettes i Firebase Console).
    console.info(
      `Sjangerbeskrivelse-migrering: FERDIG. genreDescriptions har ${target.size} dokument(er); ` +
      `legacy «subgenres» har ${legacy.size} dokument(er) igjen` +
      (legacy.size ? " (kun gamle kopier — kan slettes i Firebase Console)." : ".")
    );
    return { migrated: 0, skipped: true, legacyCount: legacy.size };
  }
  if (legacy.empty) return { migrated: 0, skipped: false, legacyCount: 0 };
  let migrated = 0;
  for (const d of legacy.docs) {
    await setDoc(doc(db, "genreDescriptions", d.id), d.data(), { merge: true });
    migrated++;
  }
  console.info(`Migrerte ${migrated} sjangerbeskrivelse(r): subgenres → genreDescriptions.`);
  return { migrated, skipped: false, legacyCount: legacy.size };
}

// Engangsopprydding: fjern foreldreløse beskrivelses-dokumenter som ligger under
// GAMLE metasjanger-navn (META_RENAME-nøkler, f.eks. «Afroamerikansk
// populærmusikk»). Beskrivelsene hører nå under de nye navnene; de gamle er
// rene rester etter omdøpingen. Idempotent. NB: kun omdøpte navn — «Rock» er
// gjeninnført i treet og skal IKKE ryddes bort (tidligere bug: en Rock-
// beskrivelse ble slettet ved hver lærer-oppstart).
export async function cleanupRenamedGenreDescs() {
  const stale = Object.keys(META_RENAME);
  let removed = 0;
  for (const id of stale) {
    const ref = doc(db, "genreDescriptions", id);
    const snap = await getDoc(ref);
    if (snap.exists()) { await deleteDoc(ref); removed++; }
  }
  if (removed) console.info(`Ryddet bort ${removed} foreldreløs(e) sjangerbeskrivelse(r) under gamle metasjanger-navn.`);
  return removed;
}

// Engangsopprydding: fjern det UTDATERTE flate toppnivå-feltet (description/kilder)
// fra genreDescriptions-dokumenter. Det var en legacy-kopi som appen ikke lenger
// leser (all tekst hentes nå kun fra nivåene meta/main/sub). Her fjernes det også
// fra dataene, så basen blir ren. VIKTIG: dokumenter som KUN har flat tekst (uten
// nivå-felt) røres IKKE — der ville fjerning slettet det eneste innholdet; de
// logges i stedet som advarsel så teksten kan legges inn på riktig nivå manuelt.
// Idempotent: når det flate feltet er borte, gjør den ingenting.
export async function cleanupFlatGenreDescs() {
  const snap = await getDocs(genreDescsCol);
  let cleaned = 0;
  const flatOnly = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (data.description === undefined && data.kilder === undefined) continue; // alt rent
    const hasLevel = ["meta", "main", "sub"].some((lv) => data[lv] && data[lv].description);
    if (hasLevel) {
      await updateDoc(d.ref, { description: deleteField(), kilder: deleteField() });
      cleaned++;
    } else {
      flatOnly.push(d.id);
    }
  }
  if (cleaned) console.info(`Ryddet bort utdatert flat beskrivelse fra ${cleaned} sjangerdokument(er).`);
  if (flatOnly.length) console.warn(`${flatOnly.length} sjangerdokument(er) har KUN flat tekst (ingen nivå) og ble IKKE rørt — legg inn nivå-tekst manuelt: ${flatOnly.join(", ")}`);
  return { cleaned, flatOnly };
}

// Lærer lagrer hele konfigurasjonen (full overskriving, så fjernede
// per-tiår/per-sjanger-grenser ikke blir liggende igjen).
export async function updateConfig(config) {
  return setDoc(configRef, config);
}

// ----------------------------------------------------------------------------
//  ENDRINGSFORSLAG (studentenes foreslåtte endringer på eksisterende kort)
// ----------------------------------------------------------------------------

// Sanntids-lytter på alle åpne endringsforslag.
export function subscribePendingEdits(callback) {
  return onSnapshot(pendingEditsCol, (snapshot) => {
    const edits = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    edits.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    callback(edits);
  }, (err) => console.error("Kunne ikke lese endringsforslag (sjekk Firestore-regler):", err.message));
}

// Legg inn et endringsforslag. `proposedFields` skal kun inneholde feltene
// som faktisk er endret — UI-koden gjør differansen mot dagens verdier.
// `level` (meta/main/sub) brukes kun av entityType "subgenre", så godkjenning
// vet hvilket nivåfelt i genreDescriptions teksten skal skrives til.
export async function addPendingEdit({ entityType, entityId, entityName, proposedFields, proposedBy, level }) {
  return addDoc(pendingEditsCol, {
    entityType,
    entityId,
    entityName: entityName || "",
    proposedFields: proposedFields || {},
    proposedBy: proposedBy || "Anonym",
    ...(level ? { level } : {}),
    createdAt: serverTimestamp(),
  });
}

// Nivået et sjangerbeskrivelse-forslag hører til. Eldre forslag mangler
// level-feltet — da gjettes det ut fra om navnet er en tre-sjanger.
export function genreEditLevel(edit) {
  if (edit.level) return edit.level;
  return isMainGenre(edit.entityId) ? "main" : "sub";
}

// Lærer godkjenner valgte felter. `approvedKeys` er liste over feltnøklene
// fra `proposedFields` som skal skrives til target-entiteten. Sletter alltid
// hele `pendingEdit`-dokumentet etter behandling.
export async function approvePendingEdit(pendingEditId, approvedKeys) {
  const editRef = doc(db, "pendingEdits", pendingEditId);
  const snap = await getDoc(editRef);
  if (!snap.exists()) return;
  const data = snap.data();

  let toApply = {};
  for (const k of approvedKeys || []) {
    if (k in (data.proposedFields || {})) toApply[k] = data.proposedFields[k];
  }

  // Sjangerbeskrivelser er nivådelte ({ meta/main/sub: { description, … } });
  // et flatt description-felt leses ikke av appen. Pakk derfor inn i riktig nivå.
  if (data.entityType === "subgenre" && Object.keys(toApply).length) {
    toApply = { [genreEditLevel(data)]: toApply };
  }

  const targetRef = pendingEditTargetRef(data.entityType, data.entityId);
  if (targetRef && Object.keys(toApply).length) {
    await setDoc(targetRef, toApply, { merge: true });
  }
  await deleteDoc(editRef);
}

// Lærer avviser hele forslaget uten å lagre noe.
export async function rejectPendingEdit(pendingEditId) {
  return deleteDoc(doc(db, "pendingEdits", pendingEditId));
}

function pendingEditTargetRef(entityType, entityId) {
  switch (entityType) {
    case "artist":         return doc(db, "artists", entityId);
    case "tech":           return doc(db, "tech", entityId);
    // entityType beholdes som «subgenre» for bakoverkompat med eksisterende
    // pendingEdits-dokumenter; målet er nå genreDescriptions-samlingen.
    case "subgenre":       return doc(db, "genreDescriptions", entityId);
    case "decade-society": return doc(db, "decades", String(entityId));
    case "decade-tech":    return doc(db, "decades", String(entityId));
    default:               return null;
  }
}

// Forslag om et helt nytt innovasjonskort fra student. Markeres med
// `status: "pending"` og venter på lærergodkjenning. Eksisterende
// tech-dokumenter uten status-felt regnes som aktive.
export async function addTechProposal(data) {
  return addDoc(techCol, {
    ...data,
    status: "pending",
    proposedBy: data.proposedBy || "Anonym",
    createdAt: serverTimestamp(),
  });
}

export async function approveTech(techId) {
  return setDoc(doc(db, "tech", techId), { status: "active" }, { merge: true });
}

const teacherChecksRef = doc(db, "config", "teacherChecks");

export function subscribeTeacherChecks(callback) {
  return onSnapshot(teacherChecksRef, (snap) => {
    callback(snap.exists() ? snap.data() : { genres: [], subgenres: [] });
  });
}

export async function setTeacherChecks(data) {
  return setDoc(teacherChecksRef, data, { merge: true });
}
