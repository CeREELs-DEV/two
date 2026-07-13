# Immediate Poll Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 투표 최초 제출 시 기존 결과 화면을 즉시 표시하고, 재진입 시 `View results` 버튼을 복원한다.

**Architecture:** `showSubmittedPollActions()`가 완료된 투표의 선택 화면과 결과 버튼 복원만 담당한다. `submitVote()`는 완료 상태 저장 후 이 UI를 준비하고 결과 화면을 즉시 열며, `openPoll()` 재진입 경로는 상태를 다시 변경하지 않고 완료 UI만 복원한다.

**Tech Stack:** 단일 `index.html`, Vanilla JavaScript, Node.js 내장 `node:test`, `node:vm`

## Global Constraints

- 최초 `Submit` 직후 기존 `showPollResults()` 결과 화면을 표시한다.
- 재진입 시 선택했던 항목과 `View results` 버튼을 표시한다.
- `View results` 버튼은 기존 `showPollResults()`를 다시 호출한다.
- `pollSubmitted`, `pollDone`, 다음 단계 이동 조건과 결과 계산은 기존 의미를 유지한다.
- 투표 제출 후 자동으로 다음 스테이지로 이동하지 않는다.
- `.vscode/`는 수정하거나 커밋하지 않는다.

---

### Task 1: 최초 제출과 재진입 결과 흐름

**Files:**
- Modify: `tests/storyboard-party-flow.test.mjs`
- Modify: `index.html:1818-1853`
- Create: `docs/superpowers/plans/2026-07-13-poll-submit-result.md`

**Interfaces:**
- Consumes: `openPoll()`, `submitVote()`, `showPollResults()`, `pollSubmitted`, `pollDone`
- Produces: `showSubmittedPollActions(): void`, 최초 제출 즉시 결과, 재진입 결과 버튼 복원

- [x] **Step 1: 최초 제출과 결과 버튼 재사용을 요구하는 실패 테스트 작성**

`tests/storyboard-party-flow.test.mjs`에 다음 테스트를 추가한다.

```js
test('투표 Submit은 결과를 즉시 표시하고 View results 버튼을 재사용한다', () => {
  const flowSource = sourceBetween('function showSubmittedPollActions(){', 'function enterChapter2(){');
  const listeners = {};
  const calls = [];
  const elements = {
    'poll-actions': { style: {}, innerHTML: '' },
    'poll-see': { addEventListener(type, handler) { listeners[type] = handler; } },
    'poll-results': { style: {} },
    'poll-opts': { style: {} },
  };
  const context = {
    pollSubmitted: false,
    pollDone: false,
    document: { getElementById(id) { return elements[id] || null; } },
    fitPoll() {},
    showPollResults() { calls.push('results'); },
    renderNodePath() { calls.push('nodes'); },
    updateArrows() { calls.push('arrows'); },
  };

  runInNewContext(`${flowSource}; submitVote();`, context);

  assert.equal(context.pollSubmitted, true);
  assert.equal(context.pollDone, true);
  assert.match(elements['poll-actions'].innerHTML, /id="poll-see"/);
  assert.deepEqual(calls, ['results', 'nodes', 'arrows']);
  assert.equal(typeof listeners.click, 'function');
  listeners.click();
  assert.deepEqual(calls, ['results', 'nodes', 'arrows', 'results']);
  assert.ok(!flowSource.includes('goStep('));
});
```

- [x] **Step 2: 재진입이 재제출하지 않는 실패 테스트 작성**

같은 테스트 파일에 다음 테스트를 추가한다.

```js
test('완료한 투표에 재진입하면 View results 동작만 복원한다', () => {
  const openSource = sourceBetween('function openPoll(){', 'function castVote(');
  const calls = [];
  const elements = {
    'poll-opts': { style: {}, innerHTML: '', appendChild() {} },
    'poll-q': { textContent: '' },
    pollmodal: { classList: { remove() {}, add() {} }, setAttribute() {} },
    'poll-results': { style: {}, innerHTML: '' },
    'poll-actions': { style: {}, innerHTML: '' },
  };
  const context = {
    POLL: { q: 'Question', opts: [] },
    pollChoice: 1,
    pollSubmitted: true,
    NAVDIR: 1,
    document: {
      getElementById(id) { return elements[id] || null; },
      createElement() { return {}; },
    },
    window: { scrollTo() {} },
    markPoll() { calls.push('mark'); },
    showSubmittedPollActions() { calls.push('restore'); },
    showSubmit() { calls.push('submit-ui'); },
    submitVote() { calls.push('resubmit'); },
    positionActivity() {},
    fitPoll() {},
  };

  runInNewContext(`${openSource}; openPoll();`, context);

  assert.deepEqual(calls, ['mark', 'restore']);
});
```

- [x] **Step 3: 집중 테스트가 새 헬퍼 부재로 실패하는지 확인**

Run: `node --test --test-name-pattern='투표 Submit|완료한 투표' tests/storyboard-party-flow.test.mjs`

Expected: `showSubmittedPollActions()` 시작점을 찾지 못하거나 재진입에서 `resubmit`이 호출되어 FAIL.

- [x] **Step 4: 제출 완료 UI 복원 헬퍼 구현**

`index.html`에서 `showSubmit()` 다음에 아래 함수를 추가한다.

```js
function showSubmittedPollActions(){
  var a=document.getElementById('poll-actions');
  a.style.display='';
  a.innerHTML='<button class="poll-see" id="poll-see">📊 View results</button>';
  var s=document.getElementById('poll-see'); if(s) s.addEventListener('click', showPollResults);
  var box=document.getElementById('poll-results'); if(box) box.style.display='none';
  var opts=document.getElementById('poll-opts'); if(opts) opts.style.display='';
  fitPoll();
}
```

- [x] **Step 5: 최초 제출과 재진입 호출 경로 분리**

`submitVote()`와 `openPoll()`을 다음 규칙으로 변경한다.

```js
if(pollChoice>=0){ markPoll(pollChoice); if(pollSubmitted){ showSubmittedPollActions(); } else { showSubmit(); } }
```

```js
function submitVote(){
  pollSubmitted=true; pollDone=true;
  showSubmittedPollActions();
  showPollResults();
  if(typeof renderNodePath==='function') renderNodePath();
  if(typeof updateArrows==='function') updateArrows();
}
```

- [x] **Step 6: 집중 테스트 통과 확인**

Run: `node --test --test-name-pattern='투표 Submit|완료한 투표' tests/storyboard-party-flow.test.mjs`

Expected: 2 tests PASS, 0 failures.

- [x] **Step 7: 전체 회귀·구문·형식 검사**

Run: `node --test tests/*.test.mjs`

Expected: 전체 테스트 0 failures. 기존 인라인 JavaScript 컴파일 테스트도 PASS.

Run: `git diff --check`

Expected: 출력 없이 exit 0.

Run: `git status --short`

Expected: 이번 계획·테스트·`index.html`과 기존 미추적 `.vscode/`만 표시된다.

- [x] **Step 8: 구현 변경 커밋**

```bash
git add index.html tests/storyboard-party-flow.test.mjs docs/superpowers/plans/2026-07-13-poll-submit-result.md
git commit -m "fix: show poll results after submit"
```

## 구현 후 개선 검토

1. 제출 상태 변경과 재진입 UI 복원을 `submitVote()`와 `showSubmittedPollActions()`로 분리한다.
2. 최초 제출·재진입·버튼 재클릭을 각각 테스트해 경로별 차이를 고정한다.
3. 새 결과 화면을 만들지 않고 기존 `showPollResults()`를 재사용해 계산과 애니메이션 중복을 피한다.

세 항목을 모두 적용한다.
