// Sky Courier: Archipelago Run — game loop, state machine and wiring.
// The world, physics, rendering, input and audio each live in their own
// module; this file only owns the mode transitions and the frame loop.
// Input and audio are singletons: starting a new mission replaces the game
// object, never the listeners.

import { VIEW, MISSIONS, UPGRADE_COST, loadSave, storeSave } from './config.js';
import { clamp } from './random.js';
import { buildWorld, ringsPassed } from './world.js';
import { makePlane, maxFuel, stepPlane, missionComplete, sortieScore, isOnRunway } from './physics.js';
import { makeInput, attachInput, pollInput } from './input.js';
import { makeAudio, ensureAudio, setEngine, playRing, playThud, playBeep, playCrash, playFanfare, toggleMute } from './audio.js';
import { drawFrame } from './render.js';
import { shotParams, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = makeInput();
const audio = makeAudio();

export function createGame(missionIndex) {
  const save = loadSave();
  const world = buildWorld(MISSIONS[missionIndex]);
  return {
    mode: 'title',
    missionIndex,
    world,
    plane: makePlane(world, save.upgrades),
    save,
    input,
    audio,
    time: 0,
    message: '',
    messageUntil: -1,
    lastScore: null,
    overReason: '',
    camBoost: 0,
    lastBeep: -10,
    refuelled: false,
  };
}

let game = createGame(0);

function showMessage(text, dur = 3) {
  game.message = text;
  game.messageUntil = game.plane.time + dur;
}

function startMission(index) {
  const save = game.save;
  const camBoost = game.camBoost;
  game = createGame(index);
  game.save = save;
  game.camBoost = camBoost;
  game.mode = 'flying';
  showMessage(`${MISSIONS[index].name} — take off and fly the rings!`, 4);
}

function awardCompletion() {
  const total = sortieScore(game.world, game.plane);
  const rings = ringsPassed(game.world) * 40;
  game.lastScore = { rings, bonus: 120, care: total - rings - 120, total };
  game.save.credits += total;
  game.save.completed[game.missionIndex] = true;
  storeSave(game.save);
  game.mode = 'complete';
  playFanfare(audio);
  showMessage('DELIVERED!', 4);
}

function gameOver(reason) {
  game.overReason = reason;
  game.mode = 'gameover';
  playCrash(audio);
}

function handleButton(id) {
  ensureAudio(audio);
  if (id.startsWith('mission-')) {
    startMission(parseInt(id.slice(8), 10) - 1);
    return;
  }
  if (id.startsWith('buy-')) {
    const uid = id.slice(4);
    const cost = UPGRADE_COST[uid];
    const locked = (uid === 'engine2' && !game.save.upgrades.engine) || (uid === 'tank2' && !game.save.upgrades.tank);
    if (locked || game.save.upgrades[uid]) return;
    if (game.save.credits >= cost) {
      game.save.credits -= cost;
      game.save.upgrades[uid] = true;
      storeSave(game.save);
      playRing(audio);
    } else {
      playBeep(audio);
    }
    return;
  }
  switch (id) {
    case 'pause':
      if (game.mode === 'flying') game.mode = 'paused';
      else if (game.mode === 'paused') game.mode = 'flying';
      break;
    case 'resume':
      if (game.mode === 'paused') game.mode = 'flying';
      break;
    case 'mute':
      toggleMute(audio);
      break;
    case 'flaps':
    case 'flaps2':
      game.plane.flaps = !game.plane.flaps;
      showMessage(game.plane.flaps ? 'FLAPS DOWN — slower, softer' : 'FLAPS UP', 2);
      break;
    case 'camera':
      game.camBoost = game.camBoost > 0 ? 0 : 14;
      showMessage(game.camBoost > 0 ? 'CAMERA: HIGH CHASE' : 'CAMERA: CHASE', 2);
      break;
    case 'restart':
      startMission(game.missionIndex);
      break;
    case 'title': {
      const save = game.save;
      game = createGame(game.missionIndex);
      game.save = save;
      break;
    }
    case 'retry':
      startMission(game.missionIndex);
      break;
    case 'shop':
      game.mode = 'shop';
      break;
    case 'shop-done':
    case 'next-mission':
      startMission(Math.min(6, game.missionIndex + 1));
      break;
    default:
      break;
  }
}

function handleKey(code) {
  ensureAudio(audio);
  if (code === 'KeyP') {
    if (game.mode === 'flying') game.mode = 'paused';
    else if (game.mode === 'paused') game.mode = 'flying';
  } else if (code === 'KeyM') {
    toggleMute(audio);
  } else if (code === 'KeyR') {
    if (game.mode !== 'title') startMission(game.missionIndex);
  }
}

input.onButton = handleButton;
input.onKey = handleKey;
attachInput(input, canvas);

// Frame loop.
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  if (game.mode === 'flying') {
    const cmd = pollInput(input);
    if (cmd.flaps) {
      game.plane.flaps = !game.plane.flaps;
      showMessage(game.plane.flaps ? 'FLAPS DOWN — slower, softer' : 'FLAPS UP', 2);
    }
    const events = stepPlane(game.world, game.plane, cmd, game.save.upgrades, dt);
    for (const ev of events) {
      if (ev === 'ring') {
        playRing(audio);
        showMessage(`RING CLEAR  +40 CR   (${ringsPassed(game.world)}/${game.world.rings.length})`, 2.5);
      } else if (ev === 'thud') {
        playThud(audio);
      } else if (ev === 'takeoff') {
        showMessage('AIRBORNE — FLY THE RINGS', 3);
      } else if (ev === 'fuel-empty') {
        if (game.time - game.lastBeep > 1) {
          playBeep(audio);
          game.lastBeep = game.time;
          showMessage('FUEL EMPTY — GLIDE TO A STRIP', 3);
        }
      } else if (ev === 'crash') {
        gameOver(game.plane.integrity <= 0 ? 'The airframe gave out.' : 'The aircraft came down hard.');
      }
    }
    game.time = game.plane.time;
    setEngine(audio, game.plane.throttle, true);

    // Landed somewhere: finish at the far strip, refuel at any strip, and
    // an empty tank in a field ends the sortie.
    if (game.plane.landed && !game.plane.crashed) {
      if (missionComplete(game.world, game.plane)) {
        awardCompletion();
      } else if (isOnRunway(game.world, game.plane.x, game.plane.y)) {
        if (!game.refuelled) {
          game.refuelled = true;
          game.plane.fuel = maxFuel(game.save.upgrades);
          game.plane.integrity = Math.min(100, game.plane.integrity + 25);
          showMessage('REFUELLED + PATCHED — TAKE OFF AGAIN', 3);
          playThud(audio);
        }
      } else if (game.plane.fuel <= 0.5) {
        gameOver('Out of fuel — the mail ends in a field.');
      } else {
        showMessage('FIELD LANDING — TAKE OFF AGAIN', 3);
      }
    }
    if (game.plane.alt > 1) game.refuelled = false;
    if (game.message && game.plane.time > game.messageUntil) game.message = '';
  } else {
    setEngine(audio, 0, false);
  }

  drawFrame(ctx, game);
  requestAnimationFrame(frame);
}

// Screenshot staging: ?shot=start|play|end&mission=N&seed=S
const params = shotParams();
if (params) {
  stageShot(game, params);
  // Paint twice, then signal readiness for the screenshot.
  drawFrame(ctx, game);
  drawFrame(ctx, game);
  window.__shotReady = true;
}

requestAnimationFrame(frame);
