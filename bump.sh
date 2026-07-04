#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Cache-busting for GitHub Pages.
#  Setter ALLE ?v=... på lokale CSS/JS-referanser (i js/*.js og *.html) til
#  appens VERSION fra js/version.js, så de aldri kommer ut av synk.
#
#  Bruk:  bump VERSION i js/version.js  →  kjør ./bump.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

VER=$(grep -oE '"[0-9][0-9.]*"' js/version.js | head -1 | tr -d '"')
[ -n "$VER" ] || { echo "Fant ikke VERSION i js/version.js"; exit 1; }

# nullglob: et mønster uten treff (f.eks. tomt tests/) skal forsvinne, ikke
# sendes bokstavelig til perl — det ville stoppet løkka midt i en delvis bump.
shopt -s nullglob
for f in js/*.js *.html tests/*/*.js; do
  perl -i -pe "s/\?v=[0-9][0-9.]*/?v=$VER/g" "$f"
done

echo "Satt ?v=$VER i alle js/*.js, *.html og tests/*/*.js"
