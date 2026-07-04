// ============================================================================
//  LAST-VAKT
// ----------------------------------------------------------------------------
//  Hvis Firebase-SDK-en (fra gstatic.com) ikke laster — brannmur, captive
//  portal, CDN-utfall — aborterer hele ES-modulgrafen, og siden ville ellers
//  stått død og stille (knapper og skjemaer virker ikke, ingen forklaring).
//  Denne fila lastes fra SAMME opphav som HTML-en (ikke gstatic) og som et
//  klassisk script, så den kjører uansett. store.js setter window.__pensumReady
//  = true når datalaget faktisk lastet; blir det aldri satt, viser vi en
//  forklarende melding. Auto-fjernes hvis appen likevel laster (treg forbindelse).
// ============================================================================
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () {
    if (window.__pensumReady) return;
    var b = document.createElement("div");
    b.id = "app-load-error";
    b.setAttribute("role", "alert");
    b.style.cssText = "position:sticky;top:0;z-index:9999;background:#b3261e;color:#fff;padding:12px 16px;text-align:center;font:500 15px system-ui,-apple-system,sans-serif";
    b.textContent = "Kunne ikke laste appen — nettet eller en brannmur blokkerer kanskje Firebase. Sjekk forbindelsen og last siden på nytt.";
    document.body.insertBefore(b, document.body.firstChild);
    // Intervallet lever til appen faktisk blir klar (rydder da opp selv) —
    // et tidskutt her ville latt banneret stå permanent over en app som ble
    // klar seint men fungerer (f.eks. svært tregt mobilnett).
    var iv = setInterval(function () {
      if (window.__pensumReady) { clearInterval(iv); b.remove(); }
    }, 1000);
  }, 8000);
});
