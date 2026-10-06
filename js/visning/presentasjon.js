// ============================================================================
//  PRESENTASJONSVISNING — browser-delen (v5.24)
// ----------------------------------------------------------------------------
//  Appen som tavle i timen (fase 3 i «git ignore/notater/PRESENTASJON-PLAN.md»):
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
//  ligger i js/visning/presentasjon-modell.js, låst av en test), og denne modulen
//  setter hidden på dem etter nivå + unntak. MutationObserver per modal gjør
//  at hver omtegning (chip-bytte, snapshot) får nivået på nytt — childList-
//  filteret gjør at våre egne hidden-attributter ikke trigger observatøren.
//
//  Ingen av delene her kjører når modusen er av: initPresentasjon returnerer
//  tidlig, og da er data-sekt-attributtene inerte.
// ============================================================================

import { SKJUL_I_HUBEN, settSynlighetOverstyrt } from "../felles/feature-flags.js";
import { FLATER, NIVAA_NAVN, erSynlig, faktaSynlig, normaliserPlaner, planPosisjon, tellerTekst, planOversikt, innsettingsIndeks, medStoppSattInn, presTast, PRES_TASTER, ytWatchUrl, erHistorikkSide, historikkBesok, historikkSteg, normaliserHistorikk, TOM_HISTORIKK, timeStopp, nyPlanId } from "./presentasjon-modell.js";
import { erSkrivefelt, parseVisVerdi } from "../felles/vis-lenke.js";
import { modalOpen, modalClose, setupModal, initModalHeaders, topOpenModal, askChoice, melding, sporTekst } from "../ui/ui-modal.js";
import { GENEALOGY } from "../sjangre/genre-model.js";
import { ordneArtistLerret, flyttLevetid, ryddArtistLerret } from "./pres-artist.js";
import { ordneSjangerLerret } from "./pres-sjanger.js";
import { veksleYtAvspilling, apneYtSpiller } from "../ui/yt-spiller.js";
import { escapeHtml, safeUrl, wikimediaThumb } from "../felles/util.js";
import { apneVisNaarKlart, setVisMaalFeilProvider } from "../utforsk/explore-apne.js";
import { getState } from "../data/app-state.js";
import { onAuthChange, addTimeforslag, deleteTimeforslag, savePlan } from "../data/store.js";
import { erLaererBruker, settInnStopp, oppdaterStopp } from "./plan-meny.js";
import { stoppEtikett } from "./stopp-etikett.js";

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
  // Klokka i verktøylinja (v5.75), av som standard; valget i tannhjulet.
  klokke: "pensumPresKlokke",
  // Menyen nede til høyre skjult med M (v5.93); følger visningen videre.
  menySkjult: "pensumPresMenySkjult",
  // Sidene som er vist, for ← og → (v5.95); følger visningen over sidebytter.
  historikk: "pensumPresHistorikk",
  // Alt som ble vist i økta, i rekkefølge og UTEN tak (v6.10, U1): grunnlaget
  // for «Lagre som time». Sidehistorikken over er kappet (HISTORIKK_MAKS).
  timelogg: "pensumPresTime",
};

// «Sist spilt» per plan (v5.75, localStorage pensum-plan-spilt) er fjernet
// igjen i v5.78: datoene i Visning-lista ble bare rot (brukervalg 2026-09-28).
// Nøkkelen ryddes bort der den måtte ligge igjen.
try { localStorage.removeItem("pensum-plan-spilt"); } catch (e) {}

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
// «spilles nå»-merket i Visning-vinduet (js/visning/visning.js).
export function aktivPlanId() {
  return erPresentasjon() ? les(LAGRING.plan) || null : null;
}

let nivaa = 2;
let unntak = {};

function lagreTilstand() {
  skriv(LAGRING.nivaa, String(nivaa));
  skriv(LAGRING.unntak, JSON.stringify(unntak));
}

// ----------------------------------------------------------------------------
//  Detaljnivået
// ----------------------------------------------------------------------------

function brukNivaaPaa(flate, modal) {
  // Artistkortets spalter (v5.40, js/visning/pres-artist.js) bygges FØR nivået
  // settes: skillelinja må finnes når synligheten dens regnes ut under.
  if (flate === "artist") ordneArtistLerret(modal);
  // Sjangerkortets spalter (v5.89, js/visning/pres-sjanger.js): navnelista med
  // artistene til høyre for punktene.
  if (flate === "sjanger") ordneSjangerLerret(modal);
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

// QA-bryteren huskes i localStorage (v6.10, U5): den gjaldt bare én fane, og
// læreren måtte huke den av på nytt i hver ny fane og hver ny økt.
function qaPaa() { try { return localStorage.getItem(LAGRING.qa) === "1"; } catch (e) { return false; } }

function settQA(vis) {
  // Fra v6.10 (U4) står lærerens egne verdier i databasen; av-stillingen går
  // tilbake til dem, ikke til verdiene fra sidelasten.
  settSynlighetOverstyrt(vis);
  try { localStorage.setItem(LAGRING.qa, vis ? "1" : ""); } catch (e) { /* privat modus */ }
  oppdaterHubKort();
}

// Hub-kortene ligger i DOM-en i presentasjonsmodus (explore.js fjerner dem
// ellers) og styres med hidden, så bryteren virker uten sidelast.
function oppdaterHubKort() {
  const sb = document.getElementById("modal-store-bildet");
  if (!sb) return;
  sb.querySelectorAll(".dash-card").forEach((kort) => {
    if (!(kort.id in SKJUL_I_HUBEN)) return;
    // Visning-kortet (v5.96) er lærerens: på lerretet vises det i lærerøkt,
    // ellers bare med QA-bryteren, som de andre skjulte kortene.
    const laererKort = kort.id === "sb-visning" && erLaerer;
    kort.hidden = !!SKJUL_I_HUBEN[kort.id] && !laererKort;
  });
}

// Den innebygde YouTube-spilleren bor i js/ui/yt-spiller.js fra v5.28 — delt
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
  oppdaterNeste();
}

// «neste: …» ved telleren (v5.75): læreren skal vite hva som kommer uten å
// huske planen. Navnet slås opp med samme etikett som editoren bruker;
// etter siste stopp står oppsummeringskortet, og på det står ingenting.
function oppdaterNeste() {
  const el = document.getElementById("pres-neste");
  if (!el) return;
  if (!plan || !plan.stopp.length) { el.hidden = true; return; }
  const p = planPosisjon(stoppIdx, plan.stopp.length);
  let tekst = "";
  if (p.oversikt === "start") tekst = stoppEtikett(plan.stopp[0]).navn;
  else if (p.oversikt === "slutt") tekst = "";
  else if (p.stopp + 1 < plan.stopp.length) tekst = stoppEtikett(plan.stopp[p.stopp + 1]).navn;
  else tekst = "Oppsummering";
  el.hidden = !tekst;
  el.textContent = tekst ? `neste: ${tekst}` : "";
  el.title = tekst ? `Neste stopp: ${tekst}` : "";
}

// Forhåndslaster bildet til posisjon `i` (artist- og innovasjonskort), så
// lerretet ikke står uten bilde i sekundene etter et stoppbytte på tregt
// nett (v5.75, audit v5.42 forslag 12). Samme miniatyrbredde som kortet ber
// om (artistImage stor: 800, innovasjonskort på lerretet: 960), ellers
// treffer ikke nettleserens hurtigbuffer.
function forhaandslast(i) {
  if (!plan || !plan.stopp.length) return;
  const p = planPosisjon(i, plan.stopp.length);
  if (p.oversikt) return;
  const m = parseVisVerdi(plan.stopp[p.stopp]?.vis);
  if (!m) return;
  const s = getState();
  let url = null, bredde = 800;
  if (m.hva === "artist") url = (s.artists || []).find((x) => x.id === m.id)?.imageUrl;
  else if (m.hva === "tech") { url = (s.techItems || []).find((x) => x.id === m.id)?.imageUrl; bredde = 960; }
  const ren = safeUrl(url);
  if (!ren) return;
  const img = new Image();
  img.decoding = "async";
  img.src = wikimediaThumb(ren, bredde) || ren;
}

// Gå til en posisjon: lukk det som står åpent, sett stoppets nivå og unntak,
// og åpne målet når dataene dets er klare (eller oversiktskortet, først og
// sist). Kalles også som «Til stoppet» etter en avstikker (samme posisjon).
function gaTilStopp(i) {
  if (!plan || !plan.stopp.length) return;
  const p = planPosisjon(i, plan.stopp.length);

  // Lukk alt først (lyd stoppes, et kort som nekter, avbryter byttet).
  if (!lukkAlleKort()) return;

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
  forhaandslast(stoppIdx + 1);
}

// Lukker alt som står åpent før et bytte (stopp eller side i historikken).
// false når et kort nekter å lukkes: da avbrytes byttet.
function lukkAlleKort() {
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
    if (top.classList.contains("open")) return false;
  }
  return true;
}

// ----------------------------------------------------------------------------
//  Sidehistorikken (v5.95, brukerønske 2026-10-01): ← og → går til forrige
//  og neste side som er vist, i fri visning og i en kjøreplan. Logikken er
//  historikkBesok/historikkSteg i modellen (testet). Her registreres sidene
//  (målet til kortet øverst, når det endres) og målene åpnes. Slektstreet er
//  en egen side uten kort, så tre.html melder seg selv ved oppstart.
// ----------------------------------------------------------------------------

let historikk = TOM_HISTORIKK;
// Målet ← eller → er på vei til: mens det åpnes, er ikke mellomtilstandene
// (alt lukket) nye besøk. Ryddes når målet står øverst, eller etter en stund
// (et mål som ikke finnes lenger, åpnes aldri).
let ventMaal = null;
let ventTimer = null;

function lagreHistorikk() { skriv(LAGRING.historikk, JSON.stringify(historikk)); }

// Timeloggen (v6.10, U1): hvert mål som vises, også lytteeksemplene, i den
// rekkefølgen det ble vist. Samme mål to ganger på rad teller én gang.
// Siste mål i loggen, så de mange attributt-endringene på samme kort ikke
// leser og tolker hele loggen hver gang (v6.23, Fable).
let sistLogget = null;
function loggTime(vis) {
  if (typeof vis !== "string" || !vis || vis === sistLogget) return;
  let logg = [];
  try { logg = JSON.parse(les(LAGRING.timelogg) || "[]"); } catch (e) { logg = []; }
  if (!Array.isArray(logg)) logg = [];
  sistLogget = vis;
  if (logg[logg.length - 1] === vis) return;
  logg.push(vis);
  skriv(LAGRING.timelogg, JSON.stringify(logg));
}

function registrerSide(vis = toppMaal()) {
  loggTime(vis);
  if (!erHistorikkSide(vis)) return;
  if (ventMaal) {
    if (vis === ventMaal) { ventMaal = null; return; }
    ventMaal = null;
  }
  const ny = historikkBesok(historikk, vis);
  if (ny === historikk) return;
  historikk = ny;
  lagreHistorikk();
}

function gaISideHistorikk(retning) {
  const steg = historikkSteg(historikk, retning);
  if (!steg || !lukkAlleKort()) return;
  historikk = steg.h;
  lagreHistorikk();
  ventMaal = steg.vis;
  clearTimeout(ventTimer);
  ventTimer = setTimeout(() => { ventMaal = null; }, 4000);
  apneVisNaarKlart(parseVisVerdi(steg.vis));
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
    melding(`Fikk ikke lagt til stoppet (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`);
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
      <div class="pres-ov-verktoy" id="pres-ov-verktoy"></div>
      <div class="pres-ov-grid" id="pres-ov-grid"></div>
    </div>`;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();   // idempotent: ← og ✕ som på alle de andre kortene
  m.addEventListener("click", (e) => {
    if (e.target.closest("#pres-ov-spill")) return spillAlleLytteeksempler();
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
  // «Spill alle lytteeksemplene» (v5.75) når planen har minst to.
  const ider = lytteeksemplerIPlanen();
  const verktoy = m.querySelector("#pres-ov-verktoy");
  if (verktoy) {
    verktoy.innerHTML = ider.length >= 2
      ? `<button type="button" class="btn ghost small" id="pres-ov-spill" title="Spiller alle lytteeksemplene i planen etter hverandre">Spill alle ${ider.length} lytteeksemplene</button>`
      : "";
  }
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
      case "timeliste": return vekslTimeliste();
      case "meny": return settMenySkjult(!document.body.classList.contains("pres-meny-skjult"));
      case "sideTilbake": return gaISideHistorikk(-1);
      case "sideFram": return gaISideHistorikk(1);
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
    if (!["b", "B", ".", "Escape", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "PageDown", "PageUp", " "].includes(e.key)) return;
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
//  Navn fra timen (v5.82, brukerbestilling 2026-09-28)
// ----------------------------------------------------------------------------
//  Når læreren improviserer med studentene, kommer det opp artister som ikke
//  er i pensumet. Tasten L åpner et lite panel: artistens navn og fornavnet
//  på den som foreslo, Enter lagrer og gjør klart for neste. Postene går til
//  samlingen timeforslag (bare læreren leser den) og står på Skrivebordet på
//  lærersiden til oppfølging. Hvor i visningen det skjedde (kjøreplan, stopp
//  eller åpent kort) noteres av seg selv når panelet åpnes.
// ----------------------------------------------------------------------------

let timeKontekstNaa = "";
const timeLagt = [];   // denne øktas poster, nyeste først

function timeKontekst() {
  const deler = [];
  if (plan) {
    const p = planPosisjon(stoppIdx, plan.stopp.length);
    deler.push(plan.tittel);
    const stopp = p.oversikt ? null : plan.stopp[p.stopp];
    if (stopp) deler.push(`stopp ${p.stopp + 1}: ${stoppEtikett(stopp).navn}`);
  }
  const topp = topOpenModal();
  const tittel = topp && topp.id !== "modal-timeliste" ? (topp.querySelector(".modal-head h2")?.textContent || "").trim() : "";
  if (tittel && !deler.some((d) => d.includes(tittel))) deler.push(tittel);
  return deler.join(" · ").slice(0, 200);
}

function byggTimeliste() {
  const m = document.createElement("div");
  m.className = "modal-backdrop";
  m.id = "modal-timeliste";
  m.innerHTML = `
    <div class="modal modal-hjelp modal-timeliste">
      <div class="modal-head">
        <h2>Navn fra timen</h2>
        <button type="button" class="modal-close btn ghost small">✕</button>
      </div>
      <p class="muted timeliste-kontekst" id="timeliste-kontekst"></p>
      <form id="timeliste-skjema" class="timeliste-skjema" autocomplete="off">
        <label>Artist <input type="text" id="timeliste-artist" maxlength="120" placeholder="Navn på artisten" required></label>
        <label>Foreslått av <input type="text" id="timeliste-student" maxlength="60" placeholder="Fornavn (valgfritt)"></label>
        <button type="submit" class="btn primary small">Legg til</button>
      </form>
      <p class="muted timeliste-hint">Enter lagrer og gjør klart for neste. Lista står på Skrivebordet på lærersiden.</p>
      <ul class="timeliste-liste" id="timeliste-liste"></ul>
    </div>`;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  m.querySelector("#timeliste-skjema").addEventListener("submit", (e) => {
    e.preventDefault();
    const artistFelt = m.querySelector("#timeliste-artist");
    const studentFelt = m.querySelector("#timeliste-student");
    const artist = artistFelt.value.trim();
    if (!artist) { artistFelt.focus(); return; }
    const post = { artist, student: studentFelt.value.trim(), kontekst: timeKontekstNaa, id: null, status: "lagrer", feil: "" };
    timeLagt.unshift(post);
    artistFelt.value = "";
    studentFelt.value = "";
    artistFelt.focus();
    tegnTimeliste();
    addTimeforslag(post)
      .then((ref) => { post.id = ref.id; post.status = "ok"; tegnTimeliste(); })
      .catch((err) => { post.status = "feil"; post.feil = err?.message || String(err); tegnTimeliste(); });
  });
  m.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-time-angre]");
    if (!b) return;
    const post = timeLagt[Number(b.dataset.timeAngre)];
    if (!post?.id) return;
    b.disabled = true;
    try {
      await deleteTimeforslag(post.id);
      timeLagt.splice(timeLagt.indexOf(post), 1);
    } catch (err) {
      b.disabled = false;
      post.feil = `angre feilet: ${err?.message || err}`;
    }
    tegnTimeliste();
  });
  return m;
}

function tegnTimeliste() {
  const el = document.getElementById("timeliste-liste");
  if (!el) return;
  el.innerHTML = timeLagt.length
    ? timeLagt.map((p, i) => `<li class="timeliste-rad${p.status === "feil" ? " timeliste-feil" : ""}">
        <span><strong>${escapeHtml(p.artist)}</strong>${p.student ? ` <span class="muted">· ${escapeHtml(p.student)}</span>` : ""}${
          p.status === "lagrer" ? ` <span class="muted">· lagrer …</span>`
          : p.status === "feil" ? ` <span>· ikke lagret${p.feil ? ` (${escapeHtml(p.feil)})` : ""}</span>` : ""}</span>
        ${p.id ? `<button type="button" class="btn ghost small" data-time-angre="${i}">Angre</button>` : ""}
      </li>`).join("")
    : `<li class="muted timeliste-tom">Ingenting notert ennå i denne økta.</li>`;
}

// Tasten L: åpne (eller lukke) panelet. Bare for læreren; ellers ingenting.
function vekslTimeliste() {
  if (!erLaerer) return;
  let m = document.getElementById("modal-timeliste");
  if (m?.classList.contains("open")) { modalClose(m); return; }
  timeKontekstNaa = timeKontekst();
  if (!m) m = byggTimeliste();
  const k = m.querySelector("#timeliste-kontekst");
  if (k) k.textContent = timeKontekstNaa ? `Under: ${timeKontekstNaa}` : "";
  tegnTimeliste();
  modalOpen(m);
  m.querySelector("#timeliste-artist")?.focus();
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
      <button type="button" class="pres-knapp" id="pres-forrige" title="Forrige stopp (PageUp / ↓)" aria-label="Forrige stopp">‹</button>
      <button type="button" class="pres-knapp pres-teller-knapp" id="pres-teller" title="Til stoppet (T)">…</button>
      <button type="button" class="pres-knapp" id="pres-neste" title="Neste stopp (PageDown / ↑)" aria-label="Neste stopp">›</button>
      <button type="button" class="pres-knapp pres-leggtil" id="pres-leggtil" hidden aria-label="Legg til i kjøreplanen her">${IKON.pluss}</button>
      <span class="pres-neste" id="pres-neste" hidden></span>
    </span>
    <span class="pres-nivaa" role="group" aria-label="Detaljnivå">
      ${[1, 2, 3].map((n) => `<button type="button" class="pres-knapp" data-nivaa="${n}" title="${NIVAA_NAVN[n]} (tast ${n})">${n}</button>`).join("")}
    </span>
    <button type="button" class="pres-knapp" id="pres-skala" title="Større tekst (A)">A</button>
    <button type="button" class="pres-knapp" id="pres-full" title="Fullskjerm (F)">${IKON.full}</button>
    <button type="button" class="pres-knapp" id="pres-tannhjul" title="Innstillinger" aria-label="Innstillinger">${IKON.tannhjul}</button>
    <span class="pres-klokke" id="pres-klokke" hidden aria-label="Klokka"></span>
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

// Menyen nede til høyre (v5.93, brukerønske 2026-09-29): M skjuler og viser
// den, for et renere lerret. Bare synligheten endres; tastene lyttes på
// dokumentet og virker som før. Valget huskes resten av visningen, også over
// sidebytter, som nivået og tekststørrelsen.
function settMenySkjult(skjult) {
  document.body.classList.toggle("pres-meny-skjult", !!skjult);
  skriv(LAGRING.menySkjult, skjult ? "1" : "");
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
// I en lærerøkt med noe vist tilbys «Lagre som time» først (v6.10, U1): det
// som ble vist, i rekkefølge og uten tak på antallet, lagres som en plan med
// dagens dato. Den deles med studentene først når læreren slår det på i
// Visning-vinduet («Del med studentene»).
export async function avsluttPresentasjon() {
  let logg = [];
  try { logg = JSON.parse(les(LAGRING.timelogg) || "[]"); } catch (e) { logg = []; }
  const stopp = timeStopp(logg);
  // «Lagre som time» tilbys også etter en kjøreplan (v6.24, brukervalg
  // 2026-10-04, etter Fable-gjennomgangen). Timen blir en EGEN plan med dagens
  // dato og det som faktisk ble vist, også avstikkerne utenom planen, og
  // kjøreplanen står urørt til neste gang. Før ble læreren bare spurt i fri
  // visning, og en delt kjøreplan sto uten dato og uten avstikkerne.
  const pid = aktivPlanId();
  const kjoreplan = pid
    ? (plan || normaliserPlaner(getState().content?.presentasjoner?.planer)[pid] || null)
    : null;
  if (erLaerer && stopp.length) {
    const valg = await askChoice({
      title: "Lagre det du viste som en time?",
      text: kjoreplan
        ? `${stopp.length} kort ble vist (lytteeksemplene regnet med), også det du åpnet utenom kjøreplanen. Timen lagres for seg med dagens dato, og kjøreplanen «${kjoreplan.tittel}» endres ikke. En time kan deles med studentene under «Fra timene» (Visning-vinduet).`
        : `${stopp.length} kort ble vist (lytteeksemplene regnet med). En time kan deles med studentene under «Fra timene» (Visning-vinduet).`,
      buttons: [
        { label: "Lagre som time", value: "lagre", className: "primary" },
        { label: "Avslutt uten å lagre", value: "nei" },
        { label: "Fortsett visningen", value: "fortsett" },
      ],
      dismissValue: "fortsett",
    });
    if (valg === "fortsett") return;
    if (valg === "lagre") {
      const idag = new Date();
      const dato = `${idag.getFullYear()}-${String(idag.getMonth() + 1).padStart(2, "0")}-${String(idag.getDate()).padStart(2, "0")}`;
      // Etter en kjøreplan foreslås planens tittel; datoen står ved timen.
      const forslag = kjoreplan && kjoreplan.tittel !== "(uten tittel)"
        ? kjoreplan.tittel
        : `Time ${idag.toLocaleDateString("nb-NO", { day: "numeric", month: "long" })}`;
      // Avbryt i tittelspørsmålet lagrer ingenting, og visningen står åpen
      // (som ved lagringsfeil), så læreren kan velge på nytt (v6.23, Fable F9).
      const svar = await sporTekst("Datoen lagres ved siden av tittelen.", forslag, { tittel: "Tittel på timen", ok: "Lagre timen" });
      if (svar === null) return;
      const tittel = svar.trim() || forslag;
      try {
        await savePlan(nyPlanId(), { tittel, laget: idag.toISOString(), dato, stopp });
      } catch (err) {
        melding(`Fikk ikke lagret timen (${err?.message || err}). Visningen står åpen, så du kan prøve igjen.`);
        return;
      }
    }
  }
  for (const k of Object.values(LAGRING)) { try { sessionStorage.removeItem(k); } catch (e) {} }
  sistLogget = null;
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
    <label class="pres-valg"><input type="checkbox" id="pres-klokke-valg" ${klokkePaa() ? "checked" : ""}> Vis klokka i verktøylinja</label>
    ${kanHuske() ? `<hr class="pres-skille">
      <button type="button" class="btn ghost small" id="pres-husk" title="Lagrer nivået og unntakene som vises nå, på dette stoppet i kjøreplanen">Husk visningen på dette stoppet</button>
      <p class="pres-panel-tips">Nivået og unntakene slik de står nå, lagres på stoppet, så de gjelder neste gang planen spilles.</p>` : ""}
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
  panel.querySelector("#pres-klokke-valg")?.addEventListener("change", (e) => {
    settKlokke(e.target.checked);
  });
  panel.querySelector("#pres-husk")?.addEventListener("click", huskVisning);
}

// ----------------------------------------------------------------------------
//  Klokka (v5.75): bare tid, ingen nedtelling. Fast i verktøylinja, av som
//  standard.
// ----------------------------------------------------------------------------

let klokkeTimer = null;

function klokkePaa() { return les(LAGRING.klokke) === "1"; }

function tegnKlokke() {
  const el = document.getElementById("pres-klokke");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

function settKlokke(paa) {
  skriv(LAGRING.klokke, paa ? "1" : "");
  const el = document.getElementById("pres-klokke");
  if (el) el.hidden = !paa;
  clearInterval(klokkeTimer);
  klokkeTimer = null;
  if (!paa) return;
  tegnKlokke();
  klokkeTimer = setInterval(tegnKlokke, 15000);
}

// ----------------------------------------------------------------------------
//  «Husk visningen på dette stoppet» (v5.75, audit v5.42 funn 29 og forslag
//  5): nivået og unntakene som vises nå, skrives inn i planens stopp, så
//  læreren slipper å gjenta avhukingene foran klassen hver gang. Bare i
//  lærerøkter og bare på et ekte stopp (ikke oversiktskortene).
// ----------------------------------------------------------------------------

function kanHuske() {
  if (!erLaerer || !plan || !plan.stopp.length) return false;
  return !planPosisjon(stoppIdx, plan.stopp.length).oversikt;
}

async function huskVisning() {
  if (!kanHuske()) return;
  const p = planPosisjon(stoppIdx, plan.stopp.length);
  const knapp = document.getElementById("pres-husk");
  if (knapp) { knapp.disabled = true; knapp.textContent = "Lagrer …"; }
  try {
    plan = await oppdaterStopp(planId, p.stopp, { nivaa, unntak: { ...unntak } });
    if (knapp) knapp.textContent = "Husket";
  } catch (e) {
    if (knapp) knapp.textContent = "Husk visningen på dette stoppet";
    melding(`Fikk ikke lagret visningen (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`);
  } finally {
    setTimeout(() => {
      if (knapp) { knapp.disabled = false; knapp.textContent = "Husk visningen på dette stoppet"; }
    }, 1500);
  }
}

// ----------------------------------------------------------------------------
//  Varsel på lerretet (v5.75): et stopp som ikke kan åpnes (slettet kort,
//  omdøpt sjanger) sto før som et tomt lerret med bare en konsollmelding.
// ----------------------------------------------------------------------------

let varselTimer = null;

function visVarsel(tekst) {
  let el = document.getElementById("pres-varsel");
  if (!el) {
    el = document.createElement("div");
    el.id = "pres-varsel";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = tekst;
  el.hidden = false;
  clearTimeout(varselTimer);
  varselTimer = setTimeout(() => { el.hidden = true; }, 7000);
}

// ----------------------------------------------------------------------------
//  «Spill alle lytteeksemplene» på oversiktskortet (v5.75): planens yt-stopp
//  som én kø i den innebygde spilleren, i planens rekkefølge, i kinovisning.
// ----------------------------------------------------------------------------

function lytteeksemplerIPlanen() {
  const ider = [];
  for (const s of plan?.stopp || []) {
    const m = parseVisVerdi(s.vis);
    if (m?.hva === "yt" && m.id && !ider.includes(m.id)) ider.push(m.id);
  }
  return ider;
}

function spillAlleLytteeksempler() {
  const ider = lytteeksemplerIPlanen();
  if (!ider.length) return;
  apneYtSpiller(ytWatchUrl(ider[0], null, null), `Alle lytteeksemplene i «${plan.tittel}»`, { kø: ider.slice(1) });
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
  settKlokke(klokkePaa());
  settMenySkjult(les(LAGRING.menySkjult) === "1");
  blankFaneOgVindu();
  fullskjermVedForsteHandling();
  // Et stopp som ikke finnes lenger, sies fra om på lerretet (v5.75).
  setVisMaalFeilProvider((maal) => {
    const etikett = stoppEtikett({ vis: [maal.hva, maal.id, maal.modus, maal.ekstra].filter((x) => x != null && x !== "").join(":") });
    visVarsel(`${etikett.tekst} finnes ikke lenger. Trykk → for neste stopp.`);
  });
  // Lærerøkta følger innloggingen også i fri visning (v5.82): «Navn fra
  // timen» (L) er bare for læreren. «Legg til her» bruker samme flagg.
  onAuthChange((user) => { erLaerer = erLaererBruker(user); oppdaterLeggTil(); oppdaterHubKort(); });
  if (planId) {
    const planUi = document.getElementById("pres-plan");
    if (planUi) planUi.hidden = false;
    // «Legg til her»: knappen følger lærerøkta og det øverste kortet. Kort
    // åpnes, lukkes, heves (z-index) og bytter mål (data-vis) uten noen
    // felles hendelse, så en vakt på backdropenes attributter gjør jobben.
    if ("MutationObserver" in window) {
      new MutationObserver((endringer) => {
        if (endringer.some((m) => m.target.classList?.contains("modal-backdrop"))) oppdaterLeggTil();
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "style", "data-vis"] });
    }
  }
  if (qaPaa()) settQA(true); else oppdaterHubKort();
  observerModaler();
  // Sidehistorikken (v5.95): fra sessionStorage, så den følger visningen over
  // sidebytter; tre.html melder slektstreet som side. Kortenes mål følges med
  // samme vakt som «Legg til her»: åpne, lukke, heve og bytte mål.
  try { historikk = normaliserHistorikk(JSON.parse(les(LAGRING.historikk) || "null")); } catch (e) { historikk = TOM_HISTORIKK; }
  if (/(^|\/)tre\.html$/.test(window.location.pathname)) registrerSide("slektstre");
  if ("MutationObserver" in window) {
    new MutationObserver((endringer) => {
      if (endringer.some((m) => m.target.classList?.contains("modal-backdrop"))) registrerSide();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "style", "data-vis"] });
  }
  brukNivaa();
  // Content kan alt ligge i state (lokal cache): prøv med en gang, ellers
  // tar sidenes content-hooks det når snapshotet lander.
  presPlanTikk();

  // Hurtigtastene (v5.38): nivå, blaing, svart skjerm, oversikten over
  // tastene og resten. Aldri i skrivefelt, unntatt klikkernes PageUp/Down.
  wireTaster();
}
