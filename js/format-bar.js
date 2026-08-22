// ============================================================================
//  FORMATLINJE — knappene over tekstfeltene
// ----------------------------------------------------------------------------
//  Setter inn markdown-light-tegnene som js/rich-text.js leser, så det læreren
//  (eller studenten som foreslår en endring) trykker inn, er nøyaktig det som
//  vises: **fet**, *kursiv*, «- punkt», «1. punkt» og «### Mellomtittel».
//
//  Linja bygges av JS og settes rett over feltet, så et nytt tekstfelt bare
//  trenger `data-format` i HTML-en. Verdiene: `data-format="full"` tar med
//  mellomtittel (lange tekster: historier, «les mer»), alt annet får det korte
//  settet. Feltene leses fortsatt med .value som før — formatlinja rører kun
//  tekstinnholdet, aldri lagringen.
//
//  Knappene er de samme funksjonene som historie-editoren brukte fra før
//  (seWrap/sePrefix), flyttet hit så det finnes ÉN implementasjon.
// ============================================================================

// Omslutt markeringen med et tegnpar (**fet** / *kursiv*). Uten markering
// settes ordet «tekst» inn og markeres, så neste tastetrykk overskriver det.
export function wrapSelection(ta, marker, onChange) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const valgt = v.slice(s, e) || "tekst";
  ta.setRangeText(marker + valgt + marker, s, e, "select");
  ta.focus();
  onChange?.();
}

// Sett blokkprefiks (mellomtittel/liste) på hver markerte linje. Eksisterende
// blokkprefiks byttes ut, så knappene ikke stabler «- ### - tekst».
export function prefixLines(ta, prefixFor, onChange) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const start = v.lastIndexOf("\n", s - 1) + 1;
  const sluttIdx = v.indexOf("\n", e);
  const slutt = sluttIdx === -1 ? v.length : sluttIdx;
  let n = 0;
  const ut = v.slice(start, slutt).split("\n")
    .map((l) => l.trim() ? prefixFor(n++) + l.replace(/^\s*(#{1,6}|[-•–]|\d+[.)])\s+/, "") : l)
    .join("\n");
  ta.setRangeText(ut, start, slutt, "select");
  ta.focus();
  onChange?.();
}

const KNAPPER = [
  { id: "bold", tittel: "Fet skrift (**tekst**)", html: "<strong>B</strong>", handling: (ta, cb) => wrapSelection(ta, "**", cb) },
  { id: "italic", tittel: "Kursiv (*tekst*)", html: "<em>K</em>", handling: (ta, cb) => wrapSelection(ta, "*", cb) },
  { id: "ul", tittel: "Punktliste (- punkt)", html: "• Liste", handling: (ta, cb) => prefixLines(ta, () => "- ", cb) },
  { id: "ol", tittel: "Nummerert liste (1. punkt)", html: "1. Liste", handling: (ta, cb) => prefixLines(ta, (i) => `${i + 1}. `, cb) },
  { id: "h3", tittel: "Mellomtittel (### Tittel)", html: "Mellomtittel", kunFull: true, handling: (ta, cb) => prefixLines(ta, () => "### ", cb) },
];

// Sett formatlinja over ett tekstfelt. Idempotent: kalles trygt på nytt når en
// modal åpnes igjen (feltet merkes med data-fmt).
function attachFormatBar(ta, { full = false, onChange } = {}) {
  if (!ta || ta.dataset.fmt) return;
  ta.dataset.fmt = "1";
  const bar = document.createElement("div");
  bar.className = "story-toolbar fmt-bar";
  for (const k of KNAPPER) {
    if (k.kunFull && !full) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn ghost small";
    b.title = k.tittel;
    b.innerHTML = k.html;
    b.addEventListener("click", () => k.handling(ta, onChange));
    bar.appendChild(b);
  }
  ta.parentNode.insertBefore(bar, ta);
}

// Alle felter med `data-format` i et tre (dokumentet, eller en modal som nettopp
// ble bygget). Kalles ved oppstart og etter at forslagsskjemaet er satt inn.
export function setupFormatBars(root = document) {
  root.querySelectorAll("textarea[data-format]").forEach((ta) =>
    attachFormatBar(ta, { full: ta.dataset.format === "full" }));
}
