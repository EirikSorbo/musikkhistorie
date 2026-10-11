/* ===========================================================================
 *  FARGEROTASJON — dagens aksentfarge, satt før siden tegnes
 * ---------------------------------------------------------------------------
 *  Brukerønske 2026-10-11 (v6.71): appen bytter aksentfarge hver dag, lik for
 *  alle. Seks farger går i fast runde. Seks dager i runden og sju i uka gjør
 *  at hver ukedag får en ny farge fra uke til uke.
 *
 *  Fargene selv står i css/styles.css, én blokk per farge:
 *      :root[data-farge="kobolt"] { --accent-50 … --accent-700, --accent-rgb }
 *  Dette skriptet setter bare data-farge på <html>. Alle fargene har minst
 *  4,5:1 i kontrast mot hvitt, begge veier (vakttesten design-variabler
 *  sjekker det). Logoen følger med: img/logo.svg#logo tegnes med <use>, og de
 *  røde delene i den bruker var(--accent).
 *
 *  Valg:
 *   • KLASSISK skript i <head>, ikke modul: fargen er satt før første
 *     opptegning, så siden aldri blinker i gårsdagens farge.
 *   • Lokal dato: fargen bytter ved midnatt der eleven er. Lerretet og
 *     lærerens vindu regner ut det samme og får samme farge.
 *   • Fargen settes når siden lastes. Står en side åpen over midnatt, bytter
 *     den ved neste omlasting.
 *   • ?farge=kobolt viser en bestemt farge på den siden (for å prøve). Et
 *     ukjent navn gir dagens farge. Ingenting lagres.
 *   • Laster ikke fila, står rødt i :root som standard.
 *
 *  NY FARGE: legg navnet inn i FARGER under og en blokk i styles.css.
 *  Vakttesten krever at de to listene er like.
 * ======================================================================== */
(function (vindu) {
  "use strict";

  var FARGER = ["rod", "gronn", "petrol", "kobolt", "fiolett", "plomme"];
  // Dag 0 i runden: 11. oktober 2026 (rød, fargen appen hadde da rotasjonen kom).
  var START = Date.UTC(2026, 9, 11);
  var DOGN = 86400000;

  // Dagens farge etter lokal dato. Date.UTC av år/måned/dag gir hele døgn,
  // så sommertid flytter ikke byttet.
  function dagensFarge(dato) {
    var d = dato || new Date();
    var dag = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - START) / DOGN);
    var n = FARGER.length;
    return FARGER[((dag % n) + n) % n];
  }

  function valgtFarge(sok, dato) {
    var m = /[?&]farge=([a-z]+)/.exec(sok || "");
    return m && FARGER.indexOf(m[1]) >= 0 ? m[1] : dagensFarge(dato);
  }

  vindu.pensumFarge = { FARGER: FARGER, dagensFarge: dagensFarge, valgtFarge: valgtFarge };
  try {
    vindu.document.documentElement.setAttribute("data-farge", valgtFarge(vindu.location.search));
  } catch (e) { /* uten dokument (tester): bare funksjonene */ }
})(this);
