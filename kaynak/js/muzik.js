'use strict';
/* Vegas Yolu · mekân müziği (tamamı Web Audio ile sentezlenir; kayıt ya da telifli ezgi yoktur, ezgiler her seferinde üretilir).

   Her mekân orada gerçekten duyulacak türü çalar:
     kaçak kumarhane  → cızırtılı transistörlü radyoda arabesk (yaylı grubu, bağlama ara nağmesi, darbuka)
     kıraathane       → radyoda türkü: bağlama, hafif def (Hüseyni)
     Beyoğlu meyhane  → fasıl: klarnet, kanun, ud, darbuka; Nihavent düyek ile Hicaz 9/8 Roman havası dönüşümlü
     Mahmutpaşa hanı  → ud ve bendir (Uşşak), kanun cevapları
     Bebek yalısı     → bossa nova: naylon telli gitar, kontrbas, vibrafon
     Girne casino     → otel lobisi smooth jazz: elektrikli piyano, saksofon
     Monte Carlo      → salon valsi: keman, piyano, pizzicato bas
     Makao            → guzheng ve erhu, pentatonik
     Las Vegas        → big band swing: yürüyen bas, ride, nefesli riffleri (12 ölçü blues)
     süit / antrenman → gece yarısı piyano baladı

   Mekanik durmaması için: telli çalgılar fiziksel tel modeliyle (Karplus-Strong) üretilir; ezgi rastgele nota değil,
   dört ölçülük cümlelerdir (motif · sekans · tize çıkış · karara iniş) ve cümleler tekrar eder; vuruşlar birkaç
   milisaniye oynar, vurgular değişir; uzun notalarda vibrato, tremolo, çarpma ve kaydırma vardır.
   Türk müziği dizileri eşit tamperaman değil, makam perdelerine yakın (cent) tanımlıdır. */
const Muzik=(()=>{
  const R=Math.random,rnd=(a,b)=>a+R()*(b-a),pick=a=>a[Math.floor(R()*a.length)],cl=(x,a,b)=>Math.max(a,Math.min(b,x));
  const MK={
    hicaz:[0,114,384,498,702,792,996],
    huseyni:[0,160,294,498,702,860,996],
    ussak:[0,150,294,498,702,792,996],
    nihavent:[0,204,294,498,702,792,996],
    kurdi:[0,90,294,498,702,792,996],
    major:[0,200,400,500,700,900,1100],
    penta:[0,200,400,700,900],
    blues:[0,300,500,600,700,1000],
  };
  const hzOf=(root,sc,d)=>{const n=sc.length,i=((d%n)+n)%n;return root*Math.pow(2,(sc[i]+1200*Math.floor(d/n))/1200);};
  // Bir ölçülük ezgi: ritim kalıbı (negatif = sus) üzerinde 'from' perdesinden 'to' perdesine çoğunlukla adım adım yürür
  function line(rh,from,to,lo,hi){
    const n=rh.filter(l=>l>0).length,out=[];let d=cl(from,lo,hi),k=0;
    rh.forEach(l=>{
      if(l<0){out.push({d:null,len:-l});return;}
      if(k===n-1)d=to;
      else if(k>0){
        const left=n-1-k,gap=to-d,sg=Math.sign(gap)||pick([-1,1]),r=R();
        const s=Math.abs(gap)>left+1?sg*2:Math.abs(gap)>left?sg:r<.6?sg:r<.76?-sg:r<.88?0:sg*2;
        d=cl(d+s,lo,hi);
      }
      out.push({d,len:l});k++;
    });
    return out;
  }
  // Dört ölçülük cümle: a (motif) · a' (bir perde aşağıda sekans) · b (tize çıkış) · c (karara iniş, uzun bitiş)
  function sent(T){
    const s=pick(T.start);
    const a=line(pick(T.rh),s,cl(s-pick([1,2]),T.lo,T.hi),T.lo,T.hi);
    const a2=a.map(x=>({d:x.d==null?null:cl(x.d-1,T.lo,T.hi),len:x.len}));
    const b=line(pick(T.rh),pick([s,s+1]),T.peak,T.lo,T.hi+1);
    const c=line(pick(T.cad),T.peak-pick([1,2]),0,T.lo,T.hi);
    return [a,a2,b,c];
  }
  const RH8=[[2,2,2,2],[1,1,2,2,2],[2,1,1,2,2],[3,1,2,2],[1,1,1,1,2,2],[2,2,1,1,2],[3,1,3,1],[2,1,1,1,1,2],[-1,1,2,2,2]];
  const CAD8=[[1,1,1,1,4],[2,2,4],[2,1,1,4],[1,1,2,4]];
  const RH9=[[2,2,2,3],[2,2,2,1,2],[1,1,2,2,3],[2,1,1,2,1,2],[2,2,1,1,1,2]];
  const CAD9=[[2,2,2,3],[1,1,2,2,3],[2,2,5]];
  const RH6=[[2,2,2],[3,1,2],[4,2],[2,1,1,2],[4,1,1],[1,1,1,1,2]];
  const RHJ=[[-1,1,1,1,2,-2],[2,1,1,-1,1,2],[-2,1,1,2,-2],[1,1,1,1,2,-2],[-1,1,2,-1,1,2],[3,1,2,-2],[-4,1,1,2]];
  const RADIO={arabesk:1,turku:.55};

  function start(ctx,out,cfg,isOn){
    const sr=ctx.sampleRate,style=cfg.style,keepN=[],loops=[];
    const keep=n=>{keepN.push(n);return n;};
    const nb=ctx.createBuffer(1,sr*2,sr);{const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=R()*2-1;}
    /* ---- çıkış: radyodan gelen müzik dar bantlı, hafif kırpık ve cızırtılıdır; ses ara ara dalgalanır ---- */
    const bus=keep(ctx.createGain());bus.gain.value=(cfg.vol||.06)*2.4;
    const rad=RADIO[style];
    if(rad){
      const hp=keep(ctx.createBiquadFilter());hp.type='highpass';hp.frequency.value=rad===1?340:220;
      const lp=keep(ctx.createBiquadFilter());lp.type='lowpass';lp.frequency.value=rad===1?2900:4200;
      const pk=keep(ctx.createBiquadFilter());pk.type='peaking';pk.frequency.value=1300;pk.Q.value=.8;pk.gain.value=4*rad;
      const pre=keep(ctx.createGain());pre.gain.value=3;
      const ws=keep(ctx.createWaveShaper());{const c=new Float32Array(257),k=1+1.6*rad;for(let i=0;i<257;i++)c[i]=Math.tanh((i/128-1)*k)/Math.tanh(k);ws.curve=c;}
      const post=keep(ctx.createGain());post.gain.value=1/3;
      bus.connect(hp);hp.connect(lp);lp.connect(pk);pk.connect(pre);pre.connect(ws);ws.connect(post);post.connect(out);
      const lfo=ctx.createOscillator();lfo.frequency.value=.09;const lg=keep(ctx.createGain());lg.gain.value=.05*rad;lfo.connect(lg);lg.connect(post.gain);lfo.start();loops.push(lfo);
      const hs=ctx.createBufferSource();hs.buffer=nb;hs.loop=true;const hf=keep(ctx.createBiquadFilter());hf.type='bandpass';hf.frequency.value=3000;hf.Q.value=.4;
      const hg=keep(ctx.createGain());hg.gain.value=(cfg.vol||.06)*.11*rad;hs.connect(hf);hf.connect(hg);hg.connect(out);hs.start();loops.push(hs);
    }else bus.connect(out);

    /* ---- çalgılar ---- */
    // Tel (Karplus-Strong): mızrap gürültüsü tel boyu kadar gecikmeyle döner, her turda biraz söner ve yumuşar
    const KS={
      saz:{pick:.8,pos:.17,t60:1.5,b:.26,len:1.5},
      ud:{pick:.34,pos:.23,t60:1.9,b:.5,len:1.9},
      kanun:{pick:.9,pos:.11,t60:2.3,b:.2,len:2.2},
      zheng:{pick:.8,pos:.13,t60:2.8,b:.3,len:2.6},
      gtr:{pick:.42,pos:.26,t60:1.8,b:.5,len:1.8},
      cbass:{pick:.16,pos:.3,t60:1.1,b:.6,len:1.3},
    };
    const ksC=new Map();
    function ksBuf(f,kind){
      const semi=Math.round(12*Math.log2(f/55)),f0=55*Math.pow(2,semi/12),N=Math.max(8,Math.round(sr/f0)),K=KS[kind],key=kind+semi;
      let b=ksC.get(key);
      if(!b){
        const len=Math.floor(sr*cl(K.len*Math.pow(220/f0,.35),.5,2.8));
        b=ctx.createBuffer(1,len,sr);const d=b.getChannelData(0);
        let l=0,mx=0;for(let i=0;i<N;i++){l+=K.pick*((R()*2-1)-l);d[i]=l;mx=Math.max(mx,Math.abs(l));}
        for(let i=0;i<N;i++)d[i]/=mx||1;
        const pp=Math.max(1,Math.floor(N*K.pos));for(let i=N-1;i>=pp;i--)d[i]-=d[i-pp]*.85;   // mızrabın tele vurduğu yer
        const g=Math.exp(-6.91/(f0*K.t60)),bb=K.b;
        d[N]=g*d[0];for(let i=N+1;i<len;i++)d[i]=g*((1-bb)*d[i-N]+bb*d[i-N-1]);
        ksC.set(key,b);
      }
      return {b,rate:f*(N+K.b)/sr};
    }
    function ks(t,f,dur,vol,kind,o){
      const {b,rate}=ksBuf(f,kind),s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=b;
      if(o&&o.bend){s.playbackRate.setValueAtTime(rate*Math.pow(2,o.bend/1200),t);s.playbackRate.exponentialRampToValueAtTime(rate,t+(o.bt||.09));}else s.playbackRate.setValueAtTime(rate,t);
      vol=Math.max(.0002,vol);g.gain.setValueAtTime(vol,t);g.gain.setValueAtTime(vol,t+dur);g.gain.exponentialRampToValueAtTime(.0001,t+dur+.14);
      s.connect(g);g.connect(bus);s.start(t);s.stop(t+dur+.2);
    }
    // çift telli çalgılar: ikinci tel birkaç cent farklı ve birkaç ms geç
    const saz=(t,f,d,v,o)=>{ks(t,f,d,v,'saz',o);ks(t+.004,f*1.004,d,v*.6,'saz',o);ks(t+.002,f*2,d*.8,v*.28,'saz',o);};
    const ud=(t,f,d,v,o)=>{ks(t,f,d,v,'ud',o);ks(t+.005,f*1.003,d,v*.55,'ud',o);};
    const kanun=(t,f,d,v,o)=>{ks(t,f,d,v,'kanun',o);ks(t+.003,f*1.003,d,v*.6,'kanun',o);ks(t+.006,f*.997,d,v*.5,'kanun',o);};
    const zheng=(t,f,d,v,o)=>ks(t,f,d,v,'zheng',o);
    const gtr=(t,f,d,v,o)=>ks(t,f,d,v,'gtr',o);
    const trem=(inst,t,f,dur,v)=>{const sp=rnd(.075,.09);for(let x=0,i=0;x<dur-.03;x+=sp*rnd(.92,1.08),i++)inst(t+x,f,.3,v*(i?rnd(.55,.8):1));};
    // Nefesli ve yaylı: süzülmüş osilatör, yavaş atak, gecikmeli vibrato, önceki notadan kaydırma, nefes/yay gürültüsü
    function voice(t,f,dur,vol,o){
      const a=o.att||.05,rel=o.rel||.1,hold=Math.max(a,dur),end=t+hold+rel+.05,det=o.det||[0];
      const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.setValueAtTime(vol,t+hold);g.gain.linearRampToValueAtTime(0,t+hold+rel);
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(cl(f*(o.lp||4),300,9000),t);lp.Q.value=o.q||.7;
      lp.connect(g);g.connect(bus);
      let lg=null;
      if(o.vib){const l=ctx.createOscillator();l.frequency.value=(o.vibHz||5.4)*rnd(.93,1.07);lg=ctx.createGain();const vi=o.vibIn||.18;
        lg.gain.setValueAtTime(0,t);lg.gain.setValueAtTime(0,t+vi);lg.gain.linearRampToValueAtTime(f*o.vib,t+vi+.25);l.connect(lg);l.start(t);l.stop(end);}
      for(const dt of det){
        const os=ctx.createOscillator(),og=ctx.createGain();os.type=o.type||'sawtooth';os.detune.value=dt;og.gain.value=1/det.length;
        if(o.from&&o.from!==f){os.frequency.setValueAtTime(o.from,t);os.frequency.exponentialRampToValueAtTime(f,t+(o.glide||.07));}else os.frequency.setValueAtTime(f,t);
        if(lg)lg.connect(os.frequency);
        os.connect(og);og.connect(lp);os.start(t);os.stop(end);
      }
      if(o.noise){const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),ng=ctx.createGain();s.buffer=nb;s.loop=true;bp.type='bandpass';bp.frequency.value=cl(f*2,800,5000);bp.Q.value=1.2;ng.gain.value=o.noise;
        s.connect(bp);bp.connect(ng);ng.connect(lp);s.start(t,R());s.stop(end);}
    }
    const klarnet=(t,f,d,v,from,vib)=>voice(t,f,d,v,{type:'square',lp:3.2,q:1.4,att:.04,rel:.07,from,glide:.06,vib:vib?.007:0,vibIn:.14,noise:.05});
    const keman=(t,f,d,v,from)=>voice(t,f,d,v,{det:[-4,5],lp:5,att:.07,rel:.12,from,glide:.08,vib:.008,vibHz:6,noise:.02});
    const yayli=(t,f,d,v,from)=>voice(t,f,d,v,{det:[-12,-4,3,11],lp:3.4,att:.14,rel:.22,from,glide:.1,vib:.005,vibHz:5.6,vibIn:.25});
    const erhu=(t,f,d,v,from)=>voice(t,f,d,v,{lp:4,q:3,att:.08,rel:.12,from,glide:.13,vib:.012,vibHz:6,vibIn:.12,noise:.03});
    const sax=(t,f,d,v,from)=>voice(t,f,d,v,{lp:2.5,q:2,att:.045,rel:.09,from,glide:.05,vib:.008,vibIn:.2,noise:.07});
    const brass=(t,f,d,v)=>voice(t,f,d,v,{det:[-3,3],lp:3.4,att:.03,rel:.07,vib:.005,vibIn:.25});
    // Tuşlu ve tokmaklı: iki operatörlü FM; vuruşta parlak, sönerken yumuşar
    function fm(t,f,dur,vol,o){
      const c=ctx.createOscillator(),m=ctx.createOscillator(),mg=ctx.createGain(),g=ctx.createGain(),idx=o.idx*f;
      c.frequency.value=f;m.frequency.value=f*(o.ratio||1);
      mg.gain.setValueAtTime(idx,t);mg.gain.exponentialRampToValueAtTime(idx*.06+1,t+o.it);
      m.connect(mg);mg.connect(c.frequency);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.006);g.gain.setTargetAtTime(0,t+.012,o.tau);g.gain.setTargetAtTime(0,t+dur,.07);
      c.connect(g);g.connect(bus);c.start(t);m.start(t);c.stop(t+dur+.5);m.stop(t+dur+.5);
    }
    const ep=(t,f,d,v)=>fm(t,f,d,v,{idx:1.5,it:.45,tau:.9});
    const piano=(t,f,d,v)=>{fm(t,f,d,v,{idx:2.1,it:.16,tau:1.1});fm(t,f*1.0015,d,v*.45,{idx:.7,it:.3,tau:1.3,ratio:2});};
    const vibes=(t,f,d,v)=>fm(t,f,d,v,{idx:.55,it:.12,tau:1.5,ratio:4});
    function sub(t,f,dur,vol){
      const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(f*1.06,t);o.frequency.exponentialRampToValueAtTime(f,t+.05);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.setTargetAtTime(0,t+.03,dur*.4);o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur*2.4+.1);
    }
    const bass=(t,f,d,v)=>{ks(t,f,d,v*.8,'cbass');sub(t,f,d,v*.7);};
    // Vurmalı
    function nz(t,dur,vol,type,f,q,att){
      att=att||.001;const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=nb;s.loop=true;fl.type=type;fl.frequency.value=f;fl.Q.value=q||.8;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(Math.max(.0002,vol),t+att);g.gain.exponentialRampToValueAtTime(.0001,t+att+dur);
      s.connect(fl);fl.connect(g);g.connect(bus);s.start(t,R());s.stop(t+att+dur+.02);
    }
    function thump(t,f1,f2,dur,vol){
      const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+dur*.6);
      g.gain.setValueAtTime(Math.max(.0002,vol),t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.02);
    }
    const dum=(t,v)=>{thump(t,170,62,.22,v);nz(t,.02,v*.35,'lowpass',900,.7);};
    const tek=(t,v)=>{nz(t,.045,v*.8,'bandpass',3400,2.5);thump(t,820,640,.05,v*.25);};
    const ka=(t,v)=>nz(t,.03,v*.5,'bandpass',4800,3);
    const zil=(t,v)=>nz(t,.09,v*.35,'highpass',7000,.7);
    const kick=(t,v)=>thump(t,110,45,.2,v);
    const hat=(t,v,d)=>nz(t,d||.04,v,'highpass',8000,.7);
    const ride=(t,v)=>{nz(t,.3,v*.45,'highpass',6500,.5);nz(t,.05,v*.5,'bandpass',9000,4);};
    const brush=(t,v,d)=>nz(t,d||.18,v,'bandpass',2600,.6,.05);
    const shaker=(t,v)=>nz(t,.05,v,'bandpass',6000,1.5,.008);
    const rim=(t,v)=>{thump(t,1700,1500,.03,v*.5);nz(t,.02,v*.5,'bandpass',2000,3);};
    const hum=()=>rnd(-.011,.011);

    /* ---- Türk müziği: usul + dem + cümle + ara nağme ---- */
    const X={prev:0};
    function playLine(notes,t0,st,root,sc,vel,lead,oct){
      let pos=0;
      for(const nn of notes){
        if(nn.d!=null){
          const f=hzOf(root,sc,nn.d)*(oct||1),acc=(pos%4===0?1:pos%2===0?.86:.74)*rnd(.86,1.1);
          lead(t0+pos*st+hum(),f,nn.len*st,vel*acc,nn.len,hzOf(root,sc,nn.d+1)*(oct||1));
          if(!oct)X.prev=f;
        }
        pos+=nn.len;
      }
    }
    // ezgi çalgıları: süsleme (çarpma, tremolo, kaydırma) burada
    const L={
      saz(t,f,d,v,len,fu){if(len>=3)trem(saz,t,f,d*.92,v);else{if(R()<.2)saz(t-.045,fu,.1,v*.5);saz(t,f,Math.min(1.6,d*1.7),v,R()<.12?{bend:-60,bt:.07}:null);}},
      ud(t,f,d,v,len,fu){if(len>=4&&R()<.5)trem(ud,t,f,d*.8,v*.9);else{if(R()<.16)ud(t-.05,fu,.12,v*.5);ud(t,f,Math.min(1.9,d*1.8),v,R()<.15?{bend:-70,bt:.09}:null);}},
      kanun(t,f,d,v,len){if(len>=3)trem(kanun,t,f,d*.9,v*.85);else kanun(t,f,Math.min(2,d*2),v);},
      klarnet(t,f,d,v,len,fu){const from=R()<.22?fu:(X.prev||f);
        if(len>=2&&R()<.16){const q=Math.min(.09,d/4);klarnet(t,f,q,v,from);klarnet(t+q,fu,q,v*.9,f);klarnet(t+q*2,f,d*.97-q*2,v,fu,true);}   // mordan
        else klarnet(t,f,d*.97,v,from,len>=2);},
      yayli(t,f,d,v){yayli(t,f,d*1.02,v,X.prev||f);yayli(t,f*2,d*1.02,v*.45,(X.prev||f)*2);},
    };
    function turk(modes){
      let mi=-1,M=null,bars=0,S1=null,S2=null;
      const next=()=>{mi=(mi+1)%modes.length;M=modes[mi];bars=0;S1=sent(M);S2=sent(M);X.prev=0;};
      next();
      return t=>{
        if(modes.length>1&&bars>=M.len)next();
        if(bars&&bars%16===0){S2=sent(M);if(bars%32===0)S1=sent(M);}
        const st=30/M.bpm,sec=(bars>>2)%4,bi=bars%4,sc=MK[M.mk],S=sec===2?S2:S1,pv=M.pv;
        // usul: düm (D), tek (T), ka (k), zil (z)
        for(let i=0;i<M.steps;i++){
          const h=M.usul[i],tt=t+i*st+hum()*.6,v=pv*rnd(.82,1.08);
          if(h==='D')dum(tt,v);else if(h==='T')tek(tt,v*.9);else if(h==='k')ka(tt,v*.7);
          else if(R()<(bi===3?.45:.16))ka(tt,v*.4);   // boşluklara ara vuruş; cümle sonunda sıklaşır
          if(M.zil&&i%2===0)zil(tt,pv*(i%4===0?.5:.3));
        }
        M.dem(t,st,hzOf(M.root,sc,0),hzOf(M.root,sc,M.guclu||4),bars);
        playLine(S[bi],t,st,M.root,sc,M.lv,L[M.lead]);
        if(M.dbl&&(sec===1||sec===3))playLine(S[bi],t,st,M.root,sc,M.lv*.55,L[M.dbl],.5);   // tekrar: ikinci çalgı bir oktav aşağıdan eşlik eder
        if(bi===3&&M.fill){   // ara nağme: uzun karar sesinin üstüne kısa bir cevap
          const up=R()<.4,k=5+Math.floor(R()*3),q=st*.5,t1=t+(M.steps-k*.5)*st;
          for(let i=0;i<k;i++){const d=up?i:k-1-i+(i===k-1?0:1);L[M.fill](t1+i*q+hum()*.5,hzOf(M.root,sc,d),q,M.lv*.6*rnd(.8,1.05),1,hzOf(M.root,sc,d+1));}
        }
        bars++;
        return M.steps*st;
      };
    }
    const TR={lo:-1,hi:8,start:[4,4,3,5],peak:7};
    const demUd=v=>(t,st,r,g,n)=>{ud(t+hum(),r/2,1.6,v);if(n%2)ud(t+4*st+hum(),g/2,1.2,v*.7);};
    const demSaz=v=>(t,st,r,g)=>{saz(t+hum(),r/2,1.2,v);saz(t+.03,g/2,1.2,v*.7);saz(t+4*st+hum(),r/2,.9,v*.6);};
    const demBas=v=>(t,st,r,g)=>{bass(t+hum(),r/4,.5,v);bass(t+3*st+hum(),r/4,.25,v*.6);bass(t+4*st+hum(),g/4,.45,v*.85);bass(t+6*st+hum(),r/4,.3,v*.7);};

    /* ---- Caz ailesi: akor yürüyüşü + bas + eşlik + seyrek ezgi ---- */
    function jazz(P){
      const sc=MK.major,f=d=>hzOf(P.root,sc,d);let last=null,pd=10,pf=0;
      return (t,n)=>{
        const r=P.prog[n%P.prog.length],nr=P.prog[(n+1)%P.prog.length],st=30/P.bpm;
        const at=i=>t+i*st+((P.swing&&i%2)?st*P.swing:0)+hum();
        let bf=f(r-7);if(bf>125)bf/=2;const b5=bf*1.4983;
        const b=r>=4?r-7:r,vo=[b+2,b+6,b+8].map(f);
        const chord=(i,v,roll,d)=>vo.forEach((x,k)=>P.comp(at(i)+k*(roll||.006),x,d||st*1.6,v*rnd(.85,1.05)));
        if(P.feel==='bossa'){
          bass(at(0),bf,st*2.6,P.bv);bass(at(3),b5,st*.9,P.bv*.7);bass(at(4),bf,st*2.6,P.bv*.9);bass(at(7),b5,st*.9,P.bv*.7);
          (n%2?[2,5]:[0,3,6]).forEach(i=>{chord(i,P.cv,.012,st*1.3);rim(at(i),P.dv*.5);});
          for(let i=0;i<8;i++)shaker(at(i),P.dv*(i%2?.5:.28));
        }else if(P.feel==='smooth'){
          bass(at(0),bf,st*2.4,P.bv);bass(at(3),bf,st*.9,P.bv*.7);bass(at(4),b5,st*1.6,P.bv*.8);if(n%2)bass(at(7),bf*2,st*.8,P.bv*.6);
          [0,3].forEach(i=>chord(i,P.cv,.01,st*2.2));if(R()<.5)chord(6,P.cv*.7,.01,st*1.2);
          kick(at(0),P.dv);kick(at(5),P.dv*.7);rim(at(2),P.dv*.6);rim(at(6),P.dv*.6);for(let i=0;i<8;i++)hat(at(i),P.dv*(i%2?.22:.34));
        }else{   // balad
          bass(at(0),bf,st*5,P.bv);if(n%2)bass(at(4),b5,st*3,P.bv*.7);
          chord(0,P.cv,.035,st*6);if(R()<.6)chord(4+(R()<.4?1:0),P.cv*.65,.03,st*3);
          if(P.dv)for(let i=0;i<8;i+=2)brush(at(i),P.dv*(i%4?.9:.6),st*1.6);
        }
        if(R()<P.dens){
          const tones=[r,r+2,r+4,r+6,r+7,r+9,r+11].filter(d=>d>=7&&d<=16);
          let Ln;
          if(last&&R()<.35){const sh=pick([-1,1,-2]);Ln=last.map(x=>({d:x.d==null?null:cl(x.d+sh,6,17),len:x.len}));}
          else Ln=line(pick(RHJ),cl(pd+pick([-2,-1,1,2]),7,15),tones.reduce((a,d)=>Math.abs(d-pd)<Math.abs(a-pd)&&R()<.7?d:a,pick(tones)),6,17);
          let pos=0;
          for(const x of Ln){if(x.d!=null){const fr=f(x.d);P.lead(at(pos),fr,x.len*st*.95,P.lv*rnd(.8,1.1),pf||fr);pf=fr;pd=x.d;}pos+=x.len;}
          last=Ln;
        }else last=null;
        return 8*st;
      };
    }
    // Salon valsi: birde bas, iki ve üçte akor, üstte keman
    function vals(){
      const sc=MK.major,root=130.8,f=d=>hzOf(root,sc,d),st=30/132,prog=[0,0,4,4,4,4,0,0,3,3,0,5,1,4,0,0];let pd=11,pf=0;
      return (t,n)=>{
        const r=prog[n%16],b=r>=4?r-7:r,at=i=>t+i*st+hum();
        bass(at(0),f(n%2?r-3:r)/2*(r>=4?.5:1),st*3,.34);
        [2,4].forEach(i=>[b+9,b+11,b+13].forEach((d,k)=>piano(at(i)+k*.008,f(d),st*1.5,.1*rnd(.8,1.05))));
        const tones=[r+7,r+9,r+11,r+14].map(d=>d>18?d-7:d);
        const Ln=n%4===3?[{d:pick([r+7,r+9,r+11]),len:6}]:line(pick(RH6),cl(pd+pick([-1,1,2]),8,17),pick(tones),7,18);
        let pos=0;
        for(const x of Ln){const fr=f(x.d);keman(at(pos),fr,x.len*st*1.02,.2*rnd(.85,1.08),pf||fr);pf=fr;pd=x.d;pos+=x.len;}
        return 6*st;
      };
    }
    // Makao: guzheng örgüsü, cümle aralarında erhu
    function macau(){
      const sc=MK.penta,root=196,f=d=>hzOf(root,sc,d),st=30/88;
      const T={lo:0,hi:9,start:[4,5,6],peak:8,rh:[[2,2,2,2],[3,1,2,2],[1,1,2,4],[2,1,1,2,2],[4,2,2]],cad:[[2,2,4],[1,1,2,4],[3,1,4]]};
      let S=sent(T),pf=0;
      return (t,n)=>{
        if(n&&n%16===0)S=sent(T);
        const bi=n%4,sec=(n>>2)%4,base=[0,2,3,0][(n>>1)%4],at=i=>t+i*st+hum();
        [0,2,4,2,5,4,2,4].forEach((d,i)=>{if(i%2===0||R()<.7)zheng(at(i),f(base+d-5),1.8,(i%4===0?.3:.2)*rnd(.8,1.1),R()<.1?{bend:-90,bt:.12}:null);});
        if(bi===3&&R()<.7)for(let i=0;i<7;i++)zheng(t+5.2*st+i*.055,f(9-i),1.4,.2-i*.012);   // glissando
        if(n%2===0)sub(t,root/4,st*8,.3);
        if(sec===1||sec===3){let pos=0;for(const x of S[bi]){if(x.d!=null){const fr=f(x.d+5);erhu(at(pos),fr,x.len*st,.17*rnd(.85,1.08),pf||fr);pf=fr;}pos+=x.len;}}
        else if(sec===2){let pos=0;for(const x of S[bi]){if(x.d!=null)zheng(at(pos),f(x.d+5),1.6,.3*rnd(.85,1.05),R()<.25?{bend:-110,bt:.14}:null);pos+=x.len;}}
        if(n%4===0)nz(t,1.6,.05,'bandpass',900,6,.3);
        return 8*st;
      };
    }
    // Vegas: 12 ölçü blues üzerinde big band swing; nefesliler riff çalar, aralarda piyano cevap verir
    function swing(){
      const key=98,st=30/132,sw=.3,ch=[0,0,0,0,5,5,0,0,7,5,0,7],bl=MK.blues;let riff=null,pd=6;
      const mkRiff=()=>[line(pick(RHJ),pick([5,6,7]),pick([3,4,6]),2,9),line(pick([[2,1,1,-4],[1,1,2,-4],[-1,1,1,1,-4],[3,1,-4]]),pick([3,4,5]),pick([0,3,6]),0,9)];
      return (t,n)=>{
        const bar=n%12,c=ch[bar],nc=ch[(bar+1)%12],sem=s=>key*Math.pow(2,s/12),at=i=>t+i*st+(i%2?st*sw:0)+hum();
        if(bar===0||!riff)riff=mkRiff();
        // yürüyen bas
        [c,c+pick([4,7,2]),c+pick([7,9,5]),nc+pick([-1,1])].forEach((s,i)=>bass(at(i*2),sem(s)*(s>9?.5:1),st*1.9,.4*rnd(.85,1.05)));
        // ride: ding, ding-a-ding; hi-hat iki ve dörtte
        [0,2,3,4,6,7].forEach(i=>ride(at(i),(i%2?.14:.22)*rnd(.85,1.1)));hat(at(2),.2,.05);hat(at(6),.2,.05);if(R()<.3)kick(at(0),.25);
        // piyano eşlik: kısa vuruşlar
        (R()<.5?[0,3]:[3,6]).forEach(i=>[4,10,14].forEach(s=>piano(at(i),sem(c+s)*2,st*.9,.085*rnd(.8,1.05))));
        const ph=bar%4;
        if(ph<2){   // riff: saksafon ve trompet bir oktav arayla, cümle sonunda pirinç vurgusu
          let pos=0;for(const x of riff[ph]){if(x.d!=null){const fr=hzOf(key*2,bl,x.d),d=x.len*st*.9,v=.15*rnd(.85,1.08);sax(at(pos),fr,d,v,fr);brass(at(pos),fr*2,d,v*.6);}pos+=x.len;}
          if(ph===1&&R()<.6)[4,10,14].forEach(s=>brass(at(6),sem(c+s)*4,st*.7,.07));
        }else if(R()<.55){   // piyano cevabı
          const Ln=line(pick(RHJ),cl(pd+pick([-2,-1,1,2]),4,11),pick([6,7,9]),3,12);
          let pos=0;for(const x of Ln){if(x.d!=null){piano(at(pos),hzOf(key*4,bl,x.d-6),x.len*st*.9,.16*rnd(.8,1.1));pd=x.d;}pos+=x.len;}
        }
        return 8*st;
      };
    }

    const DEF={
      arabesk:()=>turk([Object.assign({},TR,{mk:'kurdi',root:293.7,bpm:80,steps:8,usul:'D.TTD.T.',pv:.26,zil:true,rh:RH8,cad:CAD8,lead:'yayli',lv:.19,dbl:'saz',fill:'saz',dem:demBas(.42)})]),
      turku:()=>turk([Object.assign({},TR,{mk:'huseyni',root:220,bpm:92,steps:8,usul:'D.T.DkT.',pv:.14,rh:RH8,cad:CAD8,lead:'saz',lv:.34,fill:'saz',dem:demSaz(.2)})]),
      fasil:()=>turk([
        Object.assign({},TR,{len:32,mk:'nihavent',root:392,bpm:96,steps:8,usul:'D.T.D.Tk',pv:.3,zil:true,rh:RH8,cad:CAD8,lead:'klarnet',lv:.2,dbl:'kanun',fill:'kanun',dem:demUd(.3)}),
        Object.assign({},TR,{len:32,mk:'hicaz',root:392,bpm:168,steps:9,usul:'D.T.D.TT.',pv:.32,zil:true,rh:RH9,cad:CAD9,lead:'klarnet',lv:.2,dbl:'kanun',fill:'kanun',dem:demUd(.3)}),
      ]),
      ud:()=>turk([Object.assign({},TR,{mk:'ussak',root:293.7,bpm:84,steps:8,usul:'D..TD.T.',pv:.2,rh:RH8,cad:CAD8,lead:'ud',lv:.36,fill:'kanun',dem:demUd(.26)})]),
      bossa:()=>jazz({feel:'bossa',root:174.6,bpm:126,prog:[1,4,0,5,1,4,0,0,3,6,2,5,1,4,0,0],comp:(t,f,d,v)=>gtr(t,f,d,v),cv:.2,bv:.38,dv:.12,lead:(t,f,d,v)=>vibes(t,f,d,v),lv:.2,dens:.5}),
      smooth:()=>jazz({feel:'smooth',root:220,bpm:98,prog:[0,5,1,4,0,5,3,4],comp:ep,cv:.11,bv:.4,dv:.2,lead:(t,f,d,v,p)=>sax(t,f/2,d,v,p/2),lv:.15,dens:.55}),
      ballad:()=>jazz({feel:'ballad',root:130.8,bpm:60,prog:[1,4,0,5,3,4,0,0,2,5,1,4,0,3,1,4],comp:piano,cv:.11,bv:.36,dv:.05,lead:(t,f,d,v)=>piano(t,f,d,v),lv:.2,dens:.6}),
      calm:()=>jazz({feel:'ballad',root:174.6,bpm:64,prog:[0,5,3,4,0,2,1,4],comp:ep,cv:.1,bv:.26,dv:0,lead:(t,f,d,v)=>ep(t,f,d,v),lv:.15,dens:.4}),
      vals,macau,swing,
    };
    const bar=(DEF[style]||DEF.calm)();
    let n=0,next=ctx.currentTime+.5;
    const it=setInterval(()=>{
      if(ctx.state!=='running')return;
      if(next<ctx.currentTime-.3)next=ctx.currentTime+.15;
      while(next<ctx.currentTime+.5){
        let dur=2;
        if(isOn()){try{dur=bar(next,n)||2;}catch(e){if(window.VY_DEBUG)console.error('muzik',style,e);}}
        next+=dur;n++;
      }
    },110);
    return {stop(){clearInterval(it);loops.forEach(s=>{try{s.stop();}catch(e){}});keepN.forEach(x=>{try{x.disconnect();}catch(e){}});}};
  }
  return {start,styles:['arabesk','turku','fasil','ud','bossa','smooth','vals','macau','swing','ballad','calm']};
})();
