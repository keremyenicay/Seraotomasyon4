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

  // ---------- Sıra listesini yazıya dök: "S2 D27–D30 (D27 sağ yarı)" ----------
  // Art arda sıralar tek parça; blok ucundaki yarım sıra parantezde belirtilir.
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
    const yari = (x) => `${x.harf}${x.gutter} ${x.taraflar.has('sol') ? 'sol' : 'sağ'} yarı`;
    const out = [];
    let i = 0;
    while (i < g.length) {
      const x = g[i];
      let j = i;
      // Yarım sıra yalnızca bloğun başında veya sonunda olabilir
      while (
        j + 1 < g.length &&
        (j === i || g[j].tam) &&
        g[j + 1].seraId === x.seraId &&
        g[j + 1].harf === x.harf &&
        Math.abs(g[j + 1].gutter - g[j].gutter) === 1 &&
        (j === i || Math.sign(g[j + 1].gutter - g[j].gutter) === Math.sign(g[j].gutter - g[j - 1].gutter))
      )
        j++;
      const notlar = [x, g[j]].filter((y, k) => !y.tam && (k === 0 || j > i)).map(yari);
      const on = `${seraKisa(x.seraId)} ${x.harf}`;
      out.push((j > i ? `${on}${x.gutter}–${x.harf}${g[j].gutter}` : `${on}${x.gutter}`) + (notlar.length ? ` (${notlar.join(', ')})` : ''));
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

    // 1) Paylar (yarım sıra adımı), seraya göre eşit. Elle girilen kişi sabit kalır, kalan diğerlerine bölünür.
    const elle = f.elle || {};
    const talep = {};
    birimler.forEach((b) => (talep[b.seraId || '?'] = (talep[b.seraId || '?'] || 0) + 1));
    yardim.forEach((h) => {
      h.elle = elle[h.key] !== undefined && elle[h.key] !== null;
      h.pay = h.elle ? Math.max(0, Math.round(elle[h.key] * 2)) : 0;
      h.seraPay = {};
      if (h.elle && h.tip !== 'joker' && h.pay) {
        const sid = h.seraId && talep[h.seraId] !== undefined ? h.seraId : Object.keys(talep).sort((a, b) => talep[b] - talep[a])[0];
        if (sid) talep[sid] = Math.max(0, talep[sid] - h.pay);
      }
    });
    const jokerH = yardim.find((h) => h.tip === 'joker');
    if (jokerH && jokerH.elle) {
      // Jokerin elle payı en çok eksiği olan seralardan düşülür
      for (let n = jokerH.pay; n > 0; n--) {
        const sid = Object.keys(talep).sort((a, b) => talep[b] - talep[a])[0];
        if (!sid || talep[sid] <= 0) break;
        talep[sid]--;
      }
    }
    const maks2 = (S.sayi(A_.maksEk) || 0) * 2;
    const jok2 = (S.sayi(A_.jokerEk) || 0) * 2;
    let kalan = Object.values(talep).reduce((t, x) => t + x, 0);
    while (kalan > 0) {
      const sid = Object.keys(talep)
        .filter((k) => talep[k] > 0)
        .sort((a, b) => talep[b] - talep[a])[0];
      let en = null;
      let enK = Infinity;
      yardim.forEach((h) => {
        if (h.elle) return;
        let k;
        if (h.tip === 'yatirma') {
          if (h.pay >= h.kap) return;
          k = h.pay;
        } else if (h.tip === 'joker') k = h.pay - jok2;
        else k = h.pay + (sid !== '?' && h.seraId && h.seraId !== sid ? maks2 : 0);
        if (k < enK) {
          enK = k;
          en = h;
        }
      });
      if (!en) break;
      en.pay++;
      talep[sid]--;
      kalan--;
    }

    // 2) Kim kimin yerine: joker hariç herkes TEK gelmeyene gider (en yakın gelmeyenden başlayarak)
    const gruplar = gelmeyenler.map((g, gi) => ({ gi, D: g.birimler.length, R: g.birimler.length, uyeler: [], jokerPay: 0 }));
    const uzak = (h, gr) => {
      const us = gelmeyenler[gr.gi].birimler;
      if (!h.ev.length) return us.some((u) => u.seraId === (h.seraId || u.seraId)) ? MOBIL : 200;
      let en = Infinity;
      h.ev.forEach((g) => us.forEach((u) => (en = Math.min(en, mesafe(g, u)))));
      return en;
    };
    const gidenler = yardim.filter((h) => h.tip !== 'joker' && h.pay > 0);
    const ciftler = [];
    gidenler.forEach((h) => gruplar.forEach((gr) => ciftler.push({ h, gr, d: uzak(h, gr) })));
    ciftler.sort((a, b) => a.d - b.d || b.h.pay - a.h.pay);
    ciftler.forEach(({ h, gr }) => {
      if (h.grup || gr.R * 2 < h.pay) return;
      h.grup = gr;
      gr.uyeler.push(h);
      gr.R -= h.pay;
    });
    gidenler
      .filter((h) => !h.grup)
      .forEach((h) => {
        const gr = gruplar.slice().sort((a, b) => (uzak(h, a) >= 200) - (uzak(h, b) >= 200) || b.R - a.R)[0];
        if (!gr) return;
        h.grup = gr;
        gr.uyeler.push(h);
        gr.R -= h.pay;
      });

    // 3) Grup içi denkleştirme: eksik kalan → joker; fazla → otomatik kişilerden yarım sıra düş
    const otoUye = (gr) => gr.uyeler.filter((h) => !h.elle);
    gruplar.forEach((gr) => {
      while (gr.R < 0) {
        const l = otoUye(gr).filter((h) => h.pay > 0).sort((a, b) => b.pay - a.pay || uzak(b, gr) - uzak(a, gr));
        const h = l[0] || gr.uyeler.filter((x) => x.pay > 0).sort((a, b) => b.pay - a.pay)[0];
        if (!h) break;
        h.pay--;
        gr.R++;
        if (h.elle) gr.elleFazla = true;
      }
      if (gr.R > 0 && jokerH) {
        gr.jokerPay = gr.R;
        gr.R = 0;
      }
      while (gr.R > 0) {
        const l = otoUye(gr).filter((h) => h.tip !== 'yatirma' || h.pay < h.kap).sort((a, b) => a.pay - b.pay);
        if (!l.length) break;
        l[0].pay++;
        gr.R--;
      }
      gr.uyeler = gr.uyeler.filter((h) => h.pay > 0);
    });
    // Jokere elle sayı girildiyse: fark otomatik kişilerden alınır / onlara geri verilir
    if (jokerH && jokerH.elle) {
      const toplamJ = () => gruplar.reduce((t, gr) => t + gr.jokerPay, 0);
      let koruma = 500;
      while (toplamJ() < jokerH.pay && koruma--) {
        const aday = gruplar
          .flatMap((gr) => otoUye(gr).map((h) => ({ h, gr })))
          .filter((x) => x.h.pay > 1)
          .sort((a, b) => b.h.pay - a.h.pay)[0];
        if (!aday) break;
        aday.h.pay--;
        aday.gr.jokerPay++;
      }
      while (toplamJ() > jokerH.pay && koruma--) {
        const aday = gruplar
          .filter((gr) => gr.jokerPay > 0 && otoUye(gr).some((h) => h.tip !== 'yatirma' || h.pay < h.kap))
          .flatMap((gr) => otoUye(gr).filter((h) => h.tip !== 'yatirma' || h.pay < h.kap).map((h) => ({ h, gr })))
          .sort((a, b) => a.h.pay - b.h.pay)[0];
        if (!aday) break;
        aday.h.pay++;
        aday.gr.jokerPay--;
      }
    }
    if (jokerH) jokerH.pay = gruplar.reduce((t, gr) => t + gr.jokerPay, 0);

    // 4) Blok yerleşimi: gelmeyenin sıraları yol düzeninde; kişiler kendi yerine en yakın noktaya göre dizilir
    const sahip = new Array(birimler.length).fill(-1);
    const ix = new Map(birimler.map((u, i) => [u, i]));
    gruplar.forEach((gr) => {
      const us = gelmeyenler[gr.gi].birimler.slice().sort((a, b) => a.sira - b.sira || (a.taraf === 'sol' ? -1 : 1));
      const orta = (us.length - 1) / 2;
      const konum = (h) => {
        if (!h.ev.length) return orta;
        let en = Infinity;
        let ei = orta;
        us.forEach((u, i) => {
          const d = Math.min(...h.ev.map((g) => mesafe(g, u)));
          if (d < en) {
            en = d;
            ei = i;
          }
        });
        return ei;
      };
      const sira = gr.uyeler.map((h) => ({ hi: yardim.indexOf(h), pay: h.pay, k: konum(h) }));
      if (gr.jokerPay) sira.push({ hi: yardim.indexOf(jokerH), pay: gr.jokerPay, k: orta + 0.1 });
      sira.sort((a, b) => a.k - b.k);
      let p = 0;
      sira.forEach((x) => {
        for (let n = 0; n < x.pay && p < us.length; n++, p++) sahip[ix.get(us[p])] = x.hi;
      });
    });

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
          const kar = us.filter((u) => u.karantina);
          // Joker birden fazla yere gidebilir: her gelmeyen için ayrı blok
          const yer = Array.from(new Set(us.map((u) => u.gelmeyen)))
            .map((gi) => yerMetni(us.filter((u) => u.gelmeyen === gi)))
            .join(' · ');
          const kimin = Array.from(new Set(us.map((u) => gelmeyenler[u.gelmeyen].ad)));
          return {
            key: h.key,
            ad: h.ad,
            tip: h.tip,
            seraId: h.seraId,
            ek: us.length / 2,
            yer,
            elle: !!h.elle,
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
    sonuc.elleFazla = gruplar.some((gr) => gr.elleFazla);
    const normal = sonuc.yardimcilar.filter((x) => x.tip === 'normal' && !x.elle);
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
          let t = `👉 ${h.ad}${et}: ${h.yer}${h.karantina ? ` (karantina ${h.karantina} en son)` : ''} (${nf(h.ek)} sıra – ${h.kimin.join(', ')})`;
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
          const bos = s.yardimcilar.filter((h) => h.ek === 0);
          const ayarla = (h) =>
            `<span class="plan-ayarla"><button type="button" data-elle="${esc(h.key)}" data-d="-1" aria-label="Azalt">−</button><b>+${nf(h.ek)}</b><button type="button" data-elle="${esc(h.key)}" data-d="1" aria-label="Artır">+</button></span>`;
          const elleEt = (h) => (h.elle ? ` <button type="button" class="plan-elle" data-oto="${esc(h.key)}" title="Otomatiğe dön">elle ✕</button>` : '');
          $('#p-sonuc', g).innerHTML = !s.gelmeyenler.length
            ? `<p class="ince orta">Gelmeyecek işaretlenmedi; herkes kendi yerinde.${s.cherry ? '' : ''}</p>`
            : `<section class="ozet-satir">
                <div class="ozet-kutu"><b>${nf(s.eksikSira)}</b><span>Eksik sıra</span></div>
                <div class="ozet-kutu"><b>${s.normalEk ? (s.normalEk.min === s.normalEk.max ? '+' + nf(s.normalEk.max) : `+${nf(s.normalEk.min)}–${nf(s.normalEk.max)}`) : '–'}</b><span>Kişi başı ek</span></div>
                <div class="ozet-kutu"><b>${s.joker ? '+' + nf(s.joker.ek) : '–'}</b><span>Joker</span></div>
                <div class="ozet-kutu"><b>${s.yatirma.length ? '+' + nf(s.yatirma.reduce((t, x) => t + x.ek, 0)) : '–'}</b><span>Yatırmacılar</span></div>
              </section>
              ${s.elleFazla ? '<p class="uyari-bant">⚠ Elle verilen sıralar o kişinin gideceği yerdeki eksikten fazla; fazlası düşüldü.</p>' : ''}
              ${s.karsilanmayan ? `<p class="uyari-bant">⚠ ${nf(s.karsilanmayan)} sıra karşılanamadı – yatırma süresini kısaltın veya ayarlardan sınırı artırın.</p>` : ''}
              <p class="h-baslik"><b>Kim nereye gidiyor</b> <small class="ince">– önce bu sıralar, sonra kendi yeri · sayıyı −/+ ile değiştirin</small></p>
              <ul class="plan-liste">${yard
                .map(
                  (h) => `<li class="plan-${h.tip}"><div><b>${esc(h.ad)}</b>${h.tip === 'joker' ? ' 🃏' : h.tip === 'yatirma' ? ' <small class="ince">yatırma bitince</small>' : ''}${elleEt(h)}${ayarla(h)}</div>
                    <small>${esc(h.yer)}${h.karantina ? ` <span class="plan-kar">karantina ${esc(h.karantina)} en son</span>` : ''} <i>(${esc(h.kimin.join(', '))})</i>${h.tip === 'normal' && h.kendi ? ` → kendi yeri ${esc(h.kendi.split(', ')[0])}…` : ''}${h.yardimSaat ? ` · ≈${nf(h.yardimSaat)} saat` : ''}</small></li>`
                )
                .join('')}</ul>
              ${
                bos.length
                  ? `<details class="plan-bos"><summary>${bos.length} kişi sadece kendi yerinde</summary><ul class="plan-liste">${bos
                      .map((h) => `<li class="plan-${h.tip}"><div><b>${esc(h.ad)}</b>${elleEt(h)}${ayarla(h)}</div></li>`)
                      .join('')}</ul></details>`
                  : ''
              }
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
        // Elle sayı: değiştirilen kişi sabit kalır, diğerleri yeniden dağıtılır
        $('#p-sonuc', g).addEventListener('click', (e) => {
          const b = e.target.closest('[data-elle],[data-oto]');
          if (!b) return;
          f.elle = f.elle || {};
          if (b.dataset.oto) delete f.elle[b.dataset.oto];
          else {
            const h = sonuc.yardimcilar.find((x) => x.key === b.dataset.elle);
            f.elle[b.dataset.elle] = Math.max(0, (h ? h.ek : 0) + Number(b.dataset.d) * 0.5);
          }
          hesapla();
        });
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
