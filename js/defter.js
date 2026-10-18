/* Sera Otomasyon – Defter: hasat tahmini ve ilaçlama kayıtları */
(function () {
  'use strict';
  const S = window.Store;
  const R = window.Rapor;
  const A = window.SeraApp;
  const { esc, ikon, toast, sayfaAc, sayfaKapat, dosyaHazir, calis } = A.yard;
  const ui = A.ui;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  ui.defter = 'hasat';
  ui.defterSera = '';
  try {
    ui.defter = localStorage.getItem('seraotomasyon.defter') || 'hasat';
  } catch (e) {}

  const bugun = () => S.tarihStr(new Date());

  function seraSecenekleri(secili, tumuEtiket) {
    return (
      (tumuEtiket ? `<option value="">${tumuEtiket}</option>` : '') +
      S.d.seralar.map((s) => `<option value="${s.id}" ${s.id === secili ? 'selected' : ''}>${esc(s.ad)}</option>`).join('')
    );
  }
  function datalist(id, liste) {
    return `<datalist id="${id}">${Array.from(new Set(liste.filter(Boolean)))
      .map((x) => `<option value="${esc(x)}">`)
      .join('')}</datalist>`;
  }
  // =====================================================================
  function ciz() {
    const ekran = $('#ekran');
    if (!S.d.seralar.length) {
      ekran.innerHTML = `<div class="bos"><div class="bos-ikon">${ikon('defter')}</div><h2>Önce sera ekleyin</h2>
        <p>Hasat tahmini ve ilaçlama kayıtları seralara bağlıdır. Personel sekmesinden sera ekleyin veya Excel'den içe aktarın.</p></div>`;
      return;
    }
    const [y, m] = ui.ay.split('-').map(Number);
    const sid = ui.defterSera || null;
    ekran.innerHTML = `
      <h1 class="baslik">Sera Defteri</h1>
      <div class="seg genis-seg" role="tablist">
        <button role="tab" class="${ui.defter === 'hasat' ? 'sec geldi' : ''}" data-df="sekme" data-v="hasat">${ikon('hasat')} Hasat</button>
        <button role="tab" class="${ui.defter === 'ilac' ? 'sec geldi' : ''}" data-df="sekme" data-v="ilac">${ikon('ilac')} İlaçlama</button>
        <button role="tab" class="${ui.defter === 'drenaj' ? 'sec geldi' : ''}" data-df="sekme" data-v="drenaj">💧 Drenaj</button>
        <button role="tab" class="${ui.defter === 'plan' ? 'sec geldi' : ''}" data-df="sekme" data-v="plan">👥 Plan</button>
      </div>
      <div class="filtre">
        <label class="alan-blok"><span>Ay</span><input type="month" data-df="ay" value="${ui.ay}"></label>
        <label class="alan-blok"><span>Sera</span><select data-df="sera">${seraSecenekleri(ui.defterSera, 'Tüm seralar')}</select></label>
      </div>
      ${ui.defter === 'hasat' ? hasatHtml(y, m - 1, sid) : ui.defter === 'drenaj' ? drenajHtml(y, m - 1) : ui.defter === 'plan' ? window.Plan.html(y, m - 1) : ilacHtml(y, m - 1, sid)}`;
  }

  // ---------- HASAT TAHMİNİ (kutu + palet) ----------
  // Her sektörde örnek sıralarda 1. kalite salkım sayılır. kutu/sıra = salkım ÷ (alt + üst);
  // toplam kutu = sıra (güncel bitki sayımından) × kutu/sıra; palet = toplam kutu ÷ palet kapasitesi.
  const nf = (n, k) => (n === null || n === undefined || !isFinite(n) ? '–' : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: k || 0, minimumFractionDigits: k ? 1 : 0 }));

  function paletTablosu(h) {
    const satir = (tur) =>
      `<tr><th>${tur === 'EURO' ? 'Euro' : 'Büyük'} palet</th>${S.PALETLER.map((p, i) => (p.tur !== tur ? '' : `<td><small>${p.boy} boy · ${p.kutu}</small><b>${nf(h.paletler[i], 1)}</b><small>${Math.floor(h.toplamKutu / p.kutu)} tam + ${Math.round(h.toplamKutu % p.kutu)} kutu</small></td>`)).join('')}</tr>`;
    return `<table class="ts-tablo ts-palet"><thead><tr><th></th><th>13 boy</th><th>14 boy</th><th>15 boy</th></tr></thead><tbody>${satir('EURO')}${satir('BÜYÜK')}</tbody></table>`;
  }

  function sonucHtml(h) {
    if (!h.birimler.length) return `<div class="tahmin-sonuc bos-sonuc">Sonuç için en az bir sektöre sıra sayımı girin.</div>`;
    return `<div class="tahmin-sonuc">
      <table class="ts-tablo ts-sektor"><thead><tr><th>Sektör</th><th>Sıra</th><th>Salkım</th><th>Kutu/sıra</th><th>Top. kutu</th></tr></thead><tbody>
        ${h.birimler.map((x) => `<tr><td>${esc(x.no)}</td><td>${x.sira}</td><td>${S.sayiYaz(x.ort)}</td><td>${S.sayiYaz(x.kutuSira)}</td><td><b>${nf(x.toplamKutu)}</b></td></tr>`).join('')}
        <tr class="ts-toplam"><td>TOPLAM</td><td>${h.toplamSira}</td><td></td><td></td><td><b>${nf(h.toplamKutu)}</b></td></tr>
      </tbody></table>
      <p class="kucuk-yazi ince">Palet (toplam ${nf(h.toplamKutu)} kutu)</p>
      ${paletTablosu(h)}
      <div class="ts-ort"><span>Toplam kutu</span><b>≈ ${nf(h.toplamKutu)}</b></div>
    </div>`;
  }

  function hasatHtml(y, ay, sid) {
    const liste = R.donemKayitlari('tahminler', y, ay, sid).filter(S.tahminGecerli).slice().reverse();
    const hes = liste.map((t) => ({ t, h: S.tahminHesapla(t) }));
    const son = hes[0];
    return `
      ${A.yard.beklemeBandi(sid, bugun())}
      <section class="ozet-satir">
        <div class="ozet-kutu"><b>${liste.length}</b><span>Tahmin</span></div>
        <div class="ozet-kutu"><b>${son ? nf(son.h.toplamKutu) : '–'}</b><span>Son tahmin kutu</span></div>
        <div class="ozet-kutu"><b>${son ? nf(son.h.paletler[0], 1) : '–'}</b><span>Euro 13 boy palet</span></div>
      </section>
      <div class="satir-btn">
        <button class="btn birincil" data-df="hasat-ekle">${ikon('arti')} Tahmin yap</button>
        <button class="btn" data-df="hasat-excel">${ikon('excel')} Excel</button>
      </div>
      ${
        liste.length
          ? hes
              .map(
                ({ t, h }) => `<section class="panel kayit-grup">
              <button class="tahmin-kart" data-df="hasat-duzenle" data-id="${t.id}">
                <div class="grup-ust"><b>${S.trTarih(t.tarih)} · ${esc(R.seraAdi(t.seraId))}</b><span><b>${nf(h.toplamKutu)}</b> kutu</span></div>
                <div class="tahmin-sektorler">${h.birimler.map((x) => `<span><b>${esc(x.no)}</b> ${nf(x.toplamKutu)}</span>`).join('')}</div>
                <small class="ince">Euro palet 13/14/15 boy: ${h.paletler.slice(0, 3).map((p) => nf(p, 1)).join(' / ')} · Büyük: ${h.paletler.slice(3).map((p) => nf(p, 1)).join(' / ')} · kutuda ${h.alt}+${h.ust}=${h.kutuSalkim} salkım</small>
              </button></section>`
              )
              .join('')
          : `<p class="ince orta">Bu dönemde hasat tahmini yok. “Tahmin yap” ile her sektörde 2 sırada 1. kalite salkımları sayarak başlayın.</p>`
      }`;
  }

  function hasatFormu(kayit) {
    const yeni = !kayit || !S.tahminGecerli(kayit);
    const dz = S.d.ayarlar.tahminDizilim || {};
    const f = !yeni
      ? JSON.parse(JSON.stringify(kayit))
      : {
          tarih: ui.tarih || bugun(),
          seraId: ui.defterSera || ui.seraId || (S.d.seralar[0] || {}).id,
          birimler: {},
          alt: typeof dz.alt === 'number' ? dz.alt : 5,
          ust: typeof dz.ust === 'number' ? dz.ust : 3,
          not: '',
        };
    if (!yeni && kayit) f.id = kayit.id;
    sayfaAc(
      yeni ? 'Hasat tahmini' : 'Tahmini düzenle',
      `<div class="iki">
         <label class="alan-blok"><span>Tarih</span><input type="date" id="t-tarih" value="${f.tarih}"></label>
         <label class="alan-blok"><span>Sera</span><select id="t-sera">${seraSecenekleri(f.seraId)}</select></label>
       </div>
       <div id="t-uyari"></div>
       <p class="kucuk-yazi ince">Her sektörde 2 sıraya girip <b>1. kalite salkım</b> sayısını yazın. Sıra sayısı güncel bitki sayımından gelir.</p>
       <div class="kisi-cipler" id="t-sek-cip"></div>
       <div id="t-sektorler"></div>
       <div class="alan-blok"><span>Kutu dizilimi – <b id="t-kutu-salkim"></b></span>
         <div class="dizilim2">
           <div><small>Alt kat</small><div class="cip-liste" id="t-alt">${S.ALT_KATLAR.map((u) => `<button type="button" class="cip" data-k="${u}">${u}</button>`).join('')}</div></div>
           <div><small>Üst kat</small><div class="cip-liste" id="t-ust">${S.UST_KATLAR.map((u) => `<button type="button" class="cip" data-k="${u}">${u}</button>`).join('')}</div></div>
         </div></div>
       <label class="alan-blok"><span>Not</span><input id="t-not" value="${esc(f.not || '')}"></label>
       <div id="t-sonuc"></div>
       <button class="btn birincil genis" id="t-kaydet">Kaydet</button>
       ${yeni ? '' : '<button class="btn tehlike genis" id="t-sil">Sil</button>'}`,
      (g) => {
        const sektorKur = () => {
          const l = S.hasatBirimleri(f.seraId);
          $('#t-sektorler', g).innerHTML = l.length
            ? l
                .map((b) => {
                  const v = (f.birimler || {})[b.harf] || { sayimlar: ['', ''] };
                  const say = v.sayimlar.length >= 2 ? v.sayimlar : v.sayimlar.concat(['', '']).slice(0, 2);
                  const ss = S.hasatSiraSayisi(f.seraId, b.harf);
                  const sira = !yeni && v.sira ? v.sira : ss.sira;
                  return `<div class="t-sektor" id="ts-${b.harf}" data-harf="${b.harf}" data-sira="${sira}">
                    <div class="t-sektor-ust"><b>Sektör ${esc(b.no)}</b><small>${sira} sıra${!yeni && v.sira ? ' (kayıttaki)' : ss.kaynak ? ' (' + S.trTarih(ss.kaynak).slice(0, 5) + ' sayımı)' : ''}</small><span class="t-sek-sonuc"></span></div>
                    <div class="t-sayimlar">${say
                      .map((n, i) => `<label><small>${i + 1}. sıra</small><input data-i="${i}" inputmode="numeric" placeholder="salkım" value="${n === null || n === undefined ? '' : esc(String(n))}"></label>`)
                      .join('')}<button type="button" class="btn kucuk t-ekle" data-ekle="${b.harf}" aria-label="Sıra ekle">${ikon('arti')}</button></div>
                  </div>`;
                })
                .join('')
            : '<p class="ince">Bu seranın sektörleri yok. Sera adı SERA 1 / SERA 2 olmalı.</p>';
        };
        const oku = () => {
          f.tarih = $('#t-tarih', g).value || bugun();
          f.not = $('#t-not', g).value.trim();
          const y2 = {};
          $$('.t-sektor', g).forEach((el) => {
            const sayimlar = $$('input', el).map((i) => S.sayi(i.value)).filter((n) => n !== null);
            if (sayimlar.length) y2[el.dataset.harf] = { sayimlar, sira: +el.dataset.sira };
          });
          f.birimler = y2;
        };
        const yenile = () => {
          oku();
          const h = S.tahminHesapla(f);
          $$('.t-sektor', g).forEach((el) => {
            const x = h.birimler.find((b) => b.harf === el.dataset.harf);
            $('.t-sek-sonuc', el).innerHTML = x ? `ort ${S.sayiYaz(x.ort)} → ${S.sayiYaz(x.kutuSira)} kutu/sıra → <b>${nf(x.toplamKutu)}</b> kutu · ${nf(x.paletler[0], 1)} euro palet` : '';
            el.classList.toggle('dolu', !!x);
          });
          $('#t-sek-cip', g).innerHTML = S.hasatBirimleri(f.seraId)
            .map((b) => `<button type="button" class="cip ${f.birimler[b.harf] ? 'aktif' : ''}" data-git="${b.harf}">${esc(b.no)}${f.birimler[b.harf] ? ' ✓' : ''}</button>`)
            .join('');
          $$('#t-alt .cip', g).forEach((b) => b.classList.toggle('aktif', +b.dataset.k === f.alt));
          $$('#t-ust .cip', g).forEach((b) => b.classList.toggle('aktif', +b.dataset.k === f.ust));
          $('#t-kutu-salkim', g).textContent = `kutuda ${f.alt} + ${f.ust} = ${f.alt + f.ust} salkım`;
          $('#t-sonuc', g).innerHTML = sonucHtml(h);
          const l = S.beklemeUyarilari(f.seraId, f.tarih);
          $('#t-uyari', g).innerHTML = l.length
            ? `<div class="bekleme-bant">${ikon('uyari')}<div><b>İlaç bekleme süresi dolmadı!</b>${l
                .map((il) => `<span>${esc(il.ilac)} – ${S.trTarih(S.uygunTarih(il))} tarihinden itibaren hasat</span>`)
                .join('')}</div></div>`
            : '';
        };
        sektorKur();
        yenile();
        $('#t-sektorler', g).addEventListener('input', yenile);
        $('#t-sektorler', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-ekle]');
          if (!b) return;
          const kap = $('.t-sayimlar', b.closest('.t-sektor'));
          const n = $$('input', kap).length;
          const lbl = document.createElement('label');
          lbl.innerHTML = `<small>${n + 1}. sıra</small><input data-i="${n}" inputmode="numeric" placeholder="salkım">`;
          kap.insertBefore(lbl, b);
          $('input', lbl).focus();
        });
        $('#t-sek-cip', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-git]');
          if (!b) return;
          const el = $('#ts-' + b.dataset.git, g);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            const bos = $$('input', el).find((i) => !i.value) || $('input', el);
            bos && bos.focus();
          }, 300);
        });
        const katSec = (id, alan) =>
          $(id, g).addEventListener('click', (e) => {
            const b = e.target.closest('[data-k]');
            if (!b) return;
            f[alan] = +b.dataset.k;
            yenile();
          });
        katSec('#t-alt', 'alt');
        katSec('#t-ust', 'ust');
        $('#t-sera', g).addEventListener('change', (e) => {
          oku();
          f.seraId = e.target.value;
          f.birimler = {};
          sektorKur();
          yenile();
        });
        ['#t-tarih', '#t-not'].forEach((sel) => $(sel, g).addEventListener('input', yenile));
        $('#t-tarih', g).addEventListener('change', yenile);
        $('#t-kaydet', g).onclick = () => {
          yenile();
          if (!Object.keys(f.birimler).length) return toast('En az bir sektöre sıra sayımı girin');
          S.d.ayarlar.tahminDizilim = { alt: f.alt, ust: f.ust };
          delete f.sektorler;
          S.kayitKaydet('tahminler', f);
          ui.ay = f.tarih.slice(0, 7);
          toast('Tahmin kaydedildi');
          sayfaKapat();
          ciz();
        };
        const sil = $('#t-sil', g);
        if (sil)
          sil.onclick = () => {
            if (!confirm('Bu tahmin silinsin mi?')) return;
            S.kayitSil('tahminler', f.id);
            sayfaKapat();
            ciz();
          };
      }
    );
  }

  // ---------- DRENAJ ÖLÇÜMÜ ----------
  const VANA_ALANLAR = [
    ['drip', 'Drip sayısı', 'numeric'],
    ['dripSu', 'Drip başına su (ml)', 'numeric'],
    ['drenSu', 'Drene edilen su (ml)', 'numeric'],
    ['drenEc', 'Drenaj EC', 'decimal'],
    ['drenPh', 'Drenaj pH', 'decimal'],
    ['dripEc', 'Drip EC', 'decimal'],
    ['dripPh', 'Drip pH', 'decimal'],
  ];
  const yuzde = (o) => (o === null || o === undefined ? '–' : '%' + (Math.round(o * 1000) / 10).toLocaleString('tr-TR'));
  const vanaSayisi = () => S.d.ayarlar.vanaSayisi || 10;

  function drenajHtml(y, ay) {
    const on = `${y}-${String(ay + 1).padStart(2, '0')}`;
    const l = S.d.drenajlar.filter((x) => x.tarih.startsWith(on));
    const gunler = Array.from(new Set(l.map((x) => x.tarih))).sort().reverse();
    const hepsi = l.map((x) => S.drenajOzet(x));
    const ort = (f) => {
      const v = hepsi.map(f).filter((n) => n !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const bugunAra = S.drenajBul(bugun(), 'ara');
    const bugunSon = S.drenajBul(bugun(), 'gunsonu');
    return `
      <section class="ozet-satir">
        <div class="ozet-kutu"><b>${gunler.length}</b><span>Ölçüm günü</span></div>
        <div class="ozet-kutu"><b>${yuzde(ort((x) => x.oran))}</b><span>Ort. drenaj</span></div>
        <div class="ozet-kutu"><b>${nf(ort((x) => x.drenEc), 2)}</b><span>Ort. drenaj EC</span></div>
        <div class="ozet-kutu"><b>${nf(ort((x) => x.drenPh), 2)}</b><span>Ort. drenaj pH</span></div>
      </section>
      <div class="satir-btn uc-btn">
        <button class="btn ${bugunAra ? '' : 'birincil'}" data-df="dren-ac" data-tur="ara">${bugunAra ? '✓ ' : ''}Ara ölçüm</button>
        <button class="btn ${bugunSon ? '' : 'birincil'}" data-df="dren-ac" data-tur="gunsonu">${bugunSon ? '✓ ' : ''}Gün sonu</button>
        <button class="btn" data-df="dren-excel-ay">${ikon('excel')} Ay</button>
      </div>
      ${
        gunler.length
          ? gunler
              .map((t) => {
                const kayitlar = ['ara', 'gunsonu'].map((tur) => S.drenajBul(t, tur));
                return `<section class="panel kayit-grup">
                  <div class="grup-ust"><b>${S.trTarih(t)} ${S.GUNLER[S.strTarih(t).getDay()]}</b></div>
                  <ul class="kayit-liste">${kayitlar
                    .map((k, i) => {
                      const tur = i ? 'gunsonu' : 'ara';
                      if (!k) return `<li><button data-df="dren-ac" data-tur="${tur}" data-tarih="${t}"><span class="k-sol"><b>${S.DRENAJ_TURLERI[tur]}</b><small>girilmedi – eklemek için dokunun</small></span></button></li>`;
                      const o = S.drenajOzet(k);
                      return `<li class="dren-li"><button data-df="dren-ac" data-tur="${tur}" data-tarih="${t}"><span class="k-sol"><b>${S.DRENAJ_TURLERI[tur]}${k.saat ? ' · ' + esc(k.saat) : ''}</b><small>${o.vana} vana · drenaj EC ${nf(o.drenEc, 2)} pH ${nf(o.drenPh, 2)} · drip EC ${nf(o.dripEc, 2)} pH ${nf(o.dripPh, 2)}</small></span><span class="k-sag"><b>${yuzde(o.oran)}</b><small>drenaj</small></span></button><button class="dren-xl" data-df="dren-excel" data-tur="${tur}" data-tarih="${t}" aria-label="${S.DRENAJ_TURLERI[tur]} Excel">${ikon('excel')}<small>Excel</small></button></li>`;
                    })
                    .join('')}</ul></section>`;
              })
              .join('')
          : '<p class="ince orta">Bu ay drenaj ölçümü yok. “Ara ölçüm” veya “Gün sonu” ile başlayın.</p>'
      }`;
  }

  // Ara ölçüm ve gün sonu ekibe ayrı gönderildiği için her ölçümün kendi dosyası var
  function drenajExcel(t, tur) {
    if (!S.drenajBul(t, tur)) return toast(`${S.trTarih(t)} için ${S.DRENAJ_TURLERI[tur]} girilmemiş`);
    return calis('Drenaj', async () =>
      dosyaHazir(await R.blob(await R.drenajRaporu(t, tur)), `DRENAJ ÖLÇÜM FORMU ${S.trTarih(t)} ${tur === 'ara' ? 'ARA ÖLÇÜM' : 'GÜN SONU'}.xlsx`)
    );
  }

  function drenajFormu(tarih, tur) {
    const varolan = S.drenajBul(tarih, tur);
    const f = varolan ? JSON.parse(JSON.stringify(varolan)) : { tarih, tur, saat: new Date().toTimeString().slice(0, 5), vanalar: {}, not: '' };
    let vana = 1;
    const vs = vanaSayisi();
    const dripVar = S.d.ayarlar.dripSayisi || 5;
    sayfaAc(
      'Drenaj ölçümü',
      `<div class="iki">
         <label class="alan-blok"><span>Tarih</span><input type="date" id="d-tarih" value="${f.tarih}"></label>
         <label class="alan-blok"><span>Saat</span><input type="time" id="d-saat" value="${esc(f.saat || '')}"></label>
       </div>
       <div class="seg genis-seg" id="d-tur"><button type="button" data-v="ara">Ara ölçüm</button><button type="button" data-v="gunsonu">Gün sonu</button></div>
       <div class="kisi-cipler vana-cipler" id="d-vanalar"></div>
       <div class="vana-kart" id="d-kart"></div>
       <div id="d-ozet"></div>
       <label class="alan-blok"><span>Not</span><input id="d-not" value="${esc(f.not || '')}"></label>
       <button class="btn birincil genis" id="d-kaydet">${ikon('excel')} Kaydet ve Excel'i al</button>
       ${varolan ? `<button class="btn genis" id="d-excel">${ikon('excel')} Kayıtlı ölçümün Excel'i</button><button class="btn tehlike genis" id="d-sil">Bu ölçümü sil</button>` : ''}`,
      (g) => {
        const kartKaydet = () => {
          const v = {};
          $$('#d-kart input', g).forEach((i) => {
            const n = S.sayi(i.value);
            if (n !== null) v[i.dataset.f] = n;
          });
          if (Object.keys(v).some((k) => k !== 'drip')) f.vanalar[vana] = v;
          else delete f.vanalar[vana];
        };
        const ozet = () => {
          $('#d-vanalar', g).innerHTML = Array.from({ length: vs }, (_, i) => i + 1)
            .map((n) => `<button type="button" class="cip ${n === vana ? 'aktif' : ''} ${f.vanalar[n] ? 'tamam' : ''}" data-vana="${n}">Vana ${n}${f.vanalar[n] ? ' ✓' : ''}</button>`)
            .join('');
          const satir = Array.from({ length: vs }, (_, i) => i + 1)
            .map((n) => {
              const v = f.vanalar[n];
              if (!v) return '';
              return `<tr><td>${n}</td><td><b>${yuzde(S.drenajOrani(v))}</b></td><td>${nf(v.drenEc, 2)}</td><td>${nf(v.drenPh, 2)}</td><td>${nf(v.dripEc, 2)}</td><td>${nf(v.dripPh, 2)}</td></tr>`;
            })
            .join('');
          const o = S.drenajOzet(f);
          $('#d-ozet', g).innerHTML = satir
            ? `<table class="ts-tablo dren-tablo"><thead><tr><th>Vana</th><th>Drenaj</th><th>Dr. EC</th><th>Dr. pH</th><th>Drip EC</th><th>Drip pH</th></tr></thead><tbody>${satir}
               <tr class="ts-toplam"><td>Ort.</td><td>${yuzde(o.oran)}</td><td>${nf(o.drenEc, 2)}</td><td>${nf(o.drenPh, 2)}</td><td>${nf(o.dripEc, 2)}</td><td>${nf(o.dripPh, 2)}</td></tr></tbody></table>`
            : '';
          $$('#d-tur button', g).forEach((b) => b.classList.toggle('sec', b.dataset.v === f.tur));
        };
        const kartCanli = () => {
          const v = {};
          $$('#d-kart input', g).forEach((i) => (v[i.dataset.f] = S.sayi(i.value)));
          const o = S.drenajOrani(v);
          const fark = v.drenEc !== null && v.dripEc !== null ? v.drenEc - v.dripEc : null;
          $('#d-canli', g).innerHTML = `Drenaj oranı <b>${yuzde(o)}</b>${fark !== null ? ` · EC farkı (drenaj − drip) <b>${(fark > 0 ? '+' : '') + nf(fark, 2)}</b>` : ''}`;
        };
        const kartCiz = () => {
          const v = f.vanalar[vana] || {};
          $('#d-kart', g).innerHTML = `<p class="h-baslik"><b>Vana ${vana}</b></p>
            <div class="vana-alanlar">${VANA_ALANLAR.map(
              ([k, ad, im]) => `<label class="alan-blok"><span>${ad}</span><input data-f="${k}" inputmode="${im}" value="${v[k] !== undefined ? esc(S.sayiYaz(v[k])) : k === 'drip' ? dripVar : ''}"></label>`
            ).join('')}</div>
            <p class="ince" id="d-canli"></p>
            <button type="button" class="btn genis" id="d-sonraki">${vana < vs ? 'Sonraki vana ›' : 'Vanalar bitti'}</button>`;
          kartCanli();
          $('#d-sonraki', g).onclick = () => {
            kartKaydet();
            if (vana < vs) vana++;
            kartCiz();
            ozet();
            const ilk = $$('#d-kart input', g).find((i) => i.dataset.f === 'dripSu');
            ilk && ilk.focus();
          };
        };
        $('#d-kart', g).addEventListener('input', kartCanli);
        $('#d-vanalar', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-vana]');
          if (!b) return;
          kartKaydet();
          vana = +b.dataset.vana;
          kartCiz();
          ozet();
        });
        $('#d-tur', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b || b.dataset.v === f.tur) return;
          kartKaydet();
          const t = $('#d-tarih', g).value || f.tarih;
          if (S.drenajBul(t, b.dataset.v) && !confirm(`${S.trTarih(t)} için ${S.DRENAJ_TURLERI[b.dataset.v]} kaydı zaten var. O kaydı açmak ister misiniz? (Bu formdaki değişiklikler kaydedilmez.)`)) return;
          if (S.drenajBul(t, b.dataset.v)) return drenajFormu(t, b.dataset.v);
          f.tur = b.dataset.v;
          ozet();
        });
        kartCiz();
        ozet();
        $('#d-kaydet', g).onclick = () => {
          kartKaydet();
          f.tarih = $('#d-tarih', g).value || f.tarih;
          f.saat = $('#d-saat', g).value;
          f.not = $('#d-not', g).value.trim();
          if (!Object.keys(f.vanalar).length) return toast('En az bir vanaya ölçüm girin');
          const ayni = S.drenajBul(f.tarih, f.tur);
          if (ayni && ayni.id !== f.id) {
            if (!confirm(`${S.trTarih(f.tarih)} ${S.DRENAJ_TURLERI[f.tur]} kaydı zaten var. Üzerine yazılsın mı?`)) return;
            S.kayitSil('drenajlar', ayni.id);
          }
          const d0 = Object.values(f.vanalar).map((v) => v.drip).find((n) => n);
          if (d0) S.d.ayarlar.dripSayisi = d0;
          S.kayitKaydet('drenajlar', f);
          ui.ay = f.tarih.slice(0, 7);
          toast('Drenaj ölçümü kaydedildi');
          sayfaKapat();
          ciz();
          drenajExcel(f.tarih, f.tur);
        };
        const xl = $('#d-excel', g);
        if (xl) xl.onclick = () => drenajExcel(varolan.tarih, varolan.tur);
        const sil = $('#d-sil', g);
        if (sil)
          sil.onclick = () => {
            if (!confirm('Bu drenaj ölçümü silinsin mi?')) return;
            S.kayitSil('drenajlar', f.id);
            sayfaKapat();
            ciz();
          };
      }
    );
  }

  // ---------- İLAÇLAMA ----------
  function ilacHtml(y, ay, sid) {
    const liste = R.donemKayitlari('ilaclamalar', y, ay, sid).slice().reverse();
    const aktif = S.beklemeUyarilari(sid, bugun());
    return `
      ${
        aktif.length
          ? `<section class="panel bekleme-panel"><h2>${ikon('uyari')} Bekleme süresi devam eden ilaçlamalar</h2><ul class="liste">${aktif
              .map((il) => {
                const kalan = Math.round((S.strTarih(S.uygunTarih(il)) - S.strTarih(bugun())) / 86400000);
                return `<li><span><b>${esc(R.seraAdi(il.seraId))}</b> · ${esc(il.ilac)}<br><small>${S.trTarih(il.tarih)} uygulandı</small></span><span class="sag"><b class="kirmizi">${kalan} gün</b><small>${S.trTarih(S.uygunTarih(il))}'den itibaren hasat</small></span></li>`;
              })
              .join('')}</ul></section>`
          : `<div class="tamam-bant">${ikon('tik')} Bugün ${sid ? esc(R.seraAdi(sid)) + ' için' : 'hiçbir serada'} bekleme süresi devam eden ilaçlama yok – hasat yapılabilir.</div>`
      }
      <div class="satir-btn">
        <button class="btn birincil" data-df="ilac-ekle">${ikon('arti')} İlaçlama ekle</button>
        <button class="btn" data-df="ilac-excel">${ikon('excel')} Excel</button>
      </div>
      ${
        liste.length
          ? `<section class="panel"><ul class="kayit-liste">${liste
              .map(
                (il) => `<li><button data-df="ilac-duzenle" data-id="${il.id}">
              <span class="k-sol"><b>${esc(il.ilac || 'İlaç')}</b><small>${S.trTarih(il.tarih)} · ${esc(R.seraAdi(il.seraId))}${il.hedef ? ' · ' + esc(il.hedef) : ''}</small><small>${esc([il.doz, il.uygulayan].filter(Boolean).join(' · '))}</small></span>
              <span class="k-sag">${S.sayi(il.bekleme) ? `<b>${S.sayiYaz(S.sayi(il.bekleme))} gün</b><small>hasat: ${S.trTarih(S.uygunTarih(il))}</small>` : '<small>bekleme yok</small>'}</span>
            </button></li>`
              )
              .join('')}</ul></section>`
          : `<p class="ince orta">Bu dönemde ilaçlama kaydı yok.</p>`
      }`;
  }

  function ilacFormu(il) {
    const yeni = !il;
    il = il || {
      tarih: ui.tarih || bugun(),
      seraId: ui.defterSera || ui.seraId || '',
      ilac: '',
      etken: '',
      hedef: '',
      uygulama: 'PÜSKÜRTME',
      doz: '',
      su: '',
      miktar: '',
      uygulayan: '',
      bekleme: '',
      not: '',
    };
    const katalog = S.ilacKatalogu();
    const kisiler = S.d.personel.filter((p) => p.aktif).map((p) => p.ad);
    sayfaAc(
      yeni ? 'İlaçlama ekle' : 'İlaçlamayı düzenle',
      `<div class="iki">
         <label class="alan-blok"><span>Tarih</span><input type="date" id="i-tarih" value="${il.tarih}"></label>
         <label class="alan-blok"><span>Sera</span><select id="i-sera">${seraSecenekleri(il.seraId, 'Tüm seralar')}</select></label>
       </div>
       <label class="alan-blok"><span>İlaç (ticari adı)</span><input id="i-ilac" list="dl-ilac" value="${esc(il.ilac)}" autocapitalize="characters" placeholder="Daha önce kullanılanlar otomatik dolar"></label>
       <label class="alan-blok"><span>Etken madde</span><input id="i-etken" value="${esc(il.etken)}"></label>
       <label class="alan-blok"><span>Hedef zararlı / hastalık</span><input id="i-hedef" list="dl-hedef" value="${esc(il.hedef)}"></label>
       <div class="iki">
         <label class="alan-blok"><span>Uygulama şekli</span><input id="i-uygulama" list="dl-uyg" value="${esc(il.uygulama)}"></label>
         <label class="alan-blok"><span>Doz</span><input id="i-doz" value="${esc(il.doz)}" placeholder="ör. 50 ml/100 L"></label>
       </div>
       <div class="iki">
         <label class="alan-blok"><span>Su miktarı (L)</span><input id="i-su" inputmode="decimal" value="${esc(S.sayiYaz(S.sayi(il.su)))}"></label>
         <label class="alan-blok"><span>Kullanılan ilaç</span><input id="i-miktar" value="${esc(il.miktar)}" placeholder="ör. 500 ml"></label>
       </div>
       <div class="iki">
         <label class="alan-blok"><span>Uygulayan</span><input id="i-uygulayan" list="dl-kisi" value="${esc(il.uygulayan)}"></label>
         <label class="alan-blok"><span>Bekleme süresi (gün)</span><input id="i-bekleme" inputmode="numeric" value="${esc(S.sayiYaz(S.sayi(il.bekleme)))}"></label>
       </div>
       <p class="ince" id="i-ipucu"></p>
       <label class="alan-blok"><span>Not</span><input id="i-not" value="${esc(il.not)}"></label>
       <button class="btn birincil genis" id="i-kaydet">Kaydet</button>
       ${yeni ? '' : '<button class="btn tehlike genis" id="i-sil">Sil</button>'}
       ${datalist('dl-ilac', Object.keys(katalog))}
       ${datalist('dl-hedef', S.HEDEFLER.concat(S.d.ilaclamalar.map((x) => x.hedef)))}
       ${datalist('dl-uyg', S.UYGULAMALAR)}
       ${datalist('dl-kisi', kisiler.concat(S.d.ilaclamalar.map((x) => x.uygulayan)))}
       <p class="ince">Bekleme süresi (son ilaçlama ile hasat arası gün) ilacın etiketinde yazar. Girilirse, süre dolana kadar Günlük ve Hasat ekranlarında uyarı gösterilir.</p>`,
      (g) => {
        const ipucu = () => {
          const b = S.sayi($('#i-bekleme', g).value);
          const t = $('#i-tarih', g).value;
          $('#i-ipucu', g).innerHTML = b && t ? `Hasat için uygun tarih: <b>${S.trTarih(S.gunEkle(t, b))}</b>` : '';
        };
        ipucu();
        ['#i-bekleme', '#i-tarih'].forEach((s) => $(s, g).addEventListener('input', ipucu));
        $('#i-tarih', g).addEventListener('change', ipucu);
        $('#i-ilac', g).addEventListener('change', (e) => {
          const k = katalog[S.trUpper(e.target.value.trim())];
          if (!k) return;
          [['#i-etken', 'etken'], ['#i-hedef', 'hedef'], ['#i-uygulama', 'uygulama'], ['#i-doz', 'doz'], ['#i-bekleme', 'bekleme']].forEach(([s, f]) => {
            const el = $(s, g);
            if (!el.value && k[f] !== undefined && k[f] !== null) el.value = f === 'bekleme' ? S.sayiYaz(S.sayi(k[f])) : k[f];
          });
          ipucu();
        });
        $('#i-kaydet', g).onclick = () => {
          const ilac = S.trUpper($('#i-ilac', g).value.trim());
          if (!ilac) return toast('İlaç adını girin');
          S.kayitKaydet('ilaclamalar', {
            id: il.id,
            tarih: $('#i-tarih', g).value || bugun(),
            seraId: $('#i-sera', g).value || null,
            ilac,
            etken: S.trUpper($('#i-etken', g).value.trim()),
            hedef: S.trUpper($('#i-hedef', g).value.trim()),
            uygulama: S.trUpper($('#i-uygulama', g).value.trim()),
            doz: $('#i-doz', g).value.trim(),
            su: S.sayi($('#i-su', g).value),
            miktar: $('#i-miktar', g).value.trim(),
            uygulayan: S.trUpper($('#i-uygulayan', g).value.trim()),
            bekleme: S.sayi($('#i-bekleme', g).value),
            not: $('#i-not', g).value.trim(),
          });
          ui.ay = ($('#i-tarih', g).value || bugun()).slice(0, 7);
          toast('İlaçlama kaydedildi');
          sayfaKapat();
          ciz();
        };
        const sil = $('#i-sil', g);
        if (sil)
          sil.onclick = () => {
            if (!confirm('Bu ilaçlama kaydı silinsin mi?')) return;
            S.kayitSil('ilaclamalar', il.id);
            sayfaKapat();
            ciz();
          };
      }
    );
  }

  // ---------- Olaylar ----------
  function excel(tur) {
    const [y, m] = ui.ay.split('-').map(Number);
    const sid = ui.defterSera || null;
    calis('Rapor', async () => {
      const wb = tur === 'hasat' ? await R.hasatTahminRaporu(y, m - 1, sid) : await R.ilaclamaRaporu(y, m - 1, sid);
      dosyaHazir(await R.blob(wb), `${S.AYLAR[m - 1]} ${y} ${R.seraAdi(sid)} ${tur === 'hasat' ? 'HASAT MİKTARI HESAPLAMA' : 'İLAÇLAMA KAYITLARI'}.xlsx`);
    });
  }

  $('#ekran').addEventListener('click', (e) => {
    if (ui.sekme !== 'defter') return;
    const b = e.target.closest('[data-df]');
    if (!b) return;
    if (window.Plan.olay(b)) return;
    switch (b.dataset.df) {
      case 'sekme':
        ui.defter = b.dataset.v;
        try {
          localStorage.setItem('seraotomasyon.defter', ui.defter);
        } catch (err) {}
        return ciz();
      case 'hasat-ekle':
        return hasatFormu(null);
      case 'hasat-duzenle':
        return hasatFormu(S.d.tahminler.find((x) => x.id === b.dataset.id));
      case 'ilac-ekle':
        return ilacFormu(null);
      case 'ilac-duzenle':
        return ilacFormu(Object.assign({}, S.d.ilaclamalar.find((x) => x.id === b.dataset.id)));
      case 'hasat-excel':
        return excel('hasat');
      case 'dren-ac':
        return drenajFormu(b.dataset.tarih || bugun(), b.dataset.tur);
      case 'dren-excel':
        return drenajExcel(b.dataset.tarih, b.dataset.tur);
      case 'dren-excel-ay':
        return calis('Drenaj', async () => {
          const [yy, mm] = ui.ay.split('-').map(Number);
          dosyaHazir(await R.blob(await R.drenajAylik(yy, mm - 1)), `${S.AYLAR[mm - 1]} ${yy} DRENAJ ÖLÇÜMLERİ.xlsx`);
        });
      case 'ilac-excel':
        return excel('ilac');
    }
  });
  $('#ekran').addEventListener('change', (e) => {
    if (ui.sekme !== 'defter') return;
    const el = e.target;
    if (el.dataset.df === 'ay' && el.value) {
      ui.ay = el.value;
      ciz();
    } else if (el.dataset.df === 'sera') {
      ui.defterSera = el.value;
      ciz();
    }
  });

  A.ekranlar.defter = ciz;
  A.drenajExcel = drenajExcel;
})();
