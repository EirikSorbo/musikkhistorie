// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeArtists, subscribeSubgenres } from "./store.js";
import { renderGenealogy } from "./genealogy.js";
import { escapeHtml, renderArtistDetail, buildPlaylistHtml, buildArtistListRows } from "./ui.js";
import { CONFIGURED } from "./shared.js"; // setter også versjonsmerket

// Stabil referanse som genealogy.js leser fra ved klikk – mutér innholdet
const subDescs = {};
let artists = [];
let api = null;

// Klikk på «Vis artister» → vis en slank liste i et popup-vindu
function showArtistsForGenre({ label }) {
  const sj = label.toLowerCase();
  const list = artists
    .filter((a) => a.status === "active" && (a.genre === label || (a.subgenres || []).some((s) => s.toLowerCase() === sj)))
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));

  document.getElementById("modal-sjanger").classList.remove("open");
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
      row.addEventListener("click", (e) => { if (!e.target.closest("a")) open(); });
      row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  document.getElementById("modal-artistliste").classList.add("open");
}

// Vis artist-detalj i eget popup; skjul artistlisten midlertidig
function showArtistDetail(a) {
  document.getElementById("modal-artistliste").classList.remove("open");
  document.getElementById("ad-title").textContent = a.name;
  renderArtistDetail(document.getElementById("ad-body"), a, {});
  document.getElementById("modal-artist-detail").classList.add("open");
}

// Klikk på «Vis spilleliste» → samle alle musikkeksempler for sjangeren
function showPlaylistForGenre({ label, fullName, node }) {
  const { total, html } = buildPlaylistHtml(node, artists);
  document.getElementById("modal-sjanger").classList.remove("open");
  document.getElementById("pl-title").textContent = `${fullName} — spilleliste (${total})`;
  document.getElementById("pl-body").innerHTML = html;
  document.getElementById("modal-spilleliste").classList.add("open");
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

// Lukking av artist-liste-popup
const alModal = document.getElementById("modal-artistliste");
alModal.addEventListener("click", (e) => { if (e.target === alModal) alModal.classList.remove("open"); });
alModal.querySelector(".modal-close").addEventListener("click", () => alModal.classList.remove("open"));

// Lukking av artist-detalj → vis artistlisten igjen
const adModal = document.getElementById("modal-artist-detail");
const closeDetail = () => { adModal.classList.remove("open"); alModal.classList.add("open"); };
adModal.addEventListener("click", (e) => { if (e.target === adModal) closeDetail(); });
adModal.querySelector(".modal-close").addEventListener("click", closeDetail);

// Lukking av spilleliste-popup
const plModal = document.getElementById("modal-spilleliste");
plModal.addEventListener("click", (e) => { if (e.target === plModal) plModal.classList.remove("open"); });
plModal.querySelector(".modal-close").addEventListener("click", () => plModal.classList.remove("open"));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (adModal.classList.contains("open")) closeDetail();
    else if (plModal.classList.contains("open")) plModal.classList.remove("open");
    else alModal.classList.remove("open");
  }
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
