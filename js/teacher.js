// ============================================================================
//  LÆRER — ENTRY
// ----------------------------------------------------------------------------
//  Innlogging, oppstart og Firestore-abonnementer. All feature-logikk bor i
//  teacher-*.js-modulene; denne fila binder dem sammen rundt det delte
//  `state`/`ctx` fra teacher-state.js.
// ============================================================================

import {
  subscribeArtists,
  subscribeConfig,
  subscribeDecades,
  subscribeGenreDescs,
  subscribeEdgeDescs,
  subscribeContent,
  subscribePodcasts,
  subscribeTech,
  subscribeTeacherChecks,
  subscribePendingEdits,
  mergeVarmekartRows,
  deleteTech,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
  purgeDeadGenreDescFields,
  runGenreDuplicateCleanup,
  runGenreLabelAlignment,
  runTranceDocIdMigration,
  runContentKeyAlignment,
} from "./store.js?v=3.56";
import { DEFAULT_CONFIG } from "./limits.js?v=3.56";
import { TEACHER_EMAILS } from "./firebase-config.js?v=3.56";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=3.56";
import { initExplore } from "./explore.js?v=3.56";

import { state, ctx, renderAll, refreshControls, openAdminModal, setContentCheck, guardTeacherAction } from "./teacher-state.js?v=3.56";
import { openDetail, addMainGenreCheckToggle, openOversikt, setupFilters, setupEditForm } from "./teacher-artists.js?v=3.56";
import {
  openDecadeAdmin,
  openSingleSubgenreModal,
  setupDecadeSingleSave,
  setupSubgenreSingleSave,
  setupEdgeSingleSave,
  openTechAdmin,
  setupTechAdmin,
  openPodkastAdmin,
  renderPodkastAdmin,
  setupPodkastAdmin,
  openStoryEditor,
  openPageEditor,
  setupStoryEditor,
  openTechEditor,
  refreshTechAdmin,
} from "./teacher-content.js?v=3.56";
import { renderPendingEditsList, setupPendingEditsUi } from "./teacher-review.js?v=3.56";
import { renderDesk } from "./teacher-desk.js?v=3.56";
import { setupAdmin, fillAdminForm } from "./teacher-settings.js?v=3.56";
import { setupDataButtons, setupImportChoice } from "./teacher-import.js?v=3.56";

// ----------------------------------------------------------------------------
//  Innlogging
// ----------------------------------------------------------------------------

let signedInNotTeacher = false;

function setupGate() {
  const msg = $("#gate-msg");
  const signinBtn = $("#google-signin");

  signinBtn.addEventListener("click", () => {
    if (signedInNotTeacher) { signOutTeacher(); return; }
    signInWithGoogle().catch((e) => {
      if (e.code !== "auth/popup-closed-by-user")
        msg.textContent = "Innlogging mislyktes: " + e.message;
    });
  });

  $("#logout").addEventListener("click", () => signOutTeacher());

  onAuthChange((user) => {
    if (user && TEACHER_EMAILS.includes(user.email)) {
      signedInNotTeacher = false;
      msg.textContent = "";
      document.body.classList.add("is-teacher");
      if (!state.started) startApp();
    } else if (user && !user.isAnonymous) {
      signedInNotTeacher = true;
      document.body.classList.remove("is-teacher");
      msg.textContent = `Kontoen ${user.email} har ikke lærertilgang.`;
      signinBtn.textContent = "Logg ut og prøv en annen konto";
    } else {
      // Ingen bruker ELLER kun den automatiske anonyme økten (stemme-
      // identitet) — begge betyr «ikke logget inn» for lærer-gaten.
      signedInNotTeacher = false;
      document.body.classList.remove("is-teacher");
      msg.textContent = "";
      signinBtn.textContent = "Logg inn med Google";
    }
  });
}

// ----------------------------------------------------------------------------
//  Oppstart
// ----------------------------------------------------------------------------

function startApp() {
  state.started = true;
  setupFilters();
  setupAdmin();
  setupDataButtons();
  setupImportChoice();
  setupEditForm();
  setupDecadeSingleSave();
  setupPendingEditsUi();
  setupSubgenreSingleSave();
  setupEdgeSingleSave();
  setupStoryEditor();

  ctx.explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onSlektstre: () => { window.location.href = "tre.html"; },
    onSubgenreEdit: (label, level) => openSingleSubgenreModal(label, level),
    onStoryEdit: (genre) => openStoryEditor(genre),
    onPageEdit: (pageId) => openPageEditor(pageId),
    // Varmekart-redigering: celleklikk sender hele den nye raden hit. Vi FLETTER
    // den ene raden inn i det som ligger i Firestore (mergeVarmekartRows leser
    // fersk fra serveren først), så et klikk aldri kan slette de andre sjangrene
    // — heller ikke før content-snapshotet har landet, eller fra to faner
    // samtidig. Guarden hindrer dessuten redigering mot en tom/villedende
    // celleverdi før innholdet er lastet.
    onHeatEdit: (genre, values) => {
      if (!state.contentLoaded) {
        alert("Varmekartet er ikke ferdig innlastet ennå. Vent et øyeblikk og prøv igjen.");
        return Promise.resolve();
      }
      return mergeVarmekartRows({ [genre]: values });
    },
    onMainGenreCheck: (genre) => addMainGenreCheckToggle(genre),
    getCheckedState: () => state.teacherChecks,
    onTechAdmin: () => openTechAdmin(),
    // Sjekk-knapp i detaljvisningene (sjanger, historie, røtter, innovasjonskort).
    onCheck: (category, id, on) => setContentCheck(category, id, on),
    onTechEdit: (t) => openTechEditor(t),
    onTechDelete: (id) => {
      if (!confirm("Slette dette innovasjonskortet?")) return false;
      guardTeacherAction(deleteTech(id));
      return true;
    },
  });

  // Tiårskortene åpner lærerens tiårsmodal (samme tidslinje-stripe som
  // studentsiden, pluss sjekk/rediger) — ikke explore-visningen.
  $("#btn-t-society").addEventListener("click", () => openDecadeAdmin("society"));
  $("#btn-t-tech").addEventListener("click", () => openDecadeAdmin("tech"));
  // Tidslinje-inngang fra artistlistas filterrad (samme delte modal som fra
  // Sjangre-modalen — én implementasjon i explore.js).
  const btnTid = document.getElementById("btn-tidslinje-artister");
  if (btnTid) btnTid.addEventListener("click", () => ctx.explore.openTidslinje());
  $("#btn-t-genres").addEventListener("click", ctx.explore.openSubgenreList);
  const btnStoreBildet = document.getElementById("btn-t-store-bildet");
  if (btnStoreBildet) btnStoreBildet.addEventListener("click", ctx.explore.openStoreBildet);
  $("#btn-t-oversikt").addEventListener("click", openOversikt);
  $("#btn-t-podkast").addEventListener("click", openPodkastAdmin);
  setupPodkastAdmin();
  const btnArtister = document.getElementById("btn-t-artister");
  if (btnArtister) btnArtister.addEventListener("click", () => {
    const listSection = document.getElementById("artist-list");
    if (listSection) listSection.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#f-search")?.focus(), 300);
  });
  setupTechAdmin();

  // Skrivebordet (arbeidsflyt-innboksen øverst) tegnes på nytt ved hvert
  // snapshot som påvirker tallene: forslag inn/ut, kort sjekket, innhold skrevet.
  const refreshDesk = () => renderDesk($("#desk-body"));

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshControls();
    fillAdminForm();
    renderAll();
    refreshDesk();
    showSetupBanner();
    return;
  }

  // Vis banner hvis en sanntidslesing avvises (f.eks. stale publiserte regler) —
  // lærersiden hadde #banner-elementet men koblet det aldri før.
  wireFirestoreErrorBanner();

  subscribeConfig((config, meta) => {
    state.config = config;
    state.configIsFallback = !!meta?.fallback;
    refreshControls();
    fillAdminForm();
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    state.artistsLoaded = true;
    refreshControls();
    renderAll();
    refreshDesk();
  });
  subscribeDecades((d) => { state.decadeDescs = d; });
  subscribeGenreDescs((s) => { state.genreDescs = s; refreshDesk(); });
  subscribeEdgeDescs((m) => { state.edgeDescs = m; });
  subscribeContent((c) => {
    state.content = c;
    state.contentLoaded = true;
    // Åpne innholdsvisninger (sider/varmekart) re-rendres så import/
    // redigering slår gjennom umiddelbart.
    ctx.explore?.contentChanged?.();
    refreshDesk();
  });
  subscribePodcasts((pods) => { state.podcasts = pods; renderPodkastAdmin(); });
  // Åpne teknologi-visninger (admin-lista og innovasjonskortet) tegnes på nytt,
  // så lagring i redigerings-popupen slår gjennom umiddelbart.
  subscribeTech((items) => {
    state.techItems = items;
    renderPendingEditsList();
    refreshTechAdmin();
    ctx.explore?.refreshTechDetail?.();
    refreshDesk();
  });
  subscribeTeacherChecks((checks) => { state.teacherChecks = checks; refreshDesk(); });
  subscribePendingEdits((edits) => { state.pendingEdits = edits; renderPendingEditsList(); refreshDesk(); });

  // Tegn Skrivebordet med en gang (tomt/nullstilt) så panelet ikke står blankt
  // før første snapshot lander.
  refreshDesk();

  // Engangs-vedlikehold ved lærer-oppstart. Kjøres SEKVENSIELT (ikke parallelt)
  // så migreringer som rører de samme dokumentene (f.eks. flat-purge og Trance-
  // doc-flyttingen) ikke kappes. Hver er flagg-guardet/idempotent; en feil
  // isoleres og stopper ikke de neste. Se konsoll-loggen for hva hver gjorde.
  (async () => {
    const steps = [
      ["Genrebeskrivelse-opprydding", purgeDeadGenreDescFields],
      ["Sjangeropprydding", runGenreDuplicateCleanup],
      ["Node-label-justering", runGenreLabelAlignment],
      ["Trance-doc-id-migrering", runTranceDocIdMigration],
      ["Innholdsnøkkel-justering", runContentKeyAlignment],
    ];
    for (const [navn, fn] of steps) {
      try { await fn(); } catch (e) { console.warn(`${navn} feilet:`, e?.message || e); }
    }
  })();

  // Tannhjul- og oversikt-ikonene på de andre sidene lenker hit med
  // #innstillinger/#oversikt — åpne riktig modal når læreren er innlogget.
  // Hashen ryddes bort, så en refresh ikke gjenåpner modalen.
  const hash = location.hash;
  if (hash === "#innstillinger" || hash === "#oversikt") {
    history.replaceState(null, "", location.pathname);
    if (hash === "#innstillinger") openAdminModal("modal-settings");
    else openOversikt();
  }
}

setupGate();
