// ============================================================================
//  INNEBYGD YOUTUBE-SPILLER (flyttet ut av presentasjon.js i v5.28)
// ----------------------------------------------------------------------------
//  Delt av presentasjonsvisningen OG samleøktene: lytteeksempler spilles i en
//  modal i appen i stedet for ny fane. Søkelenker har ingen video-ID og åpner
//  som før; «Åpne på YouTube» står alltid som reserve, siden enkelte
//  musikkvideoer har innbygging avslått av rettighetshaveren.
//
//  Spillermodalen bærer data-vis="yt:<video>[:<liste>][:<sekunder>]": et
//  lytteeksempel er dermed et fullverdig mål — det kan kopieres som lenke,
//  plukkes med plussknappen og tas opp i en samleøkt, og spilles av som
//  kjøreplan-stopp (explore-apne).
//
//  STARTTIDSPUNKT (v5.29): tidsraden under videoen setter hvor avspillingen
//  skal begynne. «Bruk tiden nå» leser av posisjonen gjennom YouTubes
//  iframe-API — spol til stedet i videoen og trykk. Er API-skriptet blokkert
//  (skolenett, utvidelser), skjules knappen og feltet skrives i stedet for
//  hånd; alt annet virker likt. Tiden havner i data-vis, så stoppet og lenka
//  bærer den videre, og opptaket fanger den via endringsobservatøren.
//
//  Flere moduler kan trenge intercepten samtidig (presentasjonsmodus, aktiv
//  samleøkt) — de registrerer hver sin betingelse, og ÉN delt lytter åpner
//  spilleren når minst én av dem er sann. Da dobbeltåpner ingenting.
// ============================================================================

import { ytEmbedUrl, ytMaal, ytWatchUrl, parseTid, formatTid } from "./presentasjon-modell.js?v=5.30";
import { byggVisVerdi } from "./vis-lenke.js?v=5.30";
import { modalOpen, setupModal, initModalHeaders } from "./ui-modal.js?v=5.30";

// Gjeldende video i spilleren — grunnlaget for data-vis og for «Åpne på
// YouTube» når tiden endres.
let naa = { video: null, list: null, start: null };

function ytModal() {
  let m = document.getElementById("modal-yt");
  if (m) return m;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="modal-backdrop" id="modal-yt">
  <div class="modal modal-yt-boks">
    <div class="modal-head">
      <h2 id="yt-tittel">Avspilling</h2>
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
  return m;
}

function lukkSpiller() {
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
  const lenke = m.querySelector("#yt-ekstern");
  if (lenke) lenke.href = ytWatchUrl(naa.video, naa.list, naa.start);
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
  const src = ytEmbedUrl(ytWatchUrl(naa.video, naa.list), { start: naa.start, jsapi: true });
  if (!src) return;
  try { spiller?.destroy?.(); } catch (e) {}
  spiller = null;
  spillerKlar = false;
  ramme.innerHTML = `<iframe id="yt-iframe" title="YouTube-avspilling" src="${src}"
    allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  bindSpiller();
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
      },
    });
  } catch (e) {
    spiller = null;
  }
}

// Åpner spilleren for en YouTube-lenke. Returnerer false når lenka ikke kan
// bygges inn (søkelenker o.l.) — kalleren lar den da åpne i ny fane som før.
export function apneYtSpiller(url, tittel, { start = null } = {}) {
  const maal = ytMaal(url);
  if (!maal) return false;
  const m = ytModal();
  naa = { video: maal.video, list: maal.list, start: start != null ? start : maal.start };
  m.querySelector("#yt-tittel").textContent = tittel || "Avspilling";
  // Tidsraden gjelder én video; en ren spilleliste har ingenting å feste den til.
  m.querySelector(".yt-tidrad").hidden = !naa.video;
  m.querySelector("#yt-tid-naa").hidden = true;   // vises når API-et er klart
  lastIframe();
  oppdaterMaal();
  modalOpen(m);
  return true;
}

const betingelser = [];
let koblet = false;

// Fang klikk på YouTube-lenker og spill dem i appen når minst én registrert
// betingelse er sann (presentasjonsmodus, aktiv samleøkt).
export function registrerYtIntercept(betingelse) {
  betingelser.push(betingelse);
  if (koblet) return;
  koblet = true;
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="yout"]');
    if (!a || a.id === "yt-ekstern") return;
    if (!betingelser.some((f) => f())) return;
    if (apneYtSpiller(a.href, a.textContent.trim())) e.preventDefault();
  });
}
