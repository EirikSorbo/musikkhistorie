// ============================================================================
//  DELT ÅPNER + ?vis=-RUTER (v5.22)
// ----------------------------------------------------------------------------
//  apneMaal er DET ENE stedet som kjenner inngangen til hver innholdstype.
//  Søket (explore-search.js), ?vis=-lenkene (ruteren under) og senere
//  kjøreplanen bruker samme dør — parallelle switcher har drevet fra
//  hverandre før (jf. audit v5.19 funn 1, 5 og 26).
//
//  Ruteren er snapshot-drevet, som applyPendingDeepLink i landing.js: målet
//  huskes til datagrunnlaget dets har landet, og åpnes så ÉN gang. Ingen
//  frister, ingen polling — sidene kaller provVisMaal fra snapshot-hookene.
// ============================================================================

import { opts, getState, onMainGenreClick, sjangerOpts } from "./explore-context.js?v=5.58";
import { showSubsjangerInfo } from "./ui.js?v=5.58";
import { showEdgeInfo } from "./genealogy.js?v=5.58";
import { openTechDetail, openTeknologi } from "./explore-tech.js?v=5.58";
import { openDecade } from "./explore-decade.js?v=5.58";
import { openRotter, openOmHistorie, openHistorier, openAppGuide, openStoreBildet, openSjangerhimmel } from "./explore-innhold.js?v=5.58";
import { openInstrumenter, openPodkaster } from "./explore-instrument.js?v=5.58";
import { openVarmekart } from "./explore-varmekart.js?v=5.58";
import { openSjangerperioder } from "./explore-sjangerperioder.js?v=5.58";
import { openTidslinje } from "./explore-tidslinje.js?v=5.58";
import { openReferanser } from "./explore-referanser.js?v=5.58";
import { isGenreModelReady, onGenreModelChanged } from "./genre-model.js?v=5.58";
import { parseVisVerdi } from "./vis-lenke.js?v=5.58";
import { ytWatchUrl, lytteeksempelNavn } from "./presentasjon-modell.js?v=5.58";
import { apneYtSpiller } from "./yt-spiller.js?v=5.58";

// Tittel for et yt-stopp: let etter lytteeksempelet blant artistene, så
// spilleren kan vise «Hotel California (Eagles)» i stedet for «Avspilling».
// Oppslaget er delt med kjøreplan-editoren og oversiktskortet.
function ytTittel(videoId, s) {
  return lytteeksempelNavn(videoId, s.artists) || "Lytteeksempel";
}

// Åpner ett mål: { hva, id?, modus? }. Kortene åpnes OPPÅ det som alt står
// åpent (modaler stables), så ← fører tilbake dit man kom fra.
export function apneMaal(apne) {
  if (!apne) return;
  const s = getState();
  switch (apne.hva) {
    case "artist": {
      const a = (s.artists || []).find((x) => x.id === apne.id);
      if (a && opts.onArtistClick) opts.onArtistClick(a);
      return;
    }
    case "sjanger": return onMainGenreClick(apne.id);
    case "undersjanger": {
      showSubsjangerInfo(apne.id, sjangerOpts());
      return;
    }
    case "historie": return openHistorier(apne.id);
    case "tech": {
      const t = (s.techItems || []).find((x) => x.id === apne.id);
      if (t) openTechDetail(t);
      return;
    }
    case "tiår": return openDecade(apne.id, apne.modus);
    // Et lytteeksempel (v5.28): spill i den innebygde spilleren. Tittelen
    // slås opp i artistenes egne eksempler når de har landet — best effort.
    // Fjerde ledd er starttidspunktet i sekunder (v5.29).
    case "yt": {
      const start = Number(apne.ekstra) || null;
      apneYtSpiller(ytWatchUrl(apne.id, apne.modus, start), ytTittel(apne.id, s), { start });
      return;
    }
    case "side":
      if (apne.id === "rotter") return openRotter();
      if (apne.id === "omHistorie") return openOmHistorie();
      return openAppGuide();
    case "instrument": return openInstrumenter(apne.id);
    case "varmekart": return openVarmekart(apne.id);
    case "kobling": {
      const [fra, til] = String(apne.id).split("__");
      showEdgeInfo(fra, til, sjangerOpts());
      return;
    }
    case "podkaster": case "podkast": return openPodkaster();
    case "tidslinje": return openTidslinje();
    case "sjangerperioder": return openSjangerperioder();
    case "himmel": return openSjangerhimmel();
    case "referanser": return openReferanser();
    case "store-bildet": return openStoreBildet();
    case "teknologi": return openTeknologi(apne.id || "");
    // Slektstreet er en egen side; siden vi står på gir handleren (forsiden
    // og lærersiden navigerer, tre-siden gir ingen — vi ER der).
    case "slektstre": return void opts.onSlektstre?.();
  }
}

// Hva et mål trenger før det kan åpnes. «vent» = prøv igjen ved neste
// snapshot; «finnes-ikke» = data har landet og målet er borte (slettet kort,
// gammel lenke) — da droppes det med en stille advarsel i konsollen.
function klarFor(apne, s) {
  switch (apne.hva) {
    case "artist":
      if ((s.artists || []).some((x) => x.id === apne.id)) return "klar";
      return s.artistsLoaded ? "finnes-ikke" : "vent";
    case "tech":
      // techLoaded (v5.35) skiller «ikke landet ennå» fra «kortet er slettet».
      if ((s.techItems || []).some((x) => x.id === apne.id)) return "klar";
      return s.techLoaded ? "finnes-ikke" : "vent";
    case "sjanger": case "slektstre":
      return isGenreModelReady() ? "klar" : "vent";
    // Koblingskortet viser koblingsteksten (egen samling) og sjangrene i
    // begge ender; tidslinja og himmelen tegnes av artistene. Uten å vente på
    // dem åpnet en delt lenke et tomt kort som ble stående (audit v5.42 funn 18).
    case "kobling":
      return isGenreModelReady() && s.edgeDescsLoaded && s.genreDescsLoaded ? "klar" : "vent";
    case "himmel": case "tidslinje":
      return isGenreModelReady() && s.artistsLoaded ? "klar" : "vent";
    case "undersjanger": case "historie":
      // Teksten bor i genreDescriptions og familien i treet: vent på begge,
      // så kortet ikke åpnes med «mangler»-tekst som straks byttes ut.
      return s.genreDescsLoaded && isGenreModelReady() ? "klar" : "vent";
    case "tiår":
      // Teknologifanen tegner innovasjonskortene i tiåret: vent på dem også.
      return Object.keys(s.decadeDescs || {}).length && (apne.modus !== "tech" || s.techLoaded) ? "klar" : "vent";
    case "teknologi":
      return s.techLoaded ? "klar" : "vent";
    case "side": case "sjangerperioder": case "referanser": case "store-bildet":
      return s.contentLoaded ? "klar" : "vent";
    case "varmekart":
      // Med metasjanger som id trengs også treet (gruppene bygges av det).
      return s.contentLoaded && (!apne.id || isGenreModelReady()) ? "klar" : "vent";
    case "instrument":
      return s.contentLoaded && s.artistsLoaded ? "klar" : "vent";
    default:
      return "klar";   // podkaster: modalen tegnes på nytt når episodene lander
  }
}

let ventendeVis = null;

// Åpne et mål så snart datagrunnlaget dets har landet — brukes av ?vis=-
// lenkene og av kjøreplanens stopp (presentasjon.js). Et nytt mål erstatter
// et som fortsatt venter: det siste ønsket gjelder.
export function apneVisNaarKlart(maal) {
  if (!maal) return;
  ventendeVis = maal;
  provVisMaal();
}

// Leses ÉN gang ved oppstart (forsiden). try/catch: URL-API-et kan i teorien
// kastes av en misdannet query, og en dyp lenke skal aldri velte sidelasten.
export function lesVisFraUrl() {
  let verdi = null;
  try { verdi = new URLSearchParams(window.location.search).get("vis"); } catch (e) {}
  apneVisNaarKlart(parseVisVerdi(verdi || ""));
}

// Kalles fra snapshot-hookene. No-op når ingenting venter.
export function provVisMaal() {
  if (!ventendeVis) return;
  const status = klarFor(ventendeVis, getState());
  if (status === "vent") return;
  const maal = ventendeVis;
  ventendeVis = null;
  if (status === "klar") apneMaal(maal);
  else console.warn("Dyp lenke peker på noe som ikke finnes lenger:", maal);
}

// Sjangertreet lander som egen hendelse (genre-model), ikke som et av sidens
// snapshot-hooks — sjanger-/tre-mål trenger dette dyttet.
if (typeof document !== "undefined") onGenreModelChanged(() => provVisMaal());
