// ============================================================================
//  SJANGERMODELLEN — treets form, avledet ett sted
// ----------------------------------------------------------------------------
//  Alt appen vet om HVILKE sjangre som finnes, hvem som stammer fra hvem, hvilke
//  metasjangre de hører til og hvilke farger de har, avledes her. Fram til v4.47
//  bodde både rådataene og avledningene i js/genealogy.js, og «legg til en
//  sjanger» var derfor en utviklerjobb. Nå er kilden ETT dokument i Firestore
//  (se subscribeGenealogy i store.js), og denne modulen er den eneste som
//  kjenner dokumentets form.
//
//  KONTRAKTEN mot resten av appen er uendret: samme symbolnavn, samme innhold,
//  samme formler som før. De ~20 modulene som leser vokabularet trengte derfor
//  bare å bytte importlinje.
//
//  ES-modulers LIVE BINDINGS bærer hele designet: eksportene er `let`, og
//  rebuild() tilordner dem på nytt når et snapshot lander. En importør som
//  leser `GENEALOGY_MAIN_GENRES` ved KALL-tid ser alltid ferskeste verdi.
//  Fang derfor ALDRI en avledet verdi i en modulnivå-konstant (det var nettopp
//  det canonMain i explore-context.js og constellation.js gjorde, og de måtte
//  legges om) — les den inne i funksjonen som trenger den.
//
//  Modellen er TOM til første snapshot lander. Det er med vilje: det finnes
//  ingen fallback-kopi av treet i koden, for da ville en tom database sett ut
//  som et fungerende pensum. Sidene viser i stedet en tydelig melding
//  (isGenreModelReady()).
// ============================================================================

import { computeColumns, LAYOUT_WIDTH } from "./genre-layout.js?v=4.73";

// --- Modelltilstanden (byttes av rebuild) -----------------------------------

// Alle noder i treet, i dokumentets rekkefølge. Røttene har g === null.
export let GENEALOGY = [];

// Sjangervokabular for filteret (alle ekte sjangre i treet, ikke røtter).
export let GENEALOGY_MAIN_GENRES = [];

// Metasjangre (treets kolonner): én rad per hovedretning. Er VOKABULARET —
// hvilke metasjangre som finnes — og brukes der rekkefølgen ikke betyr noe
// (nedtrekkslister, filtre, tellinger). Visningsflatene sorterer etter
// META_GENRE_ORDER under.
export let GENEALOGY_META_GENRES = [];

// Pedagogisk visningsrekkefølge for metasjangrene (brukervalg): den
// afroamerikanske linja samlet først — Blues → Jazz → R&B → Hip-hop →
// Klubbmusikk → Gospel — og deretter Country → Pop → Rock. Treets egen
// rekkefølge er ≈ kronologisk og river disse slektskapene fra hverandre; her
// står familiene som henger sammen ved siden av hverandre. Brukes av artistenes
// tidslinje OG varmekartet — de to flatene deler mønster og fargespråk, og må
// derfor lese likt ovenfra og ned.
//
// Rekkefølgen er en RANGERING, ikke en fasit på hvilke metasjangre som finnes:
// den sorterer det treet faktisk inneholder, og en metasjanger som ikke er
// rangert havner sist i treets egen rekkefølge i stedet for å forsvinne.
export let META_GENRE_ORDER = [];

// Alle koblinger (streker) i treet: avstamning/påvirkning (p) + motreaksjon
// (rx), i definisjonsrekkefølge. Delt av slektstreets trykkbaner, lærer-
// oversikten (koblinger uten beskrivelse) og eksport/import.
export let GENEALOGY_EDGES = [];

// Sjangerfamilier: strekfarge + etikett til fargeforklaringen. Rekkefølgen
// styrer rekkefølgen i forklaringen.
export let FAMILIES = {};

// Per-sjanger-oppslag, så andre visninger (f.eks. varmekartet) kan gruppere
// mainGenre etter metaGenre og fargelegge dem med nøyaktig de samme
// slektstre-familiefargene.
export let MAIN_GENRE_INFO = {};

// Farge per METASJANGER: familiefargen som flest av metasjangerens tre-noder
// bruker. Utledet, ikke hardkodet — en ny node med ny familie flytter
// automatisk fargen hvis den blir den vanligste. Brukt av sjangerhistorie-
// knappene, så de snakker samme fargespråk som treet.
//
// «gray» holdes utenfor tellingen: den er røttenes farge, ikke en identitet en
// metasjanger kan arve. Uten den regelen ville Tin Pan Alley (gray) og Pop (pop)
// stått 1–1 i Pop, og Pop fått røtter-gråen. Skulle en metasjanger bestå av
// bare gray-noder, faller den tilbake til gråen med vilje.
export let META_GENRE_COLOR = {};

// Metasjangrene slik dokumentet beskriver dem: navn, pedagogisk rekkefølge
// (order), visuell kolonne i treet (column) og farge. Fra v4.54 EIER
// metasjangeren fargen; noder arver den, og bare unntakene bærer sin egen.
let META_GENRES = [];

// Utregnet x-posisjon per node (js/genre-layout.js). Erstatter den håndsatte
// cx-en. Delt av slektstreet og Sjangerhimmelen, så de to aldri kan komme i
// utakt om hvor en sjanger hører hjemme vannrett.
let LAYOUT_X = new Map();

// Tiårsaksen treet tegnes på: rad → etikett. Utledes av nodene, så en sjanger
// på en ny rad (2020-tallet) utvider aksen av seg selv i stedet for å havne
// utenfor et hardkodet endepunkt.
export let DECADE_ROWS = [];

let mainGenreSet = new Set();
let mainGenreCanon = new Map();
let nodeIndex = new Map();
let metaByName = new Map();
let ready = false;

// Varsles hver gang modellen bygges på nytt (nytt snapshot fra Firestore).
const listeners = new Set();

// Har modellen fått data? Sidene bruker denne til å skille «laster» fra
// «treet mangler» — se banner-håndteringen i tre-page.js og landing.js.
export function isGenreModelReady() { return ready; }

// --- Avledningene ------------------------------------------------------------

// Rad → tiårsetikett. Rad 0 er røttene (før innspillingenes tid), rad 1 er
// 1900, og hver rad etter det er et tiår. Genereres så langt nodene rekker.
function buildDecadeRows(nodes) {
  const maxRow = nodes.reduce((m, n) => Math.max(m, Math.floor(n.r || 0)), 0);
  const rows = ["Røtter"];
  for (let r = 1; r <= Math.max(maxRow, 1); r++) {
    rows.push(r === 1 ? "1900" : `${1900 + (r - 1) * 10}-t`);
  }
  return rows;
}

// Bygger hele modellen fra et treobjekt: { nodes, families, metaOrderHint }.
// Kalles av snapshot-lytteren og av testene. Tåler delvis/tom input.
export function rebuild(tree) {
  const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
  const families = tree?.families && typeof tree.families === "object" ? tree.families : {};
  const hint = Array.isArray(tree?.metaOrderHint) ? tree.metaOrderHint : [];

  // Normaliser: rx er valgfri i dokumentet, men resten av appen forventer at
  // den alltid finnes som array (renderGenealogy muterte den tidligere på plass).
  GENEALOGY = nodes.map((n) => ({ ...n, p: Array.isArray(n.p) ? n.p : [], rx: Array.isArray(n.rx) ? n.rx : [] }));
  FAMILIES = families;

  GENEALOGY_MAIN_GENRES = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.l))]
    .sort((a, b) => a.localeCompare(b, "no"));
  GENEALOGY_META_GENRES = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.g))];

  const rank = new Map(hint.map((m, i) => [m, i]));
  // Array.sort er stabil, så urangerte metasjangre beholder treets rekkefølge seg imellom.
  META_GENRE_ORDER = [...GENEALOGY_META_GENRES].sort(
    (a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));

  const edges = [];
  GENEALOGY.forEach((n) => {
    const ps = n.p.slice();
    n.rx.forEach((id) => { if (!ps.includes(id)) ps.push(id); });
    ps.forEach((pid) => edges.push({ from: pid, to: n.id, react: n.rx.includes(pid) }));
  });
  GENEALOGY_EDGES = edges;

  // Metasjangrene MÅ stå før fargeavledningene: famOf/nodeColor og
  // META_GENRE_COLOR slår opp i metaByName, og sto denne tilordningen etter
  // dem, leste de forrige trees metasjangre. Ved kald start (tomt speil) var
  // den tom, og hele kartet ble grått til NESTE snapshot.
  META_GENRES = Array.isArray(tree?.metaGenres)
    ? tree.metaGenres.map((m) => (typeof m === "string" ? { name: m } : { ...m })).filter((m) => m.name)
    : GENEALOGY_META_GENRES.map((name, i) => ({ name, column: i }));
  metaByName = new Map(META_GENRES.map((m) => [m.name, m]));

  const grayFallback = () => FAMILIES.gray?.stroke || "#9bada1";
  MAIN_GENRE_INFO = Object.fromEntries(
    GENEALOGY.filter((n) => n.g).map((n) => [n.l, {
      meta: n.g,                                  // metaGenre (metasjanger)
      fam: famOf(n),                              // familienøkkel (arvet eller egen)
      color: nodeColor(n),
    }]));

  // Farge per metasjanger: leses av dokumentet når det sier noe, ellers
  // utledes den av den vanligste familien blant metasjangerens noder (slik den
  // ble utledet før metasjangrene eide fargen).
  META_GENRE_COLOR = Object.fromEntries(GENEALOGY_META_GENRES.map((meta) => {
    const m = metaByName.get(meta);
    if (m?.color) return [meta, m.color];
    if (m?.fam && FAMILIES[m.fam]) return [meta, FAMILIES[m.fam].stroke];
    const tally = {};
    for (const n of GENEALOGY) {
      if (n.g !== meta || !n.fam || n.fam === "gray") continue;
      tally[n.fam] = (tally[n.fam] || 0) + 1;
    }
    const vanligst = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
    return [meta, FAMILIES[vanligst]?.stroke || grayFallback()];
  }));

  LAYOUT_X = computeColumns(GENEALOGY, META_GENRES, { width: LAYOUT_WIDTH });
  DECADE_ROWS = buildDecadeRows(GENEALOGY);
  mainGenreSet = new Set(GENEALOGY_MAIN_GENRES.map((g) => g.toLowerCase()));
  mainGenreCanon = new Map(GENEALOGY_MAIN_GENRES.map((g) => [g.toLowerCase(), g]));
  nodeIndex = new Map(GENEALOGY.map((n) => [n.id, n]));
  ready = GENEALOGY.length > 0;

  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error("genre-model-lytter feilet:", e); } });
}

// --- Oppslag ----------------------------------------------------------------

// Dokument-ID i Firestore-samlingen edgeDescriptions for koblingen fra → til.
export function edgeKey(fromId, toId) {
  return `${fromId}__${toId}`;
}

// Er navnet en ekte tre-sjanger (mainGenre)? Brukes til å skille mainGenre fra
// frie undersjangre (subGenre). Delt av store, ui, explore og teacher.
export function isMainGenre(name) {
  return mainGenreSet.has(String(name).toLowerCase());
}

// Kanoniser et sjangernavn til treets stavemåte («blues» → «Blues»). Artist-
// tagger skrives av mennesker og varierer i case; visningsflatene må gruppere
// dem likt. Returnerer undefined for navn som ikke er tre-sjangre.
//
// Var tidligere en modulnivå-Map (canonMain) i BÅDE explore-context.js og
// constellation.js. Den låste vokabularet til import-tidspunktet og ville aldri
// sett en sjanger læreren la til senere.
export function canonMainGenre(name) {
  return mainGenreCanon.get(String(name).toLowerCase());
}

// Familienøkkelen en node tegnes med. Noden kan bære sin egen `fam` som
// UNNTAK (Reggae er grønn selv om metasjangeren Klubbmusikk er turkis, og
// Tin Pan Alley er grå i Pop); ellers arves metasjangerens. Røtter har ingen
// metasjanger og faller til grå.
export function famOf(n) {
  if (n?.fam) return n.fam;
  const m = metaByName.get(n?.g);
  return m?.fam || "gray";
}

// Fargen en node tegnes med, etter samme regel.
export function nodeColor(n) {
  const egen = n?.fam && FAMILIES[n.fam]?.stroke;
  if (egen) return egen;
  const m = metaByName.get(n?.g);
  if (m?.color) return m.color;
  if (m?.fam && FAMILIES[m.fam]) return FAMILIES[m.fam].stroke;
  return FAMILIES.gray?.stroke || "#9bada1";
}

// Utregnet x for en node. Returnerer midten av kartet for ukjente noder, så en
// renderer aldri får NaN.
export function layoutX(id) {
  const v = LAYOUT_X.get(id);
  return Number.isFinite(v) ? v : LAYOUT_WIDTH / 2;
}

// Node-oppslag på id. Bygges av rebuild, så kallere slipper å lage sin egen Map
// på modulnivå (som ville frosset ved import-tid).
export function genreNodeById(id) {
  return nodeIndex.get(id) || null;
}

// Finn tre-noden (ekte sjanger, g≠null) et navn peker på — matcher både label
// (l) og fullt navn (f), case-insensitivt. isMainGenre ser kun på labels og
// er riktig for KLASSIFISERING (tagger skal være l); denne er for NAVIGASJON,
// der også nodens fulle navn (f.eks. under-chippen «Outlaw country») skal
// finne frem til sjangerbeskrivelsen.
export function findTreeGenreNode(name) {
  const s = String(name).toLowerCase();
  return GENEALOGY.find((n) => n.g && (n.l.toLowerCase() === s || n.f.toLowerCase() === s)) || null;
}


// Meld deg på varsling om at modellen er bygget på nytt.
// Returnerer en avmeldingsfunksjon.
export function onGenreModelChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- Kilde: Firestore, med localStorage-speil -------------------------------
//  Treet bor i dokumentet content/genealogy og kommer inn via det EKSISTERENDE
//  content-abonnementet (js/shared-data.js), så det koster ingen ekstra
//  Firestore-lesinger.
//
//  Speilet er ikke en fallback-kopi av pensumet — det er sist mottatte data.
//  Uten det ville en treg eller brutt forbindelse gitt et tomt kart ved kald
//  start selv om eleven var her i går. Samme prinsipp som js/artist-cache.js.

const SPEIL_NOKKEL = "pensum_cache_genealogy_v1";

function lesSpeil() {
  try {
    const rå = localStorage.getItem(SPEIL_NOKKEL);
    const t = rå ? JSON.parse(rå) : null;
    return Array.isArray(t?.nodes) && t.nodes.length ? t : null;
  } catch { return null; }
}

// JSON-en for det sist anvendte treet. Brukes til å hoppe over rebuild når et
// content-snapshot IKKE gjelder treet: samlingen bærer også varmekart,
// innholdssider og referanser, og uten denne sjekken rev hvert lærer-klikk i
// varmekartet med seg full omtegning (og nullstilt zoom/pan) hos alle elever
// som sto i slektstreet.
let sistAnvendtJson = "";

// Tar imot dokumentet fra content-snapshotet. Kalles av subscribeSharedData.
// Et TOMT/manglende dokument nullstiller IKKE en modell som allerede har data:
// da ville et halvskrevet dokument midt i en lærerimport blanket kartet for
// hele klassen. Mangler treet helt, forblir modellen tom og sidene sier fra.
export function applyGenealogyDoc(doc) {
  const gyldig = Array.isArray(doc?.nodes) && doc.nodes.length > 0;
  if (!gyldig) {
    if (!ready) rebuild(lesSpeil() || null);
    return ready;
  }
  // Speilet må bære ALT rebuild leser. metaGenres manglet her først, og da falt
  // kolonnerekkefølgen — og dermed hele kartets venstre-mot-høyre — tilbake til
  // den pedagogiske ved kald start, altså en helt annen plassering enn den
  // læreren har satt.
  const speilbart = {
    nodes: doc.nodes,
    families: doc.families,
    metaOrderHint: doc.metaOrderHint,
    metaGenres: doc.metaGenres,
    version: doc.version,
  };
  const json = JSON.stringify(speilbart);
  if (json === sistAnvendtJson) return true;
  sistAnvendtJson = json;
  rebuild(doc);
  try { localStorage.setItem(SPEIL_NOKKEL, json); } catch { /* full storage */ }
  return true;
}

// Ved modul-lasting: bygg fra speilet med én gang, så kartet står der mens
// snapshotet er underveis. Finnes ikke speilet, er modellen tom til data lander.
rebuild(lesSpeil() || null);
