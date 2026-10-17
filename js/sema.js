/* Sera Otomasyon – sera içi şema: sektörler, gutter'lar, kişi yerleşimi, karantina, günlük iş ve bitki sayımı */
(function () {
  'use strict';
  const S = window.Store;
  const A = window.SeraApp;
  const { esc, ikon, toast, sayfaAc, sayfaKapat } = A.yard;
  const ui = A.ui;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const NS = 'http://www.w3.org/2000/svg';

  const RENKLER = ['#e8590c', '#1c7ed6', '#2f9e44', '#c2255c', '#f59f00', '#6741d9', '#0c8599', '#e03131', '#5c940d', '#ae3ec9', '#d6336c', '#1971c2', '#f76707', '#087f5b', '#9c36b5', '#e67700'];
  const IS_RENK = { yapildi: '#2f9e44', kalan: '#f59f00', gelmedi: '#e03131', yok: '#adb5bd' };
  const TAM = { x: -10, y: -14, w: 720, h: 790 }; // şemanın tamamı (birim)
  const bugun = () => S.tarihStr(new Date());

  function lsAl(k, v) {
    try {
      const x = localStorage.getItem('seraotomasyon.' + k);
      return x === null ? v : JSON.parse(x);
    } catch (e) {
      return v;
    }
  }
  function lsYaz(k, v) {
    try {
      localStorage.setItem('seraotomasyon.' + k, JSON.stringify(v));
    } catch (e) {}
  }

  const g = {
    secili: null, // personel id
    vb: null, // görünür viewBox
    panelAcik: lsAl('semaPanel', false),
    gorunum: lsAl('semaGorunum', 'kisi'), // kisi | is | sayim
    sayimTarih: lsAl('sayimModu', null), // açık sayım tarihi (sayım modu)
    duz: { aktif: false, firca: null, taraf: null, aralik: false, ilk: null },
  };

  function renk(p) {
    const i = S.d.personel.indexOf(p);
    return RENKLER[(i < 0 ? 0 : i) % RENKLER.length];
  }
  const sayi = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('tr-TR'));
  const farkYaz = (f) => (f ? `<b class="${f < 0 ? 'kirmizi' : 'yesil'}">${f > 0 ? '+' : ''}${f}</b>` : '');
  const TARAF_AD = { sol: 'sol', sag: 'sağ' };

  // ---------- Geometri ----------
  // Bir sektörün harf parçaları (5*6 gibi birleşik kutular gutter sayısı oranında bölünür)
  function parcalar(sk) {
    const harfler = sk.yon === 'sag' ? sk.harfler.slice().reverse() : sk.harfler.slice();
    const sayilar = harfler.map((h) => S.gutterSayisi(sk.seraId, h));
    const top = sayilar.reduce((a, b) => a + b, 0);
    let x = sk.kutu.x;
    return harfler.map((h, i) => {
      const w = (sk.kutu.w * sayilar[i]) / top;
      const p = { harf: h, n: sayilar[i], x, y: sk.kutu.y, w, h: sk.kutu.h, yon: sk.yon };
      x += w;
      return p;
    });
  }
  function gutterRect(pc, no) {
    const cw = pc.w / pc.n;
    const idx = pc.yon === 'sol' ? no - 1 : pc.n - no;
    return { x: pc.x + idx * cw, y: pc.y, w: cw, h: pc.h };
  }
  function parcaBul(seraId, harf) {
    const sk = S.sektorBul(seraId, harf);
    if (!sk) return null;
    return parcalar(sk).find((p) => p.harf === harf);
  }
  function sektorSecenekleri() {
    const l = [];
    S.sektorleriHazirla().forEach((sk) =>
      sk.harfler.forEach((h) =>
        l.push({ deger: sk.seraId + '|' + h, ad: `${(S.sera(sk.seraId) || {}).ad} · Sektör ${sk.no}${sk.harfler.length > 1 ? ' (' + h + ')' : ''}` })
      )
    );
    return l;
  }

  // ---------- Metinler ----------
  function parcaMetni(pid) {
    return S.kisiParcalari(pid)
      .map((pc) => `${S.sektorAdi(pc.seraId, pc.harf)}: ${pc.harf}${pc.bas}${pc.adet > 1 ? '–' + pc.bit : ''}${pc.taraf ? ' (' + TARAF_AD[pc.taraf] + ')' : ''}`)
      .join(' → ');
  }
  function bugunkuIs(p) {
    const k = S.kayit(bugun(), p.id);
    if (!k) return 'Bugün kayıt yok';
    if (k.durum && k.durum !== 'geldi') return 'Bugün: ' + S.DURUMLAR[k.durum] + (k.yerine ? ' (yerine ' + esc(k.yerine) + ')' : '');
    const isler = (k.isler || []).filter((x) => x.is);
    return isler.length ? 'Bugün: ' + isler.map((x) => `${esc(x.is)} ${S.sayiYaz(S.yapilan(x))}/${S.sayiYaz(x.toplam)}`).join(' · ') : 'Bugün iş girilmedi';
  }
  // Bugünkü ilerleme: yapılmamış son işin oranı (birden çok iş varsa en geride olan)
  function isDurumu(p) {
    const k = S.kayit(bugun(), p.id);
    if (!k) return { tip: 'yok' };
    if (k.durum && k.durum !== 'geldi') return { tip: 'gelmedi' };
    // İş adı seçilmemiş olsa da toplam/kalan girilmişse ilerleme sayılır
    const isler = (k.isler || []).filter((x) => S.sayi(x.toplam) && (x.is || S.sayi(x.kalan)));
    if (!isler.length) return { tip: 'yok' };
    let en = null;
    isler.forEach((x) => {
      const oran = Math.max(0, Math.min(1, (S.yapilan(x) || 0) / S.sayi(x.toplam)));
      if (!en || oran < en.oran) en = { oran, is: x.is };
    });
    return { tip: 'is', oran: en.oran, is: en.is };
  }
  // Kişinin her gutter'ı için bugünkü iş rengi (sıra yönüne göre baştan yapılan kadarı yeşil)
  function isRenkleri() {
    const harita = {};
    Object.keys(S.d.yerlesim).forEach((pid) => {
      const p = S.kisi(pid);
      if (!p) return;
      const d = isDurumu(p);
      const l = S.kisiGutterlari(pid);
      const yapilan = d.tip === 'is' ? Math.round(d.oran * l.length) : 0;
      l.forEach((gt, i) => {
        const r = d.tip === 'is' ? (i < yapilan ? IS_RENK.yapildi : IS_RENK.kalan) : d.tip === 'gelmedi' ? IS_RENK.gelmedi : IS_RENK.yok;
        harita[pid + '|' + gt.seraId + gt.harf + gt.gutter] = r;
      });
    });
    return harita;
  }

  // ---------- Sayım modu ----------
  function sayimModuAcik() {
    return !!g.sayimTarih;
  }
  // Açık sayımın bu seradaki kaydını oluşturmadan oku (yoksa önceki sayım)
  function sayimOku(seraId) {
    const t = g.sayimTarih;
    return S.d.bitkiSayimlari.find((x) => x.seraId === seraId && x.tarih === t) || S.sayimlar(seraId).filter((x) => x.tarih < t).pop() || S.sonSayim(seraId);
  }
  // Açık sayımın bu seradaki kaydı (yoksa son sayımdan kopyalanarak oluşturulur) – yalnız kayıtta çağrılır
  function sayimAl(seraId) {
    const t = g.sayimTarih;
    let sy = S.d.bitkiSayimlari.find((x) => x.seraId === seraId && x.tarih === t);
    if (!sy) {
      const once = S.sayimlar(seraId).filter((x) => x.tarih < t).pop() || S.sonSayim(seraId);
      sy = { id: S.uid(), tarih: t, seraId, sayilar: Object.assign({}, once ? once.sayilar : {}), kisi: once && once.kisi ? JSON.parse(JSON.stringify(once.kisi)) : {} };
      S.d.bitkiSayimlari.push(sy);
      S.kaydet();
    }
    return sy;
  }
  // Gösterilecek sayım: sayım modunda açık sayım, değilse son sayım
  function gosterilenSayim(seraId) {
    if (g.sayimTarih) {
      const sy = S.d.bitkiSayimlari.find((x) => x.seraId === seraId && x.tarih === g.sayimTarih);
      if (sy) return sy;
    }
    return S.sonSayim(seraId);
  }
  function oncekiSayimi(sy) {
    if (!sy) return null;
    return S.sayimlar(sy.seraId).filter((x) => x.tarih < sy.tarih).pop() || null;
  }

  // ---------- SVG çizimi ----------
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => v !== undefined && v !== null && e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }
  function metin(parent, x, y, t, attrs) {
    const e = el('text', Object.assign({ x, y }, attrs || {}), parent);
    e.textContent = t;
    return e;
  }
  const DEFS =
    '<marker id="ok" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker>' +
    '<pattern id="karantina" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="6" fill="#e03131" fill-opacity=".85"/></pattern>';

  function semaCiz(svg) {
    svg.innerHTML = '';
    el('defs', {}, svg).innerHTML = DEFS;
    const kok = el('g', { class: 's-kok' }, svg);
    el('rect', { x: 0, y: 0, width: 700, height: 322, class: 's-sera s-sera2' }, kok);
    el('rect', { x: 0, y: 322, width: 700, height: 405, class: 's-sera' }, kok);
    metin(kok, 328, 152, 'SERA 2', { class: 's-sera-et', 'text-anchor': 'middle' });
    metin(kok, 328, 505, 'SERA 1', { class: 's-sera-et', 'text-anchor': 'middle' });
    el('path', { d: 'M318 760 L328 742 L338 760', class: 's-giris-ok' }, kok);
    metin(kok, 328, 775, 'GİRİŞ', { class: 's-giris', 'text-anchor': 'middle' });

    const seciliP = g.secili && S.kisi(g.secili);
    const isR = g.gorunum === 'is' ? isRenkleri() : null;
    S.sektorleriHazirla().forEach((sk) => {
      const grup = el('g', { class: 's-sektor' }, kok);
      el('rect', { x: sk.kutu.x, y: sk.kutu.y, width: sk.kutu.w, height: sk.kutu.h, class: 's-kutu' }, grup);
      const sy = g.gorunum === 'sayim' ? gosterilenSayim(sk.seraId) : null;
      const once = sy ? oncekiSayimi(sy) : null;
      let max = 1;
      if (sy) Object.values(sy.sayilar).forEach((v) => (max = Math.max(max, v || 0)));
      parcalar(sk).forEach((pc) => {
        for (let no = 1; no <= pc.n; no++) {
          const r = gutterRect(pc, no);
          const dilim = S.gutterDilimleri(sk.seraId, pc.harf, no);
          const ortak = { class: 's-gutter', 'data-sera': sk.seraId, 'data-harf': pc.harf, 'data-no': no };
          if (g.gorunum === 'sayim') {
            const v = S.gutterBitki(sy, pc.harf, no);
            const o = S.gutterBitki(once, pc.harf, no);
            const kayip = v !== null && o !== null && v < o;
            el(
              'rect',
              Object.assign({}, ortak, {
                x: r.x,
                y: r.y,
                width: r.w + 0.15,
                height: r.h,
                fill: v === null ? 'transparent' : kayip ? '#e03131' : '#2f9e44',
                'fill-opacity': v === null ? 0 : kayip ? Math.min(0.95, 0.35 + (o - v) / 20) : 0.15 + 0.75 * (v / max),
                'data-kisi': dilim[0] ? dilim[0].p.id : null,
              }),
              grup
            );
          } else {
            const parca = dilim.length ? dilim : [{ p: null }];
            parca.forEach((d, di) => {
              const p = d.p;
              const soluk = seciliP && p !== seciliP;
              const fill = !p ? 'transparent' : isR ? isR[p.id + '|' + sk.seraId + pc.harf + no] || IS_RENK.yok : renk(p);
              el(
                'rect',
                Object.assign({}, ortak, {
                  // sol/sağ taraf: gutter enine ikiye bölünür
                  x: r.x + (r.w * di) / parca.length,
                  y: r.y,
                  width: r.w / parca.length + 0.15,
                  height: r.h,
                  fill,
                  'fill-opacity': p ? (soluk ? 0.12 : seciliP || isR ? 0.95 : 0.7) : 0,
                  'data-kisi': p ? p.id : null,
                }),
                grup
              );
            });
          }
          if (S.karantinaMi(sk.seraId, pc.harf, no)) el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, class: 's-karantina' }, grup);
        }
        const r1 = gutterRect(pc, 1);
        metin(grup, r1.x + r1.w / 2, pc.y + pc.h - 3, '1', { class: 's-bir', 'text-anchor': 'middle' });
      });
      const etx = sk.kutu.x + sk.kutu.w / 2;
      const ety = sk.kutu.y + 13;
      el('rect', { x: etx - 30, y: ety - 10, width: 60, height: 14, rx: 7, class: 's-sektor-et-bg', 'data-sektor-ac': sk.id }, grup);
      metin(grup, etx, ety, 'Sektör ' + sk.no, { class: 's-sektor-et', 'text-anchor': 'middle', 'data-sektor-ac': sk.id });
    });

    // Kişi adları ve dönüş okları
    const adlar = el('g', { class: 's-adlar', 'pointer-events': 'none' }, kok);
    Object.keys(S.d.yerlesim).forEach((pid) => {
      const p = S.kisi(pid);
      if (!p) return;
      const prc = S.kisiParcalari(pid);
      const soluk = (seciliP && seciliP !== p) || g.gorunum === 'sayim';
      prc.forEach((pc, i) => {
        const parca = parcaBul(pc.seraId, pc.harf);
        if (!parca) return;
        const a = gutterRect(parca, pc.bas);
        const b = gutterRect(parca, pc.bit);
        const x1 = Math.min(a.x, b.x);
        const x2 = Math.max(a.x + a.w, b.x + b.w);
        const w = x2 - x1;
        if (pc.adet >= 2) {
          const ad = p.ad.split(' ')[0];
          const cx = x1 + w / 2;
          const cy = parca.y + parca.h / 2;
          const dikey = w < ad.length * 5.2 + 4;
          metin(adlar, cx, cy, ad, {
            class: 's-ad' + (soluk ? ' soluk' : ''),
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            transform: dikey ? `rotate(-90 ${cx} ${cy})` : null,
          });
        }
        const sonraki = prc[i + 1];
        if (!sonraki) return;
        const p2 = parcaBul(sonraki.seraId, sonraki.harf);
        if (!p2) return;
        // Aynı sektörde bitişik devam (taraf değişimi) için ok çizme
        if (p2 === parca && Math.abs(sonraki.bas - pc.bit) <= 1) return;
        const bitR = gutterRect(parca, pc.bit);
        const basR = gutterRect(p2, sonraki.bas);
        const uclar = (r, pp) => [
          [r.x + r.w / 2, pp.y],
          [r.x + r.w / 2, pp.y + pp.h],
        ];
        let en = null;
        uclar(bitR, parca).forEach((u) =>
          uclar(basR, p2).forEach((v) => {
            const d = Math.hypot(u[0] - v[0], u[1] - v[1]);
            if (!en || d < en.d) en = { u, v, d };
          })
        );
        const mx = (en.u[0] + en.v[0]) / 2;
        const my = (en.u[1] + en.v[1]) / 2 + (Math.abs(en.u[1] - en.v[1]) < 4 ? -18 : 0);
        el(
          'path',
          {
            d: `M${en.u[0]} ${en.u[1]} Q${mx} ${my} ${en.v[0]} ${en.v[1]}`,
            stroke: renk(p),
            class: 's-donus' + (seciliP === p ? ' secili' : soluk ? ' soluk' : ''),
            'marker-end': 'url(#ok)',
          },
          adlar
        );
      });
    });
  }

  // ---------- Yakınlaştırma / kaydırma ----------
  function vbUygula(svg) {
    const v = g.vb || TAM;
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  }
  function svgNokta(svg, cx, cy) {
    const r = svg.getBoundingClientRect();
    const v = g.vb || TAM;
    const s = Math.max(v.w / r.width, v.h / r.height);
    const ox = (r.width * s - v.w) / 2;
    const oy = (r.height * s - v.h) / 2;
    return { x: v.x - ox + (cx - r.left) * s, y: v.y - oy + (cy - r.top) * s, s };
  }
  function yakinlastir(svg, k, cx, cy) {
    const v = Object.assign({}, g.vb || TAM);
    const r = svg.getBoundingClientRect();
    const m = svgNokta(svg, cx === undefined ? r.left + r.width / 2 : cx, cy === undefined ? r.top + r.height / 2 : cy);
    const yw = Math.min(TAM.w * 1.2, Math.max(40, v.w / k));
    const kk = v.w / yw;
    v.x = m.x - (m.x - v.x) / kk;
    v.y = m.y - (m.y - v.y) / kk;
    v.w = yw;
    v.h = v.h / kk;
    g.vb = v;
    vbUygula(svg);
  }
  function hareketKur(svg) {
    const ptr = new Map();
    let bas = null;
    let surukledi = false;
    svg.addEventListener('pointerdown', (e) => {
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      surukledi = false;
      bas = { vb: Object.assign({}, g.vb || TAM), pts: new Map(ptr) };
    });
    svg.addEventListener('pointermove', (e) => {
      if (!ptr.has(e.pointerId) || !bas) return;
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = svg.getBoundingClientRect();
      const s = Math.max(bas.vb.w / r.width, bas.vb.h / r.height);
      if (ptr.size === 1) {
        const p0 = bas.pts.get(e.pointerId);
        if (!p0) return;
        const dx = e.clientX - p0.x;
        const dy = e.clientY - p0.y;
        if (!surukledi && Math.hypot(dx, dy) > 6) {
          surukledi = true;
          // Yakalamayı sürükleme başlayınca al; aksi halde dokunuş hedefi (gutter) kaybolur
          try {
            svg.setPointerCapture(e.pointerId);
          } catch (err) {}
        }
        if (!surukledi) return;
        g.vb = Object.assign({}, bas.vb, { x: bas.vb.x - dx * s, y: bas.vb.y - dy * s });
        vbUygula(svg);
      } else if (ptr.size === 2) {
        surukledi = true;
        const [a, b] = Array.from(ptr.values());
        const [a0, b0] = Array.from(bas.pts.values());
        if (!a0 || !b0) return;
        const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
        const d1 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const k = d1 / d0;
        g.vb = Object.assign({}, bas.vb);
        const mx = (a0.x + b0.x) / 2;
        const my = (a0.y + b0.y) / 2;
        yakinlastir(svg, k, mx, my);
      }
    });
    const bitir = (e) => {
      ptr.delete(e.pointerId);
      bas = ptr.size ? { vb: Object.assign({}, g.vb || TAM), pts: new Map(ptr) } : null;
    };
    svg.addEventListener('pointerup', bitir);
    svg.addEventListener('pointercancel', bitir);
    svg.addEventListener(
      'click',
      (e) => {
        if (surukledi) {
          e.stopPropagation();
          e.preventDefault();
          surukledi = false;
        }
      },
      true
    );
  }


  // ---------- Ekran ----------
  function ciz() {
    const ekran = $('#ekran');
    if (ui.semaSektor && S.d.sektorler.some((x) => x.id === ui.semaSektor)) return sektorCiz(ui.semaSektor);
    ui.semaSektor = null;
    const sayimVar = S.d.bitkiSayimlari.length > 0;
    if (g.gorunum === 'sayim' && !sayimVar) g.gorunum = 'kisi';
    ekran.innerHTML = `
      <div class="sema-kap ${g.panelAcik ? 'panel-acik' : 'panel-kapali'}">
        <div class="sema-ust">
          ${segmentHtml('sema')}
          <div class="sema-gorunum">
            <button class="cip ${g.gorunum === 'kisi' ? 'aktif' : ''}" data-gor="kisi">Kişiler</button>
            <button class="cip ${g.gorunum === 'is' ? 'aktif' : ''}" data-gor="is">Bugünkü iş</button>
            ${sayimVar ? `<button class="cip ${g.gorunum === 'sayim' ? 'aktif' : ''}" data-gor="sayim">Bitki sayımı</button>` : ''}
          </div>
          ${sayimBandi()}
        </div>
        <svg id="sema" class="sema" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sera içi şema"></svg>
        <div class="h-sag sema-sag">
          <button class="h-yuvarlak" data-sm="arti" aria-label="Yakınlaştır">${ikon('arti')}</button>
          <button class="h-yuvarlak" data-sm="eksi" aria-label="Uzaklaştır"><svg class="ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
          <button class="h-yuvarlak" data-sm="tam" aria-label="Tamamını göster">${ikon('harita')}</button>
        </div>
        ${g.gorunum === 'is' ? `<div class="is-lejant"><i style="background:${IS_RENK.yapildi}"></i>Yapıldı <i style="background:${IS_RENK.kalan}"></i>Kalan <i style="background:${IS_RENK.gelmedi}"></i>Gelmedi <i style="background:${IS_RENK.yok}"></i>Kayıt yok</div>` : ''}
        <div class="h-alt sema-panel" id="sema-alt">${panelHtml()}</div>
      </div>`;
    const svg = $('#sema');
    if (!S.d.seralar.length) return;
    semaCiz(svg);
    vbUygula(svg);
    hareketKur(svg);
  }

  function segmentHtml(aktif) {
    return `<div class="seg genis-seg harita-seg">
      <button class="${aktif === 'sema' ? 'sec geldi' : ''}" data-hg="sema">Sera İçi</button>
      <button class="${aktif === 'uydu' ? 'sec geldi' : ''}" data-hg="uydu">Uydu / Konum</button>
    </div>`;
  }

  function sayimBandi() {
    if (!sayimModuAcik()) return '';
    return `<div class="sayim-bant">${ikon('kalem')}<span>Sayım modu: <b>${S.trTarih(g.sayimTarih)}</b> – gutter'a dokunup sayıyı girin</span><button class="btn kucuk" data-sm="sayim-bitir">Bitir</button></div>`;
  }

  // Panelin her zaman görünen tek satırı
  function tutamakHtml() {
    const bolum = S.d.seralar
      .map((s) => {
        const kisiler = Object.keys(S.d.yerlesim)
          .map((pid) => S.kisi(pid))
          .filter((p) => p && p.seraId === s.id);
        if (!kisiler.length) return '';
        const gelen = kisiler.filter((p) => {
          const k = S.kayit(bugun(), p.id);
          return k && k.durum === 'geldi';
        }).length;
        return `<span><b>${esc(s.ad)}</b> ${kisiler.length} kişi${gelen ? ' · ' + gelen + ' geldi' : ''}</span>`;
      })
      .filter(Boolean);
    const kar = S.karantinaListesi().length;
    return `<button class="tutamak" data-sm="panel" aria-expanded="${g.panelAcik}">
      <span class="tutamak-metin">${bolum.join('<i>│</i>') || 'Kişi yerleşimi yok'}${kar ? `<i>│</i><span class="kirmizi">⚠ ${kar} karantina</span>` : ''}</span>
      <span class="tutamak-ok">${g.panelAcik ? '▼' : '▲'}</span>
    </button>`;
  }

  function panelHtml() {
    return tutamakHtml() + (g.panelAcik ? `<div class="panel-govde">${Object.keys(S.d.yerlesim).length ? govdeHtml() : bosGovde()}</div>` : '');
  }

  function bosGovde() {
    return `<p class="ince">Henüz kişi yerleşimi yok. “SERA 1 VE 2 BİTKİ SAYISI” Excel'ini içe aktarın ya da bir sektörü açıp <b>Düzenle</b> ile sıraları kişilere boyayın.</p>
      <div class="h-butonlar"><button class="btn kucuk birincil" data-a="ice-aktar">${ikon('yukle')} Excel'den içe aktar</button><button class="btn kucuk" data-sm="yardim">Nasıl kullanılır?</button></div>`;
  }

  function govdeHtml() {
    const p = g.secili && S.kisi(g.secili);
    if (p) {
      const b = S.kisiBitki(p.id);
      const l = S.kisiGutterlari(p.id);
      const kar = S.kisiKarantina(p.id);
      const sy = S.sonSayim(p.seraId);
      return `<div class="h-satir"><p class="h-baslik"><i class="nokta-renk" style="background:${renk(p)}"></i><b>${esc(p.ad)}</b> <small>${esc(p.siraMetni || '')}</small></p><button class="btn kucuk" data-sm="kapat">Kapat</button></div>
        <p class="sema-parca">${esc(parcaMetni(p.id))}</p>
        <p class="ince">${l.length} gutter${b.son !== null ? ` · ${sayi(b.son)} bitki ${farkYaz(b.fark)} <small>(${sy ? S.trTarih(sy.tarih) + ' sayımı' : 'sayım'})</small>` : ''}</p>
        ${kar.length ? `<p class="kirmizi kucuk-yazi">⚠ Karantina sırası: ${kar.join(', ')}</p>` : ''}
        <p class="ince">${bugunkuIs(p)}</p>
        <div class="h-butonlar">
          <button class="btn kucuk birincil" data-sm="kisi-duzenle" data-id="${p.id}">${ikon('kalem')} Sıralarını düzenle</button>
          ${S.kisiParcalari(p.id)
            .map((pc) => S.sektorBul(pc.seraId, pc.harf))
            .filter((sk, i, a) => sk && a.indexOf(sk) === i)
            .map((sk) => `<button class="btn kucuk" data-sm="sektor" data-id="${sk.id}">Sektör ${esc(sk.no)}</button>`)
            .join('')}
        </div>`;
    }
    const sayimSatir = S.d.seralar
      .map((s) => {
        const sy = S.sonSayim(s.id);
        if (!sy) return '';
        return `<li><span>${esc(s.ad)} – son bitki sayımı <b>${S.trTarih(sy.tarih)}</b></span><span class="sag"><b>${sayi(S.seraBitkiToplami(s.id))}</b><small>bitki</small></span></li>`;
      })
      .join('');
    return `${sayimSatir ? `<ul class="liste kompakt">${sayimSatir}</ul>` : ''}
      <div class="h-butonlar uc">
        <button class="btn kucuk birincil" data-sm="kisiler">${ikon('personel')} Kişiler</button>
        <button class="btn kucuk" data-sm="karantina-liste">⚠ Karantina</button>
        <button class="btn kucuk" data-sm="sayimlar">Bitki sayımları</button>
      </div>
      <button class="link-btn" data-sm="yardim">Nasıl kullanılır?</button>`;
  }

  function paneliYenile() {
    const kap = $('.sema-kap');
    if (kap) {
      kap.classList.toggle('panel-acik', g.panelAcik);
      kap.classList.toggle('panel-kapali', !g.panelAcik);
    }
    const p = $('#sema-alt');
    if (p) p.innerHTML = panelHtml();
  }

  function kisiSec(pid, odaklan) {
    g.secili = pid;
    if (pid) g.panelAcik = true;
    const svg = $('#sema');
    if (svg) semaCiz(svg);
    paneliYenile();
    if (odaklan && pid && svg) {
      const rs = [];
      S.kisiGutterlari(pid).forEach((gt) => {
        const pc = parcaBul(gt.seraId, gt.harf);
        if (pc) rs.push(gutterRect(pc, gt.gutter));
      });
      if (rs.length) {
        const x1 = Math.min(...rs.map((r) => r.x)) - 40;
        const y1 = Math.min(...rs.map((r) => r.y)) - 40;
        const x2 = Math.max(...rs.map((r) => r.x + r.w)) + 40;
        const y2 = Math.max(...rs.map((r) => r.y + r.h)) + 60;
        g.vb = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        vbUygula(svg);
      }
    }
  }

  // ---------- Listeler ----------
  function kisilerSayfasi() {
    const kisiler = Object.keys(S.d.yerlesim)
      .map((pid) => S.kisi(pid))
      .filter(Boolean);
    const yerlesimsiz = S.d.personel.filter((p) => p.aktif && !S.d.yerlesim[p.id]);
    const grup = S.d.seralar
      .map((s) => {
        const l = kisiler.filter((p) => p.seraId === s.id);
        if (!l.length) return '';
        return `<h4 class="grup-baslik">${esc(s.ad)}</h4><ul class="liste">${l
          .map((p) => {
            const b = S.kisiBitki(p.id);
            const kar = S.kisiKarantina(p.id).length;
            return `<li><button class="liste-btn" data-kisi="${p.id}"><span><i class="nokta-renk" style="background:${renk(p)}"></i><b>${esc(p.ad)}${kar ? ' <span class="kirmizi">⚠</span>' : ''}</b><small>${esc(parcaMetni(p.id))}</small></span><span class="sag"><b>${S.kisiGutterlari(p.id).length}</b><small>gutter${b.son !== null ? ' · ' + sayi(b.son) + ' bitki' : ''}</small></span></button></li>`;
          })
          .join('')}</ul>`;
      })
      .join('');
    sayfaAc(
      'Kişi yerleşimi',
      `${grup || '<p class="ince">Henüz yerleşim yok.</p>'}
       ${
         yerlesimsiz.length
           ? `<h4 class="grup-baslik">Yerleşimi olmayanlar</h4><ul class="liste">${yerlesimsiz
               .map((p) => `<li><button class="liste-btn" data-yeni="${p.id}"><span><b>${esc(p.ad)}</b><small>${esc((S.sera(p.seraId) || {}).ad || '')}</small></span><span class="sag"><small>Sıra ata ›</small></span></button></li>`)
               .join('')}</ul>`
           : ''
       }`,
      (gv) => {
        $$('[data-kisi]', gv).forEach(
          (b) =>
            (b.onclick = () => {
              sayfaKapat();
              kisiSec(b.dataset.kisi, true);
            })
        );
        $$('[data-yeni]', gv).forEach((b) => (b.onclick = () => kisiDuzenleyici(b.dataset.yeni)));
      }
    );
  }

  function karantinaSayfasi() {
    const l = S.karantinaListesi();
    sayfaAc(
      'Karantina sıraları',
      l.length
        ? `<ul class="liste">${l
            .map(
              (k) => `<li><button class="liste-btn" data-kar="${k.seraId}|${k.harf}|${k.no}"><span><b>${esc((S.sera(k.seraId) || {}).ad)} · ${esc(S.sektorAdi(k.seraId, k.harf))} · ${k.harf}${k.no}</b><small>${k.kisiler.map((p) => esc(p.ad)).join(', ') || 'kişi atanmamış'}${k.not ? ' · ' + esc(k.not) : ''}</small></span><span class="sag"><small>${S.trTarih(k.tarih)}</small></span></button></li>`
            )
            .join('')}</ul><p class="ince">Bir sıraya dokunarak açın; karantinayı gutter sayfasından kaldırabilirsiniz.</p>`
        : `<p class="ince">Karantina sırası yok. İşaretlemek için bir sektörü açın: gutter'a dokunup “Karantina sırası”nı işaretleyin ya da <b>Düzenle › Karantina</b> fırçasıyla sıralara dokunun.</p>`,
      (gv) =>
        $$('[data-kar]', gv).forEach(
          (b) =>
            (b.onclick = () => {
              const [sid, harf, no] = b.dataset.kar.split('|');
              const sk = S.sektorBul(sid, harf);
              if (!sk) return;
              sayfaKapat();
              ui.semaSektor = sk.id;
              sektorCiz(sk.id);
              setTimeout(() => gutterSayfasi(sk, harf, +no), 250);
            })
        )
    );
  }

  function sayimlarSayfasi() {
    const tarihler = Array.from(new Set(S.d.bitkiSayimlari.map((x) => x.tarih))).sort().reverse();
    sayfaAc(
      'Bitki sayımları',
      `<p class="ince">Bitki sayımı her gün yapılmaz; harita yerleşim ve günlük işe göre çalışır. Sayım yaptığınız gün yeni sayım açın, gutter'lara dokunarak sayıları girin. Girmediğiniz gutter'lar önceki sayımdan aynen kopyalanır.</p>
       <label class="alan-blok"><span>Yeni sayım tarihi</span><input type="date" id="sy-tarih" value="${bugun()}"></label>
       <button class="btn birincil genis" id="sy-ac">${sayimModuAcik() ? 'Sayım modunu bu tarihe geçir' : 'Sayım modunu aç'}</button>
       ${sayimModuAcik() ? `<button class="btn genis" id="sy-bitir">Sayım modunu kapat (${S.trTarih(g.sayimTarih)})</button>` : ''}
       ${
         tarihler.length
           ? `<h4 class="grup-baslik">Kayıtlı sayımlar</h4><ul class="liste">${tarihler
               .map((t) => {
                 const l = S.d.bitkiSayimlari.filter((x) => x.tarih === t);
                 const top = l.reduce((a, sy) => a + Object.values(sy.sayilar).reduce((x, y) => x + (y || 0), 0), 0);
                 return `<li><span><b>${S.trTarih(t)}</b><small> ${l.map((sy) => esc((S.sera(sy.seraId) || {}).ad)).join(', ')}</small></span><span class="sag"><b>${sayi(top)}</b><button class="link-btn kirmizi" data-sy-sil="${t}">Sil</button></span></li>`;
               })
               .join('')}</ul>`
           : ''
       }`,
      (gv) => {
        $('#sy-ac', gv).onclick = () => {
          const t = $('#sy-tarih', gv).value || bugun();
          g.sayimTarih = t;
          lsYaz('sayimModu', t);
          g.gorunum = 'sayim';
          lsYaz('semaGorunum', 'sayim');
          sayfaKapat();
          toast(`Sayım modu: ${S.trTarih(t)}`);
          yenidenCiz();
        };
        const bt = $('#sy-bitir', gv);
        if (bt)
          bt.onclick = () => {
            sayimBitir();
            sayfaKapat();
          };
        $$('[data-sy-sil]', gv).forEach(
          (b) =>
            (b.onclick = () => {
              if (!confirm(`${S.trTarih(b.dataset.sySil)} tarihli bitki sayımı silinsin mi?`)) return;
              S.d.bitkiSayimlari = S.d.bitkiSayimlari.filter((x) => x.tarih !== b.dataset.sySil);
              if (g.sayimTarih === b.dataset.sySil) sayimBitir(true);
              S.kaydet();
              sayimlarSayfasi();
            })
        );
      }
    );
  }
  function sayimBitir(sessiz) {
    g.sayimTarih = null;
    lsYaz('sayimModu', null);
    if (!sessiz) toast('Sayım modu kapatıldı');
    yenidenCiz();
  }
  function yenidenCiz() {
    if (ui.sekme !== 'harita') return;
    if (ui.semaSektor) sektorCiz(ui.semaSektor);
    else ciz();
  }

  function yardim() {
    sayfaAc(
      'Sera İçi nasıl kullanılır?',
      `<ul class="adimlar">
        <li><b>Bir sıraya dokunun:</b> kimin olduğu, sıraları ve bugünkü işi açılır.</li>
        <li><b>Sektör adına dokunun:</b> gutter'lar numaralarıyla açılır.</li>
        <li><b>Düzenle</b> (sektör ekranında): bir kişi seçip gutter'lara dokunarak sıraları atayın; <b>Sol / Sağ</b> ile sıranın sadece bir tarafını verin; <b>Aralık</b> ile iki gutter arasını tek seferde boyayın; <b>Karantina</b> fırçasıyla sıraları işaretleyin.</li>
        <li><b>Sıralarını düzenle</b> (kişi kartında): başlangıç ve bitiş gutter'larını elle yazın (ör. G13 → G20, dönüşler için 60 → 52).</li>
        <li><b>Bugünkü iş:</b> Günlük ekranındaki kayıtlara göre yapılan (yeşil) ve kalan (turuncu) sıraları gösterir.</li>
        <li><b>Bitki sayımı:</b> sadece sayım yaptığınız günler için. Panelde “Bitki sayımları” › sayım modunu açın.</li>
        <li>İki parmakla yakınlaştırın, tek parmakla kaydırın. Alt şeride dokunarak paneli açıp kapatın.</li>
      </ul>`
    );
  }

  // ---------- Sektör detayı ----------
  // Bu sektörde sırası olanlar + diğer aktif personel (ayrı liste)
  function sektorKisileri(sk) {
    const set = new Set();
    Object.keys(S.d.yerlesim).forEach((pid) => {
      if (S.d.yerlesim[pid].some((x) => x.seraId === sk.seraId && sk.harfler.includes(x.harf))) set.add(pid);
    });
    const burada = S.d.personel.filter((p) => set.has(p.id));
    const diger = S.d.personel.filter((p) => p.aktif && !set.has(p.id)).sort((a, b) => (a.seraId === sk.seraId ? 0 : 1) - (b.seraId === sk.seraId ? 0 : 1));
    return { burada, diger };
  }

  function sektorCiz(id) {
    const sk = S.d.sektorler.find((x) => x.id === id);
    if (!sk) return ciz();
    const sera = S.sera(sk.seraId) || {};
    const ekran = $('#ekran');
    const sy = gosterilenSayim(sk.seraId);
    const once = oncekiSayimi(sy);
    const pcs = parcalar(sk);
    const CW = 26;
    const toplamN = pcs.reduce((a, p) => a + p.n, 0);
    const W = toplamN * CW + 20;
    const H = 330;
    const isR = g.gorunum === 'is' ? isRenkleri() : null;
    let toplam = 0;
    let onceToplam = 0;
    let html = `<defs>${DEFS}</defs>`;
    let x0 = 10;
    pcs.forEach((pc) => {
      const sira = [];
      for (let i = 0; i < pc.n; i++) sira.push(pc.yon === 'sol' ? i + 1 : pc.n - i);
      sira.forEach((no, i) => {
        const x = x0 + i * CW;
        const dilim = S.gutterDilimleri(sk.seraId, pc.harf, no);
        const v = S.gutterBitki(sy, pc.harf, no);
        const o = S.gutterBitki(once, pc.harf, no);
        if (v !== null) toplam += v;
        if (o !== null) onceToplam += o;
        const fark = v !== null && o !== null ? v - o : null;
        const cy = 40 + (H - 90) / 2;
        const kar = S.karantinaMi(sk.seraId, pc.harf, no);
        const ilk = g.duz.aktif && g.duz.ilk && g.duz.ilk.harf === pc.harf && g.duz.ilk.no === no;
        const parca = dilim.length ? dilim : [{ p: null }];
        html += `<g class="d-gutter ${ilk ? 'ilk' : ''}" data-harf="${pc.harf}" data-no="${no}">
          <rect x="${x}" y="0" width="${CW}" height="${H}" fill="transparent"/>
          ${parca
            .map((d, di) => {
              const ww = (CW - 2) / parca.length;
              const fill = d.p ? (isR ? isR[d.p.id + '|' + sk.seraId + pc.harf + no] || IS_RENK.yok : renk(d.p)) : 'var(--yuzey-2)';
              return `<rect x="${x + di * ww}" y="40" width="${ww - (parca.length > 1 ? 0.6 : 0)}" height="${H - 90}" rx="3" fill="${fill}" fill-opacity="${d.p ? 0.8 : 1}"/>`;
            })
            .join('')}
          ${parca.length > 1 ? `<text x="${x + 6}" y="50" class="d-taraf">S</text><text x="${x + CW - 8}" y="50" class="d-taraf" text-anchor="end">Ğ</text>` : ''}
          ${kar ? `<rect x="${x}" y="40" width="${CW - 2}" height="${H - 90}" rx="3" class="s-karantina"/>` : ''}
          ${ilk ? `<rect x="${x - 1}" y="39" width="${CW}" height="${H - 88}" rx="4" class="d-ilk"/>` : ''}
          <text x="${x + CW / 2 - 1}" y="${cy}" class="d-sayi" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${x + CW / 2 - 1} ${cy})">${v === null ? '' : v}</text>
          ${fark ? `<text x="${x + CW / 2 - 1}" y="${H - 58}" class="d-fark ${fark < 0 ? 'eksi' : 'arti'}" text-anchor="middle">${fark > 0 ? '+' : ''}${fark}</text>` : ''}
          <text x="${x + CW / 2 - 1}" y="${H - 34}" class="d-no" text-anchor="middle">${no}</text>
          <text x="${x + CW / 2 - 1}" y="${H - 20}" class="d-harf" text-anchor="middle">${kar ? '⚠' : pc.harf}</text>
        </g>`;
      });
      Object.keys(S.d.yerlesim).forEach((pid) => {
        const p = S.kisi(pid);
        if (!p) return;
        S.kisiParcalari(pid)
          .filter((x) => x.seraId === sk.seraId && x.harf === pc.harf)
          .forEach((x) => {
            const i1 = sira.indexOf(x.bas);
            const i2 = sira.indexOf(x.bit);
            if (i1 < 0 || i2 < 0) return;
            const a = x0 + Math.min(i1, i2) * CW;
            const b = x0 + (Math.max(i1, i2) + 1) * CW - 2;
            const y = x.taraf === 'sag' ? 22 : 8;
            const h = x.taraf ? 13 : 24;
            const ad = b - a > p.ad.length * 6.5 ? p.ad : p.ad.split(' ')[0];
            html += `<rect x="${a}" y="${y}" width="${b - a}" height="${h}" rx="5" fill="${renk(p)}"/>
              <text x="${(a + b) / 2}" y="${y + h / 2}" class="d-ad ${x.taraf ? 'kucuk' : ''}" text-anchor="middle" dominant-baseline="central">${esc(ad + (x.taraf ? ' (' + TARAF_AD[x.taraf] + ')' : ''))}</text>`;
          });
      });
      x0 += pc.n * CW;
    });
    const { burada, diger } = sektorKisileri(sk);
    const d = g.duz;
    const fircaKisi = d.firca && S.kisi(d.firca);
    if (fircaKisi && !burada.includes(fircaKisi)) burada.push(fircaKisi);
    ekran.innerHTML = `
      <div class="sektor-ekran">
        <div class="sektor-ust">
          <button class="geri" data-sm="geri">${ikon('sol')} Şema</button>
          <h1 class="baslik">${esc(sera.ad || '')} · Sektör ${esc(sk.no)}</h1>
          ${sayimBandi()}
          <p class="ince">${pcs.map((p) => `${p.harf}: ${p.n} gutter`).join(' · ')}${sy ? ` · ${sayi(toplam)} bitki ${once ? farkYaz(toplam - onceToplam) : ''} <small>(${S.trTarih(sy.tarih)} sayımı)</small>` : ''}${S.karantinaListesi(sk.seraId).filter((k) => sk.harfler.includes(k.harf)).length ? ` · <span class="kirmizi">⚠ ${S.karantinaListesi(sk.seraId).filter((k) => sk.harfler.includes(k.harf)).length} karantina</span>` : ''}</p>
          ${(() => {
            const t = S.d.tahminler.filter((x) => x.sektorler && x.sektorler[sk.id]).slice(-1)[0];
            if (!t) return '';
            const x = S.tahminHesapla(t).sektorler.find((y) => y.skId === sk.id);
            return x ? `<p class="ince kucuk-yazi">Son hasat tahmini ${S.trTarih(t.tarih)}: ort ${S.sayiYaz(x.ort)} salkım/sıra · ${sayi(x.salkim)} salkım · ≈ <b>${sayi(x.ortKutu)}</b> kutu</p>` : '';
          })()}
          <div class="arac-cubugu">
            <button class="btn kucuk ${d.aktif ? 'birincil' : ''}" data-sm="duzenle">${ikon('kalem')} ${d.aktif ? 'Düzenlemeyi bitir' : 'Düzenle'}</button>
            <button class="btn kucuk" data-sm="sektor-ayar">⚙ Sektör ayarı</button>
            <button class="btn kucuk" data-sm="sayimlar">Bitki sayımları</button>
          </div>
          ${
            d.aktif
              ? `<div class="duzen-panel">
            <p class="kucuk-yazi"><b>Fırça seçin</b>, sonra gutter'lara dokunun:</p>
            <div class="kisi-cipler">
              <button class="cip karantina-cip ${d.firca === 'karantina' ? 'aktif' : ''}" data-firca="karantina">⚠ Karantina</button>
              <button class="cip ${d.firca === 'bosalt' ? 'aktif' : ''}" data-firca="bosalt">✕ Boşalt</button>
              ${burada.map((p) => `<button class="cip ${d.firca === p.id ? 'aktif' : ''}" data-firca="${p.id}" style="--r:${renk(p)}"><i></i>${esc(p.ad)}</button>`).join('')}
            </div>
            ${diger.length ? `<select id="d-diger" class="d-diger"><option value="">+ Başka kişi seç…</option>${diger.map((p) => `<option value="${p.id}">${esc(p.ad)} · ${esc((S.sera(p.seraId) || {}).ad || '')}</option>`).join('')}</select>` : ''}
            <div class="duzen-secenek">
              <div class="seg"><button class="${!d.taraf ? 'sec geldi' : ''}" data-taraf="">Tüm sıra</button><button class="${d.taraf === 'sol' ? 'sec geldi' : ''}" data-taraf="sol">Sol taraf</button><button class="${d.taraf === 'sag' ? 'sec geldi' : ''}" data-taraf="sag">Sağ taraf</button></div>
              <label class="onay"><input type="checkbox" id="d-aralik" ${d.aralik ? 'checked' : ''}> Aralık</label>
            </div>
            <p class="ince kucuk-yazi">${d.aralik ? (d.ilk ? `Başlangıç: <b>${d.ilk.harf}${d.ilk.no}</b> – şimdi bitiş gutter'ına dokunun.` : 'Aralık: önce başlangıç, sonra bitiş gutter\'ına dokunun.') : 'Her dokunuş tek gutter\'ı boyar.'}</p>
          </div>`
              : `<p class="ince kucuk-yazi">Giriş tarafı altta. Gutter'a dokunarak kişiyi, sol/sağ tarafı, karantinayı${sayimModuAcik() ? ' ve bitki sayısını' : ''} değiştirin.</p>`
          }
        </div>
        <div class="sektor-kaydir"><svg class="sektor-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${html}</svg></div>
      </div>`;
    $$('.d-gutter', ekran).forEach((gEl) =>
      gEl.addEventListener('click', () => (g.duz.aktif ? fircaUygula(sk, gEl.dataset.harf, +gEl.dataset.no) : gutterSayfasi(sk, gEl.dataset.harf, +gEl.dataset.no)))
    );
    const dg = $('#d-diger', ekran);
    if (dg)
      dg.onchange = (e) => {
        if (!e.target.value) return;
        g.duz.firca = e.target.value;
        g.duz.ilk = null;
        sektorCiz(sk.id);
      };
    const ar = $('#d-aralik', ekran);
    if (ar)
      ar.onchange = (e) => {
        g.duz.aralik = e.target.checked;
        g.duz.ilk = null;
        sektorCiz(sk.id);
      };
  }

  function fircaUygula(sk, harf, no) {
    const d = g.duz;
    if (!d.firca) return toast('Önce bir fırça (kişi, karantina ya da boşalt) seçin');
    let hedefler = [no];
    if (d.aralik) {
      if (!d.ilk || d.ilk.harf !== harf) {
        d.ilk = { harf, no };
        return sektorCiz(sk.id);
      }
      const a = d.ilk.no;
      hedefler = [];
      for (let i = a; a <= no ? i <= no : i >= no; a <= no ? i++ : i--) hedefler.push(i);
      d.ilk = null;
    }
    hedefler.forEach((n) => {
      if (d.firca === 'karantina') {
        const acik = d.aralik ? true : !S.karantinaMi(sk.seraId, harf, n);
        S.karantinaAyarla(sk.seraId, harf, n, acik);
      } else if (d.firca === 'bosalt') {
        if (d.taraf) {
          S.gutterDilimleri(sk.seraId, harf, n)
            .filter((x) => x.taraf === d.taraf)
            .forEach((x) => S.kisidenCikar(x.p.id, sk.seraId, harf, n));
        } else S.gutterAta(sk.seraId, harf, n, null, null);
      } else S.gutterAta(sk.seraId, harf, n, d.firca, d.taraf);
    });
    S.kaydet();
    sektorCiz(sk.id);
  }

  function sektorAyar(sk) {
    sayfaAc(
      `Sektör ${sk.no} ayarı`,
      `${sk.harfler
        .map(
          (h) => `<label class="alan-blok"><span>${h} tüneli gutter sayısı</span><input class="sa-n" data-h="${h}" inputmode="numeric" value="${(sk.gutterSayilari && sk.gutterSayilari[h]) || ''}" placeholder="otomatik: ${S.gutterSayisi(sk.seraId, h)}"></label>`
        )
        .join('')}
       <label class="alan-blok"><span>1. gutter hangi kenarda? (girişten bakınca)</span><select id="sa-yon"><option value="sol" ${sk.yon === 'sol' ? 'selected' : ''}>Sol kenarda</option><option value="sag" ${sk.yon === 'sag' ? 'selected' : ''}>Sağ kenarda</option></select></label>
       <p class="ince">Gutter sayısını boş bırakırsanız yerleşim ve sayımdaki en büyük numaradan bulunur.</p>
       <button class="btn birincil genis" id="sa-kaydet">Kaydet</button>`,
      (gv) =>
        ($('#sa-kaydet', gv).onclick = () => {
          sk.gutterSayilari = {};
          $$('.sa-n', gv).forEach((i) => {
            const n = parseInt(i.value, 10);
            if (n > 0) sk.gutterSayilari[i.dataset.h] = n;
          });
          sk.yon = $('#sa-yon', gv).value;
          S.kaydet();
          sayfaKapat();
          sektorCiz(sk.id);
        })
    );
  }

  // ---------- Gutter sayfası ----------
  function gutterSayfasi(sk, harf, no) {
    const key = harf + no;
    const dilim = S.gutterDilimleri(sk.seraId, harf, no);
    const sy = gosterilenSayim(sk.seraId);
    const once = oncekiSayimi(sy);
    const v = S.gutterBitki(sy, harf, no);
    const o = S.gutterBitki(once, harf, no);
    const adaylar = S.d.personel.filter((p) => p.aktif && (p.seraId === sk.seraId || S.d.yerlesim[p.id]));
    const kar = (S.d.karantina[sk.seraId] || {})[key];
    let mod = dilim.length > 1 ? 'iki' : 'tek';
    const sec = (id, secili) => `<select id="${id}"><option value="">— Boş —</option>${adaylar.map((p) => `<option value="${p.id}" ${secili && secili.id === p.id ? 'selected' : ''}>${esc(p.ad)}</option>`).join('')}</select>`;
    const solP = (dilim.find((x) => x.taraf === 'sol') || {}).p;
    const sagP = (dilim.find((x) => x.taraf === 'sag') || {}).p;
    const sayimAcik = sayimModuAcik();
    sayfaAc(
      `Gutter ${key}`,
      `<p class="ince">${esc((S.sera(sk.seraId) || {}).ad)} · Sektör ${esc(sk.no)} · Tünel ${esc(S.tunelTahmin(sk.seraId, harf, no))}</p>
       <label class="onay karantina-onay"><input type="checkbox" id="g-kar" ${kar ? 'checked' : ''}> <span>⚠ Karantina sırası</span></label>
       <input id="g-kar-not" placeholder="Karantina notu (ör. virüs şüphesi)" value="${esc((kar && kar.not) || '')}" ${kar ? '' : 'hidden'}>
       <div class="alan-blok"><span>Bu sırayı kim çalışıyor?</span>
         <div class="seg genis-seg" id="g-mod"><button type="button" data-v="tek">Tek kişi</button><button type="button" data-v="iki">Sağ / sol iki kişi</button></div></div>
       <div id="g-tek"><label class="alan-blok"><span>Kişi</span>${sec('g-kisi', dilim.length === 1 ? dilim[0].p : dilim[0] && dilim[0].p)}</label></div>
       <div id="g-iki" class="iki"><label class="alan-blok"><span>Sol taraf</span>${sec('g-sol', solP)}</label><label class="alan-blok"><span>Sağ taraf</span>${sec('g-sag', sagP)}</label></div>
       <div class="sayim-kutu">
         ${
           sayimAcik
             ? `<p class="kucuk-yazi"><b>Bitki sayısı – ${S.trTarih(g.sayimTarih)} sayımı</b></p><div id="g-sayi-kap"></div>`
             : `<p class="ince">Bitki: <b>${sayi(v)}</b>${sy ? ` <small>(${S.trTarih(sy.tarih)} sayımı)</small>` : ' <small>(sayım yok)</small>'}${once && v !== null && o !== null ? ' · önceki ' + sayi(o) + ' ' + farkYaz(v - o) : ''}</p><button type="button" class="link-btn" id="g-sayim-ac">Bitki sayımı gir ›</button>`
         }
       </div>
       <button class="btn birincil genis" id="g-kaydet">Kaydet</button>`,
      (gv) => {
        const sayiAlanlari = () => {
          const kap = $('#g-sayi-kap', gv);
          if (!kap) return;
          const sayimSy = sayimOku(sk.seraId);
          if (mod === 'iki') {
            const kisiler = [['sol', $('#g-sol', gv).value], ['sag', $('#g-sag', gv).value]].filter((x) => x[1]);
            kap.innerHTML = kisiler.length
              ? kisiler
                  .map(([t, pid]) => `<label class="alan-blok"><span>${TARAF_AD[t]} taraf – ${esc((S.kisi(pid) || {}).ad)}</span><input class="g-pay" data-pid="${pid}" inputmode="numeric" value="${S.kisiGutterBitki(sayimSy, pid, harf, no) ?? ''}"></label>`)
                  .join('')
              : '<p class="ince">Önce kişileri seçin.</p>';
          } else kap.innerHTML = `<input id="g-sayi" inputmode="numeric" value="${S.gutterBitki(sayimSy, harf, no) ?? ''}">`;
        };
        const modGoster = () => {
          $$('#g-mod button', gv).forEach((b) => b.classList.toggle('sec', b.dataset.v === mod));
          $('#g-tek', gv).hidden = mod !== 'tek';
          $('#g-iki', gv).hidden = mod !== 'iki';
          sayiAlanlari();
        };
        $('#g-mod', gv).addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b) return;
          mod = b.dataset.v;
          modGoster();
        });
        ['#g-sol', '#g-sag'].forEach((s) => $(s, gv).addEventListener('change', sayiAlanlari));
        $('#g-kar', gv).onchange = (e) => ($('#g-kar-not', gv).hidden = !e.target.checked);
        const sa = $('#g-sayim-ac', gv);
        if (sa)
          sa.onclick = () => {
            sayfaKapat();
            setTimeout(sayimlarSayfasi, 250);
          };
        modGoster();
        $('#g-kaydet', gv).onclick = () => {
          // Kişiler
          if (mod === 'tek') {
            S.gutterAta(sk.seraId, harf, no, $('#g-kisi', gv).value || null, null);
          } else {
            const sol = $('#g-sol', gv).value;
            const sag = $('#g-sag', gv).value;
            if (sol && sol === sag) return toast('Sol ve sağ için farklı kişiler seçin');
            S.gutterDilimleri(sk.seraId, harf, no).forEach((x) => x.p.id !== sol && x.p.id !== sag && S.kisidenCikar(x.p.id, sk.seraId, harf, no));
            if (sol) S.gutterAta(sk.seraId, harf, no, sol, 'sol');
            if (sag) S.gutterAta(sk.seraId, harf, no, sag, 'sag');
          }
          // Karantina
          S.karantinaAyarla(sk.seraId, harf, no, $('#g-kar', gv).checked, $('#g-kar-not', gv).value.trim());
          // Bitki sayısı (yalnız sayım modunda)
          if (sayimAcik) {
            const bs = sayimAl(sk.seraId);
            bs.kisi = bs.kisi || {};
            if (mod === 'tek') {
              const n = S.sayi(($('#g-sayi', gv) || {}).value);
              if (n !== null) {
                bs.sayilar[key] = n;
                Object.values(bs.kisi).forEach((m) => delete m[key]);
                const pid = $('#g-kisi', gv).value;
                if (pid) (bs.kisi[pid] = bs.kisi[pid] || {})[key] = n;
              }
            } else {
              $$('.g-pay', gv).forEach((i) => {
                const n = S.sayi(i.value);
                if (n !== null) (bs.kisi[i.dataset.pid] = bs.kisi[i.dataset.pid] || {})[key] = n;
              });
              S.gutterToplamGuncelle(bs, sk.seraId, harf, no);
            }
          }
          S.kaydet();
          sayfaKapat();
          sektorCiz(sk.id);
          toast('Kaydedildi');
        };
      }
    );
  }

  // ---------- Kişinin sıralarını elle düzenleme ----------
  function kisiDuzenleyici(pid) {
    const p = S.kisi(pid);
    if (!p) return;
    const sekler = sektorSecenekleri();
    let satirlar = S.kisiParcalari(pid).map((pc) => ({ sk: pc.seraId + '|' + pc.harf, bas: pc.bas, bit: pc.bit, taraf: pc.taraf || '' }));
    if (!satirlar.length) {
      const ilk = sekler.find((x) => x.deger.startsWith(p.seraId + '|')) || sekler[0];
      satirlar = [{ sk: ilk ? ilk.deger : '', bas: '', bit: '', taraf: '' }];
    }
    const gutterlar = () => {
      const out = [];
      satirlar.forEach((r) => {
        const [seraId, harf] = r.sk.split('|');
        const a = parseInt(r.bas, 10);
        const b = parseInt(r.bit === '' ? r.bas : r.bit, 10);
        if (!seraId || !(a > 0) || !(b > 0)) return;
        for (let i = a; a <= b ? i <= b : i >= b; a <= b ? i++ : i--) out.push({ seraId, harf, gutter: i, taraf: r.taraf || null });
      });
      return out;
    };
    const ciz2 = (gv) => {
      $('#kd-satirlar', gv).innerHTML = satirlar
        .map(
          (r, i) => `<div class="kd-satir" data-i="${i}">
          <select data-f="sk">${sekler.map((s) => `<option value="${s.deger}" ${s.deger === r.sk ? 'selected' : ''}>${esc(s.ad)}</option>`).join('')}</select>
          <div class="kd-alt">
            <input data-f="bas" inputmode="numeric" placeholder="Baş" value="${r.bas}">
            <span>→</span>
            <input data-f="bit" inputmode="numeric" placeholder="Bitiş" value="${r.bit}">
            <select data-f="taraf"><option value="" ${!r.taraf ? 'selected' : ''}>Tüm</option><option value="sol" ${r.taraf === 'sol' ? 'selected' : ''}>Sol</option><option value="sag" ${r.taraf === 'sag' ? 'selected' : ''}>Sağ</option></select>
            <button type="button" class="ikon-btn" data-k="yukari" ${i === 0 ? 'disabled' : ''}>${ikon('yukari')}</button>
            <button type="button" class="ikon-btn" data-k="sil">${ikon('sil')}</button>
          </div>
        </div>`
        )
        .join('');
      ozet(gv);
    };
    const ozet = (gv) => {
      const l = gutterlar();
      const sek = Array.from(new Set(l.map((x) => S.sektorAdi(x.seraId, x.harf).replace('Sektör ', '')))).join(' → ');
      $('#kd-ozet', gv).innerHTML = l.length ? `<b>${l.length} gutter</b> · Sektör ${esc(sek)}${p.toplamSira ? ` <small>(sıra sayısı: ${S.sayiYaz(p.toplamSira)})</small>` : ''}` : 'Henüz sıra yok';
    };
    sayfaAc(
      `${p.ad} – sıraları`,
      `<p class="ince">Her satır bir parça: sektör, başlangıç ve bitiş gutter'ı. Dönüşlerde başlangıç büyük olabilir (ör. 60 → 52). Sağ/sol: sıranın sadece bir tarafını çalışıyorsa seçin.</p>
       <div id="kd-satirlar"></div>
       <button type="button" class="btn kucuk" id="kd-ekle">${ikon('arti')} Parça ekle</button>
       <p class="ince" id="kd-ozet"></p>
       <button class="btn birincil genis" id="kd-kaydet">Kaydet</button>
       ${S.kisiGutterlari(pid).length ? '<button class="btn tehlike genis" id="kd-temizle">Tüm sıralarını kaldır</button>' : ''}`,
      (gv) => {
        ciz2(gv);
        const kap = $('#kd-satirlar', gv);
        kap.addEventListener('input', (e) => {
          const s = e.target.closest('.kd-satir');
          if (!s || !e.target.dataset.f) return;
          satirlar[+s.dataset.i][e.target.dataset.f] = e.target.value;
          ozet(gv);
        });
        kap.addEventListener('change', (e) => {
          const s = e.target.closest('.kd-satir');
          if (!s || !e.target.dataset.f) return;
          satirlar[+s.dataset.i][e.target.dataset.f] = e.target.value;
          ozet(gv);
        });
        kap.addEventListener('click', (e) => {
          const b = e.target.closest('[data-k]');
          if (!b) return;
          const i = +b.closest('.kd-satir').dataset.i;
          if (b.dataset.k === 'sil') satirlar.splice(i, 1);
          if (b.dataset.k === 'yukari' && i > 0) [satirlar[i - 1], satirlar[i]] = [satirlar[i], satirlar[i - 1]];
          ciz2(gv);
        });
        $('#kd-ekle', gv).onclick = () => {
          const son = satirlar[satirlar.length - 1];
          satirlar.push({ sk: son ? son.sk : sekler[0].deger, bas: '', bit: '', taraf: '' });
          ciz2(gv);
        };
        const tm = $('#kd-temizle', gv);
        if (tm)
          tm.onclick = () => {
            if (!confirm(`${p.ad} için tüm sıralar kaldırılsın mı?`)) return;
            delete S.d.yerlesim[pid];
            S.kaydet();
            sayfaKapat();
            yenidenCiz();
          };
        $('#kd-kaydet', gv).onclick = () => {
          const yeni = gutterlar();
          // Çakışmalar: başka kişinin aynı gutter/taraf'ı
          const cakisma = [];
          yeni.forEach((n) => {
            S.gutterDilimleri(n.seraId, n.harf, n.gutter).forEach((x) => {
              if (x.p.id === pid) return;
              const digerTaraf = x.kayit.taraf || null; // kayıtlı taraf (yoksa tüm sıra)
              if (!n.taraf || !digerTaraf || digerTaraf === n.taraf) cakisma.push({ n, x });
            });
          });
          const uygula = (karar) => {
            const tuneller = {};
            yeni.forEach((n) => (tuneller[n.seraId + n.harf + n.gutter] = S.tunelTahmin(n.seraId, n.harf, n.gutter)));
            cakisma.forEach(({ n, x }) => {
              if (karar === 'cikar') {
                if (n.taraf && !x.kayit.taraf) x.kayit.taraf = n.taraf === 'sol' ? 'sag' : 'sol';
                else S.kisidenCikar(x.p.id, n.seraId, n.harf, n.gutter);
              } else {
                // paylaş: diğeri bir tarafta, bu kişi karşı tarafta
                const digeri = x.kayit.taraf || (n.taraf ? (n.taraf === 'sol' ? 'sag' : 'sol') : 'sol');
                x.kayit.taraf = digeri;
                n.taraf = digeri === 'sol' ? 'sag' : 'sol';
              }
            });
            S.d.yerlesim[pid] = yeni.map((n) => ({ seraId: n.seraId, harf: n.harf, gutter: n.gutter, tunel: tuneller[n.seraId + n.harf + n.gutter], etiket: '', taraf: n.taraf || null }));
            if (!S.d.yerlesim[pid].length) delete S.d.yerlesim[pid];
            Object.keys(S.d.yerlesim).forEach((k) => !S.d.yerlesim[k].length && delete S.d.yerlesim[k]);
            S.kaydet();
            sayfaKapat();
            toast('Sıralar kaydedildi');
            if (ui.sekme === 'harita') {
              if (ui.semaSektor) sektorCiz(ui.semaSektor);
              else kisiSec(pid, true);
            } else A.ciz();
          };
          if (!cakisma.length) return uygula('cikar');
          const kisiler = {};
          cakisma.forEach(({ n, x }) => (kisiler[x.p.ad] = (kisiler[x.p.ad] || []).concat(n.harf + n.gutter)));
          sayfaAc(
            'Çakışan sıralar',
            `<p>Bu sıralar başka kişilere de yazılı:</p>
             <ul class="liste">${Object.entries(kisiler)
               .map(([ad, l]) => `<li><span><b>${esc(ad)}</b></span><small>${l.join(', ')}</small></li>`)
               .join('')}</ul>
             <button class="btn birincil genis" id="ck-cikar">Diğerlerinden çıkar (${esc(p.ad)}'a ver)</button>
             <button class="btn genis" id="ck-paylas">Sağ / sol olarak paylaş</button>
             <button class="btn genis" data-kapat>Vazgeç</button>`,
            (cv) => {
              $('#ck-cikar', cv).onclick = () => uygula('cikar');
              $('#ck-paylas', cv).onclick = () => uygula('paylas');
            }
          );
        };
      }
    );
  }

  // ---------- Olaylar ----------
  $('#ekran').addEventListener('click', (e) => {
    if (ui.sekme !== 'harita') return;
    const hg = e.target.closest('[data-hg]');
    if (hg) {
      const ekran = $('#ekran');
      if (ekran._ayril) {
        const f = ekran._ayril;
        ekran._ayril = null;
        f();
      }
      ui.haritaGorunum = hg.dataset.hg;
      ui.semaSektor = null;
      return A.ekranlar.harita();
    }
    if ((ui.haritaGorunum || 'sema') !== 'sema') return;
    const gor = e.target.closest('[data-gor]');
    if (gor) {
      g.gorunum = gor.dataset.gor;
      lsYaz('semaGorunum', g.gorunum);
      return ciz();
    }
    const fr = e.target.closest('[data-firca]');
    if (fr) {
      g.duz.firca = fr.dataset.firca;
      g.duz.ilk = null;
      return sektorCiz(ui.semaSektor);
    }
    const tr = e.target.closest('[data-taraf]');
    if (tr) {
      g.duz.taraf = tr.dataset.taraf || null;
      return sektorCiz(ui.semaSektor);
    }
    const ac = e.target.closest('[data-sektor-ac]');
    if (ac) {
      ui.semaSektor = ac.dataset.sektorAc;
      return sektorCiz(ui.semaSektor);
    }
    const gt = e.target.closest('.s-gutter');
    if (gt) {
      if (gt.dataset.kisi) kisiSec(gt.dataset.kisi);
      else {
        const sk = S.sektorBul(gt.dataset.sera, gt.dataset.harf);
        if (sk) gutterSayfasi(sk, gt.dataset.harf, +gt.dataset.no);
      }
      return;
    }
    const b = e.target.closest('[data-sm]');
    if (!b) return;
    const svg = $('#sema');
    switch (b.dataset.sm) {
      case 'arti':
        return yakinlastir(svg, 1.6);
      case 'eksi':
        return yakinlastir(svg, 1 / 1.6);
      case 'tam':
        g.vb = null;
        return vbUygula(svg);
      case 'panel':
        g.panelAcik = !g.panelAcik;
        lsYaz('semaPanel', g.panelAcik);
        return paneliYenile();
      case 'kapat':
        g.secili = null;
        g.panelAcik = lsAl('semaPanel', false);
        semaCiz(svg);
        return paneliYenile();
      case 'kisiler':
        return kisilerSayfasi();
      case 'karantina-liste':
        return karantinaSayfasi();
      case 'sayimlar':
        return sayimlarSayfasi();
      case 'sayim-bitir':
        return sayimBitir();
      case 'yardim':
        return yardim();
      case 'kisi-duzenle':
        return kisiDuzenleyici(b.dataset.id);
      case 'sektor':
        ui.semaSektor = b.dataset.id;
        return sektorCiz(ui.semaSektor);
      case 'geri':
        ui.semaSektor = null;
        g.duz.aktif = false;
        g.duz.ilk = null;
        return ciz();
      case 'duzenle':
        g.duz.aktif = !g.duz.aktif;
        g.duz.ilk = null;
        return sektorCiz(ui.semaSektor);
      case 'sektor-ayar':
        return sektorAyar(S.d.sektorler.find((x) => x.id === ui.semaSektor));
    }
  });

  window.Sema = { ciz, segmentHtml, parcalar, gutterRect, kisiDuzenleyici };
})();
