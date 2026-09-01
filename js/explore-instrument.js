// ============================================================================
//  INSTRUMENTER — utvikling per instrumentgruppe
// ----------------------------------------------------------------------------
//  Én fane per instrumentgruppe (INSTRUMENT_TIMELINE_GROUPS i limits.js), og for
//  den valgte gruppen: en nyvinnings-tidslinje bygget av innovasjonskortene i
//  `tech` som har `instrument` satt til gruppen, pluss et skriftlig sammendrag.
//  Fanene framfor alle tidslinjene under hverandre — samme grep som
//  sjangerhistoriene, som ble uoversiktlige på samme måte.
//
//  Kortene skrives av STUDENTENE: hver gruppe har «Foreslå nytt kort» (lærer får
//  «Nytt kort» rett inn i sitt eget skjema). Sammendraget bor i `content`-
//  samlingen som instrument-<slug>, samme sted som Om historie og Røtter, og kan
//  foreslås endret av studenter (entityType «instrument»).
//
//  Kortene deles med Teknologi-seksjonen: et instrumentkort ER et
//  innovasjonskort, bare med `instrument` satt. Derfor står «Elektrisk gitar»
//  både under Teknologi og på Gitar-tidslinjen — samme kort, to innganger.
// ============================================================================
import { modalOpen, escapeHtml, openArtistListModal, artistsInInstrumentGroup, renderTechCards } from "./ui.js?v=5.08";
import { buildInstrumentTimeline, instrumentInnovations } from "./ui-timeline.js?v=5.08";
import { INSTRUMENT_TIMELINE_GROUPS, INSTRUMENT_TITLE, instrumentPageId } from "./limits.js?v=5.08";
import { pageFor } from "./story-format.js?v=5.08";
import { renderRichText } from "./rich-text.js?v=5.08";
import { wireLinks, renderPodcastList, wirePlayerCloseGuard, buildKilderList } from "./ui-helpers.js?v=5.08";
import { opts, getState, buildLinkCtx } from "./explore-context.js?v=5.08";
import { openTechDetail } from "./explore-tech.js?v=5.08";

// Kategorien nye instrumentkort får automatisk — instrumentnyvinninger hører
// hjemme under «Instrumenter og lydutstyr», så ingen trenger å velge den selv.
const INSTRUMENT_TECH_CATEGORY = "Instrumenter og lydutstyr";

// Valgt instrument huskes mellom åpninger, som sjangerhistoriene.
let currentGroup = null;

// Podkastene: episodene lastes opp av lærer, så studentene ser bare lista.
// Lærer får inngangen til opplastingsskjemaet her, siden dashbordkortet er borte.
function renderPodkast() {
  const el = document.getElementById("podkast-list");
  const extra = document.getElementById("podkast-extra");
  if (!el) return;
  const s = getState();
  // renderPodcastList lar lista stå urørt når episodene er uendret. Det er
  // med vilje: en episode som spiller skal fortsette å spille når kortet lukkes,
  // og stå der den var — samme episode, samme sted — når det åpnes igjen.
  renderPodcastList(el, s.podcasts, {
    empty: `<p class="muted empty" style="background:#fff">Episodene publiseres fortløpende etter hvert som studentgruppene leverer sine bidrag.</p>`,
  });
  if (extra) {
    extra.innerHTML = opts.onPodkastAdmin
      ? `<button type="button" class="btn ghost small">Rediger episoder</button>` : "";
    extra.querySelector("button")?.addEventListener("click", () => opts.onPodkastAdmin());
  }
}

// Hodetelefoner. Egen SVG framfor ICONS-mappa i ui-helpers: den holder
// lærer-ikonene i 16 px, mens dette er en stor innholdsknapp.
const IKON_PODKAST =
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
  ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M3 18v-6a9 9 0 0118 0v6"/>` +
  `<path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>` +
  `</svg>`;

// Inngangen til podkastene, øverst i utviklingsfanen. Tegnes på nytt ved hver
// visning (ikke bare én gang som chipsene): tallet kommer fra episodelista, og
// den lastes asynkront — en engangsrender ville frosset «(0)».
function renderPodkastInngang() {
  const el = document.getElementById("instr-podkast-inngang");
  if (!el) return;
  const n = getState().podcasts.length;
  el.innerHTML = `<button type="button" class="btn primary instr-podkast-btn">` +
    `${IKON_PODKAST}<span>Hør podkastene${n ? ` (${n})` : ""}</span></button>`;
  el.querySelector("button").addEventListener("click", () => openPodkaster());
}

function renderChips() {
  const chips = document.getElementById("instr-chips");
  if (!chips || chips.dataset.filled) return;
  // Alle knappene har samme blå (brukervalg 2026-09-01) — fargen ligger i CSS,
  // ikke per knapp. Se .instr-chip i styles.css.
  chips.innerHTML = INSTRUMENT_TIMELINE_GROUPS.map((g) =>
    `<button type="button" class="btn ghost small instr-chip" data-instr="${escapeHtml(g)}">${escapeHtml(g)}</button>`
  ).join("");
  chips.querySelectorAll(".instr-chip").forEach((b) =>
    b.addEventListener("click", () => renderGroup(b.dataset.instr)));
  chips.dataset.filled = "1";
}

// Én tidslinje trenger minst to punkter for å gi mening. Med ett kort vises det
// som en lenke i stedet, så det ikke blir usynlig i påvente av nummer to.
function timelineHtml(group, items) {
  const tl = buildInstrumentTimeline(getState().techItems, group);
  if (tl) return tl;
  if (items.length === 1) {
    const t = items[0];
    const naar = t.adoptedLabel || (t.adoptedYear ? String(t.adoptedYear) : "");
    return `<p class="instr-single">Foreløpig ett kort: ` +
      `<button type="button" class="sh-linkbtn" data-instr-tech="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>` +
      `${naar ? ` <span class="muted">(${escapeHtml(naar)})</span>` : ""}. ` +
      `Tidslinjen tegnes når det finnes minst to.</p>`;
  }
  return `<p class="gx-missing">Ingen nyvinninger lagt inn for ${escapeHtml(group)} ennå.</p>`;
}

function renderGroup(group) {
  currentGroup = group;
  const body = document.getElementById("instr-body");
  if (!body) return;

  document.querySelectorAll("#instr-chips .instr-chip").forEach((b) =>
    b.classList.toggle("active", b.dataset.instr === group));

  const s = getState();
  const items = instrumentInnovations(s.techItems, group);
  const pageId = instrumentPageId(group);
  const page = pageFor(pageId, s.content);

  // Rekkefølge: sammendrag → knapper → tidslinje. Teksten er inngangen til
  // instrumentet; tidslinjen står nederst som oppslagsverk.
  body.innerHTML = `
    <div class="instr-sum">
      <div class="instr-sum-head">
        <h3>${escapeHtml(INSTRUMENT_TITLE[group] || `Utviklingen av ${group}`)}</h3>
        <div class="spacer"></div>
        <div class="instr-sum-actions"></div>
      </div>
      <div class="instr-sum-body story-body"></div>
    </div>
    <div class="instr-foot"></div>
    <div class="instr-tl">${timelineHtml(group, items)}</div>`;

  // Sammendraget: teksten bor i Firestore, INGEN reservetekst i koden — mangler
  // den, sies det tydelig ifra (samme regel som resten av innholdet i appen).
  const sum = body.querySelector(".instr-sum-body");
  const lc = buildLinkCtx();
  if (page) {
    // Kildene står under teksten, i samme form som på sjangerkortene.
    sum.innerHTML = renderRichText(page.body, lc) + buildKilderList(page.kilder, "Kilder");
    wireLinks(sum, lc);
  } else {
    // Teksten peker på HVEM som skriver den, ikke bare at den mangler —
    // «podkast» er en lenke til podkastfanen, der gruppene ligger.
    sum.innerHTML = s.contentLoaded
      ? `<p class="instr-sum-hint">Teksten skrives av gruppen som lager ` +
        `<button type="button" class="sh-linkbtn" id="instr-til-podkast">podkast</button>` +
        ` om instrumentets utvikling.</p>`
      : `<p class="gx-missing">Laster innhold …</p>`;
    sum.querySelector("#instr-til-podkast")?.addEventListener("click", () => openPodkaster());
  }

  // Rediger (lærer) eller Foreslå endring (student) på sammendraget.
  const sumActions = body.querySelector(".instr-sum-actions");
  if (opts.onPageEdit) {
    sumActions.innerHTML = `<button type="button" class="btn ghost small">Skriv sammendrag</button>`;
    sumActions.querySelector("button").addEventListener("click", () => opts.onPageEdit(pageId));
  } else if (opts.onProposeEdit) {
    sumActions.innerHTML = `<button type="button" class="btn ghost small">Skriv sammendrag</button>`;
    sumActions.querySelector("button").addEventListener("click", () => opts.onProposeEdit({
      entityType: "instrument",
      entityId: pageId,
      entityName: INSTRUMENT_TITLE[group] || `Utviklingen av ${group}`,
      currentValues: { body: page?.body || "", kilder: page?.kilder || [] },
    }));
  }

  // Knapperad nederst: nytt innovasjonskort + ny artist. Lærer får sitt eget
  // skjema (onTechEdit med instrumentet ferdig valgt) i stedet for forslagsflyten
  // — å «foreslå» til seg selv gir ingen mening.
  const foot = body.querySelector(".instr-foot");
  const knapper = [];

  // Raden har to halvdeler: SE hva som finnes til venstre, LEGG TIL til høyre.
  // Skillet er selve poenget — man skal sjekke dekningen før man bidrar, og de
  // to handlingene skal ikke se ut som fire like valg på rad.
  // Artistene hentes på GRUPPE, ikke på instrumentnavn — se
  // artistsInInstrumentGroup (en «Soloinstrument»-artist heter «Trompet»).
  const artister = artistsInInstrumentGroup(s.artists, group);
  knapper.push({
    side: "venstre",
    tekst: `Alle artister (${artister.length})`,
    gjør: () => openArtistListModal(
      `Artister: ${group}`, artister, opts.onArtistClick,
      `Ingen artister er lagt inn på ${group} ennå.`
    ),
  });
  knapper.push({
    side: "venstre",
    tekst: `Alle nyvinninger (${items.length})`,
    gjør: () => openTechListModal(group, items),
  });

  if (opts.onTechEdit) {
    knapper.push({ side: "høyre", tekst: "Legg til nyvinning", gjør: () => opts.onTechEdit(null, { instrument: group, category: INSTRUMENT_TECH_CATEGORY }) });
  } else if (opts.onProposeNewTech) {
    knapper.push({ side: "høyre", tekst: "Legg til nyvinning", gjør: () => opts.onProposeNewTech({ instrument: group, category: INSTRUMENT_TECH_CATEGORY }) });
  }
  // Artistskjemaet åpnes UTEN forhåndsvalgt instrument (brukervalg): gruppenavnene
  // «Soloinstrument» og «Trommer» er ikke gyldige artistverdier — artisten skal
  // ha det presise instrumentet (Saksofon, Trommer/perkusjon …).
  knapper.push({ side: "høyre", tekst: "Legg til artist", href: "student.html" });

  // data-k bærer indeksen i `knapper`, ikke i gruppen: klikk-koblingen under
  // slår opp i den samlede lista, og den må stemme uansett hvordan knappene
  // fordeler seg på de to halvdelene.
  const knappHtml = (k, i) => k.href
    ? `<a class="btn ghost small" href="${k.href}">${escapeHtml(k.tekst)}</a>`
    : `<button type="button" class="btn ghost small" data-k="${i}">${escapeHtml(k.tekst)}</button>`;
  const gruppe = (side) => knapper
    .map((k, i) => [k, i])
    .filter(([k]) => k.side === side)
    .map(([k, i]) => knappHtml(k, i))
    .join("");
  foot.innerHTML =
    `<div class="instr-foot-gruppe">${gruppe("venstre")}</div>` +
    `<div class="instr-foot-gruppe">${gruppe("høyre")}</div>`;
  foot.querySelectorAll("[data-k]").forEach((b) =>
    b.addEventListener("click", () => knapper[+b.dataset.k].gjør()));

  // Punkt på tidslinjen (og enkeltkort-lenka) åpner innovasjonskortet OPPÅ
  // seksjonen — samme mønster som tiårsvisningens teknologitidslinje.
  body.querySelectorAll("[data-tech-id], [data-instr-tech]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.techId || el.dataset.instrTech;
      const t = getState().techItems.find((x) => x.id === id);
      if (t) openTechDetail(t);
    });
  });
}

// Alle nyvinningene for ett instrument som kortliste. Samme kort som
// Teknologi-seksjonen (renderTechCards), men uten kategorifiltrering og MED
// hendelseskortene — lista skal stemme med tidslinjen rett under knappen.
function openTechListModal(group, items) {
  const modal = document.getElementById("modal-instr-tech");
  if (!modal) return;
  document.getElementById("itl-title").textContent = `Nyvinninger: ${group} (${items.length})`;
  renderTechCards(
    document.getElementById("itl-body"), items, buildLinkCtx(),
    `Ingen nyvinninger er lagt inn for ${group} ennå.`
  );
  modalOpen(modal);
}

function renderUtvikling() {
  renderPodkastInngang();
  renderChips();
  renderGroup(currentGroup || INSTRUMENT_TIMELINE_GROUPS[0]);
}

// Tegner de åpne visningene på nytt når kort/episoder/innhold/artister endres.
// Dekker BEGGE vinduene, og er no-op for det som er lukket, så sidene kan kalle
// den trygt fra ethvert snapshot uten egen vakt.
export function renderInstrumenter() {
  if (erApen("modal-instrumenter")) renderUtvikling();
  if (erApen("modal-podkaster")) renderPodkast();
}

const erApen = (id) => !!document.getElementById(id)?.classList.contains("open");

// `group` velger hvilket instrument som vises — brukt av instrument-lenka på
// innovasjonskortene og av søket. Kalles også rett fra en klikklytter, og får
// da hendelsen som argument; includes-sjekken siler den bort.
export function openInstrumenter(group) {
  const modal = document.getElementById("modal-instrumenter");
  if (!modal) return;
  if (group && INSTRUMENT_TIMELINE_GROUPS.includes(group)) currentGroup = group;
  renderUtvikling();
  modalOpen(modal);
}

// Podkastene i eget vindu (v5.07). Lå tidligere som fane nummer to i
// Instrumenter-kortet; med «Hør podkastene»-knappen på plass var fanen bare et
// ekstra lag rundt den samme lista.
export function openPodkaster() {
  const modal = document.getElementById("modal-podkaster");
  if (!modal) return;
  // Lukkes vinduet mens en episode spiller, skal brukeren selv velge om lyden
  // følger med ut.
  wirePlayerCloseGuard(modal, "podkast-list");
  renderPodkast();
  modalOpen(modal);
}
