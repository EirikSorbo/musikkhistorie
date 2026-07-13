// ============================================================================
//  LÆRER — INNHOLDSREDIGERING
// ----------------------------------------------------------------------------
//  Tiår- og sjangerbeskrivelser (enkeltmodaler), teknologi-admin og podkast-
//  administrasjon. Deler tilstand/eksplore via teacher-state.
// ============================================================================

import { state, ctx, openAdminModal, closeAdminModal } from "./teacher-state.js?v=3.13";
import { saveDecadeDesc, saveGenreDescLevel, saveStoryBody, clearStory, savePage, deletePage, addTech, updateTech, deleteTech, addPodcast, deletePodcast } from "./store.js?v=3.13";
import { renderStoryHtml, storyFor, pageFor } from "./story-format.js?v=3.13";
import { escapeHtml, formatInfoText, buildKilderList, buildMainGenreList, renderDecadeSections, setupModal, modalOpen, techImage } from "./ui.js?v=3.13";
import { resolveDesc } from "./genre-descriptions.js?v=3.13";
import { podcastEpisodeHtml } from "./ui-helpers.js?v=3.13";

const LEVEL_LABEL = { meta: "hovedsjanger", main: "sjanger", sub: "undersjanger" };
import { linkifyAll, wireAllLinks } from "./linkify.js?v=3.13";
import { $ } from "./shared.js?v=3.13";
import { SOURCE_SPEC, addRow, collectRows } from "./row-editor.js?v=3.13";

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

export function openSingleDecadeModal(decadeId, mode) {
  if (mode) teacherContextMode = mode;
  const desc = state.decadeDescs[String(decadeId)] || {};
  const modal = $("#modal-decade-single");
  const isSociety = teacherContextMode === "society";
  $("#decade-single-title").textContent = `${decadeId}-tallet — ${isSociety ? "samfunn" : "teknologi"}`;

  $("#ds-society-section").style.display = isSociety ? "" : "none";
  $("#ds-tech-section").style.display = isSociety ? "none" : "";
  renderDecadeSingleSections(decadeId, desc, isSociety);

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
  $("#ds-to-edit").addEventListener("click", () => {
    $("#ds-view").style.display = "none";
    $("#ds-edit").style.display = "";
  });
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

let techAdminCat = "";

export function renderTechAdmin() {
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
      <div class="card-foot" style="margin-top:auto;padding-top:8px">
        <button class="btn ghost small tech-edit-btn">Rediger</button>
        <button class="btn ghost small tech-del-btn" style="color:var(--danger)">Slett</button>
      </div>
    </article>`;
  }).join("");

  wireAllLinks(el, ctx.explore ? ctx.explore.buildLinkCtx() : {});

  el.querySelectorAll(".tech-del-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("[data-tech-id]").dataset.techId;
      if (confirm("Slette denne teknologien?")) await deleteTech(id);
    });
  });

  el.querySelectorAll(".tech-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-tech-id]").dataset.techId;
      const t = state.techItems.find(x => x.id === id);
      if (!t) return;
      fillTechForm(t);
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

  document.getElementById("tech-new-btn").addEventListener("click", () => fillTechForm(null));

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
      if (editId) {
        await updateTech(editId, data);
        msg.textContent = "Oppdatert ✓"; msg.className = "form-msg ok";
      } else {
        await addTech(data);
        msg.textContent = "Lagt til ✓"; msg.className = "form-msg ok";
        fillTechForm(null);
      }
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
      await deletePodcast(btn.dataset.podDelete);
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
        order: state.podcasts.length + 1,
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
//  Åpnes fra «Rediger»-knappene i historie-/sidemodalene (explore.js →
//  onStoryEdit/onPageEdit). Historier lagres som story-felt på hovedsjangerens
//  genreDescriptions-dokument; sidene som content/<id>.body. Det finnes INGEN
//  standardtekster i koden — «Slett teksten» gjør at visningen sier tydelig
//  ifra om at tekst mangler. Forhåndsvisningen bruker samme renderStoryHtml
//  som studentvisningen — det du ser er det studentene får.

const PAGE_TITLES = { omHistorie: "Om historie", rotter: "Røtter før 1910" };

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
