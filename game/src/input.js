// Keyboard and mouse input for Sky Courier.
// Keyboard: arrows/WASD bank and pitch, W/S (and Shift/Ctrl) throttle,
// Space flaps, P pause, M mute, R restart. Mouse: click the on-screen
// buttons and drag the throttle slider. Input state is polled each frame.

import { clamp } from './random.js';
import { THROTTLE_SLIDER, buttonAt } from './render.js';

export function makeInput() {
  return {
    keys: new Set(),
    pitch: 0, // -1..1, +1 = nose up
    roll: 0, // -1..1, +1 = bank right
    throttle: 0, // 0..1, set by keys or the slider
    throttleKeys: false,
    flapsPressed: false, // edge-triggered: consumed by main.js
    draggingSlider: false,
    onButton: null, // main.js assigns: (id) => void
    onKey: null, // main.js assigns: (code) => void
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === 'Space') { input.flapsPressed = true; e.preventDefault(); }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (input.onKey) input.onKey(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(canvas, e);
    const s = THROTTLE_SLIDER;
    if (p.x >= s.x - 8 && p.x <= s.x + s.w + 8 && p.y >= s.y - 10 && p.y <= s.y + s.h + 10) {
      input.draggingSlider = true;
      input.throttle = clamp((p.x - s.x) / s.w, 0, 1);
      input.throttleKeys = false;
      return;
    }
    const id = buttonAt(p.x, p.y);
    if (id && input.onButton) input.onButton(id);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.draggingSlider) return;
    const p = canvasPoint(canvas, e);
    const s = THROTTLE_SLIDER;
    input.throttle = clamp((p.x - s.x) / s.w, 0, 1);
    input.throttleKeys = false;
  });
  window.addEventListener('pointerup', () => { input.draggingSlider = false; });
}

function canvasPoint(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

// Poll the held keys into a per-frame command. Called once per frame.
export function pollInput(input) {
  const k = input.keys;
  let roll = 0;
  if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
  let pitch = 0;
  if (k.has('ArrowUp') || k.has('KeyW')) pitch += 1;
  if (k.has('ArrowDown') || k.has('KeyS')) pitch -= 1;
  input.roll = roll;
  input.pitch = pitch;

  // Throttle keys: W/S double as pitch in this layout, so throttle lives on
  // Shift (up) / Control (down) plus the mouse slider.
  let used = false;
  if (k.has('ShiftLeft') || k.has('ShiftRight')) { input.throttle = clamp(input.throttle + 0.012, 0, 1); used = true; }
  if (k.has('ControlLeft') || k.has('ControlRight')) { input.throttle = clamp(input.throttle - 0.012, 0, 1); used = true; }
  if (used) input.throttleKeys = true;

  const flaps = input.flapsPressed;
  input.flapsPressed = false;
  return { pitch, roll, throttle: input.throttle, flaps };
}
