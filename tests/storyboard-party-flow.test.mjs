import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function sourceBetween(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} 시작점을 찾을 수 없습니다.`);
  assert.notEqual(to, -1, `${end} 끝점을 찾을 수 없습니다.`);
  return source.slice(from, to);
}

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

test('정답을 직접 확인하면 성공 처리 후 Play My clips를 실행한다', () => {
  const check = sourceBetween('function sbCheck(){', 'function sbUnlock()');
  const reveal = sourceBetween('function sbRevealNew(){', 'function sbFlashBar(');

  assert.ok(check.includes('if(correct){ sbSolveNew(); sbPlayAll(); return; }'));
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
  const show = sourceBetween('function showPartyClear(){', "window.addEventListener('message'");

  assert.ok(show.includes('showModal()'));
  assert.ok(!show.includes('finishActivity()'));
  assert.ok(source.includes("partyClear.addEventListener('cancel', function(e){ e.preventDefault(); });"));
  assert.ok(source.includes("partyClearContinue.addEventListener('click', finishActivity);"));
  assert.ok(source.includes('if(partyClear && partyClear.open) partyClear.close();'));
});
