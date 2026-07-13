# 착석 게스트 크기·정렬 보정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 의자에 배치된 게스트도 대기 상태와 같은 84px 이미지 뷰포트와 중앙 정렬을 유지한다.

**Architecture:** Perfect Party 내장 문서의 착석 `.guestwrap` 규칙을 `84px` 기준으로 변경한다. 변환 스크립트가 기존 `66%` 규칙을 새 규칙으로 마이그레이션하고, 회귀 테스트가 변환 결과와 실제 `PARTY_B64`를 모두 검증한다.

**Tech Stack:** HTML/CSS, JavaScript ES modules, Node.js test runner

## Global Constraints

- PNG 매핑, 감정 상태 선택, 세로 위치, 드래그 동작 및 SVG 오류 fallback은 변경하지 않는다.
- 착석 게스트는 `left:50%`와 `translateX(-50%)` 중앙 정렬을 유지한다.
- 좁은 화면에서는 `max-width:100%`로 의자 너비를 넘지 않는다.

---

### Task 1: 착석 이미지 뷰포트 고정

**Files:**
- Modify: `tests/party-guest-images.test.mjs`
- Modify: `scripts/update-party-guest-images.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `transformPartyDocument(document: string): string`
- Produces: 기존 착석 CSS를 `width:84px;max-width:100%`로 마이그레이션하는 변환 결과

- [x] **Step 1: 실패하는 착석 너비 회귀 테스트 작성**

`tests/party-guest-images.test.mjs`에 다음 상수를 추가한다.

```js
const OLD_SEATED_GUEST_CSS = '  .chair .guestwrap{position:absolute;bottom:var(--guest-sit);left:50%;transform:translateX(-50%);width:66%;z-index:2;}';
const SEATED_GUEST_CSS = '  .chair .guestwrap{position:absolute;bottom:var(--guest-sit);left:50%;transform:translateX(-50%);width:84px;max-width:100%;z-index:2;}';
```

변환 테스트와 실제 내장 문서 테스트에 아래 검증을 추가하고, 이전 규칙 마이그레이션 테스트를 추가한다.

```js
assert.ok(transformed.includes(SEATED_GUEST_CSS));
assert.ok(!transformed.includes(OLD_SEATED_GUEST_CSS));

test('기존 착석 너비 규칙을 84px 중앙 정렬 규칙으로 업그레이드한다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const current = extractPartyDocument(source);
  const previous = current.replace(SEATED_GUEST_CSS, OLD_SEATED_GUEST_CSS);
  assert.notEqual(previous, current);
  assert.equal(transformPartyDocument(previous), current);
});
```

- [x] **Step 2: 테스트가 올바른 이유로 실패하는지 확인**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 착석 CSS가 아직 `width:66%`여서 새 assertion 또는 마이그레이션 테스트가 FAIL한다.

- [x] **Step 3: 최소 변환 로직 구현**

`scripts/update-party-guest-images.mjs`에 다음 상수와 변환을 추가한다.

```js
const OLD_SEATED_GUEST_CSS = '  .chair .guestwrap{position:absolute;bottom:var(--guest-sit);left:50%;transform:translateX(-50%);width:66%;z-index:2;}';
const NEW_SEATED_GUEST_CSS = '  .chair .guestwrap{position:absolute;bottom:var(--guest-sit);left:50%;transform:translateX(-50%);width:84px;max-width:100%;z-index:2;}';
```

`transformPartyDocument`의 게스트 이미지 CSS 변환 뒤에 다음을 추가한다.

```js
if (next.includes(OLD_SEATED_GUEST_CSS)) {
  next = replaceOnce(next, OLD_SEATED_GUEST_CSS, NEW_SEATED_GUEST_CSS, '착석 게스트 CSS');
} else if (!next.includes(NEW_SEATED_GUEST_CSS)) {
  throw new Error('착석 게스트 CSS 기준 문자열을 찾을 수 없습니다.');
}
```

- [x] **Step 4: 실제 내장 문서 갱신 및 전체 테스트**

Run: `node scripts/update-party-guest-images.mjs index.html`

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 모든 테스트 PASS, `index.html`의 내장 문서에 `width:84px;max-width:100%`가 포함된다.

- [x] **Step 5: 변경 무결성 확인**

Run: `git diff --check`

Expected: 출력 없이 exit code 0.

- [x] **Step 6: 커밋**

```bash
git add index.html scripts/update-party-guest-images.mjs tests/party-guest-images.test.mjs docs/superpowers/plans/2026-07-13-party-seated-guest-sizing.md
git commit -m "fix: keep seated party guests full size"
```
