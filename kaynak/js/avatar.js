'use strict';
/* ================= Oyuncunun karakteri =================
   Ten, saç, kıyafet ve aksesuar seçilir; portre SVG olarak çizilir. Seçim SAVE.avatar'da durur
   (cihazda ve Google ile girildiyse hesapta); menüde, oyun başlığında ve masadaki yerinde görünür. */
const AVA_SKIN=['#f0d2bc','#e8c2a6','#d9a982','#c99272','#a8714e','#7a4f36'];
const AVA_HAIR=['#1a120c','#4a2e1a','#8a5a2b','#c79a52','#8a8580','#d9d5cf','#a3281f','#2a4a8a'];
const AVA_OUT=['#1b1b1f','#3b3f6b','#7a1020','#1f5a48','#e8e2d4','#c9a227','#5b2a6e','#6a6a6e'];
const AVA_DEF={skin:'#d9a982',hair:'short',hc:'#2b1b12',top:'shirt',tc:'#3b3f6b',acc:'none'};
const avaGet=()=>Object.assign({},AVA_DEF,(typeof SAVE!=='undefined'&&SAVE.avatar)||{});
function avaShade(c,f){
  const n=parseInt(c.slice(1),16),m=v=>Math.min(255,Math.round(v*f));
  return '#'+((1<<24)+(m(n>>16&255)<<16)+(m(n>>8&255)<<8)+m(n&255)).toString(16).slice(1);
}
function avatarSVG(a,px){
  a=a||avaGet();px=px||64;
  const sk=a.skin,skd=avaShade(sk,.82),hc=a.hc,hcd=avaShade(hc,.7),tc=a.tc,tcd=avaShade(tc,.7);
  const cap=`<path d="M31 42 Q29 19 50 19 Q71 19 69 42 Q65 29 50 29 Q35 29 31 42Z" fill="${hc}"/>`;
  let back='',front='';
  switch(a.hair){
    case 'short':front=cap;break;
    case 'slick':front=`<path d="M31 41 Q30 18 52 19 Q70 20 69 41 Q60 27 44 30 Q35 32 31 41Z" fill="${hc}"/><path d="M40 24 Q52 20 62 26" stroke="${avaShade(hc,1.6)}" stroke-width="1.2" fill="none" opacity=".6"/>`;break;
    case 'curly':front=cap+[[33,30],[40,22],[50,19],[60,22],[67,30],[31,40],[69,40]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="6" fill="${hc}"/>`).join('');break;
    case 'long':back=`<path d="M30 40 Q27 80 36 86 L64 86 Q73 80 70 40Z" fill="${hcd}"/>`;front=cap;break;
    case 'bob':back=`<path d="M29 42 Q27 70 33 73 L67 73 Q73 70 71 42Z" fill="${hcd}"/>`;front=cap+`<path d="M31 40 Q50 28 69 40 L69 33 Q50 21 31 33Z" fill="${hc}"/>`;break;
    case 'bun':front=cap+`<circle cx="50" cy="14" r="7" fill="${hc}"/>`;break;
    case 'ponytail':back=`<path d="M64 28 Q88 34 80 66 Q76 48 66 40Z" fill="${hcd}"/>`;front=cap;break;
    case 'afro':back=`<circle cx="50" cy="34" r="27" fill="${hcd}"/>`;front=cap;break;
    case 'buzz':front=`<path d="M31 42 Q29 19 50 19 Q71 19 69 42 Q65 29 50 29 Q35 29 31 42Z" fill="${hc}" opacity=".55"/>`;break;
    default:break;   // kel
  }
  let body=`<path d="M8 100 Q10 72 38 68 L62 68 Q90 72 92 100Z" fill="${tc}"/>`;
  switch(a.top){
    case 'suit':body+=`<path d="M41 68 L50 92 L59 68Z" fill="#f4f1ea"/><path d="M36 70 L50 98 L38 100 L26 82Z" fill="${tcd}"/><path d="M64 70 L50 98 L62 100 L74 82Z" fill="${tcd}"/><path d="M48 75 L52 75 L53 94 L50 98 L47 94Z" fill="#7a1d2a"/>`;break;
    case 'tux':body+=`<path d="M41 68 L50 92 L59 68Z" fill="#f4f1ea"/><path d="M36 70 L50 98 L38 100 L26 82Z" fill="${avaShade(tc,.45)}"/><path d="M64 70 L50 98 L62 100 L74 82Z" fill="${avaShade(tc,.45)}"/><path d="M43 73 L50 76 L43 79Z M57 73 L50 76 L57 79Z" fill="#111"/>`;break;
    case 'hoodie':body+=`<ellipse cx="50" cy="69" rx="22" ry="8" fill="${tcd}"/><path d="M44 76v12M56 76v12" stroke="#ddd" stroke-width="1.2"/>`;break;
    case 'dress':body+=`<path d="M37 68 Q50 92 63 68Z" fill="${skd}"/>`;break;
    default:body+=`<path d="M38 68 L50 83 L44 66Z" fill="#f4f1ea"/><path d="M62 68 L50 83 L56 66Z" fill="#f4f1ea"/>`;break;   // gömlek
  }
  const neck=`<rect x="43" y="56" width="14" height="16" rx="5" fill="${skd}"/>`;
  const head=`<ellipse cx="32" cy="46" rx="3" ry="5" fill="${sk}"/><ellipse cx="68" cy="46" rx="3" ry="5" fill="${sk}"/><ellipse cx="50" cy="45" rx="18" ry="21" fill="${sk}"/>`;
  const face=`<ellipse cx="43" cy="44" rx="2.6" ry="2" fill="#fff"/><ellipse cx="57" cy="44" rx="2.6" ry="2" fill="#fff"/><circle cx="43" cy="44" r="1.3" fill="#2a1c12"/><circle cx="57" cy="44" r="1.3" fill="#2a1c12"/>`
    +`<path d="M39 39.5 Q43 37.5 47 39.5M53 39.5 Q57 37.5 61 39.5" stroke="${hcd}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    +`<path d="M50 46 Q48 52 50.5 53" stroke="${skd}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    +`<path d="M44 58 Q50 62 56 58" stroke="#7a2e2e" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  let acc='';
  switch(a.acc){
    case 'glasses':acc=`<g fill="none" stroke="#2a2a2a" stroke-width="1.4"><circle cx="43" cy="44" r="5.5"/><circle cx="57" cy="44" r="5.5"/><path d="M48.5 44h3"/></g>`;break;
    case 'sunglasses':acc=`<path d="M36 41 h12 q0 8 -6 8 q-6 0 -6 -8Z M52 41 h12 q0 8 -6 8 q-6 0 -6 -8Z" fill="#111"/><path d="M48 42h4" stroke="#111" stroke-width="1.5"/>`;break;
    case 'mustache':acc=`<path d="M42 56 Q50 51 58 56 Q50 58 42 56Z" fill="${hcd}"/>`;break;
    case 'beard':acc=`<path d="M33 52 Q34 71 50 72 Q66 71 67 52 Q60 63 50 63 Q40 63 33 52Z" fill="${hcd}"/>`;break;
    case 'earrings':acc=`<circle cx="32" cy="53" r="1.9" fill="#d9ad4a"/><circle cx="68" cy="53" r="1.9" fill="#d9ad4a"/>`;break;
    case 'chain':acc=`<path d="M38 71 Q50 84 62 71" stroke="#d9ad4a" stroke-width="2" fill="none"/>`;break;
    case 'cap':acc=`<path d="M30 33 Q50 12 70 33Z" fill="${tcd}"/><rect x="27" y="31" width="46" height="4.5" rx="2" fill="${tc}"/>`;break;
    default:break;
  }
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" class="ava" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#2a1f16"/>${back}${body}${neck}${head}${face}${front}${acc}</svg>`;
}
// 3D masadaki beden için karakter tanımı (sahne.js makePerson biçimi)
function avaDef(){
  const a=avaGet(),hair=a.hair==='bald'?'bald':a.hair;
  const d={sex:a.top==='dress'?'f':'m',age:30,skin:a.skin,hair:[hair,a.hc],expr:1};
  const tc=a.tc;
  if(a.top==='shirt')d.top=['shirt',tc,'#ece8df'];
  else if(a.top==='suit'){d.top=['suit',tc,'#f4f1ea'];d.tie=['tie','#7a1d2a'];}
  else if(a.top==='tux'){d.top=['tux',avaShade(tc,.45),'#f6f4ee'];d.tie=['bow','#0b0b0d'];}
  else if(a.top==='hoodie')d.top=['hoodie',tc,'#ece8df'];
  else d.top=['dress',tc];
  const ac=[];
  if(a.acc==='glasses'||a.acc==='sunglasses'||a.acc==='earrings'||a.acc==='chain')ac.push(a.acc);
  if(a.acc==='mustache'||a.acc==='beard')d.face=[a.acc,a.hc];
  if(a.acc==='cap')d.hat=['cap',a.tc];
  d.acc=ac;
  return d;
}
function refreshAvatars(){document.querySelectorAll('[data-ava]').forEach(e=>{e.innerHTML=avatarSVG(null,+e.dataset.ava);});}
function openAvatar(){
  const a=avaGet();
  const sw=(k,list)=>`<div class="sw-row">${list.map(c=>`<button class="csw" data-k="${k}" data-v="${c}" style="--c:${c}" aria-pressed="${a[k]===c}" aria-label="Renk ${c}"></button>`).join('')}</div>`;
  const seg=(k,opts)=>`<div class="seg wrap">${opts.map(([v,l])=>`<button data-k="${k}" data-v="${v}" aria-pressed="${a[k]===v}">${l}</button>`).join('')}</div>`;
  openModal(`<h3>Karakterim</h3>
    <div class="ava-prev" id="ava-prev">${avatarSVG(a,132)}</div>
    <p class="muted small-p">Masada seni böyle görürler. Seçimin hesabına kaydedilir.</p>
    <div class="set-row ava-row"><b>Ten</b>${sw('skin',AVA_SKIN)}</div>
    <div class="set-row ava-row"><b>Saç</b>${seg('hair',[['short','Kısa'],['slick','Briyantin'],['curly','Kıvırcık'],['long','Uzun'],['bob','Küt'],['bun','Topuz'],['ponytail','At kuyruğu'],['afro','Afro'],['buzz','Kazıtılmış'],['bald','Kel']])}</div>
    <div class="set-row ava-row"><b>Saç rengi</b>${sw('hc',AVA_HAIR)}</div>
    <div class="set-row ava-row"><b>Kıyafet</b>${seg('top',[['shirt','Gömlek'],['suit','Takım'],['tux','Smokin'],['hoodie','Kapüşonlu'],['dress','Elbise']])}</div>
    <div class="set-row ava-row"><b>Kıyafet rengi</b>${sw('tc',AVA_OUT)}</div>
    <div class="set-row ava-row"><b>Aksesuar</b>${seg('acc',[['none','Yok'],['glasses','Gözlük'],['sunglasses','Güneş gözlüğü'],['mustache','Bıyık'],['beard','Sakal'],['earrings','Küpe'],['chain','Zincir'],['cap','Kasket']])}</div>
    <div class="row"><button class="btn" id="ava-ok">Tamam</button></div>`);
  $$('#sheet [data-k]').forEach(b=>b.onclick=()=>{
    a[b.dataset.k]=b.dataset.v;SAVE.avatar=Object.assign({},a);persist();
    $$(`#sheet [data-k="${b.dataset.k}"]`).forEach(x=>x.setAttribute('aria-pressed',x===b));
    $('#ava-prev').innerHTML=avatarSVG(a,132);refreshAvatars();
  });
  $('#ava-ok').onclick=()=>{closeModal();};
}
document.addEventListener('click',e=>{if(e.target.closest('[data-ava]')&&e.target.closest('.me-ava'))openAvatar();});
document.addEventListener('DOMContentLoaded',refreshAvatars);
