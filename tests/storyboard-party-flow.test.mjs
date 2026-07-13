import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function sourceBetween(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} 시작점을 찾을 수 없습니다.`);
  assert.notEqual(to, -1, `${end} 끝점을 찾을 수 없습니다.`);
  return source.slice(from, to);
}

function createStepContext() {
  return {
    flipping: false,
    STEPS: [
      { k: 'cover' }, { k: 'spread', s: 0 }, { k: 'poll' }, { k: 'spread', s: 1 },
      { k: 'spread', s: 2 }, { k: 'spread', s: 3 }, { k: 'party' },
      { k: 'spread', s: 4 }, { k: 'spread', s: 5 }, { k: 'finish' },
    ],
    STEP: 2,
    NAVDIR: 1,
    maxStep: 2,
    pollDone: false,
    activityDone: false,
    ch2Started: false,
    SPREAD: 0,
    PAGES: [{}, {}],
    flipMode: false,
    canLeaveForward() { return false; },
    closeAllActivities() {},
    loadNovel() {},
    renderNodePath() {},
    updateArrows() {},
  };
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

test('Storyboard 확인 버튼 문구를 Check my story로 통일한다', () => {
  assert.ok(source.includes('#sb-checkbtn::after{content:"Check my story";}'));
  assert.match(source, /id="sb-checkbtn" aria-label="Check my story" title="Check my story"/);
  assert.ok(!source.includes('Check my order'));
});

test('스테이지 노드는 완료 상태를 바꾸지 않고 직접 이동한다', () => {
  const nodeSource = sourceBetween('function nodeAction(i){', 'function alignNodePath()');
  const nodeContext = {
    NODES: Array.from({ length: 10 }, () => ({})),
    ch2Started: true,
    maxStep: 0,
    calls: [],
    avatarNodeIdx() { return 0; },
    goStep(i, options) { nodeContext.calls.push({ i, options }); },
  };

  runInNewContext(`${nodeSource}; nodeAction(9);`, nodeContext);
  assert.equal(nodeContext.calls.length, 1);
  assert.equal(nodeContext.calls[0].i, 9);
  assert.equal(nodeContext.calls[0].options.direct, true);

  nodeContext.NODES[8].locked = true;
  runInNewContext('nodeAction(8);', nodeContext);
  assert.equal(nodeContext.calls.length, 1);

  const stepSource = sourceBetween('function goStep(', 'function goNext()');
  const stepContext = createStepContext();
  runInNewContext(`${stepSource}; goStep(3);`, stepContext);
  assert.equal(stepContext.STEP, 2);
  runInNewContext('goStep(3, { direct: true });', stepContext);
  assert.equal(stepContext.STEP, 3);
  assert.equal(stepContext.pollDone, false);

  const partyContext = createStepContext();
  partyContext.STEP = 6;
  partyContext.maxStep = 6;
  runInNewContext(`${stepSource}; goStep(7, { direct: true });`, partyContext);
  assert.equal(partyContext.STEP, 7);
  assert.equal(partyContext.activityDone, false);
  assert.ok(source.includes("aria-label=\"Open '+nodeName+'\""));
});

test('reunion의 쉬운 어휘를 party 대신 gathering으로 제공한다', () => {
  const interactSource = sourceBetween('const INTERACT_B=', 'const SPREAD_GUT=')
    .replace('const INTERACT_B=', 'var INTERACT_B=');
  const context = {};

  assert.doesNotThrow(() => runInNewContext(interactSource, context));
  assert.equal(context.INTERACT_B["It’s a glorious,"][0][1].vocab.reunion[1], 'gathering');
  assert.ok(source.includes("el.setAttribute('aria-label','Tap for a simpler word: '+w);"));
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
  assert.ok(source.includes("if(e.key==='Escape' && !(partyClear && partyClear.open)){ try{closeActivityGate();}catch(_){} }"));
});

test('투표 Submit은 결과를 즉시 표시하고 View results 버튼을 재사용한다', () => {
  const flowSource = sourceBetween('function showSubmittedPollActions(){', 'function enterChapter2(){');
  const listeners = {};
  const calls = [];
  const elements = {
    'poll-actions': { style: {}, innerHTML: '' },
    'poll-see': { addEventListener(type, handler) { listeners[type] = handler; } },
    'poll-results': { style: {} },
    'poll-opts': { style: {} },
  };
  const context = {
    pollSubmitted: false,
    pollDone: false,
    document: { getElementById(id) { return elements[id] || null; } },
    fitPoll() {},
    showPollResults() { calls.push('results'); },
    renderNodePath() { calls.push('nodes'); },
    updateArrows() { calls.push('arrows'); },
  };

  runInNewContext(`${flowSource}; submitVote();`, context);

  assert.equal(context.pollSubmitted, true);
  assert.equal(context.pollDone, true);
  assert.match(elements['poll-actions'].innerHTML, /id="poll-see"/);
  assert.deepEqual(calls, ['results', 'nodes', 'arrows']);
  assert.equal(typeof listeners.click, 'function');
  listeners.click();
  assert.deepEqual(calls, ['results', 'nodes', 'arrows', 'results']);
  assert.ok(!flowSource.includes('goStep('));
});

test('완료한 투표에 재진입하면 View results 동작만 복원한다', () => {
  const openSource = sourceBetween('function openPoll(){', 'function castVote(');
  const calls = [];
  const elements = {
    'poll-opts': { style: {}, innerHTML: '', appendChild() {} },
    'poll-q': { textContent: '' },
    pollmodal: { classList: { remove() {}, add() {} }, setAttribute() {} },
    'poll-results': { style: {}, innerHTML: '' },
    'poll-actions': { style: {}, innerHTML: '' },
  };
  const context = {
    POLL: { q: 'Question', opts: [] },
    pollChoice: 1,
    pollSubmitted: true,
    NAVDIR: 1,
    document: {
      getElementById(id) { return elements[id] || null; },
      createElement() { return {}; },
    },
    window: { scrollTo() {} },
    markPoll() { calls.push('mark'); },
    showSubmittedPollActions() { calls.push('restore'); },
    showSubmit() { calls.push('submit-ui'); },
    submitVote() { calls.push('resubmit'); },
    positionActivity() {},
    fitPoll() {},
  };

  runInNewContext(`${openSource}; openPoll();`, context);

  assert.deepEqual(calls, ['mark', 'restore']);
});
