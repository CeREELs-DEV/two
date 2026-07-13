# 착석·드래그 게스트 크기 일치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 착석 PNG의 최종 화면 배율을 드래그 복제본의 `1.06` 배율과 동일하게 유지한다.

**Architecture:** stage 맞춤 함수가 계산한 배율 `sc`로 `--seated-guest-zoom = 1.06 / sc`를 설정한다. `.chair .gav`만 이 CSS 변수를 사용해 확대하며, 변환 스크립트는 기존 CSS와 stage 맞춤 JavaScript를 새 규칙으로 마이그레이션한다.

**Tech Stack:** HTML/CSS, JavaScript ES modules, Node.js test runner

## Global Constraints

- PNG 매핑, 이미지별 crop 위치, 감정 상태, 드래그 복제본 크기 및 SVG 오류 fallback은 변경하지 않는다.
- 착석 게스트의 `left:50%`와 `translateX(-50%)` 중앙 정렬을 유지한다.
- 대기 중인 게스트에는 역보정 확대를 적용하지 않는다.

---

### Task 1: 착석 PNG의 화면 배율을 드래그 PNG와 일치시키기

**Files:**
- Modify: `tests/party-guest-images.test.mjs`
- Modify: `scripts/update-party-guest-images.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `transformPartyDocument(document: string): string`, stage 배율 `sc: number`
- Produces: CSS 변수 `--seated-guest-zoom`과 `.chair .gav` 전용 확대 규칙

- [x] **Step 1: 실패하는 동적 배율 테스트 작성**

`tests/party-guest-images.test.mjs`에 다음 기대 문자열을 추가한다.

```js
const SEATED_ZOOM_CSS = '  .chair .gav{transform:scale(var(--seated-guest-zoom,1));}';
const SEATED_ZOOM_UPDATE = "stageEl.style.setProperty('--seated-guest-zoom',String(1.06/sc));";
```

변환 결과와 실제 내장 문서에 두 문자열이 존재하는지 검증하고, 계산식의 불변 조건을 테스트한다.

```js
for (const stageScale of [0.5, 0.75, 1, 1.6]) {
  const seatedZoom = 1.06 / stageScale;
  assert.ok(Math.abs(stageScale * seatedZoom - 1.06) < Number.EPSILON * 4);
}
```

또한 `.guestwrap{...}` 또는 `.guests .gav`에 확대 규칙이 추가되지 않았는지 확인한다.

- [x] **Step 2: 테스트가 새 CSS·JavaScript 부재로 실패하는지 확인**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 기존 테스트는 통과하고 동적 착석 확대 관련 assertion만 FAIL한다.

- [x] **Step 3: CSS와 stage 맞춤 JavaScript 마이그레이션 구현**

`scripts/update-party-guest-images.mjs`에 현재 착석 CSS와 확대 CSS가 결합된 기준 문자열을 추가하고, 이전 문자열을 다음 결과로 교체한다.

```css
  .chair .guestwrap{position:absolute;bottom:var(--guest-sit);left:50%;transform:translateX(-50%);width:84px;max-width:100%;z-index:2;}
  .chair .gav{transform:scale(var(--seated-guest-zoom,1));}
```

기존 중복 stage 맞춤 코드를 다음 구조로 교체한다.

```js
window.__fit=function(){
  var h=stageEl.offsetHeight;
  if(!h)return;
  var sc=Math.min(window.innerWidth/1420, window.innerHeight/h, 1.6);
  applyScale(sc);
};
function applyScale(sc){
  stageEl.style.transform='scale('+sc+')';
  stageEl.style.setProperty('--seated-guest-zoom',String(1.06/sc));
}
function fit(){
  var h=stageEl.offsetHeight;
  if(!h)return;
  var sc=Math.min(window.innerWidth/1420, window.innerHeight/h, 1.6);
  applyScale(sc);
}
```

실제 내장 형식은 기존 한 줄 스타일을 유지하되, `applyScale(sc)`를 최초 로드와 리사이즈 양쪽에서 공유한다. 이미 변환된 문서는 재실행해도 변경되지 않아야 한다.

- [x] **Step 4: 내장 문서 갱신 및 전체 테스트 실행**

Run: `node scripts/update-party-guest-images.mjs index.html`

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 모든 테스트 PASS, stage 최종 배율과 착석 확대율의 곱이 `1.06`이다.

- [x] **Step 5: 변경 범위와 공백 오류 확인**

Run: `git diff --check`

Expected: 출력 없이 exit code 0.

- [x] **Step 6: 커밋**

```bash
git add index.html scripts/update-party-guest-images.mjs tests/party-guest-images.test.mjs docs/superpowers/plans/2026-07-13-party-seated-guest-drag-size.md
git commit -m "fix: match seated guest drag size"
```
