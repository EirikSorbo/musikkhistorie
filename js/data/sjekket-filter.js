// ============================================================================
//  SJEKKET-FILTRENE — studentenes utgave av de delte samlingene (v6.89)
// ----------------------------------------------------------------------------
//  Rene funksjoner: tar en samling slik den kom fra Firestore og sjekkene
//  (config/teacherChecks), og gir samlingen uten det som ikke er sjekket.
//  shared-data.js bruker dem når regelen i js/felles/sjekket.js er på.
//
//  Teksten tas bort, ikke strukturen: en sjanger uten sjekket beskrivelse
//  beholder årstallene (tidslinja, sjangerperiodene) og står i treet, men
//  beskrivelsen, punktene, lytteforslagene og kildene er borte. Et tiår
//  mister bare den usjekkede av de to tekstene.
// ============================================================================

import { GENEALOGY } from "../sjangre/genre-model.js";
import { plateselskapIdForSide } from "../felles/plateselskaper.js";

const lik = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const har = (liste, navn) => Array.isArray(liste) && liste.some((x) => lik(x, navn));

// Innholdet i et nivå (meta/main/sub). Årstallene, epoken og «usikre» er
// struktur og blir stående.
const TEKSTFELT = ["description", "punkter", "lytt", "kilder"];
function utenTekst(nivaa) {
  const ut = { ...nivaa };
  for (const f of TEKSTFELT) delete ut[f];
  return ut;
}

// Sjekken for treets sjangre lagres med nodens etikett (l), mens beskrivelsen
// kan ligge under det fulle navnet (f). Begge leder til samme node.
function sjangerSjekket(navn, sjekker) {
  if (har(sjekker.genres, navn)) return true;
  const node = GENEALOGY.find((n) => lik(n.l, navn) || lik(n.f, navn));
  return !!node && har(sjekker.genres, node.l);
}

export function filtrerGenreDescs(descs, sjekker = {}) {
  const ut = {};
  for (const [navn, d] of Object.entries(descs || {})) {
    if (!d || typeof d !== "object") { ut[navn] = d; continue; }
    const kopi = { ...d };
    if (kopi.main && !sjangerSjekket(navn, sjekker)) kopi.main = utenTekst(kopi.main);
    if (kopi.sub && !har(sjekker.subgenres, navn)) kopi.sub = utenTekst(kopi.sub);
    // Historien ER metasjangerens innhold, så meta-nivået og historien deler sjekk.
    const meta = har(sjekker.metaGenres, navn);
    if (kopi.meta && !meta) kopi.meta = utenTekst(kopi.meta);
    if (!meta) delete kopi.story;
    ut[navn] = kopi;
  }
  return ut;
}

export function filtrerEdgeDescs(map, sjekker = {}) {
  return Object.fromEntries(Object.entries(map || {}).filter(([key]) => har(sjekker.edges, key)));
}

export function filtrerTech(items, sjekker = {}) {
  const ider = new Set(sjekker.tech || []);
  return (items || []).filter((t) => ider.has(t.id));
}

export function filtrerDecades(map, sjekker = {}) {
  const ut = {};
  for (const [id, d] of Object.entries(map || {})) {
    if (!d || typeof d !== "object") { ut[id] = d; continue; }
    const samfunn = har(sjekker.decades, id);
    const teknologi = har(sjekker.decadesTech, id);
    const kopi = { ...d };
    if (!samfunn) delete kopi.society;
    if (!teknologi) delete kopi.tech;
    // Kildene er felles for de to tekstene og følger med så lenge én av dem står.
    if (!samfunn && !teknologi) delete kopi.kilder;
    ut[id] = kopi;
  }
  return ut;
}

// Sidene i content som er pensuminnhold, og sjekken hver av dem følger.
// Resten av content (sjangertreet, varmekartet, synligheten, kjøreplanene,
// referanselista, skriveveiledningen) er utenfor regelen. Bruksveiledningen
// (appGuide) er unntatt fra v6.95 (brukervalg 2026-10-13): avhukingen av
// delene styrer den alene (js/felles/guide-deler.js).
const SIDER = ["rotter", "omHistorie"];
export function sideSjekk(id) {
  const s = String(id || "");
  if (SIDER.includes(s) || s.startsWith("instrument-")) return { kategori: "pages", id: s };
  // Bare dokument-id-en (v7.12): lista bygges av de samme dokumentene, så den
  // finnes ikke ennå når rådataene filtreres.
  const selskapId = plateselskapIdForSide(s);
  if (selskapId) return { kategori: "plateselskaper", id: selskapId };
  return null;
}

export function filtrerContent(content, sjekker = {}) {
  const ut = {};
  for (const [id, d] of Object.entries(content || {})) {
    const sjekk = sideSjekk(id);
    if (sjekk && !(sjekker[sjekk.kategori] || []).includes(sjekk.id)) continue;
    ut[id] = d;
  }
  return ut;
}

// ---------------------------------------------------------------------------
//  Sjekk som faller ved import (v6.89, brukervalg 2026-10-13)
// ---------------------------------------------------------------------------
//  En import som endrer en tekst, gjør sjekken av den ugyldig: teksten er ny
//  og ikke lest. Funksjonen sammenlikner fila med dataene slik de er nå (før
//  skrivingen) og gir { kategori: Set(id) } for sjekkene som skal bort. Bare
//  feltene fila faktisk fyller teller, fordi fletting aldri tømmer et felt.
//  Lærerens egne redigeringer i appen lar sjekken stå.
const tom = (v) => v === undefined || v === null || v === ""
  || (Array.isArray(v) && !v.length);
const ulik = (a, b) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
const endret = (nytt, gammelt, felt) => felt.some((f) => !tom(nytt?.[f]) && ulik(nytt[f], gammelt?.[f]));
const TECH_UTENOM = new Set(["id", "status", "createdAt", "updatedAt", "proposedBy", "ownerUid"]);

export function sjekkerEndretAvImport(fil = {}, naa = {}) {
  const ut = {};
  const legg = (kategori, id) => { (ut[kategori] ||= new Set()).add(id); };

  for (const [id, d] of Object.entries(fil.decades || {})) {
    const g = naa.decadeDescs?.[id];
    if (endret(d, g, ["society"])) legg("decades", id);
    if (endret(d, g, ["tech"])) legg("decadesTech", id);
    if (endret(d, g, ["kilder"])) { legg("decades", id); legg("decadesTech", id); }
  }

  for (const [navn, d] of Object.entries(fil.genreDescriptions || {})) {
    if (!d || typeof d !== "object") continue;
    const g = naa.genreDescs?.[navn] || {};
    if (d.main && endret(d.main, g.main, TEKSTFELT)) {
      legg("genres", navn);
      const node = GENEALOGY.find((n) => lik(n.l, navn) || lik(n.f, navn));
      if (node) legg("genres", node.l);
    }
    if (d.sub && endret(d.sub, g.sub, TEKSTFELT)) legg("subgenres", navn);
    if ((d.meta && endret(d.meta, g.meta, TEKSTFELT)) || (d.story && endret(d.story, g.story, ["body"]))) {
      legg("metaGenres", navn);
    }
  }

  for (const [key, d] of Object.entries(fil.edgeDescriptions || {})) {
    if (endret(d, naa.edgeDescs?.[key], ["description", "kilder"])) legg("edges", key);
  }

  for (const [id, d] of Object.entries(fil.pages || {})) {
    const sjekk = sideSjekk(id);
    if (sjekk && endret(d, naa.content?.[id], ["body", "kilder", "fakta"])) legg(sjekk.kategori, sjekk.id);
  }

  for (const t of fil.tech || []) {
    const g = (naa.techItems || []).find((x) => x.name === t?.name);
    if (g && endret(t, g, Object.keys(t).filter((k) => !TECH_UTENOM.has(k)))) legg("tech", g.id);
  }
  return ut;
}

// Sjekkene uten dem som skal bort: { kategori: ny liste } for kategoriene som
// faktisk endres, og antallet som fjernes. Navnene sammenliknes uten hensyn
// til store og små bokstaver, som sjekkene ellers.
export function sjekkerUten(gjeldende = {}, fjern = {}) {
  const data = {};
  let antall = 0;
  for (const [kategori, ider] of Object.entries(fjern)) {
    const bort = [...ider].map((x) => String(x).toLowerCase());
    const liste = Array.isArray(gjeldende[kategori]) ? gjeldende[kategori] : [];
    const ny = liste.filter((x) => !bort.includes(String(x).toLowerCase()));
    if (ny.length !== liste.length) { data[kategori] = ny; antall += liste.length - ny.length; }
  }
  return { data, antall };
}
