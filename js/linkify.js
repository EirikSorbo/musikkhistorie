import { escapeHtml as esc } from "./util.js?v=3.48";

// Ord som ikke skal bli klikkbare linker (for vanlige/hyppige termer):
const SKIP = new Set(["jazz", "blues", "country", "gospel"]);

// Lenkemålene (aktive artister, tech, sjangre) filtreres, sorteres og escapes
// LIKT for hver eneste beskrivelse i et render-pass. Vi forbereder dem derfor
// én gang per link-kontekst og memoiserer på kontekst-referansen: buildLinkCtx()
// lager et nytt objekt ved hvert render-pass, så cachen invalideres naturlig når
// dataene endres, og WeakMap slipper gamle kontekster til søppelrydding.
const _targetsCache = new WeakMap();

function prepareTargets(ctx) {
  const cached = _targetsCache.get(ctx);
  if (cached) return cached;
  const artists = (ctx.artists || [])
    .filter((a) => a.status === "active" && (a.priority || 0) !== -1 && a.name && !SKIP.has(a.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)
    .map((a) => ({ id: a.id, nameEsc: esc(a.name) }));
  const techItems = (ctx.techItems || [])
    .filter((t) => t.name && !SKIP.has(t.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)
    .map((t) => ({ id: t.id, nameEsc: esc(t.name) }));
  const genres = (ctx.genres || [])
    .filter((g) => !SKIP.has(g.toLowerCase()))
    .sort((a, b) => b.length - a.length)
    .map((g) => ({ id: g, nameEsc: esc(g) }));
  const prep = { artists, techItems, genres };
  _targetsCache.set(ctx, prep);
  return prep;
}

export function linkifyAll(text, ctx = {}) {
  if (!text) return esc(text);
  const escaped = esc(text);
  const markers = [];
  const lower = escaped.toLowerCase();

  const { artists, techItems, genres } = prepareTargets(ctx);
  for (const a of artists) findMatches(lower, escaped, a.nameEsc, a.id, "artist", markers);
  for (const t of techItems) findMatches(lower, escaped, t.nameEsc, t.id, "tech", markers);
  for (const g of genres) findMatches(lower, escaped, g.nameEsc, g.id, "genre", markers);

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
