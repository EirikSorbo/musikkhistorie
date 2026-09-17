// ============================================================================
//  PRESENTASJONSVISNING — browser-delen (v5.24)
// ----------------------------------------------------------------------------
//  Appen som tavle i timen (fase 3 i «git ignore/PRESENTASJON-PLAN.md»):
//  læreren starter modusen fra presentasjonsikonet i toppnavigasjonen, og
//  forsiden (og slektstresiden) viser da bare innhold — ingen forslags-,
//  stemme- eller returknapper. En diskret verktøylinje nede til høyre gir
//  detaljnivå (1/2/3, også som taster), tekststørrelse, fullskjerm, et
//  tannhjul-panel og Avslutt.
//
//  Modusen bæres av sessionStorage (pensumPresentasjon), så hoppet til
//  tre.html og tilbake beholder den; ?presentasjon i URL-en slår den på.
//  Avslutt laster forsiden på nytt — det nullstiller også QA-bryteren, som
//  MUTERER feature-flaggene for økta (originalverdiene ligger i modulen og
//  gjenoppstår uansett ved neste sidelast).
//
//  Detaljnivåene: renderne merker seksjonene sine med data-sekt (kontrakten
//  ligger i js/presentasjon-modell.js, låst av en test), og denne modulen
//  setter hidden på dem etter nivå + unntak. MutationObserver per modal gjør
//  at hver omtegning (chip-bytte, snapshot) får nivået på nytt — childList-
//  filteret gjør at våre egne hidden-attributter ikke trigger observatøren.
//
//  Ingen av delene her kjører når modusen er av: initPresentasjon returnerer
//  tidlig, og da er data-sekt-attributtene inerte.
// ============================================================================

import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "./feature-flags.js?v=5.24";
import { FLATER, NIVAA_SEKT, NIVAA_NAVN, erSynlig, ytEmbedUrl } from "./presentasjon-modell.js?v=5.24";
import { erSkrivefelt } from "./vis-lenke.js?v=5.24";
import { modalOpen, modalClose, setupModal, initModalHeaders } from "./ui-modal.js?v=5.24";
import { escapeHtml } from "./util.js?v=5.24";

// Hvilken modal som viser hvilken flate-type (modal-artist-detail er
// slektstresidens artistkort; resten bor på forsiden).
const FLATE_MODAL = {
  artist: ["modal-detail", "modal-artist-detail"],
  sjanger: ["modal-sjanger"],
  tech: ["modal-tech-detail"],
  "tiår": ["modal-decade-view"],
  historie: ["modal-historier"],
};

const LAGRING = {
  aktiv: "pensumPresentasjon",
  nivaa: "pensumPresNivaa",
  unntak: "pensumPresUnntak",
  stor: "pensumPresStor",
  qa: "pensumPresQA",
};

// sessionStorage kan kaste (blokkerte nettsteddata) — presentasjonen skal
// virke likevel, den husker bare mindre.
const les = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const skriv = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };

let aktiv = null;

// Kan kalles fra hvor som helst (explore.js spør før hub-kortene fjernes),
// uavhengig av om initPresentasjon har kjørt.
export function erPresentasjon() {
  if (aktiv !== null) return aktiv;
  let param = false;
  try { param = new URLSearchParams(window.location.search).has("presentasjon"); } catch (e) {}
  aktiv = param || les(LAGRING.aktiv) === "1";
  if (param) skriv(LAGRING.aktiv, "1");
  return aktiv;
}

let nivaa = 2;
let unntak = {};
const qaOriginal = { flagg: { ...SKJUL_I_STUDENTVISNING }, hub: { ...SKJUL_I_HUBEN } };

function lagreTilstand() {
  skriv(LAGRING.nivaa, String(nivaa));
  skriv(LAGRING.unntak, JSON.stringify(unntak));
}

// ----------------------------------------------------------------------------
//  Detaljnivået
// ----------------------------------------------------------------------------

function brukNivaaPaa(flate, modal) {
  modal.querySelectorAll("[data-sekt]").forEach((el) => {
    el.hidden = !erSynlig(flate, el.dataset.sekt, nivaa, unntak);
  });
}

function brukNivaa() {
  for (const [flate, ids] of Object.entries(FLATE_MODAL)) {
    for (const id of ids) {
      const m = document.getElementById(id);
      if (m) brukNivaaPaa(flate, m);
    }
  }
  document.querySelectorAll("#pres-bar [data-nivaa]").forEach((b) =>
    b.classList.toggle("active", Number(b.dataset.nivaa) === nivaa));
}

function settNivaa(n) {
  nivaa = Math.min(3, Math.max(1, Number(n) || 2));
  lagreTilstand();
  brukNivaa();
}

// Omtegninger (chip-bytte, snapshot) bygger seksjonene på nytt uten hidden.
// childList-filteret er poenget: våre egne hidden-settinger er attributt-
// mutasjoner og starter ingen ny runde.
function observerModaler() {
  if (!("MutationObserver" in window)) return;
  for (const [flate, ids] of Object.entries(FLATE_MODAL)) {
    for (const id of ids) {
      const m = document.getElementById(id);
      if (!m) continue;
      new MutationObserver(() => brukNivaaPaa(flate, m))
        .observe(m, { childList: true, subtree: true });
    }
  }
}

// ----------------------------------------------------------------------------
//  QA-bryteren: innhold som er skjult for studenter i påvente av
//  kvalitetssikring (feature-flags.js). AV som standard i presentasjon
//  (brukerbeslutning 2026-09-17); slås bevisst på for økta. Muterer de delte
//  flaggobjektene — alle stedene som leser dem ved render følger med, og
//  Avslutt-reloaden nullstiller alt.
// ----------------------------------------------------------------------------

function qaPaa() { return les(LAGRING.qa) === "1"; }

function settQA(vis) {
  for (const k of Object.keys(SKJUL_I_STUDENTVISNING)) {
    SKJUL_I_STUDENTVISNING[k] = vis ? false : qaOriginal.flagg[k];
  }
  for (const k of Object.keys(SKJUL_I_HUBEN)) {
    SKJUL_I_HUBEN[k] = vis ? false : qaOriginal.hub[k];
  }
  skriv(LAGRING.qa, vis ? "1" : "");
  oppdaterHubKort();
}

// Hub-kortene ligger i DOM-en i presentasjonsmodus (explore.js fjerner dem
// ellers) og styres med hidden, så bryteren virker uten sidelast.
function oppdaterHubKort() {
  const sb = document.getElementById("modal-store-bildet");
  if (!sb) return;
  sb.querySelectorAll(".dash-card").forEach((kort) => {
    if (kort.id in SKJUL_I_HUBEN) kort.hidden = !!SKJUL_I_HUBEN[kort.id];
  });
}

// ----------------------------------------------------------------------------
//  Innebygd YouTube-avspilling (brukerkrav 2026-09-17): lytteeksempler
//  spilles i appen i stedet for ny fane. Søkelenker har ingen video-ID og
//  åpner som før; «Åpne på YouTube» står alltid som reserve, siden enkelte
//  musikkvideoer har innbygging avslått av rettighetshaveren.
// ----------------------------------------------------------------------------

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

function apneSpiller(embed, originalUrl, tittel) {
  const m = ytModal();
  m.querySelector("#yt-tittel").textContent = tittel || "Avspilling";
  m.querySelector("#yt-ekstern").href = originalUrl;
  m.querySelector("#yt-iframe").src = embed;
  modalOpen(m);
}

function wireYtIntercept() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="yout"]');
    if (!a || a.id === "yt-ekstern") return;
    const embed = ytEmbedUrl(a.href);
    if (!embed) return;   // søkelenker o.l.: ny fane som før
    e.preventDefault();
    apneSpiller(embed, a.href, a.textContent.trim());
  });
}

// ----------------------------------------------------------------------------
//  Verktøylinja og tannhjul-panelet
// ----------------------------------------------------------------------------

const IKON = {
  full: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  tannhjul: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
};

function byggBar() {
  const bar = document.createElement("div");
  bar.id = "pres-bar";
  bar.innerHTML = `
    <span class="pres-nivaa" role="group" aria-label="Detaljnivå">
      ${[1, 2, 3].map((n) => `<button type="button" class="pres-knapp" data-nivaa="${n}" title="${NIVAA_NAVN[n]} (tast ${n})">${n}</button>`).join("")}
    </span>
    <button type="button" class="pres-knapp" id="pres-skala" title="Større tekst">A</button>
    <button type="button" class="pres-knapp" id="pres-full" title="Fullskjerm">${IKON.full}</button>
    <button type="button" class="pres-knapp" id="pres-tannhjul" title="Innstillinger" aria-label="Innstillinger">${IKON.tannhjul}</button>
    <button type="button" class="pres-knapp pres-avslutt" id="pres-avslutt">Avslutt</button>
    <div id="pres-panel" hidden></div>`;
  document.body.appendChild(bar);

  bar.addEventListener("click", (e) => {
    const nb = e.target.closest("[data-nivaa]");
    if (nb) return settNivaa(nb.dataset.nivaa);
    if (e.target.closest("#pres-skala")) return vekslSkala();
    if (e.target.closest("#pres-full")) return vekslFullskjerm();
    if (e.target.closest("#pres-tannhjul")) return vekslPanel();
    if (e.target.closest("#pres-avslutt")) return avslutt();
  });
}

function vekslSkala() {
  const stor = !document.documentElement.classList.contains("pres-stor");
  document.documentElement.classList.toggle("pres-stor", stor);
  skriv(LAGRING.stor, stor ? "1" : "");
}

function vekslFullskjerm() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

function avslutt() {
  for (const k of Object.values(LAGRING)) { try { sessionStorage.removeItem(k); } catch (e) {} }
  // Full sidelast: nullstiller også flaggmutasjonene fra QA-bryteren.
  window.location.href = "index.html";
}

// Øverste åpne modal som er en merket flate — det er den tannhjul-panelets
// seksjonsliste gjelder.
function aktivFlate() {
  let best = null;
  for (const [flate, ids] of Object.entries(FLATE_MODAL)) {
    for (const id of ids) {
      const m = document.getElementById(id);
      if (!m?.classList.contains("open")) continue;
      const z = parseInt(m.style.zIndex) || 0;
      if (!best || z > best.z) best = { flate, z };
    }
  }
  return best?.flate || null;
}

function vekslPanel() {
  const panel = document.getElementById("pres-panel");
  if (!panel) return;
  if (!panel.hidden) { panel.hidden = true; return; }
  tegnPanel(panel);
  panel.hidden = false;
}

function tegnPanel(panel) {
  const flate = aktivFlate();
  const seksjoner = flate ? FLATER[flate] : null;
  const flateNavn = { artist: "artistkortet", sjanger: "sjangerkortet", tech: "innovasjonskortet", "tiår": "tiårsvisningen", historie: "historien" };

  panel.innerHTML = `
    ${seksjoner ? `
      <p class="pres-panel-hode">Seksjoner på ${flateNavn[flate]}</p>
      ${seksjoner.map(({ id, navn }) => `
        <label class="pres-valg"><input type="checkbox" data-sekt-valg="${id}"
          ${erSynlig(flate, id, nivaa, unntak) ? "checked" : ""}> ${escapeHtml(navn)}</label>`).join("")}
      <button type="button" class="btn ghost small" id="pres-nullstill">Nullstill unntak</button>
      <hr class="pres-skille">`
    : `<p class="pres-panel-hode">Åpne et kort for å velge seksjoner.</p>`}
    <label class="pres-valg pres-qa"><input type="checkbox" id="pres-qa" ${qaPaa() ? "checked" : ""}>
      Vis innhold som er skjult for studentene (sjangerhistorier, koblingstekster, «Hør etter», viktighetsgrad, alle hubkort)</label>`;

  panel.querySelectorAll("[data-sekt-valg]").forEach((cb) => {
    cb.addEventListener("change", () => {
      unntak[`${flate}.${cb.dataset.sektValg}`] = cb.checked;
      lagreTilstand();
      brukNivaa();
    });
  });
  panel.querySelector("#pres-nullstill")?.addEventListener("click", () => {
    unntak = {};
    lagreTilstand();
    brukNivaa();
    tegnPanel(panel);
  });
  panel.querySelector("#pres-qa")?.addEventListener("change", (e) => {
    settQA(e.target.checked);
  });
}

// ----------------------------------------------------------------------------
//  Oppstart
// ----------------------------------------------------------------------------

export function initPresentasjon() {
  if (!erPresentasjon()) return;
  document.body.classList.add("presentasjon");

  nivaa = Math.min(3, Math.max(1, Number(les(LAGRING.nivaa)) || 2));
  try { unntak = JSON.parse(les(LAGRING.unntak) || "{}") || {}; } catch (e) { unntak = {}; }
  if (les(LAGRING.stor) === "1") document.documentElement.classList.add("pres-stor");

  byggBar();
  if (qaPaa()) settQA(true); else oppdaterHubKort();
  observerModaler();
  brukNivaa();
  wireYtIntercept();

  // Tastene 1/2/3 bytter nivå — men aldri når fokus står i et skrivefelt
  // (søkefeltet bruker sifre i helt vanlig forstand).
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!["1", "2", "3"].includes(e.key)) return;
    if (erSkrivefelt(document.activeElement)) return;
    e.preventDefault();
    settNivaa(e.key);
  });
}
