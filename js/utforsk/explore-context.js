// ============================================================================
//  DELT KJERNE FOR UTFORSK-MODULENE
// ----------------------------------------------------------------------------
//  Limet mellom Utforsk-funksjonene: lenkekonteksten (buildLinkCtx), sjanger-
//  kortets opts (sjangerOpts), sjangerklikket, artistlistene for en sjanger
//  eller et instrument og lærerens knapperad. Da explore.js ble delt opp
//  (v3.54) flyttet den delte kjernen hit, så feature-modulene (varmekart,
//  tidslinje, …) kan importere den.
//
//  Kjernen importerer INGEN Utforsk-feature (fra v6.29). Det den må åpne
//  (tech-kortet, tidslinja, galleriet, instrumentsiden), slår den opp i `nav`
//  ved kall-tid, og explore.js fyller nav idet modulen lastes. Før importerte
//  kjernen featurene direkte, og fordi featurene importerer kjernen, hang 13
//  filer i én importring. Samtidig flyttet tilstanden og sidens opts til
//  app-state.js, meta-gruppehodene til ui-metagruppe.js og oppfriskingen av
//  åpne vinduer (contentChanged, genreDescsChanged) til explore.js.
// ============================================================================
import { modalClose } from "../ui/ui-modal.js";
import { buildMainGenreList, openPlaylistModal, openArtistListModal, artistsByInstrument, showSubsjangerInfo } from "../ui/ui.js";
import { showSjangerInfo } from "../sjangre/genealogy.js";
import { teacherActionRow, wireTeacherRow } from "../ui/ui-helpers.js";
import { INSTRUMENT_GROUPS, INSTRUMENT_TIMELINE_GROUPS, INSTRUMENT_TITLE, artistsInGenre } from "../felles/limits.js";
import { opts, getState } from "../data/app-state.js";

// Funksjonene kjernen og featurene bruker for å åpne hverandre. explore.js
// fyller dem (registrerNavigasjon) idet modulen lastes, altså før noen side har
// rukket å tegne noe. Les nav.xxx ved kall-tid, aldri i en modulnivå-konstant.
export const nav = {};
export function registrerNavigasjon(funksjoner) { Object.assign(nav, funksjoner); }

// Injiserer den delte lærer-knapperaden (Sjekk | Rediger · Slett) i en «extra»-
// beholder i en detaljmodal. Gjør ingenting for studenter (opts.onCheck
// mangler). category/id styrer sjekk-lagringen; onEdit/onDelete kobles kun når
// callbacken finnes (Slett bare for hele enheter, dvs. innovasjonskort).
export function injectTeacherRow(extraEl, { category, id, onEdit = null, onDelete = null }) {
  if (!extraEl) return;
  extraEl.innerHTML = "";
  if (!opts.onCheck) return;
  const checked = (opts.getCheckedState?.()?.[category] || []).includes(id);
  extraEl.innerHTML = teacherActionRow({ checked, edit: !!onEdit, del: !!onDelete });
  wireTeacherRow(extraEl, {
    onCheck: (on) => opts.onCheck(category, id, on),
    onEdit,
    onDelete,
  });
}

export function buildLinkCtx() {
  const s = getState();
  return {
    artists: s.artists,
    techItems: s.techItems,
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: nav.openTechDetail,
    onMainGenreClick,
    isTeacher: !!s.isTeacher,
  };
}

export function sjangerOpts() {
  const s = getState();
  return {
    root: document,
    genreDescs: s.genreDescs,
    // Koblingsbeskrivelsene følger med i SAMME opts-objekt som sjangerkortet,
    // så showEdgeInfo (strekene i slektstreet) kan leses fra enhver side uten
    // at kalleren må sette dem sammen selv. Forsiden manglet dem helt før v4.44.
    edgeDescs: s.edgeDescs,
    artists: s.artists,
    techItems: s.techItems,
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: nav.openTechDetail,
    onMainGenreClick,
    onShowArtists: showArtistsForSjanger,
    onShowPlaylist: showPlaylistForMainGenre,
    // Tidslinjen åpnes OPPÅ sjanger-popupen (modaler stables), fokusert på
    // denne sjangerens seksjon — ← går tilbake til popupen.
    onShowTimeline: ({ label }) => nav.openTidslinje({ genre: label }),
    // Knappen vises bare når sjangeren har en seksjon i tidslinja (Fable F8).
    harTidslinje: nav.tidslinjeHarSjanger,
    // Artistgalleriet (v5.96), oppå sjangerkortet, i appen og på lerretet.
    onShowGallery: ({ label }) => nav.openArtistGalleri(label),
    // «Vis i slektstreet» (v6.08, S8): på slektstresiden sentrerer treet seg
    // på sjangeren (onVisITre fra tre-page.js); på de andre sidene går det til
    // tre.html?fokus=<sjanger>.
    onVisITre: opts.onVisITre
      || (opts.onSlektstre ? (label) => { window.location.href = `tre.html?fokus=${encodeURIComponent(label)}`; } : undefined),
    onEdit: opts.onSubgenreEdit ? (label, level) => {
      modalClose(document.getElementById("modal-sjanger"));
      opts.onSubgenreEdit(label, level);
    } : undefined,
    onPropose: opts.onProposeEdit,
    hasPendingEdit: opts.hasPendingEdit,
    onMainGenreCheck: opts.onMainGenreCheck,
  };
}

export function onMainGenreClick(genre) {
  // Tre-sjangerkortet bygger sjekk-knappen SELV (den overlever da en
  // omtegning), så et ekstra kall her ville gitt to knapper. Faller vi ned på
  // undersjanger-kortet, tegnes det av showGenreLevelInfo, som ikke gjør det —
  // der legges knappen fortsatt på utenfra.
  if (showSjangerInfo(genre, sjangerOpts())) return;
  if (showSubsjangerInfo(genre, sjangerOpts()) && opts.onMainGenreCheck) {
    opts.onMainGenreCheck(genre);
  }
}

export function showPlaylistForMainGenre({ fullName, node }) {
  openPlaylistModal(fullName, node, getState().artists);
}

export function showArtistsForSjanger({ label }) {
  openArtistListModal(label, artistsInGenre(getState().artists, label), opts.onArtistClick, "Ingen forslag i denne sjangeren ennå.");
}

// Med vei til instrumentets egen side når instrumentet hører til en gruppe
// som har en (v6.07, K6): «Saksofon» fører til Soloinstrument, «Banjo» til
// Gitar. «Annet» har ingen side.
export function showArtistsForInstrument(instrument) {
  const gruppe = Object.entries(INSTRUMENT_GROUPS).find(([, liste]) => liste.includes(instrument))?.[0];
  const lenke = gruppe && INSTRUMENT_TIMELINE_GROUPS.includes(gruppe)
    ? { tekst: INSTRUMENT_TITLE[gruppe] || gruppe, onClick: () => nav.openInstrumenter(gruppe) }
    : null;
  openArtistListModal(instrument, artistsByInstrument(getState().artists, instrument), opts.onArtistClick, "Ingen forslag med dette instrumentet ennå.", { lenke });
}
