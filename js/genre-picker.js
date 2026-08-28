// ============================================================================
//  SJANGERVELGER — nedtrekk + brikker (flervalg fra slektstreet)
// ----------------------------------------------------------------------------
//  Erstatter det kommaseparerte tekstfeltet «Sjangre» i BEGGE artistskjemaene
//  (studentens forslagsskjema og lærerens rediger-artist). Verdien er den samme
//  som før — en liste med tre-sjangernavn — men navnene VELGES nå fra
//  vokabularet i stedet for å skrives inn, så en skrivefeil ikke lenger kan
//  lage en falsk undersjanger i tre-visningene og Skrivebordet.
//
//  Ingen egen tilstand: de valgte sjangrene BOR i DOM-en (én brikke per
//  sjanger, data-gp-genre). Attributtet heter bevisst ikke data-sjanger —
//  explore.js har en dokument-lytter på DET navnet som åpner sjangerpopupen,
//  og brikkene ville dratt den opp midt i skjemaet.
//
//  Vokabularet kommer asynkront fra Firestore (sjangertreet), så det settes
//  med fillGenrePicker og kan komme ETTER at brikkene er bygget. En brikke
//  utenfor vokabularet (gammel data, eller en sjanger fjernet fra treet)
//  merkes visuelt — den slettes aldri stille.
//
//  Avhengighetsfri (kun DOM), som row-editor.js.
// ============================================================================

// root → gyldige sjangre. WeakMap fordi vokabularet hører til elementet, ikke
// til modulen: to skjemaer på samme side skal kunne ha hver sin liste.
const VOKABULAR = new WeakMap();

const velgEl = (root) => root.querySelector(".gp-velg");
const brikkerEl = (root) => root.querySelector(".gp-valgte");

// Valgte sjangre, i rekkefølgen brikkene står. Eneste vei ut av velgeren.
export function collectGenrePicker(root) {
  if (!root) return [];
  return [...brikkerEl(root).querySelectorAll(".gp-brikke")].map((b) => b.dataset.gpGenre);
}

// Sett hele utvalget (lærerens rediger-modal fyller fra artisten; skjemaet
// tømmes med [] etter innsending — form.reset() rører ikke brikkene).
export function buildGenrePicker(root, values = []) {
  if (!root) return;
  const wrap = brikkerEl(root);
  wrap.innerHTML = "";
  const sett = new Set();
  for (const v of values || []) {
    const navn = String(v || "").trim();
    if (!navn || sett.has(navn)) continue;
    sett.add(navn);
    wrap.append(lagBrikke(navn));
  }
  tegnOpp(root);
}

// Sjangervokabularet fra slektstreet. Kan kalles på nytt når treet endrer seg;
// brikkene overlever (de er brukerens valg, ikke en avledning av treet).
export function fillGenrePicker(root, genres) {
  if (!root) return;
  VOKABULAR.set(root, [...(genres || [])]);
  tegnOpp(root);
}

// Koble nedtrekk + fjern-knapper. Idempotent: trygg å kalle flere ganger.
export function setupGenrePicker(root) {
  if (!root || root.dataset.gpKlar) return;
  root.dataset.gpKlar = "1";

  velgEl(root).addEventListener("change", (e) => {
    const navn = e.target.value;
    if (!navn) return;
    if (!collectGenrePicker(root).includes(navn)) brikkerEl(root).append(lagBrikke(navn));
    tegnOpp(root);
  });

  // Delegert: brikkene byttes ut ved hver opptegning.
  brikkerEl(root).addEventListener("click", (e) => {
    const knapp = e.target.closest(".gp-fjern");
    if (!knapp) return;
    knapp.closest(".gp-brikke").remove();
    tegnOpp(root);
  });

  tegnOpp(root);
}

// Én brikke. Bygges med DOM-API og textContent — ingen innerHTML, ingen
// escaping å glemme (sjangernavn kommer fra Firestore).
function lagBrikke(navn) {
  const b = document.createElement("span");
  b.className = "tag tag-sjanger gp-brikke";
  b.dataset.gpGenre = navn;
  b.append(navn);
  const x = document.createElement("button");
  x.type = "button";
  x.className = "gp-fjern";
  x.setAttribute("aria-label", `Fjern sjangeren ${navn}`);
  x.textContent = "✕";
  b.append(x);
  return b;
}

// Synkroniser nedtrekk, tom-melding og ukjent-merking mot brikkene.
function tegnOpp(root) {
  const valgt = collectGenrePicker(root);
  const ordforrad = VOKABULAR.get(root) || [];
  const wrap = brikkerEl(root);

  // Tom-melding: skjemaet skal ikke se ødelagt ut når ingenting er valgt.
  const tom = wrap.querySelector(".gp-tom");
  if (valgt.length && tom) tom.remove();
  if (!valgt.length && !tom) {
    const s = document.createElement("span");
    s.className = "gp-tom";
    s.textContent = "Ingen sjangre valgt ennå.";
    wrap.append(s);
  }

  // Brikker utenfor treet merkes. Kun når vokabularet faktisk er lastet —
  // ellers ville ALT blitt flagget de første øyeblikkene etter sidelast.
  for (const b of wrap.querySelectorAll(".gp-brikke")) {
    const ukjent = ordforrad.length > 0 && !ordforrad.includes(b.dataset.gpGenre);
    b.classList.toggle("gp-ukjent", ukjent);
    if (ukjent) b.title = "Finnes ikke i slektstreet. Velg riktig navn, eller fjern brikken.";
    else b.removeAttribute("title");
  }

  // Nedtrekket viser bare det som ikke alt er valgt.
  const velg = velgEl(root);
  const ledige = ordforrad.filter((g) => !valgt.includes(g));
  velg.innerHTML = "";
  velg.disabled = ordforrad.length === 0;
  velg.append(new Option(
    ordforrad.length === 0
      ? "Sjangertreet er ikke lastet ennå …"
      : (ledige.length ? "Legg til sjanger …" : "Alle sjangre er valgt"),
    ""
  ));
  for (const g of ledige) velg.append(new Option(g, g));
  velg.value = "";
}
