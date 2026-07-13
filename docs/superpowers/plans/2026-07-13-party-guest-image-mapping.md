# Party Guest Image Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perfect Party 미니게임의 세 게스트가 계산된 감정 상태에 맞춰 `images` 폴더의 PNG를 표시하도록 변경한다.

**Architecture:** `index.html`의 `PARTY_B64`를 다루는 작은 Node 변환 모듈을 추가한다. 모듈은 내장 HTML을 디코딩하고 이미지 매핑·렌더링·fallback CSS를 적용한 뒤 다시 인코딩하며, Node 내장 테스트가 변환의 정확성과 실제 내장 결과를 검증한다.

**Tech Stack:** HTML, CSS, 브라우저 JavaScript, Node.js ESM, `node:test`

## Global Constraints

- `g_usa`, `g_china`, `g_korea`의 기존 좌석·음식·점수·완료 규칙은 변경하지 않는다.
- `happy`, `normal`, `unhappy`를 각각 `Smile`, `Normal`, `Angry` PNG에 연결한다.
- PNG 경로 또는 로드 실패 시 기존 `guestSVG()`를 fallback으로 표시한다.
- PNG 원본 비율을 유지하고 기존 `.guestwrap` 드래그 이벤트 구조를 보존한다.
- `.vscode/`는 수정하거나 커밋하지 않는다.

---

### Task 1: Base64 미니게임 변환 모듈과 단위 테스트

**Files:**
- Create: `scripts/update-party-guest-images.mjs`
- Create: `tests/party-guest-images.test.mjs`
- Read: `index.html:1631-1633`

**Interfaces:**
- Produces: `extractPartyDocument(source: string): string`
- Produces: `transformPartyDocument(document: string): string`
- Produces: `replacePartyDocument(source: string, document: string): string`
- Produces: CLI `node scripts/update-party-guest-images.mjs index.html`

- [ ] **Step 1: 변환 계약을 검증하는 실패 테스트 작성**

`tests/party-guest-images.test.mjs`에 다음 테스트를 작성한다.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  extractPartyDocument,
  transformPartyDocument,
} from '../scripts/update-party-guest-images.mjs';

const EXPECTED = {
  g_usa: ['images/Trump_Smile.png', 'images/Trump_Normal.png', 'images/Trump_Angry.png'],
  g_china: ['images/Xijingping_Smile.png', 'images/Xijingping_Normal.png', 'images/Xijingping_Angry.png'],
  g_korea: ['images/JongUn_Smile.png', 'images/JongUn_Normal.png', 'images/JongUn_Angry.png'],
};

test('Perfect Party 문서에 상태별 게스트 이미지와 SVG fallback을 추가한다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const transformed = transformPartyDocument(extractPartyDocument(source));

  for (const [guestId, paths] of Object.entries(EXPECTED)) {
    assert.match(transformed, new RegExp(`${guestId}:\\\\{`));
    for (const path of paths) assert.ok(transformed.includes(path), path);
  }
  assert.ok(transformed.includes("img.addEventListener('error'"));
  assert.ok(transformed.includes('guestSVG(g.color,state)'));
  assert.ok(transformed.includes('.gav .guest-img'));
});

test('변환은 재실행해도 결과가 달라지지 않는다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const once = transformPartyDocument(extractPartyDocument(source));
  assert.equal(transformPartyDocument(once), once);
});
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/update-party-guest-images.mjs`.

- [ ] **Step 3: 최소 변환 모듈 구현**

`scripts/update-party-guest-images.mjs`는 다음 구조로 구현한다.

```js
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PARTY_PATTERN = /const PARTY_B64="([^"]+)";/;
const MARKER = 'var GUESTIMG=';

const GUEST_IMAGES = `  var GUESTIMG={
    g_usa:{happy:'images/Trump_Smile.png',normal:'images/Trump_Normal.png',unhappy:'images/Trump_Angry.png'},
    g_china:{happy:'images/Xijingping_Smile.png',normal:'images/Xijingping_Normal.png',unhappy:'images/Xijingping_Angry.png'},
    g_korea:{happy:'images/JongUn_Smile.png',normal:'images/JongUn_Normal.png',unhappy:'images/JongUn_Angry.png'}
  };`;

const OLD_CSS = `  .gav{width:100%;max-width:84px;margin:0 auto;}
  .gav svg{width:100%;height:100%;display:block;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

const NEW_CSS = `  .gav{width:100%;max-width:84px;height:84px;margin:0 auto;display:flex;align-items:center;justify-content:center;}
  .gav .guest-img,.gav .guest-fallback,.gav .guest-fallback svg{width:100%;height:100%;display:block;}
  .gav .guest-img{object-fit:contain;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}
  .gav .guest-fallback svg{filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

const OLD_GUEST_WRAP = `  function guestWrap(id,mode){
    var g=GMAP[id], e=scoreGuestAt(id,seats);
    var w=document.createElement('div'); w.className='guestwrap'; w.dataset.type='guest'; w.dataset.id=id;
    w.innerHTML='<div class="gav">'+guestSVG(g.color, mode==='seated'?e.face:'unhappy')+'</div>';
    return w;
  }`;

const NEW_GUEST_WRAP = `  function guestWrap(id,mode){
    var g=GMAP[id], e=scoreGuestAt(id,seats), state=mode==='seated'?e.face:'unhappy';
    var w=document.createElement('div'); w.className='guestwrap'; w.dataset.type='guest'; w.dataset.id=id;
    var gav=document.createElement('div'); gav.className='gav';
    var fallback=document.createElement('div'); fallback.className='guest-fallback'; fallback.innerHTML=guestSVG(g.color,state);
    var path=GUESTIMG[id]&&GUESTIMG[id][state];
    if(path){
      var img=document.createElement('img'); img.className='guest-img'; img.src=path; img.alt=g.label;
      fallback.hidden=true;
      img.addEventListener('error',function(){ img.remove(); fallback.hidden=false; });
      gav.appendChild(img);
    }
    gav.appendChild(fallback); w.appendChild(gav);
    return w;
  }`;

export function extractPartyDocument(source) {
  const match = source.match(PARTY_PATTERN);
  if (!match) throw new Error('PARTY_B64를 찾을 수 없습니다.');
  return Buffer.from(match[1], 'base64').toString('utf8');
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} 기준 문자열을 찾을 수 없습니다.`);
  return source.replace(before, after);
}

export function transformPartyDocument(document) {
  if (document.includes(MARKER)) return document;
  let next = replaceOnce(document, OLD_CSS, NEW_CSS, '게스트 CSS');
  next = replaceOnce(next, '  ];\n  var GMAP={};', `  ];\n${GUEST_IMAGES}\n  var GMAP={};`, '게스트 목록');
  return replaceOnce(next, OLD_GUEST_WRAP, NEW_GUEST_WRAP, 'guestWrap');
}

export function replacePartyDocument(source, document) {
  const encoded = Buffer.from(document, 'utf8').toString('base64');
  if (!PARTY_PATTERN.test(source)) throw new Error('PARTY_B64를 찾을 수 없습니다.');
  return source.replace(PARTY_PATTERN, `const PARTY_B64="${encoded}";`);
}

async function main(file) {
  const source = await readFile(file, 'utf8');
  const document = transformPartyDocument(extractPartyDocument(source));
  await writeFile(file, replacePartyDocument(source, document));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] || 'index.html').catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 2 tests PASS, 0 tests FAIL.

- [ ] **Step 5: 변환 모듈과 단위 테스트 커밋**

```bash
git add scripts/update-party-guest-images.mjs tests/party-guest-images.test.mjs
git commit -m "test: cover party guest image mapping"
```

### Task 2: 이미지 매핑 적용과 통합 검증

**Files:**
- Modify: `index.html:1632`
- Modify: `tests/party-guest-images.test.mjs`
- Add: `images/Trump_Smile.png`
- Add: `images/Trump_Normal.png`
- Add: `images/Trump_Angry.png`
- Add: `images/Xijingping_Smile.png`
- Add: `images/Xijingping_Normal.png`
- Add: `images/Xijingping_Angry.png`
- Add: `images/JongUn_Smile.png`
- Add: `images/JongUn_Normal.png`
- Add: `images/JongUn_Angry.png`

**Interfaces:**
- Consumes: `extractPartyDocument(source: string): string`
- Consumes: CLI `node scripts/update-party-guest-images.mjs index.html`
- Produces: `PARTY_B64` 안의 `GUESTIMG` 상태 매핑과 PNG 기반 `guestWrap()` 렌더링

- [ ] **Step 1: 실제 내장 결과와 PNG 파일을 검증하는 실패 테스트 추가**

`tests/party-guest-images.test.mjs`에 다음 테스트를 추가한다.

```js
import { access } from 'node:fs/promises';

test('index.html의 실제 내장 문서와 9개 PNG가 배포 가능한 상태다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const embedded = extractPartyDocument(source);

  assert.ok(embedded.includes('var GUESTIMG='));
  for (const paths of Object.values(EXPECTED)) {
    for (const path of paths) {
      assert.ok(embedded.includes(path), path);
      await access(new URL(`../${path}`, import.meta.url));
    }
  }
});
```

- [ ] **Step 2: 아직 내장 문서가 수정되지 않아 실패하는지 확인**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 2 tests PASS, integration test FAIL at `embedded.includes('var GUESTIMG=')`.

- [ ] **Step 3: 변환 스크립트로 `PARTY_B64` 갱신**

Run: `node scripts/update-party-guest-images.mjs index.html`

Expected: exit code 0; `index.html`의 `PARTY_B64`만 기계적으로 변경됨.

- [ ] **Step 4: 자동 검증 수행**

Run: `node --test tests/party-guest-images.test.mjs`

Expected: 3 tests PASS, 0 tests FAIL.

Run: `git diff --check`

Expected: no output, exit code 0.

- [ ] **Step 5: 브라우저 시각·상호작용 검증**

Run: `python3 -m http.server 4173`

브라우저에서 `http://127.0.0.1:4173/`을 열고 Perfect Party 화면까지 이동하여 다음을 확인한다.

- 대기 상태: 미국/중국/한국 게스트가 각각 Angry 이미지로 보인다.
- 좌석 배치 후 점수 상태: Smile, Normal, Angry 이미지가 계산 결과에 따라 바뀐다.
- PNG가 잘리거나 찌그러지지 않고 84×84 표시 영역 안에서 비율을 유지한다.
- 게스트 드래그, 좌석 교체, 음식 배치, 무드 게이지, 완료 메시지가 동작한다.
- 개발자 도구 네트워크/콘솔에 이미지 404 또는 JavaScript 오류가 없다.

- [ ] **Step 6: 최종 변경 커밋**

```bash
git add index.html images tests/party-guest-images.test.mjs
git commit -m "feat: use state images for party guests"
```

커밋 전 `git status --short`에서 `.vscode/`가 staged 상태가 아닌지 확인한다.
