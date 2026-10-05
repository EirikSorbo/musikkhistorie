// ============================================================================
//  PLATESELSKAPENE — oversikten og kortet for hvert selskap (v6.37)
// ----------------------------------------------------------------------------
//  Tretten selskaper med eget kort (lista bor i js/felles/plateselskaper.js).
//  Kortet har fakta øverst, teksten med artistene i appen i høyrespalta (samme
//  form som instrumentkortet), en spilleliste og kildene nederst. Teksten,
//  faktaene og kildene bor i content/plateselskap-<id>, og det finnes ingen
//  reservetekst i koden. Artistene og spillelista avledes av artistenes
//  plateselskapsfelt, så de følger med når et artistkort endres.
//
//  Oversikten står i tidsrekkefølge etter grunnleggelsesåret. Begge er skjult
//  for studentene til læreren slår dem på (plateselskapeneSynlige), og læreren
//  sjekker kortene i Oversikten på lærersiden (ui-dashboard.js).
// ============================================================================
import { escapeHtml, buildKilderList } from "../felles/util.js";
import { isVisible, byInfluenceThenName } from "../felles/limits.js";
import { pageFor } from "../felles/story-format.js";
import { renderRichText } from "../felles/rich-text.js";
import { wireLinks, wireRelated, factsHtml } from "../ui/ui-helpers.js";
import { openArtistsPlaylistModal, countArtistExamples } from "../ui/ui.js";
import { META_GENRE_COLOR } from "../sjangre/genre-model.js";
import { modalOpen } from "../ui/ui-modal.js";
import {
  PLATESELSKAPER, finnSelskapId, plateselskapSideId, artisterForSelskap, selskaperSortert,
  plateselskapeneSynlige, grunnlagtAar,
} from "../felles/plateselskaper.js";
import { buildLinkCtx, injectTeacherRow } from "./explore-context.js";
import { medSelv } from "../felles/linkify.js";
import { opts, getState } from "../data/app-state.js";

const erApen = (id) => !!document.getElementById(id)?.classList.contains("open");
const sideFor = (id) => getState().content?.[plateselskapSideId(id)] || null;

// Artistene kortet viser. Studentene ser de synlige; læreren ser også kortene
// som er satt til skjult, merket som det, så hen ser hele bildet under
// gjennomgangen. Ventende forslag er aldri med.
function artisterPaaKortet(id) {
  const s = getState();
  const alle = artisterForSelskap(s.artists, id).filter((a) => a.status === "active");
  const liste = s.isTeacher ? alle : alle.filter(isVisible);
  return [...liste].sort(byInfluenceThenName);
}

// «1957 i Memphis, Tennessee», eller det av de to som finnes.
function grunnlagtTekst(f) {
  if (f?.grunnlagt && f?.sted) return `${f.grunnlagt} i ${f.sted}`;
  return f?.grunnlagt || f?.sted || "";
}

// ---------------------------------------------------------------------------
//  Kortet for ett selskap
// ---------------------------------------------------------------------------
let aapentId = null;
let sisteSignatur = null;

function tegnKort(tvunget = false) {
  const p = finnSelskapId(aapentId);
  const body = document.getElementById("ps-body");
  if (!p || !body) return;
  const s = getState();
  const sideId = plateselskapSideId(p.id);
  const doc = sideFor(p.id);
  const artister = artisterPaaKortet(p.id);

  // Kortet tegnes av hvert snapshot (artister og innhold). Uten vakten ville
  // en lagring et helt annet sted rullet kortet til toppen midt i lesingen.
  const signatur = JSON.stringify([
    p.id,
    artister.map((a) => [a.id, a.name, a.metaGenre, a.mainGenre, a.influenceStart, a.priority]),
    doc, !!s.contentLoaded, !!s.isTeacher,
  ]);
  if (!tvunget && signatur === sisteSignatur && body.childElementCount) return;
  sisteSignatur = signatur;

  const modal = document.getElementById("modal-plateselskap");
  if (modal) modal.dataset.vis = `plateselskap:${p.id}`;
  const tittel = document.getElementById("ps-tittel");
  if (tittel) tittel.textContent = p.navn;

  const side = pageFor(sideId, s.content);
  const f = doc?.fakta || {};
  const fakta = factsHtml([
    ["Grunnlagt", grunnlagtTekst(f)],
    ["Grunnlagt av", f.grunnleggere],
    ["I drift", f.virketid],
  ]);

  // Spillelista: lytteeksemplene til de synlige artistene, også for læreren,
  // så knappen viser det studentene får.
  const synlige = artister.filter(isVisible);
  const nEks = countArtistExamples(synlige);

  const KORT_LISTE = 12;
  const artistRad = (a) => {
    const sjangre = (a.mainGenre || []).filter(Boolean);
    const sjanger = sjangre.length ? sjangre.join(", ") : (a.metaGenre || "");
    const farge = META_GENRE_COLOR[a.metaGenre];
    const skjult = !isVisible(a);
    return `<li><button type="button" class="instr-artist${skjult ? " ps-skjult" : ""}" data-related-id="${escapeHtml(String(a.id))}">
      ${a.influenceStart ? `<span class="ps-artist-aar">${escapeHtml(String(a.influenceStart))}</span>` : ""}
      <span class="instr-artist-navn">${escapeHtml(a.name || "(uten navn)")}${skjult ? ` <span class="ps-skjult-merke">skjult</span>` : ""}</span>
      ${sjanger ? `<span class="instr-artist-sjanger"${farge ? ` style="--fam:${escapeHtml(farge)}"` : ""}>${escapeHtml(sjanger)}</span>` : ""}
    </button></li>`;
  };

  body.innerHTML = `
    ${fakta}
    <div class="instr-knapper">
      <div class="instr-knappegruppe">
        ${nEks ? `<button type="button" class="btn ghost small" data-ps-spilleliste>Spilleliste (${nEks})</button>` : ""}
      </div>
      <div class="instr-knappegruppe">
        <button type="button" class="btn ghost small" data-ps-alle>Alle plateselskaper <span aria-hidden="true">›</span></button>
      </div>
    </div>
    <div class="instr-topp">
      <div class="instr-sum"><div class="ps-tekst story-body"></div></div>
      ${artister.length ? `<aside class="instr-side${artister.length <= KORT_LISTE ? " instr-side--kort" : ""}" aria-label="Artister i appen">
        <div class="instr-side-ramme">
          <h4 class="related-head">Artister i appen <span class="instr-side-tall">${synlige.length}</span></h4>
          <ul class="instr-artister">${artister.map(artistRad).join("")}</ul>
        </div>
      </aside>` : ""}
    </div>
    <div class="instr-kilder">${side ? buildKilderList(side.kilder, "Kilder") : ""}</div>`;

  const tekst = body.querySelector(".ps-tekst");
  // De andre selskapene blir lenker i teksten (v6.38), kortets eget navn ikke.
  // Bare her: se plateselskaper i linkify.js.
  const lc = medSelv({ ...buildLinkCtx(), plateselskaper: PLATESELSKAPER, onPlateselskapClick: (id) => openPlateselskap(id) }, { plateselskap: p.id });
  if (side?.body?.trim()) {
    tekst.innerHTML = renderRichText(side.body, lc);
    wireLinks(tekst, lc);
  } else {
    tekst.innerHTML = `<p class="gx-missing">${s.contentLoaded
      ? "Teksten er ikke lagt inn ennå."
      : "Laster innhold …"}</p>`;
  }
  wireRelated(body, lc);

  body.querySelector("[data-ps-spilleliste]")?.addEventListener("click", () =>
    openArtistsPlaylistModal(`Spilleliste: ${p.navn}`, artisterPaaKortet(p.id).filter(isVisible)));
  body.querySelector("[data-ps-alle]")?.addEventListener("click", () => openPlateselskaper());

  // Lærer: Sjekk + Rediger (delt knapperad). Sjekken lagres i
  // config/teacherChecks under «plateselskaper», samme liste som Oversikten.
  injectTeacherRow(document.getElementById("ps-extra"), {
    category: "plateselskaper",
    id: p.id,
    onEdit: opts.onPageEdit ? () => opts.onPageEdit(sideId) : null,
  });
}

export function openPlateselskap(id) {
  if (!plateselskapeneSynlige()) return;
  const p = finnSelskapId(id);
  const modal = document.getElementById("modal-plateselskap");
  if (!p || !modal) return;
  aapentId = p.id;
  tegnKort(true);
  modalOpen(modal);
}

// ---------------------------------------------------------------------------
//  Oversikten
// ---------------------------------------------------------------------------
function tegnOversikt() {
  const el = document.getElementById("pss-body");
  if (!el) return;
  const kort = selskaperSortert(sideFor).map((p) => {
    const f = sideFor(p.id)?.fakta || {};
    const aar = grunnlagtAar(sideFor(p.id));
    const n = artisterPaaKortet(p.id).filter(isVisible).length;
    const linje = [f.sted, n ? `${n} ${n === 1 ? "artist" : "artister"} i appen` : ""].filter(Boolean).join(" · ");
    return `<li><button type="button" class="pss-kort" data-ps-id="${escapeHtml(p.id)}">
      <span class="pss-aar">${aar || ""}</span>
      <span class="pss-tekst">
        <span class="pss-navn">${escapeHtml(p.navn)}</span>
        ${linje ? `<span class="pss-linje">${escapeHtml(linje)}</span>` : ""}
      </span>
    </button></li>`;
  }).join("");
  el.innerHTML = `<ol class="pss-liste">${kort}</ol>`;
  el.querySelectorAll("[data-ps-id]").forEach((b) =>
    b.addEventListener("click", () => openPlateselskap(b.dataset.psId)));
}

export function openPlateselskaper() {
  if (!plateselskapeneSynlige()) return;
  const modal = document.getElementById("modal-plateselskaper");
  if (!modal) return;
  tegnOversikt();
  modalOpen(modal);
}

// Tegner de åpne vinduene på nytt når artistene eller innholdet endres.
// No-op for det som er lukket, så sidene kan kalle den fra ethvert snapshot.
export function renderPlateselskaper() {
  if (erApen("modal-plateselskaper")) tegnOversikt();
  if (erApen("modal-plateselskap")) tegnKort();
}
