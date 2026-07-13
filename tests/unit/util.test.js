import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, safeUrl, throttle } from "../../js/util.js?v=3.10";

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
