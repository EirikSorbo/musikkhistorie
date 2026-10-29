// ============================================================================
//  SIKKERHETSKOPI AV VISNINGEN (v7.15)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-10-25: en visning som ble lukket uten Avslutt, skal
//  ikke gå tapt. Det som vises, skrives til lærerens notater (visning:<økt>),
//  Avslutt sletter kopien, og appen spør om kopiene som står igjen.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  KOPI_MAKS, kopiNokkel, erKopiNokkel, nyOktId, skrivKopi, lesKopi, ulagredeKopier, erFersk, kopiDato, isoDato, FERSK_MS,
} from "../../js/visning/visningskopi-modell.js";
import { erSlideNokkel } from "../../js/visning/slides-modell.js";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("økt-id og nøkkel: kolonfri id, eget prefiks som ikke kolliderer med slidene", () => {
  const id = nyOktId(1761400000000, () => 0.5);
  assert.match(id, /^o[a-z0-9]+$/);
  assert.equal(kopiNokkel(id), `visning:${id}`);
  assert.ok(erKopiNokkel(kopiNokkel(id)));
  assert.ok(!erKopiNokkel("slide:abc123"));
  assert.ok(!erSlideNokkel(kopiNokkel(id)));
  assert.ok(!erKopiNokkel("visning:"), "uten id er det ingen kopi");
  assert.ok(!erKopiNokkel("artist:abc"));
});

test("skrivKopi og lesKopi går rundt, uten ugyldige og doble stopp", () => {
  const tekst = skrivKopi({ start: "2026-10-03T08:15:00.000Z", plan: "p1", stopp: ["artist:muddy", "tull:x", "yt:abcdefghijk::30", "artist:muddy"] });
  const k = lesKopi("visning:oabc123", { tekst, oppdatert: "2026-10-03T09:40:00.000Z" });
  assert.deepEqual(k.stopp, [{ vis: "artist:muddy" }, { vis: "yt:abcdefghijk::30" }]);
  assert.equal(k.okt, "oabc123");
  assert.equal(k.plan, "p1");
  assert.equal(k.start, "2026-10-03T08:15:00.000Z");
  assert.equal(k.avkortet, false);
  assert.equal(skrivKopi({ stopp: ["tull"] }), "", "uten gyldige stopp skrives ingenting");
  assert.equal(lesKopi("visning:oabc123", { tekst: "ikke json" }), null);
  assert.equal(lesKopi("slide:oabc123", { tekst }), null, "bare visning:-nøkler er kopier");
});

test("en for lang økt kuttes til reglenes 10 000 tegn og merkes avkortet", () => {
  const stopp = Array.from({ length: 400 }, (_, i) => `artist:artist${String(i).padStart(30, "0")}`);
  const tekst = skrivKopi({ start: "2026-10-03T08:15:00.000Z", stopp });
  assert.ok(tekst.length <= KOPI_MAKS);
  const k = lesKopi("visning:oabc123", { tekst });
  assert.ok(k.avkortet);
  assert.ok(k.stopp.length > 100 && k.stopp.length < 400);
  assert.equal(k.stopp[0].vis, stopp[0], "de første stoppene beholdes");
});

test("ulagredeKopier: nyeste først, uten økta som pågår, og bare gyldige kopier", () => {
  const kopi = (start, stopp = ["artist:a"]) => ({ tekst: skrivKopi({ start, stopp }), oppdatert: start });
  const notater = {
    "visning:oaaaa1": kopi("2026-10-01T08:00:00.000Z"),
    "visning:obbbb2": kopi("2026-10-08T08:00:00.000Z"),
    "visning:occcc3": kopi("2026-10-15T08:00:00.000Z"),
    "slide:s123abc": { tekst: "En slide" },
    "artist:muddy": { tekst: "Et notat" },
  };
  assert.deepEqual(ulagredeKopier(notater).map((k) => k.okt), ["occcc3", "obbbb2", "oaaaa1"]);
  assert.deepEqual(ulagredeKopier(notater, { unntatt: "occcc3" }).map((k) => k.okt), ["obbbb2", "oaaaa1"]);
});

test("erFersk: en kopi skrevet de siste minuttene kan høre til en visning som pågår", () => {
  const naa = Date.parse("2026-10-25T12:00:00.000Z");
  assert.ok(erFersk({ oppdatert: new Date(naa - 60000).toISOString() }, naa));
  assert.ok(!erFersk({ oppdatert: new Date(naa - FERSK_MS - 1000).toISOString() }, naa));
  assert.ok(!erFersk({ oppdatert: "" }, naa));
});

test("kopiDato: timen får dagen visningen startet, ikke dagen den lagres", () => {
  const start = new Date(2026, 9, 3, 10, 15).toISOString();
  assert.equal(kopiDato({ start }, new Date(2026, 9, 25)), "2026-10-03");
  assert.equal(kopiDato({}, new Date(2026, 9, 25)), "2026-10-25");
  assert.equal(isoDato(new Date(2026, 0, 5)), "2026-01-05");
});

test("visningen skriver kopien underveis, bare fra lærerens eget vindu, og Avslutt sletter den", () => {
  const p = les("js/visning/presentasjon.js");
  assert.match(p, /okt: "pensumPresOkt",/);
  const fn = p.slice(p.indexOf("function sikkerhetskopier("), p.indexOf("export function aktivOkt"));
  assert.match(fn, /if \(!erLaerer \|\| erLerret\) return;/, "studentene og lerretet skriver ikke");
  assert.match(fn, /kopierVisning\(okt, \{ start: les\(LAGRING\.oktStart\) \|\| "", plan: les\(LAGRING\.plan\) \|\| null, stopp \}\)/);
  const avslutt = p.slice(p.indexOf("export async function avsluttPresentasjon"));
  const slett = avslutt.indexOf("slettKopi(okt)");
  assert.ok(slett > 0 && slett < avslutt.indexOf("window.location.href"), "kopien slettes før sida byttes");
  assert.ok(avslutt.indexOf('if (valg === "fortsett") return;') < slett, "Fortsett visningen sletter ingenting");
  // Skrivingen er sjeldnere enn hver endring, og fanen som skjules, skriver med en gang.
  const k = les("js/visning/visningskopi.js");
  assert.match(k, /const INTERVALL_MS = 10000;/);
  assert.match(k, /document\.visibilityState === "hidden"\) skrivNaa\(\)/);
  assert.match(k, /window\.addEventListener\("pagehide", skrivNaa\)/);
});

test("Visning spør om ulagrede kopier, men aldri midt i en visning, og bare én gang per økt", () => {
  const v = les("js/visning/visning.js");
  const fn = v.slice(v.indexOf("async function sporOmKopier()"));
  assert.match(fn, /if \(sporer \|\| !erLaerer \|\| erPresentasjon\(\) \|\| !kopierLastet\(\) \|\| !planeneLastet\(\)\) return;/);
  assert.match(fn, /!erFersk\(k\) && !spurtNaa\.has\(k\.okt\)/);
  assert.match(v, /startKopivakt\(\{ unntatt: aktivOkt \}\);/);
});

// Kontrollrunden 2026-10-29.
test("en slettet kopi skrives aldri på nytt i samme fane", () => {
  const k = les("js/visning/visningskopi.js");
  assert.match(k, /export function kopierVisning\(okt, data\) \{\n\s*if \(!okt \|\| slettede\.has\(okt\)\) return;/);
  assert.match(k, /export function slettKopi\(okt\) \{\n\s*slettede\.add\(okt\);/);
});

test("kopiene er ikke med i eksporten, og importen hopper over dem", () => {
  const imp = les("js/laerer/teacher-import.js");
  assert.match(imp, /const notater = utenKopier\(state\.notater\);\n\s*if \(Object\.keys\(notater\)\.length\) out\.notater = notater;/);
  assert.match(imp, /erKopiNokkel\(nokkel\) \|\| typeof v\?\.tekst !== "string"/);
});

test("Lagre som time foreslår forrige gruppe bare om den fortsatt finnes", () => {
  const t = les("js/visning/lagre-time.js");
  assert.match(t, /const forslag = \(grupper\.includes\(sist\) \? sist : ""\) \|\| normaliserGruppe\(gruppeForslag\);/);
});

test("en plan som bytter gruppe, mister referansemerket i dokumentet", () => {
  const v = les("js/visning/visning.js");
  assert.match(v, /const endring = \{ gruppe: ny, referanse: null \};/, "draingen");
  assert.match(v, /if \(foer && \(foer\.gruppe \|\| null\) !== plan\.gruppe\) plan\.referanse = null;/, "editoren");
  assert.match(v, /ny \? \{ gruppe: ny \} : \{ gruppe: null, referanse: null \}/, "nytt navn til tomt");
  assert.match(v, /\{ gruppe: null, referanse: null \}\]\)\)\)\)\)\) return;\n\s*msg\(`Gruppen «\$\{navn\}» er oppløst\.`\)/, "oppløs");
});
