/* Sera Otomasyon – Excel çıktıları (orijinal rapor düzeninde) ve Excel'den içe aktarma */
(function () {
  'use strict';
  const S = window.Store;

  const GRI = 'FFE2E2E2';
  const MAVI = 'FFD5E2FF';
  const INCE = { style: 'thin', color: { argb: 'FF000000' } };
  const KENAR = { top: INCE, left: INCE, bottom: INCE, right: INCE };

  function dolgu(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }

  // ---------- Ortak hesaplar ----------
  function adliIsler(k) {
    return (k && k.isler ? k.isler : []).filter((x) => x.is && String(x.is).trim());
  }

  function notMetni(k) {
    if (!k) return '';
    const parca = [];
    if (k.durum && k.durum !== 'geldi') {
      let s = S.trUpper(S.DURUMLAR[k.durum] || k.durum);
      if (k.yerine) s += ' - YERİNE ' + S.trUpper(k.yerine) + ' YAPTI';
      parca.push(s);
    }
    if (k.not) parca.push(S.trUpper(k.not));
    return parca.join(' - ');
  }

  function uyariMetni(k) {
    if (!k) return '';
    let s = '';
    if (k.durum && k.durum !== 'geldi') {
      s = k.durum === 'yok' ? 'yok' : S.trLower(S.DURUMLAR[k.durum]);
      if (k.yerine) s += '/' + S.trLower(k.yerine) + ' yaptı';
    }
    if (k.not) s = s ? s + ' - ' + k.not : k.not;
    return s;
  }

  function gunPersoneli(t, seraId) {
    // aktif personel + o gün bu serada kaydı olan herkes (sıra korunur)
    const g = S.gun(t);
    return S.d.personel.filter((p) => {
      const k = g && g.kayitlar[p.id];
      if (k) return (k.seraId || p.seraId) === seraId;
      return p.seraId === seraId && p.aktif;
    });
  }

  function ayGunleri(yil, ay) {
    const n = new Date(yil, ay + 1, 0).getDate();
    const liste = [];
    for (let i = 1; i <= n; i++) liste.push(S.tarihStr(new Date(yil, ay, i)));
    return liste;
  }

  function gundeKayitVarMi(t) {
    const g = S.gun(t);
    return !!(g && Object.values(g.kayitlar).some((k) => adliIsler(k).length));
  }

  function tatilMetni(t) {
    const tt = S.tatilMi(t);
    if (tt) return tt;
    if (S.d.ayarlar.pazarTatil && S.pazarMi(t) && !gundeKayitVarMi(t)) return 'Tatil';
    return null;
  }

  function ayPersoneli(yil, ay, seraId) {
    const gunler = ayGunleri(yil, ay);
    const kayitli = S.d.personel.filter((p) =>
      gunler.some((t) => {
        const k = S.kayit(t, p.id);
        return k && (k.seraId || p.seraId) === seraId;
      })
    );
    // Ayda hiç kayıt yoksa (yeni ay) serada aktif herkes listelenir
    if (!kayitli.length) return S.d.personel.filter((p) => p.seraId === seraId && p.aktif);
    return kayitli;
  }

  function ozet(yil, ay, seraId) {
    const gunler = ayGunleri(yil, ay);
    return ayPersoneli(yil, ay, seraId).map((p) => {
      const o = { p, calisti: 0, yok: 0, izinli: 0, raporlu: 0, yapilan: 0, kalan: 0, isler: {}, yokGunler: [] };
      gunler.forEach((t) => {
        const k = S.kayit(t, p.id);
        if (!k) return;
        const isler = adliIsler(k);
        if (k.durum && k.durum !== 'geldi') {
          o[k.durum] = (o[k.durum] || 0) + 1;
          o.yokGunler.push(t);
        } else if (isler.length) o.calisti++;
        if (k.durum === 'geldi' || !k.durum) {
          isler.forEach((x) => {
            const y = S.yapilan(x) || 0;
            o.yapilan += y;
            o.kalan += S.sayi(x.kalan) || 0;
            const ad = S.trUpper(x.is);
            o.isler[ad] = (o.isler[ad] || 0) + y;
          });
        }
      });
      o.yapilan = Math.round(o.yapilan * 100) / 100;
      o.kalan = Math.round(o.kalan * 100) / 100;
      return o;
    });
  }

  // ---------- GÜNLÜK RAPOR ----------
  async function gunlukRapor(t) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const ws = wb.addWorksheet('Sayfa1', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const g = S.gun(t);
    const seralar = S.d.seralar.filter((s) => gunPersoneli(t, s.id).length);

    let isSayisi = 2;
    seralar.forEach((s) =>
      gunPersoneli(t, s.id).forEach((p) => {
        const k = g && g.kayitlar[p.id];
        isSayisi = Math.max(isSayisi, adliIsler(k).length);
      })
    );
    const notKol = 3 + isSayisi * 2; // iş başına 2 sütun: iş adı + kalan sıra

    // Sütun genişlikleri (orijinal dosyadan)
    ws.getColumn(1).width = 18.78;
    ws.getColumn(2).width = 15.11;
    for (let j = 0; j < isSayisi; j++) {
      const b = 3 + j * 2;
      ws.getColumn(b).width = j === 0 ? 9.66 : 16.89;
      ws.getColumn(b + 1).width = 10.11;
    }
    ws.getColumn(notKol).width = 35.89;

    // 1. satır
    const a1 = ws.getCell(1, 1);
    a1.value = 'PERSONELLER';
    a1.font = { bold: true, size: 12 };
    ws.mergeCells(1, 2, 1, notKol);
    const b1 = ws.getCell(1, 2);
    const tt = S.tatilMi(t);
    b1.value = 'TARİH: ' + S.trTarih(t) + (tt ? ' (' + S.trUpper(tt) + ')' : '');
    b1.font = { bold: true, size: 12 };
    b1.alignment = { horizontal: 'center', vertical: 'middle' };
    [a1, b1].forEach((c) => (c.border = KENAR));

    let r = 2;
    const isGenislik = new Array(isSayisi).fill(0);
    const L = (n) => ws.getColumn(n).letter;
    const seraToplamlari = []; // [satır, sonuç]
    seralar.forEach((s, si) => {
      // Başlık
      const basliklar = [s.ad, 'TOPLAM SIRA SAYISI'];
      for (let j = 0; j < isSayisi; j++) basliklar.push('YAPILAN İŞ', 'KALAN SIRA SAYISI');
      basliklar.forEach((v, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = v || null;
        c.font = { bold: true, size: 10 };
        c.alignment = { wrapText: true, vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
        c.border = KENAR;
        if (v) c.fill = dolgu(GRI);
      });
      const nb = ws.getCell(r, notKol);
      if (si === 0) {
        nb.value = 'GELMEYENLER VE NOTLAR';
        nb.font = { bold: true, size: 10 };
      }
      nb.border = KENAR;
      r++;

      const ilk = r;
      const kalanTop = new Array(isSayisi).fill(0);
      gunPersoneli(t, s.id).forEach((p) => {
        const k = g && g.kayitlar[p.id];
        const isler = adliIsler(k);
        const row = ws.getRow(r);
        row.getCell(1).value = p.ad;
        row.getCell(2).value = p.siraMetni || (p.toplamSira !== null ? S.sayiYaz(p.toplamSira) : null);
        for (let j = 0; j < isSayisi; j++) {
          const b = 3 + j * 2;
          const x = isler[j];
          if (x) {
            const kal = S.sayi(x.kalan) || 0;
            row.getCell(b).value = S.trUpper(x.is);
            row.getCell(b + 1).value = kal;
            kalanTop[j] += kal;
            isGenislik[j] = Math.max(isGenislik[j], S.trUpper(x.is).length);
          }
          if (j === 0) row.getCell(b).fill = dolgu(MAVI);
          row.getCell(b + 1).alignment = { horizontal: 'center' };
        }
        row.getCell(notKol).value = notMetni(k) || null;
        for (let i = 1; i <= notKol; i++) {
          const c = row.getCell(i);
          c.border = KENAR;
          if (!c.font || !c.font.size) c.font = { size: 11 };
        }
        r++;
      });

      // Seranın kalan sıra toplamı
      const son = r - 1;
      const row = ws.getRow(r);
      row.getCell(1).value = `${s.ad} KALAN SIRA TOPLAMI`;
      const kalKol = Array.from({ length: isSayisi }, (_, j) => L(3 + j * 2 + 1));
      const genel = kalanTop.reduce((a, b) => a + b, 0);
      row.getCell(2).value = son >= ilk ? { formula: kalKol.map((k) => `SUM(${k}${ilk}:${k}${son})`).join('+'), result: genel } : 0;
      for (let j = 0; j < isSayisi; j++) {
        const c = row.getCell(3 + j * 2 + 1);
        c.value = son >= ilk ? { formula: `SUM(${kalKol[j]}${ilk}:${kalKol[j]}${son})`, result: kalanTop[j] } : 0;
      }
      for (let i = 1; i <= notKol; i++) {
        const c = row.getCell(i);
        c.border = KENAR;
        c.font = { bold: true, size: 11 };
        c.fill = dolgu(GRI);
        if (i > 1) c.alignment = { horizontal: 'center' };
      }
      seraToplamlari.push([r, genel]);
      r += 2;
    });
    if (seraToplamlari.length > 1) {
      const row = ws.getRow(r);
      row.getCell(1).value = 'GENEL TOPLAM KALAN SIRA';
      row.getCell(2).value = { formula: seraToplamlari.map(([n]) => `B${n}`).join('+'), result: seraToplamlari.reduce((a, [, v]) => a + v, 0) };
      [1, 2].forEach((i) => {
        const c = row.getCell(i);
        c.border = KENAR;
        c.font = { bold: true, size: 12 };
        c.fill = dolgu(GRI);
      });
      row.getCell(2).alignment = { horizontal: 'center' };
    }
    // İş adı sütunlarını içeriğe göre genişlet
    isGenislik.forEach((len, j) => {
      const col = ws.getColumn(3 + j * 2);
      col.width = Math.max(col.width, Math.min(40, len * 1.05 + 2));
    });
    return wb;
  }

  // ---------- AYLIK RAPOR (personel başına sayfa) ----------
  function sayfaAdi(ad, kullanilan) {
    let s = String(ad).replace(/[\\\/\?\*\[\]:]/g, '.').slice(0, 31).trim() || 'PERSONEL';
    let n = 2;
    const temel = s;
    while (kullanilan.has(s)) s = (temel.slice(0, 28) + ' ' + n++).slice(0, 31);
    kullanilan.add(s);
    return s;
  }

  function hucreListe(liste) {
    const v = liste.filter((x) => x !== null && x !== undefined);
    if (!liste.length) return null;
    if (liste.length === 1) return v.length ? v[0] : null;
    return liste.map((x) => (x === null || x === undefined ? 'yok' : S.sayiYaz(x))).join('/');
  }

  function personelSayfasi(wb, p, yil, ay, kullanilan) {
    const ws = wb.addWorksheet(sayfaAdi(p.ad, kullanilan), {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    });
    [29.78, 92.44, 32.44, 29.44, 37.33].forEach((w, i) => (ws.getColumn(i + 1).width = w));

    ws.mergeCells('A1:D1');
    const a1 = ws.getCell('A1');
    a1.value = 'PERSONEL: ' + p.ad;
    a1.font = { bold: true, size: 16 };
    const e1 = ws.getCell('E1');
    e1.value = S.AYLAR[ay];
    e1.font = { bold: true, size: 16 };
    e1.alignment = { horizontal: 'center' };
    ws.getRow(1).height = 24;

    const bas = ['TARİH', 'YAPILAN İŞ', 'KÜLTÜREL İŞLEMİ TAMAMLANAN SIRA SAYISI', 'KÜLTÜREL İŞLEMİ KALAN SAYISI', 'UYARI'];
    bas.forEach((v, i) => {
      const c = ws.getCell(2, i + 1);
      c.value = v;
      c.font = { bold: true, size: i === 4 ? 18 : 16 };
      c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(2).height = 70.8;

    const gunler = ayGunleri(yil, ay);
    gunler.forEach((t, i) => {
      const r = 3 + i;
      const row = ws.getRow(r);
      const k = S.kayit(t, p.id);
      const isler = adliIsler(k);
      const [yy, mm, dd] = t.split('-').map(Number);
      row.getCell(1).value = new Date(Date.UTC(yy, mm - 1, dd));
      row.getCell(1).numFmt = 'dd.mm.yyyy';
      if (isler.length) {
        row.getCell(2).value = k.hamIs || isler.map((x) => S.trLower(x.is)).join('/');
        row.getCell(3).value = hucreListe(isler.map((x) => S.yapilan(x)));
        row.getCell(4).value = hucreListe(isler.map((x) => (S.sayi(x.toplam) === null ? null : S.sayi(x.kalan) || 0)));
      } else {
        const tt = tatilMetni(t);
        if (tt) row.getCell(2).value = tt;
      }
      const u = uyariMetni(k);
      if (u) row.getCell(5).value = u;
      row.getCell(1).font = { size: 16 };
      row.getCell(2).font = { size: 22 };
      row.getCell(3).font = { bold: true, size: 18 };
      row.getCell(4).font = { bold: true, size: 18 };
      row.getCell(5).font = { size: 16 };
      row.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
      [1, 3, 4].forEach((c) => (row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }));
      row.getCell(5).alignment = { wrapText: true, vertical: 'middle' };
    });
    for (let r = 1; r <= 2 + gunler.length; r++) for (let c = 1; c <= 5; c++) ws.getCell(r, c).border = KENAR;

    const son = ws.getCell(34, 5);
    son.value = 'SIRA SAYISI:' + (p.toplamSira !== null && p.toplamSira !== undefined ? S.sayiYaz(p.toplamSira) : '');
    son.font = { bold: true, size: 16 };
    ws.views = [{ state: 'frozen', ySplit: 2 }];
    return ws;
  }

  function ozetSayfasi(wb, yil, ay, seraId, kullanilan) {
    const ws = wb.addWorksheet(sayfaAdi('ÖZET', kullanilan));
    const sera = S.sera(seraId);
    ws.mergeCells('A1:G1');
    ws.getCell('A1').value = `${S.AYLAR[ay]} ${yil} – ${sera ? sera.ad : ''} AYLIK ÖZET`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    const bas = ['PERSONEL', 'SIRA SAYISI', 'ÇALIŞTIĞI GÜN', 'GELMEDİĞİ GÜN', 'İZİNLİ / RAPORLU', 'TOPLAM TAMAMLANAN SIRA', 'TOPLAM KALAN SIRA'];
    [30, 12, 14, 14, 16, 22, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    bas.forEach((v, i) => {
      const c = ws.getCell(2, i + 1);
      c.value = v;
      c.font = { bold: true, size: 11 };
      c.fill = dolgu(GRI);
      c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      c.border = KENAR;
    });
    ozet(yil, ay, seraId).forEach((o, i) => {
      const row = ws.getRow(3 + i);
      [o.p.ad, o.p.toplamSira, o.calisti, o.yok, o.izinli + o.raporlu, o.yapilan, o.kalan].forEach((v, j) => {
        const c = row.getCell(j + 1);
        c.value = v;
        c.border = KENAR;
        if (j) c.alignment = { horizontal: 'center' };
      });
    });
    return ws;
  }

  async function aylikRapor(yil, ay, seraId, secenek) {
    secenek = secenek || {};
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const kullanilan = new Set();
    const seraIdler = seraId ? [seraId] : S.d.seralar.map((s) => s.id);
    seraIdler.forEach((sid) => {
      if (secenek.ozet) ozetSayfasi(wb, yil, ay, sid, kullanilan);
      ayPersoneli(yil, ay, sid).forEach((p) => personelSayfasi(wb, p, yil, ay, kullanilan));
    });
    if (!wb.worksheets.length) wb.addWorksheet('BOŞ');
    return wb;
  }

  async function blob(wb) {
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------- İÇE AKTARMA ----------
  function hv(cell) {
    let v = cell && cell.value;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('result' in v) v = v.result;
      else if (v.richText) v = v.richText.map((x) => x.text).join('');
      else if ('text' in v) v = v.text;
      else if (v.error) v = null;
    }
    if (typeof v === 'string') v = v.trim();
    return v === '' ? null : v;
  }

  function isTuruEkle(ad) {
    const u = S.trUpper(String(ad).trim());
    if (u && !S.d.isTurleri.includes(u)) S.d.isTurleri.push(u);
    return u;
  }

  function seraPersonelBul(ad, seraId) {
    const k = S.isimAnahtar(ad);
    return S.d.personel.find((p) => p.seraId === seraId && S.isimAnahtar(p.ad) === k);
  }

  function durumAyristir(metin) {
    const s = S.trUpper(metin || '').trim();
    const sonuc = { durum: 'geldi', yerine: '', not: '' };
    if (!s) return sonuc;
    const m = s.match(/^(YOK|İZİNLİ|IZINLI|RAPORLU)(?=$|[\s\-–\/.,])[\s\-–\/.,]*(.*)$/);
    if (m) {
      sonuc.durum = m[1] === 'YOK' ? 'yok' : m[1] === 'RAPORLU' ? 'raporlu' : 'izinli';
      let kalan = m[2] || '';
      const y = kalan.match(/(?:YERİNE\s+)?(.+?)\s+YAPTI\.?/);
      if (y) {
        sonuc.yerine = y[1].trim();
        kalan = kalan.replace(y[0], '').replace(/^[\s\-–\/.]+/, '');
      }
      sonuc.not = kalan.trim();
    } else sonuc.not = metin.trim();
    return sonuc;
  }

  function gunlukIceAktar(ws) {
    const b1 = String(hv(ws.getCell('B1')) || '');
    const m = b1.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
    const t = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
    let sera = null;
    let isKol = [];
    let notKol = null;
    const ist = { sera: 0, personel: 0, kayit: 0, tarih: t };
    const yeniSeralar = new Set();
    ws.eachRow((row, rn) => {
      if (rn < 2) return;
      const a = hv(row.getCell(1));
      const b = hv(row.getCell(2));
      if (b && S.trUpper(b) === 'TOPLAM SIRA SAYISI') {
        sera = S.seraBulAd(a) || S.seraEkle(String(a));
        if (!yeniSeralar.has(sera.id)) {
          yeniSeralar.add(sera.id);
          ist.sera++;
        }
        isKol = [];
        const bas = {};
        row.eachCell((c, cn) => {
          const v = S.trUpper(hv(c) || '');
          bas[cn] = v;
          if (v === 'YAPILAN İŞ') isKol.push(cn);
          if (v.startsWith('GELMEYENLER')) notKol = cn;
        });
        // Her işin "yapılan / kalan / toplam" sütunu başlıktan bulunur (eski 4 sütunlu ve yeni 2 sütunlu düzen)
        isKol = isKol.map((c, i) => {
          const sinir = isKol[i + 1] || c + 4;
          const ara = (on) => {
            for (let k = c + 1; k < sinir; k++) if ((bas[k] || '').startsWith(on)) return k;
            return null;
          };
          const yap = ara('YAPILAN SIRA');
          const kal = ara('KALAN');
          return { c, yap, kal, top: yap && kal && sinir > c + 3 ? c + 3 : null };
        });
        return;
      }
      if (!sera || !a) return;
      if (/KALAN SIRA TOPLAMI$|^GENEL TOPLAM/.test(S.trUpper(String(a)))) return;
      const ad = String(a);
      const siraMetni = b !== null ? String(b) : '';
      const ilkTop = isKol.length && isKol[0].top ? S.sayi(hv(row.getCell(isKol[0].top))) : null;
      const toplamSira = ilkTop !== null ? ilkTop : S.siraMetnindenToplam(siraMetni);
      let p = seraPersonelBul(ad, sera.id);
      if (!p) {
        p = S.personelEkle({ ad, seraId: sera.id, siraMetni, toplamSira });
        ist.personel++;
      } else {
        p.siraMetni = siraMetni || p.siraMetni;
        if (toplamSira !== null) p.toplamSira = toplamSira;
      }
      if (!t) return;
      const isler = [];
      isKol.forEach((k) => {
        const is = hv(row.getCell(k.c));
        if (!is) return;
        const yap = k.yap ? S.sayi(hv(row.getCell(k.yap))) : null;
        const kal = k.kal ? S.sayi(hv(row.getCell(k.kal))) : null;
        let top = k.top ? S.sayi(hv(row.getCell(k.top))) : null;
        if (top === null && yap !== null) top = yap + (kal || 0);
        if (top === null) top = p.toplamSira;
        isler.push({ is: isTuruEkle(is), toplam: top, kalan: kal || 0 });
      });
      const nk = notKol || (isKol.length ? isKol[isKol.length - 1].c + 4 : null);
      const d = durumAyristir(nk ? String(hv(row.getCell(nk)) || '') : '');
      const g = S.gun(t, true);
      g.kayitlar[p.id] = { seraId: sera.id, durum: d.durum, isler: isler.length ? isler : [{ is: '', toplam: p.toplamSira, kalan: 0 }], yerine: d.yerine, not: d.not };
      ist.kayit++;
    });
    return ist;
  }

  function hucreSayilari(v) {
    if (v === null || v === undefined) return [];
    if (typeof v === 'number') return [v];
    // Excel "6/6" gibi girişleri tarihe çevirmiş olabilir -> gün/ay
    if (v instanceof Date) return [v.getUTCDate(), v.getUTCMonth() + 1];
    return String(v)
      .split('/')
      .map((x) => (/^\s*yok\s*$/i.test(x) ? null : S.sayi(x)));
  }

  function hucreTarih(v) {
    if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return hucreTarih(d);
    }
    const m = String(v || '').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  }

  function aylikIceAktar(wb, seraId) {
    const ist = { sera: 0, personel: 0, kayit: 0, sayfa: 0 };
    wb.worksheets.forEach((ws) => {
      const a1 = String(hv(ws.getCell('A1')) || '');
      if (!/PERSONEL/i.test(a1)) return;
      ist.sayfa++;
      const ad = (a1.split(':')[1] || ws.name).trim() || ws.name;
      let sira = null;
      ws.eachRow((row) =>
        row.eachCell((c) => {
          const m = String(hv(c) || '').match(/SIRA SAYISI\s*:\s*(\d+(?:[.,]\d+)?)/i);
          if (m) sira = S.sayi(m[1]);
        })
      );
      let p = seraPersonelBul(ad, seraId);
      if (!p) {
        p = S.personelEkle({ ad, seraId, siraMetni: sira !== null ? S.sayiYaz(sira) : '', toplamSira: sira });
        ist.personel++;
      } else if (sira !== null && p.toplamSira === null) p.toplamSira = sira;

      ws.eachRow((row, rn) => {
        if (rn < 3) return;
        const t = hucreTarih(hv(row.getCell(1)));
        if (!t) return;
        const isMetni = hv(row.getCell(2));
        const c = hv(row.getCell(3));
        const d = hv(row.getCell(4));
        const e = hv(row.getCell(5));
        if (!isMetni && !e) return;
        if (isMetni && S.trLower(isMetni).includes('tatil') && c === null) {
          const g = S.gun(t, true);
          if (!g.tatil) g.tatil = String(isMetni);
          return;
        }
        const isler = String(isMetni || '')
          .split('/')
          .map((x) => x.trim())
          .filter(Boolean);
        const yap = hucreSayilari(c);
        const kal = hucreSayilari(d);
        const n = Math.max(isler.length, yap.length);
        const liste = [];
        for (let i = 0; i < n; i++) {
          const is = isler[i] || isler[isler.length - 1] || '';
          const y = yap[i] !== undefined ? yap[i] : null;
          const k = kal[i] !== undefined && kal[i] !== null ? kal[i] : 0;
          liste.push({ is: is ? isTuruEkle(is) : '', toplam: y !== null ? Math.round((y + k) * 100) / 100 : null, kalan: y !== null ? k : 0 });
        }
        const du = durumAyristir(e ? String(e) : '');
        const kayit = { seraId, durum: du.durum, isler: liste.length ? liste : [{ is: '', toplam: p.toplamSira, kalan: 0 }], yerine: du.yerine ? S.trUpper(du.yerine) : '', not: du.not };
        // İş sayısı ile sayı adedi uyuşmuyorsa orijinal metni koru (aylık raporda aynen yazılır)
        if (isler.length !== n) kayit.hamIs = String(isMetni);
        S.gun(t, true).kayitlar[p.id] = kayit;
        ist.kayit++;
      });
    });
    return ist;
  }

  async function oku(dosya) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await dosya.arrayBuffer());
    const ilk = wb.worksheets[0];
    const a1 = String(hv(ilk.getCell('A1')) || '');
    let tur = 'bilinmiyor';
    let tunelVar = false;
    for (let r = 1; r <= 12; r++) if (S.trUpper(String(hv(ilk.getCell(r, 1)) || '')).trim() === 'TÜNEL NO') tunelVar = true;
    if (tunelVar) tur = 'bitki';
    else if (/^PERSONELLER/i.test(a1)) tur = 'gunluk';
    else if (/^PERSONEL\s*:/i.test(a1)) tur = 'aylik';
    return { wb, tur };
  }

  // ---------- HASAT & İLAÇLAMA ----------
  function donemKayitlari(liste, yil, ay, seraId) {
    const on = `${yil}-${String(ay + 1).padStart(2, '0')}`;
    return S.d[liste].filter((x) => x.tarih.startsWith(on) && (!seraId || !x.seraId || x.seraId === seraId));
  }
  function seraAdi(id) {
    const s = id && S.sera(id);
    return s ? s.ad : 'TÜM SERALAR';
  }
  function tabloBasligi(ws, baslik, basliklar, genislikler) {
    genislikler.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.mergeCells(1, 1, 1, basliklar.length);
    const t = ws.getCell(1, 1);
    t.value = baslik;
    t.font = { bold: true, size: 14 };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;
    basliklar.forEach((v, i) => {
      const c = ws.getCell(2, i + 1);
      c.value = v;
      c.font = { bold: true, size: 10 };
      c.fill = dolgu(GRI);
      c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      c.border = KENAR;
    });
    ws.getRow(2).height = 42;
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  }
  function tarihHucre(c, t) {
    const [y, m, d] = t.split('-').map(Number);
    c.value = new Date(Date.UTC(y, m - 1, d));
    c.numFmt = 'dd.mm.yyyy';
  }
  function satirKenar(row, n) {
    for (let i = 1; i <= n; i++) {
      const c = row.getCell(i);
      c.border = KENAR;
      c.alignment = Object.assign({ vertical: 'middle', wrapText: true }, c.alignment || {});
    }
  }

  // Hasat miktarı hesaplama: kullanıcının "hasat miktarı hesaplama" düzeninde (kutu + palet), formüllü
  async function hasatTahminRaporu(yil, ay, seraId) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const kayitlar = donemKayitlari('tahminler', yil, ay, seraId).filter(S.tahminGecerli);
    const ws = wb.addWorksheet('HASAT MİKTARI', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const hesaplar = kayitlar.map((t) => ({ t, h: S.tahminHesapla(t) }));
    const maxSira = Math.max(2, ...hesaplar.map(({ h }) => Math.max(0, ...h.birimler.map((x) => x.sayimlar.length))));
    const L = (n) => ws.getColumn(n).letter;
    // Sütun düzeni
    const cSek = 1, cSira = 2, cSay = 3;
    const cOrt = cSay + maxSira; // 1. sınıf kalite salkım sayısı
    const cKutu = cOrt + 1; // kutu sayısı (sıra başı)
    const cTop = cKutu + 1; // toplam kutu
    const cPal = cTop + 1; // 6 palet sütunu
    const nSut = cPal + S.PALETLER.length - 1;
    [12, 11].concat(new Array(maxSira).fill(11), [16, 12, 14], S.PALETLER.map(() => 13)).forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.mergeCells(1, 1, 1, nSut);
    ws.getCell(1, 1).value = `HASAT MİKTARI HESAPLAMA – ${S.AYLAR[ay]} ${yil} – ${seraAdi(seraId)}`;
    ws.getCell(1, 1).font = { bold: true, size: 14 };
    let r = 3;
    const ozet = [];
    hesaplar.forEach(({ t, h }) => {
      // Blok başlığı
      ws.mergeCells(r, 1, r, nSut);
      const bb = ws.getCell(r, 1);
      bb.value = `${S.trTarih(t.tarih)} · ${seraAdi(t.seraId)}${t.not ? ' · ' + t.not : ''}`;
      bb.font = { bold: true, size: 12 };
      bb.fill = dolgu(GRI);
      bb.border = KENAR;
      r++;
      // Parametreler: kutudaki salkım = alt + üst; palet kapasiteleri
      const pr = r;
      ws.getCell(pr, 1).value = 'ALT KAT';
      ws.getCell(pr, 2).value = h.alt;
      ws.getCell(pr, 3).value = 'ÜST KAT';
      ws.getCell(pr, 4).value = h.ust;
      ws.getCell(pr, 5).value = 'KUTUDAKİ SALKIM';
      ws.getCell(pr, 6).value = { formula: `B${pr}+D${pr}`, result: h.kutuSalkim };
      const kutuRef = `$F$${pr}`;
      [1, 3, 5].forEach((c) => (ws.getCell(pr, c).font = { bold: true, size: 9 }));
      ws.getCell(pr, 6).font = { bold: true };
      ws.getCell(pr + 1, cPal - 1).value = 'PALET KUTU KAPASİTESİ →';
      ws.getCell(pr + 1, cPal - 1).font = { bold: true, size: 9 };
      ws.getCell(pr + 1, cPal - 1).alignment = { horizontal: 'right' };
      S.PALETLER.forEach((p, i) => {
        const c = ws.getCell(pr + 1, cPal + i);
        c.value = p.kutu;
        c.font = { bold: true, color: { argb: 'FF555555' } };
        c.alignment = { horizontal: 'center' };
        c.border = KENAR;
      });
      const kapRef = (i) => `${L(cPal + i)}$${pr + 1}`;
      r = pr + 2;
      const bas = ['SEKTÖR', 'SIRA SAYISI']
        .concat(Array.from({ length: maxSira }, (_, i) => `${i + 1}. SIRA SALKIM`), ['1. SINIF KALİTE SALKIM SAYISI', 'KUTU SAYISI', 'TOPLAM KUTU SAYISI'])
        .concat(S.PALETLER.map((p) => `${p.tur === 'EURO' ? 'EURO' : 'BÜYÜK'} PALET ${p.boy} BOY`));
      bas.forEach((v, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = v;
        c.font = { bold: true, size: 10 };
        c.fill = dolgu(GRI);
        c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
        c.border = KENAR;
      });
      ws.getRow(r).height = 32;
      r++;
      const ilk = r;
      h.birimler.forEach((x) => {
        const row = ws.getRow(r);
        row.getCell(cSek).value = 'sektör ' + x.no;
        row.getCell(cSira).value = x.sira;
        for (let i = 0; i < maxSira; i++) row.getCell(cSay + i).value = x.sayimlar[i] !== undefined ? x.sayimlar[i] : null;
        row.getCell(cOrt).value = { formula: `AVERAGE(${L(cSay)}${r}:${L(cSay + maxSira - 1)}${r})`, result: x.ort };
        row.getCell(cKutu).value = { formula: `${L(cOrt)}${r}/${kutuRef}`, result: x.ort / h.kutuSalkim };
        row.getCell(cTop).value = { formula: `${L(cSira)}${r}*${L(cKutu)}${r}`, result: x.toplamKutu };
        S.PALETLER.forEach((p, i) => (row.getCell(cPal + i).value = { formula: `${L(cTop)}${r}/${kapRef(i)}`, result: x.paletler[i] }));
        satirKenar(row, nSut);
        for (let c = 2; c <= nSut; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        [cOrt, cKutu].forEach((c) => (row.getCell(c).numFmt = '0.00'));
        row.getCell(cTop).numFmt = '#,##0';
        row.getCell(cTop).font = { bold: true };
        S.PALETLER.forEach((_, i) => (row.getCell(cPal + i).numFmt = '0.0'));
        ozet.push({ tarih: t.tarih, sera: seraAdi(t.seraId), no: x.no, kutu: x.toplamKutu });
        r++;
      });
      const son = r - 1;
      const top = ws.getRow(r);
      top.getCell(cSek).value = 'toplam';
      top.getCell(cSira).value = { formula: `SUM(${L(cSira)}${ilk}:${L(cSira)}${son})`, result: h.toplamSira };
      top.getCell(cTop).value = { formula: `SUM(${L(cTop)}${ilk}:${L(cTop)}${son})`, result: h.toplamKutu };
      S.PALETLER.forEach((p, i) => (top.getCell(cPal + i).value = { formula: `${L(cTop)}${r}/${kapRef(i)}`, result: h.paletler[i] }));
      for (let c = 1; c <= nSut; c++) {
        const cell = top.getCell(c);
        cell.font = { bold: true };
        cell.fill = dolgu(MAVI);
        cell.border = KENAR;
        if (c > 1) cell.alignment = { horizontal: 'center' };
      }
      top.getCell(cTop).numFmt = '#,##0';
      S.PALETLER.forEach((_, i) => (top.getCell(cPal + i).numFmt = '0.0'));
      r += 3;
    });
    if (!hesaplar.length) ws.getCell(3, 1).value = 'Bu dönemde hasat tahmini yok.';
    ws.getCell(r, 1).value = 'Kutu sayısı = 1. sınıf salkım ÷ kutudaki salkım (alt + üst kat). Toplam kutu = sıra sayısı × kutu sayısı. Palet = toplam kutu ÷ palet kapasitesi. Sıra sayısı güncel bitki sayımından alınır.';
    ws.getCell(r, 1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };

    // ÖZET: tarih × sektör (toplam kutu)
    const wo = wb.addWorksheet('ÖZET');
    const satirlar = Array.from(new Set(ozet.map((x) => x.tarih + '|' + x.sera)));
    const nolar = Array.from(new Set(ozet.map((x) => x.no))).sort((a, b) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99));
    const ob = ['TARİH', 'SERA'].concat(nolar.map((n) => 'SEKTÖR ' + n), ['TOPLAM KUTU', 'EURO PALET 13 BOY']);
    tabloBasligi(wo, `HASAT MİKTARI ÖZETİ (TOPLAM KUTU) – ${S.AYLAR[ay]} ${yil}`, ob, [12, 10].concat(nolar.map(() => 11), [13, 13]));
    satirlar.forEach((k, i) => {
      const [t, sera] = k.split('|');
      const rr = 3 + i;
      const row = wo.getRow(rr);
      tarihHucre(row.getCell(1), t);
      row.getCell(2).value = sera;
      nolar.forEach((n, j) => {
        const x = ozet.find((o) => o.tarih === t && o.sera === sera && o.no === n);
        row.getCell(3 + j).value = x ? Math.round(x.kutu) : null;
      });
      const lc = wo.getColumn(2 + nolar.length).letter;
      const tc = 3 + nolar.length;
      row.getCell(tc).value = { formula: `SUM(C${rr}:${lc}${rr})` };
      row.getCell(tc).font = { bold: true };
      row.getCell(tc + 1).value = { formula: `${wo.getColumn(tc).letter}${rr}/104` };
      row.getCell(tc + 1).numFmt = '0.0';
      satirKenar(row, ob.length);
      for (let c = 1; c <= ob.length; c++) row.getCell(c).alignment = { horizontal: 'center' };
    });
    return wb;
  }

  // ---------- DRENAJ ÖLÇÜM FORMU (ara ölçüm + gün sonu) ----------
  const DRENAJ_SATIR = [
    ['drip', (o) => 'İstasyonda ki drip sayısı', null],
    ['dripSu', (o) => (o === 'ara' ? 'Ara ölçümde drip başına ölçülen su miktarı:' : 'Gün sonunda drip başına ölçülen su miktarı:'), null],
    ['drenSu', (o) => (o === 'ara' ? 'Ara ölçümde drene edilen su miktarı:' : 'Gün sonunda drene edilen su miktarı:'), null],
    ['oran', (o) => (o === 'ara' ? 'Ara ölçümdeki drenaj oranı:' : 'Gün sonundaki drenaj oranı:'), '0%'],
    ['drenEc', (o) => (o === 'ara' ? 'Ara ölçümdeki drenaj EC:' : 'Gün sonundaki drenaj EC:'), '0.00'],
    ['drenPh', (o) => (o === 'ara' ? 'Ara ölçümdeki drenaj pH:' : 'Gün sonundaki drenaj pH:'), '0.00'],
    ['dripEc', (o) => (o === 'ara' ? 'Ara ölçümdeki drip EC:' : 'Gün sonundaki drip EC:'), '0.00'],
    ['dripPh', (o) => (o === 'ara' ? 'Ara ölçümdeki drip pH:' : 'Gün sonundaki drip pH:'), '0.00'],
  ];
  function drenajSayfasi(wb, tarih, ad, turler = ['ara', 'gunsonu']) {
    const ws = wb.addWorksheet(ad, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
    const vs = S.d.ayarlar.vanaSayisi || 10;
    const ortKol = vs + 2;
    ws.getColumn(1).width = 44;
    for (let i = 2; i <= vs + 1; i++) ws.getColumn(i).width = 10;
    ws.getColumn(ortKol).width = 12;
    const L = (n) => ws.getColumn(n).letter;
    ws.getCell(1, 1).value = 'Tarih:' + S.trTarih(tarih);
    ws.getCell(1, 1).font = { bold: true, size: 11 };
    for (let v = 1; v <= vs; v++) {
      const c = ws.getCell(1, v + 1);
      c.value = 'Vana ' + v;
      c.font = { bold: true, size: 13 };
      c.alignment = { horizontal: 'center' };
    }
    ws.getCell(1, ortKol).value = 'ORTALAMA';
    ws.getCell(1, ortKol).font = { bold: true, size: 11 };
    let r = 2;
    turler.forEach((tur) => {
      const k = S.drenajBul(tarih, tur);
      ws.mergeCells(r, 1, r, ortKol);
      const bb = ws.getCell(r, 1);
      bb.value = (tur === 'ara' ? 'ARA ÖLÇÜM' : 'GÜN SONU') + (k && k.saat ? ' – saat ' + k.saat : '') + (k ? '' : ' – ölçüm girilmedi');
      bb.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      bb.fill = dolgu(tur === 'ara' ? 'FF1C7ED6' : 'FF2F9E44');
      r++;
      const satirNo = {};
      DRENAJ_SATIR.forEach(([alan, etiket, fmt]) => {
        satirNo[alan] = r;
        const row = ws.getRow(r);
        row.getCell(1).value = etiket(tur);
        for (let v = 1; v <= vs; v++) {
          const c = row.getCell(v + 1);
          const val = k && k.vanalar[v] ? k.vanalar[v][alan] : undefined;
          if (alan === 'oran') {
            const o = k && k.vanalar[v] ? S.drenajOrani(k.vanalar[v]) : null;
            c.value = { formula: `IFERROR(${L(v + 1)}${satirNo.drenSu}/${L(v + 1)}${satirNo.dripSu}/${L(v + 1)}${satirNo.drip},"")`, result: o === null ? '' : o };
          } else c.value = val === undefined || val === null ? null : val;
          if (fmt) c.numFmt = fmt;
          c.alignment = { horizontal: 'center' };
        }
        const oc = row.getCell(ortKol);
        oc.value = { formula: `IFERROR(AVERAGE(${L(2)}${r}:${L(vs + 1)}${r}),"")` };
        oc.numFmt = fmt || '0';
        oc.font = { bold: true };
        oc.alignment = { horizontal: 'center' };
        if (alan === 'oran') for (let c = 1; c <= ortKol; c++) row.getCell(c).font = { bold: true };
        for (let c = 1; c <= ortKol; c++) row.getCell(c).border = KENAR;
        r++;
      });
      if (k && k.not) {
        ws.getCell(r, 1).value = 'Not: ' + k.not;
        ws.getCell(r, 1).font = { italic: true, size: 9 };
        r++;
      }
      r++;
    });
    return ws;
  }
  // Günlük dosya tek ölçümü içerir (ara ölçüm ve gün sonu ekibe ayrı gönderilir); birleşik görünüm sadece aylıkta
  async function drenajRaporu(tarih, tur) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    drenajSayfasi(wb, tarih, 'Sayfa1', tur ? [tur] : undefined);
    return wb;
  }
  async function drenajAylik(yil, ay) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const on = `${yil}-${String(ay + 1).padStart(2, '0')}`;
    const gunler = Array.from(new Set(S.d.drenajlar.filter((x) => x.tarih.startsWith(on)).map((x) => x.tarih))).sort();
    const vs = S.d.ayarlar.vanaSayisi || 10;
    const wo = wb.addWorksheet('ÖZET');
    const ob = ['TARİH', 'ÖLÇÜM'].concat(Array.from({ length: vs }, (_, i) => 'VANA ' + (i + 1)), ['ORT. DRENAJ', 'ORT. DRENAJ EC', 'ORT. DRENAJ pH', 'ORT. DRIP EC', 'ORT. DRIP pH']);
    tabloBasligi(wo, `DRENAJ ORANLARI – ${S.AYLAR[ay]} ${yil}`, ob, [12, 11].concat(new Array(vs).fill(9), [12, 13, 13, 12, 12]));
    let r = 3;
    gunler.forEach((t) => {
      ['ara', 'gunsonu'].forEach((tur) => {
        const k = S.drenajBul(t, tur);
        if (!k) return;
        const row = wo.getRow(r);
        tarihHucre(row.getCell(1), t);
        row.getCell(2).value = S.DRENAJ_TURLERI[tur];
        for (let v = 1; v <= vs; v++) {
          const o = k.vanalar[v] ? S.drenajOrani(k.vanalar[v]) : null;
          row.getCell(2 + v).value = o;
          row.getCell(2 + v).numFmt = '0%';
        }
        const oz = S.drenajOzet(k);
        [oz.oran, oz.drenEc, oz.drenPh, oz.dripEc, oz.dripPh].forEach((x, i) => {
          const c = row.getCell(3 + vs + i);
          c.value = x === null ? null : Math.round(x * 1000) / 1000;
          c.numFmt = i ? '0.00' : '0%';
          c.font = { bold: true };
        });
        satirKenar(row, ob.length);
        for (let c = 1; c <= ob.length; c++) row.getCell(c).alignment = { horizontal: 'center' };
        r++;
      });
    });
    if (!gunler.length) wo.getCell(3, 1).value = 'Bu ay drenaj ölçümü yok.';
    gunler.forEach((t) => drenajSayfasi(wb, t, S.trTarih(t)));
    return wb;
  }

  async function ilaclamaRaporu(yil, ay, seraId) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const ws = wb.addWorksheet('İLAÇLAMA KAYITLARI', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const bas = ['TARİH', 'SERA', 'İLAÇ (TİCARİ ADI)', 'ETKEN MADDE', 'HEDEF ZARARLI / HASTALIK', 'UYGULAMA ŞEKLİ', 'DOZ', 'SU MİKTARI (L)', 'KULLANILAN İLAÇ MİKTARI', 'UYGULAYAN', 'BEKLEME SÜRESİ (GÜN)', 'HASAT İÇİN UYGUN TARİH', 'NOT'];
    tabloBasligi(ws, `İLAÇLAMA KAYIT DEFTERİ – ${S.AYLAR[ay]} ${yil} – ${seraAdi(seraId)}`, bas, [12, 13, 20, 20, 22, 14, 14, 10, 13, 18, 10, 13, 26]);
    donemKayitlari('ilaclamalar', yil, ay, seraId).forEach((il, i) => {
      const row = ws.getRow(3 + i);
      tarihHucre(row.getCell(1), il.tarih);
      const vals = [null, seraAdi(il.seraId), il.ilac, il.etken, il.hedef, il.uygulama, il.doz, S.sayi(il.su), il.miktar, il.uygulayan, S.sayi(il.bekleme)];
      vals.forEach((v, j) => {
        if (j) row.getCell(j + 1).value = v === '' || v === undefined ? null : v;
      });
      if (S.sayi(il.bekleme)) tarihHucre(row.getCell(12), S.uygunTarih(il));
      row.getCell(13).value = il.not || null;
      [1, 8, 11, 12].forEach((c) => (row.getCell(c).alignment = { horizontal: 'center' }));
      satirKenar(row, bas.length);
    });
    return wb;
  }

  // ---------- BİTKİ SAYIMI (kişi yerleşimi: tünel / gutter) ----------
  function kisiBaslik(metin, sera) {
    // "ELİFE EMREN-1-3.SEKTÖR", "FATMA YILDIZ-1-10.SEKTÖR" (ad: FATMA YILDIZ - 1 -), "SANİYE TANRIKULU -4.SEKTÖR"
    const u = S.trUpper(metin).trim();
    const m = u.match(/^(.*?)[\s\-–]+([\d\s\-–,]+?)\.?\s*SEKT[ÖO]R/);
    if (!m) return { ad: u, sektorler: [], kisi: seraPersonelBul(u, sera.id) };
    const temel = m[1].replace(/[\s\-–.]+$/, '');
    const nolar = (m[2].match(/\d+/g) || []).map(Number);
    let p = seraPersonelBul(temel, sera.id);
    let ad = temel;
    let i = 0;
    // Ad sonundaki numara (FATMA YILDIZ - 1 -) sektör sanılmasın
    while (!p && i < nolar.length - 1) {
      i++;
      const aday = temel + ' - ' + nolar.slice(0, i).join(' - ') + ' -';
      const bul = seraPersonelBul(aday, sera.id);
      if (bul) {
        p = bul;
        ad = aday;
        nolar.splice(0, i);
        break;
      }
    }
    return { ad, sektorler: nolar, kisi: p };
  }

  function bitkiIceAktar(ws, bugunTarih) {
    let sera = null;
    let kisi = null;
    let sektorNolar = [];
    let tarih = null;
    const ist = { kisi: 0, yeniKisi: 0, gutter: 0, bitki: 0, tarih: null, cakisma: [], kayip: [] };
    const yeniYer = {};
    const sayim = {};
    // Birleştirilmiş başlık hücrelerinde ExcelJS ana hücrenin değerini tekrarlar; onları boş say
    const hvTek = (c) => (c.isMerged && c.master && c.master.address !== c.address ? null : hv(c));
    ws.eachRow((row) => {
      const a = hvTek(row.getCell(1));
      const b = hvTek(row.getCell(2));
      const c = hvTek(row.getCell(3));
      const aU = S.trUpper(String(a === null ? '' : a)).trim();
      if (/^SERA\s*\d+$/.test(aU) && b === null) {
        sera = S.seraBulAd(aU) || S.seraEkle(aU);
        kisi = null;
        return;
      }
      if (aU === 'TÜNEL NO') {
        const m = String(c || '').match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
        if (m) tarih = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        return;
      }
      if (!sera || !aU || aU.startsWith('TOPLAM') || aU.startsWith('BİTKİ KAYB')) return;
      if (b === null && c === null) {
        const k = kisiBaslik(aU, sera);
        kisi = k.kisi;
        if (!kisi) {
          kisi = S.personelEkle({ ad: k.ad, seraId: sera.id, siraMetni: '', toplamSira: null });
          ist.yeniKisi++;
        }
        sektorNolar = k.sektorler;
        yeniYer[kisi.id] = [];
        ist.kisi++;
        return;
      }
      if (!kisi) return;
      const gutter = S.sayi(b);
      if (gutter === null) return;
      const tunel = String(a).trim();
      const mm = S.trUpper(tunel).match(/^(\d+)\s*-\s*([A-Z])(?![A-Z])\s*(.*)$/);
      let harf, seraId, etiket;
      if (mm) {
        harf = mm[2];
        seraId = sera.id;
        etiket = mm[3].trim();
      } else {
        // Harfsiz satır (ör. CHERRY): başlıktaki sektörden bul
        const no = sektorNolar.find((n) => S.SEKTOR_HARF[n]);
        const e = no ? S.SEKTOR_HARF[no] : null;
        const s2 = e && (S.seraBulAd(e[0]) || S.seraEkle(e[0]));
        harf = e ? e[1] : '?';
        seraId = s2 ? s2.id : sera.id;
        etiket = S.trUpper(tunel);
      }
      yeniYer[kisi.id].push({ seraId, harf, gutter, tunel, etiket });
      ist.gutter++;
      const bitki = typeof c === 'number' ? c : S.sayi(c);
      if (bitki !== null) {
        const sy = (sayim[seraId] = sayim[seraId] || { sayilar: {}, kisi: {} });
        const key = harf + gutter;
        sy.sayilar[key] = (sy.sayilar[key] || 0) + bitki; // yarım sıralarda iki kişinin payı toplanır
        const km = (sy.kisi[kisi.id] = sy.kisi[kisi.id] || {});
        km[key] = (km[key] || 0) + bitki; // aynı kişi aynı gutter'ı iki kez yazdıysa toplanır
        ist.bitki += bitki;
      }
    });
    tarih = tarih || bugunTarih;
    ist.tarih = tarih;
    // Önceki toplamlar (kayıp hesabı için)
    const onceKisi = {};
    Object.keys(yeniYer).forEach((pid) => (onceKisi[pid] = S.kisiBitki(pid).son));
    // Önceki elle girilmiş taraf bilgisini koru
    Object.entries(yeniYer).forEach(([pid, l]) => {
      const eski = S.d.yerlesim[pid] || [];
      l.forEach((g) => {
        const e = eski.find((x) => x.seraId === g.seraId && x.harf === g.harf && x.gutter === g.gutter);
        if (e && e.taraf) g.taraf = e.taraf;
      });
    });
    Object.entries(yeniYer).forEach(([pid, l]) => {
      S.d.yerlesim[pid] = l;
      const p = S.kisi(pid);
      if (p && (p.toplamSira === null || p.toplamSira === undefined)) p.toplamSira = l.length;
    });
    Object.entries(sayim).forEach(([seraId, sy]) => {
      const varolan = S.d.bitkiSayimlari.find((x) => x.seraId === seraId && x.tarih === tarih);
      if (varolan) {
        Object.assign(varolan.sayilar, sy.sayilar);
        varolan.kisi = Object.assign(varolan.kisi || {}, sy.kisi);
      } else S.d.bitkiSayimlari.push({ id: S.uid(), tarih, seraId, sayilar: sy.sayilar, kisi: sy.kisi });
    });
    S.sektorleriHazirla();
    // Kayıp: içe aktarmadan önceki son sayıma göre
    Object.keys(yeniYer).forEach((pid) => {
      const once = onceKisi[pid];
      const simdi = S.kisiBitki(pid).son;
      if (once !== null && simdi !== null && once !== simdi && S.kisi(pid)) ist.kayip.push({ p: S.kisi(pid), fark: simdi - once });
    });
    ist.kayip.sort((x, y) => x.fark - y.fark);
    // Aynı gutter'da iki kişi: taraf girilmemişse dosyadaki sıraya göre sol / sağ yaz
    const ikili = {};
    Object.entries(yeniYer).forEach(([pid, l]) => l.forEach((g) => (ikili[g.seraId + '|' + g.harf + g.gutter] = (ikili[g.seraId + '|' + g.harf + g.gutter] || []).concat(g))));
    Object.values(ikili).forEach((l) => {
      if (l.length === 2 && !l[0].taraf && !l[1].taraf) {
        l[0].taraf = 'sol';
        l[1].taraf = 'sag';
      }
    });
    // Aynı gutter'ı birden fazla kişi kullanıyor mu?
    const sahip = {};
    Object.entries(S.d.yerlesim).forEach(([pid, l]) =>
      l.forEach((g) => {
        const k = g.seraId + '|' + g.harf + g.gutter;
        (sahip[k] = sahip[k] || new Set()).add(pid);
      })
    );
    Object.entries(sahip).forEach(([k, set]) => {
      if (set.size > 1) {
        const [sid, g] = k.split('|');
        ist.cakisma.push(`${(S.sera(sid) || {}).ad} ${g}: ${Array.from(set).map((id) => (S.kisi(id) || {}).ad.split(' ')[0]).join(' + ')}`);
      }
    });
    return ist;
  }

  async function bitkiRaporu() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const ws = wb.addWorksheet('BİTKİ SAYISI', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const tarihler = Array.from(new Set(S.d.bitkiSayimlari.map((x) => x.tarih))).sort().slice(-4);
    const tk = (t) => t.slice(8, 10) + '.' + t.slice(5, 7) + '.' + t.slice(2, 4);
    const nSut = 2 + tarihler.length + (tarihler.length > 1 ? 1 : 0);
    const karKol = nSut + 1;
    [26, 12].concat(tarihler.map(() => 18), tarihler.length > 1 ? [12] : [], [14]).forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const L = (n) => ws.getColumn(n).letter;
    let r = 1;
    const kisiToplamSatirlari = [];
    const yaz = (row, vals, stil) =>
      vals.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v;
        c.border = KENAR;
        c.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle' };
        if (stil) Object.assign(c, stil);
      });
    S.d.seralar.forEach((sera) => {
      const kisiler = Object.keys(S.d.yerlesim)
        .map((pid) => S.kisi(pid))
        .filter((p) => p && p.seraId === sera.id && S.d.yerlesim[p.id].length);
      if (!kisiler.length) return;
      ws.mergeCells(r, 1, r, karKol);
      const sb = ws.getCell(r, 1);
      sb.value = sera.ad;
      sb.font = { bold: true, size: 14 };
      sb.alignment = { horizontal: 'center' };
      r += 2;
      kisiler.forEach((p) => {
        const l = S.d.yerlesim[p.id];
        const nolar = Array.from(new Set(l.map((g) => S.sektorAdi(g.seraId, g.harf).replace('Sektör ', ''))));
        ws.mergeCells(r, 1, r, karKol);
        const kb = ws.getCell(r, 1);
        kb.value = `${p.ad}-${nolar.join('-')}.SEKTÖR`;
        kb.font = { bold: true, size: 12 };
        kb.fill = dolgu(GRI);
        kb.border = KENAR;
        r++;
        yaz(ws.getRow(r), ['TÜNEL NO', 'GUTTER NO'].concat(tarihler.map((t) => tk(t) + ' BİTKİ SAYISI'), tarihler.length > 1 ? ['FARK'] : [], ['KARANTİNA']), { font: { bold: true } });
        r++;
        const ilk = r;
        l.forEach((g) => {
          const vals = [g.tunel + (g.taraf ? (g.taraf === 'sol' ? ' (SOL)' : ' (SAĞ)') : ''), g.gutter].concat(
            tarihler.map((t) => {
              const sy = S.d.bitkiSayimlari.find((x) => x.seraId === g.seraId && x.tarih === t);
              return S.kisiGutterBitki(sy, p.id, g.harf, g.gutter);
            })
          );
          if (tarihler.length > 1) vals.push({ formula: `${L(nSut - 1)}${r}-${L(nSut - 2)}${r}` });
          const kar = S.karantinaMi(g.seraId, g.harf, g.gutter);
          vals.push(kar ? 'KARANTİNA' : null);
          yaz(ws.getRow(r), vals);
          if (kar)
            for (let c = 1; c <= karKol; c++) {
              ws.getCell(r, c).fill = dolgu('FFFFD8D8');
              if (c === karKol) ws.getCell(r, c).font = { bold: true, color: { argb: 'FFB3261E' } };
            }
          r++;
        });
        const son = r - 1;
        const tv = ['TOPLAM SIRA-BİTKİ SAYISI', l.length].concat(tarihler.map((_, j) => ({ formula: `SUM(${L(3 + j)}${ilk}:${L(3 + j)}${son})` })));
        if (tarihler.length > 1) tv.push({ formula: `SUM(${L(nSut)}${ilk}:${L(nSut)}${son})` });
        tv.push(null);
        yaz(ws.getRow(r), tv, { font: { bold: true }, fill: dolgu(MAVI) });
        kisiToplamSatirlari.push(r);
        r += 2;
      });
    });
    const genel = ws.getRow(r);
    yaz(genel, ['TOPLAM BİTKİ SAYISI', ''].concat(tarihler.map((_, j) => ({ formula: kisiToplamSatirlari.length ? kisiToplamSatirlari.map((x) => L(3 + j) + x).join('+') : '0' }))), { font: { bold: true, size: 12 } });
    if (tarihler.length > 1) {
      const kr = ws.getRow(r + 1);
      yaz(kr, ['BİTKİ KAYBI (' + tk(tarihler[tarihler.length - 2]) + ' → ' + tk(tarihler[tarihler.length - 1]) + ')', '', { formula: `${L(nSut - 2)}${r}-${L(nSut - 1)}${r}` }], { font: { bold: true, color: { argb: 'FFB3261E' } } });
    }
    // Karantina listesi
    const kl = S.karantinaListesi();
    const wk = wb.addWorksheet('KARANTİNA SIRALARI');
    const kb = ['SERA', 'SEKTÖR', 'TÜNEL NO', 'GUTTER NO', 'KİŞİ', 'TARİH', 'NOT'];
    tabloBasligi(wk, 'KARANTİNA SIRALARI', kb, [12, 12, 12, 11, 34, 13, 30]);
    kl.forEach((k, i) => {
      const row = wk.getRow(3 + i);
      [(S.sera(k.seraId) || {}).ad, S.sektorAdi(k.seraId, k.harf).replace('Sektör ', ''), S.tunelTahmin(k.seraId, k.harf, k.no), k.no, k.kisiler.map((p) => p.ad).join(', '), null, k.not || null].forEach((v, j) => (row.getCell(j + 1).value = v));
      tarihHucre(row.getCell(6), k.tarih);
      satirKenar(row, kb.length);
    });
    if (!kl.length) wk.getCell(3, 1).value = 'Karantina sırası yok.';
    return wb;
  }

  // ---------- HASAT / YAPRAK PLANI ----------
  async function planRaporu(p) {
    const s = p.sonuc;
    const isAd = p.is === 'YAPRAK' ? 'YAPRAK' : 'HASAT';
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const ws = wb.addWorksheet('PLAN', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const b1 = ['GELMEYEN', 'SERA', 'SIRA', 'SIRALARI', 'YERİNE GİDEN', 'SIRA', 'GİDECEĞİ SIRALAR'];
    tabloBasligi(ws, `${isAd} PLANI – ${S.trTarih(p.tarih)} ${S.trUpper(S.GUNLER[S.strTarih(p.tarih).getDay()])}`, b1, [22, 9, 7, 34, 22, 7, 40]);
    let r = 3;
    s.gelmeyenler.forEach((g) => {
      const ilk = r;
      (g.dagilim.length ? g.dagilim : [{ ad: '', sira: null, yer: '' }]).forEach((d) => {
        const row = ws.getRow(r);
        [g.ad, seraAdi(g.seraId), g.sira, g.yer, d.ad, d.sira, d.yer].forEach((v, j) => (row.getCell(j + 1).value = v));
        satirKenar(row, b1.length);
        r++;
      });
      if (r - 1 > ilk) [1, 2, 3, 4].forEach((c) => ws.mergeCells(ilk, c, r - 1, c));
      ws.getCell(ilk, 1).font = { bold: true };
    });
    if (!s.gelmeyenler.length) ws.getCell(r++, 1).value = 'Gelmeyecek yok – herkes kendi yerinde.';
    const top = ws.getRow(r);
    top.getCell(1).value = 'TOPLAM EKSİK';
    top.getCell(3).value = r > 3 ? { formula: `SUM(C3:C${r - 1})`, result: s.eksikSira } : 0;
    top.getCell(6).value = r > 3 ? { formula: `SUM(F3:F${r - 1})`, result: s.eksikSira - s.karsilanmayan } : 0;
    top.font = { bold: true };
    satirKenar(top, b1.length);
    r += 2;
    // Kişi başı görev listesi
    const b2 = ['KİŞİ', 'GÖREV', 'EK SIRA', 'ÖNCE (GELMEYENİN SIRALARI)', 'KİMİN YERİNE', 'SONRA', 'NOT'];
    b2.forEach((v, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = v;
      c.font = { bold: true, size: 10 };
      c.fill = dolgu(GRI);
      c.border = KENAR;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    r++;
    const gorev = { normal: 'Sıra sahibi', joker: 'Joker', yatirma: 'Yatırmacı' };
    s.yardimcilar
      .filter((h) => h.ek > 0)
      .forEach((h) => {
        const row = ws.getRow(r++);
        const not = [h.karantina ? 'Karantina ' + h.karantina + ' en son yapılır' : '', h.tip === 'yatirma' ? `Yatırma ${S.sayiYaz(h.saat)} saat, yardım ≈${S.sayiYaz(h.yardimSaat)} saat` : ''].filter(Boolean).join(' · ');
        [h.ad, gorev[h.tip], h.ek, h.yer, h.kimin.join(', '), h.tip === 'normal' ? 'Kendi yeri: ' + h.kendi : '', not || null].forEach((v, j) => (row.getCell(j + 1).value = v));
        satirKenar(row, b2.length);
      });
    const bos = s.yardimcilar.filter((h) => h.ek === 0 && h.tip === 'normal');
    if (bos.length) {
      ws.mergeCells(r, 1, r, b2.length);
      ws.getCell(r, 1).value = 'Sadece kendi yerinde: ' + bos.map((h) => h.ad).join(', ');
      ws.getCell(r, 1).alignment = { wrapText: true };
      ws.getRow(r).height = 30;
      r++;
    }
    if (s.cherry) ws.getCell(r++, 1).value = 'Cherry sona bırakılır: ' + s.cherry;
    if (s.karsilanmayan) ws.getCell(r++, 1).value = `⚠ ${S.sayiYaz(s.karsilanmayan)} sıra karşılanamadı`;
    if (p.not) ws.getCell(r++, 1).value = 'Not: ' + p.not;
    return wb;
  }

  window.Rapor = {
    planRaporu,
    drenajRaporu,
    drenajAylik,
    bitkiIceAktar,
    bitkiRaporu,
    hasatTahminRaporu,
    ilaclamaRaporu,
    donemKayitlari,
    seraAdi,
    gunlukRapor,
    aylikRapor,
    blob,
    ozet,
    ayGunleri,
    adliIsler,
    oku,
    gunlukIceAktar,
    aylikIceAktar,
  };
})();
