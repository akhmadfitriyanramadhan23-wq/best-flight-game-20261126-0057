// Sky Courier: Archipelago Run — entry hand-in for make.fun.
// Copies game/ and screenshots/ beside this file into the output directory
// (MAKEFUN_OUTPUT_DIR, or /output) and writes /output/dossier.json with
// buildDossier from the kit's vendor/makefun-game.ts. Node 22 stdlib only.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const gameSrc = join(root, 'game');
const shotsSrc = join(root, 'screenshots');
if (!existsSync(gameSrc)) throw new Error('game/: no such directory');
if (!existsSync(shotsSrc)) throw new Error('screenshots/: no such directory');

cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
