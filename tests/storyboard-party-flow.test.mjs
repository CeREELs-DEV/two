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
