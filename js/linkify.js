function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function linkifyArtists(text, artists) {
  if (!text || !artists || !artists.length) return esc(text);
  const active = artists.filter(a => a.status === "active" && a.name);
  if (!active.length) return esc(text);
  const sorted = active.slice().sort((a, b) => b.name.length - a.name.length);
  const escaped = esc(text);
  const markers = [];
  const lowerEscaped = escaped.toLowerCase();
  for (const a of sorted) {
    const nameEsc = esc(a.name);
    const needle = nameEsc.toLowerCase();
    let pos = 0;
    while ((pos = lowerEscaped.indexOf(needle, pos)) !== -1) {
      const end = pos + nameEsc.length;
      if (!markers.some(m => (pos < m.end && end > m.start))) {
        markers.push({ start: pos, end, id: a.id, original: escaped.slice(pos, end) });
      }
      pos = end;
    }
  }
  if (!markers.length) return escaped;
  markers.sort((a, b) => a.start - b.start);
  let result = "";
  let last = 0;
  for (const m of markers) {
    result += escaped.slice(last, m.start);
    result += `<a class="artist-link" data-artist-id="${esc(m.id)}">${m.original}</a>`;
    last = m.end;
  }
  result += escaped.slice(last);
  return result;
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
