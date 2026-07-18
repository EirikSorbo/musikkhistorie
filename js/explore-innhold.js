// ============================================================================
//  INNHOLDSSIDER, SJANGERHISTORIER, HUB & SJANGERHIMMEL
// ----------------------------------------------------------------------------
//  «Det store bildet»-huben og innholdssidene (Om historie, Røtter, app-guide,
//  sjangerhistorier). Sjangerhimmelen (konstellasjonsvisningen) bor her fordi
//  huben er inngangen til den. Flyttet ut av explore.js (v3.55, runde 2).
//  currentStoryGenre er modul-tilstand her.
// ============================================================================
import { modalOpen, escapeHtml } from "./ui.js?v=3.67";
import { isVisible } from "./limits.js?v=3.67";
import { META_GENRE_COLOR, FAMILIES } from "./genealogy.js?v=3.67";
import { pageFor, renderStoryHtml, storyFor, STORY_ORDER } from "./story-format.js?v=3.67";
import { wireLinks } from "./ui-helpers.js?v=3.67";
import { renderSjangerhimmel } from "./constellation.js?v=3.67";
import { opts, getState, buildLinkCtx, injectTeacherRow, onMainGenreClick } from "./explore-context.js?v=3.67";

// Samleinngang for «vis meg helheten»: alle tidslinjer og visuelle oversikter
// bak ett dashbordkort, uten at de flyttes fra innholdsmodalene sine.
export function openStoreBildet() {
  modalOpen(document.getElementById("modal-store-bildet"));
}

// Bruksveiledningen: teksten bor i Firestore (content/appGuide) og rendres ved
// hver åpning — samme mønster som Om historie/Røtter, med Rediger-knapp for
// lærer. Åpnes OPPÅ huben som de andre kortene, så ← går tilbake dit.
export function openAppGuide() {
  const modal = document.getElementById("modal-app-guide");
  if (!modal) return;
  renderPage("appGuide", "app-guide-body", "app-guide-extra");
  modalOpen(modal);
}

// Innholdssidene «Om historie» (omHistorie) og «Røtter før 1910» (rotter):
// teksten bor i Firestore (content/<id>.body, markdown-light) og rendres ved
// hver åpning, så import/redigering slår gjennom umiddelbart. INGEN fallback-
// tekst i koden (brukervalg) — mangler teksten, sies det tydelig ifra i
// stedet for å vise en utdatert reserve.
export function renderPage(pageId, bodyElId, extraElId) {
  const body = document.getElementById(bodyElId);
  if (!body) return;
  const s = getState();
  const page = pageFor(pageId, s.content);
  if (page) {
    const lc = buildLinkCtx();
    body.innerHTML = renderStoryHtml(page.body, lc);
    wireLinks(body, lc);
  } else {
    body.innerHTML = `<p class="gx-missing">${s.contentLoaded
      ? "Teksten er ikke lagt inn ennå. Læreren legger den inn via innholds-importen eller Rediger-knappen."
      : "Laster innhold …"}</p>`;
  }
  // Lærer: Sjekk + Rediger over teksten (delt knapperad).
  injectTeacherRow(document.getElementById(extraElId), {
    category: "pages",
    id: pageId,
    onEdit: opts.onPageEdit ? () => opts.onPageEdit(pageId) : null,
  });
}

export function openOmHistorie() {
  const modal = document.getElementById("modal-om-historie");
  if (!modal) return;
  renderPage("omHistorie", "om-historie-body", "omh-extra");
  modalOpen(modal);
}

export function openRotter() {
  const modal = document.getElementById("modal-rotter");
  if (!modal) return;
  renderPage("rotter", "rotter-body", "rotter-extra");
  modalOpen(modal);
}

// Sjangerhistoriene: teksten bor i Firestore (genreDescriptions/<sjanger>
// .story.body — importert eller lærer-redigert; se storyFor). INGEN
// standardtekst i koden. Rendres på nytt ved hvert chip-bytte OG hver åpning,
// så lærer-lagring slår gjennom umiddelbart. Artist-/sjangernavn i teksten
// lenkes og åpner kortene OPPÅ historien.
let currentStoryGenre = null;

function renderHistorie(genre) {
  currentStoryGenre = genre;
  const modal = document.getElementById("modal-historier");
  modal.querySelectorAll(".hist-chip").forEach((b) =>
    b.classList.toggle("active", b.dataset.story === genre));

  const story = storyFor(genre, getState().genreDescs);
  const lc = buildLinkCtx();
  const body = document.getElementById("hist-body");
  body.innerHTML = story
    ? renderStoryHtml(story.body, lc)
    : `<p class="gx-missing">Historien om ${escapeHtml(genre)} er ikke lagt inn ennå. Læreren legger den inn via innholds-importen eller Rediger-knappen.</p>`;
  wireLinks(body, lc);

  // Lærer: Sjekk (på hovedsjanger-nivå — historien ER hovedsjangerens innhold)
  // + Rediger, delt knapperad.
  injectTeacherRow(document.getElementById("hist-extra"), {
    category: "metaGenres",
    id: genre,
    onEdit: opts.onStoryEdit ? () => opts.onStoryEdit(genre) : null,
  });

  const box = modal.querySelector(".modal");
  if (box) box.scrollTop = 0;
}

export function openHistorier(genre) {
  const modal = document.getElementById("modal-historier");
  if (!modal) return;
  const chips = document.getElementById("hist-chips");
  if (!chips.dataset.filled) {
    // Hver hovedsjanger bærer sin egen farge fra slektstreet (META_GENRE_COLOR),
    // så knappene, treet, varmekartet og himmelen snakker samme fargespråk.
    // --hist-color settes per knapp; CSS bruker den til kant, tekst og fyll når
    // knappen er aktiv. Knappene ligger i et grid med like kolonner (se CSS).
    chips.innerHTML = STORY_ORDER.map((g) => {
      const color = META_GENRE_COLOR[g] || FAMILIES.gray.stroke;
      return `<button type="button" class="btn ghost small hist-chip" data-story="${escapeHtml(g)}" style="--hist-color:${color}">${escapeHtml(g)}</button>`;
    }).join("");
    chips.querySelectorAll(".hist-chip").forEach((b) =>
      b.addEventListener("click", () => renderHistorie(b.dataset.story)));
    chips.dataset.filled = "1";
  }
  renderHistorie(typeof genre === "string" ? genre : (currentStoryGenre || STORY_ORDER[0]));
  modalOpen(modal);
}

// Sjangerhimmelen: konstellasjonskartet rendres på nytt ved hver åpning (samme
// mønster som kartet), så det alltid speiler gjeldende artistdata. Artist- og
// sjangerklikk åpner de vanlige modalene OPPÅ himmelen — ← går tilbake hit.
export function openSjangerhimmel() {
  const modal = document.getElementById("modal-sjangerhimmel");
  if (!modal) return;
  renderSjangerhimmel(document.getElementById("sh-body"), getState().artists.filter(isVisible), {
    onArtistClick: opts.onArtistClick,
    onGenreClick: onMainGenreClick,
  });
  modalOpen(modal);
}
