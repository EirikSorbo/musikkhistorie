// ============================================================================
//  REFERANSER: alle kildene appen bygger på, samlet
// ----------------------------------------------------------------------------
//  Kortet er en AVLEDNING av dataene: kildene hentes fra det som allerede
//  ligger i minnet (artister, tiår, sjangre, koblinger, innovasjonskort) og
//  regnes om ved hver åpning, så listen aldri kan bli utdatert. I tillegg kan
//  læreren legge inn frittstående referanser som ikke hører til noe kort
//  (content/referanser, «Ny referanse» på lærersiden) — de blandes inn i samme
//  liste. Slektstreets koblingskilder er MED siden v4.65: alle sider abonnerer
//  på edgeDescriptions gjennom shared-data.js (v4.44), så de ligger allerede i
//  minnet uten én ekstra lesing. (De var holdt utenfor fra før v4.44, da
//  samlingen kostet ekstra lesinger — det premisset er dødt.)
//  Grupperingen (kategori → hovedkilde → artikkel) kommer fra kilder.js.
// ============================================================================
import { modalOpen } from "../ui/ui-modal.js";
import { escapeHtml } from "../felles/util.js";
import { isVisible, erSkjult } from "../felles/limits.js";
import { samleKilder, kildeUtvalg } from "../felles/kilder.js";
import { SKJUL_I_STUDENTVISNING } from "../felles/feature-flags.js";
import { sjekkene } from "../felles/sjekket.js";
import { har, sjangerSjekket } from "../data/sjekket-filter.js";
import { genreNodeById, edgeExists } from "../sjangre/genre-model.js";
import { showEdgeInfo } from "../sjangre/genealogy.js";
import { onMainGenreClick, sjangerOpts } from "./explore-context.js";
import { opts, getState } from "../data/app-state.js";
import { metaGroupHeadHtml, wireMetaAccordion } from "../ui/ui-metagruppe.js";
import { openTechDetail } from "./explore-tech.js";
import { openDecade } from "./explore-decade.js";
import { openHistorier } from "./explore-innhold.js";
import { kanRetteKilder, apneKildeRetting } from "./referanse-retting.js";

export function openReferanser() {
  const modal = document.getElementById("modal-referanser");
  if (!modal) return;
  renderReferanser();
  modalOpen(modal);
}

// Kildene fra alle kortene. Sjangerbeskrivelsene har ett dokument per
// sjangernavn med egne felt per nivå (meta/main/sub), og hvert nivå har sine
// egne kilder.
//
// Kildene fra alle kortene, med hvor de står (opphav). Hvert sted har to
// merker til utvalget i kildeUtvalg (v7.37): `synlig` (studentene kan se
// teksten, uten hensyn til sjekkene) og `sjekket` (læreren har sjekket
// teksten, config/teacherChecks). `apnes` sier om denne brukeren får åpne
// kortet fra lista: på lærersiden alle, ellers bare det studentene ser.
//
// Det studentene ser: aktive artister som ikke er skjult; alle tiår og
// sjangerkort; sjangerhistoriene (meta) og koblingstekstene bare når bryterne
// metasjangerhistorier og koblingsbeskrivelser er av; aktive innovasjonskort.
const KRAV_TEKST = "En kilde står her når minst én tekst som bruker den, er synlig for studentene, og minst én er sjekket.";
const erLaererside = () => typeof document !== "undefined" && document.body.classList.contains("is-teacher");

function alleKilder() {
  const s = getState();
  const sj = sjekkene();
  const skjul = SKJUL_I_STUDENTVISNING;
  const laererside = erLaererside();
  const ut = [];
  // Hver kilde bærer med seg hvilket kort den kom fra, så listen kan åpne det.
  const legg = (arr, opphav) => {
    if (!Array.isArray(arr)) return;
    if (opphav && opphav.apnes === undefined) opphav.apnes = laererside || opphav.synlig;
    for (const k of arr) if (k) ut.push({ ...k, opphav });
  };

  for (const a of (s.artists || []).filter((x) => x.status === "active")) {
    legg(a.kilder, {
      type: "artist", id: a.id, navn: a.name,
      synlig: !erSkjult(a), sjekket: a.teacherChecked === true,
      // Med «Bare sjekket innhold» på ser ikke studentene usjekkede artister.
      apnes: laererside || isVisible(a),
    });
  }
  for (const [id, d] of Object.entries(s.decadeDescs || {})) {
    // Kildene er felles for de to tekstene på tiåret.
    legg(d && d.kilder, {
      type: "decade", id, navn: `${id}-tallet`,
      synlig: true, sjekket: har(sj.decades, id) || har(sj.decadesTech, id),
    });
  }
  for (const [navn, g] of Object.entries(s.genreDescs || {})) {
    if (!g) continue;
    const sjekk = { main: sjangerSjekket(navn, sj), sub: har(sj.subgenres, navn), meta: har(sj.metaGenres, navn) };
    for (const niva of ["meta", "main", "sub"]) {
      legg(g[niva] && g[niva].kilder, {
        type: "genre", id: navn, navn, niva,
        synlig: niva === "meta" ? !skjul.metasjangerhistorier : true, sjekket: sjekk[niva],
      });
    }
  }
  for (const t of s.techItems || []) {
    if (!t) continue;
    legg(t.kilder, {
      type: "tech", id: t.id, navn: t.name,
      synlig: (t.status || "active") === "active", sjekket: (sj.tech || []).includes(t.id),
    });
  }
  // Koblingene i slektstreet (edgeDescriptions, doc-ID «fra__til») — bl.a.
  // forelesningsnotatene bor her. Navnet vises som «Blues → R&B».
  for (const [key, e] of Object.entries(s.edgeDescs || {})) {
    if (!e) continue;
    // Kobling treet ikke har lenger (typisk etter re-parenting): teksten står
    // igjen i basen, men skal ikke presenteres som en avstamning i appen.
    if (!edgeExists(key)) continue;
    const [fra, til] = String(key).split("__");
    const navn = `${genreNodeById(fra)?.l || fra} → ${genreNodeById(til)?.l || til}`;
    legg(e.kilder, { type: "edge", id: key, navn, synlig: !skjul.koblingsbeskrivelser, sjekket: har(sj.edges, key) });
  }
  // Frittstående referanser: bor i content-samlingen, som allerede lastes, og
  // har med vilje INGEN opphav — de hører ikke til noe kort.
  legg(s.content && s.content.referanser && s.content.referanser.kilder, null);
  // Utvalget avgjøres av alle stedene. Deretter tas stedene brukeren ikke får
  // åpne, ut av lista (studentene får ingen knapp til et skjult kort).
  const utvalg = kildeUtvalg(ut);
  return laererside ? utvalg : utvalg.filter((k) => !k.opphav || k.opphav.apnes);
}

// Antall kilder, samme tall som ingressen i Referanser viser. Brukes av
// nøkkeltallet «Kilder» i lærerens Oversikt (v6.88).
export function antallKilder() {
  return samleKilder(alleKilder()).unike;
}

// Åpner kortet en kilde er brukt på. Modalene stables oppå Referanser, så ←
// går tilbake hit.
function apneOpphav(o) {
  const s = getState();
  if (o.type === "artist") {
    const a = (s.artists || []).find((x) => x.id === o.id);
    if (a && opts.onArtistClick) opts.onArtistClick(a);
  } else if (o.type === "tech") {
    const t = (s.techItems || []).find((x) => x.id === o.id);
    if (t) openTechDetail(t);
  } else if (o.type === "decade") {
    openDecade(o.id, "society");
  } else if (o.type === "edge") {
    const [fra, til] = String(o.id).split("__");
    showEdgeInfo(fra, til, sjangerOpts());
  } else if (o.type === "genre") {
    // Metasjangeren ER sjangerhistorien; de to andre nivåene har hvert sitt
    // sjangerkort (onMainGenreClick faller selv tilbake til undersjangeren).
    if (o.niva === "meta") openHistorier(o.navn);
    else onMainGenreClick(o.navn);
  }
}

// Blyanten på radene (v7.35), i samme pille som knappen til kortet.
const BLYANT_SVG = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/></svg>`;

const antallOrd = (n, ental, flertall) => `${n} ${n === 1 ? ental : flertall}`;

// Radene wires med indeks i denne lista, satt ved hver render. Delegert klikk
// på beholderen, så 500 rader ikke gir 500 lyttere.
let radListe = [];

// Én referanse. Kilder uten lenke (bøker, tidsskriftartikler) er ren tekst —
// resten er utgående lenke til selve artikkelen. Etter tittelen kommer
// forfatter/år, og til slutt veien videre: kortet kilden er brukt på, eller
// (for frittstående referanser) lærerens redigeringsknapp.
function radHtml(rad, i, visSted) {
  const merker = [
    rad.detalj,
    rad.spraak,
    visSted && rad.sted ? rad.sted : "",
  ].filter(Boolean).map((m) => `<span class="ref-merk">${escapeHtml(m)}</span>`).join("");
  const tittel = rad.url
    ? `<a href="${escapeHtml(rad.url)}" target="_blank" rel="noopener">${escapeHtml(rad.tittel)}</a>`
    : escapeHtml(rad.tittel);

  let vei = "";
  if (rad.opphav.length === 1) {
    // Artikkelen og kortet heter som regel det samme («Bessie Smith» på SNL,
    // brukt på Bessie Smiths kort) — da er navnet en gjentakelse, og knappen
    // sier heller hva den gjør. Er navnene ulike (et tiår, en sjanger), er
    // navnet det mest opplysende.
    const navn = rad.opphav[0].navn || "";
    const likt = navn.toLowerCase() === String(rad.tittel || "").toLowerCase();
    vei = `<button type="button" class="ref-kort" data-ref-rad="${i}" data-ref-opphav="0">${escapeHtml(likt ? "Åpne kortet" : navn)}</button>`;
  } else if (rad.opphav.length > 1) {
    vei = `<button type="button" class="ref-kort" data-ref-rad="${i}" data-ref-liste="1">${antallOrd(rad.opphav.length, "kort", "kort")}</button>`;
  }
  // Blyanten (v7.35): læreren retter eller sletter kilden overalt den står,
  // også blant de frittstående referansene (som før hadde «Rediger» her).
  if (kanRetteKilder()) {
    vei += `<button type="button" class="ref-kort ref-rett" data-ref-rad="${i}" data-ref-rett="1" title="Rett eller slett kilden overalt den står" aria-label="Rett kilden ${escapeHtml(rad.tittel)}">${BLYANT_SVG}</button>`;
  }

  let html = `<div class="ref-rad">${tittel}${merker}${vei}</div>`;
  if (rad.opphav.length > 1) {
    html += `<div class="ref-opphav" data-ref-opphavliste="${i}" style="display:none">` +
      rad.opphav.map((o, j) =>
        `<button type="button" class="ref-kort" data-ref-rad="${i}" data-ref-opphav="${j}">${escapeHtml(o.navn)}</button>`).join("") +
      `</div>`;
  }
  return html;
}

// Delegert klikkhåndtering for hele lista.
function wireRader(body) {
  body.addEventListener("click", (e) => {
    const knapp = e.target.closest("[data-ref-rad]");
    if (!knapp) return;
    const rad = radListe[Number(knapp.dataset.refRad)];
    if (!rad) return;
    if (knapp.dataset.refRett) {
      apneKildeRetting(rad, { etterLagring: () => renderReferanser({ bevar: true }) });
      return;
    }
    if (knapp.dataset.refListe) {
      const liste = body.querySelector(`[data-ref-opphavliste="${knapp.dataset.refRad}"]`);
      if (liste) liste.style.display = liste.style.display === "none" ? "flex" : "none";
      return;
    }
    apneOpphav(rad.opphav[Number(knapp.dataset.refOpphav)]);
  });
}

// `bevar` (v7.35): etter en retting tegnes lista på nytt med de samme
// nettstedene åpne og samme rulling, så læreren står der hen var.
export function renderReferanser({ bevar = false } = {}) {
  const body = document.getElementById("ref-body");
  if (!body) return;
  const boksFoer = document.getElementById("modal-referanser")?.querySelector(".modal");
  const apne = bevar ? [...body.querySelectorAll(".refp-group[data-ref-gruppe]")]
    .filter((g) => g.querySelector(".refp-group-head")?.getAttribute("aria-expanded") === "true")
    .map((g) => g.dataset.refGruppe) : [];
  const rull = bevar && boksFoer ? boksFoer.scrollTop : 0;
  const s = getState();
  const data = samleKilder(alleKilder());

  if (!data.totalt) {
    body.innerHTML = `<p class="gx-missing">${!s.artistsLoaded ? "Laster kilder …"
      : erLaererside() ? `Ingen kilder står her ennå. ${KRAV_TEKST}`
      : "Ingen kilder er registrert ennå."}</p>`;
    return;
  }

  radListe = [];
  let html = `<p class="muted" style="margin:0 0 6px;font-size:0.86rem">`;
  html += `${antallOrd(data.unike, "kilde", "kilder")} samlet fra artistkortene, tiårene, sjangrene, koblingene i slektstreet og innovasjonskortene.`;
  // Læreren får vite hvorfor en kilde kan mangle (v7.37).
  if (erLaererside()) html += ` ${KRAV_TEKST}`;
  html += `</p>`;

  // Seksjonene er overskrifter, ikke knapper: de står alltid åpne. Bare
  // nettstedene under «Nettsteder» har trekant, siden de kan romme hundrevis
  // av artikler hver.
  for (const seksjon of data.seksjoner) {
    html += `<h3 class="ref-seksjon" style="--ref-farge:${seksjon.farge}">`;
    html += `${escapeHtml(seksjon.navn)}<span class="ref-antall">${
      seksjon.unike ? antallOrd(seksjon.unike, "referanse", "referanser") : "ingen ennå"}</span></h3>`;

    if (!seksjon.unike) continue;

    if (seksjon.rader.length) {
      html += seksjon.rader.map((r) => radHtml(r, radListe.push(r) - 1, false)).join("");
      continue;
    }

    seksjon.grupper.forEach((g, gi) => {
      html += metaGroupHeadHtml({
        prefix: "refp", meta: g.navn, gColor: seksjon.farge, open: apne.includes(g.navn), groupIdx: gi, dot: false,
        metaAttr: ` data-ref-gruppe="${escapeHtml(g.navn)}"`,
        count: antallOrd(g.antall, "artikkel", "artikler"),
      });
      html += `<div class="refp-group-rows" style="display:${apne.includes(g.navn) ? "block" : "none"}">`;
      html += g.rader.map((r) => radHtml(r, radListe.push(r) - 1, !!g.samling)).join("");
      html += `</div></div>`;
    });
  }

  body.innerHTML = html;
  // Kun ett akkordeon-nivå igjen: nettstedene. Seksjonene er overskrifter.
  wireMetaAccordion(body, "refp");
  if (!body.dataset.wired) { wireRader(body); body.dataset.wired = "1"; }
  const boks = document.getElementById("modal-referanser").querySelector(".modal");
  if (boks) boks.scrollTop = rull;
}
