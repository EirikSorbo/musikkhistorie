// ============================================================================
//  LÆRER — ARTISTER
// ----------------------------------------------------------------------------
//  Detalj-/sjekk-visning, rediger og ny artist (det felles femstegs-skjemaet,
//  js/ui/artist-skjema.js), filtre og oversikt/dashboard.
// ============================================================================

import { aktivtNivaa, settNivaa, vedNivaaEndring } from "../ui/viktighet.js";
import { state, ctx, openAdminModal, renderList, settTeacherView, guardTeacherAction, setContentCheck } from "./teacher-state.js";
import { updateArtistFields, setTeacherChecks, addArtistAktiv } from "../data/store.js";
import { renderArtistDetail, openArtistListModal, openArtistsPlaylistModal, countPlaylistExamples, countArtistExamples } from "../ui/ui.js";
import { renderDashboard, oppdaterPlateselskapSeksjon } from "../ui/ui-dashboard.js";
import { isMainGenre, edgeKey } from "../sjangre/genre-model.js";
import { openSingleSubgenreModal, openSingleEdgeModal, openPageEditor } from "./teacher-content.js";
import { checkBtnHtml, setCheckBtn, toggleCheckBtn } from "../ui/ui-helpers.js";
import { isVisible, artistsInGenre } from "../felles/limits.js";
import { debounce } from "../felles/util.js";
import { $ } from "../data/shared.js";
import { apneArtistSkjema } from "../ui/artist-skjema.js";
import { melding, bekreft, modalOpen, modalClose } from "../ui/ui-modal.js";

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
      melding("Avhukingen ble ikke lagret (" + (err?.message || err) + "). Prøv igjen.");
    }
  });
}

// Oversikt og Mangler (v6.66) tegnes sammen: tallene kommer fra samme
// gjennomgang, og nøkkeltallet «Sjangerkoblinger» i Oversikt åpner lista i Mangler.
function tegnOversiktOgMangler() {
  renderDashboard($("#oversikt-body"), {
    ...state,
    manglerEl: $("#mangler-body"),
    onOpenMangler: () => openAdminModal("modal-mangler"),
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
    onPlateselskapCheck: (id, on) => setContentCheck("plateselskaper", id, on),
    onShowArtistList: (title, list) => openArtistListModal(title, list, openDetail, "Ingen artister her ennå."),
    // Metasjangerens lytteeksempler: samme bygger som popupen, så tallet i
    // kolonnen og antallet i lista alltid er det samme.
    countExamplesFor: (list) => countArtistExamples(list),
    onShowPlaylist: (title, list) => openArtistsPlaylistModal(title, list),
  });
}

export function openOversikt() {
  tegnOversiktOgMangler();
  openAdminModal("modal-oversikt");
}

// «Mangler» (v6.66, brukerønske 2026-10-09): innholdet som ikke er skrevet
// ennå, og plateselskapene, i et eget vindu fra Innhold-flisa.
export function openMangler() {
  tegnOversiktOgMangler();
  openAdminModal("modal-mangler");
}

// Plateselskap-seksjonen i et ÅPENT Mangler-vindu (v6.37, flyttet v6.66): tegnes på nytt når
// innholdet, artistene eller avhukingen endres, så status og telling følger
// lagringen. Bare seksjonen, så utfoldede lister ellers i Oversikten blir
// stående. No-op når Oversikten er lukket.
export function oppdaterOversiktPlateselskaper() {
  if (!document.getElementById("modal-mangler")?.classList.contains("open")) return;
  oppdaterPlateselskapSeksjon($("#mangler-body"), state);
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
  // Viktigst, viktig og mindre viktig setter det felles viktighetsnivået
  // (v6.85, js/ui/viktighet.js), som spillelistene og merket i toppfeltet også
  // følger. «Skjult» (-1) er bare et filter i lærerlista.
  document.querySelectorAll("#t-prio-bar .prio-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.prio, 10);
      if (p === -1) {
        if (state.filters.priority !== -1 && aktivtNivaa()) settNivaa(0);
        state.filters.priority = state.filters.priority === -1 ? 0 : -1;
        updatePrioButtons();
        renderList();
        return;
      }
      settNivaa(aktivtNivaa() === p ? 0 : p);
    });
  });
  if (state.filters.priority !== -1) state.filters.priority = aktivtNivaa();
  updatePrioButtons();
  vedNivaaEndring((n) => {
    if (state.filters.priority === -1 && !n) return;   // «Skjult» står
    state.filters.priority = n;
    updatePrioButtons();
    renderList();
  });
  const showRemoved = $("#f-show-removed");
  showRemoved.checked = state.filters.showRemoved;
  showRemoved.addEventListener("change", (e) => { state.filters.showRemoved = e.target.checked; renderList(); });
  const hideChecked = $("#f-hide-checked");
  hideChecked.checked = state.filters.hideChecked;
  hideChecked.addEventListener("change", (e) => { state.filters.hideChecked = e.target.checked; renderList(); });
  // Visningsvelgeren (Galleri, Liste, Kort), som i studentenes artistsøk.
  $("#t-view-toggle")?.addEventListener("click", (e) => {
    const valg = e.target.closest("[data-treffvisning]")?.dataset.treffvisning;
    if (valg) settTeacherView(valg);
  });
}

// ----------------------------------------------------------------------------
//  Rediger artist og ny artist (v6.96): det felles femstegs-skjemaet
// ----------------------------------------------------------------------------
//  Brukervalg 2026-10-13: samme skjema som studentene (js/ui/artist-skjema.js),
//  i et vindu på lærersiden. «Ny artist» lagres direkte som aktiv. Feltene
//  skjemaet ikke har (sentrale verk, som fases ut), blir ikke skrevet, så
//  verkene på artistene står.

// Lærerens felt fra skjemaet. «Foreslått av» faller tilbake på «Anonym» ved
// redigering, som før, og på «Lærer» for en ny artist.
function laererFelt(v, standardNavn) {
  const { studentComment, ...felt } = v;
  return { ...felt, proposedBy: felt.proposedBy || standardNavn };
}

// Sjangre er «single source of truth» fra slektstreet. De VELGES fra treet, så
// nye avvik kan ikke skrives inn, men gammel data kan bære navn som senere er
// fjernet. Advar (ikke blokker) før lagring, som før.
async function godtaUkjenteSjangre(mainGenre) {
  const ukjente = (mainGenre || []).filter((g) => !isMainGenre(g));
  if (!ukjente.length) return true;
  return bekreft(
    `Disse sjangrene finnes ikke i slektstreet: ${ukjente.join(", ")}.\n\n` +
    "De vil ikke vises i tre-visningene og kan bli behandlet som undersjangre. " +
    "Sjekk for skrivefeil. Lagre likevel?",
    { ja: "Lagre likevel" }
  );
}

export function openEditModal(artistId) {
  const a = state.artists.find((x) => x.id === artistId);
  if (!a) return;
  const api = apneArtistSkjema({
    modus: "laerer",
    tittel: `Rediger: ${a.name || "artist"}`,
    verdier: a,
    sendTekst: "Lagre",
    onSend: async (v, api) => {
      const felt = laererFelt(v, "Anonym");
      if (!(await godtaUkjenteSjangre(felt.mainGenre))) return { tekst: "Avbrutt. Ingen endringer lagret.", type: "" };
      await updateArtistFields(a.id, felt);
      api.lukkSnart();
      return { tekst: "Lagret ✓" };
    },
  });
  const pending = state.pendingEdits.find((p) => p.entityType === "artist" && p.entityId === a.id);
  if (pending) {
    api.melding(`Obs: Det finnes et åpent endringsforslag for ${a.name} fra ${pending.proposedBy || "Anonym"}. Behandle det først via «Endringsforslag».`, "warn");
  }
}

// «Ny artist» på lærersiden, også fra «Foreslå» under «Navn fra timen» og
// «Legg til artist» i Instrumenter. Utkastet lagres i nettleseren (egen nøkkel,
// ikke studentenes), så et lukket vindu ikke mister noe.
const UTKAST_LAERER = "pensum-artistutkast:laerer";
export function openNyArtist(navn = "") {
  const api = apneArtistSkjema({
    modus: "laerer-ny",
    tittel: "Ny artist",
    utkastNokkel: UTKAST_LAERER,
    sendTekst: "Legg til artist",
    finnDuplikat: async (n) => {
      const x = String(n || "").trim().toLowerCase();
      return state.artists.find((a) => a.status !== "removed" && (a.name || "").trim().toLowerCase() === x) || null;
    },
    onSend: async (v, api) => {
      const felt = laererFelt(v, "Lærer");
      if (!(await godtaUkjenteSjangre(felt.mainGenre))) return { tekst: "Avbrutt. Ingenting lagret.", type: "" };
      await addArtistAktiv(felt);
      api.slettUtkast();
      api.lukkSnart();
      return { tekst: `«${felt.name}» er lagt til ✓`, laas: true };
    },
    onUtkastTom: async (api) => {
      if (!(await bekreft("Tømme skjemaet og slette utkastet?", { ja: "Tøm skjemaet", farlig: true }))) return;
      api.slettUtkast();
      api.tom();
      api.melding("");
      api.visSteg(0);
    },
  });
  // Et nytt skjema med utkast lukkes uten spørsmål: utkastet står.
  document.getElementById("modal-artist-skjema")._beforeClose = null;
  const u = api.hentUtkast();
  const utkastNavn = String(u?.verdier?.name || "").trim().toLowerCase();
  if (u && (!navn || utkastNavn === String(navn).trim().toLowerCase())) {
    api.leggInnUtkast(u);
    api.visUtkastLinje("Skjemaet er fylt inn med utkastet du ikke lagret.", "Tøm skjemaet");
  } else if (navn) {
    api.fyll({ name: String(navn).trim() });
  }
}

// La handlers.edit (i teacher-state) nå rediger-modalen uten import-syklus.
ctx.openEditModal = openEditModal;
ctx.openNyArtist = openNyArtist;
// La den kompakte listas rader (renderList → onSelect) åpne detaljmodalen.
ctx.openArtistDetail = openDetail;
