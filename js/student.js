// ============================================================================
//  STUDENTSIDE — foreslå artist, legg til info, se liste, stem
// ============================================================================

import {
  fetchArtists,
  addArtist,
  subscribeContent,
} from "./store.js?v=4.88";
import { loadArtists } from "./artist-cache.js?v=4.88";
import { GENDERS, INSTRUMENTS } from "./limits.js?v=4.88";
import { GENEALOGY_META_GENRES, GENEALOGY_MAIN_GENRES, applyGenealogyDoc, isMainGenre, isGenreModelReady } from "./genre-model.js?v=4.88";
import { fillSelect } from "./ui.js?v=4.88";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=4.88";
import { WORK_SPEC, SOURCE_SPEC, musicSpecWithGenres, addRow, buildRows, collectRows } from "./row-editor.js?v=4.88";
import { setupFormatBars } from "./format-bar.js?v=4.88";

// Musikkeksempel-spec med sjangervelger (alle tre-sjangre, alfabetisk).
// Bygges ved KALL, ikke ved import: sjangertreet kommer fra Firestore (v4.51),
// så vokabularet er tomt de første øyeblikkene. En modulnivå-konstant her ga
// en tom sjangerliste i skjemaet for alltid.
const musicSpecSj = () => musicSpecWithGenres(
  [...GENEALOGY_MAIN_GENRES].sort((a, b) => a.localeCompare(b, "no"))
);

const state = {
  artists: [],
};

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function refreshControls() {
  fillSelect($("#in-metaGenre"), GENEALOGY_META_GENRES, { placeholder: "Velg metasjanger …" });
  fillSelect($("#in-instrument"), INSTRUMENTS, { placeholder: "Velg instrument …" });
  fillSelect($("#in-gender"), GENDERS, { placeholder: "Velg kjønn …" });
}

// ----------------------------------------------------------------------------
//  Skjema
// ----------------------------------------------------------------------------

function setupForm() {
  const form = $("#add-form");
  const msg = $("#form-msg");
  const submitBtn = form.querySelector('button[type="submit"]');

  $("#add-work").addEventListener("click", () => addWorkRow());
  $("#add-me").addEventListener("click", () => addMusicExampleRow());
  $("#add-source").addEventListener("click", () => addSourceRow());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "form-msg";

    const candidate = {
      name: $("#in-name").value.trim(),
      birthYear: parseInt($("#in-birthyear").value, 10) || null,
      deathYear: parseInt($("#in-deathyear").value, 10) || null,
      gender: $("#in-gender").value,
      metaGenre: $("#in-metaGenre").value,
      instrument: $("#in-instrument").value,
      mainGenre: $("#in-mainGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      subGenre: $("#in-subGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#in-start").value, 10) || null,
      influenceEnd: parseInt($("#in-end").value, 10) || null,
      description: $("#in-desc").value.trim(),
      keyWorks: collectWorks(),
      geography: $("#in-geo").value.trim(),
      imageUrl: $("#in-image-url").value.trim(),
      imageCredit: $("#in-image-credit").value.trim(),
      proposedBy: $("#in-by").value.trim() || "Anonym",
      musicExamples: collectMusicExamples(),
      kilder: collectSources(),
    };

    if (!candidate.name || !candidate.metaGenre || !candidate.influenceStart || !candidate.gender || !candidate.instrument) {
      return showMsg(msg, "Fyll inn navn, kjønn, sjanger, instrument og startår for innflytelse.", "error");
    }
    if (!candidate.kilder.length) {
      return showMsg(msg, "Legg til minst én kilde.", "error");
    }

    // Årstall-rekkefølge: hindrer at artisten stille forsvinner fra tiårsfiltre.
    if (candidate.influenceEnd && candidate.influenceStart && candidate.influenceEnd < candidate.influenceStart) {
      return showMsg(msg, "«Innflytelse til»-året kan ikke være før «fra»-året.", "error");
    }
    if (candidate.deathYear && candidate.birthYear && candidate.deathYear < candidate.birthYear) {
      return showMsg(msg, "Dødsår kan ikke være før fødselsår.", "error");
    }

    // Rader med innhold men ugyldig/manglende lenke droppes ellers stille.
    const rowErr = validateExampleRows() || validateSourceRows();
    if (rowErr) return showMsg(msg, rowErr, "error");

    // Sjangre valideres mot slektstreet — samme advarsel (ikke blokkering) som
    // lærerens redigeringsskjema: en skrivefeil («Bluess») forsvinner ellers
    // stille fra tre-visningene og dukker opp som falsk undersjanger hos
    // læreren. Kun når treet faktisk er lastet, ellers flagges alt.
    if (isGenreModelReady()) {
      const ukjente = candidate.mainGenre.filter((g) => !isMainGenre(g));
      if (ukjente.length) {
        const ok = confirm(
          `Disse sjangrene finnes ikke i slektstreet: ${ukjente.join(", ")}.\n\n` +
          "Sjekk for skrivefeil (feltet Sjanger skal bruke navnene fra treet). " +
          "Send likevel?"
        );
        if (!ok) return showMsg(msg, "Ikke sendt. Rett sjangernavnene og prøv igjen.", "error");
      }
    }

    if (!CONFIGURED) {
      return showMsg(
        msg,
        "Firebase er ikke satt opp ennå (se README.md). Skjemaet validerer, men lagrer ikke ennå.",
        "error"
      );
    }

    // Myk duplikatsjekk — navnekollisjoner kan være legitime, så vi lar
    // studenten sende inn likevel etter en bekreftelse.
    await ensureArtists();
    const dup = findDuplicate(candidate.name);
    if (dup && !confirm(`«${candidate.name}» ser ut til å finnes fra før${dup.status === "pending" ? " (venter på godkjenning)" : ""}. Sende inn likevel?`)) {
      return;
    }

    submitBtn.disabled = true;
    const origText = submitBtn.textContent;
    submitBtn.textContent = "Sender …";
    try {
      await addArtist(candidate);
      form.reset();
      resetWorkRows();
      resetMusicExampleRows();
      resetSourceRows();
      showMsg(msg, `«${candidate.name}» er sendt inn og venter på godkjenning fra lærer`, "ok");
    } catch (err) {
      showMsg(msg, "Noe gikk galt: " + err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}

// http/https-sjekk (samme regel som safeUrl bruker ved lagring).
function isHttpUrl(u) {
  return /^https?:\/\//i.test((u || "").trim());
}

// En musikkeksempel-rad med tittel men uten gyldig lenke ville blitt droppet
// stille av normaliseringen — flagg den i stedet.
function validateExampleRows() {
  for (const r of document.querySelectorAll("#me-rows .me-row")) {
    const label = r.querySelector(".me-label").value.trim();
    const url = r.querySelector(".me-url").value.trim();
    if (!label && !url) continue;
    if (!isHttpUrl(url)) {
      return `Musikkeksempelet ${label ? `«${label}»` : "(uten tittel)"} mangler en gyldig lenke (må starte med https://).`;
    }
  }
  return null;
}

// En kilde-rad med lenke men uten tekst ville blitt droppet (teksten er det
// som lagres); en ugyldig lenke ville blitt fjernet stille.
function validateSourceRows() {
  for (const r of document.querySelectorAll("#source-rows .source-row")) {
    const text = r.querySelector(".source-text").value.trim();
    const url = r.querySelector(".source-url").value.trim();
    if (!text && !url) continue;
    if (!text) return "En kilde har en lenke, men mangler tekst. Skriv inn kildehenvisningen.";
    if (url && !isHttpUrl(url)) return `Kilden «${text}» har en ugyldig lenke (må starte med https://). Fjern eller rett lenken.`;
  }
  return null;
}

// Artistlista til duplikatsjekken. Hentes fra den delte localStorage-cachen
// forsiden fyller (studenten kommer alltid hit via en lenke derfra), og kun
// ved direkte-besøk med tom cache gjøres én engangs-henting. Siden abonnerte
// før på HELE artistsamlingen i sanntid utelukkende for dette oppslaget.
// Feiler hentingen, står lista tom: duplikatsjekken er en myk advarsel, og et
// duplikat fanges uansett av læreren i godkjenningskøen.
async function ensureArtists() {
  if (state.artists.length) return;
  state.artists = loadArtists();
  if (state.artists.length) return;
  try {
    state.artists = await fetchArtists();
  } catch (err) {
    console.warn("Kunne ikke hente artistlista til duplikatsjekk:", err?.message || err);
  }
}

// Case-insensitiv navnematch mot eksisterende (ikke-fjernede) forslag.
function findDuplicate(name) {
  const n = (name || "").trim().toLowerCase();
  return state.artists.find((a) => a.status !== "removed" && (a.name || "").trim().toLowerCase() === n);
}

// Rad-editorene (verk/musikkeksempler/kilder) bor nå i den delte row-editor.js
// (spec-drevet, med escaping). Disse er tynne innpakninger mot skjemaets wrap-er.
function addMusicExampleRow(v) { return addRow($("#me-rows"), musicSpecSj(), v || {}); }
function resetMusicExampleRows() { buildRows($("#me-rows"), musicSpecSj()); }
function collectMusicExamples() { return collectRows($("#me-rows"), musicSpecSj()); }

function addWorkRow(v) { return addRow($("#work-rows"), WORK_SPEC, v || {}); }
function resetWorkRows() { buildRows($("#work-rows"), WORK_SPEC); }
function collectWorks() { return collectRows($("#work-rows"), WORK_SPEC); }

function addSourceRow(v) { return addRow($("#source-rows"), SOURCE_SPEC, v || {}); }
function resetSourceRows() { buildRows($("#source-rows"), SOURCE_SPEC); }
function collectSources() { return collectRows($("#source-rows"), SOURCE_SPEC); }

// ----------------------------------------------------------------------------
//  Hjelpere + oppstart
// ----------------------------------------------------------------------------

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = "form-msg " + type;
}

function init() {
  setupForm();
  setupFormatBars();
  resetWorkRows();
  resetMusicExampleRows();
  resetSourceRows();

  if (!CONFIGURED) {
    refreshControls();
    showSetupBanner("Du kan likevel se hvordan skjemaet ser ut.");
    return;
  }

  wireFirestoreErrorBanner();
  refreshControls();
  // Artistlista hentes først ved innsending (ensureArtists) — siden viser
  // ingen artister, så et sanntidsabonnement her var ren kostnad.
  //
  // Sjangertreet MÅ derimot hentes: metasjanger-velgeren og sjangervalget i
  // musikkeksemplene kommer fra det, og fra v4.51 bor det i Firestore. Uten
  // dette sto skjemaet med tomme nedtrekk. content er ett lite dokumentsett.
  subscribeContent((c) => {
    applyGenealogyDoc(c?.genealogy);
    refreshControls();
    // Bygg musikkeksempel-radene på nytt KUN når de er urørte. Snapshotet
    // fyrer ved enhver endring i content-samlingen (varmekartceller,
    // innholdssider, referanser) — en ubetinget rebuild slettet alt studenten
    // hadde skrevet i radene, midt i utfyllingen. Hensikten her er bare å
    // fylle sjangervelgeren når treet lander, og da er radene tomme.
    // (Sjekker rå inputverdier, ikke collectRows: den dropper rader uten URL,
    // og en halvskrevet rad skal også overleve.)
    const harInnhold = [...($("#me-rows")?.querySelectorAll("input, select") || [])]
      .some((el) => String(el.value || "").trim());
    if (!harInnhold) resetMusicExampleRows();
  });
}

// Vent på klassepassordet (js/gate.js); uten gate.js er __pensumGate undefined
// og init() kjører umiddelbart som før (sperren feiler åpent).
Promise.resolve(window.__pensumGate?.klar).then(init);
