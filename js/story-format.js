// ============================================================================
//  SJANGERHISTORIER OG INNHOLDSSIDER — formatering og oppslag
// ----------------------------------------------------------------------------
//  Historiene og innholdssidene (Om historie, Røtter) skrives i markdown-light
//  — nøyaktig det utvalget lærer-editoren har knapper for, pluss lenker:
//    ### Mellomtittel
//    **fet**   *kursiv*   [lenketekst](https://…)
//    - punktliste      1. nummerert liste
//    (blank linje skiller avsnitt)
//  All løpende tekst går gjennom linkifyAll, så artist-/teknologi-/sjanger-
//  navn blir klikkbare på samme måte som i beskrivelsene ellers i appen.
//  Escaping skjer INNE i linkifyAll — rå tekst må aldri rett inn i HTML her.
//
//  Det finnes BEVISST ingen standardtekster i koden (brukervalg): innholdet
//  bor i Firestore (importert fra innholds-JSON eller skrevet i editoren), og
//  mangler det, skal appen vise en tydelig «mangler tekst»-melding — aldri en
//  utdatert reservetekst.
// ============================================================================

import { linkifyAll } from "./linkify.js?v=3.44";
import { escapeHtml } from "./ui-helpers.js?v=3.44";

// Hvilke historier som finnes og rekkefølgen deres (struktur, ikke innhold):
// én per hovedsjanger med forfattet fortelling. Pop og Rock dekkes gjennom de
// andre og har bevisst ingen egen historie.
export const STORY_ORDER = ["Blues", "Country", "Gospel", "Jazz", "R&B", "Klubbmusikk"];

// Inline-formatering: [lenke](url), **fet** og *kursiv*. Tokeniseres i ett
// pass så en stjerne inni fet tekst ikke re-tolkes; hvert tekstsegment
// linkifiseres (og dermed escapes) for seg. Lenketeksten escapes uten
// linkifisering (en artist-lenke inni en URL-lenke ville gitt nøstede <a>),
// og kun http(s)-URL-er slipper gjennom — alt annet rendres som ren tekst.
function renderInline(text, lc) {
  const out = [];
  const re = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(linkifyAll(text.slice(last, m.index), lc));
    if (m[1] !== undefined) out.push(`<a href="${escapeHtml(m[2])}" target="_blank" rel="noopener">${escapeHtml(m[1])}</a>`);
    else if (m[3] !== undefined) out.push(`<strong>${linkifyAll(m[3], lc)}</strong>`);
    else out.push(`<em>${linkifyAll(m[4], lc)}</em>`);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(linkifyAll(text.slice(last), lc));
  return out.join("");
}

// Blokk-parser: linje for linje, med sammenhengende listepunkter samlet i én
// <ul>/<ol> og løpende linjer samlet i avsnitt. Alle #-nivåer (##–####) blir
// <h3> — modal-tittelen er h2, og dypere hierarki trengs ikke i en fortelling.
export function renderStoryHtml(text, lc = {}) {
  if (!text) return "";
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let list = null;
  let para = [];
  const flushList = () => {
    if (!list) return;
    html.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${renderInline(para.join(" "), lc)}</p>`);
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const h = line.match(/^#{2,4}\s+(.*)$/);
    if (h) { flushPara(); flushList(); html.push(`<h3>${renderInline(h[1], lc)}</h3>`); continue; }
    const ul = line.match(/^[-•]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
      list.items.push(renderInline(ul[1], lc));
      continue;
    }
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
      list.items.push(renderInline(ol[1], lc));
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushList();
  return html.join("");
}

// Oppslaget: historien er den lærer-lagrede/importerte teksten på
// genreDescriptions/<sjanger>.story.body — ingen fallback. Mangler den (eller
// er tom), returneres null og visningen skal si tydelig ifra.
export function storyFor(genre, genreDescs = {}) {
  const body = genreDescs?.[genre]?.story?.body;
  return typeof body === "string" && body.trim() ? { body } : null;
}

// Samme oppslag for innholdssidene (content/<id>.body fra Firestore).
export function pageFor(pageId, content = {}) {
  const body = content?.[pageId]?.body;
  return typeof body === "string" && body.trim() ? { body } : null;
}
