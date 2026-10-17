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
        <button role="tab" class="${ui.defter === 'hasat' ? 'sec geldi' : ''}" data-df="sekme" data-v="hasat">${ikon('hasat')} Hasat Tahmini</button>
        <button role="tab" class="${ui.defter === 'ilac' ? 'sec geldi' : ''}" data-df="sekme" data-v="ilac">${ikon('ilac')} İlaçlama</button>
      </div>
      <div class="filtre">
        <label class="alan-blok"><span>Ay</span><input type="month" data-df="ay" value="${ui.ay}"></label>
        <label class="alan-blok"><span>Sera</span><select data-df="sera">${seraSecenekleri(ui.defterSera, 'Tüm seralar')}</select></label>
      </div>
      ${ui.defter === 'hasat' ? hasatHtml(y, m - 1, sid) : ilacHtml(y, m - 1, sid)}`;
  }

  // ---------- HASAT TAHMİNİ ----------
  // Her sektörde 2 sıraya girilip hasada hazır salkım sayılır; sektörün sıra sayısıyla çarpılır.
  // Kutu başı salkım = alt kat + üst kat (seçilen tüm kombinasyonlar).
  const nf = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('tr-TR'));
  const sekAd = (no) => 'Sektör ' + no;

  function seraSektorleri(seraId) {
    return S.sektorleriHazirla().filter((x) => x.seraId === seraId);
  }

  function sonucHtml(h) {
    if (!h.sektorler.length) return `<div class="tahmin-sonuc bos-sonuc">Sonuç için en az bir sektöre sıra sayımı girin.</div>`;
    const kombHucre = (alt, ust) => {
      const k = h.kombinasyonlar.find((x) => x.alt === alt && x.ust === ust);
      return k ? `<td><small>${alt}+${ust}=${k.adet}</small><b>${nf(k.kutu)}</b></td>` : '<td></td>';
    };
    return `<div class="tahmin-sonuc">
      <table class="ts-tablo ts-sektor"><thead><tr><th>Sektör</th><th>Sıra</th><th>Ort.</th><th>Salkım</th><th>≈ Kutu</th></tr></thead><tbody>
        ${h.sektorler.map((x) => `<tr><td>${esc(x.no)}</td><td>${x.sira}</td><td>${S.sayiYaz(x.ort)}</td><td>${nf(x.salkim)}</td><td><b>${nf(x.ortKutu)}</b></td></tr>`).join('')}
        <tr class="ts-toplam"><td>TOPLAM</td><td>${h.sektorler.reduce((a, x) => a + x.sira, 0)}</td><td></td><td>${nf(h.toplam)}</td><td><b>${nf(h.ortKutu)}</b></td></tr>
      </tbody></table>
      <p class="kucuk-yazi ince">Kutu kombinasyonları (toplam için) – satır: alt kat, sütun: üst kat</p>
      <table class="ts-tablo ts-komb"><thead><tr><th></th>${h.ustler.map((u) => `<th>Üst ${u}</th>`).join('')}</tr></thead><tbody>
        ${h.altlar.map((alt) => `<tr><th>Alt ${alt}</th>${h.ustler.map((u) => kombHucre(alt, u)).join('')}</tr>`).join('')}
      </tbody></table>
      <div class="ts-ort"><span>Ortalama çıkacak kutu</span><b>≈ ${nf(h.ortKutu)}</b></div>
    </div>`;
  }

  function hasatHtml(y, ay, sid) {
    const liste = R.donemKayitlari('tahminler', y, ay, sid)
      .filter((t) => t.sektorler)
      .slice()
      .reverse();
    const hes = liste.map((t) => ({ t, h: S.tahminHesapla(t) }));
    const topKutu = hes.reduce((a, x) => a + (x.h.ortKutu || 0), 0);
    const topSalkim = hes.reduce((a, x) => a + (x.h.toplam || 0), 0);
    return `
      ${A.yard.beklemeBandi(sid, bugun())}
      <section class="ozet-satir">
        <div class="ozet-kutu"><b>${liste.length}</b><span>Tahmin</span></div>
        <div class="ozet-kutu"><b>${nf(topSalkim)}</b><span>Toplam salkım</span></div>
        <div class="ozet-kutu"><b>${nf(topKutu)}</b><span>Ortalama kutu</span></div>
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
                <div class="grup-ust"><b>${S.trTarih(t.tarih)} · ${esc(R.seraAdi(t.seraId))}</b><span>≈ <b>${nf(h.ortKutu)}</b> kutu</span></div>
                <div class="tahmin-sektorler">${h.sektorler
                  .map((x) => `<span><b>${esc(x.no)}</b> ${nf(x.ortKutu)}</span>`)
                  .join('')}</div>
                <small class="ince">${nf(h.toplam)} salkım · ${h.sektorler.length} sektör · alt ${h.altlar.join('/')} + üst ${h.ustler.join('/')}${h.fire ? ' · fire %' + S.sayiYaz(h.fire) : ''}</small>
              </button></section>`
              )
              .join('')
          : `<p class="ince orta">Bu dönemde hasat tahmini yok. “Tahmin yap” ile her sektörde 2 sırada hasada hazır salkımları sayarak başlayın.</p>`
      }`;
  }

  function hasatFormu(kayit) {
    const yeni = !kayit;
    const dz = S.d.ayarlar.tahminDizilim || {};
    const f = kayit
      ? JSON.parse(JSON.stringify(kayit))
      : {
          tarih: ui.tarih || bugun(),
          seraId: ui.defterSera || ui.seraId || (S.d.seralar[0] || {}).id,
          sektorler: {},
          altKatlar: (dz.alt || [6]).slice(),
          ustKatlar: (dz.ust || S.UST_KATLAR).slice(),
          fire: 0,
          not: '',
        };
    f.sektorler = f.sektorler || {};
    sayfaAc(
      yeni ? 'Hasat tahmini' : 'Tahmini düzenle',
      `<div class="iki">
         <label class="alan-blok"><span>Tarih</span><input type="date" id="t-tarih" value="${f.tarih}"></label>
         <label class="alan-blok"><span>Sera</span><select id="t-sera">${seraSecenekleri(f.seraId)}</select></label>
       </div>
       <div id="t-uyari"></div>
       <p class="kucuk-yazi ince">Her sektörde 2 sıraya girip <b>hasada hazır salkım</b> sayısını yazın. Sektörün sıra sayısı şemadan alınır.</p>
       <div class="kisi-cipler" id="t-sek-cip"></div>
       <div id="t-sektorler"></div>
       <div class="alan-blok"><span>Kutu dizilimi (kutu başı salkım = alt + üst)</span>
         <div class="dizilim2">
           <div><small>Alt kat</small><div class="cip-liste" id="t-alt">${S.ALT_KATLAR.map((u) => `<button type="button" class="cip" data-k="${u}">${u}'${u === 4 ? 'lü' : u === 5 ? 'li' : 'lı'}</button>`).join('')}</div></div>
           <div><small>Üst kat</small><div class="cip-liste" id="t-ust">${S.UST_KATLAR.map((u) => `<button type="button" class="cip" data-k="${u}">${u}'${u === 3 || u === 4 ? 'lü' : 'li'}</button>`).join('')}</div></div>
         </div></div>
       <div class="iki">
         <label class="alan-blok"><span>Fire / kayıp %</span><input id="t-fire" inputmode="decimal" value="${esc(S.sayiYaz(S.sayi(f.fire) || 0))}"></label>
         <label class="alan-blok"><span>Not</span><input id="t-not" value="${esc(f.not || '')}"></label>
       </div>
       <div id="t-sonuc"></div>
       <button class="btn birincil genis" id="t-kaydet">Kaydet</button>
       ${yeni ? '' : '<button class="btn tehlike genis" id="t-sil">Sil</button>'}`,
      (g) => {
        const sektorKur = () => {
          const l = seraSektorleri(f.seraId);
          $('#t-sektorler', g).innerHTML = l.length
            ? l
                .map((sk) => {
                  const v = f.sektorler[sk.id] || { sayimlar: ['', ''] };
                  const say = v.sayimlar.length >= 2 ? v.sayimlar : v.sayimlar.concat(['', '']).slice(0, 2);
                  return `<div class="t-sektor" id="ts-${sk.id}" data-sk="${sk.id}">
                    <div class="t-sektor-ust"><b>${sekAd(esc(sk.no))}</b><small>${S.sektorSiraSayisi(sk)} sıra</small><span class="t-sek-sonuc"></span></div>
                    <div class="t-sayimlar">${say
                      .map((n, i) => `<label><small>${i + 1}. sıra</small><input data-i="${i}" inputmode="numeric" placeholder="salkım" value="${n === null || n === undefined ? '' : esc(String(n))}"></label>`)
                      .join('')}<button type="button" class="btn kucuk t-ekle" data-ekle="${sk.id}" aria-label="Sıra ekle">${ikon('arti')}</button></div>
                  </div>`;
                })
                .join('')
            : '<p class="ince">Bu seranın sektörleri yok. Harita › Sera İçi açıldığında sektörler oluşur (sera adı SERA 1 / SERA 2 olmalı).</p>';
        };
        const oku = () => {
          f.tarih = $('#t-tarih', g).value || bugun();
          f.fire = S.sayi($('#t-fire', g).value) || 0;
          f.not = $('#t-not', g).value.trim();
          const yeniSek = {};
          $$('.t-sektor', g).forEach((el) => {
            const sayimlar = $$('input', el).map((i) => S.sayi(i.value)).filter((n) => n !== null);
            const sk = S.d.sektorler.find((x) => x.id === el.dataset.sk);
            if (sayimlar.length) yeniSek[el.dataset.sk] = { sayimlar, sira: S.sektorSiraSayisi(sk) };
          });
          f.sektorler = yeniSek;
        };
        const yenile = () => {
          oku();
          const h = S.tahminHesapla(f);
          $$('.t-sektor', g).forEach((el) => {
            const x = h.sektorler.find((s2) => s2.skId === el.dataset.sk);
            $('.t-sek-sonuc', el).innerHTML = x ? `ort ${S.sayiYaz(x.ort)} → ${nf(x.salkim)} salkım · ≈ <b>${nf(x.ortKutu)}</b> kutu` : '';
            el.classList.toggle('dolu', !!x);
          });
          $('#t-sek-cip', g).innerHTML = seraSektorleri(f.seraId)
            .map((sk) => `<button type="button" class="cip ${f.sektorler[sk.id] ? 'aktif' : ''}" data-git="${sk.id}">${esc(sk.no)}${f.sektorler[sk.id] ? ' ✓' : ''}</button>`)
            .join('');
          $$('#t-alt .cip', g).forEach((b) => b.classList.toggle('aktif', f.altKatlar.includes(+b.dataset.k)));
          $$('#t-ust .cip', g).forEach((b) => b.classList.toggle('aktif', f.ustKatlar.includes(+b.dataset.k)));
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
            const k = +b.dataset.k;
            f[alan] = f[alan].includes(k) ? f[alan].filter((x) => x !== k) : f[alan].concat(k).sort((a, c) => a - c);
            if (!f[alan].length) f[alan] = [k];
            yenile();
          });
        katSec('#t-alt', 'altKatlar');
        katSec('#t-ust', 'ustKatlar');
        $('#t-sera', g).addEventListener('change', (e) => {
          oku();
          f.seraId = e.target.value;
          f.sektorler = {};
          sektorKur();
          yenile();
        });
        ['#t-tarih', '#t-fire', '#t-not'].forEach((sel) => $(sel, g).addEventListener('input', yenile));
        $('#t-tarih', g).addEventListener('change', yenile);

        $('#t-kaydet', g).onclick = () => {
          yenile();
          if (!Object.keys(f.sektorler).length) return toast('En az bir sektöre sıra sayımı girin');
          S.d.ayarlar.tahminDizilim = { alt: f.altKatlar.slice(), ust: f.ustKatlar.slice() };
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
      dosyaHazir(await R.blob(wb), `${S.AYLAR[m - 1]} ${y} ${R.seraAdi(sid)} ${tur === 'hasat' ? 'HASAT TAHMİNİ' : 'İLAÇLAMA KAYITLARI'}.xlsx`);
    });
  }

  $('#ekran').addEventListener('click', (e) => {
    if (ui.sekme !== 'defter') return;
    const b = e.target.closest('[data-df]');
    if (!b) return;
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
})();
