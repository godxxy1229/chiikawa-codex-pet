// 치이카와 포즈 정의 (좌표: chiikawa-rig.svg의 400×400 격자)
// 프레임 포즈 = { parts: { 부위id: { tx, ty, r, sx, sy } }, show: [켤 파츠], hide: [끌 부위] }
// r·sx·sy는 PIVOTS의 기준점을 중심으로 적용된다. 프레임 수가 적으므로 동작은 크게 준다.
// 팔·다리는 기준점 회전만 쓴다(끌어올리면 몸 윤곽과 이음매가 꺾인다).

// 셀 배치: 몸 중심(x 200)을 셀 가운데에, 실루엣 아래 끝(y 362)을 셀 y 197에 둔다. idle 약 134×143px.
const SCALE = 0.5;
export const CELL = { w: 192, h: 208, scale: SCALE, ox: +(96 - 200 * SCALE).toFixed(2), oy: +(197 - 362 * SCALE).toFixed(2) };

// 옆모습 몸(running-left/right, 사용자 지정: 비교 프로젝트처럼 몸통을 옆으로 돌려 발이 몸 아래 가운데에 온다).
// tools/gen-side.mjs가 이 값으로 source의 side 구간을 만든다(바꾸면 생성 도구를 다시 실행).
// gapB·gapF: 발 구간 양 끝(몸 밑선이 끊기고 발 뒤 side-hip이 대신 그림), foot*: 발 폭·바닥 선 중심 y·엉덩이 기준점(가까운 발 F, 먼 발 B),
// paw*: 붙은 앞발·뒷발의 폭·뿌리 반폭·길이·뿌리 높이, tail*: 옆모습 꼬리
export const SIDE = {
  gapB: [254, 337.5], gapF: [160, 337.5],
  footW: 28, footY: 359.2, footF: [205, 320], footB: [205, 320],
  pawW: 24, pawHW: 15, pawL: 5, pawYF: 272, pawYB: 268,
  // 꼬리(사용자 지정: 비교 프로젝트처럼 대부분 몸 뒤에 숨김): 뒤 옆선의 tailAt 근처에서 바깥으로 tailOut만큼 나온
  // 반지름 tailR 원, 선 굵기 tailW(몸 선보다 가늘게). 몸 밖으로는 작은 반달만 보인다
  tailAt: [281, 319], tailOut: 3, tailR: 9.5, tailW: 5,
};
export const PAW_DEGS = [0, 15, 30, 45, 60];

export const PIVOTS = {
  chiikawa: [200, 362], // 발 아래 중앙: squash·점프·기울기
  'ear-l': [136, 110],
  'ear-r': [264, 110],
  'arm-l': [105, 274],
  'arm-r': [295, 274],
  'leg-l': [129, 334],
  'leg-r': [271, 334],
  'foot-f': SIDE.footF,
  'foot-b': SIDE.footB,
  tail: [282, 322],
  face: [200, 190],
  tears: [200, 186],
  weapon: [150, 286],
  'weapon-run': [150, 286], // weapon과 같은 기준점(placeWeapon이 같은 계산을 쓴다)
  book: [200, 274],
};

const ms = (n, each, last) => [...Array(n - 1).fill(each), last];
export const ROWS = [
  { state: 'idle', row: 0, frames: 6, durations: [280, 110, 110, 140, 140, 320] },
  { state: 'running-right', row: 1, frames: 8, durations: ms(8, 120, 220), mirrorOf: 'running-left' },
  { state: 'running-left', row: 2, frames: 8, durations: ms(8, 120, 220) },
  { state: 'waving', row: 3, frames: 4, durations: ms(4, 140, 280) },
  { state: 'jumping', row: 4, frames: 5, durations: ms(5, 140, 280) },
  { state: 'failed', row: 5, frames: 8, durations: ms(8, 140, 240) },
  { state: 'waiting', row: 6, frames: 6, durations: ms(6, 150, 260) },
  { state: 'running', row: 7, frames: 6, durations: ms(6, 120, 220) },
  { state: 'review', row: 8, frames: 6, durations: ms(6, 150, 280) },
  { state: 'look', row: 9, frames: 16 }, // 9·10행: 000 → 337.5 시계 방향
];
export const LOOK = {
  state: 'look',
  labels: ['000', '022.5', '045', '067.5', '090', '112.5', '135', '157.5', '180', '202.5', '225', '247.5', '270', '292.5', '315', '337.5'],
};

// 무기 기본 배치(source/chiikawa.svg의 weapon transform과 같게): 손잡이 끝 위치와 자루 각도
const WEAPON_BASE = { x: 52, y: 300, r: -3 };
// 쥔 손(grip-l·grip-r)의 자루 중심: 토벌창은 이 두 점을 지나간다(레퍼런스 손 측정값)
const GRIP_L = [112.2, 287.4], GRIP_R = [282.8, 270.1];
// 토벌창 자루 끝(포크 등) 위치: tools/gen-props.mjs의 J와 같게
const WEAPON_J = 272;
const GRIP_ANGLE = (Math.atan2(GRIP_R[1] - GRIP_L[1], GRIP_R[0] - GRIP_L[0]) * 180) / Math.PI;

const TAU = Math.PI * 2;
const { sin, cos, max, abs } = Math;
const px = (v) => v / SCALE; // 셀 픽셀 → 격자 단위

function pose() { return { parts: {}, show: [], hide: [] }; }
function add(p, id, t) {
  const q = (p.parts[id] ??= {});
  for (const k of ['tx', 'ty', 'r']) if (t[k]) q[k] = (q[k] ?? 0) + t[k];
  for (const k of ['sx', 'sy']) if (t[k] != null) q[k] = (q[k] ?? 1) * t[k];
  return p;
}

// 표정: 기본(눈썹·뜬 눈·ω입·턱 점)에서 바꿀 부분만 지정한다.
const DEFAULT_FACE = { brows: 'brows', eyes: 'eyes', mouth: 'mouth-w', chin: 'chin' };
function expr(p, f) {
  for (const [slot, def] of Object.entries(DEFAULT_FACE)) {
    const want = f[slot] ?? def;
    if (want === def) continue;
    p.hide.push(def);
    if (want) p.show.push(want);
  }
  if (f.tears) p.show.push(f.tears === true ? 'tears' : f.tears);
  if (f.tongue) p.show.push('tongue');
  return p;
}
const HAPPY = { brows: 'brows-happy', eyes: 'eyes-happy', mouth: 'mouth-open', chin: 'chin-open' };
const FOCUS = { brows: 'brows-angry', eyes: 'eyes-focus', chin: 'chin-smile' };
const READ = { brows: 'brows-wavy', eyes: 'eyes-focus', chin: 'chin-smile' };
const CRY = { brows: 'brows-cry', eyes: 'eyes-cry', mouth: 'mouth-cry', chin: null, tears: 'tears-cry' };
// running: 레퍼런스(running_frame1·4)처럼 넓은 그릇 입 + 혀 + 입 아래 턱 선(waving용 좁은 mouth-open과 다름)
const CHARGE = { brows: 'brows-wavy', eyes: 'eyes-focus', mouth: 'mouth-charge', chin: 'chin-charge', tears: true, tongue: true };

// 시선: 이목구비를 함께 옮기고 홍조는 조금 덜 옮긴다(얼굴이 돌아가는 느낌).
function gaze(p, dx, dy) {
  add(p, 'face', { tx: dx, ty: dy });
  for (const id of ['blush-l', 'blush-r']) add(p, id, { tx: -dx * 0.25, ty: -dy * 0.25 });
  return p;
}
// 귀: 양쪽이 바깥(+)/안쪽(−)으로 함께
function ears(p, outward, lean = 0) {
  add(p, 'ear-l', { r: -outward + lean });
  add(p, 'ear-r', { r: outward + lean });
  return p;
}
// 무기 배치: 자루 위 localX 지점이 몸 좌표 G에 오고, 자루가 theta° 방향을 향하도록 weapon 변형을 계산한다.
function placeWeapon(p, localX, [gx, gy], theta, id = 'weapon') {
  const rad = (d) => (d * Math.PI) / 180;
  const b = rad(WEAPON_BASE.r);
  const q = [WEAPON_BASE.x + localX * cos(b), WEAPON_BASE.y + localX * sin(b)];
  const r = theta - WEAPON_BASE.r, a = rad(r);
  const [px0, py0] = PIVOTS.weapon, v = [q[0] - px0, q[1] - py0];
  const rv = [v[0] * cos(a) - v[1] * sin(a), v[0] * sin(a) + v[1] * cos(a)];
  add(p, id, { r, tx: gx - px0 - rv[0], ty: gy - py0 - rv[1] });
  return p;
}
// raw 변형: 원점에서 +x로 그린 파츠를 from→to 방향으로 돌리고 길이에 맞춰 x로 늘인다(base는 그린 길이).
const f1 = (v) => +v.toFixed(2);
function stretch(p, id, [fx, fy], [tx, ty], base) {
  const ang = (Math.atan2(ty - fy, tx - fx) * 180) / Math.PI, len = Math.hypot(tx - fx, ty - fy);
  p.parts[id] = { raw: `translate(${f1(fx)} ${f1(fy)}) rotate(${f1(ang)}) scale(${f1(len / base)} 1)` };
}
// 고개 돌리기(비교 프로젝트처럼 확실하게): 머리를 반지름 HEAD_R인 구로 보고, 얼굴의 왼·가운데·오른쪽 띠(face-l/c/r,
// source의 face-art 사본)를 구 위 각도 φ+yaw 위치로 옮기고 가로로 누른다(가장자리로 갈수록 좁아짐).
// 90° 넘게 돌아간 띠는 머리 뒤라 윤곽 밖으로 밀어 clip-head에 가려지게 한다. pitch(+ 위)는 얼굴 전체를 위아래로 옮기고 살짝 누른다.
const HEAD_R = 120, BAND_U = { l: -43.2, c: 0, r: 43.2 }; // 띠 대표 위치(눈 중심, 미간 넓힌 뒤)
function turn(p, yaw, pitch = 0) {
  const y = (yaw * Math.PI) / 180, t = (pitch * Math.PI) / 180;
  for (const [b, u] of Object.entries(BAND_U)) {
    const ph = Math.asin(u / HEAD_R), a = ph + y;
    const over = Math.abs(a) - Math.PI / 2;
    const x = over > 0 ? Math.sign(a) * HEAD_R * (1 + over) : HEAD_R * Math.sin(a);
    const sx = Math.max(0.3, Math.cos(Math.min(Math.abs(a), Math.PI / 2)) / Math.cos(ph));
    const cx = 200 + u;
    p.parts[`face-${b}`] = { raw: `translate(${f1(200 + x)} 190) scale(${f1(sx)} 1) translate(${f1(-cx)} -190)` };
  }
  add(p, 'face', { ty: -32 * Math.sin(t), sy: 1 - 0.12 * Math.sin(t) ** 2 });
  return p;
}
function placeAt(p, id, [x, y], theta) {
  p.parts[id] = { raw: `translate(${f1(x)} ${f1(y)}) rotate(${f1(theta)})` };
}
// 팔: 양쪽이 바깥(+)으로 함께 벌어짐
// 붙은 팔(tools/gen-arms.mjs가 각도별로 생성): 몸 외곽선이 그대로 불룩하게 나와 팔이 된다. φ는 내린 방향 0°, 바깥 +.
// waving·jumping에서 몸 뒤 팔(arm-*)을 크게 돌리면 소켓선이 팔 뿌리를 가로질러 팔이 떨어져 보이므로 이것을 쓴다.
export const ARM_DEGS = [-12, -5, 8, 25, 32, 40, 52, 60, 70, 82, 96, 122];
// 흔드는 손(waving 오른팔, tools/gen-arms.mjs의 raisedArm): 붙은 팔은 뿌리 위·아래 꺾임이 관절처럼 보여(사용자 지적),
// 비교 프로젝트처럼 몸 앞에 겹쳐 든 손을 쓴다. φ는 붙은 팔과 같은 기준(내린 방향 0°, 바깥 +, 180 = 위)
export const WAVE_DEGS = [85, 110, 120, 155];
function waveAt(p, side, deg) {
  const near = WAVE_DEGS.reduce((b, v) => (Math.abs(v - deg) < Math.abs(b - deg) ? v : b));
  p.hide.push(`arm-${side}`);
  p.show.push(`arm-wave-${side}-${near}`);
  return p;
}
function armAt(p, side, deg) {
  const near = ARM_DEGS.reduce((b, v) => (Math.abs(v - deg) < Math.abs(b - deg) ? v : b));
  p.hide.push(`arm-${side}`);
  p.show.push(`arm-att-${side}-${near < 0 ? `m${-near}` : near}`);
  return p;
}
// 옆모습 앞발(f)·뒷발(b): gen-side.mjs가 PAW_DEGS 각도마다 만든 붙은 팔 중 가장 가까운 것을 켠다
function pawAt(p, k, deg) {
  const near = PAW_DEGS.reduce((b, v) => (Math.abs(v - deg) < Math.abs(b - deg) ? v : b));
  p.show.push(`paw-${k}-${near}`);
  return p;
}
function arms(p, outL, outR = outL) {
  add(p, 'arm-l', { r: outL });
  add(p, 'arm-r', { r: -outR });
  return p;
}

const STATES = {
  // 숨쉬기 squash + 몸 bob + 귀 까딱 + 팔 살짝 흔들림. 깜빡임 없음.
  idle(i) {
    const k = [0, 0.3, 0.65, 1, 0.65, 0.3][i];
    const p = pose();
    add(p, 'chiikawa', { sy: 1 - 0.04 * k, sx: 1 + 0.02 * k });
    add(p, 'face', { ty: 2 * k });
    ears(p, [0, 0, 7, 10, 4, 0][i]);
    arms(p, 4 * k);
    return p;
  },

  // 왼쪽으로 종종걸음(옆모습, 사용자 지정: 비교 프로젝트처럼 몸통을 옆으로 돌려 둥근 몸 아래 가운데의 짧은 두 발로 달린다).
  // 정면 몸(body-fill·body-lines·다리·팔)을 끄고 옆모습 몸(gen-side.mjs)을 켠다. 두 발은 엉덩이 기준점으로 엇갈려 돌고,
  // 앞발·뒷발은 가까운 발과 반대로 흔든다(가까운 발이 앞으로 나가면 앞발은 몸 쪽으로 당기고 뒷발은 뒤로 뻗음, 대각 교차).
  // 한 주기에 두 번 튀고, 귀는 늦게 따라온다. 얼굴은 진행 방향 가장자리로 돌린다(turn).
  // 꼬리는 비교 프로젝트처럼 뒤 옆선 밖으로 작은 반달만 보이게 한다(tail-side, 정면 tail은 발·앞발과 헷갈린다는 지적).
  'running-left'(i) {
    const ph = (i / 8) * TAU, s = sin(ph);
    const p = pose();
    p.hide.push('body-fill', 'body-lines', 'socket-l', 'socket-r', 'socket-l-top', 'socket-r-top', 'hip-lines', 'leg-l', 'leg-r', 'arm-l', 'arm-r');
    p.show.push('body-side-fill', 'body-side-lines', 'side-hip', 'foot-b', 'foot-f', 'tail-side');
    // 발은 몸 면 뒤라 앞뒤로 옮겨도 윗부분이 숨는다. 돌리기만 하면 발이 몸 안으로 말려 들어가 짧아지므로,
    // 앞뒤로 D만큼 옮기고 조금 돌려 디딤 느낌을 주며, 앞으로 나가는(공중) 발만 살짝 든다.
    // 든 높이는 발이 엇갈리는 중간(1·5번째)에 가장 크고, 두 발이 겹치는 0·4번째에는 0(겹친 발이 한 발로 보이게)
    const D = 19, c = cos(ph), lift = 12 * abs(s);
    add(p, 'foot-f', { tx: -D * s, ty: -lift * max(0, c), r: 14 * s }); // s > 0: 가까운 발이 앞(왼쪽)
    add(p, 'foot-b', { tx: D * s, ty: -lift * max(0, -c), r: -14 * s });
    pawAt(p, 'f', 30 - 20 * s);
    pawAt(p, 'b', 30 + 20 * s);
    const up = (1 + cos(2 * ph)) / 2; // 두 발이 모일 때 1
    add(p, 'chiikawa', { r: -4 + 1.5 * s, ty: -px(5) * up, sy: 1 - 0.035 * (1 - up), sx: 1 + 0.02 * (1 - up), tx: -px(1.5) * sin(2 * ph) });
    const lag = sin(2 * ph - 1.3);
    ears(p, 2 + 2.5 * lag, 4); // 귀는 회전만(안쪽으로 많이 돌리면 귀 밑동 선이 벌어진다), 바람에 뒤로 살짝 눕는다
    // 옆모습 얼굴(사용자 지정, 비교 프로젝트처럼): 얼굴을 진행 방향 가장자리로 돌려 먼 쪽 눈·홍조는 윤곽에 가린다
    turn(p, -65, -4);
    add(p, 'face', { ty: 1 - 2 * up });
    return p;
  },

  // 웃는 얼굴로 오른팔을 크게 한 번 흔든다. 왼팔은 옆으로 벌리고 한 다리는 살짝 든다.
  waving(i) {
    const p = pose();
    expr(p, HAPPY);
    // 한 바퀴에 한 번만 흔든다(사용자 지정): 오른팔 올라감 → 꼭대기 → 내려옴 → 아래에서 쉼(마지막 280ms).
    // 왼팔·몸 기울기·다리·귀는 한 박자 늦게 따라와 같은 높이의 프레임(0·2)도 모양이 다르다.
    add(p, 'chiikawa', { r: [4, 5, 5, 3][i] });
    // 흔드는 손은 몸 앞에 겹쳐 든 손(관절이 덜 느껴지게, 사용자 지정): 옆으로 들어 → 뺨 옆까지 올림(비교 프로젝트처럼) → 내려옴 → 옆에서 쉼
    waveAt(p, 'r', [110, 155, 120, 85][i]);
    armAt(p, 'l', [40, 52, 52, 40][i]);
    add(p, 'leg-l', { r: [10, 16, 12, 6][i] });
    ears(p, [3, 5, 6, 2][i], 3);
    gaze(p, 2, -2);
    return p;
  },

  // 높이(사용자 지정): 0% → 78% → 100%(정점 46px) → 78% → 0%. 준비 웅크림 → 상승(한 팔 들기·다리 차기) → 정점(만세) →
  // 하강(팔 벌려 균형, 다리 모음, 귀 날림) → 착지 충격(상체가 아래로 눌림)
  jumping(i) {
    const p = pose();
    expr(p, HAPPY);
    const lift = [0, 36, 46, 36, 0][i];
    add(p, 'chiikawa', { ty: -px(lift), sy: [0.94, 1.07, 1.0, 1.04, 0.86][i], sx: [1.04, 0.95, 1.0, 0.97, 1.09][i] });
    armAt(p, 'l', [-5, 25, 122, 70, 8][i]);
    armAt(p, 'r', [-5, 60, 122, 70, 8][i]);
    add(p, 'leg-l', { r: [0, 18, -16, -6, 0][i] });
    add(p, 'leg-r', { r: [0, 6, 16, 6, 0][i] });
    ears(p, [-4, 6, 4, 10, -7][i]);
    add(p, 'face', { ty: [3, -2, 0, -2, 5][i] });
    return p;
  },

  // 실패: 눈을 뜬 채 눈물이 고인 우는 얼굴(failed.png 측정). 몸은 고정하고 몸 주위 떨림 표시만 프레임마다 바뀐다(사용자 지정).
  failed(i) {
    // 사용자 지정: 고개를 까딱이거나 몸을 흔들지 않는다. 몸·얼굴은 고정하고, 몸 주위 떨림 표시(tremble-0~2)만 프레임마다 바꿔 떨린다.
    // 표정·얼굴 높이는 reference/failed.png 측정값(눈이 평소보다 아래, 시선 dy 18)
    const p = pose();
    expr(p, CRY);
    p.show.push('tail', `tremble-${[0, 1, 2, 1, 0, 2, 1, 2][i]}`);
    add(p, 'chiikawa', { sx: 1.02, sy: 0.98 });
    ears(p, -3);
    arms(p, -3);
    gaze(p, 0, 18);
    // 홍조를 조금 바깥으로(failed.png처럼 눈물이 눈 바깥 아래에서 시작해 홍조 위를 덮어도 빗금과 엉키지 않게).
    // 레퍼런스처럼 오른 눈물이 더 바깥까지 올라가고 오른 홍조도 더 바깥에 있어 오른쪽을 더 옮긴다
    add(p, 'blush-l', { tx: -6 });
    add(p, 'blush-r', { tx: 10 });
    return p;
  },

  // 몸 옆선에서 이어진 두 손(grip-l·grip-r)으로 토벌창을 가로로 쥐고 결의에 찬 얼굴로 대기한다.
  // 창은 손에 단단히 쥐어져 몸과 함께 움직이고, 몸이 좌우로 흔들리며 들썩여 창끝이 까딱인다.
  waiting(i) {
    const p = pose();
    expr(p, FOCUS);
    p.show.push('weapon', 'grip-l', 'grip-r');
    p.hide.push('arm-l', 'arm-r');
    const bob = [0, 1, 0.5, 0, 1, 0.5][i];
    placeWeapon(p, 57, GRIP_L, GRIP_ANGLE); // 레퍼런스처럼 왼손이 흰 손잡이(57)를, 오른손이 포크 47 앞 분홍 자루를 쥔다
    add(p, 'chiikawa', { tx: -31.5, ty: -px(3) * bob, r: [-1.3, 0, 1.5, 2.4, 1.5, 0][i], sy: 1 - 0.02 * (1 - bob) });
    add(p, 'leg-l', { r: [0, 8, 0, 0, 0, 0][i] });
    add(p, 'leg-r', { r: [0, 0, 0, 0, -8, 0][i] });
    ears(p, [2, 6, 4, 2, 6, 4][i]);
    gaze(p, 0, -3);
    return p;
  },

  // 작업 중: 토벌창을 앞뒤로 흔들며 크게 한 번 찌른다(토벌 장면). 사용자가 준 자세 사진처럼 창을 몸 앞에 가로로 들고,
  // 왼손은 몸 외곽선이 둥글게 불룩해진 손(grip-run-l, 사진 윤곽 측정)이 흰 손잡이를, 오른손은 몸 앞 둥근 앞발(paw-r)이 자루를 쥔다.
  // 포크는 오른쪽을 향한다. 손이 몸에 붙어 있으므로 창은 몸과 함께 움직이고, 몸을 발 기준으로 크게 젖히고 기울여 찌른다.
  // 0 준비 → 1 당김(왼쪽으로 물러나며 뒤로 젖혀 포크를 치켜듦, 웅크림) → 2 찌름(오른쪽으로 내딛으며 앞으로 기울어
  // 포크를 오른쪽 아래로 내지름) → 3 버팀 → 4 복귀 → 5 자리 잡기
  running(i) {
    const p = pose();
    expr(p, CHARGE);
    p.show.push('weapon-run', 'grip-run-l', 'paw-r');
    // 왼손 윤곽이 몸 옆선 끝에서 바로 이어지므로 왼쪽 소켓 윗선은 끈다(손 면 위로 선 끝이 삐져나옴)
    p.hide.push('arm-l', 'arm-r', 'socket-l-top');
    const K = [
      // bx: 몸 가로 이동, r: 발 기준 기울기(+ = 오른쪽 앞으로), tilt: 왼손을 축으로 창을 치켜듦(−)·내림(+), squash, 다리, 귀(lean − = 귀·눈물이 왼쪽으로 날림)
      { bx: -32, r: 0, tilt: 0, sx: 1, sy: 1, legL: 3, legR: -6, ear: 3, lean: -4 },
      { bx: -32, r: -3, tilt: -6, sx: 1.03, sy: 0.93, legL: -12, legR: 10, ear: 1, lean: 6 },
      { bx: -36, ty: -3, r: 7, tilt: 5, sx: 1.05, sy: 0.96, legL: 24, legR: -30, ear: 9, lean: -16 },
      { bx: -32, ty: -2, r: 6, tilt: 4, sx: 1.03, sy: 0.98, legL: 18, legR: -24, ear: 7, lean: -11 },
      { bx: -31, r: 3, tilt: 2, sx: 1.02, sy: 0.99, legL: 8, legR: -14, ear: 5, lean: -7 },
      { bx: -32, r: 0, tilt: 0, sx: 0.99, sy: 1.01, legL: 2, legR: 2, ear: 2, lean: 0 },
    ][i];
    add(p, 'chiikawa', { tx: K.bx, ty: K.ty ?? 0, r: K.r, sx: K.sx, sy: K.sy });
    // 왼손(grip-run-l)이 흰 손잡이 RUN_GRIP 지점을 쥐고, 오른 앞발은 그보다 RUN_SEP 앞(몸 안쪽)의 자루 위에 얹는다.
    // 자루는 사진처럼 오른쪽이 조금 올라간 RUN_ANGLE(−4°)이고, 찌르기 단계마다 왼손을 축으로 tilt만큼 돈다
    const RUN_GRIP_L = [108.9, 288.6], RUN_ANGLE = -4, RUN_GRIP = 48, RUN_SEP = 138;
    const th = RUN_ANGLE + K.tilt, a = (th * Math.PI) / 180;
    placeWeapon(p, RUN_GRIP, RUN_GRIP_L, th, 'weapon-run');
    placeAt(p, 'paw-r', [RUN_GRIP_L[0] + RUN_SEP * cos(a), RUN_GRIP_L[1] + RUN_SEP * sin(a)], 0);
    add(p, 'leg-l', { r: K.legL });
    add(p, 'leg-r', { r: K.legR });
    add(p, 'tears', { sy: 1 + 0.015 * Math.abs(K.lean) }); // 옆으로 밀면 얼굴 띠 경계를 넘어 이음매가 생긴다
    ears(p, K.ear, K.lean);
    gaze(p, 8, 1);
    // 홍조를 레퍼런스(running_frame1)처럼 눈에서 조금 더 떨어뜨린다(눈물이 눈 바깥 아래에서 시작해도 빗금과 겹치지 않게)
    add(p, 'blush-l', { tx: -10 });
    add(p, 'blush-r', { tx: 10 });
    return p;
  },

  // 몸 옆에서 나온 두 팔이 책 가장자리를 감싸 쥐고 찌푸린 얼굴로 읽는다: 시선이 좌→우로 훑고, 4번째 프레임에 책장이 넘어간다.
  review(i) {
    const p = pose();
    expr(p, READ);
    p.show.push('book');
    p.hide.push('arm-l', 'arm-r');
    // 책장 넘김 3프레임(사용자 지정, 1부터 세면 3·4·5번째): 읽기 0·1 → 들림 2 → 넘어가는 중 3 → 내려앉음 4 → 새 쪽 5(280ms).
    // 긴 마지막 프레임에는 넘김을 두지 않는다(넘기는 도중 멈춘 듯 보임). 시선은 줄을 따라 오른쪽 끝까지 읽고,
    // 넘어가는 책장을 따라 가운데 → 왼쪽으로 옮겨 새 쪽 왼쪽 첫 줄에서 머문다.
    const turn = [0, 0, 1, 2, 3, 0][i];
    if (turn) p.show.push(`page-turn-${turn}`);
    const sweep = [-0.3, 0.7, 1, 0.3, -0.7, -1][i];
    gaze(p, 7 * sweep, 5);
    add(p, 'chiikawa', { r: 2 * sweep });
    // 책은 몸에 고정한다(팔 안쪽선·앞발이 몸 옆선과 정확히 이어지도록). 몸 흔들림·시선·책장 넘김으로 움직인다.
    ears(p, [2, 1, 0, 1, 2, 3][i], 2 * sweep);
    return p;
  },

  // 16방향 시선: 몸은 고정, 이목구비 이동 + 몸 살짝 기울기, 귀는 시선 반대쪽으로 기울어짐
  look(i) {
    const th = (i * 22.5 * Math.PI) / 180;
    const p = pose();
    // 고개를 확실히 돌린다(사용자 지정, 비교 프로젝트 비율): 좌우 최대 60°(90°에서 얼굴이 몸 폭의 약 40% 이동, 먼 쪽 눈은
    // 윤곽에 반쯤 가림), 위아래 최대 60°
    turn(p, 60 * sin(th), 60 * cos(th));
    add(p, 'chiikawa', { r: 3.5 * sin(th) });
    // 귀는 회전만 한다(옮기면 머리 윗선과 귀 안쪽선 사이가 벌어진다)
    ears(p, 3 * max(0, cos(th)) + 2 * abs(sin(th)), -6 * sin(th));
    return p;
  },
};

export function framePose(state, i) {
  const fn = STATES[state];
  if (!fn) throw new Error(`no pose for ${state}`);
  return fn(i);
}
