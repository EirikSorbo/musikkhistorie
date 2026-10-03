// ============================================================================
//  «LEGG TIL I KJØREPLAN»-MENYEN OG DEN AKTIVE KJØREPLANEN
// ----------------------------------------------------------------------------
//  Brukerens forenkling av kjøreplan-flyten (v5.26): i stedet for å kopiere
//  lenker og lime dem inn i editoren, får visningsknappen i modalhodene (samme
//  ikon som Visning i toppmenyen, v5.68) en liten meny med de lagrede
//  kjøreplanene — ett klikk legger kortet til som stopp, rett fra der man
//  står. «Kopier lenke» er siste punkt i menyen, og lim-inn-feltet i
//  editoren består som reserve.
//
//  AKTIV KJØREPLAN (v5.76, brukerbestilling 2026-09-27): læreren velger
//  «Bygg på» i Visning-vinduet, og fra da av legger visningsknappen kortet
//  rett inn i den planen med ett klikk, uten meny. En pille nede til venstre
//  viser «Bygger på «Uke 39» · 8 stopp · Ferdig». Menyen med de andre planene
//  ligger bak en liten pil ved siden av knappen. Plussknappen på radene i
//  artistlistene (kort-pluss) og +-tasten virker som i plukk-modus. Valget
//  bor i localStorage (lærerens nettleser) til «Ferdig», eller til planen
//  slettes. Dette erstatter samleøktas plukk-modus, som krevde en dialog og
//  en egen linje; opptak (js/plan-innsamling.js) består som «Ta opp».
//
//  Menyen finnes BARE når nettleserens Firebase-økt er en lærerkonto (samme
//  liste som lærersidens gate); reglene håndhever uansett at bare læreren
//  kan skrive content/presentasjoner. Knappen selv vises bare i en lærerøkt
//  (body.laerer-okt, satt her): studentene har ingen kjøreplaner å legge i.
//
//  Lastes av forsiden, lærersiden og slektstresiden (student.html laster
//  ikke utforsk-laget og har ingen lenkeknapper).
// ============================================================================

import { onAuthChange, savePlan } from "./store.js?v=6.16";
import { TEACHER_EMAILS } from "./firebase-config.js?v=6.16";
import { getState } from "./explore-context.js?v=6.16";
import { normaliserPlaner, nyPlanId, medStoppSattInn, medStoppOppdatert, samleTast } from "./presentasjon-modell.js?v=6.16";
import { setLenkeMenyProvider, kopierVisLenke, topOpenModal, VISNING_SVG } from "./ui-modal.js?v=6.16";
import { erSkrivefelt } from "./vis-lenke.js?v=6.16";
import { escapeHtml } from "./util.js?v=6.16";

let erLaerer = false;
let meny = null;   // én meny om gangen

// Er Firebase-brukeren en lærerkonto? Delt med presentasjonens «Legg til
// her»-knapp (v5.37), så menyen og knappen aldri kan være uenige.
export function erLaererBruker(user) {
  return !!user && !user.isAnonymous && TEACHER_EMAILS.includes(user.email);
}

// Setter inn et stopp på en gitt plass i en plan og lagrer («Legg til her»,
// v5.37). Samme regel som skrivStopp under: skrivingen bygger på de FERSKESTE
// planene i state, ikke på avspillerens kopi, så endringer gjort i en annen
// fane ikke overskrives. Bare denne planen skrives (v5.43). Returnerer
// planen slik den ble lagret.
export async function settInnStopp(planId, indeks, stopp) {
  if (!planeneLastet()) throw new Error("kjøreplanene er ikke lastet ennå");
  const planer = medStoppSattInn(planerNaa(), planId, indeks, stopp);
  await savePlan(planId, uttenMerke(planer[planId]));
  return planer[planId];
}

// Nivå og unntak på ett stopp («Husk visningen på dette stoppet», v5.75).
// Samme regler som settInnStopp: ferskeste planer i state, bare denne planen
// skrives. Returnerer planen slik den ble lagret.
export async function oppdaterStopp(planId, indeks, endring) {
  if (!planeneLastet()) throw new Error("kjøreplanene er ikke lastet ennå");
  const planer = medStoppOppdatert(planerNaa(), planId, indeks, endring);
  await savePlan(planId, uttenMerke(planer[planId]));
  return planer[planId];
}

// Ett stopp sist i en plan (menyen, den aktive planen, plussknappene). Ferske
// planer ved hvert kall, så to tillegg på rad ikke overskriver hverandre:
// snapshotet har normalt landet mellom dem, og skrivingen bygger uansett på
// det NYESTE vi har. Returnerer planen slik den ble lagret.
async function skrivStopp(planId, vis) {
  if (!planeneLastet()) throw new Error("kjøreplanene er ikke lastet ennå");
  const plan = planerNaa()[planId];
  if (!plan) throw new Error("Kjøreplanen finnes ikke lenger.");
  plan.stopp.push({ vis });
  await savePlan(planId, uttenMerke(plan));
  return plan;
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

// ----------------------------------------------------------------------------
//  Den aktive kjøreplanen (v5.76)
// ----------------------------------------------------------------------------

const AKTIV_NOKKEL = "pensum-aktiv-plan";
const HAKE_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

let aktivId = null;
// Er planen sett i state siden den ble valgt? Bare da betyr «borte» slettet;
// rett etter «Ny + bygg på» kan snapshotet ligge et øyeblikk etter.
let aktivSett = false;
const aktivLyttere = [];

function lesAktiv() {
  try { return localStorage.getItem(AKTIV_NOKKEL) || null; } catch (e) { return null; }
}

// Planen læreren bygger på nå, eller null. Bare i lærerøkter.
export function aktivPlan() {
  return erLaerer ? aktivId : null;
}

export function vedAktivPlanEndring(fn) { aktivLyttere.push(fn); }

// Velg planen (id) eller avslutt (null). Visning-vinduet kaller den fra
// «Bygg på» og «Ferdig»; pilla nede til venstre fra sin Ferdig-knapp.
export function settAktivPlan(id) {
  aktivId = id || null;
  aktivSett = false;
  try {
    if (aktivId) localStorage.setItem(AKTIV_NOKKEL, aktivId);
    else localStorage.removeItem(AKTIV_NOKKEL);
  } catch (e) {}
  oppdaterAktiv();
  aktivLyttere.forEach((fn) => { try { fn(aktivId); } catch (e) { console.warn(e); } });
}

// Kalles ved oppstart, ved innlogging og fra sidenes snapshot-hooks (via
// visningTikk i js/visning.js): pilla og radknappene følger planen, og en
// slettet plan avslutter byggingen.
export function oppdaterAktiv() {
  const plan = aktivId && planeneLastet() ? planerNaa()[aktivId] || null : null;
  if (plan) aktivSett = true;
  if (aktivId && aktivSett && planeneLastet() && !plan) { settAktivPlan(null); return; }
  const paa = !!(erLaerer && aktivId);
  document.body.classList.toggle("har-aktiv-plan", paa);
  tegnPille(paa ? plan : null, paa);
}

function tegnPille(plan, paa) {
  let el = document.getElementById("aktiv-plan-pille");
  if (!paa) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("div");
    el.id = "aktiv-plan-pille";
    el.innerHTML = `${VISNING_SVG}<span class="aktiv-plan-tekst"></span>` +
      `<button type="button" class="pres-knapp" id="aktiv-plan-ferdig" title="Slutt å bygge på planen. Planen beholdes.">Ferdig</button>`;
    document.body.appendChild(el);
    el.querySelector("#aktiv-plan-ferdig").addEventListener("click", () => settAktivPlan(null));
  }
  const tekst = el.querySelector(".aktiv-plan-tekst");
  tekst.innerHTML = plan
    ? `Bygger på «<strong>${escapeHtml(plan.tittel)}</strong>» · ${plan.stopp.length} stopp`
    : "Bygger på en kjøreplan · laster …";
  el.title = plan ? "Visningsknappen på kortene og + legger kortet rett inn i denne planen" : "";
}

// Haken i knappen som la til, med tittel som sier hvor det havnet.
function kvitter(b, tekst) {
  if (!b) return;
  const original = b.dataset.kvitterOriginal || b.innerHTML;
  b.dataset.kvitterOriginal = original;
  b.innerHTML = HAKE_SVG;
  if (tekst) b.title = tekst;
  clearTimeout(b._kvittering);
  b._kvittering = setTimeout(() => { b.innerHTML = original; delete b.dataset.kvitterOriginal; }, 1400);
}

// Ett klikk: kortet inn i den aktive planen. Feil sies fra om, planen står.
let leggerTil = false;
async function leggTilAktiv(vis, knapp) {
  const id = aktivPlan();
  if (!id || !vis || leggerTil) return;
  if (!planeneLastet()) { alert("Kjøreplanene er ikke lastet ennå. Vent litt og prøv igjen."); return; }
  leggerTil = true;
  try {
    const plan = await skrivStopp(id, vis);
    kvitter(knapp, `Lagt til i «${plan.tittel}» (${plan.stopp.length} stopp)`);
    oppdaterAktiv();
  } catch (e) {
    alert(`Fikk ikke lagret stoppet (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`);
  } finally {
    leggerTil = false;
  }
}

// ----------------------------------------------------------------------------
//  Menyen i modalhodet
// ----------------------------------------------------------------------------

// `meny: true` kommer fra pila ved siden av knappen (v5.76): alltid menyen,
// også når en plan er aktiv. Selve knappen legger da rett til.
function visMeny(knapp, { meny: baraMeny = false } = {}) {
  lukkMeny();
  if (!erLaerer) return;
  const head = knapp.closest(".modal-head");   // position:relative — ankeret
  const verdi = knapp.closest(".modal-backdrop")?.dataset.vis;
  if (!head || !verdi) return;
  if (!baraMeny && aktivPlan()) { leggTilAktiv(verdi, knapp); return; }

  const planer = Object.entries(planerNaa())
    .sort(([, a], [, b]) => a.tittel.localeCompare(b.tittel, "no"));
  const aktiv = aktivPlan();

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
        ${escapeHtml(p.tittel)} <span class="muted">· ${p.stopp.length} stopp${id === aktiv ? " · bygger på" : ""}</span>
      </button>`).join("")}
    <button type="button" class="lenke-meny-valg lenke-meny-ny" data-plan="">Ny kjøreplan …</button>
    <button type="button" class="lenke-meny-valg lenke-meny-ny" data-kopier="1">Kopier lenke</button>`;
  head.appendChild(meny);

  meny.addEventListener("click", async (e) => {
    if (e.target.closest("[data-kopier]")) {
      const ok = await kopierVisLenke(verdi);
      if (meny) {
        meny.innerHTML = `<p class="lenke-meny-hode lenke-meny-ok">${ok ? "Lenke kopiert" : "Lenken står i dialogen"}</p>`;
        setTimeout(lukkMeny, 1200);
      }
      return;
    }
    const valg = e.target.closest("[data-plan]");
    if (valg) leggTil(valg.dataset.plan, verdi);
  });
}

async function leggTil(planId, vis) {
  if (!planeneLastet()) { lukkMeny(); return; }
  let tittel = null;
  if (!planId) {
    tittel = window.prompt("Navn på den nye kjøreplanen:", "");
    if (!tittel || !tittel.trim()) return;
    planId = nyPlanId();
  }
  try {
    // En ny plan skrives i ETT stykke, med stoppet i: da finnes det ikke noe
    // øyeblikk der snapshotet mangler planen (skrivStopp leser fra state).
    const plan = tittel
      ? await (async () => {
          const ny = { tittel: tittel.trim(), laget: new Date().toISOString(), stopp: [{ vis }] };
          await savePlan(planId, uttenMerke(ny));
          return ny;
        })()
      : await skrivStopp(planId, vis);
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
  aktivId = lesAktiv();
  onAuthChange((user) => {
    erLaerer = erLaererBruker(user);
    // Visningsknappen i modalhodene vises bare i en lærerøkt (CSS).
    document.body.classList.toggle("laerer-okt", erLaerer);
    if (!erLaerer) lukkMeny();
    oppdaterAktiv();
  });
  setLenkeMenyProvider(visMeny);

  // Klikk utenfor lukker (unntatt selve lenkeknappen: dens klikk åpner en
  // fersk meny, og lukke-lytteren her kjører rett etterpå i samme boble).
  document.addEventListener("click", (e) => {
    if (meny && !meny.contains(e.target) && !e.target.closest(".modal-lenke, .modal-lenke-meny")) lukkMeny();
  });
  // Escape lukker MENYEN, ikke modalen bak: capture-fasen stopper reisen før
  // sidenes modalCloseTop-lyttere (bubble på document) ser tastetrykket.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && meny) { e.stopPropagation(); lukkMeny(); }
  }, true);

  // Plussknappen på kortene og radene i artistlistene (kort-pluss, ui.js)
  // legger til i den aktive planen (v5.76). Samleøktas egen lytter
  // (plan-innsamling.js) tar klikket når en plukk-økt står på.
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".kort-pluss");
    if (!b || !aktivPlan() || document.body.classList.contains("samler-plukk")) return;
    e.preventDefault();
    e.stopPropagation();
    leggTilAktiv(b.dataset.vis, b);
  });

  // +-tasten legger kortet øverst inn i den aktive planen (som i plukk-modus).
  // Lytteren står på window, etter sidenes egne: spilles en kjøreplan i samme
  // fane, tar presentasjonen + først og markerer tastetrykket brukt.
  window.addEventListener("keydown", (e) => {
    if (!aktivPlan() || e.defaultPrevented || document.body.classList.contains("samler-plukk")) return;
    if (samleTast(e, { iSkrivefelt: erSkrivefelt(document.activeElement) }) !== "leggTil") return;
    const modal = topOpenModal();
    const vis = modal?.dataset.vis;
    if (!vis) return;
    e.preventDefault();
    leggTilAktiv(vis, modal.querySelector(".modal-head .modal-lenke"));
  });
}
