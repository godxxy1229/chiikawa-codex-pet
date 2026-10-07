// qa/ref-landmarks.json의 선 추적 점열 → 좌우 대칭화 → 3차 베지어 맞춤 → qa/fitted-paths.json
// 작도(source/chiikawa.svg)에 옮겨 쓸 기준 경로를 만든다. 오른쪽은 왼쪽(평균)의 거울상이다.
//   node tools/fit-traces.mjs [maxError=0.8]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fitCurve from 'fit-curve';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = JSON.parse(fs.readFileSync(path.join(root, 'qa/ref-landmarks.json'), 'utf8'));
const maxError = +(process.argv[2] ?? 0.8);
const CX = 200;
const r1 = (v) => Math.round(v * 10) / 10;

// 호 길이 기준 n점 재표본
function resample(pts, n) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = (d.at(-1) * k) / (n - 1);
    const i = d.findIndex((v) => v >= t - 1e-9);
    if (i === 0) { out.push([...pts[0]]); continue; }
    if (i < 0) { out.push([...pts.at(-1)]); continue; }
    const f = (t - d[i - 1]) / (d[i] - d[i - 1] || 1);
    out.push([pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])]);
  }
  return out;
}
const mirror = (pts) => pts.map(([x, y]) => [2 * CX - x, y]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// 왼쪽 점열과 오른쪽 거울상을 같은 방향으로 맞춰 평균
function symmetrize(left, right) {
  const n = 120;
  let m = mirror(right);
  if (dist(m[0], left[0]) > dist(m.at(-1), left[0])) m = m.reverse();
  const a = resample(left, n), b = resample(m, n);
  return a.map((p, i) => [(p[0] + b[i][0]) / 2, (p[1] + b[i][1]) / 2]);
}

const toD = (curves) => {
  let s = `M${r1(curves[0][0][0])} ${r1(curves[0][0][1])}`;
  for (const [, c1, c2, p] of curves) s += `C${[c1, c2, p].map((q) => `${r1(q[0])} ${r1(q[1])}`).join(' ')}`;
  return s;
};

const T = Object.fromEntries(Object.entries(L.traces).map(([k, v]) => [k, v.points]));
const sym = {};
for (const base of ['ear', 'side', 'arm', 'body', 'leg', 'mouth']) {
  sym[`${base}-l`] = symmetrize(T[`${base}-l`], T[`${base}-r`]);
  sym[`${base}-r`] = mirror(sym[`${base}-l`]);
}
// 가운데 선은 자기 거울상과 평균해 좌우 대칭으로
for (const k of ['head-top', 'bottom']) {
  const s = symmetrize(T[k], T[k]);
  sym[k] = s;
}
sym['mouth-stem'] = T['mouth-stem'].map(([x, y]) => [CX, y]);

const out = { maxError, paths: {}, nodes: {} };
for (const [k, pts] of Object.entries(sym)) {
  const curves = fitCurve(resample(pts, 60), maxError);
  out.paths[k] = toD(curves);
  out.nodes[k] = curves.length;
}
// 얼굴 요소 대칭화
const eyeL = L.eyes[0], eyeR = L.eyes[1];
const avg = (a, b) => (a + b) / 2;
out.eye = {
  c: [r1(avg(eyeL.c[0], 2 * CX - eyeR.c[0])), r1(avg(eyeL.c[1], eyeR.c[1]))],
  rx: r1(avg(eyeL.rx, eyeR.rx)), ry: r1(avg(eyeL.ry, eyeR.ry)),
  holes: eyeL.holes.map((h, i) => ({
    dc: [r1(avg(h.c[0] - eyeL.c[0], eyeR.holes[i].c[0] - eyeR.c[0])), r1(avg(h.c[1] - eyeL.c[1], eyeR.holes[i].c[1] - eyeR.c[1]))],
    rx: r1(avg(Math.max(h.rx, h.ry), Math.max(eyeR.holes[i].rx, eyeR.holes[i].ry))),
    ry: r1(avg(Math.min(h.rx, h.ry), Math.min(eyeR.holes[i].rx, eyeR.holes[i].ry))),
  })),
};
const bl = L.blush[0], br = L.blush[1];
out.blush = { c: [r1(avg(bl.c[0], 2 * CX - br.c[0])), r1(avg(bl.c[1], br.c[1]))], rx: r1(avg(bl.rx, br.rx)), ry: r1(avg(bl.ry, br.ry)) };
out.shorts = L.shorts.map((s) => ({ a: s.a.map(r1), b: s.b.map(r1), mid: s.mid.map(r1), w: s.width_grid }));
out.widths = Object.fromEntries(Object.entries(L.traces).map(([k, v]) => [k, v.width_grid]));
fs.writeFileSync(path.join(root, 'qa/fitted-paths.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
