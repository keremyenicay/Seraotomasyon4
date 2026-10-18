/* Sera Otomasyon – veri modeli ve kalıcı depolama (cihazda, localStorage) */
(function () {
  'use strict';

  const KEY = 'seraotomasyon.v1';

  const VARSAYILAN_ISLER = [
    'KLİPS',
    'MEYVE SEYRELTME',
    'MEYVE SEYRELTME-BASTON',
    'BASTON',
    'BUDAMA',
    'ALT MEYVE SEYRELTME-BASTON KONTROLÜ',
    'YAPRAK',
    'TUTA KONTROLÜ',
    'BİTKİ KONTROLÜ',
    'GENEL KONTROL',
    'ZARARLI KONTROLÜ-GENEL KONTROL',
    'KALAN KÜLTÜREL İŞLEMLER',
    'TESPİT EDİLEN EKSİKLİKLERİN TAMAMLANMASI',
    'TUZAKLARIN KALDIRILMASI VE DEĞİŞTİRİLMESİ',
    'İLK HASAT',
    'HASAT',
  ];

  const DURUMLAR = {
    geldi: 'Geldi',
    yok: 'Yok',
    izinli: 'İzinli',
    raporlu: 'Raporlu',
  };

  // Hasat / yaprak günü planı: joker ve yatırmacılar (yatırma bitince saatte `hiz` sıra yardım eder)
  const PLAN_AYAR = { mesai: 8, hiz: 1.5, yatirmaSaat: 4, jokerEk: 2, maksEk: 4, joker: 'KEVSER KAYA', yatirmacilar: ['NAZİME', 'SAFİYE', 'ÖZLEM'] };

  function bosDurum() {
    return {
      surum: 1,
      seralar: [],
      personel: [],
      isTurleri: VARSAYILAN_ISLER.slice(),
      gunler: {},
      hasatlar: [],
      tahminler: [],
      drenajlar: [],
      ilaclamalar: [],
      sektorler: [],
      yerlesim: {},
      bitkiSayimlari: [],
      karantina: {},
      planlar: [],
      planAyar: Object.assign({}, PLAN_AYAR),
      ayarlar: { pazarTatil: true, sonYedek: null, kurulum: new Date().toISOString() },
    };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  let durum = yukle();

  function yukle() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('Veri okunamadı', e);
    }
    return bosDurum();
  }

  function normalize(d) {
    const b = bosDurum();
    d = Object.assign(b, d || {});
    d.ayarlar = Object.assign(bosDurum().ayarlar, d.ayarlar || {});
    if (!Array.isArray(d.isTurleri) || !d.isTurleri.length) d.isTurleri = VARSAYILAN_ISLER.slice();
    d.seralar = d.seralar || [];
    d.personel = d.personel || [];
    d.gunler = d.gunler || {};
    d.hasatlar = Array.isArray(d.hasatlar) ? d.hasatlar : [];
    d.ilaclamalar = Array.isArray(d.ilaclamalar) ? d.ilaclamalar : [];
    d.tahminler = Array.isArray(d.tahminler) ? d.tahminler : [];
    d.drenajlar = Array.isArray(d.drenajlar) ? d.drenajlar : [];
    d.sektorler = Array.isArray(d.sektorler) ? d.sektorler : [];
    d.yerlesim = d.yerlesim && typeof d.yerlesim === 'object' ? d.yerlesim : {};
    d.bitkiSayimlari = Array.isArray(d.bitkiSayimlari) ? d.bitkiSayimlari : [];
    d.karantina = d.karantina && typeof d.karantina === 'object' ? d.karantina : {};
    d.planlar = Array.isArray(d.planlar) ? d.planlar : [];
    d.planAyar = Object.assign({}, PLAN_AYAR, d.planAyar && typeof d.planAyar === 'object' ? d.planAyar : {});
    // Silinmiş personelden kalan yerleşimleri temizle
    const pidler = new Set(d.personel.map((p) => p.id));
    Object.keys(d.yerlesim).forEach((pid) => {
      if (!pidler.has(pid) || !Array.isArray(d.yerlesim[pid]) || !d.yerlesim[pid].length) delete d.yerlesim[pid];
    });
    return d;
  }

  let kayitZamanlayici = null;
  const dinleyiciler = [];
  function kaydet(hemen) {
    clearTimeout(kayitZamanlayici);
    const yaz = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(durum));
      } catch (e) {
        alert('Veri kaydedilemedi! Depolama dolu olabilir. Lütfen Ayarlar > Yedek Al yapın.\n' + e.message);
      }
      dinleyiciler.forEach((f) => f());
    };
    if (hemen) yaz();
    else kayitZamanlayici = setTimeout(yaz, 250);
  }
  window.addEventListener('pagehide', () => kaydet(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') kaydet(true);
  });

  // ---- Yardımcılar ----
  function sayi(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : null;
  }
  function sayiYaz(n) {
    if (n === null || n === undefined || n === '') return '';
    const r = Math.round(Number(n) * 100) / 100;
    return String(r).replace('.', ',');
  }
  // "7 (50M) - 9 (45M)" -> 16, "15,5 (45M)" -> 15.5
  function siraMetnindenToplam(metin) {
    if (!metin) return null;
    const temiz = String(metin).replace(/\([^)]*\)/g, ' ');
    const sayilar = temiz.match(/\d+(?:[.,]\d+)?/g);
    if (!sayilar) return null;
    return sayilar.reduce((t, s) => t + parseFloat(s.replace(',', '.')), 0);
  }
  function trUpper(s) {
    return String(s || '').toLocaleUpperCase('tr-TR');
  }
  function trLower(s) {
    return String(s || '').toLocaleLowerCase('tr-TR');
  }
  function isimAnahtar(s) {
    return trUpper(s).replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '');
  }

  // Tarih: 'YYYY-MM-DD' (yerel)
  function tarihStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const g = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${g}`;
  }
  function strTarih(s) {
    const [y, m, g] = s.split('-').map(Number);
    return new Date(y, m - 1, g);
  }
  function gunEkle(s, n) {
    const d = strTarih(s);
    d.setDate(d.getDate() + n);
    return tarihStr(d);
  }
  function trTarih(s) {
    const [y, m, g] = s.split('-');
    return `${g}.${m}.${y}`;
  }
  const AYLAR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
  const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  // ---- Seralar ----
  function seraEkle(ad) {
    const s = { id: uid(), ad: trUpper(ad.trim()) };
    durum.seralar.push(s);
    kaydet();
    return s;
  }
  function seraBulAd(ad) {
    const k = isimAnahtar(ad);
    return durum.seralar.find((s) => isimAnahtar(s.ad) === k);
  }
  function sera(id) {
    return durum.seralar.find((s) => s.id === id);
  }

  // ---- Personel ----
  function personelEkle(p) {
    const yeni = Object.assign(
      { id: uid(), ad: '', seraId: null, siraMetni: '', toplamSira: null, aktif: true },
      p
    );
    yeni.ad = trUpper(yeni.ad.trim());
    if (yeni.toplamSira === null || yeni.toplamSira === undefined) yeni.toplamSira = siraMetnindenToplam(yeni.siraMetni);
    durum.personel.push(yeni);
    kaydet();
    return yeni;
  }
  function personelBulAd(ad) {
    const k = isimAnahtar(ad);
    return durum.personel.find((p) => isimAnahtar(p.ad) === k);
  }
  function kisi(id) {
    return durum.personel.find((p) => p.id === id);
  }
  function seraPersoneli(seraId, tumu) {
    return durum.personel.filter((p) => p.seraId === seraId && (tumu || p.aktif));
  }

  // ---- Günlük kayıtlar ----
  function gun(t, olustur) {
    if (!durum.gunler[t] && olustur) durum.gunler[t] = { tatil: null, kayitlar: {} };
    return durum.gunler[t] || null;
  }
  function kayit(t, pid) {
    const g = gun(t);
    return g ? g.kayitlar[pid] || null : null;
  }
  function yeniKayit(p, seraId) {
    return {
      seraId: seraId || p.seraId,
      durum: 'geldi',
      isler: [{ is: '', toplam: p.toplamSira, kalan: 0 }],
      yerine: '',
      not: '',
    };
  }
  function kayitAl(t, pid) {
    const g = gun(t, true);
    if (!g.kayitlar[pid]) {
      const p = kisi(pid);
      g.kayitlar[pid] = yeniKayit(p);
    }
    return g.kayitlar[pid];
  }
  function oncekiKayit(t, pid, maksGun) {
    for (let i = 1; i <= (maksGun || 10); i++) {
      const k = kayit(gunEkle(t, -i), pid);
      if (k && k.isler && k.isler.some((x) => x.is)) return { tarih: gunEkle(t, -i), kayit: k };
    }
    return null;
  }
  function tatilMi(t) {
    const g = gun(t);
    if (g && g.tatil) return g.tatil;
    return null;
  }
  function pazarMi(t) {
    return strTarih(t).getDay() === 0;
  }
  function yapilan(isKaydi) {
    const top = sayi(isKaydi.toplam);
    const kal = sayi(isKaydi.kalan) || 0;
    if (top === null) return null;
    return Math.max(0, Math.round((top - kal) * 100) / 100);
  }

  // ---- Hasat & İlaçlama ----
  const HEDEFLER = [
    'TUTA (DOMATES GÜVESİ)',
    'BEYAZ SİNEK',
    'YAPRAK BİTİ',
    'THRİPS',
    'KIRMIZI ÖRÜMCEK',
    'YAPRAK GALERİ SİNEĞİ',
    'KÜLLEME',
    'MİLDİYÖ',
    'KURŞUNİ KÜF (BOTRYTİS)',
    'ERKEN YANIKLIK',
    'KÖK BOĞAZI ÇÜRÜKLÜĞÜ',
    'NEMATOD',
    'YAPRAK GÜBRESİ',
  ];
  const UYGULAMALAR = ['PÜSKÜRTME', 'DAMLA SULAMA İLE', 'SİSLEME', 'TOZLAMA', 'TOPRAĞA'];
  const SINIFLAR = ['1. SINIF', '2. SINIF', '3. SINIF', 'ISKARTA'];

  function kayitKaydet(liste, obj) {
    const arr = durum[liste];
    if (!obj.id) {
      obj.id = uid();
      arr.push(obj);
    } else {
      const i = arr.findIndex((x) => x.id === obj.id);
      if (i >= 0) arr[i] = obj;
      else arr.push(obj);
    }
    arr.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
    kaydet();
    return obj;
  }
  function kayitSil(liste, id) {
    durum[liste] = durum[liste].filter((x) => x.id !== id);
    kaydet();
  }
  // Hasat için uygun ilk gün = ilaçlama tarihi + bekleme süresi
  function uygunTarih(il) {
    const b = sayi(il.bekleme) || 0;
    return gunEkle(il.tarih, b);
  }
  // t gününde bu serada bekleme süresi dolmamış ilaçlamalar
  function beklemeUyarilari(seraId, t) {
    return durum.ilaclamalar.filter(
      (il) => (sayi(il.bekleme) || 0) > 0 && (!il.seraId || !seraId || il.seraId === seraId) && il.tarih <= t && uygunTarih(il) > t
    );
  }
  // ---- Hasat tahmini: tünel (sektör) başına örnek sıralardan 1. kalite salkım sayımı ----
  // kutu/sıra = salkım ÷ kutudaki salkım (alt kat + üst kat); toplam kutu = sıra × kutu/sıra; palet = toplam kutu ÷ kapasite
  const ALT_KATLAR = [4, 5, 6];
  const UST_KATLAR = [3, 4, 5];
  const PALETLER = [
    { tur: 'EURO', boy: 13, kutu: 104 },
    { tur: 'EURO', boy: 14, kutu: 112 },
    { tur: 'EURO', boy: 15, kutu: 120 },
    { tur: 'BÜYÜK', boy: 13, kutu: 130 },
    { tur: 'BÜYÜK', boy: 14, kutu: 140 },
    { tur: 'BÜYÜK', boy: 15, kutu: 150 },
  ];
  function sektorSiraSayisi(sk) {
    return sk ? sk.harfler.reduce((t, h) => t + gutterSayisi(sk.seraId, h), 0) : 0;
  }
  // Hasat birimleri: seradaki tüneller, sektör numarasıyla (5*6 → 5 ve 6 ayrı)
  function hasatBirimleri(seraId) {
    const l = [];
    sektorleriHazirla()
      .filter((x) => x.seraId === seraId)
      .forEach((sk) => sk.harfler.forEach((h) => l.push({ harf: h, no: SEKTOR_HARF_NO(seraId, h) || (sk.harfler.length > 1 ? sk.no + '-' + h : sk.no), sk })));
    return l.sort((a, b) => (parseInt(a.no, 10) || 99) - (parseInt(b.no, 10) || 99));
  }
  // Sıra sayısı: son bitki sayımında bu tünelde bitkisi olan gutter sayısı (sayım yoksa gutter sayısı)
  function hasatSiraSayisi(seraId, harf) {
    const sy = sonSayim(seraId);
    if (sy) {
      const n = Object.entries(sy.sayilar).filter(([k, v]) => k[0] === harf && (v || 0) > 0).length;
      if (n) return { sira: n, kaynak: sy.tarih };
    }
    return { sira: gutterSayisi(seraId, harf), kaynak: null };
  }
  function tahminHesapla(t) {
    t = t || {};
    const alt = sayi(t.alt) || 5;
    const ust = sayi(t.ust) || 3;
    const kutuSalkim = alt + ust;
    const birimler = [];
    const sira = hasatBirimleri(t.seraId).map((x) => x.harf);
    Object.entries(t.birimler || {}).forEach(([harf, v]) => {
      const sayimlar = (v.sayimlar || []).map(sayi).filter((n) => n !== null && n >= 0);
      if (!sayimlar.length) return;
      const s = sayi(v.sira) || hasatSiraSayisi(t.seraId, harf).sira;
      const ort = sayimlar.reduce((a, b) => a + b, 0) / sayimlar.length;
      const kutuSira = ort / kutuSalkim;
      const toplamKutu = s * kutuSira;
      birimler.push({
        harf,
        no: SEKTOR_HARF_NO(t.seraId, harf) || harf,
        sira: s,
        sayimlar,
        ort: Math.round(ort * 100) / 100,
        kutuSira: Math.round(kutuSira * 100) / 100,
        toplamKutu,
        salkim: Math.round(ort * s),
        paletler: PALETLER.map((p) => toplamKutu / p.kutu),
      });
    });
    birimler.sort((a, b) => sira.indexOf(a.harf) - sira.indexOf(b.harf));
    const toplamKutu = birimler.reduce((a, x) => a + x.toplamKutu, 0);
    return {
      birimler,
      alt,
      ust,
      kutuSalkim,
      toplamSira: birimler.reduce((a, x) => a + x.sira, 0),
      toplamKutu,
      paletler: PALETLER.map((p) => toplamKutu / p.kutu),
      // geriye uyum (özet, harita)
      toplam: birimler.length ? birimler.reduce((a, x) => a + x.salkim, 0) : null,
      ortKutu: birimler.length ? Math.round(toplamKutu) : null,
    };
  }
  function tahminGecerli(t) {
    return !!(t && t.birimler && Object.keys(t.birimler).length);
  }

  // ---- Drenaj ölçümü (ara ölçüm / gün sonu) ----
  const DRENAJ_TURLERI = { ara: 'Ara ölçüm', gunsonu: 'Gün sonu' };
  function drenajOrani(v) {
    const drip = sayi(v && v.drip);
    const su = sayi(v && v.dripSu);
    const dren = sayi(v && v.drenSu);
    if (!drip || !su || dren === null) return null;
    return dren / su / drip;
  }
  function drenajBul(tarih, tur) {
    return durum.drenajlar.find((x) => x.tarih === tarih && x.tur === tur) || null;
  }
  function drenajOzet(kayit) {
    const v = Object.values((kayit && kayit.vanalar) || {});
    const ort = (f) => {
      const l = v.map(f).filter((n) => n !== null && n !== undefined && isFinite(n));
      return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
    };
    return {
      vana: v.filter((x) => drenajOrani(x) !== null || sayi(x.drenEc) !== null).length,
      oran: ort(drenajOrani),
      drenEc: ort((x) => sayi(x.drenEc)),
      drenPh: ort((x) => sayi(x.drenPh)),
      dripEc: ort((x) => sayi(x.dripEc)),
      dripPh: ort((x) => sayi(x.dripPh)),
    };
  }

  // Serada personelin toplam sıra sayısı (tahmin için öneri)
  function seraSiraToplami(seraId) {
    return durum.personel.filter((p) => p.seraId === seraId && p.aktif).reduce((t, p) => t + (sayi(p.toplamSira) || 0), 0) || null;
  }

  // ---- Sera içi sektörler, kişi yerleşimi (gutter) ve bitki sayımları ----
  // Şema: giriş altta. Sera 1: sağ alt Sektör 1 (A), sol alt 2 (B), sağ orta 3 (C), sol orta 4 (D).
  // Sera 2: sağ 5*6 (A+B), sol 7 (C), üst sıra soldan sağa 11 (G), 10 (F), 9 (E), 8 (D).
  // yon: 1. gutter'ın kutunun hangi kenarında olduğu ('sol' = sol kenar). Orta yol tarafı varsayılan.
  const SEKTOR_SABLONU = [
    { no: '1', sera: 'SERA 1', harfler: ['A'], kutu: { x: 361, y: 535, w: 336, h: 190 }, yon: 'sol' },
    { no: '2', sera: 'SERA 1', harfler: ['B'], kutu: { x: 2, y: 533, w: 303, h: 192 }, yon: 'sag' },
    { no: '3', sera: 'SERA 1', harfler: ['C'], kutu: { x: 352, y: 324, w: 345, h: 144 }, yon: 'sol' },
    { no: '4', sera: 'SERA 1', harfler: ['D'], kutu: { x: 2, y: 322, w: 302, h: 148 }, yon: 'sag' },
    { no: '5 * 6', sera: 'SERA 2', harfler: ['A', 'B'], kutu: { x: 351, y: 179, w: 344, h: 141 }, yon: 'sol' },
    { no: '7', sera: 'SERA 2', harfler: ['C'], kutu: { x: 2, y: 176, w: 303, h: 144 }, yon: 'sag' },
    { no: '8', sera: 'SERA 2', harfler: ['D'], kutu: { x: 533, y: 3, w: 164, h: 117 }, yon: 'sol' },
    { no: '9', sera: 'SERA 2', harfler: ['E'], kutu: { x: 393, y: 3, w: 138, h: 117 }, yon: 'sol' },
    { no: '10', sera: 'SERA 2', harfler: ['F'], kutu: { x: 235, y: 5, w: 155, h: 112 }, yon: 'sag' },
    { no: '11', sera: 'SERA 2', harfler: ['G'], kutu: { x: 2, y: 2, w: 231, h: 118 }, yon: 'sag' },
  ];
  // Excel başlığındaki sektör numarası → sera adı + tünel harfi (harfsiz satırlar için, ör. CHERRY)
  const SEKTOR_HARF = { 1: ['SERA 1', 'A'], 2: ['SERA 1', 'B'], 3: ['SERA 1', 'C'], 4: ['SERA 1', 'D'], 5: ['SERA 2', 'A'], 6: ['SERA 2', 'B'], 7: ['SERA 2', 'C'], 8: ['SERA 2', 'D'], 9: ['SERA 2', 'E'], 10: ['SERA 2', 'F'], 11: ['SERA 2', 'G'] };

  function sektorleriHazirla() {
    let degisti = false;
    SEKTOR_SABLONU.forEach((sb) => {
      const sera = seraBulAd(sb.sera);
      if (!sera) return;
      if (durum.sektorler.some((x) => x.seraId === sera.id && x.no === sb.no)) return;
      durum.sektorler.push({ id: uid(), no: sb.no, seraId: sera.id, harfler: sb.harfler.slice(), kutu: Object.assign({}, sb.kutu), yon: sb.yon });
      degisti = true;
    });
    if (degisti) kaydet();
    return durum.sektorler;
  }
  function sektorBul(seraId, harf) {
    return durum.sektorler.find((x) => x.seraId === seraId && x.harfler.includes(harf));
  }
  // Bir harfteki gutter sayısı = yerleşimdeki en büyük numara (yoksa 60)
  function gutterSayisi(seraId, harf) {
    const sk = sektorBul(seraId, harf);
    if (sk && sk.gutterSayilari && sk.gutterSayilari[harf]) return sk.gutterSayilari[harf];
    let max = 0;
    Object.values(durum.yerlesim).forEach((l) => l.forEach((g) => g.seraId === seraId && g.harf === harf && g.gutter > max && (max = g.gutter)));
    durum.bitkiSayimlari.forEach((sy) => {
      if (sy.seraId !== seraId) return;
      Object.keys(sy.sayilar).forEach((k) => {
        if (k[0] === harf) max = Math.max(max, parseInt(k.slice(1), 10) || 0);
      });
    });
    return max || 60;
  }
  function kisiGutterlari(pid) {
    return durum.yerlesim[pid] || [];
  }
  function gutterSahipleri(seraId, harf, no) {
    return gutterDilimleri(seraId, harf, no).map((x) => x.p);
  }
  // Gutter'ı kimler, hangi taraftan çalışıyor: [{p, taraf:'sol'|'sag'|null, kayit}] (sol → sağ sırasıyla)
  // Taraf girilmemiş iki kişi varsa ilki sol, ikincisi sağ sayılır.
  function gutterDilimleri(seraId, harf, no) {
    const l = [];
    Object.entries(durum.yerlesim).forEach(([pid, gs]) => {
      const kayit = gs.find((g) => g.seraId === seraId && g.harf === harf && g.gutter === no);
      const p = kayit && kisi(pid);
      if (p) l.push({ p, taraf: kayit.taraf || null, kayit });
    });
    if (l.length > 1) {
      const dolu = new Set(l.map((x) => x.taraf).filter(Boolean));
      l.forEach((x) => {
        if (!x.taraf) {
          x.taraf = dolu.has('sol') ? 'sag' : 'sol';
          dolu.add(x.taraf);
        }
      });
      l.sort((a, b) => (a.taraf === b.taraf ? 0 : a.taraf === 'sol' ? -1 : 1));
    }
    return l;
  }
  function tunelTahmin(seraId, harf, no) {
    for (const l of Object.values(durum.yerlesim)) {
      const x = l.find((g) => g.seraId === seraId && g.harf === harf && g.gutter === no);
      if (x && x.tunel) return x.tunel;
    }
    return `${Math.max(1, Math.ceil(no / 6))}-${harf}`;
  }
  // Kişinin listesine gutter'ı en yakın komşusunun yanına ekle (sıra / dönüş düzeni korunur)
  function yerlesimeEkle(pid, kayit) {
    const l = (durum.yerlesim[pid] = durum.yerlesim[pid] || []);
    let en = -1;
    let enD = Infinity;
    l.forEach((gt, i) => {
      if (gt.seraId === kayit.seraId && gt.harf === kayit.harf && Math.abs(gt.gutter - kayit.gutter) < enD) {
        enD = Math.abs(gt.gutter - kayit.gutter);
        en = i;
      }
    });
    if (en < 0) return l.push(kayit);
    const ayni = (x) => x && x.harf === kayit.harf && x.seraId === kayit.seraId;
    const yon = ayni(l[en + 1]) ? Math.sign(l[en + 1].gutter - l[en].gutter) : ayni(l[en - 1]) ? Math.sign(l[en].gutter - l[en - 1].gutter) : 1;
    l.splice((kayit.gutter - l[en].gutter) * yon > 0 ? en + 1 : en, 0, kayit);
  }
  function kisidenCikar(pid, seraId, harf, no) {
    if (!durum.yerlesim[pid]) return;
    durum.yerlesim[pid] = durum.yerlesim[pid].filter((g) => !(g.seraId === seraId && g.harf === harf && g.gutter === no));
    if (!durum.yerlesim[pid].length) delete durum.yerlesim[pid];
  }
  // Gutter'ı ata. pid null → boşalt. taraf null → tüm sıra (diğerleri çıkar); 'sol'/'sag' → sadece o taraf.
  function gutterAta(seraId, harf, no, pid, taraf) {
    const dilim = gutterDilimleri(seraId, harf, no);
    if (!taraf) {
      dilim.forEach((x) => x.p.id !== pid && kisidenCikar(x.p.id, seraId, harf, no));
    } else {
      dilim.forEach((x) => {
        if (x.p.id === pid) return;
        if (x.taraf === taraf) kisidenCikar(x.p.id, seraId, harf, no);
        else x.kayit.taraf = x.taraf; // karşı tarafı kalıcı yaz
      });
    }
    if (!pid) return;
    const mevcut = (durum.yerlesim[pid] || []).find((g) => g.seraId === seraId && g.harf === harf && g.gutter === no);
    if (mevcut) mevcut.taraf = taraf || null;
    else yerlesimeEkle(pid, { seraId, harf, gutter: no, tunel: tunelTahmin(seraId, harf, no), etiket: '', taraf: taraf || null });
  }

  // ---- Karantina sıraları ----
  function karantinaMi(seraId, harf, no) {
    const k = durum.karantina[seraId];
    return !!(k && k[harf + no]);
  }
  function karantinaAyarla(seraId, harf, no, acik, not) {
    const k = (durum.karantina[seraId] = durum.karantina[seraId] || {});
    if (acik) k[harf + no] = { tarih: (k[harf + no] && k[harf + no].tarih) || tarihStr(new Date()), not: not || '' };
    else delete k[harf + no];
  }
  function karantinaListesi(seraId) {
    const out = [];
    Object.entries(durum.karantina).forEach(([sid, k]) => {
      if (seraId && sid !== seraId) return;
      Object.entries(k).forEach(([key, v]) => {
        const harf = key[0];
        const no = parseInt(key.slice(1), 10);
        out.push({ seraId: sid, harf, no, tarih: v.tarih, not: v.not, kisiler: gutterSahipleri(sid, harf, no) });
      });
    });
    return out.sort((a, b) => (a.seraId + a.harf + String(a.no).padStart(3, '0') < b.seraId + b.harf + String(b.no).padStart(3, '0') ? -1 : 1));
  }
  function kisiKarantina(pid) {
    return kisiGutterlari(pid)
      .filter((g) => karantinaMi(g.seraId, g.harf, g.gutter))
      .map((g) => g.harf + g.gutter);
  }
  function sayimlar(seraId) {
    return durum.bitkiSayimlari.filter((x) => x.seraId === seraId).sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
  }
  function sonSayim(seraId) {
    const l = sayimlar(seraId);
    return l[l.length - 1] || null;
  }
  function oncekiSayim(seraId) {
    const l = sayimlar(seraId);
    return l.length > 1 ? l[l.length - 2] : null;
  }
  // Gutter toplamı (paylaşılan / yarım sıralarda kişilerin toplamı)
  function gutterBitki(sayim, harf, no) {
    if (!sayim) return null;
    const v = sayim.sayilar[harf + no];
    return v === undefined ? null : v;
  }
  // Kişinin o gutter'daki bitkisi (yarım sıra paylaşımında kendi payı)
  function kisiGutterBitki(sayim, pid, harf, no) {
    if (!sayim) return null;
    const k = sayim.kisi && sayim.kisi[pid];
    if (k && k[harf + no] !== undefined) return k[harf + no];
    return gutterBitki(sayim, harf, no);
  }
  // Gutter toplamını kişi paylarından yeniden hesapla
  function gutterToplamGuncelle(sayim, seraId, harf, no) {
    const sahipler = gutterSahipleri(seraId, harf, no);
    const paylar = sahipler.map((p) => sayim.kisi && sayim.kisi[p.id] && sayim.kisi[p.id][harf + no]).filter((v) => v !== undefined && v !== null);
    if (paylar.length) sayim.sayilar[harf + no] = paylar.reduce((a, b) => a + b, 0);
  }
  // Kişinin son ve önceki sayımdaki bitki toplamı
  function kisiBitki(pid) {
    let son = 0,
      onceki = 0,
      varOnceki = false,
      varSon = false;
    const gorulen = new Set();
    kisiGutterlari(pid).forEach((g) => {
      const k = g.seraId + g.harf + g.gutter;
      if (gorulen.has(k)) return;
      gorulen.add(k);
      const a = kisiGutterBitki(sonSayim(g.seraId), pid, g.harf, g.gutter);
      const b = kisiGutterBitki(oncekiSayim(g.seraId), pid, g.harf, g.gutter);
      if (a !== null) {
        son += a;
        varSon = true;
      }
      if (b !== null) {
        onceki += b;
        varOnceki = true;
      }
    });
    return { son: varSon ? son : null, onceki: varOnceki ? onceki : null, fark: varSon && varOnceki ? son - onceki : null };
  }
  function seraBitkiToplami(seraId, harfler) {
    const sy = sonSayim(seraId);
    if (!sy) return null;
    return Object.entries(sy.sayilar).reduce((t, [k, v]) => (!harfler || harfler.includes(k[0]) ? t + (v || 0) : t), 0);
  }
  // Kişinin gutter'larını ardışık parçalara ayır: [{seraId, harf, bas, bit, adet}] (dönüş yönü korunur)
  function kisiParcalari(pid) {
    const out = [];
    kisiGutterlari(pid).forEach((g) => {
      const son = out[out.length - 1];
      const taraf = g.taraf || null;
      if (son && son.seraId === g.seraId && son.harf === g.harf && son.taraf === taraf && Math.abs(g.gutter - son.bit) === 1 && (son.adet === 1 || Math.sign(g.gutter - son.bit) === son.yon)) {
        son.yon = Math.sign(g.gutter - son.bit);
        son.bit = g.gutter;
        son.adet++;
      } else out.push({ seraId: g.seraId, harf: g.harf, bas: g.gutter, bit: g.gutter, adet: 1, yon: 0, taraf });
    });
    return out;
  }
  function sektorAdi(seraId, harf) {
    const sk = sektorBul(seraId, harf);
    if (!sk) return harf;
    return 'Sektör ' + (sk.harfler.length > 1 ? SEKTOR_HARF_NO(seraId, harf) || sk.no : sk.no);
  }
  function SEKTOR_HARF_NO(seraId, harf) {
    const sera = durum.seralar.find((x) => x.id === seraId);
    const e = Object.entries(SEKTOR_HARF).find(([, v]) => sera && isimAnahtar(v[0]) === isimAnahtar(sera.ad) && v[1] === harf);
    return e ? e[0] : null;
  }

  // Önceki kayıtlardan ilaç kataloğu (ada göre son değerler)
  function ilacKatalogu() {
    const k = {};
    durum.ilaclamalar.forEach((il) => {
      if (il.ilac) k[trUpper(il.ilac)] = il;
    });
    return k;
  }

  // ---- Yedekleme ----
  function disaAktarJSON() {
    durum.ayarlar.sonYedek = new Date().toISOString();
    kaydet(true);
    return JSON.stringify(durum, null, 1);
  }
  function iceAktarJSON(metin) {
    const d = JSON.parse(metin);
    if (!d || !Array.isArray(d.personel) || typeof d.gunler !== 'object') throw new Error('Geçersiz yedek dosyası');
    durum = normalize(d);
    kaydet(true);
  }
  function sifirla() {
    durum = bosDurum();
    kaydet(true);
  }
  // Yalnızca girilen raporları sil: günlük kayıtlar, hasat, ilaçlama, hasat tahminleri ve drenaj ölçümleri.
  // Seralar, personel, harita/sektörler, yerleşim (sıralar), bitki sayımları, karantina,
  // iş türleri ve ayarlar korunur.
  const RAPOR_LISTELERI = ['hasatlar', 'ilaclamalar', 'tahminler', 'drenajlar', 'planlar'];
  function raporOzeti() {
    const o = { gun: Object.keys(durum.gunler).length };
    RAPOR_LISTELERI.forEach((k) => (o[k] = durum[k].length));
    return o;
  }
  function raporlariSil() {
    durum.gunler = {};
    RAPOR_LISTELERI.forEach((k) => (durum[k] = []));
    kaydet(true);
  }

  // ---- Bulut senkronu için parçalar ----
  // Her bölüm ayrı parça, günlük kayıtlar gün başına ayrı parça; böylece iki telefon
  // farklı günleri/bölümleri girdiğinde birbirinin kaydını ezmez.
  // ayarlar'dan yalnızca ortak olanlar paylaşılır (son yedek, kurulum tarihi cihaza özgü).
  const ORTAK_AYARLAR = ['pazarTatil', 'tahminDizilim', 'vanaSayisi', 'dripSayisi'];
  function parcalar() {
    const p = {};
    Object.keys(durum).forEach((k) => {
      if (k === 'gunler' || k === 'ayarlar') return;
      p['k:' + k] = durum[k];
    });
    const a = {};
    ORTAK_AYARLAR.forEach((k) => (a[k] = durum.ayarlar[k]));
    p['k:ayarlar'] = a;
    Object.keys(durum.gunler).forEach((t) => (p['gun:' + t] = durum.gunler[t]));
    return p;
  }
  function parcaUygula(anahtar, veri) {
    if (anahtar.startsWith('gun:')) {
      const t = anahtar.slice(4);
      if (veri === null || veri === undefined) delete durum.gunler[t];
      else durum.gunler[t] = veri;
    } else if (anahtar === 'k:ayarlar') {
      if (veri) ORTAK_AYARLAR.forEach((k) => k in veri && (durum.ayarlar[k] = veri[k]));
    } else if (anahtar.startsWith('k:')) {
      const k = anahtar.slice(2);
      if (veri === null || veri === undefined) delete durum[k];
      else durum[k] = veri;
    }
  }
  function parcalarBitti() {
    durum = normalize(durum);
    kaydet(true);
  }

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  window.Store = {
    get d() {
      return durum;
    },
    kaydet,
    uid,
    DURUMLAR,
    AYLAR,
    GUNLER,
    VARSAYILAN_ISLER,
    sayi,
    sayiYaz,
    siraMetnindenToplam,
    trUpper,
    trLower,
    isimAnahtar,
    tarihStr,
    strTarih,
    gunEkle,
    trTarih,
    seraEkle,
    seraBulAd,
    sera,
    personelEkle,
    personelBulAd,
    kisi,
    seraPersoneli,
    gun,
    kayit,
    kayitAl,
    yeniKayit,
    oncekiKayit,
    tatilMi,
    pazarMi,
    yapilan,
    HEDEFLER,
    UYGULAMALAR,
    SINIFLAR,
    kayitKaydet,
    kayitSil,
    uygunTarih,
    beklemeUyarilari,
    ilacKatalogu,
    ALT_KATLAR,
    UST_KATLAR,
    PALETLER,
    sektorSiraSayisi,
    hasatBirimleri,
    hasatSiraSayisi,
    tahminHesapla,
    tahminGecerli,
    DRENAJ_TURLERI,
    drenajOrani,
    drenajBul,
    drenajOzet,
    SEKTOR_HARF,
    sektorleriHazirla,
    sektorBul,
    gutterSayisi,
    kisiGutterlari,
    gutterSahipleri,
    gutterDilimleri,
    tunelTahmin,
    yerlesimeEkle,
    kisidenCikar,
    gutterAta,
    karantinaMi,
    karantinaAyarla,
    karantinaListesi,
    kisiKarantina,
    sayimlar,
    sonSayim,
    oncekiSayim,
    gutterBitki,
    kisiGutterBitki,
    gutterToplamGuncelle,
    kisiBitki,
    seraBitkiToplami,
    kisiParcalari,
    sektorAdi,
    seraSiraToplami,
    disaAktarJSON,
    iceAktarJSON,
    sifirla,
    raporOzeti,
    raporlariSil,
    parcalar,
    parcaUygula,
    parcalarBitti,
    kayitDinle: (f) => dinleyiciler.push(f),
  };
})();
