// ============================================================================
//  STOPP-ETIKETT — menneskelig navn på et kjøreplan-stopp (v5.75)
// ----------------------------------------------------------------------------
//  Delt av Visning-vinduet (lista og editoren) og verktøylinja i
//  presentasjonen («neste: …»). Lå i js/visning.js til v5.74 og ble flyttet
//  hit fordi presentasjon.js også trenger den, og visning.js alt importerer
//  presentasjon.js (en sirkel skal ikke inn i grafen).
//
//  «finnes ikke lenger» settes når målet er borte (slettet artist, omdøpt
//  sjanger: navnebytte-fella fra planen). Alle navnebaserte mål sjekkes mot
//  det åpneren faktisk slår opp i (audit v5.42 funn 8). Mens artistene eller
//  kortene laster, står det «laster …», ikke et falskt varsel. Alt leses ved
//  kall: treet og vokabularet er live bindings.
// ============================================================================

import { getState } from "./explore-context.js?v=5.93";
import { parseVisVerdi } from "./vis-lenke.js?v=5.93";
import { lytteeksempelNavn } from "./presentasjon-modell.js?v=5.93";
import { GENEALOGY, GENEALOGY_META_GENRES, edgeExists } from "./genre-model.js?v=5.93";
import { INSTRUMENT_TIMELINE_GROUPS, isVisible } from "./limits.js?v=5.93";

export const TYPE_NAVN = {
  artist: "Artist", sjanger: "Sjanger", undersjanger: "Undersjanger",
  historie: "Historie", tech: "Innovasjon", "tiår": "Tiår", side: "Side",
  instrument: "Instrument", kobling: "Kobling", tidslinje: "Tidslinje",
  varmekart: "Varmekart", sjangerperioder: "Sjangerperioder",
  himmel: "Sjangerhimmel", referanser: "Referanser",
  "store-bildet": "Det store bildet", podkaster: "Podkaster",
  teknologi: "Teknologi", slektstre: "Slektstre", yt: "Lytteeksempel",
};

export const DOD = "finnes ikke lenger";

// { tekst, navn, feil?, laster? }: tekst er «Artist: Muddy Waters» (lista og
// editoren), navn er «Muddy Waters» alene (verktøylinja). Visninger uten id
// har navn = typen.
export function stoppEtikett(stopp) {
  const m = parseVisVerdi(stopp?.vis);
  if (!m) return { tekst: String(stopp?.vis || ""), navn: String(stopp?.vis || ""), feil: "ugyldig lenke" };
  const type = TYPE_NAVN[m.hva] || m.hva;
  const s = getState();
  const ut = (navn, ekstra = {}) => ({ tekst: navn && navn !== type ? `${type}: ${navn}` : type, navn: navn || type, ...ekstra });
  switch (m.hva) {
    case "artist": {
      const a = (s.artists || []).find((x) => x.id === m.id);
      if (a) return ut(a.name);
      return s.artistsLoaded ? ut(m.id, { feil: DOD }) : ut("laster …", { laster: true });
    }
    case "tech": {
      // Bare aktive kort: avspilleren på forsiden ser ikke ventende eller
      // returnerte kort (lærersidens state har dem med).
      const t = (s.techItems || []).find((x) => x.id === m.id && (x.status || "active") === "active");
      if (t) return ut(t.name);
      return s.techLoaded ? ut(m.id, { feil: DOD }) : ut("laster …", { laster: true });
    }
    // Sjangerkortet åpnes for ALLE noder i treet (også røttene), ikke bare
    // for dem med metasjanger.
    case "sjanger":
      return ut(m.id, GENEALOGY.some((n) => n.l === m.id || n.f === m.id) ? {} : { feil: DOD });
    case "historie":
      if (!m.id) return ut("oversikten");
      return ut(m.id, GENEALOGY_META_GENRES.includes(m.id) ? {} : { feil: DOD });
    case "varmekart":
      if (!m.id) return ut(type);
      return ut(m.id, GENEALOGY_META_GENRES.includes(m.id) ? {} : { feil: DOD });
    case "undersjanger": {
      if (!s.artistsLoaded || !s.genreDescsLoaded) return ut(m.id, { laster: true });
      // Som kortet: bare synlige artister, og uten hensyn til store og små
      // bokstaver.
      const lik = (x) => String(x).toLowerCase() === String(m.id).toLowerCase();
      const kjent = !!s.genreDescs?.[m.id]?.sub
        || (s.artists || []).some((a) => isVisible(a) && (a.subGenre || []).some(lik));
      return ut(m.id, kjent ? {} : { feil: DOD });
    }
    case "kobling": {
      const [fra, til] = String(m.id || "").split("__");
      const nodeNavn = (id) => GENEALOGY.find((n) => n.id === id)?.l || id;
      return ut(`${nodeNavn(fra)} til ${nodeNavn(til)}`, edgeExists(m.id) ? {} : { feil: DOD });
    }
    case "instrument":
      if (!m.id) return ut(type);
      return ut(m.id, INSTRUMENT_TIMELINE_GROUPS.includes(m.id) ? {} : { feil: DOD });
    case "tiår":
      return ut(`${m.id}-tallet (${m.modus === "tech" ? "teknologi" : "samfunn"})`);
    // Lytteeksempel (v5.28): slå opp tittelen blant artistenes egne eksempler.
    case "yt": {
      const tittel = lytteeksempelNavn(m.id, s.artists);
      if (!tittel && !s.artistsLoaded) return ut("laster …", { laster: true });
      return tittel ? ut(tittel) : { tekst: `${type} (YouTube)`, navn: type };
    }
    default:
      return ut(m.id || type);
  }
}

// Stoppene i en plan som ikke kan åpnes nå (målet er borte). Brukes av
// Visning-lista («2 stopp trenger tilsyn») før avspilling (v5.75). Stopp som
// bare venter på data, telles ikke.
export function dodeStopp(plan) {
  return (plan?.stopp || []).filter((s) => stoppEtikett(s).feil).length;
}
