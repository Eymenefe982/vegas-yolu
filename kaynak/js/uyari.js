'use strict';
// Giriş uyarıları: 1) +18 ve eğlence/rekabet bildirimi, 2) KVKK aydınlatma, 3) cihaz seçimi (telefon / tablet / bilgisayar).
// +18 onayı her yeni oturumda, KVKK onayı bir kez (cihazda) sorulur.
(function(){
  var KVKK_SURUM='2';
  var CIP=!!window.VY_CIP;   // bağımsız Çip Masası uygulaması: yalnızca +18 uyarısı, cihaz otomatik (telefon/tablet)
  function oku(depo,k){try{return window[depo].getItem(k);}catch(e){return null;}}
  function yaz(depo,k,v){try{window[depo].setItem(k,v);}catch(e){}}

  var css=
    '.uy-ov{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(6,4,3,.88);backdrop-filter:blur(4px)}'+
    '.uy-box{width:min(520px,100%);max-height:calc(100% - 32px);overflow:auto;background:#1b1511;color:#f1e8d6;border:1px solid #352a20;border-radius:20px;padding:26px;box-shadow:0 40px 90px rgba(0,0,0,.6);display:grid;gap:14px;font-family:Manrope,system-ui,sans-serif;line-height:1.5}'+
    '.uy-badge{justify-self:start;display:inline-grid;place-items:center;min-width:56px;height:56px;border-radius:50%;border:3px solid #ddab4b;color:#ddab4b;font:800 22px/1 Manrope,system-ui,sans-serif}'+
    '.uy-box h2{margin:0;font-size:24px;color:#ddab4b;font-weight:800}'+
    '.uy-box p{margin:0;font-size:14.5px;color:#e3d9c4}'+
    '.uy-box ul{margin:0;padding-left:20px;font-size:14px;color:#e3d9c4;display:grid;gap:6px}'+
    '.uy-box a{color:#ddab4b}'+
    '.uy-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}'+
    '.uy-btn{flex:1 1 180px;min-height:44px;padding:0 18px;border-radius:999px;border:0;cursor:pointer;font:800 14px Manrope,system-ui,sans-serif;background:#ddab4b;color:#1b1511}'+
    '.uy-btn.alt{background:transparent;color:#f1e8d6;border:1px solid #5a4a38}'+
    '.uy-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}'+
    '.uy-dev{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}'+
    '.uy-dv{display:grid;justify-items:center;gap:6px;padding:16px 6px;border-radius:16px;border:1px solid #5a4a38;background:transparent;color:#f1e8d6;cursor:pointer;font:800 14px Manrope,system-ui,sans-serif}'+
    '.uy-dv svg{width:34px;height:34px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}'+
    '.uy-dv small{font-weight:600;font-size:11px;color:#b9ac94}'+
    '.uy-dv.on{border-color:#ddab4b;background:rgba(221,171,75,.14);color:#ddab4b}'+
    '.uy-dv:focus-visible{outline:2px solid #fff;outline-offset:2px}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  function popup(html,butonlar){
    var ov=document.createElement('div');ov.className='uy-ov';
    var box=document.createElement('div');box.className='uy-box';
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    box.innerHTML=html+'<div class="uy-btns"></div>';
    var bar=box.querySelector('.uy-btns');
    butonlar.forEach(function(b){
      var el=document.createElement('button');el.type='button';
      el.className='uy-btn'+(b.alt?' alt':'');el.textContent=b.t;
      el.addEventListener('click',function(){b.f(ov);});
      bar.appendChild(el);
    });
    ov.appendChild(box);document.body.appendChild(ov);
    var ilk=bar.querySelector('.uy-btn');if(ilk)ilk.focus();
    return ov;
  }

  /* ----- Cihaz: arayüz (düğme boyu, alt çubuk, masa yüksekliği) seçilen cihaza göre ayarlanır ----- */
  var CIHAZLAR=['telefon','tablet','pc'];
  function tahmin(){
    var dokunmatik=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
    var kisa=Math.min(screen.width||innerWidth,screen.height||innerHeight);
    if(!dokunmatik&&!CIP)return 'pc';
    return kisa<600?'telefon':'tablet';
  }
  function uygula(v){
    if(CIHAZLAR.indexOf(v)<0)v=tahmin();
    document.documentElement.setAttribute('data-cihaz',v);
    window.dispatchEvent(new Event('resize'));
    return v;
  }
  uygula(oku('localStorage','vy_cihaz'));   // popup gelmeden önce de makul bir varsayılan: kayıtlı seçim ya da tahmin
  function cihazSor(bitti){
    var oneri=oku('localStorage','vy_cihaz')||tahmin();
    var ic={
      telefon:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>',
      tablet:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.2"/><path d="M11 18h2"/></svg>',
      pc:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>'
    };
    var ad={telefon:['Telefon','Dikey, tek elle'],tablet:['Tablet','Orta ekran, dokunmatik'],pc:['Bilgisayar','Fare ve klavye']};
    var html='<h2>Hangi cihazdan oynuyorsun?</h2><p>Arayüzü cihazına göre düzenleyeyim: telefonda hamle düğmeleri her zaman ekranın altında kalır. Daha sonra Ayarlar\'dan değiştirebilirsin.</p><div class="uy-dev">'+
      CIHAZLAR.map(function(k){return '<button type="button" class="uy-dv'+(k===oneri?' on':'')+'" data-c="'+k+'">'+ic[k]+ad[k][0]+'<small>'+ad[k][1]+'</small></button>';}).join('')+'</div>';
    var ov=popup(html,[]);
    ov.querySelectorAll('.uy-dv').forEach(function(b){b.addEventListener('click',function(){
      var v=uygula(b.getAttribute('data-c'));yaz('localStorage','vy_cihaz',v);ov.parentNode.removeChild(ov);if(typeof bitti==='function')bitti(v);
    });});
    var on=ov.querySelector('.uy-dv.on');if(on)on.focus();
  }
  window.VYCihaz={
    get:function(){return document.documentElement.getAttribute('data-cihaz')||tahmin();},
    set:function(v){v=uygula(v);yaz('localStorage','vy_cihaz',v);return v;},
    sor:cihazSor
  };
  function cihaz(){if(!oku('localStorage','vy_cihaz'))cihazSor();}

  function kvkk(){
    if(oku('localStorage','vy_kvkk')===KVKK_SURUM){cihaz();return;}
    var web=/^https?:$/.test(location.protocol)&&location.hostname!=='appassets.androidplatform.net';
    popup(
      '<h2>Kişisel Verilerin Korunması (KVKK)</h2>'+
      '<p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında bilgilendirmek isteriz:</p>'+
      '<ul>'+
      '<li>Google ile giriş yaparsan ad, e-posta ve profil bilgin ile oyun ilerlemen (fiş, başarım, istatistik) kaydın cihazlar arasında sürmesi için saklanır.</li>'+
      '<li>Veriler yalnızca oyun deneyimini sağlamak ve ilerlemeni eşitlemek amacıyla işlenir; üçüncü kişilere satılmaz ya da reklam için paylaşılmaz.</li>'+
      '<li>Cihazında tercihlerini hatırlamak için yerel depolama kullanılır.</li>'+
      '<li><b>Online mod:</b> online masaya katılırsan takma adın, karakterin, çip miktarın, hamlelerin ve masaya yazdığın mesajlar masadaki diğer oyunculara görünür ve masa açık kaldığı sürece sunucuda tutulur; masa kapanınca silinir. Mesajlarda kişisel bilgi paylaşma. Online mod isteğe bağlıdır, yalnızca eğlence ve rekabet içindir ve gerçek para içermez.</li>'+
      '<li>Verilerinin silinmesini, düzeltilmesini veya bir kopyasını istemek dahil KVKK madde 11 haklarını kullanabilirsin.</li>'+
      '</ul>'+
      (web?'<p>Ayrıntılar için <a href="gizlilik.html" target="_blank" rel="noopener">Gizlilik ve kullanım</a> sayfasına bak.</p>':'')+
      '<p>Devam ederek aydınlatma metnini okuduğunu kabul etmiş olursun.</p>',
      [{t:'Okudum, anladım',f:function(ov){yaz('localStorage','vy_kvkk',KVKK_SURUM);ov.remove();cihaz();}}]
    );
  }

  function yasCip(){
    if(oku('sessionStorage','vy_18')==='1')return;
    popup(
      '<span class="uy-badge" aria-hidden="true">+18</span>'+
      '<h2>Çip Masası</h2>'+
      '<p>Bu araç, arkadaşlarınla <b>gerçek kartla</b> oynarken çipleri ve bahisleri takip eder. <b>18 yaş ve üzeri</b> içindir.</p>'+
      '<ul>'+
      '<li>Uygulama para tutmaz, para aktarmaz, bahse aracılık etmez; yalnızca çip sayar.</li>'+
      '<li>Gerçek paralı kumar <b>Türkiye’de yasaktır</b>. Çip değerini eğlence ve puan için kullan; para karşılığı oynamanın sorumluluğu oynayanlara aittir.</li>'+
      '<li>Kumar bağımlılık yapabilir. Yardım için 112 / ALO 182.</li>'+
      '</ul>',
      [
        {t:'18 yaşındayım, devam et',f:function(ov){yaz('sessionStorage','vy_18','1');ov.remove();}},
        {t:'18 yaşından küçüğüm',alt:true,f:function(ov){
          ov.querySelector('.uy-box').innerHTML='<span class="uy-badge" aria-hidden="true">+18</span><h2>Erişim engellendi</h2><p>Bu içerik 18 yaşından küçükler için uygun değildir. Lütfen uygulamayı kapat.</p>';
        }}
      ]
    );
  }

  function yas(){
    if(CIP){yasCip();return;}
    if(oku('sessionStorage','vy_18')==='1'){kvkk();return;}
    popup(
      '<span class="uy-badge" aria-hidden="true">+18</span>'+
      '<h2>Yaş Uyarısı</h2>'+
      '<p>Bu oyun <b>18 yaş ve üzeri</b> kullanıcılar içindir.</p>'+
      '<ul>'+
      '<li>Vegas Yolu bir <b>eğlence ve rekabet</b> oyunudur; amacı kumarı özendirmek değildir.</li>'+
      '<li>Oyunda <b>gerçek para yoktur</b>. Tüm fişler sanaldır; para yatırılamaz, çekilemez, hiçbir şeye çevrilemez.</li>'+
      '<li>Kazanılan başarımlar yalnızca oyun içi itibardır ve gerçek bir kazanç sağlamaz.</li>'+
      '<li>Gerçek paralı kumar <b>Türkiye’de yasaktır</b>. Burada öğrendiklerini gerçek parayla oynamaya taşıma.</li>'+
      '</ul>'+
      '<p>Kumar bağımlılık yapabilir. Yardıma ihtiyaç duyarsan bir uzmana ya da 112 / ALO 182 hatlarına başvurabilirsin.</p>',
      [
        {t:'18 yaşındayım, devam et',f:function(ov){yaz('sessionStorage','vy_18','1');ov.remove();kvkk();}},
        {t:'18 yaşından küçüğüm',alt:true,f:function(ov){
          ov.querySelector('.uy-box').innerHTML=
            '<span class="uy-badge" aria-hidden="true">+18</span><h2>Erişim engellendi</h2>'+
            '<p>Bu içerik 18 yaşından küçükler için uygun değildir. Lütfen siteden ayrıl.</p>';
        }}
      ]
    );
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',yas);else yas();
})();
