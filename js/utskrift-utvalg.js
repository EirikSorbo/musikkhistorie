// ============================================================================
//  UTSKRIFT — utvalget i nettleseren (v5.56)
// ----------------------------------------------------------------------------
//  Det studenten har valgt til heftet: en liste med vis-verdier, tittelen,
//  delene og formen, lagret i localStorage («pensum-utskrift») per nettleser,
//  samme sted som rollevalget. Studentene er anonyme, så det finnes ingen
//  konto å lagre på, og en delt lenke (utskrift.html?u=…) bærer utvalget
//  mellom nettlesere.
//
//  Modulen kobler også «Ta med i utskriften»-knappen i kortenes tittellinje
//  (samme plass som samleøktas plussknapp, js/plan-innsamling.js) og merket
//  på skriverikonet i toppmenyen. Knappen bæres av modalens data-vis, som
//  åpnerne setter for hvert lenkbart kort. En MutationObserver følger
//  åpning (class) og målbytte (data-vis) i alle modaler, også de som lages
//  etter oppstart, så ingen åpner må vite om knappen.
//
//  Selve reglene (hva som kan stå i et hefte, kanonisk form, hva et valg
//  drar med seg) bor i js/utskrift-modell.js, som er DOM-fri og testet.
//
//  Utvalget har to lister (v5.58): `valg` (det studenten har valgt) og
//  `fravalg` (det studenten har huket bort av det valget drar med seg). Om
//  et kort ER med, avgjøres av utvidUtvalg i modellen, som trenger artistene:
//  sidene gir initUtskriftValg en hentData-funksjon, så «Ta med»-knappen kan
//  vise riktig tilstand også for kort som følger med en metasjanger.
// ============================================================================

import { kanoniskVis, normaliserUtvalg, normaliserLagret, normaliserTittel, planTilUtvalg, utvidUtvalg, barnAv } from "./utskrift-modell.js?v=5.71";
import { isVisible } from "./limits.js?v=5.71";
import { escapeHtml } from "./util.js?v=5.71";

const NOKKEL = "pensum-utskrift";
export const UTSKRIFT_HENDELSE = "pensum:utskrift-endret";

const tomt = () => normaliserLagret(null);

export function lesUtvalg() {
  let raa = null;
  try { raa = JSON.parse(localStorage.getItem(NOKKEL) || "null"); } catch (e) { /* blokkert eller ødelagt: tomt */ }
  return normaliserLagret(raa);
}

export function lagreUtvalg(u) {
  const n = normaliserLagret(u);
  try { localStorage.setItem(NOKKEL, JSON.stringify(n)); } catch (e) { /* privat modus e.l.: virker for økta */ }
  meld();
  return n;
}

function meld() {
  oppdaterMerker();
  document.querySelectorAll(".modal-backdrop.open").forEach(oppdaterKnapp);
  oppdaterKortKnapper();
  document.dispatchEvent(new CustomEvent(UTSKRIFT_HENDELSE));
}

export function antall() { return lesUtvalg().valg.length; }

// Sidens data (state), satt av initUtskriftValg. Uten den regnes bare de
// valgte postene som «med» (skjemasiden har ingen kort å åpne uansett).
let hentData = null;

const synligeArtister = () => ((hentData?.() || {}).artists || []).filter(isVisible);

// Det utvalget drar med seg akkurat nå: Map vis → opphav (se utvidUtvalg).
// Huskes (v5.69): harMed kalles én gang per kort når artistlistene tegnes,
// og utvidUtvalg går gjennom alle artistene hver gang. Nøkkelen er det som
// faktisk ligger lagret pluss sidens artist- og beskrivelsesreferanser, så
// et nytt snapshot eller en lagring regner på nytt.
let avledetHusk = { raa: null, artister: null, descs: null, map: null };
function avledet(u) {
  const s = hentData?.() || {};
  let raa = null;
  try { raa = localStorage.getItem(NOKKEL); } catch (e) { /* som i lesUtvalg */ }
  const h = avledetHusk;
  if (h.map && h.raa === raa && h.artister === s.artists && h.descs === s.genreDescs) return h.map;
  const map = utvidUtvalg(u.valg, u.fravalg, synligeArtister(), new Date().getFullYear(), s.genreDescs || {}).kilde;
  avledetHusk = { raa, artister: s.artists, descs: s.genreDescs, map };
  return map;
}

// Står kortet i heftet: valgt, eller dratt med av et valg og ikke huket bort.
// Bortvalget sjekkes FØRST (v5.69): et valg kan stå avhuket i lista (v5.59),
// og heftet holder det utenfor (modellen: med = !bort.has). Med valget
// sjekket først meldte knappen «er med» etter «ta ut», og veksle kom aldri
// ut av det igjen.
export function harMed(vis) {
  const k = kanoniskVis(vis);
  if (!k) return false;
  const u = lesUtvalg();
  if (u.fravalg.includes(k)) return false;
  if (u.valg.includes(k)) return true;
  return avledet(u).has(k);
}

// Legger til ett eller flere mål. Et nytt valg opphever bortvalget av posten
// og av det den drar med seg (barnAv). Returnerer hvor mange som var nye.
export function leggTil(vis) {
  const liste = normaliserUtvalg(Array.isArray(vis) ? vis : [vis]);
  const u = lesUtvalg();
  const nye = normaliserUtvalg([...u.valg, ...liste]);
  const lagt = nye.length - u.valg.length;
  const artister = synligeArtister();
  const opphev = new Set(liste.flatMap((v) => [v, ...barnAv(v, artister)]));
  const fravalg = u.fravalg.filter((v) => !opphev.has(v));
  if (lagt || fravalg.length !== u.fravalg.length) {
    u.valg = nye;
    u.fravalg = fravalg;
    lagreUtvalg(u);
  }
  return lagt;
}

// Avkryssingen i utskriftspanelet (v5.59). Av: posten og alt den drar med
// seg (barnAv: sjangrene og artistene til en metasjanger, artistene til en
// sjanger) huskes som bortvalgt. Posten blir stående i valget, så den og
// barna står igjen i lista som avhukede alternativer. På: bortvalget
// oppheves for posten og barna; `eksplisitt` (metasjangerraden, som aldri
// utledes) legger posten inn i valget om den ikke alt står der.
export function huk(vis, paa, { eksplisitt = false } = {}) {
  const k = kanoniskVis(vis);
  if (!k) return;
  const u = lesUtvalg();
  const berort = new Set([k, ...barnAv(k, synligeArtister())]);
  if (paa) {
    u.fravalg = u.fravalg.filter((v) => !berort.has(v));
    if (eksplisitt && !u.valg.includes(k)) u.valg = [...u.valg, k];
  } else {
    u.fravalg = normaliserUtvalg([...u.fravalg, ...berort]);
  }
  lagreUtvalg(u);
}

export function fjern(vis) {
  const k = kanoniskVis(vis);
  const u = lesUtvalg();
  if (!k || !u.valg.includes(k)) return;
  u.valg = u.valg.filter((v) => v !== k);
  lagreUtvalg(u);
}

// Ta med eller ta ut («Ta med i utskriften» i kortenes tittellinje).
// Returnerer true når målet ble lagt til. Ut = bortvalg (huk av), som i
// panelet, så kortet står igjen i lista der.
export function veksle(vis) {
  if (harMed(vis)) { huk(vis, false); return false; }
  leggTil(vis);
  return true;
}

export function toem() { lagreUtvalg(tomt()); }

// En kjøreplan som utvalg (knappen «Til utskrift» i Visning-vinduet):
// stoppene i planens rekkefølge, planens tittel som forslag, og
// rekkefølgen «som valgt», siden læreren har ordnet stoppene med vilje.
// `erstatt: false` legger stoppene til det som alt ligger der.
export function settFraPlan(plan, artister, planId = "", { erstatt = true } = {}) {
  const fraPlan = planTilUtvalg(plan?.stopp, artister);
  const u = erstatt ? tomt() : lesUtvalg();
  u.valg = normaliserUtvalg([...u.valg, ...fraPlan]);
  if (erstatt) {
    u.tittel = normaliserTittel(plan?.tittel || "");
    u.form.rekkefolge = "valgt";
    u.plan = { id: String(planId || ""), tittel: normaliserTittel(plan?.tittel || "") };
  }
  return lagreUtvalg(u);
}

// ----------------------------------------------------------------------------
//  Merket på skriverikonet
// ----------------------------------------------------------------------------

export function oppdaterMerker() {
  const n = antall();
  document.querySelectorAll("[data-utskrift-antall]").forEach((el) => {
    el.textContent = n ? String(n) : "";
    el.hidden = !n;
  });
}

// ----------------------------------------------------------------------------
//  «Ta med i utskriften» i kortenes tittellinje
// ----------------------------------------------------------------------------

// ÉN måte å sende til PDF på i hele appen (brukervalg 2026-09-25, v5.67):
// det samme skriverikonet som i toppmenyen, uten pil (pilen ble et hakk på
// 16 piksler, v5.66). Brukes i kortenes tittellinje (her), i Finn artister
// (landing.js) og ved kjøreplanene (visning.js). Haken er kvitteringen
// «lagt til» / «er med», hjelpeteksten sier hva knappen gjør.
export const TIL_UTSKRIFT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>';
export const UTSKRIFT_HAKE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

const TITTEL_MED = "Tatt med i utskriften. Klikk for å ta den ut.";
const TITTEL_UTEN = "Ta med i utskriften";

function knappTilstand(b, k) {
  const med = harMed(k);
  b.classList.toggle("er-med", med);
  b.innerHTML = med ? UTSKRIFT_HAKE_SVG : TIL_UTSKRIFT_SVG;
  b.title = med ? TITTEL_MED : TITTEL_UTEN;
  // Kortknappene bærer navnet (data-navn), så skjermleseren hører hvem det gjelder.
  b.setAttribute("aria-label", b.dataset.navn ? `${b.dataset.navn}: ${b.title}` : b.title);
  b.setAttribute("aria-pressed", med ? "true" : "false");
}

// ----------------------------------------------------------------------------
//  Knappen på kortene og radene i artistlistene (v5.69)
// ----------------------------------------------------------------------------

// Samme knapp som i modalhodet, men rett på kortet og raden i «Finn artister»,
// sjanger-popupen og slektstreet: studenten skal kunne legge en artist i
// heftet uten å åpne kortet først. To former: den runde på radene, ved siden
// av samleøktas plussknapp (kortPlussHtml i js/ui.js), og `knapp` = samme
// knappeform som listeknappen (btn ghost small utskrift-ikonknapp) nederst i
// de fulle kortenes fotlinje (brukervalg 2026-09-26, v5.70). Tilstanden
// regnes ved rendering (listene tegnes på nytt ved hvert snapshot), og
// meld() holder alle knappene med samme mål i takt etterpå. Klikket fanges
// delegert i initUtskriftValg, så listene vet ingenting om utvalget. Bare
// artister studentene ser kan stå i heftet.
export function kortUtskriftHtml(a, { knapp = false } = {}) {
  if (!a || !isVisible(a)) return "";
  const k = kanoniskVis(`artist:${a.id}`);
  if (!k) return "";
  const med = harMed(k);
  const tittel = med ? TITTEL_MED : TITTEL_UTEN;
  const klasse = `${knapp ? "btn ghost small utskrift-ikonknapp " : ""}kort-utskrift${med ? " er-med" : ""}`;
  return `<button type="button" class="${klasse}" data-vis="${escapeHtml(k)}" data-navn="${escapeHtml(a.name)}" title="${escapeHtml(tittel)}" aria-label="${escapeHtml(`${a.name}: ${tittel}`)}" aria-pressed="${med ? "true" : "false"}">${med ? UTSKRIFT_HAKE_SVG : TIL_UTSKRIFT_SVG}</button>`;
}

function oppdaterKortKnapper() {
  document.querySelectorAll(".kort-utskrift[data-vis]").forEach((b) => knappTilstand(b, b.dataset.vis));
}

// Knappen følger modalens mål: skjult når kortet ikke kan stå i et hefte.
function oppdaterKnapp(modal) {
  const b = modal?.querySelector?.(".modal-head .utskrift-ta-med");
  if (!b) return;
  const k = kanoniskVis(modal.dataset.vis || "");
  b.hidden = !k;
  if (k) knappTilstand(b, k);
}

// Idempotent: bare hoder som kan bære et mål (de har lenkeknappen fra
// v5.22). Settes inn før samleøktas plussknapp når den finnes, ellers før
// lenkeknappen, så rekkefølgen i hodet er fast: utskrift, pluss, lenke.
function monterKnapper() {
  document.querySelectorAll(".modal-backdrop .modal-head").forEach((head) => {
    if (head.querySelector(".utskrift-ta-med")) return;
    const lenke = head.querySelector(".modal-lenke");
    if (!lenke) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "utskrift-ta-med btn ghost small";
    b.hidden = true;
    b.innerHTML = TIL_UTSKRIFT_SVG;
    b.addEventListener("click", () => {
      const modal = b.closest(".modal-backdrop");
      const k = kanoniskVis(modal?.dataset.vis || "");
      if (!k) return;
      veksle(k);
      knappTilstand(b, k);
    });
    head.insertBefore(b, head.querySelector(".plan-pluss") || lenke);
  });
}

let observator = null;

function startObservator() {
  if (observator || !("MutationObserver" in window)) return;
  observator = new MutationObserver((mutasjoner) => {
    for (const m of mutasjoner) {
      const el = m.target;
      if (!el.classList?.contains("modal-backdrop")) continue;
      if (m.attributeName === "class" && !el.classList.contains("open")) continue;
      monterKnapper();
      oppdaterKnapp(el);
    }
  });
  observator.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "data-vis"] });
}

// Kalles fra sidenes oppstart, etter at modalene er injisert. Sider uten
// modaler (skjemasiden) får bare merket på skriverikonet. `hentData` gir
// sidens state (artister og sjangerbeskrivelser), så harMed kan regne ut
// hva som følger med.
export function initUtskriftValg({ hentData: hent = null } = {}) {
  if (hent) hentData = hent;
  if (document.body.dataset.utskriftValg) return;
  document.body.dataset.utskriftValg = "1";
  monterKnapper();
  document.querySelectorAll(".modal-backdrop.open").forEach(oppdaterKnapp);
  startObservator();
  oppdaterMerker();
  // Knappen på kortene og radene (v5.69): ett delegert klikk for alle lister,
  // også de som tegnes senere. Radene hopper selv over klikk på knapper, så
  // kortet åpnes ikke i tillegg.
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".kort-utskrift");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const k = kanoniskVis(b.dataset.vis || "");
    if (!k) return;
    veksle(k);
  });
  // Endret i en annen fane: merket og åpne kort skal vise det samme her.
  window.addEventListener("storage", (e) => {
    if (e.key === NOKKEL) meld();
  });
}
