/* ===========================================================================
 *  KLASSEPASSORD — enkel sperre foran appen
 * ---------------------------------------------------------------------------
 *  Formål: en forbipasserende som finner adressen skal møte en passordboks,
 *  ikke pensumet. Dette er IKKE sikkerhet mot skript: innholdet ligger fortsatt
 *  åpent i Firestore for den som kjenner prosjekt-ID-en (se README). Sperren
 *  stopper nysgjerrige mennesker, ikke maskiner.
 *
 *  Design (bevisste valg, ikke tilfeldigheter):
 *   • KLASSISK skript i <head>, ikke ES-modul. Kjører før modulgrafen og
 *     overlever at gstatic/Firebase er nede.
 *   • FEILER ÅPENT. Sperren LEGGER TIL klassen «pensum-locked»; CSS skjuler
 *     innholdet av den klassen. Laster ikke denne fila, skjer ingenting og
 *     appen virker som før. En lekkasje er å foretrekke framfor at 50
 *     studenter står låst ute midt i en time.
 *   • All lagring i try/catch med fallback localStorage → sessionStorage →
 *     minne. En nettleser som nekter lagring skal spørre om passord på nytt,
 *     aldri havne i en blindgate.
 *   • Passordet sammenliknes som PBKDF2-hash. Hashen ligger åpent i et
 *     offentlig repo, derfor 150 000 iterasjoner: en gjettekjøring mot en
 *     ordliste blir upraktisk treg. Selve frasen er likevel det som betyr
 *     mest — bruk tre urelaterte ord.
 *
 *  BYTTE PASSORD: generer nytt salt + hash (se README), øk GATE.version med 1
 *  så alle må skrive inn på nytt, og push.
 * ======================================================================== */
(function () {
  "use strict";

  var GATE = {
    version: 1,
    salt: "WMrsLpqHG2sRlhFIUnRbuA==",
    iterations: 150000,
    hash: "cfa5d4cee3c924dadfb85493ced86dfdc27fa1979e96a98fa47bd8b3a48b67ac",
  };

  var KEY = "pensum-klasse";
  var LOCK_CLASS = "pensum-locked";
  var root = document.documentElement;

  // --- Lagring: localStorage → sessionStorage → minne. Kaster aldri. -------
  var minne = null;
  function lesLagret() {
    try { var v = localStorage.getItem(KEY); if (v) return v; } catch (e) {}
    try { var s = sessionStorage.getItem(KEY); if (s) return s; } catch (e) {}
    return minne;
  }
  function skrivLagret(v) {
    minne = v;
    try { localStorage.setItem(KEY, v); return; } catch (e) {}
    try { sessionStorage.setItem(KEY, v); } catch (e) {}
  }

  // Samme normalisering som da hashen ble laget: små bokstaver, og alt som
  // ikke er bokstav/tall bort. Da spiller det ingen rolle om studenten skriver
  // koden med store bokstaver, mellomrom eller bindestreker.
  function normaliser(s) {
    return String(s).normalize("NFC").toLowerCase().replace(/[^a-z0-9æøå]/g, "");
  }

  function b64Bytes(b64) {
    var bin = atob(b64);
    var ut = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) ut[i] = bin.charCodeAt(i);
    return ut;
  }

  function hexAv(buf) {
    var ut = "";
    var b = new Uint8Array(buf);
    for (var i = 0; i < b.length; i++) ut += b[i].toString(16).padStart(2, "0");
    return ut;
  }

  function sjekkPassord(kandidat) {
    var subtle = window.crypto && window.crypto.subtle;
    // Ingen WebCrypto (gammel nettleser, usikker kontekst): slipp gjennom.
    // Å låse ute er verre enn å slippe inn, jf. topptekst.
    if (!subtle) return Promise.resolve(true);
    var enc = new TextEncoder().encode(normaliser(kandidat));
    return subtle
      .importKey("raw", enc, "PBKDF2", false, ["deriveBits"])
      .then(function (nokkel) {
        return subtle.deriveBits(
          { name: "PBKDF2", salt: b64Bytes(GATE.salt), iterations: GATE.iterations, hash: "SHA-256" },
          nokkel,
          256
        );
      })
      .then(function (bits) { return hexAv(bits) === GATE.hash; })
      .catch(function () { return true; }); // krypto-feil → slipp gjennom
  }

  // --- Er vi allerede låst opp? -------------------------------------------
  if (lesLagret() === String(GATE.version)) {
    window.__pensumGate = { ulast: true, klar: Promise.resolve() };
    return;
  }

  root.classList.add(LOCK_CLASS);

  var lasOpp;
  var klar = new Promise(function (res) { lasOpp = res; });
  window.__pensumGate = { ulast: false, klar: klar };

  function slippInn() {
    skrivLagret(String(GATE.version));
    root.classList.remove(LOCK_CLASS);
    var el = document.getElementById("pass-gate");
    if (el) el.remove();
    window.__pensumGate.ulast = true;
    lasOpp();
  }

  // Lenke med kode: historieappen.no/?kode=... slipper studenten rett inn.
  // Koden fjernes fra adressefeltet etterpå, så den ikke blir liggende synlig.
  function proverLenkekode() {
    var kode = null;
    try { kode = new URLSearchParams(location.search).get("kode"); } catch (e) {}
    if (!kode) return Promise.resolve(false);
    return sjekkPassord(kode).then(function (ok) {
      if (!ok) return false;
      try {
        var u = new URL(location.href);
        u.searchParams.delete("kode");
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (e) {}
      slippInn();
      return true;
    });
  }

  function byggSkjema() {
    if (document.getElementById("pass-gate")) return;
    var wrap = document.createElement("div");
    wrap.id = "pass-gate";
    wrap.className = "pass-gate";
    wrap.innerHTML =
      '<div class="pass-gate-card">' +
      "<h2>Populærmusikkhistorie</h2>" +
      '<p class="pass-gate-hint">Skriv inn klassekoden for å åpne appen.</p>' +
      '<form id="pass-gate-form" autocomplete="off">' +
      '<input id="pass-gate-input" type="password" inputmode="text" ' +
      'autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Klassekode" />' +
      '<button type="submit" class="btn primary">Åpne</button>' +
      "</form>" +
      '<p id="pass-gate-msg" class="pass-gate-msg" role="status"></p>' +
      "</div>";
    document.body.appendChild(wrap);

    var form = wrap.querySelector("#pass-gate-form");
    var input = wrap.querySelector("#pass-gate-input");
    var msg = wrap.querySelector("#pass-gate-msg");
    var knapp = wrap.querySelector("button");
    input.focus();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (knapp.disabled) return;
      knapp.disabled = true;
      msg.textContent = "Sjekker …";
      sjekkPassord(input.value).then(function (ok) {
        knapp.disabled = false;
        if (ok) { slippInn(); return; }
        msg.textContent = "Feil kode. Prøv igjen.";
        input.value = "";
        input.focus();
      });
    });
  }

  function start() {
    proverLenkekode().then(function (slapp) { if (!slapp) byggSkjema(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
