/* Sera Otomasyon – Hasat / yaprak günü planı: gelmeyenlerin sıralarını yakındakilere eşit dağıtır */
(function () {
  'use strict';
  const S = window.Store;
  const R = window.Rapor;
  const A = window.SeraApp;
  const { esc, ikon, toast, sayfaAc, sayfaKapat, dosyaHazir, calis } = A.yard;
  const ui = A.ui;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const nf = (n, k) => (n === null || n === undefined || !isFinite(n) ? '–' : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: k === undefined ? 1 : k }));
  const bugun = () => S.tarihStr(new Date());
  const ISLER = { HASAT: 'Hasat', YAPRAK: 'Yaprak' };
  const MOBIL = 8; // joker / yatırmacının bir sıraya "uzaklığı" (gutter cinsinden); yakın komşular önce alır

  // ---------- Kişiler ----------
  // Aynı isim iki serada kayıtlı olabilir (ör. cherry sırası ayrı yazılmış); planda tek kişi sayılır.
  function kisiler() {
    const m = new Map();
    S.d.personel
      .filter((p) => p.aktif !== false && p.ad)
      .forEach((p) => {
        const key = S.isimAnahtar(p.ad);
        if (!m.has(key)) m.set(key, { key, ad: p.ad, pidler: [], gutterlar: [], toplam: 0, seraSay: {} });
        const k = m.get(key);
        k.pidler.push(p.id);
        k.toplam += S.sayi(p.toplamSira) || 0;
        const cherry = /CHERRY/i.test(p.siraMetni || '');
        const gor = new Set(k.gutterlar.map((g) => g.seraId + g.harf + g.gutter));
        S.kisiGutterlari(p.id).forEach((g) => {
          const a = g.seraId + g.harf + g.gutter;
          if (gor.has(a)) return;
          gor.add(a);
          k.gutterlar.push({ seraId: g.seraId, harf: g.harf, gutter: g.gutter, taraf: g.taraf || null, pid: p.id, cherry });
        });
        const n = S.kisiGutterlari(p.id).length || 0.5;
        k.seraSay[p.seraId] = (k.seraSay[p.seraId] || 0) + (cherry ? 0.1 : n);
      });
    m.forEach((k) => (k.seraId = Object.keys(k.seraSay).sort((a, b) => k.seraSay[b] - k.seraSay[a])[0] || null));
    return Array.from(m.values());
  }
  function jokerKey() {
    return S.isimAnahtar(S.d.planAyar.joker || '');
  }
  const seraKisa = (id) => ((S.sera(id) || {}).ad || '').replace(/^SERA\s*/i, 'S');

  // ---------- Mesafe ----------
  function kutuMerkez(seraId, harf) {
    const sk = S.sektorBul(seraId, harf);
    return sk && sk.kutu ? { x: sk.kutu.x + sk.kutu.w / 2, y: sk.kutu.y + sk.kutu.h / 2 } : null;
  }
  function mesafe(a, b) {
    if (!a.harf || !b.harf) return MOBIL;
    if (a.seraId !== b.seraId) return 200;
    if (a.harf === b.harf) return Math.abs(a.gutter - b.gutter);
    const ka = kutuMerkez(a.seraId, a.harf);
    const kb = kutuMerkez(b.seraId, b.harf);
    return 12 + (ka && kb ? Math.hypot(ka.x - kb.x, ka.y - kb.y) / 6 : 30);
  }

  // ---------- Sıra listesini yazıya dök: "S2 D27–D30, S2 D42 (sağ yarı)" ----------
  function yerMetni(birimler) {
    const yersiz = birimler.filter((b) => !b.harf).length;
    const m = new Map();
    birimler
      .filter((b) => b.harf)
      .forEach((b) => {
        const a = b.seraId + '|' + b.harf + '|' + b.gutter;
        if (!m.has(a)) m.set(a, { seraId: b.seraId, harf: b.harf, gutter: b.gutter, taraflar: new Set(), sira: b.sira === undefined ? 0 : b.sira });
        const x = m.get(a);
        x.taraflar.add(b.taraf || 'tam');
        if (b.sira !== undefined) x.sira = Math.min(x.sira, b.sira);
      });
    const g = Array.from(m.values()).map((x) => Object.assign(x, { tam: x.taraflar.has('tam') || (x.taraflar.has('sol') && x.taraflar.has('sag')) }));
    g.sort((a, b) => a.sira - b.sira || (a.seraId + a.harf < b.seraId + b.harf ? -1 : a.seraId + a.harf > b.seraId + b.harf ? 1 : a.gutter - b.gutter));
    const out = [];
    let i = 0;
    while (i < g.length) {
      const x = g[i];
      const on = `${seraKisa(x.seraId)} ${x.harf}`;
      if (!x.tam) {
        out.push(`${on}${x.gutter} (${x.taraflar.has('sol') ? 'sol' : 'sağ'} yarı)`);
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < g.length && g[j + 1].tam && g[j + 1].seraId === x.seraId && g[j + 1].harf === x.harf && Math.abs(g[j + 1].gutter - g[j].gutter) === 1 && (j === i || Math.sign(g[j + 1].gutter - g[j].gutter) === Math.sign(g[j].gutter - g[j - 1].gutter))) j++;
      out.push(j > i ? `${on}${x.gutter}–${x.harf}${g[j].gutter}` : `${on}${x.gutter}`);
      i = j + 1;
    }
    if (yersiz) out.push(`${nf(yersiz / 2)} sıra (yeri girilmemiş)`);
    return out.join(', ');
  }

  // ---------- Hesap ----------
  // Her gelmeyen sırası iki yarıya (sol/sağ taraf) bölünür; paylaşılan sıralarda sadece gelmeyenin tarafı alınır.
  // 1) Paylar: önce herkese eşit (yarım sıra adımlarıyla); joker `jokerEk` sıra fazla alır; yatırmacı en fazla
  //    (mesai − yatırma saati) × hız sıra alır; başka seradaki kişi ancak kendi serasındakiler `maksEk`'i aşarsa çağrılır.
  // 2) Yerleşim: payı olan kişiler gelmeyen sıralarını en yakından başlayarak, art arda (bitişik) alır.
  function planHesapla(f) {
    S.sektorleriHazirla();
    const A_ = S.d.planAyar;
    const ks = kisiler();
    const jk = jokerKey();
    const gelmeyen = new Set(f.gelmeyen || []);
    const birimler = [];
    const cherry = [];
    const gelmeyenler = [];
    ks.filter((k) => gelmeyen.has(k.key) && k.key !== jk).forEach((k, gi) => {
      const gk = { key: k.key, ad: k.ad, seraId: k.seraId, birimler: [] };
      gelmeyenler.push(gk);
      const ekle = (b) => {
        b.gelmeyen = gi;
        b.sira = gi * 1000 + b.ord;
        birimler.push(b);
        gk.birimler.push(b);
      };
      const asil = k.gutterlar.filter((g) => !g.cherry);
      k.gutterlar.filter((g) => g.cherry).forEach((g) => cherry.push({ seraId: g.seraId, harf: g.harf, gutter: g.gutter, taraf: null }));
      if (!k.gutterlar.length) {
        const n = Math.round(k.toplam * 2);
        for (let i = 0; i < n; i++) ekle({ ord: i, taraf: i % 2 ? 'sag' : 'sol', seraId: k.seraId });
        return;
      }
      asil.forEach((g, i) => {
        const temel = { seraId: g.seraId, harf: g.harf, gutter: g.gutter, ord: i, karantina: S.karantinaMi(g.seraId, g.harf, g.gutter) };
        let taraf = g.taraf;
        const dil = S.gutterDilimleri(g.seraId, g.harf, g.gutter);
        if (!taraf && dil.length > 1) taraf = (dil.find((x) => x.p.id === g.pid) || {}).taraf || null;
        if (taraf) ekle(Object.assign({ taraf }, temel));
        else {
          ekle(Object.assign({ taraf: 'sol', tam: true }, temel));
          ekle(Object.assign({ taraf: 'sag', tam: true }, temel));
        }
      });
    });

    // Yardım edecekler
    const yardim = [];
    ks.forEach((k) => {
      if (gelmeyen.has(k.key)) return;
      if (k.key === jk) {
        if (!f.jokerGelmez) yardim.push({ key: k.key, ad: k.ad, tip: 'joker', ev: [], seraId: null });
        return;
      }
      if (!k.gutterlar.length && !k.toplam) return;
      yardim.push({ key: k.key, ad: k.ad, tip: 'normal', seraId: k.seraId, ev: k.gutterlar.filter((g) => !g.cherry) });
    });
    (A_.yatirmacilar || []).forEach((ad) => {
      const y = (f.yatirma || {})[ad] || {};
      if (y.gelmez) return;
      const saat = S.sayi(y.saat) !== null ? S.sayi(y.saat) : A_.yatirmaSaat;
      const kap = Math.max(0, Math.floor((A_.mesai - saat) * A_.hiz * 2));
      yardim.push({ key: 'y:' + ad, ad, tip: 'yatirma', ev: [], seraId: null, kap, saat });
    });

    // 1) Paylar (yarım sıra adımı), seraya göre: kişi kendi serasının payını alır
    const talep = {};
    birimler.forEach((b) => (talep[b.seraId || '?'] = (talep[b.seraId || '?'] || 0) + 1));
    yardim.forEach((h) => {
      h.pay = 0;
      h.seraPay = {};
    });
    const maks2 = (S.sayi(A_.maksEk) || 0) * 2;
    const jok2 = (S.sayi(A_.jokerEk) || 0) * 2;
    let kalan = birimler.length;
    while (kalan > 0) {
      const sid = Object.keys(talep)
        .filter((k) => talep[k] > 0)
        .sort((a, b) => talep[b] - talep[a])[0];
      let en = null;
      let enK = Infinity;
      yardim.forEach((h) => {
        let k;
        if (h.tip === 'yatirma') {
          if (h.pay >= h.kap) return;
          k = h.pay;
        } else if (h.tip === 'joker') k = h.pay - jok2;
        else k = h.pay + (sid !== '?' && h.seraId && h.seraId !== sid ? maks2 : 0);
        // Joker / yatırmacı başladığı serada kalsın (bir sıra için öbür seraya yürümesin)
        if (h.tip !== 'normal' && h.pay && !h.seraPay[sid]) k += 3;
        if (k < enK) {
          enK = k;
          en = h;
        }
      });
      if (!en) break;
      en.pay++;
      en.seraPay[sid] = (en.seraPay[sid] || 0) + 1;
      talep[sid]--;
      kalan--;
    }

    // 2) Yerleşim: en yakın (ucuz) eşleşme tek tek; alınan sıra kişinin "evi" sayılır → bitişik devam eder.
    //    Önce tam sıralar (iki yarı birlikte), pay yetmezse yarım sıralar.
    const sahip = new Array(birimler.length).fill(-1);
    const ogeler = [];
    birimler.forEach((u, i) => {
      if (u.tam && u.taraf === 'sag') return;
      const es = u.tam ? birimler.findIndex((v, j) => j !== i && v.tam && v.taraf === 'sag' && v.gelmeyen === u.gelmeyen && v.seraId === u.seraId && v.harf === u.harf && v.gutter === u.gutter) : -1;
      ogeler.push({ ix: es >= 0 ? [i, es] : [i], u, sid: u.seraId || '?' });
    });
    const c = yardim.map((h) => ogeler.map((o) => (h.ev.length ? Math.min(...h.ev.map((g) => mesafe(g, o.u))) : MOBIL)));
    const kalanPay = yardim.map((h) => Object.assign({}, h.seraPay));
    const ata = (hi, oi) => {
      const o = ogeler[oi];
      o.ix.forEach((i) => (sahip[i] = hi));
      o.bitti = true;
      kalanPay[hi][o.sid] -= o.ix.length;
      ogeler.forEach((v, vi) => {
        if (!v.bitti) c[hi][vi] = Math.min(c[hi][vi], o.u.harf && v.u.harf ? mesafe(o.u, v.u) : MOBIL);
      });
    };
    for (;;) {
      let enH = -1;
      let enO = -1;
      let enK = Infinity;
      yardim.forEach((h, hi) => {
        ogeler.forEach((o, oi) => {
          if (o.bitti || (kalanPay[hi][o.sid] || 0) < o.ix.length) return;
          const k = c[hi][oi];
          if (k < enK - 1e-9 || (Math.abs(k - enK) < 1e-9 && o.u.sira < ogeler[enO].u.sira)) {
            enK = k;
            enH = hi;
            enO = oi;
          }
        });
      });
      if (enH >= 0) {
        ata(enH, enO);
        continue;
      }
      // Kalan tam sıralardan birini ikiye böl (yarım payı kalanlar için)
      const bol = ogeler.findIndex((o) => !o.bitti && o.ix.length === 2 && yardim.some((h, hi) => (kalanPay[hi][o.sid] || 0) > 0));
      if (bol < 0) break;
      const o = ogeler[bol];
      ogeler.splice(bol, 1, { ix: [o.ix[0]], u: birimler[o.ix[0]], sid: o.sid }, { ix: [o.ix[1]], u: birimler[o.ix[1]], sid: o.sid });
      c.forEach((satir) => satir.splice(bol, 1, satir[bol], satir[bol]));
    }

    // Sonuç (kaydedilebilir, salt metin)
    const ad = (hi) => yardim[hi].ad;
    const sonuc = {
      eksikSira: birimler.length / 2,
      karsilanmayan: sahip.filter((x) => x < 0).length / 2,
      cherry: cherry.length ? yerMetni(cherry) : '',
      gelmeyenler: gelmeyenler.map((g) => {
        const dag = new Map();
        g.birimler.forEach((u) => {
          const hi = sahip[birimler.indexOf(u)];
          if (!dag.has(hi)) dag.set(hi, []);
          dag.get(hi).push(u);
        });
        return {
          key: g.key,
          ad: g.ad,
          seraId: g.seraId,
          sira: g.birimler.length / 2,
          yer: yerMetni(g.birimler),
          dagilim: Array.from(dag.entries())
            .sort((a, b) => Math.min(...a[1].map((u) => u.sira)) - Math.min(...b[1].map((u) => u.sira)))
            .map(([hi, us]) => ({ ad: hi < 0 ? '— KARŞILANAMADI —' : ad(hi), sira: us.length / 2, yer: yerMetni(us) })),
        };
      }),
      yardimcilar: yardim
        .map((h, hi) => {
          const us = birimler.filter((u, ui_) => sahip[ui_] === hi);
          const temiz = us.filter((u) => !u.karantina);
          const kar = us.filter((u) => u.karantina);
          const kimin = Array.from(new Set(us.map((u) => gelmeyenler[u.gelmeyen].ad)));
          return {
            key: h.key,
            ad: h.ad,
            tip: h.tip,
            seraId: h.seraId,
            ek: us.length / 2,
            yer: yerMetni(temiz),
            karantina: kar.length ? yerMetni(kar) : '',
            kimin,
            kendi: h.ev.length ? yerMetni(h.ev) : '',
            saat: h.tip === 'yatirma' ? h.saat : null,
            kap: h.tip === 'yatirma' ? h.kap / 2 : null,
            yardimSaat: h.tip === 'yatirma' ? us.length / 2 / (S.sayi(A_.hiz) || 1.5) : null,
            // Liste sırası: joker, yatırmacılar, sonra sera ve sektör düzeninde
            sira: (h.tip === 'joker' ? 0 : h.tip === 'yatirma' ? 1 : 2) * 1e7 + (h.ev.length ? S.d.seralar.findIndex((x) => x.id === h.ev[0].seraId) * 1e5 + h.ev[0].harf.charCodeAt(0) * 1e3 + h.ev[0].gutter : 9e6),
          };
        })
        .sort((a, b) => a.sira - b.sira),
    };
    const normal = sonuc.yardimcilar.filter((x) => x.tip === 'normal');
    sonuc.normalEk = normal.length ? { min: Math.min(...normal.map((x) => x.ek)), max: Math.max(...normal.map((x) => x.ek)), kisi: normal.length } : null;
    sonuc.joker = sonuc.yardimcilar.find((x) => x.tip === 'joker') || null;
    sonuc.yatirma = sonuc.yardimcilar.filter((x) => x.tip === 'yatirma');
    return sonuc;
  }

  // ---------- Paylaşım metni ----------
  function planMetni(p) {
    const s = p.sonuc;
    const l = [`🌿 ${ISLER[p.is].toUpperCase()} PLANI – ${S.trTarih(p.tarih)} ${S.GUNLER[S.strTarih(p.tarih).getDay()]}`];
    if (!s.gelmeyenler.length) l.push('Gelmeyecek yok, herkes kendi yerinde.');
    else {
      l.push('Gelmeyecek: ' + s.gelmeyenler.map((g) => `${g.ad} (${nf(g.sira)} sıra)`).join(', '));
      l.push('');
      s.yardimcilar
        .filter((h) => h.ek > 0)
        .forEach((h) => {
          const et = h.tip === 'joker' ? ' 🃏' : h.tip === 'yatirma' ? ' (yatırma bitince)' : '';
          let t = `👉 ${h.ad}${et}: ${h.yer}${h.karantina ? ` + en son karantina ${h.karantina}` : ''} (${nf(h.ek)} sıra – ${h.kimin.join(', ')})`;
          if (h.tip === 'normal') t += ' → sonra kendi yeri';
          l.push(t);
        });
      if (s.karsilanmayan) l.push(`⚠ ${nf(s.karsilanmayan)} sıra karşılanamadı`);
    }
    if (s.cherry) l.push(`🍒 Cherry sona bırakılır: ${s.cherry}`);
    if (p.not) l.push('Not: ' + p.not);
    return l.join('\n');
  }

  async function paylas(p) {
    const t = planMetni(p);
    try {
      if (navigator.share) return await navigator.share({ text: t, title: `${ISLER[p.is]} planı` });
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(t);
      toast('Plan metni kopyalandı');
    } catch (e) {
      sayfaAc('Plan metni', `<textarea class="plan-metin" readonly>${esc(t)}</textarea><p class="ince">Metni seçip kopyalayın.</p>`);
    }
  }

  // Gelmeyenlerin günlük kaydına "gelmedi" + "yerine yapan" yazılır
  function gunlugeIsle(p) {
    const ks = kisiler();
    let n = 0;
    p.sonuc.gelmeyenler.forEach((g) => {
      const k = ks.find((x) => x.key === g.key);
      if (!k) return;
      const yerine = g.dagilim.filter((d) => !d.ad.startsWith('—')).map((d) => d.ad).join(', ');
      k.pidler.forEach((pid) => {
        const kay = S.kayitAl(p.tarih, pid);
        if (kay.durum === 'geldi') kay.durum = 'yok';
        kay.yerine = yerine;
        n++;
      });
    });
    S.kaydet(true);
    toast(`${S.trTarih(p.tarih)} günlüğüne ${n} kayıt işlendi`);
  }

  // ---------- Defter › Plan listesi ----------
  function html(y, ay) {
    const on = `${y}-${String(ay + 1).padStart(2, '0')}`;
    const l = S.d.planlar.filter((x) => x.tarih.startsWith(on)).sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
    const yarin = S.gunEkle(bugun(), 1);
    const yp = S.d.planlar.find((x) => x.tarih === yarin);
    return `
      <section class="panel plan-tanit">
        <p class="ince">Hasat / yaprak gününden önce gelmeyecekleri işaretleyin; sıraları yakındakilere eşit dağıtılır. Joker: <b>${esc(S.d.planAyar.joker || '–')}</b> · Yatırmacılar: <b>${esc((S.d.planAyar.yatirmacilar || []).join(', ') || '–')}</b></p>
        <div class="satir-btn">
          <button class="btn birincil" data-df="plan-ac" data-tarih="${yarin}">${ikon('arti')} Yarın için plan${yp ? ' ✓' : ''}</button>
          <button class="btn" data-df="plan-ac">${ikon('gunluk')} Başka gün</button>
        </div>
      </section>
      ${
        l.length
          ? l
              .map((p) => {
                const s = p.sonuc || {};
                const g = s.gelmeyenler || [];
                return `<section class="panel kayit-grup"><button class="tahmin-kart" data-df="plan-ac" data-id="${p.id}">
                  <div class="grup-ust"><b>${S.trTarih(p.tarih)} ${S.GUNLER[S.strTarih(p.tarih).getDay()]} · ${ISLER[p.is] || ''}</b><span><b>${nf(s.eksikSira || 0)}</b> eksik sıra</span></div>
                  <small class="ince">${g.length ? 'Gelmeyecek: ' + esc(g.map((x) => x.ad).join(', ')) : 'Herkes geliyor'}${s.normalEk ? ` · kişi başı +${nf(s.normalEk.max)}` : ''}${s.joker && s.joker.ek ? ` · joker +${nf(s.joker.ek)}` : ''}</small>
                </button></section>`;
              })
              .join('')
          : '<p class="ince orta">Bu ay plan yok.</p>'
      }`;
  }

  // ---------- Plan formu ----------
  function gunlukGelmeyenler(t) {
    const g = S.gun(t);
    if (!g) return [];
    const out = new Set();
    Object.entries(g.kayitlar).forEach(([pid, k]) => {
      const p = S.kisi(pid);
      if (p && k.durum && k.durum !== 'geldi') out.add(S.isimAnahtar(p.ad));
    });
    return Array.from(out);
  }

  function form(p) {
    const yeni = !p;
    const PA = S.d.planAyar;
    const f = p
      ? JSON.parse(JSON.stringify(p))
      : { tarih: S.gunEkle(bugun(), 1), is: 'HASAT', gelmeyen: [], jokerGelmez: false, yatirma: {}, not: '' };
    if (yeni) f.gelmeyen = gunlukGelmeyenler(f.tarih);
    const jk = jokerKey();
    sayfaAc(
      `${ISLER[f.is]} / yaprak planı`,
      `<div class="iki">
         <label class="alan-blok"><span>Tarih</span><input type="date" id="p-tarih" value="${f.tarih}"></label>
         <div class="alan-blok"><span>İş</span><div class="seg" id="p-is">${Object.entries(ISLER)
           .map(([k, v]) => `<button type="button" data-v="${k}">${v}</button>`)
           .join('')}</div></div>
       </div>
       <p class="h-baslik"><b>Gelmeyecekler</b> <small class="ince">– dokunarak işaretleyin</small></p>
       <div id="p-kisiler"></div>
       <p class="h-baslik"><b>Joker ve yatırmacılar</b></p>
       <div id="p-mobil"></div>
       <details class="plan-ayar"><summary>Hesap ayarları</summary>
         <div class="iki">
           <label class="alan-blok"><span>Mesai (saat)</span><input data-pa="mesai" inputmode="decimal" value="${S.sayiYaz(PA.mesai)}"></label>
           <label class="alan-blok"><span>Yatırmacı hızı (sıra/saat)</span><input data-pa="hiz" inputmode="decimal" value="${S.sayiYaz(PA.hiz)}"></label>
           <label class="alan-blok"><span>Joker kaç sıra fazla</span><input data-pa="jokerEk" inputmode="decimal" value="${S.sayiYaz(PA.jokerEk)}"></label>
           <label class="alan-blok"><span>Sera dışına çıkmadan en fazla ek</span><input data-pa="maksEk" inputmode="decimal" value="${S.sayiYaz(PA.maksEk)}"></label>
         </div>
         <label class="alan-blok"><span>Joker</span><input data-pa="joker" list="p-kisi-listesi" value="${esc(PA.joker || '')}"></label>
         <label class="alan-blok"><span>Yatırmacılar (virgülle)</span><input data-pa="yatirmacilar" value="${esc((PA.yatirmacilar || []).join(', '))}"></label>
         <datalist id="p-kisi-listesi">${kisiler()
           .map((k) => `<option value="${esc(k.ad)}">`)
           .join('')}</datalist>
       </details>
       <div id="p-sonuc"></div>
       <label class="alan-blok"><span>Not</span><input id="p-not" value="${esc(f.not || '')}"></label>
       <button class="btn birincil genis" id="p-kaydet">Kaydet</button>
       <div class="iki plan-alt">
         <button class="btn" id="p-paylas">${ikon('paylas')} Ekibe gönder</button>
         <button class="btn" id="p-excel">${ikon('excel')} Excel</button>
       </div>
       <button class="btn genis" id="p-gunluk">${ikon('gunluk')} Günlük kayda işle (gelmedi + yerine yapan)</button>
       ${yeni ? '' : '<button class="btn tehlike genis" id="p-sil">Planı sil</button>'}`,
      (g) => {
        let sonuc = null;
        const kisiCiz = () => {
          const ks = kisiler().filter((k) => k.key !== jokerKey() && (k.gutterlar.length || k.toplam));
          const set = new Set(f.gelmeyen);
          $('#p-kisiler', g).innerHTML = S.d.seralar
            .map((sr) => {
              const l = ks.filter((k) => k.seraId === sr.id);
              if (!l.length) return '';
              return `<div class="plan-sera"><small class="ince">${esc(sr.ad)} · ${l.filter((k) => set.has(k.key)).length} gelmeyecek</small><div class="cip-liste">${l
                .map((k) => `<button type="button" class="cip ${set.has(k.key) ? 'yok' : ''}" data-k="${esc(k.key)}">${set.has(k.key) ? '✕ ' : ''}${esc(k.ad)} <small>${nf(k.toplam)}</small></button>`)
                .join('')}</div></div>`;
            })
            .join('');
        };
        const mobilCiz = () => {
          const PA_ = S.d.planAyar;
          const jkk = kisiler().find((k) => k.key === jokerKey());
          $('#p-mobil', g).innerHTML = `
            ${
              jkk
                ? `<div class="plan-yat"><button type="button" class="cip ${f.jokerGelmez ? 'yok' : 'aktif'}" data-joker>🃏 ${esc(jkk.ad)} ${f.jokerGelmez ? '· gelmiyor' : '· geliyor'}</button><small class="ince">Sabit yeri yok; herkesten ${nf(PA_.jokerEk)} sıra fazla alır</small></div>`
                : `<p class="ince">Joker (${esc(PA_.joker || '–')}) personelde bulunamadı.</p>`
            }
            ${(PA_.yatirmacilar || [])
              .map((ad) => {
                const y = f.yatirma[ad] || {};
                const saat = S.sayi(y.saat) !== null ? S.sayi(y.saat) : PA_.yatirmaSaat;
                const kap = Math.max(0, Math.floor((PA_.mesai - saat) * PA_.hiz * 2)) / 2;
                return `<div class="plan-yat"><button type="button" class="cip ${y.gelmez ? 'yok' : 'aktif'}" data-yat="${esc(ad)}">${esc(ad)} ${y.gelmez ? '· gelmiyor' : '✓'}</button>
                  ${y.gelmez ? '' : `<label class="plan-saat">yatırma <input data-ysaat="${esc(ad)}" inputmode="decimal" value="${esc(S.sayiYaz(saat))}"> saat</label><small class="ince">en fazla ${nf(kap)} sıra</small>`}</div>`;
              })
              .join('')}`;
        };
        const hesapla = () => {
          $$('#p-is button', g).forEach((b) => b.classList.toggle('sec', b.dataset.v === f.is));
          sonuc = planHesapla(f);
          const s = sonuc;
          const yard = s.yardimcilar.filter((h) => h.ek > 0);
          const bos = s.yardimcilar.filter((h) => h.ek === 0 && h.tip === 'normal').length;
          $('#p-sonuc', g).innerHTML = !s.gelmeyenler.length
            ? `<p class="ince orta">Gelmeyecek işaretlenmedi; herkes kendi yerinde.${s.cherry ? '' : ''}</p>`
            : `<section class="ozet-satir">
                <div class="ozet-kutu"><b>${nf(s.eksikSira)}</b><span>Eksik sıra</span></div>
                <div class="ozet-kutu"><b>${s.normalEk ? (s.normalEk.min === s.normalEk.max ? '+' + nf(s.normalEk.max) : `+${nf(s.normalEk.min)}–${nf(s.normalEk.max)}`) : '–'}</b><span>Kişi başı ek</span></div>
                <div class="ozet-kutu"><b>${s.joker ? '+' + nf(s.joker.ek) : '–'}</b><span>Joker</span></div>
                <div class="ozet-kutu"><b>${s.yatirma.length ? '+' + nf(s.yatirma.reduce((t, x) => t + x.ek, 0)) : '–'}</b><span>Yatırmacılar</span></div>
              </section>
              ${s.karsilanmayan ? `<p class="uyari-bant">⚠ ${nf(s.karsilanmayan)} sıra karşılanamadı – yatırma süresini kısaltın veya ayarlardan sınırı artırın.</p>` : ''}
              <p class="h-baslik"><b>Kim nereye gidiyor</b> <small class="ince">– önce bu sıralar, sonra kendi yeri</small></p>
              <ul class="plan-liste">${yard
                .map(
                  (h) => `<li class="plan-${h.tip}"><div><b>${esc(h.ad)}</b>${h.tip === 'joker' ? ' 🃏' : h.tip === 'yatirma' ? ' <small class="ince">yatırma bitince</small>' : ''}<span class="plan-ek">+${nf(h.ek)}</span></div>
                    <small>${esc(h.yer)}${h.karantina ? ` <span class="plan-kar">en son karantina: ${esc(h.karantina)}</span>` : ''} <i>(${esc(h.kimin.join(', '))})</i>${h.tip === 'normal' && h.kendi ? ` → kendi yeri ${esc(h.kendi.split(', ')[0])}…` : ''}${h.yardimSaat ? ` · ≈${nf(h.yardimSaat)} saat` : ''}</small></li>`
                )
                .join('')}</ul>
              ${bos ? `<p class="ince">${bos} kişi sadece kendi yerinde.</p>` : ''}
              <p class="h-baslik"><b>Gelmeyenlerin sıraları</b></p>
              <ul class="plan-liste">${s.gelmeyenler
                .map((x) => `<li><div><b>${esc(x.ad)}</b><span class="plan-ek">${nf(x.sira)} sıra</span></div><small>${x.dagilim.map((d) => `${esc(d.ad)} <b>${nf(d.sira)}</b>`).join(' · ')}</small></li>`)
                .join('')}</ul>`;
          if (s.cherry) $('#p-sonuc', g).insertAdjacentHTML('beforeend', `<p class="ince">🍒 Cherry sona bırakılır: ${esc(s.cherry)}</p>`);
        };
        const tumu = () => {
          kisiCiz();
          mobilCiz();
          hesapla();
        };
        tumu();
        $('#p-kisiler', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-k]');
          if (!b) return;
          const k = b.dataset.k;
          f.gelmeyen = f.gelmeyen.includes(k) ? f.gelmeyen.filter((x) => x !== k) : f.gelmeyen.concat(k);
          kisiCiz();
          hesapla();
        });
        $('#p-mobil', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-joker],[data-yat]');
          if (!b) return;
          if (b.hasAttribute('data-joker')) f.jokerGelmez = !f.jokerGelmez;
          else {
            const y = (f.yatirma[b.dataset.yat] = f.yatirma[b.dataset.yat] || {});
            y.gelmez = !y.gelmez;
          }
          mobilCiz();
          hesapla();
        });
        $('#p-mobil', g).addEventListener('change', (e) => {
          const i = e.target.closest('[data-ysaat]');
          if (!i) return;
          (f.yatirma[i.dataset.ysaat] = f.yatirma[i.dataset.ysaat] || {}).saat = S.sayi(i.value);
          mobilCiz();
          hesapla();
        });
        $('.plan-ayar', g).addEventListener('change', (e) => {
          const i = e.target.closest('[data-pa]');
          if (!i) return;
          const k = i.dataset.pa;
          if (k === 'joker') S.d.planAyar.joker = S.trUpper(i.value.trim());
          else if (k === 'yatirmacilar')
            S.d.planAyar.yatirmacilar = i.value
              .split(',')
              .map((x) => S.trUpper(x.trim()))
              .filter(Boolean);
          else if (S.sayi(i.value) !== null) S.d.planAyar[k] = S.sayi(i.value);
          S.kaydet();
          tumu();
        });
        $('#p-is', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b) return;
          f.is = b.dataset.v;
          $('#sayfa-baslik').textContent = `${ISLER[f.is]} planı`;
          hesapla();
        });
        $('#p-tarih', g).addEventListener('change', (e) => {
          f.tarih = e.target.value || f.tarih;
          const var_ = S.d.planlar.find((x) => x.tarih === f.tarih && x.id !== f.id);
          if (var_ && confirm(`${S.trTarih(f.tarih)} için plan zaten var. O planı açmak ister misiniz?`)) return form(var_);
          if (yeni) {
            f.gelmeyen = Array.from(new Set(f.gelmeyen.concat(gunlukGelmeyenler(f.tarih))));
            kisiCiz();
          }
          hesapla();
        });
        $('#sayfa-baslik').textContent = `${ISLER[f.is]} planı`;
        const kaydet = (sessiz) => {
          f.tarih = $('#p-tarih', g).value || f.tarih;
          f.not = $('#p-not', g).value.trim();
          f.sonuc = sonuc;
          const ayni = S.d.planlar.find((x) => x.tarih === f.tarih && x.id !== f.id);
          if (ayni) S.kayitSil('planlar', ayni.id);
          S.kayitKaydet('planlar', f);
          ui.ay = f.tarih.slice(0, 7);
          if (!sessiz) toast('Plan kaydedildi');
          A.ciz();
          return f;
        };
        $('#p-kaydet', g).onclick = () => {
          kaydet();
          sayfaKapat();
          A.ciz();
        };
        $('#p-paylas', g).onclick = () => paylas(kaydet(true));
        $('#p-excel', g).onclick = () => {
          const p_ = kaydet(true);
          calis('Plan', async () => dosyaHazir(await R.blob(await R.planRaporu(p_)), `${ISLER[p_.is].toLocaleUpperCase('tr-TR')} PLANI ${S.trTarih(p_.tarih)}.xlsx`));
        };
        $('#p-gunluk', g).onclick = () => {
          const p_ = kaydet(true);
          if (!p_.sonuc.gelmeyenler.length) return toast('Gelmeyecek işaretlenmedi');
          if (!confirm(`${S.trTarih(p_.tarih)} günlüğünde ${p_.sonuc.gelmeyenler.map((x) => x.ad).join(', ')} "gelmedi" yapılacak ve yerine yapanlar yazılacak. Devam edilsin mi?`)) return;
          gunlugeIsle(p_);
        };
        const sil = $('#p-sil', g);
        if (sil)
          sil.onclick = () => {
            if (!confirm('Plan silinsin mi?')) return;
            S.kayitSil('planlar', f.id);
            sayfaKapat();
            A.ciz();
          };
      }
    );
  }

  function olay(b) {
    if (b.dataset.df !== 'plan-ac') return false;
    const p = b.dataset.id && S.d.planlar.find((x) => x.id === b.dataset.id);
    if (p) form(p);
    else if (b.dataset.tarih && S.d.planlar.find((x) => x.tarih === b.dataset.tarih)) form(S.d.planlar.find((x) => x.tarih === b.dataset.tarih));
    else {
      form(null);
      if (!b.dataset.tarih) {
        const i = $('#p-tarih');
        i && i.focus();
      }
    }
    return true;
  }

  window.Plan = { html, olay, planHesapla, planMetni, kisiler };
})();
