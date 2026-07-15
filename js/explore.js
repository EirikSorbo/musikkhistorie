import { escapeHtml, formatInfoText, renderDecadeSections, renderDecadeRibbon, renderTechList, renderTechDetail, openArtistListModal, showSubsjangerInfo, modalOpen, modalClose, setupModal, initModalHeaders, buildKilderList } from "./ui.js?v=3.54";
import { GENEALOGY_MAIN_GENRES, isMainGenre, showSjangerInfo, META_GENRE_COLOR, FAMILIES } from "./genealogy.js?v=3.54";
import { resolveDesc, missingDesc } from "./genre-descriptions.js?v=3.54";
import { isVisible, DECADES } from "./limits.js?v=3.54";
import { podcastEpisodeHtml, wireLinks } from "./ui-helpers.js?v=3.54";
import { renderStoryHtml, storyFor, pageFor, STORY_ORDER } from "./story-format.js?v=3.54";
import { MAP_VIEW, MAP_COUNTRIES, projectPoint } from "./geo-map-data.js?v=3.54";
import { aggregatePlaces, unknownPlaces } from "./geo-places.js?v=3.54";
import { renderSjangerhimmel } from "./constellation.js?v=3.54";
import { MODAL_HTML } from "./explore-modals.js?v=3.54";
import { opts, setOpts, getState, buildLinkCtx, sjangerOpts, injectTeacherRow, onMainGenreClick, showPlaylistForMainGenre, showArtistsForSjanger, showArtistsForInstrument, contentChanged, canonMain } from "./explore-context.js?v=3.54";
import { openVarmekart } from "./explore-varmekart.js?v=3.54";
import { openTidslinje, hideTidTip } from "./explore-tidslinje.js?v=3.54";

let contextMode = "society";
// Sist viste tiår i Samfunn/Teknologi-visningen — huskes innen økten så
// «lukk og åpne igjen» fortsetter der studenten slapp.
let currentDecade = null;

// Tegner innholdet i innovasjonskortet uten å åpne/heve modalen — delt av
// openTechDetail og refreshTechDetail (som tegner kortet på nytt mens
// redigerings-popupen ligger oppå det).
function fillTechDetail(t) {
  const modal = document.getElementById("modal-tech-detail");
  modal.dataset.techId = t.id;
  document.getElementById("td-title").textContent = t.name;
  const body = document.getElementById("td-body");
  renderTechDetail(body, t, buildLinkCtx());
  const foot = document.getElementById("td-foot");
  const btn = document.getElementById("td-propose");
  if (opts.onCheck) {
    // Lærer: Sjekk + Rediger + Slett (innovasjonskort er en hel enhet).
    if (foot) foot.style.display = "none";
    const extra = document.createElement("div");
    body.appendChild(extra);
    injectTeacherRow(extra, {
      category: "tech",
      id: t.id,
      // Kortet blir stående åpent — skjemaet kommer som popup oppå det.
      onEdit: opts.onTechEdit ? () => opts.onTechEdit(t) : null,
      onDelete: opts.onTechDelete ? () => { if (opts.onTechDelete(t.id)) modalClose(modal); } : null,
    });
  } else if (foot && btn && opts.onProposeEdit) {
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
}

export function openTechDetail(t) {
  fillTechDetail(t);
  modalOpen(document.getElementById("modal-tech-detail"));
}

// Kalles når teknologi-dataene endrer seg (lærer lagrer i redigerings-popupen).
// Tegner det åpne kortet på nytt fra ferske data — uten modalOpen, som ville
// hevet kortet OVER popupen. Er kortet slettet, lukkes det.
function refreshTechDetail() {
  const modal = document.getElementById("modal-tech-detail");
  if (!modal || !modal.classList.contains("open")) return;
  const t = (getState().techItems || []).find((x) => x.id === modal.dataset.techId);
  if (t) fillTechDetail(t);
  else modalClose(modal);
}

// Tiårsvelgeren er en klikkbar tidslinje-stripe øverst i selve tiårsvisningen
// (v3.35) — kortet åpner rett inn i et tiår, uten mellomliste. Lærersiden har
// sin egen variant med samme stripe (teacher-content.js: openSingleDecadeModal).
function openDecadeList(mode) {
  contextMode = mode;
  openDecadeView(currentDecade ?? DECADES[0]);
}

function openDecadeView(decadeId) {
  renderDecadeView(decadeId);
  modalOpen(document.getElementById("modal-decade-view"));
}

function renderDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  const d = Number(decadeId);
  currentDecade = d;
  const s = getState();
  const desc = s.decadeDescs[String(d)] || {};
  const isSociety = contextMode === "society";
  document.getElementById("dv-title").textContent = isSociety ? "Samfunn" : "Teknologi";
  document.getElementById("dv-decade").textContent = `${d}-tallet`;

  // Tidslinje-stripa: alle tiår som klikkbare punkter på én akse, aktivt
  // tiår uthevet. Re-render (ikke modalOpen) ved bytte — modalen står åpen.
  renderDecadeRibbon(document.getElementById("dv-ribbon"), d, renderDecadeView);

  // Teknologi har en ekstra inngang til alle innovasjonskortene (lå før i
  // tiårslista).
  const extra = document.getElementById("dv-extra");
  if (extra) {
    if (isSociety) {
      extra.innerHTML = "";
    } else {
      extra.innerHTML = `<button class="btn ghost" id="dv-btn-innovasjon" style="width:100%;margin:0 0 12px">Vis teknologi-kort</button>`;
      extra.querySelector("#dv-btn-innovasjon").addEventListener("click", () => openTeknologi());
    }
  }

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
    desc, d, s.techItems,
    {
      isSociety,
      onTechClick: openTechDetail,
      onMore: (which, text) => openDecadeMore(
        `${d}-tallet — ${which === "society" ? "samfunnsutvikling" : "teknologiutvikling"}`, text),
    }
  );

  const propSociety = document.getElementById("dv-society-propose");
  const propTech = document.getElementById("dv-tech-propose");
  if (propSociety) {
    if (isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-society", d);
      propSociety.style.display = "";
      propSociety.disabled = !!locked;
      propSociety.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propSociety.onclick = () => opts.onProposeEdit({
        entityType: "decade-society",
        entityId: String(d),
        entityName: `${d}-tallet — samfunn`,
        currentValues: { society: desc.society || "", societyMore: desc.societyMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propSociety.style.display = "none";
    }
  }
  if (propTech) {
    if (!isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-tech", d);
      propTech.style.display = "";
      propTech.disabled = !!locked;
      propTech.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propTech.onclick = () => opts.onProposeEdit({
        entityType: "decade-tech",
        entityId: String(d),
        entityName: `${d}-tallet — teknologi`,
        currentValues: { tech: desc.tech || "", techMore: desc.techMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propTech.style.display = "none";
    }
  }

  const kilderEl = document.getElementById("dv-kilder");
  if (kilderEl) kilderEl.innerHTML = buildKilderList(desc.kilder, "Kilder");

  // Forrige/neste nederst inviterer til å lese tiårene som én fortelling.
  // visibility (ikke display) i endene, så knappene beholder plassen sin.
  const idx = DECADES.indexOf(d);
  const prevBtn = document.getElementById("dv-prev");
  const nextBtn = document.getElementById("dv-next");
  if (prevBtn) {
    prevBtn.style.visibility = idx > 0 ? "" : "hidden";
    prevBtn.textContent = idx > 0 ? `← ${DECADES[idx - 1]}-tallet` : "";
    prevBtn.onclick = idx > 0 ? () => renderDecadeView(DECADES[idx - 1]) : null;
  }
  if (nextBtn) {
    const more = idx >= 0 && idx < DECADES.length - 1;
    nextBtn.style.visibility = more ? "" : "hidden";
    nextBtn.textContent = more ? `${DECADES[idx + 1]}-tallet →` : "";
    nextBtn.onclick = more ? () => renderDecadeView(DECADES[idx + 1]) : null;
  }
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

// Full render: tegner det STATISKE landomrisset (~68 KB path-data) ÉN gang, med
// et tomt prikk-lag under. Tiårsbytte kaller renderKartDots(), som kun oppdaterer
// prikkene/chips/stripa — ikke re-parser hele omrisset (merkbart på svak mobil).
function renderKart() {
  let svg = `<div style="overflow-x:auto"><svg viewBox="0 0 ${MAP_VIEW.w} ${MAP_VIEW.h}" style="width:100%;min-width:560px;display:block" role="img" aria-label="Kart over Nord-Amerika med artistenes virkesteder">`;
  svg += MAP_COUNTRIES.map((c) =>
    `<path d="${c.d}" style="fill:var(--bg-soft,#eef1f4);stroke:var(--line-strong,#cbd5df);stroke-width:0.7" />`).join("");
  svg += `<g id="kart-dots"></g></svg></div>`;
  document.getElementById("kart-svg").innerHTML = svg;
  renderKartDots();
}

function renderKartDots() {
  const s = getState();
  const active = s.artists.filter(isVisible);
  const { onMap, abroad, unplaced } = aggregatePlaces(active, { decade: kartDecade });
  const DOT = "#1d4ed8";   // én kulør — størrelse bærer informasjonen

  // Tiårsvelger: samme klikkbare tidslinje-stripe som Samfunn/Teknologi bruker,
  // pluss en «Alle»-prikk helt til venstre. kartDecade === null betyr alle tiår.
  renderDecadeRibbon(document.getElementById("kart-decades"), kartDecade, (d) => {
    kartDecade = d;
    renderKartDots();
  }, { all: true });

  // Prikkene: radius ~ kvadratrot av antall (arealet skalerer med antallet);
  // tekstetikett på de største. Skrives inn i det statiske omrissets prikk-lag.
  const r = (n) => Math.min(3 + 2.1 * Math.sqrt(n), 17);
  const placed = onMap.map((p, i) => ({ ...p, ...projectPoint(p.lat, p.lng), i }));
  // Store prikker tegnes først så små forblir klikkbare oppå.
  placed.sort((a, b) => b.count - a.count);
  let dots = placed.map((p) => {
    const style = p.region
      ? `fill:${DOT};fill-opacity:0.10;stroke:${DOT};stroke-width:1.2;stroke-dasharray:4 3`
      : `fill:${DOT};fill-opacity:0.68;stroke:#fff;stroke-width:1`;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r(p.count).toFixed(1)}" data-place="${p.i}" style="${style};cursor:pointer"><title>${escapeHtml(`${p.label} · ${p.count} artist${p.count === 1 ? "" : "er"}`)}</title></circle>`;
  }).join("");
  dots += placed.filter((p) => p.count >= 6).map((p) =>
    `<text x="${(p.x + r(p.count) + 3).toFixed(1)}" y="${(p.y + 3.5).toFixed(1)}" style="font-size:13px;fill:var(--text,#1f2937);pointer-events:none">${escapeHtml(p.label)}</text>`).join("");
  const dotsG = document.getElementById("kart-dots");
  dotsG.innerHTML = dots;
  dotsG.querySelectorAll("[data-place]").forEach((el) => {
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

// Sjanger-info-modalen: brukes av lærer-oversikten (data-ov-subinfo-radene,
// via explore-API-et) — under-chips i student-visningen går i stedet gjennom
// den delte showSubsjangerInfo (modal-sjanger).
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

  injectTeacherRow(document.getElementById("sgi-extra"), {
    category: "subgenres",
    id: subgenreId,
    onEdit: opts.onSubgenreEdit
      ? () => { modalClose(modal); opts.onSubgenreEdit(subgenreId, "sub"); }
      : null,
  });

  modalOpen(modal);
}

// Samleinngang for «vis meg helheten»: alle tidslinjer og visuelle oversikter
// bak ett dashbordkort, uten at de flyttes fra innholdsmodalene sine.
function openStoreBildet() {
  modalOpen(document.getElementById("modal-store-bildet"));
}

// Bruksveiledningen: teksten bor i Firestore (content/appGuide) og rendres ved
// hver åpning — samme mønster som Om historie/Røtter, med Rediger-knapp for
// lærer. Åpnes OPPÅ huben som de andre kortene, så ← går tilbake dit.
function openAppGuide() {
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

function openHistorier(genre) {
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
  ["modal-teknologi", "modal-podkast", "modal-decade-view",
   "modal-decade-more", "modal-subgenre-list", "modal-undersjangre", "modal-subgenre-info",
   "modal-varmekart", "modal-vk-edit", "modal-tidslinje", "modal-kart", "modal-sjangerhimmel",
   "modal-artistliste", "modal-spilleliste", "modal-sjanger", "modal-tech-detail",
   "modal-store-bildet", "modal-app-guide", "modal-om-historie", "modal-rotter", "modal-historier"].forEach((id) => setupModal(id));

  // Tidslinjens hover-kort er position:fixed — fjern det når modalen lukkes på
  // ANY måte (Escape/backdrop/«Lukk alle»), ellers kan det bli hengende svevende
  // over dashbordet hvis pekeren sto i ro over en blokk ved lukking.
  const tlModal = document.getElementById("modal-tidslinje");
  if (tlModal && "MutationObserver" in window) {
    new MutationObserver(() => { if (!tlModal.classList.contains("open")) hideTidTip(); })
      .observe(tlModal, { attributes: true, attributeFilter: ["class"] });
  }

  // Røtter-sidens ene navigasjonsknapp (statisk markup — innholdet bor i
  // Firestore). Står over teksten, ikke under den, og fyller bredden.
  const rotterTre = document.getElementById("rotter-tre");
  if (rotterTre) {
    if (opts.onSlektstre) rotterTre.addEventListener("click", () => opts.onSlektstre());
    else rotterTre.style.display = "none";
  }

  const slExtra = document.getElementById("sl-extra");
  if (slExtra) {
    // Sjangertreet er hovedinngangen — egen rad øverst, grønn og i full bredde.
    // Under: Hovedsjangere → sjangerhistoriene (én fortelling per hovedsjanger)
    // og Undersjangere → chip-lista i egen modal. Nederst de visuelle
    // oversiktene. De fire nederste deler bredden likt (flex:1, to per rad).
    let btns = "";
    if (opts.onSlektstre) {
      btns += `<div style="display:flex;margin-bottom:10px">`;
      btns += `<button class="btn primary" id="btn-slektstre" style="flex:1">Sjangertre</button>`;
      btns += `</div>`;
    }
    btns += `<div style="display:flex;gap:10px;margin-bottom:10px">`;
    btns += `<button class="btn ghost" id="btn-hovedsjangere" style="flex:1">Hovedsjangere</button>`;
    btns += `<button class="btn ghost" id="btn-undersjangere" style="flex:1">Undersjangere</button>`;
    btns += `</div>`;
    btns += `<div style="display:flex;gap:10px;margin-bottom:14px">`;
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
    sbModal.querySelector("#sb-guide").addEventListener("click", openAppGuide);
  }

  // Ligger i kategorirad-en (se MODAL_HTML) — samme knappestørrelse som fanene.
  const tekExtra = document.getElementById("tek-admin-extra");
  if (opts.onTechAdmin && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost small" id="btn-tech-admin">Rediger kort</button>`;
    tekExtra.querySelector("#btn-tech-admin").addEventListener("click", () => {
      modalClose(document.getElementById("modal-teknologi"));
      opts.onTechAdmin();
    });
  } else if (opts.onProposeNewTech && tekExtra) {
    tekExtra.innerHTML = `<button class="btn ghost small" id="btn-tech-new">Foreslå ny</button>`;
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
      // Under-chips viser alltid sub-nivået (popupen har selv en «Se (sjanger)»-
      // snarvei når navnet også er en tre-sjanger).
      showSubsjangerInfo(name, sjangerOpts());
      if (opts.onMainGenreCheck) opts.onMainGenreCheck(name);
      return;
    }
    const inst = e.target.closest("[data-instrument]");
    if (inst) showArtistsForInstrument(inst.dataset.instrument);
  });
}

export function initExplore(options) {
  setOpts(options);
  injectModals();
  wireModals();
  return {
    openDecadeList,
    openSubgenreList,
    openVarmekart,
    openTidslinje,
    openStoreBildet,
    openAppGuide,
    openOmHistorie,
    openRotter,
    openHistorier,
    openPodkast,
    openTeknologi,
    openTechDetail,
    refreshTechDetail,
    buildLinkCtx,
    showArtistsForSjanger,
    showPlaylistForMainGenre,
    onMainGenreClick,
    openSubgenreInfo,
    contentChanged,
  };
}

