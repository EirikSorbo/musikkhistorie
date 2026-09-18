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

import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "./feature-flags.js?v=5.32";
import { FLATER, NIVAA_NAVN, erSynlig, faktaSynlig, normaliserPlaner, klampStopp } from "./presentasjon-modell.js?v=5.32";
import { erSkrivefelt, parseVisVerdi } from "./vis-lenke.js?v=5.32";
import { modalClose } from "./ui-modal.js?v=5.32";
import { registrerYtIntercept } from "./yt-spiller.js?v=5.32";
import { escapeHtml } from "./util.js?v=5.32";
import { apneVisNaarKlart } from "./explore-apne.js?v=5.32";
import { getState } from "./explore-context.js?v=5.32";

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
  plan: "pensumPresPlan",
  stopp: "pensumPresStopp",
};

// sessionStorage kan kaste (blokkerte nettsteddata) — presentasjonen skal
// virke likevel, den husker bare mindre.
const les = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const skriv = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };

let aktiv = null;

// Kan kalles fra hvor som helst (explore.js spør før hub-kortene fjernes),
// uavhengig av om initPresentasjon har kjørt. ?presentasjon alene slår på
// modusen; ?presentasjon=<planId> starter i tillegg en kjøreplan (fase 4),
// med ?stopp=<n> (1-basert) som posisjon — slik overlever både hoppet til
// tre.html (sessionStorage) og en omlasting (URL-en) hele tilstanden.
export function erPresentasjon() {
  if (aktiv !== null) return aktiv;
  let param = null;
  try { param = new URLSearchParams(window.location.search).get("presentasjon"); } catch (e) {}
  aktiv = param !== null || les(LAGRING.aktiv) === "1";
  if (param !== null) {
    skriv(LAGRING.aktiv, "1");
    if (param && param !== "1") {
      skriv(LAGRING.plan, param);
      let s = 0;
      try { s = Number(new URLSearchParams(window.location.search).get("stopp")) - 1; } catch (e) {}
      skriv(LAGRING.stopp, String(Number.isFinite(s) && s > 0 ? s : 0));
    }
  }
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
  // Enkeltlinjer i faktablokka (v5.29): levetid fra nivå 1, årstallene og
  // resten fra nivå 3, kategori/instrument aldri.
  modal.querySelectorAll("[data-fakta]").forEach((el) => {
    el.hidden = !faktaSynlig(flate, el.dataset.fakta, nivaa);
  });
  if (flate === "artist") flyttLevetid(modal);
}

// Levetiden hører til under portrettet på lerretet (v5.30), der
// fotokrediteringen ellers står — den er skjult i visning (CSS). Flyttingen
// gjøres i DOM-en fordi linja bor i faktablokka, langt fra figuren, og
// gjentas ved hver omtegning: renderArtistDetail bygger kroppen på nytt.
// Uten bilde blir linja stående der den er.
function flyttLevetid(modal) {
  const figur = modal.querySelector(".artist-image");
  const levetid = modal.querySelector('[data-fakta="levetid"]');
  if (!figur || !levetid || figur.contains(levetid)) return;
  levetid.classList.add("pres-levetid");
  figur.appendChild(levetid);
}

function brukNivaa() {
  for (const [flate, ids] of Object.entries(FLATE_MODAL)) {
    for (const id of ids) {
      const m = document.getElementById(id);
      if (m) brukNivaaPaa(flate, m);
    }
  }
  // Nivået på body: CSS kan da gi bildet hovedfokus på nivå 1 (v5.29).
  document.body.dataset.presNivaa = String(nivaa);
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

// Den innebygde YouTube-spilleren bor i js/yt-spiller.js fra v5.28 — delt
// med samleøktene (plan-innsamling.js), som også skal fange lytteeksempler.

// ----------------------------------------------------------------------------
//  Kjøreplan-avspilling (fase 4, v5.25). Planene bor i content/presentasjoner
//  og leses fra det delte state-treet; presPlanTikk kalles fra sidenes
//  content-hooks til planen har landet (snapshot-drevet, ingen frister —
//  samme filosofi som ?vis=-ruteren). Hvert stopp er en ?vis=-verdi, så
//  åpningen gjenbruker apneVisNaarKlart, med all ventelogikken den alt har.
//  Stoppene virker på BEGGE sidene: utforsk-modalene injiseres også på
//  tre.html, og «slektstre»-målet er no-op der (vi ER i treet).
// ----------------------------------------------------------------------------

let planId = null;
let plan = null;      // normalisert plan, satt når content har landet
let stoppIdx = 0;

function oppdaterTeller() {
  const teller = document.getElementById("pres-teller");
  if (!teller) return;
  if (!plan) { teller.textContent = "…"; return; }
  teller.textContent = `${stoppIdx + 1}/${plan.stopp.length}`;
}

// Gå til et stopp: lukk det som står åpent, sett stoppets nivå og unntak, og
// åpne målet når dataene dets er klare. Kalles også som «Til stoppet» etter
// en avstikker (samme indeks på nytt).
function gaTilStopp(i) {
  if (!plan || !plan.stopp.length) return;
  stoppIdx = klampStopp(i, plan.stopp.length);
  skriv(LAGRING.stopp, String(stoppIdx));
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("presentasjon", planId);
    u.searchParams.set("stopp", String(stoppIdx + 1));
    u.searchParams.delete("vis");   // et gammelt dyplenke-mål skal ikke gjenåpnes ved reload
    window.history.replaceState(null, "", u);
  } catch (e) {}

  const stopp = plan.stopp[stoppIdx];
  if (stopp.nivaa) nivaa = stopp.nivaa;
  // Stoppets definisjon gjelder: unntak satt i farten lever bare fram til
  // neste stoppbytte.
  unntak = stopp.unntak ? { ...stopp.unntak } : {};
  lagreTilstand();
  brukNivaa();

  document.querySelectorAll(".modal-backdrop.open").forEach((m) => modalClose(m));
  apneVisNaarKlart(parseVisVerdi(stopp.vis));
  oppdaterTeller();
}

// Kalles fra sidenes content-hooks. No-op til planId finnes og content har
// landet; åpner så startstoppet ÉN gang.
export function presPlanTikk() {
  if (!planId || plan) return;
  const s = getState();
  const planer = normaliserPlaner(s.content?.presentasjoner?.planer);
  if (planer[planId]) {
    plan = planer[planId];
    if (!plan.stopp.length) {
      const teller = document.getElementById("pres-teller");
      if (teller) teller.textContent = "tom plan";
      return;
    }
    gaTilStopp(stoppIdx);
  } else if (s.contentLoaded) {
    // Slettet plan eller feilskrevet lenke: si det stille i telleren i
    // stedet for å la «…» stå og lyve.
    const teller = document.getElementById("pres-teller");
    if (teller) { teller.textContent = "plan mangler"; teller.title = `Fant ingen kjøreplan med id «${planId}»`; }
    console.warn("Kjøreplanen finnes ikke:", planId);
    planId = null;
  }
}

function wirePlanTaster() {
  document.addEventListener("keydown", (e) => {
    if (!plan) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // PageUp/PageDown er presentasjonsfjernkontrollenes taster og tas alltid;
    // pilene bare utenfor skrivefelt (tekstmarkøren trenger dem der).
    const fram = e.key === "PageDown" || (e.key === "ArrowRight" && !erSkrivefelt(document.activeElement));
    const tilbake = e.key === "PageUp" || (e.key === "ArrowLeft" && !erSkrivefelt(document.activeElement));
    if (!fram && !tilbake) return;
    e.preventDefault();
    gaTilStopp(stoppIdx + (fram ? 1 : -1));
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
    <span class="pres-plan" id="pres-plan" hidden role="group" aria-label="Kjøreplan">
      <button type="button" class="pres-knapp" id="pres-forrige" title="Forrige stopp (PageUp / ←)" aria-label="Forrige stopp">‹</button>
      <button type="button" class="pres-knapp pres-teller-knapp" id="pres-teller" title="Til stoppet">…</button>
      <button type="button" class="pres-knapp" id="pres-neste" title="Neste stopp (PageDown / →)" aria-label="Neste stopp">›</button>
    </span>
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
    if (e.target.closest("#pres-forrige")) return gaTilStopp(stoppIdx - 1);
    if (e.target.closest("#pres-neste")) return gaTilStopp(stoppIdx + 1);
    // Telleren selv er «Til stoppet»: veien tilbake etter en avstikker.
    if (e.target.closest("#pres-teller")) return gaTilStopp(stoppIdx);
    if (e.target.closest("#pres-skala")) return vekslSkala();
    if (e.target.closest("#pres-full")) return vekslFullskjerm();
    if (e.target.closest("#pres-tannhjul")) return vekslPanel();
    if (e.target.closest("#pres-avslutt")) return avslutt();
  });
}

// Tekststørrelse i tre trinn (v5.29): normal → stor → størst, og rundt igjen.
// Nesten alt i CSS-en er rem-basert, så rot-størrelsen flytter hele visningen.
const SKALA_NAVN = ["A", "A+", "A++"];

function brukSkala(trinn) {
  const rot = document.documentElement;
  rot.classList.toggle("pres-stor", trinn === 1);
  rot.classList.toggle("pres-storst", trinn === 2);
  const knapp = document.getElementById("pres-skala");
  if (knapp) {
    knapp.textContent = SKALA_NAVN[trinn];
    knapp.title = ["Normal tekst", "Stor tekst", "Størst tekst"][trinn];
  }
}

function vekslSkala() {
  const trinn = (Number(les(LAGRING.stor)) + 1) % 3;
  skriv(LAGRING.stor, String(trinn));
  brukSkala(trinn);
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
  // «1» er den gamle på/av-verdien fra v5.24 og leses som trinn 1.
  const skalaTrinn = Math.min(2, Math.max(0, Number(les(LAGRING.stor)) || 0));

  // Kjøreplanen (fase 4): id og posisjon fra sessionStorage — erPresentasjon
  // har alt skrevet URL-parametrene dit, og et sidebytte bærer dem videre.
  planId = les(LAGRING.plan) || null;
  stoppIdx = Math.max(0, Number(les(LAGRING.stopp)) || 0);

  byggBar();
  brukSkala(skalaTrinn);   // etter byggBar: knappen skal vise trinnet
  if (planId) {
    const planUi = document.getElementById("pres-plan");
    if (planUi) planUi.hidden = false;
    wirePlanTaster();
  }
  if (qaPaa()) settQA(true); else oppdaterHubKort();
  observerModaler();
  brukNivaa();
  // Betingelsen er alltid sann HER: registreringen skjer bare når modusen er
  // aktiv (vi returnerte tidlig ellers). Samleøktene registrerer sin egen.
  registrerYtIntercept(() => true);
  // Content kan alt ligge i state (lokal cache): prøv med en gang, ellers
  // tar sidenes content-hooks det når snapshotet lander.
  presPlanTikk();

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
