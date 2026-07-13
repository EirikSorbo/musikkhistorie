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
  subscribeContent,
  subscribePodcasts,
  subscribeTech,
  subscribeTeacherChecks,
  subscribePendingEdits,
  saveVarmekart,
  deleteTech,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
  purgeMetaGenreDescs,
} from "./store.js?v=3.17";
import { DEFAULT_CONFIG } from "./limits.js?v=3.17";
import { TEACHER_EMAILS } from "./firebase-config.js?v=3.17";
import { CONFIGURED, $, showSetupBanner } from "./shared.js?v=3.17";
import { initExplore } from "./explore.js?v=3.17";

import { state, ctx, renderAll, refreshControls, openAdminModal, setContentCheck, guardTeacherAction } from "./teacher-state.js?v=3.17";
import { openDetail, addMainGenreCheckToggle, openOversikt, setupFilters, setupEditForm } from "./teacher-artists.js?v=3.17";
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
  openPageEditor,
  setupStoryEditor,
  openTechEditor,
} from "./teacher-content.js?v=3.17";
import { renderPendingEditsList, setupPendingEditsUi } from "./teacher-review.js?v=3.17";
import { renderDesk } from "./teacher-desk.js?v=3.17";
import { setupAdmin, fillAdminForm } from "./teacher-settings.js?v=3.17";
import { setupDataButtons, setupImportChoice } from "./teacher-import.js?v=3.17";

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
    onPageEdit: (pageId) => openPageEditor(pageId),
    // Varmekart-redigering: celleklikk sender hele den nye raden hit; hele
    // heat-kartet skrives (full overskriving — se saveVarmekart).
    onHeatEdit: (genre, values) => {
      const heat = { ...(state.content?.varmekart?.heat || {}) };
      heat[genre] = values;
      return saveVarmekart(heat);
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
    refreshDesk();
  });
  subscribeDecades((d) => { state.decadeDescs = d; });
  subscribeGenreDescs((s) => { state.genreDescs = s; refreshDesk(); });
  subscribeContent((c) => {
    state.content = c;
    state.contentLoaded = true;
    // Åpne innholdsvisninger (sider/varmekart) re-rendres så import/
    // redigering slår gjennom umiddelbart.
    ctx.explore?.contentChanged?.();
    refreshDesk();
  });
  subscribePodcasts((pods) => { state.podcasts = pods; renderPodkastAdmin(); });
  subscribeTech((items) => { state.techItems = items; renderPendingEditsList(); refreshDesk(); });
  subscribeTeacherChecks((checks) => { state.teacherChecks = checks; refreshDesk(); });
  subscribePendingEdits((edits) => { state.pendingEdits = edits; renderPendingEditsList(); refreshDesk(); });

  // Tegn Skrivebordet med en gang (tomt/nullstilt) så panelet ikke står blankt
  // før første snapshot lander.
  refreshDesk();

  // Engangs (idempotent): fjern det pensjonerte meta-feltet fra
  // genreDescriptions. Fire-and-forget — skal ikke blokkere oppstart.
  purgeMetaGenreDescs().catch((e) => console.warn("Meta-opprydding feilet:", e?.message || e));

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
