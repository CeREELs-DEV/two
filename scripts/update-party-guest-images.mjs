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
