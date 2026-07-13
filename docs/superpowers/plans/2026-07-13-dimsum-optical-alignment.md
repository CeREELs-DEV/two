# Dimsum Optical Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perfect Party의 dimsum 그림을 현재 위치에서 왼쪽 `5px`, 아래 `5px` 이동해 다른 음식과 광학적으로 정렬한다.

**Architecture:** `FOODIMG` 매핑과 Perfect Party CSS는 유지하고 `images/DimSum.png`의 `240×240` 투명 캔버스 안에서 불투명 그림만 평행 이동한다. 원본 크기·비율·색상은 바꾸지 않으며 ImageMagick 알파 경계와 기존 Node 테스트로 검증한다.

**Tech Stack:** PNG RGBA, ImageMagick 7, Node.js `node:test`

## Global Constraints

- 출력 크기는 정확히 `240×240` RGBA PNG다.
- dimsum의 현재 불투명 경계 `202×210+19+15`를 `202×210+14+20`으로 변경한다.
- `FOODIMG`, CSS, 음식 이름, 드래그 앤 드롭 로직은 변경하지 않는다.
- 사용자 소유의 `.vscode/`는 변경하거나 커밋하지 않는다.

---

### Task 1: Dimsum PNG 광학 위치 보정

**Files:**
- Modify: `images/DimSum.png`
- Test: `tests/party-guest-images.test.mjs`

**Interfaces:**
- Consumes: Perfect Party가 `FOODIMG.f_dumpling`을 통해 읽는 `images/DimSum.png`
- Produces: 동일 경로·규격을 유지하면서 불투명 그림이 `x -5px`, `y +5px` 이동된 PNG

- [x] **Step 1: 현재 자산이 목표 경계 검증에 실패하는지 확인**

```bash
actual="$(magick images/DimSum.png -format '%@' info:)"
test "$actual" = '202x210+14+20'
```

Expected: FAIL(exit `1`) because the current value is `202x210+19+15`.

- [x] **Step 2: 현재 PNG의 불투명 그림만 왼쪽 5px, 아래 5px 이동**

```bash
magick -size 240x240 canvas:none images/DimSum.png -geometry -5+5 -composite /private/tmp/DimSum-optically-aligned.png
cp /private/tmp/DimSum-optically-aligned.png images/DimSum.png
```

- [x] **Step 3: 목표 경계와 PNG 규격을 검증**

```bash
magick images/DimSum.png -format 'size=%wx%h alpha=%[fx:minima.a]..%[fx:maxima.a] trim=%@\n' info:
```

Expected: `size=240x240 alpha=0..1 trim=202x210+14+20`.

- [x] **Step 4: 기존 음식 자산 테스트와 전체 회귀 테스트 실행**

```bash
node --test tests/party-guest-images.test.mjs
node --test tests/*.test.mjs
git diff --check
```

Expected: focused tests PASS, all tests PASS, and `git diff --check` emits no output.

- [x] **Step 5: 자산 변경 커밋**

```bash
git add images/DimSum.png docs/superpowers/plans/2026-07-13-dimsum-optical-alignment.md
git commit -m "fix: optically align dimsum artwork"
```
