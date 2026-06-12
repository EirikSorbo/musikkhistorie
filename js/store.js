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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const artistsCol = collection(db, "artists");
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
    const artists = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(artists);
  });
}

// Lytter på konfigurasjon. Bruker standardgrenser til læreren lagrer egne.
// (Vi skriver ikke her – config-skriving krever lærer-innlogging.)
export function subscribeConfig(callback) {
  return onSnapshot(configRef, (snap) => {
    if (!snap.exists()) {
      callback({ ...DEFAULT_CONFIG });
    } else {
      callback({ ...DEFAULT_CONFIG, ...snap.data() });
    }
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

// Legg inn et nytt forslag
export async function addArtist(data) {
  return addDoc(artistsCol, {
    name: data.name,
    birthYear: data.birthYear ?? null,
    gender: data.gender,
    genre: data.genre,
    instrument: data.instrument ?? "",
    influenceStart: data.influenceStart ?? null,
    influenceEnd: data.influenceEnd ?? null,
    description: data.description ?? "",
    keyWorks: data.keyWorks ?? "",
    geography: data.geography ?? "",
    links: data.links ?? [],
    proposedBy: data.proposedBy ?? "Anonym",
    status: "active",
    removedBy: null,
    teacherProtected: false,
    votedOutBy: [],
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

// Lærer gjenoppretter et fjernet forslag og beskytter det mot ny auto-fjerning
export async function teacherRestore(artistId) {
  const ref = doc(db, "artists", artistId);
  return setDoc(
    ref,
    { status: "active", removedBy: null, teacherProtected: true },
    { merge: true }
  );
}

// Lærer sletter et forslag permanent
export async function teacherDelete(artistId) {
  return deleteDoc(doc(db, "artists", artistId));
}

// Lærer lagrer hele konfigurasjonen (full overskriving, så fjernede
// per-tiår/per-sjanger-grenser ikke blir liggende igjen).
export async function updateConfig(config) {
  return setDoc(configRef, config);
}
