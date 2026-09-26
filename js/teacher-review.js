// ============================================================================
//  LÆRER — ENDRINGSFORSLAG (review/diff)
// ----------------------------------------------------------------------------
//  Lister studentenes foreslåtte endringer (og nye innovasjonskort) og lar
//  læreren godta/avvise enkeltfelter via diff-tabellen.
// ============================================================================

import { state, ctx, guardTeacherAction } from "./teacher-state.js?v=5.69";
import { escapeHtml, renderEditDiff, wireEditDiff, readApprovedFields, modalOpen, modalClose } from "./ui.js?v=5.69";
import { approveTech, deleteTech, approvePendingEdit, rejectPendingEdit, sendTilbake } from "./store.js?v=5.69";
import { currentEntityValues } from "./entity-values.js?v=5.69";
import { erTilModerasjon } from "./limits.js?v=5.69";

// Dagens verdier bor i den delte modulen (studentens retur-editor leser de
// samme): her bindes bare lærersidens state.
const getCurrentEntityValues = (edit) => currentEntityValues(state, edit);

function entityTypeLabel(t) {
  return ({
    artist: "Artist", tech: "Innovasjonskort", subgenre: "Sjanger",
    instrument: "Instrumentsammendrag",
    "decade-society": "Samfunnstiår", "decade-tech": "Teknologitiår",
    "new-tech": "Nytt innovasjonskort",
  })[t] || t;
}

export function renderPendingEditsList() {
  const el = document.getElementById("pending-edits-list");
  if (!el) return;
  // Ventende OG returnerte: et returnert kort er fortsatt lærerens sak
  // (studenten har det til retting), så det skal stå i køen med merke.
  const newTech = state.techItems.filter(erTilModerasjon);
  const edits = state.pendingEdits;

  if (!edits.length && !newTech.length) {
    el.innerHTML = `<p class="muted empty">Ingen endringsforslag akkurat nå.</p>`;
    return;
  }

  const editRows = edits.map((e) => {
    const fieldCount = Object.keys(e.proposedFields || {}).length;
    return `<tr class="pending-row" data-edit-id="${escapeHtml(e.id)}">
      <td><span class="tag">${escapeHtml(entityTypeLabel(e.entityType))}</span></td>
      <td>${escapeHtml(e.entityName || e.entityId)}${returCelle(e)}</td>
      <td>${fieldCount} felt</td>
      <td class="muted">${escapeHtml(e.proposedBy || "Anonym")}</td>
      <td><button type="button" class="btn ghost small" data-action="open-edit" data-id="${escapeHtml(e.id)}">Se forslag</button></td>
    </tr>`;
  });
  const techRows = newTech.map((t) => `<tr class="pending-row" data-tech-id="${escapeHtml(t.id)}">
    <td><span class="tag">${escapeHtml(entityTypeLabel("new-tech"))}</span></td>
    <td>${escapeHtml(t.name || "(uten navn)")}${returCelle(t)}</td>
    <td>—</td>
    <td class="muted">${escapeHtml(t.proposedBy || "Anonym")}</td>
    <td>
      <button type="button" class="btn ghost small" data-action="approve-tech" data-id="${escapeHtml(t.id)}">Godkjenn</button>
      <button type="button" class="btn ghost small" data-action="reject-tech" data-id="${escapeHtml(t.id)}">Avvis</button>
      <button type="button" class="btn ghost small" data-action="return-tech" data-id="${escapeHtml(t.id)}">${t.status === "returnert" ? "Ny kode" : "Send tilbake"}</button>
    </td>
  </tr>`);

  el.innerHTML = `<table class="pending-table">
    <thead><tr><th>Type</th><th>Entitet</th><th>Endringer</th><th>Foreslått av</th><th></th></tr></thead>
    <tbody>${editRows.join("")}${techRows.join("")}</tbody>
  </table>`;
}

// Returstatus i navnecella: hos studenten (med koden læreren skal dele) eller
// studentens kommentar ved ny innsending. Delt av tech- og forslagsradene.
function returCelle(item) {
  if (item.status === "returnert") {
    return `<div class="retur-linje"><span class="badge returned">Hos studenten</span> Kode: <code class="retur-kode-inline">${escapeHtml(item.returKode || "")}</code></div>`;
  }
  if (item.studentComment) {
    return `<div class="retur-linje muted">Kommentar fra studenten: ${escapeHtml(item.studentComment)}</div>`;
  }
  return "";
}

let activeEditId = null;

function openDiffModal(editId) {
  const edit = state.pendingEdits.find(e => e.id === editId);
  if (!edit) return;
  activeEditId = editId;

  // entityName er FRITT satt av innsenderen, mens entityId er det som faktisk
  // skrives til. For de NAVNEBASERTE typene (subgenre, instrument, decade-*)
  // er ID-en et lesbart navn: spriker de, kunne et forslag stå som «Bebop» i
  // køen og skrive til Blues, så begge vises. Artist- og tech-forslag bærer en
  // tilfeldig Firestore-ID som ALLTID er ulik navnet (audit-funn 28): der var
  // «(skriver til: 7Kd2xQ…)» bare støy på hvert eneste forslag.
  const navnebasert = ["subgenre", "instrument", "decade-society", "decade-tech"].includes(edit.entityType);
  const visning = navnebasert && edit.entityName && edit.entityName !== edit.entityId
    ? `${edit.entityName} (skriver til: ${edit.entityId})`
    : (edit.entityName || edit.entityId || "");
  document.getElementById("diff-title").textContent =
    `${entityTypeLabel(edit.entityType)}: ${visning}`;
  let meta = `Foreslått av ${edit.proposedBy || "Anonym"}. Klikk ✓ på radene du vil godta, ✕ på de du vil avvise. Velg «Lagre valgte endringer» til slutt.`;
  if (edit.status === "returnert") {
    meta = `Hos studenten til retting (kode ${edit.returKode || ""}). Foreslått av ${edit.proposedBy || "Anonym"}.`;
  } else if (edit.studentComment) {
    meta = `Ny innsending etter retur. Kommentar fra studenten: «${edit.studentComment}». Foreslått av ${edit.proposedBy || "Anonym"}.`;
  }
  document.getElementById("diff-meta").textContent = meta;
  document.getElementById("diff-msg").textContent = "";
  const returBtn = document.getElementById("diff-retur");
  if (returBtn) returBtn.textContent = edit.status === "returnert" ? "Ny kode til studenten" : "Send tilbake";

  const current = getCurrentEntityValues(edit);
  const body = document.getElementById("diff-body");
  body.innerHTML = renderEditDiff(edit.entityType, current, edit.proposedFields);
  wireEditDiff(body);

  modalOpen(document.getElementById("modal-diff"));
}

export function setupPendingEditsUi() {
  // Endringsforslag åpnes fra Skrivebordets innboks (renderDesk → review-edits);
  // det gamle «btn-pending-edits»-inngangspunktet finnes ikke lenger i markupen.
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
        return;
      }
      const returBtn = e.target.closest('[data-action="return-tech"]');
      if (returBtn) openReturDialog("tech", returBtn.dataset.id);
    });
  }

  setupReturDialog();
  ctx.openReturDialog = openReturDialog;

  const saveBtn = document.getElementById("diff-save");
  const rejectAllBtn = document.getElementById("diff-reject-all");
  const diffModal = document.getElementById("modal-diff");

  if (saveBtn) saveBtn.addEventListener("click", async () => {
    if (!activeEditId) return;
    const body = document.getElementById("diff-body");
    const approved = readApprovedFields(body);
    const msg = document.getElementById("diff-msg");
    if (!approved.length) {
      msg.textContent = "Ingen felt valgt. Bruk «Avvis alle» hvis du vil forkaste hele forslaget.";
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

  const diffReturBtn = document.getElementById("diff-retur");
  if (diffReturBtn) diffReturBtn.addEventListener("click", () => {
    if (activeEditId) openReturDialog("edit", activeEditId);
  });
}

// ----------------------------------------------------------------------------
//  «Send tilbake»-dialogen (delt av artistkort, tech-rader og diff-modalen)
// ----------------------------------------------------------------------------
//  Fase 1: skriv tilbakemelding. Fase 2 (etter lagring): vis koden studenten
//  trenger for å hente forslaget på en annen enhet. Å sende på nytt mens noe
//  alt er hos studenten gir ny kode og ny tilbakemelding (gammel kode dør).

let activeRetur = null; // { type: "artist"|"tech"|"edit", id }

function openReturDialog(type, id) {
  const item = type === "artist" ? state.artists.find(x => x.id === id)
    : type === "tech" ? state.techItems.find(x => x.id === id)
    : state.pendingEdits.find(x => x.id === id);
  if (!item) return;
  activeRetur = { type, id };

  const navn = type === "edit"
    ? `${entityTypeLabel(item.entityType)}: ${item.entityName || item.entityId}`
    : (item.name || "(uten navn)");
  document.getElementById("retur-title").textContent = `Send tilbake: ${navn}`;
  const ta = document.getElementById("retur-feedback");
  ta.value = item.teacherFeedback || "";
  const msg = document.getElementById("retur-msg");
  msg.textContent = "";
  msg.className = "form-msg";
  document.getElementById("retur-form").hidden = false;
  document.getElementById("retur-result").hidden = true;
  modalOpen(document.getElementById("modal-retur"));
  ta.focus();
}

function setupReturDialog() {
  const sendBtn = document.getElementById("retur-send");
  if (!sendBtn) return;

  sendBtn.addEventListener("click", async () => {
    if (!activeRetur) return;
    const feedback = document.getElementById("retur-feedback").value.trim();
    const msg = document.getElementById("retur-msg");
    if (!feedback) {
      msg.textContent = "Skriv hva studenten må rette. Uten tilbakemelding vet de ikke hvorfor de fikk forslaget tilbake.";
      msg.className = "form-msg warn";
      return;
    }
    sendBtn.disabled = true;
    try {
      const kode = await sendTilbake(activeRetur.type, activeRetur.id, feedback);
      document.getElementById("retur-kode").textContent = kode;
      document.getElementById("retur-form").hidden = true;
      document.getElementById("retur-result").hidden = false;
      // Kom dialogen fra diff-modalen, er saken avgjort der: lukk den under.
      if (activeRetur.type === "edit") {
        modalClose(document.getElementById("modal-diff"));
        activeEditId = null;
      }
    } catch (e) {
      msg.textContent = "Feil ved sending: " + (e?.message || e);
      msg.className = "form-msg error";
    } finally {
      sendBtn.disabled = false;
    }
  });

  const doneBtn = document.getElementById("retur-done");
  if (doneBtn) doneBtn.addEventListener("click", () => {
    modalClose(document.getElementById("modal-retur"));
    activeRetur = null;
  });
}
