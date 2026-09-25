// ============================================================================
//  PRESENTASJONSVISNING — ren modell (v5.24)
// ----------------------------------------------------------------------------
//  Node-testbar logikk for presentasjonsvisningen (js/presentasjon.js er
//  browser-delen): hvilke seksjoner hver detaljflate har, hva de tre
//  detaljnivåene viser, og parsing av YouTube-lenker for den innebygde
//  spilleren. Beslutninger låst 2026-09-17: tre nivåer (Overskrift/Kjerne/
//  Alt) + unntak per seksjon.
//
//  Seksjons-ID-ene er kontrakten mot data-sekt-attributtene i renderne
//  (ui.js, genealogy.js, ui-tech.js og markupen i explore-modals.js) — en
//  test låser at de to sidene stemmer overens.
// ============================================================================

import { parseVisVerdi } from "./vis-lenke.js?v=5.64";

// Flatene som styres av detaljnivået, med seksjonene i visningsrekkefølge.
// Navnene vises i tannhjul-panelet. Flater som ikke står her (varmekart,
// tidslinje, sider …) viser alltid alt.
export const FLATER = {
  artist: [
    { id: "bilde", navn: "Bilde" },
    { id: "fakta", navn: "Fakta (levetid, plateselskap …)" },
    { id: "tags", navn: "Instrument og sjanger" },
    { id: "stripe", navn: "Innflytelseslinje" },
    { id: "punkter", navn: "Oppsummering i punkter" },
    { id: "beskrivelse", navn: "Beskrivelse" },
    { id: "verk", navn: "Sentrale verk" },
    { id: "lytte", navn: "Lytteeksempler" },
    { id: "beslektede", navn: "Beslektede artister" },
  ],
  sjanger: [
    { id: "stripe", navn: "Varmestripe" },
    { id: "era", navn: "Epoke" },
    { id: "punkter", navn: "Oppsummering i punkter" },
    { id: "beskrivelse", navn: "Beskrivelse" },
    { id: "lytt", navn: "Hør etter" },
    { id: "relasjoner", navn: "Slektskap (vokste ut av …)" },
  ],
  tech: [
    { id: "bilde", navn: "Bilde" },
    { id: "fakta", navn: "Fakta (årstall)" },
    { id: "punkter", navn: "Oppsummering i punkter" },
    { id: "beskrivelse", navn: "Beskrivelse" },
  ],
  tiår: [
    { id: "tekst", navn: "Teksten" },
    { id: "tidslinje", navn: "Tidslinjen" },
  ],
  historie: [
    { id: "striper", navn: "Varmestriper" },
    { id: "tekst", navn: "Historien" },
  ],
};

// Seksjoner som ALDRI vises på lerretet, uansett nivå og unntak (v5.29):
// kildene hører hjemme i appen, ikke i en forelesning. De står derfor heller
// ikke i FLATER, så tannhjul-panelet viser ingen død avkryssing.
export const ALDRI_I_VISNING = new Set(["kilder"]);

// Hva nivå 1 (Overskrift) og 2 (Kjerne) viser. Nivå 3 (Alt) er alle
// seksjonene, så det trenger ingen liste.
export const NIVAA_SEKT = {
  // Artistkortet (brukerens oppsett 2026-09-17): nivå 1 er bildet i fokus,
  // levetiden og innflytelseslinja — den ERSTATTER årstallslinja, som først
  // kommer på nivå 3 (se FAKTA_MIN). Lytteeksemplene står fra nivå 1
  // (brukerkrav 2026-09-19: musikken er poenget på alle nivåer). Nivå 2
  // legger til instrument/sjanger; beskrivelsen kommer på nivå 3.
  // Oppsummeringspunktene (v5.50) står på nivå 2 og gjelder bare der; se
  // PUNKT_FLATER under erSynlig for hvordan de erstatter beskrivelsen.
  artist: {
    1: ["bilde", "fakta", "stripe", "lytte"],
    2: ["bilde", "fakta", "stripe", "tags", "punkter", "lytte"],
  },
  sjanger: {
    1: ["stripe", "era"],
    2: ["stripe", "era", "punkter", "beskrivelse", "relasjoner"],
  },
  tech: {
    1: ["bilde", "fakta"],
    2: ["bilde", "fakta", "punkter", "beskrivelse"],
  },
  // Tiårstekstene ER poengene man snakker til, så de står fra nivå 1.
  tiår: {
    1: ["tekst", "tidslinje"],
    2: ["tekst", "tidslinje"],
  },
  historie: {
    1: ["striper"],
    2: ["striper", "tekst"],
  },
};

export const NIVAA_NAVN = { 1: "Overskrift", 2: "Kjerne", 3: "Alt" };

// Skal en seksjon vises? `unntak` er et objekt {"flate.sekt": true/false}
// satt i tannhjul-panelet — det overstyrer nivået begge veier («nivå 2, men
// uten verk» eller «nivå 1, men med beskrivelse»). En flate modellen ikke
// kjenner viser alltid alt; en ukjent seksjon på en kjent flate følger
// nivå 3-regelen (vises bare på Alt) — konservativt, så en ny seksjon aldri
// lekker inn på Overskrift-nivået ved en glipp.
//
// Oppsummeringspunktene (v5.50, brukervalg 2026-09-24) på artist-, sjanger- og
// teknologikortet: bare på nivå 2, der de ERSTATTER beskrivelsen; nivå 3 viser
// hele beskrivelsen uten punktene. `harPunkter` sier om kortet faktisk har
// punkter: mangler de, viser nivå 2 beskrivelsen som før (sjanger og tech),
// så ingenting forsvinner før innholdet er skrevet. Unntak overstyrer også her.
export const PUNKT_FLATER = new Set(["artist", "sjanger", "tech"]);

export function erSynlig(flate, sekt, nivaa, unntak, { harPunkter = false } = {}) {
  if (ALDRI_I_VISNING.has(sekt)) return false;
  const u = unntak ? unntak[`${flate}.${sekt}`] : undefined;
  if (u === true) return true;
  if (u === false) return false;
  if (!(flate in NIVAA_SEKT)) return true;
  const n = Number(nivaa);
  if (PUNKT_FLATER.has(flate)) {
    if (sekt === "punkter") return n === 2;
    if (sekt === "beskrivelse" && n === 2 && harPunkter) return false;
  }
  if (n >= 3) return true;
  return (NIVAA_SEKT[flate][nivaa] || []).includes(sekt);
}

// Enkeltlinjer i faktablokka (data-fakta på hver linje) styres finere enn
// seksjonen de ligger i: tallet er LAVESTE nivå linja vises på, og null
// betyr aldri. Linjer som ikke står her, følger seksjonen sin.
export const FAKTA_MIN = {
  // Bare levetiden på lerretet, fra nivå 1 (under bildet). Innflytelsesårene
  // står som stripe, og plateselskap og virkested hører til appen, ikke
  // fremvisningen (brukerkrav 2026-09-19: heller ikke på nivå 3).
  artist: { levetid: 1, innflytelse: null, plateselskap: null, virkested: null, kjønn: null },
  // Kategori og instrument er navigasjon i appen, ikke noe å vise fram.
  tech: { kategori: null, instrument: null },
};

export function faktaSynlig(flate, nokkel, nivaa) {
  const regler = FAKTA_MIN[flate];
  if (!regler || !(nokkel in regler)) return true;
  const min = regler[nokkel];
  return min !== null && Number(nivaa) >= min;
}

// ----------------------------------------------------------------------------
//  YouTube-parsing for den innebygde spilleren
// ----------------------------------------------------------------------------

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const ID_OK = /^[A-Za-z0-9_-]{6,20}$/;
const LIST_OK = /^[A-Za-z0-9_-]{10,60}$/;

// { video, list, start } for en YouTube-lenke som KAN bygges inn, ellers null.
// Søkelenker (results?search_query=…, slik slektstreets spor er) har ingen
// video-ID og gir null — de skal åpne i ny fane som før.
// `start` er sekunder fra en t=/start=-parameter (v5.29): en lærer som limer
// inn «…&t=1m30s» i et lytteeksempel får starttidspunktet med på kjøpet.
export function ytMaal(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const sti = u.pathname;
  const start = lesStart(u);

  if (host === "youtu.be") {
    const id = sti.slice(1).split("/")[0];
    return ID_OK.test(id) ? { video: id, list: lesList(u), start } : null;
  }
  if (!YT_HOSTS.has(host)) return null;

  if (sti === "/watch") {
    const id = u.searchParams.get("v") || "";
    if (ID_OK.test(id)) return { video: id, list: lesList(u), start };
    return null;
  }
  const m = sti.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{6,20})/);
  if (m && m[2] !== "videoseries") return { video: m[2], list: lesList(u), start };
  if (sti === "/playlist") {
    const list = lesList(u);
    return list ? { video: null, list, start } : null;
  }
  return null;
}

function lesList(u) {
  const list = u.searchParams.get("list") || "";
  return LIST_OK.test(list) ? list : null;
}

function lesStart(u) {
  return parseTid(u.searchParams.get("t") || u.searchParams.get("start") || "");
}

// «1:23» → 83, «83» → 83, «1m30s» → 90 (YouTubes egen t-form), «1:02:03» →
// 3723. Ugyldig eller tomt → null. Negative og absurde verdier avvises, så
// et tullverdi-felt aldri havner i en lenke.
export function parseTid(tekst) {
  const t = String(tekst ?? "").trim().toLowerCase();
  if (!t) return null;
  let sek = null;
  if (/^\d+$/.test(t)) sek = Number(t);
  else if (/^(\d+:)?\d{1,2}:\d{1,2}$/.test(t)) {
    sek = t.split(":").reduce((sum, d) => sum * 60 + Number(d), 0);
  } else {
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (!m || (!m[1] && !m[2] && !m[3])) return null;
    sek = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  }
  if (!Number.isFinite(sek) || sek < 0 || sek > 86400) return null;
  return Math.round(sek);
}

// 83 → «1:23», 3723 → «1:02:03». null/0 → tom streng (0 er «fra start»).
export function formatTid(sek) {
  const s = Math.max(0, Math.round(Number(sek) || 0));
  if (!s) return "";
  const t = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const to = (n) => String(n).padStart(2, "0");
  return t ? `${t}:${to(m)}:${to(r)}` : `${m}:${to(r)}`;
}

// ----------------------------------------------------------------------------
//  Kjøreplaner (fase 4, v5.25): forberedte stopp læreren blar gjennom med
//  piltaster eller klikker. Lagres samlet i ETT Firestore-dokument
//  (content/presentasjoner, husets varmekart-mønster): { planer: { <id>:
//  { tittel, laget, stopp: [{ vis, nivaa?, unntak? }] } } }. `vis` er samme
//  verdi som ?vis=-lenkene (vis-lenke.js), så et stopp ER en dyp lenke.
// ----------------------------------------------------------------------------

const PLAN_ID_TEGN = "abcdefghijklmnopqrstuvwxyz23456789";

export function nyPlanId() {
  const tilfeldig = new Uint32Array(6);
  globalThis.crypto.getRandomValues(tilfeldig);
  return "plan-" + [...tilfeldig].map((n) => PLAN_ID_TEGN[n % PLAN_ID_TEGN.length]).join("");
}

// Ett stopp, vasket: vis må være en ikke-tom streng, nivået klemmes til 1-3
// (eller utelates), unntak må være et objekt. Alt annet gir null.
function normaliserStopp(raa) {
  if (!raa || typeof raa.vis !== "string" || !raa.vis) return null;
  const ut = { vis: raa.vis };
  const n = Number(raa.nivaa);
  if (n >= 1 && n <= 3) ut.nivaa = Math.round(n);
  if (raa.unntak && typeof raa.unntak === "object" && !Array.isArray(raa.unntak)) ut.unntak = raa.unntak;
  return ut;
}

// En hel stoppliste, vasket stopp for stopp.
function normaliserStoppliste(raa) {
  return (Array.isArray(raa) ? raa : []).map(normaliserStopp).filter(Boolean);
}

// Vasker hele planer-feltet fra Firestore. Dokumentet er offentlig lesbart og
// skrives av editoren, men avspilleren skal aldri knekke på et håndredigert
// eller halvgammelt dokument: ødelagte planer og stopp droppes stille.
export function normaliserPlaner(raa) {
  const ut = {};
  if (!raa || typeof raa !== "object") return ut;
  for (const [id, plan] of Object.entries(raa)) {
    if (!plan || typeof plan !== "object") continue;
    const stopp = normaliserStoppliste(plan.stopp);
    ut[id] = {
      tittel: typeof plan.tittel === "string" && plan.tittel.trim() ? plan.tittel.trim() : "(uten tittel)",
      laget: typeof plan.laget === "string" ? plan.laget : "",
      stopp,
    };
    // Samleøktenes merker (v5.43): { <øktId>: løpenummer }, se brukSamleOps.
    if (plan.samle && typeof plan.samle === "object" && !Array.isArray(plan.samle)) {
      const merker = Object.fromEntries(Object.entries(plan.samle).filter(([, n]) => Number.isInteger(n) && n > 0));
      if (Object.keys(merker).length) ut[id].samle = merker;
    }
  }
  return ut;
}

// Neste stoppindeks: klemmes i [0, antall-1], ingen rundgang — etter siste
// stopp blir man stående der (en forelesning skal ikke hoppe til start ved
// ett tastetrykk for mye).
export function klampStopp(i, antall) {
  if (!Number.isFinite(antall) || antall < 1) return 0;
  return Math.min(antall - 1, Math.max(0, Math.trunc(Number(i) || 0)));
}

// Vanlig YouTube-adresse fra et yt-måls deler — motstykket til ytMaal. Brukt
// av «Åpne på YouTube»-reserven og av kjøreplan-stopp
// («yt:<id>[:<liste>][:<sekunder>]»).
export function ytWatchUrl(video, list, start) {
  const u = new URL(video ? "https://www.youtube.com/watch" : "https://www.youtube.com/playlist");
  if (video) u.searchParams.set("v", video);
  if (list) u.searchParams.set("list", list);
  if (start) u.searchParams.set("t", String(start));
  return u.href;
}

// Embed-URL for spilleren (privacy-varianten uten sporingscookies før
// avspilling). autoplay er trygt: spilleren åpnes alltid av et klikk.
// `start` (sekunder) overstyrer et eventuelt tidspunkt i selve lenka, og
// `jsapi` slår på styre-API-et spilleren bruker til å lese av tiden.
export function ytEmbedUrl(url, { start = null, jsapi = false } = {}) {
  const maal = ytMaal(url);
  if (!maal) return null;
  const p = new URLSearchParams({ autoplay: "1", rel: "0" });
  const fra = start != null ? start : maal.start;
  if (fra) p.set("start", String(fra));
  if (jsapi) p.set("enablejsapi", "1");
  if (maal.video) {
    if (maal.list) p.set("list", maal.list);
    return `https://www.youtube-nocookie.com/embed/${maal.video}?${p}`;
  }
  p.set("list", maal.list);
  return `https://www.youtube-nocookie.com/embed/videoseries?${p}`;
}

// ----------------------------------------------------------------------------
//  Lytteeksempler: tittelen på et yt-mål slås opp blant artistenes egne
//  eksempler. Delt av spilleren (explore-apne), editoren og oversiktskortet,
//  som hver hadde sin egen kopi av løkka.
// ----------------------------------------------------------------------------

// «Hound Dog (Elvis Presley)», eller null når videoen ikke er noens
// lytteeksempel (kalleren velger reserven selv).
export function lytteeksempelNavn(videoId, artister) {
  if (!videoId) return null;
  for (const a of artister || []) {
    const eks = (a?.musicExamples || []).find((x) => ytMaal(x?.url || "")?.video === videoId);
    if (eks) return `${eks.label || "Lytteeksempel"} (${a.name})`;
  }
  return null;
}

// ----------------------------------------------------------------------------
//  Oversiktskortet (v5.36): hver kjøreplan åpner og slutter med et kort som
//  viser hva planen inneholder, gruppert etter kategori (brukerkrav: ikke i
//  planens rekkefølge). Kortene er VIRTUELLE: de lagres ikke i planen, men
//  legges på av avspilleren. Posisjonene er derfor 0 = oversikt, 1..n =
//  planens stopp og n+1 = oppsummering, og ?stopp=<k> i URL-en betyr det
//  samme. (Fram til v5.35 var ?stopp 1-basert over stoppene alene, så
//  «stopp=1» peker fortsatt på første stopp.)
// ----------------------------------------------------------------------------

// Hvor i avspillingen posisjon `i` er, for en plan med `antall` stopp.
// Posisjonen klemmes i [0, antall+1], samme «ingen rundgang»-regel som før.
export function planPosisjon(i, antall) {
  const n = Math.max(0, Math.trunc(Number(antall) || 0));
  const pos = klampStopp(i, n + 2);
  if (pos === 0) return { pos, oversikt: "start" };
  if (pos === n + 1) return { pos, oversikt: "slutt" };
  return { pos, stopp: pos - 1 };
}

// Teksten på telleren i verktøylinja.
export function tellerTekst(i, antall) {
  const p = planPosisjon(i, antall);
  if (p.oversikt === "start") return "Oversikt";
  if (p.oversikt === "slutt") return "Oppsummering";
  return `${p.stopp + 1}/${antall}`;
}

export const OVERSIKT_KATEGORIER = [
  { id: "artister", navn: "Artister" },
  { id: "lytteeksempler", navn: "Lytteeksempler" },
  { id: "sjangre", navn: "Sjangre" },
  { id: "tiaar", navn: "Tiår" },
  { id: "teknologi", navn: "Teknologi" },
  { id: "instrumenter", navn: "Instrumenter" },
  { id: "oversikter", navn: "Oversikter" },
];

const VISNING_NAVN = {
  tidslinje: "Tidslinjen", sjangerperioder: "Sjangerperiodene",
  himmel: "Sjangerhimmelen", referanser: "Referansene",
  "store-bildet": "Det store bildet", slektstre: "Slektstreet",
  podkaster: "Podkastene",
};
const SIDE_NAVN = { omHistorie: "Om historie", rotter: "Røtter før 1910" };

// Ett stopp som punkt på oversikten: kategori, tekst, og eventuelt en detalj
// (tidspunkt, samfunn/teknologi) og en egen sorteringsnøkkel. null = utelat:
// en slettet artist eller et slettet kort skal ikke stå som «(ukjent)» på
// lerretet (stoppet selv droppes også stille av avspilleren). Før listene
// har landet, mangler punktet bare til snapshotet tegner kortet på nytt.
function oversiktPunkt(m, oppslag) {
  switch (m.hva) {
    case "artist": {
      const a = (oppslag.artister || []).find((x) => x.id === m.id);
      return a ? { kat: "artister", tekst: a.name } : null;
    }
    case "yt": {
      const fra = formatTid(Number(m.ekstra) || 0);
      return {
        kat: "lytteeksempler",
        tekst: lytteeksempelNavn(m.id, oppslag.artister) || "Lytteeksempel",
        detalj: fra ? `fra ${fra}` : "",
      };
    }
    case "sjanger": case "undersjanger":
      return { kat: "sjangre", tekst: m.id || "(uten navn)" };
    case "historie":
      return m.id ? { kat: "sjangre", tekst: `Historien om ${m.id}` }
        : { kat: "oversikter", tekst: "Sjangerhistoriene" };
    case "kobling": {
      const [fra, til] = String(m.id || "").split("__");
      const navn = (id) => oppslag.nodeNavn?.(id) || id || "?";
      return { kat: "sjangre", tekst: `${navn(fra)} → ${navn(til)}` };
    }
    case "tiår": {
      const tech = m.modus === "tech";
      const aar = Number(m.id);
      return {
        kat: "tiaar", tekst: `${m.id}-tallet`, detalj: tech ? "teknologi" : "samfunn",
        // Tiårene i tidsrekkefølge, samfunn før teknologi innenfor samme tiår.
        sort: (Number.isFinite(aar) ? aar : 9999) * 2 + (tech ? 1 : 0),
      };
    }
    case "tech": {
      const t = (oppslag.tech || []).find((x) => x.id === m.id);
      return t ? { kat: "teknologi", tekst: t.name } : null;
    }
    case "teknologi":
      return { kat: "teknologi", tekst: m.id ? `Teknologi: ${m.id}` : "Teknologioversikten" };
    case "instrument":
      return { kat: "instrumenter", tekst: m.id || "Instrumentene" };
    case "varmekart":
      return { kat: "oversikter", tekst: m.id ? `Varmekartet: ${m.id}` : "Varmekartet" };
    case "side":
      return { kat: "oversikter", tekst: SIDE_NAVN[m.id] || "Slik bruker du appen" };
    default:
      return { kat: "oversikter", tekst: VISNING_NAVN[m.hva] || m.hva };
  }
}

// Planens stopp gruppert for oversiktskortet. `oppslag` gir navnene:
// { artister, tech, nodeNavn(id) }. Hvert mål står én gang (samme kort i
// samme modus to ganger i planen er ett punkt), og `stopp` er indeksen til
// FØRSTE forekomst i planen, så et klikk kan hoppe dit. Innenfor en kategori
// sorteres alfabetisk (tiårene i tidsrekkefølge). Tomme kategorier utelates.
export function planOversikt(stopp, oppslag = {}) {
  const grupper = new Map(OVERSIKT_KATEGORIER.map((k) => [k.id, []]));
  const sett = new Set();
  (Array.isArray(stopp) ? stopp : []).forEach((s, i) => {
    const m = parseVisVerdi(s?.vis);
    if (!m) return;
    // Tiårets samfunnsvisning har to skrivemåter (uten modus og «society»).
    const modus = m.hva === "tiår" ? (m.modus === "tech" ? "tech" : "") : (m.modus || "");
    const nokkel = [m.hva, m.id || "", modus, m.ekstra || ""].join(":");
    if (sett.has(nokkel)) return;
    const p = oversiktPunkt(m, oppslag);
    if (!p) return;
    sett.add(nokkel);
    grupper.get(p.kat).push({ tekst: p.tekst, detalj: p.detalj || "", stopp: i, sort: p.sort });
  });
  return OVERSIKT_KATEGORIER
    .map((k) => ({
      ...k,
      punkter: grupper.get(k.id)
        .sort((a, b) => (a.sort != null && b.sort != null
          ? a.sort - b.sort
          : a.tekst.localeCompare(b.tekst, "nb")))
        .map(({ sort: _s, ...rest }) => rest),
    }))
    .filter((k) => k.punkter.length);
}

// ----------------------------------------------------------------------------
//  «Legg til her» (v5.37, brukerkrav 2026-09-18): en innskytelse midt i
//  fremvisningen, søkt opp som avstikker, settes inn i kjøreplanen der man
//  står. Kjernen er ren og testbar; lagringen bor i plan-meny.js og knappen
//  i verktøylinja (presentasjon.js).
// ----------------------------------------------------------------------------

// Plassen i planens stoppliste et nytt stopp skal inn på, sett fra posisjon
// `pos`: rett etter gjeldende stopp, først i planen fra oversikten, og sist
// fra oppsummeringen. Den nye posisjonen i avspillingen blir indeks + 1.
export function innsettingsIndeks(pos, antall) {
  const n = Math.max(0, Math.trunc(Number(antall) || 0));
  return Math.min(planPosisjon(pos, n).pos, n);
}

// Planene med `stopp` satt inn i planen `planId` på plass `indeks` (klemmes
// til lista). Nye objekter, inndata røres ikke, så avspillerens egen kopi og
// state-snapshotet aldri endres i det stille. Kaster når planen er borte.
export function medStoppSattInn(planer, planId, indeks, stopp) {
  const plan = planer?.[planId];
  if (!plan) throw new Error("Kjøreplanen finnes ikke lenger.");
  const i = Math.min(Math.max(0, Math.trunc(Number(indeks) || 0)), plan.stopp.length);
  return {
    ...planer,
    [planId]: { ...plan, stopp: [...plan.stopp.slice(0, i), stopp, ...plan.stopp.slice(i)] },
  };
}

// ----------------------------------------------------------------------------
//  Samleøktas lagring (v5.43, audit v5.42 funn 1 og 3). Økta skriver ikke for
//  hvert kort, og den skriver aldri en egen kopi av planen. Den husker bare
//  sine HANDLINGER som planen ennå ikke viser:
//    { t: "legg", vis }          nytt stopp sist
//    { t: "erstatt", fra, til }  siste stopp med målet `fra` blir `til`
//                                (erstatningsregelen: åpning, så valg)
//    { t: "fjern", vis }         siste stopp med målet `vis` fjernes (Angre)
//  Hver skriving er den FERSKE planen i state med handlingene lagt oppå, så
//  redigeringer og tillegg gjort andre steder står. Skrivingen stempler
//  planen med øktas merke (plan.samle[øktId] = løpenummer). Firestores lokale
//  visning er alltid «serveren + det som er i kø», så merket i state sier
//  nøyaktig hvilke av øktas skrivinger planen inneholder: også på en ny side
//  (skrivinger som forsvant med forrige side) og etter at en avvist skriving
//  er rullet tilbake. Det den ikke inneholder, sendes på nytt.
// ----------------------------------------------------------------------------

function sisteMed(liste, vis) {
  for (let i = liste.length - 1; i >= 0; i--) if (liste[i].vis === vis) return i;
  return -1;
}

// Handlingene lagt oppå en stoppliste. Ny liste; inndata røres ikke. En
// handling som peker på et stopp som ikke finnes lenger (fjernet i editoren
// imens), gjør det nærmeste: erstatt legger til, fjern gjør ingenting.
export function brukSamleOps(stopp, ops) {
  const ut = (stopp || []).map((s) => ({ ...s }));
  for (const op of ops || []) {
    if (op.t === "legg") ut.push({ vis: op.vis });
    else if (op.t === "erstatt") {
      const i = sisteMed(ut, op.fra);
      if (i >= 0) ut[i] = { vis: op.til };
      else ut.push({ vis: op.til });
    } else if (op.t === "fjern") {
      const i = sisteMed(ut, op.vis);
      if (i >= 0) ut.splice(i, 1);
    }
  }
  return ut;
}

// Vasker handlinger lest tilbake fra sessionStorage.
export function normaliserSamleOps(raa) {
  const ok = (v) => typeof v === "string" && v.length > 0;
  return (Array.isArray(raa) ? raa : []).filter((op) => op && (
    (op.t === "legg" && ok(op.vis)) || (op.t === "fjern" && ok(op.vis))
    || (op.t === "erstatt" && ok(op.fra) && ok(op.til))
  )).map((op) => (op.t === "erstatt" ? { t: op.t, fra: op.fra, til: op.til } : { t: op.t, vis: op.vis }));
}

// Hvor langt planen har kommet med øktas skrivinger (løpenummeret i merket),
// 0 når planen ikke har økta i merket (eller ikke finnes).
export function samleMerke(plan, øktId) {
  const n = plan?.samle?.[øktId];
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Skrivingene planen ikke viser, eldste først: ikke speilet ennå, avvist og
// rullet tilbake, eller tapt med forrige side.
export function samleVentende(sendt, merke) {
  return (sendt || []).filter((b) => b.n > merke);
}

// ----------------------------------------------------------------------------
//  Hurtigtaster (v5.38, brukerens utvalg 2026-09-18). Tastekartet er rene
//  funksjoner, så testene kan låse det: tastetrykk + situasjon inn,
//  handlingens navn ut (eller null). Vaktene bor HER, så ingen tast kan
//  slippe gjennom mens læreren skriver i et felt eller holder en
//  modifikator (Ctrl/Cmd/Alt tilhører nettleseren og operativsystemet).
// ----------------------------------------------------------------------------

// Visningsmodus. `plan`: en kjøreplan spilles; `iSkrivefelt`: fokus står i
// et felt der tastene er tekst.
// `video`: lytteeksempelet ligger øverst (mellomrom og K spiller og pauser,
// så læreren ikke må klikke i videoen; audit v5.42 funn 10).
export function presTast(e, { plan = false, iSkrivefelt = false, video = false } = {}) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = String(e.key || "");
  // Presentasjonsklikkernes blataster tas alltid, også fra et skrivefelt.
  if (plan && k === "PageDown") return "neste";
  if (plan && k === "PageUp") return "forrige";
  if (iSkrivefelt) return null;
  if (plan) {
    if (k === "ArrowRight") return "neste";
    if (k === "ArrowLeft") return "forrige";
    if (k === "Home") return "oversikt";
    if (k === "End") return "oppsummering";
  }
  if (k === "1" || k === "2" || k === "3") return `nivaa${k}`;
  // Av/på-tastene skal ikke blinke fram og tilbake når de holdes inne.
  if (e.repeat) return null;
  if (plan && (k === "t" || k === "T")) return "tilStoppet";
  if (plan && k === "+") return "leggTil";
  if (k === "f" || k === "F") return "fullskjerm";
  if (k === "a" || k === "A") return "skala";
  // «.» er det mange presentasjonsklikkere sender fra svart-skjerm-knappen.
  if (k === "b" || k === "B" || k === ".") return "svart";
  if (k === "?") return "hjelp";
  if (video && (k === " " || k === "k" || k === "K")) return "spill";
  return null;
}

// Samleøkta (planleggingsmodus): + legger kortet øverst til, Ctrl/Cmd+Z
// angrer siste stopp. Utenfor skrivefelt: der er begge tekstens egne.
export function samleTast(e, { iSkrivefelt = false } = {}) {
  // Ingen gjentakelse, heller ikke for Angre: en holdt Cmd+Z fjernet 10–30
  // stopp på et halvt sekund (audit v5.42 funn 27).
  if (!e || e.altKey || iSkrivefelt || e.repeat) return null;
  const k = String(e.key || "");
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (k === "z" || k === "Z")) return "angre";
  if (e.ctrlKey || e.metaKey) return null;
  if (k === "+") return "leggTil";
  return null;
}

// Oversikten tasten ? viser i visningsmodus. `plan`: gruppa vises bare når
// en kjøreplan spilles; `laerer`: raden vises bare i lærerøkter.
export const PRES_TASTER = [
  { gruppe: "Kjøreplan", plan: true, rader: [
    { taster: ["→", "PageDown"], hva: "Neste stopp" },
    { taster: ["←", "PageUp"], hva: "Forrige stopp" },
    { taster: ["Home"], hva: "Til oversikten" },
    { taster: ["End"], hva: "Til oppsummeringen" },
    { taster: ["T"], hva: "Tilbake til stoppet etter en avstikker" },
    { taster: ["+"], hva: "Legg kortet du viser inn i kjøreplanen her", laerer: true },
  ] },
  { gruppe: "Visning", rader: [
    { taster: ["1", "2", "3"], hva: "Detaljnivå" },
    { taster: ["A"], hva: "Tekststørrelse: A, A+, A++" },
    { taster: ["F"], hva: "Fullskjerm av og på" },
    { taster: ["B", "."], hva: "Svart skjerm, samme tast tilbake" },
    { taster: ["Mellomrom", "K"], hva: "Spill av eller pause lytteeksempelet" },
  ] },
  { gruppe: "Ellers", rader: [
    { taster: ["/", "Ctrl/Cmd+K"], hva: "Søk" },
    { taster: ["Esc"], hva: "Lukk øverste kort" },
    { taster: ["?"], hva: "Vis eller skjul hurtigtastene" },
  ] },
];


// ----------------------------------------------------------------------------
//  Artistkortets lerret (v5.40, brukerens oppsett 2026-09-19): hvor hver
//  seksjon står når kortet vises. «topp» = innflytelseslinja over hele
//  bredden; «hoyre» = bildet (med levetiden under) og de beslektede
//  artistene under det; «venstre» = resten, i rekkefølge. Ukjente (nye)
//  seksjoner havner i tekstspalta, der de gjør minst skade. DOM-flyttingen
//  bor i js/pres-artist.js.
// ----------------------------------------------------------------------------
export function artistPlassering(sekt) {
  if (sekt === "stripe") return "topp";
  if (sekt === "bilde" || sekt === "beslektede") return "hoyre";
  return "venstre";
}
