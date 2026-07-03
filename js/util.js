// ============================================================================
//  SMÅ DELTE HJELPERE
// ----------------------------------------------------------------------------
//  Avhengighetsfrie pure-funksjoner som brukes flere steder. Holdes uten
//  imports, så de trygt kan deles av moduler som ellers ville fått en syklus.
// ============================================================================

// Escaper tekst for trygg innsetting i HTML (innhold og attributter).
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Slipper kun http/https gjennom til href/src. escapeHtml stopper ikke
// «javascript:»-URLer, så alle studentleverte lenker må gjennom denne.
export function safeUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : "";
}

// Utsetter kall til etter en pause i input (brukt på søkefelt, så ikke hele
// lista re-rendres for hvert tastetrykk).
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Kjører umiddelbart på første kall, så maks én gang per `ms`. I motsetning
// til debounce fryser IKKE en vedvarende strøm av kall utdata (siste kall i
// vinduet kjøres på slutten). Brukt på Firestore-snapshot-stormen når mange
// stemmer samtidig, så lista oppdateres jevnlig i stedet for én gang per stemme.
export function throttle(fn, ms = 400) {
  // -Infinity: første kall fyrer alltid umiddelbart, uansett klokkeverdi.
  let last = -Infinity, timer = null, lastArgs = null;
  return (...args) => {
    lastArgs = args;
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn(...lastArgs);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...lastArgs);
      }, remaining);
    }
  };
}

// Strukturert kilde-liste (artist, sjanger, tiår, slektstre). Lagt her — uten
// avhengigheter — så både genealogy og ui-helpers kan dele samme implementasjon.
export function buildKilderList(kilder, label = "Kilder") {
  if (!Array.isArray(kilder) || !kilder.length) return "";
  const items = kilder.map((k) => {
    const text = escapeHtml(k.text || "");
    const url = safeUrl(k.url);
    return url
      ? `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${text}</a></li>`
      : `<li>${text}</li>`;
  }).join("");
  return `<div class="kilder"><strong>${escapeHtml(label)}:</strong><ul>${items}</ul></div>`;
}
