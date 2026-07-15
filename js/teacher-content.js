// ============================================================================
//  LÆRER — INNHOLDSREDIGERING
// ----------------------------------------------------------------------------
//  Tiår- og sjangerbeskrivelser (enkeltmodaler), teknologi-admin og podkast-
//  administrasjon. Deler tilstand/eksplore via teacher-state.
// ============================================================================

import { state, ctx, openAdminModal, closeAdminModal, setContentCheck, guardTeacherAction } from "./teacher-state.js?v=3.58";
import { saveDecadeDesc, saveGenreDescLevel, saveEdgeDesc, saveStoryBody, clearStory, savePage, deletePage, addTech, updateTech, deleteTech, addPodcast, deletePodcast } from "./store.js?v=3.58";
import { GENEALOGY, edgeKey } from "./genealogy.js?v=3.58";
import { renderStoryHtml, storyFor, pageFor } from "./story-format.js?v=3.58";
import { escapeHtml, formatInfoText, buildKilderList, buildMainGenreList, renderDecadeSections, renderDecadeRibbon, setupModal, modalOpen, techImage } from "./ui.js?v=3.58";
import { resolveDesc } from "./genre-descriptions.js?v=3.58";
import { podcastEpisodeHtml, checkBtnHtml, toggleCheckBtn, teacherActionRow, wireTeacherRow, ICONS } from "./ui-helpers.js?v=3.58";
import { DECADES } from "./limits.js?v=3.58";

const LEVEL_LABEL = { meta: "hovedsjanger", main: "sjanger", sub: "undersjanger" };
import { linkifyAll, wireAllLinks } from "./linkify.js?v=3.58";
import { $ } from "./shared.js?v=3.58";
import { SOURCE_SPEC, addRow, collectRows } from "./row-editor.js?v=3.58";

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
      societyTl: $("#ds-society-timeline"), techTl: $("#ds-tech-timeline"),
      societyMoreBtn: $("#ds-society-more-btn"), techMoreBtn: $("#ds-tech-more-btn"),
    },
    desc, decadeId, state.techItems,
    {
      isSociety,
      onTechClick: (t) => ctx.explore.openTechDetail(t),
      onMore: (which, text) => {
        document.getElementById("dm-title").textContent =
          `${decadeId}-tallet — ${which === "society" ? "samfunnsutvikling" : "teknologiutvikling"}`;
        document.getElementById("dm-text").innerHTML = formatInfoText(text);
        modalOpen(document.getElementById("modal-decade-more"));
      },
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

  // Samme tidslinje-stripe som studentvisningen. Bytte av tiår i redigerings-
  // modus varsler først — ulagrede endringer forkastes ved re-render.
  renderDecadeRibbon($("#ds-ribbon"), d, (y) => {
    const editing = $("#ds-edit").style.display !== "none";
    if (editing && !confirm("Bytte tiår? Endringer som ikke er lagret, går tapt.")) return;
    openSingleDecadeModal(y, teacherContextMode);
  });

  // Sjekk + Rediger som ikonknapper (samme rad som alle andre kort). Sjekken
  // gjelder hele tiåret (teacherChecks.decades), som på Skrivebordet.
  const actions = $("#ds-actions");
  if (actions) {
    actions.innerHTML = teacherActionRow({
      checked: (state.teacherChecks?.decades || []).includes(String(d)),
      edit: true, del: false,
    });
    wireTeacherRow(actions, {
      onCheck: (on) => setContentCheck("decades", String(d), on),
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
  $("#ds-society-more").value = desc.societyMore || "";
  $("#ds-tech-more").value = desc.techMore || "";
  buildDecadeKilderRows(desc.kilder || []);
  $("#ds-msg").textContent = "";

  $("#ds-edit-society").style.display = isSociety ? "" : "none";
  $("#ds-edit-society-more").style.display = isSociety ? "" : "none";
  $("#ds-edit-tech").style.display = isSociety ? "none" : "";
  $("#ds-edit-tech-more").style.display = isSociety ? "none" : "";

  $("#ds-view").style.display = "";
  $("#ds-edit").style.display = "none";

  modal.dataset.decade = decadeId;
  openAdminModal("modal-decade-single");
}

export function openSingleSubgenreModal(subgenreId, level = "sub") {
  const resolved = resolveDesc(state.genreDescs, subgenreId, level);
  $("#subgenre-single-title").textContent = `${subgenreId} (${LEVEL_LABEL[level] || level})`;
  $("#ss-desc").value = resolved.description || "";
  $("#ss-msg").textContent = "";
  const kilderWrap = $("#ss-kilder-rows");
  if (kilderWrap) {
    kilderWrap.innerHTML = "";
    const kilder = Array.isArray(resolved.kilder) ? resolved.kilder : [];
    (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addKilderRow(kilderWrap, k.text || "", k.url || "", "ss"));
  }
  const modal = $("#modal-subgenre-single");
  modal.dataset.subgenre = subgenreId;
  modal.dataset.level = level;
  openAdminModal("modal-subgenre-single");
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
    ? "Motreaksjon — hvorfor gjorde den nye sjangeren opprør mot den gamle?"
    : "Avstamning / påvirkning — hva ble ført videre, og hva ble nytt?";
  $("#es-desc").value = docData.description || "";
  $("#es-msg").textContent = "";
  const kilderWrap = $("#es-kilder-rows");
  if (kilderWrap) {
    kilderWrap.innerHTML = "";
    const kilder = Array.isArray(docData.kilder) ? docData.kilder : [];
    (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addKilderRow(kilderWrap, k.text || "", k.url || ""));
  }
  const modal = $("#modal-edge-single");
  modal.dataset.edgeFrom = fromId;
  modal.dataset.edgeTo = toId;
  openAdminModal("modal-edge-single");
}

export function setupEdgeSingleSave() {
  const addKilderBtn = $("#es-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#es-kilder-rows"), "", ""));

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
  const wrap = $("#ds-kilder-rows");
  if (!wrap) return;
  wrap.innerHTML = "";
  (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addKilderRow(wrap, k.text || "", k.url || "", "ds"));
}

// Kilder-radene bruker den delte row-editor.js (samme SOURCE_SPEC som student-
// og lærer-artistskjemaet). prefix-argumentet beholdes for kall-kompatibilitet,
// men brukes ikke lenger (de gamle prefiks-klassene var døde).
function addKilderRow(wrap, text = "", url = "") {
  return addRow(wrap, SOURCE_SPEC, { text, url });
}

function collectKilderRows(wrap) {
  return collectRows(wrap, SOURCE_SPEC);
}

export function setupSubgenreSingleSave() {
  const addKilderBtn = $("#ss-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#ss-kilder-rows"), "", "", "ss"));

  $("#ss-save").addEventListener("click", async () => {
    const modal = $("#modal-subgenre-single");
    const subgenreId = modal.dataset.subgenre;
    const level = modal.dataset.level || "sub";
    const description = $("#ss-desc").value.trim();
    const kilder = collectKilderRows($("#ss-kilder-rows"));
    const msg = $("#ss-msg");
    try {
      await saveGenreDescLevel(subgenreId, level, { description, kilder });
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
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#ds-kilder-rows"), "", "", "ds"));

  $("#ds-save").addEventListener("click", async () => {
    const modal = $("#modal-decade-single");
    const decadeId = modal.dataset.decade;
    const society = $("#ds-society").value.trim();
    const tech = $("#ds-tech").value.trim();
    const societyMore = $("#ds-society-more").value.trim();
    const techMore = $("#ds-tech-more").value.trim();
    const kilder = collectKilderRows($("#ds-kilder-rows"));
    const msg = $("#ds-msg");
    try {
      await saveDecadeDesc(decadeId, { society, tech, societyMore, techMore, kilder });
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";

      // Re-render fra de nettopp lagrede verdiene (også les-mer-knapper og
      // kilder — ikke bare tekst/tidslinjer som før, som ga stale visning).
      renderDecadeSingleSections(decadeId, { society, tech, societyMore, techMore, kilder }, teacherContextMode === "society");

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
export function openTechEditor(t) {
  fillTechForm(t);
  const title = document.getElementById("tech-single-title");
  if (title) title.textContent = t ? `Rediger — ${t.name}` : "Ny innovasjon";
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
    const catTag = `<span class="tag tag-tech-cat">${escapeHtml(t.category || "")}</span>`;
    const yearTag = t.adoptedLabel ? `<span class="tag tag-tech-year">${escapeHtml(t.adoptedLabel)}</span>` : "";
    return `<article class="card" data-tech-id="${escapeHtml(t.id)}">
      <header class="card-head">
        ${img}
        <h3>${escapeHtml(t.name)}</h3>
        <div class="meta">${yearTag}${catTag}</div>
      </header>
      ${t.description ? `<p class="desc">${linkifyAll(t.description, { artists: state.artists, techItems: state.techItems, genres: buildMainGenreList(state.artists) })}</p>` : ""}
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

function fillTechForm(t) {
  document.getElementById("tech-name").value = t ? t.name || "" : "";
  document.getElementById("tech-category").value = t ? t.category || "" : "";
  document.getElementById("tech-invented").value = t ? t.inventedYear || "" : "";
  document.getElementById("tech-adopted").value = t ? t.adoptedYear || "" : "";
  document.getElementById("tech-adopted-label").value = t ? t.adoptedLabel || "" : "";
  document.getElementById("tech-decade").value = t ? t.decade || "" : "";
  document.getElementById("tech-desc").value = t ? t.description || "" : "";
  document.getElementById("tech-image-url").value = t ? t.imageUrl || "" : "";
  document.getElementById("tech-image-credit").value = t ? t.imageCredit || "" : "";
  document.getElementById("tech-msg").textContent = "";
  document.getElementById("tech-save").dataset.editId = t ? t.id : "";
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

  document.getElementById("tech-save").addEventListener("click", async () => {
    const name = document.getElementById("tech-name").value.trim();
    const msg = document.getElementById("tech-msg");
    if (!name) { msg.textContent = "Navn er påkrevd."; msg.className = "form-msg error"; return; }
    const data = {
      name,
      category: document.getElementById("tech-category").value,
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
  renderPodkastAdmin();
  modalOpen(document.getElementById("modal-podkast-admin"));
}

export function renderPodkastAdmin() {
  const el = document.getElementById("podkast-admin-list");
  if (!el) return;
  if (!state.podcasts.length) {
    el.innerHTML = `<p class="muted empty">Ingen episoder ennå.</p>`;
    return;
  }
  el.innerHTML = state.podcasts.map((ep) => podcastEpisodeHtml(ep, { withDelete: true })).join("");
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

  document.getElementById("pod-save").addEventListener("click", async () => {
    const title = document.getElementById("pod-title").value.trim();
    const audioUrl = document.getElementById("pod-url").value.trim();
    const msg = document.getElementById("pod-msg");
    if (!title) { msg.textContent = "Tittel er påkrevd."; msg.className = "form-msg error"; return; }

    msg.textContent = "Lagrer …";
    msg.className = "form-msg ok";
    try {
      await addPodcast({
        title,
        description: document.getElementById("pod-desc").value.trim(),
        duration: document.getElementById("pod-duration").value.trim(),
        audioUrl: audioUrl ? audioUrl.replace(/dl=0/, "dl=1").replace(/\?dl=1$/, "?raw=1") : "",
        // Maks eksisterende order + 1 (ikke lengde+1, som gjenbruker en verdi
        // etter at en episode er slettet → to like order → ustabil sortering).
        order: Math.max(0, ...state.podcasts.map((p) => p.order || 0)) + 1,
      });
      document.getElementById("pod-title").value = "";
      document.getElementById("pod-desc").value = "";
      document.getElementById("pod-duration").value = "";
      document.getElementById("pod-url").value = "";
      msg.textContent = "Episode lagt til!";
    } catch (err) {
      console.error("Podkast-lagring feilet:", err);
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
//  onStoryEdit/onPageEdit). Historier lagres som story-felt på hovedsjangerens
//  genreDescriptions-dokument; sidene som content/<id>.body. Det finnes INGEN
//  standardtekster i koden — «Slett teksten» gjør at visningen sier tydelig
//  ifra om at tekst mangler. Forhåndsvisningen bruker samme renderStoryHtml
//  som studentvisningen — det du ser er det studentene får.

const PAGE_TITLES = { omHistorie: "Om historie", rotter: "Røtter før 1910", appGuide: "Slik bruker du appen" };

// { type: "story", id: <sjanger> } eller { type: "page", id: <sideId> }
let editorTarget = null;

function storyLinkCtx() {
  return { artists: state.artists, techItems: state.techItems, genres: buildMainGenreList(state.artists) };
}

function renderStoryPreview() {
  const el = $("#se-preview");
  if (el) el.innerHTML = renderStoryHtml($("#se-text").value, storyLinkCtx());
}

function openContentEditor(target, title, existing) {
  editorTarget = target;
  $("#se-title").textContent = `Rediger — ${title}`;
  $("#se-text").value = existing ? existing.body : "";
  const msg = $("#se-msg");
  msg.textContent = "";
  msg.className = "form-msg";
  $("#se-status").textContent = existing
    ? "Lagret tekst — endringene vises for studentene idet du lagrer."
    : "Ingen tekst lagret ennå — teksten vises som manglende til du lagrer (eller importerer innholdsfilen).";
  $("#se-reset").style.display = existing ? "" : "none";
  renderStoryPreview();
  openAdminModal("modal-story-edit");
}

export function openStoryEditor(genre) {
  openContentEditor({ type: "story", id: genre }, `historien om ${genre}`, storyFor(genre, state.genreDescs));
}

export function openPageEditor(pageId) {
  openContentEditor({ type: "page", id: pageId }, PAGE_TITLES[pageId] || pageId, pageFor(pageId, state.content));
}

// Omslutt markeringen med et tegnpar (**fet** / *kursiv*).
function seWrap(marker) {
  const ta = $("#se-text");
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const sel = v.slice(s, e) || "tekst";
  ta.setRangeText(marker + sel + marker, s, e, "select");
  ta.focus();
  renderStoryPreview();
}

// Sett blokkprefiks (mellomtittel/liste) på hver markerte linje. Eksisterende
// blokkprefiks byttes ut, så knappene ikke stabler `- ### - tekst`.
function sePrefix(prefixFor) {
  const ta = $("#se-text");
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const start = v.lastIndexOf("\n", s - 1) + 1;
  const endIdx = v.indexOf("\n", e);
  const end = endIdx === -1 ? v.length : endIdx;
  let n = 0;
  const out = v.slice(start, end).split("\n")
    .map((l) => l.trim() ? prefixFor(n++) + l.replace(/^\s*(#{2,4}|[-•]|\d+[.)])\s+/, "") : l)
    .join("\n");
  ta.setRangeText(out, start, end, "select");
  ta.focus();
  renderStoryPreview();
}

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
      msg.textContent = "Teksten kan ikke være tom — bruk «Slett teksten» i stedet.";
      msg.className = "form-msg error";
      return;
    }
    msg.textContent = "Lagrer …";
    msg.className = "form-msg ok";
    try {
      if (editorTarget.type === "story") await saveStoryBody(editorTarget.id, body);
      else await savePage(editorTarget.id, { body });
      closeAdminModal("modal-story-edit");
      reopenTarget();
    } catch (err) {
      console.error("Innholds-lagring feilet:", err);
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });

  $("#se-reset").addEventListener("click", async () => {
    if (!confirm("Slette teksten? Den vises som manglende til ny tekst lagres eller importeres — det finnes ingen reservetekst.")) return;
    try {
      if (editorTarget.type === "story") await clearStory(editorTarget.id);
      else await deletePage(editorTarget.id);
    } catch { /* ingen tekst å fjerne */ }
    closeAdminModal("modal-story-edit");
    reopenTarget();
  });
}
