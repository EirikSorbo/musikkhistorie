// ============================================================================
//  TEKNOLOGI & PODKAST
// ----------------------------------------------------------------------------
//  Innovasjonskort (detalj + liste) og podkast-lista. Flyttet ut av explore.js
//  (v3.55, runde 2). Delt kjerne fra explore-context.js.
// ============================================================================
import { renderTechDetail, renderTechList, modalOpen, modalClose } from "./ui.js?v=3.63";
import { podcastEpisodeHtml } from "./ui-helpers.js?v=3.63";
import { opts, getState, buildLinkCtx, injectTeacherRow } from "./explore-context.js?v=3.63";

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
export function refreshTechDetail() {
  const modal = document.getElementById("modal-tech-detail");
  if (!modal || !modal.classList.contains("open")) return;
  const t = (getState().techItems || []).find((x) => x.id === modal.dataset.techId);
  if (t) fillTechDetail(t);
  else modalClose(modal);
}

export function openPodkast() {
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

export function openTeknologi() {
  renderTeknologiList("");
  const modal = document.getElementById("modal-teknologi");
  modal.querySelectorAll(".tech-tab").forEach(b => b.classList.toggle("active", !b.dataset.techCat));
  modalOpen(modal);
}

export function renderTeknologiList(category) {
  const el = document.getElementById("tech-list");
  if (!el) return;
  const s = getState();
  renderTechList(el, s.techItems, category || "", buildLinkCtx());
}
