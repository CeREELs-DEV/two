# Storyboard and Party Completion Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Storyboard와 Background & Culture의 문구, Reset, 자동 클립 재생, `Clear!` 확인 후 이동 흐름을 구현한다.

**Architecture:** 기존 단일 `index.html` UI 구조를 유지하고, Perfect Party 문서는 기존 변환 스크립트로 추출·변환·재인코딩한다. Storyboard 성공 흐름은 부모 문서의 기존 플레이어를 재사용하고, iframe 완료 메시지는 발신 창을 검증한 뒤 부모 문서의 네이티브 `<dialog>`를 연다.

**Tech Stack:** HTML5, CSS, 바닐라 JavaScript, Node.js `node:test`, Base64 내장 `srcdoc`

## Global Constraints

- 스토리맵 첫 노드는 화면에 정확히 `Ella Gator`로 표시한다.
- Storyboard 버튼 문구는 `Reset`, 성공 직후 실행할 플레이어 문구는 기존 `Play My clips`를 유지한다.
- 미니게임 제목은 `Harvest Gathering`, 음식은 `peking duck`과 `dimsum`으로 표시한다.
- 성공 모달 제목은 `Clear!`, 버튼은 `Continue`로 고정한다.
- 세 번 오답 후 자동 공개에서는 클립을 자동 재생하지 않는다.
- 외부 패키지를 추가하지 않는다.
- 사용자 소유의 `.vscode/` 파일은 수정하거나 커밋하지 않는다.

---

## File Structure

- Modify: `index.html` — 메인 UI 문구, Reset 동작, Storyboard 정답 재생, 성공 dialog와 단계 전이를 담당한다.
- Modify: `scripts/update-party-guest-images.mjs` — Base64 내장 Perfect Party 문서의 기존 이미지 변환과 새 문구 변환을 결정적으로 수행한다.
- Modify: `tests/party-guest-images.test.mjs` — 내장 문서 문구와 변환 멱등성을 검증한다.
- Create: `tests/storyboard-party-flow.test.mjs` — 메인 문서의 Reset, 정답 재생, 모달·메시지·단계 차단 구조를 회귀 검증한다.

### Task 1: 메인 문구와 Storyboard Reset

**Files:**
- Modify: `index.html:944-968, 1353, 1399, 2618-2660, 2762`
- Create: `tests/storyboard-party-flow.test.mjs`

**Interfaces:**
- Consumes: 기존 `sbFrames`, `sbStopAllFrames()`, `sbShuffle()`, `sbUpdateSlots()` 상태와 함수.
- Produces: `sbResetBoard(): void`; `#sb-shuffle` 버튼은 호환성을 위해 ID를 유지한다.

- [ ] **Step 1: 메인 문구와 Reset의 실패 테스트 작성**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('스토리맵 첫 노드는 Ella Gator를 원래 대소문자로 표시한다', () => {
  assert.ok(source.includes("{t:'loc', icon:'📖', chap:'Ella Gator', at:'cover'}"));
  assert.ok(source.includes('.np-node[data-i="0"] .np-chap{text-transform:none;}'));
  assert.ok(!source.includes("chap:'COVER'"));
});

test('Storyboard의 Shuffle 제어를 Reset 제어로 제공한다', () => {
  assert.ok(source.includes('#sb-shuffle::after{content:"Reset";}'));
  assert.match(source, /id="sb-shuffle" aria-label="Reset the storyboard" title="Reset"/);
  assert.match(source, /function sbResetBoard\(\)[\s\S]*sbStopAllFrames\(\)[\s\S]*sbShuffle\(sbFrames\.length\)/);
  assert.ok(source.includes("document.getElementById('sb-shuffle').addEventListener('click', function(){ if(sbFrames.length) sbResetBoard(); });"));
});
```

- [ ] **Step 2: 테스트를 실행해 RED 확인**

Run: `node --test tests/storyboard-party-flow.test.mjs`

Expected: `Ella Gator`, `Reset`, `sbResetBoard`가 없어서 assertion failure.

- [ ] **Step 3: 최소 문구와 Reset 구현**

`index.html`에서 첫 노드와 첫 노드의 대소문자 CSS를 추가한다.

```css
.np-node[data-i="0"] .np-chap{text-transform:none;}
#sb-shuffle::after{content:"Reset";}
```

```js
{t:'loc', icon:'📖', chap:'Ella Gator', at:'cover'},
```

Reset 버튼의 접근성 문구와 SVG를 아래 구조로 바꾼다.

```html
<button class="sbm-ib" id="sb-shuffle" aria-label="Reset the storyboard" title="Reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path></svg></button>
```

기존 `sbShuffleTray()`를 의미에 맞게 교체한다.

```js
function sbResetBoard(){
  sbStopAllFrames();
  if(sbPicked){ sbPicked.classList.remove('picked'); sbPicked=null; }
  var tray=document.getElementById('sb-tray'); tray.innerHTML='';
  document.querySelectorAll('.sb-slot').forEach(function(s){ s.classList.remove('filled','correct','wrong'); });
  sbFrames.forEach(function(f){ f.classList.remove('reveal'); });
  var ord=sbShuffle(sbFrames.length);
  ord.forEach(function(ci){ tray.appendChild(sbFrames[ci]); });
  sbSolved=false; sbMiss=0;
  document.getElementById('sb-board').classList.remove('solved');
  sbUpdateSlots();
}
```

`loadSb()`와 클릭 핸들러가 다음처럼 `sbResetBoard()`를 호출하도록 변경한다.

```js
sbResetBoard();
```

```js
document.getElementById('sb-shuffle').addEventListener('click', function(){ if(sbFrames.length) sbResetBoard(); });
```

- [ ] **Step 4: Task 1 테스트 GREEN 확인**

Run: `node --test tests/storyboard-party-flow.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Task 1 커밋**

```bash
git add index.html tests/storyboard-party-flow.test.mjs
git commit -m "feat: rename storyboard shuffle control to reset"
```

### Task 2: 내장 Perfect Party 문구 변환

**Files:**
- Modify: `scripts/update-party-guest-images.mjs`
- Modify: `tests/party-guest-images.test.mjs`
- Modify: `index.html` (`PARTY_B64`만 도구로 갱신)

**Interfaces:**
- Consumes: `extractPartyDocument(source)`, `transformPartyDocument(document)`, `replacePartyDocument(source, document)`.
- Produces: `transformPartyDocument()`가 제목과 음식 문구까지 멱등 변환한 HTML 문자열.

- [ ] **Step 1: 내장 문구의 실패 테스트 작성**

`tests/party-guest-images.test.mjs`에 추가한다.

```js
test('Perfect Party 문구를 Harvest Gathering과 새 음식 이름으로 정규화한다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const embedded = extractPartyDocument(source);
  const transformed = transformPartyDocument(embedded);

  for (const text of ['<title>Harvest Gathering</title>', 'Quest: </span>Harvest Gathering', "n:'peking duck'", "n:'dimsum'"]) {
    assert.ok(transformed.includes(text), text);
  }
  for (const oldText of ['<title>Fall Gathering</title>', 'Quest: </span>Fall Gathering', "n:'roast duck'", "n:'dumpling'"]) {
    assert.ok(!transformed.includes(oldText), oldText);
  }
});
```

실제 내장 문서 검증 테스트에도 다음 assertion을 추가한다.

```js
for (const text of ['<title>Harvest Gathering</title>', 'Quest: </span>Harvest Gathering', "n:'peking duck'", "n:'dimsum'"]) {
  assert.ok(embedded.includes(text), text);
}
for (const oldText of ['<title>Fall Gathering</title>', 'Quest: </span>Fall Gathering', "n:'roast duck'", "n:'dumpling'"]) {
  assert.ok(!embedded.includes(oldText), oldText);
}
```

- [ ] **Step 2: 테스트를 실행해 RED 확인**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 새 문구가 없어서 새 테스트 failure.

- [ ] **Step 3: 멱등 문구 변환 구현**

`scripts/update-party-guest-images.mjs`에 다음 상수와 함수를 추가한다.

```js
const PARTY_COPY_REPLACEMENTS = [
  ['<title>Fall Gathering</title>', '<title>Harvest Gathering</title>'],
  ['Quest: </span>Fall Gathering', 'Quest: </span>Harvest Gathering'],
  ["n:'roast duck'", "n:'peking duck'"],
  ["n:'dumpling'", "n:'dimsum'"],
];

function transformPartyCopy(document) {
  return PARTY_COPY_REPLACEMENTS.reduce((next, [before, after]) => {
    if (next.includes(before)) return next.replaceAll(before, after);
    if (!next.includes(after)) throw new Error(`Perfect Party 문구 기준 문자열을 찾을 수 없습니다: ${before}`);
    return next;
  }, document);
}
```

`transformPartyDocument()`의 반환 직전에 `next = transformPartyCopy(next)`를 적용하고, 기존 조기 `return`을 제거해 이미지 변환과 문구 변환이 모두 실행되게 한다.

- [ ] **Step 4: 도구로 실제 `PARTY_B64` 갱신**

Run: `node scripts/update-party-guest-images.mjs index.html`

Expected: exit 0, `index.html`의 내장 문서가 새 문구를 포함.

- [ ] **Step 5: Task 2 테스트 GREEN 확인**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: all tests pass, 0 fail.

- [ ] **Step 6: Task 2 커밋**

```bash
git add index.html scripts/update-party-guest-images.mjs tests/party-guest-images.test.mjs
git commit -m "feat: update harvest gathering copy"
```

### Task 3: Storyboard 정답 재생과 Clear 성공 모달

**Files:**
- Modify: `index.html:442-457, 1295-1297, 1516-1521, 2052-2057, 2114-2125, 2594-2603, 2786-2791`
- Modify: `tests/storyboard-party-flow.test.mjs`

**Interfaces:**
- Consumes: `sbSolveNew(): void`, `sbPlayAll(): void`, `partyframe.contentWindow`, `finishActivity(): void`, `goStep(number): void`.
- Produces: `isPartyCompleteMessage(event): boolean`, `showPartyClear(): void`, `#party-clear`, `#party-clear-continue`.

- [ ] **Step 1: 정답 재생과 성공 모달의 실패 테스트 작성**

```js
test('정답을 직접 확인하면 성공 처리 후 Play My clips를 실행한다', () => {
  assert.ok(source.includes('if(correct){ sbSolveNew(); sbPlayAll(); return; }'));
  const reveal = source.match(/function sbRevealNew\(\)\{([^}]|\}(?!\s*function))*\}/)?.[0] ?? '';
  assert.ok(reveal.includes('sbSolveNew();'));
  assert.ok(!reveal.includes('sbPlayAll();'));
});

test('Background & Culture 완료는 신뢰한 iframe의 메시지로 Clear dialog만 연다', () => {
  assert.match(source, /<dialog[^>]+id="party-clear"[^>]+aria-labelledby="party-clear-title"/);
  assert.ok(source.includes('<h2 id="party-clear-title">Clear!</h2>'));
  assert.ok(source.includes('<button type="button" id="party-clear-continue">Continue</button>'));
  assert.ok(source.includes("e.source===frame.contentWindow && e.data && e.data.t==='perfectparty-complete'"));
  assert.ok(source.includes('if(isPartyCompleteMessage(e)) showPartyClear();'));
  assert.ok(source.includes("if(st.k==='party') return activityDone;"));
});

test('Clear dialog는 Continue 전 이동하지 않고 명시적 버튼으로 완료한다', () => {
  const show = source.match(/function showPartyClear\(\)\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(show.includes('showModal()'));
  assert.ok(!show.includes('finishActivity()'));
  assert.ok(source.includes("partyClear.addEventListener('cancel', function(e){ e.preventDefault(); });"));
  assert.ok(source.includes("partyClearContinue.addEventListener('click', finishActivity);"));
});
```

- [ ] **Step 2: 테스트를 실행해 RED 확인**

Run: `node --test tests/storyboard-party-flow.test.mjs`

Expected: 자동 재생, dialog, 메시지 검증, party gate assertion failure.

- [ ] **Step 3: Storyboard 정답 자동 재생 구현**

`sbCheck()`의 정답 분기만 다음처럼 변경한다.

```js
if(correct){ sbSolveNew(); sbPlayAll(); return; }
```

`sbRevealNew()`는 기존처럼 `sbSolveNew()`만 호출한다.

- [ ] **Step 4: Clear dialog 마크업과 스타일 구현**

`#actgate` 뒤에 다음 dialog를 추가한다.

```html
<dialog class="party-clear" id="party-clear" aria-labelledby="party-clear-title">
  <div class="party-clear-icon" aria-hidden="true">✓</div>
  <h2 id="party-clear-title">Clear!</h2>
  <p>You made the gathering a success.</p>
  <button type="button" id="party-clear-continue">Continue</button>
</dialog>
```

기존 스킨 변수와 색상 체계로 다음 스타일을 추가한다.

```css
.party-clear{border:0;border-radius:22px;width:min(420px,calc(100% - 32px));padding:30px 26px;text-align:center;color:var(--ink);background:var(--paper);box-shadow:0 24px 70px rgba(0,0,0,.38);}
.party-clear::backdrop{background:rgba(24,32,28,.72);backdrop-filter:blur(3px);}
.party-clear-icon{width:58px;height:58px;margin:0 auto 10px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--teal);color:#fff;font-size:32px;font-weight:900;}
.party-clear h2{margin:0;font-family:var(--disp);font-size:2rem;color:var(--teal-deep);}
.party-clear p{margin:6px 0 20px;color:var(--ink-soft);}
.party-clear button{border:0;border-radius:999px;padding:11px 28px;background:var(--teal-deep);color:#fff;font-family:var(--disp);font-weight:800;font-size:1rem;cursor:pointer;}
.party-clear button:hover,.party-clear button:focus-visible{background:var(--teal);outline:3px solid rgba(15,165,149,.28);outline-offset:3px;}
```

- [ ] **Step 5: 완료 메시지 검증과 단계 전이 구현**

```js
const partyClear=document.getElementById('party-clear');
const partyClearContinue=document.getElementById('party-clear-continue');

function isPartyCompleteMessage(e){
  var frame=document.getElementById('partyframe');
  return !!(frame && e.source===frame.contentWindow && e.data && e.data.t==='perfectparty-complete');
}
function showPartyClear(){
  if(!partyClear || partyClear.open) return;
  partyClear.showModal();
  partyClearContinue.focus();
}
window.addEventListener('message', function(e){ if(isPartyCompleteMessage(e)) showPartyClear(); });
function finishActivity(){
  if(partyClear && partyClear.open) partyClear.close();
  activityDone=true;
  goStep(STEP+1);
}
partyClear.addEventListener('cancel', function(e){ e.preventDefault(); });
partyClearContinue.addEventListener('click', finishActivity);
```

`canLeaveForward()`에 party 완료 조건을 추가한다.

```js
function canLeaveForward(){
  var st=STEPS[STEP];
  if(st.k==='poll') return pollDone;
  if(st.k==='party') return activityDone;
  return true;
}
```

`closeAllActivities()`는 열려 있는 `partyClear` dialog도 닫아 이전 성공 UI가 남지 않게 한다.

- [ ] **Step 6: Task 3 테스트 GREEN 확인**

Run: `node --test tests/storyboard-party-flow.test.mjs tests/party-guest-images.test.mjs`

Expected: all tests pass, 0 fail.

- [ ] **Step 7: 브라우저 수동 검증**

Run: `python3 -m http.server 4173`

검증 항목:

- Storyboard Reset 버튼이 모든 프레임을 트레이로 회수하고 새 무작위 순서를 만든다.
- 정답 확인 직후 플레이어가 열리고 첫 클립 재생을 시도한다.
- 오답 3회 자동 공개에서는 플레이어가 열리지 않는다.
- iframe의 완료 이벤트 직후 `Clear!`가 보이며 Background & Culture 단계가 유지된다.
- Esc로 dialog가 닫히지 않고, `Continue` 클릭 후에만 다음 단계로 이동한다.
- 다른 `window.postMessage({t:'perfectparty-complete'}, '*')` 발신은 무시된다.

- [ ] **Step 8: 전체 정적 검증 및 커밋**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass, 0 fail.

Run: `git diff --check`

Expected: exit 0, whitespace error 없음.

```bash
git add index.html tests/storyboard-party-flow.test.mjs
git commit -m "feat: gate party completion behind clear dialog"
```

### Task 4: 최종 요구사항 및 회귀 검증

**Files:**
- Verify: `index.html`
- Verify: `scripts/update-party-guest-images.mjs`
- Verify: `tests/party-guest-images.test.mjs`
- Verify: `tests/storyboard-party-flow.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-3의 모든 결과.
- Produces: 배포 가능한 단일 페이지와 재실행 가능한 회귀 테스트.

- [ ] **Step 1: 여섯 요구사항 문자열 점검**

Run: `rg -n "Ella Gator|Reset|Play My clips|Harvest Gathering|peking duck|dimsum|Clear!|Continue" index.html tests scripts`

Expected: 새 문구가 메인 문서 또는 디코딩 검증 테스트에 존재하며 이전 사용자 노출 문구는 없음.

- [ ] **Step 2: 전체 테스트 재실행**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass, 0 fail.

- [ ] **Step 3: 변경 범위와 사용자 파일 보호 확인**

Run: `git status --short && git diff --check && git log -4 --oneline`

Expected: `.vscode/`는 untracked 상태를 유지하고, 작업 파일만 커밋되며 whitespace error 없음.
