// 상태별 레퍼런스 ↔ 렌더 프레임 비교 시트 → qa/ref-compare/<state>.png
//   node tools/ref-sheets.mjs [state…]
// 레퍼런스는 몸(가장 큰 흰 덩어리) 폭이 idle 셀의 몸 폭과 같도록 줄여, 같은 크기로 나란히 놓는다(2배 확대).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 192, H = 208, K = 2, GAP = 8;
const BODY_PX = 134; // idle 셀의 몸 폭(외곽선 포함)
// 몸이 흰색이 아닌 레퍼런스는 흰 행 측정 대신 외곽선 포함 몸 폭(px)을 직접 준다
// running_pose.webp: 사용자가 준 running 자세 사진(다른 캐릭터, 손·창 쥐는 구조 참고용)
const BODY_W = { 'running_pose.webp': 881 };

// 상태 → [레퍼런스 파일, 잘라낼 패널(가로 n등분 중 i), 비교할 프레임 번호]
const MAP = {
  idle: [['idle.png', null, 0]],
  waving: [['waving.png', null, 1]],
  // 레퍼런스 패널 3(만세)이 새 정점 프레임 2에 대응한다
  jumping: [[0, 0], [1, 1], [3, 2], [4, 4]].map(([panel, frame]) => ['jumping_spritesheet.png', [5, panel], frame]),
  failed: [['failed.png', null, 0]],
  waiting: [['waiting.png', null, 0]],
  running: [['running_pose.webp', null, 0], ['running_frame1.png', null, 2]],
  review: [['review.png', null, 0]],
};

async function load(file, panel) {
  let img = sharp(path.join(root, 'reference', file)).ensureAlpha();
  const meta = await img.metadata();
  if (panel) {
    const [n, i] = panel, pw = Math.floor(meta.width / n);
    img = sharp(await img.extract({ left: i * pw + 4, top: 4, width: pw - 8, height: meta.height - 8 }).png().toBuffer());
  }
  const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
  // 흰색 픽셀 → 가로로 가장 넓게 이어진 흰 행의 폭을 몸 폭으로 본다(외곽선 두께 보정 +6%)
  let best = 0;
  for (let y = 0; y < info.height; y += 2) {
    let run = 0, x0 = -1, maxRun = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const white = data[i + 3] > 200 && data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
      if (white) { if (x0 < 0) x0 = x; run = x - x0 + 1; maxRun = Math.max(maxRun, run); } else x0 = -1;
    }
    best = Math.max(best, maxRun);
  }
  const scale = BODY_W[file] ? BODY_PX / BODY_W[file] : BODY_PX / (best * 1.06);
  const flat = await sharp({ create: { width: info.width, height: info.height, channels: 4, background: '#ffffff' } })
    .composite([{ input: await img.png().toBuffer() }]).png().toBuffer();
  return sharp(flat).resize(Math.round(info.width * scale * K), Math.round(info.height * scale * K)).png().toBuffer();
}

async function sheet(state) {
  const tiles = [];
  for (const [file, panel, frame] of MAP[state]) {
    const ref = await load(file, panel);
    const ours = await sharp({ create: { width: W, height: H, channels: 4, background: '#ffffff' } })
      .composite([{ input: path.join(root, 'frames', state, `${String(frame).padStart(2, '0')}.png`) }]).png().toBuffer();
    tiles.push(ref, await sharp(ours).resize(W * K, H * K, { kernel: 'nearest' }).png().toBuffer());
  }
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const width = GAP + metas.reduce((s, m) => s + m.width + GAP, 0);
  const height = GAP * 2 + Math.max(...metas.map((m) => m.height));
  let left = GAP;
  const comps = tiles.map((input, i) => { const c = { input, left, top: GAP }; left += metas[i].width + GAP; return c; });
  fs.mkdirSync(path.join(root, 'qa/ref-compare'), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: '#9aa0a8' } }).composite(comps)
    .png().toFile(path.join(root, 'qa/ref-compare', `${state}.png`));
}

// 손 비교: 레퍼런스(원본 px 상자)와 렌더 프레임(셀 px 상자)을 같은 몸 배율로 맞춰 4배로 나란히 → qa/ref-compare/hands-<state>.png
const HANDS = {
  waiting: [
    { ref: ['waiting.png', [250, 560, 590, 880]], ours: [0, [10, 126, 56, 60]] },
    { ref: ['waiting.png', [860, 560, 1200, 880]], ours: [0, [96, 118, 56, 60]] },
  ],
  running: [
    { ref: ['running_pose.webp', [230, 560, 560, 900]], ours: [0, [6, 134, 52, 46]] },
    { ref: ['running_pose.webp', [860, 540, 1200, 820]], ours: [0, [78, 128, 52, 46]] },
  ],
  review: [
    { ref: ['review.png', [250, 600, 570, 880]], ours: [0, [34, 134, 52, 46]] },
    { ref: ['review.png', [800, 600, 1060, 880]], ours: [0, [106, 134, 52, 46]] },
  ],
};
async function bodyScale(file) {
  if (BODY_W[file]) return BODY_PX / BODY_W[file];
  const { data, info } = await sharp(path.join(root, 'reference', file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let best = 0;
  for (let y = 0; y < info.height; y += 2) {
    let x0 = -1, maxRun = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const white = data[i + 3] > 200 && data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
      if (white) { if (x0 < 0) x0 = x; maxRun = Math.max(maxRun, x - x0 + 1); } else x0 = -1;
    }
    best = Math.max(best, maxRun);
  }
  return BODY_PX / (best * 1.06);
}
async function handsSheet(state) {
  const Z = 4, tiles = [];
  for (const { ref: [file, [x0, y0, x1, y1]], ours: [frame, [cx, cy, cw, chh]] } of HANDS[state]) {
    const sc = (await bodyScale(file)) * Z;
    const flat = await sharp({ create: { width: x1 - x0, height: y1 - y0, channels: 4, background: '#ffffff' } })
      .composite([{ input: await sharp(path.join(root, 'reference', file)).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer() }]).png().toBuffer();
    tiles.push(await sharp(flat).resize(Math.round((x1 - x0) * sc), Math.round((y1 - y0) * sc)).png().toBuffer());
    const cell = await sharp({ create: { width: W, height: H, channels: 4, background: '#ffffff' } })
      .composite([{ input: path.join(root, 'frames', state, `${String(frame).padStart(2, '0')}.png`) }]).png().toBuffer();
    const crop = await sharp(cell).extract({ left: cx, top: cy, width: cw, height: chh }).png().toBuffer();
    tiles.push(await sharp(crop).resize(cw * Z, chh * Z, { kernel: 'nearest' }).png().toBuffer());
  }
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const width = GAP + metas.reduce((s2, m) => s2 + m.width + GAP, 0), height = GAP * 2 + Math.max(...metas.map((m) => m.height));
  let left = GAP;
  const comps = tiles.map((input, i) => { const c = { input, left, top: GAP }; left += metas[i].width + GAP; return c; });
  await sharp({ create: { width, height, channels: 3, background: '#9aa0a8' } }).composite(comps)
    .png().toFile(path.join(root, 'qa/ref-compare', `hands-${state}.png`));
}

const states = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAP);
for (const st of states) {
  await sheet(st); console.log(`qa/ref-compare/${st}.png`);
  if (HANDS[st]) { await handsSheet(st); console.log(`qa/ref-compare/hands-${st}.png`); }
}
