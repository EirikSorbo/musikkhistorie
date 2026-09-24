// ============================================================================
//  ARTISTKORTETS LERRET (v5.40) — oppsettet i presentasjonsvisningen
// ----------------------------------------------------------------------------
//  Brukerens oppsett 2026-09-19: innflytelseslinja øverst over hele bredden,
//  så to spalter. Venstre: instrument og sjanger, en skillelinje, deretter
//  beskrivelse, verk og lytteeksempler. Høyre: bildet med levetiden under,
//  og de beslektede artistene under det. I appen er rekkefølgen en annen
//  (bildet flyter til høyre i én tekstflyt), så seksjonene flyttes i DOM-en
//  når kortet vises på lerretet, og på nytt ved hver omtegning:
//  renderArtistDetail bygger kroppen fra bunnen.
//
//  Egen modul uten Firebase-avhengigheter, så oppsettet kan prøves på en
//  lokal side. Kalles fra presentasjon.js (brukNivaaPaa) og er inert ellers.
//  Hvilken spalte hver seksjon hører til, avgjør artistPlassering i
//  presentasjon-modell.js (testet).
// ============================================================================

import { artistPlassering } from "./presentasjon-modell.js?v=5.49";

// Bygger spaltene. Idempotent: står oppsettet alt, gjøres ingenting — modalens
// observatør kaller oss igjen etter våre egne flyttinger.
export function ordneArtistLerret(modal) {
  if (!modal || modal.querySelector(".pres-artist")) return;
  const kropp = modal.querySelector("[data-sekt]")?.parentElement;
  if (!kropp) return;
  const lag = (tag, klasse) => Object.assign(document.createElement(tag), { className: klasse });
  const lerret = lag("div", "pres-artist");
  const spalter = lag("div", "pres-artist-spalter");
  const venstre = lag("div", "pres-artist-venstre");
  const hoyre = lag("div", "pres-artist-hoyre");
  // querySelectorAll er en statisk liste, så flyttingen underveis er trygg.
  for (const s of kropp.querySelectorAll(":scope > [data-sekt]")) {
    const plass = artistPlassering(s.dataset.sekt);
    if (plass === "topp") lerret.appendChild(s);
    else if (plass === "hoyre") hoyre.appendChild(s);
    else {
      venstre.appendChild(s);
      // Skillelinja under instrument og sjanger (nivå 2 og 3).
      if (s.dataset.sekt === "tags") venstre.appendChild(lag("hr", "pres-linje"));
    }
  }
  spalter.append(venstre, hoyre);
  lerret.appendChild(spalter);
  kropp.appendChild(lerret);
}

// Levetiden hører til under portrettet på lerretet (v5.30), der
// fotokrediteringen ellers står — den er skjult i visning (CSS). Linja bor i
// faktablokka, langt fra figuren. Uten bilde blir den stående der den er.
export function flyttLevetid(modal) {
  const figur = modal.querySelector(".artist-image");
  const levetid = modal.querySelector('[data-fakta="levetid"]');
  if (!figur || !levetid || figur.contains(levetid)) return;
  levetid.classList.add("pres-levetid");
  figur.appendChild(levetid);
}

// Etter at nivået er satt: skillelinja følger instrument/sjanger-seksjonen,
// og faktablokka skjules når ingen synlig linje er igjen i den (levetiden
// står under bildet, og resten vises aldri på lerretet).
export function ryddArtistLerret(modal) {
  modal.querySelectorAll(".pres-linje").forEach((hr) => {
    hr.hidden = !hr.previousElementSibling || hr.previousElementSibling.hidden;
  });
  const fakta = modal.querySelector('[data-sekt="fakta"]');
  if (fakta && !fakta.querySelector("[data-fakta]:not([hidden])")) fakta.hidden = true;
}
