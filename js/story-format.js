// ============================================================================
//  SJANGERHISTORIER — formatering og oppslag
// ----------------------------------------------------------------------------
//  Historiene skrives i markdown-light — nøyaktig det utvalget lærer-editoren
//  har knapper for, verken mer eller mindre:
//    ### Mellomtittel
//    **fet**   *kursiv*
//    - punktliste      1. nummerert liste
//    (blank linje skiller avsnitt)
//  All løpende tekst går gjennom linkifyAll, så artist-/teknologi-/sjanger-
//  navn blir klikkbare på samme måte som i beskrivelsene ellers i appen.
//  Escaping skjer INNE i linkifyAll — rå tekst må aldri rett inn i HTML her.
// ============================================================================

import { linkifyAll } from "./linkify.js?v=3.1";
import { DEFAULT_STORIES } from "./stories-default.js?v=3.1";

export { STORY_ORDER } from "./stories-default.js?v=3.1";

// Inline-formatering: **fet** og *kursiv*. Tokeniseres i ett pass så en
// stjerne inni fet tekst ikke re-tolkes; hvert tekstsegment linkifiseres
// (og dermed escapes) for seg.
function renderInline(text, lc) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(linkifyAll(text.slice(last, m.index), lc));
    if (m[1] !== undefined) out.push(`<strong>${linkifyAll(m[1], lc)}</strong>`);
    else out.push(`<em>${linkifyAll(m[2], lc)}</em>`);
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

// Oppslaget: lærer-redigert versjon (genreDescriptions/<sjanger>.story.body)
// overstyrer standardteksten fra stories-default.js. `custom` forteller
// editoren om «Tilbakestill til standardtekst» skal tilbys.
export function storyFor(genre, genreDescs = {}) {
  const custom = genreDescs?.[genre]?.story?.body;
  if (typeof custom === "string" && custom.trim()) return { body: custom, custom: true };
  const def = DEFAULT_STORIES[genre];
  return def ? { body: def, custom: false } : null;
}
