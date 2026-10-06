// ============================================================================
//  LÆRERSIDEN (teacher.html) — innlogging, oppstart og abonnementer
// ----------------------------------------------------------------------------
//  Innlogging, oppstart og Firestore-abonnementer. All feature-logikk bor i
//  teacher-*.js-modulene; denne fila binder dem sammen rundt det delte
//  `state`/`ctx` fra teacher-state.js.
// ============================================================================

import {
  subscribeTeacherChecks,
  subscribeTimeforslag,
  subscribePendingEdits,
  mergeVarmekartRows,
  deleteTech,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
} from "./data/store.js";
import { subscribeSharedData } from "./data/shared-data.js";
import { onGenreModelChanged } from "./sjangre/genre-model.js";
import { TEACHER_EMAILS } from "./firebase-config.js";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./data/shared.js";
import { initExplore } from "./utforsk/explore.js";
import { lesVisFraUrl, provVisMaal } from "./utforsk/explore-apne.js";

import { state, ctx, renderAll, refreshControls, openAdminModal, setContentCheck, guardTeacherAction, setupModals } from "./laerer/teacher-state.js";
import { openDetail, addMainGenreCheckToggle, openOversikt, oppdaterOversiktPlateselskaper, setupFilters, setupEditForm } from "./laerer/teacher-artists.js";
import {
  openSingleDecadeModal,
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
} from "./laerer/teacher-content.js";
import { renderPendingEditsList, setupPendingEditsUi } from "./laerer/teacher-review.js";
import { initVisning, visningTikk } from "./visning/visning.js";
import { initPlanMeny } from "./visning/plan-meny.js";
import { initPlanInnsamling, samleTikk } from "./visning/plan-innsamling.js";
import { initYtSpiller } from "./ui/yt-spiller.js";
import { initUtskriftValg } from "./utskrift/utskrift-utvalg.js";
import { initUtskriftSkuff } from "./utskrift/utskrift-skuff.js";
import { renderDesk } from "./laerer/teacher-desk.js";
import { setupDataButtons, setupImportChoice } from "./laerer/teacher-import.js";
import { setupFormatBars } from "./ui/format-bar.js";
import { GENRE_ADMIN_HTML, openGenreAdmin, setupGenreAdmin, refreshGenreAdmin } from "./laerer/teacher-genres.js";
import { melding, bekreft } from "./ui/ui-modal.js";

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
      // Innstillingene viser hvilken konto som er logget inn (v6.44).
      const konto = document.getElementById("innst-konto");
      if (konto) konto.textContent = `Logget inn som ${user.email}`;
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
  // Hele oppsettet i try/catch: startApp kjører først ETTER Google-innlogging,
  // og et ukjent kast her har før drept hele lærersiden STILLE (v4.60) —
  // started sto som true, auth-callbacken prøvde aldri igjen, og siden så
  // normal ut med døde knapper. Nå vises feilen i banneret i stedet.
  try {
    startAppInner();
  } catch (err) {
    console.error("Lærersiden feilet under oppstart:", err);
    const banner = $("#banner");
    if (banner) {
      banner.textContent = `Lærersiden fikk en feil under oppstart (${err?.message || err}). Last siden på nytt. Hjelper ikke det, sjekk konsollen.`;
      banner.className = "banner banner-error";
      banner.style.display = "block";
    }
  }
}

function startAppInner() {
  setupFilters();
  // Sjangertre-editorens modaler injiseres FØR setupModals, som kobler lukking
  // på alle .modal-backdrop den finner.
  const genWrap = document.createElement("div");
  genWrap.innerHTML = GENRE_ADMIN_HTML;
  while (genWrap.firstElementChild) document.body.appendChild(genWrap.firstElementChild);

  setupModals();
  setupGenreAdmin();
  document.getElementById("btn-t-sjangertre")?.addEventListener("click", openGenreAdmin);
  // Innhold-området (v6.10, U5): de samme åpnerne som før, samlet ett sted.
  document.getElementById("btn-t-inn-sjangertre")?.addEventListener("click", openGenreAdmin);
  document.getElementById("btn-t-inn-oversikt")?.addEventListener("click", openOversikt);
  document.getElementById("btn-t-inn-tech")?.addEventListener("click", () => openTechAdmin());
  document.getElementById("btn-t-inn-podkast")?.addEventListener("click", () => openPodkastAdmin());
  // Visning-vinduet bak presentasjonsikonet (v5.41): kjøreplanene og
  // editoren bor der nå, ikke i Oversikt.
  initVisning();
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
        melding("Varmekartet er ikke ferdig innlastet ennå. Vent et øyeblikk og prøv igjen.");
        return Promise.resolve();
      }
      return mergeVarmekartRows({ [genre]: values });
    },
    onMainGenreCheck: (genre) => addMainGenreCheckToggle(genre),
    getCheckedState: () => state.teacherChecks,
    onTechAdmin: () => openTechAdmin(),
    // Tiårsvinduets fanene (v6.07): Rediger åpner lærerens tiårsmodal på
    // samme tiår og samme tekst (samfunn eller teknologi).
    onDecadeEdit: (decade, mode) => openSingleDecadeModal(decade, mode),
    // Sjekk-knapp i detaljvisningene (sjanger, historie, røtter, innovasjonskort).
    onCheck: (category, id, on) => setContentCheck(category, id, on),
    onTechEdit: (t, preset) => openTechEditor(t, preset),
    // Podkast-administrasjonen nås nå fra Podkaster-fanen under Instrumenter
    // (dashbordkortet er borte), så lærer fortsatt kan laste opp episoder.
    onPodkastAdmin: () => openPodkastAdmin(),
    // Returnerer et løfte (v6.25): bekreftelsen er appens egen dialog, ikke
    // nettleserens confirm, så svaret kommer etterpå. explore-tech venter.
    onTechDelete: async (id) => {
      if (!(await bekreft("Kortet slettes for godt.", { tittel: "Slette dette innovasjonskortet?", ja: "Slett", farlig: true }))) return false;
      guardTeacherAction(deleteTech(id));
      return true;
    },
  });

  // Lenkeknappenes «Legg til i kjøreplan»-meny virker også her, lærersiden
  // har de samme kortene, og innloggingen er garantert. ETTER initExplore, som
  // på forsiden og slektstresiden (v5.52): en samleøkt som står på når sida
  // lastes, leser planene med én gang, og før initExplore fantes ikke state.
  // Lytteeksemplene spilles i appen, alltid (v5.77): én lytter for hele siden.
  initYtSpiller();
  initPlanMeny();
  initPlanInnsamling();
  // «Ta med i utskriften» i kortenes tittellinje + merket på skriverikonet (v5.56).
  initUtskriftValg({ hentData: () => state });
  initUtskriftSkuff();

  // Tiår-kortet (v6.07, S1) åpner det samme tiårsvinduet som studentene ser;
  // «Rediger» i fanene fører til lærerens tiårsmodal (onDecadeEdit over).
  // Lytt (U7) åpner spillelistene.
  $("#btn-t-tiar")?.addEventListener("click", () => ctx.explore.openDecadeList());
  $("#btn-t-lytt")?.addEventListener("click", () => ctx.explore.openLytt());
  // Tidslinje-inngang fra artistlistas filterrad (samme delte modal som fra
  // Sjangre-modalen — én implementasjon i explore-tidslinje.js).
  const btnTid = document.getElementById("btn-tidslinje-artister");
  if (btnTid) btnTid.addEventListener("click", () => ctx.explore.openTidslinje());
  $("#btn-t-genres")?.addEventListener("click", ctx.explore.openSubgenreList);
  const btnStoreBildet = document.getElementById("btn-t-store-bildet");
  if (btnStoreBildet) btnStoreBildet.addEventListener("click", ctx.explore.openStoreBildet);
  $("#btn-t-oversikt")?.addEventListener("click", openOversikt);
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
  // Én rute inn for de syv delte samlingene (js/data/shared-data.js), samme som
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
      // «Alle artister (n)» i Instrumenter-kortet telles av artistene.
      ctx.explore?.renderInstrumenter?.();
      // Plateselskapskortet viser artistene med selskapet (v6.37).
      ctx.explore?.renderPlateselskaper?.();
      oppdaterOversiktPlateselskaper();
      // Et åpent tiårsvindu (Musikk-fanen bygges av artistene).
      ctx.explore?.refreshDecadeView?.();
      // En åpen kjøreplan-kladd med «laster …»-stopp (audit v5.42 funn 8).
      visningTikk();
      provVisMaal();
    },
    // genreDescsChanged: et åpent sjangerkort viser fersk beskrivelse med én
    // gang (beskrivelsene bor i egen samling — content-snapshotet dekker dem ikke).
    onGenreDescs: () => { refreshDesk(); ctx.explore?.genreDescsChanged?.(); visningTikk(); provVisMaal(); },
    onContent: () => {
      // Åpne innholdsvisninger (sider/varmekart/instrumentsammendrag)
      // re-rendres så import/redigering slår gjennom umiddelbart.
      ctx.explore?.contentChanged?.();
      ctx.explore?.renderInstrumenter?.();
      oppdaterOversiktPlateselskaper();
      refreshGenreAdmin();
      refreshDesk();
      // Kjøreplan-lista i Visning-vinduet følger snapshotet (aldri midt i en
      // redigering).
      visningTikk();
      samleTikk();
      provVisMaal();
    },
    onPodcasts: () => { renderPodkastAdmin(); ctx.explore?.renderInstrumenter?.(); },
    // Tiårstekstene (v6.23, Fable F2): «Rediger» i tiårsfanene lagrer oppå
    // tiårsvinduet, som skal vise den nye teksten når læreren går tilbake.
    onDecades: () => { ctx.explore?.refreshDecadeView?.(); provVisMaal(); },
    // ?vis=-lenker til en sjangerkobling venter på koblingstekstene.
    onEdgeDescs: () => provVisMaal(),
    // Åpne teknologi-visninger (admin-lista, innovasjonskortet og en åpen
    // Instrumenter-fane) tegnes på nytt, så lagring slår gjennom umiddelbart.
    onTech: () => {
      renderPendingEditsList();
      refreshTechAdmin();
      ctx.explore?.refreshTechDetail?.();
      ctx.explore?.refreshTeknologi?.();
      ctx.explore?.renderInstrumenter?.();
      ctx.explore?.refreshDecadeView?.();
      refreshDesk();
      visningTikk();
      provVisMaal();
    },
  });
  subscribeTeacherChecks((checks) => {
    state.teacherChecks = checks; state.teacherChecksLoaded = true; refreshDesk();
    // Avhukingen på plateselskapskortene teller i Oversikten (v6.37).
    oppdaterOversiktPlateselskaper();
  });
  // Navn fra timen (v5.82): bare læreren kan lese samlingen, og lærersiden
  // starter først etter innlogging, så abonnementet får aldri avslag.
  subscribeTimeforslag((liste) => { state.timeforslag = liste; state.timeforslagLoaded = true; refreshDesk(); });
  subscribePendingEdits((edits) => { state.pendingEdits = edits; renderPendingEditsList(); refreshDesk(); });

  // Tegn Skrivebordet med en gang (tomt/nullstilt) så panelet ikke står blankt
  // før første snapshot lander.
  refreshDesk();

  // ?vis= (v6.23, Fable F11): lærersiden skriver kortets adresse ved hver
  // åpning (ui-modal.js), og en oppdatering skal åpne kortet igjen, som på
  // forsiden. Ruteren venter på dataene (provVisMaal i hookene over).
  lesVisFraUrl();

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
