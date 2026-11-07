'use strict';
/* ================= Online masa motoru =================
   Masayı kuran oyuncunun tarayıcısında çalışır (masa sahibi = "ev sahibi"): desteyi karıştırır, kartları dağıtır,
   hamleleri doğrular, potları ve kazananı belirler. Diğer oyuncular yalnızca herkese açık durumu görür; kendi
   kartlarını ayrı bir belgeden okur. Motor ağdan bağımsızdır; online.js onu Firestore'a bağlar.
   Kurallar Çip Masası'yla aynıdır: küçük kör 1 çip, büyük kör 2 çip, sınırsız bahis (No-Limit). */
const OnlineMotor=(()=>{
  const SB=1,BB=2,STREETS=['Pre-flop','Flop','Turn','River'];

  function create(dep,cfg){
    const ev=dep.evalCards,newDeck=dep.newDeck,now=dep.now||Date.now;
    const S={hand:0,phase:'bekle',street:0,dealer:-1,sb:-1,bb:-1,current:0,minRaise:BB,toAct:-1,board:[],players:[],lastAct:{},log:[],sonuc:null,sure:0,sonSure:0,
      cfg:{turSn:cfg.turSn||45,baslangic:cfg.baslangic||100,maxKoltuk:cfg.maxKoltuk||6}};
    let deck=[],holes={};
    const P=()=>S.players;
    const inHand=p=>!p.out&&!p.folded&&!p.left;
    const canAct=p=>inHand(p)&&!p.allin;
    const totalPot=()=>P().reduce((a,p)=>a+p.total,0);
    const log=t=>{S.log.unshift(t);if(S.log.length>30)S.log.pop();};
    const nextIdx=(i,pred)=>{const n=P().length;for(let k=1;k<=n;k++){const j=(((i+k)%n)+n)%n;if(pred(P()[j]))return j;}return -1;};
    const toCall=p=>Math.max(0,S.current-p.bet);

    /* ---------- Oturma ---------- */
    function addPlayer(info){
      const ex=P().findIndex(p=>p.uid===info.uid&&!p.left);
      if(ex>=0){const p=P()[ex];p.ad=info.ad||p.ad;p.av=info.av||p.av;return ex;}
      const np={uid:info.uid,ad:String(info.ad||'Oyuncu').slice(0,16),av:info.av||null,stack:S.cfg.baslangic,buyin:S.cfg.baslangic,bet:0,total:0,
        folded:false,allin:false,acted:false,noRaise:false,out:true,waiting:true,left:false,leaving:false,miss:0,rebuys:0};
      const free=S.phase==='el'?-1:P().findIndex(p=>p.left);
      if(free>=0){P()[free]=np;log(`${np.ad} masaya oturdu`);return free;}
      if(P().length>=S.cfg.maxKoltuk)return -1;
      P().push(np);log(`${np.ad} masaya oturdu`);return P().length-1;
    }
    function retire(i){const p=P()[i];log(`${p.ad} masadan kalktı`);p.left=true;p.out=true;p.leaving=false;p.waiting=false;delete holes[p.uid];}   // bahis ve pot payı el bitene kadar potta kalır
    function removePlayer(uid){
      const i=P().findIndex(p=>p.uid===uid&&!p.left);if(i<0)return false;
      const p=P()[i];
      if(S.phase!=='el'||p.out||p.folded){retire(i);return true;}
      p.leaving=true;log(`${p.ad} el bitince kalkacak`);
      if(S.toAct===i)act(uid,{tur:'fold'});
      return true;
    }
    function rebuy(uid){
      const p=P().find(q=>q.uid===uid&&!q.left);
      if(!p||!(p.out&&!p.waiting)||p.stack>0)return false;
      p.stack=S.cfg.baslangic;p.buyin+=S.cfg.baslangic;p.rebuys++;p.waiting=true;log(`${p.ad} yeniden ${S.cfg.baslangic} çip aldı`);return true;
    }

    /* ---------- El akışı ---------- */
    function post(i,amt){const p=P()[i],a=Math.min(amt,p.stack);p.stack-=a;p.bet+=a;p.total+=a;if(p.stack===0)p.allin=true;}
    function newHand(){
      const pl=P();
      pl.forEach((p,i)=>{if(p.leaving&&!p.left)retire(i);});
      pl.forEach(p=>{if(p.waiting&&p.stack>0&&!p.left){p.out=false;p.waiting=false;}});
      pl.forEach(p=>{if(p.stack<=0&&!p.out&&!p.left){p.out=true;log(`${p.ad} bütün fişlerini kaybetti`);}});
      const alive=pl.filter(p=>!p.out&&!p.left);
      holes={};S.sonuc=null;S.sonSure=0;
      if(alive.length<2){S.phase='bekle';S.toAct=-1;S.board=[];S.sure=0;pl.forEach(p=>{p.bet=0;p.total=0;p.folded=false;p.allin=false;});return false;}
      pl.forEach(p=>{p.bet=0;p.total=0;p.folded=false;p.allin=false;p.acted=false;p.noRaise=false;});
      S.dealer=nextIdx(S.dealer,p=>!p.out&&!p.left);
      S.hand++;S.street=0;S.phase='el';S.lastAct={};S.board=[];
      deck=newDeck();
      alive.forEach(p=>{holes[p.uid]=[deck.pop(),deck.pop()];});
      const heads=alive.length===2;
      const sb=heads?S.dealer:nextIdx(S.dealer,p=>!p.out&&!p.left),bb=nextIdx(sb,p=>!p.out&&!p.left);
      S.sb=sb;S.bb=bb;post(sb,SB);post(bb,BB);
      S.current=BB;S.minRaise=BB;
      log(`El #${S.hand} · Dağıtıcı ${pl[S.dealer].ad} · KB ${pl[sb].ad} · BB ${pl[bb].ad}`);
      settle((bb+1)%pl.length);
      return true;
    }
    function dealStreet(){
      if(S.street===1){S.board.push(deck.pop(),deck.pop(),deck.pop());}
      else S.board.push(deck.pop());
    }
    function settle(from){
      const n=P().length;
      for(let guard=0;guard<60;guard++){
        const live=P().filter(inHand);
        if(live.length===1)return finishUncontested(live[0]);
        const able=P().filter(canAct).length;
        const needs=i=>{const p=P()[i];return canAct(p)&&(p.bet<S.current||(!p.acted&&able>1));};
        let again=false;
        for(let k=0;k<n;k++){
          const j=(from+k)%n;
          if(needs(j)){
            const pj=P()[j];
            if(pj.leaving&&!pj.folded){pj.folded=true;pj.acted=true;S.lastAct[j]='Çekildi';log(`${pj.ad} çekildi (kalkıyor)`);from=(j+1)%n;again=true;break;}
            S.toAct=j;S.sure=now()+S.cfg.turSn*1000;return;
          }
        }
        if(again)continue;
        if(S.street>=3)return toShowdown();
        S.street++;dealStreet();
        P().forEach(p=>{p.bet=0;p.acted=false;p.noRaise=false;});
        S.current=0;S.minRaise=BB;S.lastAct={};
        from=(S.dealer+1)%n;
        if(P().filter(canAct).length>1)log(STREETS[S.street]);
      }
    }

    function finishUncontested(w){
      const pot=totalPot(),i=P().indexOf(w);
      w.stack+=pot;
      P().forEach(p=>{p.bet=0;p.total=0;});
      S.sonuc={tek:true,kazanan:i,miktar:pot,potlar:[{miktar:pot,kazananlar:[i]}],goster:{}};
      log(`${w.ad} herkes çekildiği için potu aldı (${pot})`);
      endHand();
    }
    function pots(){
      const pl=P();
      const levels=[...new Set(pl.filter(p=>p.total>0).map(p=>p.total))].sort((a,b)=>a-b);
      let prev=0,carry=0;const out=[];
      for(const L of levels){
        let amount=carry;carry=0;
        pl.forEach(p=>{amount+=Math.max(0,Math.min(p.total,L)-prev);});
        const elig=pl.map((p,i)=>i).filter(i=>inHand(pl[i])&&pl[i].total>=L);
        if(elig.length)out.push({amount,elig});else carry=amount;
        prev=L;
      }
      if(carry&&out.length)out[out.length-1].amount+=carry;
      return out;
    }
    function toShowdown(){
      const pl=P(),PS=pots(),res=[],goster={};
      const score={};
      pl.forEach((p,i)=>{if(inHand(p)){score[i]=ev(holes[p.uid].concat(S.board));}});
      const order=i=>((i-S.dealer-1)+pl.length)%pl.length;
      PS.forEach(po=>{
        if(po.elig.length>1)po.elig.forEach(i=>{goster[i]=holes[pl[i].uid];});
        const best=Math.max(...po.elig.map(i=>score[i]));
        const win=po.elig.filter(i=>score[i]===best).sort((a,b)=>order(a)-order(b));
        const each=Math.floor(po.amount/win.length);let rest=po.amount-each*win.length;
        win.forEach(i=>{pl[i].stack+=each+(rest>0?1:0);if(rest>0)rest--;});
        res.push({miktar:po.amount,kazananlar:win,skor:best});
      });
      pl.forEach(p=>{p.bet=0;p.total=0;});
      S.sonuc={tek:false,potlar:res,goster};
      res.forEach(r=>log(`Pot ${r.miktar}: ${r.kazananlar.map(i=>pl[i].ad).join(', ')}`));
      endHand();
    }
    function endHand(){
      S.phase='sonuc';S.toAct=-1;S.sure=0;S.sonSure=now()+(S.sonuc&&!S.sonuc.tek?9000:5500);
    }

    /* ---------- Hamleler ---------- */
    function act(uid,a){
      if(S.phase!=='el'||S.toAct<0)return {ok:false,neden:'el yok'};
      const i=S.toAct,p=P()[i];
      if(p.uid!==uid)return {ok:false,neden:'sıra sende değil'};
      const kind=a&&a.tur;
      if(kind==='fold'){
        p.folded=true;p.acted=true;S.lastAct[i]='Çekildi';log(`${p.ad} çekildi`);
      }else if(kind==='call'||kind==='raise'){
        const others=P().some((o,j)=>j!==i&&canAct(o));
        const need=toCall(p);
        let raise=kind==='raise'&&p.stack>need&&!p.noRaise&&others;
        if(!raise){
          const c=Math.min(need,p.stack);
          p.stack-=c;p.bet+=c;p.total+=c;p.acted=true;if(p.stack===0)p.allin=true;
          S.lastAct[i]=need===0?'Pas':(p.allin?'All-in '+p.bet:'Call');
          log(need===0?`${p.ad} pas geçti`:`${p.ad} ${c} ile call${p.allin?' (all-in)':''}`);
        }else{
          const maxTo=p.bet+p.stack,minTo=Math.min(maxTo,S.current===0?BB:S.current+S.minRaise);
          let to=Math.round(+a.to||0);to=Math.max(minTo,Math.min(maxTo,to));
          const add=to-p.bet,wasBet=S.current===0;
          p.stack-=add;p.bet=to;p.total+=add;p.acted=true;if(p.stack===0)p.allin=true;
          const inc=to-S.current;
          if(to>S.current){
            if(inc>=S.minRaise){S.minRaise=Math.max(BB,inc);P().forEach((o,j)=>{if(j!==i&&canAct(o)){o.acted=false;o.noRaise=false;}});}
            else P().forEach((o,j)=>{if(j!==i&&canAct(o)&&o.acted)o.noRaise=true;});
            S.current=to;
          }
          S.lastAct[i]=p.allin?'All-in '+to:(wasBet?'Bahis ':'Raise ')+to;
          log(`${p.ad} ${p.allin?'all-in ':wasBet?'bahis ':'raise '}${to}`);
        }
      }else return {ok:false,neden:'geçersiz hamle'};
      if(a.otomatik)p.miss=(p.miss||0)+1;else p.miss=0;
      settle((i+1)%P().length);
      return {ok:true};
    }
    // Süre dolduysa otomatik hamle; sonuç ekranı bittiyse yeni el
    function tick(){
      const t=now();
      if(S.phase==='el'&&S.sure&&t>S.sure&&S.toAct>=0){
        const p=P()[S.toAct];
        act(p.uid,{tur:toCall(p)>0?'fold':'call',otomatik:true});
        if(p.miss>=3&&!p.left){log(`${p.ad} uzun süredir yok, masadan çıkarıldı`);removePlayer(p.uid);}
        return true;
      }
      if(S.phase==='sonuc'&&S.sonSure&&t>S.sonSure){newHand();return true;}
      return false;
    }

    function publicState(){
      return JSON.parse(JSON.stringify({
        hand:S.hand,phase:S.phase,street:S.street,dealer:S.dealer,sb:S.sb,bb:S.bb,current:S.current,minRaise:S.minRaise,toAct:S.toAct,
        board:S.board,pot:totalPot(),lastAct:S.lastAct,log:S.log,sonuc:S.sonuc,sure:S.sure,sonSure:S.sonSure,cfg:S.cfg,
        players:P().map(p=>({uid:p.uid,ad:p.ad,av:p.av,stack:p.stack,bet:p.bet,total:p.total,folded:p.folded,allin:p.allin,out:p.out,waiting:p.waiting,left:p.left,leaving:p.leaving,buyin:p.buyin}))
      }));
    }
    const hole=uid=>holes[uid]||null;
    const holeUids=()=>Object.keys(holes);
    return {state:S,addPlayer,removePlayer,rebuy,newHand,act,tick,publicState,hole,holeUids,SB,BB,pots,totalPot};
  }
  return {create,SB,BB,STREETS};
})();
