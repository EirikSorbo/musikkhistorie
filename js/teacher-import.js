// ============================================================================
//  LÆRER — IMPORT / EKSPORT / FLETTING
// ----------------------------------------------------------------------------
//  Eksporterer hele datasettet til JSON, og importerer ved enten å erstatte
//  alt eller flette inn med konfliktløsing felt for felt.
// ============================================================================

import { state, openAdminModal, closeAdminModal } from "./teacher-state.js?v=2.52";
import {
  addArtist,
  teacherDelete,
  deleteAllArtists,
  updateTech,
  addTech,
  saveDecadeDesc,
  saveSubgenreDesc,
  updateArtistFields,
} from "./store.js?v=2.52";
import { escapeHtml } from "./ui.js?v=2.52";
import { $ } from "./shared.js?v=2.52";

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

export function setupDataButtons() {
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
    const { id: _omit, ...rest } = s;
    if (rest.description || rest.meta || rest.main || rest.sub) subgenres[id] = rest;
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

export function setupImportChoice() {
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
    if (data.description || data.meta || data.main || data.sub) {
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
