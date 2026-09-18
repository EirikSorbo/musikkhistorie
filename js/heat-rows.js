// ============================================================================
//  VARMEKART-RADER — aksen, radblokka og lærerens nivåvelger
// ----------------------------------------------------------------------------
//  Delt av to flater: varmekartet (alle sjangre, gruppert per metasjanger) og
//  sjangerhistoriene (familien til ÉN metasjanger, over fortellingen — v5.16).
//  Begge trenger nøyaktig samme rad: etikett som åpner sjangerkortet, én
//  sammenhengende stripe, og for læreren klikkbare tiårsceller. Lå tidligere
//  bare i explore-varmekart.js og ble flyttet hit da historiene skulle ha den
//  samme raden; to kopier ville drevet fra hverandre ved neste justering.
//
//  Fargen sendes inn (colorFor) i stedet for å slås opp her, så modulen slipper
//  å kjenne slektstreet. Samme grep som i heat-strip.js, og av samme grunn.
//
//  Modulen leser `opts` fra explore-context ved KALL-TID, aldri inn i en
//  modulnivå-konstant: explore-context importerer feature-modulene tilbake, så
//  bindingen er null når denne fila evalueres.
// ============================================================================

import { escapeHtml, modalOpen, modalClose } from "./ui.js?v=5.35";
import { DECADES } from "./limits.js?v=5.35";
import { opts, getState, onMainGenreClick } from "./explore-context.js?v=5.35";
import { heatRow, heatStripHtml, heatAxisHtml } from "./heat-strip.js?v=5.35";

// Sporene (etikett + stripe) settes i CSS på .vk-row/.vk-axisrow, ikke her:
// historiene trenger en smalere etikettkolonne enn varmekartet, og en
// innebygd stil kan ikke overstyres av en klasse.
//
// `klasse` merker flaten. Varmekartet er en egen utforskningsside og beholder
// den vannrette scrolleren med 600 px minstebredde (~35 px per tiår, det
// aksen trenger for alle tretten årstallene). Historiene sender «hist-heat»,
// som lar blokka krympe i stedet — se CSS-en for hvorfor.
export function heatBlockHtml(inner, klasse = "") {
  return `<div class="vk-scroll ${klasse}"><div class="vk-scroll-inner">${inner}</div></div>`;
}

// Aksehodet: en tom celle over etikettsporet, så den delte tiårsaksen. Samme
// grid som radene under, ellers glir årstallene ut av stilling.
export function heatAxisRowHtml() {
  return `<div class="vk-axisrow"><div></div>${heatAxisHtml()}</div>`;
}

// Radene for en liste sjangernavn, i den rekkefølgen kalleren sender dem.
// `meta` går kun inn i hjelpeteksten. `colorFor(sj)` gir radens farge.
export function heatRowsHtml(sjangre, { heat, meta, colorFor }) {
  return sjangre.map((sj) => {
    const farge = colorFor(sj);
    const vals = heatRow(heat, sj);
    // Raden er ett fremhevings-mål (.vk-row): båndet under pekeren må dekke
    // BÅDE etiketten og stripa, ellers hjelper det ikke å finne igjen linja.
    // Den loddrette luften ligger derfor som padding inni raden, ikke som
    // margin utenfor — margin ville falt utenfor båndet.
    let html = `<div class="vk-row">`;
    // Etiketten er en knapp: klikk åpner sjangerkortet (v4.83). Stripa er
    // lærerens redigeringsflate, så de to klikkmålene ligger side om side uten
    // å slåss om samme hendelse.
    html += `<button type="button" class="vk-rowlabel" data-vk-open="${escapeHtml(sj)}" title="Åpne sjangerkortet for ${escapeHtml(sj)}" style="font-size:0.82rem;color:var(--text);line-height:1.2;border-left:3px solid ${farge};padding:1px 8px 1px 9px">${escapeHtml(sj)}</button>`;
    // Stripa er den delte (heat-strip.js). Her byttes bare tiårsfeltene ut med
    // full hjelpetekst, og for læreren med klikkbare knapper.
    html += heatStripHtml(farge, vals, (v, i, pos) => {
      const t = `${sj}${meta ? ` · ${meta}` : ""} · ${DECADES[i]}-tallet${v != null ? ` · nivå ${v}/5` : " · ingen data"}${opts.onHeatEdit ? " · klikk for å endre" : ""}`;
      return opts.onHeatEdit
        ? `<button type="button" class="vk-cell" data-vk-genre="${escapeHtml(sj)}" data-vk-idx="${i}" title="${escapeHtml(t)}" style="${pos}"></button>`
        : `<div class="vk-cell" title="${escapeHtml(t)}" style="${pos}"></div>`;
    });
    return html + `</div>`;
  }).join("");
}

// Kobler radene i `root`. Kalles etter hver omtegning; lytterne følger
// elementene, så de forsvinner med dem.
export function wireHeatRows(root) {
  // Fremheving av én rad. Hover-enheter får den fra CSS; berøring har ingen
  // hover, så der låser et trykk raden i stedet (nytt trykk på samme rad slår
  // den av, trykk på en annen flytter den). Klikk oppfører seg likt på
  // pekerenheter — da kan man «feste» en rad mens man leser den.
  // Lærerens celleklikk lever videre ved siden av: begge lytterne får
  // hendelsen, så raden festes samtidig som nivåvelgeren åpnes.
  root.querySelectorAll(".vk-row").forEach((row) => {
    row.addEventListener("click", () => {
      const wasActive = row.classList.contains("is-active");
      root.querySelectorAll(".vk-row.is-active").forEach((r) => r.classList.remove("is-active"));
      if (!wasActive) row.classList.add("is-active");
    });
  });

  // Klikk på sjangernavnet åpner sjangerkortet — samme inngang som overalt
  // ellers (onMainGenreClick). Raden festes samtidig av lytteren over, så den
  // står uthevet når kortet lukkes igjen.
  root.querySelectorAll("[data-vk-open]").forEach((btn) => {
    btn.addEventListener("click", () => onMainGenreClick(btn.dataset.vkOpen));
  });

  // Lærer: klikk på en celle åpner nivåvelgeren.
  if (opts.onHeatEdit) {
    root.querySelectorAll(".vk-cell").forEach((cell) => {
      cell.addEventListener("click", () =>
        openHeatEdit(cell.dataset.vkGenre, Number(cell.dataset.vkIdx)));
    });
  }
}

// Nivåvelgeren (lærer): «Blues · 1950-tallet» med knappene 0–5 + «Ingen
// data». Lagring skjer via opts.onHeatEdit(sjanger, nyRad) — hele raden
// sendes, så datalaget slipper å kjenne tiårsindeksen. Snapshotet oppdaterer
// state.content → contentChanged() → begge flatene (varmekartet OG en åpen
// sjangerhistorie, v5.34) re-rendres bak velgeren.
export function openHeatEdit(genre, idx) {
  const modal = document.getElementById("modal-vk-edit");
  if (!modal) return;
  const heat = getState().content?.varmekart?.heat || {};
  const row = heatRow(heat, genre);
  const current = row[idx];
  document.getElementById("vke-title").textContent = `${genre} · ${DECADES[idx]}-tallet`;
  const msg = document.getElementById("vke-msg");
  msg.textContent = "";
  msg.className = "form-msg";
  const btns = document.getElementById("vke-buttons");
  btns.innerHTML = [0, 1, 2, 3, 4, 5].map((v) =>
    `<button type="button" class="btn ${current === v ? "primary" : "ghost"}" data-vke-level="${v}" style="min-width:44px">${v}</button>`
  ).join("") +
    `<button type="button" class="btn ${current == null ? "primary" : "ghost"}" data-vke-level="" style="flex:1">Ingen data</button>`;
  btns.querySelectorAll("[data-vke-level]").forEach((b) => {
    b.addEventListener("click", async () => {
      const level = b.dataset.vkeLevel === "" ? null : Number(b.dataset.vkeLevel);
      const newRow = row.slice();
      newRow[idx] = level;
      msg.textContent = "Lagrer …";
      msg.className = "form-msg ok";
      try {
        await opts.onHeatEdit(genre, newRow);
        modalClose(modal);
      } catch (err) {
        console.error("Varmekart-lagring feilet:", err);
        msg.textContent = "Feil: " + (err?.message || err);
        msg.className = "form-msg error";
      }
    });
  });
  modalOpen(modal);
}
