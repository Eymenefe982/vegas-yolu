'use strict';
/* ================= Bulut kaydı (yalnızca web sürümü) =================
   Google ile giriş yapan oyuncunun kaydı Firestore'da users/{uid} belgesinde tutulur.
   Masaüstü (exe) ve telefon (apk) sürümleri bu dosyayı içermez; orada kayıt yalnızca cihazdadır. */
(()=>{
  const AYAR=window.FIREBASE_AYAR;
  if(!AYAR||!/^https?:$/.test(location.protocol)||location.hostname==='appassets.androidplatform.net')return;
  const V='10.14.1',CDN=`https://www.gstatic.com/firebasejs/${V}/`;
  const btn=$('#open-acct');
  let fb=null,auth=null,db=null,uid=null,timer=0;

  async function push(){
    clearTimeout(timer);timer=0;
    if(!uid)return;
    try{await fb.setDoc(fb.doc(db,'users',uid),{veri:JSON.stringify(SAVE),guncel:fb.serverTimestamp()});}
    catch(e){console.warn('Bulut kaydı başarısız',e);}
  }
  window.onPersist=()=>{if(uid&&!timer)timer=setTimeout(push,1500);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer)push();});

  // Ayarlar (grafik, ses, parlaklık) cihaza özeldir; buluttan yalnızca ilerleme gelir.
  function apply(data){
    const keep=SAVE.settings;
    SAVE=mergeSave(data);SAVE.settings=keep;
    try{localStorage.setItem(STORE,JSON.stringify(SAVE));}catch(e){}
    if(CUR==='scr-menu')renderMenu();
  }

  async function signedIn(user){
    uid=user.uid;
    btn.textContent=`Çıkış yap (${(user.displayName||user.email||'Hesap').split(' ')[0]})`;
    try{
      const snap=await fb.getDoc(fb.doc(db,'users',uid));
      if(snap.exists()&&snap.data().veri){apply(JSON.parse(snap.data().veri));toast('Hoş geldin','Kaydın hesabından yüklendi.');}
      else{await push();toast('Hesap bağlandı','İlerlemen artık Google hesabına kaydediliyor.');}
    }catch(e){console.warn(e);toast('Bulut kaydı okunamadı','Şimdilik bu cihaza kaydediliyor.');}
  }

  function signedOut(){
    const was=uid;uid=null;
    btn.textContent='Google ile giriş';
    // Paylaşılan cihazda bir sonraki kişi önceki hesabın ilerlemesini görmesin.
    if(was){const keep=SAVE.settings;SAVE=defSave();SAVE.settings=keep;persist();if(CUR==='scr-menu')renderMenu();}
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

  Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(f=>import(CDN+f))).then(([app,a,f])=>{
    fb=Object.assign({},a,f);
    const fa=app.initializeApp(AYAR);
    auth=a.getAuth(fa);db=f.getFirestore(fa);
    btn.hidden=false;
    a.onAuthStateChanged(auth,u=>u?signedIn(u):signedOut());
  }).catch(e=>console.warn('Firebase yüklenemedi',e));
})();
