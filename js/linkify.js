import { escapeHtml as esc } from "./util.js?v=6.11";

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

// Kortets EGEN ting skal ikke lenkes i kortets tekst (v6.05, strukturgjennom-
// gangen K7): Bebop-kortet lenket ordet «bebop» til seg selv, og Grandmaster
// Flash-kortet navnet hans tre ganger. medSelv legger kortet ved konteksten
// UTEN å miste mellomlageret over: _base peker på den opprinnelige
// konteksten, som prepareTargets er memoisert på. self: { artist: id,
// tech: id, genre: navn eller [etikett, fullt navn] }.
export function medSelv(ctx, self) {
  return { ...(ctx || {}), self, _base: ctx?._base || ctx || {} };
}

export function linkifyAll(text, ctx = {}) {
  if (!text) return esc(text);
  const escaped = esc(text);
  const markers = [];
  const lower = escaped.toLowerCase();

  const { artists, techItems, genres } = prepareTargets(ctx._base || ctx);
  // Egne treff blir «self»-markører: de lenkes ikke, men holder plassen sin,
  // så et kortere navn aldri kan lenkes midt inni kortets eget navn.
  const self = ctx.self || {};
  const selvSjangre = new Set([].concat(self.genre || []));
  for (const a of artists) findMatches(lower, escaped, a.nameEsc, a.id, a.id === self.artist ? "self" : "artist", markers);
  for (const t of techItems) findMatches(lower, escaped, t.nameEsc, t.id, t.id === self.tech ? "self" : "tech", markers);
  for (const g of genres) findMatches(lower, escaped, g.nameEsc, g.id, selvSjangre.has(g.id) ? "self" : "genre", markers);

  if (!markers.length) return escaped;
  markers.sort((a, b) => a.start - b.start);
  let result = "";
  let last = 0;
  for (const m of markers) {
    result += escaped.slice(last, m.start);
    // tabindex + role: ankere UTEN href står utenfor tab-rekkefølgen, så uten
    // disse var alle klikkbare navn i løpende tekst mus/berøring-only.
    if (m.type === "self") {
      result += m.original;
    } else if (m.type === "artist") {
      result += `<a class="artist-link" data-artist-id="${esc(m.id)}" tabindex="0" role="button">${m.original}</a>`;
    } else if (m.type === "tech") {
      result += `<a class="tech-link" data-tech-id="${esc(m.id)}" tabindex="0" role="button">${m.original}</a>`;
    } else {
      result += `<a class="genre-link" data-genre="${esc(m.id)}" tabindex="0" role="button">${m.original}</a>`;
    }
    last = m.end;
  }
  result += escaped.slice(last);
  return result;
}

// Artistene en tekst nevner, som id-er, med NØYAKTIG samme treffregler som
// lenkingen over (v6.05, K3: «Beslektede artister» bruker dem). ctx trenger
// bare { artists }.
export function nevnteArtister(text, ctx = {}) {
  if (!text) return [];
  const escaped = esc(text);
  const lower = escaped.toLowerCase();
  const markers = [];
  for (const a of prepareTargets(ctx._base || ctx).artists) findMatches(lower, escaped, a.nameEsc, a.id, "artist", markers);
  return [...new Set(markers.map((m) => m.id))];
}

// Nevner teksten navnet (samme treffregler som lenkingen)? Brukt av
// innovasjonskortet for «Artister som nevner den» (v6.07, K6).
export function nevnerNavn(text, navn) {
  if (!text || !navn) return false;
  const escaped = esc(text);
  const markers = [];
  findMatches(escaped.toLowerCase(), escaped, esc(navn), "x", "x", markers);
  return markers.length > 0;
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

// Klikk OG tastatur (Enter/mellomrom) — lenkene har role="button", så de skal
// oppføre seg som knapper for tastaturbrukere.
function wireLink(link, fn) {
  link.addEventListener("click", (e) => { e.preventDefault(); fn(); });
  link.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    fn();
  });
}

export function wireAllLinks(container, { artists, techItems, onArtistClick, onTechClick, onMainGenreClick } = {}) {
  if (onArtistClick) {
    container.querySelectorAll(".artist-link[data-artist-id]").forEach(link => {
      wireLink(link, () => {
        const a = (artists || []).find(x => x.id === link.dataset.artistId);
        if (a) onArtistClick(a);
      });
    });
  }
  if (onTechClick) {
    container.querySelectorAll(".tech-link[data-tech-id]").forEach(link => {
      wireLink(link, () => {
        const t = (techItems || []).find(x => x.id === link.dataset.techId);
        if (t) onTechClick(t);
      });
    });
  }
  if (onMainGenreClick) {
    container.querySelectorAll(".genre-link[data-genre]").forEach(link => {
      wireLink(link, () => onMainGenreClick(link.dataset.genre));
    });
  }
}
