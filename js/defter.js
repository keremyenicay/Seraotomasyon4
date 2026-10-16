/* Sera Otomasyon – Defter: hasat ve ilaçlama kayıtları */
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
  function sonDegerler(alan) {
    const say = {};
    S.d.hasatlar.forEach((h) => h[alan] && (say[S.trUpper(h[alan])] = (say[S.trUpper(h[alan])] || 0) + 1));
    return Object.keys(say).sort((a, b) => say[b] - say[a]);
  }
  function tlYaz(n) {
    return Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // =====================================================================
  function ciz() {
    const ekran = $('#ekran');
    if (!S.d.seralar.length) {
      ekran.innerHTML = `<div class="bos"><div class="bos-ikon">${ikon('defter')}</div><h2>Önce sera ekleyin</h2>
        <p>Hasat ve ilaçlama kayıtları seralara bağlıdır. Personel sekmesinden sera ekleyin veya Excel'den içe aktarın.</p></div>`;
      return;
    }
    const [y, m] = ui.ay.split('-').map(Number);
    const sid = ui.defterSera || null;
    ekran.innerHTML = `
      <h1 class="baslik">Sera Defteri</h1>
      <div class="seg genis-seg" role="tablist">
        <button role="tab" class="${ui.defter === 'hasat' ? 'sec geldi' : ''}" data-df="sekme" data-v="hasat">${ikon('hasat')} Hasat</button>
        <button role="tab" class="${ui.defter === 'ilac' ? 'sec geldi' : ''}" data-df="sekme" data-v="ilac">${ikon('ilac')} İlaçlama</button>
      </div>
      <div class="filtre">
        <label class="alan-blok"><span>Ay</span><input type="month" data-df="ay" value="${ui.ay}"></label>
        <label class="alan-blok"><span>Sera</span><select data-df="sera">${seraSecenekleri(ui.defterSera, 'Tüm seralar')}</select></label>
      </div>
      ${ui.defter === 'hasat' ? hasatHtml(y, m - 1, sid) : ilacHtml(y, m - 1, sid)}`;
  }

  // ---------- HASAT ----------
  function hasatHtml(y, ay, sid) {
    const liste = R.donemKayitlari('hasatlar', y, ay, sid).slice().reverse();
    const kg = liste.reduce((t, h) => t + (S.sayi(h.kg) || 0), 0);
    const kasa = liste.reduce((t, h) => t + (S.sayi(h.kasa) || 0), 0);
    const tutar = liste.reduce((t, h) => t + (S.sayi(h.kg) || 0) * (S.sayi(h.fiyat) || 0), 0);
    const bugunBekleme = A.yard.beklemeBandi(sid, bugun());
    const gunler = {};
    liste.forEach((h) => (gunler[h.tarih] = gunler[h.tarih] || []).push(h));
    return `
      ${bugunBekleme}
      <section class="ozet-satir">
        <div class="ozet-kutu"><b>${S.sayiYaz(Math.round(kg * 10) / 10)}</b><span>Toplam kg</span></div>
        <div class="ozet-kutu"><b>${S.sayiYaz(kasa)}</b><span>Kasa</span></div>
        <div class="ozet-kutu"><b>${kasa ? S.sayiYaz(Math.round((kg / kasa) * 10) / 10) : '–'}</b><span>Ort. kg/kasa</span></div>
        <div class="ozet-kutu"><b>${tutar ? tlYaz(Math.round(tutar)) : '–'}</b><span>Tutar ₺</span></div>
      </section>
      <div class="satir-btn">
        <button class="btn birincil" data-df="hasat-ekle">${ikon('arti')} Hasat ekle</button>
        <button class="btn" data-df="hasat-excel">${ikon('excel')} Excel</button>
      </div>
      ${
        Object.keys(gunler).length
          ? Object.entries(gunler)
              .map(([t, hs]) => {
                const gkg = hs.reduce((a, h) => a + (S.sayi(h.kg) || 0), 0);
                const gkasa = hs.reduce((a, h) => a + (S.sayi(h.kasa) || 0), 0);
                return `<section class="panel kayit-grup">
              <div class="grup-ust"><b>${S.trTarih(t)} ${S.GUNLER[S.strTarih(t).getDay()]}</b><span>${S.sayiYaz(Math.round(gkg * 10) / 10)} kg · ${S.sayiYaz(gkasa)} kasa</span></div>
              <ul class="kayit-liste">${hs
                .map(
                  (h) => `<li><button data-df="hasat-duzenle" data-id="${h.id}">
                  <span class="k-sol"><b>${esc(R.seraAdi(h.seraId))} · ${esc(h.urun || 'Ürün')}</b><small>${esc([h.sinif, h.alici, h.not].filter(Boolean).join(' · '))}</small></span>
                  <span class="k-sag"><b>${S.sayiYaz(S.sayi(h.kg))} kg</b><small>${S.sayi(h.kasa) !== null ? S.sayiYaz(S.sayi(h.kasa)) + ' kasa' : ''}${S.sayi(h.fiyat) !== null ? ' · ' + S.sayiYaz(S.sayi(h.fiyat)) + ' ₺/kg' : ''}</small></span>
                </button></li>`
                )
                .join('')}</ul></section>`;
              })
              .join('')
          : `<p class="ince orta">Bu dönemde hasat kaydı yok.</p>`
      }`;
  }

  function hasatFormu(h) {
    const yeni = !h;
    const son = S.d.hasatlar[S.d.hasatlar.length - 1] || {};
    h = h || {
      tarih: ui.tarih || bugun(),
      seraId: ui.defterSera || ui.seraId || (S.d.seralar[0] || {}).id,
      urun: son.urun || '',
      sinif: '1. SINIF',
      kasa: '',
      kg: '',
      alici: son.alici || '',
      fiyat: '',
      not: '',
    };
    sayfaAc(
      yeni ? 'Hasat ekle' : 'Hasatı düzenle',
      `<div class="iki">
         <label class="alan-blok"><span>Tarih</span><input type="date" id="h-tarih" value="${h.tarih}"></label>
         <label class="alan-blok"><span>Sera</span><select id="h-sera">${seraSecenekleri(h.seraId)}</select></label>
       </div>
       <div id="h-uyari"></div>
       <label class="alan-blok"><span>Ürün / çeşit</span><input id="h-urun" list="dl-urun" value="${esc(h.urun)}" placeholder="ör. DOMATES, CHERRY" autocapitalize="characters"></label>
       <label class="alan-blok"><span>Sınıf</span><input id="h-sinif" list="dl-sinif" value="${esc(h.sinif)}"></label>
       <div class="iki">
         <label class="alan-blok"><span>Kasa</span><input id="h-kasa" inputmode="decimal" value="${esc(S.sayiYaz(S.sayi(h.kasa)))}"></label>
         <label class="alan-blok"><span>Kg</span><input id="h-kg" inputmode="decimal" value="${esc(S.sayiYaz(S.sayi(h.kg)))}"></label>
       </div>
       <p class="ince" id="h-ipucu"></p>
       <div class="iki">
         <label class="alan-blok"><span>Alıcı / yer (opsiyonel)</span><input id="h-alici" list="dl-alici" value="${esc(h.alici)}"></label>
         <label class="alan-blok"><span>Fiyat ₺/kg (opsiyonel)</span><input id="h-fiyat" inputmode="decimal" value="${esc(S.sayiYaz(S.sayi(h.fiyat)))}"></label>
       </div>
       <label class="alan-blok"><span>Not</span><input id="h-not" value="${esc(h.not)}"></label>
       <button class="btn birincil genis" id="h-kaydet">Kaydet</button>
       ${yeni ? '<button class="btn genis" id="h-kaydet-yeni">Kaydet ve yeni ekle</button>' : '<button class="btn tehlike genis" id="h-sil">Sil</button>'}
       ${datalist('dl-urun', sonDegerler('urun').concat(['DOMATES', 'CHERRY DOMATES', 'SALKIM DOMATES', 'BİBER', 'SALATALIK', 'PATLICAN']))}
       ${datalist('dl-sinif', S.SINIFLAR.concat(sonDegerler('sinif')))}
       ${datalist('dl-alici', sonDegerler('alici'))}`,
      (g) => {
        const uyar = () => {
          const l = S.beklemeUyarilari($('#h-sera', g).value, $('#h-tarih', g).value);
          $('#h-uyari', g).innerHTML = l.length
            ? `<div class="bekleme-bant">${ikon('uyari')}<div><b>Dikkat: bekleme süresi dolmadı!</b>${l
                .map((il) => `<span>${esc(il.ilac)} – ${S.trTarih(il.tarih)} uygulandı, ${S.trTarih(S.uygunTarih(il))} tarihinden itibaren hasat</span>`)
                .join('')}</div></div>`
            : '';
          return l.length;
        };
        const ipucu = () => {
          const kasa = S.sayi($('#h-kasa', g).value);
          const kg = S.sayi($('#h-kg', g).value);
          const fiyat = S.sayi($('#h-fiyat', g).value);
          const p = [];
          if (kasa && kg) p.push(`Ortalama ${S.sayiYaz(Math.round((kg / kasa) * 100) / 100)} kg/kasa`);
          if (kg && fiyat) p.push(`Tutar ${tlYaz(kg * fiyat)} ₺`);
          if (kasa && !kg) {
            const ort = ortalamaKgKasa($('#h-urun', g).value);
            if (ort) p.push(`Bu ürünün ortalaması ${S.sayiYaz(ort)} kg/kasa → tahmini ${S.sayiYaz(Math.round(kasa * ort))} kg`);
          }
          $('#h-ipucu', g).textContent = p.join(' · ');
        };
        uyar();
        ipucu();
        ['#h-sera', '#h-tarih'].forEach((s) => $(s, g).addEventListener('change', uyar));
        ['#h-kasa', '#h-kg', '#h-fiyat', '#h-urun'].forEach((s) => $(s, g).addEventListener('input', ipucu));
        const kaydet = (devam) => {
          const veri = {
            id: h.id,
            tarih: $('#h-tarih', g).value || bugun(),
            seraId: $('#h-sera', g).value,
            urun: S.trUpper($('#h-urun', g).value.trim()),
            sinif: S.trUpper($('#h-sinif', g).value.trim()),
            kasa: S.sayi($('#h-kasa', g).value),
            kg: S.sayi($('#h-kg', g).value),
            alici: S.trUpper($('#h-alici', g).value.trim()),
            fiyat: S.sayi($('#h-fiyat', g).value),
            not: $('#h-not', g).value.trim(),
          };
          if (veri.kg === null && veri.kasa === null) return toast('Kasa veya kg girin');
          if (veri.kg === null && veri.kasa) {
            const ort = ortalamaKgKasa(veri.urun);
            if (ort && confirm(`Kg girilmedi. Ortalamaya göre tahmini ${S.sayiYaz(Math.round(veri.kasa * ort))} kg yazılsın mı?`)) veri.kg = Math.round(veri.kasa * ort);
          }
          if (uyar() && !confirm('Bu serada ilaç bekleme süresi dolmamış. Yine de kaydedilsin mi?')) return;
          S.kayitKaydet('hasatlar', veri);
          ui.ay = veri.tarih.slice(0, 7);
          toast('Hasat kaydedildi');
          if (devam) {
            hasatFormu(null);
            $('#h-tarih').value = veri.tarih;
            $('#h-sera').value = veri.seraId;
          } else sayfaKapat();
          ciz();
        };
        $('#h-kaydet', g).onclick = () => kaydet(false);
        const ky = $('#h-kaydet-yeni', g);
        if (ky) ky.onclick = () => kaydet(true);
        const sil = $('#h-sil', g);
        if (sil)
          sil.onclick = () => {
            if (!confirm('Bu hasat kaydı silinsin mi?')) return;
            S.kayitSil('hasatlar', h.id);
            sayfaKapat();
            ciz();
          };
      }
    );
  }

  function ortalamaKgKasa(urun) {
    const u = S.trUpper(urun || '');
    const l = S.d.hasatlar.filter((h) => S.sayi(h.kasa) && S.sayi(h.kg) && (!u || S.trUpper(h.urun) === u));
    const kasa = l.reduce((t, h) => t + S.sayi(h.kasa), 0);
    const kg = l.reduce((t, h) => t + S.sayi(h.kg), 0);
    return kasa ? Math.round((kg / kasa) * 10) / 10 : null;
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
      const wb = tur === 'hasat' ? await R.hasatRaporu(y, m - 1, sid) : await R.ilaclamaRaporu(y, m - 1, sid);
      dosyaHazir(await R.blob(wb), `${S.AYLAR[m - 1]} ${y} ${R.seraAdi(sid)} ${tur === 'hasat' ? 'HASAT RAPORU' : 'İLAÇLAMA KAYITLARI'}.xlsx`);
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
        return hasatFormu(Object.assign({}, S.d.hasatlar.find((x) => x.id === b.dataset.id)));
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
