# Sera Otomasyon

iPhone'da çalışan, internetsiz de açılan sera iş takip uygulaması. Günlük veriyi telefondan **bir kez** girersiniz; uygulama hem **günlük raporu** hem de **aylık personel raporunu** sizin kullandığınız Excel düzeninde otomatik oluşturur.

## Özellikler

- **Günlük giriş:** Sera sekmeleri, her personel için durum (Geldi / Yok / İzinli / Raporlu), 1–4 iş, toplam ve kalan sıra (±0,5 düğmeleri). Yapılan sıra kendiliğinden hesaplanır.
- **Toplu işlemler:**
  - *Toplu iş ata*: seradaki herkese aynı işi tek seferde atar.
  - *Kalanları devret*: önceki günden kalan sıraları bugüne iş olarak taşır (ör. dün 9,5 sıra meyve seyreltme kaldıysa bugün 9,5 olarak başlar).
  - *Dünden kopyala*, *Hepsi geldi*, *Tatil yap*.
- **Devamsızlık:** Gelmeyen için “yerine yapan” kaydedilir. Aylık raporun UYARI sütununa otomatik olarak `yok/… yaptı` yazılır.
- **Excel çıktıları:**
  - `SERA GÜNLÜK RAPOR GG.AA.YYYY.xlsx`: tüm seralar tek sayfada, orijinal başlıklar, renkler ve `=F-E` formülleriyle.
  - `<AY> AYI <SERA> RAPOR.xlsx`: her personel için ayrı sayfa (TARİH / YAPILAN İŞ / TAMAMLANAN / KALAN / UYARI, altta `SIRA SAYISI`). İsteğe bağlı ÖZET sayfası eklenebilir.
  - Ayın bütün günlük raporları tek dosyada (her gün bir sayfa).
  - Bitki sayımı: dosyanızın düzeninde kişi blokları, son 4 sayım yan yana, fark ve toplam bitki kaybı.
  - Dosya iPhone paylaş menüsüyle WhatsApp'a, Mail'e veya Dosyalar'a gönderilir.
- **Hasat miktarı (kutu + palet):** Sera seçilince sektörler listelenir (Sera 1: 1–4, Sera 2: 5, 6, 7 … 11; 5 ve 6 ayrı). Her sektörde 2 sıradan **1. kalite salkım** sayılır. **Sıra sayısı güncel bitki sayımından** gelir (bitkisi olan gutter sayısı). Kutu sayısı = salkım ÷ kutudaki salkım (**alt kat 4/5/6 + üst kat 3/4/5**, tek seçim); toplam kutu = sıra × kutu. **Paletler:** euro 13/14/15 boy (104/112/120 kutu), büyük 13/14/15 boy (130/140/150 kutu). Excel: “hasat miktarı hesaplama” düzeninde, kutudaki salkım ve palet kapasiteleri ayrı hücrelerde, tüm hesaplar formüllü; tarih × sektör özeti.
- **Hasat / yaprak planı (Defter › Plan):** Hasat veya yaprak gününden önce gelmeyecekleri işaretleyin. Gelen herkes **eşit pay** alır ve **tek bir yere** gider: en yakın gelmeyenin sıralarından art arda bir blok yapar, sonra kendi yerine döner. Kişi başı sayı −/+ ile elle değiştirilebilir; değiştirilen sabit kalır, kalanı otomatik yeniden dağıtılır. Joker (KEVSER KAYA) sabit yeri olmadan herkesten 2 sıra fazla alır, gruplarda artanları toplar ve birden fazla yere gidebilir. Yatırmacılar (NAZİME, SAFİYE, ÖZLEM) yatırma bitince saatte 1,5 sıra hesabıyla en fazla (mesai − yatırma saati) × 1,5 sıra alır. Başka seradan kişi ancak kendi serasındakiler 4 ek sırayı aşarsa çağrılır (tüm değerler ayarlanabilir). Karantina sıraları en sona, cherry sıraları dağıtıma girmez. Ekibe gönder (WhatsApp metni), Excel ve "Günlük kayda işle" (gelmedi + yerine yapan).
- **Drenaj ölçümü (Defter › Drenaj):** Vana 1–10 için drip sayısı, drip başına su, drene edilen su, drenaj EC/pH, drip EC/pH. Her gün **ara ölçüm** ve **gün sonu** ayrı girilir; drenaj oranı ve EC farkı anında hesaplanır. Excel: her ölçümün kendi dosyası (kaydedince hemen Paylaş/İndir açılır; listede ve Raporlar'da ölçüm başına Excel düğmesi) – drenaj ölçüm formu düzeninde (`=drenaj/drip suyu/drip sayısı`, % biçimi, ORTALAMA sütunu). Ara ölçüm ve gün sonu yalnızca aylık dosyada birleşik: her gün bir sayfa ve vana × gün drenaj oranı özeti.
- **Sera Defteri – İlaçlama:** ilaç, etken madde, hedef zararlı/hastalık, uygulama şekli, doz, su, kullanılan miktar, uygulayan, bekleme süresi. Daha önce kullanılan ilaç seçilince bilgiler otomatik dolar. **Bekleme süresi dolmadan** Günlük ve Hasat ekranlarında kırmızı uyarı çıkar, hasat kaydında onay istenir. Excel: İlaçlama Kayıt Defteri (hasat için uygun tarih dahil).
- **Sera içi şema (Harita › Sera İçi):**
  - Şemadaki gibi: giriş altta. Sera 1'de sağ alt Sektör 1, sol alt Sektör 2, yoldan sonra sağda 3, solda 4. Sera 2'de 5*6, 7 ve üstte 11–10–9–8.
  - Tünel harfleri: Sera 1'de A=1, B=2, C=3, D=4. Sera 2'de A=5, B=6, C=7, D=8, E=9, F=10, G=11.
  - **Bitki sayısı Excel'i** (SERA 1 VE 2 BİTKİ SAYISI) içe aktarılınca herkesin tünel ve gutter'ları şemaya kendi rengiyle yerleşir.
  - İki sektöre yayılan kişilerde sıra sonundan dönüş oku çizilir (ör. A48–54 → C60–52). Yarım sıralar (paylaşılan gutter) iki kişi arasında bölünmüş görünür.
  - Bir sıraya dokununca kişinin sektör/gutter aralığı ve bugünkü işi açılır. Alttaki özet şeridi dokunarak açılıp kapanır (varsayılan kapalı, harita büyük).
  - Görünümler: **Kişiler** (renkli yerleşim), **Bugünkü iş** (Günlük kayda göre yapılan yeşil, kalan turuncu, gelmeyen kırmızı) ve **Bitki sayımı** (sadece sayım yapılan günler).
  - **Elle düzenleme:** kişi kartında “Sıralarını düzenle” ile başlangıç/bitiş gutter'ları yazılır (dönüş için 60 → 52 gibi). Sektör ekranındaki **Düzenle** modunda kişi fırçasıyla gutter'lara dokunarak atanır, **Aralık** ile iki gutter arası tek seferde boyanır. Çakışan sıralarda “diğerlerinden çıkar” ya da “sağ/sol paylaş” seçilir.
  - **Sağ / sol taraf:** bir sıranın sol tarafını bir kişi, sağ tarafını başka kişi çalışabilir; gutter ikiye bölünmüş görünür.
  - **Karantina sıraları:** gutter sayfasından ya da Karantina fırçasıyla işaretlenir; şemada kırmızı taralı görünür, kişinin Günlük kartında uyarı çıkar, Excel'de ayrı sütun ve “KARANTİNA SIRALARI” sayfası olur.
  - **Bitki sayımı** her gün yapılmaz: “Bitki sayımları › Sayım modunu aç” ile tarih seçilir, sadece bu modda sayılar girilir; girilmeyen gutter'lar önceki sayımdan alınır, kayıp otomatik hesaplanır.
  - Sektör ayarından gutter sayısı ve 1. gutter'ın hangi kenarda olduğu değiştirilebilir.
- **Uydu haritası:**
  - Konumunuz mavi nokta olarak görünür; seraların sınırları bir kez çizilir (haritaya dokunarak ya da köşede durup “Konumumu ekle”) ve hangi serada olduğunuz yazılır.
  - **Sıra işaretleri:** her işçinin sıralarının başlangıç (B) ve bitiş (S) noktası konumla ya da haritaya dokunarak işaretlenir. Haritada her kişi kendi renginde çizgi ve adıyla görünür; dokununca sıra bilgisi ve bugünkü işi açılır.
  - İlaç bekleme süresi devam eden seralar kırmızı çizilir. Bakılan uydu görüntüleri önbelleğe alınır, sahada internetsiz de açılır.
- **Excel'den içe aktarma:** Mevcut günlük rapor, aylık rapor ve bitki sayısı dosyalarınızı seçtiğinizde seralar, personel, sıra sayıları ve geçmiş kayıtlar otomatik yüklenir.
- **Aylık özet:** Çalışılan gün, devamsızlık, tamamlanan ve kalan sıra, iş türlerine göre dağılım.
- **Kullanıcı girişi ve bulut senkronu (Supabase):** Uygulama açılınca kullanıcı adı ve şifre sorulur; oturum telefonda kalır. Üst çubukta giren kişinin adı ve senkron durumu (yeşil: tamam, turuncu: bekliyor/çevrimdışı, kırmızı: hata) görünür. Veriler önce telefona kaydedilir, internet gelince buluta gönderilir; başka telefonda yapılan değişiklik anında gelir. Birleştirme bölüm ve gün bazındadır, iki kişi farklı günleri ya da bölümleri girerse birbirinin kaydını ezmez.
  - İlk açılışta **yönetici hesabı** oluşturulur. Diğer hesapları yönetici **Ayarlar › Hesap ve senkron › Kullanıcılar** bölümünden ekler, şifresini değiştirir ya da devre dışı bırakır. Listede herkesin son görülme zamanı yazar.
  - Bağlantı ayarı `js/ayar.js` içindedir; boş bırakılırsa uygulama eskisi gibi girişsiz ve yalnızca telefonda çalışır. Veritabanı kurulumu: `supabase/migrations/001_giris_senkron.sql`.
- **Çevrimdışı çalışır**, koyu modu destekler. JSON yedek alınabilir.

## iPhone'a kurulum

1. Bu depo `main` dalına birleştirildiğinde GitHub Pages otomatik yayınlar:
   `https://keremyenicay.github.io/seraotomasyon4/`
   Pages kapalıysa bir kez açmak gerekir: **Settings → Pages → Source: GitHub Actions**.
2. Linki iPhone'da **Safari** ile açın.
3. **Paylaş → Ana Ekrana Ekle** adımlarını izleyin. Uygulama ana ekranda simgesiyle açılır ve internet olmadan da çalışır.
4. İlk açılışta **Excel'den içe aktar** ile mevcut günlük raporunuzu seçin; personel listesi hazır gelir.

## Konum notları

- iPhone'da ilk açılışta konum izni sorulur; reddedildiyse: **Ayarlar › Gizlilik ve Güvenlik › Konum Servisleri › Safari Web Siteleri › “Uygulamayı Kullanırken”**.
- Sera içinde GPS 3–10 m sapabilir; işaret koyarken alt paneldeki doğruluk (±m) değerine bakın, gerekirse noktayı sürükleyerek düzeltin.
- Ekran kapalıyken iOS web uygulamalarında konum izlenmez.

## Önemli: yedek

Veriler telefonun tarayıcı deposunda tutulur. Safari verilerini silerseniz kayıtlar da silinir. Bunun için **Ayarlar → Yedek al** ile JSON dosyasını düzenli olarak Dosyalar'a veya iCloud'a kaydedin.

## Teknik

Derleme adımı yoktur: düz HTML, CSS ve JavaScript. Excel üretimi için [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 (MIT), harita için [Leaflet](https://leafletjs.com) 1.9.4 (BSD-2) kullanılır (`vendor/`). Uydu görüntüsü Esri World Imagery, sokak haritası OpenStreetMap'tir. Böylece Excel internetsiz de oluşturulur.

```
index.html            uygulama kabuğu
css/app.css           tasarım (açık/koyu tema)
js/store.js           veri modeli ve kayıt
js/excel.js           Excel çıktıları ve içe aktarma
js/app.js             ekranlar
js/defter.js          hasat miktarı, ilaçlama ve drenaj defteri
js/harita.js          uydu haritası, konum, sıra işaretleri
js/sema.js            sera içi şema, gutter yerleşimi, bitki sayımı
sw.js                 çevrimdışı önbellek
```

Yerelde denemek için: `python3 -m http.server` komutunu çalıştırın, ardından `http://localhost:8000` adresini açın.

## Gelecek için fikirler

- Gübreleme programı ve stok takibi (ilaç/gübre deposu)
- Haftalık verim grafiği, sera ve dekar başına verim karşılaştırması
- Puantaj ve yevmiye/maaş hesabı (çalışılan günlerden)
- Sera iklim notları (sıcaklık, nem, sulama)
- Birden fazla kişi kullanacaksa bulut senkronizasyonu (ör. Supabase)
