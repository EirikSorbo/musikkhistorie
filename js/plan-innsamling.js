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
//  Økta startes fra Kjøreplaner-editoren (teacher-presentasjoner.js), bæres
//  av sessionStorage over alle sidene (samme mønster som presentasjons-
//  modusen), og vises som en linje nede til VENSTRE (presentasjonslinja bor
//  til høyre): plan, modus, stopptall, Angre siste og Ferdig.
//
//  Skriving: hver tilføyelse lagrer hele dokumentet (setDoc uten merge, som
//  editoren). Øktas egen stoppliste er fasit for DENNE planen — å lese den
//  fra state ved hvert klikk ville tapt raske tilføyelser som snapshotet
//  ikke hadde rukket å speile. Lagringene går i kø, så to raske klikk aldri
//  skriver om hverandre. Reglene krever lærerkonto; økta kan uansett bare
//  startes fra lærersidens editor.
// ============================================================================

import { savePresentasjoner } from "./store.js?v=5.31";
import { getState } from "./explore-context.js?v=5.31";
import { normaliserPlaner } from "./presentasjon-modell.js?v=5.31";
import { setModalApnetProvider } from "./ui-modal.js?v=5.31";
import { escapeHtml } from "./util.js?v=5.31";
import { parseVisVerdi } from "./vis-lenke.js?v=5.31";
import { registrerYtIntercept } from "./yt-spiller.js?v=5.31";

const LAGRING = {
  plan: "pensumSamlePlan",
  modus: "pensumSamleModus",
  tittel: "pensumSamleTittel",
};

const les = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const skriv = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
const slett = (k) => { try { sessionStorage.removeItem(k); } catch (e) {} };

// { planId, modus, tittel, stopp, seeded } — null når ingen økt er i gang.
let økt = null;
// Lagringskø: én skriving om gangen, i rekkefølge.
let lagreKø = Promise.resolve();

const PLUSS_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const HAKE_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function planerNaa() {
  return normaliserPlaner(getState().content?.presentasjoner?.planer);
}

// Øktas stoppliste hentes fra den lagrede planen FØR første skriving — men
// aldri før content har landet: å skrive med en tom speiling mens planen
// egentlig har stopp, ville slettet dem. Ny (ulagret) plan seedes tom.
function seedStopp() {
  if (!økt || økt.seeded) return true;
  const s = getState();
  if (!s.contentLoaded) return false;
  const plan = planerNaa()[økt.planId];
  økt.stopp = plan ? plan.stopp.map((x) => ({ ...x })) : [];
  if (plan) økt.tittel = plan.tittel;
  økt.seeded = true;
  return true;
}

function lagreØkt() {
  const planId = økt.planId, tittel = økt.tittel, stopp = økt.stopp.map((x) => ({ ...x }));
  lagreKø = lagreKø.then(async () => {
    const planer = planerNaa();
    planer[planId] = {
      tittel,
      laget: planer[planId]?.laget || new Date().toISOString(),
      stopp,
    };
    try {
      await savePresentasjoner(planer);
    } catch (e) {
      console.warn("Fikk ikke lagret stoppet:", e);
      const status = document.getElementById("samle-status");
      if (status) status.textContent = "Lagring feilet!";
    }
  });
}

// Åpninger som skjer FØR planene har landet etter et sidebytte (opptak).
// Slippes gjennom i samleTikk — et opptak skal ikke miste et stopp på
// lastetid.
let venter = [];

// Siste innslag DENNE økta la til: {vis, hva, kilde}. Grunnlaget for
// erstatningsregelen under; null etter seed (eldre stopp røres aldri).
let sisteInnslag = null;

// kilde: "apning" (modalOpen under opptak), "endring" (data-vis endret seg i
// en åpen modal under opptak — læreren VALGTE noe: sjangergruppe i
// varmekartet, instrumentfane, historie-chip), "plukk" (plussknappen).
function leggTil(vis, kilde) {
  if (!økt || (kilde !== "plukk" && økt.modus !== "opptak")) return;
  if (!seedStopp()) {
    if (kilde !== "plukk") venter.push({ vis, kilde });
    const status = document.getElementById("samle-status");
    if (status) status.textContent = "laster …";
    return;
  }
  const siste = økt.stopp[økt.stopp.length - 1];
  // Samme mål to ganger på rad er én hendelse (omtegninger, dobbeltklikk).
  if (kilde !== "plukk" && siste && siste.vis === vis) return;
  // Erstatningsregelen (v5.28): et VALG rett etter en åpning av samme flate
  // presiserer stoppet i stedet for å legge til et nytt. Åpner læreren
  // varmekartet (standard: første gruppe) og velger Country, blir stoppet
  // «varmekart:Country» — ikke standardvisningen pluss valget. Neste valg på
  // samme flate er derimot et nytt stopp (Blues, så Country = to poenger).
  const hva = parseVisVerdi(vis)?.hva || "";
  if (kilde === "endring" && sisteInnslag && sisteInnslag.kilde === "apning"
      && sisteInnslag.hva === hva && siste && siste.vis === sisteInnslag.vis) {
    økt.stopp[økt.stopp.length - 1] = { vis };
  } else {
    økt.stopp.push({ vis });
  }
  sisteInnslag = { vis, hva, kilde };
  lagreØkt();
  oppdaterBar();
}

function angreSiste() {
  if (!økt || !seedStopp() || !økt.stopp.length) return;
  økt.stopp.pop();
  sisteInnslag = null;   // det angrede skal ikke kunne «erstattes» av et valg
  lagreØkt();
  oppdaterBar();
}

// Opptak: data-vis ENDRET seg i en åpen modal — læreren valgte noe (sjanger-
// gruppe i varmekartet, instrumentfane, historie-chip, tiår i båndet).
// Observatøren dekker alle flater som oppdaterer målet sitt, også framtidige.
let visObservator = null;

function startVisObservator() {
  if (visObservator || !("MutationObserver" in window)) return;
  visObservator = new MutationObserver((mutasjoner) => {
    if (økt?.modus !== "opptak") return;
    for (const m of mutasjoner) {
      const el = m.target;
      if (!el.classList?.contains("open")) continue;   // bare synlige valg
      if (el.dataset.vis) leggTil(el.dataset.vis, "endring");
    }
  });
  visObservator.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-vis"] });
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
  status.textContent = økt.seeded ? `${økt.stopp.length} stopp` : "laster …";
}

function visBar() {
  if (!økt || document.getElementById("samle-bar")) return;
  const bar = document.createElement("div");
  bar.id = "samle-bar";
  bar.innerHTML = `
    ${økt.modus === "opptak" ? `<span class="samle-rec" title="Tar opp"></span>` : PLUSS_SVG}
    <span class="samle-navn">${økt.modus === "opptak" ? "Tar opp til" : "Plukker til"}
      «${escapeHtml(økt.tittel)}»</span>
    <span id="samle-status" class="muted"></span>
    <button type="button" class="pres-knapp" id="samle-angre" title="Fjern siste stopp">Angre</button>
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
    b.title = `Legg til i «${økt.tittel}»`;
    b.setAttribute("aria-label", "Legg til i kjøreplanen");
    b.hidden = true;   // modalOpen slår den på når backdropen har data-vis
    b.innerHTML = PLUSS_SVG;
    b.addEventListener("click", () => {
      const vis = b.closest(".modal-backdrop")?.dataset.vis;
      if (!vis) return;
      leggTil(vis, "plukk");
      b.innerHTML = HAKE_SVG;
      clearTimeout(b._kvittering);
      b._kvittering = setTimeout(() => { b.innerHTML = PLUSS_SVG; }, 1200);
    });
    head.insertBefore(b, head.querySelector(".modal-lenke"));
  });
  // Modaler som ALT står åpne når økta starter, skal få knappen synlig nå.
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => {
    const b = m.querySelector(".plan-pluss");
    if (b) b.hidden = !m.dataset.vis;
  });
}

function fjernPlussKnapper() {
  document.querySelectorAll(".plan-pluss").forEach((b) => b.remove());
}

// ----------------------------------------------------------------------------
//  Start / stopp / gjenopptak
// ----------------------------------------------------------------------------

// Kalles fra Kjøreplaner-editoren, som alltid sender en planId (for en NY
// plan genererer editoren id-en; planen skrives første gang et stopp legges
// til). Tittelen overstyres av den lagrede planens når den finnes.
export function startInnsamling(planId, modus, tittel) {
  økt = { planId, modus, tittel, stopp: [], seeded: false };
  sisteInnslag = null;
  skriv(LAGRING.plan, planId);
  skriv(LAGRING.modus, modus);
  skriv(LAGRING.tittel, tittel);
  seedStopp();
  visBar();
  monterPlussKnapper();
  if (modus === "opptak") startVisObservator();
}

export function avsluttInnsamling() {
  for (const k of Object.values(LAGRING)) slett(k);
  økt = null;
  sisteInnslag = null;
  document.getElementById("samle-bar")?.remove();
  fjernPlussKnapper();
  stoppVisObservator();
}

// Kalles fra sidenes oppstart. Gjenopptar en økt fra sessionStorage (den
// følger med over sidebytter), kobler opptaks-kroken, og logger selve
// slektstresiden som stopp når et opptak ankommer den (treet er en side,
// ikke en modal, så modalkroken ser den aldri).
export function initPlanInnsamling({ erTreSide = false } = {}) {
  setModalApnetProvider((vis, modal) => {
    if (!økt) return;
    if (økt.modus === "opptak") leggTil(vis, "apning");
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
  // Lytteeksempler (v5.28): spilleren fanger YouTube-lenker også under en
  // samleøkt, så eksemplene kan plukkes og tas opp som stopp.
  registrerYtIntercept(() => !!økt);

  const planId = les(LAGRING.plan);
  const modus = les(LAGRING.modus);
  if (!planId || (modus !== "plukk" && modus !== "opptak")) return;
  økt = { planId, modus, tittel: les(LAGRING.tittel) || "(uten tittel)", stopp: [], seeded: false };
  seedStopp();
  visBar();
  monterPlussKnapper();
  if (modus === "opptak") startVisObservator();
  if (erTreSide && modus === "opptak") leggTil("slektstre", "apning");
}

// Snapshot-hook fra sidene: seeder økta når content lander (og oppdaterer
// telleren). No-op uten aktiv økt.
export function samleTikk() {
  if (!økt || økt.seeded) return;
  if (!seedStopp()) return;
  const ventet = venter;
  venter = [];
  for (const v of ventet) leggTil(v.vis, v.kilde);
  oppdaterBar();
}
