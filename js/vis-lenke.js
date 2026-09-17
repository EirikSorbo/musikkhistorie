// ============================================================================
//  VIS-LENKER — dype lenker til alt søket kan åpne (v5.22)
// ----------------------------------------------------------------------------
//  Ren modul (Node-testbar): parser og bygger verdien i ?vis=-parameteret på
//  forsiden. Formatet er «hva», «hva:id» eller «hva:id:modus», med samme
//  hva-nøkler som søkets treff bærer — ruteren som faktisk åpner målet bor i
//  explore-apne.js, slik at søket, lenkene og (senere) kjøreplanen går
//  gjennom samme dør.
//
//  Kolon er skilletegn og kan derfor ikke stå i id-en. Ingen navn i pensumet
//  har kolon, og byggVisVerdi nekter å bygge en verdi med et, i stedet for å
//  lage en lenke som parses feil.
//
//  Hurtigtast-vaktene bor også her: rene funksjoner, delt av forsiden,
//  lærersiden og slektstresiden. student.html har med vilje IKKE hurtigtasten
//  (siden laster ikke utforsk-laget, og et halvskrevet skjema skal uansett
//  ikke kunne forlates ved et feiltrykk).
// ============================================================================

// Gyldige mål. De ni første peker på et dokument eller navn (id), resten er
// visninger uten id: historie uten id åpner oversikten, teknologi kan ta en
// kategori som id. «slektstre» ruter til tre.html via opts.onSlektstre.
export const VIS_TYPER = new Set([
  "artist", "sjanger", "undersjanger", "historie", "tech", "tiår", "side",
  "instrument", "kobling",
  "tidslinje", "varmekart", "sjangerperioder", "himmel", "referanser",
  "store-bildet", "podkaster", "teknologi", "slektstre",
  // Et lytteeksempel (v5.28): «yt:<video-id>» eller «yt:<video-id>:<liste>».
  // YouTube-ID-er er kolonfrie, så de passer i vis-formatet. Varmekartet kan
  // også bære en metasjanger som id («varmekart:Country») fra samme versjon.
  "yt",
]);

// «artist:abc123» → { hva: "artist", id: "abc123" }. Ukjent type → null, så
// en gammel eller håndskrevet lenke aldri kaster — den ignoreres stille.
//
// Fjerde ledd («ekstra», v5.29) bærer starttidspunktet på et lytteeksempel:
// «yt:<video>:<liste>:<sekunder>», og «yt:<video>::<sekunder>» når det ikke
// er noen spilleliste. Tomt ledd leses som fravær, så begge formene er
// bakoverkompatible med lenker laget før v5.29.
export function parseVisVerdi(verdi) {
  if (typeof verdi !== "string" || !verdi) return null;
  const [hva, id, modus, ekstra] = verdi.split(":");
  if (!VIS_TYPER.has(hva)) return null;
  const ut = { hva };
  if (id) ut.id = id;
  if (modus) ut.modus = modus;
  if (ekstra) ut.ekstra = ekstra;
  return ut;
}

// Motsatt vei — brukes av «Kopier lenke». Returnerer null i stedet for en
// verdi som ikke kan parses tilbake (ukjent type, kolon i navnet, eller
// modus/ekstra uten id, som ville blitt lest som id).
export function byggVisVerdi({ hva, id, modus, ekstra } = {}) {
  if (!VIS_TYPER.has(hva)) return null;
  const deler = [hva];
  if (id != null && id !== "") deler.push(String(id));
  const harModus = modus != null && modus !== "";
  const harEkstra = ekstra != null && ekstra !== "";
  if (harModus || harEkstra) {
    if (deler.length === 1) return null;
    // Tom plassholder når bare ekstra er satt, så leddene ikke forskyves.
    deler.push(harModus ? String(modus) : "");
  }
  if (harEkstra) deler.push(String(ekstra));
  if (deler.some((d) => d.includes(":"))) return null;
  return deler.join(":");
}

// Skrivefelter der «/» skal skrive tegnet, ikke åpne søket.
export function erSkrivefelt(el) {
  if (!el) return false;
  const tag = String(el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
}

// «/» alene (utenfor skrivefelt), eller Ctrl/Cmd+K (også i skrivefelt — det
// er nettopp poenget med den varianten). Alt-kombinasjoner slippes forbi:
// på norsk tastatur skriver de tegn.
export function erSokHurtigtast(e, iSkrivefelt) {
  if (!e || e.altKey) return false;
  const k = String(e.key || "");
  if ((e.ctrlKey || e.metaKey) && (k === "k" || k === "K")) return true;
  if (e.ctrlKey || e.metaKey) return false;
  return k === "/" && !iSkrivefelt;
}
