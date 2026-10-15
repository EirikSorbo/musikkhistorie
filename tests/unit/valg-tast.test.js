// Snarvei på valgknapper (v7.09): askChoice kan gi en knapp en `tast`, og når visningen avsluttes
// og appen spør om du vil lagre det du viste som en time, velger U «Avslutt uten å lagre».
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("askChoice: en knapp med tast velges av tasten, bare når dialogen står øverst, og fanges først", () => {
  const kode = les("js/ui/ui-modal.js");
  assert.match(kode, /document\.addEventListener\("keydown", valgTast, true\)/);
  assert.match(kode, /document\.removeEventListener\("keydown", valgTast, true\)/);
  assert.match(kode, /topOpenModal\(\) !== backdrop/);
  assert.match(kode, /e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey \|\| e\.repeat/);
  assert.match(kode, /x\.tast && String\(x\.tast\)\.toLowerCase\(\) === String\(e\.key\)\.toLowerCase\(\)/);
  // Snarveien vises ikke på knappen, men står i aria-keyshortcuts
  assert.doesNotMatch(kode, /valg-tast/);
  assert.match(kode, /setAttribute\("aria-keyshortcuts"/);
});

test("avslutt visning: U velger «Avslutt uten å lagre», og Lagre og Fortsett har ikke samme tast", () => {
  const kode = les("js/visning/presentasjon.js");
  assert.match(kode, /\{ label: "Avslutt uten å lagre", value: "nei", tast: "u" \}/);
  const blokk = kode.slice(kode.indexOf('title: "Lagre det du viste som en time?"'), kode.indexOf("dismissValue: \"fortsett\""));
  assert.equal((blokk.match(/tast:/g) || []).length, 1);
});
