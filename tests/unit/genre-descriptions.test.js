import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDesc, resolveDescAny, missingDesc } from "../../js/genre-descriptions.js?v=3.59";

const descs = {
  Blues: {
    meta: { description: "meta-tekst", kilder: [{ text: "k1" }] },
    main: { description: "main-tekst" },
  },
};

test("resolveDesc leser KUN sitt eget nivå (ingen fallback)", () => {
  assert.equal(resolveDesc(descs, "Blues", "meta").description, "meta-tekst");
  assert.equal(resolveDesc(descs, "Blues", "main").description, "main-tekst");
  assert.equal(resolveDesc(descs, "Blues", "sub").description, "");
});

test("resolveDescAny prøver navnene i rekkefølge", () => {
  assert.equal(resolveDescAny(descs, ["Finnes ikke", "Blues"], "main").description, "main-tekst");
  assert.equal(resolveDescAny(descs, ["Finnes ikke"], "main").description, "");
});

test("missingDesc navngir nivået", () => {
  assert.ok(missingDesc("meta").includes("hovedsjanger"));
  assert.ok(missingDesc("main").includes("sjanger"));
  assert.ok(missingDesc("sub").includes("undersjanger"));
});
