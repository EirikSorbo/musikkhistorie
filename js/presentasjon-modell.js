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

// Flatene som styres av detaljnivået, med seksjonene i visningsrekkefølge.
// Navnene vises i tannhjul-panelet. Flater som ikke står her (varmekart,
// tidslinje, sider …) viser alltid alt.
export const FLATER = {
  artist: [
    { id: "bilde", navn: "Bilde" },
    { id: "fakta", navn: "Fakta (år, plateselskap …)" },
    { id: "tags", navn: "Sjangermerker" },
    { id: "stripe", navn: "Innflytelseslinje" },
    { id: "beskrivelse", navn: "Beskrivelse" },
    { id: "verk", navn: "Sentrale verk" },
    { id: "lytte", navn: "Lytteeksempler" },
    { id: "kilder", navn: "Kilder" },
    { id: "beslektede", navn: "Beslektede artister" },
  ],
  sjanger: [
    { id: "stripe", navn: "Varmestripe" },
    { id: "era", navn: "Epoke" },
    { id: "beskrivelse", navn: "Beskrivelse" },
    { id: "lytt", navn: "Hør etter" },
    { id: "relasjoner", navn: "Slektskap (vokste ut av …)" },
    { id: "kilder", navn: "Kilder" },
  ],
  tech: [
    { id: "bilde", navn: "Bilde" },
    { id: "fakta", navn: "Fakta (år, kategori …)" },
    { id: "beskrivelse", navn: "Beskrivelse" },
    { id: "kilder", navn: "Kilder" },
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

// Hva nivå 1 (Overskrift) og 2 (Kjerne) viser. Nivå 3 (Alt) er alle
// seksjonene, så det trenger ingen liste.
export const NIVAA_SEKT = {
  artist: {
    1: ["bilde", "fakta"],
    2: ["bilde", "fakta", "tags", "stripe", "beskrivelse"],
  },
  sjanger: {
    1: ["stripe", "era"],
    2: ["stripe", "era", "beskrivelse", "relasjoner"],
  },
  tech: {
    1: ["bilde", "fakta"],
    2: ["bilde", "fakta", "beskrivelse"],
  },
  tiår: {
    1: ["tidslinje"],
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
// uten kilder» eller «nivå 1, men med beskrivelse»). En flate modellen ikke
// kjenner viser alltid alt; en ukjent seksjon på en kjent flate følger
// nivå 3-regelen (vises bare på Alt) — konservativt, så en ny seksjon aldri
// lekker inn på Overskrift-nivået ved en glipp.
export function erSynlig(flate, sekt, nivaa, unntak) {
  const u = unntak ? unntak[`${flate}.${sekt}`] : undefined;
  if (u === true) return true;
  if (u === false) return false;
  if (!(flate in NIVAA_SEKT)) return true;
  if (Number(nivaa) >= 3) return true;
  return (NIVAA_SEKT[flate][nivaa] || []).includes(sekt);
}

// ----------------------------------------------------------------------------
//  YouTube-parsing for den innebygde spilleren
// ----------------------------------------------------------------------------

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const ID_OK = /^[A-Za-z0-9_-]{6,20}$/;
const LIST_OK = /^[A-Za-z0-9_-]{10,60}$/;

// { video, list } for en YouTube-lenke som KAN bygges inn, ellers null.
// Søkelenker (results?search_query=…, slik slektstreets spor er) har ingen
// video-ID og gir null — de skal åpne i ny fane som før.
export function ytMaal(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const sti = u.pathname;

  if (host === "youtu.be") {
    const id = sti.slice(1).split("/")[0];
    return ID_OK.test(id) ? { video: id, list: lesList(u) } : null;
  }
  if (!YT_HOSTS.has(host)) return null;

  if (sti === "/watch") {
    const id = u.searchParams.get("v") || "";
    if (ID_OK.test(id)) return { video: id, list: lesList(u) };
    return null;
  }
  const m = sti.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{6,20})/);
  if (m && m[2] !== "videoseries") return { video: m[2], list: lesList(u) };
  if (sti === "/playlist") {
    const list = lesList(u);
    return list ? { video: null, list } : null;
  }
  return null;
}

function lesList(u) {
  const list = u.searchParams.get("list") || "";
  return LIST_OK.test(list) ? list : null;
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

// Vasker hele planer-feltet fra Firestore. Dokumentet er offentlig lesbart og
// skrives av editoren, men avspilleren skal aldri knekke på et håndredigert
// eller halvgammelt dokument: ødelagte planer og stopp droppes stille.
export function normaliserPlaner(raa) {
  const ut = {};
  if (!raa || typeof raa !== "object") return ut;
  for (const [id, plan] of Object.entries(raa)) {
    if (!plan || typeof plan !== "object") continue;
    const stopp = (Array.isArray(plan.stopp) ? plan.stopp : []).map(normaliserStopp).filter(Boolean);
    ut[id] = {
      tittel: typeof plan.tittel === "string" && plan.tittel.trim() ? plan.tittel.trim() : "(uten tittel)",
      laget: typeof plan.laget === "string" ? plan.laget : "",
      stopp,
    };
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
// av «Åpne på YouTube»-reserven og av kjøreplan-stopp («yt:<id>[:<liste>]»).
export function ytWatchUrl(video, list) {
  const u = new URL(video ? "https://www.youtube.com/watch" : "https://www.youtube.com/playlist");
  if (video) u.searchParams.set("v", video);
  if (list) u.searchParams.set("list", list);
  return u.href;
}

// Embed-URL for spilleren (privacy-varianten uten sporingscookies før
// avspilling). autoplay er trygt: spilleren åpnes alltid av et klikk.
export function ytEmbedUrl(url) {
  const maal = ytMaal(url);
  if (!maal) return null;
  const p = new URLSearchParams({ autoplay: "1", rel: "0" });
  if (maal.video) {
    if (maal.list) p.set("list", maal.list);
    return `https://www.youtube-nocookie.com/embed/${maal.video}?${p}`;
  }
  p.set("list", maal.list);
  return `https://www.youtube-nocookie.com/embed/videoseries?${p}`;
}
