// ============================================================================
//  UI — ENDRINGSFORSLAG (diff-hjelpere)
// ----------------------------------------------------------------------------
//  Bygger og håndterer diff-tabellen for endringsforslag. Re-eksporteres fra
//  ui.js, så teacher.js og proposals.js importerer dem derfra som før.
// ============================================================================

import { escapeHtml } from "./util.js?v=2.71";

const FIELD_LABELS = {
  artist: {
    name: "Navn", birthYear: "Fødselsår", deathYear: "Dødsår", gender: "Kjønn",
    metaGenre: "Metasjanger", instrument: "Instrument",
    mainGenre: "Sjangre", subGenre: "Undersjangre",
    influenceStart: "Innflytelse fra", influenceEnd: "Innflytelse til",
    recordLabel: "Plateselskap", geography: "Geografi", description: "Beskrivelse",
    keyWorks: "Sentrale verk", musicExamples: "Musikkeksempler", kilder: "Kilder",
    imageUrl: "Bilde-URL", imageCredit: "Bildekreditering",
  },
  tech: {
    name: "Navn", category: "Kategori", adoptedYear: "Innført år",
    adoptedLabel: "Tidsangivelse", decade: "Tiår", description: "Beskrivelse",
    imageUrl: "Bilde-URL", imageCredit: "Bildekreditering", kilder: "Kilder",
  },
  subgenre: {
    description: "Beskrivelse",
  },
  "decade-society": {
    society: "Samfunnsutvikling", societyMore: "Samfunn (les mer)",
    kilder: "Kilder",
  },
  "decade-tech": {
    tech: "Teknologiutvikling", techMore: "Teknologi (les mer)",
    kilder: "Kilder",
  },
};

export function fieldLabelFor(entityType, key) {
  return (FIELD_LABELS[entityType] && FIELD_LABELS[entityType][key]) || key;
}

// Hjelper som viser/skjuler #sj-foot i sjanger-modalen og binder klikk.
export function wireProposeFoot(root, onPropose, hasPendingEdit, entityType, entityId, entityName, currentValues) {
  const foot = root.querySelector("#sj-foot");
  const btn = root.querySelector("#sj-propose");
  if (!foot || !btn) return;
  if (!onPropose) { foot.style.display = "none"; return; }
  const locked = hasPendingEdit?.(entityType, entityId);
  foot.style.display = "";
  btn.disabled = !!locked;
  btn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
  btn.onclick = () => onPropose({ entityType, entityId, entityName, currentValues });
}

// Deep-equal for primitiver, arrays, og enkle objekter (verdens-modellen vår).
function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return (a ?? "") === (b ?? "");
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => valuesEqual(x, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => valuesEqual(a[k], b[k]));
  }
  return false;
}

// Bygg en differanse-objekt: kun feltene som faktisk er endret.
export function diffFields(current, proposed) {
  const out = {};
  for (const k of Object.keys(proposed || {})) {
    if (!valuesEqual(current?.[k], proposed[k])) out[k] = proposed[k];
  }
  return out;
}

function formatDiffValue(v) {
  if (v == null || v === "") return `<span class="diff-empty">(tom)</span>`;
  if (Array.isArray(v)) {
    if (!v.length) return `<span class="diff-empty">(tom liste)</span>`;
    if (typeof v[0] === "object") {
      return v.map((it) => escapeHtml(it.title || it.label || it.text || it.name || JSON.stringify(it))).join(", ");
    }
    return v.map((x) => escapeHtml(String(x))).join(", ");
  }
  if (typeof v === "object") {
    return escapeHtml(JSON.stringify(v));
  }
  const str = String(v);
  if (str.length > 200) {
    return `<details><summary>${escapeHtml(str.slice(0, 200))}…</summary><div class="diff-full">${escapeHtml(str)}</div></details>`;
  }
  return escapeHtml(str);
}

// Renderer en redigerbar diff-tabell. Hver rad har en data-field attributt
// og en .diff-action-knapp som veksler tilstand mellom none/approved/rejected.
// Kalleren binder klikk-handler og leser ut valgte felter ved lagring.
export function renderEditDiff(entityType, currentValues, proposedFields) {
  const keys = Object.keys(proposedFields || {});
  if (!keys.length) {
    return `<p class="muted empty">Ingen endringer i dette forslaget.</p>`;
  }
  const rows = keys.map((k) => {
    const label = fieldLabelFor(entityType, k);
    const cur = formatDiffValue(currentValues?.[k]);
    const pro = formatDiffValue(proposedFields[k]);
    return `<tr class="diff-row" data-field="${escapeHtml(k)}">
      <td class="diff-field">${escapeHtml(label)}</td>
      <td class="diff-current">${cur}</td>
      <td class="diff-proposed">${pro}</td>
      <td class="diff-actions">
        <button type="button" class="btn ghost small diff-approve" data-action="approve" title="Godta">✓</button>
        <button type="button" class="btn ghost small diff-reject" data-action="reject" title="Avvis">✕</button>
      </td>
    </tr>`;
  });
  return `<table class="diff-table">
    <thead><tr><th>Felt</th><th>Gjeldende</th><th>Foreslått</th><th>Valg</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

// Etter at brukeren har klikket seg gjennom radene, hent ut feltnøklene som
// er markert som godkjent.
export function readApprovedFields(rootEl) {
  return [...rootEl.querySelectorAll(".diff-row.is-approved")].map((r) => r.dataset.field);
}

// Bind klikk-håndtering på diff-tabellen. Veksler is-approved/is-rejected
// klasser per rad. Idempotent — trygt å kalle flere ganger på samme element.
export function wireEditDiff(rootEl) {
  if (!rootEl || rootEl.dataset.diffWired === "1") return;
  rootEl.dataset.diffWired = "1";
  rootEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".diff-actions button");
    if (!btn) return;
    const row = btn.closest(".diff-row");
    if (!row) return;
    const action = btn.dataset.action;
    row.classList.toggle("is-approved", action === "approve" && !row.classList.contains("is-approved"));
    row.classList.toggle("is-rejected", action === "reject" && !row.classList.contains("is-rejected"));
    if (action === "approve") row.classList.remove("is-rejected");
    if (action === "reject") row.classList.remove("is-approved");
  });
}
