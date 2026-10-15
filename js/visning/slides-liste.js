// ============================================================================
//  SLIDE-LISTA — det som er lest, uten Firebase (v7.06)
// ----------------------------------------------------------------------------
//  Selve lista over lærerens slides, lastestatus og lyttere. Ren modul uten
//  nettverk, så stopp-etiketter, søk og kortene kan lese den (og Node-testene
//  importere dem) uten å dra med Firebase. slides.js fyller den når en lærer
//  er innlogget; for alle andre står den tom og «ikke lastet».
// ============================================================================

let liste = [];
let lastet = false;
let feil = "";
const lyttere = new Set();

export const slider = () => liste;
export const slidesLastet = () => lastet;
export const slidesFeil = () => feil;
export const finnSlide = (id) => liste.find((s) => s.id === id) || null;

// Varsles når lista, lastingen eller feilen endrer seg. Returnerer avmelding.
export function onSlidesEndret(fn) {
  lyttere.add(fn);
  return () => lyttere.delete(fn);
}

// Settes av slides.js (og av testene). Tom liste og lastet: false ved utlogging.
export function settSlides({ liste: ny = [], lastet: l = false, feil: f = "" } = {}) {
  liste = Array.isArray(ny) ? ny : [];
  lastet = !!l;
  feil = String(f || "");
  lyttere.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
}
