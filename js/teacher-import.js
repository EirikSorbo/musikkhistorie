// ============================================================================
//  LÆRER — IMPORT / EKSPORT / FLETTING
// ----------------------------------------------------------------------------
//  Eksporterer hele datasettet til JSON, og importerer ved enten å erstatte
//  alt eller flette inn med konfliktløsing felt for felt.
// ============================================================================

import { state, openAdminModal, closeAdminModal } from "./teacher-state.js?v=3.70";
import {
  addArtistsBulk,
  deleteAllArtists,
  updateTech,
  addTech,
  saveDocsBulk,
  updateArtistFields,
  mergeVarmekartRows,
  addPodcast,
  updatePodcast,
  setTeacherChecks,
} from "./store.js?v=3.70";
import { escapeHtml } from "./ui.js?v=3.70";
import { $ } from "./shared.js?v=3.70";
import { GENEALOGY_META_GENRES, isMainGenre } from "./genealogy.js?v=3.70";
import { ARTIST_LABELS, ARTIST_COMPARE_FIELDS, ARTIST_EXPORT_FIELDS } from "./artist-schema.js?v=3.70";
import { INSTRUMENTS } from "./limits.js?v=3.70";
import { flattenGenreDescriptions, validateArtistsForImport } from "./import-format.js?v=3.70";

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
    if (!state.artistsLoaded) {
      alert("Artistdataene er ikke ferdig lastet ennå. Vent til lista vises før du sletter — ellers blir sikkerhetskopien tom mens slettingen går mot serveren.");
      return;
    }
    if (!confirm("Er du HELT sikker? Dette sletter ALL artistdata permanent. Handlingen kan ikke angres.")) return;
    // Samme sikkerhetsnett som «Erstatt alle»: full backup lastes ned FØR
    // slettingen, og læreren må aktivt skrive SLETT for å bekrefte.
    downloadJson(buildExportData(), `musikkhistorie-BACKUP-${dateStamp()}.json`);
    const svar = prompt(
      "En sikkerhetskopi skal nå ligge i Nedlastinger (musikkhistorie-BACKUP-…).\n\n" +
      "Skriv SLETT for å bekrefte at all artistdata skal slettes permanent:"
    );
    if (svar === null) return;
    if (svar.trim().toUpperCase() !== "SLETT") {
      alert("Sletting avbrutt — du må skrive SLETT for å bekrefte.");
      return;
    }
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
// lærer-dashboardet. Delt av eksport og import. Treet er eneste kilde til
// metasjangre (config-lista er fjernet, v3.20).
const META_SET = new Set(GENEALOGY_META_GENRES);
function genreSectionOf(name) {
  return META_SET.has(name) ? "meta" : (isMainGenre(name) ? "main" : "sub");
}

// Har tiåret noe innhold verdt å eksportere/importere? (samfunn/teknologi,
// «les mer»-tekstene, eller kilder).
function hasDecadeContent(d) {
  return !!(d && (d.society || d.tech || d.societyMore || d.techMore ||
    (Array.isArray(d.kilder) && d.kilder.length)));
}

// Bygger hele eksport-objektet fra gjeldende state. Delt av den manuelle
// «Eksporter»-knappen og av auto-sikkerhetskopien før «Erstatt alle».
// Tar med ALLE artister uansett status (også ventende forslag), alle
// eksportfelter (inkl. votedUpBy) OG lærerens sjekk-fremdrift (teacherChecks),
// så backupen bevarer alt pensuminnhold før deleteAllArtists. `pendingEdits`
// (åpne studentforslag) tas bevisst IKKE med — de er flyktige og skal
// behandles, ikke arkiveres. `formatVersion` merker filformatet.
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
  //   hovedsjanger (treets metasjangre) → meta
  //   tre-sjanger  (isMainGenre)        → main
  //   ellers (fri undersjanger)         → sub
  // Hovedsjangre som også er tre-noder (Blues, Jazz, Gospel …) havner under meta.
  // Hvert navn står ÉN gang (ett dokument); alle nivå-tekstene ligger i samme
  // dokument. Import (flattenGenreDescriptions) leser både dette og flat format.
  // story = sjangerhistorien (eneste kilde — ingen standardtekst i koden) —
  // må med i backupen, ellers går tekstene tapt ved «Erstatt alle».
  const genreDescriptions = { meta: {}, main: {}, sub: {} };
  Object.entries(state.genreDescs)
    .map(([id, s]) => {
      const { id: _omit, ...rest } = s;
      // Dropp de DØDE flate `description`/`kilder`-feltene når et nivåfelt
      // finnes: appen leser kun nivåene, og backupen skal ikke bære
      // duplisert/stale tekst videre (import ville ellers re-lagret det). Et
      // umigrert flat-ONLY-dokument beholder teksten, så importen kan pakke den
      // inn i riktig nivå.
      if ((rest.main || rest.sub) && (rest.description !== undefined || rest.kilder !== undefined)) {
        const { description: _d, kilder: _k, ...r } = rest;
        return [id, r];
      }
      return [id, rest];
    })
    .filter(([, rest]) => rest.description || rest.meta || rest.main || rest.sub || rest.story)
    .sort(([aId], [bId]) => aId.localeCompare(bId, "no"))
    .forEach(([id, rest]) => { genreDescriptions[genreSectionOf(id)][id] = rest; });

  // Koblingsbeskrivelser (strekene i slektstreet) — doc-ID «fra__til» beholdes
  // som nøkkel, så import kan skrive rett tilbake til samme dokumenter.
  const edgeDescriptions = {};
  Object.entries(state.edgeDescs || {})
    .map(([id, s]) => { const { id: _omit, ...rest } = s; return [id, rest]; })
    .filter(([, rest]) => rest.description)
    .sort(([aId], [bId]) => aId.localeCompare(bId, "no"))
    .forEach(([id, rest]) => { edgeDescriptions[id] = rest; });

  const tech = state.techItems.map(t => {
    const { id, ...rest } = t;
    return rest;
  });

  // Innholdssidene (Om historie, Røtter) og varmekartet — fra content-
  // samlingen, så backupen inneholder ALT pensuminnhold (koden har ingen
  // fallback-tekster). Podkast-metadata tas også med. (Config er borte, v3.68:
  // instrument-vokabularet bor i koden — INSTRUMENTS i limits.js.)
  const pages = {};
  for (const [id, docData] of Object.entries(state.content || {})) {
    if (id !== "varmekart" && docData?.body) pages[id] = docData;
  }
  const varmekart = state.content?.varmekart?.heat
    ? { heat: state.content.varmekart.heat, updatedAt: state.content.varmekart.updatedAt || null }
    : null;

  const podcasts = state.podcasts.map((p) => {
    const { id, ...rest } = p;
    return rest;
  });

  const out = {
    formatVersion: 1,
    artists, decades, genreDescriptions, edgeDescriptions, tech, pages, podcasts,
    teacherChecks: state.teacherChecks || null,
  };
  if (varmekart) out.varmekart = varmekart;
  return out;
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

// Innholdsdeler en importfil kan bære utover artistene.
const CONTENT_KEYS = ["decades", "genreDescriptions", "edgeDescriptions", "subgenres", "tech", "pages", "varmekart", "podcasts", "config"];

// Alle toppnøkler appen forstår. Ukjente nøkler (feilstavet, eller fra et nyere
// format) ignoreres stille ved import — vi advarer i stedet, så delvise/skjeve
// pakker oppdages.
const KNOWN_IMPORT_KEYS = new Set(["formatVersion", "artists", "teacherChecks", ...CONTENT_KEYS]);

// Sjangre (mainGenre) i importen som ikke finnes i slektstreet — samme
// «single source of truth»-sjekk som redigeringsskjemaet. Advarsel, ikke feil.
function collectUnknownGenres(artists) {
  const bad = new Set();
  for (const a of artists || []) {
    const mg = Array.isArray(a.mainGenre) ? a.mainGenre : (a.mainGenre ? [a.mainGenre] : []);
    for (const g of mg) {
      const name = String(g || "").trim();
      if (name && !isMainGenre(name)) bad.add(name);
    }
  }
  return [...bad];
}

// Instrument-verdier i importen utenfor INSTRUMENTS-vokabularet (limits.js) —
// samme vakt som sjangrene, saa Saxofon/Saksofon-drift ikke kan gjenoppstaa
// via en gammel backup. Advarsel, ikke feil.
function collectUnknownInstruments(artists) {
  const bad = new Set();
  for (const a of artists || []) {
    const name = String(a.instrument || "").trim();
    if (name && !INSTRUMENTS.includes(name)) bad.add(name);
  }
  return [...bad];
}

function importParts(data) {
  const parts = [];
  const artistCount = (data.artists || []).filter(a => a.name).length;
  if (artistCount) parts.push(`${artistCount} artister`);
  const decadeCount = Object.keys(data.decades || {}).length;
  if (decadeCount) parts.push(`${decadeCount} tiårsbeskrivelser`);
  const subCount = Object.keys(data.genreDescriptions || {}).length;
  if (subCount) parts.push(`${subCount} sjangerbeskrivelser`);
  const edgeCount = Object.keys(data.edgeDescriptions || {}).length;
  if (edgeCount) parts.push(`${edgeCount} koblingsbeskrivelser`);
  if ((data.tech || []).length) parts.push(`${data.tech.length} teknologier`);
  const pageCount = Object.keys(data.pages || {}).length;
  if (pageCount) parts.push(`${pageCount} innholdsside(r)`);
  if (data.varmekart?.heat) parts.push(`varmekart (${Object.keys(data.varmekart.heat).length} sjangre)`);
  if ((data.podcasts || []).length) parts.push(`${data.podcasts.length} podkastepisoder`);
  return parts;
}

async function handleImportFile(file) {
  if (!file) return;
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { alert("Ugyldig JSON-fil."); return; }

  let data;
  if (Array.isArray(raw)) {
    data = { artists: raw, decades: {}, genreDescriptions: {}, tech: [] };
  } else if (raw && typeof raw === "object" &&
             (Array.isArray(raw.artists) || CONTENT_KEYS.some((k) => raw[k]))) {
    // Filer UTEN artister godtas også — rene innholdsfiler (sider, varmekart,
    // historier/beskrivelser, podkaster, config).
    data = {
      artists: Array.isArray(raw.artists) ? raw.artists : [],
      decades: raw.decades || {},
      // Nytt nøkkelnavn er «genreDescriptions»; eldre filer bruker «subgenres».
      // Nytt format er nestet pr. nivå — flat ut til { navn: dokument }.
      genreDescriptions: flattenGenreDescriptions(raw.genreDescriptions || raw.subgenres || {}),
      edgeDescriptions: raw.edgeDescriptions || {},
      tech: raw.tech || [],
      pages: raw.pages || {},
      varmekart: raw.varmekart || null,
      podcasts: raw.podcasts || [],
      teacherChecks: raw.teacherChecks || null,
    };
  } else {
    alert("Ugyldig format — filen må være en artist-liste eller et objekt med innhold (artists, pages, varmekart …)."); return;
  }

  // Valider HELE artistlista før noe kan skrives/slettes. Slår feil her ⇒
  // ingenting røres, og «Erstatt alle» kan ikke slette dagens data og så
  // feile på en skjev fil.
  const { ok, errors } = validateArtistsForImport(data.artists);
  if (!ok) { alert(formatImportErrors(errors)); return; }

  // Ikke-blokkerende advarsler: ukjente toppnøkler (feilstavet/nyere format som
  // ellers droppes stille) og sjangre som ikke finnes i slektstreet.
  const warnings = [];
  const unknownKeys = Array.isArray(raw) ? [] : Object.keys(raw).filter((k) => !KNOWN_IMPORT_KEYS.has(k));
  if (unknownKeys.length) warnings.push(`Ukjente felter i fila (blir IKKE importert): ${unknownKeys.join(", ")}.`);
  const unknownGenres = collectUnknownGenres(data.artists);
  if (unknownGenres.length) warnings.push(`Sjangre som ikke finnes i slektstreet (vises ikke i tre-visningene): ${unknownGenres.slice(0, 15).join(", ")}${unknownGenres.length > 15 ? " …" : ""}.`);
  const unknownInstruments = collectUnknownInstruments(data.artists);
  if (unknownInstruments.length) warnings.push(`Instrumenter utenfor vokabularet (splitter filteret/statistikken): ${unknownInstruments.slice(0, 15).join(", ")}${unknownInstruments.length > 15 ? " …" : ""}.`);
  if (warnings.length && !confirm(warnings.join("\n\n") + "\n\nSjekk for skrivefeil. Importere likevel?")) return;

  const parts = importParts(data);
  if (!parts.length) { alert("Fila inneholder ikke noe å importere."); return; }

  // Ren innholdsfil (ingen artister): erstatt/flett-valget gjelder bare
  // artistlista — importer innholdet direkte etter én bekreftelse.
  if (!data.artists.length) {
    if (!confirm(`Importere ${parts.join(", ")}?\n\nEksisterende innhold med samme navn overskrives.`)) return;
    await importDescriptions(data);
    await importTechItems(data.tech);
    await importExtras(data);
    return;
  }

  pendingImportData = data;
  $("#import-choice-desc").textContent = `Filen inneholder ${parts.join(", ")}.`;
  openAdminModal("modal-import-choice");
}

export function setupImportChoice() {
  $("#import-replace").addEventListener("click", async () => {
    closeAdminModal("modal-import-choice");
    if (pendingImportData) {
      // Bare importer beskrivelser/teknologi/innhold hvis selve erstatningen
      // faktisk ble gjennomført (læreren kan ha avbrutt bekreftelsen).
      const didReplace = await handleReplace(pendingImportData.artists);
      if (didReplace) {
        await importDescriptions(pendingImportData);
        await importTechItems(pendingImportData.tech);
        await importExtras(pendingImportData);
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
      await importExtras(pendingImportData);
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

async function importDescriptions({ decades, genreDescriptions, edgeDescriptions }) {
  const decadeEntries = Object.entries(decades || {})
    .filter(([, data]) => hasDecadeContent(data))
    .map(([id, data]) => ({ id, data }));

  const genreEntries = [];
  for (const [id, entry] of Object.entries(genreDescriptions || {})) {
    // Meta-nivået (hovedsjanger-beskrivelse) er pensjonert (v2.99) — dropp det
    // fra gamle backuper, ellers gjenopplives det og purgeMetaGenreDescs måtte
    // slette det på nytt ved neste oppstart.
    let data = entry;
    if (data && data.meta) { const { meta, ...rest } = data; data = rest; }
    // Eldre flat form { description } leses ikke av appen (den leser kun
    // main/sub). Pakk den inn i riktig nivå før lagring. Meta-nivået er
    // pensjonert, så en flat beskrivelse for en hovedsjanger legges på main.
    // `story` er et TOPP-nivå-felt og må løftes ut før innpakkingen — ellers
    // ville den blitt nestet inn i nivåfeltet og blitt usynlig for appen.
    let toSave = data;
    if (data && data.description && !data.main && !data.sub) {
      const { description, story, ...rest } = data;
      const lvl = genreSectionOf(id);
      toSave = { [lvl === "meta" ? "main" : lvl]: { description, ...rest }, ...(story ? { story } : {}) };
    } else if (data && (data.main || data.sub) && (data.description !== undefined || data.kilder !== undefined)) {
      // Har alt et nivåfelt: de flate `description`/`kilder`-feltene er døde og
      // duplisert (kan være stale) — dropp dem så en gammel backup ikke
      // re-lagrer dem.
      const { description: _d, kilder: _k, ...rest } = data;
      toSave = rest;
    }
    if (toSave.description || toSave.main || toSave.sub || toSave.story) {
      genreEntries.push({ id, data: toSave });
    }
  }

  // Koblingsbeskrivelser: nøkkelen ER dokument-ID-en («fra__til»); kun
  // oppføringer med tekst skrives (tomme ville bare skapt spøkelsesdokumenter).
  const edgeEntries = Object.entries(edgeDescriptions || {})
    .filter(([, data]) => data && data.description)
    .map(([id, data]) => ({ id, data }));

  // Batchet skriving (saveDocsBulk) i stedet for dokument-for-dokument.
  // En batch er alt-eller-ingenting, så feiltelling skjer per samling.
  let ok = 0, fail = 0;
  try { ok += await saveDocsBulk("decades", decadeEntries); }
  catch (e) { fail += decadeEntries.length; console.error("Tiår-import feilet:", e); }
  try { ok += await saveDocsBulk("genreDescriptions", genreEntries); }
  catch (e) { fail += genreEntries.length; console.error("Sjanger-import feilet:", e); }
  try { ok += await saveDocsBulk("edgeDescriptions", edgeEntries); }
  catch (e) { fail += edgeEntries.length; console.error("Koblings-import feilet:", e); }

  if (fail > 0) {
    alert(`${fail} beskrivelse(r) kunne ikke lagres.\n\nSannsynlig årsak: Firestore-reglene tillater ikke skriving til 'genreDescriptions', 'edgeDescriptions' eller 'decades'.\n\nGå til Firebase Console → Firestore → Rules og publiser oppdaterte regler.`);
  } else if (ok > 0) {
    alert(`${ok} beskrivelse(r) importert.`);
  }
}

// Innholdssider, varmekart og podkaster fra importfila. Podkaster
// oppdateres på tittel-match (så en re-import ikke dupliserer episoder);
// (Config i gamle backuper ignoreres — vokabularet bor i koden, v3.68.)
async function importExtras({ pages, varmekart, podcasts, teacherChecks }) {
  const done = [];
  const failed = [];

  const pageEntries = Object.entries(pages || {})
    .filter(([id, d]) => id !== "varmekart" && d && typeof d.body === "string" && d.body.trim())
    .map(([id, d]) => ({ id, data: { body: d.body, updatedAt: d.updatedAt || new Date().toISOString() } }));
  if (pageEntries.length) {
    try { await saveDocsBulk("content", pageEntries); done.push(`${pageEntries.length} innholdsside(r)`); }
    catch (e) { console.error("Side-import feilet:", e); failed.push("innholdssidene"); }
  }

  // Varmekartet FLETTES rad for rad (mergeVarmekartRows): sjangre fila ikke
  // nevner, beholder tallene sine. En delvis fil (f.eks. bare den nye sjangeren)
  // er derfor trygg — den skrev tidligere over hele kartet og slettet resten.
  if (varmekart && varmekart.heat && typeof varmekart.heat === "object") {
    try {
      const { written, kept, skipped } = await mergeVarmekartRows(varmekart.heat);
      done.push(`varmekartet (${written.length} sjanger-rad(er) oppdatert, ${kept.length} beholdt)`);
      if (skipped.length) console.warn("Varmekart-import: hoppet over rader som ikke er lister:", skipped);
    }
    catch (e) { console.error("Varmekart-import feilet:", e); failed.push("varmekartet"); }
  }

  if (Array.isArray(podcasts) && podcasts.length) {
    try {
      const byTitle = new Map(state.podcasts.map((p) => [String(p.title || "").trim().toLowerCase(), p]));
      let n = 0;
      for (const ep of podcasts) {
        const title = String(ep?.title || "").trim();
        if (!title) continue;
        const { id: _omit, ...epData } = ep;
        const existing = byTitle.get(title.toLowerCase());
        if (existing) await updatePodcast(existing.id, epData);
        else await addPodcast(epData);
        n++;
      }
      if (n) done.push(`${n} podkastepisode(r)`);
    } catch (e) { console.error("Podkast-import feilet:", e); failed.push("podkastene"); }
  }

  // Lærerens sjekk-fremdrift (merges inn). NB: tech-sjekker refererer doc-ID-er
  // som ikke er stabile på tvers av prosjekter — trygt ved restore til SAMME
  // prosjekt, kan peke feil ved import til et annet.
  if (teacherChecks && typeof teacherChecks === "object") {
    try { await setTeacherChecks(teacherChecks); done.push("sjekk-fremdrift"); }
    catch (e) { console.error("teacherChecks-import feilet:", e); failed.push("sjekk-fremdriften"); }
  }

  if (failed.length) {
    alert(`Kunne ikke importere ${failed.join(", ")}.\n\nSannsynlig årsak: Firestore-reglene er ikke publisert for 'content'-samlingen.\n\nGå til Firebase Console → Firestore → Rules og publiser oppdaterte regler.`);
  } else if (done.length) {
    alert(`Importert: ${done.join(", ")}.`);
  }
}

// Tech kan ikke bulk-skrives generisk: hvert kort må slås opp i state.techItems
// for å avgjøre add-vs-update. Skrivingene går derfor parallelt med
// Promise.allSettled, som beholder feilrapportering per dokument.
async function importTechItems(techArray) {
  if (!techArray || !techArray.length) return;
  const jobs = techArray
    .filter((item) => item.name)
    .map((item) => {
      const existing = state.techItems.find(t => t.name === item.name);
      return {
        name: item.name,
        kind: existing ? "updated" : "added",
        promise: existing ? updateTech(existing.id, item) : addTech(item),
      };
    });
  const results = await Promise.allSettled(jobs.map((j) => j.promise));
  let added = 0, updated = 0, fail = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      jobs[i].kind === "added" ? added++ : updated++;
    } else {
      fail++;
      console.error("Tech-import feilet for", jobs[i].name, r.reason);
    }
  });
  if (fail) alert(`${fail} teknologikort kunne ikke lagres (se konsollen).`);
  if (added || updated) alert(`Teknologi: ${added} nye, ${updated} oppdaterte.`);
}

// Erstatter hele artistsamlingen. Lista er allerede validert i
// handleImportFile, så «slett-så-feil»-scenarioet er umulig her. I tillegg
// lastes en full sikkerhetskopi av dagens data ned FØR slettingen, som et
// ekstra sikkerhetsnett dersom skrivingen skulle feile midtveis.
// Returnerer true hvis erstatningen ble gjennomført, false hvis avbrutt/feilet.
async function handleReplace(data) {
  // Vent på artist-snapshotet: uten det bygges backupen fra en tom state mens
  // deleteAllArtists sletter det som faktisk ligger på serveren.
  if (!state.artistsLoaded) {
    alert("Artistdataene er ikke ferdig lastet ennå. Vent til lista vises før du erstatter — ellers blir sikkerhetskopien tom mens slettingen går mot serveren.");
    return false;
  }
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
    `Åpne endringsforslag på artister overlever ikke — de får nye ID-er.\n` +
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
    // Match mot ALLE statuser, også «pending»: eksporten tar med ventende
    // forslag, så en match kun mot active/removed ville lagt dem inn på nytt som
    // duplikater ved re-import av egen backup.
    const existing = state.artists.find(
      (a) => a.name.trim().toLowerCase() === imp.name.trim().toLowerCase()
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

  // «Fullfør» når det ikke finnes flere KONFLIKT-rader etter denne (køen kan ha
  // konfliktløse autofyll-rader til slutt som aldri vises — da ville en ren
  // posisjonssjekk vist «Neste» på den faktisk siste konflikten).
  const moreConflicts = queue.slice(index + 1).some((it) => it.conflicts.length > 0);
  $("#merge-next").textContent = moreConflicts ? "Neste" : "Fullfør";
}

function fmtVal(v) {
  if (v === null || v === undefined) return "(tom)";
  if (Array.isArray(v)) {
    if (!v.length) return "(tom)";
    // Verk bruker `title`, kilder `text`, musikkeksempler `label` — vis riktig
    // felt i stedet for rå JSON (samme feltprioritet som ui-edit.formatDiffValue).
    return v.map((i) => (typeof i === "object" && i
      ? (i.title || i.label || i.text || i.name || JSON.stringify(i))
      : i)).join(", ");
  }
  return String(v);
}

function collectCurrentChoices() {
  const item = mergeState.queue[mergeState.index];
  item.conflicts.forEach((c) => {
    const radio = document.querySelector(`input[name="cf-${c.field}"]:checked`);
    // Skriv KUN feltet når importert verdi velges. «Behold» skal ikke skrive
    // den eksisterende verdien tilbake (unødvendig Firestore-skriv + feilaktig
    // «oppdatert»-telling). autoFill-felter ligger allerede i resolved og røres
    // ikke her.
    if (radio?.value === "imported") item.resolved[c.field] = c.imported;
    else delete item.resolved[c.field];
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
      // Som collectCurrentChoices: «behold alt» skal ikke skrive eksisterende
      // verdier tilbake — bare importerte valg skrives.
      if (choice === "imported") item.resolved[c.field] = c.imported;
      else delete item.resolved[c.field];
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
