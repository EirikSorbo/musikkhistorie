// ============================================================================
//  SLIDEKORTET — åpner en slide i visningen (v7.06)
// ----------------------------------------------------------------------------
//  Et vanlig kort (modal) med overskriften i toppen og innholdet som markdown
//  (samme parser som beskrivelsene, men uten artistlenker: en slide er generell
//  info, og navnene skal ikke bli klikkbare på lerretet). Kortet bærer data-vis
//  «slide:<id>», så kjøreplanene, lerretet og «Kopier lenke» behandler det som
//  alle andre mål. Dataene kommer fra slides.js og finnes bare for læreren.
// ============================================================================

import { modalOpen, modalClose } from "../ui/ui-modal.js";
import { renderRichText } from "../felles/rich-text.js";
import { finnSlide, onSlidesEndret } from "./slides-liste.js";

function tegn(modal, slide) {
  modal.querySelector(".slide-tittel").textContent = slide.tittel;
  modal.querySelector(".slide-kropp").innerHTML = renderRichText(slide.innhold || "");
}

export function openSlide(id) {
  const modal = document.getElementById("modal-slide");
  const slide = finnSlide(id);
  if (!modal || !slide) return false;
  modal.dataset.vis = `slide:${id}`;
  modal.dataset.slideId = id;
  tegn(modal, slide);
  modalOpen(modal);
  return true;
}

// Rettes sliden mens kortet står åpent (Skrivebordet i en annen fane), tegnes
// den på nytt; slettes den, eller læreren logger ut, lukkes kortet.
onSlidesEndret(() => {
  const modal = document.getElementById("modal-slide");
  if (!modal || !modal.classList.contains("open")) return;
  const slide = finnSlide(modal.dataset.slideId);
  if (slide) tegn(modal, slide); else modalClose(modal);
});
