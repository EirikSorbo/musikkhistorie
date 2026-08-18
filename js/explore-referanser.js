// ============================================================================
//  REFERANSER: alle kildene appen bygger på, samlet
// ----------------------------------------------------------------------------
//  Kortet er en AVLEDNING av dataene, ikke innhold: ingenting skrives eller
//  redigeres her. Kildene hentes fra det som allerede ligger i minnet
//  (artister, tiår, sjangre, innovasjonskort) og regnes om ved hver åpning, så
//  listen aldri kan bli utdatert. Slektstreets koblingskilder er bevisst holdt
//  utenfor: de bor i en samling studentappen ellers ikke laster, og ville kostet
//  80 ekstra dokumentlesninger per økt. De vises på hver kobling i treet.
//  Grupperingen (kategori → hovedkilde → artikkel) kommer fra kilder.js.
// ============================================================================
import { modalOpen, escapeHtml } from "./ui.js?v=4.39";
import { isVisible } from "./limits.js?v=4.39";
import { samleKilder } from "./kilder.js?v=4.39";
import { getState, metaGroupHeadHtml, wireMetaAccordion } from "./explore-context.js?v=4.39";

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
  return ut;
}

const antallOrd = (n, ental, flertall) => `${n} ${n === 1 ? ental : flertall}`;

function radHtml(rad, visSted) {
  const bruk = rad.bruk > 1 ? `<span class="ref-merk">×${rad.bruk}</span>` : "";
  const spraak = rad.spraak ? `<span class="ref-merk">${escapeHtml(rad.spraak)}</span>` : "";
  const sted = visSted ? `<span class="ref-merk">${escapeHtml(rad.sted)}</span>` : "";
  return `<div class="ref-rad"><a href="${escapeHtml(rad.url)}" target="_blank" rel="noopener">${escapeHtml(rad.tittel)}</a>${spraak}${sted}${bruk}</div>`;
}

function renderReferanser() {
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

  let html = `<p class="muted" style="margin:0 0 14px;font-size:0.86rem">`;
  html += `${antallOrd(data.unike, "kilde", "kilder")} samlet fra artistkortene, tiårene, sjangrene og innovasjonskortene. `;
  html += `Trykk på en linje for å se hva som er brukt.</p>`;

  data.kategorier.forEach((kat, i) => {
    const apen = i === 0;
    html += metaGroupHeadHtml({
      prefix: "ref", meta: kat.navn, gColor: kat.farge, open: apen, groupIdx: i,
      count: antallOrd(kat.unike, "kilde", "kilder"),
    });
    html += `<div class="ref-group-rows" style="display:${apen ? "block" : "none"}">`;

    kat.grupper.forEach((g, gi) => {
      if (!g.rader.length) {
        // Bøker, notater og kringkasting har ingen artikler å åpne: hele
        // referansen ER linja.
        const bruk = g.bruk > 1 ? `<span class="ref-merk">brukt ${g.bruk} steder</span>` : "";
        html += `<div class="ref-line">${escapeHtml(g.navn)}${bruk}</div>`;
        return;
      }
      html += metaGroupHeadHtml({
        prefix: "refp", meta: g.navn, gColor: kat.farge, open: false, groupIdx: gi,
        count: g.samling
          ? antallOrd(g.antall, "nettsted", "nettsteder")
          : antallOrd(g.antall, "artikkel", "artikler"),
      });
      html += `<div class="refp-group-rows" style="display:none">`;
      html += g.rader.map((r) => radHtml(r, !!g.samling)).join("");
      html += `</div></div>`;
    });

    html += `</div></div>`;
  });

  body.innerHTML = html;
  // To nivåer, to prefikser: ytre akkordeon åpner kategorien, indre åpner
  // hovedkilden. Prefiksene deler ingen klassenavn, så de to lagene styrer
  // hver sin gruppe uten å tråkke på hverandre.
  wireMetaAccordion(body, "ref");
  wireMetaAccordion(body, "refp");
  const boks = document.getElementById("modal-referanser").querySelector(".modal");
  if (boks) boks.scrollTop = 0;
}
