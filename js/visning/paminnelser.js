// ============================================================================
//  PÅMINNELSER I VISNINGEN (v6.70, brukerbestilling 2026-10-11)
// ----------------------------------------------------------------------------
//  Læreren legger påminnelser inn i kjøreplan-editoren (visning.js): enten et
//  antall minutter etter at planen ble startet, eller et klokkeslett. Når
//  tiden er inne, dukker et kort opp øverst på midten av lærerens skjerm og
//  blir stående til det lukkes. En påminnelse merket «Vis også på lerretet»
//  vises i tillegg på lerretet (lerret.js henter dem via tilstanden). Navn på
//  artister, sjangre og innovasjoner blir lenker, som i beskrivelsene.
//
//  Lagring: samlingen notater (bare læreren kan lese den), ett dokument per
//  plan med nøkkelen paminnelseNokkel(planId) og lista som JSON i tekst. Selve
//  planene ligger i content, som alle kan lese. Reglene for notater er
//  uendret. Rensing og tidsregning er rene funksjoner i presentasjon-modell.js.
//
//  Starttiden og hva som er vist og lukket, står i sessionStorage, så en
//  omlasting eller et sidebytte (slektstreet) ikke starter klokka på nytt
//  eller viser lukkede påminnelser igjen.
//
//  v6.72: raske påminnelser (tasten R) gjelder bare visningen som går. De
//  står i sessionStorage med et fast tidspunkt (type «naar») og vises også
//  uten innlogging; de lagrede (kjøreplanenes) trenger læreren (samlingen
//  notater). Fri visning har planId FRI_PLAN («fri») og ingen lagret liste:
//  den faste lista fra v6.72 er erstattet av tidsknappene i v6.74.
//  v6.74: et klikk på en lenke i påminnelsen åpner kortet og lukker påminnelsen.
// ============================================================================

import { subscribeNotater, lagreNotat } from "../data/store.js";
import {
  lesPaminnelser, skrivPaminnelser, paminnelseNokkel, forfalnePaminnelser, paminnelseEtikett,
  rensPaminnelser, RASK_MAKS, FRI_PLAN,
} from "./presentasjon-modell.js";
import { renderRichText } from "../felles/rich-text.js";
import { wireAllLinks } from "../felles/linkify.js";
import { buildLinkCtx } from "../utforsk/explore-context.js";
import { escapeHtml } from "../felles/util.js";

// --- Dataene (læreren) --------------------------------------------------------

let data = {};        // planId → liste
let lastet = false;
let feil = "";
let avmeld = null;
const lyttere = new Set();

function varsle() { lyttere.forEach((f) => { try { f(); } catch (e) { console.warn(e); } }); }

// Abonnerer når læreren er innlogget (kalles igjen ufarlig).
export function abonnerPaminnelser() {
  if (avmeld) return;
  avmeld = subscribeNotater((alle) => {
    const ny = {};
    for (const [nokkel, v] of Object.entries(alle || {})) {
      if (nokkel.startsWith("paminnelser:")) ny[nokkel.slice("paminnelser:".length)] = lesPaminnelser(v?.tekst);
    }
    data = ny;
    lastet = true;
    feil = "";
    varsle();
  }, (err) => {
    feil = err?.code === "permission-denied"
      ? "Påminnelsene kan ikke leses før Firestore-reglene for notater er publisert."
      : `Påminnelsene kunne ikke leses (${err?.message || err}).`;
    lastet = true;
    varsle();
  });
}

export const vedPaminnelseEndring = (f) => { lyttere.add(f); };
export const paminnelserFor = (planId) => (data[planId] || []).map((p) => ({ ...p }));
export const paminnelserLastet = () => lastet;
export const paminnelseFeil = () => feil;
export const lagrePaminnelser = (planId, liste) => lagreNotat(paminnelseNokkel(planId), skrivPaminnelser(liste));

// --- I visningen (lærerens vindu) ----------------------------------------------

let planAktiv = null;
let startMs = null;
let erLaerer = () => false;
let lerretEndret = () => {};
let nokler = null;      // sessionStorage-nøklene fra presentasjon.js
let status = { vist: [], lukket: [] };
let raske = [];         // raske påminnelser i denne visningen (v6.72)
let aapne = [];
let timer = null;

const lesJson = (k, standard) => { try { return JSON.parse(sessionStorage.getItem(k) || "null") ?? standard; } catch (e) { return standard; } };
const skrivJson = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function startPaminnelser({ planId, erLaererNaa, startNokkel, statusNokkel, raskNokkel, vedLerretEndring }) {
  if (!planId || planAktiv) return;
  planAktiv = planId;
  nokler = { start: startNokkel, status: statusNokkel, rask: raskNokkel };
  if (typeof erLaererNaa === "function") erLaerer = erLaererNaa;
  if (typeof vedLerretEndring === "function") lerretEndret = vedLerretEndring;
  // Klokka følger planen: samme plan beholder starttiden, en annen begynner på nytt.
  let start = lesJson(startNokkel, null);
  if (!start || start.plan !== planId || !Number.isFinite(start.ms)) {
    start = { plan: planId, ms: Date.now() };
    skrivJson(startNokkel, start);
    skrivJson(statusNokkel, { vist: [], lukket: [] });
    // En ny visning: de raske fra en tidligere visning i fanen gjelder ikke.
    if (raskNokkel) skrivJson(raskNokkel, []);
  }
  startMs = start.ms;
  raske = raskNokkel ? rensPaminnelser(lesJson(raskNokkel, [])).filter((p) => p.type === "naar") : [];
  const s = lesJson(statusNokkel, {});
  status = { vist: Array.isArray(s.vist) ? s.vist : [], lukket: Array.isArray(s.lukket) ? s.lukket : [] };
  vedPaminnelseEndring(sjekk);
  timer = setInterval(sjekk, 10000);
  paminnelserAuthEndret();
  sjekk();   // de raske vises også uten innlogging
}

// Innloggingen kan lande etter at visningen startet.
export function paminnelserAuthEndret() {
  if (!planAktiv || !erLaerer()) return;
  abonnerPaminnelser();
  sjekk();
}

function sjekk() {
  if (!planAktiv) return;
  // De lagrede trenger læreren og dataene; de raske står lokalt. Fri visning
  // har ingen lagret liste (v6.74), så en gammel paminnelser:fri leses ikke.
  const lagret = erLaerer() && lastet && planAktiv !== FRI_PLAN ? (data[planAktiv] || []) : [];
  const liste = [...lagret, ...raske];
  const naa = Date.now();
  const nye = [...forfalnePaminnelser(lagret, startMs, naa, status.vist), ...forfalnePaminnelser(raske, startMs, naa, status.vist)];
  if (nye.length) {
    status.vist.push(...nye.map((p) => p.id));
    skrivJson(nokler.status, status);
  }
  const lerretFor = JSON.stringify(paminnelserTilLerret());
  aapne = liste.filter((p) => status.vist.includes(p.id) && !status.lukket.includes(p.id));
  tegn(aapne, { lukkbar: true });
  if (JSON.stringify(paminnelserTilLerret()) !== lerretFor) lerretEndret();
}

function lukk(id) {
  if (!status.lukket.includes(id)) status.lukket.push(id);
  skrivJson(nokler.status, status);
  sjekk();
}

// --- Raske påminnelser (v6.72) ------------------------------------------------

// Legger til en ren påminnelse fra raskPaminnelse (modellen). false når
// visningen ikke har startet påminnelsene, eller taket er nådd.
export function leggTilRask(p) {
  if (!planAktiv || !nokler?.rask || !p || raske.length >= RASK_MAKS) return false;
  raske = [...raske, p];
  skrivJson(nokler.rask, raske);
  sjekk();
  return true;
}

export function fjernRask(id) {
  raske = raske.filter((p) => p.id !== id);
  if (nokler?.rask) skrivJson(nokler.rask, raske);
  sjekk();
}

// De raske som ikke har kommet ennå, i tidsrekkefølge (for lista i panelet).
export const ventendeRaske = () => raske
  .filter((p) => !status.vist.includes(p.id))
  .sort((a, b) => a.naar - b.naar)
  .map((p) => ({ ...p, etikett: paminnelseEtikett(p) }));

export const paminnelserStartet = () => !!planAktiv;

// Det lerretet skal vise: åpne påminnelser merket «Vis også på lerretet».
export function paminnelserTilLerret() {
  return aapne.filter((p) => p.lerret).map((p) => ({ id: p.id, tekst: p.tekst, etikett: paminnelseEtikett(p) }));
}

// Lerretets side: tegner det styringen sender, uten lukkeknapp.
export function visLerretPaminnelser(liste) {
  tegn(Array.isArray(liste) ? liste : [], { lukkbar: false });
}

// --- Kortene -------------------------------------------------------------------

function boks() {
  let el = document.getElementById("pres-paminnelser");
  if (!el) {
    el = document.createElement("div");
    el.id = "pres-paminnelser";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.addEventListener("click", (e) => {
      const knapp = e.target.closest("[data-pam-lukk]");
      if (knapp) return lukk(knapp.dataset.pamLukk);
      lukkEtterLenke(e.target);
    });
    // Lenkene åpnes også med Enter og mellomrom (linkify.js).
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") lukkEtterLenke(e.target);
    });
    document.body.appendChild(el);
  }
  return el;
}

// En lenke i påminnelsen (v6.74, brukerønske 2026-10-11): kortet åpnes av
// lenkens egen lytter (linkify.js), og påminnelsen lukkes like etter, når
// kortet står. Bare i lærerens vindu: lerretet har ingen lukking.
const LENKE = ".artist-link, .tech-link, .genre-link, .plateselskap-link";
function lukkEtterLenke(mal) {
  const lenke = mal?.closest?.(LENKE);
  const id = lenke?.closest("[data-pam-id]")?.dataset.pamId;
  if (!id || !planAktiv || !nokler) return;
  setTimeout(() => lukk(id), 150);
}

let sistTegnet = "";

function tegn(liste, { lukkbar }) {
  // Lenkene bygges av artist- og innovasjonslistene. Kom kortet før de var
  // lastet (rett etter en omlasting eller et sidebytte), tegnes det på nytt
  // når de er der: sjekk() kaller tegn hvert 10. sekund (v6.74).
  const lc = liste.length ? buildLinkCtx() : null;
  const grunnlag = lc ? [(lc.artists || []).length, (lc.techItems || []).length, !!lc.onArtistClick] : [];
  const nokkel = JSON.stringify([liste.map((p) => [p.id, p.tekst, p.etikett || ""]), lukkbar, grunnlag]);
  if (nokkel === sistTegnet) return;
  sistTegnet = nokkel;
  const el = boks();
  if (!liste.length) { el.innerHTML = ""; return; }
  el.innerHTML = liste.map((p) => `
    <div class="pres-paminnelse" data-pam-id="${escapeHtml(p.id)}">
      <div class="pres-paminnelse-hode">
        <span>Påminnelse · ${escapeHtml(p.etikett || paminnelseEtikett(p))}${lukkbar && p.lerret ? " · også på lerretet" : ""}</span>
        ${lukkbar ? `<button type="button" class="pres-paminnelse-lukk" data-pam-lukk="${escapeHtml(p.id)}" aria-label="Lukk påminnelsen" title="Lukk">✕</button>` : ""}
      </div>
      <div class="rt">${renderRichText(p.tekst, lc)}</div>
    </div>`).join("");
  wireAllLinks(el, lc);
}
