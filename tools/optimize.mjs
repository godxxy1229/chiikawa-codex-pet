// source/chiikawa.svg(사람이 읽는 원본) → src/chiikawa-rig.svg(경량 리그)
// id·display="none" 파츠·<use> 참조는 유지하고, 주석 제거·경로 상대 명령·소수 첫째 자리로 줄인다.
//   node tools/optimize.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'source/chiikawa.svg'), 'utf8');

const { data } = optimize(src, {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false, // 포즈가 id로 파츠를 찾는다
          removeHiddenElems: false, // display="none" 파츠는 포즈가 켠다
          collapseGroups: false, // id 없는 그룹의 상속 속성도 유지
          moveElemsAttrsToGroup: false,
          moveGroupAttrsToElems: false,
          convertShapeToPath: false, // ellipse가 더 짧다
          mergePaths: false, // 선 조각마다 끝 모양이 다르다
          removeUselessStrokeAndFill: false,
          // <defs> 안 파츠의 stroke="none"은 <use>로 쓸 때 상속을 막는 값이라 기본값이어도 남긴다
          removeUnknownsAndDefaults: { defaultAttrs: false },
          inlineStyles: false,
          minifyStyles: false,
          convertPathData: { floatPrecision: 1, transformPrecision: 3 },
        },
      },
    },
  ],
});

// svgo가 xlink:href를 href로 바꿨는지 확인(librsvg는 둘 다 지원). 필요 없는 xlink 선언 제거.
const rig = data.replace(/ xmlns:xlink="[^"]*"/, '');
fs.writeFileSync(path.join(root, 'src/chiikawa-rig.svg'), rig);
console.log(`source ${Buffer.byteLength(src)} B → rig ${Buffer.byteLength(rig)} B`);
