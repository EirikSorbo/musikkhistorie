// ============================================================================
//  STOPPETIKETTENE (js/visning/stopp-etikett.js)
// ----------------------------------------------------------------------------
//  Audit v5.93 funn 26: modulen hadde ingen atferdstest, og alle fire mutantene
//  linsa prøvde, overlevde. Etikettene bærer den låste garantien ved navnebytte
//  og sletting: et stopp som ikke kan åpnes lenger, sier «finnes ikke lenger»
//  (Visning-lista teller dem før avspilling), mens et stopp som bare venter på
//  data, aldri telles som dødt.
// ============================================================================
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { setOpts } from "../../js/data/app-state.js";
import { stoppEtikett, dodeStopp, DOD } from "../../js/visning/stopp-etikett.js";

const muddy = {
  id: "muddy", name: "Muddy Waters", status: "active", metaGenre: "Blues",
  mainGenre: ["Electric blues"], subGenre: ["Chicago blues"],
  musicExamples: [{ label: "Hoochie Coochie Man", url: "https://www.youtube.com/watch?v=abcdefghijk" }],
};
const skjult = { id: "skjult", name: "Skjult", status: "active", hidden: true, metaGenre: "Blues", mainGenre: ["Blues"], subGenre: ["Hemmelig blues"] };

function medState(s) { setOpts({ getState: () => s }); }
const LASTET = { artistsLoaded: true, genreDescsLoaded: true, techLoaded: true, genreDescs: {} };

test("artist: navnet når kortet finnes, «finnes ikke lenger» når det er borte, «laster» før dataene", () => {
  medState({ ...LASTET, artists: [muddy] });
  assert.deepEqual(stoppEtikett({ vis: "artist:muddy" }), { tekst: "Artist: Muddy Waters", navn: "Muddy Waters" });
  assert.equal(stoppEtikett({ vis: "artist:borte" }).feil, DOD);
  medState({ artists: [], artistsLoaded: false });
  const venter = stoppEtikett({ vis: "artist:muddy" });
  assert.equal(venter.laster, true);
  assert.equal(venter.feil, undefined, "et stopp som venter, er ikke dødt");
});

test("innovasjon: bare aktive kort teller", () => {
  medState({ ...LASTET, techItems: [{ id: "t1", name: "Elektrisk gitar" }, { id: "t2", name: "Ventende", status: "pending" }] });
  assert.equal(stoppEtikett({ vis: "tech:t1" }).tekst, "Innovasjon: Elektrisk gitar");
  assert.equal(stoppEtikett({ vis: "tech:t2" }).feil, DOD);
});

test("sjanger og undersjanger: treet og de synlige artistene avgjør", () => {
  medState({ ...LASTET, artists: [muddy, skjult] });
  assert.equal(stoppEtikett({ vis: "sjanger:Electric blues" }).feil, undefined);
  assert.equal(stoppEtikett({ vis: "sjanger:Finnes ikke" }).feil, DOD);
  assert.equal(stoppEtikett({ vis: "undersjanger:chicago BLUES" }).feil, undefined, "store og små bokstaver");
  assert.equal(stoppEtikett({ vis: "undersjanger:Hemmelig blues" }).feil, DOD, "bare synlige artister teller");
  medState({ artists: [muddy], artistsLoaded: true, genreDescsLoaded: false });
  assert.equal(stoppEtikett({ vis: "undersjanger:Ukjent" }).laster, true);
});

test("tiår, lytteeksempel og ugyldige lenker", () => {
  medState({ ...LASTET, artists: [muddy] });
  assert.equal(stoppEtikett({ vis: "tiår:1950:tech" }).navn, "1950-tallet (teknologi)");
  assert.equal(stoppEtikett({ vis: "tiår:1950" }).navn, "1950-tallet (samfunn)");
  assert.equal(stoppEtikett({ vis: "yt:abcdefghijk" }).navn, "Hoochie Coochie Man (Muddy Waters)");
  assert.equal(stoppEtikett({ vis: "yt:zzzzzzzzzzz" }).tekst, "Lytteeksempel (YouTube)");
  assert.equal(stoppEtikett({ vis: "" }).feil, "ugyldig lenke");
});

test("dodeStopp teller bare stopp som ikke kan åpnes, ikke dem som venter", () => {
  medState({ ...LASTET, artists: [muddy] });
  const plan = { stopp: [{ vis: "artist:muddy" }, { vis: "artist:borte" }, { vis: "sjanger:Finnes ikke" }, { vis: "tidslinje" }] };
  assert.equal(dodeStopp(plan), 2);
  medState({ artists: [], artistsLoaded: false });
  assert.equal(dodeStopp({ stopp: [{ vis: "artist:muddy" }] }), 0);
  assert.equal(dodeStopp(null), 0);
});
