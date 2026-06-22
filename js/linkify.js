function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Ord som ikke skal bli klikkbare linker (for vanlige/hyppige termer):
const SKIP = new Set(["jazz", "blues", "country", "gospel"]);

export function linkifyAll(text, { artists, techItems, genres } = {}) {
  if (!text) return esc(text);
  const escaped = esc(text);
  const markers = [];
  const lower = escaped.toLowerCase();

  const activeArtists = (artists || []).filter(a => a.status === "active" && a.name && !SKIP.has(a.name.toLowerCase()));
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

export function linkifyArtists(text, artists, techItems, genres) {
  return linkifyAll(text, { artists, techItems, genres });
}

function isWordChar(ch) {
  if (!ch) return false;
  if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) return true;
  if (ch >= "0" && ch <= "9") return true;
  const c = ch.charCodeAt(0);
  return c >= 0xC0 && c !== 0xD7 && c !== 0xF7;
}

function findMatches(lowerHaystack, haystack, nameEsc, id, type, markers) {
  const needle = nameEsc.toLowerCase();
  let pos = 0;
  while ((pos = lowerHaystack.indexOf(needle, pos)) !== -1) {
    const end = pos + nameEsc.length;
    const before = pos > 0 ? lowerHaystack[pos - 1] : "";
    const after = end < lowerHaystack.length ? lowerHaystack[end] : "";
    if (!isWordChar(before) && !isWordChar(after) && before !== "-" && after !== "-" &&
        !markers.some(m => (pos < m.end && end > m.start))) {
      markers.push({ start: pos, end, id, type, original: haystack.slice(pos, end) });
    }
    pos = end;
  }
}

export function wireAllLinks(container, { artists, techItems, onArtistClick, onTechClick, onGenreClick } = {}) {
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
  if (onGenreClick) {
    container.querySelectorAll(".genre-link[data-genre]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        onGenreClick(link.dataset.genre);
      });
    });
  }
}

export function wireArtistLinks(container, artists, onClick) {
  wireAllLinks(container, { artists, onArtistClick: onClick });
}

export function wireTechLinks(container, techItems, onClick) {
  wireAllLinks(container, { techItems, onTechClick: onClick });
}
