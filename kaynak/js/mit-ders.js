'use strict';
/* ================= MIT dersleri: orta ve üst düzey =================
   Kaynak: MIT OpenCourseWare, 15.S50 "Poker Theory and Analytics" (Ocak 2015), lisans CC BY-NC-SA 4.0.
   Ders notları Türkçeleştirilip oyuna uyarlandı. mit.js'ten sonra yüklenir. */

const MIT_SRC=w=>`<p class="mit-src">Kaynak: MIT OpenCourseWare, 15.S50 “Poker Theory and Analytics” (Ocak 2015)${w?', '+w:''}. Lisans: CC BY-NC-SA 4.0. İçerik bu oyun için Türkçeleştirilip uyarlandı.</p>`;
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const f0=x=>Math.round(x).toLocaleString('tr-TR');

/* ---------------- ORTA DÜZEY ---------------- */
function Mi_analiz(){
  return `<p class="lead">Poker, birbirini izleyen <b>karar noktalarından</b> oluşur: kontrol, bahis, görme, artırma ya da çekilme imkânı olan her an bir karar noktasıdır. İyi oyuncu sonuca değil, o noktadaki karara bakar.</p>
  <h3>Hangi karar “ilginç”?</h3>
  <p>Seçeneklerinin beklenen değeri sana belli değilse o karar incelemeye değer. Rakibin neye bahis yaptığını bilmediğin, hesabı kafandan çıkaramadığın noktaları not al; antrenmanda onları tekrar çalış.</p>
  <h3>Rakip modeli: beş adımlık döngü</h3>
  <ol>
    <li>Belirli bir durumu seç (ör. büyük körde, kısa fişli rakibin all-in'ine karşı).</li>
    <li>O durumdaki rakip için varsayılan bir model kur: “tanımadığım biri bu hamleyi hangi ellerle yapar?”</li>
    <li>Modeli elindeki bilgiyle ayarla (kaç el oynadı, hangi pozisyondan, ne gösterdi).</li>
    <li>Seçeneklerini bu modele karşı değerlendir.</li>
    <li>Model yanlış çıkarsa (çıkacaktır) düzelt ve başa dön.</li>
  </ol>
  <div class="callout"><b>Örnek (MIT notlarından)</b> Bir turnuva ortasında kısa fişli rakip all-in yapıyor. Varsayılan modelde (geniş bir push aralığı) görmek kârlı çıkıyor. Ama rakibin 73 elde yalnızca %11'ini oynadığını görürsen aralığı daraltırsın; hesap rakibin elleri yaklaşık %24'ten daha dar olduğunda “çekil”e dönüyor. Aynı elle, aynı pozisyonda, yalnızca rakip modeli değişince karar değişti.</div>
  <h3>İstatistik nasıl okunur?</h3>
  <ul>
    <li>Çoğu istatistik “fırsatın yüzde kaçında” demektir: <b>(yapılma sayısı ÷ fırsat sayısı) × 100</b>.</li>
    <li><b>VPIP</b>: Ön-flop'ta gönüllü olarak pota para koyduğu ellerin yüzdesi. Oyunda bunu rakibin kaç elde oynadığına bakarak tahmin edersin.</li>
    <li><b>Örnek büyüklüğü</b>: 73 elde 8 küçük kör eli, bir oyuncuyu tanımak için azdır. Az veriye fazla güvenme.</li>
    <li>Boşa çaba: kâr-zarar grafiğine bakmak, şansı analiz etmek, oynayamadığın elleri incelemek ve örneği yetersiz istatistiklere yaslanmak.</li>
  </ul>
  <h3>Dört mizaç</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Mizaç</th><th>Nasıl oynar</th><th>Oyundaki karşılığı</th></tr></thead><tbody>
    <tr><td><b>Sıkı-agresif</b> (TAG)</td><td>Az el oynar, oynadığında bahis yapar. Sağlam “ABC poker”.</td><td>Köpekbalığı, Sıkı (kaya)</td></tr>
    <tr><td><b>Gevşek-agresif</b> (LAG)</td><td>Çok el oynar ve sık bahis yapar; baskı kurar.</td><td>Saldırgan, Tilki</td></tr>
    <tr><td><b>Sıkı-pasif</b></td><td>Az el oynar ama çoğunu görerek geçer.</td><td>Çekingen kaya tipi</td></tr>
    <tr><td><b>Gevşek-pasif</b></td><td>Çok el oynar, çok görür, az artırır (“çağrı makinesi”).</td><td>Gevşek</td></tr>
  </tbody></table></div>
  <p>Mizaç belli olunca plan belli olur: çağrı makinesine değer bahsi yap, blöf yapma; sıkı rakibin artışına saygı göster, blind'larını rahatça çal.</p>
  ${miniCheck([
    {q:'Bir rakibi 8 elde gördün ve çok az el oynadı. Ona “kesinlikle çok sıkı” demek doğru mu?',o:['Evet, net bir okuma bu','Hayır, örnek çok küçük; modeli geçici tut'],a:1,w:'Az veriyle kesin hüküm kurma. Varsayılan modelden başla, gözlemledikçe ayarla.'},
    {q:'Karar noktası ne zaman “ilginç” sayılır?',o:['Elin çok iyiyse','Seçeneklerin beklenen değeri sana belli değilse','Pot büyükse'],a:1,w:'İnceleme zamanını beklenen değeri belirsiz kararlara harca.'}
  ])}
  ${MIT_SRC('Joel Fried: “Analytical Techniques”')}`;
}

function Mi_zimni(){
  setTimeout(()=>{
    const f=()=>{
      const pot=Math.max(1,+$('#f-pot').value||0),bet=Math.max(0,+$('#f-bet').value||0),w=clamp((+$('#f-w').value||0)/100,0,1);
      const e1=w*pot+bet*(2*w-1);                       // çağrılırsa beklenen değer
      const F=e1>=0?0:-e1/(pot-e1);                      // EV=0 için gereken çekilme
      const base=bet/(pot+bet);
      $('#f-need').textContent=pct(F);$('#f-base').textContent=pct(base);
      const v=$('#f-v');
      v.className='verdict '+(w>=.15?'ok':'mid');
      v.innerHTML=w<=0?`<b>Saf blöf.</b> Rakibin en az ${pct(base)} sıklıkla çekilmesi gerekir.`:`<b>Yarı-blöf.</b> Elinin kazanma şansı rakibin çekilme ihtiyacını ${pct(base)}'den ${pct(F)}'e indirdi.`;
    };
    $$('#fcalc input').forEach(x=>x.oninput=f);f();
  },0);
  return `<p class="lead">Pot oranı bir <i>görme</i> kararının fiyatını söyler. Bu derste iki yeni araç ekliyoruz: elini tamamladığında kazanacağın fazladan fişi sayan <b>zımni oran</b> ve rakibi çekilmeye zorlayarak kazanan <b>fold equity</b>.</p>
  <h3>Beklenen değer (EV)</h3>
  <p><b>EV = kazanma % × kazanç − kaybetme % × kayıp</b>. Bütün kararlar sonunda buna iner. EV sıfırın üstündeyse karar uzun vadede kârlıdır.</p>
  <h3>Pot oranı ve 2-4 kuralı (tekrar)</h3>
  <ul>
    <li>Görmek kârlıdır, eğer: <b>kazanma % &gt; görme tutarı ÷ (pot + bahis + görme)</b>.</li>
    <li>Her out yaklaşık %2 değerindedir (bir kart kaldıysa); iki kart kaldıysa %4 (Phil Gordon'un kuralı). Floş çekilişi: 9 out ≈ %18 (tek kart), ≈ %36 (iki kart; kesin değer %34).</li>
    <li>Örnek: pot 380, rakip 370 all-in yaptı. Görmen gereken pay 370 ÷ 1.120 ≈ %33. Floş çekilişin %34-36 olduğundan görmek hafif kârlı.</li>
  </ul>
  <h3>Zımni oranlar (implied odds)</h3>
  <p>Fiyat çok pahalıysa ama elini tamamlayınca rakipten ek fiş alabileceksen görmek yine de kârlı olabilir. Elini tamamladıktan sonra <b>kazanman gereken ek fiş</b>:</p>
  <div class="callout"><b>Ek fiş = bahis ÷ kazanma % − (pot + bahis + görme)</b><br>Örnek: Turn'de pot 375, rakip 100 bahis yaptı; üçlü ya da iki per için 5 out'un var (≈ %10). 100 ÷ 0,10 − (375 + 100 + 100) = <b>425</b>. Elini tamamlayınca rakipten ek 425 alamıyorsan çekil.</div>
  <p>Dikkat edilecekler (MIT notları):</p>
  <ul>
    <li>Yüksek olmayan floşa ya da kentin düşük ucuna çekilme: tamamlasan bile kaybedebilirsin.</li>
    <li>Çift tahtada tamamlanan floş ya da kent güvenli değildir.</li>
    <li>“Turn ve river'ı tek bahisle göreceğim” varsayımı nadiren doğrudur; ancak rakip all-in ise.</li>
    <li>Floş çekilişi tamamlanınca fark edilir, rakip çekilir; set gibi gizli eller ek fiş getirir ama okunması zordur.</li>
    <li>Çok küçük bahisle çekiliş çeken rakibe doğru fiyatı vermiş olursun; flop ve turn bahisleri genellikle potun yarısı ile üçte ikisi arasında olmalı.</li>
  </ul>
  <h3>Fold equity ve yarı-blöf</h3>
  <p>Blöf, rakibin çekilmesi sayesinde kârlıdır. Çağrılırsan kaybedeceğin bir blöfte (elin kazanma şansı sıfır) gereken çekilme oranı <b>bahis ÷ (pot + bahis)</b>: yarım pot bahis rakibin <b>%33</b>, pot kadar bahis <b>%50</b> çekilmesini ister.</p>
  <p><b>Yarı-blöf</b>, tamamlanmamış güçlü bir eliniz varsa yapılan bahistir. Çekilmezse kazanma şansın devreye girer, bu yüzden gereken çekilme azalır. Pratik kural: kazanma şansın %10 arttıkça gereken çekilme yaklaşık %15 azalır. Ön-flop'taki bahislerin neredeyse hepsi birer yarı-blöftür.</p>
  <div class="calc" id="fcalc">
    <div class="calc-in"><label for="f-pot">Pot (bahis öncesi)<input id="f-pot" type="number" min="1" value="350"></label><label for="f-bet">Senin bahsin<input id="f-bet" type="number" min="0" value="150"></label><label for="f-w">Çağrılırsa kazanma şansın (%)<input id="f-w" type="number" min="0" max="100" value="16"></label></div>
    <div class="calc-out"><div><span>Saf blöf için gereken çekilme</span><b id="f-base"></b></div><div><span>Senin için gereken çekilme</span><b id="f-need"></b></div></div>
    <div class="verdict" id="f-v"></div>
  </div>
  ${miniCheck([
    {q:'Pot 600. Elinin hiç şansı yok ve 300 bahisle blöf yapıyorsun. Başa baş için rakip kaç sıklıkta çekilmeli?',o:['%25','%33','%50'],a:1,w:'300 ÷ (600 + 300) = %33.'},
    {q:'Zımni oranın önemi ne zaman artar?',o:['Elin zaten en iyisiyse','Elini tamamladığında rakipten çok fiş alabilecekse','Rakip çok küçük bahis yaptığında hiç önemi yok'],a:1,w:'Zımni oran, elini tamamladıktan sonra kazanacağın ek fişleri hesaba katar.'}
  ])}
  ${MIT_SRC('Basic Strategy dersi')}`;
}

function Mi_range(){
  setTimeout(()=>{
    const root=$('#rcalc');if(!root)return;
    const opt=RCH.split('').reverse().map(c=>`<option value="${c}">${c}</option>`).join('');
    $('#r-a').innerHTML=opt;$('#r-b').innerHTML=opt;$('#r-b').value='K';
    const NAME={5:'İlk %5 (TT+, AQ+)',10:'İlk %10 (55+, AT+)',20:'İlk %20 (22+, A2+, KQ)',30:'İlk %30 (22+, A2+, iki Broadway)',50:'İlk %50 (çift ya da toplam ≥16)',100:'Aralığın dışında (alt %50)'};
    const f=()=>{
      let a=RCH.indexOf($('#r-a').value),b=RCH.indexOf($('#r-b').value),s=$('#r-s').value==='s';
      if(a===b)s=false;
      const cs=s?[a*4,b*4]:[a*4,b*4+1],lv=MIT.level(cs),h=MIT.info(cs);
      const key=handKey(cs),cmb=a===b?6:s?4:12;
      $('#r-k').textContent=key;$('#r-l').textContent=NAME[lv];$('#r-c').textContent=cmb+' kombinasyon';
      const v=$('#r-v');v.className='verdict '+(lv<=10?'ok':lv<=30?'mid':'no');
      v.innerHTML=lv<=10?'<b>Güçlü bölge.</b> Bu eli çoğu pozisyondan oynarsın.':lv<=30?'<b>Orta bölge.</b> Pozisyona ve rakibe bağlı oynanır.':'<b>Zayıf bölge.</b> Genelde çekilir; yalnızca çok kısa fişle ve geç pozisyonda sürülür.';
    };
    $$('#rcalc select').forEach(x=>x.onchange=f);f();
  },0);
  return `<p class="lead">Poker'de rakibin elini tek bir iki-kart olarak tahmin etmeye çalışmak yanıltır. Profesyoneller bunun yerine <b>aralık (range)</b> düşünür: bu durumda rakip hangi eller arasından oynar?</p>
  <h3>Aralık yazımı</h3>
  <ul>
    <li><b>s</b> aynı renk (suited), <b>o</b> farklı renk (offsuit). <b>22+</b>: bütün çiftler. <b>A4s+</b>: A4, A5 … AK aynı renk. <b>KTs+</b>: KT, KJ, KQ aynı renk.</li>
    <li><b>QQ+, AQ+, KQ</b>: QQ KK AA AQ AK KQ. Sondaki <b>-</b> işareti en iyiden aşağıya gider: 55-, 54-.</li>
    <li>Aralıkla rakibe karşı kazanma şansını ölçersin: elindeki AT, rastgele kartlara karşı yaklaşık %63'tür.</li>
  </ul>
  <h3>Kombinasyon sayısı</h3>
  <p>Bir çift <b>6</b>, aynı renk iki farklı kart <b>4</b>, farklı renk iki farklı kart <b>12</b> kombinasyondur. Yani AK toplamda 16, AA 6 kombinasyon taşır. Bu yüzden rakibin “AK” tutma ihtimali, “AA”nın yaklaşık 2,7 katıdır.</p>
  <h3>Ezberlenecek aralıklar</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Yaklaşık yüzde</th><th>Aralık</th></tr></thead><tbody>
    <tr><td><b>%5</b></td><td>TT+, AQ+</td></tr>
    <tr><td><b>%10</b></td><td>55+, AT+</td></tr>
    <tr><td><b>%20</b></td><td>22+, A2+, KQ</td></tr>
    <tr><td><b>%30</b></td><td>22+, A2+, iki Broadway (T-A arası)</td></tr>
    <tr><td><b>%50</b></td><td>Çiftler ve iki kartın toplamı 16 ya da daha çok olan eller (A=14, K=13 …)</td></tr>
    <tr><td><b>%100</b></td><td>Herhangi iki kart</td></tr>
  </tbody></table></div>
  <p>Sıralama olarak MIT notları <b>Sklansky-Karlson</b> sıralamasını kullanır: bir eli ne kadar fişle kör olarak all-in sürmenin kârlı olduğuna göre dizer. AA en büyük, KK ardından gelir.</p>
  <div class="calc" id="rcalc">
    <div class="calc-in"><label for="r-a">Birinci kart<select id="r-a"></select></label><label for="r-b">İkinci kart<select id="r-b"></select></label><label for="r-s">Renk<select id="r-s"><option value="o">Farklı renk</option><option value="s">Aynı renk</option></select></label></div>
    <div class="calc-out"><div><span>El</span><b id="r-k"></b></div><div><span>En dar aralık</span><b id="r-l"></b></div><div><span>Sayı</span><b id="r-c"></b></div></div>
    <div class="verdict" id="r-v"></div>
  </div>
  <h3>Kârlı aralık ≠ en kârlı aralık</h3>
  <p>Bir aralığın ortalama olarak kârlı olması yetmez. AQ'ya karşı 55+ ve AT+ aralığı kârlıdır (yaklaşık %53) ama AT ve AJ, AQ'ya yenilir. En kârlı aralık 22+ ve AQ+'dır (yaklaşık %60); onun içinde her el kâr getirir.</p>
  <h3>Açılış ve karşılama aralıkları (M ≥ 10)</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Pozisyon</th><th>Pot açılmadıysa</th><th>Artışa karşı</th></tr></thead><tbody>
    <tr><td>UTG, bloklar</td><td>TT+, AQs+, AKo</td><td>TT+, AQs+, AKo</td></tr>
    <tr><td>Orta pozisyon</td><td>88+, AJ+, KQ</td><td>TT+, AQs+, AKo</td></tr>
    <tr><td>Cutoff, buton</td><td>77+, her suited As, yüksek suited bağlantılı eller</td><td>88+, AJ+, KQ</td></tr>
  </tbody></table></div>
  <p>Oynadığın her eli <b>büyük körün 3 katı + her görene bir büyük kör</b> artırarak gir. Bu yaklaşık ellerin %15'idir. Ön-flop'ta öne geçtiysen flop'ta <b>potun 2/3'ü</b> kadar devam bahsi yap; bu bahsin yaklaşık %40 çalışması yeter. Bahis büyüklüğünü her seferinde değiştirme, okunursun.</p>
  <div class="callout"><b>Oyunda</b> Köpekbalığı ve Sıkı tarzdaki rakipler bu açılış tablolarını izler. Kısa fişli rakipler ise sonraki derste göreceğin push/fold tablosuna geçer.</div>
  ${miniCheck([
    {q:'AK kaç kombinasyondur?',o:['6','12','16'],a:2,w:'AK aynı renk 4, farklı renk 12: toplam 16.'},
    {q:'“55+, AT+” yaklaşık kaç yüzdelik aralıktır?',o:['%5','%10','%30'],a:1,w:'MIT notlarında %10: çiftler 55+ ve A-Ten ya da daha iyi.'}
  ])}
  ${MIT_SRC('Preflop Analysis ve Tournament Play dersleri')}`;
}

function Mi_m(){
  return `<p class="lead">Turnuvada fişlerinin değeri körlere göre ölçülür. Aynı 20.000 fiş, 200 büyük körde rahat; 4.000 büyük körde ise neredeyse bitmiştir. <b>M oranı</b> bu farkı tek bir sayıya indirir (Dan Harrington'ın yöntemi, Paul Magriel'in buluşu).</p>
  <h3>Hesaplar</h3>
  <ul>
    <li><b>Etkin fiş</b> = senin fişin ile masadaki en büyük rakip fişinden küçük olanı. Bir elde kaybedebileceğin en çok fişi gösterir.</li>
    <li><b>M = etkin fiş ÷ (küçük kör + büyük kör + ante)</b>. Hiç el oynamasan kaç tur dayanacağını söyler; aynı zamanda körleri çalmanın fişine oranıdır.</li>
    <li><b>Q oranı</b> = fişin ÷ masadaki ortalama fiş. <b>Etkin M</b> = M × oyuncu sayısı ÷ 10.</li>
  </ul>
  <h3>Bölgeler</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>M</th><th>Bölge</th><th>Ne yaparsın?</th></tr></thead><tbody>
    <tr><td>&lt; 2</td><td><b>Ölü bölge</b></td><td>Rakip büyük kör ile her el görme hakkına sahip: çalma şansın yok. Buraya düşmemelisin; M=1'in altına asla.</td></tr>
    <tr><td>2-8</td><td><b>Çalma bölgesi</b></td><td>Tek hamlen all-in ya da çekil. Körleri çalmak fişini %10-40 artırır; bu, iyi el seçmenin getirdiğinden çok daha değerlidir.</td></tr>
    <tr><td>8-12</td><td><b>Çalma / yeniden çalma</b></td><td>Artık bir artışa çekilebilirsin. 3 büyük kör (≈2M) artış yapıp 6M'lik yeniden artışa karşı çekilirsin; zayıf elle görmek kârlı değil.</td></tr>
    <tr><td>12-30</td><td><b>Değer bahsi bölgesi</b></td><td>Flop görebilirsin. Görerek girme, artırarak gir; flop'ta devam bahsi yap. Bağlantısız tahtada set yapmışsan fişi kaybetmeye razı ol; alt çift ya da en iyi çift-zayıf kicker için değil.</td></tr>
    <tr><td>&gt; 30</td><td><b>Set avı bölgesi</b></td><td>Küçük çifti ucuza görüp set yapmayı beklersin, ama nut olmayan el için 50M'yi riske atma. Dalgalanmana sabredemiyorsan 30M'ye kadar JJ ve altını bırak.</td></tr>
  </tbody></table></div>
  <div class="callout"><b>Tempo</b> Turnuvanın en önemli kavramı: doğru agresiflik düzeyi. Yazı-tura yapmak zorundasın, ama gönüllü olarak girme. Hedefin, showdown'dan kaçınarak fişini yavaş yavaş büyütmektir. Aşağıdaki Turnuva dersinin M hesaplayıcısıyla kendi yığınını ölç.</div>
  <h3>Nakit oyunu ile turnuva</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th></th><th>Nakit oyunu</th><th>Turnuva</th></tr></thead><tbody>
    <tr><td>Fiş</td><td>= para</td><td>Fiş ≠ para; sıralama ödüllendirilir</td></tr>
    <tr><td>Körler</td><td>Sabit</td><td>Yükselir</td></tr>
    <tr><td>Giriş</td><td>Sınırsız, istediğin an</td><td>Tek, sabit</td></tr>
    <tr><td>Dalgalanma</td><td>Düşük</td><td>Yüksek</td></tr>
  </tbody></table></div>
  <h3>Turnuvanın evreleri</h3>
  <ul>
    <li><b>Erken oyun:</b> Turnuvanın büyük kısmı. Nakit oyununa benzer; fiş değeri ≈ para değeri. İmaj kur, okuma topla.</li>
    <li><b>Kabarcık ve ilk ödüller:</b> Amatör oyuncular fazla sıkıdır. Performansın burada belirlenir. Marjinal durumlarda ICM kullan (Üst düzey bölümde).</li>
    <li><b>Final masası:</b> Tek masalı turnuva gibi oyna, ödeme farklarını bil.</li>
  </ul>
  <h3>Başarıyı ölçmek</h3>
  <p>Ders notlarında hedef: nakit oyununda 100 elde yaklaşık 5 büyük kör kazanmak, turnuvada yatırım getirisi (ROI) çok katlı turnuvada %30, tek masalıda %15. Yöntem: tutucu, düşük dalgalanmalı oyun.</p>
  ${miniCheck([
    {q:'Fişin 24.000, körler 1.000/2.000, ante yok. M oranın kaçtır?',o:['≈ 8','≈ 12','≈ 24'],a:0,w:'24.000 ÷ (1.000 + 2.000) = 8. Çalma bölgesinin sınırındasın: push ya da çekil.'},
    {q:'M = 1,5 iken en doğru plan hangisidir?',o:['Küçük çifti ucuza görmek','Ölü bölgeye düşmeden önce uygun ele hızla all-in','Dört saat beklemek'],a:1,w:'M<2 ölü bölge; çalma şansın bitmeden fişlerini sürmelisin.'}
  ])}
  ${MIT_SRC('Introduction ve Tournament Play dersleri (Harrington M oranı)')}`;
}

/* ---------------- ÜST DÜZEY ---------------- */
function Mu_pushfold(){
  setTimeout(()=>{
    const f=()=>{
      const pot=+$('#p-pot').value||0,F=clamp((+$('#p-f').value||0)/100,0,1),W=clamp((+$('#p-w').value||0)/100,0,1),win=+$('#p-win').value||0,lose=+$('#p-lose').value||0;
      const fe=(1-F)*pot,sd=F*(W*win-(1-W)*lose),ev=fe+sd;
      $('#p-fe').textContent=f0(fe);$('#p-sd').textContent=f0(sd);$('#p-ev').textContent=f0(ev);
      const v=$('#p-v');v.className='verdict '+(ev>0?'ok':'no');
      v.innerHTML=ev>0?`<b>Push.</b> Çekilmenin EV'si 0; push'unki +${f0(ev)} fiş. Rakip yalnızca %${f1(F*100)} sıklıkla görüyor.`:`<b>Çekil.</b> Push'un EV'si ${f0(ev)} ile çekilmenin (0) altında.`;
    };
    $$('#pcalc input').forEach(x=>x.oninput=f);f();
  },0);
  const ROW=(m,a,b,c)=>`<tr><td><b>M ≈ ${m}</b></td><td>${a}</td><td>${b}</td><td>${c}</td></tr>`;
  return `<p class="lead">Fişin M oranına göre 10'un altına indiğinde artış-fold oyunu işe yaramaz: bir artışa verilen yanıta çekilebileceğin kadar fişin kalmamıştır. Hamlelerin ikidir: <b>tüm fişi sür (push)</b> ya da <b>çekil (fold)</b>.</p>
  <h3>Neden push?</h3>
  <p>3 büyük körlük (≈2M) bir artışa 6M'lik yeniden artış gelirse görmek için gereken pay 8 ÷ 20 = %40; M 4'ün altındaysa 4 ÷ 12 = %30 olur ve neredeyse her zaman görmen gerekir. Artırıp çekilmek bu yüzden anlamsızdır: önemli olan rakibi çekilmeye zorlamak (fold equity).</p>
  <h3>Push'un beklenen değeri</h3>
  <div class="callout"><b>EV(push) = (1 − F) × pot + F × [W × kazanç − (1 − W) × kayıp]</b><br>F: rakibin görme sıklığı · W: görülürse kazanma şansın · pot: körler ve anteler. EV(çekil) = 0.</div>
  <div class="calc" id="pcalc">
    <div class="calc-in"><label for="p-pot">Pot (körler + anteler)<input id="p-pot" type="number" min="0" value="425"></label><label for="p-f">Rakibin görme sıklığı (%)<input id="p-f" type="number" min="0" max="100" step="0.1" value="27.6"></label><label for="p-w">Görülürse kazanma şansın (%)<input id="p-w" type="number" min="0" max="100" step="0.1" value="34.26"></label><label for="p-win">Görülüp kazanırsan kazancın<input id="p-win" type="number" min="0" value="1250"></label><label for="p-lose">Görülüp kaybedersen kaybın<input id="p-lose" type="number" min="0" value="950"></label></div>
    <div class="calc-out"><div><span>Fold equity payı</span><b id="p-fe"></b></div><div><span>Showdown payı</span><b id="p-sd"></b></div><div><span>Push'un EV'si</span><b id="p-ev"></b></div></div>
    <div class="verdict" id="p-v"></div>
  </div>
  <p>Varsayılan değerler ders notlarındaki örnektir: 125/250 + 25 ante, buton M=8, büyük körde M≈2,6 olan rakip; elin 9-6 farklı renk. Rakip %27,6 el görse bile push'un EV'si yaklaşık +254; çekilmek yaklaşık 175 fiş kaybettirir. Yani hiç düşünmeden çekmek, AK'ya karşı 3-4 ile görmekten daha kötüdür.</p>
  <h3>Kural tablosu: ne zaman neyi sürerim?</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Yığın</th><th>Herhangi iki kart</th><th>Broadway (%30)</th><th>AT+, 55+ (%10)</th></tr></thead><tbody>
    ${ROW(1,'Geç pozisyondan','Her yerden','Her yerden')}
    ${ROW(5,'Butondan','Geç pozisyondan','Her yerden')}
    ${ROW(10,'Küçük körden','Cutoff’tan','Her yerden')}
  </tbody></table></div>
  <ul>
    <li>M &lt; 10 iken ilk %10 (AT+, 55+) her pozisyondan sürülür.</li>
    <li>M &lt; 1: çok geniş sür, her pozisyondan.</li>
    <li><b>Heads-up</b> (küçük körden): rakip sıkıysa %100; M=1'de %100, M=5'te ilk %75, M=10'da ilk %50. En büyük hata, küçük körden ellerin yarısından azını sürmektir.</li>
  </ul>
  <h3>Bir push'a karşı nasıl görürüm?</h3>
  <p><b>Büyük körde (heads-up):</b> görme aralığın = rakibin push aralığı × çarpan.</p>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>M</th><th>1</th><th>2</th><th>4</th><th>6</th><th>9</th></tr></thead><tbody><tr><td>Çarpan</td><td>10×</td><td>2×</td><td>1×</td><td>2/3×</td><td>1/2×</td></tr></tbody></table></div>
  <p><b>Diğer pozisyonlarda</b> (tutucu varsayımlarla): görme aralığın = rakibin push aralığı × şu oran: orta pozisyon %5, geç %10, cutoff %30, küçük kör %50. Kendine sor: “Onun aralığı benim elimden 3 kat geniş mi?” AQ'yla A5'e karşı evet, AT'yle KJ'ye karşı evet, KQ'yla 85'e karşı evet.</p>
  <p>Arkanda konuşacak her oyuncu bir ikinci görme riski taşır: görülürse kazanma şansın 0'a yakınlaşır. Bu yüzden arkanda 5 oyuncu varsa yalnızca rakibin aralığının %5'ini görürsün.</p>
  <div class="callout"><b>Oyunda</b> Han ve haftalık turnuvanın (ve üst salonların) bilen rakipleri M &lt; 10 olduğunda bu tabloları kullanır. Sıkı rakibin push'una karşı çekil; kısa fişli, saldırgan rakibe karşı daha geniş gör. Antrenman masasında koç da M &lt; 10 iken push/fold önerir.</div>
  ${miniCheck([
    {q:'Butondasın, M = 4, elin 7-2 farklı renk. Tablo ne diyor?',o:['Çekil','Sür: butondan M≈4-5 iken her el sürülür','Küçük artış yap'],a:1,w:'MIT tablosu: butondan M≈5 ve altında herhangi iki kart push edilir; fold equity eldeki kartlardan önemlidir.'},
    {q:'Büyük körde M = 2 ve küçük kör %60 push ediyor. Çarpan 2×. Görme aralığın?',o:['%60','%100','%30'],a:1,w:'60 × 2 = %120, üst sınır %100. Bu kadar kısa fişle neredeyse her eli görürsün.'}
  ])}
  ${MIT_SRC('Preflop Analysis dersi')}`;
}

function Mu_levels(){
  return `<p class="lead">Poker, kartlardan çok kafaların oyunudur. Rakibin senden bir adım gerisinde ya da önünde olması sonucu belirler. MIT notları bunu <b>düşünme seviyeleri</b> ile anlatır.</p>
  <h3>Seviyeler</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Seviye</th><th>Soru</th></tr></thead><tbody>
    <tr><td><b>L0</b></td><td>Elin değerini umursamıyor.</td></tr>
    <tr><td><b>L1</b></td><td>“Elimde ne var?” (el okuma)</td></tr>
    <tr><td><b>L2</b></td><td>“Onda ne var?” (rakip okuma)</td></tr>
    <tr><td><b>L3</b></td><td>“O, bende ne olduğunu düşünüyor?” (temsil)</td></tr>
    <tr><td><b>L4</b></td><td>“O, benim ne temsil ettiğimi nasıl yorumluyor?”</td></tr>
    <tr><td><b>L5 ve üstü</b></td><td>Bu zincirin sonraki halkaları; birbirini tanıyan iki profesyonelin arasında olur.</td></tr>
  </tbody></table></div>
  <p><b>Hedef: rakibinden tam bir seviye yukarıda olmak.</b> Ders notlarının varsayımı: yeni oyuncular L1, ortalama turnuva oyuncuları L2, nakit oyuncuları L3 düşünür. Aynı oyuncu elden ele ±1 seviye oynayabilir.</p>
  <h3>Yanlış seviyede oynamak</h3>
  <ul>
    <li>“Dördüncü artış asları gösterir” sözü, L2 düşünen oyuncuya doğrudur. L1 oyuncu elinin gücüne bakar: papaz çiftiyle dördüncü artışı yapıp seni bile geçer.</li>
    <li>Seni okumaya çalışmayan birine L3 hikâyeler anlatmak (temsil) boşunadır: o hikâyeyi hiç duymaz.</li>
    <li>Zeebo teoremi: hiçbir oyuncu ful'u hiçbir turda, bahis ne kadar büyük olursa olsun bırakamaz. Bu yüzden güçlü görünen hikâyeni “ful” gibi güçlü eller karşısında boşa harcama.</li>
  </ul>
  <h3>Aralık okumak</h3>
  <p>Ön-flop'tan sonra rakibin aralığına dair fikrin olur. Her karar o aralığı daraltır. Hikâyesi “mantıklı olmayan” bir oyuncu blöf yapıyor olabilir, ama tam blöf ihtimali genelde çok düşüktür. Aralıktan elediğin her el, sana senin elinin gerçek gücünü gösterir.</p>
  <h3>Psikoloji ve tilt</h3>
  <ul>
    <li><b>Hedef:</b> Doğru kararlar. Tek bir elin ya da oturumun sonucu önemsizdir; kartlar kısa vadede dengelenmez.</li>
    <li><b>İmaj:</b> Fiş yığınının düzeni oyun tarzını anlatır. Körler küçükken gevşek (LAG), yüksekken sıkı (TAG) oyna; rakibin çekilmek mi görmek mi istediğini yönet.</li>
    <li><b>Mutsuzluk eşiği:</b> İnsanlar çoğu parayı, planladıklarından fazla kaybettikten hemen sonra kaybeder. Kaybı geri almaya çalışma; yatırdığın fiş önemli değil.</li>
    <li>Kısa oturumları öndeyken, uzun oturumları gerideyken oynamak tilt'in tipik işaretidir. “Her zaman en iyi oyununu oyna.”</li>
    <li>Bankroll'unu piyasa değerine göre hesapla, serileri düşünme, kısa bir hafıza edin.</li>
  </ul>
  <div class="callout"><b>Oyunda</b> Salonlar ilerledikçe rakipler yükselir: Kaçak Kumarhane ve Kıraathane oyuncuları çoğunlukla L1-L2'dedir; Monte Carlo ve sonrası L3. Üst salonlarda bahislerin boyutu elin gücüne göre değişmez; rakip senin tarzını okumaya çalışır. Tilt'e girmiş rakip daha gevşek ve saldırgan oynar.</div>
  ${miniCheck([
    {q:'Rakibin yalnızca kendi eline bakıyor (L1). Ona en uygun yaklaşım?',o:['Karmaşık, çok katmanlı blöflar','Güçlü elinle değer bahsi, blöfü az tut','Hiç oynama'],a:1,w:'L1 oyuncu temsil hikâyeni okumaz; kartlarının gücüne göre karar verir. Ona değer bahsi yap.'},
    {q:'Mutsuzluk eşiği nedir?',o:['Çok kaybettikten sonra kaybı geri almaya çalışırken daha da çok kaybetme eğilimi','En kötü masa','Bütün fişleri kaybetmek'],a:0,w:'Kayıp planın dışına çıkınca duygusal kararlar artar; bu aralık en pahalı olandır.'}
  ])}
  ${MIT_SRC('Tournament Play dersi (Kevin Desmond)')}`;
}

function Mu_gto(){
  setTimeout(()=>{
    const f=()=>{
      const pot=Math.max(1,+$('#g-pot').value||0),bet=Math.max(0,+$('#g-bet').value||0),S=bet/pot;
      $('#g-s').textContent='Potun %'+Math.round(S*100)+"'i";$('#g-call').textContent=pct(1/(1+S));$('#g-ratio').textContent='1 blöf : '+f1((1+S)/S)+' değer';
      $('#g-share').textContent=pct(S/(1+2*S));$('#g-fold').textContent=pct(S/(1+S));
    };
    $$('#gcalc input').forEach(x=>x.oninput=f);f();
  },0);
  const row=(n,S)=>`<tr><td>${n}</td><td>${pct(1/(1+S))}</td><td>${pct(S/(1+S))}</td><td>${pct(S/(1+2*S))}</td></tr>`;
  return `<p class="lead">Rakibin elini tahmin etmeyi bırak ve şu soruyu sor: <b>rakip senin stratejini bilse bile</b> kârlı kalan bir oyun var mı? Bu oyuna <b>oyun teorisi optimal (GTO)</b> oyun denir.</p>
  <h3>Nash dengesi</h3>
  <p>Her oyuncu için bir strateji seti öyle ki hiçbiri tek başına stratejisini değiştirmekle kazanç sağlayamaz. İki kişilik, sıfır toplamlı oyunda (poker heads-up gibi) buna GTO denir. 2015'te <b>Cepheus</b> adlı program, heads-up sınırlı Hold'em'i çözdü: yaklaşık 900 işlemci-yılı sonra sömürülebilirlik büyük kör'ün binde birinin altına indi. Yöntem <b>pişmanlık minimizasyonu (CFR)</b>: oyun milyonlarca kez oynanır; her seçenek, “keşke onu yapsaydım” pişmanlığıyla orantılı olasılıkla seçilir ve ortalama strateji dengeye yaklaşır. Sınırsız bahisli oyunda (No-Limit) sonsuz bahis büyüklüğü, çözümü çok daha zorlaştırır.</p>
  <h3>Spade oyunu</h3>
  <p>Pot 100. Rose desteden bir kart çeker; kart maça (spade) ise elini kazanır, değilse kaybeder. 100 bahis yapabilir. Colin görür ya da çekilir. Rose her spade'de bahis yapar. Colin hep görürse Rose blöf yapmaz ve sonuç sıfırdır; Colin hiç görmezse Rose her el bahis yapar ve 50 kazanır. Denge: <b>Colin'in yarı yarıya görmesi</b> ve <b>Rose'un her iki değer bahsine bir blöf yapması</b>. Taraflardan biri bu oranın dışına çıkarsa diğeri sömürür.</p>
  <h3>Üç formül</h3>
  <p>Bahsin potun <b>S</b> katı olduğunu düşün (yarım pot için S = 0,5):</p>
  <ul>
    <li>Rakibin <b>görme sıklığı</b> (blöfünü kayıtsız bırakan): <b>1 ÷ (1 + S)</b>. Pot kadar bahiste %50.</li>
    <li>Senin <b>blöf/değer oranın</b> (rakibi görme konusunda kayıtsız bırakan): <b>S ÷ (1 + S)</b> blöf, her değer bahsi için.</li>
    <li>Bahis aralığında blöf payı: <b>S ÷ (1 + 2S)</b>.</li>
  </ul>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Bahis</th><th>Rakibin görme sıklığı</th><th>Blöf başına gereken çekilme</th><th>Bahislerinin blöf payı</th></tr></thead><tbody>${row('1/3 pot',1/3)}${row('1/2 pot',.5)}${row('2/3 pot',2/3)}${row('Pot',1)}${row('2× pot',2)}</tbody></table></div>
  <div class="calc" id="gcalc">
    <div class="calc-in"><label for="g-pot">Pot<input id="g-pot" type="number" min="1" value="1000"></label><label for="g-bet">Bahis<input id="g-bet" type="number" min="1" value="670"></label></div>
    <div class="calc-out"><div><span>Bahis büyüklüğü</span><b id="g-s"></b></div><div><span>Rakip en az şu sıklıkta görmeli</span><b id="g-call"></b></div><div><span>Blöf için gereken çekilme</span><b id="g-fold"></b></div><div><span>Blöf/değer</span><b id="g-ratio"></b></div><div><span>Bahislerinin blöf payı</span><b id="g-share"></b></div></div>
  </div>
  <h3>Kendi elini bir dağılımın parçası olarak gör</h3>
  <ul>
    <li>Strateji bir <b>el tipine</b> değil <b>bütün ellerine</b> uygulanır: sadece değer ya da sadece blöf kazandırmaz, ikisinin birleşimi kazandırır.</li>
    <li>Ellerini üç kümeye ayır: <b>değer</b> (görülmesini istediklerin), <b>blöf yakalayıcı</b> (rakibin blöfünü yakalayabilecek ama değer bahsi yetmeyen eller) ve <b>blöf</b>.</li>
    <li>Bir eldeki stratejin, diğer ellerin için ne yapacağını belirler. Elinle ne yapacağını kafandan değil dağılımdan bul.</li>
  </ul>
  <h3>Üç sömürücü strateji</h3>
  <ol><li>Benim elim ↔ rakibin eli (hepsinden zayıf: kaba tahmin).</li><li>Benim elim ↔ rakibin dağılımı (el okuma).</li><li>Benim dağılımım ↔ rakibin dağılımı (üst seviye).</li></ol>
  <div class="callout"><b>GTO mu, sömürü mü?</b> GTO savunmasızdır ama bir şey kaybettirmez; yani rakibin dengeden uzaksa (çok gören, hiç blöf yapmayan) dengeden uzaklaşıp onu sömürürsün: çağrı makinesine blöf yapma, çok sıkı oyuncuya blöfle. Üst salonlarda Köpekbalığı ve Tilki rakipler bahis oranlarını bu dengeye yakın tutar; gevşek rakipler sömürülmeye açıktır.</div>
  ${miniCheck([
    {q:'Pot büyüklüğünde (S=1) bahis yaparsan rakibin kayıtsız kalması için kaç sıklıkla görmesi gerekir?',o:['%25','%33','%50'],a:2,w:'1 ÷ (1 + 1) = %50.'},
    {q:'Yalnızca değer bahsi yapıp hiç blöf yapmazsan ne olur?',o:['Rakip bahislerini her zaman çekilerek karşılar ve ek kazanç alırsın','Rakip sana yalnızca güçlü eller verir ve çekilir; sömürülürsün','Hiçbir şey'],a:1,w:'Blöf yoksa rakibin işi kolay: yalnızca daha iyi ellerle görür. Denge için blöf gerekir.'}
  ])}
  ${MIT_SRC('Bill Chen: “Cepheus and Computer Poker Algorithms”, Matt Hawrilenko: “Game Theory for Humans”')}`;
}

function Mu_combo(){
  setTimeout(()=>{
    const root=$('#ccalc');if(!root)return;
    const opt=RCH.split('').reverse().map(c=>`<option value="${c}">${c}</option>`).join('');
    $('#c-a').innerHTML=opt;$('#c-b').innerHTML=opt;$('#c-b').value='K';
    const f=()=>{
      const a=RCH.indexOf($('#c-a').value),b=RCH.indexOf($('#c-b').value),ka=+$('#c-ka').value,kb=+$('#c-kb').value;
      let tot,now;
      if(a===b){tot=6;const l=4-ka;now=l*(l-1)/2;}
      else{tot=16;now=(4-ka)*(4-kb);}
      $('#c-tot').textContent=tot;$('#c-now').textContent=now;$('#c-d').textContent=tot?Math.round((1-now/tot)*100)+'% azaldı':'';
    };
    $$('#ccalc select').forEach(x=>x.onchange=f);f();
  },0);
  return `<p class="lead">Rakibin aralığını okuduktan sonra bir sonraki iş <b>saymak</b>: o aralıkta kaç el seni geçer, kaç el sana yenilir? Bunun için kombinasyon sayısını ve kart kaldırmayı (card removal) bilmek gerekir.</p>
  <h3>Kombinasyonlar</h3>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>El</th><th>Kombinasyon</th></tr></thead><tbody>
    <tr><td>Çift (AA, KK …)</td><td>6</td></tr><tr><td>Aynı renk (AKs)</td><td>4</td></tr><tr><td>Farklı renk (AKo)</td><td>12</td></tr><tr><td>AK toplam</td><td>16</td></tr>
  </tbody></table></div>
  <h3>Her sokakta iki güncelleme</h3>
  <ol>
    <li><b>Kart kaldırma:</b> Elindeki ve tahtadaki kartlar rakipte olamaz. Elinde bir As varsa rakibin AA kombinasyonu 6'dan 3'e iner, AK 16'dan 12'ye iner. Bu yüzden elinde As taşıyorsan rakibin güçlü As ellerini bulma ihtimali azdır.</li>
    <li><b>Aksiyon güncellemesi:</b> Rakip check yapıp senin bahsine karşı çekilmediyse zayıf ellerini aralığından çıkar. Örnek: ön-flop'ta geniş bir aralıkla başlayan rakip, flop'ta senin 75.000'lik bahsini görürse çekilişleri ve alt çiftleri çıkarırsın; elinde kalan eller yüksek çiftler ve güçlü As'lardır.</li>
  </ol>
  <div class="calc" id="ccalc">
    <div class="calc-in"><label for="c-a">Birinci kart<select id="c-a"></select></label><label for="c-b">İkinci kart<select id="c-b"></select></label><label for="c-ka">Elinde bu kartlardan (birinci)<select id="c-ka"><option>0</option><option>1</option><option>2</option></select></label><label for="c-kb">Elinde bu kartlardan (ikinci)<select id="c-kb"><option>0</option><option>1</option><option>2</option></select></label></div>
    <div class="calc-out"><div><span>Toplam kombinasyon</span><b id="c-tot"></b></div><div><span>Senin kartların düşünce</span><b id="c-now"></b></div><div><span>Değişim</span><b id="c-d"></b></div></div>
  </div>
  <h3>Kural: ilk önce kendi elini unut, sonra aralığını</h3>
  <p>Rakibe karşı doğru oynamak için önce onun aralığını (olası el dağılımını) kur, ardından kart kaldırma ve aksiyonla daralt, sonra kendi elinin bu dağılıma karşı nerede durduğuna bak. Elinin gücü yalnızca rakibe göre değerlidir.</p>
  ${miniCheck([
    {q:'Elinde bir As var. Rakibin AA tutma ihtimali ne olur?',o:['6 kombinasyondan 3’e düşer','Hiç değişmez','Sıfır olur'],a:0,w:'Dört Astan biri sende; kalan üçten iki seçme: 3 kombinasyon.'},
    {q:'Rakip senin büyük bahsini görürse aralığından neyi çıkarırsın?',o:['En güçlü elleri','Zayıf eller ve çekilişlerin bir kısmını','Hiçbir şeyi'],a:1,w:'Büyük bahsi görmek, genellikle orta-güçlü ve güçlü ellerin varlığına işaret eder.'}
  ])}
  ${MIT_SRC('Matt Hawrilenko: “Game Theory for Humans”')}`;
}

function Mu_icm(){
  setTimeout(()=>{
    const f=()=>{
      const ch=['i1','i2','i3','i4','i5'].map(i=>Math.max(0,+$('#'+i).value||0)),pz=['z1','z2','z3','z4'].map(i=>Math.max(0,+$('#'+i).value||0));
      const idx=ch.map((c,i)=>i).filter(i=>ch[i]>0),eq=ch.map(()=>0);
      (function rec(rem,prob,place){
        if(place>=pz.length||!rem.length)return;
        const tot=rem.reduce((s,i)=>s+ch[i],0);if(tot<=0)return;
        for(const i of rem){const pr=prob*ch[i]/tot;eq[i]+=pr*pz[place];rec(rem.filter(j=>j!==i),pr,place+1);}
      })(idx,1,0);
      const tc=ch.reduce((a,b)=>a+b,0);
      $('#i-out').innerHTML=ch.map((c,i)=>c>0?`<div><span>Oyuncu ${i+1}</span><b>${f0(eq[i])} ₺</b><small>fiş payı ${tc?pct(c/tc):'-'}</small></div>`:'').join('');
    };
    $$('#icalc input').forEach(x=>x.oninput=f);f();
  },0);
  return `<p class="lead">Turnuvada fiş, para değildir. Fişlerin sana ödüllerden ne kadar pay getirdiğini hesaplayan model <b>ICM</b> (Independent Chip Model). Oyun, bu payı kazanma olasılıklarına göre dağıtır.</p>
  <h3>cEV mi, $EV mi?</h3>
  <ul>
    <li><b>Kazanan her şeyi alıyorsa</b> fiş değeri ≈ para değeri.</li>
    <li><b>Ödüller yatay</b> (birkaç kişiye benzer pay) ise fiş değeri ile para değeri birbirinden çok uzaklaşır.</li>
    <li>Fiş değişimi büyükse para değeri simetrik değişmez: <b>kaybetmek, kazanmaktan daha çok acıtır</b>.</li>
  </ul>
  <h3>Küçük bir örnek</h3>
  <p>Dört oyuncu, ödüller 1.000 / 600 / 400 / 0. Herkes 2.500 fişle başlarsa herkesin payı 500'dür. Oyuncu A bir rakibi eleyip 5.000 fişe çıkarsa payı yaklaşık 767 olur, ama yalnızca 267 kazandı; diğer iki oyuncunun payı da yaklaşık 617'dir. <b>Kazanan, ödül dağılımında önünde elenenlere pay bırakır.</b></p>
  <div class="callout"><b>Uydu turnuvası örneği</b> 10 oyuncu, ilk 9'a 10.000 ödül verilen sattelite. Rakip 2.500 fişle all-in yaptı, sende KK var ve kazanma şansın %82. Ödül beklentin %82 × 10.000 = 8.200; oysa şu an zaten 9.000'lik bir payın var. Yani fiş olarak +1.600 kazanırken para olarak <b>−800</b> kaybedersin: ödüle çok yakınken risk almak bedelli.</div>
  <h3>ICM hesaplayıcı</h3>
  <p>En fazla beş oyuncu ve dört ödül gir. Boş bırakılan oyuncu elenmiş sayılır.</p>
  <div class="calc" id="icalc">
    <div class="calc-in"><label for="i1">Oyuncu 1 fişi<input id="i1" type="number" min="0" value="5000"></label><label for="i2">Oyuncu 2 fişi<input id="i2" type="number" min="0" value="2500"></label><label for="i3">Oyuncu 3 fişi<input id="i3" type="number" min="0" value="2500"></label><label for="i4">Oyuncu 4 fişi<input id="i4" type="number" min="0" value="0"></label><label for="i5">Oyuncu 5 fişi<input id="i5" type="number" min="0" value="0"></label></div>
    <div class="calc-in"><label for="z1">1. ödül<input id="z1" type="number" min="0" value="1000"></label><label for="z2">2. ödül<input id="z2" type="number" min="0" value="600"></label><label for="z3">3. ödül<input id="z3" type="number" min="0" value="400"></label><label for="z4">4. ödül<input id="z4" type="number" min="0" value="0"></label></div>
    <div class="calc-out" id="i-out"></div>
  </div>
  <h3>Kabarcık</h3>
  <p>Kabarcık, ödül sırasının hemen dışında kalma noktasıdır (alanın yaklaşık %10'u uzağında). Amatör oyuncular burada çok sıkı oynar; son yıllarda ise tersi, fazla agresif oynayanlar çoğaldı. Marjinal anlarda ICM'yi hesaplamak performansı belirler. Genel kural: yığını küçük olan oyuncu çekinir; yığını büyük olan oyuncu bu çekingenlikten yararlanıp baskı kurar.</p>
  <h3>Sermaye yönetimi</h3>
  <ul>
    <li><b>Bankroll:</b> kaybetsen de yaşamını etkilemeyecek, “poker yatırımı” olarak ayırdığın para.</li>
    <li>Risk-of-ruin %2 için tecrübe kuralları (iyi oyuncular için): nakit No-Limit'te 20 maksimum giriş; tek masalı turnuvada 30 giriş; çok masalı turnuvada 50-100 giriş.</li>
    <li><b>Kelly ölçütü:</b> kazanma %60 ise bankrollünün %20'sini (60 − 40) bu bahse yatırmak, uzun vadede büyümeyi enbüyütür. Fazlası seni batırabilir.</li>
    <li>Örnek: WSOP Ana Etkinlik 10.000 $ ve 6.000'den fazla oyuncu; uygun bankroll 1.000.000 $'ı geçer.</li>
  </ul>
  <div class="callout"><b>Oyunda</b> Han Turnuvası kazananı her şeyi alır; ICM etkisizdir ve fiş değeri paraya yakındır. <b>Haftalık Turnuva</b>'da ilk üç ödül alır: dört oyuncu kaldığında rakipler kabarcıktadır. Küçük yığınlı rakipler büyük push'ları çok daha az görür; yığını en büyük rakip ise daha geniş sürer. Cüzdanın senin bankroll'ündür; tek bir masaya fazla yatırma.</div>
  ${miniCheck([
    {q:'Ödüller yataysa (birçok kişiye benzer ödül) fiş değeri nasıl davranır?',o:['Para değerine eşittir','Para değerinden belirgin uzaklaşır','Her zaman ikiye katlanır'],a:1,w:'Yatay ödül yapısında fiş kazanmak para kazanmak kadar değerli değildir; kaybetmek çok acıtır.'},
    {q:'Kelly ölçütüne göre %60 kazanma şansıyla bankrollünün ne kadarını yatırırsın?',o:['%10','%20','%60'],a:1,w:'Kenar (edge) = 60 − 40 = %20.'}
  ])}
  ${MIT_SRC('Tournament Play dersi (ICM, bankroll yönetimi)')}`;
}

/* ---------------- ALIŞTIRMALAR ---------------- */
const XM={push:{n:0,ok:0,streak:0},bluff:{n:0,ok:0,streak:0},m:{n:0,ok:0,streak:0}};
const LVTXT={5:'%5 (TT+, AQ+)',10:'%10 (55+, AT+)',20:'%20 (22+, A2+, KQ)',30:'%30 (22+, A2+, iki Broadway)',50:'%50',100:'%100'};
function xmPush(){
  const POS=[['BTN','Buton'],['CO','Cutoff'],['SB','Küçük kör'],['MP','Orta pozisyon'],['EP','Erken pozisyon']],MS=[1,2,3,4,5,6,8,10];
  const [pk,pn]=POS[Math.floor(rnd()*POS.length)],m=MS[Math.floor(rnd()*MS.length)];
  const d=newDeck(),h=[d[0],d[1]],lim=MIT.pushLimit(pk,m,false),lv=MIT.level(h),push=lv<=lim;
  return {
    body:`<div class="xq-facts"><span>Pozisyon: <b>${pn}</b></span><span>M oranın: <b>${m}</b></span><span>Önündekiler: <b>hepsi çekildi</b></span></div><div class="cards">${cardsQ(h)}</div>`,
    prompt:'Push (all-in) mi, çekil mi?',opts:[['push','Hepsini sür (push)'],['fold','Çekil']],ans:push?'push':'fold',
    why:`${handKey(h)} MIT aralıklarında <b>${lv===100?'ilk %50\'nin dışında':'ilk '+LVTXT[lv]}</b> sınıfında. ${pn} ve M=${m} için tablo ilk <b>%${lim}</b>'lik elleri sürmeni söylüyor: ${push?'el bu aralıkta, sür.':'el bu aralığın dışında, çekil.'}`
  };
}
function xmBluff(){
  const FR=[[1/3,'1/3 pot'],[.5,'yarım pot'],[2/3,'2/3 pot'],[1,'pot kadar'],[1.5,'1,5× pot']];
  const [S,name]=FR[Math.floor(rnd()*FR.length)],P=[600,800,1000,1200,2000][Math.floor(rnd()*5)],B=Math.round(P*S/10)*10;
  const kind=rnd()<.5?0:1,Sx=B/P;
  const bluff=Sx/(1+Sx),call=1/(1+Sx);
  const ans=Math.round((kind===0?bluff:call)*100);
  const cand=new Set([ans,Math.round((kind===0?call:bluff)*100),Math.round(Sx/(1+2*Sx)*100),Math.round(Sx*100>100?50:Sx*100)]);
  [10,25,33,40,50,60,66,75].forEach(v=>{if(cand.size<4)cand.add(v);});
  const opts=[...cand].slice(0,4).sort((a,b)=>a-b).map(v=>[String(v),'%'+v]);
  if(!opts.some(o=>+o[0]===ans))opts[0]=[String(ans),'%'+ans];
  return {
    body:`<div class="xq-facts"><span>Pot: <b>${tl(P)}</b></span><span>Bahis: <b>${tl(B)}</b> (${name})</span></div>`,
    prompt:kind===0?'Saf bir blöfün başa baş olması için rakibin en az hangi sıklıkta çekilmesi gerekir?':'Blöfünün kâr getirmemesi için rakip en az hangi sıklıkta görmeli?',
    opts,ans:String(ans),
    why:kind===0?`Bahis ÷ (pot + bahis) = ${tl(B)} ÷ ${tl(P+B)} = <b>%${ans}</b>.`:`1 ÷ (1 + S) = ${tl(P)} ÷ ${tl(P+B)} = <b>%${ans}</b>. Rakip bundan az görürse blöfün kârlı, çok görürse zararlı olur.`
  };
}
function xmM(){
  const ZN=[['dead','Ölü bölge (M < 2)'],['steal','Çalma (M 2-8)'],['resteal','Çalma / yeniden çalma (M 8-12)'],['value','Değer bahsi (M 12-30)'],['set','Set avı (M > 30)']];
  for(let n=0;n<100;n++){
    const bb=[200,400,1000,2000,5000][Math.floor(rnd()*5)],sb=bb/2,ante=rnd()<.5?Math.round(bb/10):0,pl=6;
    const cost=sb+bb+ante*pl,m=[1.2,1.8,3,5,7,9,11,14,20,28,40,55][Math.floor(rnd()*12)],stack=Math.round(m*cost/100)*100,M=stack/cost;
    const edges=[2,8,12,30];if(edges.some(e=>Math.abs(M-e)<.6)&&n<99)continue;
    const z=MIT.zone(M)[1];
    return {
      body:`<div class="xq-facts"><span>Fişin: <b>${tl(stack)}</b></span><span>Körler: <b>${tl(sb)} / ${tl(bb)}</b></span><span>Ante: <b>${ante?tl(ante)+' (kişi başı)':'yok'}</b></span><span>Masa: <b>${pl} kişi</b></span></div>`,
      prompt:'M oranın hangi bölgede?',opts:ZN,ans:z,
      why:`M = ${tl(stack)} ÷ (${tl(sb)} + ${tl(bb)}${ante?` + ${tl(ante)} × ${pl}`:''}) = <b>${f1(M)}</b>. Bu, <b>${MIT.zone(M)[0]}</b>.`
    };
  }
}
const xmShell=(id,mk,S,lead)=>{setTimeout(()=>{const el=$('#'+id);if(el)runQuiz(el,mk,S);},0);return `<p class="lead">${lead}</p><div class="quiz" id="${id}"></div>${MIT_SRC()}`;};
const Mx_push=()=>xmShell('xm-push',xmPush,XM.push,'Önünde herkes çekildi ve fişin kısa. MIT push/fold tablosuna göre bu eli sürmek mi, çekmek mi daha doğru? Önce Üst düzey bölümündeki Push/fold dersini oku.');
const Mx_bluff=()=>xmShell('xm-bluff',xmBluff,XM.bluff,'Bahis büyüklüğüne göre blöf ve savunma sıklıklarını hesapla. Formüller “Oyun teorisi” dersinde.');
const Mx_m=()=>xmShell('xm-m',xmM,XM.m,'Fiş, körler ve ante verildi. M oranını hesapla ve hangi bölgede olduğunu bul.');

/* ---------------- Kayıt ---------------- */
(()=>{
  ACH_BASE.push(
    {id:'mit-orta',t:'MIT: Orta Düzey',d:'Orta düzey MIT derslerinin hepsini bitir.'},
    {id:'mit-ust',t:'MIT: Üst Düzey',d:'Üst düzey MIT derslerinin hepsini bitir.'}
  );
  const L=LESSONS,at=L.findIndex(x=>x.id==='sozluk');
  L.splice(at+1,0,
    {id:'mit-analiz',g:'Orta düzey',t:'Karar noktası ve rakip modeli',r:Mi_analiz},
    {id:'mit-zimni',g:'Orta düzey',t:'Zımni oranlar ve fold equity',r:Mi_zimni},
    {id:'mit-range',g:'Orta düzey',t:'Aralıklar ve el yüzdeleri',r:Mi_range},
    {id:'mit-m',g:'Orta düzey',t:'M oranı ve turnuva tempo’su',r:Mi_m},
    {id:'mit-pushfold',g:'Üst düzey',t:'Push/fold: kısa fişle oyun',r:Mu_pushfold},
    {id:'mit-levels',g:'Üst düzey',t:'Düşünme seviyeleri ve psikoloji',r:Mu_levels},
    {id:'mit-gto',g:'Üst düzey',t:'Oyun teorisi: blöf ve değer dengesi',r:Mu_gto},
    {id:'mit-combo',g:'Üst düzey',t:'Kombinasyon sayımı ve el okuma',r:Mu_combo},
    {id:'mit-icm',g:'Üst düzey',t:'ICM, kabarcık ve sermaye',r:Mu_icm}
  );
  const q=L.findIndex(x=>x.id==='xqpre');
  L.splice(q+1,0,
    {id:'xmpush',g:'Alıştırmalar',t:'Push mu, fold mu? (MIT)',r:Mx_push},
    {id:'xmm',g:'Alıştırmalar',t:'Hangi M bölgesi? (MIT)',r:Mx_m},
    {id:'xmbluff',g:'Alıştırmalar',t:'Blöf ve savunma sıklığı (MIT)',r:Mx_bluff}
  );
  // Menü açıklaması
  const d=document.querySelector('#go-learn .ch-d');
  if(d)d.textContent=`${L.filter(l=>l.g!=='Alıştırmalar').length} ders ve ${L.filter(l=>l.g==='Alıştırmalar').length} alıştırma, üç düzeyde: başlangıç, orta ve üst. Orta ve üst düzey bölümler MIT'nin poker kuramı dersine dayanır. Pot oranı, push/fold ve blöf alıştırmaları, bitirme sınavı. Koç yalnızca alıştırma masalarında.`;
  // Gruplar ve başlıklar
  const rn0=renderNav;
  renderNav=function(){
    rn0();
    $$('#lnav .grp').forEach(e=>{
      if(e.textContent==='Dersler')e.textContent='Başlangıç düzeyi';
      else if(e.textContent==='Orta düzey'||e.textContent==='Üst düzey')e.innerHTML=e.textContent+' <span class="mit-badge">MIT</span>';
    });
  };
  const ol0=openLesson;
  openLesson=function(id){
    ol0(id);
    const l=LESSONS.find(x=>x.id===id);if(!l)return;
    const k=document.querySelector('#lesson .kicker');
    if(k){
      const n=LESSONS.filter(x=>x.g===l.g).indexOf(l)+1;
      if(l.g==='Dersler')k.textContent=`Başlangıç · Ders ${n}`;
      else if(l.g==='Orta düzey'||l.g==='Üst düzey')k.innerHTML=`${l.g} · Ders ${n} <span class="mit-badge">MIT 15.S50</span>`;
    }
    for(const [g,ach] of [['Orta düzey','mit-orta'],['Üst düzey','mit-ust']])
      if(LESSONS.filter(x=>x.g===g).every(x=>SAVE.seen.includes(x.id)))Ach.unlock(ach);
  };
})();
