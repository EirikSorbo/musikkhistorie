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

import { modalOpen, escapeHtml, showSubsjangerInfo } from "./ui.js?v=4.95";
import { SKJUL_I_STUDENTVISNING } from "./feature-flags.js?v=4.95";
import { showEdgeInfo } from "./genealogy.js?v=4.95";
import { byggIndeks, sok, utdrag, marker } from "./search.js?v=4.95";

// Så mange treff vises per gruppe før «Vis alle» — nok til å se mønsteret,
// lite nok til at fem grupper får plass på skjermen samtidig.
const PER_GRUPPE = 6;
import { opts, getState, onMainGenreClick, sjangerOpts } from "./explore-context.js?v=4.95";
import { openTechDetail } from "./explore-tech.js?v=4.95";
import { openDecade } from "./explore-decade.js?v=4.95";
import { openRotter, openOmHistorie, openHistorier, openAppGuide } from "./explore-innhold.js?v=4.95";
import { openInstrumenter } from "./explore-instrument.js?v=4.95";

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
    indeksCache = byggIndeks(s, { erLærer: !!s.isTeacher, skjul: SKJUL_I_STUDENTVISNING });
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
      if (mer) { utvidet.add(mer.dataset.sokMer); renderSok(); return; }
      const rad = e.target.closest("[data-sok-i]");
      if (!rad) return;
      const t = visteTreff[Number(rad.dataset.sokI)];
      if (t) apneTreff(t.apne);
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
    status.textContent = `${res.totalt} treff på «${q}»${
      s.artistsLoaded === false ? " — innholdet laster fortsatt" : ""}.`;
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
    return `<div class="sok-gruppe">
      <div class="sok-g-hode"><span>${escapeHtml(g.label)}</span>${flere}</div>
      ${rader}
    </div>`;
  }).join("");
}

// Ruteren: ETT sted som kjenner inngangen til hver innholdstype. Kortene åpnes
// OPPÅ søket, så ← fører tilbake til treffisten.
function apneTreff(apne) {
  if (!apne) return;
  const s = getState();
  switch (apne.hva) {
    case "artist": {
      const a = (s.artists || []).find((x) => x.id === apne.id);
      if (a && opts.onArtistClick) opts.onArtistClick(a);
      return;
    }
    case "sjanger": return onMainGenreClick(apne.id);
    case "undersjanger": {
      showSubsjangerInfo(apne.id, sjangerOpts());
      return;
    }
    case "historie": return openHistorier(apne.id);
    case "tech": {
      const t = (s.techItems || []).find((x) => x.id === apne.id);
      if (t) openTechDetail(t);
      return;
    }
    case "tiår": return openDecade(apne.id, apne.modus);
    case "side":
      if (apne.id === "rotter") return openRotter();
      if (apne.id === "omHistorie") return openOmHistorie();
      return openAppGuide();
    case "instrument": return openInstrumenter("utvikling", apne.id);
    case "kobling": {
      const [fra, til] = String(apne.id).split("__");
      showEdgeInfo(fra, til, sjangerOpts());
      return;
    }
    case "podkast": return openInstrumenter("podkast");
  }
}
