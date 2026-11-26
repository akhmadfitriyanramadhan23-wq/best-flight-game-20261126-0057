// Synthesised WebAudio sounds for Sky Courier — no audio files.
// Engine hum (two detuned oscillators through a lowpass, pitch follows
// throttle), ring chime, touchdown thud, warning beep. The context is
// created lazily on the first user gesture; headless screenshot runs never
// create one.

export function makeAudio() {
  return {
    ctx: null, muted: false,
    engineOsc: null, engineOsc2: null, engineGain: null, engineFilter: null,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx || audio.muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineFilter = audio.ctx.createBiquadFilter();
    audio.engineFilter.type = 'lowpass';
    audio.engineFilter.frequency.value = 420;
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineOsc2 = audio.ctx.createOscillator();
    audio.engineOsc2.type = 'triangle';
    audio.engineOsc2.frequency.value = 82;
    const g2 = audio.ctx.createGain();
    g2.gain.value = 0.4;
    audio.engineOsc.connect(audio.engineFilter);
    audio.engineOsc2.connect(g2);
    g2.connect(audio.engineFilter);
    audio.engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.ctx.destination);
    audio.engineOsc.start();
    audio.engineOsc2.start();
  } catch {
    audio.ctx = null;
  }
}

export function setEngine(audio, throttle, flying) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const target = flying ? 0.05 + throttle * 0.10 : 0;
  audio.engineGain.gain.setTargetAtTime(target, t, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 70, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(72 + throttle * 105, t, 0.1);
  audio.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
}

function tone(audio, freq, dur, type, vol, when = 0) {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playRing(audio) {
  tone(audio, 880, 0.35, 'sine', 0.22);
  tone(audio, 1318, 0.5, 'sine', 0.18, 0.09);
}

export function playThud(audio) {
  tone(audio, 70, 0.28, 'sine', 0.5);
  tone(audio, 45, 0.4, 'triangle', 0.3, 0.02);
}

export function playBeep(audio) {
  tone(audio, 1180, 0.12, 'square', 0.12);
  tone(audio, 1180, 0.12, 'square', 0.12, 0.16);
}

export function playCrash(audio) {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime;
  const len = audio.ctx.sampleRate * 0.5;
  const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buf;
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.4;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  src.connect(filter); filter.connect(gain); gain.connect(audio.ctx.destination);
  src.start(t0);
}

export function playFanfare(audio) {
  tone(audio, 523, 0.25, 'sine', 0.2);
  tone(audio, 659, 0.25, 'sine', 0.2, 0.12);
  tone(audio, 784, 0.4, 'sine', 0.22, 0.24);
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.ctx) {
    if (audio.muted) audio.engineGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
  }
  return audio.muted;
}
