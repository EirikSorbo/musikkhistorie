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
//  og avspillingen bor i js/presentasjon.js. Redigering skjer på en KLADD
//  (dyp kopi) som først skrives ved Lagre. Hver lagring og sletting rører
//  bare sin egen plan (savePlan/deletePlan, v5.43), og ingenting skrives før
//  planene har landet. To faner som redigerer SAMME plan samtidig
//  overskriver hverandre; med én lærerkonto er det en akseptert enkelhet
//  (samme som podkast-admin).
// ============================================================================

import { getState } from "./explore-context.js?v=5.59";
import { escapeHtml } from "./util.js?v=5.59";
import { onAuthChange, savePlan, deletePlan } from "./store.js?v=5.59";
import { parseVisVerdi } from "./vis-lenke.js?v=5.59";
import { normaliserPlaner, nyPlanId, NIVAA_NAVN, lytteeksempelNavn } from "./presentasjon-modell.js?v=5.59";
import { GENEALOGY, GENEALOGY_META_GENRES, edgeExists } from "./genre-model.js?v=5.59";
import { INSTRUMENT_TIMELINE_GROUPS, isVisible } from "./limits.js?v=5.59";
import { askChoice, modalOpen, modalClose, setupModal, initModalHeaders } from "./ui-modal.js?v=5.59";
import { startInnsamling, avsluttInnsamling, aktivSamleokt, medOvertakelse, vedSamleEndring, forkastSamlinger } from "./plan-innsamling.js?v=5.59";
import { erLaererBruker, planeneLastet } from "./plan-meny.js?v=5.59";
import { erPresentasjon, aktivPlanId, avsluttPresentasjon } from "./presentasjon.js?v=5.59";
import { settFraPlan, antall as antallIUtskrift } from "./utskrift-utvalg.js?v=5.59";

const MODAL_ID = "modal-visning";
let erLaerer = false;

const TYPE_NAVN = {
  artist: "Artist", sjanger: "Sjanger", undersjanger: "Undersjanger",
  historie: "Historie", tech: "Innovasjon", "tiår": "Tiår", side: "Side",
  instrument: "Instrument", kobling: "Kobling", tidslinje: "Tidslinje",
  varmekart: "Varmekart", sjangerperioder: "Sjangerperioder",
  himmel: "Sjangerhimmel", referanser: "Referanser",
  "store-bildet": "Det store bildet", podkaster: "Podkaster",
  teknologi: "Teknologi", slektstre: "Slektstre", yt: "Lytteeksempel",
};

let kladd = null;   // { id, tittel, stopp } — settes ved Ny/Rediger, null i lista

// Menneskelig etikett for et stopp, med «finnes ikke lenger»-varsel når målet
// er borte (slettet artist, omdøpt sjanger — navnebytte-fella fra planen).
// Alle navnebaserte mål sjekkes mot det åpneren faktisk slår opp i (audit
// v5.42 funn 8: røttene og Reggae ble meldt døde selv om de virket, mens et
// omdøpt varmekart, en undersjanger og en kobling aldri ble meldt). Mens
// artistene eller kortene laster, står det «laster …», ikke et falskt varsel.
// Alt leses ved kall: treet og vokabularet er live bindings.
const DOD = "finnes ikke lenger";

function stoppEtikett(stopp) {
  const m = parseVisVerdi(stopp.vis);
  if (!m) return { tekst: stopp.vis, feil: "ugyldig lenke" };
  const navn = TYPE_NAVN[m.hva] || m.hva;
  const s = getState();
  switch (m.hva) {
    case "artist": {
      const a = (s.artists || []).find((x) => x.id === m.id);
      if (a) return { tekst: `${navn}: ${a.name}` };
      return s.artistsLoaded ? { tekst: `${navn}: ${m.id}`, feil: DOD } : { tekst: `${navn}: laster …`, laster: true };
    }
    case "tech": {
      // Bare aktive kort: avspilleren på forsiden ser ikke ventende eller
      // returnerte kort (lærersidens state har dem med).
      const t = (s.techItems || []).find((x) => x.id === m.id && (x.status || "active") === "active");
      if (t) return { tekst: `${navn}: ${t.name}` };
      return s.techLoaded ? { tekst: `${navn}: ${m.id}`, feil: DOD } : { tekst: `${navn}: laster …`, laster: true };
    }
    // Sjangerkortet åpnes for ALLE noder i treet (også røttene), ikke bare
    // for dem med metasjanger.
    case "sjanger":
      return { tekst: `${navn}: ${m.id}`, feil: GENEALOGY.some((n) => n.l === m.id || n.f === m.id) ? "" : DOD };
    case "historie":
      if (!m.id) return { tekst: `${navn}: oversikten` };
      return { tekst: `${navn}: ${m.id}`, feil: GENEALOGY_META_GENRES.includes(m.id) ? "" : DOD };
    case "varmekart":
      if (!m.id) return { tekst: navn };
      return { tekst: `${navn}: ${m.id}`, feil: GENEALOGY_META_GENRES.includes(m.id) ? "" : DOD };
    case "undersjanger": {
      if (!s.artistsLoaded || !s.genreDescsLoaded) return { tekst: `${navn}: ${m.id}`, laster: true };
      // Som kortet: bare synlige artister, og uten hensyn til store og små
      // bokstaver.
      const lik = (x) => String(x).toLowerCase() === String(m.id).toLowerCase();
      const kjent = !!s.genreDescs?.[m.id]?.sub
        || (s.artists || []).some((a) => isVisible(a) && (a.subGenre || []).some(lik));
      return { tekst: `${navn}: ${m.id}`, feil: kjent ? "" : DOD };
    }
    case "kobling": {
      const [fra, til] = String(m.id || "").split("__");
      const nodeNavn = (id) => GENEALOGY.find((n) => n.id === id)?.l || id;
      return { tekst: `${navn}: ${nodeNavn(fra)} til ${nodeNavn(til)}`, feil: edgeExists(m.id) ? "" : DOD };
    }
    case "instrument":
      if (!m.id) return { tekst: navn };
      return { tekst: `${navn}: ${m.id}`, feil: INSTRUMENT_TIMELINE_GROUPS.includes(m.id) ? "" : DOD };
    case "tiår":
      return { tekst: `${navn}: ${m.id}-tallet (${m.modus === "tech" ? "teknologi" : "samfunn"})` };
    // Lytteeksempel (v5.28): slå opp tittelen blant artistenes egne eksempler.
    case "yt": {
      const tittel = lytteeksempelNavn(m.id, getState().artists);
      if (!tittel && !s.artistsLoaded) return { tekst: `${navn}: laster …`, laster: true };
      return { tekst: tittel ? `${navn}: ${tittel}` : `${navn} (YouTube)` };
    }
    default:
      return { tekst: m.id ? `${navn}: ${m.id}` : navn };
  }
}

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
  const planer = Object.entries(planerNaa())
    .sort(([, a], [, b]) => a.tittel.localeCompare(b.tittel, "no"));
  const aktiv = aktivPlanId();
  const samles = aktivSamleokt()?.planId;
  const lastet = !!s.contentLoaded;
  const tomTekst = !s.contentLoaded ? "Laster kjøreplanene …"
    : erLaerer ? "Ingen kjøreplaner ennå. Lag den første under."
    : "Ingen kjøreplaner ennå.";
  el.innerHTML = `
    ${planer.length ? planer.map(([id, p]) => `
      <div class="pres-adm-rad${id === aktiv ? " vis-aktiv-plan" : ""}">
        <span class="pres-adm-navn"><strong>${escapeHtml(p.tittel)}</strong>
          <span class="muted">${p.stopp.length} stopp${id === aktiv ? " · spilles nå" : ""}${id === samles ? " · samles nå" : ""}</span></span>
        <span class="pres-adm-knapper">
          <button type="button" class="btn ${erLaerer ? "ghost" : "primary"} small" data-pres-spill="${escapeHtml(id)}">Spill av</button>
          <button type="button" class="btn ghost small" data-pres-utskrift="${escapeHtml(id)}" title="Lag et hefte av kjøreplanen (utskrift eller PDF)">Til utskrift</button>
          ${erLaerer ? `
          <button type="button" class="btn ghost small" data-pres-samle="${escapeHtml(id)}" title="Legg til stopp mens du blar, eller ta opp alt du åpner">Samle</button>
          <button type="button" class="btn ghost small" data-pres-rediger="${escapeHtml(id)}">Rediger</button>
          <button type="button" class="btn ghost small" data-pres-dupliser="${escapeHtml(id)}" title="Lag en kopi, for eksempel til neste kull">Dupliser</button>
          <button type="button" class="btn ghost small danger" data-pres-slett="${escapeHtml(id)}">Slett</button>` : ""}
        </span>
      </div>`).join("")
    : `<p class="muted">${tomTekst}</p>`}
    ${erLaerer ? `
    <div class="add-actions" style="margin-top:10px">
      <button type="button" class="btn primary small" id="pres-adm-ny" ${lastet ? "" : "disabled"}>Ny kjøreplan</button>
      <button type="button" class="btn ghost small" id="pres-adm-ny-samle" title="Lag en ny plan og fyll den mens du blar eller tar opp" ${lastet ? "" : "disabled"}>Ny + samle …</button>
    </div>
    <p class="muted vis-tips">Raskest å bygge en plan: finn fram i appen og trykk lenkeknappen i kortets tittellinje. Menyen «Legg til som stopp i» legger kortet rett inn.</p>`
    : `<p class="muted vis-tips">Logg inn som lærer i denne nettleseren for å lage og endre kjøreplaner.</p>`}`;
  // Står visningen alt på, kan den avsluttes herfra.
  const paa = document.getElementById("vis-paa");
  if (paa) paa.hidden = !erPresentasjon();
}

// Står det «laster …» på et stopp, tegnes kladden på nytt når dataene lander.
let kladdVenter = false;

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

  const el = document.getElementById("pres-adm-stopp");
  kladdVenter = false;
  el.innerHTML = kladd.stopp.length ? kladd.stopp.map((s, i) => {
    const { tekst, feil, laster } = stoppEtikett(s);
    if (laster) kladdVenter = true;
    return `
    <div class="pres-adm-rad">
      <span class="pres-adm-navn">${i + 1}. ${escapeHtml(tekst)}
        ${feil ? `<span class="pres-adm-feil">(${escapeHtml(feil)})</span>` : ""}</span>
      <span class="pres-adm-knapper">
        <select data-pres-nivaa="${i}" title="Detaljnivå på dette stoppet" aria-label="Detaljnivå">
          <option value="">Nivå: uendret</option>
          ${[1, 2, 3].map((n) => `<option value="${n}" ${s.nivaa === n ? "selected" : ""}>Nivå ${n}: ${NIVAA_NAVN[n]}</option>`).join("")}
        </select>
        <button type="button" class="btn ghost small" data-pres-opp="${i}" title="Flytt opp" aria-label="Flytt opp" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="btn ghost small" data-pres-ned="${i}" title="Flytt ned" aria-label="Flytt ned" ${i === kladd.stopp.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="btn ghost small danger" data-pres-fjern="${i}" title="Fjern stoppet" aria-label="Fjern stoppet">✕</button>
      </span>
    </div>`;
  }).join("") : `<p class="muted">Ingen stopp ennå. Finn fram i appen, trykk lenkeknappen i kortets tittellinje, og lim inn under.</p>`;
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
  const plan = {
    tittel,
    laget: planerNaa()[kladd.id]?.laget || new Date().toISOString(),
    stopp: kladd.stopp,
  };
  if (!(await vakt(savePlan(kladd.id, plan)))) return;   // kladden beholdes
  kladd = null;
  renderListe();
  renderKladd();
  msg("Kjøreplanen er lagret.");
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

// Samleøkt (v5.27): velg modus, lukk editoren og la linja nede til venstre
// ta over. planId er null for «Ny + samle» — da genereres id her, og planen
// skrives først når det første stoppet legges til.
async function velgModusOgStart(planId, tittelForNy) {
  const navn = planId ? planerNaa()[planId]?.tittel : tittelForNy;
  if (!navn) return;
  // Mens en kjøreplan spilles, tar opptaket ingenting opp (funn 6), så valget
  // tilbys ikke da.
  const spilles = !!aktivPlanId();
  const modus = await askChoice({
    title: `Samle stopp i «${navn}»`,
    text: "Plukk: en plussknapp i kortenes tittellinje legger til det du velger. "
      + (spilles
        ? "Opptak virker ikke mens en kjøreplan spilles. Avslutt visningen eller bruk fri visning for å ta opp."
        : "Ta opp: alt du åpner blir stopp, i rekkefølge, til du trykker Ferdig i linja nede til venstre."),
    buttons: [
      { label: "Plukk mens jeg blar", value: "plukk", className: "primary" },
      ...(spilles ? [] : [{ label: "Ta opp alt jeg åpner", value: "opptak" }]),
      { label: "Avbryt", value: null },
    ],
    dismissValue: null,
  });
  if (!modus) return;
  startInnsamling(planId || nyPlanId(), modus, navn);
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
        <span class="muted">Vis det du finner underveis, uten kjøreplan. Søk med <kbd>/</kbd> eller Ctrl/Cmd+K.</span>
      </div>
      <h3 class="vis-hode">Kjøreplaner</h3>
      <div id="pres-adm-liste"></div>
    </div>
    <div id="pres-adm-rediger" hidden>
      <div class="add-grid" style="grid-template-columns:1fr">
        <label>Tittel *
          <input type="text" id="pres-adm-tittel" maxlength="80" placeholder="F.eks. Uke 39: Blues og gospel" />
        </label>
      </div>
      <div id="pres-adm-stopp" style="margin-top:10px"></div>
      <p class="muted pres-adm-hint">Et oversiktskort over innholdet, gruppert etter artister, lytteeksempler, sjangre, tiår og så videre, legges automatisk først og sist i avspillingen.</p>
      <div class="pres-adm-leggtil">
        <input type="text" id="pres-adm-lenke" placeholder="Lim inn en «Kopier lenke»-adresse …" autocomplete="off" />
        <button type="button" id="pres-adm-legg" class="btn ghost small">Legg til stopp</button>
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
  renderListe();
  renderKladd();
  msg("");
  modalOpen(m);
}

// Kalles fra sidenes snapshot-hooks: lista holdes fersk når content lander
// MENS vinduet står åpent — men aldri midt i en redigering (kladden er
// lærerens, og skal ikke rykkes vekk).
export function visningTikk() {
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
    visningTikk();
  });
  // «samles nå» følger økta: Ferdig i linja kan trykkes mens vinduet står åpent.
  vedSamleEndring(() => visningTikk());
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

  // Ulagrede endringer skal ikke forsvinne på en bortkommen Escape.
  m._beforeClose = () => {
    if (!kladd) return true;
    const ok = window.confirm("Du har ulagrede endringer i kjøreplanen. Lukke uten å lagre?");
    if (ok) { kladd = null; renderKladd(); }
    return ok;
  };

  m.addEventListener("click", async (e) => {
    const hit = (sel) => e.target.closest(sel);

    if (hit("#vis-fri")) return gaaTilVisning("index.html?presentasjon=1");
    if (hit("#vis-avslutt")) return avsluttPresentasjon();

    if (hit("#pres-adm-ny")) {
      if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
      kladd = { id: nyPlanId(), tittel: "", stopp: [] };
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
      kladd = { id, tittel: p.tittel, stopp: p.stopp.map((s) => ({ ...s })) };
      renderKladd();
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
    if (samle) return velgModusOgStart(samle.dataset.presSamle);
    if (hit("#pres-adm-ny-samle")) {
      if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
      const tittel = window.prompt("Navn på den nye kjøreplanen:", "");
      if (tittel && tittel.trim()) velgModusOgStart(null, tittel.trim());
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
      if (!p || !window.confirm(`Slette kjøreplanen «${p.tittel}»? Dette kan ikke angres.`)) return;
      if (!planeneLastet()) { msg(IKKE_LASTET, false); return; }
      // Samleøkter på planen (også avsluttede som ikke er kommet fram)
      // forkastes: ellers ville neste lagring laget planen på nytt.
      forkastSamlinger(id);
      if (!(await vakt(deletePlan(id)))) return;
      renderListe();
      msg("Kjøreplanen er slettet.");
      return;
    }

    if (!kladd) return;
    if (hit("#pres-adm-legg")) return leggTilStopp();
    if (hit("#pres-adm-lagre")) return lagre();
    if (hit("#pres-adm-avbryt")) {
      kladd = null;
      renderListe();
      renderKladd();
      msg("");
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

  // Tittelen følger feltet: renderKladd (etter «Legg til stopp», ↑, ↓, ✕)
  // skrev ellers den gamle tittelen tilbake over det læreren hadde skrevet
  // (audit v5.42 funn 13).
  m.querySelector("#pres-adm-tittel")?.addEventListener("input", (e) => {
    if (kladd) kladd.tittel = e.target.value;
  });

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
