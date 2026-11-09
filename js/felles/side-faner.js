// ============================================================================
//  LÆRERHÅNDBOKEN I FANER (v7.27, brukerønske 2026-11-09)
// ----------------------------------------------------------------------------
//  Håndboken er fortsatt én tekst (content/laererHandbok). En linje som
//  begynner med `## ` (to firkanttegn) starter en ny fane, og `### ` er delene
//  inne i fanen som før. Fanene redigeres altså med Rediger, som resten av
//  teksten.
//
//  Låste valg:
//   - Teksten før første fane vises over fanene, på alle fanene.
//   - Uten `## `-linjer tegnes teksten som før, uten faner. En eldre tekst
//     virker derfor til den nye er importert.
//   - Fanen kjennes igjen på navnet, så den valgte fanen står når teksten
//     tegnes på nytt (lagring, import). Forsvinner navnet, velges den første.
//   - Andre tekster bruker ikke dette. Der blir `## ` en mellomtittel som før
//     (renderRichText gjør alle #-nivåer til <h3>).
// ============================================================================

const FANE = /^##(?!#)\s+(.+?)\s*$/;

// { innledning, faner: [{ tittel, tekst }] }. tekst er fanens innhold uten
// fanelinja.
export function sideFaner(body) {
  const innledning = [];
  const faner = [];
  let naa = null;
  for (const linje of String(body || "").replace(/\r\n?/g, "\n").split("\n")) {
    const m = linje.trim().match(FANE);
    if (m) {
      naa = { tittel: m[1], linjer: [] };
      faner.push(naa);
    } else {
      (naa ? naa.linjer : innledning).push(linje);
    }
  }
  return {
    innledning: innledning.join("\n").trim(),
    faner: faner.map((f) => ({ tittel: f.tittel, tekst: f.linjer.join("\n").trim() })),
  };
}

// Plassen til fanen med navnet tittel, ellers den første.
export function valgtFaneIndeks(faner, tittel) {
  const i = (faner || []).findIndex((f) => f.tittel === tittel);
  return i === -1 ? 0 : i;
}
