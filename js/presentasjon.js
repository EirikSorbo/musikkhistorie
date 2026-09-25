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

import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "./feature-flags.js?v=5.57";
import { FLATER, NIVAA_NAVN, erSynlig, faktaSynlig, normaliserPlaner, planPosisjon, tellerTekst, planOversikt, innsettingsIndeks, medStoppSattInn, presTast, PRES_TASTER } from "./presentasjon-modell.js?v=5.57";
import { erSkrivefelt, parseVisVerdi } from "./vis-lenke.js?v=5.57";
import { modalOpen, modalClose, setupModal, initModalHeaders, topOpenModal } from "./ui-modal.js?v=5.57";
import { GENEALOGY } from "./genre-model.js?v=5.57";
import { ordneArtistLerret, flyttLevetid, ryddArtistLerret } from "./pres-artist.js?v=5.57";
import { registrerYtIntercept, veksleYtAvspilling } from "./yt-spiller.js?v=5.57";
import { escapeHtml } from "./util.js?v=5.57";
import { apneVisNaarKlart } from "./explore-apne.js?v=5.57";
import { getState } from "./explore-context.js?v=5.57";
import { onAuthChange } from "./store.js?v=5.57";
import { erLaererBruker, settInnStopp } from "./plan-meny.js?v=5.57";

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
  // Satt når læreren selv har gått ut av fullskjerm: da slås den ikke på
  // igjen automatisk resten av visningen (v5.55).
  fullNei: "pensumPresFullNei",
};

// sessionStorage kan kaste (blokkerte nettsteddata) — presentasjonen skal
// virke likevel, den husker bare mindre.
const les = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const skriv = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };

let aktiv = null;

// Kan kalles fra hvor som helst (explore.js spør før hub-kortene fjernes),
// uavhengig av om initPresentasjon har kjørt. ?presentasjon alene slår på
// modusen; ?presentasjon=<planId> starter i tillegg en kjøreplan (fase 4),
// med ?stopp=<k> som posisjon (0 = oversiktskortet, 1..n = stoppene; se
// planPosisjon) — slik overlever både hoppet til tre.html (sessionStorage)
// og en omlasting (URL-en) hele tilstanden. Uten ?stopp starter planen på
// oversiktskortet.
export function erPresentasjon() {
  if (aktiv !== null) return aktiv;
  let param = null;
  try { param = new URLSearchParams(window.location.search).get("presentasjon"); } catch (e) {}
  aktiv = param !== null || les(LAGRING.aktiv) === "1";
  if (param !== null) {
    skriv(LAGRING.aktiv, "1");
    if (param && param !== "1") {
      // Tilbake til en side i SAMME kjøreplan (nettleserens tilbake, «←
      // Tilbake» fra slektstreet): posisjonen i sessionStorage er den
      // ferskeste, for læreren kan ha bladd videre på den andre sida. Adressen
      // bærer posisjonen fra da sida ble forlatt (audit v5.42 funn 12).
      const tilbakeISammePlan = erTilbakeNavigering() && les(LAGRING.plan) === param;
      skriv(LAGRING.plan, param);
      if (!tilbakeISammePlan) {
        let s = 0;
        try { s = Number(new URLSearchParams(window.location.search).get("stopp")); } catch (e) {}
        skriv(LAGRING.stopp, String(Number.isFinite(s) && s > 0 ? Math.trunc(s) : 0));
      }
    } else {
      // Fri visning (?presentasjon eller =1) er uten kjøreplan (v5.41): en
      // plan fra tidligere i økta lå ellers igjen i sessionStorage og ble
      // spilt videre.
      for (const k of [LAGRING.plan, LAGRING.stopp]) { try { sessionStorage.removeItem(k); } catch (e) {} }
    }
  }
  return aktiv;
}

// Kjøreplanen som spilles nå, eller null (fri visning / modusen av). For
// «spilles nå»-merket i Visning-vinduet (js/visning.js).
export function aktivPlanId() {
  return erPresentasjon() ? les(LAGRING.plan) || null : null;
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
  // Artistkortets spalter (v5.40, js/pres-artist.js) bygges FØR nivået
  // settes: skillelinja må finnes når synligheten dens regnes ut under.
  if (flate === "artist") ordneArtistLerret(modal);
  // Oppsummeringspunktene (v5.50) erstatter beskrivelsen på nivå 2, men bare
  // når kortet faktisk har punkter (seksjonen tegnes bare da).
  const harPunkter = !!modal.querySelector('[data-sekt="punkter"]');
  modal.querySelectorAll("[data-sekt]").forEach((el) => {
    el.hidden = !erSynlig(flate, el.dataset.sekt, nivaa, unntak, { harPunkter });
  });
  // Enkeltlinjer i faktablokka (v5.29): på artistkortet bare levetiden (fra
  // nivå 1, under bildet), kategori/instrument aldri på innovasjonskortet.
  modal.querySelectorAll("[data-fakta]").forEach((el) => {
    el.hidden = !faktaSynlig(flate, el.dataset.fakta, nivaa);
  });
  if (flate === "artist") {
    flyttLevetid(modal);
    ryddArtistLerret(modal);
  }
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
// Posisjonen i avspillingen, ikke i planen: 0 = oversiktskortet, 1..n =
// planens stopp, n+1 = oppsummeringen (v5.36, se planPosisjon).
let stoppIdx = 0;

function oppdaterTeller() {
  const teller = document.getElementById("pres-teller");
  if (!teller) return;
  teller.textContent = plan ? tellerTekst(stoppIdx, plan.stopp.length) : "…";
}

// Gå til en posisjon: lukk det som står åpent, sett stoppets nivå og unntak,
// og åpne målet når dataene dets er klare (eller oversiktskortet, først og
// sist). Kalles også som «Til stoppet» etter en avstikker (samme posisjon).
function gaTilStopp(i) {
  if (!plan || !plan.stopp.length) return;
  const p = planPosisjon(i, plan.stopp.length);

  // Lyd som spiller i et åpent kort (en podkastepisode) stoppes før byttet:
  // podkastkortets «stopp eller fortsett?»-vakt avviste ellers lukkingen, og
  // spørsmålet havnet skjult under neste stopp mens lyden gikk videre
  // (audit v5.42 funn 7). YouTube-spilleren river iframen selv.
  document.querySelectorAll(".modal-backdrop.open audio").forEach((a) => { try { a.pause(); } catch (e) {} });
  // Ovenfra og ned. Nekter et kort å lukkes (en ulagret kladd i kjøreplan-
  // editoren), avbrytes byttet: posisjonen står, og kortene under blir
  // liggende urørt (i dokumentrekkefølge ble et lytteeksempel under
  // editoren revet før vetoet; kontrollrunden for v5.48).
  // (Taket på 50 er et vern mot et kort som åpner et nytt ved lukking.)
  for (let top = topOpenModal(), n = 0; top && n < 50; top = topOpenModal(), n++) {
    modalClose(top);
    if (top.classList.contains("open")) return;
  }

  stoppIdx = p.pos;
  lagrePosisjon();

  // Stoppets definisjon gjelder: unntak satt i farten lever bare fram til
  // neste stoppbytte. Oversiktskortene har ingen egen definisjon.
  const stopp = p.oversikt ? null : plan.stopp[p.stopp];
  if (stopp?.nivaa) nivaa = stopp.nivaa;
  unntak = stopp?.unntak ? { ...stopp.unntak } : {};
  lagreTilstand();
  brukNivaa();

  // Tilbake fra slektstresiden (nettleserens tilbake eller «← Tilbake») til
  // et slektstre-stopp: sida skal ikke hoppe rett tilbake dit igjen, for da
  // ble tilbake-knappen en løkke (funn 12). Neste → går videre som vanlig.
  const tilbakeTilTreet = hoppOverSlektstre && stopp?.vis === "slektstre";
  hoppOverSlektstre = false;
  if (p.oversikt) visOversikt();
  else if (!tilbakeTilTreet) apneVisNaarKlart(parseVisVerdi(stopp.vis));
  oppdaterTeller();
  oppdaterLeggTil();
}

// Satt når sida er nådd med nettleserens tilbake/fram (se over).
let hoppOverSlektstre = false;

function erTilbakeNavigering() {
  try { return performance.getEntriesByType("navigation")[0]?.type === "back_forward"; } catch (e) { return false; }
}

// Posisjonen i sessionStorage (hoppet til tre.html) og i URL-en (omlasting).
function lagrePosisjon() {
  skriv(LAGRING.stopp, String(stoppIdx));
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("presentasjon", planId);
    u.searchParams.set("stopp", String(stoppIdx));
    u.searchParams.delete("vis");   // et gammelt dyplenke-mål skal ikke gjenåpnes ved reload
    window.history.replaceState(null, "", u);
  } catch (e) {}
}

// ----------------------------------------------------------------------------
//  «Legg til her» (v5.37, brukerkrav 2026-09-18): en innskytelse midt i
//  fremvisningen, søkt opp som avstikker, legges inn i kjøreplanen RETT ETTER
//  der man står, med ett klikk i verktøylinja. Kortet som ligger øverst er
//  det som legges til, med detaljnivået som vises, og det nye stoppet blir
//  posisjonen: → fortsetter til det som var neste stopp, ← går tilbake.
//  Bare for lærerøkter (samme sjekk som lenkemenyen); reglene lar uansett
//  bare læreren skrive content/presentasjoner.
// ----------------------------------------------------------------------------

let erLaerer = false;
let lagrer = false;

// Målet til det øverste åpne kortet, eller null. Søket og oversiktskortet
// har ingen data-vis: står søket øverst, er man ikke ferdig med å velge.
function toppMaal() {
  return topOpenModal()?.dataset.vis || null;
}

function naavaerendeStoppVis() {
  if (!plan) return null;
  const p = planPosisjon(stoppIdx, plan.stopp.length);
  return p.oversikt ? null : plan.stopp[p.stopp]?.vis || null;
}

function oppdaterLeggTil() {
  const knapp = document.getElementById("pres-leggtil");
  if (!knapp) return;
  knapp.hidden = !(erLaerer && plan);
  if (knapp.hidden || lagrer) return;
  const vis = toppMaal();
  const alleredeHer = !!vis && vis === naavaerendeStoppVis();
  knapp.disabled = !vis || alleredeHer;
  knapp.title = !vis ? "Legg til i kjøreplanen her (+): åpne først kortet du vil ha med"
    : alleredeHer ? "Kortet er allerede dette stoppet"
    : "Legg kortet til i kjøreplanen, rett etter der du står (+)";
}

async function leggTilHer() {
  const vis = toppMaal();
  if (!erLaerer || !plan || !vis || lagrer || vis === naavaerendeStoppVis()) return;
  const knapp = document.getElementById("pres-leggtil");
  const indeks = innsettingsIndeks(stoppIdx, plan.stopp.length);
  const stopp = { vis, nivaa };
  const forrige = plan;
  lagrer = true;
  if (knapp) knapp.disabled = true;
  // Lokalt med en gang: → skal kjenne det nye stoppet før serveren svarer
  // (Firestore bekrefter først når nettet har svart).
  plan = medStoppSattInn({ [planId]: plan }, planId, indeks, stopp)[planId];
  stoppIdx = indeks + 1;
  lagrePosisjon();
  oppdaterTeller();
  try {
    plan = await settInnStopp(planId, indeks, stopp);
    if (knapp) { knapp.innerHTML = IKON.hake; knapp.title = `Lagt til som stopp ${indeks + 1}`; }
    setTimeout(() => {
      if (knapp) knapp.innerHTML = IKON.pluss;
      lagrer = false;
      oppdaterLeggTil();
    }, 1500);
  } catch (e) {
    // Tilbake til planen uten stoppet. Har man bladd videre imens, flyttes
    // posisjonen ett hakk tilbake, så den fortsatt peker på samme stopp.
    plan = forrige;
    if (stoppIdx > indeks) stoppIdx -= 1;
    lagrePosisjon();
    oppdaterTeller();
    lagrer = false;
    oppdaterLeggTil();
    alert(`Fikk ikke lagt til stoppet (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`);
  }
}

// ----------------------------------------------------------------------------
//  Oversiktskortet (v5.36): første og siste posisjon i hver kjøreplan
//  (brukerkrav 2026-09-18). Innholdet er gruppert etter kategori, ikke i
//  planens rekkefølge (planOversikt), og hvert punkt hopper til stoppet sitt.
//  Modalen bygges første gang den trengs, så den virker på begge sidene.
// ----------------------------------------------------------------------------

function oversiktModal() {
  let m = document.getElementById("modal-pres-oversikt");
  if (m) return m;
  m = document.createElement("div");
  m.className = "modal-backdrop";
  m.id = "modal-pres-oversikt";
  m.innerHTML = `
    <div class="modal pres-oversikt">
      <div class="modal-head">
        <h2 id="pres-ov-tittel"></h2>
        <button type="button" class="modal-close btn ghost small">✕</button>
      </div>
      <p class="pres-ov-merke" id="pres-ov-merke"></p>
      <div class="pres-ov-grid" id="pres-ov-grid"></div>
    </div>`;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();   // idempotent: ← og ✕ som på alle de andre kortene
  m.addEventListener("click", (e) => {
    const punkt = e.target.closest("[data-ov-stopp]");
    if (punkt) gaTilStopp(Number(punkt.dataset.ovStopp) + 1);
  });
  return m;
}

function tegnOversikt() {
  const m = document.getElementById("modal-pres-oversikt");
  if (!m || !plan) return;
  const s = getState();
  const grupper = planOversikt(plan.stopp, {
    artister: s.artists,
    tech: s.techItems,
    nodeNavn: (id) => GENEALOGY.find((n) => n.id === id)?.l,
  });
  const slutt = planPosisjon(stoppIdx, plan.stopp.length).oversikt === "slutt";
  m.querySelector("#pres-ov-tittel").textContent = plan.tittel;
  m.querySelector("#pres-ov-merke").textContent =
    `${slutt ? "Oppsummering" : "Oversikt"} · ${plan.stopp.length} stopp`;
  m.querySelector("#pres-ov-grid").innerHTML = grupper.map((k) => `
    <section class="pres-ov-kat">
      <h3>${escapeHtml(k.navn)}</h3>
      <ul>${k.punkter.map((p) => `
        <li><button type="button" class="pres-ov-punkt" data-ov-stopp="${p.stopp}">${escapeHtml(p.tekst)}</button>${
          p.detalj ? ` <span class="pres-ov-detalj">${escapeHtml(p.detalj)}</span>` : ""}</li>`).join("")}
      </ul>
    </section>`).join("");
}

function visOversikt() {
  const m = oversiktModal();
  tegnOversikt();
  modalOpen(m);
}

// Kalles fra sidenes snapshot-hooks. No-op til planId finnes og content har
// landet; åpner så startposisjonen ÉN gang. Deretter tegnes et åpent
// oversiktskort på nytt, fordi navnene i det kommer fra artist- og tech-
// lista, som kan lande etter planen.
export function presPlanTikk() {
  if (plan) {
    if (document.getElementById("modal-pres-oversikt")?.classList.contains("open")) tegnOversikt();
    return;
  }
  if (!planId) return;
  const s = getState();
  const planer = normaliserPlaner(s.content?.presentasjoner?.planer);
  if (planer[planId]) {
    plan = planer[planId];
    oppdaterLeggTil();
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

// ----------------------------------------------------------------------------
//  Hurtigtastene (v5.38). Kartet er presTast i modellen (testet); her
//  utføres handlingene. PageUp/PageDown er presentasjonsklikkernes taster og
//  tas alltid, pilene og bokstavene bare utenfor skrivefelt.
// ----------------------------------------------------------------------------

function wireTaster() {
  document.addEventListener("keydown", (e) => {
    if (erSvart()) return;   // den svarte skjermen har sin egen lytter (capture)
    const h = presTast(e, {
      plan: !!plan,
      iSkrivefelt: erSkrivefelt(document.activeElement),
      video: topOpenModal()?.id === "modal-yt",
    });
    if (!h) return;
    e.preventDefault();
    switch (h) {
      case "neste": return gaTilStopp(stoppIdx + 1);
      case "forrige": return gaTilStopp(stoppIdx - 1);
      case "oversikt": return gaTilStopp(0);
      case "oppsummering": return gaTilStopp(plan.stopp.length + 1);
      case "tilStoppet": return gaTilStopp(stoppIdx);
      case "leggTil": return leggTilHer();
      case "fullskjerm": return vekslFullskjerm();
      case "skala": return vekslSkala();
      case "svart": return vekslSvart();
      case "hjelp": return vekslHjelp();
      case "spill": return veksleYtAvspilling();
      default: if (h.startsWith("nivaa")) settNivaa(h.slice(5));
    }
  });
  // Mens skjermen er svart, henter tastene bildet tilbake i stedet for å
  // gjøre sin vanlige jobb: første trykk på → skal vise lerretet igjen, ikke
  // hoppe et stopp, og Esc skal ikke lukke kortet som ligger bak. Capture-
  // fasen stopper tastetrykket før sidenes egne Esc-lyttere ser det.
  document.addEventListener("keydown", (e) => {
    if (!erSvart() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!["b", "B", ".", "Escape", "ArrowRight", "ArrowLeft", "PageDown", "PageUp", " "].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    vekslSvart();
  }, true);
}

// Svart skjerm (B eller «.»): en svart flate over hele lerretet, også over
// verktøylinja, mens klassen diskuterer. Et klikk tar også bildet tilbake.
function erSvart() { return !!document.getElementById("pres-svart"); }

function vekslSvart() {
  const flate = document.getElementById("pres-svart");
  if (flate) { flate.remove(); return; }
  const ny = document.createElement("div");
  ny.id = "pres-svart";
  ny.title = "Svart skjerm: trykk B, Esc eller klikk for å komme tilbake";
  ny.addEventListener("click", () => ny.remove());
  document.body.appendChild(ny);
}

// Oversikten over tastene (?). Kjøreplan-gruppa bare når en plan spilles,
// «Legg til her» bare i lærerøkter, slik tastene faktisk virker.
function vekslHjelp() {
  let m = document.getElementById("modal-pres-taster");
  if (m?.classList.contains("open")) { modalClose(m); return; }
  if (!m) {
    m = document.createElement("div");
    m.className = "modal-backdrop";
    m.id = "modal-pres-taster";
    m.innerHTML = `
      <div class="modal modal-hjelp">
        <div class="modal-head">
          <h2>Hurtigtaster</h2>
          <button type="button" class="modal-close btn ghost small">✕</button>
        </div>
        <div class="pres-taster" id="pres-taster-liste"></div>
      </div>`;
    document.body.appendChild(m);
    setupModal(m);
    initModalHeaders();
  }
  m.querySelector("#pres-taster-liste").innerHTML = PRES_TASTER
    .filter((g) => !g.plan || plan)
    .map((g) => `
      <h3>${escapeHtml(g.gruppe)}</h3>
      <dl>${g.rader.filter((r) => !r.laerer || erLaerer).map((r) => `
        <dt>${r.taster.map((t) => `<kbd>${escapeHtml(t)}</kbd>`).join(" ")}</dt>
        <dd>${escapeHtml(r.hva)}</dd>`).join("")}
      </dl>`).join("");
  modalOpen(m);
}

// ----------------------------------------------------------------------------
//  Verktøylinja og tannhjul-panelet
// ----------------------------------------------------------------------------

const IKON = {
  pluss: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  hake: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  full: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  tannhjul: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
};

function byggBar() {
  const bar = document.createElement("div");
  bar.id = "pres-bar";
  bar.innerHTML = `
    <span class="pres-plan" id="pres-plan" hidden role="group" aria-label="Kjøreplan">
      <button type="button" class="pres-knapp" id="pres-forrige" title="Forrige stopp (PageUp / ←)" aria-label="Forrige stopp">‹</button>
      <button type="button" class="pres-knapp pres-teller-knapp" id="pres-teller" title="Til stoppet (T)">…</button>
      <button type="button" class="pres-knapp" id="pres-neste" title="Neste stopp (PageDown / →)" aria-label="Neste stopp">›</button>
      <button type="button" class="pres-knapp pres-leggtil" id="pres-leggtil" hidden aria-label="Legg til i kjøreplanen her">${IKON.pluss}</button>
    </span>
    <span class="pres-nivaa" role="group" aria-label="Detaljnivå">
      ${[1, 2, 3].map((n) => `<button type="button" class="pres-knapp" data-nivaa="${n}" title="${NIVAA_NAVN[n]} (tast ${n})">${n}</button>`).join("")}
    </span>
    <button type="button" class="pres-knapp" id="pres-skala" title="Større tekst (A)">A</button>
    <button type="button" class="pres-knapp" id="pres-full" title="Fullskjerm (F)">${IKON.full}</button>
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
    if (e.target.closest("#pres-leggtil")) return leggTilHer();
    if (e.target.closest("#pres-skala")) return vekslSkala();
    if (e.target.closest("#pres-full")) return vekslFullskjerm();
    if (e.target.closest("#pres-tannhjul")) return vekslPanel();
    if (e.target.closest("#pres-avslutt")) return avsluttPresentasjon();
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
    knapp.title = `${["Normal tekst", "Stor tekst", "Størst tekst"][trinn]} (A)`;
  }
}

function vekslSkala() {
  const trinn = (Number(les(LAGRING.stor)) + 1) % 3;
  skriv(LAGRING.stor, String(trinn));
  brukSkala(trinn);
}

// Fullskjermen visningen selv slo på (auto eller F). Videospilleren har sin
// egen (yt-spiller.js), og dens utgang skal ikke leses som lærerens valg.
let presFullskjerm = false;

function slaaPaaFullskjerm() {
  const rot = document.documentElement;
  if (document.fullscreenElement || !rot.requestFullscreen) return;
  rot.requestFullscreen().then(() => { presFullskjerm = true; }).catch(() => {});
}

function vekslFullskjerm() {
  if (document.fullscreenElement) {
    skriv(LAGRING.fullNei, "1");
    document.exitFullscreen?.();
  } else {
    skriv(LAGRING.fullNei, "");
    slaaPaaFullskjerm();
  }
}

// Ingenting øverst til venstre under visning (brukerkrav 2026-09-25). Selve
// lerretet er hvitt; det som står der, er nettleserens fane og vinduslinje
// med sidetittel og ikon. Derfor:
//  - tittelen blankes med U+2800, et blankt tegn nettleserne ikke trimmer
//    bort (tom tittel ville vist adressen), og ikonet byttes mot et tomt.
//    Visningen avsluttes med full sidelast, så originalene trengs ikke.
//  - fullskjerm ved første tastetrykk eller klikk, som tar bort fanene og
//    vinduslinja helt. Nettleserne tillater fullskjerm bare som svar på en
//    handling, ikke ved sidelasting, og et sidebytte (slektstreet) går alltid
//    ut av den, så dette gjentas på hver side. Går læreren selv ut (Esc,
//    F eller knappen), respekteres det resten av visningen.
const TOMT_IKON = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22/%3E";

function blankFaneOgVindu() {
  document.title = "\u2800";
  const ikoner = document.querySelectorAll('link[rel~="icon"]');
  if (!ikoner.length) {
    const l = document.createElement("link");
    l.rel = "icon";
    document.head.appendChild(l);
  }
  document.querySelectorAll('link[rel~="icon"]').forEach((l) => { l.type = "image/svg+xml"; l.href = TOMT_IKON; });
}

function fullskjermVedForsteHandling() {
  if (!document.documentElement.requestFullscreen) return;
  const forsok = (e) => {
    // Esc gir ikke nettleseren lov til å gå i fullskjerm; vent på neste.
    if (e.type === "keydown" && (e.key === "Escape" || e.repeat)) return;
    document.removeEventListener("keydown", forsok, true);
    document.removeEventListener("pointerdown", forsok, true);
    if (!les(LAGRING.fullNei)) slaaPaaFullskjerm();
  };
  document.addEventListener("keydown", forsok, true);
  document.addEventListener("pointerdown", forsok, true);
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement || !presFullskjerm) return;
    // Ute av visningens egen fullskjerm uten at F eller knappen ble brukt:
    // læreren trykket Esc. Det er et valg, og det står.
    presFullskjerm = false;
    skriv(LAGRING.fullNei, "1");
  });
}

// Avslutt-knappen i verktøylinja og «Avslutt visning» i Visning-vinduet.
export function avsluttPresentasjon() {
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
  const harPunkter = !!topOpenModal()?.querySelector('[data-sekt="punkter"]');
  const flateNavn = { artist: "artistkortet", sjanger: "sjangerkortet", tech: "innovasjonskortet", "tiår": "tiårsvisningen", historie: "historien" };

  panel.innerHTML = `
    ${seksjoner ? `
      <p class="pres-panel-hode">Seksjoner på ${flateNavn[flate]}</p>
      ${seksjoner.map(({ id, navn }) => `
        <label class="pres-valg"><input type="checkbox" data-sekt-valg="${id}"
          ${erSynlig(flate, id, nivaa, unntak, { harPunkter }) ? "checked" : ""}> ${escapeHtml(navn)}</label>`).join("")}
      <button type="button" class="btn ghost small" id="pres-nullstill">Nullstill unntak</button>
      <hr class="pres-skille">`
    : `<p class="pres-panel-hode">Åpne et kort for å velge seksjoner.</p>`}
    <label class="pres-valg pres-qa"><input type="checkbox" id="pres-qa" ${qaPaa() ? "checked" : ""}>
      Vis innhold som er skjult for studentene (sjangerhistorier, koblingstekster, «Hør etter», viktighetsgrad, alle hubkort)</label>
    <p class="pres-panel-tips">Trykk <kbd>?</kbd> for hurtigtastene.</p>`;

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
  // Rot-skalaen (v5.36): i presentasjon følger tekststørrelsen skjermbredden,
  // så kortene over hele lerretet ikke står med bitteliten tekst (CSS).
  document.documentElement.classList.add("pres-modus");

  nivaa = Math.min(3, Math.max(1, Number(les(LAGRING.nivaa)) || 2));
  try { unntak = JSON.parse(les(LAGRING.unntak) || "{}") || {}; } catch (e) { unntak = {}; }
  // «1» er den gamle på/av-verdien fra v5.24 og leses som trinn 1.
  const skalaTrinn = Math.min(2, Math.max(0, Number(les(LAGRING.stor)) || 0));

  // Kjøreplanen (fase 4): id og posisjon fra sessionStorage — erPresentasjon
  // har alt skrevet URL-parametrene dit, og et sidebytte bærer dem videre.
  planId = les(LAGRING.plan) || null;
  stoppIdx = Math.max(0, Number(les(LAGRING.stopp)) || 0);
  hoppOverSlektstre = erTilbakeNavigering();
  // Tilbake fra nettleserens hurtigbuffer (bfcache): stoppet i minnet er det
  // sida ble forlatt på, men læreren kan ha bladd videre på slektstresiden.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted || !planId) return;
    // Bare når sessionStorage gjelder SAMME plan: etter fri visning eller en
    // annen plan i mellomtiden er det sidas egen plan og posisjon som gjelder,
    // og de skrives tilbake.
    if (les(LAGRING.plan) !== planId) {
      skriv(LAGRING.aktiv, "1");
      skriv(LAGRING.plan, planId);
      lagrePosisjon();
      return;
    }
    stoppIdx = Math.max(0, Number(les(LAGRING.stopp)) || 0);
    hoppOverSlektstre = true;
    if (plan) gaTilStopp(stoppIdx);
  });

  byggBar();
  brukSkala(skalaTrinn);   // etter byggBar: knappen skal vise trinnet
  blankFaneOgVindu();
  fullskjermVedForsteHandling();
  if (planId) {
    const planUi = document.getElementById("pres-plan");
    if (planUi) planUi.hidden = false;
    // «Legg til her»: knappen følger lærerøkta og det øverste kortet. Kort
    // åpnes, lukkes, heves (z-index) og bytter mål (data-vis) uten noen
    // felles hendelse, så en vakt på backdropenes attributter gjør jobben.
    onAuthChange((user) => { erLaerer = erLaererBruker(user); oppdaterLeggTil(); });
    if ("MutationObserver" in window) {
      new MutationObserver((endringer) => {
        if (endringer.some((m) => m.target.classList?.contains("modal-backdrop"))) oppdaterLeggTil();
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "style", "data-vis"] });
    }
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

  // Hurtigtastene (v5.38): nivå, blaing, svart skjerm, oversikten over
  // tastene og resten. Aldri i skrivefelt, unntatt klikkernes PageUp/Down.
  wireTaster();
}
