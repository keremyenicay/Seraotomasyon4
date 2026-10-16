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
  // Kutu: alt kata 6, üst kata 3/4/5 domates → kutu başı 9/10/11
  function dizilimMetni(d) {
    return `${d.adet}'${d.adet === 9 ? 'lu' : d.adet === 10 ? 'lu' : d.adet === 11 ? 'li' : 'lik'}`;
  }
  function sonucHtml(h) {
    if (h.toplam === null)
      return `<div class="tahmin-sonuc bos-sonuc">Sonuç için örnek sayım ve sıra sayısı${h.carpan ? '' : ' (ve bitki/sıra)'} girin.</div>`;
    return `<div class="tahmin-sonuc">
      <div class="ts-ust"><span>Ortalama <b>${S.sayiYaz(h.ort)}</b> meyve (${h.sayimSayisi} örnek)</span><span>Toplam ≈ <b>${h.toplam.toLocaleString('tr-TR')}</b> meyve</span></div>
      <table class="ts-tablo"><tbody>${h.dizilimler
        .map((d) => `<tr><td>Alt ${h.alt} + üst ${d.ust}</td><td>${d.adet} adet/kutu</td><td><b>${d.kutu.toLocaleString('tr-TR')}</b> kutu</td></tr>`)
        .join('')}</tbody></table>
      <div class="ts-ort"><span>Ortalama çıkacak kutu</span><b>≈ ${h.ortKutu.toLocaleString('tr-TR')}</b></div>
    </div>`;
  }

  function hasatHtml(y, ay, sid) {
    const liste = R.donemKayitlari('tahminler', y, ay, sid).slice().reverse();
    const hes = liste.map((t) => ({ t, h: S.tahminHesapla(t) }));
    const topKutu = hes.reduce((a, x) => a + (x.h.ortKutu || 0), 0);
    const topMeyve = hes.reduce((a, x) => a + (x.h.toplam || 0), 0);
    const gunler = {};
    hes.forEach((x) => (gunler[x.t.tarih] = gunler[x.t.tarih] || []).push(x));
    return `
      ${A.yard.beklemeBandi(sid, bugun())}
      <section class="ozet-satir">
        <div class="ozet-kutu"><b>${liste.length}</b><span>Tahmin</span></div>
        <div class="ozet-kutu"><b>${topMeyve.toLocaleString('tr-TR')}</b><span>Toplam meyve</span></div>
        <div class="ozet-kutu"><b>${topKutu.toLocaleString('tr-TR')}</b><span>Ortalama kutu</span></div>
      </section>
      <div class="satir-btn">
        <button class="btn birincil" data-df="hasat-ekle">${ikon('arti')} Tahmin yap</button>
        <button class="btn" data-df="hasat-excel">${ikon('excel')} Excel</button>
      </div>
      ${
        liste.length
          ? Object.entries(gunler)
              .map(
                ([t, xs]) => `<section class="panel kayit-grup">
              <div class="grup-ust"><b>${S.trTarih(t)} ${S.GUNLER[S.strTarih(t).getDay()]}</b><span>≈ ${xs.reduce((a, x) => a + (x.h.ortKutu || 0), 0).toLocaleString('tr-TR')} kutu</span></div>
              <ul class="kayit-liste">${xs
                .map(
                  ({ t: k, h }) => `<li><button data-df="hasat-duzenle" data-id="${k.id}">
                  <span class="k-sol"><b>${esc(R.seraAdi(k.seraId))}</b><small>Ort. ${S.sayiYaz(h.ort)} meyve/${k.birim === 'sira' ? 'sıra' : 'bitki'} · ${k.toplamBitki ? Number(k.toplamBitki).toLocaleString('tr-TR') + ' bitki (sayım)' : S.sayiYaz(S.sayi(k.siraSayisi)) + ' sıra' + (k.birim === 'sira' ? '' : ' × ' + S.sayiYaz(S.sayi(k.bitkiSira)) + ' bitki')}${S.sayi(k.fire) ? ' · fire %' + S.sayiYaz(S.sayi(k.fire)) : ''}</small>
                  <small>${h.dizilimler.map((d) => `${dizilimMetni(d)} ${d.kutu === null ? '–' : d.kutu.toLocaleString('tr-TR')}`).join(' · ')}</small></span>
                  <span class="k-sag"><b>≈ ${h.ortKutu === null ? '–' : h.ortKutu.toLocaleString('tr-TR')}</b><small>kutu</small></span>
                </button></li>`
                )
                .join('')}</ul></section>`
              )
              .join('')
          : `<p class="ince orta">Bu dönemde hasat tahmini yok. “Tahmin yap” ile örnek bitkilerde hasada hazır domatesleri sayarak başlayın.</p>`
      }`;
  }

  function hasatFormu(kayit) {
    const yeni = !kayit;
    const seraId = (kayit && kayit.seraId) || ui.defterSera || ui.seraId || (S.d.seralar[0] || {}).id;
    const sera = S.sera(seraId) || {};
    const f = kayit
      ? JSON.parse(JSON.stringify(kayit))
      : {
          tarih: ui.tarih || bugun(),
          seraId,
          birim: sera.tahminBirim || 'bitki',
          sayimlar: [],
          siraSayisi: sera.siraSayisi || S.seraSiraToplami(seraId),
          bitkiSira: sera.bitkiSira || null,
          altKat: 6,
          ustKatlar: S.UST_KATLAR.slice(),
          fire: 0,
          not: '',
        };
    const UST_SECENEK = [2, 3, 4, 5, 6];
    sayfaAc(
      yeni ? 'Hasat tahmini' : 'Tahmini düzenle',
      `<div class="iki">
         <label class="alan-blok"><span>Tarih</span><input type="date" id="t-tarih" value="${f.tarih}"></label>
         <label class="alan-blok"><span>Sera</span><select id="t-sera">${seraSecenekleri(f.seraId)}</select></label>
       </div>
       <div id="t-uyari"></div>
       <div class="alan-blok"><span>Sayım birimi</span>
         <div class="seg genis-seg" id="t-birim">
           <button type="button" data-v="bitki">Bitki başına</button>
           <button type="button" data-v="sira">Sıra başına</button>
         </div></div>
       <div class="alan-blok"><span id="t-sayim-etiket"></span>
         <div class="satir"><input id="t-sayim" inputmode="numeric" placeholder="ör. 12 (veya 10 12 8)"><button type="button" class="btn" id="t-sayim-ekle">Ekle</button></div>
         <div class="cip-liste" id="t-sayimlar"></div>
       </div>
       <div id="t-sayimdan"></div>
       <div class="iki" id="t-sira-kap">
         <label class="alan-blok"><span>Sıra sayısı</span><input id="t-sira" inputmode="decimal" value="${esc(S.sayiYaz(S.sayi(f.siraSayisi)))}"></label>
         <label class="alan-blok" id="t-bitki-kap"><span>Sıradaki bitki sayısı</span><input id="t-bitki" inputmode="numeric" value="${esc(S.sayiYaz(S.sayi(f.bitkiSira)))}"></label>
       </div>
       <div class="alan-blok"><span>Kutu dizilimi</span>
         <div class="dizilim">
           <label>Alt kat <input id="t-alt" inputmode="numeric" value="${esc(S.sayiYaz(S.sayi(f.altKat) || 6))}"></label>
           <div><small>Üst kat</small><div class="cip-liste" id="t-ust">${UST_SECENEK.map((u) => `<button type="button" class="cip" data-u="${u}">${u}'${u === 3 || u === 4 ? 'lü' : u === 6 ? 'lı' : u === 2 ? 'li' : 'li'}</button>`).join('')}</div></div>
         </div></div>
       <div class="iki">
         <label class="alan-blok"><span>Fire / kayıp %</span><input id="t-fire" inputmode="decimal" value="${esc(S.sayiYaz(S.sayi(f.fire) || 0))}"></label>
         <label class="alan-blok"><span>Not</span><input id="t-not" value="${esc(f.not || '')}"></label>
       </div>
       <div id="t-sonuc"></div>
       <button class="btn birincil genis" id="t-kaydet">Kaydet</button>
       ${yeni ? '' : '<button class="btn tehlike genis" id="t-sil">Sil</button>'}`,
      (g) => {
        const yenile = () => {
          f.tarih = $('#t-tarih', g).value || bugun();
          f.seraId = $('#t-sera', g).value;
          f.siraSayisi = S.sayi($('#t-sira', g).value);
          f.bitkiSira = S.sayi($('#t-bitki', g).value);
          f.altKat = S.sayi($('#t-alt', g).value) || 6;
          f.fire = S.sayi($('#t-fire', g).value) || 0;
          f.not = $('#t-not', g).value.trim();
          $$('#t-birim button', g).forEach((b) => b.classList.toggle('sec', b.dataset.v === f.birim));
          // Bitki sayımı varsa toplam bitkiyi oradan al
          const sayimVar = f.birim === 'bitki' && S.sonSayim(f.seraId);
          const sk = S.d.sektorler.filter((x) => x.seraId === f.seraId);
          const kutu = $('#t-sayimdan', g);
          if (!sayimVar) {
            kutu.innerHTML = '';
            f.toplamBitki = null;
          } else {
            if (f.sayimdan === undefined) f.sayimdan = true;
            const harfler = f.sektorHarf ? f.sektorHarf.split(',') : null;
            const top = S.seraBitkiToplami(f.seraId, harfler);
            f.toplamBitki = f.sayimdan ? top : null;
            if (!kutu.dataset.kuruldu || kutu.dataset.sera !== f.seraId) {
              kutu.innerHTML = `<label class="onay"><input type="checkbox" id="t-sayim-bitki" ${f.sayimdan ? 'checked' : ''}> <span>Bitki sayımındaki bitki sayısını kullan</span></label>
                <label class="alan-blok" id="t-sektor-kap"><span>Kapsam</span><select id="t-sektor"><option value="">Tüm sera</option>${sk
                  .map((x) => `<option value="${x.harfler.join(',')}" ${f.sektorHarf === x.harfler.join(',') ? 'selected' : ''}>Sektör ${esc(x.no)}</option>`)
                  .join('')}</select></label><p class="ince" id="t-bitki-bilgi"></p>`;
              kutu.dataset.kuruldu = '1';
              kutu.dataset.sera = f.seraId;
              $('#t-sayim-bitki', g).onchange = (e) => {
                f.sayimdan = e.target.checked;
                yenile();
              };
              $('#t-sektor', g).onchange = (e) => {
                f.sektorHarf = e.target.value || null;
                yenile();
              };
            }
            $('#t-sektor-kap', g).hidden = !f.sayimdan;
            const sy = S.sonSayim(f.seraId);
            $('#t-bitki-bilgi', g).innerHTML = f.sayimdan ? `<b>${(top || 0).toLocaleString('tr-TR')}</b> bitki (sayım ${S.trTarih(sy.tarih)})` : '';
          }
          $('#t-sira-kap', g).hidden = !!f.toplamBitki;
          $('#t-bitki-kap', g).hidden = f.birim === 'sira';
          $('#t-sayim-etiket', g).textContent =
            f.birim === 'sira' ? 'Örnek sayımlar – bir sıradaki hasada hazır domates' : 'Örnek sayımlar – bir bitkideki hasada hazır domates';
          $('#t-sayimlar', g).innerHTML = f.sayimlar.length
            ? f.sayimlar.map((n, i) => `<button type="button" class="cip sayim" data-i="${i}">${S.sayiYaz(n)} ✕</button>`).join('')
            : '<small class="ince">Henüz sayım yok. Seradan rastgele birkaç örnek sayın.</small>';
          $$('#t-ust .cip', g).forEach((b) => b.classList.toggle('aktif', f.ustKatlar.includes(+b.dataset.u)));
          $('#t-sonuc', g).innerHTML = sonucHtml(S.tahminHesapla(f));
          const l = S.beklemeUyarilari(f.seraId, f.tarih);
          $('#t-uyari', g).innerHTML = l.length
            ? `<div class="bekleme-bant">${ikon('uyari')}<div><b>İlaç bekleme süresi dolmadı!</b>${l
                .map((il) => `<span>${esc(il.ilac)} – ${S.trTarih(S.uygunTarih(il))} tarihinden itibaren hasat</span>`)
                .join('')}</div></div>`
            : '';
        };
        const sayimEkle = () => {
          const v = $('#t-sayim', g).value;
          // "10 12 8", "10,12,8" veya "10; 12" — "7,5" ondalık kabul edilir
          v.trim()
            .split(/[\s;]+/)
            .flatMap((x) => (/^\d+(,\d+)+$/.test(x) && !/^\d+,5$/.test(x) ? x.split(',') : [x]))
            .map(S.sayi)
            .filter((n) => n !== null && n >= 0)
            .forEach((n) => f.sayimlar.push(n));
          $('#t-sayim', g).value = '';
          $('#t-sayim', g).focus();
          yenile();
        };
        $('#t-sayim-ekle', g).onclick = sayimEkle;
        $('#t-sayim', g).addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sayimEkle();
          }
        });
        $('#t-sayimlar', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-i]');
          if (!b) return;
          f.sayimlar.splice(+b.dataset.i, 1);
          yenile();
        });
        $('#t-birim', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b) return;
          f.birim = b.dataset.v;
          yenile();
        });
        $('#t-ust', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-u]');
          if (!b) return;
          const u = +b.dataset.u;
          f.ustKatlar = f.ustKatlar.includes(u) ? f.ustKatlar.filter((x) => x !== u) : f.ustKatlar.concat(u).sort((a, c) => a - c);
          if (!f.ustKatlar.length) f.ustKatlar = [u];
          yenile();
        });
        $('#t-sera', g).addEventListener('change', () => {
          const s2 = S.sera($('#t-sera', g).value) || {};
          if (yeni) {
            $('#t-sira', g).value = S.sayiYaz(s2.siraSayisi || S.seraSiraToplami(s2.id));
            $('#t-bitki', g).value = S.sayiYaz(s2.bitkiSira);
          }
          yenile();
        });
        ['#t-tarih', '#t-sira', '#t-bitki', '#t-alt', '#t-fire', '#t-not'].forEach((sel) => $(sel, g).addEventListener('input', yenile));
        $('#t-tarih', g).addEventListener('change', yenile);
        yenile();

        $('#t-kaydet', g).onclick = () => {
          if ($('#t-sayim', g).value.trim()) sayimEkle();
          yenile();
          if (!f.sayimlar.length) return toast('En az bir örnek sayım girin');
          if (!f.toplamBitki && !f.siraSayisi) return toast('Sıra sayısını girin');
          if (!f.toplamBitki && f.birim === 'bitki' && !f.bitkiSira) return toast('Sıradaki bitki sayısını girin');
          const s2 = S.sera(f.seraId);
          if (s2) {
            s2.siraSayisi = f.siraSayisi;
            if (f.bitkiSira) s2.bitkiSira = f.bitkiSira;
            s2.tahminBirim = f.birim;
          }
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
