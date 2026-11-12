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
  let draft={ad:'',mesaj:'',maxKoltuk:6,chipTL:5,baslangic:100,turSn:45,mekan:'yeralti'};
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
        <li><b>18 yaş ve üzeri</b> içindir. Oyun eğlence ve rekabet amaçlıdır; kumarı özendirmez. <b>Gerçek para yoktur</b>, çipler sanaldır. Gerçek paralı kumar Türkiye’de yasaktır; oyuncular arasında para karşılığı oynama.</li>
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
        <p class="cs-sub">Kuran: <b>${esc(t.kurucuAd)}</b> · ${esc(((typeof VENUES!=='undefined'?VENUES:[]).find(v=>v.id===t.mekan)||{}).name||'')} · ${t.oyuncu||0}/${t.maxKoltuk} oyuncu · Başlangıç ${(t.baslangic*t.chipTL).toLocaleString('tr-TR')} ₺ (${t.baslangic} çip) · Süre ${t.turSn} sn</p>
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
      <div class="cs-card"><h3 class="cs-h">Mekân (3D salon)</h3><div class="cs-stack on-venues">${(typeof VENUES!=='undefined'?VENUES:[]).map(v=>`<button type="button" class="cs-n wide${v.id===d.mekan?' on':''}" data-m="${v.id}">${esc(v.name)}<small>${esc(v.city)}</small></button>`).join('')}</div><p class="cs-sub">Masa, oda ve ışıklar seçtiğin mekâna göre kurulur. Oyuncular kendi karakterleriyle oturur.</p></div>
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
    const data={mekan:draft.mekan,kurucu:B().uid,kurucuAd:myName(),ad,mesaj:draft.mesaj.slice(0,140),maxKoltuk:draft.maxKoltuk,baslangic:draft.baslangic,chipTL:Math.max(1,Math.round(draft.chipTL)),turSn:draft.turSn,
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
      if(pub){M.pub=pub;M.cfg=Object.assign({},M.cfg,pub.cfg||{},{chipTL:d.chipTL||M.cfg.chipTL,ad:d.ad,mekan:d.mekan||M.cfg.mekan||'yeralti'});}
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
      M.chat=arr;renderChat();
      if(newest&&Date.now()-nm<6000)say3D(newest.uid,newest.m,nm);
      if(!use3D())renderTable();
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
    newSession(id,{ad:data.ad,chipTL:data.chipTL,turSn:data.turSn,baslangic:data.baslangic,maxKoltuk:data.maxKoltuk,mekan:data.mekan},true);
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
    newSession(id,{ad:t.ad,chipTL:t.chipTL,turSn:t.turSn,baslangic:t.baslangic,maxKoltuk:t.maxKoltuk,mekan:t.mekan||'yeralti'},false);
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
    ownSay(text);
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
    stop3D(m);M=null;
    try{
      if(m.host){
        await F().updateDoc(mdoc(m.id),{durum:'bitti',nabiz:F().serverTimestamp()});
        await deleteTable(m.id);
      }else{
        await F().setDoc(mdoc(m.id,'katil',B().uid),{ad:myName(),kalk:true,t:F().serverTimestamp()});
      }
    }catch(e){console.warn(e);}
    if(!silent)show('scr-online');
  }
  function endSession(msg){
    const m=M;if(!m)return;
    m.closed=true;m.unsubs.forEach(u=>{try{u();}catch(e){}});clearInterval(m.ticker);clearTimeout(m.joinTimer);
    stop3D(m);M=null;err=msg||'';show('scr-online');
    if(msg)toast('Online masa',msg);
  }


  /* ---------- Oyun ekranı: kariyerdeki #scr-game ile aynı düzen (üstte başlık, ortada 3D masa, altta hamle çubuğu) ---------- */
  const og=document.getElementById('scr-ogame');
  const $o=s=>og.querySelector(s);
  const clampN=(x,a,b)=>Math.max(a,Math.min(b,x));
  const use3D=()=>typeof Sahne!=='undefined'&&Sahne.ok&&(typeof SAVE==='undefined'||SAVE.settings.view!=='2d');
  const STY=['kaya','gevsek','tilki','kopekbaligi','manyak'];
  const hashU=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;};
  // Oyuncunun seçtiği görünümü 3D beden tanımına çevirir (avatar.js avaDef ile aynı, ama verilen karakter için)
  function avaDefOf(a0){
    const a=Object.assign({},AVA_DEF,a0||{}),hair=a.hair==='bald'?'bald':a.hair;
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
    d.acc=ac;return d;
  }
  // Benden başlayıp saat yönünde sıralanan (kalkmamış) koltuklar
  function roster(p,me){
    const n=p.players.length,out=[];
    for(let k=0;k<n;k++){const i=(me+k)%n;if(!p.players[i].left||i===me)out.push(i);}
    return out;
  }
  function render3D(p){
    const me=mySeat(),v=M.v3=M.v3||{on:false,sig:'',hand:null,map:{},G:null};
    const seats=roster(p,me),CTL=M.cfg.chipTL||5;
    const sig=seats.map(i=>p.players[i].uid+':'+JSON.stringify(p.players[i].av||{})).join('|')+'#'+M.cfg.mekan+'#'+CTL;
    if(sig!==v.sig){
      v.sig=sig;v.map={};seats.forEach((i,k)=>{v.map[i]=k;});v.hand=null;v.settle=-1;v.resHand=-1;v.pending=false;
      v.G={venue:{id:M.cfg.mekan||'yeralti',name:M.cfg.ad||'Online masa',place:'Online masa',cur:'₺',buy:(M.cfg.baslangic||100)*CTL,sb:CTL,bb:2*CTL,unit:CTL},
        players:seats.map((i,k)=>{const pl=p.players[i];return {idx:k,name:pl.ad,uid:pl.uid,human:k===0,style:STY[hashU(pl.uid)%STY.length],char:avaDefOf(pl.av),chips:0,bet:0,cards:[],folded:false,inHand:false,out:false,allIn:false,show:false,won:0,lastAct:'',actCls:''};}),
        turn:-1,phase:'bet',board:[],pot:0,dealer:0,handNo:0,v3:true,nRaises:0};
      try{
        Sahne.start(v.G,document.getElementById('on-v3'),{intro:'sit'});
        v.on=true;try{SFX.ambient(M.cfg.mekan||'yeralti');}catch(x){}
      }catch(x){console.warn('3D masa kurulamadı',x);v.on=false;}
    }
    sync3D();
  }
  // Herkese açık durumu 3D sahneye kariyerdeki G biçiminde aktarır
  function fill3D(p,opt){
    const v=M.v3,G=v.G,CTL=M.cfg.chipTL||5,s=p.sonuc,won={};
    if(s)s.potlar.forEach(r=>{const w=r.kazananlar,each=Math.floor(r.miktar/w.length),rest=r.miktar-each*w.length;w.forEach((i,k)=>{won[i]=(won[i]||0)+each+(k<rest?1:0);});});
    const done=p.phase==='sonuc';
    G.phase=done?'done':'bet';G.handNo=p.hand;
    G.turn=p.phase==='el'&&p.toAct>=0&&v.map[p.toAct]!=null?v.map[p.toAct]:-1;
    G.dealer=v.map[p.dealer]!=null?v.map[p.dealer]:0;
    G.board=opt.clear?[]:p.board.slice();
    const totalWon=Object.values(won).reduce((a,b)=>a+b,0);
    G.pot=opt.clear?0:(done&&!opt.final?totalWon*CTL:p.pot*CTL);
    const hc=holeCards();
    G.players.forEach(q=>{
      const i=+Object.keys(v.map).find(x=>v.map[x]===q.idx),pl=p.players[i];if(!pl)return;
      const inHand=!pl.out&&!pl.waiting&&p.phase!=='bekle'&&!pl.left;
      const gos=s&&s.goster&&s.goster[i],w=won[i]||0;
      q.inHand=inHand&&!opt.clear;q.folded=inHand&&pl.folded&&!opt.clear;q.out=false;q.allIn=!!pl.allin&&inHand;
      q.chips=(pl.stack-(done&&!opt.final?w:0))*CTL;q.bet=opt.clear?0:pl.bet*CTL;
      q.won=done&&!opt.clear?w*CTL:0;
      q.show=!!gos&&!q.human;
      q.cards=(opt.clear||!inHand)?[]:(q.human?(hc||[-1,-1]):(gos||[-1,-1]));
      const la=(p.lastAct&&p.lastAct[i])||'';
      q.lastAct=la.replace(/\d+/,m=>fm(+m));
      q.actCls=/Çekildi/.test(la)?'fold':/Bahis|Raise|All-in/.test(la)?'raise':'';
    });
  }
  function sync3D(){
    const v=M.v3,p=M.pub;
    if(!v||!v.on||!p||!v.G||!Sahne.active)return;
    const me=mySeat(),pl=p.players[me];
    const inHand=pl&&!pl.out&&!pl.waiting&&p.phase!=='bekle';
    if(inHand&&p.phase==='el'&&!holeCards())return;                        // kartının gelmesini bekle
    if(v.hand!==p.hand&&!v.pending){
      if(v.hand!=null){                                                    // yeni el: eski kartları topla, kısa süre sonra dağıt
        fill3D(p,{clear:true});Sahne.sync(v.G);
        v.pending=true;clearTimeout(v.nt);
        v.nt=setTimeout(()=>{v.pending=false;if(M&&M.v3===v){v.hand=p.hand;sync3D();}},900);
        return;
      }
      v.hand=p.hand;
    }
    if(v.pending)return;
    const done=p.phase==='sonuc';
    if(done&&v.resHand!==p.hand){                                          // sonuç: önce pot kazanana kayar, sonra kasalar güncellenir
      v.resHand=p.hand;fill3D(p,{});Sahne.sync(v.G);
      clearTimeout(v.st);v.st=setTimeout(()=>{if(M&&M.v3===v){v.settle=p.hand;fill3D(M.pub,{final:true});Sahne.sync(v.G);}},3600);
      return;
    }
    if(done&&v.settle!==p.hand)return;
    fill3D(p,{final:true});Sahne.sync(v.G);
  }
  function say3D(uid,text,at){
    const v=M&&M.v3;if(!v||!v.on||!v.G||!Sahne.active)return;
    const key=uid+'|'+at;if(v.said===key)return;v.said=key;
    const q=v.G.players.find(x=>x.uid===uid);if(q&&!q.human)Sahne.sideSay(q.idx,text,4200);
  }
  function stop3D(m){
    const v=m&&m.v3;if(!v)return;
    clearTimeout(v.nt);clearTimeout(v.st);
    if(v.on){try{Sahne.stop();}catch(e){}try{SFX.ambient(null);}catch(e){}}
    v.on=false;v.sig='';
  }

  /* ---------- Masa çizimi ---------- */
  function openMasaView(){
    view='masa';stopLobby();
    og.dataset.venue=M.cfg.mekan||'yeralti';
    og.classList.toggle('v3on',use3D());
    show('scr-ogame');
    document.body.classList.add('in-game');
    if(typeof refreshAvatars==='function')refreshAvatars();
    M.hudKey='';M.meKey='';
    $o('#og-name').textContent=M.cfg.ad||'Online masa';
    $o('#ov3-board').innerHTML='';$o('#ov3-me').innerHTML='';$o('#og-banner').hidden=true;$o('#on-2d').innerHTML='';
    $o('#og-emote-list').hidden=true;$o('#og-say-me').hidden=true;
    renderTop();renderTable();renderCtrl();renderChat();
  }
  function renderTop(){
    if(!M)return;
    const p=M.pub,me=mySeat(),pl=p&&me>=0?p.players[me]:null;
    $o('#og-info').textContent=p?` · El #${p.hand||0} · Körler ${fm(1)} / ${fm(2)}`:' · Bağlanıyor…';
    $o('#og-goal-txt').innerHTML=pl?`El <b>#${p.hand}</b> · Fişin <b>${fm(pl.stack)}</b>`:'';
    $o('#og-goal-bar').style.width=pl?clampN(pl.stack/((M.cfg.baslangic||100)*2)*100,0,100)+'%':'0';
    $o('#og-leave').textContent=M.host?'← Kapat':'← Kalk';
    $o('#og-start').hidden=!(M.host&&p&&p.phase==='bekle');
    if(p)$o('#og-start').disabled=p.players.filter(x=>!x.left).length<2;
    const pl2=$o('#og-plist');
    if(pl2&&p)pl2.innerHTML=p.players.filter(x=>!x.left).map(x=>`<li><span class="on-pa">${avaHTML(x.av,22)}</span><b>${esc(x.ad)}</b><em>${fm(x.stack)}</em>${M.host&&x.uid!==B().uid?`<button class="on-kick2" data-kick="${esc(x.uid)}" aria-label="${esc(x.ad)} adlı oyuncuyu çıkar" title="Masadan çıkar">Çıkar</button>`:''}</li>`).join('');
    const lg=$o('#og-loglist');
    if(lg&&p)lg.innerHTML=(p.log||[]).slice().reverse().map(l=>`<li>${esc(l)}</li>`).join('');
  }
  const seatPos=(k,n)=>{const a=Math.PI/2+k*2*Math.PI/n;return {x:50+43*Math.cos(a),y:50+40*Math.sin(a)};};
  function holeCards(){return M&&M.hole&&M.pub&&M.hole.el===M.pub.hand?M.hole.kartlar:null;}
  function renderTable(){
    if(!M)return;
    const p=M.pub;
    if(!p||mySeat()<0){$o('#og-banner').hidden=false;$o('#og-banner').innerHTML=`<b>${M.joining&&!p?'Masaya katılıyorsun…':'Masaya yerleşiyorsun…'}</b>`;return;}
    og.classList.toggle('v3on',use3D());
    if(use3D()){
      if(M.v3&&!M.v3.on&&M.v3.sig==='')M.v3.sig='';
      render3D(p);
      $o('#on-2d').innerHTML='';
    }else{
      if(M.v3&&M.v3.on)stop3D(M);
      render2D(p);
    }
    renderHud(p);
  }
  // Ortadaki kartlar + pot (üstte) ve kendi kartların + el adın (köşede): kariyerdeki HUD ile aynı
  function renderHud(p){
    const me=mySeat(),pl=p.players[me],hc=holeCards(),done=p.phase==='sonuc';
    const pot=done?(p.sonuc?p.sonuc.potlar.reduce((a,r)=>a+r.miktar,0):0):p.pot;
    const stg=p.phase==='el'?OnlineMotor.STREETS[p.street]:p.phase==='sonuc'?'Showdown':'';
    const bk=p.board.join(',')+'|'+pot+'|'+p.hand+'|'+stg;
    if(bk!==M.hudKey){
      M.hudKey=bk;
      $o('#ov3-board').innerHTML=(p.board.length||pot>0)?`${stg?`<span class="stg" title="Elin hangi aşamasındasın">${stg}</span>`:''}${p.board.length?`<div class="cards">${p.board.map(c=>cardHTML(c,'')).join('')}</div>`:''}${pot>0?`<span class="bpot"><span class="chip"></span>Pot <b>${fm(pot)}</b></span>`:''}`:'';
    }
    const has=hc&&pl&&!pl.out&&!pl.waiting&&!pl.folded&&p.phase!=='bekle';
    const mk=(has?hc.join(','):'')+'|'+p.board.length+'|'+(pl&&pl.folded)+'|'+p.hand;
    if(mk!==M.meKey){
      M.meKey=mk;
      const hd=has?(p.board.length>=3?describe(evalCards(hc.concat(p.board))):preflopName(hc)):'';
      $o('#ov3-me').innerHTML=has?`<div class="cards">${hc.map(c=>cardHTML(c,'')).join('')}</div><span>${hd}</span>`:(pl&&pl.folded&&p.phase==='el'?'<span class="muted">Çekildin</span>':'');
    }
    const bn=$o('#og-banner');
    if(done&&p.sonuc){
      bn.hidden=false;
      bn.innerHTML=p.sonuc.potlar.map(r=>{
        const names=r.kazananlar.map(i=>esc(p.players[i].ad)).join(', ');
        return `<span><b>${names}</b> kazandı ${fm(r.miktar)}${r.skor!=null?` · ${describe(r.skor)}`:''}</span>`;
      }).join('');
    }else bn.hidden=true;
  }
  // 3D desteklenmiyorsa ya da düz masa seçildiyse
  function render2D(p){
    const n=p.players.length,me=mySeat(),sonuc=p.sonuc;
    const seats=p.players.map((pl,i)=>{
      const k=(i-me+n)%n,pos=seatPos(k,n);
      const st=pl.left?'Kalktı':pl.out?(pl.waiting?'Sonraki elde':'Elendi'):pl.leaving?'Kalkıyor':pl.folded?'Çekildi':pl.allin?'All-in':(p.lastAct[i]||'');
      const cls=['cs-pl','on-pl',i===p.toAct?'turn':'',pl.out||pl.left?'out':'',pl.folded?'fold':'',i===me?'me':''].filter(Boolean).join(' ');
      const tags=[i===p.dealer?'<em class="t-d">D</em>':'',i===p.sb&&!pl.out?'<em class="t-sb">KB</em>':'',i===p.bb&&!pl.out?'<em class="t-bb">BB</em>':''].join('');
      const show=sonuc&&sonuc.goster&&sonuc.goster[i];
      const cards=show?`<div class="on-cards">${show.map(c=>cardHTML(c,'')).join('')}</div>`:(!pl.out&&!pl.folded&&p.phase==='el'&&i!==me?`<div class="on-cards">${cardHTML(-1)}${cardHTML(-1)}</div>`:'');
      const say=M.say[pl.uid]&&Date.now()-M.say[pl.uid].at<7000?`<div class="on-say">${esc(M.say[pl.uid].m)}</div>`:'';
      return `<div class="${cls}" style="left:${pos.x.toFixed(1)}%;top:${pos.y.toFixed(1)}%">${say}<div class="cs-tags">${tags}</div>${cards}<div class="on-ava">${avaHTML(pl.av,34)}</div><div class="cs-name">${esc(pl.ad)}</div><div class="cs-stk">${fm(pl.stack)}</div><div class="cs-st">${esc(st)||'&nbsp;'}</div></div>`;
    }).join('');
    const bets=p.players.map((pl,i)=>{
      if(!(pl.bet>0&&p.phase==='el'))return '';
      const k=(i-me+n)%n,pos=seatPos(k,n),f=.42;
      return `<div class="cs-bet" style="left:${(pos.x+(50-pos.x)*f).toFixed(1)}%;top:${(pos.y+(50-pos.y)*f).toFixed(1)}%"><b>${fm(pl.bet)}</b></div>`;
    }).join('');
    $o('#on-2d').innerHTML=`<div class="cs-table on-tbl2"><div class="cs-felt"><div class="cs-center"><div class="cs-street">${p.phase==='el'?OnlineMotor.STREETS[p.street]:p.phase==='sonuc'?'El bitti':'Bekleniyor'}</div><div class="on-board">${[0,1,2,3,4].map(i=>p.board[i]!=null?cardHTML(p.board[i],''):'<span class="slot"></span>').join('')}</div></div></div>${bets}${seats}</div>`;
  }

  /* ---------- Hamle çubuğu (kariyerdeki alt çubukla aynı düzen) ---------- */
  function renderCtrl(){
    if(!M)return;
    const p=M.pub,st=$o('#og-status'),hum=$o('#og-human'),rb=$o('#og-rebuy');
    rb.hidden=true;hum.hidden=true;
    if(!p){st.textContent='Bağlanıyor…';return;}
    const me=mySeat(),pl=me>=0?p.players[me]:null;
    if(!pl){st.textContent='Masaya yerleşiyorsun…';return;}
    if(pl.out&&!pl.waiting&&pl.stack===0){st.innerHTML='Fişlerin bitti.';rb.hidden=false;rb.textContent=`Yeniden ${fm(p.cfg.baslangic)} al`;return;}
    if(p.phase==='el'&&p.toAct===me&&!pl.out&&!pl.folded){
      const need=Math.max(0,p.current-pl.bet),callAmt=Math.min(need,pl.stack),maxTo=pl.bet+pl.stack;
      const minTo=Math.min(maxTo,p.current===0?2:p.current+p.minRaise);
      const others=p.players.some((o,j)=>j!==me&&!o.out&&!o.folded&&!o.allin&&!o.left);
      const canRaise=pl.stack>need&&others;
      st.innerHTML=(need>0?`Görmen gereken <b>${fm(callAmt)}</b> · Pot <b>${fm(p.pot)}</b>`:`Sıra sende · Pot <b>${fm(p.pot)}</b>`)+' · <span id="og-clock"></span>';
      hum.hidden=false;
      $o('#og-call').innerHTML=(need===0?'Kontrol':(callAmt<need||callAmt===pl.stack?`All-in ${fm(callAmt)}`:`Gör ${fm(callAmt)}`))+' <kbd>C</kbd>';
      $o('#og-raise-box').hidden=!canRaise;$o('#og-raise').disabled=!canRaise;
      M.act={minTo,maxTo,pot:p.pot,need,cur:p.current,word:p.current===0?'Bahis':'Artır'};
      if(canRaise){
        const amt=$o('#og-amt');amt.min=minTo;amt.max=maxTo;amt.step=1;
        const def=p.street===0?(p.current<=2?6:p.current*3):p.current+Math.round((p.pot+need)*.6);
        M.raiseTo=clampN(Math.round(def),minTo,maxTo);amt.value=M.raiseTo;
        updRaise();
      }else $o('#og-raise').innerHTML='Artır <kbd>R</kbd>';
      return;
    }
    if(p.phase==='el'){
      const who=p.players[p.toAct];
      st.innerHTML=(pl.folded?'Bu eli bıraktın. ':'')+`Sıra: <b>${who?esc(who.ad):'…'}</b> · <span id="og-clock"></span>`;
    }else if(p.phase==='sonuc')st.innerHTML=`El #${p.hand} bitti. Fişin: <b>${fm(pl.stack)}</b> · <span id="og-next"></span>`;
    else if(p.phase==='bekle')st.textContent=M.host?'En az iki oyuncu gelince “Oyunu başlat”a bas.':'Kurucunun oyunu başlatması bekleniyor.';
    else st.textContent='Yeni el birazdan başlıyor…';
    if(pl.waiting&&p.phase!=='bekle')st.textContent='Bir sonraki ele dahil olacaksın.';
    updateClock();
  }
  function updRaise(){
    const a=M&&M.act;if(!a)return;
    const amt=$o('#og-amt'),v=clampN(Math.round(+amt.value||a.minTo),a.minTo,a.maxTo);
    M.raiseTo=v;amt.value=v;
    $o('#og-amt-out').textContent=v>=a.maxTo?'All-in':fm(v);
    $o('#og-raise').innerHTML=(v>=a.maxTo?'All-in':`${a.word} ${fm(v)}`)+' <kbd>R</kbd>';
  }
  function renderChat(){
    const e=$o('#og-msgs');if(!e||!M)return;
    const stick=e.scrollTop+e.clientHeight>=e.scrollHeight-30;
    e.innerHTML=M.chat.map(m=>`<li${m.uid===B().uid?' class="mine"':''}><b>${esc(m.ad)}</b> ${esc(m.m)}</li>`).join('')||'<li class="muted">Henüz mesaj yok.</li>';
    if(stick)e.scrollTop=e.scrollHeight;
  }
  function updateClock(){
    if(!M||!M.pub)return;
    const p=M.pub,c=document.getElementById('og-clock');
    if(c&&p.phase==='el'&&p.sure){const s=Math.max(0,Math.ceil((p.sure-Date.now())/1000));c.textContent=`${s} sn`;c.className=s<=8?'on-late':'';}
    const nx=document.getElementById('og-next');
    if(nx&&p.sonSure){const s=Math.max(0,Math.ceil((p.sonSure-Date.now())/1000));nx.textContent=`Yeni el ${s} sn içinde`;}
  }
  function ownSay(text){
    const b=$o('#og-say-me');b.textContent=text;b.hidden=false;clearTimeout(M&&M.sayT);
    if(M)M.sayT=setTimeout(()=>{b.hidden=true;},4000);
  }


  /* ---------- Olaylar ---------- */
  root.addEventListener('click',e=>{
    const t=e.target;
    if(t.closest('#on-login')){B().girisYap();return;}
    if(t.closest('#on-new')){const a=document.getElementById('on-ad');if(a)lsSet(KAD,a.value.trim().slice(0,16));draft.ad='';renderKur();return;}
    const j=t.closest('[data-join]');if(j){const a=document.getElementById('on-ad');if(a)lsSet(KAD,a.value.trim().slice(0,16));joinTable(j.dataset.join);return;}
    const mk=t.closest('[data-m]');if(mk&&view==='kur'){readKur();draft.mekan=mk.dataset.m;renderKur();return;}
    const k=t.closest('[data-k]');if(k&&view==='kur'){readKur();draft.maxKoltuk=+k.dataset.k;renderKur();return;}
    const c=t.closest('[data-c]');if(c&&view==='kur'){readKur();draft.chipTL=+c.dataset.c;renderKur();return;}
    const s=t.closest('[data-s]');if(s&&view==='kur'){readKur();draft.baslangic=+s.dataset.s;renderKur();return;}
    const tt=t.closest('[data-t]');if(tt&&view==='kur'){readKur();draft.turSn=+tt.dataset.t;renderKur();return;}
    if(t.closest('#k-back')){renderLobi();listenLobby();return;}
    if(t.closest('#k-go')){createTable();return;}
  });
  root.addEventListener('input',e=>{
    if(e.target.id==='on-ad')lsSet(KAD,e.target.value.trim().slice(0,16));
    if(e.target.id==='k-ctl'&&view==='kur'){const v=+e.target.value;if(v>0){draft.chipTL=Math.min(100000,v);}}
  });
  og.addEventListener('click',e=>{
    const t=e.target;
    if(t.closest('#og-leave')){
      openModal(`<h3>${M&&M.host?'Masayı kapat?':'Masadan kalk?'}</h3><p>${M&&M.host?'Masayı kuran sensin: kapatırsan masa herkes için biter ve bilgiler silinir.':'Elin sürüyorsa çekilmiş sayılırsın.'}</p><div class="row"><button class="btn ghost" id="lv-no">Vazgeç</button><button class="btn" id="lv-yes">Evet</button></div>`);
      $('#lv-no').onclick=closeModal;$('#lv-yes').onclick=()=>{closeModal();leaveTable();};return;
    }
    if(!M)return;
    if(t.closest('#og-start')){if(M.host){M.engine.newHand();publish();}return;}
    if(t.closest('#og-fold')){sendAction('fold');return;}
    if(t.closest('#og-call')){sendAction('call');return;}
    if(t.closest('#og-raise')){if(!$o('#og-raise').disabled)sendAction('raise',M.raiseTo);return;}
    const pr=t.closest('[data-p]');
    if(pr&&M.act){
      const x=M.act,mp={min:x.minTo,half:x.cur+Math.round((x.pot+x.need)/2),tq:x.cur+Math.round((x.pot+x.need)*.75),pot:x.cur+x.pot+x.need,all:x.maxTo};
      $o('#og-amt').value=clampN(mp[pr.dataset.p],x.minTo,x.maxTo);updRaise();return;
    }
    const sp=t.closest('.stp');
    if(sp&&M.act){const x=M.act,st=Math.max(1,x.cur>0?x.minTo-x.cur:x.minTo),a=$o('#og-amt');a.value=clampN((+a.value||x.minTo)+(+sp.dataset.s)*st,x.minTo,x.maxTo);updRaise();return;}
    if(t.closest('#og-rebuy')){sitOrRebuy();return;}
    const kk=t.closest('[data-kick]');
    if(kk&&M.host){const uid=kk.dataset.kick;M.banned.add(uid);M.engine.removePlayer(uid);publish();toast('Oyuncu çıkarıldı','Bu masaya tekrar katılamaz.');return;}
    const q=t.closest('[data-q]');if(q){sendChat(q.dataset.q);$o('#og-emote-list').hidden=true;return;}
    if(t.closest('#og-emote-open')){const l=$o('#og-emote-list');l.hidden=!l.hidden;$o('#og-emote-open').setAttribute('aria-expanded',String(!l.hidden));if(!l.hidden)setTimeout(()=>{const i=$o('#og-in');if(i)i.focus();},30);return;}
    if(t.closest('#og-sound')){SAVE.settings.sound=SAVE.settings.sound===false;persist();if(typeof applySettings==='function')applySettings();$o('#og-sound').setAttribute('aria-pressed',SAVE.settings.sound!==false);sfx('deal');return;}
    if(t.closest('#og-settings')){if(typeof openSettings==='function')openSettings();return;}
  });
  og.addEventListener('input',e=>{if(e.target.id==='og-amt')updRaise();});
  og.addEventListener('submit',e=>{
    if(e.target.id==='og-form'){e.preventDefault();const i=$o('#og-in');sendChat(i.value);i.value='';$o('#og-emote-list').hidden=true;}
  });
  document.addEventListener('keydown',e=>{
    if(og.hidden||!M||!M.act||$o('#og-human').hidden||(e.target.matches&&e.target.matches('input,textarea')))return;
    const k=(e.key||'').toLowerCase();
    if(k==='f')sendAction('fold');else if(k==='c')sendAction('call');else if(k==='r'&&!$o('#og-raise').disabled)sendAction('raise',M.raiseTo);
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
  const mo=new MutationObserver(()=>{
    if(!scr.hidden){enter();return;}
    if(!og.hidden)return;                         // lobiden oyun ekranına geçildi
    stopLobby();clearInterval(pollT);if(M)leaveTable(true);view='lobi';
  });
  mo.observe(scr,{attributes:true,attributeFilter:['hidden']});mo.observe(og,{attributes:true,attributeFilter:['hidden']});
  const go=document.getElementById('go-online');if(go)go.onclick=()=>show('scr-online');
  window.VYOnline={leave:()=>leaveTable(true)};
})();
