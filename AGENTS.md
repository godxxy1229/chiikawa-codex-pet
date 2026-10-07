# chiikawa-svg 인계 안내 (에이전트용)

**이 프로젝트는?** 치이카와를 **SVG만으로** 다시 그려 Codex 펫(Pets v2 스프라이트 시트)으로 만든 작업입니다. 이미지 생성 도구는 쓰지 않습니다. 원본 벡터가 없어서 `reference/`의 래스터를 측정해 리그를 새로 작도했습니다.

상세 규격·리그·연출은 [docs/BUILD.ko.md](docs/BUILD.ko.md)에 있습니다. 이 문서는 "어디부터 보고, 어떻게 고치고, 무엇을 지켜야 하는지"만 정리합니다.

## 1. 먼저 읽을 파일 (순서대로)

1. [docs/BUILD.ko.md](docs/BUILD.ko.md): 규격(1536×2288, 8×11, 73프레임), 리그 구조, 상태별 연출, 알려진 한계
2. [src/poses.mjs](src/poses.mjs): **대부분의 수정은 여기서 합니다.**
   - `CELL`: 셀 배치(배율 0.5, 몸 중심 x 200 → 셀 96, 실루엣 아래 y 362 → 셀 197)
   - `PIVOTS`: 부위별 회전 기준점
   - `ROWS`: 행·프레임 수·시간
   - `STATES`: 상태별 포즈 함수. `expr()`로 표정을, `placeWeapon()`으로 토벌창 위치를 정합니다
3. [source/chiikawa.svg](source/chiikawa.svg): 사람이 읽는 리그 원본(400 격자, 주석 포함). 몸·얼굴·책·쥔 손(grip-l·grip-r·grip-run-l)·앞발(paw-r)은 여기서 직접 고칩니다
   - 얼굴 파츠는 `<defs>`의 `face-art` 안에 있고 `face-l`·`face-c`·`face-r` 띠 사본으로 그립니다. 띠 경계를 넘는 파츠를 만들거나 파츠를 옆으로 밀지 마세요(띠 사이 이음매가 생김).
   - 선 색은 `#000`입니다(사용자 선택).
4. [tools/gen-props.mjs](tools/gen-props.mjs): 토벌창(자루·C 포크·가시)을 계산해 원본의 `gen:weapon-defs`(그림 정의: waiting용 `weapon-art`, 자루가 짧은 running용 `weapon-run-art`)·`gen:weapon`(인스턴스 `weapon`·`weapon-run`) 구간을 다시 씁니다. **토벌창은 원본에서 직접 고치지 마세요**
5. [tools/optimize.mjs](tools/optimize.mjs): 원본 → [src/chiikawa-rig.svg](src/chiikawa-rig.svg) 경량화(svgo)
6. [build.mjs](build.mjs): 리그 + 포즈 → 프레임 PNG → 아틀라스 PNG/WebP. 팔을 숨기거나 6° 넘게 돌리면 팔 소켓 윗선을 자동으로 켭니다

## 2. 수정 → 검증 → 설치 흐름

```bash
cd chiikawa-svg
node tools/gen-props.mjs        # 토벌창을 바꿨을 때만
python tools/gen-tremble.py     # failed 떨림 표시(몸 윤곽이나 failed 몸 변형을 바꿨을 때)
node tools/gen-arms.mjs         # 붙은 팔(몸 외곽선이나 ARM_DEGS를 바꿨을 때)
node tools/gen-side.mjs         # 옆모습 몸(running-left/right, poses.mjs의 SIDE·PAW_DEGS를 바꿨을 때)
node tools/optimize.mjs         # 원본(source/chiikawa.svg)을 바꿨을 때
node build.mjs running          # 특정 상태만 빠르게 렌더 → qa/strips/running.png
node tools/ref-sheets.mjs running   # 레퍼런스와 나란히 비교 → qa/ref-compare/running.png
node build.mjs                  # 전체 렌더 + final/ 아틀라스(파일이 잠깐 잠겨 있으면 저장을 몇 번 다시 시도)
node tools/audit-frames.mjs     # 자체 점검(구멍·선 없는 흰 가장자리·셀 가장자리·눈물 위치)
bash tools/validate.sh --gate   # 공식 검증 + 프리뷰 + 품질 게이트
```

- 기본 작도를 바꾸면 `python tools/measure-ref.py` → `node tools/compare-ref.mjs`로 idle 레퍼런스와 다시 비교합니다(실루엣 IoU ≥ 0.95, 눈·홍조·귀 오차 ≤ 2px).
- 확대 확인은 `.scratch/`에 임시 스크립트를 두고 3~8배로 잘라 밝은·어두운 배경 모두 봅니다.

**블라인드 방향 검수** (look 행이 바뀌면 매번, doro와 같은 절차)
1. `make_direction_blind_qa_sheet.py`로 시트를 만들고, **정답 키는 스크래치패드 등 프로젝트 밖에** 둡니다.
2. 시트를 4조각으로 잘라 `build/blind/`에 둡니다.
3. 서로 격리된 검수 서브에이전트 3명에게 조각 이미지만 보여 주고 판정하게 합니다.
4. `combine_direction_blind_verdicts.py` → `validate_direction_blind_verdicts.py`로 정답 키와 비교합니다. 결과는 `qa/blind-*.json`입니다.
5. 끝나면 정답 키를 `qa/`로 복사하고 `node tools/direction-semantics.mjs`로 게이트 입력을 만듭니다.

**설치·공개**: 기존 로컬 설치는 `~/.codex/pets/chiikawa/`의 `pet.json`과 `final/spritesheet.webp`를 유지합니다. 사용자의 공개 게시 요청(2026-10-07)에 따라 GitHub `godxxy1229/chiikawa-codex-pet`과 codex-pets `chiikawa-svg`에 게시합니다. Nagano 저작자·비공식 프로젝트 고지는 [ARTWORK-NOTICE.txt](ARTWORK-NOTICE.txt)에 유지합니다.

- 일반 재현 빌드는 공개 SVG와 포즈만 사용합니다: `npm ci` → `npm run build` → `npm run package`. [영어 빌드 안내](docs/BUILD.md)를 참조하세요.
- `reference/`와 레퍼런스를 포함한 비교 이미지는 로컬 전용이며 공개하지 않습니다. 측정·비교·떨림 표시 재생성은 해당 비공개 레퍼런스가 있을 때만 실행합니다.
- `final/`은 73셀·15투명 셀의 기준 시트입니다. `package/`는 모든 73셀을 그대로 유지하고 row0/col6에 Idle0을 복사한 사이트용 neutral 셀과 영어 `pet.json`을 둡니다. `node tools/community-package.mjs`가 무손실·픽셀 동일성을 검사합니다.
- 공개 README는 짧은 영어 설명, GIF, Codex Pets 버튼, CLI·curl 설치 방법을 유지합니다. 게시 후 공개 ZIP·격리된 시험 설치를 검사하고 `qa/community-publication.json`과 `qa/installation-audit.json`에 결과를 기록합니다. 기존 로컬 설명·활성 설정은 변경하지 않습니다.

## 3. 사용자 연출 지침 (반드시 지킬 것)

- **동작은 크게**: 프레임이 적으므로 크게 움직이고, 대신 리그를 보강해 틈을 막습니다.
- **눈썹은 가늘게**: 굵기 4(failed 3.4), 몸 선의 약 0.55배(비교 프로젝트 기준, 사용자 요청). 뜬 눈(`#eye`)의 아래 하이라이트도 비교 프로젝트처럼 얇은 띠(높이는 눈의 약 14%)로 둡니다.
- **표정은 레퍼런스대로**: waving·jumping은 웃는 감은 눈(얕은 호)과 벌린 입 아래 선(`chin-open`), failed는 failed.png를 측정한 전용 표정(`brows-cry`·`eyes-cry`·`tears-cry`(failed.png처럼 눈 바깥 아래에서 시작하는 물결선 + 흰 안쪽, 굵기 3.5, 홍조 −6/+10)·`mouth-cry`), waiting은 결의 눈썹, running은 우는 결의 얼굴(running_frame1·4처럼 눈 바깥 아래에서 시작하는 얇은 열린 물결선 눈물 `tear-l`·`tear-r`(굵기 3.5, 코 쪽으로 옮기면 레퍼런스와 달라진다는 지적), 홍조는 running에서 ±10 바깥으로, ω 윗입술(양 끝이 코 높이까지 솟음) 가운데에 둥근 코, ω의 두 골에서 내려온 둥근 그릇 입 `mouth-charge`, 입 안은 분홍으로 꽉 채움(`tongue`), 턱 선 `chin-charge`. 사용자 스케치 기준, 크기는 0.88배. 입 양 끝은 얼굴 가운데 띠 경계 안(y ≥ 204, x ≥ 176.6)에 둡니다), review는 찌푸린 물결 눈썹입니다. doro 전용 규칙(눈을 감지 않음, `:3` 입 고정)은 적용하지 않습니다.
- **running = 토벌, 사용자 자세 사진처럼**: 달리지 않습니다. `reference/running_pose.webp`(사용자 제공)처럼 창을 몸 앞에 가로로 들고 **손이 몸에 붙어 있게** 합니다: 왼손은 몸 외곽선이 둥글게 불룩해진 손(`grip-run-l`), 오른손은 몸 앞 자루 위 둥근 앞발(`paw-r`), 포크는 오른쪽. 앞뒤로 흔들며 한 번 찌릅니다(준비 → 당김 → 찌름 → 버팀 → 복귀). 몸 기울기와 왼손을 축으로 한 창 각도(`tilt`)로 움직입니다. 이전 지적: 한 팔로 쥐고 창 뒤를 숨긴 버전은 "찌르는 느낌이 아니다", 몸 앞으로 뻗은 팔·손가락선은 "손가락 구현은 제거하고 팔은 짧게", 몸 옆에서 나온 짧은 팔은 "팔과 몸통이 제대로 연결되지 않았다". 포크가 얼굴을 가리면 안 되고, 속도선·잔상은 펫 규칙상 그리지 않습니다. 몸 위치·기울기·창 각도는 `running()`의 표(`K`: `bx`, `r`, `tilt`)에서 고칩니다.
- **failed = 몸 고정 + 떨림 표시**: 고개를 까딱이거나 몸을 흔들지 않습니다(사용자 지정). 몸 주위의 짧은 물결선·점(`tremble-0~2`, `tools/gen-tremble.py`가 failed.png에서 측정해 생성)만 프레임마다 바꿔 떨게 합니다. 다리 옆·아래에는 두지 않고(사용자 요청), 귀 주변 표시는 귀·머리선과 겹치지 않게 띄웁니다. 분리된 효과지만 사용자가 레퍼런스대로 요청했습니다. 떨림 표시는 생성 구간이라 원본에서 직접 고치지 마세요.
- **jumping 높이**: 0% → 75~80% → 100% → 75~80% → 0%(사용자 지정, 지금 0·36·46·36·0px). 착지 프레임은 충격을 흡수하듯 상체가 아래로 눌려야 합니다.
- **review 책장 넘김은 3프레임 이상**(사용자 지정): 들림 → 서서 넘어감 → 내려앉음(`page-turn-1~3`), 1부터 세어 3·4·5번째 프레임입니다. 긴 마지막 프레임(280ms)에는 넘김을 두지 않습니다(넘기는 도중 멈춘 듯 보임). 책장이 얼굴(입·턱)을 가리지 않게 합니다.
- **달리기(running-left/right)는 옆모습 몸 + 대각 교차**: 비교 프로젝트처럼 몸통을 옆으로 돌려 둥근 몸 아래 가운데의 짧은 두 발로 달립니다(사용자 지정, 정면 몸 양 끝의 다리는 어색하다는 지적). 정면 몸·다리·팔을 끄고 `tools/gen-side.mjs`가 만든 옆모습 몸(`body-side-*`, `foot-f`·`foot-b`, `paw-f-φ`·`paw-b-φ`, 작은 꼬리 `tail-side`)을 켭니다. 꼬리는 비교 프로젝트처럼 대부분 몸 뒤에 숨기고 작은 반달만 보이게 합니다(크게 튀어나오면 발·뒷발과 헷갈린다는 지적). 두 발이 같은 방향으로 함께 움직이면 이동하는 느낌이 나지 않는다는 지적을 받았습니다. 두 발은 서로 엇갈리고, 앞발·뒷발은 가까운 발과 반대로 흔듭니다. 발은 몸 면 뒤라 앞뒤로 옮겨도 되지만 발 구간 몸 밑선(`side-hip`)·들인 몸 면 구조를 깨지 마세요. 아랫몸은 둥근 U자로 유지합니다(사선 + 평평한 바닥은 "다리 양옆이 각져 보인다"는 지적). `gen-side.mjs`의 `LOWER` 점을 고치면 점 간격을 고르게 두고 곡률이 급하게 바뀌지 않는지 확대해 확인하세요.
- **waving은 한 바퀴에 한 번 흔들기**(사용자 지정): 올라감 → 꼭대기 → 내려옴 → 아래에서 쉼. 두 번 흔들지 않습니다. 흔드는 오른손은 **관절이 느껴지지 않게** 몸 앞에 겹쳐 든 손(`waveAt`, `arm-wave-r-φ`)입니다. 위 윤곽선은 몸 안에서 열린 끝, 아래 윤곽선은 몸 옆선과 같은 기울기로 이어집니다. 붙은 팔의 뿌리 꺾임은 관절처럼 보인다는 지적을 받았습니다. 꼭대기는 비교 프로젝트처럼 뺨 옆까지 듭니다(155°).
- **비교 프로젝트(heelee912/chiikawa-dots-pets) 기준 결정**(2026-10-07): 선은 순수 검정, 미간은 그쪽 비율(눈 중심 간격 86.4, 눈 0.92배), running-left/right는 옆모습(얼굴 `turn(−65°)` + 옆모습 몸), look 16방향은 `turn`으로 고개를 확실히 돌립니다(90°에서 먼 쪽 눈이 윤곽에 가림). look을 바꾸면 블라인드 방향 검수를 다시 합니다.
- **토벌창은 레퍼런스 비율**: 두꺼운 리본 두 갈래의 C 포크, 바깥으로 말린 뾰족한 끝, 가시는 가로로 뻗은 부분에만 위·아래 3개씩, 흰 캡슐 손잡이와 분홍 자루 사이에 짙은 띠. 테두리는 몸 외곽선과 어울리는 두께(`gen-props.mjs`의 `B` = 4.4)로, 너무 얇으면 "선 두께 통일성이 떨어져 동떨어진 느낌"이라는 지적을 받았습니다.
- **팔·다리**: 다리는 기준점 회전만 하고 `ty`로 끌어올리지 않습니다. 팔은 **몸에서 떨어져 보이면 안 됩니다**(사용자 지적). 크게 드는 팔(jumping, waving 왼팔)은 몸 뒤 `arm-*`를 돌리지 말고 `armAt(p, side, deg)`로 붙은 팔(`tools/gen-arms.mjs`, 몸 외곽선이 그대로 불룩하게 나와 팔이 됨)을 씁니다. 새 각도가 필요하면 `ARM_DEGS`에 넣고 생성 도구를 다시 실행합니다. 팔은 레퍼런스처럼 뭉툭하게(폭 22, 몸 밖 길이 ≈ 두께의 1.5배) 유지합니다. 가늘고 길면 "얇아 보인다"는 지적을 받았습니다. 몸 뒤 `arm-*`는 거의 내린 팔(idle·failed·look)에만 씁니다.
- **손은 레퍼런스처럼, 몸에서 이어지게**: 작은 동그라미 앞발만 자루·책에 얹으면 "몸과 떨어진 단추"처럼 보여 부자연스럽다는 지적을 받았습니다. 지금 손은 모두 레퍼런스 구조를 따릅니다.
  - waiting: 몸 외곽선에서 이어진 쥔 손(`grip-l` 벙어리장갑 + 말림선, `grip-r` 엄지 말린 주먹). waiting.png 손 윤곽을 측정해 옮겼습니다(배율 0.311, 각 손의 어깨 접점을 몸 옆선 끝에 맞춤).
  - running: 사용자 자세 사진의 왼손 윤곽을 측정해 옮긴 `grip-run-l`(몸 외곽선이 불룩해진 손 + 갈고리 손가락선) + 몸 앞 둥근 오른 앞발 `paw-r`. 자루 중심은 `RUN_GRIP_L`(poses.mjs)입니다.
  - review: 몸 옆선 겨드랑이에서 갈라져 책 아래로 비스듬히 휘어 내려온 팔 아래 윤곽선이 그대로 표지 아래 모서리를 앞에서 감싸는 둥근 앞발 윤곽으로 이어지는 "J"자 한 줄(`book-arm-*`, review.png 측정). 앞발은 팔 쪽으로 열려 있어야 합니다(앞발 윗선 끝이 팔 선에 붙어 닫힌 고리가 되면 어색하다는 지적). 손가락선은 없습니다.
  - 손을 고치면 `node tools/ref-sheets.mjs <state>`의 `qa/ref-compare/hands-<state>.png`로 레퍼런스와 나란히 확인합니다.
- **쥔 손 좌표 고정**: waiting 손의 자루 중심은 `GRIP_L`·`GRIP_R`(poses.mjs)입니다. 손 모양을 바꾸면 이 값을 함께 맞춰야 합니다. 토벌창 자루 끝 `WEAPON_J`(poses.mjs)는 `gen-props.mjs`의 `J`와 같아야 합니다.
- **밑면·연장부가 새지 않게**: 숨은 연장부(팔 안쪽선, 다리·귀 면)가 외곽선 밖으로 드러나면 안 됩니다.

## 4. 함정과 주의

- **id 중복 금지**: `build.mjs`는 id로 첫 번째 요소를 찾습니다. `<defs>` 안 정의와 실제 파츠 id가 겹치면 엉뚱한 요소가 바뀝니다.
- **svgo 설정**: `removeUnknownsAndDefaults`의 `defaultAttrs: false`를 유지해야 합니다. 켜면 `<defs>` 안의 `stroke="none"`이 지워져 `<use>`로 쓴 눈·홍조에 선이 상속됩니다.
- **레이어**: 귀·다리·팔은 몸 면 **뒤**, 소켓선·몸 외곽선은 몸 면 **위**입니다. 팔을 들면 몸 윤곽 뒤에서 나오고, 소켓 윗선이 몸 옆선을 이어 줍니다.
- **귀는 회전만**: 귀를 옮기면 머리 윗선과 귀 안쪽선 사이가 벌어져 선 없는 흰 가장자리가 드러납니다.
- **소품과 몸 사이 빈 공간**: 포크 등과 몸 외곽선 사이에 갇힌 배경은 실제 빈 공간이라 허용합니다(`qa/frame-audit.json`의 `prop_gap_max`). 몸 자체 구멍은 소품을 숨긴 렌더로 따로 잽니다.
- **무기 좌표**: 무기는 자체 좌표(손잡이 끝 원점, 자루 방향 +x)를 씁니다. 기본 배치는 `gen-props.mjs`의 두 인스턴스 transform과 `poses.mjs`의 `WEAPON_BASE`를 **같게** 유지해야 `placeWeapon(p, localX, G, theta, id)`가 맞습니다.
- **생성 구간 표식**: `gen:weapon`과 `gen:weapon-defs`는 이름이 겹칩니다. 정규식을 고칠 때 앞 창 표식(`gen:weapon` 뒤 공백 또는 `-->`)만 잡는지 확인하세요. 예전에 잘못 잡아 몸 면·얼굴 구간이 지워진 적이 있습니다(렌더 비교로 복구함).
- **raw 변형**: 포즈 파츠에 `{ raw: 'translate(..) rotate(..) scale(..)' }`를 주면 그대로 적용됩니다(`stretch()`·`placeAt()` 도우미). 늘이는 파츠는 원점에서 +x로 그려야 선 굵기가 유지됩니다.
