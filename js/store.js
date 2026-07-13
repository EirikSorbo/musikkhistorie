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
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  onSnapshot,
  arrayUnion,
  arrayRemove,
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

import { firebaseConfig } from "./firebase-config.js?v=3.29";
import { DEFAULT_CONFIG } from "./limits.js?v=3.29";
import { isMainGenre } from "./genealogy.js?v=3.29";
import { normalizeArtist, buildArtistDoc } from "./artist-normalize.js?v=3.29";
import { normalizeConfig } from "./config-normalize.js?v=3.29";
import { PROPOSABLE_KEYS } from "./proposal-fields.js?v=3.29";

// Normaliserings-/bygge-logikken bor i artist-normalize.js og
// config-normalize.js (rene moduler, enhetstestbare); re-eksporteres her så
// eksisterende importer fortsatt virker.
export { normalizeArtist, buildArtistDoc, normalizeConfig };

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
// Koblingsbeskrivelser (strekene i slektstreet). Doc-ID = edgeKey(fra, til),
// f.eks. "blues__jazz" — se GENEALOGY_EDGES/edgeKey i genealogy.js.
const edgeDescsCol = collection(db, "edgeDescriptions");
const podcastsCol = collection(db, "podcasts");
const techCol = collection(db, "tech");
const pendingEditsCol = collection(db, "pendingEdits");
// Innholdssider (Om historie, Røtter) og varmekartet — se INNHOLD-seksjonen.
const contentCol = collection(db, "content");
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

// Lytter på konfigurasjon. Bruker standardconfig til læreren lagrer egen.
// Callback får (config, meta): meta.fallback er true når lesingen FEILET og
// configen bare er standardverdier — da må admin-lagring blokkeres, ellers
// kan et påfølgende lagre overskrive lærerens ekte config med standard.
// (At dokumentet ikke finnes ennå er derimot ikke en feil — da ER standard
// den reelle configen.)
export function subscribeConfig(callback) {
  return onSnapshot(configRef, (snap) => {
    if (!snap.exists()) {
      callback({ ...DEFAULT_CONFIG }, { fallback: false });
    } else {
      callback({ ...DEFAULT_CONFIG, ...normalizeConfig(snap.data()) }, { fallback: false });
    }
  }, (err) => {
    console.error("Kunne ikke lese konfig – sjekk Firestore-regler:", err.code, err.message);
    document.dispatchEvent(new CustomEvent("firestore-error", { detail: err }));
    callback({ ...DEFAULT_CONFIG }, { fallback: true, error: err });
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

// Firestore-dokumentet bygges av buildArtistDoc (artist-normalize.js);
// serverTimestamp() kan ikke lages i den rene modulen, så det legges på her.
function artistDocWithTimestamp(data) {
  return { ...buildArtistDoc(data), createdAt: serverTimestamp() };
}

// Legg inn et nytt forslag. Normaliserer inn til ny modell før skriving.
export async function addArtist(data) {
  return addDoc(artistsCol, artistDocWithTimestamp(data));
}

// Firestore tillater maks 500 operasjoner per batch.
const BATCH_LIMIT = 500;

// Legg inn mange artister på én gang (import). Batchet — dramatisk raskere
// enn å skrive ett og ett dokument.
export async function addArtistsBulk(list) {
  for (let i = 0; i < list.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const data of list.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(artistsCol), artistDocWithTimestamp(data));
    }
    await batch.commit();
  }
  return list.length;
}

// Stem frem et forslag ("svært relevant"). Identiteten hentes internt
// (uid fra anonym innlogging) — reglene avviser alt annet enn egen uid.
// arrayUnion er atomisk på serversiden: ingen transaksjon/retry ved mange
// samtidige stemmer, og et gjentatt klikk (uid allerede i lista) blir en
// ekte no-op i stedet for en falsk feilmelding.
export async function voteUp(artistId) {
  const clientId = await voteIdentity();
  return updateDoc(doc(db, "artists", artistId), { votedUpBy: arrayUnion(clientId) });
}

// Angre positiv stemme (arrayRemove fjerner kun egen uid, atomisk).
export async function undoVoteUp(artistId) {
  const clientId = await voteIdentity();
  return updateDoc(doc(db, "artists", artistId), { votedUpBy: arrayRemove(clientId) });
}

// ----------------------------------------------------------------------------
//  LÆRERHANDLINGER (krever lærerkode i appen)
// ----------------------------------------------------------------------------

// Lærer godkjenner et ventende forslag. updateDoc (ikke setDoc+merge) feiler
// med not-found hvis dokumentet er slettet i mellomtiden, i stedet for å
// gjenopplive det som et tomt spøkelsesdokument (f.eks. ved to lærer-faner).
export async function teacherApprove(artistId) {
  return updateDoc(doc(db, "artists", artistId), { status: "active" });
}

// Lærer avviser et ventende forslag
export async function teacherReject(artistId) {
  return updateDoc(doc(db, "artists", artistId), { status: "removed", removedBy: "teacher" });
}

// Sett prioritetsnivå (3=viktigst, 2=viktig, 1=mindre viktig, 0=ingen)
export async function setArtistPriority(artistId, level) {
  return updateDoc(doc(db, "artists", artistId), { priority: level });
}

// Lærer sletter et forslag permanent
export async function teacherDelete(artistId) {
  return deleteDoc(doc(db, "artists", artistId));
}

// Oppdater enkeltfelt på en eksisterende artist (brukt av merge-import).
export async function updateArtistFields(artistId, fields) {
  return updateDoc(doc(db, "artists", artistId), fields);
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

export function subscribeEdgeDescs(callback) {
  return onSnapshot(edgeDescsCol, (snapshot) => {
    const m = {};
    snapshot.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
    callback(m);
  }, (err) => console.error("Kunne ikke lese koblingsbeskrivelser (sjekk Firestore-regler):", err.message));
}

// Lagrer beskrivelsen for én kobling (strek i treet). updatedAt som ISO-streng
// (ikke serverTimestamp) så feltet overlever JSON-eksport → import uten å
// endre type — samme regel som story-feltet.
export async function saveEdgeDesc(edgeId, data) {
  return setDoc(doc(db, "edgeDescriptions", edgeId),
    { ...data, updatedAt: new Date().toISOString() }, { merge: true });
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

// Import-oppdatering av eksisterende episode (matchet på tittel i importen).
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

// Skriver mange dokumenter til én samling i batch (merge-set), i stedet for
// én og én skriving — dramatisk raskere ved import. entries = [{ id, data }].
// Returnerer antall skrevne dokumenter.
export async function saveDocsBulk(collectionName, entries) {
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const { id, data } of entries.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, collectionName, String(id)), data, { merge: true });
    }
    await batch.commit();
  }
  return entries.length;
}

// Skriver beskrivelse for ETT nivå (meta/main/sub) — resten av dokumentet
// (andre nivåer) beholdes via merge.
export async function saveGenreDescLevel(genreId, level, data) {
  return setDoc(doc(db, "genreDescriptions", genreId), { [level]: data }, { merge: true });
}

// Engangs-opprydding (idempotent): hovedsjanger-beskrivelsene på meta-nivå er
// pensjonert (v2.99) — de dekkes nå av sjangerhistoriene. Fjern det døde
// `meta`-feltet fra genreDescriptions-dokumentene. RØRER KUN `meta`; `main`,
// `sub`, `story` (og alt annet) står urørt — Blues/Jazz osv. er både meta OG
// main. Dokumenter uten `meta` hoppes over, så den kan trygt kjøre ved hver
// lærer-oppstart. Returnerer antall opprydda dokumenter.
export async function purgeMetaGenreDescs() {
  const snapshot = await getDocs(genreDescsCol);
  const withMeta = snapshot.docs.filter((d) => d.data().meta !== undefined);
  if (!withMeta.length) return 0;
  await Promise.all(withMeta.map((d) => updateDoc(d.ref, { meta: deleteField() })));
  console.info(
    `Fjernet dødt meta-felt fra ${withMeta.length} genreDescriptions-dokument(er):`,
    withMeta.map((d) => d.id)
  );
  return withMeta.length;
}

// Engangs-opprydding (idempotent): de gamle FLATE `description`/`kilder`-feltene
// er døde. Appen leser KUN nivåfeltene (meta/main/sub) via resolveDesc — aldri
// de flate (se genre-descriptions.js). De ble liggende igjen fra den
// opprinnelige flate datamodellen og dupliserer nivåteksten/-kildene (noen har
// alt DIVERGERT, f.eks. Gospel/R&B). En tidligere cleanupFlatGenreDescs (v2.69)
// gjorde det samme, men ble fjernet (v2.73) og feltene krøp tilbake da gamle
// backuper ble importert — derfor lukker eksport/import nå også hullet. Fjern
// de flate feltene KUN fra dokumenter som har et nivåfelt (main eller sub), så
// ingen tekst går tapt: et evt. umigrert flat-ONLY-dokument røres ikke —
// importen migrerer det til riktig nivå i stedet. Idempotent: kan trygt kjøre
// ved hver lærer-oppstart. Returnerer antall opprydda dokumenter.
export async function purgeFlatGenreDescs() {
  const snapshot = await getDocs(genreDescsCol);
  const stale = snapshot.docs.filter((d) => {
    const x = d.data();
    const hasLevel = x.main !== undefined || x.sub !== undefined;
    const hasFlat = x.description !== undefined || x.kilder !== undefined;
    return hasLevel && hasFlat;
  });
  if (!stale.length) return 0;
  await Promise.all(stale.map((d) => updateDoc(d.ref, { description: deleteField(), kilder: deleteField() })));
  console.info(
    `Fjernet døde flate description/kilder-felt fra ${stale.length} genreDescriptions-dokument(er):`,
    stale.map((d) => d.id)
  );
  return stale.length;
}

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING: rydder LÆRER-VEDTATTE duplikat-/foreldreløse sjanger-
//  dokumenter og slår «Electronic» sammen i tre-noden «Elektronika» (godkjent
//  2026-07-13). Guardet av et flagg i config/migrations → kjører NØYAKTIG ÉN
//  gang og gjeninnfører seg aldri om læreren senere legger inn en av sjangrene
//  på nytt. Idempotent uansett (sletting av borte-dokument = no-op). Sletter
//  INGEN tre-node-beskrivelse: alle mål er verifisert 0-refererte undersjanger-
//  dokumenter uten node. Logger alt slettet innhold FØR sletting, så det kan
//  gjenopprettes fra konsollen eller en backup. B1/B2 (Blues Rock, Trance/DnB)
//  er BEVISST utelatt — de er node-labels som løser rett via treet.
// ---------------------------------------------------------------------------
const GENRE_CLEANUP_FLAG = "genreDuplicateCleanup_2026_07";

// «Electronic» (fri undersjanger, 6 artister) slås sammen i «Elektronika»:
// artistenes tagg døpes om, og det foreldreløse «Electronic»-dokumentet slettes
// under (Elektronika beholder sin egen beskrivelse — merge-valget).
const GENRE_TAG_RENAMES = [["Electronic", "Elektronika"]];

// 23 dokumenter uten node OG uten artist-referanse (etter omdøpingen over):
// 7 variant-duplikater + «Electronic» + 15 rene foreldreløse.
const GENRE_DOCS_TO_DELETE = [
  "country blues", "Neo soul", "NuJazz", "Psykedelisk rock", "Electronica jazz",
  "Electronica", "Elektronisk musikk", "Electronic",
  "Afroamerikansk populærmusikk", "Alternative country", "Blues revival",
  "Country folk", "Crossover", "Dixieland", "Electro house", "Funk jazz",
  "Jazz rap", "M-Base", "Neoclassicism", "New school hip-hop", "No Wave",
  "Vaudeville blues", "World music",
];

// Bytter gamle sjangernavn i en tagg-liste og fjerner duplikater underveis.
function renameTagsInList(list, renames) {
  if (!Array.isArray(list)) return { changed: false, value: list };
  let changed = false;
  const out = [];
  for (const v of list) {
    let nv = v;
    for (const [from, to] of renames) if (v === from) { nv = to; changed = true; }
    if (out.includes(nv)) changed = true; else out.push(nv);
  }
  return { changed, value: out };
}

// Døper om sjanger-tagger på tvers av ALLE artist-felt (mainGenre/subGenre/
// metaGenre) i batch. Delt av opprydding- og label-justering-migreringene.
// Returnerer antall endrede artister.
async function renameArtistGenreTags(renames) {
  const artistSnap = await getDocs(artistsCol);
  let renamed = 0;
  for (let i = 0; i < artistSnap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    let has = false;
    for (const d of artistSnap.docs.slice(i, i + BATCH_LIMIT)) {
      const a = d.data();
      const upd = {};
      const mg = renameTagsInList(a.mainGenre, renames);
      const sg = renameTagsInList(a.subGenre, renames);
      let meta = a.metaGenre;
      for (const [from, to] of renames) if (meta === from) meta = to;
      if (mg.changed) upd.mainGenre = mg.value;
      if (sg.changed) upd.subGenre = sg.value;
      if (meta !== a.metaGenre) upd.metaGenre = meta;
      if (Object.keys(upd).length) { batch.update(d.ref, upd); has = true; renamed++; }
    }
    if (has) await batch.commit();
  }
  return renamed;
}

export async function runGenreDuplicateCleanup() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[GENRE_CLEANUP_FLAG]) return { skipped: true };

  // 1) Døp om artist-tagger (Electronic → Elektronika) på tvers av alle felt.
  const renamed = await renameArtistGenreTags(GENRE_TAG_RENAMES);

  // 2) Slett de vedtatte dokumentene. Logg innholdet FØR sletting.
  const gdSnap = await getDocs(genreDescsCol);
  const byId = Object.fromEntries(gdSnap.docs.map((d) => [d.id, d.data()]));
  const deleting = GENRE_DOCS_TO_DELETE.filter((id) => id in byId);
  if (deleting.length) {
    console.info("Sjangeropprydding — sletter dokumenter (innhold logget for gjenoppretting):",
      Object.fromEntries(deleting.map((id) => [id, byId[id]])));
    for (let i = 0; i < deleting.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const id of deleting.slice(i, i + BATCH_LIMIT)) batch.delete(doc(db, "genreDescriptions", id));
      await batch.commit();
    }
  }

  await setDoc(migRef, { [GENRE_CLEANUP_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Sjangeropprydding fullført: «Electronic»→«Elektronika» på ${renamed} artist(er), ${deleting.length} duplikat/foreldreløse dokument(er) slettet.`);
  return { renamed, deleted: deleting.length };
}

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING (v3.26): retter node-label ↔ doc-id for `bluesrock`.
//  Noden har nå `l = f = «Blues rock»` (=doc-id) i genealogy.js, så rediger-
//  knappen (som bruker n.l som doc-id) treffer riktig dokument. Her døpes
//  artist-taggen «Blues Rock»→«Blues rock» så den fortsatt matcher noden.
//  Idempotent (ingen gammel tagg igjen → no-op). (Trance håndteres av doc-id-
//  migreringen under — se [[pensum-genre-source-of-truth]].)
// ---------------------------------------------------------------------------
const GENRE_LABEL_ALIGN_FLAG = "genreLabelAlign_2026_07";
const GENRE_LABEL_ALIGN_RENAMES = [
  ["Blues Rock", "Blues rock"],
];

export async function runGenreLabelAlignment() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[GENRE_LABEL_ALIGN_FLAG]) return { skipped: true };

  const renamed = await renameArtistGenreTags(GENRE_LABEL_ALIGN_RENAMES);

  await setDoc(migRef, { [GENRE_LABEL_ALIGN_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Node-label-justering fullført: ${renamed} artist(er) fikk «Blues Rock»→«Blues rock».`);
  return { renamed };
}

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING (v3.27): Trance-noden beholder en KORT tre-label «Trance &
//  DnB» (l), men fullnavnet (f) forblir «Trance & drum'n'bass» (modal-tittel).
//  For at rediger-knappen (n.l = doc-id) skal treffe, flyttes beskrivelsen fra
//  det gamle doc-id-et «Trance & drum'n'bass» til det nye «Trance & DnB», og
//  artist-taggen døpes om (fra begge tidligere skrivemåter — «Trance / DnB»
//  ELLER «Trance & drum'n'bass», avhengig av om v3.26 alt kjørte). Doc-ID kan
//  ikke ha «/», derfor «&». Flagg-guardet, idempotent. Se
//  [[pensum-genre-source-of-truth]].
// ---------------------------------------------------------------------------
const TRANCE_DOCID_FLAG = "tranceDocIdRename_2026_07";
const TRANCE_OLD_DOC = "Trance & drum'n'bass";
const TRANCE_NEW_DOC = "Trance & DnB";
const TRANCE_TAG_RENAMES = [
  ["Trance / DnB", TRANCE_NEW_DOC],
  ["Trance & drum'n'bass", TRANCE_NEW_DOC],
];

export async function runTranceDocIdMigration() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[TRANCE_DOCID_FLAG]) return { skipped: true };

  // 1) Flytt beskrivelsen til det nye korte doc-id-et (= nodens label). Dropp
  //    evt. gjenværende døde flate felt så det nye dokumentet fødes rent.
  const oldRef = doc(db, "genreDescriptions", TRANCE_OLD_DOC);
  const oldSnap = await getDoc(oldRef);
  let moved = false;
  if (oldSnap.exists()) {
    const { description: _d, kilder: _k, ...clean } = oldSnap.data();
    await setDoc(doc(db, "genreDescriptions", TRANCE_NEW_DOC), clean, { merge: true });
    await deleteDoc(oldRef);
    moved = true;
  }

  // 2) Døp om artist-taggen (uansett tidligere skrivemåte) til det nye navnet.
  const renamed = await renameArtistGenreTags(TRANCE_TAG_RENAMES);

  await setDoc(migRef, { [TRANCE_DOCID_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Trance-doc-id-migrering: ${moved ? "«Trance & drum'n'bass» → «Trance & DnB»" : "ingen doc å flytte"}, ${renamed} artist-tagg omdøpt.`);
  return { moved, renamed };
}

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING (v3.28): etternølere fra label-omdøpingene + to funn fra
//  duplikat-revisjonen 2026-07-14. Flagg-guardet, idempotent, logger alt
//  innhold FØR sletting/flytting (gjenopprettbart fra konsollen).
//   a) Varmekartet: radnøklene fulgte IKKE med da tre-labelene ble døpt om i
//      v3.26/3.27 («Blues Rock»→«Blues rock», «Trance / DnB»→«Trance & DnB»).
//      Oppslaget er case-sensitivt på label (vkRow i explore.js), så begge
//      sjangrene viste «ingen data» mens nivåene lå bak døde nøkler — og
//      onHeatEdit sprer gamle nøkler videre ved hver lagring. Finnes den nye
//      nøkkelen alt (læreren har redigert etter omdøpingen), vinner den, og
//      den gamle raden slettes uansett.
//   b) «Outlaw country».main: død, divergert skygge-kopi — visningen løser
//      alltid label-dokumentet «Outlaw» først (resolveDescAny [l, f]), og
//      redigering skriver dit. Feltet slettes KUN når «Outlaw» faktisk har en
//      main-tekst (ellers flyttes teksten dit — invarianten doc-id = n.l).
//      Sub-feltet består (brukes av subGenre-taggen «Outlaw country»).
//   c) «Rock»: dokumentet hadde KUN sub-tekst — unåelig fra all UI («Rock»
//      brukes ikke som subGenre-tagg), mens tre-noden viste «mangler» fordi
//      main var tom. Teksten ER en sjangerbeskrivelse → flyttes sub→main.
//      Har main fått tekst i mellomtiden, røres ingenting (logges i stedet).
// ---------------------------------------------------------------------------
const CONTENT_KEY_ALIGN_FLAG = "contentKeyAlignment_2026_07";
const VARMEKART_KEY_RENAMES = [
  ["Blues Rock", "Blues rock"],
  ["Trance / DnB", "Trance & DnB"],
];

export async function runContentKeyAlignment() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[CONTENT_KEY_ALIGN_FLAG]) return { skipped: true };

  // a) Varmekart-nøkler. Hele dokumentet skrives (samme policy som
  //    saveVarmekart: full overskriving — feltstier er utrygge med «/» i navn).
  let heatRenamed = 0;
  const vkRef = doc(db, "content", "varmekart");
  const vkSnap = await getDoc(vkRef);
  if (vkSnap.exists() && vkSnap.data().heat) {
    const heat = { ...vkSnap.data().heat };
    for (const [oldKey, newKey] of VARMEKART_KEY_RENAMES) {
      if (!(oldKey in heat)) continue;
      console.info(`Innholdsnøkkel-justering — varmekartrad «${oldKey}» (logget for gjenoppretting):`, heat[oldKey]);
      if (!(newKey in heat)) heat[newKey] = heat[oldKey];
      delete heat[oldKey];
      heatRenamed++;
    }
    if (heatRenamed) await setDoc(vkRef, { heat, updatedAt: new Date().toISOString() });
  }

  // b) «Outlaw country».main — slett skygge-kopien (eller flytt den til
  //    label-dokumentet hvis det mot formodning skulle stå uten main-tekst).
  let outlaw = "uendret";
  const ocRef = doc(db, "genreDescriptions", "Outlaw country");
  const ocSnap = await getDoc(ocRef);
  if (ocSnap.exists() && ocSnap.data().main !== undefined) {
    console.info("Innholdsnøkkel-justering — «Outlaw country».main (logget for gjenoppretting):", ocSnap.data().main);
    const oRef = doc(db, "genreDescriptions", "Outlaw");
    const oSnap = await getDoc(oRef);
    if (!(oSnap.exists() && oSnap.data().main && oSnap.data().main.description)) {
      await setDoc(oRef, { main: ocSnap.data().main }, { merge: true });
      outlaw = "flyttet til «Outlaw»";
    } else {
      outlaw = "slettet (skygget av «Outlaw»)";
    }
    await updateDoc(ocRef, { main: deleteField() });
  }

  // c) «Rock»: sub → main.
  let rock = "uendret";
  const rockRef = doc(db, "genreDescriptions", "Rock");
  const rockSnap = await getDoc(rockRef);
  if (rockSnap.exists() && rockSnap.data().sub && rockSnap.data().sub.description) {
    const hasMain = rockSnap.data().main && rockSnap.data().main.description;
    if (hasMain) {
      rock = "hoppet over (main finnes alt — sub beholdt, vurder manuelt)";
      console.info("Innholdsnøkkel-justering — «Rock» har BÅDE main og sub; ingenting flyttet:", rockSnap.data());
    } else {
      console.info("Innholdsnøkkel-justering — flytter «Rock».sub → main:", rockSnap.data().sub);
      await setDoc(rockRef, { main: rockSnap.data().sub }, { merge: true });
      await updateDoc(rockRef, { sub: deleteField() });
      rock = "sub flyttet til main";
    }
  }

  await setDoc(migRef, { [CONTENT_KEY_ALIGN_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Innholdsnøkkel-justering fullført: ${heatRenamed} varmekartrad(er) omdøpt, Outlaw country.main ${outlaw}, Rock ${rock}.`);
  return { heatRenamed, outlaw, rock };
}

// Sjangerhistoriene («Sjangerhistorier» i Det store bildet) lagres som
// story-felt på hovedsjangerens genreDescriptions-dokument — samme
// Firestore-regler og eksport/import som beskrivelsene, ingen egen samling.
// updatedAt som ISO-streng (ikke serverTimestamp) så feltet overlever
// JSON-eksport → import uten å endre type.
export async function saveStoryBody(genreId, body) {
  return setDoc(doc(db, "genreDescriptions", genreId),
    { story: { body, updatedAt: new Date().toISOString() } }, { merge: true });
}

// Sletter historien. Det finnes ingen standardtekst i koden, så historien
// vises som manglende til ny tekst lagres eller importeres. updateDoc feiler
// om dokumentet ikke finnes, men da finnes heller ingen tekst å slette;
// kalleren kan trygt ignorere det.
export async function clearStory(genreId) {
  return updateDoc(doc(db, "genreDescriptions", genreId), { story: deleteField() });
}

// ----------------------------------------------------------------------------
//  INNHOLD (content-samlingen): innholdssidene «Om historie» (omHistorie) og
//  «Røtter før 1910» (rotter) som markdown-light-body, og varmekartets
//  varmenivåer (varmekart.heat = { sjanger: [13 nivåer 0–5 eller null] }).
//  Alt pensuminnhold bor i Firestore — ingen fallback-tekster i koden.
// ----------------------------------------------------------------------------

export function subscribeContent(callback) {
  return onSnapshot(contentCol, (snapshot) => {
    const content = {};
    snapshot.docs.forEach((d) => { content[d.id] = d.data(); });
    callback(content);
  }, (err) => {
    console.error("Kunne ikke lese innhold (sjekk Firestore-regler):", err.code, err.message);
    document.dispatchEvent(new CustomEvent("firestore-error", { detail: err }));
  });
}

// Lagrer en innholdsside (editor og import). updatedAt fra data beholdes ved
// import (så backupens tidsstempel overlever), ellers settes nå-tidspunktet.
export async function savePage(pageId, data) {
  return setDoc(doc(db, "content", pageId),
    { ...data, updatedAt: data.updatedAt || new Date().toISOString() });
}

// Sletter en innholdsside — vises som manglende til ny tekst lagres/importeres.
export async function deletePage(pageId) {
  return deleteDoc(doc(db, "content", pageId));
}

// Lagrer HELE varmekartet (full overskriving, ikke merge): sjangernavn kan
// inneholde tegn som er kronglete i felt-stier (f.eks. «Trance / DnB»), og
// radene er små — å skrive hele dokumentet er enklest og trygt.
export async function saveVarmekart(heat) {
  return setDoc(doc(db, "content", "varmekart"),
    { heat, updatedAt: new Date().toISOString() });
}

// Lærer lagrer hele konfigurasjonen (full overskriving, så fjernede
// per-tiår/per-sjanger-grenser ikke blir liggende igjen).
export async function updateConfig(config) {
  return setDoc(configRef, config);
}

// ----------------------------------------------------------------------------
//  ENDRINGSFORSLAG (studentenes foreslåtte endringer på eksisterende kort)
// ----------------------------------------------------------------------------

// Engangs-henting av alle åpne endringsforslag. Studentsiden bruker denne når
// forslags-editoren åpnes, i stedet for å holde et sanntidsabonnement på hele
// samlingen bare for å låse «Foreslå endring»-knappen.
export async function fetchPendingEdits() {
  const snapshot = await getDocs(pendingEditsCol);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

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

  // Hviteliste: kun felter som lovlig kan foreslås for denne entityType-en
  // slipper gjennom. Stopper at et pendingEdit smugler privilegiefelter
  // (status, priority, votedUpBy, teacherChecked …) inn i måldokumentet via en
  // lærer som godkjenner uvitende.
  const allowed = PROPOSABLE_KEYS[data.entityType] || [];
  let toApply = {};
  for (const k of approvedKeys || []) {
    if (allowed.includes(k) && k in (data.proposedFields || {})) toApply[k] = data.proposedFields[k];
  }

  // Sjangerbeskrivelser er nivådelte ({ meta/main/sub: { description, … } });
  // et flatt description-felt leses ikke av appen. Pakk derfor inn i riktig nivå.
  if (data.entityType === "subgenre" && Object.keys(toApply).length) {
    toApply = { [genreEditLevel(data)]: toApply };
  }

  const targetRef = pendingEditTargetRef(data.entityType, data.entityId);
  if (targetRef && Object.keys(toApply).length) {
    // artist/tech MÅ finnes fra før — ellers ville merge opprettet et tomt
    // spøkelsesdokument (uten navn/status) hvis forslaget godkjennes etter at
    // målet er slettet. genreDescriptions/decades kan derimot opprettes ved
    // første beskrivelse, så der er merge riktig.
    const mustExist = data.entityType === "artist" || data.entityType === "tech";
    if (mustExist) {
      const targetSnap = await getDoc(targetRef);
      if (!targetSnap.exists()) { await deleteDoc(editRef); return; }
    }
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
  return updateDoc(doc(db, "tech", techId), { status: "active" });
}

const teacherChecksRef = doc(db, "config", "teacherChecks");

export function subscribeTeacherChecks(callback) {
  return onSnapshot(teacherChecksRef, (snap) => {
    callback(snap.exists() ? snap.data() : { genres: [], subgenres: [] });
  }, (err) => console.error("Kunne ikke lese teacherChecks (sjekk Firestore-regler):", err.message));
}

export async function setTeacherChecks(data) {
  return setDoc(teacherChecksRef, data, { merge: true });
}

// Signal til den innebygde last-vakten (i HTML) om at datalaget — og dermed
// Firebase-SDK fra gstatic — faktisk lastet. Blir dette flagget aldri satt
// (f.eks. brannmur/captive portal blokkerer gstatic), viser vakten en
// forklarende melding i stedet for en død side.
if (typeof window !== "undefined") window.__pensumReady = true;
