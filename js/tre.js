// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeArtists, subscribeSubgenres } from "./store.js";
import { renderGenealogy } from "./genealogy.js";
import { CONFIGURED } from "./shared.js"; // setter også versjonsmerket

// Stabil referanse som genealogy.js leser fra ved klikk – mutér innholdet
const subDescs = {};
let artists = [];
let api = null;

// Klikk på «Vis artister» → gå til startsiden med filter
function showArtistsForGenre({ label, genre }) {
  const hasSub = artists.some(
    (a) => a.status === "active" && (a.subgenres || []).some((s) => s.toLowerCase() === label.toLowerCase())
  );
  const q = hasSub
    ? "subgenre=" + encodeURIComponent(label)
    : (genre ? "genre=" + encodeURIComponent(genre) : "");
  window.location.href = "index.html" + (q ? "?" + q : "");
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

build();
window.addEventListener("resize", () => { if (api) api.fit(); });

if (CONFIGURED) {
  subscribeSubgenres((s) => {
    Object.keys(subDescs).forEach((k) => delete subDescs[k]);
    Object.assign(subDescs, s);
  });
  subscribeArtists((a) => { artists = a; });
}
