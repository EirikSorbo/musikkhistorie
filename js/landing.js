import { subscribeArtists, subscribeConfig, subscribeDecades, subscribeGenreDescs, subscribeContent, subscribePodcasts, subscribeTech, fetchPendingEdits, voteUp, undoVoteUp, getClientId, onAuthChange } from "./store.js?v=3.23";
import { DEFAULT_CONFIG, DECADES, isVisible, filterArtists } from "./limits.js?v=3.23";
import { debounce, throttle } from "./util.js?v=3.23";
import { renderSpotlightCards, renderResultList, renderArtistDetail, renderArtists, fillSelect, modalOpen, modalCloseTop, setupModal } from "./ui.js?v=3.23";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=3.23";
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES } from "./genealogy.js?v=3.23";
import { initExplore } from "./explore.js?v=3.23";
import { openProposalEditor, openNewTechProposal } from "./proposals.js?v=3.23";

const state = {
  artists: [],
  // true etter første artist-snapshot — skiller «laster fortsatt» fra
  // «datasettet er faktisk tomt» (placeholder-opprydding i renderDagensSection).
  artistsLoaded: false,
  config: null,
  // true når config-lesingen feilet og state.config bare er standardverdier —
  // da skal den ikke caches (ville overskrevet en tidligere ekte config).
  configIsFallback: false,
  decadeDescs: {},
  genreDescs: {},
  // Innholdssidene (Om historie, Røtter) + varmekartet fra content-samlingen.
  // contentLoaded skiller «laster fortsatt» fra «mangler faktisk tekst».
  content: {},
  contentLoaded: false,
  podcasts: [],
  techItems: [],
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
};

let explore = null;

function openDetail(artist) {
  $("#detail-name").textContent = artist.name;
  renderArtistDetail($("#detail-body"), artist, state.config, explore.buildLinkCtx());
  // «Vis i tidslinje» → fokus-API-et: åpner artistens gruppe/seksjoner og
  // uthever blokkene. Skjules for artister uten startår (de har ingen blokk).
  const tlBtn = document.getElementById("detail-tidslinje");
  if (tlBtn) {
    tlBtn.style.display = Number(artist.influenceStart) > 0 ? "" : "none";
    tlBtn.onclick = () => explore.openTidslinje({ artistId: artist.id });
  }
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
}

function setupExplore() {
  explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onSlektstre: openSlektstre,
    onProposeEdit: (cfg) => openProposalEditorGuarded(cfg),
    onProposeNewTech: () => openNewTechProposal(),
    hasPendingEdit,
  });

  const btnSociety = document.getElementById("btn-society");
  if (btnSociety) btnSociety.addEventListener("click", () => explore.openDecadeList("society"));
  const btnTech = document.getElementById("btn-tech");
  if (btnTech) btnTech.addEventListener("click", () => explore.openDecadeList("tech"));
  const btnGenres = document.getElementById("btn-genres");
  if (btnGenres) btnGenres.addEventListener("click", explore.openSubgenreList);
  const btnPodkast = document.getElementById("btn-podkast");
  if (btnPodkast) btnPodkast.addEventListener("click", explore.openPodkast);
  const btnStoreBildet = document.getElementById("btn-store-bildet");
  if (btnStoreBildet) btnStoreBildet.addEventListener("click", explore.openStoreBildet);

  const btnDagens = document.getElementById("btn-dagens-navn");
  if (btnDagens) btnDagens.addEventListener("click", openDagensNavn);

  const btnArtister = document.getElementById("btn-artister");
  if (btnArtister) btnArtister.addEventListener("click", openArtistModal);

  // Tidslinje-inngang fra Artister-modalen (samme delte modal som fra Sjangre).
  const btnTidslinje = document.getElementById("btn-tidslinje-artister");
  if (btnTidslinje) btnTidslinje.addEventListener("click", () => explore.openTidslinje());

  setupModal("modal-artister");
  setupModal("modal-dagens-navn");
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
  if (!state.config || !state.artists.length) return;
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
  const f = state.filters;
  return !!(f.search || f.mainGenre || f.metaGenre || f.instrument || f.decade);
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
  if (!state.config) return;
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
    }
    return;
  }
  section.style.display = "";
  renderSpotlightCards(el, [artist], state.config, explore.buildLinkCtx());
}

// Modalen (åpnes fra «Finn artister»).
function renderDagensModal() {
  if (!state.config) return;
  const el = $("#spotlight");
  if (!el) return;
  const artist = dagensArtist();
  if (!artist) {
    el.innerHTML = `<p class="muted empty">${state.artistsLoaded ? "Ingen artister ennå." : "Laster forslag …"}</p>`;
    return;
  }
  renderSpotlightCards(el, [artist], state.config, explore.buildLinkCtx());
}

function isDagensModalOpen() {
  const m = document.getElementById("modal-dagens-navn");
  return !!m && m.classList.contains("open");
}

function renderFilterResults() {
  if (!state.config) return;
  const el = document.getElementById("filter-results");
  if (!el) return;

  if (!hasFilters()) {
    el.innerHTML = "";
    return;
  }

  // isVisible-filteret (status/synlighet) først, deretter det delte
  // innholdsfilteret — samme funksjon som «Alle forslag»-lista bruker.
  const pool = filterArtists(state.artists.filter(isVisible), state.filters);

  renderResultList(el, pool, state.config, openDetail);
}

// ----------------------------------------------------------------------------
//  Alle forslag
// ----------------------------------------------------------------------------

function renderList() {
  if (!state.config) return;
  const el = $("#artist-list");
  if (!el) return;
  // Med aktive filtre vises KUN den kompakte resultatlista (#filter-results) —
  // de fulle artistkortene under skapte dobbel visning av samme treff.
  if (hasFilters()) {
    el.innerHTML = "";
    return;
  }
  renderArtists(el, { ...state, handlers, linkCtx: explore.buildLinkCtx() });
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
  const { config } = state;
  fillSelect($("#sp-sjanger"), GENEALOGY_MAIN_GENRES, { placeholder: "Sjanger" });
  fillSelect($("#sp-genre"), GENEALOGY_META_GENRES.map(g => ({ value: g, label: g })), { placeholder: "Hovedsjanger" });
  fillSelect($("#sp-instrument"), config.instruments || [], { placeholder: "Instrument" });
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
  const rerender = () => { renderFilterResults(); renderList(); };
  const rerenderDebounced = debounce(rerender, 200);
  // Eksplisitt kobling element → filternøkkel: filterArtists leser mainGenre/
  // metaGenre, ikke element-id-ene (sjanger/genre) — å utlede nøkkelen fra
  // id-en gjorde at sjanger- og hovedsjangervalget aldri traff filteret.
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

// Skjemaversjon i nøkkelen: bump ved feltnavn-endringer på artist/config, så
// gamle caches (f.eks. fra før «genre»→«metaGenre»/«sjangre»→«mainGenre»-
// migreringen) ignoreres og appen faller tilbake til ferske Firestore-data.
const CACHE_SCHEMA  = "v3";
const CACHE_ARTISTS = `pensum_cache_artists_${CACHE_SCHEMA}`;
const CACHE_CONFIG  = `pensum_cache_config_${CACHE_SCHEMA}`;

// Rydd bort caches fra eldre skjemaer (engangs).
function purgeLegacyCache() {
  try {
    for (const k of Object.keys(localStorage)) {
      if ((k.startsWith("pensum_cache_artists") || k.startsWith("pensum_cache_config"))
          && k !== CACHE_ARTISTS && k !== CACHE_CONFIG) {
        localStorage.removeItem(k);
      }
    }
  } catch { /* ingen tilgang */ }
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_ARTISTS, JSON.stringify(state.artists));
    // Fallback-config (lesefeil → standardverdier) caches ikke — den ville
    // overskrevet en tidligere cachet EKTE config, og neste kalde last hadde
    // vist standardoppsettet til Firestore svarte.
    if (state.config && !state.configIsFallback) localStorage.setItem(CACHE_CONFIG, JSON.stringify(state.config));
  } catch { /* full storage */ }
}

function loadCache() {
  purgeLegacyCache();
  try {
    const a = localStorage.getItem(CACHE_ARTISTS);
    const c = localStorage.getItem(CACHE_CONFIG);
    if (a) state.artists = JSON.parse(a);
    if (c) state.config = JSON.parse(c);
  } catch { /* corrupt cache */ }
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
    state.config = { ...DEFAULT_CONFIG };
    refreshFilterControls();
    renderList();
    showSetupBanner();
    return;
  }

  loadCache();
  if (state.config && state.artists.length) {
    refreshFilterControls();
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

  subscribeConfig((config, meta) => {
    state.config = config;
    state.configIsFallback = !!meta?.fallback;
    refreshFilterControls();
    // Dagens artist trenger config — på kald start (uten cache) kan artist-
    // snapshotet ha kommet først og gitt opp; render på nytt nå.
    renderDagensSection();
    if (isDagensModalOpen()) renderDagensModal();
    renderArtistViewsIfVisible();
    applyPendingDeepLink();
    saveCache();
  });
  // Hver stemme fra hvem som helst i kullet fyrer dette snapshotet. Throttle
  // slår sammen en byge til jevnlige oppdateringer i stedet for én full
  // ombygging per stemme, og lista bygges bare når modalen faktisk er åpen.
  const applyArtistSnapshot = throttle(() => {
    renderArtistViewsIfVisible();
    renderDagensSection();
    if (isDagensModalOpen()) renderDagensModal();
    saveCache();
  }, 400);
  subscribeArtists((artists) => {
    state.artists = artists;
    state.artistsLoaded = true;
    applyArtistSnapshot();
    // Utenom throttlingen: deep-linken skal åpnes straks data finnes (no-op
    // når det ikke venter noen).
    applyPendingDeepLink();
  });
  // Tiårsbeskrivelsene brukes av Samfunn/Teknologi-modalene (explore.js) —
  // filterresultatene viser ikke lenger tiårsforklaring.
  subscribeDecades((d) => { state.decadeDescs = d; });
  // Innholdssidene og varmekartet: re-render åpne visninger ved endring.
  subscribeContent((c) => {
    state.content = c;
    state.contentLoaded = true;
    explore?.contentChanged?.();
  });
  subscribeGenreDescs((s) => { state.genreDescs = s; if (isArtistModalOpen()) renderFilterResults(); });
  subscribePodcasts((pods) => { state.podcasts = pods; });
  // Merk: ikke noe pendingEdits-abonnement her — studentsiden trenger bare
  // pending-status idet forslags-editoren åpnes (openProposalEditorGuarded).
  // Tech-lenkene i artistkortene bygges av linkifiseringen — render på nytt
  // når tech-lista kommer/endres, ellers mangler lenkene ved førstegangslasting.
  subscribeTech((items) => {
    state.techItems = items.filter((t) => t.status !== "pending");
    applyArtistSnapshot();
  });

  applyIncomingFilter();
}

// Rollevelger
(function roleGate() {
  const role = localStorage.getItem("pensum-role");
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
    localStorage.setItem("pensum-role", "student");
    applyRole("student");
    init();
  });
  document.getElementById("role-teacher")?.addEventListener("click", () => {
    localStorage.setItem("pensum-role", "teacher");
    applyRole("teacher");
    window.location.href = "teacher.html";
  });
})();
