# Story Copy, Indent, and Clip Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지정된 페이지 문구·강조·들여쓰기와 Storyboard 범위 라벨을 보정하고, Storyboard 영상 속도 버튼을 실제 클립 재생에 연결한다.

**Architecture:** `index.html`의 대용량 원본 데이터를 직접 인덱스로 수정하지 않고 정확한 문구를 찾는 보정 함수를 데이터 선언 직후 실행한다. 공통 플레이어에는 선택된 배율을 `<video>.playbackRate`에 설정하는 `applyPlayerSpeed()`를 추가해 클릭·프레임 로드·재생 재개 경로에서 재사용한다.

**Tech Stack:** 단일 `index.html`, Vanilla JavaScript, HTMLMediaElement, Node.js 내장 `node:test`, `node:vm`

## Global Constraints

- P3의 원문은 유지하고 깨진 문장 상태에서 `She’s awkward` 전체만 하이라이트한다.
- 들여쓰기 값은 기존 표준 `0.06015`를 사용한다.
- Storyboard의 정지 이미지 체류시간 동작은 유지한다.
- 사용자 소유의 `.vscode/`는 수정하거나 커밋하지 않는다.

---

### Task 1: 문구·강조·들여쓰기·Storyboard 라벨

**Files:**
- Modify: `index.html`
- Test: `tests/story-copy-indent-and-clip-speed.test.mjs`

**Interfaces:**
- Consumes: `PAGES`, `INTERACT_B`, `renderSbTabs(activeSb)`
- Produces: `applyStoryContentOverrides()`, `applyStoryIndentOverrides()`, 단독 탭 `p. {range}`

- [x] **Step 1: 실패 회귀 테스트 작성**

새 테스트에서 `PAGES`와 `INTERACT_B` 선언 및 보정 함수 원문을 VM으로 실행한다. P3의 `lead` 제거와 `She’s awkward`, P10의 `Ella walks to Uncle Jack`, 대상 6개 문단의 `ind === 0.06015`, 단독 탭 접두사 `p.`를 단언한다.

```js
assert.equal(awkward.lead, undefined);
assert.equal(awkward.c[0], 'She’s awkward');
assert.equal(walk.c[0], 'Ella walks to Uncle Jack');
assert.deepEqual(targetIndents, Array(6).fill(0.06015));
assert.ok(source.includes(`bar.innerHTML='<button class="sbm-tab on solo">p. '+range+'</button>';`));
```

- [x] **Step 2: 테스트 실패 확인**

Run: `node --test tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: 현재 `lead === "She’s"`, 첫 조각이 `awkward`, 들여쓰기 `0`, 라벨 `pp.`이므로 FAIL.

- [x] **Step 3: 최소 문구 및 레이아웃 보정 구현**

정확한 문장과 단순화 조각을 순회해 P3·P10만 변경하고, 정확한 전체 문구 집합에 해당하는 문단만 표준 들여쓰기를 적용한다.

```js
function applyStoryContentOverrides(){
  Object.keys(INTERACT_B).forEach(function(key){
    INTERACT_B[key].forEach(function(paragraph){
      paragraph.forEach(function(sentence){
        if(sentence.t==='She’s a little awkward, a little plump, a bit too green, and with a whole lot of personality.'){
          delete sentence.lead;
          sentence.c[0]='She’s awkward';
        }
        if(sentence.c){
          sentence.c=sentence.c.map(function(chunk){
            return chunk==='Ella walks up to Uncle Jack'?'Ella walks to Uncle Jack':chunk;
          });
        }
      });
    });
  });
}
```

`PAGES`의 모든 문단을 순회해 대상 문구에 `ind=0.06015`를 설정하고, 단독 탭 문자열을 `p.`로 변경한다.

- [x] **Step 4: 집중 테스트 통과 확인**

Run: `node --test tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: 문구·들여쓰기·탭 테스트 PASS, 아직 속도 테스트는 FAIL.

### Task 2: Storyboard 영상 속도 적용

**Files:**
- Modify: `index.html`
- Test: `tests/story-copy-indent-and-clip-speed.test.mjs`

**Interfaces:**
- Consumes: `SPEEDS`, `spdIndex`, `plVid`, 기존 `armDwell()`
- Produces: `applyPlayerSpeed(): number`

- [x] **Step 1: 속도 함수 실패 테스트 작성**

함수 원문을 VM에서 가짜 `plVid`로 실행하고 네 배율이 `playbackRate`에 설정되는지 검증한다. 또한 속도 버튼, `showFrame`, `startPlay`가 공통 함수를 호출하는지 단언한다.

```js
for (const [index, expected] of [0.5, 1, 1.5, 2].entries()) {
  context.spdIndex = index;
  assert.equal(runInNewContext('applyPlayerSpeed()', context), expected);
  assert.equal(context.plVid.playbackRate, expected);
}
```

- [x] **Step 2: 속도 테스트 실패 확인**

Run: `node --test --test-name-pattern='클립 속도' tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: `applyPlayerSpeed`가 없어 FAIL.

- [x] **Step 3: 공통 속도 함수 최소 구현**

```js
function applyPlayerSpeed(){
  var speed=SPEEDS[spdIndex].mult;
  plVid.playbackRate=speed;
  return speed;
}
```

속도 버튼 클릭 직후, 영상 `src` 지정 직후, `startPlay()`의 영상 재생 직전에 호출한다. 정지 이미지에서는 기존 `armDwell()` 계산을 유지한다.

- [x] **Step 4: 집중 테스트와 전체 회귀 테스트 실행**

Run: `node --test tests/story-copy-indent-and-clip-speed.test.mjs`

Expected: PASS.

Run: `node --test tests/*.test.mjs`

Expected: 전체 테스트 0 failures.

### Task 3: 구문·렌더링 회귀 및 개선 반영 확인

**Files:**
- Verify: `index.html`
- Verify: `tests/story-copy-indent-and-clip-speed.test.mjs`

**Interfaces:**
- Consumes: Task 1·2 결과
- Produces: 검증된 최종 변경 세트

- [x] **Step 1: HTML 내장 스크립트 구문 검사**

`index.html`의 인라인 스크립트를 추출해 `new Function(script)`로 컴파일한다.

Run: `node --test tests/*.test.mjs`

Expected: 구문 검사 포함 전체 PASS.

- [x] **Step 2: 작업 트리 품질 검사**

Run: `git diff --check && git status --short`

Expected: whitespace 오류 없음, `.vscode/` 외에는 요청 범위 파일만 변경됨.

- [x] **Step 3: 최종 변경 커밋**

```bash
git add index.html tests/story-copy-indent-and-clip-speed.test.mjs docs/superpowers/specs/2026-07-13-story-copy-indent-and-clip-speed-design.md docs/superpowers/plans/2026-07-13-story-copy-indent-and-clip-speed.md
git commit -m "fix: refine story copy and clip speed controls"
```
