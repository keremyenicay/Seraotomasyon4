/* Sera Otomasyon – uydu haritası: konum, sera sınırları, personel sıra başlangıç/bitiş işaretleri */
(function () {
  'use strict';
  const S = window.Store;
  const A = window.SeraApp;
  const { esc, ikon, toast } = A.yard;
  const ui = A.ui;
  const $ = (sel, el) => (el || document).querySelector(sel);

  const KATMANLAR = {
    uydu: {
      ad: 'Uydu',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ops: { maxNativeZoom: 19, maxZoom: 22, attribution: 'Görüntü © Esri, Maxar, Earthstar Geographics' },
    },
    sokak: {
      ad: 'Sokak',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ops: { maxNativeZoom: 19, maxZoom: 22, attribution: '© OpenStreetMap katkıcıları' },
    },
  };
  const RENKLER = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#f783ac', '#ffa94d', '#9775fa', '#3bc9db', '#a9e34b', '#e599f7', '#ff8787', '#74c0fc'];

  const h = {
    mod: null, // null | 'sinir' | 'isaret'
    katman: 'uydu',
    takip: false,
    konum: null, // {lat, lng, acc}
    sinirNoktalar: [],
    kisiId: null,
    hedef: 'bas',
  };
  try {
    const k = JSON.parse(localStorage.getItem('seraotomasyon.harita') || '{}');
    if (k.katman) h.katman = k.katman;
    if (k.konum) h.sonKonum = k.konum;
  } catch (e) {}
  function hKaydet() {
    try {
      localStorage.setItem('seraotomasyon.harita', JSON.stringify({ katman: h.katman, konum: h.konum || h.sonKonum }));
    } catch (e) {}
  }

  let map = null;
  let karo = null;
  let seraKat = null;
  let isaretKat = null;
  let cizimKat = null;
  let konumNokta = null;
  let konumDaire = null;
  let izleId = null;
  let ilkKonum = true;

  const bugun = () => S.tarihStr(new Date());
  const seciliSera = () => ui.haritaSera || '';

  // ---------- Geometri ----------
  function icinde(pt, poly) {
    let ic = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i];
      const [yj, xj] = poly[j];
      if (yi > pt[0] !== yj > pt[0] && pt[1] < ((xj - xi) * (pt[0] - yi)) / (yj - yi) + xi) ic = !ic;
    }
    return ic;
  }
  function metre(a, b) {
    const R = 6371000;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function kenaraMesafe(pt, poly) {
    // yerel düzlem yaklaşımı (küçük alanlar için yeterli)
    const k = Math.cos((pt[0] * Math.PI) / 180) * 111320;
    const P = (q) => [(q[1] - pt[1]) * k, (q[0] - pt[0]) * 110540];
    let min = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = P(poly[i]);
      const b = P(poly[(i + 1) % poly.length]);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / (dx * dx + dy * dy || 1)));
      min = Math.min(min, Math.hypot(a[0] + t * dx, a[1] + t * dy));
    }
    return min;
  }
  function bulundugumSera() {
    if (!h.konum) return null;
    const pt = [h.konum.lat, h.konum.lng];
    const icindeki = S.d.seralar.find((s) => s.sinir && s.sinir.length > 2 && icinde(pt, s.sinir));
    if (icindeki) return { sera: icindeki, ic: true };
    let en = null;
    S.d.seralar.forEach((s) => {
      if (!s.sinir || s.sinir.length < 3) return;
      const m = kenaraMesafe(pt, s.sinir);
      if (!en || m < en.m) en = { sera: s, m, ic: false };
    });
    return en;
  }

  // ---------- Ekran ----------
  function ciz() {
    const ekran = $('#ekran');
    if (typeof L === 'undefined') {
      ekran.innerHTML = `<div class="bos"><h2>Harita yüklenemedi</h2><p>Sayfayı yenileyin.</p></div>`;
      return;
    }
    ekran.innerHTML = `
      <div class="harita-kap">
        <div id="harita"></div>
        <div class="h-ust">
          <select id="h-sera" aria-label="Sera">${['<option value="">Tüm seralar</option>']
            .concat(S.d.seralar.map((s) => `<option value="${s.id}" ${s.id === seciliSera() ? 'selected' : ''}>${esc(s.ad)}${s.sinir ? '' : ' (sınır yok)'}</option>`))
            .join('')}</select>
          <button class="h-btn" id="h-katman">${KATMANLAR[h.katman === 'uydu' ? 'sokak' : 'uydu'].ad}</button>
        </div>
        <div class="h-sag">
          <button class="h-yuvarlak ${h.takip ? 'aktif' : ''}" id="h-konum" aria-label="Konumum">${ikon('konum')}</button>
          <button class="h-yuvarlak" id="h-sigdir" aria-label="Seralara sığdır">${ikon('harita')}</button>
        </div>
        <div class="h-alt" id="h-alt"></div>
      </div>`;
    haritaKur();
    $('#ekran')._ayril = ayril;
  }

  function haritaKur() {
    if (map) {
      map.remove();
      map = null;
    }
    map = L.map('harita', { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    katmanAyarla();
    seraKat = L.layerGroup().addTo(map);
    isaretKat = L.layerGroup().addTo(map);
    cizimKat = L.layerGroup().addTo(map);
    katmanlariCiz();
    if (!sigdir(false)) {
      if (h.sonKonum) map.setView([h.sonKonum.lat, h.sonKonum.lng], 18);
      else map.setView([39.0, 35.0], 6);
    }
    map.on('click', haritaTik);
    map.on('zoomend', yakinlikSinifi);
    yakinlikSinifi();

    $('#h-sera').onchange = (e) => {
      ui.haritaSera = e.target.value;
      if (h.mod === 'isaret') h.kisiId = null;
      katmanlariCiz();
      sigdir(true);
      panel();
    };
    $('#h-katman').onclick = () => {
      h.katman = h.katman === 'uydu' ? 'sokak' : 'uydu';
      hKaydet();
      katmanAyarla();
      $('#h-katman').textContent = KATMANLAR[h.katman === 'uydu' ? 'sokak' : 'uydu'].ad;
    };
    $('#h-konum').onclick = () => {
      h.takip = !h.takip;
      $('#h-konum').classList.toggle('aktif', h.takip);
      if (h.takip && h.konum) map.setView([h.konum.lat, h.konum.lng], Math.max(map.getZoom(), 19));
      if (h.takip && !h.konum) toast('Konum bekleniyor…');
    };
    $('#h-sigdir').onclick = () => {
      h.takip = false;
      $('#h-konum').classList.remove('aktif');
      if (!sigdir(true)) toast('Henüz sera sınırı veya sıra işareti yok');
    };
    map.on('dragstart', () => {
      if (h.takip) {
        h.takip = false;
        $('#h-konum').classList.remove('aktif');
      }
    });
    konumIzle();
    panel();
    setTimeout(() => map && map.invalidateSize(), 50);
  }

  function katmanAyarla() {
    if (karo) map.removeLayer(karo);
    const k = KATMANLAR[h.katman];
    karo = L.tileLayer(k.url, Object.assign({ crossOrigin: 'anonymous' }, k.ops)).addTo(map);
  }

  function yakinlikSinifi() {
    const kap = $('.harita-kap');
    if (kap && map) kap.classList.toggle('uzak', map.getZoom() < 18);
  }

  function sigdir(animasyon) {
    const noktalar = [];
    const sid = seciliSera();
    S.d.seralar.forEach((s) => {
      if ((!sid || s.id === sid) && s.sinir) noktalar.push(...s.sinir);
    });
    gorunenPersonel().forEach((p) => {
      if (p.siraIsaret && p.siraIsaret.bas) noktalar.push(p.siraIsaret.bas);
      if (p.siraIsaret && p.siraIsaret.bit) noktalar.push(p.siraIsaret.bit);
    });
    if (!noktalar.length) return false;
    map.fitBounds(L.latLngBounds(noktalar), { padding: [40, 40], maxZoom: 20, animate: animasyon });
    return true;
  }

  function gorunenPersonel() {
    const sid = seciliSera();
    return S.d.personel.filter((p) => (sid ? p.seraId === sid : true) && (p.aktif || p.siraIsaret));
  }

  function renk(p) {
    const i = S.d.personel.indexOf(p);
    return RENKLER[(i < 0 ? 0 : i) % RENKLER.length];
  }

  function bugunkuIs(p) {
    const k = S.kayit(bugun(), p.id);
    if (!k) return 'Bugün kayıt yok';
    if (k.durum && k.durum !== 'geldi') return 'Bugün: ' + S.DURUMLAR[k.durum];
    const isler = (k.isler || []).filter((x) => x.is);
    return isler.length ? isler.map((x) => `${esc(x.is)} ${S.sayiYaz(S.yapilan(x))}/${S.sayiYaz(x.toplam)}`).join('<br>') : 'Bugün iş girilmedi';
  }

  function katmanlariCiz() {
    seraKat.clearLayers();
    isaretKat.clearLayers();
    const sid = seciliSera();
    S.d.seralar.forEach((s) => {
      if (!s.sinir || s.sinir.length < 3) return;
      const bekleme = S.beklemeUyarilari(s.id, bugun());
      const soluk = sid && s.id !== sid;
      const poly = L.polygon(s.sinir, {
        color: bekleme.length ? '#ff4d4f' : '#5cff8d',
        weight: soluk ? 1.5 : 3,
        fillOpacity: soluk ? 0.04 : 0.12,
        opacity: soluk ? 0.5 : 1,
        interactive: !h.mod, // çizim/işaret modunda dokunuşlar haritaya geçsin
      }).addTo(seraKat);
      poly.bindTooltip(esc(s.ad), { permanent: true, direction: 'center', className: 'sera-et' });
      const kisi = S.seraPersoneli(s.id).length;
      const son = S.d.tahminler.filter((t) => t.seraId === s.id).slice(-1)[0];
      poly.bindPopup(
        `<b>${esc(s.ad)}</b><br>${kisi} aktif personel${s.siraSayisi ? ' · ' + S.sayiYaz(s.siraSayisi) + ' sıra' : ''}
         ${bekleme.length ? `<br><span class="kirmizi">İlaç bekleme: ${bekleme.map((il) => esc(il.ilac) + ' → ' + S.trTarih(S.uygunTarih(il))).join(', ')}</span>` : ''}
         ${son ? `<br>Son tahmin ${S.trTarih(son.tarih)}: ≈ ${(S.tahminHesapla(son).ortKutu || 0).toLocaleString('tr-TR')} kutu` : ''}
         <br><button class="pop-btn" data-sinir-sil="${s.id}">Sınırı sil</button>`
      );
    });
    gorunenPersonel().forEach((p) => {
      const si = p.siraIsaret;
      if (!si || (!si.bas && !si.bit)) return;
      const r = renk(p);
      const secili = h.mod === 'isaret' && h.kisiId === p.id;
      const popup = `<b>${esc(p.ad)}</b><br>${esc(p.siraMetni || '')}${p.seraId ? ' · ' + esc((S.sera(p.seraId) || {}).ad || '') : ''}<br><small>${bugunkuIs(p)}</small>`;
      if (si.bas && si.bit) {
        const cizgi = L.polyline([si.bas, si.bit], { color: r, weight: secili ? 7 : 5, opacity: 0.95, interactive: !h.mod }).addTo(isaretKat);
        cizgi.bindTooltip(esc(p.ad), { permanent: true, direction: 'center', className: 'kisi-et' });
        cizgi.bindPopup(popup);
      }
      [
        ['bas', 'B', 'isaret-b'],
        ['bit', 'S', 'isaret-s'],
      ].forEach(([alan, harf, sinif]) => {
        if (!si[alan]) return;
        const m = L.marker(si[alan], {
          icon: L.divIcon({ className: '', html: `<div class="isaret ${sinif}" style="--r:${r}">${harf}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
          draggable: h.mod === 'isaret',
          keyboard: false,
        }).addTo(isaretKat);
        m.bindPopup(popup + `<br><small>${alan === 'bas' ? 'Başlangıç' : 'Bitiş'} noktası</small>`);
        m.on('dragend', () => {
          const ll = m.getLatLng();
          si[alan] = [ll.lat, ll.lng];
          si.tarih = new Date().toISOString();
          S.kaydet();
          katmanlariCiz();
        });
      });
    });
  }

  // Popup içindeki "Sınırı sil"
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sinir-sil]');
    if (!b) return;
    const s = S.sera(b.dataset.sinirSil);
    if (s && confirm(`${s.ad} sınırı silinsin mi?`)) {
      delete s.sinir;
      S.kaydet();
      map && map.closePopup();
      katmanlariCiz();
      panel();
    }
  });

  // ---------- Konum ----------
  function konumIzle() {
    if (!navigator.geolocation) {
      h.hata = 'Bu cihaz konum desteklemiyor.';
      return;
    }
    if (izleId !== null) navigator.geolocation.clearWatch(izleId);
    izleId = navigator.geolocation.watchPosition(
      (pos) => {
        h.hata = null;
        h.konum = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) };
        h.sonKonum = h.konum;
        konumCiz();
        if (ilkKonum) {
          ilkKonum = false;
          hKaydet();
          const sinirVar = S.d.seralar.some((s) => s.sinir);
          if (!sinirVar) map.setView([h.konum.lat, h.konum.lng], 19);
        }
        if (h.takip) map.panTo([h.konum.lat, h.konum.lng], { animate: true });
        panel(true);
      },
      (err) => {
        h.hata =
          err.code === 1
            ? 'Konum izni verilmedi. iPhone: Ayarlar › Gizlilik ve Güvenlik › Konum Servisleri › Safari Web Siteleri › “Uygulamayı Kullanırken”.'
            : 'Konum alınamadı (' + err.message + ').';
        panel(true);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 }
    );
  }
  function konumCiz() {
    if (!map || !h.konum) return;
    const ll = [h.konum.lat, h.konum.lng];
    if (!konumNokta) {
      konumDaire = L.circle(ll, { radius: h.konum.acc, color: '#1e90ff', weight: 1, fillOpacity: 0.15, interactive: false }).addTo(map);
      konumNokta = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1e90ff', fillOpacity: 1, interactive: false }).addTo(map);
    } else {
      konumNokta.setLatLng(ll);
      konumDaire.setLatLng(ll).setRadius(h.konum.acc);
    }
  }
  function ayril() {
    if (izleId !== null && navigator.geolocation) navigator.geolocation.clearWatch(izleId);
    izleId = null;
    hKaydet();
    if (map) map.remove();
    map = null;
    konumNokta = konumDaire = null;
    ilkKonum = true;
    h.mod = null;
    h.sinirNoktalar = [];
  }

  // ---------- Alt panel ----------
  function durumMetni() {
    if (h.hata) return `<p class="h-hata">${esc(h.hata)}</p>`;
    if (!h.konum) return `<p class="ince">Konum bekleniyor… (izin istenirse “İzin Ver”e dokunun)</p>`;
    const b = bulundugumSera();
    const dog = `<small>doğruluk ±${h.konum.acc} m</small>`;
    if (!b) return `<p class="h-durum">${ikon('konum')} Konumunuz haritada ${dog}<br><small>Sera sınırı çizildiğinde hangi serada olduğunuz burada görünür.</small></p>`;
    if (b.ic) return `<p class="h-durum ic">${ikon('konum')} <b>${esc(b.sera.ad)}</b>&nbsp;içindesiniz ${dog}</p>`;
    return `<p class="h-durum">${ikon('konum')} Seraların dışındasınız · <b>${esc(b.sera.ad)}</b>'e ${Math.round(b.m)} m ${dog}</p>`;
  }

  function panel(sadeceDurum) {
    const el = $('#h-alt');
    if (!el) return;
    if (sadeceDurum && h.mod !== 'isaret') {
      const d = $('#h-durum-kap', el);
      if (d) d.innerHTML = durumMetni();
      if (h.mod !== 'sinir') return;
    }
    if (h.mod === 'sinir') return sinirPanel(el);
    if (h.mod === 'isaret') return isaretPanel(el, sadeceDurum);
    el.innerHTML = `
      <div id="h-durum-kap">${durumMetni()}</div>
      <div class="h-butonlar">
        <button class="btn kucuk" id="h-sinir">${ikon('kalem')} Sera sınırı çiz</button>
        <button class="btn kucuk birincil" id="h-isaret">${ikon('personel')} Sıra işaretle</button>
      </div>`;
    $('#h-sinir').onclick = sinirBasla;
    $('#h-isaret').onclick = () => {
      if (!S.d.personel.length) return toast('Önce personel ekleyin');
      h.mod = 'isaret';
      h.kisiId = null;
      katmanlariCiz();
      panel();
    };
  }

  // ---------- Sera sınırı çizimi ----------
  function sinirBasla() {
    let sid = seciliSera();
    if (!sid) {
      if (S.d.seralar.length === 1) sid = S.d.seralar[0].id;
      else return toast('Üstten bir sera seçin');
    }
    const s = S.sera(sid);
    if (s.sinir && !confirm(`${s.ad} için mevcut sınır yeniden çizilsin mi?`)) return;
    ui.haritaSera = sid;
    $('#h-sera').value = sid;
    h.mod = 'sinir';
    h.sinirNoktalar = [];
    katmanlariCiz();
    cizimGuncelle();
    panel();
  }
  function cizimGuncelle() {
    cizimKat.clearLayers();
    const n = h.sinirNoktalar;
    if (n.length) L.polyline(n.length > 2 ? n.concat([n[0]]) : n, { color: '#ffd43b', weight: 3, dashArray: '6 6' }).addTo(cizimKat);
    n.forEach((p, i) => L.circleMarker(p, { radius: 6, color: '#000', weight: 1, fillColor: '#ffd43b', fillOpacity: 1 }).bindTooltip(String(i + 1)).addTo(cizimKat));
  }
  function sinirPanel(el) {
    const s = S.sera(seciliSera());
    el.innerHTML = `
      <p class="h-baslik"><b>${esc(s ? s.ad : '')}</b> sınırı – ${h.sinirNoktalar.length} köşe</p>
      <p class="ince">Haritada köşelere dokunun ya da köşede durup “Konumumu ekle”ye basın. En az 3 köşe.</p>
      <div class="h-butonlar dort">
        <button class="btn kucuk" id="s-konum">${ikon('konum')} Konumumu ekle</button>
        <button class="btn kucuk" id="s-geri">Geri al</button>
        <button class="btn kucuk birincil" id="s-bitir" ${h.sinirNoktalar.length < 3 ? 'disabled' : ''}>Bitir</button>
        <button class="btn kucuk" id="s-iptal">İptal</button>
      </div>`;
    $('#s-konum').onclick = () => {
      if (!h.konum) return toast('Konum henüz alınmadı');
      if (h.konum.acc > 15) toast(`Doğruluk düşük (±${h.konum.acc} m)`);
      h.sinirNoktalar.push([h.konum.lat, h.konum.lng]);
      cizimGuncelle();
      panel();
    };
    $('#s-geri').onclick = () => {
      h.sinirNoktalar.pop();
      cizimGuncelle();
      panel();
    };
    $('#s-bitir').onclick = () => {
      if (h.sinirNoktalar.length < 3) return;
      s.sinir = h.sinirNoktalar.map((p) => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7]);
      S.kaydet();
      h.mod = null;
      h.sinirNoktalar = [];
      cizimKat.clearLayers();
      katmanlariCiz();
      toast(`${s.ad} sınırı kaydedildi`);
      const opt = $(`#h-sera option[value="${s.id}"]`);
      if (opt) opt.textContent = s.ad;
      panel();
    };
    $('#s-iptal').onclick = () => {
      h.mod = null;
      h.sinirNoktalar = [];
      cizimKat.clearLayers();
      katmanlariCiz();
      panel();
    };
  }

  // ---------- Personel sıra işaretleri ----------
  function isaretPanel(el, sadeceDurum) {
    const liste = gorunenPersonel().filter((p) => p.aktif);
    if (!h.kisiId || !liste.some((p) => p.id === h.kisiId)) {
      const ilkEksik = liste.find((p) => !(p.siraIsaret && p.siraIsaret.bas && p.siraIsaret.bit));
      h.kisiId = (ilkEksik || liste[0] || {}).id || null;
    }
    const p = S.kisi(h.kisiId);
    const si = (p && p.siraIsaret) || {};
    const dog = h.konum ? `±${h.konum.acc} m` : 'konum yok';
    if (sadeceDurum) {
      const d = $('#i-dog', el);
      if (d) d.textContent = dog;
      return;
    }
    const tamam = liste.filter((x) => x.siraIsaret && x.siraIsaret.bas && x.siraIsaret.bit).length;
    el.innerHTML = `
      <div class="h-satir"><p class="h-baslik"><b>Sıra işaretle</b> · ${tamam}/${liste.length} tamam</p><button class="btn kucuk" id="i-kapat">Bitti</button></div>
      ${!seciliSera() && S.d.seralar.length > 1 ? '<p class="ince">İpucu: üstten sera seçerek listeyi daraltın.</p>' : ''}
      <div class="kisi-cipler">${liste
        .map((x) => {
          const ok = x.siraIsaret && x.siraIsaret.bas && x.siraIsaret.bit;
          const yarim = x.siraIsaret && (x.siraIsaret.bas || x.siraIsaret.bit) && !ok;
          return `<button class="cip ${x.id === h.kisiId ? 'aktif' : ''} ${ok ? 'tamam' : yarim ? 'yarim' : ''}" data-kisi="${x.id}" style="--r:${renk(x)}"><i></i>${esc(x.ad)}${ok ? ' ✓' : ''}</button>`;
        })
        .join('')}</div>
      ${
        p
          ? `<p class="h-kisi"><b>${esc(p.ad)}</b> ${esc(p.siraMetni || '')} <small id="i-dog">${dog}</small></p>
      <div class="h-butonlar dort">
        <button class="btn kucuk ${si.bas ? 'tamam-btn' : ''}" id="i-bas">${ikon('konum')} Başlangıç${si.bas ? ' ✓' : ''}</button>
        <button class="btn kucuk ${si.bit ? 'tamam-btn' : ''}" id="i-bit">${ikon('konum')} Bitiş${si.bit ? ' ✓' : ''}</button>
        <button class="btn kucuk" id="i-sil" ${si.bas || si.bit ? '' : 'disabled'}>Sil</button>
        <button class="btn kucuk" id="i-sonraki">Sonraki ›</button>
      </div>
      <p class="ince kucuk-yazi">Sıranın başında/sonunda durup düğmeye basın veya haritaya dokunun → <b>${h.hedef === 'bas' ? 'Başlangıç' : 'Bitiş'}</b> konur. Noktalar sürüklenebilir.</p>`
          : '<p class="ince">Bu serada aktif personel yok.</p>'
      }`;
    el.querySelectorAll('[data-kisi]').forEach(
      (b) =>
        (b.onclick = () => {
          h.kisiId = b.dataset.kisi;
          const k = S.kisi(h.kisiId);
          h.hedef = k.siraIsaret && k.siraIsaret.bas && !k.siraIsaret.bit ? 'bit' : 'bas';
          const s2 = k.siraIsaret;
          if (s2 && (s2.bas || s2.bit)) map.panTo(s2.bas && s2.bit ? L.latLngBounds([s2.bas, s2.bit]).getCenter() : s2.bas || s2.bit);
          katmanlariCiz();
          panel();
        })
    );
    $('#i-kapat').onclick = () => {
      h.mod = null;
      katmanlariCiz();
      panel();
    };
    if (!p) return;
    const koy = (alan, ll) => {
      p.siraIsaret = Object.assign({}, p.siraIsaret || {}, { [alan]: [Math.round(ll[0] * 1e7) / 1e7, Math.round(ll[1] * 1e7) / 1e7], tarih: new Date().toISOString() });
      S.kaydet();
      h.hedef = alan === 'bas' ? 'bit' : 'bas';
      toast(`${p.ad}: ${alan === 'bas' ? 'başlangıç' : 'bitiş'} kaydedildi`);
      if (alan === 'bit' && p.siraIsaret.bas) sonrakiKisi();
      katmanlariCiz();
      panel();
    };
    h.koy = koy;
    const konumla = (alan) => {
      if (!h.konum) return toast('Konum henüz alınmadı');
      if (h.konum.acc > 15 && !confirm(`Konum doğruluğu düşük (±${h.konum.acc} m). Yine de kaydedilsin mi?`)) return;
      koy(alan, [h.konum.lat, h.konum.lng]);
    };
    $('#i-bas').onclick = () => konumla('bas');
    $('#i-bit').onclick = () => konumla('bit');
    $('#i-sil').onclick = () => {
      if (!confirm(`${p.ad} için sıra işaretleri silinsin mi?`)) return;
      delete p.siraIsaret;
      S.kaydet();
      h.hedef = 'bas';
      katmanlariCiz();
      panel();
    };
    $('#i-sonraki').onclick = () => {
      sonrakiKisi();
      katmanlariCiz();
      panel();
    };
  }
  function sonrakiKisi() {
    const liste = gorunenPersonel().filter((p) => p.aktif);
    const i = liste.findIndex((p) => p.id === h.kisiId);
    const sonra = liste.slice(i + 1).concat(liste.slice(0, i + 1));
    const eksik = sonra.find((p) => !(p.siraIsaret && p.siraIsaret.bas && p.siraIsaret.bit));
    h.kisiId = (eksik || sonra[0] || {}).id || null;
    const k = S.kisi(h.kisiId);
    h.hedef = k && k.siraIsaret && k.siraIsaret.bas && !k.siraIsaret.bit ? 'bit' : 'bas';
  }

  function haritaTik(e) {
    const ll = [e.latlng.lat, e.latlng.lng];
    if (h.mod === 'sinir') {
      h.sinirNoktalar.push(ll);
      cizimGuncelle();
      panel();
    } else if (h.mod === 'isaret' && h.koy && h.kisiId) {
      h.koy(h.hedef, ll);
    }
  }

  A.ekranlar.harita = ciz;
  A.harita = { durum: h, bulundugumSera, icinde };
})();
