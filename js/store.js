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

  function bosDurum() {
    return {
      surum: 1,
      seralar: [],
      personel: [],
      isTurleri: VARSAYILAN_ISLER.slice(),
      gunler: {},
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
    return d;
  }

  let kayitZamanlayici = null;
  function kaydet(hemen) {
    clearTimeout(kayitZamanlayici);
    const yaz = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(durum));
      } catch (e) {
        alert('Veri kaydedilemedi! Depolama dolu olabilir. Lütfen Ayarlar > Yedek Al yapın.\n' + e.message);
      }
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
    disaAktarJSON,
    iceAktarJSON,
    sifirla,
  };
})();
