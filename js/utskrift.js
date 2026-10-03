// ============================================================================
//  UTSKRIFT — siden (v5.56)
// ----------------------------------------------------------------------------
//  utskrift.html: studentens hefte. Panelet øverst styrer utvalget (søk for å
//  legge til, liste med fjerning, rekkefølge), tittelen, delene og formen.
//  Under panelet står heftet i A4-bredde, slik det blir på papir, og
//  «Skriv ut» åpner nettleserens utskriftsdialog, der «Lagre som PDF» er
//  valget. Ingen server og ingen PDF-bibliotek: nettleserens egen sats gir
//  best typografi, og alt innholdet ligger alt i minnet (subscribeSharedData),
//  så heftet koster null ekstra lesinger.
//
//  Strukturen regnes ut av js/utskrift-modell.js (ren, testet); denne fila
//  tegner den. Tekstene går gjennom den delte markdown-light-rendereren
//  UTEN lenkekontekst: på papir skal artistnavn stå som tekst, ikke lenker.
//
//  Utvalget bor i localStorage (js/utskrift-utvalg.js). («Kopier lenke» og
//  ?u=-lenkene fantes fra v5.56 til v5.64; brukeren trengte dem ikke.)
//
//  Siden laster ikke utforsk-laget (ingen modaler, ingen kort å åpne), så
//  lærerregelen fra plan-meny.js står også her: den modulen drar inn hele
//  laget via explore-context.
// ============================================================================

import { sharedStateDefaults, subscribeSharedData } from "./shared-data.js?v=6.21";
import { CONFIGURED, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=6.21";
import { onAuthChange, savePlan } from "./store.js?v=6.21";
import { TEACHER_EMAILS } from "./firebase-config.js?v=6.21";
import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN, PUNKTER_BARE_I_PRESENTASJON } from "./feature-flags.js?v=6.21";
import { settSammen, foreslaaTittel, tellingerTekst, heltPensum, pensumMetasjangre, anslagSider, planFraModell, DELER, TYPE_ETIKETT, META_PREFIKS, normaliserTittel, normaliserLagret, kanoniskVis, TITTEL_MAKS } from "./utskrift-modell.js?v=6.21";
import { lesUtvalg, lagreUtvalg, leggTil, huk, hukFlere, toem, initUtskriftValg, UTSKRIFT_HENDELSE } from "./utskrift-utvalg.js?v=6.21";
import { byggIndeks, sok, normaliser, TYPE_LABEL } from "./search.js?v=6.21";
import { byggVisVerdi } from "./vis-lenke.js?v=6.21";
import { renderRichText, renderInline } from "./rich-text.js?v=6.21";
import { formatInfoText, musicExampleLabel } from "./ui-helpers.js?v=6.21";
import { escapeHtml, wikimediaThumb } from "./util.js?v=6.21";
import { heatColor, HEAT_NODATA } from "./heat-strip.js?v=6.21";
import { artistStripHtml } from "./artist-strip.js?v=6.21";
import { DECADES, isVisible } from "./limits.js?v=6.21";
import { askChoice, kopierTilUtklipp } from "./ui-modal.js?v=6.21";
import { onGenreModelChanged, GENEALOGY, META_GENRE_ORDER } from "./genre-model.js?v=6.21";
import { ytSpillelisteUrl, nyPlanId } from "./presentasjon-modell.js?v=6.21";

const state = { ...sharedStateDefaults(), isTeacher: false };
let erLaerer = false;
let modell = null;
let tittelForslag = "Pensumutdrag";
let tegnPlanlagt = false;
// Tittelen heftet tegnes med nå (overlinjene på familie- og seksjonshodene).
let tittelVist = "";

const $ = (id) => document.getElementById(id);
const h = escapeHtml;

// Alt heftet trenger har landet. Før det står «Laster …» i heftet, og
// utskriftsknappen er av, så ingen printer et halvt hefte.
const klar = () => !!(state.artistsLoaded && state.genreDescsLoaded && state.contentLoaded && state.decadesLoaded && state.techLoaded);

const tittelNaa = () => lesUtvalg().tittel || tittelForslag;

// ----------------------------------------------------------------------------
//  Tegning (samlet per ramme: fem snapshot-hooks lander tett ved oppstart)
// ----------------------------------------------------------------------------

function planleggTegning() {
  if (tegnPlanlagt) return;
  tegnPlanlagt = true;
  requestAnimationFrame(tegn);
}

function tegn() {
  tegnPlanlagt = false;
  const u = lesUtvalg();
  modell = settSammen({ valg: u.valg, fravalg: u.fravalg }, state, {
    deler: u.deler, form: u.form, erLaerer,
    skjul: SKJUL_I_STUDENTVISNING, skjulHub: SKJUL_I_HUBEN, punkterSkjult: PUNKTER_BARE_I_PRESENTASJON,
  });
  tittelForslag = foreslaaTittel(modell, { planTittel: u.plan?.tittel || "" });
  tegnPanel(u);
  tegnHefte(u);
}

// ----------------------------------------------------------------------------
//  Panelet
// ----------------------------------------------------------------------------

// Avkryssingstreet (v5.58): metasjangrene med sjangrene og artistene under,
// så tiårene, så alt annet. Alt utvalget drar med seg står her, også det som
// er huket bort (gjennomstreket), så det kan hukes på igjen. Opphavet står i
// grått: «fra metasjangeren», «fra sjangeren», «utledet».
const OPPHAV = { metasjanger: "fra metasjangeren", sjanger: "fra sjangeren", utledet: "utledet" };

// Sammenleggbare sjangergrupper (v5.74): én metasjanger gir 40 til 90 rader,
// så artistene under en sjanger kan legges sammen. Brukerens egne valg
// huskes her for økta; ellers er gruppa lukket når hele metasjangeren er
// valgt (de lange listene) og åpen når sjangeren er valgt for seg.
const foldValg = new Map();

function erApen(k, F) {
  if (foldValg.has(k.vis)) return foldValg.get(k.vis);
  return !F.valgt || k.artister.length <= 3;
}

function sjangerRad(k, F) {
  const opphav = [ "sjanger", F.valgt && k.kilde === "metasjanger" ? "" : OPPHAV[k.kilde] ].filter(Boolean).join(" · ");
  const n = k.artister.length;
  const med = k.artister.filter((a) => a.med).length;
  const teller = !n ? "" : med === n ? `${n} ${n === 1 ? "artist" : "artister"}` : `${med} av ${n} artister`;
  const apen = erApen(k, F);
  return `<li class="ut-sj${k.med ? "" : " ut-av"}${apen ? "" : " ut-lukket"}">` +
    `<div class="ut-sj-rad"><label><input type="checkbox" data-huk="${h(k.vis)}"${k.med ? " checked" : ""}> ` +
    `<span class="ut-navn">${h(k.navn)}</span> <span class="muted">${h(opphav)}</span></label>` +
    (n ? `<button type="button" class="ut-fold" data-fold="${h(k.vis)}" aria-expanded="${apen ? "true" : "false"}" title="${apen ? "Skjul artistene" : "Vis artistene"}">${h(teller)}</button>` : "") +
    `</div>` +
    (n ? `<ul${apen ? "" : " hidden"}>${k.artister.map((a) => hukRad(a, "ut-art", "", F.valgt)).join("")}</ul>` : "") +
    `</li>`;
}

// `stille` demper opphavet: under en valgt metasjanger kommer alt derfra, og
// 25 rader med «fra metasjangeren» sier ingenting.
function hukRad(x, klasse, hint, stille = false) {
  const opphav = stille && x.kilde === "metasjanger" ? "" : OPPHAV[x.kilde];
  const tekst = [hint, opphav].filter(Boolean).join(" · ");
  return `<li class="${klasse}${x.med ? "" : " ut-av"}"><label>` +
    `<input type="checkbox" data-huk="${h(x.vis)}"${x.med ? " checked" : ""}> ` +
    `<span class="ut-navn">${h(x.navn)}</span>${tekst ? ` <span class="muted">${h(tekst)}</span>` : ""}</label></li>`;
}

function treHtml(tre) {
  const familier = tre.familier.map((F) => {
    const hode = F.kanVelges
      ? `<label class="ut-fam-navn${F.valgt && !F.med ? " ut-av" : ""}"><input type="checkbox" data-huk="${h(F.vis)}" data-eksplisitt="1"${F.med ? " checked" : ""}> ` +
        `<b class="ut-navn">${h(F.navn)}</b> <span class="muted">${F.valgt ? "hele metasjangeren" : "metasjanger"}</span></label>`
      : `<span class="ut-fam-navn"><b>${h(F.navn)}</b></span>`;
    const sjangre = F.sjangre.map((k) => sjangerRad(k, F));
    const lose = F.lose.length ? `<li class="ut-lose"><ul>${F.lose.map((a) => hukRad(a, "ut-art", "", F.valgt)).join("")}</ul></li>` : "";
    return `<li class="ut-fam">${hode}<ul>${sjangre.join("")}${lose}</ul></li>`;
  });
  const grunnlag = tre.grunnlag === "artister" ? "utledet av artistenes innflytelsesperioder"
    : tre.grunnlag === "sjangre" ? "utledet av sjangrenes perioder" : "";
  // Opphavet står én gang i gruppehodet (v5.74), ikke på hver tiårsrad.
  const tiaar = tre.tiaar.length
    ? `<li class="ut-gruppe"><span class="ut-fam-navn"><b>Tiår</b>${grunnlag ? ` <span class="muted">${h(grunnlag)}</span>` : ""}</span>` +
      `<ul class="ut-rad">${tre.tiaar.map((x) => hukRad({ ...x, navn: `${x.tiaar}-tallet`, kilde: "" }, "ut-tiaar", "")).join("")}</ul></li>`
    : "";
  const annet = tre.annet.length
    ? `<li class="ut-gruppe"><span class="ut-fam-navn"><b>Annet</b></span><ul>${tre.annet.map((x) => {
      const grunn = x.grunn === "skjult" ? "vises ikke for studenter" : x.grunn === "finnes-ikke" ? "finnes ikke lenger" : "";
      return hukRad({ ...x, kilde: "" }, `ut-annet${x.grunn ? " ut-mangler" : ""}`, [TYPE_ETIKETT[x.type] || "", grunn].filter(Boolean).join(" · "));
    }).join("")}</ul></li>`
    : "";
  return familier.join("") + tiaar + annet;
}

function tegnDeler(u) {
  const el = $("utskrift-deler");
  if (!el) return;
  el.innerHTML = DELER.map((g) => {
    const valg = g.valg.filter((v) => !v.punkter || modell.punkterOk);
    return `<fieldset class="utskrift-deler-gruppe"><legend>${h(g.gruppe)}</legend>${valg.map((v) =>
      `<label><input type="checkbox" data-del="${h(v.id)}"${u.deler[v.id] ? " checked" : ""}> ${h(v.navn)}</label>`).join("")}</fieldset>`;
  }).join("");
}

// Statuslinja over utvalget: tellingene, det som er huket bort, og
// sideanslaget når heftet er tegnet.
function statusTekst(sider) {
  if (!klar()) return "Laster innholdet …";
  if (modell.tom) return "Utvalget er tomt. Søk under, eller trykk skriverikonet i tittellinja på et kort i appen.";
  const deler = [tellingerTekst(modell.tellinger)];
  if (modell.tellinger.bortvalgt) deler.push(`${modell.tellinger.bortvalgt} huket bort`);
  if (sider) deler.push(`cirka ${sider} ${sider === 1 ? "side" : "sider"}`);
  return deler.filter(Boolean).join(" · ");
}

// Hurtigvalg for hele metasjangre (v5.74): samme liste som «Velg alt» bruker,
// i pensumets rekkefølge. Valgte står dempet med hake.
function tegnMetaChips(u) {
  const el = $("utskrift-metaer");
  if (!el) return;
  if (!klar()) { el.innerHTML = ""; return; }
  el.innerHTML = `<span class="muted">Hele metasjangre:</span> ` + pensumMetasjangre().map((m) => {
    const vis = `${META_PREFIKS}${m}`;
    const med = u.valg.includes(vis);
    return `<button type="button" class="tag tag-meta-valg${med ? " er-med" : ""}" data-meta="${h(m)}"${med ? ' title="Er med i utskriften"' : ""}>${med ? "✓ " : ""}${h(m)}</button>`;
  }).join("");
}

// Artistene i treet som mangler lytteeksempel eller bilde, og som er med nå.
// Grunnlaget for hurtigvalgene «Ta ut …» under lista.
function artisterUten(felt) {
  if (!modell) return [];
  const ut = [];
  const sjekk = (a) => {
    if (!a.med) return;
    const id = String(a.vis).slice("artist:".length);
    const art = state.artists.find((x) => x.id === id);
    if (!art) return;
    const har = felt === "lytte"
      ? (art.musicExamples || []).some((m) => m && m.url)
      : !!art.imageUrl;
    if (!har) ut.push(a.vis);
  };
  for (const F of modell.tre.familier) {
    for (const k of F.sjangre) k.artister.forEach(sjekk);
    F.lose.forEach(sjekk);
  }
  return ut;
}

function tegnHurtig() {
  const el = $("utskrift-hurtig");
  if (!el) return;
  if (!modell || modell.tom) { el.innerHTML = ""; return; }
  const utenLytte = artisterUten("lytte").length;
  const utenBilde = artisterUten("bilde").length;
  if (!utenLytte && !utenBilde) { el.innerHTML = ""; return; }
  el.innerHTML = `<span class="muted">Ta ut:</span>` +
    (utenLytte ? ` <button type="button" class="btn ghost small" data-hurtig="lytte">artister uten lytteeksempel (${utenLytte})</button>` : "") +
    (utenBilde ? ` <button type="button" class="btn ghost small" data-hurtig="bilde">artister uten bilde (${utenBilde})</button>` : "");
}

// «Send til en annen enhet» (v5.74): utvalget bor i denne nettleseren, og
// studentene velger på telefonen og skriver ut fra en PC. Lenka bærer valg,
// bortvalg og tittel (delene og formen velges på nytt der). QR-koden lages
// av js/vendor/qrcode.js; blir lenka for lang for en kode, vises bare
// «Kopier lenke».
function delLenke(u) {
  const url = new URL("utskrift.html", window.location.href);
  url.searchParams.set("u", u.valg.join("|"));
  if (u.fravalg.length) url.searchParams.set("x", u.fravalg.join("|"));
  if (u.tittel) url.searchParams.set("t", u.tittel);
  return url.href;
}

function tegnDel(u) {
  const boks = $("utskrift-del-boks");
  const qr = $("utskrift-qr");
  if (!boks || !qr) return;
  boks.hidden = !u.valg.length;
  if (!u.valg.length) { qr.innerHTML = ""; return; }
  const kode = qrSvg(delLenke(u), 34);
  qr.innerHTML = kode;
  qr.hidden = !kode;
}

// Utvalget fra en delt lenke (?u=…&x=…&t=…): skrives inn i nettleseren og
// tas ut av adressen, så en omlasting ikke setter det inn på nytt.
function lesUtvalgFraUrl() {
  let q;
  try { q = new URLSearchParams(window.location.search); } catch (e) { return; }
  if (!q.has("u")) return;
  const del = (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean);
  const u = lesUtvalg();
  u.valg = del(q.get("u"));
  u.fravalg = del(q.get("x"));
  u.tittel = q.get("t") || "";
  lagreUtvalg(normaliserLagret(u));
  try {
    const url = new URL(window.location.href);
    for (const k of ["u", "x", "t"]) url.searchParams.delete(k);
    window.history.replaceState(null, "", url);
  } catch (e) {}
}

// QR-kode som SVG i oppgitt størrelse (mm), eller tom streng når biblioteket
// mangler eller teksten er for lang.
function qrSvg(tekst, mm = 26) {
  const lag = window.qrcode;
  if (typeof lag !== "function") return "";
  try {
    const qr = lag(0, "M");
    qr.addData(String(tekst), "Byte");
    qr.make();
    return `<div class="h-qr" style="width:${mm}mm;height:${mm}mm" role="img" aria-label="QR-kode">${qr.createSvgTag({ scalable: true, margin: 0 })}</div>`;
  } catch (e) {
    return "";
  }
}

let meldingTimer = null;
function melding(tekst, ok = true) {
  const el = $("utskrift-melding");
  if (!el) return;
  el.textContent = tekst;
  el.className = "form-msg " + (ok ? "ok" : "err");
  clearTimeout(meldingTimer);
  if (tekst) meldingTimer = setTimeout(() => { el.textContent = ""; }, 8000);
}

function tegnPanel(u) {
  const status = $("utskrift-status");
  if (status) status.textContent = statusTekst(null);
  const antallEl = $("utskrift-antall-tekst");
  if (antallEl) antallEl.textContent = u.valg.length ? `(${u.valg.length} valgt)` : "";

  tegnMetaChips(u);
  const liste = $("utskrift-liste");
  if (liste) {
    liste.innerHTML = u.valg.length
      ? treHtml(modell.tre)
      : `<li class="muted utskrift-tom-liste">Ingenting valgt ennå.</li>`;
  }
  tegnHurtig();
  tegnDel(u);

  const tittelFelt = $("utskrift-tittel");
  if (tittelFelt) {
    if (document.activeElement !== tittelFelt && tittelFelt.value !== u.tittel) tittelFelt.value = u.tittel;
    tittelFelt.placeholder = tittelForslag;
  }
  const hint = $("utskrift-tittel-hint");
  if (hint) {
    hint.textContent = u.tittel
      ? `Tomt felt gir forslaget «${tittelForslag}».`
      : `Forslag: «${tittelForslag}». Skriv din egen om du vil.`;
  }

  tegnDeler(u);
  document.querySelectorAll('input[name="utskrift-form"]').forEach((r) => {
    r.checked = r.value === (u.form.kompakt ? "kompakt" : "lesevennlig");
  });
  const rf = $("utskrift-rekkefolge");
  if (rf && rf.value !== u.form.rekkefolge) rf.value = u.form.rekkefolge;

  const knapp = (id, off) => { const b = $(id); if (b) b.disabled = off; };
  knapp("utskrift-skriv-ut", modell.tom || !klar());
  knapp("utskrift-alt", !klar());
  knapp("utskrift-toem", u.valg.length === 0);
  // «Lag kjøreplan» (v5.74): bare i lærerøkt, og bare når heftet har kort.
  const plan = $("utskrift-plan");
  if (plan) { plan.hidden = !erLaerer; plan.disabled = modell.tom || !klar(); }
}

// --- Søk for å legge til -----------------------------------------------------

let indeks = null;
let indeksAvtrykk = "";

function hentIndeks() {
  const s = state;
  const avtrykk = [
    s.artists.length, Object.keys(s.genreDescs).length, s.techItems.length,
    Object.keys(s.decadeDescs).length, Object.keys(s.content).length, erLaerer,
  ].join("|");
  if (!indeks || avtrykk !== indeksAvtrykk) {
    indeks = byggIndeks(s, { erLærer: erLaerer, skjul: SKJUL_I_STUDENTVISNING, skjulHub: SKJUL_I_HUBEN });
    indeksAvtrykk = avtrykk;
  }
  return indeks;
}

const MAKS_TREFF = 12;

function tegnSok() {
  const felt = $("utskrift-sok");
  const ut = $("utskrift-sok-treff");
  if (!felt || !ut) return;
  const q = felt.value.trim();
  if (!q) { ut.innerHTML = ""; return; }
  const res = sok(hentIndeks(), q);
  if (res.forKort) { ut.innerHTML = `<p class="muted">Skriv minst to tegn.</p>`; return; }
  const u = lesUtvalg();
  const sett = new Set();
  const treff = [];
  // Metasjangrene finnes ikke i søkeindeksen (de har ingen egen flate på
  // skjermen), så de matches på navnet her og står først.
  const nq = normaliser(q);
  for (const meta of META_GENRE_ORDER) {
    if (!normaliser(meta).includes(nq)) continue;
    const vis = `${META_PREFIKS}${meta}`;
    const nArt = state.artists.filter((a) => isVisible(a) && a.metaGenre === meta).length;
    const nSj = GENEALOGY.filter((n) => n.g === meta).length;
    sett.add(vis);
    treff.push({ t: { type: "metasjanger", tittel: meta, sti: `hele metasjangeren: ${nSj} sjangre, ${nArt} artister` }, vis });
  }
  for (const t of res.grupper.flatMap((g) => g.treff)) {
    // Samfunn og teknologi er to treff på skjermen, men ett tiår på papir.
    const vis = kanoniskVis(byggVisVerdi(t.apne) || "");
    if (!vis || sett.has(vis)) continue;
    sett.add(vis);
    treff.push({ t, vis });
    if (treff.length >= MAKS_TREFF) break;
  }
  if (!treff.length) { ut.innerHTML = `<p class="muted">Ingen treff på «${h(q)}» som kan stå i et hefte.</p>`; return; }
  const medNaa = new Set(modell?.valg || []);
  ut.innerHTML = treff.map(({ t, vis }) => {
    const med = u.valg.includes(vis) || medNaa.has(vis);
    return `<button type="button" class="utskrift-treff${med ? " er-med" : ""}" data-legg="${h(vis)}"${med ? " disabled" : ""}>
      <span class="utskrift-rad-type">${h(TYPE_ETIKETT[t.type] || TYPE_LABEL[t.type] || t.type)}</span>
      <span class="utskrift-treff-navn">${h(t.tittel)}${t.sti ? ` <span class="muted">${h(t.sti)}</span>` : ""}</span>
      <span class="utskrift-treff-merke">${med ? "i utskriften" : "Legg til"}</span>
    </button>`;
  }).join("");
}

// ----------------------------------------------------------------------------
//  Heftet
// ----------------------------------------------------------------------------

const NOTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

const rt = (tekst) => `<div class="rt">${renderRichText(tekst, {})}</div>`;
const mangler = (hva) => `<p class="h-mangler">${h(hva)}</p>`;
const datoTekst = () => new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
const kortUrl = (url) => String(url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function kortListe(navn, maks = 8) {
  return navn.length <= maks ? navn.join(" · ") : `${navn.slice(0, maks).join(" · ")} og ${navn.length - maks} til`;
}

function punkterHtml(liste) {
  if (!liste?.length) return "";
  return `<ul class="h-punkter">${liste.map((p) => `<li>${renderInline(p, {})}</li>`).join("")}</ul>`;
}

// Wikimedia lager ikke en miniatyr som er bredere enn originalen (svarer
// 400), så noen kort fikk tomt bilde: T-Bone Walker og Little Walter i
// Blues-heftet (målt 2026-09-25). Samme reserve som appens imgTag: data-full
// bærer originalen, og feillytteren under bytter til den. `bredde` er
// miniatyrbredden (kompakt form ber om en smalere, v5.74).
function bildeHtml(bilde, hoyde = "", bredde = 500) {
  if (!bilde) return "";
  const thumb = wikimediaThumb(bilde.url, bredde);
  const src = thumb || bilde.url;
  return `<figure class="h-bilde"><img src="${h(src)}" alt="" decoding="async"${thumb ? ` data-full="${h(bilde.url)}"` : ""}${hoyde ? ` style="height:${hoyde}"` : ""}>` +
    `${bilde.kreditt ? `<figcaption>Foto: ${h(bilde.kreditt)}</figcaption>` : ""}</figure>`;
}

// Uten lytteeksempler står det ingenting (brukervalg 2026-09-25): et kort
// uten lenker skal ikke ha en linje som sier det.
function lyttHtml(liste, medNr) {
  if (!liste.length) return "";
  const eks = liste.map((l) => `«${h(l.label)}»${h(musicExampleLabel(l))}${medNr && l.nr ? `<span class="h-nr">${l.nr}</span>` : ""}`);
  return `<div class="h-lytt">${NOTE_SVG}<span><strong>Lytt</strong> ${eks.join(" · ")}</span></div>`;
}

// Tidslinja for virketid (v5.60): appens egen innflytelseslinje
// (js/artist-strip.js), så kortet og heftet leser samme akse og samme
// spenn. Kortet bærer spennet, ikke artisten; linja bygges av det.
function virketidHtml(k) {
  if (!k.span) return "";
  return artistStripHtml({
    influenceStart: k.span.start,
    influenceEnd: k.span.open ? null : k.span.end,
    metaGenre: k.familie,
  });
}

// Faktalinja (brukervalg 2026-09-25): «Tangenter. Sjanger: R&B · Rock'n'roll.
// Undersjanger: New Orleans R&B.» Virkested, plateselskap og innflytelses-
// årene står ikke her; innflytelsen leses av tidslinja for virketid.
function faktaHtml(k) {
  const setninger = [];
  if (k.fakta.instrument) setninger.push(`<b>${h(k.fakta.instrument)}</b>.`);
  const sjangre = k.fakta.sjangre.filter(Boolean);
  if (sjangre.length) setninger.push(`<span class="h-etikett">Sjanger:</span> ${sjangre.map(h).join(" · ")}.`);
  const under = k.fakta.undersjangre.filter(Boolean);
  if (under.length) setninger.push(`<span class="h-etikett">Undersjanger:</span> ${under.map(h).join(" · ")}.`);
  return setninger.length ? `<p class="h-fakta">${setninger.join(" ")}</p>` : "";
}

function artistKortHtml(k, d, kompakt, medNr) {
  // Kompakt form (v5.74): et lite bilde ved navnet i stedet for ingen; det gir
  // gjenkjenning uten å koste plass. CSS setter målene (20 × 24 mm).
  const bilde = d["artist.bilde"] ? bildeHtml(k.bilde, kompakt ? "24mm" : "", kompakt ? 250 : 500) : "";
  const beskrivelse = d["artist.beskrivelse"]
    ? (k.beskrivelse ? rt(k.beskrivelse) : mangler("Beskrivelsen er ikke skrevet ennå."))
    : "";
  const verk = d["artist.verk"] && k.verk.length
    ? `<p class="h-verk"><strong>Sentrale verk</strong> ${k.verk.map((w) => `«${h(w.tittel)}»${w.aar ? ` (${w.aar})` : ""}`).join(" · ")}</p>`
    : "";
  return `<article class="h-kort h-artist">
    <h3 class="h-kort-navn">${h(k.navn)}${k.levetid ? ` <span class="h-aar">${h(k.levetid)}</span>` : ""}</h3>
    ${d["artist.fakta"] ? faktaHtml(k) : ""}
    ${d["artist.virketid"] ? virketidHtml(k) : ""}
    <div class="h-kort-kropp${bilde ? "" : " uten-bilde"}">
      <div class="h-kort-tekst">
        ${d["artist.punkter"] ? punkterHtml(k.punkter) : ""}
        ${beskrivelse}${verk}
        ${d["artist.lytte"] ? lyttHtml(k.lytte, medNr) : ""}
      </div>${bilde}
    </div>
  </article>`;
}

function stripeHtml(s) {
  const celler = s.verdier.map((v, i) => {
    const farge = v == null ? HEAT_NODATA : heatColor(s.farge, v);
    return `<i style="background:${farge}" title="${DECADES[i]}-tallet${v != null ? ` · nivå ${v}/5` : " · ingen data"}"></i>`;
  });
  return `<div class="h-stripe">${celler.join("")}</div><div class="h-stripe-akse">${DECADES.map((x) => `<span>${x}</span>`).join("")}</div>`;
}

function relasjonerHtml(r) {
  const linje = (etikett, liste) => (liste.length ? `<p class="h-rel"><strong>${etikett}</strong> ${liste.map(h).join(", ")}</p>` : "");
  return linje("Vokste ut av", r.fra) + linje("Motreaksjon mot", r.mot) + linje("Førte videre til", r.til) + linje("Reaksjoner mot denne", r.motAv);
}

function sjangerHodeHtml(k, d) {
  return `${d["sjanger.era"] && k.era ? `<p class="h-epoke">${h(k.era)}</p>` : ""}
    ${d["sjanger.stripe"] && k.stripe ? stripeHtml(k.stripe) : ""}
    ${d["sjanger.relasjoner"] ? relasjonerHtml(k.relasjoner) : ""}`;
}

// Koblingstekstene (v5.74): strekene inn i og ut av sjangeren i slektstreet,
// som prosa under beskrivelsen. Modellen har alt filtrert på flagget og valget.
function koblingerHtml(k) {
  if (!k.koblinger?.length) return "";
  return `<div class="h-koblinger"><h3 class="h-del">Koblinger i slektstreet</h3>${k.koblinger.map((x) =>
    `<div class="h-kobling"><p class="h-kobling-hode"><span class="h-etikett">${h(x.etikett)}</span> ${h(x.navn)}</p>${rt(x.tekst)}</div>`).join("")}</div>`;
}

function sjangerKroppHtml(k, d, kompakt, medNr) {
  const beskrivelse = d["sjanger.beskrivelse"]
    ? (k.beskrivelse ? rt(k.beskrivelse) : mangler("Beskrivelsen er ikke skrevet ennå."))
    : "";
  return `${d["sjanger.punkter"] ? punkterHtml(k.punkter) : ""}${beskrivelse}${koblingerHtml(k)}
    ${k.artister.map((a) => artistKortHtml(a, d, kompakt, medNr)).join("")}`;
}

function sjangerKortHtml(k, d, kompakt, medNr) {
  return `<article class="h-sjanger">
    <header class="h-sjanger-hode">
      <p class="h-overlinje">Sjanger · ${h(k.familie)}</p>
      <h2>${h(k.navn)}</h2>
      ${sjangerHodeHtml(k, d)}
    </header>
    ${sjangerKroppHtml(k, d, kompakt, medNr)}
  </article>`;
}

function ordlisteHtml(liste, tittel) {
  if (!liste.length) return "";
  return `<div class="h-ordliste"><h3>${h(tittel)}</h3><dl>${liste.map((u) =>
    `<div><dt>${h(u.navn)}</dt><dd>${renderInline(u.tekst, {})}</dd></div>`).join("")}</dl></div>`;
}

// Overlinja på hodene bærer heftets tittel (v5.74): Safari lager ingen
// løpende topptekst, så hvert kapittel skal si hvilket hefte det hører til.
const overlinje = (hva) => `<p class="h-overlinje">${h(tittelVist)} · ${h(hva)}</p>`;

function familieHtml(F, d, kompakt, medNr) {
  if (F.pseudo) {
    return `<section class="h-familie" data-toc="familie:${h(F.navn)}" style="--farge:${h(F.farge)}">
      <header class="h-familie-hode">${overlinje("Undersjangre")}<h1>Undersjangre</h1></header>
      ${ordlisteHtml(F.ordliste, "Undersjangre i utvalget")}
    </section>`;
  }
  const hode = F.hodeKort;
  const harKort = !!hode || F.sjangre.length > 0;
  return `<section class="h-familie" data-toc="familie:${h(F.navn)}" style="--farge:${h(F.farge)}">
    <header class="h-familie-hode">
      ${overlinje(hode ? "Metasjanger og sjanger" : "Metasjanger")}
      <h1>${h(F.navn)}</h1>
      ${hode ? sjangerHodeHtml(hode, d) : ""}
    </header>
    ${F.historie ? `<div class="h-historie"><h2>Historien om ${h(F.historie.navn)}</h2>${rt(F.historie.body)}</div>` : ""}
    ${hode ? sjangerKroppHtml(hode, d, kompakt, medNr) : ""}
    ${F.sjangre.map((k) => sjangerKortHtml(k, d, kompakt, medNr)).join("")}
    ${F.loseArtister.length ? `<div class="h-lose">${harKort ? `<h2 class="h-lose-hode">Flere artister i ${h(F.navn)}</h2>` : ""}${F.loseArtister.map((a) => artistKortHtml(a, d, kompakt, medNr)).join("")}</div>` : ""}
    ${ordlisteHtml(F.ordliste, "Undersjangre i utvalget")}
  </section>`;
}

function tidslinjeHtml(t) {
  const pct = (aar) => ((aar - t.start) / (t.slutt - t.start)) * 100;
  const tiaarBredde = (10 / (t.slutt - t.start)) * 100;
  // Fargen som variabel (v5.74): åpne perioder tones ut mot høyre i CSS, som
  // Sjangerperioder-kortet gjør på skjermen, i stedet for full farge til i dag.
  const rader = t.rader.map((r) => `<div class="h-tl-navn${r.type === "sjanger" ? " sj" : ""}" title="${h(r.navn)}">${h(r.navn)}</div>` +
    `<div class="h-tl-spor" style="background-size:${tiaarBredde.toFixed(3)}% 100%">` +
    `<i class="h-tl-stolpe ${r.type}${r.apen ? " apen" : ""}" style="left:${pct(r.fra).toFixed(2)}%;width:${Math.max(0.7, pct(r.til) - pct(r.fra)).toFixed(2)}%;--stolpe:${h(r.farge)}"></i></div>`);
  return `<div class="h-tidslinje">
    <h2>Tidslinje over utvalget</h2>
    <p class="h-hint">Sjangrene som brede stolper, artistene som streker. Årstallene er innflytelsesperiodene fra kortene; en stolpe som tones ut, er fortsatt aktiv.</p>
    <div class="h-tl">
      <div class="h-tl-akse">${t.ticks.map((x) => `<span style="left:${pct(x).toFixed(2)}%">${x}</span>`).join("")}</div>
      ${rader.join("")}
    </div>
  </div>`;
}

// Innholdsfortegnelsen (v5.74): på forsiden, under tittelblokka. Hver rad
// bærer nøkkelen til seksjonen sin (data-toc-ref), så sidetallene kan fylles
// inn etter at heftet er tegnet og målt (fyllSidetall).
function tocHtml() {
  const punkter = [];
  const navnAv = (liste) => liste.map((a) => a.navn);
  for (const F of modell.familier) {
    const linjer = [];
    if (F.hodeKort?.artister.length) linjer.push(kortListe(navnAv(F.hodeKort.artister)));
    for (const k of F.sjangre) linjer.push(`${k.navn}${k.artister.length ? `: ${kortListe(navnAv(k.artister))}` : ""}`);
    if (F.loseArtister.length) linjer.push(kortListe(navnAv(F.loseArtister)));
    punkter.push({ navn: F.navn, linjer, ref: `familie:${F.navn}` });
  }
  if (modell.tidslinje) punkter.push({ navn: "Tidslinje over utvalget", linjer: [], ref: "tidslinje" });
  if (modell.bakteppe.length) punkter.push({ navn: "Bakteppe", linjer: [modell.bakteppe.map((b) => `${b.tiaar}-tallet`).join(" · ")], ref: "bakteppe" });
  if (modell.innovasjoner.length) punkter.push({ navn: "Innovasjoner", linjer: [kortListe(modell.innovasjoner.map((t) => t.navn))], ref: "innovasjoner" });
  if (modell.instrumenter.length) punkter.push({ navn: "Instrumenter", linjer: [kortListe(modell.instrumenter.map((i) => i.tittel))], ref: "instrumenter" });
  for (const s of modell.sider) punkter.push({ navn: s.tittel, linjer: [], ref: `side:${s.id}` });
  if (modell.lytteliste.length) punkter.push({ navn: "Lytteliste", linjer: [], ref: "lytteliste" });
  // Tidslinja står på side 2, altså før familiene: sorter etter rekkefølgen i
  // heftet, som er den vi tegner i (tidslinja rett etter forsiden).
  const rekkefolge = (p) => (p.ref === "tidslinje" ? 0 : 1);
  punkter.sort((a, b) => rekkefolge(a) - rekkefolge(b));
  return `<div class="h-innholdsliste">
    <h2>Innhold</h2>
    <ul class="h-toc">${punkter.map((p) =>
      `<li><div class="h-toc-rad"><span class="h-toc-navn">${h(p.navn)}</span><span class="h-toc-prikker"></span><span class="h-toc-side" data-toc-ref="${h(p.ref)}"></span></div>` +
      `${p.linjer.map((l) => `<span class="h-toc-under">${h(l)}</span>`).join("")}</li>`).join("")}</ul>
    <p class="h-toc-hint" hidden>Sidetallene er anslag fra skjermen; utskriften kan avvike med en side.</p>
  </div>`;
}

// Forsiden (v5.74): tittelblokka øverst og innholdsfortegnelsen under. Et
// LITE hefte (modell.liten) får tittelblokka som et hode på første side, uten
// innholdsfortegnelse og uten sideskift: ett artistkort skal ikke koste tre
// ark. Tidslinja følger da rett under. (Merket «historieappen.no» og «Slik er
// heftet bygd opp» er bevisst ute, brukervalg 2026-09-25.)
function forsideHtml(t, farge) {
  const liten = modell.liten;
  return `<section class="h-forside${liten ? " h-forside-liten" : ""}" data-toc="forside">
    <div class="h-tittelblokk" style="--farge:${h(farge)}">
      <p class="h-overlinje">Pensumutdrag · MUR114</p>
      <h1 class="h-tittel">${h(t)}</h1>
      <p class="h-under">Populærmusikkhistorie</p>
      <p class="h-meta">Laget <strong>${h(datoTekst())}</strong><br>Utvalg: <strong>${h(tellingerTekst(modell.tellinger))}</strong></p>
    </div>
    ${liten ? (modell.tidslinje ? tidslinjeHtml(modell.tidslinje) : "") : tocHtml()}
  </section>`;
}

// Tidslinja på egen side etter forsiden (store hefter). Små hefter har den
// på første side (forsideHtml).
function tidslinjeSideHtml() {
  if (modell.liten || !modell.tidslinje) return "";
  return `<section class="h-innhold" data-toc="tidslinje">${tidslinjeHtml(modell.tidslinje)}</section>`;
}

// Fyller sidetallene i innholdsfortegnelsen fra anslaget (bare på skjermer
// som bryter som papiret; ellers skjules prikkene og tallene).
function fyllSidetall(anslag) {
  const toc = $("hefte")?.querySelector(".h-toc");
  if (!toc) return;
  const hint = toc.parentElement?.querySelector(".h-toc-hint");
  if (!anslag) {
    toc.classList.add("uten-sidetall");
    if (hint) hint.hidden = true;
    return;
  }
  toc.classList.remove("uten-sidetall");
  toc.querySelectorAll("[data-toc-ref]").forEach((sp) => {
    const s = anslag.start.get(sp.dataset.tocRef);
    sp.textContent = s ? `s. ${s}` : "";
  });
  if (hint) hint.hidden = false;
}

function seksjonHode(hva, tittel) {
  return `<header class="h-seksjon-hode">${overlinje(hva)}<h1>${h(tittel)}</h1></header>`;
}

function bakteppeHtml(d) {
  if (!modell.bakteppe.length) return "";
  const tekst = (t) => (t ? `<div class="rt">${formatInfoText(t, {})}</div>` : mangler("Teksten er ikke skrevet ennå."));
  const tiaar = modell.bakteppe.map((b) => `<article class="h-tiaar">
    <header class="h-sjanger-hode"><h2>${b.tiaar}-tallet</h2></header>
    ${d["tiaar.samfunn"] ? `<h3 class="h-del">Samfunn</h3>${tekst(b.samfunn)}` : ""}
    ${d["tiaar.teknologi"] ? `<h3 class="h-del">Teknologi</h3>${tekst(b.teknologi)}` : ""}
    ${b.innovasjoner.length ? `<h3 class="h-del">Innovasjoner i tiåret</h3><p class="h-innov-liste">${b.innovasjoner.map((t) => `${h(t.navn)}${t.aar ? ` (${t.aar})` : ""}`).join(" · ")}</p>` : ""}
  </article>`);
  return `<section class="h-seksjon h-nyside h-bakteppe" data-toc="bakteppe" style="--farge:#534ab7">${seksjonHode("Bakteppe", "Tiårene")}${tiaar.join("")}</section>`;
}

function techKortHtml(t, d, kompakt) {
  const aar = [t.oppfunnet ? `oppfunnet ${t.oppfunnet}` : "", t.iBruk ? `i bruk fra ${t.iBruk}` : ""].filter(Boolean).join(" · ");
  const fakta = [];
  if (t.hendelse) fakta.push("<b>Viktig hendelse</b>");
  else if (t.kategori) fakta.push(`<b>${h(t.kategori)}</b>`);
  if (t.instrument) fakta.push(h(t.instrument));
  if (t.iBrukTekst) fakta.push(h(t.iBrukTekst));
  const bilde = d["tech.bilde"] ? bildeHtml(t.bilde, kompakt ? "20mm" : "30mm", kompakt ? 250 : 500) : "";
  const beskrivelse = d["tech.beskrivelse"]
    ? (t.beskrivelse ? rt(t.beskrivelse) : mangler("Beskrivelsen er ikke skrevet ennå."))
    : "";
  return `<article class="h-kort h-tech">
    <h3 class="h-kort-navn">${h(t.navn)}${d["tech.fakta"] && aar ? ` <span class="h-aar">${h(aar)}</span>` : ""}</h3>
    ${d["tech.fakta"] && fakta.length ? `<p class="h-fakta">${fakta.join(" · ")}</p>` : ""}
    <div class="h-kort-kropp${bilde ? "" : " uten-bilde"}">
      <div class="h-kort-tekst">${d["tech.punkter"] ? punkterHtml(t.punkter) : ""}${beskrivelse}</div>${bilde}
    </div>
  </article>`;
}

function innovasjonerHtml(d, kompakt) {
  if (!modell.innovasjoner.length) return "";
  return `<section class="h-seksjon h-nyside h-innovasjoner" data-toc="innovasjoner" style="--farge:#d97706">${seksjonHode("Innovasjoner", "Teknologien bak lyden")}${modell.innovasjoner.map((t) => techKortHtml(t, d, kompakt)).join("")}</section>`;
}

function instrumenterHtml() {
  if (!modell.instrumenter.length) return "";
  const deler = modell.instrumenter.map((i) => `<article class="h-instrument"><h2>${h(i.tittel)}</h2>${i.body.trim() ? rt(i.body) : mangler("Sammendraget er ikke skrevet ennå.")}</article>`);
  return `<section class="h-seksjon h-nyside h-instrumenter" data-toc="instrumenter" style="--farge:#0f766e">${seksjonHode("Instrumenter", "Instrumentenes utvikling")}${deler.join("")}</section>`;
}

function siderHtml() {
  return modell.sider.map((s) => `<section class="h-seksjon h-nyside h-side" data-toc="side:${h(s.id)}" style="--farge:#7c3aed">${seksjonHode("Det store bildet", s.tittel)}${s.body.trim() ? rt(s.body) : mangler("Teksten er ikke skrevet ennå.")}</section>`).join("");
}

// «Spill hele lista» (v5.74): én YouTube-lenke som spiller alle videoene i
// lytteseksjonen, som QR-kode. Ingen skriver av en nettadresse fra et ark, og
// en adresse på 200 tegn er uansett ikke til å skrive av. Over 50 videoer
// deles lenka (YouTubes tak), én kode per del.
function spillAlleHtml() {
  const ider = modell.lytteliste.map((l) => l.video).filter(Boolean);
  if (ider.length < 2) return "";
  const lenker = ytSpillelisteUrl(ider);
  const antall = new Set(ider).size;
  return `<div class="h-lytte-alle">${lenker.map((url, i) => {
    const kode = qrSvg(url, 26);
    const del = lenker.length > 1 ? ` (del ${i + 1} av ${lenker.length})` : "";
    return `<div class="h-qr-rad">${kode}<div><p class="h-lytte-alle-tekst"><strong>Spill hele lista${del}</strong> ${antall} videoer på YouTube${kode ? ": skann koden med mobilen." : "."}</p>${kode ? "" : `<p class="h-url">${h(kortUrl(url))}</p>`}</div></div>`;
  }).join("")}</div>`;
}

function lyttelisteHtml() {
  if (!modell.lytteliste.length) return "";
  // Eksempler valgt utenom kortene (v5.77) står sist, bak et lite skille når
  // lista også har kortenes egne.
  const rad = (l) => `<div class="h-lytte-rad"><span class="h-nr">${l.nr}</span><span>${h(l.artist)}: «${h(l.label)}»${h(musicExampleLabel(l))}<span class="h-url">${h(kortUrl(l.url))}</span></span></div>`;
  const egne = modell.lytteliste.filter((l) => !l.valgt).map(rad);
  const valgte = modell.lytteliste.filter((l) => l.valgt).map(rad);
  const skille = egne.length && valgte.length ? `<p class="h-lytte-skille">Valgt i tillegg til kortene</p>` : "";
  return `<section class="h-seksjon h-lytteliste" data-toc="lytteliste">${seksjonHode("Bakerst", "Lytteliste")}
    ${spillAlleHtml()}
    <div class="h-liste-2sp">${egne.join("")}${skille}${valgte.join("")}</div>
  </section>`;
}

// Kolofonen (brukervalg 2026-09-25): bare denne ene setningen.
function kolofonHtml() {
  return `<footer class="h-kolofon">Laget med utskriftsfunksjonen i historieappen.no, ${h(datoTekst())}.</footer>`;
}

// Løpende topptekst og sidetall via @page-marginbokser. Virker i Firefox og
// nyere Chrome; Safari ignorerer reglene stille, og da står heftet uten.
// JSON.stringify gir en gyldig CSS-streng (anførselstegn og skråstrek
// escapes; tittelen er alt renset for linjeskift).
function settSidestil(t) {
  let st = $("utskrift-sidestil");
  if (!st) {
    st = document.createElement("style");
    st.id = "utskrift-sidestil";
    document.head.append(st);
  }
  const font = "font: 7.5pt Inter, system-ui, sans-serif; color: #7d9885;";
  st.textContent = `@page { @top-left { content: ${JSON.stringify(`Populærmusikkhistorie · ${t}`)}; ${font} }`
    + ` @bottom-left { content: "historieappen.no"; ${font} } @bottom-right { content: counter(page); ${font} } }\n`
    + `@page :first { @top-left { content: none; } }`;
}

// Sideanslaget: { sider, start } der start er Map fra seksjonsnøkkel
// (data-toc) til første side, eller null på smal skjerm (bryter ikke som
// papiret). Seksjonene som starter på ny side (css/utskrift.css) åpner hver
// sin gruppe; lyttelista og kolofonen flyter inn i gruppa foran. Et lite
// hefte (h-forside-liten) har ingen sideskift etter forsiden, så den første
// seksjonen etter den hører til samme gruppe.
function sideanslag() {
  const el = $("hefte");
  if (!el) return null;
  const mm = 96 / 25.4;
  if (el.clientWidth < 170 * mm) return null;
  const perSide = 263 * mm;
  const start = new Map();
  let total = 0;
  let gruppe = null;
  let gruppeStart = 1;
  let litenForsideForan = false;
  const lukk = () => { if (gruppe) total += Math.max(1, Math.ceil(gruppe.h / perSide)); gruppe = null; };
  el.querySelectorAll(":scope > section, :scope > footer").forEach((s) => {
    const c = s.classList;
    const bryter = c.contains("h-familie") || c.contains("h-nyside") || c.contains("h-forside") || c.contains("h-innhold");
    if (!gruppe || (bryter && !litenForsideForan)) {
      lukk();
      gruppe = { h: 0 };
      gruppeStart = total + 1;
    }
    const nokkel = s.dataset.toc;
    if (nokkel && !start.has(nokkel)) start.set(nokkel, gruppeStart + Math.floor(gruppe.h / perSide));
    gruppe.h += s.offsetHeight;
    litenForsideForan = c.contains("h-forside-liten");
    if ((c.contains("h-forside") && !litenForsideForan) || c.contains("h-innhold")) lukk();   // break-after: page
  });
  lukk();
  return { sider: total, start };
}

function tegnHefte(u) {
  const el = $("hefte");
  if (!el) return;
  el.classList.toggle("kompakt", !!u.form.kompakt);
  if (!klar()) {
    el.innerHTML = `<p class="muted hefte-melding">Laster innholdet …</p>`;
    return;
  }
  if (modell.tom) {
    el.innerHTML = `<div class="hefte-tom">
      <h2>Heftet er tomt</h2>
      <p>${u.valg.length
        ? "Alt i utvalget er huket bort. Huk på det du vil ha med, eller søk etter mer i panelet over."
        : "Legg til det du vil ha med. Søk i panelet over, eller åpne et kort i appen og trykk skriverikonet i tittellinja. Alt du velger, samles her, i den rekkefølgen pensumet er bygd opp."}</p>
      <p><a class="btn ghost small" href="index.html">Til startsiden</a></p>
    </div>`;
    document.title = "Utskrift – Pensumforslag";
    return;
  }
  const t = tittelNaa();
  tittelVist = t;
  const d = modell.deler;
  const kompakt = !!u.form.kompakt;
  const medNr = modell.lytteliste.length > 0;
  const farge = modell.familier.find((F) => !F.pseudo)?.farge || "#16a34a";
  el.innerHTML = [
    forsideHtml(t, farge),
    tidslinjeSideHtml(),
    ...modell.familier.map((F) => familieHtml(F, d, kompakt, medNr)),
    bakteppeHtml(d),
    innovasjonerHtml(d, kompakt),
    instrumenterHtml(),
    siderHtml(),
    lyttelisteHtml(),
    kolofonHtml(),
  ].join("");
  settSidestil(t);
  document.title = `${t} – Utskrift`;
  const anslag = sideanslag();
  fyllSidetall(anslag);
  const sider = anslag?.sider || null;
  const status = $("utskrift-status");
  if (status) status.textContent = statusTekst(sider);
  const knapp = $("utskrift-skriv-ut");
  if (knapp) knapp.textContent = sider ? `Lagre som PDF · ca. ${sider} ${sider === 1 ? "side" : "sider"}` : "Lagre som PDF";
}

// ----------------------------------------------------------------------------
//  Handlinger
// ----------------------------------------------------------------------------

// Bildene må være lastet før dialogen åpnes, ellers står det tomme rammer i
// PDF-en. Åtte sekunder er taket: et bilde som henger, skal ikke stoppe
// utskriften.
async function skrivUt() {
  const knapp = $("utskrift-skriv-ut");
  const bilder = [...document.querySelectorAll("#hefte img")].filter((i) => !i.complete);
  if (bilder.length && knapp) {
    knapp.disabled = true;
    knapp.textContent = `Venter på ${bilder.length} ${bilder.length === 1 ? "bilde" : "bilder"} …`;
  }
  const ventet = Promise.all(bilder.map((i) => new Promise((r) => {
    i.addEventListener("load", r, { once: true });
    i.addEventListener("error", r, { once: true });
  })));
  await Promise.race([ventet, new Promise((r) => setTimeout(r, 8000))]);
  if (knapp) knapp.disabled = false;
  tegnHefte(lesUtvalg());   // knappeteksten (sideanslaget) tilbake
  window.print();
}

async function toemUtvalget() {
  const u = lesUtvalg();
  if (!u.valg.length) return;
  const ok = await askChoice({
    title: "Tømme utskriften?",
    text: `${u.valg.length} kort tas ut av utskriften. Tittelen og valgene dine nullstilles også.`,
    buttons: [{ label: "Tøm", value: true, className: "primary" }, { label: "Avbryt", value: false }],
    dismissValue: false,
  });
  if (ok) toem();
}

function koble() {
  $("utskrift-skriv-ut")?.addEventListener("click", skrivUt);
  // Miniatyren feilet (se bildeHtml): bytt til originalen, én gang.
  $("hefte")?.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.full) return;
    const full = img.dataset.full;
    delete img.dataset.full;
    img.src = full;
  }, true);
  $("utskrift-toem")?.addEventListener("click", toemUtvalget);

  $("utskrift-liste")?.addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-huk]");
    if (!inp) return;
    huk(inp.dataset.huk, inp.checked, { eksplisitt: inp.dataset.eksplisitt === "1" });
  });

  $("utskrift-deler")?.addEventListener("change", (e) => {
    const inp = e.target.closest("[data-del]");
    if (!inp) return;
    const u = lesUtvalg();
    u.deler[inp.dataset.del] = !!inp.checked;
    lagreUtvalg(u);
  });

  document.querySelectorAll('input[name="utskrift-form"]').forEach((r) => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      const u = lesUtvalg();
      u.form.kompakt = r.value === "kompakt";
      lagreUtvalg(u);
    });
  });

  $("utskrift-rekkefolge")?.addEventListener("change", (e) => {
    const u = lesUtvalg();
    u.form.rekkefolge = e.target.value === "valgt" ? "valgt" : "kronologisk";
    lagreUtvalg(u);
  });

  const tittel = $("utskrift-tittel");
  if (tittel) {
    tittel.maxLength = TITTEL_MAKS;
    let venter = null;
    tittel.addEventListener("input", () => {
      clearTimeout(venter);
      venter = setTimeout(() => {
        const u = lesUtvalg();
        const ny = normaliserTittel(tittel.value);
        if (ny === u.tittel) return;
        u.tittel = ny;
        lagreUtvalg(u);
      }, 300);
    });
  }

  const sokFelt = $("utskrift-sok");
  if (sokFelt) {
    let venter = null;
    sokFelt.addEventListener("input", () => { clearTimeout(venter); venter = setTimeout(tegnSok, 130); });
    sokFelt.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(venter); tegnSok(); } });
  }
  $("utskrift-sok-treff")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-legg]");
    if (!b || b.disabled) return;
    leggTil(b.dataset.legg);
    tegnSok();
  });

  // «Velg alt» (v5.64): hele pensumet legges til det som alt står der;
  // tittelen settes bare når feltet er tomt. Dialogen sier hvor langt heftet
  // blir (v5.74): et grovt anslag fra tellingene, før noe er tegnet.
  $("utskrift-alt")?.addEventListener("click", async () => {
    if (!klar()) return;
    const alt = heltPensum(state);
    const u0 = lesUtvalg();
    const hele = settSammen({ valg: [...u0.valg, ...alt], fravalg: u0.fravalg }, state, {
      deler: u0.deler, form: u0.form, erLaerer,
      skjul: SKJUL_I_STUDENTVISNING, skjulHub: SKJUL_I_HUBEN, punkterSkjult: PUNKTER_BARE_I_PRESENTASJON,
    });
    const sider = anslagSider(hele.tellinger);
    const ok = await askChoice({
      title: "Velg alt",
      text: `Hele pensumet blir et hefte på cirka ${sider} sider (${tellingerTekst(hele.tellinger)}). Vil du heller velge én metasjanger om gangen, står de som knapper over lista.`,
      buttons: [{ label: "Legg til alt likevel", value: true, className: "primary" }, { label: "Avbryt", value: false }],
      dismissValue: false,
    });
    if (!ok) return;
    leggTil(alt);
    const u = lesUtvalg();
    if (!u.tittel) { u.tittel = "Hele pensumet"; lagreUtvalg(u); }
  });

  // Hurtigvalg for hele metasjangre (v5.74).
  $("utskrift-metaer")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-meta]");
    if (!b) return;
    leggTil(`${META_PREFIKS}${b.dataset.meta}`);
  });

  // Sammenleggbare sjangergrupper (v5.74): valget huskes for økta.
  $("utskrift-liste")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fold]");
    if (!b) return;
    const vis = b.dataset.fold;
    const li = b.closest(".ut-sj");
    const apen = b.getAttribute("aria-expanded") === "true";
    foldValg.set(vis, !apen);
    b.setAttribute("aria-expanded", apen ? "false" : "true");
    b.title = apen ? "Vis artistene" : "Skjul artistene";
    li?.classList.toggle("ut-lukket", apen);
    const ul = li?.querySelector(":scope > ul");
    if (ul) ul.hidden = apen;
  });

  // «Ta ut artister uten lytteeksempel/bilde» (v5.74): én lagring for alle.
  $("utskrift-hurtig")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-hurtig]");
    if (!b) return;
    hukFlere(artisterUten(b.dataset.hurtig), false);
  });

  // «Send til en annen enhet» (v5.74): lenka med utvalget på utklippstavla.
  $("utskrift-del-kopier")?.addEventListener("click", async () => {
    const lenke = delLenke(lesUtvalg());
    const msg = $("utskrift-del-msg");
    try {
      await kopierTilUtklipp(lenke);
      if (msg) msg.textContent = "Lenke kopiert.";
    } catch (e) {
      window.prompt("Kopier lenken:", lenke);
      if (msg) msg.textContent = "";
    }
    setTimeout(() => { if (msg) msg.textContent = ""; }, 3000);
  });

  // «Lag kjøreplan av utvalget» (v5.74, lærer): heftets kort blir stopp i
  // heftets rekkefølge, som en ny plan under Visning.
  $("utskrift-plan")?.addEventListener("click", async () => {
    if (!erLaerer || !modell || modell.tom) return;
    const stopp = planFraModell(modell);
    if (!stopp.length) return;
    if (!state.contentLoaded) { melding("Kjøreplanene er ikke lastet ennå. Vent litt og prøv igjen.", false); return; }
    const tittel = tittelNaa();
    const ok = await askChoice({
      title: "Lag kjøreplan av utvalget",
      text: `«${tittel}» får ${stopp.length} stopp i heftets rekkefølge. Du finner den under Visning etterpå, og kan endre den der.`,
      buttons: [{ label: "Lag kjøreplanen", value: true, className: "primary" }, { label: "Avbryt", value: false }],
      dismissValue: false,
    });
    if (!ok) return;
    try {
      await savePlan(nyPlanId(), { tittel, laget: new Date().toISOString(), stopp });
      melding(`Kjøreplanen «${tittel}» er lagret. Åpne Visning (ikonet i toppmenyen) for å spille den.`);
    } catch (e) {
      melding(`Kjøreplanen ble ikke lagret (${e?.message || e}). Er du logget inn som lærer i denne nettleseren?`, false);
    }
  });
}

function init() {
  // MIDLERTIDIG (js/feature-flags.js, utskrift): skjult for studentrollen
  // inntil videre. Siden abonnerer da ikke på noe (null lesinger), og sier
  // hvorfor den er tom i stedet for å vise et halvt panel.
  if (SKJUL_I_STUDENTVISNING.utskrift && document.body.classList.contains("role-student")) {
    const panel = $("utskrift-panel");
    if (panel) panel.hidden = true;
    const hefte = $("hefte");
    if (hefte) {
      hefte.innerHTML = `<div class="hefte-tom">
        <h2>Utskriften er ikke åpnet ennå</h2>
        <p>Læreren slår på utskriften når innholdet er klart. Alt annet i appen virker som før.</p>
        <p><a class="btn ghost small" href="index.html">Til startsiden</a></p>
      </div>`;
    }
    return;
  }
  // Et utvalg sendt fra en annen enhet (v5.74) skrives inn før noe tegnes.
  lesUtvalgFraUrl();
  initUtskriftValg({ hentData: () => state });
  koble();
  document.addEventListener(UTSKRIFT_HENDELSE, planleggTegning);
  onGenreModelChanged(planleggTegning);
  planleggTegning();

  // Vent på klassekoden (js/gate.js) før noe hentes; uten gate.js går
  // Promise.resolve(undefined) rett videre, så sperren feiler åpent.
  Promise.resolve(window.__pensumGate?.klar).then(async () => {
    if (!CONFIGURED) { showSetupBanner(); return; }
    wireFirestoreErrorBanner();
    onAuthChange((user) => {
      // Samme regel som erLaererBruker i plan-meny.js (se toppen av fila).
      const ny = !!user && !user.isAnonymous && TEACHER_EMAILS.includes(user.email);
      if (ny === erLaerer) return;
      erLaerer = ny;
      state.isTeacher = ny;
      planleggTegning();
    });
    subscribeSharedData(state, {
      onArtists: planleggTegning,
      onGenreDescs: planleggTegning,
      onContent: planleggTegning,
      onDecades: planleggTegning,
      onTech: planleggTegning,
      // Koblingstekstene (v5.74) bor i sin egen samling.
      onEdgeDescs: planleggTegning,
    });
  });
}

init();
