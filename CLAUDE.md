# breadboard-simulator ("Breadboard Lab")

An interactive breadboard simulator game for an adult beginner, in simple English (B1). 12 guided levels plus a sandbox. The deliverable is ONE self-contained file, `breadboard-lab.html` (no external files, no CDNs), built from `src/`. General rules for all projects: ~/projects/CLAUDE.md.

## Build, test, publish

- `node scripts/build.mjs` builds `breadboard-lab.html` from `src/` (order is set in the script). Commit the built file with the source.
- `node --test tests/*.test.js`: engine and circuit tests. Every expected value is worked out by hand (Ohm's law, nodal equations, the LED diode equation solved by substitution); max error ±2 %. If you change a model, recompute the hand value; do not just copy the engine's output.
- `scripts/e2e.sh`: builds, then runs `tests/e2e.py` in headless Chromium (Docker image `pop-porn-shots`, from `~/projects/pop-porn/scripts/shots.Dockerfile`). It auto-solves all 12 levels at 375 px and 1440 px, adds every part in the sandbox, uses real mouse/touch drags and pinch, checks 44 px touch targets and zero console errors. Screenshots land in `shots/` (git-ignored). Look at them after visual changes.
- `scripts/deploy.sh`: tests, builds, and copies the file to the public repo `Javimetro/Javimetro.github.io` as `/breadboard/index.html` → https://javimetro.github.io/breadboard/. This repo stays private.

## Code map (all in `src/`, plain ES5-style JS sharing `globalThis.BB`)

- `engine.js`: modified nodal analysis, Gaussian elimination, Newton-Raphson with SPICE-style junction limiting; LED = Shockley junction + series resistance, fitted so Vf at 20 mA matches the colour. Capacitors use backward Euler. One 0 V reference per island.
- `board.js`: holes and strips (half 30 columns / full 63, optional split rails). Units: 1 = one hole pitch (2.54 mm).
- `parts.js`: every component: pins, geometry, props, `stamp` (adds engine elements) and `after` (reads results, heat/burn/damage, issues with plain-English explanations). Microcontroller pin model is shared (`mcuStamp`/`mcuAfter`); board limits in `BB.BOARDS`. Wio header names come from Seeed's official pinout image.
- `circuit.js`: `BB.Sim`: geometry → netlist → solve (two phases when a pin does PWM/tone) → per-part results, current along strips, nets (for highlighting), "no common GND" check.
- `programs.js`: preset "programs" (no real code runs) with default pins per board.
- `art.js`: SVG drawings (1 pitch = 10 SVG units). `bench.js`: the workbench view (pan, pinch, wheel, drag with snapping, wire tool, loupe, current animation, voltage tags). `levels.js`: levels, intro animations, glossary, auto-solutions. `ui.js`: screens, tray, inspector, goal card, banner, sound, saving (localStorage in try/catch), and `actions()` (the API tests and level setups use).

## Rules

- All player-facing text: simple English, short sentences, every technical term either explained in place or wrapped as `{{term}}` (tappable glossary entry in `levels.js`).
- Each level needs a working `solve(A)`; `scripts/e2e.sh` must stay green.
