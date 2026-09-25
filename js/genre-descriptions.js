// ============================================================================
//  SJANGERBESKRIVELSER — oppslag per nivå (INGEN innebygde defaults)
// ----------------------------------------------------------------------------
//  Beskrivelser kommer KUN fra data (Firestore-«genreDescriptions» / import-JSON), per
//  nivå: doc = sjangernavn, med valgfrie felt meta/main/sub = { description,
//  kilder, activeFrom, activeTo, usikre, era, lytt }. Det finnes INGEN fallback: hvert nivå leses kun fra sitt eget
//  felt (meta/main/sub). Et eldre flatt { description } brukes IKKE.
//  Det finnes BEVISST ingen seed/standardtekst — mangler en beskrivelse, skal
//  det vises en tydelig feilmelding (missingDesc), ikke en fallback som skjuler
//  at sjangeren ikke er synkronisert. Nivå: meta (metasjanger), main (tre-
//  sjanger), sub (fri undersjanger).
// ============================================================================

import { normaliserPunkter } from "./punkter.js?v=5.54";

const LVL = { meta: "metasjanger", main: "sjanger", sub: "undersjanger" };

// Tydelig melding når ingen beskrivelse er lagt inn på gjeldende nivå. Vises i
// en .gx-missing-ramme som allerede markerer den visuelt (SVG-ikonkravet: ingen
// emoji i teksten).
export function missingDesc(level) {
  return `Ingen beskrivelse lagt inn ennå (${LVL[level] || level})`;
}

// Årstallene er heltall i et plausibelt årsintervall, ellers null. Samme grense
// som editoren validerer mot (1600–2100). Et tomt felt skal bety «ikke satt»,
// og 0 er IKKE et årstall: uten denne grensen ville et streifende 0 fra en
// import rendret «0–i dag» på sjangerkortet.
const AAR_MIN = 1600, AAR_MAKS = 2100;
function yr(v) {
  return Number.isInteger(v) && v >= AAR_MIN && v <= AAR_MAKS ? v : null;
}

const TOM = { description: "", kilder: [], activeFrom: null, activeTo: null, activeToUgyldig: false, usikre: [], era: "", lytt: [], punkter: [] };

function fromOverride(o, level) {
  if (!o) return null;
  const lvl = o[level];
  if (!lvl) return null;
  // KUN nivå-spesifikk tekst. Ingen fallback til flat/annet nivå — mangler
  // beskrivelsen på DETTE nivået, skal kalleren vise missingDesc (bevisst valg).
  // Epoke-årstallene følger med uavhengig av teksten: en sjanger kan ha fått
  // årstall satt før beskrivelsen er skrevet, og da skal kortet vise epoken
  // selv om prosaen fortsatt mangler.
  //
  // era og lytt teller MED her (v4.64). De kom ut av sjangertreet, og de fire
  // rot-nodene som ennå ikke har prosa (Europeisk, Vestafrikansk, Work songs,
  // Spirituals) har bare dem. Uten dem i testen ville epoken og lytteforslagene
  // for nettopp de nodene vært usynlige rett etter migreringen.
  const har = !!lvl.description || yr(lvl.activeFrom) !== null
    || !!String(lvl.era || "").trim() || (Array.isArray(lvl.lytt) && lvl.lytt.length > 0)
    || normaliserPunkter(lvl.punkter).length > 0;
  if (!har) return null;
  return {
    description: lvl.description || "",
    kilder: lvl.kilder || [],
    activeFrom: yr(lvl.activeFrom),
    activeTo: yr(lvl.activeTo),
    // Satt, men ikke et årstall (streng, 0, femsifret …). yr() gjør verdien om
    // til null, og da kan ingen skille den fra et tomt felt, som betyr «fortsatt
    // aktiv». Sjangerperioder (v5.20) viser slike rader som et merket hull i
    // stedet for en stolpe fram til i dag. Tomt i dataene er alltid null.
    activeToUgyldig: lvl.activeTo != null && lvl.activeTo !== "" && yr(lvl.activeTo) === null,
    usikre: Array.isArray(lvl.usikre) ? lvl.usikre : [],
    // Epoken som FRITEKST («midten av 1940-tallet», «ca. 1979»). Årstallene over
    // er det presise; denne bærer nyansen, og tidslinjen viser den ordrett.
    era: String(lvl.era || "").trim(),
    // Kuraterte lytteforslag for sjangeren, som fri tekst per linje. Skilt fra
    // artistenes musicExamples: DE er knyttet til et artistkort og driver
    // spillelistene, disse hører til sjangeren som sådan.
    lytt: Array.isArray(lvl.lytt) ? lvl.lytt.filter((x) => String(x || "").trim()) : [],
    // Oppsummeringspunktene (v5.50): bare main-nivået har dem i dag (sjanger-
    // kortet), men oppslaget er likt for alle nivåer.
    punkter: normaliserPunkter(lvl.punkter),
  };
}

// Beskrivelse for (navn, nivå) fra data. Tom { description: "" } hvis ingenting
// finnes — kalleren viser da missingDesc.
export function resolveDesc(overrides, name, level) {
  return fromOverride(overrides && overrides[name], level) || { ...TOM };
}

// Som resolveDesc, men over flere navn (f.eks. nodens label OG fulle navn).
export function resolveDescAny(overrides, names, level) {
  for (const n of names) { const r = fromOverride(overrides && overrides[n], level); if (r) return r; }
  return { ...TOM };
}
