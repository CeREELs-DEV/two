# Stage Direct Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상단 진행 경로의 모든 현재 챕터 스테이지를 클릭해 완료 기록을 조작하지 않고 즉시 열 수 있게 한다.

**Architecture:** 기존 `goStep`에 `{ direct: true }` 옵션을 추가하고 스테이지 노드 클릭만 이 옵션을 사용한다. 직접 이동은 전방 완료 조건 검사와 이전 활동 자동 완료 처리를 우회하지만, 기존 활동 정리·페이지 렌더링·진행 경로 갱신 로직은 그대로 재사용한다.

**Tech Stack:** 단일 `index.html`, Vanilla JavaScript, Node.js 내장 `node:test`, `node:vm`

## Global Constraints

- 일반 이전·다음 화살표의 순차 진행과 완료 조건은 유지한다.
- 직접 이동만으로 `pollDone`, `activityDone`, `storyboardDone`을 변경하지 않는다.
- 명시적으로 `locked`인 노드는 계속 차단한다.
- 사용자 소유의 `.vscode/`는 수정하거나 커밋하지 않는다.

---

### Task 1: 스테이지 직접 이동과 접근성 이름

**Files:**
- Modify: `index.html:1427-1463, 2187-2206`
- Test: `tests/storyboard-party-flow.test.mjs`

**Interfaces:**
- Consumes: `nodeAction(index)`, `goStep(index)`, `NODES`, `STEPS`, 기존 완료 상태 플래그
- Produces: `goStep(index, options)` (`options.direct: boolean`), 노드 버튼의 `aria-label`

- [ ] **Step 1: 직접 이동 동작을 실행하는 실패 테스트 작성**

`tests/storyboard-party-flow.test.mjs`에서 `node:vm`으로 `nodeAction`과 `goStep` 함수 원문을 실행한다. 미래 노드는 `goStep(9, { direct: true })`를 호출해야 하고, `canLeaveForward() === false`인 Primer에서 직접 이동하면 단계는 바뀌되 `pollDone`은 `false`로 남아야 한다. 같은 상태의 일반 이동은 차단돼야 한다.

```js
function createStepContext(){
  return {
    flipping:false,
    STEPS:[
      {k:'cover'},{k:'spread',s:0},{k:'poll'},{k:'spread',s:1},
      {k:'spread',s:2},{k:'spread',s:3},{k:'party'},
      {k:'spread',s:4},{k:'spread',s:5},{k:'finish'}
    ],
    STEP:2,
    NAVDIR:1,
    maxStep:2,
    pollDone:false,
    activityDone:false,
    ch2Started:false,
    SPREAD:0,
    PAGES:[{},{}],
    flipMode:false,
    canLeaveForward(){ return false; },
    closeAllActivities(){},
    loadNovel(){},
    renderNodePath(){},
    updateArrows(){},
  };
}

test('스테이지 노드는 완료 상태를 바꾸지 않고 직접 이동한다', () => {
  const nodeSource = sourceBetween('function nodeAction(i){', 'function alignNodePath()');
  const nodeContext = {
    NODES: Array.from({ length: 10 }, () => ({})),
    ch2Started: true,
    calls: [],
    goStep(i, options) { nodeContext.calls.push({ i, options }); },
  };
  runInNewContext(`${nodeSource}; nodeAction(9);`, nodeContext);
  assert.equal(nodeContext.calls.length, 1);
  assert.equal(nodeContext.calls[0].i, 9);
  assert.equal(nodeContext.calls[0].options.direct, true);

  const stepSource = sourceBetween('function goStep(', 'function goNext()');
  const stepContext = createStepContext();
  runInNewContext(`${stepSource}; goStep(3);`, stepContext);
  assert.equal(stepContext.STEP, 2);
  runInNewContext('goStep(3, { direct: true });', stepContext);
  assert.equal(stepContext.STEP, 3);
  assert.equal(stepContext.pollDone, false);
});
```

- [ ] **Step 2: 실패 테스트 확인**

Run: `node --test --test-name-pattern='스테이지 노드는' tests/storyboard-party-flow.test.mjs`

Expected: 미래 노드 호출이 기존 `maxStep` 제한에 막혀 FAIL.

- [ ] **Step 3: 직접 이동 옵션 최소 구현**

`nodeAction`은 명시적 잠금만 확인하고 직접 이동을 호출한다.

```js
function nodeAction(i){
  if(isNaN(i) || !NODES[i]) return;
  var n=NODES[i];
  if(n.locked) return;
  ch2Started=false;
  goStep(i,{direct:true});
}
```

`goStep`은 직접 이동과 일반 이동을 분리한다.

```js
function goStep(i,options){
  var direct=!!(options&&options.direct);
  if(flipping) return;
  if(i<0 || i>=STEPS.length) return;
  if(i>STEP && !direct && !canLeaveForward()) return;
  var dir=(i>STEP)?1:(i<STEP?-1:0);
  NAVDIR=(dir<0)?-1:1;
  var prev=STEPS[STEP];
  if(dir>0 && !direct){
    if(prev.k==='poll') pollDone=true;
    if(prev.k==='party') activityDone=true;
  }
  ch2Started=false;
  STEP=i; if(i>maxStep) maxStep=i;
  var st=STEPS[i];
  closeAllActivities();
  if(st.k==='spread'){
    var target=st.s, from=SPREAD, ns=Math.ceil(PAGES.length/2);
    if(flipMode && !flipping && from>=0 && from<ns && Math.abs(target-from)===1){
      doSlide(from, target, target>from?1:-1);
    } else {
      SPREAD=target;
      loadNovel();
    }
  } else if(st.k==='finish'){
    SPREAD=Math.ceil(PAGES.length/2);
    loadNovel();
  } else {
    openActivityFor(st.k);
  }
  renderNodePath();
  updateArrows();
}
```

- [ ] **Step 4: 노드 접근성 이름 추가**

`renderNodePath`에서 챕터명과 페이지 라벨을 조합하고 `<br>`을 공백으로 바꾼다.

```js
var nodeName=((n.chap||'')+' '+(n.label||''))
  .replace(/<br\s*\/?>/gi,' ')
  .replace(/\s+/g,' ')
  .trim() || ('Stage '+(i+1));
html+='<button class="np-node t-'+typ+' '+st+'" data-i="'+i+'" aria-label="Open '+nodeName+'" title="'+nodeName+'">';
```

- [ ] **Step 5: 집중 테스트 및 전체 회귀 테스트 실행**

Run: `node --test --test-name-pattern='스테이지 노드는' tests/storyboard-party-flow.test.mjs`

Expected: PASS.

Run: `node --test tests/*.test.mjs && git diff --check`

Expected: 전체 테스트 0 failures, `git diff --check` exit 0.

- [ ] **Step 6: 변경 커밋**

```bash
git add index.html tests/storyboard-party-flow.test.mjs docs/superpowers/plans/2026-07-13-stage-direct-navigation.md
git commit -m "feat: enable direct stage navigation"
```
