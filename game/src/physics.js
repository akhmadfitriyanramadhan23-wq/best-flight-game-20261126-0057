// Flight model for Sky Courier: arcade but honest — throttle sets speed,
// bank turns the nose, pitch trades speed for altitude, and the wind is
// always pushing. Also the autopilot the screenshot staging flies with.

import { PLANE } from './config.js';
import { clamp, lerp, angleDiff, degToRad } from './random.js';
import { terrainHeight, nextRing, ringsPassed } from './world.js';

export function makePlane(world, upgrades) {
  const rw = world.runwayStart;
  return {
    x: rw.cx, y: rw.cy,
    alt: 0,
    heading: rw.heading,
    pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    fuel: maxFuel(upgrades),
    integrity: PLANE.integrityMax,
    vspeed: 0,
    onGround: true,
    flaps: false,
    crashed: false,
    landed: false,
    time: 0,
  };
}

export function maxSpeed(upgrades) {
  let s = PLANE.maxSpeedBase;
  if (upgrades.engine) s += PLANE.maxSpeedPerEngine;
  if (upgrades.engine2) s += PLANE.maxSpeedPerEngine;
  return s;
}

export function maxFuel(upgrades) {
  let f = PLANE.fuelTankBase;
  if (upgrades.tank) f += PLANE.fuelTankPerTank;
  if (upgrades.tank2) f += PLANE.fuelTankPerTank;
  return f;
}

// Current wind vector (m/s) with gusts, from the mission's weather.
export function windAt(world, t) {
  const m = world.mission;
  const gust = m.gust * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1.7);
  const speed = Math.max(0, m.wind.speed + gust);
  const dir = degToRad(m.wind.dir) + Math.sin(t * 0.11) * 0.06;
  return { x: Math.cos(dir) * speed, y: Math.sin(dir) * speed, speed, dir };
}

// One physics step. input: {pitch: -1..1 (up positive), roll: -1..1 (right
// positive), throttle: 0..1, flaps: bool}. Returns event strings for sounds.
export function stepPlane(world, plane, input, upgrades, dt) {
  const events = [];
  plane.time += dt;
  const m = world.mission;

  // Throttle and speed.
  plane.throttle = clamp(input.throttle, 0, 1);
  const targetSpeed = plane.throttle * maxSpeed(upgrades);
  const accel = plane.onGround ? PLANE.accel * 1.4 : PLANE.accel;
  plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);
  if (plane.speed < 0) plane.speed = 0;

  // Bank and pitch ease toward the pilot's command.
  const rollTarget = input.roll * PLANE.maxRoll;
  const pitchTarget = input.pitch * PLANE.maxPitch;
  plane.roll = lerp(plane.roll, rollTarget, clamp(dt * 3.2, 0, 1));
  plane.pitch = lerp(plane.pitch, pitchTarget, clamp(dt * 2.6, 0, 1));

  // Bank turns the nose; faster flight turns gentler. On the ground the
  // wheels keep the nose straight — a bush plane steers with the rudder.
  const turnRate = (9.81 * Math.tan(plane.roll) / Math.max(plane.speed, 12)) * PLANE.turnAuthority * (plane.onGround ? 0.15 : 1);
  plane.heading += turnRate * dt;

  // Altitude: pitch gives climb, and below stall speed the wing gives up.
  const stall = PLANE.stallSpeed * (plane.flaps ? 0.8 : 1);
  let vs = Math.sin(plane.pitch) * plane.speed;
  if (!plane.onGround && plane.speed < stall) vs -= (stall - plane.speed) * 0.9;
  if (plane.onGround) {
    if (plane.speed > stall + 4 && plane.pitch > 0.08) {
      plane.onGround = false; // rotate and lift off
      plane.landed = false;
      events.push('takeoff');
    } else {
      vs = 0; // still rolling: the wheels hold the altitude
    }
  }
  plane.vspeed = vs;
  plane.alt += vs * dt;
  if (plane.alt < 0) plane.alt = 0;

  // Move over the ground, plus the wind's push (a parked or rolling plane
  // barely drifts; a flying one is carried).
  const w = windAt(world, plane.time);
  const windFactor = plane.onGround ? 0.2 : 1;
  plane.x += Math.cos(plane.heading) * plane.speed * dt + w.x * dt * windFactor;
  plane.y += Math.sin(plane.heading) * plane.speed * dt + w.y * dt * windFactor;

  // Fuel burns with throttle; empty tanks mean a glider, then a field.
  plane.fuel -= plane.throttle * PLANE.fuelBurn * dt * 10;
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.throttle = 0; // the engine quits: glide from here
    if (input.throttle > 0) events.push('fuel-empty');
  }

  // Rings: fly within the ring's radius of its centre to clear it.
  const ring = nextRing(world);
  if (ring && !plane.onGround) {
    const dx = ring.x - plane.x, dy = ring.y - plane.y, dz = ring.z - plane.alt;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < PLANE.ringRadius) {
      ring.passed = true;
      events.push('ring');
    }
  }

  // Ground contact — only when actually coming down, not in the first
  // moments after lift-off when the wheels are still inches off the strip.
  if (plane.alt <= 0.5 && !plane.onGround && plane.vspeed <= 0.5) {
    plane.alt = 0;
    plane.onGround = true;
    const hard = -plane.vspeed;
    const onRunway = onAnyRunway(world, plane.x, plane.y);
    if (hard > 7) {
      damagePlane(plane, upgrades, Math.min(60, (hard - 7) * 9), events);
      events.push('crash');
      plane.crashed = true;
    } else if (hard > 3.5) {
      damagePlane(plane, upgrades, (hard - 3.5) * 6, events);
      events.push('thud');
      if (onRunway) plane.landed = true;
    } else {
      events.push('thud');
      if (onRunway) plane.landed = true;
    }
    if (!onRunway && plane.speed > 14) {
      damagePlane(plane, upgrades, 35, events);
      events.push('crash');
      plane.crashed = true;
    }
    plane.vspeed = 0;
  }

  // Terrain collision: flying into a hillside or the volcano — only when
  // actually below the ground's surface, not while climbing out just above it.
  if (!plane.onGround) {
    const ground = terrainHeight(world, plane.x, plane.y);
    if (plane.alt < ground) {
      damagePlane(plane, upgrades, 100, events);
      events.push('crash');
      plane.crashed = true;
    }
  }

  if (plane.integrity <= 0 && !plane.crashed) {
    plane.crashed = true;
    events.push('crash');
  }
  return events;
}

function damagePlane(plane, upgrades, amount, events) {
  const reduction = upgrades.flaps ? 0.6 : 1;
  plane.integrity = Math.max(0, plane.integrity - amount * reduction);
  if (plane.integrity <= 0) events.push('airframe-gone');
}

function onAnyRunway(world, x, y) {
  return pointOnRunway(world.runwayStart, x, y) || pointOnRunway(world.runwayEnd, x, y);
}

export function isOnRunway(world, x, y) { return onAnyRunway(world, x, y); }

function pointOnRunway(rw, x, y) {
  const dx = x - rw.cx, dy = y - rw.cy;
  const along = dx * Math.cos(rw.heading) + dy * Math.sin(rw.heading);
  const across = -dx * Math.sin(rw.heading) + dy * Math.cos(rw.heading);
  return Math.abs(along) <= rw.len / 2 && Math.abs(across) <= rw.wid / 2 + 8;
}

// Mission complete when every ring is cleared and the plane is down on the
// destination runway.
export function missionComplete(world, plane) {
  return ringsPassed(world) === world.rings.length && plane.landed &&
    pointOnRunway(world.runwayEnd, plane.x, plane.y);
}

// Score for a finished sortie: rings, delivery bonus, and what is left of
// the airframe and the tanks.
export function sortieScore(world, plane) {
  const rings = ringsPassed(world) * PLANE.ringScore;
  const bonus = missionComplete(world, plane) ? PLANE.deliveryBonus : 0;
  const care = Math.round((plane.integrity / PLANE.integrityMax) * 40 + (plane.fuel / maxFuel({})) * 20);
  return rings + bonus + care;
}

// --- Autopilot -------------------------------------------------------------
// Flies the real rules toward the next ring, then onto the runway. The
// screenshot staging uses it; the player never sees it.

export function autopilotInput(world, plane, upgrades) {
  const ring = nextRing(world);
  let tx, ty, tz, throttle = 0.65;
  if (ring) {
    tx = ring.x; ty = ring.y; tz = ring.z;
  } else {
    const rw = world.runwayEnd;
    const dx = Math.cos(rw.heading), dy = Math.sin(rw.heading);
    // Final approach: join the extended centreline well out, then follow a
    // steady glide slope down to the threshold — a fixed aim point and a
    // slope, so the descent actually arrives on the strip. Never slower
    // than the stall: a stalled final is a crash, not a landing.
    const relX = plane.x - rw.cx, relY = plane.y - rw.cy;
    const along = -(relX * dx + relY * dy); // metres before the threshold
    const dist = Math.hypot(relX, relY);
    if (dist > 900 || (along < -100 && plane.alt > 40)) {
      tx = rw.cx - dx * 700; ty = rw.cy - dy * 700; tz = 70;
      throttle = 0.55;
    } else if (along < -100) {
      // Past the threshold but still low: stay on the strip, aim at its
      // far end and set her down, instead of turning around for another lap.
      tx = rw.cx + dx * 210; ty = rw.cy + dy * 210; tz = 0;
      throttle = 0.4;
    } else {
      // Follow the centreline with a strong lateral correction: the desired
      // heading angles back toward the line in proportion to the offset,
      // so a crosswind cannot hold the track parallel off the strip. The
      // slope meets the ground just past the threshold: low over the
      // numbers, then a firm descent onto the strip, not a float past it.
      const relX = plane.x - rw.cx, relY = plane.y - rw.cy;
      const acrossErr = -relX * dy + relY * dx; // + = right of the line
      const desired = rw.heading + clamp(-acrossErr * 0.03, -0.5, 0.5);
      tx = plane.x + Math.cos(desired) * 400;
      ty = plane.y + Math.sin(desired) * 400;
      tz = Math.max(-8, (along - 180) * 0.10); // 10% glide slope
      throttle = 0.5; // keep speed up in a crosswind: a slow final crabs worse
    }
    if (plane.alt < 60 && dist > 900) throttle = 0.5;
  }
  const wantHeading = Math.atan2(ty - plane.y, tx - plane.x);
  const dh = angleDiff(plane.heading, wantHeading);
  const roll = clamp(dh * 1.2, -0.7, 0.7);
  const altErr = tz - plane.alt;
  const pitch = clamp(altErr / 40, -1, 1) * 0.8;
  return {
    pitch: plane.onGround ? (plane.speed > 26 ? 0.55 : 0) : pitch,
    roll: plane.onGround ? clamp(dh * 0.4, -0.3, 0.3) : roll,
    throttle,
    flaps: !ring && plane.alt < 120,
  };
}
