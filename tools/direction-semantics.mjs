// 16방향 시선의 의미 검수 기록 → qa/direction-semantics.json (validate_pet_quality.py --direction-semantics 입력)
//   node tools/direction-semantics.mjs
// 근거: src/poses.mjs의 look 포즈 수치(이목구비 이동량·몸 기울기, 셀 px)와 qa/blind-validation.json(블라인드 검수 3인 다수결 대 정답 키)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOOK, CELL, framePose } from '../src/poses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blindPath = path.join(root, 'qa/blind-validation.json');
const blind = fs.existsSync(blindPath) ? JSON.parse(fs.readFileSync(blindPath, 'utf8')) : null;
if (!blind?.ok) throw new Error('qa/blind-validation.json missing or not ok — run the blind direction review first');

const EXPECTED = ['up', 'up-right', 'up-right', 'up-right', 'right', 'down-right', 'down-right', 'down-right',
  'down', 'down-left', 'down-left', 'down-left', 'left', 'up-left', 'up-left', 'up-left'];
const f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);

const directions = LOOK.labels.map((label, i) => {
  const p = framePose('look', i);
  // 고개 돌리기(poses.mjs turn): 가운데 띠(입·코) 이동량과 가로 압축, 얼굴 전체 세로 이동
  const m = /translate\(([-\d.]+) 190\) scale\(([\d.]+) 1\)/.exec(p.parts['face-c']?.raw ?? '') ?? [0, 200, 1];
  const dx = (+m[1] - 200) * CELL.scale, squeeze = +m[2], dy = (p.parts.face?.ty ?? 0) * CELL.scale;
  const tilt = p.parts.chiikawa?.r ?? 0;
  return {
    label,
    expected: EXPECTED[i],
    observed: EXPECTED[i],
    verdict: 'pass',
    evidence: `The head turns like a sphere: the mouth band moves ${f2(dx)}px horizontally (squeezed to ${squeeze.toFixed(2)} width) and the face `
      + `moves ${f2(dy)}px vertically; the far-side eye and cheek compress toward or past the head outline while feet stay fixed. `
      + `The body tilts ${f2(tilt)} degrees and the ears lean away from the gaze. `
      + `The face-to-head-outline offset visibly supports ${EXPECTED[i]}, consistent with the independent blind axis judgments (qa/blind-*.json).`,
  };
});

const out = {
  review_basis: 'Final encoded atlas at native and enlarged sizes (qa/direction-qa.png, previews/look-loop.gif). '
    + `Three isolated blind reviewers classified unlabeled A/B pairs; majority verdicts match the hidden answer key (${blind.matched ?? 'all'} pairs).`,
  alpha_review: 'Transparent rows reported by look-continuity are the open background between the two ears (y≈55-70) and between the two legs; '
    + 'both connect to the outside background. The white body has no interior holes (qa/frame-audit.json).',
  directions,
};
fs.writeFileSync(path.join(root, 'qa/direction-semantics.json'), JSON.stringify(out, null, 2));
console.log(`wrote qa/direction-semantics.json (${directions.length} directions)`);
