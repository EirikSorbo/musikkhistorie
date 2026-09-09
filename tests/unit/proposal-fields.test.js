import { test } from "node:test";
import assert from "node:assert/strict";
import { PROPOSABLE_KEYS, proposableKeysFor } from "../../js/proposal-fields.js?v=5.12";

// Privilegie-/systemfelter som ALDRI skal kunne skrives via et endringsforslag.
const FORBIDDEN = ["status", "priority", "votedUpBy", "teacherChecked", "proposedBy", "removedBy", "addedYear", "createdAt"];

test("artist-hvitelisten utelater alle privilegiefelter", () => {
  for (const key of FORBIDDEN) {
    assert.equal(PROPOSABLE_KEYS.artist.includes(key), false, `artist skal ikke tillate ${key}`);
  }
});

test("artist-hvitelisten inneholder de reelle innholdsfeltene", () => {
  for (const key of ["name", "description", "mainGenre", "metaGenre", "influenceStart", "imageUrl"]) {
    assert.equal(PROPOSABLE_KEYS.artist.includes(key), true, `artist skal tillate ${key}`);
  }
  // v5.00: rad-feltene er foreslåbare. Uten dem kunne en student ikke foreslå
  // et lytteeksempel til en artist som allerede lå inne.
  for (const key of ["keyWorks", "musicExamples", "kilder"]) {
    assert.equal(PROPOSABLE_KEYS.artist.includes(key), true, `artist skal tillate rad-feltet ${key}`);
  }
});

test("tech/subgenre/decade-hvitelistene utelater status og andre systemfelter", () => {
  assert.equal(PROPOSABLE_KEYS.tech.includes("status"), false);
  // v4.97: BEGGE årstallene må være foreslåbare. Fram til da sto kun
  // adoptedYear i lista, med etiketten «Oppfunnet» i skjemaet — en student som
  // rettet oppfinnelsesåret skrev i praksis til året kortet plasseres etter på
  // teknologitidslinjen. Holdes i synk med FIELD_SPECS.tech og firestore.rules
  // (BÅDE tech-create og pendingEdits-create).
  for (const key of ["inventedYear", "adoptedYear", "adoptedLabel"]) {
    assert.equal(PROPOSABLE_KEYS.tech.includes(key), true, `tech skal tillate ${key}`);
  }
  // Sjangre: beskrivelse, epoke-årstallene og kilder er foreslåbare — men
  // ingen systemfelter. Holdes i synk med FIELD_SPECS.subgenre i proposals.js.
  assert.deepEqual(PROPOSABLE_KEYS.subgenre, ["description", "kilder", "activeFrom", "activeTo", "era"]);
  for (const key of FORBIDDEN) {
    assert.equal(PROPOSABLE_KEYS.subgenre.includes(key), false, `subgenre skal ikke tillate ${key}`);
  }
  // «Les mer»-feltene ble fjernet i v4.78 (kildehenvisningene overtok rollen)
  // og slettet helt i v4.93 — de finnes ikke lenger i data, eksport eller kode.
  assert.deepEqual(PROPOSABLE_KEYS["decade-society"], ["society"]);
  assert.deepEqual(PROPOSABLE_KEYS["decade-tech"], ["tech"]);
});

test("proposableKeysFor gir tom liste for ukjent entityType", () => {
  assert.deepEqual(proposableKeysFor("finnes-ikke"), []);
});

// Navnet på den som foreslår er PÅKREVD i ALLE studentflatene (brukervalg
// 2026-09-02): læreren skal kunne gå i dialog med den som sendte inn. Kravet
// bor i tre innsendingsstier og kan ikke enhetstestes (de leser DOM), så vi
// låser kilden — samme grep som instrument-groups.test.js bruker.
test("navnet er påkrevd i alle tre studentflatene", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");

  // 1) Nytt artistforslag (student.html)
  const student = les("student.js");
  assert.match(student, /if \(!candidate\.proposedBy\)/,
    "student.js mangler vakten for forslagsstillerens navn");
  assert.doesNotMatch(student, /#in-by"\)\.value\.trim\(\) \|\| "Anonym"/,
    "student.js skal ikke lenger falle tilbake på «Anonym» ved innsending");

  // 2 og 3) Endring på eksisterende kort OG helt nytt kort deler samme vakt.
  const proposals = les("proposals.js");
  assert.match(proposals, /function lesForslagsstiller\(\)/,
    "proposals.js mangler den delte navnevakten");
  assert.equal((proposals.match(/lesForslagsstiller\(\);/g) || []).length, 2,
    "begge forslagsflytene må kalle vakten — endring OG nytt kort");
  assert.doesNotMatch(proposals, /prop-by"\)\.value\.trim\(\) \|\| "Anonym"/,
    "proposals.js skal ikke lenger falle tilbake på «Anonym» ved innsending");

  // Datalaget beholder BEVISST sin fallback: gamle og importerte rader har
  // «Anonym» lagret, og de skal fortsatt vises.
  const store = fs.readFileSync(new URL("../../js/store.js", import.meta.url), "utf8");
  assert.match(store, /proposedBy \|\| "Anonym"/,
    "store.js skal beholde fallbacken for eldre data");
});

// «Gjeldende»-kolonnen i lærerens diff er hele grunnlaget for å se hva som
// forsvinner ved godkjenning (som ERSTATTER, ikke fletter). Har den ikke med
// et foreslåbart felt, står det «(tom)» der det finnes data. Dette har skjedd
// to ganger: kilder på subgenre, så era og instrumentkilder. Kildesjekk, siden
// getCurrentEntityValues leser lærer-state og ikke kan enhetstestes.
test("getCurrentEntityValues dekker alle foreslåbare felter", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../js/teacher-review.js", import.meta.url), "utf8");
  const grener = {
    subgenre: ["description", "kilder", "activeFrom", "activeTo", "era"],
    instrument: ["body", "kilder"],
    "decade-society": ["society"],
    "decade-tech": ["tech"],
  };
  for (const [type, felter] of Object.entries(grener)) {
    // Hver gren skal nevne hvert foreslåbart felt for sin entityType.
    const mangler = PROPOSABLE_KEYS[type].filter((k) => !felter.includes(k));
    assert.deepEqual(mangler, [],
      `testens egen liste for ${type} er utdatert mot PROPOSABLE_KEYS`);
    for (const f of felter) {
      assert.ok(src.includes(`${f}:`),
        `teacher-review.js mangler «${f}» i Gjeldende-kolonnen for ${type}`);
    }
  }
});

// firestore.rules kapper adoptedLabel og imageCredit på 300 tegn ved oppretting
// av teknologikort. Uten et LAVERE tak i skjemaet ville en ordrik student fått
// «Missing or insufficient permissions» i stedet for en grense hen ser.
// Klienten skal alltid være strengest.
test("skjemaets tegntak er strengere enn regelens", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  const proposals = les("js/proposals.js");
  const teacher = les("teacher.html");
  const rules = les("firestore.rules");

  for (const felt of ["adoptedLabel", "imageCredit"]) {
    const iSkjema = proposals.match(new RegExp(`key: "${felt}"[^}]*max: (\\d+)`));
    assert.ok(iSkjema, `${felt} mangler max i forslagsskjemaet`);
    const iRegel = rules.match(new RegExp(`get\\("${felt}", ""\\).size\\(\\) <= (\\d+)`));
    assert.ok(iRegel, `${felt} mangler tak i firestore.rules`);
    assert.ok(Number(iSkjema[1]) <= Number(iRegel[1]),
      `${felt}: skjemaet (${iSkjema[1]}) må være strengere enn regelen (${iRegel[1]})`);
  }
  // Lærerens eget skjema skriver til samme regel.
  for (const id of ["tech-adopted-label", "tech-image-credit"]) {
    assert.match(teacher, new RegExp(`id="${id}"[^>]*maxlength="\\d+"`),
      `teacher.html: ${id} mangler maxlength`);
  }
});

// Returflyten (v5.13) henger på fire ting som ikke kan enhetstestes (DOM,
// Firestore): lekkasjefilteret, regel-grenene, uid-stemplingen og eksporten.
// Låses på kildenivå, som de andre flersteds-invarianten i denne fila.
test("returflyten: lekkasjefilter, regler, stempling og eksport henger sammen", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

  // Studentenes tech-filter skal være en TILLATliste — en nektliste mot
  // «pending» lekket enhver ny status.
  assert.match(les("js/shared-data.js"), /\(t\.status \|\| "active"\) === "active"/,
    "shared-data må filtrere med tillatliste");

  // Alle tre samlingene må ha retur-grenen i reglene, med kode som bevis.
  const rules = les("firestore.rules");
  assert.equal((rules.match(/function erReturInnsending\(\)/g) || []).length, 3,
    "alle tre samlingene trenger retur-grenen");
  assert.equal((rules.match(/innsendtKode/g) || []).length >= 6, true,
    "kodebeviset må stå i alle grenene");
  assert.ok(rules.includes('"ownerUid"'), "ownerUid må være tillatt ved create");

  // Alle tre innsendingsstiene stempler eier-uid.
  const store = les("js/store.js");
  assert.equal((store.match(/ownerUid: auth\.currentUser\?\.uid \|\| ""/g) || []).length, 3,
    "addArtist, addTechProposal og addPendingEdit må alle stemple ownerUid");

  // Eksporten bærer returfeltene, ellers er ikke backupen tapsfri.
  const schema = les("js/artist-schema.js");
  for (const f of ["teacherFeedback", "returKode", "studentComment", "ownerUid"]) {
    assert.ok(schema.includes(`"${f}"`), `ARTIST_EXPORT_FIELDS mangler ${f}`);
  }
});
