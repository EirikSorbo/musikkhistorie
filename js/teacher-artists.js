// ============================================================================
//  LÆRER — ARTISTER
// ----------------------------------------------------------------------------
//  Detalj-/sjekk-visning, rediger-artist-skjema, filtre og oversikt/dashboard.
// ============================================================================

import { state, ctx, openAdminModal, lukkEtter, renderList, toggleTeacherView, guardTeacherAction, setContentCheck } from "./teacher-state.js?v=5.68";
import { updateArtistFields, setTeacherChecks } from "./store.js?v=5.68";
import { renderArtistDetail, renderDashboard, fillSelect, modalOpen, modalClose, artistsInGenre, openArtistListModal, openArtistsPlaylistModal, countPlaylistExamples, countArtistExamples } from "./ui.js?v=5.68";
import { isMainGenre, edgeKey, GENEALOGY_META_GENRES, GENEALOGY_MAIN_GENRES } from "./genre-model.js?v=5.68";
import { openSingleSubgenreModal, openSingleEdgeModal, openPageEditor } from "./teacher-content.js?v=5.68";
import { checkBtnHtml, setCheckBtn, toggleCheckBtn, fyllPunktfelt, lesPunktfelt } from "./ui-helpers.js?v=5.68";
import { GENDERS, INSTRUMENTS, isVisible } from "./limits.js?v=5.68";
import { debounce } from "./util.js?v=5.68";
import { $ } from "./shared.js?v=5.68";
import { WORK_SPEC, SOURCE_SPEC, musicSpecWithGenres, addRow, buildRows, collectRows } from "./row-editor.js?v=5.68";
import { setupGenrePicker, fillGenrePicker, buildGenrePicker, collectGenrePicker } from "./genre-picker.js?v=5.68";

// Musikkeksempel-spec med sjangervelger (alle tre-sjangre, alfabetisk).
// Bygges ved KALL, ikke ved import: treet kommer asynkront fra Firestore
// (v4.51), så en modulnivå-konstant her frøs vokabularet til import-
// øyeblikket — tom liste ved kald start, og en sjanger læreren la til i
// tre-editoren dukket aldri opp før sidelast. Samme felle som student.js
// og genre-model-headeren beskriver.
const sorterteSjangre = () => [...GENEALOGY_MAIN_GENRES].sort((a, b) => a.localeCompare(b, "no"));
const musicSpecSj = () => musicSpecWithGenres(sorterteSjangre());

// ----------------------------------------------------------------------------
//  Detalj / sjekk / oversikt
// ----------------------------------------------------------------------------

export function openDetail(artist) {
  const modal = document.getElementById("modal-detail");
  document.getElementById("detail-name").textContent = artist.name;
  renderArtistDetail(document.getElementById("detail-body"), artist, ctx.explore.buildLinkCtx());
  // «Vis i tidslinje» → fokus-API-et (samme som studentsiden). Vises for ALLE
  // artister (bevisst valg i v3.69); for artister uten startår åpner den
  // tidslinjen uten fokus-blokk.
  const tlBtn = document.getElementById("detail-tidslinje");
  if (tlBtn) tlBtn.onclick = () => ctx.explore.openTidslinje({ artistId: artist.id });
  const editBtn = document.getElementById("detail-edit-btn");
  editBtn.onclick = () => { modalClose(modal); openEditModal(artist.id); };
  const checkBtn = document.getElementById("detail-check-btn");
  setCheckBtn(checkBtn, artist.teacherChecked === true);
  checkBtn.onclick = () => {
    // Les FERSK tilstand fra state — closure-objektet `artist` oppdateres ikke
    // av sanntidslytteren, så uten dette kunne knappen ikke slås av igjen.
    const cur = state.artists.find((x) => x.id === artist.id) || artist;
    const next = !(cur.teacherChecked === true);
    guardTeacherAction(updateArtistFields(artist.id, { teacherChecked: next }));
    setCheckBtn(checkBtn, next);
  };
  // «Kopier lenke», kjøreplan-menyen, plussknappen og opptaket (v5.22–v5.27)
  // krever et mål på kortet, som på forsiden (audit v5.42 funn 17). Bare for
  // artister studentene ser: et ventende forslag skal ikke bli en lenke eller
  // et stopp. Fjernes ellers, så kortet ikke arver forrige artists mål.
  if (isVisible(artist)) modal.dataset.vis = `artist:${artist.id}`;
  else delete modal.dataset.vis;
  modalOpen(modal);
}

export function addMainGenreCheckToggle(genre) {
  const body = document.getElementById("sj-body");
  if (!body) return;
  const field = isMainGenre(genre) ? "genres" : "subgenres";
  const list = state.teacherChecks[field] || [];
  const checked = list.includes(genre);
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:12px";
  wrap.innerHTML = checkBtnHtml(checked);
  body.appendChild(wrap);
  const btn = wrap.querySelector("button");
  btn.addEventListener("click", async () => {
    const now = toggleCheckBtn(btn);
    const cur = new Set(state.teacherChecks[field] || []);
    now ? cur.add(genre) : cur.delete(genre);
    // Knappen settes optimistisk (modalen tegnes ikke av snapshotet). Feiler
    // skrivingen, sto den likevel som avhaket — læreren trodde den var lagret.
    try {
      await setTeacherChecks({ [field]: [...cur] });
    } catch (err) {
      console.error("Kunne ikke lagre avhukingen:", err);
      toggleCheckBtn(btn);
      alert("Avhukingen ble ikke lagret (" + (err?.message || err) + "). Prøv igjen.");
    }
  });
}

export function openOversikt() {
  renderDashboard($("#oversikt-body"), {
    ...state,
    explore: ctx.explore,
    // Samme telling som artistlista bak sjanger-popupen (meta/main/sub-match),
    // så tallet i oversikten og lista brukeren klikker seg til stemmer overens.
    countForGenre: (label) => artistsInGenre(state.artists, label).length,
    // Parentestallet i sjangerlista: lytteeksempler i sjangerens spilleliste
    // (samme telling som spilleliste-popupen).
    exampleCountForGenre: (label) => countPlaylistExamples(state.artists, label),
    onEditArtist: (id) => openEditModal(id),
    onEditDesc: (name, level) => openSingleSubgenreModal(name, level),
    onEditPage: (id) => openPageEditor(id),
    onEditEdge: (fromId, toId) => openSingleEdgeModal(fromId, toId),
    onEdgeCheck: (fromId, toId, on) => setContentCheck("edges", edgeKey(fromId, toId), on),
    onShowArtistList: (title, list) => openArtistListModal(title, list, openDetail, "Ingen artister her ennå."),
    // Metasjangerens lytteeksempler: samme bygger som popupen, så tallet i
    // kolonnen og antallet i lista alltid er det samme.
    countExamplesFor: (list) => countArtistExamples(list),
    onShowPlaylist: (title, list) => openArtistsPlaylistModal(title, list),
  });
  openAdminModal("modal-oversikt");
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

export function setupFilters() {
  $("#f-sjanger").addEventListener("change", (e) => { state.filters.mainGenre = e.target.value; renderList(); });
  $("#f-genre").addEventListener("change", (e) => { state.filters.metaGenre = e.target.value; renderList(); });
  $("#f-decade").addEventListener("change", (e) => { state.filters.decade = e.target.value; renderList(); });
  $("#f-instrument").addEventListener("change", (e) => { state.filters.instrument = e.target.value; renderList(); });
  $("#f-subgenre").addEventListener("change", (e) => { state.filters.subgenre = e.target.value; renderList(); });
  const searchRender = debounce(renderList, 200);
  $("#f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; searchRender(); });
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
  const viewToggle = $("#t-view-toggle");
  if (viewToggle) viewToggle.addEventListener("click", toggleTeacherView);
}

// ----------------------------------------------------------------------------
//  Rediger artist
// ----------------------------------------------------------------------------

// Fyller en select og setter en lagret verdi, med vern for verdier utenfor
// vokabularet (audit-funn 19; metasjangeren fikk grepet i v5.11, kjønn og
// instrument manglet det): en verdi som ikke finnes som <option> (instrument
// etter et navnebytte i INSTRUMENTS, kjønn lagret som etikett i en gammel
// import) ga tom select, og et «Lagre» uten å røre feltet TØMTE feltet
// stille. Verdien beholdes i stedet, merket som ukjent.
function settSelectMedVern(sel, vokabular, verdi, placeholder, ukjentTekst = "finnes ikke i vokabularet") {
  fillSelect(sel, vokabular, { placeholder });
  const lagret = verdi || "";
  if (lagret && !vokabular.some((v) => (typeof v === "object" ? v.value : v) === lagret)) {
    const o = document.createElement("option");
    o.value = lagret;
    o.textContent = `${lagret} (${ukjentTekst})`;
    sel.appendChild(o);
  }
  sel.value = lagret;
}

export function openEditModal(artistId) {
  const a = state.artists.find((x) => x.id === artistId);
  if (!a) return;

  $("#ed-id").value = a.id;
  $("#ed-name").value = a.name || "";
  $("#ed-birthyear").value = a.birthYear || "";
  $("#ed-deathyear").value = a.deathYear || "";
  $("#ed-geo").value = a.geography || "";
  $("#ed-start").value = a.influenceStart || "";
  $("#ed-end").value = a.influenceEnd || "";
  $("#ed-recordLabel").value = a.recordLabel || "";
  $("#ed-subGenre").value = (a.subGenre || []).join(", ");
  $("#ed-desc").value = a.description || "";
  fyllPunktfelt($("#ed-punkter"), a.punkter);
  $("#ed-by").value = a.proposedBy || "";
  $("#ed-image-url").value = a.imageUrl || "";
  $("#ed-image-credit").value = a.imageCredit || "";

  settSelectMedVern($("#ed-gender"), GENDERS, a.gender, "Velg kjønn …");
  settSelectMedVern($("#ed-metaGenre"), GENEALOGY_META_GENRES, a.metaGenre,
    "Velg metasjanger …", "finnes ikke i treet");
  settSelectMedVern($("#ed-instrument"), INSTRUMENTS, a.instrument, "Ingen / ukjent");
  // Sjangervelgeren: vokabularet FØRST, så artistens egne sjangre — da vet
  // velgeren hvilke brikker som ikke lenger finnes i treet, og kan merke dem
  // i stedet for å droppe dem stille.
  setupGenrePicker($("#ed-mainGenre"));
  fillGenrePicker($("#ed-mainGenre"), sorterteSjangre());
  buildGenrePicker($("#ed-mainGenre"), a.mainGenre || []);

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

// Rad-editorene bor nå i den delte row-editor.js (spec-drevet, med escaping).
// Disse er tynne innpakninger mot rediger-modalens wrap-er.
function buildEditMusicExampleRows(examples) { buildRows($("#ed-me-rows"), musicSpecSj(), examples); }
function addEditMusicExampleRow(v) { addRow($("#ed-me-rows"), musicSpecSj(), v || {}); }
function collectEditMusicExamples() { return collectRows($("#ed-me-rows"), musicSpecSj()); }

function buildEditSourceRows(kilder) { buildRows($("#ed-source-rows"), SOURCE_SPEC, kilder); }
function addEditSourceRow(v) { addRow($("#ed-source-rows"), SOURCE_SPEC, v || {}); }
function collectEditSources() { return collectRows($("#ed-source-rows"), SOURCE_SPEC); }

function buildEditWorkRows(works) { buildRows($("#ed-work-rows"), WORK_SPEC, works); }
function addEditWorkRow(v) { addRow($("#ed-work-rows"), WORK_SPEC, v || {}); }
function collectEditWorks() { return collectRows($("#ed-work-rows"), WORK_SPEC); }

export function setupEditForm() {
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
      mainGenre:     collectGenrePicker($("#ed-mainGenre")),
      subGenre:      $("#ed-subGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#ed-start").value, 10) || null,
      influenceEnd:   parseInt($("#ed-end").value, 10) || null,
      recordLabel:   $("#ed-recordLabel").value.trim(),
      geography:     $("#ed-geo").value.trim(),
      description:   $("#ed-desc").value.trim(),
      punkter:       lesPunktfelt($("#ed-punkter")),
      keyWorks:      collectEditWorks(),
      musicExamples: collectEditMusicExamples(),
      kilder:        collectEditSources(),
      imageUrl:      $("#ed-image-url").value.trim(),
      imageCredit:   $("#ed-image-credit").value.trim(),
      proposedBy:    $("#ed-by").value.trim() || "Anonym",
    };
    // Sjangre er «single source of truth» fra slektstreet. Fra v4.95 VELGES de
    // fra treet, så nye avvik kan ikke skrives inn — men gammel data kan bære
    // navn som senere er fjernet fra treet, og de forsvinner stille fra tre-
    // visningene. Advar (ikke blokker) før lagring, som før.
    const unknownGenres = fields.mainGenre.filter((g) => !isMainGenre(g));
    if (unknownGenres.length) {
      const ok = confirm(
        `Disse sjangrene finnes ikke i slektstreet: ${unknownGenres.join(", ")}.\n\n` +
        "De vil ikke vises i tre-visningene og kan bli behandlet som undersjangre. " +
        "Sjekk for skrivefeil. Lagre likevel?"
      );
      if (!ok) {
        msg.textContent = "Avbrutt. Ingen endringer lagret.";
        msg.className = "form-msg";
        return;
      }
    }
    try {
      await updateArtistFields(id, fields);
      msg.textContent = "Lagret ✓";
      msg.className = "form-msg ok";
      lukkEtter("modal-edit", 1000);
    } catch (err) {
      msg.textContent = "Feil: " + err.message;
      msg.className = "form-msg error";
    }
  });
}

// La handlers.edit (i teacher-state) nå rediger-modalen uten import-syklus.
ctx.openEditModal = openEditModal;
// La den kompakte listas rader (renderList → onSelect) åpne detaljmodalen.
ctx.openArtistDetail = openDetail;
