/* Sera Otomasyon – sera içi şema: sektörler, gutter'lar, kişi yerleşimi ve bitki sayımı */
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
  const TAM = { x: -10, y: -14, w: 720, h: 790 }; // şemanın tamamı (birim)
  const bugun = () => S.tarihStr(new Date());

  const g = {
    secili: null, // personel id
    vb: null, // görünür viewBox
  };

  function renk(p) {
    const i = S.d.personel.indexOf(p);
    return RENKLER[(i < 0 ? 0 : i) % RENKLER.length];
  }
  const sayi = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('tr-TR'));
  const farkYaz = (f) => (f ? `<b class="${f < 0 ? 'kirmizi' : 'yesil'}">${f > 0 ? '+' : ''}${f}</b>` : '');

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

  // ---------- Metinler ----------
  function parcaMetni(pid) {
    return S.kisiParcalari(pid)
      .map((pc) => `${S.sektorAdi(pc.seraId, pc.harf)}: ${pc.harf}${pc.bas}${pc.adet > 1 ? '–' + pc.bit : ''}`)
      .join(' → ');
  }
  function bugunkuIs(p) {
    const k = S.kayit(bugun(), p.id);
    if (!k) return 'Bugün kayıt yok';
    if (k.durum && k.durum !== 'geldi') return 'Bugün: ' + S.DURUMLAR[k.durum] + (k.yerine ? ' (yerine ' + esc(k.yerine) + ')' : '');
    const isler = (k.isler || []).filter((x) => x.is);
    return isler.length ? 'Bugün: ' + isler.map((x) => `${esc(x.is)} ${S.sayiYaz(S.yapilan(x))}/${S.sayiYaz(x.toplam)}`).join(' · ') : 'Bugün iş girilmedi';
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

  function semaCiz(svg) {
    svg.innerHTML = '';
    el('defs', {}, svg).innerHTML =
      '<marker id="ok" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker>' +
      '';
    const kok = el('g', { class: 's-kok' }, svg);
    // Sera çerçeveleri, yollar, giriş
    el('rect', { x: 0, y: 0, width: 700, height: 322, class: 's-sera s-sera2' }, kok);
    el('rect', { x: 0, y: 322, width: 700, height: 405, class: 's-sera' }, kok);
    metin(kok, 328, 152, 'SERA 2', { class: 's-sera-et', 'text-anchor': 'middle' });
    metin(kok, 328, 505, 'SERA 1', { class: 's-sera-et', 'text-anchor': 'middle' });
    el('path', { d: 'M318 760 L328 742 L338 760', class: 's-giris-ok' }, kok);
    metin(kok, 328, 775, 'GİRİŞ', { class: 's-giris', 'text-anchor': 'middle' });

    const seciliP = g.secili && S.kisi(g.secili);
    S.sektorleriHazirla().forEach((sk) => {
      const grup = el('g', { class: 's-sektor', 'data-sektor': sk.id }, kok);
      el('rect', { x: sk.kutu.x, y: sk.kutu.y, width: sk.kutu.w, height: sk.kutu.h, class: 's-kutu' }, grup);
      parcalar(sk).forEach((pc) => {
        for (let no = 1; no <= pc.n; no++) {
          const r = gutterRect(pc, no);
          const sahipler = S.gutterSahipleri(sk.seraId, pc.harf, no);
          // Yarım sıra: gutter boyu paylaşanlar arasında bölünür
          const dilim = sahipler.length ? sahipler : [null];
          dilim.forEach((p, di) => {
            const soluk = seciliP && p !== seciliP;
            el(
              'rect',
              {
                x: r.x,
                y: r.y + (r.h * di) / dilim.length,
                width: r.w + 0.15,
                height: r.h / dilim.length,
                fill: p ? renk(p) : 'transparent',
                'fill-opacity': p ? (soluk ? 0.12 : seciliP ? 0.95 : 0.7) : 0,
                class: 's-gutter',
                'data-sera': sk.seraId,
                'data-harf': pc.harf,
                'data-no': no,
                'data-kisi': p ? p.id : null,
              },
              grup
            );
          });
        }
        // 1. gutter işareti (yönü göstermek için)
        const r1 = gutterRect(pc, 1);
        metin(grup, r1.x + r1.w / 2, pc.y + pc.h - 3, '1', { class: 's-bir', 'text-anchor': 'middle' });
      });
      // Sektör etiketi
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
      const soluk = seciliP && seciliP !== p;
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
        // Sonraki parçaya dönüş oku
        const sonraki = prc[i + 1];
        if (!sonraki) return;
        const p2 = parcaBul(sonraki.seraId, sonraki.harf);
        if (!p2) return;
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
    const bos = !Object.keys(S.d.yerlesim).length;
    ekran.innerHTML = `
      <div class="sema-kap">
        <div class="sema-ust">
          ${segmentHtml('sema')}
        </div>
        <svg id="sema" class="sema" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sera içi şema"></svg>
        <div class="h-sag sema-sag">
          <button class="h-yuvarlak" data-sm="arti" aria-label="Yakınlaştır">${ikon('arti')}</button>
          <button class="h-yuvarlak" data-sm="eksi" aria-label="Uzaklaştır"><svg class="ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
          <button class="h-yuvarlak" data-sm="tam" aria-label="Tamamını göster">${ikon('harita')}</button>
        </div>
        <div class="h-alt" id="sema-alt">${bos ? bosPanel() : altPanel()}</div>
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

  function bosPanel() {
    return `<p class="h-baslik"><b>Kişi yerleşimi yok</b></p>
      <p class="ince">“SERA 1 VE 2 BİTKİ SAYISI” Excel dosyasını içe aktarın; herkesin tünel ve gutter'ları şemaya otomatik yerleşir.</p>
      <div class="h-butonlar"><button class="btn kucuk birincil" data-a="ice-aktar">${ikon('yukle')} Excel'den içe aktar</button><button class="btn kucuk" data-sm="kisiler">Kişiler</button></div>`;
  }

  function altPanel() {
    const p = g.secili && S.kisi(g.secili);
    if (p) {
      const b = S.kisiBitki(p.id);
      const l = S.kisiGutterlari(p.id);
      return `<div class="h-satir"><p class="h-baslik"><i class="nokta-renk" style="background:${renk(p)}"></i><b>${esc(p.ad)}</b> <small>${esc(p.siraMetni || '')}</small></p><button class="btn kucuk" data-sm="kapat">Kapat</button></div>
        <p class="sema-parca">${esc(parcaMetni(p.id))}</p>
        <p class="ince">${l.length} gutter · ${sayi(b.son)} bitki ${farkYaz(b.fark)}${b.onceki !== null ? ` <small>(önceki ${sayi(b.onceki)})</small>` : ''}</p>
        <p class="ince">${bugunkuIs(p)}</p>
        <div class="h-butonlar">
          ${S.kisiParcalari(p.id)
            .map((pc) => S.sektorBul(pc.seraId, pc.harf))
            .filter((sk, i, a) => sk && a.indexOf(sk) === i)
            .map((sk) => `<button class="btn kucuk" data-sm="sektor" data-id="${sk.id}">Sektör ${esc(sk.no)}'ü aç</button>`)
            .join('')}
          <button class="btn kucuk" data-sm="kisiler">Kişiler</button>
        </div>`;
    }
    const satirlar = S.d.seralar
      .map((s) => {
        const sy = S.sonSayim(s.id);
        const kisiler = Object.keys(S.d.yerlesim).filter((pid) => (S.kisi(pid) || {}).seraId === s.id).length;
        if (!sy && !kisiler) return '';
        const top = S.seraBitkiToplami(s.id);
        const once = S.oncekiSayim(s.id);
        const onceTop = once ? Object.values(once.sayilar).reduce((a, b) => a + (b || 0), 0) : null;
        return `<li><span><b>${esc(s.ad)}</b> · ${kisiler} kişi</span><span class="sag"><b>${sayi(top)} bitki</b> ${onceTop !== null ? farkYaz(top - onceTop) : ''}<small>${sy ? 'sayım ' + S.trTarih(sy.tarih) : ''}</small></span></li>`;
      })
      .join('');
    const bugunVar = S.d.bitkiSayimlari.some((x) => x.tarih === bugun());
    return `<ul class="liste kompakt">${satirlar}</ul>
      <p class="ince kucuk-yazi">Bir sıraya dokunun: kimin olduğu ve bitki sayısı açılır. Sektör adına dokunarak gutter detayına girin. İki parmakla yakınlaştırın.</p>
      <div class="h-butonlar">
        <button class="btn kucuk birincil" data-sm="kisiler">${ikon('personel')} Kişiler</button>
        <button class="btn kucuk" data-sm="sayim">${bugunVar ? 'Bugünkü sayım açık ✓' : 'Bugün sayım yap'}</button>
      </div>`;
  }

  function paneliYenile() {
    const p = $('#sema-alt');
    if (p) p.innerHTML = Object.keys(S.d.yerlesim).length ? altPanel() : bosPanel();
  }

  function kisiSec(pid, odaklan) {
    g.secili = pid;
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
        const y2 = Math.max(...rs.map((r) => r.y + r.h)) + 140;
        g.vb = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        vbUygula(svg);
      }
    }
  }

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
            return `<li><button class="liste-btn" data-kisi="${p.id}"><span><i class="nokta-renk" style="background:${renk(p)}"></i><b>${esc(p.ad)}</b><small>${esc(parcaMetni(p.id))}</small></span><span class="sag"><b>${sayi(b.son)}</b>${b.fark ? farkYaz(b.fark) : '<small>bitki</small>'}</span></button></li>`;
          })
          .join('')}</ul>`;
      })
      .join('');
    sayfaAc(
      'Kişi yerleşimi',
      `${grup || '<p class="ince">Henüz yerleşim yok.</p>'}
       ${yerlesimsiz.length ? `<p class="ince">Yerleşimi olmayan aktif personel: ${yerlesimsiz.map((p) => esc(p.ad)).join(', ')}. Sektör detayında gutter'a dokunup kişi atayabilirsiniz.</p>` : ''}`,
      (gv) =>
        $$('[data-kisi]', gv).forEach(
          (b) =>
            (b.onclick = () => {
              sayfaKapat();
              kisiSec(b.dataset.kisi, true);
            })
        )
    );
  }

  // ---------- Sektör detayı ----------
  function sektorCiz(id) {
    const sk = S.d.sektorler.find((x) => x.id === id);
    const sera = S.sera(sk.seraId) || {};
    const ekran = $('#ekran');
    const sy = S.sonSayim(sk.seraId);
    const once = S.oncekiSayim(sk.seraId);
    const pcs = parcalar(sk);
    const CW = 26;
    const toplamN = pcs.reduce((a, p) => a + p.n, 0);
    const W = toplamN * CW + 20;
    const H = 330;
    let toplam = 0;
    let onceToplam = 0;
    let html = '';
    let x0 = 10;
    pcs.forEach((pc) => {
      const sira = [];
      for (let i = 0; i < pc.n; i++) sira.push(pc.yon === 'sol' ? i + 1 : pc.n - i);
      sira.forEach((no, i) => {
        const x = x0 + i * CW;
        const sahipler = S.gutterSahipleri(sk.seraId, pc.harf, no);
        const v = S.gutterBitki(sy, pc.harf, no);
        const o = S.gutterBitki(once, pc.harf, no);
        if (v !== null) toplam += v;
        if (o !== null) onceToplam += o;
        const fark = v !== null && o !== null ? v - o : null;
        const cy = 40 + (H - 90) / 2;
        html += `<g class="d-gutter" data-harf="${pc.harf}" data-no="${no}">
          ${(sahipler.length ? sahipler : [null])
            .map((p, di, arr) => {
              const hh = (H - 90) / arr.length;
              return `<rect x="${x}" y="${40 + di * hh}" width="${CW - 2}" height="${hh - (arr.length > 1 ? 1 : 0)}" rx="3" fill="${p ? renk(p) : 'var(--yuzey-2)'}" fill-opacity="${p ? 0.75 : 1}"/>`;
            })
            .join('')}
          <text x="${x + CW / 2 - 1}" y="${cy}" class="d-sayi" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${x + CW / 2 - 1} ${cy})">${v === null ? '' : v}</text>
          ${fark ? `<text x="${x + CW / 2 - 1}" y="${H - 58}" class="d-fark ${fark < 0 ? 'eksi' : 'arti'}" text-anchor="middle">${fark > 0 ? '+' : ''}${fark}</text>` : ''}
          <text x="${x + CW / 2 - 1}" y="${H - 34}" class="d-no" text-anchor="middle">${no}</text>
          <text x="${x + CW / 2 - 1}" y="${H - 20}" class="d-harf" text-anchor="middle">${pc.harf}</text>
        </g>`;
      });
      // Kişi adları (üstte, aralık boyunca)
      Object.keys(S.d.yerlesim).forEach((pid) => {
        const p = S.kisi(pid);
        S.kisiParcalari(pid)
          .filter((x) => x.seraId === sk.seraId && x.harf === pc.harf)
          .forEach((x) => {
            const i1 = sira.indexOf(x.bas);
            const i2 = sira.indexOf(x.bit);
            if (i1 < 0 || i2 < 0) return;
            const a = x0 + Math.min(i1, i2) * CW;
            const b = x0 + (Math.max(i1, i2) + 1) * CW - 2;
            html += `<rect x="${a}" y="8" width="${b - a}" height="24" rx="6" fill="${renk(p)}"/>
              <text x="${(a + b) / 2}" y="20" class="d-ad" text-anchor="middle" dominant-baseline="central">${esc(b - a > p.ad.length * 6.5 ? p.ad : p.ad.split(' ')[0])}</text>`;
          });
      });
      x0 += pc.n * CW;
    });
    ekran.innerHTML = `
      <div class="sektor-ekran">
        <div class="sektor-ust">
          <button class="geri" data-sm="geri">${ikon('sol')} Şema</button>
          <h1 class="baslik">${esc(sera.ad || '')} · Sektör ${esc(sk.no)}</h1>
          <p class="ince">${pcs.map((p) => `${p.harf}: ${p.n} gutter`).join(' · ')} · ${sayi(toplam)} bitki ${once ? farkYaz(toplam - onceToplam) : ''}${sy ? ` <small>(sayım ${S.trTarih(sy.tarih)}${once ? ', önceki ' + S.trTarih(once.tarih) : ''})</small>` : ''}</p>
          <div class="arac-cubugu">
            <button class="btn kucuk" data-sm="ters">⇄ Numaralamayı ters çevir</button>
            <button class="btn kucuk" data-sm="sayim">${S.d.bitkiSayimlari.some((x) => x.tarih === bugun() && x.seraId === sk.seraId) ? 'Bugünkü sayım açık ✓' : 'Bugün sayım yap'}</button>
          </div>
          <p class="ince kucuk-yazi">Giriş tarafı altta. Sola/sağa kaydırın; gutter'a dokunarak bitki sayısını veya kişiyi değiştirin.</p>
        </div>
        <div class="sektor-kaydir"><svg class="sektor-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${html}</svg></div>
      </div>`;
    $$('.d-gutter', ekran).forEach((gEl) => gEl.addEventListener('click', () => gutterSayfasi(sk, gEl.dataset.harf, +gEl.dataset.no)));
  }

  function tunelAdi(seraId, harf, no) {
    for (const l of Object.values(S.d.yerlesim)) {
      const x = l.find((gt) => gt.seraId === seraId && gt.harf === harf && gt.gutter === no);
      if (x) return x.tunel;
    }
    return `${Math.ceil(no / 6)}-${harf}`;
  }

  // Bugünün sayımı yoksa son sayımdan kopyalayarak oluştur
  function bugunSayim(seraId) {
    let sy = S.d.bitkiSayimlari.find((x) => x.seraId === seraId && x.tarih === bugun());
    if (!sy) {
      const son = S.sonSayim(seraId);
      sy = { id: S.uid(), tarih: bugun(), seraId, sayilar: Object.assign({}, son ? son.sayilar : {}), kisi: son && son.kisi ? JSON.parse(JSON.stringify(son.kisi)) : {} };
      S.d.bitkiSayimlari.push(sy);
      S.kaydet();
    }
    return sy;
  }

  function gutterSayfasi(sk, harf, no) {
    const sahipler = S.gutterSahipleri(sk.seraId, harf, no);
    const key = harf + no;
    const sy = S.sonSayim(sk.seraId);
    const once = S.oncekiSayim(sk.seraId);
    const v = S.gutterBitki(sy, harf, no);
    const o = S.gutterBitki(once, harf, no);
    const adaylar = S.d.personel.filter((p) => p.aktif && (p.seraId === sk.seraId || S.d.yerlesim[p.id]));
    const paylasimli = sahipler.length > 1;
    sayfaAc(
      `Gutter ${key}`,
      `<p class="ince">${esc((S.sera(sk.seraId) || {}).ad)} · Sektör ${esc(sk.no)} · Tünel ${esc(tunelAdi(sk.seraId, harf, no))}</p>
       ${
         paylasimli
           ? `<p class="ince">Yarım sıra: bu gutter ${sahipler.length} kişi arasında paylaşılıyor.</p>${sahipler
               .map(
                 (p) => `<label class="alan-blok"><span><i class="nokta-renk" style="background:${renk(p)}"></i>${esc(p.ad)} – bitki</span>
                 <input class="g-pay" data-pid="${p.id}" inputmode="numeric" value="${S.kisiGutterBitki(sy, p.id, harf, no) ?? ''}"></label>`
               )
               .join('')}`
           : `<label class="alan-blok"><span>Kişi</span><select id="g-kisi"><option value="">— Boş —</option>${adaylar
               .map((p) => `<option value="${p.id}" ${sahipler[0] === p ? 'selected' : ''}>${esc(p.ad)}</option>`)
               .join('')}</select></label>
              <label class="alan-blok"><span>Bitki sayısı (bugünkü sayım)</span><input id="g-sayi" inputmode="numeric" value="${v === null ? '' : v}"></label>`
       }
       <p class="ince">Gutter toplamı – son sayım: <b>${sayi(v)}</b>${sy ? ' (' + S.trTarih(sy.tarih) + ')' : ''}${once ? ` · önceki: ${sayi(o)} (${S.trTarih(once.tarih)})${v !== null && o !== null ? ' · fark ' + farkYaz(v - o) : ''}` : ''}</p>
       <button class="btn birincil genis" id="g-kaydet">Kaydet</button>`,
      (gv) => {
        $('#g-kaydet', gv).onclick = () => {
          if (paylasimli) {
            const paylar = $$('.g-pay', gv).map((i) => [i.dataset.pid, S.sayi(i.value)]);
            const degisti = paylar.some(([pid, n]) => n !== null && n !== S.kisiGutterBitki(sy, pid, harf, no));
            if (degisti) {
              const bs = bugunSayim(sk.seraId);
              bs.kisi = bs.kisi || {};
              paylar.forEach(([pid, n]) => n !== null && ((bs.kisi[pid] = bs.kisi[pid] || {})[key] = n));
              S.gutterToplamGuncelle(bs, sk.seraId, harf, no);
            }
          } else {
            const yeniSahip = $('#g-kisi', gv).value;
            const yeniSayi = S.sayi($('#g-sayi', gv).value);
            if ((sahipler[0] || {}).id !== (yeniSahip || undefined)) {
              const kayit = { seraId: sk.seraId, harf, gutter: no, tunel: tunelAdi(sk.seraId, harf, no), etiket: '' };
              sahipler.forEach((p) => (S.d.yerlesim[p.id] = S.d.yerlesim[p.id].filter((gt) => !(gt.seraId === sk.seraId && gt.harf === harf && gt.gutter === no))));
              if (yeniSahip) yerlesimeEkle(yeniSahip, kayit);
            }
            if (yeniSayi !== null && yeniSayi !== v) {
              const bs = bugunSayim(sk.seraId);
              bs.sayilar[key] = yeniSayi;
              if (yeniSahip) (bs.kisi = bs.kisi || {}, (bs.kisi[yeniSahip] = bs.kisi[yeniSahip] || {})[key] = yeniSayi);
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

  // Aynı harfte en yakın gutter'ın yanına ekle (sıra/dönüş düzeni korunur)
  function yerlesimeEkle(pid, kayit) {
    const l = (S.d.yerlesim[pid] = S.d.yerlesim[pid] || []);
    let en = -1;
    let enD = Infinity;
    l.forEach((gt, i) => {
      if (gt.seraId === kayit.seraId && gt.harf === kayit.harf && Math.abs(gt.gutter - kayit.gutter) < enD) {
        enD = Math.abs(gt.gutter - kayit.gutter);
        en = i;
      }
    });
    if (en < 0) return l.push(kayit);
    const ayni = (x) => x && x.harf === kayit.harf && x.seraId === kayit.seraId;
    const yon = ayni(l[en + 1]) ? Math.sign(l[en + 1].gutter - l[en].gutter) : ayni(l[en - 1]) ? Math.sign(l[en].gutter - l[en - 1].gutter) : 1;
    l.splice((kayit.gutter - l[en].gutter) * yon > 0 ? en + 1 : en, 0, kayit);
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
      case 'kapat':
        return kisiSec(null);
      case 'kisiler':
        return kisilerSayfasi();
      case 'sektor':
        ui.semaSektor = b.dataset.id;
        return sektorCiz(ui.semaSektor);
      case 'geri':
        ui.semaSektor = null;
        return ciz();
      case 'ters': {
        const sk = S.d.sektorler.find((x) => x.id === ui.semaSektor);
        sk.yon = sk.yon === 'sol' ? 'sag' : 'sol';
        S.kaydet();
        toast(`Sektör ${sk.no}: 1. gutter artık ${sk.yon === 'sol' ? 'sol' : 'sağ'} kenarda`);
        return sektorCiz(sk.id);
      }
      case 'sayim': {
        const seralar = ui.semaSektor ? [S.d.sektorler.find((x) => x.id === ui.semaSektor).seraId] : S.d.seralar.filter((s) => S.sonSayim(s.id)).map((s) => s.id);
        if (!seralar.length) return toast('Önce bitki sayısı dosyasını içe aktarın');
        seralar.forEach(bugunSayim);
        toast('Bugünkü sayım açıldı – gutter’lara dokunarak sayıları güncelleyin');
        return ui.semaSektor ? sektorCiz(ui.semaSektor) : paneliYenile();
      }
    }
  });

  window.Sema = { ciz, segmentHtml, parcalar, gutterRect };
})();
