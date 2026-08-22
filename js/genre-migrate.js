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

import { STORY_ORDER } from "./story-format.js?v=4.66";

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
  // Dokumentet kan OGSÅ bære metasjanger-nivået og sjangerhistorien (etiketter
  // som deler navn med en metasjanger er normen: Blues, Jazz, Gospel, R&B …).
  // Et doc.delete som bare så på sub, utslettet historien i «Det store bildet».
  const harMeta = !!beskrivelse?.meta;
  const harStory = !!beskrivelse?.story;

  const heat = state?.content?.varmekart?.heat || {};
  const harVarmekart = Object.keys(heat).some((k) => lik(k, label));

  const sjekket = (state?.teacherChecks?.genres || []).some((g) => lik(g, label));

  // Nivå-bevisst (shadowing): et forslag med level "sub" gjelder den FRIE
  // undersjangeren som tilfeldigvis deler navn — et annet vokabular. Det skal
  // verken flyttes ved navnebytte eller slettes med tre-sjangeren. Forslag
  // uten level (eldre) regnes som tre-sjangerens.
  const forslag = (state?.pendingEdits || []).filter((e) =>
    e.entityType === "subgenre" && lik(e.entityId, label) && e.level !== "sub");

  // Koblingsbeskrivelser henger på node-ID, ikke etikett, og berøres derfor
  // ikke av et navnebytte. De teller likevel som innhold som forsvinner ved
  // SLETTING, så de rapporteres her.
  const koblinger = node
    ? Object.keys(state?.edgeDescs || {}).filter((k) => {
      const [fra, til] = String(k).split("__");
      return fra === node.id || til === node.id;
    })
    : [];

  return { node, artister, eksempler, friUndersjanger, barn, beskrivelse, harMain, harSub, harMeta, harStory, harVarmekart, sjekket, forslag, koblinger };
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
  if (nyttNavn.includes("/")) feil.push("Navnet kan ikke inneholde «/»: etiketten er dokument-ID i genreDescriptions, og Firestore forbyr det. Bruk «&».");
  // Eksakt likhet, ikke lik(): en ren case-retting («Early hip-hop» →
  // «Early Hip-hop») er en ekte identitetsflytting maskineriet kan utføre
  // (Firestore-ID-er er case-sensitive), og skal ikke avvises.
  if (String(fra ?? "").trim() === nyttNavn) feil.push("Det nye navnet er det samme som det gamle.");

  const kollisjon = noder.find((n) => lik(n.l, nyttNavn) && n.id !== ref.node?.id);
  if (kollisjon) feil.push(`«${nyttNavn}» er allerede etiketten til «${kollisjon.id}».`);

  // Finnes det allerede en MAIN-beskrivelse på det nye navnet, ville flyttingen
  // skrevet over den. Det er tap av tekst, så det blokkeres.
  if (state?.genreDescs?.[nyttNavn]?.main) {
    feil.push(`Det finnes allerede en sjangerbeskrivelse lagret på «${nyttNavn}». Slå dem sammen først.`);
  }
  if (feil.length) return { ops: [], feil, advarsler };

  // 1) Treet
  const nyeNoder = noder.map((n) => (n.id === ref.node.id ? { ...n, l: nyttNavn } : n));
  ops.push(op("doc.replace", "content", "genealogy", { ...tre, nodes: nyeNoder },
    `Treet: «${fra}» heter «${nyttNavn}»`));

  // 2) Beskrivelsen. Dokument-ID-en ER etiketten, så MAIN-nivået flyttes til et
  //    nytt dokument. Et eventuelt SUB-nivå på samme navn blir liggende: det er
  //    en FRI undersjanger som tilfeldigvis heter det samme, ikke tre-sjangeren.
  if (ref.harMain) {
    ops.push(op("doc.merge", "genreDescriptions", nyttNavn, { main: ref.beskrivelse.main },
      `Sjangerbeskrivelsen flyttes til «${nyttNavn}»`));
    // doc.delete KUN når dokumentet ikke bærer noe annet. sub er en fri
    // undersjanger, meta/story er metasjangerens beskrivelse og historie —
    // en sjekk som bare så på sub, slettet historien for etiketter som deler
    // navn med en metasjanger (Blues, Jazz, Gospel, R&B, Hip-hop …).
    if (ref.harSub || ref.harMeta || ref.harStory) {
      ops.push(op("field.delete", "genreDescriptions", fra, { felt: "main" },
        `«${fra}» beholdes for de andre nivåene på samme navn`));
      if (ref.harSub) advarsler.push(`«${fra}» har også en undersjanger-beskrivelse. Den blir liggende igjen på det gamle navnet, som er riktig: den hører til en fri undersjanger, ikke til tre-sjangeren.`);
      if (ref.harMeta || ref.harStory) advarsler.push(`«${fra}» er også en metasjanger. Metasjanger-beskrivelsen og sjangerhistorien blir stående på det gamle navnet, som er riktig: de hører til metasjangeren, ikke tre-sjangeren.`);
    } else {
      ops.push(op("doc.delete", "genreDescriptions", fra, null,
        `Det gamle beskrivelsesdokumentet «${fra}» slettes`));
    }
  } else {
    advarsler.push(`«${fra}» har ingen sjangerbeskrivelse ennå. Ingenting å flytte.`);
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
    advarsler.push(`${ref.eksempler.length} artist(er) har lytteeksempler merket med sjangeren. De følger med.`);
  }

  // 3c) Frie undersjangre med samme navn røres IKKE. De er et annet vokabular,
  //     og et automatisk bytte ville endret noe læreren ikke ba om.
  if (ref.friUndersjanger.length) {
    advarsler.push(`${ref.friUndersjanger.length} artist(er) har «${fra}» som FRI undersjanger. Den taggen står igjen med vilje: den er et eget vokabular, ikke tre-sjangeren. Rett den manuelt om den skulle følge med.`);
  }

  // 4) Varmekartet
  if (ref.harVarmekart) {
    const heat = state.content.varmekart.heat;
    const gammelNokkel = Object.keys(heat).find((k) => lik(k, fra));
    const nyHeat = { ...heat, [nyttNavn]: heat[gammelNokkel] };
    // Ved en ren case-retting kan nøkkelen allerede stå i målformen — da ville
    // delete fjernet raden vi nettopp satte.
    if (gammelNokkel !== nyttNavn) delete nyHeat[gammelNokkel];
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

  return { ops, feil, advarsler };
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
  // Eksakt likhet: en ren case-retting skal gjennom (se planGenreRename).
  if (String(fra ?? "").trim() === nyttNavn) feil.push("Det nye navnet er det samme som det gamle.");
  if (metaer.some((m) => !lik(m.name, fra) && lik(m.name, nyttNavn))) feil.push(`«${nyttNavn}» finnes allerede som metasjanger.`);
  if (state?.genreDescs?.[nyttNavn]?.meta) feil.push(`Det finnes allerede en metasjanger-beskrivelse på «${nyttNavn}».`);
  // Samme vern for historien som for beskrivelsen: doc.merge under ville
  // ellers skrevet over målets sjangerhistorie stille.
  if (state?.genreDescs?.[nyttNavn]?.story) feil.push(`Det finnes allerede en sjangerhistorie på «${nyttNavn}». Slå dem sammen først.`);
  if (feil.length) return { ops: [], feil, advarsler };

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

  // Historie-rekkefølgen er kuratert i koden (js/story-format.js). Visningene
  // leser storyOrder(), som fanger opp det nye navnet, men den flyttede
  // historien havner bakerst blant knappene til lista i koden oppdateres.
  if (STORY_ORDER.includes(fra) && !STORY_ORDER.includes(nyttNavn)) {
    advarsler.push(`«${fra}» står i den kuraterte historie-rekkefølgen i koden. Historien følger med til «${nyttNavn}» og vises fortsatt, men havner bakerst blant historie-knappene til lista i js/story-format.js oppdateres.`);
  }

  return { ops, feil, advarsler };
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
    return { ops: [], feil: [`Fant ingen sjanger med etiketten «${label}».`], advarsler, blokkeringer: [] };
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
  // Lytteeksempler peker også på etiketten (musicExamples[].genre). Uten denne
  // ble de stående foreldreløse: spillelisten for sjangeren forsvant, men
  // taggene levde videre i skjemaene. Samme prinsipp som artist-taggene.
  if (ref.eksempler.length) {
    blokkeringer.push({
      hva: `${ref.eksempler.length} artist(er) har lytteeksempler merket «${label}»`,
      losning: "Endre sjangeren på lytteeksemplene først.",
      detaljer: ref.eksempler.slice(0, 12).map((a) => a.name),
    });
  }
  if (blokkeringer.length) {
    return { ops: [], feil, advarsler, blokkeringer };
  }

  // Fritt fram: slett noden og det som utelukkende hører til den.
  ops.push(op("doc.replace", "content", "genealogy",
    { ...tre, nodes: noder.filter((n) => n.id !== ref.node.id) },
    `Treet: «${label}» fjernes`));

  if (ref.harMain) {
    // Samme vern som ved navnebytte: dokumentet kan bære sub (fri under-
    // sjanger) OG meta/story (metasjangeren) — de skal overleve tre-sjangeren.
    if (ref.harSub || ref.harMeta || ref.harStory) {
      ops.push(op("field.delete", "genreDescriptions", label, { felt: "main" },
        "Sjangerbeskrivelsen slettes (de andre nivåene på samme navn beholdes)"));
    } else {
      ops.push(op("doc.delete", "genreDescriptions", label, null, "Sjangerbeskrivelsen slettes"));
    }
    advarsler.push("Sjangerbeskrivelsen slettes sammen med sjangeren.");
  }
  for (const k of ref.koblinger) {
    ops.push(op("doc.delete", "edgeDescriptions", k, null, `Koblingsbeskrivelse «${k}» slettes`));
  }
  if (ref.koblinger.length) {
    advarsler.push(`${ref.koblinger.length} koblingsbeskrivelse(r) slettes. De gjaldt streker til eller fra denne sjangeren.`);
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

  return { ops, feil, advarsler, blokkeringer: [] };
}

// ----------------------------------------------------------------------------
//  Sletting av en METASJANGER
// ----------------------------------------------------------------------------
//  Modellen utleder hvilke metasjangre som FINNES fra nodene (n.g), ikke fra
//  metaGenres-lista. En metasjanger med sjangre i seg kan derfor ikke bare
//  strykes fra lista: den ville fortsatt stått i kartet, nå uten farge og uten
//  kolonne. Derfor blokkerer vi på nodene, ikke bare på artistene.
//
//  pendingEdits røres ikke. Metasjangere har ikke lenger egne beskrivelser i
//  studentflyten (se showGenreLevelInfo i js/ui.js), så et åpent forslag på
//  navnet tilhører en sjanger eller undersjanger som tilfeldigvis heter det
//  samme — et annet vokabular, som skal overleve.
export function planMetaDelete(state, navn) {
  const feil = [], advarsler = [], ops = [];
  const tre = state?.tree || {};
  const noder = Array.isArray(tre.nodes) ? tre.nodes : [];
  const metaer = Array.isArray(tre.metaGenres) ? tre.metaGenres : [];

  const meta = metaer.find((m) => lik(m.name, navn));
  if (!meta) {
    return { ops: [], feil: [`Fant ingen metasjanger «${navn}».`], advarsler, blokkeringer: [] };
  }

  // HARDE blokkeringer, samme prinsipp som ved sletting av en sjanger: vi
  // flytter aldri en artists tagg eller en sjangers tilhørighet på lærerens
  // vegne. Det er pensumendringer, ikke opprydding.
  const egne = noder.filter((n) => lik(n.g, meta.name));
  const artister = (state?.artists || []).filter((a) => lik(a.metaGenre, meta.name));
  const blokkeringer = [];
  if (egne.length) {
    blokkeringer.push({
      hva: `${egne.length} sjanger(e) ligger i «${meta.name}»`,
      losning: "Flytt dem til en annen metasjanger først, eller slett dem.",
      detaljer: egne.slice(0, 12).map((n) => n.l),
    });
  }
  if (artister.length) {
    blokkeringer.push({
      hva: `${artister.length} artist(er) er tagget med «${meta.name}»`,
      losning: "Tagg dem om til en annen metasjanger først.",
      detaljer: artister.slice(0, 12).map((a) => a.name),
    });
  }
  if (blokkeringer.length) return { ops: [], feil, advarsler, blokkeringer };

  const hint = Array.isArray(tre.metaOrderHint) ? tre.metaOrderHint : [];
  ops.push(op("doc.replace", "content", "genealogy", {
    ...tre,
    metaGenres: metaer.filter((m) => !lik(m.name, meta.name)),
    metaOrderHint: hint.filter((h) => !lik(h, meta.name)),
  }, `Treet: «${meta.name}» fjernes fra metasjangrene og fra den pedagogiske rekkefølgen`));

  // Beskrivelsen OG sjangerhistorien bor begge på metasjangerens
  // genreDescriptions-dokument. Et main- eller sub-nivå på samme navn er et
  // ANNET vokabular (shadowing-fella) og skal bli liggende.
  const desc = state?.genreDescs?.[meta.name];
  const felter = ["meta", "story"].filter((f) => desc?.[f]);
  if (felter.length) {
    if (desc.main || desc.sub) {
      for (const felt of felter) {
        ops.push(op("field.delete", "genreDescriptions", meta.name, { felt },
          felt === "story" ? "Sjangerhistorien slettes" : "Metasjanger-beskrivelsen slettes"));
      }
      advarsler.push(`«${meta.name}» finnes også som sjanger- eller undersjanger-tekst. Den blir liggende, og det er riktig: den hører til et annet vokabular.`);
    } else {
      ops.push(op("doc.delete", "genreDescriptions", meta.name, null,
        `Dokumentet «${meta.name}» slettes`));
    }
    if (desc.story) advarsler.push("Sjangerhistorien i «Det store bildet» forsvinner med metasjangeren.");
  }

  const sjekket = state?.teacherChecks?.metaGenres || [];
  if (sjekket.some((m) => lik(m, meta.name))) {
    ops.push(op("doc.merge", "config", "teacherChecks",
      { metaGenres: sjekket.filter((m) => !lik(m, meta.name)) }, "Avkryssingen fjernes"));
  }

  return { ops, feil, advarsler, blokkeringer: [] };
}

// ----------------------------------------------------------------------------
//  FASE 4 — epoke og lytteforslag ut av treet
// ----------------------------------------------------------------------------
//  `content/genealogy` skal holde STRUKTUR: hvem noden er, hvor den hører til,
//  hvem den vokste ut av. To felter hørte ikke hjemme der:
//
//    era  — epoken som fritekst («midten av 1940-tallet»). Den er innhold, og
//           den er en unøyaktig utgave av activeFrom/activeTo, som allerede bor
//           i genreDescriptions. At de lå to steder gjorde at sjangerkortet og
//           sjangertidslinjen kunne vise ULIK epoke for samme sjanger, og at
//           læreren måtte redigere dem i to forskjellige editorer.
//    t    — kuraterte lytteforslag. Rundt 100 forfattede eksempler som ingenting
//           i appen leste; de var usynlige for alle.
//
//  Begge flyttes til `genreDescriptions[etikett].main` som `era` og `lytt`.
//  Skriving skjer med merge, som er RIKTIG her: main er en map, og description,
//  kilder og årstallene skal bli stående urørt ved siden av.
//
//  Etiketten er dokument-ID-en, og skriving bruker ALLTID den (aldri fullnavnet)
//  — samme regel som resten av appen.
export function planTreeCleanup(state) {
  const feil = [], advarsler = [], ops = [];
  const tre = state?.tree || {};
  const noder = Array.isArray(tre.nodes) ? tre.nodes : [];
  if (!noder.length) {
    return { ops: [], feil: ["Sjangertreet er ikke lastet inn."], advarsler, blokkeringer: [] };
  }

  const berorte = noder.filter((n) => String(n.era || "").trim() || (Array.isArray(n.t) && n.t.length));
  if (!berorte.length) {
    return {
      ops: [], advarsler, blokkeringer: [],
      feil: ["Treet er allerede rent: ingen noder har epoke eller lytteforslag igjen."],
    };
  }

  for (const n of berorte) {
    const data = {};
    const era = String(n.era || "").trim();
    const lytt = (Array.isArray(n.t) ? n.t : []).map((x) => String(x || "").trim()).filter(Boolean);
    if (era) data.era = era;
    if (lytt.length) data.lytt = lytt;

    // Skriver vi over noe som allerede står der? Det skal ikke kunne skje
    // (feltene er nye i genreDescriptions), men hvis migreringen kjøres to
    // ganger med ulikt tre, vil vi vite om det framfor å overskrive stille.
    const fins = state?.genreDescs?.[n.l]?.main;
    if (fins?.era && fins.era !== era) {
      advarsler.push(`«${n.l}» har allerede epoke-teksten «${fins.era}»; den erstattes av «${era}».`);
    }

    const hva = [era ? "epoke" : null, lytt.length ? `${lytt.length} lytteforslag` : null].filter(Boolean).join(" og ");
    ops.push(op("doc.merge", "genreDescriptions", n.l, { main: data }, `${n.l}: ${hva}`));
  }

  // Treet skrives HELT, ikke merget: merge kan ikke fjerne et felt, og hele
  // poenget her er at era og t skal bort.
  ops.push(op("doc.replace", "content", "genealogy", {
    ...tre,
    nodes: noder.map((n) => {
      const { era, t, ...rest } = n;    // eslint-disable-line no-unused-vars
      return rest;
    }),
  }, "Treet: epoke og lytteforslag fjernes fra alle nodene"));

  const utenBeskrivelse = berorte.filter((n) => !state?.genreDescs?.[n.l]?.main);
  if (utenBeskrivelse.length) {
    advarsler.push(`${utenBeskrivelse.length} sjanger(e) har ingen beskrivelse ennå (${utenBeskrivelse.map((n) => n.l).join(", ")}). De får et dokument med bare epoke og lytteforslag, og det er meningen.`);
  }

  return { ops, feil, advarsler, blokkeringer: [] };
}

// ----------------------------------------------------------------------------
//  Trygge endringer — treet slik det SKAL BLI
// ----------------------------------------------------------------------------
// Merk skillet mot resten av fila: identitetsendringer returnerer en PLAN som
// utføres i én batch, mens de trygge returnerer et TRE som store.js skriver rett
// med saveGenealogyTree. Logikken ligger her likevel, fordi den er ren og må
// kunne testes — js/teacher-genres.js drar inn Firebase og kan ikke lastes i en
// node-test.
//
// Bygger treet en lagring VILLE skrevet:
// rekkefølgen er det eneste her som kan gå galt STILLE — en feil stokker om på
// kartet eller den pedagogiske rangeringen uten at noe ser ødelagt ut.
//
// Navnet settes IKKE her ved redigering. Et navnebytte flytter en identitet og
// går gjennom migreringsplanen, akkurat som for en node, så treet skrives med
// det gamle navnet og planen bytter det etterpå.
//
// families leses fra treet, ikke fra modulens FAMILIES: da kan funksjonen
// kalles uten at modellen er bygget, som i en test.
export function byggMetaTre(t, { gammel, navn, fam, kartPlass, hintPlass }) {
  const oppdatert = { ...(gammel || { name: navn }), fam };
  const farge = t.families?.[fam]?.stroke;
  if (farge) oppdatert.color = farge;

  // Kolonnene nummereres 0..n-1 på nytt etter innsettingen, så de aldri kan få
  // hull eller duplikater uansett hva de sto på før.
  const andre = [...(t.metaGenres || [])]
    .sort((a, b) => (a.column ?? 0) - (b.column ?? 0))
    .filter((x) => x !== gammel);
  andre.splice(kartPlass, 0, oppdatert);

  // Bare DENNE metasjangeren flyttes i hintet. De andre beholder rekkefølgen
  // seg imellom, så et lagre aldri rører noe læreren ikke har tatt i.
  const hint = (t.metaOrderHint || []).filter((h) => h !== gammel?.name);
  hint.splice(hintPlass, 0, oppdatert.name);

  return { ...t, metaGenres: andre.map((x, i) => ({ ...x, column: i })), metaOrderHint: hint };
}

// De TRYGGE endringene (fullt navn, epoke, foreldre, rad, farge, ny node, ny
// metasjanger) har ingen plan: ingen andre samlinger peker på dem, så editoren
// skriver treet rett via store.js: saveGenealogyTree. En planlagt variant fantes
// her en periode uten å bli tatt i bruk, og er fjernet — én skrivevei for de
// trygge endringene er lettere å holde riktig enn to.

// Firestore tar maks 500 operasjoner i én batch. En plan over det kan ikke
// utføres atomisk, og da vil vi heller si fra enn å skrive halvveis.
export const BATCH_MAX = 500;
export function planPasserIBatch(plan) {
  return (plan?.ops?.length || 0) <= BATCH_MAX;
}
