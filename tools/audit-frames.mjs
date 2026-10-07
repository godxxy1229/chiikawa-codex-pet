// 전 프레임 자체 점검 → qa/frame-audit.json
//   node tools/audit-frames.mjs
// 1) 내부 구멍: 셀 테두리와 이어지지 않은 투명 픽셀 덩어리 (허용: 덩어리당 ≤ 2px)
//    무기·책을 든 프레임은 소품을 숨긴 렌더로 몸 자체의 구멍을 재고, 소품과 몸 사이에 갇힌 실제 빈 공간은
//    prop_gap_max로만 기록한다(doro의 키보드-몸 사이 공간과 같은 취급).
// 2) 선 없는 흰 가장자리: 흰 면이 외곽선 없이 배경에 닿는 픽셀 수. 숨은 연장부·밑면이 드러나면 늘어난다.
//    치이카와는 귀 밑동·머리 옆 등에 원래 열린 선이 있으므로 idle 0번을 기준으로 증가분(≤ 6px)만 본다.
// 3) 셀 가장자리: 테두리 3px 안의 불투명 픽셀 0
// 4) 눈물: 눈물 픽셀이 모두 몸 면(머리) 안쪽 2px 이상에 있어야 한다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { frameSvg } from '../build.mjs';
import { ROWS, framePose, CELL, ARM_DEGS, PAW_DEGS, WAVE_DEGS } from '../src/poses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = CELL.w, H = CELL.h;
const rig = fs.readFileSync(path.join(root, 'src/chiikawa-rig.svg'), 'utf8');
const ALL_IDS = [...rig.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
const TOP = ['ear-l', 'ear-r', 'tail', 'hip-lines', 'leg-l', 'leg-r', 'arm-l', 'arm-r', 'body-fill',
  'socket-l', 'socket-r', 'socket-l-top', 'socket-r-top', 'body-lines', 'face', 'weapon', 'weapon-run', 'grip-l', 'grip-r', 'grip-run-l', 'paw-r', 'book', 'tremble-0', 'tremble-1', 'tremble-2',
  ...ARM_DEGS.flatMap((d) => ['l', 'r'].map((side) => `arm-att-${side}-${d < 0 ? `m${-d}` : d}`)),
  ...WAVE_DEGS.map((d) => `arm-wave-r-${d}`),
  // 옆모습 몸(running-left/right, tools/gen-side.mjs)
  'tail-side', 'side-hip', 'foot-b', 'foot-f', 'body-side-fill', 'body-side-lines', ...PAW_DEGS.flatMap((d) => [`paw-f-${d}`, `paw-b-${d}`])];

const raw = async (svg) => (await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
const frame = async (state, i) => {
  const row = ROWS.find((r) => r.state === state);
  const buf = await sharp(path.join(root, 'frames', state, `${String(i).padStart(2, '0')}.png`)).ensureAlpha().raw().toBuffer();
  return { buf, mirrored: !!row.mirrorOf };
};

// 특정 파츠만 남긴 렌더(가림 없음): keep 외 최상위 파츠와 얼굴 내부 파츠를 숨긴다
async function only(pose, keep, faceKeep = []) {
  const p = structuredClone(pose);
  p.hide = [...(p.hide ?? [])];
  for (const id of TOP) if (!keep.includes(id) && id !== 'face') p.hide.push(id);
  if (!keep.includes('face')) {
    const faceIds = ['blush-l', 'blush-r', 'brows', 'brows-happy', 'brows-angry', 'brows-wavy', 'brows-cry', 'tears', 'tears-cry', 'eyes',
      'eyes-focus', 'eyes-cry', 'eyes-happy', 'mouth-w', 'chin', 'chin-smile', 'chin-open', 'chin-charge', 'tongue', 'mouth-open', 'mouth-charge', 'mouth-cry'];
    for (const id of faceIds) if (!faceKeep.includes(id)) p.hide.push(id);
  }
  p.show = (p.show ?? []).filter((id) => !p.hide.includes(id));
  return raw(frameSvg(p));
}

function holes(buf) {
  const n = W * H, outside = new Uint8Array(n), stack = [];
  const clear = (i) => buf[i * 4 + 3] < 128;
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || !clear(i)) continue;
    outside[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
  }
  // 남은 투명 픽셀을 덩어리로 묶는다
  const seen = new Uint8Array(n), sizes = [];
  for (let i = 0; i < n; i++) {
    if (outside[i] || seen[i] || !clear(i)) continue;
    let size = 0; const st = [i];
    while (st.length) {
      const j = st.pop();
      if (seen[j] || outside[j] || !clear(j)) continue;
      seen[j] = 1; size++;
      const x = j % W, y = (j / W) | 0;
      if (x > 0) st.push(j - 1); if (x < W - 1) st.push(j + 1);
      if (y > 0) st.push(j - W); if (y < H - 1) st.push(j + W);
    }
    sizes.push(size);
  }
  return sizes;
}

function bareWhite(buf) {
  let c = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    if (buf[i + 3] < 200 || buf[i] + buf[i + 1] + buf[i + 2] < 690) continue;
    if ([-4, 4, -W * 4, W * 4].some((d) => buf[i + d + 3] < 30)) c++;
  }
  return c;
}

function edgePixels(buf, m = 3) {
  let c = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x >= m && x < W - m && y >= m && y < H - m) continue;
    if (buf[(y * W + x) * 4 + 3] > 8) c++;
  }
  return c;
}

const report = { ok: true, rules: { hole_max_px: 2, prop_gaps: 'recorded, allowed', bare_white_increase_max: 6, edge_margin_px: 3, tear_inset_px: 2 }, states: {}, failures: [] };
const base = bareWhite((await frame('idle', 0)).buf);
report.bare_white_baseline_idle0 = base;
for (const row of ROWS) {
  const src = row.mirrorOf ?? row.state;
  const rows = [];
  for (let i = 0; i < row.frames; i++) {
    const { buf } = await frame(row.state, i);
    const pose = framePose(src, i);
    const bw = bareWhite(buf), edge = edgePixels(buf);
    // 쥔 손(grip-*)은 소품과 함께 켜지므로 소품으로 묶어 숨긴다(숨기면 팔 소켓선이 몸 옆선을 잇는다)
    const props = ['weapon', 'weapon-run', 'grip-l', 'grip-r', 'grip-run-l', 'paw-r', 'book', 'tremble-0', 'tremble-1', 'tremble-2'].filter((id) => (pose.show ?? []).includes(id));
    let h = holes(buf), propGap = 0;
    if (props.length) {
      // 소품을 숨긴 렌더(좌우 반전 행은 반전)에서 몸 자체의 구멍만 판정한다
      const p2 = structuredClone(pose);
      p2.show = p2.show.filter((id) => !props.includes(id));
      let noProp = await raw(frameSvg(p2));
      if (row.mirrorOf) noProp = await sharp(noProp, { raw: { width: W, height: H, channels: 4 } }).flop().raw().toBuffer();
      propGap = Math.max(0, ...h);
      h = holes(noProp);
    }
    const entry = { frame: i, hole_max: Math.max(0, ...h), holes: h.length, bare_white: bw, edge_pixels: edge };
    if (props.length) entry.prop_gap_max = propGap;
    const tearId = (pose.show ?? []).find((id) => id === 'tears' || id === 'tears-cry');
    if (tearId) {
      const tears = await only(pose, [], [tearId]);
      const head = await only(pose, ['body-fill']);
      // 머리 면을 tear_inset만큼 깎은 안쪽에 눈물 픽셀이 모두 있어야 한다
      let outsideInset = 0;
      const inset = 2; // 셀 px
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (tears[(y * W + x) * 4 + 3] < 64) continue;
        let inside = true;
        for (let dy = -inset; dy <= inset && inside; dy++) for (let dx = -inset; dx <= inset; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || head[(yy * W + xx) * 4 + 3] < 128) { inside = false; break; }
        }
        if (!inside) outsideInset++;
      }
      entry.tear_pixels_outside_face = outsideInset;
      if (outsideInset) report.failures.push(`${row.state}#${i}: tears outside face ${outsideInset}px`);
    }
    if (entry.hole_max > 2) report.failures.push(`${row.state}#${i}: hole ${entry.hole_max}px`);
    if (bw - base > 6) report.failures.push(`${row.state}#${i}: bare white edge +${bw - base}px`);
    if (edge) report.failures.push(`${row.state}#${i}: ${edge}px within 3px of cell edge`);
    rows.push(entry);
  }
  report.states[row.state] = rows;
}
report.ok = report.failures.length === 0;
fs.writeFileSync(path.join(root, 'qa/frame-audit.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ok: report.ok, baseline: base, failures: report.failures }, null, 1));
