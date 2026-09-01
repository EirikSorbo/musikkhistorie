// Kilde-aggregeringen bak Referanser-kortet. Testene her låser de tre valgene
// som er lette å ødelegge senere: at familier (språkutgaver, underdomener)
// samles under ÉN hovedkilde, at artikkeltittelen utledes av URL-en når
// kildeteksten er generisk, og at ingen kilde forsvinner stille.
import { test } from "node:test";
import assert from "node:assert/strict";
import { samleKilder, artikkelTittel, radTittel, publikasjonFor, vertFor, KILDE_KATEGORIER, UKATEGORISERT } from "../../js/kilder.js?v=5.06";

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
  const { seksjoner } = samleKilder([
    { text: "Grove Music Online: «Jazz»", url: "https://doi.org/10.1093/gmo/A1", kategori: "Nettsteder" },
    { text: "Grove Music Online: «Blues»", url: "https://www.oxfordmusiconline.com/grovemusic/display/x", kategori: "Nettsteder" },
    { text: "Grove Music Online: «Soul»", url: "https://doi.org/10.1093/gmo/A2", kategori: "Nettsteder" },
  ]);
  const nett = seksjoner.find((s) => s.navn === "Nettsteder");
  assert.deepEqual(nett.grupper.map((g) => g.navn), ["Grove Music Online"]);
  assert.equal(nett.grupper[0].antall, 3);
});

test("radene under en utgiver gjentar ikke utgivernavnet", () => {
  const { seksjoner } = samleKilder([
    { text: "Grove Music Online: «Jazz».", url: "https://doi.org/10.1093/gmo/A1", kategori: "Nettsteder" },
    { text: "Grove Music Online: «Funk».", url: "https://doi.org/10.1093/gmo/A2", kategori: "Nettsteder" },
    { text: "Grove Music Online: «Soul».", url: "https://doi.org/10.1093/gmo/A3", kategori: "Nettsteder" },
  ]);
  const grove = seksjoner.find((s) => s.navn === "Nettsteder").grupper[0];
  assert.equal(grove.navn, "Grove Music Online");
  assert.deepEqual(grove.rader.map((r) => r.tittel), ["Funk", "Jazz", "Soul"]);
});

test("familier samles under én hovedkilde", () => {
  assert.equal(publikasjonFor(vertFor("https://en.wikipedia.org/wiki/A")), "Wikipedia");
  assert.equal(publikasjonFor(vertFor("https://no.wikipedia.org/wiki/A")), "Wikipedia");
  assert.equal(publikasjonFor(vertFor("https://kids.britannica.com/x/y")), "Encyclopædia Britannica");
  // Ukjent vert beholder vertsnavnet, uten www.
  assert.equal(publikasjonFor(vertFor("https://www.downbeat.com/x")), "downbeat.com");
});

test("Nettsteder grupperes på hovedkilde og teller unike artikler", () => {
  const { seksjoner, totalt, unike } = samleKilder([
    nett("Store norske leksikon.", "https://snl.no/Louis_Armstrong"),
    nett("Store norske leksikon.", "https://snl.no/Bessie_Smith"),
    nett("Store norske leksikon.", "https://snl.no/Bessie_Smith"),   // samme artikkel to steder
    nett("Store norske leksikon.", "https://snl.no/Duke_Ellington"),
    nett("Wikipedia (engelsk).", "https://en.wikipedia.org/wiki/Delta_blues"),
    nett("Wikipedia (norsk).", "https://no.wikipedia.org/wiki/Blues"),
  ]);
  assert.equal(totalt, 6);
  assert.equal(unike, 5);

  const nettsteder = seksjoner.find((s) => s.navn === "Nettsteder");
  // Wikipedia har bare to artikler og faller ned i samlegruppa (grense: 3).
  assert.deepEqual(nettsteder.grupper.map((g) => g.navn), ["Store norske leksikon", "Andre nettsteder"]);

  const snl = nettsteder.grupper[0];
  assert.equal(snl.antall, 3, "tre unike artikler");
  assert.equal(snl.bruk, 4, "brukt fire steder");
  assert.deepEqual(snl.rader.map((r) => r.tittel), ["Bessie Smith", "Duke Ellington", "Louis Armstrong"]);
  assert.equal(snl.rader[0].bruk, 2, "samme lenke to steder blir én rad med ×2");

  // Språkutgaven skal fortsatt kunne leses av på raden.
  const andre = nettsteder.grupper[1];
  assert.deepEqual(andre.rader.map((r) => [r.tittel, r.spraak]), [["Blues", "norsk"], ["Delta blues", "engelsk"]]);
});

test("nettsteder med færre enn tre artikler samles i «Andre nettsteder»", () => {
  const { seksjoner } = samleKilder([
    nett("SNL", "https://snl.no/A"), nett("SNL", "https://snl.no/B"), nett("SNL", "https://snl.no/C"),
    nett("Kilde", "https://a.no/en"), nett("Kilde", "https://a.no/to"),      // to artikler: for lite
    nett("Kilde", "https://b.no/en"),                                        // én artikkel: for lite
    { text: "«John Mayer: Blues Man.» Rolling Stone, 2007.", kategori: "Tidsskrifter" },  // gammel kategori
  ]);
  const nettsteder = seksjoner.find((s) => s.navn === "Nettsteder");
  assert.deepEqual(nettsteder.grupper.map((g) => g.navn), ["Store norske leksikon", "Andre nettsteder"]);
  const samling = nettsteder.grupper[1];
  assert.equal(samling.antall, 4, "to fra a.no, én fra b.no, og tidsskriftartikkelen uten lenke");
  assert.equal(samling.rader.find((r) => !r.url).tittel, "«John Mayer: Blues Man.» Rolling Stone, 2007.");
  assert.equal(samling.rader.find((r) => r.url).sted, "a.no", "raden viser hvilket nettsted den kom fra");
});

test("seksjonene står i vokabularets rekkefølge, ukjent kategori havner sist", () => {
  const { seksjoner } = samleKilder([
    { text: "Ted Gioia: The History of Jazz", kategori: "Bøker" },
    { text: "Uten kategori", url: "https://x.no/a" },
    { text: "Kilde", kategori: "Fantasikategori" },
    nett("SNL", "https://snl.no/A"),
  ]);
  assert.deepEqual(seksjoner.map((s) => s.navn), [...KILDE_KATEGORIER, UKATEGORISERT]);
  assert.deepEqual(KILDE_KATEGORIER, ["Bøker", "Podkaster", "Videoer", "Nettsteder"]);
  const ukat = seksjoner.find((s) => s.navn === UKATEGORISERT);
  assert.equal(ukat.bruk, 2, "både ukjent og manglende kategori skal synes");
});

test("bøker, videoer og podkaster er flate lister der teksten ER referansen", () => {
  const { seksjoner } = samleKilder([
    { text: "Ted Gioia: The History of Jazz", kategori: "Bøker" },
    { text: "Ted Gioia: The History of Jazz", kategori: "Bøker" },
    { text: "Jazzeventyret (NRK)", url: "https://tv.nrk.no/serie/jazzeventyret", kategori: "Videoer" },
    { text: "Song Exploder, episode 42", url: "https://songexploder.net/e42", kategori: "Podkaster" },
  ]);
  const boker = seksjoner.find((s) => s.navn === "Bøker");
  assert.equal(boker.grupper.length, 0, "ingen utgiver-gruppering utenfor Nettsteder");
  assert.deepEqual(boker.rader.map((r) => [r.tittel, r.bruk]), [["Ted Gioia: The History of Jazz", 2]]);

  // Slug-en skal ALDRI overstyre en forfattet tittel her.
  const video = seksjoner.find((s) => s.navn === "Videoer");
  assert.deepEqual(video.rader.map((r) => r.tittel), ["Jazzeventyret (NRK)"]);
  assert.equal(video.rader[0].url, "https://tv.nrk.no/serie/jazzeventyret");
  assert.equal(seksjoner.find((s) => s.navn === "Podkaster").rader.length, 1);
});

test("tomme seksjoner finnes, men uten rader", () => {
  const { seksjoner } = samleKilder([nett("SNL", "https://snl.no/A")]);
  const tomme = seksjoner.filter((s) => !s.unike).map((s) => s.navn);
  assert.deepEqual(tomme, ["Bøker", "Podkaster", "Videoer"]);
});

test("søppel og tomme kilder droppes uten å velte aggregeringen", () => {
  const { totalt, seksjoner } = samleKilder([null, undefined, "streng", {}, { text: "  " }, { url: "javascript:alert(1)" }]);
  assert.equal(totalt, 0);
  assert.equal(seksjoner.every((s) => !s.unike), true);
  assert.equal(samleKilder(undefined).totalt, 0);
});
