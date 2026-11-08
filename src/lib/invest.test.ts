import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInvest, contributions } from './invest.ts';
import { totals, catMapOf, periodRange, monthsIn } from './stats.ts';
import { seedCategories } from './seed.ts';
import { defaultSettings } from './defaults.ts';
import type { Tx, Snapshot } from './db.ts';

const tx = (o: Partial<Tx>): Tx => ({ id: 'x' + Math.random(), type: 'expense', amount: 0, currency: 'RON', exchangeRate: 1, amountInRON: 0, date: '2026-01-01',
  parentCategoryId: 'p-savings', subcategoryId: 's-etfs', description: '', createdAt: 0, updatedAt: 0, ...o });
const snap = (o: Partial<Snapshot>): Snapshot => ({ id: 's' + Math.random(), date: '2026-03-01', valueRON: 0, valueEUR: 0, notes: '', createdAt: 0, ...o });
const S = { ...defaultSettings(), initialSetupDate: '2026-01-01', initialPortfolioValueEUR: 200000, initialPortfolioValueRON: 1000000 };

test('spec example in the EUR portfolio: 2000 + 200 -> 2250 gives +50 EUR, 2.27%', () => {
  const cons = contributions([tx({ date: '2026-02-01', amount: 20000, currency: 'EUR', exchangeRate: 5, amountInRON: 100000 })], S);
  const r = computeInvest(S, [snap({ valueEUR: 225000, valueRON: 1000000 })], cons)!;
  assert.equal(r.eur.investedAll, 220000);
  assert.equal(r.eur.profit, 5000);
  assert.ok(Math.abs(r.eur.allTime! - 50 / 2200) < 1e-9);
});
test('portfolios are independent: EUR contribution never touches the RON portfolio', () => {
  const cons = contributions([tx({ date: '2026-02-01', amount: 20000, currency: 'EUR', exchangeRate: 5, amountInRON: 100000 })], S);
  const r = computeInvest(S, [snap({ valueEUR: 225000, valueRON: 1100000 })], cons)!;
  assert.equal(r.ron.investedAll, 1000000); assert.equal(r.ron.profit, 100000);
  assert.ok(Math.abs(r.ron.allTime! - 0.1) < 1e-9);
});
test('RON contribution only counts in the RON portfolio', () => {
  const cons = contributions([tx({ date: '2026-02-01', amount: 50000, amountInRON: 50000 })], S);
  const r = computeInvest(S, [snap({ valueEUR: 200000, valueRON: 1050000 })], cons)!;
  assert.equal(r.ron.investedAll, 1050000); assert.equal(r.ron.profit, 0); assert.equal(r.eur.profit, 0);
});
test('contribution after last valuation is pending, not profit/loss', () => {
  const cons = contributions([tx({ date: '2026-04-01', amount: 10000, amountInRON: 10000 })], S);
  const r = computeInvest(S, [snap({ valueEUR: 200000, valueRON: 1000000 })], cons)!;
  assert.equal(r.ron.profit, 0); assert.equal(r.ron.pending, 10000); assert.equal(r.ron.investedAll, 1010000);
});
test('contributions dated before setup are ignored (already in initial value)', () => {
  assert.equal(contributions([tx({ date: '2025-12-31', amount: 100, amountInRON: 100 })], S).length, 0);
});
test('no valuation -> no invented numbers; empty portfolio is inactive', () => {
  const r = computeInvest(S, [], [])!;
  assert.equal(r.ron.value, null); assert.equal(r.eur.allTime, null); assert.equal(r.eur.annualized.ret, null);
  const e = computeInvest({ ...S, initialPortfolioValueRON: 0 }, [snap({ valueEUR: 200000 })], [])!;
  assert.equal(e.ron.active, false); assert.equal(e.eur.active, true);
});
test('totals separate consumption and investment; net = income - all expenses', () => {
  const m = catMapOf(seedCategories());
  const t = totals([tx({ type: 'income', parentCategoryId: 'p-income', subcategoryId: 's-salary', amountInRON: 200000 }),
    tx({ parentCategoryId: 'p-needs', subcategoryId: 's-food', amountInRON: 50000 }), tx({ amountInRON: 30000 })], m);
  assert.deepEqual(t, { income: 200000, consumption: 50000, investment: 30000, expense: 80000, net: 120000 });
});
test('monthsIn spans year boundary; custom range passthrough', () => {
  assert.deepEqual(monthsIn({ from: '2025-11-15', to: '2026-01-02' }), ['2025-11', '2025-12', '2026-01']);
  assert.deepEqual(periodRange('custom', { from: 'a', to: 'b' }, null), { from: 'a', to: 'b' });
});
