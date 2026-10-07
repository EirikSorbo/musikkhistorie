// ============================================================================
//  LERRET PÅ ANNEN SKJERM (v6.50, brukerbestilling 2026-10-07)
// ----------------------------------------------------------------------------
//  Foran klassen vil læreren klikke på sin egen maskin og ha et lerret på
//  prosjektoren som viser det samme, uten verktøylinje og uten de private
//  notatene. Skjermen må være utvidet, ikke speilet: lerretet er et eget
//  vindu i samme nettleser («Åpne lerret på annen skjerm» i verktøylinja),
//  og de to vinduene snakker over en BroadcastChannel. Ingenting går via
//  Firestore (hvert tastetrykk ville kostet lesinger for alle studentene).
//
//  Styringen (lærerens vindu) sender tilstanden når noe endres:
//   - kortstabelen nederst først: kort med mål (data-vis) åpner lerretet selv
//     med de vanlige åpnerne, kort uten mål (søket, artistlistene,
//     kjøreplanens oversikt) vises som en kopi av HTML-en. Lærerens egne
//     verktøy (LERRET_PRIVAT) og dialogene sendes aldri.
//   - detaljnivå, unntak, tekststørrelse, QA-bryteren og svart skjerm
//   - rullingen, og lytteeksempelets pause, avspilling og spoling
//  Lerretet følger etter og sender tastene som trykkes der, videre til
//  styringen (en klikker sender til vinduet som har fokus). Bare F er
//  lerretets egen: fullskjerm krever et trykk i det vinduet.
//
//  Lyden kommer fra lerretet; styringen spiller dempet når et lerret er
//  koblet til (settYtDempet). Avgjørelsene uten DOM (avstemmingen, tastene,
//  videoen) er rene funksjoner i presentasjon-modell.js og testes der.
// ============================================================================

import { LERRET_KANAL, LERRET_PRIVAT, lerretAvstem, lerretTast, ytFolg, ytWatchUrl } from "./presentasjon-modell.js";
import { parseVisVerdi, byggVisVerdi } from "../felles/vis-lenke.js";
import { modalOpen, modalClose } from "../ui/ui-modal.js";
import { apneVisNaarKlart } from "../utforsk/explore-apne.js";
import { apneYtSpiller, ytNaa, ytStatus, ytStyr, settYtDempet } from "../ui/yt-spiller.js";

const ROLLE = "pensumPresRolle";
const les = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const skriv = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };

// «lerret», «styring» eller null. ?lerret i adressen gjør vinduet til lerret
// (sessionStorage er kopiert fra lærerens vindu og sier ellers «styring»).
export function lerretRolle() {
  let param = null;
  try { param = new URLSearchParams(window.location.search).get("lerret"); } catch (e) {}
  if (param !== null) { skriv(ROLLE, "lerret"); return "lerret"; }
  const r = les(ROLLE);
  return r === "lerret" || r === "styring" ? r : null;
}

let rolle = null;
let kanal = null;
let api = {};

const zIndex = (m) => parseInt(m.style.zIndex) || 0;
const kanon = (vis) => byggVisVerdi(parseVisVerdi(vis) || {}) || vis;
const sideNavn = () => (/(^|\/)tre\.html$/.test(window.location.pathname) ? "tre" : "index");

function sideUrl(side) {
  let kode = null;
  try { kode = new URLSearchParams(window.location.search).get("kode"); } catch (e) {}
  return `${side === "tre" ? "tre.html" : "index.html"}?presentasjon&lerret=1${kode ? `&kode=${encodeURIComponent(kode)}` : ""}`;
}

// api: { tilstand() → { nivaa, unntak, skala, svart, qa }, bruk(t), status(paa), melding(tekst) }
export function startLerret(r, a = {}) {
  rolle = r;
  api = a;
  if (typeof BroadcastChannel === "undefined") return;
  if (rolle === "lerret") startLerretSide();
  else if (rolle === "styring") startStyring();
}

// ----------------------------------------------------------------------------
//  Styringen (lærerens vindu)
// ----------------------------------------------------------------------------

let tilkoblet = 0;   // sist livstegn fra lerretet (ms), 0 = ikke koblet til
let sistSendt = "";
let sendTimer = null;
let styringStartet = false;

export function lerretTilkoblet() { return rolle === "styring" && !!tilkoblet; }

// Knappen i verktøylinja: åpner lerretet, eller lukker det når det står åpent.
export function apneLerret() {
  if (rolle === "lerret") return;
  if (lerretTilkoblet()) { kanal?.postMessage({ t: "slutt" }); return; }
  skriv(ROLLE, "styring");
  rolle = "styring";
  startStyring();
  const vindu = window.open(sideUrl(sideNavn()), "pensum-lerret", "popup,width=1280,height=760");
  if (!vindu) api.melding?.("Nettleseren stoppet det nye vinduet. Tillat sprettoppvinduer for historieappen.no og trykk på knappen igjen.");
}

// Avslutt visningen: lerretet lukkes også, og vinduet er ikke styring lenger.
export function lerretSlutt() {
  if (rolle === "styring") kanal?.postMessage({ t: "slutt" });
  try { sessionStorage.removeItem(ROLLE); } catch (e) {}
}

// Kalles av presentasjonen når noe som ikke synes i DOM-en endres (nivå,
// unntak, tekststørrelsen på <html>).
export function lerretEndret() { if (rolle === "styring") planleggSending(); }

function settTilkoblet(paa) {
  const var_ = !!tilkoblet;
  tilkoblet = paa ? Date.now() : 0;
  if (var_ === !!paa) return;
  settYtDempet(!!paa);
  api.status?.(!!paa);
}

function startStyring() {
  if (styringStartet || typeof BroadcastChannel === "undefined") return;
  styringStartet = true;
  kanal = new BroadcastChannel(LERRET_KANAL);
  kanal.onmessage = (e) => {
    const d = e.data || {};
    if (d.t === "hei" || d.t === "lever") {
      settTilkoblet(true);
      if (d.t === "hei") { sistSendt = ""; sendTilstand(true); }
    } else if (d.t === "farvel") {
      settTilkoblet(false);
    } else if (d.t === "tast") {
      spillTast(d);
    }
  };
  // Borte uten farvel (krasj, maskinen sov): etter 12 s uten livstegn.
  setInterval(() => { if (tilkoblet && Date.now() - tilkoblet > 12000) settTilkoblet(false); }, 4000);
  new MutationObserver(planleggSending).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  // Skrevne verdier (søkefeltet) er ingen DOM-endring.
  document.addEventListener("input", planleggSending, true);
  document.addEventListener("scroll", paRull, true);
  setInterval(folgYt, 400);
  // Et lerret som alt står åpent (etter en omlasting her), melder seg.
  kanal.postMessage({ t: "styring" });
}

function planleggSending() {
  if (sendTimer || !tilkoblet) return;
  sendTimer = setTimeout(() => { sendTimer = null; sendTilstand(false); }, 80);
}

// Kopien av et kort uten mål. Feltenes verdier står ikke i HTML-en, så de
// skrives inn; iframer og skript tas ut.
function kopi(m) {
  const k = m.cloneNode(true);
  const orig = m.querySelectorAll("input, textarea, select");
  const kl = k.querySelectorAll("input, textarea, select");
  orig.forEach((el, i) => {
    const c = kl[i];
    if (!c) return;
    if (el.tagName === "TEXTAREA") c.textContent = el.value;
    else if (el.type === "checkbox" || el.type === "radio") c.toggleAttribute("checked", el.checked);
    else if (el.tagName !== "SELECT") c.setAttribute("value", el.value);
  });
  k.querySelectorAll("script, iframe").forEach((x) => x.remove());
  return k.innerHTML;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

const rensKlasser = (c) => String(c || "").split(/\s+/).filter((x) => x && !["open", "yt-uttoning", "modal-bytt"].includes(x)).join(" ");

function ytPost(m) {
  const yt = ytNaa();
  if (!yt) return null;
  return { vis: m.dataset.vis ? kanon(m.dataset.vis) : `yt-liste:${yt.list || ""}`, yt };
}

function byggTilstand() {
  const apne = [...document.querySelectorAll(".modal-backdrop.open")]
    .filter((m) => m.id && !LERRET_PRIVAT.has(m.id))
    .sort((a, b) => zIndex(a) - zIndex(b));
  const stabel = apne.map((m) => {
    if (m.id === "modal-yt") return ytPost(m);
    if (m.dataset.vis) return { vis: kanon(m.dataset.vis) };
    const html = kopi(m);
    return { id: m.id, cls: rensKlasser(m.className), html, hash: hash(html) };
  }).filter(Boolean);
  return { t: "tilstand", side: sideNavn(), stabel, ...(api.tilstand?.() || {}) };
}

let sistStabel = "";

function sendTilstand(tving) {
  if (!kanal || (!tilkoblet && !tving)) return;
  const t = byggTilstand();
  const s = JSON.stringify(t);
  if (s === sistSendt && !tving) return;
  sistSendt = s;
  kanal.postMessage(t);
  // Nytt kort øverst: send rullingen det står med (kortene ruller i .modal),
  // så lerretet ikke står igjen med posisjonen fra kortet før.
  const stabel = JSON.stringify(t.stabel);
  if (stabel !== sistStabel || tving) {
    sistStabel = stabel;
    const topp = [...document.querySelectorAll(".modal-backdrop.open")]
      .filter((m) => m.id && !LERRET_PRIVAT.has(m.id))
      .sort((a, b) => zIndex(a) - zIndex(b)).pop();
    const rulleflate = topp?.querySelector(".modal");
    if (rulleflate) setTimeout(() => sendRull(rulleflate), 120);
  }
}

// Rullingen: hvilket element (stien fra kortet) og hvor langt ned, som andel.
let rullTimer = null;
let rullEl = null;

function paRull(e) {
  if (!tilkoblet) return;
  const el = e.target === document ? document.scrollingElement : e.target;
  if (!(el instanceof Element) || el.closest("#pres-notater, #pres-bar")) return;
  rullEl = el;
  if (rullTimer) return;
  rullTimer = setTimeout(() => { rullTimer = null; sendRull(rullEl); }, 60);
}

function sendRull(el) {
  if (!el || !kanal) return;
  const maks = el.scrollHeight - el.clientHeight;
  const andel = maks > 0 ? el.scrollTop / maks : 0;
  if (el === document.scrollingElement || el === document.documentElement || el === document.body) {
    kanal.postMessage({ t: "rull", side: true, andel });
    return;
  }
  const bd = el.closest(".modal-backdrop");
  if (!bd?.id || LERRET_PRIVAT.has(bd.id)) return;
  const sti = [];
  for (let x = el; x && x !== bd; x = x.parentElement) sti.unshift([...x.parentElement.children].indexOf(x));
  kanal.postMessage({ t: "rull", id: bd.id, sti, andel });
}

// Lytteeksempelet: meld fra når det pauses, spilles eller spoles. Spoling
// sees som et hopp i tiden ut over det klokka tilsier.
let ytSist = null;
const ytKat = (t) => (t === 1 || t === 3 ? "spiller" : t === 2 ? "pause" : t === 0 ? "slutt" : "annet");

function folgYt() {
  if (!tilkoblet || !kanal) return;
  const s = ytNaa() ? ytStatus() : null;
  if (!s) { ytSist = null; return; }
  const naa = Date.now();
  let hopp = false;
  if (ytSist) {
    const forventet = ytKat(ytSist.tilstand) === "spiller" ? ytSist.tid + (naa - ytSist.ms) / 1000 : ytSist.tid;
    hopp = Math.abs(s.tid - forventet) > 2.5;
  }
  if (!ytSist || ytKat(s.tilstand) !== ytKat(ytSist.tilstand) || hopp) {
    kanal.postMessage({ t: "yt", tilstand: s.tilstand, tid: s.tid, spolt: hopp });
  }
  ytSist = { ...s, ms: naa };
}

// En tast trykket i lerretvinduet, spilt av her som om den ble trykket her.
function spillTast(d) {
  document.dispatchEvent(new KeyboardEvent("keydown", {
    key: String(d.key || ""), code: String(d.code || ""), shiftKey: !!d.shift, bubbles: true, cancelable: true,
  }));
}

// ----------------------------------------------------------------------------
//  Lerretet (prosjektoren)
// ----------------------------------------------------------------------------

let maal = null;          // siste tilstand fra styringen
let avstemTimer = null;
const forsok = new Map(); // mål → { n, ms }: et kort som ikke lar seg åpne, gis opp etter tre forsøk
const sisteRull = new Map();
let navigerer = false;

function startLerretSide() {
  document.body.classList.add("pres-lerret");
  kanal = new BroadcastChannel(LERRET_KANAL);
  kanal.onmessage = (e) => {
    const d = e.data || {};
    if (d.t === "tilstand") {
      if (JSON.stringify(d.stabel) !== JSON.stringify(maal?.stabel)) { forsok.clear(); sisteRull.clear(); }
      maal = d;
      brukTilstand(d);
    } else if (d.t === "rull") {
      sisteRull.set(d.side ? "" : d.id, d);
      brukRull(d);
    } else if (d.t === "yt") {
      ytStyr(ytFolg(d, ytStatus()));
    } else if (d.t === "styring") {
      kanal.postMessage({ t: "hei" });
    } else if (d.t === "slutt") {
      try { sessionStorage.clear(); } catch (err) {}
      window.close();
      // Lot ikke vinduet seg lukke (åpnet for hånd), går det til forsiden.
      setTimeout(() => { window.location.href = "index.html"; }, 400);
    }
  };
  kanal.postMessage({ t: "hei" });
  setInterval(() => kanal.postMessage({ t: "lever" }), 4000);
  window.addEventListener("pagehide", () => kanal.postMessage({ t: "farvel" }));
  // Tastene går til styringen, unntatt F (lerretets egen fullskjerm).
  window.addEventListener("keydown", (e) => {
    const h = lerretTast(e);
    if (h !== "send") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    kanal.postMessage({ t: "tast", key: e.key, code: e.code, shift: e.shiftKey });
  }, true);
}

function brukTilstand(d) {
  if (d.side && d.side !== sideNavn()) {
    if (!navigerer) { navigerer = true; window.location.href = sideUrl(d.side); }
    return;
  }
  try { api.bruk?.(d); } catch (e) { console.warn("Lerretet fikk ikke brukt tilstanden:", e); }
  planleggAvstem();
}

function planleggAvstem(ms = 30) {
  if (avstemTimer) return;
  avstemTimer = setTimeout(avstem, ms);
}

function lerretKort() {
  return [...document.querySelectorAll(".modal-backdrop.open")]
    .filter((m) => m.id)
    .sort((a, b) => zIndex(a) - zIndex(b))
    .map((el) => {
      if (el.id === "modal-yt") return { el, post: ytPost(el) || { vis: "" } };
      if (el.dataset.vis) return { el, post: { vis: kanon(el.dataset.vis) } };
      return { el, post: { id: el.id, hash: el.dataset.speilHash || "" } };
    });
}

function avstem() {
  avstemTimer = null;
  if (!maal || navigerer) return;
  const apne = lerretKort();
  const plan = lerretAvstem(apne.map((x) => x.post), maal.stabel || []);
  if (plan.ferdig) { forsok.clear(); brukAllRull(); return; }
  // Det som ligger over felles bunn, lukkes ovenfra. Ingen «stopp eller
  // fortsett?» på lerretet; lytteeksempelet får uttoningen sin.
  for (let i = 0; i < plan.lukk; i++) {
    const el = apne[apne.length - 1 - i].el;
    if (el.id !== "modal-yt") el._skipBeforeClose = true;
    modalClose(el);
  }
  for (const i of plan.oppdater) {
    const el = apne[i].el;
    const p = maal.stabel[i];
    el.innerHTML = p.html;
    el.dataset.speilHash = p.hash;
    brukRullFor(el.id);
  }
  if (plan.aapne && !aapne(plan.aapne)) return;   // gitt opp: vent på neste tilstand
  planleggAvstem(200);
}

// Åpner neste kort. false når kortet er gitt opp (finnes ikke på lerretet).
function aapne(p) {
  const nokkel = p.vis || `#${p.id}`;
  const f = forsok.get(nokkel) || { n: 0, ms: 0 };
  if (Date.now() - f.ms < 1500) return true;   // forrige forsøk kan fortsatt lande
  if (f.n >= 3) return false;
  forsok.set(nokkel, { n: f.n + 1, ms: Date.now() });
  if (p.yt) {
    apneYtSpiller(ytWatchUrl(p.yt.video, p.yt.list, p.yt.start), p.yt.tittel, { start: p.yt.start, kø: p.yt.kø || [] });
    return true;
  }
  if (p.vis) {
    const m = parseVisVerdi(p.vis);
    if (!m || m.hva === "slektstre") return false;
    apneVisNaarKlart(m);
    return true;
  }
  let el = document.getElementById(p.id);
  if (!el) {
    el = document.createElement("div");
    el.id = p.id;
    document.body.appendChild(el);
  }
  el.className = p.cls || "modal-backdrop";
  delete el.dataset.vis;
  el.innerHTML = p.html;
  el.dataset.speilHash = p.hash;
  modalOpen(el);
  brukRullFor(el.id);
  return true;
}

function brukRull(d) {
  if (d.side) {
    const el = document.scrollingElement;
    if (el) el.scrollTop = d.andel * (el.scrollHeight - el.clientHeight);
    return;
  }
  const bd = document.getElementById(d.id);
  if (!bd?.classList.contains("open")) return;
  let el = bd;
  for (const i of d.sti || []) el = el?.children?.[i];
  if (!el) el = bd.querySelector(".modal") || bd;
  el.scrollTop = d.andel * (el.scrollHeight - el.clientHeight);
}

function brukRullFor(id) {
  const d = sisteRull.get(id);
  if (d) requestAnimationFrame(() => brukRull(d));
}

function brukAllRull() {
  for (const d of sisteRull.values()) brukRull(d);
}
