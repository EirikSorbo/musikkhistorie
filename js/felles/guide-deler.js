// ============================================================================
//  «SLIK BRUKER DU APPEN» I DELER (v6.95, brukervalg 2026-10-13)
// ----------------------------------------------------------------------------
//  Bruksveiledningen (content/appGuide) er én tekst, men hver `### `-overskrift
//  er en del som kan vises for studentene for seg. Avhukingene står under
//  «Slik bruker du appen» i «Synlig for studentene» på Skrivebordet og lagres
//  som content/synlighet.guide: lista over overskriftene som er SYNLIGE.
//
//  Låste valg:
//   - Bryteren «Slik bruker du appen» er fortsatt hovedbryteren (hubkortet).
//   - En del som ikke står i lista, er skjult. En ny overskrift er altså skjult
//     til læreren huker den av.
//   - Teksten før første overskrift (innledningen) vises alltid.
//   - Guiden er unntatt «Bare sjekket innhold»: avhukingene alene styrer den.
//   - Læreren ser alle delene, de skjulte merket. Lerretet følger studentene,
//     og QA-bryteren i visningen viser alt (guideDelSynlig i feature-flags.js).
//
//  Delene kjennes igjen på overskriftsteksten. Får en overskrift ny ordlyd,
//  er den en ny del og må hukes av på nytt.
// ============================================================================

const OVERSKRIFT = /^###\s+(.+?)\s*$/;

// { innledning, deler: [{ tittel, tekst }] }. tekst er hele delen, med
// overskriftslinja, så den kan tegnes for seg eller settes sammen igjen.
export function guideDeler(body) {
  const linjer = String(body || "").split("\n");
  const innledning = [];
  const deler = [];
  let naa = null;
  for (const linje of linjer) {
    const m = linje.match(OVERSKRIFT);
    if (m) {
      naa = { tittel: m[1].trim(), linjer: [linje] };
      deler.push(naa);
    } else if (naa) {
      naa.linjer.push(linje);
    } else {
      innledning.push(linje);
    }
  }
  return {
    innledning: innledning.join("\n").trim(),
    deler: deler.map((d) => ({ tittel: d.tittel, tekst: d.linjer.join("\n").trim() })),
  };
}

export function guideTitler(body) {
  return guideDeler(body).deler.map((d) => d.tittel);
}

// Teksten studentene får: innledningen og de synlige delene, i tekstens
// rekkefølge. synlig(tittel) avgjør hver del.
export function guideForStudent(body, synlig) {
  const { innledning, deler } = guideDeler(body);
  return [innledning, ...deler.filter((d) => synlig(d.tittel)).map((d) => d.tekst)]
    .filter(Boolean)
    .join("\n\n");
}
