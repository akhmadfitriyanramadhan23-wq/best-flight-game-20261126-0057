// Terrain rendering for Sky Courier: a pseudo-3D chase view.
// The ground is drawn as a grid of projected quads, far to near, each cell
// coloured by the world's terrain function — sea, beach, rice-field
// patchwork, forest, towns and roads — so the archipelago reads at a glance.
// Rings, runways, clouds and the volcano smoke are drawn on top.

import { FOCAL, HORIZON_Y, VIEW, PANEL_X } from './config.js';
import { clamp, lerp } from './random.js';
import { terrainAt, SEA } from './world.js';

const DAY = {
  skyTop: '#2f6fb4', skyMid: '#7fb2dd', skyLow: '#cfe6f2',
  sea: '#1d6f8f', seaDeep: '#155a78', seaShallow: '#3fa3a0',
  beach: '#e8d29a', grass: '#5da24a', fieldA: '#8fbf4a', fieldB: '#d9c25a',
  fieldC: '#6fae5f', forest: '#2f7a33', town: '#c9b18a', road: '#5c5148',
  rock: '#7a6a5c', crater: '#4a3a30', runway: '#3c3c40',
};
const NIGHT = {
  skyTop: '#04081a', skyMid: '#0b1633', skyLow: '#1a2c52',
  sea: '#0a2438', seaDeep: '#071a2c', seaShallow: '#123a4d',
  beach: '#6b6248', grass: '#1d3a1e', fieldA: '#2c4518', fieldB: '#4a3d1c',
  fieldC: '#24402a', forest: '#0f2c14', town: '#4a3d2c', road: '#241f1c',
  rock: '#2e2620', crater: '#1c1410', runway: '#17171c',
};

function palette(night) { return night ? NIGHT : DAY; }

function terrainColor(pal, kind, x, y, seed) {
  switch (kind) {
    case 0: { // sea: depth shimmer from the cell hash
      const h = ((Math.floor(x / 90) * 31 + Math.floor(y / 90) * 17 + seed) % 10 + 10) % 10;
      return h < 2 ? pal.seaShallow : h < 5 ? pal.sea : pal.seaDeep;
    }
    case 1: return pal.beach;
    case 2: return pal.grass;
    case 3: return pal.fieldA;
    case 4: return pal.fieldB;
    case 5: return pal.fieldC;
    case 6: return pal.forest;
    case 7: return pal.town;
    case 8: return pal.road;
    case 9: return pal.rock;
    case 10: return pal.crater;
    case 11: return pal.runway;
    default: return pal.sea;
  }
}

// Project a world point (x, y, z) to screen space from the chase camera.
// Returns null behind the near plane. cam: {x, y, alt, hx, hy, rx, ry}.
export function project(cam, x, y, z, horizonY) {
  const dx = x - cam.x, dy = y - cam.y;
  const fwd = dx * cam.hx + dy * cam.hy;
  if (fwd < 10) return null;
  const right = dx * cam.rx + dy * cam.ry;
  const s = FOCAL / fwd;
  return {
    x: PANEL_X / 2 + right * s,
    y: horizonY + (cam.alt - z) * s * 0.92,
    s, fwd,
  };
}

export function makeCamera(plane, boost = 0) {
  const hx = Math.cos(plane.heading), hy = Math.sin(plane.heading);
  return {
    x: plane.x - hx * 16, y: plane.y - hy * 16,
    alt: plane.alt + 5 + boost,
    hx, hy, rx: -hy, ry: hx,
  };
}

// Horizon line position: pitch of the plane moves it up and down.
export function horizonFor(plane) {
  return HORIZON_Y - plane.pitch * 260 - plane.vspeed * 0.6;
}

export function drawSky(ctx, world, plane, t) {
  const pal = palette(world.mission.night);
  const horizonY = horizonFor(plane);
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(0.6, pal.skyMid);
  g.addColorStop(1, pal.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, Math.max(horizonY, 0) + 1);
  if (world.mission.night) {
    // Stars and a low moon.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const sx = (i * 137.5) % VIEW.W;
      const sy = (i * 89.3) % Math.max(40, horizonY - 30);
      ctx.globalAlpha = 0.35 + ((i * 7) % 10) / 16;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4ecd0';
    ctx.beginPath(); ctx.arc(1050, 90, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9cf9f';
    ctx.beginPath(); ctx.arc(1042, 84, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1058, 98, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    // Low sun, warm on the water.
    const sunX = 180 + Math.sin(t * 0.01) * 10;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(sunX, horizonY - 120, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 180, 0.35)';
    ctx.beginPath(); ctx.arc(sunX, horizonY - 120, 52, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawGround(ctx, world, plane, t, camBoost = 0) {
  const pal = palette(world.mission.night);
  const cam = makeCamera(plane, camBoost);
  const horizonY = horizonFor(plane);

  // Sea fills everything below the horizon first.
  const sg = ctx.createLinearGradient(0, horizonY, 0, VIEW.H);
  sg.addColorStop(0, pal.seaShallow);
  sg.addColorStop(0.25, pal.sea);
  sg.addColorStop(1, pal.seaDeep);
  ctx.fillStyle = sg;
  ctx.fillRect(0, Math.max(horizonY, 0), VIEW.W, VIEW.H);

  // Ground grid, far rows first so near rows paint over them.
  const viewDist = Math.min(9000, 1600 + plane.alt * 9);
  const rows = [];
  let d = 30;
  while (d < viewDist) { rows.push(d); d *= 1.24; }
  rows.push(viewDist);
  const seed = world.seed;
  for (let ri = rows.length - 1; ri >= 0; ri--) {
    const dFar = rows[ri];
    const dNear = ri === 0 ? 12 : rows[ri - 1];
    const halfW = dFar * 0.98;
    const cells = 14;
    const step = (halfW * 2) / cells;
    for (let ci = 0; ci < cells; ci++) {
      const lat0 = -halfW + ci * step;
      const lat1 = lat0 + step;
      const midD = (dFar + dNear) / 2;
      const midLat = (lat0 + lat1) / 2;
      const wx = plane.x + cam.hx * midD + cam.rx * midLat;
      const wy = plane.y + cam.hy * midD + cam.ry * midLat;
      const kind = terrainAt(world, wx, wy);
      if (kind === SEA) continue;
      const p00 = project(cam, plane.x + cam.hx * dNear + cam.rx * lat0, plane.y + cam.hy * dNear + cam.ry * lat0, 0, horizonY);
      const p10 = project(cam, plane.x + cam.hx * dNear + cam.rx * lat1, plane.y + cam.hy * dNear + cam.ry * lat1, 0, horizonY);
      const p11 = project(cam, plane.x + cam.hx * dFar + cam.rx * lat1, plane.y + cam.hy * dFar + cam.ry * lat1, 0, horizonY);
      const p01 = project(cam, plane.x + cam.hx * dFar + cam.rx * lat0, plane.y + cam.hy * dFar + cam.ry * lat0, 0, horizonY);
      if (!p00 || !p10 || !p11 || !p01) continue;
      ctx.fillStyle = terrainColor(pal, kind, wx, wy, seed);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
      ctx.closePath(); ctx.fill();
    }
  }

  drawRunway(ctx, world, cam, horizonY, world.runwayStart, t);
  drawRunway(ctx, world, cam, horizonY, world.runwayEnd, t);
  drawRings(ctx, world, cam, horizonY, t);
  drawClouds(ctx, world, cam, horizonY, t);
  if (world.volcano) drawVolcanoSmoke(ctx, world, cam, horizonY, t);
}

function drawRunway(ctx, world, cam, horizonY, rw, t) {
  const pal = palette(world.mission.night);
  const pts = rw.corners.map((c) => project(cam, c.x, c.y, 0, horizonY));
  if (pts.some((p) => p === null)) return;
  // Only draw when the strip is plausibly ahead and on screen.
  if (pts.every((p) => p.x < -80 || p.x > VIEW.W + 80)) return;
  ctx.fillStyle = pal.runway;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Edge lights down both long sides, so the strip reads from far away.
  ctx.fillStyle = world.mission.night ? '#ffd97a' : '#fff6c8';
  if (world.mission.night) { ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 10; }
  for (let i = 0; i <= 7; i++) {
    const f = i / 7;
    for (const edge of [[rw.corners[0], rw.corners[1]], [rw.corners[3], rw.corners[2]]]) {
      const ex = edge[0].x + (edge[1].x - edge[0].x) * f;
      const ey = edge[0].y + (edge[1].y - edge[0].y) * f;
      const p = project(cam, ex, ey, 1, horizonY);
      if (!p) continue;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, 3.2 * p.s), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  // Centreline dashes.
  ctx.strokeStyle = world.mission.night ? '#ffe9a8' : '#f5f5e8';
  ctx.lineWidth = Math.max(1, 2.4 * pts[0].s);
  ctx.beginPath();
  const a = project(cam, rw.threshold.x, rw.threshold.y, 0, horizonY);
  const b = project(cam, rw.farEnd.x, rw.farEnd.y, 0, horizonY);
  if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // Threshold lights: white on the left, green on the right at night.
  const blink = 0.6 + 0.4 * Math.sin(t * 3);
  ctx.fillStyle = world.mission.night ? `rgba(120,255,140,${blink})` : '#e8ffe8';
  for (const c of rw.corners) {
    const p = project(cam, c.x, c.y, 1, horizonY);
    if (!p) continue;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, 3 * p.s), 0, Math.PI * 2); ctx.fill();
  }
}

function drawRings(ctx, world, cam, horizonY, t) {
  const night = world.mission.night;
  const sorted = [...world.rings].sort((a, b) => {
    const da = Math.hypot(a.x - cam.x, a.y - cam.y);
    const db = Math.hypot(b.x - cam.x, b.y - cam.y);
    return db - da;
  });
  for (const ring of sorted) {
    const p = project(cam, ring.x, ring.y, ring.z, horizonY);
    if (!p || p.fwd < 12) continue;
    const R = 26 * p.s;
    if (R < 1.5) continue;
    const pulse = 1 + 0.06 * Math.sin(t * 4 + ring.x * 0.01);
    const r = R * pulse;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (ring.passed) {
      ctx.strokeStyle = 'rgba(120, 220, 130, 0.85)';
      ctx.lineWidth = Math.max(2, r * 0.10);
    } else {
      const glow = night ? 'rgba(255, 190, 60, 0.95)' : 'rgba(255, 170, 30, 0.95)';
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(2.5, r * 0.14);
      ctx.shadowColor = '#ffb020';
      ctx.shadowBlur = night ? 18 : 8;
    }
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // Distance label for the next ring.
    if (!ring.passed && ring === world.rings.find((x) => !x.passed)) {
      const dist = Math.round(Math.hypot(ring.x - cam.x, ring.y - cam.y));
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = night ? '#ffe1a0' : '#7a4d00';
      ctx.fillText(`${dist} m`, p.x, p.y - r - 8);
    }
  }
}

function drawClouds(ctx, world, cam, horizonY, t) {
  const night = world.mission.night;
  const sorted = [...world.clouds].sort((a, b) => {
    const da = Math.hypot(a.x - cam.x, a.y - cam.y);
    const db = Math.hypot(b.x - cam.x, b.y - cam.y);
    return db - da;
  });
  for (const c of sorted) {
    const p = project(cam, c.x, c.y, c.z, horizonY);
    if (!p || p.fwd < 20) continue;
    const r = c.r * p.s;
    if (r < 2 || r > 900) continue;
    ctx.fillStyle = night ? 'rgba(150, 165, 200, 0.30)' : 'rgba(255, 255, 255, 0.82)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.36, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.5, p.y + r * 0.08, r * 0.6, r * 0.26, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.5, p.y + r * 0.06, r * 0.65, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVolcanoSmoke(ctx, world, cam, horizonY, t) {
  const v = world.volcano;
  const base = project(cam, v.x, v.y, v.peak, horizonY);
  if (!base || base.fwd < 30) return;
  for (let i = 0; i < 5; i++) {
    const z = v.peak + 40 + i * 46 + Math.sin(t * 0.7 + i) * 6;
    const p = project(cam, v.x + i * 12, v.y - i * 8, z, horizonY);
    if (!p) continue;
    const r = (26 + i * 16) * p.s;
    if (r < 1) continue;
    ctx.fillStyle = `rgba(120, 110, 105, ${0.5 - i * 0.07})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Lava glow at the crater.
  ctx.fillStyle = 'rgba(255, 90, 20, 0.8)';
  const glow = project(cam, v.x, v.y, v.peak + 4, horizonY);
  if (glow) {
    ctx.beginPath(); ctx.arc(glow.x, glow.y, Math.max(2, 9 * glow.s), 0, Math.PI * 2); ctx.fill();
  }
}

// Rain streaks for storm missions, drawn over the world.
export function drawRain(ctx, world, t) {
  if (world.mission.rain <= 0) return;
  ctx.strokeStyle = 'rgba(190, 215, 235, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    const x = ((i * 173 + t * 620) % (VIEW.W + 80)) - 40;
    const y = ((i * 97 + t * 900) % (VIEW.H + 40)) - 20;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y + 16);
  }
  ctx.stroke();
}

export { clamp, lerp };
