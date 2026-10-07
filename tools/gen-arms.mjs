// 붙은 팔 생성: 몸 외곽선이 그대로 바깥으로 불룩하게 나와 팔이 되는 모양(레퍼런스 waving·jumping처럼)을
// poses.mjs ARM_DEGS의 각도마다 미리 계산해 source/chiikawa.svg의 gen:arms 구간을 다시 쓴다.
//   node tools/gen-arms.mjs
//
// - φ: 곧게 내린 방향 0°, 바깥(몸 밖) 쪽 +. 왼팔 기준으로 그리고 오른팔은 x=200 대칭으로 재사용한다.
// - 뿌리: 몸 왼쪽 외곽선(소켓 아래 → 소켓 위 → 머리 아래 곡선) 위에서 φ에 따라 위로 미끄러진다.
//   뿌리 중심에서 외곽선을 따라 ±hw 떨어진 A(위)·B(아래)에서 팔 윤곽선이 시작·끝나고, 뿌리를 닫는 선은 없다.
// - 흰 면은 A–B 사이 몸 외곽선(머리선·소켓선)을 덮는다(몸선 위 레이어). 선 끝 둥근 캡이 몸선과 맞물린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARM_DEGS, WAVE_DEGS } from '../src/poses.mjs';
import { outline, attachedArm, raisedArm, lerp } from './attach.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 팔 폭: reference/waving.png의 뭉툭한 "⊂"자 팔(선 중심 두께 19.6, 선 굵기 8.3)에 맞춰, 우리 선(7.2)에서 안쪽 흰 면이 같게 보이도록 22
const W = 22;

// 몸 왼쪽 외곽선(아래 → 위): socket-l, socket-l-top, body-lines 왼쪽 아래 곡선을 거꾸로 이은 3차 곡선들
const SEGS = [
  [[114.9, 295.9], [114.8, 291], [114.5, 284], [114.2, 277.5]],
  [[114.2, 277.5], [114, 271], [110, 266], [103.8, 260.5]],
  [[103.8, 260.5], [91.9, 253.4], [81.7, 243.9], [75.4, 231.4]],
  [[75.4, 231.4], [63, 207.2], [66.9, 175.1], [79.7, 151.8]],
];
const at = outline(SEGS);
function arm(phi) {
  return attachedArm(at, phi, {
    sc: lerp([[0, 24], [30, 30], [60, 37], [90, 45], [122, 52]], phi), // 뿌리 중심 호 길이
    hw: lerp([[0, 15], [45, 13]], phi),                              // 외곽선을 따른 뿌리 반폭(팔 폭보다 넓게)
    L: lerp([[-12, 12], [10, 13], [30, 15], [80, 20]], phi),           // 뿌리 → 끝 중심 거리(레퍼런스처럼 몸 밖 길이 ≈ 두께의 1.5배)
    W,
  });
}

// 흔드는 손(waving 오른팔, 사용자 지정: 비교 프로젝트처럼 관절이 덜 느껴지게): 몸 앞에 겹쳐 든 손. 위(안쪽) 윤곽선은 몸 안에서
// 열린 끝으로 시작하고 아래(바깥) 윤곽선은 몸 옆선으로 같은 기울기로 이어져, 뿌리에 꺾임이 없다(attach.mjs raisedArm).
// 85° 옆 → 155° 뺨 옆까지 들어 올림. 들수록 어깨를 조금 올리고 끝을 더 안쪽으로 말아 비교 프로젝트처럼 뺨 옆의 둥근 손이 된다.
function wave(phi) {
  const L2 = (pts) => lerp(pts, phi);
  return raisedArm(at, phi, {
    S: [L2([[90, 98], [160, 100]]), L2([[90, 258], [160, 252]])], // 어깨 중심
    L: L2([[90, 24], [160, 22]]),      // 어깨 → 끝 중심
    w0: 14, w1: 12.5,                  // 어깨·끝 반폭(뭉툭한 손)
    curl: L2([[90, 16], [160, 26]]),   // 끝이 안쪽으로 휘는 각
    sB: L2([[90, 22], [160, 30]]),     // 아래 윤곽선이 몸 옆선에 이어지는 점(소켓 윗선 위)
    inF: L2([[90, 8], [160, 4]]),      // 위 윤곽선 열린 끝을 몸 안으로 넣는 길이
  });
}

const id = (deg) => (deg < 0 ? `m${-deg}` : `${deg}`);
const art = (name, { line, fill }) => `    <g id="${name}">\n      <path fill="#fff" stroke="none" d="${fill}"/>\n      <path d="${line}"/>\n    </g>`;
const defs = [
  ...ARM_DEGS.map((deg) => art(`arm-att-${id(deg)}-art`, arm(deg))),
  ...WAVE_DEGS.map((deg) => art(`arm-wave-${deg}-art`, wave(deg))),
].join('\n');
const MIRROR = 'transform="translate(400 0) scale(-1 1)"';
const uses = [
  ...ARM_DEGS.map((deg) => `  <use id="arm-att-l-${id(deg)}" href="#arm-att-${id(deg)}-art" display="none"/>\n`
    + `  <use id="arm-att-r-${id(deg)}" href="#arm-att-${id(deg)}-art" display="none" ${MIRROR}/>`),
  ...WAVE_DEGS.map((deg) => `  <use id="arm-wave-r-${deg}" href="#arm-wave-${deg}-art" display="none" ${MIRROR}/>`),
].join('\n');
const block = `<!-- gen:arms (tools/gen-arms.mjs가 생성. 직접 고치지 말 것) -->
  <!-- 붙은 팔(jumping, waving 왼팔): 몸 외곽선이 그대로 불룩하게 나와 팔이 된다. φ(내린 방향 0°, 바깥 +)마다
       미리 계산한 모양을 프레임마다 하나씩 켠다(poses.mjs armAt). 몸선 위 레이어라 흰 면이 뿌리의 몸선을 덮는다.
       흔드는 손(waving 오른팔, arm-wave-r-φ, poses.mjs waveAt): 몸 앞에 겹쳐 든 손. 위 윤곽선은 몸 안에서 열린 끝,
       아래 윤곽선은 몸 옆선으로 같은 기울기로 이어진다(뿌리 꺾임 없음) -->
  <defs>
${defs}
  </defs>
${uses}
  <!-- /gen:arms -->`;

const file = path.join(root, 'source/chiikawa.svg');
let src = fs.readFileSync(file, 'utf8');
const re = /<!-- gen:arms[\s\S]*?<!-- \/gen:arms -->/;
if (re.test(src)) src = src.replace(re, block);
else {
  const anchor = '  <g id="face"';
  if (!src.includes(anchor)) throw new Error('face anchor not found');
  src = src.replace(anchor, `  ${block}\n\n${anchor}`);
}
fs.writeFileSync(file, src);
console.log(`wrote arms block (${Buffer.byteLength(block)} B): ${ARM_DEGS.join(', ')} / wave ${WAVE_DEGS.join(', ')}`);
