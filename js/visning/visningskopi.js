// ============================================================================
//  SIKKERHETSKOPI AV VISNINGEN (v7.15), kjøringen
// ----------------------------------------------------------------------------
//  Skrivingen og lista over kopiene som står igjen. Begrunnelsen og formatet
//  står i visningskopi-modell.js.
//
//  Skrivingen: høyst hvert tiende sekund, og med en gang fanen skjules eller
//  forlates (sidebytte til slektstreet, lukket nettleser). Firestore holder en
//  skriving som ikke kom fram, i den lokale hurtigbufferen og sender den neste
//  gang appen åpnes. Kalleren (presentasjon.js) sørger for at bare lærerens
//  eget vindu skriver, ikke lerretet.
//
//  Lista: abonnerer på notatene bare når en lærerkonto er innlogget, som
//  slidene. Samme spørring som slidene og notatene, så Firestore lytter én gang.
// ============================================================================

import { onAuthChange, subscribeNotater, lagreNotat } from "../data/store.js";
import { TEACHER_EMAILS } from "../firebase-config.js";
import { kopiNokkel, skrivKopi, ulagredeKopier } from "./visningskopi-modell.js";

const INTERVALL_MS = 10000;
let venter = null;   // { okt, data }: det som skal skrives neste gang
let timer = null;
let sistSkrevet = 0;
let sistTekst = "";

// Ber om en skriving av økta. Den første skjer med en gang, de neste høyst
// hvert tiende sekund (siste tilstand vinner).
export function kopierVisning(okt, data) {
  if (!okt) return;
  venter = { okt, data };
  if (timer) return;
  timer = setTimeout(skrivNaa, Math.max(0, sistSkrevet + INTERVALL_MS - Date.now()));
}

export function skrivNaa() {
  clearTimeout(timer);
  timer = null;
  if (!venter) return;
  const { okt, data } = venter;
  venter = null;
  const tekst = skrivKopi(data);
  if (!tekst || tekst === sistTekst) return;
  sistTekst = tekst;
  sistSkrevet = Date.now();
  lagreNotat(kopiNokkel(okt), tekst).catch((err) => {
    sistTekst = "";
    console.warn("Fikk ikke tatt sikkerhetskopi av visningen:", err?.message || err);
  });
}

// Avslutt (lagret eller ikke) og «Forkast»: kopien slettes, og en ventende
// skriving av SAMME økt glemmes, så den ikke lager kopien på nytt.
export function slettKopi(okt) {
  if (venter?.okt === okt) {
    clearTimeout(timer);
    timer = null;
    venter = null;
    sistTekst = "";
  }
  return lagreNotat(kopiNokkel(okt), "");
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") skrivNaa(); });
  window.addEventListener("pagehide", skrivNaa);
}

// --- Kopiene som står igjen ---------------------------------------------------

let kopier = [];
let lastet = false;
let avmeld = null;
let startet = false;
let unntattFn = () => null;
const lyttere = new Set();

export const ulagrede = () => kopier;
export const kopierLastet = () => lastet;
export function vedKopiEndring(fn) { lyttere.add(fn); }
function varsle() { lyttere.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } }); }

const erLaerer = (user) => !!user && !user.isAnonymous && TEACHER_EMAILS.includes(user.email);

// Kalles én gang per side. `unntatt` gir økta som pågår i denne fanen.
export function startKopivakt({ unntatt } = {}) {
  if (startet) return;
  startet = true;
  if (typeof unntatt === "function") unntattFn = unntatt;
  onAuthChange((user) => {
    if (erLaerer(user)) {
      if (avmeld) return;
      avmeld = subscribeNotater((n) => {
        kopier = ulagredeKopier(n, { unntatt: unntattFn() });
        lastet = true;
        varsle();
      }, () => { avmeld = null; });
    } else if (avmeld || lastet) {
      avmeld?.();
      avmeld = null;
      kopier = [];
      lastet = false;
      varsle();
    }
  });
}
