'use strict';
/* ================= MIT 15.S50 motoru =================
   Kaynak: MIT OpenCourseWare, 15.S50 "Poker Theory and Analytics" (Ocak 2015).
   Ders notlarındaki kurallar (aralıklar, M oranı bölgeleri, push/fold tabloları, devam bahsi büyüklüğü,
   blöf/savunma sıklığı, kabarcık/ICM) burada kendi ifademizle koda döküldü.
   Üç yerde kullanılır: rakip botların kararları (botDecide sarmalayıcısı), antrenman koçu, eğitim dersleri (mit-ders.js).
   oyun.js ve ekstra.js'ten sonra yüklenir. */

const MIT=(()=>{
  const LV=[5,10,20,30,50,100];                       // MIT'nin ezberlenecek yüzde aralıkları
  const HRM={0:1,1:.55,2:.30,3:.20,4:.10,5:.05};      // sıra bekleyen oyuncu sayısına göre çağrı çarpanı
  const hv=c=>(c>>2)+2;                               // 2..14
  const info=cs=>{let a=hv(cs[0]),b=hv(cs[1]);if(b>a){const t=a;a=b;b=t;}return {hi:a,lo:b,pair:a===b,suited:(cs[0]&3)===(cs[1]&3)};};

  /* Aralık seviyesi: elin girdiği en dar MIT aralığı.
     %5: TT+, AQ+ · %10: 55+, AT+ · %20: 22+, A2+, KQ · %30: 22+, A2+, iki Broadway · %50: çift ya da kart toplamı ≥16 */
  function level(cs){
    const h=info(cs);
    if((h.pair&&h.hi>=10)||(h.hi===14&&h.lo>=12))return 5;
    if((h.pair&&h.hi>=5)||(h.hi===14&&h.lo>=10))return 10;
    if(h.pair||h.hi===14||(h.hi===13&&h.lo===12))return 20;
    if(h.lo>=10)return 30;
    if(h.hi+h.lo>=16)return 50;
    return 100;
  }
  // limit sürekli bir yüzde olabilir (örn. 15): iki seviye arasındaki ellere olasılıkla evet denir.
  function inRange(lv,limit){
    if(lv<=limit)return true;
    const i=LV.indexOf(lv),prev=i>0?LV[i-1]:0;
    return limit>prev&&rnd()<(limit-prev)/(lv-prev);
  }
  const stepLv=(lim,n)=>{if(!n)return lim;let i=LV.findIndex(x=>x>=lim);if(i<0)i=LV.length-1;return LV[clamp(i+n,0,LV.length-1)];};

  /* Pozisyon: masadaki oturanlara göre BTN, SB, BB, EP, MP, CO */
  function order(){const g=G,r=[];let i=g.dealer;do{if(g.players[i].inHand)r.push(i);i=(i+1)%g.players.length;}while(i!==g.dealer);return r;}
  function posOf(p){
    const o=order(),n=o.length,i=o.indexOf(p.idx);
    if(n===2)return i===0?'SB':'BB';
    if(i===0)return 'BTN';if(i===1)return 'SB';if(i===2)return 'BB';
    if(i===n-1)return 'CO';
    return i===3?'EP':'MP';
  }
  // Ön-flop sırasında benden sonra konuşacak (katlamamış, all-in olmamış) oyuncu sayısı
  function leftToAct(p){
    const g=G,o=order(),n=o.length;
    const pre=n>2?o.slice(3).concat(o.slice(0,3)):o;
    const k=pre.indexOf(p.idx);
    return pre.slice(k+1).filter(i=>{const q=g.players[i];return !q.folded&&!q.allIn;}).length;
  }
  function M(p,eff){
    const g=G,n=g.players.filter(q=>q.inHand).length,cost=g.sb+g.bb+g.ante*n;
    let st=(p.startChips!=null?p.startChips:p.chips+p.bet);
    if(eff){const big=Math.max(0,...g.players.filter(q=>q!==p&&q.inHand&&!q.folded).map(q=>(q.startChips!=null?q.startChips:q.chips+q.bet)));if(big)st=Math.min(st,big);}
    return cost>0?st/cost:99;
  }
  function zone(m){
    return m<2?['Ölü bölge','dead']:m<8?['Çalma bölgesi','steal']:m<12?['Çalma / yeniden çalma','resteal']:m<30?['Değer bahsi bölgesi','value']:['Set avı bölgesi','set'];
  }

  /* Push (all-in) sınırı: bu yüzdeye kadarki elleri sür. MIT'nin tutucu tabloları.
     Her pozisyondan %10 (AT+, 55+). Broadway (%30): M=1'de her yerden, geç pozisyonda M≈5, cutoff'ta M≈10.
     Herhangi iki kart: geç pozisyonda M=1, butonda M≈4-5, küçük kör M≈10. M<1 her yerden çok geniş. */
  function pushLimit(pos,m,hu){
    if(m<1)return 100;
    if(hu){return m<=1.5?100:m<=6?75:m<=10?50:30;}
    if(m<=1.5)return (pos==='CO'||pos==='BTN'||pos==='SB')?100:30;
    if(pos==='SB')return m<=10?100:20;
    if(pos==='BTN')return m<=4.5?100:m<=10?30:20;
    if(pos==='CO')return m<=10?30:15;
    if(pos==='MP')return m<=3?20:10;
    return 10;                                          // EP, BB
  }
  // Küçük körde (BB) heads-up çağrı çarpanı: BB çağrı% = SB push% × çarpan
  function huCall(m){
    const T=[[1,10],[2,2],[4,1],[6,.667],[9,.5]];
    if(m<=T[0][0])return T[0][1];
    for(let i=1;i<T.length;i++)if(m<=T[i][0]){const [x0,y0]=T[i-1],[x1,y1]=T[i];return y0+(y1-y0)*(m-x0)/(x1-x0);}
    return .5;
  }
  const styleStep=s=>s==='manyak'?1:s==='kaya'?-1:0;

  /* Açılış ve artışa karşı aralıklar (M ≥ 10): Harrington / MIT ders notları */
  function openRange(pos,cs){
    const h=info(cs);
    const ep=(h.pair&&h.hi>=10)||(h.hi===14&&h.lo>=12&&(h.suited||h.lo===13));
    if(pos==='EP'||pos==='SB'||pos==='BB')return ep;
    const mp=(h.pair&&h.hi>=8)||(h.hi===14&&h.lo>=11)||(h.hi===13&&h.lo===12);
    if(pos==='MP')return mp;
    return mp||(h.pair&&h.hi>=7)||(h.hi===14&&h.suited)||(h.suited&&h.lo>=10&&h.hi<14)||(h.suited&&h.hi-h.lo===1&&h.lo>=8);
  }
  function facingRange(pos,cs){
    const h=info(cs);
    if(pos==='CO'||pos==='BTN')return (h.pair&&h.hi>=8)||(h.hi===14&&h.lo>=11)||(h.hi===13&&h.lo===12);
    return (h.pair&&h.hi>=10)||(h.hi===14&&h.lo>=12&&(h.suited||h.lo===13));
  }
  const premium=cs=>{const h=info(cs);return (h.pair&&h.hi>=12)||(h.hi===14&&h.lo===13);};

  /* Haftalık turnuvada ilk üç ödül alır: dördüncü kalınca kabarcık. Yığını küçük olan çekinir, lider baskı kurar. */
  function bubble(p){
    const g=G;if(!g.venue.weekly)return 0;
    const alive=g.players.filter(q=>!q.out);
    if(alive.length!==4)return 0;
    const top=Math.max(...alive.map(q=>q.chips+q.bet));
    return (p.chips+p.bet)>=top?1:-1;
  }

  /* --- Botların bilgisi: masa zorluğu ve tarz belirler. Acemi masalar MIT kurallarını bilmez. --- */
  function knows(p){
    const g=G;if(p._kh!==g.handNo){
      p._kh=g.handNo;
      const bonus={kaya:.15,kopekbaligi:.15,tilki:0,manyak:-.1,gevsek:-.25}[p.style]||0;
      p._kn=rnd()<clamp((g.venue.skill-.2)/.6+bonus,0,1);
    }
    return p._kn;
  }

  const shove=L=>({type:'raise',to:L.maxTo});
  function pre(p){
    const g=G,L=legal(p),BB=g.bb,toCall=L.toCall;
    const m=M(p,true),pos=posOf(p),lv=level(p.cards),n=order().length;
    const fold=toCall===0?{type:'check'}:{type:'fold'},call=toCall===0?{type:'check'}:{type:'call'};
    const unopened=g.curBet<=BB;
    const bub=bubble(p),sd=styleStep(p.style)+(bub>0?1:0);
    if(m<=10){
      if(unopened){
        if(pos==='BB'||!L.canRaise)return null;
        const lim=stepLv(pushLimit(pos,m,n===2),sd);
        return inRange(lv,lim)?shove(L):fold;
      }
      const pu=g.lastAgg;
      const big=(pu&&pu.allIn)||toCall>=p.chips*.4;
      if(!pu||!big)return null;
      const vm=M(pu,false),vpos=posOf(pu),vlim=pushLimit(vpos,vm,n===2)*(pu.human?1:(pu.style==='manyak'?1.3:pu.style==='kaya'?.7:1));
      const rem=leftToAct(p);
      let mult=(rem===0&&pos==='BB')?huCall(m):HRM[Math.min(rem,5)];
      if(bub<0)mult*=.6;
      const callPct=Math.min(100,vlim*mult);
      if(!inRange(lv,callPct))return fold;
      return (premium(p.cards)&&L.canRaise&&!pu.allIn)?shove(L):call;
    }
    // M > 10: yalnızca sıkı tarzlar (kaya, köpekbalığı) MIT açılış tablosunu aynen izler
    if(p.style!=='kaya'&&p.style!=='kopekbaligi')return null;
    if(unopened){
      if(pos==='BB'||!L.canRaise)return null;
      const steal=p.style==='kopekbaligi'&&(pos==='BTN'||pos==='CO')&&lv<=30&&rnd()<.2;
      if(openRange(pos,p.cards)||steal){
        const limpers=g.players.filter(q=>q!==p&&q.inHand&&!q.folded&&q.bet>=BB&&q.idx!==g.bbI).length;
        let to=Math.round(BB*(3+limpers)/g.unit)*g.unit;to=clamp(to,L.minTo,L.maxTo);
        return {type:'raise',to};
      }
      return fold;
    }
    const cost=toCall/Math.max(1,p.chips+p.bet);
    if(premium(p.cards)&&L.canRaise&&g.nRaises<2){
      let to=Math.round(g.curBet*3/g.unit)*g.unit;to=clamp(to,L.minTo,L.maxTo);return {type:'raise',to};
    }
    if(cost>.35)return premium(p.cards)?call:fold;
    if(facingRange(pos,p.cards))return call;
    if(pos==='BB'&&toCall<=3.5*BB&&lv<=30&&rnd()<(p.style==='kopekbaligi'?.5:.25))return call;
    return fold;
  }

  /* Flop sonrası: devam bahsi, aynı büyüklük, yarı-blöf, savunma sıklığı */
  function post(p,a){
    const g=G,L=legal(p),toCall=L.toCall,pot=potTotal();
    const opps=g.players.filter(q=>q!==p&&q.inHand&&!q.folded);
    const d=p._dec||{},sk=g.venue.skill;
    const bet=f=>{let to=Math.round(pot*f/g.unit)*g.unit;to=clamp(to,L.minTo,L.maxTo);return {type:'raise',to};};
    // 1) Devam bahsi: önflop artıran, flop'ta, en fazla iki rakip. Pota 2/3, büyüklük elden bağımsız.
    if(toCall===0&&g.street===1&&g._pfr===p.idx&&opps.length<=2&&L.canRaise&&a.type==='check'){
      if(d.rel>=1.0&&rnd()<.85)return bet(.67);
      const sticky=opps.length===1&&opps[0].style==='gevsek';   // her şeyi gören rakibe blöf yapma
      if(!sticky&&rnd()<.4*(opps.length===1?1:.4)*(.6+sk*.5))return bet(.67);
    }
    // 2) Güçlü seviyede rakipler bahis büyüklüğünü elinden bağımsız tutar (okunmasın diye)
    if(toCall===0&&a.type==='raise'&&sk>=.6&&a.to<L.maxTo*.75&&opps.length<=2){
      const f=.62+rnd()*.1;return bet(f);
    }
    // 3) Yarı-blöf: çekilişle, tek rakibe, flop ya da turn'de artır (rakip çekilirse pot, çağırırsa elini tamamlama şansı)
    if(toCall>0&&a.type!=='raise'&&d.draw&&opps.length===1&&(g.street===1||g.street===2)&&L.canRaise){
      if(rnd()<.18+.25*(p.prof?p.prof.aggr:.4)){let to=Math.round((g.curBet*2.6+pot*.25)/g.unit)*g.unit;to=clamp(to,L.minTo,L.maxTo);return {type:'raise',to};}
    }
    // 4) Savunma sıklığı: tek bahse karşı elin sınırdaysa, rakibin blöf payı kadar çağır (çağırma ≈ 1/(1+S))
    if(toCall>0&&a.type==='fold'&&g.street>=2&&opps.length===1&&sk>=.6&&opps[0].style!=='kaya'){
      const S=toCall/Math.max(1,pot-toCall),po=toCall/(pot+toCall);
      if(S<=1&&d.eq>=po-.12&&rnd()<(1/(1+S))*.5)return {type:'call'};
    }
    return null;
  }

  function wrapBot(){
    const bd0=botDecide;
    botDecide=function(p){
      const g=G;
      if(g._mitH!==g.handNo){g._mitH=g.handNo;g._pfr=-1;}
      let a=bd0(p);                                    // denge/ekip hesapları (p._dec) hep önce yapılır
      if(!p.human&&knows(p)){
        let b=null;
        try{b=g.street===0?pre(p):post(p,a);}catch(e){console.error(e);}
        if(b)a=b;
      }
      if(g.street===0&&a.type==='raise')g._pfr=p.idx;
      return a;
    };
  }

  /* --- Antrenman koçu: M<10'da push/fold, M oranı satırı --- */
  function coachAdvice(p,L){
    const g=G,m=M(p,true);
    if(g.street!==0||m>10||!L.canRaise)return null;
    const pos=posOf(p),lv=level(p.cards),n=order().length,k=handKey(p.cards);
    const mt=m.toFixed(1).replace('.',',');
    if(g.curBet<=g.bb){
      if(pos==='BB')return null;
      const lim=pushLimit(pos,m,n===2),ok=lv<=lim;
      return [ok?'raise':'fold',ok?'Tüm fişi sür (push)':'Çekil',`M oranın ${mt}: araya girmek yok, ya push ya fold. ${posName(p)} pozisyonunda MIT tablosu en az ilk %${lim}'lik elleri sürmeni söylüyor. ${k} bu aralığın ${ok?'içinde':'dışında'}. <small>Kaynak: MIT 15.S50</small>`];
    }
    const pu=g.lastAgg;
    if(!pu)return null;
    const vm=M(pu,false),vl=pushLimit(posOf(pu),vm,n===2),rem=leftToAct(p);
    const mult=(rem===0&&pos==='BB')?huCall(m):HRM[Math.min(rem,5)],cp=Math.min(100,Math.round(vl*mult));
    const ok=lv<=cp;
    return [ok?'call':'fold',ok?'Gör':'Çekil',`M oranın ${mt}. Rakibin push aralığını yaklaşık %${Math.round(vl)} varsay; senin görme aralığın bunun ${mult.toFixed(2).replace('.',',')} katı, yani yaklaşık ilk %${cp}. ${k} bu aralığın ${ok?'içinde':'dışında'}. <small>Kaynak: MIT 15.S50</small>`];
  }
  function wrapCoach(){
    const a0=advise;
    advise=function(p,eq,po,L,opps,outs){return coachAdvice(p,L)||a0(p,eq,po,L,opps,outs);};
    const h0=coachHTML;
    coachHTML=function(p){
      const out=h0(p),m=M(p,true),z=zone(m);
      return out.replace('<dt>Pozisyon</dt>',`<dt>M oranı</dt><dd>${m.toFixed(1).replace('.',',')} · ${z[0]}</dd><dt>Pozisyon</dt>`);
    };
  }

  wrapBot();wrapCoach();
  return {level,inRange,pushLimit,huCall,openRange,facingRange,zone,LV,HRM,info,pre,post,M,posOf};
})();
