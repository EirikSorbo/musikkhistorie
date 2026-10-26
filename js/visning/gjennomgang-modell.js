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
//  Referansen (v7.16, brukerbestilling 2026-10-26): én plan i gruppen kan
//  merkes som referanse (feltet referanse), for eksempel alt læreren vil ha
//  med om soul. Da måler oversikten de andre planene mot referansens kort i
//  stedet for mot alt i appen (en bryter gir det gamle), og det timene viste
//  utenom referansen, står for seg. Referansen teller aldri som gått gjennom.
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

// Gruppens referanse som [id, plan], eller null. Er flere merket (to grupper
// slått sammen), gjelder den eldste, til læreren velger på nytt.
export function referanseFor(planer, gruppe) {
  const kandidater = Object.entries(planer || {})
    .filter(([, p]) => p?.gruppe === gruppe && p.referanse === true)
    .sort(([ia, a], [ib, b]) => String(a.laget || "").localeCompare(String(b.laget || "")) || ia.localeCompare(ib));
  return kandidater[0] || null;
}

// Planene delt i grupper: { grupper: [{ navn, referanse, planer: [[id, plan]] }],
// uten }. Gruppene står etter nyeste plan (som lista ellers), planene nyeste
// først, med referansen øverst.
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
  const grupper = [...kart.entries()].map(([navn, rader]) => {
    const ref = referanseFor(planer, navn)?.[0] || null;
    return { navn, referanse: ref, planer: ref ? [...rader.filter(([id]) => id === ref), ...rader.filter(([id]) => id !== ref)] : rader };
  });
  return { grupper, uten };
}

// Gruppenavnene i bruk, alfabetisk (forslagene i navnefeltene).
export function gruppeNavn(planer) {
  return [...new Set(Object.values(planer || {}).map((p) => p?.gruppe).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "nb"));
}

// «3 timer, 1 kjøreplan og referansen»: en time er en plan med dato.
export function planTelling(rader) {
  const ref = rader.filter(([, p]) => p.referanse).length;
  const timer = rader.filter(([, p]) => p.dato && !p.referanse).length;
  const andre = rader.length - timer - ref;
  const deler = [];
  if (timer) deler.push(`${timer} ${timer === 1 ? "time" : "timer"}`);
  if (andre) deler.push(`${andre} ${andre === 1 ? "kjøreplan" : "kjøreplaner"}`);
  if (ref) deler.push("referansen");
  if (!deler.length) return "ingen planer";
  return deler.length > 1 ? `${deler.slice(0, -1).join(", ")} og ${deler[deler.length - 1]}` : deler[0];
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
//   mot      "referanse" (standard): mot gruppens referanse når den finnes;
//            "alt": mot alt i appen
// → { planer: [{ id, tittel, dato }], referanse: { id, tittel } | null,
//   mot: "referanse" | "alt" (det som faktisk gjelder), typer: [{ type,
//   poster }], utenom: [{ type, poster }], ukjente }. Hver post er { type,
//   nokkel, tittel, sti, apne, vistI, lyttetI, prio, sentral, status: "vist" |
//   "lyttet" | "ikke" }; prio er null for typer uten grad. utenom er det
//   timene viste som ikke står i referansen, og ukjente antallet stopp i
//   referansen som ikke kan telles (borte, skjult, eller en visning uten kort
//   som tidslinjen).
export function beregnGjennomgang({ planer = {}, gruppe = "", indeks = [], artister = [], mot = "referanse" } = {}) {
  const ref = referanseFor(planer, gruppe);
  const iGruppen = Object.entries(planer)
    .filter(([id, p]) => p?.gruppe === gruppe && id !== ref?.[0])
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
  const sortert = (type, poster) => poster.sort(type === "artist" || type === "lytteeksempel" ? etterGrad : navn);
  const ut = {
    planer: iGruppen.map(([id, p]) => ({ id, tittel: p.tittel, dato: p.dato || "" })),
    referanse: ref ? { id: ref[0], tittel: ref[1].tittel } : null,
    mot: ref && mot !== "alt" ? "referanse" : "alt",
    utenom: [],
    ukjente: 0,
  };
  if (ut.mot === "alt") {
    ut.typer = GJ_TYPER.map((type) => ({ type, poster: sortert(type, typer.get(type)) })).filter((t) => t.poster.length);
    return ut;
  }
  // Mot referansen: bare kortene i den. Et lytteeksempel utenfor YouTube har
  // artistens nøkkel og hører ikke med (artisten står der selv).
  const refStopp = (ref[1].stopp || []).map((s) => s?.vis);
  const refNokler = new Set(refStopp.map(dekningsNokkel).filter(Boolean));
  const iRef = (p) => refNokler.has(p.nokkel) && (p.type !== "lytteeksempel" || p.apne?.hva === "yt");
  const funnet = new Set();
  ut.typer = GJ_TYPER.map((type) => {
    const poster = typer.get(type).filter(iRef);
    poster.forEach((p) => funnet.add(p.nokkel));
    return { type, poster: sortert(type, poster) };
  }).filter((t) => t.poster.length);
  ut.utenom = GJ_TYPER.map((type) => ({ type, poster: sortert(type, typer.get(type).filter((p) => !iRef(p) && p.vistI.length)) }))
    .filter((t) => t.poster.length);
  ut.ukjente = refStopp.filter((vis) => !dekningsNokkel(vis)).length + [...refNokler].filter((k) => !funnet.has(k)).length;
  return ut;
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
  // Utenom referansen: alt der er vist, så bare grad, sentral og type gjelder.
  const utenom = (res?.utenom || [])
    .filter((t) => type === "alt" || t.type === type)
    .map((t) => ({ type: t.type, poster: t.poster.filter((p) => medGrad(p) && sentralOk(p)) }))
    .filter((t) => t.poster.length);
  return {
    typer,
    valgt,
    utenom,
    totalt: typer.reduce((s, t) => s + t.totalt, 0),
    gjennomgatt: typer.reduce((s, t) => s + t.gjennomgatt, 0),
  };
}
