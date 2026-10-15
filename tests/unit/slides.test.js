// Slides (v7.06): lærerens egne sider i visningen. Overskrift + markdown, lagret i
// samlingen notater under slide:<id>. Bare læreren leser dem; stoppene hoppes over
// for studenter.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slideNokkel, erSlideId, erSlideNokkel, erSlideVis, nySlideId, skrivSlide, lesSlide, slideForLang, slideListe,
  SLIDE_LAGRING_MAKS, SLIDE_TITTEL_MAKS,
} from "../../js/visning/slides-modell.js";
import { slider, finnSlide, slidesLastet, settSlides, onSlidesEndret } from "../../js/visning/slides-liste.js";
import { byggIndeks, sok } from "../../js/felles/search.js";
import { parseVisVerdi, byggVisVerdi, VIS_TYPER } from "../../js/felles/vis-lenke.js";
import { stoppEtikett } from "../../js/visning/stopp-etikett.js";
import { planOversikt } from "../../js/visning/presentasjon-modell.js";
import { renderRichText } from "../../js/felles/rich-text.js";

test("nøkkel og id: slide:<id>, kolonfri id", () => {
  const id = nySlideId(1760000000000, () => 0.5);
  assert.ok(erSlideId(id), id);
  assert.equal(slideNokkel(id), `slide:${id}`);
  assert.ok(erSlideNokkel(`slide:${id}`));
  assert.ok(erSlideVis(`slide:${id}`));
  assert.ok(!erSlideNokkel("artist:abc"));
  assert.ok(!erSlideNokkel("paminnelser:p1"));
  assert.ok(!erSlideNokkel("slide:"));
  assert.notEqual(nySlideId(1, () => 0.1), nySlideId(2, () => 0.1));
});

test("skrivSlide/lesSlide: overskrift på første linje, innholdet etter en blank linje", () => {
  const t = skrivSlide({ tittel: "Innleveringer", innhold: "### Frister\n- Oppgave 1: **15. nov**" });
  assert.equal(t, "Innleveringer\n\n### Frister\n- Oppgave 1: **15. nov**");
  assert.deepEqual(lesSlide(t), { tittel: "Innleveringer", innhold: "### Frister\n- Oppgave 1: **15. nov**" });
});

test("skrivSlide: bare overskrift, bare innhold og helt tomt", () => {
  assert.equal(skrivSlide({ tittel: "Kursinfo", innhold: "" }), "Kursinfo");
  assert.deepEqual(lesSlide("Kursinfo"), { tittel: "Kursinfo", innhold: "" });
  assert.equal(skrivSlide({ tittel: "", innhold: "Bare innhold" }), "\n\nBare innhold");
  assert.equal(skrivSlide({ tittel: "  ", innhold: " \n " }), "");
});

test("skrivSlide: overskriften er én linje og har tak; linjeskift i innholdet bevares", () => {
  assert.equal(skrivSlide({ tittel: "To\nlinjer   her", innhold: "a" }), "To linjer her\n\na");
  assert.equal(skrivSlide({ tittel: "x".repeat(500), innhold: "" }).length, SLIDE_TITTEL_MAKS);
  assert.equal(skrivSlide({ tittel: "T", innhold: "a\r\nb" }), "T\n\na\nb");
});

test("slideForLang: tak på 10 000 tegn (reglene for notater)", () => {
  assert.equal(slideForLang({ tittel: "T", innhold: "x".repeat(SLIDE_LAGRING_MAKS - 4) }), false);
  assert.equal(slideForLang({ tittel: "T", innhold: "x".repeat(SLIDE_LAGRING_MAKS) }), true);
});

test("slideListe: bare slide-nøkler, sortert på overskrift, uten overskrift får navn", () => {
  const liste = slideListe({
    "slide:sbbb": { tekst: "Innleveringer\n\nFrist 15. nov", oppdatert: "2026-10-15" },
    "slide:saaa": { tekst: "Åpning\n\nVelkommen", oppdatert: "2026-10-14" },
    "slide:scccc": { tekst: "\n\nBare innhold", oppdatert: "" },
    "artist:muddy": { tekst: "privat notat" },
    "paminnelser:p1": { tekst: "[]" },
    "slide:": { tekst: "ugyldig" },
  });
  assert.deepEqual(liste.map((s) => s.id), ["scccc", "sbbb", "saaa"].sort((a, b) => {
    const t = (id) => ({ scccc: "(uten overskrift)", sbbb: "Innleveringer", saaa: "Åpning" })[id];
    return t(a).localeCompare(t(b), "no");
  }));
  assert.equal(liste.find((s) => s.id === "scccc").tittel, "(uten overskrift)");
  assert.equal(liste.find((s) => s.id === "sbbb").innhold, "Frist 15. nov");
});

test("slides-liste: tom og ikke lastet som standard, lyttere varsles, utlogging tømmer", () => {
  assert.deepEqual(slider(), []);
  assert.equal(slidesLastet(), false);
  let antall = 0;
  const av = onSlidesEndret(() => { antall++; });
  settSlides({ liste: [{ id: "saaa", tittel: "Åpning", innhold: "x", oppdatert: "" }], lastet: true });
  assert.equal(finnSlide("saaa").tittel, "Åpning");
  assert.equal(slidesLastet(), true);
  settSlides({});
  assert.deepEqual(slider(), []);
  assert.equal(slidesLastet(), false);
  assert.equal(antall, 2);
  av();
  settSlides({});
  assert.equal(antall, 2);
});

test("vis-lenke: slide er en gyldig type og rundturen virker", () => {
  assert.ok(VIS_TYPER.has("slide"));
  assert.deepEqual(parseVisVerdi("slide:sabc12"), { hva: "slide", id: "sabc12" });
  assert.equal(byggVisVerdi({ hva: "slide", id: "sabc12" }), "slide:sabc12");
});

test("søket: slidene er treff for læreren (lista kommer bare dit), ikke ellers", () => {
  const s = { slides: [{ id: "saaa", tittel: "Innleveringer", innhold: "Frist: **15. november**", oppdatert: "" }] };
  const treffAv = (r) => r.grupper.filter((g) => g.type === "slide").flatMap((g) => g.treff);
  const med = treffAv(sok(byggIndeks(s, { erLærer: true }), "innleveringer"));
  assert.equal(med.length, 1);
  assert.deepEqual(med[0].apne, { hva: "slide", id: "saaa" });
  assert.equal(sok(byggIndeks(s, { erLærer: true }), "innleveringer").grupper[0].label, "Slides");
  // Innholdet er også søkbart
  assert.equal(treffAv(sok(byggIndeks(s, { erLærer: true }), "november")).length, 1);
  // Studentene har en tom liste (slides.js fyller den bare for en lærer), og får aldri treff
  assert.equal(treffAv(sok(byggIndeks({ slides: [] }, { erLærer: false }), "innleveringer")).length, 0);
});

test("stoppetikett: slidens overskrift for læreren, «Slide» for andre, «finnes ikke» når slettet", () => {
  settSlides({ liste: [{ id: "saaa", tittel: "Innleveringer", innhold: "", oppdatert: "" }], lastet: true });
  assert.equal(stoppEtikett({ vis: "slide:saaa" }).tekst, "Slide: Innleveringer");
  assert.equal(stoppEtikett({ vis: "slide:sxxx" }).feil, "finnes ikke lenger");
  settSlides({});
  assert.equal(stoppEtikett({ vis: "slide:saaa" }).navn, "Slide");
});

test("oversikten: slides står aldri på planoversikten (den vises også for studenter)", () => {
  const ut = planOversikt([{ vis: "slide:saaa" }, { vis: "tidslinje" }], {});
  const tekster = JSON.stringify(ut);
  assert.ok(!/slide/i.test(tekster), tekster);
});

test("markdown: overskrift, fet, lister og lenker (appens vanlige), uten artistlenker", () => {
  const html = renderRichText("### Frister\n- Oppgave **1**: 15. nov\n- Se [kursside](https://example.com)\n\nMuddy Waters spilte blues.");
  assert.match(html, /<h3>Frister<\/h3>/);
  assert.match(html, /<strong>1<\/strong>/);
  assert.match(html, /<a href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /data-artist|class="artist-link/);
});

// Fra timene (v7.11): oversikten hopper over slide-stopp (studentene kan ikke
// lese dem), og «N kort» skal stemme med det som vises.
test("Fra timene teller ikke slide-stopp", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../js/utforsk/explore-timer.js", import.meta.url), "utf8");
  assert.match(src, /const antallKort = \(plan\) => \(plan\.stopp \|\| \[\]\)\.filter\(\(st\) => !erSlideVis\(st\.vis\)\)\.length;/);
  assert.doesNotMatch(src, /\.stopp\.length\} kort/);
});
