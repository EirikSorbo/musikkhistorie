// ============================================================================
//  DELT DATAROT
// ----------------------------------------------------------------------------
//  De delte komponentene (sjangerkortet, artistlista, spillelista, innovasjons-
//  kortet, instrumentsidene, slektstreet) leses fra SYV samlinger: artists,
//  genreDescs, edgeDescs, tech, content, decades og podcasts. Før v4.44
//  abonnerte hver side på sitt eget utvalg av dem, hver for seg, og da ga samme
//  komponent ulikt innhold avhengig av hvilken inngang den ble åpnet fra:
//
//    · slektstresiden lastet ikke content, så varmestripa manglet på
//      sjangerkortet der mens den vistes overalt ellers (lappet i v3.98)
//    · forsiden lastet ikke edgeDescs i det hele tatt, så den kunne ikke vise
//      koblingsbeskrivelser selv om den delte kortet som viser dem
//    · slektstresiden bygget sin egen sjangerOpts uten onShowTimeline, så
//      «Tidslinje»-knappen på kortet fantes på forsiden, men ikke i treet
//
//  Her er den ene ruta inn. Alle sider får nøyaktig samme syv samlinger i
//  nøyaktig samme state-form, og en ny side kan ikke lenger gå glipp av én.
//
//  decades og podcasts er med selv om de ser sidespesifikke ut: explore-
//  decade.js gjør `s.decadeDescs[String(d)]` og explore-instrument.js gjør
//  `s.podcasts.length` UTEN vakt, og begge flatene er nåbare fra enhver side
//  som injiserer utforsk-modalene (instrumentlenkene på innovasjonskortene
//  åpner instrumentsiden). Manglet de i state, ville et klikk kastet
//  TypeError i stedet for å vise innhold. Samlingene er dessuten små.
//
//  Kun lærersidens egne samlinger (teacherChecks, pendingEdits) holdes utenfor
//  — de finnes ikke som begrep på studentflatene.
// ============================================================================

import {
  subscribeArtists,
  subscribeGenreDescs,
  subscribeEdgeDescs,
  subscribeTech,
  subscribeContent,
  subscribeDecades,
  subscribePodcasts,
} from "./store.js?v=5.01";
import { applyGenealogyDoc } from "./genre-model.js?v=5.01";

// Feltene hver side må ha i sin `state` for at de delte komponentene skal
// virke. Spres inn i sidens eget state-objekt ved oppstart, så ingen side kan
// glemme et felt og få «undefined» ned i en delt visning.
export function sharedStateDefaults() {
  return {
    artists: [],
    // true etter første artist-snapshot — skiller «laster fortsatt» fra
    // «datasettet er faktisk tomt».
    artistsLoaded: false,
    genreDescs: {},
    // Koblingsbeskrivelser (strekene i slektstreet), doc-ID «fra__til».
    edgeDescs: {},
    techItems: [],
    content: {},
    // contentLoaded skiller «laster fortsatt» fra «mangler faktisk tekst».
    contentLoaded: false,
    decadeDescs: {},
    podcasts: [],
  };
}

// Kobler alle fem abonnementene inn i `state`. Hver hook er valgfri og kalles
// ETTER at state er oppdatert, så en side kan tegne på nytt uten å måtte kjenne
// datakildene selv.
//
// keepPendingTech: lærersiden skal se innovasjonskort som venter på godkjenning
// (den er stedet de godkjennes), studentflatene skal ikke. Dette er den ENESTE
// tillatte forskjellen mellom sidene — alt annet er likt med vilje.
export function subscribeSharedData(state, hooks = {}) {
  const {
    onArtists, onGenreDescs, onEdgeDescs, onTech, onContent, onDecades, onPodcasts,
    keepPendingTech = false,
  } = hooks;

  subscribeArtists((artists) => {
    state.artists = artists;
    state.artistsLoaded = true;
    onArtists?.(artists);
  });

  subscribeGenreDescs((descs) => {
    state.genreDescs = descs;
    onGenreDescs?.(descs);
  });

  subscribeEdgeDescs((map) => {
    state.edgeDescs = map;
    onEdgeDescs?.(map);
  });

  subscribeTech((items) => {
    state.techItems = keepPendingTech ? items : items.filter((t) => t.status !== "pending");
    onTech?.(state.techItems);
  });

  subscribeContent((c) => {
    state.content = c || {};
    state.contentLoaded = true;
    // Sjangertreet bor i content/genealogy og kommer altså inn på DETTE
    // snapshotet — ingen egen lytter, ingen ekstra lesinger. Modellen bygges
    // FØR sidens hook kalles, så alt som tegnes i hooken ser ferskt vokabular.
    applyGenealogyDoc(state.content.genealogy);
    onContent?.(state.content);
  });

  subscribeDecades((d) => {
    state.decadeDescs = d || {};
    onDecades?.(state.decadeDescs);
  });

  subscribePodcasts((pods) => {
    state.podcasts = pods || [];
    onPodcasts?.(state.podcasts);
  });
}
