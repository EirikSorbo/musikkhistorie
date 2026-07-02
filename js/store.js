// ============================================================================
//  DATALAG — Firebase Firestore
// ----------------------------------------------------------------------------
//  All kommunikasjon med databasen skjer her. Bruker Firestore i sanntid,
//  slik at alle i klassen ser endringer umiddelbart.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
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
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js?v=2.75";
import { DEFAULT_CONFIG } from "./limits.js?v=2.75";
import { GENEALOGY_META_GENRES, isMainGenre } from "./genealogy.js?v=2.75";
import { normalizeArtist, META_RENAME } from "./artist-normalize.js?v=2.75";
import { ARTIST_FIELDS, emptyValueFor } from "./artist-schema.js?v=2.75";

// Normaliseringen bor i artist-normalize.js (ren modul, enhetstestbar);
// re-eksporteres her så eksisterende importer fortsatt virker.
export { normalizeArtist };

const app = initializeApp(firebaseConfig);

// Persistent lokal cache: Firestore lagrer dokumentene i IndexedDB og gjenopptar
// lyttere med resume-token, slik at kun ENDREDE dokumenter faktureres ved
// gjenbesøk/reload i stedet for hele kolleksjonen på nytt (kutter storparten av
// lesene og holder oss trygt innenfor gratiskvoten for et helt kull).
// persistentMultipleTabManager håndterer flere åpne faner. Faller tilbake til
// minne-cache i nettlesere uten IndexedDB (f.eks. eldre Safari privat modus),
// så appen alltid initialiserer.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  console.warn("Persistent Firestore-cache utilgjengelig – bruker minne-cache:", e?.message || e);
  db = getFirestore(app);
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const artistsCol = collection(db, "artists");
const decadesCol = collection(db, "decades");
// Sjangerbeskrivelser (alle nivåer: meta/main/sub). Het tidligere «subgenres»
// — navnet kolliderte med artistfeltet `subGenre`; migrert 2026-07.
const genreDescsCol = collection(db, "genreDescriptions");
const podcastsCol = collection(db, "podcasts");
const techCol = collection(db, "tech");
const pendingEditsCol = collection(db, "pendingEdits");
const configRef = doc(db, "config", "settings");

// ----------------------------------------------------------------------------
//  STEMME-IDENTITET (anonym innlogging)
//  Hver nettleser logges inn anonymt hos Firebase — usynlig for studenten,
//  ingen e-post/passord. uid-en brukes som stemme-identitet, og Firestore-
//  reglene håndhever at kun EGEN uid kan legges til/fjernes i votedUpBy.
//  Overgang: hvis anonym innlogging ikke er aktivert i Firebase Console ennå,
//  faller vi tilbake til den gamle localStorage-ID-en (fungerer kun så lenge
//  de gamle, slakke reglene er publisert).
// ----------------------------------------------------------------------------

const AUTH_CONFIGURED = !String(firebaseConfig.apiKey).startsWith("DIN_");

// Hold nettleseren innlogget: logg inn anonymt ved oppstart og på nytt etter
// utlogging (en lærer som logger ut, får ny anonym økt automatisk).
if (AUTH_CONFIGURED) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch((e) =>
        console.warn("Anonym innlogging utilgjengelig (aktiver «Anonymous» i Firebase Console → Authentication → Sign-in method):", e.code)
      );
    }
  });
}

// Venter på en innlogget bruker (anonym eller Google). Kaster hvis anonym
// innlogging ikke er aktivert — kalleren håndterer fallback.
async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// Identiteten en stemme registreres med: uid når innlogget, ellers legacy-ID.
async function voteIdentity() {
  try {
    return (await ensureAuth()).uid;
  } catch {
    return getClientId();
  }
}

// Klient-ID for rendering (hvilke kort har JEG stemt på): uid når innlogget.
// Beholder localStorage-fallbacken for overgangsfasen og oppsettmodus.
export function getClientId() {
  const uid = AUTH_CONFIGURED ? auth.currentUser?.uid : null;
  if (uid) return uid;
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

// Stem frem et forslag ("svært relevant"). Identiteten hentes internt
// (uid fra anonym innlogging) — reglene avviser alt annet enn egen uid.
export async function voteUp(artistId) {
  const clientId = await voteIdentity();
  const ref = doc(db, "artists", artistId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const voters = new Set(snap.data().votedUpBy || []);
    voters.add(clientId);
    tx.update(ref, { votedUpBy: [...voters] });
  });
}

// Angre positiv stemme (kan bare fjerne egen uid)
export async function undoVoteUp(artistId) {
  const clientId = await voteIdentity();
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
  return onSnapshot(genreDescsCol, (snapshot) => {
    const m = {};
    snapshot.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
    callback(m);
  }, (err) => console.error("Kunne ikke lese sjangerbeskrivelser (sjekk Firestore-regler):", err.message));
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
