// 붙은 팔 공용 계산(gen-arms.mjs·gen-side.mjs): 몸 외곽선이 그대로 바깥으로 불룩하게 나와 팔이 되는 모양.
// - 외곽선은 몸 "왼쪽" 선을 아래 → 위로 이은 3차 곡선들이다(바깥 = 진행 방향의 왼쪽). 오른쪽 팔은 x=200 대칭으로 만든다.
// - φ: 곧게 내린 방향 0°, 바깥(몸 밖) 쪽 +.
// - 뿌리 중심(호 길이 sc)에서 외곽선을 따라 ±hw 떨어진 A(위)·B(아래)에서 팔 윤곽선이 시작·끝나고, 뿌리를 닫는 선은 없다.
//   흰 면은 A–B 사이 몸 외곽선을 덮는다(몸선 위 레이어). 선 끝 둥근 캡이 몸선과 맞물린다.
const bez = ([p0, p1, p2, p3], t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
};
export const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l]; };
export const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
export const lerp = (pts, x) => { // 구간 선형 보간 [[x, y], …]
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts.at(-1)[1];
};
export const f = (v) => +v.toFixed(1);
export const P = (p) => `${f(p[0])} ${f(p[1])}`;

// 3차 곡선 목록 → 호 길이 s의 점·접선(위쪽 방향)·바깥 법선
export function outline(segs) {
  const poly = [];
  for (const s of segs) for (let i = poly.length ? 1 : 0; i <= 60; i++) poly.push(bez(s, i / 60));
  const arc = [0];
  for (let i = 1; i < poly.length; i++) arc.push(arc[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const at = function (s) {
    s = Math.max(0, Math.min(arc.at(-1), s)); // 외곽선 밖으로 연장하지 않는다
    const i = Math.max(1, Math.min(arc.length - 1, arc.findIndex((v) => v >= s)));
    const a = poly[i - 1], b = poly[i], t = (s - arc[i - 1]) / (arc[i] - arc[i - 1] || 1);
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const tg = norm([b[0] - a[0], b[1] - a[1]]);
    return { p, tg, out: [tg[1], -tg[0]] }; // 위로 가는 접선을 시계 방향으로 돌리면 몸 밖(왼쪽)
  };
  at.length_ = arc.at(-1);
  return at;
}

// at: outline()의 결과, phi: 팔 방향, sc: 뿌리 중심 호 길이, hw: 외곽선을 따른 뿌리 반폭, L: 뿌리 → 끝 중심 거리, W: 팔 폭
export function attachedArm(at, phi, { sc, hw, L, W }) {
  const R = W / 2;
  const a = (phi * Math.PI) / 180;
  const d = [-Math.sin(a), Math.cos(a)];      // 팔 방향
  const n = [-Math.cos(a), -Math.sin(a)];     // 팔의 A쪽(바깥·위) 옆 방향
  const C = at(sc), A = at(sc + hw), B = at(sc - hw);
  // 팔이 외곽선과 나란할수록(내린 팔) 축을 몸 밖으로 반 폭만큼 띄운다
  const par = Math.abs(d[0] * C.tg[0] + d[1] * C.tg[1]);
  const S = add(C.p, C.out, R * par);
  const T = add(S, d, L);
  const PA = add(T, n, R), PB = add(T, n, -R), TIP = add(T, d, R);
  const k = 0.552 * R;
  // 외곽선에서 나가는 방향: 팔 쪽 + 몸 밖 + 외곽선이 이어지던 방향을 섞어, 몸선이 꺾이지 않고 팔로 부풀게 한다
  const leave = (Q, side, cont) => {
    const v = add(add(norm([side[0] - Q.p[0], side[1] - Q.p[1]]), Q.out, 0.6), cont, 0.6);
    return Math.hypot(...v) < 0.2 ? Q.out : norm(v);
  };
  const dA = leave(A, PA, [-A.tg[0], -A.tg[1]]), dB = leave(B, PB, B.tg);
  const lA = 0.42 * Math.hypot(PA[0] - A.p[0], PA[1] - A.p[1]), lB = 0.42 * Math.hypot(PB[0] - B.p[0], PB[1] - B.p[1]);
  const line = `M${P(A.p)}C${P(add(A.p, dA, lA))} ${P(add(PA, d, -lA))} ${P(PA)}`
    + `C${P(add(PA, d, k))} ${P(add(TIP, n, k))} ${P(TIP)}`
    + `C${P(add(TIP, n, -k))} ${P(add(PB, d, k))} ${P(PB)}`
    + `C${P(add(PB, d, -lB))} ${P(add(B.p, dB, lB))} ${P(B.p)}`;
  const fill = `${line}L${P(add(B.p, B.out, -9))} ${P(add(C.p, C.out, -10))} ${P(add(A.p, A.out, -9))}Z`;
  return { line, fill };
}

// 앞으로 든 팔(waving의 흔드는 손, 사용자 지정: heelee912/chiikawa-dots-pets처럼 관절이 덜 느껴지게).
// 붙은 팔(attachedArm)은 뿌리 위·아래가 몸선과 만나는 두 꺾임이 관절처럼 보인다. 이 팔은 몸 앞에 겹쳐 든 손이라
//  - 위(안쪽) 윤곽선은 몸 안에서 열린 끝(F)으로 시작하고(닫는 꺾임 없음),
//  - 아래(바깥) 윤곽선은 몸 옆선의 B점으로 같은 기울기로 이어져 몸선이 그대로 팔이 된다.
//  - 팔은 끝으로 갈수록 안쪽으로 살짝 휘고(바나나) 둥근 끝으로 닫힌다. 흰 면이 그 사이 몸 외곽선을 덮는다.
// at: 몸 왼쪽 외곽선(아래 → 위), phi: 내린 방향 0°, 바깥 +(90 = 옆, 180 = 위)
// S: 어깨 중심, L: 어깨 → 끝 중심 길이, w0·w1: 어깨·끝 반폭, curl: 끝이 안쪽으로 휘는 각, sB: B점 호 길이, inF: 열린 끝을 몸 안으로 넣는 길이
export function raisedArm(at, phi, { S, L, w0, w1, curl, sB, inF }) {
  const rad = (v) => (v * Math.PI) / 180;
  const a = rad(phi), c = rad(curl);
  const d = [-Math.sin(a), Math.cos(a)], n = [-Math.cos(a), -Math.sin(a)]; // 팔 방향, 위(안쪽) 옆 방향
  const dT = norm(add([d[0] * Math.cos(c), d[1] * Math.cos(c)], n, Math.sin(c)));  // 끝 방향(안쪽으로 휨)
  const nT = norm(add([n[0] * Math.cos(c), n[1] * Math.cos(c)], d, -Math.sin(c)));
  const M = add(S, d, L / 2), T = add(M, dT, L / 2);
  const Tu = add(T, nT, w1), Tl = add(T, nT, -w1), TIP = add(T, dT, w1), k = 0.552 * w1;
  const F = add(add(S, n, w0 * 0.85), d, -inF);
  const B = at(sB), down = [-B.tg[0], -B.tg[1]];
  const lu = Math.hypot(Tu[0] - F[0], Tu[1] - F[1]) / 3, ll = Math.hypot(Tl[0] - B.p[0], Tl[1] - B.p[1]) * 0.42;
  const line = `M${P(F)}C${P(add(F, d, lu))} ${P(add(Tu, dT, -lu))} ${P(Tu)}`
    + `C${P(add(Tu, dT, k))} ${P(add(TIP, nT, k))} ${P(TIP)}`
    + `C${P(add(TIP, nT, -k))} ${P(add(Tl, dT, k))} ${P(Tl)}`
    + `C${P(add(Tl, dT, -ll))} ${P(add(B.p, down, -ll))} ${P(B.p)}`;
  const fill = `${line}L${P(add(B.p, B.out, -10))} ${P(add(F, n, -4))}Z`;
  return { line, fill };
}
