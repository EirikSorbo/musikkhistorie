// ============================================================================
//  MODAL-MARKUP FOR UTFORSK-SIDENE
// ----------------------------------------------------------------------------
//  Den store markup-strengen for utforsk-modalene, flyttet ut av explore.js
//  (v3.54) — samme mønster som ui-modal-fragments.js. injectModals() i
//  explore.js bygger DOM-en fra MODAL_HTML. De fire delte fragmentene
//  (artistliste, spilleliste, sjanger, teknologi-detalj) interpoleres inn fra
//  ui-modal-fragments.js, akkurat som før.
// ============================================================================
import { escapeHtml, TECH_CATEGORY_TABS } from "./ui.js?v=3.56";
import { SJANGER_MODAL_HTML, ARTISTLISTE_MODAL_HTML, SPILLELISTE_MODAL_HTML, TECH_DETAIL_MODAL_HTML } from "./ui-modal-fragments.js?v=3.56";

export const MODAL_HTML = `
<!-- Teknologi -->
<div class="modal-backdrop" id="modal-teknologi">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Teknologiske innovasjoner</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <!-- Kategoriene i sin egen rekkefølge; «Foreslå ny» (student) / admin-
         inngangen (lærer) ligger i SAMME rad, skjøvet helt til høyre. -->
    <div class="tech-category-tabs">
      <button class="btn ghost small tech-tab active" data-tech-cat="">Alle</button>
      ${TECH_CATEGORY_TABS.map((c) => `<button class="btn ghost small tech-tab" data-tech-cat="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`).join("")}
      <div id="tek-admin-extra" class="tech-tabs-extra"></div>
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

<!-- Enkelt tiår (les) — tidslinje-stripa øverst er selve tiårsvelgeren -->
<div class="modal-backdrop" id="modal-decade-view">
  <div class="modal">
    <div class="modal-head">
      <h2 id="dv-title"></h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <!-- Inngangen til teknologikortene står ØVERST, over tidslinje-stripa. -->
    <div id="dv-extra"></div>
    <div class="decade-ribbon" id="dv-ribbon"></div>
    <h3 class="dv-decade" id="dv-decade"></h3>
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
    <div class="dv-nav">
      <button class="btn ghost small" id="dv-prev"></button>
      <button class="btn ghost small" id="dv-next"></button>
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
    <div class="decade-ribbon" id="kart-decades" style="margin-bottom:12px"></div>
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

<!-- Sjanger-info (nås fra lærer-oversiktens rader, f.eks. foreldreløse
     undersjangre — via explore-API-ets openSubgenreInfo) -->
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
    <div class="dash-grid">
      <button class="dash-card" id="sb-om-historie">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#4d7c0f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12M6 22h12"/><path d="M8 2v4l4 4 4-4V2"/><path d="M8 22v-4l4-4 4 4v4"/></svg>
        <span class="dash-title">Om historie</span>
        <span class="dash-desc">Hvorfor musikkhistorie</span>
      </button>
      <button class="dash-card" id="sb-rotter">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v8"/><path d="M12 11c0 3-2.5 4.5-4 7"/><path d="M12 11c0 3 2.5 4.5 4 7"/><path d="M12 11v7"/><circle cx="12" cy="19.5" r="1.3"/><circle cx="7.5" cy="18.5" r="1.3"/><circle cx="16.5" cy="18.5" r="1.3"/></svg>
        <span class="dash-title">Røtter</span>
        <span class="dash-desc">Opphavet før 1910</span>
      </button>
      <button class="dash-card" id="sb-historier">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        <span class="dash-title">Sjangerhistorier</span>
        <span class="dash-desc">Fremstillingen av de seks hovedsjangrene</span>
      </button>
      <button class="dash-card" id="sb-tidslinje">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h8M9 12h12M5 17h10"/></svg>
        <span class="dash-title">Tidslinje</span>
        <span class="dash-desc">Artistenes aktive år visualisert</span>
      </button>
      <button class="dash-card" id="sb-slektstre">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><circle cx="5" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="19" cy="20" r="2"/><path d="M12 6v5M12 11c-4 0-7 3-7 7M12 11c4 0 7 3 7 7M12 11v7"/></svg>
        <span class="dash-title">Slektstre</span>
        <span class="dash-desc">Hvordan sjangrene henger sammen</span>
      </button>
      <button class="dash-card" id="sb-varmekart">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
        <span class="dash-title">Varmekart</span>
        <span class="dash-desc">Hvor toneangivende sjangrene var i ulike tiår</span>
      </button>
      <button class="dash-card" id="sb-kart">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="dash-title">Kart</span>
        <span class="dash-desc">Musikkens geografi gjennom ulike tiår</span>
      </button>
      <button class="dash-card" id="sb-himmel">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"/><circle cx="19" cy="9" r="2.2"/><circle cx="11" cy="19" r="2.2"/><path d="M8.1 6.5l8.7 2M17.7 10.7l-5.5 6.5M6.8 8.1l3.5 8.8"/></svg>
        <span class="dash-title">Sjangerhimmel</span>
        <span class="dash-desc">Artistene rundt sjangrene sine</span>
      </button>
      <button class="dash-card" id="sb-guide">
        <svg class="dash-icon" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
        <span class="dash-title">Slik bruker du appen</span>
        <span class="dash-desc">Kort om funksjonene og tanken bak</span>
      </button>
    </div>
  </div>
</div>

<!-- Slik bruker du appen: en kort bruksveiledning for studentene. Teksten bor i
     Firestore (content/appGuide, markdown-light) og redigeres via samme
     Rediger-knapp som Om historie/Røtter — ingen hardkodet tekst i koden.
     Åpnes som siste kort i «Det store bildet». -->
<div class="modal-backdrop" id="modal-app-guide">
  <div class="modal">
    <div class="modal-head">
      <h2>Slik bruker du appen</h2>
      <div id="app-guide-extra" class="head-actions"></div>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="app-guide-body" class="story-body"></div>
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
      <div id="omh-extra" class="head-actions"></div>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="om-historie-body" class="story-body"></div>
  </div>
</div>

<div class="modal-backdrop" id="modal-rotter">
  <div class="modal">
    <div class="modal-head">
      <h2>Røtter før 1910</h2>
      <div id="rotter-extra" class="head-actions"></div>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div class="rotter-links">
      <button class="btn primary" id="rotter-tre">Se slektstreet</button>
    </div>
    <div id="rotter-body" class="story-body"></div>
  </div>
</div>

<!-- Sjangerhistorier: seks forfattede fortellinger (én per metasjanger) som
     til sammen dekker pensumet. Én modal med sjanger-chips øverst — samme
     leseflate uansett historie, og bytte skjer uten modal-stabling. -->
<div class="modal-backdrop" id="modal-historier">
  <div class="modal">
    <div class="modal-head">
      <h2>Sjangerhistorier</h2>
      <div id="hist-extra" class="head-actions"></div>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted hist-intro">Seks fortellinger som til sammen dekker hele pensumet — trykk på navnene underveis for å åpne artistkortene.</p>
    <div class="hist-chips" id="hist-chips"></div>
    <div id="hist-body" class="story-body"></div>
  </div>
</div>
`;
