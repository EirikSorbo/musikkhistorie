import { escapeHtml, formatInfoText, renderDecadeSections, renderTechList, renderTechDetail, TECH_CATEGORIES, openArtistListModal, openPlaylistModal, artistsInGenre, artistsByInstrument, showSubsjangerInfo, modalOpen, modalClose, setupModal, initModalHeaders, buildKilderList, buildMainGenreList } from "./ui.js?v=3.14";
import { GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, isMainGenre, showSjangerInfo, MAIN_GENRE_INFO, FAMILIES } from "./genealogy.js?v=3.14";
import { resolveDesc, missingDesc } from "./genre-descriptions.js?v=3.14";
import { isVisible } from "./limits.js?v=3.14";
import { podcastEpisodeHtml, wireLinks } from "./ui-helpers.js?v=3.14";
import { renderStoryHtml, storyFor, pageFor, STORY_ORDER } from "./story-format.js?v=3.14";
import { SJANGER_MODAL_HTML, ARTISTLISTE_MODAL_HTML, SPILLELISTE_MODAL_HTML, TECH_DETAIL_MODAL_HTML } from "./ui-modal-fragments.js?v=3.14";
import { resolveSpan, packLanes, timelineBounds } from "./timeline-lanes.js?v=3.14";
import { MAP_VIEW, MAP_COUNTRIES, projectPoint } from "./geo-map-data.js?v=3.14";
import { aggregatePlaces, unknownPlaces } from "./geo-places.js?v=3.14";
import { renderSjangerhimmel } from "./constellation.js?v=3.14";

// Varmekart: mainGenre (rad) × tiår (kolonne). Radene hentes dynamisk fra
// treet (GENEALOGY_MAIN_GENRES) — nye sjangre dukker opp automatisk.
// «Varmen» er redaksjonell: nivå 0–5 for hvor toneangivende sjangeren var det
// tiåret. Nivåene bor i Firestore (content/varmekart.heat, importert fra
// innholds-JSON eller redigert via celleklikk som lærer) — sjangre uten data
// vises som «ingen data».
const VK_DECADES = [1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
// Cellene fargelegges i hver sjangers familiefarge (fra slektstreet), mens
// varmenivået (0–5) styrer lysheten: lyst = lite toneangivende, mørkt = mye.
// Slik bærer ruten to akser samtidig — hvilken familie (kulør) og hvor sterk
// (valør). VK_INK er en nøytral grå brukt i nivå-forklaringen.
const VK_INK = "#5b6b7a";
const hexToRgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgbToHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function heatColor(famHex, level) {
  const base = hexToRgb(famHex), white = [255, 255, 255], black = [0, 0, 0];
  const t = level / 5;                              // 0 (lys) … 1 (mørk)
  const tint = mix(white, base, 0.12 + 0.88 * t);  // hvitt → familiefarge
  return rgbToHex(mix(tint, black, 0.12 * t));      // mørkne toppen litt for valør
}
const MODAL_HTML = `
<!-- Teknologi -->
<div class="modal-backdrop" id="modal-teknologi">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Teknologiske innovasjoner</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="tek-admin-extra"></div>
    <div class="tech-category-tabs">
      <button class="btn ghost small tech-tab active" data-tech-cat="">Alle</button>
      <button class="btn ghost small tech-tab" data-tech-cat="Opptak og avspilling">Opptak</button>
      <button class="btn ghost small tech-tab" data-tech-cat="Kringkasting og spredning">Kringkasting</button>
      <button class="btn ghost small tech-tab" data-tech-cat="Instrumenter og lydutstyr">Instrumenter</button>
    </div>
    <div id="tech-list" class="tech-grid"></div>
  </div>
</div>

<!-- Podkast -->
<div class="modal-backdrop" id="modal-podkast">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Podkast</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="podkast-list" class="podkast-list"></div>
  </div>
</div>

<!-- Tiår-liste -->
<div class="modal-backdrop" id="modal-decade-list">
  <div class="modal">
    <div class="modal-head">
      <h2>Kontekst</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="dl-tech-extra"></div>
    <p class="muted" style="margin-bottom:14px;font-size:0.9rem">Velg et tiår for å lese mer.</p>
    <div id="dl-buttons" class="explore-decade-grid"></div>
  </div>
</div>

<!-- Enkelt tiår (les) -->
<div class="modal-backdrop" id="modal-decade-view">
  <div class="modal">
    <div class="modal-head">
      <h2 id="dv-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div class="info-section" id="dv-society-section">
      <h4 class="info-label">Samfunnsutvikling</h4>
      <div id="dv-society-timeline"></div>
      <div id="dv-society" class="info-text"></div>
      <button class="btn ghost small" id="dv-society-more" style="display:none">Les mer</button>
      <button class="btn ghost small" id="dv-society-propose" style="display:none;margin-left:6px">Foreslå endring</button>
    </div>
    <div class="info-section" id="dv-tech-section">
      <h4 class="info-label">Teknologiutvikling</h4>
      <div id="dv-tech-timeline"></div>
      <div id="dv-tech" class="info-text"></div>
      <button class="btn ghost small" id="dv-tech-more" style="display:none">Les mer</button>
      <button class="btn ghost small" id="dv-tech-propose" style="display:none;margin-left:6px">Foreslå endring</button>
    </div>
    <div id="dv-kilder"></div>
    <div style="margin-top:16px">
      <button class="btn ghost small" id="dv-back">← Tilbake til oversikt</button>
    </div>
  </div>
</div>

<!-- Utvidet tiårsbeskrivelse -->
<div class="modal-backdrop" id="modal-decade-more">
  <div class="modal">
    <div class="modal-head">
      <h2 id="dm-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="dm-text" class="info-text"></div>
  </div>
</div>

<!-- Varmekart: supersjanger × tiår -->
<div class="modal-backdrop" id="modal-varmekart">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Tyngdepunkt gjennom tiårene</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:16px;font-size:0.9rem">Hvor sjangrenes tyngdepunkt lå, tiår for tiår — gruppert etter hovedsjanger. Mørkere = mer toneangivende.</p>
    <div id="vk-body"></div>
  </div>
</div>

<!-- Varmekart-redigering (lærer): klikk på en celle åpner nivåvelgeren -->
<div class="modal-backdrop" id="modal-vk-edit">
  <div class="modal" style="max-width:400px">
    <div class="modal-head">
      <h2 id="vke-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:12px;font-size:0.86rem">Hvor toneangivende var sjangeren dette tiåret? 0 = ikke toneangivende, 5 = mest. «Ingen data» fjerner verdien.</p>
    <div id="vke-buttons" style="display:flex;gap:8px;flex-wrap:wrap"></div>
    <div id="vke-msg" class="form-msg" style="margin-top:10px"></div>
  </div>
</div>

<!-- Kart: musikkens geografi (Nord-Amerika + utenfor-kartet-chips) -->
<div class="modal-backdrop" id="modal-kart">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Musikkens geografi</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:12px;font-size:0.9rem">Hvor artistene virket. Større prikk = flere artister; stiplet ring = diffust område (f.eks. en delstat). Storbyområder er samlet (Brooklyn → New York). Velg et tiår for å se tyngdepunktet flytte seg — trykk på en prikk for artistene.</p>
    <div id="kart-decades" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"></div>
    <div id="kart-svg"></div>
    <div id="kart-abroad" style="margin-top:14px"></div>
    <div id="kart-footer" style="margin-top:10px;font-size:0.78rem;color:var(--muted)"></div>
  </div>
</div>

<!-- Sjangerhimmel: konstellasjonskart — artister som satellitter rundt
     sjangrene sine; bro-artister spennes ut mellom klyngene (constellation.js) -->
<div class="modal-backdrop" id="modal-sjangerhimmel">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Sjangerhimmelen</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:10px;font-size:0.88rem">Sjangrene står i slektstreets rekkefølge. Klikk (eller trykk på) en stjerne — sjangerens artister spretter frem, forbundet med stjernen. Hold musen over en prikk for navnet; klikk prikken for artistkortet. «Alle broer» viser artistene som hører til flere sjangre.</p>
    <div id="sh-body"></div>
  </div>
</div>

<!-- Tidslinje: når var artistene aktive, gruppert per sjanger -->
<div class="modal-backdrop" id="modal-tidslinje">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Tidslinje — når var artistene aktive?</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:16px;font-size:0.9rem">Hver blokk er en artists aktive periode — gruppert etter hovedsjanger. Flat høyrekant med › betyr at perioden pågår eller mangler sluttår. Trykk på en blokk for å åpne artistkortet.</p>
    <div id="tid-body"></div>
  </div>
</div>

<!-- Sjangere-liste -->
<div class="modal-backdrop" id="modal-subgenre-list">
  <div class="modal">
    <div class="modal-head">
      <h2>Sjangre</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="sl-extra"></div>
    <p class="muted" style="margin-bottom:14px;font-size:0.9rem" id="sl-hint">Trykk på en sjanger for å lese beskrivelsen.</p>
    <div id="sl-chips" class="subgenre-tag-list"></div>
  </div>
</div>

<!-- Undersjangre (åpnes fra Sjangre-modalen, oppå den) -->
<div class="modal-backdrop" id="modal-undersjangre">
  <div class="modal">
    <div class="modal-head">
      <h2>Undersjangre</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:14px;font-size:0.9rem">Trykk på en undersjanger for å lese beskrivelsen.</p>
    <div id="ul-chips" class="subgenre-tag-list"></div>
  </div>
</div>

<!-- Sjanger-info -->
<div class="modal-backdrop" id="modal-subgenre-info">
  <div class="modal">
    <div class="modal-head">
      <h2 id="sgi-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p id="sgi-desc"></p>
    <div id="sgi-artists"></div>
    <div id="sgi-extra"></div>
  </div>
</div>

<!-- Artistliste, spilleliste, sjanger-beskrivelse og teknologi-detalj deles
     med slektstresiden (tre.js) — markupen bor i ui-modal-fragments.js. -->
${ARTISTLISTE_MODAL_HTML}

${SPILLELISTE_MODAL_HTML}

${SJANGER_MODAL_HTML}

${TECH_DETAIL_MODAL_HTML}

<!-- Det store bildet: samleinngang til alle tidslinjer og visuelle oversikter.
     Målene bor fortsatt der de alltid har bodd (Artister, Sjangre, tiårene) —
     dette er bare én ekstra dør inn, for den som tenker «vis meg helheten»
     i stedet for «vis meg artister». Gjenbruker dash-kort-utseendet så
     modalen leses som et mini-dashbord. -->
<div class="modal-backdrop" id="modal-store-bildet">
  <div class="modal">
    <div class="modal-head">
      <h2>Det store bildet</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin-bottom:14px;font-size:0.9rem">Tidslinjer, kart og visuelle oversikter — hele historien samlet på ett sted.</p>
    <div class="dash-grid">
      <button class="dash-card" id="sb-om-historie">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#4d7c0f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12M6 22h12"/><path d="M8 2v4l4 4 4-4V2"/><path d="M8 22v-4l4-4 4 4v4"/></svg>
        <span class="dash-title">Om historie</span>
        <span class="dash-desc">Hvorfor musikkhistorie — og hva en historie egentlig er</span>
      </button>
      <button class="dash-card" id="sb-rotter">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v8"/><path d="M12 11c0 3-2.5 4.5-4 7"/><path d="M12 11c0 3 2.5 4.5 4 7"/><path d="M12 11v7"/><circle cx="12" cy="19.5" r="1.3"/><circle cx="7.5" cy="18.5" r="1.3"/><circle cx="16.5" cy="18.5" r="1.3"/></svg>
        <span class="dash-title">Røtter</span>
        <span class="dash-desc">Opphavet før 1910 — der alt begynner</span>
      </button>
      <button class="dash-card" id="sb-historier">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        <span class="dash-title">Sjangerhistorier</span>
        <span class="dash-desc">Seks fortellinger — hele pensumet i sammenheng</span>
      </button>
      <button class="dash-card" id="sb-tidslinje">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h8M9 12h12M5 17h10"/></svg>
        <span class="dash-title">Tidslinje</span>
        <span class="dash-desc">Artistenes aktive år, bane for bane</span>
      </button>
      <button class="dash-card" id="sb-slektstre">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><circle cx="5" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="19" cy="20" r="2"/><path d="M12 6v5M12 11c-4 0-7 3-7 7M12 11c4 0 7 3 7 7M12 11v7"/></svg>
        <span class="dash-title">Slektstre</span>
        <span class="dash-desc">Sjangrenes slektskap fra røtter til i dag</span>
      </button>
      <button class="dash-card" id="sb-varmekart">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
        <span class="dash-title">Varmekart</span>
        <span class="dash-desc">Hvor toneangivende sjangrene var, tiår for tiår</span>
      </button>
      <button class="dash-card" id="sb-kart">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="dash-title">Kart</span>
        <span class="dash-desc">Musikkens geografi tiår for tiår</span>
      </button>
      <button class="dash-card" id="sb-himmel">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"/><circle cx="19" cy="9" r="2.2"/><circle cx="11" cy="19" r="2.2"/><path d="M8.1 6.5l8.7 2M17.7 10.7l-5.5 6.5M6.8 8.1l3.5 8.8"/></svg>
        <span class="dash-title">Sjangerhimmel</span>
        <span class="dash-desc">Artistene som stjernebilder rundt sjangrene sine</span>
      </button>
    </div>
  </div>
</div>

<!-- Innholdssidene «Om historie» og «Røtter før 1910»: teksten bor i
     Firestore (content/omHistorie og content/rotter, markdown-light) og
     rendres ved hver åpning — ingen hardkodet tekst i koden. Foten er
     navigasjon (kode), ikke innhold. -->
<div class="modal-backdrop" id="modal-om-historie">
  <div class="modal">
    <div class="modal-head">
      <h2>Om historie</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="omh-extra"></div>
    <div id="om-historie-body" class="story-body"></div>
    <div class="rotter-foot">
      <p class="muted">Klar for selve historien? Start der alt begynner.</p>
      <div class="rotter-links">
        <button class="btn ghost" id="omh-rotter">Røtter før 1910</button>
        <button class="btn ghost" id="omh-historier">Sjangerhistoriene</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-backdrop" id="modal-rotter">
  <div class="modal">
    <div class="modal-head">
      <h2>Røtter før 1910</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="rotter-extra"></div>
    <div id="rotter-body" class="story-body"></div>
    <div class="rotter-foot">
      <p class="muted">Røttene er selve premisset for de «lange linjene». Vil du se hvordan de vokser videre?</p>
      <div class="rotter-links">
        <button class="btn ghost" id="rotter-tre">Se slektstreet</button>
        <button class="btn ghost" id="rotter-tidslinje">Åpne tidslinjen</button>
      </div>
    </div>
  </div>
</div>

<!-- Sjangerhistorier: seks forfattede fortellinger (én per metasjanger) som
     til sammen dekker pensumet. Én modal med sjanger-chips øverst — samme
     leseflate uansett historie, og bytte skjer uten modal-stabling. -->
<div class="modal-backdrop" id="modal-historier">
  <div class="modal">
    <div class="modal-head">
      <h2>Sjangerhistorier</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted hist-intro">Seks fortellinger som til sammen dekker hele pensumet — trykk på navnene underveis for å åpne artistkortene.</p>
    <div class="hist-chips" id="hist-chips"></div>
    <div id="hist-extra"></div>
    <div id="hist-body" class="story-body"></div>
  </div>
</div>
`;

let opts = null;
let contextMode = "society";

function getState() { return opts.getState(); }

function buildLinkCtx() {
  const s = getState();
  return {
    artists: s.artists,
    techItems: s.techItems,
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onMainGenreClick,
    isTeacher: !!s.isTeacher,
  };
}

function sjangerOpts() {
  const s = getState();
  return {
    root: document,
    genreDescs: s.genreDescs,
    artists: s.artists,
    techItems: s.techItems,
    genres: buildMainGenreList(s.artists),
    onArtistClick: opts.onArtistClick,
    onTechClick: openTechDetail,
    onMainGenreClick,
    onShowArtists: showArtistsForSjanger,
    onShowPlaylist: showPlaylistForMainGenre,
    // Tidslinjen åpnes OPPÅ sjanger-popupen (modaler stables), fokusert på
    // denne sjangerens seksjon — ← går tilbake til popupen.
    onShowTimeline: ({ label }) => openTidslinje({ genre: label }),
    onEdit: opts.onSubgenreEdit ? (label, level) => {
      modalClose(document.getElementById("modal-sjanger"));
      opts.onSubgenreEdit(label, level);
    } : undefined,
    onPropose: opts.onProposeEdit,
    hasPendingEdit: opts.hasPendingEdit,
  };
}

function onMainGenreClick(genre) {
  showSjangerInfo(genre, sjangerOpts()) || showSubsjangerInfo(genre, sjangerOpts());
  if (opts.onMainGenreCheck) opts.onMainGenreCheck(genre);
}

function showPlaylistForMainGenre({ fullName, node }) {
  openPlaylistModal(fullName, node, getState().artists);
}

function showArtistsForSjanger({ label }) {
  openArtistListModal(label, artistsInGenre(getState().artists, label), opts.onArtistClick, "Ingen forslag i denne sjangeren ennå.");
}

function showArtistsForInstrument(instrument) {
  openArtistListModal(instrument, artistsByInstrument(getState().artists, instrument), opts.onArtistClick, "Ingen forslag med dette instrumentet ennå.");
}

function openTechDetail(t) {
  document.getElementById("td-title").textContent = t.name;
  renderTechDetail(document.getElementById("td-body"), t, buildLinkCtx());
  const foot = document.getElementById("td-foot");
  const btn = document.getElementById("td-propose");
  if (foot && btn && opts.onProposeEdit) {
    foot.style.display = "";
    const locked = opts.hasPendingEdit?.("tech", t.id);
    btn.disabled = !!locked;
    btn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
    btn.onclick = () => opts.onProposeEdit({
      entityType: "tech",
      entityId: t.id,
      entityName: t.name,
      currentValues: t,
    });
  } else if (foot) {
    foot.style.display = "none";
  }
  modalOpen(document.getElementById("modal-tech-detail"));
}

function openDecadeList(mode) {
  contextMode = mode;
  const s = getState();
  const modal = document.getElementById("modal-decade-list");
  if (!modal) return;
  modal.querySelector(".modal-head h2").textContent = mode === "society" ? "Samfunn" : "Teknologi";
  const techExtra = document.getElementById("dl-tech-extra");
  if (techExtra) {
    if (mode === "tech") {
      techExtra.innerHTML = `<button class="btn ghost" id="dl-btn-innovasjon" style="width:100%;margin-bottom:14px">Innovasjonskort</button>`;
      techExtra.querySelector("#dl-btn-innovasjon").addEventListener("click", () => openTeknologi());
    } else {
      techExtra.innerHTML = "";
    }
  }
  const decades = (s.config?.decades || []).slice().sort((a, b) => a - b);
  const el = document.getElementById("dl-buttons");
  el.innerHTML = decades.map((d) => {
    const desc = s.decadeDescs[String(d)];
    const hasDesc = mode === "society" ? desc && desc.society : desc && desc.tech;
    return `<button class="btn ghost decade-list-btn ${hasDesc ? "" : "muted"}" data-decade-view="${d}">${d}-tallet</button>`;
  }).join("");
  el.querySelectorAll("[data-decade-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (opts.onDecadeEdit) {
        opts.onDecadeEdit(btn.dataset.decadeView, contextMode);
      } else {
        openDecadeView(btn.dataset.decadeView);
      }
    });
  });
  modalOpen(modal);
}

function openDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  const s = getState();
  const desc = s.decadeDescs[String(decadeId)] || {};
  const isSociety = contextMode === "society";
  document.getElementById("dv-title").textContent = `${decadeId}-tallet — ${isSociety ? "samfunn" : "teknologi"}`;

  const societySection = document.getElementById("dv-society-section");
  const techSection = document.getElementById("dv-tech-section");
  if (societySection) societySection.style.display = isSociety ? "" : "none";
  if (techSection) techSection.style.display = isSociety ? "none" : "";

  renderDecadeSections(
    {
      societyEl: document.getElementById("dv-society"),
      techEl: document.getElementById("dv-tech"),
      societyTl: document.getElementById("dv-society-timeline"),
      techTl: document.getElementById("dv-tech-timeline"),
      societyMoreBtn: document.getElementById("dv-society-more"),
      techMoreBtn: document.getElementById("dv-tech-more"),
    },
    desc, decadeId, s.techItems,
    {
      isSociety,
      onTechClick: openTechDetail,
      onMore: (which, text) => openDecadeMore(
        `${decadeId}-tallet — ${which === "society" ? "samfunnsutvikling" : "teknologiutvikling"}`, text),
    }
  );

  const propSociety = document.getElementById("dv-society-propose");
  const propTech = document.getElementById("dv-tech-propose");
  if (propSociety) {
    if (isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-society", decadeId);
      propSociety.style.display = "";
      propSociety.disabled = !!locked;
      propSociety.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propSociety.onclick = () => opts.onProposeEdit({
        entityType: "decade-society",
        entityId: String(decadeId),
        entityName: `${decadeId}-tallet — samfunn`,
        currentValues: { society: desc.society || "", societyMore: desc.societyMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propSociety.style.display = "none";
    }
  }
  if (propTech) {
    if (!isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-tech", decadeId);
      propTech.style.display = "";
      propTech.disabled = !!locked;
      propTech.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propTech.onclick = () => opts.onProposeEdit({
        entityType: "decade-tech",
        entityId: String(decadeId),
        entityName: `${decadeId}-tallet — teknologi`,
        currentValues: { tech: desc.tech || "", techMore: desc.techMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propTech.style.display = "none";
    }
  }

  const kilderEl = document.getElementById("dv-kilder");
  if (kilderEl) kilderEl.innerHTML = buildKilderList(desc.kilder, "Kilder");

  modalClose(document.getElementById("modal-decade-list"));
  modalOpen(modal);
}

function openDecadeMore(title, text) {
  const modal = document.getElementById("modal-decade-more");
  if (!modal) return;
  document.getElementById("dm-title").textContent = title;
  document.getElementById("dm-text").innerHTML = formatInfoText(text);
  modalOpen(modal);
}

function openPodkast() {
  renderPodkastList();
  modalOpen(document.getElementById("modal-podkast"));
}

function renderPodkastList() {
  const el = document.getElementById("podkast-list");
  if (!el) return;
  const s = getState();
  if (!s.podcasts.length) {
    el.innerHTML = `<p class="muted empty" style="background:#fff">Episodene publiseres fortløpende etter hvert som studentgruppene leverer sine bidrag.</p>`;
    return;
  }
  el.innerHTML = s.podcasts.map((ep) => podcastEpisodeHtml(ep)).join("");
}

function openTeknologi() {
  renderTeknologiList("");
  const modal = document.getElementById("modal-teknologi");
  modal.querySelectorAll(".tech-tab").forEach(b => b.classList.toggle("active", !b.dataset.techCat));
  modalOpen(modal);
}

function renderTeknologiList(category) {
  const el = document.getElementById("tech-list");
  if (!el) return;
  const s = getState();
  renderTechList(el, s.techItems, category || "", buildLinkCtx());
}

// Rad-oppslag: alltid 13 celler (VK_DECADES), manglende/korte rader fylles
// med null («ingen data») — så cellene alltid kan klikkes og redigeres.
function vkRow(heat, sj) {
  const raw = heat?.[sj];
  return VK_DECADES.map((_, i) => {
    const v = Array.isArray(raw) ? raw[i] : null;
    return Number.isInteger(v) && v >= 0 && v <= 5 ? v : null;
  });
}

// Husker hvilken metagruppe som står åpen, så redigering (som re-rendrer
// gjennom contentChanged) ikke klapper akkordeonen sammen igjen.
let vkOpenMeta = null;

function renderVarmekartBody() {
  const body = document.getElementById("vk-body");
  if (!body) return;
  const s = getState();
  const heat = s.content?.varmekart?.heat || null;
  const hasData = !!heat && Object.keys(heat).length > 0;
  const cols = VK_DECADES.length;
  const gridStyle = `display:grid;grid-template-columns:128px repeat(${cols},minmax(32px,1fr));gap:3px`;

  let html = "";
  if (!hasData) {
    html += `<p class="gx-missing" style="margin-bottom:14px">${s.contentLoaded
      ? "Varmekart-nivåene er ikke lagt inn ennå. Læreren legger dem inn via innholds-importen" + (opts.onHeatEdit ? " — eller ved å trykke på cellene under" : "") + "."
      : "Laster innhold …"}</p>`;
  }
  html += `<div style="overflow-x:auto"><div style="min-width:600px">`;
  html += `<div style="${gridStyle};align-items:end;margin-bottom:3px"><div></div>`;
  html += VK_DECADES.map((d) => `<div style="text-align:center;font-size:0.72rem;color:var(--muted)">${d}</div>`).join("");
  html += `</div>`;

  const firstHot = (sj) => { const i = vkRow(heat, sj).findIndex((v) => v > 0); return i < 0 ? 99 : i; };

  // Datadrevne konsistensvarsler (bare når data finnes): tre-sjangre uten rad
  // vises som «ingen data»; rader uten tre-sjanger kan aldri rendres.
  if (hasData) {
    const missing = GENEALOGY_MAIN_GENRES.filter((sj) => !heat[sj]);
    if (missing.length) console.warn(`Varmekart: ${missing.length} sjanger(e) mangler rad i content/varmekart og vises som «ingen data»:`, missing);
    const orphan = Object.keys(heat).filter((k) => !GENEALOGY_MAIN_GENRES.includes(k));
    if (orphan.length) console.warn(`Varmekart: ${orphan.length} rad(er) i content/varmekart matcher ingen tre-sjanger og vises aldri:`, orphan);
  }

  // Grupper mainGenre etter metaGenre (supersjanger). Treet gir både
  // grupperingen (MAIN_GENRE_INFO[sj].meta) og fargene (…​.color), så
  // varmekartet snakker samme visuelle språk som slektstreet.
  const groups = new Map();
  for (const sj of GENEALOGY_MAIN_GENRES) {
    const meta = MAIN_GENRE_INFO[sj]?.meta || "Andre";
    if (!groups.has(meta)) groups.set(meta, []);
    groups.get(meta).push(sj);
  }
  // Metaorden følger treet (≈ kronologisk); evt. ukjente legges sist.
  const metaOrder = [...GENEALOGY_META_GENRES, ...[...groups.keys()].filter((m) => !GENEALOGY_META_GENRES.includes(m))];
  // Representativ familiefarge for en gruppe = den hyppigste i gruppa.
  const groupColor = (labels) => {
    const tally = {};
    for (const l of labels) { const c = MAIN_GENRE_INFO[l]?.color; if (c) tally[c] = (tally[c] || 0) + 1; }
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || FAMILIES.gray.stroke;
  };
  const usedFams = new Set();

  let groupIdx = 0;
  for (const meta of metaOrder) {
    const labels = (groups.get(meta) || []).sort((a, b) => firstHot(a) - firstHot(b) || a.localeCompare(b, "no"));
    if (!labels.length) continue;
    const gColor = groupColor(labels);
    // Akkordeon: gruppa som sist sto åpen (redigering re-rendrer), ellers første.
    const open = vkOpenMeta ? meta === vkOpenMeta : groupIdx === 0;

    html += `<div class="vk-group" data-vk-meta="${escapeHtml(meta)}">`;
    // Gruppeoverskrift: klikkbar akkordeon-bryter — caret + farget prikk + navn + antall.
    html += `<button type="button" class="vk-group-head" aria-expanded="${open}" style="width:100%;display:flex;align-items:center;gap:9px;margin:${groupIdx === 0 ? "6px" : "10px"} 0 6px;padding:4px 0 5px;border:0;border-bottom:2px solid ${gColor}40;background:none;cursor:pointer;text-align:left">`;
    html += `<span class="vk-caret" style="flex:none;width:12px;font-size:0.7rem;color:var(--muted);transition:transform .15s;transform:rotate(${open ? 90 : 0}deg)">▶</span>`;
    html += `<span style="width:12px;height:12px;border-radius:50%;background:${gColor};flex:none;box-shadow:0 0 0 3px ${gColor}22"></span>`;
    html += `<span style="font-size:0.84rem;font-weight:700;color:var(--text)">${escapeHtml(meta)}</span>`;
    html += `<span style="font-size:0.72rem;color:var(--muted)">${labels.length} sjanger${labels.length === 1 ? "" : "e"}</span>`;
    html += `</button>`;
    groupIdx++;

    html += `<div class="vk-group-rows" style="display:${open ? "block" : "none"}">`;
    for (const sj of labels) {
      const rowColor = MAIN_GENRE_INFO[sj]?.color || gColor;
      usedFams.add(MAIN_GENRE_INFO[sj]?.fam);
      const vals = vkRow(heat, sj);
      html += `<div style="${gridStyle};align-items:center;margin-bottom:3px">`;
      html += `<div style="font-size:0.82rem;color:var(--text);line-height:1.2;border-left:3px solid ${rowColor};padding:1px 8px 1px 9px">${escapeHtml(sj)}</div>`;
      html += vals.map((v, i) => {
        const has = v != null;
        const bg = has ? heatColor(rowColor, v) : "#f5f8f6";
        const title = `${sj} · ${meta} · ${VK_DECADES[i]}-tallet${has ? ` · nivå ${v}/5` : " · ingen data"}${opts.onHeatEdit ? " · klikk for å endre" : ""}`;
        // Lærer: cellene er klikkbare (nivåvelger). Student: rene ruter.
        return opts.onHeatEdit
          ? `<button type="button" class="vk-cell" data-vk-genre="${escapeHtml(sj)}" data-vk-idx="${i}" title="${escapeHtml(title)}" style="height:30px;border-radius:6px;padding:0;cursor:pointer;background:${bg};border:${has ? "1px solid transparent" : "1px dashed var(--line-strong)"}"></button>`
          : `<div title="${escapeHtml(title)}" style="height:30px;border-radius:6px;background:${bg}${has ? "" : ";border:1px dashed var(--line-strong)"}"></div>`;
      }).join("");
      html += `</div>`;
    }
    html += `</div>`;   // .vk-group-rows
    html += `</div>`;   // .vk-group
  }
  html += `</div></div>`;

  // Forklaring 1: varmenivå (valør) — nøytral grå, da kuløren nå viser familie.
  html += `<div style="display:flex;align-items:center;gap:8px;margin-top:18px;font-size:0.8rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span>Mindre toneangivende</span>`;
  html += [1, 2, 3, 4, 5].map((v) => `<span style="width:22px;height:14px;border-radius:4px;background:${heatColor(VK_INK, v)}"></span>`).join("");
  html += `<span>Mer</span>`;
  html += `<span style="margin-left:14px;display:inline-flex;align-items:center;gap:6px"><span style="width:22px;height:14px;border-radius:4px;background:#f5f8f6;border:1px dashed var(--line-strong)"></span>ingen data ennå</span>`;
  html += `</div>`;

  // Forklaring 2: fargene = slektstreets familier (kun de som faktisk vises).
  const famLegend = Object.entries(FAMILIES)
    .filter(([k]) => usedFams.has(k))
    .map(([, v]) => `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:13px;height:3px;border-radius:2px;background:${v.stroke}"></span>${escapeHtml(v.label)}</span>`)
    .join("");
  html += `<div style="display:flex;align-items:center;gap:14px;margin-top:8px;font-size:0.78rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span>Fargene følger slektstreet:</span>${famLegend}`;
  html += `</div>`;

  body.innerHTML = html;

  // Akkordeon: klikk på en metagruppe åpner den og lukker de andre (klikk på en
  // åpen gruppe lukker den). Navigerer via .vk-group-strukturen for å unngå
  // selector-problemer med metanavn som «R&B».
  body.querySelectorAll(".vk-group-head").forEach((head) => {
    head.addEventListener("click", () => {
      const wasOpen = head.getAttribute("aria-expanded") === "true";
      vkOpenMeta = wasOpen ? "__ingen" : (head.closest(".vk-group")?.dataset.vkMeta || null);
      body.querySelectorAll(".vk-group").forEach((grp) => {
        const h = grp.querySelector(".vk-group-head");
        const rows = grp.querySelector(".vk-group-rows");
        const isThis = h === head && !wasOpen;
        h.setAttribute("aria-expanded", isThis ? "true" : "false");
        const caret = h.querySelector(".vk-caret");
        if (caret) caret.style.transform = `rotate(${isThis ? 90 : 0}deg)`;
        if (rows) rows.style.display = isThis ? "block" : "none";
      });
    });
  });

  // Lærer: klikk på en celle åpner nivåvelgeren.
  if (opts.onHeatEdit) {
    body.querySelectorAll(".vk-cell").forEach((cell) => {
      cell.addEventListener("click", () =>
        openVkEdit(cell.dataset.vkGenre, Number(cell.dataset.vkIdx)));
    });
  }
}

function openVarmekart() {
  const modal = document.getElementById("modal-varmekart");
  if (!modal) return;
  vkOpenMeta = null;   // frisk åpning: første gruppe åpen
  renderVarmekartBody();
  modalOpen(modal);
}

// Nivåvelgeren (lærer): «Blues · 1950-tallet» med knappene 0–5 + «Ingen
// data». Lagring skjer via opts.onHeatEdit(sjanger, nyRad) — hele raden
// sendes, så datalaget slipper å kjenne tiårsindeksen. Snapshotet oppdaterer
// state.content → contentChanged() → varmekartet re-rendres bak velgeren.
function openVkEdit(genre, idx) {
  const modal = document.getElementById("modal-vk-edit");
  if (!modal) return;
  const heat = getState().content?.varmekart?.heat || {};
  const row = vkRow(heat, genre);
  const current = row[idx];
  document.getElementById("vke-title").textContent = `${genre} · ${VK_DECADES[idx]}-tallet`;
  const msg = document.getElementById("vke-msg");
  msg.textContent = "";
  msg.className = "form-msg";
  const btns = document.getElementById("vke-buttons");
  btns.innerHTML = [0, 1, 2, 3, 4, 5].map((v) =>
    `<button type="button" class="btn ${current === v ? "primary" : "ghost"}" data-vke-level="${v}" style="min-width:44px">${v}</button>`
  ).join("") +
    `<button type="button" class="btn ${current == null ? "primary" : "ghost"}" data-vke-level="" style="flex:1">Ingen data</button>`;
  btns.querySelectorAll("[data-vke-level]").forEach((b) => {
    b.addEventListener("click", async () => {
      const level = b.dataset.vkeLevel === "" ? null : Number(b.dataset.vkeLevel);
      const newRow = row.slice();
      newRow[idx] = level;
      msg.textContent = "Lagrer …";
      msg.className = "form-msg ok";
      try {
        await opts.onHeatEdit(genre, newRow);
        modalClose(modal);
      } catch (err) {
        console.error("Varmekart-lagring feilet:", err);
        msg.textContent = "Feil: " + (err?.message || err);
        msg.className = "form-msg error";
      }
    });
  });
  modalOpen(modal);
}

// ----------------------------------------------------------------------------
//  Tidslinje: når var artistene aktive? Pakket bane-tidslinje gruppert per
//  tre-sjanger, i metasjanger-akkordeon (samme mønster og fargespråk som
//  varmekartet). Hver sjangerseksjon har i tillegg sin egen trekant og starter
//  lukket, så en åpen metagruppe først viser en ryddig sjangerliste med antall.
//  `focus` er valgfritt: { genre } åpner den metagruppen + seksjonen og
//  scroller dit; { artistId } åpner artistens gruppe/seksjoner og uthever
//  blokkene. Banepakkingen bor i timeline-lanes.js (enhetstestet).
// ----------------------------------------------------------------------------
function openTidslinje(focus = {}) {
  const modal = document.getElementById("modal-tidslinje");
  if (!modal) return;
  const body = document.getElementById("tid-body");
  const s = getState();
  const nowYear = new Date().getFullYear();
  const active = s.artists.filter(isVisible);

  // Kanoniser artist-tagger til treets stavemåte (samme som chips-lista).
  const canonMain = new Map(GENEALOGY_MAIN_GENRES.map((g) => [g.toLowerCase(), g]));

  // Fordel artistene i seksjoner: én per tre-sjanger de er tagget med, eller
  // en «Øvrige»-seksjon under metasjangeren hvis ingen tagg matcher treet —
  // slik at ALLE synlige artister med startår er med, ingen forsvinner stille.
  const OTHER = " other:";  // intern nøkkel-prefiks, kolliderer aldri med sjangernavn
  const sections = new Map();
  const sectionsPerArtist = new Map();
  for (const a of active) {
    const span = resolveSpan(a, nowYear);
    if (!span) continue;
    const genres = [...new Set((a.mainGenre || [])
      .map((g) => canonMain.get(String(g).toLowerCase()))
      .filter(Boolean))];
    const keys = genres.length ? genres : [OTHER + (a.metaGenre || "Andre")];
    for (const key of keys) {
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key).push({ id: a.id, name: a.name || "(uten navn)", span });
    }
    sectionsPerArtist.set(a.id, keys.length);
  }

  if (!sections.size) {
    body.innerHTML = `<p class="muted">Ingen artister med startår ennå.</p>`;
    modalOpen(modal);
    return;
  }

  // Grupper seksjonene under metasjanger, i treets rekkefølge (som varmekartet).
  const groups = new Map();
  for (const key of sections.keys()) {
    const meta = key.startsWith(OTHER) ? key.slice(OTHER.length) : (MAIN_GENRE_INFO[key]?.meta || "Andre");
    if (!groups.has(meta)) groups.set(meta, []);
    groups.get(meta).push(key);
  }
  const metaOrder = [...GENEALOGY_META_GENRES, ...[...groups.keys()].filter((m) => !GENEALOGY_META_GENRES.includes(m))];

  // Felles tidsakse over alt innhold, i hele tiår.
  const allSpans = [...sections.values()].flat().map((i) => i.span);
  const { y0, y1 } = timelineBounds(allSpans, nowYear);
  const pctOf = (y) => ((y - y0) / (y1 - y0)) * 100;
  const decades = [];
  for (let d = y0; d <= y1 - 10; d += 10) decades.push(d);

  const gridHtml = decades.map((d) =>
    `<div style="position:absolute;top:0;bottom:0;left:${pctOf(d).toFixed(2)}%;width:1px;background:var(--line)"></div>`).join("");
  const axisHtml = `<div style="position:relative;height:16px;margin-bottom:4px">` + decades.map((d) =>
    `<span style="position:absolute;left:${pctOf(d).toFixed(2)}%;font-size:0.68rem;color:var(--muted);transform:translateX(-3px)">${d}</span>`).join("") + `</div>`;

  // Fokus: hvilken metagruppe skal stå åpen? (standard: den første)
  const focusGenre = focus.genre ? (canonMain.get(String(focus.genre).toLowerCase()) || focus.genre) : null;
  let focusMeta = focusGenre ? (MAIN_GENRE_INFO[focusGenre]?.meta || null) : null;
  if (!focusMeta && focus.artistId) {
    for (const [key, items] of sections) {
      if (items.some((i) => i.id === focus.artistId)) {
        focusMeta = key.startsWith(OTHER) ? key.slice(OTHER.length) : (MAIN_GENRE_INFO[key]?.meta || "Andre");
        break;
      }
    }
  }

  const earliest = (key) => Math.min(...sections.get(key).map((i) => i.span.start));
  const groupColor = (keys) => {
    const tally = {};
    for (const k of keys) { const c = MAIN_GENRE_INFO[k]?.color; if (c) tally[c] = (tally[c] || 0) + 1; }
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || FAMILIES.gray.stroke;
  };

  let html = `<div style="overflow-x:auto"><div style="min-width:720px">` + axisHtml;
  let groupIdx = 0;
  for (const meta of metaOrder) {
    const keys = (groups.get(meta) || []).sort((a, b) => earliest(a) - earliest(b) || a.localeCompare(b, "no"));
    if (!keys.length) continue;
    const gColor = groupColor(keys);
    const open = focusMeta ? meta === focusMeta : groupIdx === 0;
    const artistCount = new Set(keys.flatMap((k) => sections.get(k).map((i) => i.id))).size;

    html += `<div class="tid-group">`;
    html += `<button type="button" class="tid-group-head" aria-expanded="${open}" style="width:100%;display:flex;align-items:center;gap:9px;margin:${groupIdx === 0 ? "6px" : "10px"} 0 6px;padding:4px 0 5px;border:0;border-bottom:2px solid ${gColor}40;background:none;cursor:pointer;text-align:left">`;
    html += `<span class="tid-caret" style="flex:none;width:12px;font-size:0.7rem;color:var(--muted);transition:transform .15s;transform:rotate(${open ? 90 : 0}deg)">▶</span>`;
    html += `<span style="width:12px;height:12px;border-radius:50%;background:${gColor};flex:none;box-shadow:0 0 0 3px ${gColor}22"></span>`;
    html += `<span style="font-size:0.84rem;font-weight:700;color:var(--text)">${escapeHtml(meta)}</span>`;
    html += `<span style="font-size:0.72rem;color:var(--muted)">${keys.length} sjanger${keys.length === 1 ? "" : "e"} · ${artistCount} artist${artistCount === 1 ? "" : "er"}</span>`;
    html += `</button>`;
    groupIdx++;

    html += `<div class="tid-group-rows" style="display:${open ? "block" : "none"}">`;
    for (const key of keys) {
      const isOther = key.startsWith(OTHER);
      const label = isOther ? "Øvrige (uten tre-sjanger)" : key;
      const rowColor = isOther ? FAMILIES.gray.stroke : (MAIN_GENRE_INFO[key]?.color || gColor);
      const secItems = sections.get(key);
      const lanes = packLanes(secItems);
      const secCount = new Set(secItems.map((i) => i.id)).size;
      // Seksjonene starter lukket; fokus åpner den relevante (sjanger-inngang
      // treffer én seksjon, artist-inngang alle seksjonene artisten står i).
      const secOpen = focusGenre ? key === focusGenre
        : focus.artistId ? secItems.some((i) => i.id === focus.artistId)
        : false;
      html += `<div class="tid-section" data-genre="${escapeHtml(isOther ? "" : key)}" style="margin:0 0 10px">`;
      html += `<button type="button" class="tid-sec-head" aria-expanded="${secOpen}" style="width:100%;display:flex;align-items:center;gap:7px;margin-bottom:4px;padding:1px 8px;border:0;border-left:3px solid ${rowColor};background:none;cursor:pointer;text-align:left">`;
      html += `<span class="tid-sec-caret" style="flex:none;width:12px;font-size:0.7rem;color:var(--muted);transition:transform .15s;transform:rotate(${secOpen ? 90 : 0}deg)">▶</span>`;
      html += `<span style="font-size:0.8rem;color:var(--text)">${escapeHtml(label)}</span>`;
      html += `<span style="font-size:0.72rem;color:var(--muted)">${secCount} artist${secCount === 1 ? "" : "er"}</span>`;
      html += `</button>`;
      html += `<div class="tid-sec-rows" style="display:${secOpen ? "block" : "none"}">`;
      html += `<div style="position:relative;height:${lanes.length * 25}px">${gridHtml}`;
      lanes.forEach((lane, li) => {
        for (const it of lane) {
          const left = pctOf(it.span.start);
          const width = Math.max(pctOf(it.visualEnd) - left, 1.2);
          const openEnd = it.span.open;
          const multi = (sectionsPerArtist.get(it.id) || 1) > 1;
          const yearsTxt = `${it.span.start}${openEnd ? " → pågår / sluttår ikke satt" : "–" + it.span.end}`;
          html += `<button type="button" class="tid-bar" data-artist-id="${escapeHtml(it.id)}" title="${escapeHtml(it.name)} · aktiv ${escapeHtml(yearsTxt)}" ` +
            `style="position:absolute;top:${li * 25 + 1}px;left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;height:21px;` +
            `background:${rowColor}24;border:1px solid ${rowColor}66;${openEnd ? "border-right:none;border-radius:5px 0 0 5px;" : "border-radius:5px;"}` +
            `font-size:0.72rem;line-height:19px;padding:0 6px;color:var(--text);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">` +
            `${escapeHtml(it.name)}${multi ? " ◆" : ""}${openEnd ? `<span style="position:absolute;right:2px;opacity:.7">›</span>` : ""}</button>`;
        }
      });
      html += `</div></div></div>`;
    }
    html += `</div></div>`;
  }
  html += `</div></div>`;

  // Forklaring
  html += `<div style="display:flex;align-items:center;gap:16px;margin-top:14px;font-size:0.78rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:26px;height:12px;border-radius:4px;background:var(--line);border:1px solid var(--line-strong)"></span>kjent aktiv-periode</span>`;
  html += `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:26px;height:12px;border-radius:4px 0 0 4px;background:var(--line);border:1px solid var(--line-strong);border-right:none"></span>› pågår / sluttår ikke satt</span>`;
  html += `<span>◆ artist i flere sjangre</span>`;
  html += `</div>`;

  body.innerHTML = html;

  // Akkordeon (samme oppførsel som varmekartet: én gruppe åpen om gangen).
  body.querySelectorAll(".tid-group-head").forEach((head) => {
    head.addEventListener("click", () => {
      const wasOpen = head.getAttribute("aria-expanded") === "true";
      body.querySelectorAll(".tid-group").forEach((grp) => {
        const h = grp.querySelector(".tid-group-head");
        const rows = grp.querySelector(".tid-group-rows");
        const isThis = h === head && !wasOpen;
        h.setAttribute("aria-expanded", isThis ? "true" : "false");
        const caret = h.querySelector(".tid-caret");
        if (caret) caret.style.transform = `rotate(${isThis ? 90 : 0}deg)`;
        if (rows) rows.style.display = isThis ? "block" : "none";
      });
    });
  });

  // Sjangerseksjonene har egne trekanter: uavhengige brytere (flere kan stå
  // åpne samtidig), i motsetning til metanivåets én-om-gangen-akkordeon.
  body.querySelectorAll(".tid-sec-head").forEach((head) => {
    head.addEventListener("click", () => {
      const open = head.getAttribute("aria-expanded") !== "true";
      head.setAttribute("aria-expanded", open ? "true" : "false");
      const caret = head.querySelector(".tid-sec-caret");
      if (caret) caret.style.transform = `rotate(${open ? 90 : 0}deg)`;
      const rows = head.parentElement.querySelector(".tid-sec-rows");
      if (rows) rows.style.display = open ? "block" : "none";
    });
  });

  // Klikk på blokk → artistkortet (samme inngang som resten av appen).
  body.querySelectorAll(".tid-bar").forEach((bar) => {
    bar.addEventListener("click", () => {
      const a = s.artists.find((x) => x.id === bar.dataset.artistId);
      if (a && opts.onArtistClick) opts.onArtistClick(a);
    });
  });

  modalOpen(modal);

  // Fokus: scroll til seksjonen/blokkene etter at modalen er synlig.
  if (focusGenre || focus.artistId) {
    requestAnimationFrame(() => {
      let target = null;
      if (focusGenre) target = body.querySelector(`.tid-section[data-genre="${CSS.escape(focusGenre)}"]`);
      if (focus.artistId) {
        body.querySelectorAll(`.tid-bar[data-artist-id="${CSS.escape(focus.artistId)}"]`).forEach((b) => {
          b.style.outline = `2px solid var(--accent, #2563eb)`;
          if (!target) target = b;
        });
      }
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

// ----------------------------------------------------------------------------
//  Kart: musikkens geografi. Nord-Amerika-utsnitt (Natural Earth-omriss i
//  geo-map-data.js) med én prikk per sted (geo-places.js kobler geography-
//  tekstene til koordinater). Tiårsfilter viser migrasjonen; steder utenfor
//  utsnittet (Oslo, London …) vises som klikkbare chips under kartet, så de
//  ikke forsvinner stille. Klikk på prikk/chip → artistliste → artistkort.
// ----------------------------------------------------------------------------
let kartDecade = null;   // null = alle tiår

function openKart() {
  const modal = document.getElementById("modal-kart");
  if (!modal) return;
  renderKart();
  modalOpen(modal);
  // Hold tabellen i synk: nye steder i dataene skal legges til i PLACES.
  const unknown = unknownPlaces(getState().artists.filter(isVisible));
  if (unknown.length) {
    console.warn(`Kart: ${unknown.length} sted(er) mangler i PLACES (js/geo-places.js) og vises som «ikke plassert»:`, unknown);
  }
}

function renderKart() {
  const s = getState();
  const active = s.artists.filter(isVisible);
  const { onMap, abroad, unplaced } = aggregatePlaces(active, { decade: kartDecade });
  const DOT = "#1d4ed8";   // én kulør — størrelse bærer informasjonen

  // Tiårsvelger (Alle + tiårene fra varmekartet, samme tidsrom)
  const decEl = document.getElementById("kart-decades");
  decEl.innerHTML = [null, ...VK_DECADES].map((d) =>
    `<button type="button" class="btn ghost small kart-dec${d === kartDecade ? " active" : ""}" data-dec="${d ?? ""}"` +
    `${d === kartDecade ? ' style="background:var(--accent,#1d4ed8);color:#fff"' : ""}>${d == null ? "Alle tiår" : d + "-t."}</button>`
  ).join("");
  decEl.querySelectorAll(".kart-dec").forEach((b) => b.addEventListener("click", () => {
    kartDecade = b.dataset.dec === "" ? null : Number(b.dataset.dec);
    renderKart();
  }));

  // Kartet: landomriss + prikker. Radius ~ kvadratrot av antall (arealet
  // skalerer da med antallet); tekstetikett på de største.
  const r = (n) => Math.min(3 + 2.1 * Math.sqrt(n), 17);
  let svg = `<div style="overflow-x:auto"><svg viewBox="0 0 ${MAP_VIEW.w} ${MAP_VIEW.h}" style="width:100%;min-width:560px;display:block" role="img" aria-label="Kart over Nord-Amerika med artistenes virkesteder">`;
  svg += MAP_COUNTRIES.map((c) =>
    `<path d="${c.d}" style="fill:var(--bg-soft,#eef1f4);stroke:var(--line-strong,#cbd5df);stroke-width:0.7" />`).join("");
  const placed = onMap.map((p, i) => ({ ...p, ...projectPoint(p.lat, p.lng), i }));
  // Store prikker tegnes først så små forblir klikkbare oppå.
  placed.sort((a, b) => b.count - a.count);
  svg += placed.map((p) => {
    const style = p.region
      ? `fill:${DOT};fill-opacity:0.10;stroke:${DOT};stroke-width:1.2;stroke-dasharray:4 3`
      : `fill:${DOT};fill-opacity:0.68;stroke:#fff;stroke-width:1`;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r(p.count).toFixed(1)}" data-place="${p.i}" style="${style};cursor:pointer"><title>${escapeHtml(`${p.label} · ${p.count} artist${p.count === 1 ? "" : "er"}`)}</title></circle>`;
  }).join("");
  svg += placed.filter((p) => p.count >= 6).map((p) =>
    `<text x="${(p.x + r(p.count) + 3).toFixed(1)}" y="${(p.y + 3.5).toFixed(1)}" style="font-size:13px;fill:var(--text,#1f2937);pointer-events:none">${escapeHtml(p.label)}</text>`).join("");
  svg += `</svg></div>`;
  document.getElementById("kart-svg").innerHTML = svg;
  document.getElementById("kart-svg").querySelectorAll("[data-place]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = placed.find((x) => String(x.i) === el.dataset.place);
      if (p) openArtistListModal(p.label, p.artists, opts.onArtistClick, "Ingen artister her i valgt tiår.");
    });
  });

  // Utenfor kartet: klikkbare chips, samme oppførsel som prikkene.
  const abEl = document.getElementById("kart-abroad");
  abEl.innerHTML = abroad.length
    ? `<p class="muted" style="font-size:0.82rem;margin-bottom:6px">Også knyttet til steder utenfor kartet:</p>` +
      `<div style="display:flex;gap:6px;flex-wrap:wrap">` +
      abroad.map((p, i) =>
        `<button type="button" class="tag tag-sjanger" data-abroad="${i}" title="${escapeHtml(p.abroad)}">${escapeHtml(p.label)} (${p.count})</button>`).join("") +
      `</div>`
    : "";
  abEl.querySelectorAll("[data-abroad]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = abroad[Number(el.dataset.abroad)];
      if (p) openArtistListModal(`${p.label} (${p.abroad})`, p.artists, opts.onArtistClick, "Ingen artister her i valgt tiår.");
    });
  });

  // Ærlig fotnote: artister uten plasserbart sted (klikkbar liste).
  const footEl = document.getElementById("kart-footer");
  const unplacedCount = unplaced.reduce((sum, u) => sum + u.count, 0);
  footEl.innerHTML = unplacedCount
    ? `<button type="button" class="btn ghost small" id="kart-unplaced">${unplacedCount} artist${unplacedCount === 1 ? "" : "er"} uten plasserbart sted</button>`
    : "";
  const upBtn = footEl.querySelector("#kart-unplaced");
  if (upBtn) upBtn.addEventListener("click", () => {
    const all = [];
    const seen = new Set();
    for (const u of unplaced) for (const a of u.artists) {
      const k = a.id ?? a;
      if (!seen.has(k)) { seen.add(k); all.push(a); }
    }
    openArtistListModal("Uten plasserbart sted", all, opts.onArtistClick, "Ingen.");
  });
}

function openSubgenreList() {
  const modal = document.getElementById("modal-subgenre-list");
  if (!modal) return;
  const s = getState();
  const active = s.artists.filter(isVisible);
  const checkedState = opts.getCheckedState ? opts.getCheckedState() : null;

  // Tre-drevet: alle sjangre fra treet vises alltid. De artist-taggede er en
  // delmengde (isMainGenre), men tas med for sikkerhets skyld. Kanoniser til
  // treets stavemåte, ellers gir en fritekst-tagg som «blues» både en ekstra
  // chip OG at offisielle «Blues» feilaktig vises som tom.
  const canonMain = new Map(GENEALOGY_MAIN_GENRES.map((g) => [g.toLowerCase(), g]));
  const withArtists = new Set(
    active.flatMap(a => (a.mainGenre || [])
      .filter(isMainGenre)
      .map(s => canonMain.get(s.toLowerCase()) || s))
  );
  const sjangre = [...new Set([...GENEALOGY_MAIN_GENRES, ...withArtists])]
    .sort((a, b) => a.localeCompare(b, "no"));
  const slEl = document.getElementById("sl-chips");
  const checkedMainGenres = checkedState?.genres || [];
  slEl.innerHTML = sjangre.length
    ? sjangre.map((s) => {
        const empty = !withArtists.has(s);
        return `<button class="tag tag-sjanger ${checkedMainGenres.includes(s) ? "is-checked" : ""}${empty ? " is-empty" : ""}" data-sjanger="${escapeHtml(s)}"${empty ? ' title="Ingen artister ennå"' : ""}>${escapeHtml(s)}</button>`;
      }).join("")
    : `<p class="muted">Ingen sjangere registrert ennå.</p>`;

  modalOpen(modal);
}

// Undersjangre: frie tags fra artistene, i egen modal oppå Sjangre-modalen
// (før en fane i samme modal — nå en egen inngang via «Undersjangere»-knappen).
function openUndersjangre() {
  const modal = document.getElementById("modal-undersjangre");
  if (!modal) return;
  const s = getState();
  const active = s.artists.filter(isVisible);
  const checkedState = opts.getCheckedState ? opts.getCheckedState() : null;
  const under = [...new Set(active.flatMap(a => [
    ...(a.mainGenre || []).filter(x => !isMainGenre(x)),
    ...(a.subGenre || []),
  ]))].sort((a, b) => a.localeCompare(b, "no"));
  const ulEl = document.getElementById("ul-chips");
  const checkedSubs = checkedState?.subgenres || [];
  ulEl.innerHTML = under.length
    ? under.map((u) => `<button class="tag tag-under ${checkedSubs.includes(u) ? "is-checked" : ""}" data-under="${escapeHtml(u)}">${escapeHtml(u)}</button>`).join("")
    : `<p class="muted">Ingen undersjangre registrert ennå.</p>`;

  modalOpen(modal);
}

function openSubgenreInfo(subgenreId) {
  const modal = document.getElementById("modal-subgenre-info");
  if (!modal) return;
  const s = getState();
  const resolved = resolveDesc(s.genreDescs, subgenreId, "sub");
  document.getElementById("sgi-title").textContent = subgenreId;
  const sgiDesc = document.getElementById("sgi-desc");
  sgiDesc.textContent = resolved.description || missingDesc("sub");
  sgiDesc.className = resolved.description ? "" : "gx-missing";

  const artists = s.artists
    .filter(a => isVisible(a) && ((a.subGenre || []).includes(subgenreId) || (a.mainGenre || []).includes(subgenreId)))
    .sort((a, b) => a.name.localeCompare(b.name, "no"));

  const el = document.getElementById("sgi-artists");
  if (!artists.length) {
    el.innerHTML = "";
  } else {
    el.innerHTML = `
      <button class="btn ghost small sgi-toggle" style="margin-top:12px">Artister (${artists.length})</button>
      <div class="sgi-list" style="display:none;margin-top:10px">
        ${artists.map(a => `<div class="result-row sgi-artist-row" data-id="${escapeHtml(a.id)}">
          <span class="result-name">${escapeHtml(a.name)}</span>
          <span class="result-meta">
            ${a.metaGenre ? `<span class="tag">${escapeHtml(a.metaGenre)}</span>` : ""}
            ${a.instrument ? `<span class="tag">${escapeHtml(a.instrument)}</span>` : ""}
          </span>
          <span class="result-arrow">›</span>
        </div>`).join("")}
      </div>`;
    el.querySelector(".sgi-toggle").addEventListener("click", (e) => {
      const list = el.querySelector(".sgi-list");
      const visible = list.style.display !== "none";
      list.style.display = visible ? "none" : "block";
      e.target.textContent = visible ? `Artister (${artists.length})` : "Skjul artister";
    });
    el.querySelectorAll(".sgi-artist-row").forEach((row) => {
      row.addEventListener("click", () => {
        const artist = artists.find(a => a.id === row.dataset.id);
        if (artist) opts.onArtistClick(artist);
      });
    });
  }

  const extra = document.getElementById("sgi-extra");
  extra.innerHTML = "";
  if (opts.onSubgenreEdit) {
    extra.innerHTML = `<div class="modal-foot-right"><button id="sgi-edit-btn" class="btn ghost small">Rediger</button></div>`;
    extra.querySelector("#sgi-edit-btn").addEventListener("click", () => {
      modalClose(modal);
      opts.onSubgenreEdit(subgenreId, "sub");
    });
  }

  modalOpen(modal);
}

// Samleinngang for «vis meg helheten»: alle tidslinjer og visuelle oversikter
// bak ett dashbordkort, uten at de flyttes fra innholdsmodalene sine.
function openStoreBildet() {
  modalOpen(document.getElementById("modal-store-bildet"));
}

// Innholdssidene «Om historie» (omHistorie) og «Røtter før 1910» (rotter):
// teksten bor i Firestore (content/<id>.body, markdown-light) og rendres ved
// hver åpning, så import/redigering slår gjennom umiddelbart. INGEN fallback-
// tekst i koden (brukervalg) — mangler teksten, sies det tydelig ifra i
// stedet for å vise en utdatert reserve.
function renderPage(pageId, bodyElId, extraElId) {
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
  // Lærer: rediger-knapp over teksten (samme mønster som historiene).
  const extra = document.getElementById(extraElId);
  if (extra) {
    extra.innerHTML = "";
    if (opts.onPageEdit) {
      extra.innerHTML = `<div class="modal-foot-right" style="margin:0 0 10px">
        <button class="btn ghost small" data-page-edit="${pageId}">Rediger</button>
      </div>`;
      extra.querySelector("[data-page-edit]").addEventListener("click", () => opts.onPageEdit(pageId));
    }
  }
}

function openOmHistorie() {
  const modal = document.getElementById("modal-om-historie");
  if (!modal) return;
  renderPage("omHistorie", "om-historie-body", "omh-extra");
  modalOpen(modal);
}

function openRotter() {
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

  // Lærer: rediger-knapp over teksten (samme mønster som sgi-edit-btn).
  const extra = document.getElementById("hist-extra");
  extra.innerHTML = "";
  if (opts.onStoryEdit) {
    extra.innerHTML = `<div class="modal-foot-right" style="margin:0 0 10px">
      <button class="btn ghost small" id="hist-edit-btn">${story ? "Rediger" : "Skriv historien"}</button>
    </div>`;
    extra.querySelector("#hist-edit-btn").addEventListener("click", () => opts.onStoryEdit(genre));
  }

  const box = modal.querySelector(".modal");
  if (box) box.scrollTop = 0;
}

function openHistorier(genre) {
  const modal = document.getElementById("modal-historier");
  if (!modal) return;
  const chips = document.getElementById("hist-chips");
  if (!chips.dataset.filled) {
    chips.innerHTML = STORY_ORDER.map((g) =>
      `<button type="button" class="btn ghost small hist-chip" data-story="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join("");
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
function openSjangerhimmel() {
  const modal = document.getElementById("modal-sjangerhimmel");
  if (!modal) return;
  renderSjangerhimmel(document.getElementById("sh-body"), getState().artists.filter(isVisible), {
    onArtistClick: opts.onArtistClick,
    onGenreClick: onMainGenreClick,
  });
  modalOpen(modal);
}

function injectModals() {
  const wrap = document.createElement("div");
  wrap.innerHTML = MODAL_HTML;
  while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
  // Gi de nettopp injiserte modalene samme header-behandling (←/✕ lukk alle)
  // som de statiske, ellers blir headeren inkonsekvent.
  initModalHeaders();
}

function wireModals() {
  ["modal-teknologi", "modal-podkast", "modal-decade-list", "modal-decade-view",
   "modal-decade-more", "modal-subgenre-list", "modal-undersjangre", "modal-subgenre-info",
   "modal-varmekart", "modal-vk-edit", "modal-tidslinje", "modal-kart", "modal-sjangerhimmel",
   "modal-artistliste", "modal-spilleliste", "modal-sjanger", "modal-tech-detail",
   "modal-store-bildet", "modal-om-historie", "modal-rotter", "modal-historier"].forEach((id) => setupModal(id));

  // Innholdssidenes navigasjonsføtter (statisk markup — innholdet bor i Firestore).
  document.getElementById("omh-rotter")?.addEventListener("click", openRotter);
  document.getElementById("omh-historier")?.addEventListener("click", () => openHistorier());
  const rotterTre = document.getElementById("rotter-tre");
  if (rotterTre) {
    if (opts.onSlektstre) rotterTre.addEventListener("click", () => opts.onSlektstre());
    else rotterTre.style.display = "none";
  }
  document.getElementById("rotter-tidslinje")?.addEventListener("click", () => openTidslinje());

  const dvBack = document.getElementById("dv-back");
  if (dvBack) dvBack.addEventListener("click", () => {
    modalClose(document.getElementById("modal-decade-view"));
    modalOpen(document.getElementById("modal-decade-list"));
  });

  const slExtra = document.getElementById("sl-extra");
  if (slExtra) {
    // To innganger øverst: Hovedsjangere → sjangerhistoriene (én fortelling
    // per hovedsjanger), Undersjangere → chip-lista i egen modal. Deretter de
    // visuelle oversiktene.
    let btns = `<div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">`;
    btns += `<button class="btn ghost" id="btn-hovedsjangere" style="flex:1">Hovedsjangere</button>`;
    btns += `<button class="btn ghost" id="btn-undersjangere" style="flex:1">Undersjangere</button>`;
    btns += `</div>`;
    btns += `<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">`;
    if (opts.onSlektstre) btns += `<button class="btn ghost" id="btn-slektstre" style="flex:1">Sjangertre</button>`;
    btns += `<button class="btn ghost" id="btn-varmekart" style="flex:1">Varmekart</button>`;
    btns += `<button class="btn ghost" id="btn-tidslinje" style="flex:1">Tidslinje</button>`;
    btns += `</div>`;
    slExtra.innerHTML = btns;
    slExtra.querySelector("#btn-hovedsjangere").addEventListener("click", () => openHistorier());
    slExtra.querySelector("#btn-undersjangere").addEventListener("click", openUndersjangre);
    const treBtn = slExtra.querySelector("#btn-slektstre");
    if (treBtn) treBtn.addEventListener("click", () => opts.onSlektstre());
    slExtra.querySelector("#btn-varmekart").addEventListener("click", openVarmekart);
    slExtra.querySelector("#btn-tidslinje").addEventListener("click", () => openTidslinje());
  }

  // «Det store bildet»-hub: mål-modalene åpnes OPPÅ huben (modaler stables),
  // så ← i undermodalen går naturlig tilbake hit. Slektstreet bor på egen side
  // og navigerer bort — knappen skjules om siden ikke ga en handler.
  const sbModal = document.getElementById("modal-store-bildet");
  if (sbModal) {
    sbModal.querySelector("#sb-om-historie").addEventListener("click", openOmHistorie);
    sbModal.querySelector("#sb-rotter").addEventListener("click", openRotter);
    sbModal.querySelector("#sb-historier").addEventListener("click", () => openHistorier());
    sbModal.querySelector("#sb-tidslinje").addEventListener("click", () => openTidslinje());
    const sbTre = sbModal.querySelector("#sb-slektstre");
    if (opts.onSlektstre) sbTre.addEventListener("click", () => opts.onSlektstre());
    else sbTre.style.display = "none";
    sbModal.querySelector("#sb-varmekart").addEventListener("click", openVarmekart);
    sbModal.querySelector("#sb-kart").addEventListener("click", openKart);
    sbModal.querySelector("#sb-himmel").addEventListener("click", openSjangerhimmel);
  }

  const tekExtra = document.getElementById("tek-admin-extra");
  if (opts.onTechAdmin && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost" id="btn-tech-admin" style="width:100%;margin-bottom:14px">Teknologikort (admin)</button>`;
    tekExtra.querySelector("#btn-tech-admin").addEventListener("click", () => {
      modalClose(document.getElementById("modal-teknologi"));
      opts.onTechAdmin();
    });
  } else if (opts.onProposeNewTech && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost" id="btn-tech-new" style="width:100%;margin-bottom:14px">Foreslå nytt innovasjonskort</button>`;
    tekExtra.querySelector("#btn-tech-new").addEventListener("click", () => opts.onProposeNewTech());
  }

  const tekModal = document.getElementById("modal-teknologi");
  if (tekModal) {
    tekModal.querySelectorAll(".tech-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        tekModal.querySelectorAll(".tech-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderTeknologiList(btn.dataset.techCat || "");
      });
    });
  }

  document.addEventListener("click", (e) => {
    const metaBtn = e.target.closest("[data-meta]");
    if (metaBtn) {
      const name = metaBtn.dataset.meta;
      // Hovedsjangere har ikke lenger egne beskrivelser — de peker nå til de
      // seks sjangerhistoriene (v2.99).
      openHistorier(name);
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
      return;
    }
    const sjBtn = e.target.closest("[data-sjanger]");
    if (sjBtn) {
      const name = sjBtn.dataset.sjanger;
      showSjangerInfo(name, sjangerOpts()) || showSubsjangerInfo(name, sjangerOpts());
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
      return;
    }
    const underBtn = e.target.closest("[data-under]");
    if (underBtn) {
      const name = underBtn.dataset.under;
      showSubsjangerInfo(name, sjangerOpts()) || showSjangerInfo(name, sjangerOpts());
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
      return;
    }
    const inst = e.target.closest("[data-instrument]");
    if (inst) showArtistsForInstrument(inst.dataset.instrument);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-subgenre-info]");
    if (!btn) return;
    e.stopPropagation();
    openSubgenreInfo(btn.dataset.subgenreInfo);
  });
}

// Kalles av sidene når content-snapshotet endres (import, redigering,
// celleklikk): re-rendrer innholdsvisninger som står åpne, så endringen
// slår gjennom uten å lukke/åpne modalen.
function contentChanged() {
  const isOpen = (id) => document.getElementById(id)?.classList.contains("open");
  if (isOpen("modal-om-historie")) renderPage("omHistorie", "om-historie-body", "omh-extra");
  if (isOpen("modal-rotter")) renderPage("rotter", "rotter-body", "rotter-extra");
  if (isOpen("modal-varmekart")) renderVarmekartBody();
}

export function initExplore(options) {
  opts = options;
  injectModals();
  wireModals();
  return {
    openDecadeList,
    openSubgenreList,
    openVarmekart,
    openTidslinje,
    openStoreBildet,
    openOmHistorie,
    openRotter,
    openHistorier,
    openPodkast,
    openTeknologi,
    openTechDetail,
    buildLinkCtx,
    showArtistsForSjanger,
    showPlaylistForMainGenre,
    onMainGenreClick,
    openSubgenreInfo,
    contentChanged,
  };
}
