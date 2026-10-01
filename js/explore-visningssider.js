// ============================================================================
//  VISNING — SPESIALSIDENE FOR VISNINGSMODUS (v5.96)
// ----------------------------------------------------------------------------
//  Brukerønske 2026-10-01: et eget «Visning»-kort i Det store bildet (bare på
//  lerretet, bare for læreren) som samler sidene som er laget for visning:
//   - oversikten over hver aktiv metasjanger (explore-metaoversikt.js)
//   - artistgalleriet for hver sjanger: alle artistbildene med navnet under,
//     uten kreditering. Åpnes også med «Galleri» på sjangerkortet (i appen
//     også, fra v5.97), og kan stå som stopp i en kjøreplan (galleri:<sjanger>).
//  Galleriet viser de samme artistene som «Artister»-knappen og navnelista på
//  sjangerkortet (artistsInGenre), i samme rekkefølge.
// ============================================================================
import { escapeHtml, modalOpen } from "./ui.js?v=6.00";
import { imgTag, wireRelated } from "./ui-helpers.js?v=6.00";
import { safeUrl } from "./util.js?v=6.00";
import { artistsInGenre } from "./limits.js?v=6.00";
import { GENEALOGY, META_GENRE_COLOR, FAMILIES } from "./genre-model.js?v=6.00";
import { genreFamilyNodes } from "./ui-timeline.js?v=6.00";
import { storyOrder } from "./story-format.js?v=6.00";
import { getState, buildLinkCtx } from "./explore-context.js?v=6.00";
import { openMetaOversikt } from "./explore-metaoversikt.js?v=6.00";

const metaFarge = (meta) => META_GENRE_COLOR[meta] || FAMILIES.gray?.stroke || "#9bada1";
const fulltNavn = (etikett) => GENEALOGY.find((n) => n.l === etikett)?.f || etikett;

// Samlesiden: knapper til oversiktene og galleriene, gruppert per metasjanger
// i historienes rekkefølge (bare de aktive; Pop og Rock er skjult).
export function openVisningssider() {
  const modal = document.getElementById("modal-visningssider");
  const body = document.getElementById("vs-body");
  if (!modal || !body) return;
  const s = getState();
  const metas = storyOrder(s.genreDescs || {});
  const knapp = (attr, verdi, tekst, meta) =>
    `<button type="button" class="btn ghost small vs-knapp" ${attr}="${escapeHtml(verdi)}" style="--vs-farge:${metaFarge(meta)}">${escapeHtml(tekst)}</button>`;
  body.innerHTML = `
    <h3 class="mo-head">Oversikt over metasjangrene</h3>
    <div class="vs-knapper">${metas.map((m) => knapp("data-oversikt", m, m, m)).join("")}</div>
    <h3 class="mo-head vs-galleri-head">Artistgalleri</h3>
    ${metas.map((m) => {
      const familie = genreFamilyNodes(m, s.genreDescs || {}).map(({ n }) => n);
      if (!familie.length) return "";
      return `<div class="vs-gruppe">
        <h4 class="vs-gruppe-navn" style="--vs-farge:${metaFarge(m)}">${escapeHtml(m)}</h4>
        <div class="vs-knapper">${familie.map((n) => knapp("data-galleri", n.l, n.f || n.l, m)).join("")}</div>
      </div>`;
    }).join("")}`;
  // Sidene åpnes OPPÅ samlesiden, så ← fører tilbake hit.
  body.querySelectorAll("[data-oversikt]").forEach((b) =>
    b.addEventListener("click", () => openMetaOversikt(b.dataset.oversikt)));
  body.querySelectorAll("[data-galleri]").forEach((b) =>
    b.addEventListener("click", () => openArtistGalleri(b.dataset.galleri)));
  modalOpen(modal);
}

// Galleriet for én sjanger (nodens etikett, som sjangerkortet bruker).
export function openArtistGalleri(sjanger) {
  const modal = document.getElementById("modal-galleri");
  const body = document.getElementById("ga-body");
  if (!modal || !body || !sjanger) return;
  modal.dataset.vis = `galleri:${sjanger}`;
  document.getElementById("ga-tittel").textContent = `Artistgalleri: ${fulltNavn(sjanger)}`;
  const artister = artistsInGenre(getState().artists, sjanger);
  body.innerHTML = artister.length
    ? `<ul class="ga-rutenett">${artister.map((a) => {
        const url = safeUrl(a.imageUrl);
        // Uten bilde: initialene i en rolig flate, så alle i sjangeren står med.
        const initialer = String(a.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((d) => d[0]).join("");
        const bilde = url
          ? imgTag(url, a.name, 500)
          : `<span class="ga-tom" aria-hidden="true">${escapeHtml(initialer)}</span>`;
        return `<li><button type="button" class="ga-kort" data-related-id="${escapeHtml(String(a.id))}">`
          + `<span class="ga-bilde">${bilde}</span><span class="ga-navn">${escapeHtml(a.name)}</span></button></li>`;
      }).join("")}</ul>`
    : `<p class="gx-missing">Ingen artister i ${escapeHtml(fulltNavn(sjanger))} ennå.</p>`;
  // Et bilde åpner artistkortet oppå galleriet (← tilbake hit).
  wireRelated(body, buildLinkCtx());
  modalOpen(modal);
  const boks = modal.querySelector(".modal");
  if (boks) boks.scrollTop = 0;
}
