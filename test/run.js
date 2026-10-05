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
console.log(a.suggestions.map(s => '- [' + s.level + '] ' + s.title + '\n    ' + s.text).join('\n'));
console.log('\nOK');
