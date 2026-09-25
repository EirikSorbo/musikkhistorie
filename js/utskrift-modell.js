// ============================================================================
//  UTSKRIFT — ren modell (v5.56)
// ----------------------------------------------------------------------------
//  Studentenes eget hefte (brukerbestilling 2026-09-25): et utvalg av kort
//  (artister, sjangre, undersjangre, tiår, innovasjoner, instrumenter,
//  historier og innholdssider) settes sammen til én lesbar struktur som
//  utskrift.html tegner, og som nettleseren lagrer som PDF. Modulen er DOM-
//  fri og Node-testbar: utvalget, dataene og flaggene kommer inn som
//  argumenter, og ut kommer en ren datastruktur uten HTML.
//
//  Utvalget er en liste med ?vis=-verdier (js/vis-lenke.js), samme form som
//  stoppene i en kjøreplan, så en plan kan bli et hefte med én knapp
//  (planTilUtvalg). Lagringen i nettleseren bor i js/utskrift-utvalg.js, og
//  tegningen i js/utskrift.js.
//
//  Rekkefølgen er selv et pedagogisk valg: metasjangrene i den kuraterte
//  rekkefølgen (STORY_ORDER, deretter treets), sjangrene i den rekkefølgen
//  de oppsto, artistene kronologisk etter innflytelsesår. Tiår, innovasjoner,
//  instrumenter og sider står som bakteppe etter sjangrene; lytteliste og
//  kilder bakerst. Kommer utvalget fra en kjøreplan, kan lærerens rekkefølge
//  beholdes (form.rekkefolge = "valgt").
//
//  Feature-flaggene gjelder her som i appen: det studentene ikke ser på
//  skjermen, kommer heller ikke på papir (historier, punkter, «Hør etter»,
//  de skjulte hubsidene). Læreren får alt.
// ============================================================================

import { parseVisVerdi, byggVisVerdi } from "./vis-lenke.js?v=5.56";
import { DECADES, isVisible, INSTRUMENT_TIMELINE_GROUPS, INSTRUMENT_TITLE, instrumentPageId, decadesForArtist } from "./limits.js?v=5.56";
import { resolveSpan } from "./timeline-lanes.js?v=5.56";
import { GENEALOGY, META_GENRE_ORDER, META_GENRE_COLOR, FAMILIES, nodeColor, findTreeGenreNode } from "./genre-model.js?v=5.56";
import { resolveDesc, resolveDescAny } from "./genre-descriptions.js?v=5.56";
import { STORY_ORDER, storyFor, pageFor, stripGenrePath } from "./story-format.js?v=5.56";
import { heatRow } from "./heat-strip.js?v=5.56";
import { ytMaal } from "./presentasjon-modell.js?v=5.56";
import { normaliserPunkter } from "./punkter.js?v=5.56";
import { safeUrl } from "./util.js?v=5.56";

// Måltypene som kan stå i et hefte. Resten av vis-typene (varmekart,
// tidslinje, koblinger, podkaster, spilleren …) er skjermflater uten
// papirform og hoppes stille over.
export const UTSKRIFT_TYPER = new Set(["artist", "sjanger", "undersjanger", "tiår", "tech", "instrument", "historie", "side"]);

// Innholdssidene som kan stå i et hefte. Bruksveiledningen («guide»/
// «appGuide») er en manual for appen, ikke pensum, og holdes utenfor.
export const SIDER_I_HEFTET = { rotter: "Røtter før 1910", omHistorie: "Om historie" };
const HUB_KORT_FOR_SIDE = { rotter: "sb-rotter", omHistorie: "sb-om-historie" };

export const TITTEL_MAKS = 60;
export const ROTTER = "Røtter";
// Undersjangre som ikke lar seg plassere i en familie (ingen artist bærer
// taggen, og navnet er ikke en tre-node) samles i en egen bolk bakerst.
export const UNDERSJANGRE_LOSE = "Undersjangre";

export const TYPE_ETIKETT = {
  artist: "Artist", sjanger: "Sjanger", undersjanger: "Undersjanger", "tiår": "Tiår",
  tech: "Innovasjon", instrument: "Instrument", historie: "Historie", side: "Side",
};

// ---------------------------------------------------------------------------
//  Utvalget
// ---------------------------------------------------------------------------

// Den kanoniske formen av en vis-verdi i utvalget, eller null når verdien
// ikke kan stå i et hefte. Tiåret mister modusen (samfunn/teknologi er to
// faner på skjermen, men ett oppslag på papir), så «tiår:1950:tech» og
// «tiår:1950» er samme kort.
export function kanoniskVis(vis) {
  const m = parseVisVerdi(vis);
  if (!m || !UTSKRIFT_TYPER.has(m.hva) || !m.id) return null;
  if (m.hva === "side" && !SIDER_I_HEFTET[m.id]) return null;
  if (m.hva === "tiår") {
    const d = Number(m.id);
    return DECADES.includes(d) ? `tiår:${d}` : null;
  }
  return byggVisVerdi({ hva: m.hva, id: m.id });
}

// Vasker en liste (fra localStorage, en lenke eller en kjøreplan): bare
// gyldige mål, hvert én gang, i den rekkefølgen de først sto.
export function normaliserUtvalg(raa) {
  const ut = [];
  for (const v of Array.isArray(raa) ? raa : []) {
    const k = kanoniskVis(typeof v === "string" ? v : v?.vis);
    if (k && !ut.includes(k)) ut.push(k);
  }
  return ut;
}

// En kjøreplans stopp som utvalg. Et lytteeksempel-stopp («yt:<video>»)
// blir artisten som eier eksempelet, så heftet får kortet lenken hører til.
export function planTilUtvalg(stopp, artister = []) {
  const ut = [];
  for (const s of Array.isArray(stopp) ? stopp : []) {
    const vis = typeof s === "string" ? s : s?.vis;
    const m = parseVisVerdi(vis);
    if (!m) continue;
    if (m.hva === "yt") {
      const eier = (artister || []).find((a) => (a?.musicExamples || []).some((x) => ytMaal(x?.url || "")?.video === m.id));
      if (eier) ut.push(`artist:${eier.id}`);
      continue;
    }
    ut.push(vis);
  }
  return normaliserUtvalg(ut);
}

// ---------------------------------------------------------------------------
//  Delene og formen
// ---------------------------------------------------------------------------

// Avkryssingslista i utskriftspanelet: hva hvert kort tar med. Samme
// seksjoner som presentasjonens tannhjul (js/presentasjon-modell.js), minus
// det som bare gir mening på en skjerm (innflytelseslinja per artist er
// erstattet av tidslinja foran, beslektede artister er navigasjon).
// `punkter: true` merker valgene som bare vises når punktene er sluppet
// (js/feature-flags.js, PUNKTER_BARE_I_PRESENTASJON).
export const DELER = [
  { gruppe: "Artistkort", valg: [
    { id: "artist.bilde", navn: "Bilde" },
    { id: "artist.fakta", navn: "Faktalinje" },
    { id: "artist.punkter", navn: "Oppsummering i punkter", punkter: true },
    { id: "artist.beskrivelse", navn: "Beskrivelse" },
    { id: "artist.verk", navn: "Sentrale verk" },
    { id: "artist.lytte", navn: "Lytteeksempler" },
  ] },
  { gruppe: "Sjangerkort", valg: [
    { id: "sjanger.stripe", navn: "Varmestripe" },
    { id: "sjanger.era", navn: "Epoke" },
    { id: "sjanger.punkter", navn: "Oppsummering i punkter", punkter: true },
    { id: "sjanger.beskrivelse", navn: "Beskrivelse" },
    { id: "sjanger.relasjoner", navn: "Slektskap" },
    { id: "sjanger.ordliste", navn: "Ordliste over undersjangrene på artistkortene" },
  ] },
  { gruppe: "Innovasjonskort", valg: [
    { id: "tech.bilde", navn: "Bilde" },
    { id: "tech.fakta", navn: "Årstall og kategori" },
    { id: "tech.punkter", navn: "Oppsummering i punkter", punkter: true },
    { id: "tech.beskrivelse", navn: "Beskrivelse" },
  ] },
  { gruppe: "Tiår", valg: [
    { id: "tiaar.samfunn", navn: "Samfunn" },
    { id: "tiaar.teknologi", navn: "Teknologi" },
    { id: "tiaar.innovasjoner", navn: "Innovasjonene i tiåret" },
    { id: "tiaar.artister", navn: "Artistene i utvalget som hører til tiåret" },
  ] },
  { gruppe: "Foran og bak", valg: [
    { id: "foran.tidslinje", navn: "Tidslinje over utvalget" },
    { id: "bak.lytteliste", navn: "Lytteliste" },
    { id: "bak.kilder", navn: "Kilder" },
  ] },
];

export const STANDARD_DELER = Object.freeze(Object.fromEntries(DELER.flatMap((g) => g.valg.map((v) => [v.id, true]))));

export function normaliserDeler(raa) {
  const ut = { ...STANDARD_DELER };
  if (raa && typeof raa === "object") {
    for (const k of Object.keys(ut)) if (typeof raa[k] === "boolean") ut[k] = raa[k];
  }
  return ut;
}

// kompakt: uten bilder og med tettere sats. rekkefolge: «kronologisk» er den
// kuraterte rekkefølgen, «valgt» følger utvalget (kjøreplanens rekkefølge).
export const STANDARD_FORM = Object.freeze({ kompakt: false, rekkefolge: "kronologisk" });

export function normaliserForm(raa) {
  const o = raa && typeof raa === "object" ? raa : {};
  return {
    kompakt: o.kompakt === true,
    rekkefolge: o.rekkefolge === "valgt" ? "valgt" : "kronologisk",
  };
}

export function normaliserTittel(t) {
  return String(t ?? "").replace(/\s+/g, " ").trim().slice(0, TITTEL_MAKS);
}

// Hele det lagrede objektet (localStorage «pensum-utskrift»): tåler alt.
export function normaliserLagret(raa) {
  const o = raa && typeof raa === "object" ? raa : {};
  const plan = o.plan && typeof o.plan === "object"
    ? { id: String(o.plan.id || ""), tittel: normaliserTittel(o.plan.tittel) }
    : null;
  return {
    v: 1,
    valg: normaliserUtvalg(o.valg),
    tittel: normaliserTittel(o.tittel),
    deler: normaliserDeler(o.deler),
    form: normaliserForm(o.form),
    plan: plan && (plan.id || plan.tittel) ? plan : null,
  };
}

// ---------------------------------------------------------------------------
//  Små hjelpere (speiler appens egne, uten å dra inn DOM-modulene)
// ---------------------------------------------------------------------------

// Epoke-linja, samme regel som eraLine i js/genealogy.js: årstallene først,
// så friteksten som egen setning. genealogy.js drar inn modaler og
// lenkekobling, så regelen står også her.
function eraTekst(r) {
  const fra = r?.activeFrom, til = r?.activeTo;
  const aar = Number.isInteger(fra) ? `ca. ${fra}–${Number.isInteger(til) ? til : "i dag"}` : "";
  const ord = String(r?.era || "").trim();
  if (!aar) return ord;
  if (!ord) return aar;
  return `${aar}. ${ord}`;
}

// Levetid og innflytelse som på artistkortet (factsLines i ui-helpers.js).
function levetid(a) {
  if (a.birthYear && a.deathYear) return `${a.birthYear}–${a.deathYear}`;
  if (a.birthYear) return `${a.birthYear}–`;
  if (a.deathYear) return `?–${a.deathYear}`;
  return "";
}

function innflytelse(a) {
  if (!a.influenceStart) return "";
  const p = (!a.influenceEnd || a.influenceEnd === a.influenceStart)
    ? `${a.influenceStart}`
    : `${a.influenceStart}–${a.influenceEnd}`;
  return `ca. ${p}`;
}

// Sjangerkortets reserve-sortering når årstallene mangler: treets tiårsrad
// (rad 1 = 1900, se buildDecadeRows i genre-model.js). Røttene (rad 0) først.
function radAar(n) {
  const r = Math.floor(Number(n?.r) || 0);
  return r >= 1 ? 1900 + (r - 1) * 10 : 1850;
}

const kreditt = (raa) => String(raa || "").replace(/^Foto:\s*/i, "").trim();
const heltall = (v) => (Number.isInteger(v) ? v : null);

// Den kuraterte rekkefølgen for familiene: røttene, så historienes
// rekkefølge, så resten av treets metasjangre. Leses ved kall (live
// bindings), aldri ved import.
function familieRang() {
  const rang = [ROTTER];
  for (const m of [...STORY_ORDER, ...META_GENRE_ORDER]) if (!rang.includes(m)) rang.push(m);
  return rang;
}

function familieFarge(navn) {
  if (META_GENRE_COLOR[navn]) return META_GENRE_COLOR[navn];
  return FAMILIES.gray?.stroke || "#9bada1";
}

// Familien en undersjanger hører til: den metasjangeren flest artister med
// taggen har; ellers treets node med samme navn; ellers den løse bolken.
function familieForUndersjanger(navn, artists) {
  const s = String(navn).toLowerCase();
  const telling = new Map();
  for (const a of artists) {
    if (!a.metaGenre) continue;
    if ((a.subGenre || []).some((t) => String(t).toLowerCase() === s)) {
      telling.set(a.metaGenre, (telling.get(a.metaGenre) || 0) + 1);
    }
  }
  const beste = [...telling.entries()].sort((x, y) => y[1] - x[1])[0];
  if (beste) return beste[0];
  const n = findTreeGenreNode(navn);
  return n?.g || UNDERSJANGRE_LOSE;
}

// Kildelista på ett kort, vasket: objekter med tekst og/eller lenke, hver
// én gang. Strenger tolkes som kildetekst (samme koersjon som importen).
function rydKilder(liste) {
  const sett = new Set();
  const ut = [];
  for (const k of Array.isArray(liste) ? liste : []) {
    const o = typeof k === "string" ? { text: k } : k;
    if (!o || typeof o !== "object") continue;
    const text = String(o.text || "").trim();
    const url = safeUrl(o.url) || "";
    if (!text && !url) continue;
    const nokkel = `${text}|${url}`;
    if (sett.has(nokkel)) continue;
    sett.add(nokkel);
    ut.push({ text, url, forfatter: String(o.forfatter || "").trim(), year: o.year || null });
  }
  return ut;
}

// ---------------------------------------------------------------------------
//  Sammensetningen
// ---------------------------------------------------------------------------

// utvalg: vis-verdier. data: sidens state (artists, genreDescs, content,
// decadeDescs, techItems). Returnerer heftets struktur:
//   familier[]     én per metasjanger: hodeKort (tre-noden med samme navn),
//                  sjangre[] (hver med artister[]), loseArtister[] (artister
//                  uten valgt sjangerkort), ordliste[], historie
//   bakteppe[]     tiårene, innovasjoner[], instrumenter[], sider[]
//   lytteliste[]   nummererte lytteeksempler i heftets rekkefølge
//   kilder[]       kildene per kort i heftets rekkefølge
//   tidslinje      radene til figuren foran, eller null
//   tellinger, aarsspenn, mangler[] ({ vis, grunn }), tom
export function settSammen(utvalg, data = {}, valg = {}) {
  const {
    deler: delerRaa, form: formRaa, erLaerer = false, skjul = {}, skjulHub = {},
    punkterSkjult = true, naa = new Date().getFullYear(),
  } = valg;
  const d = normaliserDeler(delerRaa);
  const f = normaliserForm(formRaa);
  const liste = normaliserUtvalg(utvalg);
  const artists = (data.artists || []).filter(isVisible);
  const genreDescs = data.genreDescs || {};
  const content = data.content || {};
  const decadeDescs = data.decadeDescs || {};
  const tech = (data.techItems || []).filter((t) => t && (t.status || "active") === "active");
  const heat = content?.varmekart?.heat || null;
  const punkterOk = !punkterSkjult;
  const historierOk = erLaerer || !skjul.metasjangerhistorier;
  const horEtterOk = erLaerer || !skjul.horEtter;
  const sideOk = (id) => erLaerer || !skjulHub[HUB_KORT_FOR_SIDE[id]];
  const valgtRekke = f.rekkefolge === "valgt";
  const byId = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));

  const rekke = new Map();
  liste.forEach((vis, i) => rekke.set(vis, i));
  const mangler = [];

  function lagArtistKort(a) {
    const span = resolveSpan(a, naa);
    const bildeUrl = safeUrl(a.imageUrl);
    return {
      vis: `artist:${a.id}`, id: a.id, navn: a.name || "(uten navn)", familie: a.metaGenre || "",
      levetid: levetid(a),
      fakta: {
        instrument: a.instrument || "", virkested: a.geography || "", plateselskap: a.recordLabel || "",
        innflytelse: innflytelse(a),
        sjangre: Array.isArray(a.mainGenre) ? [...a.mainGenre] : [],
        undersjangre: Array.isArray(a.subGenre) ? [...a.subGenre] : [],
      },
      bilde: bildeUrl ? { url: bildeUrl, kreditt: kreditt(a.imageCredit) } : null,
      punkter: punkterOk ? normaliserPunkter(a.punkter) : [],
      beskrivelse: a.description || "",
      verk: (a.keyWorks || [])
        .filter((w) => w && w.title)
        .map((w) => ({ tittel: String(w.title), aar: heltall(w.year) }))
        .sort((x, y) => (x.aar ?? 9999) - (y.aar ?? 9999)),
      lytte: (a.musicExamples || [])
        .filter((m) => m && safeUrl(m.url))
        .map((m) => ({ nr: 0, label: m.label || "Lytt", year: heltall(m.year), performanceYear: heltall(m.performanceYear), url: safeUrl(m.url) })),
      kilder: rydKilder(a.kilder),
      span, tiaar: decadesForArtist(a, naa),
      sort: [span ? span.start : 9999, a.name || ""],
    };
  }

  function lagSjangerKort(n) {
    const r = resolveDescAny(genreDescs, [n.l, n.f], "main");
    const fra = heltall(r.activeFrom), til = heltall(r.activeTo);
    return {
      vis: `sjanger:${n.l}`, id: n.id, navn: n.f || n.l, label: n.l, familie: n.g || ROTTER,
      era: eraTekst(r), fra, til, apen: fra != null && til == null,
      stripe: heat && n.g ? { farge: nodeColor(n), verdier: heatRow(heat, n.l) } : null,
      relasjoner: {
        fra: (n.p || []).map((id) => byId[id]?.f || id),
        til: GENEALOGY.filter((x) => (x.p || []).includes(n.id)).map((x) => x.f),
        mot: (n.rx || []).map((id) => byId[id]?.f || id),
        motAv: GENEALOGY.filter((x) => (x.rx || []).includes(n.id)).map((x) => x.f),
      },
      punkter: punkterOk ? r.punkter : [],
      beskrivelse: r.description || "",
      lytt: horEtterOk ? r.lytt : [],
      kilder: rydKilder(r.kilder),
      artister: [],
      sort: [fra ?? radAar(n), GENEALOGY.indexOf(n)],
    };
  }

  function lagTechKort(t) {
    const bildeUrl = safeUrl(t.imageUrl);
    const aar = heltall(t.adoptedYear) ?? heltall(t.inventedYear);
    return {
      vis: `tech:${t.id}`, id: t.id, navn: t.name || "(uten navn)", hendelse: t.type === "hendelse",
      kategori: t.category || "", instrument: t.instrument || "",
      oppfunnet: heltall(t.inventedYear), iBruk: heltall(t.adoptedYear), iBrukTekst: String(t.adoptedLabel || "").trim(),
      bilde: bildeUrl ? { url: bildeUrl, kreditt: kreditt(t.imageCredit) } : null,
      punkter: punkterOk ? normaliserPunkter(t.punkter) : [],
      beskrivelse: t.description || "",
      kilder: rydKilder(t.kilder),
      aar, sort: [aar ?? 9999, t.name || ""],
    };
  }

  // --- Slå opp hvert valg ---------------------------------------------------
  const artistKort = [], sjangerKort = [], underValgt = [], tiaarValgt = [];
  const techKort = [], instrValgt = [], histValgt = [], sideValgt = [];
  for (const vis of liste) {
    const m = parseVisVerdi(vis);
    switch (m.hva) {
      case "artist": {
        const a = artists.find((x) => x.id === m.id);
        if (a) artistKort.push(lagArtistKort(a)); else mangler.push({ vis, grunn: "finnes-ikke" });
        break;
      }
      case "sjanger": {
        const n = findTreeGenreNode(m.id);
        if (n) sjangerKort.push(lagSjangerKort(n)); else mangler.push({ vis, grunn: "finnes-ikke" });
        break;
      }
      case "undersjanger": {
        const r = resolveDesc(genreDescs, m.id, "sub");
        if (r.description) underValgt.push({ vis, navn: m.id, tekst: r.description, kilder: rydKilder(r.kilder) });
        else mangler.push({ vis, grunn: "finnes-ikke" });
        break;
      }
      case "tiår":
        tiaarValgt.push(Number(m.id));
        break;
      case "tech": {
        const t = tech.find((x) => x.id === m.id);
        if (t) techKort.push(lagTechKort(t)); else mangler.push({ vis, grunn: "finnes-ikke" });
        break;
      }
      case "instrument":
        if (INSTRUMENT_TIMELINE_GROUPS.includes(m.id)) instrValgt.push(m.id);
        else mangler.push({ vis, grunn: "finnes-ikke" });
        break;
      case "historie": {
        if (!historierOk) { mangler.push({ vis, grunn: "skjult" }); break; }
        const s = storyFor(m.id, genreDescs);
        if (s) histValgt.push({ vis, navn: m.id, body: stripGenrePath(s.body) });
        else mangler.push({ vis, grunn: "finnes-ikke" });
        break;
      }
      case "side": {
        if (!sideOk(m.id)) { mangler.push({ vis, grunn: "skjult" }); break; }
        const p = pageFor(m.id, content);
        if (p) sideValgt.push({ vis, id: m.id, tittel: SIDER_I_HEFTET[m.id], body: p.body, kilder: rydKilder(p.kilder) });
        else mangler.push({ vis, grunn: "finnes-ikke" });
        break;
      }
    }
  }

  // --- Rekkefølge -----------------------------------------------------------
  const etterValg = (a, b) => rekke.get(a.vis) - rekke.get(b.vis);
  const etterSort = (a, b) => (a.sort[0] - b.sort[0])
    || (typeof a.sort[1] === "number" ? a.sort[1] - b.sort[1] : String(a.sort[1]).localeCompare(String(b.sort[1]), "no"));
  const ordne = (arr) => [...arr].sort(valgtRekke ? etterValg : etterSort);

  // --- Familiene ------------------------------------------------------------
  const familier = new Map();
  const fam = (navn) => {
    if (!familier.has(navn)) {
      familier.set(navn, { navn, farge: familieFarge(navn), pseudo: navn === UNDERSJANGRE_LOSE,
        hodeKort: null, sjangre: [], loseArtister: [], ordliste: new Map(), historie: null, forst: Infinity });
    }
    return familier.get(navn);
  };
  const merkForst = (F, vis) => { F.forst = Math.min(F.forst, rekke.get(vis) ?? Infinity); };

  for (const k of ordne(sjangerKort)) {
    const F = fam(k.familie);
    merkForst(F, k.vis);
    // Noden med familiens eget navn (Blues i Blues) er familiens hode: den
    // åpner seksjonen i stedet for å stå som ett kort blant flere.
    if (!F.hodeKort && (k.label === F.navn || k.navn === F.navn)) F.hodeKort = k;
    else F.sjangre.push(k);
  }

  const kortForSjanger = new Map();
  for (const k of sjangerKort) {
    kortForSjanger.set(k.label.toLowerCase(), k);
    kortForSjanger.set(k.navn.toLowerCase(), k);
  }
  for (const k of ordne(artistKort)) {
    const treff = k.fakta.sjangre.map((s) => kortForSjanger.get(String(s).toLowerCase())).find(Boolean);
    const F = fam(treff ? treff.familie : (k.familie || "Andre"));
    merkForst(F, k.vis);
    k.plassertI = F.navn;
    if (treff) treff.artister.push(k); else F.loseArtister.push(k);
  }

  const leggIOrdliste = (F, navn, tekst, kilder, vis) => {
    if (!F.ordliste.has(navn)) F.ordliste.set(navn, { vis, navn, tekst, kilder });
  };
  if (d["sjanger.ordliste"]) {
    for (const k of artistKort) {
      for (const tag of k.fakta.undersjangre) {
        const r = resolveDesc(genreDescs, tag, "sub");
        if (r.description) leggIOrdliste(fam(k.plassertI), tag, r.description, rydKilder(r.kilder), `undersjanger:${tag}`);
      }
    }
  }
  for (const u of underValgt) {
    const F = fam(familieForUndersjanger(u.navn, artists));
    merkForst(F, u.vis);
    leggIOrdliste(F, u.navn, u.tekst, u.kilder, u.vis);
  }
  for (const hst of histValgt) {
    const F = fam(hst.navn);
    merkForst(F, hst.vis);
    F.historie = hst;
  }

  const rang = familieRang();
  const familieListe = [...familier.values()]
    .map((F) => ({ ...F, ordliste: [...F.ordliste.values()].sort((a, b) => a.navn.localeCompare(b.navn, "no")) }))
    .sort((a, b) => {
      if (a.pseudo !== b.pseudo) return a.pseudo ? 1 : -1;
      if (valgtRekke) return a.forst - b.forst || a.navn.localeCompare(b.navn, "no");
      const ia = rang.indexOf(a.navn), ib = rang.indexOf(b.navn);
      const ra = ia < 0 ? Number.MAX_SAFE_INTEGER : ia, rb = ib < 0 ? Number.MAX_SAFE_INTEGER : ib;
      return ra - rb || a.navn.localeCompare(b.navn, "no");
    });

  // Heftets rekkefølge på kortene, brukt av nummereringen, kildene og
  // tidslinja.
  const dokSjangre = [], dokArtister = [];
  for (const F of familieListe) {
    for (const k of [F.hodeKort, ...F.sjangre].filter(Boolean)) {
      dokSjangre.push(k);
      dokArtister.push(...k.artister);
    }
    dokArtister.push(...F.loseArtister);
  }

  // --- Lyttelista -----------------------------------------------------------
  const lytteliste = [];
  if (d["bak.lytteliste"] && d["artist.lytte"]) {
    let nr = 0;
    for (const k of dokArtister) {
      for (const l of k.lytte) {
        l.nr = ++nr;
        lytteliste.push({ nr, artist: k.navn, label: l.label, year: l.year, performanceYear: l.performanceYear, url: l.url });
      }
    }
  }

  // --- Bakteppet ------------------------------------------------------------
  const tiaarListe = valgtRekke ? tiaarValgt : [...tiaarValgt].sort((a, b) => a - b);
  const tiaarFor = (t) => {
    const dec = Number(t.decade);
    if (Number.isInteger(dec) && dec > 0) return dec;
    return Number.isInteger(t.adoptedYear) ? Math.floor(t.adoptedYear / 10) * 10 : null;
  };
  const bakteppe = tiaarListe.map((tiaar) => {
    const desc = decadeDescs[String(tiaar)] || {};
    return {
      vis: `tiår:${tiaar}`, tiaar,
      samfunn: d["tiaar.samfunn"] ? String(desc.society || "") : "",
      teknologi: d["tiaar.teknologi"] ? String(desc.tech || "") : "",
      kilder: rydKilder(desc.kilder),
      artister: d["tiaar.artister"] ? dokArtister.filter((k) => k.tiaar.includes(tiaar)).map((k) => k.navn) : [],
      innovasjoner: d["tiaar.innovasjoner"]
        ? tech.filter((t) => t.type !== "hendelse" && tiaarFor(t) === tiaar)
          .map((t) => ({ navn: t.name || "(uten navn)", aar: heltall(t.adoptedYear) ?? heltall(t.inventedYear) }))
          .sort((a, b) => (a.aar ?? 9999) - (b.aar ?? 9999) || a.navn.localeCompare(b.navn, "no"))
        : [],
    };
  });

  const innovasjoner = ordne(techKort);
  const instrListe = valgtRekke ? instrValgt : INSTRUMENT_TIMELINE_GROUPS.filter((g) => instrValgt.includes(g));
  const instrumenter = instrListe.map((g) => {
    const p = pageFor(instrumentPageId(g), content);
    return { vis: `instrument:${g}`, gruppe: g, tittel: INSTRUMENT_TITLE[g] || g, body: p?.body || "", kilder: rydKilder(p?.kilder) };
  });
  const sider = valgtRekke
    ? sideValgt
    : Object.keys(SIDER_I_HEFTET).map((id) => sideValgt.find((s) => s.id === id)).filter(Boolean);

  // --- Kildene --------------------------------------------------------------
  const kilder = [];
  if (d["bak.kilder"]) {
    const legg = (kort, liste) => { if (liste.length) kilder.push({ kort, kilder: liste }); };
    for (const F of familieListe) {
      for (const k of [F.hodeKort, ...F.sjangre].filter(Boolean)) {
        legg(k.navn, k.kilder);
        for (const a of k.artister) legg(a.navn, a.kilder);
      }
      for (const a of F.loseArtister) legg(a.navn, a.kilder);
      for (const u of F.ordliste) legg(u.navn, u.kilder);
    }
    for (const b of bakteppe) legg(`${b.tiaar}-tallet`, b.kilder);
    for (const t of innovasjoner) legg(t.navn, t.kilder);
    for (const i of instrumenter) legg(i.tittel, i.kilder);
    for (const s of sider) legg(s.tittel, s.kilder);
  }

  // --- Tidslinja og årsspennet ----------------------------------------------
  const rader = [];
  for (const F of familieListe) {
    for (const k of [F.hodeKort, ...F.sjangre].filter(Boolean)) {
      if (k.fra != null) rader.push({ navn: k.navn, type: "sjanger", fra: k.fra, til: k.til ?? naa, apen: k.til == null, farge: F.farge });
      for (const a of k.artister) {
        if (a.span) rader.push({ navn: a.navn, type: "artist", fra: a.span.start, til: a.span.end, apen: a.span.open, farge: F.farge });
      }
    }
    for (const a of F.loseArtister) {
      if (a.span) rader.push({ navn: a.navn, type: "artist", fra: a.span.start, til: a.span.end, apen: a.span.open, farge: F.farge });
    }
  }
  let aarsspenn = null;
  if (rader.length) {
    const lukkede = rader.filter((r) => !r.apen);
    aarsspenn = {
      fra: Math.min(...rader.map((r) => r.fra)),
      til: lukkede.length ? Math.max(...lukkede.map((r) => r.til)) : null,
      apen: rader.some((r) => r.apen),
    };
  }
  let tidslinje = null;
  if (d["foran.tidslinje"] && rader.length) {
    const start = Math.min(1900, Math.floor(Math.min(...rader.map((r) => r.fra)) / 10) * 10);
    const slutt = naa + 5;
    const ticks = [];
    for (let t = start; t <= Math.floor(naa / 10) * 10; t += 10) ticks.push(t);
    tidslinje = {
      start, slutt, ticks,
      rader: rader.map((r) => ({ ...r, fra: Math.max(start, Math.min(r.fra, naa)), til: Math.max(start, Math.min(r.til, naa)) })),
    };
  }

  const tellinger = {
    sjangre: sjangerKort.length, artister: artistKort.length, undersjangre: underValgt.length,
    tiaar: tiaarValgt.length, innovasjoner: techKort.length, instrumenter: instrValgt.length,
    historier: histValgt.length, sider: sideValgt.length,
  };

  return {
    valg: liste, deler: d, form: f, punkterOk,
    familier: familieListe, bakteppe, innovasjoner, instrumenter, sider,
    lytteliste, kilder, tidslinje, tellinger, aarsspenn, mangler,
    tom: liste.length === 0,
  };
}

// ---------------------------------------------------------------------------
//  Tittel og tellinger
// ---------------------------------------------------------------------------

const TELLE_ORD = [
  ["sjangre", "sjanger", "sjangre"], ["artister", "artist", "artister"],
  ["undersjangre", "undersjanger", "undersjangre"], ["tiaar", "tiår", "tiår"],
  ["innovasjoner", "innovasjon", "innovasjoner"], ["instrumenter", "instrument", "instrumenter"],
  ["historier", "historie", "historier"], ["sider", "side", "sider"],
];

// «2 sjangre · 5 artister · 1 tiår · 2 innovasjoner»
export function tellingerTekst(tellinger = {}) {
  return TELLE_ORD
    .filter(([k]) => tellinger[k] > 0)
    .map(([k, en, fl]) => `${tellinger[k]} ${tellinger[k] === 1 ? en : fl}`)
    .join(" · ");
}

// «Blues, Jazz og R&B»
function listeTekst(navn) {
  if (navn.length <= 1) return navn.join("");
  return `${navn.slice(0, -1).join(", ")} og ${navn[navn.length - 1]}`;
}

// «1950-tallet», «1950- og 1960-tallet», «1950-, 1960- og 1970-tallet»
function tiaarTekst(tiaar) {
  const t = [...new Set(tiaar)].sort((a, b) => a - b);
  if (t.length === 1) return `${t[0]}-tallet`;
  return `${t.slice(0, -1).map((x) => `${x}-`).join(", ")} og ${t[t.length - 1]}-tallet`;
}

// Tittelforslaget (brukerens regler 2026-09-25): kjøreplanens tittel når
// utvalget kom derfra; én metasjanger med årsspenn; flere metasjangre listet
// (høyst tre); bare tiår; ellers «Pensumutdrag». Studentens egen tittel
// overstyrer alltid (feltet på utskriftssiden).
export function foreslaaTittel(modell, { planTittel = "" } = {}) {
  const plan = normaliserTittel(planTittel);
  if (plan) return plan;
  const fam = (modell?.familier || []).filter((F) => !F.pseudo);
  if (fam.length === 1) {
    const navn = fam[0].navn;
    const s = modell.aarsspenn;
    if (!s) return normaliserTittel(navn);
    if (s.apen || s.til == null) return normaliserTittel(`${navn} fra ${s.fra}`);
    if (s.fra === s.til) return normaliserTittel(`${navn} ${s.fra}`);
    return normaliserTittel(`${navn} ${s.fra}–${s.til}`);
  }
  if (fam.length >= 2) {
    const navn = fam.map((F) => F.navn);
    const tekst = navn.length <= 3 ? listeTekst(navn) : `${navn.slice(0, 3).join(", ")} og ${navn.length - 3} til`;
    return normaliserTittel(tekst);
  }
  const tiaar = (modell?.bakteppe || []).map((b) => b.tiaar);
  if (tiaar.length) return normaliserTittel(tiaarTekst(tiaar));
  if (modell?.innovasjoner?.length) return "Innovasjoner";
  if (modell?.instrumenter?.length) return "Instrumentene";
  return "Pensumutdrag";
}
