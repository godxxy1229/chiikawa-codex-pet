# Build

Requires Node.js 20 or newer.

```bash
npm ci
npm run build
npm run package
npm run check
```

The build uses `src/chiikawa-rig.svg` and `src/poses.mjs` to render all 73 frames. It produces
`final/spritesheet.png` and a lossless `final/spritesheet.webp` (1536×2288, 192×208 cells).
No reference images are needed. Frame counts, pose order and preview durations are defined in `ROWS`.

`npm run package` preserves all animation pixels and adds the community site's neutral pose
at row 0, column 6, copied from Idle's first frame. It writes `package/pet.json`,
`package/spritesheet.webp` and `qa/community-package.json`. The canonical sheet keeps its 15 unused cells transparent.

To edit the original rig, change `source/chiikawa.svg`, then run `npm run optimize` before building.
The reference measurement and comparison tools are optional local authoring tools; their reference
images are intentionally excluded from this repository. Generated geometry is already present in the SVG.

## Verification and previews

`npm run check` checks body holes, outline edges, cell clipping and tear placement.
`python tools/previews.py` generates GIFs and key frames from the final encoded sheet (requires Pillow).

The complete validation workflow, `bash tools/validate.sh --gate`, additionally requires Python/Pillow,
the `work-pets` 0.1.6 validator scripts and the `hatch-pet` preview script at the paths specified in
`tools/validate.sh`. Reports in `final/validation.json` and `qa/` document the published build.
These optional validation dependencies are separate from building or installing the pet.

`python tools/verify-release.py` checks all 73 public animation cells, the neutral pose, the English
manifest and the pixel match to the retained blind-review sheet. It writes `qa/release-verification.json`.

The 16 look directions retain the existing three-reviewer blind review when their pixels are unchanged.
Changes to these directions require a new review as described in [AGENTS.md](../AGENTS.md).

See [design notes (Korean)](BUILD.ko.md) and the [artwork notice](../ARTWORK-NOTICE.txt).
