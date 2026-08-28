// ============================================================================
//  SØK — én indeks over alt innholdet i appen
// ----------------------------------------------------------------------------
//  Bygger en flat liste over ALT som er skrevet i pensumet — artister, sjangre,
//  undersjangre, sjangerhistorier, innovasjonskort, tiårstekster, innholdssider,
//  instrumentsammendrag, sjangerkoblinger og podkaster — og rangerer treff i
//  den. Hver post bærer med seg hvordan den åpnes (`apne`), så visningen bare
//  sender payloaden videre til ruteren i explore-search.js. Samme grep som
//  Referanser-kortet bruker for sine `opphav`.
//
//  Indeksen er en AVLEDNING av det som allerede ligger i minnet og bygges på
//  nytt ved hvert søk. Da kan den ikke bli utdatert etter en lærer-redigering,
//  og den koster ingenting å holde ved like: hele pensumet er noen hundre
//  poster, og normaliseringen under kjører på under et millisekund per bygg.
//
//  DOM-fri og avhengighetsfattig (limits + genre-model + story-format + util),
//  så modulen kan enhetstestes i Node.
// ============================================================================

import { INSTRUMENT_TIMELINE_GROUPS, INSTRUMENT_TITLE, instrumentPageId, isVisible } from "./limits.js?v=4.94";
import { GENEALOGY, GENEALOGY_ROOT_GENRES, genreNodeById, findTreeGenreNode } from "./genre-model.js?v=4.94";
import { storyOrder, storyFor, pageFor } from "./story-format.js?v=4.94";
import { escapeHtml } from "./util.js?v=4.94";

// Etikettene som vises på treffene. Nøkkelen er postens `type`.
export const TYPE_LABEL = {
  artist: "Artist",
  sjanger: "Sjanger",
  rot: "Rot",
  undersjanger: "Undersjanger",
  historie: "Sjangerhistorie",
  tech: "Innovasjon",
  hendelse: "Hendelse",
  samfunn: "Samfunn",
  teknologi: "Teknologi",
  side: "Innholdsside",
  instrument: "Instrument",
  kobling: "Sjangerkobling",
  podkast: "Podkast",
};

// Overskriften over en gruppe treff.
export const TYPE_FLERTALL = {
  artist: "Artister",
  sjanger: "Sjangre",
  rot: "Røtter",
  undersjanger: "Undersjangre",
  historie: "Sjangerhistorier",
  tech: "Innovasjoner",
  hendelse: "Hendelser",
  samfunn: "Samfunn",
  teknologi: "Teknologi",
  side: "Innholdssider",
  instrument: "Instrumenter",
  kobling: "Sjangerkoblinger",
  podkast: "Podkaster",
};

// Uavgjort mellom to grupper med like sterkt beste-treff: det man oftest leter
// etter først.
export const TYPE_ORDER = [
  "artist", "sjanger", "rot", "undersjanger", "tech", "hendelse",
  "historie", "side", "instrument", "samfunn", "teknologi", "kobling", "podkast",
];

const SIDE_TITTEL = { rotter: "Røtter før 1910", omHistorie: "Om historie", appGuide: "Slik bruker du appen" };

// Søket skal ikke bry seg om store bokstaver eller aksenter: «beyonce» skal
// finne «Beyoncé», og «rock’n’roll» skal finne «Rock'n'roll». Norske æ/ø/å er
// EGNE bokstaver og står med vilje igjen — de skal ikke bli a/o/a, det ville
// gjort «lås» til «las».
//
// Oppslagstabell og ikke normalize("NFD"): denne må være ÉN-TIL-ÉN i lengde.
// Utdraget under finner posisjoner i den normaliserte kopien og skjærer i
// originalen, og et tegn som ble til to hadde forskjøvet alt etter seg.
const AKSENT_FRA = "áàâäãéèêëíìîïóòôöõúùûüýÿñçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÝÑÇ";
const AKSENT_TIL = "aaaaaeeeeiiiiooooouuuuyyncaaaaaeeeeiiiiooooouuuuync";
const AKSENT_RE = new RegExp(`[${AKSENT_FRA}’´\`]`, "g");
const AKSENT_MAP = new Map([...AKSENT_FRA].map((c, i) => [c, AKSENT_TIL[i]]));

export function normaliser(s) {
  return String(s || "")
    .replace(AKSENT_RE, (c) => AKSENT_MAP.get(c) || "'")
    .toLowerCase();
}

// Søkeordene: mellomrom skiller, og ALLE må finnes i posten (OG-søk). Tomt
// eller ett enkelt tegn gir ingen søk — da ville halve pensumet vært et treff.
export function delOppSok(q) {
  return normaliser(q).split(/\s+/).filter((t) => t.length > 0);
}

const MIN_LENGDE = 2;

function post(type, id, tittel, sti, biter, apne) {
  const tekst = biter.filter(Boolean).map((b) => String(b).trim()).filter(Boolean).join(" · ");
  return { type, id, tittel, sti, tekst, apne, nTittel: normaliser(tittel), nTekst: normaliser(tekst) };
}

// ---------------------------------------------------------------------------
//  INDEKSEN
// ---------------------------------------------------------------------------
//  `skjul` er studentvisningens midlertidige brytere (feature-flags.js). Et
//  treff som fører til en flate studenten ikke kan åpne, skal ikke være der:
//  søket ville ellers vært en bakvei rundt akkurat de bryterne.
export function byggIndeks(state = {}, { erLærer = false, skjul = {} } = {}) {
  const ut = [];
  const artists = state.artists || [];
  const genreDescs = state.genreDescs || {};
  const content = state.content || {};

  // --- Artister -------------------------------------------------------------
  // Læreren søker i HELE samlingen (også skjulte kort og forslag som venter —
  // det er hen som behandler dem); studenten kun i det som faktisk vises.
  for (const a of erLærer ? artists : artists.filter(isVisible)) {
    const verk = (a.keyWorks || []).map((w) => w && w.title).filter(Boolean);
    const eks = (a.musicExamples || []).map((m) => (typeof m === "string" ? m : m && m.title)).filter(Boolean);
    ut.push(post("artist", a.id, a.name || "(uten navn)",
      [a.metaGenre, a.instrument].filter(Boolean).join(" · "),
      [a.description, a.geography, a.recordLabel, a.metaGenre,
        (a.mainGenre || []).join(", "), (a.subGenre || []).join(", "), a.instrument,
        verk.join(", "), eks.join(", ")],
      { hva: "artist", id: a.id }));
  }

  // --- Sjangre og røtter (treets noder) -------------------------------------
  // Røttene skilles ut som egen type: de er laget FØR sjangrene, og en student
  // som søker «Ragtime» skal se at det er en rot, ikke en sjanger. SAMME
  // definisjon som boblene i Røtter-kortet (GENEALOGY_ROOT_GENRES) — «mangler
  // metasjanger» alene ville kalt Reggae en rot her og en sjanger der.
  const erRot = new Set(GENEALOGY_ROOT_GENRES.map((n) => n.id));
  for (const n of GENEALOGY) {
    const d = (genreDescs[n.l] && genreDescs[n.l].main) || (genreDescs[n.f] && genreDescs[n.f].main) || {};
    ut.push(post(erRot.has(n.id) ? "rot" : "sjanger", n.l, n.f || n.l,
      n.g || "Røtter",
      [n.l !== n.f ? n.l : "", d.description, d.era, (d.lytt || []).join(", ")],
      { hva: "sjanger", id: n.l }));
  }

  // --- Undersjangre ---------------------------------------------------------
  // Sub-nivået i genreDescriptions, men bare navn som IKKE alt er en tre-node:
  // de står allerede over, og et navn skal gi ett treff, ikke to.
  for (const [navn, g] of Object.entries(genreDescs)) {
    const sub = g && g.sub;
    if (!sub || findTreeGenreNode(navn)) continue;
    ut.push(post("undersjanger", navn, navn, "Undersjanger",
      [sub.description, sub.era], { hva: "undersjanger", id: navn }));
  }

  // --- Sjangerhistorier -----------------------------------------------------
  if (erLærer || !skjul.metasjangerhistorier) {
    for (const meta of storyOrder(genreDescs)) {
      const story = storyFor(meta, genreDescs);
      if (!story) continue;
      ut.push(post("historie", meta, `Historien om ${meta}`, "Metasjanger",
        [story.body], { hva: "historie", id: meta }));
    }
  }

  // --- Innovasjonskort og hendelser ----------------------------------------
  for (const t of state.techItems || []) {
    ut.push(post(t.type === "hendelse" ? "hendelse" : "tech", t.id, t.name || "(uten navn)",
      [t.category, t.instrument].filter(Boolean).join(" · "),
      [t.description, t.category, t.instrument, t.adoptedLabel, t.inventedYear, t.adoptedYear, t.decade],
      { hva: "tech", id: t.id }));
  }

  // --- Tiårstekstene (samfunn og teknologi hver for seg) -------------------
  for (const [id, d] of Object.entries(state.decadeDescs || {})) {
    if (!d) continue;
    if (d.society) {
      ut.push(post("samfunn", id, `${id}-tallet`, "Samfunnsutvikling", [d.society],
        { hva: "tiår", id, modus: "society" }));
    }
    if (d.tech) {
      ut.push(post("teknologi", id, `${id}-tallet`, "Teknologiutvikling", [d.tech],
        { hva: "tiår", id, modus: "tech" }));
    }
  }

  // --- Innholdssidene -------------------------------------------------------
  // Røtter og Om historie nås fra «Det store bildet», som er skjult for
  // studentene så lenge bryteren står på.
  if (erLærer || !skjul.storeBildet) {
    for (const id of ["rotter", "omHistorie"]) {
      const side = pageFor(id, content);
      if (!side) continue;
      ut.push(post("side", id, SIDE_TITTEL[id] || id, "Det store bildet", [side.body],
        { hva: "side", id }));
    }
  }
  // «Slik bruker du appen» står i huben på lik linje med de to over.
  if ((erLærer || !skjul.storeBildet) && pageFor("appGuide", content)) {
    ut.push(post("side", "appGuide", SIDE_TITTEL.appGuide, "Det store bildet",
      [pageFor("appGuide", content).body], { hva: "side", id: "appGuide" }));
  }

  // --- Instrumentsammendragene ---------------------------------------------
  for (const gruppe of INSTRUMENT_TIMELINE_GROUPS) {
    const side = pageFor(instrumentPageId(gruppe), content);
    if (!side) continue;
    ut.push(post("instrument", gruppe, INSTRUMENT_TITLE[gruppe] || `Utviklingen av ${gruppe}`,
      "Instrumenter", [side.body], { hva: "instrument", id: gruppe }));
  }

  // --- Sjangerkoblingene (strekene i slektstreet) --------------------------
  if (erLærer || !skjul.koblingsbeskrivelser) {
    for (const [key, e] of Object.entries(state.edgeDescs || {})) {
      if (!e || !e.description) continue;
      const [fra, til] = String(key).split("__");
      const navn = `${genreNodeById(fra)?.l || fra} → ${genreNodeById(til)?.l || til}`;
      ut.push(post("kobling", key, navn, "Sjangerkobling", [e.description],
        { hva: "kobling", id: key }));
    }
  }

  // --- Podkastepisodene -----------------------------------------------------
  for (const p of state.podcasts || []) {
    ut.push(post("podkast", p.id, p.title || "(uten tittel)", "Podkast",
      [p.description, p.guest, p.host], { hva: "podkast", id: p.id }));
  }

  return ut;
}

// ---------------------------------------------------------------------------
//  RANGERINGEN
// ---------------------------------------------------------------------------
//  Tittel veier tyngst, og et treff som starter et ord veier tyngre enn et
//  midt inne i et: «rock» skal gi Rock'n'roll før Punk rock-beskrivelsen, og
//  ingen av dem skal drukne i en artistbiografi som nevner ordet ti ganger.
function ordstart(hay, i) {
  return i === 0 || !/[a-z0-9æøå]/.test(hay[i - 1]);
}

function poeng(p, termer) {
  let sum = 0;
  for (const t of termer) {
    const iT = p.nTittel.indexOf(t);
    const iB = p.nTekst.indexOf(t);
    if (iT < 0 && iB < 0) return 0;             // OG-søk: alle ord må finnes
    if (iT >= 0) sum += ordstart(p.nTittel, iT) ? 10 : 5;
    if (iB >= 0) {
      sum += ordstart(p.nTekst, iB) ? 3 : 1.5;
      // Flere forekomster teller litt, men med tak: en lang tekst skal ikke
      // kunne kjøpe seg forbi et titteltreff på gjentakelser alene.
      let n = 0, i = iB;
      while ((i = p.nTekst.indexOf(t, i + t.length)) >= 0 && n < 6) n++;
      sum += n * 0.25;
    }
  }
  // Hele søket som én streng i tittelen: den beste formen for treff.
  const helt = termer.join(" ");
  if (p.nTittel === helt) sum += 30;
  else if (p.nTittel.startsWith(helt)) sum += 12;
  return sum;
}

// Treffene, sterkest først, gruppert etter type. Gruppene kommer i rekkefølge
// etter sitt BESTE treff, ikke i en fast typerekkefølge: søker man «grammofon»,
// skal innovasjonskortet med det navnet stå før åtte artister som nevner ordet
// i en biografi. Hele lista følger med per gruppe — visningen bestemmer selv
// hvor mange den viser før «Vis alle».
export function sok(indeks, query) {
  const termer = delOppSok(query);
  if (!termer.length || termer.join("").length < MIN_LENGDE) {
    return { termer: [], grupper: [], totalt: 0, forKort: true };
  }
  const treff = [];
  for (const p of indeks) {
    const s = poeng(p, termer);
    if (s > 0) treff.push({ ...p, score: s });
  }
  treff.sort((a, b) => b.score - a.score || a.tittel.localeCompare(b.tittel, "no"));

  const perType = new Map();
  for (const t of treff) {
    if (!perType.has(t.type)) perType.set(t.type, []);
    perType.get(t.type).push(t);
  }
  const grupper = [...perType.entries()]
    .map(([type, alle]) => ({
      type,
      label: TYPE_FLERTALL[type] || TYPE_LABEL[type] || type,
      antall: alle.length,
      beste: alle[0].score,
      treff: alle,
    }))
    .sort((a, b) => b.beste - a.beste
      || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  return { termer, grupper, totalt: treff.length, forKort: false };
}

// ---------------------------------------------------------------------------
//  UTDRAGET
// ---------------------------------------------------------------------------
//  Et vindu rundt det første treffet i teksten, med søkeordene uthevet. Teksten
//  escapes FØR <mark> settes inn, så innhold aldri kan smugle inn markup.
export function utdrag(p, termer, { bredde = 150 } = {}) {
  if (!p.tekst) return "";
  // Vaktposten: skulle normaliseringen likevel ha endret lengden (et tegn
  // toLowerCase ikke er én-til-én for), viser vi begynnelsen i stedet for å
  // skjære på en forskjøvet posisjon.
  const trygtKart = p.nTekst.length === p.tekst.length;
  let i = -1;
  if (trygtKart) {
    for (const t of termer) {
      const funn = p.nTekst.indexOf(t);
      if (funn >= 0 && (i < 0 || funn < i)) i = funn;
    }
  }
  // Bare tittelen traff: vis begynnelsen av teksten som kontekst.
  const start = i < 0 ? 0 : Math.max(0, i - Math.floor(bredde / 3));
  const slutt = Math.min(p.tekst.length, start + bredde);
  const bit = p.tekst.slice(start, slutt);
  return (start > 0 ? "… " : "") + marker(bit, termer) + (slutt < p.tekst.length ? " …" : "");
}

// Markerer søkeordene i ren tekst og returnerer trygg HTML. Bitene escapes
// HVER FOR SEG etter oppdelingen, ikke før: markerte vi i den escapede
// strengen, kunne et søk på «amp» lagt en <mark> midt inne i «&amp;» og
// dermed brukket entiteten.
export function marker(tekst, termer) {
  const n = normaliser(tekst);
  if (n.length !== tekst.length) return escapeHtml(tekst);
  const spenn = [];
  for (const t of termer) {
    let i = n.indexOf(t);
    while (i >= 0) { spenn.push([i, i + t.length]); i = n.indexOf(t, i + t.length); }
  }
  if (!spenn.length) return escapeHtml(tekst);
  spenn.sort((a, b) => a[0] - b[0]);
  const flettet = [spenn[0]];
  for (const [a, b] of spenn.slice(1)) {
    const siste = flettet[flettet.length - 1];
    if (a <= siste[1]) siste[1] = Math.max(siste[1], b);
    else flettet.push([a, b]);
  }
  let ut = "", pos = 0;
  for (const [a, b] of flettet) {
    ut += escapeHtml(tekst.slice(pos, a)) + "<mark>" + escapeHtml(tekst.slice(a, b)) + "</mark>";
    pos = b;
  }
  return ut + escapeHtml(tekst.slice(pos));
}
