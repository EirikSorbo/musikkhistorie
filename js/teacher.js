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
  subscribePodcasts,
  subscribeTech,
  subscribeTeacherChecks,
  subscribePendingEdits,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
} from "./store.js?v=2.98";
import { DEFAULT_CONFIG } from "./limits.js?v=2.98";
import { TEACHER_EMAILS } from "./firebase-config.js?v=2.98";
import { CONFIGURED, $, showSetupBanner } from "./shared.js?v=2.98";
import { initExplore } from "./explore.js?v=2.98";

import { state, ctx, renderAll, refreshControls, updatePendingBadge } from "./teacher-state.js?v=2.98";
import { openDetail, addMainGenreCheckToggle, openOversikt, setupFilters, setupEditForm } from "./teacher-artists.js?v=2.98";
import {
  openSingleDecadeModal,
  openSingleSubgenreModal,
  setupDecadeSingleSave,
  setupSubgenreSingleSave,
  openTechAdmin,
  setupTechAdmin,
  openPodkastAdmin,
  renderPodkastAdmin,
  setupPodkastAdmin,
  openStoryEditor,
  setupStoryEditor,
} from "./teacher-content.js?v=2.98";
import { renderPendingEditsList, setupPendingEditsUi } from "./teacher-review.js?v=2.98";
import { setupAdmin, fillAdminForm } from "./teacher-settings.js?v=2.98";
import { setupDataButtons, setupImportChoice } from "./teacher-import.js?v=2.98";

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
  setupStoryEditor();

  ctx.explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onSlektstre: () => { window.location.href = "tre.html"; },
    onDecadeEdit: (decadeId, mode) => openSingleDecadeModal(decadeId, mode),
    onSubgenreEdit: (label, level) => openSingleSubgenreModal(label, level),
    onStoryEdit: (genre) => openStoryEditor(genre),
    onMainGenreCheck: (genre) => addMainGenreCheckToggle(genre),
    getCheckedState: () => state.teacherChecks,
    onTechAdmin: () => openTechAdmin(),
  });

  $("#btn-t-society").addEventListener("click", () => ctx.explore.openDecadeList("society"));
  $("#btn-t-tech").addEventListener("click", () => ctx.explore.openDecadeList("tech"));
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

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshControls();
    fillAdminForm();
    renderAll();
    showSetupBanner();
    return;
  }

  subscribeConfig((config, meta) => {
    state.config = config;
    state.configIsFallback = !!meta?.fallback;
    refreshControls();
    fillAdminForm();
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    refreshControls();
    renderAll();
  });
  subscribeDecades((d) => { state.decadeDescs = d; });
  subscribeGenreDescs((s) => { state.genreDescs = s; });
  subscribePodcasts((pods) => { state.podcasts = pods; renderPodkastAdmin(); });
  subscribeTech((items) => { state.techItems = items; updatePendingBadge(); renderPendingEditsList(); });
  subscribeTeacherChecks((checks) => { state.teacherChecks = checks; });
  subscribePendingEdits((edits) => { state.pendingEdits = edits; updatePendingBadge(); renderPendingEditsList(); });
}

setupGate();
