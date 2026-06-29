import { escapeHtml as esc } from "./util.js?v=2.60";

// Ord som ikke skal bli klikkbare linker (for vanlige/hyppige termer):
const SKIP = new Set(["jazz", "blues", "country", "gospel"]);

export function linkifyAll(text, { artists, techItems, genres } = {}) {
  if (!text) return esc(text);
  const escaped = esc(text);
  const markers = [];
  const lower = escaped.toLowerCase();

  const activeArtists = (artists || []).filter(a => a.status === "active" && (a.priority || 0) !== -1 && a.name && !SKIP.has(a.name.toLowerCase()));
  activeArtists.sort((a, b) => b.name.length - a.name.length);
  for (const a of activeArtists) {
    findMatches(lower, escaped, esc(a.name), a.id, "artist", markers);
  }

  const techs = (techItems || []).filter(t => t.name && !SKIP.has(t.name.toLowerCase())).slice().sort((a, b) => b.name.length - a.name.length);
  for (const t of techs) {
    findMatches(lower, escaped, esc(t.name), t.id, "tech", markers);
  }

  const genreList = (genres || []).filter(g => !SKIP.has(g.toLowerCase())).slice().sort((a, b) => b.length - a.length);
  for (const g of genreList) {
    findMatches(lower, escaped, esc(g), g, "genre", markers);
  }

  if (!markers.length) return escaped;
  markers.sort((a, b) => a.start - b.start);
  let result = "";
  let last = 0;
  for (const m of markers) {
    result += escaped.slice(last, m.start);
    if (m.type === "artist") {
      result += `<a class="artist-link" data-artist-id="${esc(m.id)}">${m.original}</a>`;
    } else if (m.type === "tech") {
      result += `<a class="tech-link" data-tech-id="${esc(m.id)}">${m.original}</a>`;
    } else {
      result += `<a class="genre-link" data-genre="${esc(m.id)}">${m.original}</a>`;
    }
    last = m.end;
  }
  result += escaped.slice(last);
  return result;
}

function isWordChar(ch) {
  if (!ch) return false;
  if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) return true;
  if (ch >= "0" && ch <= "9") return true;
  const c = ch.charCodeAt(0);
  return c >= 0xC0 && c !== 0xD7 && c !== 0xF7;
}

// Curly/smart apostrophes after a name signal genitive ('s or ').
// Straight apostrophe (U+0027) is HTML-escaped to &#39;, so the char after becomes '&'
// which already passes the word-boundary check without special handling.
function isGenitiveSuffix(ch) {
  return ch === "‘" || ch === "’" || ch === "ʼ";
}

function findMatches(lowerHaystack, haystack, nameEsc, id, type, markers) {
  const needle = nameEsc.toLowerCase();
  let pos = 0;
  while ((pos = lowerHaystack.indexOf(needle, pos)) !== -1) {
    const end = pos + nameEsc.length;
    const before = pos > 0 ? lowerHaystack[pos - 1] : "";
    const after = end < lowerHaystack.length ? lowerHaystack[end] : "";
    const afterAfter = end + 1 < lowerHaystack.length ? lowerHaystack[end + 1] : "";
    const afterIsGenitiveS = after === "s" && !isWordChar(afterAfter);
    const afterOk = !isWordChar(after) || isGenitiveSuffix(after) || afterIsGenitiveS;
    if (!isWordChar(before) && afterOk && before !== "-" && after !== "-" &&
        !markers.some(m => (pos < m.end && end > m.start))) {
      markers.push({ start: pos, end, id, type, original: haystack.slice(pos, end) });
    }
    pos = end;
  }
}

export function wireAllLinks(container, { artists, techItems, onArtistClick, onTechClick, onMainGenreClick } = {}) {
  if (onArtistClick) {
    container.querySelectorAll(".artist-link[data-artist-id]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const a = (artists || []).find(x => x.id === link.dataset.artistId);
        if (a) onArtistClick(a);
      });
    });
  }
  if (onTechClick) {
    container.querySelectorAll(".tech-link[data-tech-id]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const t = (techItems || []).find(x => x.id === link.dataset.techId);
        if (t) onTechClick(t);
      });
    });
  }
  if (onMainGenreClick) {
    container.querySelectorAll(".genre-link[data-genre]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        onMainGenreClick(link.dataset.genre);
      });
    });
  }
}
