// ============================================================================
//  INNEBYGD YOUTUBE-SPILLER (flyttet ut av presentasjon.js i v5.28)
// ----------------------------------------------------------------------------
//  Fra v5.77 fanger spilleren YouTube-lenkene i HELE appen, for alle
//  (brukerbestilling 2026-09-27): et lytteeksempel spilles i en modal i appen
//  i stedet for ny fane, uansett om en presentasjon, et opptak eller en
//  aktiv kjøreplan står på. Til v5.76 gjaldt fangsten bare i presentasjonen
//  og under et opptak, så mens læreren bygde en plan uten visning, gikk
//  eksemplene til ny fane og fantes ikke som kort å legge til. Ctrl/Cmd/
//  Shift-klikk åpner fortsatt ny fane, søkelenker har ingen video-ID og åpner
//  som før, og «Åpne på YouTube» står alltid som reserve, siden enkelte
//  musikkvideoer har innbygging avslått av rettighetshaveren. Da sier
//  spilleren det tydelig (YouTubes iframe-API melder feilen), med reserven
//  som knapp. «Spill alle på YouTube»-lenkene (watch_videos) spilles som kø.
//
//  Spillermodalen bærer data-vis="yt:<video>[:<liste>][:<sekunder>]": et
//  lytteeksempel er dermed et fullverdig mål — det kan kopieres som lenke,
//  legges i en kjøreplan og i heftet (utskrift, v5.77), tas opp i en
//  samleøkt, og spilles av som kjøreplan-stopp (explore-apne).
//
//  STARTTIDSPUNKT (v5.29): tidsraden under videoen setter hvor avspillingen
//  skal begynne. «Bruk tiden nå» leser av posisjonen gjennom YouTubes
//  iframe-API — spol til stedet i videoen og trykk. Er API-skriptet blokkert
//  (skolenett, utvidelser), skjules knappen og feltet skrives i stedet for
//  hånd; alt annet virker likt. Tiden havner i data-vis, så stoppet og lenka
//  bærer den videre, og opptaket fanger den via endringsobservatøren.
//
//  Fangsten er ÉN delt lytter på dokumentet (initYtSpiller, kalt av sidenes
//  oppstart). Til v5.76 registrerte presentasjonen og samleøkta hver sin
//  betingelse for den; nå er den alltid på, så betingelsene er borte.
// ============================================================================

import { ytEmbedUrl, ytMaal, ytWatchUrl, ytSpillelisteIder, ytSpillelisteUrl, parseTid, formatTid } from "./presentasjon-modell.js?v=6.25";
import { byggVisVerdi, parseVisVerdi, erSkrivefelt } from "./vis-lenke.js?v=6.25";
import { modalOpen, setupModal, initModalHeaders, topOpenModal } from "./ui-modal.js?v=6.25";
import { getState } from "./explore-context.js?v=6.25";
import { safeUrl } from "./util.js?v=6.25";

// Gjeldende video i spilleren — grunnlaget for data-vis og for «Åpne på
// YouTube» når tiden endres. `kø` (v5.74) er videoene som spilles etter den
// første («Spill alle lytteeksemplene» på oversiktskortet).
let naa = { video: null, list: null, start: null, kø: [] };

function ytModal() {
  let m = document.getElementById("modal-yt");
  if (m) return m;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="modal-backdrop" id="modal-yt">
  <div class="modal modal-yt-boks">
    <div class="modal-head">
      <h2 id="yt-tittel">Avspilling</h2>
      <button type="button" class="btn ghost small yt-kino-knapp" id="yt-kino-knapp" hidden></button>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div class="yt-ramme" id="yt-ramme"></div>
    <div class="yt-tidrad">
      <label for="yt-tid">Start fra</label>
      <input type="text" id="yt-tid" inputmode="numeric" autocomplete="off"
        placeholder="0:00" size="7" aria-label="Starttidspunkt (mm:ss)" />
      <button type="button" class="btn ghost small" id="yt-tid-naa" hidden>Bruk tiden nå</button>
      <button type="button" class="btn ghost small" id="yt-tid-null" hidden>Fra start</button>
      <span class="muted yt-tid-hint">Spol til stedet, og la stoppet starte der.</span>
    </div>
    <p class="yt-feil" id="yt-feil" hidden role="alert"><span id="yt-feil-tekst"></span>
      <a id="yt-feil-lenke" class="btn primary small" href="#" target="_blank" rel="noopener">Åpne på YouTube</a></p>
    <p class="muted yt-reserve">Spilles ikke videoen her (noen rettighetshavere tillater ikke innbygging):
      <a id="yt-ekstern" href="#" target="_blank" rel="noopener">Åpne på YouTube</a></p>
  </div>
</div>`;
  m = wrap.firstElementChild;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  // Alle lukkeveier (✕, ←, Escape, bakgrunn) går gjennom modalClose — FJERN
  // iframen der. Å tømme beholderen stopper lyden med sikkerhet, også når
  // API-et ikke er tilgjengelig til å pause.
  m._beforeClose = () => {
    lukkSpiller();
    return true;
  };
  wireTidrad(m);
  m.querySelector("#yt-kino-knapp").addEventListener("click", () =>
    settKino(m, !m.classList.contains("yt-kino")));
  // Går brukeren ut av fullskjerm selv (Esc), er den ikke lenger vår å forlate.
  // (YouTubes egen fullskjermknapp legger iframen oppå vår; den teller ikke
  // som å forlate.)
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) egenFullskjerm = false;
  });
  // Et klikk i videoen (pause, eller start når autoplay ble blokkert) flytter
  // fokus inn i YouTubes iframe, og da nådde verken klikkeren eller
  // hurtigtastene presentasjonen lenger (audit v5.42 funn 10). Klikket har
  // nådd YouTube når window mister fokus; da hentes fokus tilbake.
  window.addEventListener("blur", () => setTimeout(() => {
    if (erPresentasjon() && m.classList.contains("open") && document.activeElement?.id === "yt-iframe") {
      m.querySelector(".modal")?.focus();
    }
  }, 0));
  return m;
}

// ----------------------------------------------------------------------------
//  Fullskjerm som standard i presentasjonen (v5.39, brukerkrav 2026-09-19).
//  Kinovisning: videoen fyller lerretet på svart bakgrunn, og tittellinja
//  vises bare når pekeren står øverst (CSS, .yt-kino). Er ikke siden alt i
//  fullskjerm (F), bes nettleseren om ekte fullskjerm for spilleren. Det
//  krever et tastetrykk eller klikk rett før (brukeraktivering); uten det,
//  for eksempel ved omlasting på et lytteeksempel-stopp, fyller videoen
//  vinduet i stedet. Knappen i tittellinja veksler til kortet og tilbake, så
//  fullskjerm er standard, ikke tvang. Fullskjermen spilleren selv ba om,
//  forlates når den lukkes (neste stopp, ←, Esc), så lerretet blir som før.
// ----------------------------------------------------------------------------

const IKON_STORRE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
const IKON_MINDRE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';

// Fullskjermen spilleren selv ba om. Den bes om for HELE siden
// (documentElement), ikke for spillermodalen (audit v5.42 funn 11 og 21):
// med modalen som fullskjermelement tegnes bare den, så svart skjerm,
// tastoversikten og søket ble usynlige oppå videoen, og en lukket modal
// kunne bli stående som fullskjermelement. Kino-CSS-en fyller vinduet likt.
let egenFullskjerm = false;

const erPresentasjon = () => document.body.classList.contains("presentasjon");
const erKino = (m) => m.classList.contains("open") && m.classList.contains("yt-kino");

function settKino(m, paa) {
  m.classList.toggle("yt-kino", paa);
  const side = document.documentElement;
  if (paa && !document.fullscreenElement && side.requestFullscreen) {
    side.requestFullscreen().then(() => {
      egenFullskjerm = true;
      // Blada læreren forbi før nettleseren svarte, skal fullskjermen ikke
      // bli stående med spilleren lukket.
      if (!erKino(m)) forlatEgenFullskjerm(m);
    }).catch(() => {});
  } else if (!paa) {
    forlatEgenFullskjerm(m);
  }
  const knapp = m.querySelector("#yt-kino-knapp");
  if (knapp) {
    knapp.hidden = !erPresentasjon();
    knapp.innerHTML = paa ? IKON_MINDRE : IKON_STORRE;
    knapp.title = paa ? "Vis som kort" : "Fyll skjermen";
    knapp.setAttribute("aria-label", knapp.title);
  }
}

// Utgangen venter ett tikk: er neste stopp også et lytteeksempel, åpnes
// spilleren i kino igjen i samme tikk, og fullskjermen blir stående i
// stedet for å falle ut ved annenhver video.
function forlatEgenFullskjerm(m) {
  setTimeout(() => {
    if (!egenFullskjerm || erKino(m)) return;
    egenFullskjerm = false;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, 0);
}

function lukkSpiller() {
  const m = document.getElementById("modal-yt");
  if (m) forlatEgenFullskjerm(m);
  try { spiller?.destroy?.(); } catch (e) {}
  spiller = null;
  spillerKlar = false;
  const ramme = document.getElementById("yt-ramme");
  if (ramme) ramme.innerHTML = "";
}

// Skriver gjeldende tilstand til data-vis + «Åpne på YouTube», så lenke,
// plussknapp og opptak alltid bærer det som faktisk vises.
function oppdaterMaal() {
  const m = document.getElementById("modal-yt");
  if (!m) return;
  // Rene spillelister (uten video-ID) får ingen stopp-identitet: vis-formatet
  // krever en id foran de valgfrie leddene. De spilles likevel.
  m.dataset.vis = naa.video
    ? byggVisVerdi({ hva: "yt", id: naa.video, modus: naa.list || "", ekstra: naa.start ? String(naa.start) : "" }) || ""
    : "";
  // Reserven åpner det som spilles: hele køen når det er en (watch_videos),
  // ellers videoen fra starttidspunktet.
  const ekstern = naa.kø.length
    ? ytSpillelisteUrl([naa.video, ...naa.kø])[0] || ytWatchUrl(naa.video, naa.list, naa.start)
    : ytWatchUrl(naa.video, naa.list, naa.start);
  for (const id of ["#yt-ekstern", "#yt-feil-lenke"]) {
    const lenke = m.querySelector(id);
    if (lenke) lenke.href = ekstern;
  }
  const felt = m.querySelector("#yt-tid");
  if (felt && document.activeElement !== felt) felt.value = formatTid(naa.start);
  const nullKnapp = m.querySelector("#yt-tid-null");
  if (nullKnapp) nullKnapp.hidden = !naa.start;
}

function settStart(sek, { spol = true } = {}) {
  naa.start = sek || null;
  oppdaterMaal();
  if (!spol) return;
  // Vis resultatet med én gang: hopp dit i videoen som spilles.
  if (spillerKlar && spiller?.seekTo) {
    try { spiller.seekTo(naa.start || 0, true); return; } catch (e) {}
  }
  lastIframe();   // uten API: last på nytt fra det nye tidspunktet
}

function wireTidrad(m) {
  const felt = m.querySelector("#yt-tid");
  const les = () => {
    const sek = parseTid(felt.value);
    if (felt.value.trim() && sek == null) {
      felt.classList.add("yt-tid-feil");
      return;
    }
    felt.classList.remove("yt-tid-feil");
    settStart(sek);
  };
  felt.addEventListener("change", les);
  felt.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); les(); felt.blur(); } });
  m.querySelector("#yt-tid-naa").addEventListener("click", () => {
    if (!spillerKlar || !spiller?.getCurrentTime) return;
    let sek = 0;
    try { sek = Math.floor(spiller.getCurrentTime() || 0); } catch (e) { return; }
    settStart(sek, { spol: false });
  });
  m.querySelector("#yt-tid-null").addEventListener("click", () => settStart(null));
}

// ----------------------------------------------------------------------------
//  YouTubes iframe-API — kun for å LESE av posisjonen («Bruk tiden nå») og
//  spole. Alt annet virker uten det, så en blokkert forespørsel koster bare
//  knappen. Skriptet lastes først når spilleren faktisk åpnes.
// ----------------------------------------------------------------------------

let apiLovet = null;
let spiller = null;
let spillerKlar = false;

function lastYtApi() {
  if (apiLovet) return apiLovet;
  apiLovet = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const forrige = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { forrige?.(); } catch (e) {} resolve(window.YT || null); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    // Henger forespørselen (brannmur uten avvisning), gir vi opp stille.
    setTimeout(() => resolve(window.YT?.Player ? window.YT : null), 6000);
  });
  return apiLovet;
}

function lastIframe() {
  const ramme = document.getElementById("yt-ramme");
  if (!ramme || !naa.video && !naa.list) return;
  const src = ytEmbedUrl(ytWatchUrl(naa.video, naa.list), { start: naa.start, jsapi: true, kø: naa.kø });
  if (!src) return;
  try { spiller?.destroy?.(); } catch (e) {}
  spiller = null;
  spillerKlar = false;
  visFeil(null);
  ramme.innerHTML = `<iframe id="yt-iframe" title="YouTube-avspilling" src="${src}"
    allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  bindSpiller();
}

// Meldingen når YouTube nekter å spille i appen (v5.77). Feilkodene er
// iframe-API-ets: 100 = fjernet eller privat, 101/150 = innbygging avslått av
// rettighetshaveren, 153 = avsender mangler. null skjuler meldingen.
const FEIL_TEKST = {
  100: "Videoen er fjernet fra YouTube eller gjort privat.",
  101: "Rettighetshaveren tillater ikke at videoen spilles utenfor YouTube.",
  150: "Rettighetshaveren tillater ikke at videoen spilles utenfor YouTube.",
  153: "Videoen kan ikke spilles her.",
};

function visFeil(kode) {
  const boks = document.getElementById("yt-feil");
  if (!boks) return;
  const tekst = kode == null ? "" : FEIL_TEKST[kode] || "Videoen kan ikke spilles her.";
  boks.hidden = !tekst;
  const el = boks.querySelector("#yt-feil-tekst");
  if (el) el.textContent = tekst;
}

async function bindSpiller() {
  const YT = await lastYtApi();
  const el = document.getElementById("yt-iframe");
  const knapp = document.getElementById("yt-tid-naa");
  if (!YT?.Player || !el) return;
  try {
    spiller = new YT.Player(el, {
      events: {
        onReady: () => {
          spillerKlar = true;
          if (knapp) knapp.hidden = false;
        },
        // Innbygging avslått av rettighetshaveren (101/150), fjernet eller
        // privat video (100) eller mangel på oppgitt avsender (153): gå ut
        // av kino, så «Åpne på YouTube» synes, og gi lenka fokus, så Enter
        // fra klikkeren åpner videoen (audit v5.42 funn 36).
        onError: (e) => {
          if (![100, 101, 150, 153].includes(e?.data)) return;
          const m = document.getElementById("modal-yt");
          if (!m) return;
          settKino(m, false);
          // Tydelig melding med reserven som knapp (v5.77); fokus på knappen,
          // så Enter fra klikkeren åpner videoen.
          visFeil(e.data);
          (m.querySelector("#yt-feil-lenke") || m.querySelector("#yt-ekstern"))?.focus();
        },
      },
    });
  } catch (e) {
    spiller = null;
  }
}

// Spill av eller pause (mellomrom/K i presentasjonen, funn 10), så læreren
// ikke må klikke i videoen. false når spilleren ikke er klar (API-et
// blokkert eller ikke lastet).
export function veksleYtAvspilling() {
  if (!spillerKlar || !spiller?.getPlayerState) return false;
  try {
    // 1 = spiller, 3 = bufrer (hører til avspillingen: da skal lyden stoppe).
    const tilstand = spiller.getPlayerState();
    if (tilstand === 1 || tilstand === 3) spiller.pauseVideo();
    else spiller.playVideo();
    return true;
  } catch (e) {
    return false;
  }
}

// Åpner spilleren for en YouTube-lenke. Returnerer false når lenka ikke kan
// bygges inn (søkelenker o.l.) — kalleren lar den da åpne i ny fane som før.
// `kø` (v5.74): flere video-ID-er som spilles etter den første, i rekkefølge.
export function apneYtSpiller(url, tittel, { start = null, kø = [] } = {}) {
  const maal = ytMaal(url);
  if (!maal) return false;
  const m = ytModal();
  naa = { video: maal.video, list: maal.list, start: start != null ? start : maal.start, kø: Array.isArray(kø) ? kø : [] };
  m.querySelector("#yt-tittel").textContent = tittel || "Avspilling";
  // Tidsraden gjelder én video; en ren spilleliste har ingenting å feste den til.
  m.querySelector(".yt-tidrad").hidden = !naa.video;
  m.querySelector("#yt-tid-naa").hidden = true;   // vises når API-et er klart
  lastIframe();
  oppdaterMaal();
  modalOpen(m);
  // Kinovisning som standard i presentasjonen, kortet ellers. Fokus på selve
  // dialogen, så tittellinja (synlig ved :focus-within) ikke står fremme fra
  // start, og piltastene fortsatt når presentasjonen.
  settKino(m, erPresentasjon());
  if (erPresentasjon()) m.querySelector(".modal")?.focus();
  return true;
}

let koblet = false;

// Fang klikk på YouTube-lenker i hele appen og spill dem her (v5.77, alltid
// på). Kalles av sidenes oppstart; idempotent. Lenkene i selve spilleren
// (reservene) og klikk med Ctrl/Cmd/Shift/Alt går til YouTube som vanlig.
// Søkelenker og andre lenker uten video-ID lar seg ikke bygge inn og åpner
// i ny fane som før (apneYtSpiller sier false).
export function initYtSpiller() {
  if (koblet) return;
  koblet = true;
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.('a[href*="yout"]');
    if (!a || a.closest("#modal-yt")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const tittel = a.textContent.trim();
    // «Spill alle N på YouTube» (watch_videos): første video nå, resten i kø.
    const ider = ytSpillelisteIder(a.href);
    if (ider) {
      if (apneYtSpiller(ytWatchUrl(ider[0], null, null), `Spilleliste · ${ider.length} videoer`, { kø: ider.slice(1) })) e.preventDefault();
      return;
    }
    if (apneYtSpiller(a.href, tittel)) e.preventDefault();
  });

  // Tasten L (v5.83, brukerbestilling 2026-09-28): spill det FØRSTE
  // lytteeksempelet til artisten som vises (det øverste åpne artistkortet),
  // uten å lete etter lenka på kortet. Utenfor skrivefelt, uten Ctrl/Cmd/Alt.
  // Er lenka ikke en YouTube-video (søkelenke, annen vert), åpnes den i ny
  // fane, som et klikk ville gjort. Ingen artist øverst: ingenting skjer.
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "l" && e.key !== "L") return;
    if (erSkrivefelt(document.activeElement)) return;
    const m = parseVisVerdi(topOpenModal()?.dataset.vis || "");
    if (m?.hva !== "artist") return;
    const a = (getState().artists || []).find((x) => x.id === m.id);
    const eks = (a?.musicExamples || []).find((x) => safeUrl(x?.url));
    if (!eks) return;
    e.preventDefault();
    const tittel = `${eks.label || "Lytteeksempel"} (${a.name})`;
    if (!apneYtSpiller(eks.url, tittel)) window.open(eks.url, "_blank", "noopener");
  });
}
