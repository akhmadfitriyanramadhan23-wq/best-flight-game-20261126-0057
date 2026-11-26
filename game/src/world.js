// World generation for Sky Courier: a procedural Indonesian archipelago.
// One seeded pass builds the islands, the towns and roads on them, the
// volcano (when the mission has one), the ring route and the two runways.
// Terrain is sampled by terrainAt(x, y), so the renderer and the physics both
// read the same ground truth.

import { makeRng, hash2, clamp, degToRad } from './random.js';

// Terrain kinds, each with a day palette entry in terrain.js.
export const SEA = 0, BEACH = 1, GRASS = 2, FIELD_A = 3, FIELD_B = 4, FIELD_C = 5,
  FOREST = 6, TOWN = 7, ROAD = 8, ROCK = 9, CRATER = 10, RUNWAY_GROUND = 11;

export function buildWorld(mission) {
  const rng = makeRng(mission.seed * 7919 + 13);
  const routeLen = mission.routeKm * 1000;
  const heading = degToRad(35 + rng() * 20); // overall route direction (NE-ish)
  const hx = Math.cos(heading), hy = Math.sin(heading);
  const rx = -hy, ry = hx; // right vector of the route

  // The route wanders gently: a chain of waypoints the rings hang from.
  const waypoints = [{ x: 0, y: 0 }];
  let wx = 0, wy = 0, wh = heading;
  const legs = mission.rings + 1;
  for (let i = 1; i <= legs; i++) {
    wh += (rng() - 0.5) * 0.5;
    const step = routeLen / legs;
    wx += Math.cos(wh) * step;
    wy += Math.sin(wh) * step;
    waypoints.push({ x: wx, y: wy });
  }
  const end = waypoints[waypoints.length - 1];

  // Islands: a band along the route plus a few outliers, so the ground below
  // is recognisable land and sea at every point of the flight.
  const islands = [];
  const count = mission.terrain.islands;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const along = (t - 0.08) * routeLen + rng() * 500;
    const across = (rng() - 0.5) * routeLen * 0.55;
    const cx = hx * along + rx * across;
    const cy = hy * along + ry * across;
    const r = 380 + rng() * 850;
    islands.push({
      x: cx, y: cy, r,
      seed: Math.floor(rng() * 1e9),
      peak: 30 + rng() * 70,
      kind: 'isle',
    });
  }
  // Volcano island: a tall cone off to one side of the route — close enough
  // to see and to fly past, far enough that the route never meets its cone.
  let volcano = null;
  if (mission.terrain.volcano) {
    const along = routeLen * (0.45 + rng() * 0.15);
    const across = (rng() < 0.5 ? -1 : 1) * (900 + rng() * 900);
    volcano = {
      x: hx * along + rx * across, y: hy * along + ry * across,
      r: 950 + rng() * 300, seed: Math.floor(rng() * 1e9),
      peak: 320 + rng() * 90, kind: 'volcano',
    };
    islands.push(volcano);
  }

  // Towns sit on the bigger islands near the coast; roads link their centres.
  const towns = [];
  const roads = [];
  for (const isl of islands) {
    if (isl.r < 600 || rng() < 0.35) continue;
    const a = rng() * Math.PI * 2;
    const d = isl.r * (0.35 + rng() * 0.4);
    const tx = isl.x + Math.cos(a) * d, ty = isl.y + Math.sin(a) * d;
    towns.push({ x: tx, y: ty, r: 60 + rng() * 70, seed: Math.floor(rng() * 1e9) });
    const a2 = a + Math.PI * (0.5 + rng());
    const ex = isl.x + Math.cos(a2) * isl.r * 0.85, ey = isl.y + Math.sin(a2) * isl.r * 0.85;
    roads.push({ x1: tx, y1: ty, x2: ex, y2: ey });
    if (rng() < 0.5) {
      const mx = (tx + ex) / 2 + (rng() - 0.5) * 200, my = (ty + ey) / 2 + (rng() - 0.5) * 200;
      roads.push({ x1: tx, y1: ty, x2: mx, y2: my });
      roads.push({ x1: mx, y1: my, x2: ex, y2: ey });
    }
  }

  // Rings hang above the waypoints, at the mission's ring altitude with a
  // little seeded wobble so the line is not a ruler-straight fence.
  const rings = [];
  for (let i = 1; i <= mission.rings; i++) {
    const w = waypoints[i];
    rings.push({
      x: w.x + (rng() - 0.5) * 160,
      y: w.y + (rng() - 0.5) * 160,
      z: mission.ringAlt + (rng() - 0.5) * 50,
      passed: false,
    });
  }

  // Runways: departure strip at the start, destination strip at the end,
  // each 420 m long, aligned with the route there.
  const startHeading = Math.atan2(waypoints[1].y - waypoints[0].y, waypoints[1].x - waypoints[0].x);
  const endHeading = Math.atan2(end.y - waypoints[waypoints.length - 2].y, end.x - waypoints[waypoints.length - 2].x);
  const runwayStart = makeRunway(0, 0, startHeading);
  const runwayEnd = makeRunway(end.x, end.y, endHeading);

  // Clouds: seeded puffs scattered along the route, higher in storm missions.
  const clouds = [];
  const nCloud = mission.rain > 0 ? 46 : 30;
  for (let i = 0; i < nCloud; i++) {
    const along = rng() * routeLen * 1.05 - 300;
    const across = (rng() - 0.5) * routeLen * 0.7;
    clouds.push({
      x: hx * along + rx * across, y: hy * along + ry * across,
      z: 260 + rng() * 320, r: 90 + rng() * 160, seed: rng(),
    });
  }

  const world = {
    mission, seed: mission.seed, heading, hx, hy, rx, ry,
    islands, towns, roads, volcano, rings, clouds,
    runwayStart, runwayEnd, waypoints, routeLen,
  };
  return world;
}

function makeRunway(cx, cy, heading) {
  const len = 420, wid = 26;
  const dx = Math.cos(heading), dy = Math.sin(heading);
  const px = -dy, py = dx;
  const hl = len / 2, hw = wid / 2;
  return {
    cx, cy, heading, len, wid,
    corners: [
      { x: cx - dx * hl - px * hw, y: cy - dy * hl - py * hw },
      { x: cx + dx * hl - px * hw, y: cy + dy * hl - py * hw },
      { x: cx + dx * hl + px * hw, y: cy + dy * hl + py * hw },
      { x: cx - dx * hl + px * hw, y: cy - dy * hl + py * hw },
    ],
    threshold: { x: cx - dx * hl, y: cy - dy * hl },
    farEnd: { x: cx + dx * hl, y: cy + dy * hl },
  };
}

// Distance from a point to a road segment, in metres.
function distToSegment(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - s.x1) * dx + (py - s.y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const qx = s.x1 + t * dx, qy = s.y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

// What the ground is at (x, y): sea, beach, fields, forest, town, road, rock.
export function terrainAt(world, x, y) {
  // Runway tarmac wins over anything under it.
  if (pointInRunway(world.runwayStart, x, y) || pointInRunway(world.runwayEnd, x, y)) return RUNWAY_GROUND;
  for (const road of world.roads) {
    if (distToSegment(x, y, road) < 7) return ROAD;
  }
  for (const town of world.towns) {
    if (Math.hypot(x - town.x, y - town.y) < town.r) {
      const h = hash2(Math.floor(x / 24), Math.floor(y / 24), town.seed);
      return h < 0.55 ? TOWN : GRASS;
    }
  }
  for (const isl of world.islands) {
    const d = Math.hypot(x - isl.x, y - isl.y);
    if (d > isl.r) continue;
    if (isl.kind === 'volcano') {
      if (d < isl.r * 0.10) return CRATER;
      if (d < isl.r * 0.42) return ROCK;
    }
    if (d > isl.r * 0.90) return BEACH;
    const cell = hash2(Math.floor(x / 130), Math.floor(y / 130), isl.seed);
    if (cell < 0.30) return FIELD_A;
    if (cell < 0.48) return FIELD_B;
    if (cell < 0.60) return FIELD_C;
    if (cell < 0.74) return FOREST;
    return GRASS;
  }
  return SEA;
}

// Ground elevation at (x, y): islands rise toward their centres, the volcano
// towers. The sea is 0. The strips are graded flat — a runway is never a
// hill — and the ground flattens toward each strip so the final approach
// never meets a hillside.
export function terrainHeight(world, x, y) {
  if (pointInRunway(world.runwayStart, x, y) || pointInRunway(world.runwayEnd, x, y)) return 0;
  let h = 0;
  for (const isl of world.islands) {
    const d = Math.hypot(x - isl.x, y - isl.y);
    if (d >= isl.r) continue;
    const t = 1 - d / isl.r;
    h = Math.max(h, t * t * isl.peak);
  }
  for (const rw of [world.runwayStart, world.runwayEnd]) {
    const d = Math.hypot(x - rw.cx, y - rw.cy);
    if (d < 700) h *= (d / 700) * (d / 700);
  }
  return h;
}

function pointInRunway(rw, x, y) {
  const dx = x - rw.cx, dy = y - rw.cy;
  const along = dx * Math.cos(rw.heading) + dy * Math.sin(rw.heading);
  const across = -dx * Math.sin(rw.heading) + dy * Math.cos(rw.heading);
  return Math.abs(along) <= rw.len / 2 + 6 && Math.abs(across) <= rw.wid / 2 + 6;
}

// Next unpassed ring, or null when the route is flown.
export function nextRing(world) {
  for (const r of world.rings) if (!r.passed) return r;
  return null;
}

export function ringsPassed(world) {
  return world.rings.filter((r) => r.passed).length;
}
