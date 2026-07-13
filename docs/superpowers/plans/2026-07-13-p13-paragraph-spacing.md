# P13 Paragraph Spacing and Wrapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** P13의 `“Oh well...”`과 `No one notices...` 사이 간격을 보정하고 `off` 뒤의 데이터 강제 줄바꿈을 제거한다.

**Architecture:** 기존 절대 좌표 기반 스토리 렌더러와 글꼴 규칙은 유지한다. 문단 간격은 렌더러 비율과 같은 P13 상단의 기준 간격으로 검증하고, 줄바꿈은 일반 페이지 데이터와 인터랙티브 문장 데이터의 첫 두 조각을 각각 하나의 문단으로 정규화해 브라우저의 자연 줄바꿈에 맡긴다.

**Tech Stack:** 단일 `index.html`, Vanilla JavaScript, Node.js 내장 `node:test`

## Global Constraints

- P13의 `No one notices Ella sitting off` 블록 `y`는 `0.6660`이다.
- `“Oh well...”` 및 다른 P13 블록의 위치, 글자 크기, 행간, 들여쓰기는 변경하지 않는다.
- 실제 문단 간격은 같은 P13 상단 두 섹션 간격과 `0.001` 이내로 일치해야 한다.
- `No one notices Ella sitting off to the side, all by herself.`는 일반·인터랙티브 데이터에서 각각 하나의 문단이어야 한다.
- 기존 `notices` 어휘 기능과 첫 문단 들여쓰기를 유지한다.
- `.vscode/`는 수정하거나 커밋하지 않는다.

---

### Task 1: P13 문단 간격 회귀 보정

**Files:**
- Modify: `tests/story-copy-indent-and-clip-speed.test.mjs:107`
- Modify: `index.html:1594`

**Interfaces:**
- Consumes: `pages()`, `PAGES`, `applyStoryIndentOverrides()`, 렌더러 상수 `SPREAD_GUT=0.033`, 스테이지 비율 `1.391`
- Produces: P13 대상 블록 `y === 0.6660`, 기준 섹션과 일치하는 문단 간격

- [x] **Step 1: 실제 렌더링 비율과 내부 기준 간격을 요구하는 실패 테스트 작성**

`tests/story-copy-indent-and-clip-speed.test.mjs`의 기존 P13 간격 테스트를 다음 코드로 교체한다.

```js
test('P13의 Oh well과 No one 문단 사이를 다른 섹션 간격과 맞춘다', () => {
  const page13 = pages().find((page) => page.name === 13);
  const blockFor = (text) => page13.blocks.find((block) => block.paras.some((paragraph) => paragraph.t === text));
  const ohWell = blockFor('“Oh well, I guess I’ll just eat alone…”');
  const noOne = blockFor('No one notices Ella sitting off to the side, all by herself.');
  const stageAspectMatch = source.match(/\.cleanstage\{[^}]*aspect-ratio:([0-9.]+)/);
  const spreadGutMatch = source.match(/const SPREAD_GUT=\{0:([0-9.]+)/);
  assert.ok(stageAspectMatch);
  assert.ok(spreadGutMatch);
  const stagePageAspect = (2 - Number(spreadGutMatch[1])) / Number(stageAspectMatch[1]);
  const lineHeightOnStage = (ohWell.paras[0].fs * ohWell.paras[0].lh) / stagePageAspect;
  const actualGap = noOne.y - (ohWell.y + lineHeightOnStage);
  const referenceGap = page13.blocks[1].y - (page13.blocks[0].y + page13.blocks[0].h);

  assert.equal(noOne.y, 0.666);
  assert.ok(
    Math.abs(actualGap - referenceGap) < 0.001,
    `P13 문단 간격 ${actualGap}이 기준 간격 ${referenceGap}과 다릅니다.`,
  );
});
```

- [x] **Step 2: 집중 테스트가 기존 좌표 때문에 실패하는지 확인**

Run: `node --test --test-name-pattern='P13의 Oh well' tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: `0.6585 !== 0.666`으로 1건 FAIL.

- [x] **Step 3: 대상 블록 좌표만 최소 변경**

`index.html`의 `applyStoryIndentOverrides()`에서 P13의 대상 문구를 찾는 기존 분기 안을 다음과 같이 변경한다.

```js
if(page.name===13 && (block.paras||[]).some(function(paragraph){ return paragraph.t==='No one notices Ella sitting off'; })){
  block.y=0.6660;
}
```

- [x] **Step 4: 집중 테스트 통과 확인**

Run: `node --test --test-name-pattern='P13의 Oh well' tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: 1 test PASS, 0 failures.

### Task 2: P13 첫 문장의 자연 줄바꿈

**Files:**
- Modify: `tests/story-copy-indent-and-clip-speed.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: P13 `block.paras`, `INTERACT_B['No one notices E']`, `notices` vocab 데이터
- Produces: `No one notices Ella sitting off to the side, all by herself.` 단일 문단

- [x] **Step 1: 일반·인터랙티브 데이터 병합을 요구하는 실패 테스트 작성**

```js
test('P13 No one 첫 문장을 강제 줄바꿈 없이 하나의 문단으로 유지한다', () => {
  const expected = 'No one notices Ella sitting off to the side, all by herself.';
  const page13 = pages().find((page) => page.name === 13);
  const block = page13.blocks.find((item) => item.paras.some((paragraph) => paragraph.t.startsWith('No one notices')));
  const sentence = interactiveSentences().find((item) => item.t === expected);

  assert.equal(block.paras[0].t, expected);
  assert.ok(!block.paras.some((paragraph) => paragraph.t === 'to the side, all by herself.'));
  assert.ok(sentence);
  assert.deepEqual(Array.from(sentence.vocab.notices), ['notices', 'sees']);
  assert.equal(block.paras[0].ind, 0.06015);
});
```

- [x] **Step 2: 집중 테스트가 분리된 문단 때문에 실패하는지 확인**

Run: `node --test --test-name-pattern='P13 No one 첫 문장' tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: 실제값 `No one notices Ella sitting off`가 병합된 예상 문장과 달라 FAIL.

- [x] **Step 3: 일반 페이지 데이터의 첫 두 문단 병합**

`applyStoryIndentOverrides()`에서 대상 블록의 들여쓰기를 적용한 뒤 첫 두 문단의 텍스트를 병합하고 두 번째 문단을 제거한다.

```js
var first=(block.paras||[]).findIndex(function(paragraph){ return paragraph.t==='No one notices Ella sitting off'; });
if(page.name===13 && first>=0 && block.paras[first+1] && block.paras[first+1].t==='to the side, all by herself.'){
  block.paras[first].t+=' '+block.paras[first+1].t;
  block.paras.splice(first+1,1);
}
```

- [x] **Step 4: 인터랙티브 데이터의 첫 두 문단 병합**

`INTERACT_B` 선언 뒤에서 같은 두 문장 조각을 병합한다.

```js
function mergePage13NoOneInteractive(){
  var paragraphs=INTERACT_B['No one notices E'];
  if(!paragraphs || !paragraphs[0] || !paragraphs[1]) return;
  var first=paragraphs[0][0], second=paragraphs[1][0];
  if(first && second && first.t==='No one notices Ella sitting off' && second.t==='to the side, all by herself.'){
    first.t+=' '+second.t;
    paragraphs.splice(1,1);
  }
}
mergePage13NoOneInteractive();
```

- [x] **Step 5: 기존 P13 테스트의 문단 식별자를 병합 문구로 갱신**

들여쓰기 대상 목록과 간격 테스트의 `blockFor()` 호출에서 `No one notices Ella sitting off`를 다음 병합 문구로 교체한다.

```js
'No one notices Ella sitting off to the side, all by herself.'
```

- [x] **Step 6: P13 집중 테스트 통과 확인**

Run: `node --test --test-name-pattern='P13' tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: 3 tests PASS, 0 failures.

### Task 3: 전체 회귀 검증 및 커밋

**Files:**
- Verify: `index.html`
- Verify: `tests/story-copy-indent-and-clip-speed.test.mjs`
- Verify: `docs/superpowers/specs/2026-07-13-food-assets-and-story-layout-design.md`
- Verify: `docs/superpowers/plans/2026-07-13-p13-paragraph-spacing.md`

**Interfaces:**
- Consumes: Task 1·2 결과
- Produces: 검증되고 커밋된 P13 간격·줄바꿈 변경 세트

- [x] **Step 1: 전체 회귀 및 형식 검사**

Run: `node --test tests/*.test.mjs`

Expected: 전체 테스트 0 failures.

Run: `git diff --check`

Expected: 출력 없이 exit 0.

Run: `git status --short`

Expected: 이번 설계·계획·테스트·`index.html`과 기존 미추적 `.vscode/`만 표시된다.

- [x] **Step 2: 구현 변경 커밋**

```bash
git add index.html tests/story-copy-indent-and-clip-speed.test.mjs docs/superpowers/specs/2026-07-13-food-assets-and-story-layout-design.md docs/superpowers/plans/2026-07-13-p13-paragraph-spacing.md
git commit -m "fix: refine P13 paragraph flow"
```

## 구현 후 개선 검토

1. 이미지 원본 비율을 고정값으로 사용하는 대신 렌더러의 스프레드 여백과 스테이지 비율에서 실제 페이지 비율을 유도한다.
2. `0.03 이상` 같은 임의 임계값 대신 같은 페이지에서 정상적으로 보이는 섹션 간격을 기준값으로 삼는다.
3. 줄바꿈 위치를 CSS로 보정하지 않고 일반·인터랙티브 데이터의 문장 경계를 일치시켜 두 렌더링 경로의 결과를 동일하게 만든다.

세 항목을 모두 반영한다. 실제 렌더링 구조와 회귀 테스트를 일치시키면서도 현재 절대 좌표 구조를 재작성하지 않아 변경 위험이 작다.
