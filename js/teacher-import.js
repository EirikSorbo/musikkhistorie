// ============================================================================
//  LÆRER — IMPORT / EKSPORT / FLETTING
// ----------------------------------------------------------------------------
//  Eksporterer hele datasettet til JSON, og importerer ved enten å erstatte
//  alt eller flette inn med konfliktløsing felt for felt.
// ============================================================================

import { state, openAdminModal, closeAdminModal } from "./teacher-state.js?v=2.83";
import {
  addArtistsBulk,
  deleteAllArtists,
  updateTech,
  addTech,
  saveDecadeDesc,
  saveGenreDesc,
  updateArtistFields,
} from "./store.js?v=2.83";
import { escapeHtml } from "./ui.js?v=2.83";
import { $ } from "./shared.js?v=2.83";
import { GENEALOGY_META_GENRES, isMainGenre } from "./genealogy.js?v=2.83";
import { ARTIST_LABELS, ARTIST_COMPARE_FIELDS, ARTIST_EXPORT_FIELDS } from "./artist-schema.js?v=2.83";
import { flattenGenreDescriptions, validateArtistsForImport } from "./import-format.js?v=2.83";

// Feltlister og etiketter kommer fra det delte artist-skjemaet.
const EXPORT_FIELDS = ARTIST_EXPORT_FIELDS;
const MERGE_LABELS = ARTIST_LABELS;
const COMPARE_FIELDS = ARTIST_COMPARE_FIELDS;

const mergeState = { queue: [], newArtists: [], index: 0 };
// true mens finishMerge faktisk lagrer — så flette-avbrudd-vakten ikke tolker
// en normal fullføring som et avbrudd.
let mergeCommitting = false;

function mergeHasUnsaved() {
  return mergeState.newArtists.length > 0 ||
    mergeState.queue.some((it) => it.conflicts.length > 0 || Object.keys(it.resolved).length > 0);
}

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

// Hvilket nivå (meta/main/sub) en sjanger hører til — samme inndeling som
// lærer-dashboardet. Delt av eksport og import.
function genreSectionOf(name) {
  const metaSet = new Set(state.config?.metaGenres || GENEALOGY_META_GENRES);
  return metaSet.has(name) ? "meta" : (isMainGenre(name) ? "main" : "sub");
}

// Har tiåret noe innhold verdt å eksportere/importere? (samfunn/teknologi,
// «les mer»-tekstene, eller kilder).
function hasDecadeContent(d) {
  return !!(d && (d.society || d.tech || d.societyMore || d.techMore ||
    (Array.isArray(d.kilder) && d.kilder.length)));
}

// Bygger hele eksport-objektet fra gjeldende state. Delt av den manuelle
// «Eksporter»-knappen og av auto-sikkerhetskopien før «Erstatt alle».
// Tar med ALLE artister uansett status (også ventende forslag) og alle
// eksportfelter (inkl. votedUpBy), så backupen er komplett og tapsfri —
// deleteAllArtists sletter hele artistsamlingen, så alt her må bevares.
function buildExportData() {
  const artists = state.artists
    .map((a) => Object.fromEntries(EXPORT_FIELDS.map((f) => [f, a[f] ?? null])));

  const decades = {};
  for (const [id, d] of Object.entries(state.decadeDescs)) {
    if (hasDecadeContent(d)) {
      decades[id] = {
        society: d.society || "", tech: d.tech || "",
        societyMore: d.societyMore || "", techMore: d.techMore || "",
        kilder: Array.isArray(d.kilder) ? d.kilder : [],
      };
    }
  }

  // Sjangerbeskrivelser eksporteres NESTET i tre bolker (meta → main → sub), så
  // fila blir oversiktlig i stedet for én lang flat liste. Bolken bestemmes av
  // sjangerens TYPE (samme inndeling som lærer-dashboardet):
  //   metasjanger (config.metaGenres) → meta
  //   tre-sjanger  (isMainGenre)       → main
  //   ellers (fri undersjanger)        → sub
  // Metasjangre som også er tre-noder (Blues, Jazz, Gospel …) havner under meta.
  // Hvert navn står ÉN gang (ett dokument); alle nivå-tekstene ligger i samme
  // dokument. Import (flattenGenreDescriptions) leser både dette og flat format.
  const genreDescriptions = { meta: {}, main: {}, sub: {} };
  Object.entries(state.genreDescs)
    .map(([id, s]) => { const { id: _omit, ...rest } = s; return [id, rest]; })
    .filter(([, rest]) => rest.description || rest.meta || rest.main || rest.sub)
    .sort(([aId], [bId]) => aId.localeCompare(bId, "no"))
    .forEach(([id, rest]) => { genreDescriptions[genreSectionOf(id)][id] = rest; });

  const tech = state.techItems.map(t => {
    const { id, ...rest } = t;
    return rest;
  });

  return { artists, decades, genreDescriptions, tech };
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// Laster ned et objekt som en JSON-fil i lærerens nettleser.
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  link.click();
  // Revoker sent — å revokere synkront rett etter click() kan avbryte selve
  // nedlastingen i enkelte nettlesere.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function handleExport() {
  downloadJson(buildExportData(), `musikkhistorie-${dateStamp()}.json`);
}

let pendingImportData = null;

// Bygger en lesbar norsk feilrapport fra validateArtistsForImport, med
// radnummer, så læreren kan rette filen. Understreker at ingenting er endret.
function formatImportErrors(errors) {
  const shown = errors.slice(0, 12).map((e) =>
    `• Rad ${e.row}${e.name ? ` («${e.name}»)` : ""}: ${e.problems.join(" ")}`
  );
  const more = errors.length > 12 ? `\n… og ${errors.length - 12} rad(er) til.` : "";
  return `Importen ble avbrutt — ${errors.length} rad(er) har feil, og INGENTING er endret:\n\n` +
         `${shown.join("\n")}${more}\n\nRett opp filen og prøv igjen.`;
}

async function handleImportFile(file) {
  if (!file) return;
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { alert("Ugyldig JSON-fil."); return; }

  let artists, decades, genreDescriptions, tech;
  if (Array.isArray(raw)) {
    artists = raw;
    decades = {};
    genreDescriptions = {};
    tech = [];
  } else if (raw && typeof raw === "object" && Array.isArray(raw.artists)) {
    artists = raw.artists;
    decades = raw.decades || {};
    // Nytt nøkkelnavn er «genreDescriptions»; eldre filer bruker «subgenres».
    // Nytt format er nestet pr. nivå — flat ut til { navn: dokument }.
    genreDescriptions = flattenGenreDescriptions(raw.genreDescriptions || raw.subgenres || {});
    tech = raw.tech || [];
  } else {
    alert("Ugyldig format — filen må være en array eller et objekt med «artists»."); return;
  }

  // Valider HELE artistlista før noe kan skrives/slettes. Slår feil her ⇒
  // ingenting røres, og «Erstatt alle» kan ikke slette dagens data og så
  // feile på en skjev fil.
  const { ok, errors } = validateArtistsForImport(artists);
  if (!ok) { alert(formatImportErrors(errors)); return; }

  pendingImportData = { artists, decades, genreDescriptions, tech };
  const parts = [];
  const artistCount = artists.filter(a => a.name).length;
  if (artistCount) parts.push(`${artistCount} artister`);
  const decadeCount = Object.keys(decades).length;
  if (decadeCount) parts.push(`${decadeCount} tiårsbeskrivelser`);
  const subCount = Object.keys(genreDescriptions).length;
  if (subCount) parts.push(`${subCount} sjangerbeskrivelser`);
  if (tech.length) parts.push(`${tech.length} teknologier`);
  $("#import-choice-desc").textContent = `Filen inneholder ${parts.join(", ")}.`;
  openAdminModal("modal-import-choice");
}

export function setupImportChoice() {
  $("#import-replace").addEventListener("click", async () => {
    closeAdminModal("modal-import-choice");
    if (pendingImportData) {
      // Bare importer beskrivelser/teknologi hvis selve erstatningen faktisk
      // ble gjennomført (læreren kan ha avbrutt bekreftelsen).
      const didReplace = await handleReplace(pendingImportData.artists);
      if (didReplace) {
        await importDescriptions(pendingImportData);
        await importTechItems(pendingImportData.tech);
      }
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

  // Flette-modalen lukkes med backdrop-klikk/Escape (generisk). Lukkes den midt
  // i konfliktløsingen, gikk nye artister + autofyll tidligere tapt uten spor;
  // her oppdager vi det og varsler tydelig i stedet.
  const mergeModal = document.getElementById("modal-merge");
  if (mergeModal && "MutationObserver" in window) {
    new MutationObserver(() => {
      if (!mergeModal.classList.contains("open") && !mergeCommitting && mergeHasUnsaved()) {
        mergeState.queue = []; mergeState.newArtists = []; mergeState.index = 0;
        alert("Flettingen ble avbrutt — ingen endringer er lagret. Importer fila på nytt for å prøve igjen.");
      }
    }).observe(mergeModal, { attributes: true, attributeFilter: ["class"] });
  }
}

async function importDescriptions({ decades, genreDescriptions }) {
  let ok = 0, fail = 0;
  for (const [id, data] of Object.entries(decades || {})) {
    if (hasDecadeContent(data)) {
      try { await saveDecadeDesc(id, data); ok++; }
      catch (e) { fail++; console.error("Tiår-import feilet for", id, e); }
    }
  }
  for (const [id, data] of Object.entries(genreDescriptions || {})) {
    // Eldre flat form { description } leses ikke av appen (den leser kun
    // meta/main/sub). Pakk den inn i riktig nivå før lagring.
    let toSave = data;
    if (data && data.description && !data.meta && !data.main && !data.sub) {
      const { description, ...rest } = data;
      toSave = { [genreSectionOf(id)]: { description, ...rest } };
    }
    if (toSave.description || toSave.meta || toSave.main || toSave.sub) {
      try { await saveGenreDesc(id, toSave); ok++; }
      catch (e) { fail++; console.error("Sjanger-import feilet for", id, e); }
    }
  }
  if (fail > 0) {
    alert(`${fail} beskrivelse(r) kunne ikke lagres.\n\nSannsynlig årsak: Firestore-reglene tillater ikke skriving til 'genreDescriptions' eller 'decades'.\n\nGå til Firebase Console → Firestore → Rules og publiser oppdaterte regler.`);
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

// Erstatter hele artistsamlingen. Lista er allerede validert i
// handleImportFile, så «slett-så-feil»-scenarioet er umulig her. I tillegg
// lastes en full sikkerhetskopi av dagens data ned FØR slettingen, som et
// ekstra sikkerhetsnett dersom skrivingen skulle feile midtveis.
// Returnerer true hvis erstatningen ble gjennomført, false hvis avbrutt/feilet.
async function handleReplace(data) {
  const toAdd = data
    .filter((a) => a.name)
    .map((a) => ({ proposedBy: "Eirik Sørbø", status: "active", ...a }));
  // Ikke la en tom eller feil fil tømme hele basen ved et uhell.
  if (!toAdd.length) {
    alert("Filen inneholder ingen gyldige artister. «Erstatt alle» er avbrutt for å unngå å tømme databasen.");
    return false;
  }
  if (!confirm(
    `Dette sletter alle ${state.artists.length} eksisterende artister ` +
    `(inkludert stemmer og ventende forslag) og erstatter dem med ${toAdd.length} fra filen.\n\n` +
    `En full sikkerhetskopi av dagens data lastes ned først.\n\nFortsette?`
  )) return false;
  // Last ned backupen og KREV at læreren bekrefter at fila faktisk kom før vi
  // sletter — en programmatisk nedlasting kan bli blokkert stille, og da skal
  // vi ikke slette noe.
  downloadJson(buildExportData(), `musikkhistorie-BACKUP-${dateStamp()}.json`);
  if (!confirm(
    "En sikkerhetskopi skal nå ligge i Nedlastinger (musikkhistorie-BACKUP-…).\n\n" +
    "Bekreft at du finner filen der FØR vi sletter. Trykk Avbryt hvis den mangler."
  )) return false;
  try {
    const deleted = await deleteAllArtists();
    const added = await addArtistsBulk(toAdd);
    alert(`${deleted} slettet, ${added} importert.`);
    return true;
  } catch (err) {
    console.error("Import feilet:", err);
    alert("Import feilet: " + err.message +
      "\n\nBruk sikkerhetskopien fra Nedlastinger for å gjenopprette (Importer → Erstatt alle).");
    return false;
  }
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
  mergeCommitting = true;
  closeAdminModal("modal-merge");
  try {
    let updated = 0;
    const added = await addArtistsBulk(
      mergeState.newArtists.map((a) => ({ proposedBy: "Eirik Sørbø", status: "active", ...a }))
    );
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
  } catch (err) {
    // Uten denne ville en skrivefeil midt i flettingen vært helt stille
    // (modalen er alt lukket, ingen success-alert kommer). Re-import av samme
    // fil er trygt: alt-lagte artister matches på navn og dupliseres ikke.
    console.error("Fletting feilet:", err);
    alert("Flettingen feilet: " + err.message +
      "\n\nNoen endringer kan være delvis lagret. Importer fila på nytt for å fullføre — allerede lagrede artister dupliseres ikke.");
  } finally {
    mergeState.queue = []; mergeState.newArtists = []; mergeState.index = 0;
    mergeCommitting = false;
  }
}
