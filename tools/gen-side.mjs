// 옆모습 몸 생성(running-left/right, 사용자 지정: heelee912/chiikawa-dots-pets처럼 몸통을 옆으로 돌려 다리가 가운데 오게).
//   node tools/gen-side.mjs
// 머리 윤곽은 정면 몸(body-fill)과 같고, 머리 옆선 아래 끝(y 231.4)부터 아랫몸이 둥근 그릇처럼 좁아져
// 몸 아래 가운데의 짧은 발 두 개(foot-f 가까운 발, foot-b 먼 발)로 이어진다. 비교 프로젝트 running-left 실루엣을
// 행별로 재서(.scratch/heelee-rl-spans.json, 머리 폭·키를 우리 idle에 맞춰 옮김) 아랫몸 점을 정했다.
// source/chiikawa.svg의 세 구간을 다시 쓴다(레이어가 달라 나뉨):
//   gen:side-back  다리 뒤 레이어: tail-side(작은 꼬리) + side-hip(발 사이 몸 밑선) + foot-b + foot-f (몸 면 뒤)
//   gen:side-fill  body-fill 바로 뒤: body-side-fill (clip-head에도 쓰여 얼굴이 이 윤곽 밖으로 나가면 가려진다)
//   gen:side-lines 붙은 팔 뒤: body-side-lines + 앞발(paw-f-*)·뒷발(paw-b-*) 붙은 팔
// 발 사이 몸 밑선: 정면 다리의 hip-lines처럼, 발 구간은 몸 선(body-side-lines)을 끊고 발 뒤의 side-hip이 대신 그린다.
// 몸 면은 이 구간만 선 반 두께만큼 안으로 들여 side-hip 윗절반이 보이게 한다 → 발이 없는 곳은 평소 외곽선처럼,
// 발이 있는 곳은 발 면이 덮어 발이 몸에서 그대로 이어진다(발을 돌려도 틈·선이 생기지 않음).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { outline, attachedArm, norm, add, P, f } from './attach.mjs';
import { PAW_DEGS, SIDE } from '../src/poses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = 7.2; // 몸 선 굵기

// 머리(정면 body-fill과 같음): 왼쪽 옆선 아래 끝(75.4,231.4) → 위 → 오른쪽 옆선 아래 끝(324.6,231.4)
const HEAD = [
  [[75.4, 231.4], [63, 207.2], [66.9, 175.1], [79.7, 151.8]],
  [[79.7, 151.8], [88, 136.8], [99.4, 125.2], [113.2, 115.2]],
  [[113.2, 115.2], [117.5, 112.8], [120.5, 111.4], [124, 111]],
  [[124, 111], [129, 110.5], [132, 106.5], [136, 105.2]],
  [[136, 105.2], [141, 103.8], [145, 104], [148.8, 104.4]],
  [[148.8, 104.4], [152.1, 103], [155.6, 103.2], [159, 102.6]],
  [[159, 102.6], [169.5, 100.9], [179.8, 99.6], [190.4, 99.2]],
  [[190.4, 99.2], [205.6, 98.6], [220.7, 99.5], [235.8, 101.7]],
  [[235.8, 101.7], [240.7, 102.4], [246.7, 102.4], [251.2, 104.4]],
  [[251.2, 104.4], [255, 104], [259, 103.8], [264, 105.2]],
  [[264, 105.2], [268, 106.5], [271, 110.5], [276, 111]],
  [[276, 111], [279.5, 111.4], [282.5, 112.8], [286.8, 115.2]],
  [[286.8, 115.2], [300.6, 125.2], [312, 136.8], [320.3, 151.8]],
  [[320.3, 151.8], [333.1, 175.1], [337, 207.2], [324.6, 231.4]],
];
// 아랫몸(선 중심): 뒤(오른쪽) 옆선 → 발 구간 → 앞(왼쪽) 옆선. 비교 프로젝트처럼 뒤쪽이 조금 더 불룩하고(엉덩이),
// 앞쪽은 앞발 아래에서 안으로 들어가 몸 아래 가운데(발)로 모인다. 내려갈수록 기울기가 고르게 줄어드는 U자로
// 점 간격을 고르게 두었다(곡률 반지름 ≥ 50). 예전 점은 "사선 + 평평한 바닥"이라 다리 양옆이 각져 보인다는 지적을 받았다(반지름 18~23).
const LOWER = [
  [324.6, 231.4], [312, 258], [302, 281], [295, 299], [286, 314], [272, 327.5],
  SIDE.gapB, [233, 344], [208, 346.5], [185, 344.5], SIDE.gapF,
  [140, 324], [125, 306], [113, 287], [95, 261], [75.4, 231.4],
];
const T0 = norm([-12.4, 24.2]), T1 = norm([-12.4, -24.2]); // 머리 옆선 아래 끝의 접선(이어지게)

// 점 목록 → 부드러운 3차 곡선(Catmull-Rom 접선, 양 끝 접선 지정)
function smooth(pts, t0, t1) {
  const tan = pts.map((p, i) => (i === 0 ? t0 : i === pts.length - 1 ? t1 : norm([pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]])));
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) / 3;
    segs.push([a, add(a, tan[i], l), add(b, tan[i + 1], -l), b]);
  }
  return segs;
}
const low = smooth(LOWER, T0, T1);
const iB = LOWER.indexOf(SIDE.gapB), iF = LOWER.indexOf(SIDE.gapF);
const rear = low.slice(0, iB), gap = low.slice(iB, iF), front = low.slice(iF);
const C = (s) => `C${P(s[1])} ${P(s[2])} ${P(s[3])}`;
const path_ = (segs) => `M${P(segs[0][0])}${segs.map(C).join('')}`;
const rev = (s) => [s[3], s[2], s[1], s[0]];
const mirror = (s) => s.map(([x, y]) => [400 - x, y]);
const bez = ([p0, p1, p2, p3], t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
};

// 몸 면: 발 구간만 선 반 두께만큼 안쪽(위)으로 들인 꺾은선
const inset = [];
for (const s of gap) for (let i = 0; i <= 12; i++) {
  if (inset.length && i === 0) continue;
  const t = i / 12, p = bez(s, t), q = bez(s, Math.min(1, t + 0.01)), o = bez(s, Math.max(0, t - 0.01));
  const tg = norm([q[0] - o[0], q[1] - o[1]]); // 진행 방향(뒤 → 앞 = 왼쪽)
  inset.push(add(p, [-tg[1], tg[0]], SW / 2)); // 왼쪽으로 가는 접선을 시계 방향으로 돌리면 위(몸 안)
}
const fillD = `M${P(HEAD[0][0])}${HEAD.map(C).join('')}${rear.map(C).join('')}`
  + `L${inset.map(P).join(' ')}L${P(SIDE.gapF)}${front.map(C).join('')}Z`;

// 몸 선: 귀 밑동은 정면처럼 열어 두고, 발 구간도 끊는다
const linesD = [
  `M${P(HEAD[4][3])}${HEAD.slice(5, 9).map(C).join('')}`, // 머리 윗선 148.8 → 251.2
  `M${P(HEAD[11][3])}${HEAD.slice(12).map(C).join('')}${rear.map(C).join('')}`,               // 뒤: 귀 밑동 → 엉덩이 → 발 구간 앞
  `M${P(HEAD[1][3])}${[rev(HEAD[1]), rev(HEAD[0])].map(C).join('')}${[...front].reverse().map(rev).map(C).join('')}`, // 앞
];
const hipD = path_(gap);

// 발: 기준점(엉덩이, 몸 안) 아래로 늘어진 짧고 둥근 발. 위쪽은 몸 면 뒤로 숨는다
function foot([cx, cy]) {
  const r = SIDE.footW / 2, b = SIDE.footY, k = 0.552 * r, top = cy - 6;
  const d = `M${f(cx - r)} ${top}V${f(b - r)}C${f(cx - r)} ${f(b - r + k)} ${f(cx - k)} ${f(b)} ${f(cx)} ${f(b)}`
    + `C${f(cx + k)} ${f(b)} ${f(cx + r)} ${f(b - r + k)} ${f(cx + r)} ${f(b - r)}V${top}`;
  return { line: d, fill: `${d}Z` };
}

// 앞발·뒷발: 앞(왼쪽) 옆선을 아래 → 위로 잇고, 뒷발은 뒤 옆선을 x=200 대칭으로 뒤집어(왼쪽 옆선이 됨) 같은 계산을 쓴다
const frontUp = [...front, HEAD[0]];
const rearUp = [...rear].map(mirror).reverse().map(rev).concat([HEAD[0]]);
function sAtY(at, y) { // 호 길이 중 점 y가 목표에 가장 가까운 곳
  let best = 0, bd = 1e9;
  for (let s = 0; s <= at.length_; s += 0.5) { const d = Math.abs(at(s).p[1] - y); if (d < bd) { bd = d; best = s; } }
  return best;
}
const atF = outline(frontUp), atB = outline(rearUp);
const paw = (at, rootY, deg) => attachedArm(at, deg, { sc: sAtY(at, rootY), hw: SIDE.pawHW, L: SIDE.pawL, W: SIDE.pawW });
const id = (deg) => (deg < 0 ? `m${-deg}` : `${deg}`);

// 꼬리: 뒤 옆선(rear) 위에서 SIDE.tailAt에 가장 가까운 점을 찾아, 바깥 법선 쪽으로 tailOut 나온 원을 몸 면 뒤에 둔다
function tailSide() {
  let best = null;
  for (const sg of rear) for (let i = 0; i <= 40; i++) {
    const q = bez(sg, i / 40), d = Math.hypot(q[0] - SIDE.tailAt[0], q[1] - SIDE.tailAt[1]);
    if (!best || d < best.d) best = { d, q, a: bez(sg, Math.max(0, i / 40 - 0.02)), b: bez(sg, Math.min(1, i / 40 + 0.02)) };
  }
  const tg = norm([best.b[0] - best.a[0], best.b[1] - best.a[1]]); // 뒤 옆선을 따라 내려가는 방향
  const c = add(best.q, [tg[1], -tg[0]], SIDE.tailOut), r = SIDE.tailR;          // 내려가는 접선을 반시계로 돌리면 몸 밖(오른쪽)
  return `M${f(c[0] - r)} ${f(c[1])}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}
const footB = foot(SIDE.footB), footF = foot(SIDE.footF);
const back = `<!-- gen:side-back (tools/gen-side.mjs가 생성. 직접 고치지 말 것) -->
  <!-- 옆모습 꼬리·발(running-left/right): 몸 면 뒤. 꼬리는 뒤 옆선 밖으로 작은 반달만 보이고, side-hip은 발 사이에 드러나는 몸 밑선(발이 덮는 곳은 가려짐) -->
  <path id="tail-side" display="none" fill="#fff" stroke-width="${SIDE.tailW}" d="${tailSide()}"/>
  <path id="side-hip" display="none" stroke-linecap="butt" d="${hipD}"/>
  <path id="foot-b" display="none" fill="#fff" d="${footB.fill}"/>
  <path id="foot-f" display="none" fill="#fff" d="${footF.fill}"/>
  <!-- /gen:side-back -->`;
const fill = `<!-- gen:side-fill (tools/gen-side.mjs가 생성. 직접 고치지 말 것) -->
  <path id="body-side-fill" display="none" fill="#fff" stroke="none" d="${fillD}"/>
  <!-- /gen:side-fill -->`;
const pawDefs = PAW_DEGS.flatMap((deg) => [['f', atF], ['b', atB]].map(([k, at]) => {
  const { line, fill: pf } = paw(at, k === 'f' ? SIDE.pawYF : SIDE.pawYB, deg);
  return `    <g id="paw-${k}-${id(deg)}-art">\n      <path fill="#fff" stroke="none" d="${pf}"/>\n      <path d="${line}"/>\n    </g>`;
})).join('\n');
const pawUses = PAW_DEGS.flatMap((deg) => [
  `  <use id="paw-f-${id(deg)}" href="#paw-f-${id(deg)}-art" display="none"/>`,
  `  <use id="paw-b-${id(deg)}" href="#paw-b-${id(deg)}-art" display="none" transform="translate(400 0) scale(-1 1)"/>`,
]).join('\n');
const lines = `<!-- gen:side-lines (tools/gen-side.mjs가 생성. 직접 고치지 말 것) -->
  <!-- 옆모습 몸 외곽선(귀 밑동·발 구간은 열림) + 붙은 앞발(paw-f-φ)·뒷발(paw-b-φ, 뒤 옆선 대칭 사본). φ는 내린 방향 0°, 몸 밖 + -->
  <g id="body-side-lines" display="none">
${linesD.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
  <defs>
${pawDefs}
  </defs>
${pawUses}
  <!-- /gen:side-lines -->`;

const file = path.join(root, 'source/chiikawa.svg');
let src = fs.readFileSync(file, 'utf8');
function put(name, block, anchorRe) {
  const re = new RegExp(`<!-- gen:${name} [\\s\\S]*?<!-- /gen:${name} -->`);
  if (re.test(src)) { src = src.replace(re, block); return; }
  const m = src.match(anchorRe);
  if (!m) throw new Error(`anchor not found for ${name}`);
  const at = m.index + m[0].length;
  src = `${src.slice(0, at)}\n\n  ${block}${src.slice(at)}`;
}
put('side-back', back, /<path id="leg-r"[^>]*\/>/);
put('side-fill', fill, /<path id="body-fill"[^>]*\/>/);
put('side-lines', lines, /<!-- \/gen:arms -->/);
fs.writeFileSync(file, src);
console.log(`wrote side blocks: back ${back.length} B, fill ${fill.length} B, lines ${lines.length} B; paws ${PAW_DEGS.join(', ')}`);
