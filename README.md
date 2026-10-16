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
- **Hasat tahmini:** Seradan rastgele birkaç bitkide (ya da sırada) hasada hazır domatesleri sayarsınız; sıra sayısı ve sıradaki bitki sayısıyla toplam meyve tahmin edilir. Kutu dizilimi **alt kat 6 + üst kat 3 / 4 / 5** (kutu başı 9 / 10 / 11 adet) için kutu sayıları ve **ortalama kutu** hesaplanır; fire % düşülebilir. Bitki sayımı yüklüyse toplam bitki doğrudan sayımdan (sera ya da sektör bazında) alınır. Excel: formüllü Hasat Tahmini tablosu.
- **Sera Defteri – İlaçlama:** ilaç, etken madde, hedef zararlı/hastalık, uygulama şekli, doz, su, kullanılan miktar, uygulayan, bekleme süresi. Daha önce kullanılan ilaç seçilince bilgiler otomatik dolar. **Bekleme süresi dolmadan** Günlük ve Hasat ekranlarında kırmızı uyarı çıkar, hasat kaydında onay istenir. Excel: İlaçlama Kayıt Defteri (hasat için uygun tarih dahil).
- **Sera içi şema (Harita › Sera İçi):**
  - Şemadaki gibi: giriş altta. Sera 1'de sağ alt Sektör 1, sol alt Sektör 2, yoldan sonra sağda 3, solda 4. Sera 2'de 5*6, 7 ve üstte 11–10–9–8.
  - Tünel harfleri: Sera 1'de A=1, B=2, C=3, D=4. Sera 2'de A=5, B=6, C=7, D=8, E=9, F=10, G=11.
  - **Bitki sayısı Excel'i** (SERA 1 VE 2 BİTKİ SAYISI) içe aktarılınca herkesin tünel ve gutter'ları şemaya kendi rengiyle yerleşir.
  - İki sektöre yayılan kişilerde sıra sonundan dönüş oku çizilir (ör. A48–54 → C60–52). Yarım sıralar (paylaşılan gutter) iki kişi arasında bölünmüş görünür.
  - Bir sıraya dokununca kişinin sektör/gutter aralığı, bitki sayısı, önceki sayıma göre farkı ve bugünkü işi açılır.
  - Sektör detayında her gutter'ın bitki sayısı görünür; dokunarak sayı düzeltilir veya kişi değiştirilir. "Bugün sayım yap" ile yeni sayım açılır, kayıp otomatik hesaplanır.
  - Bir sektörde 1. gutter yanlış kenardaysa "Numaralamayı ters çevir" ile düzeltilir.
- **Uydu haritası:**
  - Konumunuz mavi nokta olarak görünür; seraların sınırları bir kez çizilir (haritaya dokunarak ya da köşede durup “Konumumu ekle”) ve hangi serada olduğunuz yazılır.
  - **Sıra işaretleri:** her işçinin sıralarının başlangıç (B) ve bitiş (S) noktası konumla ya da haritaya dokunarak işaretlenir. Haritada her kişi kendi renginde çizgi ve adıyla görünür; dokununca sıra bilgisi ve bugünkü işi açılır.
  - İlaç bekleme süresi devam eden seralar kırmızı çizilir. Bakılan uydu görüntüleri önbelleğe alınır, sahada internetsiz de açılır.
- **Excel'den içe aktarma:** Mevcut günlük rapor, aylık rapor ve bitki sayısı dosyalarınızı seçtiğinizde seralar, personel, sıra sayıları ve geçmiş kayıtlar otomatik yüklenir.
- **Aylık özet:** Çalışılan gün, devamsızlık, tamamlanan ve kalan sıra, iş türlerine göre dağılım.
- **Çevrimdışı çalışır**, koyu modu destekler. Veriler yalnızca telefonda saklanır. JSON yedek alınabilir; 7 gün yedek alınmazsa uygulama hatırlatır.

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
js/defter.js          hasat tahmini ve ilaçlama defteri
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
