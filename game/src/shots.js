// Screenshot staging for Sky Courier.
// ?shot=start|play|end&mission=N&seed=S plays the real rules forward from a
// fresh world with the autopilot, paints, and sets window.__shotReady — so
// every screenshot is a real render of the game's own code, deterministic
// for a fixed seed.

import { MISSIONS } from './config.js';
import { buildWorld } from './world.js';
import { makePlane, autopilotInput, stepPlane } from './physics.js';

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  if (!q.has('shot')) return null;
  return {
    kind: q.get('shot') || 'play',
    mission: Math.max(1, Math.min(7, parseInt(q.get('mission') || '1', 10) || 1)),
    seed: parseInt(q.get('seed') || '7', 10) || 7,
  };
}

// Place the plane on the approach to a ring, pointing at it.
function placeBeforeRing(game, ringIndex, backoff) {
  const ring = game.world.rings[ringIndex];
  const plane = game.plane;
  const prev = game.world.rings[ringIndex - 1] || { x: game.world.runwayStart.cx, y: game.world.runwayStart.cy, z: 120 };
  const dx = ring.x - prev.x, dy = ring.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  plane.x = ring.x - (dx / len) * backoff;
  plane.y = ring.y - (dy / len) * backoff;
  plane.alt = ring.z;
  plane.heading = Math.atan2(dy, dx);
  plane.speed = 42;
  plane.throttle = 0.7;
  plane.onGround = false;
  plane.pitch = 0;
  plane.roll = 0;
}

// Place the plane on final approach to the destination runway. lat offsets
// the plane sideways from the centreline so the strip stays visible beside
// the aircraft instead of hiding behind it.
function placeOnFinal(game, dist, alt, lat = 0) {
  const rw = game.world.runwayEnd;
  const dx = Math.cos(rw.heading), dy = Math.sin(rw.heading);
  const plane = game.plane;
  plane.x = rw.cx - dx * dist - dy * lat;
  plane.y = rw.cy - dy * dist + dx * lat;
  plane.alt = alt;
  plane.heading = rw.heading;
  plane.speed = 36;
  plane.throttle = 0.35;
  plane.onGround = false;
  plane.pitch = -0.06;
  plane.roll = 0;
}

function simulate(game, seconds) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const input = autopilotInput(game.world, game.plane, game.save.upgrades);
    game.plane.flaps = !!input.flaps;
    stepPlane(game.world, game.plane, input, game.save.upgrades, dt);
    if (game.plane.crashed) break;
  }
  game.time = game.plane.time;
}

export function stageShot(game, params) {
  const mission = MISSIONS[params.mission - 1];
  game.world = buildWorld(mission);
  game.plane = makePlane(game.world, game.save.upgrades);
  game.mode = 'flying';
  game.message = '';

  if (params.kind === 'start') {
    // Title screen: the plane parked on the departure strip at dawn light.
    game.mode = 'title';
    game.time = 0;
    return;
  }
  if (params.kind === 'end') {
    // All rings already flown; the autopilot is on final for the runway.
    for (const r of game.world.rings) r.passed = true;
    game.input.throttle = 0.35;
    placeOnFinal(game, 650, 70, -45);
    simulate(game, 3.5);
    return;
  }
  // play: mid-action, at the last ring, so the ring and the runway ahead are
  // both in frame and the HUD is dense. Earlier rings count as flown, so the
  // autopilot aims at the next ring, not back down the route.
  const idx = game.world.rings.length - 1;
  for (let i = 0; i < idx; i++) game.world.rings[i].passed = true;
  game.input.throttle = 0.72;
  placeBeforeRing(game, idx, 520);
  simulate(game, 5);
}
