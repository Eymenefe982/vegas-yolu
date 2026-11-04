'use strict';
/* ================= Çip Masası =================
   2–10 kişilik, kartsız poker çip/bahis takipçisi. Çip değeri kurulumda sorulur (varsayılan 5 ₺) · küçük kör 1 çip · büyük kör 2 çip.
   Kart yok: eli kim kazandı, bahisleri ve potları (yan potlar dahil) bu ekran yönetir. */
(function(){
  let CHIP_TL=5;const SB=1,BB=2,KEY='vegasYolu.cipMasasi.v1';
  const q=s=>document.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nfc=new Intl.NumberFormat('tr-TR');
  const cp=n=>nfc.format(n)+' çip';
  const tlf=n=>nfc.format(n*CHIP_TL)+' ₺';
  const STREETS=['Pre-flop','Flop','Turn','River'];
  const root=q('#chips-root');if(!root)return;

  let S=load();            // kalıcı durum
  let draft={n:6,names:[],stack:100,chipTL:5};if(S&&S.chipTL)CHIP_TL=S.chipTL;   // kurulum taslağı
  let undo=[];             // el içi geri alma yığını (JSON anlık görüntüler)
  let raiseTo=0;           // artırma kutusundaki değer

  function load(){try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.players&&j.phase)return j;}catch(e){}return null;}
  function save(){try{if(S)localStorage.setItem(KEY,JSON.stringify(S));else localStorage.removeItem(KEY);}catch(e){}}

  /* ---------- Yardımcılar ---------- */
  const P=()=>S.players;
  const inHand=p=>!p.out&&!p.folded;                 // elde kalan
  const canAct=p=>inHand(p)&&!p.allin;               // hamle yapabilen
  const totalPot=()=>P().reduce((a,p)=>a+p.total,0);
  function nextIdx(i,pred){const n=P().length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(pred(P()[j]))return j;}return -1;}

  /* ---------- Kurulum ---------- */
  function renderSetup(){
    const n=draft.n;
    while(draft.names.length<n)draft.names.push('');
    const cells=[];
    for(let i=0;i<n;i++){
      cells.push(`<label class="cs-row"><span class="cs-no">${i+1}</span><input type="text" maxlength="14" autocomplete="off" data-i="${i}" placeholder="${i+1}. koltuk" value="${esc(draft.names[i])}" aria-label="${i+1}. koltuktaki oyuncunun adı"></label>`);
    }
    root.innerHTML=`
      <div class="cs-card">
        <h3 class="cs-h">1 · Kaç kişi oynuyor?</h3>
        <div class="cs-count" role="group" aria-label="Oyuncu sayısı">${[2,3,4,5,6,7,8,9,10].map(k=>`<button type="button" class="cs-n${k===n?' on':''}" data-n="${k}" aria-pressed="${k===n}">${k}</button>`).join('')}</div>
      </div>
      <div class="cs-card">
        <h3 class="cs-h">2 · Masadaki yerine göre isimler</h3>
        <p class="cs-sub">Koltuklar masanın etrafında saat yönünde sıralanır. 1. koltuk ilk dağıtıcıdır.</p>
        <div class="cs-seatmap" id="cs-seatmap">${seatMapHTML(n)}</div>
        <div class="cs-names">${cells.join('')}</div>
      </div>
      <div class="cs-card">
        <h3 class="cs-h">3 · Bir çip kaç ₺?</h3>
        <div class="cs-stack">
          ${[1,5,10,25].map(k=>`<button type="button" class="cs-n${k===+draft.chipTL?' on':''}" data-c="${k}">${k} ₺</button>`).join('')}
          <label class="cs-custom">Başka:<input type="number" inputmode="decimal" min="1" max="100000" step="1" id="cs-chiptl" value="${draft.chipTL}"><em>₺</em></label>
        </div>
        <p class="cs-rule" id="cs-rule"></p>
      </div>
      <div class="cs-card">
        <h3 class="cs-h">4 · Başlangıç çipi</h3>
        <div class="cs-stack">
          ${[50,100,200,500].map(k=>`<button type="button" class="cs-n wide${k===draft.stack?' on':''}" data-s="${k}">${k} çip<small>${tlf(k)}</small></button>`).join('')}
          <label class="cs-custom">Başka:<input type="number" inputmode="numeric" min="10" max="10000" step="10" id="cs-stack" value="${draft.stack}"><em>çip</em></label>
        </div>
      </div>
      <div class="cs-go"><button class="btn" id="cs-start">Oyunu başlat →</button></div>`;
    ruleLine();
  }
  function ruleLine(){
    const t=Math.max(1,+draft.chipTL||5);CHIP_TL=t;
    const r=q('#cs-rule');if(r)r.innerHTML=`<b>1 çip = ${nfc.format(t)} ₺</b> · küçük kör <b>${SB} çip (${nfc.format(SB*t)} ₺)</b> · büyük kör <b>${BB} çip (${nfc.format(BB*t)} ₺)</b>`;
    root.querySelectorAll('.cs-stack .cs-n.wide small').forEach(e=>{e.textContent=tlf(+e.parentNode.dataset.s);});
  }
  function seatMapHTML(n){
    let h='<div class="cs-oval"></div>';
    for(let i=0;i<n;i++){
      const a=Math.PI/2+i*2*Math.PI/n;           // 1. koltuk altta, saat yönünde
      const nm=(draft.names[i]||'').trim();
      h+=`<span class="cs-seat${nm?' fill':''}" style="left:${(50+44*Math.cos(a)).toFixed(1)}%;top:${(50+40*Math.sin(a)).toFixed(1)}%" data-seat="${i}"><i>${i+1}</i><b>${esc(nm||'—')}</b></span>`;
    }
    return h;
  }
  function refreshSeatMap(){const m=q('#cs-seatmap');if(m)m.innerHTML=seatMapHTML(draft.n);}

  function startGame(){
    const n=draft.n,stack=Math.max(10,Math.min(10000,Math.round(+draft.stack||100)));
    const used=new Set();
    const players=[];
    for(let i=0;i<n;i++){
      let nm=(draft.names[i]||'').trim()||('Oyuncu '+(i+1));
      let base=nm,k=2;while(used.has(nm.toLocaleLowerCase('tr-TR')))nm=base+' '+(k++);
      used.add(nm.toLocaleLowerCase('tr-TR'));
      players.push({name:nm,stack,start:stack,bet:0,total:0,folded:false,allin:false,acted:false,noRaise:false,out:false,rebuys:0});
    }
    CHIP_TL=Math.max(1,Math.min(100000,+draft.chipTL||5));
    S={chipTL:CHIP_TL,phase:'hand',players,dealer:-1,hand:0,street:0,current:0,toAct:-1,minRaise:BB,lastAct:{},log:[],result:null,startStack:stack,winner:null};
    undo=[];
    newHand();
  }

  /* ---------- El başlatma ---------- */
  function newHand(){
    const pl=P();
    pl.forEach(p=>{if(p.stack<=0&&!p.out)p.out=true;});
    const alive=pl.filter(p=>!p.out);
    if(alive.length<2){S.phase='over';S.winner=alive[0]?pl.indexOf(alive[0]):-1;S.log=[];save();render();return;}
    pl.forEach(p=>{p.bet=0;p.total=0;p.folded=false;p.allin=false;p.acted=false;p.noRaise=false;});
    S.dealer=S.hand===0?firstAlive():nextIdx(S.dealer,p=>!p.out);
    S.hand++;S.street=0;S.result=null;S.phase='hand';S.lastAct={};S.log=[];undo=[];
    const heads=alive.length===2;
    const sb=heads?S.dealer:nextIdx(S.dealer,p=>!p.out);
    const bb=nextIdx(sb,p=>!p.out);
    S.sb=sb;S.bb=bb;
    post(sb,SB);post(bb,BB);
    S.current=BB;S.minRaise=BB;
    log(`El #${S.hand} · Dağıtıcı ${pl[S.dealer].name} · KB ${pl[sb].name} · BB ${pl[bb].name}`);
    settle((bb+1)%P().length);
    save();render();
  }
  function firstAlive(){return P().findIndex(p=>!p.out);}
  function post(i,amt){
    const p=P()[i],a=Math.min(amt,p.stack);
    p.stack-=a;p.bet+=a;p.total+=a;if(p.stack===0)p.allin=true;
  }

  /* ---------- Hamleler ---------- */
  function snap(){undo.push(JSON.stringify(S));if(undo.length>60)undo.shift();}
  function log(t){S.log.unshift(t);if(S.log.length>40)S.log.pop();}
  const toCall=p=>Math.max(0,S.current-p.bet);

  function act(kind,to){
    if(S.phase!=='hand'||S.toAct<0)return;
    const p=P()[S.toAct],i=S.toAct;
    snap();
    if(kind==='fold'){
      p.folded=true;p.acted=true;S.lastAct[i]='Çekildi';log(`${p.name} çekildi`);
    }else if(kind==='call'){
      const need=toCall(p),a=Math.min(need,p.stack);
      p.stack-=a;p.bet+=a;p.total+=a;p.acted=true;
      if(p.stack===0)p.allin=true;
      S.lastAct[i]=need===0?'Pas':(p.allin?'All-in '+cp(p.bet):'Call');
      log(need===0?`${p.name} pas geçti`:`${p.name} ${cp(a)} ile call${p.allin?' (all-in)':''}`);
    }else if(kind==='raise'){
      const maxTo=p.bet+p.stack;
      to=Math.max(0,Math.min(Math.round(to),maxTo));
      const add=to-p.bet;
      const wasBet=S.current===0;
      p.stack-=add;p.bet=to;p.total+=add;p.acted=true;
      if(p.stack===0)p.allin=true;
      const inc=to-S.current;
      if(to>S.current){
        const full=inc>=S.minRaise;
        if(full){
          S.minRaise=Math.max(BB,inc);
          P().forEach((o,j)=>{if(j!==i&&canAct(o)){o.acted=false;o.noRaise=false;}});
        }else{
          // kısa all-in: bahsi büyütür ama aksiyonu yeniden açmaz
          P().forEach((o,j)=>{if(j!==i&&canAct(o)&&o.acted)o.noRaise=true;});
        }
        S.current=to;
      }
      S.lastAct[i]=p.allin?'All-in '+cp(to):(wasBet?'Bahis ':'Raise ')+cp(to);
      log(`${p.name} ${p.allin?'all-in ':wasBet?'bahis ':'raise '}${cp(to)}`);
    }
    settle((i+1)%P().length);
    save();render();
  }
  function undoLast(){
    if(!undo.length)return;
    S=JSON.parse(undo.pop());skipAnim=true;save();render();
  }

  /* El/tur akışı: `from` koltuğundan başlayarak sıradaki oyuncuyu bulur, tur biterse sonrakine geçer, el biterse sonuca götürür */
  function settle(from){
    const n=P().length;
    for(let guard=0;guard<40;guard++){
      const live=P().filter(inHand);
      if(live.length===1)return finishUncontested(live[0]);
      const able=P().filter(canAct).length;
      const needs=i=>{const p=P()[i];return canAct(p)&&(p.bet<S.current||(!p.acted&&able>1));};
      for(let k=0;k<n;k++){
        const j=(from+k)%n;
        if(needs(j)){S.toAct=j;return;}
      }
      // tur bitti
      if(S.street>=3)return toShowdown();
      S.street++;
      P().forEach(p=>{p.bet=0;p.acted=false;p.noRaise=false;});
      S.current=0;S.minRaise=BB;S.lastAct={};
      from=(S.dealer+1)%n;
      if(P().filter(canAct).length>1)log(STREETS[S.street]);
    }
  }

  function finishUncontested(w){
    const pot=totalPot(),i=P().indexOf(w);
    // Kalan herkes çekildi: tüm pot kazananın
    w.stack+=pot;
    payout={[i]:pot};
    P().forEach(p=>{p.bet=0;});
    S.result={uncontested:true,winner:i,amount:pot,pots:[],picks:[]};
    S.toAct=-1;S.phase='result';
    log(`${w.name} potu aldı (${cp(pot)})`);
  }
  function toShowdown(){
    P().forEach(p=>{p.bet=0;});
    S.toAct=-1;
    const pots=buildPots();
    S.phase='showdown';
    S.result={uncontested:false,pots,picks:pots.map(po=>po.elig.length===1?[po.elig[0]]:[])};
  }
  /* Ana pot + yan potlar. Tek hak sahibi olan seviye (bahsin karşılanmayan kısmı) kendiliğinden o oyuncuya döner. */
  function buildPots(){
    const pl=P();
    const levels=[...new Set(pl.filter(p=>p.total>0).map(p=>p.total))].sort((a,b)=>a-b);
    const pots=[];let prev=0;
    levels.forEach(lv=>{
      let amt=0;
      pl.forEach(p=>{amt+=Math.max(0,Math.min(p.total,lv)-prev);});
      const elig=pl.map((p,i)=>({p,i})).filter(o=>inHand(o.p)&&o.p.total>=lv).map(o=>o.i);
      if(amt>0){
        if(!elig.length&&pots.length)pots[pots.length-1].amount+=amt;
        else pots.push({amount:amt,elig});
      }
      prev=lv;
    });
    // aynı hak sahiplerine sahip ardışık potları birleştir
    const merged=[];
    pots.forEach(po=>{
      const l=merged[merged.length-1];
      if(l&&l.elig.join()===po.elig.join())l.amount+=po.amount;else merged.push({...po});
    });
    merged.forEach((po,k)=>{po.label=k===0?'Ana pot':(po.elig.length===1?'İade':'Yan pot '+k);});
    return merged;
  }
  function distribute(){
    const R=S.result;
    snap();
    const award={};
    R.pots.forEach((po,k)=>{
      const w=R.picks[k];if(!w||!w.length)return;
      // tek çip artarsa dağıtıcının solundan başlayarak verilir
      const ord=w.slice().sort((a,b)=>((a-S.dealer+P().length-1)%P().length)-((b-S.dealer+P().length-1)%P().length));
      const each=Math.floor(po.amount/ord.length);let rest=po.amount-each*ord.length;
      ord.forEach(i=>{const g=each+(rest>0?1:0);if(rest>0)rest--;award[i]=(award[i]||0)+g;});
    });
    Object.keys(award).forEach(i=>{P()[i].stack+=award[i];});
    R.award=award;payout=award;
    P().forEach(p=>{p.bet=0;});
    S.phase='result';
    const names=Object.keys(award).map(i=>`${P()[i].name} +${cp(award[i])}`).join(', ');
    log('Showdown: '+names);
    save();render();
  }


  /* ---------- Görsel çipler ---------- */
  const DEN=[[25,'c25'],[10,'c10'],[5,'c5'],[1,'c1']];
  const denCls=v=>(DEN.find(d=>v>=d[0])||DEN[3])[1];
  /* tutarı çip değerlerine böler ve sütun sütun dizilmiş çip yığınları üretir */
  function stackHTML(amount,size,cap){
    amount=Math.max(0,Math.round(amount));if(!amount)return '';
    let left=amount;const cols=[];
    DEN.forEach(([v,c])=>{const k=Math.floor(left/v);left-=k*v;if(k>0)cols.push([c,k]);});
    return `<span class="cs-stackset sz-${size}">${cols.map(([c,k],ci)=>{
      const n=Math.min(k,cap||8);
      return `<span class="cs-col" style="--ci:${ci}">${Array.from({length:n},(_,j)=>`<i class="ch ${c}" style="--j:${j}"></i>`).join('')}</span>`;
    }).join('')}</span>`;
  }
  const reduced=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let prev={hand:-1,bets:[],stacks:[],pot:0};
  let payout=null,skipAnim=false;
  const betPos=(i,n)=>{const q0=seatPos(i,n);return {x:q0.x+(50-q0.x)*0.42,y:q0.y+(50-q0.y)*0.42};};
  function fly(tbl,from,to,amount,delay){
    if(reduced())return;
    const n=Math.max(1,Math.min(8,Math.ceil(amount/ (amount>40?8:3))));
    const each=amount/n;
    for(let k=0;k<n;k++){
      const el=document.createElement('i');
      el.className='cs-fly ch '+denCls(each);
      const d=delay+k*70;
      el.style.left=from.x+'%';el.style.top=from.y+'%';el.style.transitionDelay=d+'ms';
      tbl.appendChild(el);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        el.style.opacity='1';el.style.left=(to.x+(Math.random()*3-1.5))+'%';el.style.top=(to.y+(Math.random()*3-1.5))+'%';
      }));
      setTimeout(()=>el.remove(),d+1000);
    }
  }
  function animate(){
    const tbl=q('.cs-table');if(!tbl||!S)return;
    const n=P().length,fresh=S.hand!==prev.hand;
    const base=fresh?P().map(()=>0):prev.bets;
    const centre={x:50,y:50};
    if(prev.hand===-1)skipAnim=true;
    let sweepDelay=0;
    if(!skipAnim){
      P().forEach((p,i)=>{
        const was=base[i]||0,now=S.phase==='hand'?p.bet:0;
        if(now>was){fly(tbl,seatPos(i,n),betPos(i,n),now-was,0);
          const b=tbl.querySelector(`.cs-bet[data-i="${i}"]`);if(b)b.classList.add('new');}
        else if(!fresh&&was>now){fly(tbl,betPos(i,n),centre,was,0);sweepDelay=450;}
        if(!fresh&&p.stack!==prev.stacks[i]){const e=tbl.querySelector(`.cs-pl[data-i="${i}"] .cs-mini`);if(e)e.classList.add('bump');}
      });
      if(payout){
        Object.keys(payout).forEach(i=>{fly(tbl,centre,seatPos(+i,n),payout[i],sweepDelay+150);
          const e=tbl.querySelector(`.cs-pl[data-i="${i}"]`);if(e){e.classList.add('won');}});
      }
      if(!fresh&&totalPotShown()!==prev.pot){const e=tbl.querySelector('.cs-pile');if(e)e.classList.add('bump');}
    }
    payout=null;skipAnim=false;
    prev={hand:S.hand,bets:P().map(p=>S.phase==='hand'?p.bet:0),stacks:P().map(p=>p.stack),pot:totalPotShown()};
  }
  const totalPotShown=()=>S.phase==='result'?0:totalPot();

  /* ---------- Çizim ---------- */
  function render(){
    if(!S){renderSetup();return;}
    if(S.phase==='over'){renderOver();return;}
    renderTable();
  }

  function seatPos(i,n){
    const a=Math.PI/2+i*2*Math.PI/n;
    return {x:50+43*Math.cos(a),y:50+40*Math.sin(a)};
  }
  function tableHTML(){
    const n=P().length;
    const pot=totalPotShown();
    const seats=P().map((p,i)=>{
      const pos=seatPos(i,n);
      const tags=[];
      if(i===S.dealer)tags.push('<em class="t-d">D</em>');
      if(i===S.sb&&!p.out)tags.push('<em class="t-sb">KB</em>');
      if(i===S.bb&&!p.out)tags.push('<em class="t-bb">BB</em>');
      const st=p.out?'Elendi':p.folded?'Çekildi':p.allin?'All-in':(S.lastAct[i]||'');
      const cls=['cs-pl',i===S.toAct?'turn':'',p.out?'out':'',p.folded?'fold':'',p.allin?'allin':''].filter(Boolean).join(' ');
      return `<div class="${cls}" data-i="${i}" style="left:${pos.x.toFixed(1)}%;top:${pos.y.toFixed(1)}%">
        <div class="cs-tags">${tags.join('')}</div>
        <div class="cs-mini">${stackHTML(p.stack,'mini',6)}</div>
        <div class="cs-name">${esc(p.name)}</div>
        <div class="cs-stk">${nfc.format(p.stack)}<small> çip</small></div>
        <div class="cs-st">${esc(st)||'&nbsp;'}</div>
      </div>`;
    }).join('');
    const bets=P().map((p,i)=>{
      if(!(p.bet>0&&S.phase==='hand'))return '';
      const pos=seatPos(i,n),k=0.42;
      return `<div class="cs-bet" data-i="${i}" style="left:${(pos.x+(50-pos.x)*k).toFixed(1)}%;top:${(pos.y+(50-pos.y)*k).toFixed(1)}%">${stackHTML(p.bet,'bet',6)}<b>${nfc.format(p.bet)}</b></div>`;
    }).join('');
    return `<div class="cs-table"><div class="cs-felt"><div class="cs-center">
        <div class="cs-street">${S.phase==='hand'?STREETS[S.street]:S.phase==='showdown'?'Showdown':'El bitti'}</div>
        <div class="cs-pile">${stackHTML(pot,'pot',9)}</div>
        <div class="cs-pot"><span>POT</span><b>${nfc.format(pot)}</b><small>çip</small></div>
      </div></div>${bets}${seats}</div>`;
  }

  function renderTable(){
    const pl=P();
    const head=`<div class="cs-bar"><span><b>El #${S.hand}</b> · KB ${SB} / BB ${BB} çip</span>
      <span class="cs-bar-btns"><button class="btn ghost small" id="cs-undo" ${undo.length?'':'disabled'}>↶ Geri al</button><button class="btn ghost small" id="cs-stacks">Çipler</button><button class="btn ghost small" id="cs-end">Oyunu bitir</button></span></div>`;
    let ctrl='';
    if(S.phase==='hand'&&S.toAct>=0)ctrl=actionHTML();
    else if(S.phase==='showdown')ctrl=showdownHTML();
    else if(S.phase==='result')ctrl=resultHTML();
    root.innerHTML=head+tableHTML()+`<div class="cs-ctrl">${ctrl}</div>`+logHTML();
    if(S.phase==='hand'&&S.toAct>=0)bindRaise();
    animate();
  }

  function actionHTML(){
    const p=P()[S.toAct],need=toCall(p),callAmt=Math.min(need,p.stack);
    const maxTo=p.bet+p.stack;
    const minTo=Math.min(maxTo,S.current===0?BB:S.current+S.minRaise);
    const raiseOK=p.stack>need&&!p.noRaise&&P().some((o,j)=>j!==S.toAct&&canAct(o)) ;
    if(!(raiseTo>=minTo&&raiseTo<=maxTo))raiseTo=minTo;
    const pot=totalPot();
    const presets=[['min','Min',minTo],['half','½ Pot',S.current+Math.round((pot+need)/2)],['pot','Pot',S.current+pot+need],['all','All-in',maxTo]]
      .map(([k,l,v])=>[k,l,Math.max(minTo,Math.min(maxTo,v))]);
    const word=S.current===0?'Bahis':'Raise';
    return `<div class="cs-turn"><b>${esc(p.name)}</b> sırada<span>${need>0?`Call için <b>${cp(callAmt)}</b> gerekli`:'Bahis yok · pas geçebilirsin'} · Kasasında <b>${cp(p.stack)}</b></span></div>
      ${raiseOK?`<div class="cs-raise">
        <div class="cs-pre">${presets.map(([k,l,v])=>`<button type="button" data-to="${v}">${l}<small>${nfc.format(v)}</small></button>`).join('')}</div>
        <div class="cs-amt"><button type="button" class="cs-pm" data-d="-1" aria-label="Azalt">−</button>
          <input type="range" id="cs-rng" min="${minTo}" max="${maxTo}" step="1" value="${raiseTo}" aria-label="Bahis miktarı">
          <button type="button" class="cs-pm" data-d="1" aria-label="Arttır">+</button>
          <label class="cs-num"><input type="number" id="cs-num" inputmode="numeric" min="${minTo}" max="${maxTo}" value="${raiseTo}"><em>çip</em></label></div>
        <div class="cs-eq" id="cs-eq"></div></div>`:''}
      <div class="cs-btns">
        <button class="act fold" id="cs-fold">Çekil</button>
        <button class="act call" id="cs-call">${need===0?'Pas':(callAmt<need||callAmt===p.stack?`All-in ${nfc.format(callAmt)}`:`Call ${nfc.format(callAmt)}`)}</button>
        ${raiseOK?`<button class="act raise" id="cs-raisebtn">${raiseTo>=maxTo?'All-in '+nfc.format(maxTo):word+' '+nfc.format(raiseTo)}</button>`:''}
      </div>`;
  }
  function bindRaise(){
    const p=P()[S.toAct];if(!p)return;
    const rng=q('#cs-rng'),num=q('#cs-num'),btn=q('#cs-raisebtn'),eq=q('#cs-eq');
    if(!rng)return;
    const min=+rng.min,max=+rng.max;
    const set=v=>{
      v=Math.max(min,Math.min(max,Math.round(+v||min)));raiseTo=v;
      rng.value=v;if(document.activeElement!==num)num.value=v;
      btn.textContent=v>=max?'All-in '+nfc.format(max):(S.current===0?'Bahis ':'Raise ')+nfc.format(v);
      eq.textContent=`${p.name}: kasadan ${nfc.format(v-p.bet)} çip gider · toplamda ${nfc.format(v)} çip bahis`;
    };
    set(raiseTo);
    rng.oninput=()=>set(rng.value);
    num.oninput=()=>{if(num.value!=='')set(num.value);};
    num.onchange=()=>set(num.value);
    root.querySelectorAll('.cs-pre button').forEach(b=>b.onclick=()=>set(b.dataset.to));
    root.querySelectorAll('.cs-pm').forEach(b=>b.onclick=()=>set(raiseTo+ +b.dataset.d));
    btn.onclick=()=>act('raise',raiseTo);
  }

  function showdownHTML(){
    const R=S.result;
    const rows=R.pots.map((po,k)=>{
      const opts=po.elig.map(i=>`<label class="cs-w${R.picks[k].includes(i)?' on':''}"><input type="checkbox" data-pot="${k}" data-pl="${i}" ${R.picks[k].includes(i)?'checked':''} ${po.elig.length===1?'disabled':''}>${esc(P()[i].name)}</label>`).join('');
      return `<div class="cs-pot-row"><div class="cs-pot-h"><b>${po.label}</b><span>${cp(po.amount)}</span></div>
        <div class="cs-pot-b">${opts}</div>
        ${po.elig.length===1?'<small class="cs-note">Karşılanmayan bahis, sahibine iade edilir.</small>':'<small class="cs-note">Kazananı seç. Beraberlikte birden fazla kişi seç; pot eşit bölünür.</small>'}</div>`;
    }).join('');
    const ready=R.picks.every(w=>w.length>0);
    return `<div class="cs-turn"><b>Showdown</b><span>Kartlar açıldı: her pot için kazananı işaretle.</span></div>${rows}
      <div class="cs-btns"><button class="btn" id="cs-pay" ${ready?'':'disabled'}>Potu dağıt</button></div>`;
  }
  function resultHTML(){
    const R=S.result;
    let body='';
    if(R.uncontested){
      const w=P()[R.winner];
      body=`<div class="cs-win"><b>${esc(w.name)}</b> herkes çekildiği için potu aldı<strong>+${cp(R.amount)}</strong></div>`;
    }else{
      const entries=Object.keys(R.award||{});
      body=`<div class="cs-win">${entries.map(i=>`<div><b>${esc(P()[i].name)}</b><strong>+${cp(R.award[i])}</strong></div>`).join('')}</div>`;
    }
    const alive=P().filter(p=>p.stack>0).length;
    return `${body}<div class="cs-btns"><button class="btn" id="cs-next">${alive<2?'Sonucu gör':'Sonraki el →'}</button></div>`;
  }
  function logHTML(){
    if(!S.log.length)return '';
    return `<details class="cs-log"><summary>El geçmişi</summary><ol>${S.log.map(l=>`<li>${esc(l)}</li>`).join('')}</ol></details>`;
  }
  function renderOver(){
    const w=S.winner>=0?P()[S.winner]:null;
    const rows=P().map((p,i)=>({p,i})).sort((a,b)=>b.p.stack-a.p.stack).map(({p})=>{
      const net=p.stack-p.start-p.rebuys*S.startStack;
      return `<li><span>${esc(p.name)}</span><b>${nfc.format(p.stack)} çip</b><em class="${net>0?'up':net<0?'dn':''}">${net>0?'+':''}${nfc.format(net)} çip (${net>0?'+':''}${nfc.format(net*CHIP_TL)} ₺)</em></li>`;
    }).join('');
    root.innerHTML=`<div class="cs-card cs-over"><h3 class="cs-h">${w?esc(w.name)+' tüm çipleri topladı!':'Oyun bitti'}</h3>
      <ol class="cs-rank">${rows}</ol>
      <div class="cs-go"><button class="btn" id="cs-again">Yeni oyun kur</button></div></div>`;
  }

  /* ---------- Çipler paneli (yeniden giriş) ---------- */
  function stacksModal(){
    const rows=P().map((p,i)=>`<li><span>${esc(p.name)}${p.out?' <em>(elendi)</em>':''}</span><b>${nfc.format(p.stack)} çip</b>${(p.out||S.phase==='result')?`<button class="btn ghost small" data-rebuy="${i}">+${S.startStack} çip</button>`:''}</li>`).join('');
    openModalSafe(`<h3>Çipler</h3><ul class="cs-stk-list">${rows}</ul><p class="cs-sub">Çip eklemek (yeniden giriş) yalnızca eller arasında ya da elenen oyuncular için yapılır.</p><div class="row"><button class="btn" data-close>Tamam</button></div>`);
  }
  function openModalSafe(html){
    if(typeof openModal==='function')openModal(html);
    else{const m=q('#modal'),s=q('#sheet');s.innerHTML=html;m.hidden=false;}
    const sh=q('#sheet');
    sh.onclick=e=>{
      const c=e.target.closest('[data-close]');if(c){closeM();return;}
      const rb=e.target.closest('[data-rebuy]');
      if(rb){const p=P()[+rb.dataset.rebuy];p.stack+=S.startStack;p.rebuys++;if(p.out){p.out=false;}save();stacksModal();if(S.phase==='result')render();}
      const y=e.target.closest('[data-yes]');if(y&&sh._yes){const f=sh._yes;closeM();f();}
    };
  }
  function closeM(){if(typeof closeModal==='function')closeModal();else q('#modal').hidden=true;q('#sheet').onclick=null;}
  function confirmM(title,text,yesLabel,fn){
    openModalSafe(`<h3>${title}</h3><p>${text}</p><div class="row"><button class="btn ghost" data-close>Vazgeç</button><button class="btn" data-yes>${yesLabel}</button></div>`);
    q('#sheet')._yes=fn;
  }

  /* ---------- Olaylar ---------- */
  root.addEventListener('click',e=>{
    const t=e.target;
    const n=t.closest('[data-n]');if(n&&!S){draft.n=+n.dataset.n;renderSetup();return;}
    const c=t.closest('[data-c]');if(c&&!S){draft.chipTL=+c.dataset.c;const i=q('#cs-chiptl');if(i)i.value=draft.chipTL;root.querySelectorAll('[data-c]').forEach(b=>b.classList.toggle('on',+b.dataset.c===draft.chipTL));ruleLine();return;}
    const s=t.closest('[data-s]');if(s&&!S){draft.stack=+s.dataset.s;renderSetup();return;}
    if(t.closest('#cs-start')){startGame();return;}
    if(t.closest('#cs-fold')){act('fold');return;}
    if(t.closest('#cs-call')){act('call');return;}
    if(t.closest('#cs-undo')){undoLast();return;}
    if(t.closest('#cs-stacks')){stacksModal();return;}
    if(t.closest('#cs-end')){confirmM('Oyunu bitir','Mevcut oyun silinir ve yeni kurulum başlar. Emin misin?','Evet, bitir',()=>{S=null;undo=[];save();render();});return;}
    if(t.closest('#cs-pay')){distribute();return;}
    if(t.closest('#cs-next')){snapClear();newHand();return;}
    if(t.closest('#cs-again')){S=null;undo=[];save();render();return;}
  });
  function snapClear(){undo=[];}
  root.addEventListener('input',e=>{
    const t=e.target;
    if(t.matches('input[data-i]')){draft.names[+t.dataset.i]=t.value;refreshSeatMap();}
    else if(t.id==='cs-chiptl'){draft.chipTL=+t.value||5;root.querySelectorAll('[data-c]').forEach(b=>b.classList.toggle('on',+b.dataset.c===+draft.chipTL));ruleLine();}
    else if(t.id==='cs-stack'){draft.stack=+t.value||100;root.querySelectorAll('.cs-stack .cs-n').forEach(b=>b.classList.toggle('on',+b.dataset.s===draft.stack));}
  });
  root.addEventListener('change',e=>{
    const t=e.target;
    if(t.matches('input[data-pot]')){
      const k=+t.dataset.pot,i=+t.dataset.pl,w=S.result.picks[k];
      const at=w.indexOf(i);if(t.checked&&at<0)w.push(i);else if(!t.checked&&at>=0)w.splice(at,1);
      save();render();
    }
  });

  /* ekran açılınca çiz */
  const scr=q('#scr-chips');
  new MutationObserver(()=>{if(!scr.hidden)render();}).observe(scr,{attributes:true,attributeFilter:['hidden']});
  const go=q('#go-chips');if(go)go.onclick=()=>show('scr-chips');
  const go2=q('#open-chips');if(go2)go2.onclick=()=>show('scr-chips');
  document.addEventListener('keydown',e=>{
    if(!scr||scr.hidden||!S||S.phase!=='hand'||S.toAct<0)return;
    if(e.target.matches('input,textarea'))return;
    if(e.key==='f'||e.key==='F')act('fold');
    else if(e.key==='c'||e.key==='C')act('call');
  });
})();
