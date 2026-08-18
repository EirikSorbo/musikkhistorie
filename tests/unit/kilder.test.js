// Kilde-aggregeringen bak Referanser-kortet. Testene her låser de tre valgene
// som er lette å ødelegge senere: at familier (språkutgaver, underdomener)
// samles under ÉN hovedkilde, at artikkeltittelen utledes av URL-en når
// kildeteksten er generisk, og at ingen kilde forsvinner stille.
import { test } from "node:test";
import assert from "node:assert/strict";
import { samleKilder, artikkelTittel, radTittel, publikasjonFor, vertFor, KILDE_KATEGORIER, UKATEGORISERT } from "../../js/kilder.js?v=4.39";

const nett = (text, url) => ({ text, url, kategori: "Nettsteder" });

test("artikkelTittel: slug-en bærer navnet, ikke den generiske kildeteksten", () => {
  assert.equal(artikkelTittel("https://snl.no/Louis_Armstrong", "Store norske leksikon."), "Louis Armstrong");
  assert.equal(artikkelTittel("https://en.wikipedia.org/wiki/Delta_blues", "Wikipedia."), "Delta blues");
  assert.equal(artikkelTittel("https://www.britannica.com/biography/Bessie-Smith", "Britannica."), "Bessie Smith");
  assert.equal(artikkelTittel("https://x.no/artikkel/12345", "Kildetekst"), "Artikkel");
  assert.equal(artikkelTittel("https://x.no/side.html", "Kildetekst"), "Side");
});

test("artikkelTittel: ubrukelig URL faller tilbake på kildeteksten", () => {
  assert.equal(artikkelTittel("https://x.no/?id=5", "Kildetekst"), "Kildetekst");
  assert.equal(artikkelTittel("https://x.no/", ""), "x.no");
  assert.equal(artikkelTittel("ikke en url", "Kildetekst"), "Kildetekst");
});

test("radTittel: ekte referanse i teksten slår URL-slug-en", () => {
  // Kildetekst med sitattegn eller kolon er en ordentlig referanse.
  assert.equal(
    radTittel("Grove Music Online: «Jazz» (Mark Tucker)", "https://doi.org/10.1093/omo/9781561592630.013.9000035"),
    "Grove Music Online: «Jazz» (Mark Tucker)",
  );
  // Generisk tekst: slug-en bærer navnet.
  assert.equal(radTittel("Store norske leksikon.", "https://snl.no/Louis_Armstrong"), "Louis Armstrong");
  // Slug uten en eneste bokstav (DOI) kan ikke brukes som tittel.
  assert.equal(radTittel("Grove Music Online", "https://doi.org/10.1093/9781561592630.013"), "Grove Music Online");
  // Artikkel-id bakerst i slug-en er støy.
  assert.equal(radTittel("Rolling Stone", "https://rollingstone.com/music/45-vinyl-singles-history-806441/"), "45 vinyl singles history");
});

test("DOI-lenker grupperes på utgiveren i teksten, ikke på henviser-verten", () => {
  const { kategorier } = samleKilder([
    { text: "Grove Music Online: «Jazz»", url: "https://doi.org/10.1093/gmo/A1", kategori: "Nettsteder" },
    { text: "Grove Music Online: «Blues»", url: "https://www.oxfordmusiconline.com/grovemusic/display/x", kategori: "Nettsteder" },
  ]);
  assert.deepEqual(kategorier[0].grupper.map((g) => g.navn), ["Grove Music Online"]);
  assert.equal(kategorier[0].grupper[0].antall, 2);
});

test("familier samles under én hovedkilde", () => {
  assert.equal(publikasjonFor(vertFor("https://en.wikipedia.org/wiki/A")), "Wikipedia");
  assert.equal(publikasjonFor(vertFor("https://no.wikipedia.org/wiki/A")), "Wikipedia");
  assert.equal(publikasjonFor(vertFor("https://kids.britannica.com/x/y")), "Encyclopædia Britannica");
  // Ukjent vert beholder vertsnavnet, uten www.
  assert.equal(publikasjonFor(vertFor("https://www.downbeat.com/x")), "downbeat.com");
});

test("samleKilder grupperer på hovedkilde og teller unike artikler", () => {
  const { kategorier, totalt, unike } = samleKilder([
    nett("Store norske leksikon.", "https://snl.no/Louis_Armstrong"),
    nett("Store norske leksikon.", "https://snl.no/Bessie_Smith"),
    nett("Store norske leksikon.", "https://snl.no/Bessie_Smith"),   // samme artikkel to steder
    nett("Wikipedia (engelsk).", "https://en.wikipedia.org/wiki/Delta_blues"),
    nett("Wikipedia (norsk).", "https://no.wikipedia.org/wiki/Blues"),
  ]);
  assert.equal(totalt, 5);
  assert.equal(unike, 4);

  const nettsteder = kategorier.find((k) => k.navn === "Nettsteder");
  assert.deepEqual(nettsteder.grupper.map((g) => g.navn), ["Store norske leksikon", "Wikipedia"]);

  const snl = nettsteder.grupper[0];
  assert.equal(snl.antall, 2, "to unike artikler");
  assert.equal(snl.bruk, 3, "brukt tre steder");
  assert.deepEqual(snl.rader.map((r) => r.tittel), ["Bessie Smith", "Louis Armstrong"]);
  assert.equal(snl.rader[0].bruk, 2, "samme lenke to steder blir én rad med ×2");

  // Radene står alfabetisk (Blues før Delta blues), og språkutgaven skal
  // fortsatt kunne leses av på raden selv om utgavene deler hovedkilde.
  const wiki = nettsteder.grupper[1];
  assert.deepEqual(wiki.rader.map((r) => [r.tittel, r.spraak]), [["Blues", "norsk"], ["Delta blues", "engelsk"]]);
});

test("kategoriene kommer i vokabularets rekkefølge, ukjent kategori havner sist", () => {
  const { kategorier } = samleKilder([
    { text: "Ted Gioia: The History of Jazz", kategori: "Bøker" },
    { text: "Uten kategori", url: "https://x.no/a" },
    { text: "Kilde", kategori: "Fantasikategori" },
    nett("SNL", "https://snl.no/A"),
  ]);
  assert.deepEqual(kategorier.map((k) => k.navn), ["Nettsteder", "Bøker", UKATEGORISERT]);
  assert.equal(kategorier[2].bruk, 2, "både ukjent og manglende kategori skal synes");
  assert.ok(KILDE_KATEGORIER.includes("Bøker"));
});

test("kilder uten lenke blir én linje uten artikler å åpne", () => {
  const { kategorier } = samleKilder([
    { text: "Ted Gioia: The History of Jazz", kategori: "Bøker" },
    { text: "Ted Gioia: The History of Jazz", kategori: "Bøker" },
    { text: "MUR114 (forelesningsnotater)", kategori: "Forelesningsnotater" },
  ]);
  const boker = kategorier.find((k) => k.navn === "Bøker");
  assert.equal(boker.grupper.length, 1);
  assert.equal(boker.grupper[0].rader.length, 0, "ingen artikkelrader");
  assert.equal(boker.grupper[0].bruk, 2);
  assert.equal(boker.unike, 1, "gruppa uten artikler teller som én kilde");
});

test("mange nettsteder med kun én artikkel samles nederst", () => {
  const enkelt = ["a", "b", "c", "d", "e"].map((d, i) => nett("Kilde", `https://${d}.no/artikkel-${i}`));
  const { kategorier } = samleKilder([
    ...enkelt,
    nett("SNL", "https://snl.no/A"),
    nett("SNL", "https://snl.no/B"),
  ]);
  const grupper = kategorier[0].grupper;
  assert.deepEqual(grupper.map((g) => g.navn), ["Store norske leksikon", "Enkeltstående nettsteder"]);
  const samling = grupper[1];
  assert.equal(samling.antall, 5);
  assert.equal(samling.rader.length, 5);
  assert.equal(samling.rader[0].sted, "a.no", "raden viser hvilket nettsted den kom fra");
});

test("søppel og tomme kilder droppes uten å velte aggregeringen", () => {
  const { totalt, kategorier } = samleKilder([null, undefined, "streng", {}, { text: "  " }, { url: "javascript:alert(1)" }]);
  assert.equal(totalt, 0);
  assert.deepEqual(kategorier, []);
  assert.deepEqual(samleKilder(undefined).kategorier, []);
});
