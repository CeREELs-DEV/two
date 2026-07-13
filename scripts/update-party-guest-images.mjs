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

const CONTAIN_CSS = `  .gav{width:100%;max-width:84px;height:84px;margin:0 auto;display:flex;align-items:center;justify-content:center;}
  .gav .guest-img,.gav .guest-fallback,.gav .guest-fallback svg{width:100%;height:100%;display:block;}
  .gav .guest-img{object-fit:contain;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}
  .gav .guest-fallback svg{filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

const TOP_CENTER_CSS = `  .gav{width:100%;max-width:84px;height:84px;margin:0 auto;position:relative;overflow:hidden;}
  .gav .guest-fallback,.gav .guest-fallback svg{width:100%;height:100%;display:block;}
  .gav .guest-img{position:absolute;top:50%;transform:translateY(-50%);height:210px;width:auto;max-width:none;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}
  .guestwrap[data-id="g_usa"] .guest-img{left:-74px;}
  .guestwrap[data-id="g_china"] .guest-img{left:-14px;}
  .guestwrap[data-id="g_korea"] .guest-img{left:-134px;}
  .gav .guest-fallback svg{filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

// 1252px 원본 높이를 210px로 균일 확대하면 알파 영역은 약 55~60px × 72~81px가 된다.
// left는 알파 영역을 가로 중앙에 두고, top -43px는 세 이미지의 알파 세로 경계를 0~84px 안에 둔다.
const CROPPED_CSS_WITHOUT_HIDDEN = `  .gav{width:100%;max-width:84px;height:84px;margin:0 auto;position:relative;overflow:hidden;}
  .gav .guest-fallback,.gav .guest-fallback svg{width:100%;height:100%;display:block;}
  .gav .guest-img{position:absolute;top:-43px;height:210px;width:auto;max-width:none;filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}
  .guestwrap[data-id="g_usa"] .guest-img{left:-74px;}
  .guestwrap[data-id="g_china"] .guest-img{left:-14px;}
  .guestwrap[data-id="g_korea"] .guest-img{left:-134px;}
  .gav .guest-fallback svg{filter:drop-shadow(0 2px 3px rgba(150,120,70,.28));}`;

const COLLAPSED_CROPPED_CSS = CROPPED_CSS_WITHOUT_HIDDEN.replace(
  '  .gav .guest-img{',
  '  .gav .guest-fallback[hidden]{display:none;}\n  .gav .guest-img{',
);

const NEW_CSS = COLLAPSED_CROPPED_CSS.replace(
  '.gav{width:100%;max-width:84px;',
  '.gav{width:84px;max-width:100%;',
);

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
  let next = document;
  if (next.includes(OLD_CSS)) next = replaceOnce(next, OLD_CSS, NEW_CSS, '게스트 CSS');
  else if (next.includes(CONTAIN_CSS)) next = replaceOnce(next, CONTAIN_CSS, NEW_CSS, '게스트 CSS 업그레이드');
  else if (next.includes(TOP_CENTER_CSS)) next = replaceOnce(next, TOP_CENTER_CSS, NEW_CSS, '게스트 세로 CSS 업그레이드');
  else if (next.includes(COLLAPSED_CROPPED_CSS)) next = replaceOnce(next, COLLAPSED_CROPPED_CSS, NEW_CSS, '게스트 너비 CSS 업그레이드');
  else if (next.includes(CROPPED_CSS_WITHOUT_HIDDEN)) next = replaceOnce(next, CROPPED_CSS_WITHOUT_HIDDEN, NEW_CSS, '게스트 fallback CSS 업그레이드');
  else if (!next.includes(NEW_CSS)) throw new Error('게스트 CSS 기준 문자열을 찾을 수 없습니다.');

  if (!next.includes(MARKER)) {
    next = replaceOnce(next, '  ];\n  var GMAP={};', `  ];\n${GUEST_IMAGES}\n  var GMAP={};`, '게스트 목록');
  }
  if (next.includes(OLD_GUEST_WRAP)) return replaceOnce(next, OLD_GUEST_WRAP, NEW_GUEST_WRAP, 'guestWrap');
  if (!next.includes(NEW_GUEST_WRAP)) throw new Error('guestWrap 기준 문자열을 찾을 수 없습니다.');
  return next;
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
