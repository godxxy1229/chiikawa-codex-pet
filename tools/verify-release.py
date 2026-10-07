#!/usr/bin/env python3
"""Check the public package and retained blind review without private references."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
COUNTS = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]
LABELS = ['000', '022.5', '045', '067.5', '090', '112.5', '135', '157.5',
          '180', '202.5', '225', '247.5', '270', '292.5', '315', '337.5']

def load(path):
    with Image.open(path) as image:
        return image.convert('RGBA')

def cell(image, row, col):
    return image.crop((col * 192, row * 208, (col + 1) * 192, (row + 1) * 208))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path)
    parser.add_argument('--native-dir', type=Path)
    args = parser.parse_args()
    canonical_path = ROOT / 'final/spritesheet.webp'
    public_path = ROOT / 'package/spritesheet.webp'
    canonical, public = load(canonical_path), load(public_path)
    assert canonical.size == public.size == (1536, 2288)
    assert load(ROOT / 'final/spritesheet.png').tobytes() == canonical.tobytes()
    assert cell(public, 0, 6).tobytes() == cell(canonical, 0, 0).tobytes()
    occupied = 0
    for row, count in enumerate(COUNTS):
        for col in range(8):
            a, b = cell(canonical, row, col), cell(public, row, col)
            if col < count:
                assert a.tobytes() == b.tobytes(), (row, col)
                assert b.getchannel('A').getbbox() is not None
                occupied += 1
            elif (row, col) != (0, 6):
                assert not any(a.tobytes()) and not any(b.tobytes()), (row, col)
    assert occupied == 73
    assert all(r == g == b == 0 for r, g, b, a in public.getdata() if a == 0)
    manifest = json.loads((ROOT / 'package/pet.json').read_text())
    assert manifest == {
        'id': 'chiikawa-svg', 'displayName': 'Chiikawa',
        'description': 'An unofficial Chiikawa companion for Codex. https://github.com/godxxy1229/chiikawa-codex-pet',
        'spritesheetPath': 'spritesheet.webp', 'spriteVersionNumber': 2, 'kind': 'creature',
    }

    # The stored sheet fixes the original A/B order; every look direction is represented.
    key = json.loads((ROOT / 'qa/blind-answer-key.json').read_text())
    reviewed = load(ROOT / 'qa/blind-sheet.png').convert('RGB')
    checked, seen = 0, set()
    for n, pair in enumerate(key['pairs']):
        for col, side in enumerate(['A', 'B']):
            label = pair[side]['source_direction']
            i = LABELS.index(label)
            frame = cell(canonical, 9 + i // 8, i % 8)
            background = Image.new('RGBA', (192, 208), (242, 242, 242, 255))
            expected = Image.alpha_composite(background, frame).convert('RGB')
            actual = reviewed.crop((col * 192, n * 236 + 28, (col + 1) * 192, n * 236 + 236))
            assert actual.tobytes() == expected.tobytes(), label
            checked += 1
            seen.add(label)
    assert len(seen) == 16
    assert json.loads((ROOT / 'qa/blind-validation.json').read_text())['ok']
    report = {
        'ok': True, 'canonical_sha256': sha(canonical_path), 'public_sha256': sha(public_path),
        'dimensions': [1536, 2288], 'animation_cells': occupied, 'neutral_cell': [0, 6],
        'all_animation_cells_rgba_equal': True, 'unused_public_cells_fully_transparent': 14,
        'transparent_rgb_residue_pixels': 0, 'english_manifest_valid': True,
        'blind_review_reused': True, 'blind_sheet_cells_compared': checked,
        'all_16_directions_match_reviewed_images': True,
    }
    if args.baseline:
        assert canonical.tobytes() == load(args.baseline / 'final/spritesheet.webp').tobytes()
        assert (ROOT / 'src/poses.mjs').read_bytes() == (args.baseline / 'src/poses.mjs').read_bytes()
        report.update(original_73_frames_preserved=True, source_poses_and_preview_timings_preserved=True)
    if args.native_dir:
        assert (args.native_dir / 'spritesheet.webp').read_bytes() == canonical_path.read_bytes()
        if args.baseline:
            assert (args.native_dir / 'pet.json').read_bytes() == (args.baseline / 'native-installed/pet.json').read_bytes()
        report.update(native_sheet_unchanged=True, native_manifest_unchanged=True)
    (ROOT / 'qa/release-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
