// ============================================================================
//  SAMLEØKT — to måter å bygge en kjøreplan mens man bruker appen (v5.27)
// ----------------------------------------------------------------------------
//  Brukerens bestilling: velg en kjøreplan (eller lag en ny) og deretter
//  modus.
//    «plukk»  — en plussknapp i kortenes tittellinje legger det du velger
//               til den aktive planen. For effektiv planlegging.
//    «opptak» — ALT du åpner som kan bli et stopp, logges i rekkefølge til
//               du trykker Ferdig (påfølgende duplikater hoppes over). For
//               timen: studentene kan spille av samme sekvens hjemme.
//
//  Økta startes fra Visning-vinduet (visning.js, bak presentasjonsikonet), bæres
//  av sessionStorage over alle sidene (samme mønster som presentasjons-
//  modusen), og vises som en linje nede til VENSTRE (presentasjonslinja bor
//  til høyre): plan, modus, stopptall, Angre siste og Ferdig.
//
//  Skriving (v5.43, audit v5.42 funn 1–3). Content-samlingen abonneres av
//  alle sider, så hver skriving koster én lesing per tilkoblet klient. Økta
//  skriver derfor IKKE for hvert kort: handlingene (legg til, erstatt, fjern)
//  ligger i sessionStorage og sendes ved «Ferdig», når fanen skjules
//  (sidebytte, lukking) og ellers høyst hvert andre minutt. Hver skriving er
//  den FERSKE planen i state med handlingene lagt oppå, stemplet med øktas
//  merke, så redigeringer og tillegg gjort andre steder står, og økta alltid
//  vet hva planen inneholder (se brukSamleOps i presentasjon-modell.js).
//  Skrivingen gis til Firestore med en gang, også uten nett: da ligger den i
//  Firestores varige kø og sendes når nettet er tilbake. Reglene krever
//  lærerkonto; økta kan uansett bare startes fra Visning-vinduet i en
//  lærerøkt.
// ============================================================================

import { savePlan, onAuthChange } from "./store.js?v=5.60";
import { getState } from "./explore-context.js?v=5.60";
import { normaliserPlaner, normaliserSamleOps, brukSamleOps, samleMerke, samleVentende, samleTast } from "./presentasjon-modell.js?v=5.60";
import { setModalApnetProvider, topOpenModal } from "./ui-modal.js?v=5.60";
import { escapeHtml } from "./util.js?v=5.60";
import { parseVisVerdi, erSkrivefelt } from "./vis-lenke.js?v=5.60";
import { registrerYtIntercept } from "./yt-spiller.js?v=5.60";
import { aktivPlanId } from "./presentasjon.js?v=5.60";
import { erLaererBruker } from "./plan-meny.js?v=5.60";

const LAGRING = {
  plan: "pensumSamlePlan",
  modus: "pensumSamleModus",
  tittel: "pensumSamleTittel",
  // { øktId, n, nye, sendt, planFantes } (v5.43)
  liste: "pensumSamleListe",
};
// Avsluttede økter med noe som ikke er kommet fram (Ferdig uten nett, før
// planene har landet, eller rett før et sidebytte): huskes her, også på
// neste side, til planen viser det. Står utenfor LAGRING, for
// avsluttInnsamling sletter alt der.
const USENDT = "pensumSamleUsendt";

// Lengste tid et tillegg venter før det sendes (se innledningen). Et opptak
// i en time med 50 studenter pålogget koster da høyst 30 skrivinger i
// timen × 50 lesinger, i stedet for én skriving per åpnet kort.
const SAMLE_LAGRE_MS = 120_000;

const les = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const skriv = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
const slett = (k) => { try { sessionStorage.removeItem(k); } catch (e) {} };

// Økta som pågår, eller null:
//   { planId, modus, tittel, øktId, n, nye, sendt, planFantes, … }
// `nye`: handlinger som ikke er sendt. `sendt`: [{ n, ops, live }], skrivinger
// som er gitt til Firestore uten kvittering (live: gitt på DENNE sida).
let økt = null;
// Avsluttede økter som fortsatt har noe som ikke er kommet fram (se USENDT).
let etterslep = [];

// Visning-vinduet vil vite når en økt starter eller slutter («samles nå»).
const endringsLyttere = [];
export function vedSamleEndring(fn) { endringsLyttere.push(fn); }
const meldEndring = () => endringsLyttere.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });

const PLUSS_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const HAKE_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function planerNaa() {
  return normaliserPlaner(getState().content?.presentasjoner?.planer);
}

const lastet = () => !!getState().contentLoaded;
const ferskPlan = (ø) => planerNaa()[ø.planId] || null;

// Skrivingene planen i state ikke viser (se samleVentende).
function ventende(ø, fersk = ferskPlan(ø)) {
  return samleVentende(ø.sendt, samleMerke(fersk, ø.øktId));
}

// Øktas syn på planen: planen i state med det den ikke viser ennå lagt oppå.
// null før planene har landet.
function planSomØktaSer(ø) {
  if (!lastet()) return null;
  const fersk = ferskPlan(ø);
  return brukSamleOps(fersk?.stopp || [], [...ventende(ø, fersk).flatMap((b) => b.ops), ...ø.nye]);
}

// Målet til siste stopp slik økta ser det. Før planene har landet: det
// øktas egne handlinger sist la til (nok til å hoppe over duplikater).
function sisteVis(ø) {
  const plan = planSomØktaSer(ø);
  if (plan) return plan[plan.length - 1]?.vis || null;
  const op = ø.nye[ø.nye.length - 1];
  return op?.t === "legg" ? op.vis : op?.t === "erstatt" ? op.til : null;
}

// Har økta noe som må sendes? Nye handlinger, eller skrivinger som ikke kom
// fram (avvist, eller tapt med forrige side). En skriving gitt fra DENNE sida
// ligger alt i Firestores kø, selv om planen ikke viser den ennå. Før planene
// har landet regnes alt fra forrige side som usikkert.
function harUsendt(ø) {
  if (ø.nye.length) return true;
  return lastet() ? ventende(ø).some((b) => !b.live) : ø.sendt.length > 0;
}

const nyØktId = () => "s" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 36).toString(36)).join("");

// ----------------------------------------------------------------------------
//  Lagring (v5.43)
// ----------------------------------------------------------------------------

const tilLager = (ø) => ({
  planId: ø.planId, tittel: ø.tittel, øktId: ø.øktId, n: ø.n, nye: ø.nye, egne: ø.egne || [],
  sendt: ø.sendt.map(({ n, ops }) => ({ n, ops })), planFantes: ø.planFantes, varslet: !!ø.varslet,
});

// Økta følger med over sidebytter i sessionStorage: handlingene går ikke tapt
// mellom forsiden og slektstresiden selv om skrivingen ikke rakk fram.
function lagreLokalt(ø) {
  if (!ø) return;
  if (ø === økt) skriv(LAGRING.liste, JSON.stringify(tilLager(ø)));
  else if (etterslep.includes(ø)) lagreEtterslep();
}

function lagreEtterslep() {
  if (etterslep.length) skriv(USENDT, JSON.stringify(etterslep.map(tilLager)));
  else slett(USENDT);
}

// Leser en lagret økt tilbake. Det som var sendt på forrige side, har ingen
// kvittering å vente på her (live: false); merket i planen avgjør om det
// kom fram.
function fraLager(j) {
  if (!j || typeof j.øktId !== "string" || !j.øktId) return null;
  const sendt = (Array.isArray(j.sendt) ? j.sendt : [])
    .filter((b) => b && Number.isInteger(b.n) && b.n > 0)
    .map((b) => ({ n: b.n, ops: normaliserSamleOps(b.ops), live: false }));
  return {
    øktId: j.øktId,
    n: Math.max(Number.isInteger(j.n) ? j.n : 0, ...sendt.map((b) => b.n)),
    nye: normaliserSamleOps(j.nye),
    egne: (Array.isArray(j.egne) ? j.egne : []).filter((v) => typeof v === "string" && v),
    sendt,
    planFantes: !!j.planFantes,
    varslet: !!j.varslet,
  };
}

function lesLokalt() {
  let j = null;
  try { j = JSON.parse(les(LAGRING.liste) || "null"); } catch (e) {}
  return fraLager(j);
}

function lesEtterslep() {
  let j = null;
  try { j = JSON.parse(les(USENDT) || "null"); } catch (e) {}
  const ut = (Array.isArray(j) ? j : []).map((e) => {
    const lager = fraLager(e);
    if (!lager || typeof e.planId !== "string" || !e.planId) return null;
    return { planId: e.planId, tittel: String(e.tittel || "(uten tittel)"), modus: "", ...lager, avsluttet: true };
  }).filter(Boolean);
  if (!ut.length) slett(USENDT);
  return ut;
}

// Er et etterslep kommet fram (planen viser alt, og ingenting fra denne sida
// venter på kvittering), eller er planen borte, glemmes det.
function ryddEtterslep(ø) {
  if (!etterslep.includes(ø)) return;
  const ferdig = ø.forkastet || (!ø.nye.length && lastet() && !ventende(ø).length && !ø.sendt.some((b) => b.live));
  if (!ferdig) return;
  etterslep = etterslep.filter((e) => e !== ø);
  lagreEtterslep();
}

// Etter hver ny handling: husk den, vis den, og sett en frist.
function endret(ø) {
  lagreLokalt(ø);
  oppdaterBar();
  planleggLagring(ø);
}

function planleggLagring(ø) {
  if (!ø || ø.avsluttet || ø.timer || !harUsendt(ø)) return;
  ø.timer = setTimeout(() => { ø.timer = null; lagreNaa(ø); }, SAMLE_LAGRE_MS);
}

// Sender det planen ikke viser, nå. Løftet løses når skrivingen er kvittert
// eller avvist, eller med en gang når ingenting trengte å sendes;
// Visning-vinduet venter på det med en frist før det bytter side.
function lagreNaa(ø = økt) {
  if (!ø) return Promise.resolve();
  clearTimeout(ø.timer);
  ø.timer = null;
  const lovnad = skrivEnGang(ø);
  ryddEtterslep(ø);
  planleggLagring(ø);
  oppdaterBar();
  return lovnad || ø.sisteLovnad || Promise.resolve();
}

// Én skriving (eller ingen): den ferske planen med alt planen ikke viser
// lagt oppå, i rekkefølge. Hver skriving inneholder altså alle tidligere
// skrivinger, og merket (n) sier hvilke planen har: det som ikke kom fram
// (avvist, eller tapt med forrige side), er med på nytt. Uten nett ligger
// skrivingen i Firestores varige kø, og en ny skriving venter ikke på
// kvitteringen (Ferdig uten nett la før de siste stoppene bare i minnet).
// Hver bøtte har bare SINE nye handlinger og slås aldri sammen med andre
// (kontrollrunde 3: en bøtte med en annen bøttes handlinger kunne legge dem
// inn på nytt etter at merket hadde passert dem).
function skrivEnGang(ø) {
  if (ø.forkastet || !lastet() || ø.venterEier) return null;   // samleTikk sender når planene har landet
  ø.forsøkt = true;
  const fersk = ferskPlan(ø);
  const vent = ventende(ø, fersk);
  if (fersk) ø.planFantes = true;
  else if (ø.planFantes && !vent.length) { planSlettet(ø); return null; }
  // Ingenting nytt: det som ligger i Firestores kø fra denne sida, sendes
  // ikke én gang til (visibilitychange og pagehide kommer rett etter
  // hverandre ved hvert sidebytte).
  if (!ø.nye.length && !vent.some((b) => !b.live)) return null;
  const n = Math.max(ø.n, samleMerke(fersk, ø.øktId)) + 1;
  ø.n = n;
  const stopp = brukSamleOps(fersk?.stopp || [], [...vent.flatMap((b) => b.ops), ...ø.nye]);
  ø.sendt = [...ø.sendt, { n, ops: ø.nye, live: true }];
  ø.nye = [];
  lagreLokalt(ø);
  const lovnad = savePlan(ø.planId, {
    tittel: fersk?.tittel || ø.tittel,
    laget: fersk?.laget || new Date().toISOString(),
    stopp,
    samle: { [ø.øktId]: n },
  }).then(() => {
    // Firestore kvitterer i rekkefølge: alt til og med n er på serveren.
    ø.sendt = ø.sendt.filter((b) => b.n > n);
    ø.feilet = false;
  }, (e) => {
    console.warn("Fikk ikke lagret kjøreplanen:", e);
    ø.feilet = true;
    // Handlingene blir liggende: Firestore ruller tilbake den lokale
    // visningen, merket viser at skrivingen mangler, og neste skriving tar
    // dem med.
    const b = ø.sendt.find((x) => x.n === n);
    if (b) b.live = false;
    // En avsluttet økt har ingen linje å vise feilen i. Én gang per økt,
    // også over sidebytter (varslet følger med i USENDT).
    if (ø.avsluttet && !ø.varslet) {
      ø.varslet = true;
      alert(`Fikk ikke lagret de siste stoppene i «${ø.tittel}» (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`);
    }
  }).finally(() => {
    lagreLokalt(ø);
    ryddEtterslep(ø);
    planleggLagring(ø);
    oppdaterBar();
  });
  ø.sisteLovnad = lovnad;
  return lovnad;
}

// Planen er slettet et annet sted (en annen fane) mens økta sto på. Da
// avsluttes økta i stedet for å lage planen på nytt.
function planSlettet(ø) {
  const varAktiv = ø === økt;
  if (varAktiv) avsluttInnsamling({ lagre: false });
  ø.forkastet = true;
  ryddEtterslep(ø);
  alert(varAktiv
    ? `Kjøreplanen «${ø.tittel}» er slettet, så samleøkta er avsluttet.`
    : `Kjøreplanen «${ø.tittel}» er slettet, så de siste stoppene fra samleøkta ble ikke lagret.`);
}

// Stopp spilles av fra en kjøreplan: da tas ingenting opp (funn 6).
const spillerPlan = () => !!aktivPlanId();

// Siste innslag DENNE økta la til: {vis, hva, kilde}. Grunnlaget for
// erstatningsregelen under.
let sisteInnslag = null;

// kilde: "apning" (modalOpen under opptak), "endring" (data-vis endret seg i
// en åpen modal under opptak — læreren VALGTE noe: sjangergruppe i
// varmekartet, instrumentfane, historie-chip), "plukk" (plussknappen).
function leggTil(vis, kilde) {
  if (!økt || (kilde !== "plukk" && økt.modus !== "opptak")) return;
  const siste = sisteVis(økt);
  // Samme mål to ganger på rad er én hendelse (omtegninger, dobbeltklikk).
  if (kilde !== "plukk" && siste === vis) return;
  // Erstatningsregelen (v5.28): et VALG rett etter en åpning av samme flate
  // presiserer stoppet i stedet for å legge til et nytt. Åpner læreren
  // varmekartet (standard: første gruppe) og velger Country, blir stoppet
  // «varmekart:Country» — ikke standardvisningen pluss valget. Neste valg på
  // samme flate er derimot et nytt stopp (Blues, så Country = to poenger).
  const hva = parseVisVerdi(vis)?.hva || "";
  if (kilde === "endring" && sisteInnslag && sisteInnslag.kilde === "apning"
      && sisteInnslag.hva === hva && siste === sisteInnslag.vis) {
    const op = økt.nye[økt.nye.length - 1];
    if (op?.t === "legg" && op.vis === sisteInnslag.vis) op.vis = vis;   // ikke sendt ennå
    else økt.nye.push({ t: "erstatt", fra: sisteInnslag.vis, til: vis });
    const i = økt.egne.lastIndexOf(sisteInnslag.vis);
    if (i >= 0) økt.egne[i] = vis;
  } else {
    økt.nye.push({ t: "legg", vis });
    økt.egne.push(vis);
  }
  sisteInnslag = { vis, hva, kilde };
  endret(økt);
}

// Angre fjerner det siste stoppet DENNE økta la til, aldri et stopp planen
// hadde fra før (audit v5.42 funn 27: to Cmd+Z av vane i en ferdig plan
// fjernet forberedte stopp). Er tillegget ikke sendt, glemmes det bare
// (ingen skriving). Uten noe å angre er knappen av.
function angreSiste() {
  if (!økt || !økt.egne.length) return;
  const vis = økt.egne.pop();
  const op = økt.nye[økt.nye.length - 1];
  if (op?.t === "legg" && op.vis === vis) økt.nye.pop();
  else økt.nye.push({ t: "fjern", vis });
  sisteInnslag = null;   // det angrede skal ikke kunne «erstattes» av et valg
  endret(økt);
}

// Opptak: data-vis ENDRET seg i en åpen modal — læreren valgte noe (sjanger-
// gruppe i varmekartet, instrumentfane, historie-chip, tiår i båndet).
// Observatøren dekker alle flater som oppdaterer målet sitt, også framtidige.
let visObservator = null;

function startVisObservator() {
  if (visObservator || !("MutationObserver" in window)) return;
  visObservator = new MutationObserver((mutasjoner) => {
    if (økt?.modus !== "opptak" || spillerPlan()) return;
    const topp = topOpenModal();
    for (const m of mutasjoner) {
      const el = m.target;
      // Bare et VALG teller (audit v5.42, funn 2): verdien må faktisk ha
      // endret seg, og det må skje i kortet øverst, der læreren klikker. En
      // omtegning (hvert content-snapshot tegner åpne sjanger-, historie- og
      // instrumentkort på nytt) setter samme verdi igjen, og det gir også en
      // post. Uten disse to reglene ble kortet under tatt opp på nytt etter
      // hver lagring, og to åpne kort ga en skriveløkke.
      if (el !== topp || !el.classList?.contains("open")) continue;
      if (!el.dataset.vis || m.oldValue === el.dataset.vis) continue;
      leggTil(el.dataset.vis, "endring");
    }
  });
  visObservator.observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ["data-vis"], attributeOldValue: true,
  });
}

function stoppVisObservator() {
  visObservator?.disconnect();
  visObservator = null;
}

// ----------------------------------------------------------------------------
//  Linja nede til venstre
// ----------------------------------------------------------------------------

function oppdaterBar() {
  const status = document.getElementById("samle-status");
  if (!status || !økt) return;
  const plan = planSomØktaSer(økt);
  if (!plan) { status.textContent = "laster …"; return; }
  const tillegg = økt.modus === "opptak" && spillerPlan() ? ", tar ikke opp mens en kjøreplan spilles"
    : økt.feilet && harUsendt(økt) ? ", lagring feilet"
    : økt.nye.length ? ", lagres snart"
    : økt.sendt.some((b) => b.live) ? ", lagrer …" : "";
  status.textContent = `${plan.length} stopp${tillegg}`;
  const angre = document.getElementById("samle-angre");
  if (angre) angre.disabled = !økt.egne.length;
}

function visBar() {
  // Kortenes og radenes plussknapp i artistlistene (ui.js, kortPlussHtml)
  // vises bare i plukk-modus.
  if (økt) document.body.classList.toggle("samler-plukk", økt.modus === "plukk");
  if (!økt || document.getElementById("samle-bar")) return;
  const bar = document.createElement("div");
  bar.id = "samle-bar";
  bar.innerHTML = `
    ${økt.modus === "opptak" ? `<span class="samle-rec" title="Tar opp"></span>` : PLUSS_SVG}
    <span class="samle-navn">${økt.modus === "opptak" ? "Tar opp til" : "Plukker til"}
      «${escapeHtml(økt.tittel)}»</span>
    <span id="samle-status" class="muted"></span>
    <button type="button" class="pres-knapp" id="samle-angre" title="Fjern siste stopp (Ctrl/Cmd+Z)">Angre</button>
    <button type="button" class="pres-knapp" id="samle-ferdig">Ferdig</button>`;
  document.body.appendChild(bar);
  bar.addEventListener("click", (e) => {
    if (e.target.closest("#samle-angre")) return angreSiste();
    if (e.target.closest("#samle-ferdig")) return avsluttInnsamling();
  });
  oppdaterBar();
}

// ----------------------------------------------------------------------------
//  Plussknappen i kortenes tittellinje (kun plukk-modus)
// ----------------------------------------------------------------------------

function monterPlussKnapper() {
  if (!økt || økt.modus !== "plukk") return;
  document.querySelectorAll(".modal-head").forEach((head) => {
    // Bare hoder som kan bære et mål (de har lenkeknappen fra v5.22).
    if (head.querySelector(".plan-pluss") || !head.querySelector(".modal-lenke")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "plan-pluss btn ghost small";
    b.title = `Legg til i «${økt.tittel}» (+)`;
    b.setAttribute("aria-label", "Legg til i kjøreplanen");
    b.hidden = true;   // modalOpen slår den på når backdropen har data-vis
    b.innerHTML = PLUSS_SVG;
    b.addEventListener("click", () => {
      const vis = b.closest(".modal-backdrop")?.dataset.vis;
      if (!vis) return;
      leggTil(vis, "plukk");
      kvitter(b);
    });
    head.insertBefore(b, head.querySelector(".modal-lenke"));
  });
  // Modaler som ALT står åpne når økta starter, skal få knappen synlig nå.
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => {
    const b = m.querySelector(".plan-pluss");
    if (b) b.hidden = !m.dataset.vis;
  });
}

// Haken i plussknappen etter et tillegg, fra klikket og fra +-tasten.
function kvitter(b) {
  if (!b) return;
  b.innerHTML = HAKE_SVG;
  clearTimeout(b._kvittering);
  b._kvittering = setTimeout(() => { b.innerHTML = PLUSS_SVG; }, 1200);
}

function fjernPlussKnapper() {
  document.querySelectorAll(".plan-pluss").forEach((b) => b.remove());
}

// ----------------------------------------------------------------------------
//  Start / stopp / gjenopptak
// ----------------------------------------------------------------------------

function nyØkt(planId, modus, tittel) {
  return { planId, modus, tittel, øktId: nyØktId(), n: 0, nye: [], egne: [], sendt: [], planFantes: false };
}

// Kalles fra Visning-vinduet, som alltid sender en planId (for en NY plan
// genererer vinduet id-en; planen skrives første gang noe sendes).
export function startInnsamling(planId, modus, tittel) {
  // En økt om gangen: den forrige sendes før den nye tar over.
  if (økt) avsluttInnsamling();
  økt = nyØkt(planId, modus, tittel);
  økt.synket = true;   // startet her: ingenting ligger igjen fra en annen side
  åpneKanal();
  sisteInnslag = null;
  skriv(LAGRING.plan, planId);
  skriv(LAGRING.modus, modus);
  skriv(LAGRING.tittel, tittel);
  lagreLokalt(økt);
  visBar();
  monterPlussKnapper();
  if (modus === "opptak") startVisObservator();
  meldEndring();
}

// Avslutter økta. Det som ikke er sendt, sendes nå (lagre: false forkaster
// det, for en plan som skal slettes). Løftet løses når skrivingen er
// kvittert; Visning-vinduet venter på det, med en frist, før det bytter side.
export function avsluttInnsamling({ lagre = true } = {}) {
  const ø = økt;
  for (const k of Object.values(LAGRING)) slett(k);
  økt = null;
  sisteInnslag = null;
  document.getElementById("samle-bar")?.remove();
  document.body.classList.remove("samler-plukk");
  fjernPlussKnapper();
  stoppVisObservator();
  if (!ø) return Promise.resolve();
  ø.avsluttet = true;
  clearTimeout(ø.timer);
  ø.timer = null;
  meldEndring();
  if (!lagre) { ø.forkastet = true; return Promise.resolve(); }
  // Det som ikke er kommet fram, huskes til planen viser det, også over et
  // sidebytte: uten dette forsvant stoppene når Ferdig kom før planene hadde
  // landet (kontrollrunden for v5.43). Hver avsluttet økt har sin egen plass.
  if (harUsendt(ø) || ø.sendt.some((b) => b.live)) {
    etterslep.push(ø);
    lagreEtterslep();
  }
  return lagreNaa(ø);
}

// Slett i Visning-vinduet: ingenting skal sendes til planen etterpå, verken
// fra økta som pågår eller fra avsluttede økter som ikke er kommet fram (de
// ville ellers laget planen på nytt med bare sine stopp; kontrollrunde 3).
export function forkastSamlinger(planId) {
  if (økt?.planId === planId) avsluttInnsamling({ lagre: false });
  for (const e of [...etterslep]) {
    if (e.planId !== planId) continue;
    e.forkastet = true;
    ryddEtterslep(e);
  }
}

// Økta som pågår i denne fanen, eller null. For Visning-vinduet: «samles nå»
// i lista, og at Rediger, Slett og Spill av avslutter den først.
export function aktivSamleokt() {
  return økt ? { planId: økt.planId, tittel: økt.tittel, modus: økt.modus } : null;
}

// For testene og simuleringen: planen slik økta ser den, og hva som venter.
export function samleStatus() {
  return økt ? { stopp: planSomØktaSer(økt), nye: økt.nye.length, sendt: økt.sendt.length } : null;
}

// URL-parametrene for en økt som skal fortsette i en ny fane («Fri visning»
// fra lærersiden). Visning-vinduet bygger dem, initPlanInnsamling leser dem.
const OVERTA = { plan: "samle", modus: "samlemodus", tittel: "samletittel" };

export function medOvertakelse(url) {
  if (!økt) return url;
  const u = new URL(url, window.location.href);
  u.searchParams.set(OVERTA.plan, økt.planId);
  u.searchParams.set(OVERTA.modus, økt.modus);
  u.searchParams.set(OVERTA.tittel, økt.tittel);
  return u.pathname.split("/").pop() + u.search;
}

// Leser og fjerner parametrene (en omlasting skal ikke starte økta på nytt;
// sessionStorage bærer den videre).
function lesOvertakelse() {
  let q;
  try { q = new URLSearchParams(window.location.search); } catch (e) { return null; }
  const planId = q.get(OVERTA.plan);
  if (planId === null) return null;
  try {
    const u = new URL(window.location.href);
    for (const k of Object.values(OVERTA)) u.searchParams.delete(k);
    window.history.replaceState(null, "", u);
  } catch (e) {}
  const modus = q.get(OVERTA.modus);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(planId) || (modus !== "plukk" && modus !== "opptak")) return null;
  return { planId, modus, tittel: String(q.get(OVERTA.tittel) || "(uten tittel)").slice(0, 80) };
}

// ----------------------------------------------------------------------------
//  Én fane per økt. «Dupliser fane» og Ctrl-klikk kopierer sessionStorage, og
//  kopien fikk samme økt med de samme usendte handlingene, så begge fanene
//  sendte dem (kontrollrunde 3). En gjenopptatt økt spør derfor de andre
//  fanene om noen har den. Svarer en, er denne fanen en kopi: den fortsetter
//  å samle til samme plan, men som en ny økt uten den andres handlinger.
//  Vanlige sidebytter svarer ingen på (den gamle sida er borte).
// ----------------------------------------------------------------------------

const EIER_FRIST_MS = 400;
let kanal = null;

function åpneKanal() {
  if (kanal || typeof BroadcastChannel === "undefined") return;
  try { kanal = new BroadcastChannel("pensum-samle"); } catch (e) { return; }
  kanal.onmessage = (e) => {
    const m = e.data || {};
    if (!økt) return;
    if (m.spør === økt.øktId && !økt.venterEier) kanal.postMessage({ eier: m.spør });
    if (m.eier === økt.øktId && økt.venterEier) erKopi(økt);
  };
}

function erKopi(ø) {
  ø.venterEier = false;
  ø.øktId = nyØktId();
  ø.n = 0;
  ø.sendt = [];
  ø.nye = ø.nye.slice(ø.nyeVedStart || 0);   // bare det DENNE fanen har gjort
  ø.egne = ø.egne.slice(ø.egneVedStart || 0);
  ø.fraForrige = false;
  lagreLokalt(ø);
  oppdaterBar();
}

function sjekkEier(ø) {
  åpneKanal();
  if (!kanal) return;
  ø.venterEier = true;
  ø.nyeVedStart = ø.nye.length;
  ø.egneVedStart = ø.egne.length;
  kanal.postMessage({ spør: ø.øktId });
  setTimeout(() => {
    if (!ø.venterEier) return;
    ø.venterEier = false;
    // Ingen andre har økta: det forrige side lot ligge, sendes nå.
    if (ø === økt && ø.synket && ø.fraForrige && harUsendt(ø)) lagreNaa(ø);
  }, EIER_FRIST_MS);
}

// Kalles fra sidenes oppstart. Gjenopptar en økt fra sessionStorage (den
// følger med over sidebytter), kobler opptaks-kroken, og logger selve
// slektstresiden som stopp når et opptak ankommer den (treet er en side,
// ikke en modal, så modalkroken ser den aldri).
export function initPlanInnsamling({ erTreSide = false } = {}) {
  setModalApnetProvider((vis, modal) => {
    if (!økt) return;
    if (økt.modus === "opptak" && !spillerPlan()) leggTil(vis, "apning");
    // Plukk: modaler laget ETTER øktstart (spilleren) mangler plussknappen —
    // monter idempotent og slå den på for akkurat denne åpningen (modalen er
    // ennå ikke .open når kroken kjører, så den generelle synlighetsrunden
    // ser den ikke).
    if (økt.modus === "plukk") {
      monterPlussKnapper();
      const b = modal?.querySelector(".plan-pluss");
      if (b) b.hidden = !vis;
    }
  });
  // Plussknappen på kortene og radene i artistlistene (v5.53): ett delegert
  // klikk for alle lister, også de som tegnes etter at økta startet.
  // stopPropagation: raden og kortet skal ikke i tillegg åpne kortet.
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".kort-pluss");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (!økt || økt.modus !== "plukk" || !b.dataset.vis) return;
    leggTil(b.dataset.vis, "plukk");
    kvitter(b);
  });
  // Lytteeksempler (v5.28): spilleren fanger YouTube-lenker også under en
  // samleøkt, så eksemplene kan plukkes og tas opp som stopp.
  registrerYtIntercept(() => !!økt);

  // Hurtigtastene (v5.38): + legger kortet øverst til (som plussknappen),
  // Ctrl/Cmd+Z angrer siste stopp. Lytteren står på window, altså ETTER
  // sidenes egne på document: spilles en kjøreplan i samme fane, får den +
  // først og markerer tastetrykket brukt (defaultPrevented).
  window.addEventListener("keydown", (e) => {
    if (!økt || e.defaultPrevented) return;
    const h = samleTast(e, { iSkrivefelt: erSkrivefelt(document.activeElement) });
    if (h === "angre") { e.preventDefault(); angreSiste(); return; }
    if (h !== "leggTil") return;
    const modal = topOpenModal();
    const vis = modal?.dataset.vis;
    if (!vis) return;
    e.preventDefault();
    // Allerede siste stopp: i opptak ble kortet tatt opp da det åpnet, og
    // et bevisst dobbeltstopp lages fortsatt med plussknappen.
    if (sisteVis(økt) === vis) return;
    leggTil(vis, "plukk");
    kvitter(modal.querySelector(".plan-pluss"));
  });

  // Fanen skjules ved sidebytte, lukking og når læreren går til et annet
  // program: da sendes det som ligger. (pagehide i tillegg for nettlesere
  // som ikke melder visibilitychange ved lukking.)
  const sendVedAvgang = () => { if (økt && harUsendt(økt)) lagreNaa(økt); };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendVedAvgang();
  });
  window.addEventListener("pagehide", () => {
    sendVedAvgang();
    // En side på vei ut skal ikke svare at den eier økta.
    kanal?.close();
    kanal = null;
  });
  // Tilbake fra nettleserens hurtigbuffer (bfcache): økta i minnet kan være
  // eldre enn den i sessionStorage, som sida etterpå har ført videre. En
  // ny lasting gjenoppretter den riktige.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && (økt || les(LAGRING.plan))) window.location.reload();
  });

  etterslep = lesEtterslep();

  // Overtatt fra lærersiden: «Fri visning» åpner visningen i en ny fane, og
  // en samleøkt som står på, følger med dit via URL-en (sessionStorage kopieres
  // ikke med noopener). Bare for en lærerkonto, så en tilfeldig lenke aldri
  // setter i gang et opptak.
  const overtatt = lesOvertakelse();
  if (overtatt) {
    let av = null, startet = false;
    av = onAuthChange((user) => {
      if (startet || !erLaererBruker(user) || økt) return;
      startet = true;
      startInnsamling(overtatt.planId, overtatt.modus, overtatt.tittel);
      if (av) av();
    });
    return;
  }

  const planId = les(LAGRING.plan);
  const modus = les(LAGRING.modus);
  if (!planId || (modus !== "plukk" && modus !== "opptak")) return;
  økt = nyØkt(planId, modus, les(LAGRING.tittel) || "(uten tittel)");
  // Handlingene fra forrige side, også det som kanskje ikke rakk fram før
  // sidebyttet. (En økt fra v5.42 har ingen; den skrev for hvert klikk.)
  const lokalt = lesLokalt();
  if (lokalt) Object.assign(økt, lokalt);
  else lagreLokalt(økt);
  if (lokalt) sjekkEier(økt);
  else åpneKanal();
  // Noe fra forrige side som kanskje ikke kom fram? Da sendes det ved første
  // snapshot her. (Nye stopp på denne sida, som ankomsten til slektstreet,
  // venter på fristen som vanlig.)
  økt.fraForrige = økt.nye.length > 0 || økt.sendt.length > 0;
  visBar();
  monterPlussKnapper();
  if (modus === "opptak") startVisObservator();
  if (erTreSide && modus === "opptak" && !spillerPlan()) leggTil("slektstre", "apning");
}

// Snapshot-hook fra sidene: sender det forrige side lot ligge, merker en
// slettet plan, og holder linja oppdatert. No-op uten økt og etterslep.
export function samleTikk() {
  if (!lastet()) { oppdaterBar(); return; }
  // Avsluttede økter med noe som ikke er kommet fram: ett forsøk per side
  // (et avvist forsøk skal ikke gjentas ved hvert snapshot).
  for (const e of [...etterslep]) {
    if (!e.forsøkt) lagreNaa(e);
    else ryddEtterslep(e);
  }
  const ø = økt;
  if (!ø) return;
  const fersk = ferskPlan(ø);
  if (fersk) ø.planFantes = true;
  else if (ø.planFantes && !ventende(ø, fersk).length) { planSlettet(ø); return; }
  if (!ø.synket) {
    ø.synket = true;
    if (ø.fraForrige && harUsendt(ø)) lagreNaa(ø);
  }
  // En avvist skrivings tilbakerulling kan ha gjort noe usendt igjen.
  planleggLagring(ø);
  oppdaterBar();
}
