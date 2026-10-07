#!/usr/bin/env bash
# 최종 아틀라스 검증 + 프리뷰. 설치된 work-pets / hatch-pet 스크립트를 수정 없이 실행한다.
#   bash tools/validate.sh            구조·프레임·방향 검증 + 프리뷰
#   bash tools/validate.sh --gate     위 + 최종 품질 게이트(qa/direction-semantics.json 필요)
set -euo pipefail
cd "$(dirname "$0")/.."
W="$HOME/.codex/plugins/cache/openai-curated-remote/work-pets/0.1.6/skills/create-pet/scripts"
H="$HOME/.codex/skills/hatch-pet/scripts"
ATLAS=final/spritesheet.webp
mkdir -p qa build previews

run() { echo "== $*" >&2; "$@"; }

run python "$W/validate_atlas.py" "$ATLAS" --require-v2 --json-out final/validation.json
run python "$W/inspect_frames.py" --frames-root frames --json-out qa/review.json > /dev/null
# 실제 투명 렌더라 크로마 배경이 없다. 초록 키(#00FF00, 치이카와·소품에 없는 색)로 0 강도 정리를 돌려 변경 0을 기록한다.
run python "$W/despill_chroma_edges.py" final/spritesheet.png --output build/despill-check.png \
  --json-out qa/chroma-report.json --chroma-key '#00FF00' --strength 0 > /dev/null
run python "$W/make_contact_sheet.py" "$ATLAS" --output qa/contact-sheet.png
run python "$W/make_direction_qa_sheet.py" "$ATLAS" --output qa/direction-qa.png
run python "$W/measure_direction_continuity.py" "$ATLAS" --json-out qa/look-continuity.json > /dev/null
run python "$H/render_animation_previews.py" --frames-root frames --output-dir build/frame-previews > /dev/null
run python tools/previews.py > previews/preview-manifest.json
FFMPEG=$(node -e "console.log(require('ffmpeg-static'))")
run "$FFMPEG" -loglevel error -y -i previews/all-states.gif -movflags faststart -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" previews/all-states.mp4

if [[ "${1:-}" == "--gate" ]]; then
  run python "$W/validate_pet_quality.py" "$ATLAS" --atlas-validation final/validation.json \
    --chroma-report qa/chroma-report.json --frame-review qa/review.json \
    --direction-semantics qa/direction-semantics.json --continuity qa/look-continuity.json \
    --json-out qa/pet-quality.json
fi
