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

function interactiveSentences() {
  const interactSource = sourceBetween('const INTERACT_B=', 'const SPREAD_GUT=')
    .replace('const INTERACT_B=', 'var INTERACT_B=');
  const context = {};
  runInNewContext(interactSource, context);
  return Object.values(context.INTERACT_B).flatMap((paragraphs) => paragraphs.flat());
}

function pages() {
  const pageSource = sourceBetween('const PAGES =', 'const AUDIO =')
    .replace('const PAGES =', 'var PAGES =');
  const context = {};
  runInNewContext(pageSource, context);
  return context.PAGES;
}

test('P3 강조와 P10 단순화 문구를 요청대로 보정한다', () => {
  const sentences = interactiveSentences();
  const awkward = sentences.find((sentence) => sentence.t === 'She’s a little awkward, a little plump, a bit too green, and with a whole lot of personality.');
  const walk = sentences.find((sentence) => sentence.c?.includes('Ella walks to Uncle Jack'));

  assert.ok(awkward);
  assert.equal(awkward.lead, undefined);
  assert.equal(awkward.c[0], 'She’s awkward');
  assert.ok(walk);
  assert.ok(!sentences.some((sentence) => sentence.c?.includes('Ella walks up to Uncle Jack')));
});

test('P4와 P13의 지정 문단에 기존 표준 들여쓰기를 적용한다', () => {
  const storyPages = pages();
  const targetTexts = [
    'She can’t contain her excitement as she sings:',
    'But Uncle Jack doesn’t recognize poor Ella.',
    '“Who are you? And what are you?” He can’t even seem to remember that Ella is an alligator.',
    '“Has his memory gotten that bad, or have I really gained too much weight?” Ella despairs.',
    '“Oh well, I guess I’ll just eat alone…”',
    'No one notices Ella sitting off to the side, all by herself.',
  ];
  const paragraphs = storyPages.flatMap((page) => page.blocks.flatMap((block) => block.paras));

  for (const text of targetTexts) {
    const paragraph = paragraphs.find((item) => item.t === text);
    assert.ok(paragraph, `${text} 문단을 찾을 수 없습니다.`);
    assert.equal(paragraph.ind, 0.06015, `${text} 들여쓰기가 표준값과 다릅니다.`);
  }
});

test('단독 Storyboard 범위를 p. 2-3과 p. 6-7로 표시한다', () => {
  assert.ok(source.includes(`bar.innerHTML='<button class="sbm-tab on solo">p. '+range+'</button>';`));
  assert.ok(!source.includes(`bar.innerHTML='<button class="sbm-tab on solo">pp. '+range+'</button>';`));
});

test('Storyboard 클립 속도를 현재 영상과 이후 재생 경로에 적용한다', () => {
  const speedSource = sourceBetween('function applyPlayerSpeed(){', 'function PAUSE_SVG()');
  const context = {
    SPEEDS: [
      { lab: '0.5×', mult: 0.5 },
      { lab: '1×', mult: 1 },
      { lab: '1.5×', mult: 1.5 },
      { lab: '2×', mult: 2 },
    ],
    spdIndex: 1,
    plVid: { playbackRate: 1 },
  };
  runInNewContext(speedSource, context);

  for (const [index, expected] of [0.5, 1, 1.5, 2].entries()) {
    context.spdIndex = index;
    assert.equal(runInNewContext('applyPlayerSpeed()', context), expected);
    assert.equal(context.plVid.playbackRate, expected);
  }

  const speedButtons = sourceBetween('SPEEDS.forEach(function(sp,i)', 'function applyPlayerSpeed(){');
  const showFrame = sourceBetween('function showFrame(i){', 'function startPlay(){');
  const startPlay = sourceBetween('function startPlay(){', 'function stopPlay(){');
  assert.ok(speedButtons.includes('applyPlayerSpeed();'));
  assert.ok(showFrame.includes('applyPlayerSpeed();'));
  assert.ok(startPlay.includes('applyPlayerSpeed();'));
  assert.ok(source.includes('SP_BASE/SPEEDS[spdIndex].mult'));
});

test('수정된 HTML의 인라인 JavaScript가 모두 컴파일된다', () => {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]);

  assert.equal(scripts.length, 2);
  scripts.forEach((script, index) => {
    assert.doesNotThrow(() => new Function(script), `${index + 1}번 인라인 스크립트 구문 오류`);
  });
});

test('P13의 Oh well과 No one 문단 사이를 다른 섹션 간격과 맞춘다', () => {
  const page13 = pages().find((page) => page.name === 13);
  const blockFor = (text) => page13.blocks.find((block) => block.paras.some((paragraph) => paragraph.t === text));
  const ohWell = blockFor('“Oh well, I guess I’ll just eat alone…”');
  const noOne = blockFor('No one notices Ella sitting off to the side, all by herself.');
  const stageAspectMatch = source.match(/\.cleanstage\{[^}]*aspect-ratio:([0-9.]+)/);
  const spreadGutMatch = source.match(/const SPREAD_GUT=\{0:([0-9.]+)/);
  assert.ok(stageAspectMatch);
  assert.ok(spreadGutMatch);
  const stagePageAspect = (2 - Number(spreadGutMatch[1])) / Number(stageAspectMatch[1]);
  const lineHeightOnStage = (ohWell.paras[0].fs * ohWell.paras[0].lh) / stagePageAspect;
  const actualGap = noOne.y - (ohWell.y + lineHeightOnStage);
  const referenceGap = page13.blocks[1].y - (page13.blocks[0].y + page13.blocks[0].h);

  assert.equal(noOne.y, 0.666);
  assert.ok(
    Math.abs(actualGap - referenceGap) < 0.001,
    `P13 문단 간격 ${actualGap}이 기준 간격 ${referenceGap}과 다릅니다.`,
  );
});

test('P13 No one 첫 문장을 강제 줄바꿈 없이 하나의 문단으로 유지한다', () => {
  const expected = 'No one notices Ella sitting off to the side, all by herself.';
  const page13 = pages().find((page) => page.name === 13);
  const block = page13.blocks.find((item) => item.paras.some((paragraph) => paragraph.t.startsWith('No one notices')));
  const sentence = interactiveSentences().find((item) => item.t === expected);

  assert.equal(block.paras[0].t, expected);
  assert.ok(!block.paras.some((paragraph) => paragraph.t === 'to the side, all by herself.'));
  assert.ok(sentence);
  assert.deepEqual(Array.from(sentence.vocab.notices), ['notices', 'sees']);
  assert.equal(block.paras[0].ind, 0.06015);
});

test('The egg is를 일반 굵기로 유지한다', () => {
  const sentence = interactiveSentences().find((item) => item.lead === 'The egg is');

  assert.ok(sentence);
  assert.match(source, /\.lead\{[^}]*font-weight:400;/);
  assert.ok(!source.includes('.lead{font-family:var(--hand); font-weight:700;'));
});
