// ============================================================================
//  PLATESELSKAPENE — lista, skrivemåtene og koblingen til artistene
// ----------------------------------------------------------------------------
//  Plateselskapene med eget kort (v6.37, brukervalg 2026-10-04). Lista er
//  vokabular, som instrumentgruppene i limits.js: id, navn og skrivemåtene
//  artistenes plateselskapsfelt (recordLabel) bruker. «Victor», «RCA Victor»
//  og «RCA» er samme selskap, og hver av dem skal finne kortet.
//
//  Selve innholdet (tekst, fakta og kilder) bor i Firestore som
//  content/plateselskap-<id>, på samme måte som instrumentsammendragene, og
//  det finnes ingen reservetekst i koden.
//
//  Feltet kan bære flere selskaper («Columbia / Atlantic»). delSelskapsfelt
//  deler det, og hver del slås opp for seg. Treffet er eksakt, uten forskjell
//  på store og små bokstaver og uten endelser som «Records», så «Sun» aldri
//  treffer «Sunset» og «RCA» aldri treffer «RCA Camden».
//
//  Rekkefølgen er etter når selskapene ble grunnlagt. Kortet og oversikten
//  sorterer etter årstallet i faktafeltet når det finnes, og faller tilbake
//  på denne rekkefølgen.
// ============================================================================
import { SKJUL_I_HUBEN } from "./feature-flags.js";
import { opts } from "../data/app-state.js";

export const PLATESELSKAPER = [
  { id: "columbia", navn: "Columbia", aliaser: ["Columbia"] },
  // Bluebird var RCA Victors rimelige merke fra 1930-årene (kortet sier det).
  { id: "victor", navn: "Victor / RCA", aliaser: ["Victor", "RCA Victor", "RCA", "Bluebird"] },
  { id: "paramount", navn: "Paramount", aliaser: ["Paramount"] },
  { id: "decca", navn: "Decca", aliaser: ["Decca"] },
  { id: "blue-note", navn: "Blue Note", aliaser: ["Blue Note"] },
  { id: "savoy", navn: "Savoy", aliaser: ["Savoy"] },
  // Atco var Atlantics eget underselskap fra 1955 (Coasters, Bobby Darin).
  { id: "atlantic", navn: "Atlantic", aliaser: ["Atlantic", "Atco"] },
  { id: "chess", navn: "Chess", aliaser: ["Chess"] },
  { id: "sun", navn: "Sun", aliaser: ["Sun"] },
  // Volt var Stax' søstermerke, og Otis Reddings plater kom der.
  { id: "stax", navn: "Stax", aliaser: ["Stax", "Volt"] },
  // Tamla og Gordy var Motowns egne merker ved siden av Motown-merket.
  { id: "motown", navn: "Motown", aliaser: ["Motown", "Tamla", "Gordy"] },
  { id: "ecm", navn: "ECM", aliaser: ["ECM"] },
  { id: "philadelphia-international", navn: "Philadelphia International", aliaser: ["Philadelphia International", "PIR"] },
];

const PREFIKS = "plateselskap-";
export const plateselskapSideId = (id) => `${PREFIKS}${id}`;
export function plateselskapForSide(sideId) {
  const s = String(sideId || "");
  return s.startsWith(PREFIKS) ? finnSelskapId(s.slice(PREFIKS.length)) : null;
}
export const finnSelskapId = (id) => PLATESELSKAPER.find((p) => p.id === id) || null;

// «Decca Records» og «Blue Note Records» skal treffe som «Decca» og «Blue Note».
const ENDELSE = /\s+(?:records?|recordings?|records?\s+inc\.?|company|co\.)$/i;
export function normaliserSelskap(navn) {
  return String(navn || "").trim().replace(ENDELSE, "").replace(/\s+/g, " ").toLowerCase();
}

// «Columbia / Atlantic» → ["Columbia", "Atlantic"]. Skråstrek og semikolon
// skiller; komma ikke, siden det kan stå i et selskapsnavn.
export function delSelskapsfelt(felt) {
  return String(felt || "").split(/[\/;]/).map((s) => s.trim()).filter(Boolean);
}

const ALIAS = new Map(PLATESELSKAPER.flatMap((p) => p.aliaser.map((a) => [normaliserSelskap(a), p])));
export function finnPlateselskap(navn) {
  return ALIAS.get(normaliserSelskap(navn)) || null;
}

// Feltet som deler med selskapet til hver del (null når selskapet ikke har
// kort). Rekkefølgen og skrivemåten i feltet beholdes.
export function selskaperIFelt(felt) {
  return delSelskapsfelt(felt).map((tekst) => ({ tekst, selskap: finnPlateselskap(tekst) }));
}

export function harSelskap(artist, id) {
  return selskaperIFelt(artist?.recordLabel).some((d) => d.selskap?.id === id);
}

export function artisterForSelskap(artists, id) {
  return (artists || []).filter((a) => harSelskap(a, id));
}

// Faktafeltene øverst på kortet (content/plateselskap-<id>.fakta). Fritekst,
// skrevet av læreren i sideeditoren eller levert i importfila. «grunnlagt» er
// årstallet kortene sorteres etter, de andre vises som de står.
export const FAKTA_FELT = [
  { key: "grunnlagt", navn: "Grunnlagt (år)", hint: "f.eks. 1957" },
  { key: "sted", navn: "Sted", hint: "f.eks. Memphis, Tennessee" },
  { key: "grunnleggere", navn: "Grunnlagt av", hint: "f.eks. Jim Stewart og Estelle Axton" },
  { key: "virketid", navn: "I drift", hint: "f.eks. 1957–1975, eller 1939 til i dag" },
];

// Bare de kjente feltene, som trimmet tekst, og bare de som har innhold.
// null når ingen har det, så et tomt fakta-felt aldri skrives til databasen.
export function rensFakta(fakta) {
  if (!fakta || typeof fakta !== "object") return null;
  const ut = {};
  for (const { key } of FAKTA_FELT) {
    const v = fakta[key];
    if (v == null) continue;
    const tekst = String(v).trim();
    if (tekst) ut[key] = tekst;
  }
  return Object.keys(ut).length ? ut : null;
}

// Årstallet i faktafeltet (content/plateselskap-<id>.fakta.grunnlagt), eller
// null. Godtar både tall og tekst («1950»).
export function grunnlagtAar(side) {
  const v = side?.fakta?.grunnlagt;
  const n = Number(String(v ?? "").match(/\d{4}/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Selskapene i visningsrekkefølge: etter grunnleggelsesåret når det er lagt
// inn, ellers listas rekkefølge. `sideFor(id)` gir content-dokumentet.
export function selskaperSortert(sideFor = () => null) {
  return PLATESELSKAPER
    .map((p, i) => ({ p, i, aar: grunnlagtAar(sideFor(p.id)) }))
    .sort((a, b) => (a.aar ?? 9999) - (b.aar ?? 9999) || a.i - b.i)
    .map((x) => x.p);
}

// Kortene er skjult for studentene til læreren har gått gjennom dem
// (feature-flags.js, SKJUL_I_HUBEN["sb-plateselskaper"], bryteren
// «Plateselskapene» på Skrivebordet). Læreren ser dem alltid. Samme regel
// gjelder hubkortet, søket, lenkene på artistkortene og ?vis=-lenkene.
export function plateselskapeneSynlige() {
  return !SKJUL_I_HUBEN["sb-plateselskaper"] || !!opts?.onStoryEdit;
}
