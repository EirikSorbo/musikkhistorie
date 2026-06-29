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
  subscribeSubgenres,
  subscribePodcasts,
  subscribeTech,
  subscribeTeacherChecks,
  subscribePendingEdits,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
} from "./store.js?v=2.56";
import { DEFAULT_CONFIG } from "./limits.js?v=2.56";
import { TEACHER_EMAILS } from "./firebase-config.js?v=2.56";
import { CONFIGURED, $, showSetupBanner } from "./shared.js?v=2.56";
import { initExplore } from "./explore.js?v=2.56";

import { state, ctx, renderAll, refreshControls, updatePendingBadge } from "./teacher-state.js?v=2.56";
import { openDetail, addMainGenreCheckToggle, openOversikt, setupFilters, setupEditForm } from "./teacher-artists.js?v=2.56";
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
} from "./teacher-content.js?v=2.56";
import { renderPendingEditsList, setupPendingEditsUi } from "./teacher-review.js?v=2.56";
import { setupAdmin, fillAdminForm } from "./teacher-settings.js?v=2.56";
import { setupDataButtons, setupImportChoice } from "./teacher-import.js?v=2.56";

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
    } else if (user) {
      signedInNotTeacher = true;
      document.body.classList.remove("is-teacher");
      msg.textContent = `Kontoen ${user.email} har ikke lærertilgang.`;
      signinBtn.textContent = "Logg ut og prøv en annen konto";
    } else {
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

  ctx.explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onSlektstre: () => { window.location.href = "tre.html"; },
    onDecadeEdit: (decadeId, mode) => openSingleDecadeModal(decadeId, mode),
    onSubgenreEdit: (label, level) => openSingleSubgenreModal(label, level),
    onMainGenreCheck: (genre) => addMainGenreCheckToggle(genre),
    getCheckedState: () => state.teacherChecks,
    onTechAdmin: () => openTechAdmin(),
  });

  $("#btn-t-society").addEventListener("click", () => ctx.explore.openDecadeList("society"));
  $("#btn-t-tech").addEventListener("click", () => ctx.explore.openDecadeList("tech"));
  $("#btn-t-genres").addEventListener("click", ctx.explore.openSubgenreList);
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

  subscribeConfig((config) => {
    state.config = config;
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
  subscribeSubgenres((s) => { state.subgenreDescs = s; });
  subscribePodcasts((pods) => { state.podcasts = pods; renderPodkastAdmin(); });
  subscribeTech((items) => { state.techItems = items; updatePendingBadge(); renderPendingEditsList(); });
  subscribeTeacherChecks((checks) => { state.teacherChecks = checks; });
  subscribePendingEdits((edits) => { state.pendingEdits = edits; updatePendingBadge(); renderPendingEditsList(); });
}

setupGate();
