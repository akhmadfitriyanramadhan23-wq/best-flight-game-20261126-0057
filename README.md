# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/akhmadfitriyanramadhan23-wq/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/akhmadfitriyanramadhan23-wq/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sky Courier: Archipelago Run** — a complete original flight game for the make.fun bounty **"Make the best flight game"** (`best-flight-game-20261126-0057`). Fly the mail across a procedural Indonesian archipelago in a little STOL bush plane: thread glowing rings, mind your fuel, fight the crosswind, and put her down gently on the far strip — by day, in a storm, and after dark.

## How to run

```sh
node serve.ts        # serves game/ at http://localhost:8080/
```

Open http://localhost:8080/ in desktop Chrome. No build step, no network, no libraries — pure HTML5 canvas 2D and vanilla JS.

## Controls

- **← → / A D** — bank (turn)
- **↑ ↓ / W S** — pitch (climb / descend)
- **Shift / Ctrl** — throttle up / down (or drag the throttle slider with the mouse)
- **Space** — toggle flaps (slower, softer landings)
- **P** — pause · **M** — mute · **R** — restart mission
- **Mouse** — click the panel buttons (pause, mute, flaps, camera, restart, menu) and the throttle slider

## The campaign — 7 missions

1. **First Flight** — take off, 5 rings, land at Karimun.
2. **Island Hop** — 7 rings over lagoons and fishing towns.
3. **Volcano Pass** — climb past smoking Gunung Api, strong wind.
4. **Storm Front** — rain, gusts, low cloud.
5. **Night Mail** — after dark; fly by the lit instruments and the beacons.
6. **Mountain Rescue** — tight valley, short strip.
7. **Grand Archipelago Tour** — the whole chain: 10 rings, every system working.

Progress, credits and upgrades are saved in `localStorage`.

## Systems

- **Fuel** — burns with throttle; land at a strip to refuel.
- **Economy** — earn credits per ring (+40) and per delivery (+120, plus a care bonus); spend them in the hangar on engine, fuel tank, STOL flaps and a nav radio.
- **Weather / wind** — crosswinds push the plane, gusts in later missions, rain in the storm.
- **Airframe** — hard landings and hillside scrapes cost integrity; repair with credits in the hangar.
- **Instruments** — artificial horizon, altimeter, airspeed, heading compass, throttle, fuel gauge and vertical speed, all lit and live; the HUD shows altitude, speed and heading as big numbers, with a dense side panel (mission list, credits, upgrades, fuel/damage bars, wind readout).

Sounds are synthesised with WebAudio only (engine hum, ring chime, touchdown thud, warning beep) — no audio files. The world is deterministic: every mission is built from a fixed seed, so the same seed always flies the same islands.

## Screenshots

All four are real renders of the game's own code, staged with `?shot=play|end&mission=N&seed=S` (see `shots.json`).

- **1-cover.jpg** — Mid-action chase view: glowing rings and the destination runway ahead, islands and rice fields below, dense HUD with altitude, speed and heading.
- **2-rings.jpg** — Island Hop: threading the ring line over lagoons and fishing towns, crosswind pushing the nose.
- **3-night.jpg** — Night Mail: instruments glowing, runway beacons ahead, the mail flying after dark.
- **4-landing.jpg** — Final approach: flaps down, on the centreline, the strip lit and waiting.

## Layout

- `game/index.html` — the page
- `game/src/config.js` — constants, the 7 missions, upgrades, save
- `game/src/random.js` — seeded RNG and angle helpers
- `game/src/world.js` — procedural archipelago, rings, runways, weather
- `game/src/physics.js` — flight model, fuel/damage, autopilot
- `game/src/terrain.js` — pseudo-3D chase-view projection and ground rendering
- `game/src/render.js` — aircraft, instruments, HUD, screens
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/main.js` — loop and state machine
- `main.ts` — hand-in: copies `game/` and `screenshots/` to the output dir and writes `dossier.json`
- `serve.ts` — static server on port 8080
- `shots.json` — the four staged screenshots
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=4g7knchf&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
