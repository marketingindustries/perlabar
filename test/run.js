const assert = require('assert');
const P = require('../js/parser'), A = require('../js/analytics'), D = require('../js/demo');

// parser
assert.strictEqual(P.parseNumber('1.234,56'), 1234.56);
assert.strictEqual(P.parseNumber('€ 12,5'), 12.5);
assert.strictEqual(P.parseNumber('1234.56'), 1234.56);
assert.strictEqual(P.parseNumber('1.234'), 1234);
assert.strictEqual(P.parseNumber('(3,00)'), -3);
assert.ok(isNaN(P.parseNumber('abc')));
const d1 = P.parseDateTime('05/10/2026 17:45'); assert.strictEqual(d1.getHours(), 17); assert.strictEqual(d1.getMonth(), 9);
const d2 = P.parseDateTime('2026-10-05T08:05:00'); assert.strictEqual(d2.getMinutes(), 5);
const d3 = P.parseDateTime('05/10/26', '9.30'); assert.strictEqual(d3.getHours(), 9);
const t = P.parseTable('Report vendite\r\nData;Ora;N. Scontrino;Descrizione;Qtà;Importo\r\n05/10/2026;10:00;1;"Caffè; doppio";2;"2,40"\r\n');
assert.strictEqual(t.mapping.product, 3); assert.strictEqual(t.rows.length, 1);
const b = P.buildLines(t.rows, t.mapping);
assert.strictEqual(b.lines[0].product, 'Caffè; doppio'); assert.strictEqual(b.lines[0].revenue, 2.4);

// round-trip demo -> CSV -> analisi
const end = new Date(2026, 9, 4);
const csv = D.toCSV(D.generate(120, end, 7));
const tab = P.parseTable(csv);
assert.deepStrictEqual(P.missingFields(tab.mapping), []);
const { lines, skipped } = P.buildLines(tab.rows, tab.mapping);
assert.strictEqual(skipped.noDate + skipped.noAmount, 0);
const a = A.analyze(lines);
assert.ok(a.slowSlots.length && a.slowSlots[0].from >= 15 && a.slowSlots[0].to <= 18, 'fascia lenta 15-18: ' + JSON.stringify(a.slowSlots.map(s => [s.from, s.to])));
assert.strictEqual(a.worstDow.dow, 2, 'martedì più debole');
assert.strictEqual(a.bestDow.dow, 6, 'sabato migliore');
assert.ok(a.week && a.week.delta.revenue < -0.05, 'calo ultima settimana');
assert.ok(a.topPair && /Cappuccino|Cornetto/.test(a.topPair.a), 'combo');
assert.strictEqual(a.lowProfitMode, 'margin');
assert.ok(a.lowProfit.some(p => p.name === 'Insalatona' || p.name === 'Tagliere misto'));
assert.ok(a.month && a.weeks.length === 8);
// ultimo giorno parziale escluso
const partial = lines.filter(l => !(l.ts.getDate() === 4 && l.ts.getMonth() === 9 && l.ts.getHours() >= 12));
assert.ok(A.analyze(partial).droppedPartial);

// ilConto: file senza intestazione, totali giornalieri per prodotto (dati inventati)
(function () {
  const names = [['0005', 'CONTO', 15, 6], ['0006', 'COPERTO', 15, 7], ['0170', 'CAPPUCCINO', 15, 8], ['0023', 'SPRITZ APEROL', 23, 9], ['0101', 'COCA COLA', 18, 9], ['0211', 'BRI VUOTA', 17, 7], ['0300', 'TIRAMISU', 17, 8], ['0301', 'PINSA PARMA', 1, 9]];
  const rows = [];
  const pad = n => (n < 10 ? '0' + n : '' + n);
  for (let d = 1; d <= 28; d++) {
    const date = pad(d) + '/10/2026';
    let tot = 0;
    const f = [1, 0.9, 0.6, 0.9, 1, 1.3, 1.5][new Date(2026, 9, d).getDay()];
    names.forEach(([code, n, dept, price], i) => {
      const qty = Math.max(1, Math.round((3 + i) * f * (1 + (d % 3) * 0.1)));
      const amount = qty * price; tot += amount;
      rows.push(['VENDITE', date, 'A', code, n, qty.toFixed(3), amount.toFixed(2), dept, 0, 1].join(';'));
    });
    rows.push(['PAGAMENTO', date, 'Contanti', (tot * 0.3).toFixed(2)].join(';'));
    rows.push(['PAGAMENTO', date, 'POS', (tot * 0.7).toFixed(2)].join(';'));
  }
  ['+ PANNA', 'Sconto', 'EDENRED', 'AGGIUNTA FRUTTA', '++PIATTO X2'].forEach((n, i) => rows.push(['VENDITE', '10/10/2026', 'A', '09' + i, n, '1.000', n === 'Sconto' ? '-1.00' : '2.00', 16, 0, 1].join(';')));
  rows.push('VENDITE;07/10/2026;A;0170;CAPPUCCINO;1.000;3.00;15;0;1');
  rows.push('TESTA FATTURA;15/10/2026;15/10/2026 13:03;A;3;1;1.00;0.00;;AZIENDA DI PROVA SRL;VIA ROMA 1 ;38121;TRENTO;TN;00000000000;00000000000;Contanti;1.00;;');
  rows.push('RIGA;15/10/2026;15/10/2026 13:03;A;3;1;0704;BAR;1.000;1.00;1.00;10;BAR;0;0;1');
  const text = rows.join('\r\n') + '\r\n';
  assert.ok(P.isIlConto(text)); assert.ok(!P.isIlConto('Data;Ora;Prodotto\n01/01/2026;10:00;X'));
  const p1 = P.parseIlConto(text, 'PERLABAR-2026-10-30-09-00-00-Vendite.csv');
  assert.strictEqual(p1.lines.length, 28 * 8 + 6); assert.strictEqual(p1.payments.length, 56); assert.strictEqual(p1.ignored, 2);
  assert.ok(p1.lines.every(l => l.daily && l.ts.getHours() === 0));
  assert.strictEqual(p1.lines[0].qty, Math.round(p1.lines[0].qty), 'qty "3.000" = 3 pezzi, non 3000');
  assert.ok(p1.lines.every(l => l.qty < 100));
  const m = P.mergeIlConto([p1]);
  assert.strictEqual(m.lines.length, 28 * 8 + 6); assert.deepStrictEqual(m.provisionalDays, []);
  // il giorno dell'export è incompleto e viene escluso; un file successivo lo sostituisce
  const p2 = P.parseIlConto(text, 'PERLABAR-2026-10-28-11-04-49-Vendite.csv');
  const m2 = P.mergeIlConto([p2]);
  assert.deepStrictEqual(m2.provisionalDays, ['2026-10-28']); assert.strictEqual(m2.lines.length, 27 * 8 + 6);
  const m3 = P.mergeIlConto([p2, P.parseIlConto(text, 'PERLABAR-2026-10-29-08-00-00-Vendite.csv')]);
  assert.strictEqual(m3.lines.length, 28 * 8 + 6); assert.deepStrictEqual(m3.provisionalDays, []);
  // analisi giornaliera
  const a = A.analyze(m.lines);
  assert.strictEqual(a.daily, true); assert.strictEqual(a.hasHours, false);
  assert.strictEqual(a.totals.receipts, null); assert.strictEqual(a.totals.avgTicket, null);
  assert.strictEqual(a.totals.activeDays, 28);
  assert.ok(!a.products.some(x => /^(conto|coperto)$/i.test(x.name)), 'CONTO e COPERTO non sono prodotti');
  assert.ok(a.serviceItems.length >= 7, 'voci di servizio escluse: ' + a.serviceItems.map(x => x.name));
  assert.ok(a.closedDays.length >= 0);
  assert.strictEqual(a.worstDow.dow, 2, 'martedì più debole'); assert.strictEqual(a.bestDow.dow, 6, 'sabato migliore');
  assert.ok(a.suggestions.some(x => /Mancano gli orari/.test(x.title)));
  assert.ok(a.hours.length === 0 && a.slowSlots.length === 0 && a.week && a.month === null);
  console.log('ilConto OK');
})();

console.log(a.suggestions.map(s => '- [' + s.level + '] ' + s.title + '\n    ' + s.text).join('\n'));
console.log('\nOK');
