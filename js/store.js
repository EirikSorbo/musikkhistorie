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
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";
import { DEFAULT_CONFIG } from "./limits.js";
import { GENEALOGY_GENRES } from "./genealogy.js?v=230";

const SJANGER_SET = new Set(GENEALOGY_GENRES.map((g) => g.toLowerCase()));

// Normaliserer rå Firestore-data til intern ny modell.
// Idempotent — kan kjøres på data som allerede er i ny form.
export function normalizeArtist(a) {
  const out = { ...a };

  // sjangre + undersjangre: del opp `subgenres` hvis ikke allerede satt
  if (!Array.isArray(out.sjangre) && !Array.isArray(out.undersjangre)) {
    const subs = Array.isArray(out.subgenres) ? out.subgenres : [];
    out.sjangre = subs.filter((s) => SJANGER_SET.has(String(s).toLowerCase()));
    out.undersjangre = subs.filter((s) => !SJANGER_SET.has(String(s).toLowerCase()));
  } else {
    out.sjangre = Array.isArray(out.sjangre) ? out.sjangre : [];
    out.undersjangre = Array.isArray(out.undersjangre) ? out.undersjangre : [];
  }
  // For bakoverkompatibilitet i kode som leser begge:
  out.subgenres = [...out.sjangre, ...out.undersjangre];

  // keyWorks: streng → array av {title, year?, url?}
  if (typeof out.keyWorks === "string") {
    out.keyWorks = out.keyWorks
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title) => ({ title }));
  } else if (!Array.isArray(out.keyWorks)) {
    out.keyWorks = [];
  }

  // kilder: array av strenger → array av {text, url?}
  if (Array.isArray(out.kilder)) {
    out.kilder = out.kilder.map((k) =>
      typeof k === "string" ? { text: k } : { text: k.text || "", url: k.url || "" }
    ).filter((k) => k.text);
  } else {
    out.kilder = [];
  }

  // musicExamples: bakoverkompatibilitet fra gamle «links»
  if (!Array.isArray(out.musicExamples)) {
    const old = Array.isArray(out.links) ? out.links : [];
    out.musicExamples = old.map((l) => ({
      label: l.label || "",
      url: l.url || "",
      year: l.year || null,
      performanceYear: l.performanceYear || null,
    })).filter((m) => m.url);
  }
  delete out.links;

  // Bilder
  out.imageUrl = out.imageUrl || "";
  out.imageCredit = out.imageCredit || "";

  return out;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const artistsCol = collection(db, "artists");
const decadesCol = collection(db, "decades");
const subgenresCol = collection(db, "subgenres");
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

// Lytter på konfigurasjon. Bruker standardgrenser til læreren lagrer egne.
export function subscribeConfig(callback) {
  return onSnapshot(configRef, (snap) => {
    if (!snap.exists()) {
      callback({ ...DEFAULT_CONFIG });
    } else {
      callback({ ...DEFAULT_CONFIG, ...snap.data() });
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

// Legg inn et nytt forslag. Normaliserer inn til ny modell før skriving.
export async function addArtist(data) {
  const n = normalizeArtist(data);
  return addDoc(artistsCol, {
    name: n.name,
    birthYear: n.birthYear ?? null,
    deathYear: n.deathYear ?? null,
    gender: n.gender,
    genre: n.genre,
    instrument: n.instrument ?? "",
    sjangre: n.sjangre,
    undersjangre: n.undersjangre,
    influenceStart: n.influenceStart ?? null,
    influenceEnd: n.influenceEnd ?? null,
    description: n.description ?? "",
    keyWorks: n.keyWorks,
    kilder: n.kilder,
    imageUrl: n.imageUrl,
    imageCredit: n.imageCredit,
    geography: n.geography ?? "",
    musicExamples: n.musicExamples ?? [],
    proposedBy: n.proposedBy ?? "Anonym",
    status: data.status === "active" ? "active" : "pending",
    removedBy: null,
    teacherProtected: false,
    teacherChecked: n.teacherChecked || false,
    priority: n.priority || 0,
    votedOutBy: [],
    votedUpBy: [],
    addedYear: new Date().getFullYear(),
    createdAt: serverTimestamp(),
  });
}

// Stem ut et forslag ("ikke relevant"). Auto-fjernes ved nådd terskel.
// Bruker transaksjon for å lese fersk tilstand og unngå kappløp.
export async function voteOut(artistId, clientId, threshold) {
  const ref = doc(db, "artists", artistId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const a = snap.data();
    const voters = new Set(a.votedOutBy || []);
    voters.add(clientId);
    const votedOutBy = [...voters];

    const update = { votedOutBy };
    // Auto-fjern bare hvis ikke lærer-beskyttet og terskel nådd
    if (!a.teacherProtected && votedOutBy.length >= threshold) {
      update.status = "removed";
      update.removedBy = "votes";
    }
    tx.update(ref, update);
  });
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

// Angre egen utstemming
export async function undoVoteOut(artistId, clientId) {
  const ref = doc(db, "artists", artistId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const a = snap.data();
    const votedOutBy = (a.votedOutBy || []).filter((id) => id !== clientId);

    const update = { votedOutBy };
    // Hvis forslaget var fjernet av stemmer og nå er under terskel, gjenåpne
    if (a.removedBy === "votes") {
      update.status = "active";
      update.removedBy = null;
    }
    tx.update(ref, update);
  });
}

// ----------------------------------------------------------------------------
//  LÆRERHANDLINGER (krever lærerkode i appen)
// ----------------------------------------------------------------------------

// Lærer fjerner et forslag (veto)
export async function teacherRemove(artistId) {
  const ref = doc(db, "artists", artistId);
  return setDoc(
    ref,
    { status: "removed", removedBy: "teacher" },
    { merge: true }
  );
}

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

// Lærer gjenoppretter et fjernet forslag og beskytter det mot ny auto-fjerning
export async function teacherRestore(artistId) {
  const ref = doc(db, "artists", artistId);
  return setDoc(
    ref,
    { status: "active", removedBy: null, teacherProtected: true },
    { merge: true }
  );
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

// Slett alle artister (full reset)
export async function deleteAllArtists() {
  const snapshot = await getDocs(artistsCol);
  const deletes = snapshot.docs.map(d => deleteDoc(d.ref));
  return Promise.all(deletes);
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

export function subscribeSubgenres(callback) {
  return onSnapshot(subgenresCol, (snapshot) => {
    const subs = {};
    snapshot.docs.forEach((d) => { subs[d.id] = { id: d.id, ...d.data() }; });
    callback(subs);
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

export async function saveSubgenreDesc(subgenreId, data) {
  return setDoc(doc(db, "subgenres", subgenreId), data, { merge: true });
}

export async function deleteSubgenreDesc(subgenreId) {
  return deleteDoc(doc(db, "subgenres", subgenreId));
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
export async function addPendingEdit({ entityType, entityId, entityName, proposedFields, proposedBy }) {
  return addDoc(pendingEditsCol, {
    entityType,
    entityId,
    entityName: entityName || "",
    proposedFields: proposedFields || {},
    proposedBy: proposedBy || "Anonym",
    createdAt: serverTimestamp(),
  });
}

// Lærer godkjenner valgte felter. `approvedKeys` er liste over feltnøklene
// fra `proposedFields` som skal skrives til target-entiteten. Sletter alltid
// hele `pendingEdit`-dokumentet etter behandling.
export async function approvePendingEdit(pendingEditId, approvedKeys) {
  const editRef = doc(db, "pendingEdits", pendingEditId);
  const snap = await getDoc(editRef);
  if (!snap.exists()) return;
  const data = snap.data();

  const toApply = {};
  for (const k of approvedKeys || []) {
    if (k in (data.proposedFields || {})) toApply[k] = data.proposedFields[k];
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
    case "subgenre":       return doc(db, "subgenres", entityId);
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
