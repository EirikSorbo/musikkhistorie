// ============================================================================
//  DELT DATAROT — alle sider abonnerer på de delte samlingene herfra
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
//  Lærersidens egne samlinger (pendingEdits) holdes utenfor. Sjekkene
//  (config/teacherChecks) leses fra v6.89 også på studentflatene, for regelen
//  «Bare sjekket innhold» (js/felles/sjekket.js): da er genreDescs, edgeDescs,
//  techItems, content og decadeDescs i state studentenes utgave, uten det
//  usjekkede (js/data/sjekket-filter.js). Rådataene står i `raa` her, og
//  utgaven regnes ut på nytt ved hvert snapshot og hver gang regelen eller
//  sjekkene endres («pensum:synlighet»). Lærersiden (laererside) får alltid
//  rådataene og leser sjekkene selv.
// ============================================================================

import {
  subscribeArtists,
  subscribeGenreDescs,
  subscribeEdgeDescs,
  subscribeTech,
  subscribeContent,
  subscribeDecades,
  subscribePodcasts,
  subscribeTeacherChecks,
} from "./store.js";
import { applyGenealogyDoc } from "../sjangre/genre-model.js";
import { brukSynlighet } from "../felles/feature-flags.js";
import { sjekketRegelAktiv, sjekkene, brukSjekker, settSjekketLaerer } from "../felles/sjekket.js";
import { filtrerGenreDescs, filtrerEdgeDescs, filtrerTech, filtrerDecades, filtrerContent } from "./sjekket-filter.js";

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
    // true etter første genreDescriptions-snapshot. Sjangerperioder (v5.20)
    // bruker det til å skille «laster fortsatt» fra «samlingen er tom»: uten
    // flagget sto figuren på «Laster …» for alltid i en database uten
    // beskrivelser.
    genreDescsLoaded: false,
    // Koblingsbeskrivelser (strekene i slektstreet), doc-ID «fra__til».
    edgeDescs: {},
    techItems: [],
    content: {},
    // contentLoaded skiller «laster fortsatt» fra «mangler faktisk tekst».
    contentLoaded: false,
    decadeDescs: {},
    podcasts: [],
    // Resten av lastet-flaggene (v5.35, audit-funn 26): lærerens eksport leser
    // ALLE samlingene rett fra state, og vakten foran den må kunne se at hver
    // enkelt har landet, ikke bare artister og content.
    edgeDescsLoaded: false,
    techLoaded: false,
    decadesLoaded: false,
    podcastsLoaded: false,
  };
}

// Kobler alle fem abonnementene inn i `state`. Hver hook er valgfri og kalles
// ETTER at state er oppdatert, så en side kan tegne på nytt uten å måtte kjenne
// datakildene selv.
//
// keepPendingTech: lærersiden skal se innovasjonskort som venter på godkjenning
// (den er stedet de godkjennes), studentflatene skal ikke. laererside (v6.89):
// lærersiden ser også det usjekkede (sjekket.js). Det er de ENESTE tillatte
// forskjellene mellom sidene — alt annet er likt med vilje.
export function subscribeSharedData(state, hooks = {}) {
  const {
    onArtists, onGenreDescs, onEdgeDescs, onTech, onContent, onDecades, onPodcasts,
    keepPendingTech = false,
    laererside = false,
  } = hooks;
  if (laererside) settSjekketLaerer(true);

  // Rådataene fra Firestore. state får studentenes utgave av dem (utled).
  const raa = { genreDescs: {}, edgeDescs: {}, techItems: [], content: {}, decadeDescs: {} };
  const FILTER = {
    genreDescs: filtrerGenreDescs,
    edgeDescs: filtrerEdgeDescs,
    techItems: filtrerTech,
    content: filtrerContent,
    decadeDescs: filtrerDecades,
  };
  const utled = (navn) => {
    state[navn] = sjekketRegelAktiv() ? FILTER[navn](raa[navn], sjekkene()) : raa[navn];
    return state[navn];
  };

  subscribeArtists((artists) => {
    state.artists = artists;
    state.artistsLoaded = true;
    onArtists?.(artists);
  });

  subscribeGenreDescs((descs) => {
    raa.genreDescs = descs;
    state.genreDescsLoaded = true;
    onGenreDescs?.(utled("genreDescs"));
  });

  subscribeEdgeDescs((map) => {
    raa.edgeDescs = map;
    state.edgeDescsLoaded = true;
    onEdgeDescs?.(utled("edgeDescs"));
  });

  subscribeTech((items) => {
    // TILLATliste, ikke nektliste: studentene skal se aktive kort (eldre
    // lærerkort mangler status-felt og teller som aktive). En nektliste mot
    // «pending» ville lekket enhver NY status — «returnert» (v5.13) inkludert.
    raa.techItems = keepPendingTech ? items : items.filter((t) => (t.status || "active") === "active");
    state.techLoaded = true;
    onTech?.(utled("techItems"));
  });

  subscribeContent((c) => {
    // raa settes FØR brukSynlighet: den kan sende «pensum:synlighet», og da
    // regner lytteren under ut alt på nytt fra raa.
    raa.content = c || {};
    state.contentLoaded = true;
    // Sjangertreet bor i content/genealogy og kommer altså inn på DETTE
    // snapshotet — ingen egen lytter, ingen ekstra lesinger. Modellen bygges
    // FØR sidens hook kalles, så alt som tegnes i hooken ser ferskt vokabular.
    applyGenealogyDoc(raa.content.genealogy);
    // Bryterne for hva studentene ser (v6.10, U4): content/synlighet.
    brukSynlighet(raa.content.synlighet);
    onContent?.(utled("content"));
  });

  subscribeDecades((d) => {
    raa.decadeDescs = d || {};
    state.decadesLoaded = true;
    onDecades?.(utled("decadeDescs"));
  });

  // Sjekkene (v6.89). Lærersiden abonnerer selv (teacher.js) og trenger dem
  // ikke her, siden regelen aldri gjelder der.
  if (!laererside) subscribeTeacherChecks(brukSjekker);

  // Regelen slått av eller på, sjekkene endret, eller QA-bryteren i visningen:
  // studentenes utgave regnes ut på nytt og sidene tegner som etter et
  // snapshot. Signaturen holder ukene uten regel fri for omtegninger når en
  // annen bryter endres.
  let sist = null;
  if (typeof document !== "undefined") {
    document.addEventListener("pensum:synlighet", () => {
      const sign = sjekketRegelAktiv() ? JSON.stringify(sjekkene()) : "av";
      if (sign === sist) return;
      const foerste = sist === null;
      sist = sign;
      if (foerste && sign === "av") return;
      if (state.artistsLoaded) onArtists?.(state.artists);
      if (state.genreDescsLoaded) onGenreDescs?.(utled("genreDescs"));
      if (state.edgeDescsLoaded) onEdgeDescs?.(utled("edgeDescs"));
      if (state.techLoaded) onTech?.(utled("techItems"));
      if (state.contentLoaded) onContent?.(utled("content"));
      if (state.decadesLoaded) onDecades?.(utled("decadeDescs"));
    });
  }

  subscribePodcasts((pods) => {
    state.podcasts = pods || [];
    state.podcastsLoaded = true;
    onPodcasts?.(state.podcasts);
  });
}
