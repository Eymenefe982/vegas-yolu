'use strict';
// Vegas Yolu servis çalışanı: önce ağ (hep güncel sürüm), ağ yoksa önbellek. Oyun çevrimdışı da açılır.
const AD='vegas-yolu-v2';
const CEKIRDEK=['./','index.html','css/stil.css','lib/three.min.js','js/ek.js','js/sahne.js','js/avatar.js','js/oyun.js','js/ekstra.js','js/oyunlar.js','js/cip.js','js/firebase-ayar.js','js/bulut.js','ikon.png','ikon-192.png','ikon-512.png','manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(AD).then(c=>Promise.all(CEKIRDEK.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==AD).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return;   // Firebase, yazı tipleri ve diğer dış kaynaklar tarayıcıya kalır
  e.respondWith(fetch(r).then(res=>{
    if(res&&res.ok){const kopya=res.clone();caches.open(AD).then(c=>c.put(r,kopya));}
    return res;
  }).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):undefined))));
});
