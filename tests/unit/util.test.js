import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, safeUrl } from "../../js/util.js?v=2.73";

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
