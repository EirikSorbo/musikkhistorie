// ============================================================================
//  REFERANSER: alle kildene appen bygger på, samlet
// ----------------------------------------------------------------------------
//  Kortet er en AVLEDNING av dataene: kildene hentes fra det som allerede
//  ligger i minnet (artister, tiår, sjangre, innovasjonskort) og regnes om ved
//  hver åpning, så listen aldri kan bli utdatert. I tillegg kan læreren legge
//  inn frittstående referanser som ikke hører til noe kort (content/referanser,
//  «Ny referanse» på lærersiden) — de blandes inn i samme liste. Slektstreets koblingskilder er bevisst holdt
//  utenfor: de bor i en samling studentappen ellers ikke laster, og ville kostet
//  80 ekstra dokumentlesninger per økt. De vises på hver kobling i treet.
//  Grupperingen (kategori → hovedkilde → artikkel) kommer fra kilder.js.
// ============================================================================
import { modalOpen, escapeHtml } from "./ui.js?v=4.62";
import { isVisible } from "./limits.js?v=4.62";
import { samleKilder } from "./kilder.js?v=4.62";
import { opts, getState, metaGroupHeadHtml, wireMetaAccordion, onMainGenreClick } from "./explore-context.js?v=4.62";
import { openTechDetail } from "./explore-tech.js?v=4.62";
import { openDecade } from "./explore-decade.js?v=4.62";
import { openHistorier } from "./explore-innhold.js?v=4.62";

export function openReferanser() {
  const modal = document.getElementById("modal-referanser");
  if (!modal) return;
  renderReferanser();
  modalOpen(modal);
}

// Alle kilder fra de fire stedene de faktisk registreres. Sjangerbeskrivelsene
// har ett dokument per sjangernavn med egne felt per nivå (meta/main/sub), og
// hvert nivå har sine egne kilder.
function alleKilder() {
  const s = getState();
  const ut = [];
  // Hver kilde bærer med seg hvilket kort den kom fra, så listen kan åpne det.
  const legg = (arr, opphav) => { if (Array.isArray(arr)) for (const k of arr) if (k) ut.push({ ...k, opphav }); };

  for (const a of (s.artists || []).filter(isVisible)) legg(a.kilder, { type: "artist", id: a.id, navn: a.name });
  for (const [id, d] of Object.entries(s.decadeDescs || {})) legg(d && d.kilder, { type: "decade", id, navn: `${id}-tallet` });
  for (const [navn, g] of Object.entries(s.genreDescs || {})) {
    if (!g) continue;
    for (const niva of ["meta", "main", "sub"]) legg(g[niva] && g[niva].kilder, { type: "genre", id: navn, navn, niva });
  }
  for (const t of s.techItems || []) legg(t && t.kilder, { type: "tech", id: t.id, navn: t.name });
  // Frittstående referanser: bor i content-samlingen, som allerede lastes, og
  // har med vilje INGEN opphav — de hører ikke til noe kort.
  legg(s.content && s.content.referanser && s.content.referanser.kilder, null);
  return ut;
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
  } else if (o.type === "genre") {
    // Metasjangeren ER sjangerhistorien; de to andre nivåene har hvert sitt
    // sjangerkort (onMainGenreClick faller selv tilbake til undersjangeren).
    if (o.niva === "meta") openHistorier(o.navn);
    else onMainGenreClick(o.navn);
  }
}

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
  const bruk = rad.bruk > 1 ? `<span class="ref-merk">×${rad.bruk}</span>` : "";
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
  } else if (opts.onReferanseEdit) {
    // Frittstående referanse: ingen kort å åpne, men læreren skal kunne rette den.
    vei = `<button type="button" class="ref-kort" data-ref-rad="${i}" data-ref-rediger="1">Rediger</button>`;
  }

  let html = `<div class="ref-rad">${tittel}${merker}${bruk}${vei}</div>`;
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
    if (knapp.dataset.refRediger) { opts.onReferanseEdit(rad.url || rad.tittel); return; }
    if (knapp.dataset.refListe) {
      const liste = body.querySelector(`[data-ref-opphavliste="${knapp.dataset.refRad}"]`);
      if (liste) liste.style.display = liste.style.display === "none" ? "flex" : "none";
      return;
    }
    apneOpphav(rad.opphav[Number(knapp.dataset.refOpphav)]);
  });
}

export function renderReferanser() {
  const body = document.getElementById("ref-body");
  if (!body) return;
  const s = getState();
  const data = samleKilder(alleKilder());

  if (!data.totalt) {
    body.innerHTML = `<p class="gx-missing">${s.artistsLoaded
      ? "Ingen kilder er registrert ennå."
      : "Laster kilder …"}</p>`;
    return;
  }

  radListe = [];
  let html = `<p class="muted" style="margin:0 0 6px;font-size:0.86rem">`;
  html += `${antallOrd(data.unike, "kilde", "kilder")} samlet fra artistkortene, tiårene, sjangrene og innovasjonskortene.</p>`;

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
        prefix: "refp", meta: g.navn, gColor: seksjon.farge, open: false, groupIdx: gi, dot: false,
        count: antallOrd(g.antall, "artikkel", "artikler"),
      });
      html += `<div class="refp-group-rows" style="display:none">`;
      html += g.rader.map((r) => radHtml(r, radListe.push(r) - 1, !!g.samling)).join("");
      html += `</div></div>`;
    });
  }

  body.innerHTML = html;
  // Kun ett akkordeon-nivå igjen: nettstedene. Seksjonene er overskrifter.
  wireMetaAccordion(body, "refp");
  if (!body.dataset.wired) { wireRader(body); body.dataset.wired = "1"; }
  const boks = document.getElementById("modal-referanser").querySelector(".modal");
  if (boks) boks.scrollTop = 0;
}
