// ============================================================================
//  LÆRER — ENDRINGSFORSLAG (review/diff)
// ----------------------------------------------------------------------------
//  Lister studentenes foreslåtte endringer (og nye innovasjonskort) og lar
//  læreren godta/avvise enkeltfelter via diff-tabellen.
// ============================================================================

import { state, guardTeacherAction } from "./teacher-state.js?v=3.2";
import { escapeHtml, renderEditDiff, wireEditDiff, readApprovedFields, modalOpen, modalClose } from "./ui.js?v=3.2";
import { resolveDesc } from "./genre-descriptions.js?v=3.2";
import { approveTech, deleteTech, approvePendingEdit, rejectPendingEdit, genreEditLevel } from "./store.js?v=3.2";

function getCurrentEntityValues(edit) {
  const { entityType, entityId } = edit;
  switch (entityType) {
    case "artist": return state.artists.find(a => a.id === entityId) || {};
    case "tech":   return state.techItems.find(t => t.id === entityId) || {};
    case "subgenre": {
      // Les fra SAMME nivå som forslaget gjelder, så diffen viser riktig
      // eksisterende tekst (før: alltid main med sub som fallback).
      const d = resolveDesc(state.genreDescs, entityId, genreEditLevel(edit)).description;
      return { description: d || "" };
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

export function renderPendingEditsList() {
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
      <td><button type="button" class="btn ghost small" data-action="open-edit" data-id="${escapeHtml(e.id)}">Se forslag</button></td>
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

  const current = getCurrentEntityValues(edit);
  const body = document.getElementById("diff-body");
  body.innerHTML = renderEditDiff(edit.entityType, current, edit.proposedFields);
  wireEditDiff(body);

  modalOpen(document.getElementById("modal-diff"));
}

export function setupPendingEditsUi() {
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
        await guardTeacherAction(approveTech(apprBtn.dataset.id));
        return;
      }
      const rejBtn = e.target.closest('[data-action="reject-tech"]');
      if (rejBtn) {
        if (confirm("Avvise (slette) dette innovasjonskortet?")) {
          await guardTeacherAction(deleteTech(rejBtn.dataset.id));
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
    await guardTeacherAction(rejectPendingEdit(activeEditId));
    modalClose(diffModal);
    activeEditId = null;
  });
}
