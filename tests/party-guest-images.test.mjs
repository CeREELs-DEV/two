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
    assert.match(transformed, new RegExp(`${guestId}:\\{`));
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
