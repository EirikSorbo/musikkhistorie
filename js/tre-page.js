// ============================================================================
//  SLEKTSTRE-SIDE — DELT OPPSTART
// ----------------------------------------------------------------------------
//  Oppstarten for slektstresiden (tre.html). Rendereren injiseres (tre.js
//  sender renderGenealogyBundled — bundlede bånd, en låst designbeslutning);
//  det gamle pakkede kartet og prototypesiden tre-prototype.html er slettet.
//
//  All oppkobling bor her, og den går gjennom initExplore + subscribeSharedData
//  — nøyaktig samme vei som forsiden. Før v4.44 hadde tre.js sin egen kopi av
//  hele denne oppkoblingen (modalinjisering, setupModal-kall, klikkdelegering
//  for data-sjanger/data-under/data-instrument, sin egen sjangerOpts og sin
//  egen tilbake-dans fra spillelisten). Den kopien drev fra forsidens: kortet
//  manglet varmestripa til v3.98, og «Tidslinje»-knappen fantes aldri her.
//  Nå kan en renderer ikke lenger få et annet kort enn resten av appen.
// ============================================================================

import { initExplore } from "./explore.js?v=6.20";
import { sjangerOpts, buildLinkCtx } from "./explore-context.js?v=6.20";
import { subscribeSharedData, sharedStateDefaults } from "./shared-data.js?v=6.20";
import { isGenreModelReady, onGenreModelChanged } from "./genre-model.js?v=6.20";
import { setupModal, modalCloseTop, modalOpen, renderArtistDetail } from "./ui.js?v=6.20";
import { CONFIGURED, wireFirestoreErrorBanner } from "./shared.js?v=6.20";
import { initPresentasjon, presPlanTikk } from "./presentasjon.js?v=6.20";
import { initPlanMeny } from "./plan-meny.js?v=6.20";
import { initPlanInnsamling, samleTikk } from "./plan-innsamling.js?v=6.20";
import { initYtSpiller } from "./yt-spiller.js?v=6.20";
import { initVisning, visningTikk } from "./visning.js?v=6.20";
import { initUtskriftValg } from "./utskrift-utvalg.js?v=6.20";
import { initUtskriftSkuff } from "./utskrift-skuff.js?v=6.20";
import { provVisMaal } from "./explore-apne.js?v=6.20";
import { fetchPendingEdits } from "./store.js?v=6.20";
import { openProposalEditor } from "./proposals.js?v=6.20";

export function initTrePage({ render }) {
  // Samme state-form som forsiden og lærersiden. isTeacher er alltid false her:
  // slektstresidene er lesevisninger, og redigering skjer på lærersiden.
  const state = { ...sharedStateDefaults(), isTeacher: false };
  let api = null;

  // Artistdetaljen har sin egen statiske modal på disse sidene (forsiden har en
  // annen, rikere variant). Lenkekonteksten er den DELTE buildLinkCtx, så
  // artist-, tech- og sjangerlenker i teksten ruter likt som overalt ellers.
  function openArtistDetail(a) {
    const title = document.getElementById("ad-title");
    const body = document.getElementById("ad-body");
    if (!title || !body) return;
    title.textContent = a.name;
    renderArtistDetail(body, a, buildLinkCtx());
    const modal = document.getElementById("modal-artist-detail");
    modal.dataset.vis = `artist:${a.id}`;   // «Kopier lenke» (v5.22) → forsiden
    modalOpen(modal);
  }

  // initExplore injiserer MODAL_HTML (inkludert de fire delte fragmentene),
  // setter opp alle modalene og registrerer klikkdelegeringen ÉN gang.
  // onSlektstre utelates med vilje: vi ER i treet, og både hub-knappen og
  // «Sjangertre»-knappen skjuler seg selv når handleren mangler.
  // «Foreslå endring» på sjangerkortet også her (v6.08, S8). Samme sperre som
  // forsiden (openProposalEditorGuarded i landing.js): én ventende endring per
  // kort, hentet fersk idet skjemaet åpnes.
  async function foreslaa(cfg) {
    try {
      const ventende = await fetchPendingEdits();
      if (ventende.some((p) => p.entityType === cfg.entityType && String(p.entityId) === String(cfg.entityId))) {
        alert("Det ligger allerede et endringsforslag til vurdering for denne. Vent til læreren har behandlet det.");
        return;
      }
    } catch (err) {
      console.warn("Kunne ikke sjekke ventende endringsforslag:", err?.message || err);
    }
    openProposalEditor(cfg);
  }

  const explore = initExplore({
    getState: () => state,
    onArtistClick: openArtistDetail,
    onProposeEdit: foreslaa,
    // «Vis i slektstreet» på sjangerkortet: vi ER i treet, så det sentreres på
    // sjangeren mens kortet står i sidepanelet (v6.08, S8).
    onVisITre: (label) => api?.fokuser?.(label),
  });

  // Sjangerkortet som sidepanel på brede skjermer (v6.08, S8; CSS), så treet
  // man nettopp så på, står igjen til venstre.
  document.body.classList.add("tre-side");

  setupModal("modal-artist-detail");
  setupModal("modal-proposal");
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") modalCloseTop(); });
  // Presentasjonsmodusen følger med fra forsiden via sessionStorage (v5.24),
  // så hoppet hit beholder verktøylinja og nivåene. No-op når den er av.
  // Lytteeksemplene spilles i appen, alltid (v5.77): én lytter for hele siden.
  initYtSpiller();
  initPresentasjon();
  initPlanMeny();
  // Treet er en side, ikke en modal: et opptak logger ankomsten her selv.
  initPlanInnsamling({ erTreSide: true });
  initVisning();
  // «Ta med i utskriften» i kortenes tittellinje + merket på skriverikonet (v5.56).
  initUtskriftValg({ hentData: () => state });
  initUtskriftSkuff();

  // Rendereren får sidens FELLES sjangerOpts. Den bygger ikke lenger sin egen,
  // så node-klikk i kartet og sjanger-chip på et artistkort åpner identisk kort.
  //
  // Tegningen MÅ skje mens scenen er synlig. Klassekodesperren (gate.js) skjuler
  // innholdet til koden er godtatt, og i et skjult element er både clientWidth
  // og getComputedTextLength() 0 — fit() ville regnet feil skala, og bundle-
  // visningen ville målt hver etikett til null bredde og gitt 54 like smale
  // piller med teksten hengende utenfor. Layouten kjøres bare én gang, så feilen
  // ville blitt stående til neste sidelast. Derfor venter vi på at scenen
  // faktisk får en størrelse.
  const stageEl = document.getElementById("gx-stage");
  let fokusFraUrl = null;
  try { fokusFraUrl = new URLSearchParams(window.location.search).get("fokus"); } catch (e) { /* aldri velte sidelasten */ }
  if (fokusFraUrl && stageEl) {
    const slipp = () => { fokusFraUrl = null; };
    stageEl.addEventListener("pointerdown", slipp, { once: true });
    stageEl.addEventListener("wheel", slipp, { once: true, passive: true });
  }
  let lastStageW = 0;

  // Tegner kartet. Krever BÅDE at scenen har en bredde OG at sjangertreet har
  // landet: fra v4.49 kommer treet fra Firestore, så modellen er tom de første
  // øyeblikkene (med mindre localStorage-speilet har en kopi fra sist besøk).
  // Tegnet vi før den var klar, ville vi malt et tomt kart som aldri fylte seg.
  function mount() {
    if (!stageEl?.clientWidth || !isGenreModelReady()) return false;
    api?.destroy?.();                     // rydder kameraets window-lyttere
    api = render({ root: document, getOpts: sjangerOpts });
    api?.fit();
    // tre.html?fokus=<sjanger> (v6.08, S8): fra «Vis i slektstreet» på et
    // sjangerkort på de andre sidene. Treet tegnes på nytt når dataene lander
    // (cache, så Firestore), så fokuset legges på igjen ved hver tegning til
    // brukeren selv tar i treet.
    if (fokusFraUrl) api?.fokuser?.(fokusFraUrl);
    lastStageW = stageEl.clientWidth;
    visTreMangler(false);
    return true;
  }

  // Treet mangler i databasen: si det, i stedet for å la scenen stå tom. Appen
  // har med vilje ingen kopi av pensumet i koden.
  function visTreMangler(på) {
    const el = document.getElementById("gx-tre-mangler");
    if (el) el.style.display = på ? "" : "none";
    if (stageEl) stageEl.style.display = på ? "none" : "";
  }

  // Deklarert UTENFOR if-en: onGenreModelChanged-grenen under må kunne koble
  // den fra når monteringen lykkes den veien.
  let ro = null;
  if (!mount() && stageEl && "ResizeObserver" in window) {
    ro = new ResizeObserver(() => { if (mount()) ro.disconnect(); });
    ro.observe(stageEl);
  }

  // Nytt tre fra Firestore (første snapshot, eller lærerens import mens siden
  // står åpen): tegn på nytt. Kameraet ryddes i mount(), så lytterne ikke hoper
  // seg opp.
  // Lykkes monteringen via DENNE veien (treet lander etter at observatøren ble
  // satt opp), skal observatøren også kobles fra. Den så bare sitt eget kall,
  // og ble ellers hengende og kalle mount() ved hver eneste størrelsesendring.
  onGenreModelChanged(() => { if (mount()) ro?.disconnect(); });

  // «← Tilbake» på selve siden (treet er en side, ikke en modal). Har man kommet
  // hit fra Det store bildet eller et artistkort, går history.back() dit. Åpnet
  // man siden direkte (ingen historikk), faller vi til forsiden, så knappen
  // aldri er en blindvei.
  document.getElementById("gx-back")?.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "index.html";
  });

  // Kun refit når scenens BREDDE faktisk endrer seg. På mobil fyrer resize også
  // når adressefeltet kollapser/ekspanderer (kun høyde) — da skal ikke brukerens
  // zoom/pan nullstilles.
  window.addEventListener("resize", () => {
    if (!api) return;
    const w = stageEl?.clientWidth || 0;
    if (w && Math.abs(w - lastStageW) > 2) { lastStageW = w; api.fit(); }
  });

  // Vent på klassepassordet (js/gate.js) før noe hentes, så innholdet ikke
  // ligger lastet bak sperren. Er gate.js ikke lastet, er __pensumGate undefined
  // og Promise.resolve(undefined) går rett videre — sperren feiler åpent.
  Promise.resolve(window.__pensumGate?.klar).then(() => {
    // Fallback for nettlesere uten ResizeObserver: koden er godtatt her, så
    // scenen er synlig og kan måles. mount() er idempotent.
    mount();
    if (!CONFIGURED) return;
    wireFirestoreErrorBanner();
    subscribeSharedData(state, {
      // contentChanged legger varmenivåene i heat-strip.js og tegner et åpent
      // sjangerkort på nytt, så varmestripa dukker opp av seg selv når
      // snapshotet lander etter at kortet ble åpnet.
      // Sjangertreet ligger i samme snapshot; er det ikke der, sier vi fra.
      onContent: () => {
        explore.contentChanged();
        explore.renderInstrumenter?.();
        if (!isGenreModelReady()) visTreMangler(true);
        // Kjøreplan-stopp virker også her (v5.25): modalene er injisert, og
        // ventende mål trenger samme dytt som på forsiden.
        provVisMaal();
        presPlanTikk();
        samleTikk();
        visningTikk();
      },
      // Sjangerkort kan stå åpne også her — fersk beskrivelse med én gang.
      onGenreDescs: () => { explore.genreDescsChanged?.(); provVisMaal(); visningTikk(); },
      // Artistene teller på «Alle artister (n)» i Instrumenter-kortet.
      // presPlanTikk: kjøreplanens oversiktskort viser artist- og kortnavn.
      onArtists: () => { explore.renderInstrumenter?.(); provVisMaal(); presPlanTikk(); visningTikk(); },
      onDecades: () => provVisMaal(),
      onTech: () => { explore.renderInstrumenter?.(); explore.refreshTeknologi?.(); provVisMaal(); presPlanTikk(); visningTikk(); },
      onEdgeDescs: () => provVisMaal(),
      onPodcasts: () => explore.renderInstrumenter?.(),
    });
  });

  return { state, explore, api };
}
