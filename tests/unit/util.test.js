import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, safeUrl, throttle, wikimediaThumb, WIKI_THUMB_WIDTHS } from "../../js/util.js?v=3.45";

test("escapeHtml escaper alle spesialtegn", () => {
  assert.equal(
    escapeHtml(`<a href="x" onclick='y'>&</a>`),
    "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
  );
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("safeUrl slipper kun http/https gjennom", () => {
  assert.equal(safeUrl("https://example.com/x?y=1"), "https://example.com/x?y=1");
  assert.equal(safeUrl("http://example.com"), "http://example.com");
  assert.equal(safeUrl("HTTPS://EXAMPLE.COM"), "HTTPS://EXAMPLE.COM");
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,<script>x</script>"), "");
  assert.equal(safeUrl("vbscript:x"), "");
  assert.equal(safeUrl("  javascript:alert(1)"), "");
  assert.equal(safeUrl(""), "");
  assert.equal(safeUrl(null), "");
});

test("wikimediaThumb skriver om Wikimedia-originaler til thumbnail", () => {
  // Original → thumbnail. Bredden rundes OPP til nærmeste tillatte størrelse:
  // Wikimedia svarer 400 på alt utenfor trappa (400 → 500).
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/0/06/Kool_Herc.jpg", 400),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Kool_Herc.jpg/500px-Kool_Herc.jpg"
  );
  // Prosentkodede tegn i filnavnet bevares uendret i begge segmenter (800 → 960).
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/f/f5/Django_Reinhardt_%28Gottlieb_07301%29.jpg", 800),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Django_Reinhardt_%28Gottlieb_07301%29.jpg/960px-Django_Reinhardt_%28Gottlieb_07301%29.jpg"
  );
  // SVG rasteriseres til PNG (…px-Fil.svg.png). 300 → 330.
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo.svg", 300),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/330px-Logo.svg.png"
  );
  // Andre prosjekter enn commons virker også.
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/en/1/1a/Cover.jpg", 400),
    "https://upload.wikimedia.org/wikipedia/en/thumb/1/1a/Cover.jpg/500px-Cover.jpg"
  );
  // Null for alt som ikke er en omskrivbar Wikimedia-original.
  assert.equal(wikimediaThumb("https://example.com/photo.jpg", 400), null);       // annen vert
  assert.equal(wikimediaThumb("https://media.snl.no/media/1/x.jpg", 400), null);  // annen vert
  assert.equal(                                                                    // alt en thumbnail
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/David.jpg/960px-David.jpg", 400),
    null
  );
  assert.equal(wikimediaThumb("", 400), null);
  assert.equal(wikimediaThumb(null, 400), null);
});

// Wikimedia avviser alt utenfor trappa (400 «Use thumbnail sizes listed on
// w.wiki/GHai»). Denne testen er hele vernet mot at en fremtidig kaller ber om
// en «pen» bredde som 160 eller 480 og stille faller tilbake på originalen.
test("wikimediaThumb runder bredden opp til en bredde Wikimedia godtar", () => {
  const w = (width) => {
    const url = wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/0/06/X.jpg", width);
    return Number(url.match(/\/(\d+)px-/)[1]);
  };
  for (const allowed of WIKI_THUMB_WIDTHS) assert.equal(w(allowed), allowed, `${allowed} er lovlig og skal stå`);
  assert.equal(w(160), 250, "himmelens 160 → 250");
  assert.equal(w(480), 500, "artistkortenes 480 → 500");
  assert.equal(w(1), 120);
  assert.equal(w(5000), 1920, "over trappa: største tillatte, ikke en 400-URL");
});

test("throttle: kjører umiddelbart, slår sammen storm, kjører siste på slutten", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let calls = 0;
  let lastArg;
  const fn = throttle((x) => { calls++; lastArg = x; }, 400);

  fn("a");                 // leading — kjører umiddelbart
  assert.equal(calls, 1);
  assert.equal(lastArg, "a");

  fn("b"); fn("c"); fn("d"); // innenfor vinduet — samles, ikke kjørt ennå
  assert.equal(calls, 1);

  t.mock.timers.tick(400);   // vinduet utløper → siste kall kjøres
  assert.equal(calls, 2);
  assert.equal(lastArg, "d");

  t.mock.timers.tick(1000);  // ingen nye kall → ingen ekstra kjøring
  assert.equal(calls, 2);
});
