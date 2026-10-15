// ============================================================================
//  SLIDES — lærerens egne sider i visningen, utenfor pensum (v7.06)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-10-15: en enkel «PowerPoint-slide» med overskrift og
//  markdown-innhold, til generell info som innleveringer og kursinfo. Bare
//  læreren ser dem; de velges i visningsmodus (søket og kjøreplanene).
//
//  Lagring: samlingen notater (bare læreren kan lese og skrive), under nøkkelen
//  slide:<id>, som påminnelsene (paminnelser:<planId>). Reglene for notater
//  trengs ikke endret (tekst, høyst 10 000 tegn), og slidene følger med i
//  sikkerhetskopien. Feltet tekst har overskriften på første linje og
//  innholdet etter en blank linje:
//
//    Innleveringer
//
//    ### Frister
//    - Oppgave 1: **15. nov**
//
//  Ren modul (Node-testbar). Kjøringen (abonnement, lagring) bor i slides.js.
// ============================================================================

export const SLIDE_TITTEL_MAKS = 120;
// Reglene for notater tillater høyst 10 000 tegn i tekst.
export const SLIDE_LAGRING_MAKS = 10000;
export const SLIDE_PREFIKS = "slide:";

export const slideNokkel = (id) => `${SLIDE_PREFIKS}${id}`;
const ID_RE = /^[a-z0-9]{4,24}$/;
export const erSlideId = (id) => ID_RE.test(String(id || ""));
export const erSlideNokkel = (nokkel) => String(nokkel || "").startsWith(SLIDE_PREFIKS) && erSlideId(String(nokkel).slice(SLIDE_PREFIKS.length));
// Et kjøreplan-stopp eller en dyp lenke til en slide («slide:<id>»).
export const erSlideVis = (vis) => erSlideNokkel(vis);

// Ny id: base36-tid + tre tilfeldige tegn. Kolonfri og trygg som dokument-id.
export function nySlideId(naa = Date.now(), tilfeldig = Math.random) {
  const r = Array.from({ length: 3 }, () => Math.floor(tilfeldig() * 36).toString(36)).join("");
  return `s${Math.floor(naa).toString(36)}${r}`;
}

const enLinje = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

// { tittel, innhold } → teksten som lagres. Tom overskrift OG tomt innhold gir
// tom tekst (lagreNotat sletter da dokumentet). Overskriften er én linje.
export function skrivSlide({ tittel = "", innhold = "" } = {}) {
  const t = enLinje(tittel).slice(0, SLIDE_TITTEL_MAKS);
  const i = String(innhold ?? "").replace(/\r\n?/g, "\n").trim();
  if (!t && !i) return "";
  return i ? `${t}\n\n${i}` : t;
}

// Teksten som er lagret → { tittel, innhold }. Første linje er overskriften.
export function lesSlide(tekst) {
  const rå = String(tekst ?? "").replace(/\r\n?/g, "\n");
  const brudd = rå.indexOf("\n");
  if (brudd < 0) return { tittel: enLinje(rå), innhold: "" };
  return { tittel: enLinje(rå.slice(0, brudd)), innhold: rå.slice(brudd + 1).trim() };
}

export const slideForLang = (slide) => skrivSlide(slide).length > SLIDE_LAGRING_MAKS;

// Alle notatene → slidene, sortert på overskrift (norsk rekkefølge).
// [{ id, tittel, innhold, oppdatert }]
export function slideListe(notater) {
  const ut = [];
  for (const [nokkel, n] of Object.entries(notater || {})) {
    if (!erSlideNokkel(nokkel) || !n || typeof n.tekst !== "string") continue;
    const { tittel, innhold } = lesSlide(n.tekst);
    ut.push({ id: nokkel.slice(SLIDE_PREFIKS.length), tittel: tittel || "(uten overskrift)", innhold, oppdatert: n.oppdatert || "" });
  }
  return ut.sort((a, b) => a.tittel.localeCompare(b.tittel, "no") || a.id.localeCompare(b.id));
}
