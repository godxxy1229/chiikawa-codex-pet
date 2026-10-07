// 리그 기본 자세를 reference/idle.png와 겹쳐 비교한다.
//   node tools/compare-ref.mjs [svg=src/chiikawa-rig.svg]
// 출력: qa/ref-compare/idle.png (레퍼런스 | 리그 | 겹침 / 셀 배율 밝은·어두운 배경), qa/ref-compare/idle.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = path.resolve(root, process.argv[2] ?? 'src/chiikawa-rig.svg');
const svg = fs.readFileSync(svgPath, 'utf8');
const L = JSON.parse(fs.readFileSync(path.join(root, 'qa/ref-landmarks.json'), 'utf8'));
const { k: K, ref_center_x: rcx, ref_feet_y: rfy, grid_center_x: gcx, grid_feet_y: gfy } = L.transform;
const ref = sharp(path.join(root, L.source));
const { width: RW, height: RH } = await ref.metadata();

// 격자 → 레퍼런스 픽셀 공간으로 렌더
function placed(svgText, w, h, scale, tx, ty) {
  const inner = svgText.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g transform="translate(${tx} ${ty}) scale(${scale})">${inner}</g></svg>`);
}
const s = 1 / K;
const rigBuf = placed(svg, RW, RH, s, rcx - gcx * s, rfy - gfy * s);
const rigRaw = await sharp(rigBuf).ensureAlpha().raw().toBuffer();
const refRaw = await ref.clone().ensureAlpha().raw().toBuffer();

// 지표: 실루엣 IoU, 선(짙은 픽셀) IoU
let silI = 0, silU = 0, inkI = 0, inkU = 0;
const ink = (b, i) => b[i + 3] > 128 && (0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2]) < 120;
for (let i = 0; i < refRaw.length; i += 4) {
  const a = refRaw[i + 3] > 128, b = rigRaw[i + 3] > 128;
  if (a && b) silI++; if (a || b) silU++;
  const c = ink(refRaw, i), d = ink(rigRaw, i);
  if (c && d) inkI++; if (c || d) inkU++;
}
// 랜드마크 오차: 리그 렌더를 같은 방법으로 측정해 눈·홍조 중심 비교 (셀 배율 0.5 px)
import { execFileSync } from 'node:child_process';
const rigPng = path.join(root, 'qa/ref-compare/rig-at-ref-scale.png');
fs.mkdirSync(path.dirname(rigPng), { recursive: true });
await sharp(rigRaw, { raw: { width: RW, height: RH, channels: 4 } }).png().toFile(rigPng);
const rigLmPath = path.join(root, 'qa/ref-compare/rig-landmarks.json');
execFileSync('python', [path.join(root, 'tools/measure-ref.py'), '--image', rigPng, '--out', rigLmPath]);
const R = JSON.parse(fs.readFileSync(rigLmPath, 'utf8'));
const errPx = (a, b) => +(Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.5).toFixed(2);
const landmarks = {
  eye_l: errPx(L.eyes[0].c, R.eyes[0].c), eye_r: errPx(L.eyes[1].c, R.eyes[1].c),
  blush_l: errPx(L.blush[0].c, R.blush[0].c), blush_r: errPx(L.blush[1].c, R.blush[1].c),
  ear_l_top: errPx(L.traces['ear-l'].points.reduce((m, p) => (p[1] < m[1] ? p : m)), [133.2, 79.7]),
  ear_r_top: errPx(L.traces['ear-r'].points.reduce((m, p) => (p[1] < m[1] ? p : m)), [266.8, 79.7]),
};
const report = {
  landmark_error_cell_px: landmarks,
  svg: path.relative(root, svgPath), svg_bytes: Buffer.byteLength(svg),
  silhouette_iou: +(silI / silU).toFixed(4), ink_iou: +(inkI / inkU).toFixed(4),
};

// 패널 구성
const W = 520, H = Math.round(RH * W / RW);
const onWhite = async (buf) => sharp(await sharp({ create: { width: RW, height: RH, channels: 4, background: '#ffffff' } })
  .composite([{ input: await sharp(buf, { raw: { width: RW, height: RH, channels: 4 } }).png().toBuffer() }])
  .png().toBuffer()).resize(W, H).png().toBuffer();
// 겹침: 레퍼런스 선은 빨강, 리그 선은 파랑, 겹치면 검정
const ov = Buffer.alloc(RW * RH * 4);
for (let i = 0; i < ov.length; i += 4) {
  const c = ink(refRaw, i), d = ink(rigRaw, i);
  const silA = refRaw[i + 3] > 128, silB = rigRaw[i + 3] > 128;
  let col = [255, 255, 255];
  if (silA !== silB) col = silA ? [255, 225, 225] : [220, 230, 255];
  if (c && d) col = [20, 20, 20]; else if (c) col = [230, 40, 40]; else if (d) col = [40, 80, 230];
  ov.set([...col, 255], i);
}
const panels = [
  await onWhite(refRaw), await onWhite(rigRaw),
  await sharp(ov, { raw: { width: RW, height: RH, channels: 4 } }).resize(W, H).png().toBuffer(),
];
// 셀 배율(0.5) 1배·3배, 밝은·어두운 배경
const cellScale = 0.5;
const cw = 192, ch = 208, ox = 96 - gcx * cellScale, oy = 197 - gfy * cellScale;
const cell = await sharp(placed(svg, cw, ch, cellScale, ox, oy)).png().toBuffer();
const refData = fs.readFileSync(path.join(root, L.source)).toString('base64');
const refCell = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${cw}" height="${ch}"><image transform="translate(${(gcx - rcx * K) * cellScale + ox} ${(gfy - rfy * K) * cellScale + oy}) scale(${K * cellScale})" width="${RW}" height="${RH}" xlink:href="data:image/png;base64,${refData}"/></svg>`)).png().toBuffer();
const cellPanel = async (bg, input) => sharp({ create: { width: cw, height: ch, channels: 4, background: bg } })
  .composite([{ input }]).png().toBuffer();
const small = [];
for (const bg of ['#f2f2f2', '#1d2129']) {
  small.push(await sharp(await cellPanel(bg, refCell)).resize(cw * 2, ch * 2, { kernel: 'nearest' }).png().toBuffer());
  small.push(await sharp(await cellPanel(bg, cell)).resize(cw * 2, ch * 2, { kernel: 'nearest' }).png().toBuffer());
}
const gap = 8, topH = H, total = { w: gap + 3 * (W + gap), h: gap + topH + gap + ch * 2 + gap };
total.w = Math.max(total.w, gap + 4 * (cw * 2 + gap));
const comps = panels.map((input, i) => ({ input, left: gap + i * (W + gap), top: gap }))
  .concat(small.map((input, i) => ({ input, left: gap + i * (cw * 2 + gap), top: gap + topH + gap })));
fs.mkdirSync(path.join(root, 'qa/ref-compare'), { recursive: true });
await sharp({ create: { width: total.w, height: total.h, channels: 3, background: '#9aa0a8' } })
  .composite(comps).png().toFile(path.join(root, 'qa/ref-compare/idle.png'));
fs.writeFileSync(path.join(root, 'qa/ref-compare/idle.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
