// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeArtists, subscribeSubgenres } from "./store.js";
import { renderGenealogy, showSjangerInfo } from "./genealogy.js";
import { escapeHtml, renderArtistDetail, buildPlaylistHtml, buildArtistListRows, showSubsjangerInfo, modalOpen, modalClose, modalCloseTop } from "./ui.js?v=165";
import { CONFIGURED } from "./shared.js";

const subDescs = {};
let artists = [];
let api = null;
let lastSjangerLabel = null;

function showArtistsForGenre({ label }) {
  const sj = label.toLowerCase();
  const list = artists
    .filter((a) => a.status === "active" && (
      a.genre === label
      || (a.sjangre || []).some((s) => s.toLowerCase() === sj)
      || (a.undersjangre || []).some((s) => s.toLowerCase() === sj)
    ))
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));

  document.getElementById("al-title").textContent = `${label} (${list.length})`;
  const body = document.getElementById("al-body");
  if (!list.length) {
    body.innerHTML = `<p class="muted empty">Ingen forslag i denne sjangeren ennå.</p>`;
  } else {
    body.innerHTML = `<div class="result-list">${buildArtistListRows(list)}</div>`;
    body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
      const open = () => {
        const a = list.find((x) => x.id === row.dataset.artistId);
        if (a) showArtistDetail(a);
      };
      row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
      row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  modalOpen(document.getElementById("modal-artistliste"));
}

function showArtistDetail(a) {
  document.getElementById("ad-title").textContent = a.name;
  renderArtistDetail(document.getElementById("ad-body"), a, {});
  modalOpen(document.getElementById("modal-artist-detail"));
}

function showArtistsForInstrument(instrument) {
  const list = artists
    .filter((a) => a.status === "active" && a.instrument === instrument)
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));

  document.getElementById("al-title").textContent = `${instrument} (${list.length})`;
  const body = document.getElementById("al-body");
  if (!list.length) {
    body.innerHTML = `<p class="muted empty">Ingen forslag med dette instrumentet ennå.</p>`;
  } else {
    body.innerHTML = `<div class="result-list">${buildArtistListRows(list)}</div>`;
    body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
      const open = () => {
        const a = list.find((x) => x.id === row.dataset.artistId);
        if (a) showArtistDetail(a);
      };
      row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
      row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  modalOpen(document.getElementById("modal-artistliste"));
}

function showPlaylistForGenre({ label, fullName, node }) {
  lastSjangerLabel = label;
  const { total, html } = buildPlaylistHtml(node, artists);
  document.getElementById("pl-title").textContent = `${fullName} — spilleliste (${total})`;
  document.getElementById("pl-body").innerHTML = html;
  modalOpen(document.getElementById("modal-spilleliste"));
}

function openSjangerInfo(label) {
  showSjangerInfo(label, {
    root: document,
    subgenreDescs: subDescs,
    onShowArtists: showArtistsForGenre,
    onShowPlaylist: showPlaylistForGenre,
  });
}

function build() {
  if (api) return;
  api = renderGenealogy({
    root: document,
    subgenreDescs: subDescs,
    onShowArtists: showArtistsForGenre,
    onShowPlaylist: showPlaylistForGenre,
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
  onShowArtists: showArtistsForGenre,
  onShowPlaylist: showPlaylistForGenre,
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
}
