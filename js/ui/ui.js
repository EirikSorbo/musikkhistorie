// ============================================================================
//  UI — rendering (artist- og listevisninger)
// ----------------------------------------------------------------------------
//  Rene funksjoner som bygger og oppdaterer grensesnittet ut fra tilstand.
//  Ingen direkte databasekall her — handlinger sendes inn via `handlers`.
//
//  Lavnivå-hjelpere, tidslinjer, teknologi, dashboard, modaler og diff-tabell
//  bor i egne moduler (ui-helpers/ui-timeline/ui-tech/ui-dashboard/ui-modal/
//  ui-edit), og resten av appen importerer dem direkte derfra. Til og med
//  v6.28 sendte ui.js dem videre, og da dro en modul som bare trengte
//  escapeHtml, med seg alt ui.js importerer.
// ============================================================================

import { isVisible, erTilModerasjon, filterArtists, hasActiveFilters, INSTRUMENT_GROUPS, byInfluenceThenName, instrumenterFor } from "../felles/limits.js";
import { SKJUL_I_STUDENTVISNING } from "../felles/feature-flags.js";
import { punkterHtml } from "../felles/punkter.js";
import { medSelv } from "../felles/linkify.js";
import { showSjangerInfo, clearOpenSjanger } from "../sjangre/genealogy.js";
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, META_GENRE_COLOR, findTreeGenreNode } from "../sjangre/genre-model.js";
import { resolveDesc, missingDesc } from "../sjangre/genre-descriptions.js";
import { safeUrl, escapeHtml, buildKilderList } from "../felles/util.js";
import { artistStripHtml } from "./artist-strip.js";
import {
  linkDesc,
  wireLinks,
  kilderHtml,
  genreTags,
  metaRader,
  musicExampleLabel,
  musicExamplesHtml,
  relatedArtistsHtml, metaMerkeHtml,
  wireRelated,
  keyWorksText,
  artistImage,
  factsLines,
  sekt,
  PRIO_ICONS,
  PRIO_LABELS,
  ICONS,
  renderGenreEditBtn,
  imgTag,
} from "./ui-helpers.js";
import { modalOpen, VISNING_SVG } from "./ui-modal.js";
import { kortUtskriftHtml } from "../utskrift/utskrift-utvalg.js";
import { ytMaal, ytSpillelisteUrl, ytSpillelisteIder } from "../visning/presentasjon-modell.js";
import { wireProposeFoot } from "./ui-edit.js";

// Memoisert på artist-array-referansen: subscribeArtists bytter referanse ved
// hver oppdatering, så samme render-pass treffer cachen i stedet for å bygge
// lista på nytt for hvert klikk/popup.
// Cachen nøkles på BÅDE artistlista og sjangermodellen. Lista bygges av
// GENEALOGY_MAIN_GENRES pluss artistenes tagger, og treet lastes ASYNKRONT:
// med bare artistlista som nøkkel ble den første (tomme-tre-)beregningen
// liggende til artistene tilfeldigvis byttet referanse.
let _mainGenreCache = { ref: null, modell: null, val: null };
export function buildMainGenreList(artists) {
  const modell = GENEALOGY_MAIN_GENRES;
  if (artists === _mainGenreCache.ref && modell === _mainGenreCache.modell) return _mainGenreCache.val;
  const set = new Set(GENEALOGY_MAIN_GENRES);
  for (const a of (artists || [])) {
    if (a.status !== "active") continue;
    for (const s of (a.mainGenre || [])) set.add(s);
    for (const s of (a.subGenre || [])) set.add(s);
  }
  const val = [...set];
  _mainGenreCache = { ref: artists, modell, val };
  return val;
}

// ----------------------------------------------------------------------------
//  Forslagsliste
// ----------------------------------------------------------------------------

// Kompakt klikkbar liste når filtre er aktive
// Samleøktas plussknapp på kortene og radene i artistlistene (v5.53,
// brukerkrav 2026-09-25): i plukk-modus legges en artist til rett fra lista,
// uten å åpne kortet først. Knappen er skjult med CSS til plan-innsamling.js
// setter body.samler-plukk, og klikket fanges der (delegert på document), så
// listene vet ingenting om økta. Bare artister studentene ser kan bli et stopp.
// Visningsikonet (v5.68): samme som i toppmenyen og i modalhodene.
// Utskriftsknappen (kortUtskriftHtml, v5.69) står foran den på radene og bor
// i js/utskrift/utskrift-utvalg.js; på de fulle kortene står den NEDERST, sist i
// fotlinja (brukervalg 2026-09-26, v5.70), i knappeform: «Vis i tidslinje»
// og «Foreslå endring» til venstre, utskriftsknappen alene til høyre
// (margin-left: auto i CSS, v5.73). «Merk ★» er skjult for studentene av
// merking-flagget (v5.72); læreren ser den, til venstre sammen med de andre.
const KORT_PLUSS_SVG = VISNING_SVG;
export function kortPlussHtml(a) {
  if (!a || !isVisible(a)) return "";
  return `<button type="button" class="kort-pluss" data-vis="artist:${escapeHtml(a.id)}" title="Legg til i kjøreplanen" aria-label="Legg ${escapeHtml(a.name)} til i kjøreplanen">${KORT_PLUSS_SVG}</button>`;
}

// «Vis»-knappen på artistkortene i «Finn artister» (v5.81, brukerbestilling
// 2026-09-28): i fri visning åpner den artisten på lerretet, med nivå 1–3 og
// fullskjerm som ellers i visningen. Synlig bare i presentasjonsmodus (CSS);
// klikket går som de andre kortknappene (data-action → handlers.vis).
export function kortVisHtml(a) {
  if (!a || !isVisible(a)) return "";
  return `<button type="button" class="kort-vis" data-action="vis" data-id="${escapeHtml(a.id)}" title="Vis på lerretet" aria-label="Vis ${escapeHtml(a.name)} på lerretet">${VISNING_SVG}</button>`;
}

export function renderResultList(el, artists, onSelect) {
  el.className = "result-list";
  if (!artists.length) {
    el.innerHTML = `<p class="muted empty">Ingen forslag matcher filteret.</p>`;
    return;
  }
  const sorted = [...artists].sort(
    (a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no")
  );
  el.innerHTML = sorted.map((a) => {
    const tags = genreTags(a, { withInstrument: true });
    return `
    <div class="result-row" data-id="${escapeHtml(a.id)}" tabindex="0" role="button">
      <span class="result-name result-link">${escapeHtml(a.name)}</span>
      <span class="result-meta">
        ${tags}
      </span>
      ${kortUtskriftHtml(a)}${kortPlussHtml(a)}
      <span class="result-arrow">›</span>
    </div>`;
  }).join("");
  el.querySelectorAll(".result-row").forEach((div) => {
    const open = () => {
      const artist = artists.find((a) => a.id === div.dataset.id);
      if (artist) onSelect(artist);
    };
    div.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
    // Enter/mellomrom på en av radens knapper er knappens eget klikk, ikke radens.
    div.addEventListener("keydown", (e) => {
      if (e.target.closest("button")) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
}

// Full innholdsvisning for detaljmodal (kun lesemodus)
export function renderArtistDetail(el, artist, lc) {
  const a = artist;
  const examplesHtml = musicExamplesHtml(a);
  const worksHtml = keyWorksText(a.keyWorks);

  // Beslektede artister — oppdagelsessti fra ett kort til nabolaget. Klikk
  // bytter fokus. Delt hjelper (samme blokk brukes på spotlight-/dagens-kort).
  const relatedHtml = relatedArtistsHtml(a, lc);

  // data-sekt-merkene styrer detaljnivået i presentasjonsvisningen (v5.24)
  // og er inerte ellers — se js/visning/presentasjon-modell.js.
  // Tidslinja står først (v6.04), over hele bredden som på lerretet. Sto den
  // under boblene, måtte den vente til bildet var slutt (clear:right), og det
  // ga et tomt felt under boblene. Nå flyter faktalinjene og teksten ved siden
  // av bildet, og stripa står på samme sted på hvert kort.
  el.innerHTML = `
    ${GENEALOGY_META_GENRES.includes(a.metaGenre) ? metaMerkeHtml(a.metaGenre, META_GENRE_COLOR[a.metaGenre]) : ""}
    ${sekt("stripe", artistStripHtml(a))}
    ${sekt("bilde", artistImage(a, true))}
    ${sekt("fakta", factsLines(a))}
    ${sekt("tags", `<div class="meta" style="margin-bottom:12px">${metaRader(a)}</div>`)}
    ${sekt("punkter", punkterHtml(a.punkter, medSelv(lc, { artist: a.id })))}
    ${sekt("beskrivelse", a.description ? `<div class="desc rt">${linkDesc(a.description, medSelv(lc, { artist: a.id }))}</div>` : "")}
    ${sekt("verk", worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : "")}
    ${sekt("lytte", examplesHtml ? `<p class="works"><strong>Lytteeksempler:</strong> ${examplesHtml}</p>` : "")}
    ${sekt("kilder", kilderHtml(a.kilder))}
    ${sekt("beslektede", relatedHtml)}
  `;
  wireLinks(el, lc);
  wireRelated(el, lc);
}

// Siste HTML som faktisk ble malt inn i et gitt element. WeakMap og ikke et
// data-attributt: strengen er flere kB, og den har ingenting i DOM-en å gjøre.
const spotlightPainted = new WeakMap();

// Viser 2 tilfeldig valgte artistkort (kun lesemodus, ingen knapper)
export function renderSpotlightCards(el, artists, lc) {
  el.className = "spotlight-grid";
  if (!artists.length) {
    el.innerHTML = `<p class="muted empty" style="grid-column:1/-1">Ingen forslag matcher filteret ennå.</p>`;
    spotlightPainted.delete(el);
    return;
  }
  const html = artists.map((a) => spotlightCard(a, lc)).join("");
  // Kortet bygges på nytt for hvert Firestore-snapshot (artister, tech, stemmer).
  // Er HTML-en identisk, ville innerHTML-byttet tømt elementet og gjenskapt
  // bildet for å tegne nøyaktig det samme — det er blinket man ser ved sidelast.
  // Dagens artist-kortet traff dette hver gang: tech-lista kommer etter
  // artistene, men bare 13 av 319 beskrivelser nevner et tech-kort, så for 96 %
  // av artistene endret det andre bygget ingenting.
  // firstElementChild-sjekken: andre kodeveier tømmer elementet direkte (bl.a.
  // renderDagensSection når datasettet viser seg å være tomt). Uten den ville
  // en identisk HTML etterpå blitt hoppet over, og kortet blitt stående tomt.
  if (spotlightPainted.get(el) === html && el.firstElementChild) return;
  el.innerHTML = html;
  spotlightPainted.set(el, html);
  wireLinks(el, lc);
  wireRelated(el, lc);
}

function spotlightCard(a, lc) {
  const examplesHtml = musicExamplesHtml(a);
  const worksHtml = keyWorksText(a.keyWorks);
  // Viktighetsgraden er MIDLERTIDIG skjult for studenter (feature-flags.js).
  // Spotlight-kortene vises kun på forsiden, altså aldri for læreren.
  const prio = SKJUL_I_STUDENTVISNING.viktighetsgrad ? 0 : (a.priority || 0);
  const prioTag = prio
    ? `<span class="tag tag-prio prio-${prio}" title="${PRIO_LABELS[prio]}">${PRIO_ICONS[prio]}</span>`
    : "";

  return `
    <article class="card">
      <header class="card-head">
        ${artistImage(a)}
        <h3>${escapeHtml(a.name)}</h3>
        ${factsLines(a)}
        <div class="meta">
          ${prioTag}
          ${instrumenterFor(a).map((i) => `<button class="tag tag-instrument" data-instrument="${escapeHtml(i)}">${escapeHtml(i)}</button>`).join("")}
          ${genreTags(a)}
        </div>
        ${artistStripHtml(a)}
      </header>
      ${a.description ? `<div class="desc rt">${linkDesc(a.description, medSelv(lc, { artist: a.id }))}</div>` : ""}
      ${worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : ""}
      ${examplesHtml ? `<p class="works"><strong>Lytteeksempler:</strong> ${examplesHtml}</p>` : ""}
      ${kilderHtml(a.kilder)}
      ${relatedArtistsHtml(a, lc)}
      <footer class="card-foot">
        <div class="spacer"></div>
        <button class="btn ghost small" data-timeline-id="${escapeHtml(a.id)}">Vis i tidslinje</button>
        <button class="btn ghost small" data-propose-type="artist" data-propose-id="${escapeHtml(a.id)}">Foreslå endring</button>
      </footer>
    </article>
  `;
}

// Én tilfeldig sorteringsnøkkel per artist per sidelast (se renderArtists).
const _sessionOrder = new Map();
function sessionOrderKey(id) {
  if (!_sessionOrder.has(id)) _sessionOrder.set(id, Math.random());
  return _sessionOrder.get(id);
}

// Galleriet (v6.11): bilde, navn, sjanger, undersjanger, instrument og
// levetid, sju i bredden på laptop fra v6.14 (CSS .ar-galleri). Hele kortet
// åpner artistkortet (klikket kobles der lista tegnes: data-galleri-id).
// Flyttet hit fra landing.js i v6.26, delt med lærersidens artistliste.
function levetid(a) {
  if (a.birthYear && a.deathYear) return `${a.birthYear}–${a.deathYear}`;
  if (a.birthYear) return `f. ${a.birthYear}`;
  return "";
}
// `visPrioritet` (v6.31, brukervalg 2026-10-04): prioritetsmerket øverst til
// venstre på bildet, samme ikon og farge som på artistkortet. Samme regel som
// kortene: læreren ser det alltid, studentene bare når bryteren
// «Viktighetsgraden» er på.
export function artistGalleriHtml(liste, { visPrioritet = false } = {}) {
  if (!liste.length) return `<p class="muted empty">Ingen artister matcher søket.</p>`;
  return `<div class="ar-galleri">${liste.map((a) => {
    const url = safeUrl(a.imageUrl);
    const sjangre = (a.mainGenre || []).join(", ");
    const under = (a.subGenre || []).join(", ");
    const prio = visPrioritet ? (a.priority || 0) : 0;
    const prioMerke = prio && PRIO_ICONS[prio]
      ? `<span class="tag tag-prio prio-${prio} ar-prio" title="${PRIO_LABELS[prio]}" aria-label="${PRIO_LABELS[prio]}">${PRIO_ICONS[prio]}</span>`
      : "";
    return `<button type="button" class="ar-kort" data-galleri-id="${escapeHtml(a.id)}">
      <span class="ar-bilde">${prioMerke}${url ? imgTag(url, a.name, 250) : `<span class="ar-initialer" aria-hidden="true">${escapeHtml((a.name || "?").split(/\s+/).map((o) => o[0]).slice(0, 2).join(""))}</span>`}</span>
      <span class="ar-navn">${escapeHtml(a.name)}</span>
      ${sjangre ? `<span class="ar-linje ar-sjanger">${escapeHtml(sjangre)}</span>` : ""}
      ${under ? `<span class="ar-linje">${escapeHtml(under)}</span>` : ""}
      <span class="ar-linje">${escapeHtml([instrumenterFor(a).join(" og "), levetid(a)].filter(Boolean).join(" · "))}</span>
    </button>`;
  }).join("")}</div>`;
}

export function renderArtists(el, state) {
  const { artists, filters, isTeacher, clientId, handlers, viewMode, onSelect } = state;

  let list = [...artists];

  if (filters.showPending) {
    // Hele moderasjonsuniverset: ventende OG returnerte (hos studenten).
    list = list.filter(erTilModerasjon);
  } else if (!filters.showRemoved && filters.priority !== -1) {
    list = list.filter((a) => a.status === "active" && (a.priority || 0) !== -1);
  } else {
    list = list.filter((a) => a.status !== "pending" && a.status !== "returnert");
  }
  if (filters.hideChecked) list = list.filter((a) => !a.teacherChecked);
  // Delt innholdsfilter (sjanger/meta/instrument/undersjanger/prioritet/tiår/søk)
  // — samme funksjon som forsidens filterresultater bruker.
  list = filterArtists(list, filters);

  const hasFilter = hasActiveFilters(filters);
  if (hasFilter) {
    list.sort((a, b) => (a.influenceStart || 0) - (b.influenceStart || 0) || a.name.localeCompare(b.name, "no"));
  } else {
    // Tilfeldig, men STABIL rekkefølge: hver artist får én tilfeldig nøkkel
    // per sidelast. Uten dette stokket lista seg om ved hver sanntids-
    // oppdatering (f.eks. når noen stemte), og kortene hoppet rundt.
    list.sort((a, b) => sessionOrderKey(a.id) - sessionOrderKey(b.id));
  }

  if (list.length === 0) {
    el.className = "artist-list";
    el.innerHTML = `<p class="muted empty">Ingen forslag matcher filteret ennå.</p>`;
    return;
  }

  // Kompakt liste-visning (samme filtrerte/sorterte utvalg som kortene) — brukes
  // når bruker slår på «Vis liste». onSelect åpner detaljmodalen for raden.
  if (viewMode === "list") {
    renderResultList(el, list, onSelect || (() => {}));
    return;
  }
  // Galleriet (lærersiden fra v6.26, som studentenes artistsøk): samme
  // utvalg og rekkefølge, et klikk åpner artistkortet. Lytteren legges én
  // gang på beholderen og slår opp i den lista som sist ble tegnet.
  if (viewMode === "galleri") {
    el.className = "artist-list artist-list--galleri";
    if (el._listOnScroll) {
      document.removeEventListener("scroll", el._listOnScroll, true);
      el._listOnScroll = null;
    }
    el.innerHTML = artistGalleriHtml(list, { visPrioritet: isTeacher || !SKJUL_I_STUDENTVISNING.viktighetsgrad });
    el._galleriListe = list;
    el._galleriVelg = onSelect || (() => {});
    if (!el.dataset.galleriKoblet) {
      el.dataset.galleriKoblet = "1";
      el.addEventListener("click", (e) => {
        const kort = e.target.closest("[data-galleri-id]");
        if (!kort || !el._galleriListe) return;
        const a = el._galleriListe.find((x) => x.id === kort.dataset.galleriId);
        if (a) el._galleriVelg(a);
      });
    }
    return;
  }
  el.className = "artist-list";

  const linkCtx = state.linkCtx;

  // Å bygge HELE lista på én gang sprengte iOS Safaris minne: 256 artister ble
  // 10 000+ DOM-noder i en ~210 000 px høy modal med 256 bilder, og fanen
  // kræsjet FØR modalen rakk å åpne (studenten kom ikke forbi dashbordet). Vi
  // bygger derfor kortene stegvis — første pulje straks, resten når en sentinel
  // nær bunnen scrolles inn i syne. Filtrering/sortering skjer før oppdelingen,
  // så rekkefølgen er uendret.
  el.innerHTML = "";
  // Forrige renders scroll-lytter fjernes MED EN GANG, ikke lat (ved neste
  // scroll). Under en stemmestorm re-rendres lista hvert 400. ms, og en leser
  // som står i ro scroller ikke — de foreldede lytterne (med hver sin kopi av
  // artistlista i closuren) ville hopet seg opp til neste scroll-hendelse.
  if (el._listOnScroll) {
    document.removeEventListener("scroll", el._listOnScroll, true);
    el._listOnScroll = null;
  }
  const BATCH = 30;
  let rendered = 0;

  const appendBatch = () => {
    const slice = list.slice(rendered, rendered + BATCH);
    rendered += slice.length;
    // Bygg og koble puljen i et løst element, så bare de NYE kortene får
    // lyttere (wireLinks/knappe-lyttere på hele el ville doblet dem).
    const frag = document.createElement("div");
    frag.innerHTML = slice.map((a) => artistCard(a, { isTeacher, clientId, linkCtx })).join("");
    wireLinks(frag, linkCtx);
    wireRelated(frag, linkCtx);
    frag.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { action, id } = btn.dataset;
        handlers[action]?.(id);
      });
    });
    while (frag.firstChild) el.appendChild(frag.firstChild);
  };

  appendBatch();

  if (rendered < list.length) {
    const sentinel = document.createElement("div");
    sentinel.className = "list-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    el.appendChild(sentinel);
    // Fangende scroll-lytter på document fanger scroll fra HVILKET som helst
    // element (modalen her, eller sida i lærervisningen) uten at vi må vite
    // hvilket. Vi laster neste pulje når sentinelen nærmer seg viewporten.
    // isConnected-sjekken rydder lytteren når en ny render (el.innerHTML = "")
    // har fjernet denne sentinelen — ellers ville en foreldet lytter fortsatt
    // fyrt mot en detached sentinel.
    const onScroll = () => {
      if (!sentinel.isConnected) { document.removeEventListener("scroll", onScroll, true); if (el._listOnScroll === onScroll) el._listOnScroll = null; return; }
      if (sentinel.getBoundingClientRect().top > window.innerHeight + 800) return;
      appendBatch();
      if (rendered >= list.length) { document.removeEventListener("scroll", onScroll, true); if (el._listOnScroll === onScroll) el._listOnScroll = null; sentinel.remove(); }
      else el.appendChild(sentinel); // hold sentinelen sist
    };
    el._listOnScroll = onScroll;
    document.addEventListener("scroll", onScroll, true);
  }
}

function artistCard(a, { isTeacher, clientId, linkCtx }) {
  const hasUpvoted = (a.votedUpBy || []).includes(clientId);
  const prio = a.priority || 0;
  const removed = prio === -1;
  const pending = a.status === "pending";
  const returned = a.status === "returnert";

  const examplesHtml = musicExamplesHtml(a);

  const checked = a.teacherChecked === true;

  const removedBadge = removed
    ? `<span class="badge removed">Skjult for studenter</span>`
    : "";

  const pendingBadge = pending
    ? `<span class="badge pending">Venter på godkjenning</span>`
    : "";

  const returnedBadge = returned
    ? `<span class="badge returned">Hos studenten</span>`
    : "";

  // Returflyt (kun lærer ser disse kortene i denne tilstanden): koden læreren
  // skal gi studenten + tilbakemeldingen som ble sendt med. Etter ny
  // innsending (pending igjen) vises studentens kommentar tilbake.
  let returInfo = "";
  if (isTeacher && returned) {
    returInfo = `<div class="retur-info">
      <span>Send koden til studenten: <code class="retur-kode-inline">${escapeHtml(a.returKode || "")}</code></span>
      ${a.teacherFeedback ? `<span class="muted">Din tilbakemelding: ${escapeHtml(a.teacherFeedback)}</span>` : ""}
    </div>`;
  } else if (isTeacher && pending && a.studentComment) {
    returInfo = `<div class="retur-info"><span><strong>Kommentar fra studenten:</strong> ${escapeHtml(a.studentComment)}</span></div>`;
  }

  // MIDLERTIDIG skjult for studenter (feature-flags.js). Læreren ser merket
  // som før, ellers kunne ikke prioriteringen kvalitetssikres.
  const visPrio = isTeacher || !SKJUL_I_STUDENTVISNING.viktighetsgrad;
  const prioTag = (prio && visPrio)
    ? `<span class="tag tag-prio prio-${prio}" title="${PRIO_LABELS[prio]}">${PRIO_ICONS[prio]}</span>`
    : "";

  // Studenthandlinger. «Merk ★» (samme stjerne som prioritet «Viktigst») i
  // stedet for «Svært relevant» — small-knapp så den ligger på samme rad som
  // «Foreslå endring». Skjult for studentene mens stemming ikke er i bruk
  // (merking-flagget, v5.72); da får utskriftsknappen plassen på samme
  // linje. Læreren har fått en egen «Notater»-knapp i stedet (v6.58,
  // brukerønske 2026-10-08): merkingen var ment for studentenes stemmegiving,
  // ikke lærerens eget bruk.
  const visMerk = !isTeacher && !SKJUL_I_STUDENTVISNING.merking;
  let voteBtn = "";
  if (visMerk && !removed && !pending && !returned) {
    voteBtn = hasUpvoted
      ? `<button class="btn ghost small" data-action="undoVoteUp" data-id="${escapeHtml(a.id)}">Angre merking</button>`
      : `<button class="btn ghost small accent" data-action="voteUp" data-id="${escapeHtml(a.id)}" title="Merk som svært relevant">Merk ${PRIO_ICONS[3]}</button>`;
  }

  // Delte ikoner fra ui-helpers (samme sett som teacherActionRow/checkBtnHtml,
  // så alle kort-typer viser identiske knapper). Prioritetsikonene er egne:
  // de gjenbruker PRIO_ICONS-pathene, men i knappestørrelse (16px).
  const ICO_CHECK = ICONS.check, ICO_EDIT = ICONS.edit, ICO_BAN = ICONS.ban,
        ICO_TRASH = ICONS.trash, ICO_APPROVE = ICONS.approve, ICO_REJECT = ICONS.reject,
        ICO_NOTAT = ICONS.notat;
  const ICO_STAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  const ICO_ALERT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const ICO_THUMB = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>`;

  // Lærerhandlinger. Ventende og returnerte deler rad: godkjenn/avvis gjelder
  // begge, og «send tilbake» på et alt returnert kort lager ny kode og ny
  // tilbakemelding (til studenten som mistet koden). Notater (v6.58) står
  // med i begge rader — notatet gjelder artisten, ikke statusen den er i.
  let teacherBtns = "";
  if (isTeacher && (pending || returned)) {
    teacherBtns = `
      <div class="teacher-actions">
        <button class="icon-btn primary" data-action="approve" data-id="${escapeHtml(a.id)}" title="Godkjenn">${ICO_APPROVE}</button>
        <button class="icon-btn danger" data-action="reject" data-id="${escapeHtml(a.id)}" title="Avvis">${ICO_REJECT}</button>
        <button class="icon-btn" data-action="sendBack" data-id="${escapeHtml(a.id)}" title="${returned ? "Send tilbake på nytt (ny kode)" : "Send tilbake til studenten"}">${ICONS.retur}</button>
        <button class="icon-btn" data-action="notat" data-id="${escapeHtml(a.id)}" title="Private notater">${ICO_NOTAT}</button>
        <button class="icon-btn" data-action="edit" data-id="${escapeHtml(a.id)}" title="Rediger">${ICO_EDIT}</button>
      </div>`;
  } else if (isTeacher) {
    teacherBtns = `
      <div class="teacher-actions">
        <div class="ta-left">
          <button class="icon-btn ${checked ? "active" : ""}" data-action="toggleCheck" data-id="${escapeHtml(a.id)}" title="${checked ? "Fjern avhuking" : "Merk som sjekket"}">${ICO_CHECK}</button>
        </div>
        <div class="ta-center">
          <button class="icon-btn ${prio === 3 ? "active" : ""}" data-action="priority3" data-id="${escapeHtml(a.id)}" title="Viktigst">${ICO_STAR}</button>
          <button class="icon-btn ${prio === 2 ? "active" : ""}" data-action="priority2" data-id="${escapeHtml(a.id)}" title="Viktig">${ICO_ALERT}</button>
          <button class="icon-btn ${prio === 1 ? "active" : ""}" data-action="priority1" data-id="${escapeHtml(a.id)}" title="Mindre viktig">${ICO_THUMB}</button>
          <button class="icon-btn ${removed ? "active" : ""}" data-action="${removed ? "restore" : "remove"}" data-id="${escapeHtml(a.id)}" title="${removed ? "Gjør synlig" : "Skjul for studenter"}">${ICO_BAN}</button>
        </div>
        <div class="ta-right">
          <button class="icon-btn" data-action="notat" data-id="${escapeHtml(a.id)}" title="Private notater">${ICO_NOTAT}</button>
          <button class="icon-btn" data-action="edit" data-id="${escapeHtml(a.id)}" title="Rediger">${ICO_EDIT}</button>
          <button class="icon-btn danger" data-action="del" data-id="${escapeHtml(a.id)}" title="Slett">${ICO_TRASH}</button>
        </div>
      </div>`;
  }

  const worksHtml = keyWorksText(a.keyWorks);

  return `
    <article class="card ${removed ? "is-removed" : ""} ${pending ? "is-pending" : ""} ${returned ? "is-returned" : ""} ${prio ? "is-prio-" + prio : ""} ${checked ? "is-checked" : ""}">
      <header class="card-head">
        ${artistImage(a)}
        <div>
          <h3>${escapeHtml(a.name)} ${pendingBadge} ${returnedBadge} ${removedBadge}${kortPlussHtml(a)}${kortVisHtml(a)}</h3>
          ${factsLines(a, { showGender: isTeacher })}
          <div class="meta">
            ${prioTag}
            ${instrumenterFor(a).map((i) => `<button class="tag tag-instrument" data-instrument="${escapeHtml(i)}">${escapeHtml(i)}</button>`).join("")}
            ${genreTags(a)}
          </div>
          ${artistStripHtml(a)}
        </div>
      </header>

      ${a.description ? `<div class="desc rt">${linkDesc(a.description, medSelv(linkCtx, { artist: a.id }))}</div>` : ""}
      ${worksHtml ? `<p class="works"><strong>Sentrale verk:</strong> ${worksHtml}</p>` : ""}
      ${examplesHtml ? `<p class="works"><strong>Lytteeksempler:</strong> ${examplesHtml}</p>` : ""}
      ${kilderHtml(a.kilder)}
      ${relatedArtistsHtml(a, linkCtx)}
      ${returInfo}

      <footer class="card-foot">
        ${isTeacher ? `<span class="proposed muted">Foreslått av ${escapeHtml(a.proposedBy || "Anonym")}</span>` : ""}
        ${!isTeacher ? `<button class="btn ghost small" data-action="showTimeline" data-id="${escapeHtml(a.id)}">Vis i tidslinje</button>` : ""}
        ${!isTeacher ? `<button class="btn ghost small" data-propose-type="artist" data-propose-id="${escapeHtml(a.id)}">Foreslå endring</button>` : ""}
        ${voteBtn}
        ${kortUtskriftHtml(a, { knapp: true })}
      </footer>
      ${teacherBtns}
    </article>
  `;
}

// ----------------------------------------------------------------------------
//  Hjelpere for skjema (fyll inn select-bokser fra konfig)
// ----------------------------------------------------------------------------

export function fillSelect(select, values, { placeholder } = {}) {
  const current = select.value;
  select.innerHTML =
    (placeholder ? `<option value="">${placeholder}</option>` : "") +
    values
      .map((v) => {
        const value = typeof v === "object" ? v.value : v;
        const label = typeof v === "object" ? v.label : v;
        return `<option value="${escapeHtml(value)}">${escapeHtml(
          label
        )}</option>`;
      })
      .join("");
  if (current) select.value = current;
}

// Vis undersjanger-beskrivelse i #modal-sjanger (samme popup som sjanger).
// Felles visning av sjangerbeskrivelse på ETT nivå i #modal-sjanger.
// Brukes nå kun av showSubsjangerInfo (sub) — meta-nivået (metasjanger) har
// ikke lenger egne beskrivelser; metasjangere peker til sjangerhistoriene.
// (showSjangerInfo i genealogy.js er egen fordi den også viser tre-relasjoner.)
function showGenreLevelInfo(label, level, opts = {}) {
  // Tegner i samme modal som sjangerkortet. Uten dette ble et content-snapshot
  // til at refreshSjangerInfo tegnet det FORRIGE kortet oppå dette.
  clearOpenSjanger();
  const { root = document, genreDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onShowArtists, onShowPlaylist, onEdit, onPropose, hasPendingEdit } = opts;
  const modal = root.querySelector("#modal-sjanger");
  const mTitle = root.querySelector("#sj-title");
  const mBody = root.querySelector("#sj-body");
  if (!modal || !mTitle || !mBody) return false;

  // «Kopier lenke» (v5.22): sub-nivået er lenkbart (samme rute som søket);
  // meta-nivået har ingen egen lenketype, så knappen skjules der.
  modal.dataset.vis = level === "sub" ? `undersjanger:${label}` : "";

  const resolved = resolveDesc(genreDescs, label, level);
  // Alle skjemafeltene med i currentValues (samme grunn som i showSjangerInfo):
  // bare description ga falsk kilder-diff og kildetap ved godkjenning.
  wireProposeFoot(root, onPropose, hasPendingEdit, "subgenre", label, label, {
    description: resolved.description || "",
    kilder: resolved.kilder || [],
    activeFrom: resolved.activeFrom ?? null,
    activeTo: resolved.activeTo ?? null,
    era: resolved.era || "",
  }, level);

  const btnArea = [
    onShowArtists ? `<button type="button" class="btn ghost small gx-artists-btn">Artister</button>` : "",
    onShowPlaylist ? `<button type="button" class="btn ghost small gx-playlist-btn">Spilleliste</button>` : "",
  ].filter(Boolean).join(" ");

  // Peker navnet på en tre-sjanger? Tilby snarvei til sjanger-beskrivelsen.
  // findTreeGenreNode matcher BÅDE label og fullt navn (f.eks. under-chippen
  // «Outlaw country» → noden «Outlaw»), og snarveien åpner via nodens label,
  // så oppslaget alltid treffer — datadrevet via treet, ingen hardkodet liste.
  const treeNode = findTreeGenreNode(label);
  const seeGenreBtn = treeNode
    ? `<button type="button" class="btn ghost small gx-see-genre-btn" style="margin-bottom:10px">Se «${escapeHtml(treeNode.l)}» (sjanger)</button>`
    : "";

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onMainGenreClick };
  // (Meta-grenen i tittelen er fjernet: funksjonen kalles kun med level="sub".)
  mTitle.textContent = label;
  mBody.innerHTML = `
    ${seeGenreBtn}
    <div class="gx-desc rt">${resolved.description ? linkDesc(resolved.description, medSelv(lc, { genre: label })) : `<span class="gx-missing">${missingDesc(level)}</span>`}</div>
    ${buildKilderList(resolved.kilder, "Kilder")}
    ${btnArea ? `<div style="margin-top:10px;display:flex;gap:8px">${btnArea}</div>` : ""}`;
  wireLinks(mBody, lc);
  const sg = mBody.querySelector(".gx-see-genre-btn");
  if (sg) sg.addEventListener("click", () => showSjangerInfo(treeNode.l, opts));
  const b = mBody.querySelector(".gx-artists-btn");
  if (b) b.addEventListener("click", () => onShowArtists({ label }));
  const bp = mBody.querySelector(".gx-playlist-btn");
  if (bp) bp.addEventListener("click", () => onShowPlaylist({ label, fullName: label, node: { l: label } }));
  renderGenreEditBtn(root, onEdit ? () => onEdit(label, level) : null);
  modalOpen(modal);
  return true;
}

// Frie undersjangre er på «sub»-nivå.
export function showSubsjangerInfo(label, opts = {}) {
  return showGenreLevelInfo(label, "sub", opts);
}

// Bygger en slim artist-liste (result-row) for sjanger-popup og slektstre.
// Returnerer HTML-streng med rader som har data-artist-id for klikk-kobling.
function buildArtistListRows(list) {
  return list.map((a) => {
    const years = a.influenceStart
      ? `${a.influenceStart}${a.influenceEnd ? "–" + a.influenceEnd : ""}`
      : "";
    // Bare navn og år (v5.98, brukerønske 2026-10-01): sjanger og instrument
    // står på artistkortet, ikke i lista.
    return `<div class="result-row" data-artist-id="${escapeHtml(a.id)}" tabindex="0" role="button">
      <span class="result-name result-link">${escapeHtml(a.name)}</span>
      <span class="result-meta">
        ${years ? `<span class="result-work">${years}</span>` : ""}
      </span>
      ${kortUtskriftHtml(a)}${kortPlussHtml(a)}
    </div>`;
  }).join("");
}

// Aktive, synlige artister på et instrument.
export function artistsByInstrument(artists, instrument) {
  return (artists || [])
    .filter((a) => isVisible(a) && instrumenterFor(a).includes(instrument))
    .sort(byInfluenceThenName);
}

// Aktive, synlige artister i en instrumentGRUPPE. Artistkortet bærer det
// PRESISE instrumentet («Trompet», «Banjo»), mens Instrumenter-seksjonen og
// tidslinjene ligger på gruppen («Soloinstrument», «Gitar»). Et rent
// a.instrument === group ville derfor gitt null treff for nettopp de gruppene
// som samler flere instrumenter. Ukjent gruppenavn behandles som seg selv.
export function artistsInInstrumentGroup(artists, group) {
  const medlemmer = INSTRUMENT_GROUPS[group] || [group];
  return (artists || [])
    .filter((a) => isVisible(a) && instrumenterFor(a).some((i) => medlemmer.includes(i)))
    .sort(byInfluenceThenName);
}

// Fyller og åpner artistliste-popupen (#modal-artistliste). Delt av forsiden og slektstre-siden.
// `lenke` (valgfri, v6.07): { tekst, onClick } gir en lenke over lista, f.eks.
// fra artistene på et instrument til instrumentets egen side (K6).
export function openArtistListModal(title, list, onArtistClick, emptyText = "Ingen forslag ennå.", { lenke = null } = {}) {
  document.getElementById("al-title").textContent = `${title} (${list.length})`;
  const body = document.getElementById("al-body");
  const lenkeHtml = lenke ? `<p class="al-lenke-rad"><button type="button" class="dv-lenke" data-al-lenke>${escapeHtml(lenke.tekst)} <span aria-hidden="true">›</span></button></p>` : "";
  if (!list.length) {
    body.innerHTML = lenkeHtml + `<p class="muted empty">${escapeHtml(emptyText)}</p>`;
  } else {
    body.innerHTML = lenkeHtml + `<div class="result-list">${buildArtistListRows(list)}</div>`;
    body.querySelectorAll(".result-row[data-artist-id]").forEach((row) => {
      const open = () => {
        const a = list.find((x) => x.id === row.dataset.artistId);
        if (a) onArtistClick(a);
      };
      row.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
      row.addEventListener("keydown", (e) => {
        if (e.target.closest("button")) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }
  if (lenke) body.querySelector("[data-al-lenke]").onclick = lenke.onClick;
  modalOpen(document.getElementById("modal-artistliste"));
}

// Fyller og åpner spilleliste-popupen (#modal-spilleliste).
export function openPlaylistModal(fullName, node, artists) {
  const { total, html, ider } = buildPlaylistHtml(node, artists);
  document.getElementById("pl-title").textContent = `Spilleliste: ${fullName} (${total})`;
  document.getElementById("pl-body").innerHTML = spillAlleHtml(ider) + html;
  kobleSpillelisteRader();
  modalOpen(document.getElementById("modal-spilleliste"));
}

// Hele raden spiller eksempelet (v6.00), som hele raden åpner artisten i
// artistlista: et klikk utenfor lenka og sjangermerket går til lenka, der
// spilleren fanger det (yt-spiller.js). Koblet én gang på den faste kroppen.
function kobleSpillelisteRader() {
  const body = document.getElementById("pl-body");
  if (!body || body.dataset.radKoblet) return;
  body.dataset.radKoblet = "1";
  body.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
    e.target.closest(".pl-item")?.querySelector("a")?.click();
  });
}

// «Spill alle på YouTube» (v5.74): én lenke som spiller alle videoene i lista
// etter hverandre (watch_videos, se ytSpillelisteUrl). Bare når det er minst to
// YouTube-videoer; søkelenker og andre verter har ingen ID og telles ikke.
// Over 50 videoer blir det flere lenker («del 1», «del 2»).
// Er lista lengre enn YouTube tar i én kø, deles den, og hver knapp sier
// hvilke eksempler den spiller («1–50», «51–62»), ikke «del 1 av 2»
// (v6.21, brukervalg 2026-10-03). Knappene har farge (.pl-alle i CSS), så de
// skiller seg fra lista rett under. Teksten er bare «På YouTube (1–50)» fra
// v6.22 (brukervalg): antallet står allerede i overskriften over.
//
// `rader` er video-ID-en for HVER rad i lista under, med null der raden ikke
// er en YouTube-video. Spennet er radnumrene (v6.23, Fable F5): før talte det
// videoene, så en liste på 63 rader med én lenke til en annen side fikk
// «(51–62)», og studenten så ut til å mangle et eksempel. En video som står
// på to rader, spilles én gang (første rad).
export function spillAlleHtml(rader) {
  const forsteRad = new Map();
  (rader || []).forEach((id, i) => { if (id && !forsteRad.has(id)) forsteRad.set(id, i + 1); });
  const lenker = ytSpillelisteUrl([...forsteRad.keys()]);
  if (!lenker.length || forsteRad.size < 2) return "";
  return `<p class="pl-alle">${lenker.map((url) => {
    const del = ytSpillelisteIder(url) || [];
    const spenn = `${forsteRad.get(del[0])}–${forsteRad.get(del[del.length - 1])}`;
    return `<a class="btn small" href="${escapeHtml(url)}" target="_blank" rel="noopener">På YouTube (${spenn})</a>`;
  }).join(" ")}</p>`;
}

// Bygger HTML for spilleliste-popup: KUN lytteeksempler (musicExamples) — de
// er kuratert lytting med lenke og sjangerknytning. Sentrale verk (keyWorks)
// hører til artistkortet og tas bevisst IKKE med (brukervalg 2026-07-18:
// spilleliste = ren lytteeksempel-liste).
function buildPlaylistHtml(node, artists) {
  const sj = (node.l || "").toLowerCase();

  // Samme regel som artistsInGenre: kun tre-taggene. Per-eksempel-filteret
  // (exOk under) bygde alt på at noden er den PRESISE sjangeren, så artist-
  // matchingen var det eneste som fortsatt leste paraplyen.
  const matchesSj = (a) =>
    [...(a.mainGenre || []), ...(a.subGenre || [])]
      .some((s) => String(s).toLowerCase() === sj);

  const genreArtists = (artists || [])
    .filter((a) => isVisible(a) && matchesSj(a))
    .sort(byInfluenceThenName);

  return playlistRows(genreArtists, sj);
}

// Selve radbyggingen, delt av sjanger-spillelista over og metasjanger-lista
// under. `sj` (små bokstaver) slår på per-eksempel sjangerknytning: et tagget
// eksempel vises KUN i sin egen sjangers spilleliste (streng likhet — «Jazz»-
// noden betyr tidlig jazz, ikke paraplyen), utagget faller tilbake til alle
// artistens sjangre. Uten `sj` tas ALLE eksemplene til artistene med.
function playlistRows(list, sj = null) {
  const exOk = (m) => !sj || !m.genre || String(m.genre).toLowerCase() === sj;

  const seen = new Set();
  const par = [];
  for (const a of list) {
    const nameLow = a.name.toLowerCase();
    for (const m of (a.musicExamples || [])) {
      if (!exOk(m)) continue;
      const key = `${nameLow}|${(m.label || m.url).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      par.push({ a, m });
    }
  }
  return eksempelRader(par, "Ingen musikkeksempler registrert for denne sjangeren ennå.");
}

// Sjangerboblen(e) i en spillelisterad: et tagget eksempel viser sin EGEN
// sjanger (én boble), et utagget artistens sjangre. Delt av spillelistene og
// Tiår-kortets lytteliste (v6.36), så de viser det samme.
export function eksempelSjangerHtml(a, m) {
  return m.genre
    ? `<button class="tag tag-sjanger tag-pl" data-sjanger="${escapeHtml(m.genre)}">${escapeHtml(m.genre)}</button>`
    : genreTags(a, { withSub: false, extraClass: "tag-pl" });
}

// Radene for en liste av { a: artist, m: lytteeksempel } (v6.05: delt av
// sjanger- og metasjanger-listene over og tiårslistene under, U7/K1).
function eksempelRader(par, tomTekst) {
  // Video-ID-en for hver rad (null for rader uten video), til «Spill alle»,
  // som bruker radnumrene i spennet (spillAlleHtml).
  const ider = [];
  const items = par.map(({ a, m }) => {
    const rowTag = eksempelSjangerHtml(a, m);
    const video = ytMaal(m.url)?.video;
    ider.push(video || null);
    const yInfo = musicExampleLabel(m);
    // Tittel og år til venstre, sjanger og artist til høyre (v6.00,
    // brukerønske 2026-10-01), som navn og år i artistlista. Sjangerboblen
    // står foran artistnavnet fra v6.35 (brukervalg 2026-10-04), så navnene
    // står på linje helt til høyre.
    return `<li class="pl-item"><a class="lytt-lenke" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.label || m.url)}${yInfo}</a><span class="pl-hoyre">${rowTag} <span class="pl-artist">${escapeHtml(a.name)}</span></span></li>`;
  });
  if (!items.length) return { total: 0, html: `<p class="muted empty">${escapeHtml(tomTekst)}</p>`, ider: [] };
  return { total: items.length, html: `<ul class="pl-list">${items.join("")}</ul>`, ider };
}

// Lytteeksemplene fra ett tiår (v6.05, K1 og U7): innspillingsåret, eller
// framføringsåret når bare det er satt, innenfor tiåret. Sortert på år, så
// navn. Bare eksempler med lenke, og hvert eksempel én gang.
export function tiarEksempler(artists, decade) {
  const fra = Number(decade), til = fra + 9;
  const seen = new Set();
  const par = [];
  for (const a of (artists || []).filter(isVisible)) {
    for (const m of (a.musicExamples || [])) {
      const y = Number(m.year || m.performanceYear) || null;
      if (!y || y < fra || y > til || !safeUrl(m.url)) continue;
      const key = `${a.name.toLowerCase()}|${(m.label || m.url).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      par.push({ a, m, y });
    }
  }
  return par.sort((x, z) => x.y - z.y || x.a.name.localeCompare(z.a.name, "no"));
}

// Spilleliste-popupen for et ferdig utvalg eksempler (tiårene).
export function openEksemplerSpilleliste(title, par) {
  const { total, html, ider } = eksempelRader(par || [], "Ingen lytteeksempler ennå.");
  document.getElementById("pl-title").textContent = `${title} (${total})`;
  document.getElementById("pl-body").innerHTML = spillAlleHtml(ider) + html;
  kobleSpillelisteRader();
  modalOpen(document.getElementById("modal-spilleliste"));
}

// Antall lytteeksempler i en sjangers spilleliste — SAMME logikk som popupen
// (matchesSj + exOk + dedup), så tallet i oversikten og lista aldri spriker.
export function countPlaylistExamples(artists, label) {
  return buildPlaylistHtml({ l: label }, artists).total;
}

// ----------------------------------------------------------------------------
//  Spilleliste for et VILKÅRLIG utvalg artister (metasjanger-kolonnen i
//  lærerens oversikt). Her er det ingen sjanger å måle eksemplene mot: et
//  eksempel tagget «Soul» hører like fullt hjemme i R&B-familien, så ALLE
//  artistenes eksempler er med. Tellingen går gjennom samme bygger som lista,
//  så tallet i oversikten og popupen aldri kan sprike.
// ----------------------------------------------------------------------------
export function countArtistExamples(list) {
  return playlistRows([...(list || [])].sort(byInfluenceThenName)).total;
}

export function openArtistsPlaylistModal(title, list) {
  const { total, html, ider } = playlistRows([...(list || [])].sort(byInfluenceThenName));
  document.getElementById("pl-title").textContent = `${title} (${total})`;
  document.getElementById("pl-body").innerHTML = spillAlleHtml(ider) + html;
  kobleSpillelisteRader();
  modalOpen(document.getElementById("modal-spilleliste"));
}
