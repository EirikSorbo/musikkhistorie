// ============================================================================
//  RIK TEKST — markdown-light for ALL løpende tekst i appen
// ----------------------------------------------------------------------------
//  ÉN parser for både sjangerhistoriene/innholdssidene og de vanlige
//  beskrivelsene (artist, sjanger, kobling, innovasjon, tiår). Utvalget er
//  bevisst lite, og er nøyaktig det formatlinja over tekstfeltene har knapper
//  for (js/format-bar.js) — det læreren trykker inn, er det studenten ser:
//
//    ### Mellomtittel
//    **fet**   *kursiv*   [lenketekst](https://…)
//    - punkt      • punkt      – punkt
//    1. nummerert
//    blank linje = nytt avsnitt, enkelt linjeskift = ny linje (<br>)
//
//  All løpende tekst går gjennom linkifyAll, så artist-, teknologi- og
//  sjangernavn blir klikkbare også inni formatert tekst. Escaping skjer INNE
//  i linkifyAll — rå tekst må aldri rett inn i HTML her.
//
//  VIKTIG OM CONTAINEREN: utdata er BLOKK-html (<p>, <ul>, <ol>, <h3>).
//  Elementet teksten legges i må derfor være en <div class="… rt">, aldri en
//  <p>: en <p> inni en <p> lukkes automatisk av nettleseren, og avsnittet
//  rives i to midt i teksten. `rt`-klassen henter typografien i styles.css.
//
//  Modulen importerer BEVISST fra util.js og ikke fra ui-helpers.js: ui-helpers
//  importerer herfra (linkDesc/formatInfoText), og motsatt vei ville gitt en
//  import-sykel.
// ============================================================================

import { linkifyAll } from "./linkify.js?v=4.70";
import { escapeHtml } from "./util.js?v=4.70";

// Bokstav eller siffer, inkludert æøå og aksenter. Brukes til ordgrense-
// sjekken for *kursiv* under.
const ORDTEGN = /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/;

// Rekkefølgen i alternativene er viktig: lenke først (den kan inneholde både
// stjerner og hakeparenteser), så **fet**, så *kursiv*. Ingen av dem får krysse
// et linjeskift — blokk-parseren under kaller denne én linje om gangen.
const INLINE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;

// Inline-formatering på ÉN linje. Hvert tekstsegment linkifiseres (og dermed
// escapes) for seg. Lenketeksten escapes uten linkifisering — en artist-lenke
// inni en URL-lenke ville gitt nøstede <a> — og kun http(s) slipper gjennom.
export function renderInline(text, lc = {}) {
  const ut = [];
  let siste = 0, m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    // «N*E*R*D» er ikke kursiv. Enkel stjerne teller bare som kursivmarkør når
    // den står på ordgrense i BEGGE ender; ellers hoppes treffet over og
    // teksten slipper gjennom som den er. (Fanget av The Neptunes-beskrivelsen,
    // som er den eneste teksten i basen med stjerne midt i et ord.)
    if (m[4] !== undefined) {
      const før = m.index > 0 ? text[m.index - 1] : "";
      const etter = text[m.index + m[0].length] || "";
      if (ORDTEGN.test(før) || ORDTEGN.test(etter)) { INLINE.lastIndex = m.index + 1; continue; }
    }
    if (m.index > siste) ut.push(linkifyAll(text.slice(siste, m.index), lc));
    if (m[1] !== undefined) ut.push(`<a href="${escapeHtml(m[2])}" target="_blank" rel="noopener">${escapeHtml(m[1])}</a>`);
    else if (m[3] !== undefined) ut.push(`<strong>${linkifyAll(m[3], lc)}</strong>`);
    else ut.push(`<em>${linkifyAll(m[4], lc)}</em>`);
    siste = m.index + m[0].length;
  }
  if (siste < text.length) ut.push(linkifyAll(text.slice(siste), lc));
  return ut.join("");
}

// Punktliste: bindestrek, kule ELLER tankestrek. Tankestreken er med fordi de
// 73 koblingsbeskrivelsene i Firestore er skrevet med «– » som kulepunkt lenge
// før appen kunne formatere; de blir ekte lister uten at teksten røres.
const PUNKT = /^[-•–]\s+(.*)$/;
const NUMMER = /^\d+[.)]\s+(.*)$/;
const TITTEL = /^#{1,6}\s+(.*)$/;

// Blokk-parser: linje for linje, med sammenhengende listepunkter samlet i én
// <ul>/<ol> og løpende linjer samlet i avsnitt. Alle #-nivåer blir <h3> —
// modaltittelen er h2, og dypere hierarki trengs ikke i en beskrivelse.
export function renderRichText(text, lc = {}) {
  if (!text) return "";
  const linjer = String(text).replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let liste = null;
  let avsnitt = [];
  const lukkListe = () => {
    if (!liste) return;
    html.push(`<${liste.tag}>${liste.punkter.map((p) => `<li>${p}</li>`).join("")}</${liste.tag}>`);
    liste = null;
  };
  // Enkelt linjeskift blir <br>, ikke mellomrom: den som skriver to linjer
  // under hverandre uten blank linje mellom, mener to linjer.
  const lukkAvsnitt = () => {
    if (!avsnitt.length) return;
    html.push(`<p>${avsnitt.map((l) => renderInline(l, lc)).join("<br>")}</p>`);
    avsnitt = [];
  };
  for (const rå of linjer) {
    const linje = rå.trim();
    if (!linje) { lukkAvsnitt(); lukkListe(); continue; }
    const t = linje.match(TITTEL);
    if (t) { lukkAvsnitt(); lukkListe(); html.push(`<h3>${renderInline(t[1], lc)}</h3>`); continue; }
    const ul = linje.match(PUNKT);
    if (ul) {
      lukkAvsnitt();
      if (!liste || liste.tag !== "ul") { lukkListe(); liste = { tag: "ul", punkter: [] }; }
      liste.punkter.push(renderInline(ul[1], lc));
      continue;
    }
    const ol = linje.match(NUMMER);
    if (ol) {
      lukkAvsnitt();
      if (!liste || liste.tag !== "ol") { lukkListe(); liste = { tag: "ol", punkter: [] }; }
      liste.punkter.push(renderInline(ol[1], lc));
      continue;
    }
    // Vanlig tekst etter et listepunkt (uten blank linje mellom) avslutter
    // lista, så avsnittet havner ETTER den — ellers lukkes avsnittet før den
    // åpne lista og innholdet bytter rekkefølge mot kilden.
    lukkListe();
    avsnitt.push(linje);
  }
  lukkAvsnitt();
  lukkListe();
  return html.join("");
}
