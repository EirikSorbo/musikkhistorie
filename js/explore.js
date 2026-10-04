// ============================================================================
//  UTFORSK — ORKESTRATOR
// ----------------------------------------------------------------------------
//  Injiserer og wirer modalene, og eksponerer det uendrede initExplore-API-et.
//  Selve featurene bor i explore-*.js-modulene; den delte kjernen i
//  explore-context.js. (explore.js var 1614 linjer før oppdelingen v3.54–3.55.)
//
//  Fra v6.29 bor også oppfriskingen av åpne vinduer her (contentChanged og
//  genreDescsChanged, før i explore-context.js), og her fylles navigasjonen
//  kjernen slår opp i (registrerNavigasjon). Begge trenger featurene, og denne
//  fila er den eneste som importerer dem alle uten selv å bli importert av dem.
// ============================================================================
import { showSubsjangerInfo } from "./ui.js";
import { setupModal, initModalHeaders, modalClose, modalBytt, visValgtFane } from "./ui-modal.js";
import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN } from "./feature-flags.js";
import { refreshSjangerInfo } from "./genealogy.js";
import { setHeatData } from "./heat-strip.js";
import { MODAL_HTML } from "./explore-modals.js";
import { opts, setOpts, getState } from "./app-state.js";
import { registrerNavigasjon, sjangerOpts, onMainGenreClick, buildLinkCtx, showArtistsForSjanger, showArtistsForInstrument } from "./explore-context.js";
import { openVarmekart, renderVarmekartBody } from "./explore-varmekart.js";
import { openSjangerperioder, renderSjangerperioderBody } from "./explore-sjangerperioder.js";
import { openTidslinje, hideTidTip, tidslinjeHarSjanger } from "./explore-tidslinje.js";
import { openTechDetail, refreshTechDetail, openTeknologi, renderTeknologiList, refreshTeknologi } from "./explore-tech.js";
import { openDecadeList, openDecade, refreshDecadeView } from "./explore-decade.js";
import { openLytt } from "./explore-lytt.js";
import { openTime } from "./explore-timer.js";
import { openReferanser, renderReferanser } from "./explore-referanser.js";
import { openSubgenreList, openUndersjangre, openSubgenreInfo, tegnSjangre } from "./explore-sjanger.js";
import { openStoreBildet, openAppGuide, openOmHistorie, openRotter, openHistorier, openSjangerhimmel, renderPage, renderRotterChips, refreshHistorie } from "./explore-innhold.js";
import { openVisningssider, openArtistGalleri } from "./explore-visningssider.js";
import { openMetaOversikt } from "./explore-metaoversikt.js";
import { openInstrumenter, openPodkaster, renderInstrumenter } from "./explore-instrument.js";
import { openSok, wireSok } from "./explore-search.js";
import { apneMaal } from "./explore-apne.js";
import { erPresentasjon } from "./presentasjon.js";

// Det kjernen (explore-context.js) og «Fra timene» (explore-timer.js) må kunne
// åpne. Fylles her, idet modulen lastes, og ikke i kjernen selv: da hang 13
// filer i én importring (se toppteksten i explore-context.js).
registrerNavigasjon({ openTechDetail, openTidslinje, tidslinjeHarSjanger, openArtistGalleri, openInstrumenter, apneMaal });

// Kalles av sidene når genreDescriptions-snapshotet endres: et åpent
// sjangerkort skal vise den nye beskrivelsen med én gang, ikke først når
// kortet lukkes og åpnes igjen. (Egen inngang fordi beskrivelsene bor i sin
// egen samling — content-snapshotet fyrer ikke når de endres.)
export function genreDescsChanged() {
  refreshSjangerInfo(sjangerOpts());
  // Sjangre-vinduet viser periodene fra beskrivelsene (v6.11). Bare
  // innholdet tegnes (v6.23): vinduet heves ikke og fokuset flyttes ikke,
  // så det kan tegnes også når et sjangerkort ligger oppå.
  if (document.getElementById("modal-subgenre-list")?.classList.contains("open")) tegnSjangre();
  // Sjangerperioder (v5.20) leser årstallene fra beskrivelsene: står figuren
  // åpen, skal en rettet periode synes med én gang.
  if (document.getElementById("modal-sjangerperioder")?.classList.contains("open")) renderSjangerperioderBody();
  // Selve historieteksten bor i genreDescriptions (story-feltet) — en åpen
  // historie skal vise lærerens lagring med én gang (audit-funn 8).
  if (document.getElementById("modal-historier")?.classList.contains("open")) refreshHistorie();
}

// Kalles av sidene når content-snapshotet endres (import, redigering,
// celleklikk): re-rendrer innholdsvisninger som står åpne, så endringen
// slår gjennom uten å lukke/åpne modalen.
export function contentChanged() {
  // Varmenivåene legges igjen i heat-strip.js, der sjangerkortet (genealogy.js)
  // henter dem. Kortet bygges et lag UNDER app-laget og kan ikke lese state
  // herfra — explore-context importerer genealogy, så en import den andre veien
  // ville lukket sirkelen. Dette er første og eneste snapshot-punktet, så linja
  // på kortet er fersk fra første lasting og etter hver redigering.
  setHeatData(getState().content?.varmekart?.heat || null);
  // Står et sjangerkort åpent, tegnes det på nytt — da følger varmelinja med når
  // læreren endrer nivåer, i stedet for å vise gamle tall til kortet lukkes.
  // sjangerOpts() sendes med så omtegningen leser GJELDENDE state: de fangede
  // opts fra åpningsøyeblikket pekte på utbyttede referanser og viste aldri en
  // fersk beskrivelse.
  refreshSjangerInfo(sjangerOpts());
  const isOpen = (id) => document.getElementById(id)?.classList.contains("open");
  if (isOpen("modal-om-historie")) renderPage("omHistorie", "om-historie-body", "omh-extra");
  if (isOpen("modal-rotter")) {
    renderPage("rotter", "rotter-body", "rotter-extra");
    // Rot-boblene bygges av sjangertreet, som lander ASYNKRONT. Sto kortet
    // åpent da snapshotet kom, ble de stående tomme til det ble lukket og
    // åpnet igjen.
    renderRotterChips();
  }
  if (isOpen("modal-app-guide")) renderPage("appGuide", "app-guide-body", "app-guide-extra");
  if (isOpen("modal-varmekart")) renderVarmekartBody();
  // Historien (v5.34, audit-funn 8): varmestripene over fortellingen leser
  // samme heat-data som varmekartet, og lærerens celleklikk skal synes der
  // også — kortet var den eneste innholdsvisningen uten snapshot-gren, så
  // stripa og nivåvelgeren motsa hverandre etter lagring.
  if (isOpen("modal-historier")) refreshHistorie();
  // Sjangerperioder: treet kommer via content, og en figur som sto og ventet på
  // det skal enten tegnes eller si at treet mangler. Tegner bare om ved endring.
  if (isOpen("modal-sjangerperioder")) renderSjangerperioderBody();
  // Frittstående referanser bor i content: lagrer læreren en ny, skal kortet
  // vise den med én gang, ikke ved neste åpning.
  if (isOpen("modal-referanser")) renderReferanser();
}

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
   "modal-instr-tech", "modal-podkaster", "modal-sok", "modal-lytt", "modal-time"].forEach((id) => setupModal(id));

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

  // Sjangre-fanene (v6.12, brukervalg 2026-10-03): de fem kortene om sjangrene
  // står som faner i samme vindu, med Sjangre først. Hvert kort beholder sin
  // egen adresse og åpner, så huben, tiårene og kjøreplanene åpner dem som
  // før, nå med fanene over. Slektstreet (egen side) og Sjangerhistorier
  // (flagget) er knapper til høyre, ikke faner. Skjules «Sjangerhistorier»
  // her, må hubkortet skjules samtidig, ellers er historiene fortsatt åpne.
  // Lærersiden gir onStoryEdit og beholder den.
  const SJ_FANER = [
    { id: "sjangre", navn: "Sjangre", modal: "modal-subgenre-list", apne: () => openSubgenreList() },
    { id: "sjangerperioder", navn: "Sjangerperioder", modal: "modal-sjangerperioder", apne: () => openSjangerperioder() },
    { id: "varmekart", navn: "Varmekart", modal: "modal-varmekart", apne: () => openVarmekart() },
    { id: "tidslinje", navn: "Artisttidslinje", modal: "modal-tidslinje", apne: () => openTidslinje() },
    { id: "undersjangre", navn: "Undersjangre", modal: "modal-undersjangre", apne: () => openUndersjangre() },
  ];
  const visHistorier = () => !SKJUL_I_STUDENTVISNING.metasjangerhistorier || !!opts.onStoryEdit;
  document.querySelectorAll("[data-sj-faner]").forEach((rad) => {
    const her = rad.dataset.sjFaner;
    const vindu = rad.closest(".modal-backdrop");
    // Ikke role="tablist" (v6.23, Fable): hver «fane» er et eget kort, så
    // raden er en gruppe navigasjonsknapper, og den aktive er aria-current.
    rad.innerHTML = `<div class="sj-fanerad" role="group" aria-label="Sjangre">${SJ_FANER.map((f) =>
      `<button type="button" class="dv-fane${f.id === her ? " active" : ""}"${f.id === her ? ' aria-current="page"' : ""} data-sj-fane="${f.id}" data-tekst="${f.navn}">${f.navn}</button>`).join("")}</div>
      <div class="sj-fane-knapper">
        ${opts.onSlektstre ? `<button type="button" class="btn ghost small" data-sj-slektstre>Slektstre <span aria-hidden="true">›</span></button>` : ""}
        <button type="button" class="btn ghost small" data-sj-historier${visHistorier() ? "" : " hidden"}>Sjangerhistorier <span aria-hidden="true">›</span></button>
      </div>`;
    rad.querySelectorAll("[data-sj-fane]").forEach((b) => b.addEventListener("click", () => {
      const f = SJ_FANER.find((x) => x.id === b.dataset.sjFane);
      if (!f || f.id === her) return;
      const til = document.getElementById(f.modal);
      modalBytt(vindu, til, f.apne);
      // Tastaturet blir stående på fanene, ikke på ←-knappen i det nye kortet,
      // og på smale skjermer rulles den valgte fanen inn i raden.
      til?.querySelector(`[data-sj-fane="${f.id}"]`)?.focus();
      visValgtFane(til?.querySelector(".sj-fanerad"));
    }));
    rad.querySelector("[data-sj-slektstre]")?.addEventListener("click", () => opts.onSlektstre());
    rad.querySelector("[data-sj-historier]").addEventListener("click", () => openHistorier());
  });
  // Bryteren kan endres mens siden står åpen (v6.10, U4).
  document.addEventListener("pensum:synlighet", () => {
    document.querySelectorAll("[data-sj-historier]").forEach((b) => { b.hidden = !visHistorier(); });
  });

  // «Det store bildet»-hub: mål-modalene åpnes OPPÅ huben (modaler stables),
  // så ← i undermodalen går naturlig tilbake hit. Slektstreet bor på egen side
  // og navigerer bort — knappen skjules om siden ikke ga en handler.
  const sbModal = document.getElementById("modal-store-bildet");
  if (sbModal) {
    // Visning-kortet (v5.96) hører bare til lerretet: utenfor visningen
    // fjernes det for alle, også læreren (samme grunn som under: et skjult
    // kort ville talt med i griden).
    if (!erPresentasjon()) sbModal.querySelector("#sb-visning")?.remove();
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

    // Kortene studentene ikke skal se (feature-flags.js, SKJUL_I_HUBEN).
    // FJERNES fra griden, ikke display:none: den er en :has()-basert
    // auto-layout som teller BARNA, og et skjult kort ville gitt et hull.
    // Fra v6.10 (U4) står bryterne i databasen og kan endres mens siden står
    // åpen, så alle kortene huskes (koblet over) og griden bygges på nytt fra
    // dem ved hver endring. Læreren ser alltid alle. I presentasjonsvisningen
    // skjules de med hidden ved oppstart, så QA-bryteren kan slå dem på igjen
    // (presentasjon.js styrer dem derfra).
    const grid = sbModal.querySelector(".dash-grid");
    const alleKort = grid ? [...grid.querySelectorAll(":scope > .dash-card")] : [];
    const ordneHubKort = (ved) => {
      if (opts.onStoryEdit || !grid) return;
      if (erPresentasjon()) {
        if (ved === "oppstart") alleKort.forEach((k) => { if (SKJUL_I_HUBEN[k.id]) k.hidden = true; });
        return;
      }
      grid.replaceChildren(...alleKort.filter((k) => !SKJUL_I_HUBEN[k.id]));
    };
    ordneHubKort("oppstart");
    document.addEventListener("pensum:synlighet", () => ordneHubKort("endring"));
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
    refreshDecadeView,
    openLytt,
    openTime,
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
