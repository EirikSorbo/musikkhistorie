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

import { firebaseConfig } from "./firebase-config.js?v=5.04";
import { isMainGenre } from "./genre-model.js?v=5.04";
import { normalizeArtist, buildArtistDoc } from "./artist-normalize.js?v=5.04";
import { PROPOSABLE_KEYS } from "./proposal-fields.js?v=5.04";
import { mergeHeatRows } from "./import-format.js?v=5.04";
import { BATCH_MAX } from "./genre-migrate.js?v=5.04";
import { DECADES, INSTRUMENT_TIMELINE_GROUPS, instrumentPageId } from "./limits.js?v=5.04";

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
// innlogging ikke er aktivert — da feiler stemmingen synlig (voteFailed), i
// stedet for å skrive en identitet reglene uansett avviser.
async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  return signInAnonymouslyOnce();
}

// Klient-ID for rendering (hvilke kort har JEG stemt på) = uid-en stemmene
// faktisk registreres med. Null før anonym innlogging har landet; sidene
// oppdaterer seg selv via onAuthChange. Den gamle localStorage-ID-en er fjernet
// (v4.23): den stammet fra tiden før anonym auth, og etter at reglene begynte å
// kreve egen uid var den ikke bare død — en stemme skrevet med den ble ALLTID
// avvist. Verifisert mot live-Firestore: 0 av 319 artister har slike stemmer.
export function getClientId() {
  return (AUTH_CONFIGURED ? auth.currentUser?.uid : null) || null;
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

// Engangs-henting av artistlista. Studentsiden bruker den KUN som reserve når
// den lokale cachen er tom (direkte-besøk uten å ha vært innom forsiden) — den
// trenger navnene til duplikatsjekken, ikke et sanntidsabonnement på hele
// samlingen. NB: getDocs spør SERVEREN når klienten er online (den persistente
// cachen kutter kostnad for lyttere via resume-token, ikke for engangs-get),
// så hvert kall koster en full samlingslesing. Derfor er den en sjelden
// reserve, ikke en hovedvei.
export async function fetchArtists() {
  const snapshot = await getDocs(artistsCol);
  return snapshot.docs.map((d) => normalizeArtist({ id: d.id, ...d.data() }));
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

// Firestore tillater maks 500 operasjoner per batch. ÉN kilde (genre-migrate
// eksporterer den, planPasserIBatch og skrivingen her leser samme tall) — to
// uavhengige konstanter kunne drive fra hverandre, og da ville en plan passert
// forhåndssjekken i editoren og likevel kastet ved kjøring.
const BATCH_LIMIT = BATCH_MAX;

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
  const { uid } = await ensureAuth();
  return updateDoc(doc(db, "artists", artistId), { votedUpBy: arrayUnion(uid) });
}

// Angre positiv stemme (arrayRemove fjerner kun egen uid, atomisk).
export async function undoVoteUp(artistId) {
  const { uid } = await ensureAuth();
  return updateDoc(doc(db, "artists", artistId), { votedUpBy: arrayRemove(uid) });
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

// ----------------------------------------------------------------------------
//  MIGRERING AV SJANGERTREET
// ----------------------------------------------------------------------------
//  Utfører en plan fra js/genre-migrate.js. Planen er allerede validert og vist
//  for læreren; her skjer bare skrivingen.
//
//  ÉN batch, med vilje: et navnebytte berører seks samlinger, og skrives de hver
//  for seg kan en feil midt i etterlate treet omdøpt mens artistene fortsatt
//  peker på det gamle navnet. Firestore-batcher er atomiske OG kan spenne flere
//  samlinger, så enten går alt gjennom eller ingenting.
//
//  Grensen er 500 operasjoner. En plan over det kan ikke gjøres atomisk, og da
//  avviser vi heller enn å dele den opp — en halvveis migrering er verre enn en
//  som ikke ble gjort. Planleggeren flagger det samme på forhånd
//  (planPasserIBatch), så dette er siste skanse.
export async function runMigrationPlan(ops) {
  const liste = Array.isArray(ops) ? ops : [];
  if (!liste.length) return 0;
  if (liste.length > BATCH_LIMIT) {
    throw new Error(`Migreringen krever ${liste.length} skrivinger, men Firestore tar maks ${BATCH_LIMIT} i én atomisk batch. Del endringen i mindre steg.`);
  }
  const batch = writeBatch(db);
  for (const o of liste) {
    const ref = doc(db, o.coll, String(o.id));
    switch (o.type) {
      case "doc.merge":   batch.set(ref, o.data, { merge: true }); break;
      case "doc.replace": batch.set(ref, o.data); break;
      case "doc.delete":  batch.delete(ref); break;
      case "field.delete": batch.update(ref, { [o.data.felt]: deleteField() }); break;
      default: throw new Error(`Ukjent migreringsoperasjon: ${o.type}`);
    }
  }
  await batch.commit();
  return liste.length;
}

// Lagrer hele sjangertreet (content/genealogy). Brukes av de TRYGGE
// operasjonene i editoren — de som ikke flytter en identitet: ny sjanger, ny
// forelder, ny rad, ny farge, endret fullt navn.
export async function saveGenealogyTree(tree) {
  return setDoc(doc(db, "content", "genealogy"),
    { ...tree, updatedAt: new Date().toISOString() });
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

// purgeDeadGenreDescFields (rydding av døde `meta`- og flate `description`/
// `kilder`-felter) er fjernet i v4.23: den leste hele genreDescriptions-
// samlingen ved HVER lærer-oppstart for å rydde en tilstand som ikke lenger kan
// oppstå — verifisert mot live-Firestore samme dag (0 av 150 dokumenter), og
// eksport/import skriver nå utelukkende nivåfeltene. Koden ligger i
// git-historikken (t.o.m. v4.22).

// ---------------------------------------------------------------------------
//  De ni engangsmigreringene fra sjanger-/tre-gjennomgangene 2026-07/08
//  (duplikatopprydding, node-label-justering, Trance-doc-id, innholdsnøkler,
//  foreldreløs-opprydding, tre-slanking runde 1+2, omtagging og undersjanger-
//  sletting) er fjernet i v4.19: alle var flagg-guardet i config/migrations,
//  og flaggene er verifisert satt i produksjon (siste kjørt 2026-08-03).
//  Koden ligger i git-historikken (t.o.m. v4.18) om noe må gjenopprettes —
//  flaggdokumentet i Firestore BEHOLDES, så en gammel klient som ikke har
//  fått ny kode ennå fortsatt skipper trygt.
// ---------------------------------------------------------------------------


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
  }, onSubscribeError("innhold"));
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

// Frittstående referanser: kilder som ikke hører til noe kort (en bok læreren
// bygger pensumet på, en podkastserie, en dokumentar). Lagres som ÉN liste i
// content-samlingen — den lastes allerede av alle sidene, så Referanser-kortet
// får dem uten en eneste ekstra dokumentlesning, og reglene for content
// gjelder som de er (ingen nye Firestore-regler å publisere).
export async function saveReferanser(kilder) {
  return setDoc(doc(db, "content", "referanser"),
    { kilder, updatedAt: new Date().toISOString() });
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
    // entityId er STUDENT-skrevet (reglene krever bare en streng), så den MÅ
    // valideres mot instrumentgruppene her: uvalidert kunne et forslag med
    // entityId «omHistorie» fått lærerens godkjenning til å merge {body} rett
    // inn i en annen innholdsside (confused deputy).
    case "instrument":
      return INSTRUMENT_TIMELINE_GROUPS.some((g) => instrumentPageId(g) === entityId)
        ? doc(db, "content", entityId) : null;
    // Samme vern: tiåret må være et av appens tiår.
    case "decade-society":
    case "decade-tech":
      return DECADES.map(String).includes(String(entityId))
        ? doc(db, "decades", String(entityId)) : null;
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
