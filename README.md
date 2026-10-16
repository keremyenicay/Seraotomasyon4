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
  - Dosya iPhone paylaş menüsüyle WhatsApp'a, Mail'e veya Dosyalar'a gönderilir.
- **Excel'den içe aktarma:** Mevcut günlük ve aylık rapor dosyalarınızı seçtiğinizde seralar, personel, sıra sayıları ve geçmiş kayıtlar otomatik yüklenir.
- **Aylık özet:** Çalışılan gün, devamsızlık, tamamlanan ve kalan sıra, iş türlerine göre dağılım.
- **Çevrimdışı çalışır**, koyu modu destekler. Veriler yalnızca telefonda saklanır. JSON yedek alınabilir; 7 gün yedek alınmazsa uygulama hatırlatır.

## iPhone'a kurulum

1. Bu depo `main` dalına birleştirildiğinde GitHub Pages otomatik yayınlar:
   `https://keremyenicay.github.io/seraotomasyon4/`
   Pages kapalıysa bir kez açmak gerekir: **Settings → Pages → Source: GitHub Actions**.
2. Linki iPhone'da **Safari** ile açın.
3. **Paylaş → Ana Ekrana Ekle** adımlarını izleyin. Uygulama ana ekranda simgesiyle açılır ve internet olmadan da çalışır.
4. İlk açılışta **Excel'den içe aktar** ile mevcut günlük raporunuzu seçin; personel listesi hazır gelir.

## Önemli: yedek

Veriler telefonun tarayıcı deposunda tutulur. Safari verilerini silerseniz kayıtlar da silinir. Bunun için **Ayarlar → Yedek al** ile JSON dosyasını düzenli olarak Dosyalar'a veya iCloud'a kaydedin.

## Teknik

Derleme adımı yoktur: düz HTML, CSS ve JavaScript. Excel üretimi için [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 kullanılır (`vendor/`, MIT lisansı). Böylece Excel internetsiz de oluşturulur.

```
index.html            uygulama kabuğu
css/app.css           tasarım (açık/koyu tema)
js/store.js           veri modeli ve kayıt
js/excel.js           Excel çıktıları ve içe aktarma
js/app.js             ekranlar
sw.js                 çevrimdışı önbellek
```

Yerelde denemek için: `python3 -m http.server` komutunu çalıştırın, ardından `http://localhost:8000` adresini açın.

## Gelecek için fikirler

- İlaçlama ve gübreleme kaydı (ürün, doz, bekleme süresi uyarısı)
- Hasat miktarı (kg/kasa) takibi ve haftalık verim grafiği
- Puantaj ve yevmiye/maaş hesabı (çalışılan günlerden)
- Sera iklim notları (sıcaklık, nem, sulama)
- Birden fazla kişi kullanacaksa bulut senkronizasyonu (ör. Supabase)
