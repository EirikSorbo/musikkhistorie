import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapSelection, prefixLines } from "../../js/format-bar.js?v=5.60";

// Minimal textarea-atrapp: setRangeText-semantikken formatlinja bruker.
function fakeTa(value, s, e, maxlength = 4000) {
  return {
    value, selectionStart: s, selectionEnd: e,
    getAttribute: (n) => (n === "maxlength" ? String(maxlength) : null),
    setRangeText(text, start, slutt) {
      this.value = this.value.slice(0, start) + text + this.value.slice(slutt);
    },
    focus() {}, dispatchEvent() {},
  };
}

// Audit v5.19 funn 15: klippTilTak kappet HELE verdien når formateringen gikk
// over taket — siste tegn i sammendraget forsvant stille, langt unna
// markeringen. Nå får verdien overskride taket (telleren blir rød, lagringen
// avviser), og ingen tekst tapes.
test("formatlinja kapper aldri teksten, selv over taket", () => {
  const tekst = "a".repeat(3998);           // 2 under taket på 4000
  const ta = fakeTa(tekst, 0, 4, 4000);     // marker de fire første tegnene
  wrapSelection(ta, "**");                  // +4 tegn → 4002, over taket
  assert.equal(ta.value.length, 4002, "verdien får overskride taket");
  assert.ok(ta.value.endsWith("aaaa"), "slutten av teksten er urørt");
  assert.ok(ta.value.startsWith("**aaaa**"), "formateringen traff markeringen");
});

test("prefixLines: prefiks byttes, teksten består over taket", () => {
  const hale = "b".repeat(3990);
  const ta = fakeTa("- punktet\n" + hale, 0, 2, 4000);
  prefixLines(ta, () => "### ");
  assert.ok(ta.value.startsWith("### punktet\n"), "prefikset byttes, ikke stables");
  assert.ok(ta.value.endsWith("b"), "halen kappes ikke");
  assert.ok(ta.value.includes(hale), "hele halen består");
});
