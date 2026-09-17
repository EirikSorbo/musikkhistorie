// ============================================================================
//  INNEBYGD YOUTUBE-SPILLER (flyttet ut av presentasjon.js i v5.28)
// ----------------------------------------------------------------------------
//  Delt av presentasjonsvisningen OG samleøktene: lytteeksempler spilles i en
//  modal i appen i stedet for ny fane. Søkelenker har ingen video-ID og åpner
//  som før; «Åpne på YouTube» står alltid som reserve, siden enkelte
//  musikkvideoer har innbygging avslått av rettighetshaveren.
//
//  Spillermodalen bærer data-vis="yt:<video>[:<liste>]" (v5.28): et
//  lytteeksempel er dermed et fullverdig mål — det kan kopieres som lenke,
//  plukkes med plussknappen og tas opp i en samleøkt, og spilles av som
//  kjøreplan-stopp (explore-apne).
//
//  Flere moduler kan trenge intercepten samtidig (presentasjonsmodus, aktiv
//  samleøkt) — de registrerer hver sin betingelse, og ÉN delt lytter åpner
//  spilleren når minst én av dem er sann. Da dobbeltåpner ingenting.
// ============================================================================

import { ytEmbedUrl, ytMaal } from "./presentasjon-modell.js?v=5.28";
import { modalOpen, setupModal, initModalHeaders } from "./ui-modal.js?v=5.28";

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
    <div class="yt-ramme"><iframe id="yt-iframe" title="YouTube-avspilling"
      allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
    <p class="muted yt-reserve">Spilles ikke videoen her (noen rettighetshavere tillater ikke innbygging):
      <a id="yt-ekstern" href="#" target="_blank" rel="noopener">Åpne på YouTube</a></p>
  </div>
</div>`;
  m = wrap.firstElementChild;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  // Alle lukkeveier (✕, ←, Escape, bakgrunn) går gjennom modalClose — tøm
  // iframen der, ellers fortsetter lyden bak en lukket modal.
  m._beforeClose = () => {
    const fr = m.querySelector("#yt-iframe");
    if (fr) fr.src = "";
    return true;
  };
  return m;
}

// Åpner spilleren for en YouTube-lenke. Returnerer false når lenka ikke kan
// bygges inn (søkelenker o.l.) — kalleren lar den da åpne i ny fane som før.
export function apneYtSpiller(url, tittel) {
  const embed = ytEmbedUrl(url);
  if (!embed) return false;
  const m = ytModal();
  const maal = ytMaal(url);
  // Rene spillelister (uten video-ID) får ingen stopp-identitet: vis-formatet
  // krever en id foran modusfeltet. De spilles likevel.
  m.dataset.vis = maal?.video ? `yt:${maal.video}${maal.list ? `:${maal.list}` : ""}` : "";
  m.querySelector("#yt-tittel").textContent = tittel || "Avspilling";
  m.querySelector("#yt-ekstern").href = url;
  m.querySelector("#yt-iframe").src = embed;
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
