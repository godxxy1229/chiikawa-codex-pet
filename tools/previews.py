#!/usr/bin/env python3
"""최종 인코딩된 아틀라스(final/spritesheet.webp)에서 검수용 프리뷰를 만든다.

previews/states/<state>.gif   상태별 반복 GIF (네이티브 셀 크기 x2)
previews/all-states.gif       9개 상태를 이어 붙인 GIF, 네이티브 크기 (+ MP4는 validate.sh가 ffmpeg로 변환)
previews/idle-jump-idle.gif   idle → jumping → idle (네이티브 셀 경계, 기준선 확인용)
previews/look-loop.gif        16방향 시선 순서대로, 네이티브 크기
previews/key-frames.png       상태별 대표 프레임 스틸(라벨 포함)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CELL_W, CELL_H = 192, 208
ROWS = [
    ("idle", 0, [280, 110, 110, 140, 140, 320]),
    ("running-right", 1, [120] * 7 + [220]),
    ("running-left", 2, [120] * 7 + [220]),
    ("waving", 3, [140] * 3 + [280]),
    ("jumping", 4, [140] * 4 + [280]),
    ("failed", 5, [140] * 7 + [240]),
    ("waiting", 6, [150] * 5 + [260]),
    ("running", 7, [120] * 5 + [220]),
    ("review", 8, [150] * 5 + [280]),
]
LOOK_LABELS = ["000", "022.5", "045", "067.5", "090", "112.5", "135", "157.5",
               "180", "202.5", "225", "247.5", "270", "292.5", "315", "337.5"]
BG = (244, 244, 246)


def cells(atlas: Image.Image, row: int, count: int) -> list[Image.Image]:
    return [atlas.crop((c * CELL_W, row * CELL_H, (c + 1) * CELL_W, (row + 1) * CELL_H)) for c in range(count)]


def on_bg(cell: Image.Image, scale: int = 2, label: str | None = None) -> Image.Image:
    frame = Image.new("RGB", (CELL_W * scale, CELL_H * scale), BG)
    big = cell.resize((CELL_W * scale, CELL_H * scale), Image.Resampling.LANCZOS)
    frame.paste(big, (0, 0), big)
    if label:
        ImageDraw.Draw(frame).text((8, 6), label, fill=(60, 60, 70), font=ImageFont.load_default())
    return frame


def save_gif(frames: list[Image.Image], durations: list[int], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=False)


def main() -> None:
    atlas_path = ROOT / "final" / "spritesheet.webp"
    with Image.open(atlas_path) as opened:
        atlas = opened.convert("RGBA")
    out = ROOT / "previews"
    report = {"source": str(atlas_path), "previews": []}

    all_frames, all_durations = [], []
    for state, row, durations in ROWS:
        frames = [on_bg(c) for c in cells(atlas, row, len(durations))]
        save_gif(frames, durations, out / "states" / f"{state}.gif")
        report["previews"].append(f"previews/states/{state}.gif")
        labeled = [on_bg(c, scale=1, label=state) for c in cells(atlas, row, len(durations))]
        for _ in range(2):  # 상태마다 두 번 반복
            all_frames += labeled
            all_durations += durations
    save_gif(all_frames, all_durations, out / "all-states.gif")
    report["previews"].append("previews/all-states.gif")

    # idle → jumping → idle: 네이티브 크기, 셀 경계 그대로
    idle = cells(atlas, 0, 6)
    jump = cells(atlas, 4, 5)
    seq = [on_bg(c, scale=1) for c in idle + jump + idle]
    save_gif(seq, ROWS[0][2] + ROWS[4][2] + ROWS[0][2], out / "idle-jump-idle.gif")
    report["previews"].append("previews/idle-jump-idle.gif")

    # 16방향 시선 루프
    look = cells(atlas, 9, 8) + cells(atlas, 10, 8)
    save_gif([on_bg(c, scale=1, label=lbl) for c, lbl in zip(look, LOOK_LABELS)], [200] * 16, out / "look-loop.gif")
    report["previews"].append("previews/look-loop.gif")

    # 대표 프레임 스틸: 상태마다 2장(첫 프레임, 동작이 가장 큰 프레임)
    picks = [("idle", 0, 0), ("idle", 0, 3), ("running-left", 2, 0), ("running-left", 2, 2),
             ("running-right", 1, 2), ("waving", 3, 1), ("waving", 3, 2), ("jumping", 4, 0),
             ("jumping", 4, 2), ("failed", 5, 0), ("failed", 5, 2), ("waiting", 6, 1),
             ("waiting", 6, 2), ("running", 7, 0), ("running", 7, 3), ("review", 8, 0),
             ("review", 8, 3), ("look 000", 9, 0), ("look 090", 9, 4), ("look 180", 10, 0), ("look 270", 10, 4)]
    cols = 7
    sheet = Image.new("RGB", (cols * CELL_W, ((len(picks) + cols - 1) // cols) * CELL_H), BG)
    for n, (name, row, col) in enumerate(picks):
        cell = atlas.crop((col * CELL_W, row * CELL_H, (col + 1) * CELL_W, (row + 1) * CELL_H))
        tile = on_bg(cell, scale=1, label=f"{name} #{col}")
        sheet.paste(tile, ((n % cols) * CELL_W, (n // cols) * CELL_H))
    sheet.save(out / "key-frames.png")
    report["previews"].append("previews/key-frames.png")

    json.dump(report, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
