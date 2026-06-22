function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function linkifyArtists(text, artists, techItems) {
  if (!text) return esc(text);
  const escaped = esc(text);
  const markers = [];
  const lowerEscaped = escaped.toLowerCase();

  const activeArtists = (artists || []).filter(a => a.status === "active" && a.name);
  const sorted = activeArtists.slice().sort((a, b) => b.name.length - a.name.length);
  for (const a of sorted) {
    findMatches(lowerEscaped, escaped, esc(a.name), a.id, "artist", markers);
  }

  const techs = (techItems || []).filter(t => t.name).slice().sort((a, b) => b.name.length - a.name.length);
  for (const t of techs) {
    findMatches(lowerEscaped, escaped, esc(t.name), t.id, "tech", markers);
  }

  if (!markers.length) return escaped;
  markers.sort((a, b) => a.start - b.start);
  let result = "";
  let last = 0;
  for (const m of markers) {
    result += escaped.slice(last, m.start);
    if (m.type === "artist") {
      result += `<a class="artist-link" data-artist-id="${esc(m.id)}">${m.original}</a>`;
    } else {
      result += `<a class="tech-link" data-tech-id="${esc(m.id)}">${m.original}</a>`;
    }
    last = m.end;
  }
  result += escaped.slice(last);
  return result;
}

function findMatches(lowerHaystack, haystack, nameEsc, id, type, markers) {
  const needle = nameEsc.toLowerCase();
  let pos = 0;
  while ((pos = lowerHaystack.indexOf(needle, pos)) !== -1) {
    const end = pos + nameEsc.length;
    if (!markers.some(m => (pos < m.end && end > m.start))) {
      markers.push({ start: pos, end, id, type, original: haystack.slice(pos, end) });
    }
    pos = end;
  }
}

export function wireArtistLinks(container, artists, onClick) {
  if (!onClick) return;
  container.querySelectorAll(".artist-link[data-artist-id]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const a = artists.find(x => x.id === link.dataset.artistId);
      if (a) onClick(a);
    });
  });
}

export function wireTechLinks(container, techItems, onClick) {
  if (!onClick) return;
  container.querySelectorAll(".tech-link[data-tech-id]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const t = techItems.find(x => x.id === link.dataset.techId);
      if (t) onClick(t);
    });
  });
}
