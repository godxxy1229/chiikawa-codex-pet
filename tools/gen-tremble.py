# failed 떨림 표시 생성: reference/failed.png에서 몸 밖의 짧은 물결선·점을 찾아 400 격자로 옮기고,
# 프레임마다 번갈아 켤 변형 3개(tremble-0~2)를 만들어 source/chiikawa.svg의 gen:tremble 구간을 다시 쓴다.
#   python tools/gen-tremble.py
#
# - 측정: 짙은 픽셀 연결 성분 중 몸 윤곽(큰 성분 3개)을 막으로 삼아 바깥에 있는 작은 성분만 고른다.
#   점(작고 둥근 성분)과 물결선(길쭉한 성분)으로 나누고, 물결선은 주축을 따라 구간 평균을 내 중심선을 얻는다.
# - 배치: 몸 폭(흰 행 최대 폭 × 1.06)을 268 격자로, 몸 가운데를 x 200에, 발 아래를 y 365.6에 맞춘다.
# - 다리 옆·아래(꼬리 포함) 표시는 빼고(사용자 요청), 귀 주변처럼 가는 부위 옆의 표시는 실루엣과 최소 간격(CLEAR)이 생길 때까지 바깥으로 민다.
# - 변형: 0 = 측정 그대로 / 1 = 몸 중심에서 바깥으로 3 밀고 접선 방향으로 2.4 옮기며 물결 위상을 뒤집고 점 일부를 끈다 /
#   2 = 바깥으로 1.6, 접선 반대로 3, 물결선을 8° 돌리고 다른 점을 끈다.
import json, math, re, subprocess
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'source/chiikawa.svg'
BODY_W = 268          # 몸 폭(격자)
FOOT_Y = 365.6        # 발 아래 외곽선 바깥(격자)
CENTER = (200, 232)   # 변형 때 밀어낼 몸 중심(격자)
SQ_W, DOT_R = 3.6, 2.4

im = np.array(Image.open(ROOT / 'reference/failed.png').convert('RGBA')).astype(int)
H, W = im.shape[:2]
al = im[..., 3] > 100
dark = al & (im[..., 0] < 150) & (im[..., 1] < 120) & (im[..., 2] < 120)
white = (im[..., 3] > 200) & (im[..., 0] > 235) & (im[..., 1] > 235) & (im[..., 2] > 235)

# 연결 성분(8방향)
lab = np.zeros((H, W), np.int32)
sizes = [0]
for y in range(H):
    for x in range(W):
        if dark[y, x] and not lab[y, x]:
            cid = len(sizes); lab[y, x] = cid; q = deque([(y, x)]); n = 0
            while q:
                cy, cx = q.popleft(); n += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and dark[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = cid; q.append((ny, nx))
            sizes.append(n)
sizes = np.array(sizes)

# 몸 안쪽: 큰 윤곽 성분을 22px 부풀린 막 바깥을 테두리에서 채우고, 그 나머지를 30px 깎아 몸 안으로 본다
big = np.where(sizes > 20000)[0]
bar = np.array(Image.fromarray((np.isin(lab, big) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(45))) > 0
outside = np.zeros((H, W), bool); q = deque()
for x in range(W):
    for y in (0, H - 1):
        if not bar[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if not bar[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
while q:
    cy, cx = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = cy + dy, cx + dx
        if 0 <= ny < H and 0 <= nx < W and not bar[ny, nx] and not outside[ny, nx]:
            outside[ny, nx] = True; q.append((ny, nx))
inner = np.array(Image.fromarray((~outside * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(61))) > 0

# 배율·기준: 흰 행 최대 폭, 그 행의 가운데, 몸 아래 끝
best = (0, 0, 0)
for y in range(0, H, 2):
    run, x0 = 0, -1
    for x in range(W):
        if white[y, x]:
            if x0 < 0: x0 = x
            if x - x0 + 1 > best[0]: best = (x - x0 + 1, x0, y)
        else: x0 = -1
k = BODY_W / (best[0] * 1.06)
cx_ref = best[1] + best[0] / 2
foot_ref = int(np.where(np.isin(lab, big).any(1))[0].max())
G = lambda x, y: (200 + (x - cx_ref) * k, FOOT_Y - (foot_ref - y) * k)

marks = []
for cid in range(1, len(sizes)):
    n = sizes[cid]
    if n > 20000 or n < 60: continue
    yy, xx = np.where(lab == cid)
    mx, my = xx.mean(), yy.mean()
    if inner[int(my), int(mx)]: continue
    span = max(np.ptp(xx), np.ptp(yy))
    if n < 400 and span < 30:
        marks.append({'kind': 'dot', 'c': G(mx, my), 'ref': (mx, my)}); continue
    P = np.stack([xx, yy], 1).astype(float); m = P.mean(0)
    ax = np.linalg.svd(P - m, full_matrices=False)[2][0]
    t = (P - m) @ ax
    nb = max(4, int(round(span / 11)))
    edges = np.linspace(t.min(), t.max(), nb + 1)
    pts = [G(*P[(t >= edges[b]) & (t <= edges[b + 1])].mean(0)) for b in range(nb) if ((t >= edges[b]) & (t <= edges[b + 1])).any()]
    marks.append({'kind': 'squiggle', 'pts': pts, 'c': G(mx, my), 'ref': (mx, my)})
# 우리 몸에 맞춰 다시 놓기: 표시마다 레퍼런스에서 몸 윤곽까지의 간격(몸 중심에서 바깥 방향)을 재고,
# 우리 failed 실루엣(떨림 표시를 끈 렌더)의 같은 방향 윤곽에서 MIN_GAP + 0.8 × 레퍼런스 간격만큼 떨어뜨려 옮긴다.
MIN_GAP = 5  # 셀 크기에서 윤곽선과 붙어 보이지 않도록 레퍼런스 간격(1~7)에 더하는 기본 간격
import os; DEBUG = os.environ.get('DEBUG')
POSE_SCALE, PIVOT = np.array([1.02, 0.98]), np.array([200.0, 362.0])  # poses.mjs failed의 몸 변형
sil_png = ROOT / 'build/failed-silhouette.png'
sil_png.parent.mkdir(exist_ok=True)
subprocess.run(['node', '-e', f"""
const b = await import('./build.mjs'); const {{ framePose }} = await import('./src/poses.mjs');
const sharp = (await import('sharp')).default;
const p = framePose('failed', 0); p.show = p.show.filter((id) => !id.startsWith('tremble'));
const svg = b.frameSvg(p).replace('width="192" height="208"', 'width="384" height="416"');
await sharp(Buffer.from(svg)).png().toFile({json.dumps(str(sil_png))});
"""], cwd=ROOT, check=True, shell=False)
sil = np.array(Image.open(sil_png).convert('RGBA'))[..., 3] > 40
to_post = lambda c: PIVOT + (np.asarray(c) - PIVOT) * POSE_SCALE
def edge_r(mask, c, u, to_px, limit):
    last = 0
    for r in np.arange(0, limit, 0.5):
        x, y = to_px(c + u * r)
        if 0 <= int(y) < mask.shape[0] and 0 <= int(x) < mask.shape[1] and mask[int(y), int(x)]: last = r
    return last
ref_body = ~outside
c_ref = np.array([cx_ref + (CENTER[0] - 200) / k, foot_ref - (FOOT_Y - CENTER[1]) / k])
c_post = to_post(CENTER)
for m in marks:
    m_ref = np.array(m['ref']); d = m_ref - c_ref; u_ref = d / np.linalg.norm(d)
    gap = (np.linalg.norm(d) - (edge_r(ref_body, c_ref, u_ref, lambda p: p, 1400) - 22)) * k
    post = to_post(m['c']); u = (post - c_post) / np.linalg.norm(post - c_post)
    r_new = edge_r(sil, c_post, u, lambda g: (g[0] - 8, g[1] + 32), 260) + MIN_GAP + 0.8 * max(gap, 0)
    delta = (c_post + u * r_new - post) / POSE_SCALE
    if DEBUG: print(m['kind'], [round(v) for v in m['ref']], 'gap', round(gap, 1), 'old r', round(float(np.linalg.norm(post - c_post)), 1), 'new r', round(float(r_new), 1))
    m['c'] = tuple(np.asarray(m['c']) + delta)
    if m['kind'] == 'squiggle': m['pts'] = [tuple(np.asarray(q) + delta) for q in m['pts']]
# 다리 옆·아래(꼬리 포함)의 표시는 사용자 요청으로 뺀다: 몸 중심(post)이 LEG_Y보다 아래인 표시
LEG_Y = 300
marks = [m for m in marks if to_post(m['c'])[1] <= LEG_Y]

# 귀처럼 가는 부위 옆에서는 방사 방향 윤곽만 보면 표시가 귀·머리선에 겹칠 수 있다.
# 실루엣 전체와의 최단 거리가 CLEAR 이상이 될 때까지 표시를 몸 중심 바깥 방향으로 민다.
CLEAR = SQ_W / 2 + 3.2
yy, xx = np.nonzero(sil[::2, ::2])
sil_pts = np.stack([xx * 2 + 8, yy * 2 - 32], 1).astype(float)  # 2배 셀 px → post 격자
def min_dist(P_pre):
    Q = to_post(np.asarray(P_pre, float).reshape(-1, 2))
    if len(Q) > 1:  # 곡선 사이 중간점도 본다
        Q = np.concatenate([Q, (Q[1:] + Q[:-1]) / 2])
    near = sil_pts[(np.abs(sil_pts[:, 0] - Q[:, 0].mean()) < 60) & (np.abs(sil_pts[:, 1] - Q[:, 1].mean()) < 60)]
    if not len(near): return 1e9
    return float(np.sqrt(((Q[:, None, :] - near[None, :, :]) ** 2).sum(-1)).min())
def push_clear(P_pre, need=None):
    P = np.asarray(P_pre, float).reshape(-1, 2)
    u = to_post(P.mean(0)) - c_post; u /= np.linalg.norm(u)
    step = u / POSE_SCALE * 0.5
    for _ in range(80):
        if min_dist(P) >= (need or CLEAR): break
        P = P + step
    return P
for m in marks:
    if m['kind'] == 'dot':
        m['c'] = tuple(push_clear([m['c']], DOT_R + 3.2)[0])
    else:
        P = push_clear(m['pts']); m['pts'] = [tuple(q) for q in P]; m['c'] = tuple(P.mean(0))
marks.sort(key=lambda m: math.atan2(m['c'][1] - CENTER[1], m['c'][0] - CENTER[0]))

def cr(P):
    d = f"M{P[0][0]:.1f} {P[0][1]:.1f}"
    for i in range(len(P) - 1):
        p0 = P[i - 1] if i else P[i]; p1, p2 = P[i], P[i + 1]; p3 = P[i + 2] if i + 2 < len(P) else P[i + 1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d

def variant(v):
    sq, dots = [], []
    for i, m in enumerate(marks):
        c = np.array(m['c']); r = c - CENTER; r /= np.linalg.norm(r); tg = np.array([-r[1], r[0]])
        out, side = [(0, 0), (3.0, 2.4), (1.6, -3.0)][v]
        off = r * out + tg * side
        if m['kind'] == 'dot':
            if v and i % 3 == v: continue  # 점 일부가 깜박인다
            x, y = push_clear([c + off], DOT_R + 3.2)[0]
            dots.append(f"M{x:.1f} {y:.1f}h0")
            continue
        P = np.array(m['pts']); mc = P.mean(0)
        if v == 1:  # 물결 위상 뒤집기: 양 끝을 잇는 축에 대해 반사
            a, b = P[0], P[-1]; u = (b - a) / (np.linalg.norm(b - a) or 1)
            rel = P - a; P = a + np.outer(rel @ u, u) * 2 - rel
        if v == 2:  # 8° 회전
            th = math.radians(8); R = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
            P = (P - mc) @ R.T + mc
        sq.append(cr([tuple(p) for p in push_clear(P + off)]))
    # 점은 굵기 2·DOT_R인 길이 0 선(둥근 끝)으로 그린다
    return (f'  <g id="tremble-{v}" display="none" stroke-width="{SQ_W}">\n'
            f'    <path d="{"".join(sq)}"/>\n'
            f'    <path stroke-width="{2 * DOT_R}" d="{"".join(dots)}"/>\n'
            f'  </g>')

block = ('<!-- gen:tremble (tools/gen-tremble.py가 생성. 직접 고치지 말 것) -->\n'
         '  <!-- failed 떨림 표시: reference/failed.png의 몸 밖 짧은 물결선·점을 측정해 옮겼다. 몸 뒤 레이어이고 프레임마다 변형 하나만 켠다 -->\n'
         + "\n".join(variant(v) for v in range(3)) + '\n  <!-- /gen:tremble -->')

s = SRC.read_text(encoding='utf-8')
re_block = re.compile(r'<!-- gen:tremble[\s\S]*?<!-- /gen:tremble -->')
if re_block.search(s):
    s = re_block.sub(lambda _: block, s, count=1)
else:
    anchor = '  <!-- 귀: 몸 뒤. 아래쪽은 몸 면에 가려진다 -->'
    assert anchor in s, 'ear anchor not found'
    s = s.replace(anchor, '  ' + block + '\n\n' + anchor, 1)
SRC.write_text(s, encoding='utf-8')
n_sq = sum(m['kind'] == 'squiggle' for m in marks)
print(f'tremble: {n_sq} squiggles, {len(marks) - n_sq} dots, scale {k:.4f}, block {len(block.encode())} B')
