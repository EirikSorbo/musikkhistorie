// ============================================================================
//  VISNING — vinduet bak presentasjonsikonet (v5.41)
// ----------------------------------------------------------------------------
//  Brukerkrav 2026-09-19: ikonet i toppmenyen er inngangen til ALT som har
//  med visning å gjøre. Vinduet samler:
//    • Fri visning: presentasjonsmodus uten kjøreplan.
//    • Kjøreplanene, hver med Spill av, og i lærerøkter Samle, Rediger og
//      Slett, pluss Ny kjøreplan og Ny + samle.
//    • Editoren for én plan. Den lå på lærersidens Oversikt fra v5.25 til
//      v5.40 (teacher-presentasjoner.js, nå flyttet hit).
//    • Avslutt visning, når presentasjonsmodusen er på.
//  Lastes av forsiden, slektstresiden og lærersiden, og bygger markupen
//  selv. Skjemasiden (student.html) laster ikke utforsk-laget; der er ikonet
//  bare lenka index.html?visning=1, som åpner vinduet på forsiden.
//
//  Hvert stopp er en ?vis=-verdi (samme som «Kopier lenke»-knappen lager),
//  og avspillingen bor i js/visning/presentasjon.js. Redigering skjer på en KLADD
//  (dyp kopi) som først skrives ved Lagre. Hver lagring og sletting rører
//  bare sin egen plan (savePlan/deletePlan, v5.43), og ingenting skrives før
//  planene har landet. To faner som redigerer SAMME plan samtidig
//  overskriver hverandre; med én lærerkonto er det en akseptert enkelhet
//  (samme som podkast-admin).
//
//  v5.75: stopp legges til ved å søke (samme indeks som søket i appen), rader
//  kan dras, hvert stopp kan åpnes fra editoren («Vis»), lista står i
//  tidsrekkefølge (nyeste først; datoene vises ikke, brukervalg 2026-09-28:
//  «bare rot»), og planer med stopp som ikke finnes lenger, varsles før
//  avspilling. Etikettene bor i
//  js/visning/stopp-etikett.js, delt med verktøylinja i presentasjonen.
// ============================================================================

import { getState } from "../data/app-state.js";
import { escapeHtml } from "../felles/util.js";
import { onAuthChange, savePlan, savePlaner, deletePlan } from "../data/store.js";
import { parseVisVerdi, byggVisVerdi } from "../felles/vis-lenke.js";
import { normaliserPlaner, nyPlanId, NIVAA_NAVN, paminnelserForLange, stoppLagtTilSiden, normaliserGruppe, GRUPPE_MAKS } from "./presentasjon-modell.js";
import { abonnerPaminnelser, vedPaminnelseEndring, paminnelserFor, paminnelserLastet, paminnelseFeil, lagrePaminnelser } from "./paminnelser.js";
import { askChoice, modalOpen, modalClose, setupModal, initModalHeaders, melding, bekreft, sporTekst } from "../ui/ui-modal.js";
import { startInnsamling, avsluttInnsamling, aktivSamleokt, medOvertakelse, vedSamleEndring, forkastSamlinger } from "./plan-innsamling.js";
import { erLaererBruker, planeneLastet, aktivPlan, settAktivPlan, oppdaterAktiv, vedAktivPlanEndring } from "./plan-meny.js";
import { erPresentasjon, aktivPlanId, avsluttPresentasjon, aktivOkt } from "./presentasjon.js";
import { settFraPlan, antall as antallIUtskrift, TIL_UTSKRIFT_SVG } from "../utskrift/utskrift-utvalg.js";
import { stoppEtikett, dodeStopp } from "./stopp-etikett.js";
import { byggIndeks, sok, TYPE_LABEL } from "../felles/search.js";
import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "../felles/feature-flags.js";
import { apneMaal } from "../utforsk/explore-apne.js";
import { slider } from "./slides-liste.js";
import { lagreSomTime } from "./lagre-time.js";
import { grupperPlaner, gruppeNavn, planTelling } from "./gjennomgang-modell.js";
import { apneGjennomgang, gjennomgangTikk } from "./gjennomgang.js";
import { startKopivakt, ulagrede, kopierLastet, vedKopiEndring, slettKopi } from "./visningskopi.js";
import { erFersk, kopiDato } from "./visningskopi-modell.js";

const MODAL_ID = "modal-visning";
let erLaerer = false;

let kladd = null;   // { id, tittel, stopp, paminnelser, pamLastet, pamEndret } — settes ved Ny/Rediger, null i lista

// Godtar både en full «Kopier lenke»-URL og en rå vis-verdi. («artist:x»
// alene parses som URL med artist:-protokoll — uten vis-parameter faller den
// videre til rå-tolkningen, så begge formene ender riktig.)
function lesVisFraTekst(t) {
  t = String(t || "").trim();
  if (!t) return null;
  try {
    const v = new URL(t, window.location.href).searchParams.get("vis");
    if (v) return parseVisVerdi(v) ? v : null;
  } catch (e) {}
  return parseVisVerdi(t) ? t : null;
}

function msg(tekst, ok = true) {
  const el = document.getElementById("pres-adm-msg");
  if (!el) return;
  el.textContent = tekst;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

function planerNaa() {
  return normaliserPlaner(getState().content?.presentasjoner?.planer);
}

const IKKE_LASTET = "Kjøreplanene er ikke lastet ennå. Vent litt og prøv igjen.";

// Lagring med tydelig svar: true når skrivingen gikk, false (med beskjed)
// når den feilet. Lærersidens guardTeacherAction svelget feilen, og Lagre
// meldte da «lagret» også når ingenting var lagret.
async function vakt(lovnad) {
  try {
    await lovnad;
    return true;
  } catch (e) {
    console.error("Kjøreplanen ble ikke lagret:", e);
    msg(`Ble ikke lagret (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`, false);
    return false;
  }
}

// Visningen starter i egen fane fra lærersiden (den er arbeidsbenken og skal
// bestå), ellers i samme fane. `spiller`: en kjøreplan skal spilles. Da skal
// ingen samleøkt stå på, for hvert stopp avspilleren åpnet, ble tatt opp i
// planen på nytt (audit v5.42, funn 6). Fri visning er derimot det opptaket
// er laget for (ta opp timen mens du viser), så der fortsetter økta.
//   • Egen fane: åpnes MENS klikket fortsatt gjelder (nettlesere stopper
//     vinduer som åpnes etter en venting). noopener: uten den kopierer
//     nettleseren sessionStorage, og økta ville kjørt i to faner. Økta
//     avsluttes og sendes i fanen som blir stående; i fri visning fortsetter
//     den i den nye fanen via URL-en (medOvertakelse).
//   • Samme fane: økta følger med over sidebyttet; før en kjøreplan spilles,
//     spør vinduet og sender det samlede først.
function gaaTilVisning(url, { spiller = false } = {}) {
  const ø = aktivSamleokt();
  if (/teacher\.html$/.test(window.location.pathname)) {
    window.open(ø && !spiller ? medOvertakelse(url) : url, "_blank", "noopener");
    if (ø) {
      avsluttInnsamling();
      msg(spiller
        ? `Samleøkta på «${ø.tittel}» er avsluttet, og stoppene lagres.`
        : `Samleøkta på «${ø.tittel}» fortsetter i visningsfanen.`);
    }
    return;
  }
  if (!spiller) { window.location.href = url; return; }
  return forlatSamleokt().then((videre) => { if (videre) window.location.href = url; });
}

// Venter på et løfte, men aldri lenger enn `ms`: uten nett blir en Firestore-
// skriving liggende i kø (lokalt lagret) og løftet svarer først når nettet
// er tilbake.
const medFrist = (lovnad, ms) => Promise.race([lovnad, new Promise((r) => setTimeout(r, ms))]);

// Spør, avslutt og send det som er samlet, før visningen tar over fanen.
// true = gå videre.
async function forlatSamleokt() {
  const ø = aktivSamleokt();
  if (!ø) return true;
  const videre = await askChoice({
    title: "Samleøkta står på",
    text: `Du samler stopp i «${ø.tittel}». Mens en kjøreplan spilles, tas ingenting opp, så økta avsluttes først. Stoppene du har samlet, blir lagret.`,
    buttons: [
      { label: "Avslutt samleøkta og start", value: true, className: "primary" },
      { label: "Avbryt", value: false },
    ],
    dismissValue: false,
  });
  if (!videre) return false;
  await medFrist(avsluttInnsamling(), 4000);
  return true;
}

// ----------------------------------------------------------------------------
//  Rendering
// ----------------------------------------------------------------------------

function renderListe() {
  const el = document.getElementById("pres-adm-liste");
  if (!el) return;
  const s = getState();
  const aktiv = aktivPlanId();
  const samles = aktivSamleokt()?.planId;
  const bygges = aktivPlan();
  const lastet = !!s.contentLoaded;
  // Plansjekken (v5.75) teller først når listene et stopp slås opp i, har
  // landet; ellers ville hvert artiststopp meldt «finnes ikke» et øyeblikk.
  const dataKlar = !!(s.artistsLoaded && s.techLoaded);
  const tomTekst = !s.contentLoaded ? "Laster kjøreplanene …"
    : erLaerer ? "Ingen kjøreplaner ennå. Lag den første under."
    : "Ingen kjøreplaner ennå.";
  const rad = ([id, p]) => {
    const merker = [`${p.stopp.length} stopp`];
    // En time (v6.10, U1) har en dato; den står først.
    if (p.dato) merker.unshift(new Date(`${p.dato}T12:00:00`).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" }));
    const dode = dataKlar ? dodeStopp(p) : 0;
    return `
      <div class="pres-adm-rad${id === aktiv ? " vis-aktiv-plan" : ""}">
        <span class="pres-adm-navn"><strong>${escapeHtml(p.tittel)}</strong>
          <span class="muted">${escapeHtml(merker.join(" · "))}${id === aktiv ? " · spilles nå" : ""}${id === samles ? " · samles nå" : ""}${id === bygges ? " · bygges på" : ""}</span>${
          dode ? ` <span class="pres-adm-feil" title="Åpne Rediger for å se hvilke">${dode} ${dode === 1 ? "stopp finnes" : "stopp finnes"} ikke lenger</span>` : ""}</span>
        <span class="pres-adm-knapper">
          <button type="button" class="btn ${erLaerer ? "ghost" : "primary"} small" data-pres-spill="${escapeHtml(id)}">Spill av</button>
          <button type="button" class="btn ghost small utskrift-ikonknapp" data-pres-utskrift="${escapeHtml(id)}" title="Kjøreplanen til utskriften (PDF)" aria-label="Kjøreplanen til utskriften">${TIL_UTSKRIFT_SVG}</button>
          ${erLaerer ? `
          ${id === bygges
            ? `<button type="button" class="btn primary small" data-pres-bygg-ferdig="1" title="Slutt å bygge på denne planen">Ferdig med å bygge</button>`
            : `<button type="button" class="btn ghost small" data-pres-bygg="${escapeHtml(id)}" title="Gjør planen aktiv: visningsknappen på kortene legger til her med ett klikk">Bygg på</button>`}
          <button type="button" class="btn ghost small" data-pres-samle="${escapeHtml(id)}" title="Ta opp alt du åpner som stopp, til du trykker Ferdig">Ta opp</button>
          <button type="button" class="btn ghost small" data-pres-rediger="${escapeHtml(id)}">Rediger</button>
          <button type="button" class="btn ghost small" data-pres-dupliser="${escapeHtml(id)}" title="Lag en kopi, for eksempel til neste kull">Dupliser</button>
          <label class="vis-del" title="Vis planen for studentene under «Fra timene» på forsiden og i Spillelister"><input type="checkbox" data-pres-del="${escapeHtml(id)}"${p.delt ? " checked" : ""}> Del med studentene</label>
          <button type="button" class="btn ghost small danger" data-pres-slett="${escapeHtml(id)}">Slett</button>` : ""}
        </span>
      </div>`;
  };
  // Gruppene (v7.15) står først, hver som en nedtrekk med trekant, nyeste
  // gruppe øverst; planene uten gruppe etter dem. Nyeste plan først (v5.75):
  // et semester av planer leses bedre i tidsrekkefølge enn alfabetisk.
  const { grupper, uten } = grupperPlaner(planerNaa());
  const lukket = lukkedeGrupper();
  el.innerHTML = `
    ${grupper.map((g) => `
    <details class="vis-gruppe" data-gruppe="${escapeHtml(g.navn)}"${lukket.has(g.navn) ? "" : " open"}>
      <summary><span class="vis-gruppe-hode"><strong>${escapeHtml(g.navn)}</strong> <span class="muted">${escapeHtml(planTelling(g.planer))}</span></span>${erLaerer ? `
        <span class="pres-adm-knapper">
          <button type="button" class="btn ghost small" data-gruppe-oversikt="${escapeHtml(g.navn)}" title="Hva planene i gruppen har vist til sammen, og hva de ikke har vist">Gått gjennom</button>
          <button type="button" class="btn ghost small" data-gruppe-navn="${escapeHtml(g.navn)}">Gi nytt navn</button>
        </span>` : ""}</summary>
      ${g.planer.map(rad).join("")}
    </details>`).join("")}
    ${grupper.length && uten.length ? `<h4 class="vis-uten-gruppe">Uten gruppe</h4>` : ""}
    ${uten.map(rad).join("")}
    ${!grupper.length && !uten.length ? `<p class="muted">${tomTekst}</p>` : ""}
    ${erLaerer ? `
    <div class="add-actions" style="margin-top:10px">
      <button type="button" class="btn primary small" id="pres-adm-ny" ${lastet ? "" : "disabled"}>Ny kjøreplan</button>
      <button type="button" class="btn ghost small" id="pres-adm-ny-samle" title="Lag en ny plan og bygg på den mens du blar" ${lastet ? "" : "disabled"}>Ny + bygg på …</button>
    </div>
    <p class="muted vis-tips">Raskest: «Bygg på» en plan, så legger visningsknappen på kortene, plussknappen på radene og tasten + kortet rett inn med ett klikk. Pila ved knappen gir menyen med de andre planene. Under Rediger legger du planen i en gruppe, for eksempel «Klassen høst 2026».</p>`
    : `<p class="muted vis-tips">Logg inn som lærer i denne nettleseren for å lage og endre kjøreplaner.</p>`}`;
  renderUlagrede();
  // Står visningen alt på, kan den avsluttes herfra.
  const paa = document.getElementById("vis-paa");
  if (paa) paa.hidden = !erPresentasjon();
}

// --- Gruppene (v7.15) ----------------------------------------------------------
// Hvilke grupper som er lukket, huskes i nettleseren (bare for den som ser på).
const LUKKET_NOKKEL = "pensum-vis-lukkede-grupper";
function lukkedeGrupper() {
  try {
    const l = JSON.parse(localStorage.getItem(LUKKET_NOKKEL) || "[]");
    return new Set(Array.isArray(l) ? l.filter((x) => typeof x === "string") : []);
  } catch (e) { return new Set(); }
}
function huskLukket(navn, lukket) {
  const sett = lukkedeGrupper();
  if (lukket) sett.add(navn); else sett.delete(navn);
  try { localStorage.setItem(LUKKET_NOKKEL, JSON.stringify([...sett])); } catch (e) { /* huskes ikke */ }
}

async function gruppeNyttNavn(gammel) {
  const svar = await sporTekst("Planene i gruppen får det nye navnet. Har en annen gruppe det navnet, slås de sammen.", gammel,
    { tittel: "Gi gruppen nytt navn", ok: "Gi nytt navn", forslag: gruppeNavn(planerNaa()).filter((g) => g !== gammel) });
  if (svar === null) return;
  const ny = normaliserGruppe(svar);
  if (ny === gammel) return;
  if (!ny && !(await bekreft("Planene blir liggende, men uten gruppe.", { tittel: `Ta planene ut av «${gammel}»?`, ja: "Ta ut av gruppen" }))) return;
  if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
  const ids = Object.entries(planerNaa()).filter(([, p]) => p.gruppe === gammel).map(([id]) => id);
  if (!ids.length) return;
  // Én skriving for hele gruppen: én lesing per tilkoblet student, ikke én per plan.
  if (!(await vakt(savePlaner(Object.fromEntries(ids.map((id) => [id, { gruppe: ny || null }])))))) return;
  if (ny && lukkedeGrupper().has(gammel)) { huskLukket(gammel, false); huskLukket(ny, true); }
  msg(ny ? `Gruppen heter nå «${ny}».` : "Planene er tatt ut av gruppen.");
}

// --- Visninger som ikke ble lagret (v7.15) --------------------------------------
// Sikkerhetskopiene (js/visning/visningskopi.js): en visning som ble lukket uten
// Avslutt. Står over kjøreplanene, med «Lagre som time» og «Forkast».
const naarTekst = (k) => {
  const t = Date.parse(k.start || k.oppdatert);
  return Number.isFinite(t)
    ? new Date(t).toLocaleString("nb-NO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "Ukjent tidspunkt";
};
const kopiPlan = (k) => (k.plan ? planerNaa()[k.plan] || null : null);
function kopiBeskrivelse(k) {
  const p = kopiPlan(k);
  return `${k.stopp.length} kort vist${p ? `, fra kjøreplanen «${p.tittel}»` : ""}${k.avkortet ? " (bare de første fikk plass)" : ""}`;
}

function renderUlagrede() {
  const el = document.getElementById("vis-ulagrede");
  if (!el) return;
  const liste = erLaerer ? ulagrede() : [];
  el.hidden = !liste.length;
  if (!liste.length) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <h3 class="vis-hode">Ikke lagret</h3>
    <p class="muted vis-tips">Visninger som ble lukket uten Avslutt. Det som ble vist, ble tatt vare på underveis.</p>
    ${liste.map((k) => `
    <div class="pres-adm-rad">
      <span class="pres-adm-navn"><strong>${escapeHtml(naarTekst(k))}</strong>
        <span class="muted">${escapeHtml(kopiBeskrivelse(k))}${erFersk(k) ? " · kan fortsatt pågå et annet sted" : ""}</span></span>
      <span class="pres-adm-knapper">
        <button type="button" class="btn primary small" data-kopi-lagre="${escapeHtml(k.okt)}">Lagre som time</button>
        <button type="button" class="btn ghost small danger" data-kopi-forkast="${escapeHtml(k.okt)}">Forkast</button>
      </span>
    </div>`).join("")}`;
}

async function lagreKopi(k) {
  if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
  const p = kopiPlan(k);
  const dato = kopiDato(k);
  const forslag = p && p.tittel !== "(uten tittel)"
    ? p.tittel
    : `Time ${new Date(`${dato}T12:00:00`).toLocaleDateString("nb-NO", { day: "numeric", month: "long" })}`;
  let lagret = null;
  try {
    lagret = await lagreSomTime({ stopp: k.stopp, dato, tittelForslag: forslag, gruppeForslag: p?.gruppe || "" });
  } catch (err) {
    melding(`Fikk ikke lagret timen (${err?.message || err}). Visningen står fortsatt under «Ikke lagret».`);
    return;
  }
  if (!lagret) return;
  await slettKopi(k.okt).catch(() => {});
  melding(`Timen «${lagret.tittel}» er lagret${lagret.gruppe ? ` i gruppen «${lagret.gruppe}»` : ""}.`);
}

async function forkastKopi(k) {
  if (!(await bekreft("Det som ble vist, kan ikke hentes tilbake etterpå.", { tittel: `Forkaste visningen ${naarTekst(k)}?`, ja: "Forkast", farlig: true }))) return;
  try { await slettKopi(k.okt); } catch (err) { melding(`Fikk ikke forkastet visningen (${err?.message || err}).`); }
}

// Spør én gang per økt i nettleseren, når kopiene og planene har landet, og
// aldri midt i en visning (foran klassen). En kopi skrevet nylig kan høre til
// en visning som pågår et annet sted; den står bare i lista.
const SPURT_NOKKEL = "pensumKopiSpurt";
const spurtNaa = new Set();
let sporer = false;
async function sporOmKopier() {
  if (sporer || !erLaerer || erPresentasjon() || !kopierLastet() || !planeneLastet()) return;
  try { JSON.parse(sessionStorage.getItem(SPURT_NOKKEL) || "[]").forEach((o) => spurtNaa.add(o)); } catch (e) { /* bare minnet */ }
  const nye = ulagrede().filter((k) => !erFersk(k) && !spurtNaa.has(k.okt));
  if (!nye.length) return;
  nye.forEach((k) => spurtNaa.add(k.okt));
  try { sessionStorage.setItem(SPURT_NOKKEL, JSON.stringify([...spurtNaa])); } catch (e) { /* bare minnet */ }
  sporer = true;
  try {
    if (nye.length === 1) {
      const k = nye[0];
      const valg = await askChoice({
        title: "En visning ble ikke lagret",
        text: `Visningen ${naarTekst(k)} ble lukket uten Avslutt: ${kopiBeskrivelse(k)}. Vil du lagre den som en time?`,
        buttons: [
          { label: "Lagre som time", value: "lagre", className: "primary" },
          { label: "Forkast", value: "forkast" },
          { label: "Senere", value: "senere" },
        ],
        dismissValue: "senere",
      });
      if (valg === "lagre") await lagreKopi(k);
      else if (valg === "forkast") await forkastKopi(k);
    } else {
      const valg = await askChoice({
        title: `${nye.length} visninger ble ikke lagret`,
        text: "De ble lukket uten Avslutt. Det som ble vist, er tatt vare på, og du kan lagre dem som timer i Visning-vinduet.",
        buttons: [
          { label: "Åpne Visning", value: "se", className: "primary" },
          { label: "Senere", value: "senere" },
        ],
        dismissValue: "senere",
      });
      if (valg === "se") apneVisning();
    }
  } finally {
    sporer = false;
  }
}

// Står det «laster …» på et stopp, tegnes kladden på nytt når dataene lander.
let kladdVenter = false;

const GREP_SVG = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/></svg>';

function renderKladd() {
  const boks = document.getElementById("pres-adm-rediger");
  // Hele startdelen (fri visning og lista) viker for editoren.
  const liste = document.getElementById("vis-start");
  if (!boks) return;
  boks.hidden = !kladd;
  if (liste) liste.hidden = !!kladd;
  if (!kladd) return;

  const tittel = document.getElementById("pres-adm-tittel");
  if (tittel && tittel.value !== kladd.tittel) tittel.value = kladd.tittel;
  // Gruppen (v7.15): forslagene er gruppene som finnes.
  const gruppe = document.getElementById("pres-adm-gruppe");
  if (gruppe && gruppe.value !== kladd.gruppe) gruppe.value = kladd.gruppe || "";
  const grupper = document.getElementById("pres-adm-grupper");
  if (grupper) grupper.innerHTML = gruppeNavn(planerNaa()).map((g) => `<option value="${escapeHtml(g)}"></option>`).join("");

  const el = document.getElementById("pres-adm-stopp");
  kladdVenter = false;
  el.innerHTML = kladd.stopp.length ? kladd.stopp.map((s, i) => {
    const { tekst, feil, laster } = stoppEtikett(s);
    if (laster) kladdVenter = true;
    const nUnntak = Object.keys(s.unntak || {}).length;
    return `
    <div class="pres-adm-rad pres-adm-stopprad" draggable="true" data-pres-i="${i}">
      <span class="pres-adm-grep" title="Dra for å flytte">${GREP_SVG}</span>
      <span class="pres-adm-navn">${i + 1}. ${escapeHtml(tekst)}
        ${feil ? `<span class="pres-adm-feil">(${escapeHtml(feil)})</span>` : ""}${
        nUnntak ? ` <span class="muted">· ${nUnntak} unntak</span> <button type="button" class="pres-adm-lenkeknapp" data-pres-unntak="${i}" title="Fjern unntakene på dette stoppet, så nivået gjelder alene">fjern</button>` : ""}</span>
      <span class="pres-adm-knapper">
        <select data-pres-nivaa="${i}" title="Detaljnivå på dette stoppet" aria-label="Detaljnivå">
          <option value="">Nivå: uendret</option>
          ${[1, 2, 3].map((n) => `<option value="${n}" ${s.nivaa === n ? "selected" : ""}>Nivå ${n}: ${NIVAA_NAVN[n]}</option>`).join("")}
        </select>
        <button type="button" class="btn ghost small" data-pres-vis="${i}" title="Åpne stoppet oppå editoren, så du ser hva det er">Vis</button>
        <button type="button" class="btn ghost small" data-pres-opp="${i}" title="Flytt opp" aria-label="Flytt opp" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="btn ghost small" data-pres-ned="${i}" title="Flytt ned" aria-label="Flytt ned" ${i === kladd.stopp.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="btn ghost small danger" data-pres-fjern="${i}" title="Fjern stoppet" aria-label="Fjern stoppet">✕</button>
      </span>
    </div>`;
  }).join("") : `<p class="muted">Ingen stopp ennå. Søk under, eller finn fram i appen og trykk visningsknappen i kortets tittellinje.</p>`;
  tegnKladdSok();
  tegnPaminnelser();
}

// --- Påminnelser (v6.70, brukerbestilling 2026-10-11) -------------------------
// Lagres for seg i samlingen notater (js/visning/paminnelser.js), ikke i selve
// planen: planene ligger i content, som alle kan lese. Rader uten tekst
// lagres ikke.

function tegnPaminnelser() {
  const el = document.getElementById("pres-adm-pam");
  if (!el || !kladd) return;
  if (!kladd.pamLastet) { el.innerHTML = `<p class="muted">Laster påminnelsene …</p>`; return; }
  const feil = paminnelseFeil();
  const rader = kladd.paminnelser.map((p, i) => `
    <div class="pres-adm-pam-rad">
      <select data-pam-type="${i}" aria-label="Når påminnelsen kommer">
        <option value="etter" ${p.type !== "klokka" ? "selected" : ""}>Minutter etter start</option>
        <option value="klokka" ${p.type === "klokka" ? "selected" : ""}>Klokkeslett</option>
      </select>
      ${p.type === "klokka"
        ? `<input type="time" data-pam-kl="${i}" value="${escapeHtml(p.kl || "")}" aria-label="Klokkeslett" />`
        : `<input type="number" data-pam-min="${i}" min="0" max="600" step="1" value="${escapeHtml(String(p.min ?? ""))}" aria-label="Minutter etter start" />`}
      <label class="pres-adm-pam-lerret"><input type="checkbox" data-pam-lerret="${i}" ${p.lerret ? "checked" : ""} /> Vis også på lerretet</label>
      <button type="button" class="btn ghost small danger" data-pam-fjern="${i}" title="Fjern påminnelsen" aria-label="Fjern påminnelsen">✕</button>
      <textarea data-pam-tekst="${i}" rows="2" maxlength="1000" placeholder="Hva skal stå i påminnelsen?">${escapeHtml(p.tekst || "")}</textarea>
    </div>`).join("");
  el.innerHTML = (feil ? `<p class="pres-adm-feil">${escapeHtml(feil)}</p>` : "")
    + (rader || `<p class="muted">Ingen påminnelser i denne planen.</p>`);
}

// Påminnelsene lander etter at editoren ble åpnet: fyll kladden, så lenge
// læreren ikke alt har begynt å endre.
vedPaminnelseEndring(() => {
  if (!kladd || kladd.pamEndret) return;
  if (!kladd.pamLastet || !kladd.paminnelser.length) {
    kladd.paminnelser = paminnelserFor(kladd.id);
    kladd.pamLastet = true;
    tegnPaminnelser();
  }
});

// Gyldige påminnelser til lagring, eller en feilmelding.
function paminnelserTilLagring() {
  const liste = (kladd.paminnelser || []).filter((p) => String(p.tekst || "").trim());
  for (const [i, p] of liste.entries()) {
    const ok = p.type === "klokka" ? /^\d\d:\d\d$/.test(p.kl || "") : Number.isFinite(Number(p.min)) && Number(p.min) >= 0 && Number(p.min) <= 600;
    if (!ok) return { feil: `Påminnelse ${i + 1} mangler ${p.type === "klokka" ? "klokkeslett" : "antall minutter (0 til 600)"}.` };
  }
  if (paminnelserForLange(liste)) return { feil: "Påminnelsene har for mye tekst til sammen. Kort dem ned litt." };
  return { liste };
}

// --- Søk for å legge til stopp (v5.75) ----------------------------------------
// Samme indeks som søket i appen (js/felles/search.js) og samme mønster som
// utskriftssidens «Legg til». Treffene blir stopp med ett klikk; lim-inn-
// feltet består som reserve for lenker søket ikke dekker.

let kladdIndeks = null;
let kladdAvtrykk = "";

function kladdIndeksNaa() {
  const s = { ...getState(), slides: slider() };   // slidene (v7.06): tom liste utenfor en lærerøkt
  const avtrykk = [
    s.slides.map((x) => `${x.id}@${x.oppdatert}`).join(","),
    (s.artists || []).length, Object.keys(s.genreDescs || {}).length, (s.techItems || []).length,
    Object.keys(s.decadeDescs || {}).length, Object.keys(s.content || {}).length,
    Object.keys(s.edgeDescs || {}).length, !!s.isTeacher,
  ].join("|");
  if (!kladdIndeks || avtrykk !== kladdAvtrykk) {
    kladdIndeks = byggIndeks(s, { erLærer: !!s.isTeacher, skjul: SKJUL_I_STUDENTVISNING, skjulHub: SKJUL_I_HUBEN, visningsflater: true });
    kladdAvtrykk = avtrykk;
  }
  return kladdIndeks;
}

const MAKS_TREFF = 10;

function tegnKladdSok() {
  const felt = document.getElementById("pres-adm-sok");
  const ut = document.getElementById("pres-adm-sok-treff");
  if (!felt || !ut) return;
  const q = kladd ? felt.value.trim() : "";
  if (!q) { ut.innerHTML = ""; return; }
  const res = sok(kladdIndeksNaa(), q);
  if (res.forKort) { ut.innerHTML = `<p class="muted">Skriv minst to tegn.</p>`; return; }
  const iPlan = new Set(kladd.stopp.map((s) => s.vis));
  const sett = new Set();
  const treff = [];
  for (const t of res.grupper.flatMap((g) => g.treff)) {
    const vis = byggVisVerdi(t.apne);
    if (!vis || sett.has(vis)) continue;
    sett.add(vis);
    treff.push({ t, vis });
    if (treff.length >= MAKS_TREFF) break;
  }
  if (!treff.length) { ut.innerHTML = `<p class="muted">Ingen treff på «${escapeHtml(q)}» som kan bli et stopp.</p>`; return; }
  ut.innerHTML = treff.map(({ t, vis }) => `<button type="button" class="pres-adm-treff${iPlan.has(vis) ? " er-med" : ""}" data-pres-legg="${escapeHtml(vis)}">
      <span class="pres-adm-treff-type">${escapeHtml(TYPE_LABEL[t.type] || t.type)}</span>
      <span class="pres-adm-treff-navn">${escapeHtml(t.tittel)}${t.sti ? ` <span class="muted">${escapeHtml(t.sti)}</span>` : ""}</span>
      <span class="pres-adm-treff-merke">${iPlan.has(vis) ? "i planen · legg til igjen" : "Legg til"}</span>
    </button>`).join("");
}

// ----------------------------------------------------------------------------
//  Handlinger
// ----------------------------------------------------------------------------

async function lagre() {
  if (!kladd) return;
  const tittel = document.getElementById("pres-adm-tittel")?.value.trim();
  if (!tittel) { msg("Kjøreplanen trenger en tittel.", false); return; }
  if (!kladd.stopp.length) { msg("Legg til minst ett stopp før du lagrer.", false); return; }
  if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }   // kladden beholdes
  // Stopp lagt til planen mens editoren sto åpen, tas med sist i stedet for
  // å bli skrevet over (audit v5.93 funn 5).
  const lagtTil = stoppLagtTilSiden(kladd.grunnlag, planerNaa()[kladd.id]?.stopp, kladd.stopp);
  const plan = {
    tittel,
    laget: planerNaa()[kladd.id]?.laget || new Date().toISOString(),
    stopp: [...kladd.stopp, ...lagtTil],
    // Tomt felt tar planen ut av gruppen (null sletter feltet, v7.15).
    gruppe: normaliserGruppe(document.getElementById("pres-adm-gruppe")?.value || "") || null,
  };
  const pam = paminnelserTilLagring();
  if (pam.feil) { msg(pam.feil, false); return; }
  const id = kladd.id;
  const pamEndret = kladd.pamEndret;
  if (!(await vakt(savePlan(kladd.id, plan)))) return;   // kladden beholdes
  kladd = null;
  renderListe();
  renderKladd();
  if (pamEndret) {
    try {
      await lagrePaminnelser(id, pam.liste);
    } catch (err) {
      msg(`Kjøreplanen er lagret, men påminnelsene ble ikke lagret (${err?.message || err}).`, false);
      return;
    }
  }
  msg(lagtTil.length
    ? `Kjøreplanen er lagret. ${lagtTil.length === 1 ? "Ett stopp" : `${lagtTil.length} stopp`} som ble lagt til mens du redigerte, står sist i planen.`
    : "Kjøreplanen er lagret.");
}

function leggTilStopp() {
  const felt = document.getElementById("pres-adm-lenke");
  const vis = lesVisFraTekst(felt?.value);
  if (!vis) {
    msg("Fant ingen gyldig lenke. Bruk «Kopier lenke»-knappen i et kort, og lim inn hele adressen.", false);
    return;
  }
  kladd.stopp.push({ vis });
  felt.value = "";
  msg("");
  renderKladd();
  felt.focus();
}

// Flytter stoppet på plass `fra` til plass `til` i kladden (dra og slipp).
function flyttStopp(fra, til) {
  if (!kladd || fra === til || !(fra >= 0 && fra < kladd.stopp.length) || !(til >= 0 && til < kladd.stopp.length)) return;
  const [s] = kladd.stopp.splice(fra, 1);
  kladd.stopp.splice(til, 0, s);
  renderKladd();
}

// Opptak (v5.27, fra v5.76 uten modusvalg): alt læreren åpner blir stopp, i
// rekkefølge, til Ferdig i linja nede til venstre. Plukk-modusen er
// erstattet av den aktive kjøreplanen («Bygg på», js/visning/plan-meny.js), så
// dialogen er borte. Mens en kjøreplan spilles, tar opptaket ingenting opp
// (audit v5.42 funn 6), så da startes det ikke.
async function startOpptak(planId) {
  const navn = planerNaa()[planId]?.tittel;
  if (!navn) return;
  if (aktivPlanId()) {
    msg("Opptak virker ikke mens en kjøreplan spilles. Avslutt visningen eller bruk fri visning for å ta opp.", false);
    return;
  }
  const ok = await askChoice({
    title: `Ta opp til «${navn}»`,
    text: "Alt du åpner blir stopp, i rekkefølge, til du trykker Ferdig i linja nede til venstre. Vil du heller velge kort selv, bruk «Bygg på».",
    buttons: [{ label: "Start opptaket", value: true, className: "primary" }, { label: "Avbryt", value: false }],
    dismissValue: false,
  });
  if (!ok) return;
  // Opptaket og den aktive planen skal ikke fange samme klikk.
  settAktivPlan(null);
  startInnsamling(planId, "opptak", navn);
  const m = document.getElementById(MODAL_ID);
  if (m) modalClose(m);
}

// «Bygg på» (v5.76): planen blir den aktive, og vinduet lukkes så læreren
// kan finne fram i appen. Et opptak som står på, avsluttes først.
async function byggPaa(planId) {
  if (!planerNaa()[planId]) return;
  if (aktivSamleokt()) await medFrist(avsluttInnsamling(), 4000);
  settAktivPlan(planId);
  const m = document.getElementById(MODAL_ID);
  if (m) modalClose(m);
}

// ----------------------------------------------------------------------------
//  Vinduet
// ----------------------------------------------------------------------------

function byggModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="modal-backdrop" id="${MODAL_ID}">
  <div class="modal modal-wide modal-verktoy">
    <div class="modal-head">
      <h2>Visning</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="vis-start">
      <div class="vis-paa" id="vis-paa" hidden>
        <span>Visningen er på.</span>
        <button type="button" class="btn ghost small" id="vis-avslutt">Avslutt visning</button>
      </div>
      <div class="vis-fri">
        <button type="button" class="btn primary" id="vis-fri">Fri visning</button>
        <span class="muted">Vis det du finner underveis, uten kjøreplan. Søk med <kbd>S</kbd>.</span>
      </div>
      <div id="vis-ulagrede" class="vis-ulagrede" hidden></div>
      <h3 class="vis-hode">Kjøreplaner</h3>
      <div id="pres-adm-liste"></div>
    </div>
    <div id="pres-adm-rediger" hidden>
      <div class="add-grid pres-adm-hode">
        <label>Tittel *
          <input type="text" id="pres-adm-tittel" maxlength="80" placeholder="F.eks. Uke 39: Blues og gospel" />
        </label>
        <label>Gruppe
          <input type="text" id="pres-adm-gruppe" maxlength="${GRUPPE_MAKS}" list="pres-adm-grupper" autocomplete="off" placeholder="F.eks. Klassen høst 2026" />
          <datalist id="pres-adm-grupper"></datalist>
        </label>
      </div>
      <div id="pres-adm-stopp" style="margin-top:10px"></div>
      <p class="muted pres-adm-hint">Et oversiktskort over innholdet, gruppert etter artister, lytteeksempler, sjangre, tiår og så videre, legges automatisk først og sist i avspillingen. Dra radene for å endre rekkefølgen.</p>
      <div class="pres-adm-sok">
        <input type="search" id="pres-adm-sok" class="sok-felt" autocomplete="off" enterkeyhint="search"
          placeholder="Legg til stopp: søk etter artist, sjanger, tiår, innovasjon …" aria-label="Legg til stopp" />
        <div id="pres-adm-sok-treff" class="pres-adm-sok-treff" aria-live="polite"></div>
      </div>
      <div class="pres-adm-leggtil">
        <input type="text" id="pres-adm-lenke" placeholder="Eller lim inn en «Kopier lenke»-adresse …" autocomplete="off" />
        <button type="button" id="pres-adm-legg" class="btn ghost small">Legg til stopp</button>
      </div>
      <div class="pres-adm-pam">
        <h3 class="vis-hode">Påminnelser</h3>
        <p class="muted pres-adm-hint">Dukker opp når denne planen spilles: et antall minutter etter at du startet den, eller på et klokkeslett. De vises bare på din skjerm, med mindre du krysser av for lerretet. Navn på artister og sjangre blir lenker. En påminnelse som bare gjelder én visning, legger du inn underveis med tasten R.</p>
        <div id="pres-adm-pam"></div>
        <button type="button" id="pres-adm-pam-ny" class="btn ghost small">Legg til påminnelse</button>
      </div>
      <div class="add-actions" style="margin-top:14px">
        <button type="button" id="pres-adm-lagre" class="btn primary" title="Lagre (Ctrl/Cmd+S)">Lagre kjøreplanen</button>
        <button type="button" id="pres-adm-avbryt" class="btn ghost">Avbryt</button>
      </div>
    </div>
    <span id="pres-adm-msg" class="form-msg ok"></span>
  </div>
</div>`;
  const m = wrap.firstElementChild;
  document.body.appendChild(m);
  setupModal(m);
  initModalHeaders();
  koblVindu(m);
  return m;
}

// Åpner vinduet med lista (aldri midt i en gammel kladd).
export function apneVisning() {
  const m = document.getElementById(MODAL_ID) || byggModal();
  kladd = null;
  const sokFelt = document.getElementById("pres-adm-sok");
  if (sokFelt) sokFelt.value = "";
  renderListe();
  renderKladd();
  msg("");
  modalOpen(m);
}

// Kalles fra sidenes snapshot-hooks: lista holdes fersk når content lander
// MENS vinduet står åpent — men aldri midt i en redigering (kladden er
// lærerens, og skal ikke rykkes vekk).
export function visningTikk() {
  // Pilla for den aktive planen følger snapshotene (antall stopp, slettet
  // plan), uansett om vinduet står åpent.
  oppdaterAktiv();
  gjennomgangTikk();
  sporOmKopier();
  const m = document.getElementById(MODAL_ID);
  if (!m?.classList.contains("open")) return;
  // En åpen kladd tegnes bare på nytt når den venter på data (etiketter som
  // sier «laster …»); ellers skal ingenting rykke i lærerens redigering.
  if (kladd) { if (kladdVenter) renderKladd(); return; }
  renderListe();
}

// Oppstart på hver side: ikonet åpner vinduet i stedet for å følge lenka, og
// ?visning=1 (fra skjemasiden, eller et bokmerke) åpner det ved lasting.
export function initVisning() {
  document.querySelectorAll("[data-visning]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      apneVisning();
    });
  });
  onAuthChange((user) => {
    erLaerer = erLaererBruker(user);
    if (erLaerer) abonnerPaminnelser();
    visningTikk();
  });
  // Sikkerhetskopiene av visningene (v7.15): lista og spørsmålet om dem.
  startKopivakt({ unntatt: aktivOkt });
  vedKopiEndring(() => visningTikk());
  // «samles nå» følger økta: Ferdig i linja kan trykkes mens vinduet står åpent.
  vedSamleEndring(() => visningTikk());
  // «bygges på» følger den aktive planen (Ferdig i pilla nede til venstre).
  vedAktivPlanEndring(() => visningTikk());
  let vis = null;
  try { vis = new URLSearchParams(window.location.search).get("visning"); } catch (e) {}
  if (vis !== null) {
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("visning");
      window.history.replaceState(null, "", u);
    } catch (e) {}
    apneVisning();
  }
}

function koblVindu(m) {
  // Åpne og lukkede grupper huskes (toggle bobler ikke, derfor fanget her).
  m.addEventListener("toggle", (e) => {
    const d = e.target;
    if (d?.matches?.(".vis-gruppe")) huskLukket(d.dataset.gruppe, !d.open);
  }, true);

  // Ulagrede endringer skal ikke forsvinne på en bortkommen Escape. Fra
  // v6.25 spør appens egen dialog (svaret kommer etterpå): lukkingen avbrytes
  // først, og vinduet lukkes selv hvis læreren svarer ja (_skipBeforeClose).
  let sporLukk = false;
  m._beforeClose = () => {
    if (!kladd) return true;
    if (!sporLukk) {
      sporLukk = true;
      bekreft("Endringene i kjøreplanen går tapt.", { tittel: "Lukke uten å lagre?", ja: "Lukk uten å lagre", farlig: true })
        .then((ok) => {
          sporLukk = false;
          if (!ok) return;
          kladd = null;
          renderKladd();
          m._skipBeforeClose = true;
          modalClose(m);
        });
    }
    return false;
  };

  m.addEventListener("click", async (e) => {
    const hit = (sel) => e.target.closest(sel);

    if (hit("#vis-fri")) return gaaTilVisning("index.html?presentasjon=1");
    if (hit("#vis-avslutt")) return avsluttPresentasjon();

    // Gruppene (v7.15). Knappene står i nedtrekkens tittellinje, så klikket
    // skal ikke også åpne eller lukke gruppen.
    const oversikt = hit("[data-gruppe-oversikt]");
    if (oversikt) { e.preventDefault(); apneGjennomgang(oversikt.dataset.gruppeOversikt); return; }
    const nyttNavn = hit("[data-gruppe-navn]");
    if (nyttNavn) { e.preventDefault(); await gruppeNyttNavn(nyttNavn.dataset.gruppeNavn); return; }
    // Visningene som ikke ble lagret (v7.15).
    const kopiLagre = hit("[data-kopi-lagre]");
    const kopiForkast = hit("[data-kopi-forkast]");
    if (kopiLagre || kopiForkast) {
      const okt = (kopiLagre || kopiForkast).dataset[kopiLagre ? "kopiLagre" : "kopiForkast"];
      const k = ulagrede().find((x) => x.okt === okt);
      if (k) await (kopiLagre ? lagreKopi(k) : forkastKopi(k));
      return;
    }

    if (hit("#pres-adm-ny")) {
      if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
      kladd = { id: nyPlanId(), tittel: "", gruppe: "", stopp: [], paminnelser: [], pamLastet: true, pamEndret: false };
      renderKladd();
      document.getElementById("pres-adm-tittel")?.focus();
      return;
    }
    const rediger = hit("[data-pres-rediger]");
    if (rediger) {
      const id = rediger.dataset.presRediger;
      // Samles planen, avsluttes økta først (og det samlede sendes), så
      // kladden har med alt, og økta ikke skriver over redigeringen etterpå
      // (funn 3).
      if (aktivSamleokt()?.planId === id) {
        await medFrist(avsluttInnsamling(), 4000);
        msg("Samleøkta er avsluttet, så planen kan redigeres.");
      }
      const p = planerNaa()[id];
      if (!p) return;
      kladd = { id, tittel: p.tittel, gruppe: p.gruppe || "", stopp: p.stopp.map((s) => ({ ...s })), grunnlag: p.stopp.map((s) => s.vis), paminnelser: paminnelserFor(id), pamLastet: paminnelserLastet(), pamEndret: false };
      renderKladd();
      return;
    }
    // «Del med studentene» (v6.10, U1): merge på planer.<id>.delt, så resten
    // av planen står urørt. «Fra timene» vises for studentene først når
    // bryteren «Fra timene» er slått på (Skrivebordet, Synlig for studentene).
    const del = hit("[data-pres-del]");
    if (del) {
      savePlan(del.dataset.presDel, { delt: del.checked }).catch((err) => {
        del.checked = !del.checked;
        melding(`Fikk ikke lagret (${err?.message || err}).`);
      });
      return;
    }
    // Dupliser (v5.44, forslag 1 i audit v5.42): en kopi med alle stoppene,
    // nivåene og unntakene, som ny plan. Planene gjenbrukes fra år til år.
    const dupliser = hit("[data-pres-dupliser]");
    if (dupliser) {
      const id = dupliser.dataset.presDupliser;
      // Samles planen, avsluttes økta først, så kopien har med alt (som
      // Rediger): stopp som ennå ikke er sendt, ligger ikke i planen i state.
      if (aktivSamleokt()?.planId === id) await medFrist(avsluttInnsamling(), 4000);
      const p = planerNaa()[id];
      if (!p) return;
      if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
      const tittel = `Kopi av ${p.tittel}`.slice(0, 80);
      const kopi = { tittel, laget: new Date().toISOString(), stopp: p.stopp.map((x) => ({ ...x })) };
      if (!(await vakt(savePlan(nyPlanId(), kopi)))) return;
      msg(`Kjøreplanen er kopiert som «${tittel}».`);
      return;
    }
    const samle = hit("[data-pres-samle]");
    if (samle) return startOpptak(samle.dataset.presSamle);
    const bygg = hit("[data-pres-bygg]");
    if (bygg) return byggPaa(bygg.dataset.presBygg);
    if (hit("[data-pres-bygg-ferdig]")) { settAktivPlan(null); renderListe(); return; }
    // «Ny + bygg på …» (v5.76): planen skrives tom med en gang, så tilleggene
    // fra kortene har et dokument å gå til.
    if (hit("#pres-adm-ny-samle")) {
      if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
      const tittel = await sporTekst("Navn på den nye kjøreplanen:", "", { ok: "Lag kjøreplan" });
      if (!tittel || !tittel.trim()) return;
      const id = nyPlanId();
      if (!(await vakt(savePlan(id, { tittel: tittel.trim().slice(0, 80), laget: new Date().toISOString(), stopp: [] })))) return;
      await byggPaa(id);
      return;
    }
    // Kjøreplanen som hefte (v5.56): stoppene blir utvalget på utskrift.html,
    // i planens rekkefølge og med planens tittel. Står det noe i utskriften
    // fra før, velger man om planen erstatter eller legges til.
    const utskrift = hit("[data-pres-utskrift]");
    if (utskrift) {
      const id = utskrift.dataset.presUtskrift;
      const p = planerNaa()[id];
      if (!p) return;
      let erstatt = true;
      const fraFor = antallIUtskrift();
      if (fraFor) {
        const valg = await askChoice({
          title: "Kjøreplanen til utskriften",
          text: `Du har ${fraFor} kort i utskriften fra før.`,
          buttons: [
            { label: "Erstatt med kjøreplanen", value: "erstatt", className: "primary" },
            { label: "Legg til", value: "legg" },
            { label: "Avbryt", value: "avbryt" },
          ],
          dismissValue: "avbryt",
        });
        if (valg === "avbryt") return;
        erstatt = valg === "erstatt";
      }
      settFraPlan(p, getState().artists, id, { erstatt });
      window.location.href = "utskrift.html";
      return;
    }
    const spill = hit("[data-pres-spill]");
    if (spill) {
      // Uten ?stopp starter planen på oversiktskortet (v5.36).
      gaaTilVisning(`index.html?presentasjon=${encodeURIComponent(spill.dataset.presSpill)}`, { spiller: true });
      return;
    }
    const slett = hit("[data-pres-slett]");
    if (slett) {
      const id = slett.dataset.presSlett;
      const p = planerNaa()[id];
      if (!p || !(await bekreft("Dette kan ikke angres.", { tittel: `Slette kjøreplanen «${p.tittel}»?`, ja: "Slett", farlig: true }))) return;
      if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
      // Samleøkter på planen (også avsluttede som ikke er kommet fram)
      // forkastes: ellers ville neste lagring laget planen på nytt.
      forkastSamlinger(id);
      if (aktivPlan() === id) settAktivPlan(null);
      if (!(await vakt(deletePlan(id)))) return;
      // Påminnelsene til planen ryddes bort (de ligger i notater).
      if (paminnelserFor(id).length) lagrePaminnelser(id, []).catch(() => {});
      renderListe();
      msg("Kjøreplanen er slettet.");
      return;
    }

    if (!kladd) return;
    if (hit("#pres-adm-pam-ny")) {
      kladd.paminnelser.push({ id: `p${Date.now().toString(36)}`, type: "etter", min: 10, tekst: "", lerret: false });
      kladd.pamEndret = true;
      tegnPaminnelser();
      document.querySelector(`[data-pam-tekst="${kladd.paminnelser.length - 1}"]`)?.focus();
      return;
    }
    const pamFjern = hit("[data-pam-fjern]");
    if (pamFjern) {
      kladd.paminnelser.splice(Number(pamFjern.dataset.pamFjern), 1);
      kladd.pamEndret = true;
      tegnPaminnelser();
      return;
    }
    if (hit("#pres-adm-legg")) return leggTilStopp();
    if (hit("#pres-adm-lagre")) return lagre();
    if (hit("#pres-adm-avbryt")) {
      kladd = null;
      renderListe();
      renderKladd();
      msg("");
      return;
    }
    // Søketreff (v5.75): treffet blir et stopp sist i planen.
    const legg = hit("[data-pres-legg]");
    if (legg) {
      kladd.stopp.push({ vis: legg.dataset.presLegg });
      msg("");
      renderKladd();
      return;
    }
    // «Vis» (v5.75): åpne stoppet oppå editoren, så læreren ser hva det er.
    const vis = hit("[data-pres-vis]");
    if (vis) {
      const s = kladd.stopp[Number(vis.dataset.presVis)];
      if (s) apneMaal(parseVisVerdi(s.vis));
      return;
    }
    const unntak = hit("[data-pres-unntak]");
    if (unntak) {
      const s = kladd.stopp[Number(unntak.dataset.presUnntak)];
      if (s) { delete s.unntak; renderKladd(); }
      return;
    }
    const opp = hit("[data-pres-opp]");
    if (opp) {
      const i = Number(opp.dataset.presOpp);
      if (i > 0) [kladd.stopp[i - 1], kladd.stopp[i]] = [kladd.stopp[i], kladd.stopp[i - 1]];
      renderKladd();
      return;
    }
    const ned = hit("[data-pres-ned]");
    if (ned) {
      const i = Number(ned.dataset.presNed);
      if (i < kladd.stopp.length - 1) [kladd.stopp[i + 1], kladd.stopp[i]] = [kladd.stopp[i], kladd.stopp[i + 1]];
      renderKladd();
      return;
    }
    const fjern = hit("[data-pres-fjern]");
    if (fjern) {
      kladd.stopp.splice(Number(fjern.dataset.presFjern), 1);
      renderKladd();
      return;
    }
  });

  // Nivå-nedtrekket per stopp (change, ikke click).
  m.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-pres-nivaa]");
    if (!sel || !kladd) return;
    const i = Number(sel.dataset.presNivaa);
    const n = Number(sel.value);
    if (n >= 1 && n <= 3) kladd.stopp[i].nivaa = n;
    else delete kladd.stopp[i].nivaa;
  });

  // Dra og slipp i stopplista (v5.75). Pilene består for tastaturet.
  const stoppEl = m.querySelector("#pres-adm-stopp");
  let drar = null;
  stoppEl?.addEventListener("dragstart", (e) => {
    const rad = e.target.closest?.("[data-pres-i]");
    if (!rad || !kladd) return;
    drar = Number(rad.dataset.presI);
    rad.classList.add("pres-adm-drar");
    try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(drar)); } catch (x) {}
  });
  stoppEl?.addEventListener("dragover", (e) => {
    const rad = e.target.closest?.("[data-pres-i]");
    if (!rad || drar === null) return;
    e.preventDefault();
    stoppEl.querySelectorAll(".pres-adm-over").forEach((r) => { if (r !== rad) r.classList.remove("pres-adm-over"); });
    rad.classList.add("pres-adm-over");
  });
  stoppEl?.addEventListener("dragleave", (e) => {
    e.target.closest?.("[data-pres-i]")?.classList.remove("pres-adm-over");
  });
  stoppEl?.addEventListener("drop", (e) => {
    const rad = e.target.closest?.("[data-pres-i]");
    if (!rad || drar === null) return;
    e.preventDefault();
    const til = Number(rad.dataset.presI);
    const fra = drar;
    drar = null;
    flyttStopp(fra, til);
  });
  stoppEl?.addEventListener("dragend", () => {
    drar = null;
    stoppEl.querySelectorAll(".pres-adm-drar, .pres-adm-over").forEach((r) => r.classList.remove("pres-adm-drar", "pres-adm-over"));
  });

  // Søkefeltet i editoren (v5.75): treff mens man skriver.
  const sokFelt = m.querySelector("#pres-adm-sok");
  if (sokFelt) {
    let venter = null;
    sokFelt.addEventListener("input", () => { clearTimeout(venter); venter = setTimeout(tegnKladdSok, 130); });
    sokFelt.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(venter); tegnKladdSok(); } });
  }

  // Tittelen følger feltet: renderKladd (etter «Legg til stopp», ↑, ↓, ✕)
  // skrev ellers den gamle tittelen tilbake over det læreren hadde skrevet
  // (audit v5.42 funn 13).
  m.querySelector("#pres-adm-tittel")?.addEventListener("input", (e) => {
    if (kladd) kladd.tittel = e.target.value;
  });
  // Gruppen likeså (v7.15).
  m.querySelector("#pres-adm-gruppe")?.addEventListener("input", (e) => {
    if (kladd) kladd.gruppe = e.target.value;
  });

  // Påminnelsene (v6.70): feltene skriver rett i kladden; typebyttet tegner raden på nytt.
  const pamFelt = (e) => {
    if (!kladd) return;
    const t = e.target;
    const d = t.dataset || {};
    const p = (i) => kladd.paminnelser[Number(i)];
    if (d.pamTekst != null && p(d.pamTekst)) p(d.pamTekst).tekst = t.value;
    else if (d.pamMin != null && p(d.pamMin)) p(d.pamMin).min = t.value === "" ? "" : Number(t.value);
    else if (d.pamKl != null && p(d.pamKl)) p(d.pamKl).kl = t.value;
    else if (d.pamLerret != null && p(d.pamLerret)) p(d.pamLerret).lerret = t.checked;
    else if (d.pamType != null && p(d.pamType)) {
      const r = p(d.pamType);
      r.type = t.value;
      if (r.type === "klokka" && !r.kl) r.kl = "10:00";
      if (r.type === "etter" && (r.min === "" || r.min == null)) r.min = 10;
      kladd.pamEndret = true;
      tegnPaminnelser();
      return;
    } else return;
    kladd.pamEndret = true;
  };
  m.addEventListener("input", pamFelt);
  m.addEventListener("change", pamFelt);

  // Enter i lim-inn-feltet = «Legg til stopp» (raskere flyt med mange lenker).
  m.querySelector("#pres-adm-lenke")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (kladd) leggTilStopp(); }
  });

  // Ctrl/Cmd+S lagrer kladden (v5.38), også med markøren i tittelfeltet: det
  // er lagre-tastens vanlige betydning, og nettleserens «Lagre side» er aldri
  // det læreren mener her. Bare mens editoren står åpen med en kladd.
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (String(e.key || "").toLowerCase() !== "s") return;
    if (!kladd || !m.classList.contains("open")) return;
    e.preventDefault();
    lagre();
  });
}
