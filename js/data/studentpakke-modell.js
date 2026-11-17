// ============================================================================
//  SAMLEPAKKEN TIL STUDENTENE: MODELLEN (v7.46, plan av 2026-11-17)
// ----------------------------------------------------------------------------
//  En student som åpner appen uten fersk lokal kopi, leser alle samlingene
//  dokument for dokument: 700 til 900 lesinger, og gratiskvoten på 50 000 i
//  døgnet ble brukt opp 17.11. Samlepakken er en tro kopi av alt studentene kan
//  lese, samlet i rundt 15 store dokumenter i config-samlingen (alle kan lese,
//  bare læreren skrive, så ingen nye regler). Lærerens nettleser bygger den
//  (studentpakke.js). Fra fase 2 leser studentene den i stedet for samlingene.
//
//  Pakken er ufiltrert: synlighet og «Bare sjekket innhold» virker som før i
//  nettleseren (shared-data.js), på nøyaktig de samme dataene.
//
//    config/studentpakke            manifestet: format, aktiv (nødbryteren),
//                                   bygget, bøttene og sjekksummen per del
//    config/studentpakke-<kilde>-<n> en del: json med [[id, data], …]
//
//  Hver kilde deles i bøtter etter en fast hash av dokument-id-en, så en rettet
//  artist bare endrer én del. Antallet bøtter dobles til hver del er under
//  GRENSE_BYTE (Firestore tillater 1 MiB per dokument).
//
//  Teksten lages med stabilJson: sorterte nøkler, så like data alltid gir lik
//  tekst og byggeren kan se om en del er endret ved å sammenligne teksten.
//  Tidsstempler (createdAt på artistene) og NaN/Infinity merkes, så de kommer
//  tilbake som de var. Andre typer avvises: da er det bedre at byggingen
//  stopper med en melding enn at studentene får noe annet enn samlingene.
//
//  Ren modul uten Firebase: enhetstestene og testhjelperen i nettleser-
//  testene bruker den i Node.
// ============================================================================

export const PAKKE_FORMAT = 1;
export const MANIFEST_ID = "studentpakke";
export const DEL_PREFIKS = "studentpakke-";
// Målet for en del, og det absolutte taket (ett dokument kan få bøtta for
// seg selv opp til taket).
export const GRENSE_BYTE = 700_000;
export const MAKS_BYTE = 900_000;
const MAKS_BOTTER = 64;

// Kildene i fast rekkefølge: det studentsidene leser i dag (shared-data.js og
// sjekkene). samling + dok er et enkeltdokument. navn står i statuslinja.
export const PAKKE_KILDER = [
  { id: "artists", samling: "artists", botter: 8, navn: "artistene" },
  { id: "content", samling: "content", botter: 1, navn: "innholdet" },
  { id: "genreDescriptions", samling: "genreDescriptions", botter: 1, navn: "sjangerbeskrivelsene" },
  { id: "edgeDescriptions", samling: "edgeDescriptions", botter: 1, navn: "koblingsbeskrivelsene" },
  { id: "tech", samling: "tech", botter: 1, navn: "innovasjonskortene" },
  { id: "decades", samling: "decades", botter: 1, navn: "tiårene" },
  { id: "podcasts", samling: "podcasts", botter: 1, navn: "podkastene" },
  { id: "teacherChecks", samling: "config", dok: "teacherChecks", botter: 1, navn: "sjekkene" },
];

export class PakkeFeil extends Error {
  constructor(melding) {
    super(melding);
    this.name = "PakkeFeil";
  }
}

// ---- Tekst ----------------------------------------------------------------

const erTidsstempel = (v) => typeof v?.toMillis === "function"
  && typeof v.seconds === "number" && typeof v.nanoseconds === "number";

// JSON med sorterte nøkler. sti står i feilmeldingen.
export function stabilJson(verdi, sti = "") {
  if (verdi === null) return "null";
  switch (typeof verdi) {
    case "string": return JSON.stringify(verdi);
    case "boolean": return verdi ? "true" : "false";
    case "number":
      return Number.isFinite(verdi) ? JSON.stringify(verdi) : `{"__tall":${JSON.stringify(String(verdi))}}`;
    case "object": break;
    default: throw new PakkeFeil(`Ukjent verdi (${typeof verdi}) i ${sti || "dokumentet"}.`);
  }
  if (Array.isArray(verdi)) return `[${verdi.map((v, i) => stabilJson(v, `${sti}[${i}]`)).join(",")}]`;
  if (erTidsstempel(verdi)) return `{"__ts":[${verdi.seconds},${verdi.nanoseconds}]}`;
  const proto = Object.getPrototypeOf(verdi);
  if (proto !== Object.prototype && proto !== null) {
    throw new PakkeFeil(`Ukjent verdi i ${sti || "dokumentet"}.`);
  }
  const nokler = Object.keys(verdi).sort();
  if (nokler.includes("__ts") || nokler.includes("__tall")) {
    throw new PakkeFeil(`Feltnavnet er reservert i ${sti || "dokumentet"}.`);
  }
  return `{${nokler.map((k) => `${JSON.stringify(k)}:${stabilJson(verdi[k], sti ? `${sti}.${k}` : k)}`).join(",")}}`;
}

// Et tidsstempel med det appen bruker av Firestores Timestamp.
export function enkelTid(seconds, nanoseconds) {
  return {
    seconds,
    nanoseconds,
    toMillis() { return seconds * 1000 + Math.floor(nanoseconds / 1e6); },
    toDate() { return new Date(seconds * 1000 + Math.floor(nanoseconds / 1e6)); },
  };
}

function gjenskap(v, lagTid) {
  if (Array.isArray(v)) return v.map((x) => gjenskap(x, lagTid));
  if (v && typeof v === "object") {
    const k = Object.keys(v);
    if (k.length === 1 && k[0] === "__ts" && Array.isArray(v.__ts)) return lagTid(v.__ts[0], v.__ts[1]);
    if (k.length === 1 && k[0] === "__tall") return Number(v.__tall);
    const ut = {};
    for (const n of k) ut[n] = gjenskap(v[n], lagTid);
    return ut;
  }
  return v;
}

// ---- Bøtter og sjekksum -----------------------------------------------------

// FNV-1a, 32 bit, som 8 heksadesimale tegn.
export function fnv1a(tekst) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const botteFor = (id, k) => (k <= 1 ? 0 : parseInt(fnv1a(String(id)), 16) % k);

const KODER = new TextEncoder();
export const byteLengde = (tekst) => KODER.encode(tekst).length;

const etterId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---- Bygging ------------------------------------------------------------------

// raa: { <kilde-id>: [{ id, data }] } for alle PAKKE_KILDER. Gir
// { format, botter, deler: [{ id, kilde, json, bytes, antall, sjekksum }], bytes }.
// Kaster PakkeFeil hvis et dokument er for stort eller har en ukjent verdi.
export function byggPakke(raa, { grense = GRENSE_BYTE, maks = MAKS_BYTE } = {}) {
  const deler = [];
  const botter = {};
  for (const kilde of PAKKE_KILDER) {
    const docs = [...(raa?.[kilde.id] || [])].sort(etterId);
    const ser = docs.map((d) => ({
      id: String(d.id),
      tekst: `[${JSON.stringify(String(d.id))},${stabilJson(d.data, `${kilde.id}/${d.id}`)}]`,
    }));
    let k = kilde.botter;
    let resultat;
    for (;;) {
      const grupper = Array.from({ length: k }, () => []);
      for (const s of ser) grupper[botteFor(s.id, k)].push(s);
      resultat = grupper.map((g, i) => {
        const json = `[${g.map((s) => s.tekst).join(",")}]`;
        return { id: `${kilde.id}-${i}`, kilde: kilde.id, json, bytes: byteLengde(json), antall: g.length, ider: g.map((s) => s.id) };
      });
      // Flere bøtter hjelper ikke en bøtte med ett dokument.
      const forStore = resultat.filter((d) => d.bytes > grense && d.antall > 1);
      if (!forStore.length || k >= MAKS_BOTTER) break;
      k *= 2;
    }
    const forStor = resultat.find((d) => d.bytes > maks);
    if (forStor) {
      const hvem = forStor.antall === 1 ? `Dokumentet ${kilde.samling}/${forStor.ider[0]}` : `Delen ${forStor.id}`;
      throw new PakkeFeil(`${hvem} er for stort til studentversjonen (${Math.round(forStor.bytes / 1000)} kB, grensen er ${Math.round(maks / 1000)} kB).`);
    }
    botter[kilde.id] = k;
    for (const { ider, ...d } of resultat) deler.push({ ...d, sjekksum: fnv1a(d.json) });
  }
  return { format: PAKKE_FORMAT, botter, deler, bytes: deler.reduce((s, d) => s + d.bytes, 0) };
}

// ---- Dokumentene i config ------------------------------------------------------

export const delDokId = (delId) => DEL_PREFIKS + delId;

export function manifestDeler(pakke) {
  const m = {};
  for (const d of pakke.deler) m[d.id] = { kilde: d.kilde, sjekksum: d.sjekksum, bytes: d.bytes, antall: d.antall };
  return m;
}

export function manifestDok(pakke, { aktiv = true, bygget = null, appVersjon = "" } = {}) {
  return {
    studentpakke: true,
    type: "manifest",
    format: pakke.format,
    aktiv,
    bygget,
    appVersjon,
    botter: { ...pakke.botter },
    deler: manifestDeler(pakke),
    bytes: pakke.bytes,
  };
}

export function delDok(del) {
  return { studentpakke: true, type: "del", format: PAKKE_FORMAT, del: del.id, kilde: del.kilde, json: del.json };
}

// Pakken slik den ligger i config: { manifest, deler: { <del-id>: data } }.
// docs er [{ id, data }] fra spørringen på studentpakke == true.
export function gjeldendePakke(docs) {
  let manifest = null;
  const deler = {};
  for (const d of docs || []) {
    if (d.id === MANIFEST_ID) manifest = d.data;
    else if (d.id.startsWith(DEL_PREFIKS)) deler[d.id.slice(DEL_PREFIKS.length)] = d.data;
  }
  return { manifest, deler };
}

// Nødbryteren overlever ombyggingen. Uten manifest er pakken på.
export const aktivFra = (gjeldende) => (typeof gjeldende?.manifest?.aktiv === "boolean" ? gjeldende.manifest.aktiv : true);

// Hva må skrives for at config skal stemme med den nye pakken? Tidspunktet og
// appversjonen i manifestet teller ikke, så to faner med lærersiden ikke
// skriver om hverandre.
export function pakkeEndringer(ny, gjeldende) {
  const g = gjeldende || { manifest: null, deler: {} };
  const gDeler = g.deler || {};
  const skriv = ny.deler.filter((d) => {
    const h = gDeler[d.id];
    return !h || h.json !== d.json || h.format !== PAKKE_FORMAT || h.kilde !== d.kilde
      || h.type !== "del" || h.studentpakke !== true;
  }).map((d) => d.id);
  const nye = new Set(ny.deler.map((d) => d.id));
  const slett = Object.keys(gDeler).filter((id) => !nye.has(id)).sort();
  const m = g.manifest;
  const manifestUlikt = !m || m.studentpakke !== true || m.type !== "manifest" || m.format !== ny.format
    || typeof m.aktiv !== "boolean" || m.bytes !== ny.bytes
    || stabilJson(m.botter ?? null) !== stabilJson(ny.botter)
    || stabilJson(m.deler ?? null) !== stabilJson(manifestDeler(ny));
  return { skriv, slett, manifest: manifestUlikt || skriv.length > 0 || slett.length > 0 };
}

export const pakkeStemmer = (ny, gjeldende) => !pakkeEndringer(ny, gjeldende).manifest;

// ---- Lesing ---------------------------------------------------------------------

// Rådataene tilbake fra pakken: { ok: true, raa, bygget } eller
// { ok: false, grunn }. grunn er «mangler», «format», «av» eller «del» (en del
// mangler eller har feil sjekksum). Da skal siden lese samlingene direkte.
export function lesPakke(gjeldende, { lagTid = enkelTid } = {}) {
  const m = gjeldende?.manifest;
  if (!m) return { ok: false, grunn: "mangler" };
  if (m.format !== PAKKE_FORMAT || m.type !== "manifest") return { ok: false, grunn: "format" };
  if (m.aktiv === false) return { ok: false, grunn: "av" };
  if (PAKKE_KILDER.some((k) => !m.botter?.[k.id])) return { ok: false, grunn: "format" };
  const raa = Object.fromEntries(PAKKE_KILDER.map((k) => [k.id, []]));
  for (const [id, info] of Object.entries(m.deler || {})) {
    const del = gjeldende.deler?.[id];
    if (!del || typeof del.json !== "string" || fnv1a(del.json) !== info.sjekksum || !(info.kilde in raa)) {
      return { ok: false, grunn: "del", del: id };
    }
    let liste;
    try { liste = JSON.parse(del.json); } catch { return { ok: false, grunn: "del", del: id }; }
    for (const [docId, data] of liste) raa[info.kilde].push({ id: docId, data: gjenskap(data, lagTid) });
  }
  for (const k of Object.keys(raa)) raa[k].sort(etterId);
  return { ok: true, raa, bygget: m.bygget || null };
}
