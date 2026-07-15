// ============================================================================
//  UTFORSK — ORKESTRATOR
// ----------------------------------------------------------------------------
//  Injiserer og wirer modalene, og eksponerer det uendrede initExplore-API-et.
//  Selve featurene bor i explore-*.js-modulene; den delte kjernen i
//  explore-context.js. (explore.js var 1614 linjer før oppdelingen v3.54–3.55.)
// ============================================================================
import { setupModal, initModalHeaders, modalClose, showSubsjangerInfo } from "./ui.js?v=3.57";
import { showSjangerInfo } from "./genealogy.js?v=3.57";
import { MODAL_HTML } from "./explore-modals.js?v=3.57";
import { opts, setOpts, sjangerOpts, onMainGenreClick, buildLinkCtx, showArtistsForSjanger, showPlaylistForMainGenre, showArtistsForInstrument, contentChanged } from "./explore-context.js?v=3.57";
import { openVarmekart } from "./explore-varmekart.js?v=3.57";
import { openTidslinje, hideTidTip } from "./explore-tidslinje.js?v=3.57";
import { openTechDetail, refreshTechDetail, openTeknologi, openPodkast, renderTeknologiList } from "./explore-tech.js?v=3.57";
import { openDecadeList } from "./explore-decade.js?v=3.57";
import { openKart } from "./explore-kart.js?v=3.57";
import { openSubgenreList, openUndersjangre, openSubgenreInfo } from "./explore-sjanger.js?v=3.57";
import { openStoreBildet, openAppGuide, openOmHistorie, openRotter, openHistorier, openSjangerhimmel } from "./explore-innhold.js?v=3.57";

function injectModals() {
  const wrap = document.createElement("div");
  wrap.innerHTML = MODAL_HTML;
  while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
  // Gi de nettopp injiserte modalene samme header-behandling (←/✕ lukk alle)
  // som de statiske, ellers blir headeren inkonsekvent.
  initModalHeaders();
}

function wireModals() {
  ["modal-teknologi", "modal-podkast", "modal-decade-view",
   "modal-decade-more", "modal-subgenre-list", "modal-undersjangre", "modal-subgenre-info",
   "modal-varmekart", "modal-vk-edit", "modal-tidslinje", "modal-kart", "modal-sjangerhimmel",
   "modal-artistliste", "modal-spilleliste", "modal-sjanger", "modal-tech-detail",
   "modal-store-bildet", "modal-app-guide", "modal-om-historie", "modal-rotter", "modal-historier"].forEach((id) => setupModal(id));

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
    // Sjangertreet er hovedinngangen — egen rad øverst, grønn og i full bredde.
    // Under: Hovedsjangere → sjangerhistoriene (én fortelling per hovedsjanger)
    // og Undersjangere → chip-lista i egen modal. Nederst de visuelle
    // oversiktene. De fire nederste deler bredden likt (flex:1, to per rad).
    let btns = "";
    if (opts.onSlektstre) {
      btns += `<div style="display:flex;margin-bottom:10px">`;
      btns += `<button class="btn primary" id="btn-slektstre" style="flex:1">Sjangertre</button>`;
      btns += `</div>`;
    }
    btns += `<div style="display:flex;gap:10px;margin-bottom:10px">`;
    btns += `<button class="btn ghost" id="btn-hovedsjangere" style="flex:1">Hovedsjangere</button>`;
    btns += `<button class="btn ghost" id="btn-undersjangere" style="flex:1">Undersjangere</button>`;
    btns += `</div>`;
    btns += `<div style="display:flex;gap:10px;margin-bottom:14px">`;
    btns += `<button class="btn ghost" id="btn-varmekart" style="flex:1">Varmekart</button>`;
    btns += `<button class="btn ghost" id="btn-tidslinje" style="flex:1">Tidslinje</button>`;
    btns += `</div>`;
    slExtra.innerHTML = btns;
    slExtra.querySelector("#btn-hovedsjangere").addEventListener("click", () => openHistorier());
    slExtra.querySelector("#btn-undersjangere").addEventListener("click", openUndersjangre);
    const treBtn = slExtra.querySelector("#btn-slektstre");
    if (treBtn) treBtn.addEventListener("click", () => opts.onSlektstre());
    slExtra.querySelector("#btn-varmekart").addEventListener("click", openVarmekart);
    slExtra.querySelector("#btn-tidslinje").addEventListener("click", () => openTidslinje());
  }

  // «Det store bildet»-hub: mål-modalene åpnes OPPÅ huben (modaler stables),
  // så ← i undermodalen går naturlig tilbake hit. Slektstreet bor på egen side
  // og navigerer bort — knappen skjules om siden ikke ga en handler.
  const sbModal = document.getElementById("modal-store-bildet");
  if (sbModal) {
    sbModal.querySelector("#sb-om-historie").addEventListener("click", openOmHistorie);
    sbModal.querySelector("#sb-rotter").addEventListener("click", openRotter);
    sbModal.querySelector("#sb-historier").addEventListener("click", () => openHistorier());
    sbModal.querySelector("#sb-tidslinje").addEventListener("click", () => openTidslinje());
    const sbTre = sbModal.querySelector("#sb-slektstre");
    if (opts.onSlektstre) sbTre.addEventListener("click", () => opts.onSlektstre());
    else sbTre.style.display = "none";
    sbModal.querySelector("#sb-varmekart").addEventListener("click", openVarmekart);
    sbModal.querySelector("#sb-kart").addEventListener("click", openKart);
    sbModal.querySelector("#sb-himmel").addEventListener("click", openSjangerhimmel);
    sbModal.querySelector("#sb-guide").addEventListener("click", openAppGuide);
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
    const sjBtn = e.target.closest("[data-sjanger]");
    if (sjBtn) {
      const name = sjBtn.dataset.sjanger;
      showSjangerInfo(name, sjangerOpts()) || showSubsjangerInfo(name, sjangerOpts());
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
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
  return {
    openDecadeList,
    openSubgenreList,
    openVarmekart,
    openTidslinje,
    openStoreBildet,
    openAppGuide,
    openOmHistorie,
    openRotter,
    openHistorier,
    openPodkast,
    openTeknologi,
    openTechDetail,
    refreshTechDetail,
    buildLinkCtx,
    showArtistsForSjanger,
    showPlaylistForMainGenre,
    onMainGenreClick,
    openSubgenreInfo,
    contentChanged,
  };
}
