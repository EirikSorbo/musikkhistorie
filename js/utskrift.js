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
//  Utvalget bor i localStorage (js/utskrift-utvalg.js). En lenke med ?u=
//  (én per mål), ?tittel= og ?r=valgt åpner et delt utvalg: er studentens
//  eget utvalg tomt, tas lenkens i bruk; ellers spørres det.
//
//  Siden laster ikke utforsk-laget (ingen modaler, ingen kort å åpne), så
//  lærerregelen fra plan-meny.js står også her: den modulen drar inn hele
//  laget via explore-context.
// ============================================================================

import { sharedStateDefaults, subscribeSharedData } from "./shared-data.js?v=5.60";
import { CONFIGURED, showSetupBanner, wireFirestoreErrorBanner } from "./shared.js?v=5.60";
import { onAuthChange } from "./store.js?v=5.60";
import { TEACHER_EMAILS } from "./firebase-config.js?v=5.60";
import { SKJUL_I_STUDENTVISNING, SKJUL_I_HUBEN, PUNKTER_BARE_I_PRESENTASJON } from "./feature-flags.js?v=5.60";
import { settSammen, foreslaaTittel, tellingerTekst, DELER, TYPE_ETIKETT, META_PREFIKS, normaliserUtvalg, normaliserTittel, kanoniskVis, TITTEL_MAKS } from "./utskrift-modell.js?v=5.60";
import { lesUtvalg, lagreUtvalg, leggTil, huk, toem, initUtskriftValg, UTSKRIFT_HENDELSE } from "./utskrift-utvalg.js?v=5.60";
import { byggIndeks, sok, normaliser, TYPE_LABEL } from "./search.js?v=5.60";
import { byggVisVerdi } from "./vis-lenke.js?v=5.60";
import { renderRichText, renderInline } from "./rich-text.js?v=5.60";
import { formatInfoText, musicExampleLabel } from "./ui-helpers.js?v=5.60";
import { escapeHtml, wikimediaThumb } from "./util.js?v=5.60";
import { heatColor, HEAT_NODATA } from "./heat-strip.js?v=5.60";
import { artistStripHtml } from "./artist-strip.js?v=5.60";
import { DECADES, isVisible } from "./limits.js?v=5.60";
import { askChoice } from "./ui-modal.js?v=5.60";
import { onGenreModelChanged, GENEALOGY, META_GENRE_ORDER } from "./genre-model.js?v=5.60";

const state = { ...sharedStateDefaults(), isTeacher: false };
let erLaerer = false;
let modell = null;
let tittelForslag = "Pensumutdrag";
let tegnPlanlagt = false;

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
    const sjangre = F.sjangre.map((k) =>
      `<li class="ut-sj${k.med ? "" : " ut-av"}"><label><input type="checkbox" data-huk="${h(k.vis)}"${k.med ? " checked" : ""}> ` +
      `<span class="ut-navn">${h(k.navn)}</span> <span class="muted">${h(["sjanger", F.valgt && k.kilde === "metasjanger" ? "" : OPPHAV[k.kilde]].filter(Boolean).join(" · "))}</span></label>` +
      `${k.artister.length ? `<ul>${k.artister.map((a) => hukRad(a, "ut-art", "", F.valgt)).join("")}</ul>` : ""}</li>`);
    const lose = F.lose.length ? `<li class="ut-lose"><ul>${F.lose.map((a) => hukRad(a, "ut-art", "", F.valgt)).join("")}</ul></li>` : "";
    return `<li class="ut-fam">${hode}<ul>${sjangre.join("")}${lose}</ul></li>`;
  });
  const grunnlag = tre.grunnlag === "artister" ? "utledet av artistenes innflytelsesperioder"
    : tre.grunnlag === "sjangre" ? "utledet av sjangrenes perioder" : "";
  const tiaar = tre.tiaar.length
    ? `<li class="ut-gruppe"><span class="ut-fam-navn"><b>Tiår</b>${grunnlag ? ` <span class="muted">${h(grunnlag)}</span>` : ""}</span>` +
      `<ul class="ut-rad">${tre.tiaar.map((x) => hukRad({ ...x, navn: `${x.tiaar}-tallet`, kilde: x.kilde === "valgt" ? "" : x.kilde }, "ut-tiaar", "")).join("")}</ul></li>`
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

function tegnPanel(u) {
  const status = $("utskrift-status");
  if (status) status.textContent = statusTekst(null);
  const antallEl = $("utskrift-antall-tekst");
  if (antallEl) antallEl.textContent = u.valg.length ? `(${u.valg.length} valgt)` : "";

  const liste = $("utskrift-liste");
  if (liste) {
    liste.innerHTML = u.valg.length
      ? treHtml(modell.tre)
      : `<li class="muted utskrift-tom-liste">Ingenting valgt ennå.</li>`;
  }

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
  knapp("utskrift-lenke", u.valg.length === 0);
  knapp("utskrift-toem", u.valg.length === 0);
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
// bærer originalen, og feillytteren under bytter til den.
function bildeHtml(bilde, hoyde = "") {
  if (!bilde) return "";
  const thumb = wikimediaThumb(bilde.url, 500);
  const src = thumb || bilde.url;
  return `<figure class="h-bilde"><img src="${h(src)}" alt="" decoding="async"${thumb ? ` data-full="${h(bilde.url)}"` : ""}${hoyde ? ` style="height:${hoyde}"` : ""}>` +
    `${bilde.kreditt ? `<figcaption>Foto: ${h(bilde.kreditt)}</figcaption>` : ""}</figure>`;
}

function lyttHtml(liste, medNr) {
  if (!liste.length) {
    return `<div class="h-lytt h-lytt-tom">${NOTE_SVG}<span>Kortet har ingen lytteeksempler ennå. Søk på artist og tittel fra «Sentrale verk».</span></div>`;
  }
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

function artistKortHtml(k, d, kompakt, medNr) {
  const fakta = [];
  if (k.fakta.instrument) fakta.push(`<b>${h(k.fakta.instrument)}</b>`);
  for (const x of [k.fakta.virkested, k.fakta.plateselskap]) if (x) fakta.push(h(x));
  if (k.fakta.innflytelse) fakta.push(`Innflytelse ${h(k.fakta.innflytelse)}`);
  for (const x of [...k.fakta.sjangre, ...k.fakta.undersjangre]) if (x) fakta.push(h(x));
  const bilde = !kompakt && d["artist.bilde"] ? bildeHtml(k.bilde) : "";
  const beskrivelse = d["artist.beskrivelse"]
    ? (k.beskrivelse ? rt(k.beskrivelse) : mangler("Beskrivelsen er ikke skrevet ennå."))
    : "";
  const verk = d["artist.verk"] && k.verk.length
    ? `<p class="h-verk"><strong>Sentrale verk</strong> ${k.verk.map((w) => `«${h(w.tittel)}»${w.aar ? ` (${w.aar})` : ""}`).join(" · ")}</p>`
    : "";
  return `<article class="h-kort h-artist">
    <h3 class="h-kort-navn">${h(k.navn)}${k.levetid ? ` <span class="h-aar">${h(k.levetid)}</span>` : ""}</h3>
    ${d["artist.fakta"] && fakta.length ? `<p class="h-fakta">${fakta.join(" · ")}</p>` : ""}
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

function sjangerKroppHtml(k, d, kompakt, medNr) {
  const beskrivelse = d["sjanger.beskrivelse"]
    ? (k.beskrivelse ? rt(k.beskrivelse) : mangler("Beskrivelsen er ikke skrevet ennå."))
    : "";
  const hor = k.lytt.length
    ? `<div class="h-hor-etter"><strong>Hør etter</strong><ul>${k.lytt.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>`
    : "";
  return `${d["sjanger.punkter"] ? punkterHtml(k.punkter) : ""}${beskrivelse}${hor}
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

function familieHtml(F, d, kompakt, medNr) {
  if (F.pseudo) {
    return `<section class="h-familie" style="--farge:${h(F.farge)}">
      <header class="h-familie-hode"><p class="h-overlinje">Undersjangre</p><h1>Undersjangre</h1></header>
      ${ordlisteHtml(F.ordliste, "Undersjangre i utvalget")}
    </section>`;
  }
  const hode = F.hodeKort;
  const harKort = !!hode || F.sjangre.length > 0;
  return `<section class="h-familie" style="--farge:${h(F.farge)}">
    <header class="h-familie-hode">
      <p class="h-overlinje">${hode ? "Metasjanger og sjanger" : "Metasjanger"}</p>
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
  const rader = t.rader.map((r) => `<div class="h-tl-navn${r.type === "sjanger" ? " sj" : ""}">${h(r.navn)}</div>` +
    `<div class="h-tl-spor" style="background-size:${tiaarBredde.toFixed(3)}% 100%">` +
    `<i class="h-tl-stolpe ${r.type}${r.apen ? " apen" : ""}" style="left:${pct(r.fra).toFixed(2)}%;width:${Math.max(0.7, pct(r.til) - pct(r.fra)).toFixed(2)}%;background:${h(r.farge)}"></i></div>`);
  return `<div class="h-tidslinje">
    <h2>Tidslinje over utvalget</h2>
    <p class="h-hint">Sjangrene som brede stolper, artistene som streker. Årstallene er innflytelsesperiodene fra kortene; uten sluttår betyr fortsatt aktiv.</p>
    <div class="h-tl">
      <div class="h-tl-akse">${t.ticks.map((x) => `<span style="left:${pct(x).toFixed(2)}%">${x}</span>`).join("")}</div>
      ${rader.join("")}
    </div>
  </div>`;
}

function forsideHtml(t, farge) {
  const tips = [];
  tips.push(modell.form.rekkefolge === "valgt"
    ? "Kortene står i den rekkefølgen de ble valgt, slik kjøreplanen er lagt opp."
    : "Sjangrene står i den rekkefølgen de oppsto. Artistene står under sjangeren sin, i kronologisk rekkefølge etter når innflytelsen begynte.");
  if (modell.bakteppe.length || modell.innovasjoner.length || modell.instrumenter.length) {
    tips.push("Tiårene, innovasjonene og instrumentene står som et eget bakteppe etter sjangrene.");
  }
  if (modell.lytteliste.length) tips.push("Lytteeksemplene har et nummer i teksten. Lenkene står samlet i lyttelista bakerst.");
  tips.push("Tekstene er hentet fra appen den dagen heftet ble laget, og kan være oppdatert siden.");
  return `<section class="h-forside">
    <div class="h-merke"><img src="img/header-icon.png" alt=""><span>historieappen.no · Populærmusikkhistorie</span></div>
    <div class="h-tittelblokk" style="--farge:${h(farge)}">
      <p class="h-overlinje">Pensumutdrag · MUR114</p>
      <h1 class="h-tittel">${h(t)}</h1>
      <p class="h-under">Populærmusikkhistorie</p>
      <p class="h-meta">Laget <strong>${h(datoTekst())}</strong><br>Utvalg: <strong>${h(tellingerTekst(modell.tellinger))}</strong></p>
    </div>
    <div class="h-lesetips"><h3>Slik er heftet bygd opp</h3><ol>${tips.map((x) => `<li>${h(x)}</li>`).join("")}</ol></div>
  </section>`;
}

function innholdHtml() {
  const punkter = [];
  const navnAv = (liste) => liste.map((a) => a.navn);
  for (const F of modell.familier) {
    const linjer = [];
    if (F.hodeKort?.artister.length) linjer.push(kortListe(navnAv(F.hodeKort.artister)));
    for (const k of F.sjangre) linjer.push(`${k.navn}${k.artister.length ? `: ${kortListe(navnAv(k.artister))}` : ""}`);
    if (F.loseArtister.length) linjer.push(kortListe(navnAv(F.loseArtister)));
    punkter.push({ navn: F.navn, linjer });
  }
  if (modell.bakteppe.length) punkter.push({ navn: "Bakteppe", linjer: [modell.bakteppe.map((b) => `${b.tiaar}-tallet`).join(" · ")] });
  if (modell.innovasjoner.length) punkter.push({ navn: "Innovasjoner", linjer: [kortListe(modell.innovasjoner.map((t) => t.navn))] });
  if (modell.instrumenter.length) punkter.push({ navn: "Instrumenter", linjer: [kortListe(modell.instrumenter.map((i) => i.tittel))] });
  for (const s of modell.sider) punkter.push({ navn: s.tittel, linjer: [] });
  if (modell.lytteliste.length) punkter.push({ navn: "Lytteliste", linjer: [] });
  return `<section class="h-innhold">
    <h1>Innhold</h1>
    <ul class="h-toc">${punkter.map((p) => `<li><span class="h-toc-navn">${h(p.navn)}</span>${p.linjer.map((l) => `<span class="h-toc-under">${h(l)}</span>`).join("")}</li>`).join("")}</ul>
    ${modell.tidslinje ? tidslinjeHtml(modell.tidslinje) : ""}
  </section>`;
}

function seksjonHode(overlinje, tittel) {
  return `<header class="h-seksjon-hode"><p class="h-overlinje">${h(overlinje)}</p><h1>${h(tittel)}</h1></header>`;
}

function bakteppeHtml(d) {
  if (!modell.bakteppe.length) return "";
  const tekst = (t) => (t ? `<div class="rt">${formatInfoText(t, {})}</div>` : mangler("Teksten er ikke skrevet ennå."));
  const tiaar = modell.bakteppe.map((b) => `<article class="h-tiaar">
    <header class="h-sjanger-hode"><h2>${b.tiaar}-tallet</h2>
      ${b.artister.length ? `<p class="h-epoke">I dette utvalget: ${b.artister.map(h).join(", ")}.</p>` : ""}</header>
    ${d["tiaar.samfunn"] ? `<h3 class="h-del">Samfunn</h3>${tekst(b.samfunn)}` : ""}
    ${d["tiaar.teknologi"] ? `<h3 class="h-del">Teknologi</h3>${tekst(b.teknologi)}` : ""}
    ${b.innovasjoner.length ? `<h3 class="h-del">Innovasjoner i tiåret</h3><p class="h-innov-liste">${b.innovasjoner.map((t) => `${h(t.navn)}${t.aar ? ` (${t.aar})` : ""}`).join(" · ")}</p>` : ""}
  </article>`);
  return `<section class="h-seksjon h-nyside h-bakteppe" style="--farge:#534ab7">${seksjonHode("Bakteppe", "Tiårene")}${tiaar.join("")}</section>`;
}

function techKortHtml(t, d, kompakt) {
  const aar = [t.oppfunnet ? `oppfunnet ${t.oppfunnet}` : "", t.iBruk ? `i bruk fra ${t.iBruk}` : ""].filter(Boolean).join(" · ");
  const fakta = [];
  if (t.hendelse) fakta.push("<b>Viktig hendelse</b>");
  else if (t.kategori) fakta.push(`<b>${h(t.kategori)}</b>`);
  if (t.instrument) fakta.push(h(t.instrument));
  if (t.iBrukTekst) fakta.push(h(t.iBrukTekst));
  const bilde = !kompakt && d["tech.bilde"] ? bildeHtml(t.bilde, "30mm") : "";
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
  return `<section class="h-seksjon h-nyside h-innovasjoner" style="--farge:#d97706">${seksjonHode("Innovasjoner", "Teknologien bak lyden")}${modell.innovasjoner.map((t) => techKortHtml(t, d, kompakt)).join("")}</section>`;
}

function instrumenterHtml() {
  if (!modell.instrumenter.length) return "";
  const deler = modell.instrumenter.map((i) => `<article class="h-instrument"><h2>${h(i.tittel)}</h2>${i.body.trim() ? rt(i.body) : mangler("Sammendraget er ikke skrevet ennå.")}</article>`);
  return `<section class="h-seksjon h-nyside h-instrumenter" style="--farge:#0f766e">${seksjonHode("Instrumenter", "Instrumentenes utvikling")}${deler.join("")}</section>`;
}

function siderHtml() {
  return modell.sider.map((s) => `<section class="h-seksjon h-nyside h-side" style="--farge:#7c3aed">${seksjonHode("Det store bildet", s.tittel)}${s.body.trim() ? rt(s.body) : mangler("Teksten er ikke skrevet ennå.")}</section>`).join("");
}

function lyttelisteHtml() {
  if (!modell.lytteliste.length) return "";
  const rader = modell.lytteliste.map((l) => `<div class="h-lytte-rad"><span class="h-nr">${l.nr}</span><span>${h(l.artist)}: «${h(l.label)}»${h(musicExampleLabel(l))}<span class="h-url">${h(kortUrl(l.url))}</span></span></div>`);
  return `<section class="h-seksjon h-lytteliste">${seksjonHode("Bakerst", "Lytteliste")}
    <p class="h-ingress">Numrene viser til «Lytt»-boksene i heftet. Lenkene er de samme som i appen. Er en lenke død, søk på artist og tittel.</p>
    <div class="h-liste-2sp">${rader.join("")}</div>
  </section>`;
}

function kolofonHtml() {
  return `<footer class="h-kolofon">Laget med utskriftsfunksjonen i historieappen.no, ${h(datoTekst())}. Tekstene er lærerens pensumtekster slik de sto i appen den dagen; kildene til hvert kort står i appen. Bildene er fra Wikimedia Commons og Wikipedia, med kreditering under hvert bilde.${erLaerer ? "" : " Bare innhold som er synlig for studenter, er tatt med."}</footer>`;
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

function sideanslag() {
  const el = $("hefte");
  if (!el) return null;
  const mm = 96 / 25.4;
  // A4 minus margene i css/utskrift.css. Smal skjerm bryter ikke som papiret.
  if (el.clientWidth < 170 * mm) return null;
  const perSide = 263 * mm;
  // Seksjonene som starter på ny side (css/utskrift.css) åpner hver sin
  // gruppe; lyttelista, kildene og kolofonen flyter inn i gruppa foran.
  const grupper = [];
  let gruppe = null;
  el.querySelectorAll(":scope > section, :scope > footer").forEach((s) => {
    const c = s.classList;
    if (!gruppe || c.contains("h-familie") || c.contains("h-nyside") || c.contains("h-forside") || c.contains("h-innhold")) {
      gruppe = { h: 0 };
      grupper.push(gruppe);
    }
    gruppe.h += s.offsetHeight;
    if (c.contains("h-forside") || c.contains("h-innhold")) gruppe = null;   // break-after: page
  });
  return grupper.reduce((n, g) => n + Math.max(1, Math.ceil(g.h / perSide)), 0);
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
  const d = modell.deler;
  const kompakt = !!u.form.kompakt;
  const medNr = modell.lytteliste.length > 0;
  const farge = modell.familier.find((F) => !F.pseudo)?.farge || "#16a34a";
  el.innerHTML = [
    forsideHtml(t, farge),
    innholdHtml(),
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
  const sider = sideanslag();
  const status = $("utskrift-status");
  if (status) status.textContent = statusTekst(sider);
  const knapp = $("utskrift-skriv-ut");
  if (knapp) knapp.textContent = sider ? `Skriv ut / lagre som PDF · ca. ${sider} ${sider === 1 ? "side" : "sider"}` : "Skriv ut / lagre som PDF";
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

async function kopierLenke() {
  const u = lesUtvalg();
  const url = new URL("utskrift.html", window.location.href);
  for (const v of u.valg) url.searchParams.append("u", v);
  for (const v of u.fravalg) url.searchParams.append("x", v);
  if (u.tittel) url.searchParams.set("tittel", u.tittel);
  if (u.form.rekkefolge === "valgt") url.searchParams.set("r", "valgt");
  const b = $("utskrift-lenke");
  try {
    await navigator.clipboard.writeText(url.href);
    if (b) {
      b.textContent = "Lenke kopiert";
      setTimeout(() => { b.textContent = "Kopier lenke"; }, 1400);
    }
  } catch (e) {
    window.prompt("Kopier lenken:", url.href);
  }
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

// Et delt utvalg i adressen (?u=… fra «Kopier lenke»). Adressen ryddes
// etterpå, så en omlasting ikke spør igjen.
async function lesLenke() {
  let params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
  const fraUrl = normaliserUtvalg(params.getAll("u"));
  if (!fraUrl.length) return;
  const fravalgUrl = normaliserUtvalg(params.getAll("x"));
  const tittelUrl = normaliserTittel(params.get("tittel") || "");
  const somValgt = params.get("r") === "valgt";
  const u = lesUtvalg();
  const likt = u.valg.length === fraUrl.length && u.valg.every((v, i) => v === fraUrl[i]);
  let valg = "erstatt";
  if (u.valg.length && !likt) {
    valg = await askChoice({
      title: "Lenken har sitt eget utvalg",
      text: `Lenken inneholder ${fraUrl.length} kort. Du har ${u.valg.length} kort i utskriften fra før.`,
      buttons: [
        { label: "Bruk lenkens utvalg", value: "erstatt", className: "primary" },
        { label: "Legg til i mitt", value: "legg" },
        { label: "Behold mitt", value: "behold" },
      ],
      dismissValue: "behold",
    });
  }
  if (valg === "erstatt") {
    u.valg = fraUrl;
    u.fravalg = fravalgUrl;
    u.plan = null;
    if (tittelUrl) u.tittel = tittelUrl;
    u.form.rekkefolge = somValgt ? "valgt" : "kronologisk";
    lagreUtvalg(u);
  } else if (valg === "legg") {
    u.valg = normaliserUtvalg([...u.valg, ...fraUrl]);
    u.fravalg = [...u.fravalg, ...fravalgUrl];
    lagreUtvalg(u);
  }
  try { window.history.replaceState(null, "", window.location.pathname); } catch (e) { /* uvesentlig */ }
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
  $("utskrift-lenke")?.addEventListener("click", kopierLenke);
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
  initUtskriftValg({ hentData: () => state });
  koble();
  document.addEventListener(UTSKRIFT_HENDELSE, planleggTegning);
  onGenreModelChanged(planleggTegning);
  planleggTegning();

  // Vent på klassekoden (js/gate.js) før noe hentes; uten gate.js går
  // Promise.resolve(undefined) rett videre, så sperren feiler åpent.
  Promise.resolve(window.__pensumGate?.klar).then(async () => {
    await lesLenke();
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
    });
  });
}

init();
