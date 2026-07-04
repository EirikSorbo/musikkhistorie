// ============================================================================
//  TIDSLINJE-BANER — ren logikk for artist-aktivitets-tidslinjen
// ----------------------------------------------------------------------------
//  Regner ut aktiv-perioder og pakker artister i færrest mulige horisontale
//  baner per sjangerseksjon (grådig intervall-pakking). Avhengighetsfri og
//  DOM-fri, så modulen kan enhetstestes i Node. Renderingen bor i explore.js.
// ============================================================================

// Aktiv-perioden til en artist:
//   start = influenceStart (påkrevd — uten den kan artisten ikke plasseres)
//   end   = influenceEnd, ellers deathYear som tak, ellers ÅPEN (pågår/ukjent)
// Returnerer { start, end, open } eller null. `end` er alltid et tall
// (nowYear for åpne), `open` sier om høyre ende er kjent eller ikke.
export function resolveSpan(artist, nowYear) {
  const start = Number(artist?.influenceStart);
  if (!Number.isFinite(start) || start <= 0) return null;
  const infEnd = Number(artist?.influenceEnd);
  const death = Number(artist?.deathYear);
  let end = null;
  if (Number.isFinite(infEnd) && infEnd >= start) end = infEnd;
  else if (Number.isFinite(death) && death >= start) end = death;
  if (end != null) return { start, end, open: false };
  return { start, end: nowYear, open: true };
}

// Grådig banepakking: sorter på start, legg hvert element i første bane der
// forrige element sluttet minst `gap` år tidligere. `visualEnd` (span-slutt,
// men minst start+minSpan) brukes både til pakking og bredde, så korte
// perioder får plass til navnet uten å overlappe naboen.
export function packLanes(items, { gap = 3, minSpan = 6 } = {}) {
  const sorted = [...items].sort((a, b) => a.span.start - b.span.start || String(a.name).localeCompare(String(b.name), "no"));
  const lanes = [];
  for (const item of sorted) {
    const visualEnd = Math.max(item.span.end, item.span.start + minSpan);
    let lane = lanes.find((L) => L.last + gap <= item.span.start);
    if (!lane) { lane = { last: -Infinity, items: [] }; lanes.push(lane); }
    lane.items.push({ ...item, visualEnd });
    lane.last = visualEnd;
  }
  return lanes.map((L) => L.items);
}

// Tidsaksens ytterpunkter for et sett spans: hele tiår som omslutter alt.
export function timelineBounds(spans, nowYear) {
  if (!spans.length) return { y0: 1900, y1: Math.ceil((nowYear + 1) / 10) * 10 };
  const min = Math.min(...spans.map((s) => s.start));
  const max = Math.max(...spans.map((s) => s.end));
  return {
    y0: Math.floor(min / 10) * 10,
    y1: Math.max(Math.ceil((max + 1) / 10) * 10, Math.ceil((nowYear + 1) / 10) * 10),
  };
}
