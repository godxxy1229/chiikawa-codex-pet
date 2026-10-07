#!/usr/bin/env python3
"""reference/idle.png를 측정해 리그 작도용 좌표를 만든다 (400 격자).

- 선(짙은 갈색)은 골격(Zhang-Suen)을 만든 뒤, 선마다 지정한 시작·끝점 사이를
  골격을 따라 최단 경로로 추적해 순서 있는 점열로 기록한다(TRACES).
- 속이 찬 성분(눈)은 외곽과 구멍(하이라이트)을 타원으로, 짧은 선(눈썹·빗금·턱)은
  끝점과 두께로, 홍조는 분홍 영역의 타원으로 기록한다.

  python tools/measure-ref.py   →  qa/ref-landmarks.json, qa/ref-skeleton.png
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "reference/idle.png"

# 격자 변환: 레퍼런스 px × K, 몸 중심 x → 200, 실루엣 아래 끝(발바닥 바깥) → 362
K = 0.28
GRID_CX, GRID_FEET = 200, 362

# 선 추적: 이름 → 레퍼런스 px 기준 [시작, (경유), 끝]. 가까운 골격 픽셀로 붙인다.
TRACES = {
    "ear-l": [(392, 220), (440, 110), (490, 196)],
    "head-top": [(490, 196), (670, 182), (858, 212)],
    "ear-r": [(858, 212), (900, 110), (940, 215)],
    "side-l": [(358, 238), (195, 520), (318, 758)],
    "side-r": [(978, 235), (1140, 520), (1005, 755)],
    "arm-l": [(306, 762), (305, 840), (340, 885), (360, 805)],
    "arm-r": [(975, 810), (1000, 888), (1040, 840), (1032, 773)],
    "body-l": [(362, 888), (380, 1020)],
    "body-r": [(965, 882), (945, 1020)],
    "leg-l": [(380, 1020), (410, 1112), (440, 1030)],
    "leg-r": [(890, 1030), (915, 1112), (945, 1020)],
    "bottom": [(440, 1025), (660, 1048), (890, 1025)],
    "mouth-l": [(600, 585), (630, 605), (662, 594)],
    "mouth-r": [(662, 594), (695, 605), (725, 585)],
    "mouth-stem": [(662, 594), (662, 568)],
}


def zhang_suen(mask: np.ndarray) -> np.ndarray:
    img = np.pad((mask > 0).astype(np.uint8), 1)
    while True:
        changed = False
        for step in (0, 1):
            p2 = np.roll(img, 1, 0); p3 = np.roll(p2, -1, 1)
            p4 = np.roll(img, -1, 1); p6 = np.roll(img, -1, 0)
            p5 = np.roll(p6, -1, 1); p7 = np.roll(p6, 1, 1)
            p8 = np.roll(img, 1, 1); p9 = np.roll(p2, 1, 1)
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            b = sum(nb)
            seq = nb + [p2]
            a = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            c = ((p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)) if step == 0 else ((p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0))
            rm = (img == 1) & (b >= 2) & (b <= 6) & (a == 1) & c
            if rm.any():
                img[rm] = 0
                changed = True
        if not changed:
            return img[1:-1, 1:-1]


def bfs_path(pts: set, a, b):
    prev = {a: None}
    q = deque([a])
    while q:
        p = q.popleft()
        if p == b:
            break
        y, x = p
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                n = (y + dy, x + dx)
                if (dy or dx) and n in pts and n not in prev:
                    prev[n] = p
                    q.append(n)
    if b not in prev:
        raise RuntimeError(f"no skeleton path {a} → {b}")
    path = [b]
    while prev[path[-1]] is not None:
        path.append(prev[path[-1]])
    return path[::-1]


def longest_path(pts: set):
    def far(src):
        prev = {src: None}
        q = deque([src])
        last = src
        while q:
            p = q.popleft(); last = p
            y, x = p
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    n = (y + dy, x + dx)
                    if (dy or dx) and n in pts and n not in prev:
                        prev[n] = p
                        q.append(n)
        path = [last]
        while prev[path[-1]] is not None:
            path.append(prev[path[-1]])
        return path
    a = far(next(iter(pts)))[0]
    return far(a)


def main():
    import sys
    args = sys.argv[1:]
    src = Path(args[args.index("--image") + 1]) if "--image" in args else REF
    out_path = Path(args[args.index("--out") + 1]) if "--out" in args else ROOT / "qa/ref-landmarks.json"
    rgba = np.array(Image.open(src).convert("RGBA")).astype(int)
    alpha, rgb = rgba[..., 3], rgba[..., :3]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    dark = ((alpha > 128) & (lum < 120)).astype(np.uint8)
    pink = ((alpha > 128) & (rgb[..., 0] > 225) & (rgb[..., 1] < 215) & (rgb[..., 1] > 140)).astype(np.uint8)

    ra = np.array(Image.open(REF).convert("RGBA"))[..., 3]
    ys, xs = np.where(ra > 128)
    ref_cx, ref_feet = (xs.min() + xs.max()) / 2, int(ys.max())
    g = lambda x, y: [round((x - ref_cx) * K + GRID_CX, 2), round((y - ref_feet) * K + GRID_FEET, 2)]

    dist = cv2.distanceTransform(dark, cv2.DIST_L2, 5)
    skel = zhang_suen(dark)
    sk_yx = np.argwhere(skel > 0)
    sk_set = set(map(tuple, sk_yx))

    def snap(x, y):
        i = np.argmin((sk_yx[:, 0] - y) ** 2 + (sk_yx[:, 1] - x) ** 2)
        return tuple(sk_yx[i])

    traces = {}
    for name, anchors in (TRACES.items() if src == REF else []):
        snapped = [snap(x, y) for x, y in anchors]
        path = []
        for a, b in zip(snapped, snapped[1:]):
            seg = bfs_path(sk_set, a, b)
            path += seg if not path else seg[1:]
        widths = [dist[y, x] * 2 for y, x in path]
        traces[name] = {
            "points": [g(x, y) for y, x in path[:: max(1, len(path) // 80)]] + [g(path[-1][1], path[-1][0])],
            "width_grid": round(float(np.median(widths)) * K, 2),
        }

    # 얼굴: 눈(구멍 있는 덩어리), 짧은 선(눈썹·빗금·턱)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
    eyes, shorts = [], []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 150 or y < 300 or y > 700 or (w > 300 or h > 300):
            continue
        m = (labels == i).astype(np.uint8)
        cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        holes = [c for c, hh in zip(cnts, hier[0]) if hh[3] >= 0 and cv2.contourArea(c) > 200]
        if holes:
            (ex, ey), (ea, eb), ang = cv2.fitEllipse(max(cnts, key=cv2.contourArea))
            hl = []
            for hc in holes:
                (hx, hy), (ha, hb), hang = cv2.fitEllipse(hc)
                hl.append({"c": g(hx, hy), "rx": round(ha / 2 * K, 2), "ry": round(hb / 2 * K, 2), "angle": round(hang, 1)})
            eyes.append({"c": g(ex, ey), "rx": round(ea / 2 * K, 2), "ry": round(eb / 2 * K, 2), "angle": round(ang, 1),
                         "holes": sorted(hl, key=lambda h: h["c"][1])})
            continue
        spts = set(map(tuple, np.argwhere((skel & m) > 0)))
        if not spts or any(p in spts for t in ("mouth-l",) for p in []):
            continue
        path = longest_path(spts)
        if path[0][1] > path[-1][1]:
            path = path[::-1]
        widths = [dist[yy, xx] * 2 for yy, xx in path]
        mid = path[len(path) // 2]
        shorts.append({"a": g(path[0][1], path[0][0]), "mid": g(mid[1], mid[0]), "b": g(path[-1][1], path[-1][0]),
                       "width_grid": round(float(np.median(widths)) * K, 2), "len_px": len(path)})

    blush = []
    closed = cv2.morphologyEx(pink, cv2.MORPH_CLOSE, np.ones((41, 41), np.uint8))
    pn, plab, pstats, _ = cv2.connectedComponentsWithStats(closed, 8)
    for i in range(1, pn):
        if pstats[i][4] < 2000:
            continue
        cnts, _ = cv2.findContours((plab == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        (bx, by), (ba, bb), bang = cv2.fitEllipse(max(cnts, key=cv2.contourArea))
        blush.append({"c": g(bx, by), "rx": round(max(ba, bb) / 2 * K, 2), "ry": round(min(ba, bb) / 2 * K, 2)})

    sil = (alpha > 128).astype(np.uint8)
    cnts, _ = cv2.findContours(sil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    outer = max(cnts, key=cv2.contourArea)[:, 0, :]
    silhouette = [g(px, py) for px, py in outer[:: max(1, len(outer) // 300)]]

    out = {
        "source": "reference/idle.png",
        "transform": {"k": K, "ref_center_x": ref_cx, "ref_feet_y": ref_feet, "grid_center_x": GRID_CX, "grid_feet_y": GRID_FEET},
        "palette": {
            "line": "#%02x%02x%02x" % tuple(int(v) for v in np.median(rgb[(alpha > 200) & (lum < 80)], 0)),
            "blush": "#%02x%02x%02x" % tuple(int(v) for v in np.median(rgb[pink > 0], 0)),
            "white": "#%02x%02x%02x" % tuple(int(v) for v in np.median(rgb[(alpha > 200) & (lum > 240)], 0)),
        },
        "traces": traces,
        "eyes": sorted(eyes, key=lambda e: e["c"][0]),
        "shorts": sorted(shorts, key=lambda s: (round(s["mid"][1] / 15), s["mid"][0])),
        "blush": sorted(blush, key=lambda b: b["c"][0]),
        "silhouette": silhouette,
    }
    if src != REF:  # 리그 렌더 측정: 레퍼런스와 같은 격자 변환을 쓰고 선 추적은 생략
        out = {"eyes": out["eyes"], "blush": out["blush"]}
        out_path.write_text(json.dumps(out, indent=1), encoding="utf-8")
        return
    (ROOT / "qa").mkdir(exist_ok=True)
    out_path.write_text(json.dumps(out, indent=1), encoding="utf-8")

    vis = np.full((*dark.shape, 3), 255, np.uint8)
    vis[dark > 0] = (205, 205, 205)
    vis[pink > 0] = (255, 222, 230)
    vis[skel > 0] = (150, 150, 150)
    colors = [(220, 0, 0), (0, 140, 0), (0, 0, 220), (200, 120, 0), (150, 0, 150), (0, 150, 150)]
    for k, (name, t) in enumerate(traces.items()):
        pts = np.array([[(x - GRID_CX) / K + ref_cx, (y - GRID_FEET) / K + ref_feet] for x, y in t["points"]], np.int32)
        cv2.polylines(vis, [pts], False, colors[k % len(colors)], 3)
        cv2.putText(vis, name, tuple(int(v) + 8 for v in pts[len(pts) // 2]), cv2.FONT_HERSHEY_SIMPLEX, 0.7, colors[k % len(colors)], 2)
    Image.fromarray(vis).save(ROOT / "qa/ref-skeleton.png")
    print(json.dumps({"palette": out["palette"], "eyes": len(eyes), "shorts": len(shorts), "blush": blush,
                      "widths": {k: v["width_grid"] for k, v in traces.items()}}, indent=1))


if __name__ == "__main__":
    main()
