// ============================================================================
//  SØK — visning og ruting
// ----------------------------------------------------------------------------
//  Selve søket (indeks, rangering, utdrag) bor i search.js, som er DOM-fri og
//  enhetstestet. Her er feltet, treffisten og ruteren som åpner kortet bak et
//  treff — samme mønster som Referanser-kortet: posten bærer med seg hvordan
//  den åpnes, og `apneTreff` er det ENE stedet som kjenner inngangene.
//
//  Modalen stables oppå det man kom fra, som de andre utforsk-modalene, så ←
//  fører tilbake til søket etter at man har lest et treff.
// ============================================================================

import { modalOpen, escapeHtml } from "./ui.js?v=5.59";
import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "./feature-flags.js?v=5.59";
import { byggIndeks, sok, utdrag, marker } from "./search.js?v=5.59";
import { getState } from "./explore-context.js?v=5.59";
import { apneMaal } from "./explore-apne.js?v=5.59";
import { erSkrivefelt, erSokHurtigtast } from "./vis-lenke.js?v=5.59";

// Så mange treff vises per gruppe før «Vis alle» — nok til å se mønsteret,
// lite nok til at fem grupper får plass på skjermen samtidig.
const PER_GRUPPE = 6;

// Indeksen koster rundt 20 ms å bygge for hele pensumet (643 poster), og det
// er unødvendig å gjøre for hvert tastetrykk. Den bygges derfor når søket
// åpnes, og ellers bare når datagrunnlaget har ENDRET STØRRELSE — det fanger
// snapshotet som lander rett etter at siden er åpnet, og lærerens sletting
// eller nye kort. En ren tekstredigering mens søket står åpent, slår gjennom
// når søket åpnes igjen.
let indeksCache = null;
let indeksAvtrykk = "";

function hentIndeks(s, { tvingNy = false } = {}) {
  const avtrykk = [
    (s.artists || []).length,
    Object.keys(s.genreDescs || {}).length,
    (s.techItems || []).length,
    Object.keys(s.decadeDescs || {}).length,
    Object.keys(s.content || {}).length,
    Object.keys(s.edgeDescs || {}).length,
    (s.podcasts || []).length,
    !!s.isTeacher,
  ].join("|");
  if (tvingNy || !indeksCache || avtrykk !== indeksAvtrykk) {
    indeksCache = byggIndeks(s, { erLærer: !!s.isTeacher, skjul: SKJUL_I_STUDENTVISNING, skjulHub: SKJUL_I_HUBEN });
    indeksAvtrykk = avtrykk;
  }
  return indeksCache;
}

// Treffene slik de sist ble tegnet. Klikk er delegert på beholderen, så en
// lang liste ikke gir én lytter per rad.
let visteTreff = [];
let avventer = null;
// Grupper læreren/studenten har foldet ut. Nullstilles ved hvert nytt søk, så
// en utfoldet gruppe ikke henger igjen over et helt annet treffbilde.
let utvidet = new Set();
let sisteSok = "";

export function openSok(query = "") {
  const modal = document.getElementById("modal-sok");
  if (!modal) return;
  const felt = document.getElementById("sok-felt");
  if (felt && typeof query === "string") felt.value = query;
  hentIndeks(getState(), { tvingNy: true });
  renderSok();
  modalOpen(modal);
  // Fokus etter modalOpen: feltet er ikke synlig før modalen står åpen, og et
  // fokus på et skjult felt ruller siden til toppen i stedet.
  felt?.focus();
  felt?.select();
}

// Kalles fra explore.js ved oppstart. Feltet i Utforsk-kortet (samme markup på
// forsiden og lærersiden) er inngangen; modalens eget felt søker videre.
export function wireSok() {
  const start = document.getElementById("sok-start");
  if (start) {
    const gaa = () => openSok(start.value);
    start.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); gaa(); } });
    document.getElementById("sok-start-knapp")?.addEventListener("click", gaa);
  }
  const felt = document.getElementById("sok-felt");
  if (felt) {
    // Live-søk med kort forsinkelse: hvert tastetrykk bygger indeksen på nytt,
    // og uten pause ville hurtigskriving gjort det for hver bokstav.
    felt.addEventListener("input", () => {
      clearTimeout(avventer);
      avventer = setTimeout(renderSok, 130);
    });
    felt.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); clearTimeout(avventer); renderSok(); }
    });
  }
  const treffEl = document.getElementById("sok-treff");
  if (treffEl) {
    treffEl.addEventListener("click", (e) => {
      const mer = e.target.closest("[data-sok-mer]");
      if (mer) {
        const type = mer.dataset.sokMer;
        utvidet.add(type);
        renderSok();
        // renderSok bygger lista på nytt, så knappen som hadde fokus er borte
        // og fokus faller til <body>: en tastaturbruker mister plassen sin midt
        // i lista. Flytt fokus til den første raden i gruppa som nettopp åpnet.
        const gruppe = document.querySelector(`#sok-treff [data-sok-gruppe="${CSS.escape(type)}"]`);
        (gruppe?.querySelector("[data-sok-i]") || document.getElementById("sok-felt"))?.focus();
        return;
      }
      const rad = e.target.closest("[data-sok-i]");
      if (!rad) return;
      const t = visteTreff[Number(rad.dataset.sokI)];
      if (t) apneMaal(t.apne);
    });
  }

  // Hurtigtast (v5.22): «/» eller Ctrl/Cmd+K åpner søket fra hvor som helst
  // på sidene som laster utforsk-laget (forsiden, lærersiden, slektstresiden
  // — modal-sok injiseres av initExplore på alle tre). Vaktene er rene
  // funksjoner i vis-lenke.js. Datasett-vakten gjør koblingen idempotent.
  if (!document.body.dataset.sokHurtigtast) {
    document.body.dataset.sokHurtigtast = "1";
    document.addEventListener("keydown", (e) => {
      if (!erSokHurtigtast(e, erSkrivefelt(document.activeElement))) return;
      e.preventDefault();
      openSok();
    });
  }
}

// Gjør søket og tegner treffene.
function renderSok() {
  const felt = document.getElementById("sok-felt");
  const status = document.getElementById("sok-status");
  const treffEl = document.getElementById("sok-treff");
  if (!felt || !treffEl) return;
  const q = felt.value.trim();

  const s = getState();
  const res = sok(hentIndeks(s), q);
  if (q !== sisteSok) { utvidet = new Set(); sisteSok = q; }

  visteTreff = [];
  if (res.forKort) {
    if (status) status.textContent = q ? "Skriv minst to tegn." : "Søker i artister, sjangre, innovasjonskort, tiårstekster, historier og sider.";
    treffEl.innerHTML = "";
    return;
  }
  if (!res.totalt) {
    if (status) status.textContent = `Ingen treff på «${q}».`;
    treffEl.innerHTML = `<p class="muted">Prøv et kortere ord, eller søk på en del av et navn.</p>`;
    return;
  }
  if (status) {
    status.textContent = `${res.totalt} treff på «${q}».${
      s.artistsLoaded === false ? " Innholdet laster fortsatt." : ""}`;
  }

  treffEl.innerHTML = res.grupper.map((g) => {
    const vis = utvidet.has(g.type) ? g.treff : g.treff.slice(0, PER_GRUPPE);
    const rader = vis.map((t) => {
      const i = visteTreff.push(t) - 1;
      const ut = utdrag(t, res.termer);
      return `<button type="button" class="sok-rad-treff" data-sok-i="${i}">
        <span class="sok-t-hode">
          <span class="sok-t-tittel">${marker(t.tittel, res.termer)}</span>
          ${t.sti ? `<span class="sok-t-sti">${escapeHtml(t.sti)}</span>` : ""}
        </span>
        ${ut ? `<span class="sok-t-utdrag">${ut}</span>` : ""}
      </button>`;
    }).join("");
    const flere = g.antall > vis.length
      ? `<button type="button" class="sok-g-flere" data-sok-mer="${escapeHtml(g.type)}">Vis alle ${g.antall}</button>`
      : "";
    return `<div class="sok-gruppe" data-sok-gruppe="${escapeHtml(g.type)}">
      <div class="sok-g-hode"><span>${escapeHtml(g.label)}</span>${flere}</div>
      ${rader}
    </div>`;
  }).join("");
}

// Ruteren som kjente inngangen til hver innholdstype lå her fram til v5.22.
// Nå bor den i explore-apne.js (apneMaal), delt med ?vis=-lenkene, så søket
// og lenkene aldri kan åpne samme mål ulikt.
