import { test } from "node:test";
import assert from "node:assert/strict";
import { VIS_TYPER, parseVisVerdi, byggVisVerdi, erSkrivefelt, erSokHurtigtast } from "../../js/vis-lenke.js?v=5.30";

// Rundtur: alt «Kopier lenke» kan bygge, må parseren lese tilbake identisk —
// ellers kopierer læreren en lenke som åpner noe annet (eller ingenting).
test("vis-verdi: rundtur for alle måltypene", () => {
  const eksempler = [
    { hva: "artist", id: "a7Kd2xQ" },
    { hva: "sjanger", id: "Delta blues" },
    { hva: "undersjanger", id: "Soul" },
    { hva: "historie", id: "Hip-hop" },
    { hva: "historie" },
    { hva: "tech", id: "t42" },
    { hva: "tiår", id: "1950", modus: "society" },
    { hva: "tiår", id: "1950", modus: "tech" },
    { hva: "side", id: "rotter" },
    { hva: "side", id: "omHistorie" },
    { hva: "side", id: "guide" },
    { hva: "instrument", id: "Gitar" },
    { hva: "kobling", id: "blues__jazz" },
    { hva: "tidslinje" },
    { hva: "varmekart" },
    { hva: "sjangerperioder" },
    { hva: "himmel" },
    { hva: "referanser" },
    { hva: "store-bildet" },
    { hva: "podkaster" },
    { hva: "teknologi" },
    { hva: "teknologi", id: "Opptak og avspilling" },
    { hva: "slektstre" },
    { hva: "varmekart", id: "Country" },
    { hva: "yt", id: "dQw4w9WgXcQ" },
    { hva: "yt", id: "dQw4w9WgXcQ", modus: "PLabc123456789" },
  ];
  for (const m of eksempler) {
    const verdi = byggVisVerdi(m);
    assert.equal(typeof verdi, "string", `${m.hva} må kunne bygges`);
    assert.deepEqual(parseVisVerdi(verdi), m, `rundtur for «${verdi}»`);
  }
});

test("parseVisVerdi: ukjent, tom og ødelagt verdi ignoreres stille", () => {
  assert.equal(parseVisVerdi("tullball:123"), null);
  assert.equal(parseVisVerdi(""), null);
  assert.equal(parseVisVerdi(null), null);
  assert.equal(parseVisVerdi(undefined), null);
  assert.equal(parseVisVerdi(42), null);
  // Type-token alene uten kjent navn — ikke et mål.
  assert.equal(parseVisVerdi(":id"), null);
});

test("byggVisVerdi: nekter det parseren ville lest feil", () => {
  // Kolon i navnet ville flyttet resten inn i modus-plassen.
  assert.equal(byggVisVerdi({ hva: "sjanger", id: "Rock: the sequel" }), null);
  // Modus uten id ville blitt lest som id.
  assert.equal(byggVisVerdi({ hva: "tiår", modus: "society" }), null);
  assert.equal(byggVisVerdi({ hva: "ukjent", id: "x" }), null);
  assert.equal(byggVisVerdi(), null);
});

test("VIS_TYPER dekker søkets hva-nøkler", () => {
  // Ruteren (explore-apne) og søket deler dør, så lenkene må minst kunne
  // uttrykke alt søket kan åpne.
  for (const hva of ["artist", "sjanger", "undersjanger", "historie", "tech", "tiår", "side", "instrument", "kobling"]) {
    assert.ok(VIS_TYPER.has(hva), `${hva} må være en gyldig lenketype`);
  }
});

test("erSkrivefelt: input/textarea/select/contenteditable, ingenting annet", () => {
  assert.equal(erSkrivefelt({ tagName: "INPUT" }), true);
  assert.equal(erSkrivefelt({ tagName: "textarea" }), true);
  assert.equal(erSkrivefelt({ tagName: "SELECT" }), true);
  assert.equal(erSkrivefelt({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(erSkrivefelt({ tagName: "BUTTON" }), false);
  assert.equal(erSkrivefelt({ tagName: "BODY" }), false);
  assert.equal(erSkrivefelt(null), false);
});

test("erSokHurtigtast: «/» utenfor skrivefelt, Ctrl/Cmd+K overalt", () => {
  const tast = (key, mods = {}) => ({ key, altKey: false, ctrlKey: false, metaKey: false, ...mods });
  assert.equal(erSokHurtigtast(tast("/"), false), true);
  assert.equal(erSokHurtigtast(tast("/"), true), false, "«/» i et skrivefelt skal skrive tegnet");
  assert.equal(erSokHurtigtast(tast("k", { metaKey: true }), false), true);
  assert.equal(erSokHurtigtast(tast("K", { ctrlKey: true }), true), true, "Ctrl+K virker også i skrivefelt");
  assert.equal(erSokHurtigtast(tast("k"), false), false, "k alene er bare en bokstav");
  assert.equal(erSokHurtigtast(tast("/", { altKey: true }), false), false, "alt-kombinasjoner skriver tegn på norsk tastatur");
  assert.equal(erSokHurtigtast(tast("/", { ctrlKey: true }), false), false);
  assert.equal(erSokHurtigtast(null, false), false);
});
