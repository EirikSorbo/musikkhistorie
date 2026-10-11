// Fargerotasjonen (v6.71, brukerønske 2026-10-11): seks farger i fast runde,
// ny farge hver dag (lokal dato), lik for alle. Se js/farge.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

function last(search = "") {
  const satt = {};
  const ctx = { document: { documentElement: { setAttribute: (k, v) => { satt[k] = v; } } }, location: { search } };
  vm.createContext(ctx);
  vm.runInContext(les("js/farge.js"), ctx);
  return { api: ctx.pensumFarge, satt };
}
const { api } = last();
const dag = (m, d, t = 12, min = 0) => new Date(2026, m - 1, d, t, min);

test("runden: rød 11. oktober 2026, så grønn, petrol, kobolt, fiolett, plomme og rød igjen", () => {
  assert.deepEqual([...api.FARGER], ["rod", "gronn", "petrol", "kobolt", "fiolett", "plomme"]);
  const uke = [11, 12, 13, 14, 15, 16, 17].map((d) => api.dagensFarge(dag(10, d)));
  assert.deepEqual(uke, ["rod", "gronn", "petrol", "kobolt", "fiolett", "plomme", "rod"]);
  assert.equal(api.dagensFarge(dag(10, 10)), "plomme", "dagen før starten går bakover i runden");
});

test("fargen bytter ved lokal midnatt, ikke midt på dagen", () => {
  assert.equal(api.dagensFarge(dag(10, 11, 0, 1)), "rod");
  assert.equal(api.dagensFarge(dag(10, 11, 23, 59)), "rod");
  assert.equal(api.dagensFarge(dag(10, 12, 0, 1)), "gronn");
});

test("ett år framover: hver dag en ny farge, og samme ukedag får en annen farge uka etter", () => {
  let forrige = null;
  for (let i = 0; i < 400; i++) {
    const d = new Date(2026, 9, 11 + i, 12);
    const f = api.dagensFarge(d);
    assert.equal(f, api.FARGER[i % 6], d.toDateString());   // også over sommertid og nyttår
    assert.notEqual(f, forrige);
    forrige = f;
    const ukaEtter = new Date(2026, 9, 18 + i, 12);
    assert.notEqual(api.dagensFarge(ukaEtter), f);
  }
});

test("skriptet setter data-farge på <html>; ?farge= viser en bestemt farge, ukjent navn gir dagens", () => {
  assert.equal(last("?farge=kobolt").satt["data-farge"], "kobolt");
  assert.equal(last("?vis=artist:x&farge=plomme").satt["data-farge"], "plomme");
  assert.equal(last("?farge=gul").satt["data-farge"], api.dagensFarge());
  assert.equal(last("").satt["data-farge"], api.dagensFarge());
});

test("alle sidene laster farge.js før gate.js, og logoen tegnes med <use> så den følger fargen", () => {
  for (const side of ["index.html", "teacher.html", "tre.html", "student.html", "utskrift.html"]) {
    const html = les(side);
    const farge = html.indexOf('<script src="js/farge.js?v=');
    assert.ok(farge > 0 && farge < html.indexOf('<script src="js/gate.js?v='), `${side}: farge.js før gate.js`);
    assert.ok(farge > html.indexOf('href="css/styles.css'), `${side}: etter stilarket`);
    assert.match(html, /<svg class="brand-icon"[^>]*><use href="img\/logo\.svg\?v=[0-9.]+#logo"><\/use><\/svg>/, side);
    assert.doesNotMatch(html, /<img src="img\/logo\.svg"/, `${side}: ingen <img>-logo (den kan ikke ta fargen)`);
  }
  const logo = les("img/logo.svg");
  assert.match(logo, /<g id="logo">/);
  assert.equal((logo.match(/var\(--accent, #c9361e\)/g) || []).length, 3, "de tre røde delene");
  for (const k of logo.match(/<!--[\s\S]*?-->/g) || []) {
    assert.doesNotMatch(k.slice(4, -3), /--/, "«--» i en XML-kommentar gjør SVG-en ugyldig som bilde");
  }
});
