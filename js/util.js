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

// Wikimedia Commons-bilder lenkes ofte til fulloppløste ORIGINALER — noen på
// 10+ megapiksler (Django Reinhardt: 3584×3762 ≈ 13,5 MP). iOS Safari dekoder
// hvert <img> til full bitmap i minnet (≈54 MB for det bildet), og noen få
// slike sprenger fanens minnebudsjett — fanen drepes og lastes på nytt
// gjentatte ganger («et problem oppstod gjentatte ganger»). Vi ber derfor om
// en skalert thumbnail på oppgitt bredde. Gir null for alt som ikke er en
// Wikimedia-original (andre verter, og URL-er som alt peker på /thumb/), så
// kalleren bruker URL-en uendret. Kalleren bør legge på en fallback til
// originalen (data-full), siden Wikimedia kan avvise enkelte ferske bredder.
// Wikimedia godtar ikke lenger vilkårlige thumbnail-bredder: alt utenfor en fast
// trapp svarer «400 — Use thumbnail sizes listed on w.wiki/GHai». Verifisert mot
// upload.wikimedia.org 2026-07-14; 480 og 160 (som appen ba om) er BEGGE avvist,
// og hvert bilde falt derfor tilbake på fullstørrelse-originalen — akkurat det
// minneproblemet thumbnailene skulle løse. Vi runder derfor ALLTID opp til
// nærmeste tillatte bredde (opp, aldri ned, så bildet ikke blir uskarpt).
export const WIKI_THUMB_WIDTHS = [120, 250, 330, 500, 960, 1280, 1920];

function snapThumbWidth(width) {
  const w = Math.round(Number(width) || 0);
  return WIKI_THUMB_WIDTHS.find((allowed) => allowed >= w) ?? WIKI_THUMB_WIDTHS[WIKI_THUMB_WIDTHS.length - 1];
}

export function wikimediaThumb(url, width = 640) {
  // Original:  …/wikipedia/<prosjekt>/<a>/<ab>/<Fil>
  // Thumbnail: …/wikipedia/<prosjekt>/thumb/<a>/<ab>/<Fil>/<bredde>px-<Fil>
  const m = String(url ?? "").match(
    /^(https?:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/)([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/i
  );
  if (!m) return null;
  const [, base, a, ab, file] = m;
  // SVG-thumbs rasteriseres til PNG (…px-Fil.svg.png).
  const thumbFile = /\.svg$/i.test(file) ? `${file}.png` : file;
  return `${base}thumb/${a}/${ab}/${file}/${snapThumbWidth(width)}px-${thumbFile}`;
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
