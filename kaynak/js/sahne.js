'use strict';
/* ================= 3D SAHNE =================
   Salon, masa, kartlar, fişler ve rakipler Three.js ile çizilir; oyun motoru (oyun.js) aynı kalır.
   Motor durumu Sahne.sync(G) ile aktarır, davranışları Sahne.act(p,fiil,ops) ile tetikler.
   Hareket: eller, baş ve gövde kritik sönümlü yaylarla hedefe ivmelenerek gider (sabit hızlı robot hareketi yok);
   gözler önden gider, baş ancak bakış rahat alanın dışına çıkınca döner; uzaktaki hedefe giden el yay çizerek kalkar.
   Fiş ve kartlar ele yapışır: bahsi yapanın fişleri, çekilenin kartları, potu toplayanın fişleri elle taşınır.
   Kartlar mat (yansımasız) ve hafif kendinden aydınlıktır; ışık ve gölge ne olursa olsun okunur kalır. */
const Sahne=(()=>{
const T=window.THREE;
let OK=false;
try{if(T){const c=document.createElement('canvas');OK=!!(c.getContext('webgl2')||c.getContext('webgl'));}}catch(e){}
if(!OK)return {ok:false,hall(){return Promise.resolve();},side(){return Promise.resolve();},start(){return Promise.resolve();},stop(){},sync(){},act(){},attend(){},cine(){},inView(){return true;},shuffle(){},say(){return false;},croup(){},resetView(){},focus(){},applySettings(){},get active(){return false;}};

/* ---------- yardımcılar ---------- */
const R=Math.random,PI=Math.PI,TAU=PI*2;
const V3=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const lerp=(a,b,k)=>a+(b-a)*k;
const cl=(x,a,b)=>Math.max(a,Math.min(b,x));
const damp=(a,b,l,dt)=>lerp(a,b,1-Math.exp(-l*dt));
const eIO=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
const shade=(c,f)=>'#'+new T.Color(c).multiplyScalar(f).getHexString();
const pick1=a=>a[Math.floor(R()*a.length)];
// Kritik sönümlü yay: hedefe ivmelenerek yaklaşır, yavaşlayarak durur, aşmaz.
function spring(x,v,tg,w,dt){const d=x-tg,e=Math.exp(-w*dt),a=v+w*d;return [tg+(d+a*dt)*e,(v-a*w*dt)*e];}
function springV(x,v,tg,w,dt){let r=spring(x.x,v.x,tg.x,w,dt);x.x=r[0];v.x=r[1];r=spring(x.y,v.y,tg.y,w,dt);x.y=r[0];v.y=r[1];r=spring(x.z,v.z,tg.z,w,dt);x.z=r[0];v.z=r[1];}
const TY=.76,RX=1.3,RZ=.78,RXo=1.45,RZo=.93,CW=.063,CH=.088,CHIP_R=.0195,CHIP_H=.0034;
const _a=V3(),_b=V3(),_e=V3(),_h=V3(),_t=V3(),_t2=V3(),_t3=V3(),_w=V3(),_up=V3(0,1,0),_Z=V3(0,0,1),_q=new T.Quaternion(),_m=new T.Matrix4(),_one=V3(1,1,1);
const setting=(k,d)=>{try{const v=SAVE.settings[k];return v==null?d:v;}catch(e){return d;}};
const Q=()=>setting('gfx','high');
const BRIGHT=()=>({dim:.8,normal:1,bright:1.25})[setting('bright','normal')]||1;

let W=null,renderer=null,camera=null,host=null,labelsEl=null,clock=null,raf=0,ray=null,shadowsOn=true;
const cam={yaw:0,pitch:-.29,fov:56,tYaw:0,tPitch:-.29,tFov:56,vy:0,vp:0,user:-99,focus:-1,drag:null};

/* ---------- önbellekler ---------- */
const GC=new Map(),MC=new Map();
const geo=(k,f)=>{let g=GC.get(k);if(!g){g=f();GC.set(k,g);}return g;};
const sph=(r,w=14,h=10)=>geo(`s${r}_${w}_${h}`,()=>new T.SphereGeometry(r,w,h));
const cyl=(a,b,h,s=12)=>geo(`c${a}_${b}_${h}_${s}`,()=>new T.CylinderGeometry(a,b,h,s));
const box=(x,y,z)=>geo(`b${x}_${y}_${z}`,()=>new T.BoxGeometry(x,y,z));
const shell=(r,ps,pl,ts,tl)=>geo(`h${r}_${ps}_${pl}_${ts}_${tl}`,()=>new T.SphereGeometry(r,22,14,ps,pl,ts,tl));
const torus=(r,t,arc=TAU,rs=8,ts=24)=>geo(`t${r}_${t}_${arc}`,()=>new T.TorusGeometry(r,t,rs,ts,arc));
function mat(c,o){const k=c+'|'+(o?JSON.stringify(o):'');let m=MC.get(k);if(!m){m=new T.MeshStandardMaterial(Object.assign({color:c,roughness:.8,metalness:0},o||{}));MC.set(k,m);}return m;}
function mesh(g,m,sh=true){const o=new T.Mesh(g,m);if(sh){o.castShadow=true;o.receiveShadow=true;}return o;}
const GOLD=()=>mat('#d9ad4a',{metalness:.85,roughness:.3});
const GLASS=()=>mat('#ffffff',{transparent:true,opacity:.22,roughness:.05,depthWrite:false});
function ctex(w,h,draw,o={}){
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);
  const t=new T.CanvasTexture(c);if(o.srgb!==false)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
  if(o.rep){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(o.rep[0],o.rep[1]);}
  if(!o.keep&&W)W.disp.push(t);
  return t;
}
function tmat(map,o){const m=new T.MeshStandardMaterial(Object.assign({map,roughness:.85},o||{}));if(W)W.disp.push(m);return m;}
function rrect(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();}
function speckle(x,w,h,n,a,s=2){for(let i=0;i<n;i++){const v=(R()-.5)*a;x.fillStyle=v>0?`rgba(255,255,255,${v})`:`rgba(0,0,0,${-v})`;x.fillRect(R()*w,R()*h,s,s);}}
function blot(x,w,h,n,col,r0,r1){for(let i=0;i<n;i++){const cx=R()*w,cy=R()*h,r=r0+R()*(r1-r0),g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);}}
function tween(dur,fn,done,delay=0){if(W)W.tw.push({t:-delay,dur,fn,done});}

/* ---------- mekânlar ---------- */
const VS={
  antrenman:{felt:'#2f6a4c',rail:'#2e1d12',chair:'club',chips:['#c9372c','#2c7d47','#1e1e22'],back:'#24513b',room:[11,11,3.1],wall:'stripe',floor:'wood',fog:['#0e0c09',.045],lamp:{c:'#ffe5bf',i:20,y:2.15,shade:'#1f4a32'},hemi:.45,fill:3.2,env:'#6a5a44',exp:1.05,cone:.045,dust:true},
  kacak:{felt:'#56633a',rail:'#4b301b',railWood:true,worn:true,chair:'plastic',chips:['#d1382b','#2a8a4c','#e8e1cf'],back:'#4d3420',room:[8,8,2.55],wall:'concrete',floor:'concrete',fog:['#1a140d',.1],lamp:{c:'#ffc57a',i:11,y:2.05,bulb:true},hemi:.26,fill:2.6,env:'#5a4a30',exp:1.1,cone:.06,dust:true},
  yeralti:{felt:'#6c222a',rail:'#1f130e',chair:'wood',chips:['#d5c9ae','#1c5e8a','#141414'],back:'#4e141a',room:[10,10,2.9],wall:'panel',floor:'wood',fog:['#140b0a',.065],lamp:{c:'#ffd79e',i:15,y:2.0,shade:'#1d4a2b'},hemi:.32,fill:3.6,env:'#5a3a2a',exp:1.05,cone:.04,dust:true},
  girne:{felt:'#15696b',rail:'#2e231a',chair:'casino',chips:['#e9e4d6','#c0392b','#1f6fb2'],back:'#0f4f51',room:[14,14,3.4],wall:'cream',floor:'carpetBlue',fog:['#0b1316',.035],lamp:{c:'#fff1dc',i:23,y:2.45},hemi:.5,fill:3.4,env:'#7d8a96',exp:1.0,casino:true},
  monte:{felt:'#1d3c70',rail:'#0f0e13',chair:'velvet',chips:['#f1ece0','#7a2f8f','#1b1b1f'],back:'#162b54',room:[14,14,4.2],wall:'damask',floor:'marble',fog:['#0b0c12',.03],lamp:{c:'#ffe6bf',i:25,y:2.6},hemi:.45,fill:3.4,env:'#8a7558',exp:.98,casino:true},
  vegas:{felt:'#9d1d26',rail:'#0d0c0d',chair:'casinoBlack',chips:['#1b1b1b','#7b3fb6','#e3b21f'],back:'#7d111a',room:[16,16,4],wall:'vegas',floor:'carpetVegas',fog:['#0d0710',.034],lamp:{c:'#fff4e6',i:21,y:2.5},hemi:.4,fill:3.6,env:'#7a3a6a',exp:1.02,casino:true},
  kiraathane:{felt:'#3f5c3a',rail:'#3a2515',railWood:true,worn:true,chair:'wood',chips:['#c9372c','#e8e1cf','#2c5a8a'],back:'#6a2a1c',room:[9,9,2.8],wall:'tile',floor:'wood',fog:['#17110c',.08],lamp:{c:'#ffe2b0',i:12,y:2.05,shade:'#3a5a3a'},hemi:.3,fill:2.8,env:'#6a5438',exp:1.08,cone:.05,dust:true},
  han:{felt:'#5a2a52',rail:'#3a2415',railWood:true,chair:'wood',chips:['#e0b34a','#2c7d6b','#7a1d3a'],back:'#3c1f45',room:[11,11,3.2],wall:'stone',floor:'kilim',fog:['#120b10',.05],lamp:{c:'#ffd9a0',i:16,y:2.1,shade:'#6a3a1a'},hemi:.34,fill:3.2,env:'#6a4a3a',exp:1.05,cone:.045,dust:true},
  yali:{felt:'#4a4f5a',rail:'#cbbf9f',chair:'casino',chips:['#f1ece0','#1f4a63','#b8323a'],back:'#2e3a4a',room:[13,13,3.3],wall:'yali',floor:'parquet',fog:['#0a0e14',.03],lamp:{c:'#fff0d8',i:22,y:2.35},hemi:.5,fill:3.6,env:'#7a8a9a',exp:1.0},
  macau:{felt:'#0f5a3e',rail:'#2a0f0c',chair:'velvet',chips:['#c0392b','#e3b21f','#1b1b1b'],back:'#7a1020',room:[14,14,3.8],wall:'lacquer',floor:'carpetMacau',fog:['#12080a',.034],lamp:{c:'#fff0d0',i:23,y:2.5},hemi:.42,fill:3.5,env:'#8a4a3a',exp:1.0,casino:true},
  suit:{felt:'#17171c',rail:'#8c6a2b',chair:'casinoBlack',chips:['#f4efe4','#b8913f','#0b0b0d'],back:'#26262e',room:[17,17,4.6],wall:'suit',floor:'marbleBlack',fog:['#08080c',.026],lamp:{c:'#fff4e6',i:26,y:2.7},hemi:.38,fill:3.8,env:'#6a5a7a',exp:1.0,casino:true},
};
const CROUP={
  girne:{sex:'m',age:35,skin:'#c99272',hair:['slick','#1c140e'],top:['vest','#f4f1ea','#1d3a3c'],tie:['bow','#111'],expr:.3},
  monte:{sex:'f',age:31,skin:'#ebc8ab',hair:['bun','#3a2416'],top:['vest','#f6f3ec','#14141a'],tie:['bow','#0b0b0d'],acc:['earrings'],expr:.3},
  vegas:{sex:'m',age:44,skin:'#9a6848',hair:['short','#141010'],face:['goatee','#141010'],top:['vest','#f4f1ea','#5a0d14'],tie:['bow','#0b0b0d'],expr:.3},
  macau:{sex:'f',age:29,skin:'#e9c9a6',hair:['bun','#14100e'],top:['vest','#f6f3ec','#7a1020'],tie:['bow','#0b0b0d'],acc:['earrings'],expr:.3},
  suit:{sex:'m',age:50,skin:'#d2a782',hair:['slick','#9a9690'],face:['mustache','#9a9690'],top:['tux','#0f0f12','#f6f4ee'],tie:['bow','#0b0b0d'],acc:['watch','pocket'],expr:.25},
};

/* ---------- dokular ---------- */
const RL=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],SY=['♠︎','♥︎','♦︎','♣︎'];
const four=()=>!!setting('four',false);
const suitCol=s=>s===1?'#c8202c':s===2?(four()?'#1a5fd0':'#c8202c'):s===3?(four()?'#11853f':'#111111'):'#111111';
const RKF='"Bodoni Moda",Georgia,"Times New Roman",serif',SYF='"Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif';
// Köşe indeksi: kalın, eşit kalınlıkta yazı (ince çizgili serif uzaktan ve ışıkta kayboluyordu: 4, 1'e benziyordu)
const IDXF='"Segoe UI","Helvetica Neue",Arial,sans-serif';
const cardTexC=new Map();
function cardTex(c){
  const k=c+(four()?'f':'');let t=cardTexC.get(k);if(t)return t;
  const r=c>>2,s=c&3,col=suitCol(s);
  t=ctex(256,358,(x,w,h)=>{
    rrect(x,3,3,w-6,h-6,22);x.fillStyle='#fbf8f1';x.fill();x.lineWidth=3;x.strokeStyle='#bfb59e';x.stroke();
    x.fillStyle=col;x.textAlign='center';x.textBaseline='alphabetic';
    const corner=()=>{
      x.save();x.translate(66,126);if(r===8)x.scale(.72,1);x.font=`900 134px ${IDXF}`;x.fillText(RL[r],0,0);x.restore();
      x.font=`118px ${SYF}`;x.fillText(SY[s],66,240);
    };
    corner();x.save();x.translate(w,h);x.rotate(PI);corner();x.restore();
  },{keep:true});
  cardTexC.set(k,t);return t;
}
function backTex(col){return ctex(256,358,(x,w,h)=>{
  rrect(x,3,3,w-6,h-6,22);x.fillStyle='#f4ecdb';x.fill();rrect(x,18,18,w-36,h-36,14);x.fillStyle=col;x.fill();
  x.save();x.clip();x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=3;for(let i=-h;i<w+h;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i+h,h);x.stroke();x.beginPath();x.moveTo(i+h,0);x.lineTo(i,h);x.stroke();}x.restore();
  x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=3;rrect(x,32,32,w-64,h-64,10);x.stroke();
});}
function chipMats(col){
  const top=ctex(128,128,(x,w,h)=>{x.fillStyle=col;x.fillRect(0,0,w,h);x.translate(64,64);x.fillStyle='#f4efe4';for(let i=0;i<8;i++){x.save();x.rotate(i*PI/4);x.fillRect(-7,-64,14,17);x.restore();}x.strokeStyle='rgba(255,255,255,.6)';x.lineWidth=3;x.setLineDash([6,5]);x.beginPath();x.arc(0,0,38,0,TAU);x.stroke();x.setLineDash([]);x.fillStyle=shade(col,1.12);x.beginPath();x.arc(0,0,30,0,TAU);x.fill();});
  const side=ctex(128,16,(x,w,h)=>{x.fillStyle=col;x.fillRect(0,0,w,h);x.fillStyle='#f4efe4';for(let i=0;i<8;i++)x.fillRect(i*16+4,0,7,h);});
  return [tmat(side,{roughness:.5}),tmat(top,{roughness:.45}),tmat(top,{roughness:.45})];
}
function feltTex(V,name){return ctex(1024,620,(x,w,h)=>{
  const g=x.createRadialGradient(w/2,h*.46,40,w/2,h/2,w*.62);g.addColorStop(0,shade(V.felt,1.02));g.addColorStop(1,shade(V.felt,.55));x.fillStyle=g;x.fillRect(0,0,w,h);
  speckle(x,w,h,70000,.08,1.5);
  if(V.worn){blot(x,w,h,12,'rgba(28,20,8,.3)',20,80);for(let i=0;i<7;i++){x.fillStyle='rgba(18,12,6,.75)';x.beginPath();x.ellipse(R()*w,R()*h,3+R()*4,2+R()*3,R()*3,0,TAU);x.fill();}}
  x.strokeStyle='rgba(255,240,200,.2)';x.lineWidth=3;x.beginPath();x.ellipse(w/2,h/2,w*.34,h*.33,0,0,TAU);x.stroke();
  x.fillStyle='rgba(255,240,210,.09)';x.textAlign='center';x.font=`58px Limelight,${RKF}`;x.fillText(name,w/2,h*.5+150);
});}
function wallTex(kind){
  const T2={
    concrete:(x,w,h)=>{x.fillStyle='#615c53';x.fillRect(0,0,w,h);speckle(x,w,h,18000,.22,2);blot(x,w,h,12,'rgba(40,30,18,.35)',40,160);const g=x.createLinearGradient(0,h*.65,0,h);g.addColorStop(0,'rgba(30,26,18,0)');g.addColorStop(1,'rgba(30,26,18,.6)');x.fillStyle=g;x.fillRect(0,0,w,h);x.strokeStyle='rgba(20,18,14,.55)';x.lineWidth=1.5;for(let i=0;i<6;i++){x.beginPath();let px=R()*w,py=R()*h;x.moveTo(px,py);for(let k=0;k<8;k++){px+=(R()-.5)*40;py+=R()*30;x.lineTo(px,py);}x.stroke();}},
    panel:(x,w,h)=>{x.fillStyle='#3d1216';x.fillRect(0,0,w,h*.55);for(let i=0;i<40;i++){x.fillStyle='rgba(120,60,40,.18)';x.beginPath();x.arc((i%8)*64+32,Math.floor(i/8)*56+20,10,0,TAU);x.fill();}x.fillStyle='#3a2416';x.fillRect(0,h*.55,w,h*.45);for(let i=0;i<4;i++){x.strokeStyle='rgba(0,0,0,.45)';x.lineWidth=6;x.strokeRect(i*128+12,h*.6,104,h*.33);x.strokeStyle='rgba(255,210,150,.08)';x.lineWidth=2;x.strokeRect(i*128+16,h*.6+4,96,h*.33-8);}speckle(x,w,h,6000,.08,2);x.fillStyle='#2a170d';x.fillRect(0,h*.53,w,h*.03);},
    stripe:(x,w,h)=>{for(let i=0;i<16;i++){x.fillStyle=i%2?'#20352a':'#1a2c22';x.fillRect(i*32,0,32,h);}x.fillStyle='#2b1c12';x.fillRect(0,h*.62,w,h*.38);x.fillStyle='#3b2718';x.fillRect(0,h*.6,w,h*.03);speckle(x,w,h,5000,.06,2);},
    cream:(x,w,h)=>{x.fillStyle='#cdbf9f';x.fillRect(0,0,w,h);speckle(x,w,h,6000,.05,2);x.strokeStyle='rgba(120,95,60,.35)';x.lineWidth=4;for(let i=0;i<2;i++){x.strokeRect(i*256+28,h*.12,200,h*.42);x.strokeRect(i*256+28,h*.62,200,h*.28);}x.fillStyle='#8a6a44';x.fillRect(0,h*.57,w,h*.025);},
    damask:(x,w,h)=>{x.fillStyle='#141c33';x.fillRect(0,0,w,h);x.fillStyle='rgba(212,170,90,.16)';for(let r=0;r<8;r++)for(let c=0;c<4;c++){const cx=c*128+(r%2?64:0)+32,cy=r*64+32;x.beginPath();x.moveTo(cx,cy-24);x.quadraticCurveTo(cx+18,cy,cx,cy+24);x.quadraticCurveTo(cx-18,cy,cx,cy-24);x.fill();}x.fillStyle='#b8913f';x.fillRect(0,h*.6,w,h*.012);x.fillStyle='#0f1426';x.fillRect(0,h*.612,w,h*.388);x.strokeStyle='rgba(212,170,90,.35)';x.lineWidth=3;for(let i=0;i<4;i++)x.strokeRect(i*128+14,h*.66,100,h*.28);},
    vegas:(x,w,h)=>{x.fillStyle='#120a14';x.fillRect(0,0,w,h);for(let i=0;i<8;i++){x.fillStyle='rgba(212,160,60,.35)';x.fillRect(i*64+30,0,3,h);}x.fillStyle='rgba(180,60,140,.06)';for(let i=0;i<60;i++){x.beginPath();x.arc(R()*w,R()*h,6+R()*20,0,TAU);x.fill();}},
    tile:(x,w,h)=>{x.fillStyle='#d6c9a8';x.fillRect(0,0,w,h);speckle(x,w,h,7000,.07,2);blot(x,w,h,8,'rgba(90,60,30,.2)',30,100);const y0=h*.5,th=h*.5/4;for(let r=0;r<4;r++)for(let c=0;c<8;c++){const px=c*64,py=y0+r*th;x.fillStyle=(r+c)%2?'#2f7f8a':'#ebe6d6';x.fillRect(px+1,py+1,62,th-2);if((r+c)%2){x.strokeStyle='rgba(255,255,255,.4)';x.lineWidth=2;x.strokeRect(px+14,py+14,36,th-28);}}x.fillStyle='#4a2f1a';x.fillRect(0,y0-6,w,10);speckle(x,w,h,3000,.06,2);},
    stone:(x,w,h)=>{x.fillStyle='#7d6e58';x.fillRect(0,0,w,h);for(let r=0;r<8;r++){const y=r*64;for(let c=-1;c<5;c++){const px=c*110+(r%2?55:0);x.fillStyle=`hsl(34,${18+R()*10}%,${40+R()*12}%)`;x.fillRect(px+2,y+2,106,60);}}speckle(x,w,h,16000,.2,2);blot(x,w,h,10,'rgba(40,25,12,.3)',30,110);},
    yali:(x,w,h)=>{x.fillStyle='#e8e3d6';x.fillRect(0,0,w,h);speckle(x,w,h,4000,.04,2);x.fillStyle='#d9d2c0';x.fillRect(0,h*.6,w,h*.4);x.strokeStyle='rgba(150,130,95,.55)';x.lineWidth=3;for(let i=0;i<2;i++){x.strokeRect(i*256+26,h*.1,204,h*.42);x.strokeRect(i*256+26,h*.66,204,h*.27);}x.fillStyle='#a8905c';x.fillRect(0,h*.585,w,h*.02);x.fillRect(0,0,w,h*.025);},
    lacquer:(x,w,h)=>{x.fillStyle='#560b14';x.fillRect(0,0,w,h);x.strokeStyle='rgba(222,176,70,.38)';x.lineWidth=2;for(let i=0;i<=8;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64,h*.62);x.stroke();}for(let j=0;j<=6;j++){x.beginPath();x.moveTo(0,j*h*.62/6);x.lineTo(w,j*h*.62/6);x.stroke();}for(let i=0;i<8;i++)for(let j=0;j<6;j++){x.fillStyle='rgba(222,176,70,.18)';x.beginPath();x.arc(i*64+32,j*h*.62/6+h*.62/12,6,0,TAU);x.fill();}x.fillStyle='#d6a73a';x.fillRect(0,h*.62,w,h*.015);x.fillStyle='#1a0709';x.fillRect(0,h*.635,w,h*.365);x.strokeStyle='rgba(222,176,70,.35)';x.lineWidth=3;for(let i=0;i<4;i++)x.strokeRect(i*128+14,h*.68,100,h*.26);speckle(x,w,h,5000,.07,2);},
    suit:(x,w,h)=>{const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#0c0c10');g.addColorStop(.5,'#18181f');g.addColorStop(1,'#0a0a0d');x.fillStyle=g;x.fillRect(0,0,w,h);x.globalAlpha=.25;for(let k=0;k<22;k++){x.strokeStyle=R()<.5?'#8e8aa0':'#d6cfe0';x.lineWidth=.6+R()*1.2;x.beginPath();let px=R()*w,py=R()*h;x.moveTo(px,py);for(let s2=0;s2<6;s2++){px+=(R()-.5)*100;py+=(R()-.5)*100;x.lineTo(px,py);}x.stroke();}x.globalAlpha=1;x.fillStyle='#b8913f';for(let i=0;i<4;i++)x.fillRect(i*128+60,0,3,h);x.fillRect(0,h*.62,w,h*.012);},
  };
  return ctex(512,512,T2[kind]||T2.cream);
}
function floorTex(kind){
  const T2={
    concrete:(x,w,h)=>{x.fillStyle='#3d3a35';x.fillRect(0,0,w,h);speckle(x,w,h,20000,.2,2);blot(x,w,h,10,'rgba(15,12,8,.4)',30,120);x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;x.strokeRect(0,0,w,h);},
    wood:(x,w,h)=>{for(let i=0;i<8;i++){const c=['#4a2e1a','#55361f','#3f2715','#5b3a22'][i%4];x.fillStyle=c;x.fillRect(0,i*64,w,64);x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=2;x.beginPath();x.moveTo(0,i*64);x.lineTo(w,i*64);x.stroke();const o=(i*137)%w;x.beginPath();x.moveTo(o,i*64);x.lineTo(o,i*64+64);x.stroke();for(let k=0;k<6;k++){x.strokeStyle='rgba(20,10,4,.18)';x.lineWidth=1;x.beginPath();const y=i*64+8+k*9+R()*4;x.moveTo(0,y);x.bezierCurveTo(w*.3,y+R()*6-3,w*.6,y+R()*6-3,w,y);x.stroke();}}},
    carpetBlue:(x,w,h)=>{x.fillStyle='#16233f';x.fillRect(0,0,w,h);x.strokeStyle='rgba(212,170,90,.32)';x.lineWidth=3;for(let i=0;i<4;i++)for(let j=0;j<4;j++){const cx=i*128+64,cy=j*128+64;x.beginPath();x.moveTo(cx,cy-40);x.lineTo(cx+40,cy);x.lineTo(cx,cy+40);x.lineTo(cx-40,cy);x.closePath();x.stroke();}speckle(x,w,h,30000,.1,1.5);},
    marble:(x,w,h)=>{for(let i=0;i<2;i++)for(let j=0;j<2;j++){x.fillStyle=(i+j)%2?'#1a1918':'#ece6da';x.fillRect(i*256,j*256,256,256);}x.globalAlpha=.35;for(let k=0;k<26;k++){x.strokeStyle=R()<.5?'#8f877a':'#fff';x.lineWidth=.6+R()*1.6;x.beginPath();let px=R()*w,py=R()*h;x.moveTo(px,py);for(let s=0;s<6;s++){px+=(R()-.5)*120;py+=(R()-.5)*120;x.lineTo(px,py);}x.stroke();}x.globalAlpha=1;x.strokeStyle='rgba(180,150,90,.6)';x.lineWidth=2;for(let i=0;i<=2;i++){x.beginPath();x.moveTo(i*256,0);x.lineTo(i*256,h);x.stroke();x.beginPath();x.moveTo(0,i*256);x.lineTo(w,i*256);x.stroke();}},
    carpetVegas:(x,w,h)=>{x.fillStyle='#1a0b1e';x.fillRect(0,0,w,h);const cs=['#c2185b','#1e88e5','#f9a825','#00897b','#8e24aa'];for(let i=0;i<70;i++){x.strokeStyle=cs[i%5];x.globalAlpha=.55;x.lineWidth=3+R()*5;x.beginPath();x.arc(R()*w,R()*h,8+R()*40,R()*6,R()*6+2+R()*3);x.stroke();}x.globalAlpha=1;speckle(x,w,h,20000,.12,1.5);},
    kilim:(x,w,h)=>{x.fillStyle='#6a1f1a';x.fillRect(0,0,w,h);for(let r=0;r<8;r++)for(let c=0;c<8;c++){const cx=c*64+32,cy=r*64+32;x.fillStyle=(r+c)%2?'#d6a73a':'#1d3a5a';x.beginPath();x.moveTo(cx,cy-24);x.lineTo(cx+24,cy);x.lineTo(cx,cy+24);x.lineTo(cx-24,cy);x.fill();x.fillStyle=(r+c)%2?'#6a1f1a':'#e8dcc0';x.beginPath();x.arc(cx,cy,7,0,TAU);x.fill();}x.strokeStyle='#e8dcc0';x.lineWidth=4;x.strokeRect(6,6,w-12,h-12);speckle(x,w,h,20000,.12,2);},
    parquet:(x,w,h)=>{x.fillStyle='#3a2414';x.fillRect(0,0,w,h);for(let r=0;r<16;r++)for(let c=0;c<8;c++){const px=c*64+(r%2?32:0),py=r*32;x.fillStyle=['#4a2d18','#563520','#3e2615','#5c3a22'][(r*3+c)%4];x.fillRect(px+1,py+1,62,30);}speckle(x,w,h,14000,.1,2);},
    carpetMacau:(x,w,h)=>{x.fillStyle='#2a0a10';x.fillRect(0,0,w,h);x.strokeStyle='rgba(214,167,58,.4)';x.lineWidth=3;for(let i=0;i<4;i++)for(let j=0;j<4;j++){const cx=i*128+64,cy=j*128+64;x.beginPath();x.arc(cx,cy,44,0,TAU);x.stroke();x.beginPath();x.arc(cx,cy,26,0,TAU);x.stroke();for(let k=0;k<8;k++){x.beginPath();x.moveTo(cx+Math.cos(k*PI/4)*26,cy+Math.sin(k*PI/4)*26);x.lineTo(cx+Math.cos(k*PI/4)*44,cy+Math.sin(k*PI/4)*44);x.stroke();}}speckle(x,w,h,30000,.1,1.5);},
    marbleBlack:(x,w,h)=>{for(let i=0;i<2;i++)for(let j=0;j<2;j++){x.fillStyle=(i+j)%2?'#0d0d11':'#15151b';x.fillRect(i*256,j*256,256,256);}x.globalAlpha=.4;for(let k=0;k<26;k++){x.strokeStyle=R()<.5?'#6e6a7d':'#bfb8d0';x.lineWidth=.6+R()*1.4;x.beginPath();let px=R()*w,py=R()*h;x.moveTo(px,py);for(let s2=0;s2<6;s2++){px+=(R()-.5)*120;py+=(R()-.5)*120;x.lineTo(px,py);}x.stroke();}x.globalAlpha=1;x.strokeStyle='rgba(214,180,100,.7)';x.lineWidth=2;for(let i=0;i<=2;i++){x.beginPath();x.moveTo(i*256,0);x.lineTo(i*256,h);x.stroke();x.beginPath();x.moveTo(0,i*256);x.lineTo(w,i*256);x.stroke();}},
  };
  return ctex(512,512,T2[kind]||T2.wood);
}
function hawaiiTex(col){return ctex(256,256,(x,w,h)=>{x.fillStyle=col;x.fillRect(0,0,w,h);for(let i=0;i<14;i++){const cx=R()*w,cy=R()*h;x.fillStyle='#2e7d32';x.beginPath();x.ellipse(cx+10,cy+8,20,7,R()*3,0,TAU);x.fill();x.fillStyle=['#ffeb3b','#ff7043','#fafafa','#f06292'][i%4];for(let k=0;k<5;k++){x.beginPath();x.ellipse(cx+Math.cos(k*1.26)*9,cy+Math.sin(k*1.26)*9,8,5,k*1.26,0,TAU);x.fill();}x.fillStyle='#ffca28';x.beginPath();x.arc(cx,cy,4,0,TAU);x.fill();}},{rep:[2,2]});}
function smokeTex(){return ctex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(225,225,225,.5)');g.addColorStop(1,'rgba(225,225,225,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});}
function envTex(V){const t=ctex(256,128,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,V.env);g.addColorStop(.45,shade(V.env,.35));g.addColorStop(1,'#060505');x.fillStyle=g;x.fillRect(0,0,w,h);blot(x,w,h*.45,7,'rgba(255,236,205,.9)',3,12);});t.mapping=T.EquirectangularReflectionMapping;return t;}
let GLOWT=null;
function glowTex(){if(!GLOWT)GLOWT=ctex(128,128,(x,w,h)=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.22,'rgba(255,255,255,.42)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);},{keep:true});return GLOWT;}
// Işık kaynaklarının etrafındaki hale (ucuz "bloom")
function glow(color,size,pos,op=.55){const m=new T.SpriteMaterial({map:glowTex(),color,transparent:true,opacity:op,blending:T.AdditiveBlending,depthWrite:false});W.disp.push(m);const s=new T.Sprite(m);s.scale.set(size,size,size);s.position.copy(pos);W.scene.add(s);return s;}

/* ---------- karakter ---------- */
const POLE=[V3(1,-1.3,-.7).normalize(),V3(-1,-1.3,-.7).normalize()];
function place(m,a,b){_t2.subVectors(b,a);const L=_t2.length()||1e-4;m.position.copy(a).addScaledVector(_t2,.5);m.scale.set(1,L,1);m.quaternion.setFromUnitVectors(_up,_t2.divideScalar(L));}
function ik(S,H,L1,L2,pole,E){
  const d=_a.subVectors(H,S);let D=d.length();const mx=(L1+L2)*.995,mn=Math.abs(L1-L2)+.01;
  if(D>mx){d.multiplyScalar(mx/D);D=mx;H.copy(S).add(d);}else if(D<mn){d.multiplyScalar(mn/Math.max(D,1e-4));D=mn;H.copy(S).add(d);}
  const a=(L1*L1-L2*L2+D*D)/(2*D),h=Math.sqrt(Math.max(0,L1*L1-a*a));
  d.divideScalar(D);_b.copy(pole).addScaledVector(d,-pole.dot(d)).normalize();
  E.copy(S).addScaledVector(d,a).addScaledVector(_b,h);
}
function makeHand(sk,side){
  const g=new T.Group();
  const palm=mesh(box(.07,.024,.08),sk);palm.position.set(0,0,.04);g.add(palm);
  // dört parmak, her biri iki boğum: işaret ve yüzük parmağı biraz kısa, orta uzun, serçe en kısa
  const fl=[.05,.056,.052,.042];
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.0165*side,L=fl[i];
    const a=mesh(box(.0145,.0145,L),sk);a.position.set(x,-.006,.08+L/2);a.rotation.x=.3;g.add(a);
    const b=mesh(box(.0135,.0135,L*.7),sk);b.position.set(x,-.015-L*.1,.08+L*.95);b.rotation.x=.7;g.add(b);
  }
  const th=mesh(box(.021,.02,.05),sk);th.position.set(side*.04,-.004,.03);th.rotation.y=-side*.55;g.add(th);
  return g;
}
function dressTop(sp,d,o){
  const {kind,c1,c2,topM,innerM,skin,fz}=o;
  const put=(m,x,y,z,rx=0,ry=0,rz=0)=>{m.position.set(x,y,z);m.rotation.set(rx,ry,rz);sp.add(m);return m;};
  const vee=(m,w,h,y,dz=0)=>{const g=geo(`tri${w}_${h}`,()=>{const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,-h);s.closePath();return new T.ShapeGeometry(s);});return put(new T.Mesh(g,m),0,y,fz+.004+dz,-.14);};
  const jacket=['jacket','suit','blazer','tux','leather'].includes(kind);
  if(jacket){
    vee(innerM,.12,.21,.5);
    if(d.vest)vee(mat(d.vest,{roughness:.9}),.1,.15,.43,.001);
    const lap=mat(shade(c1,kind==='tux'?1.9:.75),{roughness:kind==='tux'?.3:.85});
    for(const s of[-1,1])put(mesh(box(.034,.23,.012),lap,false),s*.044,.37,fz+.006,-.12,0,s*.3);
    if(kind!=='leather')for(let i=0;i<2;i++)put(mesh(sph(.006,6,4),mat('#111')),0,.2-i*.07,fz+.004);
  }
  if(kind==='cardigan'){vee(innerM,.11,.18,.5);for(let i=0;i<4;i++)put(mesh(sph(.006,6,4),mat('#d8c9a8'),false),0,.36-i*.07,fz+.004);}
  if(kind==='hoodie'){const h=mesh(torus(.085,.034,TAU,8,18),topM);put(h,0,.5,-.05,1.25);put(mesh(box(.2,.08,.012),mat(shade(c1,.85))),0,.12,fz+.003);for(const s of[-1,1])put(mesh(cyl(.003,.003,.12,4),mat('#ddd'),false),s*.03,.4,fz+.008);}
  if(kind==='vest'){const vm=mat(c2,{roughness:.6});for(const s of[-1,1])put(mesh(box(.13,.3,.02),vm),s*.068,.27,fz-.002,0,0,s*.06);put(mesh(box(.26,.2,.02),vm),0,.2,-fz+.004);}
  if(kind==='dress'){vee(skin,.17,.12,.53,.001);for(const s of[-1,1])put(mesh(box(.012,.07,.01),topM,false),s*.08,.49,fz-.012);}
  if(['shirt','linen','western','hawaii','vest'].includes(kind)){for(const s of[-1,1])put(mesh(box(.05,.035,.01),topM,false),s*.03,.51,fz+.004,-.3,0,s*.6);if(kind==='linen'||kind==='shirt'&&!d.tie)vee(skin,.06,.08,.52,.002);}
  if(kind==='western'){const pm=mat(shade(c1,.8));for(const s of[-1,1])put(mesh(box(.06,.05,.008),pm,false),s*.07,.36,fz+.004);}
  if(kind==='tshirt'){put(mesh(torus(.045,.008,TAU,6,16),mat(shade(c1,.85))),0,.52,.01,PI/2);}
  if(kind==='turtleneck')put(mesh(torus(.052,.03,TAU,8,18),topM),0,.52,0,PI/2);
  if(kind==='sweater'){put(mesh(torus(.05,.02,TAU,8,18),topM),0,.52,0,PI/2);put(mesh(torus(.15,.014,TAU,6,24),mat(shade(c1,.85))),0,.07,0,PI/2);}
  if(kind==='polo'){for(const s of[-1,1])put(mesh(box(.05,.03,.01),topM,false),s*.032,.515,fz+.004,-.3,0,s*.5);for(let i=0;i<2;i++)put(mesh(sph(.005,6,4),mat('#e8e2d2'),false),0,.46-i*.035,fz+.006);}
  const tie=d.tie;
  if(tie){
    const tm=mat(tie[1],{roughness:.5});
    if(tie[0]==='tie'){put(mesh(box(.028,.18,.008),tm,false),0,.37,fz+.012,-.14);put(mesh(box(.03,.024,.014),tm,false),0,.47,fz+.01,-.14);}
    else if(tie[0]==='bolo'){for(const s of[-1,1])put(mesh(box(.003,.16,.003),mat('#222'),false),s*.008,.4,fz+.01,-.14);put(mesh(cyl(.014,.014,.005,10),GOLD(),false),0,.44,fz+.015,PI/2-.14);}
    else{const loose=tie[0]==='bowLoose';const g=new T.Group();for(const s of[-1,1]){const c=mesh(geo('bow',()=>new T.ConeGeometry(.016,.03,4)),tm,false);c.rotation.z=s*PI/2;c.position.x=s*.016;g.add(c);}g.add(mesh(sph(.007,6,4),tm,false));put(g,0,loose?.455:.48,fz+.014,-.1,0,loose?.5:0);}
  }
  const acc=d.acc||[];
  if(acc.includes('chain')){const c=mesh(torus(.068,.005,TAU,6,28),GOLD(),false);put(c,0,.49,.03,1.3);}
  if(acc.includes('pearls')){const c=mesh(torus(.064,.009,TAU,8,30),mat('#f3efe6',{roughness:.2}),false);put(c,0,.5,.025,1.32);}
  if(acc.includes('pocket'))put(mesh(box(.035,.02,.008),mat('#f2efe8'),false),.075,.39,fz+.006);
  if(acc.includes('pocketRed'))put(mesh(box(.035,.02,.008),mat('#b8323a'),false),.075,.39,fz+.006);
  if(acc.includes('pendant'))put(mesh(sph(.011,8,6),mat('#3ab0c9',{emissive:'#1a6a8a',emissiveIntensity:.6,roughness:.15,metalness:.3}),false),0,.42,fz+.018);
  if(acc.includes('tieclip')&&tie)put(mesh(box(.034,.004,.004),GOLD(),false),0,.405,fz+.017,-.14);
  if(acc.includes('suspenders'))for(const s of[-1,1])put(mesh(box(.012,.46,.006),mat('#2a1c14',{roughness:.7}),false),s*.075,.27,fz+.009,-.04);
  if(acc.includes('brooch'))put(mesh(sph(.011,8,6),GOLD(),false),-.07,.42,fz+.008);
  if(acc.includes('lapelFlower'))put(mesh(sph(.011,8,6),mat('#c0232c',{roughness:.6}),false),-.07,.42,fz+.01);
  if(acc.includes('scarf')){const sm=mat('#8a3b2a',{roughness:.95});put(mesh(torus(.06,.025,TAU,8,18),sm),0,.52,0,PI/2);put(mesh(box(.05,.22,.02),sm),-.04,.38,fz+.012,-.1,0,.08);}
}
function dressHead(face,head,d,o){
  const {hairM}=o;const fem=d.sex==='f';
  const put=(m,x,y,z,rx=0,ry=0,rz=0,par=face)=>{m.position.set(x,y,z);m.rotation.set(rx,ry,rz);par.add(m);return m;};
  const sk=(g)=>{const m=mesh(g,hairM);m.scale.set(.9,1.08,.98);return m;};
  const hs=(d.hair&&d.hair[0])||'short';
  const cap=(tl=.33)=>put(sk(shell(.107,0,TAU,0,tl*PI)),0,.003,-.004);
  const back=(tl=.7)=>put(sk(shell(.105,PI,PI,0,tl*PI)),0,0,-.003);
  if(hs==='short'||hs==='bun'||hs==='updo'||hs==='curly'||hs==='messy'){cap();back();}
  if(hs==='slick'){cap(.3);back(.68);}
  if(hs==='pixie'){cap(.36);back(.6);}
  if(hs==='balding')put(sk(shell(.106,PI*.85,PI*1.3,PI*.38,PI*.3)),0,0,0);
  if(hs==='long'||hs==='bob'){cap(.32);put(sk(shell(.113,PI/2+.95,TAU-1.9,0,(hs==='bob'?.66:.72)*PI)),0,0,0);if(hs==='long'){put(mesh(box(.2,.27,.05),hairM),0,-.15,-.072);if(fem)for(const s of[-1,1])put(mesh(box(.03,.2,.06),hairM),s*.09,-.09,-.005);}}
  if(hs==='bun')put(mesh(sph(.046,12,10),hairM),0,.05,-.11);
  if(hs==='updo')put(mesh(sph(.06,14,10),hairM),0,.1,-.06);
  if(hs==='curly')for(let i=0;i<20;i++){const a=R()*TAU,b=R()*.48*PI;put(mesh(sph(.03,8,6),hairM),Math.sin(b)*Math.cos(a)*.1,Math.cos(b)*.11,Math.sin(b)*Math.sin(a)*.1-.01);}
  if(hs==='messy')for(let i=0;i<7;i++)put(mesh(geo('spk',()=>new T.ConeGeometry(.018,.05,5)),hairM),(R()-.5)*.1,.1,(R()-.5)*.09,(R()-.5)*.8,0,(R()-.5)*.8);
  const hcol=(d.hair&&d.hair[1])||'#2a1d14';
  if(hs==='sidepart'){cap(.32);back(.68);put(mesh(box(.118,.02,.05),hairM),.016,.083,.074,.62,0,-.1);put(mesh(box(.004,.016,.1),mat('#0b0908'),false),-.032,.103,.04,.2);}
  if(hs==='buzz'){const bz=mesh(shell(.1045,0,TAU,0,.46*PI),mat(hcol,{transparent:true,opacity:.6,roughness:1}),false);bz.scale.set(.9,1.08,.98);put(bz,0,.003,-.004);}
  if(hs==='ponytail'){cap();back();put(mesh(cyl(.026,.012,.2,8),hairM),0,-.03,-.135,.35);put(mesh(torus(.026,.005,TAU,6,10),mat('#8a2a3a'),false),0,.045,-.108,PI/2-.5);}
  if(hs==='bangs'){cap(.32);put(sk(shell(.113,PI/2+.95,TAU-1.9,0,.66*PI)),0,0,0);put(mesh(box(.17,.04,.03),hairM),0,.088,.082,.3);if(fem)for(const s of[-1,1])put(mesh(box(.03,.2,.06),hairM),s*.09,-.09,-.005);}
  if(hs==='braid'){cap();back();for(let i=0;i<5;i++)put(mesh(sph(.03-i*.002,8,6),hairM),0,-.02-i*.05,-.115-i*.006);put(mesh(torus(.018,.004,TAU,6,10),mat('#c9a24a'),false),0,-.24,-.145,PI/2);}
  if(hs==='afro'){put(mesh(shell(.15,PI,PI,0,.62*PI),hairM),0,.012,-.01);put(sk(shell(.132,0,TAU,0,.34*PI)),0,.018,-.004);}
  // saç telleri: açık tonlu ince çizgiler saça parlaklık ve doku verir
  if(hs!=='bald'&&hs!=='balding'&&hs!=='buzz'&&Q()!=='low'){
    const hHi=mat(shade(hcol,1.45),{roughness:.5}),rr=rngOf(seedOf(d)^0x9e37);
    for(let i=0;i<11;i++){
      const a=rr()*TAU,bmax=Math.sin(a)>0?.3:.42,b=(.1+rr()*(bmax-.1))*PI,cb=Math.cos(b),sb=Math.sin(b),rad=.1085;
      const m=mesh(box(.0045,.003,.06),hHi,false);
      m.position.set(sb*Math.cos(a)*rad*.9,cb*rad*1.08+.003,sb*Math.sin(a)*rad*.98-.004);
      m.quaternion.setFromUnitVectors(_Z,V3(cb*Math.cos(a),-sb,cb*Math.sin(a)).normalize());face.add(m);
    }
  }
  const fh=d.face&&d.face[0],fm=d.face?mat(d.face[1],{roughness:.9}):hairM;
  if(fh==='mustache'||fh==='beard'||fh==='goatee')put(mesh(box(.056,.013,.018),fm),0,-.034,.093,.15);
  if(fh==='beard'||fh==='stubble'){const m=mesh(shell(.104,0,PI,PI*.55,PI*.43),fh==='stubble'?mat(d.face[1],{transparent:true,opacity:.42,roughness:1}):fm,false);m.scale.set(.9,1.08,.98);put(m,0,-.004,.002);}
  if(fh==='goatee')put(mesh(sph(.022,8,6),fm),0,-.088,.08);
  const acc=d.acc||[];const dark=mat('#0c0c0e',{roughness:.12,metalness:.5}),frame=mat('#1a1a1a',{roughness:.4});
  const lens=(par,y=.018,z=.1,m)=>{for(const s of[-1,1]){const l=mesh(cyl(.021,.021,.004,16),m,false);l.rotation.x=PI/2;l.scale.set(1.15,1,.85);l.position.set(s*.035,y,z);par.add(l);}const br=mesh(box(.02,.004,.004),frame,false);br.position.set(0,y+.004,z+.002);par.add(br);for(const s of[-1,1]){const t=mesh(box(.004,.004,.1),frame,false);t.position.set(s*.088,y+.002,z-.05);par.add(t);}};
  if(acc.includes('sunglasses'))lens(face,.018,.1,dark);
  if(acc.includes('glasses')){for(const s of[-1,1])put(mesh(torus(.019,.0022,TAU,6,16),acc.includes('monocle')?frame:mat('#7a6a4a',{metalness:.6,roughness:.3}),false),s*.035,.018,.1);put(mesh(box(.016,.003,.003),frame,false),0,.022,.101);for(const s of[-1,1])put(mesh(box(.003,.003,.1),frame,false),s*.088,.02,.05);}
  if(acc.includes('monocle'))put(mesh(torus(.02,.0025,TAU,6,16),GOLD(),false),-.035,.018,.103);
  if(acc.includes('sunglassesHead')){const g=new T.Group();lens(g,0,0,dark);put(g,0,.105,.03,-1.15);}
  if(acc.includes('earrings'))for(const s of[-1,1])put(mesh(sph(.007,6,5),acc.includes('pearls')?mat('#f3efe6',{roughness:.2}):GOLD(),false),s*.092,-.04,0);
  const hat=d.hat;
  if(hat){const hm=mat(hat[1]||'#333',{roughness:.85});
    if(hat[0]==='cap'){const c=mesh(shell(.112,0,TAU,0,.5*PI),hm);c.scale.set(.93,.85,1.02);put(c,0,.03,-.003);put(mesh(box(.13,.007,.085),hm),0,.046,.118,.12);}
    if(hat[0]==='flatcap'){const c=mesh(sph(.113,18,12),hm);c.scale.set(1,.42,1.12);put(c,0,.075,.008);put(mesh(box(.14,.006,.05),hm),0,.062,.112,.18);}
    if(hat[0]==='cowboy'){const c=mesh(cyl(.085,.098,.12,16),hm);c.scale.z=1.1;put(c,0,.13,0);const b=mesh(cyl(.2,.2,.008,28),hm);b.scale.z=.85;put(b,0,.075,0);put(mesh(cyl(.1,.1,.02,16),mat('#3a2a1a')),0,.085,0);}
    if(hat[0]==='visor'){put(mesh(torus(.098,.008,TAU,6,24),hm),0,.068,0,PI/2);put(mesh(box(.15,.005,.08),mat(hat[1],{transparent:true,opacity:.8})),0,.072,.122,-.12);}
    if(hat[0]==='fedora'){const c=mesh(cyl(.078,.092,.1,16),hm);c.scale.z=1.08;put(c,0,.125,0);const b=mesh(cyl(.16,.16,.006,28),hm);b.scale.z=.9;put(b,0,.075,0);put(mesh(cyl(.094,.094,.022,16),mat('#1a1410')),0,.09,0);}
    if(hat[0]==='beanie'){const c=mesh(shell(.114,0,TAU,0,.55*PI),hm);c.scale.set(.95,1,1.04);put(c,0,.028,-.004);put(mesh(torus(.105,.014,TAU,6,24),hm),0,.045,0,PI/2);put(mesh(sph(.022,8,6),hm),0,.138,-.004);}
    if(hat[0]==='beret'){const c=mesh(sph(.12,16,10),hm);c.scale.set(1,.34,1.05);put(c,.02,.09,-.005,0,0,.12);put(mesh(cyl(.006,.006,.02,5),hm,false),.02,.125,-.005);}
    if(hat[0]==='hood'){const h=mesh(shell(.132,PI/2+1.05,TAU-2.1,0,.64*PI),mat(d.top[1],{roughness:.9,side:T.DoubleSide}));h.scale.set(1,1.06,1.02);put(h,0,.004,-.012);}
  }
  if(acc.includes('headphones')){put(mesh(torus(.12,.008,PI,6,20),mat('#202024',{roughness:.4})),0,.008,-.005);for(const s of[-1,1]){const c=mesh(cyl(.036,.036,.026,14),mat('#2a2a2e',{roughness:.4}));c.rotation.z=PI/2;c.position.set(s*.1,-.002,-.005);face.add(c);}}
}
function makeProp(kind){
  const g=new T.Group();const gl=GLASS();
  const lathe=(pts,m,s=16)=>mesh(new T.LatheGeometry(pts.map(p=>new T.Vector2(p[0],p[1])),s),m,false);
  const liquid=(c,o=.85)=>mat(c,{transparent:true,opacity:o,roughness:.2});
  switch(kind){
    case 'tea':case 'tea2':g.add(lathe([[0,0],[.021,0],[.023,.005],[.015,.03],[.016,.05],[.023,.075],[.025,.085]],gl));g.add(lathe([[0,.006],[.02,.006],[.014,.03],[.015,.05],[.021,.07],[0,.07]],liquid('#9a3412',.88)));{const s=mesh(cyl(.042,.036,.006,18),mat('#f4f1ea',{roughness:.3}),false);s.position.y=-.002;g.add(s);}break;
    case 'raki':g.add(mesh(cyl(.022,.019,.13,14),gl,false));g.children[0].position.y=.065;{const l=mesh(cyl(.02,.017,.08,14),liquid('#efece2',.92),false);l.position.y=.042;g.add(l);}break;
    case 'whiskey':case 'cognac':g.add(mesh(cyl(.036,.032,.08,16),gl,false));g.children[0].position.y=.04;{const l=mesh(cyl(.033,.03,.03,16),liquid('#a3621f'),false);l.position.y=.017;g.add(l);const ic=mesh(box(.018,.018,.018),mat('#ffffff',{transparent:true,opacity:.5,roughness:.1}),false);ic.position.set(.008,.032,0);ic.rotation.set(.4,.6,.2);g.add(ic);}break;
    case 'wine':case 'champagne':case 'cocktail':{const flute=kind==='champagne';const s=mesh(cyl(.003,.003,.08,6),gl,false);s.position.y=.04;g.add(s);const b=mesh(cyl(.03,.03,.003,14),gl,false);b.position.y=.001;g.add(b);
      const bowl=kind==='cocktail'?[[0,.08],[.05,.13]]:flute?[[0,.08],[.016,.09],[.02,.17]]:[[0,.08],[.03,.1],[.035,.13],[.03,.16]];g.add(lathe(bowl,gl));
      const lq=kind==='cocktail'?[[0,.08],[.04,.12],[0,.12]]:flute?[[0,.082],[.015,.09],[.018,.15],[0,.15]]:[[0,.082],[.028,.1],[.031,.12],[0,.12]];g.add(lathe(lq,liquid(kind==='wine'?'#5a0d18':kind==='cocktail'?'#c2185b':'#e8d48a',.8)));break;}
    case 'vodka':g.add(mesh(cyl(.02,.017,.05,12),gl,false));g.children[0].position.y=.025;break;
    case 'water':{const b=mesh(cyl(.032,.032,.2,14),mat('#a8d3e6',{transparent:true,opacity:.4,roughness:.1}),false);b.position.y=.1;g.add(b);const c=mesh(cyl(.014,.014,.03,10),mat('#2a6fb0'),false);c.position.y=.215;g.add(c);break;}
    case 'cola':case 'energy':{const c=mesh(cyl(.033,.033,.12,16),mat(kind==='cola'?'#b3141c':'#1e4fa3',{metalness:.4,roughness:.35}));c.position.y=.06;g.add(c);const t=mesh(cyl(.03,.033,.008,16),mat('#c9c9c9',{metalness:.8,roughness:.3}),false);t.position.y=.124;g.add(t);break;}
    case 'coffee':{const c=mesh(cyl(.04,.032,.07,16),mat('#f4f1ea',{roughness:.3}));c.position.y=.04;g.add(c);const h=mesh(torus(.02,.006,PI*1.2),mat('#f4f1ea',{roughness:.3}),false);h.position.set(.045,.045,0);h.rotation.z=-PI*.6;g.add(h);const top=mesh(cyl(.037,.037,.003,16),mat('#2b1a10',{roughness:.2}),false);top.position.y=.07;g.add(top);const s=mesh(cyl(.07,.06,.006,20),mat('#f4f1ea',{roughness:.3}),false);s.position.y=.003;g.add(s);break;}
    case 'ashtray':{const a=mesh(cyl(.06,.055,.025,18),mat('#3a3a3a',{roughness:.3,metalness:.4}));a.position.y=.012;g.add(a);for(let i=0;i<3;i++){const b=mesh(cyl(.004,.004,.025,6),mat('#e8e2d6'),false);b.rotation.set(PI/2,0,R()*3);b.position.set((R()-.5)*.05,.027,(R()-.5)*.05);g.add(b);}break;}
    case 'phone':{const p=mesh(box(.072,.008,.15),mat('#0e0e10',{roughness:.2,metalness:.3}));p.position.y=.004;g.add(p);const s=mesh(box(.064,.001,.138),mat('#0b1730',{emissive:'#10264a',emissiveIntensity:.5,roughness:.1}),false);s.position.y=.0085;g.add(s);break;}
  }
  return g;
}

// Duruşlar (kök uzayı, mutlak y): her karakter tarzına göre birkaçı arasında zamanla geçiş yapar.
const POSES={rail:[[.14,.82,.4],[-.14,.82,.4]],clasped:[[.035,.826,.445],[-.03,.832,.45]],forearms:[[.19,.805,.53],[-.19,.805,.53]],lap:[[.09,.6,.27],[-.09,.6,.27]],chips:[[.14,.82,.4],null],chinrest:[null,null],table:[[.12,.83,.43],[-.13,.81,.43]]};
const POSE_LEAN={rail:.04,clasped:.07,forearms:.2,lap:-.07,chips:.07,chinrest:.25,table:.1};
// Oyun tarzı → beden: sıkı oyuncu dik ve kıpırtısız, saldırgan öne eğik ve hareketli, gevşek rahat ve yayvan.
const STYLE_FX={
  kaya:{lean:-.02,fid:.5,idle:1.45,poses:['clasped','rail','clasped'],smile:.04},
  manyak:{lean:.08,fid:1.3,idle:.75,poses:['forearms','rail','chips'],smile:.22},
  gevsek:{lean:-.04,fid:1.1,idle:1,poses:['rail','lap','forearms'],smile:.3},
  kopekbaligi:{lean:.02,fid:.55,idle:1.3,poses:['clasped','chips','chinrest'],smile:.02},
  tilki:{lean:0,fid:.8,idle:1.05,poses:['chinrest','rail','clasped'],smile:.16},
};

/* ---------- karakter çeşitliliği: yüz yapısı, ten detayı, kumaş deseni, mekâna göre görünüm ---------- */
// Her karakter kendi özelliklerinden türeyen sabit bir tohum kullanır: aynı kişi her seferinde aynı yüzle gelir.
// Kumaş dokusu: dokuma, örgü ve deri için hafif kabartma haritaları (bir kez üretilir, paylaşılır)
const FAB={};
function fabric(kind){
  const k=['leather'].includes(kind)?'leather':['cardigan','hoodie','sweater','turtleneck'].includes(kind)?'knit':'weave';
  if(FAB[k])return FAB[k];
  FAB[k]=ctex(64,64,(x,w,h)=>{
    x.fillStyle='#808080';x.fillRect(0,0,w,h);
    if(k==='weave'){for(let i=0;i<w;i+=2){x.fillStyle=i%4?'#9a9a9a':'#6a6a6a';x.fillRect(i,0,1,h);}for(let j=0;j<h;j+=2){x.fillStyle=j%4?'rgba(255,255,255,.16)':'rgba(0,0,0,.16)';x.fillRect(0,j,w,1);}}
    else if(k==='knit'){for(let j=0;j<h;j+=4)for(let i=0;i<w;i+=4){x.fillStyle=((i+j)/4)%2?'#b0b0b0':'#5a5a5a';x.fillRect(i,j,3,3);}}
    else{speckle(x,w,h,900,.5,2);blot(x,w,h,40,'rgba(255,255,255,.12)',3,8);blot(x,w,h,40,'rgba(0,0,0,.18)',3,8);}
  },{srgb:false,rep:k==='knit'?[10,6]:k==='leather'?[5,3]:[14,8],keep:true});
  return FAB[k];
}
function seedOf(d){const s=[d.sex,d.age,d.skin,(d.hair||[]).join(),(d.top||[]).join(),(d.face||[]).join()].join('|');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rngOf(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// -1: yıpranmış mekân (kaçak, kıraathane), 0: sıradan, 1: gösterişli (kumarhaneler)
function venueTier(){const V=W&&W.V;if(!V)return 0;if(V.worn)return -1;if(V.casino||(V.room&&V.room[2]>=3.3))return 1;return 0;}
function faceParams(d){
  const r=rngOf(seedOf(d)),fem=d.sex==='f',age=d.age||35,u=(a,b)=>a+(b-a)*r();
  const fp={r,nw:u(.85,1.3),nh:u(.88,1.2),nd:u(.85,1.25),jaw:u(.9,1.12)*(fem?.95:1),ear:u(.8,1.3),cheek:u(.7,1.3),brow:u(.8,1.55),mw:u(.88,1.2)*(fem?1.05:1),lines:age>=45?Math.min(1,(age-40)/30):0,freck:r()<.16,lash:fem||r()<.08};
  const lt=new T.Color(d.skin||'#d6a482').getHSL({h:0,s:0,l:0}).l;
  const pool=lt>.74?['#3a2a1c','#4a3020','#5a4a2a','#3d5a46','#4a6a8a','#6a7f8f','#2f4a3a']:['#2a1c12','#3a2a1c','#4a3020','#33241a'];
  fp.eye=d.eyes||pool[Math.floor(r()*pool.length)];
  return fp;
}
// Elmacık, göz çukuru gölgesi, allık, kirpik, yaş çizgileri, çil: yüze derinlik ve yaş verir.
function faceDetail(face,d,skin,fp,fem){
  const sk=d.skin||'#d6a482';
  const zAt=(x,y)=>Math.max(.098*Math.sqrt(Math.max(.05,1-(x/.09)**2-(y/.108)**2)),.025+.075*Math.sqrt(Math.max(.05,1-(x/.075)**2-((y+.055)/.056)**2)))+.0012;
  const add=(m,x,y,dz=0,sx=1,sy=1,sz=1,rz=0)=>{m.position.set(x,y,zAt(x,y)+dz);m.scale.set(sx,sy,sz);m.rotation.z=rz;face.add(m);return m;};
  const shadow=(c,o)=>mat(c,{transparent:true,opacity:o,roughness:1,depthWrite:false});
  const lash=mat('#15110f',{roughness:.6});
  for(const s of[-1,1]){
    add(mesh(sph(.022,10,8),skin,false),s*.054,-.016,-.012,fp.cheek*.8,.75,.6);
    const ring=mesh(torus(.021,.0075,TAU,6,16),shadow(shade(sk,.5),.3),false);ring.position.set(s*.034,.018,.088);face.add(ring);
    if(fem||fp.r()<.1)add(mesh(sph(.026,10,8),shadow('#d9606a',.17),false),s*.064,-.03,-.008,1,.7,.35);
    if(fp.lash)add(mesh(box(.034,.0035,.006),lash,false),s*.034,.0335,0,1,1,1,-s*.12);
  }
  add(mesh(sph(.02,8,6),shadow(shade(sk,.5),.22),false),0,-.026,.003,1.4,.5,.7);
  if(fp.lines>0){
    const lm=shadow(shade(sk,.62),.2+.3*fp.lines);
    for(const s of[-1,1]){add(mesh(box(.036,.0022,.004),lm,false),s*.034,-.0075,.001,1,1,1,s*.08);add(mesh(box(.003,.04,.004),lm,false),s*.036,-.04,.001,1,1,1,s*.35);}
    for(let i=0;i<2;i++)add(mesh(box(.08,.0022,.004),lm,false),0,.07+i*.014,.001);
  }
  if(fp.freck&&Q()!=='low'){const fm=mat(shade(sk,.8),{roughness:1});for(let i=0;i<12;i++)add(mesh(sph(.0035,5,4),fm,false),(R()<.5?-1:1)*(.012+R()*.05),-.012+R()*.03,.001);}
}
// Kumaş deseni: ince çizgi ya da kareli
function patTex(kind,c){return ctex(64,64,(x,w,h)=>{x.fillStyle=c;x.fillRect(0,0,w,h);if(kind==='pin'){x.fillStyle='rgba(255,255,255,.22)';for(let i=0;i<w;i+=8)x.fillRect(i,0,1.4,h);}else{x.fillStyle='rgba(0,0,0,.18)';for(let i=0;i<w;i+=16){x.fillRect(i,0,6,h);x.fillRect(0,i,w,6);}x.fillStyle='rgba(255,255,255,.1)';x.fillRect(0,0,w,2);}},{rep:[3,3]});}

function makePerson(d,opt){
  const tier=venueTier();
  // Yıpranmış mekânlarda erkeklerin bir kısmı tıraşsızdır
  if(tier<0&&d.sex!=='f'&&!d.face&&rngOf(seedOf(d)^7)()<.3)d=Object.assign({},d,{face:['stubble',(d.hair&&d.hair[1])||'#2a1d14']});
  const fp=faceParams(d);
  const root=new T.Group();root.userData.pi=opt.idx;
  const P={d,root,idx:opt.idx,standing:!!opt.standing,npc:opt.npc||null,isCroupier:!!opt.croupier,expr:d.expr||1};
  P.sfx=Object.assign({lean:0,fid:1,idle:1,poses:['rail'],smile:.12},STYLE_FX[opt.style]||{});
  P.fid=P.sfx.fid*(.55+.45*Math.min(1.6,P.expr));
  const bw=d.build||1,fem=d.sex==='f';P.bw=bw;
  // ten: gölge tarafı hafif sıcak kalsın diye az miktarda kendinden aydınlık
  const skin=mat(d.skin||'#d6a482',{roughness:.58,emissive:shade(d.skin||'#d6a482',.1)});
  const hc=(d.hair&&d.hair[1])||'#2a1d14';
  const hairM=mat(hc,{roughness:(d.hair&&d.hair[0])==='slick'?.35:.62});
  const [kind,c1,c2]=d.top||['shirt','#dddddd'];
  const fr=tier>0?.64:tier<0?.95:.86;
  const topM=kind==='hawaii'?tmat(hawaiiTex(c1),{roughness:.8}):(d.top&&d.top[3])?tmat(patTex(d.top[3],c1),{roughness:fr}):mat(tier<0?shade(c1,.9):c1,kind==='leather'?{roughness:.3,metalness:.15}:kind==='tux'?{roughness:tier>0?.34:.5}:{roughness:fr});
  if(kind!=='hawaii'&&!topM.bumpMap){topM.bumpMap=fabric(kind);topM.bumpScale=kind==='leather'?1.4:.7;topM.needsUpdate=true;}
  const innerM=mat(c2||'#ece8df',{roughness:.7});
  const pantsM=mat(d.pants||(kind==='dress'?shade(c1,.9):'#25252b'),{roughness:.85});
  let upM=topM,foM=topM;
  if(kind==='tshirt'||kind==='hawaii')foM=skin;
  if(kind==='dress')upM=foM=skin;
  if(d.sleeves==='rolled')foM=skin;
  const hipY=P.standing?.95:.5;
  const pelvis=mesh(sph(.15,16,10),pantsM);pelvis.scale.set(bw,.55,.85*bw);pelvis.position.set(0,hipY,-.03);root.add(pelvis);P.pelvis=pelvis;
  const spine=new T.Group();spine.position.set(0,hipY,-.03);root.add(spine);P.spine=spine;
  const tr=.15*bw*(fem?.86:1);
  const torso=mesh(geo('cap'+tr,()=>new T.CapsuleGeometry(tr,.24,6,14)),topM);torso.position.y=.27;torso.scale.z=.72;spine.add(torso);P.torso=torso;
  const fz=tr*.72;
  // geniş üst göğüs ve boyundan omuza inen trapez kasları: gövde silindir gibi durmasın
  {const ch=mesh(sph(tr*1.02,16,10),topM);ch.scale.set(fem?1.04:1.14,.58,.74);ch.position.set(0,.37,.0);spine.add(ch);
   for(const s of[-1,1]){const tz=mesh(sph(.06*bw,10,8),kind==='dress'?skin:topM);tz.scale.set(1.5,.5,.9);tz.position.set(s*.07*bw,.5,-.012);tz.rotation.z=-s*.35;spine.add(tz);}}
  if(d.belly){const b=mesh(sph(.15*bw,16,12),topM);b.scale.set(1,.85,.95);b.position.set(0,.13,.05);spine.add(b);}
  const sw=.18*bw*(fem?.84:1);
  P.sh=[new T.Object3D(),new T.Object3D()];P.sh[0].position.set(sw,.44,0);P.sh[1].position.set(-sw,.44,0);
  for(const s of P.sh){spine.add(s);s.add(mesh(sph(.058*bw,12,10),kind==='dress'?skin:upM));}
  dressTop(spine,d,{kind,c1,c2,topM,innerM,skin,fz});
  const neck=mesh(cyl(.04,.045,.12,12),skin);neck.position.set(0,.53,-.005);spine.add(neck);
  P.adam=mesh(sph(.012,8,6),skin,false);P.adam.scale.setScalar(fem?.6:1);P.adam.position.set(0,.505,.04);spine.add(P.adam);   // yutkunma için gırtlak
  const head=new T.Group();head.position.set(0,.57,0);spine.add(head);P.head=head;
  const face=new T.Group();face.position.set(0,.1,.005);head.add(face);P.face=face;
  const skull=mesh(sph(.1,24,18),skin);skull.scale.set(fem?.86:.9,1.08,.98);face.add(skull);
  const jaw=mesh(sph(.075,18,12),skin);jaw.scale.set((fem?.88:1)*fp.jaw,.75,1);jaw.position.set(0,-.055,.025);face.add(jaw);
  const nose=mesh(sph(.014,10,8),skin);nose.scale.set(fp.nw,1.55*fp.nh,1.3*fp.nd);nose.position.set(0,-.006,.098+(fp.nd-1)*.004);face.add(nose);
  for(const s of[-1,1]){const e=mesh(sph(.028,10,8),skin);e.scale.set(.4,.8*fp.ear,.55*fp.ear);e.position.set(s*.09,0,-.005);face.add(e);}
  const eyeW=mat('#f1ede5',{roughness:.3}),irisM=mat(fp.eye,{roughness:.15}),pupM=mat('#050505',{roughness:.2}),catchM=mat('#ffffff',{emissive:'#ffffff',emissiveIntensity:1.6,roughness:.1});
  P.pup=[];P.mw=fp.mw;
  P.eyes=[1,-1].map(s=>{const g=new T.Group();g.position.set(s*.034,.018,.083);g.add(mesh(sph(.0135,12,10),eyeW,false));const ir=mesh(sph(.0072,10,8),irisM,false);ir.position.z=.0105;ir.scale.z=.5;g.add(ir);
    const pu=mesh(sph(.0036,8,6),pupM,false);pu.position.z=.0136;pu.scale.z=.35;g.add(pu);P.pup.push(pu);
    const ct=mesh(sph(.0016,6,5),catchM,false);ct.position.set(.0028,.0028,.0142);g.add(ct);   // gözdeki ışık yansıması
    face.add(g);return g;});
  // göz kapakları: kırpma, aşağı bakınca inme, gerginlikte kısılma
  P.lids=[1,-1].map(s=>{const g=new T.Group();g.position.set(s*.034,.018,.083);g.add(mesh(shell(.0152,0,TAU,0,PI/2),skin,false));face.add(g);return g;});
  const browM=mat(shade(hc,.75),{roughness:.85});
  P.brows=[1,-1].map(s=>{const b=mesh(box(.032*(.9+.1*fp.brow),.0065*fp.brow,.008),browM,false);b.position.set(s*.035,.046,.093);face.add(b);return b;});
  const lipM=mat(fem?(d.lips||'#a8424a'):shade(d.skin||'#d6a482',.68),{roughness:tier>0?.34:.5,side:T.DoubleSide});
  P.mouth=new T.Mesh(torus(.016,.0028,PI,6,14),lipM);P.mouth.position.set(0,-.047,.093);P.mouth.rotation.z=PI;face.add(P.mouth);
  P.mo=mesh(sph(.012,10,6),mat('#3a1512',{roughness:.7}),false);P.mo.scale.set(1.25,.05,.45);P.mo.position.set(0,-.05,.088);face.add(P.mo);
  faceDetail(face,d,skin,fp,fem);
  dressHead(face,head,d,{hairM});
  // kollar ve bacaklar kök uzayında; her kare iki nokta arasına yerleştirilir
  P.ua=.3;P.fa=.27;
  const mk=(g,m)=>{const o=mesh(g,m);root.add(o);return o;};
  P.up=[0,1].map(()=>mk(cyl(.042*bw,.047*bw,1,10),upM));
  P.fo=[0,1].map(()=>mk(cyl(.033*bw,.04*bw,1,10),foM));
  P.el=[0,1].map(()=>mk(sph(.042*bw,10,8),upM));
  P.hand=[makeHand(skin,-1),makeHand(skin,1)];P.hand.forEach(h=>root.add(h));
  // manşet: uzun kollu giysilerde bileğin etrafında halka; ceketlerin altından gömlek manşeti görünür
  if(foM!==skin){const cj=['jacket','suit','blazer','tux'].includes(kind);for(const h of P.hand){const cf=mesh(torus(.037*bw,.0085,TAU,6,16),cj?innerM:foM,false);cf.position.z=-.012;h.add(cf);if(cj){const bt=mesh(sph(.0045,6,4),GOLD(),false);bt.position.set(.03*bw,0,-.012);h.add(bt);}}}
  const acc=d.acc||[];
  if(acc.includes('bracelet'))for(const h of P.hand){const b=mesh(torus(.036*bw,.0042,TAU,6,16),GOLD(),false);b.position.z=-.006;h.add(b);}
  if(acc.includes('watch'))P.watch=mk(cyl(.038*bw,.038*bw,.022,14),mat(R()<.5?'#c9a24a':'#bfc3c7',{metalness:.85,roughness:.25}));
  if(acc.includes('rings'))for(const h of P.hand){const r=mesh(torus(.011,.003,TAU,5,10),GOLD(),false);r.position.set(.015,0,.11);r.rotation.x=PI/2;h.add(r);}
  const shoe=mat(d.shoes||'#141210',{roughness:.45});
  P.leg=[0,1].map(()=>{const L={th:mk(cyl(.058*bw,.068*bw,1,10),pantsM),sh:mk(cyl(.043,.05,1,10),pantsM),kn:mk(sph(.056*bw,10,8),pantsM),ft:mk(box(.085,.06,.2),shoe)};
    const toe=mesh(sph(.044,10,8),shoe,false);toe.scale.set(1,.7,1);toe.position.set(0,-.004,.085);L.ft.add(toe);
    const sole=mesh(box(.088,.012,.206),mat('#0a0908',{roughness:.7}),false);sole.position.y=-.03;L.ft.add(sole);
    const cuff=mesh(cyl(.047,.047,.02,10),pantsM,false);cuff.position.set(0,.04,-.04);L.ft.add(cuff);
    return L;});
  const props=d.props||[];
  if(props.includes('tespih')){
    const n=33,im=new T.InstancedMesh(sph(.0055,6,5),mat('#6b2a1a',{roughness:.35}),n);im.castShadow=true;P.hand[1].add(im);P.tespih={im,n,ph:0};
    const tas=mesh(cyl(.003,.007,.035,6),mat('#3a120c'),false);tas.position.set(0,-.13,.08);P.hand[1].add(tas);
  }
  if(props.includes('cigarette')||props.includes('cigar')){
    const cg=props.includes('cigar');const c=new T.Group();
    const b=mesh(cyl(cg?.008:.0042,cg?.008:.0042,cg?.12:.075,8),mat(cg?'#5a3a20':'#efe9dc',{roughness:.8}),false);b.rotation.z=PI/2;c.add(b);
    const tip=mesh(sph(cg?.0085:.0048,8,6),mat('#ff6a1a',{emissive:'#ff4a00',emissiveIntensity:2}),false);tip.position.x=-(cg?.06:.0375);c.add(tip);
    c.position.set(-.025,-.006,.11);c.rotation.y=.25;P.hand[1].add(c);P.cig={g:c,tip};
  }
  if(opt.croupier&&W&&W.backMat){const deck=mesh(box(.066,.022,.092),W.backMat,false);deck.position.set(0,.016,.07);P.hand[0].add(deck);}

  // durum
  P.st={inHand:true,folded:false,turn:false,out:false};
  P.pose=P.isCroupier?'table':pick1(P.sfx.poses);P.poseT=8+R()*14;
  P.baseHand=['rest',P.tespih?'tespih':'rest'];P.hk=[...P.baseHand];
  P.hc=[V3(),V3()];P.hv=[V3(),V3()];P.hw=[9,9];
  P.baseLook={k:'board'};P.look=P.baseLook;P.lookPrev=null;P.hTY=0;P.hTP=.3;
  P.baseSmile=P.sfx.smile;P.smile=P.baseSmile;P.smileT=P.baseSmile;
  P.lean=0;P.vlean=0;P.leanT=0;P.brow=0;P.browT=0;P.shrug=0;P.vshrug=0;P.shrugT=0;P.breath=1;P.breathT=1;P.trem=0;P.peek=0;P.peekT=0;P.nod=0;P.vnod=0;P.nodT=0;
  P.squint=0;P.squintT=0;P.brow1=0;P.brow1T=0;P.smirk=0;P.smirkT=0;P.gulpK=0;P.gest2=false;P.roll=0;P.pupK=1;
  P.hy=0;P.hvy=0;P.hp=.3;P.hvp=0;P.sy=0;P.svy=0;P.ey=0;P.evy=0;P.ep=0;P.evp=0;
  P.stand=P.standing?1:0;P.idleT=1+R()*3;P.blinkT=1+R()*4;P.blinkK=0;P.sacc=[0,0];P.saccT=0;P.ph=[R()*9,R()*9,R()*9];
  P.freezeUntil=0;P.tremUntil=0;P.tespihSpd=1;P.tespihUntil=0;P.hold=[null,null];P.seq=null;P.prio=0;P.exhale=0;P.smokeT=0;
  P.talk=0;P.talkUntil=0;P.hushUntil=0;P.gest=0;P.chatty=!!d.chatty;P.carry=null;P.job=null;P.seqName=null;P.wipe=0;P.rub=0;P.riffle=0;P.shake=0;P.walk=0;P.walkPh=0;P.open=0;P.openT=0;P.laugh=0;P.laughK=0;P.shakeA=.22;P.shakeF=10;
  P.habit=d.quirk==='riffle'?'riffle':d.quirk==='smoke'?'smoke':d.quirk==='tespih'?'tespihPlay':(props.some(x=>/tea|raki|whiskey|cognac|wine|champagne|vodka|cocktail|water|cola|energy|coffee/.test(x))?'drink':null);
  if(d.quirk==='tea')P.habit='drink';

  P.leanBase=()=>{if(P.npc)return P.npcLean||0;if(P.isCroupier)return .1;if(P.st.folded||!P.st.inHand)return -.05+P.sfx.lean*.5;return P.sfx.lean+(POSE_LEAN[P.pose]||0)+((d.age||40)>=60?.05:0);};
  const mkLook=s=>{
    if(typeof s!=='string')return s;
    if(s==='away'){const l=V3((R()<.5?-1:1)*(1+R()*1.2),1.3+R()*.7,-.4+R()*1.2);return {k:'w',v:root.localToWorld(l)};}
    if(s==='down')return {k:'w',v:root.localToWorld(V3(0,.62,.32))};
    if(s==='phoneLook')return {k:'w',v:root.localToWorld(V3(0,TY+.12,.36))};
    if(s==='base')return P.baseLook;
    return {k:s};
  };
  P.play=(steps,prio=1,name=null)=>{
    if(P.leaving)return false;
    if(P.seq&&prio<P.prio)return false;
    if(P.seq)P.drop();
    P.seq=steps;P.prio=prio;P.si=0;P.seqT=0;P.seqName=name;P.apply(steps[0]);return true;
  };
  P.apply=s=>{
    if(s.L!==undefined)P.hk[0]=s.L;if(s.R!==undefined)P.hk[1]=s.R;
    if(s.look)P.look=mkLook(s.look);
    if(s.lean!==undefined)P.leanT=s.lean;if(s.smile!==undefined)P.smileT=s.smile;if(s.brow!==undefined)P.browT=s.brow;
    if(s.shrug!==undefined)P.shrugT=s.shrug;if(s.breath!==undefined)P.breathT=s.breath;if(s.peek!==undefined)P.peekT=s.peek;
    if(s.nod!==undefined)P.nodT=s.nod;if(s.rub!==undefined)P.rub=s.rub;if(s.riffle!==undefined)P.riffle=s.riffle;if(s.shake!==undefined)P.shake=s.shake;if(s.open!==undefined)P.openT=s.open;if(s.laugh!==undefined)P.laugh=s.laugh;if(s.shakeA!==undefined)P.shakeA=s.shakeA;if(s.shakeF!==undefined)P.shakeF=s.shakeF;
    if(s.gest!==undefined)P.gest=s.gest;if(s.wipe!==undefined)P.wipe=s.wipe;
    if(s.squint!==undefined)P.squintT=s.squint;if(s.brow1!==undefined)P.brow1T=s.brow1;if(s.smirk!==undefined)P.smirkT=s.smirk;if(s.roll!==undefined)P.roll=s.roll;
    if(s.hold)P.hold[0]=s.hold==='phone'?P.phone:P.cup;if(s.drop)P.hold[0]=null;
    if(s.grab)P.grab();if(s.release)P.drop();
    P.hw[0]=P.hw[1]=(s.spd||6)*1.6;
    if(s.fn)try{s.fn();}catch(e){}
  };
  P.reset=()=>{P.drop();P.hk=[...P.baseHand];P.look=P.baseLook;P.leanT=P.leanBase();P.smileT=P.baseSmile;P.browT=0;P.shrugT=0;P.breathT=1;P.peekT=0;P.nodT=0;P.rub=0;P.riffle=0;P.shake=0;P.openT=0;P.laugh=0;P.shakeA=.22;P.shakeF=10;P.gest=0;P.wipe=0;P.squintT=0;P.brow1T=0;P.smirkT=0;P.roll=0;if(P.standT===1)P.standT=0;P.prio=0;P.hw=[8,8];P.hold[0]=null;P.seqName=null;};
  P.init=()=>{root.updateMatrixWorld(true);for(let s=0;s<2;s++){P.hc[s].copy(P.handPt(P.hk[s],s));P.hv[s].set(0,0,0);}P.lean=P.leanT=P.leanBase();};
  P.headW=v=>P.head.getWorldPosition(v);
  P.handW=(out,which)=>{if(which==='both'){P.hand[0].getWorldPosition(out);P.hand[1].getWorldPosition(_t2);return out.add(_t2).multiplyScalar(.5);}return P.hand[which===0?0:1].getWorldPosition(out);};
  // Taşıma: bekleyen iş (fiş yığını ya da kartlar) ele yapışır, bırakılınca kalan yolu kendisi kayar.
  P.grab=()=>{const j=P.job;if(!j||j.state!=='wait')return;j.state='carry';P.carry=j;P.job=null;P.handW(_w,j.hands);
    if(j.type==='cards')j.off=j.cards.map(cd=>{if(!cd.swept)cd.anim=null;return V3(cd.st.pos.x-_w.x,0,cd.st.pos.z-_w.z);});
    else j.off=V3(j.pile.g.position.x-_w.x,0,j.pile.g.position.z-_w.z);};
  P.drop=()=>{if(P.carry){releaseJob(P.carry);P.carry=null;}};
  P.releaseAll=()=>{P.drop();if(P.job){releaseJob(P.job);P.job=null;}};
  const faceLoc=(x,y,z)=>root.worldToLocal(P.face.localToWorld(_t.set(x,y,z)));
  P.restPt=s=>{
    if(P.restOverride)return _t.copy(P.restOverride[s]);
    if(P.pose==='chinrest')return faceLoc(s?-.04:.04,-.2,.06);
    const v=(POSES[P.pose]||POSES.rail)[s];
    if(!v)return _t.set(-.2,TY+.075,.56);
    return _t.set(v[0],v[1],v[2]);
  };
  P.handPt=(k,s)=>{
    if(k&&k.isVector3)return k;
    const sg=s?-1:1;
    switch(k){
      case 'rest':return P.restPt(s);
      case 'peek':return _t.set(sg*.03,TY+.075,.5);
      case 'cards':return _t.set(sg*.02,TY+.035,.56);
      case 'chips':return _t.set(-.2,TY+.075,.56);
      case 'chipsL':return _t.set(-.1,TY+.075,.57);
      case 'bet':return _t.set(-.03,TY+.045,.76);
      case 'betL':return _t.set(.06,TY+.045,.74);
      case 'muck':return _t.set(0,TY+.07,.86);
      case 'tapUp':return _t.set(-.09,TY+.085,.55);
      case 'tapDown':return _t.set(-.09,TY+.03,.56);
      case 'slamUp':return _t.set(-.08,TY+.26,.48);
      case 'slamDown':return _t.set(-.08,TY+.035,.54);
      case 'crossL':return _t.set(-.13,.84,.15);
      case 'crossR':return _t.set(.13,.82,.17);
      case 'tespih':return _t.set(-.05,TY+.1,.37);
      case 'shufL':return _t.set(.05,TY+.06,.48);
      case 'shufR':return _t.set(-.05,TY+.06,.48);
      case 'phoneL':return _t.set(.03,TY+.15,.33);
      case 'phoneR':return _t.set(-.04,TY+.14,.34);
      case 'deckR':return _t.set(.01,TY+.08,.45);
      case 'press':return _t.set(-.05,.92,.45);
      case 'pressDown':return _t.set(-.05,.86,.47);
      case 'cup':return P.cup?root.worldToLocal(_t.copy(P.cup.home)).add(_t2.set(0,.03,-.07)):P.restPt(s);
      case 'pot':case 'potL':{const l=root.worldToLocal(_t.copy(W.potPos));l.y=TY+.05;if(k==='potL')l.x+=.09;return l;}
      case 'stretch':return _t.set(sg*.3,1.38,.02);
      case 'behindHead':return _t.set(sg*.1,1.27,-.13);
      case 'clapIn':return _t.set(sg*.025,1.0,.36);
      case 'clapOut':return _t.set(sg*.16,1.03,.3);
      case 'fistUp':return _t.set(sg*.2,1.33,.3);
      case 'wristUp':return _t.set(sg*.05,1.04,.3);
      case 'rack':return _t.set(.06,TY+.06,.42);
      case 'scalp':return faceLoc(sg*.05,.2,.04);
      case 'collar':return faceLoc(0,-.2,.1);
      case 'eyes':return faceLoc(sg*.035,.02,.14);
      case 'brim':return faceLoc(sg*.06,.2,.1);
      case 'chin':return faceLoc(0,-.2,.06);
      case 'mouth':return faceLoc(-.03,-.11,.17);
      case 'drinkUp':return faceLoc(.03,-.12,.15);
      case 'neck':return faceLoc(-.06,-.24,0);
      case 'bridge':return faceLoc(0,.035,.15);
      case 'chest':return faceLoc(0,-.3,.13);
      case 'faceL':return faceLoc(.055,0,.15);
      case 'faceR':return faceLoc(-.055,0,.15);
      case 'hairSide':return faceLoc(-.12,.06,.02);
      case 'pocket':return _t.set(sg*.2,.8,.36);
      case 'twist':return _t.set(sg*.025,TY+.1,.4);
    }
    return P.restPt(s);
  };
  P.lookW=(spec,out)=>{
    switch(spec.k){
      case 'board':return out.set(0,TY,0);
      case 'pot':return out.copy(W.potPos);
      case 'chips':return out.copy(P.stackW||W.potPos);
      case 'cards':return out.copy(P.cardsW||W.potPos);
      case 'bet':return out.copy(P.betW||W.potPos);
      case 'human':return out.copy(camera.position);
      case 'turn':{const i=W.turnIdx;if(i===0)return out.copy(camera.position);const q=i>0&&W.people[i];if(q&&q!==P)return q.headW(out);return out.set(0,TY,0);}
      case 'p':{if(spec.i===0)return out.copy(camera.position);const q=W.people[spec.i];return q?q.headW(out):out.set(0,TY,0);}
      case 'np':return spec.p.headW(out);
      case 'fwd':return root.localToWorld(out.set(0,1.45,3));
      case 'w':return out.copy(spec.v);
    }
    return out.set(0,TY,0);
  };
  // Tarza göre boş zaman hareketleri: sıkı oyuncu az kıpırdar, saldırgan ve gevşek olan çok
  P.fidgets=out=>{
    const base={kaya:['collar','checkWatch','adjustHat','shiftSeat'],manyak:['drum','stretch','scratch','behindHead','yawn','shiftSeat'],gevsek:['stretch','yawn','scratch','behindHead','rubEyes','drum','shiftSeat'],kopekbaligi:['shiftSeat','drum','checkWatch'],tilki:['drum','collar','checkWatch','shiftSeat','scratch']}[opt.style]||['shiftSeat','scratch'];
    const l=base.filter(n=>!(n==='checkWatch'&&!P.watch)&&!(n==='adjustHat'&&!d.hat));
    if(d.hat&&!l.includes('adjustHat')&&R()<.4)l.push('adjustHat');
    if(out)l.push('stretch','yawn','rubEyes','behindHead');
    if(d.tie||(d.top&&['suit','tux'].includes(d.top[0])))l.push('collar');
    // kişiye özgü huylar: aksesuarına, saçına ve tarzına göre
    const ac=d.acc||[],hs0=d.hair&&d.hair[0];
    if(ac.includes('glasses')||ac.includes('monocle'))l.push('glassesPush','glassesPush');
    if(ac.includes('chain')||ac.includes('pearls')||ac.includes('pendant'))l.push('touchChain');
    if(ac.includes('rings'))l.push('ringTwist');
    if(['long','bob','updo','bangs','braid','ponytail','sidepart'].includes(hs0))l.push('hairTuck');
    if(ac.includes('sunglassesHead'))l.push('shadesFlip');
    if(d.tie)l.push('tieAdjust');
    if(ac.includes('pocket')||(d.top&&['jacket','suit','blazer'].includes(d.top[0])))l.push('pocketCheck');
    if(d.quirk==='riffle')l.push('chipRoll','chipRoll');
    if(d.hat&&d.hat[0]==='cowboy')l.push('hatTip');
    if(opt.style==='tilki'||opt.style==='kopekbaligi')l.push('scan','sidelong');
    return l;
  };
  P.idle=t=>{
    if(t<P.idleT||P.st.out||P.leaving)return;
    P.idleT=t+(1.9+R()*3.8)*P.sfx.idle;
    if(P.npc){if(P.npcIdle)P.npcIdle(t);return;}
    if(P.isCroupier){if(R()<.14)P.act('croupTidy');else P.play([{t:1.6+R()*2.5,look:R()<.65?'turn':'board'}],1);return;}
    const st=P.st,r=R(),out=st.folded||!st.inHand;
    if(st.turn)return;
    if(t>P.poseT){
      P.poseT=t+(12+R()*18)*P.sfx.idle;
      const np=pick1(out?['lap','rail','lap',P.sfx.poses[0]]:P.sfx.poses);
      if(np!==P.pose){P.pose=np;P.play([{t:.8,lean:P.leanBase()-.04,shrug:.3,spd:4},{t:.7,shrug:0,lean:P.leanBase()}],1);return;}
    }
    if(P.habit&&r<.16){P.act(P.habit);return;}
    if(P.chatty&&t>P.hushUntil&&r<(out?.42:.2)){P.act('chat');return;}
    if(R()<(out?.34:.17)*P.fid){const pool=P.fidgets(out);if(pool.length){P.act(pick1(pool));return;}}
    if(out){
      if(r<.3)P.play([{t:2.4+R()*3,look:'away',lean:-.06}],1);
      else if(r<.45&&P.phone)P.act('phone');
      else if(r<.56)P.act('cross');
      else P.play([{t:2+R()*2.5,look:'turn'}],1);
      return;
    }
    if(r<.45)P.play([{t:2+R()*3,look:'turn'}],1);
    else if(r<.62)P.play([{t:1.6+R()*2,look:'board'}],1);
    else if(r<.69)P.play([{t:1+R()*1.2,look:'human'}],1);
    else if(r<.8){const o=W.people.filter(q=>q&&q!==P&&q.root.visible);if(o.length)P.play([{t:1.4+R()*1.8,look:{k:'p',i:pick1(o).idx}}],1);}
    else if(r<.8+.08*P.expr)P.act('peekIdle');
    else P.play([{t:1.6,look:'away'}],1);
  };
  P.act=(v,o={})=>{
    const e=P.expr,bh=P.baseHand;
    switch(v){
      case 'peek':case 'peekIdle':return P.play([{t:.5,L:'peek',R:'peek',look:'cards',lean:.22,peek:1,spd:6},{t:.7+R()*.5},{t:.5,L:bh[0],R:bh[1],peek:0,lean:P.leanBase()}],v==='peek'?2:1);
      case 'glanceChips':return P.play([{t:.7,look:'chips'},{t:.8,look:'board'}],2);
      case 'sitUp':return P.play([{t:2.6,lean:-.03,brow:.6,look:'board'}],2);
      case 'lookAway':return P.play([{t:2.8,look:'away',lean:-.1,smile:P.baseSmile+.05}],2);
      case 'lookAwayQuick':return P.play([{t:.45,look:'board'},{t:2.3,look:'away',lean:-.05}],2);
      case 'lookBoard':return P.play([{t:1+R()*.8,look:'board',lean:P.leanBase()+.06}],2);
      case 'stareBoard':return P.play([{t:3,look:'board',lean:.2,brow:-.7,smile:-.2}],2);
      case 'slump':return P.play([{t:.8,breath:2.8,shrug:.5},{t:2.4,lean:.15,look:'down',smile:-.5,breath:1,shrug:0}],2);
      case 'sigh':return P.play([{t:.9,breath:2.8,shrug:.6},{t:1,breath:1,shrug:0,look:'away'}],2);
      case 'recheck':return P.play([{t:.4,look:'board'},{t:.5,L:'peek',R:'peek',look:'cards',peek:1,lean:.22,spd:6},{t:.6},{t:.45,look:'board',peek:0,L:bh[0],R:bh[1]},{t:.45,look:'cards',peek:.6},{t:.4,peek:0}],2);
      case 'leanIn':return P.play([{t:2.6,lean:.28,look:'board',brow:.4}],2);
      case 'reachCards':return P.play([{t:o.dur||4,R:'cards',look:'away',lean:.1,spd:4}],2);
      case 'reachChips':return P.play([{t:o.dur||4,R:'chips',look:'human',lean:.14,spd:4}],2);
      case 'think':return P.play([{t:(o.dur||1.2)*.55,look:'board',lean:P.leanBase()+.06},{t:(o.dur||1.2)*.45,look:R()<.5?'human':'pot'}],2);
      case 'chin':return P.play([{t:o.dur||2,R:'chin',look:'board',lean:.17,brow:-.3,spd:3.5}],2);
      case 'stare':return P.play([{t:o.dur||3.5,look:'human',lean:.1,smile:0}],3);
      case 'freeze':P.freezeUntil=W.t+(o.dur||3);return true;
      case 'tremble':P.tremUntil=W.t+(o.dur||2.5);return true;
      case 'neck':return P.play([{t:.6,R:'neck',look:'down',spd:4.5},{t:1.4,rub:1},{t:.6,R:bh[1],rub:0,spd:5}],2);
      case 'cover':return P.play([{t:.55,R:'mouth',look:'down',spd:4.5},{t:1.3},{t:.55,R:bh[1],spd:5}],2);
      case 'shrug':return P.play([{t:.45,shrug:1,brow:.7,smile:-.15,look:'away'},{t:.8,shrug:0},{t:1.4,look:'away',lean:-.08}],3);
      case 'bet':{const hard=o.force==='hard',soft=o.force==='soft',both=!!o.allin;P.seqAll=both;
        return P.play([
          {t:.34,L:both?'chipsL':undefined,R:'chips',look:'chips',lean:.16,spd:8},
          {t:soft?.6:.42,L:both?'betL':undefined,R:'bet',look:'bet',lean:hard?.33:.25,spd:hard?14:soft?4.5:7.5,grab:1},
          {t:.12,release:1},
          {t:.55,L:bh[0],R:bh[1],lean:P.leanBase(),spd:5}],4,'bet');}
      case 'call':P.seqAll=false;return P.play([{t:.32,R:'chips',look:'chips',lean:.14,spd:8},{t:.42,R:'bet',look:'bet',lean:.22,spd:7,grab:1},{t:.1,release:1},{t:.55,R:bh[1],lean:P.leanBase(),spd:5}],4,'bet');
      case 'check':return P.play([{t:.25,R:'tapUp',look:'board',spd:9},{t:.11,R:'tapDown',spd:22},{t:.12,R:'tapUp',spd:20},{t:.11,R:'tapDown',spd:22},{t:.45,R:bh[1],spd:6}],4);
      case 'fold':return P.play([{t:.3,R:'cards',look:'cards',lean:.18,spd:9},{t:.32,R:'muck',spd:11,grab:1},{t:.05,release:1},{t:.6,R:bh[1],lean:-.04,spd:5}],4,'fold');
      case 'win':{const st=[{t:.55,L:'potL',R:'pot',lean:.32,look:'pot',smile:cl(.25+.5*e,0,1),spd:6},{t:.85,L:'chipsL',R:'chips',look:'chips',grab:1,spd:4.5},{t:.1,release:1}];
        const cel=o.big&&e>.6&&R()<.85?({manyak:R()<.5?'standCheer':'tableSlap',gevsek:R()<.4?'standCheer':'armsUp',kopekbaligi:'smirk',tilki:'smirk',kaya:'chuckle'})[opt.style]:null;
        if(cel)st.push({t:.05,fn:()=>{P.prio=0;P.act(cel);}});   // tarzına göre kutlama: coşkulu, kurnaz ya da sakin
        else if(o.big&&e>.6)st.push({t:.45,L:bh[0],R:'fistUp',lean:-.05,look:'human',smile:1,brow:.5,spd:11},{t:.7,smile:1},{t:.5,R:bh[1],lean:P.leanBase(),smile:P.baseSmile,spd:6});
        else st.push({t:1.6,L:bh[0],R:bh[1],lean:-.05,smile:cl(.15+.55*(e-.5),0,1),look:e>1?'human':'board'});
        return P.play(st,4,'win');}
      case 'lose':{
        if(o.big&&R()<.7){const pool=({manyak:['rage','facepalm','handsOnHead'],gevsek:['despair','handsOnHead','facepalm'],kopekbaligi:['headShake','sigh'],tilki:['eyeroll','headShake','sigh'],kaya:['sigh','headShake']})[opt.style];if(pool)return P.act(pick1(pool));}
        if(o.big&&e>.7&&R()<.5)return P.act('facepalm');
        if(e>1.05)return P.play([{t:.45,smile:-.7,brow:-.8,lean:-.12,shake:1},{t:1,shake:0},{t:1.6,look:'away',breath:2.4}],4);
        if(o.big&&R()<.5)return P.act('headShake');
        return P.play([{t:1.6,smile:0,look:'board'}],3);}
      case 'rage':return P.play([{t:.3,R:'slamUp',smile:-1,brow:-1,spd:10},{t:.12,R:'slamDown',spd:32,fn:()=>{try{SFX.play('check');}catch(x){}}},{t:1.8,R:bh[1],lean:-.12,look:'away',smile:-.6,spd:4}],5);
      case 'countChips':return P.play([{t:2.6,R:'chips',look:'chips',riffle:1,lean:.16},{t:.5,R:bh[1],riffle:0}],2);
      case 'riffle':return P.play([{t:3+R()*2,R:'chips',riffle:1,look:'turn'},{t:.5,R:bh[1],riffle:0}],1);
      case 'smoke':if(!P.cig)return false;return P.play([{t:.7,R:'mouth',spd:4.5},{t:.9,breath:1.8},{t:.7,R:bh[1],breath:1,spd:4.5,fn:()=>{P.exhale=W.t+.25;}}],o.prio||1);
      case 'drink':if(!P.cup)return false;return P.play([{t:.6,L:'cup',spd:5},{t:.2,hold:'cup'},{t:.75,L:'drinkUp',nod:-.18,spd:3.6},{t:.8},{t:.65,L:'cup',nod:0,spd:3.6},{t:.15,drop:1},{t:.5,L:bh[0]}],o.prio||1);
      case 'tespihPlay':return P.play([{t:2.5,look:'down',fn:()=>{P.tespihSpd=1.8;P.tespihUntil=W.t+2.5;}}],1);
      case 'tespihFast':P.tespihSpd=2.8;P.tespihUntil=W.t+(o.dur||5);return true;
      case 'tespihStop':P.tespihSpd=0;P.tespihUntil=W.t+(o.dur||6);return true;
      case 'phone':if(!P.phone)return false;return P.play([{t:.6,L:'phoneL',R:'phoneR',look:'phoneLook',lean:.06,hold:'phone',spd:5},{t:4+R()*5},{t:.6,L:bh[0],R:bh[1],drop:1,spd:5}],1);
      case 'cross':return P.play([{t:4+R()*5,L:'crossL',R:'crossR',lean:-.07,look:'turn',spd:4}],1);
      case 'chat':{const others=W.people.filter(q=>q&&q!==P&&q.root.visible&&!q.st.out);const dur=2+R()*3;
        const tg=others.length&&R()<.75?{k:'p',i:pick1(others).idx}:{k:'human'};
        P.talkUntil=W.t+dur;
        if(tg.k==='p'){const q=W.people[tg.i];if(q&&!q.seq&&R()<.6)q.play([{t:dur*.8,look:{k:'p',i:P.idx}}],1);}
        return P.play([{t:dur,look:tg,smile:P.baseSmile+.12,gest:1,fn:()=>{P.gest2=R()<.55;}},{t:.3,gest:0}],1);}
      case 'hush':P.hushUntil=W.t+(o.dur||25);P.talkUntil=0;return true;
      case 'dealCard':{const l=root.worldToLocal(_w.copy(o.to));l.y=TY+.05;return P.play([{t:.06,R:'deckR',spd:22},{t:.1,R:l.clone(),spd:24},{t:.16,R:bh[1],spd:12}],2);}
      case 'shuffle':return P.play([{t:.3,L:'shufL',R:'shufR',look:'cards',spd:8,riffle:1},{t:.9},{t:.3,L:bh[0],R:bh[1],riffle:0}],3);
      case 'push':{const l=root.worldToLocal(_w.copy(o.to));l.y=TY+.05;return P.play([{t:.45,L:'potL',R:'pot',look:'pot',lean:.22,spd:7},{t:.75,R:l.clone(),L:l.clone().add(V3(.08,0,0)),look:{k:'w',v:o.to.clone()},grab:1,spd:4},{t:.1,release:1},{t:.55,L:bh[0],R:bh[1],lean:P.leanBase()}],4,'push');}
      case 'nod':return P.play([{t:.25,nod:.28,look:'human'},{t:.35,nod:0}],1);
      case 'attend':return P.play([{t:o.dur||1.4,look:o.i===0?'human':{k:'p',i:o.i}}],1);
      case 'stretch':return P.play([{t:.7,L:'stretch',R:'stretch',lean:-.12,breath:2.6,look:'away',spd:4},{t:.9,breath:2.8},{t:.8,L:bh[0],R:bh[1],lean:P.leanBase(),breath:1,spd:4}],1);
      case 'yawn':return P.play([{t:.5,R:'mouth',open:1,breath:2.4,look:'away',spd:5},{t:1.1,open:1,breath:2.8},{t:.5,open:0,R:bh[1],breath:1,spd:5}],1);
      case 'gasp':return P.play([{t:.25,breath:3,brow:1,open:.7,lean:-.14,shrug:.35},{t:.8,open:.3},{t:.5,open:0,brow:0,breath:1,shrug:0,lean:P.leanBase()}],2);
      case 'laugh':return P.play([{t:.25,smile:1,open:.8,lean:-.08,nod:-.2},{t:1.3,laugh:1,smile:1,open:.55},{t:.4,laugh:0,open:0,nod:0,smile:P.baseSmile}],2);
      case 'clap':{const st=[{t:.3,smile:.7,look:'human',L:'clapOut',R:'clapOut',spd:12}];for(let i=0;i<5;i++)st.push({t:.12,L:'clapIn',R:'clapIn',spd:28},{t:.12,L:'clapOut',R:'clapOut',spd:28});st.push({t:.4,L:bh[0],R:bh[1],smile:P.baseSmile,spd:6});return P.play(st,2);}
      case 'fistPump':return P.play([{t:.35,R:'fistUp',smile:1,brow:.5,lean:-.05,spd:12},{t:.8,smile:1},{t:.5,R:bh[1],smile:P.baseSmile,spd:6,lean:P.leanBase()}],4);
      case 'facepalm':return P.play([{t:.5,R:'eyes',brow:-.8,smile:-.6,lean:.14,look:'down',spd:7},{t:1.4,breath:2.2},{t:.6,R:bh[1],breath:1,lean:P.leanBase(),spd:5}],4);
      case 'headShake':return P.play([{t:.2,look:'board',smile:-.1},{t:1.1,shake:1,shakeA:.13,shakeF:6.5},{t:.3,shake:0}],2);
      case 'scratch':return P.play([{t:.55,R:'scalp',look:'away',spd:6},{t:1.1,rub:1},{t:.5,R:bh[1],rub:0,spd:5}],1);
      case 'collar':return P.play([{t:.5,R:'collar',look:'down',spd:6},{t:1,rub:1},{t:.5,R:bh[1],rub:0,spd:5}],1);
      case 'rubEyes':return P.play([{t:.5,R:'eyes',look:'down',breath:2,spd:6},{t:1,rub:1},{t:.5,R:bh[1],rub:0,breath:1,spd:5}],1);
      case 'behindHead':return P.play([{t:.8,L:'behindHead',R:'behindHead',lean:-.2,look:'board',spd:4},{t:2.6+R()*2},{t:.8,L:bh[0],R:bh[1],lean:P.leanBase(),spd:4}],1);
      case 'checkWatch':if(!P.watch)return false;return P.play([{t:.6,L:'wristUp',look:'down',lean:.04,spd:6},{t:1.3},{t:.5,L:bh[0],spd:6}],1);
      case 'adjustHat':if(!d.hat)return false;return P.play([{t:.5,R:'brim',look:'away',spd:7},{t:.8},{t:.5,R:bh[1],spd:6}],1);
      case 'drum':return P.play([{t:.25,R:'tapUp',spd:8},{t:.1,R:'tapDown',spd:22},{t:.14,R:'tapUp',spd:20},{t:.1,R:'tapDown',spd:22},{t:.14,R:'tapUp',spd:20},{t:.1,R:'tapDown',spd:22},{t:.14,R:'tapUp',spd:20},{t:.1,R:'tapDown',spd:22},{t:.4,R:bh[1],spd:6}],1);
      case 'shiftSeat':return P.play([{t:.7,lean:P.leanBase()-.05,shrug:.4,spd:4},{t:.7,shrug:0,lean:P.leanBase()+.02}],1);
      case 'croupTidy':return P.play([{t:.5,R:'rack',look:'chips',riffle:1,spd:6},{t:1.4,riffle:1},{t:.5,R:bh[1],riffle:0,spd:6}],1);
      // tepkiler
      case 'jawDrop':return P.play([{t:.22,breath:3,brow:1,open:1,lean:-.18,shrug:.4,look:'human',spd:8},{t:1,open:.8,brow:.8},{t:.6,open:0,brow:0,breath:1,shrug:0,lean:P.leanBase()}],3);
      case 'smirk':return P.play([{t:.35,smirk:1,brow1:.7,look:'human'},{t:1.2},{t:.5,smirk:0,brow1:0}],2);
      case 'chuckle':return P.play([{t:.25,smile:.8,open:.25,nod:-.1},{t:.7,laugh:.6,smile:.9,open:.2},{t:.4,laugh:0,open:0,nod:0,smile:P.baseSmile}],2);
      case 'eyeroll':return P.play([{t:.35,look:{k:'w',v:root.localToWorld(V3(0,2.5,-.1))},brow:.5,smile:-.1,spd:6},{t:.5},{t:.4,look:'away',breath:2.4,shrug:.4},{t:.5,brow:0,shrug:0,breath:1}],2);
      // gözler: tek tek süzme, yan bakış
      case 'scan':{const os=W.people.filter(q=>q&&q!==P&&q.root.visible&&!q.st.out);if(!os.length)return false;const st=os.slice(0,4).map(q=>({t:.5+R()*.35,look:{k:'p',i:q.idx},squint:.55,brow:-.15}));st.push({t:.4,squint:0,brow:0,look:'board'});return P.play(st,2);}
      case 'sidelong':return P.play([{t:.35,look:'human',squint:.7,brow:-.25,smirk:.4},{t:1.4},{t:.4,squint:0,brow:0,smirk:0,look:'board'}],2);
      // blöf ve gerginlik belirtileri
      case 'gulp':return P.play([{t:.5,breath:2.6,shrug:.25,fn:()=>{P.gulpK=1;}},{t:.4,breath:1,shrug:0}],2);
      case 'lipBite':return P.play([{t:.35,smile:-.25,open:.12,look:'away',spd:6},{t:.9,smile:-.4,open:.05},{t:.4,smile:P.baseSmile,open:0}],2);
      // büyük kazanç ve kayıp sahneleri
      case 'armsUp':case 'cheer':return P.play([{t:.45,L:'fistUp',R:'fistUp',lean:-.12,smile:1,open:.5,brow:.6,look:'human',spd:12},{t:1.1,laugh:1,smile:1,open:.5},{t:.6,L:bh[0],R:bh[1],laugh:0,open:0,brow:0,smile:P.baseSmile,lean:P.leanBase(),spd:6}],4);
      case 'standCheer':return P.play([{t:.7,L:'fistUp',R:'fistUp',lean:-.05,smile:1,open:.5,brow:.6,look:'human',spd:10,fn:()=>{P.standT=1;}},{t:1.5,laugh:1,smile:1,open:.5},{t:.8,L:bh[0],R:bh[1],laugh:0,open:0,brow:0,smile:P.baseSmile,spd:6,fn:()=>{P.standT=0;}}],4);
      case 'tableSlap':return P.play([{t:.3,R:'slamUp',smile:1,open:.5,brow:.5,spd:10},{t:.12,R:'slamDown',spd:32,fn:()=>{try{SFX.play('check');}catch(x){}}},{t:1.3,laugh:1,smile:1,open:.4,R:bh[1],look:'human',spd:5},{t:.4,laugh:0,open:0,brow:0,smile:P.baseSmile}],4);
      case 'chestPound':return P.play([{t:.5,R:'chest',lean:-.1,smile:.8,look:'human',brow:.3,spd:8},{t:1,rub:1},{t:.5,R:bh[1],rub:0,brow:0,smile:P.baseSmile,lean:P.leanBase(),spd:6}],4);
      case 'handsOnHead':return P.play([{t:.7,L:'behindHead',R:'behindHead',lean:-.18,look:'away',open:.3,brow:.6,spd:7},{t:2.2,breath:2.4},{t:.8,L:bh[0],R:bh[1],lean:P.leanBase(),open:0,brow:0,breath:1,spd:5}],4);
      case 'despair':return P.play([{t:.6,L:'faceL',R:'faceR',lean:.2,look:'down',brow:-.5,smile:-.6,spd:7},{t:1.9,breath:2.5},{t:.7,L:bh[0],R:bh[1],lean:P.leanBase(),brow:0,smile:P.baseSmile,breath:1,spd:5}],4);
      // kişiye özgü huylar
      case 'glassesPush':if(!(d.acc||[]).some(a=>a==='glasses'||a==='monocle'))return false;return P.play([{t:.45,R:'bridge',look:'down',spd:7},{t:.35,rub:1},{t:.45,R:bh[1],rub:0,look:'board',spd:6}],1);
      case 'touchChain':if(!(d.acc||[]).some(a=>a==='chain'||a==='pearls'||a==='pendant'))return false;return P.play([{t:.6,R:'chest',look:'board',spd:5},{t:1.1,rub:.5},{t:.6,R:bh[1],rub:0,spd:5}],1);
      case 'ringTwist':if(!(d.acc||[]).includes('rings'))return false;return P.play([{t:.6,L:'twist',R:'twist',look:'down',spd:6},{t:1.6,rub:1},{t:.5,L:bh[0],R:bh[1],rub:0,spd:6}],1);
      case 'hairTuck':return P.play([{t:.5,R:'hairSide',look:'away',spd:7},{t:.7,rub:.6},{t:.5,R:bh[1],rub:0,spd:6}],1);
      case 'shadesFlip':if(!(d.acc||[]).includes('sunglassesHead'))return false;return P.play([{t:.45,R:'scalp',look:'away',spd:8},{t:.6,nod:-.08},{t:.45,R:bh[1],nod:0,spd:6}],1);
      case 'tieAdjust':if(!d.tie)return false;return P.play([{t:.5,R:'chest',look:'down',spd:6},{t:.9,rub:.4},{t:.5,R:bh[1],rub:0,spd:6}],1);
      case 'pocketCheck':return P.play([{t:.5,R:'pocket',look:'down',lean:.04,spd:6},{t:1},{t:.5,R:bh[1],spd:6}],1);
      case 'chipRoll':return P.play([{t:.5,R:'chips',look:'chips',spd:8},{t:2.4,riffle:1,roll:1,look:'turn'},{t:.5,R:bh[1],riffle:0,roll:0,spd:6}],1);
      case 'hatTip':if(!d.hat)return false;return P.play([{t:.45,R:'brim',look:'human',nod:.12,smile:P.baseSmile+.2,spd:8},{t:.7},{t:.45,R:bh[1],nod:0,smile:P.baseSmile,spd:6}],2);
      case 'leave':P.leaving=W.t;P.seq=null;P.releaseAll();P.hk=['rest','rest'];P.from=root.position.clone();P.rot0=root.rotation.y;return true;
    }
    return false;
  };
  P.update=(dt,t)=>{
    if(!root.visible)return;
    if(P.leaving){
      const k=t-P.leaving;P.stand=cl(k/1.1,0,1);
      if(k>1.1)root.rotation.y=P.rot0+PI*eIO(cl((k-1.1)/.9,0,1));
      if(k>1.7){const dist=(k-1.7)*1.1;_t.set(Math.sin(P.rot0),0,Math.cos(P.rot0)).multiplyScalar(-dist);root.position.copy(P.from).add(_t);P.walk=1;P.walkPh=(k-1.7)*7.4;}
      if(k>5.6){root.visible=false;return;}
    }
    if(P.seq){P.seqT+=dt;const s=P.seq[P.si];if(P.seqT>=s.t){P.si++;P.seqT=0;if(P.si>=P.seq.length){P.seq=null;P.reset();}else P.apply(P.seq[P.si]);}}
    if(!P.seq)P.idle(t);
    // oturma ve kalkma: masaya varınca oturur, büyük kazançta ayağa kalkabilir
    if(P.sitAt!==undefined&&t>=P.sitAt){P.sitAt=undefined;P.standT=0;if(R()<.6){try{SFX.play('chair');}catch(e){}}}
    if(P.standT!==undefined&&!P.leaving){P.stand=damp(P.stand,P.standT,3.2,dt);if(P.standT===0&&P.stand<.01){P.stand=0;P.standT=undefined;}}
    const frz=t<P.freezeUntil?1:0,fid=P.fid*(1-frz*.92);
    let r=spring(P.lean,P.vlean,P.leanT,P.standing?3:3.4,dt);P.lean=r[0];P.vlean=r[1];
    r=spring(P.shrug,P.vshrug,P.shrugT,9,dt);P.shrug=r[0];P.vshrug=r[1];
    r=spring(P.nod,P.vnod,P.nodT,10,dt);P.nod=r[0];P.vnod=r[1];
    P.smile=damp(P.smile,P.smileT,6,dt);P.brow=damp(P.brow,P.browT,7,dt);P.open=damp(P.open,P.openT,12,dt);P.laughK=damp(P.laughK,P.laugh,8,dt);
    P.breath=damp(P.breath,frz?.2:P.breathT,3,dt);P.trem=damp(P.trem,t<P.tremUntil?1:0,6,dt);P.peek=damp(P.peek,P.peekT,8,dt);
    P.talk=damp(P.talk,t<P.talkUntil&&!frz?1:0,7,dt);
    if(P.tespih){if(t>P.tespihUntil)P.tespihSpd=damp(P.tespihSpd,1,2,dt);P.tespih.ph+=dt*P.tespihSpd*.55;}
    // gövde ve nefes
    const hy=lerp(.5,.95,P.stand);
    const br=Math.sin(t*(frz?1.1:1.6+(P.trem>.1?.9:0))+P.ph[0])*P.breath;
    P.spine.position.y=hy+br*.003;P.pelvis.position.y=hy;
    P.spine.rotation.x=P.lean*(1-P.stand*.5)+br*.006+P.laughK*Math.sin(t*14)*.012;
    P.spine.rotation.z=Math.sin(t*.37+P.ph[1])*.012*fid;
    P.torso.scale.x=1+br*.012;P.torso.scale.z=.72*(1+br*.02);
    for(let s=0;s<2;s++)P.sh[s].position.y=.44+P.shrug*.035+br*.003+P.laughK*Math.sin(t*14+s)*.012;
    // bakış: gözler önden gider, baş yalnızca rahat alan aşılınca döner
    P.lookW(P.look,_w);root.worldToLocal(_w);
    _h.set(0,P.spine.position.y+.68*Math.cos(P.lean),P.spine.position.z+.68*Math.sin(P.lean));
    const dx=_w.x-_h.x,dy=_w.y-_h.y,dz=_w.z-_h.z;
    const gy=cl(Math.atan2(dx,dz),-1.5,1.5),gp=cl(Math.atan2(-dy,Math.hypot(dx,dz)),-.6,.85);
    if(P.look!==P.lookPrev||Math.abs(gy-P.hTY)>.26||Math.abs(gp-P.hTP)>.17){
      if(Math.abs(gy-P.hTY)>.55)P.blinkK=.13;
      P.hTY=gy*.9;P.hTP=gp*.85;P.lookPrev=P.look;
    }
    const nz=(Math.sin(t*.7+P.ph[1])*.022+Math.sin(t*1.9+P.ph[2])*.01)*fid;
    const hw=frz?13:(P.npc?4:5)*(.85+.3*Math.min(1.5,P.expr));
    r=spring(P.hy,P.hvy,cl(P.hTY,-1.25,1.25)+nz,hw,dt);P.hy=r[0];P.hvy=r[1];
    r=spring(P.hp,P.hvp,P.hTP+nz*.5+P.talk*Math.sin(t*5.3)*.03,hw,dt);P.hp=r[0];P.hvp=r[1];
    r=spring(P.sy,P.svy,cl(P.hy*.35,-.4,.4),2.4,dt);P.sy=r[0];P.svy=r[1];
    P.spine.rotation.y=P.sy;
    P.head.rotation.y=P.hy-P.sy+(P.shake?Math.sin(t*P.shakeF)*P.shakeA:0);
    P.head.rotation.x=P.hp-P.spine.rotation.x+P.nod+P.laughK*Math.sin(t*13)*.05;
    if(t>P.saccT){P.saccT=t+.5+R()*2;P.sacc=[(R()-.5)*.1*fid,(R()-.5)*.07*fid];}
    r=spring(P.ey,P.evy,cl(gy-P.hy,-.5,.5)+P.sacc[0],30,dt);P.ey=r[0];P.evy=r[1];
    r=spring(P.ep,P.evp,cl(gp-P.hp-P.nod,-.35,.35)+P.sacc[1],30,dt);P.ep=r[0];P.evp=r[1];
    if(t>P.blinkT){P.blinkK=.12;P.blinkT=t+(frz?.8+R()*1.1:2+R()*4);}
    P.blinkK=Math.max(0,P.blinkK-dt);
    P.squint=damp(P.squint,P.squintT,9,dt);P.brow1=damp(P.brow1,P.brow1T,8,dt);P.smirk=damp(P.smirk,P.smirkT,7,dt);
    const lid=P.blinkK>0?1.35:-.5+Math.max(0,P.ep)*.8+Math.max(0,-P.brow)*.18+(P.talk>.5?.05:0)+P.squint*.38;
    for(let i=0;i<2;i++){const e=P.eyes[i];e.rotation.y=P.ey;e.rotation.x=P.ep;P.lids[i].rotation.x=lid;}
    P.mouth.scale.set(P.mw*(1+P.talk*.16*Math.sin(t*8.3)),Math.abs(P.smile)<.06?.06:P.smile,1);P.mouth.rotation.z=PI+P.smirk*.3;P.mouth.position.x=P.smirk*.006;
    P.gulpK=Math.max(0,P.gulpK-dt*2.4);P.adam.position.y=.505-Math.sin(P.gulpK*PI)*.03;
    P.pupK=damp(P.pupK,1+.28*Math.max(0,P.brow)+.15*P.open-.2*Math.max(0,-P.brow)-(P.trem>.2?.1:0),10,dt);P.pup.forEach(u=>u.scale.set(P.pupK,P.pupK,.35));
    if(P.talk>.05)P.face.rotation.z=Math.sin(t*1.9+P.ph[0])*.045*P.talk;else P.face.rotation.z*=.9;
    P.mo.scale.y=.05+P.talk*Math.abs(Math.sin(t*11+P.ph[1]))*(.55+.25*Math.sin(t*3.7))+P.open*.75;
    const tb=P.talk>.05?P.talk*Math.max(0,Math.sin(t*2.7+P.ph[2]))*.55:0;   // konuşurken vurgu yapan kaş
    P.brows.forEach((b,i)=>{const bv=P.brow+tb+(i?0:P.brow1);b.rotation.z=(i?-1:1)*bv*.28;b.position.y=.046+Math.max(0,bv)*.007-Math.max(0,-bv)*.004;});
    root.updateMatrixWorld(true);
    // kollar: yaylı el hedefi + uzak hedefe yay çizerek gitme + IK
    for(let s=0;s<2;s++){
      const key=P.hk[s];_t3.copy(P.handPt(key,s));
      const c=P.hc[s],dist=Math.hypot(_t3.x-c.x,_t3.z-c.z);
      if(!(typeof key==='string'&&key.endsWith('Down')))_t3.y+=Math.min(.07,dist*.32);
      springV(c,P.hv[s],_t3,P.hw[s],dt);
      _h.copy(c);
      if(key==='rest'){_h.x+=Math.sin(t*.9+P.ph[s])*.004*fid;_h.z+=Math.sin(t*.7+P.ph[2]+s)*.004*fid;}
      if(P.gest&&P.talk>.05&&key==='rest'&&(s===1||P.gest2)){const k2=s===1?1:.7;_h.y+=P.talk*(.035+Math.sin(t*3.1+s*1.7)*.025)*k2;_h.z+=P.talk*.03*Math.sin(t*2.3+s)*k2;}
      if(P.trem>.02){const a=P.trem*.007;_h.x+=Math.sin(t*43+s*2)*a;_h.y+=Math.sin(t*51+s)*a;_h.z+=Math.sin(t*37)*a;}
      if(P.riffle&&s===1)_h.y+=Math.abs(Math.sin(t*13))*.013;
      if(P.rub&&s===1)_h.x+=Math.sin(t*7)*.02;
      if(P.wipe&&s===1){_h.x+=Math.sin(t*4)*.08;_h.z+=Math.cos(t*4)*.05;}
      if(s===1&&key==='tespih')_h.y+=Math.sin(t*1.3+P.ph[0])*.006;
      if(P.walk&&(s===1||!P.trayObj))_h.z+=Math.sin(P.walkPh+(s?0:PI))*.13;
      P.sh[s].getWorldPosition(_e);root.worldToLocal(_e);const S=_e.clone();
      ik(S,_h,P.ua,P.fa,POLE[s],_e);
      place(P.up[s],S,_e);place(P.fo[s],_e,_h);P.el[s].position.copy(_e);
      P.hand[s].position.copy(_h);_t.subVectors(_h,_e).normalize();P.hand[s].quaternion.setFromUnitVectors(_Z,_t);
      if(s===1&&P.roll)P.hand[1].rotateZ(Math.sin(t*9)*.7);
      if(s===0&&P.watch){P.watch.position.lerpVectors(_e,_h,.86);P.watch.quaternion.copy(P.fo[0].quaternion);}
    }
    // taşınan fiş/kart
    if(P.carry){const j=P.carry;P.hand[0].updateMatrixWorld();P.hand[1].updateMatrixWorld();P.handW(_w,j.hands);
      if(j.type==='pile'){j.off.multiplyScalar(Math.exp(-6*dt));j.pile.g.position.set(_w.x+j.off.x,TY,_w.z+j.off.z);}
      else j.cards.forEach((cd,i)=>{if(cd.swept)return;cd.st.pos.set(_w.x+j.off[i].x,TY+.003+i*.0008,_w.z+j.off[i].z);cd.st.lift=0;});}
    // bacaklar
    for(let i=0;i<2;i++){
      const L=P.leg[i],sx=(i?-1:1)*.095*P.bw;
      _a.set(sx,lerp(.49,.9,P.stand),-.03);_b.set(sx*1.05,.5,lerp(.42,.03,P.stand));_e.set(sx*1.05,.06,lerp(.47,-.02,P.stand));
      if(P.walk){const ph=Math.sin(P.walkPh+(i?PI:0));_b.z+=ph*.12;_e.z+=ph*.2;_e.y+=Math.max(0,-ph)*.05;}
      place(L.th,_a,_b);place(L.sh,_b,_e);L.kn.position.copy(_b);L.ft.position.set(_e.x,.03,_e.z+.05);
    }
    // eldeki eşyalar
    if(P.hold[0]){P.hand[0].updateMatrixWorld();P.hand[0].localToWorld(_t.set(0,-.035,.075));P.hold[0].g.position.copy(_t);if(P.hold[0]===P.phone)P.hand[0].getWorldQuaternion(P.phone.g.quaternion);}
    else{if(P.cup&&P.cup.g.position.distanceToSquared(P.cup.home)>1e-6)P.cup.g.position.lerp(P.cup.home,1-Math.exp(-14*dt));if(P.phone&&P.phone.g.position.distanceToSquared(P.phone.home)>1e-6){P.phone.g.position.lerp(P.phone.home,1-Math.exp(-14*dt));P.phone.g.quaternion.slerp(P.phone.q0,1-Math.exp(-10*dt));}}
    if(P.tespih){const {im,n,ph}=P.tespih;for(let i=0;i<n;i++){const a=(i/n)*TAU+ph;_m.makeTranslation(Math.sin(a)*.026,-.064*(1-Math.cos(a))-.004,.085);im.setMatrixAt(i,_m);}im.instanceMatrix.needsUpdate=true;}
    if(P.cig&&W.smoke){P.smokeT-=dt;if(P.smokeT<=0){P.smokeT=.32;P.cig.tip.getWorldPosition(_t);W.smoke.emit(_t,.006,.035,2.4,.18);}
      if(P.exhale&&t>P.exhale){P.exhale=0;P.face.localToWorld(_t.set(0,-.05,.13));for(let i=0;i<9;i++)W.smoke.emit(_t,.03,.12+R()*.05,2.6,.32,P.root.getWorldDirection(_t2).multiplyScalar(.12));}}
  };
  return P;
}
function attachProps(P,S,d){
  const props=(d.props||[]).filter(k=>!['tespih','cigarette','cigar'].includes(k));
  const slots=[[.33,.6],[.25,.7],[.42,.5]];let si=0;
  for(const k of props){
    let lp;
    if(k==='ashtray')lp=[-.37,.62];else if(k==='phone')lp=[.16,.62];else{lp=slots[Math.min(si,2)];si++;}
    const g=makeProp(k);const w=S.o.localToWorld(V3(lp[0],TY,lp[1]*(S.propK||1)));g.position.copy(w);g.rotation.y=S.o.rotation.y+(k==='phone'?.3:0);W.scene.add(g);
    const it={g,home:w.clone(),q0:g.quaternion.clone()};
    if(k==='phone')P.phone=it;
    else if(k!=='ashtray'&&!P.cup)P.cup=it;
  }
}

/* ---------- arka plan figürleri ---------- */
const SKINS=['#f0d2bc','#e8c2a6','#d9a982','#c99272','#a8714e','#7a4f36'],HAIRC=['#1a120c','#2b1b12','#4a2e1a','#6b4a2e','#a3824e','#cfc6b8'];
function npcDef(kind){
  const f=kind==='waitress'?true:(kind==='waiter'||kind==='bartender')?false:R()<.45;
  const hc=pick1(HAIRC),d={sex:f?'f':'m',age:25+Math.floor(R()*40),skin:pick1(SKINS),build:.9+R()*.25,expr:.9+R()*.4,hair:[f?pick1(['long','bun','bob','updo','ponytail','bangs','braid']):pick1(['short','slick','balding','short','sidepart','buzz']),hc]};
  const tier=venueTier();
  if(kind==='waiter'||kind==='bartender'){d.top=['vest','#f4f1ea',pick1(['#151515','#5a0d14','#1d3a3c'])];d.tie=['bow','#111'];}
  else if(kind==='waitress'){d.top=['vest','#f4f1ea','#7a1020'];d.tie=['bow','#111'];}
  else if(kind==='elegant'){if(f){d.top=['dress',pick1(['#14141a','#5a1a2a','#1d2a4a','#3a2a4a'])];d.acc=['pearls','earrings'];}else{d.top=['tux','#111114','#f6f4ee'];d.tie=['bow','#0b0b0d'];}}
  else if(kind==='tourist'){d.top=f?[pick1(['dress','blazer']),pick1(['#c2185b','#1e88e5','#f9a825','#00897b'])]:[pick1(['hawaii','tshirt','shirt']),pick1(['#1f8a9b','#e0b33c','#b8352a','#3e5f86'])];if(R()<.4)d.hat=['cap',pick1(['#222','#b8352a','#1e3a6a'])];}
  else if(tier<0){   // yıpranmış mekân: sade, eskimiş giysiler, kasket ve bere
    d.top=[f?pick1(['cardigan','blazer']):pick1(['jacket','linen','hoodie','cardigan','polo','shirt']),pick1(['#6b5f4a','#4a3a2a','#5b4b3a','#3d5a76','#6a3a3a','#7b7468'])];
    if(!f&&R()<.45)d.hat=[pick1(['flatcap','cap','beanie']),pick1(['#4a4339','#2b2b30','#6a3a2a'])];
    if(R()<.25)d.acc=['glasses'];
  }else if(tier>0){   // gösterişli salon: takım, smokin, mücevher
    if(f){d.top=['dress',pick1(['#14141a','#5a1a2a','#1d2a4a','#3a2a4a','#8e1424'])];d.acc=pick1([['pearls','earrings'],['pendant','earrings'],['brooch','earrings'],['chain','earrings','bracelet']]);}
    else{d.top=[pick1(['suit','tux','blazer']),pick1(['#101014','#1b2538','#2b2b30','#3b3f6b']),'#f2efe8'];if(R()<.3)d.top[3]='pin';d.tie=['tie',pick1(['#7a1d2a','#28406b','#c9a227'])];d.hair[0]=pick1(['slick','sidepart','short']);d.acc=pick1([['watch'],['watch','rings'],['pocketRed','watch'],['lapelFlower'],['tieclip','watch']]);if(R()<.2)d.hat=['fedora','#1a1816'];}
  }
  else d.top=[f?pick1(['dress','blazer']):pick1(['suit','linen','blazer','jacket']),pick1(['#2b2b30','#3b3f6b','#6b6b6e','#ece6d8','#4a3a2a'])];
  if(!f&&R()<.35)d.face=[pick1(['mustache','beard','stubble']),hc];
  return d;
}
function addNPC(d,o){
  if(Q()==='low')return null;
  const P=makePerson(d,{idx:-2,standing:!!o.standing,npc:o.mode,style:'gevsek'});
  P.root.position.copy(o.pos);P.root.rotation.y=o.yaw||0;W.scene.add(P.root);
  if(!o.path&&W.obst)W.obst.push({x:o.pos.x,z:o.pos.z,r:.42});
  P.root.traverse(m=>{if(m.isMesh)m.castShadow=false;});
  if(o.rest)P.restOverride=o.rest;
  P.npcLean=o.lean||0;
  P.baseLook=o.look?(o.look.isVector3?{k:'w',v:o.look.clone()}:o.look):{k:'w',v:V3(0,1.1,0)};
  P.reset();P.init();
  if(o.tray){const tr=new T.Group();tr.add(mesh(cyl(.17,.17,.012,22),mat('#c9c9c9',{metalness:.8,roughness:.3}),false));for(let i=0;i<2;i++){const g=makeProp(o.tray);g.position.set(-.05+i*.09,.006,i?.04:-.03);tr.add(g);}W.scene.add(tr);P.trayObj=tr;P.trayKind=o.tray;}
  if(o.path){P.path=o.path;P.pathLen=o.path.getLength();P.pathU=R();P.speed=o.speed||.62;P.walk=1;}
  P.npcIdle=o.idle||(()=>{const r=R();if(r<.55)P.play([{t:2+R()*3,look:'base'}],1);else if(r<.8)P.play([{t:1.5+R()*2,look:'away'}],1);else P.play([{t:1.6,look:{k:'w',v:V3(0,1.1,0)}}],1);});
  W.npcs.push(P);return P;
}
// Garson servisi: arada bir yürüyüş rotasından çıkıp bir oyuncunun yanına gider, içeceği masaya bırakır, rotasına döner.
function serveTick(P,dt,t){
  if(!P.trayObj||!P.trayKind||P.leaving||!W.seats)return false;
  P.cups=(P.cups||[]).filter(c=>{if(t>c.until){W.scene.remove(c.g);return false;}return true;});
  if(!P.sv){
    if(P.svNext===undefined)P.svNext=t+14+R()*16;
    if(t<P.svNext)return false;
    const c=W.seats.filter((S,i)=>i>0&&S&&S.person&&S.person.root.visible&&!(S.p&&S.p.out));
    if(!c.length){P.svNext=t+15;return false;}
    const S=pick1(c),pp=S.person.root.position,r=Math.hypot(pp.x,pp.z)||1;
    const ox=pp.x/r,oz=pp.z/r,tg=V3(pp.x+ox*.95-oz*.55,0,pp.z+oz*.95+ox*.55);
    // masadan geçmesin: önce halka rotası üzerinde oyuncuya en yakın noktaya yürür, sonra kısa mesafe içeri girer
    let bu=0,bd=1e9;for(let i=0;i<96;i++){P.path.getPointAt(i/96,_a);const d=Math.hypot(_a.x-tg.x,_a.z-tg.z);if(d<bd){bd=d;bu=i/96;}}
    P.path.getPointAt(bu,_a);const dx=bu-P.pathU,du=dx-Math.round(dx);
    P.sv={ph:'along',S,tg,u:bu,home:V3(_a.x,0,_a.z),dir:du>=0?1:-1,wait:0};
  }
  const sv=P.sv,pos=P.root.position;
  if(sv.ph==='along'){
    const dx=sv.u-P.pathU,rem=Math.abs(dx-Math.round(dx)),step=(P.speed||.62)*1.1*dt/P.pathLen;
    if(rem<=step){P.pathU=sv.u;sv.ph='go';}else P.pathU=(P.pathU+sv.dir*step+1)%1;
    P.path.getPointAt(P.pathU,_a);pos.set(_a.x,0,_a.z);P.path.getTangentAt(P.pathU,_b);P.root.rotation.y=Math.atan2(_b.x*sv.dir,_b.z*sv.dir);
    P.walk=1;P.walkPh+=dt*7.4;return true;
  }
  if(sv.ph==='go'||sv.ph==='back'){
    const tg=sv.ph==='go'?sv.tg:sv.home;_t.set(tg.x-pos.x,0,tg.z-pos.z);const d=_t.length();
    if(d<.12){
      if(sv.ph==='go'){sv.ph='serve';sv.wait=0;}
      else{P.sv=null;P.pathU=sv.u;P.svNext=t+30+R()*35;return false;}
    }else{
      _t.multiplyScalar(1/d);const st=Math.min((P.speed||.62)*1.1*dt,d);pos.x+=_t.x*st;pos.z+=_t.z*st;
      let dy=Math.atan2(_t.x,_t.z)-P.root.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));P.root.rotation.y+=dy*Math.min(1,dt*6);
      P.walk=1;P.walkPh+=dt*7.4;return true;
    }
  }
  // servis: oyuncuya dön, içeceği bırak
  P.walk=0;sv.wait+=dt;
  const pp=sv.S.person.root.position;let dy=Math.atan2(pp.x-pos.x,pp.z-pos.z)-P.root.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));P.root.rotation.y+=dy*Math.min(1,dt*6);
  if(sv.wait>.3&&!sv.began){sv.began=true;P.play([{t:1.7,look:{k:'np',p:sv.S.person},lean:.1}],2);}
  if(sv.wait>1&&!sv.did){
    sv.did=true;
    const g=makeProp(P.trayKind),S=sv.S;g.position.copy(S.o.localToWorld(V3(.52,TY,.5)));g.rotation.y=S.o.rotation.y;W.scene.add(g);
    (P.cups=P.cups||[]).push({g,until:t+28});
    if(!S.person.seq)S.person.act('nod');
    try{SFX.play('clink');}catch(e){}
  }
  if(sv.wait>2)sv.ph='back';
  return true;
}
// Garsonlar masaya, sandalyeye, piyanoya ya da ayakta duran kişilere çarpmasın: engel dairelerinin ve ana masa elipsinin dışına itilir.
function avoidObst(pos){
  const a=RXo+.9,b=RZo+.9;
  for(let k=0;k<2;k++){
    const e=(pos.x/a)**2+(pos.z/b)**2;if(e<1){const f=1/Math.sqrt(Math.max(e,1e-6));pos.x*=f;pos.z*=f;}
    for(const o of W.obst||[]){const dx=pos.x-o.x,dz=pos.z-o.z,d=Math.hypot(dx,dz);if(d<o.r){const f=d>1e-4?o.r/d:0;if(f){pos.x=o.x+dx*f;pos.z=o.z+dz*f;}else pos.x=o.x+o.r;}}
  }
}
function updNPC(P,dt,t){
  let served=false;try{served=serveTick(P,dt,t);}catch(e){P.svNext=1e9;P.sv=null;}
  if(P.path&&!served){P.pathU=(P.pathU+dt*P.speed/P.pathLen)%1;P.path.getPointAt(P.pathU,_a);P.root.position.set(_a.x,0,_a.z);P.path.getTangentAt(P.pathU,_b);P.root.rotation.y=Math.atan2(_b.x,_b.z);P.walkPh+=dt*7.4;}
  if(P.path)avoidObst(P.root.position);
  P.update(dt,t);
  if(P.trayObj){P.hand[0].localToWorld(_a.set(0,.03,.07));P.trayObj.position.copy(_a);P.trayObj.rotation.set(0,P.root.rotation.y,0);}
}
function stool(x,z,h=.6){const g=new T.Group();const s=mesh(cyl(.19,.19,.06,18),mat('#3a1a22',{roughness:.6}));s.position.y=h;g.add(s);const p=mesh(cyl(.03,.04,h,8),mat('#2a2a2a',{metalness:.6,roughness:.4}));p.position.y=h/2;g.add(p);const b=mesh(cyl(.2,.22,.03,16),mat('#2a2a2a',{metalness:.6,roughness:.4}));b.position.y=.015;g.add(b);g.position.set(x,0,z);W.scene.add(g);return g;}
function loopPath(hx,hz){return new T.CatmullRomCurve3([V3(-hx,0,-hz),V3(0,0,-hz-.3),V3(hx,0,-hz),V3(hx+.3,0,0),V3(hx,0,hz),V3(0,0,hz+.3),V3(-hx,0,hz),V3(-hx-.3,0,0)],true);}

/* ---------- duman, toz, ışık konisi ---------- */
function smokeSys(n){
  const tex=smokeTex();const list=[];
  for(let i=0;i<n;i++){const m=new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,opacity:0,color:'#d9d6d0'});W.disp.push(m);const s=new T.Sprite(m);s.visible=false;W.scene.add(s);list.push({s,life:0,max:1,v:V3(),g:0,s0:.02});}
  let k=0;
  return {
    emit(p,s0,grow,life,op,vel){const it=list[k++%n];it.s.visible=true;it.s.position.copy(p);it.life=0;it.max=life*(.7+R()*.6);it.s0=s0;it.g=grow;it.op=op;it.v.set((R()-.5)*.02,.06+R()*.04,(R()-.5)*.02);if(vel)it.v.add(vel);it.s.material.rotation=R()*TAU;},
    update(dt){for(const it of list){if(!it.s.visible)continue;it.life+=dt;const k=it.life/it.max;if(k>=1){it.s.visible=false;continue;}it.s.position.addScaledVector(it.v,dt);it.v.multiplyScalar(1-dt*.4);it.v.x+=Math.sin(it.life*2+it.s.position.y*9)*.004;const sz=it.s0+it.g*k;it.s.scale.set(sz,sz,sz);it.s.material.opacity=it.op*Math.sin(PI*Math.min(1,k*1.4))*(1-k);}}
  };
}
function lightCone(V){
  // Dumanlı havada lambanın altındaki ışık hüzmesi
  const L=V.lamp,top=L.bulb?.06:.38,hgt=L.y-TY-.02;
  const tex=ctex(8,128,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
  const m=new T.MeshBasicMaterial({map:tex,color:L.c,transparent:true,opacity:V.cone,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false});W.disp.push(m);
  const c=new T.Mesh(new T.CylinderGeometry(top,1.35,hgt,40,1,true),m);c.position.y=TY+.02+hgt/2;W.scene.add(c);W.cone=c;
}
function dust(V){
  const n=Q()==='high'?420:220,y0=TY+.08,y1=V.lamp.y-.05;
  const g=new T.BufferGeometry(),p=new Float32Array(n*3);
  for(let i=0;i<n;i++){const a=R()*TAU,rr=Math.sqrt(R())*1.15;p[i*3]=Math.cos(a)*rr;p[i*3+1]=y0+R()*(y1-y0);p[i*3+2]=Math.sin(a)*rr;}
  g.setAttribute('position',new T.BufferAttribute(p,3));
  const m=new T.PointsMaterial({map:glowTex(),color:V.lamp.c,size:.011,transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending});W.disp.push(m);
  const pts=new T.Points(g,m);W.scene.add(pts);
  W.upd.push((dt,t)=>{const a=g.attributes.position;for(let i=0;i<n;i++){let y=a.getY(i)+dt*(.006+Math.sin(i*1.7+t*.25)*.008);if(y>y1)y=y0;a.setY(i,y);a.setX(i,a.getX(i)+Math.sin(t*.21+i)*dt*.005);a.setZ(i,a.getZ(i)+Math.cos(t*.17+i*1.3)*dt*.005);}a.needsUpdate=true;});
}

/* ---------- oda ---------- */
function boxM(x,y,z,m,px,py,pz,ry=0){const o=mesh(box(x,y,z),m);o.position.set(px,py,pz);o.rotation.y=ry;W.scene.add(o);return o;}
function buildRoom(V,id){
  const [w,d,h]=V.room;
  const fl=floorTex(V.floor);fl.wrapS=fl.wrapT=T.RepeatWrapping;fl.repeat.set(w/(/marble/.test(V.floor)?1.6:2.2),d/(/marble/.test(V.floor)?1.6:2.2));
  const floor=new T.Mesh(new T.PlaneGeometry(w,d),tmat(fl,{roughness:/marble/.test(V.floor)?.22:.92}));floor.rotation.x=-PI/2;floor.receiveShadow=true;W.scene.add(floor);
  const ceil=new T.Mesh(new T.PlaneGeometry(w,d),mat(id==='kacak'?'#3b3833':'#16120f',{roughness:1}));ceil.rotation.x=PI/2;ceil.position.y=h;W.scene.add(ceil);
  const wt=wallTex(V.wall);wt.wrapS=T.RepeatWrapping;
  for(let i=0;i<4;i++){const L=i%2?d:w;const t=wt.clone();t.needsUpdate=true;t.repeat.set(L/2.6,1);W.disp.push(t);const m=new T.Mesh(new T.PlaneGeometry(L,h),tmat(t,{roughness:.92}));const a=i*PI/2;m.position.set(-Math.sin(a)*(i%2?w/2:d/2),h/2,-Math.cos(a)*(i%2?w/2:d/2));m.rotation.y=a;m.receiveShadow=true;W.scene.add(m);}
  W.scene.add(new T.HemisphereLight('#ffe7cf','#120d0a',V.hemi));
  // masanın lambası: geniş ve yumuşak kenarlı; ortası parlamasın, kartlar her yerde okunsun
  const L=V.lamp,gq=Q();
  const spot=new T.SpotLight(L.c,L.i,9,1.0,.85,1.6);spot.position.set(0,L.y,0);spot.target.position.set(0,0,0);
  spot.castShadow=gq!=='low';const ms=gq==='high'?2048:1024;spot.shadow.mapSize.set(ms,ms);spot.shadow.bias=-.0004;spot.shadow.normalBias=.02;spot.shadow.camera.near=.3;spot.shadow.camera.far=6;
  W.scene.add(spot,spot.target);W.spot=spot;
  // yüzler için yumuşak dolgu: arkandaki odadan gelen ışık, karşındakilerin yüzünü okunur kılar
  const fill=new T.PointLight(L.c,(V.fill||3)*7,9,2);fill.position.set(0,1.9,2.2);W.scene.add(fill);
  const fill2=new T.PointLight(L.c,(V.fill||3)*3,8,2);fill2.position.set(0,1.7,-2.4);W.scene.add(fill2);
  if(L.bulb){
    const piv=new T.Group();piv.position.set(0,h,0);W.scene.add(piv);
    const cord=mesh(cyl(.004,.004,h-L.y,5),mat('#111'),false);cord.position.y=-(h-L.y)/2;piv.add(cord);
    const bulb=mesh(sph(.045,14,10),mat('#fff3d6',{emissive:'#ffd38a',emissiveIntensity:6}),false);bulb.position.y=-(h-L.y)-.04;piv.add(bulb);
    const sock=mesh(cyl(.02,.02,.05,10),mat('#2a2a2a'),false);sock.position.y=-(h-L.y)+.01;piv.add(sock);
    const pl=new T.PointLight('#ffc57a',2.2,6,2);bulb.add(pl);
    const g1=glow('#ffcf8a',.45,V3(),.75),g2=glow('#ffb860',1.4,V3(),.18);
    W.upd.push((dt,t)=>{piv.rotation.z=Math.sin(t*.55)*.045;piv.rotation.x=Math.sin(t*.37)*.03;bulb.getWorldPosition(_t);spot.position.copy(_t);spot.target.position.set(_t.x*1.6,0,_t.z*1.6);g1.position.copy(_t);g2.position.copy(_t);if(W.cone){W.cone.position.x=_t.x*.5;W.cone.position.z=_t.z*.5;W.cone.rotation.z=-piv.rotation.z*.5;W.cone.rotation.x=piv.rotation.x*.5;}});
  }else{
    const sh=mesh(geo('lampshade',()=>new T.ConeGeometry(.42,.24,28,1,true)),mat(L.shade||'#1a1a1a',{roughness:.6,side:T.DoubleSide}),false);sh.position.set(0,L.y+.12,0);W.scene.add(sh);
    const inner=mesh(geo('lampin',()=>new T.CircleGeometry(.4,28)),mat('#fff6e2',{emissive:L.c,emissiveIntensity:2.2}),false);inner.rotation.x=PI/2;inner.position.set(0,L.y+.005,0);W.scene.add(inner);
    const rod=mesh(cyl(.006,.006,h-L.y-.24,6),GOLD(),false);rod.position.set(0,(h+L.y+.24)/2,0);W.scene.add(rod);
    spot.position.y=L.y+.05;
  }
  if(V.cone&&gq!=='low')lightCone(V);
  if(V.dust&&gq!=='low')dust(V);
  const deco={kacak:decoKacak,kiraathane:decoKiraathane,yeralti:decoYeralti,han:decoHan,yali:decoYali,girne:decoGirne,monte:decoMonte,macau:decoMacau,vegas:decoVegas,suit:decoSuit,antrenman:decoTrain}[id];
  if(deco)deco(V,w,d,h);
}
function decoKacak(V,w,d,h){
  const pipeM=mat('#4a4844',{roughness:.5,metalness:.5});
  for(const x of[-1.4,1.9]){const p=mesh(cyl(.05,.05,d,10),pipeM);p.rotation.x=PI/2;p.position.set(x,h-.14,0);W.scene.add(p);}
  const crate=tmat(floorTex('wood'),{roughness:.9});
  boxM(.6,.4,.45,crate,w/2-.5,.2,-d/2+.5);boxM(.6,.4,.45,crate,w/2-.55,.6,-d/2+.48,.1);boxM(.6,.4,.45,crate,w/2-1.2,.2,-d/2+.45,-.05);
  // eski radyo kasaların üstünde
  const rad=boxM(.34,.2,.14,mat('#5a3b22',{roughness:.6}),w/2-.55,.9,-d/2+.5,.1);
  const grill=mesh(new T.PlaneGeometry(.18,.12),mat('#c9b48a',{roughness:.9}),false);grill.position.set(-.06,0,.071);rad.add(grill);
  const dial=mesh(cyl(.025,.025,.02,14),mat('#e9dcc0'),false);dial.rotation.x=PI/2;dial.position.set(.1,0,.075);rad.add(dial);
  boxM(1,2.1,.08,mat('#3a2a1c',{roughness:.8}),-2.6,1.05,d/2-.04);
  const leak=mesh(box(.9,.02,.02),mat('#ffd9a0',{emissive:'#ffbf70',emissiveIntensity:3}),false);leak.position.set(-2.6,.01,d/2-.06);W.scene.add(leak);
  const pl=new T.PointLight('#ffbf70',.6,3,2);pl.position.set(-2.6,.2,d/2-.3);W.scene.add(pl);
  // kapının yanında çivide asılı palto
  const coat=boxM(.42,.85,.08,mat('#2e2620',{roughness:.95}),-1.75,1.35,d/2-.07);coat.rotation.z=.04;
  boxM(.03,.03,.06,mat('#999',{metalness:.7}),-1.75,1.8,d/2-.04);
  // çay ocağı
  boxM(.5,.8,.4,mat('#5a5048',{roughness:.7}),-w/2+.4,.4,-1.9);
  const kettle=mesh(cyl(.08,.1,.16,14),mat('#b8b3a8',{metalness:.7,roughness:.3}));kettle.position.set(-w/2+.4,.88,-1.9);W.scene.add(kettle);
  const k2=mesh(cyl(.06,.075,.12,14),mat('#b8b3a8',{metalness:.7,roughness:.3}));k2.position.set(-w/2+.4,1.02,-1.9);W.scene.add(k2);
  W.upd.push(()=>{if(R()<.02)W.smoke.emit(V3(-w/2+.4,1.1,-1.9),.03,.15,3,.12);});
  W.upd.push((dt)=>{if(R()<dt*1.2)W.smoke.emit(V3((R()-.5)*2.4,1.5+R()*.6,(R()-.5)*1.8),.5,1.4,9,.06);});
  const cal=mesh(new T.PlaneGeometry(.42,.6),tmat(ctex(256,360,(x,w2,h2)=>{x.fillStyle='#e9e1cc';x.fillRect(0,0,w2,h2);x.fillStyle='#b8322b';x.fillRect(0,0,w2,90);x.fillStyle='#fff';x.font='bold 46px Georgia';x.textAlign='center';x.fillText('1994',w2/2,62);x.fillStyle='#333';x.font='22px Georgia';for(let r=0;r<5;r++)for(let c=0;c<7;c++)x.fillText(String(r*7+c+1>31?'':r*7+c+1),24+c*34,130+r*44);speckle(x,w2,h2,3000,.15,2);})),false);cal.position.set(1.4,1.55,-d/2+.02);W.scene.add(cal);
  // yüksekte parmaklıklı sokak penceresi: turuncu sokak lambası, ara sıra geçen arabanın farı
  const wx=-w/2+.02,wz=-.4;
  const win=new T.Mesh(new T.PlaneGeometry(.9,.42),new T.MeshBasicMaterial({color:'#ffae5c'}));win.position.set(wx,2.06,wz);win.rotation.y=PI/2;W.scene.add(win);W.disp.push(win.material);
  const barM=mat('#1b1b1b',{metalness:.6,roughness:.4});
  for(let i=0;i<6;i++){const b=mesh(cyl(.008,.008,.42,6),barM,false);b.position.set(wx+.035,2.06,wz-.38+i*.152);W.scene.add(b);}
  boxM(.07,.06,1,mat('#2a2622'),wx+.02,2.3,wz);boxM(.07,.06,1,mat('#2a2622'),wx+.02,1.82,wz);
  glow('#ffb060',1.3,V3(wx+.08,2.06,wz),.3);
  const sl=new T.SpotLight('#ff9a40',7,9,.6,.9,1.5);sl.position.set(wx+.08,2.06,wz);sl.target.position.set(2,.3,wz+.6);W.scene.add(sl,sl.target);
  const car=new T.SpotLight('#eef0ff',0,10,.45,.9,1.4);car.position.set(wx+.08,2.06,wz);W.scene.add(car,car.target);
  let next=7+R()*8,ct=-1;
  W.upd.push((dt,t)=>{if(ct<0&&t>next){ct=0;try{SFX.play('car');}catch(e){}}if(ct>=0){ct+=dt;const k=ct/2.8;car.intensity=Math.sin(PI*Math.min(1,k))*16;car.target.position.set(3.2,2.3-k*.6,wz-3+k*6);if(k>=1){ct=-1;next=t+16+R()*24;car.intensity=0;}}});
}
function curtain(len,h,col,x,z,ry){
  const g=new T.PlaneGeometry(len,h,Math.round(len*24),1);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*14)*.05);g.computeVertexNormals();
  const m=new T.Mesh(g,mat(col,{roughness:.95,side:T.DoubleSide}));m.position.set(x,h/2,z);m.rotation.y=ry;m.receiveShadow=true;W.scene.add(m);
}
function decoYeralti(V,w,d,h){
  curtain(w-.4,h,'#5a0f18',0,-d/2+.18,0);curtain(d-.4,h,'#5a0f18',-w/2+.18,0,PI/2);
  const wood=mat('#3a2416',{roughness:.7});
  for(let i=0;i<3;i++)boxM(2,.04,.3,wood,w/2-.2,1.1+i*.45,-1,PI/2);
  const bc=['#2c5a2a','#6b4a1a','#e8e0c8','#1a3a2a','#7a2a1a'];
  for(let i=0;i<3;i++)for(let k=0;k<6;k++){const b=mesh(cyl(.035,.035,.26,10),mat(bc[(i+k)%5],{roughness:.15,transparent:true,opacity:.85}),false);b.position.set(w/2-.22,1.25+i*.45,-1.8+k*.3);W.scene.add(b);}
  boxM(.6,.75,.45,wood,w/2-.5,.375,1.6);
  const horn=mesh(geo('horn',()=>new T.ConeGeometry(.2,.35,20,1,true)),mat('#b8862e',{metalness:.8,roughness:.3,side:T.DoubleSide}),false);horn.position.set(w/2-.55,1.1,1.55);horn.rotation.set(0,0,PI/2+.5);W.scene.add(horn);
  boxM(.35,.12,.35,mat('#2a1810'),w/2-.5,.81,1.6);
  const rug=new T.Mesh(new T.PlaneGeometry(4.6,3.6),tmat(ctex(512,400,(x,w2,h2)=>{x.fillStyle='#5a1414';x.fillRect(0,0,w2,h2);x.strokeStyle='#c9a35a';x.lineWidth=10;x.strokeRect(20,20,w2-40,h2-40);x.strokeStyle='#1d2a4a';x.lineWidth=16;x.strokeRect(46,46,w2-92,h2-92);x.fillStyle='rgba(201,163,90,.5)';for(let i=0;i<9;i++)for(let j=0;j<6;j++){x.beginPath();x.moveTo(90+i*42,90+j*44);x.lineTo(104+i*42,104+j*44);x.lineTo(90+i*42,118+j*44);x.lineTo(76+i*42,104+j*44);x.fill();}speckle(x,w2,h2,20000,.12,2);}),{roughness:1}));
  rug.rotation.x=-PI/2;rug.position.y=.004;rug.receiveShadow=true;W.scene.add(rug);
  // titreyen duvar apliklerinin sıcak ışığı
  for(const z of[-3,2.8]){
    boxM(.06,.16,.08,GOLD(),w/2-.04,1.72,z);
    const p=new T.PointLight('#ffb070',5,4.5,2);p.position.set(w/2-.25,1.78,z);W.scene.add(p);
    const gl=glow('#ffb070',.4,p.position,.8);
    W.upd.push((dt,t)=>{const f=1+Math.sin(t*13+z)*.07+Math.sin(t*7.7+z*2)*.06+(R()-.5)*.05;p.intensity=5*f;gl.material.opacity=.7*f;});
  }
  // sepya fotoğraflar
  const photo=(x,y,z,s)=>{const fr=boxM(.36*s,.46*s,.03,mat('#2a1a10',{roughness:.6}),x,y,z,-PI/2);const pic=new T.Mesh(new T.PlaneGeometry(.3*s,.4*s),tmat(ctex(128,170,(c,w2,h2)=>{const g=c.createLinearGradient(0,0,0,h2);g.addColorStop(0,'#b89a72');g.addColorStop(1,'#6b5236');c.fillStyle=g;c.fillRect(0,0,w2,h2);c.fillStyle='rgba(40,25,12,.6)';c.beginPath();c.ellipse(w2/2,h2*.42,26,32,0,0,TAU);c.fill();c.fillRect(w2/2-34,h2*.62,68,70);speckle(c,w2,h2,1500,.25,2);}),{roughness:.8}));pic.position.set(x-.02,y,z);pic.rotation.y=-PI/2;W.scene.add(pic);};
  photo(w/2-.03,1.85,.3,1);photo(w/2-.03,1.75,3.6,.8);
}
function decoGirne(V,w,d,h){
  const winT=ctex(1024,440,(x,w2,h2)=>{const g=x.createLinearGradient(0,0,0,h2);g.addColorStop(0,'#0a1230');g.addColorStop(.55,'#2a2350');g.addColorStop(.62,'#0b1a2a');g.addColorStop(1,'#050a12');x.fillStyle=g;x.fillRect(0,0,w2,h2);for(let i=0;i<180;i++){x.fillStyle=`rgba(255,255,255,${R()*.7})`;x.fillRect(R()*w2,R()*h2*.5,1.5,1.5);}x.fillStyle='#0a0f18';x.beginPath();x.moveTo(560,272);x.lineTo(560,200);x.lineTo(600,200);x.lineTo(600,180);x.lineTo(650,180);x.lineTo(650,200);x.lineTo(760,200);x.lineTo(760,230);x.lineTo(820,230);x.lineTo(820,272);x.fill();for(let i=0;i<40;i++){const px=R()*w2,py=280+R()*150;x.fillStyle=`rgba(255,${180+R()*60|0},120,${.2+R()*.5})`;x.fillRect(px,py,2+R()*20,1.5);}for(let i=0;i<30;i++){x.fillStyle='#ffd27a';x.fillRect(R()*w2,262+R()*12,2,2);}});
  const win=new T.Mesh(new T.PlaneGeometry(w*.7,h*.6),new T.MeshBasicMaterial({map:winT}));W.disp.push(win.material);win.position.set(0,h*.52,-d/2+.03);W.scene.add(win);
  const fr=mat('#e9e2d2',{roughness:.6});for(let i=-2;i<=2;i++)boxM(.06,h*.6,.06,fr,i*w*.7/4,h*.52,-d/2+.05);boxM(w*.7,.08,.08,fr,0,h*.82,-d/2+.06);boxM(w*.7,.08,.08,fr,0,h*.22,-d/2+.06);
  // limandaki ışıklar kıpırdar, bir tekne yavaşça geçer
  const tw=[];for(let i=0;i<14;i++)tw.push(glow(R()<.5?'#ffd27a':'#ff9a5a',.12+R()*.1,V3((R()-.5)*w*.66,h*.27+R()*.2,-d/2+.06),.5));
  const boat=glow('#fff0c0',.16,V3(-w*.3,h*.3,-d/2+.06),.8);
  W.upd.push((dt,t)=>{tw.forEach((g,i)=>{g.material.opacity=.35+.25*Math.sin(t*(1.3+i*.17)+i);});boat.position.x=-w*.33+((t*.06)%1)*w*.66;});
  for(const [x,z] of[[-w/2+.7,-d/2+.7],[w/2-.7,-d/2+.7],[w/2-.8,d/2-.8]]){const pot=mesh(cyl(.25,.2,.45,16),mat('#b8a07a',{roughness:.6}));pot.position.set(x,.225,z);W.scene.add(pot);for(let k=0;k<7;k++){const l=mesh(geo('leaf',()=>new T.ConeGeometry(.08,.9,5)),mat('#2e5e2a',{roughness:.7}));l.position.set(x,.9,z);l.rotation.set((R()-.5)*1.5,R()*TAU,(R()-.5)*1.5);W.scene.add(l);}}
  // rulet masası ve başında iki kişi
  const rx=4.3,rz=-3.2;
  const rl=mesh(cyl(.45,.45,.08,30),mat('#2a1c12',{roughness:.5}));rl.position.set(rx,.8,rz);W.scene.add(rl);const rl2=mesh(cyl(.4,.4,.02,30),mat('#1f5a2a'));rl2.position.set(rx,.85,rz);W.scene.add(rl2);const st=mesh(cyl(.08,.2,.8,12),mat('#1a120c'));st.position.set(rx,.4,rz);W.scene.add(st);
  const wheel=mesh(cyl(.17,.17,.03,24),mat('#3a2412',{roughness:.4,metalness:.3}));wheel.position.set(rx,.875,rz);W.scene.add(wheel);W.upd.push(dt=>{wheel.rotation.y+=dt*.8;});
  const ppl=[];for(const a of[2.4,3.6]){const px=rx+Math.cos(a)*.78,pz=rz+Math.sin(a)*.78;ppl.push(addNPC(npcDef(R()<.5?'tourist':'gambler'),{mode:'stand',standing:true,pos:V3(px,0,pz),yaw:Math.atan2(rx-px,rz-pz),rest:[V3(.15,.9,.3),V3(-.15,.9,.32)],look:V3(rx,.85,rz),lean:.12}));}
  if(ppl[0]&&ppl[1]){const[a,b]=ppl;a.npcIdle=()=>{const r=R();if(r<.45){const dur=2+R()*2.5;a.talkUntil=W.t+dur;a.play([{t:dur,look:{k:'np',p:b},gest:1,smile:.3},{t:.3,gest:0}],1);if(!b.seq)b.play([{t:dur,look:{k:'np',p:a},smile:.25}],1);}else a.play([{t:2+R()*2,look:'base'}],1);};}
  // bar ve barmen (sol duvar)
  const bx=-w/2+1.15,bz=-2.4;
  boxM(.6,1.05,3,mat('#3a2416',{roughness:.5}),bx,.525,bz);boxM(.72,.05,3.1,mat('#1a120c',{roughness:.25,metalness:.2}),bx,1.075,bz);
  for(let i=0;i<2;i++)boxM(.3,.04,2.6,mat('#3a2416'),-w/2+.16,1.4+i*.42,bz);
  for(let i=0;i<2;i++)for(let k=0;k<9;k++){const b=mesh(cyl(.03,.03,.24,10),mat(pick1(['#2c5a2a','#6b4a1a','#e8e0c8','#7a2a1a','#c9a24a']),{roughness:.15,transparent:true,opacity:.85}),false);b.position.set(-w/2+.16,1.54+i*.42,bz-1.1+k*.27);W.scene.add(b);}
  const bl=new T.PointLight('#ffd9a0',4,4,2);bl.position.set(bx,2.2,bz);W.scene.add(bl);
  const bt=addNPC(npcDef('bartender'),{mode:'bar',standing:true,pos:V3(-w/2+.6,0,bz),yaw:PI/2,rest:[V3(.16,1.1,.32),V3(-.16,1.1,.34)],look:V3(0,1.1,0),lean:.08});
  if(bt)bt.npcIdle=()=>{const r=R();if(r<.35)bt.play([{t:3+R()*2,wipe:1,look:'down'},{t:.3,wipe:0}],1);else if(r<.75)bt.play([{t:2+R()*3,look:'base'}],1);else bt.play([{t:1.6,look:'away'}],1);};
  for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){if(!i&&!j)continue;const c=mesh(cyl(.08,.08,.01,14),mat('#fff',{emissive:'#fff2d8',emissiveIntensity:2}),false);c.position.set(i*2.2,h-.005,j*2.2);W.scene.add(c);glow('#fff2d8',.35,V3(i*2.2,h-.04,j*2.2),.35);}
  const sl=new T.PointLight('#bcd8ff',1.2,9,2);sl.position.set(0,2.2,-d/2+1);W.scene.add(sl);
}
function decoMonte(V,w,d,h){
  const g=new T.Group();g.position.set(0,h-.75,0);W.scene.add(g);const gm=GOLD();
  g.add(mesh(sph(.08,14,10),gm,false));
  const cm=mat('#fffaf0',{emissive:'#ffe2b0',emissiveIntensity:2.4});
  const crys=mat('#ffffff',{transparent:true,opacity:.6,roughness:0,metalness:.2});
  [.32,.52,.72].forEach((r,i)=>{const t=mesh(torus(r,.012,TAU,6,48),gm,false);t.rotation.x=PI/2;t.position.y=-.1-i*.12;g.add(t);const n=8+i*6;for(let k=0;k<n;k++){const a=k/n*TAU;const c=mesh(sph(.018,8,6),cm,false);c.position.set(Math.cos(a)*r,-.07-i*.12,Math.sin(a)*r);g.add(c);const cr=mesh(geo('cry',()=>new T.OctahedronGeometry(.02)),crys,false);cr.position.set(Math.cos(a+.2)*r,-.16-i*.12,Math.sin(a+.2)*r);cr.scale.y=1.8;g.add(cr);if(k%2===0)glow('#ffe2b0',.13,V3(Math.cos(a)*r,h-.75-.07-i*.12,Math.sin(a)*r),.6);}});
  glow('#ffdcae',1.6,V3(0,h-.95,0),.16);
  const cl2=mesh(cyl(.006,.006,.75,6),gm,false);cl2.position.y=.38;g.add(cl2);
  const pl=new T.PointLight('#ffdcae',3.2,9,2);pl.position.y=-.2;g.add(pl);
  const marb=tmat(floorTex('marble'),{roughness:.2});
  for(const [x,z] of[[-w/2+1.2,-d/2+1.2],[w/2-1.2,-d/2+1.2],[-w/2+1.2,d/2-1.2],[w/2-1.2,d/2-1.2]]){const c=mesh(cyl(.28,.3,h,20),marb);c.position.set(x,h/2,z);W.scene.add(c);for(const y of[.15,h-.15]){const cp=mesh(cyl(.38,.38,.3,20),gm);cp.position.set(x,y,z);W.scene.add(cp);}}
  const art=[['#3a5a7a','#d8b46a'],['#5a2a2a','#e0c090'],['#2a4a3a','#c8a060']];
  art.forEach((c,i)=>{boxM(1.3,.95,.06,gm,-2.4+i*2.4,1.85,-d/2+.04);const pic=new T.Mesh(new T.PlaneGeometry(1.15,.8),tmat(ctex(256,180,(x,w2,h2)=>{const g2=x.createLinearGradient(0,0,0,h2);g2.addColorStop(0,c[1]);g2.addColorStop(1,c[0]);x.fillStyle=g2;x.fillRect(0,0,w2,h2);for(let k=0;k<30;k++){x.fillStyle=`rgba(0,0,0,${R()*.25})`;x.beginPath();x.ellipse(R()*w2,h2*.5+R()*h2*.5,20+R()*60,8+R()*20,0,0,TAU);x.fill();}speckle(x,w2,h2,4000,.2,2);}),{roughness:.7}));pic.position.set(-2.4+i*2.4,1.85,-d/2+.08);W.scene.add(pic);});
  for(let i=0;i<4;i++){const s=i%2?d:w;const tm=mesh(box(s,.06,.03),gm,false);const a=i*PI/2;tm.position.set(-Math.sin(a)*(i%2?w/2:d/2)*.995,h*.6,-Math.cos(a)*(i%2?w/2:d/2)*.995);tm.rotation.y=a;W.scene.add(tm);}
  // yan masada sohbet eden çift, aralarda dolaşan garson
  const tx=-4.6,tz=-4.6;
  const top=mesh(cyl(.45,.45,.04,26),mat('#2a160e',{roughness:.3}));top.position.set(tx,.72,tz);W.scene.add(top);const ped=mesh(cyl(.06,.2,.7,12),gm);ped.position.set(tx,.35,tz);W.scene.add(ped);
  const vase=mesh(cyl(.05,.035,.2,12),mat('#f4f1ea',{roughness:.2}));vase.position.set(tx,.84,tz);W.scene.add(vase);for(let k=0;k<5;k++){const f=mesh(sph(.03,8,6),mat(pick1(['#c2185b','#f4f1ea','#e8b04a'])),false);f.position.set(tx+(R()-.5)*.08,.97+R()*.05,tz+(R()-.5)*.08);W.scene.add(f);}
  const pair=[];for(const sgn of[-1,1]){const px=tx+sgn*.8,pz=tz;const ch=makeChair('velvet');ch.position.set(px+sgn*.06,0,pz);ch.rotation.y=Math.atan2(tx-px,0);W.scene.add(ch);
    const P=addNPC(npcDef('elegant'),{mode:'sit',pos:V3(px,0,pz),yaw:Math.atan2(tx-px,0),rest:[V3(.12,.76,.36),V3(-.12,.76,.36)],look:V3(tx,1.1,tz),lean:.06});
    if(P){const gl=makeProp('champagne');const gw=V3(px+(tx-px)*.45,.74,pz-.12);gl.position.copy(gw);W.scene.add(gl);P.cup={g:gl,home:gw.clone(),q0:gl.quaternion.clone()};pair.push(P);}}
  if(pair.length===2){const[a,b]=pair;for(const[P,Q2]of[[a,b],[b,a]])P.npcIdle=()=>{const r=R();if(r<.5){const dur=2+R()*3;P.talkUntil=W.t+dur;P.play([{t:dur,look:{k:'np',p:Q2},gest:1,smile:.3},{t:.3,gest:0}],1);if(!Q2.seq)Q2.play([{t:dur,look:{k:'np',p:P},smile:.28}],1);}else if(r<.72)P.act('drink');else P.play([{t:2,look:{k:'w',v:V3(0,1.1,0)}}],1);};}
  addNPC(npcDef('waiter'),{mode:'walker',standing:true,pos:V3(0,0,-3.4),path:loopPath(3.6,3.4),tray:'champagne',rest:[V3(.17,1.12,.24),V3(-.21,.86,.04)],look:{k:'fwd'},speed:.6});
}
function decoVegas(V,w,d,h){
  const neon=(c,x,y,z,len,ry)=>{const m=mesh(box(len,.04,.04),new T.MeshBasicMaterial({color:c}),false);W.disp.push(m.material);m.position.set(x,y,z);m.rotation.y=ry;W.scene.add(m);
    const n=Math.floor(len/1.6);for(let i=0;i<n;i++){const u=(i+.5)/n-.5;glow(c,.9,V3(x+Math.cos(ry)*u*len,y,z-Math.sin(ry)*u*len),.3);}};
  neon('#ff3cac',0,h-.3,-d/2+.06,w*.95,0);neon('#2de2ff',0,h-.45,-d/2+.06,w*.95,0);neon('#ff3cac',-w/2+.06,h-.3,0,d*.95,PI/2);neon('#2de2ff',w/2-.06,h-.3,0,d*.95,PI/2);
  for(const [c,x,z] of[['#ff3cac',-4,-4],['#2de2ff',4,-4],['#ff3cac',4,3],['#8a5cff',-4,3]]){const l=new T.PointLight(c,2.4,8,2);l.position.set(x,h-.6,z);W.scene.add(l);}
  const signM=new T.MeshBasicMaterial({transparent:true,map:ctex(1024,256,(x,w2,h2)=>{x.clearRect(0,0,w2,h2);x.font='bold 150px Limelight, Georgia';x.textAlign='center';x.textBaseline='middle';x.shadowColor='#ff3cac';x.shadowBlur=40;x.fillStyle='#ffd1ef';x.fillText('HIGH LIMIT',w2/2,h2/2);x.shadowBlur=20;x.fillText('HIGH LIMIT',w2/2,h2/2);})});W.disp.push(signM);
  const sign=new T.Mesh(new T.PlaneGeometry(3.2,.8),signM);sign.position.set(0,2.75,-d/2+.08);W.scene.add(sign);
  const sg=glow('#ff3cac',4.2,V3(0,2.75,-d/2+.2),.18);
  W.upd.push((dt,t)=>{const f=R()<.004?.3:1;signM.opacity=f;sg.material.opacity=.18*f;});
  const symbols=['7','BAR','♥','♦','$'];
  const drawScreen=(x,w2,h2)=>{x.fillStyle='#0b0b1a';x.fillRect(0,0,w2,h2);x.font='bold 30px Georgia';x.textAlign='center';for(let i=0;i<3;i++){x.fillStyle=['#ffd54c','#ff3cac','#2de2ff'][i];x.fillText(symbols[Math.floor(R()*5)],22+i*42,58);}};
  const scr=[];
  for(const side of[-1,1])for(let i=0;i<6;i++){
    const x=side*(w/2-.45),z=-4.5+i*1.5;boxM(.7,1.75,.65,mat('#1a1a22',{roughness:.4,metalness:.4}),x,.875,z,side>0?-PI/2:PI/2);
    const tex=ctex(128,96,drawScreen);const sm=new T.MeshBasicMaterial({map:tex});W.disp.push(sm);const s=new T.Mesh(new T.PlaneGeometry(.45,.34),sm);s.position.set(x-side*.335,1.15,z);s.rotation.y=side>0?-PI/2:PI/2;W.scene.add(s);
    const tm=new T.MeshBasicMaterial({color:i%2?'#ff3cac':'#ffd54c'});W.disp.push(tm);const top=mesh(box(.6,.14,.55),tm,false);top.position.set(x,1.82,z);W.scene.add(top);scr.push({top,tex,ph:R()*9,nt:R()*3});
  }
  W.upd.push((dt,t)=>{for(const o of scr){const k=.5+.5*Math.sin(t*3+o.ph);o.top.material.color.setHSL((t*.05+o.ph)%1,.9,.35+k*.25);if(t>o.nt){o.nt=t+1.5+R()*3;const c=o.tex.image.getContext('2d');drawScreen(c,128,96);o.tex.needsUpdate=true;}}});
  const dots=new T.InstancedMesh(cyl(.035,.035,.01,10),new T.MeshBasicMaterial({color:'#fff1d6'}),120);W.disp.push(dots.material);let k=0;for(let i=0;i<12;i++)for(let j=0;j<10;j++){_m.makeTranslation(-w/2+.8+i*(w-1.6)/11,h-.006,-d/2+.8+j*(d-1.6)/9);dots.setMatrixAt(k++,_m);}W.scene.add(dots);
  for(const [x,z] of[[-4.6,6.2],[4.6,6.4]]){const tb=mesh(cyl(1,1,.08,30),mat('#3a0a10'));tb.scale.z=.55;tb.position.set(x,.76,z);W.scene.add(tb);const ped=mesh(cyl(.2,.3,.74,12),mat('#0d0c0d'));ped.position.set(x,.37,z);W.scene.add(ped);}
  // slot makinelerinde oynayanlar, kokteyl taşıyan garson
  for(const [side,i] of[[-1,0],[-1,2],[1,1]]){
    const mx=side*(w/2-.45),z=-4.5+i*1.5,px=mx-side*.82,yaw=side>0?PI/2:-PI/2;
    stool(px,z,.6);
    const P=addNPC(npcDef(R()<.6?'tourist':'gambler'),{mode:'slot',pos:V3(px,.12,z),yaw,rest:[V3(.12,.84,.4),V3(-.1,.84,.42)],look:V3(mx-side*.34,1.15,z),lean:.1});
    if(P)P.npcIdle=()=>{const r=R();if(r<.5)P.play([{t:.3,R:'press',spd:10,look:'base'},{t:.12,R:'pressDown',spd:20},{t:.25,R:'press',spd:12},{t:1.8+R()*2,R:'rest',look:'base'}],1);else if(r<.82)P.play([{t:2.5+R()*2,look:'base'}],1);else P.play([{t:1.5,look:'away'}],1);};
  }
  addNPC(npcDef('waitress'),{mode:'walker',standing:true,pos:V3(0,0,-4.3),path:loopPath(4.6,4.3),tray:'cocktail',rest:[V3(.17,1.12,.24),V3(-.21,.86,.04)],look:{k:'fwd'},speed:.66});
}
function decoTrain(V,w,d,h){
  const board=new T.Mesh(new T.PlaneGeometry(1.8,1.1),tmat(ctex(512,312,(x,w2,h2)=>{x.fillStyle='#1d2a22';x.fillRect(0,0,w2,h2);x.strokeStyle='#6b4a2e';x.lineWidth=18;x.strokeRect(0,0,w2,h2);x.fillStyle='rgba(240,240,230,.8)';x.font='28px Georgia';x.fillText('Pot oranı = gör ÷ (pot + gör)',30,70);x.fillText('Out × 4 (flop) · Out × 2 (turn)',30,120);x.fillText('Pozisyon > kartlar',30,170);x.fillText('Önünde bahis yoksa: kontrol',30,220);speckle(x,w2,h2,4000,.1,2);}),{roughness:.95}));
  board.position.set(0,1.7,-d/2+.03);W.scene.add(board);
  const wood=mat('#3a2416',{roughness:.7});boxM(1.6,2,.35,wood,w/2-.3,1,-1.5,PI/2);
  for(let i=0;i<4;i++)for(let k=0;k<9;k++){const b=mesh(box(.04,.26,.18),mat(['#7a2a1a','#1a3a5a','#2a5a2a','#7a6a2a'][(i+k)%4]),false);b.position.set(w/2-.25,.35+i*.45,-2.1+k*.14);W.scene.add(b);}
  // gerçek saati gösteren duvar saati
  const cg=new T.Group();cg.position.set(-2.4,2.2,-d/2+.04);W.scene.add(cg);
  const fc=mesh(cyl(.22,.22,.03,32),mat('#f4efe2',{roughness:.5}),false);fc.rotation.x=PI/2;cg.add(fc);
  const rim=mesh(torus(.225,.018,TAU,8,32),mat('#3a2416',{roughness:.5}),false);cg.add(rim);
  for(let i=0;i<12;i++){const tk=mesh(box(.012,.035,.004),mat('#222'),false);const a=i/12*TAU;tk.position.set(Math.sin(a)*.18,Math.cos(a)*.18,.018);tk.rotation.z=-a;cg.add(tk);}
  const hand=(len,wd,col)=>{const p=new T.Group();p.position.z=.022;const m=mesh(box(wd,len,.004),mat(col),false);m.position.y=len/2-.02;p.add(m);cg.add(p);return p;};
  const hh=hand(.11,.012,'#111'),mh=hand(.16,.008,'#111'),sh=hand(.17,.003,'#b8322b');
  W.upd.push(()=>{const n=new Date(),s=n.getSeconds()+n.getMilliseconds()/1000,m=n.getMinutes()+s/60,hr=(n.getHours()%12)+m/60;hh.rotation.z=-hr/12*TAU;mh.rotation.z=-m/60*TAU;sh.rotation.z=-Math.floor(s)/60*TAU;});
}


/* ---------- yeni salonlar ---------- */
// İki kişilik masa: oturan iki figür sohbet eder, içki içer
function sitPair(tx,tz,o={}){
  const top=mesh(box(.8,.04,.8),o.top||mat('#4a2c18',{roughness:.6}));top.position.set(tx,.72,tz);W.scene.add(top);
  const leg=mesh(cyl(.05,.07,.7,8),mat('#2a1a10'));leg.position.set(tx,.36,tz);W.scene.add(leg);
  if(o.board){const bd=mesh(box(.5,.02,.34),mat('#6b3f1d',{roughness:.5}));bd.position.set(tx,.755,tz);W.scene.add(bd);for(let i=0;i<12;i++){const tri=mesh(box(.018,.003,.12),mat(i%2?'#e8dcc0':'#2a1a10'),false);tri.position.set(tx-.22+i*.04,.767,tz+(i<6?-.09:.09));W.scene.add(tri);}}
  W.obst.push({x:tx,z:tz,r:.62});
  const pair=[];
  for(const sgn of[-1,1]){
    W.obst.push({x:tx+sgn*.84,z:tz,r:.42});
    const px=tx+sgn*.78,pz=tz,yaw=Math.atan2(tx-px,0);
    const ch=makeChair(o.chair||'wood');ch.position.set(px+sgn*.06,0,pz);ch.rotation.y=yaw;W.scene.add(ch);
    const P=addNPC(npcDef(o.kind||'gambler'),{mode:'sit',pos:V3(px,0,pz),yaw,rest:[V3(.12,.76,.36),V3(-.12,.76,.36)],look:V3(tx,.8,tz),lean:.08});
    if(P){
      if(o.prop){const gl=makeProp(o.prop);const gw=V3(px+(tx-px)*.5,.74,pz-.2*sgn);gl.position.copy(gw);W.scene.add(gl);P.cup={g:gl,home:gw.clone(),q0:gl.quaternion.clone()};}
      pair.push(P);
    }
  }
  if(pair.length===2){const[a,b]=pair;for(const[P,Q2]of[[a,b],[b,a]])P.npcIdle=()=>{const r=R();if(r<.4){const dur=2+R()*3;P.talkUntil=W.t+dur;P.play([{t:dur,look:{k:'np',p:Q2},gest:1,smile:.3},{t:.3,gest:0}],1);if(!Q2.seq)Q2.play([{t:dur,look:{k:'np',p:P},smile:.25}],1);}else if(r<.6&&P.cup)P.act('drink');else if(r<.8)P.play([{t:1.6,look:{k:'w',v:V3(tx,.8,tz)}}],1);else P.play([{t:2,look:'away'}],1);};}
  return pair;
}
function chandelier(y,radii,crystalMat){
  const g=new T.Group();g.position.set(0,y,0);W.scene.add(g);const gm=GOLD(),cm=mat('#fffaf0',{emissive:'#ffe2b0',emissiveIntensity:2.4});
  g.add(mesh(sph(.08,14,10),gm,false));
  radii.forEach((r,i)=>{const t=mesh(torus(r,.012,TAU,6,48),gm,false);t.rotation.x=PI/2;t.position.y=-.1-i*.12;g.add(t);const n=8+i*5;for(let k=0;k<n;k++){const a=k/n*TAU;const c=mesh(sph(.017,8,6),cm,false);c.position.set(Math.cos(a)*r,-.07-i*.12,Math.sin(a)*r);g.add(c);if(k%2===0)glow('#ffe2b0',.12,V3(Math.cos(a)*r,y-.07-i*.12,Math.sin(a)*r),.55);}});
  const cord=mesh(cyl(.006,.006,.7,6),gm,false);cord.position.y=.36;g.add(cord);
  glow('#ffdcae',1.6,V3(0,y-.2,0),.15);
  const pl=new T.PointLight('#ffdcae',3,9,2);pl.position.y=-.2;g.add(pl);
  return g;
}
function nightWindow(w,h,d,tex,wf=.7,hf=.6,yf=.52){
  const win=new T.Mesh(new T.PlaneGeometry(w*wf,h*hf),new T.MeshBasicMaterial({map:tex}));W.disp.push(win.material);win.position.set(0,h*yf,-d/2+.03);W.scene.add(win);
  return win;
}
function decoKiraathane(V,w,d,h){
  // yüksekte bir televizyon: maç yayını
  const c=document.createElement('canvas');c.width=256;c.height=160;const cx=c.getContext('2d');
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;W.disp.push(tex);
  const drawTV=t=>{cx.fillStyle='#17692f';cx.fillRect(0,0,256,160);cx.strokeStyle='rgba(255,255,255,.75)';cx.lineWidth=2;cx.strokeRect(10,22,236,120);cx.beginPath();cx.moveTo(128,22);cx.lineTo(128,142);cx.stroke();cx.beginPath();cx.arc(128,82,22,0,TAU);cx.stroke();for(let i=0;i<6;i++){cx.fillStyle=i%2?'#d33':'#36c';cx.beginPath();cx.arc(40+i*35+Math.sin(t*2+i)*10,60+(i%3)*30,5,0,TAU);cx.fill();}cx.fillStyle='#fff';cx.beginPath();cx.arc(128+Math.sin(t*1.7)*90,82+Math.cos(t*2.3)*40,4,0,TAU);cx.fill();cx.fillStyle='rgba(0,0,0,.7)';cx.fillRect(0,0,256,18);cx.fillStyle='#fff';cx.font='bold 12px Arial';cx.fillText('CANLI   A  1 - 0  B     67\'',8,13);tex.needsUpdate=true;};
  drawTV(0);
  boxM(1.25,.78,.1,mat('#0e0e10',{roughness:.4}),2.3,1.95,-d/2+.06);
  const scr=new T.Mesh(new T.PlaneGeometry(1.1,.68),new T.MeshBasicMaterial({map:tex}));W.disp.push(scr.material);scr.position.set(2.3,1.95,-d/2+.115);W.scene.add(scr);
  glow('#8fd6a0',1.8,V3(2.3,1.95,-d/2+.3),.12);
  let tv=0;W.upd.push((dt,t)=>{tv-=dt;if(tv<=0){tv=.45;drawTV(t);}});
  // raf: çay bardakları
  const wood=mat('#3a2416',{roughness:.7});
  boxM(1.9,.05,.28,wood,-2.2,1.5,-d/2+.2);boxM(1.9,.05,.28,wood,-2.2,1.95,-d/2+.2);
  for(let r=0;r<2;r++)for(let k=0;k<8;k++){const g=makeProp('tea');g.position.set(-3.0+k*.23,r?1.975:1.525,-d/2+.2);W.scene.add(g);}
  // semaver
  boxM(.7,.8,.5,mat('#4a3a2a',{roughness:.7}),-w/2+.6,.4,-1.4);
  const sm=mesh(cyl(.13,.16,.42,18),mat('#c49a3a',{metalness:.85,roughness:.3}));sm.position.set(-w/2+.6,1.0,-1.4);W.scene.add(sm);
  const smt=mesh(cyl(.06,.1,.12,14),mat('#c49a3a',{metalness:.85,roughness:.3}));smt.position.set(-w/2+.6,1.27,-1.4);W.scene.add(smt);
  W.upd.push(()=>{if(R()<.03)W.smoke.emit(V3(-w/2+.6,1.38,-1.4),.03,.13,2.8,.14);});
  // tavla oynayanlar
  sitPair(-w/2+1.9,-d/2+2.3,{board:true,chair:'wood',prop:'tea'});
  sitPair(w/2-1.9,-d/2+2.3,{board:true,chair:'wood',prop:'tea'});
  // tütün dumanı
  W.upd.push(dt=>{if(R()<dt*1.4)W.smoke.emit(V3((R()-.5)*2.4,1.5+R()*.6,(R()-.5)*1.8),.5,1.4,9,.06);});
  // duvarda gün batımı tablosu
  const pic=new T.Mesh(new T.PlaneGeometry(.9,.6),tmat(ctex(256,170,(x,w2,h2)=>{const g=x.createLinearGradient(0,0,0,h2);g.addColorStop(0,'#e8924a');g.addColorStop(.6,'#c4513a');g.addColorStop(1,'#2a3a5a');x.fillStyle=g;x.fillRect(0,0,w2,h2);x.fillStyle='#10182a';x.fillRect(0,h2*.7,w2,h2*.3);x.fillStyle='#fff3c0';x.beginPath();x.arc(w2*.7,h2*.6,18,0,TAU);x.fill();speckle(x,w2,h2,2000,.2,2);}),{roughness:.8}));
  pic.position.set(-w/2+.03,1.75,1.3);pic.rotation.y=PI/2;W.scene.add(pic);
}
function decoHan(V,w,d,h){
  const stone=tmat(wallTex('stone'),{roughness:.9});
  for(const [x,z] of[[-w/2+1.2,-d/2+1.2],[w/2-1.2,-d/2+1.2],[-w/2+1.2,d/2-1.2],[w/2-1.2,d/2-1.2]]){
    const c=mesh(cyl(.3,.34,h,16),stone);c.position.set(x,h/2,z);W.scene.add(c);
    const cap=mesh(box(.8,.16,.8),stone);cap.position.set(x,h-.08,z);W.scene.add(cap);
    const bs=mesh(box(.8,.2,.8),stone);bs.position.set(x,.1,z);W.scene.add(bs);
  }
  // sarkan pirinç fenerler
  const brass=mat('#b8862e',{metalness:.85,roughness:.35}),lm=mat('#fff0c0',{emissive:'#ffb347',emissiveIntensity:2.6});
  [[-3.2,-2.6],[3.2,-2.6],[-3.2,2.6],[3.2,2.6],[0,-4.2],[-4.4,0],[4.4,0]].forEach(([x,z],i)=>{
    const g=new T.Group();g.position.set(x,h-1.1,z);W.scene.add(g);
    const ch=mesh(cyl(.004,.004,1.1,5),brass,false);ch.position.y=.55;g.add(ch);
    g.add(mesh(cyl(.09,.12,.26,10),lm,false));
    const cap1=mesh(geo('lcone',()=>new T.ConeGeometry(.13,.12,10)),brass,false);cap1.position.y=.19;g.add(cap1);
    const base=mesh(cyl(.07,.04,.06,10),brass,false);base.position.y=-.16;g.add(base);
    const gl=glow('#ffb866',.9,V3(x,h-1.1,z),.5);
    if(i<3){const pl=new T.PointLight('#ffb866',2.4,5.5,2);pl.position.set(x,h-1.2,z);W.scene.add(pl);W.upd.push((dt,t)=>{const f=1+Math.sin(t*9+i*3)*.05+(R()-.5)*.05;pl.intensity=2.4*f;gl.material.opacity=.5*f;});}
    W.upd.push((dt,t)=>{g.rotation.z=Math.sin(t*.6+i)*.03;});
  });
  // duvar kilimleri ve yuvarlanmış halılar
  const kil=(x,y,z,ry,sw,sh)=>{const m=new T.Mesh(new T.PlaneGeometry(sw,sh),tmat(floorTex('kilim'),{roughness:.95}));m.position.set(x,y,z);m.rotation.y=ry;W.scene.add(m);};
  kil(-2.6,1.7,-d/2+.03,0,1.7,1.2);kil(-w/2+.03,1.7,-1.5,PI/2,1.6,1.1);kil(w/2-.03,1.7,-1.5,-PI/2,1.6,1.1);
  for(let i=0;i<4;i++){const rc=mesh(cyl(.13,.13,1.6,14),tmat(floorTex('kilim'),{roughness:.95}));rc.rotation.x=PI/2;rc.position.set(w/2-.5-(i%2)*.28,.14+(i>1?.26:0),-4.2);W.scene.add(rc);}
  // turnuva saati: seviye ve körler
  const bc=document.createElement('canvas');bc.width=512;bc.height=300;const bx=bc.getContext('2d');
  const btex=new T.CanvasTexture(bc);btex.colorSpace=T.SRGBColorSpace;W.disp.push(btex);
  let lastK='';
  const draw=()=>{
    const g=W.G;if(!g)return;const k=g.sb+'|'+g.bb+'|'+g.lvlN+'|'+g.handNo;if(k===lastK)return;lastK=k;
    const bl=g.venue.blindUp,nh=Math.floor((g.handNo-1)/bl+1)*bl+1,left=nh-g.handNo,last=g.lvlN>=g.venue.levels.length-1;
    bx.fillStyle='#1a120c';bx.fillRect(0,0,512,300);bx.strokeStyle='#b8862e';bx.lineWidth=8;bx.strokeRect(6,6,500,288);
    bx.textAlign='center';bx.fillStyle='#e8d6a8';bx.font='bold 32px Georgia';bx.fillText('TURNUVA SAATİ',256,54);
    bx.fillStyle='#ffcf6a';bx.font='bold 58px Georgia';bx.fillText('Seviye '+(g.lvlN+1),256,128);
    bx.fillStyle='#fff3d6';bx.font='bold 42px Georgia';bx.fillText(fmtM(g.sb,g.venue.cur)+' / '+fmtM(g.bb,g.venue.cur),256,196);
    bx.fillStyle='#bfae86';bx.font='26px Georgia';bx.fillText(last?'Son seviye':'Sonraki artış: '+left+' el sonra',256,252);
    btex.needsUpdate=true;
  };
  boxM(1.7,1.0,.08,mat('#3a2416',{roughness:.6}),2.6,1.75,-d/2+.05);
  const bd=new T.Mesh(new T.PlaneGeometry(1.5,.88),new T.MeshBasicMaterial({map:btex}));W.disp.push(bd.material);bd.position.set(2.6,1.75,-d/2+.1);W.scene.add(bd);
  W.upd.push(draw);
  sitPair(-w/2+1.9,-d/2+2.6,{board:true,chair:'wood',prop:'tea'});
  addNPC(npcDef('waiter'),{mode:'walker',standing:true,pos:V3(0,0,-3.6),path:loopPath(3.8,3.5),tray:'tea',rest:[V3(.17,1.12,.24),V3(-.21,.86,.04)],look:{k:'fwd'},speed:.6});
}
function decoYali(V,w,d,h){
  const winT=ctex(1024,440,(x,w2,h2)=>{
    const g=x.createLinearGradient(0,0,0,h2);g.addColorStop(0,'#070b1c');g.addColorStop(.5,'#1c2146');g.addColorStop(.58,'#27214a');g.addColorStop(.6,'#0c1730');g.addColorStop(1,'#050a14');x.fillStyle=g;x.fillRect(0,0,w2,h2);
    for(let i=0;i<160;i++){x.fillStyle=`rgba(255,255,255,${R()*.7})`;x.fillRect(R()*w2,R()*h2*.5,1.5,1.5);}
    x.fillStyle='#e8e0c8';x.beginPath();x.arc(160,70,26,0,TAU);x.fill();x.fillStyle='rgba(232,224,200,.12)';x.beginPath();x.arc(160,70,58,0,TAU);x.fill();
    x.fillStyle='#0a0f1d';x.beginPath();x.moveTo(0,262);for(let i=0;i<=16;i++)x.lineTo(i*64,240-Math.abs(Math.sin(i*1.3))*30);x.lineTo(1024,262);x.fill();
    for(let i=0;i<70;i++){x.fillStyle=`rgba(255,${190+R()*50|0},120,${.3+R()*.6})`;x.fillRect(R()*w2,230+R()*30,2,2);}
    const by=252;x.strokeStyle='#cfd4ff';x.lineWidth=3;x.beginPath();x.moveTo(0,by);x.lineTo(w2,by);x.stroke();
    for(const tx of[330,700]){x.fillStyle='#b9bff0';x.fillRect(tx-6,150,12,by-150);x.fillStyle='#fff';x.fillRect(tx-4,146,8,6);}
    x.strokeStyle='rgba(200,206,255,.8)';x.lineWidth=2;
    x.beginPath();x.moveTo(0,by);x.quadraticCurveTo(165,by-12,330,152);x.stroke();
    x.beginPath();x.moveTo(330,152);x.quadraticCurveTo(515,by-4,700,152);x.stroke();
    x.beginPath();x.moveTo(700,152);x.quadraticCurveTo(860,by-12,1024,by);x.stroke();
    for(let i=0;i<60;i++){x.fillStyle=['#ff4d6d','#ffd166','#7ad7f0'][i%3];x.fillRect(i*17,by-2,3,3);}
    for(let i=0;i<60;i++){x.fillStyle=`rgba(255,${180+R()*60|0},120,${.15+R()*.4})`;x.fillRect(R()*w2,280+R()*140,6+R()*26,1.5);}
  });
  nightWindow(w,h,d,winT);
  const fr=mat('#f1ece0',{roughness:.5});for(let i=-2;i<=2;i++)boxM(.06,h*.6,.06,fr,i*w*.7/4,h*.52,-d/2+.05);boxM(w*.7,.08,.08,fr,0,h*.82,-d/2+.06);boxM(w*.7,.08,.08,fr,0,h*.22,-d/2+.06);
  curtain(1.5,h,'#e9e3d3',-w*.42,-d/2+.2,0);curtain(1.5,h,'#e9e3d3',w*.42,-d/2+.2,0);
  chandelier(h-.55,[.3,.5]);
  // kuyruklu piyano
  boxM(1.7,.82,1.15,mat('#0a0a0c',{roughness:.25,metalness:.3}),-w/2+1.6,.5,-2.6);
  boxM(1.2,.03,.26,mat('#f4f1ea',{roughness:.4}),-w/2+1.6,.93,-2.05);
  for(const dx of[-.55,0,.55])W.obst.push({x:-w/2+1.6+dx,z:-2.6,r:.8});
  const lid=boxM(1.7,.03,1.1,mat('#0a0a0c',{roughness:.2,metalness:.3}),-w/2+1.6,1.12,-2.7);lid.rotation.z=.4;
  // pencere önünde konuşan iki konuk
  const pa=[];for(const sgn of[-1,1]){const px=2.4+sgn*.42,pz=-d/2+1.5;pa.push(addNPC(npcDef('elegant'),{mode:'stand',standing:true,pos:V3(px,0,pz),yaw:Math.atan2(-sgn*.42,.2),rest:[V3(.15,.9,.3),V3(-.15,.9,.32)],look:V3(2.4,1.2,pz),lean:.1}));}
  if(pa[0]&&pa[1]){const[a,b]=pa;for(const[P,Q2]of[[a,b],[b,a]])P.npcIdle=()=>{const r=R();if(r<.5){const dur=2+R()*3;P.talkUntil=W.t+dur;P.play([{t:dur,look:{k:'np',p:Q2},gest:1,smile:.3},{t:.3,gest:0}],1);if(!Q2.seq)Q2.play([{t:dur,look:{k:'np',p:P},smile:.25}],1);}else P.play([{t:2+R()*2,look:'base'}],1);};}
  addNPC(npcDef('waiter'),{mode:'walker',standing:true,pos:V3(0,0,-3.9),path:loopPath(4.2,3.9),tray:'wine',rest:[V3(.17,1.12,.24),V3(-.21,.86,.04)],look:{k:'fwd'},speed:.6});
  const sl=new T.PointLight('#bcd8ff',1.4,9,2);sl.position.set(0,2.2,-d/2+1);W.scene.add(sl);
}
function decoMacau(V,w,d,h){
  const red=mat('#c1121f',{emissive:'#ff2a2a',emissiveIntensity:1.8,roughness:.4}),gold=GOLD();
  const pts=[];for(let i=0;i<5;i++){pts.push([-5.2,-4.4+i*2.2],[5.2,-4.4+i*2.2]);}for(let i=0;i<4;i++)pts.push([-3.3+i*2.2,-5.6]);
  pts.forEach(([x,z],i)=>{
    const g=new T.Group();g.position.set(x,h-.9,z);W.scene.add(g);
    const b=mesh(sph(.2,14,10),red,false);b.scale.y=1.15;g.add(b);
    for(const y of[.22,-.22]){const c=mesh(cyl(.07,.08,.05,10),gold,false);c.position.y=y;g.add(c);}
    const ts=mesh(cyl(.006,.01,.3,6),mat('#d6a73a'),false);ts.position.y=-.4;g.add(ts);
    const cord=mesh(cyl(.004,.004,.7,5),gold,false);cord.position.y=.57;g.add(cord);
    glow('#ff3a3a',.8,V3(x,h-.9,z),.38);W.upd.push((dt,t)=>{g.rotation.z=Math.sin(t*.7+i)*.04;});
  });
  [[-4.6,-3],[4.6,-3],[-4.6,3],[4.6,3]].forEach(([x,z])=>{const l=new T.PointLight('#ff5a4a',2.2,7,2);l.position.set(x,h-1,z);W.scene.add(l);});
  // şehir silüeti penceresi
  const winT=ctex(1024,400,(x,w2,h2)=>{
    const g=x.createLinearGradient(0,0,0,h2);g.addColorStop(0,'#0a0618');g.addColorStop(.6,'#3a1646');g.addColorStop(.75,'#5a1c3c');g.addColorStop(1,'#10060e');x.fillStyle=g;x.fillRect(0,0,w2,h2);
    for(let i=0;i<120;i++){x.fillStyle=`rgba(255,255,255,${R()*.5})`;x.fillRect(R()*w2,R()*h2*.4,1.5,1.5);}
    for(let i=0;i<22;i++){const bw=30+R()*50,bh=70+R()*180,bx=i*48+R()*10;x.fillStyle='#0c0714';x.fillRect(bx,h2-bh-60,bw,bh+60);
      for(let k=0;k<bh/12;k++)for(let j=0;j<bw/12;j++)if(R()<.45){x.fillStyle=R()<.7?'rgba(255,214,120,.75)':'rgba(255,90,140,.7)';x.fillRect(bx+4+j*12,h2-bh-52+k*12,5,6);}
      if(R()<.4){x.fillStyle=['#ff3cac','#ffd54c','#2de2ff'][i%3];x.fillRect(bx,h2-bh-64,bw,3);}}
    x.fillStyle='#ffd54c';x.fillRect(540,40,6,170);x.beginPath();x.arc(543,110,26,0,TAU);x.strokeStyle='#ffd54c';x.lineWidth=5;x.stroke();
    for(let i=0;i<50;i++){x.fillStyle=`rgba(255,${120+R()*100|0},140,${.15+R()*.4})`;x.fillRect(R()*w2,h2-60+R()*58,6+R()*24,1.5);}
  });
  nightWindow(w,h,d,winT,.62,.55,.5);
  // altın "福" tabelaları
  const sg=ctex(256,256,(x,w2,h2)=>{x.fillStyle='#8a0f1c';x.save();x.translate(128,128);x.rotate(PI/4);x.fillRect(-84,-84,168,168);x.strokeStyle='#d6a73a';x.lineWidth=7;x.strokeRect(-76,-76,152,152);x.restore();x.fillStyle='#e8bf4a';x.textAlign='center';x.textBaseline='middle';x.font='bold 110px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC",serif';x.fillText('福',128,134);});
  for(const sx of[-1,1]){const m=new T.Mesh(new T.PlaneGeometry(.95,.95),new T.MeshBasicMaterial({map:sg,transparent:true}));W.disp.push(m.material);m.position.set(sx*w*.4,2.3,-d/2+.05);W.scene.add(m);glow('#ff9a40',1.3,V3(sx*w*.4,2.3,-d/2+.15),.16);}
  // seyircilerle bekleyen iki konuk, çay servisi yapan garson
  for(const [z,k] of[[-1.6,0],[-.4,1]]){const px=w/2-1.4;addNPC(npcDef(k?'elegant':'gambler'),{mode:'stand',standing:true,pos:V3(px,0,z),yaw:Math.atan2(-px,-z),rest:[V3(.15,.9,.3),V3(-.15,.9,.32)],look:V3(0,1.1,0),lean:.1});}
  addNPC(npcDef('waitress'),{mode:'walker',standing:true,pos:V3(0,0,-4.4),path:loopPath(4.9,4.4),tray:'tea',rest:[V3(.17,1.12,.24),V3(-.21,.86,.04)],look:{k:'fwd'},speed:.62});
}
function decoSuit(V,w,d,h){
  const gold=GOLD();
  const winT=ctex(2048,640,(x,w2,h2)=>{
    const g=x.createLinearGradient(0,0,0,h2);g.addColorStop(0,'#03030a');g.addColorStop(.55,'#1a1030');g.addColorStop(.8,'#40205a');g.addColorStop(1,'#0d0614');x.fillStyle=g;x.fillRect(0,0,w2,h2);
    for(let i=0;i<260;i++){x.fillStyle=`rgba(255,255,255,${R()*.6})`;x.fillRect(R()*w2,R()*h2*.5,1.6,1.6);}
    for(let i=0;i<70;i++){const bw=22+R()*50,bh=40+R()*210,bx=i*30+R()*12;x.fillStyle=i%3?'#0a0612':'#150c24';x.fillRect(bx,h2-bh-90,bw,bh+90);
      for(let k=0;k<bh/10;k++)for(let j=0;j<bw/10;j++)if(R()<.4){x.fillStyle=R()<.8?'rgba(255,214,130,.7)':'rgba(120,200,255,.65)';x.fillRect(bx+3+j*10,h2-bh-82+k*10,4,5);}}
    // The Sphere benzeri parlak küre
    const sx=1380,sy=360,sr=130;const rg=x.createRadialGradient(sx-30,sy-30,10,sx,sy,sr);rg.addColorStop(0,'#ffd1ef');rg.addColorStop(.5,'#c04aa8');rg.addColorStop(1,'#3a1a7a');x.fillStyle=rg;x.beginPath();x.arc(sx,sy,sr,0,TAU);x.fill();x.fillStyle='rgba(255,60,172,.12)';x.beginPath();x.arc(sx,sy,sr+50,0,TAU);x.fill();
    // iğne kule ve piramit
    x.fillStyle='#0a0612';x.fillRect(560,120,10,420);x.beginPath();x.arc(565,190,22,0,TAU);x.fill();x.fillStyle='#ff3c5a';x.fillRect(562,100,6,22);
    x.fillStyle='#0b0814';x.beginPath();x.moveTo(1700,540);x.lineTo(1800,380);x.lineTo(1900,540);x.fill();x.fillStyle='rgba(255,255,255,.55)';x.fillRect(1798,150,4,230);
    // neon şerit ve cadde ışıkları
    for(let i=0;i<10;i++){x.fillStyle=['#ff3cac','#2de2ff','#ffd54c'][i%3];x.fillRect(i*200+20,h2-92,120,4);}
    for(let r=0;r<4;r++)for(let i=0;i<110;i++){x.fillStyle=i%2?`rgba(255,70,70,${.5-r*.1})`:`rgba(255,240,200,${.5-r*.1})`;x.fillRect(i*19+r*5,h2-70+r*14,4,3);}
  });
  nightWindow(w,h,d,winT,.92,.72,.5);
  for(let i=-4;i<=4;i++)boxM(.07,h*.72,.08,gold,i*w*.92/8,h*.5,-d/2+.06);
  boxM(w*.92,.1,.1,gold,0,h*.86,-d/2+.06);boxM(w*.92,.1,.1,gold,0,h*.14,-d/2+.06);
  chandelier(h-.8,[.4,.7,1.0]);
  const colM=mat('#0b0b10',{roughness:.2,metalness:.2});
  for(const [x,z] of[[-w/2+1.6,-d/2+1.6],[w/2-1.6,-d/2+1.6],[-w/2+1.6,d/2-1.6],[w/2-1.6,d/2-1.6]]){
    const c=mesh(cyl(.34,.36,h,18),colM);c.position.set(x,h/2,z);W.scene.add(c);
    for(const y of[.4,h-.4]){const b=mesh(cyl(.37,.37,.1,18),gold);b.position.set(x,y,z);W.scene.add(b);}
  }
  // iki koruma: kollar önde kavuşturulmuş
  for(const sx of[-1,1]){const px=sx*(w/2-2.6),pz=-d/2+2.2;addNPC(npcDef('gambler'),{mode:'stand',standing:true,pos:V3(px,0,pz),yaw:Math.atan2(-px,-pz),rest:[V3(-.12,1.06,.2),V3(.12,1.04,.22)],look:V3(0,1.4,0),lean:.02,idle:undefined});}
  addNPC(npcDef('waitress'),{mode:'walker',standing:true,pos:V3(0,0,-5.8),path:loopPath(6.2,5.8),tray:'champagne',rest:[V3(.17,1.12,.24),V3(-.21,.86,.04)],look:{k:'fwd'},speed:.66});
}
/* ---------- masa ---------- */
function buildTable(V,venue){
  const g=new T.Group();W.scene.add(g);if(V.worn)g.rotation.y=.012;
  const s=new T.Shape();s.absellipse(0,0,RX,RZ,0,TAU,false,0);
  const fg=new T.ShapeGeometry(s,72);fg.rotateX(-PI/2);
  const p=fg.attributes.position,uv=fg.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+RX)/(2*RX),(-p.getZ(i)+RZ)/(2*RZ));
  const felt=new T.Mesh(fg,tmat(feltTex(V,venue.name),{roughness:.97,envMapIntensity:.4}));felt.position.y=TY;felt.receiveShadow=true;g.add(felt);
  const rs=new T.Shape();rs.absellipse(0,0,RXo,RZo,0,TAU,false,0);const hole=new T.Path();hole.absellipse(0,0,RX+.004,RZ+.004,0,TAU,true,0);rs.holes.push(hole);
  const rg=new T.ExtrudeGeometry(rs,{depth:.035,bevelEnabled:true,bevelThickness:.03,bevelSize:.034,bevelSegments:5,curveSegments:80});rg.rotateX(-PI/2);
  const railM=V.railWood?tmat(floorTex('wood'),{roughness:.6}):tmat(ctex(256,256,(x,w,h)=>{x.fillStyle=V.rail;x.fillRect(0,0,w,h);speckle(x,w,h,9000,.12,1.5);},{rep:[8,1]}),{roughness:.42});
  const rail=mesh(rg,railM);rail.position.y=TY-.02;g.add(rail);
  const sg=new T.ExtrudeGeometry((()=>{const q=new T.Shape();q.absellipse(0,0,RXo-.02,RZo-.02,0,TAU,false,0);return q;})(),{depth:.11,bevelEnabled:false,curveSegments:60});sg.rotateX(-PI/2);
  const skirt=mesh(sg,mat(shade(V.rail,.8),{roughness:.6}));skirt.position.y=TY-.13;g.add(skirt);
  const ped=mesh(cyl(.22,.32,.6,18),mat('#141110',{roughness:.5}));ped.position.y=.33;g.add(ped);
  const base=mesh(cyl(.5,.55,.05,24),mat('#141110',{roughness:.5}));base.position.y=.025;g.add(base);
  W.table=g;
}
function makeChair(style){
  const g=new T.Group();
  if(style==='plastic'){const m=mat(R()<.5?'#e8e4da':'#b8352b',{roughness:.45});const s=mesh(box(.44,.04,.42),m);s.position.set(0,.45,0);g.add(s);const b=mesh(box(.42,.36,.03),m);b.position.set(0,.68,-.2);b.rotation.x=-.12;g.add(b);for(const [x,z] of[[-.19,-.18],[.19,-.18],[-.19,.18],[.19,.18]]){const l=mesh(cyl(.014,.014,.45,6),m);l.position.set(x,.225,z);g.add(l);}return g;}
  if(style==='wood'){const m=mat('#4a2c18',{roughness:.6});const s=mesh(box(.46,.05,.44),m);s.position.set(0,.46,0);g.add(s);for(let i=-2;i<=2;i++){const sl=mesh(box(.05,.42,.025),m);sl.position.set(i*.09,.7,-.2);g.add(sl);}const top=mesh(box(.48,.06,.04),m);top.position.set(0,.93,-.2);g.add(top);for(const [x,z] of[[-.2,-.19],[.2,-.19],[-.2,.19],[.2,.19]]){const l=mesh(box(.04,.46,.04),m);l.position.set(x,.23,z);g.add(l);}return g;}
  const pad=mat(style==='velvet'?'#5a1a2a':style==='casinoBlack'?'#141416':style==='club'?'#3a2416':'#3a2a22',{roughness:style==='velvet'?.95:.5});const fr=mat(style==='velvet'?'#c9a24a':'#1a1a1a',{roughness:.4,metalness:style==='velvet'?.8:.3});
  const s=mesh(box(.5,.1,.48),pad);s.position.set(0,.46,0);g.add(s);const b=mesh(box(.48,.55,.1),pad);b.position.set(0,.8,-.22);b.rotation.x=-.1;g.add(b);
  const post=mesh(cyl(.03,.03,.38,8),fr);post.position.set(0,.22,0);g.add(post);const base=mesh(cyl(.26,.26,.03,16),fr);base.position.y=.015;g.add(base);
  return g;
}

/* ---------- koltuk düzeni, kart, fiş, taşıma işleri ---------- */
function seatAngles(n,casino){
  if(!casino||(n-1)%2)return [...Array(n)].map((_,i)=>90+i*360/n);
  const M=n-1,G=62,d=(360-G)/M;return [90].concat([...Array(M)].map((_,k)=>90+d*(k+1)+(k+1>M/2?G-d:0)));
}
function seatFrame(deg,off=.36){
  const a=deg*PI/180,c=Math.cos(a),s=Math.sin(a);
  const n=V3(c/RXo,0,s/RZo).normalize();
  const o=new T.Object3D();o.position.set(RXo*c,0,RZo*s).addScaledVector(n,off);o.rotation.y=Math.atan2(-n.x,-n.z);o.updateMatrixWorld();
  return o;
}
const CARD_GEO=()=>geo('card',()=>new T.PlaneGeometry(CW,CH));
const GLOW_GEO=()=>geo('cglow',()=>new T.PlaneGeometry(CW*1.16,CH*1.12));
function getCard(){
  let cd=W.pool.pop();
  if(!cd){
    const g=new T.Group(),inner=new T.Group();g.add(inner);
    // Mat kağıt: yansıma yok (Lambert), az miktarda kendinden ışık; gölgede ve parlak ışıkta da okunur.
    const fm=new T.MeshLambertMaterial({transparent:true,alphaTest:.4,emissive:'#ffffff',emissiveIntensity:0});W.disp.push(fm);
    const front=new T.Mesh(CARD_GEO(),fm);front.receiveShadow=true;
    const back=new T.Mesh(CARD_GEO(),W.backMat);back.rotation.y=PI;back.receiveShadow=true;
    const gl=new T.Mesh(GLOW_GEO(),W.glowMat);gl.position.z=-.0006;gl.visible=false;
    inner.add(front,back,gl);W.scene.add(g);
    cd={g,inner,front,fm,glow:gl,c:-9,st:{pos:V3(),yaw:0,flip:PI,tilt:0,scale:1,lift:0},anim:null,hl:0};
  }
  cd.g.visible=true;cd.anim=null;cd.swept=false;cd.hl=-9;setHL(cd,0);return cd;
}
function setFace(cd,c){if(cd.c===c)return;cd.c=c;const t=c>=0?cardTex(c):null;cd.fm.map=t;cd.fm.emissiveMap=t;cd.fm.emissiveIntensity=t?.2:0;cd.fm.color.set(t?'#ffffff':'#f4ecdb');cd.fm.needsUpdate=true;cd.hl=-9;setHL(cd,0);}
function setHL(cd,m){if(cd.hl===m)return;cd.hl=m;cd.glow.visible=m===1;cd.fm.color.setScalar(m===-1?.45:1);if(cd.fm.map)cd.fm.emissiveIntensity=m===-1?.05:.2;}
function applyCard(cd){const s=cd.st;cd.g.position.copy(s.pos);cd.g.position.y+=s.lift;cd.g.rotation.set(0,s.yaw,0);cd.inner.rotation.set(-PI/2+s.tilt,s.flip,0);cd.g.scale.setScalar(s.scale);}
function animCard(cd,to,dur,arc=.04,done,delay=0){
  const from={pos:cd.st.pos.clone(),yaw:cd.st.yaw,flip:cd.st.flip,tilt:cd.st.tilt,scale:cd.st.scale};
  const T2={pos:to.pos?to.pos.clone():from.pos.clone(),yaw:to.yaw??from.yaw,flip:to.flip??from.flip,tilt:to.tilt??from.tilt,scale:to.scale??from.scale};
  let dy=T2.yaw-from.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));
  cd.anim={t:-delay,dur,fn:k=>{const e=eIO(k);cd.st.pos.lerpVectors(from.pos,T2.pos,e);cd.st.lift=Math.sin(PI*e)*arc;cd.st.yaw=from.yaw+dy*e;cd.st.flip=lerp(from.flip,T2.flip,e);cd.st.tilt=lerp(from.tilt,T2.tilt,e);cd.st.scale=lerp(from.scale,T2.scale,e);},done};
}
function sweep(cd){cd.swept=true;if(W.loose.indexOf(cd)<0)W.loose.push(cd);animCard(cd,{pos:W.dealFrom.clone(),flip:PI,tilt:0},.35,.03,()=>{cd.g.visible=false;const i=W.loose.indexOf(cd);if(i>=0)W.loose.splice(i,1);W.pool.push(cd);},R()*.1);}
function breakdown(a){const [sm,base]=W.denoms;let nb=Math.floor(a/base),rem=a-nb*base,ng=0;if(nb>70){ng=Math.floor((nb-50)/5);nb-=ng*5;}return [Math.round(rem/sm),nb,ng];}
function makePile(kind,cap){
  const g=new T.Group();W.scene.add(g);
  const cg=geo('chip',()=>new T.CylinderGeometry(CHIP_R,CHIP_R,CHIP_H,24));
  const im=W.chipM.map(m=>{const x=new T.InstancedMesh(cg,m,cap);x.count=0;x.castShadow=true;x.receiveShadow=true;x.frustumCulled=false;g.add(x);return x;});
  const P={g,im,amt:-1,kind,cap,seed:Math.floor(R()*9999)};
  P.set=a=>{a=Math.max(0,Math.round(a));if(a===P.amt)return;P.amt=a;layoutPile(P,a);};
  return P;
}
function layoutPile(P,a){
  const n=breakdown(a);const per=P.kind==='stack'?20:P.kind==='bet'?9:7;
  let rs=P.seed;const rr=()=>{rs=(rs*9301+49297)%233280;return rs/233280;};
  let col=0;const jit=P.kind==='stack'?.0008:.0022;
  for(let d=2;d>=0;d--){
    const m=P.im[d];const cnt=Math.min(n[d],P.cap);let i=0;
    while(i<cnt){
      let cx,cz;
      if(P.kind==='stack'){cx=(col%4)*.041-.06;cz=Math.floor(col/4)*.041-.02;}
      else{const ang=col*2.4,rad=(P.kind==='pot'?.037:.03)*Math.sqrt(col);cx=Math.cos(ang)*rad;cz=Math.sin(ang)*rad;}
      const h=Math.min(per-(P.kind==='stack'?0:Math.floor(rr()*3)),cnt-i);
      for(let k=0;k<h;k++,i++){_t.set(cx+(rr()-.5)*jit,CHIP_H/2+k*CHIP_H,cz+(rr()-.5)*jit);_q.setFromAxisAngle(_up,rr()*TAU);_m.compose(_t,_q,_one);m.setMatrixAt(i,_m);}
      col++;
    }
    m.count=cnt;m.instanceMatrix.needsUpdate=true;
  }
}
function slide(P,to,dur,delay,done){const from=P.g.position.clone();tween(dur,k=>{const e=eIO(k);P.g.position.lerpVectors(from,to,e);P.g.position.y=to.y+Math.sin(PI*e)*.03;},done,delay);}
// Taşıma işi: bir karakterin eline verilecek fiş yığını ya da kartlar. Süresinde alınmazsa kendi kendine kayar.
function job(type,o){const j=Object.assign({type,state:'wait',dead:W.t+(o.wait||1.6),hands:o.hands==null?1:o.hands},o);W.jobs.push(j);return j;}
function releaseJob(j){
  if(j.state==='go'||j.state==='done')return;j.state='go';
  const k=W.jobs.indexOf(j);if(k>=0)W.jobs.splice(k,1);
  if(j.type==='pile'){const d=j.pile.g.position.distanceTo(j.final);slide(j.pile,j.final,cl(.15+d*.5,.15,.7),0,()=>{j.state='done';j.done&&j.done();});}
  else{j.state='done';j.cards.forEach((cd,i)=>{if(!cd.swept)animCard(cd,{pos:j.finals[i],yaw:cd.st.yaw+(R()-.5)*1.2,flip:PI,tilt:0},.32,.03,()=>{if(!cd.swept)cd.g.visible=false;});});}
}

/* ---------- motor ---------- */
function initRenderer(){
  renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  camera=new T.PerspectiveCamera(56,1.6,.03,60);camera.rotation.order='YXZ';
  clock=new T.Clock();ray=new T.Raycaster();
  const cv=renderer.domElement;cv.className='v3-canvas';
  // Fare ve dokunmatik: tek parmak/fare sürükleyerek bakar, iki parmak kıstırarak yakınlaştırır, dokunma odaklar
  const ptrs=new Map();
  const pinchD=()=>{const [a,b]=[...ptrs.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  cv.addEventListener('pointerdown',e=>{
    if(!W)return;if(W.intro){W.intro.t=W.intro.dur;return;}
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});try{cv.setPointerCapture(e.pointerId);}catch(x){}
    if(ptrs.size>=2){cam.drag=null;cam.pinch={d:pinchD(),fov:cam.tFov};return;}
    cam.drag={x:e.clientX,y:e.clientY,moved:0,yaw:cam.tYaw,pitch:cam.tPitch};
  });
  cv.addEventListener('pointermove',e=>{
    if(!W)return;if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(cam.pinch&&ptrs.size>=2){cam.focus=-1;cam.tFov=cl(cam.pinch.fov*cam.pinch.d/Math.max(20,pinchD()),18,78);cam.user=W.t;return;}
    const d=cam.drag;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;d.moved=Math.max(d.moved,Math.abs(dx)+Math.abs(dy));
    if(d.moved>6){const k=e.pointerType==='touch'?1.25:1;cam.focus=-1;cam.tYaw=cl(d.yaw-dx*.0045*k,Y0()-1.6,Y0()+1.6);cam.tPitch=cl(d.pitch-dy*.0035*k,-1.0,.35);cam.user=W.t;}
  });
  const up=e=>{ptrs.delete(e.pointerId);const d=cam.drag,wasPinch=!!cam.pinch;if(ptrs.size<2)cam.pinch=null;if(ptrs.size===0)cam.drag=null;if(e.type==='pointerup'&&d&&!wasPinch&&d.moved<8&&W&&!W.intro)pick(e);};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{if(!W||W.intro)return;e.preventDefault();cam.tFov=cl(cam.tFov+e.deltaY*.025,18,78);cam.user=W.t;},{passive:false});
  cv.addEventListener('dblclick',()=>resetView());
  document.addEventListener('keydown',e=>{
    if(!W||!W.ready)return;if(W.intro){W.intro.t=W.intro.dur;return;}
    const tg=(e.target.tagName||'').toLowerCase();if(tg==='input'||tg==='textarea'||tg==='select')return;
    const md=document.getElementById('modal');if(md&&!md.hidden)return;
    const k=e.key;
    if(k==='v'||k==='V'){resetView();return;}
    const turn=(dy,dp)=>{cam.focus=-1;cam.tYaw=cl(cam.tYaw+dy,Y0()-1.6,Y0()+1.6);cam.tPitch=cl(cam.tPitch+dp,-1,.35);cam.user=W.t;e.preventDefault();};
    if(k==='ArrowLeft'||k==='a'||k==='A')turn(.32,0);
    else if(k==='ArrowRight'||k==='d'||k==='D')turn(-.32,0);
    else if(k==='ArrowUp')turn(0,.15);else if(k==='ArrowDown')turn(0,-.15);
  });
}
// Dar (dikey telefon) ekranda daha geniş açı: masa ve yan oyuncular sığsın
const baseFov=()=>{const a=camera?camera.aspect:1.6;return a<.8?76:a<1.15?68:a<1.45?62:56;};
const P0=()=>W&&W.pitch0!=null?W.pitch0:-.29,Y0=()=>(W&&W.yaw0)||0;
function cine(i,dur=3,fov=30){
  if(!W||!W.ready||W.intro||cam.focus>0||cam.cine||W.t-cam.user<5||i<=0)return;
  const P=W.people[i];if(!P||!P.root.visible||P.st.out)return;
  cam.focus=i;cam.cine={i,t0:W.t,until:W.t+dur,f0:cam.tFov-2,f1:fov};cam.tFov=cam.cine.f0;
}
function resetView(){cam.cine=null;cam.focus=-1;cam.tYaw=Y0();cam.tPitch=P0();cam.tFov=baseFov();cam.user=W?W.t-10:-99;}
function focusOn(i){if(!W||!W.people[i])return;cam.focus=i;cam.tFov=24;cam.user=W.t;}
function pick(e){
  const r=renderer.domElement.getBoundingClientRect();
  const m=new T.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(m,camera);
  if(W.hall){if(W.walk)return;const h=ray.intersectObjects(W.hall.map(x=>x.g),true)[0];if(h){let o=h.object;while(o&&o.userData.hk===undefined)o=o.parent;if(o&&W.onPick)W.onPick(o.userData.hk);}return;}
  const objs=W.people.filter(p=>p&&p.root.visible).map(p=>p.root);
  const hit=ray.intersectObjects(objs,true)[0];
  if(hit){let o=hit.object;while(o&&o.userData.pi===undefined)o=o.parent;if(o&&o.userData.pi>0){if(cam.focus===o.userData.pi)resetView();else focusOn(o.userData.pi);return;}}
  resetView();
}
function yawPitch(v){const dx=v.x-camera.position.x,dy=v.y-camera.position.y,dz=v.z-camera.position.z;return [Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz))];}
function resize(){if(!renderer||!host)return;const w=host.clientWidth||1,h=host.clientHeight||1;const was=baseFov();renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(cam.focus<0&&Math.abs(cam.tFov-was)<.5)cam.tFov=baseFov();}
function applySettings(){
  if(!renderer)return;const gq=Q();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,gq==='high'?1.75:gq==='mid'?1.25:1));
  if(W)renderer.toneMappingExposure=W.V.exp*BRIGHT();
  resize();
}

function start(G,el,opt={}){
  stop();
  host=el;if(!renderer)initRenderer();
  if(renderer.domElement.parentNode!==host)host.insertBefore(renderer.domElement,host.firstChild);
  labelsEl=host.querySelector('.v3-labels');labelsEl.innerHTML='';
  const id=G.venue.id,V=VS[id]||VS.antrenman;
  const sh=Q()!=='low';
  if(renderer.shadowMap.enabled!==sh){renderer.shadowMap.enabled=sh;MC.forEach(m=>{m.needsUpdate=true;});}
  const scene=new T.Scene();scene.background=new T.Color(V.fog[0]);scene.fog=new T.FogExp2(V.fog[0],V.fog[1]);
  W={scene,V,t:0,tw:[],upd:[],disp:[],seats:[],people:[],npcs:[],obst:[],jobs:[],pool:[],board:[],loose:[],potAmt:0,potPaid:false,turnIdx:-1,btnIdx:-1,ready:false};
  applySettings();
  try{const pm=new T.PMREMGenerator(renderer);const et=envTex(V);const rt=pm.fromEquirectangular(et);scene.environment=rt.texture;W.disp.push(rt);pm.dispose();}catch(e){}
  W.smoke=smokeSys(V.room[0]<=8?110:70);
  const bt=backTex(V.back);
  W.backMat=new T.MeshLambertMaterial({map:bt,emissiveMap:bt,emissive:'#ffffff',emissiveIntensity:.14,transparent:true,alphaTest:.4});W.disp.push(W.backMat);
  W.glowMat=new T.MeshBasicMaterial({color:'#ffd56a'});W.disp.push(W.glowMat);
  W.chipM=V.chips.map(chipMats);
  buildRoom(V,id);
  buildTable(V,G.venue);
  const base=[1,5,10,25,50,100,500,1000,5000,10000,25000,50000,100000,500000,1000000].filter(x=>x<=G.venue.buy/40).pop()||G.venue.sb;
  W.denoms=[Math.max(G.venue.sb,Math.round(base/5)),base,base*5];
  W.potPos=V3(0,TY,-.26);W.pot=makePile('pot',160);W.pot.g.position.copy(W.potPos);
  const ang=seatAngles(G.players.length,V.casino);
  G.players.forEach((p,i)=>{
    const o=seatFrame(ang[i]);const S={o,p,cards:[],betAmt:0,cFold:false,cShow:false,human:!!p.human};
    const L=(x,y,z)=>o.localToWorld(V3(x,y,z));
    S.stackPos=L(-.2,TY,.6);S.betPos=L(-.02,TY,.78);S.btnPos=L(.21,TY+.004,.72);
    S.spots=p.human?[{pos:L(.052,TY+.018,.56),yaw:0,tilt:.4},{pos:L(-.052,TY+.018,.56),yaw:0,tilt:.4}]:[{pos:L(.038,TY+.0016,.6),yaw:o.rotation.y+PI+.12,tilt:0},{pos:L(-.034,TY+.0026,.605),yaw:o.rotation.y+PI-.08,tilt:0}];
    S.show=[L(.058,TY+.004,.7),L(-.058,TY+.004,.7)];
    S.cardScale=p.human?1.35:1.08;
    S.stack=makePile('stack',150);S.stack.g.position.copy(S.stackPos);S.stack.g.rotation.y=o.rotation.y;S.stack.set(p.chips);
    S.bet=makePile('bet',90);S.bet.g.position.copy(S.betPos);
    const ch=makeChair(V.chair);ch.position.copy(o.localToWorld(V3(0,0,-.06)));ch.rotation.y=o.rotation.y;W.scene.add(ch);
    if(!p.human){
      const P=makePerson(p.char||{},{idx:i,style:p.style});P.root.position.copy(o.position);P.root.rotation.y=o.rotation.y;W.scene.add(P.root);
      P.stackW=S.stackPos.clone().setY(TY+.03);P.cardsW=L(0,TY,.6);P.betW=S.betPos.clone();P.seat=S;
      attachProps(P,S,p.char||{});P.init();
      P.stand=1;P.standT=1;P.sitAt=W.t+.5+R()*2;   // salona girerken herkes ayakta; sen yaklaşırken oturur
      S.person=P;W.people[i]=P;
      const lb=document.createElement('div');lb.className='p3';lb.innerHTML='<b class="n"></b><span class="c"></span><em class="a"></em><span class="h"></span><span class="say"></span>';lb.querySelector('.n').textContent=p.name;
      lb.addEventListener('click',()=>{if(cam.focus===i)resetView();else focusOn(i);});
      labelsEl.appendChild(lb);S.label=lb;S.lt='';
    }else if(setting('body',true)&&typeof avaDef==='function'){
      // Kendi bedenin: kamera başının içinde durur, başı çizilmez; omuzlarını, kollarını ve ellerini masada görürsün
      try{
        const P=makePerson(avaDef(),{idx:-3,style:'kaya'});P.root.position.copy(o.position);P.root.rotation.y=o.rotation.y;W.scene.add(P.root);
        P.stackW=S.stackPos.clone().setY(TY+.03);P.cardsW=L(0,TY,.6);P.betW=S.betPos.clone();P.seat=S;
        attachProps(P,S,{});P.init();P.head.visible=false;
        P.sfx.poses=['rail'];P.sfx.fid=.35;P.baseLook={k:'board'};P.reset();
        if(Q()==='low')P.root.traverse(m=>{if(m.isMesh)m.castShadow=false;});
        W.me=P;
      }catch(e){console.warn('Beden kurulamadı',e);W.me=null;}
    }
    W.seats[i]=S;
  });
  W.human=W.seats[0];
  W.eye=W.human.o.localToWorld(V3(0,1.19,.05));
  if(V.casino){
    const o=seatFrame(270,.3);const P=makePerson(CROUP[id]||CROUP.girne,{idx:-1,standing:true,croupier:true});P.root.position.copy(o.position);P.root.rotation.y=o.rotation.y;W.scene.add(P.root);P.stackW=W.potPos;P.cardsW=V3(0,TY,0);P.betW=W.potPos;P.init();W.croupier=P;
    W.dealFrom=o.localToWorld(V3(.04,TY+.06,.42));
    const tray=mesh(box(.42,.04,.12),mat('#141210',{roughness:.4}));tray.position.copy(o.localToWorld(V3(0,TY+.02,.42)));tray.rotation.y=o.rotation.y;W.scene.add(tray);
    const rack=makePile('stack',150);rack.g.position.copy(o.localToWorld(V3(.06,TY+.04,.42)));rack.g.rotation.y=o.rotation.y;rack.set(G.venue.buy*2.2);
    const shoe=mesh(box(.11,.08,.2),mat('#2a1a12',{roughness:.5}));shoe.position.copy(o.localToWorld(V3(.32,TY+.04,.45)));shoe.rotation.y=o.rotation.y+.3;W.scene.add(shoe);
  }else W.dealFrom=V3(0,TY+.05,0);
  W.btn=mesh(cyl(.028,.028,.009,24),[tmat(null,{color:'#e9e2d0',roughness:.4}),tmat(ctex(128,128,(x,w,h)=>{x.fillStyle='#fbf7ec';x.fillRect(0,0,w,h);x.fillStyle='#16110c';x.font='bold 54px Georgia';x.textAlign='center';x.textBaseline='middle';x.fillText('D',w/2,h/2+2);x.font='bold 14px Georgia';x.fillText('DEALER',w/2,h/2+38);}),{roughness:.4}),tmat(null,{color:'#e9e2d0'})]);W.scene.add(W.btn);W.btn.position.set(0,-1,0);
  resize();resetView();cam.yaw=0;cam.pitch=-.29;cam.fov=cam.tFov;cam.vy=cam.vp=0;
  const tt=host.querySelector('.v3-title');if(tt)tt.innerHTML=`<b>${G.venue.name}</b><span>${G.venue.place||''}</span>`;
  W.ready=true;W.G=G;
  resize();
  if(!host._ro){host._ro=new ResizeObserver(resize);host._ro.observe(host);}
  clock.getDelta();
  cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  return new Promise(res=>{
    const [w,d]=V.room;
    const z0=d/2-.9;
    if(opt.intro==='sit')W.intro=sitIntro(W.human.o,res);
    else W.intro={t:0,dur:6.4,res,path:new T.CatmullRomCurve3([V3(-w/2+1.3,1.64,z0),V3(-1.9,1.64,Math.min(2.9,z0-.6)),V3(-.6,1.64,2.15),V3(0,1.64,1.86)]),step:0};
    W.people.forEach((P,i)=>{if(!P)return;P.baseLook={k:'human'};P.reset();setTimeout(()=>{if(P&&W&&W.intro&&R()<.5)P.act('nod');},1500+i*500);});
    host.classList.add('intro');host.classList.toggle('short',opt.intro==='sit');
  });
}
function stop(){
  cancelAnimationFrame(raf);raf=0;
  if(W){
    W.ready=false;
    const keep=new Set(GC.values());
    W.scene.traverse(o=>{if((o.isMesh||o.isPoints||o.isSprite)&&o.geometry&&!keep.has(o.geometry))o.geometry.dispose();});
    W.disp.forEach(x=>{try{x.dispose();}catch(e){}});
    if(W.intro&&W.intro.res)W.intro.res();
  }
  W=null;if(labelsEl)labelsEl.innerHTML='';if(host)host.classList.remove('intro','walking','short');
}
let lastFrame=0;
function loop(){raf=requestAnimationFrame(loop);frame();}
// rAF durursa (pencere arkada, önizleme paneli gizli) sahne yine de ilerlesin; giriş yürüyüşü takılmasın.
// Sayfa gizliyken (uygulama arka planda) çizim yapılmaz; pil boşa gitmesin.
setInterval(()=>{if(W&&W.ready&&(!document.hidden||window.__vyForce)&&performance.now()-lastFrame>350)frame();},200);
function frame(){
  if(!W||!W.ready)return;
  lastFrame=performance.now();
  const dt=Math.min(.25,clock.getDelta());W.t+=dt;const t=W.t;
  for(let i=W.tw.length-1;i>=0;i--){const a=W.tw[i];a.t+=dt;if(a.t<0)continue;const k=Math.min(1,a.t/a.dur);a.fn(k);if(k>=1){W.tw.splice(i,1);a.done&&a.done();}}
  for(const f of W.upd)f(dt,t);
  for(let i=W.jobs.length-1;i>=0;i--){const j=W.jobs[i];if(j&&j.state==='wait'&&t>j.dead)releaseJob(j);}
  for(const P of W.people)if(P)P.update(dt,t);
  if(W.me){W.me.root.visible=!W.intro;W.me.update(dt,t);}   // yürüyüş sırasında başsız beden görünmesin
  if(W.croupier)W.croupier.update(dt,t);
  for(const P of W.npcs)updNPC(P,dt,t);
  // kartlar (taşınanlar elin peşinden gider)
  const all=[...W.board,...W.loose];W.seats.forEach(S=>all.push(...S.cards));
  for(const cd of all){if(cd.anim){const a=cd.anim;a.t+=dt;if(a.t>=0){const k=Math.min(1,a.t/a.dur);a.fn(k);if(k>=1){cd.anim=null;a.done&&a.done();}}}applyCard(cd);}
  for(let i=W.loose.length-1;i>=0;i--){const cd=W.loose[i];if(!cd.anim){cd.g.visible=false;W.loose.splice(i,1);if(W.pool.indexOf(cd)<0)W.pool.push(cd);}}
  // kartına bakan oyuncu kendine yakın kenarı kaldırır
  W.seats.forEach(S=>{const P=S.person;if(P&&!S.cShow&&!S.cFold&&P.peek>.02)S.cards.forEach(cd=>{if(!cd.anim){const a=P.peek*.5;cd.inner.rotation.x-=a;cd.g.position.y+=Math.sin(a)*CH*cd.st.scale*.5;}});});
  W.smoke.update(dt);
  updCamera(dt,t);
  renderer.render(W.scene,camera);
  updLabels();
  if(W.hall)updHallLabels();
}
function updCamera(dt,t){
  const I=W.intro;
  if(I){
    if(!I.t0)I.t0=performance.now();if(I.t<I.dur)I.t=(performance.now()-I.t0)/1000;const k=Math.min(1,I.t/I.dur);
    const walkK=I.walkK||.8,NS=I.steps||9;
    if(k<walkK){
      const u=eIO(k/walkK);I.path.getPointAt(u,camera.position);
      const steps=Math.floor(u*NS);if(steps>I.step){I.step=steps;try{SFX.play('step');}catch(e){}}
      camera.position.y+=Math.abs(Math.sin(u*NS*PI))*.025;
      camera.fov=baseFov()+2;camera.updateProjectionMatrix();
      if(I.look)camera.lookAt(I.look);else camera.lookAt(0,.95,0);I.q0=camera.quaternion.clone();
    }else{
      if(!I.sat&&!I.stand){I.sat=true;try{SFX.play('chair');}catch(e){}}
      const u=eIO((k-walkK)/(1-walkK));
      camera.position.lerpVectors(I.path.getPointAt(1,_t),W.eye,u);
      _q.setFromEuler(new T.Euler(P0(),Y0(),0,'YXZ'));
      camera.quaternion.copy(I.q0||camera.quaternion).slerp(_q,u);
      camera.fov=lerp(baseFov()+2,baseFov(),u);camera.updateProjectionMatrix();
    }
    if(k>=1){
      W.intro=null;host.classList.remove('intro');
      W.people.forEach(P=>{if(P){P.baseLook={k:'board'};P.reset();}});
      camera.rotation.set(P0(),Y0(),0,'YXZ');cam.yaw=cam.tYaw=Y0();cam.pitch=cam.tPitch=P0();
      I.res();
    }
    return;
  }
  if(W.frozen)return;
  if(W.walk){
    // salonda seçilen masaya yürüyüş
    const J=W.walk;J.t+=dt;const k=Math.min(1,J.t/J.dur),u=eIO(k);
    J.path.getPointAt(u,camera.position);
    const steps=Math.floor(u*J.steps);if(steps>J.step){J.step=steps;try{SFX.play('step');}catch(e){}}
    camera.position.y+=Math.abs(Math.sin(u*J.steps*PI))*.025;
    _m.lookAt(camera.position,J.look,_up);_q.setFromRotationMatrix(_m);camera.quaternion.slerp(_q,Math.min(1,dt*4));
    if(k>=1){W.walk=null;W.frozen=true;J.res();}
    return;
  }
  if(cam.focus>0&&W.people[cam.focus]&&W.people[cam.focus].root.visible){const [y,p]=yawPitch(W.people[cam.focus].headW(_t));cam.tYaw=y;cam.tPitch=p-.02;}
  else if(setting('follow',true)!==false&&!cam.drag&&W.t-cam.user>4){
    let ty=Y0(),tp=P0();const ti=W.turnIdx;
    if(ti>0&&W.people[ti]){const [y]=yawPitch(W.people[ti].headW(_t));if(Math.abs(y-Y0())>.58){ty=Y0()+(y-Y0())*.78;tp=P0()+.09;}}
    cam.tYaw=ty;cam.tPitch=tp;
  }
  // baş dönüşü de yaylı: ivmelenir, yumuşakça durur
  const w=cam.drag?16:4.2;
  let r=spring(cam.yaw,cam.vy,cam.tYaw,w,dt);cam.yaw=r[0];cam.vy=r[1];
  r=spring(cam.pitch,cam.vp,cam.tPitch,w,dt);cam.pitch=r[0];cam.vp=r[1];
  // sinematik yakın plan: kullanıcı kamerayla oynarsa ya da süre dolarsa biter
  if(cam.cine){const c=cam.cine;
    if(cam.user>c.t0||W.intro)cam.cine=null;
    else if(W.t>c.until){if(cam.focus===c.i)resetView();cam.cine=null;}
    else cam.tFov=lerp(c.f0,c.f1,eIO(cl((W.t-c.t0)/(c.until-c.t0),0,1)));}
  cam.fov=damp(cam.fov,cam.tFov,5,dt);
  camera.position.copy(W.eye);camera.position.y+=Math.sin(t*1.6)*.0025;camera.position.x+=Math.sin(t*.4)*.003;
  camera.rotation.set(cam.pitch,cam.yaw,0,'YXZ');
  if(Math.abs(camera.fov-cam.fov)>.01){camera.fov=cam.fov;camera.updateProjectionMatrix();}
}
function updLabels(){
  const w=host.clientWidth,h=host.clientHeight;
  W.seats.forEach((S,i)=>{
    const lb=S.label;if(!lb)return;const P=S.person;
    if(!P||!P.root.visible||S.p.out){lb.style.display='none';S.lx=null;return;}
    lb.style.display='';
    P.headW(_t);_t.y+=.25;_w.copy(_t).applyMatrix4(camera.matrixWorldInverse);
    _t.project(camera);
    let x=(_t.x*.5+.5)*w,y=(-_t.y*.5+.5)*h;
    const off=_w.z>0||x<20||x>w-20||y>h-10;if(!off&&y<46)y=46;
    if(off){x=_w.x<0?66:w-66;y=cl(_w.z>0?h*.4:y,46,h-80);}
    lb.classList.toggle('edge',off);lb.classList.toggle('left',off&&_w.x<0);
    lb.classList.toggle('focus',cam.focus===i);
    S.lx=x;S.ly=y;S.off=off;
  });
  // üstteki kart/pot göstergesinin altına giren plaka aşağı kaysın
  const hud=host.querySelector('.v3-board');
  if(hud&&hud.offsetHeight){
    const hb=hud.offsetTop+hud.offsetHeight+4,hl=hud.offsetLeft-hud.offsetWidth/2,hr=hl+hud.offsetWidth;   // gösterge translate:-50% ile ortalı
    W.seats.forEach(S=>{if(!S.label||S.off||S.lx==null)return;const lw=S.label.offsetWidth/2,lh=S.label.offsetHeight;if(S.ly-lh<hb&&S.lx+lw>hl&&S.lx-lw<hr)S.ly=hb+lh;});
  }
  // kenara itilen plakalar üst üste binmesin
  for(const side of[0,1]){
    const L=W.seats.filter(S=>S.label&&S.off&&S.lx!=null&&(S.lx<w/2)===!side).sort((a,b)=>a.ly-b.ly);
    for(let k=1;k<L.length;k++)if(L[k].ly-L[k-1].ly<46)L[k].ly=L[k-1].ly+46;
  }
  W.seats.forEach(S=>{if(S.label&&S.lx!=null)S.label.style.transform=`translate(${S.lx|0}px,${S.ly|0}px)`;});
}

/* ---------- senkron ---------- */
function sync(G){
  if(!W||!W.ready)return;
  W.turnIdx=G.turn;
  const done=G.phase==='done';
  G.players.forEach((p,i)=>{
    const S=W.seats[i];if(!S)return;S.p=p;
    const P=S.person;
    if(P){const was=P.st.folded||!P.st.inHand;P.st.inHand=p.inHand;P.st.folded=p.folded;P.st.turn=G.turn===i;P.st.out=p.out;const now=p.folded||!p.inHand;if(was!==now&&!P.seq)P.leanT=P.leanBase();}
    if(!S.hold)S.stack.set(p.out?0:p.chips);
    // bahis yığını: bot bahsi elle iter, sen bahis yapınca fişler kayar
    if(p.bet!==S.betAmt){
      if(p.bet>S.betAmt){const prev=S.betAmt;S.betAmt=p.bet;S.bet.set(p.bet);
        if(S.human&&W.me)W.me.act('reachChips',{dur:1.1});
        if(prev===0){S.bet.g.position.copy(S.stackPos);
          if(P&&P.seqName==='bet'){if(P.job)releaseJob(P.job);P.job=job('pile',{pile:S.bet,final:S.betPos,hands:P.seqAll?'both':1,wait:1.2});}
          else slide(S.bet,S.betPos,.4,.18);}}
      else if(p.bet===0){const pl=S.bet;S.betAmt=0;slide(pl,W.potPos,.35,0,()=>{if(S.betAmt===0){pl.set(0);pl.g.position.copy(S.betPos);}});}
      else{S.betAmt=p.bet;S.bet.set(p.bet);}
    }
    syncCards(S,p,G,i);
    if(S.label)labelText(S,p,G,i);
  });
  syncBoard(G);
  // pot: krupiye iter ya da (ev oyununda) kazanan kendisi toplar
  if(done&&!W.potPaid){
    const ws=G.players.filter(p=>p.won>0).sort((a,b)=>b.won-a.won);
    if(ws.length){
      W.potPaid=true;const S=W.seats[ws[0].idx];S.hold=true;
      const fin=S.stackPos.clone().setY(TY);
      const merge=()=>{if(!W)return;W.pot.set(0);W.pot.g.position.copy(W.potPos);S.hold=false;W.seats.forEach(Z=>Z.stack.set(Z.p.out?0:Z.p.chips));try{SFX.play('pot');}catch(e){}};
      if(W.croupier){const C=W.croupier;if(C.job)releaseJob(C.job);C.job=job('pile',{pile:W.pot,final:fin,done:merge,hands:'both',wait:1.3});C.act('push',{to:fin});}
      else if(S.person){const P=S.person;if(P.job)releaseJob(P.job);P.job=job('pile',{pile:W.pot,final:fin,done:merge,hands:'both',wait:2.4});}
      else slide(W.pot,fin,.75,.55,merge);
    }
  }
  if(!done)W.potPaid=false;
  if(G.pot!==W.potAmt&&!done){const a=G.pot;W.potAmt=a;if(a>W.pot.amt)tween(.01,()=>{},()=>{if(W&&W.potAmt===a)W.pot.set(a);},.36);else W.pot.set(a);}
  if(done)W.potAmt=G.pot;
  if(G.dealer!==W.btnIdx&&W.seats[G.dealer]){
    const to=W.seats[G.dealer].btnPos.clone(),first=W.btnIdx<0;W.btnIdx=G.dealer;
    if(first)W.btn.position.copy(to);else{const from=W.btn.position.clone();tween(.6,k=>{W.btn.position.lerpVectors(from,to,eIO(k));W.btn.position.y=to.y+Math.sin(PI*k)*.02;});}
  }
}
function dealOrigin(G){
  if(W.croupier)return W.dealFrom;
  const S=W.seats[G.dealer];return S?S.o.localToWorld(V3(0,TY+.05,.62)):W.dealFrom;
}
function dealGesture(G,to){
  if(W.croupier)W.croupier.act('dealCard',{to});
  else{const P=W.seats[G.dealer]&&W.seats[G.dealer].person;if(P&&(!P.seq||P.prio<=2))P.act('dealCard',{to});}
}
function syncCards(S,p,G,i){
  if(p.cards.length===0&&S.cards.length){S.cards.forEach(sweep);S.cards=[];S.cFold=false;S.cShow=false;}
  while(S.cards.length<p.cards.length){
    const j=S.cards.length,cd=getCard(),spot=S.spots[j];
    setFace(cd,p.human?p.cards[j]:-1);
    cd.st.pos.copy(dealOrigin(G));cd.st.yaw=R()*PI;cd.st.flip=PI;cd.st.tilt=0;cd.st.scale=S.cardScale*.9;cd.st.lift=0;applyCard(cd);
    animCard(cd,{pos:spot.pos,yaw:spot.yaw,flip:PI,tilt:0,scale:S.cardScale},.32,.05,p.human?()=>animCard(cd,{flip:0,tilt:spot.tilt},.38,.03):null);
    dealGesture(G,spot.pos);
    S.cards.push(cd);
  }
  if(p.folded&&!S.cFold&&S.cards.length){
    S.cFold=true;const P=S.person;const fin=S.cards.map(()=>V3((R()-.5)*.24,TY+.002,-.42+R()*.1));
    if(P&&P.seqName==='fold'){if(P.job)releaseJob(P.job);P.job=job('cards',{cards:S.cards.slice(),finals:fin,hands:1,wait:1});}
    else S.cards.forEach((cd,k)=>animCard(cd,{pos:fin[k],yaw:R()*TAU,flip:PI,tilt:0},.42,.05,()=>{cd.g.visible=false;},S.human?0:.22));
  }
  if(p.show&&!p.human&&!S.cShow&&!p.folded&&S.cards.length===2){S.cShow=true;S.cards.forEach((cd,j)=>{setFace(cd,p.cards[j]);animCard(cd,{pos:S.show[j],yaw:0,flip:0,tilt:.25,scale:1.55},.45,.06,null,j*.08);});}
  const vis=(p.human||p.show)&&!p.folded,ws=G.winSet;
  S.cards.forEach((cd,j)=>setHL(cd,ws&&vis?(ws.has(p.cards[j])?1:-1):0));
}
function syncBoard(G){
  if(G.board.length<W.board.length){W.board.forEach(sweep);W.board=[];}
  while(W.board.length<G.board.length){
    const i=W.board.length,cd=getCard();setFace(cd,G.board[i]);
    cd.st.pos.copy(W.dealFrom);cd.st.yaw=0;cd.st.flip=PI;cd.st.tilt=0;cd.st.scale=1.4;cd.st.lift=0;applyCard(cd);
    const to=V3(-.25+i*.125,TY+.0012,.02);
    animCard(cd,{pos:to,flip:PI,scale:1.72},.26,.03,()=>animCard(cd,{flip:0},.3,.035));
    if(W.croupier)W.croupier.act('dealCard',{to});
    W.board.push(cd);
  }
  const ws=G.winSet;W.board.forEach((cd,j)=>setHL(cd,ws?(ws.has(G.board[j])?1:-1):0));
}
function labelText(S,p,G,i){
  const done=G.phase==='done';
  const chips=p.out?'Masadan kalktı':(p.allIn&&p.inHand&&!p.folded&&!done?'All-in':fmtM(p.chips,G.venue.cur));
  let hand='';if(p.show&&!p.folded&&p.inHand&&G.board.length===5)hand=describe(evalCards(p.cards.concat(G.board)));
  const k=[chips,p.lastAct,p.actCls,hand,G.turn===i,p.folded&&p.inHand,done&&p.won>0,i===G.dealer].join('|');
  if(k===S.lt)return;S.lt=k;
  const lb=S.label;
  lb.querySelector('.c').textContent=chips;
  const a=lb.querySelector('.a');a.textContent=p.lastAct||'';a.className='a '+(p.actCls||'');
  lb.querySelector('.h').textContent=hand;
  lb.classList.toggle('turn',G.turn===i);lb.classList.toggle('folded',p.folded&&p.inHand);lb.classList.toggle('winner',done&&p.won>0);lb.classList.toggle('dealer',i===G.dealer);
}

/* ================= SALON VE YAN MASALAR =================
   Salon: kumarhaneye yürüyerek girersin; ortada poker masası, etrafta o mekânın diğer masaları (batak, rulet,
   blackjack, bakara) ve başında oyuncular. Masaya tıklarsın, oraya yürürsün, oturursun.
   Yan masa sahnesi: aynı oda, ortada seçtiğin oyunun masası. Kurallar oyunlar.js'te; burada yalnızca görüntü. */
CROUP.yeralti={sex:'m',age:48,skin:'#c99272',hair:['slick','#141010'],face:['mustache','#141010'],top:['vest','#e9e2d2','#3a1a14'],tie:['bow','#111'],expr:.35};
CROUP.yali={sex:'f',age:38,skin:'#ebc8ab',hair:['bun','#2a1a10'],top:['vest','#f6f3ec','#1f2a3a'],tie:['bow','#0b0b0d'],acc:['earrings'],expr:.3};
const croupDef=id=>CROUP[id]||CROUP.girne;
// Oturma girişi: sandalyenin arkasından otur (salondan gelince ya da masaya geçince)
function sitIntro(o,res){return {t:0,dur:2.5,res,walkK:.5,steps:3,look:o.localToWorld(V3(0,.85,1.3)),path:new T.CatmullRomCurve3([o.localToWorld(V3(.55,1.62,-1.25)),o.localToWorld(V3(0,1.6,-.55))]),step:0};}
function newWorld(id,el,V0){
  stop();
  host=el;if(!renderer)initRenderer();
  if(renderer.domElement.parentNode!==host)host.insertBefore(renderer.domElement,host.firstChild);
  labelsEl=host.querySelector('.v3-labels');if(labelsEl)labelsEl.innerHTML='';
  const V=V0||VS[id]||VS.antrenman;
  const sh=Q()!=='low';
  if(renderer.shadowMap.enabled!==sh){renderer.shadowMap.enabled=sh;MC.forEach(m=>{m.needsUpdate=true;});}
  const scene=new T.Scene();scene.background=new T.Color(V.fog[0]);scene.fog=new T.FogExp2(V.fog[0],V.fog[1]);
  W={scene,V,t:0,tw:[],upd:[],disp:[],seats:[],people:[],npcs:[],obst:[],jobs:[],pool:[],board:[],loose:[],potAmt:0,potPaid:false,turnIdx:-1,btnIdx:-1,ready:false,piles:{},slots:{},shown:{}};
  applySettings();
  try{const pm=new T.PMREMGenerator(renderer);const et=envTex(V);const rt=pm.fromEquirectangular(et);scene.environment=rt.texture;W.disp.push(rt);pm.dispose();}catch(e){}
  W.smoke=smokeSys(V.room[0]<=8?110:70);
  const bt=backTex(V.back);
  W.backMat=new T.MeshLambertMaterial({map:bt,emissiveMap:bt,emissive:'#ffffff',emissiveIntensity:.14,transparent:true,alphaTest:.4});W.disp.push(W.backMat);
  W.glowMat=new T.MeshBasicMaterial({color:'#ffd56a'});W.disp.push(W.glowMat);
  W.chipM=V.chips.map(chipMats);
  W.denoms=[1,5,25];
  buildRoom(V,id);
  W.potPos=V3(0,TY,0);W.dealFrom=V3(0,TY+.05,0);
  return V;
}
function goLive(o){
  resize();resetView();cam.yaw=Y0();cam.pitch=P0();cam.fov=cam.tFov;cam.vy=cam.vp=0;
  const tt=host.querySelector('.v3-title');if(tt)tt.innerHTML=o.title?`<b>${o.title}</b><span>${o.place||''}</span>`:'';
  W.ready=true;resize();
  if(!host._ro){host._ro=new ResizeObserver(resize);host._ro.observe(host);}
  clock.getDelta();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  return new Promise(res=>{
    W.intro=Object.assign(o.intro,{res});
    W.people.forEach(P=>{if(P){P.baseLook={k:'human'};P.reset();}});
    host.classList.add('intro');host.classList.toggle('short',!!o.short);
  });
}
// Masanın etrafında, ortaya bakan oturma yeri
function seatRing(cx,cz,deg,r){const a=deg*PI/180,c=Math.cos(a),s=Math.sin(a);const o=new T.Object3D();o.position.set(cx+c*r,0,cz+s*r);o.rotation.y=Math.atan2(-c,-s);o.updateMatrixWorld();return o;}
function seatAtXZ(x,z,yaw){const o=new T.Object3D();o.position.set(x,0,z);o.rotation.y=yaw;o.updateMatrixWorld();return o;}
function chairAt(o,style){const ch=makeChair(style);ch.position.copy(o.localToWorld(V3(0,0,-.06)));ch.rotation.y=o.rotation.y;W.scene.add(ch);return ch;}
// Oyunun parçası olan rakip (etiketi, sözü, hareketleri motordan gelir)
function seatBot(o,i,p,chair){
  if(chair)chairAt(o,chair);
  const P=makePerson(p.char||{},{idx:i,style:p.style||'gevsek'});P.root.position.copy(o.position);P.root.rotation.y=o.rotation.y;W.scene.add(P.root);
  const L=(x,y,z)=>o.localToWorld(V3(x,y,z));
  P.stackW=L(-.2,TY+.03,.56);P.cardsW=L(0,TY,.58);P.betW=L(0,TY,.75);
  const S={o,p:{out:false},cards:[],person:P,human:false,stackPos:L(-.2,TY,.56),propK:W.mode==='batak'?.72:W.mode==='rulet'?.55:1};P.seat=S;
  attachProps(P,S,p.char||{});P.init();
  W.people[i]=P;W.seats[i]=S;
  if(labelsEl){
    const lb=document.createElement('div');lb.className='p3';lb.innerHTML='<b class="n"></b><span class="c"></span><em class="a"></em><span class="h"></span><span class="say"></span>';lb.querySelector('.n').textContent=p.name;
    lb.addEventListener('click',()=>{if(cam.focus===i)resetView();else focusOn(i);});
    labelsEl.appendChild(lb);S.label=lb;
  }
  return S;
}
function seatHuman(o,chair){
  if(chair)chairAt(o,chair);
  const S={o,p:{out:false},cards:[],human:true,stackPos:o.localToWorld(V3(-.2,TY,.55))};
  W.seats[0]=S;W.human=S;W.eye=o.localToWorld(V3(0,1.19,.05));
  return S;
}
// Salon figürü: oyuna katılmaz, kendi kendine yaşar
function npcAt(d,o,opt={}){
  const P=makePerson(d,{idx:-2,standing:!!opt.standing,npc:opt.standing?'stand':'sit',style:opt.style||'gevsek',croupier:!!opt.croupier});
  P.root.position.copy(o.position);P.root.rotation.y=o.rotation.y;W.scene.add(P.root);
  if(Q()==='low')P.root.traverse(m=>{if(m.isMesh)m.castShadow=false;});
  P.npcLean=opt.lean||0;
  if(opt.rest)P.restOverride=opt.rest;
  P.baseLook=opt.look?{k:'w',v:opt.look.clone()}:{k:'w',v:o.localToWorld(V3(0,TY,.7))};
  P.reset();P.init();
  P.npcIdle=()=>{const r=R();if(r<.6)P.play([{t:2+R()*3,look:'base'}],1);else if(r<.75&&P.cup)P.act('drink');else if(r<.9)P.play([{t:1.5+R()*2,look:'away'}],1);else P.act('nod');};
  W.npcs.push(P);return P;
}
// Elinde kart tutan oyuncu (batak): kapalı kartlar yelpaze hâlinde, iki elinin arasında
const HOLD_REST=[V3(.075,.97,.3),V3(-.075,.97,.3)];
function makeFan(P,n){
  const g=new T.Group();W.scene.add(g);const F={g,P,n:-1};
  F.set=k=>{if(k===F.n)return;F.n=k;while(g.children.length)g.remove(g.children[0]);
    for(let j=0;j<k;j++){const m=new T.Mesh(CARD_GEO(),W.backMat);const a=(j-(k-1)/2)*.11;const piv=new T.Group();piv.rotation.z=-a;m.position.set(0,CH*.42,j*.0006);piv.add(m);g.add(piv);}};
  W.upd.push(()=>{if(!P.root.visible){g.visible=false;return;}g.visible=F.n>0;P.handW(_a,'both');P.root.getWorldDirection(_b);g.position.copy(_a).addScaledVector(_b,.03);g.position.y+=.02;g.rotation.set(0,P.root.rotation.y,0);g.rotateX(-.42);});
  return F;
}
function tableLamp(x,z,V,y){
  const L=V.lamp;y=y||L.y;
  const sp=new T.SpotLight(L.c,L.i*.75,7,1.0,.85,1.6);sp.position.set(x,y,z);sp.target.position.set(x,0,z);W.scene.add(sp,sp.target);
  if(L.bulb){const b=mesh(sph(.04,12,8),mat('#fff3d6',{emissive:'#ffd38a',emissiveIntensity:6}),false);b.position.set(x,y,z);W.scene.add(b);glow('#ffcf8a',.4,V3(x,y,z),.6);const cord=mesh(cyl(.004,.004,V.room[2]-y,5),mat('#111'),false);cord.position.set(x,(V.room[2]+y)/2,z);W.scene.add(cord);}
  else{const sh=mesh(geo('lampshade',()=>new T.ConeGeometry(.42,.24,28,1,true)),mat(L.shade||'#1a1a1a',{roughness:.6,side:T.DoubleSide}),false);sh.position.set(x,y+.12,z);W.scene.add(sh);
    const inner=mesh(geo('lampin',()=>new T.CircleGeometry(.4,28)),mat('#fff6e2',{emissive:L.c,emissiveIntensity:2.2}),false);inner.rotation.x=PI/2;inner.position.set(x,y+.005,z);W.scene.add(inner);
    const rod=mesh(cyl(.006,.006,V.room[2]-y-.24,6),GOLD(),false);rod.position.set(x,(V.room[2]+y+.24)/2,z);W.scene.add(rod);}
}
function feltCanvas(x,w,h,col){
  const g=x.createRadialGradient(w/2,h*.45,30,w/2,h/2,Math.max(w,h)*.62);g.addColorStop(0,shade(col,1.04));g.addColorStop(1,shade(col,.58));x.fillStyle=g;x.fillRect(0,0,w,h);
  speckle(x,w,h,Math.round(w*h*.06),.08,1.5);
}
function arcText(x,txt,cx,cy,r,mid,font,col){
  x.save();x.font=font;x.fillStyle=col;x.textAlign='center';x.textBaseline='middle';
  const cs=[...txt],ws=cs.map(c=>x.measureText(c).width),tot=ws.reduce((a,b)=>a+b,0);let a=mid+tot/r/2;
  cs.forEach((c,i)=>{a-=ws[i]/r/2;x.save();x.translate(cx+Math.cos(a)*r,cy+Math.sin(a)*r);x.rotate(a-PI/2);x.fillText(c,0,0);x.restore();a-=ws[i]/r/2;});
  x.restore();
}

/* ---------- batak masası: kare, kahvehane masası ---------- */
const BKS=.96;
function bkTableAt(V,cx,cz){
  const g=new T.Group();g.position.set(cx,0,cz);W.scene.add(g);
  const wood=V.railWood||V.worn?tmat(floorTex('wood'),{roughness:.6}):mat(shade(V.rail,1.15),{roughness:.45});
  const top=mesh(box(BKS+.14,.05,BKS+.14),wood);top.position.y=TY-.03;g.add(top);
  const ft=ctex(512,512,(x,w,h)=>{feltCanvas(x,w,h,V.felt);x.strokeStyle='rgba(255,240,200,.18)';x.lineWidth=3;x.strokeRect(26,26,w-52,h-52);});
  const felt=mesh(geo('bkfelt',()=>new T.PlaneGeometry(BKS,BKS)),tmat(ft,{roughness:.97}));felt.rotation.x=-PI/2;felt.position.y=TY;felt.receiveShadow=true;g.add(felt);
  for(const [x,z] of[[-1,-1],[1,-1],[-1,1],[1,1]]){const l=mesh(box(.06,TY-.05,.06),wood);l.position.set(x*(BKS/2),(TY-.05)/2,z*(BKS/2));g.add(l);}
  return g;
}
/* ---------- rulet masası: uzun masa, solda çark ---------- */
const RLT={len:2.3,dep:1.1,wx:-.72,x0:-.28,cw:.085,z0:-.36,rh:.13,k:445};
const RL_RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const rlCol=n=>n===0||n===37?'#1b7a45':RL_RED.has(n)?'#b3222c':'#17120e';
// Bahis alanının masa üstündeki merkezi (masa yerel koordinatı)
function rlCell(k,amer){
  const {x0,cw,z0,rh}=RLT;
  if(k[0]==='n'){const n=+k.slice(1);
    if(n===0)return [x0+cw/2,amer?z0+rh*.75:z0+rh*1.5];
    if(n===37)return [x0+cw/2,z0+rh*2.25];
    const col=Math.floor((n-1)/3),row=2-((n-1)%3);return [x0+cw*(1+col)+cw/2,z0+rh*row+rh/2];}
  if(k[0]==='c')return [x0+cw*13+cw/2,z0+rh*(3-+k[1])+rh/2];
  if(k[0]==='d')return [x0+cw*(1+4*(+k[1]-1))+cw*2,z0+rh*3+rh/2];
  const o=['low','even','red','black','odd','high'].indexOf(k);return [x0+cw*(1+2*o)+cw,z0+rh*4+rh/2];
}
function rlFeltTex(V,amer){
  const {len,dep,x0,cw,z0,rh,k}=RLT;
  return ctex(1024,490,(x,w,h)=>{
    feltCanvas(x,w,h,V.felt);
    const X=v=>(v+len/2)*k,Y=v=>(v+dep/2)*k,c=cw*k,r=rh*k;
    x.strokeStyle='rgba(255,250,235,.85)';x.lineWidth=2;x.textAlign='center';x.textBaseline='middle';
    const cell=(x1,y1,ww,hh,fill,txt,font)=>{if(fill){x.fillStyle=fill;x.fillRect(x1+3,y1+3,ww-6,hh-6);}x.strokeRect(x1,y1,ww,hh);if(txt){x.fillStyle='#fffaf0';x.font=font||'bold 22px Georgia';x.fillText(txt,x1+ww/2,y1+hh/2+1);}};
    const zx=X(x0),zy=Y(z0);
    if(amer){cell(zx,zy,c,r*1.5,'#1b7a45','0');cell(zx,zy+r*1.5,c,r*1.5,'#1b7a45','00');}else cell(zx,zy,c,r*3,'#1b7a45','0');
    for(let n=1;n<=36;n++){const col=Math.floor((n-1)/3),row=2-((n-1)%3);cell(zx+c*(1+col),zy+r*row,c,r,rlCol(n),String(n));}
    for(let i=0;i<3;i++)cell(zx+c*13,zy+r*i,c,r,null,'2:1','bold 15px Georgia');
    ['1. 12','2. 12','3. 12'].forEach((t,i)=>cell(zx+c*(1+4*i),zy+r*3,c*4,r,null,t,'bold 20px Georgia'));
    ['1–18','ÇİFT','','','TEK','19–36'].forEach((t,i)=>cell(zx+c*(1+2*i),zy+r*4,c*2,r,null,t,'bold 17px Georgia'));
    [[2,'#c42f38'],[3,'#111']].forEach(([i,col])=>{const cx=zx+c*(2+2*i),cy=zy+r*4.5;x.fillStyle=col;x.beginPath();x.moveTo(cx,cy-16);x.lineTo(cx+18,cy);x.lineTo(cx,cy+16);x.lineTo(cx-18,cy);x.closePath();x.fill();x.strokeStyle='rgba(255,250,235,.7)';x.stroke();});
    x.fillStyle='rgba(255,240,210,.12)';x.font=`40px Limelight,${RKF}`;x.fillText(amer?'AMERICAN ROULETTE':'ROULETTE',X(.33),Y(.42));
  });
}
function rotorTex(order){
  const n=order.length;
  return ctex(512,512,(x,w,h)=>{
    const c=256;x.fillStyle='#2a170c';x.fillRect(0,0,w,h);
    const g=x.createRadialGradient(c,c,10,c,c,160);g.addColorStop(0,'#8a5a2a');g.addColorStop(1,'#3a2210');x.fillStyle=g;x.beginPath();x.arc(c,c,160,0,TAU);x.fill();
    for(let i=0;i<n;i++){
      const a0=(i-.5)*TAU/n,a1=(i+.5)*TAU/n,num=order[i];
      x.fillStyle=rlCol(num);x.beginPath();x.arc(c,c,250,a0,a1);x.arc(c,c,165,a1,a0,true);x.closePath();x.fill();
      x.strokeStyle='#d9b45a';x.lineWidth=2;x.beginPath();x.moveTo(c+Math.cos(a0)*165,c+Math.sin(a0)*165);x.lineTo(c+Math.cos(a0)*250,c+Math.sin(a0)*250);x.stroke();
      x.save();x.translate(c+Math.cos(i*TAU/n)*228,c+Math.sin(i*TAU/n)*228);x.rotate(i*TAU/n+PI/2);x.fillStyle='#fff';x.font='bold 19px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(num===37?'00':String(num),0,0);x.restore();
    }
    x.strokeStyle='#d9b45a';x.lineWidth=4;x.beginPath();x.arc(c,c,165,0,TAU);x.stroke();x.beginPath();x.arc(c,c,250,0,TAU);x.stroke();
  });
}
function rlTableAt(V,cx,cz,ry,amer){
  const {len,dep,wx}=RLT;
  const g=new T.Group();g.position.set(cx,0,cz);g.rotation.y=ry||0;W.scene.add(g);
  const wood=mat(shade(V.rail,1.1),{roughness:.4});
  const top=mesh(box(len+.14,.06,dep+.14),wood);top.position.y=TY-.035;g.add(top);
  const felt=mesh(new T.PlaneGeometry(len,dep),tmat(rlFeltTex(V,amer),{roughness:.97}));felt.rotation.x=-PI/2;felt.position.y=TY;felt.receiveShadow=true;g.add(felt);
  const body=mesh(box(len-.1,TY-.1,dep-.2),mat(shade(V.rail,.7),{roughness:.6}));body.position.y=(TY-.1)/2;g.add(body);
  // çark: ahşap kase, dönen göbek, top
  const wg=new T.Group();wg.position.set(wx,TY,0);g.add(wg);
  const bowl=mesh(cyl(.37,.34,.1,48),mat('#3a2010',{roughness:.35}));bowl.position.y=.05;wg.add(bowl);
  const track=mesh(cyl(.335,.335,.004,48),mat('#2a160a',{roughness:.3}));track.position.y=.101;wg.add(track);
  const order=amer?[0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,37,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2]:[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const rotor=new T.Group();rotor.position.y=.106;wg.add(rotor);
  const disc=mesh(geo('rotor',()=>{const c=new T.CircleGeometry(.27,64);c.rotateX(-PI/2);return c;}),tmat(rotorTex(order),{roughness:.4,metalness:.1}));rotor.add(disc);
  const cone=mesh(cyl(.02,.075,.06,20),GOLD());cone.position.y=.03;rotor.add(cone);
  for(let i=0;i<4;i++){const arm=mesh(cyl(.006,.006,.16,6),GOLD());arm.rotation.z=PI/2;arm.rotation.y=i*PI/2;arm.position.y=.06;rotor.add(arm);const knob=mesh(sph(.012,8,6),GOLD());knob.position.set(Math.cos(i*PI/2)*.08,.06,-Math.sin(i*PI/2)*.08);rotor.add(knob);}
  const ball=mesh(sph(.011,12,10),mat('#fbfbf6',{roughness:.2}));ball.position.set(.315,.115,0);wg.add(ball);
  const RLs={g,wg,rotor,ball,order,rho:R()*TAU,spin:null,lock:null,amer};
  W.upd.push((dt)=>{
    const S=RLs.spin;
    if(S){S.t+=dt;const k=Math.min(1,S.t/S.D),e=1-Math.pow(1-k,3);RLs.rho=S.r0-S.A*e;
      let beta,rad,y=.115;
      if(S.t<S.T){const kb=S.t/S.T,eb=1-Math.pow(1-kb,2.2);beta=S.b0+S.B*eb;rad=kb<.78?.315:lerp(.315,.215,(kb-.78)/.22);if(kb>.78)y=.115+Math.abs(Math.sin((kb-.78)*40))*.012*(1-kb);}
      else{beta=S.alpha-RLs.rho;rad=.215;y=.11;if(!S.landed){S.landed=true;try{SFX.play('chip');}catch(e){}}}
      ball.position.set(Math.cos(beta)*rad,y,Math.sin(beta)*rad);
      if(k>=1){RLs.spin=null;RLs.lock=S.alpha;}
    }else{RLs.rho-=dt*.22;if(RLs.lock!=null){const b=RLs.lock-RLs.rho;ball.position.set(Math.cos(b)*.215,.11,Math.sin(b)*.215);}}
    rotor.rotation.y=RLs.rho;
  });
  return RLs;
}
/* ---------- blackjack / bakara masası: yarım ay ---------- */
const BJR=1.08,BJZ=-.38;
function bjFeltTex(V,kind,angs){
  return ctex(1024,512,(x,w,h)=>{
    feltCanvas(x,w,h,V.felt);
    const k=512/BJR,cx=w/2,cy=0;
    x.strokeStyle='rgba(255,245,220,.55)';x.lineWidth=3;x.beginPath();x.arc(cx,cy,BJR*k*.94,0,PI);x.stroke();
    if(kind==='bakara'){
      arcText(x,'BAKARA · PUNTO BANCO',cx,cy,BJR*k*.5,PI/2,'bold 30px Georgia','rgba(255,240,205,.82)');
      arcText(x,'BANKA %5 KOMİSYON · BERABERLİK 8:1',cx,cy,BJR*k*.42,PI/2,'bold 17px Georgia','rgba(255,240,205,.6)');
      x.strokeStyle='rgba(255,245,220,.7)';x.lineWidth=2.5;
      [['OYUNCU',-.27,'#9cc3ff'],['BANKA',.27,'#ff9f9f']].forEach(([t,dx,col])=>{const X=cx+dx*k,Y=.26*k;x.strokeRect(X-.17*k,Y-.09*k,.34*k,.18*k);x.fillStyle=col;x.font='bold 20px Georgia';x.textAlign='center';x.fillText(t,X,Y+.12*k);});
      angs.forEach(a=>{[-7,0,7].forEach((d,j)=>{const b=(a+d)*PI/180,X=cx+Math.cos(b)*BJR*k*.8,Y=cy+Math.sin(b)*BJR*k*.8;x.fillStyle=['rgba(80,140,255,.35)','rgba(80,200,120,.35)','rgba(255,90,90,.35)'][j];x.beginPath();x.arc(X,Y,22,0,TAU);x.fill();x.stroke();});});
    }else{
      arcText(x,'BLACKJACK 3\'E 2 ÖDER',cx,cy,BJR*k*.52,PI/2,'bold 32px Georgia','rgba(255,240,205,.85)');
      arcText(x,'KRUPİYE 17\'DE DURUR · SİGORTA YOK',cx,cy,BJR*k*.43,PI/2,'bold 17px Georgia','rgba(255,240,205,.6)');
      x.strokeStyle='rgba(255,245,220,.7)';x.lineWidth=2.5;
      angs.forEach(a=>{const b=a*PI/180,X=cx+Math.cos(b)*BJR*k*.8,Y=cy+Math.sin(b)*BJR*k*.8;x.beginPath();x.arc(X,Y,30,0,TAU);x.stroke();});
    }
  });
}
function bjTableAt(V,cx,cz,ry,kind,angs){
  const g=new T.Group();g.position.set(cx,0,cz);g.rotation.y=ry||0;W.scene.add(g);
  const s=new T.Shape();s.moveTo(-BJR,-BJZ);s.absarc(0,-BJZ,BJR,PI,2*PI,false);s.lineTo(-BJR,-BJZ);
  const fg=new T.ShapeGeometry(s,64);fg.rotateX(-PI/2);
  const p=fg.attributes.position,uv=fg.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+BJR)/(2*BJR),1-(p.getZ(i)-BJZ)/BJR);
  const felt=new T.Mesh(fg,tmat(bjFeltTex(V,kind,angs),{roughness:.97}));felt.position.y=TY;felt.receiveShadow=true;g.add(felt);
  const railM=V.railWood?tmat(floorTex('wood'),{roughness:.6}):mat(V.rail,{roughness:.42});
  const rail=mesh(geo('bjrail',()=>{const t=new T.TorusGeometry(BJR+.035,.045,10,56,PI);t.rotateX(PI/2);return t;}),railM);rail.position.set(0,TY+.005,BJZ);g.add(rail);
  const edge=mesh(box(2*BJR+.16,.07,.09),railM);edge.position.set(0,TY-.01,BJZ-.03);g.add(edge);
  const sk=new T.ExtrudeGeometry(s,{depth:.12,bevelEnabled:false,curveSegments:48});sk.rotateX(-PI/2);
  const skirt=mesh(sk,mat(shade(V.rail,.8),{roughness:.6}));skirt.position.y=TY-.13;g.add(skirt);
  const ped=mesh(cyl(.2,.3,.6,16),mat('#141110',{roughness:.5}));ped.position.set(0,.31,0);g.add(ped);
  const shoe=mesh(box(.11,.08,.2),mat('#2a1a12',{roughness:.5}));shoe.position.set(.62,TY+.04,BJZ+.14);shoe.rotation.y=-.5;g.add(shoe);
  return g;
}
// Masa yerel noktası → dünya
const tw=(g,x,y,z)=>g.localToWorld(V3(x,y,z));

/* ---------- yan masa sahnesi ---------- */
function side(spec,el){
  const id=spec.id,V=newWorld(id,el),mode=spec.mode;
  W.mode=mode;W.pitch0=-.29;W.yaw0=0;W.denoms=[spec.min,spec.min*5,spec.min*25];
  const bots=spec.players||[];
  let hs;
  if(mode==='batak'){
    W.tableG=bkTableAt(V,0,0);W.tableG.updateMatrixWorld(true);
    const r=BKS/2+.38,chair=V.chair;
    hs=seatHuman(seatRing(0,0,90,r),chair);
    [0,270,180].forEach((deg,k)=>{const S=seatBot(seatRing(0,0,deg,r),k+1,bots[k]||{name:'?'},chair);S.person.restOverride=HOLD_REST;S.person.reset();S.fan=makeFan(S.person,0);});
    // yere atılan kartlar masanın biraz karşı tarafında: senin elinin altında kalmasın
    W.bkSlot=[90,0,270,180].map(deg=>{const a=deg*PI/180;return V3(Math.cos(a)*.15,TY+.002,-.07+Math.sin(a)*.12);});
    W.pitch0=-.5;
  }else if(mode==='rulet'){
    W.tableG=new T.Group();
    W.rl=rlTableAt(V,0,0,0,spec.amer);W.tableG=W.rl.g;W.tableG.updateMatrixWorld(true);
    const fz=RLT.dep/2+.38;
    hs=seatHuman(seatAtXZ(.12,fz,PI),V.chair);
    // oyuncular: karşı köşede, masanın ucunda ve solunda; ikisi kadrajda görünür
    const spots=[[.95,-RLT.dep/2-.4,0],[RLT.len/2+.4,-.08,-PI/2],[-.62,fz,PI]];
    bots.forEach((p,k)=>{const [x,z,y]=spots[k];seatBot(seatAtXZ(x,z,y),k+1,p,V.chair);});
    const co=seatAtXZ(-.3,-RLT.dep/2-.42,0);const C=makePerson(croupDef(id),{idx:-1,standing:true,croupier:true});C.root.position.copy(co.position);C.root.rotation.y=0;W.scene.add(C.root);C.stackW=V3(-.3,TY,-.3);C.cardsW=V3(-.3,TY,-.2);C.betW=V3(0,TY,0);C.init();W.croupier=C;
    W.potPos=V3(.3,TY,-.1);W.house=V3(-.1,TY+.02,-.45);
    const rack=makePile('stack',150);rack.g.position.set(.15,TY+.01,-.47);rack.set(spec.min*600);
    W.yaw0=.1;W.pitch0=-.27;
  }else{
    const angs=[150,25,72];   // sen, ilk koltuk, orta koltuk
    W.tableG=bjTableAt(V,0,0,0,mode,angs);W.tableG.updateMatrixWorld(true);
    const r=BJR+.38;
    hs=seatHuman(seatRing(0,BJZ,angs[0],r),V.chair==='plastic'?'wood':V.chair);
    bots.forEach((p,k)=>{seatBot(seatRing(0,BJZ,angs[k+1],r),k+1,p,V.chair==='plastic'?'wood':V.chair);});
    const C=makePerson(croupDef(id),{idx:-1,standing:true,croupier:true});C.root.position.set(0,0,BJZ-.42);W.scene.add(C.root);C.stackW=V3(0,TY,BJZ+.1);C.cardsW=V3(0,TY,BJZ+.2);C.betW=V3(0,TY,0);C.init();W.croupier=C;
    W.dealFrom=V3(.6,TY+.08,BJZ+.14);W.house=V3(0,TY+.02,BJZ+.08);W.potPos=V3(0,TY,BJZ+.25);
    const rack=makePile('stack',150);rack.g.position.set(-.05,TY+.01,BJZ+.08);rack.set(spec.min*600);
    // kart yerleri: krupiye sırası, her koltuğun önü
    const tan=a=>V3(Math.sin(a),0,-Math.cos(a));
    W.slots.d={pos:V3(-.12,TY+.002,BJZ+.24),step:V3(.075,.0004,0),yaw:0};
    if(mode==='bakara'){W.slots.p={pos:V3(-.36,TY+.002,BJZ+.26+.04),step:V3(.075,.0004,0),yaw:0};W.slots.b={pos:V3(.18,TY+.002,BJZ+.3),step:V3(.075,.0004,0),yaw:0};}
    angs.forEach((deg,i)=>{const a=deg*PI/180,c=V3(Math.cos(a)*BJR*.6,TY+.002,BJZ+Math.sin(a)*BJR*.6),t=tan(a),yaw=W.seats[i].o.rotation.y+PI;
      const st=t.clone().multiplyScalar(.05).setY(.0004);
      if(i===0){W.slots.h0={pos:c.clone().addScaledVector(t,-.12),step:st,yaw};W.slots.h1={pos:c.clone().addScaledVector(t,.12),step:st,yaw};}
      else W.slots['b'+i]={pos:c.clone().addScaledVector(t,-.04),step:st,yaw};
      const bp=V3(Math.cos(a)*BJR*.8,TY,BJZ+Math.sin(a)*BJR*.8);
      if(mode==='bakara')['p','t','b'].forEach((k,j)=>{const b=(deg+[-7,0,7][j])*PI/180;W.piles[k+i]={pos:V3(Math.cos(b)*BJR*.8,TY,BJZ+Math.sin(b)*BJR*.8),owner:i};});
      else{W.piles['bet'+i]={pos:bp,owner:i};if(i===0)W.piles.bet0b={pos:bp.clone().addScaledVector(t,.12),owner:0};}
    });
    W.pitch0=-.13;W.yaw0=Math.atan2(Math.cos(angs[0]*PI/180),Math.sin(angs[0]*PI/180))-.32;
  }
  return goLive({title:spec.title,place:spec.place,short:true,intro:sitIntro(hs.o)});
}
/* kartlar: bir yerdeki kart dizisini motorun durumuna eşitle (yeni kart dağıtılır, açılan kart çevrilir) */
function cardsSet(slot,arr,hide){
  if(!W||!W.ready)return;const L=W.slots[slot];if(!L)return;
  const cur=W.shown[slot]||(W.shown[slot]=[]);
  if(arr.length<cur.length){cur.forEach(cd=>{const i=W.board.indexOf(cd);if(i>=0)W.board.splice(i,1);sweep(cd);});cur.length=0;}
  cur.forEach((cd,j)=>{const face=j===hide?-1:arr[j];if(cd.face!==face){cd.face=face;setFace(cd,face>=0?face:-1);if(face>=0){animCard(cd,{flip:0},.35,.04);try{SFX.play('flip');}catch(e){}}}});
  while(cur.length<arr.length){
    const j=cur.length,cd=getCard(),face=j===hide?-1:arr[j];cd.face=face;setFace(cd,face>=0?face:-1);
    cd.st.pos.copy(W.dealFrom);cd.st.yaw=L.yaw+R()*.6;cd.st.flip=PI;cd.st.tilt=0;cd.st.scale=1.1;cd.st.lift=0;applyCard(cd);
    const to=L.pos.clone().addScaledVector(L.step,j);
    animCard(cd,{pos:to,yaw:L.yaw+(R()-.5)*.06,flip:PI,scale:1.3},.32,.05,face>=0?()=>animCard(cd,{flip:0},.3,.035):null);
    if(W.croupier)W.croupier.act('dealCard',{to});
    W.board.push(cd);cur.push(cd);
  }
}
function cardsClear(){if(!W)return;for(const k in W.shown){W.shown[k].forEach(cd=>{const i=W.board.indexOf(cd);if(i>=0)W.board.splice(i,1);sweep(cd);});W.shown[k]=[];}}
/* fiş yığınları: bahisler masada görünür; kazanınca sahibine, kaybedince kasaya gider */
function pileAt(key){
  let P=W.piles[key];if(!P)return null;
  if(!P.pile){P.pile=makePile('bet',90);P.pile.g.position.copy(P.pos);}
  return P;
}
function pileSet(key,amt,pos,owner){
  if(!W||!W.ready)return;
  if(pos&&!W.piles[key])W.piles[key]={pos:pos.clone(),owner:owner||0};
  const P=pileAt(key);if(!P)return;
  if(P.busy)return;
  const was=P.pile.amt;P.pile.g.position.copy(P.pos);P.pile.set(amt);
  if(amt>Math.max(0,was)){try{SFX.play('chip');}catch(e){}const S=W.seats[P.owner];if(S&&S.person&&!S.person.seq)S.person.act('call');}
}
function ownerPos(i){const S=W.seats[i];return S?S.stackPos.clone().setY(TY):W.house;}
// kind: 'win' (önce kasa üstüne koyar, sonra sahibine iter), 'lose' (kasaya), 'back' (sahibine)
function pileOut(key,kind,winAmt){
  if(!W||!W.ready)return;const P=W.piles[key];if(!P||!P.pile||P.pile.amt<=0)return;
  P.busy=true;const pl=P.pile;
  const fin=()=>{pl.set(0);pl.g.position.copy(P.pos);P.busy=false;};
  if(kind==='lose'){if(W.croupier)W.croupier.act('push',{to:P.pos});slide(pl,W.house,.5,.25,fin);}
  else if(kind==='win'){tween(.01,()=>{},()=>{pl.set(winAmt||pl.amt*2);try{SFX.play('chip');}catch(e){}},.35);if(W.croupier)W.croupier.act('push',{to:P.pos});slide(pl,ownerPos(P.owner),.6,1.0,fin);}
  else slide(pl,ownerPos(P.owner),.5,.3,fin);
}
function pilesClear(prefix){if(!W)return;for(const k in W.piles){if(prefix&&!k.startsWith(prefix))continue;const P=W.piles[k];if(P.pile&&!P.busy){P.pile.set(0);P.pile.g.position.copy(P.pos);}}}
function sideLabel(i,o){
  if(!W||!W.ready)return;const S=W.seats[i];if(!S||!S.label)return;const lb=S.label;
  if(o.c!=null)lb.querySelector('.c').textContent=o.c;
  if(o.a!==undefined){const a=lb.querySelector('.a');a.textContent=o.a||'';a.className='a '+(o.cls||'');}
  if(o.h!==undefined)lb.querySelector('.h').textContent=o.h||'';
  if(o.turn!==undefined)lb.classList.toggle('turn',!!o.turn);
  if(o.win!==undefined)lb.classList.toggle('winner',!!o.win);
}
function sideTurn(i){if(W&&W.ready){W.turnIdx=i;W.seats.forEach((S,k)=>S&&S.label&&S.label.classList.toggle('turn',k===i));W.people.forEach((P,k)=>{if(P)P.st.turn=k===i;});}}
/* batak */
function bkFan(i,n){if(W&&W.ready&&W.seats[i]&&W.seats[i].fan)W.seats[i].fan.set(n);}
function bkPlay(i,c){
  if(!W||!W.ready)return;const S=W.seats[i];const cd=getCard();setFace(cd,c);
  const from=S.fan?S.fan.g.position.clone():S.o.localToWorld(V3(0,TY+.12,.35));
  cd.st.pos.copy(from);cd.st.yaw=S.o.rotation.y+PI;cd.st.flip=S.human?0:PI;cd.st.tilt=0;cd.st.scale=1.25;cd.st.lift=0;applyCard(cd);
  const to=W.bkSlot[i].clone();to.y+=W.board.length*.0008;
  animCard(cd,{pos:to,yaw:(R()-.5)*.25,flip:0,scale:1.45},.38,.06);
  if(S.person)S.person.act('dealCard',{to});
  try{SFX.play('deal');}catch(e){}
  W.board.push(cd);
}
function bkWin(i){if(!W||!W.ready)return;const k=W.board.length;W.board.forEach((cd,j)=>setHL(cd,0));}
function bkTake(i){
  if(!W||!W.ready)return;const S=W.seats[i];const to=S.o.localToWorld(V3(.3,TY+.004,.62));
  const cs=W.board.splice(0);
  cs.forEach((cd,j)=>{W.loose.push(cd);animCard(cd,{pos:to.clone().setY(TY+.004+j*.001),flip:PI,yaw:S.o.rotation.y+PI/2,scale:1.1},.4,.04,()=>{cd.g.visible=false;const q=W.loose.indexOf(cd);if(q>=0)W.loose.splice(q,1);W.pool.push(cd);},j*.04);});
  if(S.person)S.person.act('push',{to:W.bkSlot[i]});
}
function bkClear(){if(!W)return;W.board.splice(0).forEach(sweep);}
/* rulet */
function rlSpin(idx,dur){
  if(!W||!W.rl)return;const RLs=W.rl,n=RLs.order.length;
  RLs.lock=null;const D=dur||4.6,T2=D*.78,A=TAU*(1.6+R()*.6),r0=RLs.rho;
  const rhoT=r0-A*(1-Math.pow(1-T2/D,3));
  const alpha=idx*TAU/n,B=TAU*(4+R());
  RLs.spin={t:0,D,T:T2,A,r0,B,alpha,b0:alpha-rhoT-B};
  if(W.croupier)W.croupier.act('dealCard',{to:RLs.wg.getWorldPosition(V3())});
}
function rlPos(key,owner){
  const [x,z]=rlCell(key,W.rl&&W.rl.amer);const o=owner?[[0,0],[-.018,-.014],[.018,-.014],[0,.016]][owner%4]:[0,0];
  return W.rl.g.localToWorld(V3(x+o[0],TY,z+o[1]));
}
function rlBet(owner,key,amt){if(!W||!W.rl)return;const k='r'+owner+':'+key;pileSet(k,amt,rlPos(key,owner),owner);}
function rlSettle(pays){ // pays: {key: kat (0=kayıp)}
  if(!W||!W.rl)return;
  for(const k in W.piles){if(k[0]!=='r')continue;const P=W.piles[k];if(!P.pile||P.pile.amt<=0)continue;const m=pays[k.split(':')[1]]||0;
    if(m>0)pileOut(k,'win',P.pile.amt*(m+1));else pileOut(k,'lose');}
}
function rlMarker(n){
  if(!W||!W.rl)return;
  if(!W.rl.dolly){const d=new T.Group();const b=mesh(cyl(.016,.018,.05,16),GLASS(),false);b.position.y=.025;d.add(b);const t=mesh(cyl(.012,.012,.012,16),GOLD(),false);t.position.y=.056;d.add(t);W.scene.add(d);W.rl.dolly=d;}
  const d=W.rl.dolly;if(n==null){d.visible=false;return;}d.visible=true;d.position.copy(rlPos('n'+n,0));
}

/* ---------- salon ---------- */
function hall(spec,el){
  const id=spec.id,V0=VS[id]||VS.antrenman;
  const f=Math.max(1.45,11.5/V0.room[0]);
  const V=Object.assign({},V0,{room:[V0.room[0]*f,V0.room[1]*f,V0.room[2]]});
  newWorld(id,el,V);
  W.hall=[];W.pitch0=-.17;W.yaw0=0;
  const [w,d]=V.room;
  const tag=(g,key)=>{g.userData.hk=key;};
  // poker masası ortada, ana lambanın altında
  buildTable(V,{name:spec.name});tag(W.table,'poker');
  const ang=seatAngles((spec.rivals||[]).length+1,V.casino);
  W.hall.push({key:'poker',g:W.table,top:V3(0,TY+.95,0),stand:seatFrame(90).localToWorld(V3(0,1.62,-.65)),look:V3(0,.9,0)});
  chairAt(seatFrame(90),V.chair);
  (spec.rivals||[]).forEach((p,k)=>{const o=seatFrame(ang[k+1]);chairAt(o,V.chair);const P=npcAt(p.char||{},o,{style:p.style,look:V3(0,TY,0)});attachProps(P,{o},p.char||{});});
  if(V.casino){const o=seatFrame(270,.3);npcAt(croupDef(id),o,{standing:true,croupier:true,look:V3(0,TY,0)});}
  // diğer masalar: köşelere
  const hx=Math.min(3.3,w/2-1.9),slots=[[-hx,-1.5,.35],[hx,-1.5,-.35],[-hx,2.1,-.3],[hx,2.1,.3]];
  (spec.tables||[]).filter(t=>t.key!=='poker').forEach((t,k)=>{
    const [x,z,ry]=slots[k%4];
    let g,stand,look;
    if(t.key==='batak'){
      g=bkTableAt(V,x,z);g.rotation.y=ry;g.updateMatrixWorld(true);
      [90,0,270,180].forEach((deg,j)=>{const a=deg*PI/180+(-ry),o=seatRing(x,z,deg-ry*180/PI,BKS/2+.38);
        if(j===0){chairAt(o,V.chair);stand=o.localToWorld(V3(0,1.62,-.65));return;}
        chairAt(o,V.chair);const P=npcAt(npcDef('gambler'),o,{look:V3(x,TY,z),rest:HOLD_REST});makeFan(P,6+Math.floor(R()*6)).set(6+Math.floor(R()*6));});
      look=V3(x,.85,z);
    }else if(t.key==='rulet'){
      const RLs=rlTableAt(V,x,z,ry,t.amer);g=RLs.g;g.updateMatrixWorld(true);
      stand=tw(g,.35,1.62,RLT.dep/2+.9);look=tw(g,0,.85,0);
      npcAt(croupDef(id),{position:tw(g,-.3,0,-RLT.dep/2-.42),rotation:{y:ry}},{standing:true,croupier:true,look:tw(g,0,TY,0)});
      [[-.3,RLT.dep/2+.4],[1.0,RLT.dep/2+.4]].forEach(([a,b])=>{npcAt(npcDef(V.casino?'elegant':'gambler'),{position:tw(g,a,0,b),rotation:{y:ry+PI}},{standing:true,look:tw(g,.3,TY,0)});});
      for(let i=0;i<5;i++){const pl=makePile('bet',30);pl.g.position.copy(tw(g,RLT.x0+.1+R()*1,TY,RLT.z0+R()*.6));pl.set(Math.ceil(R()*4)*25*(1+R()*3|0));}
    }else{
      const angs=[150,25,72];g=bjTableAt(V,x,z,ry,t.key,angs);g.updateMatrixWorld(true);
      const rr=BJR+.38,ch=V.chair==='plastic'?'wood':V.chair;
      // masa yerel oturma yeri → dünya (masa döndürülmüş olabilir)
      const wo=deg=>{const o=seatRing(0,BJZ,deg,rr);g.add(o);o.updateMatrixWorld(true);return {localToWorld:v=>o.localToWorld(v),position:o.getWorldPosition(V3()),rotation:{y:o.rotation.y+ry}};};
      const h0=wo(angs[0]);chairAt(h0,ch);stand=h0.localToWorld(V3(0,1.62,-.65));look=tw(g,0,.85,BJZ);
      npcAt(croupDef(id),{position:tw(g,0,0,BJZ-.42),rotation:{y:ry}},{standing:true,croupier:true,look:tw(g,0,TY,0)});
      [angs[1],angs[2]].forEach(deg=>{const o=wo(deg);chairAt(o,ch);npcAt(npcDef(V.casino?'elegant':'gambler'),o,{look:tw(g,0,TY,BJZ)});});
    }
    tableLamp(x,z,V);
    tag(g,t.key);
    W.hall.push({key:t.key,g,top:V3(x,TY+.95,z),stand,look});
  });
  // masa etiketleri
  if(labelsEl)W.hall.forEach(H=>{
    const t=(spec.tables||[]).find(q=>q.key===H.key)||{name:H.key};
    const lb=document.createElement('button');lb.type='button';lb.className='t3'+(t.ok===false?' no':'');lb.innerHTML=`<b></b><span></span>`;
    lb.querySelector('b').textContent=t.name;lb.querySelector('span').textContent=t.sub||'';
    lb.addEventListener('click',()=>{if(W&&W.onPick&&!W.walk&&!W.intro)W.onPick(H.key);});
    labelsEl.appendChild(lb);H.label=lb;
  });
  W.onPick=spec.onPick;
  W.eye=V3(0,1.64,Math.min(3.4,d/2-1.6));
  const z0=d/2-.6;
  const intro=spec.back?{t:0,dur:1.4,walkK:.4,steps:2,stand:true,look:V3(0,1.1,0),path:new T.CatmullRomCurve3([V3(.4,1.64,W.eye.z+.5),V3(0,1.64,W.eye.z+.2)]),step:0}
    :{t:0,dur:5.2,walkK:.82,steps:8,stand:true,look:V3(0,1.1,0),path:new T.CatmullRomCurve3([V3(-.5,1.64,z0),V3(-.25,1.64,(z0+W.eye.z)/2),V3(0,1.64,W.eye.z+.15)]),step:0};
  return goLive({title:spec.name,place:spec.place,short:!!spec.back,intro});
}
function updHallLabels(){
  const w=host.clientWidth,h=host.clientHeight;
  W.hall.forEach(H=>{
    const lb=H.label;if(!lb)return;
    _t.copy(H.top);_w.copy(_t).applyMatrix4(camera.matrixWorldInverse);
    if(_w.z>-.3){lb.style.display='none';return;}
    _t.project(camera);const x=(_t.x*.5+.5)*w,y=(-_t.y*.5+.5)*h;
    if(x<-60||x>w+60||y<-30||y>h+30){lb.style.display='none';return;}
    lb.style.display='';lb.style.transform=`translate(${x|0}px,${y|0}px)`;
  });
}
function hallGo(key){
  return new Promise(res=>{
    if(!W||!W.hall){res();return;}const H=W.hall.find(x=>x.key===key);if(!H){res();return;}
    if(W.intro){W.intro.t=W.intro.dur;}
    const a=camera.position.clone(),b=H.stand.clone();const mid=a.clone().lerp(b,.5);mid.y=1.64;
    const dist=a.distanceTo(b);
    W.walk={t:0,dur:cl(dist*.62,1.2,4),path:new T.CatmullRomCurve3([a,mid,b]),look:H.look,steps:Math.max(3,Math.round(dist*1.6)),step:0,res};
    host.classList.add('walking');
  });
}

/* ---------- dış arayüz ---------- */
// act: hareket gerçekten başladıysa true döner (davranış notu yalnızca görünen hareket için yazılsın diye)
function act(p,v,o){if(!W||!W.ready||!p)return false;const P=W.people[p.idx];if(!P)return false;return P.act(v,o||{})!==false;}
function attend(i,dur=1.6,prob=.6){if(!W||!W.ready)return;W.people.forEach(P=>{if(P&&P.idx!==i&&!P.st.out&&!P.seq&&R()<prob)P.act('attend',{i,dur:dur*(.7+R()*.6)});});}
function inView(p){
  if(!W||!W.ready)return true;const P=W.people[p.idx];if(!P)return true;
  P.headW(_t);_w.copy(_t).applyMatrix4(camera.matrixWorldInverse);if(_w.z>0)return false;
  _t.project(camera);return Math.abs(_t.x)<.92&&Math.abs(_t.y)<.95;
}
function say(p,text,ms){
  if(!W||!W.ready||!p)return false;const S=W.seats[p.idx];if(!S||!S.label)return false;
  const el=S.label.querySelector('.say');if(!el)return false;
  ms=ms||2600;el.textContent=text;el.classList.add('on');clearTimeout(S.sayT);S.sayT=setTimeout(()=>el.classList.remove('on'),ms);
  const P=S.person;if(P&&!P.st.out){const dur=Math.min(ms/1000,text.length*.075+.5);P.talkUntil=W.t+dur;
    if(!P.seq)P.play([{t:dur,gest:1,fn:()=>{P.gest2=R()<.5;}},{t:.3,gest:0}],1);}
  return true;
}
function croup(a,o){if(W&&W.ready&&W.croupier)W.croupier.act(a,o||{});}
function shuffle(G){if(!W||!W.ready)return;if(W.croupier)W.croupier.act('shuffle');else{const P=W.seats[G.dealer]&&W.seats[G.dealer].person;if(P)P.act('shuffle');}}
return {ok:true,start,stop,sync,act,attend,cine,inView,shuffle,say,croup,resetView,focus:focusOn,applySettings,
  hall,hallGo,side,cardsSet,cardsClear,pileSet,pileOut,pilesClear,sideLabel,sideTurn,bkFan,bkPlay,bkTake,bkClear,rlSpin,rlBet,rlSettle,rlMarker,
  sideSay:(i,t,ms)=>say({idx:i},t,ms),sideAct:(i,v,o)=>act({idx:i},v,o),get active(){return !!(W&&W.ready);},get world(){return W;},get camera(){return camera;}};
})();
