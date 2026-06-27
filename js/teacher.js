import {
  subscribeArtists,
  subscribeConfig,
  subscribeDecades,
  subscribeSubgenres,
  subscribePodcasts,
  subscribeTech,
  addTech,
  updateTech,
  deleteTech,
  addArtist,
  teacherApprove,
  teacherReject,
  teacherDelete,
  deleteAllArtists,
  updateConfig,
  updateArtistFields,
  saveDecadeDesc,
  saveSubgenreDesc,
  setArtistPriority,
  getClientId,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
  addPodcast,
  updatePodcast,
  deletePodcast,
  subscribeTeacherChecks,
  setTeacherChecks,
  subscribePendingEdits,
  approvePendingEdit,
  rejectPendingEdit,
  approveTech,
} from "./store.js";
import { DEFAULT_CONFIG } from "./limits.js?v=2.34";
import { escapeHtml, formatInfoText, buildTimeline, buildTechTimeline, renderTechList, renderTechDetail, TECH_CATEGORIES, renderDashboard, renderLimits, renderArtists, renderArtistDetail, fillSelect, buildPlaylistHtml, buildArtistListRows, showSubsjangerInfo, modalOpen, modalClose, modalCloseTop, setupModal, buildKilderList, buildMainGenreList, fmtCredit, renderEditDiff, wireEditDiff, readApprovedFields, fieldLabelFor } from "./ui.js?v=2.34";
import { TEACHER_EMAILS } from "./firebase-config.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";
import { GENEALOGY_MAIN_GENRES, isMainGenre, showSjangerInfo } from "./genealogy.js?v=2.34";
import { linkifyAll, wireAllLinks } from "./linkify.js?v=2.34";
import { initExplore } from "./explore.js?v=2.34";

const state = {
  artists: [],
  config: null,
  decadeDescs: {},
  subgenreDescs: {},
  podcasts: [],
  techItems: [],
  teacherChecks: { genres: [], subgenres: [] },
  pendingEdits: [],
  filters: { sjanger: "", genre: "", decade: "", instrument: "", subgenre: "", search: "", showRemoved: true, showPending: false, hideChecked: false, priority: 0 },
  isTeacher: true,
  clientId: getClientId(),
  started: false,
};

const handlers = {
  approve:     (id) => teacherApprove(id),
  reject:      (id) => { if (confirm("Avvise dette forslaget?")) teacherReject(id); },
  remove:      (id) => setArtistPriority(id, -1),
  restore:     (id) => setArtistPriority(id, 0),
  del:         (id) => { if (confirm("Slette dette forslaget permanent?")) teacherDelete(id); },
  edit:        (id) => openEditModal(id),
  priority3:   (id) => { const a = state.artists.find(x => x.id === id); setArtistPriority(id, a?.priority === 3 ? 0 : 3); },
  priority2:   (id) => { const a = state.artists.find(x => x.id === id); setArtistPriority(id, a?.priority === 2 ? 0 : 2); },
  priority1:   (id) => { const a = state.artists.find(x => x.id === id); setArtistPriority(id, a?.priority === 1 ? 0 : 1); },
  toggleCheck: (id) => {
    const a = state.artists.find(x => x.id === id);
    updateArtistFields(id, { teacherChecked: !(a?.teacherChecked) });
  },
};

let explore = null;

function openDetail(artist) {
  const modal = document.getElementById("modal-detail");
  document.getElementById("detail-name").textContent = artist.name;
  renderArtistDetail(document.getElementById("detail-body"), artist, state.config, explore.buildLinkCtx());
  const editBtn = document.getElementById("detail-edit-btn");
  editBtn.onclick = () => { modalClose(modal); openEditModal(artist.id); };
  const checkBtn = document.getElementById("detail-check-btn");
  const checked = artist.teacherChecked === true;
  checkBtn.textContent = checked ? "✓ Sjekket" : "Sjekk";
  checkBtn.className = `btn ghost small ${checked ? "accent" : ""}`;
  checkBtn.onclick = () => {
    updateArtistFields(artist.id, { teacherChecked: !artist.teacherChecked });
    const nowChecked = !artist.teacherChecked;
    checkBtn.textContent = nowChecked ? "✓ Sjekket" : "Sjekk";
    checkBtn.className = `btn ghost small ${nowChecked ? "accent" : ""}`;
  };
  modalOpen(modal);
}

function addMainGenreCheckToggle(genre) {
  const body = document.getElementById("sj-body");
  if (!body) return;
  const field = isMainGenre(genre) ? "genres" : "subgenres";
  const list = state.teacherChecks[field] || [];
  const checked = list.includes(genre);
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:12px";
  wrap.innerHTML = `<button class="btn ghost small ${checked ? "accent" : ""}" id="sj-check-btn">${checked ? "✓ Sjekket" : "Sjekk"}</button>`;
  body.appendChild(wrap);
  wrap.querySelector("#sj-check-btn").addEventListener("click", () => {
    const cur = [...(state.teacherChecks[field] || [])];
    const idx = cur.indexOf(genre);
    const btn = wrap.querySelector("#sj-check-btn");
    if (idx >= 0) { cur.splice(idx, 1); btn.textContent = "Sjekk"; btn.className = "btn ghost small"; }
    else { cur.push(genre); btn.textContent = "✓ Sjekket"; btn.className = "btn ghost small accent"; }
    setTeacherChecks({ [field]: cur });
  });
}

function openOversikt() {
  renderDashboard($("#oversikt-body"), { ...state, onSubgenreClick: (s) => explore.openSubgenreInfo(s) });
  openAdminModal("modal-oversikt");
}

// ----------------------------------------------------------------------------
//  Innlogging
// ----------------------------------------------------------------------------

let signedInNotTeacher = false;

function setupGate() {
  const msg = $("#gate-msg");
  const signinBtn = $("#google-signin");

  signinBtn.addEventListener("click", () => {
    if (signedInNotTeacher) { signOutTeacher(); return; }
    signInWithGoogle().catch((e) => {
      if (e.code !== "auth/popup-closed-by-user")
        msg.textContent = "Innlogging mislyktes: " + e.message;
    });
  });

  $("#logout").addEventListener("click", () => signOutTeacher());

  onAuthChange((user) => {
    if (user && TEACHER_EMAILS.includes(user.email)) {
      signedInNotTeacher = false;
      msg.textContent = "";
      document.body.classList.add("is-teacher");
      if (!state.started) startApp();
    } else if (user) {
      signedInNotTeacher = true;
      document.body.classList.remove("is-teacher");
      msg.textContent = `Kontoen ${user.email} har ikke lærertilgang.`;
      signinBtn.textContent = "Logg ut og prøv en annen konto";
    } else {
      signedInNotTeacher = false;
      document.body.classList.remove("is-teacher");
      msg.textContent = "";
      signinBtn.textContent = "Logg inn med Google";
    }
  });
}

// ----------------------------------------------------------------------------
//  Modaler
// ----------------------------------------------------------------------------

function openAdminModal(id) {
  const el = document.getElementById(id);
  modalOpen(el);
  if (id === "modal-fyllingsgrad") renderLimits($("#modal-limits"), state);
  if (id === "modal-decade-desc") renderDecadeDescList();
  if (id === "modal-subgenre-desc") renderSubgenreDescList();
}

function closeAdminModal(id) {
  modalClose(document.getElementById(id));
}

function setupModals() {
  document.querySelectorAll("[data-open-modal]").forEach((btn) =>
    btn.addEventListener("click", () => openAdminModal(btn.dataset.openModal))
  );
  document.querySelectorAll(".modal-backdrop").forEach((m) => setupModal(m));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modalCloseTop();
  });
}

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function renderAll() {
  if (!state.config) return;
  if (document.getElementById("modal-fyllingsgrad").classList.contains("open"))
    renderLimits($("#modal-limits"), state);
  updatePendingBadge();
  renderList();
}

function updatePendingBadge() {
  const count = state.artists.filter(a => a.status === "pending").length;
  const badge = $("#pending-badge");
  const btn = $("#btn-pending");
  if (!btn) return;
  badge.textContent = count;
  badge.style.display = count ? "" : "none";
  btn.classList.toggle("active", !!state.filters.showPending);

  const pendingTech = state.techItems.filter(t => t.status === "pending").length;
  const editCount = state.pendingEdits.length + pendingTech;
  const eBadge = $("#pending-edits-badge");
  const eBtn = $("#btn-pending-edits");
  if (eBadge && eBtn) {
    eBadge.textContent = editCount;
    eBadge.style.display = editCount ? "" : "none";
  }
}

// ----------------------------------------------------------------------------
//  ENDRINGSFORSLAG — lærergrensesnitt
// ----------------------------------------------------------------------------

function getCurrentEntityValues(entityType, entityId) {
  switch (entityType) {
    case "artist": return state.artists.find(a => a.id === entityId) || {};
    case "tech":   return state.techItems.find(t => t.id === entityId) || {};
    case "subgenre": {
      const s = state.subgenreDescs[entityId];
      return { description: s?.description || "" };
    }
    case "decade-society": {
      const d = state.decadeDescs[String(entityId)] || {};
      return { society: d.society || "", societyMore: d.societyMore || "", kilder: d.kilder || [] };
    }
    case "decade-tech": {
      const d = state.decadeDescs[String(entityId)] || {};
      return { tech: d.tech || "", techMore: d.techMore || "", kilder: d.kilder || [] };
    }
    default: return {};
  }
}

function entityTypeLabel(t) {
  return ({
    artist: "Artist", tech: "Innovasjonskort", subgenre: "Sjanger",
    "decade-society": "Samfunnstiår", "decade-tech": "Teknologitiår",
    "new-tech": "Nytt innovasjonskort",
  })[t] || t;
}

function renderPendingEditsList() {
  const el = document.getElementById("pending-edits-list");
  if (!el) return;
  const newTech = state.techItems.filter(t => t.status === "pending");
  const edits = state.pendingEdits;

  if (!edits.length && !newTech.length) {
    el.innerHTML = `<p class="muted empty">Ingen endringsforslag akkurat nå.</p>`;
    return;
  }

  const editRows = edits.map((e) => {
    const fieldCount = Object.keys(e.proposedFields || {}).length;
    return `<tr class="pending-row" data-edit-id="${escapeHtml(e.id)}">
      <td><span class="tag">${escapeHtml(entityTypeLabel(e.entityType))}</span></td>
      <td>${escapeHtml(e.entityName || e.entityId)}</td>
      <td>${fieldCount} felt</td>
      <td class="muted">${escapeHtml(e.proposedBy || "Anonym")}</td>
      <td><button type="button" class="btn ghost small" data-action="open-edit" data-id="${escapeHtml(e.id)}">Se forslag →</button></td>
    </tr>`;
  });
  const techRows = newTech.map((t) => `<tr class="pending-row" data-tech-id="${escapeHtml(t.id)}">
    <td><span class="tag">${escapeHtml(entityTypeLabel("new-tech"))}</span></td>
    <td>${escapeHtml(t.name || "(uten navn)")}</td>
    <td>—</td>
    <td class="muted">${escapeHtml(t.proposedBy || "Anonym")}</td>
    <td>
      <button type="button" class="btn ghost small" data-action="approve-tech" data-id="${escapeHtml(t.id)}">Godkjenn</button>
      <button type="button" class="btn ghost small" data-action="reject-tech" data-id="${escapeHtml(t.id)}">Avvis</button>
    </td>
  </tr>`);

  el.innerHTML = `<table class="pending-table">
    <thead><tr><th>Type</th><th>Entitet</th><th>Endringer</th><th>Foreslått av</th><th></th></tr></thead>
    <tbody>${editRows.join("")}${techRows.join("")}</tbody>
  </table>`;
}

let activeEditId = null;

function openDiffModal(editId) {
  const edit = state.pendingEdits.find(e => e.id === editId);
  if (!edit) return;
  activeEditId = editId;

  document.getElementById("diff-title").textContent =
    `${entityTypeLabel(edit.entityType)} — ${edit.entityName || edit.entityId}`;
  document.getElementById("diff-meta").textContent =
    `Foreslått av ${edit.proposedBy || "Anonym"}. Klikk ✓ på radene du vil godta, ✕ på de du vil avvise. Velg «Lagre valgte endringer» til slutt.`;
  document.getElementById("diff-msg").textContent = "";

  const current = getCurrentEntityValues(edit.entityType, edit.entityId);
  const body = document.getElementById("diff-body");
  body.innerHTML = renderEditDiff(edit.entityType, current, edit.proposedFields);
  wireEditDiff(body);

  modalOpen(document.getElementById("modal-diff"));
}

function setupPendingEditsUi() {
  const listBtn = document.getElementById("btn-pending-edits");
  if (listBtn) {
    listBtn.addEventListener("click", () => {
      renderPendingEditsList();
      modalOpen(document.getElementById("modal-pending-edits"));
    });
  }

  const list = document.getElementById("pending-edits-list");
  if (list) {
    list.addEventListener("click", async (e) => {
      const openBtn = e.target.closest('[data-action="open-edit"]');
      if (openBtn) {
        modalClose(document.getElementById("modal-pending-edits"));
        openDiffModal(openBtn.dataset.id);
        return;
      }
      const apprBtn = e.target.closest('[data-action="approve-tech"]');
      if (apprBtn) {
        await approveTech(apprBtn.dataset.id);
        return;
      }
      const rejBtn = e.target.closest('[data-action="reject-tech"]');
      if (rejBtn) {
        if (confirm("Avvise (slette) dette innovasjonskortet?")) {
          await deleteTech(rejBtn.dataset.id);
        }
      }
    });
  }

  const saveBtn = document.getElementById("diff-save");
  const rejectAllBtn = document.getElementById("diff-reject-all");
  const diffModal = document.getElementById("modal-diff");

  if (saveBtn) saveBtn.addEventListener("click", async () => {
    if (!activeEditId) return;
    const body = document.getElementById("diff-body");
    const approved = readApprovedFields(body);
    const msg = document.getElementById("diff-msg");
    if (!approved.length) {
      msg.textContent = "Ingen felt valgt — bruk «Avvis alle» hvis du vil forkaste hele forslaget.";
      msg.className = "form-msg warn";
      return;
    }
    saveBtn.disabled = true;
    try {
      await approvePendingEdit(activeEditId, approved);
      modalClose(diffModal);
      activeEditId = null;
    } catch (e) {
      msg.textContent = "Feil ved lagring: " + (e?.message || e);
      msg.className = "form-msg error";
    } finally {
      saveBtn.disabled = false;
    }
  });

  if (rejectAllBtn) rejectAllBtn.addEventListener("click", async () => {
    if (!activeEditId) return;
    if (!confirm("Avvise hele dette forslaget uten å lagre noe?")) return;
    await rejectPendingEdit(activeEditId);
    modalClose(diffModal);
    activeEditId = null;
  });
}

let teacherContextMode = "society";

function openSingleDecadeModal(decadeId, mode) {
  if (mode) teacherContextMode = mode;
  const desc = state.decadeDescs[String(decadeId)] || {};
  const modal = $("#modal-decade-single");
  const isSociety = teacherContextMode === "society";
  $("#decade-single-title").textContent = `${decadeId}-tallet — ${isSociety ? "samfunn" : "teknologi"}`;

  const noText = "Ingen beskrivelse ennå.";
  const societyText = $("#ds-society-text");
  const techText = $("#ds-tech-text");
  societyText.innerHTML = desc.society ? formatInfoText(desc.society) : noText;
  societyText.className = "info-text" + (desc.society ? "" : " muted");
  techText.innerHTML = desc.tech ? formatInfoText(desc.tech) : noText;
  techText.className = "info-text" + (desc.tech ? "" : " muted");

  const stl = $("#ds-society-timeline");
  if (stl) stl.innerHTML = buildTimeline(desc.society, decadeId);
  const ttl = $("#ds-tech-timeline");
  if (ttl) {
    ttl.innerHTML = buildTechTimeline(state.techItems, decadeId);
    ttl.querySelectorAll("[data-tech-id]").forEach(el => {
      el.addEventListener("click", () => {
        const t = state.techItems.find(x => x.id === el.dataset.techId);
        if (t) explore.openTechDetail(t);
      });
    });
  }

  $("#ds-society-section").style.display = isSociety ? "" : "none";
  $("#ds-tech-section").style.display = isSociety ? "none" : "";

  const moreSociety = $("#ds-society-more-btn");
  const moreTech = $("#ds-tech-more-btn");
  if (moreSociety) {
    moreSociety.style.display = desc.societyMore && isSociety ? "" : "none";
    moreSociety.onclick = () => {
      document.getElementById("dm-title").textContent = `${decadeId}-tallet — samfunnsutvikling`;
      document.getElementById("dm-text").innerHTML = formatInfoText(desc.societyMore);
      modalOpen(document.getElementById("modal-decade-more"));
    };
  }
  if (moreTech) {
    moreTech.style.display = desc.techMore && !isSociety ? "" : "none";
    moreTech.onclick = () => {
      document.getElementById("dm-title").textContent = `${decadeId}-tallet — teknologiutvikling`;
      document.getElementById("dm-text").innerHTML = formatInfoText(desc.techMore);
      modalOpen(document.getElementById("modal-decade-more"));
    };
  }

  const kilderEl = $("#ds-kilder-view");
  if (kilderEl) kilderEl.innerHTML = buildKilderList(desc.kilder, "Kilder");

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

function openSingleSubgenreModal(subgenreId) {
  const desc = state.subgenreDescs[subgenreId] || {};
  $("#subgenre-single-title").textContent = subgenreId;
  $("#ss-desc").value = desc.description || "";
  $("#ss-msg").textContent = "";
  const kilderWrap = $("#ss-kilder-rows");
  if (kilderWrap) {
    kilderWrap.innerHTML = "";
    const kilder = Array.isArray(desc.kilder) ? desc.kilder : [];
    (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addKilderRow(kilderWrap, k.text || "", k.url || "", "ss"));
  }
  $("#modal-subgenre-single").dataset.subgenre = subgenreId;
  openAdminModal("modal-subgenre-single");
}

function buildDecadeKilderRows(kilder) {
  const wrap = $("#ds-kilder-rows");
  if (!wrap) return;
  wrap.innerHTML = "";
  (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addKilderRow(wrap, k.text || "", k.url || "", "ds"));
}

function addKilderRow(wrap, text = "", url = "", prefix = "ds") {
  const row = document.createElement("div");
  row.className = "source-row";
  row.innerHTML = `
    <input type="text" class="${prefix}-kilde-text source-text" placeholder="Kilde …" value="${escapeHtml(text)}">
    <input type="url" class="${prefix}-kilde-url source-url" placeholder="https://… (valgfritt)" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-source">✕</button>
  `;
  row.querySelector(".remove-source").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function collectKilderRows(wrap) {
  return [...wrap.querySelectorAll(".source-row")]
    .map((r) => ({
      text: r.querySelector(".source-text").value.trim(),
      url: r.querySelector(".source-url").value.trim(),
    }))
    .filter((k) => k.text);
}

function setupSubgenreSingleSave() {
  const addKilderBtn = $("#ss-add-kilder");
  if (addKilderBtn) addKilderBtn.addEventListener("click", () => addKilderRow($("#ss-kilder-rows"), "", "", "ss"));

  $("#ss-save").addEventListener("click", async () => {
    const modal = $("#modal-subgenre-single");
    const subgenreId = modal.dataset.subgenre;
    const description = $("#ss-desc").value.trim();
    const kilder = collectKilderRows($("#ss-kilder-rows"));
    const msg = $("#ss-msg");
    try {
      await saveSubgenreDesc(subgenreId, { description, kilder });
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";
      setTimeout(() => closeAdminModal("modal-subgenre-single"), 800);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

function setupDecadeSingleSave() {
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

      const noText = "Ingen beskrivelse ennå.";
      const societyText = $("#ds-society-text");
      const techText = $("#ds-tech-text");
      societyText.innerHTML = society ? formatInfoText(society) : noText;
      societyText.className = "info-text" + (society ? "" : " muted");
      techText.innerHTML = tech ? formatInfoText(tech) : noText;
      techText.className = "info-text" + (tech ? "" : " muted");
      const stl2 = $("#ds-society-timeline");
      if (stl2) stl2.innerHTML = buildTimeline(society, decadeId);
      const ttl2 = $("#ds-tech-timeline");
      if (ttl2) {
        ttl2.innerHTML = buildTechTimeline(state.techItems, decadeId);
        ttl2.querySelectorAll("[data-tech-id]").forEach(el2 => {
          el2.addEventListener("click", () => {
            const t2 = state.techItems.find(x => x.id === el2.dataset.techId);
            if (t2) explore.openTechDetail(t2);
          });
        });
      }

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

function renderList() {
  renderArtists($("#artist-list"), { ...state, handlers, linkCtx: explore ? explore.buildLinkCtx() : {} });
}

function refreshControls() {
  const { config } = state;
  fillSelect($("#f-sjanger"), GENEALOGY_MAIN_GENRES, { placeholder: "Alle sjangre" });
  fillSelect($("#f-genre"), config.metaGenres, { placeholder: "Alle metasjangre" });
  fillSelect(
    $("#f-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Alle tiår" }
  );
  fillSelect($("#f-instrument"), config.instruments || [], { placeholder: "Alle instrumenter" });
  const allSubs = [...new Set(
    (state.artists || []).flatMap((a) => [...(a.mainGenre || []), ...(a.subGenre || [])])
  )].sort((a, b) => a.localeCompare(b, "no"));
  fillSelect($("#f-subgenre"), allSubs, { placeholder: "Alle undersjangre" });
  if (state.filters.sjanger)  $("#f-sjanger").value = state.filters.sjanger;
  if (state.filters.genre)    $("#f-genre").value = state.filters.genre;
  if (state.filters.subgenre) $("#f-subgenre").value = state.filters.subgenre;
}

// ----------------------------------------------------------------------------
//  Filtre
// ----------------------------------------------------------------------------

function updatePrioButtons() {
  document.querySelectorAll("#t-prio-bar .prio-filter-btn").forEach((btn) => {
    const p = parseInt(btn.dataset.prio, 10);
    btn.className = `prio-filter-btn${state.filters.priority === p ? ` active-${p}` : ""}`;
  });
}

function setupFilters() {
  $("#f-sjanger").addEventListener("change", (e) => { state.filters.sjanger = e.target.value; renderList(); });
  $("#f-genre").addEventListener("change", (e) => { state.filters.genre = e.target.value; renderList(); });
  $("#f-decade").addEventListener("change", (e) => { state.filters.decade = e.target.value; renderList(); });
  $("#f-instrument").addEventListener("change", (e) => { state.filters.instrument = e.target.value; renderList(); });
  $("#f-subgenre").addEventListener("change", (e) => { state.filters.subgenre = e.target.value; renderList(); });
  $("#f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; renderList(); });
  document.querySelectorAll("#t-prio-bar .prio-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.prio, 10);
      state.filters.priority = state.filters.priority === p ? 0 : p;
      updatePrioButtons();
      renderList();
    });
  });
  const showRemoved = $("#f-show-removed");
  showRemoved.checked = state.filters.showRemoved;
  showRemoved.addEventListener("change", (e) => { state.filters.showRemoved = e.target.checked; renderList(); });
  const hideChecked = $("#f-hide-checked");
  hideChecked.checked = state.filters.hideChecked;
  hideChecked.addEventListener("change", (e) => { state.filters.hideChecked = e.target.checked; renderList(); });

  $("#btn-pending").addEventListener("click", () => {
    state.filters.showPending = !state.filters.showPending;
    updatePendingBadge();
    renderList();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-key]");
    if (!btn) return;
    const key = btn.dataset.filterKey, val = btn.dataset.filterVal;
    const sel = { sjanger: "#f-sjanger", subgenre: "#f-subgenre", instrument: "#f-instrument", genre: "#f-genre" }[key];
    if (!sel) return;
    state.filters[key] = val;
    const elSel = $(sel);
    if (elSel) elSel.value = val;
    renderList();
  });
}

// ----------------------------------------------------------------------------
//  Admin — grenser
// ----------------------------------------------------------------------------

function setupAdmin() {
  setupModals();

  $("#mdec-decades").addEventListener("input", buildDecadeLimits);
  $("#mdec-default").addEventListener("input", buildDecadeLimits);
  $("#mgen-genres").addEventListener("input", buildMetaGenreLimits);
  $("#mgen-default").addEventListener("input", buildMetaGenreLimits);
  $("#minstr-instruments").addEventListener("input", buildInstrumentLimits);
  $("#minstr-default").addEventListener("input", buildInstrumentLimits);

  $("#save-general").addEventListener("click", () => saveSection("general"));
  $("#save-decade").addEventListener("click", () => saveSection("decade"));
  $("#save-genre").addEventListener("click", () => saveSection("genre"));
  $("#save-instrument").addEventListener("click", () => saveSection("instrument"));
}

async function saveSection(section) {
  const msgEl = $(`#msg-${section}`);
  let updates = {};

  if (section === "general") {
    updates = {
      maxTotal: int($("#cfg-total").value, state.config.maxTotal),
      voteOutThreshold: int($("#cfg-threshold").value, state.config.voteOutThreshold),
    };
  } else if (section === "decade") {
    updates = {
      maxPerDecade: int($("#mdec-default").value, state.config.maxPerDecade),
      decades: splitList($("#mdec-decades").value, state.config.decades).map(Number),
      decadeLimits: collectLimitMap("#mdec-limits", "data-decade"),
    };
  } else if (section === "genre") {
    updates = {
      maxPerMetaGenre: int($("#mgen-default").value, state.config.maxPerMetaGenre),
      metaGenres: splitList($("#mgen-genres").value, state.config.metaGenres),
      metaGenreLimits: collectLimitMap("#mgen-limits", "data-genre"),
    };
  } else if (section === "instrument") {
    updates = {
      maxPerInstrument: int($("#minstr-default").value, state.config.maxPerInstrument),
      instruments: splitList($("#minstr-instruments").value, state.config.instruments || []),
      instrumentLimits: collectLimitMap("#minstr-limits", "data-instrument"),
    };
  }

  if (!CONFIGURED) { msgEl.textContent = "Firebase ikke koblet til."; return; }
  await updateConfig({ ...state.config, ...updates });
  msgEl.textContent = "Lagret ✓";
  setTimeout(() => (msgEl.textContent = ""), 2500);
}

function fillAdminForm() {
  const c = state.config;
  $("#cfg-total").value = c.maxTotal;
  $("#cfg-threshold").value = c.voteOutThreshold;
  $("#mdec-default").value = c.maxPerDecade;
  $("#mdec-decades").value = c.decades.join(", ");
  $("#mgen-default").value = c.maxPerMetaGenre;
  $("#mgen-genres").value = c.metaGenres.join(", ");
  $("#minstr-default").value = c.maxPerInstrument;
  $("#minstr-instruments").value = (c.instruments || []).join(", ");
  buildDecadeLimits();
  buildMetaGenreLimits();
  buildInstrumentLimits();
}

function buildDecadeLimits() {
  const decades = splitList($("#mdec-decades").value, state.config.decades).map(Number);
  const def = int($("#mdec-default").value, state.config.maxPerDecade);
  renderLimitInputs(
    $("#mdec-limits"), "data-decade",
    decades.map((d) => ({ key: d, label: `${d}-tallet`, explicit: state.config.decadeLimits?.[d] })),
    def
  );
}

function buildMetaGenreLimits() {
  const genres = splitList($("#mgen-genres").value, state.config.metaGenres);
  const def = int($("#mgen-default").value, state.config.maxPerMetaGenre);
  renderLimitInputs(
    $("#mgen-limits"), "data-genre",
    genres.map((g) => ({ key: g, label: g, explicit: state.config.metaGenreLimits?.[g] })),
    def
  );
}

function buildInstrumentLimits() {
  const instruments = splitList($("#minstr-instruments").value, state.config.instruments || []);
  const def = int($("#minstr-default").value, state.config.maxPerInstrument);
  renderLimitInputs(
    $("#minstr-limits"), "data-instrument",
    instruments.map((i) => ({ key: i, label: i, explicit: state.config.instrumentLimits?.[i] })),
    def
  );
}

function renderLimitInputs(container, attr, items, placeholder) {
  const prev = {};
  container.querySelectorAll("input").forEach((inp) => {
    if (inp.value !== "") prev[inp.getAttribute(attr)] = inp.value;
  });
  container.innerHTML = items
    .map((it) => {
      const stored = Number.isFinite(it.explicit) ? it.explicit : "";
      const value = prev[it.key] ?? stored;
      return `
        <label class="limit-input">
          <span>${escapeHtml(it.label)}</span>
          <input type="number" min="1" ${attr}="${escapeHtml(String(it.key))}"
                 placeholder="${placeholder}" value="${value}">
        </label>`;
    })
    .join("");
}

function collectLimitMap(containerSel, attr) {
  const map = {};
  $(containerSel).querySelectorAll(`input[${attr}]`).forEach((inp) => {
    const key = inp.getAttribute(attr);
    const val = parseInt(inp.value, 10);
    if (Number.isFinite(val) && val >= 1) map[key] = val;
  });
  return map;
}

// ----------------------------------------------------------------------------
//  Hjelpere + oppstart
// ----------------------------------------------------------------------------

function int(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function splitList(v, fallback) {
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : fallback;
}

function startApp() {
  state.started = true;
  setupFilters();
  setupAdmin();
  setupDataButtons();
  setupImportChoice();
  setupEditForm();
  setupDecadeSingleSave();
  setupPendingEditsUi();
  setupSubgenreSingleSave();

  explore = initExplore({
    getState: () => state,
    onArtistClick: openDetail,
    onDecadeEdit: (decadeId, mode) => openSingleDecadeModal(decadeId, mode),
    onSubgenreEdit: (label) => openSingleSubgenreModal(label),
    onMainGenreCheck: (genre) => addMainGenreCheckToggle(genre),
    getCheckedState: () => state.teacherChecks,
    onTechAdmin: () => openTechAdmin(),
  });

  $("#btn-t-society").addEventListener("click", () => explore.openDecadeList("society"));
  $("#btn-t-tech").addEventListener("click", () => explore.openDecadeList("tech"));
  $("#btn-t-genres").addEventListener("click", explore.openSubgenreList);
  $("#btn-t-oversikt").addEventListener("click", openOversikt);
  $("#btn-t-podkast").addEventListener("click", openPodkastAdmin);
  setupPodkastAdmin();
  const btnArtister = document.getElementById("btn-t-artister");
  if (btnArtister) btnArtister.addEventListener("click", () => {
    const listSection = document.getElementById("artist-list");
    if (listSection) listSection.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#f-search")?.focus(), 300);
  });
  setupTechAdmin();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshControls();
    fillAdminForm();
    renderAll();
    showSetupBanner();
    return;
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshControls();
    fillAdminForm();
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    refreshControls();
    renderAll();
  });
  subscribeDecades((d) => { state.decadeDescs = d; });
  subscribeSubgenres((s) => { state.subgenreDescs = s; });
  subscribePodcasts((pods) => { state.podcasts = pods; renderPodkastAdmin(); });
  subscribeTech((items) => { state.techItems = items; updatePendingBadge(); renderPendingEditsList(); });
  subscribeTeacherChecks((checks) => { state.teacherChecks = checks; });
  subscribePendingEdits((edits) => { state.pendingEdits = edits; updatePendingBadge(); renderPendingEditsList(); });
}

// ----------------------------------------------------------------------------
//  Podkast-administrasjon
// ----------------------------------------------------------------------------

function openPodkastAdmin() {
  renderPodkastAdmin();
  modalOpen(document.getElementById("modal-podkast-admin"));
}

function renderPodkastAdmin() {
  const el = document.getElementById("podkast-admin-list");
  if (!el) return;
  if (!state.podcasts.length) {
    el.innerHTML = `<p class="muted empty">Ingen episoder ennå.</p>`;
    return;
  }
  el.innerHTML = state.podcasts.map((ep) => {
    const duration = ep.duration ? `<span class="podkast-duration">${escapeHtml(ep.duration)}</span>` : "";
    const desc = ep.description ? `<p class="podkast-desc">${escapeHtml(ep.description)}</p>` : "";
    return `
      <article class="podkast-episode">
        <div class="podkast-header">
          <h3 class="podkast-title">${escapeHtml(ep.title || "Uten tittel")}</h3>
          ${duration}
        </div>
        ${desc}
        ${ep.audioUrl ? `<audio controls preload="none" src="${escapeHtml(ep.audioUrl)}"></audio>` : ""}
        <div class="podkast-actions">
          <button class="btn ghost small btn-danger-text" data-pod-delete="${ep.id}">Slett</button>
        </div>
      </article>`;
  }).join("");
  el.querySelectorAll("[data-pod-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Slette denne episoden?")) return;
      await deletePodcast(btn.dataset.podDelete);
    });
  });
}

function setupPodkastAdmin() {
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
//  Teknologi-admin
// ----------------------------------------------------------------------------

function openTechAdmin() {
  renderTechAdmin();
  const modal = document.getElementById("modal-tech-admin");
  modal.querySelectorAll(".tech-tab").forEach(b => b.classList.toggle("active", !b.dataset.techCat));
  openAdminModal("modal-tech-admin");
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
    const img = t.imageUrl
      ? `<figure class="artist-image"><img src="${escapeHtml(t.imageUrl)}" alt="${escapeHtml(t.name)}" loading="lazy" />${fmtCredit(t.imageCredit)}</figure>`
      : "";
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

  wireAllLinks(el, explore ? explore.buildLinkCtx() : {});

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

function setupTechAdmin() {
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
//  Import / Eksport / Merge
// ----------------------------------------------------------------------------

const EXPORT_FIELDS = [
  "name", "birthYear", "deathYear", "gender", "metaGenre", "instrument",
  "mainGenre", "subGenre", "influenceStart", "influenceEnd", "recordLabel",
  "geography", "description", "keyWorks", "musicExamples", "kilder",
  "imageUrl", "imageCredit", "proposedBy", "priority", "teacherChecked",
];

const MERGE_LABELS = {
  birthYear: "Fødselsår", deathYear: "Dødsår", gender: "Kjønn",
  metaGenre: "Metasjanger", instrument: "Instrument",
  mainGenre: "Sjangre", subGenre: "Undersjangre",
  influenceStart: "Innflytelse fra", influenceEnd: "Innflytelse til",
  recordLabel: "Plateselskap",
  geography: "Geografi", description: "Beskrivelse",
  keyWorks: "Sentrale verk", musicExamples: "Musikkeksempler", kilder: "Kilder",
  imageUrl: "Bilde-URL", imageCredit: "Bildekreditering",
};

const COMPARE_FIELDS = Object.keys(MERGE_LABELS);

const mergeState = { queue: [], newArtists: [], index: 0 };

function setupDataButtons() {
  $("#btn-export").addEventListener("click", handleExport);

  const importInput = $("#input-import");
  $("#btn-import").addEventListener("click", () => { importInput.value = ""; importInput.click(); });
  importInput.addEventListener("change", (e) => handleImportFile(e.target.files[0]));

  $("#btn-nuke").addEventListener("click", async () => {
    if (!confirm("Er du HELT sikker? Dette sletter ALL artistdata permanent. Handlingen kan ikke angres.")) return;
    if (!confirm("Siste sjanse — skriv OK i neste boks for å bekrefte.")) return;
    try {
      await deleteAllArtists();
      alert("All data er slettet.");
    } catch (err) {
      alert("Feil ved sletting: " + err.message);
    }
  });

  $("#merge-keep-all").addEventListener("click", () => bulkMerge("existing"));
  $("#merge-use-all").addEventListener("click",  () => bulkMerge("imported"));
  $("#merge-next").addEventListener("click", advanceMerge);
}

function handleExport() {
  const artists = state.artists
    .filter((a) => a.status === "active" || a.status === "removed")
    .map((a) => Object.fromEntries(EXPORT_FIELDS.map((f) => [f, a[f] ?? null])));

  const decades = {};
  for (const [id, d] of Object.entries(state.decadeDescs)) {
    if (d.society || d.tech) decades[id] = { society: d.society || "", tech: d.tech || "" };
  }

  const subgenres = {};
  for (const [id, s] of Object.entries(state.subgenreDescs)) {
    if (s.description) subgenres[id] = { description: s.description };
  }

  const tech = state.techItems.map(t => {
    const { id, ...rest } = t;
    return rest;
  });

  const data = { artists, decades, subgenres, tech };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `musikkhistorie-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

let pendingImportData = null;

async function handleImportFile(file) {
  if (!file) return;
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { alert("Ugyldig JSON-fil."); return; }

  let artists, decades, subgenres, tech;
  if (Array.isArray(raw)) {
    artists = raw;
    decades = {};
    subgenres = {};
    tech = [];
  } else if (raw && typeof raw === "object" && Array.isArray(raw.artists)) {
    artists = raw.artists;
    decades = raw.decades || {};
    subgenres = raw.subgenres || {};
    tech = raw.tech || [];
  } else {
    alert("Ugyldig format — filen må være en array eller et objekt med «artists»."); return;
  }

  pendingImportData = { artists, decades, subgenres, tech };
  const parts = [];
  const artistCount = artists.filter(a => a.name).length;
  if (artistCount) parts.push(`${artistCount} artister`);
  const decadeCount = Object.keys(decades).length;
  if (decadeCount) parts.push(`${decadeCount} tiårsbeskrivelser`);
  const subCount = Object.keys(subgenres).length;
  if (subCount) parts.push(`${subCount} sjangerbeskrivelser`);
  if (tech.length) parts.push(`${tech.length} teknologier`);
  $("#import-choice-desc").textContent = `Filen inneholder ${parts.join(", ")}.`;
  openAdminModal("modal-import-choice");
}

function setupImportChoice() {
  $("#import-replace").addEventListener("click", async () => {
    closeAdminModal("modal-import-choice");
    if (pendingImportData) {
      await handleReplace(pendingImportData.artists);
      await importDescriptions(pendingImportData);
      await importTechItems(pendingImportData.tech);
    }
    pendingImportData = null;
  });
  $("#import-merge").addEventListener("click", async () => {
    closeAdminModal("modal-import-choice");
    if (pendingImportData) {
      await handleMergeFile(pendingImportData.artists);
      await importDescriptions(pendingImportData);
      await importTechItems(pendingImportData.tech);
    }
    pendingImportData = null;
  });
}

async function importDescriptions({ decades, subgenres }) {
  let ok = 0, fail = 0;
  for (const [id, data] of Object.entries(decades || {})) {
    if (data.society || data.tech) {
      try { await saveDecadeDesc(id, data); ok++; }
      catch (e) { fail++; console.error("Tiår-import feilet for", id, e); }
    }
  }
  for (const [id, data] of Object.entries(subgenres || {})) {
    if (data.description) {
      try { await saveSubgenreDesc(id, data); ok++; }
      catch (e) { fail++; console.error("Sjanger-import feilet for", id, e); }
    }
  }
  if (fail > 0) {
    alert(`${fail} beskrivelse(r) kunne ikke lagres.\n\nSannsynlig årsak: Firestore-reglene tillater ikke skriving til 'subgenres' eller 'decades'.\n\nGå til Firebase Console → Firestore → Rules og publiser oppdaterte regler.`);
  } else if (ok > 0) {
    alert(`${ok} beskrivelse(r) importert.`);
  }
}

async function importTechItems(techArray) {
  if (!techArray || !techArray.length) return;
  let added = 0, updated = 0;
  for (const item of techArray) {
    if (!item.name) continue;
    const existing = state.techItems.find(t => t.name === item.name);
    try {
      if (existing) {
        await updateTech(existing.id, item);
        updated++;
      } else {
        await addTech(item);
        added++;
      }
    } catch (e) { console.error("Tech-import feilet for", item.name, e); }
  }
  if (added || updated) alert(`Teknologi: ${added} nye, ${updated} oppdaterte.`);
}

async function handleReplace(data) {
  if (!confirm("Dette sletter ALLE eksisterende artister og erstatter med filen. Er du sikker?")) return;
  let deleted = 0;
  for (const a of state.artists) {
    await teacherDelete(a.id);
    deleted++;
  }
  let added = 0, failed = 0;
  for (const a of data) {
    if (!a.name) continue;
    try {
      await addArtist({ proposedBy: "Eirik Sørbø", status: "active", ...a });
      added++;
    } catch (err) {
      failed++;
      console.error("Import feilet for", a.name, err);
    }
  }
  const parts = [`${deleted} slettet`, `${added} importert`];
  if (failed) parts.push(`${failed} mislyktes`);
  alert(parts.join(", ") + ".");
}

async function handleMergeFile(data) {
  mergeState.queue      = [];
  mergeState.newArtists = [];
  mergeState.index      = 0;

  for (const imp of data) {
    if (!imp.name) continue;
    const existing = state.artists.find(
      (a) => (a.status === "active" || a.status === "removed") &&
              a.name.trim().toLowerCase() === imp.name.trim().toLowerCase()
    );
    if (!existing) { mergeState.newArtists.push(imp); continue; }

    const autoFill = {};
    const conflicts = [];
    for (const f of COMPARE_FIELDS) {
      const ev = existing[f] ?? null;
      const iv = imp[f] ?? null;
      if (JSON.stringify(ev) === JSON.stringify(iv)) continue;
      const existingEmpty = ev === null || ev === "" || (Array.isArray(ev) && !ev.length);
      const importedEmpty = iv === null || iv === "" || (Array.isArray(iv) && !iv.length);
      if (existingEmpty && !importedEmpty) {
        autoFill[f] = iv;
      } else if (!importedEmpty) {
        conflicts.push({ field: f, existing: ev, imported: iv });
      }
    }
    if (Object.keys(autoFill).length || conflicts.length) {
      mergeState.queue.push({ existing, imported: imp, conflicts, resolved: { ...autoFill } });
    }
  }

  const hasConflicts = mergeState.queue.some(item => item.conflicts.length > 0);

  if (!mergeState.queue.length && !mergeState.newArtists.length) {
    alert("Ingen endringer å flette inn."); return;
  }
  if (!hasConflicts) { await finishMerge(); return; }

  mergeState.index = mergeState.queue.findIndex(item => item.conflicts.length > 0);
  openAdminModal("modal-merge");
  renderMergeConflict();
}

function renderMergeConflict() {
  const { queue, index } = mergeState;
  const item = queue[index];

  const conflictItems = queue.filter(i => i.conflicts.length > 0);
  const conflictIdx = conflictItems.indexOf(item) + 1;
  $("#merge-title").textContent    = item.existing.name;
  $("#merge-progress").textContent = `Konflikt ${conflictIdx} av ${conflictItems.length}`;

  $("#merge-fields").innerHTML = item.conflicts.map((c) => {
    const n = `cf-${c.field}`;
    return `
      <div class="conflict-row">
        <div class="conflict-field-name">${MERGE_LABELS[c.field] || c.field}</div>
        <label class="conflict-opt">
          <input type="radio" name="${n}" value="existing" checked>
          <span class="conflict-val"><strong>Behold:</strong> ${escapeHtml(fmtVal(c.existing))}</span>
        </label>
        <label class="conflict-opt">
          <input type="radio" name="${n}" value="imported">
          <span class="conflict-val new"><strong>Importer:</strong> ${escapeHtml(fmtVal(c.imported))}</span>
        </label>
      </div>`;
  }).join("");

  $("#merge-next").textContent = index === queue.length - 1 ? "Fullfør" : "Neste →";
}

function fmtVal(v) {
  if (v === null || v === undefined) return "(tom)";
  if (Array.isArray(v)) {
    if (!v.length) return "(tom)";
    return v.map((i) => (typeof i === "object" ? i.label || JSON.stringify(i) : i)).join(", ");
  }
  return String(v);
}

function collectCurrentChoices() {
  const item = mergeState.queue[mergeState.index];
  item.conflicts.forEach((c) => {
    const radio = document.querySelector(`input[name="cf-${c.field}"]:checked`);
    item.resolved[c.field] = radio?.value === "imported" ? c.imported : c.existing;
  });
}

async function advanceMerge() {
  collectCurrentChoices();
  let next = mergeState.index + 1;
  while (next < mergeState.queue.length && !mergeState.queue[next].conflicts.length) next++;
  if (next < mergeState.queue.length) {
    mergeState.index = next;
    renderMergeConflict();
  } else {
    await finishMerge();
  }
}

async function bulkMerge(choice) {
  collectCurrentChoices();
  for (let i = mergeState.index; i < mergeState.queue.length; i++) {
    const item = mergeState.queue[i];
    item.conflicts.forEach((c) => {
      item.resolved[c.field] = choice === "imported" ? c.imported : c.existing;
    });
  }
  await finishMerge();
}

async function finishMerge() {
  closeAdminModal("modal-merge");
  let added = 0, updated = 0;

  for (const a of mergeState.newArtists) {
    await addArtist({ proposedBy: "Eirik Sørbø", status: "active", ...a });
    added++;
  }
  for (const item of mergeState.queue) {
    if (Object.keys(item.resolved).length) {
      await updateArtistFields(item.existing.id, item.resolved);
      updated++;
    }
  }

  const parts = [];
  if (added)   parts.push(`${added} nye artister lagt til`);
  if (updated) parts.push(`${updated} artister oppdatert`);
  if (parts.length) alert(parts.join(", ") + ".");
}

// ----------------------------------------------------------------------------
//  Rediger artist
// ----------------------------------------------------------------------------

function openEditModal(artistId) {
  const a = state.artists.find((x) => x.id === artistId);
  if (!a) return;
  const c = state.config;

  $("#ed-id").value = a.id;
  $("#ed-name").value = a.name || "";
  $("#ed-birthyear").value = a.birthYear || "";
  $("#ed-deathyear").value = a.deathYear || "";
  $("#ed-geo").value = a.geography || "";
  $("#ed-start").value = a.influenceStart || "";
  $("#ed-end").value = a.influenceEnd || "";
  $("#ed-recordLabel").value = a.recordLabel || "";
  $("#ed-mainGenre").value = (a.mainGenre || []).join(", ");
  $("#ed-subGenre").value = (a.subGenre || []).join(", ");
  $("#ed-desc").value = a.description || "";
  $("#ed-by").value = a.proposedBy || "";
  $("#ed-image-url").value = a.imageUrl || "";
  $("#ed-image-credit").value = a.imageCredit || "";

  fillSelect($("#ed-gender"), GENDERS_EDIT, { placeholder: "Velg kjønn …" });
  $("#ed-gender").value = a.gender || "";
  fillSelect($("#ed-metaGenre"), c.metaGenres, { placeholder: "Velg sjanger …" });
  $("#ed-metaGenre").value = a.metaGenre || "";
  fillSelect($("#ed-instrument"), c.instruments || [], { placeholder: "Ingen / ukjent" });
  $("#ed-instrument").value = a.instrument || "";

  buildEditMusicExampleRows(a.musicExamples || []);
  buildEditWorkRows(a.keyWorks || []);
  buildEditSourceRows(a.kilder || []);

  const pending = state.pendingEdits.find(p => p.entityType === "artist" && p.entityId === a.id);
  const msgEl = $("#ed-msg");
  if (pending) {
    msgEl.className = "form-msg warn";
    msgEl.textContent = `Obs: Det finnes et åpent endringsforslag for ${a.name} fra ${pending.proposedBy || "Anonym"}. Behandle det først via «Endringsforslag».`;
  } else {
    msgEl.className = "form-msg";
    msgEl.textContent = "";
  }
  openAdminModal("modal-edit");
}

function buildEditMusicExampleRows(examples) {
  const wrap = $("#ed-me-rows");
  wrap.innerHTML = "";
  (examples.length ? examples : [{ label: "", url: "", year: "", performanceYear: "" }]).forEach((m) =>
    addEditMusicExampleRow(m.label || "", m.url || "", m.year || "", m.performanceYear || "")
  );
}

function addEditMusicExampleRow(label = "", url = "", year = "", perfYear = "") {
  const wrap = $("#ed-me-rows");
  const row = document.createElement("div");
  row.className = "me-row";
  row.innerHTML = `
    <input type="text" class="me-label" placeholder="Tittel" value="${escapeHtml(label)}">
    <input type="number" class="me-year" placeholder="Årstall" min="1800" max="2030" value="${escapeHtml(String(year || ""))}">
    <input type="url" class="me-url" placeholder="https://…" value="${escapeHtml(url)}">
    <input type="number" class="me-perf-year" placeholder="Framf.år" min="1800" max="2030" value="${escapeHtml(String(perfYear || ""))}" title="Året for framføring/konsert (kun hvis annet enn utgivelsesår)">
    <button type="button" class="btn ghost small remove-me">✕</button>
  `;
  row.querySelector(".remove-me").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function buildEditSourceRows(kilder) {
  const wrap = $("#ed-source-rows");
  wrap.innerHTML = "";
  (kilder.length ? kilder : [{ text: "", url: "" }]).forEach((k) => addEditSourceRow(k.text || "", k.url || ""));
}

function addEditSourceRow(text = "", url = "") {
  const wrap = $("#ed-source-rows");
  const row = document.createElement("div");
  row.className = "source-row";
  row.innerHTML = `
    <input type="text" class="source-text" placeholder="Kilde …" value="${escapeHtml(text)}">
    <input type="url" class="source-url" placeholder="https://… (valgfritt)" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-source">✕</button>
  `;
  row.querySelector(".remove-source").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function buildEditWorkRows(works) {
  const wrap = $("#ed-work-rows");
  wrap.innerHTML = "";
  (works.length ? works : [{ title: "", year: "", url: "" }])
    .forEach((w) => addEditWorkRow(w.title || "", w.year || "", w.url || ""));
}

function addEditWorkRow(title = "", year = "", url = "") {
  const wrap = $("#ed-work-rows");
  const row = document.createElement("div");
  row.className = "work-row";
  row.innerHTML = `
    <input type="text" class="work-title" placeholder="Tittel" value="${escapeHtml(title)}">
    <input type="number" class="work-year" placeholder="Utgivelsesår" min="1800" max="2030" value="${escapeHtml(String(year || ""))}">
    <input type="url" class="work-url" placeholder="https://… (valgfritt)" value="${escapeHtml(url)}">
    <button type="button" class="btn ghost small remove-work">✕</button>
  `;
  row.querySelector(".remove-work").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function collectEditMusicExamples() {
  return [...$("#ed-me-rows").querySelectorAll(".me-row")]
    .map((r) => {
      const label = r.querySelector(".me-label").value.trim();
      const url = r.querySelector(".me-url").value.trim();
      const yearStr = r.querySelector(".me-year").value.trim();
      const perfYearStr = r.querySelector(".me-perf-year").value.trim();
      const out = { label, url };
      const yr = parseInt(yearStr, 10);
      if (Number.isFinite(yr)) out.year = yr;
      const pyr = parseInt(perfYearStr, 10);
      if (Number.isFinite(pyr)) out.performanceYear = pyr;
      return out;
    })
    .filter((m) => m.url);
}

function collectEditSources() {
  return [...$("#ed-source-rows").querySelectorAll(".source-row")]
    .map((r) => ({
      text: r.querySelector(".source-text").value.trim(),
      url: r.querySelector(".source-url").value.trim(),
    }))
    .filter((k) => k.text);
}

function collectEditWorks() {
  return [...$("#ed-work-rows").querySelectorAll(".work-row")]
    .map((r) => {
      const title = r.querySelector(".work-title").value.trim();
      const yearStr = r.querySelector(".work-year").value.trim();
      const url = r.querySelector(".work-url").value.trim();
      const out = { title };
      const yr = parseInt(yearStr, 10);
      if (Number.isFinite(yr)) out.year = yr;
      if (url) out.url = url;
      return out;
    })
    .filter((w) => w.title);
}

function setupEditForm() {
  if (!$("#edit-form")) return;
  $("#ed-add-me").addEventListener("click", () => addEditMusicExampleRow());
  $("#ed-add-source").addEventListener("click", () => addEditSourceRow());
  $("#ed-add-work").addEventListener("click", () => addEditWorkRow());

  $("#edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#ed-msg");
    msg.textContent = "";
    const id = $("#ed-id").value;
    const fields = {
      name:          $("#ed-name").value.trim(),
      birthYear:     parseInt($("#ed-birthyear").value, 10) || null,
      deathYear:     parseInt($("#ed-deathyear").value, 10) || null,
      gender:        $("#ed-gender").value,
      metaGenre:     $("#ed-metaGenre").value,
      instrument:    $("#ed-instrument").value,
      mainGenre:     $("#ed-mainGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      subGenre:      $("#ed-subGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#ed-start").value, 10) || null,
      influenceEnd:   parseInt($("#ed-end").value, 10) || null,
      recordLabel:   $("#ed-recordLabel").value.trim(),
      geography:     $("#ed-geo").value.trim(),
      description:   $("#ed-desc").value.trim(),
      keyWorks:      collectEditWorks(),
      musicExamples: collectEditMusicExamples(),
      kilder:        collectEditSources(),
      imageUrl:      $("#ed-image-url").value.trim(),
      imageCredit:   $("#ed-image-credit").value.trim(),
      proposedBy:    $("#ed-by").value.trim() || "Anonym",
    };
    try {
      await updateArtistFields(id, fields);
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";
      setTimeout(() => closeAdminModal("modal-edit"), 1000);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

const GENDERS_EDIT = [
  { value: "kvinne", label: "Kvinne" },
  { value: "mann", label: "Mann" },
  { value: "annet", label: "Gruppe" },
  { value: "ukjent", label: "Ukjent" },
];

// ----------------------------------------------------------------------------
//  Tiårs- og undersjangerbeskrivelser
// ----------------------------------------------------------------------------

function renderDecadeDescList() {
  const el = $("#decade-desc-list");
  const decades = (state.config?.decades || []).slice().sort((a, b) => a - b);
  if (!decades.length) { el.innerHTML = `<p class="muted">Ingen tiår definert i innstillingene.</p>`; return; }

  el.innerHTML = decades.map((d) => {
    const desc = state.decadeDescs[String(d)] || {};
    return `
      <div class="desc-edit-item" data-decade="${d}">
        <h3>${d}-tallet</h3>
        <label>Samfunnsutvikling
          <textarea class="dd-society" rows="3" placeholder="Beskriv samfunnsutvikling for ${d}-tallet …">${escapeHtml(desc.society || "")}</textarea>
        </label>
        <label>Teknologiutvikling
          <textarea class="dd-tech" rows="3" placeholder="Beskriv teknologiutvikling for ${d}-tallet …">${escapeHtml(desc.tech || "")}</textarea>
        </label>
        <div class="desc-edit-actions">
          <button type="button" class="btn primary small dd-save">Lagre</button>
          <span class="dd-msg form-msg ok"></span>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll(".dd-save").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".desc-edit-item");
      const decadeId = item.dataset.decade;
      const society = item.querySelector(".dd-society").value.trim();
      const tech = item.querySelector(".dd-tech").value.trim();
      const msg = item.querySelector(".dd-msg");
      try {
        await saveDecadeDesc(decadeId, { society, tech });
        msg.textContent = "Lagret ✓";
        setTimeout(() => (msg.textContent = ""), 2500);
      } catch (err) {
        msg.textContent = "Feil: " + err.message;
        msg.className = "form-msg error";
      }
    });
  });
}

function renderSubgenreDescList() {
  const el = $("#subgenre-desc-list");
  const allSubs = [...new Set(
    state.artists.filter(a => a.status === "active")
      .flatMap(a => [...(a.mainGenre || []), ...(a.subGenre || [])])
  )].sort((a, b) => a.localeCompare(b, "no"));

  if (!allSubs.length) { el.innerHTML = `<p class="muted">Ingen undersjangre registrert blant artistene.</p>`; return; }

  el.innerHTML = allSubs.map((s) => {
    const desc = state.subgenreDescs[s] || {};
    return `
      <div class="desc-edit-item" data-subgenre="${escapeHtml(s)}">
        <h3>${escapeHtml(s)}</h3>
        <label>Beskrivelse
          <textarea class="sg-desc" rows="3" placeholder="Beskriv ${s} …">${escapeHtml(desc.description || "")}</textarea>
        </label>
        <div class="desc-edit-actions">
          <button type="button" class="btn primary small sg-save">Lagre</button>
          <span class="sg-msg form-msg ok"></span>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll(".sg-save").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".desc-edit-item");
      const subgenreId = item.dataset.subgenre;
      const description = item.querySelector(".sg-desc").value.trim();
      const msg = item.querySelector(".sg-msg");
      try {
        await saveSubgenreDesc(subgenreId, { description });
        msg.textContent = "Lagret ✓";
        setTimeout(() => (msg.textContent = ""), 2500);
      } catch (err) {
        msg.textContent = "Feil: " + err.message;
        msg.className = "form-msg error";
      }
    });
  });
}

setupGate();
