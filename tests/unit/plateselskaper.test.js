// Plateselskapene (v6.37, brukervalg 2026-10-04): tretten kort, koblet til
// artistenes plateselskapsfelt. Treffet må være eksakt per del av feltet, så
// «Sun» aldri treffer «Sunset» og «RCA» aldri «RCA Camden», og alle
// skrivemåtene i dataene («RCA Victor», «Volt», «Decca Records») må finne
// riktig kort.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  finnPlateselskap, selskaperIFelt, delSelskapsfelt, artisterForSelskap,
  selskaperSortert, grunnlagtAar, rensFakta, plateselskapSideId, plateselskapForSide,
  alleSelskaper, SELSKAPER_FOR_V712, rensSelskapsfelt, nyttSelskapId, skrivemaateIBruk,
  plateselskapIdForSide, finnSelskapId,
} from "../../js/felles/plateselskaper.js";
import { setOpts } from "../../js/data/app-state.js";
import { byggIndeks } from "../../js/felles/search.js";
import { VIS_TYPER } from "../../js/felles/vis-lenke.js";
import { TYPE_NAVN } from "../../js/visning/stopp-etikett.js";
import { lesJs } from "../helpers/js-filer.js";

// Fra v7.12 er lista dokumentene i content (plateselskap-<id>). De 13 første
// har ennå ikke navn i dokumentene og får det fra overgangslista, slik live-
// dataene er før lærersiden har skrevet dem inn.
const INNHOLD = Object.fromEntries(SELSKAPER_FOR_V712.map((p) => [plateselskapSideId(p.id), { body: "" }]));
setOpts({ getState: () => ({ content: INNHOLD }) });
const PLATESELSKAPER = alleSelskaper();

const id = (navn) => finnPlateselskap(navn)?.id ?? null;

test("de tretten selskapene brukeren valgte, hver med unik id", () => {
  assert.deepEqual(PLATESELSKAPER.map((p) => p.id).sort(), [
    "atlantic", "blue-note", "chess", "columbia", "decca", "ecm", "motown",
    "paramount", "philadelphia-international", "savoy", "stax", "sun", "victor",
  ]);
});

test("ingen skrivemåte peker på to selskaper", () => {
  const sett = new Map();
  for (const p of PLATESELSKAPER) for (const a of p.aliaser) {
    const k = a.toLowerCase();
    assert.ok(!sett.has(k), `«${a}» står både på ${sett.get(k)} og ${p.id}`);
    sett.set(k, p.id);
  }
});

test("skrivemåtene i artistdataene finner riktig kort", () => {
  assert.equal(id("Victor"), "victor");
  assert.equal(id("RCA Victor"), "victor");
  assert.equal(id("RCA"), "victor");
  assert.equal(id("Bluebird"), "victor");
  assert.equal(id("Volt"), "stax");
  assert.equal(id("Tamla"), "motown");
  assert.equal(id("Decca Records"), "decca");
  assert.equal(id("Blue Note Records"), "blue-note");
  assert.equal(id("  chess  "), "chess");
  assert.equal(id("Philadelphia International Records"), "philadelphia-international");
  assert.equal(id("Sun Records"), "sun");
});

test("ingen falske treff på navn som bare ligner", () => {
  for (const navn of ["Sunset", "RCA Camden", "Columbia Pictures", "Atlantic Starr", "Chess Mate", "Motown Junction", ""]) {
    assert.equal(id(navn), null, navn);
  }
});

test("feltet deles på skråstrek og semikolon, ikke på komma", () => {
  assert.deepEqual(delSelskapsfelt("Columbia / Atlantic"), ["Columbia", "Atlantic"]);
  assert.deepEqual(delSelskapsfelt("Stax; Volt"), ["Stax", "Volt"]);
  assert.deepEqual(delSelskapsfelt("Brunswick, Vocalion"), ["Brunswick, Vocalion"]);
  const deler = selskaperIFelt("Okeh / Columbia");
  assert.equal(deler[0].selskap, null);
  assert.equal(deler[1].selskap.id, "columbia");
});

test("artisterForSelskap finner artisten uansett hvilken del av feltet selskapet står i", () => {
  const artister = [
    { id: "1", recordLabel: "Okeh / Columbia" },
    { id: "2", recordLabel: "RCA Victor" },
    { id: "3", recordLabel: "Sunset" },
    { id: "4", recordLabel: "Sun" },
    { id: "5" },
  ];
  assert.deepEqual(artisterForSelskap(artister, "columbia").map((a) => a.id), ["1"]);
  assert.deepEqual(artisterForSelskap(artister, "victor").map((a) => a.id), ["2"]);
  assert.deepEqual(artisterForSelskap(artister, "sun").map((a) => a.id), ["4"]);
});

test("sideId går begge veier, og ukjente sider gir null", () => {
  assert.equal(plateselskapSideId("stax"), "plateselskap-stax");
  assert.equal(plateselskapForSide("plateselskap-stax").id, "stax");
  assert.equal(plateselskapForSide("plateselskap-ukjent"), null);
  assert.equal(plateselskapForSide("instrument-gitar"), null);
});

test("rekkefølgen følger grunnleggelsesåret, og selskaper uten år kommer sist i listas rekkefølge", () => {
  const sider = { sun: { fakta: { grunnlagt: "1952" } }, stax: { fakta: { grunnlagt: 1957 } }, ecm: { fakta: { grunnlagt: "ca. 1969" } } };
  const rekke = selskaperSortert((id) => sider[id] || null).map((p) => p.id);
  assert.deepEqual(rekke.slice(0, 3), ["sun", "stax", "ecm"]);
  assert.equal(rekke[3], "columbia", "resten i listas rekkefølge");
  assert.equal(grunnlagtAar({ fakta: { grunnlagt: "ukjent" } }), null);
});

test("rensFakta beholder bare kjente felt med innhold", () => {
  assert.deepEqual(rensFakta({ grunnlagt: 1957, sted: "  Memphis ", ukjent: "x", virketid: "" }), { grunnlagt: "1957", sted: "Memphis" });
  assert.equal(rensFakta({ sted: "  " }), null);
  assert.equal(rensFakta(null), null);
  assert.equal(rensFakta("tekst"), null);
});

test("søket: alle tretten for læreren, ingen for studentene mens hubkortet er skjult", () => {
  const state = { content: { ...INNHOLD, "plateselskap-stax": { body: "Soul fra Memphis.", fakta: { sted: "Memphis" } } } };
  const laerer = byggIndeks(state, { erLærer: true, skjulHub: { "sb-plateselskaper": true } }).filter((p) => p.type === "plateselskap");
  assert.equal(laerer.length, 13);
  const stax = laerer.find((p) => p.id === "stax");
  assert.deepEqual(stax.apne, { hva: "plateselskap", id: "stax" });
  assert.match(stax.tekst, /Volt/);
  assert.match(stax.tekst, /Memphis/);
  assert.equal(byggIndeks(state, { skjulHub: { "sb-plateselskaper": true } }).filter((p) => p.type === "plateselskap").length, 0);
  assert.equal(byggIndeks(state, { skjulHub: { "sb-plateselskaper": false } }).filter((p) => p.type === "plateselskap").length, 13);
});

test("lenkene og kjøreplanene kjenner plateselskapene", () => {
  assert.ok(VIS_TYPER.has("plateselskap") && VIS_TYPER.has("plateselskaper"));
  assert.equal(TYPE_NAVN.plateselskap, "Plateselskap");
  assert.equal(TYPE_NAVN.lytt, "Spillelister", "Lytt heter Spillelister fra v6.31");
  const apne = lesJs("explore-apne.js");
  assert.match(apne, /case "plateselskap": return openPlateselskap\(apne\.id\)/);
  assert.match(apne, /case "plateselskap": case "plateselskaper":/);
});

test("koblingen i appen: modalene, hubkortet, artistlenken og omtegningen", () => {
  const explore = lesJs("utforsk/explore.js");
  assert.match(explore, /"modal-plateselskaper", "modal-plateselskap"\]/);
  assert.match(explore, /paaKort\("sb-plateselskaper", openPlateselskaper\)/);
  assert.match(explore, /closest\("\[data-plateselskap\]"\)/);
  assert.match(explore, /renderPlateselskaper\(\);\n\}/, "contentChanged tegner åpne plateselskapskort");
  const helpers = lesJs("ui-helpers.js");
  assert.match(helpers, /\["Plateselskap", a\.recordLabel, \{ html: plateselskapHtml\(a\.recordLabel\) \}\]/);
  assert.match(helpers, /if \(!plateselskapeneSynlige\(\)\) return escapeHtml\(felt\);/, "skjult for studentene: ren tekst");
  for (const side of ["landing.js", "teacher.js", "tre-page.js"]) {
    assert.match(lesJs(side), /renderPlateselskaper\?\.\(\)/, `${side} tegner kortet når artistene endres`);
  }
});

test("lærersiden: faktafeltene lagres og importeres, og Oversikten har seksjonen", () => {
  const html = readFileSync(new URL("../../teacher.html", import.meta.url), "utf8");
  assert.match(html, /id="se-fakta-wrap"/);
  const innhold = lesJs("teacher-content.js");
  assert.match(innhold, /if \(fakta\) data\.fakta = fakta;/, "savePage skriver hele dokumentet, så faktaene må med");
  assert.match(innhold, /if \(harKildefelt\(editorTarget\)\) data\.kilder = collectRows/);
  assert.match(lesJs("teacher-import.js"), /const fakta = rensFakta\(d\.fakta\);\n\s+if \(fakta\) data\.fakta = fakta;/);
  const dash = lesJs("ui-dashboard.js");
  // v6.66: plateselskapene er ett av punktene i Mangler-vinduet, ikke en egen seksjon.
  assert.match(dash, /data-ov-toggle="ov-x-plateselskaper"/);
  assert.match(html, /id="modal-mangler"[\s\S]*id="mangler-body"/);
  assert.match(dash, /onPlateselskapCheck\?\.\(id, toggleCheckBtn\(chk, "tcr-check"\)\)/);
  assert.match(lesJs("teacher-artists.js"), /setContentCheck\("plateselskaper", id, on\)/);
});

test("selskapsnavn blir lenker, men aldri kortets eget", async () => {
  const { linkifyAll, medSelv } = await import("../../js/felles/linkify.js");
  const ctx = medSelv({ plateselskaper: PLATESELSKAPER }, { plateselskap: "chess" });
  const ut = linkifyAll("Phillips startet Sun, og Chess ga ut opptaket.", ctx);
  assert.match(ut, /<a class="plateselskap-link" data-ps-lenke="sun"[^>]*>Sun<\/a>/);
  assert.doesNotMatch(ut, /data-ps-lenke="chess"/, "kortets eget navn lenkes ikke");
  assert.doesNotMatch(linkifyAll("Harold Melvin & the Blue Notes", ctx), /plateselskap-link/, "ingen genitiv-s på selskapsnavn");
  assert.match(linkifyAll("Elvis gikk til RCA Victor.", ctx), /data-ps-lenke="victor"[^>]*>RCA Victor</, "lengste navn vinner");
  assert.doesNotMatch(linkifyAll("House of the Rising Sun", {}), /plateselskap-link/, "uten selskapene i konteksten: ingen lenker");
});

// v6.91 (brukerønske 2026-10-13): selskapene lenkes i alle tekstene, med vern
// mot navnene som også betyr noe annet.
test("selskapslenker i alle tekster: artistene går foran, titler og Berry Gordy lenkes ikke", async () => {
  const { linkifyAll } = await import("../../js/felles/linkify.js");
  const ctx = { plateselskaper: PLATESELSKAPER, artists: [{ id: "sunra", name: "Sun Ra", status: "active" }] };
  const sunRa = linkifyAll("Sun Ra spilte inn for Sun Records.", ctx);
  assert.match(sunRa, /data-artist-id="sunra"[^>]*>Sun Ra<\/a>/, "artisten vinner overlappet");
  assert.match(sunRa, /data-ps-lenke="sun"[^>]*>Sun<\/a> Records/);
  assert.doesNotMatch(linkifyAll("albumet «Music of the Sun» kom i 2005", ctx), /plateselskap-link/, "titler i «» hoppes over");
  const gordy = linkifyAll("Motown ble grunnlagt av Berry Gordy.", ctx);
  assert.match(gordy, /data-ps-lenke="motown"[^>]*>Motown<\/a>/);
  assert.equal((gordy.match(/plateselskap-link/g) || []).length, 1, "Gordy er Berry Gordy, ikke merket");
  assert.doesNotMatch(linkifyAll("en forsterker på 220 volt", ctx), /plateselskap-link/, "små bokstaver er ikke selskapet");
  assert.match(linkifyAll("RCA Victors svar på Columbias LP", ctx), /data-ps-lenke="columbia"[^>]*>Columbia<\/a>s LP/, "genitiven lenker navnet");
  assert.doesNotMatch(linkifyAll("en av Blue Notes store suksesser", ctx), /data-ps-lenke="blue-note"/, "men ikke Blue Notes");
});

test("lenkekonteksten tar med selskapene studentene får se", () => {
  const ctxKilde = lesJs("explore-context.js");
  assert.match(ctxKilde, /alleSelskaper\(\)\.filter\(\(p\) => plateselskapSynlig\(p\.id\)\)/);
  assert.equal((ctxKilde.match(/plateselskaper: lenkeSelskaper\(\)/g) || []).length, 2, "buildLinkCtx og sjangerOpts");
  assert.equal((ctxKilde.match(/onPlateselskapClick: \(id\) => nav\.openPlateselskap\?\.\(id\)/g) || []).length, 2);
});

test("standardnavnene er kortenes titler", () => {
  assert.equal(PLATESELSKAPER.find((p) => p.id === "victor").navn, "RCA Victor");
  for (const p of PLATESELSKAPER) assert.ok(p.aliaser.includes(p.navn), `${p.id}: standardnavnet skal også treffe`);
});

// ---------------------------------------------------------------------------
//  v7.12 (brukervalg 2026-10-21): læreren styrer lista selv
// ---------------------------------------------------------------------------

test("lista er dokumentene: navnet i dokumentet går foran overgangslista, nye selskaper kommer med", () => {
  const content = {
    ...INNHOLD,
    "plateselskap-motown": { body: "", navn: "Motown Records", aliaser: ["Tamla"] },
    "plateselskap-vee-jay": { navn: "Vee-Jay", aliaser: "VJ, Vee Jay" },
    "plateselskap-uten-navn": { body: "Ingen navn og ikke i overgangslista." },
    "instrument-gitar": { body: "Ikke et selskap." },
  };
  const liste = alleSelskaper(content);
  assert.equal(liste.length, 14, "de 13 og Vee-Jay, ikke dokumentet uten navn");
  const motown = finnSelskapId("motown", content);
  assert.equal(motown.navn, "Motown Records");
  assert.deepEqual(motown.aliaser, ["Motown Records", "Tamla"], "skrivemåtene fra dokumentet, ikke overgangslistas");
  assert.equal(finnPlateselskap("Gordy", content), null, "Gordy er ikke lenger en skrivemåte for Motown");
  assert.equal(finnPlateselskap("VJ", content)?.id, "vee-jay", "kommaseparert tekst godtas");
  assert.equal(finnPlateselskap("Vee-Jay Records", content)?.id, "vee-jay");
  // Slettet dokument: borte fra lista, også for de 13 første.
  const utenSun = { ...INNHOLD };
  delete utenSun["plateselskap-sun"];
  assert.equal(finnSelskapId("sun", utenSun), null);
  assert.equal(alleSelskaper(utenSun).length, 12);
});

test("rensSelskapsfelt: navnet trimmes, skrivemåtene er unike og uten navnet", () => {
  assert.deepEqual(rensSelskapsfelt({ navn: "  Stax ", aliaser: "Volt, stax, Volt ,  ", utenGenitiv: false, ukjent: 1 }),
    { navn: "Stax", aliaser: ["Volt"] });
  assert.deepEqual(rensSelskapsfelt({ navn: "Motown", aliaser: ["Tamla", "Gordy"], ikkeITekst: ["Gordy"] }),
    { navn: "Motown", aliaser: ["Tamla", "Gordy"], ikkeITekst: ["Gordy"] });
  assert.deepEqual(rensSelskapsfelt({ navn: "Blue Note", utenGenitiv: true }), { navn: "Blue Note", utenGenitiv: true });
  assert.deepEqual(rensSelskapsfelt({}), {});
});

test("nyttSelskapId: av navnet, uten æøå og tegn, og unik", () => {
  assert.equal(nyttSelskapId("Philadelphia International"), "philadelphia-international");
  assert.equal(nyttSelskapId("Grønland Records"), "gronland-records");
  assert.equal(nyttSelskapId("Vee-Jay!"), "vee-jay");
  assert.equal(nyttSelskapId("!!!"), "selskap");
  const tatt = new Set(["stax", "stax-2"]);
  assert.equal(nyttSelskapId("Stax", (x) => tatt.has(x)), "stax-3");
});

test("skrivemaateIBruk: en skrivemåte kan bare høre til ett selskap", () => {
  const treff = skrivemaateIBruk({ id: null, navn: "Volt Records", aliaser: [] }, INNHOLD);
  assert.equal(treff?.selskap.id, "stax", "Volt (Records) er Stax");
  assert.equal(skrivemaateIBruk({ id: "stax", navn: "Stax", aliaser: ["Volt"] }, INNHOLD), null, "selskapets egne skrivemåter er ikke en kollisjon");
  assert.equal(skrivemaateIBruk({ id: null, navn: "Vee-Jay", aliaser: ["VJ"] }, INNHOLD), null);
});

test("plateselskapIdForSide er ren og trenger ikke lista", () => {
  assert.equal(plateselskapIdForSide("plateselskap-vee-jay"), "vee-jay");
  assert.equal(plateselskapIdForSide("plateselskap-"), null);
  assert.equal(plateselskapIdForSide("instrument-gitar"), null);
  assert.match(lesJs("sjekket-filter.js"), /const selskapId = plateselskapIdForSide\(s\);/);
});

test("lærersiden: navn og skrivemåter lagres, importeres og eksporteres med, og overgangen fletter", () => {
  const innhold = lesJs("teacher-content.js");
  assert.match(innhold, /if \(selskap\) Object\.assign\(data, selskap\);/, "savePage skriver hele dokumentet");
  assert.match(innhold, /skrivemaateIBruk\(\{ id, navn: selskap\.navn, aliaser: selskap\.aliaser \|\| \[\] \}, state\.content\)/);
  assert.match(innhold, /await oppdaterSide\(plateselskapSideId\(p\.id\), rensSelskapsfelt\(p\)\);/);
  assert.match(innhold, /return dok && !dok\.navn;/, "overgangen rører bare dokumenter uten navn");
  const imp = lesJs("teacher-import.js");
  assert.match(imp, /Object\.assign\(data, rensSelskapsfelt\(d\.navn \? d : state\.content\?\.\[id\] \|\| \{\}\)\);/);
  assert.match(imp, /\|\| \(plateselskapIdForSide\(id\) && docData\.navn\)\);/, "eksporten tar med selskaper uten tekst");
  assert.match(lesJs("store.js"), /setDoc\(doc\(db, "content", pageId\), felt, \{ merge: true \}\)/);
  const html = readFileSync(new URL("../../teacher.html", import.meta.url), "utf8");
  assert.match(html, /id="se-selskap"/);
  assert.match(html, /id="se-slett-selskap"/);
  assert.match(lesJs("explore-plateselskap.js"), /opts\?\.onNyttPlateselskap/);
  assert.match(lesJs("teacher.js"), /onNyttPlateselskap: \(\) => nyttPlateselskap\(\)/);
});
