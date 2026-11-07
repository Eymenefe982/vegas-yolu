'use strict';
// Giriş uyarıları: 1) +18 ve eğlence/rekabet bildirimi, 2) KVKK aydınlatma.
// +18 onayı her yeni oturumda, KVKK onayı bir kez (cihazda) sorulur.
(function(){
  var KVKK_SURUM='1';
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
    '.uy-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}';
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

  function kvkk(){
    if(oku('localStorage','vy_kvkk')===KVKK_SURUM)return;
    var web=/^https?:$/.test(location.protocol)&&location.hostname!=='appassets.androidplatform.net';
    popup(
      '<h2>Kişisel Verilerin Korunması (KVKK)</h2>'+
      '<p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında bilgilendirmek isteriz:</p>'+
      '<ul>'+
      '<li>Google ile giriş yaparsan ad, e-posta ve profil bilgin ile oyun ilerlemen (fiş, başarım, istatistik) kaydın cihazlar arasında sürmesi için saklanır.</li>'+
      '<li>Veriler yalnızca oyun deneyimini sağlamak ve ilerlemeni eşitlemek amacıyla işlenir; üçüncü kişilere satılmaz ya da reklam için paylaşılmaz.</li>'+
      '<li>Cihazında tercihlerini hatırlamak için yerel depolama kullanılır.</li>'+
      '<li>Verilerinin silinmesini, düzeltilmesini veya bir kopyasını istemek dahil KVKK madde 11 haklarını kullanabilirsin.</li>'+
      '</ul>'+
      (web?'<p>Ayrıntılar için <a href="gizlilik.html" target="_blank" rel="noopener">Gizlilik ve kullanım</a> sayfasına bak.</p>':'')+
      '<p>Devam ederek aydınlatma metnini okuduğunu kabul etmiş olursun.</p>',
      [{t:'Okudum, anladım',f:function(ov){yaz('localStorage','vy_kvkk',KVKK_SURUM);ov.remove();}}]
    );
  }

  function yas(){
    if(oku('sessionStorage','vy_18')==='1'){kvkk();return;}
    popup(
      '<span class="uy-badge" aria-hidden="true">+18</span>'+
      '<h2>Yaş Uyarısı</h2>'+
      '<p>Bu oyun <b>18 yaş ve üzeri</b> kullanıcılar içindir.</p>'+
      '<ul>'+
      '<li>Vegas Yolu bir <b>eğlence ve rekabet</b> oyunudur; amacı kumarı özendirmek değildir.</li>'+
      '<li>Oyunda <b>gerçek para yoktur</b>. Tüm fişler sanaldır; para yatırılamaz, çekilemez, hiçbir şeye çevrilemez.</li>'+
      '<li>Kazanılan başarımlar yalnızca oyun içi itibardır ve gerçek bir kazanç sağlamaz.</li>'+
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
