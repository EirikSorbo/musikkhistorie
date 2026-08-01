// ============================================================================
//  INSTRUMENTER — nyvinninger per instrumentgruppe
// ----------------------------------------------------------------------------
//  Én tidslinje per instrumentgruppe (INSTRUMENT_TIMELINE_GROUPS i limits.js),
//  bygget av innovasjonskortene i `tech` som har `instrument` satt til gruppen.
//  Kortene skrives av STUDENTENE: hver gruppe har sin egen «Foreslå nytt
//  instrumentkort»-knapp, som åpner forslagseditoren forhåndsutfylt med riktig
//  instrument og kategori. Ingenting her er hardkodet innhold — en ny godkjent
//  nyvinning dukker opp på tidslinjen av seg selv.
//
//  Merk at kortene deles med Teknologi-seksjonen: et instrumentkort ER et
//  innovasjonskort, bare med `instrument` satt. Det er derfor «Elektrisk gitar»
//  både står under Teknologi og på Gitar-tidslinjen — samme kort, to innganger.
// ============================================================================
import { modalOpen, escapeHtml } from "./ui.js?v=3.78";
import { buildInstrumentTimeline, instrumentInnovations } from "./ui-timeline.js?v=3.78";
import { INSTRUMENT_TIMELINE_GROUPS } from "./limits.js?v=3.78";
import { opts, getState } from "./explore-context.js?v=3.78";
import { openTechDetail } from "./explore-tech.js?v=3.78";

// Kategorien nye instrumentkort får automatisk. Instrumentnyvinninger hører
// hjemme under «Instrumenter og lydutstyr» i teknologiseksjonen, og da slipper
// studenten å velge den selv.
const INSTRUMENT_TECH_CATEGORY = "Instrumenter og lydutstyr";

function sectionHtml(group, items) {
  const n = items.length;
  const tellerTekst = n === 0
    ? "Ingen kort ennå"
    : n === 1 ? "1 kort" : `${n} kort`;
  return `<section class="instr-block" data-instr="${escapeHtml(group)}">
    <div class="instr-head">
      <h3>${escapeHtml(group)}</h3>
      <span class="instr-count">${tellerTekst}</span>
      <div class="spacer"></div>
      <div class="instr-actions"></div>
    </div>
    <div class="instr-tl"></div>
  </section>`;
}

// Én tidslinje trenger minst to punkter for å gi mening. Med ett kort viser vi
// kortet som en enkel lenke i stedet, så det ikke blir usynlig i påvente av
// nummer to — og med null sier vi tydelig ifra at her mangler det innhold.
function timelineOrFallback(group, items) {
  const html = buildInstrumentTimeline(getState().techItems, group);
  if (html) return html;
  if (items.length === 1) {
    const t = items[0];
    return `<p class="instr-single">Foreløpig ett kort: ` +
      `<button type="button" class="sh-linkbtn" data-instr-tech="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>` +
      `${t.adoptedLabel || t.adoptedYear ? ` <span class="muted">(${escapeHtml(t.adoptedLabel || String(t.adoptedYear))})</span>` : ""}. ` +
      `Tidslinjen tegnes når det finnes minst to.</p>`;
  }
  return `<p class="gx-missing">Ingen nyvinninger lagt inn for ${escapeHtml(group)} ennå.</p>`;
}

export function renderInstrumenter() {
  const body = document.getElementById("instr-body");
  if (!body) return;
  const s = getState();

  body.innerHTML = INSTRUMENT_TIMELINE_GROUPS
    .map((g) => sectionHtml(g, instrumentInnovations(s.techItems, g)))
    .join("");

  for (const block of body.querySelectorAll(".instr-block")) {
    const group = block.dataset.instr;
    const items = instrumentInnovations(s.techItems, group);
    block.querySelector(".instr-tl").innerHTML = timelineOrFallback(group, items);

    // Studentenes inngang: én knapp per instrument, forhåndsutfylt. Lærer har
    // sin egen redigeringsflate under Teknologi og trenger den ikke her.
    const actions = block.querySelector(".instr-actions");
    if (opts.onProposeNewTech && actions) {
      actions.innerHTML = `<button type="button" class="btn ghost small">Foreslå nytt kort</button>`;
      actions.querySelector("button").addEventListener("click", () =>
        opts.onProposeNewTech({ instrument: group, category: INSTRUMENT_TECH_CATEGORY }));
    }
  }

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

export function openInstrumenter() {
  const modal = document.getElementById("modal-instrumenter");
  if (!modal) return;
  renderInstrumenter();
  modalOpen(modal);
}
