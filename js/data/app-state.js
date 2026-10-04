// ============================================================================
//  APPENS TILSTAND OG SIDENS VALG
// ----------------------------------------------------------------------------
//  initExplore (explore.js) setter `opts` én gang ved oppstart: sidens
//  tilbakekall (onArtistClick, onCheck …) og getState, som gir sidens state
//  (artister, innhold, sjangerbeskrivelser …). Alt som trenger tilstanden,
//  leser den herfra. Modulen importerer ingenting, så YouTube-spilleren,
//  visningen og utskriftsskuffen kan lese tilstanden uten å dra med seg hele
//  Utforsk-laget. (Til og med v6.28 lå dette i explore-context.js.)
//
//  ES-modulers live bindings gjør at `opts` satt via setOpts sees av alle
//  moduler: fang ALDRI opts i en modulnivå-konstant (den er null før setOpts).
//  Les alltid opts.xxx ved kall-tid.
// ============================================================================

export let opts = null;
export function setOpts(o) { opts = o; }

// Før initExplore (opts === null) gir oppslaget et tomt state i stedet for å
// kaste (v5.52): en samleøkt som gjenopprettes ved sidelasting tegnet linja
// sin før lærersiden hadde kalt initExplore, og hele oppstarten døde med
// «Cannot read properties of null (reading 'getState')». Tomt state betyr
// «ikke lastet ennå» for alle leserne (contentLoaded er falsy), og neste
// snapshot tegner på nytt med ekte data.
export function getState() { return opts ? opts.getState() : {}; }
