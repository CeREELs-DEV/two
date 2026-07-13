# Food Assets and Story Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 제공한 Peking duck·dimsum 그림을 정규화된 외부 PNG로 교체하고, P13 문단 겹침과 `The egg is` 굵기를 보정한다.

**Architecture:** ImageMagick으로 두 입력 그림의 투명 경계를 크롭하고 `210×210` 안에 맞춰 `240×240` 투명 PNG로 만든다. 기존 Perfect Party 변환기가 `FOODIMG`의 두 항목만 외부 경로로 정규화하게 하고, 스토리 페이지 데이터 보정 함수는 P13 대상 블록의 `y`를 문구 기준으로 조정한다.

**Tech Stack:** 단일 `index.html`, Vanilla JavaScript, Node.js 내장 `node:test`, ImageMagick, PNG

## Global Constraints

- 출력 음식 이미지는 정확히 `240×240` RGBA PNG다.
- 투명 경계 기준 그림 크기는 가로·세로 모두 최대 `210px`이며 원본 비율을 유지한다.
- `FOODIMG.f_fish`만 `images/Peking_Duck.png`, `FOODIMG.f_dumpling`만 `images/DimSum.png`로 변경한다.
- P13의 `No one...` 블록 `y`는 `0.6585`다.
- `.lead`의 `font-weight`는 `400`이며 `The egg is` 문구는 유지한다.
- `.vscode/`는 수정하거나 커밋하지 않는다.

---

### Task 1: 음식 자산 및 매핑 회귀 테스트

**Files:**
- Modify: `tests/party-guest-images.test.mjs`
- Create: `images/Peking_Duck.png`
- Create: `images/DimSum.png`
- Modify: `scripts/update-party-guest-images.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `extractPartyDocument(source)`, `transformPartyDocument(document)`, 내장 `var FOODIMG={...};`
- Produces: `transformPartyFoodImages(document)`, `FOODIMG.f_fish`, `FOODIMG.f_dumpling`, 두 PNG 파일

- [x] **Step 1: 새 경로와 PNG 규격을 요구하는 실패 테스트 작성**

`tests/party-guest-images.test.mjs`에 PNG IHDR 검사와 `FOODIMG` 파서를 추가한다.

```js
function parseFoodImages(document) {
  const match = document.match(/var FOODIMG=(\{.*?\});/s);
  assert.ok(match, 'FOODIMG를 찾을 수 없습니다.');
  return JSON.parse(match[1]);
}

function pngHeader(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

test('Peking duck와 dimsum을 정규화된 외부 PNG로 제공한다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const foodImages = parseFoodImages(extractPartyDocument(source));
  assert.equal(foodImages.f_fish, 'images/Peking_Duck.png');
  assert.equal(foodImages.f_dumpling, 'images/DimSum.png');

  for (const path of [foodImages.f_fish, foodImages.f_dumpling]) {
    const header = pngHeader(await readFile(new URL(`../${path}`, import.meta.url)));
    assert.deepEqual(header, { width: 240, height: 240, bitDepth: 8, colorType: 6 });
  }
});
```

- [x] **Step 2: 테스트 실패 확인**

Run: `node --test --test-name-pattern='정규화된 외부 PNG' tests/party-guest-images.test.mjs`

Expected: 현재 두 값이 base64 data URL이므로 경로 단언에서 FAIL.

- [x] **Step 3: 두 PNG를 투명 경계 기준으로 정규화**

Run:

```bash
magick '/Users/suhyeon/Downloads/Foot_CH_Duck 2.png' -trim +repage -resize '210x210>' -gravity center -background none -extent 240x240 images/Peking_Duck.png
magick '/Users/suhyeon/Downloads/Foot_CH_Dumpling.png' -trim +repage -resize '210x210>' -gravity center -background none -extent 240x240 images/DimSum.png
```

Expected: 두 파일이 `240×240` RGBA PNG로 생성됨.

- [x] **Step 4: Perfect Party 음식 매핑 변환 구현**

`scripts/update-party-guest-images.mjs`에 다음 함수를 추가하고 `transformPartyDocument()` 반환 직전에 호출한다.

```js
const PARTY_FOOD_IMAGES = {
  f_fish: 'images/Peking_Duck.png',
  f_dumpling: 'images/DimSum.png',
};

export function transformPartyFoodImages(document) {
  const match = document.match(/var FOODIMG=(\{.*?\});/s);
  if (!match) throw new Error('FOODIMG를 찾을 수 없습니다.');
  const foodImages = JSON.parse(match[1]);
  for (const [id, path] of Object.entries(PARTY_FOOD_IMAGES)) foodImages[id] = path;
  return document.replace(match[0], `var FOODIMG=${JSON.stringify(foodImages)};`);
}
```

`transformPartyDocument()` 마지막은 다음과 같이 변경한다.

```js
return transformPartyFoodImages(transformPartyCopy(next));
```

- [x] **Step 5: 내장 문서 갱신 및 집중 테스트 통과 확인**

Run: `node scripts/update-party-guest-images.mjs index.html`

Run: `node --test --test-name-pattern='정규화된 외부 PNG' tests/party-guest-images.test.mjs`

Expected: PASS.

- [x] **Step 6: 이미지 투명 경계와 중앙 배치 검증**

Run:

```bash
magick images/Peking_Duck.png -format 'size=%wx%h alpha=%[fx:minima.a]..%[fx:maxima.a] trim=%@' info:
magick images/DimSum.png -format 'size=%wx%h alpha=%[fx:minima.a]..%[fx:maxima.a] trim=%@' info:
```

Expected:

```text
size=240x240 alpha=0..1 trim=210x156+15+42
size=240x240 alpha=0..1 trim=202x210+19+15
```

### Task 2: P13 간격과 lead 굵기

**Files:**
- Modify: `tests/story-copy-indent-and-clip-speed.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `PAGES`, `applyStoryIndentOverrides()`, `.lead`
- Produces: P13 대상 블록 `y === 0.6585`, `.lead { font-weight:400; }`

- [x] **Step 1: P13 간격과 lead 굵기 실패 테스트 작성**

```js
test('P13의 Oh well과 No one 문단 사이에 안전한 간격을 둔다', () => {
  const page13 = pages().find((page) => page.name === 13);
  const blockFor = (text) => page13.blocks.find((block) => block.paras.some((paragraph) => paragraph.t === text));
  const ohWell = blockFor('“Oh well, I guess I’ll just eat alone…”');
  const noOne = blockFor('No one notices Ella sitting off');
  const pageAspect = 1252 / 763;
  const lineHeightOnPage = (ohWell.paras[0].fs * ohWell.paras[0].lh) / pageAspect;

  assert.equal(noOne.y, 0.6585);
  assert.ok(noOne.y - (ohWell.y + lineHeightOnPage) >= 0.03);
});

test('The egg is를 일반 굵기로 유지한다', () => {
  const sentence = interactiveSentences().find((item) => item.lead === 'The egg is');
  assert.ok(sentence);
  assert.match(source, /\.lead\{[^}]*font-weight:400;/);
  assert.ok(!source.includes('.lead{font-family:var(--hand); font-weight:700;'));
});
```

- [x] **Step 2: 테스트 실패 확인**

Run: `node --test --test-name-pattern='P13의 Oh well|The egg is를' tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: P13 `y === 0.6321`, `.lead` 굵기 `700`이므로 2건 FAIL.

- [x] **Step 3: 문구 기준 P13 위치와 lead 굵기 최소 수정**

`applyStoryIndentOverrides()`의 페이지 순회에서 P13의 대상 블록만 찾는다.

```js
if (page.name===13) {
  (page.blocks||[]).forEach(function(block){
    if ((block.paras||[]).some(function(paragraph){ return paragraph.t==='No one notices Ella sitting off'; })) {
      block.y=0.6585;
    }
  });
}
```

CSS는 다음과 같이 변경한다.

```css
.lead{font-family:var(--hand); font-weight:400; color:inherit; margin-right:0; text-indent:0;}
```

- [x] **Step 4: 집중 테스트 통과 확인**

Run: `node --test --test-name-pattern='P13의 Oh well|The egg is를' tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: 2건 PASS.

### Task 3: 전체 회귀 검증 및 커밋

**Files:**
- Verify: `index.html`
- Verify: `images/Peking_Duck.png`
- Verify: `images/DimSum.png`
- Verify: `scripts/update-party-guest-images.mjs`
- Verify: `tests/party-guest-images.test.mjs`
- Verify: `tests/story-copy-indent-and-clip-speed.test.mjs`

**Interfaces:**
- Consumes: Task 1·2 결과
- Produces: 검증되고 커밋된 변경 세트

- [x] **Step 1: 변환 멱등성과 전체 테스트 실행**

Run: `node scripts/update-party-guest-images.mjs index.html`

Run: `node --test --test-name-pattern='변환은 재실행해도' tests/party-guest-images.test.mjs`

Expected: 변환 멱등성 테스트 PASS.

Run: `node --test tests/*.test.mjs`

Expected: 전체 테스트 0 failures.

- [x] **Step 2: 구문·파일·whitespace 검사**

Run: `git diff --check`

Expected: exit 0.

Run: `git status --short`

Expected: `.vscode/`와 이번 작업 파일만 표시됨.

- [x] **Step 3: 최종 변경 커밋**

```bash
git add index.html images/Peking_Duck.png images/DimSum.png scripts/update-party-guest-images.mjs tests/party-guest-images.test.mjs tests/story-copy-indent-and-clip-speed.test.mjs docs/superpowers/plans/2026-07-13-food-assets-and-story-layout.md
git commit -m "fix: replace party food art and refine story layout"
```
