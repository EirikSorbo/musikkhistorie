// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeArtists, subscribeSubgenres, subscribeTech } from "./store.js";
import { renderGenealogy, showSjangerInfo } from "./genealogy.js?v=2.32";
import { renderArtistDetail, renderTechDetail, openArtistListModal, openPlaylistModal, artistsInGenre, artistsByInstrument, showSubsjangerInfo, modalOpen, modalClose, modalCloseTop, buildMainGenreList } from "./ui.js?v=2.32";
import { CONFIGURED } from "./shared.js";

const subDescs = {};
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

function buildLc() {
  return {
    artists,
    techItems,
    genres: buildMainGenreList(artists),
    onArtistClick: showArtistDetail,
    onTechClick: showTechDetail,
    onMainGenreClick,
  };
}

function showArtistDetail(a) {
  document.getElementById("ad-title").textContent = a.name;
  renderArtistDetail(document.getElementById("ad-body"), a, {}, buildLc());
  modalOpen(document.getElementById("modal-artist-detail"));
}

function showTechDetail(t) {
  document.getElementById("td-title").textContent = t.name;
  renderTechDetail(document.getElementById("td-body"), t, buildLc());
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
    subgenreDescs: subDescs,
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

// Lukking av artist-liste
const alModal = document.getElementById("modal-artistliste");
alModal.addEventListener("click", (e) => { if (e.target === alModal) modalClose(alModal); });
alModal.querySelector(".modal-close").addEventListener("click", () => modalClose(alModal));

// Lukking av artist-detalj
const adModal = document.getElementById("modal-artist-detail");
adModal.addEventListener("click", (e) => { if (e.target === adModal) modalClose(adModal); });
adModal.querySelector(".modal-close").addEventListener("click", () => modalClose(adModal));

// Lukking av spilleliste → tilbake til sjanger-popup
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
plCloseBtn.className = "btn ghost small";
plModal.addEventListener("click", (e) => { if (e.target === plModal) closePl(); });
plCloseBtn.addEventListener("click", closePl);

// Lukking av sjanger-info
const sjModal = document.getElementById("modal-sjanger");
sjModal.addEventListener("click", (e) => { if (e.target === sjModal) modalClose(sjModal); });
sjModal.querySelector(".modal-close").addEventListener("click", () => modalClose(sjModal));

const sjangerOpts = () => ({
  root: document,
  subgenreDescs: subDescs,
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

build();
window.addEventListener("resize", () => { if (api) api.fit(); });

if (CONFIGURED) {
  subscribeSubgenres((s) => {
    Object.keys(subDescs).forEach((k) => delete subDescs[k]);
    Object.assign(subDescs, s);
  });
  subscribeArtists((a) => { artists = a; });
  subscribeTech((t) => { techItems = t; });
}
