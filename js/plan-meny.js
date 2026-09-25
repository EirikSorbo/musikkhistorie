// ============================================================================
//  «LEGG TIL I KJØREPLAN»-MENYEN (v5.26)
// ----------------------------------------------------------------------------
//  Brukerens forenkling av kjøreplan-flyten: i stedet for å kopiere lenker og
//  lime dem inn i editoren, får lenkeknappen i modalhodene en liten meny med
//  de lagrede kjøreplanene — ett klikk legger kortet til som stopp, rett fra
//  der man står. Lim-inn-feltet i editoren består som reserve.
//
//  Menyen finnes BARE når nettleserens Firebase-økt er en lærerkonto (samme
//  liste som lærersidens gate); reglene håndhever uansett at bare læreren
//  kan skrive content/presentasjoner. Kopieringen skjer alltid først, som
//  før — menyen er et tillegg, ikke et bytte.
//
//  Lastes av forsiden, lærersiden og slektstresiden (student.html laster
//  ikke utforsk-laget og har ingen lenkeknapper).
// ============================================================================

import { onAuthChange, savePlan } from "./store.js?v=5.58";
import { TEACHER_EMAILS } from "./firebase-config.js?v=5.58";
import { getState } from "./explore-context.js?v=5.58";
import { normaliserPlaner, nyPlanId, medStoppSattInn } from "./presentasjon-modell.js?v=5.58";
import { setLenkeMenyProvider } from "./ui-modal.js?v=5.58";
import { escapeHtml } from "./util.js?v=5.58";

let erLaerer = false;
let meny = null;   // én meny om gangen

// Er Firebase-brukeren en lærerkonto? Delt med presentasjonens «Legg til
// her»-knapp (v5.37), så menyen og knappen aldri kan være uenige.
export function erLaererBruker(user) {
  return !!user && !user.isAnonymous && TEACHER_EMAILS.includes(user.email);
}

// Setter inn et stopp på en gitt plass i en plan og lagrer («Legg til her»,
// v5.37). Samme regel som leggTil under: skrivingen bygger på de FERSKESTE
// planene i state, ikke på avspillerens kopi, så endringer gjort i en annen
// fane ikke overskrives. Bare denne planen skrives (v5.43). Returnerer
// planen slik den ble lagret.
export async function settInnStopp(planId, indeks, stopp) {
  if (!planeneLastet()) throw new Error("kjøreplanene er ikke lastet ennå");
  const planer = medStoppSattInn(planerNaa(), planId, indeks, stopp);
  await savePlan(planId, uttenMerke(planer[planId]));
  return planer[planId];
}

// Det en skriving utenfor samleøkta sender: aldri øktenes merker (plan.samle).
// Et merke lest fra en utdatert state ville ellers senket merket, og økta
// ville sendt handlinger planen alt har, på nytt (se brukSamleOps).
function uttenMerke(plan) {
  return { tittel: plan.tittel, laget: plan.laget, stopp: plan.stopp };
}

// Har planene landet? Før det er speilingen tom, og ingenting skal bygges på
// den (audit v5.42, funn 4).
export function planeneLastet() {
  return !!getState().contentLoaded;
}

function lukkMeny() {
  meny?.remove();
  meny = null;
}

function planerNaa() {
  return normaliserPlaner(getState().content?.presentasjoner?.planer);
}

function visMeny(knapp) {
  lukkMeny();
  if (!erLaerer) return;
  const head = knapp.closest(".modal-head");   // position:relative — ankeret
  const verdi = knapp.closest(".modal-backdrop")?.dataset.vis;
  if (!head || !verdi) return;

  const planer = Object.entries(planerNaa())
    .sort(([, a], [, b]) => a.tittel.localeCompare(b.tittel, "no"));

  meny = document.createElement("div");
  meny.className = "lenke-meny";
  if (!planeneLastet()) {
    meny.innerHTML = `<p class="lenke-meny-hode">Kjøreplanene lastes …</p>`;
    head.appendChild(meny);
    return;
  }
  meny.innerHTML = `
    <p class="lenke-meny-hode">Legg til som stopp i</p>
    ${planer.map(([id, p]) => `
      <button type="button" class="lenke-meny-valg" data-plan="${escapeHtml(id)}">
        ${escapeHtml(p.tittel)} <span class="muted">· ${p.stopp.length} stopp</span>
      </button>`).join("")}
    <button type="button" class="lenke-meny-valg lenke-meny-ny" data-plan="">Ny kjøreplan …</button>`;
  head.appendChild(meny);

  meny.addEventListener("click", (e) => {
    const valg = e.target.closest("[data-plan]");
    if (valg) leggTil(valg.dataset.plan, verdi);
  });
}

async function leggTil(planId, vis) {
  // Ferske planer ved hvert klikk, så to tillegg på rad ikke overskriver
  // hverandre — snapshotet har normalt landet mellom dem, og skrivingen
  // under bygger uansett på det NYESTE vi har.
  if (!planeneLastet()) { lukkMeny(); return; }
  const planer = planerNaa();
  if (!planId) {
    const tittel = window.prompt("Navn på den nye kjøreplanen:", "");
    if (!tittel || !tittel.trim()) return;
    planId = nyPlanId();
    planer[planId] = { tittel: tittel.trim(), laget: new Date().toISOString(), stopp: [] };
  }
  const plan = planer[planId];
  if (!plan) { lukkMeny(); return; }
  plan.stopp.push({ vis });

  try {
    await savePlan(planId, uttenMerke(plan));
    if (meny) {
      meny.innerHTML = `<p class="lenke-meny-hode lenke-meny-ok">Lagt til i «${escapeHtml(plan.tittel)}» (${plan.stopp.length} stopp)</p>`;
      setTimeout(lukkMeny, 1400);
    }
  } catch (e) {
    lukkMeny();
    alert(`Fikk ikke lagret stoppet (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`);
  }
}

export function initPlanMeny() {
  onAuthChange((user) => {
    erLaerer = erLaererBruker(user);
    if (!erLaerer) lukkMeny();
  });
  setLenkeMenyProvider(visMeny);

  // Klikk utenfor lukker (unntatt selve lenkeknappen: dens klikk åpner en
  // fersk meny, og lukke-lytteren her kjører rett etterpå i samme boble).
  document.addEventListener("click", (e) => {
    if (meny && !meny.contains(e.target) && !e.target.closest(".modal-lenke")) lukkMeny();
  });
  // Escape lukker MENYEN, ikke modalen bak: capture-fasen stopper reisen før
  // sidenes modalCloseTop-lyttere (bubble på document) ser tastetrykket.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && meny) { e.stopPropagation(); lukkMeny(); }
  }, true);
}
