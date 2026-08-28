import { fetchPendingEdits, voteUp, undoVoteUp, getClientId, onAuthChange } from "./store.js?v=4.85";
import { subscribeSharedData, sharedStateDefaults } from "./shared-data.js?v=4.85";
import { SKJUL_I_STUDENTVISNING } from "./feature-flags.js?v=4.85";
import { onGenreModelChanged } from "./genre-model.js?v=4.85";
import { instrumentsInUse, DECADES, isVisible, filterArtists, hasActiveFilters } from "./limits.js?v=4.85";
import { debounce, throttle } from "./util.js?v=4.85";
import { renderSpotlightCards, renderResultList, renderArtistDetail, renderArtists, fillSelect, modalOpen, modalCloseTop, setupModal } from "./ui.js?v=4.85";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=4.85";
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES } from "./genre-model.js?v=4.85";
import { initExplore } from "./explore.js?v=4.85";
import { openProposalEditor, openNewTechProposal } from "./proposals.js?v=4.85";
import { loadArtists, saveArtists } from "./artist-cache.js?v=4.85";

const state = {
  // De syv delte samlingene (artists, genreDescs, edgeDescs, tech, content,
  // decades, podcasts) kommer fra shared-data.js — samme form som lærersiden og
  // slektstresidene, så en delt komponent aldri kan få ulikt innhold her.
  ...sharedStateDefaults(),
  pendingEdits: [],
  filters: { search: "", mainGenre: "", metaGenre: "", instrument: "", decade: "", showRemoved: false, priority: 0 },
  isTeacher: false,
  clientId: getClientId(),
};

// state.pendingEdits er siste HENTEDE liste (engangs-spørring ved editor-
// åpning), ikke et sanntidsabonnement — den synkrone sjekken brukes bare
// kosmetisk (knappetekst). Selve porten er openProposalEditorGuarded, som
// henter ferskt før editoren åpnes.
function hasPendingEdit(entityType, entityId) {
  return state.pendingEdits.some((p) => p.entityType === entityType && String(p.entityId) === String(entityId));
}

async function openProposalEditorGuarded(cfg) {
  try {
    state.pendingEdits = await fetchPendingEdits();
  } catch (err) {
    // Kunne ikke lese — ikke blokker studenten; et evt. duplikat avvises av lærer.
    console.warn("Kunne ikke sjekke ventende endringsforslag:", err?.message || err);
  }
  if (hasPendingEdit(cfg.entityType, cfg.entityId)) {
    alert("Det ligger allerede et endringsforslag til vurdering for denne. Vent til læreren har behandlet det.");
    return;
  }
  openProposalEditor(cfg);
}

// Feil ved stemming skal ikke svelges stille — da tror studenten at stemmen
// ble registrert.
const voteFailed = (err) => {
  console.error("Stemme feilet:", err);
  alert("Kunne ikke registrere stemmen (" + (err?.message || err) + "). Prøv igjen.");
};
// Hindrer at et dobbeltklikk sender to skrivinger på samme kort: den andre
// ville vært en no-op (uid alt lagt til/fjernet) som reglene avviser, og gitt
// en falsk «kunne ikke registrere»-feil. Én stemmeoperasjon per artist om
// gangen; knappen får riktig tilstand når snapshotet kommer.
const voteInFlight = new Set();
function guardedVote(id, fn) {
  if (voteInFlight.has(id)) return;
  voteInFlight.add(id);
  fn(id).catch(voteFailed).finally(() => voteInFlight.delete(id));
}
const handlers = {
  voteUp: (id) => guardedVote(id, voteUp),
  undoVoteUp: (id) => guardedVote(id, undoVoteUp),
  showTimeline: (id) => explore?.openTidslinje({ artistId: id }),
};

let explore = null;

// Visningsmodus for filtertreff: artistkort (standard, kronologisk) eller
// kompakt navneliste («Vis liste»). Nullstilles ikke — huskes til sidelast.
let filterView = "cards";

function openDetail(artist) {
  $("#detail-name").textContent = artist.name;
  renderArtistDetail($("#detail-body"), artist, explore.buildLinkCtx());
  // «Vis i tidslinje» → fokus-API-et: åpner artistens gruppe/seksjoner og
  // uthever blokkene. Vises for ALLE artister (bevisst valg i v3.69); uten
  // startår åpner den tidslinjen uten fokus-blokk.
  const tlBtn = document.getElementById("detail-tidslinje");
  if (tlBtn) tlBtn.onclick = () => explore.openTidslinje({ artistId: artist.id });
  const btn = document.getElementById("detail-propose");
  if (btn) {
    const locked = hasPendingEdit("artist", artist.id);
    btn.disabled = locked;
    btn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
    btn.onclick = () => openProposalEditorGuarded({
      entityType: "artist",
      entityId: artist.id,
      entityName: artist.name,
      currentValues: artist,
    });
  }
  modalOpen(document.getElementById("modal-detail"));
}

function setupProposeButtons() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-propose-type]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const type = btn.dataset.proposeType;
    const id = btn.dataset.proposeId;
    // Pending-låsen (ikke to åpne forslag for samme entitet) håndheves i
    // openProposalEditorGuarded, med fersk engangs-spørring.
    if (type === "artist") {
      const a = state.artists.find((x) => x.id === id);
      if (!a) return;
      openProposalEditorGuarded({ entityType: "artist", entityId: a.id, entityName: a.name, currentValues: a });
    } else if (type === "tech") {
      const t = state.techItems.find((x) => x.id === id);
      if (!t) return;
      openProposalEditorGuarded({ entityType: "tech", entityId: t.id, entityName: t.name, currentValues: t });
    }
  });

  // «Vis i tidslinje» på dagens-artist-kortene (spotlight). De fulle
  // artistkortene bruker data-action="showTimeline" via renderArtists' egen
  // knappe-kobling; spotlight-kortene kobles her siden de ikke går den veien.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-timeline-id]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    explore?.openTidslinje({ artistId: btn.dataset.timelineId });
  });
}

function setupExplore() {
  explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onSlektstre: openSlektstre,
    onProposeEdit: (cfg) => openProposalEditorGuarded(cfg),
    // preset settes av Instrumenter-seksjonen ({ instrument, category }), så
    // skjemaet åpner riktig utfylt. Teknologiseksjonen sender ingenting.
    onProposeNewTech: (preset) => openNewTechProposal(preset),
    hasPendingEdit,
  });

  const btnSociety = document.getElementById("btn-society");
  if (btnSociety) btnSociety.addEventListener("click", () => explore.openDecadeList("society"));
  const btnTech = document.getElementById("btn-tech");
  if (btnTech) btnTech.addEventListener("click", () => explore.openDecadeList("tech"));
  const btnGenres = document.getElementById("btn-genres");
  if (btnGenres) btnGenres.addEventListener("click", explore.openSubgenreList);
  const btnInstrumenter = document.getElementById("btn-instrumenter");
  if (btnInstrumenter) btnInstrumenter.addEventListener("click", explore.openInstrumenter);
  // MIDLERTIDIG (feature-flags.js): hele hubkortet skjules. Det som må være
  // tilgjengelig derfra, nås fortsatt andre steder: Tidslinje har eget kort på
  // forsiden, og Varmekart ligger i knapperaden i sjangermodalen.
  const btnStoreBildet = document.getElementById("btn-store-bildet");
  if (btnStoreBildet) {
    // NB: hidden-attributtet duger ikke her. .dash-card setter display i CSS,
    // og element-CSS slår nettleserens [hidden]-regel, så kortet ville blitt
    // stående synlig. Inline display vinner.
    if (SKJUL_I_STUDENTVISNING.storeBildet) btnStoreBildet.style.display = "none";
    else btnStoreBildet.addEventListener("click", explore.openStoreBildet);
  }
  // Viktighetsgrad-filteret hører til samme midlertidige skjuling som
  // prioritetsmerket på kortene.
  const prioBar = document.getElementById("sp-prio-bar");
  // Samme grunn som over: .priority-filter-bar har display: flex.
  if (prioBar && SKJUL_I_STUDENTVISNING.viktighetsgrad) prioBar.style.display = "none";

  const btnDagens = document.getElementById("btn-dagens-navn");
  if (btnDagens) btnDagens.addEventListener("click", openDagensNavn);

  const btnArtister = document.getElementById("btn-artister");
  if (btnArtister) btnArtister.addEventListener("click", openArtistModal);

  // Tidslinje-inngang fra Artister-modalen (samme delte modal som fra Sjangre).
  const btnTidslinje = document.getElementById("btn-tidslinje-artister");
  if (btnTidslinje) btnTidslinje.addEventListener("click", () => explore.openTidslinje());

  setupModal("modal-artister");
  setupModal("modal-dagens-navn");
  // Forslags-modalen åpnes fra proposals.js, som ikke kobler lukking selv.
  // Uten dette blir «← Tilbake» (satt av initModalHeaders) en død knapp og
  // bakgrunnsklikk lukker ikke. setupModal er ikke idempotent — kall det KUN
  // her ved init, aldri per åpning.
  setupModal("modal-proposal");
}

// Slektstreet bor på sin egen side (tre.html). «Vis sjangertre →» i Sjangre-
// popupen navigerer dit i stedet for å åpne en duplikat-modal her.
function openSlektstre() {
  window.location.href = "tre.html";
}

// Deep-link (?artist=… / ?mainGenre=… / ?metaGenre=… / ?instrument=…).
// Visningen krever config + artister; i stedet for å polle settes et
// pending-flagg, og applyPendingDeepLink kalles fra snapshot-callbackene —
// virker uansett hvor tregt nettet er (ingen 5-sekundersfrist).
let pendingDeepLink = null;

function applyIncomingFilter() {
  const params = new URLSearchParams(location.search);
  const sj = params.get("mainGenre"), g = params.get("metaGenre"),
        inst = params.get("instrument"), artistId = params.get("artist");
  if (!sj && !g && !inst && !artistId) return;
  state.filters.mainGenre = sj || "";
  state.filters.metaGenre = g || "";
  state.filters.instrument = inst || "";
  pendingDeepLink = { sj, g, inst, artistId };
  applyPendingDeepLink();
}

function applyPendingDeepLink() {
  if (!pendingDeepLink) return;
  if (!state.artists.length) return;
  const { sj, g, inst, artistId } = pendingDeepLink;
  pendingDeepLink = null;
  if (sj) $("#sp-sjanger").value = sj;
  if (g) $("#sp-genre").value = g;
  if (inst) $("#sp-instrument").value = inst;
  renderArtistViews();
  if (artistId) {
    const a = state.artists.find((x) => x.id === artistId);
    if (a) { openDetail(a); return; }
  }
  modalOpen(document.getElementById("modal-artister"));
}

function setupDetailModal() {
  const backdrop = document.getElementById("modal-detail");
  if (!backdrop) return;
  setupModal(backdrop);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modalCloseTop();
  });
}

function openDagensNavn() {
  renderDagensModal();
  modalOpen(document.getElementById("modal-dagens-navn"));
}

// ----------------------------------------------------------------------------
//  Spotlight / listevisning
// ----------------------------------------------------------------------------

function hasFilters() {
  return hasActiveFilters(state.filters);
}

// Dagens artist: én fast tilfeldig trukket artist per sidelast, vist BÅDE i
// seksjonen under dashbordet og i modalen fra «Finn artister» (samme
// trekning; «Ny artist» trekker på nytt begge steder).
let dagensArtistId = null;

function dagensArtist() {
  const pool = state.artists.filter(isVisible);
  if (!pool.length) return null;
  if (!dagensArtistId) dagensArtistId = pool[Math.floor(Math.random() * pool.length)].id;
  return pool.find((a) => a.id === dagensArtistId) || pool[0];
}

// Seksjonen under dashbordet — alltid synlig så snart det finnes artister.
function renderDagensSection() {
  if (!state.artists.length && !state.artistsLoaded) return;
  const section = document.getElementById("dagens-artist-section");
  const el = $("#dagens-artist");
  if (!section || !el) return;
  const artist = dagensArtist();
  if (!artist) {
    // Første snapshot har kommet og datasettet ER tomt (ikke bare «laster»):
    // rydd bort «Laster forslag …»-placeholderen og skjul seksjonen igjen,
    // ellers blir den stående for alltid.
    if (state.artistsLoaded) {
      section.style.display = "none";
      el.innerHTML = "";
      delete el.dataset.dagensSig;
    }
    return;
  }
  section.style.display = "";
  // Kortet bygges via innerHTML (bildet gjenskapes), og seksjonen tegnes på nytt
  // for hvert snapshot under lasting (config/artister/tech) + ved hver stemme.
  // Hopp over når verken artisten eller tech-lenkene ville endret seg — ellers
  // blinker kortet 2–3 ganger ved sidelast. tech-lengden fanger «tech kom etter
  // kortet», da linkene legges til (jf. subscribeTech under).
  const sig = artist.id + "|" + (state.techItems ? state.techItems.length : -1);
  if (el.dataset.dagensSig === sig) return;
  renderSpotlightCards(el, [artist], explore.buildLinkCtx());
  el.dataset.dagensSig = sig;
}

// Modalen (åpnes fra «Finn artister»).
function renderDagensModal() {
  if (!state.artists.length && !state.artistsLoaded) return;
  const el = $("#spotlight");
  if (!el) return;
  const artist = dagensArtist();
  if (!artist) {
    el.innerHTML = `<p class="muted empty">${state.artistsLoaded ? "Ingen artister ennå." : "Laster forslag …"}</p>`;
    delete el.dataset.dagensSig;
    return;
  }
  // Samme vakt som renderDagensSection: unngå å bygge kortet (og bildet) på nytt
  // når verken artist eller tech-lenker har endret seg.
  const sig = artist.id + "|" + (state.techItems ? state.techItems.length : -1);
  if (el.dataset.dagensSig === sig) return;
  renderSpotlightCards(el, [artist], explore.buildLinkCtx());
  el.dataset.dagensSig = sig;
}

function isDagensModalOpen() {
  const m = document.getElementById("modal-dagens-navn");
  return !!m && m.classList.contains("open");
}

function renderFilterResults() {
  if (!state.artists.length && !state.artistsLoaded) return;
  const el = document.getElementById("filter-results");
  if (!el) return;

  // Kompakt navneliste vises KUN når filter er aktivt OG bruker valgte «Vis
  // liste». Ellers (ingen filter, eller kort-visning) er den tom — kortene
  // under står da for visningen.
  if (!hasFilters() || filterView !== "list") {
    el.innerHTML = "";
    return;
  }

  // isVisible-filteret (status/synlighet) først, deretter det delte
  // innholdsfilteret — samme funksjon som «Alle forslag»-lista bruker.
  const pool = filterArtists(state.artists.filter(isVisible), state.filters);

  renderResultList(el, pool, openDetail);
}

// ----------------------------------------------------------------------------
//  Alle forslag
// ----------------------------------------------------------------------------

function renderList() {
  if (!state.artists.length && !state.artistsLoaded) return;
  const el = $("#artist-list");
  if (!el) return;
  // Kortene skjules KUN når bruker har valgt kompakt liste (og filter er aktivt)
  // — da står #filter-results for visningen. Ellers vises artistkortene, både
  // uten filter og som standard MED filter (kronologisk sortert i renderArtists).
  if (hasFilters() && filterView === "list") {
    el.innerHTML = "";
    return;
  }
  renderArtists(el, { ...state, handlers, linkCtx: explore.buildLinkCtx() });
}

// «Vis liste» / «Vis kort»-knappen: kun synlig når filter er aktivt.
function updateViewToggle() {
  const btn = document.getElementById("sp-view-toggle");
  if (!btn) return;
  if (!hasFilters()) { btn.style.display = "none"; return; }
  btn.style.display = "";
  btn.textContent = filterView === "list" ? "Vis kort" : "Vis liste";
}

// Forslag-lista og filterresultatene bor begge inne i #modal-artister. Å bygge
// dem (linkifisering av alle kort) er det tyngste arbeidet på siden, og det er
// bortkastet når modalen er lukket — som den er det meste av tiden. Sanntids-
// callbacks bygger derfor bare når modalen faktisk er åpen; ellers bygges lista
// idet modalen åpnes.
function isArtistModalOpen() {
  const m = document.getElementById("modal-artister");
  return !!m && m.classList.contains("open");
}

function renderArtistViews() {
  renderFilterResults();
  renderList();
  updateViewToggle();
}

function renderArtistViewsIfVisible() {
  if (isArtistModalOpen()) renderArtistViews();
}

function openArtistModal() {
  renderArtistViews();
  modalOpen(document.getElementById("modal-artister"));
  document.getElementById("sp-search")?.focus();
}

function refreshFilterControls() {
  fillSelect($("#sp-sjanger"), GENEALOGY_MAIN_GENRES, { placeholder: "Sjanger" });
  fillSelect($("#sp-genre"), GENEALOGY_META_GENRES.map(g => ({ value: g, label: g })), { placeholder: "Metasjanger" });
  fillSelect($("#sp-instrument"), instrumentsInUse(state.artists, state.filters.instrument), { placeholder: "Instrument" });
  fillSelect(
    $("#sp-decade"),
    DECADES.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Tiår" }
  );
  if (state.filters.mainGenre)  $("#sp-sjanger").value = state.filters.mainGenre;
  if (state.filters.metaGenre)    $("#sp-genre").value = state.filters.metaGenre;
}

function updatePrioButtons() {
  document.querySelectorAll("#sp-prio-bar .prio-filter-btn").forEach((btn) => {
    const p = parseInt(btn.dataset.prio, 10);
    btn.className = `prio-filter-btn${state.filters.priority === p ? ` active-${p}` : ""}`;
  });
}

function setupFilters() {
  // Søket debounces så ikke hele lista re-rendres (inkl. linkifisering av
  // alle beskrivelser) for hvert eneste tastetrykk.
  const rerender = () => renderArtistViews();
  const rerenderDebounced = debounce(rerender, 200);

  // «Vis liste» / «Vis kort» bytter mellom kompakt navneliste og artistkort.
  const viewBtn = document.getElementById("sp-view-toggle");
  if (viewBtn) viewBtn.addEventListener("click", () => {
    filterView = filterView === "list" ? "cards" : "list";
    renderArtistViews();
  });
  // Eksplisitt kobling element → filternøkkel: filterArtists leser mainGenre/
  // metaGenre, ikke element-id-ene (sjanger/genre) — å utlede nøkkelen fra
  // id-en gjorde at sjanger- og metasjangervalget aldri traff filteret.
  const FILTER_KEYS = {
    "sp-search": "search",
    "sp-sjanger": "mainGenre",
    "sp-genre": "metaGenre",
    "sp-instrument": "instrument",
    "sp-decade": "decade",
  };
  Object.entries(FILTER_KEYS).forEach(([id, key]) => {
    const el = document.getElementById(id);
    el.addEventListener(id === "sp-search" ? "input" : "change", (e) => {
      state.filters[key] = e.target.value;
      (id === "sp-search" ? rerenderDebounced : rerender)();
    });
  });
  document.querySelectorAll("#sp-prio-bar .prio-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.prio, 10);
      state.filters.priority = state.filters.priority === p ? 0 : p;
      updatePrioButtons();
      renderFilterResults();
      renderList();
    });
  });
  // «Vis ny artist» (seksjonen på forsiden) og «Ny artist» (modalen) deler
  // trekningen, så begge visningene alltid viser samme artist.
  $("#sp-shuffle").addEventListener("click", shuffleDagens);
  document.getElementById("btn-dagens-ny")?.addEventListener("click", shuffleDagens);
}

function shuffleDagens() {
  const pool = state.artists.filter(isVisible);
  if (!pool.length) return;
  // Trekk en annen artist enn den som vises (når det finnes flere).
  let pick = pool[Math.floor(Math.random() * pool.length)];
  while (pool.length > 1 && pick.id === dagensArtistId) {
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  dagensArtistId = pick.id;
  renderDagensModal();
  renderDagensSection();
}

// ----------------------------------------------------------------------------
//  Cache
// ----------------------------------------------------------------------------
//  Selve lagringen bor i artist-cache.js, delt med studentsiden (som leser
//  cachen til duplikatsjekken i stedet for å abonnere på hele samlingen).

function loadCache() {
  const list = loadArtists();
  if (list.length) state.artists = list;
}

// Cachen skrives når fanen FORLATES, ikke ved hvert snapshot: å stringify-e
// hele artistlista (~1–2 MB) er den tyngste gjentatte jobben på siden, og under
// en stemmestorm fyrte den hvert 400. ms på hver åpne fane. pagehide dekker
// navigasjon/lukking, visibilitychange fanger mobil-bakgrunning (der pagehide
// ikke er garantert). Begge skriver samme nøkkel, så dobbelt fyring er ufarlig.
function setupCachePersist() {
  const persist = () => { if (state.artistsLoaded) saveArtists(state.artists); };
  window.addEventListener("pagehide", persist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });
}

// ----------------------------------------------------------------------------
//  Oppstart
// ----------------------------------------------------------------------------

function init() {
  setupFilters();
  setupProposeButtons();
  setupDetailModal();
  setupExplore();

  if (!CONFIGURED) {
    refreshFilterControls();
    renderList();
    showSetupBanner();
    return;
  }

  loadCache();
  setupCachePersist();
  refreshFilterControls();
  if (state.artists.length) {
    renderDagensSection();
    // #artist-list bygges når #modal-artister åpnes (openArtistModal), ikke her
    // — den er skjult ved sidelast, så å bygge alle kortene nå er bortkastet.
  } else {
    // Førstegangsbesøk uten cache: vis en lasteindikator i listeseksjonene til
    // første Firestore-snapshot kommer, i stedet for en tom side.
    const loading = `<p class="muted empty">Laster forslag …</p>`;
    const section = document.getElementById("dagens-artist-section");
    if (section) section.style.display = "";
    const dagens = $("#dagens-artist");
    if (dagens) dagens.innerHTML = loading;
    const list = $("#artist-list");
    if (list) list.innerHTML = loading;
  }

  wireFirestoreErrorBanner();

  // Når anonym innlogging er klar, blir uid stemme-identiteten. Oppdater
  // clientId og re-render så «Angre stemme»-tilstanden vises riktig.
  onAuthChange((user) => {
    if (user && user.uid !== state.clientId) {
      state.clientId = user.uid;
      renderArtistViewsIfVisible();
    }
  });

  // Hver stemme fra hvem som helst i kullet fyrer dette snapshotet. Throttle
  // slår sammen en byge til jevnlige oppdateringer i stedet for én full
  // ombygging per stemme, og lista bygges bare når modalen faktisk er åpen.
  const applyArtistSnapshot = throttle(() => {
    renderArtistViewsIfVisible();
    renderDagensSection();
    if (isDagensModalOpen()) renderDagensModal();
  }, 400);
  // Én rute inn for alle de delte samlingene (js/shared-data.js). Merk: ikke noe
  // pendingEdits-abonnement — studentsiden trenger bare pending-status idet
  // forslags-editoren åpnes (openProposalEditorGuarded).
  subscribeSharedData(state, {
    onArtists: () => {
      // Instrumentnedtrekket bygges av artistene, så det må fylles på nytt når
      // snapshotet lander — ved init finnes bare cachen (eller ingenting).
      refreshFilterControls();
      applyArtistSnapshot();
      // Utenom throttlingen: deep-linken skal åpnes straks data finnes (no-op
      // når det ikke venter noen).
      applyPendingDeepLink();
    },
    // genreDescsChanged: et åpent sjangerkort skal vise en fersk beskrivelse
    // med én gang — beskrivelsene bor i sin egen samling, så content-snapshotet
    // dekker dem ikke.
    onGenreDescs: () => {
      if (isArtistModalOpen()) renderFilterResults();
      explore?.genreDescsChanged?.();
    },
    // Tech-lenkene i artistkortene bygges av linkifiseringen — render på nytt
    // når tech-lista kommer/endres, ellers mangler lenkene ved førstegangslasting.
    // renderInstrumenter: en åpen Instrumenter-fane bygges av tech-kortene og
    // skal følge med (no-op når seksjonen er lukket).
    onTech: () => { applyArtistSnapshot(); explore?.renderInstrumenter?.(); },
    // Innholdssidene og varmekartet: re-render åpne visninger ved endring.
    // Instrumentsammendragene bor i content, så en åpen Instrumenter-fane
    // tegnes på nytt her også.
    onContent: () => { explore?.contentChanged?.(); explore?.renderInstrumenter?.(); },
    // En åpen Podkaster-fane skal vise nye episoder uten å lukkes/åpnes.
    onPodcasts: () => explore?.renderInstrumenter?.(),
  });

  // Sjangervokabularet kommer fra Firestore og lander ETTER at filtrene ble
  // fylt første gang. Fyll dem på nytt når treet er der, ellers står
  // Sjanger- og Metasjanger-nedtrekkene tomme.
  onGenreModelChanged(() => refreshFilterControls());

  applyIncomingFilter();
}

// Rollevelger — kjører først når klassepassordet er godtatt (js/gate.js), så
// verken rollevalget eller innholdet ligger bak sperren. Er gate.js ikke
// lastet, er __pensumGate undefined og Promise.resolve(undefined) går rett
// videre: sperren feiler åpent framfor å låse ute klassen.
Promise.resolve(window.__pensumGate?.klar).then(function roleGate() {
  // localStorage KAN kaste (blokkerte cookies/nettsteddata, styrte skole-
  // profiler). Da skal siden oppføre seg som inkognito — spørre om rolle på
  // nytt — aldri strande med døde knapper fordi et kast stoppet resten av
  // funksjonen (init() og lytterne under ville ellers aldri blitt koblet).
  const lesRole = () => { try { return localStorage.getItem("pensum-role"); } catch (e) { return null; } };
  const lagreRole = (r) => { try { localStorage.setItem("pensum-role", r); } catch (e) {} };

  const role = lesRole();
  const gate = document.getElementById("role-gate");

  function applyRole(r) {
    if (r === "student") document.body.classList.add("role-student");
    if (gate) gate.classList.add("hidden");
  }

  if (role) {
    applyRole(role);
    init();
    return;
  }

  if (!gate) { init(); return; }

  document.getElementById("role-student")?.addEventListener("click", () => {
    lagreRole("student");
    applyRole("student");
    init();
  });
  document.getElementById("role-teacher")?.addEventListener("click", () => {
    lagreRole("teacher");
    applyRole("teacher");
    window.location.href = "teacher.html";
  });
});
