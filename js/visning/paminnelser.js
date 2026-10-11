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
// ============================================================================

import { subscribeNotater, lagreNotat } from "../data/store.js";
import {
  lesPaminnelser, skrivPaminnelser, paminnelseNokkel, forfalnePaminnelser, paminnelseEtikett,
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
let aapne = [];
let timer = null;

const lesJson = (k, standard) => { try { return JSON.parse(sessionStorage.getItem(k) || "null") ?? standard; } catch (e) { return standard; } };
const skrivJson = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function startPaminnelser({ planId, erLaererNaa, startNokkel, statusNokkel, vedLerretEndring }) {
  if (!planId || planAktiv) return;
  planAktiv = planId;
  nokler = { start: startNokkel, status: statusNokkel };
  if (typeof erLaererNaa === "function") erLaerer = erLaererNaa;
  if (typeof vedLerretEndring === "function") lerretEndret = vedLerretEndring;
  // Klokka følger planen: samme plan beholder starttiden, en annen begynner på nytt.
  let start = lesJson(startNokkel, null);
  if (!start || start.plan !== planId || !Number.isFinite(start.ms)) {
    start = { plan: planId, ms: Date.now() };
    skrivJson(startNokkel, start);
    skrivJson(statusNokkel, { vist: [], lukket: [] });
  }
  startMs = start.ms;
  const s = lesJson(statusNokkel, {});
  status = { vist: Array.isArray(s.vist) ? s.vist : [], lukket: Array.isArray(s.lukket) ? s.lukket : [] };
  vedPaminnelseEndring(sjekk);
  timer = setInterval(sjekk, 10000);
  paminnelserAuthEndret();
}

// Innloggingen kan lande etter at visningen startet.
export function paminnelserAuthEndret() {
  if (!planAktiv || !erLaerer()) return;
  abonnerPaminnelser();
  sjekk();
}

function sjekk() {
  if (!planAktiv || !erLaerer() || !lastet) return;
  const liste = data[planAktiv] || [];
  const nye = forfalnePaminnelser(liste, startMs, Date.now(), status.vist);
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
      if (knapp) lukk(knapp.dataset.pamLukk);
    });
    document.body.appendChild(el);
  }
  return el;
}

let sistTegnet = "";

function tegn(liste, { lukkbar }) {
  const nokkel = JSON.stringify([liste.map((p) => [p.id, p.tekst, p.etikett || ""]), lukkbar]);
  if (nokkel === sistTegnet) return;
  sistTegnet = nokkel;
  const el = boks();
  if (!liste.length) { el.innerHTML = ""; return; }
  const lc = buildLinkCtx();
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
