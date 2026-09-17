// ============================================================================
//  LÆRER — KJØREPLANER for presentasjonsvisningen (v5.25)
// ----------------------------------------------------------------------------
//  Editoren for content/presentasjoner: hver kjøreplan er en rekke stopp, og
//  hvert stopp er en ?vis=-verdi (samme som «Kopier lenke»-knappen lager).
//  Arbeidsflyten er nettopp den: finn fram i appen, kopier lenka, lim den inn
//  her som et stopp. Avspillingen bor i js/presentasjon.js.
//
//  Redigering skjer på en KLADD (dyp kopi) som først skrives ved Lagre —
//  setDoc uten merge, hele dokumentet (sletting av en plan krever det, se
//  savePresentasjoner). To faner som redigerer samtidig overskriver
//  hverandre; med én lærerkonto er det en akseptert enkelhet (samme som
//  podkast-admin).
// ============================================================================

import { state, guardTeacherAction, openAdminModal, closeAdminModal } from "./teacher-state.js?v=5.29";
import { escapeHtml } from "./ui.js?v=5.29";
import { savePresentasjoner } from "./store.js?v=5.29";
import { parseVisVerdi } from "./vis-lenke.js?v=5.29";
import { normaliserPlaner, nyPlanId, NIVAA_NAVN, ytMaal } from "./presentasjon-modell.js?v=5.29";
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES } from "./genre-model.js?v=5.29";
import { askChoice } from "./ui-modal.js?v=5.29";
import { startInnsamling } from "./plan-innsamling.js?v=5.29";

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
// Bare dokument- og navnebaserte mål kan sjekkes; visningene finnes alltid.
function stoppEtikett(stopp) {
  const m = parseVisVerdi(stopp.vis);
  if (!m) return { tekst: stopp.vis, feil: "ugyldig lenke" };
  const navn = TYPE_NAVN[m.hva] || m.hva;
  switch (m.hva) {
    case "artist": {
      const a = (state.artists || []).find((x) => x.id === m.id);
      return a ? { tekst: `${navn}: ${a.name}` } : { tekst: `${navn}: ${m.id}`, feil: "finnes ikke lenger" };
    }
    case "tech": {
      const t = (state.techItems || []).find((x) => x.id === m.id);
      return t ? { tekst: `${navn}: ${t.name}` } : { tekst: `${navn}: ${m.id}`, feil: "finnes ikke lenger" };
    }
    case "sjanger":
      return { tekst: `${navn}: ${m.id}`, feil: GENEALOGY_MAIN_GENRES.includes(m.id) ? "" : "finnes ikke lenger" };
    case "historie":
      if (!m.id) return { tekst: `${navn}: oversikten` };
      return { tekst: `${navn}: ${m.id}`, feil: GENEALOGY_META_GENRES.includes(m.id) ? "" : "finnes ikke lenger" };
    case "tiår":
      return { tekst: `${navn}: ${m.id}-tallet (${m.modus === "tech" ? "teknologi" : "samfunn"})` };
    // Lytteeksempel (v5.28): slå opp tittelen blant artistenes egne eksempler.
    case "yt": {
      for (const a of state.artists || []) {
        const eks = (a.musicExamples || []).find((x) => ytMaal(x.url || "")?.video === m.id);
        if (eks) return { tekst: `${navn}: ${eks.label || "(uten navn)"} (${a.name})` };
      }
      return { tekst: `${navn} (YouTube)` };
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
  return normaliserPlaner(state.content?.presentasjoner?.planer);
}

// ----------------------------------------------------------------------------
//  Rendering
// ----------------------------------------------------------------------------

function renderListe() {
  const el = document.getElementById("pres-adm-liste");
  if (!el) return;
  const planer = Object.entries(planerNaa())
    .sort(([, a], [, b]) => a.tittel.localeCompare(b.tittel, "no"));
  el.innerHTML = `
    ${planer.length ? planer.map(([id, p]) => `
      <div class="pres-adm-rad">
        <span class="pres-adm-navn"><strong>${escapeHtml(p.tittel)}</strong>
          <span class="muted">${p.stopp.length} stopp</span></span>
        <span class="pres-adm-knapper">
          <button type="button" class="btn ghost small" data-pres-spill="${escapeHtml(id)}">Spill av</button>
          <button type="button" class="btn ghost small" data-pres-samle="${escapeHtml(id)}" title="Legg til stopp mens du blar, eller ta opp alt du åpner">Samle</button>
          <button type="button" class="btn ghost small" data-pres-rediger="${escapeHtml(id)}">Rediger</button>
          <button type="button" class="btn ghost small danger" data-pres-slett="${escapeHtml(id)}">Slett</button>
        </span>
      </div>`).join("")
    : `<p class="muted">Ingen kjøreplaner ennå. Lag den første, så blir den tilgjengelig fra presentasjonsikonet.</p>`}
    <div class="add-actions" style="margin-top:10px">
      <button type="button" class="btn primary small" id="pres-adm-ny">Ny kjøreplan</button>
      <button type="button" class="btn ghost small" id="pres-adm-ny-samle" title="Lag en ny plan og fyll den mens du blar eller tar opp">Ny + samle …</button>
    </div>`;
}

function renderKladd() {
  const boks = document.getElementById("pres-adm-rediger");
  const liste = document.getElementById("pres-adm-liste");
  if (!boks) return;
  boks.hidden = !kladd;
  if (liste) liste.hidden = !!kladd;
  if (!kladd) return;

  const tittel = document.getElementById("pres-adm-tittel");
  if (tittel && tittel.value !== kladd.tittel) tittel.value = kladd.tittel;

  const el = document.getElementById("pres-adm-stopp");
  el.innerHTML = kladd.stopp.length ? kladd.stopp.map((s, i) => {
    const { tekst, feil } = stoppEtikett(s);
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
  const planer = planerNaa();
  planer[kladd.id] = {
    tittel,
    laget: planer[kladd.id]?.laget || new Date().toISOString(),
    stopp: kladd.stopp,
  };
  await guardTeacherAction(savePresentasjoner(planer));
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
  const modus = await askChoice({
    title: `Samle stopp i «${navn}»`,
    text: "Plukk: en plussknapp i kortenes tittellinje legger til det du velger. "
      + "Ta opp: alt du åpner blir stopp, i rekkefølge, til du trykker Ferdig i linja nede til venstre.",
    buttons: [
      { label: "Plukk mens jeg blar", value: "plukk", className: "primary" },
      { label: "Ta opp alt jeg åpner", value: "opptak" },
      { label: "Avbryt", value: null },
    ],
    dismissValue: null,
  });
  if (!modus) return;
  startInnsamling(planId || nyPlanId(), modus, navn);
  closeAdminModal("modal-presentasjoner");
}

export function openPresentasjonAdmin() {
  kladd = null;
  renderListe();
  renderKladd();
  msg("");
  openAdminModal("modal-presentasjoner");
}

// Lista holdes fersk når snapshotet lander MENS modalen står åpen — men aldri
// midt i en redigering (kladden er lærerens, og skal ikke rykkes vekk).
export function renderPresentasjonAdmin() {
  const m = document.getElementById("modal-presentasjoner");
  if (!m?.classList.contains("open") || kladd) return;
  renderListe();
}

export function setupPresentasjonAdmin() {
  const m = document.getElementById("modal-presentasjoner");
  if (!m) return;

  // Ulagrede endringer skal ikke forsvinne på en bortkommen Escape.
  m._beforeClose = () => {
    if (!kladd) return true;
    const ok = window.confirm("Du har ulagrede endringer i kjøreplanen. Lukke uten å lagre?");
    if (ok) { kladd = null; renderKladd(); }
    return ok;
  };

  m.addEventListener("click", async (e) => {
    const hit = (sel) => e.target.closest(sel);

    if (hit("#pres-adm-ny")) {
      kladd = { id: nyPlanId(), tittel: "", stopp: [] };
      renderKladd();
      document.getElementById("pres-adm-tittel")?.focus();
      return;
    }
    const rediger = hit("[data-pres-rediger]");
    if (rediger) {
      const id = rediger.dataset.presRediger;
      const p = planerNaa()[id];
      if (!p) return;
      kladd = { id, tittel: p.tittel, stopp: p.stopp.map((s) => ({ ...s })) };
      renderKladd();
      return;
    }
    const samle = hit("[data-pres-samle]");
    if (samle) return velgModusOgStart(samle.dataset.presSamle);
    if (hit("#pres-adm-ny-samle")) {
      const tittel = window.prompt("Navn på den nye kjøreplanen:", "");
      if (tittel && tittel.trim()) velgModusOgStart(null, tittel.trim());
      return;
    }
    const spill = hit("[data-pres-spill]");
    if (spill) {
      // Egen fane: presentasjonen skal på lerretet, lærersiden skal bestå.
      window.open(`index.html?presentasjon=${encodeURIComponent(spill.dataset.presSpill)}&stopp=1`, "_blank");
      return;
    }
    const slett = hit("[data-pres-slett]");
    if (slett) {
      const id = slett.dataset.presSlett;
      const p = planerNaa()[id];
      if (!p || !window.confirm(`Slette kjøreplanen «${p.tittel}»? Dette kan ikke angres.`)) return;
      const planer = planerNaa();
      delete planer[id];
      await guardTeacherAction(savePresentasjoner(planer));
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

  // Enter i lim-inn-feltet = «Legg til stopp» (raskere flyt med mange lenker).
  document.getElementById("pres-adm-lenke")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (kladd) leggTilStopp(); }
  });
}
