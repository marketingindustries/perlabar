/* Lettura export del gestionale/cassa: CSV (; , tab), numeri e date all'italiana. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Parser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function detectDelimiter(text) {
    const sample = text.slice(0, 4000);
    const counts = { ';': 0, ',': 0, '\t': 0, '|': 0 };
    let inQ = false;
    for (const ch of sample) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch in counts) counts[ch]++;
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }

  function parseCSV(text, delim) {
    const rows = [];
    let row = [], field = '', inQ = false;
    const flush = () => {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"' && field === '') inQ = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; flush(); }
      else field += c;
    }
    if (field !== '' || row.length) flush();
    return rows;
  }

  // "1.234,56" "1234.56" "€ 12,5" "(3,00)" "-4,2" -> number | NaN
  function parseNumber(v) {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    s = s.replace(/[€\s ]|eur/gi, '');
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s[0] === '-') { neg = !neg; s = s.slice(1); }
    else if (s[0] === '+') s = s.slice(1);
    const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c >= 0 && d >= 0) {
      s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (c >= 0) {
      s = (s.match(/,/g).length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (d >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    const n = parseFloat(s);
    return neg ? -n : n;
  }

  // Data (dd/mm/yyyy o yyyy-mm-dd, con o senza ora) + ora opzionale separata -> Date | null
  function parseDateTime(v, t) {
    v = String(v == null ? '' : v).trim();
    t = String(t == null ? '' : t).trim();
    let y, mo, d, h = 0, mi = 0, se = 0, m, hasTime = false;
    if ((m = v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T,\s]+(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?/))) {
      y = +m[1]; mo = +m[2]; d = +m[3];
      if (m[4] !== undefined) { h = +m[4]; mi = +m[5]; se = +(m[6] || 0); hasTime = true; }
    } else if ((m = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})(?:[T,\s]+(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?/))) {
      d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000;
      if (m[4] !== undefined) { h = +m[4]; mi = +m[5]; se = +(m[6] || 0); hasTime = true; }
    } else return null;
    if (!hasTime && t) {
      const tm = t.match(/(\d{1,2})[:.](\d{2})(?::(\d{2}))?/);
      if (tm) { h = +tm[1]; mi = +tm[2]; se = +(tm[3] || 0); }
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
    return new Date(y, mo - 1, d, h, mi, se);
  }

  const FIELDS = ['datetime', 'date', 'time', 'receipt', 'product', 'qty', 'price', 'total', 'cost', 'category'];
  const EXACT = {
    datetime: /^(data ora|datetime|data e ora|timestamp|data ora scontrino|data scontrino ora|data documento ora)$/,
    date: /^(data|giorno|date|data vendita|data scontrino|data documento)$/,
    time: /^(ora|orario|time|ora vendita|ora scontrino)$/,
    receipt: /^(scontrino|n scontrino|numero scontrino|num scontrino|nr scontrino|documento|n documento|numero documento|id scontrino|ticket|n ticket|id vendita|numero|n|id|conto|comanda|n conto)$/,
    product: /^(prodotto|articolo|descrizione|descrizione articolo|descrizione prodotto|desc|nome|nome prodotto|voce|product|item)$/,
    qty: /^(quantita|qta|q ta|qt|pezzi|n pezzi|quantity|qty|q)$/,
    price: /^(prezzo|prezzo unitario|prz|prezzo vendita|prezzo unit|unit price|price|listino|prezzo listino)$/,
    total: /^(importo|totale|totale riga|importo riga|incasso|valore|netto|totale netto|lordo|totale lordo|amount|total|importo totale)$/,
    cost: /^(costo|costo unitario|costo acquisto|costo unit|prezzo acquisto|cost|costo medio)$/,
    category: /^(categoria|reparto|famiglia|gruppo|category|categoria merceologica)$/
  };
  const LOOSE = {
    datetime: /data.*ora|ora.*data/, date: /\bdata\b|giorno/, time: /\bora\b|orario/,
    receipt: /scontrin|document|ticket|conto/, product: /prodott|articol|descriz/,
    qty: /quant|qta|pezzi/, price: /prezz/, total: /import|total|incass/,
    cost: /cost/, category: /categ|repart|famigl/
  };

  // headers -> { campo: indiceColonna | -1 }
  function detectColumns(headers) {
    const map = {}, used = new Set();
    const n = headers.map(norm);
    FIELDS.forEach(f => { map[f] = -1; });
    [EXACT, LOOSE].forEach(table => {
      FIELDS.forEach(f => {
        if (map[f] >= 0) return;
        const i = n.findIndex((h, idx) => !used.has(idx) && h && table[f].test(h));
        if (i >= 0) { map[f] = i; used.add(i); }
      });
    });
    if (map.datetime >= 0 && map.date >= 0 && map.time < 0) { /* data+ora insieme e data: tieni datetime */ map.date = -1; }
    return map;
  }

  function decodeBuffer(buf) {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { text = new TextDecoder('windows-1252').decode(buf); }
    return text.replace(/^﻿/, '');
  }

  // testo -> { headers, rows, delimiter, mapping }
  function parseTable(text) {
    text = text.replace(/^﻿/, '');
    let delim = null;
    const sep = text.match(/^sep=(.)\r?\n/i);
    if (sep) { delim = sep[1]; text = text.slice(sep[0].length); }
    if (!delim) delim = detectDelimiter(text);
    const all = parseCSV(text, delim);
    if (!all.length) return { headers: [], rows: [], delimiter: delim, mapping: detectColumns([]) };
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(10, all.length); i++) {
      const m = detectColumns(all[i]);
      const score = FIELDS.filter(f => m[f] >= 0).length;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const headers = all[best].map(h => String(h).trim());
    return { headers, rows: all.slice(best + 1), delimiter: delim, mapping: detectColumns(headers) };
  }

  function missingFields(mapping) {
    const miss = [];
    if (mapping.datetime < 0 && mapping.date < 0) miss.push('data (e ora)');
    if (mapping.product < 0) miss.push('prodotto');
    if (mapping.total < 0 && mapping.price < 0) miss.push('importo o prezzo');
    return miss;
  }

  // righe + mapping -> righe vendita normalizzate
  function buildLines(rows, mapping) {
    const lines = [];
    const skipped = { noDate: 0, noAmount: 0 };
    const cell = (r, f) => (mapping[f] >= 0 ? r[mapping[f]] : undefined);
    for (const r of rows) {
      const ts = mapping.datetime >= 0
        ? parseDateTime(cell(r, 'datetime'), mapping.time >= 0 ? cell(r, 'time') : '')
        : parseDateTime(cell(r, 'date'), cell(r, 'time'));
      if (!ts) { skipped.noDate++; continue; }
      let qty = parseNumber(cell(r, 'qty'));
      if (!isFinite(qty) || qty === 0) qty = 1;
      let revenue = parseNumber(cell(r, 'total'));
      if (!isFinite(revenue)) {
        const p = parseNumber(cell(r, 'price'));
        revenue = isFinite(p) ? p * qty : NaN;
      }
      if (!isFinite(revenue)) { skipped.noAmount++; continue; }
      const c = parseNumber(cell(r, 'cost'));
      const rid = mapping.receipt >= 0 ? String(cell(r, 'receipt') || '').trim() : '';
      lines.push({
        ts,
        receipt: rid ? dayKey(ts) + '|' + rid : 'auto|' + Math.floor(ts.getTime() / 60000),
        product: String(cell(r, 'product') || '').trim() || '(senza nome)',
        category: String(cell(r, 'category') || '').trim(),
        qty, revenue,
        cost: isFinite(c) ? c * Math.abs(qty) * (qty < 0 ? -1 : 1) : null
      });
    }
    return { lines, skipped };
  }

  return { FIELDS, norm, dayKey, parseCSV, parseTable, parseNumber, parseDateTime,
    detectColumns, decodeBuffer, missingFields, buildLines };
});
