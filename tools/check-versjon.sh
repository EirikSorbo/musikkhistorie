#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Cache-busting-sjekken, delt av .githooks/pre-push og CI
#  (.github/workflows/tester.yml). Feiler hvis:
#    · en lokal js/css-referanse MANGLER ?v= (nettleseren ser «util.js» og
#      «util.js?v=X» som TO moduler: en blandet graf laster modulen dobbelt,
#      og med genre-modellens live bindings rendrer treet da tomt)
#    · ?v=-referansene ikke matcher VERSION i js/version.js (kjør ./bump.sh)
#  Flyttet ut av kroken i v5.49, så også commits som ikke har gått gjennom
#  kroken (en annen maskin, GitHubs webredigering) blir sjekket.
#  NB: leser ARBEIDSTREET (bevisst enkelhet). Feiler alltid LUKKET med beskjed.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

# Referanser UTEN ?v= i det som skipes (js/*.js og *.html): usynlige for både
# bump.sh og konsistenssjekken under, og verre enn stale cache (dobbel modul).
mangler=$(grep -naE 'from "\./[^"?]+\.js"' js/*.js || true)
mangler2=$(grep -naE '(src|href)="(js|css)/[^"?]+\.(js|css)"' ./*.html || true)
if [ -n "$mangler$mangler2" ]; then
  echo "check-versjon: lokale referanser uten ?v= (cache-busting mangler):"
  printf '%s\n%s\n' "$mangler" "$mangler2" | grep -av '^$' | head -20
  echo "Legg på ?v= (bump.sh tar dem med videre)."
  exit 1
fi

# «|| true»: uten den ville set -e drept skriptet før feilmeldingen under.
VER=$(grep -oE '"[0-9][0-9.]*"' js/version.js | head -1 | tr -d '"' || true)
[ -n "$VER" ] || { echo "check-versjon: fant ikke VERSION i js/version.js"; exit 1; }

# -a: tving tekst-tolkning. I C-locale kan BSD-grep ellers feilklassifisere
# UTF-8-filer (›, ◆ osv.) som binære og skjule treffene.
bad=$(grep -raHoE '\?v=[0-9][0-9.]*' js/*.js ./*.html tests/*/*.js | grep -av "?v=$VER" || true)
if [ -n "$bad" ]; then
  echo "check-versjon: cache-busting er i utakt med js/version.js (v$VER):"
  echo "$bad" | head -20
  echo
  echo "Kjør ./bump.sh og commit på nytt."
  exit 1
fi
echo "check-versjon: alle referanser har ?v=$VER"
