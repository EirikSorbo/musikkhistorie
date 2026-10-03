// ============================================================================
//  UTFORSK — ORKESTRATOR
// ----------------------------------------------------------------------------
//  Injiserer og wirer modalene, og eksponerer det uendrede initExplore-API-et.
//  Selve featurene bor i explore-*.js-modulene; den delte kjernen i
//  explore-context.js. (explore.js var 1614 linjer før oppdelingen v3.54–3.55.)
// ============================================================================
import { setupModal, initModalHeaders, modalClose, showSubsjangerInfo } from "./ui.js?v=6.07";
import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "./feature-flags.js?v=6.07";
import { MODAL_HTML } from "./explore-modals.js?v=6.07";
import { opts, setOpts, sjangerOpts, onMainGenreClick, buildLinkCtx, showArtistsForSjanger, showArtistsForInstrument, contentChanged, genreDescsChanged } from "./explore-context.js?v=6.07";
import { openVarmekart } from "./explore-varmekart.js?v=6.07";
import { openSjangerperioder } from "./explore-sjangerperioder.js?v=6.07";
import { openTidslinje, hideTidTip } from "./explore-tidslinje.js?v=6.07";
import { openTechDetail, refreshTechDetail, openTeknologi, renderTeknologiList, refreshTeknologi } from "./explore-tech.js?v=6.07";
import { openDecadeList, openDecade } from "./explore-decade.js?v=6.07";
import { openLytt } from "./explore-lytt.js?v=6.07";
import { openReferanser } from "./explore-referanser.js?v=6.07";
import { openSubgenreList, openUndersjangre, openSubgenreInfo } from "./explore-sjanger.js?v=6.07";
import { openStoreBildet, openAppGuide, openOmHistorie, openRotter, openHistorier, openSjangerhimmel } from "./explore-innhold.js?v=6.07";
import { openVisningssider } from "./explore-visningssider.js?v=6.07";
import { openMetaOversikt } from "./explore-metaoversikt.js?v=6.07";
import { openInstrumenter, openPodkaster, renderInstrumenter } from "./explore-instrument.js?v=6.07";
import { openSok, wireSok } from "./explore-search.js?v=6.07";
import { erPresentasjon } from "./presentasjon.js?v=6.07";

function injectModals() {
  const wrap = document.createElement("div");
  wrap.innerHTML = MODAL_HTML;
  while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
  // Gi de nettopp injiserte modalene samme header-behandling (←/✕ lukk alle)
  // som de statiske, ellers blir headeren inkonsekvent.
  initModalHeaders();
}

function wireModals() {
  ["modal-teknologi", "modal-instrumenter", "modal-decade-view",
   "modal-subgenre-list", "modal-undersjangre", "modal-subgenre-info",
   "modal-varmekart", "modal-vk-edit", "modal-sjangerperioder", "modal-tidslinje", "modal-referanser", "modal-sjangerhimmel",
   "modal-artistliste", "modal-spilleliste", "modal-sjanger", "modal-tech-detail",
   "modal-store-bildet", "modal-app-guide", "modal-om-historie", "modal-rotter", "modal-historier",
   "modal-meta-oversikt", "modal-visningssider", "modal-galleri",
   "modal-instr-tech", "modal-podkaster", "modal-sok", "modal-lytt"].forEach((id) => setupModal(id));

  // Søkefeltet i Utforsk-kortet står i sidenes egen markup med faste ID-er, så
  // forsiden og lærersiden får søket av samme kode uten å wire noe selv.
  wireSok();

  // Kategori- og instrumentlenkene på innovasjonskortene (techFactsLines).
  // Delegert på document fordi kortene rendres tre steder — Teknologi-lista,
  // detaljmodalen og lærerens admin-liste — og alle skal oppføre seg likt.
  // stopPropagation: kortet selv åpner detaljvisningen ved klikk.
  // Kategorifanene i Teknologi-modalen bærer OGSÅ data-tech-cat, men har sin
  // egen klikklytter under — uten unntaket her kjørte et faneklikk begge veier:
  // dobbel render, og modalOpen på en allerede åpen modal.
  document.addEventListener("click", (e) => {
    const kat = e.target.closest("[data-tech-cat]");
    if (kat && !kat.classList.contains("tech-tab")) {
      e.preventDefault(); e.stopPropagation();
      openTeknologi(kat.dataset.techCat);
      return;
    }
    const instr = e.target.closest("[data-tech-instr]");
    if (instr) {
      e.preventDefault(); e.stopPropagation();
      openInstrumenter(instr.dataset.techInstr);
    }
  });

  // Tidslinjens hover-kort er position:fixed — fjern det når modalen lukkes på
  // ANY måte (Escape/backdrop/«Lukk alle»), ellers kan det bli hengende svevende
  // over dashbordet hvis pekeren sto i ro over en blokk ved lukking.
  const tlModal = document.getElementById("modal-tidslinje");
  if (tlModal && "MutationObserver" in window) {
    new MutationObserver(() => { if (!tlModal.classList.contains("open")) hideTidTip(); })
      .observe(tlModal, { attributes: true, attributeFilter: ["class"] });
  }

  // Røtter-sidens ene navigasjonsknapp (statisk markup — innholdet bor i
  // Firestore). Står over teksten, ikke under den, og fyller bredden.
  const rotterTre = document.getElementById("rotter-tre");
  if (rotterTre) {
    if (opts.onSlektstre) rotterTre.addEventListener("click", () => opts.onSlektstre());
    else rotterTre.style.display = "none";
  }

  const slExtra = document.getElementById("sl-extra");
  if (slExtra) {
    // Inngangene til visualiseringene over sjangrene, som én rolig rad over
    // familiekortene (v6.05, S6). «Sjangerhistorier» følger det midlertidige
    // flagget: skjules knappen her, må hubkortet skjules samtidig, ellers er
    // historiene fortsatt åpne. Lærersiden gir onStoryEdit og beholder den.
    const visHistorier = !SKJUL_I_STUDENTVISNING.metasjangerhistorier || !!opts.onStoryEdit;
    const knapp = (id, tekst) => `<button type="button" class="btn ghost small" id="${id}">${tekst}</button>`;
    slExtra.innerHTML = `<div class="sj-nav">${[
      opts.onSlektstre ? knapp("btn-slektstre", "Slektstre") : "",
      knapp("btn-sjangerperioder", "Sjangerperioder"),
      knapp("btn-varmekart", "Varmekart"),
      knapp("btn-tidslinje", "Artisttidslinje"),
      visHistorier ? knapp("btn-metasjangere", "Sjangerhistorier") : "",
      knapp("btn-undersjangere", "Undersjangre"),
    ].join("")}</div>`;
    slExtra.querySelector("#btn-metasjangere")?.addEventListener("click", () => openHistorier());
    slExtra.querySelector("#btn-undersjangere").addEventListener("click", openUndersjangre);
    slExtra.querySelector("#btn-slektstre")?.addEventListener("click", () => opts.onSlektstre());
    slExtra.querySelector("#btn-sjangerperioder").addEventListener("click", openSjangerperioder);
    slExtra.querySelector("#btn-varmekart").addEventListener("click", () => openVarmekart());
    slExtra.querySelector("#btn-tidslinje").addEventListener("click", () => openTidslinje());
  }

  // «Det store bildet»-hub: mål-modalene åpnes OPPÅ huben (modaler stables),
  // så ← i undermodalen går naturlig tilbake hit. Slektstreet bor på egen side
  // og navigerer bort — knappen skjules om siden ikke ga en handler.
  const sbModal = document.getElementById("modal-store-bildet");
  if (sbModal) {
    // Visning-kortet (v5.96) hører bare til lerretet: utenfor visningen
    // fjernes det for alle, også læreren (samme grunn som under: et skjult
    // kort ville talt med i griden).
    if (!erPresentasjon()) sbModal.querySelector("#sb-visning")?.remove();
    // MIDLERTIDIG (feature-flags.js): studentene slippes inn i huben, men bare
    // til visualiseringene (tre fra 2026-09-10, fire med sjangerperioder). Kortene FJERNES, ikke display:none — griden
    // er en :has()-basert auto-layout som teller BARNA, så et skjult kort ville
    // etterlatt et hull i rutenettet (samme felle som forsidens hubkort, se
    // js/landing.js). Læreren beholder alle kortene: hen skal kunne kvalitetssikre
    // innholdet nettopp mens studentene ikke ser det.
    if (!opts.onStoryEdit) {
      sbModal.querySelectorAll(".dash-card").forEach((kort) => {
        if (!SKJUL_I_HUBEN[kort.id]) return;
        // Presentasjonsvisningen (v5.24) må kunne slå kortene PÅ igjen med
        // QA-bryteren, så der skjules de med hidden i stedet for å fjernes.
        // Griden tåler det: :has()-reglene teller DOM-barn, og med alle ti
        // til stede gjelder samme kolonneoppsett som hos læreren.
        if (erPresentasjon()) kort.hidden = true;
        else kort.remove();
      });
    }
    // Optional chaining hele veien: et fjernet kort skal ikke stoppe koblingen
    // av de som står igjen.
    const paaKort = (id, fn) => sbModal.querySelector("#" + id)?.addEventListener("click", fn);
    paaKort("sb-visning", openVisningssider);
    paaKort("sb-om-historie", openOmHistorie);
    paaKort("sb-rotter", openRotter);
    paaKort("sb-historier", () => openHistorier());
    paaKort("sb-tidslinje", () => openTidslinje());
    const sbTre = sbModal.querySelector("#sb-slektstre");
    // Slektstre-siden selv gir ingen onSlektstre (vi ER i treet). Kortet
    // fjernes da av samme grunn som over: display:none ville latt det telle med
    // i griden og gitt et hull.
    if (sbTre && opts.onSlektstre) sbTre.addEventListener("click", () => opts.onSlektstre());
    else sbTre?.remove();
    paaKort("sb-varmekart", () => openVarmekart());
    paaKort("sb-sjangerperioder", openSjangerperioder);
    paaKort("sb-himmel", openSjangerhimmel);
    paaKort("sb-referanser", openReferanser);
    paaKort("sb-guide", openAppGuide);
  }

  // Ligger i kategorirad-en (se MODAL_HTML) — samme knappestørrelse som fanene.
  const tekExtra = document.getElementById("tek-admin-extra");
  if (opts.onTechAdmin && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost small" id="btn-tech-admin">Rediger kort</button>`;
    tekExtra.querySelector("#btn-tech-admin").addEventListener("click", () => {
      modalClose(document.getElementById("modal-teknologi"));
      opts.onTechAdmin();
    });
  } else if (opts.onProposeNewTech && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost small" id="btn-tech-new">Foreslå ny</button>`;
    tekExtra.querySelector("#btn-tech-new").addEventListener("click", () => opts.onProposeNewTech());
  }

  const tekModal = document.getElementById("modal-teknologi");
  if (tekModal) {
    tekModal.querySelectorAll(".tech-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        tekModal.querySelectorAll(".tech-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderTeknologiList(btn.dataset.techCat || "");
      });
    });
  }

  document.addEventListener("click", (e) => {
    // Metasjangerens oversikt (v6.05, S2): fra familiekortene i Sjangre,
    // gruppene i tidslinja/varmekartet/periodene og merket øverst på
    // artist- og sjangerkortet (K5).
    // Et tiår på tidsstripene (artistkortet, sjangerkortet): tiårsvinduet på
    // Musikk-fanen (v6.07, K1).
    const tiarBtn = e.target.closest("[data-tiar]");
    if (tiarBtn) {
      e.preventDefault();
      openDecade(Number(tiarBtn.dataset.tiar), "musikk");
      return;
    }
    const metaBtn = e.target.closest("[data-meta-oversikt]");
    if (metaBtn) {
      e.preventDefault();
      openMetaOversikt(metaBtn.dataset.metaOversikt);
      return;
    }
    const sjBtn = e.target.closest("[data-sjanger]");
    if (sjBtn) {
      // Samme rute som sjangerlenker ellers (explore-context) — kroppen var
      // tidligere en tegn-for-tegn-kopi av onMainGenreClick, og slike kopier
      // har drevet fra hverandre før.
      onMainGenreClick(sjBtn.dataset.sjanger);
      return;
    }
    const underBtn = e.target.closest("[data-under]");
    if (underBtn) {
      const name = underBtn.dataset.under;
      // Under-chips viser alltid sub-nivået (popupen har selv en «Se (sjanger)»-
      // snarvei når navnet også er en tre-sjanger).
      showSubsjangerInfo(name, sjangerOpts());
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
      return;
    }
    const inst = e.target.closest("[data-instrument]");
    if (inst) showArtistsForInstrument(inst.dataset.instrument);
  });
}

export function initExplore(options) {
  setOpts(options);
  injectModals();
  wireModals();
  // Kun medlemmer sidene faktisk kaller. openVarmekart og showPlaylist-
  // ForMainGenre lå her uten en eneste konsument (de nås via knappene i
  // utforsk-laget selv). renderInstrumenter er no-op når seksjonen er lukket,
  // så sidene kan kalle den trygt fra ethvert snapshot.
  return {
    openSok,
    openDecadeList,
    openLytt,
    openSubgenreList,
    openTidslinje,
    openStoreBildet,
    openAppGuide,
    openOmHistorie,
    openRotter,
    openHistorier,
    openInstrumenter,
    openPodkaster,
    renderInstrumenter,
    openTeknologi,
    openTechDetail,
    refreshTechDetail,
    refreshTeknologi,
    buildLinkCtx,
    showArtistsForSjanger,
    onMainGenreClick,
    openSubgenreInfo,
    contentChanged,
    genreDescsChanged,
  };
}
