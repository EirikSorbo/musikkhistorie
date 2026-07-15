// ============================================================================
//  LÆRER — SKRIVEBORD (arbeidsflyt øverst på lærersiden)
// ----------------------------------------------------------------------------
//  To deler: innboksen (nye artistforslag + endringsforslag → eksisterende
//  flater) og sjekk-fremdrift per innholdskategori (artistkort, sjangre,
//  undersjangre, hovedsjangre, innovasjonskort, tiår, sjangerkoblinger) —
//  x/y sjekket med utvidbar liste over de usjekkede. Artistkort sjekkes via
//  teacherChecked på artist-dokumentet; alle andre kategorier er navnelister
//  i config/teacherChecks (config/* er lærer-skrivbart, så ingen regelendring).
//
//  teacher.js kaller renderDesk() på nytt ved hvert relevante snapshot. Klikk
//  håndteres via el.onclick-TILORDNING (ikke addEventListener), så en re-render
//  ikke stabler lyttere. Åpne/lukkede lister overlever re-render via openPanels.
// ============================================================================

import { state, ctx, renderList, setContentCheck } from "./teacher-state.js?v=3.57";
import { modalOpen } from "./ui.js?v=3.57";
import { renderPendingEditsList } from "./teacher-review.js?v=3.57";
import { openDetail } from "./teacher-artists.js?v=3.57";
import { openSingleEdgeModal, openSingleDecadeModal } from "./teacher-content.js?v=3.57";
import { GENEALOGY, GENEALOGY_EDGES, GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, edgeKey, isMainGenre } from "./genealogy.js?v=3.57";
import { DECADES } from "./limits.js?v=3.57";
import { escapeHtml, pct } from "./ui-helpers.js?v=3.57";

const ICON = {
  artist: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

const byNo = (a, b) => a.localeCompare(b, "no");

// Node-oppslag for koblingsnavn (fra-id/til-id → lesbar etikett).
const nodeById = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));

// Hvilke kategori-lister som står åpne — overlever re-render (hvert snapshot
// tegner Skrivebordet på nytt, og lista skal ikke klappe sammen midt i sjekkingen).
const openPanels = new Set();

// Kategoriene: universet (hva som SKAL sjekkes) regnes fra ferske data hver
// gang, sjekkstatus leses fra teacherChecks-feltet (eller teacherChecked for
// artister). Sjekk-knappen i lista skriver dit; «åpne» går til kategoriens
// naturlige visning (artistdetalj, sjanger-popup med Sjekk-knapp, osv.).
function buildCategories() {
  const active = state.artists.filter((a) => a.status === "active");
  const checks = state.teacherChecks || {};
  const set = (field) => new Set(checks[field] || []);

  const subTags = [...new Set(active.flatMap((a) => [
    ...(a.mainGenre || []).filter((x) => !isMainGenre(x)),
    ...(a.subGenre || []),
  ]))].sort(byNo);

  const activeTech = state.techItems
    .filter((t) => t.status !== "pending")
    .sort((a, b) => byNo(a.name || "", b.name || ""));

  return [
    {
      key: "artists", label: "Artistkort",
      items: [...active].sort((a, b) => byNo(a.name, b.name)).map((a) => ({ id: a.id, name: a.name })),
      checkedSet: new Set(active.filter((a) => a.teacherChecked === true).map((a) => a.id)),
    },
    {
      key: "genres", label: "Sjangre",
      items: GENEALOGY_MAIN_GENRES.map((g) => ({ id: g, name: g })),
      checkedSet: set("genres"),
    },
    {
      key: "subgenres", label: "Undersjangre",
      items: subTags.map((s) => ({ id: s, name: s })),
      checkedSet: set("subgenres"),
    },
    {
      key: "metaGenres", label: "Hovedsjangre",
      items: GENEALOGY_META_GENRES.map((g) => ({ id: g, name: g })),
      checkedSet: set("metaGenres"),
    },
    {
      key: "tech", label: "Innovasjonskort",
      items: activeTech.map((t) => ({ id: t.id, name: t.name || "(uten navn)" })),
      checkedSet: set("tech"),
    },
    {
      key: "decades", label: "Tiår",
      items: DECADES.map((d) => ({ id: String(d), name: `${d}-tallet` })),
      checkedSet: set("decades"),
    },
    {
      key: "edges", label: "Sjangerkoblinger",
      items: GENEALOGY_EDGES.map((e) => ({
        id: edgeKey(e.from, e.to),
        name: `${nodeById[e.from].l} → ${nodeById[e.to].l}`,
      })),
      checkedSet: set("edges"),
    },
  ];
}

function catCard(cat) {
  const total = cat.items.length;
  const checkedItems = cat.items.filter((it) => cat.checkedSet.has(it.id));
  const unchecked = cat.items.filter((it) => !cat.checkedSet.has(it.id));
  const open = openPanels.has(cat.key);

  const rows = unchecked.map((it) => `
    <div class="desk-row">
      <button type="button" class="desk-row-name" data-desk-open="${cat.key}" data-id="${escapeHtml(it.id)}">${escapeHtml(it.name)}</button>
      <button type="button" class="btn ghost small desk-row-check" data-desk-check="${cat.key}" data-id="${escapeHtml(it.id)}">Sjekk</button>
    </div>`).join("");

  // Angre-chips for kategoriene som ikke har egen sjekk-flate å angre i
  // (artistkort angres i detaljvisningen / lista).
  const undo = (cat.key !== "artists" && checkedItems.length)
    ? `<div class="desk-undo"><span class="desk-undo-l">Sjekket — klikk for å angre:</span>${
        checkedItems.map((it) =>
          `<button type="button" class="desk-undo-chip" data-desk-uncheck="${cat.key}" data-id="${escapeHtml(it.id)}">${escapeHtml(it.name)} ✕</button>`).join("")
      }</div>`
    : "";

  // Tittel + progresjonsstrek på samme rad (kompakt kort, 4 per rad); tallet +
  // «Usjekkede»-knappen på raden under.
  return `<div class="desk-cat">
    <div class="desk-cat-top">
      <span class="desk-cat-h" title="${escapeHtml(cat.label)}">${escapeHtml(cat.label)}</span>
      <span class="bar small"><span class="bar-fill" style="width:${pct(checkedItems.length, total || 1)}%"></span></span>
    </div>
    <div class="desk-cat-row">
      <span class="desk-cat-n"><b>${checkedItems.length}</b> / ${total}</span>
      ${unchecked.length
        ? `<button type="button" class="btn ghost small desk-cat-btn" data-desk-toggle="${cat.key}">${open ? "Skjul" : `Usjekkede (${unchecked.length})`}</button>`
        : `<span class="desk-ok">✓</span>`}
    </div>
    <div class="desk-cat-list" style="display:${open && unchecked.length ? "block" : "none"}">${rows}${undo}</div>
  </div>`;
}

export function renderDesk(el) {
  if (!el) return;

  const pendingArtists = state.artists.filter((a) => a.status === "pending").length;
  // Samme sum som endringsforslag-badgen: redigeringer + nye innovasjonskort.
  const pendingEdits = state.pendingEdits.length
    + state.techItems.filter((t) => t.status === "pending").length;

  const item = (icon, count, noun, action, active = false) => `
    <button type="button" class="desk-item${active ? " active" : ""}" data-desk="${action}"${active ? ` title="Viser ventende i lista — klikk for å vise alle igjen"` : ""}>
      <span class="desk-ic">${icon}</span>
      <span class="desk-item-l"><b>${count}</b> ${noun}</span>
    </button>`;

  const inbox = [
    pendingArtists
      ? item(ICON.artist, pendingArtists, pendingArtists === 1 ? "nytt artistforslag" : "nye artistforslag", "review-artists", state.filters.showPending)
      : "",
    pendingEdits ? item(ICON.edit, pendingEdits, "endringsforslag", "review-edits") : "",
  ].filter(Boolean).join("");

  const inboxHtml = inbox
    ? `<div class="desk-inbox">${inbox}</div>`
    : `<div class="desk-clear">${ICON.check}<span>Ingenting venter</span></div>`;

  const cats = buildCategories();
  // Rydd bort panel-tilstand for kategorier som ikke lenger har usjekkede.
  for (const c of cats) {
    if (!c.items.some((it) => !c.checkedSet.has(it.id))) openPanels.delete(c.key);
  }

  el.innerHTML = `
    <p class="section-label">Skrivebord</p>
    ${inboxHtml}
    <div class="desk-grid">${cats.map(catCard).join("")}</div>
  `;

  el.onclick = (e) => {
    const hit = (sel) => e.target.closest(sel);

    const tog = hit("[data-desk-toggle]");
    if (tog) {
      const key = tog.dataset.deskToggle;
      if (openPanels.has(key)) openPanels.delete(key); else openPanels.add(key);
      renderDesk(el);
      return;
    }

    const openBtn = hit("[data-desk-open]");
    if (openBtn) return openItem(openBtn.dataset.deskOpen, openBtn.dataset.id);

    const checkBtn = hit("[data-desk-check]");
    if (checkBtn) return checkItem(checkBtn.dataset.deskCheck, checkBtn.dataset.id, true);

    const uncheckBtn = hit("[data-desk-uncheck]");
    if (uncheckBtn) return checkItem(uncheckBtn.dataset.deskUncheck, uncheckBtn.dataset.id, false);

    const act = hit("[data-desk]");
    if (!act) return;
    switch (act.dataset.desk) {
      case "review-artists": {
        // Toggle: den gamle «Ventende»-knappen i filterraden er borte, så
        // kortet er nå eneste bryter — av-og-på her, auto-av i renderAll når
        // siste forslag er behandlet.
        const on = !state.filters.showPending;
        state.filters.showPending = on;
        renderList();
        renderDesk(el);
        if (on) document.getElementById("artist-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
      case "review-edits":
        renderPendingEditsList();
        modalOpen(document.getElementById("modal-pending-edits"));
        break;
    }
  };
}

// Åpne kategoriens naturlige visning for gjennomsyn før sjekk.
function openItem(key, id) {
  switch (key) {
    case "artists": {
      const a = state.artists.find((x) => x.id === id);
      if (a) openDetail(a);
      break;
    }
    // Sjanger-popupen har allerede Sjekk-knapp (addMainGenreCheckToggle) og
    // håndterer både tre-sjangre og frie undersjangre.
    case "genres":
    case "subgenres":
      ctx.explore?.onMainGenreClick(id);
      break;
    case "metaGenres":
      ctx.explore?.showArtistsForSjanger({ label: id });
      break;
    case "tech": {
      const t = state.techItems.find((x) => x.id === id);
      if (t) ctx.explore?.openTechDetail(t);
      break;
    }
    // Åpner lærerens tiårsmodal rett på det aktuelle tiåret (før: generell
    // tiårsliste som ignorerte hvilken rad man klikket).
    case "decades":
      openSingleDecadeModal(id, "society");
      break;
    case "edges": {
      const [from, to] = id.split("__");
      openSingleEdgeModal(from, to);
      break;
    }
  }
}

// Sjekk/angre. Artistkort bor på artist-dokumentet (toggleCheck), resten er
// navnelister i config/teacherChecks. Snapshotet tegner Skrivebordet på nytt.
function checkItem(key, id, on) {
  setContentCheck(key, id, on);
}
