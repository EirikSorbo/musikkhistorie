// ============================================================================
//  PRIVATE NOTATER I VISNINGEN (v6.50, brukerbestilling 2026-10-07)
// ----------------------------------------------------------------------------
//  Lærerens egne notater til kortene (artist, sjanger, innovasjon, tiår).
//  Tasten P viser og skjuler dem i et lite kort oppå lerretet, bare i
//  lærerens eget vindu: lerretet på prosjektoren (js/visning/lerret.js)
//  viser dem aldri. Hver visning starter med notatene skjult; valget huskes
//  ikke.
//
//  Notatene skrives i kortet selv («Rediger» eller «Skriv notat», eller
//  tasten Å, som går rett til redigering, v6.51) og lagres
//  i samlingen notater, som bare læreren kan lese (artistene og content kan
//  leses av alle). Nøkkelen er notatNokkel i presentasjon-modell.js. Kortet
//  viser notatet til det øverste åpne kortet som kan ha notater, så et
//  lytteeksempel oppå artistkortet ikke tar notatene bort.
//
//  Lærersiden (v6.58, brukerønske 2026-10-08): en «Notater»-knapp på
//  artist-, teknologi-, tiårs- og sjangerkortene i lærerviewet kaller
//  redigerNotatForKort(hva, id, navn) direkte — der står jo ALDRI et kort
//  åpent på lerretet (teacher.html presenterer ingenting). Boksen er den
//  SAMME som i visningen; bare målet kommer fra en knapp i stedet for det
//  øverste åpne kortet. aktivtKort() ser fortsatt FØRST etter et ekte åpent
//  kort (data-vis), så en reell presentasjon alltid vinner over et gammelt
//  admin-valg.
// ============================================================================

import { subscribeNotater, lagreNotat } from "../data/store.js";
import { notatNokkel } from "./presentasjon-modell.js";
import { parseVisVerdi } from "../felles/vis-lenke.js";
import { renderRichText } from "../felles/rich-text.js";
import { escapeHtml } from "../felles/util.js";
import { getState } from "../data/app-state.js";
import { GENEALOGY } from "../sjangre/genre-model.js";

let synlig = false;
let notater = {};
let lastet = false;
let feil = "";
let avmeld = null;
let redigerer = null;   // { nokkel, navn } mens læreren skriver, ellers null
let lagrer = false;
// Å trykket før notatene hadde landet: redigeringen starter når de kommer, så
// et tomt felt aldri lagres over et notat som finnes.
let redigerVedLasting = false;
let erLaerer = () => false;
// Satt av redigerNotatForKort (lærerviewets knapp), lest av aktivtKort() når
// INGEN ekte kort står åpent. Nullstilles når boksen lukkes manuelt, så den
// ikke blir stående og peker på et admin-kort neste gang P åpner boksen i en
// faktisk visning.
let overstyrtKort = null;

export function initNotater({ erLaererNaa } = {}) {
  if (typeof erLaererNaa === "function") erLaerer = erLaererNaa;
}

// Tasten P.
export function vekslNotater() {
  synlig = !synlig;
  if (!synlig) { redigerer = null; redigerVedLasting = false; overstyrtKort = null; }
  abonnerVedBehov();
  tegn();
}

// Lærerviewets «Notater»-knapp (v6.58) på artist-, teknologi-, tiårs- og
// sjangerkortene: samme boks og redigeringsflyt som tasten Å, men med et
// eksplisitt mål i stedet for det øverste åpne kortet — teacher.html har
// ingen lerret å lete etter et åpent kort på. `hva` er samme nøkkel som
// NOTAT_TYPER («artist», «tech», «tiår», «sjanger»), `id` er kortets egen id
// (artistens/innovasjonens dok-ID, tiårstallet, eller sjangerens etikett).
export function redigerNotatForKort(hva, id, navn) {
  const nokkel = notatNokkel(`${hva}:${id}`);
  if (!nokkel) return;
  overstyrtKort = { nokkel, navn };
  redigerer = null;
  synlig = true;
  abonnerVedBehov();
  if (erLaerer() && !lastet && !feil) { redigerVedLasting = true; tegn(); return; }
  if (lastet) startRedigering(); else tegn();
}

// Tasten Å (v6.51): notatkortet fram, rett i redigering for kortet som vises.
export function redigerNotater() {
  synlig = true;
  abonnerVedBehov();
  if (redigerer) return;
  if (erLaerer() && aktivtKort() && !lastet && !feil) {
    redigerVedLasting = true;
    tegn();
    return;
  }
  if (lastet) startRedigering();
  else tegn();
}

// Kortstabelen eller innloggingen endret seg.
export function notaterEndret() {
  abonnerVedBehov();
  if (synlig && !redigerer) tegn();
}

function abonnerVedBehov() {
  if (!synlig || !erLaerer() || avmeld) return;
  feil = "";
  avmeld = subscribeNotater((n) => {
    notater = n || {};
    lastet = true;
    feil = "";
    if (redigerVedLasting) { redigerVedLasting = false; if (!redigerer) return startRedigering(); }
    if (!redigerer) tegn();
  }, (err) => {
    avmeld = null;
    lastet = false;
    redigerVedLasting = false;
    feil = err?.code === "permission-denied"
      ? "Reglene for private notater er ikke publisert ennå. Publiser firestore.rules i Firebase-konsollen, så virker de."
      : `Fikk ikke lest notatene (${err?.message || err}).`;
    tegn();
  });
}

function aktivtKort() {
  const apne = [...document.querySelectorAll(".modal-backdrop.open")]
    .sort((a, b) => (parseInt(b.style.zIndex) || 0) - (parseInt(a.style.zIndex) || 0));
  for (const m of apne) {
    const nokkel = notatNokkel(m.dataset.vis);
    if (nokkel) return { nokkel, navn: kortNavn(m.dataset.vis) };
  }
  // Ingen ekte kort åpent: lærerviewets knapp (redigerNotatForKort) kan ha
  // satt et eksplisitt mål. Den vinner ALDRI over et faktisk åpent kort over.
  return overstyrtKort;
}

function kortNavn(vis) {
  const m = parseVisVerdi(vis);
  const s = getState();
  if (m.hva === "artist") return (s.artists || []).find((a) => a.id === m.id)?.name || "Artist";
  if (m.hva === "tech") return (s.techItems || []).find((t) => t.id === m.id)?.name || "Innovasjon";
  if (m.hva === "tiår") return `${m.id}-tallet`;
  const n = GENEALOGY.find((x) => x.l === m.id);
  return n?.f || n?.l || m.id;
}

function boks() {
  let el = document.getElementById("pres-notater");
  if (el) return el;
  el = document.createElement("aside");
  el.id = "pres-notater";
  el.setAttribute("aria-label", "Private notater");
  el.hidden = true;
  document.body.appendChild(el);
  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-pn-lukk]")) return vekslNotater();
    if (e.target.closest("[data-pn-rediger]")) return startRedigering();
    if (e.target.closest("[data-pn-avbryt]")) { redigerer = null; return tegn(); }
    if (e.target.closest("[data-pn-lagre]")) return lagre();
  });
  el.addEventListener("keydown", (e) => {
    if (!e.target.closest("textarea")) return;
    // Esc avbryter skrivingen og lukker ikke kortet under; Cmd/Ctrl+Enter lagrer.
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); redigerer = null; tegn(); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); lagre(); }
  });
  return el;
}

function hode(navn, knapper) {
  return `<div class="pn-hode">
    <span class="pn-tittel">Private notater${navn ? ` · <span class="pn-navn">${escapeHtml(navn)}</span>` : ""}</span>
    <span class="pn-knapper">${knapper}<button type="button" class="btn ghost small" data-pn-lukk title="Skjul (P)" aria-label="Skjul notatene">✕</button></span>
  </div>`;
}

function tegn() {
  const el = synlig ? boks() : document.getElementById("pres-notater");
  if (!el) return;
  el.hidden = !synlig;
  if (!synlig) return;
  if (redigerer) {
    const tekst = notater[redigerer.nokkel]?.tekst || "";
    el.innerHTML = `${hode(redigerer.navn, "")}
      <textarea class="pn-felt" aria-label="Notat til ${escapeHtml(redigerer.navn)}" maxlength="10000">${escapeHtml(tekst)}</textarea>
      <div class="pn-handlinger">
        <span class="muted pn-hint">Cmd/Ctrl + Enter lagrer, Esc avbryter. **fet** og *kursiv* virker.</span>
        <button type="button" class="btn ghost small" data-pn-avbryt>Avbryt</button>
        <button type="button" class="btn primary small" data-pn-lagre${lagrer ? " disabled" : ""}>${lagrer ? "Lagrer …" : "Lagre"}</button>
      </div>`;
    const felt = el.querySelector("textarea");
    felt?.focus();
    felt?.setSelectionRange(felt.value.length, felt.value.length);
    return;
  }
  if (!erLaerer()) {
    el.innerHTML = `${hode("", "")}<p class="pn-tom">Bare læreren ser de private notatene. Logg inn som lærer i denne nettleseren.</p>`;
    return;
  }
  if (feil) { el.innerHTML = `${hode("", "")}<p class="pn-tom">${escapeHtml(feil)}</p>`; return; }
  const kort = aktivtKort();
  if (!kort) {
    el.innerHTML = `${hode("", "")}<p class="pn-tom">Åpne et artist-, sjanger-, innovasjons- eller tiårskort, så står notatet til kortet her.</p>`;
    return;
  }
  if (!lastet) { el.innerHTML = `${hode(kort.navn, "")}<p class="pn-tom">Laster notatene …</p>`; return; }
  const tekst = notater[kort.nokkel]?.tekst || "";
  el.innerHTML = tekst
    ? `${hode(kort.navn, `<button type="button" class="btn ghost small" data-pn-rediger>Rediger</button>`)}<div class="pn-tekst rt">${renderRichText(tekst)}</div>`
    : `${hode(kort.navn, "")}<p class="pn-tom">Ingen notater til dette kortet.</p>
       <button type="button" class="btn ghost small" data-pn-rediger>Skriv notat</button>`;
}

function startRedigering() {
  const kort = aktivtKort();
  if (!kort || !erLaerer() || !lastet) return tegn();
  redigerer = kort;
  tegn();
}

async function lagre() {
  if (!redigerer || lagrer) return;
  const felt = document.querySelector("#pres-notater textarea");
  const tekst = felt ? felt.value : "";
  const { nokkel } = redigerer;
  lagrer = true;
  tegn();
  // Feltet tegnes på nytt: verdien som ble skrevet, skal stå i det nye.
  const nytt = document.querySelector("#pres-notater textarea");
  if (nytt) nytt.value = tekst;
  try {
    await lagreNotat(nokkel, tekst);
    lagrer = false;
    redigerer = null;
    tegn();
  } catch (err) {
    lagrer = false;
    tegn();
    const igjen = document.querySelector("#pres-notater textarea");
    if (igjen) igjen.value = tekst;
    const hint = document.querySelector("#pres-notater .pn-hint");
    if (hint) hint.textContent = `Ikke lagret (${err?.message || err}). Er reglene publisert, og er du logget inn som lærer?`;
  }
}
