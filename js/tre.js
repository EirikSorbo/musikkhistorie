// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeSubgenres } from "./store.js";
import { renderGenealogy } from "./genealogy.js";
import { CONFIGURED } from "./shared.js"; // setter også versjonsmerket

// Stabil referanse som genealogy.js leser fra ved klikk – mutér innholdet
const subDescs = {};
let api = null;

// Klikk på «Vis artister» → gå til startsiden og filtrer på sjangeren
function showArtistsForGenre({ label }) {
  window.location.href = "index.html?sjanger=" + encodeURIComponent(label);
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
}
