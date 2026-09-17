// ============================================================================
//  STUDENTSIDE — foreslå artist, legg til info, se liste, stem
// ============================================================================

import {
  fetchArtists,
  addArtist,
  fetchArtist,
  resubmitArtist,
  subscribeContent,
} from "./store.js?v=5.29";
import { loadArtists } from "./artist-cache.js?v=5.29";
import { GENDERS, INSTRUMENTS } from "./limits.js?v=5.29";
import { GENEALOGY_META_GENRES, GENEALOGY_MAIN_GENRES, applyGenealogyDoc } from "./genre-model.js?v=5.29";
import { fillSelect, escapeHtml } from "./ui.js?v=5.29";
import { renderRichText } from "./rich-text.js?v=5.29";
import { pageFor } from "./story-format.js?v=5.29";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=5.29";
import { WORK_SPEC, SOURCE_SPEC, musicSpecWithGenres, addRow, buildRows, collectRows } from "./row-editor.js?v=5.29";
import { setupFormatBars } from "./format-bar.js?v=5.29";
import { setupGenrePicker, fillGenrePicker, buildGenrePicker, collectGenrePicker } from "./genre-picker.js?v=5.29";

// Musikkeksempel-spec med sjangervelger (alle tre-sjangre, alfabetisk).
// Bygges ved KALL, ikke ved import: sjangertreet kommer fra Firestore (v4.51),
// så vokabularet er tomt de første øyeblikkene. En modulnivå-konstant her ga
// en tom sjangerliste i skjemaet for alltid.
const sorterteSjangre = () => [...GENEALOGY_MAIN_GENRES].sort((a, b) => a.localeCompare(b, "no"));
const musicSpecSj = () => musicSpecWithGenres(sorterteSjangre());

const state = {
  artists: [],
};

// Returflyt (v5.13): åpnes siden med ?retur=<id>, er dette en NY INNSENDING av
// et returnert forslag — samme skjema, prefylt, og lagringen går til samme
// dokument med koden som bevis (fetchArtist leverer returKode sammen med
// resten; koden i seg selv er ikke hemmelig, hele basen er lesbar — den er
// reglenes bevis på at klienten faktisk har LEST returen den skriver over).
const returState = { aktiv: false, id: null, kode: "" };

// Sjangervokabularet (metasjanger-nedtrekket + sjangervelgeren) kommer
// asynkront fra Firestore. Prefyllingen må vente på det: å sette et select-
// felt uten options gir tom verdi. Løses i subscribeContent-callbacken;
// racer mot en tidsfrist så en feilet content-lasting ikke henger siden.
let vokabKlarResolve;
const vokabKlar = new Promise((r) => { vokabKlarResolve = r; });
const vokabEllerFrist = () => Promise.race([vokabKlar, new Promise((r) => setTimeout(r, 5000))]);

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function refreshControls() {
  fillSelect($("#in-metaGenre"), GENEALOGY_META_GENRES, { placeholder: "Velg metasjanger …" });
  fillSelect($("#in-instrument"), INSTRUMENTS, { placeholder: "Velg instrument …" });
  fillSelect($("#in-gender"), GENDERS, { placeholder: "Velg kjønn …" });
  // Sjangrene kommer fra samme tre som metasjangrene — kun vokabularet
  // fylles her, studentens valgte brikker står urørt.
  fillGenrePicker($("#in-mainGenre"), sorterteSjangre());
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
      mainGenre: collectGenrePicker($("#in-mainGenre")),
      subGenre: $("#in-subGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#in-start").value, 10) || null,
      influenceEnd: parseInt($("#in-end").value, 10) || null,
      description: $("#in-desc").value.trim(),
      keyWorks: collectWorks(),
      geography: $("#in-geo").value.trim(),
      imageUrl: $("#in-image-url").value.trim(),
      imageCredit: $("#in-image-credit").value.trim(),
      proposedBy: $("#in-by").value.trim(),
      musicExamples: collectMusicExamples(),
      kilder: collectSources(),
    };

    if (!candidate.name || !candidate.metaGenre || !candidate.influenceStart || !candidate.gender || !candidate.instrument) {
      return showMsg(msg, "Fyll inn navn, kjønn, sjanger, instrument og startår for innflytelse.", "error");
    }
    if (!candidate.kilder.length) {
      return showMsg(msg, "Legg til minst én kilde.", "error");
    }
    // Navnet er PÅKREVD (brukervalg 2026-09-02): læreren skal kunne gå i dialog
    // med den som foreslår. Feltet står nederst i et langt skjema, så vi flytter
    // fokus dit — ellers leter studenten etter hva som mangler.
    if (!candidate.proposedBy) {
      $("#in-by").focus();
      return showMsg(msg, "Skriv fornavnet ditt nederst, så læreren vet hvem forslaget kommer fra.", "error");
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

    // Sjangrene trenger ingen skrivefeil-advarsel lenger: de VELGES fra
    // slektstreet (js/genre-picker.js), så et navn utenfor treet kan ikke
    // oppstå her. Lærerens skjema har fortsatt advarselen — der kan gammel
    // data bære navn som er borte fra treet.

    if (!CONFIGURED) {
      return showMsg(
        msg,
        "Firebase er ikke satt opp ennå (se README.md). Skjemaet validerer, men lagrer ikke ennå.",
        "error"
      );
    }

    // Myk duplikatsjekk — navnekollisjoner kan være legitime, så vi lar
    // studenten sende inn likevel etter en bekreftelse. Ved retur er
    // «duplikatet» studentens eget forslag, så sjekken hoppes over.
    if (!returState.aktiv) {
      await ensureArtists();
      const dup = findDuplicate(candidate.name);
      if (dup && !confirm(`«${candidate.name}» ser ut til å finnes fra før${dup.status === "pending" ? " (venter på godkjenning)" : ""}. Sende inn likevel?`)) {
        return;
      }
    }

    submitBtn.disabled = true;
    const origText = submitBtn.textContent;
    submitBtn.textContent = "Sender …";
    // Firestore køer skrivingen og retryer i det uendelige uten å avvise når
    // nettet er borte: knappen sto i «Sender …» til siden ble lastet på nytt,
    // og studenten sendte inn på nytt. Vi avbryter ikke skrivingen, men sier
    // fra når den drøyer.
    const tregVarsel = setTimeout(() => showMsg(msg,
      "Sendingen tar lengre tid enn vanlig. Den fullføres av seg selv når nettet er tilbake — ikke send inn på nytt.", "warn"), 8000);
    let levertPaNytt = false;
    try {
      if (returState.aktiv) {
        await resubmitArtist(returState.id, candidate, returState.kode, $("#retur-comment")?.value.trim() || "");
        // Skjemaet blir stående (studenten kan ville se over), men knappen
        // låses: en ny innsending oppå en alt levert avvises av reglene og
        // ville bare gitt en kryptisk feil.
        levertPaNytt = true;
        showMsg(msg, `«${candidate.name}» er sendt inn på nytt. Læreren ser den i køen sin.`, "ok");
        submitBtn.textContent = "Sendt inn på nytt ✓";
      } else {
        await addArtist(candidate);
        form.reset();
        resetWorkRows();
        resetMusicExampleRows();
        resetSourceRows();
        buildGenrePicker($("#in-mainGenre"), []);
        showMsg(msg, `«${candidate.name}» er sendt inn og venter på godkjenning fra lærer`, "ok");
      }
    } catch (err) {
      showMsg(msg, "Noe gikk galt: " + err.message, "error");
    } finally {
      clearTimeout(tregVarsel);
      if (!levertPaNytt) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
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
//  Returflyt: prefyll skjemaet fra det returnerte forslaget
// ----------------------------------------------------------------------------

function fyllSkjema(a) {
  $("#in-name").value = a.name || "";
  $("#in-birthyear").value = a.birthYear ?? "";
  $("#in-deathyear").value = a.deathYear ?? "";
  $("#in-gender").value = a.gender || "";
  $("#in-metaGenre").value = a.metaGenre || "";
  $("#in-instrument").value = a.instrument || "";
  buildGenrePicker($("#in-mainGenre"), a.mainGenre || []);
  $("#in-subGenre").value = (a.subGenre || []).join(", ");
  $("#in-start").value = a.influenceStart ?? "";
  $("#in-end").value = a.influenceEnd ?? "";
  $("#in-desc").value = a.description || "";
  $("#in-geo").value = a.geography || "";
  $("#in-image-url").value = a.imageUrl || "";
  $("#in-image-credit").value = a.imageCredit || "";
  $("#in-by").value = a.proposedBy || "";
  buildRows($("#work-rows"), WORK_SPEC, a.keyWorks || []);
  buildRows($("#me-rows"), musicSpecSj(), a.musicExamples || []);
  buildRows($("#source-rows"), SOURCE_SPEC, a.kilder || []);
}

async function startRetur(id) {
  const banner = $("#retur-banner");
  const tekst = $("#retur-banner-tekst");
  try {
    // Vent på både dokumentet og sjangervokabularet: nedtrekkene kan ikke
    // prefylles før options finnes (fillSelect bevarer verdien etterpå).
    const [a] = await Promise.all([fetchArtist(id), vokabEllerFrist()]);
    if (!a || a.status !== "returnert") {
      banner.hidden = false;
      tekst.innerHTML = "<strong>Dette forslaget er ikke til retting lenger.</strong> Kanskje det alt er levert på nytt eller behandlet av læreren. Skjemaet under legger inn et nytt forslag.";
      // Kommentarfeltet blir stående skjult: det er ingen retur å svare på.
      return;
    }
    returState.aktiv = true;
    returState.id = id;
    returState.kode = a.returKode || "";
    banner.hidden = false;
    tekst.innerHTML = `<strong>Tilbakemelding fra læreren:</strong> ${escapeHtml(a.teacherFeedback || "")}`;
    // Kommentarfeltet står nederst ved navnet (v5.18), og vises bare her.
    $("#retur-comment-felt").hidden = false;
    const tittel = $("#form-tittel");
    if (tittel) tittel.textContent = `Lever på nytt: ${a.name || ""}`;
    const submitBtn = document.querySelector('#add-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "Send inn på nytt";
    fyllSkjema(a);
  } catch (err) {
    banner.hidden = false;
    tekst.textContent = "Kunne ikke hente forslaget (" + (err?.message || err) + "). Gå tilbake til forsiden og prøv igjen.";
  }
}

// ----------------------------------------------------------------------------
//  Skriveveiledningen
// ----------------------------------------------------------------------------

// Teksten er innholdssiden content/skriveveiledning, redigerbar for læreren fra
// «Innhold som mangler» på Oversikten. Ingen reservetekst i koden (brukerkrav
// fra v3.3): mangler siden, står hele blokka skjult i stedet for å vise en tom
// veiledning til studentene. Tegnes på nytt ved hvert content-snapshot, så en
// lærerendring slår gjennom uten sidelast. <details> beholder åpen/lukket-
// tilstanden sin, fordi bare innholdet inni byttes ut.
function visSkrivehjelp(content) {
  const boks = $("#skrivehjelp");
  const tekst = $("#skrivehjelp-tekst");
  if (!boks || !tekst) return;
  const side = pageFor("skriveveiledning", content);
  if (!side?.body) { boks.hidden = true; return; }
  tekst.innerHTML = renderRichText(side.body);
  boks.hidden = false;
}

// ----------------------------------------------------------------------------
//  Hjelpere + oppstart
// ----------------------------------------------------------------------------

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = "form-msg " + type;
}

function init() {
  setupForm();
  setupGenrePicker($("#in-mainGenre"));
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

  // Returflyt: ?retur=<id> gjør skjemaet om til «lever på nytt».
  const returId = new URLSearchParams(location.search).get("retur");
  if (returId) startRetur(returId);
  // Artistlista hentes først ved innsending (ensureArtists) — siden viser
  // ingen artister, så et sanntidsabonnement her var ren kostnad.
  //
  // Sjangertreet MÅ derimot hentes: metasjanger-velgeren og sjangervalget i
  // musikkeksemplene kommer fra det, og fra v4.51 bor det i Firestore. Uten
  // dette sto skjemaet med tomme nedtrekk. content er ett lite dokumentsett.
  subscribeContent((c) => {
    applyGenealogyDoc(c?.genealogy);
    refreshControls();
    vokabKlarResolve();
    visSkrivehjelp(c);
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
