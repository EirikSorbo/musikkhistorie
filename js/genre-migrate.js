// ============================================================================
//  MIGRERING AV SJANGERTREET — planlegging, ikke skriving
// ----------------------------------------------------------------------------
//  Å bytte navn på en sjanger er ikke en feltendring. Etiketten er en IDENTITET
//  som resten av databasen peker på:
//
//    · content/genealogy      nodens l (og g, for metasjangre)
//    · genreDescriptions      DOKUMENT-ID-en er etiketten
//    · artists                mainGenre-taggene (og metaGenre)
//    · content/varmekart      heat-radene er nøklet på etiketten
//    · config/teacherChecks   genres/metaGenres er navnelister
//    · pendingEdits           entityId for et sjangerforslag ER etiketten
//
//  Endrer man bare treet, blir alt det andre foreldreløst i stillhet: artisten
//  står igjen med en sjanger som ikke finnes, varmekartraden blir en foreldreløs
//  nøkkel, og beskrivelsen blir usynlig fordi ingen slår opp det gamle navnet.
//
//  Derfor: modulen PLANLEGGER. Hver funksjon returnerer hva som må skje, uten å
//  skrive noe. Da kan læreren se konsekvensen før hun bekrefter, og planen kan
//  enhetstestes uten database. Selve skrivingen gjør js/store.js.
//
//  NODE-ID-er byttes ALDRI. edgeDescriptions har «fra__til» som dokument-ID, og
//  et id-bytte ville gjort alle koblingsbeskrivelsene foreldreløse. Det var
//  nettopp derfor v4.38 beholdt id-ene da tre sjangre skiftet navn.
// ============================================================================

const lower = (s) => String(s ?? "").trim().toLowerCase();
const lik = (a, b) => lower(a) === lower(b) && lower(a) !== "";

// En operasjon planen kan inneholde. `hva` er teksten læreren får se.
const op = (type, coll, id, data, hva) => ({ type, coll, id, data, hva });

// ----------------------------------------------------------------------------
//  Hvem peker på denne sjangeren?
// ----------------------------------------------------------------------------
// Brukes både av navnebytte (for å vise omfang) og av sletting (for å blokkere).
export function findReferences(state, label) {
  const tre = state?.tree || {};
  const noder = Array.isArray(tre.nodes) ? tre.nodes : [];
  const node = noder.find((n) => lik(n.l, label)) || null;

  const artister = (state?.artists || []).filter((a) =>
    (Array.isArray(a.mainGenre) ? a.mainGenre : []).some((g) => lik(g, label)));

  // Sjangeren er også et valg per LYTTEEKSEMPEL (musicExamples[].genre, v3.64).
  // De peker på etiketten og blir foreldreløse ved navnebytte hvis de glemmes.
  const eksempler = (state?.artists || []).filter((a) =>
    (Array.isArray(a.musicExamples) ? a.musicExamples : []).some((e) => lik(e?.genre, label)));

  // subGenre er et FRITT vokabular. At en fri undersjanger tilfeldigvis heter
  // det samme som en tre-sjanger betyr ikke at den ER den (se shadowing-fella i
  // genreDescriptions). Vi teller dem, men endrer dem ALDRI automatisk.
  const friUndersjanger = (state?.artists || []).filter((a) =>
    (Array.isArray(a.subGenre) ? a.subGenre : []).some((g) => lik(g, label)));

  // Barn = noder som har denne som forelder eller motreaksjon.
  const barn = node
    ? noder.filter((n) => [...(n.p || []), ...(n.rx || [])].includes(node.id))
    : [];

  const beskrivelse = state?.genreDescs?.[label] || null;
  const harMain = !!beskrivelse?.main;
  const harSub = !!beskrivelse?.sub;

  const heat = state?.content?.varmekart?.heat || {};
  const harVarmekart = Object.keys(heat).some((k) => lik(k, label));

  const sjekket = (state?.teacherChecks?.genres || []).some((g) => lik(g, label));

  const forslag = (state?.pendingEdits || []).filter((e) =>
    e.entityType === "subgenre" && lik(e.entityId, label));

  // Koblingsbeskrivelser henger på node-ID, ikke etikett, og berøres derfor
  // ikke av et navnebytte. De teller likevel som innhold som forsvinner ved
  // SLETTING, så de rapporteres her.
  const koblinger = node
    ? Object.keys(state?.edgeDescs || {}).filter((k) => {
      const [fra, til] = String(k).split("__");
      return fra === node.id || til === node.id;
    })
    : [];

  return { node, artister, eksempler, friUndersjanger, barn, beskrivelse, harMain, harSub, harVarmekart, sjekket, forslag, koblinger };
}

// ----------------------------------------------------------------------------
//  Navnebytte på en tre-sjanger (etiketten)
// ----------------------------------------------------------------------------
export function planGenreRename(state, fra, til) {
  const feil = [], advarsler = [], ops = [];
  const nyttNavn = String(til ?? "").trim();
  const tre = state?.tree || {};
  const noder = Array.isArray(tre.nodes) ? tre.nodes : [];

  const ref = findReferences(state, fra);
  if (!ref.node) feil.push(`Fant ingen sjanger med etiketten «${fra}».`);
  if (!nyttNavn) feil.push("Det nye navnet er tomt.");
  if (nyttNavn.includes("/")) feil.push("Navnet kan ikke inneholde «/» — etiketten er dokument-ID i genreDescriptions, og Firestore forbyr det. Bruk «&».");
  if (lik(fra, nyttNavn)) feil.push("Det nye navnet er det samme som det gamle.");

  const kollisjon = noder.find((n) => lik(n.l, nyttNavn) && n.id !== ref.node?.id);
  if (kollisjon) feil.push(`«${nyttNavn}» er allerede etiketten til «${kollisjon.id}».`);

  // Finnes det allerede en MAIN-beskrivelse på det nye navnet, ville flyttingen
  // skrevet over den. Det er tap av tekst, så det blokkeres.
  if (state?.genreDescs?.[nyttNavn]?.main) {
    feil.push(`Det finnes allerede en sjangerbeskrivelse lagret på «${nyttNavn}». Slå dem sammen først.`);
  }
  if (feil.length) return { ops: [], feil, advarsler, oppsummering: [] };

  // 1) Treet
  const nyeNoder = noder.map((n) => (n.id === ref.node.id ? { ...n, l: nyttNavn } : n));
  ops.push(op("doc.merge", "content", "genealogy", { ...tre, nodes: nyeNoder },
    `Treet: «${fra}» heter «${nyttNavn}»`));

  // 2) Beskrivelsen. Dokument-ID-en ER etiketten, så MAIN-nivået flyttes til et
  //    nytt dokument. Et eventuelt SUB-nivå på samme navn blir liggende: det er
  //    en FRI undersjanger som tilfeldigvis heter det samme, ikke tre-sjangeren.
  if (ref.harMain) {
    ops.push(op("doc.merge", "genreDescriptions", nyttNavn, { main: ref.beskrivelse.main },
      `Sjangerbeskrivelsen flyttes til «${nyttNavn}»`));
    if (ref.harSub) {
      ops.push(op("field.delete", "genreDescriptions", fra, { felt: "main" },
        `«${fra}» beholdes for undersjanger-teksten med samme navn`));
      advarsler.push(`«${fra}» har også en undersjanger-beskrivelse. Den blir liggende igjen på det gamle navnet, som er riktig: den hører til en fri undersjanger, ikke til tre-sjangeren.`);
    } else {
      ops.push(op("doc.delete", "genreDescriptions", fra, null,
        `Det gamle beskrivelsesdokumentet «${fra}» slettes`));
    }
  } else {
    advarsler.push(`«${fra}» har ingen sjangerbeskrivelse ennå — ingenting å flytte.`);
  }

  // 3) Artistene
  for (const a of ref.artister) {
    const nye = a.mainGenre.map((g) => (lik(g, fra) ? nyttNavn : g));
    ops.push(op("doc.merge", "artists", a.id, { mainGenre: nye },
      `Artist: ${a.name}`));
  }
  if (ref.artister.length) {
    advarsler.push(`${ref.artister.length} artist(er) blir tagget om.`);
  }

  // 3b) Sjangeren på lytteeksemplene. Artister som allerede får en skriving
  //     over, får eksemplene med i samme operasjon.
  for (const a of ref.eksempler) {
    const nyeEks = a.musicExamples.map((e) => (lik(e?.genre, fra) ? { ...e, genre: nyttNavn } : e));
    const alt = ops.find((o) => o.coll === "artists" && o.id === a.id);
    if (alt) alt.data = { ...alt.data, musicExamples: nyeEks };
    else ops.push(op("doc.merge", "artists", a.id, { musicExamples: nyeEks },
      `Lytteeksempel hos ${a.name}`));
  }
  if (ref.eksempler.length) {
    advarsler.push(`${ref.eksempler.length} artist(er) har lytteeksempler merket med sjangeren — de følger med.`);
  }

  // 3c) Frie undersjangre med samme navn røres IKKE. De er et annet vokabular,
  //     og et automatisk bytte ville endret noe læreren ikke ba om.
  if (ref.friUndersjanger.length) {
    advarsler.push(`${ref.friUndersjanger.length} artist(er) har «${fra}» som FRI undersjanger. Den taggen står igjen med vilje — den er et eget vokabular, ikke tre-sjangeren. Rett den manuelt om den skulle følge med.`);
  }

  // 4) Varmekartet
  if (ref.harVarmekart) {
    const heat = state.content.varmekart.heat;
    const gammelNokkel = Object.keys(heat).find((k) => lik(k, fra));
    const nyHeat = { ...heat, [nyttNavn]: heat[gammelNokkel] };
    delete nyHeat[gammelNokkel];
    // doc.replace, IKKE merge: Firestore dyp-fletter map-felter, så med merge
    // ville den GAMLE heat-nøkkelen blitt liggende igjen ved siden av den nye.
    ops.push(op("doc.replace", "content", "varmekart",
      { ...state.content.varmekart, heat: nyHeat },
      "Varmekartraden følger med (gammel nøkkel fjernes)"));
  }

  // 5) Lærerens avkryssing
  if (ref.sjekket) {
    const liste = (state.teacherChecks.genres || []).map((g) => (lik(g, fra) ? nyttNavn : g));
    ops.push(op("doc.merge", "config", "teacherChecks", { genres: liste },
      "Avkryssingen følger med"));
  }

  // 6) Åpne forslag fra studenter
  for (const e of ref.forslag) {
    ops.push(op("doc.merge", "pendingEdits", e.id, { entityId: nyttNavn, entityName: nyttNavn },
      `Åpent forslag følger med`));
  }

  return {
    ops, feil, advarsler,
    oppsummering: byggOppsummering(ref, { nyttNavn }),
  };
}

// ----------------------------------------------------------------------------
//  Navnebytte på en METASJANGER
// ----------------------------------------------------------------------------
export function planMetaRename(state, fra, til) {
  const feil = [], advarsler = [], ops = [];
  const nyttNavn = String(til ?? "").trim();
  const tre = state?.tree || {};
  const noder = Array.isArray(tre.nodes) ? tre.nodes : [];
  const metaer = Array.isArray(tre.metaGenres) ? tre.metaGenres : [];

  if (!metaer.some((m) => lik(m.name, fra))) feil.push(`Fant ingen metasjanger «${fra}».`);
  if (!nyttNavn) feil.push("Det nye navnet er tomt.");
  if (nyttNavn.includes("/")) feil.push("Navnet kan ikke inneholde «/».");
  if (lik(fra, nyttNavn)) feil.push("Det nye navnet er det samme som det gamle.");
  if (metaer.some((m) => lik(m.name, nyttNavn))) feil.push(`«${nyttNavn}» finnes allerede som metasjanger.`);
  if (state?.genreDescs?.[nyttNavn]?.meta) feil.push(`Det finnes allerede en metasjanger-beskrivelse på «${nyttNavn}».`);
  if (feil.length) return { ops: [], feil, advarsler, oppsummering: [] };

  const berorteNoder = noder.filter((n) => lik(n.g, fra));
  // metaOrderHint er en NAVNELISTE som rangerer metasjangrene pedagogisk
  // (varmekartet og tidslinjen leser den). Glemmes den, faller metasjangeren
  // stille bakerst i rekkefølgen uten at noe ser galt ut.
  const hint = Array.isArray(tre.metaOrderHint) ? tre.metaOrderHint : [];
  ops.push(op("doc.replace", "content", "genealogy", {
    ...tre,
    nodes: noder.map((n) => (lik(n.g, fra) ? { ...n, g: nyttNavn } : n)),
    metaGenres: metaer.map((m) => (lik(m.name, fra) ? { ...m, name: nyttNavn } : m)),
    metaOrderHint: hint.map((h) => (lik(h, fra) ? nyttNavn : h)),
  }, `Treet: metasjangeren, ${berorteNoder.length} sjanger(e) og den pedagogiske rekkefølgen`));

  // Beskrivelsen OG sjangerhistorien. Historien er et `story`-felt på
  // metasjangerens genreDescriptions-dokument (ikke en egen samling), så den
  // må flyttes i samme slengen — ellers blir fortellingen borte fra huben.
  const desc = state?.genreDescs?.[fra];
  const flyttes = {};
  if (desc?.meta) flyttes.meta = desc.meta;
  if (desc?.story) flyttes.story = desc.story;
  if (Object.keys(flyttes).length) {
    const hva = Object.keys(flyttes).map((k) => (k === "story" ? "sjangerhistorien" : "metasjanger-beskrivelsen")).join(" og ");
    ops.push(op("doc.merge", "genreDescriptions", nyttNavn, flyttes, `${hva} flyttes`));
    if (desc.main || desc.sub) {
      for (const felt of Object.keys(flyttes)) {
        ops.push(op("field.delete", "genreDescriptions", fra, { felt },
          `«${fra}» beholdes for de andre nivåene`));
      }
    } else {
      ops.push(op("doc.delete", "genreDescriptions", fra, null, `Gammelt dokument slettes`));
    }
  } else {
    advarsler.push(`«${fra}» har verken metasjanger-beskrivelse eller sjangerhistorie ennå.`);
  }

  const artister = (state?.artists || []).filter((a) => lik(a.metaGenre, fra));
  for (const a of artister) {
    ops.push(op("doc.merge", "artists", a.id, { metaGenre: nyttNavn }, `Artist: ${a.name}`));
  }
  if (artister.length) advarsler.push(`${artister.length} artist(er) blir tagget om.`);

  const sjekket = (state?.teacherChecks?.metaGenres || []);
  if (sjekket.some((m) => lik(m, fra))) {
    ops.push(op("doc.merge", "config", "teacherChecks",
      { metaGenres: sjekket.map((m) => (lik(m, fra) ? nyttNavn : m)) }, "Avkryssingen følger med"));
  }

  return {
    ops, feil, advarsler,
    oppsummering: [
      `${berorteNoder.length} sjanger(e) flyttes til «${nyttNavn}»`,
      `${artister.length} artist(er) tagges om`,
      desc?.meta ? "beskrivelsen følger med" : "ingen beskrivelse å flytte",
      desc?.story ? "sjangerhistorien følger med" : "ingen sjangerhistorie",
    ],
  };
}

// ----------------------------------------------------------------------------
//  Sletting — blokkeres når noe ville blitt foreldreløst
// ----------------------------------------------------------------------------
export function planGenreDelete(state, label) {
  const feil = [], advarsler = [], ops = [];
  const tre = state?.tree || {};
  const noder = Array.isArray(tre.nodes) ? tre.nodes : [];
  const ref = findReferences(state, label);

  if (!ref.node) {
    return { ops: [], feil: [`Fant ingen sjanger med etiketten «${label}».`], advarsler, oppsummering: [], blokkeringer: [] };
  }

  // HARDE blokkeringer: ting som ville blitt foreldreløse og som læreren må
  // rydde selv. Vi sletter ALDRI en artists tagg eller en annen sjangers
  // slektskap på vegne av henne — det er pensumendringer, ikke opprydding.
  const blokkeringer = [];
  if (ref.artister.length) {
    blokkeringer.push({
      hva: `${ref.artister.length} artist(er) er tagget med «${label}»`,
      losning: "Tagg dem om til en annen sjanger først.",
      detaljer: ref.artister.slice(0, 12).map((a) => a.name),
    });
  }
  if (ref.barn.length) {
    blokkeringer.push({
      hva: `${ref.barn.length} sjanger(e) har «${label}» som forelder`,
      losning: "Gi dem en annen forelder først, ellers mister de slektskapet sitt.",
      detaljer: ref.barn.map((n) => n.l),
    });
  }
  if (blokkeringer.length) {
    return { ops: [], feil, advarsler, blokkeringer, oppsummering: [] };
  }

  // Fritt fram: slett noden og det som utelukkende hører til den.
  ops.push(op("doc.merge", "content", "genealogy",
    { ...tre, nodes: noder.filter((n) => n.id !== ref.node.id) },
    `Treet: «${label}» fjernes`));

  if (ref.harMain) {
    if (ref.harSub) {
      ops.push(op("field.delete", "genreDescriptions", label, { felt: "main" },
        "Sjangerbeskrivelsen slettes (undersjanger-teksten beholdes)"));
    } else {
      ops.push(op("doc.delete", "genreDescriptions", label, null, "Sjangerbeskrivelsen slettes"));
    }
    advarsler.push("Sjangerbeskrivelsen slettes sammen med sjangeren.");
  }
  for (const k of ref.koblinger) {
    ops.push(op("doc.delete", "edgeDescriptions", k, null, `Koblingsbeskrivelse «${k}» slettes`));
  }
  if (ref.koblinger.length) {
    advarsler.push(`${ref.koblinger.length} koblingsbeskrivelse(r) slettes — de gjaldt streker til eller fra denne sjangeren.`);
  }
  if (ref.harVarmekart) {
    const heat = { ...state.content.varmekart.heat };
    const nokkel = Object.keys(heat).find((k) => lik(k, label));
    delete heat[nokkel];
    ops.push(op("doc.replace", "content", "varmekart", { ...state.content.varmekart, heat },
      "Varmekartraden fjernes"));
  }
  if (ref.sjekket) {
    ops.push(op("doc.merge", "config", "teacherChecks",
      { genres: (state.teacherChecks.genres || []).filter((g) => !lik(g, label)) },
      "Avkryssingen fjernes"));
  }
  for (const e of ref.forslag) {
    ops.push(op("doc.delete", "pendingEdits", e.id, null, "Åpent forslag på sjangeren slettes"));
  }

  return { ops, feil, advarsler, blokkeringer: [], oppsummering: byggOppsummering(ref, {}) };
}

// ----------------------------------------------------------------------------
//  Trygge operasjoner — ren tilføyelse/endring uten identitetsflytting
// ----------------------------------------------------------------------------
// Alt som IKKE rører etiketten eller id-en kan skrives rett: nytt fullt navn,
// ny epoke, nye foreldre, ny rad, ny metasjanger, fargeunntak, nye noder.
export function planTreeUpdate(tree, hva = "Treet oppdatert") {
  return { ops: [op("doc.replace", "content", "genealogy", tree, hva)], feil: [], advarsler: [], oppsummering: [] };
}

function byggOppsummering(ref, { nyttNavn }) {
  const ut = [];
  if (nyttNavn) ut.push(`Ny etikett: «${nyttNavn}»`);
  ut.push(`${ref.artister.length} artist(er)`);
  ut.push(ref.harMain ? "1 sjangerbeskrivelse" : "ingen beskrivelse");
  if (ref.harVarmekart) ut.push("1 varmekartrad");
  if (ref.sjekket) ut.push("avkryssing");
  if (ref.forslag.length) ut.push(`${ref.forslag.length} åpent forslag`);
  if (ref.koblinger.length) ut.push(`${ref.koblinger.length} koblingsbeskrivelse(r)`);
  return ut;
}

// Firestore tar maks 500 operasjoner i én batch. En plan over det kan ikke
// utføres atomisk, og da vil vi heller si fra enn å skrive halvveis.
export const BATCH_MAX = 500;
export function planPasserIBatch(plan) {
  return (plan?.ops?.length || 0) <= BATCH_MAX;
}
