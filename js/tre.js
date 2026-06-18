// ============================================================================
//  SLEKTSTRE-SIDEN — egen fane med Carta-kartet
// ============================================================================
import { subscribeArtists, subscribeSubgenres } from "./store.js";
import { renderGenealogy } from "./genealogy.js";
import { escapeHtml, renderArtistDetail } from "./ui.js";
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
      const enc = encodeURIComponent;
      return `<div class="result-row" data-artist-id="${escapeHtml(a.id)}" tabindex="0" role="button">
        <span class="result-name result-link">${escapeHtml(a.name)}</span>
        <span class="result-meta">
          ${a.genre ? `<a class="tag tag-link" href="index.html?genre=${enc(a.genre)}">${escapeHtml(a.genre)}</a>` : ""}
          ${a.instrument ? `<a class="tag tag-link" href="index.html?instrument=${enc(a.instrument)}">${escapeHtml(a.instrument)}</a>` : ""}
          ${years ? `<span class="result-work">${years}</span>` : ""}
        </span>
      </div>`;
    }).join("")}</div>`;

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
  const sj = label.toLowerCase();
  const enc = encodeURIComponent;
  const ytLink = (q, text) =>
    `<a href="https://www.youtube.com/results?search_query=${enc(q)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;

  // 1. Hardkodede eksempler fra slektstre-noden
  const nodeItems = (node.t || []).map((t) =>
    `<li class="pl-item">${ytLink(t, t)}</li>`
  );

  // 2. keyWorks + links fra Firestore-artister i sjangeren
  const genreArtists = artists
    .filter((a) => a.status === "active" && (a.genre === label || (a.subgenres || []).some((s) => s.toLowerCase() === sj)))
    .sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));

  // Dedupliser: direkte lenker (links) tar prioritet over keyWorks-søk med samme tittel+artist
  const seen = new Set(); // nøkkel: "artistnavn|tittel" — forhindrer både db-duplikater og søk+direktelenke-par
  const artistItems = genreArtists.flatMap((a) => {
    const rows = [];
    const nameLow = a.name.toLowerCase();
    // Direkte lenker først — disse får prioritet
    (a.links || []).forEach((l) => {
      const title = (l.label || l.url).toLowerCase();
      const key = `${nameLow}|${title}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ sort: a.influenceStart || 0, html: `<li class="pl-item"><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label || l.url)}</a> <span class="muted">— ${escapeHtml(a.name)}</span></li>` });
    });
    // keyWorks som søkelenker — hoppes over hvis direktelenke med samme tittel allerede finnes
    (a.keyWorks || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((w) => {
      const key = `${nameLow}|${w.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const q = `${w} ${a.name}`;
      rows.push({ sort: a.influenceStart || 0, html: `<li class="pl-item">${ytLink(q, w)} <span class="muted">— ${escapeHtml(a.name)}</span></li>` });
    });
    return rows;
  }).map((r) => r.html);

  const total = nodeItems.length + artistItems.length;
  document.getElementById("modal-sjanger").classList.remove("open");
  document.getElementById("pl-title").textContent = `${fullName} — spilleliste (${total})`;
  const body = document.getElementById("pl-body");
  if (!total) {
    body.innerHTML = `<p class="muted empty">Ingen musikkeksempler registrert for denne sjangeren ennå.</p>`;
  } else {
    const nodeSec = nodeItems.length
      ? `<p class="muted" style="font-size:0.8rem;margin:0 0 4px">Fra sjangerbeskrivelsen</p><ul class="pl-list">${nodeItems.join("")}</ul>`
      : "";
    const artistSec = artistItems.length
      ? `<p class="muted" style="font-size:0.8rem;margin:${nodeItems.length ? "12px" : "0"} 0 4px">Fra foreslåtte artister</p><ul class="pl-list">${artistItems.join("")}</ul>`
      : "";
    body.innerHTML = nodeSec + artistSec;
  }
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
