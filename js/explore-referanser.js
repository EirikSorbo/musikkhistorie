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
import { modalOpen, escapeHtml } from "./ui.js?v=4.41";
import { isVisible } from "./limits.js?v=4.41";
import { samleKilder } from "./kilder.js?v=4.41";
import { getState, metaGroupHeadHtml, wireMetaAccordion } from "./explore-context.js?v=4.41";

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
  const legg = (arr) => { if (Array.isArray(arr)) for (const k of arr) if (k) ut.push(k); };

  for (const a of (s.artists || []).filter(isVisible)) legg(a.kilder);
  for (const d of Object.values(s.decadeDescs || {})) legg(d && d.kilder);
  for (const g of Object.values(s.genreDescs || {})) {
    if (!g) continue;
    for (const niva of ["meta", "main", "sub"]) legg(g[niva] && g[niva].kilder);
  }
  for (const t of s.techItems || []) legg(t && t.kilder);
  // Frittstående referanser: bor i content-samlingen, som allerede lastes.
  legg(s.content && s.content.referanser && s.content.referanser.kilder);
  return ut;
}

const antallOrd = (n, ental, flertall) => `${n} ${n === 1 ? ental : flertall}`;

// Én referanse. Kilder uten lenke (bøker, tidsskriftartikler) er ren tekst —
// resten er utgående lenke til selve artikkelen.
function radHtml(rad, visSted) {
  const bruk = rad.bruk > 1 ? `<span class="ref-merk">×${rad.bruk}</span>` : "";
  const spraak = rad.spraak ? `<span class="ref-merk">${escapeHtml(rad.spraak)}</span>` : "";
  const sted = visSted && rad.sted ? `<span class="ref-merk">${escapeHtml(rad.sted)}</span>` : "";
  const tittel = rad.url
    ? `<a href="${escapeHtml(rad.url)}" target="_blank" rel="noopener">${escapeHtml(rad.tittel)}</a>`
    : escapeHtml(rad.tittel);
  return `<div class="ref-rad">${tittel}${spraak}${sted}${bruk}</div>`;
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
      html += seksjon.rader.map((r) => radHtml(r, false)).join("");
      continue;
    }

    seksjon.grupper.forEach((g, gi) => {
      html += metaGroupHeadHtml({
        prefix: "refp", meta: g.navn, gColor: seksjon.farge, open: false, groupIdx: gi, dot: false,
        count: antallOrd(g.antall, "artikkel", "artikler"),
      });
      html += `<div class="refp-group-rows" style="display:none">`;
      html += g.rader.map((r) => radHtml(r, !!g.samling)).join("");
      html += `</div></div>`;
    });
  }

  body.innerHTML = html;
  // Kun ett akkordeon-nivå igjen: nettstedene. Seksjonene er overskrifter.
  wireMetaAccordion(body, "refp");
  const boks = document.getElementById("modal-referanser").querySelector(".modal");
  if (boks) boks.scrollTop = 0;
}
