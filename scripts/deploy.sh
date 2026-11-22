#!/usr/bin/env bash
# Test, build and publish the simulator to GitHub Pages:
#   https://javimetro.github.io/breadboard/
# Only the single built file goes into the public repo Javimetro/Javimetro.github.io
# (as /breadboard/index.html). This source repo stays private.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_REPO="https://github.com/Javimetro/Javimetro.github.io.git"
SITE=".deploy/site"

node --test tests/*.test.js >/dev/null
node scripts/build.mjs

if [ ! -d "$SITE/.git" ]; then
  mkdir -p .deploy
  git clone -q "$SITE_REPO" "$SITE"
fi
git -C "$SITE" pull -q --ff-only || true

mkdir -p "$SITE/breadboard"
cp breadboard-lab.html "$SITE/breadboard/index.html"
touch "$SITE/.nojekyll"

src_rev=$(git rev-parse --short HEAD)
if git -C "$SITE" status --porcelain | grep -q .; then
  git -C "$SITE" add -A
  git -C "$SITE" commit -q -m "breadboard (Breadboard Lab): deploy $src_rev"
  git -C "$SITE" push -q origin HEAD
  echo "Deployed $src_rev → https://javimetro.github.io/breadboard/ (live in ~1 min)"
else
  echo "Nothing changed; site already up to date."
fi
