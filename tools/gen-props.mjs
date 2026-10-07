// 토벌창(무기) 작도: reference/waiting.png·running_frame*.png에서 잰 비율로 포크와 자루를 계산해
// source/chiikawa.svg의 <!-- gen:weapon --> … <!-- /gen:weapon --> 구간을 다시 쓴다.
//   node tools/gen-props.mjs
//
// 무기 자체 좌표: 손잡이 끝이 원점, 자루 방향이 +x. 포크는 레퍼런스 크기의 0.92배(셀 폭 안에 넣기 위해).
// 굵기는 waiting.png 측정값(몸 폭 268 기준): 분홍 폭은 자루 약 7.6, 날 약 10~11. 짙은 테두리는 몸 외곽선(7.2)과 어울리게 B=4.4
// (레퍼런스는 몸 외곽선의 약 0.73배인 4.9, 사용자 요청 "지금보다 약간만 굵게"에 맞춰 조금 낮춤). 가시·포크 끝 윤곽도 B에 맞춘다.
// - 자루: 흰 캡슐 손잡이(0~94, 왼손이 57을 쥔다) | 짙은 띠 | 분홍 자루. 짙은 선 위에 분홍 선을 겹쳐 그린다(waiting.png 비율).
// - 포크 "C": 폭이 일정한 두 날이 등에서 위·아래로 갈라져 오른쪽으로 뻗고, 끝은 바깥으로 말려 뾰족해진다.
//   날마다 바깥·안쪽 가장자리에 이빨 모양 가시가 3개씩 있다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fitCurve from 'fit-curve';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 0.92;
const J = 272; // 자루 끝(포크 등). poses.mjs WEAPON_J와 같게
const r1 = (v) => Math.round(v * 10) / 10;
// 테두리(짙은 선) 두께 B: waiting.png에서 자루·날 테두리는 몸 외곽선의 약 0.73배(16px : 22px)다. 분홍 폭은 그대로 두고 테두리만 정한다.
const B = +(process.env.WEAPON_B ?? 4.4);
const SHAFT_PINK = 7.8, TINE_PINK = 11, SHAFT_W = SHAFT_PINK + 2 * B, TINE_W = TINE_PINK + 2 * B;
const TOOTH_STROKE = r1(B * 0.85), TIP_STROKE = B;
const PINK = '#fb9cb9';

const TOOTH = [7, 2.2, 12.4]; // 밑변 반폭, 밑변 안쪽 깊이, 높이(굵은 테두리에서도 흰 속이 보이게)
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

// 위 날 중심선(포크 등 원점, 레퍼런스 측정 후 위아래 평균)과 날 끝. 아래 날은 y 반전.
const C_UPPER = [[-12, 0], [0, -1], [5, -18], [16, -30], [35, -34.5], [58, -37.5], [75, -44]];
const C_TIP = [89, -59];

function tine(upper, tipAt) {
  const pts = upper.map(([x, y]) => [x * S, y * S]);
  const tip = [tipAt[0] * S, tipAt[1] * S];
  // 중심선을 촘촘히 보간(Catmull-Rom)해 곡선 맞춤
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 8; k++) {
    const t = k / 8, a = pts[i], b = pts[i + 1];
    const p0 = pts[i - 1] ?? a, p3 = pts[i + 2] ?? b;
    const c = (q0, q1, q2, q3) => 0.5 * ((2 * q1) + (-q0 + q2) * t + (2 * q0 - 5 * q1 + 4 * q2 - q3) * t * t + (-q0 + 3 * q1 - 3 * q2 + q3) * t * t * t);
    dense.push([c(p0[0], a[0], b[0], p3[0]), c(p0[1], a[1], b[1], p3[1])]);
  }
  dense.push(pts.at(-1));
  const curves = fitCurve(dense, 0.25);
  const d = `M${pt(curves[0][0])}` + curves.map(([, a, b, c]) => `C${pt(a)} ${pt(b)} ${pt(c)}`).join('');
  // 끝: 중심선 끝에서 날 폭 그대로 시작해 뾰족하게 말린다
  const end = pts.at(-1), prev = dense.at(-3);
  const tan = [end[0] - prev[0], end[1] - prev[1]], tl = Math.hypot(...tan);
  const n = [tan[1] / tl, -tan[0] / tl]; // 왼쪽 법선(위 날에서는 위쪽)
  const w = TINE_W / 2 - TIP_STROKE / 2; // 끝 윤곽 바깥이 날 바깥선과 맞도록
  const L = [end[0] + n[0] * w, end[1] + n[1] * w], R = [end[0] - n[0] * w, end[1] - n[1] * w];
  const mid = [(end[0] + tip[0]) / 2, (end[1] + tip[1]) / 2];
  const back = [-tan[0] / tl * 3, -tan[1] / tl * 3];
  const tipD = `M${pt([L[0] + back[0], L[1] + back[1]])}L${pt(L)}Q${pt([mid[0] + n[0] * 3, mid[1] + n[1] * 3])} ${pt(tip)}`
    + `Q${pt([mid[0] + 1.5 * tan[0] / tl, mid[1] + 1.5 * tan[1] / tl])} ${pt(R)}L${pt([R[0] + back[0], R[1] + back[1]])}Z`;
  // 가시: 중심선 호 길이 비율 위치에서 날 가장자리 바깥으로
  const arc = [0];
  for (let i = 1; i < dense.length; i++) arc.push(arc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const at = (f) => {
    const s = f * arc.at(-1), i = Math.max(1, arc.findIndex((v) => v >= s));
    const a = dense[i - 1], b = dense[i], t = (s - arc[i - 1]) / (arc[i] - arc[i - 1] || 1);
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], tg = [b[0] - a[0], b[1] - a[1]], len = Math.hypot(...tg);
    return { p, n: [tg[1] / len, -tg[0] / len] };
  };
  const teeth = [];
  // 레퍼런스처럼 C의 등(휘어 오르는 부분)에는 가시가 없고 가로로 뻗은 부분에만 위·아래 3개씩
  for (const [f, side] of [[0.46, 1], [0.66, 1], [0.86, 1], [0.52, -1], [0.71, -1], [0.9, -1]]) {
    const { p, n: nn } = at(f), off = TINE_W / 2 - 2;
    const q = [p[0] + nn[0] * side * off, p[1] + nn[1] * side * off];
    // 이빨 삼각형: 밑변은 날 가장자리를 따라, 꼭짓점은 바깥 법선 방향(TOOTH 크기)
    const o = [nn[0] * side, nn[1] * side], tg = [-o[1], o[0]];
    const [hw, hb, ht] = TOOTH; // 밑변 반폭, 밑변 안쪽 깊이, 높이
    const v = (u, w) => [q[0] + tg[0] * u + o[0] * w, q[1] + tg[1] * u + o[1] * w];
    teeth.push(`M${pt(v(-hw, -hb))}L${pt(v(0, ht))} ${pt(v(hw, -hb))}Z`);
  }
  return { d, tipD, teeth };
}

function forkDefs(name, upper, tipAt) {
  const t = tine(upper, tipAt);
  const flip = 'transform="scale(1 -1)"';
  // 위 날의 가시·끝을 한 번만 정의하고 아래 날은 y 반전으로 재사용한다
  return [
    `<path id="${name}-line" d="${t.d}"/>`,
    `<path id="${name}-teeth" fill="#fff" stroke-width="${TOOTH_STROKE}" d="${t.teeth.join('')}"/>`,
    `<path id="${name}-tip" fill="${PINK}" stroke-width="${TIP_STROKE}" d="${t.tipD}"/>`,
    `<g id="${name}">`,
    `  <use href="#${name}-teeth"/><use href="#${name}-teeth" ${flip}/>`,
    `  <use href="#${name}-line" stroke-width="${TINE_W}"/><use href="#${name}-line" stroke-width="${TINE_W}" ${flip}/>`,
    `  <use href="#${name}-tip"/><use href="#${name}-tip" ${flip}/>`,
    `  <use href="#${name}-line" stroke="${PINK}" stroke-width="${TINE_PINK}"/><use href="#${name}-line" stroke="${PINK}" stroke-width="${TINE_PINK}" ${flip}/>`,
    `</g>`,
  ].join('\n    ');
}

// running(찌르기)용 창: 포크·굵기는 같고 막대만 짧다(JR). 셀 폭 192px 안에 창 전체와 앞뒤로 흔들며 찌르는 동작이 들어가게 한다.
const JR = 252;
const shaft = (to) => `<path stroke-width="${SHAFT_W}" d="M0 0H${to}"/>`;
const block = `<!-- gen:weapon (tools/gen-props.mjs가 생성. 직접 고치지 말 것) -->
  <!-- 몸 앞 토벌창(waiting): 흰 캡슐 손잡이, 짙은 띠, 분홍 자루, 가시 달린 C 포크. 무기 자체 좌표는
       손잡이 끝 원점·자루 방향 +x(자루 끝 ${J}). 기본 배치는 poses.mjs WEAPON_BASE와 같게 둔다.
       자루는 몸 옆선에서 이어진 쥔 손(source의 grip-l·grip-r)이 감싸 쥔다 -->
  <use id="weapon" href="#weapon-art" display="none" transform="translate(52 300) rotate(-3)"/>
  <!-- running 찌르기용 짧은 창(막대 ${JR}) -->
  <use id="weapon-run" href="#weapon-run-art" display="none" transform="translate(52 300) rotate(-3)"/>
  <!-- /gen:weapon -->`;
const backBlock = `<!-- gen:weapon-defs (tools/gen-props.mjs가 생성. 직접 고치지 말 것. 토벌창 그림 정의) -->
  <defs>
    ${forkDefs('fork-c', C_UPPER, C_TIP)}
    <g id="weapon-art">
      ${shaft(J)}
      <path stroke="#fff" stroke-width="${SHAFT_PINK}" d="M0 0H91"/>
      <path stroke="${PINK}" stroke-width="${SHAFT_PINK}" stroke-linecap="butt" d="M100 0H${J}"/>
      <use href="#fork-c" x="${J}"/>
    </g>
    <g id="weapon-run-art">
      ${shaft(JR)}
      <path stroke="#fff" stroke-width="${SHAFT_PINK}" d="M0 0H67"/>
      <path stroke="${PINK}" stroke-width="${SHAFT_PINK}" stroke-linecap="butt" d="M76 0H${JR}"/>
      <use href="#fork-c" x="${JR}"/>
    </g>
  </defs>
  <!-- /gen:weapon-defs -->`;

const file = path.join(root, 'source/chiikawa.svg');
const src = fs.readFileSync(file, 'utf8');
// 앞 창 표식만 잡는다(gen:weapon-defs와 구별: 'gen:weapon' 뒤에 공백 또는 바로 '-->')
const re = /<!-- gen:weapon(?: [^>]*)?-->[\s\S]*?<!-- \/gen:weapon -->/;
if (!re.test(src)) throw new Error('gen:weapon markers not found in source/chiikawa.svg');
const reBack = /<!-- gen:weapon-defs[\s\S]*?<!-- \/gen:weapon-defs -->/;
if (!reBack.test(src)) throw new Error('gen:weapon-defs markers not found in source/chiikawa.svg');
fs.writeFileSync(file, src.replace(re, block).replace(reBack, backBlock));
console.log(`wrote weapon blocks (${Buffer.byteLength(block) + Buffer.byteLength(backBlock)} B): J=${J}`);
