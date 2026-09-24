// ============================================================================
//  SJANGERPERIODER — kortet i «Det store bildet» (v5.20)
// ----------------------------------------------------------------------------
//  Liggende stolper for når hver sjanger var aktiv, gruppert etter metasjanger
//  i de samme sammenleggbare gruppene som varmekartet. Datalogikken bor i
//  genre-periods.js (enhetstestet); her er bare tegningen og koblingen.
//
//  DYNAMISK, så figuren aldri må vedlikeholdes:
//   - den tegnes fra gjeldende state ved hver åpning
//   - står den åpen, tegnes den på nytt når genreDescriptions endres (nye
//     årstall; explore-context.genreDescsChanged, kalt av alle tre sidene),
//     når content endres (treet lastet eller mangler; contentChanged) og når
//     slektstreet bygges på nytt (ny sjanger, navnebytte, flytting mellom
//     metasjangre; onGenreModelChanged nederst)
//   - men BARE når noe i figuren faktisk er endret (periodSignatur): ellers ville
//     hver lagret beskrivelse nullstilt scroll og fokus for den som leser
//
//  Modulen leser state og treet ved KALL-TID, aldri inn i modulnivå-konstanter:
//  explore-context importerer feature-modulene tilbake, og GENEALOGY byttes ut
//  ved hver ombygging av treet.
// ============================================================================
import { escapeHtml, modalOpen } from "./ui.js?v=5.44";
import { GENEALOGY, onGenreModelChanged } from "./genre-model.js?v=5.44";
import { storyOrder } from "./story-format.js?v=5.44";
import { eraYears } from "./genealogy.js?v=5.44";
import { getState, groupColor, metaGroupHeadHtml, wireMetaAccordion, onMainGenreClick } from "./explore-context.js?v=5.44";
import { periodGroups, periodAxis, pctAv, periodSignatur } from "./genre-periods.js?v=5.44";

// Hvilken metagruppe som står åpen (navnet), «__ingen» når brukeren har lukket
// alle, null ved frisk åpning (da åpnes den første).
let spOpenMeta = null;

const erApen = () => document.getElementById("modal-sjangerperioder")?.classList.contains("open");

// Hvor åpne perioder begynner å tone ut: noen år før i dag, så halen leses som
// «fortsetter» uten å antyde et sluttår.
const TONING_AAR = 4;

const HULL_TEKST = {
  mangler: "mangler årstall",
  ugyldigSlutt: "sluttåret er ikke et gyldig årstall",
  ugyldig: "sluttåret er før startåret",
  framtid: "årstallet ligger fram i tid",
};

function stolpeHtml(r, axis, naa) {
  const tittel = `${r.genre} · ${eraYears({ activeFrom: r.from, activeTo: r.to })}`;
  const x0 = pctAv(axis, r.from);
  const aapen = r.to === null;
  // Sluttåret er inklusivt («aktiv til og med»), så en lukket periode tegnes til
  // SLUTTEN av sluttåret. Ellers ble hver stolpe ett år for kort, og en periode
  // med samme fra- og til-år fikk null bredde.
  const x1 = aapen ? 100 : pctAv(axis, r.to + 1);
  const synligSlutt = aapen ? pctAv(axis, naa) : x1;
  let bakgrunn = r.color;
  if (aapen) {
    // Én gradient over hele stolpen: helt dekkende fram til like før i dag,
    // så gjennomsiktig mot aksekanten. To elementer side om side ga en søm.
    const stopp = Math.max(0, Math.min(100, ((pctAv(axis, naa - TONING_AAR) - x0) / (x1 - x0)) * 100));
    bakgrunn = `linear-gradient(to right,${r.color} 0%,${r.color} ${stopp.toFixed(1)}%,${r.color}00 100%)`;
  }
  // Navnet står midt over den synlige delen av stolpen, men forankres i kanten
  // når det ellers ville stukket ut av figuren.
  const midt = (x0 + synligSlutt) / 2;
  const anker = midt < 7 ? "start" : midt > 93 ? "slutt" : "midt";
  const navnPos = anker === "start" ? x0 : anker === "slutt" ? synligSlutt : midt;
  return `<button type="button" class="sp-rad" data-sp-open="${escapeHtml(r.genre)}" title="${escapeHtml(tittel)}" aria-label="${escapeHtml(tittel)}. Åpne sjangerkortet">`
    + `<span class="sp-navn" data-anker="${anker}" style="left:${navnPos.toFixed(3)}%">${escapeHtml(r.genre)}</span>`
    + `<span class="sp-stolpe" style="left:${x0.toFixed(3)}%;width:${(x1 - x0).toFixed(3)}%;background:${bakgrunn}"></span>`
    + `</button>`;
}

function hullHtml(r) {
  const hva = HULL_TEKST[r.status] || HULL_TEKST.mangler;
  return `<button type="button" class="sp-rad sp-rad--mangler" data-sp-open="${escapeHtml(r.genre)}" title="Åpne sjangerkortet for ${escapeHtml(r.genre)}">`
    + `<span class="sp-navn">${escapeHtml(r.genre)}</span><span class="sp-mangler">${hva}</span></button>`;
}

function figurHtml(groups, axis, naa) {
  const streker = axis.ticks.map((t) => `<span class="sp-strek" style="left:${pctAv(axis, t).toFixed(3)}%"></span>`).join("");
  const akse = `<div class="sp-akse">${axis.ticks.map((t) => `<span style="left:${pctAv(axis, t).toFixed(3)}%">${t}</span>`).join("")}</div>`;
  // Står den lagrede gruppa ikke lenger i figuren (metasjangeren har byttet navn
  // eller blitt tom), åpnes den første i stedet for at alle står lukket.
  const finnes = groups.some((g) => g.meta === spOpenMeta);
  let html = "";
  groups.forEach((g, gi) => {
    const open = spOpenMeta === "__ingen" ? false : (spOpenMeta && finnes) ? g.meta === spOpenMeta : gi === 0;
    html += metaGroupHeadHtml({
      prefix: "sp", meta: g.meta, gColor: groupColor(g.rows.map((r) => r.genre)), open, groupIdx: gi,
      count: `${g.rows.length} sjanger${g.rows.length === 1 ? "" : "e"}`,
      metaAttr: ` data-sp-meta="${escapeHtml(g.meta)}"`,
    });
    html += `<div class="sp-group-rows" style="display:${open ? "block" : "none"}">`;
    html += `<div class="sp-scroll"><div class="sp-figur"><div class="sp-rader">${streker}`;
    html += g.rows.map((r) => (r.status === "ok" ? stolpeHtml(r, axis, naa) : hullHtml(r))).join("");
    html += `</div>${akse}</div></div>`;
    html += `</div>`;   // .sp-group-rows
    html += `</div>`;   // .sp-group
  });
  // Fargeprøven og forklaringen står i ett element, så de aldri brytes fra
  // hverandre på mellombredder.
  html += `<p class="sp-forklaring">Stolpene viser når sjangeren var aktiv, med de samme årstallene som sjangerkortet. `
    + `<span class="sp-forklaring-par"><span class="sp-toning" aria-hidden="true"></span>betyr at sjangeren fortsatt er aktiv.</span></p>`;
  return html;
}

// Hva figuren ville vist nå: markup, signatur og om det er en ekte figur.
function beregn() {
  const s = getState();
  const tilstand = (tekst) => ({ html: `<p class="gx-missing">${tekst}</p>`, signatur: `tilstand:${tekst}`, figur: false });
  // Treet kommer via content-snapshotet. Er content lastet og treet likevel tomt,
  // mangler det i basen, og det skal sies tydelig i stedet for «laster» for alltid.
  if (!GENEALOGY.length) return tilstand(s.contentLoaded ? "Sjangertreet er ikke lagt inn ennå." : "Laster sjangrene …");
  // Årstallene kommer via sitt eget snapshot. Er de lastet men tomme, tegnes
  // figuren likevel, og hver sjanger står som «mangler årstall».
  if (s.genreDescsLoaded === false) return tilstand("Laster sjangrene …");
  const naa = new Date().getFullYear();
  const genreDescs = s.genreDescs || {};
  const groups = periodGroups(storyOrder(genreDescs), genreDescs, GENEALOGY, naa);
  if (!groups.length) return tilstand("Ingen sjangre å vise ennå.");
  const axis = periodAxis(groups, naa);
  return { html: figurHtml(groups, axis, naa), signatur: periodSignatur(groups, axis), figur: true };
}

export function renderSjangerperioderBody({ tving = false } = {}) {
  const body = document.getElementById("sp-body");
  if (!body) return;
  const { html, signatur, figur } = beregn();
  if (!tving && body.dataset.spSignatur === signatur) return;

  // Noe i figuren er faktisk endret: ta vare på sidelengs scroll og fokus
  // gjennom omtegningen, så den som leser ikke kastes tilbake til 1900.
  const aktiv = document.activeElement && body.contains(document.activeElement) ? document.activeElement : null;
  const fokus = aktiv ? { open: aktiv.dataset?.spOpen, meta: aktiv.closest(".sp-group")?.dataset.spMeta, hode: aktiv.classList.contains("sp-group-head") } : null;
  const scroll = {};
  body.querySelectorAll(".sp-group").forEach((g) => {
    const sc = g.querySelector(".sp-scroll");
    if (sc && sc.scrollLeft) scroll[g.dataset.spMeta] = sc.scrollLeft;
  });

  body.innerHTML = html;
  body.dataset.spSignatur = signatur;
  if (!figur) return;

  wireMetaAccordion(body, "sp", (wasOpen, group) => {
    spOpenMeta = wasOpen ? "__ingen" : (group?.dataset.spMeta || null);
  });
  // Klikk på en sjanger åpner sjangerkortet, samme inngang som overalt ellers.
  // Der ser studenten perioden med ord, og læreren kan rette årstallene.
  body.querySelectorAll("[data-sp-open]").forEach((b) =>
    b.addEventListener("click", () => onMainGenreClick(b.dataset.spOpen)));

  const grupper = [...body.querySelectorAll(".sp-group")];
  grupper.forEach((g) => {
    const v = scroll[g.dataset.spMeta];
    const sc = g.querySelector(".sp-scroll");
    if (sc && v) sc.scrollLeft = v;
  });
  if (fokus) {
    const g = grupper.find((x) => x.dataset.spMeta === fokus.meta);
    const mål = fokus.open
      ? [...body.querySelectorAll("[data-sp-open]")].find((b) => b.dataset.spOpen === fokus.open)
      : (fokus.hode ? g?.querySelector(".sp-group-head") : null);
    mål?.focus({ preventScroll: true });
  }
}

export function openSjangerperioder() {
  const modal = document.getElementById("modal-sjangerperioder");
  if (!modal) return;
  spOpenMeta = null;   // frisk åpning: første gruppe åpen
  renderSjangerperioderBody({ tving: true });
  modalOpen(modal);
}

// Slektstreet bygget på nytt (ny sjanger, navnebytte, flytting mellom
// metasjangre): tegn på nytt hvis figuren står åpen og noe er endret.
onGenreModelChanged(() => { if (erApen()) renderSjangerperioderBody(); });
