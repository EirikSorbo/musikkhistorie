// ============================================================================
//  LYTT — spillelistene samlet (v6.07, strukturgjennomgangen U7)
// ----------------------------------------------------------------------------
//  «Kontekstualisert lytting» er ett av de tre målene for emnet, men
//  spillelistene lå tre klikk inne (Sjangre → sjanger → Spilleliste). Her står
//  de på ett sted: per metasjanger (appens rekkefølge og farger) og per tiår.
//  Hver rad åpner spilleliste-vinduet, der alt spilles i appens egen spiller
//  og «Spill alle» står øverst.
//
//  Spillelistene fra timene (U1) kommer som en tredje bolk når de finnes.
//  «Sentrale verk» er bevisst IKKE med ennå (brukervalg 2026-10-03).
// ============================================================================
import { escapeHtml, modalOpen, countArtistExamples, openArtistsPlaylistModal, tiarEksempler, openEksemplerSpilleliste } from "./ui.js?v=6.10";
import { DECADES, isVisible } from "./limits.js?v=6.10";
import { META_GENRE_ORDER, META_GENRE_COLOR } from "./genre-model.js?v=6.10";
import { getState } from "./explore-context.js?v=6.10";

// Ekstra bolker (U1: «Fra timene») kan legges inn utenfra uten at denne
// modulen kjenner datakilden. Hver leverandør gir { tittel, rader: [{ navn,
// antall, aapne }] } eller null.
const ekstraBolker = [];
export function leggTilLyttBolk(fn) { ekstraBolker.push(fn); }

export function openLytt() {
  const modal = document.getElementById("modal-lytt");
  if (!modal) return;
  tegnLytt();
  modalOpen(modal);
}

function radHtml(nokkel, navn, antall, farge) {
  return `<button type="button" class="sj-rad lytt-rad" data-lytt="${escapeHtml(nokkel)}"${farge ? ` style="--fam:${escapeHtml(farge)}"` : ""}>
    ${farge ? `<span class="sj-fam-prikk" aria-hidden="true"></span>` : ""}
    <span class="sj-rad-navn">${escapeHtml(navn)}</span><span class="sj-rad-aar">${antall}</span>
  </button>`;
}

function tegnLytt() {
  const body = document.getElementById("lytt-body");
  if (!body) return;
  const s = getState();
  const synlige = (s.artists || []).filter(isVisible);
  const handlinger = new Map();

  const metaRader = META_GENRE_ORDER.map((meta) => {
    const liste = synlige.filter((a) => a.metaGenre === meta);
    return { meta, liste, antall: countArtistExamples(liste) };
  }).filter((x) => x.antall);
  metaRader.forEach((x) => handlinger.set(`meta:${x.meta}`, () => openArtistsPlaylistModal(`Spilleliste: ${x.meta}`, x.liste)));

  const tiarRader = DECADES.map((d) => ({ d, par: tiarEksempler(synlige, d) })).filter((x) => x.par.length);
  tiarRader.forEach((x) => handlinger.set(`tiar:${x.d}`, () => openEksemplerSpilleliste(`Spilleliste: ${x.d}-tallet`, x.par)));

  const ekstra = ekstraBolker.map((fn) => { try { return fn(s); } catch (e) { console.warn(e); return null; } })
    .filter((b) => b && b.rader?.length);
  ekstra.forEach((b, bi) => b.rader.forEach((r, ri) => handlinger.set(`ekstra:${bi}:${ri}`, r.aapne)));

  const bolk = (tittel, rader) => `<section class="sj-familie"><div class="sj-fam-hode"><h3 class="sj-fam-navn">${escapeHtml(tittel)}</h3></div>${rader}</section>`;
  body.innerHTML = metaRader.length || tiarRader.length || ekstra.length
    ? `<div class="sj-familier lytt-bolker">${
        ekstra.map((b, bi) => bolk(b.tittel, b.rader.map((r, ri) => radHtml(`ekstra:${bi}:${ri}`, r.navn, r.antall))).join("")).join("")
      }${bolk("Per metasjanger", metaRader.map((x) => radHtml(`meta:${x.meta}`, x.meta, x.antall, META_GENRE_COLOR[x.meta])).join(""))
      }${bolk("Per tiår", tiarRader.map((x) => radHtml(`tiar:${x.d}`, `${x.d}-tallet`, x.par.length)).join(""))}</div>`
    : `<p class="muted">Ingen lytteeksempler ennå.</p>`;
  body.querySelectorAll("[data-lytt]").forEach((b) =>
    b.addEventListener("click", () => handlinger.get(b.dataset.lytt)?.()));
}
