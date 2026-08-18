// ============================================================================
//  KILDER — vokabular, publikasjoner og aggregering
// ----------------------------------------------------------------------------
//  Kildene bor spredt nederst på hvert artistkort, hvert tiår, hver sjanger og
//  hvert innovasjonskort. Denne modulen samler dem til strukturen «Referanser»-
//  kortet tegner: én kategori (lagret på hver kilde), én linje per hovedkilde,
//  og under den de enkelte artiklene. Ren logikk uten DOM, så den kan
//  enhetstestes; tegningen bor i explore-referanser.js.
// ============================================================================
import { safeUrl } from "./util.js?v=4.39";

// Fast vokabular i koden, ikke i config — samme valg som INSTRUMENTS (v3.68).
// Navnene er OGSÅ overskriftene i Referanser-kortet, derav flertallsform, og
// rekkefølgen her er rekkefølgen kategoriene vises i.
export const KILDE_KATEGORIER = [
  "Nettsteder",
  "Bøker",
  "Tidsskrifter",
  "Forelesningsnotater",
  "Videoer",
  "Podkaster",
];

// Kilder uten (gyldig) kategori forsvinner ikke stille: de samles her, nederst
// i kortet, så det synes straks at noe må rettes.
export const UKATEGORISERT = "Ukategorisert";

// Samme fargespråk som hub-ikonene, så kategoriene leses som en del av appen.
export const KATEGORI_FARGE = {
  Nettsteder: "#1d4ed8",
  Bøker: "#b45309",
  Tidsskrifter: "#534AB7",
  Forelesningsnotater: "#4d7c0f",
  Videoer: "#dc2626",
  Podkaster: "#0891b2",
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

// Et nettsted med bare ÉN artikkel fortjener ikke sin egen trekant. Er det
// mange slike, samles de i én gruppe nederst i kategorien.
const SAMLE_NAVN = "Enkeltstående nettsteder";
const MIN_SAMLE = 5;

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

export function spraakFor(vert) {
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

const paaNavn = (a, b) => a.tittel.localeCompare(b.tittel, "no");

// Samler en flat liste kilder ({ text, url, kategori }) til:
//   { totalt, unike, kategorier: [{ navn, farge, grupper, unike, bruk }] }
// der hver gruppe er én hovedkilde: { navn, antall (unike artikler), bruk
// (antall steder den er brukt), rader: [{ tittel, url, spraak, bruk, sted }] }.
// Grupper uten rader (bøker, notater) tegnes som én linje uten trekant.
export function samleKilder(liste) {
  const katMap = new Map();
  let totalt = 0;

  for (const k of Array.isArray(liste) ? liste : []) {
    if (!k || typeof k !== "object") continue;
    const tekst = String(k.text || "").trim();
    const url = safeUrl(k.url);
    if (!tekst && !url) continue;
    totalt++;

    const kategori = KILDE_KATEGORIER.includes(k.kategori) ? k.kategori : UKATEGORISERT;
    if (!katMap.has(kategori)) katMap.set(kategori, new Map());
    const grupper = katMap.get(kategori);

    const vert = url ? vertFor(url) : "";
    const navn = vert
      ? ((HENVISERE.has(vert) && publikasjonFraTekst(tekst)) || publikasjonFor(vert))
      : tekst;
    const nokkel = vert ? "v:" + navn : "t:" + tekst.toLowerCase();
    if (!grupper.has(nokkel)) grupper.set(nokkel, { navn, bruk: 0, rader: new Map() });
    const g = grupper.get(nokkel);
    g.bruk++;

    if (!url) continue;
    const rad = g.rader.get(url);
    if (rad) rad.bruk++;
    else g.rader.set(url, { tittel: radTittel(tekst, url), url, spraak: spraakFor(vert), bruk: 1, sted: navn });
  }

  const kategorier = [];
  for (const navn of [...KILDE_KATEGORIER, UKATEGORISERT]) {
    const rå = katMap.get(navn);
    if (!rå || !rå.size) continue;

    let grupper = [...rå.values()].map((g) => ({
      navn: g.navn,
      bruk: g.bruk,
      antall: g.rader.size,
      rader: [...g.rader.values()].sort(paaNavn),
    }));

    // Nettsteder med én eneste artikkel samles nederst — men bare når de er
    // mange nok til at egne trekanter ville blitt støy.
    const enkle = grupper.filter((g) => g.antall === 1);
    let samling = null;
    if (enkle.length >= MIN_SAMLE) {
      grupper = grupper.filter((g) => g.antall !== 1);
      samling = {
        navn: SAMLE_NAVN,
        samling: true,
        antall: enkle.length,
        bruk: enkle.reduce((n, g) => n + g.bruk, 0),
        rader: enkle.flatMap((g) => g.rader).sort(paaNavn),
      };
    }

    grupper.sort((a, b) => b.antall - a.antall || b.bruk - a.bruk || a.navn.localeCompare(b.navn, "no"));
    if (samling) grupper.push(samling);

    kategorier.push({
      navn,
      farge: KATEGORI_FARGE[navn] || KATEGORI_FARGE[UKATEGORISERT],
      grupper,
      // En gruppe uten artikler (bok, notat) teller som én kilde.
      unike: grupper.reduce((n, g) => n + (g.antall || 1), 0),
      bruk: grupper.reduce((n, g) => n + g.bruk, 0),
    });
  }

  return { totalt, unike: kategorier.reduce((n, k) => n + k.unike, 0), kategorier };
}
