// ============================================================================
//  LÆRER — INNHOLDSREDIGERING
// ----------------------------------------------------------------------------
//  Tiår- og sjangerbeskrivelser (enkeltmodaler), teknologi-admin og podkast-
//  administrasjon. Deler tilstand/eksplore via teacher-state.
// ============================================================================

import { state, ctx, openAdminModal, closeAdminModal } from "./teacher-state.js?v=2.46";
import { saveDecadeDesc, saveSubgenreDesc, addTech, updateTech, deleteTech, addPodcast, deletePodcast } from "./store.js?v=2.46";
import { escapeHtml, formatInfoText, buildTimeline, buildTechTimeline, buildKilderList, fmtCredit, buildMainGenreList, setupModal, modalOpen } from "./ui.js?v=2.46";
import { linkifyAll, wireAllLinks } from "./linkify.js?v=2.46";
import { $ } from "./shared.js?v=2.46";

// ----------------------------------------------------------------------------
//  Tiår- og sjangerbeskrivelser (enkeltmodaler)
// ----------------------------------------------------------------------------

let teacherContextMode = "society";

export function openSingleDecadeModal(decadeId, mode) {
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
        if (t) ctx.explore.openTechDetail(t);
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

export function openSingleSubgenreModal(subgenreId) {
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

export function setupSubgenreSingleSave() {
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
            if (t2) ctx.explore.openTechDetail(t2);
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
