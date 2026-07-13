import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  extractPartyDocument,
  transformPartyDocument,
} from '../scripts/update-party-guest-images.mjs';

const EXPECTED = {
  g_usa: {
    happy: 'images/Trump_Smile.png',
    normal: 'images/Trump_Normal.png',
    unhappy: 'images/Trump_Angry.png',
  },
  g_china: {
    happy: 'images/Xijingping_Smile.png',
    normal: 'images/Xijingping_Normal.png',
    unhappy: 'images/Xijingping_Angry.png',
  },
  g_korea: {
    happy: 'images/JongUn_Smile.png',
    normal: 'images/JongUn_Normal.png',
    unhappy: 'images/JongUn_Angry.png',
  },
};

const EXPECTED_POSITION_CSS = [
  '.guestwrap[data-id="g_usa"] .guest-img{left:-74px;}',
  '.guestwrap[data-id="g_china"] .guest-img{left:-14px;}',
  '.guestwrap[data-id="g_korea"] .guest-img{left:-134px;}',
];

const CANVAS_HEIGHT = 1252;
const RENDERED_HEIGHT = 210;
const VIEWPORT_HEIGHT = 84;
const IMAGE_TOP = -43;
const HIDDEN_FALLBACK_CSS = '  .gav .guest-fallback[hidden]{display:none;}';
const ALPHA_VERTICAL_BOUNDS = {
  g_usa: { y: 289, height: 433 },
  g_china: { y: 297, height: 426 },
  g_korea: { y: 274, height: 481 },
};

const CONTAIN_CSS = `  .gav{width:100%;max-width:84px;height:84px;margin:0 auto;display:flex;align-items:center;justify-content:center;}
  .gav .guest-img,.gav .guest-fallback,.gav .guest-fallback svg{width:100%;height:100%;display:block;}
  .gav .guest-img{object-fit:contain;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}
  .gav .guest-fallback svg{filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

const TOP_CENTER_CSS = `  .gav{width:100%;max-width:84px;height:84px;margin:0 auto;position:relative;overflow:hidden;}
  .gav .guest-fallback,.gav .guest-fallback svg{width:100%;height:100%;display:block;}
  .gav .guest-img{position:absolute;top:50%;transform:translateY(-50%);height:210px;width:auto;max-width:none;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}
  ${EXPECTED_POSITION_CSS.join('\n  ')}
  .gav .guest-fallback svg{filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

const CROPPED_CSS_WITHOUT_HIDDEN = `  .gav{width:100%;max-width:84px;height:84px;margin:0 auto;position:relative;overflow:hidden;}
  .gav .guest-fallback,.gav .guest-fallback svg{width:100%;height:100%;display:block;}
  .gav .guest-img{position:absolute;top:${IMAGE_TOP}px;height:210px;width:auto;max-width:none;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}
  ${EXPECTED_POSITION_CSS.join('\n  ')}
  .gav .guest-fallback svg{filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

const CROPPED_CSS = CROPPED_CSS_WITHOUT_HIDDEN.replace(
  '  .gav .guest-img{',
  `${HIDDEN_FALLBACK_CSS}\n  .gav .guest-img{`,
);

function mappingLine(guestId, states) {
  return `${guestId}:{happy:'${states.happy}',normal:'${states.normal}',unhappy:'${states.unhappy}'}`;
}

test('Perfect Party 문서에 상태별 게스트 이미지와 SVG fallback을 추가한다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const transformed = transformPartyDocument(extractPartyDocument(source));

  for (const [guestId, states] of Object.entries(EXPECTED)) {
    assert.ok(transformed.includes(mappingLine(guestId, states)), guestId);
  }
  assert.ok(transformed.includes("img.addEventListener('error'"));
  assert.ok(transformed.includes('guestSVG(g.color,state)'));
  assert.ok(transformed.includes(HIDDEN_FALLBACK_CSS));
  assert.ok(transformed.includes('.gav{width:100%;max-width:84px;height:84px;margin:0 auto;position:relative;overflow:hidden;}'));
  assert.ok(transformed.includes(`.gav .guest-img{position:absolute;top:${IMAGE_TOP}px;height:210px;width:auto;max-width:none;`));
  assert.ok(!transformed.includes('top:50%;transform:translateY(-50%);height:210px'));
  for (const rule of EXPECTED_POSITION_CSS) assert.ok(transformed.includes(rule), rule);
});

test('보정된 이미지의 모든 알파 세로 경계가 84px 뷰포트 안에 있다', () => {
  const scale = RENDERED_HEIGHT / CANVAS_HEIGHT;

  for (const [guestId, bounds] of Object.entries(ALPHA_VERTICAL_BOUNDS)) {
    const alphaTop = IMAGE_TOP + bounds.y * scale;
    const alphaBottom = IMAGE_TOP + (bounds.y + bounds.height) * scale;
    assert.ok(alphaTop >= 0, `${guestId} alpha top ${alphaTop}`);
    assert.ok(alphaBottom <= VIEWPORT_HEIGHT, `${guestId} alpha bottom ${alphaBottom}`);
  }
});

test('변환은 재실행해도 결과가 달라지지 않는다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const once = transformPartyDocument(extractPartyDocument(source));
  assert.equal(transformPartyDocument(once), once);
});

test('기존 GUESTIMG 문서의 이전 CSS를 보정 CSS로 업그레이드한다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const current = extractPartyDocument(source);
  const desired = current.includes(CROPPED_CSS)
    ? current
    : current.includes(CROPPED_CSS_WITHOUT_HIDDEN)
      ? current.replace(CROPPED_CSS_WITHOUT_HIDDEN, CROPPED_CSS)
      : current.replace(TOP_CENTER_CSS, CROPPED_CSS);

  assert.ok(desired.includes(CROPPED_CSS), '보정 CSS fixture를 구성해야 한다');
  for (const previousCss of [CONTAIN_CSS, TOP_CENTER_CSS, CROPPED_CSS_WITHOUT_HIDDEN]) {
    const previous = desired.replace(CROPPED_CSS, previousCss);
    assert.notEqual(previous, desired, '이전 CSS fixture를 구성해야 한다');
    assert.equal(transformPartyDocument(previous), desired);
  }
});

test('index.html의 실제 내장 문서와 9개 PNG가 배포 가능한 상태다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const embedded = extractPartyDocument(source);

  assert.ok(embedded.includes('var GUESTIMG='));
  for (const [guestId, states] of Object.entries(EXPECTED)) {
    assert.ok(embedded.includes(mappingLine(guestId, states)), guestId);
    for (const path of Object.values(states)) {
      assert.ok(embedded.includes(path), path);
      await access(new URL(`../${path}`, import.meta.url));
    }
  }
  assert.ok(embedded.includes('height:210px;width:auto;max-width:none;'));
  assert.ok(embedded.includes(HIDDEN_FALLBACK_CSS));
  assert.ok(embedded.includes(`position:absolute;top:${IMAGE_TOP}px;height:210px;`));
  for (const rule of EXPECTED_POSITION_CSS) assert.ok(embedded.includes(rule), rule);
});
