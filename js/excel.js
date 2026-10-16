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
    const notKol = 3 + isSayisi * 4; // 2 iş için K (11)

    // Sütun genişlikleri (orijinal dosyadan)
    ws.getColumn(1).width = 18.78;
    ws.getColumn(2).width = 15.11;
    for (let j = 0; j < isSayisi; j++) {
      const b = 3 + j * 4;
      ws.getColumn(b).width = j === 0 ? 9.66 : 16.89;
      ws.getColumn(b + 1).width = 10.11;
      ws.getColumn(b + 2).width = 10.11;
      ws.getColumn(b + 3).width = j === 0 ? 5 : 0.11;
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
    seralar.forEach((s, si) => {
      // Başlık
      const basliklar = [s.ad, 'TOPLAM SIRA SAYISI'];
      for (let j = 0; j < isSayisi; j++) basliklar.push('YAPILAN İŞ', 'YAPILAN SIRA SAYISI', 'KALAN SIRA SAYISI', '');
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

      gunPersoneli(t, s.id).forEach((p) => {
        const k = g && g.kayitlar[p.id];
        const isler = adliIsler(k);
        const row = ws.getRow(r);
        row.getCell(1).value = p.ad;
        row.getCell(2).value = p.siraMetni || (p.toplamSira !== null ? S.sayiYaz(p.toplamSira) : null);
        for (let j = 0; j < isSayisi; j++) {
          const b = 3 + j * 4;
          const x = isler[j];
          if (x) {
            const top = S.sayi(x.toplam);
            const kal = S.sayi(x.kalan) || 0;
            row.getCell(b).value = S.trUpper(x.is);
            const L = (n) => ws.getColumn(n).letter;
            row.getCell(b + 1).value =
              top !== null ? { formula: `${L(b + 3)}${r}-${L(b + 2)}${r}`, result: S.yapilan(x) } : null;
            row.getCell(b + 2).value = kal;
            row.getCell(b + 3).value = top;
            isGenislik[j] = Math.max(isGenislik[j], S.trUpper(x.is).length);
          }
          if (j === 0) row.getCell(b).fill = dolgu(MAVI);
          row.getCell(b + 1).alignment = { horizontal: 'center' };
          row.getCell(b + 2).alignment = { horizontal: 'center' };
        }
        row.getCell(notKol).value = notMetni(k) || null;
        for (let i = 1; i <= notKol; i++) {
          const c = row.getCell(i);
          c.border = KENAR;
          if (!c.font || !c.font.size) c.font = { size: 11 };
        }
        r++;
      });
    });
    // İş adı sütunlarını içeriğe göre genişlet
    isGenislik.forEach((len, j) => {
      const col = ws.getColumn(3 + j * 4);
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
        row.eachCell((c, cn) => {
          const v = S.trUpper(hv(c) || '');
          if (v === 'YAPILAN İŞ') isKol.push(cn);
          if (v.startsWith('GELMEYENLER')) notKol = cn;
        });
        return;
      }
      if (!sera || !a) return;
      const ad = String(a);
      const siraMetni = b !== null ? String(b) : '';
      const ilkTop = isKol.length ? S.sayi(hv(row.getCell(isKol[0] + 3))) : null;
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
      isKol.forEach((c) => {
        const is = hv(row.getCell(c));
        if (!is) return;
        const yap = S.sayi(hv(row.getCell(c + 1)));
        const kal = S.sayi(hv(row.getCell(c + 2)));
        let top = S.sayi(hv(row.getCell(c + 3)));
        if (top === null && yap !== null) top = yap + (kal || 0);
        if (top === null) top = p.toplamSira;
        isler.push({ is: isTuruEkle(is), toplam: top, kalan: kal || 0 });
      });
      const nk = notKol || (isKol.length ? isKol[isKol.length - 1] + 4 : null);
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
    if (/^PERSONELLER/i.test(a1)) tur = 'gunluk';
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

  async function hasatTahminRaporu(yil, ay, seraId) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sera Otomasyon';
    const kayitlar = donemKayitlari('tahminler', yil, ay, seraId);
    const ws = wb.addWorksheet('HASAT TAHMİNİ', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const hes = kayitlar.map((t) => ({ t, h: S.tahminHesapla(t) }));
    const ustler = Array.from(new Set([].concat(...hes.map((x) => x.h.dizilimler.map((d) => d.ust))).concat(kayitlar.length ? [] : S.UST_KATLAR))).sort((a, b) => a - b);
    const alt = hes.length ? hes[0].h.alt : 6;
    const ek = (n) => (n === 9 || n === 10 || n === 6 ? (n === 6 ? 'LI' : 'LU') : n === 7 || n === 8 || n === 11 || n === 12 ? 'Lİ' : 'LIK');
    const bas = ['TARİH', 'SERA', 'SAYIM BİRİMİ', 'ÖRNEK SAYIMLAR', 'ORT. MEYVE', 'SIRA SAYISI', 'BİTKİ / SIRA', 'FİRE %', 'TOPLAM MEYVE (TAHMİNİ)']
      .concat(ustler.map((u) => `ALT ${alt} + ÜST ${u} = ${alt + u}'${ek(alt + u)} KUTU`))
      .concat(['ORTALAMA KUTU', 'NOT']);
    tabloBasligi(ws, `HASAT TAHMİNİ – ${S.AYLAR[ay]} ${yil} – ${seraAdi(seraId)}`, bas, [12, 12, 10, 24, 10, 9, 9, 8, 14].concat(ustler.map(() => 14), [13, 24]));
    const L = (n) => ws.getColumn(n).letter;
    const kutuIlk = 10;
    const ortKol = kutuIlk + ustler.length;
    hes.forEach(({ t, h }, i) => {
      const r = 3 + i;
      const row = ws.getRow(r);
      tarihHucre(row.getCell(1), t.tarih);
      row.getCell(2).value = seraAdi(t.seraId);
      row.getCell(3).value = t.birim === 'sira' ? 'SIRA' : 'BİTKİ';
      row.getCell(4).value = (t.sayimlar || []).map((n) => S.sayiYaz(n)).join(' - ');
      row.getCell(5).value = h.ort;
      row.getCell(6).value = S.sayi(t.siraSayisi);
      row.getCell(7).value = t.birim === 'sira' ? null : S.sayi(t.bitkiSira);
      row.getCell(8).value = S.sayi(t.fire) || 0;
      row.getCell(9).value = {
        formula: t.birim === 'sira' ? `ROUND(E${r}*F${r}*(1-H${r}/100),0)` : `ROUND(E${r}*F${r}*G${r}*(1-H${r}/100),0)`,
        result: h.toplam,
      };
      const secili = [];
      ustler.forEach((u, j) => {
        const c = row.getCell(kutuIlk + j);
        const d = h.dizilimler.find((x) => x.ust === u);
        const adet = h.alt + u;
        c.value = { formula: `ROUNDUP(I${r}/${adet},0)`, result: h.toplam !== null ? Math.ceil(h.toplam / adet) : 0 };
        if (d) secili.push(L(kutuIlk + j) + r);
        else c.font = { color: { argb: 'FF999999' } };
      });
      row.getCell(ortKol).value = secili.length ? { formula: `ROUND(AVERAGE(${secili.join(',')}),0)`, result: h.ortKutu } : h.ortKutu;
      row.getCell(ortKol).font = { bold: true };
      row.getCell(ortKol + 1).value = t.not || null;
      satirKenar(row, bas.length);
      for (let c = 1; c <= ortKol; c++) if (c !== 4) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
    });
    const r = 3 + hes.length;
    const top = ws.getRow(r);
    top.getCell(1).value = 'TOPLAM';
    ws.mergeCells(r, 1, r, 8);
    const son = Math.max(3, r - 1);
    [9].concat(ustler.map((_, j) => kutuIlk + j), [ortKol]).forEach((c) => {
      const harf = L(c);
      let toplam = 0;
      for (let i = 3; i < r; i++) {
        const v = ws.getCell(i, c).value;
        toplam += (v && typeof v === 'object' ? v.result : v) || 0;
      }
      top.getCell(c).value = { formula: `SUM(${harf}3:${harf}${son})`, result: toplam };
    });
    for (let c = 1; c <= bas.length; c++) {
      const cell = top.getCell(c);
      cell.font = { bold: true };
      cell.fill = dolgu(MAVI);
      cell.border = KENAR;
      cell.alignment = { horizontal: 'center' };
    }
    ws.getCell(r + 2, 1).value = `Kutu dizilimi: alt kata ${alt}, üst kata ${ustler.join(' / ')} domates. Kutu sayısı = toplam meyve ÷ kutu başı adet (yukarı yuvarlanır). Ortalama kutu, seçilen dizilimlerin ortalamasıdır.`;
    ws.getCell(r + 2, 1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
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

  window.Rapor = {
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
