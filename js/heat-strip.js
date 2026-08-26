// ============================================================================
//  VARMESTRIPE — den glidende linja, delt mellom varmekartet og sjangerkortet
// ----------------------------------------------------------------------------
//  Skilt ut av explore-varmekart.js (v3.93) da sjangerkortet (showSjangerInfo i
//  genealogy.js) skulle vise samme linje. Modulen er BEVISST avhengighetsfattig
//  — den importerer kun DECADES — nettopp fordi genealogy.js bruker den:
//  explore-varmekart.js importerer genealogy.js, så alt som drar genealogy inn
//  hit ville lagd en importsirkel. Fargen sendes derfor inn som argument i
//  stedet for å slås opp i MAIN_GENRE_INFO her.
// ============================================================================

import { DECADES } from "./limits.js?v=4.78";
import { escapeHtml } from "./util.js?v=4.78";

const HEAT_DECADES = DECADES;
const HEAT_SEG = 100 / DECADES.length;   // ett tiårs bredde i prosent
export const HEAT_NODATA = "#eef2f0";

// Cellene fargelegges i sjangerens familiefarge (fra slektstreet), mens
// varmenivået (0–5) styrer lysheten: lyst = lite toneangivende, mørkt = mye.
// Slik bærer linja to akser samtidig — hvilken familie (kulør) og hvor sterk
// (valør).
const hexToRgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgbToHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function heatColor(famHex, level) {
  const base = hexToRgb(famHex), white = [255, 255, 255], black = [0, 0, 0];
  const t = level / 5;                              // 0 (lys) … 1 (mørk)
  const tint = mix(white, base, 0.12 + 0.88 * t);  // hvitt → familiefarge
  return rgbToHex(mix(tint, black, 0.12 * t));      // mørkne toppen litt for valør
}

// Rad-oppslag: alltid like mange celler som DECADES, manglende/korte rader
// fylles med null («ingen data») — så cellene alltid kan klikkes og redigeres.
export function heatRow(heat, sj) {
  const raw = heat?.[sj];
  return DECADES.map((_, i) => {
    const v = Array.isArray(raw) ? raw[i] : null;
    return Number.isInteger(v) && v >= 0 && v <= 5 ? v : null;
  });
}

// ---------------------------------------------------------------------------
//  GRADIENTEN
// ---------------------------------------------------------------------------
//  Raden var 13 avrundede bolker med luft mellom seg: hvert tiår sto som en
//  egen firkant, og fargespranget mellom naboer ble en hard kant. Nå tegnes
//  hele raden som ÉN CSS-gradient, der hvert tiår har en flat midtdel og myke
//  overganger ut mot naboene.
//
//      |‾‾‾‾‾‾‾|          midtre tredel = tiårets EGEN verdi, uendret,
//     /         \         så nivået fortsatt kan leses av
//    /           \        ytre tredeler = rampe mot nabogrensen
//
//  Grensefargen er MIDTPUNKTET mellom de to tiårene. Det er nøkkelen til at
//  sømmen forsvinner helt: begge sider regner ut nøyaktig samme farge på samme
//  x, så gradienten er kontinuerlig. Har naboen samme verdi, ER midtpunktet
//  tiårets egen verdi, og grensen synes ikke i det hele tatt — nyansen kommer
//  altså bare der naboen faktisk har en annen temperatur, og størrelsen på den
//  følger av seg selv hvor stort spranget er.
//
//  «Ingen data» blander seg bevisst IKKE inn i naboene: det segmentet får harde
//  kanter, så et hull aldri kan se ut som en målt verdi.
function heatGradient(famHex, vals) {
  const col = (lvl) => heatColor(famHex, lvl);
  const stops = [];
  const push = (pos, c) => stops.push(`${c} ${pos.toFixed(3)}%`);
  vals.forEach((v, i) => {
    const x0 = i * HEAT_SEG, x1 = x0 + HEAT_SEG;
    if (v == null) { push(x0, HEAT_NODATA); push(x1, HEAT_NODATA); return; }
    const prev = vals[i - 1], next = vals[i + 1];
    // Mangler naboen (kant eller hull), er «midtpunktet» vår egen verdi —
    // stripa flater ut mot kanten i stedet for å tone mot ingenting.
    push(x0, col(prev == null ? v : (prev + v) / 2));
    push(x0 + HEAT_SEG / 3, col(v));
    push(x1 - HEAT_SEG / 3, col(v));
    push(x1, col(next == null ? v : (next + v) / 2));
  });
  return `linear-gradient(to right,${stops.join(",")})`;
}

// Selve stripa: gradienten bærer HELE raden, og oppå ligger ett usynlig felt
// per tiår. De er bare treffområder for hjelpetekst (og i varmekartet for
// lærerens klikk) og har aldri egen bakgrunn — får de det, er vi tilbake til
// firkantene. `cell(v, i)` lar kalleren bytte ut feltet med noe klikkbart.
export function heatStripHtml(color, vals, cell = null) {
  const seg = (v, i) => {
    const pos = `left:${(i * HEAT_SEG).toFixed(3)}%;width:${HEAT_SEG.toFixed(3)}%`;
    if (cell) return cell(v, i, pos);
    const t = `${HEAT_DECADES[i]}-tallet${v != null ? ` · nivå ${v}/5` : " · ingen data"}`;
    return `<div class="vk-cell" title="${escapeHtml(t)}" style="${pos}"></div>`;
  };
  return `<div class="vk-strip" style="background-image:${heatGradient(color, vals)}">` +
    vals.map(seg).join("") + `</div>`;
}

// Tiårsoverskriftene: eget rutenett med like kolonner og UTEN luft, så
// etikettmidtene treffer segmentmidtene i stripa under på prosenten.
//
// `minmax(0,1fr)`, ikke `1fr`: et fr-spor har auto som minimum, så det kan ikke
// bli smalere enn innholdet. På en 375 px-skjerm får sjangerkortets akse 327 px
// (25 px per tiår) mens «1900» er 26 px bredt, og sporene vokste da til 343 px.
// Aksen ble bredere enn stripa under, og etikettene gled ut av stilling med opp
// mot 16 px mot høyre kant — akkurat det rutenettet skal hindre. Med 0 som
// minimum holder sporene nøyaktig 1/13, og en for bred etikett flyter utenfor
// sitt eget spor i stedet for å skyve på de andre.
export function heatAxisHtml() {
  return `<div class="hs-axis" style="grid-template-columns:repeat(${HEAT_DECADES.length},minmax(0,1fr))">` +
    HEAT_DECADES.map((d) => `<div>${d}</div>`).join("") + `</div>`;
}

// ---------------------------------------------------------------------------
//  DELT VARMEDATA
// ---------------------------------------------------------------------------
//  Sjangerkortet bygges i genealogy.js, som ligger UNDER app-laget og ikke kan
//  importere explore-context (den importerer genealogy). Nivåene legges derfor
//  igjen her av den som eier innholdet (explore-context ved hver contentChanged),
//  og leses herfra av kortet. Er de ikke satt — f.eks. tre.html, som ikke laster
//  innhold i det hele tatt — returnerer getHeatData() null, og kortet dropper
//  stripa i stedet for å vise en tom linje.
let heatData = null;
export function setHeatData(heat) { heatData = heat && typeof heat === "object" ? heat : null; }
export function getHeatData() { return heatData; }
