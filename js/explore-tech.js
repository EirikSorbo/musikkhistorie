// ============================================================================
//  TEKNOLOGI
// ----------------------------------------------------------------------------
//  Innovasjonskort (detalj + liste). Flyttet ut av explore.js
//  (v3.55, runde 2). Delt kjerne fra explore-context.js.
// ============================================================================
import { renderTechDetail, renderTechList, modalOpen, modalClose } from "./ui.js?v=6.08";
import { opts, getState, buildLinkCtx, injectTeacherRow } from "./explore-context.js?v=6.08";

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
  const modal = document.getElementById("modal-tech-detail");
  modal.dataset.vis = `tech:${t.id}`;   // «Kopier lenke» (v5.22)
  modalOpen(modal);
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


// `category` åpner seksjonen med den fanen alt valgt — brukt av kategori-lenka
// på innovasjonskortene. Uten argument vises alle kortene, som før.
// Tiårsfilteret (v6.07, K6): «Se dem som kort» i tiårsvinduet viser bare
// tiårets innovasjonskort, med en linje over lista som sier det og fører til
// alle. Gjelder til lista åpnes uten filter igjen.
let tiarFilter = null;

export function openTeknologi(category = "", { tiar = null } = {}) {
  tiarFilter = Number.isFinite(Number(tiar)) && tiar !== null ? Number(tiar) : null;
  renderTeknologiList(category);
  const modal = document.getElementById("modal-teknologi");
  modal.querySelectorAll(".tech-tab").forEach(b =>
    b.classList.toggle("active", (b.dataset.techCat || "") === category));
  modalOpen(modal);
}

export function renderTeknologiList(category) {
  const el = document.getElementById("tech-list");
  if (!el) return;
  const s = getState();
  const items = tiarFilter === null ? s.techItems : (s.techItems || []).filter((t) => t.decade === String(tiarFilter));
  renderTechList(el, items, category || "", buildLinkCtx());
  const linje = document.getElementById("tech-tiar-linje");
  if (linje) {
    linje.hidden = tiarFilter === null;
    linje.innerHTML = tiarFilter === null ? ""
      : `Viser innovasjonskortene fra ${tiarFilter}-tallet. <button type="button" class="dv-lenke">Vis alle <span aria-hidden="true">›</span></button>`;
    const alle = linje.querySelector("button");
    if (alle) alle.onclick = () => { tiarFilter = null; renderTeknologiList(category); };
  }
  // Valgt kategori hører med i lenka og i et stopp (audit v5.42 funn 16);
  // apneMaal forstår «teknologi:<kategori>».
  const modal = document.getElementById("modal-teknologi");
  const vis = category ? `teknologi:${category}` : "teknologi";
  if (modal && modal.dataset.vis !== vis) modal.dataset.vis = vis;
}

// En åpen teknologiliste tegnes på nytt når kortene lander eller endres: den
// ble før bare tegnet ved åpning og fanebytte, og en tidlig åpning (også en
// ?vis=teknologi-lenke) ble stående med «ingen teknologier» (funn 18).
export function refreshTeknologi() {
  const modal = document.getElementById("modal-teknologi");
  if (!modal?.classList.contains("open")) return;
  const aktiv = modal.querySelector(".tech-tab.active");
  renderTeknologiList(aktiv?.dataset.techCat || "");
}
