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

import { ytEmbedUrl, ytMaal, ytWatchUrl, ytSpillelisteIder, ytSpillelisteUrl, parseTid, formatTid, YT_TONING_MS, toningsSteg } from "../visning/presentasjon-modell.js";
import { byggVisVerdi, parseVisVerdi, erSkrivefelt } from "../felles/vis-lenke.js";
import { modalOpen, setupModal, initModalHeaders, topOpenModal } from "./ui-modal.js";
import { getState } from "../data/app-state.js";
import { safeUrl } from "../felles/util.js";

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
  // API-et ikke er tilgjengelig til å pause. Spiller videoen, tones den ut
  // først (v6.40), men lukkingen selv skjer med én gang (lukkMedToning).
  m._beforeClose = () => {
    lukkMedToning(m);
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
  toning.gen++;   // en iframe som ennå venter på API-et, skal ikke settes inn
  slippSpiller();
  stoppToning();
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

async function lastIframe() {
  const ramme = document.getElementById("yt-ramme");
  if (!ramme || !naa.video && !naa.list) return;
  if (!ytEmbedUrl(ytWatchUrl(naa.video, naa.list))) return;
  const gen = ++toning.gen;
  slippSpiller();
  stoppToning();
  visFeil(null);
  ramme.innerHTML = "";
  // Toningen trenger iframe-API-et. Første gang ventes det kort på skriptet
  // (rammen er svart så lenge). Svarer det ikke innen 1,5 s, spilles videoen
  // som før, med autoplay og uten toning.
  const YT = await Promise.race([lastYtApi(), new Promise((r) => setTimeout(() => r(null), 1500))]);
  if (gen !== toning.gen) return;   // lukket, eller et annet klipp åpnet i mellomtiden
  toning.aktiv = !!YT?.Player;
  const src = ytEmbedUrl(ytWatchUrl(naa.video, naa.list), { start: naa.start, jsapi: true, kø: naa.kø, autoplay: !toning.aktiv });
  ramme.innerHTML = `<iframe id="yt-iframe" title="YouTube-avspilling" src="${src}"
    allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    <div class="yt-svart" id="yt-svart" aria-hidden="true"${toning.aktiv ? ' style="opacity:1"' : ""}></div>`;
  if (toning.aktiv) {
    // Vakt: kom avspillingen aldri i gang (onReady uteble), vises bildet, så
    // YouTubes egen avspillingsknapp kan brukes.
    toning.vaktTimer = setTimeout(() => {
      if (gen === toning.gen && toning.tilstand === null) settSvart(0, 300);
    }, 4000);
  }
  bindSpiller();
}

// ----------------------------------------------------------------------------
//  INN- OG UTTONING (v6.40, brukerbestilling 2026-10-05): et klipp tones inn
//  fra svart, med lyden, på 1,5 sekunder (YT_TONING_MS), og ut til svart like
//  lenge, både før slutten av videoen og når spilleren lukkes (✕, ←, Esc,
//  neste stopp). Bildet tones med et svart lag over videoen (#yt-svart), som
//  slipper klikk gjennom til YouTubes egne knapper; lyden med iframe-API-ets
//  setVolume. Uten API-et spilles alt som før, og laget står gjennomsiktig.
//  iPhone og iPad lar ikke nettsider styre volumet, så der tones bare bildet.
//
//  Lukkingen skjer med én gang (historikk, kortstabel og fokus som før), men
//  spillermodalen står synlig, uten å ta imot klikk, til bildet er svart
//  (.yt-uttoning). Åpnes et nytt klipp i mellomtiden, avbrytes uttoningen.
//  Volumet settes tilbake før spilleren fjernes, så YouTube ikke husker et
//  nedtonet volum til neste gang.
// ----------------------------------------------------------------------------

// Volumet det tones opp til: brukerens eget i YouTube, lest av ved start.
let malVolum = 100;
// `gen` avbryter ventende tidtakere og iframer når et nytt klipp åpnes eller
// spilleren lukkes. `aktiv`: denne spilleren tones (API-et var klart).
const toning = { gen: 0, aktiv: false, tilstand: null, lukker: false, videoId: null, lydTimer: null, sjekkTimer: null, lukkTimer: null, vaktTimer: null };

function settSvart(opasitet, ms) {
  const lag = document.getElementById("yt-svart");
  if (!lag) return;
  lag.style.transitionDuration = `${Math.round(ms)}ms`;
  lag.style.opacity = String(opasitet);
}

function lydStyres() {
  if (!toning.aktiv || !spillerKlar || !spiller?.setVolume) return false;
  try { return !spiller.isMuted(); } catch (e) { return false; }
}

function rampeVolum(til, ms) {
  clearInterval(toning.lydTimer);
  toning.lydTimer = null;
  if (!lydStyres()) return;
  let fra = 0;
  try { fra = spiller.getVolume(); } catch (e) {}
  const t0 = performance.now();
  const steg = () => {
    const andel = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
    try { spiller?.setVolume(Math.round(fra + (til - fra) * andel)); } catch (e) {}
    if (andel >= 1) { clearInterval(toning.lydTimer); toning.lydTimer = null; }
  };
  steg();
  if (toning.lydTimer === null && ms > 0) toning.lydTimer = setInterval(steg, 50);
}

function tonInn() {
  toning.tilstand = "inn";
  settSvart(0, YT_TONING_MS);
  rampeVolum(malVolum, YT_TONING_MS);
}

function tonUt(ms) {
  // Har brukeren endret volumet underveis, er det det neste klipp tones opp til.
  if (toning.tilstand === "inn" && !toning.lydTimer && lydStyres()) {
    try { const v = spiller.getVolume(); if (v > 0) malVolum = v; } catch (e) {}
  }
  toning.tilstand = "ut";
  settSvart(1, ms);
  rampeVolum(0, ms);
}

// Ser etter slutten fire ganger i sekundet mens videoen spiller, og toner ut
// i tide. Spoler brukeren tilbake fra slutten, tones klippet inn igjen.
function startSjekk() {
  if (toning.sjekkTimer) return;
  toning.sjekkTimer = setInterval(() => {
    if (toning.lukker || !spillerKlar || !spiller?.getPlayerState) return;
    try {
      if (spiller.getPlayerState() !== 1) return;
      const varighet = spiller.getDuration();
      const posisjon = spiller.getCurrentTime();
      const steg = toningsSteg(toning.tilstand, varighet, posisjon);
      if (steg === "ut") tonUt(Math.max(200, (varighet - posisjon) * 1000));
      else if (steg === "inn") tonInn();
    } catch (e) {}
  }, 250);
}

function stoppToning() {
  clearInterval(toning.lydTimer);
  clearInterval(toning.sjekkTimer);
  clearTimeout(toning.lukkTimer);
  clearTimeout(toning.vaktTimer);
  Object.assign(toning, { aktiv: false, tilstand: null, lukker: false, videoId: null, lydTimer: null, sjekkTimer: null, lukkTimer: null, vaktTimer: null });
  document.getElementById("modal-yt")?.classList.remove("yt-uttoning");
}

// Fjerner spilleren. Ble volumet styrt, pauses videoen og volumet settes
// tilbake først, så YouTube ikke husker uttoningens 0 til neste klipp.
function slippSpiller() {
  if (spiller && spillerKlar && toning.aktiv) {
    try { spiller.pauseVideo(); spiller.setVolume(malVolum); } catch (e) {}
  }
  try { spiller?.destroy?.(); } catch (e) {}
  spiller = null;
  spillerKlar = false;
}

// Spilleren er klar (onReady): volumet ned, så start. Videoen er bygd inn
// uten autoplay nettopp for dette, så ingen lyd slipper ut før nedtoningen.
// 0 regnes som ukjent volum (det kan være en uttoning YouTube husket), og da
// tones det opp til forrige kjente. Nekter nettleseren avspilling (ingen
// klikk rett før, for eksempel etter omlasting på et stopp), vises bildet
// straks, så YouTubes egen avspillingsknapp synes; trykker man på den,
// tones lyden inn derfra.
function startMedToning() {
  try {
    // Styringsvinduet med et lerret koblet til (v6.50): lyden kommer fra
    // lerretet, så styringen spiller dempet og toner bare bildet.
    if (dempet) spiller.mute();
    else if (!spiller.isMuted()) {
      const v = spiller.getVolume();
      if (v > 0) malVolum = v;
      spiller.setVolume(0);
    }
    spiller.playVideo();
  } catch (e) {}
  const gen = toning.gen;
  setTimeout(() => {
    if (gen !== toning.gen || toning.tilstand !== null) return;
    let t = -1;
    try { t = spiller.getPlayerState(); } catch (e) {}
    if (t !== 1 && t !== 3) settSvart(0, 300);
  }, 1200);
}

// Lukking: spiller videoen, tones den ut før spilleren fjernes, mens modalen
// lukkes som vanlig og står synlig til bildet er svart. Ellers fjernes
// spilleren med én gang, som før.
function lukkMedToning(m) {
  let igang = false;
  try { igang = toning.aktiv && spillerKlar && [1, 3].includes(spiller.getPlayerState()); } catch (e) {}
  if (!igang) { lukkSpiller(); return; }
  const gen = ++toning.gen;
  toning.lukker = true;
  clearInterval(toning.sjekkTimer);
  toning.sjekkTimer = null;
  m.classList.add("yt-uttoning");
  tonUt(YT_TONING_MS);
  toning.lukkTimer = setTimeout(() => { if (gen === toning.gen) lukkSpiller(); }, YT_TONING_MS);
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
          if (toning.aktiv) startMedToning();
        },
        onStateChange: (e) => {
          if (!toning.aktiv || toning.lukker) return;
          if (e?.data === 1) {
            let id = null;
            try { id = spiller.getVideoData()?.video_id || null; } catch (err) {}
            // Nytt klipp (også det neste i en kø), eller avspilling igjen
            // etter slutten: tones inn fra svart.
            if (toning.tilstand !== "inn" || id !== toning.videoId) {
              toning.videoId = id;
              tonInn();
            }
            startSjekk();
          } else if (e?.data === 0 && toning.tilstand !== "ut") {
            // Slutt uten at sjekken rakk å tone ut: svart og stille, så
            // neste klipp i en kø også starter fra svart.
            tonUt(300);
          }
        },
        // Innbygging avslått av rettighetshaveren (101/150), fjernet eller
        // privat video (100) eller mangel på oppgitt avsender (153): gå ut
        // av kino, så «Åpne på YouTube» synes, og gi lenka fokus, så Enter
        // fra klikkeren åpner videoen (audit v5.42 funn 36).
        onError: (e) => {
          if (![100, 101, 150, 153].includes(e?.data)) return;
          const m = document.getElementById("modal-yt");
          if (!m) return;
          settSvart(0, 0);   // YouTubes egen feilmelding skal synes
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

// ----------------------------------------------------------------------------
//  Lerret på annen skjerm (v6.50, js/visning/lerret.js): styringen spiller
//  dempet og melder fra om pause, avspilling og spoling; lerretet spiller med
//  lyd og følger etter. Køen og tittelen følger med, så lerretet åpner samme
//  avspilling.
// ----------------------------------------------------------------------------

let dempet = false;

export function settYtDempet(paa) {
  dempet = !!paa;
  if (!spillerKlar || !spiller) return;
  try {
    if (dempet) spiller.mute();
    else { spiller.unMute(); spiller.setVolume(malVolum); }
  } catch (e) {}
}

// Det som spilles nå, slik lerretet trenger det for å åpne det samme.
export function ytNaa() {
  const m = document.getElementById("modal-yt");
  if (!m?.classList.contains("open") || !naa.video && !naa.list) return null;
  return { video: naa.video, list: naa.list, start: naa.start, kø: [...naa.kø], tittel: m.querySelector("#yt-tittel")?.textContent || "" };
}

// { tilstand, tid } for spilleren som er åpen, eller null.
export function ytStatus() {
  if (!spillerKlar || !spiller?.getPlayerState) return null;
  try { return { tilstand: spiller.getPlayerState(), tid: spiller.getCurrentTime() }; } catch (e) { return null; }
}

// Lerretets side: følg styringen. Avgjørelsen er ytFolg i modellen.
export function ytStyr({ spol = null, handling = null } = {}) {
  if (!spillerKlar || !spiller) return;
  try {
    if (spol != null) spiller.seekTo(spol, true);
    if (handling === "pause") spiller.pauseVideo();
    else if (handling === "spill") spiller.playVideo();
  } catch (e) {}
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
