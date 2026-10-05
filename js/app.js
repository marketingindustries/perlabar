(function () {
  'use strict';
  const A = Analytics, P = Parser;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABELS = { datetime: 'Data e ora (insieme)', date: 'Data', time: 'Ora', receipt: 'N. scontrino', product: 'Prodotto', qty: 'Quantità', price: 'Prezzo unitario', total: 'Importo riga', cost: 'Costo unitario', category: 'Categoria' };

  const state = { datasets: [], lines: [], period: 7, topMode: 'revenue', full: null };

  // ---------- caricamento
  async function loadFiles(files) {
    for (const f of files) {
      try {
        const t = P.parseTable(P.decodeBuffer(await f.arrayBuffer()));
        state.datasets.push({ name: f.name, headers: t.headers, rows: t.rows, mapping: t.mapping });
      } catch (e) { showMsg('Non riesco a leggere "' + f.name + '".'); }
    }
    rebuild();
  }
  function loadDemo() {
    const end = new Date(); end.setDate(end.getDate() - 1);
    const rows = Demo.generate(120, end, 42);
    const t = P.parseTable(Demo.toCSV(rows));
    state.datasets = [{ name: 'dati di esempio', headers: t.headers, rows: t.rows, mapping: t.mapping, demo: true }];
    rebuild();
  }
  function showMsg(html) { const m = $('msg'); m.hidden = !html; m.innerHTML = html || ''; }

  function rebuild() {
    state.lines = []; const problems = []; let skipped = 0;
    for (const ds of state.datasets) {
      const miss = P.missingFields(ds.mapping);
      if (miss.length) { problems.push('<b>' + esc(ds.name) + '</b>: non trovo la colonna ' + miss.join(', ') + '. Sceglila qui sotto.'); continue; }
      const b = P.buildLines(ds.rows, ds.mapping);
      skipped += b.skipped.noDate + b.skipped.noAmount;
      for (const l of b.lines) state.lines.push(l);
    }
    renderMapping(problems.length > 0);
    let msg = problems.join('<br>');
    if (skipped) msg += (msg ? '<br>' : '') + skipped + ' righe ignorate perché senza data o importo valido.';
    showMsg(msg);
    state.full = state.lines.length ? A.analyze(state.lines) : null;
    if (state.datasets.length && !state.full && !problems.length) showMsg('Nessuna vendita valida trovata nel file. Controlla le colonne riconosciute.');
    const has = !!state.full;
    $('welcome').hidden = state.datasets.length > 0;
    $('dash').hidden = !has; $('actions').hidden = !state.datasets.length;
    if (has) render();
  }

  function renderMapping(open) {
    const el = $('mapping');
    el.hidden = !state.datasets.length;
    el.open = open;
    el.innerHTML = '<summary>Colonne riconosciute (correggi se serve)</summary>' + state.datasets.map((ds, di) =>
      '<div class="mf">' + esc(ds.name) + ' · ' + ds.rows.length + ' righe</div><div class="mgrid">' +
      P.FIELDS.map(f => '<label>' + LABELS[f] + '<select data-d="' + di + '" data-f="' + f + '"><option value="-1">— nessuna —</option>' +
        ds.headers.map((h, i) => '<option value="' + i + '"' + (ds.mapping[f] === i ? ' selected' : '') + '>' + esc(h || 'colonna ' + (i + 1)) + '</option>').join('') + '</select></label>').join('') + '</div>').join('');
  }

  // ---------- periodo
  function periodLines(days, shift) {
    const last = state.full.totals.last;
    const to = A.addDays(last, 1 - (shift || 0) * days);          // esclusivo
    const from = days ? A.addDays(to, -days) : new Date(0);
    return state.lines.filter(l => l.ts >= from && l.ts < to);
  }
  const delta = (cur, prev) => (prev ? cur / prev - 1 : null);
  function pill(d, suffix) {
    if (d == null || !isFinite(d)) return '';
    const cls = Math.abs(d) < 0.005 ? 'flat' : d > 0 ? '' : 'neg';
    return '<span class="pill ' + cls + '">' + (d > 0.005 ? '▲ +' : d < -0.005 ? '▼ −' : '= ') + A.fmtPct(Math.abs(d)) + '</span>' + (suffix ? ' <span>' + suffix + '</span>' : '');
  }
  const PNAME = { 1: 'ieri', 7: 'settimana scorsa', 30: 'mese precedente', 365: 'anno precedente' };

  function render() {
    const F = state.full, T = F.totals, p = state.period;
    const cur = A.analyze(periodLines(p), { dropPartial: false });
    const prev = p ? A.analyze(periodLines(p, 1), { dropPartial: false }) : null;
    $('range').textContent = (p ? 'Ultimi ' + (p === 1 ? 'giorno' : p + ' giorni') + ' · ' : 'Tutto il periodo · ') + 'dati dal ' + A.fmtDate(T.first) + ' al ' + A.fmtDate(T.last) +
      (F.droppedPartial ? ' (giornata del ' + A.fmtDate(F.droppedPartial) + ' esclusa: incompleta)' : '');
    const c = cur ? cur.totals : null;
    if (!c) { $('kpis').innerHTML = '<div class="kpi main"><div class="l">Nessuna vendita nel periodo</div></div>'; }
    else {
      const pt = prev ? prev.totals : null, top = cur.products[0], bh = cur.hours.slice().sort((a, b) => b.revenue - a.revenue)[0];
      const win = cur.bestWindow;
      $('kpis').innerHTML =
        '<div class="kpi main"><div class="l">Incassi' + (p === 1 ? ' di ' + A.fmtDate(c.last) : '') + '</div><div class="v">' + A.fmtEur(c.revenue, 0) + '</div><div class="s">' + (pt ? pill(delta(c.revenue, pt.revenue), 'vs ' + PNAME[p]) : c.receipts + ' scontrini') + '</div></div>' +
        '<div class="kpi"><div class="l">Scontrino medio</div><div class="v">' + A.fmtEur(c.avgTicket) + '</div><div class="s">' + (pt ? pill(delta(c.avgTicket, pt.avgTicket), 'vs ' + PNAME[p]) : A.group(c.itemsPerReceipt, 1) + ' prodotti a scontrino') + '</div></div>' +
        '<div class="kpi"><div class="l">Scontrini</div><div class="v">' + A.fmtInt(c.receipts) + '</div><div class="s">' + (pt ? pill(delta(c.receipts, pt.receipts), 'vs ' + PNAME[p]) : '≈ ' + A.fmtInt(c.receipts / c.activeDays) + ' al giorno') + '</div></div>' +
        '<div class="kpi"><div class="l">Prodotto top</div><div class="v" style="font-size:1.4rem">' + esc(top.name) + '</div><div class="s">' + A.fmtEur(top.revenue, 0) + ' · ' + A.fmtInt(top.qty) + ' pezzi</div></div>' +
        '<div class="kpi"><div class="l">Ora migliore</div><div class="v">' + (bh ? bh.hour + ':00 – ' + (bh.hour + 1) + ':00' : '–') + '</div><div class="s">' + (win && c.activeDays > 1 ? 'finestra d\'oro ' + win.from + ':00–' + win.to + ':00 (' + A.fmtPct(win.share) + ' incassi)' : bh ? A.fmtEur(bh.revenue, 0) + ' incassati' : '') + '</div></div>';
    }
    renderTop(cur);
    renderStatic();
  }

  // ---------- grafici
  function bars(items, o) {
    o = o || {};
    const bw = o.bw || 38, W = Math.max(items.length * bw + 8, 300), H = o.h || 190, top = 20, bot = 24;
    const max = Math.max(1, ...items.map(i => i.v));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" role="img" aria-label="' + esc(o.aria || 'grafico') + '">';
    s += '<line x1="0" x2="' + W + '" y1="' + (H - bot) + '" y2="' + (H - bot) + '" stroke="#d8cfb3"/>';
    items.forEach((it, i) => {
      const h = Math.max(it.v > 0 ? 2 : 0, it.v / max * (H - top - bot)), x = 4 + i * bw + bw * .14, w = bw * .72, y = H - bot - h;
      s += '<rect class="bar ' + (it.cls || '') + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3"><title>' + esc(it.tip || it.label) + '</title></rect>';
      s += '<text class="mut" x="' + (x + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(it.label) + '</text>';
      if (o.values !== false) s += '<text x="' + (x + w / 2) + '" y="' + (y - 4) + '" text-anchor="middle">' + esc(it.top) + '</text>';
    });
    return s + '</svg>';
  }
  const short = n => (n >= 1000 ? A.group(n / 1000, 1) + 'k' : A.fmtInt(n));

  function renderStatic() {
    const F = state.full;
    // suggerimenti
    const TAG = { warn: 'Attenzione', tip: 'Da provare', good: 'Punto di forza' };
    $('sugg').innerHTML = F.suggestions.map(s => '<div class="s-card ' + s.level + '"><span class="tag">' + TAG[s.level] + '</span><b>' + esc(s.title) + '</b><p>' + esc(s.text) + '</p></div>').join('');

    // confronti
    const cmp = (c, title) => {
      if (!c) return '<article class="card"><h3>' + title + '</h3><p class="note">Servono almeno ' + 2 * (title.indexOf('7') > 0 ? 7 : 30) + ' giorni di dati per questo confronto.</p></article>';
      const row = (l, a, b, d, f) => '<tr><td>' + l + '</td><td>' + f(a) + '</td><td>' + f(b) + '</td><td class="' + (d > 0.005 ? 'up' : d < -0.005 ? 'down' : '') + '">' + (d == null ? '–' : (d > 0 ? '▲ +' : d < 0 ? '▼ −' : '') + A.fmtPct(Math.abs(d))) + '</td></tr>';
      return '<article class="card"><h3>' + title + '</h3><table><tr><th></th><th>' + A.fmtShort(c.curFrom) + '–' + A.fmtShort(c.curTo) + '</th><th>' + A.fmtShort(c.prevFrom) + '–' + A.fmtShort(c.prevTo) + '</th><th>Δ</th></tr>' +
        row('Incasso', c.cur.revenue, c.prev.revenue, c.delta.revenue, v => A.fmtEur(v, 0)) +
        row('Scontrini', c.cur.receipts, c.prev.receipts, c.delta.receipts, A.fmtInt) +
        row('Scontrino medio', c.cur.avgTicket, c.prev.avgTicket, c.delta.avgTicket, v => A.fmtEur(v)) + '</table></article>';
    };
    const mt = F.months.length >= 2 ? '<article class="card"><h3>Mesi <small>(calendario)</small></h3><table><tr><th></th><th>Incasso</th><th>Scontrino medio</th><th>Media/giorno</th></tr>' +
      F.months.map((m, i) => '<tr><td>' + ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][m.month] + ' ' + m.year + (m.partial ? ' *' : '') + '</td><td>' + A.fmtEur(m.revenue, 0) + '</td><td>' + A.fmtEur(m.avgTicket) + '</td><td>' + A.fmtEur(m.avgDaily, 0) + '</td></tr>').join('') +
      '</table><p class="note">* mese incompleto: confronta le medie al giorno.</p></article>' : '';
    $('compare').innerHTML = cmp(F.week, 'Ultimi 7 giorni vs 7 precedenti') + cmp(F.month, 'Ultimi 30 giorni vs 30 precedenti') + mt;
    $('ch-weeks').innerHTML = F.weeks.length >= 2 ? bars(F.weeks.map((w, i) => ({ label: A.fmtShort(w.from), v: w.revenue, top: short(w.revenue), cls: i === F.weeks.length - 1 ? 'gold' : '', tip: A.fmtShort(w.from) + '–' + A.fmtShort(w.to) + ': ' + A.fmtEur(w.revenue, 0) })), { bw: 56, aria: 'Incassi per settimana' })
      : '<p class="note">Servono almeno 14 giorni di dati.</p>';

    // ore
    const hs = F.hours.filter(h => h.inRange), slow = new Set();
    F.slowSlots.forEach(s => s.hours.forEach(h => slow.add(h.hour)));
    const bestSet = new Set(F.topHours.map(h => h.hour));
    $('ch-hours').innerHTML = bars(hs.map(h => ({ label: h.hour + '', v: h.avgRevenue, top: short(h.avgRevenue), cls: slow.has(h.hour) ? 'warn' : bestSet.has(h.hour) ? 'gold' : '', tip: h.hour + ':00–' + (h.hour + 1) + ':00 · media ' + A.fmtEur(h.avgRevenue, 0) + ' · ' + A.fmtPct(h.share, 1) + ' degli incassi' })), { aria: 'Incasso medio per ora' });
    const allCells = F.heat.flatMap(r => r.cells), hmax = Math.max(1, ...allCells);
    $('heat').innerHTML = '<table class="heat"><tr><th></th>' + hs.map(h => '<th>' + h.hour + '</th>').join('') + '</tr>' + F.heat.map(r => '<tr><th>' + r.short + '</th>' +
      r.cells.map(v => { const pc = v / hmax; return '<td class="' + (pc > .55 ? 'dk' : '') + '" style="background:rgba(31,107,80,' + (v ? .1 + pc * .9 : .04).toFixed(2) + ')" title="' + A.fmtEur(v, 0) + '">' + (v ? Math.round(v) : '–') + '</td>'; }).join('') + '</tr>').join('') + '</table>';

    // giorni
    const open = F.dowStats.filter(d => d.days > 0);
    $('ch-dow').innerHTML = bars(F.dowStats.map(d => ({ label: d.short, v: d.avgRevenue, top: short(d.avgRevenue), cls: F.worstDow && d.dow === F.worstDow.dow ? 'warn' : F.bestDow && d.dow === F.bestDow.dow ? 'gold' : '', tip: d.name + ': media ' + A.fmtEur(d.avgRevenue, 0) + ' su ' + d.days + ' giorni' })), { bw: 56, aria: 'Incasso medio per giorno della settimana' });
    $('worst').innerHTML = F.worstDays.length ? '<table><tr><th>Giorno</th><th>Incasso</th><th>vs media del giorno</th></tr>' + F.worstDays.map(d =>
      '<tr><td>' + A.DOW_SHORT[d.dow] + ' ' + A.fmtDate(d.date) + '</td><td>' + A.fmtEur(d.revenue, 0) + '</td><td class="' + (d.vsDow < -.005 ? 'down' : '') + '">' + (d.vsDow < 0 ? '▼ −' : '▲ +') + A.fmtPct(Math.abs(d.vsDow)) + '</td></tr>').join('') + '</table><p class="note">Giorni con meno incasso nel periodo caricato.</p>'
      : '<p class="note">Servono almeno 10 giorni di dati.</p>';

    $('foot').textContent = A.fmtInt(F.totals.receipts) + ' scontrini · ' + A.fmtInt(state.lines.length) + ' righe · ' + F.totals.activeDays + ' giorni con vendite. Fasce orarie, giorni e suggerimenti usano tutti i dati caricati; le schede in alto cambiano solo i riquadri e i prodotti.';
  }

  function renderTop(cur) {
    const m = state.topMode;
    const list = cur ? cur.products.slice().sort((a, b) => b[m] - a[m]).slice(0, 10) : [];
    const max = list.length ? list[0][m] : 1;
    $('top').innerHTML = '<ol class="rank">' + list.map((p, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + esc(p.name) + ' <span class="sub">' + (m === 'revenue' ? A.fmtInt(p.qty) + ' pz' : A.fmtEur(p.revenue, 0)) + '</span></span><b>' + (m === 'revenue' ? A.fmtEur(p.revenue, 0) : A.fmtInt(p.qty)) + '</b><span class="bg"><i style="width:' + (p[m] / max * 100).toFixed(0) + '%"></i></span></li>').join('') + '</ol>';
    const F = state.full;
    if (F.lowProfitMode === 'margin') {
      $('low-h').textContent = 'Poco redditizi (margine basso)';
      $('low').innerHTML = F.lowProfit.length ? '<table><tr><th>Prodotto</th><th>Margine</th><th>€ margine</th></tr>' + F.lowProfit.map(p => '<tr><td>' + esc(p.name) + '</td><td class="down">' + A.fmtPct(p.marginPct) + '</td><td>' + A.fmtEur(p.margin, 0) + '</td></tr>').join('') +
        '</table><p class="note">Margine medio del locale: ' + A.fmtPct(F.avgMarginPct) + '. Elenco: prodotti sotto il 75% della media (tutti i dati).</p>' : '<p class="note">Nessun prodotto con margine nettamente sotto la media. 👍</p>';
    } else {
      $('low-h').textContent = 'Poco venduti';
      $('low').innerHTML = (F.lowProfit.length ? '<table><tr><th>Prodotto</th><th>Pezzi</th><th>Incasso</th></tr>' + F.lowProfit.map(p => '<tr><td>' + esc(p.name) + '</td><td>' + A.fmtInt(p.qty) + '</td><td>' + A.fmtEur(p.revenue, 0) + '</td></tr>').join('') + '</table>' : '<p class="note">Nessun prodotto sotto l\'1% degli incassi.</p>') +
        '<p class="note">Il file non contiene il <b>costo</b> dei prodotti, quindi non posso calcolare il margine reale: aggiungi una colonna "Costo" (costo unitario) per vedere quali prodotti rendono poco.</p>';
    }
  }

  // ---------- eventi
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: type || 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const fileIn = $('file');
  fileIn.addEventListener('change', () => { loadFiles([...fileIn.files]); fileIn.value = ''; });
  $('btn-add').addEventListener('click', () => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = '.csv,.txt,.tsv'; i.onchange = () => loadFiles([...i.files]); i.click(); });
  $('btn-demo').addEventListener('click', loadDemo);
  $('btn-sample').addEventListener('click', () => { const e = new Date(); e.setDate(e.getDate() - 1); download('esempio-vendite.csv', Demo.toCSV(Demo.generate(45, e, 42))); });
  $('btn-reset').addEventListener('click', () => { state.datasets = []; showMsg(''); rebuild(); });
  $('btn-export').addEventListener('click', () => {
    const num = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
    download('prodotti.csv', ['Prodotto;Quantità;Incasso;Costo;Margine;Margine %'].concat(state.full.products.map(p => [p.name, num(p.qty), num(p.revenue), p.hasCost ? num(p.cost) : '', num(p.margin), p.marginPct == null ? '' : num(p.marginPct * 100)].join(';'))).join('\r\n'));
  });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.period = +b.dataset.p; [...$('tabs').children].forEach(x => x.classList.toggle('on', x === b)); render(); });
  $('seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.topMode = b.dataset.m; [...$('seg').children].forEach(x => x.classList.toggle('on', x === b)); render(); });
  $('mapping').addEventListener('change', e => { const s = e.target; if (s.tagName !== 'SELECT') return; state.datasets[+s.dataset.d].mapping[s.dataset.f] = +s.value; rebuild(); });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  document.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles([...e.dataTransfer.files]); });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileIn.click(); });
})();
