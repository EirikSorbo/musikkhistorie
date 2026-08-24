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
import { modalOpen, escapeHtml } from "./ui.js?v=4.72";
import { buildInstrumentTimeline, instrumentInnovations } from "./ui-timeline.js?v=4.72";
import { INSTRUMENT_TIMELINE_GROUPS, INSTRUMENT_TITLE, INSTRUMENT_COLOR, instrumentPageId } from "./limits.js?v=4.72";
import { pageFor } from "./story-format.js?v=4.72";
import { renderRichText } from "./rich-text.js?v=4.72";
import { wireLinks, podcastEpisodeHtml } from "./ui-helpers.js?v=4.72";
import { opts, getState, buildLinkCtx } from "./explore-context.js?v=4.72";
import { openTechDetail } from "./explore-tech.js?v=4.72";

// Kategorien nye instrumentkort får automatisk — instrumentnyvinninger hører
// hjemme under «Instrumenter og lydutstyr», så ingen trenger å velge den selv.
const INSTRUMENT_TECH_CATEGORY = "Instrumenter og lydutstyr";

// Valgt fane huskes mellom åpninger, som sjangerhistoriene.
let currentGroup = null;
let currentTab = "utvikling";

// Hovedfanene. Podkastene lå tidligere som eget dashbordkort — de hører hjemme
// her fordi studentenes episoder handler om instrumentene.
const TABS = [
  { id: "utvikling", label: "Instrumentenes utvikling" },
  { id: "podkast", label: "Podkaster" },
];

function renderTabs() {
  const el = document.getElementById("instr-tabs");
  if (!el) return;
  if (!el.dataset.filled) {
    el.innerHTML = TABS.map((t) =>
      `<button type="button" class="btn ghost small instr-tab" data-tab="${t.id}">${escapeHtml(t.label)}</button>`
    ).join("");
    el.querySelectorAll(".instr-tab").forEach((b) =>
      b.addEventListener("click", () => selectTab(b.dataset.tab)));
    el.dataset.filled = "1";
  }
  el.querySelectorAll(".instr-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === currentTab));
}

function selectTab(tab) {
  currentTab = TABS.some((t) => t.id === tab) ? tab : "utvikling";
  renderTabs();
  const utv = document.getElementById("instr-utvikling");
  const pod = document.getElementById("instr-podkast");
  if (utv) utv.hidden = currentTab !== "utvikling";
  if (pod) pod.hidden = currentTab !== "podkast";
  if (currentTab === "podkast") renderPodkast();
  else renderUtvikling();
}

// Podkast-fanen: episodene lastes opp av lærer, så studentene ser bare lista.
// Lærer får inngangen til opplastingsskjemaet her, siden dashbordkortet er borte.
function renderPodkast() {
  const el = document.getElementById("podkast-list");
  const extra = document.getElementById("podkast-extra");
  if (!el) return;
  const s = getState();
  el.innerHTML = s.podcasts.length
    ? s.podcasts.map((ep) => podcastEpisodeHtml(ep)).join("")
    : `<p class="muted empty" style="background:#fff">Episodene publiseres fortløpende etter hvert som studentgruppene leverer sine bidrag.</p>`;
  if (extra) {
    extra.innerHTML = opts.onPodkastAdmin
      ? `<button type="button" class="btn ghost small">Rediger episoder</button>` : "";
    extra.querySelector("button")?.addEventListener("click", () => opts.onPodkastAdmin());
  }
}

function renderChips() {
  const chips = document.getElementById("instr-chips");
  if (!chips || chips.dataset.filled) return;
  // --instr-color per knapp; CSS bruker den til kant, tekst og fyll når knappen
  // er aktiv — samme mønster som sjangerhistorienes chips.
  chips.innerHTML = INSTRUMENT_TIMELINE_GROUPS.map((g) =>
    `<button type="button" class="btn ghost small instr-chip" data-instr="${escapeHtml(g)}"` +
    ` style="--instr-color:${INSTRUMENT_COLOR[g] || "var(--accent)"}">${escapeHtml(g)}</button>`
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
    sum.innerHTML = renderRichText(page.body, lc);
    wireLinks(sum, lc);
  } else {
    // Teksten peker på HVEM som skriver den, ikke bare at den mangler —
    // «podkast» er en lenke til podkastfanen, der gruppene ligger.
    sum.innerHTML = s.contentLoaded
      ? `<p class="instr-sum-hint">Teksten skrives av gruppen som lager ` +
        `<button type="button" class="sh-linkbtn" id="instr-til-podkast">podkast</button>` +
        ` om instrumentets utvikling.</p>`
      : `<p class="gx-missing">Laster innhold …</p>`;
    sum.querySelector("#instr-til-podkast")?.addEventListener("click", () => selectTab("podkast"));
  }

  // Rediger (lærer) eller Foreslå endring (student) på sammendraget.
  const sumActions = body.querySelector(".instr-sum-actions");
  if (opts.onPageEdit) {
    sumActions.innerHTML = `<button type="button" class="btn ghost small">Rediger sammendrag</button>`;
    sumActions.querySelector("button").addEventListener("click", () => opts.onPageEdit(pageId));
  } else if (opts.onProposeEdit) {
    sumActions.innerHTML = `<button type="button" class="btn ghost small">Rediger sammendrag</button>`;
    sumActions.querySelector("button").addEventListener("click", () => opts.onProposeEdit({
      entityType: "instrument",
      entityId: pageId,
      entityName: INSTRUMENT_TITLE[group] || `Utviklingen av ${group}`,
      currentValues: { body: page?.body || "" },
    }));
  }

  // Knapperad nederst: nytt innovasjonskort + ny artist. Lærer får sitt eget
  // skjema (onTechEdit med instrumentet ferdig valgt) i stedet for forslagsflyten
  // — å «foreslå» til seg selv gir ingen mening.
  const foot = body.querySelector(".instr-foot");
  const knapper = [];
  if (opts.onTechEdit) {
    knapper.push({ tekst: "Legg til instrument-utvikling", gjør: () => opts.onTechEdit(null, { instrument: group, category: INSTRUMENT_TECH_CATEGORY }) });
  } else if (opts.onProposeNewTech) {
    knapper.push({ tekst: "Legg til instrument-utvikling", gjør: () => opts.onProposeNewTech({ instrument: group, category: INSTRUMENT_TECH_CATEGORY }) });
  }
  // Artistskjemaet åpnes UTEN forhåndsvalgt instrument (brukervalg): gruppenavnene
  // «Soloinstrument» og «Trommer» er ikke gyldige artistverdier — artisten skal
  // ha det presise instrumentet (Saksofon, Trommer/perkusjon …).
  knapper.push({ tekst: "Legg til artist", href: "student.html" });

  foot.innerHTML = knapper.map((k, i) => k.href
    ? `<a class="btn ghost small" href="${k.href}">${escapeHtml(k.tekst)}</a>`
    : `<button type="button" class="btn ghost small" data-k="${i}">${escapeHtml(k.tekst)}</button>`
  ).join("");
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

function renderUtvikling() {
  renderChips();
  renderGroup(currentGroup || INSTRUMENT_TIMELINE_GROUPS[0]);
}

// Tegner gjeldende fane på nytt når kort/episoder/innhold endres mens
// seksjonen står åpen. No-op når modalen er lukket, så sidene kan kalle den
// trygt fra ethvert snapshot (tech, podcasts, content) uten egen vakt.
export function renderInstrumenter() {
  if (!document.getElementById("modal-instrumenter")?.classList.contains("open")) return;
  renderTabs();
  selectTab(currentTab);
}

// `tab` kan være "podkast" for å åpne rett på podkastfanen. `group` velger
// hvilket instrument som vises — brukt av instrument-lenka på innovasjonskortene.
export function openInstrumenter(tab, group) {
  const modal = document.getElementById("modal-instrumenter");
  if (!modal) return;
  if (group && INSTRUMENT_TIMELINE_GROUPS.includes(group)) currentGroup = group;
  renderTabs();
  selectTab(typeof tab === "string" ? tab : currentTab);
  modalOpen(modal);
}
