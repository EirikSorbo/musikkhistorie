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

import { firebaseConfig } from "./firebase-config.js?v=4.11";
import { isMainGenre } from "./genealogy.js?v=4.11";
import { normalizeArtist, buildArtistDoc } from "./artist-normalize.js?v=4.11";
import { PROPOSABLE_KEYS } from "./proposal-fields.js?v=4.11";
import { mergeHeatRows } from "./import-format.js?v=4.11";

// Normaliserings-/bygge-logikken bor i artist-normalize.js (ren modul,
// enhetstestbar) og importeres direkte der den trengs — store.js bruker den
// internt (subscribeArtists/buildArtistDoc).

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

// Én delt «innlogging pågår»-promise: oppstartens onAuthStateChanged og
// ensureAuth (fra voteUp/addArtist osv.) må ALDRI starte to parallelle
// signInAnonymously. Uten dedupen kan et stemmeklikk i vinduet før første
// innlogging er ferdig lage en NY anonym bruker → foreldreløs stemme-identitet
// (uid-en stemmen skrives med ≠ den som persisteres), som gir «har stemt» som
// aldri vises, umulig angre, og en reell dobbeltstemme. Nullstilles når kallet
// er ferdig, så en senere utlogging kan logge inn på nytt.
let signInInFlight = null;
function signInAnonymouslyOnce() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (!signInInFlight) {
    signInInFlight = signInAnonymously(auth)
      .then((cred) => cred.user)
      .finally(() => { signInInFlight = null; });
  }
  return signInInFlight;
}

// Hold nettleseren innlogget: logg inn anonymt ved oppstart og på nytt etter
// utlogging (en lærer som logger ut, får ny anonym økt automatisk).
if (AUTH_CONFIGURED) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymouslyOnce().catch((e) =>
        console.warn("Anonym innlogging utilgjengelig (aktiver «Anonymous» i Firebase Console → Authentication → Sign-in method):", e.code)
      );
    }
  });
}

// Venter på en innlogget bruker (anonym eller Google). Kaster hvis anonym
// innlogging ikke er aktivert — kalleren håndterer fallback.
async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  return signInAnonymouslyOnce();
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

// Delt feilhandler for sanntidslyttere: logg + varsle UI-et (banneret som
// wireFirestoreErrorBanner viser). Brukt av ALLE subscribe-funksjoner, så en
// avvist lesing (f.eks. stale publiserte regler på én samling) alltid gir
// synlig feil, ikke bare en konsoll-linje.
function onSubscribeError(what) {
  return (err) => {
    console.error(`Kunne ikke lese ${what} (sjekk Firestore-regler):`, err.code, err.message);
    document.dispatchEvent(new CustomEvent("firestore-error", { detail: err }));
  };
}

// Lytter på alle artister. Kaller callback hver gang noe endres.
export function subscribeArtists(callback) {
  return onSnapshot(artistsCol, (snapshot) => {
    const artists = snapshot.docs.map((d) => normalizeArtist({ id: d.id, ...d.data() }));
    callback(artists);
  }, onSubscribeError("artister"));
}

// Konfig-abonnementet er fjernet (v3.68): instrument-vokabularet — det siste
// som lå i config-dokumentet — er nå INSTRUMENTS-konstanten i limits.js,
// samme mønster som DECADES og sjangertreet. config/settings-dokumentet i
// Firestore leses ikke lenger og kan slettes manuelt.

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
// Sikrer anonym innlogging FØRST: feilet oppstarts-innlogging (forbigående
// nettfeil ved sidelast) fyrer aldri onAuthStateChanged på nytt, så uten dette
// ville økta forbli uinnlogget og hver innsending avvist av reglene til reload.
export async function addArtist(data) {
  await ensureAuth().catch(() => {});
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
  }, onSubscribeError("tiårsbeskrivelser"));
}

export function subscribeGenreDescs(callback) {
  return onSnapshot(genreDescsCol, (snapshot) => {
    const m = {};
    snapshot.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
    callback(m);
  }, onSubscribeError("sjangerbeskrivelser"));
}

export function subscribeEdgeDescs(callback) {
  return onSnapshot(edgeDescsCol, (snapshot) => {
    const m = {};
    snapshot.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
    callback(m);
  }, onSubscribeError("koblingsbeskrivelser"));
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
  }, onSubscribeError("podkaster"));
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
  }, onSubscribeError("tech"));
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

// Engangs-opprydding (idempotent): fjerner to døde felt-generasjoner fra
// genreDescriptions i ÉN lesning av samlingen (før: to separate getDocs av hele
// samlingen ved hver lærer-oppstart — unødvendig dobbelt lese-/oppstartskost):
//
//  (1) `meta`-feltet: metasjanger-beskrivelsene på meta-nivå er pensjonert
//      (v2.99), dekkes nå av sjangerhistoriene. RØRER KUN `meta`; `main`, `sub`,
//      `story` står urørt — Blues/Jazz osv. er både meta OG main.
//  (2) de FLATE `description`/`kilder`-feltene: appen leser KUN nivåfeltene
//      (meta/main/sub) via resolveDesc. Fjernes KUN fra dokumenter som har et
//      nivåfelt (main/sub), så ingen tekst går tapt — et umigrert flat-ONLY-
//      dokument røres ikke (importen migrerer det til riktig nivå i stedet).
//      Krøp tilbake da gamle backuper ble importert (v2.73), derfor lukker
//      eksport/import nå også hullet.
//
// Idempotent: kan trygt kjøre ved hver lærer-oppstart. Ett dokument med begge
// generasjonene ryddes i ÉN skriving. Returnerer { meta, flat }.
export async function purgeDeadGenreDescFields() {
  const snapshot = await getDocs(genreDescsCol);
  const ops = [];
  let meta = 0, flat = 0;
  for (const d of snapshot.docs) {
    const x = d.data();
    const patch = {};
    if (x.meta !== undefined) { patch.meta = deleteField(); meta++; }
    const hasLevel = x.main !== undefined || x.sub !== undefined;
    if (hasLevel && (x.description !== undefined || x.kilder !== undefined)) {
      patch.description = deleteField();
      patch.kilder = deleteField();
      flat++;
    }
    if (Object.keys(patch).length) ops.push(updateDoc(d.ref, patch));
  }
  if (ops.length) {
    await Promise.all(ops);
    console.info(`genreDescriptions-opprydding: fjernet dødt meta-felt fra ${meta}, flate description/kilder fra ${flat} dokument(er).`);
  }
  return { meta, flat };
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
//      Oppslaget er case-sensitivt på label (vkRow i explore-varmekart.js), så begge
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
  //    mergeVarmekartRows: full skriv — feltstier er utrygge med «/» i navn).
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

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING (v3.94): tre foreldreløse duplikater fra gamle navnebytter.
//  Etterslep etter at tre-nodene fikk korte labeler («Contemporary country» →
//  «Cont. country»): innholdet ble kopiert til det nye navnet, men de gamle
//  dokumentene/radene ble aldri ryddet bort. «Jazz (2)» er dessuten et navn som
//  aldri har eksistert i treet — en ren skrivefeil-tvilling av «Cont. jazz».
//
//  De er UNÅELIGE i appen: varmekartet slår opp på nodens label (heatRow), og
//  beskrivelsene løses via resolveDescAny([l, f]) der label-dokumentet alltid
//  vinner. De ligger altså bare og tærer på plassen — og verre: onHeatEdit
//  skriver hele heat-objektet tilbake, så de døde radene spres videre ved hver
//  lagring.
//
//  Verifisert mot live-data 2026-08-02 før migreringen ble skrevet: alle tre
//  main-beskrivelsene er TEGN FOR TEGN identiske med sine kanoniske dokumenter.
//  Migreringen sjekker det på nytt ved kjøring og lar dokumentet stå hvis
//  teksten har rukket å divergere — da er det ikke lenger et duplikat, og
//  sletting ville vært tap av innhold.
//
//  ÉN kjent forskjell: «Contemporary gospel» har i tillegg et sub-felt som
//  «Cont. gospel» ikke har. Ingen artist er tagget med den undersjangeren, så
//  teksten er uleselig i appen i dag. Den flyttes bevisst IKKE til
//  «Cont. gospel»: et sub-felt der ville skygget for main-teksten på samme navn
//  (den kjente shadowing-fella). Innholdet logges i sin helhet før sletting, så
//  det kan gjenopprettes fra konsollen om det viser seg å være verdt å beholde.
//
//  edgeDescriptions nevner de fulle navnene i løpende tekst — det er korrekt
//  prosa om sjangrene og røres ikke.
// ---------------------------------------------------------------------------
const ORPHAN_PURGE_FLAG = "orphanDuplicatePurge_2026_08";
// [foreldreløst dokument/rad, det kanoniske navnet det er en tvilling av]
const ORPHAN_DUPLICATES = [
  ["Contemporary country", "Cont. country"],
  ["Contemporary gospel", "Cont. gospel"],
  ["Jazz (2)", "Cont. jazz"],
];

export async function runOrphanDuplicatePurge() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[ORPHAN_PURGE_FLAG]) return { skipped: true };

  // a) genreDescriptions: slett dokumentet — men KUN når main-teksten fortsatt
  //    er identisk med den kanoniske. Har den divergert, er det ikke et
  //    duplikat lenger, og da beholdes dokumentet og avviket rapporteres.
  const docsDeleted = [], docsKept = [];
  for (const [orphan, canon] of ORPHAN_DUPLICATES) {
    const oRef = doc(db, "genreDescriptions", orphan);
    const oSnap = await getDoc(oRef);
    if (!oSnap.exists()) continue;
    const oData = oSnap.data();
    const cSnap = await getDoc(doc(db, "genreDescriptions", canon));
    const cText = cSnap.exists() ? cSnap.data()?.main?.description || "" : "";
    const oText = oData?.main?.description || "";
    if (oText && oText !== cText) {
      docsKept.push(`${orphan} (main avviker fra «${canon}» — ikke lenger et duplikat)`);
      console.warn(`Foreldreløs-opprydding — BEHOLDT «${orphan}»: main-teksten avviker fra «${canon}». Vurder manuelt.`, oData);
      continue;
    }
    // Hele dokumentet logges før sletting (gjenopprettbart fra konsollen) —
    // også evt. felt utover main, som sub-teksten på «Contemporary gospel».
    console.info(`Foreldreløs-opprydding — sletter «${orphan}» (hele dokumentet logget for gjenoppretting):`, JSON.stringify(oData));
    await deleteDoc(oRef);
    docsDeleted.push(orphan);
  }

  // b) content/varmekart: fjern de døde radene. Hele dokumentet skrives (samme
  //    policy som mergeVarmekartRows og nøkkel-justeringen over — feltstier er
  //    utrygge med tegn som «(» og «/» i nøkkelnavn).
  let heatRemoved = 0;
  const vkRef = doc(db, "content", "varmekart");
  const vkSnap = await getDoc(vkRef);
  if (vkSnap.exists() && vkSnap.data().heat) {
    const heat = { ...vkSnap.data().heat };
    for (const [orphan] of ORPHAN_DUPLICATES) {
      if (!(orphan in heat)) continue;
      console.info(`Foreldreløs-opprydding — varmekartrad «${orphan}» (logget for gjenoppretting):`, JSON.stringify(heat[orphan]));
      delete heat[orphan];
      heatRemoved++;
    }
    if (heatRemoved) await setDoc(vkRef, { heat, updatedAt: new Date().toISOString() });
  }

  await setDoc(migRef, { [ORPHAN_PURGE_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Foreldreløs-opprydding fullført: ${docsDeleted.length} beskrivelsesdokument(er) slettet (${docsDeleted.join(", ") || "ingen"}), ${heatRemoved} varmekartrad(er) fjernet.${docsKept.length ? " BEHOLDT: " + docsKept.join("; ") : ""}`);
  return { docsDeleted, docsKept, heatRemoved };
}

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING (v3.96): treet slanket etter pensumgjennomgangen.
//   a) «British invasion» slått inn i «Blues rock». Noden var en HENDELSE mer
//      enn en stilart, hadde bare to artister — John Mayall og Eric Clapton, som
//      BEGGE allerede sto i Blues rock — og lå under Blues selv om fenomenet
//      hører rocken til. Taggen fjernes derfor helt (ingen omdøping: den ville
//      gitt duplikater), og Blues rock arver rock'n'roll som forelder.
//   b) «Ragtime» er nå rot-node (g: null), ikke pensumsjanger. Den er ikke
//      lenger et gyldig mainGenre, så taggen flyttes NED til subGenre — teksten
//      «Ragtime» står fortsatt på Scott Joplin og Jelly Roll Morton, men som
//      undersjanger. Joplin ville ellers stått helt uten tre-sjanger og falt ut
//      i «Øvrige»-bøtta, så han får «Jazz» som mainGenre (Morton har den alt).
//
//  Begge sjangrene mister dermed sin plass i varmekartet, og radene deres blir
//  foreldreløse — de fjernes her, ellers spres de videre ved hver onHeatEdit.
//  «British invasion»-dokumentet og de tre koblingsbeskrivelsene som pekte på
//  noden blir uleselige og slettes; ALT logges først. Blues rock-teksten fortalte
//  allerede historien om den britiske bølgen, så beskrivelsen står seg.
//  «Ragtime»-dokumentet BEHOLDES: rot-noder viser beskrivelsen sin som før.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
//  UNDERSJANGER-SLETTING (2026-08-03, brukervalg)
// ---------------------------------------------------------------------------
//  «Neotraditional country» var et sub-dokument som bar det FULLE navnet til
//  tre-noden «Neotrad. country». De skygget for hverandre: en under-chip med
//  fullnavnet slo opp sub-teksten i stedet for nodens main-tekst. Artistene som
//  bar taggen er flyttet til mainGenre «Neotrad. country», så dokumentet står
//  igjen uten en eneste referanse.
//
//  Sikring: sletter KUN når (a) dokumentet ikke har en main-tekst — da er det
//  en tre-sjangerbeskrivelse og skal aldri røres her — og (b) ingen artist
//  fortsatt viser til navnet i mainGenre eller subGenre. Blir taggen lagt inn
//  igjen før migreringen rekker å kjøre, står dokumentet urørt og det logges.
//  Hele dokumentet logges før sletting, så det kan gjenopprettes fra konsollen.
// ---------------------------------------------------------------------------
const SUBGENRE_DELETE_FLAG = "subgenreDocDelete_2026_08";
const SUBGENRE_DOCS_TO_DELETE = ["Neotraditional country"];

export async function runSubgenreDocDelete() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[SUBGENRE_DELETE_FLAG]) return { skipped: true };

  // Én lesning av artistene, delt av alle navnene i lista.
  const artistSnap = await getDocs(artistsCol);
  const refererer = (navn) => {
    const n = String(navn).toLowerCase();
    return artistSnap.docs.filter((d) => {
      const a = d.data();
      return [...(a.mainGenre || []), ...(a.subGenre || [])].some((g) => String(g).toLowerCase() === n);
    }).map((d) => d.data().name);
  };

  const slettet = [], beholdt = [];
  for (const navn of SUBGENRE_DOCS_TO_DELETE) {
    const ref = doc(db, "genreDescriptions", navn);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const data = snap.data();
    if (data?.main?.description) {
      beholdt.push(`${navn} (har main-tekst — er en tre-sjangerbeskrivelse)`);
      console.warn(`Undersjanger-sletting — BEHOLDT «${navn}»: dokumentet har en main-tekst.`, data);
      continue;
    }
    const brukt = refererer(navn);
    if (brukt.length) {
      beholdt.push(`${navn} (${brukt.length} artist(er) bruker den fortsatt)`);
      console.warn(`Undersjanger-sletting — BEHOLDT «${navn}»: brukes av ${brukt.join(", ")}.`, data);
      continue;
    }
    console.info(`Undersjanger-sletting — sletter «${navn}» (hele dokumentet logget for gjenoppretting):`, JSON.stringify(data));
    await deleteDoc(ref);
    slettet.push(navn);
  }

  await setDoc(migRef, { [SUBGENRE_DELETE_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Undersjanger-sletting fullført: ${slettet.length} slettet (${slettet.join(", ") || "ingen"}), ${beholdt.length} beholdt.`);
  return { slettet, beholdt };
}

const TREE_SLIM_FLAG = "treeSlim_2026_08";
const TREE_SLIM_HEAT_ROWS = ["British invasion", "Ragtime"];
const TREE_SLIM_GENRE_DOCS = ["British invasion"];
const TREE_SLIM_EDGE_DOCS = ["chicagoblues__britinv", "rocknroll__britinv", "britinv__bluesrock"];

export async function runTreeSlim() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[TREE_SLIM_FLAG]) return { skipped: true };

  // a+b) Artist-taggene. Gjøres i ETT gjennomløp over artistene, så vi ikke
  //      skriver de samme dokumentene to ganger.
  const artistSnap = await getDocs(artistsCol);
  let tagged = 0;
  for (let i = 0; i < artistSnap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    let has = false;
    for (const d of artistSnap.docs.slice(i, i + BATCH_LIMIT)) {
      const a = d.data();
      const main0 = Array.isArray(a.mainGenre) ? a.mainGenre : [];
      const sub0 = Array.isArray(a.subGenre) ? a.subGenre : [];
      let main = main0.filter((g) => g !== "British invasion");
      let sub = sub0;
      if (main.includes("Ragtime")) {
        main = main.filter((g) => g !== "Ragtime");
        if (!sub.includes("Ragtime")) sub = [...sub, "Ragtime"];
        // Uten en gjenværende tre-sjanger faller artisten ut av tidslinjens og
        // varmekartets sjangerseksjoner. Ragtime hører jazzen til.
        if (!main.length) main = ["Jazz"];
      }
      const upd = {};
      if (main.length !== main0.length || main.some((g, j) => g !== main0[j])) upd.mainGenre = main;
      if (sub.length !== sub0.length) upd.subGenre = sub;
      if (Object.keys(upd).length) {
        console.info(`Tre-slanking — ${a.name}: mainGenre [${main0.join(", ")}] → [${main.join(", ")}]` +
          (upd.subGenre ? `, subGenre [${sub0.join(", ")}] → [${sub.join(", ")}]` : ""));
        batch.update(d.ref, upd);
        has = true;
        tagged++;
      }
    }
    if (has) await batch.commit();
  }

  // Varmekart-radene. Hele dokumentet skrives (samme policy som de andre
  // innholdsmigreringene — feltstier er utrygge med mellomrom i nøkkelnavn).
  let heatRemoved = 0;
  const vkRef = doc(db, "content", "varmekart");
  const vkSnap = await getDoc(vkRef);
  if (vkSnap.exists() && vkSnap.data().heat) {
    const heat = { ...vkSnap.data().heat };
    for (const key of TREE_SLIM_HEAT_ROWS) {
      if (!(key in heat)) continue;
      console.info(`Tre-slanking — varmekartrad «${key}» (logget for gjenoppretting):`, JSON.stringify(heat[key]));
      delete heat[key];
      heatRemoved++;
    }
    if (heatRemoved) await setDoc(vkRef, { heat, updatedAt: new Date().toISOString() });
  }

  // Beskrivelsene som ikke lenger kan nås fra noen flate.
  let docsRemoved = 0;
  for (const [col, ids] of [["genreDescriptions", TREE_SLIM_GENRE_DOCS], ["edgeDescriptions", TREE_SLIM_EDGE_DOCS]]) {
    for (const id of ids) {
      const ref = doc(db, col, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) continue;
      console.info(`Tre-slanking — sletter ${col}/${id} (innhold logget for gjenoppretting):`, JSON.stringify(snap.data()));
      await deleteDoc(ref);
      docsRemoved++;
    }
  }

  await setDoc(migRef, { [TREE_SLIM_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Tre-slanking fullført: ${tagged} artist(er) omtagget, ${heatRemoved} varmekartrad(er) fjernet, ${docsRemoved} beskrivelse(r) slettet.`);
  return { tagged, heatRemoved, docsRemoved };
}

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING (v3.97): pensumgjennomgangen, runde 2.
//   a) «Chicago blues» → «Electric blues». Det gamle navnet var direkte FEIL for
//      halve noden: B.B. King (Memphis), T-Bone Walker og Albert Collins (Texas)
//      og Christone Ingram (Mississippi) er ikke Chicago-artister. 12 artister
//      hadde dessuten alt «Electric blues» som UNDERsjanger — den taggen fjernes
//      nå der den er blitt en dublett av hovedsjangeren.
//      Node-ID-en forblir «chicagoblues»: koblingsnøklene er ID-baserte, og en
//      ID-endring ville foreldreløst edgeDescriptions uten å gi noe tilbake.
//   b) «House» + «Techno» → «House & techno». «/» er FORBUDT i Firestore-doc-
//      ID-er, og labelen ER doc-ID-en — derfor «&», som i «Trance & DnB».
//      Varmekartradene slås sammen med MAKS per tiår: begge scenene var
//      toneangivende, og et snitt ville gjort familien kunstig kjøligere.
//   c) Ny node «Gullalder-hip-hop». Artistene som hører hjemme der flyttes UT av
//      sekkenoden «Hip-hop» — det var hele poenget: den rommet 22 artister fra
//      1973 til 2003. Pionerene (Kool Herc, Bambaataa, Grandmaster Flash,
//      Sugarhill Gang) blir stående i «Hip-hop», som er grunnleggelsen.
// ---------------------------------------------------------------------------
const TREE_SLIM2_FLAG = "treeSlim2_2026_08";
const EB_OLD = "Chicago blues", EB_NEW = "Electric blues";
const HT_OLD = ["House", "Techno"], HT_NEW = "House & techno";
const GOLDEN_AGE = "Gullalder-hip-hop";
// Østkyst-kanonen 1986–94. Run-DMC er tatt med fordi gjennombruddet («Raising
// Hell», 1986) ER startskuddet; Fugees/Common/The Roots er bevisst utelatt —
// de starter i 1994–95 og står allerede i Cont. hip-hop.
const GOLDEN_AGE_ARTISTS = [
  "Run DMC", "Beastie Boys", "Public Enemy", "Queen Latifah",
  "De La Soul", "A Tribe Called Quest", "Wu-Tang Clan", "NAS",
];

export async function runTreeSlim2() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[TREE_SLIM2_FLAG]) return { skipped: true };

  const uniq = (xs) => [...new Set(xs)];
  const artistSnap = await getDocs(artistsCol);
  let tagged = 0, movedToGolden = 0;
  for (let i = 0; i < artistSnap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    let has = false;
    for (const d of artistSnap.docs.slice(i, i + BATCH_LIMIT)) {
      const a = d.data();
      const main0 = Array.isArray(a.mainGenre) ? a.mainGenre : [];
      const sub0 = Array.isArray(a.subGenre) ? a.subGenre : [];
      let main = main0.map((g) => (g === EB_OLD ? EB_NEW : HT_OLD.includes(g) ? HT_NEW : g));
      let sub = sub0.map((g) => (g === EB_OLD ? EB_NEW : HT_OLD.includes(g) ? HT_NEW : g));
      // Gullalderen: ut av sekkenoden, inn i den nye.
      if (GOLDEN_AGE_ARTISTS.includes(a.name) && main.includes("Hip-hop")) {
        main = main.map((g) => (g === "Hip-hop" ? GOLDEN_AGE : g));
        movedToGolden++;
      }
      main = uniq(main);
      // En undersjanger som nå er identisk med en av artistens hovedsjangre er
      // ren støy — den ville vist samme ord to ganger på kortet.
      sub = uniq(sub).filter((g) => !main.includes(g));
      const changed = main.join("\u0000") !== main0.join("\u0000") || sub.join("\u0000") !== sub0.join("\u0000");
      if (changed) {
        console.info(`Tre-runde-2 — ${a.name}: main [${main0.join(", ")}] → [${main.join(", ")}]` +
          (sub.join() !== sub0.join() ? ` | sub [${sub0.join(", ")}] → [${sub.join(", ")}]` : ""));
        batch.update(d.ref, { mainGenre: main, subGenre: sub });
        has = true;
        tagged++;
      }
    }
    if (has) await batch.commit();
  }

  // Varmekartet: omdøping + sammenslåing (maks per tiår).
  let heatNote = "uendret";
  const vkRef = doc(db, "content", "varmekart");
  const vkSnap = await getDoc(vkRef);
  if (vkSnap.exists() && vkSnap.data().heat) {
    const heat = { ...vkSnap.data().heat };
    console.info("Tre-runde-2 — varmekartrader FØR (logget for gjenoppretting):",
      JSON.stringify({ [EB_OLD]: heat[EB_OLD], House: heat.House, Techno: heat.Techno }));
    if (heat[EB_OLD] && !heat[EB_NEW]) heat[EB_NEW] = heat[EB_OLD];
    delete heat[EB_OLD];
    const rows = HT_OLD.map((k) => heat[k]).filter(Array.isArray);
    if (rows.length) {
      heat[HT_NEW] = rows[0].map((_, i) =>
        Math.max(...rows.map((r) => (Number.isInteger(r[i]) ? r[i] : 0))));
    }
    for (const k of HT_OLD) delete heat[k];
    await setDoc(vkRef, { heat, updatedAt: new Date().toISOString() });
    heatNote = `${EB_NEW} omdøpt, ${HT_NEW} slått sammen`;
  }

  // Beskrivelsene følger doc-ID = label. Flytt tekstene til de nye navnene.
  // Ved kollisjon vinner den EKSISTERENDE main-teksten; en sub-tekst på samme
  // navn droppes, ellers ville den skygget for main (den kjente fella).
  const moveDesc = async (from, to) => {
    const fromRef = doc(db, "genreDescriptions", from);
    const fromSnap = await getDoc(fromRef);
    if (!fromSnap.exists()) return;
    const toRef = doc(db, "genreDescriptions", to);
    const toSnap = await getDoc(toRef);
    const cur = toSnap.exists() ? toSnap.data() : {};
    console.info(`Tre-runde-2 — flytter genreDescriptions/${from} → ${to} (begge logget):`,
      JSON.stringify({ from: fromSnap.data(), toFør: cur }));
    const merged = { ...cur, ...fromSnap.data() };
    delete merged.sub;   // navnet er nå en TRE-sjanger; sub ville skygget main
    await setDoc(toRef, merged, { merge: false });
    await deleteDoc(fromRef);
  };
  await moveDesc(EB_OLD, EB_NEW);
  await moveDesc("House", HT_NEW);
  // Techno-teksten er allerede dekket av den sammenslåtte noden; logg og slett.
  for (const id of ["Techno"]) {
    const ref = doc(db, "genreDescriptions", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    console.info(`Tre-runde-2 — sletter genreDescriptions/${id} (innhold logget):`, JSON.stringify(snap.data()));
    await deleteDoc(ref);
  }

  // Koblinger som forsvant da techno ble borte, + rester fra tidligere runder.
  let edgesRemoved = 0;
  for (const id of ["house__techno", "disco__techno", "techno__trance", "techno__elektronika",
                    "techno__nujazz", "nujazz__jazz2"]) {
    const ref = doc(db, "edgeDescriptions", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    console.info(`Tre-runde-2 — sletter edgeDescriptions/${id} (innhold logget):`, JSON.stringify(snap.data()));
    await deleteDoc(ref);
    edgesRemoved++;
  }

  await setDoc(migRef, { [TREE_SLIM2_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Tre-runde-2 fullført: ${tagged} artist(er) omtagget (${movedToGolden} til gullalderen), varmekart: ${heatNote}, ${edgesRemoved} koblingsbeskrivelse(r) fjernet.`);
  return { tagged, movedToGolden, heatNote, edgesRemoved };
}

// ---------------------------------------------------------------------------
//  ENGANGS-MIGRERING (v4.02): omtagging etter tre-gjennomgangen — ni redaksjonelle
//  vedtak fra gjennomgangswidgeten, godkjent av læreren enkeltvis.
//
//  Fellesnevneren for hip-hop-endringene: «Hip-hop» er etter v3.97 GRUNNLEGGELSES-
//  noden (ca. 1979, Bronx). Artister som debuterte på 90- og 2000-tallet ble
//  liggende der bare fordi sekkenoden var det eneste som fantes. De flyttes nå til
//  noden som faktisk plasserer dem — eller mister den, hvis en mer presis node
//  allerede står der.
//
//  En undersjanger som blir identisk med en av artistens hovedsjangre fjernes
//  (samme regel som i v3.97): den ville vist samme ord to ganger på kortet.
// ---------------------------------------------------------------------------
const RETAG_FLAG = "genreRetag_2026_08";
const RETAG = [
  // Elektrisk blues, ikke bluesrock — begge har alt «Electric blues» som undersjanger.
  { name: "Albert Collins", remove: ["Blues rock"], add: ["Electric blues"] },
  { name: "Christone «Kingfish» Ingram", remove: ["Blues rock"], add: ["Electric blues"] },
  // T.I. ga undersjangeren navnet med «Trap Muzik» (2003).
  { name: "T.I.", remove: ["Hip-hop"], add: ["Trap"] },
  { name: "Eminem", remove: ["Hip-hop"], add: ["Cont. hip-hop"] },
  { name: "OutKast", remove: ["Hip-hop"], add: ["Cont. hip-hop"] },
  { name: "Fugees", remove: ["Hip-hop"], add: ["Gullalder-hip-hop"] },
  // Common spenner over begge: «Resurrection» (1994) er gullalder, karrieren samtid.
  { name: "Common", remove: ["Hip-hop"], add: ["Gullalder-hip-hop"] },
  // Disse fire er allerede plassert av «Cont. hip-hop»; grunnleggelsesnoden er støy.
  { name: "Jay-Z", remove: ["Hip-hop"], add: [] },
  { name: "Timbaland", remove: ["Hip-hop"], add: [] },
  { name: "J Dilla", remove: ["Hip-hop"], add: [] },
  { name: "Missy Elliott", remove: ["Hip-hop"], add: [] },
  // Kraftwerk kom FØR house og techno og påvirket dem — å tagge dem med sjangeren
  // de inspirerte er baklengs. «Elektronika» blir stående.
  { name: "Kraftwerk", remove: ["House & techno"], add: [] },
];

export async function runGenreRetag() {
  const migRef = doc(db, "config", "migrations");
  const migSnap = await getDoc(migRef);
  if (migSnap.exists() && migSnap.data()[RETAG_FLAG]) return { skipped: true };

  const artistSnap = await getDocs(artistsCol);
  const byName = new Map(artistSnap.docs.map((d) => [String(d.data().name || "").trim().toLowerCase(), d]));
  const done = [], missing = [], skipped = [];

  for (let i = 0; i < RETAG.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    let has = false;
    for (const spec of RETAG.slice(i, i + BATCH_LIMIT)) {
      const d = byName.get(spec.name.trim().toLowerCase());
      if (!d) { missing.push(spec.name); continue; }
      const a = d.data();
      const main0 = Array.isArray(a.mainGenre) ? a.mainGenre : [];
      const sub0 = Array.isArray(a.subGenre) ? a.subGenre : [];
      // Har taggen alt forsvunnet (manuell redigering i mellomtiden), rører vi ingenting.
      if (spec.remove.length && !spec.remove.some((g) => main0.includes(g))) {
        skipped.push(`${spec.name} (hadde ikke «${spec.remove.join(", ")}» lenger)`);
        continue;
      }
      let main = main0.filter((g) => !spec.remove.includes(g));
      for (const g of spec.add) if (!main.includes(g)) main.push(g);
      if (!main.length) { skipped.push(`${spec.name} (ville stått uten sjanger)`); continue; }
      const sub = sub0.filter((g) => !main.includes(g));
      console.info(`Omtagging — ${a.name}: main [${main0.join(", ")}] → [${main.join(", ")}]` +
        (sub.length !== sub0.length ? ` | sub [${sub0.join(", ")}] → [${sub.join(", ")}]` : ""));
      batch.update(d.ref, { mainGenre: main, subGenre: sub });
      has = true;
      done.push(spec.name);
    }
    if (has) await batch.commit();
  }

  await setDoc(migRef, { [RETAG_FLAG]: new Date().toISOString() }, { merge: true });
  console.info(`Omtagging fullført: ${done.length} artist(er) endret.` +
    (missing.length ? ` IKKE FUNNET: ${missing.join(", ")}.` : "") +
    (skipped.length ? ` HOPPET OVER: ${skipped.join("; ")}.` : ""));
  return { done, missing, skipped };
}

// Sjangerhistoriene («Sjangerhistorier» i Det store bildet) lagres som
// story-felt på metasjangerens genreDescriptions-dokument — samme
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

// Skriver et UTVALG varmekart-rader uten å røre resten. Leser dagens dokument
// først (ikke lokal state — importen OG celleredigeringen skal være trygg også
// før første snapshot har landet, og to faner skal ikke overskrive hverandre),
// fletter inn radene fra kallet og skriver hele dokumentet tilbake (full skriv,
// ikke felt-stier: sjangernavn kan inneholde «/» og andre tegn som er kronglete
// i Firestore-feltstier). Eneste vei inn til content/varmekart fra både import
// og celleklikk. Returnerer { written, kept, skipped } for kvitteringen.
export async function mergeVarmekartRows(rows) {
  const ref = doc(db, "content", "varmekart");
  const snap = await getDoc(ref);
  const current = (snap.exists() && snap.data().heat) || {};
  const { heat, written, kept, skipped } = mergeHeatRows(current, rows);
  await setDoc(ref, { heat, updatedAt: new Date().toISOString() });
  return { written, kept, skipped };
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
  }, onSubscribeError("endringsforslag"));
}

// Legg inn et endringsforslag. `proposedFields` skal kun inneholde feltene
// som faktisk er endret — UI-koden gjør differansen mot dagens verdier.
// `level` (meta/main/sub) brukes kun av entityType "subgenre", så godkjenning
// vet hvilket nivåfelt i genreDescriptions teksten skal skrives til.
export async function addPendingEdit({ entityType, entityId, entityName, proposedFields, proposedBy, level }) {
  await ensureAuth().catch(() => {});   // se addArtist: selvheler feilet oppstarts-innlogging
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
// SIKKERHET: level kommer fra studentdokumentet (reglene håndhever ikke
// verdien), så vi godtar KUN "main"/"sub". Alt annet (f.eks. "meta", som
// purgeDeadGenreDescFields siden ville slettet, eller "story"/"updatedAt" som
// lager søppelfelter) faller tilbake til den trygge isMainGenre-gjetningen.
export function genreEditLevel(edit) {
  if (edit.level === "main" || edit.level === "sub") return edit.level;
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
    // Instrumentsammendraget er en innholdsside (content/instrument-<slug>) og
    // kan opprettes ved første godkjente forslag — derfor ikke i mustExist.
    case "instrument":     return doc(db, "content", entityId);
    case "decade-society": return doc(db, "decades", String(entityId));
    case "decade-tech":    return doc(db, "decades", String(entityId));
    default:               return null;
  }
}

// Forslag om et helt nytt innovasjonskort fra student. Markeres med
// `status: "pending"` og venter på lærergodkjenning. Eksisterende
// tech-dokumenter uten status-felt regnes som aktive.
export async function addTechProposal(data) {
  await ensureAuth().catch(() => {});   // se addArtist: selvheler feilet oppstarts-innlogging
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
  }, onSubscribeError("teacherChecks"));
}

export async function setTeacherChecks(data) {
  return setDoc(teacherChecksRef, data, { merge: true });
}

// Signal til den innebygde last-vakten (i HTML) om at datalaget — og dermed
// Firebase-SDK fra gstatic — faktisk lastet. Blir dette flagget aldri satt
// (f.eks. brannmur/captive portal blokkerer gstatic), viser vakten en
// forklarende melding i stedet for en død side.
if (typeof window !== "undefined") window.__pensumReady = true;
