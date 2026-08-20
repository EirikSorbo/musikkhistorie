// ============================================================================
//  VALIDERING AV SJANGERTREET
// ----------------------------------------------------------------------------
//  Treet er data nå, og data kan være ødelagt: en import kan mangle en forelder,
//  to noder kan ha samme etikett (etiketten er dokument-ID i genreDescriptions,
//  så et duplikat ville gjort to sjangre om til én tekst), og en re-parenting
//  kan lage en sykel som får kart-tegningen til å gå i uendelig løkke.
//
//  Brukes av importen (avvis før skriving) og av testene. Rene funksjoner uten
//  DOM, så de kan kjøres i node.
// ============================================================================

// Returnerer en liste med problemer. Tom liste = treet er i orden.
// Hvert problem: { nivå: "feil" | "advarsel", melding }
export function validateTree(tree) {
  const problemer = [];
  const feil = (melding) => problemer.push({ nivå: "feil", melding });
  const advar = (melding) => problemer.push({ nivå: "advarsel", melding });

  const nodes = tree?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    feil("Treet mangler noder.");
    return problemer;
  }

  const idSett = new Set();
  const etikettSett = new Map();     // etikett i småbokstaver → første id
  for (const n of nodes) {
    if (!n || typeof n.id !== "string" || !n.id.trim()) { feil(`Node uten id: ${JSON.stringify(n)?.slice(0, 60)}`); continue; }
    if (idSett.has(n.id)) feil(`To noder har id «${n.id}».`);
    idSett.add(n.id);

    if (typeof n.l !== "string" || !n.l.trim()) { feil(`Noden «${n.id}» mangler etikett (l).`); continue; }
    // Etiketten er dokument-ID i genreDescriptions. Firestore forbyr «/».
    if (n.l.includes("/")) feil(`Etiketten «${n.l}» inneholder «/», som ikke er lov i en dokument-ID. Bruk «&».`);
    const nøkkel = n.l.toLowerCase();
    if (etikettSett.has(nøkkel)) feil(`Etiketten «${n.l}» brukes av både «${etikettSett.get(nøkkel)}» og «${n.id}».`);
    else etikettSett.set(nøkkel, n.id);

    if (!Number.isFinite(n.r)) feil(`Noden «${n.id}» mangler rad (r).`);
  }

  // Foreldre og motreaksjoner må peke på noder som finnes.
  for (const n of nodes) {
    for (const felt of ["p", "rx"]) {
      const liste = n?.[felt];
      if (liste == null) continue;
      if (!Array.isArray(liste)) { feil(`«${n.id}».${felt} er ikke en liste.`); continue; }
      for (const pid of liste) {
        if (!idSett.has(pid)) feil(`«${n.id}» viser til «${pid}» i ${felt}, men den noden finnes ikke.`);
        if (pid === n.id) feil(`«${n.id}» er sin egen forelder.`);
      }
    }
  }

  // Metasjangre: hver g-verdi bør være deklarert, så editoren har noe å vise.
  const deklarerte = new Set((tree.metaGenres || []).map((m) => (typeof m === "string" ? m : m?.name)).filter(Boolean));
  if (deklarerte.size) {
    for (const n of nodes) {
      if (n.g && !deklarerte.has(n.g)) advar(`«${n.id}» har metasjangeren «${n.g}», som ikke er deklarert i metaGenres.`);
    }
  }

  // Familiefarger: en node som peker på en familie som ikke finnes, tegnes grå.
  const famner = new Set(Object.keys(tree.families || {}));
  if (famner.size) {
    for (const n of nodes) {
      if (n.fam && !famner.has(n.fam)) advar(`«${n.id}» bruker familien «${n.fam}», som ikke finnes i families.`);
    }
  }

  problemer.push(...finnSykler(nodes, idSett));
  return problemer;
}

// Sykel = en node som er sin egen stamfar. Ville fått ane-oppslaget i kartet til
// å gå i ring. Dybde-først med tre farger.
function finnSykler(nodes, idSett) {
  const ut = [];
  const foreldre = new Map(nodes.map((n) => [n.id, [
    ...(Array.isArray(n.p) ? n.p : []),
    ...(Array.isArray(n.rx) ? n.rx : []),
  ].filter((id) => idSett.has(id))]));
  const farge = new Map();           // 1 = under besøk, 2 = ferdig
  const sti = [];

  function gå(id) {
    if (farge.get(id) === 2) return;
    if (farge.get(id) === 1) {
      const fra = sti.indexOf(id);
      ut.push({ nivå: "feil", melding: `Sykel i slektskapet: ${[...sti.slice(fra), id].join(" → ")}` });
      return;
    }
    farge.set(id, 1);
    sti.push(id);
    for (const p of foreldre.get(id) || []) gå(p);
    sti.pop();
    farge.set(id, 2);
  }

  for (const n of nodes) gå(n.id);
  return ut;
}

// Kortform: kaster hvis treet har FEIL (advarsler slipper gjennom).
export function assertTreeOk(tree, hvor = "treet") {
  const feil = validateTree(tree).filter((p) => p.nivå === "feil");
  if (feil.length) {
    throw new Error(`Ugyldig sjangertre i ${hvor}:\n· ` + feil.map((f) => f.melding).join("\n· "));
  }
}
