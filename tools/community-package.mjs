// Preserve the canonical animation cells; add the community site's neutral pose.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ROWS } from '../src/poses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'final/spritesheet.webp');
const encoded = fs.readFileSync(input);
const { data: canonical, info } = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 1536 || info.height !== 2288 || info.channels !== 4) throw new Error('Unexpected atlas dimensions.');
const rgba = Buffer.from(canonical);
for (let y = 0; y < 208; y++) {
  const destination = (y * 1536 + 6 * 192) * 4;
  for (let offset = destination; offset < destination + 192 * 4; offset++) {
    if (rgba[offset] !== 0) throw new Error('Neutral destination must be empty.');
  }
  canonical.copy(rgba, destination, y * 1536 * 4, (y * 1536 + 192) * 4);
}
const sheet = await sharp(rgba, { raw: info }).webp({ lossless: true, effort: 6, exact: true }).toBuffer();
const decoded = await sharp(sheet).ensureAlpha().raw().toBuffer();
if (!decoded.equals(rgba)) throw new Error('Lossless package encoding changed pixels.');
let count = 0;
for (const state of ROWS) for (let i = 0; i < state.frames; i++) {
  const row = state.row + Math.floor(i / 8), col = i % 8;
  for (let y = 0; y < 208; y++) {
    const start = ((row * 208 + y) * 1536 + col * 192) * 4;
    if (!decoded.subarray(start, start + 192 * 4).equals(canonical.subarray(start, start + 192 * 4))) {
      throw new Error(`Changed animation cell: ${state.state} ${i}`);
    }
  }
  count++;
}
if (count !== 73) throw new Error('Expected 73 animation cells.');
const output = path.join(root, 'package');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'spritesheet.webp'), sheet);
fs.writeFileSync(path.join(output, 'pet.json'), JSON.stringify({
  id: 'chiikawa-svg', displayName: 'Chiikawa',
  description: 'An unofficial Chiikawa companion for Codex. https://github.com/godxxy1229/chiikawa-codex-pet',
  spritesheetPath: 'spritesheet.webp', spriteVersionNumber: 2, kind: 'creature',
}, null, 2) + '\n');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const report = {
  ok: true, canonical_sha256: hash(encoded), public_sha256: hash(sheet),
  dimensions: [1536, 2288], animation_cells: count, neutral_cell: [0, 6], neutral_source: [0, 0],
  lossless_rgba_match: true, animation_pixels_preserved: true, look_pixels_preserved: true,
  canonical_rgba_sha256: hash(canonical), public_rgba_sha256: hash(decoded),
};
fs.writeFileSync(path.join(root, 'qa/community-package.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
