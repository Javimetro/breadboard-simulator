#!/usr/bin/env bash
# Build, then run the browser tests in headless Chromium (Docker image with Playwright).
# Image: pop-porn-shots (built from ~/projects/pop-porn/scripts/shots.Dockerfile).
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build.mjs
mkdir -p shots
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work pop-porn-shots python3 tests/e2e.py "$@"
