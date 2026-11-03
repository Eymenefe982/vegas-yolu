'use strict';
/* ================= Yardımcılar ================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=Math.random;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function gauss(){let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const nf=new Intl.NumberFormat('tr-TR');
const pct=x=>'%'+Math.round(x*100);

/* ================= Kayıt ================= */
const STORE='vegas-yolu-v1';
// Telefon/tablet: varsayılan grafik "Dengeli", dokunmatik ipuçları
const MOBILE=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&!!window.matchMedia&&matchMedia('(pointer:coarse)').matches);
// Kariyer cüzdanı: oyuna bu parayla başlarsın; masaya giriş ücretiyle oturur, kalkınca fişlerini nakde çevirirsin.
const START_CASH=20000;
const defSave=()=>({unlocked:1,conquered:[],seen:[],ach:{},cash:START_CASH,rep:{},stats:{hands:0,won:0,best:0,bestCur:'₺'},settings:{speed:'normal',four:false,free:false,sound:true,view:'3d',notes:true,follow:true,gfx:MOBILE?'mid':'high',bright:'normal',boardHud:true,talk:true}});
function mergeSave(s){const d=defSave();return Object.assign(d,s,{stats:Object.assign(d.stats,s.stats||{}),settings:Object.assign(d.settings,s.settings||{}),rep:s.rep||{},_old:s.cash==null});}
function loadSave(){
  try{const raw=localStorage.getItem(STORE);if(raw)return mergeSave(JSON.parse(raw));}catch(e){}
  return defSave();
}
let SAVE=loadSave();
// Web sürümünde Google ile giriş yapılmışsa js/bulut.js kayıt değişikliklerini buluta da yollar.
function persist(){try{localStorage.setItem(STORE,JSON.stringify(SAVE));}catch(e){}if(window.onPersist)window.onPersist();}

/* ================= Ses (Web Audio ile sentezlenir) ================= */
const SFX=(()=>{
  let ctx=null,master=null,nb=null;
  function init(){
    if(ctx)return ctx;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    try{ctx=new AC();}catch(e){return null;}
    master=ctx.createGain();master.gain.value=.7;master.connect(ctx.destination);
    const len=Math.floor(ctx.sampleRate*.6);nb=ctx.createBuffer(1,len,ctx.sampleRate);
    const d=nb.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    return ctx;
  }
  function unlock(){const c=init();if(c&&c.state==='suspended')c.resume().catch(()=>{});}
  const ready=()=>SAVE.settings.sound!==false&&ctx&&ctx.state==='running';
  let vs=1;   // uzaktan gelen ortam olayları için ses ölçeği
  function env(g,t,vol,att,dur){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol*vs),t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);}
  function noise(t,o){
    const dur=o.dur||.06;
    const src=ctx.createBufferSource();src.buffer=nb;src.playbackRate.value=o.rate||1;if(dur>.45)src.loop=true;
    const f=ctx.createBiquadFilter();f.type=o.type||'bandpass';f.Q.value=o.q||1;
    f.frequency.setValueAtTime(o.f||3000,t);if(o.f2)f.frequency.exponentialRampToValueAtTime(o.f2,t+dur);
    const g=ctx.createGain();env(g,t,o.vol||.4,o.att||.002,dur);
    src.connect(f);f.connect(g);g.connect(master);
    src.start(t,Math.random()*.4);src.stop(t+dur+.03);
  }
  function tone(t,o){
    const osc=ctx.createOscillator();osc.type=o.type||'sine';osc.frequency.setValueAtTime(o.f,t);
    if(o.f2)osc.frequency.exponentialRampToValueAtTime(o.f2,t+o.dur);
    const g=ctx.createGain();env(g,t,o.vol||.2,o.att||.002,o.dur);
    osc.connect(g);g.connect(master);osc.start(t);osc.stop(t+o.dur+.03);
  }
  const R=Math.random;
  const clack=t=>{tone(t,{f:3000+R()*1800,dur:.03,vol:.09,type:'triangle'});tone(t,{f:5200+R()*1500,dur:.02,vol:.05,type:'square'});noise(t,{f:4800,q:2.5,dur:.025,vol:.22});};
  const P={
    deal(t){noise(t,{f:2400+R()*900,q:.8,dur:.075,vol:.42,att:.004});noise(t+.01,{type:'highpass',f:6500,dur:.03,vol:.12});},
    flip(t){noise(t,{f:1500+R()*300,q:1.1,dur:.045,vol:.45});noise(t+.04,{f:3300,q:.9,dur:.05,vol:.32});},
    shuffle(t){for(let i=0;i<16;i++)noise(t+i*.026+R()*.008,{f:1900+R()*1800,q:.8,dur:.04,vol:.13+R()*.1});noise(t+.46,{type:'lowpass',f:900,dur:.07,vol:.35});},
    chip(t,n=2){let x=t;for(let i=0;i<n;i++){clack(x);x+=.04+R()*.035;}},
    allin(t){P.chip(t,7);tone(t,{f:120,f2:70,dur:.18,vol:.35});},
    check(t){for(const d of [0,.12]){tone(t+d,{f:160,f2:95,dur:.09,vol:.42});noise(t+d,{type:'lowpass',f:500,dur:.04,vol:.25});}},
    fold(t){noise(t,{type:'lowpass',f:2200,f2:280,dur:.2,vol:.26,att:.025,q:.7});},
    sweep(t){noise(t,{type:'bandpass',f:1200,f2:2600,dur:.22,vol:.16,att:.04,q:.6});P.chip(t+.16,2);},
    pot(t){let x=t;for(let i=0;i<11;i++){clack(x);x+=.03+i*.006+R()*.02;}},
    win(t){P.pot(t);[523.25,659.25,783.99].forEach((f,i)=>tone(t+.05+i*.09,{f,dur:.32,vol:.07,att:.01}));},
    turn(t){tone(t,{f:740,dur:.16,vol:.06,att:.01});tone(t+.09,{f:1108,dur:.24,vol:.05,att:.01});},
    ach(t){[659.25,830.6,987.77,1318.5].forEach((f,i)=>tone(t+i*.09,{f,dur:.4,vol:.08,att:.01}));},
    bell(t){tone(t,{f:880,dur:1,vol:.09,att:.004});tone(t+.01,{f:1760,dur:.7,vol:.04,att:.004});tone(t,{f:2640,dur:.4,vol:.02,att:.004});},
    step(t){noise(t,{type:'lowpass',f:380+R()*120,dur:.09,vol:.32,att:.004});noise(t+.01,{f:1800,q:.7,dur:.03,vol:.05});},
    chair(t){noise(t,{type:'bandpass',f:700,f2:420,q:3,dur:.32,vol:.2,att:.03});noise(t+.3,{type:'lowpass',f:300,dur:.12,vol:.35});},
    car(t){vs=.6;noise(t,{type:'lowpass',f:160,f2:650,dur:1.5,vol:.2,att:1.1});noise(t+1.4,{type:'lowpass',f:650,f2:150,dur:1.3,vol:.18,att:.05});vs=1;},
  };
  // Ortam sesi: salonun mırıltısı (kahverengi gürültü) ve ara sıra uzaktan olaylar
  let amb=null,ab=null;
  function ambBuf(){if(ab)return ab;const len=ctx.sampleRate*4;ab=ctx.createBuffer(1,len,ctx.sampleRate);const d=ab.getChannelData(0);let l=0;for(let i=0;i<len;i++){l=(l+.02*(Math.random()*2-1))/1.02;d[i]=l*3.5;}return ab;}
  function ambient(kind){
    if(amb){try{amb.src.stop();}catch(e){}clearInterval(amb.it);try{amb.g.disconnect();}catch(e){}amb=null;}
    if(!kind)return;const c=init();if(!c)return;
    const g=ctx.createGain();g.gain.value=0;g.connect(master);
    const src=ctx.createBufferSource();src.buffer=ambBuf();src.loop=true;
    const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value={kacak:260,kiraathane:300,yeralti:340,han:360,yali:380,antrenman:300,girne:420,monte:380,macau:440,vegas:520,suit:400}[kind]||350;f.Q.value=.5;
    src.connect(f);f.connect(g);src.start();
    const base={kacak:.14,kiraathane:.17,yeralti:.18,han:.2,yali:.15,antrenman:.08,girne:.22,monte:.16,macau:.24,vegas:.28,suit:.14}[kind]||.14;
    const tick=()=>{
      if(!ctx)return;const on=SAVE.settings.sound!==false&&ctx.state==='running';
      g.gain.setTargetAtTime(on?base*(.65+Math.random()*.7):0,ctx.currentTime,.9);
      if(!on)return;const r=Math.random(),t=ctx.currentTime+.05;
      try{
        if((kind==='vegas'||kind==='macau')&&r<.28){vs=.16;[1318.5,1568,2093].forEach((fq,i)=>tone(t+i*.08,{f:fq,dur:.18,vol:.08}));vs=1;}
        else if((kind==='girne'||kind==='monte'||kind==='vegas'||kind==='yali'||kind==='macau'||kind==='suit')&&r>.7){vs=.2;P.chip(t,2+Math.floor(Math.random()*4));vs=1;}
        else if((kind==='kacak'||kind==='yeralti'||kind==='antrenman'||kind==='kiraathane'||kind==='han')&&r<.16){vs=.28;tone(t,{f:2600+Math.random()*400,dur:.12,vol:.08});tone(t+.01,{f:3900,dur:.09,vol:.04});vs=1;}
      }catch(e){vs=1;}
    };
    const it=setInterval(tick,1400);tick();
    amb={src,g,it};
  }
  // Uygulama arka plana alınınca ya da pencere küçültülünce ses susar
  document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden)ctx.suspend().catch(()=>{});else ctx.resume().catch(()=>{});});
  return {unlock,ambient,play(name,...a){if(!ready())return;try{P[name](ctx.currentTime+.005,...a);}catch(e){vs=1;}}};
})();
['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,SFX.unlock,{passive:true,capture:true}));

/* ================= Kartlar ================= */
const RCH='23456789TJQKA';
const RLAB=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RTR=['İki','Üç','Dört','Beş','Altı','Yedi','Sekiz','Dokuz','On','Vale','Kız','Papaz','As'];
const RPL=['İkiler','Üçler','Dörtler','Beşler','Altılar','Yediler','Sekizler','Dokuzlar','Onlar','Valeler','Kızlar','Papazlar','Aslar'];
const SS=['♠︎','♥︎','♦︎','♣︎'];
const STR=['Maça','Kupa','Karo','Sinek'];
const CAT=['Yüksek Kart','Per','Döper','Üçlü','Kent','Floş','Ful','Kare','Sıralı Floş','Royal Floş'];
const CAT_EN=['High Card','One Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush','Royal Flush'];
function pc(s){const su='shdc'.indexOf(s.slice(-1));let r=s.slice(0,-1).toUpperCase();if(r==='10')r='T';return RCH.indexOf(r)*4+su;}
const pcs=s=>s.trim().split(/\s+/).map(pc);
function newDeck(){const d=[];for(let i=0;i<52;i++)d.push(i);for(let i=51;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=d[i];d[i]=d[j];d[j]=t;}return d;}
function cardHTML(c,cls=''){
  if(c==null||c<0)return `<span class="card back ${cls}" aria-label="Kapalı kart"></span>`;
  const r=c>>2,s=c&3;
  return `<span class="card s${s} ${cls}" aria-label="${RTR[r]} ${STR[s]}"><span class="ci"><b>${RLAB[r]}</b><i>${SS[s]}</i></span><span class="cp">${SS[s]}</span></span>`;
}
const ctxt=c=>RLAB[c>>2]+SS[c&3];
const ic=list=>(typeof list==='string'?pcs(list):list).map(c=>`<span class="ic s${c&3}">${ctxt(c)}</span>`).join(' ');

/* ================= El değerlendirici ================= */
const B5=1048576;
function straightHi(m){for(let h=12;h>=4;h--)if(((m>>(h-4))&31)===31)return h;if((m&0x100F)===0x100F)return 3;return -1;}
function pack(cat,a){let s=cat;for(let i=0;i<5;i++){const v=a[i];s=s*16+(v!=null&&v>=0?v+1:0);}return s;}
function kick(rc,ex,n){const o=[];for(let r=12;r>=0&&o.length<n;r--)if(rc[r]&&ex.indexOf(r)<0)o.push(r);return o;}
function evalCards(cs){
  const rc=[0,0,0,0,0,0,0,0,0,0,0,0,0],sc=[0,0,0,0],sm=[0,0,0,0];let rm=0;
  for(let i=0;i<cs.length;i++){const c=cs[i],r=c>>2,s=c&3;rc[r]++;sc[s]++;sm[s]|=1<<r;rm|=1<<r;}
  let fs=-1;for(let s=0;s<4;s++)if(sc[s]>=5)fs=s;
  if(fs>=0){const h=straightHi(sm[fs]);if(h>=0)return pack(h===12?9:8,[h]);}
  let quad=-1;const trips=[],pairs=[];
  for(let r=12;r>=0;r--){const n=rc[r];if(n===4)quad=r;else if(n===3)trips.push(r);else if(n===2)pairs.push(r);}
  if(quad>=0)return pack(7,[quad,kick(rc,[quad],1)[0]]);
  if(trips.length&&(trips.length>1||pairs.length)){const p=trips.length>1?Math.max(trips[1],pairs.length?pairs[0]:-1):pairs[0];return pack(6,[trips[0],p]);}
  if(fs>=0){const o=[];for(let r=12;r>=0&&o.length<5;r--)if((sm[fs]>>r)&1)o.push(r);return pack(5,o);}
  const sh=straightHi(rm);if(sh>=0)return pack(4,[sh]);
  if(trips.length)return pack(3,[trips[0]].concat(kick(rc,[trips[0]],2)));
  if(pairs.length>=2)return pack(2,[pairs[0],pairs[1]].concat(kick(rc,[pairs[0],pairs[1]],1)));
  if(pairs.length===1)return pack(1,[pairs[0]].concat(kick(rc,[pairs[0]],3)));
  return pack(0,kick(rc,[],5));
}
const catOf=s=>Math.floor(s/B5);
function decode(s){const d=[];let x=s;for(let i=0;i<5;i++){d.unshift(x%16-1);x=Math.floor(x/16);}return {cat:x,r:d};}
function describe(score){
  const {cat,r}=decode(score);
  switch(cat){
    case 0:return `Yüksek Kart: ${RTR[r[0]]}`;
    case 1:return `Per: ${RPL[r[0]]}`;
    case 2:return `Döper: ${RPL[r[0]]} ve ${RPL[r[1]]}`;
    case 3:return `Üçlü: ${RPL[r[0]]}`;
    case 4:return `Kent: ${RTR[r[0]]} yüksek`;
    case 5:return `Floş: ${RTR[r[0]]} yüksek`;
    case 6:return `Ful: ${RPL[r[0]]} ve ${RPL[r[1]]}`;
    case 7:return `Kare: ${RPL[r[0]]}`;
    case 8:return `Sıralı Floş: ${RTR[r[0]]} yüksek`;
    default:return 'Royal Floş';
  }
}
function best5(cs){
  if(cs.length<=5)return cs.slice();
  const full=evalCards(cs),n=cs.length;
  for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)for(let c=b+1;c<n;c++)for(let d=c+1;d<n;d++)for(let e=d+1;e<n;e++){
    const h=[cs[a],cs[b],cs[c],cs[d],cs[e]];if(evalCards(h)===full)return h;
  }
  return cs.slice(0,5);
}
function equity(hole,board,nOpp,iters){
  const used=new Set(hole.concat(board));const deck=[];for(let c=0;c<52;c++)if(!used.has(c))deck.push(c);
  const need=5-board.length,k=need+2*nOpp,L=deck.length;let win=0;
  for(let it=0;it<iters;it++){
    for(let i=0;i<k;i++){const j=i+Math.floor(rnd()*(L-i));const t=deck[i];deck[i]=deck[j];deck[j]=t;}
    const b=need?board.concat(deck.slice(0,need)):board;
    const my=evalCards(hole.concat(b));let ties=0,lose=false;
    for(let o=0;o<nOpp;o++){const s=evalCards([deck[need+2*o],deck[need+2*o+1]].concat(b));if(s>my){lose=true;break;}if(s===my)ties++;}
    if(!lose)win+=1/(ties+1);
  }
  return win/iters;
}
function countOuts(hole,board){
  const cur=evalCards(hole.concat(board)),cc=catOf(cur);
  const used=new Set(hole.concat(board));const maxB=Math.max(...board.map(c=>c>>2));let n=0;
  for(let c=0;c<52;c++){
    if(used.has(c))continue;
    const s=evalCards(hole.concat(board,[c])),nc=catOf(s);
    if(nc<=cc)continue;
    if(nc<=catOf(evalCards(board.concat([c]))))continue;
    if(nc===1&&decode(s).r[0]<=maxB)continue;
    n++;
  }
  const all=hole.concat(board);const draws=[];
  if(board.length<5){
    const sc=[0,0,0,0];all.forEach(c=>sc[c&3]++);
    const fsu=sc.findIndex(x=>x===4);
    if(fsu>=0&&hole.some(c=>(c&3)===fsu))draws.push('floş çekilişi');
    let m=0;all.forEach(c=>m|=1<<(c>>2));
    if(straightHi(m)<0&&cc<4){let k=0;for(let r=0;r<13;r++)if(!((m>>r)&1)&&straightHi(m|1<<r)>=0)k++;if(k>=2)draws.push('açık uçlu kent çekilişi');else if(k===1)draws.push('ortadan kent çekilişi (gutshot)');}
  }
  return {n,draw:draws.join(' + ')};
}

/* ================= Başlangıç elleri ================= */
const TIER_LIST={1:'AA KK QQ JJ AKs AKo',2:'TT 99 AQs AJs KQs AQo',3:'88 77 ATs KJs QJs JTs KTs QTs AJo KQo ATo',4:'66 55 44 33 22 A9s A8s A7s A6s A5s A4s A3s A2s K9s Q9s J9s T9s 98s 87s 76s 65s 54s T8s 97s KJo QJo JTo KTo QTo A9o'};
const TIER={};for(const t in TIER_LIST)TIER_LIST[t].split(' ').forEach(k=>TIER[k]=+t);
const TIER_NAME=['','Premium','Güçlü','İyi','Spekülatif','Zayıf'];
const TIER_ADV=['','Her pozisyondan artır; önünde artış varsa yeniden artır.','Çoğu pozisyondan artırarak gir; büyük bir yeniden artışa karşı dikkatli ol.','Orta ve geç pozisyonda oyna; erken pozisyonda ve büyük artışlara karşı temkinli ol.','Geç pozisyonda, ucuza flop görebiliyorsan oyna. Amaç güçlü bir el yakalamak.','Çoğu durumda çekil. Ancak büyük körde bedavaysa flop görebilirsin.'];
function handKey(cs){let a=cs[0],b=cs[1];if((b>>2)>(a>>2)){const t=a;a=b;b=t;}const ra=a>>2,rb=b>>2;if(ra===rb)return RCH[ra]+RCH[rb];return RCH[ra]+RCH[rb]+((a&3)===(b&3)?'s':'o');}
const handTier=cs=>TIER[handKey(cs)]||5;
function preflopName(cs){
  const a=Math.max(cs[0]>>2,cs[1]>>2),b=Math.min(cs[0]>>2,cs[1]>>2);
  if(a===b)return `Cep per: ${RPL[a]}`;
  return `${RTR[a]}-${RTR[b]}, ${(cs[0]&3)===(cs[1]&3)?'aynı renk':'farklı renk'}`;
}

/* ================= Masalar ================= */
const STYLES={
  gevsek:{label:'Gevşek',aggr:.25,loose:.75,bluff:.12},
  kaya:{label:'Sıkı',aggr:.3,loose:.06,bluff:.05},
  manyak:{label:'Saldırgan',aggr:.9,loose:.6,bluff:.42},
  kopekbaligi:{label:'Köpekbalığı',aggr:.7,loose:.22,bluff:.22},
  tilki:{label:'Tilki',aggr:.75,loose:.5,bluff:.32},
};
/* Karakterler: görünüş (3D sahne için), servet ve dışavurum.
   servet 0..1 → kıyafet, aksesuar, bahis büyüklüğü ve risk iştahı (zengin rahat öder, fakir büyük bahiste çekinir).
   ifade (expr) → duygusunu ne kadar dışa vurduğu; davranış (tell) sızıntısını çarpar. Tarz kariyerde yazmaz, görünüşten ve davranıştan okunur. */
const CHARS={
  'Acemi Nuri':{look:'Kapüşonlu, kasketli bir üniversiteli; kartlarına durmadan bakıyor.',sex:'m',age:21,skin:'#d9a982',build:.95,hair:['sidepart','#2b1b12'],top:['hoodie','#3d6ea5'],hat:['cap','#b8352a'],props:['phone','cola'],wealth:.25,expr:1.35},
  'Sakin Selma':{look:'Hırkalı, gözlüklü emekli bir öğretmen.',sex:'f',age:58,skin:'#e6bf9c',hair:['bob','#8a8580'],top:['cardigan','#7b5a77','#efe9df'],acc:['glasses','earrings'],props:['tea'],wealth:.45,expr:.9},
  'Meraklı Can':{chatty:true,look:'Tişörtlü, heyecanlı bir genç; elleri hiç durmuyor.',sex:'m',age:25,skin:'#c99673',hair:['curly','#1d140e'],top:['tshirt','#e0b33c'],props:['cola'],wealth:.3,expr:1.4},
  'Tespihçi Rıza':{look:'Kasketli, yıpranmış ceketli bir emekli; elindeki tespih hiç durmuyor.',sex:'m',age:67,skin:'#c89473',build:.95,hair:['short','#b9b4ad'],face:['mustache','#c9c4bc'],top:['jacket','#5a4a3a','#cfc6b4'],vest:'#6b6458',hat:['flatcap','#4a4339'],props:['tespih','tea'],wealth:.2,expr:1.2,quirk:'tespih'},
  'Kasap Hüsnü':{chatty:true,look:'İri yarı, kolları sıvalı, parmaklarında sigara; masaya yayılarak oturuyor.',sex:'m',age:46,skin:'#c88a64',build:1.32,belly:true,hair:['bald','#2a1c14'],face:['mustache','#1f150f'],top:['shirt','#e8e2d6'],sleeves:'rolled',acc:['chain'],props:['cigarette','ashtray','tea'],wealth:.4,expr:1.5,quirk:'smoke'},
  'Çaycı Hasan':{chatty:true,look:'Zayıf, yelekli; çay bardağı elinden düşmüyor, herkesle şakalaşıyor.',sex:'m',age:52,skin:'#bd8a66',build:.85,hair:['balding','#3a2a20'],face:['stubble','#3a2a20'],top:['vest','#d7d0c0','#5b4b3a'],props:['tea','tea2'],wealth:.15,expr:1.3,quirk:'tea'},
  'Sarraf Levon':{look:'Üç parça takım, altın saat, yuvarlak gözlük; neredeyse hiç kıpırdamıyor.',sex:'m',age:63,skin:'#dcb394',hair:['slick','#9e9a95'],face:['mustache','#9e9a95'],top:['suit','#2b2b30','#f2efe8','pin'],tie:['tie','#5a1e22'],acc:['glasses','watch','pocket'],props:['coffee'],wealth:.95,expr:.55},
  'Bıçkın Cemil':{look:'Deri ceket, açık yaka, güneş gözlüğü başında; kendinden fazlasıyla emin.',sex:'m',age:34,skin:'#c48d68',hair:['slick','#141010'],face:['stubble','#141010'],top:['leather','#1a1716','#2b2622'],acc:['chain','sunglassesHead','rings'],props:['raki','cigarette','ashtray'],wealth:.55,expr:1.45,quirk:'smoke'},
  'Doktor Feride':{look:'Ceketli, saçları topuz; sakin, dikkatli ve az konuşan biri.',sex:'f',age:44,skin:'#e2b896',hair:['bun','#3b2618'],top:['blazer','#33424f','#e9e6e1'],acc:['glasses','earrings','watch'],props:['water'],wealth:.75,expr:.6},
  'Plakçı Turgut':{chatty:true,look:'Uzun saçlı, sakallı, kadife ceketli bir müzik sever; durmadan konuşuyor.',sex:'m',age:49,skin:'#d4a17d',hair:['long','#5b4a3d'],face:['beard','#5b4a3d'],top:['jacket','#7a5232','#3a5a46','check'],acc:['scarf'],props:['raki'],wealth:.35,expr:1.3},
  'Girneli Mehmet':{look:'Keten gömlekli, bronz tenli; güneş gözlüğünü masada bile çıkarmıyor.',sex:'m',age:41,skin:'#b57b55',hair:['sidepart','#1c130d'],face:['stubble','#1c130d'],top:['linen','#ece6d8'],acc:['sunglasses','watch'],props:['whiskey'],wealth:.7,expr:.75},
  'Viktor':{chatty:true,look:'Kazıtılmış kafa, parlak takım, kalın altın zincir; her pota girmek istiyor.',sex:'m',age:38,skin:'#e8c2a6',build:1.15,hair:['bald','#c9a27c'],top:['suit','#3b3f6b','#16161a'],acc:['chain','watch','rings'],props:['vodka'],wealth:.9,expr:1.25},
  'Elena':{look:'Zarif siyah elbiseli, uzun saçlı; az konuşuyor, çok izliyor.',sex:'f',age:33,skin:'#efcfb5',hair:['long','#2a1a12'],top:['dress','#141216'],acc:['earrings','pendant'],props:['wine'],wealth:.8,expr:.6},
  'Hasan Bey':{look:'Ak saçlı, gri takımlı, kravatlı bir emekli; acele etmiyor.',sex:'m',age:72,skin:'#d6a988',hair:['short','#e4e1dc'],face:['mustache','#e4e1dc'],top:['suit','#6b6b6e','#f1eee7'],tie:['tie','#28406b'],acc:['glasses'],props:['tea'],wealth:.8,expr:.7},
  'Kont Philippe':{look:'Smokinli, kır saçlı bir aristokrat; yüzünde tek bir kas oynamıyor.',sex:'m',age:66,skin:'#ecc9ad',hair:['slick','#cfcac2'],top:['tux','#0f0f12','#f6f4ee'],tie:['bow','#0b0b0d'],acc:['monocle','pocket','watch'],props:['cognac'],wealth:1,expr:.45},
  'Isabella':{look:'Kırmızı gece elbisesi, inci kolye; gülümsemesi hiç değişmiyor.',sex:'f',age:36,skin:'#e8bf9f',hair:['updo','#4a2617'],top:['dress','#8e1424'],acc:['pearls','earrings','bracelet'],props:['champagne'],wealth:.9,expr:.55},
  'Baron Hartz':{look:'Smokinli, kır sakallı, ince yapılı; fişleriyle sessizce oynuyor.',sex:'m',age:57,skin:'#e9c7aa',build:.9,hair:['short','#8a8078'],face:['beard','#8a8078'],top:['tux','#121214','#f6f4ee'],tie:['bow','#101012'],acc:['watch','glasses'],props:['whiskey'],wealth:.95,expr:.4,quirk:'riffle'},
  'Lucien':{look:'Genç bir mirasyedi; papyonu gevşemiş, saçları dağınık, kadehi hep dolu.',sex:'m',age:27,skin:'#efd0b8',hair:['messy','#c79a52'],top:['tux','#151517','#f6f4ee'],tie:['bowLoose','#0b0b0d'],acc:['watch','rings','lapelFlower'],props:['champagne','phone'],wealth:1,expr:1.2},
  'Madame Roux':{look:'Siyah elbiseli, gözlüklü yaşlı bir hanım; hiçbir şeyi kaçırmıyor.',sex:'f',age:69,skin:'#efd3bf',hair:['bob','#d9d5d0'],top:['dress','#1a1a1f'],acc:['glasses','pearls','earrings'],props:['tea'],wealth:.95,expr:.45},
  'Signora Bianchi':{chatty:true,look:'Mor elbiseli, mücevherli, kahkahası salonu dolduran bir dul; para umurunda değil.',sex:'f',age:61,skin:'#e3b896',hair:['updo','#2a1810'],top:['dress','#5b2a6e'],acc:['pearls','earrings','rings','watch'],props:['champagne'],wealth:1,expr:1.3},
  'Tex Morgan':{look:'Kovboy şapkası, kot gömlek, güneş gözlüğü; kıpırtısız bir Teksaslı.',sex:'m',age:52,skin:'#c99272',hair:['short','#6b5440'],face:['mustache','#6b5440'],top:['western','#3e5f86'],tie:['bolo','#c9a227'],hat:['cowboy','#d9c4a0'],acc:['sunglasses','watch'],props:['whiskey'],wealth:.85,expr:.5,quirk:'riffle'},
  'Lucky Lou':{chatty:true,look:'Hawaii gömleği, puro, altın zincirler; Vegas\'ın en gürültülü adamı.',sex:'m',age:58,skin:'#e3b392',build:1.25,belly:true,hair:['balding','#9b938a'],top:['hawaii','#1f8a9b'],acc:['chain','rings','watch'],props:['cigar','ashtray','cocktail'],wealth:.9,expr:1.35,quirk:'smoke'},
  'Vivian Cole':{look:'Siyah ceketli, kısa saçlı, keskin bakışlı; bahisleriyle sorular soruyor.',sex:'f',age:39,skin:'#8d5a3c',hair:['pixie','#151010'],top:['blazer','#1b1b1f','#c9b28a'],acc:['earrings','watch'],props:['water'],wealth:.85,expr:.45},
  'Doc Hollis':{look:'Siperlikli, hırkalı yaşlı bir profesyonel; kırk yıldır aynı masada.',sex:'m',age:71,skin:'#e4bea2',hair:['short','#d8d4cf'],top:['cardigan','#6d6450','#e9e5db'],hat:['visor','#2a4a2a'],acc:['glasses'],props:['coffee'],wealth:.75,expr:.4},
  'Mike “Shark” Russo':{look:'Kapüşon, kulaklık, güneş gözlüğü; yüzünden hiçbir şey okunmuyor.',sex:'m',age:31,skin:'#d7a985',hair:['short','#1d1510'],face:['stubble','#1d1510'],top:['hoodie','#26272b'],hat:['hood'],acc:['sunglasses','headphones','watch'],props:['energy'],wealth:.9,expr:.3,quirk:'riffle'},
  'Harold Briggs':{chatty:true,look:'Bej takım, açık yaka, kalın yüzükler; tatile çıkmış zengin bir petrolcü.',sex:'m',age:63,skin:'#ecbf9c',build:1.2,belly:true,hair:['balding','#b8b0a6'],top:['suit','#bfae8a','#f2ede2'],acc:['rings','watch','chain'],props:['whiskey','cigar','ashtray'],wealth:1,expr:1.15,quirk:'smoke'},
  'Emekli Kemal':{look:'Kasketli, gözlüklü bir emekli memur; sabah gazetesini hâlâ katlayıp cebine koyuyor.',sex:'m',age:68,skin:'#d2a181',hair:['short','#d6d2cc'],face:['mustache','#d6d2cc'],top:['cardigan','#6b5f4a','#e9e5db'],hat:['flatcap','#3f3a30'],acc:['glasses'],props:['tea'],wealth:.35,expr:.8},
  'Berber Salih':{look:'Briyantinli saçlı, ince bıyıklı; yeleğinin altında bembeyaz bir gömlek var ve kartlarını tarak gibi düzeltiyor.',sex:'m',age:44,skin:'#c89473',hair:['slick','#16110c'],face:['mustache','#16110c'],top:['vest','#f1eee6','#1f1f24'],props:['cigarette','ashtray','tea'],wealth:.45,expr:1.1,quirk:'smoke'},
  'Kahveci Necdet':{chatty:true,look:'Önlüklü, göbekli, kolları sıvalı; kıraathanenin sahibi ve en çok konuşanı.',sex:'m',age:55,skin:'#c28d68',build:1.22,belly:true,hair:['balding','#4a3a2e'],face:['stubble','#4a3a2e'],top:['shirt','#d9d4c6'],sleeves:'rolled',props:['tea','tea2'],wealth:.3,expr:1.35,quirk:'tea'},
  'Taksici Orhan':{look:'Deri ceketli, güneş gözlüğü saçında; gece vardiyasından doğrudan geldi.',sex:'m',age:39,skin:'#bf8a64',hair:['buzz','#1a120d'],face:['stubble','#1a120d'],top:['leather','#2a2220','#3a332c'],acc:['sunglassesHead','chain'],props:['cigarette','ashtray','cola'],wealth:.4,expr:1.45,quirk:'smoke'},
  'Sedefçi Yervant':{look:'Üç parçalı eski bir takım, kalın camlı gözlük; her kartı iki kez kontrol ediyor.',sex:'m',age:70,skin:'#dcb394',hair:['short','#d9d5cf'],top:['suit','#3b3b42','#efe9dc'],tie:['tie','#4a2a2a'],acc:['glasses','pocket'],props:['coffee'],wealth:.7,expr:.5},
  'Halıcı Nusret':{chatty:true,look:'Kadife ceketli, gür bıyıklı, parmaklarında yüzük; her işi pazarlıkla bitiriyor.',sex:'m',age:52,skin:'#c99272',hair:['slick','#2a1c14'],face:['mustache','#2a1c14'],top:['jacket','#6a3a22','#e8e2d4'],acc:['rings','watch'],props:['tea'],wealth:.75,expr:1.05},
  'Cevahirci Selim':{look:'Takım elbiseli, bakımlı sakallı; kartları parmak uçlarıyla tutan sessiz bir hesapçı.',sex:'m',age:47,skin:'#d4a17d',hair:['short','#141010'],face:['beard','#141010'],top:['suit','#1f2a3f','#f1eee7'],tie:['tie','#8a6a2a'],acc:['glasses','rings','watch'],props:['coffee'],wealth:.9,expr:.45,quirk:'riffle'},
  'Terzi Aysel':{chatty:true,look:'Boynunda mezura, gözlüklü, hırkalı; konuşurken elleri hiç durmuyor.',sex:'f',age:58,skin:'#e3b896',hair:['bun','#8a8580'],top:['cardigan','#7a4a5e','#efe9df'],acc:['glasses','earrings'],props:['tea'],wealth:.5,expr:1.15},
  'Kuyumcu Berkant':{look:'Altın zincir, parlak saat, dağınık saçlar; masada servetini göstermeyi seven biri.',sex:'m',age:36,skin:'#d1a07c',hair:['messy','#1a120d'],face:['stubble','#1a120d'],top:['blazer','#2a2f3a','#ece6d8'],acc:['chain','rings','watch','tieclip'],props:['whiskey'],wealth:.8,expr:1.3},
  'Armatör Cevdet':{look:'Lacivert takım, kır bıyık, pahalı saat; elinde hep bir puro.',sex:'m',age:64,skin:'#d8aa88',hair:['short','#d9d5cf'],face:['mustache','#d9d5cf'],top:['suit','#1b2538','#f2efe8'],tie:['tie','#7a1d2a'],acc:['watch','rings'],props:['whiskey','cigar','ashtray'],wealth:1,expr:.5,quirk:'smoke'},
  'Galerici Sinan':{chatty:true,look:'Deri ceket, saçında güneş gözlüğü, parmaklarında yüzük; telefonu hiç susmuyor.',sex:'m',age:41,skin:'#c48d68',hair:['slick','#120d0a'],face:['stubble','#120d0a'],top:['leather','#1a1716','#2b2622'],acc:['chain','rings','sunglassesHead'],props:['raki','phone'],wealth:.85,expr:1.4},
  'Avukat Ayla':{look:'Keskin kesim blazer, topuz saç, gözlük; hiçbir cümlesi gereksiz değil.',sex:'f',age:46,skin:'#e5bc9b',hair:['bun','#2c1c12'],top:['blazer','#23262f','#e8e3da'],acc:['glasses','earrings','watch'],props:['water'],wealth:.85,expr:.45},
  'Mimar Deniz':{look:'Keten ceketli, uzun saçlı, sade ama pahalı giyinen biri; kartlarına bakarken bile hafifçe gülümsüyor.',sex:'f',age:37,skin:'#e8c2a6',hair:['bangs','#3a2418'],top:['linen','#e8e1d0'],acc:['earrings'],props:['wine'],wealth:.7,expr:.8},
  'Reklamcı Bora':{chatty:true,look:'Gömleği yarı açık, sakallı; her şeyi bir esprinin içine saklayan bir hovarda.',sex:'m',age:33,skin:'#d6a784',hair:['messy','#3a2a1d'],face:['beard','#3a2a1d'],top:['linen','#f0ece0'],acc:['sunglassesHead','watch'],props:['cocktail','phone'],wealth:.8,expr:1.3},
  'Master Chen':{look:'Koyu takım, kırmızı kravat, sakin bir yüz; fişlerini hiç yanlış saymıyor.',sex:'m',age:66,skin:'#e3bd98',hair:['short','#b9b4ad'],face:['goatee','#b9b4ad'],top:['suit','#1a1a20','#f0ede4'],tie:['tie','#8a1a24'],acc:['glasses','watch'],props:['tea'],wealth:1,expr:.35},
  'Mei Lin':{look:'Kırmızı gece elbisesi, inci küpeler; gülümsemesinin ardında net bir hesap var.',sex:'f',age:34,skin:'#f0d2b6',hair:['ponytail','#120d0c'],top:['dress','#a01428'],acc:['pearls','earrings'],props:['champagne'],wealth:.95,expr:.4},
  'Tycoon Wu':{chatty:true,look:'İri yapılı, altın saatli, yüzüklü bir iş adamı; puro dumanı ve yüksek kahkahalar.',sex:'m',age:51,skin:'#e0b790',build:1.25,belly:true,hair:['balding','#2a1d16'],top:['suit','#2a2a30','#f0ede4'],tie:['tie','#c9a227'],acc:['chain','rings','watch'],props:['cigar','ashtray','whiskey'],wealth:1,expr:1.3,quirk:'smoke'},
  'Jin “Dragon” Park':{look:'Gümüşe boyalı saç, deri ceket, kulaklık; kıpırtısız ama gözleri her yerde.',sex:'m',age:29,skin:'#e7c6a4',hair:['messy','#c9c9d0'],top:['leather','#16161a','#2b2b32'],acc:['headphones','watch','sunglassesHead'],props:['energy'],wealth:.85,expr:.7},
  'Sakura':{look:'Beyaz blazer, kısa kesim siyah saç, ince gözlük; kartlarını çok yavaş karıştırıyor.',sex:'f',age:31,skin:'#f1d6bd',hair:['bangs','#0f0b0a'],top:['blazer','#eceae4','#2a2a30'],acc:['glasses','watch'],props:['water'],wealth:.9,expr:.3,quirk:'riffle'},
  'Khalid Al-Rashid':{chatty:true,look:'Krem rengi takım, altın kol saati, yüzük; fişleri sayarak değil avuçla koyuyor.',sex:'m',age:43,skin:'#c9946e',build:1.12,hair:['slick','#120d0a'],face:['beard','#120d0a'],top:['suit','#e6dfcf','#f6f2e8'],tie:['tie','#b8913f'],acc:['watch','rings','chain'],props:['coffee','phone'],wealth:1,expr:1},
  'Sir Alistair Crane':{look:'Smokinli, tek gözlüklü, beyaz saçlı; ses tonu hiç değişmeyen bir İngiliz.',sex:'m',age:69,skin:'#efd0b6',hair:['slick','#e8e5df'],face:['mustache','#e8e5df'],top:['tux','#0e0e11','#f6f4ee'],tie:['bow','#0a0a0c'],acc:['monocle','pocket','watch'],props:['cognac'],wealth:1,expr:.3},
  'Natasha Volkova':{look:'Siyah gece elbisesi, platin sarısı topuz; masaya girişi bile bir hamle gibi.',sex:'f',age:38,skin:'#f1d8c4',hair:['updo','#d9d3c6'],top:['dress','#101014'],acc:['earrings','pearls'],props:['vodka'],wealth:1,expr:.3},
  'The Kid Jaden':{chatty:true,look:'Kapüşonlu, zincirli, kulaklığı boynunda; yirmi iki yaşında ve kasasında servet var.',sex:'m',age:22,skin:'#a9744f',hair:['afro','#121010'],top:['hoodie','#1b1b1f'],acc:['chain','rings','headphones'],props:['energy','phone'],wealth:1,expr:1.5},
  'Madame Zhou':{look:'Yeşim yeşili blazer, inciler, gözlük; fişleri dizerken ölçüyü hiç şaşırmıyor.',sex:'f',age:57,skin:'#ecd0b6',hair:['updo','#2a2020'],top:['blazer','#1f5a48','#e9e6df'],acc:['pearls','glasses','earrings'],props:['tea'],wealth:1,expr:.35},
  'Ghost':{look:'Kapüşonlu, güneş gözlüklü, ne yaşı ne yüzü belli; masada adını kimse bilmiyor.',sex:'m',age:35,skin:'#d0a07c',hair:['short','#1a1410'],top:['hoodie','#222226'],hat:['hood'],acc:['sunglasses','watch'],props:['water'],wealth:.95,expr:.2,quirk:'riffle'},
};
const HAN_LEVELS=[[2500,5000],[3000,6000],[4000,8000],[5000,10000],[7500,15000],[10000,20000],[15000,30000],[20000,40000],[30000,60000],[50000,100000],[75000,150000],[100000,200000],[150000,300000],[250000,500000]];
/* Masalar: kolaydan zora. Paralar masanın dünyasına göre; kaçak bodrumda bile on binlerle, üst katta milyonlarla oynanır.
   Kural çeşitleri: ante (her elde herkes zorunlu fiş koyar) ve turnuva (körler yükselir, son ayakta kalan kazanır). */
const VENUES=[
  {id:'kacak',lvl:1,name:'Kaçak Kumarhane',city:'Tarlabaşı',place:'Tarlabaşı · bir apartman bodrumu',blurb:'Tek çıplak ampul, sigara dumanı, yamuk bir masa. Kapıdaki çocuk ıslık çalarsa kartları topla.',cur:'₺',sb:100,bb:200,buy:10000,target:30000,skill:.12,
    rivals:[['Tespihçi Rıza','gevsek'],['Kasap Hüsnü','manyak'],['Çaycı Hasan','gevsek']]},
  {id:'kiraathane',lvl:2,name:'Kıraathane Arka Odası',city:'Kadıköy',place:'Kadıköy · çay ocağının arkasındaki oda',blurb:'Ön odada tavla şakırdar, arka odada büyük oyun oynanır. Herkes herkesin komşusu, kimse kimseye borç yazmaz.',cur:'₺',sb:250,bb:500,buy:25000,target:75000,skill:.22,
    rivals:[['Emekli Kemal','kaya'],['Berber Salih','tilki'],['Kahveci Necdet','gevsek'],['Taksici Orhan','manyak']]},
  {id:'yeralti',lvl:3,name:'Yeraltı Kulübü',city:'Beyoğlu',place:'Beyoğlu · meyhanenin arka odası',blurb:'Kadife perde, pirinç lamba. Burada herkes birini tanır ama kimse kimseye güvenmez.',cur:'₺',sb:1000,bb:2000,buy:100000,target:300000,skill:.33,
    rivals:[['Sarraf Levon','kaya'],['Bıçkın Cemil','manyak'],['Doktor Feride','kopekbaligi'],['Plakçı Turgut','gevsek']]},
  {id:'han',lvl:4,name:'Han Turnuvası',city:'Mahmutpaşa',place:'Mahmutpaşa · tarihi bir hanın avlusu',blurb:'Tüccarların oyunu: herkes aynı fişle başlar, körler her sekiz elde yükselir, son ayakta kalan kazanır. Bekleyen körlere yenilir.',rule:'Turnuva: körler her 8 elde bir yükselir, hedef herkesi elemek',cur:'₺',sb:2500,bb:5000,unit:500,levels:HAN_LEVELS,blindUp:8,buy:250000,target:null,tourney:true,skill:.42,
    rivals:[['Sedefçi Yervant','kaya'],['Halıcı Nusret','tilki'],['Cevahirci Selim','kopekbaligi'],['Terzi Aysel','gevsek'],['Kuyumcu Berkant','manyak']]},
  {id:'yali',lvl:5,name:'Boğaz Yalısı',city:'Bebek',place:'Bebek · Boğaz kıyısında bir yalı',blurb:'Boğaz manzaralı, davetlilere özel bir gece. Masadakiler gazeteden tanıdığın isimler; kimse kaybetmeyi sevmez.',rule:'Ante: her elde herkes zorunlu fiş koyar',cur:'₺',sb:10000,bb:20000,ante:2000,buy:1000000,target:3000000,skill:.52,
    rivals:[['Armatör Cevdet','kopekbaligi'],['Galerici Sinan','manyak'],['Avukat Ayla','kaya'],['Mimar Deniz','tilki'],['Reklamcı Bora','gevsek']]},
  {id:'girne',lvl:6,name:'Girne Casino',city:'Girne',place:'Kıbrıs · liman otelinin salonu',blurb:'İlk gerçek casino. Krupiyeler papyonlu, rakipler artık ne yaptığını biliyor.',cur:'£',sb:500,bb:1000,buy:100000,target:300000,skill:.6,
    rivals:[['Girneli Mehmet','tilki'],['Viktor','manyak'],['Elena','kopekbaligi'],['Hasan Bey','kaya']]},
  {id:'monte',lvl:7,name:'Monte Carlo Salonu',city:'Monako',place:'Monako · kristal avizeli özel oda',blurb:'Smokin zorunlu. Kimse sesini yükseltmez, ama herkes seni okur.',rule:'Ante: her elde herkes zorunlu fiş koyar',cur:'€',sb:2500,bb:5000,ante:500,buy:500000,target:1500000,skill:.72,
    rivals:[['Kont Philippe','kaya'],['Isabella','tilki'],['Baron Hartz','kopekbaligi'],['Lucien','manyak'],['Madame Roux','kopekbaligi'],['Signora Bianchi','gevsek']]},
  {id:'macau',lvl:8,name:'Makao VIP Odası',city:'Makao',place:'Makao · kumarhane kulesinin 38. katı',blurb:'Kırmızı fenerler, yeşim rengi çuha, sessiz milyarderler. Burada tek bir elin değeri bir evin fiyatıdır.',rule:'Ante: her elde herkes zorunlu fiş koyar',cur:'$',sb:10000,bb:20000,ante:2000,buy:2000000,target:6000000,skill:.82,
    rivals:[['Master Chen','kaya'],['Mei Lin','kopekbaligi'],['Tycoon Wu','manyak'],['Jin “Dragon” Park','tilki'],['Sakura','kopekbaligi']]},
  {id:'vegas',lvl:9,name:'Las Vegas Casino',city:'Las Vegas',place:'The Strip · yüksek bahis salonu',blurb:'Neon ışıklar, limitsiz bahis ve masada dünyanın en iyileri. Küçük bir blöf bile yüz binlerce dolar.',rule:'Ante: her elde herkes zorunlu fiş koyar',cur:'$',sb:25000,bb:50000,ante:5000,buy:5000000,target:15000000,skill:.9,
    rivals:[['Tex Morgan','kopekbaligi'],['Lucky Lou','manyak'],['Vivian Cole','tilki'],['Doc Hollis','kaya'],['Mike “Shark” Russo','kopekbaligi'],['Harold Briggs','gevsek']]},
  {id:'suit',lvl:10,name:'Penthouse Süiti',city:'Vegas Süit',place:'Las Vegas · kulenin tepesindeki özel süit',blurb:'Yolun sonu. Panoramik cam, altın detaylar ve dünyanın en büyük bahisleri. Bu odada her el milyonlarca dolar oynar.',rule:'Ante: her elde herkes zorunlu fiş koyar',cur:'$',sb:100000,bb:200000,ante:25000,buy:25000000,target:100000000,skill:.97,
    rivals:[['Khalid Al-Rashid','manyak'],['Sir Alistair Crane','kaya'],['Natasha Volkova','kopekbaligi'],['The Kid Jaden','manyak'],['Madame Zhou','kopekbaligi'],['Ghost','tilki']]},
];
const TRAINING={id:'antrenman',lvl:0,name:'Antrenman Masası',place:'Eğitim · koç her adımda yanında',cur:'₺',sb:100,bb:200,buy:10000,target:null,skill:.05,training:true,
  rivals:[['Acemi Nuri','gevsek'],['Sakin Selma','kaya'],['Meraklı Can','gevsek']]};
const nf2=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2});
const fmtM=(n,cur)=>{n=Math.round(n);return Math.abs(n)>=1e6?cur+nf2.format(n/1e6)+' Mn':cur+nf.format(n);};
/* ================= Cüzdan & tanınırlık =================
   Cüzdan Türk lirası tutulur; yurt dışı masaların girişi o ülkenin parasıyla, sabit kurdan ödenir.
   Bir masaya oturmak için giriş ücretini ödeyebilmek yeter; fetih sırası beklenmez.
   Kalkınca (ya da hedefe ulaşınca) fişler nakde döner; turnuvada erken kalkan hiçbir şey alamaz.
   Tanınırlık masaya özeldir: o masayı her fethedişinde adın biraz daha duyulur. */
const FX={'₺':1,'£':58,'€':50,'$':45};
const toTL=(n,cur)=>n*FX[cur];
const REP=[
  {t:'Yabancı'},
  {t:'Tanıdık yüz',d:'Masadakiler seni hatırlıyor; büyük bahislerinde bir an duraksıyorlar.',comp:.1,awe:.04},
  {t:'Saygın oyuncu',d:'Adın bu masada konuşuluyor. Ürkek oyuncular artışlarına daha kolay çekiliyor.',comp:.2,awe:.07},
  {t:'Masanın efsanesi',d:'İçeri girince masa susuyor. Ev sahibi seni ağırlıyor, rakipler sana karşı temkinli.',comp:.3,awe:.1},
];
// Tanınırlığın etkisi tarza göre: gevşek ve kaya çekinir, köpekbalığı pek aldırmaz, manyak seni yenip adını almak ister.
const AWE_ST={gevsek:1.3,kaya:1,tilki:.6,kopekbaligi:.35,manyak:-.4};
const repWins=v=>(SAVE.rep&&SAVE.rep[v.id])||0;
const repLvl=v=>{const w=repWins(v);return w>=4?3:w>=2?2:w>=1?1:0;};
// Ev sahibinin ikramı: tanınan oyuncunun girişinin bir kısmını ev karşılar; masada yine tam fişle oturursun.
const entryFee=v=>{const c=REP[repLvl(v)].comp||0,u=v.unit||v.sb;return Math.round(v.buy*(1-c)/u)*u;};
const entryTL=v=>toTL(entryFee(v),v.cur);
const canAfford=v=>SAVE.settings.free||SAVE.cash>=entryTL(v);
const tl=n=>fmtM(n,'₺');
// Alıştırma masası: kariyerde ulaştığın ya da girişine paranın yettiği salonlar açılır.
const isUnlocked=v=>SAVE.settings.free||v.lvl<=SAVE.unlocked||canAfford(v);
// Eski kayıtlar: fethedilen her masa bir kez tanınırlık verir; cüzdan, ulaşılan son masanın hedefi kadar açılır.
(()=>{
  if(!SAVE.ach)SAVE.ach={};
  if(SAVE._old){
    let top=null;for(const v of VENUES)if(SAVE.conquered.includes(v.id)){SAVE.rep[v.id]=Math.max(1,SAVE.rep[v.id]||0);top=v;}
    SAVE.cash=Math.max(START_CASH,top?toTL(top.target||top.buy*6,top.cur):0);
  }
  delete SAVE._old;persist();
})();
const initials=n=>n.replace(/[“”"]/g,'').split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toLocaleUpperCase('tr-TR');

/* ================= Ekranlar ================= */
let CUR='scr-menu';
function show(id){
  CUR=id;
  $$('.screen').forEach(s=>s.hidden=s.id!==id);
  document.body.classList.toggle('in-game',id==='scr-game');
  if(id==='scr-menu')renderMenu();
  if(id==='scr-career')renderCareer();
  window.scrollTo(0,0);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)show(b.dataset.go);});

function renderMenu(){
  const r=$('#route');
  r.innerHTML=VENUES.map(v=>{
    const done=SAVE.conquered.includes(v.id),ok=canAfford(v),now=!done&&ok&&!VENUES.some(w=>w.lvl>v.lvl&&canAfford(w)&&!SAVE.conquered.includes(w.id));
    return `<li class="${done?'done':now?'now':ok?'':'lock'}"><i></i><b>${v.city}</b><span>${v.name}</span></li>`;
  }).join('');
  const st=SAVE.stats;
  $('#stats').innerHTML=`<span><b>${tl(SAVE.cash)}</b>cüzdan</span><span><b>${nf.format(st.hands)}</b>oynanan el</span><span><b>${nf.format(st.won)}</b>kazanılan el</span><span><b>${SAVE.conquered.length}/${VENUES.length}</b>fethedilen masa</span><span><b>${st.best?fmtM(st.best,st.bestCur):'—'}</b>en büyük pot</span><span><b>${Ach.count()}/${Ach.list().length}</b>başarım</span>`;
  const next=VENUES.find(v=>!SAVE.conquered.includes(v.id));
  $('#career-cta').textContent=!next?'Bütün masalar fethedildi →':canAfford(next)?`Sıradaki masa: ${next.name} →`:`${next.name} için ${tl(entryTL(next)-SAVE.cash)} daha lazım →`;
  $('#learn-cta').textContent=SAVE.seen.length?`Kaldığın yerden devam et (${Math.min(SAVE.seen.length,LESSONS.length)}/${LESSONS.length}) →`:'Derslere başla →';
}
$('#go-learn').onclick=()=>{show('scr-learn');const nx=LESSONS.find(l=>!SAVE.seen.includes(l.id));openLesson((nx||LESSONS[0]).id);};
$('#go-career').onclick=()=>show('scr-career');

function renderCareer(){
  const free=SAVE.settings.free;
  $('#career-sum').textContent=`${SAVE.conquered.length}/${VENUES.length} masa fethedildi`;
  const broke=!free&&!VENUES.some(v=>canAfford(v)||sideTables(v).some(canAfford));
  const wallet=`<div class="wallet">
      <div><span class="kicker">Cüzdan</span><b class="w-cash">${free?'Serbest mod':tl(SAVE.cash)}</b></div>
      <p class="muted">${free?'Serbest modda giriş ücreti alınmaz, kazanç cüzdana geçmez.':'Giriş ücretini cüzdandan ödersin; kalkınca fişlerin nakde döner. Yurt dışında kur: £1 = ₺58 · €1 = ₺50 · $1 = ₺45.'}</p>
      ${broke?`<div class="w-broke"><span>Cebinde en ucuz masaya bile yetecek para kalmadı.</span><button class="btn small" id="w-borrow">Mahalleden ${tl(START_CASH)} borç bul</button></div>`:''}
    </div>`;
  $('#venues').innerHTML=wallet+VENUES.map(v=>{
    const un=canAfford(v),done=SAVE.conquered.includes(v.id),sides=sideTables(v),any=un||sides.some(canAfford);
    const rl=repLvl(v),R=REP[rl],fee=entryFee(v),foreign=v.cur!=='₺';
    const pips=[1,2,3,4,5].map(i=>`<i class="${i<=Math.ceil(v.lvl/2)?'on':''}"></i>`).join('');
    const riv=v.rivals.map(([n])=>`<li><b>${n}</b> <span class="muted">${(CHARS[n]||{}).look||''}</span></li>`).join('');
    const feeTxt=`${fee<v.buy?`<s>${fmtM(v.buy,v.cur)}</s> `:''}<b>${fmtM(fee,v.cur)}</b>${foreign?` <span class="muted">≈ ${tl(entryTL(v))}</span>`:''}`;
    const act=USE3D()?(any?`<button class="btn" data-hall="${v.id}">Salona gir →</button>`:`<span class="badge locked">Paran yetmiyor</span><span class="muted" style="font-size:12px">En ucuz masa için ${tl(Math.min(entryTL(v),...sides.map(entryTL))-SAVE.cash)} eksik</span>`):un?`<button class="btn" data-play="${v.id}">${done?'Pokere tekrar otur':'Poker masasına otur'}</button>`:`<span class="badge locked">Paran yetmiyor</span><span class="muted" style="font-size:12px">${tl(entryTL(v)-SAVE.cash)} eksik</span>`;
    const rep=rl?`<p class="v-rep"><span class="rep-pip r${rl}"></span>Tanınırlık: <b>${R.t}</b> · ${repWins(v)} fetih. ${R.d} Ev sahibi girişte %${Math.round(R.comp*100)} ikram yapıyor.</p>`:'';
    return `<article class="venue ${any?'':'lock'}" data-venue="${v.id}">
      <div class="sw" aria-hidden="true">${v.lvl}</div>
      <div class="v-body">
        <div class="v-top"><h3 class="v-name">${v.name}</h3><span class="v-place">${v.place}</span></div>
        <p class="v-blurb">${v.blurb}</p>
        ${v.rule?`<p class="v-rule">${v.rule}</p>`:''}
        <div class="v-facts"><span>Körler <b>${fmtM(v.sb,v.cur)} / ${fmtM(v.bb,v.cur)}</b></span>${v.ante?`<span>Ante <b>${fmtM(v.ante,v.cur)}</b></span>`:''}<span>Giriş ${feeTxt}</span><span>Hedef <b>${v.target?fmtM(v.target,v.cur):'Herkesi ele'}</b></span><span>Zorluk <span class="pips">${pips}</span></span></div>
        ${rep}
        <ul class="v-rivals">${riv}</ul>
        ${sides.length?`<div class="v-sides"><span class="kicker">Salondaki diğer masalar</span><div class="sides">${sides.map(sideCard).join('')}</div></div>`:''}
      </div>
      <div class="v-act">${done?'<span class="badge won">Fethedildi</span>':''}${act}</div>
    </article>`;
  }).join('');
  $$('#venues [data-play]').forEach(b=>b.onclick=()=>startGame(VENUES.find(v=>v.id===b.dataset.play)));
  bindSideCards($('#venues'));
  $$('#venues [data-hall]').forEach(b=>b.onclick=()=>enterHall(VENUES.find(v=>v.id===b.dataset.hall)));
  const bw=$('#w-borrow');if(bw)bw.onclick=()=>{SAVE.cash=START_CASH;SAVE.stats.borrowed=(SAVE.stats.borrowed||0)+1;persist();toast('Borç bulundu',`Kahveci Necdet ${tl(START_CASH)} uzattı. “Bu sefer dikkatli oyna evlat.”`,'info');renderCareer();};
}

/* ================= Ayarlar & modal ================= */
function openModal(html){$('#sheet').innerHTML=html;$('#modal').hidden=false;const f=$('#sheet button');if(f)f.focus();}
function closeModal(){$('#modal').hidden=true;}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal'&&!$('#modal').dataset.lock)closeModal();});
function applySettings(){document.body.classList.toggle('four',!!SAVE.settings.four);const sb=$('#g-sound');if(sb)sb.setAttribute('aria-pressed',SAVE.settings.sound!==false);Sahne.applySettings();if(G){G._mk='';G._bh='';render();}}
$('#g-sound').onclick=()=>{SAVE.settings.sound=SAVE.settings.sound===false;persist();applySettings();SFX.play('deal');};
function openSettings(){
  const s=SAVE.settings;
  const seg=(k,v,l)=>`<button data-k="${k}" data-v="${v}" aria-pressed="${s[k]===v}">${l}</button>`;
  const tog=(k)=>`<label class="switch"><input type="checkbox" data-t="${k}" ${s[k]?'checked':''}><span aria-hidden="true"></span></label>`;
  openModal(`<h3>Ayarlar</h3>
    <div class="set-row"><div><b>Oyun hızı</b><small>Rakiplerin ne kadar hızlı oynadığı</small></div><div class="seg">${seg('speed','normal','Normal')}${seg('speed','fast','Hızlı')}</div></div>
    <div class="set-row"><div><b>Sesler</b><small>Kart dağıtma, fiş ve kazanma sesleri</small></div>${tog('sound')}</div>
    <div class="set-row"><div><b>Rakip konuşmaları</b><small>Rakipler masada konuşur; balonlar başlarının üstünde çıkar</small></div>${tog('talk')}</div>
    <div class="set-row"><div><b>Masa görünümü</b><small>${Sahne.ok?'3D salonda masaya oturursun; düz masa daha hafiftir':'Bu bilgisayarda 3D (WebGL) desteklenmiyor'}</small></div><div class="seg">${Sahne.ok?seg('view','3d','3D salon'):''}${seg('view','2d','Düz masa')}</div></div>
    <div class="set-row"><div><b>Grafik kalitesi</b><small>Gölgeler, arka plandaki insanlar ve çözünürlük; tamamı yeni masada uygulanır</small></div><div class="seg">${seg('gfx','high','Yüksek')}${seg('gfx','mid','Dengeli')}${seg('gfx','low','Hafif')}</div></div>
    <div class="set-row"><div><b>Salon parlaklığı</b><small>Ekran karanlık ya da parlak geliyorsa ayarla</small></div><div class="seg">${seg('bright','dim','Loş')}${seg('bright','normal','Normal')}${seg('bright','bright','Aydınlık')}</div></div>
    <div class="set-row"><div><b>Masa kartları ekranda da</b><small>Ortadaki kartlar ve pot üstte ayrıca gösterilir; ışık ne olursa olsun okunur</small></div>${tog('boardHud')}</div>
    <div class="set-row"><div><b>Kamera sırası geleni izlesin</b><small>3D'de görüş dışındaki oyuncu oynarken başını ona çevirir</small></div>${tog('follow')}</div>
    <div class="set-row"><div><b>Davranış notları (kariyer)</b><small>Gördüğün davranışlar yorumsuz yazılır; kapatırsan yalnızca gözlerine güvenirsin</small></div>${tog('notes')}</div>
    <div class="set-row"><div><b>Dört renkli deste</b><small>Karo mavi, sinek yeşil olur; renkleri karıştırmazsın</small></div>${tog('four')}</div>
    <div class="set-row"><div><b>Serbest mod</b><small>Para yetmese de her masaya oturursun; kazanç ve kayıp cüzdana işlemez</small></div>${tog('free')}</div>
    <div class="set-row"><div><b>İlerlemeyi sıfırla</b><small>Cüzdan, tanınırlık, fethedilen masalar, dersler ve istatistikler silinir</small></div><button class="btn ghost small" id="reset-btn">Sıfırla</button></div>
    <div class="row"><button class="btn" id="set-close">Tamam</button></div>`);
  $$('#sheet .seg button').forEach(b=>b.onclick=()=>{s[b.dataset.k]=b.dataset.v;persist();applySettings();$$(`#sheet .seg button[data-k="${b.dataset.k}"]`).forEach(x=>x.setAttribute('aria-pressed',x===b));});
  $$('#sheet [data-t]').forEach(i=>i.onchange=()=>{s[i.dataset.t]=i.checked;persist();applySettings();});
  $('#reset-btn').onclick=e=>{
    const b=e.currentTarget;
    if(b.dataset.armed){const keep=SAVE.settings;SAVE=defSave();SAVE.settings=keep;persist();b.textContent='Sıfırlandı';b.disabled=true;renderMenu();return;}
    b.dataset.armed='1';b.textContent='Emin misin? Tekrar bas';
  };
  $('#set-close').onclick=()=>{closeModal();renderMenu();if(CUR==='scr-career')renderCareer();};
}
$('#open-settings').onclick=openSettings;
$('#open-ach').onclick=openAch;
$('#emote-open').onclick=toggleEmotes;
$$('#emote-list [data-e]').forEach(b=>b.onclick=()=>emoteSay(b.dataset.e,b.textContent));
$('#g-settings').onclick=openSettings;
// Android geri tuşu: önce açık pencereyi kapat, oyundaysan kalkmayı sor, alt ekrandaysan menüye dön; menüdeysen uygulamadan çık.
window.vyBack=()=>{
  if(!$('#modal').hidden){if(!$('#modal').dataset.lock)closeModal();return true;}
  if(CUR==='scr-game'){$('#g-leave').click();return true;}
  if(CUR==='scr-casino'){$('#c-leave').click();return true;}
  if(CUR==='scr-hall'){$('#h-leave').click();return true;}
  if(CUR!=='scr-menu'){show('scr-menu');return true;}
  return false;
};

/* ================= OYUN MOTORU ================= */
let G=null;
const ABORT={abort:true};
const spd=()=>SAVE.settings.speed==='fast'?.35:1;
async function wait(tok,ms){await sleep(ms*spd());if(!G||G.tok!==tok)throw ABORT;}
const money=n=>fmtM(n,G.venue.cur);
const canAct=p=>p.inHand&&!p.folded&&!p.allIn;
const live=()=>G.players.filter(p=>p.inHand&&!p.folded);
const potTotal=()=>G.pot+G.players.reduce((s,p)=>s+p.bet,0);
function nextIdx(i,pred){const n=G.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(pred(G.players[j]))return j;}return i;}
function isLate(p){return p.idx===G.dealer||nextIdx(p.idx,q=>q.inHand)===G.dealer;}
function posName(p){
  const g=G,seats=[];let i=g.dealer;
  do{if(g.players[i].inHand)seats.push(i);i=(i+1)%g.players.length;}while(i!==g.dealer);
  const n=seats.length,k=seats.indexOf(p.idx);
  if(n===2)return k===0?'Buton (küçük kör)':'Büyük kör';
  if(k===0)return 'Buton (en geç)';
  if(k===1)return 'Küçük kör';
  if(k===2)return 'Büyük kör';
  if(k===n-1)return 'Cutoff (geç)';
  if(k===3)return 'Erken (UTG)';
  return 'Orta';
}

// Masadan kalkış: fişler nakde döner. Turnuvada son ayakta kalmadan kalkan hiçbir şey alamaz.
function cashOut(){
  const g=G;if(!g||g.settled)return 0;g.settled=true;
  if(!g.paid)return 0;
  const open=g.venue.tourney&&!g.players.every(p=>p.human||p.out);
  const amt=open?0:toTL(g.players[0].chips,g.venue.cur);
  SAVE.cash+=amt;persist();
  return amt;
}
function startGame(venue,opt){
  if(G){cashOut();G.tok=null;G.reject&&G.reject(ABORT);}
  closeModal();
  const paid=!venue.training&&!SAVE.settings.free;
  if(paid&&SAVE.cash<entryTL(venue)){
    G=null;Sahne.stop();SFX.ambient(null);show('scr-career');
    toast('Paran yetmiyor',`${venue.name} girişi ${tl(entryTL(venue))}; cüzdanında ${tl(SAVE.cash)} var.`,'info');
    return;
  }
  const rl=venue.training?0:repLvl(venue);
  if(paid){SAVE.cash-=entryTL(venue);persist();}
  const players=[{name:'Sen',human:true,style:null,prof:null}];
  venue.rivals.forEach(([n,s])=>players.push({name:n,human:false,style:s,prof:STYLES[s],char:CHARS[n]||{}}));
  players.forEach((p,i)=>Object.assign(p,{idx:i,chips:venue.buy,cards:[],bet:0,total:0,folded:false,allIn:false,inHand:false,out:false,show:false,won:0,lastAct:'',actCls:'',tilt:0,notes:[]}));
  G={venue,players,tok:{},dealer:Math.floor(rnd()*players.length),handNo:0,deck:[],board:[],pot:0,curBet:0,minRaise:venue.bb,sb:venue.levels?venue.levels[0][0]:venue.sb,bb:venue.levels?venue.levels[0][1]:venue.bb,ante:venue.ante||0,unit:venue.unit||venue.sb,lvlN:0,streak:0,meRaised:false,nRaises:0,street:0,turn:-1,phase:'idle',winSet:null,hs:{hands:0,raises:0,calls:0},lastAgg:null,resolve:null,reject:null,nextResolve:null,noteSeen:new Set(),paid,rl,settled:false};
  G.v3=Sahne.ok&&SAVE.settings.view!=='2d';G.fromHall=!!(opt&&opt.fromHall)&&G.v3;
  if(rl)setTimeout(()=>{if(G&&G.venue===venue)toast(`Masa seni tanıdı · ${REP[rl].t}`,REP[rl].d,'info');},1200);
  const sg=$('#scr-game');
  sg.dataset.venue=venue.id;sg.classList.toggle('v3on',G.v3);sg.classList.toggle('training',!!venue.training);
  $('#g-vname').textContent=venue.name+(venue.practice?' · Alıştırma':'');
  setVInfo();
  $('#felt-name').textContent=venue.name;
  $('#log-list').innerHTML='';
  $('#notes-list').innerHTML='';
  $('#banner').hidden=true;
  (G.v3?$('#v3'):$('#table .center')).appendChild($('#banner'));
  // Koç (olasılık, öneri, anlatıcı) yalnızca alıştırmada; kariyer masasında kendi kafanla oynarsın.
  $('#coach').hidden=!venue.training;
  $('#notes').hidden=!venue.training&&SAVE.settings.notes===false;
  $('#notes-tip').textContent=venue.training?'Davranış ve anlamı':'Gördüğün davranışlar';
  $('#coach-toggle').checked=true;$('#coach-state').textContent='Açık';
  $('#coach-narr').hidden=true;
  $('#coach-body').innerHTML=coachIdle();
  $('#v3-me').innerHTML='';$('#v3-board').innerHTML='';$('#emote-list').hidden=true;$('#say-me').hidden=true;
  $('#a-human').hidden=true;$('#a-next').hidden=true;$('#a-status').textContent='';
  buildTable();
  show('scr-game');
  if(G.v3)G.intro=Sahne.start(G,$('#v3'),{intro:G.fromHall?'sit':null});else Sahne.stop();
  SFX.ambient(venue.id);
  render();
  runTable(G.tok);
}

function setVInfo(){const g=G,V=g.venue;$('#g-vinfo').textContent=`${V.place} · Körler ${fmtM(g.sb,V.cur)}/${fmtM(g.bb,V.cur)}${g.ante?' · Ante '+fmtM(g.ante,V.cur):''}${V.levels?' · Seviye '+(g.lvlN+1):''}${g.rl?' · '+REP[g.rl].t:''}`;}

function buildTable(){
  const t=$('#table');
  t.querySelectorAll('.seat,.bet').forEach(e=>e.remove());
  const N=G.players.length;
  G.players.forEach((p,i)=>{
    const ang=(90+i*360/N)*Math.PI/180;p.ang=ang;
    const cx=Math.cos(ang),cy=Math.sin(ang);
    const s=document.createElement('div');
    s.className='seat'+(p.human?' me':'');
    s.style.setProperty('--x',(50+cx*45)+'%');
    s.style.setProperty('--y',(50+cy*(p.human?39:41))+'%');
    const ava=p.human?'var(--ivory)':`var(--st-${p.style})`;
    s.innerHTML=`<div class="s-cards"></div><div class="s-plate" style="--ava:${ava}" title="${p.human?'Sen':p.name+' · '+p.prof.label}"><span class="s-ava">${p.human?'SEN':initials(p.name)}</span><div class="s-meta"><span class="s-name"></span><span class="s-chips"></span></div><span class="s-tag"></span>${p.human?'':'<span class="s-act"></span><span class="s-say"></span>'}</div><div class="s-hand"></div>`;
    $('.s-name',s).textContent=p.human?'Sen':p.name;
    t.appendChild(s);p.el=s;p._ck='';
    const b=document.createElement('div');b.className='bet';b.hidden=true;
    b.style.setProperty('--x',(50+cx*29)+'%');b.style.setProperty('--y',(50+cy*(p.human?22:25))+'%');
    b.innerHTML='<span class="chip"></span><span class="amt"></span>';
    t.appendChild(b);p.betEl=b;
  });
  G._bk='';G._bn=0;
}

function render(){
  if(!G)return;
  const g=G;
  const pt=potTotal();
  $('#pot').innerHTML=pt>0?`<span class="chip"></span>Pot <b>${money(pt)}</b>`:'';
  const bk=g.board.join(',')+'|'+(g.winSet?[...g.winSet].join(','):'');
  if(bk!==g._bk){
    const prevN=g.board.length<(g._bn||0)?0:(g._bn||0);let h='';
    for(let i=0;i<5;i++){
      const c=g.board[i];
      if(c==null){h+='<span class="slot"></span>';continue;}
      let cls=i>=prevN?'deal':'';
      if(g.winSet)cls+=g.winSet.has(c)?' win':' dim';
      h+=cardHTML(c,cls);
    }
    $('#board').innerHTML=h;
    g._bk=bk;g._bn=g.board.length;
  }
  g.players.forEach((p,i)=>{
    const el=p.el;
    el.classList.toggle('turn',g.turn===i);
    el.classList.toggle('thinking',g.turn===i&&!p.human);
    el.classList.toggle('folded',p.folded&&p.inHand);
    el.classList.toggle('out',p.out);
    el.classList.toggle('winner',g.phase==='done'&&p.won>0);
    $('.s-chips',el).textContent=p.out?'Masadan kalktı':(p.allIn&&p.inHand&&!p.folded&&g.phase!=='done'?'All-in':money(p.chips));
    const shown=p.human||p.show;
    const ck=p.cards.join(',')+'|'+(shown?1:0)+'|'+(g.winSet?1:0);
    if(ck!==p._ck){
      const prevN=p._cn||0,wasShown=p._sh;
      $('.s-cards',el).innerHTML=p.cards.map((c,j)=>{
        let cls=j>=prevN?'deal':(!wasShown&&shown?'flip':'');
        if(g.winSet&&shown)cls+=g.winSet.has(c)?' win':' dim';
        return cardHTML(shown?c:null,cls);
      }).join('');
      p._ck=ck;p._cn=p.cards.length;p._sh=shown;
    }
    let tag='';if(p.inHand&&g.phase!=='idle'){if(i===g.sbI)tag='SB';if(i===g.bbI)tag='BB';}
    $('.s-tag',el).textContent=tag;
    const a=$('.s-act',el);if(a){a.textContent=p.lastAct;a.className='s-act '+(p.actCls||'');}
    let hand='';
    if(p.inHand&&!p.folded&&p.cards.length===2){
      if(p.human&&g.board.length>=3)hand=describe(evalCards(p.cards.concat(g.board)));
      else if(p.human)hand=preflopName(p.cards);
      else if(p.show&&g.board.length===5)hand=describe(evalCards(p.cards.concat(g.board)));
    }
    $('.s-hand',el).textContent=hand;
    p.betEl.hidden=!(p.bet>0);
    if(p.bet>0)$('.amt',p.betEl).textContent=money(p.bet);
  });
  const d=g.players[g.dealer];
  if(d){const a=d.ang-0.45;const db=$('#dbtn');db.style.setProperty('--x',(50+Math.cos(a)*35)+'%');db.style.setProperty('--y',(50+Math.sin(a)*(d.human?27:29))+'%');}
  const me=g.players[0],V=g.venue;
  if(V.target){
    $('#g-goal-txt').innerHTML=`Hedef <b>${money(me.chips)}</b> / ${money(V.target)}`;
    $('#g-goal-bar').style.width=clamp(me.chips/V.target*100,0,100)+'%';
  }else if(V.tourney&&!V.training){
    const alive=g.players.filter(p=>!p.out).length;
    $('#g-goal-txt').innerHTML=`Turnuva · <b>${alive}</b> oyuncu kaldı · Fişin <b>${money(me.chips)}</b>`;
    $('#g-goal-bar').style.width=clamp(me.chips/(V.buy*g.players.length)*100,0,100)+'%';
  }else{
    $('#g-goal-txt').innerHTML=`El <b>#${g.handNo}</b> · Fişin <b>${money(me.chips)}</b>`;
    $('#g-goal-bar').style.width=clamp(me.chips/(V.buy*2)*100,0,100)+'%';
  }
  if(g.v3){
    Sahne.sync(g);
    // 3D'de kendi kartların masada da durur; köşede okunaklı bir kopyası ve elinin adı
    const mk=me.cards.join(',')+'|'+me.folded+'|'+g.board.length+'|'+(g.winSet?1:0)+'|'+me.chips;
    if(mk!==g._mk){
      g._mk=mk;
      const has=me.inHand&&me.cards.length===2&&!me.folded;
      const hd=has?(g.board.length>=3?describe(evalCards(me.cards.concat(g.board))):preflopName(me.cards)):'';
      $('#v3-me').innerHTML=has?`<div class="cards">${me.cards.map(c=>cardHTML(c,g.winSet?(g.winSet.has(c)?'win':'dim'):'')).join('')}</div><span>${hd}</span>`:(me.folded&&me.inHand?'<span class="muted">Çekildin</span>':'');
    }
    // Ortadaki kartlar ve pot üstte de: 3D'de ışık, açı ya da bakış yönü ne olursa olsun okunur kalsın
    const hud=SAVE.settings.boardHud!==false,pt=potTotal();
    const bk=hud+'|'+g.board.join(',')+'|'+(g.winSet?[...g.winSet].join(','):'')+'|'+pt;
    if(bk!==g._bh){
      g._bh=bk;
      $('#v3-board').innerHTML=hud&&(g.board.length||pt>0)?`${g.board.length?`<div class="cards">${g.board.map(c=>cardHTML(c,g.winSet?(g.winSet.has(c)?'win':'dim'):'')).join('')}</div>`:''}${pt>0?`<span class="bpot"><span class="chip"></span>Pot <b>${money(pt)}</b></span>`:''}`:'';
    }
  }
}

function addLog(txt,cls=''){
  const ul=$('#log-list');const li=document.createElement('li');li.className=cls;li.textContent=txt;ul.appendChild(li);
  while(ul.children.length>220)ul.firstChild.remove();
  ul.scrollTop=ul.scrollHeight;
}
function narrate(html){if(!G||!G.venue.training)return;const n=$('#coach-narr');n.innerHTML=html;n.hidden=false;}

function commit(p,amt){amt=Math.min(amt,p.chips);p.chips-=amt;p.bet+=amt;p.total+=amt;if(p.chips===0)p.allIn=true;}
function collectBets(){let any=false;G.players.forEach(p=>{if(p.bet>0)any=true;G.pot+=p.bet;p.bet=0;});if(any)SFX.play('sweep');}

async function runTable(tok){
  try{
    if(G.intro){$('#a-status').textContent='Masaya yürüyorsun…';await G.intro;if(!G||G.tok!==tok)return;G.intro=null;}
    Talk.greet();Talk.start();
    while(true){
      await playHand(tok);
      const g=G,V=g.venue,me=g.players[0];
      g.players.forEach(p=>{
        if(!p.human&&!p.out&&p.chips<=0){
          if(V.training){p.chips=V.buy;addLog(`${p.name} yeniden ${money(V.buy)} fiş aldı.`);}
          else{p.out=true;addLog(`${p.name} bütün fişlerini kaybetti ve masadan kalktı.`);if(g.v3){Sahne.act(p,'leave');Sahne.attend(p.idx,2.5);}}
        }
      });
      render();
      if(me.chips<=0){await wait(tok,1500);endModal('bust');return;}
      if(!V.training&&((V.target&&me.chips>=V.target)||g.players.every(p=>p.human||p.out))){await wait(tok,1500);endModal('win');return;}
      await waitNext(tok);
    }
  }catch(e){if(e!==ABORT)console.error(e);}
}

async function playHand(tok){
  const g=G,V=g.venue;
  g.handNo++;g.board=[];g.pot=0;g.street=0;g.winSet=null;g.phase='deal';g.nRaises=0;g.lastAgg=null;g.meRaised=false;
  if(V.levels&&V.blindUp&&g.handNo>1&&(g.handNo-1)%V.blindUp===0&&g.lvlN<V.levels.length-1){
    g.lvlN++;[g.sb,g.bb]=V.levels[g.lvlN];setVInfo();SFX.play('bell');
    addLog(`Körler yükseldi: ${money(g.sb)} / ${money(g.bb)}`,'sep');toast('Körler yükseldi',`${money(g.sb)} / ${money(g.bb)} · seviye ${g.lvlN+1}`,'info');
  }
  $('#banner').hidden=true;
  for(const p of g.players){p.cards=[];p.bet=0;p.total=0;p.folded=false;p.allIn=false;p.lastAct='';p.actCls='';p.show=false;p.won=0;p.inHand=!p.out&&p.chips>0;p._cn=0;p.notes=[];p.startChips=p.chips;p.tilt=(p.tilt||0)*.8;p.rel=null;p.flushRe=false;}
  const seated=g.players.filter(p=>p.inHand);
  g.dealer=nextIdx(g.dealer,p=>p.inHand);
  if(seated.length===2){g.sbI=g.dealer;g.bbI=nextIdx(g.sbI,p=>p.inHand);}
  else{g.sbI=nextIdx(g.dealer,p=>p.inHand);g.bbI=nextIdx(g.sbI,p=>p.inHand);}
  g.deck=newDeck();
  render();
  if(g.v3)Sahne.shuffle(g);
  SFX.play('shuffle');await wait(tok,g.v3?900:520);
  addLog(`El #${g.handNo} · Dealer: ${g.players[g.dealer].name}`,'sep');
  const sb=g.players[g.sbI],bb=g.players[g.bbI];
  if(g.ante>0){
    for(const p of seated){const a=Math.min(g.ante,p.chips);p.chips-=a;p.total+=a;g.pot+=a;if(p.chips===0)p.allIn=true;}
    addLog(`Ante: herkes ${money(g.ante)} koydu`);SFX.play('chip',3);render();await wait(tok,g.v3?400:200);
  }
  commit(sb,g.sb);sb.lastAct='SB';commit(bb,g.bb);bb.lastAct='BB';SFX.play('chip',2);
  addLog(`${sb.name} küçük kör: ${money(sb.bet)}`);
  addLog(`${bb.name} büyük kör: ${money(bb.bet)}`);
  g.curBet=g.bb;g.minRaise=g.bb;
  g.hs.hands++;g._vp=false;
  render();
  for(let r=0;r<2;r++){let i=g.sbI;for(let k=0;k<seated.length;k++){g.players[i].cards.push(g.deck.pop());render();SFX.play('deal');await wait(tok,g.v3?150:90);i=nextIdx(i,p=>p.inHand);}}
  Tells.dealt();
  const me=g.players[0];
  if(me.inHand){
    addLog(`Kartların: ${me.cards.map(ctxt).join(' ')}`,'me');
    const t=handTier(me.cards);
    narrate(`<b>Yeni el.</b> Dealer butonu: ${g.players[g.dealer].name}. Küçük kör ${sb.name} (${money(g.sb)}), büyük kör ${bb.name} (${money(g.bb)}). Kartların ${ic(me.cards)}: başlangıç tablosunda <b>${TIER_NAME[t]}</b> sınıfında. Pozisyonun: ${posName(me)}.`);
  }
  g.phase='bet';
  for(let st=0;st<4;st++){
    g.street=st;
    if(st>0){
      collectBets();
      const cnt=st===1?3:1;
      g.players.forEach(p=>{if(!p.allIn||p.folded){p.lastAct='';p.actCls='';}});
      g.curBet=0;g.minRaise=g.bb;g.nRaises=0;
      render();await wait(tok,350);
      for(let k=0;k<cnt;k++){g.board.push(g.deck.pop());render();SFX.play('flip');if(k<cnt-1)await wait(tok,130);}
      const nm=['','Flop','Turn','River'][st];
      addLog(`${nm}: ${g.board.map(ctxt).join(' ')}`,'sep');
      Tells.board(st);
      if(me.inHand&&!me.folded){
        const d=describe(evalCards(me.cards.concat(g.board)));
        let extra='';
        if(st<3){const o=countOuts(me.cards,g.board);if(o.n)extra=` Elini güçlendirecek <b>${o.n} out</b> var${o.draw?' ('+o.draw+')':''}.`;}
        const txt=[ '',`<b>Flop açıldı:</b> masaya üç ortak kart geldi. Elin: <b>${d}</b>.`,`<b>Turn:</b> dördüncü ortak kart. Elin: <b>${d}</b>.`,`<b>River:</b> son kart. Artık çekiliş yok; elin: <b>${d}</b>.`][st];
        narrate(txt+extra);
      }
      await wait(tok,550);
    }
    if(live().length>1&&g.players.filter(canAct).length<=1&&g.players.filter(p=>canAct(p)&&p.bet<g.curBet).length===0){
      if(!live().every(p=>p.show)){live().forEach(p=>p.show=true);render();SFX.play('flip');addLog('Bahisler kapandı, kartlar açılıyor.');await wait(tok,700);}
      continue;
    }
    if(live().length>1)await bettingRound(tok,st);
    if(live().length<=1)break;
  }
  collectBets();render();
  await finishHand(tok);
}

async function bettingRound(tok,st){
  const g=G;
  const seatedN=g.players.filter(p=>p.inHand).length;
  let i=st===0?(seatedN===2?g.sbI:nextIdx(g.bbI,p=>p.inHand)):nextIdx(g.dealer,p=>p.inHand);
  let pending=new Set(g.players.filter(canAct));
  let guard=0;
  while(pending.size>0&&guard++<2000){
    if(live().length<=1)return;
    const p=g.players[i];
    if(pending.has(p)){
      if(!canAct(p))pending.delete(p);
      else if(g.players.filter(canAct).length===1&&p.bet>=g.curBet)pending.delete(p);
      else{
        g.turn=i;render();
        const before=g.curBet;
        const a=p.human?await humanTurn(tok,p):await botTurn(tok,p);
        const fin=applyAction(p,a);
        if(p.human)Tells.humanActed(fin);else Tells.acted(p,fin);
        pending.delete(p);
        if(g.curBet>before)pending=new Set(g.players.filter(q=>canAct(q)&&q!==p));
        g.turn=-1;render();
        await wait(tok,120);
      }
    }
    i=(i+1)%g.players.length;
  }
}

function legal(p){
  const g=G,V=g.venue;
  const toCall=Math.min(Math.max(0,g.curBet-p.bet),p.chips);
  const maxTo=p.bet+p.chips;
  const others=g.players.filter(q=>q!==p&&canAct(q)).length;
  const canRaise=others>0&&p.chips>toCall;
  const minTo=Math.min(maxTo,g.curBet===0?g.bb:g.curBet+g.minRaise);
  return {toCall,maxTo,minTo,canRaise};
}

function applyAction(p,a){
  const g=G;const L=legal(p);
  if(a.type==='raise'&&(!L.canRaise))a={type:L.toCall>0?'call':'check'};
  if(a.type==='check'&&L.toCall>0)a={type:'fold'};
  if(p.human){if(a.type==='raise'){g.hs.raises++;g.meRaised=true;}else if(a.type==='call')g.hs.calls++;}
  let txt='',cls='';
  if(a.type==='fold'){p.folded=true;txt='Çekildi';cls='fold';}
  else if(a.type==='check'){txt='Kontrol';}
  else if(a.type==='call'){
    commit(p,L.toCall);txt=p.allIn?`All-in ${money(p.bet)}`:`Gördü ${money(L.toCall)}`;
  }else{
    let to=clamp(Math.round(a.to),L.minTo,L.maxTo);
    if(to<=g.curBet){commit(p,L.toCall);txt=p.allIn?`All-in ${money(p.bet)}`:`Gördü ${money(L.toCall)}`;}
    else{
      const wasBet=g.curBet===0;const size=to-g.curBet;
      if(size>=g.minRaise)g.minRaise=size;
      g.curBet=to;g.nRaises++;g.lastAgg=p;
      commit(p,to-p.bet);
      txt=p.allIn?`All-in ${money(p.bet)}`:(wasBet?`Bahis ${money(to)}`:`Artırdı ${money(to)}`);cls='raise';
    }
  }
  p.lastAct=txt;p.actCls=cls;
  if(a.type==='fold')SFX.play('fold');
  else if(a.type==='check')SFX.play('check');
  else if(p.allIn)SFX.play('allin');
  else SFX.play('chip',cls==='raise'?4:2);
  const who=p.human?'Sen':p.name;
  const ht=p.human?txt.replace('Çekildi','çekildin').replace('Gördü','gördün').replace('Artırdı','artırdın'):txt.toLocaleLowerCase('tr-TR');
  addLog(`${who}: ${ht}`,p.human?'me':'');
  return {type:a.type==='raise'&&cls!=='raise'?'call':a.type,allIn:p.allIn,bet:p.bet};
}

function humanTurn(tok,p){
  return new Promise((res,rej)=>{
    G.reject=rej;
    G.resolve=a=>{G.resolve=null;G.reject=null;setActions('wait');res(a);};
    setActions('human',p);
    SFX.play('turn');
    if(G.venue.training)coachUpdate(p);
    Tells.anticipate();
  });
}
async function botTurn(tok,p){
  setActions('wait',p);
  const me=G.players[0];const away=!me.inHand||me.folded;
  // Karar önce verilir; düşünme süresi ve beden dili karara göre şekillenir (zamanlama da bir tell'dir).
  const a=botDecide(p);
  const ms=Tells.plan(p,a);
  await wait(tok,ms*(away?.6:1));
  return a;
}
function waitNext(tok){
  return new Promise((res,rej)=>{G.reject=rej;G.nextResolve=()=>{G.nextResolve=null;G.reject=null;$('#a-next').hidden=true;$('#a-status').textContent='Kartlar dağıtılıyor…';res();};setActions('done');});
}

/* ---------- Bot zekâsı ---------- */
function botDecide(p){
  const g=G,V=g.venue,sk=V.skill,BB=g.bb;
  // Tilt (büyük kayıptan sonra duygusal oyun) tarzı gevşetip saldırganlaştırır.
  const tl=p.tilt||0,pr0=p.prof,pr={aggr:clamp(pr0.aggr+tl*.3,0,1),loose:clamp(pr0.loose+tl*.25,0,1),bluff:clamp(pr0.bluff+tl*.2,0,1)};
  const wealth=p.char&&p.char.wealth!=null?p.char.wealth:.5;
  const L=legal(p);const toCall=L.toCall;
  const pot=potTotal();
  const opps=g.players.filter(q=>q!==p&&q.inHand&&!q.folded).length;
  let canRaise=L.canRaise;
  const r=rnd();
  const eq=equity(p.cards,g.board,Math.max(1,opps),Math.round(80+sk*420));
  p._dec={eq,rel:eq*(Math.max(1,opps)+1),draw:(g.street===1||g.street===2)&&countOuts(p.cards,g.board).n>=8};
  p.rel=p._dec.rel;
  let pe=eq+gauss()*(1-sk)*0.18;
  if(toCall>0&&sk>0.3){const f=Math.min(1.5,toCall/Math.max(pot,1));pe-=sk*0.07*f*(g.street>=2?1.4:1);}
  if(sk>0.6&&g.lastAgg&&g.lastAgg.human&&g.hs.hands>=6){const af=g.hs.raises/Math.max(1,g.hs.calls);if(af>1.6)pe+=0.05;else if(af<0.5)pe-=0.05;}
  // Maddi durum: varlıklı oyuncu yığınına oranla büyük bahisleri rahat öder, kıt parayla oynayan çekinir ("korkak para").
  if(toCall>0)pe+=(wealth-.5)*.08*clamp(toCall/Math.max(1,p.chips)*3,0,1);
  // Tanınırlık: masanın tanıdığı oyuncunun bahsine çoğu rakip çekinerek bakar; manyak tersine meydan okur.
  const awe=g.rl&&toCall>0&&g.lastAgg&&g.lastAgg.human?REP[g.rl].awe*(AWE_ST[p.style]??1):0;
  pe-=awe;
  pe=clamp(pe,0,1);
  const fair=1/(opps+1),rel=pe/fair;
  if(g.nRaises>=3&&rel<2.4)canRaise=false;
  const late=isLate(p);
  const bluffF=pr.bluff*(0.6+sk*0.6);
  const short=p.chips+p.bet<BB*12;
  const raiseTo=to=>{
    if(to>g.curBet)to=g.curBet+(to-g.curBet)*(.85+wealth*.3);
    to=Math.round(to/g.unit)*g.unit;to=clamp(to,L.minTo,L.maxTo);
    if(sk>0.4&&to>=L.maxTo*0.75)to=L.maxTo;
    if(short)to=L.maxTo;
    return {type:'raise',to};
  };
  const call=()=>toCall===0?{type:'check'}:{type:'call'};
  const fold=()=>toCall===0?{type:'check'}:{type:'fold'};
  if(sk<0.3&&r<0.02&&canRaise&&pr.aggr>0.5)return raiseTo(L.maxTo);
  if(g.street===0){
    const tier=handTier(p.cards);
    const chart=[1,.82,.64,.46,.22][tier-1]+(late?0.06:0);
    const s=sk*chart+(1-sk)*clamp(rel/2.6,0,1)+gauss()*(1-sk)*0.12;
    if(g.curBet<=BB){
      if(canRaise&&s>0.76-pr.aggr*0.14&&r<0.55+pr.aggr*0.45){
        const limpers=g.players.filter(q=>q!==p&&q.inHand&&!q.folded&&q.bet>=BB&&q.idx!==g.bbI).length;
        return raiseTo(BB*(2.5+rnd()*(1-sk)*2)+limpers*BB);
      }
      if(canRaise&&late&&r<bluffF*0.5&&s>0.3)return raiseTo(BB*2.5);
      if(s>0.44-pr.loose*0.28)return call();
      return fold();
    }
    let need=0.52+Math.min(toCall/BB,20)*0.012-pr.loose*0.26;
    if(toCall/Math.max(1,p.chips)>0.3)need+=0.14*sk;
    need+=awe*1.5;
    if(canRaise&&s>0.86-pr.aggr*0.1&&r<0.45+pr.aggr*0.4)return raiseTo(g.curBet*(2.6+rnd()*0.8));
    if(canRaise&&late&&r<bluffF*0.12&&s>0.35)return raiseTo(g.curBet*3);
    if(s>need)return call();
    return fold();
  }
  const potOdds=toCall>0?toCall/(pot+toCall):0;
  if(toCall===0){
    if(canRaise&&rel>1.45-pr.aggr*0.25){
      if(sk>0.6&&rel>2.6&&r<0.22)return {type:'check'};
      const f=0.45+0.4*clamp((rel-1)/2,0,1)+(1-sk)*(rnd()-0.5)*0.6;
      return raiseTo(pot*f);
    }
    const bl=bluffF*(opps===1?1:0.45)*(late?1.25:0.8)*(g.street===3?0.85:1);
    if(canRaise&&r<bl)return raiseTo(pot*(0.5+rnd()*0.25));
    return {type:'check'};
  }
  if(canRaise&&rel>2.0-pr.aggr*0.3&&r<0.3+pr.aggr*0.5)return raiseTo(g.curBet*2.4+pot*0.25);
  const th=potOdds-(g.street<3?0.05:0)-pr.loose*0.12*(1-sk*0.5);
  if(pe>=th)return call();
  if(canRaise&&opps===1&&g.street<3&&r<bluffF*0.12)return raiseTo(g.curBet*2.5);
  return fold();
}

/* ---------- Davranış (tell) sistemi ----------
   Bedenin sızdırdıkları, poker psikolojisinin bilinen kalıplarına göre (Caro, Navarro):
   · Güçlü el: fişlere göz atma, dikleşme, bahiste titreyen eller, sonrasında ilgisiz/zayıf rolü (omuz silkme, başka yere bakma).
   · Blöf: donma, nefesini tutma, rakibe dik bakış, sert fiş atma, sonra boyun/yüz ovma (rahatlama hareketi).
   · Zayıf el: ilgisizlik, sıra gelmeden kartlara uzanma; kaçan masaya uzun bakış, düşen omuzlar.
   · Zamanlama: amatör güçlü elde sahte tereddüt eder, çekilişle anında görür; profesyonelin temposu hep aynıdır.
   · Alışkanlıktan sapma: tespihin durması/hızlanması, sigaraya art arda nefes, rahat çay yudumu.
   Sızıntı masa seviyesi yükseldikçe azalır; üst düzey tilki/köpekbalığı tipleri ara sıra bilerek ters sinyal verir.
   Kariyerde yalnızca gördüğün davranış (yorumsuz) yazılır; anlamını alıştırma masasında koç söyler. */
const Tells=(()=>{
  const leak=p=>{const sk=G.venue.skill;return clamp((1-sk*.9)*((p.char&&p.char.expr)||1)*.7*(1+(p.tilt||0)*.6),.03,.85);};
  const fake=p=>{const sk=G.venue.skill;return (p.style==='tilki'||p.style==='kopekbaligi')&&sk>.5?(sk-.5)*.5:0;};
  // 3D'de hareket gerçekten oynadıysa true döner; düz masada her zaman true (yalnızca not düşülür)
  const anim=(p,v,o)=>G&&G.v3?Sahne.act(p,v,o):true;
  const relOf=(p,it=200)=>{const opps=G.players.filter(q=>q!==p&&q.inHand&&!q.folded).length||1;return equity(p.cards,G.board,opps,it)*(opps+1);};
  function later(ms,fn){const g=G,h=g&&g.handNo;setTimeout(()=>{if(!G||G!==g||G.handNo!==h)return;try{fn();}catch(e){console.error(e);}},ms*spd());}
  function note(p,txt,mean){
    if(!G||p.out)return;
    if(!G.venue.training&&SAVE.settings.notes===false)return;
    if(G.v3&&!Sahne.inView(p))return;   // bakmadığın oyuncunun davranışını kaçırırsın
    const k=G.handNo+'|'+p.idx+'|'+txt;if(G.noteSeen.has(k))return;G.noteSeen.add(k);
    p.notes.push(txt);
    const ul=$('#notes-list');const li=document.createElement('li');
    li.innerHTML=`<b>${p.name}</b> ${txt}${G.venue.training&&mean?`<em>${mean}</em>`:''}`;
    ul.appendChild(li);while(ul.children.length>90)ul.firstChild.remove();ul.scrollTop=ul.scrollHeight;
  }
  // Hareket + not: not yalnızca hareket gerçekten oynarsa yazılır
  const tell=(p,v,o,txt,mean)=>{if(anim(p,v,o))note(p,txt,mean);};
  return {
    dealt(){
      G.players.forEach(p=>{
        if(p.human||!p.inHand)return;
        const t=handTier(p.cards);p.rel=relOf(p,150);
        const lk=leak(p),fk=fake(p),sk=G.venue.skill;
        const d0=300+rnd()*(sk>.6?2400:1200);
        later(d0,()=>anim(p,'peek'));
        later(d0+1500,()=>{
          if(p.folded)return;
          let strong=t<=2,weak=t>=5;
          if(rnd()<fk){const s=strong;strong=weak;weak=s;}
          if(p.char.chatty&&strong&&rnd()<lk+.3){tell(p,'hush',{dur:35},'Az önce durmadan konuşuyordu; kartlarına baktıktan sonra birden sustu.','Ani sessizlik: konuşkan biri susarsa dikkati eline kilitlenmiştir. Güçlü el olabilir.');return;}
          if(p.char.quirk==='tespih'&&strong&&rnd()<lk+.25){tell(p,'tespihStop',{dur:7},'Kartlarına baktı; elindeki tespih bir anda durdu.','Alışkanlıktan sapma: sürekli çektiği tespihin durması, dikkatinin aniden keskinleştiğini gösterir. Güçlü el olabilir.');return;}
          if(strong&&rnd()<lk*.8){
            if(rnd()<.6)tell(p,'glanceChips',null,'Kartlarına baktıktan hemen sonra gözü fişlerine kaydı.','Güçlü el: iyi kart gören oyuncu farkında olmadan bahse hazırlanır ve fişlerine bakar.');
            else tell(p,'sitUp',null,'Kartlarına baktıktan sonra dikleşti, kaşları kalktı.','İlgi ve heyecan: beğendiği bir el gördü.');
          }else if(weak&&rnd()<lk*.65)tell(p,'lookAway',null,'Kartlarına bir kez bakıp ilgisizce başka yere döndü.','Zayıf el: oyundan kopmuş, büyük ihtimalle çekilecek.');
        });
        if(!p.shortNoted&&p.chips<G.bb*15&&!G.venue.training){p.shortNoted=true;later(2800,()=>tell(p,'countChips',null,'Kalan fişlerini tek tek saydı.','Az fiş kaldı: ya ilk iyi elde hepsini sürecek ya da çok sıkı oynayacak.'));}
      });
    },
    board(st){
      const bs=[0,0,0,0];G.board.forEach(c=>bs[c&3]++);const fl=bs.findIndex(n=>n>=3);
      G.players.forEach((p,k)=>{
        if(p.human||!p.inHand||p.folded)return;
        const prev=p.rel==null?1:p.rel,rel=relOf(p);p.rel=rel;
        const lk=leak(p),fk=fake(p);
        const d0=150+k*110+rnd()*300;
        later(d0,()=>{if(!p.folded)anim(p,'lookBoard');});
        later(d0+1100,()=>{
          if(p.folded)return;
          let hit=rel>=2&&rel-prev>.35,miss=rel<.75&&rel-prev<-.25;
          if(rnd()<fk){const s=hit;hit=miss;miss=s;}
          const mine=fl<0?2:p.cards.filter(c=>(c&3)===fl).length;
          if(fl>=0&&!p.flushRe&&mine<2&&rnd()<lk*.85){p.flushRe=true;tell(p,'recheck',null,'Masada aynı renkten üç kart görünce kartlarına yeniden baktı.','Rengini hatırlamıyor: büyük ihtimalle floşu yok; en fazla o renkten tek kartı var.');return;}
          if(hit&&p.char.chatty&&rnd()<lk+.2){tell(p,'hush',{dur:30},'Kartlar açılınca lafı yarıda kesip sustu.','Ani sessizlik: açılan kartlar onu bir anda ciddileştirdi. Güçlü el olabilir.');return;}
          if(hit&&rnd()<lk*.75){
            if(rnd()<.55)tell(p,'lookAwayQuick',null,'Kartlar açılınca masaya kısa bir bakış atıp hemen gözünü kaçırdı.','İsabet: güçlü bir bağlantı yakalayan, heyecanını saklamak için masadan uzaklaşır.');
            else tell(p,'glanceChips',null,'Açılan kartlara baktı, sonra gözü fişlerine gitti.','Güçlü el: bahis yapmayı şimdiden düşünüyor.');
          }else if(miss&&rnd()<lk*.6)tell(p,rnd()<.5?'slump':'stareBoard',null,'Masaya uzun uzun baktı, omuzları düştü.','Hayal kırıklığı: açılan kartlar eline yaramadı.');
          else if(st<3&&!hit&&rnd()<lk*.5&&countOuts(p.cards,G.board).n>=8)tell(p,'leanIn',null,'Öne eğilip masayı dikkatle inceledi.','Çekiliş: eli henüz tamamlanmadı ama ilgisini kaybetmedi (floş ya da kent bekliyor olabilir).');
        });
      });
    },
    anticipate(){
      if(G.v3)Sahne.attend(0,2,.4);
      G.players.forEach(p=>{
        if(p.human||!canAct(p))return;
        const rel=p.rel==null?1:p.rel,lk=leak(p),facing=G.curBet>p.bet;
        if(facing&&rel<.6&&rnd()<lk*.6)later(400+rnd()*900,()=>{if(G.resolve&&!p.folded)tell(p,'reachCards',{dur:4},'Sıra kendisine gelmeden kartlarına uzandı.','Çekilmeye hazırlanıyor: zayıf el. Bahis yaparsan büyük ihtimalle bırakır.');});
        else if(rel>2.1&&rnd()<lk*.5)later(400+rnd()*900,()=>{if(G.resolve&&!p.folded)tell(p,'reachChips',{dur:4},'Sıra kendisine gelmeden fişlerine uzanıp sana baktı.','Bahse hazırlanıyor: güçlü el. Bu oyuncuya karşı blöf yapma.');});
      });
    },
    plan(p,a){
      const d=p._dec||{rel:1},lk=leak(p),sk=G.venue.skill;
      const agg=a.type==='raise';
      p._pl={value:agg&&d.rel>=1.6,bluff:agg&&d.rel<.85,snap:false,tank:false};
      let ms=800+rnd()*650;
      if(sk>.7&&rnd()>lk)ms=1050+rnd()*600;   // profesyonel: her kararda aynı tempo
      else if(rnd()<lk*1.1){
        if(p._pl.value&&G.street>0){ms*=1.7+rnd()*.6;p._pl.tank=true;}
        else if(a.type==='call'&&d.draw){ms*=.4;p._pl.snap=true;}
        else if(a.type==='check'&&d.rel<.8)ms*=.55;
        else if(a.type==='fold')ms*=.6;
      }
      if((p.tilt||0)>.3)ms*=.7;
      anim(p,p._pl.tank?'chin':'think',{dur:ms/1000*spd()});
      return ms;
    },
    acted(p,f){
      if(G.v3)Sahne.attend(p.idx,f.type==='raise'?2:1.1,f.type==='raise'?.7:.35);
      const pl=p._pl||{},lk=leak(p),fk=fake(p),tp=f.type;
      Talk.event(p,f.allIn?'allin':f.type);if(f.allIn){Talk.react(p,'allin');if(G.v3)Sahne.cine(p.idx,2.8,34);}
      if(tp==='fold'){anim(p,'fold');return;}
      if(tp==='check'){anim(p,'check');return;}
      if(tp==='call'){const ok=anim(p,f.allIn?'bet':'call',{allin:f.allIn});if(pl.snap&&ok)note(p,'Neredeyse hiç düşünmeden gördü.','Hızlı görme: çoğunlukla çekiliş ya da orta güçte el. Çok güçlü olsa artırmayı düşünürdü.');return;}
      let value=pl.value,bluff=pl.bluff;
      if((value||bluff)&&rnd()<fk){const v=value;value=bluff;bluff=v;}
      let force='normal';
      if(bluff&&rnd()<lk*.6)force='hard';else if(value&&!pl.tank&&rnd()<lk*.4)force='soft';
      const ok=anim(p,'bet',{allin:f.allIn,force});
      if(ok){
        if(pl.tank)note(p,'Uzun uzun düşündü, elini çenesine götürdü; sonra bahsi yaptı.','Tiyatro: zayıf görünmeye çalışan güçlü el sık sık sahte tereddüt gösterir.');
        if(force==='hard')note(p,'Fişleri potun ortasına sertçe itti.','Güç gösterisi: abartılı özgüven çoğu zaman zayıflığı örter.');
        if(force==='soft')note(p,'Fişleri yavaşça, özenle ileri itti.','Sakin ve emin: güçlü ellerde bahis rahat ve yumuşak yapılır.');
      }
      // bahis hareketi bittikten sonra beden konuşur
      later(1500,()=>{
        if(p.folded)return;
        const x=rnd(),q=p.char.quirk;
        if(value){
          if(q==='tea'&&rnd()<lk*.8)tell(p,'drink',{prio:2},'Bahsi yapıp rahatça çayını yudumladı.','Rahatlık: endişesi yok, elinden emin.');
          else if(q==='tespih'&&rnd()<lk*.8)tell(p,'tespihStop',{dur:6},'Tespihi elinde hareketsiz kaldı.','Alışkanlıktan sapma: dikkat kesilmiş; güçlü el olabilir.');
          else if(x<lk*.5)tell(p,'tremble',{dur:2.8},'Fişleri bıraktıktan sonra eli hafifçe titriyordu.','Heyecan titremesi: gerilim boşalırken eller titrer; klasik güçlü el işaretidir. Blöf yapan genelde kaskatı durur.');
          else if(x<lk*.9)tell(p,rnd()<.5?'shrug':'lookAway',null,'Bahsi yaptıktan sonra omuz silkip başka yere baktı.','Zayıf rolü: güçlü el tutan, ilgisiz ya da kararsız görünmeye çalışır.');
          else if(x<lk*1.2)tell(p,'smirk',null,'Bahisten sonra dudağının kenarı hafifçe kıvrıldı.','Bastırılmış memnuniyet: güçlü elin sahibi gülümsemesini saklamaya çalışır.');
        }else if(bluff){
          if(q==='smoke'&&rnd()<lk*.8)tell(p,'smoke',{prio:2},'Sigarasından art arda derin nefes çekti.','Stres: bu el onu geriyor.');
          else if(q==='tespih'&&rnd()<lk*.8)tell(p,'tespihFast',{dur:6},'Tespihi hızlı hızlı çekmeye başladı.','Gerginlik: alışkanlığı hızlandı; zayıf el ya da blöf olabilir.');
          else if(x<lk*.65){if(anim(p,'stare',{dur:4})){anim(p,'freeze',{dur:4});note(p,'Bahsi yaptıktan sonra gözünü sana dikip kıpırdamadan oturdu.','Donma ve meydan okuma: blöf yapan nefesini tutar, hareketsizleşir ve rakibe dik dik bakar.');}}
          else if(x<lk*.85)tell(p,'cover',null,'Eliyle ağzını kapattı, bir süre öyle kaldı.','Ağzı kapatma: yalan söyleyenin bilinçsiz hareketi; blöf olabilir.');
          else if(x<lk*.95)tell(p,'gulp',null,'Bahsi yaptıktan sonra yutkundu.','Yutkunma: gerginliğin bedensel belirtisi; blöf ya da büyük bir risk olabilir.');
          else if(x<lk*1.05)later(600,()=>{if(!p.folded)tell(p,'neck',null,'Eliyle boynunu ovuşturdu.','Rahatlama hareketi: stres altında; zayıf el ya da blöf olabilir.');});
        }
      });
    },
    humanActed(f){
      if(f.type!=='raise')return;
      if(G.v3)Sahne.attend(0,2.4,.7);
      G.players.forEach(p=>{
        if(p.human||!canAct(p))return;
        const lk=leak(p),rel=p.rel==null?1:p.rel;
        later(700+rnd()*700,()=>{
          if(p.folded||G.turn===p.idx)return;
          if(rel>2&&rnd()<lk*.5)tell(p,'glanceChips',null,'Bahsine baktı, sonra gözü fişlerine gitti.','Karşılık vermeye hazır: güçlü el, artırabilir.');
          else if(rel<.6&&rnd()<lk*.5)tell(p,'sigh',null,'Bahsine bakıp derin bir iç çekti.','Hayal kırıklığı: bu bahis onu zorluyor, büyük ihtimalle çekilecek.');
        });
      });
    },
    showdown(){
      const BB=G.bb,sk=G.venue.skill,me=G.players[0];
      if(G.v3&&me.won>0)Sahne.attend(0,2.2,.5);
      G.players.forEach(p=>{
        if(p.human||!p.inHand)return;
        if(p.won>0){anim(p,'win',{big:p.won>=G.bb*20});if(G.v3&&p.won>=G.bb*25)later(500,()=>Sahne.cine(p.idx,3.4,30));later(1100+rnd()*700,()=>Talk.event(p,'win'));}
        else if(!p.folded){anim(p,'lose',{big:p.startChips-p.chips>=G.bb*20});later(1300+rnd()*700,()=>Talk.event(p,'lose'));}
        if(p.show&&!p.folded&&p.notes.length&&G.board.length===5){
          const li=document.createElement('li');li.className='sum';
          li.innerHTML=`<b>${p.name}</b> kartlarını açtı: ${ic(p.cards)} · ${describe(evalCards(p.cards.concat(G.board)))}`;
          $('#notes-list').appendChild(li);$('#notes-list').scrollTop=1e6;
        }
        const lost=p.startChips-p.chips;
        if(p.won===0&&lost>=Math.max(BB*30,p.startChips*.4)){
          const w=p.char.wealth==null?.5:p.char.wealth;
          p.tilt=clamp((p.tilt||0)+.6*(1-sk*.7)*(1.25-w*.5),0,1);
          if(p.tilt>.35&&!p.out)later(2600,()=>{const ex=(p.char.expr||1)>1;tell(p,ex?'rage':'sigh',null,ex?'Kaybettiği büyük pottan sonra masaya vurdu.':'Büyük potu kaybettikten sonra derin bir nefes alıp gözlerini kapadı.','Tilt: bir süre duygusal, daha gevşek ve saldırgan oynayabilir.');});
        }
      });
    },
  };
})();

/* ---------- El sonu ---------- */
function buildPots(){
  const g=G;
  const levels=[...new Set(live().map(p=>p.total))].sort((a,b)=>a-b);
  const pots=[];let prev=0;
  for(const Lv of levels){
    let amt=0;for(const p of g.players)amt+=Math.max(0,Math.min(p.total,Lv)-prev);
    const elig=live().filter(p=>p.total>=Lv);
    if(amt>0)pots.push({amt,elig});
    prev=Lv;
  }
  let left=0;for(const p of g.players)left+=Math.max(0,p.total-prev);
  if(left>0&&pots.length)pots[pots.length-1].amt+=left;
  return pots;
}
async function finishHand(tok){
  const g=G,me=g.players[0];
  g.turn=-1;
  const lv=live();const pots=buildPots();
  const lines=[];
  if(lv.length===1){
    const w=lv[0];const amt=pots.reduce((s,x)=>s+x.amt,0);
    w.chips+=amt;w.won=amt;
    lines.push({names:[w.name],me:w.human,amt,desc:'herkes çekildi'});
    addLog(`${w.human?'Sen':w.name} potu aldı: ${money(amt)} (rakipler çekildi)`,'win');
    narrate(w.human?`<b>Pot senin.</b> Herkes çekildi; kartlarını göstermek zorunda değilsin.`:`<b>${w.name}</b> potu aldı; kalan herkes çekildi. Kartlar açılmadı.`);
  }else{
    const fresh=lv.some(p=>!p.show&&!p.human);
    lv.forEach(p=>{p.show=true;p.lastAct='';p.score=evalCards(p.cards.concat(g.board));});
    render();if(fresh)SFX.play('flip');await wait(tok,450);
    pots.forEach((pot,k)=>{
      const el=pot.elig;
      if(el.length===1){
        const w=el[0];w.chips+=pot.amt;
        lines.push({names:[w.name],me:w.human,amt:pot.amt,desc:'karşılıksız bahis iadesi',refund:true});
        return;
      }
      const best=Math.max(...el.map(p=>p.score));
      const ws=el.filter(p=>p.score===best);
      const dist=p=>(p.idx-g.dealer+g.players.length)%g.players.length;
      ws.sort((a,b)=>dist(a)-dist(b));
      const share=Math.floor(pot.amt/ws.length);let rem=pot.amt-share*ws.length;
      ws.forEach(w=>{const a=share+(rem>0?1:0);if(rem>0)rem--;w.chips+=a;w.won+=a;});
      lines.push({names:ws.map(w=>w.human?'Sen':w.name),me:ws.some(w=>w.human),amt:pot.amt,desc:describe(best),side:k>0,split:ws.length>1});
      if(k===0)g.winSet=new Set(best5(ws[0].cards.concat(g.board)));
    });
    lv.forEach(p=>addLog(`${p.human?'Sen':p.name}: ${p.cards.map(ctxt).join(' ')} · ${describe(p.score)}`));
    lines.filter(l=>!l.refund).forEach(l=>addLog(`${l.names.join(' ve ')} ${l.side?'yan potu':'potu'} aldı: ${money(l.amt)} · ${l.desc}`,'win'));
    const main=lines.find(l=>!l.refund);
    if(main)narrate(`<b>Showdown.</b> Kartlar açıldı. ${main.names.join(' ve ')} ${main.split?'potu bölüştü':'kazandı'}: <b>${main.desc}</b>. Parlayan beş kart kazanan eli oluşturuyor.`);
  }
  g.phase='done';
  SFX.play(me.won>0?'win':'pot');
  const st=SAVE.stats;st.hands++;
  if(me.won>0){st.won++;const lv2=g.venue.lvl,bl=st.bestLvl||0;if(lv2>0&&!g.venue.training&&(lv2>bl||(lv2===bl&&me.won>st.best))){st.best=me.won;st.bestCur=g.venue.cur;st.bestLvl=lv2;}}
  persist();
  {const inH=me.inHand&&!me.folded;const cat=inH&&g.board.length>=3?catOf(evalCards(me.cards.concat(g.board))):null;
   if(me.won>0)g.streak=(g.streak||0)+1;else if(me.chips<me.startChips)g.streak=0;
   Ach.hand({me,g,showdown:lv.length>1&&inH,cat,won:me.won});}
  render();
  const shown=lines.filter(l=>!l.refund);
  $('#banner').innerHTML=shown.map(l=>`<div>${l.side?'<span class="muted">Yan pot · </span>':''}<b class="${l.me?'me-win':''}">${l.me&&l.names.length===1?'Kazandın!':l.names.join(' ve ')+(l.split?' bölüştü':' kazandı')}</b> ${money(l.amt)}<br><span class="muted">${l.desc}</span></div>`).join('');
  $('#banner').hidden=!shown.length;
  Tells.showdown();
  Talk.afterShowdown();
}

/* ---------- Eylem çubuğu ---------- */
function setActions(state,p){
  const g=G;
  $('#a-human').hidden=state!=='human';
  $('#a-next').hidden=state!=='done';
  const st=$('#a-status');
  if(state==='wait'){
    const me=g.players[0];
    st.innerHTML=(me.folded&&me.inHand)?`Bu eli bıraktın. <b>${p?p.name:''}</b> düşünüyor…`:`Sıra: <b>${p?p.name:''}</b>`;
  }else if(state==='done'){
    st.innerHTML=`El #${g.handNo} bitti. Fişin: <b>${money(g.players[0].chips)}</b>`;
    setTimeout(()=>{if(!$('#a-next').hidden)$('#a-next').focus({preventScroll:true});},50);
  }else if(state==='human'){
    const L=legal(p);g.L=L;
    const pot=potTotal();
    st.innerHTML=L.toCall>0?`Görmen gereken <b>${money(L.toCall)}</b> · Pot <b>${money(pot)}</b>`:`Sıra sende · Pot <b>${money(pot)}</b>`;
    $('#a-call').innerHTML=(L.toCall===0?'Kontrol':(L.toCall>=p.chips?`All-in ${money(L.toCall)}`:`Gör ${money(L.toCall)}`))+' <kbd>C</kbd>';
    const amt=$('#a-amt');
    $('#a-raise-box').hidden=!L.canRaise;$('#a-raise').disabled=!L.canRaise;
    if(L.canRaise){
      amt.min=L.minTo;amt.max=L.maxTo;amt.step=g.unit;
      const def=g.street===0?(g.curBet<=g.bb?g.bb*3:g.curBet*3):g.curBet+(pot+L.toCall)*0.6;
      amt.value=snap(def,L);
      updateRaiseLabel();
    }else $('#a-raise').innerHTML='Artır <kbd>R</kbd>';
    setTimeout(()=>{if(!$('#a-human').hidden)$('#a-call').focus({preventScroll:true});},30);
  }
}
function snap(v,L){v=Math.round(v/G.unit)*G.unit;return clamp(v,L.minTo,L.maxTo);}
function updateRaiseLabel(){
  const g=G,L=g.L,v=+$('#a-amt').value;
  $('#a-amt-out').textContent=money(v);
  const verb=v>=L.maxTo?'All-in':(g.curBet===0?'Bahis':'Artır');
  $('#a-raise').innerHTML=`${verb} ${money(v)} <kbd>R</kbd>`;
}
$('#a-amt').addEventListener('input',updateRaiseLabel);
$('#presets').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!G||!G.L)return;
  const L=G.L,pot=potTotal(),base=pot+L.toCall;
  const v={min:L.minTo,half:G.curBet+base*0.5,tq:G.curBet+base*0.75,pot:G.curBet+base,all:L.maxTo}[b.dataset.p];
  $('#a-amt').value=snap(v,L);updateRaiseLabel();
});
function humanAct(type){
  if(!G||!G.resolve)return;
  const p=G.players[0],L=G.L;
  if(type==='fold'&&L.toCall===0&&G.venue.training)narrate('<b>Not:</b> Önünde bahis yokken çekildin. Kontrol bedavaydı; bir dahaki sefere kontrol ederek kartları görmeye devam edebilirsin.');
  if(type==='call')G.resolve(L.toCall===0?{type:'check'}:{type:'call'});
  else if(type==='fold')G.resolve({type:'fold'});
  else if(type==='raise'&&L.canRaise)G.resolve({type:'raise',to:+$('#a-amt').value});
}
$('#a-fold').onclick=()=>humanAct('fold');
$('#a-call').onclick=()=>humanAct('call');
$('#a-raise').onclick=()=>humanAct('raise');
$('#a-next').onclick=()=>{if(G&&G.nextResolve)G.nextResolve();};
document.addEventListener('keydown',e=>{
  if(CUR!=='scr-game'||!$('#modal').hidden||e.ctrlKey||e.metaKey||e.altKey)return;
  const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'&&e.target.type!=='range')return;
  const k=e.key.toLowerCase();
  if(G&&G.resolve&&/^[1-5]$/.test(k)&&G.L&&G.L.canRaise){const pb=$$('#presets button')[+k-1];if(pb)pb.click();e.preventDefault();return;}
  if(G&&G.resolve){if(k==='f'){humanAct('fold');e.preventDefault();}else if(k==='c'){humanAct('call');e.preventDefault();}else if(k==='r'){humanAct('raise');e.preventDefault();}}
  else if(G&&G.nextResolve&&(k==='enter'||k===' ')){if(tag==='button'&&e.target.id!=='a-next')return;e.preventDefault();G.nextResolve();}
});

/* ---------- Koç ---------- */
function coachIdle(){return `<p class="muted">Sıra sana geldiğinde kazanma şansını, pot oranını ve bir öneri burada göreceksin.</p>`;}
$('#coach-toggle').onchange=e=>{
  const on=e.target.checked;$('#coach-state').textContent=on?'Açık':'Kapalı';
  if(!on){$('#coach-body').innerHTML='<p class="muted">Koç kapalı. Kendi kararlarını ver; istediğinde yeniden aç.</p>';}
  else if(G&&G.resolve)coachUpdate(G.players[0]);else $('#coach-body').innerHTML=coachIdle();
};
function coachUpdate(p){
  if(!G.venue.training||!$('#coach-toggle').checked)return;
  $('#coach-body').innerHTML='<p class="muted">Hesaplanıyor…</p>';
  setTimeout(()=>{if(!G||!G.resolve)return;$('#coach-body').innerHTML=coachHTML(p);},40);
}
function coachHTML(p){
  const g=G,L=g.L;
  const opps=g.players.filter(q=>q!==p&&q.inHand&&!q.folded).length;
  const eq=equity(p.cards,g.board,opps,1500);
  const pot=potTotal();
  const po=L.toCall>0?L.toCall/(pot+L.toCall):0;
  const hand=g.board.length?describe(evalCards(p.cards.concat(g.board))):preflopName(p.cards);
  const sub=g.board.length?'':`Başlangıç sınıfı: ${TIER_NAME[handTier(p.cards)]} (${handKey(p.cards)})`;
  const outs=(g.board.length===3||g.board.length===4)?countOuts(p.cards,g.board):null;
  const [v,label,why]=advise(p,eq,po,L,opps,outs);
  return `<div class="c-hand">${hand}${sub?`<small>${sub}</small>`:''}</div>
  <div class="meter">
    <div class="mbar" role="img" aria-label="Kazanma şansı ${pct(eq)}, gereken ${pct(po)}"><i class="${L.toCall>0&&eq<po?'low':''}" style="width:${Math.round(eq*100)}%"></i>${L.toCall>0?`<em style="left:${Math.round(po*100)}%"></em>`:''}</div>
    <div class="mleg"><span>Kazanma şansı <b>${pct(eq)}</b></span>${L.toCall>0?`<span>Görmek için gereken <b>${pct(po)}</b></span>`:'<span>Bedava kart</span>'}</div>
  </div>
  <dl class="facts">
    <dt>Pot</dt><dd>${money(pot)}</dd>
    <dt>Görmen gereken</dt><dd>${L.toCall?money(L.toCall):'—'}</dd>
    <dt>Rakip</dt><dd>${opps}</dd>
    ${outs?`<dt>Out</dt><dd>${outs.n}${outs.draw?' · '+outs.draw:''}</dd>`:''}
    <dt>Pozisyon</dt><dd>${posName(p)}</dd>
  </dl>
  <div class="tip v-${v}"><span>Önerim</span><b>${label}</b><p>${why}</p></div>
  <p class="note">Şans, rakiplerin rastgele kart tuttuğu varsayılarak 1.500 simülasyonla hesaplanır. Sert bahis yapan bir rakibin eli genelde ortalamadan güçlüdür.</p>`;
}
function advise(p,eq,po,L,opps,outs){
  const g=G,BB=g.bb,rel=eq*(opps+1);
  if(g.street===0){
    const t=handTier(p.cards),tn=TIER_NAME[t],late=isLate(p),raised=g.curBet>BB;
    if(t===1)return L.canRaise?['raise','Artır',`${tn} el. ${raised?'Önündeki artışı yeniden artır (3-bet).':'Büyük körün üç katı kadar artır.'} Bu ellerle potu büyütmek istersin.`]:['call','Gör',`${tn} el; artırma imkânın yok, görerek devam et.`];
    if(t===2)return raised?['call','Gör',`${tn} el. Bir artışa karşı görmek mantıklı; çok büyük bir artış ya da all-in karşısında dikkatli ol.`]:(L.canRaise?['raise','Artır',`${tn} el. Pot henüz açılmadı; artırarak gir.`]:['call','Gör',`${tn} el.`]);
    if(t===3){
      if(L.toCall===0)return ['check','Kontrol','Büyük kördesin ve kimse artırmadı. Bedava flop gör.'];
      if(raised)return L.toCall<=3*BB?['call','Gör',`${tn} el. Küçük bir artışı görebilirsin; büyüğüne karşı bırakmak daha güvenli.`]:['fold','Çekil',`${tn} bir el ama bu artış büyük. Daha güçlü ellere karşı zor durumda kalırsın.`];
      return late&&L.canRaise?['raise','Artır',`${tn} el ve geç pozisyondasın. Artırarak körleri almaya çalış.`]:['call','Gör',`${tn} el. Erken pozisyonda dikkatli ol; ucuza flop gör.`];
    }
    if(t===4){
      if(L.toCall===0)return ['check','Kontrol','Bedava flop gör.'];
      if(!raised&&(late||L.toCall<=BB))return ['call','Ucuza gör',`${tn} el. Flop'ta güçlü bir şey yakalarsan büyük pot kazanabilirsin; pahalılaşırsa bırak.`];
      return ['fold','Çekil',`${tn} el; bir artışa karşı oynamak için zayıf.`];
    }
    return L.toCall===0?['check','Kontrol','Zayıf bir el ama kontrol bedava.']:['fold','Çekil','Zayıf başlangıç eli. Para koymaya değmez; daha iyi bir el bekle.'];
  }
  if(L.toCall===0){
    if(rel>=1.5&&L.canRaise)return ['bet','Bahis yap',`Şansın (${pct(eq)}), ${opps} rakibe göre ortalamanın üstünde. Potun yarısı ile dörtte üçü arası bir bahisle değer al.`];
    if(outs&&outs.n>=8&&g.street<3&&L.canRaise)return ['bet','Yarı-blöf ya da kontrol',`${outs.n} out ile güçlü bir çekilişin var. Bahis yaparsan rakip çekilebilir; görülürsen de elini tamamlama şansın sürer.`];
    return ['check','Kontrol','Önünde bahis yok. Para koymadan bir sonraki kartı görebilirsin.'];
  }
  if(eq>=po){
    if(rel>=1.9&&L.canRaise)return ['raise','Artır',`Şansın (${pct(eq)}) gereken orandan (${pct(po)}) çok yüksek. Potu büyüt.`];
    return ['call','Gör',`Görmek için ${pct(po)} şans yeterli, seninki ${pct(eq)}. Uzun vadede kârlı bir karar.`];
  }
  if(g.street<3&&eq+0.06>=po)return ['call','Sınırda: ucuzsa gör',`Şansın (${pct(eq)}) gerekenden (${pct(po)}) biraz düşük. Elini tamamladığında daha fazla kazanacaksan görmek kabul edilebilir.`];
  return ['fold','Çekil',`Görmek için ${pct(po)} şans gerekiyor, seninki ${pct(eq)}. Bu bahsi görmek uzun vadede kaybettirir.`];
}

/* ---------- Bitiş pencereleri ---------- */
function endModal(kind){
  const g=G,V=g.venue,me=g.players[0];
  $('#modal').dataset.lock='1';
  const got=cashOut();
  const purse=g.paid?` Cüzdanında artık <b>${tl(SAVE.cash)}</b> var.`:'';
  // Sonraki/yeniden oturma düğmesi: giriş ücreti yetmiyorsa ne kadar eksik olduğu yazılır.
  const seat=(v,id,label)=>canAfford(v)?`<button class="btn" id="${id}">${label}${g.paid?` · ${tl(entryTL(v))}`:''}</button>`:`<span class="muted" style="font-size:13px">${v.name} için ${tl(entryTL(v)-SAVE.cash)} daha lazım</span>`;
  if(kind==='win'){
    if(!SAVE.conquered.includes(V.id))SAVE.conquered.push(V.id);
    SAVE.unlocked=Math.max(SAVE.unlocked,V.lvl+1);
    const r0=repLvl(V);if(g.paid)SAVE.rep[V.id]=repWins(V)+1;const r1=repLvl(V);
    persist();
    Ach.unlock('v-'+V.id);if(VENUES.every(v=>SAVE.conquered.includes(v.id)))Ach.unlock('vegas-yolu');
    const nx=VENUES[V.lvl];
    const fame=r1>r0?`<p>Bu masada adın duyuldu: artık <b>${REP[r1].t}</b> olarak biliniyorsun. ${REP[r1].d}</p>`:'';
    openModal(`<span class="kicker">Seviye ${V.lvl} tamamlandı</span><h3>${nx?'Masayı fethettin':'Vegas senin'}</h3>
      <p>${V.tourney?`Turnuvayı kazandın: bütün rakipler elendi, ${money(me.chips)} fişle ayakta kaldın.`:`${money(me.chips)} ile masadan kalktın.`} ${g.handNo} el sürdü.${g.paid?` Fişler bozduruldu: ${tl(got)}.`:''}${purse}</p>
      ${fame}
      <p>${nx?`Sıradaki masa: <b>${nx.name}</b> (${nx.place}). Körler ${fmtM(nx.sb,nx.cur)}/${fmtM(nx.bb,nx.cur)}, rakipler daha akıllı.`:'Tarlabaşı\'ndaki bodrum katından Las Vegas\'ın tepesindeki milyon dolarlık süite kadar geldin. Yolun sonu burası.'}</p>
      <div class="row"><button class="btn ghost" id="m-career">${g.fromHall?'Salona dön':'Kariyere dön'}</button>${nx?(g.fromHall?`<button class="btn" id="m-next">${nx.name} salonuna git</button>`:seat(nx,'m-next',`${nx.name} masasına geç`)):''}</div>`);
    if($('#m-next'))$('#m-next').onclick=()=>{delete $('#modal').dataset.lock;if(g.fromHall)enterHall(nx);else startGame(nx);};
  }else{
    openModal(`<span class="kicker">${V.name}</span><h3>Fişlerin bitti</h3>
      <p>${g.handNo}. elde masadaki son fişini kaybettin.${g.paid?' Giriş ücreti gitti.':''}${purse} ${V.training?'Antrenmanda fiş sınırsız; yeniden otur ve devam et.':'Eğitim bölümündeki pozisyon ve pot oranı dersleri yardımcı olabilir.'}</p>
      <div class="row"><button class="btn ghost" id="m-career">${V.training?'Eğitime dön':g.fromHall?'Salona dön':'Kariyere dön'}</button>${V.training?'<button class="btn" id="m-again">Yeniden otur</button>':seat(V,'m-again','Yeniden otur')}</div>`);
    if($('#m-again'))$('#m-again').onclick=()=>{delete $('#modal').dataset.lock;startGame(V,{fromHall:g.fromHall});};
  }
  $('#m-career').onclick=()=>{delete $('#modal').dataset.lock;leaveGame();};
}
function leaveGame(){
  const tr=G&&G.venue.training,back=G&&G.fromHall&&!tr?G.venue:null;
  if(G){const amt=cashOut(),g=G;if(g.paid&&amt>0)toast('Fişler bozduruldu',`${tl(amt)} cüzdanına geçti. Cüzdan: ${tl(SAVE.cash)}`,'info');G.tok=null;G.reject&&G.reject(ABORT);}
  G=null;closeModal();
  if(back&&USE3D()){enterHall(back,true);return;}
  Sahne.stop();SFX.ambient(null);
  if(tr){show('scr-learn');openLesson('antrenman');}else show('scr-career');
}
$('#g-leave').onclick=()=>{
  if(!G)return;
  const V=G.venue,me=G.players[0];
  const open=V.tourney&&!G.players.every(p=>p.human||p.out),onTable=me.bet>0?' Ortadaki bahsin masada kalır.':'';
  const msg=V.training?'Antrenman masasından kalkıp eğitime dönersin.'
    :!G.paid?'Serbest moddasın; fişler cüzdana geçmez. Masayı fethetmek için hedefe ulaşman gerekir.'
    :open?`Turnuvadan çekilirsen giriş ücreti yanar, hiçbir şey alamazsın.`
    :`Önündeki ${money(me.chips)}${V.cur!=='₺'?` (≈ ${tl(toTL(me.chips,V.cur))})`:''} nakde dönüp cüzdanına geçer.${onTable} Masayı fethetmek için hedefe ulaşman gerekir.`;
  openModal(`<h3>Masadan kalk?</h3><p>${msg}</p>
    <div class="row"><button class="btn ghost" id="m-stay">Oynamaya devam</button><button class="btn" id="m-leave">Kalk</button></div>`);
  $('#m-stay').onclick=closeModal;$('#m-leave').onclick=leaveGame;
};

/* ================= EĞİTİM ================= */
const LESSONS=[
  {id:'temel',g:'Dersler',t:"Texas Hold'em nedir?",r:L_basics},
  {id:'eller',g:'Dersler',t:'El sıralaması',r:L_hands},
  {id:'akis',g:'Dersler',t:'Bir elin akışı',r:L_flow},
  {id:'hamle',g:'Dersler',t:'Hamleler',r:L_actions},
  {id:'baslangic',g:'Dersler',t:'Başlangıç elleri',r:L_start},
  {id:'pozisyon',g:'Dersler',t:'Pozisyon',r:L_position},
  {id:'olasilik',g:'Dersler',t:'Olasılık ve pot oranı',r:L_odds},
  {id:'blof',g:'Dersler',t:'Blöf ve rakip okuma',r:L_bluff},
  {id:'tell',g:'Dersler',t:'Beden dili (tell)',r:L_tells},
  {id:'quiz1',g:'Alıştırmalar',t:'Hangi el kazanır?',r:Q_winner},
  {id:'quiz2',g:'Alıştırmalar',t:'Bu el ne?',r:Q_name},
  {id:'antrenman',g:'Alıştırmalar',t:'Antrenman masası',r:L_training},
];
let LES='temel';
function renderNav(){
  let g='',h='';
  LESSONS.forEach((l,i)=>{
    if(l.g!==g){g=l.g;h+=`<div class="grp">${g}</div>`;}
    const seen=SAVE.seen.includes(l.id);
    const n=l.g==='Dersler'?String(i+1):'•';
    h+=`<button class="${seen?'seen':''}" data-l="${l.id}" aria-current="${l.id===LES}"><span class="ln">${seen?'✓':n}</span><span>${l.t}</span></button>`;
  });
  $('#lnav').innerHTML=h;
  $$('#lnav [data-l]').forEach(b=>b.onclick=()=>openLesson(b.dataset.l));
  $('#learn-sum').textContent=`${LESSONS.filter(l=>SAVE.seen.includes(l.id)).length}/${LESSONS.length} tamamlandı`;
}
function openLesson(id){
  LES=id;
  if(!SAVE.seen.includes(id)){SAVE.seen.push(id);persist();}
  if(LESSONS.filter(x=>x.g==='Dersler').every(x=>SAVE.seen.includes(x.id)))Ach.unlock('egitim');
  const i=LESSONS.findIndex(l=>l.id===id),l=LESSONS[i];
  const prev=LESSONS[i-1],next=LESSONS[i+1];
  const kick=l.g==='Dersler'?`Ders ${i+1}`:'Alıştırma';
  $('#lesson').innerHTML=`<p class="kicker">${kick}</p><h2>${l.t}</h2>${l.r()}<div class="les-nav">${prev?`<button class="btn ghost small" data-l2="${prev.id}">← ${prev.t}</button>`:'<span></span>'}${next?`<button class="btn small" data-l2="${next.id}">Sonraki: ${next.t} →</button>`:''}</div>`;
  $$('#lesson [data-l2]').forEach(b=>b.onclick=()=>{openLesson(b.dataset.l2);$('#lesson').scrollIntoView({behavior:'smooth',block:'start'});});
  renderNav();
  if(l.init)l.init();
  const a=$('.lnav [aria-current="true"]');if(a&&a.scrollIntoView&&innerWidth<820)a.scrollIntoView({inline:'center',block:'nearest'});
}
function markCards(list,set){return list.map(c=>cardHTML(c,set?(set.has(c)?'win':'dim'):'')).join('');}
function handDemo(hole,board){
  const H=pcs(hole),Bd=pcs(board),all=H.concat(Bd),sc=evalCards(all),b5=new Set(best5(all));
  return `<div class="demo"><div><span class="lbl">Senin kartların</span><div class="cards">${markCards(H,b5)}</div></div><div><span class="lbl">Masa</span><div class="cards">${markCards(Bd,b5)}</div></div><div class="demo-res"><span class="lbl">En iyi beş kart</span><b>${describe(sc)}</b></div></div>`;
}

function L_basics(){
  return `<p class="lead">Dünyada en çok oynanan poker türü. Kuralları beş dakikada öğrenilir; iyi oynamak için olasılık, sabır ve biraz da cesaret gerekir.</p>
  ${handDemo('Kh Kc','Kd 7s 7c 2h 9d')}
  <p class="cap">Elindeki iki Papaz, masadaki Papaz ve iki Yedi ile birleşiyor: Ful. Parlayan kartlar elini oluşturan beş kart.</p>
  <h3>Temel kurallar</h3>
  <ul>
    <li><b>İki kapalı kart.</b> Her oyuncuya iki kart dağıtılır. Bunlar senin el kartların; yalnızca sen görürsün.</li>
    <li><b>Beş ortak kart.</b> Masanın ortasına aşama aşama beş kart açılır: önce üç, sonra bir, sonra bir. Herkes bu kartları kullanır.</li>
    <li><b>En iyi beşli.</b> Yedi kartın içinden en güçlü beş kartlık eli seçersin. El kartlarının ikisini, birini ya da hiçbirini kullanabilirsin.</li>
    <li><b>Bahis turları.</b> Kartlar açılırken dört kez bahis yapılır. Ortada biriken fişlerin adı <b>pot</b>.</li>
    <li><b>Potu kazanmanın iki yolu var.</b> Sonda kartlar açıldığında en iyi ele sahip olmak ya da bahislerinle herkesi elden çekilmeye zorlamak.</li>
  </ul>
  <div class="callout"><b>No-Limit ne demek?</b> Bu oyunda bahsin üst sınırı yoktur. Sıra sendeyken istediğin an bütün fişlerini ortaya sürebilirsin; buna <b>all-in</b> denir.</div>`;
}

const RANKING=[
  [9,'As Ks Qs Js Ts','Aynı renkten 10, Vale, Kız, Papaz ve As. Pokerin en güçlü eli.','0,003'],
  [8,'9h 8h 7h 6h 5h','Aynı renkten beş ardışık kart.','0,03'],
  [7,'Qc Qd Qh Qs 5d','Aynı değerde dört kart. Beşinci kart eşitliği bozar.','0,17'],
  [6,'Js Jh Jd 4c 4s','Bir üçlü ile bir per bir arada. Eşitlikte önce üçlüye bakılır.','2,6'],
  [5,'Ad Jd 8d 6d 2d','Aynı renkten beş kart; sıralı olması gerekmez.','3,0'],
  [4,'8c 7d 6s 5h 4c','Beş ardışık kart, renkler karışık. As hem en üstte (10-J-Q-K-A) hem en altta (A-2-3-4-5) kullanılabilir.','4,6'],
  [3,'7s 7h 7d Kc 2s','Aynı değerde üç kart. Cebindeki per masadaki kartla üçlü olursa buna "set" denir.','4,8'],
  [2,'Ac Ad 9s 9h 6c','İki ayrı per. Önce büyük per, sonra küçük per, sonra beşinci kart karşılaştırılır.','23,5'],
  [1,'Th Tc Ks 6d 3c','Aynı değerde iki kart.','43,8'],
  [0,'As Jd 8c 5h 3s','Hiçbir kombinasyon yoksa en yüksek kart konuşur.','17,4'],
];
function L_hands(){
  const rows=RANKING.map(([cat,cs,d,p],i)=>{
    const list=pcs(cs);const cnt={};list.forEach(c=>cnt[c>>2]=(cnt[c>>2]||0)+1);
    const hl=c=>([1,2,3,7].includes(cat)?cnt[c>>2]>=2:cat===0?(c===list[0]):true);
    return `<li class="rk"><span class="rk-n">${i+1}</span><div class="rk-name"><b>${CAT[cat]}</b><span>${CAT_EN[cat]}</span></div><div class="cards">${list.map(c=>cardHTML(c,hl(c)?'':'dim')).join('')}</div><p>${d}</p><span class="rk-p">%${p}<small>7 kartla</small></span></li>`;
  }).join('');
  return `<p class="lead">Güçlüden zayıfa on el. Bir el ne kadar nadirse o kadar güçlüdür. Sağdaki oran, yedi karttan o eli yapma olasılığı.</p>
  <ol class="rank-list">${rows}</ol>
  <h3>Eşitlik nasıl bozulur?</h3>
  <p>İki oyuncu aynı türde ele sahipse daha yüksek kartlar kazanır. Eldeki türü oluşturmayan kartlara <b>kicker</b> (yan kart) denir ve eşitliği onlar bozar.</p>
  ${compareDemo('As Kd','Ah 9c','Ad 7s 4c 8h 2d')}
  <ul><li>Renkler arasında üstünlük yoktur: ${ic('As')} ile ${ic('Ah')} eşittir.</li><li>En iyi beş kart tamamen aynıysa pot bölüşülür. Örneğin masada kent varsa ve kimse daha iyisini yapamazsa herkes aynı eli oynar.</li></ul>`;
}
function compareDemo(a,b,board){
  const A=pcs(a),Bh=pcs(b),Bd=pcs(board);const sa=evalCards(A.concat(Bd)),sb=evalCards(Bh.concat(Bd));
  const w=sa>sb?'A':sb>sa?'B':'=';
  const set=new Set(best5((w==='B'?Bh:A).concat(Bd)));
  return `<div class="demo"><div><span class="lbl">Oyuncu A${w==='A'?' · kazanır':''}</span><div class="cards">${markCards(A,w==='A'?set:null)}</div><span class="cap">${describe(sa)}, ${RTR[decode(sa).r[1]]} kicker</span></div><div><span class="lbl">Oyuncu B${w==='B'?' · kazanır':''}</span><div class="cards">${markCards(Bh,w==='B'?set:null)}</div><span class="cap">${describe(sb)}, ${RTR[decode(sb).r[1]]} kicker</span></div><div><span class="lbl">Masa</span><div class="cards">${markCards(Bd,set)}</div></div></div>
  <p class="cap">İki oyuncu da As per yaptı. Per eşit olduğu için yan kartlara bakılır: A'nın papazı, B'nin dokuzundan yüksek. Pot A'nın.</p>`;
}

const FLOW=[
  {k:'Körler',d:`Beyaz <b>D</b> pulu dealer butonudur ve her elde bir sola kayar. Butonun solundaki oyuncu <b>küçük kör</b> (₺100), onun solundaki <b>büyük kör</b> (₺200) koymak zorundadır. Körler sayesinde her elde potta kazanılacak bir şey olur.`,board:0,hole:false,pot:300,seats:[['Sen'],['Rıza','D'],['Hüsnü','SB','₺100'],['Hasan','BB','₺200']]},
  {k:'Dağıtım',d:`Herkese iki kapalı kart dağıtılır. Sana ${ic('Ah Qh')} geldi: aynı renkten As-Kız, güçlü bir başlangıç eli.`,board:0,hole:true,pot:300,seats:[['Sen'],['Rıza','D'],['Hüsnü','SB','₺100'],['Hasan','BB','₺200']]},
  {k:'Pre-flop',d:`İlk bahis turu. Büyük körün solundaki oyuncu ilk konuşur; burada bu sensin. ₺600'e artırıyorsun. Rıza ve Hüsnü çekiliyor, Hasan ₺400 daha koyup görüyor.`,board:0,hole:true,pot:1300,seats:[['Sen','','Artır ₺600'],['Rıza','D','Çekil',1],['Hüsnü','SB','Çekil',1],['Hasan','BB','Gör']]},
  {k:'Flop',d:`Masaya üç ortak kart açılır: ${ic('Qc 8h 3h')}. Kızlardan per yaptın ve floşa bir kupa kaldı. Bu turdan itibaren dealer'ın solundaki ilk oyuncu başlar: Hasan kontrol ediyor, sen ₺800 bahis yapıyorsun, Hasan görüyor.`,board:3,hole:true,pot:2900,seats:[['Sen','','Bahis ₺800'],['Rıza','D','',1],['Hüsnü','SB','',1],['Hasan','BB','Gör']]},
  {k:'Turn',d:`Dördüncü kart ${ic('Ks')}. Hasan kontrol ediyor, sen de kontrol ediyorsun: bedavaya bir kart daha.`,board:4,hole:true,pot:2900,seats:[['Sen','','Kontrol'],['Rıza','D','',1],['Hüsnü','SB','',1],['Hasan','BB','Kontrol']]},
  {k:'River',d:`Beşinci ve son kart ${ic('5h')}: floşun tamamlandı. Hasan ₺1.200 bahis yapıyor, sen ₺3.600'e artırıyorsun, Hasan görüyor.`,board:5,hole:true,pot:10100,seats:[['Sen','','Artır ₺3.600'],['Rıza','D','',1],['Hüsnü','SB','',1],['Hasan','BB','Gör']]},
  {k:'Showdown',d:`Kartlar açılır. Hasan ${ic('Kd Qd')} gösteriyor: Döper (Papazlar ve Kızlar). Senin As yüksek floşun daha güçlü; ₺10.100'lük pot senin.`,board:5,hole:true,pot:10100,show:true,seats:[['Sen','','Kazandı'],['Rıza','D','',1],['Hüsnü','SB','',1],['Hasan','BB','Döper']]},
];
let flowStep=0;
function L_flow(){
  flowStep=0;
  setTimeout(drawFlow,0);
  return `<p class="lead">Her el aynı sırayla ilerler. Aşağıdaki örnek eli adım adım izle.</p><div class="flow" id="flow"></div>
  <div class="callout"><b>Heads-up kuralı</b> Masada yalnızca iki oyuncu kaldığında dealer küçük körü koyar ve pre-flop'ta ilk o konuşur; sonraki turlarda ise son konuşan odur.</div>`;
}
function drawFlow(){
  const el=$('#flow');if(!el)return;
  const s=FLOW[flowStep];
  const me=pcs('Ah Qh'),board=pcs('Qc 8h 3h Ks 5h'),hs=pcs('Kd Qd');
  const set=s.show?new Set(best5(me.concat(board))):null;
  let b='';for(let i=0;i<5;i++)b+=i<s.board?cardHTML(board[i],set?(set.has(board[i])?'win':'dim'):''):'<span class="slot"></span>';
  el.innerHTML=`<ol class="fsteps">${FLOW.map((f,i)=>`<li class="${i===flowStep?'on':i<flowStep?'past':''}" data-fs="${i}">${i+1}. ${f.k}</li>`).join('')}</ol>
   <div class="mini">
     <div class="mseats">${s.seats.map(([n,bd,a,f])=>`<span class="ms ${f?'f':''}">${bd?`<i>${bd}</i>`:''}<b>${n}</b>${a?`<em>${a}</em>`:''}</span>`).join('')}</div>
     <div class="mrow"><div><span class="lbl">Masa</span><div class="cards">${b}</div></div><div><span class="lbl">Pot</span><span class="mpot">₺${nf.format(s.pot)}</span></div></div>
     <div class="mrow"><div><span class="lbl">Senin kartların</span><div class="cards">${s.hole?markCards(me,set):cardHTML(null)+cardHTML(null)}</div></div>${s.show?`<div><span class="lbl">Hasan</span><div class="cards">${markCards(hs,set?new Set():null)}</div></div>`:''}</div>
   </div>
   <p>${s.d}</p>
   <div class="qbtns"><button class="btn ghost small" id="fl-prev" ${flowStep===0?'disabled':''}>← Geri</button><button class="btn small" id="fl-next" ${flowStep===FLOW.length-1?'disabled':''}>İleri →</button></div>`;
  $('#fl-prev').onclick=()=>{flowStep--;drawFlow();};
  $('#fl-next').onclick=()=>{flowStep++;drawFlow();SFX.play(FLOW[flowStep].board>FLOW[flowStep-1].board||FLOW[flowStep].show?'flip':'deal');};
  $$('[data-fs]',el).forEach(li=>li.onclick=()=>{flowStep=+li.dataset.fs;drawFlow();});
}

function L_actions(){
  return `<p class="lead">Sıra sana geldiğinde önündeki bahse göre birkaç seçeneğin olur.</p>
  <div class="acts">
    <div><span>Fold</span><b>Çekil</b><p>Kartlarını bırakırsın, bu eldeki şansın biter. Daha önce ortaya koyduğun fişler potta kalır.</p></div>
    <div><span>Check</span><b>Kontrol</b><p>Önünde bahis yoksa para koymadan sırayı geçersin. Önünde bahis varken kontrol edemezsin.</p></div>
    <div><span>Call</span><b>Gör</b><p>Masadaki en yüksek bahsi eşitlersin ve elde kalırsın.</p></div>
    <div><span>Bet / Raise</span><b>Bahis yap / Artır</b><p>Kimse bahis yapmadıysa bahsi sen açarsın; yapıldıysa yükseltirsin. Diğerleri görmek, çekilmek ya da tekrar artırmak zorunda kalır.</p></div>
    <div><span>All-in</span><b>Hepsi ortaya</b><p>Bütün fişlerini sürersin. Fişin yetmiyorsa yalnızca koyabildiğin kadarını kazanabilirsin; fazlası <b>yan pota</b> gider.</p></div>
  </div>
  <h3>En az ne kadar artırabilirim?</h3>
  <p>Bir artış, en az bir önceki artış kadar olmalıdır. Büyük kör ₺200 iken biri ₺600'e artırdıysa (artış ₺400), sonraki artış en az ₺1.000'e olmalıdır. Üst sınır yok: No-Limit'te bütün fişlerini sürebilirsin.</p>
  <h3>Yan pot nasıl oluşur?</h3>
  <p>₺2.000'i kalan Rıza all-in yapıyor, sen ve Hasan ₺6.000'er koyuyorsunuz. Ana pot ₺6.000'dir (üç kişiden ₺2.000'er) ve üçünüz de kazanabilirsiniz. Kalan ₺8.000 yan pottur ve yalnızca sen ile Hasan arasında oynanır.</p>
  <div class="callout"><b>Altın kural</b> Önünde bahis yokken asla çekilme. Kontrol bedavadır; bir sonraki kartı ücretsiz görürsün.</div>`;
}

function L_start(){
  setTimeout(()=>{
    const ch=$('#chart');if(!ch)return;
    let h='';
    for(let i=12;i>=0;i--)for(let j=12;j>=0;j--){
      let k;if(i===j)k=RCH[i]+RCH[j];else if(j<i)k=RCH[i]+RCH[j]+'s';else k=RCH[j]+RCH[i]+'o';
      const t=TIER[k]||5;h+=`<button class="t${t}" data-k="${k}" aria-pressed="false" aria-label="${k}, ${TIER_NAME[t]}">${k}</button>`;
    }
    ch.innerHTML=h;
    const pick=b=>{$$('#chart button').forEach(x=>x.setAttribute('aria-pressed',x===b));const k=b.dataset.k,t=TIER[k]||5;
      const combos=k.length===2?6:k[2]==='s'?4:12;
      const kind=k.length===2?'Per':k[2]==='s'?'Aynı renk (suited)':'Farklı renk (offsuit)';
      $('#chart-info').innerHTML=`<span class="lbl">${kind}</span><b style="font-size:22px">${k} · ${TIER_NAME[t]}</b><p>${TIER_ADV[t]}</p><p class="cap">Bu eli ${combos} farklı kombinasyonla alabilirsin; bir elde gelme olasılığı %${(combos/1326*100).toFixed(2).replace('.',',')}.</p>`;};
    $$('#chart button').forEach(b=>b.onclick=()=>pick(b));
    pick($('#chart [data-k="AKs"]'));
  },0);
  return `<p class="lead">Hangi iki kartla oyuna gireceğini seçmek, pokerde para kazanmanın ilk adımıdır. İyi oyuncular ellerin çoğunu çekilerek geçirir.</p>
  <p>Tabloda her hücre bir el. Köşegen perlerdir (AA, KK…). Köşegenin <b>üstü aynı renk</b> eller (s: suited), <b>altı farklı renk</b> eller (o: offsuit). Bir hücreye dokun.</p>
  <div class="chart-row"><div class="chart-wrap"><div class="chart" id="chart"></div></div><div class="chart-info" id="chart-info" style="flex:1 1 220px"></div></div>
  <div class="legend">${[1,2,3,4,5].map(t=>`<span><i class="t${t}"></i>${TIER_NAME[t]}</span>`).join('')}</div>
  <ul><li><b>Aynı renk</b> eller floş yapabildiği için farklı renk hallerinden biraz daha değerlidir.</li><li><b>Küçük perler</b> (22–66) çoğunlukla üçlü yakalamak için oynanır; flop'ta üçlü gelmezse bırakmaya hazır ol.</li><li>Tablodaki öneriler başlangıç noktasıdır. Pozisyon, rakiplerin ve fiş miktarları kararını değiştirir.</li></ul>`;
}

function L_position(){
  const P=[['UTG','Erken','%15','#e3655c'],['MP','Orta','%19','#e8ad3d'],['CO','Cutoff','%27','#cbbf5a'],['BTN','Buton','%45','#6fc28c'],['SB','Küçük kör','%35','#8f9bb0'],['BB','Büyük kör','savunma','#8f9bb0']];
  return `<p class="lead">Masada nerede oturduğun, elindeki kartlar kadar önemlidir. Son konuşan oyuncu, diğerlerinin ne yaptığını görüp karar verir.</p>
  <div class="pos">${P.map(([a,b,c,col])=>`<div style="--c:${col}"><b>${a}</b><span>${b}</span><em>${c}</em></div>`).join('')}</div>
  <p class="cap">Altı kişilik masada her pozisyondan yaklaşık olarak oynanabilecek ellerin oranı. Buton en geniş aralıkla oynar.</p>
  <h3>Neden geç pozisyon avantajlı?</h3>
  <ul>
    <li><b>Bilgi:</b> Senden önce konuşanların kontrol mü ettiğini, bahis mi yaptığını görürsün.</li>
    <li><b>Kontrol:</b> Potun büyüklüğünü sen belirlersin. Herkes kontrol ettiyse ucuz bir blöfle potu alabilirsin.</li>
    <li><b>Son söz:</b> Flop, turn ve river'da her turda son konuşan sensin.</li>
  </ul>
  <h3>Pratikte</h3>
  <ul>
    <li>Erken pozisyonda yalnızca güçlü ellerle gir; arkanda daha çok oyuncu var ve hepsi senden sonra karar verecek.</li>
    <li>Butonda ve cutoff'ta daha geniş oyna. Önündekiler çekildiyse artırarak körleri almaya çalış.</li>
    <li>Körler her elde zorunlu para koyar ve flop'tan sonra ilk onlar konuşur. Bu yüzden en dezavantajlı pozisyonlardır.</li>
  </ul>
  <div class="callout"><b>Oyunda</b> Koç panelinde her elde hangi pozisyonda olduğunu görebilirsin.</div>`;
}

function L_odds(){
  setTimeout(()=>{
    const f=()=>{
      const pot=Math.max(0,+$('#c-pot').value||0),call=Math.max(0,+$('#c-call').value||0),o=clamp(+$('#c-outs').value||0,0,20),st=$('#c-st').value;
      const po=call>0?call/(pot+call):0;
      const ex=st==='flop'?1-((47-o)/47)*((46-o)/46):o/46;
      const rule=Math.min(1,(st==='flop'?4:2)*o/100);
      $('#c-po').textContent=pct(po);$('#c-eq').textContent=pct(ex);$('#c-rule').textContent=pct(rule);
      const v=$('#c-v');
      if(call===0){v.className='verdict ok';v.textContent='Görmen gereken bir bahis yok: kontrol et ve bedava kart gör.';}
      else if(ex>=po){v.className='verdict ok';v.textContent=`Gör. Elini tamamlama şansın (${pct(ex)}), gereken orandan (${pct(po)}) yüksek.`;}
      else{v.className='verdict no';v.textContent=`Çekil. Şansın (${pct(ex)}), gereken orandan (${pct(po)}) düşük; bu bahis uzun vadede kaybettirir.`;}
    };
    $$('#calc input,#calc select').forEach(x=>x.oninput=f);f();
  },0);
  const row=(n,o)=>{const a=1-((47-o)/47)*((46-o)/46),b=o/46;return `<tr><td>${n}</td><td>${o}</td><td>${pct(a)}</td><td>${(b*100).toFixed(1).replace('.',',')}%</td></tr>`;};
  return `<p class="lead">Pokerde her karar bir hesaptır: kazanma şansın, ödemen gereken bedele değiyor mu?</p>
  <h3>Out nedir?</h3>
  <p>Elini kazanan ele çevirecek kartlara <b>out</b> denir. Elinde ${ic('Ah 9h')} ve masada ${ic('Kh 7h 2c')} varsa floşa bir kupa kaldı. Destede 13 kupa var; 4'ü görünüyor, demek ki <b>9 out</b>.</p>
  <h3>2 ve 4 kuralı</h3>
  <p>Kafadan hızlı hesap: flop'tayken out sayısını <b>4</b> ile, turn'deyken <b>2</b> ile çarp. 9 out flop'ta yaklaşık %36, turn'de yaklaşık %18 eder.</p>
  <h3>Pot oranı</h3>
  <p>Görmen gereken miktarın, görmen sonrası toplam pota oranıdır: <b>görmen gereken ÷ (pot + görmen gereken)</b>. Pot ₺2.000 iken rakip ₺1.000 bahis yaptıysa ₺1.000 ödeyip ₺4.000'lik potu kazanmaya çalışırsın: ₺1.000 ÷ ₺4.000 = %25. Kazanma şansın %25'ten yüksekse görmek kârlıdır.</p>
  <div class="calc" id="calc">
    <div class="calc-in">
      <label for="c-pot">Pot (bahis dahil)<input id="c-pot" type="number" min="0" value="3000"></label>
      <label for="c-call">Görmen gereken<input id="c-call" type="number" min="0" value="1000"></label>
      <label for="c-outs">Out sayısı<input id="c-outs" type="number" min="0" max="20" value="9"></label>
      <label for="c-st">Aşama<select id="c-st"><option value="flop">Flop (2 kart var)</option><option value="turn">Turn (1 kart var)</option></select></label>
    </div>
    <div class="calc-out"><div><span>Gereken şans (pot oranı)</span><b id="c-po"></b></div><div><span>Gerçek şansın</span><b id="c-eq"></b></div><div><span>2-4 kuralıyla</span><b id="c-rule"></b></div></div>
    <div class="verdict" id="c-v"></div>
  </div>
  <h3>Sık görülen çekilişler</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Çekiliş</th><th>Out</th><th>Flop → River</th><th>Turn → River</th></tr></thead><tbody>
  ${row('Floş + açık uçlu kent',15)}${row('Floş çekilişi',9)}${row('Açık uçlu kent',8)}${row('İki yüksek kart (overcard)',6)}${row('Ortadan kent (gutshot)',4)}${row('Cep per → üçlü',2)}
  </tbody></table></div>
  <div class="callout"><b>İma edilen oran</b> Elini tamamladığında rakibin daha fazla para koyacaksa, şu anki pot oranının biraz altında da görebilirsin. Ama bunu her çekilişte bahane etme.</div>`;
}

function L_bluff(){
  const T=[['gevsek','Neredeyse her şeyi görür. Ona blöf yapma; iyi elin olduğunda büyük bahis yap, o öder.'],['kaya','Az el oynar. O artırıyorsa ciddiye al. O kontrol ediyorsa küçük bir bahisle potu almayı dene.'],['manyak','Sürekli artırır ve sık blöf yapar. İyi elinle bekle, bahsi o yapsın; orta güçteki ellerle de görebilirsin.'],['kopekbaligi','Sıkı ve agresif; matematiği bilir. Tahmin edilebilir olma, bahis büyüklüklerini karıştır.'],['tilki','Çok el oynar ve baskı kurar. Pozisyonu ona bırakma; güçlü ellerle yeniden artır.']];
  return `<p class="lead">Kartlar herkese eşit gelir. Fark, bahislerinle anlattığın hikâyede ve rakibini ne kadar iyi okuduğunda.</p>
  <h3>İyi bir blöfün koşulları</h3>
  <ul>
    <li><b>Az rakip:</b> Bir kişiyi çekilmeye ikna etmek, dört kişiyi ikna etmekten çok daha kolaydır.</li>
    <li><b>Tutarlı hikâye:</b> Pre-flop artırıp flop'ta As gelince bahis yapmak inandırıcıdır. Bütün el boyunca pasif kalıp river'da birden büyük bahis yapmak değildir.</li>
    <li><b>Korkutucu masa:</b> Masaya floş ya da kent tamamlayan bir kart geldiyse, o eli sende varmış gibi oynayabilirsin.</li>
    <li><b>Doğru rakip:</b> Her şeyi gören birine blöf yapılmaz.</li>
  </ul>
  <h3>Yarı-blöf</h3>
  <p>Henüz tamamlanmamış ama güçlü bir çekilişle (örneğin floşa bir kart) bahis yapmaktır. İki şekilde kazanırsın: rakip hemen çekilir ya da gördükten sonra elini tamamlarsın. Saf blöften çok daha güvenlidir.</p>
  <h3>Bahis büyüklüğü</h3>
  <p>Çoğu durumda potun <b>yarısı ile dörtte üçü</b> arası bir bahis yeterlidir. İyi elinle de blöfünde de aynı büyüklükte bahis yaparsan rakip ikisini ayırt edemez.</p>
  <h3>Masadaki rakip tipleri</h3>
  <p>Her rakibin bir oyun tarzı var ama kariyerde kimse tarzını söylemez. Kıyafetinden, servetinden, oturuşundan ve bahislerinden sen çıkaracaksın. Alıştırma masalarında koç ipucu verir.</p>
  <div class="types">${T.map(([k,d])=>`<div style="--c:var(--st-${k})"><b><i></i>${STYLES[k].label}</b><p>${d}</p></div>`).join('')}</div>
  <div class="callout"><b>Unutma</b> Gerçek hayatta kumar bağımlılık yapabilir. Bu oyundaki fişler sanaldır; burada öğrendiklerini bir strateji oyunu olarak gör.</div>`;
}

function L_tells(){
  const R2=[
    ['Fişlere göz atma','Kartına ya da açılan kartlara baktıktan hemen sonra gözü fişlerine kayar.','Güçlü','Beyin bahse hazırlanır; oyuncu farkında olmadan "ne kadar koyarım" diye bakar.'],
    ['Titreyen eller','Bahis yaparken eli hafifçe titrer.','Çok güçlü','Uzun bekleyişten sonra gerilim boşalır, adrenalin eli titretir. Blöf yapan genelde kaskatı kesilir.'],
    ['Zayıf rolü','Bahsi yapıp omuz silker, iç çeker, başka yere bakar.','Güçlü','Amatör, rakibini kandırmak için tersini oynar: güçlüyken zayıf, zayıfken güçlü görünür.'],
    ['Donma ve dik bakış','Bahisten sonra nefesini tutar, kıpırdamaz, sana meydan okurcasına bakar.','Blöf','Yakalanma korkusu bedeni dondurur; bakış "beni görme" diye bağırır.'],
    ['Boyun/yüz ovma','Bahisten bir süre sonra boynunu ya da yüzünü ovuşturur.','Stres','Beyin kendini yatıştırmaya çalışır. Zayıf el ya da blöf olabilir.'],
    ['Sert fiş atma','Fişleri potun ortasına fırlatır.','Çoğu zaman zayıf','Abartılı özgüven gösterisi. Güçlü el tutan bahsi rahat ve yumuşak yapar.'],
    ['Erken uzanma','Sıra kendisine gelmeden kartlarına (çekilmek için) ya da fişlerine (bahis için) uzanır.','Niyet','Karar verilmiştir; beden önden gider.'],
    ['Kartları yeniden kontrol','Masada aynı renkten üç kart açılınca kartlarına tekrar bakar.','Floş yok','Floşu olan kartlarının rengini unutmaz.'],
    ['Zamanlama','Uzun düşünüp bahis yapar; ya da anında görür.','Değişir','Amatörün sahte tereddüdü çoğunlukla güçlü eldir. Anında görme çekiliş ya da orta el demektir.'],
    ['Alışkanlıktan sapma','Tespih durur ya da hızlanır, sigaraya art arda nefes çeker, rahatça çay yudumlar.','Değişir','Önce oyuncunun normalini öğren. Tell, normalden sapmadır.'],
  ];
  return `<p class="lead">Kartları göremezsin ama sahibini görebilirsin. Kariyer masalarında koç yok: rakiplerinin davranışlarını izleyip kendin yorumlayacaksın.</p>
  <div class="tbl-wrap"><table class="t tells"><thead><tr><th>Davranış</th><th>Ne görürsün</th><th>Genelde</th><th>Neden</th></tr></thead><tbody>
  ${R2.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}
  </tbody></table></div>
  <h3>Kim ne kadar belli eder?</h3>
  <ul>
    <li><b>Masa seviyesi:</b> Tarlabaşı'ndaki bodrumda herkes elini yüzüne yansıtır. Monte Carlo'da ve Vegas'ta oyuncular kendini çok daha az belli eder; bazıları güneş gözlüğü takar, temposunu hiç değiştirmez.</li>
    <li><b>Ters sinyal:</b> Üst seviye bazı oyuncular bilerek yanlış işaret verir. Tek bir davranışa değil, davranış ile bahsin birbirini tutup tutmadığına bak.</li>
    <li><b>Kişilik ve servet:</b> Kıyafet, takı ve masadaki tavır çok şey anlatır. Varlıklı biri büyük bahsi rahat öder; parası kıt olan büyük potta çekinir. Az fişi kalan ya her şeyi sürer ya da çok sıkılaşır.</li>
    <li><b>Tilt:</b> Büyük bir potu kaybedip masaya vuran oyuncu bir süre duygusal oynar: daha çok el, daha çok blöf.</li>
  </ul>
  <div class="callout"><b>3D masada</b> Sürükleyerek etrafına bak, tekerlekle yakınlaş, bir oyuncuya tıklayıp yüzüne odaklan. Görmediğin oyuncunun davranışını kaçırırsın; Gözlemler panelinde yalnızca gördüklerin yazar.</div>`;
}

/* ---------- Alıştırma: Hangi el kazanır ---------- */
const QS={w:{n:0,ok:0,streak:0},h:{n:0,ok:0,streak:0}};
function Q_winner(){setTimeout(newWinnerQ,0);return `<p class="lead">İki oyuncu, aynı masa. Kim kazanır? Ya da pot bölüşülür mü?</p><div class="quiz" id="qw"></div>`;}
function genWinner(){
  for(let t=0;t<300;t++){
    const d=newDeck();const A=[d[0],d[1]],B=[d[2],d[3]],board=d.slice(4,9);
    const sa=evalCards(A.concat(board)),sb=evalCards(B.concat(board));const ca=catOf(sa),cb=catOf(sb);
    if((Math.max(ca,cb)>=1&&Math.abs(ca-cb)<=1)||t>250)return {A,B,board,sa,sb};
  }
}
function newWinnerQ(){
  const el=$('#qw');if(!el)return;SFX.play('deal');
  const q=genWinner();const S=QS.w;
  el.innerHTML=`<div class="qscore"><span>Doğru <b>${S.ok}/${S.n}</b></span><span>Seri <b>${S.streak}</b></span></div>
  <div class="qtable"><div class="qhands">
    <div class="qhand" id="qa"><span class="lbl">Oyuncu A</span><div class="cards">${cardsQ(q.A)}</div><span class="res"></span></div>
    <div class="qhand" id="qb"><span class="lbl">Oyuncu B</span><div class="cards">${cardsQ(q.B)}</div><span class="res"></span></div>
  </div><div><span class="lbl">Masa</span><div class="cards" id="qboard">${cardsQ(q.board)}</div></div></div>
  <div class="qbtns" id="qwb"><button class="btn ghost" data-a="A">Oyuncu A</button><button class="btn ghost" data-a="=">Bölüşürler</button><button class="btn ghost" data-a="B">Oyuncu B</button></div>
  <p class="qfb" id="qwf"></p>`;
  $$('#qwb button').forEach(b=>b.onclick=()=>{
    const ans=q.sa>q.sb?'A':q.sb>q.sa?'B':'=';const ok=b.dataset.a===ans;
    S.n++;if(ok){S.ok++;S.streak++;}else S.streak=0;
    $$('#qwb button').forEach(x=>{x.disabled=true;if(x.dataset.a===ans)x.classList.add('right');else if(x===b)x.classList.add('wrong');});
    const set=new Set(best5((ans==='B'?q.B:q.A).concat(q.board)));
    $('#qa .cards').innerHTML=markCards(q.A,ans!=='B'?set:new Set());
    $('#qb .cards').innerHTML=markCards(q.B,ans==='B'||ans==='='?new Set(best5(q.B.concat(q.board))):new Set());
    $('#qboard').innerHTML=markCards(q.board,set);
    SFX.play('flip');$('#qa .res').textContent=describe(q.sa);$('#qb .res').textContent=describe(q.sb);
    $('#qa').classList.toggle('winner',ans!=='B');$('#qb').classList.toggle('winner',ans!=='A');
    let why;
    const da=decode(q.sa),db=decode(q.sb);
    if(ans==='=')why='İki oyuncunun en iyi beş kartı aynı değerde; pot bölüşülür.';
    else if(da.cat!==db.cat)why=`${CAT[Math.max(da.cat,db.cat)]}, ${CAT[Math.min(da.cat,db.cat)]} elini yener.`;
    else{let i=0;while(i<5&&da.r[i]===db.r[i])i++;const w=ans==='A'?da:db,l=ans==='A'?db:da;why=`İkisi de ${CAT[da.cat]}. Belirleyici kart: ${RTR[w.r[i]]}, ${RTR[l.r[i]]} kartından yüksek.`;}
    const f=$('#qwf');f.className='qfb '+(ok?'ok':'no');f.innerHTML=`${ok?'Doğru!':'Yanlış.'} ${why} <button class="btn small" id="qwn" style="margin-left:8px">Yeni el →</button>`;
    $('#qwn').onclick=newWinnerQ;$('#qwn').focus();
    $('.qscore',el).innerHTML=`<span>Doğru <b>${S.ok}/${S.n}</b></span><span>Seri <b>${S.streak}</b></span>`;if(S.streak>=10)Ach.unlock('quiz10');
  });
}
const cardsQ=l=>l.map(c=>cardHTML(c)).join('');

/* ---------- Alıştırma: Bu el ne ---------- */
function Q_name(){setTimeout(newNameQ,0);return `<p class="lead">Yedi kart, tek soru: en iyi beş kartlık el hangisi?</p><div class="quiz" id="qn"></div>`;}
function genName(){
  const W=[1,1.4,1.4,1.2,1.2,1.2,1.2,.8,.5,.25];let x=rnd()*W.reduce((a,b)=>a+b,0),target=0;
  for(let i=0;i<W.length;i++){x-=W[i];if(x<=0){target=i;break;}}
  if(target===9){
    const s=Math.floor(rnd()*4);const roy=[8,9,10,11,12].map(r=>r*4+s);const rest=newDeck().filter(c=>!roy.includes(c)).slice(0,2);
    const all=roy.concat(rest);for(let i=all.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[all[i],all[j]]=[all[j],all[i]];}
    return all;
  }
  let last;
  for(let t=0;t<60000;t++){const d=newDeck().slice(0,7);last=d;if(catOf(evalCards(d))===target)return d;}
  return last;
}
function newNameQ(){
  const el=$('#qn');if(!el)return;SFX.play('deal');
  const cs=genName();const H=cs.slice(0,2),Bd=cs.slice(2);const sc=evalCards(cs),cat=catOf(sc);const S=QS.h;
  el.innerHTML=`<div class="qscore"><span>Doğru <b>${S.ok}/${S.n}</b></span><span>Seri <b>${S.streak}</b></span></div>
  <div class="qtable"><div class="qhands"><div class="qhand"><span class="lbl">Senin kartların</span><div class="cards" id="qnh">${cardsQ(H)}</div></div><div class="qhand"><span class="lbl">Masa</span><div class="cards" id="qnb">${cardsQ(Bd)}</div></div></div></div>
  <div class="qbtns" id="qnbtn">${CAT.map((n,i)=>`<button class="btn ghost small" data-c="${i}">${n}</button>`).join('')}</div>
  <p class="qfb" id="qnf"></p>`;
  $$('#qnbtn button').forEach(b=>b.onclick=()=>{
    const ok=+b.dataset.c===cat;S.n++;if(ok){S.ok++;S.streak++;}else S.streak=0;
    $$('#qnbtn button').forEach(x=>{x.disabled=true;if(+x.dataset.c===cat)x.classList.add('right');else if(x===b)x.classList.add('wrong');});
    SFX.play('flip');const set=new Set(best5(cs));$('#qnh').innerHTML=markCards(H,set);$('#qnb').innerHTML=markCards(Bd,set);
    const f=$('#qnf');f.className='qfb '+(ok?'ok':'no');f.innerHTML=`${ok?'Doğru!':'Yanlış.'} En iyi el: ${describe(sc)}. <button class="btn small" id="qnn" style="margin-left:8px">Yeni el →</button>`;
    $('#qnn').onclick=newNameQ;$('#qnn').focus();
    $('.qscore',el).innerHTML=`<span>Doğru <b>${S.ok}/${S.n}</b></span><span>Seri <b>${S.streak}</b></span>`;if(S.streak>=10)Ach.unlock('quiz10');
  });
}

const practiceOf=V=>Object.assign({},V,{training:true,practice:true,target:null});
function L_training(){
  setTimeout(()=>{
    const b=$('#train-go');if(b)b.onclick=()=>startGame(TRAINING);
    $$('[data-prac]').forEach(x=>x.onclick=()=>startGame(practiceOf(VENUES.find(v=>v.id===x.dataset.prac))));
  },0);
  const pr=VENUES.map(v=>{const un=isUnlocked(v);return `<button class="prac ${un?'':'lock'}" data-prac="${v.id}" ${un?'':'disabled'}><b>${v.name}</b><span>${v.city} · ${v.rivals.length} rakip · ${fmtM(v.sb,v.cur)}/${fmtM(v.bb,v.cur)}</span><em>${un?'Alıştırma masası →':'Kariyerde açılınca'}</em></button>`;}).join('');
  return `<p class="lead">Olasılıklar, öneriler ve davranış yorumları yalnızca burada. Kariyer masalarında koç yok; burada öğren, orada uygula.</p>
  <div class="train-card">
    <ul>
      <li>Koç her kararında kazanma şansını, pot oranını ve bir öneriyi gösterir.</li>
      <li>Rakiplerin davranışları Gözlemler panelinde anlamıyla birlikte yazılır.</li>
      <li>Flop, turn ve river açıldığında anlatıcı ne olduğunu ve elinin ne olduğunu söyler.</li>
      <li>Fişlerin biterse yeniden oturursun. Kariyer ilerlemeni etkilemez.</li>
    </ul>
    <div><button class="btn" id="train-go">Antrenman masasına otur</button> <span class="muted" style="font-size:13px">Üç acemi rakip, ₺100/₺200</span></div>
  </div>
  <h3>Kariyer masalarında alıştırma</h3>
  <p>Kariyerde açtığın her masada, aynı salon ve aynı rakiplerle koçlu oynayabilirsin. Kimin neyi nasıl belli ettiğini burada öğren.</p>
  <div class="pracs">${pr}</div>
  <p class="cap">Kısayollar: F çekil, C kontrol/gör, R artır, Enter sonraki el, V bakışı sıfırla.</p>`;
}

/* ================= Başlat ================= */
function boot(data){
  applySettings();
  const d=data||{};
  if(d.screen==='scr-learn'){show('scr-learn');openLesson(d.lesson||'temel');}
  else if(d.screen==='scr-career')show('scr-career');
  else show('scr-menu');
}
// Açılış (boot) en son yüklenen js/oyunlar.js'in sonunda çağrılır.
