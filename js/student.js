// ============================================================================
//  STUDENTSIDEN (student.html) — foreslå en artist, og lever et returnert
//  forslag på nytt
// ----------------------------------------------------------------------------
//  Selve skjemaet er det felles femstegs-skjemaet (js/ui/artist-skjema.js, fra
//  v6.96 det samme som lærerens og «Foreslå endring»). Her bestemmes bare
//  modusen (nytt forslag eller retur), lagringen, utkastene og
//  duplikatsjekken mot artistlista.
// ============================================================================

import { fetchArtists, addArtist, fetchArtist, resubmitArtist, subscribeContent } from "./data/store.js";
import { loadArtists } from "./data/artist-cache.js";
import { applyGenealogyDoc } from "./sjangre/genre-model.js";
import { escapeHtml } from "./felles/util.js";
import { pageFor } from "./felles/story-format.js";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./data/shared.js";
import { initUtskriftValg } from "./utskrift/utskrift-utvalg.js";
import { bekreft } from "./ui/ui-modal.js";
import { lagArtistSkjema } from "./ui/artist-skjema.js";

const state = {
  artists: [],
};

// Utkastene bor bare i localStorage: én nøkkel for nye forslag og én per
// returnert forslag. Returutkastet bærer returkoden, så et utkast fra en
// tidligere runde ikke legges over en ny tilbakemelding (artist-skjema.js).
const UTKAST_NY = "pensum-artistutkast";
const utkastNokkelRetur = (id) => `pensum-artistutkast:retur:${id}`;

// Sjangervokabularet kommer asynkront fra Firestore. Returflyten venter på
// det før skjemaet fylles, så nedtrekkene har valgene sine; racer mot en
// tidsfrist så en feilet content-lasting ikke henger siden.
let vokabKlarResolve;
const vokabKlar = new Promise((r) => { vokabKlarResolve = r; });
const vokabEllerFrist = () => Promise.race([vokabKlar, new Promise((r) => setTimeout(r, 5000))]);

let skjema = null;
let sisteInnhold = null;

function nyttSkjema(cfg) {
  skjema = lagArtistSkjema($("#artist-skjema"), cfg);
  if (sisteInnhold) skjema.visSkrivehjelp(pageFor("skriveveiledning", sisteInnhold)?.body);
  return skjema;
}

const IKKE_SATT_OPP = {
  tekst: "Firebase er ikke satt opp ennå (se README.md). Skjemaet validerer, men lagrer ikke ennå.",
  type: "error",
};

// ----------------------------------------------------------------------------
//  Nytt forslag
// ----------------------------------------------------------------------------

// «Foreslå» fra lærerens Skrivebord (?navn=) gjelder en bestemt artist, så et
// utkast om en annen artist legges ikke over navnet. Det blir da erstattet
// når det skrives.
function startNy(navnFraTimen) {
  const api = nyttSkjema({
    modus: "ny",
    utkastNokkel: UTKAST_NY,
    sendTekst: "Legg til forslag",
    finnDuplikat: async (navn) => { await ensureArtists(); return findDuplicate(navn); },
    onSend: async (v, api) => {
      if (!CONFIGURED) return IKKE_SATT_OPP;
      const { studentComment, ...kandidat } = v;
      await addArtist(kandidat);
      api.slettUtkast();
      api.tom();
      api.visSteg(0);
      return { tekst: `«${kandidat.name}» er sendt inn og venter på godkjenning fra lærer` };
    },
    onUtkastTom: async (api) => {
      if (!(await bekreft("Tømme skjemaet og slette utkastet?", { ja: "Tøm skjemaet", farlig: true }))) return;
      api.slettUtkast();
      api.tom();
      api.melding("");
      api.visSteg(0);
    },
  });
  const u = api.hentUtkast();
  const utkastNavn = String(u?.verdier?.name || "").trim().toLowerCase();
  if (u && (!navnFraTimen || utkastNavn === navnFraTimen.trim().toLowerCase())) {
    api.leggInnUtkast(u);
    api.visUtkastLinje("Skjemaet er fylt inn med utkastet du ikke sendte inn.", "Tøm skjemaet");
  } else if (navnFraTimen) {
    const felt = $('#artist-skjema [data-felt="name"]');
    if (felt && !felt.value) felt.value = navnFraTimen;
  }
}

// ----------------------------------------------------------------------------
//  Returflyt (v5.13): ?retur=<id> er en ny innsending av et returnert forslag
// ----------------------------------------------------------------------------

// Samme skjema, prefylt, og lagringen går til samme dokument med koden som
// bevis (fetchArtist leverer returKode sammen med resten; reglene krever at
// klienten har LEST returen den skriver over).
async function startRetur(id) {
  const banner = $("#retur-banner");
  const tekst = $("#retur-banner-tekst");
  let a;
  try {
    [a] = await Promise.all([fetchArtist(id), vokabEllerFrist()]);
  } catch (err) {
    banner.hidden = false;
    tekst.textContent = "Kunne ikke hente forslaget (" + (err?.message || err) + "). Gå tilbake til forsiden og prøv igjen.";
    $("#artist-skjema").innerHTML = "";
    return;
  }
  if (!a || a.status !== "returnert") {
    banner.hidden = false;
    tekst.innerHTML = "<strong>Dette forslaget er ikke til retting lenger.</strong> Kanskje det alt er levert på nytt eller behandlet av læreren. Skjemaet under legger inn et nytt forslag.";
    startNy(null);
    return;
  }
  const kode = a.returKode || "";
  const tittel = $("#form-tittel");
  if (tittel) tittel.textContent = `Lever på nytt: ${a.name || ""}`;
  const api = nyttSkjema({
    modus: "retur",
    verdier: a,
    utkastNokkel: utkastNokkelRetur(id),
    retur: {
      html: `<strong>Tilbakemelding fra læreren:</strong> ${escapeHtml(a.teacherFeedback || "")}`,
      kommentar: true,
      kode,
    },
    sendTekst: "Send inn på nytt",
    onSend: async (v, api) => {
      if (!CONFIGURED) return IKKE_SATT_OPP;
      const { studentComment, ...kandidat } = v;
      await resubmitArtist(id, kandidat, kode, studentComment);
      // Skjemaet blir stående (studenten kan ville se over), men knappen
      // låses: en ny innsending oppå en alt levert avvises av reglene.
      api.slettUtkast();
      api.settUtkastNokkel(null);
      api.skjulUtkastLinje();
      return { tekst: `«${kandidat.name}» er sendt inn på nytt. Læreren ser den i køen sin.`, knapp: "Sendt inn på nytt ✓", laas: true };
    },
    onUtkastTom: async (api) => {
      if (!(await bekreft("Forkaste endringene og gå tilbake til forslaget slik læreren sendte det tilbake?", { ja: "Forkast endringene", farlig: true }))) return;
      api.slettUtkast();
      api.fyll(a);
      api.skjulUtkastLinje();
      api.melding("");
      api.visSteg(0);
    },
  });
  // Endringer studenten ikke har sendt inn ennå, fra et tidligere besøk.
  const u = api.hentUtkast();
  if (u && u.kode === kode) {
    api.leggInnUtkast(u);
    api.visUtkastLinje("Skjemaet viser endringene du gjorde sist, men ikke har sendt inn.", "Forkast endringene");
  }
}

// ----------------------------------------------------------------------------
//  Duplikatsjekken
// ----------------------------------------------------------------------------

// Artistlista hentes fra den delte localStorage-cachen forsiden fyller
// (studenten kommer alltid hit via en lenke derfra), og kun ved direkte-besøk
// med tom cache gjøres én engangs-henting. Feiler hentingen, står lista tom:
// duplikatsjekken er en myk advarsel, og et duplikat fanges uansett av
// læreren i godkjenningskøen. Hentingen huskes, så et nytt «Neste» mens den
// første fortsatt går, ikke henter lista en gang til.
let artisterHentes = null;
function ensureArtists() {
  if (state.artists.length) return Promise.resolve();
  state.artists = loadArtists();
  if (state.artists.length) return Promise.resolve();
  artisterHentes ||= fetchArtists()
    .then((liste) => { state.artists = liste; })
    .catch((err) => console.warn("Kunne ikke hente artistlista til duplikatsjekk:", err?.message || err));
  return artisterHentes;
}

// Case-insensitiv navnematch mot eksisterende (ikke-fjernede) forslag.
function findDuplicate(name) {
  const n = (name || "").trim().toLowerCase();
  return state.artists.find((a) => a.status !== "removed" && (a.name || "").trim().toLowerCase() === n) || null;
}

// ----------------------------------------------------------------------------
//  Lukk (v6.96): tilbake dit man kom fra
// ----------------------------------------------------------------------------

// Fra en side i appen går lukkingen tilbake dit; åpnet direkte (lenke i en
// e-post, bokmerke) går den til forsiden. Utkastet står, så ingenting går tapt.
function lukkSkjemaet() {
  let fraAppen = false;
  try { fraAppen = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* ugyldig referrer */ }
  if (fraAppen && history.length > 1) history.back();
  else location.href = "index.html";
}

// ----------------------------------------------------------------------------
//  Oppstart
// ----------------------------------------------------------------------------

function init() {
  // Navn fra timen (v5.82): «Foreslå» på lærerens Skrivebord åpnet skjemaet
  // med artistnavnet fylt inn (?navn=…).
  let navnFraTimen = null;
  try {
    const navn = new URLSearchParams(window.location.search).get("navn");
    if (navn) navnFraTimen = navn.trim().slice(0, 120);
  } catch (e) { /* navn-fra-timen: uten URL-støtte står feltet tomt */ }
  // Merket på skriverikonet (v5.56); siden har ingen kort å ta med herfra.
  initUtskriftValg();
  $("#skjema-lukk")?.addEventListener("click", lukkSkjemaet);

  if (!CONFIGURED) {
    startNy(navnFraTimen);
    showSetupBanner("Du kan likevel se hvordan skjemaet ser ut.");
    return;
  }

  wireFirestoreErrorBanner();

  // Returflyt: ?retur=<id> gjør skjemaet om til «lever på nytt». Uten retur
  // er det et nytt forslag, og utkastet leses inn med en gang.
  const returId = new URLSearchParams(location.search).get("retur");
  if (returId) startRetur(returId);
  else startNy(navnFraTimen);

  // Sjangertreet MÅ hentes: metasjanger-velgeren og sjangervalget i
  // lytteeksemplene kommer fra det, og fra v4.51 bor det i Firestore. Samme
  // snapshot gir skriveveiledningen. Skjemaet bygger bare valgene på nytt;
  // det studenten har skrevet, står.
  subscribeContent((c) => {
    sisteInnhold = c || {};
    applyGenealogyDoc(c?.genealogy);
    skjema?.oppdaterVokabular();
    skjema?.visSkrivehjelp(pageFor("skriveveiledning", sisteInnhold)?.body);
    vokabKlarResolve();
  });
}

// Vent på klassepassordet (js/gate.js); uten gate.js er __pensumGate undefined
// og init() kjører umiddelbart som før (sperren feiler åpent).
Promise.resolve(window.__pensumGate?.klar).then(init);
