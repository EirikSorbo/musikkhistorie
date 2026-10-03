// ============================================================================
//  FRA TIMENE (v6.10, strukturgjennomgangen U1)
// ----------------------------------------------------------------------------
//  Timene læreren har delt: det som ble vist i en time («Lagre som time» når
//  visningen avsluttes, js/presentasjon.js), eller en kjøreplan med «Del med
//  studentene» på (Visning-vinduet). En time er en plan i
//  content/presentasjoner med dato og delt: true.
//
//  Studentene ser timene på forsiden og som en bolk i Lytt, men først når
//  bryteren «Fra timene» er slått på (feature-flags.js, Skrivebordet). Ingen
//  grense på antall kort (brukerkrav 2026-10-03).
//
//  Timen åpnes som en oversikt: kortene gruppert som på kjøreplanens
//  oversiktskort (planOversikt, testet), hvert kort åpnes oppå, og alle
//  lytteeksemplene fra timen kan spilles som én spilleliste.
// ============================================================================
import { escapeHtml, modalOpen, openEksemplerSpilleliste } from "./ui.js?v=6.18";
import { SKJUL_I_STUDENTVISNING } from "./feature-flags.js?v=6.18";
import { GENEALOGY } from "./genre-model.js?v=6.18";
import { normaliserPlaner, planOversikt, delteTimer, ytMaal } from "./presentasjon-modell.js?v=6.18";
import { parseVisVerdi } from "./vis-lenke.js?v=6.18";
import { opts, getState } from "./explore-context.js?v=6.18";
import { apneMaal } from "./explore-apne.js?v=6.18";
import { leggTilLyttBolk } from "./explore-lytt.js?v=6.18";

// Læreren (lærersiden) ser alltid timene; studentene når bryteren er på.
export function fraTimeneSynlig() {
  return !SKJUL_I_STUDENTVISNING.fraTimene || !!opts.onStoryEdit;
}

export function delteTimerNaa() {
  return delteTimer(normaliserPlaner(getState().content?.presentasjoner?.planer));
}

function datoTekst(dato) {
  if (!dato) return "";
  return new Date(`${dato}T12:00:00`).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
}

// Lytteeksemplene fra timen: eksemplene som ble spilt (yt-stopp), og alle
// eksemplene til artistene som ble vist. Hvert eksempel én gang.
export function timeEksempler(plan, artists) {
  const sett = new Set();
  const par = [];
  const legg = (a, m) => {
    const id = ytMaal(m.url)?.video || m.url;
    if (!m.url || sett.has(id)) return;
    sett.add(id);
    par.push({ a, m });
  };
  for (const s of plan.stopp || []) {
    const v = parseVisVerdi(s.vis);
    if (!v) continue;
    if (v.hva === "artist") {
      const a = (artists || []).find((x) => x.id === v.id);
      (a?.musicExamples || []).forEach((m) => legg(a, m));
    } else if (v.hva === "yt") {
      for (const a of artists || []) {
        const m = (a.musicExamples || []).find((x) => ytMaal(x.url)?.video === v.id);
        if (m) { legg(a, m); break; }
      }
    }
  }
  return par;
}

export function openTime(planId) {
  const modal = document.getElementById("modal-time");
  if (!modal) return;
  const s = getState();
  const plan = normaliserPlaner(s.content?.presentasjoner?.planer)[planId];
  if (!plan) return;
  modal.dataset.vis = `time:${planId}`;
  document.getElementById("tm-tittel").textContent = plan.tittel;
  const grupper = planOversikt(plan.stopp, {
    artister: s.artists,
    tech: s.techItems,
    nodeNavn: (id) => GENEALOGY.find((n) => n.id === id)?.l,
  });
  const par = timeEksempler(plan, s.artists);
  const body = document.getElementById("tm-body");
  body.innerHTML = `<p class="mo-tall">${escapeHtml([datoTekst(plan.dato), `${plan.stopp.length} kort`].filter(Boolean).join(" · "))}</p>`
    + (par.length ? `<p><button type="button" class="btn ghost small" data-tm-spill>Spill lytteeksemplene fra timen (${par.length})</button></p>` : "")
    + `<div class="sj-familier">${grupper.map((g) => `<section class="sj-familie"><div class="sj-fam-hode"><h3 class="sj-fam-navn">${escapeHtml(g.navn)}</h3><span class="sj-fam-tall">${g.punkter.length}</span></div>
        ${g.punkter.map((p) => `<button type="button" class="sj-rad" data-tm-vis="${escapeHtml(plan.stopp[p.stopp]?.vis || "")}"><span class="sj-rad-navn">${escapeHtml(p.tekst)}${p.detalj ? `<span class="sj-rad-aar">${escapeHtml(p.detalj)}</span>` : ""}</span></button>`).join("")}
      </section>`).join("")}</div>`;
  body.querySelector("[data-tm-spill]")?.addEventListener("click", () => openEksemplerSpilleliste(`Spilleliste: ${plan.tittel}`, par));
  body.querySelectorAll("[data-tm-vis]").forEach((b) => b.addEventListener("click", () => apneMaal(parseVisVerdi(b.dataset.tmVis))));
  modalOpen(modal);
}

// Radene for forsiden og Lytt: nyeste time først.
export function fraTimeneRaderHtml(timer) {
  return timer.map((t) => `<button type="button" class="sj-rad" data-time-id="${escapeHtml(t.id)}">
    <span class="sj-rad-navn">${escapeHtml(t.tittel)}${t.dato ? `<span class="sj-rad-aar">${escapeHtml(datoTekst(t.dato))}</span>` : ""}</span>
    <span class="sj-rad-aar">${t.stopp.length} kort</span>
  </button>`).join("");
}

// Lytt får en bolk «Fra timene» (spillelista fra hver time) når de er synlige.
leggTilLyttBolk((s) => {
  if (!fraTimeneSynlig()) return null;
  const timer = delteTimerNaa();
  if (!timer.length) return null;
  return {
    tittel: "Fra timene",
    rader: timer.map((t) => {
      const par = timeEksempler(t, s.artists);
      return { navn: t.tittel, antall: par.length, aapne: () => openEksemplerSpilleliste(`Spilleliste: ${t.tittel}`, par) };
    }).filter((r) => r.antall),
  };
});
