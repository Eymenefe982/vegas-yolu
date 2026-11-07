'use strict';
/* ================= Online masalar =================
   Google ile giriş yapan oyuncular masa kurar, masaları listeden bulup katılır ve gerçek kişilerle oynar.
   Masayı kuran oyuncunun tarayıcısı oyunu yönetir (online-motor.js); diğerleri hamlelerini Firestore üzerinden iletir.
   Herkese açık durum: vegasMasa/{id}.oyun · özel kartlar: vegasMasa/{id}/el/{uid} · hamleler: .../hamle/{uid}
   katılma isteği: .../katil/{uid} · mesajlar: .../mesaj/{id}. Kurallar firestore.rules dosyasındadır.
   Masa kapanınca kurucu masa ve alt belgelerini silmeye çalışır (KVKK: veri gereğinden uzun tutulmaz). */
(()=>{
  const root=document.getElementById('online-root');if(!root)return;
  const scr=document.getElementById('scr-online');
  const KAD='vegasYolu.onlineAd',KOK='vegasYolu.onlineUyari',UV='1';
  const web=/^https?:$/.test(location.protocol)&&location.hostname!=='appassets.androidplatform.net';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
  const B=()=>window.Bulut||null;
  const F=()=>B()&&B().fb,D=()=>B()&&B().db;
  const mdoc=(id,...p)=>F().doc(D(),'vegasMasa',id,...p);
  const mcol=(id,...p)=>F().collection(D(),'vegasMasa',id,...p);
  const fresh=t=>{if(!t)return true;const ms=t.toMillis?t.toMillis():+t;return Date.now()-ms<90000;};

  let view='lobi',tables=[],unList=null,pollT=0;
  let draft={ad:'',mesaj:'',maxKoltuk:6,chipTL:5,baslangic:100,turSn:45};
  let M=null;                       // etkin masa oturumu
  let err='';

  /* ---------- Ortak ---------- */
  const myName=()=>{const n=(lsGet(KAD)||'').trim();return (n||(B()&&B().ad)||'Oyuncu').slice(0,16);};
  const myAva=()=>{try{return JSON.stringify(typeof avaGet==='function'?avaGet():{}).slice(0,400);}catch(e){return '{}';}};
  const parseAva=s=>{if(!s)return null;if(typeof s==='object')return s;try{return JSON.parse(s);}catch(e){return null;}};
  const avaHTML=(a,px)=>typeof avatarSVG==='function'?avatarSVG(Object.assign({},AVA_DEF,parseAva(a)||{}),px):'';
  const fm=x=>{const t=(M&&M.cfg&&M.cfg.chipTL)||5;return Math.round(x*t).toLocaleString('tr-TR')+' ₺';};
  const sfx=n=>{try{if(window.SFX)SFX.play(n);}catch(e){}};

  /* ---------- Giriş / uyarı ---------- */
  function uyariVar(){return lsGet(KOK)===UV;}
  function uyariGoster(onOk){
    openModal(`<span class="kicker">Online mod</span><h3>Başlamadan önce</h3>
      <ul class="on-warn">
        <li><b>18 yaş ve üzeri</b> içindir. Oyun eğlence ve rekabet amaçlıdır; kumarı özendirmez. <b>Gerçek para yoktur</b>, çipler sanaldır.</li>
        <li>Takma adın, karakterin ve masaya yazdığın <b>mesajlar masadaki herkese görünür</b>. Kişisel bilgini (gerçek ad, telefon, adres) yazma.</li>
        <li>Mesajlar ve masa bilgisi masa açık kaldığı sürece sunucuda tutulur; masa kapanınca silinmesi için işlem yapılır (KVKK aydınlatma metninde ayrıntı var).</li>
        <li>Masayı kuran oyuncunun cihazı oyunu yönetir; kurucu çıkarsa masa kapanır. Başkalarına saygılı ol, küfür ve taciz yasak. Masa kurucusu seni masadan çıkarabilir.</li>
      </ul>
      <div class="row"><button class="btn ghost" id="on-no">Vazgeç</button><button class="btn" id="on-ok">Anladım, devam et</button></div>`);
    $('#on-no').onclick=()=>{closeModal();show('scr-menu');};
    $('#on-ok').onclick=()=>{lsSet(KOK,UV);closeModal();onOk();};
  }

  /* ---------- Lobi ---------- */
  function listenLobby(){
    stopLobby();
    if(!F()||!B().giris)return;
    try{
      const q=F().query(F().collection(D(),'vegasMasa'),F().where('durum','in',['bekliyor','oyunda']),F().limit(40));
      unList=F().onSnapshot(q,s=>{
        tables=s.docs.map(d=>Object.assign({id:d.id},d.data())).filter(t=>fresh(t.nabiz));
        tables.sort((a,b)=>(b.oyuncu||0)-(a.oyuncu||0));
        err='';if(view==='lobi'&&!M)renderLobi();
      },e=>{err='Masalar okunamadı. Firestore kuralları güncellenmemiş olabilir.';console.warn(e);if(view==='lobi'&&!M)renderLobi();});
    }catch(e){console.warn(e);}
    cleanupMine();
  }
  function stopLobby(){if(unList){try{unList();}catch(e){}unList=null;}}
  // Önceki oturumlardan kalan kendi masalarımı (ve mesajlarını) sil
  async function cleanupMine(){
    try{
      const q=F().query(F().collection(D(),'vegasMasa'),F().where('kurucu','==',B().uid),F().limit(20));
      const s=await F().getDocs(q);
      for(const d of s.docs){if(M&&M.id===d.id)continue;await deleteTable(d.id);}
    }catch(e){console.warn('Eski masalar temizlenemedi',e);}
  }
  async function deleteTable(id){
    for(const sub of ['el','hamle','katil','mesaj']){
      try{const s=await F().getDocs(mcol(id,sub));for(const d of s.docs)await F().deleteDoc(d.ref);}catch(e){}
    }
    try{await F().deleteDoc(mdoc(id));}catch(e){console.warn(e);}
  }

  function renderLobi(){
    view='lobi';
    if(!web){root.innerHTML=`<div class="cs-card"><h3 class="cs-h">Online mod yalnızca web sürümünde</h3><p class="cs-sub">Masaüstü ve telefon uygulaması bu özelliği içermez. Tarayıcıdan oyunu aç ve Google ile giriş yap.</p></div>`;return;}
    if(!B()||!B().hazir){root.innerHTML=`<div class="cs-card"><p class="cs-sub">Bağlantı hazırlanıyor…</p></div>`;return;}
    if(!B().giris){root.innerHTML=`<div class="cs-card"><h3 class="cs-h">Giriş yap</h3><p class="cs-sub">Online masalar için Google ile giriş gerekir. Adın başkalarına gösterilmez; aşağıda bir takma ad seçersin.</p><div class="cs-go"><button class="btn" id="on-login">Google ile giriş</button></div></div>`;return;}
    const rows=tables.map(t=>{
      const full=(t.oyuncu||0)>=(t.maxKoltuk||6);
      return `<article class="cs-card on-tbl"><div class="on-th"><h4>${esc(t.ad)}</h4><span class="on-st ${t.durum==='oyunda'?'live':''}">${t.durum==='oyunda'?'Oyunda':'Bekliyor'}</span></div>
        <p class="cs-sub">Kuran: <b>${esc(t.kurucuAd)}</b> · ${t.oyuncu||0}/${t.maxKoltuk} oyuncu · Başlangıç ${(t.baslangic*t.chipTL).toLocaleString('tr-TR')} ₺ (${t.baslangic} çip) · Süre ${t.turSn} sn</p>
        ${t.mesaj?`<p class="on-msg">“${esc(t.mesaj)}”</p>`:''}
        <div class="cs-go"><button class="btn small" data-join="${esc(t.id)}" ${full?'disabled':''}>${full?'Masa dolu':'Katıl'}</button></div></article>`;
    }).join('');
    root.innerHTML=`<div class="cs-card on-me"><label>Takma adın<input type="text" id="on-ad" maxlength="16" autocomplete="off" value="${esc(myName())}"></label>
        <button class="btn" id="on-new">+ Masa kur</button></div>
      ${err?`<p class="cs-sub on-err">${esc(err)}</p>`:''}
      <h3 class="cs-h">Açık masalar</h3>
      ${rows||'<div class="cs-card"><p class="cs-sub">Şu an açık masa yok. İlk masayı sen kur, arkadaşların listeden bulup katılsın.</p></div>'}
      <p class="cs-sub on-note">Online mod eğlence ve rekabet içindir; gerçek para yoktur. Mesajların masadaki herkese görünür.</p>`;
  }

  /* ---------- Masa kurma ---------- */
  function renderKur(){
    view='kur';
    const d=draft,t=Math.max(1,+d.chipTL||5);
    root.innerHTML=`<div class="cs-card"><h3 class="cs-h">1 · Masanın adı ve mesajı</h3>
        <label class="on-f">Masa adı<input type="text" id="k-ad" maxlength="30" value="${esc(d.ad||myName()+' masası')}"></label>
        <label class="on-f">Karşılama mesajı (listede görünür)<input type="text" id="k-msg" maxlength="140" placeholder="Örn: Yeni başlayanlar da gelebilir, keyifli bir masa!" value="${esc(d.mesaj)}"></label></div>
      <div class="cs-card"><h3 class="cs-h">2 · Kaç kişilik?</h3>
        <div class="cs-count">${[2,3,4,5,6,7,8,9].map(k=>`<button type="button" class="cs-n${k===d.maxKoltuk?' on':''}" data-k="${k}">${k}</button>`).join('')}</div></div>
      <div class="cs-card"><h3 class="cs-h">3 · Bir çip kaç ₺?</h3>
        <div class="cs-stack">${[1,5,10,25].map(k=>`<button type="button" class="cs-n${k===+d.chipTL?' on':''}" data-c="${k}">${k} ₺</button>`).join('')}
        <label class="cs-custom">Başka:<input type="number" inputmode="decimal" min="1" max="100000" id="k-ctl" value="${d.chipTL}"><em>₺</em></label></div>
        <p class="cs-rule">Sanal para: <b>1 çip = ${t} ₺</b> · küçük kör <b>1 çip (${t} ₺)</b> · büyük kör <b>2 çip (${2*t} ₺)</b></p></div>
      <div class="cs-card"><h3 class="cs-h">4 · Başlangıç parası</h3>
        <div class="cs-stack">${[50,100,200,500].map(k=>`<button type="button" class="cs-n wide${k===d.baslangic?' on':''}" data-s="${k}">${(k*t).toLocaleString('tr-TR')} ₺<small>${k} çip</small></button>`).join('')}</div></div>
      <div class="cs-card"><h3 class="cs-h">5 · Hamle süresi</h3>
        <div class="cs-stack">${[20,30,45,60].map(k=>`<button type="button" class="cs-n${k===d.turSn?' on':''}" data-t="${k}">${k} sn</button>`).join('')}</div>
        <p class="cs-sub">Süre dolunca oyuncu otomatik pas geçer ya da çekilir.</p></div>
      <div class="cs-go"><button class="btn ghost" id="k-back">Vazgeç</button><button class="btn" id="k-go">Masayı aç →</button></div>`;
  }
  function readKur(){
    const v=id=>{const e=document.getElementById(id);return e?e.value:'';};
    draft.ad=v('k-ad').trim();draft.mesaj=v('k-msg').trim();
    const c=+v('k-ctl');if(c>0)draft.chipTL=Math.min(100000,c);
  }

  async function createTable(){
    readKur();
    const ad=(draft.ad||myName()+' masası').slice(0,30);
    const data={kurucu:B().uid,kurucuAd:myName(),ad,mesaj:draft.mesaj.slice(0,140),maxKoltuk:draft.maxKoltuk,baslangic:draft.baslangic,chipTL:Math.max(1,Math.round(draft.chipTL)),turSn:draft.turSn,
      durum:'bekliyor',oyuncu:1,oyun:'',nabiz:F().serverTimestamp(),olusturma:F().serverTimestamp()};
    try{
      const ref=await F().addDoc(F().collection(D(),'vegasMasa'),data);
      startHost(ref.id,data);
    }catch(e){console.warn(e);err='Masa açılamadı. Firestore kuralları güncellenmemiş olabilir.';renderLobi();}
  }

  /* ---------- Masa oturumu (ortak) ---------- */
  function newSession(id,cfg,host){
    M={id,host,cfg,pub:null,hole:null,chat:[],seq:0,unsubs:[],ticker:0,say:{},raiseTo:0,closed:false,lastSend:0};
    return M;
  }
  function listenCommon(){
    const id=M.id;
    M.unsubs.push(F().onSnapshot(mdoc(id),s=>{
      if(!M||M.closed)return;
      if(!s.exists()||(s.data().durum==='bitti')){endSession('Masa kapandı.');return;}
      const d=s.data();let pub=null;
      try{pub=d.oyun?JSON.parse(d.oyun):null;}catch(e){}
      if(pub){M.pub=pub;M.cfg=Object.assign({},M.cfg,pub.cfg||{},{chipTL:d.chipTL||M.cfg.chipTL,ad:d.ad});}
      M.meta=d;
      afterPub();
    },e=>console.warn(e)));
    M.unsubs.push(F().onSnapshot(mdoc(id,'el',B().uid),s=>{if(!M)return;M.hole=s.exists()?s.data():null;renderCtrl();renderTable();},e=>console.warn(e)));
    const q=F().query(mcol(id,'mesaj'),F().orderBy('t','desc'),F().limit(40));
    M.unsubs.push(F().onSnapshot(q,s=>{
      if(!M)return;
      const arr=s.docs.map(d=>d.data()).reverse();
      const newest=arr[arr.length-1];
      const nm=newest&&newest.t&&newest.t.toMillis?newest.t.toMillis():Date.now();
      if(newest&&newest.uid&&Date.now()-nm<6000)M.say[newest.uid]={m:newest.m,at:nm};
      M.chat=arr;renderChat();renderTable();
    },e=>console.warn(e)));
  }
  function afterPub(){
    if(!M.pub)return;
    renderTop();renderTable();renderCtrl();
    if(M.pub.sonuc&&M.lastSonucHand!==M.pub.hand){M.lastSonucHand=M.pub.hand;sfx('flip');}
  }
  const mySeat=()=>M&&M.pub?M.pub.players.findIndex(p=>p.uid===B().uid&&!p.left):-1;

  /* ---------- Ev sahibi (kurucu) ---------- */
  function startHost(id,data){
    newSession(id,{ad:data.ad,chipTL:data.chipTL,turSn:data.turSn,baslangic:data.baslangic,maxKoltuk:data.maxKoltuk},true);
    M.engine=OnlineMotor.create({evalCards,newDeck},{turSn:data.turSn,baslangic:data.baslangic,maxKoltuk:data.maxKoltuk});
    M.engine.addPlayer({uid:B().uid,ad:myName(),av:parseAva(myAva())});
    M.heldHand={};M.lastNo={};M.joinT={};M.banned=new Set();M.writing=false;M.dirty=false;
    openMasaView();
    listenCommon();
    M.unsubs.push(F().onSnapshot(mcol(id,'katil'),s=>{
      if(!M)return;let ch=false;
      s.docChanges().forEach(c=>{
        if(c.type==='removed')return;
        const d=c.doc.data(),uid=c.doc.id;
        if(M.banned.has(uid))return;
        const key=(d.t&&d.t.toMillis?d.t.toMillis():0)+':'+(d.kalk?1:0)+(d.yeniden?1:0);
        if(M.joinT[uid]===key||(d.t&&!d.t.toMillis))return;   // aynı istek tekrar işlenmesin
        M.joinT[uid]=key;
        if(d.kalk){ch=M.engine.removePlayer(uid)||ch;return;}
        if(d.yeniden){ch=M.engine.rebuy(uid)||ch;return;}
        const i=M.engine.addPlayer({uid,ad:String(d.ad||'Oyuncu').slice(0,16),av:parseAva(d.av)});
        if(i<0)F().updateDoc(c.doc.ref,{red:true}).catch(()=>{});else ch=true;
      });
      if(ch)publish();
    },e=>console.warn(e)));
    M.unsubs.push(F().onSnapshot(mcol(id,'hamle'),s=>{
      if(!M)return;let ch=false;
      s.docChanges().forEach(c=>{
        if(c.type==='removed')return;
        const d=c.doc.data(),uid=c.doc.id;
        if(!d||typeof d.no!=='number'||d.no<=(M.lastNo[uid]||0))return;
        M.lastNo[uid]=d.no;
        if(d.el!==M.engine.state.hand)return;
        const r=M.engine.act(uid,{tur:d.tur,to:d.to});
        if(r.ok)ch=true;
      });
      if(ch)publish();
    },e=>console.warn(e)));
    M.ticker=setInterval(()=>{
      if(!M||!M.host)return;
      let ch=M.engine.tick();
      const st0=M.engine.state;
      if(st0.phase==='bekle'&&st0.hand>0&&st0.players.filter(x=>!x.left).length>=2&&M.engine.newHand())ch=true;
      if(Date.now()-(M.lastBeat||0)>25000)ch=true;
      if(ch)publish();
      updateClock();
    },1000);
    publish();
  }
  async function publish(){
    if(!M||!M.host)return;
    if(M.writing){M.dirty=true;return;}
    M.writing=true;
    try{
      do{
        M.dirty=false;
        const E=M.engine,st=E.state;
        // yeni elde kartlar önce yazılır
        for(const uid of E.holeUids()){
          if(M.heldHand[uid]!==st.hand){
            await F().setDoc(mdoc(M.id,'el',uid),{kartlar:E.hole(uid),el:st.hand});
            M.heldHand[uid]=st.hand;
          }
        }
        const pub=E.publicState();
        M.pub=pub;
        const n=pub.players.filter(p=>!p.left).length;
        await F().updateDoc(mdoc(M.id),{oyun:JSON.stringify(pub),oyuncu:n,durum:pub.phase==='bekle'?'bekliyor':'oyunda',nabiz:F().serverTimestamp()});
        M.lastBeat=Date.now();
        afterPub();
      }while(M&&M.dirty);
    }catch(e){console.warn('Masa yazılamadı',e);}
    if(M)M.writing=false;
  }

  /* ---------- Katılma ---------- */
  async function joinTable(id){
    const t=tables.find(x=>x.id===id);if(!t)return;
    newSession(id,{ad:t.ad,chipTL:t.chipTL,turSn:t.turSn,baslangic:t.baslangic,maxKoltuk:t.maxKoltuk},false);
    openMasaView();
    M.joining=true;renderTable();
    listenCommon();
    try{
      await F().setDoc(mdoc(id,'katil',B().uid),{ad:myName(),av:myAva(),t:F().serverTimestamp()});
    }catch(e){console.warn(e);endSession('Katılma isteği gönderilemedi.');return;}
    M.unsubs.push(F().onSnapshot(mdoc(id,'katil',B().uid),s=>{if(M&&s.exists()&&s.data().red)endSession('Masa dolu.');}));
    M.joinTimer=setTimeout(()=>{if(M&&mySeat()<0)endSession('Masa kurucusu yanıt vermedi. Masa kapanmış olabilir.');},14000);
    M.ticker=setInterval(updateClock,1000);
  }

  /* ---------- Hamle gönderme ---------- */
  async function sendAction(tur,to){
    if(!M||!M.pub)return;
    const me=B().uid;
    if(M.host){const r=M.engine.act(me,{tur,to});if(r.ok){sfx(tur==='fold'?'fold':'chip');publish();}return;}
    M.seq=Math.max(M.seq+1,Date.now());
    try{await F().setDoc(mdoc(M.id,'hamle',me),{tur,to:tur==='raise'?Math.round(to):0,no:M.seq,el:M.pub.hand,t:F().serverTimestamp()});sfx(tur==='fold'?'fold':'chip');}
    catch(e){console.warn(e);toast('Hamle gönderilemedi','Bağlantını kontrol et.');}
  }
  async function sendChat(text){
    text=String(text||'').trim().slice(0,140);if(!text||!M)return;
    if(Date.now()-M.lastSend<1500)return;M.lastSend=Date.now();
    try{await F().addDoc(mcol(M.id,'mesaj'),{uid:B().uid,ad:myName(),m:text,t:F().serverTimestamp()});}
    catch(e){console.warn(e);toast('Mesaj gönderilemedi','Bir süre sonra tekrar dene.');}
  }
  async function sitOrRebuy(){
    if(!M)return;
    if(M.host){if(M.engine.rebuy(B().uid))publish();return;}
    try{await F().setDoc(mdoc(M.id,'katil',B().uid),{ad:myName(),av:myAva(),yeniden:true,t:F().serverTimestamp()});}catch(e){console.warn(e);}
  }

  /* ---------- Çıkış ---------- */
  async function leaveTable(silent){
    const m=M;if(!m)return;
    m.closed=true;
    m.unsubs.forEach(u=>{try{u();}catch(e){}});clearInterval(m.ticker);clearTimeout(m.joinTimer);
    M=null;
    try{
      if(m.host){
        await F().updateDoc(mdoc(m.id),{durum:'bitti',nabiz:F().serverTimestamp()});
        await deleteTable(m.id);
      }else{
        await F().setDoc(mdoc(m.id,'katil',B().uid),{ad:myName(),kalk:true,t:F().serverTimestamp()});
      }
    }catch(e){console.warn(e);}
    if(!silent){renderLobi();listenLobby();}
  }
  function endSession(msg){
    const m=M;if(!m)return;
    m.closed=true;m.unsubs.forEach(u=>{try{u();}catch(e){}});clearInterval(m.ticker);clearTimeout(m.joinTimer);
    M=null;err=msg||'';renderLobi();listenLobby();
    if(msg)toast('Online masa',msg);
  }

  /* ---------- Masa çizimi ---------- */
  function openMasaView(){
    view='masa';stopLobby();
    root.innerHTML=`<div id="on-top"></div><div id="on-table"></div><div id="on-ctrl" class="cs-ctrl"></div>
      <div class="cs-card on-chat"><h3 class="cs-h">Masa sohbeti</h3><ol id="on-msgs"></ol>
        <div class="on-quick">${['Güzel el!','Hadi bakalım.','Şanslısın.','İyi oyun!'].map(x=>`<button type="button" class="btn ghost small" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <form id="on-form" class="on-send"><input type="text" id="on-in" maxlength="140" autocomplete="off" placeholder="Mesaj yaz (en çok 140 karakter)" aria-label="Mesaj"><button class="btn small" type="submit">Gönder</button></form></div>`;
    renderTop();renderTable();renderCtrl();renderChat();
  }
  function renderTop(){
    const e=document.getElementById('on-top');if(!e||!M)return;
    const p=M.pub;
    e.innerHTML=`<div class="cs-bar"><span><b>${esc(M.cfg.ad||'Online masa')}</b> · ${p?`El #${p.hand}`:'Bağlanıyor…'} · KB 1 / BB 2 çip (${fm(1)} / ${fm(2)})</span>
      <span class="cs-bar-btns">${M.host&&p&&p.phase==='bekle'?`<button class="btn small" id="on-start" ${p.players.filter(x=>!x.left).length<2?'disabled':''}>Oyunu başlat</button>`:''}<button class="btn ghost small" id="on-leave">${M.host?'Masayı kapat':'Masadan kalk'}</button></span></div>`;
  }
  const seatPos=(k,n)=>{const a=Math.PI/2+k*2*Math.PI/n;return {x:50+43*Math.cos(a),y:50+40*Math.sin(a)};};
  function renderTable(){
    const e=document.getElementById('on-table');if(!e||!M)return;
    const p=M.pub;
    if(!p){e.innerHTML=`<p class="cs-sub on-wait">${M.joining?'Masaya katılıyorsun…':'Bağlanıyor…'}</p>`;return;}
    const n=p.players.length,me=mySeat();
    const sonuc=p.sonuc;
    const seats=p.players.map((pl,i)=>{
      const k=me>=0?(i-me+n)%n:i,pos=seatPos(k,n);
      const st=pl.left?'Kalktı':pl.out?(pl.waiting?'Sonraki elde':'Elendi'):pl.leaving?'Kalkıyor':pl.folded?'Çekildi':pl.allin?'All-in':(p.lastAct[i]||'');
      const cls=['cs-pl','on-pl',i===p.toAct?'turn':'',pl.out||pl.left?'out':'',pl.folded?'fold':'',pl.allin?'allin':'',i===me?'me':''].filter(Boolean).join(' ');
      const tags=[i===p.dealer?'<em class="t-d">D</em>':'',i===p.sb&&!pl.out?'<em class="t-sb">KB</em>':'',i===p.bb&&!pl.out?'<em class="t-bb">BB</em>':''].join('');
      const show=sonuc&&sonuc.goster&&sonuc.goster[i];
      const cards=show?`<div class="on-cards">${show.map(c=>cardHTML(c,'')).join('')}</div>`:(!pl.out&&!pl.folded&&p.phase==='el'&&i!==me?`<div class="on-cards">${cardHTML(-1)}${cardHTML(-1)}</div>`:'');
      const say=M.say[pl.uid]&&Date.now()-M.say[pl.uid].at<7000?`<div class="on-say">${esc(M.say[pl.uid].m)}</div>`:'';
      const kick=M.host&&pl.uid!==B().uid&&!pl.left?`<button class="on-kick" data-kick="${esc(pl.uid)}" title="Masadan çıkar" aria-label="${esc(pl.ad)} adlı oyuncuyu çıkar">×</button>`:'';
      return `<div class="${cls}" data-i="${i}" style="left:${pos.x.toFixed(1)}%;top:${pos.y.toFixed(1)}%">${say}${kick}
        <div class="cs-tags">${tags}</div>${cards}<div class="on-ava">${avaHTML(pl.av,34)}</div>
        <div class="cs-name">${esc(pl.ad)}</div><div class="cs-stk">${fm(pl.stack)}</div><div class="cs-st">${esc(st)||'&nbsp;'}</div></div>`;
    }).join('');
    const bets=p.players.map((pl,i)=>{
      if(!(pl.bet>0&&p.phase==='el'))return '';
      const k=me>=0?(i-me+n)%n:i,pos=seatPos(k,n),f=.42;
      return `<div class="cs-bet" style="left:${(pos.x+(50-pos.x)*f).toFixed(1)}%;top:${(pos.y+(50-pos.y)*f).toFixed(1)}%"><b>${fm(pl.bet)}</b></div>`;
    }).join('');
    let center;
    if(p.phase==='bekle')center=`<div class="cs-street">${M.host?'Oyuncuları bekliyorsun':'Kurucu oyunu başlatacak'}</div><div class="cs-pot"><span>OYUNCU</span><b>${p.players.filter(x=>!x.left).length}</b></div>`;
    else center=`<div class="cs-street">${p.phase==='el'?OnlineMotor.STREETS[p.street]:'El bitti'}</div>
      <div class="on-board">${[0,1,2,3,4].map(i=>p.board[i]!=null?cardHTML(p.board[i],''):'<span class="slot"></span>').join('')}</div>
      <div class="cs-pot"><span>POT</span><b>${fm(p.pot)}</b></div>`;
    e.innerHTML=`<div class="cs-table on-tbl2"><div class="cs-felt"><div class="cs-center">${center}</div></div>${bets}${seats}</div>${sonucHTML(p)}`;
  }
  function sonucHTML(p){
    if(p.phase!=='sonuc'||!p.sonuc)return '';
    const s=p.sonuc,rows=s.potlar.map(r=>{
      const names=r.kazananlar.map(i=>esc(p.players[i].ad)).join(', ');
      const d=r.skor!=null&&typeof describe==='function'?` · ${describe(r.skor)}`:'';
      return `<li><b>${names}</b> kazandı <strong>${fm(r.miktar)}</strong>${d}</li>`;
    }).join('');
    return `<div class="cs-win on-win"><ul>${rows}</ul><span class="muted" id="on-next"></span></div>`;
  }
  function holeCards(){return M&&M.hole&&M.pub&&M.hole.el===M.pub.hand?M.hole.kartlar:null;}
  function renderCtrl(){
    const e=document.getElementById('on-ctrl');if(!e||!M)return;
    const p=M.pub;
    if(!p){e.innerHTML='';return;}
    const me=mySeat(),pl=me>=0?p.players[me]:null;
    const hc=holeCards();
    const mine=hc&&pl&&!pl.out?`<div class="on-hand"><span class="lbl">Kartların</span><div class="cards">${hc.map(c=>cardHTML(c,'')).join('')}</div></div>`:'';
    let body='';
    if(me<0)body=`<p class="cs-sub">Masaya yerleşiyorsun…</p>`;
    else if(pl.out&&!pl.waiting&&pl.stack===0)body=`<p class="cs-sub">Fişlerin bitti.</p><div class="cs-btns"><button class="btn" id="on-rebuy">Yeniden ${fm(p.cfg.baslangic)} al</button></div>`;
    else if(pl.out||pl.waiting)body=`<p class="cs-sub">Bir sonraki ele dahil olacaksın.</p>`;
    else if(p.phase==='el'&&p.toAct===me){
      const need=Math.max(0,p.current-pl.bet),callAmt=Math.min(need,pl.stack),maxTo=pl.bet+pl.stack;
      const minTo=Math.min(maxTo,p.current===0?2:p.current+p.minRaise);
      const others=p.players.some((o,j)=>j!==me&&!o.out&&!o.folded&&!o.allin&&!o.left);
      const canRaise=pl.stack>need&&others;
      if(!(M.raiseTo>=minTo&&M.raiseTo<=maxTo))M.raiseTo=minTo;
      const pot=p.pot;
      const pre=[['Min',minTo],['½ Pot',p.current+Math.round((pot+need)/2)],['Pot',p.current+pot+need],['All-in',maxTo]].map(([l,v])=>[l,Math.max(minTo,Math.min(maxTo,v))]);
      body=`<div class="cs-turn"><b>Sıra sende</b><span>${need>0?`Call için <b>${fm(callAmt)}</b> gerekli`:'Bahis yok · pas geçebilirsin'} · <span id="on-clock"></span></span></div>
        ${canRaise?`<div class="cs-raise"><div class="cs-pre">${pre.map(([l,v])=>`<button type="button" data-to="${v}">${l}<small>${fm(v)}</small></button>`).join('')}</div>
          <div class="cs-amt"><button type="button" class="cs-pm" data-d="-1" aria-label="Azalt">−</button><input type="range" id="on-rng" min="${minTo}" max="${maxTo}" step="1" value="${M.raiseTo}" aria-label="Bahis miktarı"><button type="button" class="cs-pm" data-d="1" aria-label="Arttır">+</button></div>
          <div class="cs-eq" id="on-eq"></div></div>`:''}
        <div class="cs-btns"><button class="act fold" id="on-fold">Çekil</button><button class="act call" id="on-call">${need===0?'Pas':(callAmt<need||callAmt===pl.stack?`All-in ${fm(callAmt)}`:`Call ${fm(callAmt)}`)}</button>${canRaise?`<button class="act raise" id="on-raise">${M.raiseTo>=maxTo?'All-in '+fm(maxTo):(p.current===0?'Bahis ':'Raise ')+fm(M.raiseTo)}</button>`:''}</div>`;
    }else if(p.phase==='el'){
      const who=p.players[p.toAct];
      body=`<div class="cs-turn"><b>${who?esc(who.ad):'…'}</b> sırada<span id="on-clock"></span></div>`;
    }else if(p.phase==='bekle')body=`<p class="cs-sub">${M.host?'En az iki oyuncu gelince “Oyunu başlat”a bas.':'Oyunun başlamasını bekliyorsun.'}</p>`;
    else body=`<p class="cs-sub">Yeni el birazdan başlıyor…</p>`;
    e.innerHTML=mine+body;
    const rng=document.getElementById('on-rng');
    if(rng){
      const upd=v=>{
        const mn=+rng.min,mx=+rng.max;v=Math.max(mn,Math.min(mx,Math.round(+v||mn)));M.raiseTo=v;rng.value=v;
        const b=document.getElementById('on-raise'),eq=document.getElementById('on-eq');
        if(b)b.textContent=v>=mx?'All-in '+fm(mx):(p.current===0?'Bahis ':'Raise ')+fm(v);
        if(eq)eq.textContent=`Kasandan ${fm(v-pl.bet)} gider · toplamda ${fm(v)} bahis`;
      };
      upd(M.raiseTo);rng.oninput=()=>upd(rng.value);
      e.querySelectorAll('.cs-pre button').forEach(b=>b.onclick=()=>upd(b.dataset.to));
      e.querySelectorAll('.cs-pm').forEach(b=>b.onclick=()=>upd(M.raiseTo+ +b.dataset.d));
    }
    updateClock();
  }
  function renderChat(){
    const e=document.getElementById('on-msgs');if(!e||!M)return;
    const stick=e.scrollTop+e.clientHeight>=e.scrollHeight-30;
    e.innerHTML=M.chat.map(m=>`<li${m.uid===B().uid?' class="mine"':''}><b>${esc(m.ad)}</b> ${esc(m.m)}</li>`).join('')||'<li class="muted">Henüz mesaj yok.</li>';
    if(stick)e.scrollTop=e.scrollHeight;
  }
  function updateClock(){
    if(!M||!M.pub)return;
    const p=M.pub,c=document.getElementById('on-clock');
    if(c&&p.phase==='el'&&p.sure){const s=Math.max(0,Math.ceil((p.sure-Date.now())/1000));c.textContent=`${s} sn`;c.className=s<=8?'on-late':'';}
    const nx=document.getElementById('on-next');
    if(nx&&p.sonSure){const s=Math.max(0,Math.ceil((p.sonSure-Date.now())/1000));nx.textContent=`Yeni el ${s} sn içinde`;}
  }

  /* ---------- Olaylar ---------- */
  root.addEventListener('click',e=>{
    const t=e.target;
    if(t.closest('#on-login')){B().girisYap();return;}
    if(t.closest('#on-new')){const a=document.getElementById('on-ad');if(a)lsSet(KAD,a.value.trim().slice(0,16));draft.ad='';renderKur();return;}
    const j=t.closest('[data-join]');if(j){const a=document.getElementById('on-ad');if(a)lsSet(KAD,a.value.trim().slice(0,16));joinTable(j.dataset.join);return;}
    const k=t.closest('[data-k]');if(k&&view==='kur'){readKur();draft.maxKoltuk=+k.dataset.k;renderKur();return;}
    const c=t.closest('[data-c]');if(c&&view==='kur'){readKur();draft.chipTL=+c.dataset.c;renderKur();return;}
    const s=t.closest('[data-s]');if(s&&view==='kur'){readKur();draft.baslangic=+s.dataset.s;renderKur();return;}
    const tt=t.closest('[data-t]');if(tt&&view==='kur'){readKur();draft.turSn=+tt.dataset.t;renderKur();return;}
    if(t.closest('#k-back')){renderLobi();listenLobby();return;}
    if(t.closest('#k-go')){createTable();return;}
    if(t.closest('#on-leave')){
      openModal(`<h3>${M&&M.host?'Masayı kapat?':'Masadan kalk?'}</h3><p>${M&&M.host?'Masayı kuran sensin: kapatırsan masa herkes için biter ve bilgiler silinir.':'Elin sürüyorsa çekilmiş sayılırsın.'}</p><div class="row"><button class="btn ghost" id="lv-no">Vazgeç</button><button class="btn" id="lv-yes">Evet</button></div>`);
      $('#lv-no').onclick=closeModal;$('#lv-yes').onclick=()=>{closeModal();leaveTable();};return;
    }
    if(t.closest('#on-start')){if(M&&M.host){M.engine.newHand();publish();}return;}
    if(t.closest('#on-fold')){sendAction('fold');return;}
    if(t.closest('#on-call')){sendAction('call');return;}
    if(t.closest('#on-raise')){sendAction('raise',M.raiseTo);return;}
    if(t.closest('#on-rebuy')){sitOrRebuy();return;}
    const kk=t.closest('[data-kick]');
    if(kk&&M&&M.host){const uid=kk.dataset.kick;M.banned.add(uid);M.engine.removePlayer(uid);publish();toast('Oyuncu çıkarıldı','Bu masaya tekrar katılamaz.');return;}
    const q=t.closest('[data-q]');if(q){sendChat(q.dataset.q);return;}
  });
  root.addEventListener('submit',e=>{
    if(e.target.id==='on-form'){e.preventDefault();const i=document.getElementById('on-in');sendChat(i.value);i.value='';}
  });
  root.addEventListener('input',e=>{
    if(e.target.id==='on-ad')lsSet(KAD,e.target.value.trim().slice(0,16));
    if(e.target.id==='k-ctl'&&view==='kur'){const v=+e.target.value;if(v>0){draft.chipTL=Math.min(100000,v);}}
  });
  window.addEventListener('beforeunload',()=>{if(M&&M.host&&F()){try{F().updateDoc(mdoc(M.id),{durum:'bitti'});}catch(e){}}});

  /* ---------- Ekran açılışı ---------- */
  function enter(){
    const go=()=>{
      renderLobi();
      clearInterval(pollT);
      pollT=setInterval(()=>{
        if(scr.hidden){clearInterval(pollT);return;}
        if(view==='lobi'&&!M){
          const sig=(B()&&B().hazir?'h':'-')+(B()&&B().giris?'g':'-');
          if(sig!==enter.sig){enter.sig=sig;renderLobi();if(sig==='hg')listenLobby();}
        }
        if(M&&!M.host)updateClock();
      },1200);
      if(B()&&B().giris)listenLobby();
    };
    if(uyariVar())go();else uyariGoster(go);
  }
  new MutationObserver(()=>{
    if(!scr.hidden)enter();
    else{stopLobby();clearInterval(pollT);if(M)leaveTable(true);view='lobi';}
  }).observe(scr,{attributes:true,attributeFilter:['hidden']});
  const go=document.getElementById('go-online');if(go)go.onclick=()=>show('scr-online');
  window.VYOnline={leave:()=>leaveTable(true)};
})();
