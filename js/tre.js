// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeArtists, subscribeGenreDescs, subscribeEdgeDescs, subscribeTech } from "./store.js?v=3.65";
import { renderGenealogy, showSjangerInfo } from "./genealogy.js?v=3.65";
import { renderArtistDetail, renderTechDetail, openArtistListModal, openPlaylistModal, artistsInGenre, artistsByInstrument, showSubsjangerInfo, modalOpen, modalClose, modalCloseTop, setupModal, buildMainGenreList } from "./ui.js?v=3.65";
import { CONFIGURED, wireFirestoreErrorBanner } from "./shared.js?v=3.65";
import { SJANGER_MODAL_HTML, ARTISTLISTE_MODAL_HTML, SPILLELISTE_MODAL_HTML, TECH_DETAIL_MODAL_HTML } from "./ui-modal-fragments.js?v=3.65";

// De delte modalene (samme fragmenter som forsiden får via explore.js)
// injiseres FØR modal-oppsettet under, så markupen aldri driver fra forsiden.
const modalWrap = document.createElement("div");
modalWrap.innerHTML = [SJANGER_MODAL_HTML, ARTISTLISTE_MODAL_HTML, SPILLELISTE_MODAL_HTML, TECH_DETAIL_MODAL_HTML].join("");
document.body.appendChild(modalWrap);

const subDescs = {};
// Koblingsbeskrivelser (strekene). Mutert på plass (som subDescs), så
// renderGenealogy leser alltid ferskeste data via samme objektreferanse.
const edgeDescs = {};
let artists = [];
let techItems = [];
let api = null;
let lastSjangerLabel = null;

function showArtistsForMainGenre({ label }) {
  openArtistListModal(label, artistsInGenre(artists, label), showArtistDetail, "Ingen forslag i denne sjangeren ennå.");
}

function onMainGenreClick(genre) {
  const opts = sjangerOpts();
  showSjangerInfo(genre, opts) || showSubsjangerInfo(genre, opts);
}

function showArtistDetail(a) {
  document.getElementById("ad-title").textContent = a.name;
  renderArtistDetail(document.getElementById("ad-body"), a, {}, sjangerOpts());
  modalOpen(document.getElementById("modal-artist-detail"));
}

function showTechDetail(t) {
  document.getElementById("td-title").textContent = t.name;
  renderTechDetail(document.getElementById("td-body"), t, sjangerOpts());
  modalOpen(document.getElementById("modal-tech-detail"));
}

function showArtistsForInstrument(instrument) {
  openArtistListModal(instrument, artistsByInstrument(artists, instrument), showArtistDetail, "Ingen forslag med dette instrumentet ennå.");
}

function showPlaylistForMainGenre({ label, fullName, node }) {
  lastSjangerLabel = label;
  openPlaylistModal(fullName, node, artists);
}

function openSjangerInfo(label) {
  showSjangerInfo(label, sjangerOpts());
}

function build() {
  if (api) return;
  api = renderGenealogy({
    root: document,
    genreDescs: subDescs,
    edgeDescs,
    getArtists: () => artists,
    getTechItems: () => techItems,
    getMainGenres: () => buildMainGenreList(artists),
    onArtistClick: showArtistDetail,
    onTechClick: showTechDetail,
    onMainGenreClick,
    onShowArtists: showArtistsForMainGenre,
    onShowPlaylist: showPlaylistForMainGenre,
  });
  requestAnimationFrame(() => api.fit());
}

// Lukking av artist-liste, artist-detalj og sjanger-info
setupModal("modal-artistliste");
setupModal("modal-artist-detail");
setupModal("modal-sjanger");
setupModal("modal-tech-detail");

// Spilleliste → går «tilbake» til sjanger-popup ved lukking
const plModal = document.getElementById("modal-spilleliste");
const closePl = () => {
  modalClose(plModal);
  if (lastSjangerLabel) {
    const lbl = lastSjangerLabel;
    lastSjangerLabel = null;
    openSjangerInfo(lbl);
  }
};
const plCloseBtn = plModal.querySelector(".modal-close");
plCloseBtn.textContent = "← Tilbake";
// classList.add (ikke className=) så .modal-close beholdes — ellers finner
// setupModal ingen lukkeknapp å binde closePl til, og «← Tilbake» blir død.
plCloseBtn.classList.add("btn", "ghost", "small");
setupModal(plModal, closePl);

// Delt opts/link-kontekst: brukes både som argument til showSjangerInfo/
// showSubsjangerInfo OG som link-kontekst i artist-/tech-detaljene (de leser
// bare feltene de trenger, så ekstra callbacks er harmløse).
const sjangerOpts = () => ({
  root: document,
  genreDescs: subDescs,
  artists,
  techItems,
  genres: buildMainGenreList(artists),
  onArtistClick: showArtistDetail,
  onTechClick: showTechDetail,
  onMainGenreClick,
  onShowArtists: showArtistsForMainGenre,
  onShowPlaylist: showPlaylistForMainGenre,
});

document.addEventListener("click", (e) => {
  const sj = e.target.closest("[data-sjanger]");
  if (sj) {
    openSjangerInfo(sj.dataset.sjanger);
    return;
  }
  const underBtn = e.target.closest("[data-under]");
  if (underBtn) {
    showSubsjangerInfo(underBtn.dataset.under, sjangerOpts());
    return;
  }
  const inst = e.target.closest("[data-instrument]");
  if (inst) showArtistsForInstrument(inst.dataset.instrument);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") modalCloseTop();
});

// «← Tilbake» på selve siden (treet er en side, ikke en modal). Har man kommet
// hit fra Det store bildet eller et artistkort, går history.back() dit. Åpnet
// man tre.html direkte (ingen historikk å gå tilbake i), faller vi til
// forsiden, så knappen aldri er en blindvei.
document.getElementById("gx-back")?.addEventListener("click", () => {
  if (window.history.length > 1) window.history.back();
  else window.location.href = "index.html";
});

build();
// Kun refit når stagens BREDDE faktisk endrer seg. På mobil fyrer resize også
// når adressefeltet kollapser/ekspanderer (kun høyde) — da skal ikke brukerens
// zoom/pan nullstilles. Bredde-endring (rotasjon, vindusstørrelse) refit-er.
let lastStageW = document.getElementById("gx-stage")?.clientWidth || 0;
window.addEventListener("resize", () => {
  if (!api) return;
  const w = document.getElementById("gx-stage")?.clientWidth || 0;
  if (Math.abs(w - lastStageW) > 2) { lastStageW = w; api.fit(); }
});

if (CONFIGURED) {
  wireFirestoreErrorBanner();
  subscribeGenreDescs((s) => {
    Object.keys(subDescs).forEach((k) => delete subDescs[k]);
    Object.assign(subDescs, s);
  });
  subscribeEdgeDescs((m) => {
    Object.keys(edgeDescs).forEach((k) => delete edgeDescs[k]);
    Object.assign(edgeDescs, m);
  });
  subscribeArtists((a) => { artists = a; });
  // Skjul ikke-godkjente (pending) innovasjonskort for studenter, som på forsiden.
  subscribeTech((t) => { techItems = t.filter((x) => x.status !== "pending"); });
}
