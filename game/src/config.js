// Sky Courier: Archipelago Run — game configuration and the 7-mission campaign.
// Every value here is original to this game. Distances are metres, speeds m/s,
// altitudes metres, headings degrees (0 = east, 90 = south, clockwise on the map).

export const VIEW = { W: 1280, H: 720 };
export const PANEL_X = 992; // dense side HUD panel starts here
export const FOCAL = 720; // projection focal length (px)
export const HORIZON_Y = 300; // horizon line on screen at level flight

// Physics tuning for the little bush plane (a "Kancil" STOL courier).
export const PLANE = {
  maxSpeedBase: 58, // m/s, before engine upgrades
  maxSpeedPerEngine: 9,
  stallSpeed: 19,
  accel: 9, // m/s^2 toward throttle target speed
  turnAuthority: 1.6, // heading change per radian of bank
  maxRoll: 0.75, // radians of bank
  maxPitch: 0.38, // radians nose up/down
  fuelBurn: 0.025, // fuel units per second at full throttle
  fuelTankBase: 110,
  fuelTankPerTank: 45,
  integrityMax: 100,
  ringRadius: 26, // metres: fly inside this of a ring centre to clear it
  ringScore: 40,
  deliveryBonus: 120,
};

export const UPGRADES = [
  { id: 'engine', name: 'Engine Mk II', cost: 150, desc: '+9 m/s top speed, faster climb' },
  { id: 'engine2', name: 'Engine Mk III', cost: 260, desc: '+9 m/s top speed (needs Mk II)' },
  { id: 'tank', name: 'Long-range Tank', cost: 120, desc: '+45 fuel, longer legs' },
  { id: 'tank2', name: 'Ferry Tank', cost: 220, desc: '+45 fuel (needs Long-range)' },
  { id: 'flaps', name: 'STOL Flaps', cost: 100, desc: 'Softer landings, -40% touchdown damage' },
  { id: 'radio', name: 'Nav Radio', cost: 80, desc: 'Next-ring arrow + distance on the HUD' },
];

export const UPGRADE_COST = Object.fromEntries(UPGRADES.map((u) => [u.id, u.cost]));

// One mission = one named sortie over the archipelago. seed drives the
// procedural islands, route and weather so every mission is reproducible.
export const MISSIONS = [
  {
    id: 1, name: 'First Flight', seed: 101, routeKm: 6,
    brief: 'Take off from Bintan strip, thread 5 rings, land at Karimun.',
    wind: { dir: 200, speed: 3 }, gust: 0, night: false, rain: 0,
    rings: 5, startAlt: 0, ringAlt: 150,
    terrain: { islands: 9, volcano: false },
  },
  {
    id: 2, name: 'Island Hop', seed: 202, routeKm: 9,
    brief: 'Hop the chain: 7 rings over lagoons and fishing towns.',
    wind: { dir: 140, speed: 6 }, gust: 1.5, night: false, rain: 0,
    rings: 7, startAlt: 0, ringAlt: 180,
    terrain: { islands: 12, volcano: false },
  },
  {
    id: 3, name: 'Volcano Pass', seed: 303, routeKm: 11,
    brief: 'Climb past smoking Gunung Api — mind the ridge, mind the wind.',
    wind: { dir: 90, speed: 9 }, gust: 3, night: false, rain: 0,
    rings: 8, startAlt: 0, ringAlt: 320,
    terrain: { islands: 11, volcano: true },
  },
  {
    id: 4, name: 'Storm Front', seed: 404, routeKm: 10,
    brief: 'A squall line is crossing the route. Rain, gusts, low cloud.',
    wind: { dir: 260, speed: 13 }, gust: 6, night: false, rain: 1,
    rings: 7, startAlt: 0, ringAlt: 200,
    terrain: { islands: 10, volcano: false },
  },
  {
    id: 5, name: 'Night Mail', seed: 505, routeKm: 12,
    brief: 'The mail flies after dark. Fly by your instruments and the beacons.',
    wind: { dir: 40, speed: 7 }, gust: 2, night: true, rain: 0,
    rings: 8, startAlt: 0, ringAlt: 220,
    terrain: { islands: 12, volcano: false },
  },
  {
    id: 6, name: 'Mountain Rescue', seed: 606, routeKm: 9,
    brief: 'A climber is hurt in the high valley. Tight turns, short strip.',
    wind: { dir: 310, speed: 11 }, gust: 4.5, night: false, rain: 0,
    rings: 6, startAlt: 0, ringAlt: 380,
    terrain: { islands: 10, volcano: true },
  },
  {
    id: 7, name: 'Grand Archipelago Tour', seed: 707, routeKm: 16,
    brief: 'The whole chain, dawn to dusk: 10 rings, every system working.',
    wind: { dir: 170, speed: 10 }, gust: 4, night: false, rain: 0.4,
    rings: 10, startAlt: 0, ringAlt: 380,
    terrain: { islands: 14, volcano: true },
  },
];

export const SAVE_KEY = 'skycourier-save-v1';

export function defaultSave() {
  return { credits: 0, upgrades: {}, completed: [false, false, false, false, false, false, false] };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return defaultSave();
    return {
      credits: typeof s.credits === 'number' ? s.credits : 0,
      upgrades: s.upgrades && typeof s.upgrades === 'object' ? s.upgrades : {},
      completed: Array.isArray(s.completed) && s.completed.length === 7 ? s.completed : [false, false, false, false, false, false, false],
    };
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
}
