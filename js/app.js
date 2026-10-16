/* Sera Otomasyon – arayüz */
(function () {
  'use strict';
  const S = window.Store;
  const R = window.Rapor;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  const bugun = S.tarihStr(new Date());
  const ui = {
    sekme: 'gunluk',
    tarih: bugun,
    seraId: null,
    ay: bugun.slice(0, 7),
    raporSera: '',
    acik: {}, // daraltılmış kartlar
  };
  try {
    const kayitli = JSON.parse(localStorage.getItem('seraotomasyon.ui') || '{}');
    if (kayitli.seraId) ui.seraId = kayitli.seraId;
    if (kayitli.sekme) ui.sekme = kayitli.sekme;
  } catch (e) {}
  function uiKaydet() {
    try {
      localStorage.setItem('seraotomasyon.ui', JSON.stringify({ seraId: ui.seraId, sekme: ui.sekme }));
    } catch (e) {}
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // ---------- Bildirim & alt sayfa ----------
  let toastZ;
  function toast(m) {
    const t = $('#toast');
    t.textContent = m;
    t.classList.add('gor');
    clearTimeout(toastZ);
    toastZ = setTimeout(() => t.classList.remove('gor'), 2600);
  }

  function sayfaAc(baslik, html, baglayici) {
    const k = $('#katman');
    $('#sayfa-baslik').textContent = baslik;
    $('#sayfa-govde').innerHTML = html;
    k.hidden = false;
    requestAnimationFrame(() => k.classList.add('acik'));
    if (baglayici) baglayici($('#sayfa-govde'));
  }
  function sayfaKapat() {
    const k = $('#katman');
    k.classList.remove('acik');
    setTimeout(() => (k.hidden = true), 200);
  }
  $('#katman').addEventListener('click', (e) => {
    if (e.target.id === 'katman' || e.target.closest('[data-kapat]')) sayfaKapat();
  });

  // ---------- Dosya paylaşımı ----------
  const XLSX_TUR = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  function dosyaHazir(blob, ad) {
    const kb = Math.max(1, Math.round(blob.size / 1024));
    sayfaAc(
      'Dosya hazır',
      `<div class="hazir">
        <div class="hazir-ikon">${ikon('excel')}</div>
        <p class="hazir-ad">${esc(ad)}</p>
        <p class="ince">${kb} KB</p>
        <button class="btn birincil genis" data-pay>${ikon('paylas')} Paylaş / Dosyalara Kaydet</button>
        <button class="btn genis" data-indir>${ikon('indir')} İndir</button>
      </div>`,
      (g) => {
        const file = new File([blob], ad, { type: blob.type || XLSX_TUR });
        const pay = $('[data-pay]', g);
        if (!(navigator.canShare && navigator.canShare({ files: [file] }))) pay.hidden = true;
        pay.addEventListener('click', async () => {
          try {
            await navigator.share({ files: [file], title: ad });
            sayfaKapat();
          } catch (e) {
            if (e.name !== 'AbortError') indir(blob, ad);
          }
        });
        $('[data-indir]', g).addEventListener('click', () => indir(blob, ad));
      }
    );
  }
  function indir(blob, ad) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ad;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 4000);
  }

  // ---------- İkonlar ----------
  function ikon(ad) {
    const p = {
      gunluk: '<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 15l2.5 2.5L16 13"/>',
      rapor: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
      ozet: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
      personel: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      ayarlar: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      excel: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 12l6 6M15 12l-6 6"/>',
      paylas: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
      indir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
      sol: '<path d="M15 18l-6-6 6-6"/>',
      sag: '<path d="M9 18l6-6-6-6"/>',
      arti: '<path d="M12 5v14M5 12h14"/>',
      sil: '<path d="M18 6L6 18M6 6l12 12"/>',
      kopya: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      devret: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
      toplu: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      tik: '<path d="M20 6L9 17l-5-5"/>',
      yukari: '<path d="M18 15l-6-6-6 6"/>',
      asagi: '<path d="M6 9l6 6 6-6"/>',
      kalem: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      yukle: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
      gunes: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    }[ad];
    return `<svg class="ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p || ''}</svg>`;
  }

  // ---------- Sekmeler ----------
  const SEKMELER = [
    ['gunluk', 'Günlük'],
    ['rapor', 'Raporlar'],
    ['ozet', 'Özet'],
    ['personel', 'Personel'],
    ['ayarlar', 'Ayarlar'],
  ];
  function sekmeCiz() {
    const yedekGerekli = yedekHatirlat();
    $('#sekmeler').innerHTML = SEKMELER.map(
      ([k, ad]) =>
        `<button data-sekme="${k}" class="${ui.sekme === k ? 'aktif' : ''}" aria-label="${ad}">${ikon(k)}<span>${ad}</span>${k === 'ayarlar' && yedekGerekli ? '<i class="nokta"></i>' : ''}</button>`
    ).join('');
  }
  $('#sekmeler').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sekme]');
    if (!b) return;
    ui.sekme = b.dataset.sekme;
    uiKaydet();
    ciz();
    window.scrollTo(0, 0);
  });

  function yedekHatirlat() {
    if (!S.d.personel.length) return false;
    const son = S.d.ayarlar.sonYedek ? new Date(S.d.ayarlar.sonYedek) : new Date(S.d.ayarlar.kurulum || Date.now());
    return Date.now() - son.getTime() > 7 * 86400000;
  }

  function ciz() {
    sekmeCiz();
    if (!ui.seraId || !S.sera(ui.seraId)) ui.seraId = S.d.seralar[0] ? S.d.seralar[0].id : null;
    const ekran = $('#ekran');
    ekran.dataset.sekme = ui.sekme;
    ({ gunluk: gunlukCiz, rapor: raporCiz, ozet: ozetCiz, personel: personelCiz, ayarlar: ayarlarCiz })[ui.sekme]();
  }

  function seraCipleri(aktif, aksiyon, tumuSecenek) {
    const liste = (tumuSecenek ? [{ id: '', ad: 'TÜMÜ' }] : []).concat(S.d.seralar);
    return `<div class="cipler" role="tablist">${liste
      .map((s) => `<button role="tab" class="cip ${s.id === aktif ? 'aktif' : ''}" data-a="${aksiyon}" data-id="${s.id}">${esc(s.ad)}</button>`)
      .join('')}</div>`;
  }

  function bosDurumHtml() {
    return `<div class="bos">
      <div class="bos-ikon">${ikon('personel')}</div>
      <h2>Hoş geldiniz</h2>
      <p>Başlamak için mevcut <b>günlük rapor Excel</b> dosyanızı içe aktarın; seralar ve personel otomatik oluşturulur. Ya da elle sera ve personel ekleyin.</p>
      <button class="btn birincil genis" data-a="ice-aktar">${ikon('yukle')} Excel'den içe aktar</button>
      <button class="btn genis" data-a="git-personel">${ikon('arti')} Sera ve personel ekle</button>
    </div>`;
  }

  // =====================================================================
  // GÜNLÜK GİRİŞ
  // =====================================================================
  function gunKaydi(p) {
    return S.kayit(ui.tarih, p.id) || S.yeniKayit(p, ui.seraId);
  }
  function gunPersoneli() {
    const g = S.gun(ui.tarih);
    return S.d.personel.filter((p) => {
      const k = g && g.kayitlar[p.id];
      if (k) return (k.seraId || p.seraId) === ui.seraId;
      return p.seraId === ui.seraId && p.aktif;
    });
  }

  function isSecenekleri(secili) {
    const liste = S.d.isTurleri.slice();
    if (secili && !liste.includes(secili)) liste.unshift(secili);
    return (
      `<option value="">— İş seçin —</option>` +
      liste.map((x) => `<option ${x === secili ? 'selected' : ''}>${esc(x)}</option>`).join('') +
      `<option value="__yeni">+ Yeni iş türü…</option>`
    );
  }

  function kartHtml(p) {
    const k = gunKaydi(p);
    const kayitli = !!S.kayit(ui.tarih, p.id);
    const gelmedi = k.durum && k.durum !== 'geldi';
    const isler = k.isler && k.isler.length ? k.isler : [{ is: '', toplam: p.toplamSira, kalan: 0 }];
    const ozetMetin = isler
      .filter((x) => x.is)
      .map((x) => `${esc(x.is)} <b>${S.sayiYaz(S.yapilan(x))}/${S.sayiYaz(x.toplam)}</b>`)
      .join(' · ');
    return `<article class="kart ${gelmedi ? 'gelmedi' : ''} ${kayitli ? '' : 'girilmedi'}" data-pid="${p.id}">
      <header class="kart-ust">
        <div class="kisi">
          <b>${esc(p.ad)}</b>
          <small>${esc(p.siraMetni || '')}${p.aktif ? '' : ' · pasif'}</small>
        </div>
        <div class="seg" role="radiogroup" aria-label="Durum">
          ${Object.entries(S.DURUMLAR)
            .map(([key, ad]) => `<button role="radio" aria-checked="${k.durum === key}" class="${k.durum === key ? 'sec ' + key : ''}" data-a="durum" data-v="${key}">${ad === 'Raporlu' ? 'Rapor' : ad}</button>`)
            .join('')}
        </div>
      </header>
      ${ozetMetin ? `<p class="kart-ozet">${ozetMetin}</p>` : ''}
      <div class="isler">
        ${isler
          .map(
            (x, i) => `<div class="is" data-i="${i}">
          <div class="is-ust">
            <span class="is-no">${i + 1}</span>
            <select data-f="is" aria-label="${i + 1}. iş">${isSecenekleri(x.is)}</select>
            ${isler.length > 1 ? `<button class="ikon-btn" data-a="is-sil" aria-label="İşi sil">${ikon('sil')}</button>` : ''}
          </div>
          <div class="sayilar">
            <label class="alan kucuk"><span>Toplam</span><input data-f="toplam" inputmode="decimal" value="${esc(S.sayiYaz(x.toplam))}"></label>
            <div class="alan"><span>Kalan</span>
              <div class="stepper">
                <button data-a="kalan" data-d="-0.5" aria-label="Azalt">−</button>
                <input data-f="kalan" inputmode="decimal" value="${esc(S.sayiYaz(x.kalan))}">
                <button data-a="kalan" data-d="0.5" aria-label="Arttır">+</button>
              </div>
            </div>
            <div class="alan yapilan"><span>Yapılan</span><output>${S.sayiYaz(S.yapilan(x))}</output></div>
          </div>
          <div class="hizli">
            <button data-a="hizli" data-v="bitti">Bitti</button>
            <button data-a="hizli" data-v="yarim">Yarısı</button>
            <button data-a="hizli" data-v="hic">Hiç yapılmadı</button>
          </div>
        </div>`
          )
          .join('')}
      </div>
      <div class="kart-alt">
        ${isler.length < 4 ? `<button class="btn kucuk" data-a="is-ekle">${ikon('arti')} İş ekle</button>` : ''}
        ${gelmedi ? `<input class="yerine" data-f="yerine" list="kisi-listesi" placeholder="Yerine yapan" value="${esc(k.yerine || '')}">` : ''}
        <input class="not" data-f="not" placeholder="Not" value="${esc(k.not || '')}">
      </div>
    </article>`;
  }

  function gunOzeti() {
    const kisiler = gunPersoneli();
    let gelen = 0,
      girilen = 0,
      top = 0,
      yap = 0;
    kisiler.forEach((p) => {
      const k = S.kayit(ui.tarih, p.id);
      if (!k) return;
      girilen++;
      if (k.durum === 'geldi') gelen++;
      R.adliIsler(k).forEach((x) => {
        top += S.sayi(x.toplam) || 0;
        yap += S.yapilan(x) || 0;
      });
    });
    const yuzde = top ? Math.round((yap / top) * 100) : 0;
    return `<div class="ozet-kutu"><b>${gelen}</b><span>Gelen</span></div>
      <div class="ozet-kutu"><b>${kisiler.length - gelen}</b><span>Gelmeyen / girilmeyen</span></div>
      <div class="ozet-kutu"><b>${S.sayiYaz(yap)}<small>/${S.sayiYaz(top)}</small></b><span>Sıra yapıldı</span></div>
      <div class="ozet-kutu"><b>%${yuzde}</b><span>Tamamlanma</span></div>
      <div class="ilerleme" style="--y:${yuzde}%"></div>
      ${girilen < kisiler.length ? `<p class="uyari-satir">${kisiler.length - girilen} kişinin bugünkü kaydı henüz girilmedi.</p>` : ''}`;
  }

  function gunlukCiz() {
    const ekran = $('#ekran');
    if (!S.d.seralar.length) {
      ekran.innerHTML = bosDurumHtml();
      return;
    }
    const d = S.strTarih(ui.tarih);
    const tatil = S.tatilMi(ui.tarih);
    const pazar = S.pazarMi(ui.tarih);
    const kisiler = gunPersoneli();
    ekran.innerHTML = `
      <section class="tarih-cubugu">
        <button class="ikon-btn" data-a="gun" data-d="-1" aria-label="Önceki gün">${ikon('sol')}</button>
        <label class="tarih-sec">
          <input type="date" data-a="tarih" value="${ui.tarih}">
          <span><b>${S.trTarih(ui.tarih)}</b> ${S.GUNLER[d.getDay()]}${ui.tarih === bugun ? ' · Bugün' : ''}</span>
        </label>
        <button class="ikon-btn" data-a="gun" data-d="1" aria-label="Sonraki gün">${ikon('sag')}</button>
      </section>
      ${
        tatil
          ? `<div class="tatil-bant">${ikon('gunes')} <span>Tatil: <b>${esc(tatil)}</b></span><button class="btn kucuk" data-a="tatil-kaldir">Kaldır</button></div>`
          : pazar && S.d.ayarlar.pazarTatil
          ? `<div class="tatil-bant ince">${ikon('gunes')} <span>Pazar – kayıt girilmezse aylık raporda “Tatil” yazılır.</span></div>`
          : ''
      }
      ${seraCipleri(ui.seraId, 'sera')}
      <section class="ozet-satir" id="gun-ozet">${gunOzeti()}</section>
      <section class="arac-cubugu">
        <button class="btn kucuk birincil" data-a="gunluk-excel">${ikon('excel')} Excel</button>
        <button class="btn kucuk" data-a="toplu">${ikon('toplu')} Toplu iş ata</button>
        <button class="btn kucuk" data-a="devret">${ikon('devret')} Kalanları devret</button>
        <button class="btn kucuk" data-a="kopyala">${ikon('kopya')} Dünden kopyala</button>
        <button class="btn kucuk" data-a="hepsi-geldi">${ikon('tik')} Hepsi geldi</button>
        ${tatil ? '' : `<button class="btn kucuk" data-a="tatil">${ikon('gunes')} Tatil yap</button>`}
      </section>
      <section class="kartlar">
        ${kisiler.length ? kisiler.map(kartHtml).join('') : `<p class="ince orta">Bu serada personel yok. Personel sekmesinden ekleyin.</p>`}
      </section>
      <button class="btn birincil genis" data-a="gunluk-excel">${ikon('excel')} Günlük raporu Excel olarak al</button>
      <datalist id="kisi-listesi">${S.d.personel
        .filter((p) => p.aktif)
        .map((p) => `<option value="${esc(p.ad)}">`)
        .join('')}</datalist>`;
  }

  function kartYenile(pid) {
    const p = S.kisi(pid);
    const eski = $(`.kart[data-pid="${pid}"]`);
    if (!eski || !p) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = kartHtml(p);
    eski.replaceWith(tmp.firstElementChild);
    $('#gun-ozet').innerHTML = gunOzeti();
  }
  function kartSayilariniGuncelle(kart, pid) {
    const k = S.kayit(ui.tarih, pid);
    if (!k) return;
    $$('.is', kart).forEach((el) => {
      const x = k.isler[+el.dataset.i];
      if (x) $('output', el).textContent = S.sayiYaz(S.yapilan(x));
    });
    const oz = $('.kart-ozet', kart);
    const metin = k.isler
      .filter((x) => x.is)
      .map((x) => `${esc(x.is)} <b>${S.sayiYaz(S.yapilan(x))}/${S.sayiYaz(x.toplam)}</b>`)
      .join(' · ');
    if (oz) oz.innerHTML = metin;
    kart.classList.remove('girilmedi');
    $('#gun-ozet').innerHTML = gunOzeti();
  }

  function seraKayitlariniDuzenle(fn) {
    let n = 0;
    gunPersoneli().forEach((p) => {
      const k = S.kayitAl(ui.tarih, p.id);
      k.seraId = k.seraId || ui.seraId;
      delete k.hamIs;
      if (fn(p, k) !== false) n++;
    });
    S.kaydet();
    return n;
  }

  function topluAta() {
    const html = `
      <label class="alan-blok"><span>Hangi iş sırasına?</span>
        <select id="t-slot"><option value="0">1. iş</option><option value="1">2. iş</option><option value="2">3. iş</option></select></label>
      <label class="alan-blok"><span>İş</span><select id="t-is">${isSecenekleri('')}</select></label>
      <label class="onay"><input type="checkbox" id="t-gelen" checked> Sadece gelenlere uygula</label>
      <label class="onay"><input type="checkbox" id="t-sifir" checked> Kalanı 0 yap (tamamı yapıldı)</label>
      <p class="ince">Toplam sıra, her personelin kendi sıra sayısından alınır.</p>
      <button class="btn birincil genis" id="t-uygula">Uygula</button>`;
    sayfaAc('Toplu iş ata – ' + (S.sera(ui.seraId) || {}).ad, html, (g) => {
      $('#t-is', g).addEventListener('change', (e) => {
        if (e.target.value === '__yeni') yeniIsTuru(e.target);
      });
      $('#t-uygula', g).addEventListener('click', () => {
        const slot = +$('#t-slot', g).value;
        const is = $('#t-is', g).value;
        if (!is || is === '__yeni') return toast('Bir iş seçin');
        const sadeceGelen = $('#t-gelen', g).checked;
        const sifir = $('#t-sifir', g).checked;
        const n = seraKayitlariniDuzenle((p, k) => {
          if (sadeceGelen && k.durum !== 'geldi') return false;
          while (k.isler.length <= slot) k.isler.push({ is: '', toplam: p.toplamSira, kalan: 0 });
          const x = k.isler[slot];
          x.is = is;
          if (S.sayi(x.toplam) === null) x.toplam = p.toplamSira;
          if (sifir) x.kalan = 0;
        });
        sayfaKapat();
        gunlukCiz();
        toast(`${n} kişiye “${is}” atandı`);
      });
    });
  }

  function yeniIsTuru(select) {
    const ad = prompt('Yeni iş türünün adı:');
    if (ad && ad.trim()) {
      const u = S.trUpper(ad.trim());
      if (!S.d.isTurleri.includes(u)) S.d.isTurleri.push(u);
      S.kaydet();
      select.innerHTML = isSecenekleri(u);
      select.value = u;
      return u;
    }
    select.value = '';
    return null;
  }

  function kalanlariDevret() {
    let n = 0;
    seraKayitlariniDuzenle((p, k) => {
      const onceki = S.oncekiKayit(ui.tarih, p.id);
      if (!onceki) return false;
      const devir = onceki.kayit.isler.filter((x) => x.is && (S.sayi(x.kalan) || 0) > 0).map((x) => ({ is: x.is, toplam: S.sayi(x.kalan), kalan: 0 }));
      if (!devir.length) return false;
      const adlar = new Set(devir.map((x) => x.is));
      const mevcut = k.isler.filter((x) => x.is && !adlar.has(x.is));
      k.isler = devir.concat(mevcut);
      n++;
    });
    gunlukCiz();
    toast(n ? `${n} kişinin önceki günden kalan işleri devredildi` : 'Devredilecek kalan iş bulunamadı');
  }

  function dundenKopyala() {
    const var_ = gunPersoneli().some((p) => {
      const k = S.kayit(ui.tarih, p.id);
      return k && R.adliIsler(k).length;
    });
    if (var_ && !confirm('Bu günün mevcut iş kayıtlarının üzerine yazılsın mı?')) return;
    let n = 0;
    seraKayitlariniDuzenle((p, k) => {
      const onceki = S.oncekiKayit(ui.tarih, p.id);
      if (!onceki) return false;
      k.isler = onceki.kayit.isler.filter((x) => x.is).map((x) => ({ is: x.is, toplam: p.toplamSira, kalan: 0 }));
      k.durum = 'geldi';
      k.yerine = '';
      n++;
    });
    gunlukCiz();
    toast(n ? `${n} kişinin işleri önceki günden kopyalandı` : 'Önceki günlerde kayıt bulunamadı');
  }

  // Günlük ekran olayları
  $('#ekran').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    const kart = b.closest('.kart');
    const pid = kart && kart.dataset.pid;
    const isEl = b.closest('.is');
    const i = isEl ? +isEl.dataset.i : null;

    switch (a) {
      case 'gun':
        ui.tarih = S.gunEkle(ui.tarih, +b.dataset.d);
        return gunlukCiz();
      case 'sera':
        ui.seraId = b.dataset.id;
        uiKaydet();
        return gunlukCiz();
      case 'durum': {
        const k = S.kayitAl(ui.tarih, pid);
        k.durum = b.dataset.v;
        if (k.durum === 'geldi') k.yerine = '';
        S.kaydet();
        return kartYenile(pid);
      }
      case 'kalan': {
        const k = S.kayitAl(ui.tarih, pid);
        const x = k.isler[i];
        const top = S.sayi(x.toplam);
        let v = (S.sayi(x.kalan) || 0) + +b.dataset.d;
        v = Math.max(0, top !== null ? Math.min(top, v) : v);
        x.kalan = v;
        S.kaydet();
        $('[data-f="kalan"]', isEl).value = S.sayiYaz(v);
        return kartSayilariniGuncelle(kart, pid);
      }
      case 'hizli': {
        const k = S.kayitAl(ui.tarih, pid);
        const x = k.isler[i];
        const top = S.sayi(x.toplam) || 0;
        x.kalan = b.dataset.v === 'bitti' ? 0 : b.dataset.v === 'hic' ? top : Math.round(top * 5) / 10;
        S.kaydet();
        $('[data-f="kalan"]', isEl).value = S.sayiYaz(x.kalan);
        return kartSayilariniGuncelle(kart, pid);
      }
      case 'is-ekle': {
        const k = S.kayitAl(ui.tarih, pid);
        k.isler.push({ is: '', toplam: S.kisi(pid).toplamSira, kalan: 0 });
        delete k.hamIs;
        S.kaydet();
        return kartYenile(pid);
      }
      case 'is-sil': {
        const k = S.kayitAl(ui.tarih, pid);
        k.isler.splice(i, 1);
        delete k.hamIs;
        S.kaydet();
        return kartYenile(pid);
      }
      case 'toplu':
        return topluAta();
      case 'devret':
        return kalanlariDevret();
      case 'kopyala':
        return dundenKopyala();
      case 'hepsi-geldi':
        seraKayitlariniDuzenle((p, k) => {
          k.durum = 'geldi';
          k.yerine = '';
        });
        return gunlukCiz();
      case 'tatil': {
        const m = prompt('Tatil açıklaması:', S.pazarMi(ui.tarih) ? 'Tatil' : 'Tatil');
        if (m === null) return;
        S.gun(ui.tarih, true).tatil = m.trim() || 'Tatil';
        S.kaydet();
        return gunlukCiz();
      }
      case 'tatil-kaldir':
        S.gun(ui.tarih, true).tatil = null;
        S.kaydet();
        return gunlukCiz();
      case 'gunluk-excel':
        return gunlukExcel(ui.tarih);
      case 'ice-aktar':
        return excelSec();
      case 'git-personel':
        ui.sekme = 'personel';
        return ciz();
    }
  });

  $('#ekran').addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.a === 'tarih' && el.value) {
      ui.tarih = el.value;
      return gunlukCiz();
    }
    if (ui.sekme !== 'gunluk') return;
    const kart = el.closest('.kart');
    if (!kart || el.dataset.f !== 'is') return;
    const pid = kart.dataset.pid;
    const i = +el.closest('.is').dataset.i;
    let v = el.value;
    if (v === '__yeni') v = yeniIsTuru(el) || '';
    const k = S.kayitAl(ui.tarih, pid);
    k.isler[i].is = v;
    delete k.hamIs;
    S.kaydet();
    kartSayilariniGuncelle(kart, pid);
  });

  $('#ekran').addEventListener('input', (e) => {
    const el = e.target;
    if (ui.sekme !== 'gunluk') return;
    const kart = el.closest('.kart');
    if (!kart || !el.dataset.f || el.dataset.f === 'is') return;
    const pid = kart.dataset.pid;
    const k = S.kayitAl(ui.tarih, pid);
    const f = el.dataset.f;
    if (f === 'not' || f === 'yerine') {
      k[f] = el.value;
    } else {
      const i = +el.closest('.is').dataset.i;
      const n = S.sayi(el.value);
      k.isler[i][f] = n === null ? (f === 'kalan' ? 0 : null) : n;
    }
    S.kaydet();
    kartSayilariniGuncelle(kart, pid);
  });

  async function calis(isim, fn) {
    const y = $('#yukleniyor');
    y.hidden = false;
    try {
      await new Promise((r) => setTimeout(r, 30));
      return await fn();
    } catch (err) {
      console.error(err);
      alert(isim + ' sırasında hata: ' + err.message);
    } finally {
      y.hidden = true;
    }
  }

  function gunlukExcel(t) {
    return calis('Günlük rapor', async () => {
      const wb = await R.gunlukRapor(t);
      const blob = await R.blob(wb);
      dosyaHazir(blob, `SERA GÜNLÜK RAPOR ${S.trTarih(t)}.xlsx`);
    });
  }

  // =====================================================================
  // RAPORLAR
  // =====================================================================
  function raporCiz() {
    const ekran = $('#ekran');
    if (!S.d.seralar.length) {
      ekran.innerHTML = bosDurumHtml();
      return;
    }
    const seraSec = (ad, secili, tumu) =>
      `<select id="${ad}">${tumu ? `<option value="">Tüm seralar</option>` : ''}${S.d.seralar
        .map((s) => `<option value="${s.id}" ${s.id === secili ? 'selected' : ''}>${esc(s.ad)}</option>`)
        .join('')}</select>`;
    ekran.innerHTML = `
      <h1 class="baslik">Raporlar</h1>
      <section class="panel">
        <h2>${ikon('gunluk')} Günlük Rapor</h2>
        <p class="ince">Tüm seralar tek sayfada, orijinal “SERA GÜNLÜK RAPOR” düzeninde. Yapılan sıra sütunları formüllüdür.</p>
        <label class="alan-blok"><span>Tarih</span><input type="date" id="r-tarih" value="${ui.tarih}"></label>
        <button class="btn birincil genis" id="r-gunluk">${ikon('excel')} Günlük Excel oluştur</button>
      </section>
      <section class="panel">
        <h2>${ikon('rapor')} Aylık Personel Raporu</h2>
        <p class="ince">Her personel için ayrı sayfa: tarih, yapılan iş, tamamlanan ve kalan sıra, uyarı. Tatiller ve devamsızlıklar otomatik yazılır.</p>
        <label class="alan-blok"><span>Ay</span><input type="month" id="r-ay" value="${ui.ay}"></label>
        <label class="alan-blok"><span>Sera</span>${seraSec('r-sera', ui.raporSera || ui.seraId, true)}</label>
        <label class="onay"><input type="checkbox" id="r-ozet"> Başa “ÖZET” sayfası ekle</label>
        <button class="btn birincil genis" id="r-aylik">${ikon('excel')} Aylık Excel oluştur</button>
      </section>
      <section class="panel">
        <h2>${ikon('indir')} Toplu Günlük Raporlar</h2>
        <p class="ince">Seçilen aydaki kayıtlı her gün için günlük raporu tek Excel dosyasında (her gün bir sayfa) alın.</p>
        <button class="btn genis" id="r-toplu">${ikon('excel')} Ayın tüm günleri</button>
      </section>`;

    $('#r-gunluk').onclick = () => gunlukExcel($('#r-tarih').value || ui.tarih);
    $('#r-ay').onchange = (e) => (ui.ay = e.target.value || ui.ay);
    $('#r-sera').onchange = (e) => (ui.raporSera = e.target.value);
    $('#r-aylik').onclick = () => {
      const [y, m] = ($('#r-ay').value || ui.ay).split('-').map(Number);
      const sid = $('#r-sera').value;
      const sera = S.sera(sid);
      calis('Aylık rapor', async () => {
        const wb = await R.aylikRapor(y, m - 1, sid || null, { ozet: $('#r-ozet').checked });
        dosyaHazir(await R.blob(wb), `${S.AYLAR[m - 1]} AYI ${sera ? sera.ad : 'TÜM SERALAR'} RAPOR.xlsx`);
      });
    };
    $('#r-toplu').onclick = () => {
      const [y, m] = ($('#r-ay').value || ui.ay).split('-').map(Number);
      calis('Toplu rapor', async () => {
        const hedef = new ExcelJS.Workbook();
        const gunler = R.ayGunleri(y, m - 1).filter((t) => {
          const g = S.gun(t);
          return g && Object.keys(g.kayitlar).length;
        });
        if (!gunler.length) throw new Error('Bu ayda kayıtlı gün yok');
        for (const t of gunler) {
          const wb = await R.gunlukRapor(t);
          kopyalaSayfa(wb.worksheets[0], hedef.addWorksheet(S.trTarih(t)));
        }
        dosyaHazir(await R.blob(hedef), `${S.AYLAR[m - 1]} ${y} GÜNLÜK RAPORLAR.xlsx`);
      });
    };
  }

  function kopyalaSayfa(kaynak, hedef) {
    kaynak.columns.forEach((c, i) => (hedef.getColumn(i + 1).width = c.width));
    kaynak.eachRow({ includeEmpty: true }, (row, rn) => {
      const h = hedef.getRow(rn);
      if (row.height) h.height = row.height;
      row.eachCell({ includeEmpty: true }, (c, cn) => {
        const hc = h.getCell(cn);
        hc.value = c.value;
        hc.style = JSON.parse(JSON.stringify(c.style || {}));
      });
    });
    Object.keys(kaynak._merges || {}).forEach((k) => hedef.mergeCells(kaynak._merges[k].range));
    hedef.pageSetup = Object.assign({}, kaynak.pageSetup);
  }

  // =====================================================================
  // ÖZET
  // =====================================================================
  function ozetCiz() {
    const ekran = $('#ekran');
    if (!S.d.seralar.length) {
      ekran.innerHTML = bosDurumHtml();
      return;
    }
    const [y, m] = ui.ay.split('-').map(Number);
    const veri = R.ozet(y, m - 1, ui.seraId);
    const isToplam = {};
    veri.forEach((o) => Object.entries(o.isler).forEach(([k, v]) => (isToplam[k] = (isToplam[k] || 0) + v)));
    const isler = Object.entries(isToplam).sort((a, b) => b[1] - a[1]);
    const toplamYap = veri.reduce((t, o) => t + o.yapilan, 0);
    const toplamYok = veri.reduce((t, o) => t + o.yok + o.izinli + o.raporlu, 0);
    const kalanlar = veri.filter((o) => o.kalan > 0).sort((a, b) => b.kalan - a.kalan);
    ekran.innerHTML = `
      <h1 class="baslik">Aylık Özet</h1>
      <label class="alan-blok"><span>Ay</span><input type="month" id="o-ay" value="${ui.ay}"></label>
      ${seraCipleri(ui.seraId, 'o-sera')}
      <section class="ozet-satir">
        <div class="ozet-kutu"><b>${veri.length}</b><span>Personel</span></div>
        <div class="ozet-kutu"><b>${S.sayiYaz(Math.round(toplamYap * 10) / 10)}</b><span>Tamamlanan sıra</span></div>
        <div class="ozet-kutu"><b>${toplamYok}</b><span>Devamsızlık (gün)</span></div>
      </section>
      <section class="panel">
        <h2>Personel</h2>
        <div class="tablo-kap"><table class="tablo">
          <thead><tr><th>Personel</th><th>Gün</th><th>Yok</th><th>İzin/Rapor</th><th>Yapılan</th><th>Kalan</th></tr></thead>
          <tbody>${veri
            .map(
              (o) => `<tr><td>${esc(o.p.ad)}</td><td>${o.calisti}</td><td class="${o.yok ? 'kirmizi' : ''}">${o.yok}</td><td>${o.izinli + o.raporlu}</td><td><b>${S.sayiYaz(o.yapilan)}</b></td><td>${S.sayiYaz(o.kalan)}</td></tr>`
            )
            .join('')}</tbody>
        </table></div>
      </section>
      <section class="panel">
        <h2>İş türlerine göre tamamlanan sıra</h2>
        ${isler.length ? `<ul class="liste">${isler.map(([k, v]) => `<li><span>${esc(k)}</span><b>${S.sayiYaz(Math.round(v * 10) / 10)}</b></li>`).join('')}</ul>` : '<p class="ince">Bu ay kayıt yok.</p>'}
      </section>
      <section class="panel">
        <h2>Devamsızlıklar</h2>
        ${
          veri.some((o) => o.yokGunler.length)
            ? `<ul class="liste">${veri
                .filter((o) => o.yokGunler.length)
                .map((o) => `<li><span>${esc(o.p.ad)}</span><small>${o.yokGunler.map((t) => t.slice(8, 10)).join(', ')}</small></li>`)
                .join('')}</ul>`
            : '<p class="ince">Devamsızlık yok.</p>'
        }
      </section>
      ${
        kalanlar.length
          ? `<section class="panel"><h2>En çok kalan sırası olanlar</h2><ul class="liste">${kalanlar
              .slice(0, 8)
              .map((o) => `<li><span>${esc(o.p.ad)}</span><b class="kirmizi">${S.sayiYaz(o.kalan)}</b></li>`)
              .join('')}</ul><p class="ince">Toplam kalan, günlük kayıtlardaki “kalan” değerlerinin ay içi toplamıdır.</p></section>`
          : ''
      }`;
    $('#o-ay').onchange = (e) => {
      if (e.target.value) {
        ui.ay = e.target.value;
        ozetCiz();
      }
    };
    $$('[data-a="o-sera"]').forEach(
      (b) =>
        (b.onclick = () => {
          ui.seraId = b.dataset.id;
          uiKaydet();
          ozetCiz();
        })
    );
  }

  // =====================================================================
  // PERSONEL & SERALAR
  // =====================================================================
  function personelCiz() {
    const ekran = $('#ekran');
    ekran.innerHTML = `
      <h1 class="baslik">Personel & Seralar</h1>
      ${S.d.seralar
        .map((s) => {
          const kisiler = S.seraPersoneli(s.id, true);
          return `<section class="panel" data-sera="${s.id}">
          <div class="panel-ust"><h2>${esc(s.ad)} <small>${kisiler.filter((p) => p.aktif).length} kişi</small></h2>
            <button class="ikon-btn" data-p="sera-duzenle" aria-label="Serayı düzenle">${ikon('kalem')}</button></div>
          <ul class="kisi-liste">${kisiler
            .map(
              (p, i) => `<li class="${p.aktif ? '' : 'pasif'}" data-pid="${p.id}">
              <button class="kisi-ad" data-p="kisi">${esc(p.ad)}<small>${esc(p.siraMetni || '')}${p.toplamSira !== null ? ' · ' + S.sayiYaz(p.toplamSira) + ' sıra' : ''}${p.aktif ? '' : ' · pasif'}</small></button>
              <button class="ikon-btn" data-p="yukari" ${i === 0 ? 'disabled' : ''} aria-label="Yukarı">${ikon('yukari')}</button>
              <button class="ikon-btn" data-p="asagi" ${i === kisiler.length - 1 ? 'disabled' : ''} aria-label="Aşağı">${ikon('asagi')}</button>
            </li>`
            )
            .join('')}</ul>
          <button class="btn kucuk" data-p="kisi-ekle">${ikon('arti')} Personel ekle</button>
        </section>`;
        })
        .join('')}
      <button class="btn birincil genis" data-p="sera-ekle">${ikon('arti')} Sera ekle</button>
      <button class="btn genis" data-a="ice-aktar">${ikon('yukle')} Excel'den içe aktar</button>`;
  }

  $('#ekran').addEventListener('click', (e) => {
    if (ui.sekme !== 'personel') return;
    const b = e.target.closest('[data-p]');
    if (!b) return;
    const panel = b.closest('[data-sera]');
    const seraId = panel && panel.dataset.sera;
    const li = b.closest('[data-pid]');
    const pid = li && li.dataset.pid;
    switch (b.dataset.p) {
      case 'sera-ekle': {
        const ad = prompt('Sera adı (ör. SERA 3):', 'SERA ' + (S.d.seralar.length + 1));
        if (ad && ad.trim()) {
          S.seraEkle(ad);
          personelCiz();
        }
        return;
      }
      case 'sera-duzenle': {
        const s = S.sera(seraId);
        sayfaAc(
          'Serayı düzenle',
          `<label class="alan-blok"><span>Sera adı</span><input id="s-ad" value="${esc(s.ad)}"></label>
           <button class="btn birincil genis" id="s-kaydet">Kaydet</button>
           <button class="btn tehlike genis" id="s-sil">Serayı sil</button>`,
          (g) => {
            $('#s-kaydet', g).onclick = () => {
              const v = $('#s-ad', g).value.trim();
              if (v) s.ad = S.trUpper(v);
              S.kaydet();
              sayfaKapat();
              personelCiz();
            };
            $('#s-sil', g).onclick = () => {
              const n = S.seraPersoneli(s.id, true).length;
              if (!confirm(`${s.ad} silinsin mi?${n ? ` ${n} personel “serasız” kalacak.` : ''}`)) return;
              S.d.seralar = S.d.seralar.filter((x) => x.id !== s.id);
              S.d.personel.forEach((p) => {
                if (p.seraId === s.id) p.seraId = null;
              });
              S.kaydet();
              sayfaKapat();
              personelCiz();
            };
          }
        );
        return;
      }
      case 'kisi-ekle':
        return kisiDuzenle(null, seraId);
      case 'kisi':
        return kisiDuzenle(pid);
      case 'yukari':
      case 'asagi': {
        const liste = S.seraPersoneli(seraId, true);
        const i = liste.findIndex((p) => p.id === pid);
        const j = b.dataset.p === 'yukari' ? i - 1 : i + 1;
        if (j < 0 || j >= liste.length) return;
        const all = S.d.personel;
        const ai = all.indexOf(liste[i]);
        const aj = all.indexOf(liste[j]);
        [all[ai], all[aj]] = [all[aj], all[ai]];
        S.kaydet();
        return personelCiz();
      }
    }
  });

  function kisiDuzenle(pid, seraId) {
    const p = pid ? S.kisi(pid) : { ad: '', seraId, siraMetni: '', toplamSira: null, aktif: true };
    sayfaAc(
      pid ? 'Personeli düzenle' : 'Yeni personel',
      `<label class="alan-blok"><span>Ad Soyad</span><input id="k-ad" value="${esc(p.ad)}" autocapitalize="characters"></label>
       <label class="alan-blok"><span>Sera</span><select id="k-sera">${S.d.seralar
         .map((s) => `<option value="${s.id}" ${s.id === p.seraId ? 'selected' : ''}>${esc(s.ad)}</option>`)
         .join('')}</select></label>
       <label class="alan-blok"><span>Sıra açıklaması (raporda “TOPLAM SIRA SAYISI”)</span><input id="k-metin" value="${esc(p.siraMetni)}" placeholder="ör. 15 (50M) veya 7 (50M) - 9 (45M)"></label>
       <label class="alan-blok"><span>Toplam sıra sayısı</span><input id="k-top" inputmode="decimal" value="${esc(S.sayiYaz(p.toplamSira))}" placeholder="ör. 15"></label>
       <label class="onay"><input type="checkbox" id="k-aktif" ${p.aktif ? 'checked' : ''}> Aktif (günlük listede görünsün)</label>
       <button class="btn birincil genis" id="k-kaydet">Kaydet</button>
       ${pid ? '<button class="btn tehlike genis" id="k-sil">Personeli sil</button>' : ''}`,
      (g) => {
        $('#k-metin', g).addEventListener('input', (e) => {
          const t = S.siraMetnindenToplam(e.target.value);
          if (t !== null) $('#k-top', g).value = S.sayiYaz(t);
        });
        $('#k-kaydet', g).onclick = () => {
          const ad = $('#k-ad', g).value.trim();
          if (!ad) return toast('Ad girin');
          const veri = {
            ad: S.trUpper(ad),
            seraId: $('#k-sera', g).value,
            siraMetni: $('#k-metin', g).value.trim(),
            toplamSira: S.sayi($('#k-top', g).value),
            aktif: $('#k-aktif', g).checked,
          };
          if (pid) Object.assign(p, veri);
          else S.personelEkle(veri);
          S.kaydet();
          sayfaKapat();
          personelCiz();
        };
        const sil = $('#k-sil', g);
        if (sil)
          sil.onclick = () => {
            if (!confirm(`${p.ad} silinsin mi? Geçmiş kayıtları raporlarda görünmez. (Sadece listeden kaldırmak için “Aktif” işaretini kaldırın.)`)) return;
            S.d.personel = S.d.personel.filter((x) => x.id !== pid);
            Object.values(S.d.gunler).forEach((gun) => delete gun.kayitlar[pid]);
            S.kaydet();
            sayfaKapat();
            personelCiz();
          };
      }
    );
  }

  // =====================================================================
  // AYARLAR
  // =====================================================================
  function ayarlarCiz() {
    const son = S.d.ayarlar.sonYedek ? new Date(S.d.ayarlar.sonYedek).toLocaleString('tr-TR') : 'hiç alınmadı';
    const kayitGun = Object.keys(S.d.gunler).length;
    $('#ekran').innerHTML = `
      <h1 class="baslik">Ayarlar</h1>
      ${yedekHatirlat() ? `<div class="uyari-bant">Son yedeğin üzerinden 7 günden fazla geçti. Verileriniz sadece bu telefonda; lütfen yedek alın.</div>` : ''}
      <section class="panel">
        <h2>${ikon('yukle')} Excel'den içe aktar</h2>
        <p class="ince">Mevcut <b>günlük rapor</b> (SERA GÜNLÜK RAPOR …) veya <b>aylık personel raporu</b> (… AYI SERA 1 RAPOR) dosyalarını seçin. Seralar, personel, sıra sayıları ve o günlerin kayıtları otomatik eklenir. Birden fazla dosya seçebilirsiniz.</p>
        <button class="btn birincil genis" data-a="ice-aktar">Excel dosyası seç</button>
      </section>
      <section class="panel">
        <h2>${ikon('indir')} Yedekleme</h2>
        <p class="ince">Veriler bu cihazda saklanır (${S.d.personel.length} personel, ${kayitGun} gün). Son yedek: <b>${son}</b></p>
        <button class="btn genis" id="y-al">Yedek al (JSON)</button>
        <button class="btn genis" id="y-yukle">Yedekten geri yükle</button>
      </section>
      <section class="panel">
        <h2>İş türleri</h2>
        <ul class="liste is-turleri">${S.d.isTurleri
          .map((x, i) => `<li><span>${esc(x)}</span><button class="ikon-btn" data-sil-is="${i}" aria-label="Sil">${ikon('sil')}</button></li>`)
          .join('')}</ul>
        <div class="satir"><input id="yeni-is" placeholder="Yeni iş türü"><button class="btn" id="is-ekle">Ekle</button></div>
      </section>
      <section class="panel">
        <h2>Genel</h2>
        <label class="onay"><input type="checkbox" id="pazar" ${S.d.ayarlar.pazarTatil ? 'checked' : ''}> Kayıt girilmeyen Pazar günlerini aylık raporda “Tatil” yaz</label>
      </section>
      <section class="panel">
        <h2>iPhone'a uygulama olarak ekle</h2>
        <ol class="adimlar"><li>Bu sayfayı <b>Safari</b>'de açın.</li><li>Alttaki <b>Paylaş</b> düğmesine dokunun.</li><li><b>Ana Ekrana Ekle</b>'yi seçin.</li><li>Uygulama artık internetsiz de açılır.</li></ol>
      </section>
      <section class="panel">
        <button class="btn tehlike genis" id="sifirla">Tüm verileri sil</button>
        <p class="ince orta">Sera Otomasyon · v1.0</p>
      </section>`;

    $('#y-al').onclick = () => {
      const blob = new Blob([S.disaAktarJSON()], { type: 'application/json' });
      dosyaHazir(blob, `sera-yedek-${S.tarihStr(new Date())}.json`);
      sekmeCiz();
    };
    $('#y-yukle').onclick = () => {
      dosyaSec('.json,application/json', false, async ([f]) => {
        if (!confirm('Mevcut tüm veriler yedekteki verilerle değiştirilecek. Devam edilsin mi?')) return;
        try {
          S.iceAktarJSON(await f.text());
          toast('Yedek geri yüklendi');
          ciz();
        } catch (err) {
          alert('Yedek okunamadı: ' + err.message);
        }
      });
    };
    $('#is-ekle').onclick = () => {
      const v = $('#yeni-is').value.trim();
      if (!v) return;
      const u = S.trUpper(v);
      if (!S.d.isTurleri.includes(u)) S.d.isTurleri.push(u);
      S.kaydet();
      ayarlarCiz();
    };
    $$('[data-sil-is]').forEach(
      (b) =>
        (b.onclick = () => {
          S.d.isTurleri.splice(+b.dataset.silIs, 1);
          S.kaydet();
          ayarlarCiz();
        })
    );
    $('#pazar').onchange = (e) => {
      S.d.ayarlar.pazarTatil = e.target.checked;
      S.kaydet();
    };
    $('#sifirla').onclick = () => {
      if (!confirm('TÜM veriler silinecek. Önce yedek aldınız mı?')) return;
      if (!confirm('Emin misiniz? Bu işlem geri alınamaz.')) return;
      S.sifirla();
      ciz();
    };
  }

  // =====================================================================
  // EXCEL İÇE AKTARMA
  // =====================================================================
  // iOS Safari'de dosya seçici için input'un DOM'da olması gerekir
  function dosyaSec(accept, coklu, cb) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = !!coklu;
    inp.accept = accept;
    inp.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const dosyalar = Array.from(inp.files || []);
      inp.remove();
      if (dosyalar.length) cb(dosyalar);
    });
    inp.click();
  }
  function excelSec() {
    dosyaSec('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true, iceAktar);
  }

  async function iceAktar(dosyalar) {
    const sonuc = [];
    for (const f of dosyalar) {
      const r = await calis('İçe aktarma', async () => {
        const { wb, tur } = await R.oku(f);
        if (tur === 'gunluk') {
          const ist = R.gunlukIceAktar(wb.worksheets[0]);
          return `${f.name}: günlük rapor${ist.tarih ? ' (' + S.trTarih(ist.tarih) + ')' : ''} – ${ist.sera} sera, ${ist.personel} yeni personel, ${ist.kayit} kayıt`;
        }
        if (tur === 'aylik') {
          const seraId = await aylikSeraSor(f.name);
          if (!seraId) return `${f.name}: iptal edildi`;
          const ist = R.aylikIceAktar(wb, seraId);
          return `${f.name}: aylık rapor – ${ist.sayfa} sayfa, ${ist.personel} yeni personel, ${ist.kayit} günlük kayıt`;
        }
        return `${f.name}: tanınmayan biçim (A1 hücresi “PERSONELLER” veya “PERSONEL: …” olmalı)`;
      });
      if (r) sonuc.push(r);
    }
    S.kaydet(true);
    if (!ui.seraId && S.d.seralar[0]) ui.seraId = S.d.seralar[0].id;
    ciz();
    if (sonuc.length) sayfaAc('İçe aktarma tamamlandı', `<ul class="liste">${sonuc.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ul><button class="btn birincil genis" data-kapat>Tamam</button>`);
  }

  function aylikSeraSor(dosyaAdi) {
    return new Promise((coz) => {
      const m = S.trUpper(dosyaAdi).match(/SERA[\s_\-]*(\d+)/);
      const tahmin = m ? 'SERA ' + m[1] : '';
      const var_ = tahmin && S.seraBulAd(tahmin);
      let bitti = false;
      sayfaAc(
        'Hangi seraya ait?',
        `<p class="ince">${esc(dosyaAdi)}</p>
         <label class="alan-blok"><span>Sera</span><select id="as-sera">
           ${S.d.seralar.map((s) => `<option value="${s.id}" ${var_ && var_.id === s.id ? 'selected' : ''}>${esc(s.ad)}</option>`).join('')}
           <option value="__yeni" ${!var_ ? 'selected' : ''}>+ Yeni sera${tahmin && !var_ ? ': ' + esc(tahmin) : ''}</option>
         </select></label>
         <button class="btn birincil genis" id="as-tamam">İçe aktar</button>
         <button class="btn genis" data-kapat>İptal</button>`,
        (g) => {
          $('#as-tamam', g).onclick = () => {
            let v = $('#as-sera', g).value;
            if (v === '__yeni') {
              const ad = tahmin || prompt('Sera adı:', 'SERA ' + (S.d.seralar.length + 1));
              if (!ad) return;
              v = S.seraEkle(ad).id;
            }
            bitti = true;
            sayfaKapat();
            coz(v);
          };
          const gozle = setInterval(() => {
            if ($('#katman').hidden && !bitti) {
              clearInterval(gozle);
              coz(null);
            } else if (bitti) clearInterval(gozle);
          }, 300);
        }
      );
      $('#yukleniyor').hidden = true;
    });
  }

  // ---------- Başlat ----------
  ciz();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }
  window.SeraApp = { ui, ciz, iceAktar };
})();
