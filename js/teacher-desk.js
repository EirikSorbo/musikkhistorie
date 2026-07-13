// ============================================================================
//  LÆRER — SKRIVEBORD (arbeidsflyt øverst på lærersiden)
// ----------------------------------------------------------------------------
//  Samler det som venter på læreren (nye artistforslag + endringsforslag) og
//  fremdriften på pensumarbeidet (sjekkede kort + manglende innhold). Bygger
//  INGEN ny godkjenningsmekanikk — knappene fører til de eksisterende flatene:
//  ventende-filteret, endringsforslag-modalen og Oversikt.
//
//  teacher.js kaller renderDesk() på nytt ved hvert relevante snapshot. Klikk
//  håndteres via el.onclick-TILORDNING (ikke addEventListener), så en re-render
//  ikke stabler lyttere.
// ============================================================================

import { state, renderList, updatePendingBadge } from "./teacher-state.js?v=3.12";
import { contentGaps, modalOpen } from "./ui.js?v=3.12";
import { renderPendingEditsList } from "./teacher-review.js?v=3.12";
import { openOversikt } from "./teacher-artists.js?v=3.12";
import { pct } from "./ui-helpers.js?v=3.12";
import { $ } from "./shared.js?v=3.12";

const ICON = {
  artist: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

export function renderDesk(el) {
  if (!el) return;

  const pendingArtists = state.artists.filter((a) => a.status === "pending").length;
  // Samme sum som endringsforslag-badgen: redigeringer + nye innovasjonskort.
  const pendingEdits = state.pendingEdits.length
    + state.techItems.filter((t) => t.status === "pending").length;

  // «status: active» (uansett skjult/synlig) er sjekke-universet — matcher
  // teacherChecked-flagget og «Skjul sjekkede»-filteret på lista.
  const activeAll = state.artists.filter((a) => a.status === "active");
  const checked = activeAll.filter((a) => a.teacherChecked === true).length;
  const total = activeAll.length;
  const unchecked = total - checked;
  const gaps = contentGaps(state).total;

  const item = (icon, count, noun, action) => `
    <button type="button" class="desk-item" data-desk="${action}">
      <span class="desk-ic">${icon}</span>
      <span class="desk-item-l"><b>${count}</b> ${noun}</span>
    </button>`;

  const inbox = [
    pendingArtists
      ? item(ICON.artist, pendingArtists, pendingArtists === 1 ? "nytt artistforslag" : "nye artistforslag", "review-artists")
      : "",
    pendingEdits ? item(ICON.edit, pendingEdits, "endringsforslag", "review-edits") : "",
  ].filter(Boolean).join("");

  const inboxHtml = inbox
    ? `<div class="desk-inbox">${inbox}</div>`
    : `<div class="desk-clear">${ICON.check}<span>Ingenting venter — alt er behandlet.</span></div>`;

  el.innerHTML = `
    <p class="section-label">Skrivebord</p>
    <div class="desk-sub">Venter på deg</div>
    ${inboxHtml}
    <div class="desk-card">
      <div class="desk-card-h">Pensumarbeidet</div>
      <div class="desk-progress-row">
        <span class="desk-progress-n"><b>${checked}</b> / ${total}</span>
        <span class="desk-progress-l">artistkort sjekket</span>
      </div>
      <div class="bar"><div class="bar-fill" style="width:${pct(checked, total || 1)}%"></div></div>
      <div class="desk-actions">
        ${unchecked
          ? `<button type="button" class="btn ghost small" data-desk="show-unchecked">Usjekkede kort (${unchecked})</button>`
          : `<span class="desk-ok">Alle kort sjekket ✓</span>`}
        ${gaps
          ? `<button type="button" class="btn ghost small" data-desk="open-oversikt">Innhold som mangler (${gaps})</button>`
          : `<span class="desk-ok">Alt innhold på plass ✓</span>`}
      </div>
    </div>
  `;

  el.onclick = (e) => {
    const btn = e.target.closest("[data-desk]");
    if (!btn) return;
    const scrollToList = () =>
      document.getElementById("artist-list")?.scrollIntoView({ behavior: "smooth", block: "start" });

    switch (btn.dataset.desk) {
      case "review-artists":
        // Slå PÅ ventende-filteret (ikke toggle) og hopp til lista.
        state.filters.showPending = true;
        updatePendingBadge();
        renderList();
        scrollToList();
        break;
      case "review-edits":
        renderPendingEditsList();
        modalOpen(document.getElementById("modal-pending-edits"));
        break;
      case "show-unchecked": {
        state.filters.hideChecked = true;
        const cb = $("#f-hide-checked");
        if (cb) cb.checked = true;
        renderList();
        scrollToList();
        break;
      }
      case "open-oversikt":
        openOversikt();
        break;
    }
  };
}
