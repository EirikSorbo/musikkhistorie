// ============================================================================
//  GRUPPENE OG DET SOM ER GÅTT GJENNOM (v7.15), den rene delen
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-10-25: kjøreplanene og timene kan samles i grupper,
//  for eksempel «Klassen høst 2026», og hver gruppe har en oversikt over alt
//  som er vist i planene til sammen, og alt som ikke er det. Valg 2026-10-25:
//    • Høyst én gruppe per plan (feltet gruppe, se normaliserGruppe).
//    • «Alt» er alt søket kan finne og åpne (byggIndeks i js/felles/search.js):
//      artistene, lytteeksemplene, sjangrene, tiårene (samfunn og teknologi),
//      innovasjonene, plateselskapene og resten. Podkastene og
//      artistgalleriene er ikke med; et galleri regnes som sjangeren sin.
//    • En artist der bare et lytteeksempel er spilt, regnes som gått
//      gjennom, men merkes «bare lyttet».
//    • Filter på type og på viktighetsgrad. Bare artistene har grad; et
//      lytteeksempel får den høyeste graden blant artistene som har det.
//      De andre typene påvirkes ikke av graden.
//
//  Ren modul (Node-testbar). Vinduet bor i js/visning/gjennomgang.js.
// ============================================================================

import { parseVisVerdi } from "../felles/vis-lenke.js";
import { ytMaal } from "./presentasjon-modell.js";

// Typene i oversikten, i visningsrekkefølge (typene fra søkeindeksen).
export const GJ_TYPER = [
  "artist", "lytteeksempel", "sjanger", "rot", "undersjanger", "oversikt", "historie",
  "samfunn", "teknologi", "tech", "hendelse", "plateselskap", "instrument", "kobling", "side", "slide",
];
// Innholdssider som ikke er pensum: bruksveiledningen.
const IKKE_PENSUM_SIDER = new Set(["appGuide"]);

const nyest = (p) => String(p?.laget || "");

// Planene delt i grupper: { grupper: [{ navn, planer: [[id, plan]] }], uten }.
// Gruppene står etter nyeste plan (som lista ellers), planene nyeste først.
export function grupperPlaner(planer) {
  const sorter = (a, b) => nyest(b[1]).localeCompare(nyest(a[1])) || a[1].tittel.localeCompare(b[1].tittel, "nb");
  const alle = Object.entries(planer || {}).sort(sorter);
  const kart = new Map();
  const uten = [];
  for (const rad of alle) {
    const g = rad[1].gruppe;
    if (!g) { uten.push(rad); continue; }
    if (!kart.has(g)) kart.set(g, []);
    kart.get(g).push(rad);
  }
  const grupper = [...kart.entries()].map(([navn, rader]) => ({ navn, planer: rader }));
  return { grupper, uten };
}

// Gruppenavnene i bruk, alfabetisk (forslagene i navnefeltene).
export function gruppeNavn(planer) {
  return [...new Set(Object.values(planer || {}).map((p) => p?.gruppe).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "nb"));
}

// «3 timer og 1 kjøreplan»: en time er en plan med dato.
export function planTelling(rader) {
  const timer = rader.filter(([, p]) => p.dato).length;
  const andre = rader.length - timer;
  const deler = [];
  if (timer) deler.push(`${timer} ${timer === 1 ? "time" : "timer"}`);
  if (andre) deler.push(`${andre} ${andre === 1 ? "kjøreplan" : "kjøreplaner"}`);
  return deler.join(" og ") || "ingen planer";
}

// Nøkkelen et stopp regnes under. Samme mål via ulike veier (sjangeren og
// galleriet, undersjanger med store eller små bokstaver, et tiår uten modus)
// gir samme nøkkel. Visninger uten id (tidslinjen, varmekartet) teller ikke.
export function dekningsNokkel(vis) {
  const m = parseVisVerdi(vis);
  if (!m || !m.id) return null;
  switch (m.hva) {
    case "artist": case "tech": case "historie": case "oversikt": case "side":
    case "instrument": case "plateselskap": case "kobling": case "slide": case "yt":
      return `${m.hva}:${m.id}`;
    case "sjanger": case "galleri":
      return `sjanger:${m.id}`;
    case "undersjanger":
      return `undersjanger:${m.id.toLowerCase()}`;
    case "tiår":
      return `tiår:${m.id}:${m.modus === "tech" ? "tech" : "society"}`;
    default:
      return null;
  }
}

// Nøkkelen for et treff i søkeindeksen, på samme form. Et lytteeksempel som
// ikke er på YouTube, åpner artistkortet og regnes som artisten.
export function postNokkel(post) {
  const a = post?.apne || {};
  if (!a.hva || !a.id) return null;
  if (post.type === "undersjanger") return `undersjanger:${String(post.id).toLowerCase()}`;
  if (a.hva === "tiår") return `tiår:${a.id}:${a.modus === "tech" ? "tech" : "society"}`;
  return dekningsNokkel(`${a.hva}:${a.id}`) || `${a.hva}:${a.id}`;
}

const grad = (a) => (Number(a?.priority) > 0 ? Number(a.priority) : 0);

// Alt i søkeindeksen, merket med hvilke planer i gruppen som viste det.
//   planer   normaliserte planer (normaliserPlaner)
//   indeks   byggIndeks(...) over det synlige innholdet
//   artister de synlige artistene (gradene og lytteeksemplene)
// → { planer: [{ id, tittel, dato }], typer: [{ type, poster }] }, der hver
//   post er { type, nokkel, tittel, sti, apne, vistI, lyttetI, prio, sentral,
//   status: "vist" | "lyttet" | "ikke" }. prio er null for typer uten grad.
export function beregnGjennomgang({ planer = {}, gruppe = "", indeks = [], artister = [] } = {}) {
  const iGruppen = Object.entries(planer)
    .filter(([, p]) => p?.gruppe === gruppe)
    .sort(([, a], [, b]) => String(a.dato || a.laget || "").localeCompare(String(b.dato || b.laget || "")));
  const vist = new Map();
  for (const [id, p] of iGruppen) {
    for (const s of p.stopp || []) {
      const k = dekningsNokkel(s?.vis);
      if (!k) continue;
      const l = vist.get(k) || [];
      if (!l.includes(id)) l.push(id);
      vist.set(k, l);
    }
  }
  // Lytteeksemplene per video: artistene, høyeste grad og om noen har det som sentralt.
  const videoer = new Map();
  const artistVideoer = new Map();
  for (const a of artister) {
    for (const m of a?.musicExamples || []) {
      const v = ytMaal(m?.url || "")?.video;
      if (!v) continue;
      const e = videoer.get(v) || { prio: 0, sentral: false };
      e.prio = Math.max(e.prio, grad(a));
      if (m.sentral === true) e.sentral = true;
      videoer.set(v, e);
      const av = artistVideoer.get(a.id) || [];
      if (!av.includes(v)) av.push(v);
      artistVideoer.set(a.id, av);
    }
  }
  const artistKart = new Map(artister.map((a) => [a.id, a]));
  const typer = new Map(GJ_TYPER.map((t) => [t, []]));
  const sett = new Set();
  for (const p of indeks) {
    if (!typer.has(p?.type)) continue;
    if (p.type === "side" && IKKE_PENSUM_SIDER.has(p.id)) continue;
    const nokkel = postNokkel(p);
    if (!nokkel || sett.has(`${p.type}|${nokkel}`)) continue;
    sett.add(`${p.type}|${nokkel}`);
    const post = {
      type: p.type, nokkel, tittel: p.tittel, sti: p.sti || "", apne: p.apne,
      vistI: vist.get(nokkel) || [], lyttetI: [], prio: null, sentral: false,
    };
    if (p.type === "artist") {
      post.prio = grad(artistKart.get(p.id));
      for (const v of artistVideoer.get(p.id) || []) {
        for (const id of vist.get(`yt:${v}`) || []) if (!post.lyttetI.includes(id)) post.lyttetI.push(id);
      }
    } else if (p.type === "lytteeksempel") {
      const e = p.apne.hva === "yt" ? videoer.get(p.apne.id) : null;
      post.prio = e ? e.prio : grad(artistKart.get(p.apne.id));
      post.sentral = !!e?.sentral;
    }
    post.status = post.vistI.length ? "vist" : post.lyttetI.length ? "lyttet" : "ikke";
    typer.get(p.type).push(post);
  }
  const navn = (a, b) => String(a.tittel).localeCompare(String(b.tittel), "nb", { numeric: true });
  const etterGrad = (a, b) => (b.prio || 0) - (a.prio || 0) || navn(a, b);
  return {
    planer: iGruppen.map(([id, p]) => ({ id, tittel: p.tittel, dato: p.dato || "" })),
    typer: GJ_TYPER
      .map((type) => ({ type, poster: typer.get(type).sort(type === "artist" || type === "lytteeksempel" ? etterGrad : navn) }))
      .filter((t) => t.poster.length),
  };
}

// Filtrene i vinduet. status: "gjennomgatt" (vist eller bare lyttet), "ikke"
// eller "alle". nivaa: viktighetsnivået som i appen (3 = bare viktigst, 2 =
// viktig og viktigst, 1 = alle med grad, 0 = alle); uten grad er ute så snart
// et nivå er valgt, som i artistlistene. Tellingene følger grad og sentral,
// ikke status, så fanene viser «12 av 40» uansett hva som vises.
export function filtrerGjennomgang(res, { type = "alt", status = "gjennomgatt", nivaa = 0, bareSentrale = false } = {}) {
  const n = [1, 2, 3].includes(Number(nivaa)) ? Number(nivaa) : 0;
  const medGrad = (p) => !n || p.prio == null || p.prio >= n;
  const sentralOk = (p) => !bareSentrale || p.type !== "lytteeksempel" || p.sentral;
  const statusOk = (p) => status === "alle" || (status === "ikke" ? p.status === "ikke" : p.status !== "ikke");
  const typer = (res?.typer || []).map((t) => {
    const grunnlag = t.poster.filter((p) => medGrad(p) && sentralOk(p));
    return {
      type: t.type,
      totalt: grunnlag.length,
      gjennomgatt: grunnlag.filter((p) => p.status !== "ikke").length,
      poster: grunnlag.filter(statusOk),
    };
  });
  const valgt = type === "alt" ? typer : typer.filter((t) => t.type === type);
  return {
    typer,
    valgt,
    totalt: typer.reduce((s, t) => s + t.totalt, 0),
    gjennomgatt: typer.reduce((s, t) => s + t.gjennomgatt, 0),
  };
}
