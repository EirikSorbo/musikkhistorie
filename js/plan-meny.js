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

import { onAuthChange, savePresentasjoner } from "./store.js?v=5.35";
import { TEACHER_EMAILS } from "./firebase-config.js?v=5.35";
import { getState } from "./explore-context.js?v=5.35";
import { normaliserPlaner, nyPlanId } from "./presentasjon-modell.js?v=5.35";
import { setLenkeMenyProvider } from "./ui-modal.js?v=5.35";
import { escapeHtml } from "./util.js?v=5.35";

let erLaerer = false;
let meny = null;   // én meny om gangen

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
    await savePresentasjoner(planer);
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
    erLaerer = !!user && !user.isAnonymous && TEACHER_EMAILS.includes(user.email);
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
