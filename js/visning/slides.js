// ============================================================================
//  SLIDES — kjøring: abonnement og lagring (v7.06)
// ----------------------------------------------------------------------------
//  Slidene ligger i samlingen notater (se slides-modell.js), som bare læreren
//  kan lese. Modulen abonnerer derfor KUN når en lærerkonto er innlogget, og
//  slipper alt ved utlogging. På en studentside gjør den ingenting: lista
//  forblir tom og «lastet» usann.
//
//  Delt av visningen (søket, kjøreplanene, slidekortet), lerretet og
//  Skrivebordet, så alle ser den samme lista. Lytterne varsles ved hver endring.
// ============================================================================

import { onAuthChange, subscribeNotater, lagreNotat } from "../data/store.js";
import { TEACHER_EMAILS } from "../firebase-config.js";
import { slideListe, slideNokkel, skrivSlide, slideForLang, nySlideId } from "./slides-modell.js";
import { settSlides, slidesLastet } from "./slides-liste.js";

let avmeld = null;
let startet = false;

const erLaerer = (user) => !!user && !user.isAnonymous && TEACHER_EMAILS.includes(user.email);

// Kalles én gang per side (trygt å kalle flere ganger). Følger innloggingen.
export function startSlides() {
  if (startet) return;
  startet = true;
  onAuthChange((user) => {
    if (erLaerer(user)) {
      if (avmeld) return;
      avmeld = subscribeNotater((n) => {
        settSlides({ liste: slideListe(n), lastet: true });
      }, (err) => {
        avmeld = null;
        settSlides({ feil: err?.code === "permission-denied"
          ? "Reglene for private notater er ikke publisert, så slidene kan ikke leses."
          : `Fikk ikke lest slidene (${err?.message || err}).` });
      });
    } else if (avmeld || slidesLastet()) {
      avmeld?.();
      avmeld = null;
      settSlides({});
    }
  });
}

// Lagrer (oppretter eller oppdaterer) en slide og returnerer id-en. Kaster når
// teksten er for lang eller begge feltene er tomme.
export async function lagreSlide(id, { tittel, innhold }) {
  const slide = { tittel, innhold };
  const tekst = skrivSlide(slide);
  if (!tekst) throw new Error("Sliden er tom.");
  if (slideForLang(slide)) throw new Error("Sliden er for lang (høyst 10 000 tegn).");
  const ny = id || nySlideId();
  await lagreNotat(slideNokkel(ny), tekst);
  return ny;
}

export const slettSlide = (id) => lagreNotat(slideNokkel(id), "");
