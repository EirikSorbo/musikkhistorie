// ============================================================================
//  RETTING AV KILDER FRA REFERANSER (v7.35)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-11-17: læreren skal kunne rette og slette kildene
//  direkte fra Referanser, uten å åpne hvert kort. En rad i Referanser er
//  «den samme kilden» brukt på ett eller flere kort (samme kategori og samme
//  lenke, eller samme tekst når lenke mangler: kildeRadNokkel i kilder.js).
//  Rettingen gjelder alle kortene raden står på, og de frittstående
//  referansene (content/referanser) når raden også står der.
//
//  Kildene bor på seks steder, og hvert sted er ett dokument:
//    artist   artists/<id>.kilder
//    decade   decades/<id>.kilder
//    genre    genreDescriptions/<navn>.<meta|main|sub>.kilder
//    tech     tech/<id>.kilder
//    edge     edgeDescriptions/<fra__til>.kilder
//    fri      content/referanser.kilder
//  Endringene blir doc.merge-operasjoner til runMigrationPlan (én atomisk
//  batch). Sjangernivået skrives som et nestet felt, og merge rører ikke de
//  andre feltene på nivået.
//
//  Ren modul uten DOM og Firebase, så den testes i Node.
// ============================================================================
import { kildeRadNokkel } from "./kilder.js";

const SAMLING = { artist: "artists", decade: "decades", genre: "genreDescriptions", tech: "tech", edge: "edgeDescriptions", fri: "content" };

// Stedene raden er brukt: kortene (opphav) og de frittstående referansene.
export function kildeSteder(rad) {
  const ut = (rad?.opphav || []).filter((o) => o && SAMLING[o.type] && o.id != null);
  if (rad?.frittstaende) ut.push({ type: "fri", id: "referanser", navn: "Frittstående referanser" });
  return ut;
}

// Kildelista slik den ligger på stedet nå.
export function kildeListeFor(state, sted) {
  const s = state || {};
  switch (sted.type) {
    case "artist": return (s.artists || []).find((a) => a.id === sted.id)?.kilder;
    case "decade": return s.decadeDescs?.[sted.id]?.kilder;
    case "genre": return s.genreDescs?.[sted.id]?.[sted.niva]?.kilder;
    case "tech": return (s.techItems || []).find((t) => t.id === sted.id)?.kilder;
    case "edge": return s.edgeDescs?.[sted.id]?.kilder;
    case "fri": return s.content?.referanser?.kilder;
    default: return undefined;
  }
}

// Hører kilden til raden?
export function erSammeKilde(k, rad) {
  const n = kildeRadNokkel(k);
  return !!n && n.kategori === rad.kategori && n.nokkel === rad.nokkel;
}

// Den rettede lista: hver kilde som hører til raden, byttes med `ny` (eller
// fjernes når `ny` er null). Står kilden flere ganger på samme kort, blir den
// stående én gang. null når ingenting er endret.
export function rettKildeliste(liste, rad, ny) {
  if (!Array.isArray(liste)) return null;
  let endret = false;
  let lagtInn = false;
  const ut = [];
  for (const k of liste) {
    if (!erSammeKilde(k, rad)) { ut.push(k); continue; }
    endret = true;
    if (ny && !lagtInn) { ut.push({ ...ny }); lagtInn = true; }
  }
  if (!endret) return null;
  if (ut.length === liste.length && ut.every((k, i) => JSON.stringify(k) === JSON.stringify(liste[i]))) return null;
  return ut;
}

// Operasjonene til runMigrationPlan. `ny` er kilden slik den skal bli
// ({ text, forfatter, year?, url, kategori }), eller null for å slette den.
export function kildeEndringer(state, rad, ny) {
  const ops = [];
  for (const sted of kildeSteder(rad)) {
    const kilder = rettKildeliste(kildeListeFor(state, sted), rad, ny);
    if (!kilder) continue;
    const data = sted.type === "genre" ? { [sted.niva]: { kilder } } : { kilder };
    ops.push({ type: "doc.merge", coll: SAMLING[sted.type], id: String(sted.id), data });
  }
  return ops;
}

// Kilden skjemaet fylles med: den første som hører til raden.
export function forsteKilde(state, rad) {
  for (const sted of kildeSteder(rad)) {
    const k = (kildeListeFor(state, sted) || []).find((x) => erSammeKilde(x, rad));
    if (k) return k;
  }
  return null;
}

// «Muddy Waters», «Blues (sjangerkortet)», «1950-tallet» … til lista over
// hvor kilden er brukt.
const NIVA_NAVN = { meta: "sjangerhistorien", main: "sjangerkortet", sub: "undersjangeren" };
export function stedNavn(sted) {
  if (sted.type === "genre") return `${sted.navn || sted.id} (${NIVA_NAVN[sted.niva] || sted.niva})`;
  if (sted.type === "edge") return `${sted.navn || sted.id} (kobling)`;
  return sted.navn || String(sted.id);
}
