// ============================================================================
//  ARTIST-STRIPE — artistens aktive periode som en liten tidslinje på kortet
// ----------------------------------------------------------------------------
//  Samme spenn som artistenes tidslinje (resolveSpan i timeline-lanes.js) og
//  samme tiårsrekke som varmestripa (DECADES). Det er hele poenget: kortet,
//  tidslinjen, tiårsfiltrene og varmekartet kan ikke svare ulikt på «når var
//  denne artisten aktiv», fordi de leser samme funksjon og samme akse.
//
//  Aksen er KONTINUERLIG, ikke tiårsbolker: blokka plasseres på årstallet sitt,
//  og etiketten står midt på sitt eget år. Varmestripas akse (heatAxisHtml)
//  kunne derfor ikke gjenbrukes — der er hvert tiår en bolk, og etiketten står
//  midt i bolken, altså et halvt tiår til høyre for året den nevner. På en
//  varmestripe er det riktig (tiåret ER enheten), her ville det flyttet 1955 en
//  halv tiårsbredde bort fra streken sin.
//
//  Bare ANNETHVERT tiår skrives (brukervalg): stripa står ofte i en smal
//  kortspalte ved siden av det høyrestilte bildet, og tretten årstall ble for
//  trangt. Strekene i sporet står under nøyaktig de årstallene som skrives.
//
//  Avhengighetsfattig med vilje (limits + timeline-lanes + genre-model + util),
//  så ui-helpers.js kan importere den uten import-sykel.
// ============================================================================

import { DECADES } from "./limits.js?v=5.00";
import { resolveSpan } from "./timeline-lanes.js?v=5.00";
import { META_GENRE_COLOR, FAMILIES } from "./genre-model.js?v=5.00";
import { escapeHtml } from "./util.js?v=5.00";

const Y0 = DECADES[0];                          // aksens første år (1900)
const Y1 = DECADES[DECADES.length - 1] + 10;    // aksens siste år (2030)

// Hvert n-te tiår får årstall. Endres dette, følger strekene i sporet med:
// de tegnes av samme tall i CSS-gradienten (--ai-tick).
const LABEL_STEP = 2;

const pctOf = (y) => ((y - Y0) / (Y1 - Y0)) * 100;

// Fargene kommer fra sjangertreet i Firestore, altså fra DATA. De limes inn i
// et style-attributt, og «${farge}24»-trikset (alfa som to hex-siffer) krever
// dessuten nøyaktig #rrggbb. Alt annet faller tilbake på røttenes grå — det er
// både en attributt-sperre og et vern mot ugyldig CSS.
function safeColor(c) {
  return /^#[0-9a-f]{6}$/i.test(c || "") ? c : "#9bada1";
}

function artistColor(a) {
  return safeColor(META_GENRE_COLOR[a?.metaGenre] || FAMILIES.gray?.stroke);
}

// Perioden i ord — samme formulering som tidslinjens hjelpetekst, så de to
// leses likt. «ca.» fordi innflytelsesårene er skjønnsmessige anslag (samme
// grunn som på faktalinja rett over stripa).
export function spanText(span) {
  if (span.open) return `ca. ${span.start} → pågår / sluttår ikke satt`;
  return span.start === span.end ? `ca. ${span.start}` : `ca. ${span.start}–${span.end}`;
}

// Årstallene over sporet. Absolutt plassert og sentrert PÅ året sitt — derfor
// har .ai-strip vannrett luft: den ytterste etiketten stikker ut et halvt
// årstall til hver side og skal ha plass, ikke bli klippet.
function axisHtml() {
  return `<div class="ai-axis">` + DECADES
    .map((d, i) => (i % LABEL_STEP === 0
      ? `<span style="left:${pctOf(d).toFixed(2)}%">${d}</span>` : ""))
    .join("") + `</div>`;
}

// Stripa for ÉN artist. Tom streng når artisten ikke kan plasseres (mangler
// influenceStart) — kortet skal da se ut som før, ikke vise en tom akse.
export function artistStripHtml(artist, { nowYear = new Date().getFullYear() } = {}) {
  const span = resolveSpan(artist, nowYear);
  if (!span) return "";

  const color = artistColor(artist);
  // Utenfor aksen klippes blokka, og enden tegnes flat (uten kant og hjørne),
  // nøyaktig som tidslinjen markerer en åpen slutt: flat ende betyr
  // «fortsetter utenfor bildet», avrundet hjørne betyr «her slutter det».
  // Buddy Bolden (1895) og Scott Joplin (1899) begynner før 1900.
  const cutStart = span.start < Y0;
  const cutEnd = span.open || span.end > Y1;
  const left = Math.max(0, pctOf(span.start));
  // Minstebredde så et enkeltår ikke blir usynlig; sporet klipper overskuddet.
  const width = Math.max(1.5, Math.min(100, pctOf(span.end)) - left);

  const cls = ["ai-bar", cutStart ? "is-cut-start" : "", cutEnd ? "is-cut-end" : ""]
    .filter(Boolean).join(" ");
  const txt = spanText(span);

  return `<div class="ai-strip" role="img" aria-label="Aktiv ${escapeHtml(txt)}">` +
    axisHtml() +
    `<div class="ai-track" title="Aktiv ${escapeHtml(txt)}">` +
    `<div class="${cls}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;` +
    `background:${color}2e;border-color:${color}b3"></div>` +
    `</div></div>`;
}
