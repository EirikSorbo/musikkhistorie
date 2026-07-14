// ============================================================================
//  UI — OVERSIKT (lærer)
// ----------------------------------------------------------------------------
//  Pensum-oversikten i tre seksjoner: FORM (hva pensumet inneholder — tiår,
//  sjangre, kjønn, instrument), HULL (hvor det er tynt) og MANGLER (innhold
//  som ikke er skrevet ennå). Ingen arbeidsflyt-tall her — moderering bor i
//  forslags-flyten. Re-eksporteres fra ui.js.
//
//  All klikk-håndtering går via ETT delegert el.onclick (tilordning, ikke
//  addEventListener — modalen re-rendres ved hver åpning, og en lytter per
//  åpning ville stablet seg opp).
// ============================================================================

import {
  computeCounts,
  genderDistribution,
  activeArtists,
  decadesForRange,
  DECADES,
} from "./limits.js?v=3.47";
import { escapeHtml, GENDER_LABEL, pct, teacherActionRow, toggleCheckBtn } from "./ui-helpers.js?v=3.47";
import { GENEALOGY, GENEALOGY_MAIN_GENRES, GENEALOGY_META_GENRES, GENEALOGY_EDGES, edgeKey, isMainGenre } from "./genealogy.js?v=3.47";
import { resolveDesc, resolveDescAny } from "./genre-descriptions.js?v=3.47";
import { STORY_ORDER, storyFor, pageFor } from "./story-format.js?v=3.47";

const GENDER_COLORS = {
  kvinne: "var(--c-kvinne)",
  mann: "var(--c-mann)",
  annet: "var(--c-annet)",
  ukjent: "var(--c-ukjent)",
};

const byNo = (a, b) => a.localeCompare(b, "no");
const byName = (a, b) => a.name.localeCompare(b.name, "no");
const byInfluenceThenName = (a, b) =>
  (a.influenceStart || 0) - (b.influenceStart || 0) || byName(a, b);

// Kompakt fordelings-rad: navn + søyle + antall. Klikkbar via data-attributt.
function distRow(label, count, max, attrs) {
  const zero = count === 0 ? " ov-zero" : "";
  return `<button type="button" class="ov-row${zero}" ${attrs}>
    <span class="ov-name">${escapeHtml(label)}</span>
    <span class="bar small"><span class="bar-fill" style="width:${count ? pct(count, max) : 100}%"></span></span>
    <span class="ov-count">${count}</span>
  </button>`;
}

// Klikkbar navnerad i utvidbare lister (åpner redigering/info).
function nameRow(name, attrs, metaTag = "") {
  return `<div class="result-row" ${attrs} style="cursor:pointer">
    <span class="result-name" style="text-decoration:underline;color:var(--accent)">${escapeHtml(name)}</span>
    ${metaTag ? `<span class="result-meta">${metaTag}</span>` : ""}
  </div>`;
}

function artistRows(list, extraTag = () => "") {
  return list.map((a) => nameRow(a.name, `data-ov-artist="${escapeHtml(a.id)}"`,
    (a.metaGenre ? `<span class="tag">${escapeHtml(a.metaGenre)}</span>` : "") + extraTag(a))).join("");
}

// Innhold som ikke er skrevet ennå — én sannhetskilde delt av Oversikt (som
// lister hvert punkt) og Skrivebordet (som bare bruker `.total`). Returnerer
// rålistene så oppringeren kan vise navn; `total` er summen på tvers av bøtter
// (en artist som mangler både bilde og kilder teller som to punkter å fylle).
// Sider (rotter/omHistorie) teller først når innholdet faktisk er lastet.
export function contentGaps({ artists = [], genreDescs = {}, edgeDescs = {}, content = {}, contentLoaded = false }) {
  const active = activeArtists(artists);
  const subTags = [...new Set(active.flatMap((a) => [
    ...(a.mainGenre || []).filter((x) => !isMainGenre(x)),
    ...(a.subGenre || []),
  ]))];
  const stories = STORY_ORDER.filter((g) => !storyFor(g, genreDescs));
  const pages = contentLoaded ? ["rotter", "omHistorie"].filter((id) => !pageFor(id, content)) : [];
  const mainDesc = GENEALOGY
    .filter((n) => !resolveDescAny(genreDescs, [n.l, n.f], "main").description)
    .map((n) => n.l).sort(byNo);
  const subDesc = subTags
    .filter((n) => !resolveDesc(genreDescs, n, "sub").description).sort(byNo);
  // Koblingene (strekene) i slektstreet uten beskrivelse i edgeDescriptions.
  const edgeDesc = GENEALOGY_EDGES
    .filter((e) => !(edgeDescs[edgeKey(e.from, e.to)]?.description));
  const noImage = active.filter((a) => !a.imageUrl).sort(byName);
  const noDesc = active.filter((a) => !(a.description || "").trim()).sort(byName);
  const noMusic = active.filter((a) => !(a.musicExamples || []).length).sort(byName);
  const noSources = active.filter((a) => !(a.kilder || []).length).sort(byName);
  const total = stories.length + pages.length + mainDesc.length + subDesc.length + edgeDesc.length
    + noImage.length + noDesc.length + noMusic.length + noSources.length;
  return { stories, pages, mainDesc, subDesc, edgeDesc, noImage, noDesc, noMusic, noSources, total };
}

export function renderDashboard(el, {
  artists,
  config,
  genreDescs = {},
  edgeDescs = {},
  teacherChecks = {},
  techItems = [],
  content = {},
  contentLoaded = false,
  explore,
  countForGenre = () => 0,
  onEditArtist,
  onEditDesc,
  onEditEdge,
  onEdgeCheck,
  onShowArtistList,
}) {
  const active = activeArtists(artists);
  const counts = computeCounts(artists);
  const dist = genderDistribution(artists);

  // --- Nøkkeltall -----------------------------------------------------------
  // Innovasjonskort uten status-felt regnes som aktive (samme regel som store).
  const techCount = techItems.filter((t) => t.status !== "pending").length;
  const subTags = [...new Set(active.flatMap((a) => [
    ...(a.mainGenre || []).filter((x) => !isMainGenre(x)),
    ...(a.subGenre || []),
  ]))];

  // --- Sjangerliste (treets sjangre, sortert etter antall artistkort) -------
  // Tellingen (countForGenre) matcher artistlista bak sjanger-popupen, så
  // tallet her og lista der aldri spriker.
  const genreCounts = GENEALOGY_MAIN_GENRES
    .map((l) => ({ l, n: countForGenre(l) }))
    .sort((a, b) => b.n - a.n || byNo(a.l, b.l));
  const maxGenre = Math.max(1, ...genreCounts.map((g) => g.n));
  const covered = genreCounts.filter((g) => g.n > 0).length;

  // --- Hovedsjangre (metaGenre-feltet: hver artist teller nøyaktig én gang) -
  const metaCounts = GENEALOGY_META_GENRES
    .map((g) => ({ g, n: counts.perMetaGenre[g] || 0 }))
    .sort((a, b) => b.n - a.n || byNo(a.g, b.g));
  const maxMeta = Math.max(1, ...metaCounts.map((m) => m.n));

  // --- Tiår ------------------------------------------------------------------
  const decades = DECADES;
  const maxDecade = Math.max(1, ...decades.map((d) => counts.perDecade[d] || 0));
  const thinDecades = decades.filter((d) => (counts.perDecade[d] || 0) <= 1);

  // --- Instrument -------------------------------------------------------------
  // Config-lista pluss eventuelle verdier i bruk som ikke står i config.
  const instruments = [
    ...(config.instruments || []),
    ...Object.keys(counts.perInstrument)
      .filter((i) => i && i !== "undefined" && !(config.instruments || []).includes(i)),
  ];

  // --- Hull -------------------------------------------------------------------
  const artistsNoSjanger = active
    .filter((a) => !a.mainGenre || a.mainGenre.length === 0)
    .sort(byName);

  const allArtistTags = new Set(active.flatMap((a) => [...(a.mainGenre || []), ...(a.subGenre || [])]));
  // Kun ekte undersjangre: tre-sjangre uten artister dekkes av «tomme greiner»,
  // og meta-/historie-dokumenter i genreDescriptions er ikke undersjangre.
  const orphanedSubgenres = Object.keys(genreDescs)
    .filter((s) => !isMainGenre(s) && !GENEALOGY_META_GENRES.includes(s) && !allArtistTags.has(s))
    .sort(byNo);

  // --- Innhold som mangler — samme telling som Skrivebordet (contentGaps) ------
  const gaps = contentGaps({ artists, genreDescs, edgeDescs, content, contentLoaded });
  const storiesMissing = gaps.stories;
  const pageStatus = (id) => (contentLoaded ? !!pageFor(id, content) : null);
  const rotterOk = pageStatus("rotter");
  const omHistorieOk = pageStatus("omHistorie");
  const mainMissing = gaps.mainDesc;
  const subMissing = gaps.subDesc;
  const noImage = gaps.noImage;
  const noDesc = gaps.noDesc;
  const noMusic = gaps.noMusic;
  const noSources = gaps.noSources;

  // --- Markup-hjelpere -----------------------------------------------------------
  let uid = 0;
  const expandList = (rowsHtml, count) => {
    const id = `ov-x-${uid++}`;
    return {
      btn: `data-ov-toggle="${id}"`,
      panel: `<div id="${id}" class="ov-expand" style="display:none">${
        count ? `<div class="result-list">${rowsHtml}</div>` : `<p class="muted">Ingen.</p>`
      }</div>`,
    };
  };

  // Kort i «Innhold som mangler»: teller + utvidbar navneliste.
  const missItem = (label, count, rowsHtml, okText = "alle har ✓") => {
    const x = expandList(rowsHtml, count);
    return `<div class="ov-miss-item">
      <button type="button" class="ov-miss-head" ${x.btn}>
        <span>${escapeHtml(label)}</span>
        <span class="ov-count ${count ? "ov-warn" : "ov-ok"}">${count || okText}</span>
      </button>
      ${x.panel}
    </div>`;
  };

  // Binært innholdskort (Røtter / Om historie): klikk åpner siden.
  const pageItem = (label, ok, pageId) => `<div class="ov-miss-item">
    <button type="button" class="ov-miss-head" data-ov-page="${pageId}">
      <span>${escapeHtml(label)}</span>
      <span class="ov-count ${ok === null ? "" : ok ? "ov-ok" : "ov-warn"}">${ok === null ? "…" : ok ? "✓ ferdig" : "mangler"}</span>
    </button>
  </div>`;

  const histCols = decades.map((d) => {
    const n = counts.perDecade[d] || 0;
    return `<button type="button" class="ov-hist-col" data-ov-decade="${d}" title="${d}-tallet: ${n} artister — klikk for liste">
      <span class="ov-hist-val">${n}</span>
      <span class="ov-hist-bar${n <= 1 ? " ov-thin" : ""}" style="height:${Math.max(2, (n / maxDecade) * 100)}%"></span>
      <span class="ov-hist-year">${d}</span>
    </button>`;
  }).join("");

  // Historie-lista er chips (klikk åpner historien), ikke result-list —
  // panelet bygges manuelt med fast id.
  const storyChips = storiesMissing.map((g) =>
    `<button type="button" class="ov-chip ov-zero" data-ov-story="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join("");
  const storyPanel = storiesMissing.length
    ? `<div id="ov-x-stories" class="ov-expand" style="display:none"><div class="ov-chips">${storyChips}</div></div>`
    : "";

  const noSjangerX = expandList(artistRows(artistsNoSjanger), artistsNoSjanger.length);
  const orphanX = expandList(orphanedSubgenres.map((s) => nameRow(s, `data-ov-subinfo="${escapeHtml(s)}"`)).join(""), orphanedSubgenres.length);

  // --- Sjangerkoblinger (strekene i slektstreet) -----------------------------
  // Lista viser ALLE koblinger (ikke bare manglende) — dette er lærerens eneste
  // redigeringsflate for koblingstekstene, så også skrevne må kunne åpnes.
  // Hvert kort har samme fot som resten (teacherActionRow): Sjekk til venstre,
  // Rediger til høyre. «⚠ mangler» = tekst ikke skrevet (egen dimensjon fra
  // Sjekket, som betyr kvalitetslest). Manglende først, så alfabetisk.
  const nodeById = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));
  const edgeMissingSet = new Set(gaps.edgeDesc.map((e) => edgeKey(e.from, e.to)));
  const edgeChecks = new Set(teacherChecks.edges || []);
  const edgeRows = [...GENEALOGY_EDGES]
    .sort((a, b) => {
      const am = edgeMissingSet.has(edgeKey(a.from, a.to)) ? 0 : 1;
      const bm = edgeMissingSet.has(edgeKey(b.from, b.to)) ? 0 : 1;
      return am - bm || byNo(nodeById[a.from].l, nodeById[b.from].l) || byNo(nodeById[a.to].l, nodeById[b.to].l);
    })
    .map((e) => {
      const missing = edgeMissingSet.has(edgeKey(e.from, e.to));
      const checked = edgeChecks.has(edgeKey(e.from, e.to));
      const tags = `${missing ? `<span class="tag" style="color:var(--danger)">⚠ mangler</span>` : ""}${e.react ? `<span class="tag">motreaksjon</span>` : ""}`;
      return `<div class="ov-edge-card" data-ov-edge-from="${escapeHtml(e.from)}" data-ov-edge-to="${escapeHtml(e.to)}">
        <div class="ov-edge-head"><span class="ov-edge-name">${escapeHtml(nodeById[e.from].l)} → ${escapeHtml(nodeById[e.to].l)}</span>${tags}</div>
        ${teacherActionRow({ checked, edit: true, del: false })}
      </div>`;
    }).join("");
  const edgesFilled = GENEALOGY_EDGES.length - gaps.edgeDesc.length;
  const edgeX = expandList(edgeRows, GENEALOGY_EDGES.length);

  el.innerHTML = `
    <div class="ov-kick">Pensumets form</div>
    <div class="ov-kpis">
      <div class="ov-kpi">
        <span class="ov-kpi-n">${counts.total}</span>
        <span class="ov-kpi-l">Artister</span>
      </div>
      <div class="ov-kpi">
        <span class="ov-kpi-n">${covered}</span>
        <span class="ov-kpi-l">Sjangre</span>
      </div>
      <button type="button" class="ov-kpi ov-click" data-ov-open="tech">
        <span class="ov-kpi-n">${techCount}</span>
        <span class="ov-kpi-l">Innovasjonskort</span>
      </button>
      <button type="button" class="ov-kpi ov-click" data-ov-open="subgenres">
        <span class="ov-kpi-n">${subTags.length}</span>
        <span class="ov-kpi-l">Undersjangre</span>
      </button>
    </div>

    <div class="stat-card ov-block">
      <div class="stat-label">Artister per tiår — teller hele innflytelsesperioden, klikk en søyle for liste</div>
      <div class="ov-hist">${histCols}</div>
    </div>

    <div class="stat-card ov-block">
      <div class="stat-label">Sjangre i slektstreet (${genreCounts.length}) — sortert etter antall artistkort, klikk for beskrivelse og artister</div>
      <div class="ov-genre-cols">${genreCounts.map((g) =>
        distRow(g.l, g.n, maxGenre, `data-ov-genre="${escapeHtml(g.l)}"`)).join("")}</div>
    </div>

    <div class="ov-two">
      <div class="stat-card ov-block" style="margin-top:0">
        <div class="stat-label">Per hovedsjanger — klikk for artistliste</div>
        <div class="ov-rows">${metaCounts.map((m) =>
          distRow(m.g, m.n, maxMeta, `data-ov-meta="${escapeHtml(m.g)}"`)).join("")}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Kjønnsfordeling</div>
        ${renderGenderChart(dist)}
      </div>
    </div>

    <div class="stat-card ov-block">
      <div class="stat-label">Instrument — klikk for artistliste</div>
      <div class="ov-chips">${instruments.map((i) => {
        const n = counts.perInstrument[i] || 0;
        return `<button type="button" class="ov-chip${n ? "" : " ov-zero"}" data-ov-instr="${escapeHtml(i)}">${escapeHtml(i)} <strong>${n}</strong></button>`;
      }).join("")}</div>
    </div>

    <div class="ov-kick">Hull og skjevheter</div>
    <div class="ov-gaps">
      <div class="ov-gap">
        <div class="ov-gap-t">Tynne tiår <span>${thinDecades.length}</span></div>
        ${thinDecades.length
          ? `<div class="ov-chips">${thinDecades.map((d) =>
              `<button type="button" class="ov-chip ov-zero" data-ov-decade="${d}">${d} <strong>${counts.perDecade[d] || 0}</strong></button>`).join("")}</div>`
          : `<p class="muted">Ingen — alle tiår har minst to artister.</p>`}
      </div>
      <div class="ov-gap">
        <div class="ov-gap-t">Artister uten sjanger <span>${artistsNoSjanger.length}</span></div>
        ${artistsNoSjanger.length
          ? `<button type="button" class="btn ghost small" ${noSjangerX.btn}>Vis</button>${noSjangerX.panel}`
          : `<p class="muted">Ingen — alle artister er plassert.</p>`}
      </div>
      <div class="ov-gap">
        <div class="ov-gap-t">Undersjangre uten artistkort <span>${orphanedSubgenres.length}</span></div>
        ${orphanedSubgenres.length
          ? `<button type="button" class="btn ghost small" ${orphanX.btn}>Vis</button>${orphanX.panel}`
          : `<p class="muted">Ingen.</p>`}
      </div>
    </div>

    <div class="ov-kick">Innhold som mangler</div>
    <div class="ov-miss">
      <div class="ov-miss-item">
        <button type="button" class="ov-miss-head" ${storiesMissing.length ? `data-ov-toggle="ov-x-stories"` : `data-ov-story="${escapeHtml(STORY_ORDER[0])}"`}>
          <span>Sjangerhistorier</span>
          <span class="ov-count ${storiesMissing.length ? "ov-warn" : "ov-ok"}">${STORY_ORDER.length - storiesMissing.length}/${STORY_ORDER.length}</span>
        </button>
        ${storyPanel}
      </div>
      ${pageItem("Røtter før 1910", rotterOk, "rotter")}
      ${pageItem("Om historie", omHistorieOk, "omHistorie")}
      ${missItem("Sjangre uten beskrivelse", mainMissing.length,
        mainMissing.map((n) => nameRow(n, `data-ov-desc="${escapeHtml(n)}" data-ov-level="main"`)).join(""))}
      ${missItem("Undersjangre uten beskrivelse", subMissing.length,
        subMissing.map((n) => nameRow(n, `data-ov-desc="${escapeHtml(n)}" data-ov-level="sub"`)).join(""))}
      <div class="ov-miss-item">
        <button type="button" class="ov-miss-head" ${edgeX.btn}>
          <span>Sjangerkoblinger (strekene i slektstreet)</span>
          <span class="ov-count ${gaps.edgeDesc.length ? "ov-warn" : "ov-ok"}">${edgesFilled}/${GENEALOGY_EDGES.length}</span>
        </button>
        ${edgeX.panel}
      </div>
      ${missItem("Artister uten beskrivelse", noDesc.length, artistRows(noDesc))}
      ${missItem("Artister uten bilde", noImage.length, artistRows(noImage))}
      ${missItem("Artister uten musikkeksempler", noMusic.length, artistRows(noMusic))}
      ${missItem("Artister uten kilder", noSources.length, artistRows(noSources))}
    </div>
  `;

  // --- Delegert klikk-håndtering (én tilordning, overlever re-render) --------
  el.onclick = (e) => {
    const hit = (sel) => e.target.closest(sel);

    const tog = hit("[data-ov-toggle]");
    if (tog) {
      const panel = el.querySelector(`#${tog.dataset.ovToggle}`);
      if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
      return;
    }
    const artist = hit("[data-ov-artist]");
    if (artist) return onEditArtist?.(artist.dataset.ovArtist);

    const genre = hit("[data-ov-genre]");
    if (genre) return explore?.onMainGenreClick(genre.dataset.ovGenre);

    const meta = hit("[data-ov-meta]");
    if (meta) {
      const g = meta.dataset.ovMeta;
      return onShowArtistList?.(g, active.filter((a) => a.metaGenre === g).sort(byInfluenceThenName));
    }
    const dec = hit("[data-ov-decade]");
    if (dec) {
      const d = Number(dec.dataset.ovDecade);
      return onShowArtistList?.(`${d}-tallet`,
        active.filter((a) => decadesForRange(a.influenceStart, a.influenceEnd).includes(d)).sort(byInfluenceThenName));
    }
    const instr = hit("[data-ov-instr]");
    if (instr) {
      const i = instr.dataset.ovInstr;
      return onShowArtistList?.(i, active.filter((a) => a.instrument === i).sort(byName));
    }
    const sub = hit("[data-ov-subinfo]");
    if (sub) return explore?.openSubgenreInfo(sub.dataset.ovSubinfo);

    const story = hit("[data-ov-story]");
    if (story) return explore?.openHistorier(story.dataset.ovStory);

    const page = hit("[data-ov-page]");
    if (page) return page.dataset.ovPage === "rotter" ? explore?.openRotter() : explore?.openOmHistorie();

    const desc = hit("[data-ov-desc]");
    if (desc) return onEditDesc?.(desc.dataset.ovDesc, desc.dataset.ovLevel);

    // Sjekk-knappen skifter utseende optimistisk (modalen re-rendres ikke) og
    // skriver til teacherChecks. Håndteres FØR edit-fanget, ellers ville den
    // også åpnet editoren via kortets data-attributt.
    const edgeChk = hit(".tcr-check");
    if (edgeChk) {
      const card = edgeChk.closest("[data-ov-edge-from]");
      if (card) {
        const now = toggleCheckBtn(edgeChk, "tcr-check");
        onEdgeCheck?.(card.dataset.ovEdgeFrom, card.dataset.ovEdgeTo, now);
      }
      return;
    }
    // «Rediger»-knappen og klikk ellers på kortet åpner editoren.
    const edge = hit("[data-ov-edge-from]");
    if (edge) return onEditEdge?.(edge.dataset.ovEdgeFrom, edge.dataset.ovEdgeTo);

    const open = hit("[data-ov-open]");
    if (open) return open.dataset.ovOpen === "tech" ? explore?.openTeknologi() : explore?.openSubgenreList();
  };
}

function renderGenderChart(dist) {
  if (dist.total === 0) {
    return `<p class="muted">Ingen forslag ennå.</p>`;
  }
  const segments = ["kvinne", "mann", "annet", "ukjent"]
    .filter((k) => dist[k] > 0)
    .map(
      (k) =>
        `<div class="gender-seg" style="width:${pct(
          dist[k],
          dist.total
        )}%;background:${GENDER_COLORS[k]}" title="${GENDER_LABEL[k]}: ${
          dist[k]
        }"></div>`
    )
    .join("");

  const legend = ["kvinne", "mann", "annet", "ukjent"]
    .map(
      (k) => `
      <span class="legend-item">
        <span class="dot" style="background:${GENDER_COLORS[k]}"></span>
        ${GENDER_LABEL[k]}: <strong>${dist[k]}</strong>
        (${pct(dist[k], dist.total)}%)
      </span>`
    )
    .join("");

  return `
    <div class="gender-bar">${segments}</div>
    <div class="legend">${legend}</div>
  `;
}

