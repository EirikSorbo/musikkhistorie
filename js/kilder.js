// ============================================================================
//  KILDER — vokabular, publikasjoner og aggregering
// ----------------------------------------------------------------------------
//  Kildene bor spredt nederst på hvert artistkort, hvert tiår, hver sjanger og
//  hvert innovasjonskort. Denne modulen samler dem til strukturen «Referanser»-
//  kortet tegner: én kategori (lagret på hver kilde), én linje per hovedkilde,
//  og under den de enkelte artiklene. Ren logikk uten DOM, så den kan
//  enhetstestes; tegningen bor i explore-referanser.js.
// ============================================================================
import { safeUrl } from "./util.js?v=4.80";

// Fast vokabular i koden, ikke i config — samme valg som INSTRUMENTS (v3.68).
// Navnene er OGSÅ seksjonsoverskriftene i Referanser-kortet, derav
// flertallsform, og rekkefølgen her er rekkefølgen seksjonene vises i.
export const KILDE_KATEGORIER = [
  "Bøker",
  "Podkaster",
  "Videoer",
  "Nettsteder",
];

// Kategorier fra før v4.40 som er slått sammen med en annen (brukervalg).
// «Forelesningsnotater» er BEVISST ikke med: de 62 MUR114-kildene bor på
// slektstreets koblinger, som kortet uansett ikke viser. Dukker verdien opp,
// havner den synlig under «Ukategorisert» i stedet for å bli gjettet feil.
const KATEGORI_ALIAS = { Tidsskrifter: "Nettsteder" };

// Kilder uten (gyldig) kategori forsvinner ikke stille: de samles her, nederst
// i kortet, så det synes straks at noe må rettes.
export const UKATEGORISERT = "Ukategorisert";

// Samme fargespråk som hub-ikonene, så kategoriene leses som en del av appen.
const KATEGORI_FARGE = {
  Bøker: "#b45309",
  Podkaster: "#0891b2",
  Videoer: "#dc2626",
  Nettsteder: "#1d4ed8",
  [UKATEGORISERT]: "#64748b",
};

// Vert → publikasjon. Slår sammen familier (språkutgaver, underdomener) så
// «alle artiklene fra Store norske leksikon» blir ÉN linje. Ukjente verter
// beholder vertsnavnet sitt som navn.
const PUBLIKASJONER = {
  "snl.no": "Store norske leksikon",
  "media.snl.no": "Store norske leksikon",
  "en.wikipedia.org": "Wikipedia",
  "no.wikipedia.org": "Wikipedia",
  "nn.wikipedia.org": "Wikipedia",
  "britannica.com": "Encyclopædia Britannica",
  "kids.britannica.com": "Encyclopædia Britannica",
  "loc.gov": "Library of Congress",
  "guides.loc.gov": "Library of Congress",
  "blogs.loc.gov": "Library of Congress",
  "oxfordmusiconline.com": "Grove Music Online",
  "encyclopedia.com": "Encyclopedia.com",
  "history.com": "History.com",
  "npr.org": "NPR",
  "grammy.com": "Grammy Awards",
  "si.edu": "Smithsonian",
  "americanhistory.si.edu": "Smithsonian",
  "folkways.si.edu": "Smithsonian Folkways",
};

// Språkutgave vises som dempet suffiks på raden, så Wikipedia kan stå samlet
// uten at det blir uklart hvilken utgave artikkelen er hentet fra.
const SPRAAK = {
  "en.wikipedia.org": "engelsk",
  "no.wikipedia.org": "norsk",
  "nn.wikipedia.org": "nynorsk",
};

// DOI-lenker sier ingenting om hvem som har utgitt artikkelen: verten er bare
// en henviser. Der leses publikasjonen ut av kildeteksten i stedet.
const HENVISERE = new Set(["doi.org", "dx.doi.org", "hdl.handle.net"]);

// Et nettsted må ha minst tre artikler for å få sin egen linje med trekant
// (brukervalg v4.40). Resten, og kilder uten lenke, samles nederst.
const SAMLE_NAVN = "Andre nettsteder";
const MIN_EGEN_GRUPPE = 3;

// Bare nettkildene grupperes på utgiver: en bok, en podkast eller en video er
// én referanse, ikke «tre artikler fra youtube.com».
const GRUPPERES = "Nettsteder";

export function vertFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function publikasjonFor(vert) {
  return PUBLIKASJONER[vert] || vert;
}

function spraakFor(vert) {
  return SPRAAK[vert] || "";
}

// Artikkeltittel utledet av URL-en: kildetekstene er stort sett generiske
// («Store norske leksikon.»), mens slug-en bærer artikkelnavnet. Siste brukbare
// ledd vinner, så både snl.no/Louis_Armstrong og britannica.com/biography/
// Bessie-Smith gir navnet. Er slug-en ubrukelig, faller vi tilbake på teksten.
export function artikkelTittel(url, fallback = "") {
  let u;
  try { u = new URL(url); } catch { return fallback || url || ""; }
  const ledd = u.pathname.split("/").filter(Boolean);
  for (let i = ledd.length - 1; i >= 0; i--) {
    let s = ledd[i];
    try { s = decodeURIComponent(s); } catch { /* rå slug er bedre enn ingenting */ }
    s = s.replace(/\.(html?|php|aspx)$/i, "").replace(/[_-]+/g, " ").trim();
    if (s.length < 2 || /^\d+$/.test(s)) continue;
    // Slug-er ender ofte på en artikkel-id («45 vinyl singles history 806441»).
    s = s.replace(/\s+\d{3,}$/, "").trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return fallback || u.hostname.replace(/^www\./, "");
}

// «Grove Music Online: «Jazz» (Mark Tucker)» → «Grove Music Online».
function publikasjonFraTekst(tekst) {
  const foran = String(tekst || "").split(":")[0].trim();
  return foran && foran.length <= 60 && !/[«»]/.test(foran) ? foran : "";
}

// De fleste kildetekstene er bare navnet på oppslagsverket («Store norske
// leksikon.»), og da bærer URL-en artikkelnavnet. Men noen kilder har en ekte
// referanse i teksten — kjennetegnet ved sitattegn eller kolon — og da er
// teksten alltid bedre enn slug-en. DOI-lenker har ingen brukbar slug i det
// hele tatt, så en «tittel» uten en eneste bokstav forkastes.
export function radTittel(tekst, url) {
  const t = String(tekst || "").trim();
  if (/[«»:]/.test(t)) return t;
  const fraUrl = artikkelTittel(url, "");
  if (fraUrl && /\p{L}/u.test(fraUrl)) return fraUrl;
  return t || fraUrl || url;
}

// Rydder radtittelen under et gruppenavn: fjerner «Utgiver: » når gruppa
// allerede heter det samme, og sitattegnene rundt det som blir igjen, så
// radene under Grove leses likt som radene under Store norske leksikon.
function utenUtgiver(tittel, gruppe) {
  const prefiks = gruppe + ": ";
  const rest = gruppe && tittel.startsWith(prefiks) ? tittel.slice(prefiks.length) : tittel;
  const sitat = rest.match(/^«(.+)»\.?$/);
  return sitat ? sitat[1] : rest;
}

const paaNavn = (a, b) => a.tittel.localeCompare(b.tittel, "no");

// Hvor kilden er brukt. Samme kort skal bare stå én gang per rad, selv om det
// oppgir kilden på flere nivåer eller flere ganger.
const opphavNokkel = (o) => `${o.type}:${o.id}:${o.niva || ""}`;
function leggOpphav(rad, opphav) {
  if (!opphav || !opphav.id) return;
  const n = opphavNokkel(opphav);
  if (!rad.opphav.some((o) => opphavNokkel(o) === n)) rad.opphav.push(opphav);
}

// «Arne Forsgren, 2021» — forfatter og år slik de vises etter tittelen.
const detaljFor = (k) => [k.forfatter, k.year].map((x) => String(x || "").trim()).filter(Boolean).join(", ");

// Samler en flat liste kilder ({ text, url, kategori }) til seksjoner:
//   { totalt, unike, seksjoner: [{ navn, farge, unike, bruk, grupper, rader }] }
// «Nettsteder» er den eneste seksjonen som grupperes på utgiver: `grupper` er
// én linje per nettsted ({ navn, antall, bruk, rader }), der alt med færre enn
// tre artikler — og alt uten lenke — havner i samlegruppa «Andre nettsteder».
// De andre seksjonene er flate lister i `rader`: én bok, én podkast eller én
// video ER referansen. Radene er { tittel, url, spraak, bruk, sted }.
export function samleKilder(liste) {
  const katMap = new Map();
  let totalt = 0;

  for (const k of Array.isArray(liste) ? liste : []) {
    if (!k || typeof k !== "object") continue;
    const tekst = String(k.text || "").trim();
    const url = safeUrl(k.url);
    if (!tekst && !url) continue;
    totalt++;

    const lagret = KATEGORI_ALIAS[k.kategori] || k.kategori;
    const kategori = KILDE_KATEGORIER.includes(lagret) ? lagret : UKATEGORISERT;
    if (!katMap.has(kategori)) katMap.set(kategori, new Map());
    const grupper = katMap.get(kategori);

    // Utenfor Nettsteder er hver referanse sin egen post — ingen utgiver-
    // gruppering, ellers ville alle YouTube-videoene blitt «youtube.com».
    const vert = url && kategori === GRUPPERES ? vertFor(url) : "";
    const navn = vert
      ? ((HENVISERE.has(vert) && publikasjonFraTekst(tekst)) || publikasjonFor(vert))
      : tekst;
    const nokkel = vert ? "v:" + navn : "t:" + (url || tekst.toLowerCase());
    if (!grupper.has(nokkel)) grupper.set(nokkel, { navn, vert, bruk: 0, rader: new Map() });
    const g = grupper.get(nokkel);
    g.bruk++;

    const radNokkel = url || tekst.toLowerCase();
    const rad = g.rader.get(radNokkel);
    if (rad) { rad.bruk++; if (!rad.detalj) rad.detalj = detaljFor(k); leggOpphav(rad, k.opphav); }
    else g.rader.set(radNokkel, {
      // Utenfor Nettsteder er kildeteksten HELE referansen (boktittel,
      // episodenavn), så URL-slug-en skal aldri overstyre den. Under Nettsteder
      // står utgiveren allerede i gruppeoverskriften, så «Grove Music Online:
      // «Jazz»» kortes til «Jazz» på selve raden.
      tittel: kategori === GRUPPERES ? utenUtgiver(radTittel(tekst, url), navn) : (tekst || radTittel(tekst, url)),
      url,
      spraak: url ? spraakFor(vertFor(url)) : "",
      detalj: detaljFor(k),
      bruk: 1,
      sted: vert ? navn : (url ? vertFor(url) : ""),
      opphav: k.opphav && k.opphav.id ? [k.opphav] : [],
    });
  }

  const seksjoner = [];
  const navnene = [...KILDE_KATEGORIER, ...[...katMap.keys()].filter((n) => !KILDE_KATEGORIER.includes(n))];
  for (const navn of navnene) {
    const rå = katMap.get(navn) || new Map();
    const farge = KATEGORI_FARGE[navn] || KATEGORI_FARGE[UKATEGORISERT];

    // Flat seksjon: bøker, podkaster, videoer.
    if (navn !== GRUPPERES) {
      const rader = [...rå.values()].flatMap((g) => [...g.rader.values()]).sort(paaNavn);
      seksjoner.push({
        navn, farge, grupper: [],
        rader,
        unike: rader.length,
        bruk: rader.reduce((n, r) => n + r.bruk, 0),
      });
      continue;
    }

    let grupper = [...rå.values()].map((g) => ({
      navn: g.navn,
      egen: !!g.vert && g.rader.size >= MIN_EGEN_GRUPPE,
      bruk: g.bruk,
      antall: g.rader.size,
      rader: [...g.rader.values()].sort(paaNavn),
    }));

    // Alt for smått til en egen linje samles i «Andre nettsteder», sammen med
    // kilder uten lenke (tidsskriftartikler og liknende enkeltreferanser).
    const smaa = grupper.filter((g) => !g.egen);
    grupper = grupper.filter((g) => g.egen);
    if (smaa.length) {
      grupper.sort((a, b) => b.antall - a.antall || a.navn.localeCompare(b.navn, "no"));
      grupper.push({
        navn: SAMLE_NAVN,
        samling: true,
        antall: smaa.reduce((n, g) => n + g.antall, 0),
        bruk: smaa.reduce((n, g) => n + g.bruk, 0),
        rader: smaa.flatMap((g) => g.rader).sort(paaNavn),
      });
    } else {
      grupper.sort((a, b) => b.antall - a.antall || a.navn.localeCompare(b.navn, "no"));
    }

    seksjoner.push({
      navn, farge, grupper, rader: [],
      unike: grupper.reduce((n, g) => n + g.antall, 0),
      bruk: grupper.reduce((n, g) => n + g.bruk, 0),
    });
  }

  return { totalt, unike: seksjoner.reduce((n, s) => n + s.unike, 0), seksjoner };
}
