// ============================================================================
//  LÆRER — ENTRY
// ----------------------------------------------------------------------------
//  Innlogging, oppstart og Firestore-abonnementer. All feature-logikk bor i
//  teacher-*.js-modulene; denne fila binder dem sammen rundt det delte
//  `state`/`ctx` fra teacher-state.js.
// ============================================================================

import {
  subscribeTeacherChecks,
  subscribePendingEdits,
  mergeVarmekartRows,
  deleteTech,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
} from "./store.js?v=4.61";
import { subscribeSharedData } from "./shared-data.js?v=4.61";
import { onGenreModelChanged } from "./genre-model.js?v=4.61";
import { TEACHER_EMAILS } from "./firebase-config.js?v=4.61";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=4.61";
import { initExplore } from "./explore.js?v=4.61";

import { state, ctx, renderAll, refreshControls, openAdminModal, setContentCheck, guardTeacherAction, setupModals } from "./teacher-state.js?v=4.61";
import { openDetail, addMainGenreCheckToggle, openOversikt, setupFilters, setupEditForm } from "./teacher-artists.js?v=4.61";
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
  openReferanseEditor,
  setupReferanseEditor,
  openTechEditor,
  refreshTechAdmin,
} from "./teacher-content.js?v=4.61";
import { renderPendingEditsList, setupPendingEditsUi } from "./teacher-review.js?v=4.61";
import { renderDesk } from "./teacher-desk.js?v=4.61";
import { setupDataButtons, setupImportChoice } from "./teacher-import.js?v=4.61";
import { setupFormatBars } from "./format-bar.js?v=4.61";
import { GENRE_ADMIN_HTML, openGenreAdmin, setupGenreAdmin, refreshGenreAdmin } from "./teacher-genres.js?v=4.61";

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
      // Stemme-identiteten er uid-en (getClientId er null før innlogging har
      // landet). Uten dette ville lærerens EGNE «Merk ★» stått som umerkede.
      if (state.clientId !== user.uid) {
        state.clientId = user.uid;
        if (state.started) renderAll();
      }
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
  // Sjangertre-editorens modaler injiseres FØR setupModals, som kobler lukking
  // på alle .modal-backdrop den finner.
  const genWrap = document.createElement("div");
  genWrap.innerHTML = GENRE_ADMIN_HTML;
  while (genWrap.firstElementChild) document.body.appendChild(genWrap.firstElementChild);

  setupModals();
  setupGenreAdmin();
  document.getElementById("btn-t-sjangertre")?.addEventListener("click", openGenreAdmin);
  setupDataButtons();
  setupImportChoice();
  setupEditForm();
  setupDecadeSingleSave();
  setupPendingEditsUi();
  setupSubgenreSingleSave();
  setupEdgeSingleSave();
  setupStoryEditor();
  setupReferanseEditor();
  // Formatlinja over alle tekstfelter merket med data-format (beskrivelser,
  // tiårstekster, koblingstekster). Historie-editoren har sin egen i HTML-en.
  setupFormatBars();

  ctx.explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onSlektstre: () => { window.location.href = "tre.html"; },
    onSubgenreEdit: (label, level) => openSingleSubgenreModal(label, level),
    onStoryEdit: (genre) => openStoryEditor(genre),
    onPageEdit: (pageId) => openPageEditor(pageId),
    // Frittstående referanser har ikke noe kort å åpne fra Referanser-lista;
    // læreren får redigeringslista i stedet, med den valgte raden uthevet.
    onReferanseEdit: (fokus) => openReferanseEditor(fokus),
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
    onTechEdit: (t, preset) => openTechEditor(t, preset),
    // Podkast-administrasjonen nås nå fra Podkaster-fanen under Instrumenter
    // (dashbordkortet er borte), så lærer fortsatt kan laste opp episoder.
    onPodkastAdmin: () => openPodkastAdmin(),
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
  // Sjangre-modalen — én implementasjon i explore-tidslinje.js).
  const btnTid = document.getElementById("btn-tidslinje-artister");
  if (btnTid) btnTid.addEventListener("click", () => ctx.explore.openTidslinje());
  $("#btn-t-genres").addEventListener("click", ctx.explore.openSubgenreList);
  const btnStoreBildet = document.getElementById("btn-t-store-bildet");
  if (btnStoreBildet) btnStoreBildet.addEventListener("click", ctx.explore.openStoreBildet);
  $("#btn-t-oversikt").addEventListener("click", openOversikt);
  const btnTInstr = document.getElementById("btn-t-instrumenter");
  if (btnTInstr) btnTInstr.addEventListener("click", ctx.explore.openInstrumenter);
  setupPodkastAdmin();
  const btnArtister = document.getElementById("btn-t-artister");
  if (btnArtister) btnArtister.addEventListener("click", () => {
    const listSection = document.getElementById("artist-list");
    if (listSection) listSection.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#f-search")?.focus(), 300);
  });
  setupTechAdmin();

  // Frittstående referanser: står ved siden av «Ny artist», siden begge legger
  // til noe som ikke finnes fra før.
  const btnNyRef = document.getElementById("btn-ny-referanse");
  if (btnNyRef) btnNyRef.addEventListener("click", openReferanseEditor);

  // Skrivebordet (arbeidsflyt-innboksen øverst) tegnes på nytt ved hvert
  // snapshot som påvirker tallene: forslag inn/ut, kort sjekket, innhold skrevet.
  const refreshDesk = () => renderDesk($("#desk-body"));

  if (!CONFIGURED) {
    refreshControls();
    renderAll();
    refreshDesk();
    showSetupBanner();
    return;
  }

  // Vis banner hvis en sanntidslesing avvises (f.eks. stale publiserte regler) —
  // lærersiden hadde #banner-elementet men koblet det aldri før.
  wireFirestoreErrorBanner();

  refreshControls();
  // Én rute inn for de syv delte samlingene (js/shared-data.js), samme som
  // forsiden og slektstresidene. keepPendingTech: lærersiden er stedet
  // innovasjonskort GODKJENNES, så den må se dem som venter — den eneste
  // tillatte forskjellen mellom sidene.
  // Vokabularet lander med content-snapshotet, etter at filtrene er fylt.
  onGenreModelChanged(() => { refreshControls(); refreshDesk(); });

  subscribeSharedData(state, {
    keepPendingTech: true,
    onArtists: () => {
      refreshControls();
      renderAll();
      refreshDesk();
    },
    onGenreDescs: () => refreshDesk(),
    onContent: () => {
      // Åpne innholdsvisninger (sider/varmekart) re-rendres så import/
      // redigering slår gjennom umiddelbart.
      ctx.explore?.contentChanged?.();
      refreshGenreAdmin();
      refreshDesk();
    },
    onPodcasts: () => renderPodkastAdmin(),
    // Åpne teknologi-visninger (admin-lista og innovasjonskortet) tegnes på nytt,
    // så lagring i redigerings-popupen slår gjennom umiddelbart.
    onTech: () => {
      renderPendingEditsList();
      refreshTechAdmin();
      ctx.explore?.refreshTechDetail?.();
      refreshDesk();
    },
  });
  subscribeTeacherChecks((checks) => { state.teacherChecks = checks; refreshDesk(); });
  subscribePendingEdits((edits) => { state.pendingEdits = edits; renderPendingEditsList(); refreshDesk(); });

  // Tegn Skrivebordet med en gang (tomt/nullstilt) så panelet ikke står blankt
  // før første snapshot lander.
  refreshDesk();

  // (Oppstarts-vedlikeholdet er borte: de ni engangsmigreringene ble fjernet i
  // v4.19, og felt-oppryddingen i genreDescriptions i v4.23 — se store.js.)

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
