'use strict';
/* ================= Ek özellikler: bildirim, başarımlar, masa muhabbeti =================
   sahne.js ve oyun.js'den önce yüklenir. Burada yalnızca sabit ve fonksiyon tanımlanır;
   global durum (SAVE, G, VENUES, Sahne…) fonksiyonlar çağrıldığında okunur. */

/* ---------- Bildirim ---------- */
function toast(title,body,kind){
  const box=document.getElementById('toasts');if(!box)return;
  const el=document.createElement('div');el.className='toast'+(kind?' '+kind:'');
  el.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4v3h-4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b></b><span></span></div>';
  el.querySelector('b').textContent=title;el.querySelector('span').textContent=body||'';
  box.appendChild(el);
  while(box.children.length>3)box.firstChild.remove();
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),500);},4300);
}

/* ---------- Başarımlar ---------- */
const ACH_BASE=[
  {id:'g-rulet',t:'Çark Senden Yana',d:'Bir rulet masasını fethet.'},
  {id:'g-blackjack',t:'Yirmi Bir',d:'Bir blackjack masasını fethet.'},
  {id:'g-bakara',t:'Punto Banco',d:'Bir bakara masasını fethet.'},
  {id:'g-batak',t:'Batak Ustası',d:'Bir batak masasında beş elin sonunda birinci ol.'},
  {id:'rulet-sayi',t:'Tam İsabet',d:'Rulette tek bir sayıya oynayıp tuttur.'},
  {id:'bj-21',t:'Blackjack!',d:'İlk iki kartla 21 yap.'},
  {id:'ilk-el',t:'İlk Pot',d:'Kariyer masalarında bir eli kazan.'},
  {id:'blof',t:'Gözü Kara',d:'Flop sonrası en fazla bir perle, bahisle herkesi çekilmeye zorla.'},
  {id:'allin-zafer',t:'Ya Hep Ya Hiç',d:'All-in yap ve showdown\'da potu kazan.'},
  {id:'ful',t:'Ful Evi',d:'Ful ya da daha iyi bir elle showdown kazan.'},
  {id:'kare',t:'Dört Papaz',d:'Kare ya da daha iyisini yap.'},
  {id:'royal',t:'Kraliyet Ailesi',d:'Royal floş yap.'},
  {id:'buyuk-pot',t:'Koca Pot',d:'Bir elde 60 büyük körlük pot kazan.'},
  {id:'seri5',t:'Kızgın Seri',d:'Fişlerini azaltmadan üst üste 5 el kazan.'},
  {id:'son-nefes',t:'Son Nefes',d:'Fişin 5 büyük körün altındayken bir eli kazan.'},
  {id:'milyoner',t:'Milyoner',d:'Bir masada 1.000.000 fişe ulaş.'},
  {id:'kotu-sans',t:'Kötü Şans',d:'Ful ya da daha iyisiyle potu kaybet.'},
  {id:'yuzuncu',t:'Yüzüncü El',d:'Toplam 100 el oyna.'},
  {id:'sohbet',t:'Masa Muhabbeti',d:'Masada rakiplerine bir şey söyle.'},
  {id:'egitim',t:'Öğrenci',d:'Eğitimdeki bütün dersleri bitir.'},
  {id:'quiz10',t:'Keskin Göz',d:'Alıştırmalarda üst üste 10 doğru cevap ver.'},
];
const Ach=(()=>{
  const list=()=>ACH_BASE.concat(VENUES.map(v=>({id:'v-'+v.id,t:v.name,d:v.city+' masasını fethet.'})),[{id:'vegas-yolu',t:'Vegas Yolu',d:'Bütün masaları fethet.'}]);
  function unlock(id){
    if(!SAVE.ach)SAVE.ach={};
    if(SAVE.ach[id])return false;
    const a=list().find(x=>x.id===id);if(!a)return false;
    SAVE.ach[id]=Date.now();persist();
    toast('Başarım: '+a.t,a.d);try{SFX.play('ach');}catch(e){}
    return true;
  }
  // El bitince çağrılır: i = {me, g, showdown, cat, won}
  function hand(i){
    const {me,g,showdown,cat,won}=i;
    if(g.venue.training)return;
    if(won>0){
      unlock('ilk-el');
      if(!showdown&&g.meRaised&&cat!=null&&cat<=1&&g.board.length>=3)unlock('blof');
      if(showdown&&me.allIn)unlock('allin-zafer');
      if(showdown&&cat>=6)unlock('ful');
      if(won>=60*g.bb)unlock('buyuk-pot');
      if(me.startChips<5*g.bb)unlock('son-nefes');
    }
    if(showdown&&cat!=null){
      if(cat>=7)unlock('kare');
      if(cat===9)unlock('royal');
      if(won===0&&cat>=6)unlock('kotu-sans');
    }
    if((g.streak||0)>=5)unlock('seri5');
    if(me.chips>=1e6)unlock('milyoner');
    if(SAVE.stats.hands>=100)unlock('yuzuncu');
  }
  return {list,unlock,hand,count:()=>list().filter(a=>SAVE.ach&&SAVE.ach[a.id]).length};
})();
function openAch(){
  const L=Ach.list();
  openModal(`<h3>Başarımlar</h3><p class="muted">${Ach.count()} / ${L.length} açıldı</p>
    <ul class="ach-list">${L.map(a=>{const on=SAVE.ach&&SAVE.ach[a.id];return `<li class="${on?'on':''}"><i aria-hidden="true"></i><div><b>${a.t}</b><span>${a.d}</span></div></li>`;}).join('')}</ul>
    <div class="row"><button class="btn" id="ach-close">Kapat</button></div>`);
  document.getElementById('ach-close').onclick=()=>{closeModal();};
}

/* ---------- Masa muhabbeti ----------
   Rakipler oyun tarzına göre konuşur; konuşkan olanlar (chatty) ve duygusunu belli edenler daha sık.
   Üst masalarda oyuncular daha az konuşur. Balon başın üstünde çıkar, ağız konuşma süresince oynar. */
const TALK={
  gevsek:{
    raise:['Hadi bir de ben artırayım, ne olacak!','Eğlence başlasın!','Bir de ben koyayım şuraya.'],
    call:['Göreyim bakalım.','Ben buradayım!','Ucuz, görürüm.'],
    fold:['Neyse, bir dahaki ele.','Bu bana göre değil.','Çekiliyorum, çekiliyorum.'],
    check:['Pas.','Kontrol, kontrol.'],
    allin:['Hepsini koyuyorum, ya gelirse!','Hadi gör bakalım hepsini!'],
    win:['Bak sen şu işe!','Güzel el, güzel el!','Sağ olun, sağ olun.'],
    lose:['Eh, şansım yokmuş.','Olur o kadar.','Ya bu nasıl el!'],
    greet:['Hoş geldin, otur otur!','Bir yüz daha, güzel!'],
    idle:['Kimse bir şey söylemiyor, ne bu sessizlik?','Bu masada hep böyle olur.','Bir şeyler içelim mi?'],
  },
  kaya:{
    raise:['Dikkat et.','Boşuna artırmam.','Sana söylemiş olayım.'],
    call:['Görüyorum.','Devam.'],
    fold:['Bırakıyorum.','Zamanı değil.'],
    check:['Kontrol.'],
    allin:['Hepsi.','Buna hazırdım.'],
    win:['Teşekkürler.','Sabrın karşılığı.'],
    lose:['Olur.','Güzel oynadın.'],
    greet:['Hoş geldin.','Buyur.'],
    idle:['...','Sabır, sabır.'],
  },
  manyak:{
    raise:['Hadi bakalım, korkma!','Parayı koy da görelim!','Bu pot benim!'],
    call:['Gör bakalım ne var.','Gelsene!'],
    fold:['Hay allah!','Şanslısın bu sefer.'],
    check:['Bekliyorum.'],
    allin:['HEPSİ ORTADA!','Cesaretin varsa gör!','Ya hep ya hiç!'],
    win:['Yürü be!','Toplayın fişleri!'],
    lose:['Bu kadar şansızlık olmaz!','Yok artık!','Kartlar mı karışık bunlar?'],
    greet:['Yeni kurban mı geldi?','Gel bakalım, oyna da görelim!'],
    idle:['Bu masa çok yavaş!','Hadi artık biri bir şey yapsın.','Fişler bekliyor!'],
  },
  kopekbaligi:{
    raise:['Fiyat bu.','Hesabı biliyorsun.','Bunu görmek pahalıya gelir.'],
    call:['Görüyorum.','Devam.'],
    fold:['Anlaşıldı.','Geçiyorum.'],
    check:['Kontrol.'],
    allin:['Hepsi. Karar senin.','Hesap açık.'],
    win:['Beklediğim gibi.','Teşekkürler.'],
    lose:['Varyans.','Bir sonrakinde.'],
    greet:['Hoş geldin.','Seni izleyeceğim.'],
    idle:['Matematik yalan söylemez.','Sessizlik de bir bilgidir.'],
  },
  tilki:{
    raise:['Bakalım nasıl tepki vereceksin.','Seni okuyorum.','Biraz baskı iyidir.'],
    call:['Merak ettim.','Hmm, görürüm.'],
    fold:['Yemedim.','Bu sefer sizin olsun.'],
    check:['Pas, pas.'],
    allin:['Hepsini koyuyorum, inanıyor musun?','Blöf mü, değil mi?'],
    win:['Bir hamle öne geçtim.','Dediğim gibi.'],
    lose:['İlginç.','Peki, bakalım sonra.'],
    greet:['Hoş geldin, seni merak ediyordum.','Otur, bir çay iç.'],
    idle:['Bu masada herkes bir şey saklıyor.','Kim blöf yapıyor, kim yapmıyor... hepsini göreceğiz.'],
  },
};
// Mekâna göre ara sıra söylenen laflar
const VENUE_TALK={
  antrenman:['Rahat oyna, burası alıştırma.','Acele yok.'],
  kacak:['Dışarıda araba sesi var, sustunuz mu?','Şu ampul yine sallanıyor.','Kapıdaki çocuk ıslık çalarsa kartları topluyoruz.'],
  kiraathane:['Çaylar tazelensin!','Tavla sesi gelmiyor bu akşam.','Maç kaç kaç oldu?'],
  yeralti:['Perde çekili, kimse görmedi.','Bu kulüpte herkes herkesi tanır.'],
  han:['Körler yine yükseliyor...','Hanın avlusunda saat hiç durmaz.','Turnuvada sabır, her şeydir.'],
  yali:['Boğaz bu gece çok güzel.','Şu manzaraya bakın, kim para düşünür?','Yalıda kaybetmek bile şıktır.'],
  girne:['Liman ışıkları ne güzel.','Rulet masası bu akşam hareketli.'],
  monte:['Burada ses yükseltmek ayıp sayılır.','Avize bu gece çok parlıyor.'],
  macau:['Fenerler bu yıl daha kırmızı.','Sayıları hiç unutmam.'],
  vegas:['Vegas hiç uyumaz!','Slotlar bu gece çok konuşuyor.','Burası şans değil, sermaye şehri.'],
  suit:['Aşağıdaki ışıklara bakın. Hepsi bizim için.','Bu odada rakam bir şey ifade etmez.','Şampanya taze mi?'],
};
// Karaktere özel laflar (isteğe bağlı)
const CHAR_LINES={
  'Çaycı Hasan':{idle:['Çay tazeleyeyim mi?','Bu masanın çayı hiç bitmez.','Şeker kaç tane olsun abi?'],win:['Çay benden!']},
  'Kasap Hüsnü':{idle:['Dün koç kestim, bugün pot keseceğim.'],raise:['Kırk yıllık kasabım, kemiği ayırırım!']},
  'Tespihçi Rıza':{idle:['Elhamdülillah...','Tespih çekilir, el gelir.']},
  'Kahveci Necdet':{idle:['Çay ocağı benden, yorulmayın.','Şu masaya bir semaver daha lazım.'],win:['Kahve bedava, bu el benim!']},
  'Taksici Orhan':{idle:['Bütün gece yoldaydım, şans yanımda.','İstanbul trafiği gibi bu el!']},
  'Berber Salih':{idle:['Kartları da briyantin gibi düzeltirim.'],raise:['Tıraş oldun mu? Bu pot tam yakışır.']},
  'Halıcı Nusret':{idle:['Pazarlık benim işim.','Bu eli sana iyi fiyata veririm.'],raise:['Son fiyat bu, pazarlık yok!']},
  'Cevahirci Selim':{idle:['Her taşın bir değeri var.']},
  'Lucky Lou':{idle:['Vegas, baby! Burası hiç uyumaz!','Şansım bu gece sıcak, sıcak!'],win:['Lucky Lou geri döndü!'],allin:['ŞANS BENDEN YANA!']},
  'Tex Morgan':{idle:['Teksas\'ta bu işi at üstünde yaparız.'],raise:['Botlarım kadar sağlam.']},
  'Isabella':{idle:['Şampanya bitmeden bu el bitmez.']},
  'Tycoon Wu':{idle:['Para sevdiği insanı bulur.','Ha ha, bu gece yemek benden!'],win:['Şans değil, plan!']},
  'Khalid Al-Rashid':{idle:['Bu odadaki en ucuz şey bahsiniz.'],raise:['Rakam sizi korkutmasın.']},
  'The Kid Jaden':{idle:['Bro, bu masa çok yavaş.','Yirmi iki yaşında milyoner olmak kolaydı.'],allin:['YOLO!'],win:['Easy money!']},
  'Viktor':{idle:['Na zdorovye!','Rusya\'da kış, burada oyun.']},
  'Signora Bianchi':{idle:['Ah, canım, para sadece kâğıt!','Şampanya, şampanya!'],win:['Mamma mia, yine ben!']},
  'Harold Briggs':{idle:['Petrol kuyum bu masadan daha çok verir.','Texas\'ta olsa şimdiye kadar iki ev almıştım.']},
};
const EMOTE_REPLY={
  nice:{gevsek:['Teşekkürler!','Sen de iyisin!'],kaya:['Sağ ol.'],manyak:['Bir sonrakinde görürsün.','Daha iyisi gelecek.'],kopekbaligi:['Teşekkürler.'],tilki:['Sağ ol, seni de izliyorum.']},
  go:{gevsek:['Acele yok, acele yok.','Bir dakika, düşünüyorum!'],kaya:['...'],manyak:['Sabırsızlanma!','Sen önce koy!'],kopekbaligi:['Süre benim.'],tilki:['Sakin ol, güzel şeyler beklemekle olur.']},
  lucky:{gevsek:['Haklısın, şansım bu gece!','Hah, belki!'],kaya:['Şans diye bir şey yok.'],manyak:['Şans mı? Beceri be!'],kopekbaligi:['Kanıtla.'],tilki:['Öyle mi dersin?']},
  bluff:{gevsek:['Bilmem ki, belki!','Hadi gör de anla!'],kaya:['...Belki.'],manyak:['Gör de anla!'],kopekbaligi:['Sen söyle.'],tilki:['Hmm. Blöf kokusu mu aldın?']},
};
// Masayı daha önce fethetmiş oyuncuya selam: tanınırlık seviyesine (1-3) ve tarza göre
const REP_GREET={
  1:{gevsek:['Aa, sen geçen sefer masayı silip süpürmüştün!','Yine mi sen? Hoş geldin, hoş geldin!'],kaya:['Seni hatırlıyorum.','Yine geldin demek.'],manyak:['Geçen seferin rövanşı bugün!','Şansın yine yaver gider mi bakalım.'],kopekbaligi:['Geçen sefer iyi oynadın. Bugün göreceğiz.'],tilki:['Seni unutmadım. Bu sefer hazırlıklıyım.']},
  2:{gevsek:['Hocam buyur, baş köşeye geç!','Herkes senden bahsediyor, otur otur!'],kaya:['Hoş geldin usta.','Ünün senden önce geldi.'],manyak:['Herkes senden korkuyor, ben korkmuyorum!','Ünlü adam geldi, düşürelim şunu!'],kopekbaligi:['Adını duydum. Bakalım hak ediyor musun.'],tilki:['Ünlü misafirimiz. Gözüm üstünde olacak.']},
  3:{gevsek:['Usta geldi! Bir fotoğraf çektirebilir miyiz?','Efendim, şeref verdiniz!'],kaya:['Masa senin, usta.','Efsane geri döndü.'],manyak:['Efsaneyi indirmek bana kısmet olacak!','Bugün tahtından ineceksin!'],kopekbaligi:['Efsaneyle oynamak... ilginç olacak.'],tilki:['Herkes senin için burada. Ben de.']},
};
const Talk=(()=>{
  const R=Math.random,pick=a=>a[Math.floor(R()*a.length)];
  const alive=p=>G&&!p.human&&!p.out&&SAVE.settings.talk!==false;
  const ex=p=>(p.char&&p.char.expr)||1;
  function say(p,txt,ms){
    if(!G||!alive(p)||p._sayUntil>Date.now())return;
    ms=ms||Math.max(2000,txt.length*75+1000);p._sayUntil=Date.now()+ms+500;
    if(G.v3)Sahne.say(p,txt,ms);
    else{const el=p.el&&p.el.querySelector('.s-say');if(el){el.textContent=txt;el.classList.add('on');clearTimeout(p._sayT);p._sayT=setTimeout(()=>el.classList.remove('on'),ms);}}
    addLog(`${p.name}: “${txt}”`,'talk');
  }
  const pool=(p,kind)=>{
    const own=CHAR_LINES[p.name]&&CHAR_LINES[p.name][kind];
    const st=(TALK[p.style]||TALK.gevsek)[kind]||[];
    if(own&&(!st.length||R()<.5))return own;
    return st;
  };
  function event(p,kind){
    if(!alive(p))return;
    const sk=G.venue.skill,chat=p.char&&p.char.chatty?1.7:1;
    const base={raise:.3,call:.1,fold:.1,check:.04,allin:1,win:.6,lose:.42}[kind];
    if(base==null)return;
    let pr=base*Math.max(.4,Math.min(1.6,ex(p)))*chat*(sk>.7?.55:1);
    if(kind==='allin')pr=.95;
    if(R()>pr)return;
    const a=pool(p,kind);if(a.length)say(p,pick(a));
  }
  function idle(){
    if(!G||G.phase==='idle')return;
    const c=G.players.filter(p=>alive(p)&&p.inHand!==undefined&&G.turn!==p.idx);
    if(!c.length)return;
    const p=pick(c),chat=p.char&&p.char.chatty;
    if(R()>(chat?.6:.14)*(G.venue.skill>.7?.5:1))return;
    const pool2=[];
    if(CHAR_LINES[p.name]&&CHAR_LINES[p.name].idle)pool2.push(...CHAR_LINES[p.name].idle);
    pool2.push(...(TALK[p.style]||TALK.gevsek).idle);
    if(VENUE_TALK[G.venue.id])pool2.push(...VENUE_TALK[G.venue.id]);
    say(p,pick(pool2));
  }
  function greet(){
    if(!G)return;
    const rl=G.rl||0;
    const c=G.players.filter(p=>alive(p)).sort(()=>R()-.5).slice(0,rl>=2?3:2);
    c.forEach((p,i)=>setTimeout(()=>{
      if(!G)return;
      // Tanınan oyuncuyu masa adıyla karşılar; efsaneye kalkıp saygı gösterirler.
      const known=rl&&REP_GREET[rl]&&REP_GREET[rl][p.style];
      say(p,pick(known||(TALK[p.style]||TALK.gevsek).greet));
      if(G.v3)Sahne.act(p,rl>=3&&p.style!=='manyak'&&R()<.5?'clap':'nod');
    },700+i*1400));
  }
  function start(){
    const g=G;
    const tick=()=>{if(!G||G!==g)return;try{idle();}catch(e){}g._talkTo=setTimeout(tick,5500+R()*6500);};
    g._talkTo=setTimeout(tick,7000);
  }
  // Oyuncunun masaya söylediği şeye karşılık
  function respond(kind){
    if(!G)return;
    const c=G.players.filter(p=>alive(p)&&p.inHand!==undefined).sort(()=>R()-.5).slice(0,2);
    c.forEach((p,i)=>setTimeout(()=>{
      if(!G)return;
      const rep=(EMOTE_REPLY[kind]||{})[p.style];
      if(rep&&(i===0||R()<.5))say(p,pick(rep));
      if(G.v3){
        if(kind==='lucky'&&p.style==='manyak')Sahne.act(p,'shrug');
        else if(kind==='nice')Sahne.act(p,'nod');
        else if(kind==='bluff'&&(p.style==='tilki'||p.style==='kopekbaligi'))Sahne.act(p,'stare',{dur:2.5});
        else if(kind==='lucky'||kind==='go')Sahne.act(p,R()<.5?'headShake':'attend',{i:0,dur:1.6});
      }
      // Manyak ve gevşek tipler laf atılınca biraz kızar; kaya ve köpekbalığı aldırmaz
      if(kind==='lucky'&&(p.style==='manyak'||p.style==='gevsek'))p.tilt=Math.min(1,(p.tilt||0)+.12);
    },900+i*1300+R()*500));
  }
  // Büyük pottan sonra masanın tepkisi
  function afterShowdown(){
    if(!G||!G.v3)return;
    const me=G.players[0];
    const others=G.players.filter(q=>!q.human&&!q.out&&q.inHand);
    const h=G.handNo,fire=(q,v,d)=>setTimeout(()=>{if(G&&G.handNo===h&&!q.out)Sahne.act(q,v);},d);
    if(me.won>=G.bb*15){
      others.forEach(q=>{if(R()<.4*ex(q)){const v=(q.style==='gevsek'||q.style==='tilki')&&R()<.55?'clap':(q.style==='manyak'?'headShake':'nod');fire(q,v,1000+R()*900);}});
    }else{
      const w=G.players.filter(q=>!q.human&&q.won>=G.bb*15)[0];
      if(w)others.filter(q=>q!==w).forEach(q=>{if(R()<.28*ex(q))fire(q,pick(['sigh','headShake','shrug']),1000+R()*900);});
    }
  }
  // Başkası all-in yapınca masadakiler irkilir
  function react(p,kind){
    if(!G||!G.v3||kind!=='allin')return;
    G.players.forEach(q=>{if(q===p||q.human||q.out||!q.inHand||q.folded)return;if(R()<.3*ex(q))setTimeout(()=>{if(G&&!q.out)Sahne.act(q,'gasp');},350+R()*500);});
  }
  return {say,event,idle,greet,start,respond,afterShowdown,react};
})();

/* ---------- Oyuncunun masa muhabbeti düğmeleri ---------- */
function toggleEmotes(){
  const l=document.getElementById('emote-list'),b=document.getElementById('emote-open');
  l.hidden=!l.hidden;b.setAttribute('aria-expanded',String(!l.hidden));
}
function emoteSay(kind,text){
  if(!G)return;
  const now=Date.now();if(now<(G._emCd||0))return;G._emCd=now+3400;
  const b=document.getElementById('say-me');b.textContent=text;b.hidden=false;
  clearTimeout(G._emT);G._emT=setTimeout(()=>{b.hidden=true;},2700);
  document.getElementById('emote-list').hidden=true;document.getElementById('emote-open').setAttribute('aria-expanded','false');
  addLog(`Sen: “${text}”`,'me');
  Talk.respond(kind);Ach.unlock('sohbet');
}
