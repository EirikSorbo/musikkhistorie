// ============================================================================
//  SAMLEPAKKEN TIL STUDENTENE: BYGGEREN (v7.46, fase 1 i planen av 2026-11-17)
// ----------------------------------------------------------------------------
//  Kjører i lærerens nettleser, på alle sidene som henter de delte samlingene
//  (shared-data.js starter den), og bare når innloggingen er læreren: Google,
//  bekreftet e-post i TEACHER_EMAILS, samme sjekk som isTeacher() i reglene.
//  Studentene starter den aldri.
//
//  Byggeren lytter på de samme kildene som sidene (Firestore deler målet, så
//  det koster ingen ekstra lesinger) og på pakken i config. Den bygger bare når
//  ALLE kildene og pakken er ferske fra serveren og ingen lagringer venter:
//  ellers kunne en gammel lokal kopi skrive over en nyere pakke. Den venter
//  VENT_MS etter siste endring (høyst MAKS_VENT_MS), så en import eller en
//  rekke lagringer gir én ny pakke, og skriver bare delene som er endret, i én
//  batch (studentpakke-modell.js). Når siden skjules, bygges det med en gang.
//
//  Ved hver åpning sammenlignes pakken med kildene, så endringer gjort et
//  annet sted (Firebase-konsollen, en fane som ble lukket for tidlig) kommer
//  med neste gang læreren er innom. Det er også selvsjekken: statuslinja på
//  Skrivebordet (teacher-desk.js) sier «oppdatert» bare når pakken på
//  serveren er nøyaktig det kildene gir.
//
//  Fase 1: ingen leser pakken ennå. Fra fase 2 gjør studentsidene det.
// ============================================================================

import { onAuthChange, lyttRaa, lyttStudentpakke, skrivStudentpakke } from "./store.js";
import {
  PAKKE_KILDER, MANIFEST_ID, PakkeFeil, byggPakke, pakkeEndringer, gjeldendePakke,
  manifestDok, delDok, delDokId, aktivFra,
} from "./studentpakke-modell.js";
import { TEACHER_EMAILS } from "../firebase-config.js";
import { VERSION } from "../version.js";

const VENT_MS = 3000;
const MAKS_VENT_MS = 15000;

export const erPakkeLaerer = (u) => !!u && !u.isAnonymous && u.emailVerified === true
  && TEACHER_EMAILS.includes(u.email) && (u.providerData || []).some((p) => p.providerId === "google.com");

let initiert = false;
let startet = false;
let lyttere = [];
let kilder = {};            // kilde-id → { docs, fersk }
let pakke = { fersk: false, gjeldende: null };
let bygd = null;            // siste byggPakke-resultat
let skitten = true;         // kildene er endret siden bygd ble laget
let tidtaker = null;
let forsteEndring = 0;
let skriver = false;
let status = { tilstand: "av" };

// tilstand: «av» (ikke læreren), «venter» (venter: [navn]), «bygger»,
// «oppdatert» (bygget, deler, bytes) eller «feil» (melding).
export function pakkeStatus() {
  return status;
}

function settStatus(ny) {
  if (JSON.stringify(ny) === JSON.stringify(status)) return;
  status = ny;
  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("pensum:studentpakke", { detail: status }));
  }
}

function ventesPaa() {
  const ut = PAKKE_KILDER.filter((k) => !kilder[k.id]?.fersk).map((k) => k.navn);
  if (!pakke.fersk) ut.push("studentversjonen");
  return ut;
}

function oppdatert(m) {
  return {
    tilstand: "oppdatert",
    bygget: m?.bygget || null,
    deler: Object.keys(m?.deler || {}).length,
    bytes: m?.bytes || 0,
    aktiv: m?.aktiv !== false,
  };
}

function planlegg({ straks = false } = {}) {
  if (!startet) return;
  const venter = ventesPaa();
  if (venter.length) {
    clearTimeout(tidtaker);
    tidtaker = null;
    // «bygger» og «feil» står til byggingen er ferdig eller noe nytt skjer.
    if (!skriver && status.tilstand !== "feil" && status.tilstand !== "bygger") settStatus({ tilstand: "venter", venter });
    return;
  }
  const naa = Date.now();
  if (!forsteEndring) forsteEndring = naa;
  const vent = straks ? 0 : Math.max(0, Math.min(VENT_MS, forsteEndring + MAKS_VENT_MS - naa));
  clearTimeout(tidtaker);
  tidtaker = setTimeout(bygg, vent);
}

async function bygg() {
  tidtaker = null;
  if (!startet || skriver) return;
  if (ventesPaa().length) {
    planlegg();
    return;
  }
  forsteEndring = 0;
  if (skitten || !bygd) {
    try {
      bygd = byggPakke(Object.fromEntries(PAKKE_KILDER.map((k) => [k.id, kilder[k.id].docs])));
      skitten = false;
    } catch (e) {
      bygd = null;
      if (!(e instanceof PakkeFeil)) console.error("Studentversjonen kunne ikke bygges:", e);
      settStatus({ tilstand: "feil", melding: e instanceof PakkeFeil ? e.message : `Uventet feil: ${e?.message || e}` });
      return;
    }
  }
  const gjeldende = pakke.gjeldende;
  const endringer = pakkeEndringer(bygd, gjeldende);
  if (!endringer.manifest) {
    settStatus(oppdatert(gjeldende.manifest));
    return;
  }
  skriver = true;
  settStatus({ tilstand: "bygger" });
  const delPaaId = new Map(bygd.deler.map((d) => [d.id, d]));
  try {
    await skrivStudentpakke({
      sett: [
        ...endringer.skriv.map((id) => ({ id: delDokId(id), data: delDok(delPaaId.get(id)) })),
        {
          id: MANIFEST_ID,
          data: manifestDok(bygd, { aktiv: aktivFra(gjeldende), bygget: new Date().toISOString(), appVersjon: VERSION }),
        },
      ],
      slett: endringer.slett.map(delDokId),
    });
  } catch (e) {
    console.warn("Studentversjonen ble ikke lagret:", e?.code || "", e?.message || e);
    settStatus({ tilstand: "feil", melding: `Lagringen feilet (${e?.code || e?.message || e}).` });
    return;
  } finally {
    skriver = false;
  }
  // Pakke-lytteren får skrivingen bekreftet fra serveren, og da sammenlignes
  // det på nytt (og statusen blir «oppdatert»).
  planlegg();
}

function lesefeil(navn) {
  return (e) => {
    console.warn(`Studentversjonen fikk ikke lest ${navn}:`, e?.code || "", e?.message || e);
    settStatus({ tilstand: "feil", melding: `Fikk ikke lest ${navn} (${e?.code || e?.message || e}).` });
  };
}

function start() {
  if (startet) return;
  startet = true;
  kilder = {};
  pakke = { fersk: false, gjeldende: null };
  bygd = null;
  skitten = true;
  forsteEndring = 0;
  status = { tilstand: "av" };
  settStatus({ tilstand: "venter", venter: ventesPaa() });
  for (const k of PAKKE_KILDER) {
    lyttere.push(lyttRaa(k.samling, k.dok || null, ({ docs, fersk, endret }) => {
      const forrige = kilder[k.id];
      kilder[k.id] = { docs, fersk };
      if (endret || !forrige) skitten = true;
      planlegg();
    }, lesefeil(k.navn)));
  }
  lyttere.push(lyttStudentpakke(({ docs, fersk }) => {
    pakke = { fersk, gjeldende: gjeldendePakke(docs) };
    planlegg();
  }, lesefeil("studentversjonen")));
}

function stopp() {
  if (!startet) return;
  startet = false;
  for (const u of lyttere) u();
  lyttere = [];
  clearTimeout(tidtaker);
  tidtaker = null;
  settStatus({ tilstand: "av" });
}

// Kalles av shared-data.js. Trygg å kalle flere ganger.
export function startStudentpakke() {
  if (initiert) return;
  initiert = true;
  onAuthChange((u) => (erPakkeLaerer(u) ? start() : stopp()));
  if (typeof document !== "undefined") {
    // Skjules siden mens byggingen venter, bygges det straks.
    const naa = () => {
      if (!tidtaker) return;
      clearTimeout(tidtaker);
      bygg();
    };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") naa(); });
    window.addEventListener("pagehide", naa);
  }
}

// «Bygg på nytt» på Skrivebordet: bygg av kildene med en gang og sammenlign.
export function byggStudentpakkeNaa() {
  if (!startet) return;
  skitten = true;
  if (status.tilstand === "feil") settStatus({ tilstand: "venter", venter: ventesPaa() });
  planlegg({ straks: true });
}
