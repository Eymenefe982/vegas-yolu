'use strict';
/* ================= Ek özellikler =================
   Günlük hediye ve seri, haftalık turnuva, yeni başarımlar, liderlik tablosu penceresi,
   genişletilmiş eğitim (yeni dersler, alıştırmalar, ders sonu kontrolleri, bitirme sınavı).
   oyun.js'ten sonra, oyunlar.js'ten önce yüklenir. */

/* ---------- Tarih yardımcıları ---------- */
const pad2=n=>String(n).padStart(2,'0');
const dayKey=d=>{d=d||new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
// Pazartesi başlangıçlı hafta: k = haftanın pazartesisi
function weekInfo(d){
  d=d||new Date();const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));
  return {k:dayKey(x),start:x,end:addDays(x,7)};
}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const hashStr=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};

/* ---------- Yeni başarımlar ---------- */
ACH_BASE.push(
  {id:'gunluk3',t:'Düzenli Müşteri',d:'Günlük hediyeyi 3 gün üst üste al.'},
  {id:'gunluk7',t:'Haftalık Alışkanlık',d:'Günlük hediyeyi 7 gün üst üste al.'},
  {id:'gunluk30',t:'Sadık Müdavim',d:'Günlük hediyeyi 30 gün üst üste al.'},
  {id:'turnuva',t:'Turnuva Cesareti',d:'Haftalık turnuvaya katıl.'},
  {id:'podyum',t:'Podyum',d:'Haftalık turnuvada ilk üçe gir.'},
  {id:'sampiyon',t:'Haftanın Şampiyonu',d:'Haftalık turnuvayı kazan.'},
  {id:'karakter',t:'Kendi Tarzım',d:'Karakterini özelleştir.'},
  {id:'lider',t:'Tabloya Girdin',d:'Liderlik tablosuna katıl.'},
  {id:'bin-el',t:'Bin El Tecrübe',d:'Toplam 1.000 el oyna.'},
  {id:'zengin',t:'Yarım Milyoner',d:'Cüzdanında ₺1.000.000 biriktir.'},
  {id:'dev',t:'Servet',d:'Cüzdanında ₺100.000.000 biriktir.'},
  {id:'mezun',t:'Mezun',d:'Bitirme sınavını 8 ya da daha fazla doğruyla geç.'},
  {id:'matematik',t:'Matematikçi',d:'Pot oranı alıştırmasında üst üste 5 doğru yap.'}
);
function extraChecks(){
  const s=SAVE;
  if(s.stats.hands>=1000)Ach.unlock('bin-el');
  if(s.cash>=1e6)Ach.unlock('zengin');
  if(s.cash>=1e8)Ach.unlock('dev');
}
{const h0=Ach.hand;Ach.hand=i=>{h0(i);extraChecks();};}
{const r0=refreshAvatars;refreshAvatars=function(){r0();if(SAVE.avatar&&Object.keys(SAVE.avatar).length)Ach.unlock('karakter');};}

/* ---------- Günlük hediye ---------- */
const DAILY=[1500,2000,2500,3000,4000,5000,10000];
const dailyAmt=n=>Math.round(DAILY[(n-1)%7]*(1+Math.min(4,Math.floor((n-1)/7))*.5));
/* Güvenilir saat: web'de sunucunun Date başlığı (cihaz saatini ileri alarak hediye/hafta kazanılamaz).
   Sunucuya ulaşılamazsa web'de hediye verilmez. Uygulamada (exe/apk) sunucu yok: yerel saat, yalnızca geri alma denetimiyle. */
const Zaman={
  web:()=>/^https?:$/.test(location.protocol)&&location.hostname!=='appassets.androidplatform.net',
  async al(){
    if(!Zaman.web()){
      const son=(SAVE.daily&&SAVE.daily.ts)||0;
      if(Date.now()<son-3e5)return {ok:false,neden:'Cihaz saatin geriye alınmış görünüyor. Saati otomatiğe alıp tekrar dene.'};
      return {ok:true,t:new Date()};
    }
    try{
      const r=await fetch('sw.js?z='+Date.now(),{method:'HEAD',cache:'no-store'});
      const d=r.headers.get('date'),t=d?new Date(d):null;
      if(t&&!isNaN(t)){
        const g=new Date(t.getTime()+(+r.headers.get('age')||0)*1000);
        if(Math.abs(g-Date.now())>2*36e5)return {ok:false,neden:'Cihaz saatin yanlış görünüyor. Saati otomatiğe alıp tekrar dene.'};
        return {ok:true,t:g};
      }
    }catch(e){}
    return {ok:false,neden:'Saati doğrulamak için internet bağlantısı gerekli.'};
  }
};
function dailyState(now){
  now=now||new Date();
  const D=SAVE.daily||{last:'',streak:0},today=dayKey(now);
  if(D.last>=today)return {claimed:true,streak:D.streak||1};
  const streak=D.last===dayKey(addDays(now,-1))?(D.streak||0)+1:1;
  return {claimed:false,streak};
}
function renderDaily(){
  let el=$('#daily-card');
  if(!el){
    el=document.createElement('div');el.id='daily-card';el.className='daily-card';
    const ch=$('#scr-menu .choices');if(!ch)return;ch.parentNode.insertBefore(el,ch);
  }
  const st=dailyState(),pos=(st.streak-1)%7;
  const dots=DAILY.map((_,i)=>{
    const n=st.streak-pos+i;
    const cls=i<pos||(i===pos&&st.claimed)?'done':i===pos?'now':'';
    return `<li class="${cls}"><span>${i+1}. gün</span><b>${tl(dailyAmt(n))}</b></li>`;
  }).join('');
  const msLeft=addDays(new Date(new Date().setHours(0,0,0,0)),1)-new Date(),hh=Math.floor(msLeft/36e5),mm=Math.floor(msLeft%36e5/6e4);
  el.classList.toggle('ready',!st.claimed);
  el.innerHTML=`<div class="dl-h"><div><span class="kicker">Günlük hediye</span><b class="dl-t">${st.streak} günlük seri</b></div>${st.claimed?`<span class="muted dl-next">Sıradaki hediye ${hh} sa ${mm} dk sonra</span>`:`<button class="btn" id="daily-claim">Hediyeni al · +${tl(dailyAmt(st.streak))}</button>`}</div><ol class="dl-days">${dots}</ol>`;
  const b=$('#daily-claim');
  if(b)b.onclick=async()=>{
    b.disabled=true;
    const z=await Zaman.al();
    if(!z.ok){toast('Hediye alınamadı',z.neden,'info');b.disabled=false;return;}
    const s=dailyState(z.t);
    if(s.claimed){toast('Günlük hediye','Bugünkü hediyeni zaten aldın.','info');renderMenu();return;}
    const amt=dailyAmt(s.streak);
    SAVE.daily={last:dayKey(z.t),streak:s.streak,total:((SAVE.daily&&SAVE.daily.total)||0)+1,ts:Date.now()};
    SAVE.cash+=amt;persist();
    try{SFX.play('chips');}catch(e){}
    toast('Günlük hediye',`+${tl(amt)} cüzdanına eklendi. ${s.streak} günlük serin var.${s.streak%7===0?' Haftalık büyük ödülü aldın!':''}`);
    if(s.streak>=3)Ach.unlock('gunluk3');if(s.streak>=7)Ach.unlock('gunluk7');if(s.streak>=30)Ach.unlock('gunluk30');
    renderMenu();
  };
}
{const rm0=renderMenu;renderMenu=function(){rm0();renderDaily();};}

/* ---------- Haftalık turnuva ---------- */
const WK_PRIZE=[150000,120000,80000];   // 1., 2., 3. için ek ödül (kazanan ayrıca masadaki bütün fişleri alır)
const WK_BUY=100000;
let _wk=null;
function weeklyVenue(){
  const w=weekInfo();
  if(_wk&&_wk.wk===w.k)return _wk;
  const r=mulberry(hashStr(w.k));
  const pool=[...new Map(VENUES.filter(v=>v.lvl>=2&&v.lvl<=8).flatMap(v=>v.rivals).map(x=>[x[0],x])).values()];
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const han=VENUES.find(v=>v.id==='han');
  const levels=HAN_LEVELS.map(([a,b])=>[a/2.5,b/2.5]);
  _wk=Object.assign({},han,{
    weekly:true,wk:w.k,wend:w.end,lvl:0,name:'Haftalık Turnuva',city:'Haftalık',place:'Mahmutpaşa · haftalık turnuva avlusu',
    blurb:'Her pazartesi yeni bir kadro: altı rakip, herkes aynı fişle başlar, körler her altı elde yükselir. Haftada bir kez oynanır.',
    rule:'Turnuva: körler her 6 elde bir yükselir · hafta başına tek hak',
    sb:levels[0][0],bb:levels[0][1],unit:500,levels,blindUp:6,buy:WK_BUY,target:null,tourney:true,skill:.62,rivals:pool.slice(0,6)
  });
  return _wk;
}
function renderWeekly(){
  const host=$('#venues');if(!host)return;
  const old=$('#weekly-card');if(old)old.remove();
  const v=weeklyVenue(),w=SAVE.weekly&&SAVE.weekly.k===v.wk?SAVE.weekly:null,played=!!(w&&w.played);
  const free=SAVE.settings.free,ok=free||SAVE.cash>=WK_BUY;
  const left=v.wend-new Date(),days=Math.floor(left/864e5),hrs=Math.floor(left%864e5/36e5);
  const riv=v.rivals.map(([n])=>`<li><b>${n}</b> <span class="muted">${(CHARS[n]||{}).look||''}</span></li>`).join('');
  const act=played?`<span class="badge won">${w.place?`${w.place}. oldun`:'Bu hafta katıldın'}</span><span class="muted" style="font-size:12px">Yeni turnuva ${days>0?days+' gün ':''}${hrs} saat sonra</span>`
    :ok?`<button class="btn" id="weekly-go">Turnuvaya otur →</button><span class="muted" style="font-size:12px">${days>0?days+' gün ':''}${hrs} saat kaldı</span>`
    :`<span class="badge locked">Paran yetmiyor</span><span class="muted" style="font-size:12px">${tl(WK_BUY-SAVE.cash)} eksik</span>`;
  const html=`<article class="venue weekly" id="weekly-card">
    <div class="sw" aria-hidden="true">★</div>
    <div class="v-body">
      <div class="v-top"><h3 class="v-name">Haftalık Turnuva</h3><span class="v-place">${weekInfo().start.toLocaleDateString('tr-TR',{day:'numeric',month:'long'})} haftası</span></div>
      <p class="v-blurb">${v.blurb}</p>
      <p class="v-rule">${v.rule}</p>
      <div class="v-facts"><span>Giriş <b>${tl(WK_BUY)}</b></span><span>Körler <b>${fmtM(v.sb,'₺')} / ${fmtM(v.bb,'₺')}</b></span><span>Birinci <b>masadaki bütün fişler + ${tl(WK_PRIZE[0])}</b></span><span>İkinci <b>${tl(WK_PRIZE[1])}</b></span><span>Üçüncü <b>${tl(WK_PRIZE[2])}</b></span></div>
      <ul class="v-rivals">${riv}</ul>
    </div>
    <div class="v-act">${act}</div></article>`;
  const wallet=host.querySelector('.wallet');
  // Girebiliyorsan (ya da bu hafta oynadıysan) en üstte; paran yetmiyorsa listenin sonunda: yeni oyuncu önce oturabileceği masayı görsün
  if(!ok&&!played)host.insertAdjacentHTML('beforeend',html);else if(wallet)wallet.insertAdjacentHTML('afterend',html);else host.insertAdjacentHTML('afterbegin',html);
  const b=$('#weekly-go');
  if(b)b.onclick=async()=>{
    b.disabled=true;
    const z=await Zaman.al();
    if(!z.ok){toast('Turnuvaya girilemedi',z.neden,'info');b.disabled=false;return;}
    const wv=weeklyVenue();
    startGame(wv);
    if(G&&G.venue===wv&&G.paid){SAVE.weekly={k:wv.wk,played:true,place:0};persist();Ach.unlock('turnuva');}
  };
}
{const rc0=renderCareer;renderCareer=function(){rc0();renderWeekly();};}
function weeklyEnd(kind){
  const g=G,V=g.venue;
  $('#modal').dataset.lock='1';
  const alive=g.players.filter(p=>!p.human&&!p.out).length;
  const place=kind==='win'?1:alive+1;
  const got=cashOut();
  const prize=g.paid?(WK_PRIZE[place-1]||0):0;
  if(prize)SAVE.cash+=prize;
  if(g.paid){
    SAVE.weekly={k:V.wk,played:true,place};
    if(place===1)SAVE.champs=(SAVE.champs||0)+1;
    Ach.unlock('turnuva');if(place<=3)Ach.unlock('podyum');if(place===1)Ach.unlock('sampiyon');
  }
  persist();
  const ord=['Birinci','İkinci','Üçüncü'][place-1];
  openModal(`<span class="kicker">Haftalık Turnuva</span><h3>${place===1?'Turnuvayı kazandın!':`${place}. sırada bitirdin`}</h3>
    <p>${place===1?`Bütün rakipleri eledin. ${g.handNo} el sürdü.`:`${g.handNo}. elde fişlerin bitti; ${g.players.length} oyuncu arasında ${place}. oldun.`}${g.paid?(got||prize?` ${got?`Fişler bozduruldu: ${tl(got)}. `:''}${prize?`${ord} ödülü: <b>${tl(prize)}</b>. `:''}Cüzdanında artık <b>${tl(SAVE.cash)}</b> var.`:' Giriş ücreti gitti.'):' Serbest moddasın; ödül verilmedi.'}</p>
    <p class="muted">Yeni turnuva önümüzdeki pazartesi.</p>
    <div class="row"><button class="btn" id="m-career">Kariyere dön</button></div>`);
  $('#m-career').onclick=()=>{delete $('#modal').dataset.lock;leaveGame();};
}
{const e0=endModal;endModal=function(kind){if(G&&G.venue.weekly)return weeklyEnd(kind);return e0(kind);};}

/* ---------- Liderlik tablosu ---------- */
function openLider(){
  const B=window.Bulut;if(!B||!B.hazir)return;
  if(!B.giris){
    openModal(`<h3>Liderlik tablosu</h3><p>Tabloya girmek için Google ile giriş yapman gerekir. Tabloda yalnızca seçtiğin takma ad, cüzdanın, oynadığın el sayısı ve fethettiğin masa sayısı görünür; adın, e-postan ya da fotoğrafın görünmez.</p>
      <div class="row"><button class="btn ghost" id="lb-x">Kapat</button><button class="btn" id="lb-login">Google ile giriş</button></div>`);
    $('#lb-x').onclick=closeModal;$('#lb-login').onclick=()=>{closeModal();B.girisYap();};return;
  }
  const L=SAVE.lider||{on:false,ad:B.ad||'Oyuncu'};
  openModal(`<h3>Liderlik tablosu</h3>
    <div class="lb-me"><label class="switch"><input type="checkbox" id="lb-on" ${L.on?'checked':''}><span aria-hidden="true"></span></label><div><b>Tabloda görün</b><small>Kapatırsan kaydın tablodan silinir.</small></div>
    <input id="lb-ad" maxlength="16" value="${(L.ad||'').replace(/"/g,'')}" placeholder="Takma ad" aria-label="Takma ad"></div>
    <p class="muted small-p">Sıralama cüzdandaki toplam paraya göredir. Kayıt cihazda tutulduğu için tablo güven esaslıdır; abartılı sonuçlar silinebilir.</p>
    <ol class="lb-list" id="lb-list"><li class="muted">Yükleniyor…</li></ol>
    <div class="row"><button class="btn" id="lb-x">Kapat</button></div>`);
  $('#lb-x').onclick=closeModal;
  const yukle=async()=>{
    const ul=$('#lb-list');if(!ul)return;
    try{
      const rows=await B.liderListe();
      ul.innerHTML=rows.length?rows.map((r,i)=>`<li class="${r.id===B.uid?'me':''}"><span class="rk">${i+1}</span><b>${String(r.ad||'Oyuncu').replace(/[<>&"]/g,'')}</b><span class="lb-n">${tl(r.net||0)}</span><span class="muted lb-s">${nf.format(r.el||0)} el · ${r.fetih||0} masa${r.sampiyon?` · ${r.sampiyon} şampiyonluk`:''}</span></li>`).join(''):'<li class="muted">Henüz kimse yok. İlk sen ol.</li>';
    }catch(e){
      ul.innerHTML=`<li class="muted">${e&&e.code==='permission-denied'?'Tablo henüz açılmadı (Firestore kuralları güncellenmeli).':'Tablo yüklenemedi.'}</li>`;
    }
  };
  const kaydet=async()=>{
    const on=$('#lb-on').checked,ad=($('#lb-ad').value||'').trim().slice(0,16)||'Oyuncu';
    SAVE.lider={on,ad};persist();
    if(on){const ok=await B.liderYolla(true);if(ok)Ach.unlock('lider');else toast('Tabloya yazılamadı','Firestore kuralları güncellenmemiş olabilir.','info');}
    else await B.liderKaldir();
    yukle();
  };
  $('#lb-on').onchange=kaydet;$('#lb-ad').onchange=()=>{if($('#lb-on').checked)kaydet();else SAVE.lider={on:false,ad:($('#lb-ad').value||'').trim().slice(0,16)};};
  // Açıksa satırı tazele (kurallar sonradan açıldıysa ya da önceki yazma başarısız olduysa kendini düzeltir).
  if(L.on)B.liderYolla(true).then(ok=>{if(ok)Ach.unlock('lider');}).finally(yukle);else yukle();
}
(()=>{
  const b=document.createElement('button');b.className='btn ghost small';b.id='open-lider';b.hidden=true;b.textContent='Liderlik';
  const fb=$('.foot-btns');if(fb)fb.insertBefore(b,$('#open-ach'));
  b.onclick=openLider;
  const goster=()=>{b.hidden=false;};
  if(window.Bulut&&window.Bulut.hazir)goster();else document.addEventListener('bulut-hazir',goster);
})();

/* =====================================================
   EĞİTİM GENİŞLEMESİ
   ===================================================== */
const XQ={odds:{n:0,ok:0,streak:0},pre:{n:0,ok:0,streak:0},outs:{n:0,ok:0,streak:0}};

/* ---- Soru üreticileri: {body, prompt, opts:[[değer,etiket]], ans, why} ---- */
function xqOdds(){
  const T=[[4,'Ortadan kent (gutshot)'],[6,'İki yüksek kart'],[8,'Açık uçlu kent'],[9,'Floş çekilişi'],[12,'Floş çekilişi ve bir yüksek kart'],[15,'Floş ve açık uçlu kent']];
  for(let n=0;n<200;n++){
    const [o,name]=T[Math.floor(rnd()*T.length)],flop=rnd()<.6;
    const pre=[600,800,1000,1200,1600,2000,3000,4000][Math.floor(rnd()*8)],f=[.33,.5,.66,1][Math.floor(rnd()*4)];
    const bet=Math.max(100,Math.round(pre*f/100)*100),pot=pre+bet;
    const po=bet/(pot+bet),eq=flop?1-((47-o)/47)*((46-o)/46):o/46;
    if(Math.abs(eq-po)<.035&&n<199)continue;
    const good=eq>po;
    return {
      body:`<div class="xq-facts"><span>Elin: <b>${name}</b> (${o} out)</span><span>Aşama: <b>${flop?'Flop (iki kart daha gelecek)':'Turn (bir kart daha gelecek)'}</b></span><span>Pot (rakibin bahsi dahil): <b>${tl(pot)}</b></span><span>Görmen gereken: <b>${tl(bet)}</b></span></div>`,
      prompt:'Bu bahsi görmeli misin?',opts:[['gor','Gör'],['cek','Çekil']],ans:good?'gor':'cek',
      why:`Gereken şans: ${tl(bet)} ÷ (${tl(pot)} + ${tl(bet)}) = <b>${pct(po)}</b>. ${flop?'Flop\'tan river\'a':'Turn\'den river\'a'} elini tamamlama şansın <b>${pct(eq)}</b>. ${good?'Şansın gerekenden yüksek: görmek uzun vadede kârlı.':'Şansın gerekenden düşük: görmek uzun vadede kaybettirir.'}`
    };
  }
}
function keyToCards(k){
  const a=RCH.indexOf(k[0]),b=RCH.indexOf(k[1]);
  if(k.length===2)return [a*4,b*4+1];
  return k[2]==='s'?[a*4,b*4]:[a*4,b*4+1];
}
function xqPre(){
  const POS=[['UTG','Erken pozisyon (UTG)'],['MP','Orta pozisyon'],['CO','Cutoff'],['BTN','Buton']];
  const [pk,pn]=POS[Math.floor(rnd()*4)];
  const W=[1,1,1.2,1.5,1.5];let x=rnd()*W.reduce((a,b)=>a+b,0),t=1;
  for(let i=0;i<5;i++){x-=W[i];if(x<=0){t=i+1;break;}}
  let h;
  if(t<=4){const ks=TIER_LIST[t].split(' ');h=keyToCards(ks[Math.floor(rnd()*ks.length)]);}
  else{do{const d=newDeck();h=[d[0],d[1]];}while(handTier(h)!==5);}
  const k=handKey(h),tier=handTier(h);
  const play=tier<=2||(tier===3&&pk!=='UTG')||(tier===4&&(pk==='CO'||pk==='BTN'));
  const rule=tier<=2?'Premium ve güçlü eller her pozisyondan oynanır.':tier===3?'İyi eller orta ve geç pozisyonda oynanır; erken pozisyonda çekilmek daha iyi.':tier===4?'Spekülatif eller yalnızca geç pozisyonda (cutoff, buton) oynanır.':'Zayıf eller çoğu durumda çekilir.';
  return {
    body:`<div class="xq-facts"><span>Pozisyonun: <b>${pn}</b></span><span>Önündekiler: <b>hepsi çekildi</b></span></div><div class="cards">${cardsQ(h)}</div>`,
    prompt:'Ne yaparsın?',opts:[['cek','Çekil'],['gir','Artırarak gir']],ans:play?'gir':'cek',
    why:`${k} başlangıç tablosunda <b>${TIER_NAME[tier]}</b> sınıfında. ${rule}`
  };
}
const OUTS_T=[
  ['Ah 9h','Kh 7h 2c',9,'Floş çekilişi: destede kalan 9 kupa.'],
  ['Jd Tc','9s 8h 2d',8,'Açık uçlu kent: dörtlü ya da yedili bir kart kenti tamamlar (4 + 4).'],
  ['Qh Jc','9s 8h 2d',4,'Ortadan kent: yalnızca dört onlu kenti tamamlar.'],
  ['9h 8h','7h 6h Kc',15,'Floş (9) ve açık uçlu kent (8): iki kart hem floşu hem kenti tamamladığı için 17 değil 15.'],
  ['Ah Kd','9c 7s 2h',6,'İki yüksek kart: üç As ve üç papaz, biri gelirse en yüksek per sende.'],
  ['8h 8d','Ac Ks 2h',2,'Cep per: destede kalan iki sekizli üçlü yapar.']
];
function xqOuts(){
  const [hole,board,o,why]=OUTS_T[Math.floor(rnd()*OUTS_T.length)];
  const pool=[2,4,6,8,9,12,15].filter(v=>v!==o).sort(()=>rnd()-.5).slice(0,3);
  const opts=[o,...pool].sort((a,b)=>a-b).map(v=>[String(v),v+' out']);
  return {
    body:`<div class="qhands"><div class="qhand"><span class="lbl">Senin kartların</span><div class="cards">${cardsQ(pcs(hole))}</div></div><div class="qhand"><span class="lbl">Masa (flop)</span><div class="cards">${cardsQ(pcs(board))}</div></div></div>`,
    prompt:'Elini geliştirecek kaç kart (out) kaldı?',opts,ans:String(o),why:`<b>${o} out.</b> ${why}`
  };
}
function xqWin(){
  const q=genWinner(),ans=q.sa>q.sb?'A':q.sb>q.sa?'B':'=';
  const da=decode(q.sa),db=decode(q.sb);let why;
  if(ans==='=')why='İki oyuncunun en iyi beş kartı aynı değerde; pot bölüşülür.';
  else if(da.cat!==db.cat)why=`A: ${describe(q.sa)}, B: ${describe(q.sb)}. ${CAT[Math.max(da.cat,db.cat)]}, ${CAT[Math.min(da.cat,db.cat)]} elini yener.`;
  else{let i=0;while(i<5&&da.r[i]===db.r[i])i++;const w=ans==='A'?da:db,l=ans==='A'?db:da;why=`İkisi de ${CAT[da.cat]}. Belirleyici kart: ${RTR[w.r[i]]}, ${RTR[l.r[i]]} kartından yüksek.`;}
  return {
    body:`<div class="qhands"><div class="qhand"><span class="lbl">Oyuncu A</span><div class="cards">${cardsQ(q.A)}</div></div><div class="qhand"><span class="lbl">Oyuncu B</span><div class="cards">${cardsQ(q.B)}</div></div></div><div><span class="lbl">Masa</span><div class="cards">${cardsQ(q.board)}</div></div>`,
    prompt:'Kim kazanır?',opts:[['A','Oyuncu A'],['=','Bölüşürler'],['B','Oyuncu B']],ans,why
  };
}
function xqName(){
  const cs=genName(),sc=evalCards(cs),cat=catOf(sc);
  return {
    body:`<div class="qhands"><div class="qhand"><span class="lbl">Senin kartların</span><div class="cards">${cardsQ(cs.slice(0,2))}</div></div><div class="qhand"><span class="lbl">Masa</span><div class="cards">${cardsQ(cs.slice(2))}</div></div></div>`,
    prompt:'En iyi beş kartlık el hangisi?',opts:CAT.map((n,i)=>[String(i),n]),ans:String(cat),why:`En iyi el: <b>${describe(sc)}</b>.`
  };
}

/* ---- Genel alıştırma çalıştırıcısı ---- */
function runQuiz(el,mk,S,opt){
  opt=opt||{};
  const q=mk();SFX.play('deal');
  const head=opt.head||`<div class="qscore"><span>Doğru <b>${S.ok}/${S.n}</b></span><span>Seri <b>${S.streak}</b></span></div>`;
  el.innerHTML=`${head}<div class="qtable xq">${q.body}<p class="xq-p"><b>${q.prompt}</b></p></div>
    <div class="qbtns" id="xq-b">${q.opts.map(([v,l])=>`<button class="btn ghost${q.opts.length>4?' small':''}" data-a="${v}">${l}</button>`).join('')}</div><p class="qfb" id="xq-f"></p>`;
  $$('#xq-b button',el).forEach(b=>b.onclick=()=>{
    const ok=b.dataset.a===q.ans;
    S.n++;if(ok){S.ok++;S.streak++;}else S.streak=0;
    $$('#xq-b button',el).forEach(x=>{x.disabled=true;if(x.dataset.a===q.ans)x.classList.add('right');else if(x===b)x.classList.add('wrong');});
    SFX.play('flip');
    const f=$('#xq-f',el);f.className='qfb '+(ok?'ok':'no');
    f.innerHTML=`${ok?'Doğru!':'Yanlış.'} ${q.why} <button class="btn small" id="xq-n" style="margin-left:8px">${opt.nextLabel||'Yeni soru →'}</button>`;
    $('#xq-n',el).onclick=()=>opt.next?opt.next(ok):runQuiz(el,mk,S,opt);$('#xq-n',el).focus();
    if(opt.answered)opt.answered(ok);
    else{$('.qscore',el).innerHTML=`<span>Doğru <b>${S.ok}/${S.n}</b></span><span>Seri <b>${S.streak}</b></span>`;if(S.streak>=10)Ach.unlock('quiz10');}
  });
}
const quizShell=(id,lead)=>{setTimeout(()=>{const el=$('#'+id);if(el)runQuiz(el,{xqodds:xqOdds,xqpre:xqPre,xqouts:xqOuts}[id],XQ[{xqodds:'odds',xqpre:'pre',xqouts:'outs'}[id]],{answered:ok=>{const S=XQ[{xqodds:'odds',xqpre:'pre',xqouts:'outs'}[id]];$('.qscore',el).innerHTML=`<span>Doğru <b>${S.ok}/${S.n}</b></span><span>Seri <b>${S.streak}</b></span>`;if(id==='xqodds'&&S.streak>=5)Ach.unlock('matematik');if(S.streak>=10)Ach.unlock('quiz10');}});},0);return `<p class="lead">${lead}</p><div class="quiz" id="${id}"></div>`;};
const X_odds=()=>quizShell('xqodds','Rakip bahis yaptı. Elini tamamlama şansın, ödemen gereken orandan yüksek mi? Hesabı kafandan yap, sonra cevabı kontrol et.');
const X_pre=()=>quizShell('xqpre','Önünde herkes çekildi. Elindeki iki kart ve pozisyonun için doğru karar hangisi? Başlangıç elleri ve pozisyon derslerindeki tabloya göre cevapla.');
const X_outs=()=>quizShell('xqouts','Flop açıldı. Elini geliştirecek kaç kart kaldığını say. Out sayısını bildiğinde 2 ve 4 kuralıyla şansını hesaplayabilirsin.');

/* ---- Bitirme sınavı ---- */
const EXAM={i:0,ok:0,seq:[]};
function X_exam(){
  setTimeout(()=>examStart(),0);
  return `<p class="lead">On soru: el sıralaması, kazanan el, pot oranı, out sayma ve başlangıç eli kararı karışık gelir. Sekiz ya da daha fazla doğru yaparsan sınavı geçersin; ilk geçişte ${tl(5000)} ödül kazanırsın.</p><div class="quiz" id="exam"></div>`;
}
function examStart(){
  const el=$('#exam');if(!el)return;
  const g=[xqWin,xqName,xqOdds,xqPre,xqOuts];
  EXAM.i=0;EXAM.ok=0;EXAM.seq=[];
  for(let i=0;i<10;i++)EXAM.seq.push(g[i%5]);
  EXAM.seq.sort(()=>rnd()-.5);
  examNext(el);
}
function examNext(el){
  if(EXAM.i>=10){examEnd(el);return;}
  const S={n:EXAM.i,ok:EXAM.ok,streak:0};
  runQuiz(el,EXAM.seq[EXAM.i],S,{
    head:`<div class="qscore"><span>Soru <b>${EXAM.i+1}/10</b></span><span>Doğru <b>${EXAM.ok}</b></span></div><div class="exam-bar"><i style="width:${EXAM.i*10}%"></i></div>`,
    nextLabel:EXAM.i===9?'Sonucu gör →':'Sonraki soru →',
    answered:ok=>{if(ok)EXAM.ok++;EXAM.i++;},
    next:()=>examNext(el)
  });
}
function examEnd(el){
  const sc=EXAM.ok,pass=sc>=8,first=pass&&!(SAVE.exam&&SAVE.exam.passed);
  SAVE.exam=Object.assign({},SAVE.exam,{best:Math.max(sc,(SAVE.exam&&SAVE.exam.best)||0),passed:pass||(SAVE.exam&&SAVE.exam.passed)||false});
  if(first){SAVE.cash+=5000;Ach.unlock('mezun');}
  persist();
  el.innerHTML=`<div class="exam-res ${pass?'ok':'no'}"><span class="kicker">Sınav sonucu</span><b class="exam-sc">${sc}/10</b><p>${pass?(first?`Tebrikler, sınavı geçtin! Ödül: <b>${tl(5000)}</b> cüzdanına eklendi.`:'Sınavı yine geçtin. Bilgin taze.'):'Geçmek için en az 8 doğru gerekiyor. Eksik kaldığın konuları dersten tekrar edip yeniden dene.'}</p><p class="muted">En iyi sonucun: ${SAVE.exam.best}/10</p><button class="btn" id="exam-again">Sınavı yeniden başla</button></div>`;
  $('#exam-again').onclick=examStart;
}

/* ---- Ders sonu kontrolleri ---- */
function miniCheck(items){
  const id='mc'+Math.random().toString(36).slice(2,7);
  setTimeout(()=>{
    const root=document.getElementById(id);if(!root)return;
    let ok=0,done=0;
    $$('.mc-q',root).forEach((qe,qi)=>{
      const it=items[qi];
      $$('button',qe).forEach(b=>b.onclick=()=>{
        if(qe.dataset.done)return;qe.dataset.done='1';done++;
        const good=+b.dataset.i===it.a;if(good)ok++;
        $$('button',qe).forEach(x=>{x.disabled=true;if(+x.dataset.i===it.a)x.classList.add('right');else if(x===b)x.classList.add('wrong');});
        $('.mc-f',qe).className='mc-f qfb '+(good?'ok':'no');$('.mc-f',qe).innerHTML=`${good?'Doğru!':'Yanlış.'} ${it.w}`;
        if(done===items.length)$('.mc-sum',root).textContent=`Ders kontrolü: ${ok}/${items.length} doğru`;
        SFX.play('flip');
      });
    });
  },0);
  return `<div class="minicheck" id="${id}"><h3>Kendini dene</h3>${items.map(it=>`<div class="mc-q"><p><b>${it.q}</b></p><div class="mc-o">${it.o.map((o,i)=>`<button class="btn ghost small" data-i="${i}">${o}</button>`).join('')}</div><p class="mc-f qfb"></p></div>`).join('')}<p class="mc-sum muted"></p></div>`;
}
const MINI={
  eller:[
    {q:'Ful mu, floş mu daha güçlüdür?',o:['Floş','Ful'],a:1,w:'Sıralama: Yüksek kart, Per, Döper, Üçlü, Kent, Floş, Ful, Kare… Ful, floşun üstünde.'},
    {q:'İki oyuncu da kent yaptı: biri 5-9, öbürü 6-10. Kim kazanır?',o:['5-9 kenti','6-10 kenti','Pot bölüşülür'],a:1,w:'Kentlerde yüksek uçtaki kart belirler; 10, 9\'dan yüksek.'}
  ],
  hamle:[
    {q:'Önünde bahis yokken para koymadan sıranı geçmenin adı nedir?',o:['Çekilmek','Kontrol (check)','Artırmak'],a:1,w:'Kontrol, bahis yoksa bedava devam etmektir.'},
    {q:'Rakip 1.000 bahis yaptı, sen 3.000\'e çıkardın. Bu hamlenin adı?',o:['Görmek (call)','Artırmak (raise)','Kontrol'],a:1,w:'Mevcut bahsin üstüne koymak artırmaktır.'}
  ],
  pozisyon:[
    {q:'Altı kişilik masada en avantajlı pozisyon hangisi?',o:['Erken pozisyon (UTG)','Küçük kör','Buton'],a:2,w:'Butondaki oyuncu flop sonrası her turda son konuşur ve herkesin hamlesini görür.'},
    {q:'Neden erken pozisyonda daha sıkı oynanır?',o:['Kartlar kötü gelir','Arkanda çok oyuncu var ve hepsi senden sonra karar verecek','Kural böyle'],a:1,w:'Bilgin azdır ve senden sonra konuşan çok kişi güçlü bir elle karşılık verebilir.'}
  ],
  olasilik:[
    {q:'Flop\'tasın ve 9 out\'un var. 4 kuralıyla yaklaşık şansın?',o:['%18','%27','%36','%45'],a:2,w:'9 × 4 = %36. Turn\'de 2 ile çarpardın.'},
    {q:'Pot 3.000 (bahis dahil), görmen gereken 1.000. Gereken şans?',o:['%20','%25','%33','%50'],a:1,w:'1.000 ÷ (3.000 + 1.000) = %25.'}
  ],
  blof:[
    {q:'Hangi rakibe blöf yapmak en mantıksız?',o:['Her şeyi gören gevşek oyuncu','Çok az el oynayan kaya','Sıkı oynayıp çekilen oyuncu'],a:0,w:'Gevşek oyuncu hemen hemen her bahsi görür; çekilmeyene blöf para yakar.'},
    {q:'Yarı-blöf nedir?',o:['Elin hiçbir şey olmadan bahis yapmak','Tamamlanmamış ama güçlü bir çekilişle bahis yapmak','Bahsin yarısını geri çekmek'],a:1,w:'Yarı-blöfte iki yoldan kazanırsın: rakip çekilir ya da elini tamamlarsın.'}
  ],
  tell:[
    {q:'Bir rakibin davranışını yorumlamadan önce ilk ne yapmalısın?',o:['Güçlü el olduğunu varsay','Onun normal davranışını öğren','Hemen blöf yap'],a:1,w:'Tell, normalden sapmadır. Önce normali bilmen gerekir.'},
    {q:'Bahisten sonra kıpırdamadan, dik dik bakan bir oyuncu genelde?',o:['Blöf yapıyor olabilir','Mutlaka güçlüdür','Çekilecektir'],a:0,w:'Yakalanma korkusu bedeni dondurur; dik bakış "beni görme" demektir.'}
  ]
};

/* ---- Yeni dersler ---- */
function X_bahis(){
  setTimeout(()=>{
    const f=()=>{
      const pot=Math.max(1,+$('#b-pot').value||0),bet=Math.max(0,+$('#b-bet').value||0);
      const need=bet/(pot+2*bet),fold=bet/(pot+bet);
      $('#b-need').textContent=pct(need);$('#b-fold').textContent=pct(fold);$('#b-frac').textContent=bet?`Potun %${Math.round(bet/pot*100)}'i`:'—';
    };
    $$('#bcalc input').forEach(x=>x.oninput=f);f();
  },0);
  const row=(n,fr)=>`<tr><td>${n}</td><td>${pct(fr/(1+2*fr))}</td><td>${pct(fr/(1+fr))}</td></tr>`;
  return `<p class="lead">Bahis büyüklüğü, rakibine sunduğun fiyattır. Küçük bahis rakibi içeri çeker; büyük bahis zayıf elleri ve çekilişleri dışarı iter. Doğru fiyatı seçmek kazancını belirler.</p>
  <h3>Üç amaç</h3>
  <ul>
    <li><b>Değer bahsi (value bet):</b> Elinin daha zayıf ellerce görülmesini istersin. Bu yüzden rakibin ödeyebileceği, çekilmeyeceği bir miktar yaparsın.</li>
    <li><b>Blöf:</b> Daha iyi elleri çekilmeye zorlarsın. Bahis büyüdükçe işin zorlaşır, çünkü rakip daha sık çekilmelidir.</li>
    <li><b>Koruma:</b> Güçlü elin varken çekilişlere pahalı bir fiyat çıkarırsın; bedavaya kart görmelerine izin vermezsin.</li>
  </ul>
  <h3>Rakibine hangi fiyatı veriyorsun?</h3>
  <p>Pota göre bahis yaptığında rakibin görmek için gereken şans ve senin blöfünün işe yaraması için rakibin çekilmesi gereken sıklık şöyledir:</p>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Bahis</th><th>Rakibin gereken şansı</th><th>Blöfün için gereken çekilme</th></tr></thead><tbody>${row('Potun 1/3\'ü',1/3)}${row('Potun yarısı',.5)}${row('Potun 2/3\'ü',2/3)}${row('Pot kadar',1)}${row('Potun iki katı',2)}</tbody></table></div>
  <div class="calc" id="bcalc">
    <div class="calc-in"><label for="b-pot">Pot (bahis öncesi)<input id="b-pot" type="number" min="1" value="2000"></label><label for="b-bet">Senin bahsin<input id="b-bet" type="number" min="0" value="1000"></label></div>
    <div class="calc-out"><div><span>Bahis büyüklüğü</span><b id="b-frac"></b></div><div><span>Rakibin gereken şansı</span><b id="b-need"></b></div><div><span>Blöfün için gereken çekilme</span><b id="b-fold"></b></div></div>
  </div>
  <h3>Pratik kurallar</h3>
  <ul>
    <li>Kuru tahtada (bağlantısız, yüksek kartlı) küçük bahis (1/3 pot) çoğu zaman yeter. Islak tahtada (floş ve kent ihtimali) 2/3 pot ve üstüne çık.</li>
    <li>Aynı elde bahis büyüklüğünü her seferinde değiştirirsen okunursun. Güçlü el ve blöf için aynı aralığı kullan.</li>
    <li>River'da çok büyük bahis, yalnızca çok güçlü ellerden ya da bilerek yapılmış blöflerden gelir; rakibin çekilişleri tamamlandıysa ya da bittiyse hikâyen buna uymalı.</li>
    <li>Pre-flop'ta standart artış büyük körün 2,5-3 katıdır. Önünde artış varsa üç dört katını yap.</li>
  </ul>
  <div class="callout"><b>Hatırla</b> Rakibin her bahsinde kendine sor: "Bana hangi fiyatı veriyor ve şansım bu fiyata değiyor mu?" Pot oranı dersindeki hesapla aynı mantık.</div>`;
}
function X_flop(){
  return `<p class="lead">Flop açıldı. Pre-flop'ta kartların güçlüydü; şimdi onlar tahtayla nasıl buluştu? Flop sonrası oyunun özü üç soruya dayanır: elim ne, tahta ne anlatıyor, rakip ne istiyor?</p>
  <h3>Tahtayı oku</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Tahta</th><th>Örnek</th><th>Anlamı</th><th>Genel plan</th></tr></thead><tbody>
    <tr><td><b>Kuru</b></td><td>${ic('Kc 7d 2s')}</td><td>Bağlantısız, çekiliş az. Papaz-yüksek tahta pre-flop'ta artıranın lehine.</td><td>Küçük bahisle potu al; sık devam bahsi yap.</td></tr>
    <tr><td><b>Islak</b></td><td>${ic('9h 8h 6c')}</td><td>Floş ve kent çekilişi çok. Birçok el güçlü ya da yakın.</td><td>İyi elinle büyük bahis yap; zayıf elinle seçici ol.</td></tr>
    <tr><td><b>Çift</b></td><td>${ic('Qc Qd 4h')}</td><td>Üçlü ya da ful ihtimali; çekiliş az.</td><td>Blöf için güzel tahta, ama Q'su olan seni geçebilir.</td></tr>
    <tr><td><b>Tek renk</b></td><td>${ic('Ah 8h 3h')}</td><td>Floşu olan çok güçlü. Floşun yoksa dikkat.</td><td>Floş yoksa küçük ya da bedava kart; floş varsa değer bahsi.</td></tr>
  </tbody></table></div>
  <h3>Devam bahsi (c-bet)</h3>
  <p>Pre-flop'ta artıran sensen, flop'ta çoğu zaman ilk bahsi sen yaparsın. Buna devam bahsi denir. Rakip çoğu zaman flop'u ıskalar, bu yüzden küçük bir bahisle potu almak kârlıdır. Ama her flop'ta otomatik bahis yapma:</p>
  <ul>
    <li>Rakip sayısı arttıkça işe yaramaz: üç kişiye karşı bir kişi mutlaka bir şey tutmuştur.</li>
    <li>Tahta rakibin aralığına uygunsa (düşük, bağlantılı kartlar, sen yüksek kartla artırdıysan) blöfün tutmaz.</li>
    <li>Çok sabit bir rakibe (kaya) sık devam bahsi iyi gider; çok gören (gevşek) rakibe blöf yapma, güçlü elini büyük oyna.</li>
  </ul>
  <h3>Elinin türü, planını belirler</h3>
  <ul>
    <li><b>Çok güçlü (üçlü, ful, yüksek per):</b> Pot büyüt. Tahta ıslaksa hemen bahis yap; kuruysa bazen tuzak kurabilirsin.</li>
    <li><b>Orta (üst-orta per, zayıf kicker):</b> Pot kontrolü. Küçük bahsi gör, büyük bahse ve çok sayıda artışa dikkat et. Turn ve river'da potun büyümesini istemezsin.</li>
    <li><b>Çekiliş (floş, kent):</b> Pot oranına bak; ucuzsa gör, rakip zayıfsa yarı-blöf yap.</li>
    <li><b>Hiçbir şey:</b> Çekil, ya da yalnızca iyi bir blöf hikâyen varsa bahis yap.</li>
  </ul>
  <h3>Turn ve river</h3>
  <ul>
    <li>Turn'de bahsin iki sokak boyunca hikâye anlatır. Blöf yapacaksan river'da da yapmaya hazır ol; yoksa turn'de vazgeç.</li>
    <li>River'da çekiliş kalmaz; yalnızca elinin gücüne bakılır. Elin orta güçteyse küçük bahsi gör, büyük bahiste çekil.</li>
    <li>Tahtaya gelen kart rakibin çekilişini tamamladıysa (üçüncü kupa, dörtlü kent) güçlü elini temkinle oyna.</li>
  </ul>
  <div class="callout"><b>Antrenman masasında</b> Koç her sokakta elinin ne olduğunu ve çekilişlerini yazar. Bunu bir dizi bahis boyunca izle.</div>`;
}
function X_turnuva(){
  setTimeout(()=>{
    const f=()=>{
      const stack=+$('#m-st').value||0,sb=+$('#m-sb').value||0,bb=+$('#m-bb').value||0,ante=+$('#m-an').value||0,n=Math.max(2,+$('#m-n').value||6);
      const cost=sb+bb+ante*n,M=cost>0?stack/cost:0;
      const z=M>20?['Yeşil','Rahatsın. Normal oyna, çekilişlerin peşinden gidebilirsin.','ok']:M>10?['Sarı','Dikkat. Spekülatif ellerden kaçın, güçlü ellerle bahsi büyüt.','mid']:M>6?['Turuncu','Daralıyorsun. Oynayacaksan artırarak gir; ardından pot oranlarını gözet.','mid']:M>1?['Kırmızı','Tehlike. Ya tüm fişi koy (push) ya çekil (fold); araya girmek işe yaramaz.','no']:['Ölü','Fişlerin bir turluk körü bile karşılamıyor. Elini bekleme, hemen all-in.','no'];
      $('#m-val').textContent=M.toFixed(1).replace('.',',');$('#m-bb2').textContent=(bb?stack/bb:0).toFixed(0)+' büyük kör';
      const v=$('#m-v');v.className='verdict '+z[2];v.innerHTML=`<b>${z[0]} bölge.</b> ${z[1]}`;
    };
    $$('#mcalc input').forEach(x=>x.oninput=f);f();
  },0);
  return `<p class="lead">Turnuva, normal masadan farklıdır: fişlerin nakde çevrilmez, körler yükselir ve biri elenene kadar oyun sürer. Oyundaki Han Turnuvası ve Haftalık Turnuva bu kurallarla oynanır.</p>
  <h3>Körler yükselir</h3>
  <p>Her birkaç elde körler artar. Bekleyen biri körlere yenilir; fişlerin eridikçe seçeneklerin azalır. Bu yüzden turnuvada pasif kalmak da bir risktir.</p>
  <h3>M oranı: ne kadar vaktin var?</h3>
  <p><b>M = fişin ÷ bir turun maliyeti</b> (küçük kör + büyük kör + anteler). M, "hiçbir el oynamadan kaç tur dayanırım" sorusunun cevabıdır.</p>
  <div class="calc" id="mcalc">
    <div class="calc-in"><label for="m-st">Fişin<input id="m-st" type="number" min="0" value="60000"></label><label for="m-sb">Küçük kör<input id="m-sb" type="number" min="0" value="2000"></label><label for="m-bb">Büyük kör<input id="m-bb" type="number" min="0" value="4000"></label><label for="m-an">Ante (kişi başı)<input id="m-an" type="number" min="0" value="0"></label><label for="m-n">Oyuncu sayısı<input id="m-n" type="number" min="2" max="9" value="6"></label></div>
    <div class="calc-out"><div><span>M oranı</span><b id="m-val"></b></div><div><span>Büyük kör cinsinden</span><b id="m-bb2"></b></div></div>
    <div class="verdict" id="m-v"></div>
  </div>
  <h3>Bölgelere göre plan</h3>
  <ul>
    <li><b>M &gt; 20 (yeşil):</b> Normal poker. Pozisyon ve çekiliş oyunu işe yarar.</li>
    <li><b>M 10-20 (sarı):</b> Küçük perlerle yalnızca ucuza flop gör; güçlü ellerle bahsi büyüt.</li>
    <li><b>M 6-10 (turuncu):</b> Flop sonrası oynamak zorlaşır; ya pre-flop'ta artır ya çekil.</li>
    <li><b>M &lt; 6 (kırmızı):</b> Push ya da fold. Fişlerinin hepsini sürmek (all-in) kalan tek hamlendir; hangi elle sürdüğün pozisyona bağlı: butonda geniş, erken pozisyonda dar.</li>
  </ul>
  <h3>Kabarcık ve uç durumlar</h3>
  <ul>
    <li><b>Kabarcık:</b> Ödül sıralamasının hemen dışında kalma noktası. Fişi az olan çekilmek ister, fişi çok olan baskı kurar.</li>
    <li><b>Kısa fişli (short stack):</b> Çekilmesi, elenmek kadar kötüdür. Kendi açından hâlâ güçlü bir el yakaladığında koy.</li>
    <li><b>Çok fişli (chip leader):</b> Küçük fişlilere baskı kur, ama kendinden güçlüsüne karşı büyük potlardan kaçın.</li>
  </ul>
  <div class="callout"><b>Haftalık Turnuva</b> Kariyer ekranında. Hafta başına bir hak, giriş ${tl(WK_BUY)}. Birinci olan masadaki bütün fişleri alır ve ${tl(WK_PRIZE[0])} ek ödül kazanır.</div>`;
}
const GLOS=[
  ['All-in','Bütün fişleri bahse koymak.'],['Ante','Her elde herkesin zorunlu koyduğu küçük bahis.'],['Blöf','Zayıf eli güçlüymüş gibi oynayıp rakibi çekilmeye zorlamak.'],
  ['Board (tahta)','Ortadaki ortak kartlar.'],['Buton','Dealer işareti. En avantajlı pozisyon, her turda son konuşur.'],['Büyük kör (BB)','Dealer\'ın iki solundaki oyuncunun zorunlu bahsi.'],
  ['C-bet (devam bahsi)','Pre-flop\'ta artıranın flop\'ta yaptığı ilk bahis.'],['Call (gör)','Mevcut bahsi eşitlemek.'],['Check (kontrol)','Bahis yokken para koymadan sırayı geçmek.'],
  ['Check-raise','Önce kontrol edip rakip bahis yapınca artırmak. Güçlü el ya da blöf.'],['Çekiliş (draw)','Henüz tamamlanmamış güçlü el: floş, kent gibi.'],['Cutoff (CO)','Butonun sağındaki, ikinci en avantajlı pozisyon.'],
  ['Fold (çekil)','Elini atıp turdan çıkmak.'],['Flop','İlk üç ortak kart.'],['Gutshot','Ortadan kent çekilişi; yalnızca tek kart tamamlar (4 out).'],
  ['İma edilen oran','Elini tamamladığında rakipten alacağın ek parayı hesaba katan pot oranı.'],['Kicker','Aynı çiftli iki elde sonucu belirleyen yan kart.'],['Küçük kör (SB)','Dealer\'ın solundaki oyuncunun yarım zorunlu bahsi.'],
  ['M oranı','Fişin ÷ bir turun maliyeti; turnuvada ne kadar vaktin kaldığı.'],['Nuts','Masada mümkün olan en güçlü el.'],['Offsuit (o)','Farklı renkten iki kart.'],['Out','Elini kazanan ele çevirecek kart.'],
  ['Overbet','Pottan büyük bahis.'],['Overcard','Masadaki tüm kartlardan yüksek kart.'],['Pot oranı','Görmen gereken ÷ (pot + görmen gereken). Gereken şansı verir.'],
  ['Push / fold','Fişin azken yalnızca all-in ya da çekilmek.'],['Raise (artır)','Mevcut bahsin üzerine koymak.'],['River','Beşinci ve son ortak kart.'],
  ['Slowplay (tuzak)','Güçlü eli zayıf göstermek için kontrol etmek ya da görmek.'],['Suited (s)','Aynı renkten iki kart.'],['Tell','Rakibin elini ele veren davranış.'],
  ['Tilt','Kötü bir sonuçtan sonra duygusal ve fazla agresif oynamak.'],['Turn','Dördüncü ortak kart.'],['UTG','Büyük körün solundaki ilk konuşan; en dezavantajlı pozisyon.'],
  ['Value bet (değer bahsi)','Daha zayıf elin görmesini umarak yapılan bahis.'],['Yarı-blöf','Tamamlanmamış güçlü bir çekilişle yapılan bahis.']
];
function X_sozluk(){
  setTimeout(()=>{
    const q=$('#gl-q');if(!q)return;
    q.oninput=()=>{const t=q.value.toLocaleLowerCase('tr-TR');$$('#gl-list li').forEach(li=>{li.hidden=!li.textContent.toLocaleLowerCase('tr-TR').includes(t);});};
  },0);
  return `<p class="lead">Poker terimleri İngilizce yerleşmiştir. Dersler boyunca geçen kelimeleri burada ara.</p>
  <input id="gl-q" class="gl-q" type="search" placeholder="Terim ara…" aria-label="Terim ara">
  <ul class="gl-list" id="gl-list">${GLOS.map(([a,b])=>`<li><b>${a}</b><span>${b}</span></li>`).join('')}</ul>`;
}

/* ---- Derslere ekle ---- */
(()=>{
  const L=LESSONS;
  for(const id in MINI){const l=L.find(x=>x.id===id);if(l){const r0=l.r;l.r=()=>r0()+miniCheck(MINI[id]);}}
  const at=(after,item)=>{const i=L.findIndex(x=>x.id===after);L.splice(i+1,0,item);};
  at('olasilik',{id:'bahis',g:'Dersler',t:'Bahis büyüklüğü',r:X_bahis});
  at('pozisyon',{id:'flop',g:'Dersler',t:'Flop sonrası oyun',r:X_flop});
  at('bahis',{id:'turnuva',g:'Dersler',t:'Turnuva ve M oranı',r:X_turnuva});
  at('tell',{id:'sozluk',g:'Dersler',t:'Poker sözlüğü',r:X_sozluk});
  at('quiz2',{id:'xqodds',g:'Alıştırmalar',t:'Gör ya da çekil? (pot oranı)',r:X_odds});
  at('xqodds',{id:'xqouts',g:'Alıştırmalar',t:'Kaç out var?',r:X_outs});
  at('xqouts',{id:'xqpre',g:'Alıştırmalar',t:'Başlangıç eli kararı',r:X_pre});
  at('xqpre',{id:'sinav',g:'Alıştırmalar',t:'Bitirme sınavı',r:X_exam});
})();
// Menü açıklaması ve ilerleme çubuğu
{
  const d=document.querySelector('#go-learn .ch-d');
  if(d)d.textContent=`${LESSONS.filter(l=>l.g==='Dersler').length} ders: kurallar, el sıralaması, pozisyon, olasılık, bahis, blöf, beden dili ve turnuva. Pot oranı ve başlangıç eli alıştırmaları, bitirme sınavı. Olasılık ve öneri veren koç yalnızca alıştırma masalarında.`;
  const rn0=renderNav;
  renderNav=function(){
    rn0();
    const n=LESSONS.length,d=LESSONS.filter(l=>SAVE.seen.includes(l.id)).length;
    const s=$('#learn-sum');if(s)s.innerHTML=`${d}/${n} bölüm tamamlandı <span class="lbar"><i style="width:${Math.round(d/n*100)}%"></i></span>`;
  };
}
