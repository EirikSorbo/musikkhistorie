// ============================================================================
//  METASJANGER-OVERSIKTEN (v5.94) — én side per aktiv metasjanger i visningen
// ----------------------------------------------------------------------------
//  Brukerønske 2026-10-01: en oversikt over familien til bruk på lerretet.
//  Sjangerperiodene og forbindelsene til andre familier står til venstre;
//  artistene og lytteeksemplene, gruppert per sjanger i familien, står i hver
//  sin rullbare spalte som fyller høyden, med «Spill alle» over eksemplene.
//
//  Først bare for visningsmodus; fra v6.05 (S2) metasjangerens side for alle.
//  Inngangene: «Oversikt ›» i Sjangre, metasjangermerket på artist- og
//  sjangerkortene, «Vis oversikt» i Sjangerhistoriene, appens søk (v6.15), og
//  som stopp i en kjøreplan (vis-verdien «oversikt:<navn>»). Ikke i heftet.
//
//  Utvalget og grupperingen bor i metaoversikt-modell.js (testet); her tegnes
//  og kobles det.
// ============================================================================
import { escapeHtml, modalOpen, spillAlleHtml } from "./ui.js?v=6.25";
import { safeUrl } from "./util.js?v=6.25";
import { GENEALOGY, META_GENRE_COLOR, FAMILIES } from "./genre-model.js?v=6.25";
import { genreFamilyNodes, nodeStartAar } from "./ui-timeline.js?v=6.25";
import { musicExampleLabel, wireRelated } from "./ui-helpers.js?v=6.25";
import { wireAllLinks } from "./linkify.js?v=6.25";
import { getState, buildLinkCtx, onMainGenreClick } from "./explore-context.js?v=6.25";
import { periodeFigurForMeta } from "./explore-sjangerperioder.js?v=6.25";
import { artisterGruppert, lytteeksemplerGruppert, forbindelser } from "./metaoversikt-modell.js?v=6.25";

// Sjangernavnene i forbindelsene: samme lenke som sjangrene i slektskapet på
// sjangerkortet (genealogy.js) og i beskrivelsene (linkify.js).
const sjLenke = (n) =>
  `<a class="genre-link" data-genre="${escapeHtml(n.l)}" tabindex="0" role="button">${escapeHtml(n.f || n.l)}</a>`;

// Gruppetittelen: sjangerens fulle navn fra treet («Contemporary jazz»).
const fulltNavn = (etikett) => GENEALOGY.find((n) => n.l === etikett)?.f || etikett;

export function openMetaOversikt(meta) {
  const modal = document.getElementById("modal-meta-oversikt");
  if (!modal || !meta) return;
  tegnMetaOversikt(meta, modal);
  modalOpen(modal);
}

function tegnMetaOversikt(meta, modal) {
  const s = getState();
  modal.dataset.vis = `oversikt:${meta}`;
  document.getElementById("mo-tittel").textContent = `Oversikt over ${meta}`;

  const familie = genreFamilyNodes(meta, s.genreDescs || {}).map(({ n }) => n.l);
  const artGr = artisterGruppert(meta, s.artists, familie);
  const eks = lytteeksemplerGruppert(s.artists, familie);
  const { fra, til } = forbindelser(meta, GENEALOGY, (n) => nodeStartAar(n, s.genreDescs));
  const figur = periodeFigurForMeta(meta);
  const antallArt = artGr.reduce((sum, g) => sum + g.artister.length, 0);

  const artisterHtml = artGr.length
    ? artGr.map((g) => `<h4 class="mo-gruppe">${escapeHtml(fulltNavn(g.sjanger))}</h4>
        <ul class="mo-liste">${g.artister.map((a) =>
          `<li><button type="button" class="sj-artist" data-related-id="${escapeHtml(String(a.id))}">${escapeHtml(a.name)}</button></li>`).join("")}</ul>`).join("")
    : `<p class="gx-missing">Ingen artister i ${escapeHtml(meta)} ennå.</p>`;

  const eksemplerHtml = eks.grupper.length
    ? eks.grupper.map((g) => `<h4 class="mo-gruppe">${escapeHtml(fulltNavn(g.sjanger))}</h4>
        <ul class="mo-liste">${g.eksempler.map((e) => {
          const url = safeUrl(e.url);
          const tittel = url
            ? `<a class="mo-eks-lenke" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(e.tittel)}</a>`
            : escapeHtml(e.tittel);
          return `<li class="mo-eks">${tittel}<span class="mo-aar">${escapeHtml(musicExampleLabel(e))}</span>`
            + `<span class="mo-eks-artist">${escapeHtml(e.artist)}</span></li>`;
        }).join("")}</ul>`).join("")
    : `<p class="gx-missing">Ingen lytteeksempler i ${escapeHtml(meta)} ennå.</p>`;

  const body = document.getElementById("mo-body");
  body.style.setProperty("--mo-farge", META_GENRE_COLOR[meta] || FAMILIES.gray?.stroke || "#9bada1");
  body.innerHTML = `
    <div class="mo-kol mo-hoved">
      <h3 class="mo-head">Sjangerperioder</h3>
      ${figur.html || `<p class="gx-missing">Ingen perioder å vise ennå.</p>`}
      ${fra.length || til.length ? `<h3 class="mo-head">Forbindelser</h3>
        ${fra.length ? `<p class="gx-rel"><strong>Vokste ut av:</strong> ${fra.map(sjLenke).join(", ")}</p>` : ""}
        ${til.length ? `<p class="gx-rel"><strong>Førte videre til:</strong> ${til.map(sjLenke).join(", ")}</p>` : ""}` : ""}
    </div>
    <section class="mo-kol mo-artister" aria-label="Artister">
      <h3 class="mo-head">Artister <span class="mo-antall">${antallArt}</span></h3>
      ${artisterHtml}
    </section>
    <section class="mo-kol mo-eksempler" aria-label="Lytteeksempler">
      <h3 class="mo-head">Lytteeksempler <span class="mo-antall">${eks.antall}</span></h3>
      ${spillAlleHtml(eks.rader)}
      ${eksemplerHtml}
    </section>`;

  // Stolpene og forbindelsene åpner sjangerkortet, navnene artistkortet, oppå
  // oversikten (← fører tilbake). Lytteeksemplene fanges av spilleren.
  body.querySelectorAll("[data-sp-open]").forEach((b) =>
    b.addEventListener("click", () => onMainGenreClick(b.dataset.spOpen)));
  const lc = buildLinkCtx();
  wireAllLinks(body, lc);
  wireRelated(body, lc);
  body.querySelectorAll(".mo-kol").forEach((k) => { k.scrollTop = 0; });
}
