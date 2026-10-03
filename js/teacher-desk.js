// ============================================================================
//  LÆRER — SKRIVEBORD (arbeidsflyt øverst på lærersiden)
// ----------------------------------------------------------------------------
//  To deler: innboksen (nye artistforslag + endringsforslag → eksisterende
//  flater) og sjekk-fremdrift per innholdskategori (artistkort, sjangre,
//  undersjangre, sjangerhistorier, innovasjonskort, tiår (samfunn), tiår
//  (teknologi), sjangerkoblinger) —
//  x/y sjekket med utvidbar liste over de usjekkede. Artistkort sjekkes via
//  teacherChecked på artist-dokumentet; alle andre kategorier er navnelister
//  i config/teacherChecks (config/* er lærer-skrivbart, så ingen regelendring).
//
//  teacher.js kaller renderDesk() på nytt ved hvert relevante snapshot. Klikk
//  håndteres via el.onclick-TILORDNING (ikke addEventListener), så en re-render
//  ikke stabler lyttere. Åpne/lukkede lister overlever re-render via openPanels.
// ============================================================================

import { state, ctx, renderList, setContentCheck } from "./teacher-state.js?v=6.23";
import { modalOpen } from "./ui.js?v=6.23";
import { renderPendingEditsList } from "./teacher-review.js?v=6.23";
import { openDetail } from "./teacher-artists.js?v=6.23";
import { openSingleEdgeModal, openSingleDecadeModal } from "./teacher-content.js?v=6.23";
import { GENEALOGY_EDGES, GENEALOGY_MAIN_GENRES, edgeKey, isMainGenre, genreNodeById } from "./genre-model.js?v=6.23";
import { storyOrder } from "./story-format.js?v=6.23";
import { DECADES, isVisible, erTilModerasjon } from "./limits.js?v=6.23";
import { escapeHtml, pct } from "./ui-helpers.js?v=6.23";
import { deleteTimeforslag, savePage } from "./store.js?v=6.23";
import { synlighetVerdier } from "./feature-flags.js?v=6.23";
import { askChoice } from "./ui-modal.js?v=6.23";

const ICON = {
  artist: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

const byNo = (a, b) => a.localeCompare(b, "no");

// Node-oppslag for koblingsnavn (fra-id/til-id → lesbar etikett).

// Hvilke kategori-lister som står åpne — overlever re-render (hvert snapshot
// tegner Skrivebordet på nytt, og lista skal ikke klappe sammen midt i sjekkingen).
const openPanels = new Set();

// Kategoriene: universet (hva som SKAL sjekkes) regnes fra ferske data hver
// gang, sjekkstatus leses fra teacherChecks-feltet (eller teacherChecked for
// artister). Sjekk-knappen i lista skriver dit; «åpne» går til kategoriens
// naturlige visning (artistdetalj, sjanger-popup med Sjekk-knapp, osv.).
function buildCategories() {
  // Skjulte artistkort (prioritet -1) er tatt UT av universet (isVisible, samme
  // predikat som Oversikten og studentvisningene): de vises ikke for noen, og
  // skulle derfor verken telles som noe å sjekke eller ligge og lyse i
  // «Usjekkede». Undersjanger-universet leses fra de samme kortene.
  const active = state.artists.filter(isVisible);
  const checks = state.teacherChecks || {};
  const set = (field) => new Set(checks[field] || []);

  const subTags = [...new Set(active.flatMap((a) => [
    ...(a.mainGenre || []).filter((x) => !isMainGenre(x)),
    ...(a.subGenre || []),
  ]))].sort(byNo);

  const activeTech = state.techItems
    .filter((t) => (t.status || "active") === "active")
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
      // Historien ER metasjangerens innhold, så sjekken bor fortsatt i
      // teacherChecks.metaGenres — samme felt historie-modalens Sjekk-knapp
      // skriver til (explore-innhold.js). Kortet viser historiene, ikke
      // metasjangrene som helhet; universet er derfor storyOrder() = de
      // metasjangrene som HAR en historie (Pop/Rock er bevisst skjult og faller
      // ut). Nøkkelen «metaGenres» er beholdt fordi den ER sjekk-feltet.
      key: "metaGenres", label: "Sjangerhistorier",
      items: storyOrder(state.genreDescs).map((g) => ({ id: g, name: g })),
      checkedSet: set("metaGenres"),
    },
    {
      key: "tech", label: "Innovasjonskort",
      items: activeTech.map((t) => ({ id: t.id, name: t.name || "(uten navn)" })),
      checkedSet: set("tech"),
    },
    {
      key: "decades", label: "Tiår (samfunn)",
      items: DECADES.map((d) => ({ id: String(d), name: `${d}-tallet` })),
      checkedSet: set("decades"),
    },
    {
      key: "decadesTech", label: "Tiår (teknologi)",
      items: DECADES.map((d) => ({ id: String(d), name: `${d}-tallet` })),
      checkedSet: set("decadesTech"),
    },
    {
      key: "edges", label: "Sjangerkoblinger",
      items: GENEALOGY_EDGES.map((e) => ({
        id: edgeKey(e.from, e.to),
        name: `${genreNodeById(e.from)?.l || e.from} → ${genreNodeById(e.to)?.l || e.to}`,
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
    ? `<div class="desk-undo"><span class="desk-undo-l">Sjekket. Klikk for å angre:</span>${
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

  // Ventende OG returnerte — samme predikat som køen og lista, ellers
  // forsvinner innboks-kortet (eneste vei til koden) mens noe er hos studenten.
  const pendingArtists = state.artists.filter(erTilModerasjon).length;
  // Samme sum som endringsforslag-badgen: redigeringer + nye innovasjonskort.
  const pendingEdits = state.pendingEdits.length
    + state.techItems.filter(erTilModerasjon).length;

  const item = (icon, count, noun, action, active = false) => `
    <button type="button" class="desk-item${active ? " active" : ""}" data-desk="${action}"${active ? ` title="Viser ventende i lista. Klikk for å vise alle igjen"` : ""}>
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
    ${timeforslagHtml()}
    <div class="desk-grid">${cats.map(catCard).join("")}</div>
    ${synlighetHtml()}
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

    const sum = hit(".desk-synlighet > summary");
    if (sum) {
      const d = sum.parentElement;
      setTimeout(() => (d.open ? openPanels.add("synlighet") : openPanels.delete("synlighet")));
      return;
    }
    const syn = hit("[data-synlig]");
    if (syn && syn.matches("input")) return endreSynlighet(syn.dataset.synlig, syn.checked, syn);

    const slett = hit("[data-desk-time-slett]");
    if (slett) return slettTimeforslag(slett.dataset.deskTimeSlett);

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

// ---------------------------------------------------------------------------
//  SYNLIG FOR STUDENTENE (v6.10, strukturgjennomgangen U4)
// ---------------------------------------------------------------------------
//  Bryterne som før sto i js/feature-flags.js, nå i content/synlighet, så et
//  kort kan slippes fri uten kodeendring. Hver rad er én bryter for brukeren,
//  selv når den styrer flere flagg (sjangerhistoriene har to innganger, som
//  MÅ følge hverandre). Avhuket = synlig for studentene.
const SYNLIGHET_RADER = [
  { id: "historier", navn: "Sjangerhistoriene", student: ["metasjangerhistorier"], hub: ["sb-historier"] },
  { id: "koblinger", navn: "Koblingstekstene (i slektstreet og på sjangerkortet)", student: ["koblingsbeskrivelser"] },
  { id: "horEtter", navn: "«Hør etter» på sjangerkortene", student: ["horEtter"] },
  { id: "viktighet", navn: "Viktighetsgraden", student: ["viktighetsgrad"] },
  { id: "fraTimene", navn: "«Fra timene» (delte timer på forsiden og i Lytt)", student: ["fraTimene"] },
  { id: "omHistorie", navn: "Om historie", hub: ["sb-om-historie"] },
  { id: "rotter", navn: "Røtter", hub: ["sb-rotter"] },
  { id: "himmel", navn: "Sjangerhimmelen", hub: ["sb-himmel"] },
  { id: "referanser", navn: "Referanser", hub: ["sb-referanser"] },
  { id: "guide", navn: "Slik bruker du appen", hub: ["sb-guide"] },
  { id: "utskrift", navn: "Utskrift", student: ["utskrift"] },
  { id: "merking", navn: "Merking (stemming)", student: ["merking"] },
  { id: "punkter", navn: "Oppsummeringspunktene på kortene (ellers bare i visningen)", punkter: true },
];

// Nøklene panelet har en bryter for. Bare de lagres (v6.23, Fable F12):
// før skrev første lagring HELE standardobjektet, også nøklene uten bryter
// (storeBildet, de åpne hubkortene), og da slo en senere endring av
// standarden i feature-flags.js aldri gjennom for dem. savePage overskriver
// dokumentet, så gamle nøkler uten bryter forsvinner ved neste lagring.
const PANEL_STUDENT = [...new Set(SYNLIGHET_RADER.flatMap((r) => r.student || []))];
const PANEL_HUB = [...new Set(SYNLIGHET_RADER.flatMap((r) => r.hub || []))];

function synligNaa(v, rad) {
  if (rad.punkter) return !v.punkter;
  return [...(rad.student || []).map((k) => !v.student[k]), ...(rad.hub || []).map((k) => !v.hub[k])].every(Boolean);
}

function synlighetHtml() {
  const v = synlighetVerdier(state.content?.synlighet);
  // Åpen/lukket overlever omtegningen (hvert innholds-snapshot tegner på nytt).
  return `<details class="desk-synlighet"${openPanels.has("synlighet") ? " open" : ""}>
    <summary>Synlig for studentene</summary>
    <p class="muted desk-synlighet-hint">Avhuket er synlig for studentene. Du ser alltid alt selv.</p>
    <div class="desk-synlighet-liste">${SYNLIGHET_RADER.map((r) => `<label class="desk-synlighet-rad">
      <input type="checkbox" data-synlig="${r.id}"${synligNaa(v, r) ? " checked" : ""}> ${escapeHtml(r.navn)}</label>`).join("")}</div>
  </details>`;
}

async function endreSynlighet(id, synlig, boks) {
  const rad = SYNLIGHET_RADER.find((r) => r.id === id);
  if (!rad) return;
  const v = synlighetVerdier(state.content?.synlighet);
  if (rad.punkter) v.punkter = !synlig;
  (rad.student || []).forEach((k) => { v.student[k] = !synlig; });
  (rad.hub || []).forEach((k) => { v.hub[k] = !synlig; });
  const lagre = {
    student: Object.fromEntries(PANEL_STUDENT.map((k) => [k, v.student[k]])),
    hub: Object.fromEntries(PANEL_HUB.map((k) => [k, v.hub[k]])),
    punkter: v.punkter,
  };
  boks.disabled = true;
  try {
    await savePage("synlighet", lagre);
  } catch (e) {
    boks.checked = !synlig;
    alert(`Fikk ikke lagret (${e?.message || e}).`);
  } finally {
    boks.disabled = false;
  }
}

// Navn fra timen (v5.82): lærerens notater fra visningen (tasten L), til
// oppfølging. «Foreslå» åpner artistskjemaet med navnet fylt inn; «Fjern»
// sletter notatet. Bolken vises bare når det ligger noe der.
function timeforslagHtml() {
  const liste = state.timeforslag || [];
  if (!liste.length) return "";
  const dato = (iso) => {
    const d = new Date(iso || "");
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  };
  return `<div class="desk-time">
    <div class="desk-cat-top"><span class="desk-cat-h">Navn fra timene</span><span class="muted">${liste.length}</span></div>
    <ul class="desk-time-liste">${liste.map((p) => `<li class="desk-time-rad">
      <span class="desk-time-tekst"><b>${escapeHtml(p.artist || "")}</b>${p.student ? ` <span class="muted">· foreslått av ${escapeHtml(p.student)}</span>` : ""}
        <span class="muted desk-time-meta">${[dato(p.laget), p.kontekst].filter(Boolean).map((x) => escapeHtml(x)).join(" · ")}</span></span>
      <span class="desk-time-knapper">
        <a class="btn ghost small" href="student.html?navn=${encodeURIComponent(p.artist || "")}" title="Åpne artistskjemaet med navnet fylt inn">Foreslå</a>
        <button type="button" class="btn ghost small" data-desk-time-slett="${escapeHtml(p.id)}">Fjern</button>
      </span>
    </li>`).join("")}</ul>
  </div>`;
}

async function slettTimeforslag(id) {
  const p = (state.timeforslag || []).find((x) => x.id === id);
  const ok = await askChoice({
    title: "Fjerne notatet?",
    text: `«${p?.artist || ""}» tas ut av lista.`,
    buttons: [{ label: "Fjern", value: true, className: "primary" }, { label: "Avbryt", value: false }],
    dismissValue: false,
  });
  if (!ok) return;
  try {
    await deleteTimeforslag(id);
  } catch (e) {
    alert(`Fikk ikke fjernet notatet (${e?.message || e}).`);
  }
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
    // Sjangerhistorier: åpne historien selv (før: artistlista for sjangeren,
    // som ikke var det sjekken faktisk gjaldt). Historie-modalen har egen
    // Sjekk-knapp mot samme felt, så status holder seg i takt.
    case "metaGenres":
      ctx.explore?.openHistorier(id);
      break;
    case "tech": {
      const t = state.techItems.find((x) => x.id === id);
      if (t) ctx.explore?.openTechDetail(t);
      break;
    }
    // Åpner lærerens tiårsmodal rett på det aktuelle tiåret (før: generell
    // tiårsliste som ignorerte hvilken rad man klikket). Samfunn og teknologi
    // har hver sin sjekk-liste (to faner i samme tiårskort) — åpne modalen i
    // riktig modus.
    case "decades":
      openSingleDecadeModal(id, "society");
      break;
    case "decadesTech":
      openSingleDecadeModal(id, "tech");
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
