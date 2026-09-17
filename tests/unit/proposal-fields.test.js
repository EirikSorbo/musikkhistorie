import { test } from "node:test";
import assert from "node:assert/strict";
import { PROPOSABLE_KEYS, proposableKeysFor } from "../../js/proposal-fields.js?v=5.26";

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
// currentEntityValues (js/entity-values.js, delt av lærerens diff og
// studentens retur-editor fra v5.13) leser sidens state og trekker inn
// Firestore-avhengigheter som ikke kan lastes i Node.
test("currentEntityValues dekker alle foreslåbare felter", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../js/entity-values.js", import.meta.url), "utf8");
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
        `entity-values.js mangler «${f}» i Gjeldende-kolonnen for ${type}`);
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

// En innlogget lærer ble logget ut av å være innom studentvisningen: Firebase
// gjenoppretter økta asynkront, så auth.currentUser er null rett etter
// sidelast, og signInAnonymously() erstatter da en Google-økt med en ny anonym
// bruker (SDK-en gjenbruker kun anonyme). Kildesjekk, siden store.js henter
// Firebase fra CDN og ikke kan lastes i Node.
test("anonym innlogging kan aldri overskrive en innlogget lærer", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../js/store.js", import.meta.url), "utf8");
  const i = src.indexOf("function signInAnonymouslyOnce()");
  const j = src.indexOf("\n}", i);
  assert.ok(i > -1 && j > i, "fant ikke signInAnonymouslyOnce");
  const kropp = src.slice(i, j);
  assert.match(kropp, /authStateReady\(\)/,
    "må vente på authStateReady før den avgjør om noen er innlogget");
  assert.match(kropp, /auth\.currentUser \|\| signInAnonymously\(/,
    "en eksisterende bruker må returneres, aldri erstattes av en anonym økt");
  assert.ok(kropp.indexOf("authStateReady") < kropp.indexOf("signInAnonymously("),
    "ventingen må komme FØR innloggingen, ellers består kappløpet");
});

// Hub-bryterne (v5.17) er nøkkel-per-kort-id. En typo, eller et kort som får ny
// id i markupen, ville gjort flagget til en stille no-op: kortet står synlig og
// ingenting sier fra. Kildesjekk mot markupen, som ikke kan lastes i Node.
test("SKJUL_I_HUBEN stemmer med kortene i «Det store bildet»", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  const { SKJUL_I_HUBEN, SKJUL_I_STUDENTVISNING } = await import("../../js/feature-flags.js?v=5.26");

  // Kortene i huben: markupen ligger mellom «modal-store-bildet» og modalen etter.
  const markup = les("js/explore-modals.js");
  const fra = markup.indexOf('id="modal-store-bildet"');
  const til = markup.indexOf("modal-backdrop", fra + 40);
  const ider = [...markup.slice(fra, til).matchAll(/id="(sb-[a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(ider.length >= 10, `fant bare ${ider.length} hub-kort`);

  assert.deepEqual([...Object.keys(SKJUL_I_HUBEN)].sort(), [...ider].sort(),
    "hvert kort skal ha nøyaktig ett flagg, og hvert flagg peke på et kort");

  // Brukervalg 2026-09-10: de tre visualiseringene, og fra v5.20 sjanger-
  // perioder som fjerde synlige kort.
  const synlige = ider.filter((id) => !SKJUL_I_HUBEN[id]).sort();
  assert.deepEqual(synlige, ["sb-sjangerperioder", "sb-slektstre", "sb-tidslinje", "sb-varmekart"]);

  // Huben må være PÅ, ellers ser studenten ingen av dem uansett.
  assert.equal(SKJUL_I_STUDENTVISNING.storeBildet, false);

  // Sjangerhistoriene har to innganger. Er hub-kortet skjult, må «Metasjangere»
  // i sjangermodalen være det også, ellers står døra åpen ved siden av.
  if (SKJUL_I_HUBEN["sb-historier"]) {
    assert.equal(SKJUL_I_STUDENTVISNING.metasjangerhistorier, true,
      "hub-kortet og «Metasjangere»-knappen må skjules sammen");
  }
});

// Skriveveiledningen og kommentarfeltet (v5.18). To feller låses her:
//  1. [hidden] på et element med display i CSS ble ignorert, så returbanneret
//     (med kommentarfeltet) sto synlig for alle studenter fra v5.13.
//  2. Oversiktens sideklikk sendte alt som ikke var «rotter» til Om historie,
//     så en ny innholdsside ville åpnet feil side i stedet for editoren.
// Kildesjekk: markup, CSS og lærerens dashbord kan ikke lastes i Node.
test("skriveveiledning: skjult til den finnes, kommentarfeltet nederst, redigerbar", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

  const css = les("css/styles.css");
  // v5.24 (audit v5.19 funn 27): spesialreglene per element er erstattet av
  // ÉN global regel som slår enhver forfatter-display — den må aldri fjernes,
  // ellers står returbanneret synlig for alle igjen (fella fra v5.13).
  assert.match(css, /^\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/m,
    "den globale [hidden]-regelen må finnes, ellers vinner display-regler over hidden");

  const html = les("student.html");
  const iBy = html.indexOf('id="in-by"');
  const iKommentar = html.indexOf('id="retur-comment"');
  const iSkjema = html.indexOf('id="add-form"');
  const iVeiledning = html.indexOf('id="skrivehjelp"');
  assert.ok(iBy > 0 && iKommentar > iBy, "kommentarfeltet skal stå under navnefeltet");
  assert.ok(iVeiledning > 0 && iVeiledning < iSkjema, "veiledningen skal stå øverst, over skjemaet");
  assert.match(html, /<details[^>]*id="skrivehjelp"[^>]*hidden/, "veiledningen starter skjult");
  assert.match(html, /id="retur-comment-felt"[^>]*hidden/, "kommentarfeltet starter skjult");

  assert.match(les("js/teacher-content.js"), /skriveveiledning:\s*"Slik skriver du beskrivelsen"/);
  const dash = les("js/ui-dashboard.js");
  assert.ok(dash.includes('pageItem("Skriveveiledning", '),
    "læreren må nå siden fra «Innhold som mangler»");
  assert.match(dash, /return onEditPage\?\.\(id\)/, "ukjente sider skal gå til editoren");
  assert.match(les("js/teacher-artists.js"), /onEditPage:\s*\(id\)\s*=>\s*openPageEditor\(id\)/);
});
