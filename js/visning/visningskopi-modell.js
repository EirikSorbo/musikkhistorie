// ============================================================================
//  SIKKERHETSKOPI AV VISNINGEN (v7.15), den rene delen
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-10-25: en visning som aldri ble avsluttet (nettleseren
//  lukket rett etter timen), skal ikke gå tapt. Til v7.14 lå det som ble vist,
//  bare i fanens sessionStorage, og forsvant med fanen.
//
//  Mens læreren viser, skrives det som er vist til samlingen notater under
//  nøkkelen visning:<øktId>, som slidene (slide:<id>) og påminnelsene. Reglene
//  trengs ikke endret (tekst, høyst 10 000 tegn), og studentene leser ingenting
//  av det: en skriving til content ville gitt én lesing per tilkoblet student.
//  Avslutt sletter kopien, enten timen ble lagret eller ikke. En kopi som står
//  igjen, ble aldri avsluttet, og appen spør om den neste gang læreren er
//  innlogget (js/visning/visning.js). Valg 2026-10-25: spør, med «Lagre som
//  time», «Forkast» og «Senere».
//
//  Ren modul (Node-testbar). Skrivingen og lista bor i visningskopi.js.
// ============================================================================

import { parseVisVerdi } from "../felles/vis-lenke.js";

export const KOPI_PREFIKS = "visning:";
// Reglene for notater tillater høyst 10 000 tegn i tekst.
export const KOPI_MAKS = 10000;
// En kopi skrevet så nylig kan høre til en visning som fortsatt pågår (en
// annen fane, maskinen i klasserommet). Da spør ikke appen, men kopien står i
// Visning-vinduet.
export const FERSK_MS = 15 * 60 * 1000;

const OKT_RE = /^o[a-z0-9]{4,24}$/;
export const erOktId = (id) => OKT_RE.test(String(id || ""));
export const kopiNokkel = (okt) => `${KOPI_PREFIKS}${okt}`;
export const erKopiNokkel = (nokkel) => String(nokkel || "").startsWith(KOPI_PREFIKS)
  && erOktId(String(nokkel).slice(KOPI_PREFIKS.length));

// Ny økt-id: «o», base36-tid og tre tilfeldige tegn. Kolonfri og trygg som
// dokument-id.
export function nyOktId(naa = Date.now(), tilfeldig = Math.random) {
  const r = Array.from({ length: 3 }, () => Math.floor(tilfeldig() * 36).toString(36)).join("");
  return `o${Math.floor(naa).toString(36)}${r}`;
}

// YYYY-MM-DD i lokal tid, som datoen på en time.
export function isoDato(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// { start, plan, stopp: [vis] } → teksten som lagres (JSON), eller "" uten
// gyldige stopp. Blir teksten for lang for reglene, kuttes de siste stoppene,
// og kopien merkes avkortet (et par hundre stopp får plass).
export function skrivKopi({ start = "", plan = null, stopp = [] } = {}) {
  const liste = (Array.isArray(stopp) ? stopp : []).filter((v) => typeof v === "string" && parseVisVerdi(v));
  if (!liste.length) return "";
  const lag = (n, avkortet) => JSON.stringify({
    v: 1,
    start: typeof start === "string" ? start : "",
    plan: typeof plan === "string" && plan ? plan : null,
    stopp: liste.slice(0, n),
    ...(avkortet ? { avkortet: true } : {}),
  });
  let tekst = lag(liste.length, false);
  let n = liste.length;
  while (tekst.length > KOPI_MAKS && n > 1) tekst = lag(--n, true);
  return tekst.length > KOPI_MAKS ? "" : tekst;
}

// Et dokument fra notater → { okt, start, plan, stopp: [{ vis }], oppdatert,
// avkortet }, eller null når det ikke er en gyldig kopi med stopp.
export function lesKopi(nokkel, dok) {
  if (!erKopiNokkel(nokkel) || typeof dok?.tekst !== "string") return null;
  let d = null;
  try { d = JSON.parse(dok.tekst); } catch (e) { return null; }
  if (!d || typeof d !== "object" || !Array.isArray(d.stopp)) return null;
  const sett = new Set();
  const stopp = [];
  for (const vis of d.stopp) {
    if (typeof vis !== "string" || !parseVisVerdi(vis) || sett.has(vis)) continue;
    sett.add(vis);
    stopp.push({ vis });
  }
  if (!stopp.length) return null;
  const gyldig = (t) => typeof t === "string" && !Number.isNaN(Date.parse(t));
  return {
    okt: String(nokkel).slice(KOPI_PREFIKS.length),
    start: gyldig(d.start) ? d.start : "",
    plan: typeof d.plan === "string" && d.plan ? d.plan : null,
    stopp,
    oppdatert: gyldig(dok.oppdatert) ? dok.oppdatert : "",
    avkortet: d.avkortet === true,
  };
}

// Kopiene i notatene, nyeste først. `unntatt` er økta som pågår i denne fanen:
// den er ikke ulagret, den er i gang.
export function ulagredeKopier(notater, { unntatt = null } = {}) {
  const tid = (k) => k.start || k.oppdatert;
  return Object.entries(notater || {})
    .map(([nokkel, dok]) => lesKopi(nokkel, dok))
    .filter((k) => k && k.okt !== unntatt)
    .sort((a, b) => String(tid(b)).localeCompare(String(tid(a))));
}

export function erFersk(kopi, naa = Date.now()) {
  const t = Date.parse(kopi?.oppdatert || "");
  return Number.isFinite(t) && naa - t < FERSK_MS;
}

// Datoen timen får: dagen visningen startet (ikke dagen den lagres).
export function kopiDato(kopi, naa = new Date()) {
  const t = Date.parse(kopi?.start || kopi?.oppdatert || "");
  return isoDato(Number.isFinite(t) ? new Date(t) : naa);
}
