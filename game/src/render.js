// Rendering for Sky Courier: the chase-view plane, the lit instruments, the
// dense side HUD panel, and every screen (title, pause, shop, complete,
// game over). Buttons drawn here are registered in `buttons` so input can
// click them; the game logic lives in main.js.

import { VIEW, PANEL_X, MISSIONS, UPGRADES, PLANE } from './config.js';
import { clamp, lerp, normDeg, radToDeg } from './random.js';
import { drawSky, drawGround, drawRain, horizonFor } from './terrain.js';
import { maxSpeed, maxFuel, windAt } from './physics.js';
import { nextRing, ringsPassed } from './world.js';

export const CX = PANEL_X / 2; // centre of the flyable area (left of the panel)
export const PLANE_Y = 478;
export const THROTTLE_SLIDER = { x: 430, y: 690, w: 300, h: 14 };

export let buttons = [];
export function clearButtons() { buttons = []; }
export function buttonAt(x, y) {
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

function button(ctx, id, x, y, w, h, label, opts = {}) {
  const active = opts.active;
  ctx.fillStyle = active ? '#ffb020' : 'rgba(20, 34, 54, 0.92)';
  ctx.strokeStyle = active ? '#ffd97a' : '#4a6a8a';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = active ? '#1a1200' : '#dcebf7';
  ctx.font = `bold ${opts.size || 13}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  buttons.push({ id, x, y, w, h });
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, fill = 'rgba(8, 16, 28, 0.78)') {
  ctx.fillStyle = fill;
  ctx.strokeStyle = 'rgba(120, 160, 200, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill(); ctx.stroke();
}

// --- The aircraft ----------------------------------------------------------
// A little STOL bush plane ("Kancil") seen from behind and slightly above:
// prop disc at the nose, wings across the fuselage, tail at the near end.
// It banks with roll and pitches a touch with the climb.

export function drawPlane(ctx, plane, t) {
  const bank = plane.roll;
  ctx.save();
  ctx.translate(CX, PLANE_Y + plane.pitch * 26);
  ctx.rotate(bank);
  ctx.scale(1, 1 - Math.abs(bank) * 0.08);

  // Propeller blur disc at the nose (top).
  ctx.fillStyle = 'rgba(40, 40, 48, 0.35)';
  ctx.beginPath(); ctx.ellipse(0, -118, 34, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(200, 200, 210, 0.5)';
  ctx.beginPath(); ctx.ellipse(0, -118, 30, 5, 0, 0, Math.PI * 2); ctx.fill();

  // Wings: tapered, slight dihedral, orange tips.
  ctx.fillStyle = '#e8641c';
  ctx.beginPath();
  ctx.moveTo(-150, -52); ctx.lineTo(-14, -66); ctx.lineTo(-14, -44); ctx.lineTo(-150, -34);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150, -52); ctx.lineTo(14, -66); ctx.lineTo(14, -44); ctx.lineTo(150, -34);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4f4f0';
  ctx.beginPath();
  ctx.moveTo(-14, -66); ctx.lineTo(14, -66); ctx.lineTo(14, -44); ctx.lineTo(-14, -44);
  ctx.closePath(); ctx.fill();

  // Fuselage: white body, orange cheatline, tail cone widening toward us.
  const fg = ctx.createLinearGradient(-26, 0, 26, 0);
  fg.addColorStop(0, '#d8dde2'); fg.addColorStop(0.5, '#ffffff'); fg.addColorStop(1, '#c9cfd6');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-20, -108);
  ctx.quadraticCurveTo(-30, -40, -26, 62);
  ctx.quadraticCurveTo(-24, 78, 0, 78);
  ctx.quadraticCurveTo(24, 78, 26, 62);
  ctx.quadraticCurveTo(30, -40, 20, -108);
  ctx.quadraticCurveTo(0, -120, -20, -108);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8641c';
  ctx.fillRect(-26, -46, 52, 7);
  ctx.fillStyle = '#1c2f45';
  ctx.beginPath(); ctx.ellipse(0, -84, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7fc4e8';
  ctx.beginPath(); ctx.ellipse(0, -84, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
  // Registration on the tail cone.
  ctx.fillStyle = '#2a3a4a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-SKY', 0, 52);

  // Tail fin (top, toward the nose in this view is the fin's base) and
  // horizontal stabiliser near the tail.
  ctx.fillStyle = '#e8641c';
  ctx.beginPath();
  ctx.moveTo(-4, 78); ctx.lineTo(-4, 108); ctx.lineTo(4, 108); ctx.lineTo(4, 78);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4f4f0';
  ctx.beginPath();
  ctx.moveTo(-58, 74); ctx.lineTo(-8, 66); ctx.lineTo(-8, 80); ctx.lineTo(-58, 86);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, 74); ctx.lineTo(8, 66); ctx.lineTo(8, 80); ctx.lineTo(58, 86);
  ctx.closePath(); ctx.fill();

  // Navigation lights: red port, green starboard, white strobe on the tail.
  const strobe = (Math.sin(t * 6) > 0.86) ? 1 : 0.25;
  ctx.fillStyle = '#ff2a2a';
  ctx.beginPath(); ctx.arc(-152, -43, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2aff5a';
  ctx.beginPath(); ctx.arc(152, -43, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${strobe})`;
  ctx.beginPath(); ctx.arc(0, 110, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- Instruments -----------------------------------------------------------

function dial(ctx, x, y, r, label) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#0c1622'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = '#8fb6d4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r + 12);
}

// Artificial horizon: sky/ground split that rolls and pitches.
function drawAttitude(ctx, x, y, r, plane) {
  dial(ctx, x, y, r, 'ATTITUDE');
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.roll);
  const off = clamp(plane.pitch * r * 1.4, -r, r);
  ctx.fillStyle = '#2f7fc4'; ctx.fillRect(-r, -r - off, r * 2, r + off);
  ctx.fillStyle = '#8a6a42'; ctx.fillRect(-r, -off, r * 2, r + off);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-r, -off); ctx.lineTo(r, -off); ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 16, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 16, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
  ctx.stroke();
}

function needleDial(ctx, x, y, r, label, value, max, unit, ticks) {
  dial(ctx, x, y, r, label);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#cfe4f2'; ctx.lineWidth = 1;
  for (let i = 0; i <= ticks; i++) {
    const a = -Math.PI * 0.75 + (i / ticks) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 7), Math.sin(a) * (r - 7));
    ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
    ctx.stroke();
  }
  const frac = clamp(value / max, 0, 1);
  const a = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9)); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(value)}${unit}`, x, y + 14);
}

function drawCompass(ctx, plane) {
  const cx = CX, y = 100, w = 420, h = 30;
  panel(ctx, cx - w / 2, y - 4, w, h + 8, 'rgba(8, 16, 28, 0.72)');
  const hdg = normDeg(radToDeg(plane.heading));
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - w / 2, y - 4, w, h + 8); ctx.clip();
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round((hdg + d) / 5) * 5;
    const dx = cx + ((normDeg(deg) - hdg + 540) % 360 - 180) * 3.1;
    if (dx < cx - w / 2 - 10 || dx > cx + w / 2 + 10) continue;
    const major = deg % 30 === 0;
    ctx.strokeStyle = '#cfe4f2';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(dx, y + h - 6); ctx.lineTo(dx, y + h - (major ? 16 : 10)); ctx.stroke();
    if (major) {
      ctx.fillStyle = '#dcebf7';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[normDeg(deg)] ?? String(normDeg(deg) / 10);
      ctx.fillText(label, dx, y + 12);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffb020';
  ctx.beginPath(); ctx.moveTo(cx - 6, y - 4); ctx.lineTo(cx + 6, y - 4); ctx.lineTo(cx, y + 6); ctx.closePath(); ctx.fill();
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.fillStyle = color;
  const fw = Math.max(0, Math.min(1, frac)) * w;
  if (fw > 2) { roundRect(ctx, x, y, fw, h, 3); ctx.fill(); }
}

// --- HUD -------------------------------------------------------------------

function drawHudNumbers(ctx, game) {
  const plane = game.plane;
  const hdg = normDeg(radToDeg(plane.heading));
  const spd = plane.speed * 3.6;
  const items = [
    ['ALT', `${Math.round(plane.alt)} m`],
    ['SPD', `${Math.round(spd)} km/h`],
    ['HDG', `${String(Math.round(hdg)).padStart(3, '0')}°`],
  ];
  let x = 22;
  for (const [label, value] of items) {
    panel(ctx, x, 18, 128, 56, 'rgba(8, 16, 28, 0.72)');
    ctx.fillStyle = '#9fc4dd';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 10, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(value, x + 10, 62);
    x += 140;
  }
  // Vertical speed readout under the ALT box.
  ctx.fillStyle = plane.vspeed < -4 ? '#ff8a7a' : '#bfe3c0';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`V/S ${plane.vspeed >= 0 ? '+' : ''}${plane.vspeed.toFixed(1)} m/s`, 24, 92);
}

function drawInstruments(ctx, game) {
  const plane = game.plane;
  const y = 640;
  drawAttitude(ctx, 62, y, 42, plane);
  needleDial(ctx, 172, y, 42, 'ALT m', plane.alt, 600, '', 6);
  needleDial(ctx, 282, y, 42, 'SPD km/h', plane.speed * 3.6, 240, '', 6);
  // Throttle bar, vertical.
  ctx.fillStyle = '#9fc4dd';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', 380, 592);
  bar(ctx, 372, 600, 16, 96, plane.throttle, '#ffb020');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, 380, 712);
}

function drawSidePanel(ctx, game) {
  const x = PANEL_X + 8, w = VIEW.W - PANEL_X - 16;
  const plane = game.plane;
  const mission = game.world.mission;
  const save = game.save;
  panel(ctx, PANEL_X, 0, VIEW.W - PANEL_X, VIEW.H, 'rgba(7, 13, 24, 0.88)');
  ctx.strokeStyle = 'rgba(120, 160, 200, 0.4)';
  ctx.beginPath(); ctx.moveTo(PANEL_X, 0); ctx.lineTo(PANEL_X, VIEW.H); ctx.stroke();

  let y = 18;
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SKY COURIER', x, y + 10);
  ctx.fillStyle = '#9fc4dd';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('ARCHIPELAGO RUN', x, y + 27);
  y += 46;

  // Mission block.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`M${mission.id} · ${mission.name}`, x, y);
  y += 16;
  ctx.fillStyle = '#b8cfe0';
  ctx.font = '11px system-ui, sans-serif';
  wrapText(ctx, mission.brief, x, y, w - 4, 14);
  y += 30;

  // Objective: rings progress.
  const passed = ringsPassed(game.world);
  ctx.fillStyle = '#dcebf7';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`RINGS  ${passed} / ${game.world.rings.length}`, x, y);
  y += 8;
  bar(ctx, x, y, w - 4, 10, passed / game.world.rings.length, '#ffb020');
  y += 24;
  const next = nextRing(game.world);
  ctx.fillStyle = '#b8cfe0';
  ctx.font = '11px system-ui, sans-serif';
  if (next) {
    const d = Math.round(Math.hypot(next.x - plane.x, next.y - plane.y));
    ctx.fillText(game.save.upgrades.radio ? `NEXT RING → ${d} m · ALT ${Math.round(next.z)} m` : 'NEXT RING AHEAD — FLY THE GLOW', x, y);
  } else {
    ctx.fillText('ALL RINGS CLEAR — LAND ON THE RUNWAY', x, y);
  }
  y += 26;

  // Credits.
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`CREDITS  ${save.credits}`, x, y);
  y += 26;

  // Fuel and integrity bars.
  ctx.fillStyle = '#dcebf7';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`FUEL  ${Math.round(plane.fuel)} / ${maxFuel(save.upgrades)}`, x, y);
  y += 6;
  bar(ctx, x, y, w - 4, 10, plane.fuel / maxFuel(save.upgrades), plane.fuel < 25 ? '#ff5a4a' : '#4ac3ff');
  y += 24;
  ctx.fillText(`AIRFRAME  ${Math.round(plane.integrity)}%`, x, y);
  y += 6;
  bar(ctx, x, y, w - 4, 10, plane.integrity / 100, plane.integrity < 40 ? '#ff5a4a' : '#7dff9a');
  y += 26;

  // Wind readout.
  const wind = windAt(game.world, plane.time);
  const windDir = normDeg(radToDeg(wind.dir));
  ctx.fillStyle = '#b8cfe0';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`WIND  ${Math.round(windDir)}° @ ${wind.speed.toFixed(1)} m/s` + (mission.gust > 0 ? `  GUST ${mission.gust} m/s` : ''), x, y);
  y += 18;
  ctx.fillText(mission.night ? 'NIGHT — INSTRUMENTS LIT' : mission.rain > 0 ? 'RAIN — VISIBILITY LOW' : 'DAY — CLEAR SKIES', x, y);
  y += 24;

  // Upgrades owned.
  ctx.fillStyle = '#dcebf7';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('UPGRADES', x, y);
  y += 15;
  ctx.font = '11px system-ui, sans-serif';
  const owned = UPGRADES.filter((u) => save.upgrades[u.id]);
  if (owned.length === 0) {
    ctx.fillStyle = '#8a9aa8';
    ctx.fillText('none yet — earn credits, buy in the shop', x, y);
    y += 14;
  } else {
    for (const u of owned) {
      ctx.fillStyle = '#7dff9a';
      ctx.fillText(`✓ ${u.name}`, x, y);
      y += 14;
    }
  }
  y += 10;

  // Mission list.
  ctx.fillStyle = '#dcebf7';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('CAMPAIGN', x, y);
  y += 15;
  ctx.font = '11px system-ui, sans-serif';
  for (const m of MISSIONS) {
    const done = save.completed[m.id - 1];
    const cur = m.id === mission.id;
    ctx.fillStyle = cur ? '#ffb020' : done ? '#7dff9a' : '#b8cfe0';
    ctx.fillText(`${done ? '✓' : cur ? '▶' : '○'}  M${m.id} ${m.name}`, x, y);
    y += 14;
  }
  y += 12;

  // Panel buttons.
  button(ctx, 'pause', x, y, 82, 30, game.mode === 'paused' ? 'RESUME' : 'PAUSE');
  button(ctx, 'mute', x + 90, y, 82, 30, game.audio.muted ? 'UNMUTE' : 'MUTE', { active: game.audio.muted });
  button(ctx, 'flaps', x + 180, y, 82, 30, 'FLAPS', { active: plane.flaps });
  y += 40;
  button(ctx, 'camera', x, y, 82, 30, 'CAM: CHASE');
  button(ctx, 'restart', x + 90, y, 82, 30, 'RESTART');
  button(ctx, 'title', x + 180, y, 82, 30, 'MENU');
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawBottomControls(ctx, game) {
  const s = THROTTLE_SLIDER;
  const plane = game.plane;
  ctx.fillStyle = '#9fc4dd';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THROTTLE', s.x, s.y - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, s.x, s.y, s.w, s.h, 7); ctx.fill();
  ctx.fillStyle = '#ffb020';
  roundRect(ctx, s.x, s.y, Math.max(6, s.w * plane.throttle), s.h, 7); ctx.fill();
  ctx.fillStyle = '#1a1200';
  ctx.beginPath(); ctx.arc(s.x + s.w * plane.throttle, s.y + s.h / 2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd97a'; ctx.lineWidth = 2; ctx.stroke();
  button(ctx, 'flaps2', s.x + s.w + 16, s.y - 6, 74, 26, plane.flaps ? 'FLAPS ▼' : 'FLAPS', { active: plane.flaps });
  // Message line.
  if (game.message) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.message, CX, 668);
  }
}

// --- Screens ----------------------------------------------------------------

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(4, 10, 20, 0.45)';
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SKY COURIER', 48, 118);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('A R C H I P E L A G O   R U N', 50, 152);
  ctx.fillStyle = '#cfe4f2';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Fly the mail across an Indonesian archipelago. Thread the rings,', 50, 184);
  ctx.fillText('mind your fuel, and put her down gently on the far strip.', 50, 206);

  // Mission select.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('CHOOSE A MISSION', 50, 252);
  let y = 268;
  for (const m of MISSIONS) {
    const done = game.save.completed[m.id - 1];
    const label = `${done ? '✓ ' : ''}M${m.id} — ${m.name}   ·   ${m.rings} rings   ·   ${m.routeKm} km${m.night ? '   ·   NIGHT' : ''}${m.rain ? '   ·   RAIN' : ''}`;
    button(ctx, `mission-${m.id}`, 48, y, 560, 34, label, { size: 14 });
    y += 42;
  }
  ctx.fillStyle = '#cfe4f2';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left'; // button() leaves textAlign centred; reset it here
  ctx.fillText(`Credits: ${game.save.credits}   ·   Upgrades owned: ${Object.keys(game.save.upgrades).filter((k) => game.save.upgrades[k]).length}`, 50, y + 8);
  ctx.fillText('Controls: ← → / A D bank · ↑ ↓ / W S pitch & throttle · Space flaps · P pause · M mute', 50, y + 32);
  ctx.fillText('Mouse: drag the throttle slider, click the panel buttons. Land on the runway to finish.', 50, y + 52);
}

function drawOverlay(ctx, title, lines, game) {
  ctx.fillStyle = 'rgba(4, 10, 20, 0.62)';
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  const w = 560, h = 300;
  const x = (VIEW.W - w) / 2, y = (VIEW.H - h) / 2;
  panel(ctx, x, y, w, h, 'rgba(10, 20, 34, 0.96)');
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW.W / 2, y + 52);
  ctx.fillStyle = '#dcebf7';
  ctx.font = '15px system-ui, sans-serif';
  let yy = y + 92;
  for (const line of lines) {
    ctx.fillText(line, VIEW.W / 2, yy);
    yy += 26;
  }
  return { x, y: y + h - 64, w };
}

function drawShop(ctx, game) {
  ctx.fillStyle = 'rgba(4, 10, 20, 0.72)';
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  const w = 640, h = 470;
  const x = (VIEW.W - w) / 2, y = (VIEW.H - h) / 2;
  panel(ctx, x, y, w, h, 'rgba(10, 20, 34, 0.97)');
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HANGAR — UPGRADES', VIEW.W / 2, y + 46);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`Your credits: ${game.save.credits}`, VIEW.W / 2, y + 76);
  let yy = y + 108;
  ctx.textAlign = 'left';
  for (const u of UPGRADES) {
    const owned = !!game.save.upgrades[u.id];
    const locked = (u.id === 'engine2' && !game.save.upgrades.engine) || (u.id === 'tank2' && !game.save.upgrades.tank);
    ctx.fillStyle = owned ? '#7dff9a' : '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${owned ? '✓ ' : ''}${u.name}`, x + 30, yy);
    ctx.fillStyle = '#b8cfe0';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(u.desc, x + 30, yy + 17);
    if (!owned) {
      button(ctx, `buy-${u.id}`, x + w - 130, yy - 14, 100, 30, locked ? 'LOCKED' : `${u.cost} CR`, { active: false });
    }
    yy += 44;
  }
  button(ctx, 'shop-done', x + w / 2 - 90, y + h - 52, 180, 36, 'FLY NEXT MISSION', { size: 15 });
}

// --- Frame -------------------------------------------------------------------

export function drawFrame(ctx, game) {
  clearButtons();
  const plane = game.plane;
  const t = game.time;
  ctx.clearRect(0, 0, VIEW.W, VIEW.H);

  // World (slightly counter-rolled so the bank reads).
  ctx.save();
  ctx.translate(CX, 360);
  ctx.rotate(-plane.roll * 0.10);
  ctx.translate(-CX, -360);
  drawSky(ctx, game.world, plane, t);
  drawGround(ctx, game.world, plane, t, game.camBoost || 0);
  drawRain(ctx, game.world, t);
  ctx.restore();

  // The aircraft, banked.
  if (game.mode !== 'title' || true) drawPlane(ctx, plane, t);

  if (game.mode === 'title') {
    drawTitle(ctx, game);
    return;
  }

  drawHudNumbers(ctx, game);
  drawCompass(ctx, plane);
  drawInstruments(ctx, game);
  drawSidePanel(ctx, game);
  drawBottomControls(ctx, game);

  // Low-fuel and damage warnings, flashing.
  if (plane.fuel < 25 && Math.sin(t * 6) > 0) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ LOW FUEL — LAND SOON', CX, 130);
  }
  if (plane.integrity < 35 && Math.sin(t * 6) > 0) {
    ctx.fillStyle = '#ff8a5a';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ AIRFRAME DAMAGE', CX, 156);
  }

  if (game.mode === 'paused') {
    const b = drawOverlay(ctx, 'PAUSED', [
      'The mail can wait. The weather cannot.',
      'P or the RESUME button to keep flying.',
    ], game);
    button(ctx, 'resume', b.x + 60, b.y, 180, 36, 'RESUME', { size: 15 });
    button(ctx, 'title', b.x + b.w - 240, b.y, 180, 36, 'MAIN MENU', { size: 15 });
  } else if (game.mode === 'complete') {
    const s = game.lastScore;
    const b = drawOverlay(ctx, 'MISSION COMPLETE', [
      `${game.world.mission.name} — delivered.`,
      `Rings ${s.rings} · Delivery ${s.bonus} · Care ${s.care} · Total ${s.total} credits`,
      `Airframe ${Math.round(plane.integrity)}% · Fuel left ${Math.round(plane.fuel)}`,
    ], game);
    button(ctx, 'shop', b.x + 30, b.y, 150, 36, 'HANGAR', { size: 15 });
    button(ctx, 'next-mission', b.x + 205, b.y, 150, 36, 'NEXT MISSION', { size: 15 });
    button(ctx, 'title', b.x + 380, b.y, 150, 36, 'MAIN MENU', { size: 15 });
  } else if (game.mode === 'gameover') {
    const b = drawOverlay(ctx, 'SORTIE LOST', [
      game.overReason || 'The aircraft is down.',
      'The mail is soggy, but the pilot walked away.',
      'Repairs are on the house this time.',
    ], game);
    button(ctx, 'retry', b.x + 60, b.y, 180, 36, 'FLY AGAIN', { size: 15 });
    button(ctx, 'title', b.x + b.w - 240, b.y, 180, 36, 'MAIN MENU', { size: 15 });
  } else if (game.mode === 'shop') {
    drawShop(ctx, game);
  }
}

export { lerp };
