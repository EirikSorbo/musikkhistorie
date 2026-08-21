import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRichText } from "../../js/rich-text.js?v=4.59";
import { formatInfoText } from "../../js/ui-helpers.js?v=4.59";

// renderRichText er DELT av historiene, innholdssidene og alle beskrivelsene
// (artist, sjanger, kobling, innovasjon, tiår). Testene her låser syntaksen
// begge bruker, så de to aldri driver fra hverandre.

const artists = [
  { id: "a1", name: "Muddy Waters", status: "active" },
  { id: "a2", name: "Robert Johnson", status: "active" },
];

test("avsnitt skilles av blanke linjer", () => {
  const html = renderRichText("Første avsnitt.\n\nAndre avsnitt.");
  assert.equal(html, "<p>Første avsnitt.</p><p>Andre avsnitt.</p>");
});

test("### blir mellomtittel (h3), uansett #-dybde", () => {
  assert.ok(renderRichText("### Chicago blues").includes("<h3>Chicago blues</h3>"));
  assert.ok(renderRichText("## Tittel").includes("<h3>Tittel</h3>"));
});

test("fet og kursiv", () => {
  const html = renderRichText("Dette er **viktig** og *nyansert*.");
  assert.ok(html.includes("<strong>viktig</strong>"));
  assert.ok(html.includes("<em>nyansert</em>"));
});

test("punktliste og nummerert liste samles i ul/ol", () => {
  const ul = renderRichText("- ett\n- to");
  assert.equal(ul, "<ul><li>ett</li><li>to</li></ul>");
  const ol = renderRichText("1. ett\n2. to");
  assert.equal(ol, "<ol><li>ett</li><li>to</li></ol>");
});

test("artistnavn i løpende tekst og inni fet tekst lenkes", () => {
  const html = renderRichText("Med **Muddy Waters** kom arven etter Robert Johnson til byen.", { artists });
  assert.ok(html.includes('data-artist-id="a1"'));
  assert.ok(html.includes('data-artist-id="a2"'));
});

test("[tekst](url) blir lenke med noopener, kun http(s)", () => {
  const html = renderRichText("Hør: [Strange Fruit](https://www.youtube.com/results?search_query=Strange%20Fruit) nå.");
  assert.ok(html.includes('<a href="https://www.youtube.com/results?search_query=Strange%20Fruit" target="_blank" rel="noopener">Strange Fruit</a>'));
  // javascript:-URL-er skal IKKE bli lenker
  const evil = renderRichText("[klikk](javascript:alert(1))");
  assert.equal(evil.includes("<a "), false);
  assert.ok(evil.includes("klikk"));
});

test("lenketekst escapes og linkifiseres IKKE (ingen nøstede lenker)", () => {
  const html = renderRichText("[Muddy Waters](https://example.com/x)", { artists });
  assert.equal(html.includes("data-artist-id"), false);
  assert.ok(html.includes(">Muddy Waters</a>"));
});

test("lenker fungerer sammen med fet/kursiv i samme linje", () => {
  const html = renderRichText("**Viktig:** hør [låta](https://example.com) og *tenk*.");
  assert.ok(html.includes("<strong>Viktig:</strong>"));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes("<em>tenk</em>"));
});

test("HTML i teksten escapes (ingen XSS gjennom historien)", () => {
  const html = renderRichText('<script>alert(1)</script> og **<b>x</b>**');
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>"), false);
});

test("HTML i lenketekst og URL escapes", () => {
  const html = renderRichText('[<b>x</b>](https://example.com/?a="1")');
  assert.equal(html.includes("<b>"), false);
  assert.equal(html.includes('a="1"'), false);
});

test("tekst rett etter et listepunkt (uten blank linje) beholder kildens rekkefølge", () => {
  // Regresjon: para ble før flushet FØR den åpne lista, så avsnittet hoppet foran.
  assert.equal(
    renderRichText("- punkt a\nfortsettelse\n\nNytt avsnitt"),
    "<ul><li>punkt a</li></ul><p>fortsettelse</p><p>Nytt avsnitt</p>"
  );
  assert.equal(
    renderRichText("- a\ntekst\n- b"),
    "<ul><li>a</li></ul><p>tekst</p><ul><li>b</li></ul>"
  );
});


// --- Det som er nytt med den delte parseren (v4.32) ---

test("tankestrek-punkter blir liste (de 73 koblingstekstene i Firestore)", () => {
  // Koblingsbeskrivelsene ble skrevet med «– » som kulepunkt lenge før appen
  // kunne formatere. De skal bli ekte lister uten at teksten røres.
  assert.equal(
    renderRichText("Ført videre fra funk:\n– Grooven\n– Synkoperingen"),
    "<p>Ført videre fra funk:</p><ul><li>Grooven</li><li>Synkoperingen</li></ul>"
  );
});

test("enkelt linjeskift blir <br>, blank linje blir nytt avsnitt", () => {
  assert.equal(renderRichText("Linje en\nLinje to"), "<p>Linje en<br>Linje to</p>");
  assert.equal(renderRichText("Én\n\nTo"), "<p>Én</p><p>To</p>");
});

test("stjerne midt i et ord er ikke kursiv (N*E*R*D)", () => {
  // The Neptunes-beskrivelsen er den eneste teksten i basen med stjerne inni
  // et ord. Den skal stå som skrevet.
  const html = renderRichText("De utgjør bandet N*E*R*D.");
  assert.equal(html.includes("<em>"), false);
  assert.ok(html.includes("N*E*R*D"));
  // Kursiv på ordgrense virker fortsatt
  assert.ok(renderRichText("Dette er *viktig* nå.").includes("<em>viktig</em>"));
  assert.ok(renderRichText("*Hele linja*").includes("<em>Hele linja</em>"));
});

test("tomme og manglende tekster gir tom streng", () => {
  assert.equal(renderRichText(""), "");
  assert.equal(renderRichText(null), "");
  assert.equal(renderRichText(undefined), "");
});

test("formatInfoText: gamle tiårstekster med én linje per punkt blir fortsatt liste", () => {
  // Elleve teknologi-felter i Firestore er skrevet slik, uten markering.
  const gammel = "Elektrisitet blir vanlig i byene.\nRadio eksperimenteres med.\nGrammofonen blir standard.";
  assert.equal(
    formatInfoText(gammel),
    "<ul><li>Elektrisitet blir vanlig i byene.</li><li>Radio eksperimenteres med.</li><li>Grammofonen blir standard.</li></ul>"
  );
});

test("formatInfoText: så snart teksten har markering eller avsnitt, gjelder vanlig formatering", () => {
  assert.equal(formatInfoText("- ett\n- to"), "<ul><li>ett</li><li>to</li></ul>");
  assert.equal(formatInfoText("Avsnitt én.\n\nAvsnitt to."), "<p>Avsnitt én.</p><p>Avsnitt to.</p>");
  assert.ok(formatInfoText("### Tittel\nTekst").includes("<h3>Tittel</h3>"));
  assert.equal(formatInfoText("Bare én linje."), "<p>Bare én linje.</p>");
  assert.ok(formatInfoText("Med **fet** i en enkelt linje.").includes("<strong>fet</strong>"));
});

test("formatInfoText: fet tekst i en gammel linjeliste virker uten å bryte lista", () => {
  const html = formatInfoText("**1948**: LP-formatet.\n**1949**: 45-singelen.");
  assert.ok(html.startsWith("<ul>"));
  assert.ok(html.includes("<strong>1948</strong>"));
});
