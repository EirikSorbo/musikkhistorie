// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeArtists, subscribeSubgenres } from "./store.js";
import { renderGenealogy } from "./genealogy.js";
import { escapeHtml } from "./ui.js";
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
    body.innerHTML = `<div class="result-list">${list.map((a) => {
      const years = a.influenceStart ? `${a.influenceStart}${a.influenceEnd ? "–" + a.influenceEnd : ""}` : "";
      return `<div class="result-row is-static">
        <span class="result-name">${escapeHtml(a.name)}</span>
        <span class="result-meta">
          ${a.genre ? `<span class="tag">${escapeHtml(a.genre)}</span>` : ""}
          ${a.instrument ? `<span class="tag">${escapeHtml(a.instrument)}</span>` : ""}
          ${years ? `<span class="result-work">${years}</span>` : ""}
        </span>
      </div>`;
    }).join("")}</div>`;
  }
  document.getElementById("modal-artistliste").classList.add("open");
}

function build() {
  if (api) return;
  api = renderGenealogy({
    root: document,
    subgenreDescs: subDescs,
    onShowArtists: showArtistsForGenre,
  });
  requestAnimationFrame(() => api.fit());
}

// Lukking av artist-liste-popup
const alModal = document.getElementById("modal-artistliste");
alModal.addEventListener("click", (e) => { if (e.target === alModal) alModal.classList.remove("open"); });
alModal.querySelector(".modal-close").addEventListener("click", () => alModal.classList.remove("open"));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") alModal.classList.remove("open"); });

build();
window.addEventListener("resize", () => { if (api) api.fit(); });

if (CONFIGURED) {
  subscribeSubgenres((s) => {
    Object.keys(subDescs).forEach((k) => delete subDescs[k]);
    Object.assign(subDescs, s);
  });
  subscribeArtists((a) => { artists = a; });
}
