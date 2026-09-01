// ============================================================================
//  LÆRER — INNHOLDSREDIGERING
// ----------------------------------------------------------------------------
//  Tiår- og sjangerbeskrivelser (enkeltmodaler), teknologi-admin og podkast-
//  administrasjon. Deler tilstand/eksplore via teacher-state.
// ============================================================================

import { state, ctx, openAdminModal, closeAdminModal, setContentCheck, guardTeacherAction } from "./teacher-state.js?v=5.04";
import { saveDecadeDesc, saveGenreDescLevel, saveEdgeDesc, saveStoryBody, clearStory, savePage, deletePage, saveReferanser, addTech, updateTech, deleteTech, addPodcast, updatePodcast, deletePodcast } from "./store.js?v=5.04";
import { resolveMainDesc } from "./genealogy.js?v=5.04";
import { dropboxDirectUrl } from "./util.js?v=5.04";
import { GENEALOGY, edgeKey } from "./genre-model.js?v=5.04";
import { storyFor, pageFor } from "./story-format.js?v=5.04";
import { renderRichText } from "./rich-text.js?v=5.04";
import { wrapSelection, prefixLines } from "./format-bar.js?v=5.04";
import { escapeHtml, buildKilderList, buildMainGenreList, renderDecadeSections, renderDecadeRibbon, setupModal, modalOpen, techImage, fillSelect } from "./ui.js?v=5.04";
import { resolveDesc } from "./genre-descriptions.js?v=5.04";
import { renderPodcastList, wirePlayerCloseGuard, wireCharCount, checkBtnHtml, toggleCheckBtn, teacherActionRow, wireTeacherRow, techFactsLines, ICONS } from "./ui-helpers.js?v=5.04";
import { DECADES, DECADE_OPTIONS, INSTRUMENT_TIMELINE_GROUPS, INSTRUMENT_TITLE, instrumentPageId, SAMMENDRAG_MAKS } from "./limits.js?v=5.04";
import { heatRow, getHeatData } from "./heat-strip.js?v=5.04";

const LEVEL_LABEL = { meta: "metasjanger", main: "sjanger", sub: "undersjanger" };
import { wireAllLinks } from "./linkify.js?v=5.04";
import { $ } from "./shared.js?v=5.04";
import { SOURCE_SPEC, addRow, buildRows, collectRows, normalizeSources } from "./row-editor.js?v=5.04";

// ----------------------------------------------------------------------------
//  Tiår- og sjangerbeskrivelser (enkeltmodaler)
// ----------------------------------------------------------------------------

let teacherContextMode = "society";

// Delt render for lærer-tiårsmodalen (tekst + tidslinjer + les-mer + kilder-
// visning). Brukt av openSingleDecadeModal OG etter lagring, så visningen ikke
// blir stående med utdaterte les-mer-knapper/kilder etter at læreren har lagret.
function renderDecadeSingleSections(decadeId, desc, isSociety) {
  renderDecadeSections(
    {
      societyEl: $("#ds-society-text"), techEl: $("#ds-tech-text"),
      techTl: $("#ds-tech-timeline"),
    },
    desc, decadeId, state.techItems,
    {
      isSociety,
      onTechClick: (t) => ctx.explore.openTechDetail(t),
    }
  );
  const kilderEl = $("#ds-kilder-view");
  if (kilderEl) kilderEl.innerHTML = buildKilderList(desc.kilder, "Kilder");
}

// Sist viste tiår — huskes innen økten, så Samfunn/Teknologi-kortene åpner
// der læreren slapp (samme oppførsel som studentsiden).
let lastDecade = null;

export function openDecadeAdmin(mode) {
  openSingleDecadeModal(lastDecade ?? DECADES[0], mode);
}

export function openSingleDecadeModal(decadeId, mode) {
  if (mode) teacherContextMode = mode;
  const d = Number(decadeId);
  lastDecade = d;
  const desc = state.decadeDescs[String(d)] || {};
  const modal = $("#modal-decade-single");
  const isSociety = teacherContextMode === "society";
  $("#decade-single-title").textContent = isSociety ? "Samfunn" : "Teknologi";
  const heading = $("#ds-decade");
  if (heading) heading.textContent = `${d}-tallet`;

  // Teknologi har samme ekstra inngang til alle innovasjonskortene som
  // studentvisningen (explore-decade.js: #dv-extra). Læreren får den samme
  // kortlista — «Rediger kort» inne i den fører videre til admin-lista.
  const extra = $("#ds-extra");
  if (extra) {
    if (isSociety) {
      extra.innerHTML = "";
    } else {
      extra.innerHTML = `<button class="btn ghost" id="ds-btn-innovasjon" style="width:100%;margin:0 0 12px">Vis teknologi-kort</button>`;
      extra.querySelector("#ds-btn-innovasjon").addEventListener("click", () => ctx.explore.openTeknologi());
    }
  }

  // Samme tidslinje-stripe som studentvisningen. Bytte av tiår i redigerings-
  // modus varsler først — ulagrede endringer forkastes ved re-render.
  renderDecadeRibbon($("#ds-ribbon"), d, (y) => {
    const editing = $("#ds-edit").style.display !== "none";
    if (editing && !confirm("Bytte tiår? Endringer som ikke er lagret, går tapt.")) return;
    openSingleDecadeModal(y, teacherContextMode);
  });

  // Sjekk + Rediger som ikonknapper (samme rad som alle andre kort). Samfunn og
  // teknologi sjekkes hver for seg (teacherChecks.decades / decadesTech) — samme
  // to kort som på Skrivebordet — så knappen følger hvilket aspekt som vises.
  const checkField = isSociety ? "decades" : "decadesTech";
  const actions = $("#ds-actions");
  if (actions) {
    actions.innerHTML = teacherActionRow({
      checked: (state.teacherChecks?.[checkField] || []).includes(String(d)),
      edit: true, del: false,
    });
    wireTeacherRow(actions, {
      onCheck: (on) => setContentCheck(checkField, String(d), on),
      onEdit: () => {
        $("#ds-view").style.display = "none";
        $("#ds-edit").style.display = "";
      },
    });
  }

  $("#ds-society-section").style.display = isSociety ? "" : "none";
  $("#ds-tech-section").style.display = isSociety ? "none" : "";
  renderDecadeSingleSections(d, desc, isSociety);

  $("#ds-society").value = desc.society || "";
  $("#ds-tech").value = desc.tech || "";
  buildDecadeKilderRows(desc.kilder || []);
  $("#ds-msg").textContent = "";

  $("#ds-edit-society").style.display = isSociety ? "" : "none";
  $("#ds-edit-tech").style.display = isSociety ? "none" : "";

  $("#ds-view").style.display = "";
  $("#ds-edit").style.display = "none";

  modal.dataset.decade = decadeId;
  openAdminModal("modal-decade-single");
}

// Main-nivået går via genealogy.js sin resolveMainDesc — SAMME funksjon som
// sjanger-popupen viser fra, så editoren aldri åpner tom over en tekst som
// står i popupen. Sub-nivået er fri tekst uten tre-node: eksakt doc-ID.
function resolveDescForEdit(genreId, level) {
  return level === "main"
    ? resolveMainDesc(state.genreDescs, genreId)
    : resolveDesc(state.genreDescs, genreId, level);
}

export function openSingleSubgenreModal(subgenreId, level = "sub") {
  const resolved = resolveDescForEdit(subgenreId, level);
  $("#subgenre-single-title").textContent = `${subgenreId} (${LEVEL_LABEL[level] || level})`;
  $("#ss-desc").value = resolved.description || "";
  $("#ss-msg").textContent = "";
  buildKilderRows($("#ss-kilder-rows"), resolved.kilder);
  // Epoke-feltene gjelder bare tre-sjangre. Hint-linja viser hvilke tiår
  // varmekartet faktisk har tall for, så læreren ser epoken og pensumdekningen
  // side om side når de spriker (de måler ulike ting — se Oppskrift-fila).
  const epokeWrap = $("#ss-epoke-wrap");
  if (epokeWrap) {
    const isMain = level === "main";
    epokeWrap.hidden = !isMain;
    if (isMain) {
      $("#ss-active-from").value = Number.isInteger(resolved.activeFrom) ? resolved.activeFrom : "";
      $("#ss-active-to").value = Number.isInteger(resolved.activeTo) ? resolved.activeTo : "";
      $("#ss-era").value = resolved.era || "";
      $("#ss-epoke-hint").textContent = epokeHint(subgenreId);
    }
  }
  // Lytteforslagene er én per linje i tekstfeltet, en liste i data.
  const lyttWrap = $("#ss-lytt-wrap");
  if (lyttWrap) {
    lyttWrap.hidden = level !== "main";
    if (level === "main") $("#ss-lytt").value = (resolved.lytt || []).join("\n");
  }
  buildUsikreRows(Array.isArray(resolved.usikre) ? resolved.usikre : []);
  const modal = $("#modal-subgenre-single");
  modal.dataset.subgenre = subgenreId;
  modal.dataset.level = level;
  openAdminModal("modal-subgenre-single");
}

// Usikre påstander fra en kildegjennomgang: hva som mangler belegg, hvorfor det
// likevel står i teksten, og hvor det kan avgjøres. Læreren kvitterer ut ett og
// ett med «Avklart» — raden fjernes fra DOM, og lagring skriver det som er
// igjen. Er lista tom, skjules hele blokken (ingen tom overskrift i skjemaet).
function buildUsikreRows(usikre) {
  const wrap = $("#ss-usikre-wrap");
  const rows = $("#ss-usikre-rows");
  if (!wrap || !rows) return;
  rows.innerHTML = "";
  wrap.hidden = usikre.length === 0;
  usikre.forEach((u) => {
    const rad = document.createElement("div");
    rad.className = "ss-usikker";
    rad.dataset.usikker = JSON.stringify(u);
    rad.innerHTML =
      `<div class="ss-usikker-tekst">${escapeHtml(u.tekst || "")}</div>` +
      (u.hvorfor ? `<div class="hint">${escapeHtml(u.hvorfor)}</div>` : "") +
      (u.hvorSjekke ? `<div class="hint"><strong>Sjekk mot:</strong> ${escapeHtml(u.hvorSjekke)}</div>` : "") +
      `<button type="button" class="btn ghost small ss-usikker-ok">Avklart</button>`;
    rows.appendChild(rad);
  });
}

// Det som står igjen i DOM etter eventuelle «Avklart»-klikk.
function collectUsikreRows() {
  return [...document.querySelectorAll("#ss-usikre-rows .ss-usikker")]
    .map((r) => { try { return JSON.parse(r.dataset.usikker); } catch { return null; } })
    .filter(Boolean);
}

// Sammenligningsgrunnlaget under epoke-feltene: tiårsspennet varmekartet har
// verdier i. Fram til v4.64 viste linja også «Treets era-tekst: …», fordi
// friteksten lå på treets node og altså i en HELT annen editor. Nå står den i
// skjemaet rett over, og krysshenvisningen er unødvendig.
function epokeHint(genreId) {
  const node = GENEALOGY.find((n) => n.l === genreId || n.f === genreId);
  const deler = [];
  const vals = heatRow(getHeatData(), node?.l || genreId);
  const varme = vals.map((v, i) => (v > 0 ? DECADES[i] : null)).filter((d) => d !== null);
  deler.push(varme.length
    ? `Varmekartet har artister ${varme[0]}–${varme[varme.length - 1]}`
    : "Varmekartet har ingen artister på denne sjangeren");
  return deler.join(" · ");
}

// Rediger beskrivelsen for én kobling (strek i slektstreet). Doc-ID i
// edgeDescriptions = edgeKey(fra, til); tittelen viser de fulle navnene.
export function openSingleEdgeModal(fromId, toId) {
  const map = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));
  const a = map[fromId], b = map[toId];
  if (!a || !b) return;
  const react = (b.rx || []).includes(fromId);
  const docData = state.edgeDescs[edgeKey(fromId, toId)] || {};
  $("#edge-single-title").textContent = `${a.f} → ${b.f}`;
  $("#edge-single-type").textContent = react
    ? "Motreaksjon: hvorfor gjorde den nye sjangeren opprør mot den gamle?"
    : "Avstamning / påvirkning: hva ble ført videre, og hva ble nytt?";
  $("#es-desc").value = docData.description || "";
  $("#es-msg").textContent = "";
  buildKilderRows($("#es-kilder-rows"), docData.kilder);
  const modal = $("#modal-edge-single");
  modal.dataset.edgeFrom = fromId;
  modal.dataset.edgeTo = toId;
  openAdminModal("modal-edge-single");
}

export function setupEdgeSingleSave() {
  const addKilderBtn = $("#es-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#es-kilder-rows")));

  $("#es-save").addEventListener("click", async () => {
    const modal = $("#modal-edge-single");
    const description = $("#es-desc").value.trim();
    const kilder = collectKilderRows($("#es-kilder-rows"));
    const msg = $("#es-msg");
    try {
      await saveEdgeDesc(edgeKey(modal.dataset.edgeFrom, modal.dataset.edgeTo), { description, kilder });
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";
      setTimeout(() => closeAdminModal("modal-edge-single"), 800);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

function buildDecadeKilderRows(kilder) {
  buildKilderRows($("#ds-kilder-rows"), kilder);
}

// Kilder-radene bruker den delte row-editor.js (samme SOURCE_SPEC som student-
// og lærer-artistskjemaet). Tar HELE kildeobjektet: en variant som bare bar
// text/url strøk kategori, forfatter og årstall fra samtlige kilder ved neste
// lagring (feltene kom til i v4.39/v4.40 uten at denne ble med) — ett trykk på
// Lagre flyttet alle kildene stille til «Ukategorisert» i Referanser-kortet.
function addKilderRow(wrap, kilde = {}) {
  return addRow(wrap, SOURCE_SPEC, kilde);
}

// Bygg kilderadene fra en lagret liste: normaliserer (strenger/gamle former)
// og garanterer minst én tom rad. Samme rute for sjanger-, koblings- og
// tiårseditoren, så ingen av dem kan miste et felt de andre bevarer.
function buildKilderRows(wrap, kilder) {
  if (!wrap) return;
  wrap.innerHTML = "";
  const liste = normalizeSources(kilder);
  (liste.length ? liste : [{}]).forEach((k) => addKilderRow(wrap, k));
}

function collectKilderRows(wrap) {
  return collectRows(wrap, SOURCE_SPEC);
}

export function setupSubgenreSingleSave() {
  const addKilderBtn = $("#ss-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#ss-kilder-rows")));

  // «Avklart» fjerner bare raden fra DOM — den forsvinner først for godt når
  // læreren faktisk lagrer, så et feilklikk kan angres ved å lukke uten å lagre.
  const usikreRows = $("#ss-usikre-rows");
  if (usikreRows) usikreRows.addEventListener("click", (e) => {
    if (!e.target.closest(".ss-usikker-ok")) return;
    e.target.closest(".ss-usikker").remove();
    if (!usikreRows.children.length) $("#ss-usikre-wrap").hidden = true;
  });

  $("#ss-save").addEventListener("click", async () => {
    const modal = $("#modal-subgenre-single");
    const subgenreId = modal.dataset.subgenre;
    const level = modal.dataset.level || "sub";
    const description = $("#ss-desc").value.trim();
    const kilder = collectKilderRows($("#ss-kilder-rows"));
    const msg = $("#ss-msg");
    // Epoken lagres KUN på main-nivå (tre-sjangre). Tomt felt = ingen verdi,
    // ikke 0 — null lar sjangerkortet falle tilbake på fritekst-epoken.
    const data = { description, kilder, usikre: collectUsikreRows() };
    if (level === "main") {
      const num = (sel) => {
        const raw = $(sel).value.trim();
        if (!raw) return null;
        const v = parseInt(raw, 10);
        return Number.isInteger(v) && v >= 1600 && v <= 2100 ? v : null;
      };
      const from = num("#ss-active-from"), to = num("#ss-active-to");
      if (from !== null && to !== null && to < from) {
        msg.textContent = "«Til år» kan ikke være før «Fra år».";
        msg.className = "form-msg error";
        return;
      }
      data.activeFrom = from;
      data.activeTo = to;
      data.era = $("#ss-era").value.trim();
      data.lytt = $("#ss-lytt").value.split("\n").map((x) => x.trim()).filter(Boolean);
    }
    try {
      await saveGenreDescLevel(subgenreId, level, data);
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";
      setTimeout(() => closeAdminModal("modal-subgenre-single"), 800);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

export function setupDecadeSingleSave() {
  // Rediger-knappen bor i #ds-actions-raden og kobles per åpning
  // (openSingleDecadeModal) — ingen statisk knapp lenger.
  const addKilderBtn = $("#ds-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#ds-kilder-rows")));

  $("#ds-save").addEventListener("click", async () => {
    const modal = $("#modal-decade-single");
    const decadeId = modal.dataset.decade;
    const society = $("#ds-society").value.trim();
    const tech = $("#ds-tech").value.trim();
    const kilder = collectKilderRows($("#ds-kilder-rows"));
    const msg = $("#ds-msg");
    try {
      await saveDecadeDesc(decadeId, { society, tech, kilder });
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";

      // Re-render fra de nettopp lagrede verdiene (også les-mer-knapper og
      // kilder — ikke bare tekst/tidslinjer som før, som ga stale visning).
      renderDecadeSingleSections(decadeId, { society, tech, kilder }, teacherContextMode === "society");

      setTimeout(() => {
        $("#ds-view").style.display = "";
        $("#ds-edit").style.display = "none";
        msg.textContent = "";
      }, 800);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

// ----------------------------------------------------------------------------
//  Teknologi-admin
// ----------------------------------------------------------------------------

export function openTechAdmin() {
  // Nullstill filteret FØR render: fanevisningen ble satt til «Alle», men
  // modulvariabelen beholdt forrige kategori — modalen åpnet da med «Alle»
  // aktiv og lista fortsatt filtrert.
  techAdminCat = "";
  renderTechAdmin();
  const modal = document.getElementById("modal-tech-admin");
  modal.querySelectorAll(".tech-tab").forEach(b => b.classList.toggle("active", !b.dataset.techCat));
  openAdminModal("modal-tech-admin");
}

// Ett innovasjonskort i egen popup — brukt av «Rediger» i kortdetaljen
// (explore.onTechEdit), av rediger-knappen i admin-lista og av «+ Ny
// innovasjon». Popupen legger seg OPPÅ det du kom fra (kortet eller lista), så
// skjemaet aldri er noe man må rulle nedover i en lang liste for å finne.
// t === null → tomt skjema (nytt kort).
// t = eksisterende kort, eller null for et nytt. `preset` forhåndsutfyller et
// NYTT kort (Instrumenter-seksjonen sender { instrument, category }).
// NB: preset må aldri sendes som `t` — fillTechForm ville da satt editId til
// strengen "undefined" (t er sann, t.id finnes ikke), og lagringen hadde
// skrevet til et dokument med den ID-en i stedet for å opprette et nytt.
export function openTechEditor(t, preset = null) {
  fillTechForm(t, preset);
  const title = document.getElementById("tech-single-title");
  if (title) {
    title.textContent = t ? `Rediger: ${t.name}`
      : preset?.instrument ? `Nytt kort: ${preset.instrument}`
      : "Ny innovasjon";
  }
  openAdminModal("modal-tech-single");
}

// Admin-lista tegnes på nytt når teknologi-snapshotet lander (lagt til /
// oppdatert / slettet), men bare hvis den faktisk står åpen.
export function refreshTechAdmin() {
  const modal = document.getElementById("modal-tech-admin");
  if (modal?.classList.contains("open")) renderTechAdmin();
}

let techAdminCat = "";

function renderTechAdmin() {
  const el = document.getElementById("tech-admin-list");
  if (!el) return;
  const filtered = techAdminCat ? state.techItems.filter(t => t.category === techAdminCat) : state.techItems;
  if (!filtered.length) {
    el.innerHTML = `<p class="muted empty">Ingen teknologier i denne kategorien ennå.</p>`;
    return;
  }
  el.className = "tech-grid";
  el.innerHTML = filtered.map(t => {
    const img = techImage(t);
    return `<article class="card" data-tech-id="${escapeHtml(t.id)}">
      <header class="card-head">
        ${img}
        <h3>${escapeHtml(t.name)}</h3>
        ${techFactsLines(t)}
      </header>
      ${t.description ? `<div class="desc rt">${renderRichText(t.description, { artists: state.artists, techItems: state.techItems, genres: buildMainGenreList(state.artists) })}</div>` : ""}
      <div class="card-foot teacher-card-actions" style="margin-top:auto;padding-top:8px">
        ${checkBtnHtml((state.teacherChecks?.tech || []).includes(t.id), "tech-check-btn")}
        <div class="spacer"></div>
        <button class="icon-btn tech-edit-btn" title="Rediger" aria-label="Rediger">${ICONS.edit}</button>
        <button class="icon-btn danger tech-del-btn" title="Slett" aria-label="Slett">${ICONS.trash}</button>
      </div>
    </article>`;
  }).join("");

  wireAllLinks(el, ctx.explore ? ctx.explore.buildLinkCtx() : {});

  el.querySelectorAll(".tech-check-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-tech-id]").dataset.techId;
      setContentCheck("tech", id, toggleCheckBtn(btn, "tech-check-btn"));
    });
  });

  el.querySelectorAll(".tech-del-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("[data-tech-id]").dataset.techId;
      if (confirm("Slette dette innovasjonskortet?")) await guardTeacherAction(deleteTech(id));
    });
  });

  el.querySelectorAll(".tech-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-tech-id]").dataset.techId;
      const t = state.techItems.find(x => x.id === id);
      if (t) openTechEditor(t);
    });
  });
}

// Kategori gjelder bare teknologi. På en hendelse skjules feltet og tømmes, så
// et kort som byttes til hendelse ikke drar med seg «Opptak og avspilling».
function techTypeToggle() {
  const hendelse = document.querySelector("#tech-type input:checked")?.value === "hendelse";
  const felt = document.getElementById("tech-category-felt");
  if (felt) felt.hidden = hendelse;
  if (hendelse) document.getElementById("tech-category").value = "";
}

function fillTechForm(t, preset = null) {
  document.getElementById("tech-name").value = t ? t.name || "" : "";
  // Typen styrer om kategori-feltet vises — se wireTechTypeToggle.
  const type = t?.type === "hendelse" ? "hendelse" : "innovasjon";
  document.querySelector(`#tech-type input[value="${type}"]`).checked = true;
  document.getElementById("tech-category").value = t ? t.category || "" : (preset?.category || "");
  techTypeToggle();
  // Instrumentgruppen avgjør hvilken tidslinje kortet havner på i Instrumenter-
  // seksjonen. Tomt = kortet vises kun under Teknologi.
  fillSelect(document.getElementById("tech-instrument"), INSTRUMENT_TIMELINE_GROUPS,
    { placeholder: "Ingen / gjelder ikke ett instrument" });
  document.getElementById("tech-instrument").value = t ? t.instrument || "" : (preset?.instrument || "");
  // Kilder som strukturerte rader (tekst + lenke), som i artistskjemaet.
  buildRows(document.getElementById("tech-source-rows"), SOURCE_SPEC,
    normalizeSources(t?.kilder));
  document.getElementById("tech-invented").value = t ? t.inventedYear || "" : "";
  document.getElementById("tech-adopted").value = t ? t.adoptedYear || "" : "";
  document.getElementById("tech-adopted-label").value = t ? t.adoptedLabel || "" : "";
  // Tiåret er et nedtrekk fra v4.98 — fyll FØR verdien settes, ellers finnes
  // ikke opsjonen ennå og feltet står tomt (samme rekkefølge som instrument).
  fillSelect(document.getElementById("tech-decade"), DECADE_OPTIONS, { placeholder: "Velg tiår …" });
  document.getElementById("tech-decade").value = t ? t.decade || "" : "";
  document.getElementById("tech-desc").value = t ? t.description || "" : "";
  document.getElementById("tech-image-url").value = t ? t.imageUrl || "" : "";
  document.getElementById("tech-image-credit").value = t ? t.imageCredit || "" : "";
  document.getElementById("tech-msg").textContent = "";
  document.getElementById("tech-save").dataset.editId = t?.id || "";
}

export function setupTechAdmin() {
  const modal = document.getElementById("modal-tech-admin");
  if (!modal) return;
  setupModal(modal);

  modal.querySelectorAll(".tech-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      modal.querySelectorAll(".tech-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      techAdminCat = btn.dataset.techCat || "";
      renderTechAdmin();
    });
  });

  document.getElementById("tech-new-btn").addEventListener("click", () => openTechEditor(null));
  document.getElementById("tech-add-source").addEventListener("click", () =>
    addRow(document.getElementById("tech-source-rows"), SOURCE_SPEC, {}));
  document.querySelectorAll('#tech-type input[type="radio"]')
    .forEach((r) => r.addEventListener("change", techTypeToggle));

  document.getElementById("tech-save").addEventListener("click", async () => {
    const name = document.getElementById("tech-name").value.trim();
    const msg = document.getElementById("tech-msg");
    if (!name) { msg.textContent = "Navn er påkrevd."; msg.className = "form-msg error"; return; }
    const data = {
      name,
      type: document.querySelector("#tech-type input:checked")?.value || "innovasjon",
      category: document.getElementById("tech-category").value,
      instrument: document.getElementById("tech-instrument").value,
      kilder: collectRows(document.getElementById("tech-source-rows"), SOURCE_SPEC)
        .filter((k) => k.text),
      inventedYear: parseInt(document.getElementById("tech-invented").value) || null,
      adoptedYear: parseInt(document.getElementById("tech-adopted").value) || null,
      adoptedLabel: document.getElementById("tech-adopted-label").value.trim(),
      decade: document.getElementById("tech-decade").value.trim(),
      description: document.getElementById("tech-desc").value.trim(),
      imageUrl: document.getElementById("tech-image-url").value.trim(),
      imageCredit: document.getElementById("tech-image-credit").value.trim(),
    };
    const editId = document.getElementById("tech-save").dataset.editId;
    try {
      if (editId) await updateTech(editId, data);
      else await addTech(data);
      msg.textContent = editId ? "Oppdatert ✓" : "Lagt til ✓";
      msg.className = "form-msg ok";
      // Popupen lukkes, og du er tilbake der du kom fra — kortet, lista eller
      // tidslinjen. Begge stedene tegnes på nytt av teknologi-snapshotet
      // (teacher.js → subscribeTech), så endringen synes med én gang.
      setTimeout(() => closeAdminModal("modal-tech-single"), 800);
    } catch (err) {
      msg.textContent = "Feil: " + err.message; msg.className = "form-msg error";
    }
  });
}

// ----------------------------------------------------------------------------
//  Podkast-administrasjon
// ----------------------------------------------------------------------------

export function openPodkastAdmin() {
  const modal = document.getElementById("modal-podkast-admin");
  // Samme spørsmål som studentene får: lukker læreren modalen midt i en
  // episode, velger hen selv om lyden skal følge med ut.
  wirePlayerCloseGuard(modal, "podkast-admin-list");
  renderPodkastAdmin();
  modalOpen(modal);
}

// Episoden som redigeres nå, eller null for «legg til ny». Skjemaet er det
// samme; bare knappetekst, overskrift og lagringskall skifter.
let editingPodId = null;

function fillPodForm(ep) {
  editingPodId = ep ? ep.id : null;
  document.getElementById("pod-title").value = ep?.title || "";
  document.getElementById("pod-desc").value = ep?.description || "";
  document.getElementById("pod-duration").value = ep?.duration || "";
  document.getElementById("pod-url").value = ep?.audioUrl || "";
  document.getElementById("pod-form-title").textContent = ep ? "Rediger episode" : "Legg til episode";
  document.getElementById("pod-save").textContent = ep ? "Lagre endringer" : "Lagre episode";
  document.getElementById("pod-cancel").hidden = !ep;
  const msg = document.getElementById("pod-msg");
  msg.textContent = "";
  msg.className = "form-msg ok";
}

export function renderPodkastAdmin() {
  const el = document.getElementById("podkast-admin-list");
  if (!el) return;
  // Episoden som redigeres kan ha blitt slettet i en annen fane — da må
  // skjemaet tilbake til «legg til», ellers skriver Lagre til et borte dokument.
  if (editingPodId && !state.podcasts.some((p) => p.id === editingPodId)) fillPodForm(null);
  // Usann = lista var uendret og DOM-en står urørt (så en episode læreren
  // hører på ikke stoppes av hvert snapshot). Da henger knappelytterne
  // fortsatt der de skal, og vi er ferdige.
  if (!renderPodcastList(el, state.podcasts, {
    admin: true,
    empty: `<p class="muted empty">Ingen episoder ennå.</p>`,
  })) return;
  el.querySelectorAll("[data-pod-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ep = state.podcasts.find((p) => p.id === btn.dataset.podEdit);
      if (!ep) return;
      fillPodForm(ep);
      document.getElementById("pod-title").focus();
      document.querySelector(".podkast-add-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
  el.querySelectorAll("[data-pod-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Slette denne episoden?")) return;
      await guardTeacherAction(deletePodcast(btn.dataset.podDelete));
    });
  });
}

export function setupPodkastAdmin() {
  const modal = document.getElementById("modal-podkast-admin");
  if (!modal) return;
  setupModal(modal);

  document.getElementById("pod-cancel").addEventListener("click", () => fillPodForm(null));

  document.getElementById("pod-save").addEventListener("click", async () => {
    const title = document.getElementById("pod-title").value.trim();
    const audioUrl = document.getElementById("pod-url").value.trim();
    const msg = document.getElementById("pod-msg");
    if (!title) { msg.textContent = "Tittel er påkrevd."; msg.className = "form-msg error"; return; }
    // Tomt svar på en utfylt lenke betyr at den ikke er en http(s)-adresse. Si
    // fra framfor å lagre tomt — ellers forsvinner spilleren uten forklaring.
    const lyd = dropboxDirectUrl(audioUrl);
    if (audioUrl && !lyd) {
      msg.textContent = "Lydlenken må være en full adresse som starter med https://";
      msg.className = "form-msg error";
      return;
    }

    msg.textContent = "Lagrer …";
    msg.className = "form-msg ok";
    const felter = {
      title,
      description: document.getElementById("pod-desc").value.trim(),
      duration: document.getElementById("pod-duration").value.trim(),
      audioUrl: lyd,
    };
    try {
      if (editingPodId) {
        // `order` røres IKKE ved redigering — rekkefølgen er lærerens, ikke en
        // funksjon av når episoden sist ble endret.
        await updatePodcast(editingPodId, felter);
        fillPodForm(null);
        msg.textContent = "Episode oppdatert!";
      } else {
        await addPodcast({
          ...felter,
          // Maks eksisterende order + 1 (ikke lengde+1, som gjenbruker en verdi
          // etter at en episode er slettet → to like order → ustabil sortering).
          order: Math.max(0, ...state.podcasts.map((p) => p.order || 0)) + 1,
        });
        fillPodForm(null);
        msg.textContent = "Episode lagt til!";
      }
    } catch (err) {
      console.error("Podkast-lagring feilet:", err);
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

// ----------------------------------------------------------------------------
//  Frittstående referanser (content/referanser)
// ----------------------------------------------------------------------------
//  Kilder pensumet bygger på uten å høre til et bestemt kort: en bok, en
//  podkastserie, en dokumentar. Én liste, samme rad-editor som kildene på
//  kortene. Kategorien er PÅKREVD her — den bestemmer hvilken seksjon i
//  Referanser-kortet referansen havner i, og uten den ville den havnet under
//  «Ukategorisert» uten at læreren skjønte hvorfor.

function referanseRader() {
  return normalizeSources(state.content?.referanser?.kilder);
}

// `fokus` = url-en (eller teksten) til raden som skal utheves — sendes fra
// Rediger-knappen i Referanser-lista, så læreren slipper å lete i lista.
export function openReferanseEditor(fokus) {
  const wrap = $("#ref-edit-rows");
  if (!wrap) return;
  buildRows(wrap, SOURCE_SPEC, referanseRader());
  const msg = $("#ref-edit-msg");
  msg.textContent = "";
  msg.className = "form-msg ok";
  openAdminModal("modal-referanse-edit");

  if (!fokus) return;
  for (const rad of wrap.querySelectorAll(".source-row")) {
    const url = rad.querySelector(".source-url")?.value.trim();
    const tekst = rad.querySelector(".source-text")?.value.trim();
    if (url !== fokus && tekst !== fokus) continue;
    rad.classList.add("rad-uthevet");
    rad.scrollIntoView({ block: "center" });
    rad.querySelector(".source-text")?.focus();
    break;
  }
}

export function setupReferanseEditor() {
  const addBtn = $("#ref-edit-add");
  if (!addBtn) return;
  addBtn.addEventListener("click", () => addRow($("#ref-edit-rows"), SOURCE_SPEC, {}));

  $("#ref-edit-save").addEventListener("click", async () => {
    const msg = $("#ref-edit-msg");
    const kilder = collectRows($("#ref-edit-rows"), SOURCE_SPEC);
    const utenKategori = kilder.filter((k) => !k.kategori);
    if (utenKategori.length) {
      msg.textContent = `Velg kategori for ${utenKategori.length === 1 ? "referansen" : "alle referansene"} før du lagrer.`;
      msg.className = "form-msg error";
      return;
    }
    msg.textContent = "Lagrer …";
    msg.className = "form-msg ok";
    try {
      await saveReferanser(kilder);
      closeAdminModal("modal-referanse-edit");
    } catch (err) {
      console.error("Referanse-lagring feilet:", err);
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

// ----------------------------------------------------------------------------
//  Innholds-editor (sjangerhistorier OG innholdssider) — markdown-light med
//  live forhåndsvisning
// ----------------------------------------------------------------------------
//  Åpnes fra «Rediger»-knappene i historie-/sidemodalene (explore-innhold.js →
//  onStoryEdit/onPageEdit). Historier lagres som story-felt på metasjangerens
//  genreDescriptions-dokument; sidene som content/<id>.body. Det finnes INGEN
//  standardtekster i koden — «Slett teksten» gjør at visningen sier tydelig
//  ifra om at tekst mangler. Forhåndsvisningen bruker samme renderRichText
//  som studentvisningen — det du ser er det studentene får.

const PAGE_TITLES = { omHistorie: "Om historie", rotter: "Røtter før 1910", appGuide: "Slik bruker du appen" };

// { type: "story", id: <sjanger> } eller { type: "page", id: <sideId> }
let editorTarget = null;
// Kildene siden hadde da editoren ble åpnet (se openContentEditor).
let editorKilder = [];

function storyLinkCtx() {
  return { artists: state.artists, techItems: state.techItems, genres: buildMainGenreList(state.artists) };
}

function renderStoryPreview() {
  const el = $("#se-preview");
  if (el) el.innerHTML = renderRichText($("#se-text").value, storyLinkCtx());
}

// Instrumentsammendragene (content/instrument-<slug>) er de eneste
// innholdssidene med kildeliste. De andre (Om historie, Røtter, Slik bruker du
// appen) er lærerens egen prosa uten kildeapparat, og skal ikke få feltet.
const erInstrumentside = (t) => t?.type === "page" && String(t.id || "").startsWith("instrument-");

function openContentEditor(target, title, existing) {
  editorTarget = target;
  // Kildene fra dokumentet tas vare på her, så en lagring av en side UTEN
  // kildefelt ikke tømmer dem: savePage skriver hele dokumentet, den fletter ikke.
  editorKilder = normalizeSources(existing?.kilder);
  const medKilder = erInstrumentside(target);
  $("#se-kilder-wrap").hidden = !medKilder;
  // Radene tømmes for sider uten kildefelt, så forrige instruments kilder ikke
  // blir stående i et skjult felt og forvirre neste gang det åpnes.
  if (medKilder) buildRows($("#se-kilder"), SOURCE_SPEC, editorKilder);
  else $("#se-kilder").innerHTML = "";
  $("#se-title").textContent = `Rediger: ${title}`;
  $("#se-text").value = existing ? existing.body : "";
  // Taket gjelder KUN instrumentsammendragene: editoren deles med historiene og
  // de andre innholdssidene, som skal kunne være så lange de trenger. Kalles
  // ETTER at verdien er satt, ellers viser telleren forrige teksts lengde.
  wireCharCount($("#se-text"), medKilder ? SAMMENDRAG_MAKS : 0, $("#se-char-count"));
  const msg = $("#se-msg");
  msg.textContent = "";
  msg.className = "form-msg";
  $("#se-status").textContent = existing
    ? "Lagret tekst. Endringene vises for studentene idet du lagrer."
    : "Ingen tekst lagret ennå. Teksten vises som manglende til du lagrer (eller importerer innholdsfilen).";
  $("#se-reset").style.display = existing ? "" : "none";
  renderStoryPreview();
  openAdminModal("modal-story-edit");
}

export function openStoryEditor(genre) {
  openContentEditor({ type: "story", id: genre }, `historien om ${genre}`, storyFor(genre, state.genreDescs));
}

export function openPageEditor(pageId) {
  openContentEditor({ type: "page", id: pageId }, sideTittel(pageId), pageFor(pageId, state.content));
}

// Instrumentsammendragene står ikke i PAGE_TITLES (de er avledet av
// instrumentgruppene), og editoren viste derfor rå side-ID: «instrument-gitar».
function sideTittel(pageId) {
  if (PAGE_TITLES[pageId]) return PAGE_TITLES[pageId];
  const gruppe = INSTRUMENT_TIMELINE_GROUPS.find((g) => instrumentPageId(g) === pageId);
  return gruppe ? (INSTRUMENT_TITLE[gruppe] || `Utviklingen av ${gruppe}`) : pageId;
}

// Knappene i historie-editorens formatlinje (den ligger i teacher.html, med
// egne id-er) deler funksjoner med formatlinja de andre tekstfeltene får satt
// inn automatisk — se js/format-bar.js. ÉN implementasjon, samme syntaks.
const seWrap = (marker) => wrapSelection($("#se-text"), marker, renderStoryPreview);
const sePrefix = (prefixFor) => prefixLines($("#se-text"), prefixFor, renderStoryPreview);

export function setupStoryEditor() {
  const ta = $("#se-text");
  if (!ta) return;

  let t;
  ta.addEventListener("input", () => { clearTimeout(t); t = setTimeout(renderStoryPreview, 250); });

  $("#se-bold").addEventListener("click", () => seWrap("**"));
  $("#se-italic").addEventListener("click", () => seWrap("*"));
  $("#se-h3").addEventListener("click", () => sePrefix(() => "### "));
  $("#se-ul").addEventListener("click", () => sePrefix(() => "- "));
  $("#se-ol").addEventListener("click", () => sePrefix((i) => `${i + 1}. `));

  $("#se-add-kilde").addEventListener("click", () => addRow($("#se-kilder"), SOURCE_SPEC, {}));

  // Gjenåpner visningen teksten hører til, så lagring/sletting synes straks.
  const reopenTarget = () => {
    if (!ctx.explore || !editorTarget) return;
    if (editorTarget.type === "story") ctx.explore.openHistorier(editorTarget.id);
    else if (editorTarget.id === "omHistorie") ctx.explore.openOmHistorie();
    else if (editorTarget.id === "rotter") ctx.explore.openRotter();
    else if (editorTarget.id === "appGuide") ctx.explore.openAppGuide();
  };

  $("#se-save").addEventListener("click", async () => {
    const body = ta.value.trim();
    const msg = $("#se-msg");
    if (!body) {
      msg.textContent = "Teksten kan ikke være tom. Bruk «Slett teksten» i stedet.";
      msg.className = "form-msg error";
      return;
    }
    // maxlength stopper tasting, men ikke tekst som alt ligger der (importert
    // eller skrevet før taket kom). Da skal lagringen si tydelig ifra.
    if (erInstrumentside(editorTarget) && body.length > SAMMENDRAG_MAKS) {
      msg.textContent = `Sammendraget kan være maks ${SAMMENDRAG_MAKS} tegn (er ${body.length}).`;
      msg.className = "form-msg error";
      return;
    }
    msg.textContent = "Lagrer …";
    msg.className = "form-msg ok";
    try {
      if (editorTarget.type === "story") {
        await saveStoryBody(editorTarget.id, body);
      } else {
        // savePage ERSTATTER hele dokumentet (ingen merge), så kildene må
        // skrives med hver gang de finnes. Sider uten kildefelt får ikke et
        // tomt kilder-felt påført, men beholder det de eventuelt hadde.
        const data = { body };
        if (erInstrumentside(editorTarget)) data.kilder = collectRows($("#se-kilder"), SOURCE_SPEC);
        else if (editorKilder.length) data.kilder = editorKilder;
        await savePage(editorTarget.id, data);
      }
      closeAdminModal("modal-story-edit");
      reopenTarget();
    } catch (err) {
      console.error("Innholds-lagring feilet:", err);
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });

  $("#se-reset").addEventListener("click", async () => {
    if (!confirm("Slette teksten? Den vises som manglende til ny tekst lagres eller importeres. Det finnes ingen reservetekst.")) return;
    try {
      if (editorTarget.type === "story") await clearStory(editorTarget.id);
      else await deletePage(editorTarget.id);
    } catch { /* ingen tekst å fjerne */ }
    closeAdminModal("modal-story-edit");
    reopenTarget();
  });
}
