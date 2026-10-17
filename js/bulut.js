/* Sera Otomasyon – kullanıcı girişi ve Supabase senkronu
   Veriler önce telefona kaydedilir (store.js), internet olunca parça parça buluta gönderilir.
   Parça: her bölüm (seralar, personel, …) ve her günün kaydı ayrı satır. */
(function () {
  'use strict';
  const S = window.Store;
  const A = window.SeraApp;
  const AYAR = window.SERA_AYAR || {};
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const { esc, toast, sayfaAc } = A.yard;

  const giris = $('#giris');
  if (!AYAR.supabaseUrl || !AYAR.supabaseAnahtar || !window.supabase) {
    giris.remove();
    window.Bulut = { etkin: false };
    return;
  }

  const sb = window.supabase.createClient(AYAR.supabaseUrl, AYAR.supabaseAnahtar, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'seraotomasyon.oturum' },
  });

  const DURUM_KEY = 'seraotomasyon.bulut';
  const PROFIL_KEY = 'seraotomasyon.profil';
  const ESIK_SAAT = 30 * 1000; // çekerken saat farkı/yarış için geriye pay

  function oku(k, v) {
    try {
      return JSON.parse(localStorage.getItem(k)) || v;
    } catch (e) {
      return v;
    }
  }
  function yaz(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }

  // h: parça anahtarı → buluttaki son bilinen içeriğin özeti, sonCekim: en son çekilen güncelleme zamanı
  const sd = oku(DURUM_KEY, { h: {}, sonCekim: null, sonSenkron: null });
  const kaydetDurum = () => yaz(DURUM_KEY, sd);

  let oturum = null;
  let profil = oku(PROFIL_KEY, null);
  let kanal = null;
  let durum = 'bekliyor'; // tamam | gonderiliyor | cevrimdisi | hata
  let hataMetni = '';

  // ---------- Yardımcılar ----------
  function kullaniciAdi(s) {
    return S.trLower(s)
      .trim()
      .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
      .replace(/\s+/g, '.');
  }
  const eposta = (k) => kullaniciAdi(k) + '@sera.local';

  // Anahtar sırasından bağımsız JSON (jsonb anahtarları yeniden sıralar)
  function sirali(v) {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : sirali(x))).join(',') + ']';
    if (typeof v === 'object') {
      return (
        '{' +
        Object.keys(v)
          .filter((k) => v[k] !== undefined && typeof v[k] !== 'function')
          .sort()
          .map((k) => JSON.stringify(k) + ':' + sirali(v[k]))
          .join(',') +
        '}'
      );
    }
    return JSON.stringify(v);
  }
  function ozet(v) {
    const s = sirali(v);
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + ':' + s.length;
  }
  // Safari 6 haneli kesirli saniyeyi okuyamıyor
  const zaman = (s) => Date.parse(String(s).replace(/(\.\d{3})\d+/, '$1'));

  function hataAl(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Kullanıcı adı veya şifre hatalı';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'İnternet bağlantısı yok';
    return m;
  }

  // ---------- Senkron ----------
  // Tüm bulut işlemleri sırayla çalışır
  let kuyruk = Promise.resolve();
  const sirayla = (f) => (kuyruk = kuyruk.then(f, f).catch((e) => console.warn('Bulut', e)));

  function bekleyenler() {
    const p = S.parcalar();
    const liste = [];
    new Set(Object.keys(p).concat(Object.keys(sd.h))).forEach((k) => {
      const v = p[k] === undefined ? null : p[k];
      const hv = ozet(v);
      if (sd.h[k] === hv) return;
      if (v === null && sd.h[k] === undefined) return;
      liste.push({ anahtar: k, veri: v, _h: hv });
    });
    return liste;
  }

  function durumYaz(d, m) {
    durum = d;
    hataMetni = m || '';
    rozetCiz();
    const p = $('#bulut-durum');
    if (p) p.innerHTML = durumHtml();
  }

  async function gonder() {
    if (!oturum) return;
    if (!navigator.onLine) return durumYaz('cevrimdisi');
    const liste = bekleyenler();
    if (!liste.length) {
      if (durum !== 'hata') durumYaz('tamam');
      return;
    }
    durumYaz('gonderiliyor');
    for (let i = 0; i < liste.length; i += 40) {
      const parca = liste.slice(i, i + 40);
      const { error } = await sb.from('sera_veri').upsert(
        parca.map((x) => ({ anahtar: x.anahtar, veri: x.veri })),
        { onConflict: 'anahtar' }
      );
      if (error) {
        durumYaz(navigator.onLine ? 'hata' : 'cevrimdisi', hataAl(error));
        return;
      }
      parca.forEach((x) => (sd.h[x.anahtar] = x._h));
      kaydetDurum();
    }
    sd.sonSenkron = new Date().toISOString();
    kaydetDurum();
    durumYaz('tamam');
  }

  async function cek() {
    if (!oturum) return;
    if (!navigator.onLine) return durumYaz('cevrimdisi');
    const since = sd.sonCekim ? new Date(zaman(sd.sonCekim) - ESIK_SAAT).toISOString() : '1970-01-01T00:00:00Z';
    let p = null;
    let degisti = false;
    let enSon = sd.sonCekim;
    const SAYFA = 500;
    for (let bas = 0; ; bas += SAYFA) {
      const { data, error } = await sb
        .from('sera_veri')
        .select('anahtar,veri,guncelleme')
        .gt('guncelleme', since)
        .order('guncelleme')
        .order('anahtar')
        .range(bas, bas + SAYFA - 1);
      if (error) {
        durumYaz(navigator.onLine ? 'hata' : 'cevrimdisi', hataAl(error));
        return;
      }
      if (!p) p = S.parcalar();
      data.forEach((r) => {
        const k = r.anahtar;
        const hr = ozet(r.veri);
        const hl = ozet(p[k] === undefined ? null : p[k]);
        if (!enSon || zaman(r.guncelleme) > zaman(enSon)) enSon = r.guncelleme;
        if (hr === hl) {
          sd.h[k] = hr;
          return;
        }
        // Bu cihazda parça hiç senkronlanmadıysa ya da yerelde değişmediyse buluttaki geçerli;
        // yerelde gönderilmemiş değişiklik varsa yerel kalır ve gönderilir.
        if (sd.h[k] === undefined || sd.h[k] === hl) {
          S.parcaUygula(k, r.veri);
          p[k] = r.veri;
          sd.h[k] = hr;
          degisti = true;
        }
      });
      if (data.length < SAYFA) break;
    }
    sd.sonCekim = enSon;
    kaydetDurum();
    if (degisti) {
      S.parcalarBitti();
      yenidenCiz();
    }
  }

  const senkronla = () =>
    sirayla(async () => {
      if (!(await oturumTazele())) return;
      await cek();
      await gonder();
    });

  let gonderZ;
  S.kayitDinle(() => {
    if (!oturum) return;
    if (durum === 'tamam') durumYaz('gonderiliyor');
    clearTimeout(gonderZ);
    gonderZ = setTimeout(() => sirayla(gonder), 1500);
  });
  let cekZ;
  const cekPlanla = (ms) => {
    clearTimeout(cekZ);
    cekZ = setTimeout(() => sirayla(cek), ms);
  };

  // Başka telefondan gelen değişiklik: kullanıcı yazarken ya da haritadayken ekranı bozma
  let cizBekliyor = false;
  function yenidenCiz() {
    const odak = document.activeElement;
    const yaziyor = odak && odak.matches && odak.matches('input, textarea, select');
    if (yaziyor || !$('#katman').hidden || A.ui.sekme === 'harita') {
      cizBekliyor = true;
      return;
    }
    cizBekliyor = false;
    const y = window.scrollY;
    A.ciz();
    window.scrollTo(0, y);
    toast('Başka telefondan güncellendi');
  }
  setInterval(() => cizBekliyor && yenidenCiz(), 2000);

  function kanalAc() {
    if (kanal) return;
    kanal = sb
      .channel('sera_veri')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sera_veri' }, () => cekPlanla(800))
      .subscribe();
  }
  function kanalKapat() {
    if (kanal) sb.removeChannel(kanal);
    kanal = null;
  }

  window.addEventListener('online', senkronla);
  window.addEventListener('offline', () => durumYaz('cevrimdisi'));
  document.addEventListener('visibilitychange', () => {
    if (!oturum) return;
    if (document.visibilityState === 'visible') {
      senkronla();
      gorundum();
    } else sirayla(gonder);
  });
  setInterval(() => oturum && document.visibilityState === 'visible' && sirayla(cek), 60 * 1000);

  let sonGorundum = 0;
  function gorundum() {
    if (!oturum || !navigator.onLine || Date.now() - sonGorundum < 4 * 60 * 1000) return;
    sonGorundum = Date.now();
    sb.rpc('gorundum').then(() => {}, () => {});
  }
  setInterval(gorundum, 5 * 60 * 1000);

  // ---------- Oturum ----------
  const OTURUM_KEY = 'seraotomasyon.oturum';
  const kayitliOturum = () => oku(OTURUM_KEY, null);

  // Süresi dolmuş oturum çevrimdışıyken yenilenemez ama silinmez; internet gelince burada yenilenir
  async function oturumTazele() {
    if (!oturum || !navigator.onLine) return !!oturum;
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      oturum = data.session;
      return true;
    }
    if (!kayitliOturum()) {
      disari('Oturum sona erdi, tekrar giriş yapın.');
      return false;
    }
    return true;
  }

  async function profilGetir(kullanici) {
    const { data, error } = await sb.from('profiller').select('id,kullanici_adi,ad,rol,aktif').eq('id', kullanici.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function iceri(s) {
    oturum = s;
    giris.hidden = true;
    document.body.classList.remove('giris-acik');
    rozetCiz();
    kanalAc();
    gorundum();
    senkronla();
    A.ciz();
  }

  async function disari(mesaj) {
    oturum = null;
    kanalKapat();
    try {
      await sb.auth.signOut({ scope: 'local' });
    } catch (e) {}
    profil = null;
    localStorage.removeItem(PROFIL_KEY);
    rozetCiz();
    girisCiz(mesaj);
  }

  async function profilDogrula(kullanici) {
    const p = await profilGetir(kullanici);
    if (!p) throw new Error('Bu hesabın profili yok. Yöneticinize başvurun.');
    if (!p.aktif) throw new Error('Hesabınız devre dışı. Yöneticinize başvurun.');
    profil = p;
    yaz(PROFIL_KEY, p);
    return p;
  }

  async function basla() {
    // Süresi dolmuş oturumu yenilemeye çalışırken ağ yoksa getSession uzun süre bekleyebilir
    const bekle = (ms) => new Promise((coz) => setTimeout(() => coz({ data: null }), ms));
    const { data } = navigator.onLine ? await Promise.race([sb.auth.getSession(), bekle(4000)]) : { data: null };
    const s = data && data.session;
    if (!s) {
      // Oturum duruyor ama yenilenemedi (internet yok): telefonda çalışmaya devam et
      const k = kayitliOturum();
      if (k && k.refresh_token && profil) return iceri(k);
      return girisCiz();
    }
    if (navigator.onLine) {
      try {
        await profilDogrula(s.user);
      } catch (e) {
        // İnternet sorunu değilse (hesap kapatılmış vb.) çıkış yap
        if (!/fetch|network|load failed/i.test(e.message || '')) return disari(hataAl(e));
      }
    }
    if (!profil) profil = { id: s.user.id, kullanici_adi: (s.user.email || '').split('@')[0], ad: (s.user.email || '').split('@')[0], rol: 'personel' };
    iceri(s);
  }

  sb.auth.onAuthStateChange((olay, s) => {
    if (olay === 'TOKEN_REFRESHED' && s) oturum = s;
    if (olay === 'SIGNED_OUT' && oturum) disari('Oturum sona erdi, tekrar giriş yapın.');
  });

  // ---------- Giriş ekranı ----------
  async function girisCiz(mesaj) {
    giris.hidden = false;
    document.body.classList.add('giris-acik');
    let kurulum = true;
    if (navigator.onLine) {
      const { data, error } = await sb.rpc('kurulum_var');
      if (!error) kurulum = !!data;
    }
    const ilk = !kurulum;
    giris.innerHTML = `
      <form class="giris-kutu" novalidate>
        <img src="icons/icon-192.png" alt="" width="64" height="64">
        <h1>Sera Otomasyon</h1>
        <p class="ince">${ilk ? 'İlk kurulum: yönetici hesabını oluşturun. Diğer kullanıcıları sonra Ayarlar › Kullanıcılar bölümünden eklersiniz.' : 'Devam etmek için giriş yapın.'}</p>
        ${ilk ? '<label class="alan-blok"><span>Adınız</span><input name="ad" autocomplete="name" required></label>' : ''}
        <label class="alan-blok"><span>Kullanıcı adı</span><input name="k" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>
        <label class="alan-blok"><span>Şifre</span><input name="s" type="password" autocomplete="${ilk ? 'new-password' : 'current-password'}" required></label>
        <p class="giris-hata" role="alert">${esc(mesaj || (navigator.onLine ? '' : 'İnternet yok. İlk giriş için internet gerekli.'))}</p>
        <button class="btn birincil genis" type="submit">${ilk ? 'Hesabı oluştur ve gir' : 'Giriş yap'}</button>
      </form>`;
    const form = $('form', giris);
    const hata = $('.giris-hata', giris);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const k = kullaniciAdi(form.k.value);
      const sifre = form.s.value;
      if (!k || !sifre) return (hata.textContent = 'Kullanıcı adı ve şifre gerekli');
      const btn = $('button', form);
      btn.disabled = true;
      hata.textContent = '';
      try {
        if (ilk) {
          const { error } = await sb.rpc('ilk_yonetici', { p_kullanici: k, p_sifre: sifre, p_ad: form.ad.value.trim() || k });
          if (error) throw error;
        }
        const { data, error } = await sb.auth.signInWithPassword({ email: eposta(k), password: sifre });
        if (error) throw error;
        try {
          await profilDogrula(data.user);
        } catch (err) {
          await sb.auth.signOut({ scope: 'local' });
          throw err;
        }
        iceri(data.session);
        toast('Hoş geldiniz, ' + profil.ad);
      } catch (err) {
        hata.textContent = hataAl(err);
        btn.disabled = false;
      }
    };
    setTimeout(() => (ilk ? form.ad : form.k).focus(), 50);
  }

  // ---------- Üst çubuk ----------
  const DURUM_ADI = { tamam: 'Senkron', gonderiliyor: 'Gönderiliyor…', cevrimdisi: 'Çevrimdışı', hata: 'Senkron hatası', bekliyor: 'Bağlanıyor…' };
  function rozetCiz() {
    const r = $('#hesap-rozet');
    if (!r) return;
    if (!oturum || !profil) {
      r.hidden = true;
      return;
    }
    r.hidden = false;
    r.innerHTML = `<i class="senkron-nokta ${durum}" title="${esc(DURUM_ADI[durum] || '')}"></i><span>${esc(profil.ad)}</span>`;
  }
  $('#hesap-rozet').onclick = () => {
    A.ui.sekme = 'ayarlar';
    A.ciz();
    window.scrollTo(0, 0);
  };

  // ---------- Ayarlar › Hesap ----------
  function durumHtml() {
    const son = sd.sonSenkron ? new Date(sd.sonSenkron).toLocaleString('tr-TR') : 'henüz yok';
    const b = oturum ? bekleyenler().length : 0;
    return `<i class="senkron-nokta ${durum}"></i> ${esc(DURUM_ADI[durum] || '')}${b ? ` · ${b} değişiklik gönderilmeyi bekliyor` : ''}<br>Son senkron: ${esc(son)}${hataMetni ? `<br><span class="kirmizi">${esc(hataMetni)}</span>` : ''}`;
  }

  function panelCiz(el) {
    if (!el || !oturum || !profil) return;
    el.innerHTML = `
      <section class="panel">
        <h2>Hesap ve senkron</h2>
        <p>Giriş yapan: <b>${esc(profil.ad)}</b> <span class="ince">@${esc(profil.kullanici_adi)} · ${profil.rol === 'yonetici' ? 'Yönetici' : 'Personel'}</span></p>
        <p class="ince" id="bulut-durum">${durumHtml()}</p>
        <p class="ince">Veriler bu telefonda da saklanır; internet yokken çalışmaya devam edersiniz, bağlantı gelince otomatik gönderilir.</p>
        <button class="btn genis" id="b-senkron">Şimdi senkronla</button>
        <button class="btn genis" id="b-kullanicilar">Kullanıcılar</button>
        <button class="btn genis tehlike" id="b-cikis">Çıkış yap</button>
      </section>`;
    $('#b-senkron', el).onclick = () => {
      senkronla();
      kuyruk.then(() => toast(durum === 'tamam' ? 'Senkron tamam' : DURUM_ADI[durum]));
    };
    $('#b-kullanicilar', el).onclick = kullanicilarAc;
    $('#b-cikis', el).onclick = async () => {
      const b = bekleyenler().length;
      if (b && !confirm(`${b} değişiklik henüz buluta gönderilmedi. Yine de çıkılsın mı? (Veriler bu telefonda kalır.)`)) return;
      if (!b && !confirm('Çıkış yapılsın mı?')) return;
      disari();
    };
  }

  function gorulmeMetni(t) {
    if (!t) return 'hiç girmedi';
    const fark = Date.now() - zaman(t);
    if (fark < 6 * 60 * 1000) return 'şu an uygulamada';
    return 'son görülme ' + new Date(zaman(t)).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  async function kullanicilarAc() {
    if (!navigator.onLine) return toast('Kullanıcı listesi için internet gerekli');
    const { data, error } = await sb.from('profiller').select('id,kullanici_adi,ad,rol,aktif,son_gorulme').order('ad');
    if (error) return alert(hataAl(error));
    const yon = profil.rol === 'yonetici';
    sayfaAc(
      'Kullanıcılar',
      `<ul class="liste kullanicilar">${data
        .map(
          (u) => `<li class="${u.aktif ? '' : 'pasif'}">
            <span><b>${esc(u.ad)}</b>${u.id === profil.id ? ' (siz)' : ''}<small>@${esc(u.kullanici_adi)} · ${u.rol === 'yonetici' ? 'Yönetici' : 'Personel'}${u.aktif ? '' : ' · devre dışı'} · ${gorulmeMetni(u.son_gorulme)}</small></span>
            ${yon ? `<button class="btn kucuk" data-duzenle="${u.id}">Düzenle</button>` : ''}
          </li>`
        )
        .join('')}</ul>
      ${
        yon
          ? `<h3>Yeni kullanıcı</h3>
        <label class="alan-blok"><span>Ad soyad</span><input id="ku-ad"></label>
        <label class="alan-blok"><span>Kullanıcı adı</span><input id="ku-k" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ör. ahmet"></label>
        <label class="alan-blok"><span>Şifre (en az 6 karakter)</span><input id="ku-s" type="text" autocomplete="off"></label>
        <label class="alan-blok"><span>Rol</span><select id="ku-r"><option value="personel">Personel</option><option value="yonetici">Yönetici</option></select></label>
        <button class="btn birincil genis" id="ku-ekle">Kullanıcı ekle</button>`
          : '<p class="ince">Kullanıcıları yalnızca yönetici ekleyip düzenleyebilir.</p>'
      }`,
      (g) => {
        if (!yon) return;
        $$('[data-duzenle]', g).forEach((b) => (b.onclick = () => kullaniciDuzenle(data.find((u) => u.id === b.dataset.duzenle))));
        $('#ku-ekle', g).onclick = async () => {
          const k = kullaniciAdi($('#ku-k', g).value);
          const { error: e } = await sb.rpc('kullanici_ekle', {
            p_kullanici: k,
            p_sifre: $('#ku-s', g).value,
            p_ad: $('#ku-ad', g).value.trim() || k,
            p_rol: $('#ku-r', g).value,
          });
          if (e) return alert(hataAl(e));
          toast(`@${k} eklendi`);
          kullanicilarAc();
        };
      }
    );
  }

  function kullaniciDuzenle(u) {
    const ben = u.id === profil.id;
    sayfaAc(
      u.ad,
      `<p class="ince">@${esc(u.kullanici_adi)}</p>
       <label class="alan-blok"><span>Ad soyad</span><input id="kd-ad" value="${esc(u.ad)}"></label>
       <label class="alan-blok"><span>Rol</span><select id="kd-r" ${ben ? 'disabled' : ''}>
         <option value="personel" ${u.rol === 'personel' ? 'selected' : ''}>Personel</option>
         <option value="yonetici" ${u.rol === 'yonetici' ? 'selected' : ''}>Yönetici</option></select></label>
       <label class="onay"><input type="checkbox" id="kd-aktif" ${u.aktif ? 'checked' : ''} ${ben ? 'disabled' : ''}> Hesap aktif (kapalıysa giriş yapamaz ve veriyi göremez)</label>
       <label class="alan-blok"><span>Yeni şifre (değiştirmeyecekseniz boş bırakın)</span><input id="kd-s" type="text" autocomplete="off"></label>
       <button class="btn birincil genis" id="kd-kaydet">Kaydet</button>
       <button class="btn genis" id="kd-geri">Geri</button>`,
      (g) => {
        $('#kd-geri', g).onclick = kullanicilarAc;
        $('#kd-kaydet', g).onclick = async () => {
          const sifre = $('#kd-s', g).value;
          const { error } = await sb.rpc('kullanici_guncelle', {
            p_id: u.id,
            p_ad: $('#kd-ad', g).value,
            p_rol: ben ? null : $('#kd-r', g).value,
            p_aktif: ben ? null : $('#kd-aktif', g).checked,
            p_sifre: sifre ? sifre : null,
          });
          if (error) return alert(hataAl(error));
          if (ben) {
            profil.ad = $('#kd-ad', g).value.trim() || profil.ad;
            yaz(PROFIL_KEY, profil);
            rozetCiz();
          }
          toast('Kaydedildi');
          kullanicilarAc();
        };
      }
    );
  }

  window.Bulut = {
    etkin: true,
    panelCiz,
    senkronla,
    get profil() {
      return profil;
    },
  };

  basla().catch((e) => girisCiz(hataAl(e)));
})();
