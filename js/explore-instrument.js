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
import { modalOpen, escapeHtml } from "./ui.js?v=3.79";
import { buildInstrumentTimeline, instrumentInnovations } from "./ui-timeline.js?v=3.79";
import { INSTRUMENT_TIMELINE_GROUPS, instrumentPageId } from "./limits.js?v=3.79";
import { pageFor, renderStoryHtml } from "./story-format.js?v=3.79";
import { wireLinks } from "./ui-helpers.js?v=3.79";
import { opts, getState, buildLinkCtx } from "./explore-context.js?v=3.79";
import { openTechDetail } from "./explore-tech.js?v=3.79";

// Kategorien nye instrumentkort får automatisk — instrumentnyvinninger hører
// hjemme under «Instrumenter og lydutstyr», så ingen trenger å velge den selv.
const INSTRUMENT_TECH_CATEGORY = "Instrumenter og lydutstyr";

// Valgt fane huskes mellom åpninger, som sjangerhistoriene.
let currentGroup = null;

function renderChips() {
  const chips = document.getElementById("instr-chips");
  if (!chips || chips.dataset.filled) return;
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

  body.innerHTML = `
    <div class="instr-tl">${timelineHtml(group, items)}</div>
    <div class="instr-sum">
      <div class="instr-sum-head">
        <h3>${escapeHtml(group)} — utvikling</h3>
        <div class="spacer"></div>
        <div class="instr-sum-actions"></div>
      </div>
      <div class="instr-sum-body story-body"></div>
    </div>
    <div class="instr-foot"></div>`;

  // Sammendraget: teksten bor i Firestore, INGEN reservetekst i koden — mangler
  // den, sies det tydelig ifra (samme regel som resten av innholdet i appen).
  const sum = body.querySelector(".instr-sum-body");
  const lc = buildLinkCtx();
  if (page) {
    sum.innerHTML = renderStoryHtml(page.body, lc);
    wireLinks(sum, lc);
  } else {
    sum.innerHTML = `<p class="gx-missing">${s.contentLoaded
      ? `Sammendraget for ${escapeHtml(group)} er ikke skrevet ennå.`
      : "Laster innhold …"}</p>`;
  }

  // Rediger (lærer) eller Foreslå endring (student) på sammendraget.
  const sumActions = body.querySelector(".instr-sum-actions");
  if (opts.onPageEdit) {
    sumActions.innerHTML = `<button type="button" class="btn ghost small">Rediger</button>`;
    sumActions.querySelector("button").addEventListener("click", () => opts.onPageEdit(pageId));
  } else if (opts.onProposeEdit) {
    sumActions.innerHTML = `<button type="button" class="btn ghost small">Foreslå endring</button>`;
    sumActions.querySelector("button").addEventListener("click", () => opts.onProposeEdit({
      entityType: "instrument",
      entityId: pageId,
      entityName: `${group} — utvikling`,
      currentValues: { body: page?.body || "" },
    }));
  }

  // Knapperad nederst: nytt innovasjonskort + ny artist. Lærer får sitt eget
  // skjema (onTechEdit med instrumentet ferdig valgt) i stedet for forslagsflyten
  // — å «foreslå» til seg selv gir ingen mening.
  const foot = body.querySelector(".instr-foot");
  const knapper = [];
  if (opts.onTechEdit) {
    knapper.push({ tekst: "Nytt kort", gjør: () => opts.onTechEdit(null, { instrument: group, category: INSTRUMENT_TECH_CATEGORY }) });
  } else if (opts.onProposeNewTech) {
    knapper.push({ tekst: "Foreslå nytt kort", gjør: () => opts.onProposeNewTech({ instrument: group, category: INSTRUMENT_TECH_CATEGORY }) });
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

// Tegner på nytt uten å bytte fane — brukt når kort/innhold endres mens
// seksjonen står åpen.
export function renderInstrumenter() {
  renderChips();
  renderGroup(currentGroup || INSTRUMENT_TIMELINE_GROUPS[0]);
}

export function openInstrumenter(group) {
  const modal = document.getElementById("modal-instrumenter");
  if (!modal) return;
  renderChips();
  renderGroup(typeof group === "string" ? group : (currentGroup || INSTRUMENT_TIMELINE_GROUPS[0]));
  modalOpen(modal);
}
