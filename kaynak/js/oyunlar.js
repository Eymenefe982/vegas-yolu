'use strict';
/* ================= Salonun diğer masaları: rulet, blackjack, bakara, batak =================
   Pokerin yanında her salonun kendi oyunları var. Aynı cüzdan, aynı giriş/bozdurma kuralı, masaya özel tanınırlık.
   · Rulet, blackjack, bakara: karşında ev var. Fişini hedefe çıkarırsan masayı fethedersin; istediğin an kalkıp bozdurursun.
   · Batak: dört oyuncu giriş koyar, beş elin sonunda en çok puanı toplayan masadaki parayı alır (ev %10 masa hakkı keser).
   oyun.js'ten sonra yüklenir; cüzdan (canAfford, entryFee, REP…) ve kart yardımcıları oradan gelir. */
const GAMES={
  rulet:{t:'Rulet',d:'Tek sıfırlı Avrupa ruleti: sayıya 35 katı, düzine ve sütuna 2 katı, renk, tek/çift ve yarıya 1 katı öder.'},
  blackjack:{t:'Blackjack',d:'21\'e yaklaş, krupiyeyi geç. Blackjack 3:2 öder, krupiye 17\'de durur; ikiye katlayabilir, çifti bölebilirsin.'},
  bakara:{t:'Bakara',d:'Oyuncu mu, banka mı? Kartlar kurala göre açılır, sen yalnızca tarafını seçersin. Banka %5 komisyonla öder, beraberlik 8 katı.'},
  batak:{t:'Batak',d:'İhaleli tekli batak: dört kişi, on üç el. İhaleyi alan kozu seçer; yazdığını alamazsa batar. Beş elin sonunda en çok puanı toplayan masadaki parayı alır.'},
};
// Hangi salonda hangi oyun: mahalle mekânlarında batak, gerçek kumarhanelerde rulet, blackjack ve bakara.
const SIDE={kacak:['batak'],kiraathane:['batak'],yeralti:['batak','rulet','blackjack'],han:['batak'],yali:['blackjack','rulet'],
  girne:['rulet','blackjack'],monte:['rulet','blackjack','bakara'],macau:['bakara','blackjack','rulet'],vegas:['blackjack','rulet','bakara'],suit:['bakara','blackjack','rulet']};
const BK_HANDS=5,BK_CUT=.1;
function sideTable(V,k){
  const unit=V.unit||V.sb,buy=Math.round(V.buy*.5/unit)*unit;
  const amer=k==='rulet'&&(V.id==='vegas'||V.id==='suit');
  return {id:V.id+':'+k,game:k,V,cur:V.cur,unit,buy,min:Math.max(unit,Math.round(buy/50/unit)*unit),amer,lvl:V.lvl,
    name:amer?'Amerikan Ruleti':GAMES[k].t,target:k==='batak'?null:buy*2,rivals:k==='batak'?V.rivals.slice(0,3):null};
}
const sideTables=V=>(SIDE[V.id]||[]).map(k=>sideTable(V,k));
// 3D: salon ve masalar birinci şahıs; düz görünüm seçiliyse ya da WebGL yoksa eski düz masa
const USE3D=()=>Sahne.ok&&SAVE.settings.view!=='2d';
// Yan masadaki diğer oyuncular: o mekânın tanıdık yüzleri
function sideBots(t){
  const R=t.V.rivals,pick=t.game==='batak'?t.rivals:t.game==='rulet'?R.slice(-3):t.game==='blackjack'?R.slice(0,2):R.slice(-2);
  return pick.map(([n,s],k)=>({name:n,style:s,char:CHARS[n]||{},idx:k+1}));
}
const sumV=m=>Object.values(m).reduce((s,x)=>s+x,0);
const bkPrize=t=>Math.floor(t.buy*4*(1-BK_CUT)/t.unit)*t.unit;
const cmpF=new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1});
const cm=n=>C.t.cur+cmpF.format(n);
const cmoney=n=>fmtM(n,C.t.cur);

// Kariyer kartındaki küçük masa kutusu
function sideCard(t){
  const ok=canAfford(t),rl=repLvl(t),fee=entryFee(t);
  const goal=t.target?`Hedef <b>${fmtM(t.target,t.cur)}</b>`:`Kazanan <b>${fmtM(bkPrize(t),t.cur)}</b> alır`;
  return `<div class="side ${ok?'':'lock'}" title="${GAMES[t.game].d}">
    <div class="side-h"><b>${t.name}</b>${repWins(t)?'<span class="badge won">Fethedildi</span>':''}</div>
    <span class="side-f">Giriş ${fee<t.buy?`<s>${fmtM(t.buy,t.cur)}</s> `:''}<b>${fmtM(fee,t.cur)}</b> · ${goal}</span>
    ${rl?`<span class="side-rep"><span class="rep-pip r${rl}"></span>${REP[rl].t} · girişte %${Math.round(REP[rl].comp*100)} ikram</span>`:''}
    ${USE3D()?(ok?'':`<span class="muted side-f">${tl(entryTL(t)-SAVE.cash)} eksik</span>`):ok?`<button class="btn small" data-side="${t.id}">Otur</button>`:`<span class="muted side-f">${tl(entryTL(t)-SAVE.cash)} eksik</span>`}
  </div>`;
}
function bindSideCards(root){
  $$('[data-side]',root).forEach(b=>b.onclick=()=>{const [vid,k]=b.dataset.side.split(':');startSide(sideTable(VENUES.find(v=>v.id===vid),k));});
}

/* ---------- Oturum ---------- */
let C=null;
async function cwait(tok,ms){await sleep(ms*spd());if(!C||C.tok!==tok)throw ABORT;}
function startSide(t,opt={}){
  if(C)C.tok=null;
  closeModal();
  const paid=!SAVE.settings.free;
  if(paid&&SAVE.cash<entryTL(t)){
    C=null;show('scr-career');
    toast('Paran yetmiyor',`${t.name} girişi ${tl(entryTL(t))}; cüzdanında ${tl(SAVE.cash)} var.`,'info');return;
  }
  if(paid){SAVE.cash-=entryTL(t);persist();}
  C={t,chips:t.game==='batak'?0:t.buy,paid,rl:repLvl(t),settled:false,done:false,tok:{},inPlay:0,busy:false,chip:t.min,bet:{},hist:[],last:null,rounds:0,v3:USE3D(),fromHall:!!opt.fromHall,bots:sideBots(t)};
  const sc=$('#scr-casino');sc.dataset.venue=t.V.id;sc.dataset.game=t.game;
  $('#c-name').textContent=`${t.name} · ${t.V.name}`;
  $('#c-info').textContent=`${t.V.place}${t.game==='batak'?'':' · Min. bahis '+fmtM(t.min,t.cur)}${C.rl?' · '+REP[C.rl].t:''}`;
  $('#c-msg').textContent='';
  show('scr-casino');
  SFX.ambient(t.V.id);
  const felt=$('#c-felt');felt.className='c-felt'+(C.v3?' v3 v3x':'');$('#c-extra').innerHTML='';
  if(C.v3){
    felt.innerHTML=`<div class="v3-labels"></div><div class="v3-fade"></div><div class="v3-title"></div><div class="v3-intro">Masaya oturuyorsun · <b class="h-mouse">geçmek için tıkla</b><b class="h-touch">geçmek için dokun</b></div><div class="c3-hud" id="c3-hud"></div><div class="c3-mid" id="c3-mid"></div><div class="c3-bottom" id="c3-bottom"></div>`;
    C.intro=Sahne.side({id:t.V.id,mode:t.game,players:C.bots,min:t.min,amer:t.amer,title:t.name,place:t.V.name},felt);
  }else Sahne.stop();
  IMPL[t.game].start();
  cHead();
  if(C.rl&&t.game!=='batak'){
    const c=C;setTimeout(()=>{if(C===c)toast(`Krupiye seni tanıdı · ${REP[c.rl].t}`,c.rl>=3?'“Hoş geldiniz efendim, masanız hazır.” Ev sana ikram fiş verdi.':c.rl>=2?'“Yine şeref verdiniz.” Ev, girişinin bir kısmını karşıladı.':'“Tekrar hoş geldiniz.” Ev, girişinin bir kısmını karşıladı.','info');},900);
  }
}
function cHead(){
  const c=C;if(!c)return;const t=c.t;
  if(t.game==='batak'){
    const B=c.bk;
    $('#c-chips-k').textContent='Masadaki para';$('#c-chips').textContent=cmoney(bkPrize(t));
    $('#c-goal-txt').textContent=`El ${Math.min(BK_HANDS,(B?B.hn:0)+1)} / ${BK_HANDS}`;
    $('#c-goal-bar').style.width=((B?B.hn:0)/BK_HANDS*100)+'%';
  }else{
    $('#c-chips-k').textContent='Fişin';$('#c-chips').textContent=cmoney(c.chips-c.inPlay);
    $('#c-goal-txt').innerHTML=`Hedef <b>${cmoney(t.target)}</b>`;
    $('#c-goal-bar').style.width=clamp(c.chips/t.target*100,0,100)+'%';
  }
}
const cmsg=html=>{$('#c-msg').innerHTML=html;};
// Kalkış: fişler nakde döner (ortada kalan bahis gider). Batakta oyun bitmeden kalkan girişini masada bırakır.
function sideCashOut(){
  const c=C;if(!c||c.settled)return 0;c.settled=true;
  if(!c.paid)return 0;
  const amt=c.t.game==='batak'&&!c.done?0:toTL(Math.max(0,c.chips-c.inPlay),c.t.cur);
  SAVE.cash+=amt;persist();
  return amt;
}
function sideLeave(){
  const c=C;
  if(c){const amt=sideCashOut();if(c.paid&&amt>0)toast('Fişler bozduruldu',`${tl(amt)} cüzdanına geçti. Cüzdan: ${tl(SAVE.cash)}`,'info');c.tok=null;}
  C=null;closeModal();
  if(c&&c.fromHall&&USE3D()){enterHall(c.t.V,true);return;}
  Sahne.stop();SFX.ambient(null);show('scr-career');
}
// Kumarhane oyunlarında tur bitince: hedefe ulaştıysan fetih, fişin en düşük bahse yetmiyorsa masa biter.
function afterRound(){
  const c=C,t=c.t;c.rounds++;cHead();
  if(c.chips>=t.target){c.busy=true;setTimeout(()=>{if(C===c)sideEnd('win');},1100);return true;}
  if(c.chips<t.min){c.busy=true;setTimeout(()=>{if(C===c)sideEnd('bust');},1100);return true;}
  return false;
}
function sideEnd(kind){
  const c=C,t=c.t;
  $('#modal').dataset.lock='1';
  const got=sideCashOut();
  const purse=c.paid?` Cüzdanında artık <b>${tl(SAVE.cash)}</b> var.`:'';
  const cashTxt=c.paid&&got>0?` Fişler bozduruldu: ${tl(got)}.`:'';
  let head,body,fame='';
  if(kind==='win'){
    const r0=repLvl(t);if(c.paid)SAVE.rep[t.id]=repWins(t)+1;const r1=repLvl(t);persist();
    Ach.unlock('g-'+t.game);
    if(r1>r0)fame=`<p>Bu masada adın duyuldu: artık <b>${REP[r1].t}</b> olarak biliniyorsun. Bir dahaki sefere ev, girişte %${Math.round(REP[r1].comp*100)} ikram yapacak.</p>`;
    head=`${t.name} masasını fethettin`;
    body=t.game==='batak'?`Beş elin sonunda en yüksek puan senin: masadaki ${cmoney(c.chips)} senin oldu.`:`Fişini ${cmoney(c.chips)} yaptın; ${c.rounds} tur sürdü.`;
  }else if(kind==='tie'){
    head='Puanlar eşit';body=`Birinciliği paylaştın; masadaki para bölüşüldü, payın ${cmoney(c.chips)}.`;
  }else{
    head=t.game==='batak'?'Oyunu kaybettin':'Fişlerin bitti';
    body=t.game==='batak'?'Beş elin sonunda birinci olamadın; giriş ücretin masada kaldı.':got>0?'Fişin en düşük bahse yetmiyor; masadan kalktın.':'Masadaki son fişini kaybettin. Giriş ücreti gitti.';
  }
  // tanınırlık yükseldiyse ikramlı yeni ücret görünür
  const again=canAfford(t)?`<button class="btn" id="m-again">Tekrar otur${c.paid?' · '+tl(entryTL(t)):''}</button>`:`<span class="muted" style="font-size:13px">Tekrar oturmak için ${tl(entryTL(t)-SAVE.cash)} daha lazım</span>`;
  openModal(`<span class="kicker">${t.V.name} · ${t.name}</span><h3>${head}</h3><p>${body}${cashTxt}${purse}</p>${fame}
    <div class="row"><button class="btn ghost" id="m-career">${c.fromHall&&USE3D()?'Salona dön':'Kariyere dön'}</button>${again}</div>`);
  if($('#m-again'))$('#m-again').onclick=()=>{delete $('#modal').dataset.lock;startSide(t,{fromHall:c.fromHall});};
  $('#m-career').onclick=()=>{delete $('#modal').dataset.lock;sideLeave();};
}
$('#c-leave').onclick=()=>{
  if(!C)return;
  const c=C,t=c.t;
  const msg=t.game==='batak'&&!c.done?'Oyundan çekilirsen giriş ücretin masada kalır, hiçbir şey alamazsın.'
    :!c.paid?'Serbest moddasın; fişler cüzdana geçmez.'
    :`Önündeki ${cmoney(c.chips-c.inPlay)}${t.cur!=='₺'?` (≈ ${tl(toTL(c.chips-c.inPlay,t.cur))})`:''} nakde dönüp cüzdanına geçer.${c.inPlay?' Ortadaki bahsin gider.':''}`;
  openModal(`<h3>Masadan kalk?</h3><p>${msg}</p><div class="row"><button class="btn ghost" id="m-stay">Oynamaya devam</button><button class="btn" id="m-leave">Kalk</button></div>`);
  $('#m-stay').onclick=closeModal;$('#m-leave').onclick=sideLeave;
};

/* ---------- Ortak bahis araçları ---------- */
const betSum=()=>Object.values(C.bet).reduce((s,x)=>s+x,0);
const freeChips=()=>C.chips-C.inPlay-betSum();
function rackHTML(){
  return `<div class="rack" role="group" aria-label="Fiş seç">${[1,5,25,100].map(k=>k*C.t.min).map((v,i)=>`<button class="chipb c${i} ${C.chip===v?'on':''}" data-chip="${v}" ${v>C.chips?'disabled':''} aria-pressed="${C.chip===v}">${cm(v)}</button>`).join('')}</div>`;
}
function placeBet(key){
  const c=C;if(!c||c.busy)return;
  let a=c.chip;if(a>freeChips())a=Math.floor(freeChips()/c.t.unit)*c.t.unit;
  if(a<=0){cmsg('Bu kadar fişin yok.');return;}
  c.bet[key]=(c.bet[key]||0)+a;c.hist.push([key,a]);SFX.play('chip');
  IMPL[c.t.game].draw();
}
function undoBet(){const c=C,h=c.hist.pop();if(!h)return;c.bet[h[0]]-=h[1];if(c.bet[h[0]]<=0)delete c.bet[h[0]];IMPL[c.t.game].draw();}
function clearBet(){C.bet={};C.hist=[];IMPL[C.t.game].draw();}
function rebet(){
  const c=C;if(!c.last)return;
  const tot=Object.values(c.last).reduce((s,x)=>s+x,0);
  if(tot>c.chips-c.inPlay){cmsg('Aynı bahis için fişin yetmiyor.');return;}
  c.bet={...c.last};c.hist=Object.entries(c.bet);SFX.play('chip');IMPL[c.t.game].draw();
}
const betTag=k=>C.bet[k]?`<span class="bchip">${cm(C.bet[k])}</span>`:'';
function shoe(n){const d=[];for(let k=0;k<n;k++)for(let i=0;i<52;i++)d.push(i);for(let i=d.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const x=d[i];d[i]=d[j];d[j]=x;}return d;}
function draw1(){const c=C;if(c.shoe.length<c.cut){c.shoe=shoe(c.decks);cmsg('Deste karıştırıldı.');SFX.play('shuffle');}return c.shoe.pop();}
document.getElementById('scr-casino').addEventListener('click',e=>{
  const ch=e.target.closest('[data-chip]');if(ch&&C){C.chip=+ch.dataset.chip;$$('#c-ctrl [data-chip]').forEach(b=>{b.classList.toggle('on',b===ch);b.setAttribute('aria-pressed',b===ch);});
    if(C.v3&&C.t.game==='blackjack'&&C.phase==='bet')placeBet('main');   // 3D masada fişe dokunmak bahse ekler
    return;}
  const bt=e.target.closest('[data-bet]');if(bt&&C){placeBet(bt.dataset.bet);return;}
  const a=e.target.closest('[data-do]');if(a&&C&&!a.disabled){const f=ACTS[a.dataset.do];if(f)f();}
});
const ACTS={undo:undoBet,clear:clearBet,rebet};

/* ================= Rulet ================= */
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL_EU=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WHEEL_US=[0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,37,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2];   // 37 = 00
const rlab=n=>n===37?'00':String(n);
const rcol=n=>n===0||n===37?'g':RED.has(n)?'r':'b';
const RCOL_TR={g:'Yeşil',r:'Kırmızı',b:'Siyah'};
// Kazanılan katsayı (bahis geri verilir); 0 = kayıp. Sıfırlarda dış bahisler kaybeder.
function rPay(k,n){
  if(k[0]==='n')return +k.slice(1)===n?35:0;
  if(n===0||n===37)return 0;
  switch(k){
    case 'red':return RED.has(n)?1:0; case 'black':return RED.has(n)?0:1;
    case 'odd':return n%2?1:0; case 'even':return n%2?0:1;
    case 'low':return n<=18?1:0; case 'high':return n>=19?1:0;
  }
  if(k[0]==='d')return Math.ceil(n/12)===+k[1]?2:0;
  if(k[0]==='c')return ((n-1)%3)+1===+k[1]?2:0;
  return 0;
}
function wheelSVG(order){
  const n=order.length,seg=360/n,P=(a,r)=>`${(110+r*Math.cos(a)).toFixed(2)},${(110+r*Math.sin(a)).toFixed(2)}`;
  let s='';
  order.forEach((num,i)=>{
    const a0=(i*seg-seg/2-90)*Math.PI/180,a1=(i*seg+seg/2-90)*Math.PI/180;
    s+=`<path d="M${P(a0,64)}L${P(a0,100)}A100,100 0 0 1 ${P(a1,100)}L${P(a1,64)}A64,64 0 0 0 ${P(a0,64)}Z" class="pk ${rcol(num)}"/>`;
    s+=`<text x="110" y="21" transform="rotate(${(i*seg).toFixed(2)} 110 110)">${rlab(num)}</text>`;
  });
  return `<svg viewBox="0 0 220 220" class="wheel" aria-hidden="true"><circle cx="110" cy="110" r="109" class="rim"/><g id="r-spin" class="spin">${s}<circle cx="110" cy="110" r="64" class="hub"/><circle cx="110" cy="110" r="40" class="hub2"/><path d="M110 78v64M78 110h64" class="cross"/></g><path d="M110 16l-7-13h14z" class="ptr"/></svg>`;
}
const Rulet={
  start(){
    const c=C;c.hist=[];c.spins=[];c.rot=0;c.order=c.t.amer?WHEEL_US:WHEEL_EU;c.r3=new Set();c.botB=[];
    if(c.v3){
      $('#c3-hud').innerHTML='<div class="c3-res" id="r-res"></div><div class="rl-hist c3-pill" id="r-hist"></div>';
      $('#c-extra').innerHTML='<div class="rl-board-wrap"><div class="rl-board" id="r-board"></div></div>';
    }else $('#c-felt').innerHTML=`<div class="rl">
      <div class="rl-wheel">${wheelSVG(c.order)}<div class="rl-res" id="r-res"></div></div>
      <div class="rl-side"><div class="rl-hist" id="r-hist" aria-label="Son sonuçlar"></div><div class="rl-board-wrap"><div class="rl-board" id="r-board"></div></div></div>
    </div>`;
    cmsg(`${c.t.amer?'Çarkta 0 ve 00 var; ev avantajı Avrupa ruletinin neredeyse iki katı.':'Tek sıfırlı Avrupa çarkı.'} Fiş seç, tabloya koy, çarkı çevir.`);
    this.draw();
  },
  draw(){
    const c=C;
    const cell=(k,lab,cls='')=>`<button class="rc ${cls}" data-bet="${k}" ${c.busy?'disabled':''}>${lab}${betTag(k)}</button>`;
    let nums='';
    for(let row=0;row<3;row++)for(let col=0;col<12;col++){const n=col*3+(3-row);nums+=cell('n'+n,n,'num '+rcol(n));}
    const zeros=`<div class="rz">${cell('n0','0','num g')}${c.t.amer?cell('n37','00','num g'):''}</div>`;
    const cols=[3,2,1].map(k=>cell('c'+k,'2:1','out')).join('');
    $('#r-board').innerHTML=`${zeros}<div class="rn">${nums}</div><div class="rcol">${cols}</div>
      <div class="rd">${cell('d1','1. 12','out')}${cell('d2','2. 12','out')}${cell('d3','3. 12','out')}</div>
      <div class="ro">${cell('low','1–18','out')}${cell('even','Çift','out')}${cell('red','<i class="dia r"></i>','out')}${cell('black','<i class="dia b"></i>','out')}${cell('odd','Tek','out')}${cell('high','19–36','out')}</div>`;
    $('#r-hist').innerHTML=c.spins.slice(0,14).map(n=>`<span class="rh ${rcol(n)}">${rlab(n)}</span>`).join('')||'<span class="muted">Henüz çevrilmedi</span>';
    const tot=betSum();
    $('#c-ctrl').innerHTML=`${rackHTML()}<div class="c-btns">
      <span class="c-bet">Bahis <b>${cmoney(tot)}</b></span>
      <button class="btn ghost small" data-do="undo" ${c.busy||!c.hist.length?'disabled':''}>Geri al</button>
      <button class="btn ghost small" data-do="clear" ${c.busy||!tot?'disabled':''}>Temizle</button>
      <button class="btn ghost small" data-do="rebet" ${c.busy||!c.last||tot?'disabled':''}>Aynı bahis</button>
      <button class="btn" data-do="spin" ${c.busy||!tot?'disabled':''}>Çarkı çevir</button></div>`;
    // 3D: senin fişlerin masadaki tabloda
    if(c.v3){for(const k of [...c.r3])if(!c.bet[k]){Sahne.rlBet(0,k,0);c.r3.delete(k);}for(const [k,a] of Object.entries(c.bet)){Sahne.rlBet(0,k,a);c.r3.add(k);}}
    cHead();
  },
  async spin(){
    const c=C,tok=c.tok,tot=betSum();if(!tot||c.busy)return;
    c.busy=true;c.inPlay=tot;c.last={...c.bet};this.draw();
    const i=Math.floor(rnd()*c.order.length),n=c.order[i],seg=360/c.order.length,RC=c.v3?'c3-res':'rl-res';
    if(c.v3){
      // masadakiler de oynar: bahisler kapanmadan fişlerini koyarlar, sonra krupiye çevirir
      Sahne.rlMarker(null);
      const keys=['red','black','odd','even','low','high','d1','d2','d3','c1','c2','c3'];
      c.botB=c.bots.map(()=>{const m={},nb=1+(rnd()<.4?1:0);for(let j=0;j<nb;j++){const k=rnd()<.25?'n'+(1+Math.floor(rnd()*36)):keys[Math.floor(rnd()*keys.length)];m[k]=(m[k]||0)+c.t.min*[1,2,5,10][Math.floor(rnd()*4)];}return m;});
      c.botB.forEach((m,k)=>setTimeout(()=>{if(C!==c)return;for(const key in m)Sahne.rlBet(k+1,key,m[key]);Sahne.sideLabel(k+1,{c:'Bahis '+cmoney(sumV(m)),a:''});},150+k*230));
      setTimeout(()=>{if(C===c)Sahne.rlSpin(i,4.6);},800);
    }else{
      const want=(360-i*seg)%360;c.rot=c.rot-((c.rot%360)+360)%360+360*6+want;
      const g=$('#r-spin');g.style.transition='transform 4.2s cubic-bezier(.12,.6,.15,1)';g.style.transform=`rotate(${c.rot}deg)`;
    }
    $('#r-res').className=RC;$('#r-res').textContent='';
    cmsg('Bahisler kapandı… <i>Rien ne va plus.</i>');SFX.play('shuffle');
    // 3D'de top gerçekten cebe düşene kadar beklenir (oyun hızından bağımsız)
    const w8=ms=>c.v3?sleep(ms).then(()=>{if(!C||C.tok!==tok)throw ABORT;}):cwait(tok,ms);
    try{for(let k=0;k<6;k++){await w8(500+k*90);if(!c.v3)SFX.play('chip');}await w8(600);}catch(e){return;}
    let back=0,wins=[];
    for(const [k,a] of Object.entries(c.bet)){const m=rPay(k,n);if(m){back+=a*(m+1);wins.push(k);}}
    const net=back-tot;c.chips+=net;c.inPlay=0;c.spins.unshift(n);
    if(wins.some(k=>k[0]==='n'))Ach.unlock('rulet-sayi');
    $('#r-res').className=RC+' on '+rcol(n);$('#r-res').textContent=rlab(n);
    if(c.v3){
      const pays={};[c.bet,...c.botB].forEach(m=>{for(const k in m)pays[k]=rPay(k,n);});
      Sahne.rlMarker(n);Sahne.rlSettle(pays);
      c.botB.forEach((m,k)=>{let b=0;for(const key in m)if(pays[key])b+=m[key]*(pays[key]+1);const nt=b-sumV(m);
        Sahne.sideLabel(k+1,{a:nt>0?'+'+cmoney(nt):'−'+cmoney(-nt),cls:nt>0?'raise':'fold'});
        setTimeout(()=>{if(C===c)Sahne.sideAct(k+1,nt>0?'win':rnd()<.5?'sigh':'lose',{big:nt>=c.t.min*20});},700+k*300);});
    }
    cmsg(`<b>${rlab(n)} ${RCOL_TR[rcol(n)]}</b>${n&&n!==37?` · ${n%2?'Tek':'Çift'} · ${n<=18?'1–18':'19–36'}`:''}. ${net>0?`<span class="good">${cmoney(net)} kazandın.</span>`:net===0?'Bahsin geri döndü.':`<span class="bad">${cmoney(-net)} kaybettin.</span>`}`);
    SFX.play(net>0?'win':'sweep');
    c.bet={};c.hist=[];c.busy=false;
    afterRound();this.draw();
  },
};
ACTS.spin=()=>Rulet.spin();

/* ================= Blackjack ================= */
function bjVal(cs){let s=0,a=0;for(const c of cs){const r=c>>2;if(r===12){a++;s+=11;}else s+=r>=8?10:r+2;}while(s>21&&a){s-=10;a--;}return {v:s,soft:a>0};}
const bjTen=c=>{const r=c>>2;return r>=8&&r<=11;};
const bjRankV=c=>{const r=c>>2;return r===12?11:r>=8?10:r+2;};
const isBJ=h=>h.cards.length===2&&!h.split&&bjVal(h.cards).v===21;
const BJ={
  start(){
    const c=C;c.decks=6;c.shoe=shoe(6);c.cut=78;c.phase='bet';c.dh=[];c.hands=[];c.cur=0;c.hole=true;
    c.bjb=c.v3?c.bots.map(b=>Object.assign({},b,{cards:[],bet:0})):[];
    if(c.v3){$('#c3-hud').innerHTML='<div class="c3-pill" id="bj-dv3"></div>';$('#c3-bottom').innerHTML='<div class="c3-me" id="bj-me3"></div>';cmsg('Fişe dokun, bahsine eklensin; sonra dağıt.');this.draw();return;}
    $('#c-felt').innerHTML=`<div class="bj"><div class="bj-arc">Blackjack 3:2 öder · Krupiye 17'de durur · Sigorta yok</div>
      <div class="bj-row"><span class="bj-lab">Krupiye <b id="bj-dv"></b></span><div class="cards" id="bj-dealer"></div></div>
      <div class="bj-hands" id="bj-hands"></div></div>`;
    cmsg('Fiş seç, bahis kutusuna koy ve dağıt.');
    this.draw();
  },
  draw3(){
    const c=C,ph=c.phase;
    Sahne.cardsSet('d',c.dh,c.hole?1:-1);
    Sahne.cardsSet('h0',c.hands[0]?c.hands[0].cards:[]);Sahne.cardsSet('h1',c.hands[1]?c.hands[1].cards:[]);
    c.bjb.forEach(b=>Sahne.cardsSet('b'+b.idx,b.cards));
    if(ph==='bet')Sahne.pileSet('bet0',c.bet.main||0);
    else if(ph==='play'){Sahne.pileSet('bet0',c.hands[0]?c.hands[0].bet:0);if(c.hands[1])Sahne.pileSet('bet0b',c.hands[1].bet);}
    $('#bj-dv3').innerHTML=c.dh.length?`Krupiye <b>${c.hole?bjVal([c.dh[0]]).v:bjVal(c.dh).v}</b>`:'Krupiye';
    $('#bj-me3').innerHTML=ph==='bet'?`Bahsin <b>${cmoney(c.bet.main||0)}</b>`:c.hands.map((h,i)=>{const v=bjVal(h.cards);return `<span class="${i===c.cur&&ph==='play'&&c.hands.length>1?'cur':''}">${c.hands.length>1?(i+1)+'. el ':'Sen '}<b>${v.v}</b>${v.soft&&v.v<21?' yumuşak':''}${h.res?` · <em class="${h.resCls}">${h.res}</em>`:''}</span>`;}).join('');
  },
  draw(){
    const c=C,ph=c.phase;
    if(c.v3)this.draw3();else{
    $('#bj-dealer').innerHTML=c.dh.map((x,i)=>cardHTML(i===1&&c.hole?null:x)).join('');
    $('#bj-dv').textContent=c.dh.length?(c.hole?bjVal([c.dh[0]]).v:bjVal(c.dh).v):'';
    if(ph==='bet'){
      $('#bj-hands').innerHTML=`<button class="bj-spot" data-bet="main" ${c.busy?'disabled':''}>${c.bet.main?`<span class="bchip big">${cm(c.bet.main)}</span>`:'<span>Bahsini buraya koy</span>'}</button>`;
    }else{
      $('#bj-hands').innerHTML=c.hands.map((h,i)=>{const v=bjVal(h.cards);
        return `<div class="bj-hand ${i===c.cur&&ph==='play'?'cur':''}"><div class="cards">${h.cards.map(x=>cardHTML(x)).join('')}</div>
          <span class="bj-lab"><b>${v.v}</b>${v.soft&&v.v<21?' (yumuşak)':''} · Bahis ${cmoney(h.bet)}${h.res?` · <em class="${h.resCls}">${h.res}</em>`:''}</span></div>`;}).join('');
    }}
    const tot=betSum(),h=c.hands[c.cur],free=c.chips-c.inPlay;
    if(ph==='bet'){
      $('#c-ctrl').innerHTML=`${rackHTML()}<div class="c-btns"><span class="c-bet">Bahis <b>${cmoney(tot)}</b></span>
        <button class="btn ghost small" data-do="clear" ${c.busy||!tot?'disabled':''}>Temizle</button>
        <button class="btn ghost small" data-do="rebet" ${c.busy||!c.last||tot?'disabled':''}>Aynı bahis</button>
        <button class="btn" data-do="bjdeal" ${c.busy||tot<c.t.min?'disabled':''}>Dağıt</button></div>`;
    }else if(ph==='play'&&h){
      const two=h.cards.length===2,canD=two&&free>=h.bet&&!h.aces,canS=two&&c.hands.length===1&&bjRankV(h.cards[0])===bjRankV(h.cards[1])&&free>=h.bet;
      $('#c-ctrl').innerHTML=`<div class="c-btns">
        <button class="btn" data-do="hit" ${c.busy?'disabled':''}>Kart çek <kbd>H</kbd></button>
        <button class="btn" data-do="stand" ${c.busy?'disabled':''}>Dur <kbd>S</kbd></button>
        <button class="btn ghost" data-do="dbl" ${c.busy||!canD?'disabled':''}>İkiye katla <kbd>D</kbd></button>
        <button class="btn ghost" data-do="split" ${c.busy||!canS?'disabled':''}>Böl <kbd>P</kbd></button></div>`;
    }else $('#c-ctrl').innerHTML='';
    cHead();
  },
  async deal(){
    const c=C,tok=c.tok,bet=c.bet.main||0;if(c.busy||bet<c.t.min)return;
    c.busy=true;c.last={main:bet};c.bet={};c.hist=[];c.inPlay=bet;
    c.hands=[{cards:[],bet}];c.cur=0;c.dh=[];c.hole=true;c.phase='play';
    if(c.v3){Sahne.cardsClear();c.bjb.forEach(b=>{b.cards=[];b.bet=c.t.min*[1,2,3,5][Math.floor(rnd()*4)];Sahne.pileSet('bet'+b.idx,b.bet);Sahne.sideLabel(b.idx,{c:'Bahis '+cmoney(b.bet),a:'',h:''});});}
    try{
      // dağıtım sırası krupiyenin solundan: ilk koltuk, orta koltuk, sen (son koltuk), krupiye
      const order=[c.bjb[0],c.bjb[1],'me'].filter(Boolean);
      for(let k=0;k<2;k++){
        for(const o of order){(o==='me'?c.hands[0].cards:o.cards).push(draw1());SFX.play('deal');this.draw();await cwait(tok,330);}
        c.dh.push(draw1());SFX.play('deal');this.draw();await cwait(tok,330);
      }
      c.bjb.forEach(b=>Sahne.sideLabel(b.idx,{h:String(bjVal(b.cards).v)}));
      const up=c.dh[0],dBJ=bjVal(c.dh).v===21,pBJ=isBJ(c.hands[0]);
      if((up>>2===12||bjTen(up))&&!pBJ){cmsg('Krupiye kapalı karta bakıyor…');await cwait(tok,700);}
      if(dBJ||(pBJ&&!c.bjb.length)){c.hole=false;SFX.play('flip');return this.settle(tok);}
      await this.botsPlay(tok);   // senden önceki koltuklar önce oynar
      if(pBJ){c.hands[0].done=true;return this.next(tok);}
      c.busy=false;cmsg('Kart çek ya da dur.');this.draw();
    }catch(e){}
  },
  async act(kind){
    const c=C,tok=c.tok,h=c.hands[c.cur];if(c.busy||c.phase!=='play'||!h)return;
    c.busy=true;
    try{
      if(kind==='split'){
        const [a,b]=h.cards,aces=a>>2===12;c.inPlay+=h.bet;
        c.hands=[{cards:[a],bet:h.bet,split:true,aces},{cards:[b],bet:h.bet,split:true,aces}];
        for(const x of c.hands){x.cards.push(draw1());SFX.play('deal');this.draw();await cwait(tok,330);}
        if(aces){c.hands.forEach(x=>x.done=true);return this.next(tok);}
      }else if(kind==='dbl'){
        c.inPlay+=h.bet;h.bet*=2;h.cards.push(draw1());SFX.play('chip');this.draw();await cwait(tok,380);h.done=true;
      }else if(kind==='hit'){
        h.cards.push(draw1());SFX.play('deal');this.draw();await cwait(tok,300);
      }else h.done=true;
      return this.next(tok);
    }catch(e){}
  },
  // yan oyuncular sırayla oynar (temel strateji): masaya vurmak kart, başını sallamak dur
  async botsPlay(tok){
    const c=C;if(!c.bjb.length)return;
    const upV=bjRankV(c.dh[0]);
    for(const b of c.bjb){
      Sahne.sideTurn(b.idx);cmsg(`${b.name} oynuyor…`);
      for(;;){const v=bjVal(b.cards);if(v.v>=21)break;const hit=v.v<=11||(v.soft&&v.v<=17)||(v.v===12&&(upV<4||upV>=7))||(v.v>=13&&v.v<=16&&upV>=7);
        await cwait(tok,500+rnd()*300);if(!hit){Sahne.sideAct(b.idx,'nod');break;}Sahne.sideAct(b.idx,'check');await cwait(tok,250);b.cards.push(draw1());SFX.play('deal');this.draw();Sahne.sideLabel(b.idx,{h:String(bjVal(b.cards).v)});}
      await cwait(tok,300);
    }
    Sahne.sideTurn(-1);
  },
  async next(tok){
    const c=C;
    while(c.cur<c.hands.length&&(c.hands[c.cur].done||bjVal(c.hands[c.cur].cards).v>=21))c.cur++;
    if(c.cur<c.hands.length){c.busy=false;cmsg(`${c.cur+1}. el: kart çek ya da dur.`);this.draw();return;}
    c.hole=false;SFX.play('flip');this.draw();await cwait(tok,500);
    if(c.hands.some(h=>bjVal(h.cards).v<=21)||c.bjb.some(b=>bjVal(b.cards).v<=21)){
      while(bjVal(c.dh).v<17){c.dh.push(draw1());SFX.play('deal');this.draw();await cwait(tok,450);}
    }
    return this.settle(tok);
  },
  async settle(tok){
    const c=C,dv=bjVal(c.dh).v,dBJ=c.dh.length===2&&dv===21;
    let net=0;
    for(const h of c.hands){
      const v=bjVal(h.cards).v,pBJ=isBJ(h);let w;
      if(pBJ&&!dBJ){w=Math.floor(h.bet*1.5);h.res='Blackjack!';Ach.unlock('bj-21');}
      else if(dBJ&&!pBJ){w=-h.bet;h.res='Krupiyede blackjack';}
      else if(v>21){w=-h.bet;h.res='Battın';}
      else if(dv>21){w=h.bet;h.res='Krupiye battı';}
      else if(v>dv){w=h.bet;h.res='Kazandın';}
      else if(v<dv){w=-h.bet;h.res='Kaybettin';}
      else{w=0;h.res='Berabere';}
      h.resCls=w>0?'good':w<0?'bad':'';net+=w;
      if(c.v3)Sahne.pileOut(h===c.hands[0]?'bet0':'bet0b',w>0?'win':w<0?'lose':'back',h.bet+w);
    }
    c.bjb.forEach((b,k)=>{
      const v=bjVal(b.cards).v,bb=b.cards.length===2&&v===21;let w,res;
      if(bb&&!dBJ){w=Math.floor(b.bet*1.5);res='Blackjack!';}else if(dBJ&&!bb){w=-b.bet;res='Kaybetti';}else if(v>21){w=-b.bet;res='Battı';}
      else if(dv>21||v>dv){w=b.bet;res='Kazandı';}else if(v<dv){w=-b.bet;res='Kaybetti';}else{w=0;res='Berabere';}
      Sahne.pileOut('bet'+b.idx,w>0?'win':w<0?'lose':'back',b.bet+w);Sahne.sideLabel(b.idx,{a:res,cls:w>0?'raise':w<0?'fold':''});
      setTimeout(()=>{if(C===c)Sahne.sideAct(b.idx,w>0?'win':w<0?(rnd()<.5?'sigh':'lose'):'shrug',{big:bb});},500+k*300);
    });
    c.chips+=net;c.inPlay=0;c.phase='done';
    SFX.play(net>0?'win':'sweep');
    cmsg(`Krupiye ${dv>21?'battı ('+dv+')':dv}. ${net>0?`<span class="good">${cmoney(net)} kazandın.</span>`:net<0?`<span class="bad">${cmoney(-net)} kaybettin.</span>`:'Bahsin geri döndü.'}`);
    this.draw();
    try{await cwait(tok,900);}catch(e){return;}
    if(afterRound())return;
    c.phase='bet';c.busy=false;
    if(c.last&&c.last.main<=c.chips)c.bet={...c.last},c.hist=[['main',c.last.main]];
    this.draw();
  },
};
Object.assign(ACTS,{bjdeal:()=>BJ.deal(),hit:()=>BJ.act('hit'),stand:()=>BJ.act('stand'),dbl:()=>BJ.act('dbl'),split:()=>BJ.act('split')});

/* ================= Bakara (Punto Banco) ================= */
const bcV=c=>{const r=c>>2;return r===12?1:r>=8?0:r+2;};
const bcT=cs=>cs.reduce((s,c)=>s+bcV(c),0)%10;
const Bakara={
  start(){
    const c=C;c.decks=8;c.shoe=shoe(8);c.cut=40;c.ph=[];c.bh=[];c.road=[];c.bcb=[];
    if(c.v3){
      $('#c3-hud').innerHTML='<div class="c3-pill" id="bc-tot3"></div>';
      $('#c-extra').innerHTML='<div class="bc"><div class="bc-spots" id="bc-spots"></div><div class="bc-road" id="bc-road" aria-label="Son sonuçlar"></div></div>';
      cmsg('Tarafını seç: Oyuncu 1:1, Banka 0,95:1, Beraberlik 8:1. Kartlar kurala göre kendiliğinden açılır.');this.draw();return;
    }
    $('#c-felt').innerHTML=`<div class="bc">
      <div class="bc-hands"><div class="bc-h p"><span class="bj-lab">Oyuncu <b id="bc-pv"></b></span><div class="cards" id="bc-p"></div></div>
      <div class="bc-h b"><span class="bj-lab">Banka <b id="bc-bv"></b></span><div class="cards" id="bc-b"></div></div></div>
      <div class="bc-spots" id="bc-spots"></div><div class="bc-road" id="bc-road" aria-label="Son sonuçlar"></div></div>`;
    cmsg('Tarafını seç: Oyuncu 1:1, Banka 0,95:1, Beraberlik 8:1. Kartlar kurala göre kendiliğinden açılır.');
    this.draw();
  },
  draw(){
    const c=C;
    if(c.v3){
      Sahne.cardsSet('p',c.ph);Sahne.cardsSet('b',c.bh);
      ['p','t','b'].forEach(k=>Sahne.pileSet(k+'0',c.bet[k]||0));
      $('#bc-tot3').innerHTML=`<span class="pv">Oyuncu <b>${c.ph.length?bcT(c.ph):'–'}</b></span><span class="bv">Banka <b>${c.bh.length?bcT(c.bh):'–'}</b></span>`;
    }else{
    $('#bc-p').innerHTML=c.ph.map(x=>cardHTML(x)).join('');$('#bc-b').innerHTML=c.bh.map(x=>cardHTML(x)).join('');
    $('#bc-pv').textContent=c.ph.length?bcT(c.ph):'';$('#bc-bv').textContent=c.bh.length?bcT(c.bh):'';}
    const spot=(k,l,o)=>`<button class="bc-spot ${k}" data-bet="${k}" ${c.busy?'disabled':''}><b>${l}</b><span>${o}</span>${betTag(k)}</button>`;
    $('#bc-spots').innerHTML=spot('p','Oyuncu','1 : 1')+spot('t','Beraberlik','8 : 1')+spot('b','Banka','0,95 : 1');
    $('#bc-road').innerHTML=c.road.slice(-36).map(r=>`<i class="${r}" title="${{p:'Oyuncu',b:'Banka',t:'Beraberlik'}[r]}">${{p:'O',b:'B',t:'E'}[r]}</i>`).join('')||'<span class="muted">Sonuç tablosu boş</span>';
    const tot=betSum();
    $('#c-ctrl').innerHTML=`${rackHTML()}<div class="c-btns"><span class="c-bet">Bahis <b>${cmoney(tot)}</b></span>
      <button class="btn ghost small" data-do="undo" ${c.busy||!c.hist.length?'disabled':''}>Geri al</button>
      <button class="btn ghost small" data-do="rebet" ${c.busy||!c.last||tot?'disabled':''}>Aynı bahis</button>
      <button class="btn" data-do="bcdeal" ${c.busy||!tot?'disabled':''}>Dağıt</button></div>`;
    cHead();
  },
  async deal(){
    const c=C,tok=c.tok,tot=betSum();if(c.busy||!tot)return;
    c.busy=true;c.inPlay=tot;c.last={...c.bet};c.ph=[];c.bh=[];
    if(c.v3){Sahne.cardsClear();c.bcb=c.bots.map(b=>{const r=rnd(),k=r<.47?'p':r<.94?'b':'t',a=c.t.min*[1,2,5][Math.floor(rnd()*3)];Sahne.pileSet(k+b.idx,a);Sahne.sideLabel(b.idx,{c:(k==='p'?'Oyuncu':k==='b'?'Banka':'Beraberlik')+' · '+cmoney(a),a:''});return {idx:b.idx,k,a};});}
    this.draw();
    const give=async(h)=>{h.push(draw1());SFX.play('deal');this.draw();await cwait(tok,420);};
    try{
      await give(c.ph);await give(c.bh);await give(c.ph);await give(c.bh);
      let p=bcT(c.ph),b=bcT(c.bh),p3=null;
      if(p<8&&b<8){
        if(p<=5){await give(c.ph);p3=bcV(c.ph[2]);}
        const bd=p3==null?b<=5:b<=2||(b===3&&p3!==8)||(b===4&&p3>=2&&p3<=7)||(b===5&&p3>=4&&p3<=7)||(b===6&&p3>=6&&p3<=7);
        if(bd)await give(c.bh);
      }
      p=bcT(c.ph);b=bcT(c.bh);
      const r=p>b?'p':b>p?'b':'t';c.road.push(r);
      let net=0;
      for(const [k,a] of Object.entries(c.bet)){
        if(r==='t')net+=k==='t'?a*8:0;
        else if(k===r)net+=k==='b'?Math.floor(a*.95):a;
        else net-=a;
      }
      if(c.v3){
        const out=(key,k,a)=>{const w=r==='t'?(k==='t'?a*8:0):k===r?(k==='b'?Math.floor(a*.95):a):-a;Sahne.pileOut(key,w>0?'win':w<0?'lose':'back',a+w);return w;};
        for(const [k,a] of Object.entries(c.bet))out(k+'0',k,a);
        c.bcb.forEach((b,j)=>{const w=out(b.k+b.idx,b.k,b.a);Sahne.sideLabel(b.idx,{a:w>0?'+'+cmoney(w):w<0?'−'+cmoney(-w):'İade',cls:w>0?'raise':w<0?'fold':''});setTimeout(()=>{if(C===c)Sahne.sideAct(b.idx,w>0?'win':w<0?'sigh':'shrug');},600+j*300);});
      }
      c.chips+=net;c.inPlay=0;c.bet={};c.hist=[];
      SFX.play(net>0?'win':'sweep');
      cmsg(`${r==='t'?`<b>Beraberlik</b> (${p}–${b})`:`<b>${r==='p'?'Oyuncu':'Banka'} kazandı</b> · ${p} – ${b}`}${(p>=8||b>=8)&&c.ph.length===2&&c.bh.length===2?' · doğal':''}. ${net>0?`<span class="good">${cmoney(net)} kazandın.</span>`:net<0?`<span class="bad">${cmoney(-net)} kaybettin.</span>`:'Bahsin geri döndü.'}`);
      c.busy=false;this.draw();
      await cwait(tok,300);
      afterRound()&&this.draw();
    }catch(e){}
  },
};
ACTS.bcdeal=()=>Bakara.deal();

/* ================= Batak (ihaleli, tekli) ================= */
const BK_SUIT_ORDER=[0,1,3,2];   // ♠ ♥ ♣ ♦: renkler sırayla
const bkSort=h=>h.sort((a,b)=>BK_SUIT_ORDER.indexOf(a&3)-BK_SUIT_ORDER.indexOf(b&3)||(b>>2)-(a>>2));
const BK_BATIK=['Battın usta!','İhale pahalıya patladı.','Yazdığını alamadın, olsun.','Hah! Battı!'];
const BK_MADE=['Helal, ihaleyi çıkardın.','Bu el senindi.','İyi oynadın.'];
function bkEst(hand){
  const by=[0,1,2,3].map(s=>hand.filter(c=>(c&3)===s).map(c=>c>>2).sort((a,b)=>b-a));
  let hi=0;by.forEach(rs=>{if(rs.includes(12))hi+=1;if(rs.includes(11))hi+=rs.length>=2?.75:.25;if(rs.includes(10))hi+=rs.length>=3?.4:.1;});
  let ts=0,best=-1;by.forEach((rs,s)=>{const sc=rs.length+(rs.includes(12)?.6:0)+(rs.includes(11)?.4:0)+(rs.includes(10)?.2:0);if(sc>best){best=sc;ts=s;}});
  return {est:hi+Math.max(0,by[ts].length-3)*.9+.3,trump:ts};
}
const Batak={
  start(){
    const c=C,t=c.t;
    c.bk={hn:0,dealer:Math.floor(rnd()*4),ps:[{name:'Sen',human:true,style:null},...t.rivals.map(([n,s])=>({name:n,style:s}))]};
    c.bk.ps.forEach((p,i)=>Object.assign(p,{idx:i,hand:[],bid:null,tricks:0,score:0,hs:[]}));
    if(c.v3){$('#c3-hud').innerHTML='<div class="bk-info c3-pill" id="bk-info"></div>';$('#c3-bottom').innerHTML='<div class="bk-mehead" id="bk-s0"></div><div class="bk-hand" id="bk-hand"></div>';}
    else $('#c-felt').innerHTML=`<div class="bk">${[2,3,1].map(i=>`<div class="bk-seat q${i}" id="bk-s${i}"></div>`).join('')}
      <div class="bk-mid"><div class="bk-info" id="bk-info"></div><div class="bk-trick" id="bk-trick"></div></div>
      <div class="bk-me"><div class="bk-mehead" id="bk-s0"></div><div class="bk-hand" id="bk-hand"></div></div></div>`;
    cmsg(`Masaya herkes ${cmoney(t.buy)} koydu. Beş elin sonunda en çok puanı toplayan ${cmoney(bkPrize(t))} alır (ev %${BK_CUT*100} masa hakkı keser).`);
    this.run(c.tok);
  },
  say(i,txt,ms=2600){
    if(C&&C.v3){Sahne.sideSay(i,txt,ms);return;}
    const el=$('#bk-s'+i+' .bk-say');if(!el)return;
    el.textContent=txt;el.classList.add('on');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('on'),ms);
  },
  greet(){
    const c=C,B=c.bk,rl=c.rl;
    B.ps.filter(p=>!p.human).sort(()=>rnd()-.5).slice(0,2).forEach((p,k)=>setTimeout(()=>{
      if(C!==c)return;
      const own=rl&&REP_GREET[rl]&&REP_GREET[rl][p.style];
      this.say(p.idx,(own||(TALK[p.style]||TALK.gevsek).greet)[Math.floor(rnd()*(own||(TALK[p.style]||TALK.gevsek).greet).length)]);
    },500+k*1500));
  },
  draw(){
    const c=C,B=c.bk;
    B.ps.forEach(p=>{
      const el=$('#bk-s'+p.idx);if(!el)return;
      const on=B.turn===p.idx,bid=p.bid==null?'':p.bid===0?'Pas':'İhale '+p.bid;
      const holder=B.holder===p.idx&&B.trump!=null;
      el.className=el.className.replace(/ ?(on|hold)\b/g,'')+(on?' on':'')+(holder?' hold':'');
      el.innerHTML=`<span class="bk-ava" style="--ava:${p.human?'var(--ivory)':`var(--st-${p.style})`}">${p.human?'SEN':initials(p.name)}</span>
        <div class="bk-meta"><b>${p.human?'Sen':p.name}</b><span>${bid}${B.phase==='play'?` · Aldığı <b>${p.tricks}</b>`:''}</span><span>Puan <b>${p.score}</b></span></div>
        ${p.human?'':`<span class="bk-cnt" title="Elindeki kart">${p.hand.length?cardHTML(null)+'<em>'+p.hand.length+'</em>':''}</span><span class="bk-say"></span>`}`;
    });
    const L=B.legal||[];
    const me=B.ps[0];
    $('#bk-hand').innerHTML=me.hand.map(x=>{const ok=L.includes(x);return `<button class="bk-card ${B.legal?(ok?'ok':'no'):''}" data-card="${x}" ${ok?'':'tabindex="-1"'}>${cardHTML(x)}</button>`;}).join('');
    const tr=$('#bk-trick');if(tr)tr.innerHTML=(B.trick||[]).map(x=>`<span class="bk-tc q${x.p} ${B.win===x.p?'win':''}">${cardHTML(x.c,'deal')}</span>`).join('');
    if(c.v3){
      B.ps.forEach(p=>{if(!p.human)Sahne.sideLabel(p.idx,{c:'Puan '+p.score,a:p.bid==null?'':p.bid===0?'Pas':'İhale '+p.bid,cls:B.holder===p.idx&&B.trump!=null?'raise':p.bid===0?'fold':'',h:B.phase==='play'?'Aldığı '+p.tricks:''});});
      Sahne.sideTurn(B.turn==null?-1:B.turn);
    }
    $('#bk-info').innerHTML=B.trump!=null?`<span>Koz</span><b class="s${B.trump}">${SS[B.trump]}</b><span>İhale: ${B.ps[B.holder].human?'Sen':B.ps[B.holder].name} · <b>${B.bid}</b></span>`:`<span>El ${B.hn+1} / ${BK_HANDS}</span>`;
    cHead();
  },
  ask(html){return new Promise((res,rej)=>{C.bk.res=res;C.bk.rej=rej;$('#c-ctrl').innerHTML=html;});},
  async run(tok){
    const c=C,B=c.bk;
    try{
      if(c.intro){this.draw();await c.intro;if(!C||C.tok!==tok)return;}
      this.draw();this.greet();await cwait(tok,1600);
      for(B.hn=0;B.hn<BK_HANDS;B.hn++){
        B.dealer=(B.dealer+1)%4;B.trump=null;B.holder=null;B.bid=0;B.trick=[];B.broken=false;B.played=new Set();B.legal=null;B.phase='bid';
        const d=newDeck();B.ps.forEach((p,i)=>{p.hand=bkSort(d.slice(i*13,i*13+13));p.bid=null;p.tricks=0;});
        if(c.v3){Sahne.bkClear();$('#c3-mid').innerHTML='';[1,2,3].forEach(i=>Sahne.bkFan(i,13));}
        SFX.play('shuffle');this.draw();await cwait(tok,700);
        await this.bidding(tok);
        await this.trumpPick(tok);
        B.phase='play';B.leader=B.holder;
        cmsg(`${B.ps[B.holder].human?'İhale sende':B.ps[B.holder].name+' ihaleyi aldı'}: ${B.bid}, koz ${STR[B.trump]} ${SS[B.trump]}. ${B.ps[B.holder].human?'İlk kartı sen atarsın.':'İlk kartı o atar.'} Koz, biri kesmeden açılmaz.`);
        for(let k=0;k<13;k++)await this.trickRound(tok);
        await this.scoreHand(tok);
      }
      this.finish();
    }catch(e){if(e!==ABORT)console.error(e);}
  },
  async bidding(tok){
    const c=C,B=c.bk;
    const active=[true,true,true,true];let i=(B.dealer+1)%4,cur=0;B.holder=null;
    cmsg('İhale: on üç elden kaçını alabileceğini söyle. En yüksek ihaleyi veren kozu seçer.');
    for(let guard=0;guard<60;guard++){
      const others=active.filter((a,k)=>a&&k!==B.holder).length;
      if(B.holder!=null&&others===0)break;
      if(B.holder==null&&!active.some(Boolean))break;
      if(!active[i]||i===B.holder){i=(i+1)%4;continue;}
      const p=B.ps[i];B.turn=i;this.draw();
      const min=Math.max(4,cur+1);let b=null;
      if(min<=13){
        if(p.human){
          const opts=[];for(let v=min;v<=Math.min(13,min+5);v++)opts.push(v);
          b=await this.ask(`<div class="c-btns"><span class="c-bet">İhale ${cur?`(şu an <b>${cur}</b>)`:''}</span>${opts.map(v=>`<button class="btn" data-bk="bid" data-v="${v}">${v}</button>`).join('')}<button class="btn ghost" data-bk="bid" data-v="0">Pas</button></div>`);
          $('#c-ctrl').innerHTML='';
        }else{
          await cwait(tok,650+rnd()*500);
          let {est}=bkEst(p.hand);
          est+=({manyak:.7,gevsek:.3,kaya:-.4}[p.style]||0)+gauss()*.4;
          if(c.rl&&B.holder===0)est-=REP[c.rl].awe*10*(AWE_ST[p.style]??1);   // tanınan oyuncunun ihalesine çoğu rakip üstüne gitmez
          b=Math.floor(est)>=min?min:0;
        }
      }else b=0;
      if(b){cur=b;B.holder=i;B.bid=b;p.bid=b;}else{active[i]=false;p.bid=0;}
      if(!p.human)this.say(i,b?String(b):'Pas',1400);
      this.draw();i=(i+1)%4;
    }
    if(B.holder==null){B.holder=B.dealer;B.bid=4;B.ps[B.dealer].bid=4;cmsg(`Herkes pas geçti; dağıtan ${B.ps[B.dealer].human?'sen':B.ps[B.dealer].name} 4 ile zorunlu ihaleyi aldı.`);}
    B.turn=null;this.draw();await cwait(tok,600);
  },
  async trumpPick(tok){
    const c=C,B=c.bk,p=B.ps[B.holder];
    if(p.human){
      B.trump=await this.ask(`<div class="c-btns"><span class="c-bet">Kozu seç</span>${[0,1,3,2].map(s=>`<button class="btn ghost bk-suit s${s}" data-bk="trump" data-v="${s}">${SS[s]} ${STR[s]}</button>`).join('')}</div>`);
      $('#c-ctrl').innerHTML='';
    }else{await cwait(tok,700);B.trump=bkEst(p.hand).trump;this.say(p.idx,`Koz ${STR[B.trump].toLocaleLowerCase('tr-TR')}!`,1800);}
    this.draw();await cwait(tok,500);
  },
  legal(p){
    const B=C.bk,h=p.hand;
    if(!B.trick.length){if(!B.broken){const non=h.filter(x=>(x&3)!==B.trump);if(non.length)return non;}return h.slice();}
    const lead=B.trick[0].c&3,w=this.winner().c;
    const fol=h.filter(x=>(x&3)===lead);
    // Yükseltme zorunlu: yerdeki en büyük kartı geçebiliyorsan geçmek zorundasın
    if(fol.length){if((w&3)===lead){const hi=fol.filter(x=>(x>>2)>(w>>2));if(hi.length)return hi;}return fol;}
    const tr=h.filter(x=>(x&3)===B.trump);
    if(tr.length){if((w&3)===B.trump){const hi=tr.filter(x=>(x>>2)>(w>>2));if(hi.length)return hi;}return tr;}
    return h.slice();
  },
  winner(){const B=C.bk;let w=B.trick[0];for(const x of B.trick.slice(1)){const ws=w.c&3,xs=x.c&3;if(xs===ws){if((x.c>>2)>(w.c>>2))w=x;}else if(xs===B.trump)w=x;}return w;},
  bot(p){
    const B=C.bk,L=this.legal(p),T=B.trump;
    const key=x=>((x&3)===T?100:0)+(x>>2);
    const low=a=>a.slice().sort((x,y)=>key(x)-key(y))[0];
    const top=x=>{for(let r=(x>>2)+1;r<=12;r++){const y=r*4+(x&3);if(!B.played.has(y)&&!p.hand.includes(y))return false;}return true;};
    if(!B.trick.length){
      const sure=L.filter(top);
      if(sure.length)return sure.sort((x,y)=>((x&3)===T)-((y&3)===T)||(y>>2)-(x>>2))[0];
      return low(L);
    }
    const w=this.winner().c;
    const beats=L.filter(x=>((x&3)===(w&3)&&(x>>2)>(w>>2))||((x&3)===T&&(w&3)!==T));
    if(beats.length){
      const last=B.trick.length===3,sure=beats.filter(top);
      return last?low(beats):(sure.length?low(sure):low(beats));
    }
    return low(L);
  },
  async trickRound(tok){
    const c=C,B=c.bk;B.trick=[];B.win=null;
    for(let k=0;k<4;k++){
      const i=(B.leader+k)%4,p=B.ps[i];B.turn=i;
      let card;
      if(p.human){
        B.legal=this.legal(p);this.draw();
        cmsg(B.trick.length?'Sıra sende: parlayan kartlardan birini at. Yerdeki kartı geçebiliyorsan geçmek zorundasın.':'Sıra sende: ilk kartı at.');
        card=await this.ask('');
        B.legal=null;
      }else{this.draw();await cwait(tok,480+rnd()*380);card=this.bot(p);}
      p.hand.splice(p.hand.indexOf(card),1);B.trick.push({p:i,c:card});B.played.add(card);
      if((card&3)===B.trump)B.broken=true;
      if(c.v3){Sahne.bkPlay(i,card);if(!p.human)Sahne.bkFan(i,p.hand.length);}
      SFX.play('deal');this.draw();
      if(!p.human)await cwait(tok,120);
    }
    const w=this.winner();B.win=w.p;B.turn=null;this.draw();
    await cwait(tok,900);
    if(c.v3)Sahne.bkTake(w.p);
    B.ps[w.p].tricks++;B.leader=w.p;B.trick=[];B.win=null;SFX.play('sweep');this.draw();
    await cwait(tok,200);
  },
  async scoreHand(tok){
    const c=C,B=c.bk,h=B.ps[B.holder];
    const made=h.tricks>=B.bid;
    B.ps.forEach(p=>{const d=p===h?(made?p.tricks:-B.bid):p.tricks;p.score+=d;p.hs.push(d);});
    const who=h.human?'Sen':h.name;
    cmsg(`${who} ${B.bid} yazdı, ${h.tricks} aldı: ${made?`<span class="good">ihale çıktı (+${h.tricks})</span>`:`<span class="bad">battı (−${B.bid})</span>`}.`);
    const others=B.ps.filter(p=>!p.human);
    if(h.human)this.say(others[Math.floor(rnd()*3)].idx,(made?BK_MADE:BK_BATIK)[Math.floor(rnd()*(made?3:4))]);
    else if(!made&&rnd()<.6)this.say(h.idx,['Olmadı bu sefer.','Kartlar gelmedi be!','Hay aksi!'][Math.floor(rnd()*3)]);
    if(c.v3){if(!h.human)Sahne.sideAct(h.idx,made?'fistPump':'facepalm');else if(!made)Sahne.sideAct(others[Math.floor(rnd()*3)].idx,'laugh');}
    B.phase='score';B.trump=null;this.draw();
    const rows=B.ps.map(p=>`<tr class="${p.human?'me':''}"><td>${p.human?'Sen':p.name}</td>${p.hs.map(x=>`<td class="${x<0?'bad':''}">${x}</td>`).join('')}<td><b>${p.score}</b></td></tr>`).join('');
    ($('#bk-trick')||$('#c3-mid')).innerHTML=`<table class="bk-score"><thead><tr><th></th>${B.ps[0].hs.map((_,k)=>`<th>${k+1}</th>`).join('')}<th>Top.</th></tr></thead><tbody>${rows}</tbody></table>`;
    await this.ask(`<div class="c-btns"><button class="btn" data-bk="next">${B.hn+1<BK_HANDS?'Sonraki el':'Sonucu gör'} <kbd>Enter</kbd></button></div>`);
    $('#c-ctrl').innerHTML='';
  },
  finish(){
    const c=C,B=c.bk,t=c.t,best=Math.max(...B.ps.map(p=>p.score)),ws=B.ps.filter(p=>p.score===best);
    const me=ws.includes(B.ps[0]);
    c.chips=me?Math.floor(bkPrize(t)/ws.length/t.unit)*t.unit:0;c.done=true;c.rounds=BK_HANDS;cHead();
    if(!me)cmsg(`${ws.map(p=>p.name).join(' ve ')} ${best} puanla kazandı.`);
    sideEnd(me?(ws.length===1?'win':'tie'):'lose');
  },
};
document.getElementById('scr-casino').addEventListener('click',e=>{
  if(!C||C.t.game!=='batak'||!C.bk.res)return;
  const B=C.bk;
  const card=e.target.closest('[data-card]');
  if(card&&B.legal){const x=+card.dataset.card;if(B.legal.includes(x)){const r=B.res;B.res=null;r(x);}return;}
  const b=e.target.closest('[data-bk]');
  if(b){const r=B.res;B.res=null;r(b.dataset.v!=null?+b.dataset.v:true);}
});
const IMPL={rulet:Rulet,blackjack:BJ,bakara:Bakara,batak:Batak};

// Klavye: blackjack kısayolları, batakta Enter
document.addEventListener('keydown',e=>{
  if(!C||CUR!=='scr-casino'||!$('#modal').hidden||e.target.closest('input'))return;
  const k=e.key.toLowerCase();
  if(C.t.game==='blackjack'&&C.phase==='play'){const m={h:'hit',s:'stand',d:'dbl',p:'split'}[k];if(m){const b=$(`#c-ctrl [data-do="${m}"]`);if(b&&!b.disabled)b.click();}}
  if(k==='enter'){const b=$('#c-ctrl [data-bk="next"]')||$('#c-ctrl [data-do="spin"],#c-ctrl [data-do="bjdeal"],#c-ctrl [data-do="bcdeal"]');if(b&&!b.disabled){e.preventDefault();b.click();}}
});

/* ================= Salon: kumarhaneye birinci şahısta gir, masanı seç ================= */
let HALL=null;
function hallTabs(V){
  const rl=v=>{const l=repLvl(v);return l?REP[l].t:'';};
  const out=[{key:'poker',name:'Poker',sub:`Giriş ${fmtM(entryFee(V),V.cur)} · ${V.target?'Hedef '+fmtM(V.target,V.cur):'Turnuva'}`,ok:canAfford(V),fee:entryTL(V),rep:rl(V),won:SAVE.conquered.includes(V.id)}];
  sideTables(V).forEach(t=>out.push({key:t.game,name:t.name,sub:`Giriş ${fmtM(entryFee(t),t.cur)} · ${t.target?'Hedef '+fmtM(t.target,t.cur):'Kazanan '+fmtM(bkPrize(t),t.cur)+' alır'}`,ok:canAfford(t),fee:entryTL(t),amer:t.amer,rep:rl(t),won:repWins(t)>0}));
  return out;
}
function hallRender(){
  if(!HALL)return;const V=HALL.V;
  $('#h-cash').textContent=SAVE.settings.free?'Serbest mod':tl(SAVE.cash);
  $('#hall-list').innerHTML=hallTabs(V).map(x=>`<div class="hl ${x.ok?'':'lock'}">
    <div class="hl-t"><b>${x.name}</b>${x.won?'<span class="badge won">Fethedildi</span>':''}</div>
    <span class="hl-s">${x.sub}${x.rep?` · <em>${x.rep}</em>`:''}</span>
    ${x.ok?`<button class="btn small" data-hk="${x.key}" ${HALL.busy?'disabled':''}>Otur</button>`:`<span class="muted hl-s">${tl(x.fee-SAVE.cash)} eksik</span>`}
  </div>`).join('');
}
function enterHall(V,back){
  if(C){C.tok=null;C=null;}
  if(G){G.tok=null;G.reject&&G.reject(ABORT);G=null;}
  closeModal();
  if(!USE3D()){show('scr-career');return;}
  HALL={V,busy:false};
  $('#scr-hall').dataset.venue=V.id;
  $('#h-name').textContent=V.name;$('#h-info').textContent=V.place;
  show('scr-hall');SFX.ambient(V.id);
  hallRender();
  const tabs=hallTabs(V);
  Sahne.hall({id:V.id,name:V.name,place:V.place,back:!!back,
    rivals:V.rivals.map(([n,s])=>({name:n,style:s,char:CHARS[n]||{}})),
    tables:tabs.map(x=>({key:x.key,name:x.name,sub:x.ok?x.sub:'Paran yetmiyor',ok:x.ok,amer:x.amer})),
    onPick:pickTable},$('#hall3'));
}
async function pickTable(k){
  if(!HALL||HALL.busy)return;
  const V=HALL.V,x=hallTabs(V).find(q=>q.key===k);if(!x)return;
  if(!x.ok){toast('Paran yetmiyor',`${x.name} girişi ${tl(x.fee)}; cüzdanında ${tl(SAVE.cash)} var.`,'info');return;}
  HALL.busy=true;hallRender();
  const h=HALL;await Sahne.hallGo(k);
  if(HALL!==h)return;
  HALL=null;
  if(k==='poker')startGame(V,{fromHall:true});else startSide(sideTable(V,k),{fromHall:true});
}
$('#hall-list').addEventListener('click',e=>{const b=e.target.closest('[data-hk]');if(b&&!b.disabled)pickTable(b.dataset.hk);});
$('#h-leave').onclick=()=>{HALL=null;Sahne.stop();SFX.ambient(null);show('scr-career');};

/* ================= Başlat ================= */
try{window.claude?.hot?.snapshot?.(()=>({screen:CUR==='scr-game'?((G&&G.venue.training)?'scr-learn':'scr-career'):(CUR==='scr-casino'||CUR==='scr-hall')?'scr-career':CUR,lesson:(G&&G.venue.training)?'antrenman':LES}));}catch(e){}
if(window.claude?.hot?.ready)window.claude.hot.ready(boot);else boot(window.claude?.hot?.data??{});
