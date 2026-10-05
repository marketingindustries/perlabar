/* Dati dimostrativi realistici di un bar (deterministici) + esportazione CSV all'italiana. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Demo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pad = n => (n < 10 ? '0' + n : '' + n);

  // pesi per fascia: [mattina 7-11, pranzo 12-14, pomeriggio 15-17, sera 18-23]
  const PRODUCTS = [
    ['Espresso', 'Caffetteria', 1.2, 0.25, [10, 5, 3, 2]],
    ['Cappuccino', 'Caffetteria', 1.6, 0.35, [8, 2, 2, 0.3]],
    ['Cornetto', 'Pasticceria', 1.3, 0.45, [7, 1, 1, 0.1]],
    ['Spritz', 'Aperitivi', 5, 1.4, [0, 0.3, 1.5, 9]],
    ['Birra media', 'Birre', 5, 1.2, [0, 1, 1, 6]],
    ['Calice di vino', 'Vini', 4, 1, [0, 0.5, 0.5, 4]],
    ['Cocktail', 'Aperitivi', 8, 2, [0, 0, 0.3, 4]],
    ['Panino', 'Cucina', 5.5, 2.6, [0.3, 7, 1, 1]],
    ['Toast', 'Cucina', 4.5, 1.9, [0.5, 4, 1.5, 0.5]],
    ['Insalatona', 'Cucina', 8, 4.7, [0, 1.2, 0.2, 0.1]],
    ['Tagliere misto', 'Cucina', 12, 6.8, [0, 0.2, 0.2, 2.5]],
    ['Acqua', 'Bibite', 1.5, 0.3, [1, 3, 1.5, 1]],
    ['Coca Cola', 'Bibite', 3, 1.1, [0.3, 3, 1.5, 1.5]],
    ['Tè freddo', 'Bibite', 3, 0.9, [0.1, 1, 1, 0.3]],
    ['Succo di frutta', 'Bibite', 3.2, 1.5, [0.5, 0.3, 0.2, 0.05]],
    ['Amaro', 'Distillati', 3.5, 0.8, [0, 0, 0, 1.5]]
  ];
  const HOUR_BASE = { 7: 15, 8: 30, 9: 22, 10: 14, 11: 10, 12: 24, 13: 26, 14: 12, 15: 5, 16: 4, 17: 6, 18: 20, 19: 34, 20: 30, 21: 18, 22: 8 };
  const DOW_F = { 0: 1.0, 1: 0.9, 2: 0.6, 3: 0.9, 4: 1.0, 5: 1.3, 6: 1.45 };

  function bucket(h) { return h < 12 ? 0 : h < 15 ? 1 : h < 18 ? 2 : 3; }

  // -> righe { ts, receipt, product, category, qty, price, total, cost }
  function generate(days, endDate, seed) {
    const rnd = rng(seed || 42);
    const rows = [];
    let rid = 0;
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    for (let k = days - 1; k >= 0; k--) {
      const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - k);
      const f = DOW_F[day.getDay()] * (k < 7 ? 0.88 : 1);
      rid = 0;
      for (let h = 7; h <= 22; h++) {
        const n = Math.round(HOUR_BASE[h] * f * (0.75 + 0.5 * rnd()));
        for (let i = 0; i < n; i++) {
          rid++;
          const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, Math.floor(rnd() * 60), Math.floor(rnd() * 60));
          const b = bucket(h);
          const items = [];
          const nItems = rnd() < 0.55 ? 1 : rnd() < 0.7 ? 2 : rnd() < 0.7 ? 3 : 4;
          const pick = () => {
            const tot = PRODUCTS.reduce((s, p) => s + p[4][b], 0);
            let x = rnd() * tot;
            for (const p of PRODUCTS) { x -= p[4][b]; if (x <= 0) return p; }
            return PRODUCTS[0];
          };
          for (let j = 0; j < nItems; j++) {
            const p = pick();
            if (!items.includes(p)) items.push(p);
            if (p[0] === 'Cappuccino' && rnd() < 0.6) { const c = PRODUCTS[2]; if (!items.includes(c)) items.push(c); }
          }
          for (const p of items) {
            const qty = rnd() < 0.12 ? 2 : 1;
            rows.push({ ts, receipt: day.getFullYear() * 1e4 + (day.getMonth() + 1) * 100 + day.getDate() + '-' + rid, product: p[0], category: p[1], qty, price: p[2], total: p[2] * qty, cost: p[3] });
          }
        }
      }
    }
    return rows;
  }

  const num = n => String(Math.round(n * 100) / 100).replace('.', ',');
  function toCSV(rows) {
    const out = ['Data;Ora;Scontrino;Prodotto;Categoria;Quantità;Prezzo;Importo;Costo'];
    for (const r of rows) {
      const t = r.ts;
      out.push([pad(t.getDate()) + '/' + pad(t.getMonth() + 1) + '/' + t.getFullYear(), pad(t.getHours()) + ':' + pad(t.getMinutes()),
        r.receipt, r.product, r.category, r.qty, num(r.price), num(r.total), num(r.cost)].join(';'));
    }
    return out.join('\r\n');
  }

  return { generate, toCSV };
});
