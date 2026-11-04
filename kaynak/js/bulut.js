'use strict';
/* ================= Bulut kaydı (yalnızca web sürümü) =================
   Google ile giriş yapan oyuncunun kaydı Firestore'da vegasYolu/{uid} belgesinde tutulur.
   Çakışma koruması: belgedeki `t` (ilerlemenin son değişim zamanı) ile bu cihazın en son eşleştiği `t` karşılaştırılır.
   Başka cihazda ilerleme olmuşsa kayıt sessizce ezilmez; oyuncuya hangisinin kalacağı sorulur.
   Liderlik tablosu: vegasLider/{uid} (yalnızca oyuncu katılmayı seçtiyse, takma adla).
   Masaüstü (exe) ve telefon (apk) sürümleri bu dosyayı içermez; orada kayıt yalnızca cihazdadır. */
(()=>{
  const AYAR=window.FIREBASE_AYAR;
  if(!AYAR||!/^https?:$/.test(location.protocol)||location.hostname==='appassets.androidplatform.net')return;
  const V='10.14.1',CDN=`https://www.gstatic.com/firebasejs/${V}/`;
  const btn=$('#open-acct');
  const SYNC='vegasYolu.sync';
  let fb=null,auth=null,db=null,uid=null,user=null,timer=0,blocked=false,lastCheck=0,lastLb=0;

  const getSync=()=>{try{const s=JSON.parse(localStorage.getItem(SYNC)||'null');return s&&s.uid===uid?s:null;}catch(e){return null;}};
  const setSync=t=>{try{localStorage.setItem(SYNC,JSON.stringify({uid,t}));}catch(e){}};
  // Kayıtta gerçek ilerleme var mı (yeni oyuncu mu)?
  const hasProgress=S=>!!(S&&((S.stats&&S.stats.hands>0)||(S.conquered&&S.conquered.length)||(S.seen&&S.seen.length)||(S.cash!=null&&S.cash!==START_CASH)));
  const tarih=t=>t?new Date(t).toLocaleString('tr-TR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'bilinmiyor';
  const ozet=(S,t)=>`<b>${tl(S.cash==null?START_CASH:S.cash)}</b> cüzdan · ${nf.format((S.stats&&S.stats.hands)||0)} el · ${(S.conquered||[]).length} fethedilen masa · ${(S.seen||[]).length} ders<br><span class="muted">Son ilerleme: ${tarih(t)}</span>`;

  class Cakisma extends Error{constructor(c){super('cakisma');this.cloud=c;}}

  async function push(force){
    clearTimeout(timer);timer=0;
    if(!uid||blocked)return;
    if(!SAVE.t)SAVE.t=Date.now();
    const ref=fb.doc(db,'vegasYolu',uid);
    try{
      await fb.runTransaction(db,async tx=>{
        const snap=await tx.get(ref);
        if(!force&&snap.exists()){
          const c=snap.data(),ct=c.t||0,sy=getSync();
          if(ct&&ct>(sy?sy.t:0)&&ct!==SAVE.t)throw new Cakisma(c);
        }
        tx.set(ref,{veri:JSON.stringify(SAVE),t:SAVE.t,guncel:fb.serverTimestamp()});
      });
      setSync(SAVE.t);
      liderYolla();
    }catch(e){
      if(e instanceof Cakisma)cakismaSor(e.cloud);
      else console.warn('Bulut kaydı başarısız',e);
    }
  }
  window.onPersist=()=>{if(uid&&!blocked&&!timer)timer=setTimeout(push,1500);};
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(timer)push();return;}
    uzakKontrol();
  });

  // Ayarlar (grafik, ses, parlaklık) cihaza özeldir; buluttan yalnızca ilerleme gelir.
  function apply(data,t){
    const keep=SAVE.settings;
    SAVE=mergeSave(data);SAVE.settings=keep;SAVE.t=t||Date.now();
    delete SAVE._old;
    _fp=saveFP();
    try{localStorage.setItem(STORE,JSON.stringify(SAVE));}catch(e){}
    setSync(SAVE.t);
    if(CUR==='scr-menu')renderMenu();else if(CUR==='scr-career')renderCareer();
  }

  // İki kayıt da ilerlemiş: oyuncu seçer. Seçilene kadar buluta yazılmaz.
  function cakismaSor(c){
    if(blocked)return;
    blocked=true;clearTimeout(timer);timer=0;
    let cloud={};try{cloud=JSON.parse(c.veri);}catch(e){}
    const yerel=SAVE;
    const bulutIyi=((cloud.stats&&cloud.stats.hands)||0)>=((yerel.stats&&yerel.stats.hands)||0);
    const lock=$('#modal');
    openModal(`<span class="kicker">Kayıt çakışması</span><h3>İki farklı kayıt var</h3>
      <p>Hesabındaki kayıt ile bu cihazdaki kayıt birbirinden bağımsız ilerlemiş. Hangisini tutmak istiyorsun? Seçmediğin kayıt silinir.</p>
      <div class="cf-box ${bulutIyi?'rec':''}"><span class="kicker">Hesabındaki kayıt${bulutIyi?' · daha ilerisi':''}</span><p>${ozet(cloud,c.t)}</p><button class="btn${bulutIyi?'':' ghost'}" id="cf-cloud">Hesaptakini al</button></div>
      <div class="cf-box ${bulutIyi?'':'rec'}"><span class="kicker">Bu cihazdaki kayıt${bulutIyi?'':' · daha ilerisi'}</span><p>${ozet(yerel,yerel.t)}</p><button class="btn${bulutIyi?' ghost':''}" id="cf-local">Bu cihazdakini al</button></div>`);
    lock.dataset.lock='1';
    $('#cf-cloud').onclick=()=>{delete lock.dataset.lock;closeModal();blocked=false;apply(cloud,c.t);toast('Kayıt yüklendi','Hesabındaki kayıt bu cihaza alındı.');};
    $('#cf-local').onclick=async()=>{delete lock.dataset.lock;closeModal();blocked=false;SAVE.t=Date.now();persist();await push(true);toast('Kayıt güncellendi','Bu cihazdaki kayıt hesabına yazıldı.');};
  }

  // Başka cihazda ilerleme olduysa, oyuncu menüdeyken kaydı sessizce yenile (masadayken dokunma).
  async function uzakKontrol(){
    if(!uid||blocked||Date.now()-lastCheck<30000)return;
    if(!['scr-menu','scr-career','scr-learn'].includes(CUR)||(typeof G!=='undefined'&&G))return;
    lastCheck=Date.now();
    try{
      const snap=await fb.getDoc(fb.doc(db,'vegasYolu',uid));
      if(!snap.exists())return;
      const c=snap.data(),ct=c.t||0,sy=getSync();
      if(!ct||ct<=(sy?sy.t:0)||ct===SAVE.t)return;
      if(sy&&SAVE.t<=sy.t){apply(JSON.parse(c.veri),ct);toast('Kayıt yenilendi','Başka bir cihazdaki ilerlemen yüklendi.');}
      else cakismaSor(c);
    }catch(e){console.warn(e);}
  }

  async function signedIn(u){
    uid=u.uid;user=u;blocked=false;
    btn.textContent=`Çıkış yap (${(u.displayName||u.email||'Hesap').split(' ')[0]})`;
    try{
      const snap=await fb.getDoc(fb.doc(db,'vegasYolu',uid));
      if(!snap.exists()||!snap.data().veri){await push(true);toast('Hesap bağlandı','İlerlemen artık Google hesabına kaydediliyor.');return;}
      const c=snap.data(),ct=c.t||0,sy=getSync();
      const yerelDegisti=hasProgress(SAVE)&&(!sy||SAVE.t>sy.t);
      const bulutDegisti=!sy||ct>sy.t;
      if(!yerelDegisti){apply(JSON.parse(c.veri),ct);toast('Hoş geldin','Kaydın hesabından yüklendi.');}
      else if(!bulutDegisti){await push();}
      else cakismaSor(c);
    }catch(e){console.warn(e);toast('Bulut kaydı okunamadı','Şimdilik bu cihaza kaydediliyor.');}
  }

  function signedOut(){
    const was=uid;uid=null;user=null;blocked=false;
    btn.textContent='Google ile giriş';
    // Paylaşılan cihazda bir sonraki kişi önceki hesabın ilerlemesini görmesin.
    if(was){const keep=SAVE.settings;SAVE=defSave();SAVE.settings=keep;_fp='';persist();try{localStorage.removeItem(SYNC);}catch(e){}if(CUR==='scr-menu')renderMenu();}
  }

  btn.onclick=async()=>{
    if(!auth)return;
    if(uid){await push();await fb.signOut(auth);return;}
    try{await fb.signInWithPopup(auth,new fb.GoogleAuthProvider());}
    catch(e){
      if(e.code==='auth/popup-blocked')fb.signInWithRedirect(auth,new fb.GoogleAuthProvider());
      else if(e.code!=='auth/popup-closed-by-user'&&e.code!=='auth/cancelled-popup-request')toast('Giriş yapılamadı',e.message);
    }
  };

  /* ---------- Liderlik tablosu ---------- */
  async function liderYolla(zorla){
    const L=SAVE.lider;
    if(!uid||!L||!L.on||!fb)return false;
    if(!zorla&&Date.now()-lastLb<60000)return false;
    lastLb=Date.now();
    try{
      await fb.setDoc(fb.doc(db,'vegasLider',uid),{ad:String(L.ad||'Oyuncu').slice(0,16),net:Math.round(SAVE.cash||0),el:(SAVE.stats&&SAVE.stats.hands)||0,fetih:(SAVE.conquered||[]).length,sampiyon:SAVE.champs||0,t:fb.serverTimestamp()});
      return true;
    }catch(e){console.warn('Liderlik tablosu yazılamadı',e);return false;}
  }
  async function liderKaldir(){
    if(!uid)return;
    try{await fb.deleteDoc(fb.doc(db,'vegasLider',uid));}catch(e){console.warn(e);}
  }
  async function liderListe(){
    const q=fb.query(fb.collection(db,'vegasLider'),fb.orderBy('net','desc'),fb.limit(25));
    const s=await fb.getDocs(q);
    return s.docs.map(d=>Object.assign({id:d.id},d.data()));
  }
  window.Bulut={
    get hazir(){return !!fb;},
    get giris(){return !!uid;},
    get uid(){return uid;},
    get ad(){return user?(user.displayName||'').split(' ')[0]:'';},
    liderYolla,liderKaldir,liderListe,
    girisYap:()=>btn.click(),
  };

  Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(f=>import(CDN+f))).then(([app,a,f])=>{
    fb=Object.assign({},a,f);
    const fa=app.initializeApp(AYAR);
    auth=a.getAuth(fa);db=f.getFirestore(fa);
    btn.hidden=false;
    document.dispatchEvent(new Event('bulut-hazir'));
    a.onAuthStateChanged(auth,u=>u?signedIn(u):signedOut());
  }).catch(e=>console.warn('Firebase yüklenemedi',e));
})();
