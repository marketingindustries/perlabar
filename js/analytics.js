/* Analisi vendite: prodotti, fasce orarie, giorni, confronti e suggerimenti. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Analytics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DOW_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // settimana da lunedì
  const DOW_ON = ['la domenica', 'il lunedì', 'il martedì', 'il mercoledì', 'il giovedì', 'il venerdì', 'il sabato'];

  const pad = n => (n < 10 ? '0' + n : '' + n);
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmtDate = d => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  const fmtShort = d => pad(d.getDate()) + '/' + pad(d.getMonth() + 1);

  function group(n, dec) {
    const neg = n < 0;
    const [i, f] = Math.abs(n).toFixed(dec).split('.');
    const s = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '');
    return (neg ? '-' : '') + s;
  }
  const fmtEur = (n, dec) => '€' + group(n, dec == null ? (Math.abs(n) >= 1000 ? 0 : 2) : dec);
  const fmtInt = n => group(Math.round(n), 0);
  const fmtPct = (n, dec) => group(n * 100, dec == null ? 0 : dec) + '%';
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const hh = h => h + ':00';

  function buildReceipts(lines) {
    const map = new Map();
    for (const l of lines) {
      let r = map.get(l.receipt);
      if (!r) { r = { key: l.receipt, ts: l.ts, revenue: 0, items: 0, products: new Set() }; map.set(l.receipt, r); }
      if (l.ts < r.ts) r.ts = l.ts;
      r.revenue += l.revenue; r.items += l.qty; r.products.add(l.product);
    }
    return [...map.values()];
  }

  function compute(lines) {
    const receipts = buildReceipts(lines).filter(r => r.revenue > 0);
    const totalRevenue = sum(lines, l => l.revenue);
    const ticketRevenue = sum(receipts, r => r.revenue);

    // --- giorni, ore, giorni della settimana
    const days = new Map();
    const byHour = Array.from({ length: 24 }, () => ({ revenue: 0, receipts: 0, days: new Set() }));
    const dow = Array.from({ length: 7 }, () => ({ revenue: 0, receipts: 0, days: new Set() }));
    const dowHour = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const r of receipts) {
      const k = dayKey(r.ts), h = r.ts.getHours(), w = r.ts.getDay();
      let d = days.get(k);
      if (!d) { d = { key: k, date: startOfDay(r.ts), dow: w, revenue: 0, receipts: 0, items: 0, firstHour: 24, lastHour: 0 }; days.set(k, d); }
      d.revenue += r.revenue; d.receipts++; d.items += r.items;
      d.firstHour = Math.min(d.firstHour, h); d.lastHour = Math.max(d.lastHour, h);
      byHour[h].revenue += r.revenue; byHour[h].receipts++; byHour[h].days.add(k);
      dow[w].revenue += r.revenue; dow[w].receipts++; dow[w].days.add(k);
      dowHour[w][h] += r.revenue;
    }
    const dayList = [...days.values()].sort((a, b) => a.date - b.date);
    return { lines, receipts, totalRevenue, ticketRevenue, days, dayList, byHour, dow, dowHour };
  }

  // L'ultimo giorno è "parziale" se le vendite finiscono molto prima del solito.
  function lastDayIsPartial(c) {
    const n = c.dayList.length;
    if (n < 8) return false;
    const last = c.dayList[n - 1];
    const prev = c.dayList.slice(Math.max(0, n - 15), n - 1);
    const medianLast = prev.map(d => d.lastHour).sort((a, b) => a - b)[Math.floor(prev.length / 2)];
    return last.lastHour < medianLast - 2;
  }

  function sumRange(dayList, from, to) {
    let revenue = 0, receipts = 0;
    for (const d of dayList) if (d.date >= from && d.date <= to) { revenue += d.revenue; receipts += d.receipts; }
    return { revenue, receipts, avgTicket: receipts ? revenue / receipts : 0 };
  }

  function compareWindows(dayList, len) {
    const first = dayList[0].date, end = dayList[dayList.length - 1].date;
    const span = Math.round((end - first) / 864e5) + 1;
    if (span < len * 2) return null;
    const cur = sumRange(dayList, addDays(end, -(len - 1)), end);
    const prev = sumRange(dayList, addDays(end, -(2 * len - 1)), addDays(end, -len));
    const d = (a, b) => (b ? a / b - 1 : null);
    return {
      len, cur, prev,
      curFrom: addDays(end, -(len - 1)), curTo: end,
      prevFrom: addDays(end, -(2 * len - 1)), prevTo: addDays(end, -len),
      delta: { revenue: d(cur.revenue, prev.revenue), receipts: d(cur.receipts, prev.receipts), avgTicket: d(cur.avgTicket, prev.avgTicket) }
    };
  }

  function analyze(allLines, opts) {
    opts = opts || {};
    if (!allLines.length) return null;
    let c = compute(allLines);
    if (!c.receipts.length) return null;
    let droppedPartial = null;
    if (opts.dropPartial !== false && lastDayIsPartial(c)) {
      droppedPartial = c.dayList[c.dayList.length - 1].date;
      const cut = addDays(droppedPartial, 0);
      c = compute(allLines.filter(l => startOfDay(l.ts) < cut));
    }
    const { receipts, dayList, byHour, dow, dowHour } = c;
    const activeDays = dayList.length;
    const first = dayList[0].date, last = dayList[activeDays - 1].date;

    const totals = {
      revenue: c.totalRevenue,
      receipts: receipts.length,
      avgTicket: c.ticketRevenue / receipts.length,
      itemsPerReceipt: sum(receipts, r => r.items) / receipts.length,
      activeDays, avgDaily: c.totalRevenue / activeDays, first, last
    };

    // --- ore
    const minDays = Math.max(2, Math.ceil(activeDays * 0.2));
    const openHours = [];
    byHour.forEach((h, i) => { if (h.days.size >= minDays) openHours.push(i); });
    if (!openHours.length) byHour.forEach((h, i) => { if (h.receipts) openHours.push(i); });
    const hFrom = Math.min(...openHours), hTo = Math.max(...openHours);
    const hours = byHour.map((h, i) => ({
      hour: i, revenue: h.revenue, receipts: h.receipts,
      avgRevenue: h.revenue / activeDays, avgReceipts: h.receipts / activeDays,
      share: c.ticketRevenue ? h.revenue / c.ticketRevenue : 0,
      inRange: i >= hFrom && i <= hTo
    }));
    const rangeHours = hours.filter(h => h.inRange);
    const avgHourRevenue = sum(rangeHours, h => h.avgRevenue) / rangeHours.length;
    const slowSlots = [];
    if (rangeHours.length >= 6 && activeDays >= 5) {
      let cur = null;
      for (const h of rangeHours) {
        if (h.avgRevenue < 0.6 * avgHourRevenue) {
          if (cur && cur.to === h.hour) { cur.to = h.hour + 1; cur.hours.push(h); }
          else { cur = { from: h.hour, to: h.hour + 1, hours: [h] }; slowSlots.push(cur); }
        } else cur = null;
      }
      slowSlots.forEach(s => {
        s.avgRevenue = sum(s.hours, h => h.avgRevenue) / s.hours.length;
        s.below = 1 - s.avgRevenue / avgHourRevenue;
        s.edge = s.to === hTo + 1 ? 'end' : (s.from === hFrom ? 'start' : null);
      });
      slowSlots.sort((a, b) => b.below * b.hours.length - a.below * a.hours.length);
    }
    let bestWindow = null;
    for (let h = hFrom; h < hTo; h++) {
      const share = hours[h].share + hours[h + 1].share;
      if (!bestWindow || share > bestWindow.share) bestWindow = { from: h, to: h + 2, share };
    }
    const topHours = rangeHours.slice().sort((a, b) => b.avgRevenue - a.avgRevenue).slice(0, 3);

    // --- giorni della settimana
    const dowStats = DOW_ORDER.map(w => {
      const n = dow[w].days.size;
      return { dow: w, name: DOW_NAMES[w], short: DOW_SHORT[w], days: n,
        avgRevenue: n ? dow[w].revenue / n : 0, avgReceipts: n ? dow[w].receipts / n : 0,
        avgTicket: dow[w].receipts ? dow[w].revenue / dow[w].receipts : 0 };
    });
    const openDow = dowStats.filter(d => d.days >= 2 || (activeDays < 14 && d.days >= 1));
    const meanDow = openDow.length ? sum(openDow, d => d.avgRevenue) / openDow.length : 0;
    const worstDow = openDow.length >= 3 ? openDow.reduce((a, b) => (b.avgRevenue < a.avgRevenue ? b : a)) : null;
    const bestDow = openDow.length >= 3 ? openDow.reduce((a, b) => (b.avgRevenue > a.avgRevenue ? b : a)) : null;
    const worstDays = activeDays >= 10
      ? dayList.slice().sort((a, b) => a.revenue - b.revenue).slice(0, 5).map(d => {
        const avg = dowStats.find(s => s.dow === d.dow).avgRevenue;
        return Object.assign({ vsDow: avg ? d.revenue / avg - 1 : 0 }, d);
      }) : [];
    const bestDays = activeDays >= 10 ? dayList.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 5) : [];

    const heat = DOW_ORDER.map(w => ({
      dow: w, name: DOW_NAMES[w], short: DOW_SHORT[w],
      cells: rangeHours.map(h => dow[w].days.size ? dowHour[w][h.hour] / dow[w].days.size : 0)
    }));

    // --- prodotti
    const pm = new Map();
    for (const l of c.lines) {
      let p = pm.get(l.product);
      if (!p) { p = { name: l.product, category: l.category, qty: 0, revenue: 0, costLines: 0, knownRevenue: 0, cost: 0, hourRevenue: new Array(24).fill(0) }; pm.set(l.product, p); }
      p.qty += l.qty; p.revenue += l.revenue;
      p.hourRevenue[l.ts.getHours()] += l.revenue;
      if (l.cost != null) { p.costLines++; p.cost += l.cost; p.knownRevenue += l.revenue; }
    }
    const products = [...pm.values()].map(p => {
      const hasCost = p.costLines > 0;
      return Object.assign(p, {
        share: c.totalRevenue ? p.revenue / c.totalRevenue : 0,
        hasCost,
        margin: hasCost ? p.knownRevenue - p.cost : null,
        marginPct: hasCost && p.knownRevenue > 0 ? (p.knownRevenue - p.cost) / p.knownRevenue : null
      });
    }).sort((a, b) => b.revenue - a.revenue);
    const costLines = c.lines.filter(l => l.cost != null).length;
    const costCoverage = costLines / c.lines.length;
    const withCost = products.filter(p => p.hasCost);
    const knownRev = sum(withCost, p => p.knownRevenue);
    const avgMarginPct = knownRev > 0 ? sum(withCost, p => p.margin) / knownRev : null;
    let lowProfit = [], lowProfitMode = 'sales';
    if (costCoverage >= 0.5 && avgMarginPct != null) {
      lowProfitMode = 'margin';
      lowProfit = withCost.filter(p => p.marginPct != null && p.marginPct < avgMarginPct * 0.75)
        .sort((a, b) => a.marginPct - b.marginPct).slice(0, 8);
    } else {
      lowProfit = products.filter(p => p.share < 0.01).slice(-8).reverse();
    }

    // --- acquisti insieme
    const prodReceipts = new Map(), pairs = new Map();
    for (const r of receipts) {
      const arr = [...r.products];
      arr.forEach(p => prodReceipts.set(p, (prodReceipts.get(p) || 0) + 1));
      if (arr.length >= 2 && arr.length <= 8) {
        arr.sort();
        for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
          const k = arr[i] + '\u0000' + arr[j];
          pairs.set(k, (pairs.get(k) || 0) + 1);
        }
      }
    }
    let topPair = null;
    for (const [k, n] of pairs) {
      const [a, b] = k.split('\u0000');
      const conf = n / Math.min(prodReceipts.get(a), prodReceipts.get(b));
      if (n >= Math.max(5, receipts.length * 0.02) && conf >= 0.25 && (!topPair || n > topPair.count)) topPair = { a, b, count: n, conf };
    }

    // --- confronti
    const week = compareWindows(dayList, 7);
    const month = compareWindows(dayList, 30);
    const span = Math.round((last - first) / 864e5) + 1;
    const weeks = [];
    for (let i = Math.min(8, Math.floor(span / 7)) - 1; i >= 0; i--) {
      const to = addDays(last, -7 * i), from = addDays(to, -6);
      weeks.push(Object.assign({ from, to }, sumRange(dayList, from, to)));
    }
    const mm = new Map();
    for (const d of dayList) {
      const k = d.date.getFullYear() + '-' + pad(d.date.getMonth() + 1);
      let m = mm.get(k);
      if (!m) { m = { key: k, year: d.date.getFullYear(), month: d.date.getMonth(), revenue: 0, receipts: 0, days: 0 }; mm.set(k, m); }
      m.revenue += d.revenue; m.receipts += d.receipts; m.days++;
    }
    const months = [...mm.values()].map(m => {
      const dim = new Date(m.year, m.month + 1, 0).getDate();
      return Object.assign(m, { avgTicket: m.receipts ? m.revenue / m.receipts : 0, avgDaily: m.revenue / m.days, partial: m.days < dim * 0.9 });
    }).slice(-6);

    const a = { totals, hours, hFrom, hTo, avgHourRevenue, slowSlots, bestWindow, topHours,
      dowStats, meanDow, worstDow, bestDow, worstDays, bestDays, heat, products, costCoverage, avgMarginPct,
      lowProfit, lowProfitMode, topPair, week, month, weeks, months, dayList, span, droppedPartial,
      multiReceipts: receipts.filter(r => r.products.size > 1).length };
    a.suggestions = suggest(a);
    return a;
  }

  function slotIdea(from) {
    if (from < 11) return { what: 'colazione', idea: 'una formula colazione a prezzo fisso (caffè + brioche)' };
    if (from < 15) return { what: 'pausa pranzo', idea: 'una formula pranzo veloce (panino o piatto + bibita) a prezzo fisso' };
    if (from < 19) return { what: 'aperitivo', idea: 'una promo aperitivo anticipato o una merenda (es. spritz + stuzzichino a prezzo fisso)' };
    if (from < 22) return { what: 'happy hour', idea: 'un happy hour (2x1 o prezzo speciale su drink e piatto del giorno)' };
    return { what: 'dopocena', idea: 'una promo dopocena (amaro/drink a prezzo speciale) oppure valuta di chiudere prima' };
  }

  function suggest(a) {
    const out = [];
    const T = a.totals;
    const push = (level, title, text) => out.push({ level, title, text });

    // fasce lente
    a.slowSlots.slice(0, 2).forEach(s => {
      const slot = 'dalle ' + s.from + ' alle ' + s.to;
      const idea = slotIdea(s.from);
      let text = 'In media incassi ' + fmtEur(s.avgRevenue, 0) + ' l\'ora, il ' + fmtPct(s.below) + ' in meno della tua media oraria (' + fmtEur(a.avgHourRevenue, 0) + '). ';
      if (s.edge === 'end' && s.to - s.from <= 2 && s.from >= 21) text += 'Prova ' + idea.idea + ' oppure valuta di anticipare la chiusura.';
      else text += 'Prova ' + idea.idea + '.';
      push('tip', slot.charAt(0).toUpperCase() + slot.slice(1) + ' vendi poco: prova una promo ' + idea.what, text);
    });

    // fascia migliore
    if (a.bestWindow && a.bestWindow.share >= 0.2) {
      push('good', 'Dalle ' + a.bestWindow.from + ' alle ' + a.bestWindow.to + ' fai il ' + fmtPct(a.bestWindow.share) + ' degli incassi',
        'È la tua finestra d\'oro: tieni il personale al completo, prepara in anticipo i prodotti più richiesti ed evita di programmare consegne o pulizie in quelle ore.');
    }

    // giorno debole / forte
    if (a.worstDow && a.meanDow && a.worstDow.avgRevenue < a.meanDow * 0.8) {
      const w = a.worstDow, gap = 1 - w.avgRevenue / a.meanDow;
      push('tip', w.name + ' è il giorno più debole',
        'Incassi in media ' + fmtEur(w.avgRevenue, 0) + ', il ' + fmtPct(gap) + ' sotto la media dei giorni (' + fmtEur(a.meanDow, 0) +
        '). Prova ' + (w.dow === 5 || w.dow === 6 ? 'un evento o musica dal vivo' : 'una serata a tema, un menu fisso o uno sconto per chi torna (es. coupon sul prossimo acquisto)') + ' ' + DOW_ON[w.dow] + '.');
    }
    if (a.bestDow && a.worstDow && a.bestDow.dow !== a.worstDow.dow && a.bestDow.avgRevenue > a.meanDow * 1.25) {
      push('good', a.bestDow.name + ' è il tuo giorno migliore',
        'Incassi in media ' + fmtEur(a.bestDow.avgRevenue, 0) + ' (+' + fmtPct(a.bestDow.avgRevenue / a.meanDow - 1) + ' sulla media). Assicurati di avere scorte e personale adeguati.');
    }

    // trend
    if (a.week && a.week.delta.revenue != null) {
      const d = a.week.delta;
      if (d.revenue <= -0.1) {
        const why = d.receipts < d.avgTicket ? 'Vengono meno clienti (' + fmtPct(d.receipts, 0).replace('-', '−') + ' scontrini)'
          : 'Lo scontrino medio è sceso (' + fmtPct(d.avgTicket, 0).replace('-', '−') + ')';
        push('warn', 'Ultimi 7 giorni in calo: ' + fmtPct(d.revenue).replace('-', '−') + ' sui 7 precedenti', why + '. Guarda il confronto qui sotto per capire quando è successo.');
      } else if (d.revenue >= 0.1) {
        push('good', 'Ultimi 7 giorni in crescita: +' + fmtPct(d.revenue), 'Incassi ' + fmtEur(a.week.cur.revenue, 0) + ' contro ' + fmtEur(a.week.prev.revenue, 0) + ' dei 7 giorni precedenti. Capisci cosa ha funzionato e ripetilo.');
      }
    }

    // margini
    if (a.lowProfitMode === 'margin' && a.lowProfit.length) {
      const big = a.lowProfit.filter(p => p.share >= 0.015).sort((x, y) => (a.avgMarginPct - y.marginPct) * y.revenue - (a.avgMarginPct - x.marginPct) * x.revenue).slice(0, 3);
      const pick = big.length ? big : a.lowProfit.slice(0, 3);
      push('warn', 'Margini bassi su ' + pick.map(p => p.name).join(', '),
        pick.map(p => p.name + ' (margine ' + fmtPct(p.marginPct) + ')').join(', ') + ' contro una media del ' + fmtPct(a.avgMarginPct) +
        '. Valuta di ritoccare il prezzo di qualche decimo, ridurre la porzione o trattare meglio il fornitore.');
    }

    // pochi venduti
    const slow = a.products.filter(p => p.share < 0.01);
    if (a.products.length >= 8 && a.span >= 30 && slow.length >= 2) {
      const tail = slow.slice(-3).reverse();
      push('tip', 'Prodotti che girano pochissimo',
        tail.map(p => p.name + ' (' + fmtInt(p.qty) + ' pz)').join(', ') + ' pesano meno dell\'1% degli incassi. Valuta di toglierli dal menu o proporli come "consigliato del giorno" per smaltire le scorte.');
    }

    // dipendenza da pochi prodotti
    if (a.products.length >= 6) {
      const top3 = sum(a.products.slice(0, 3), p => p.share);
      if (top3 > 0.6) push('tip', 'Incassi concentrati su 3 prodotti (' + fmtPct(top3) + ')',
        a.products.slice(0, 3).map(p => p.name).join(', ') + '. Se uno manca o cambia il prezzo del fornitore l\'incasso ne risente: lavora su un secondo prodotto "traino".');
    }

    // abbinamenti
    if (a.topPair) {
      push('tip', a.topPair.a + ' + ' + a.topPair.b + ': proponili in combo',
        'Finiscono nello stesso scontrino ' + fmtInt(a.topPair.count) + ' volte. Una formula a prezzo unico alza lo scontrino medio e semplifica il servizio.');
    } else if (T.itemsPerReceipt < 1.4 && a.products.length >= 4) {
      push('tip', 'Pochi prodotti per scontrino (' + group(T.itemsPerReceipt, 1) + ')',
        'Lo scontrino medio è ' + fmtEur(T.avgTicket) + '. Fai suggerire sempre un abbinamento alla cassa (es. "con un dolce?") per aumentarlo.');
    }

    if (!out.length) push('good', 'Nessun problema evidente', 'Con i dati caricati non emergono fasce o prodotti critici. Carica più giorni di vendite per analisi più precise.');
    const order = { warn: 0, tip: 1, good: 2 };
    return out.sort((x, y) => order[x.level] - order[y.level]);
  }

  return { DOW_NAMES, DOW_SHORT, analyze, fmtEur, fmtInt, fmtPct, fmtDate, fmtShort, dayKey, startOfDay, addDays, hh, group };
});
