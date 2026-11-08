import test from 'node:test';
import assert from 'node:assert/strict';
import { netProfit, allTimeReturn, modifiedDietz, chainLink, xirr } from './returns.ts';
import { toMinor, fromMinor, eurToRon } from './money.ts';

const d = (s: string) => new Date(s + 'T00:00:00Z');
const close = (a: number | null, b: number, eps = 1e-6) => { assert.notEqual(a, null); assert.ok(Math.abs(a! - b) < eps, `${a} vs ${b}`); };

test('spec example: 2000 + 200 contribution, value 2250 EUR', () => {
  const inv = toMinor(2200), val = toMinor(2250);
  assert.equal(netProfit(val, inv), toMinor(50));
  close(allTimeReturn(val, inv), 50 / 2200); // ~2.27%
});
test('no investment -> null return', () => assert.equal(allTimeReturn(0, 0), null));
test('Modified Dietz, mid-period contribution', () => {
  close(modifiedDietz(1000, 1150, [{ date: d('2026-01-16'), amount: 100 }], d('2026-01-01'), d('2026-01-31')), 50 / 1050);
});
test('Modified Dietz ignores flows outside period', () => {
  close(modifiedDietz(1000, 1100, [{ date: d('2025-12-01'), amount: 500 }], d('2026-01-01'), d('2026-01-31')), 0.1);
});
test('chain-link', () => close(chainLink([0.1, -0.05, null]), 1.1 * 0.95 - 1));
test('XIRR 1y 10%', () => close(xirr([{ date: d('2025-01-01'), amount: -1000 }, { date: d('2026-01-01'), amount: 1100 }]), 0.1, 1e-4));
test('XIRR insufficient data -> null', () => {
  assert.equal(xirr([{ date: d('2026-01-01'), amount: -1000 }, { date: d('2026-01-10'), amount: 1010 }]), null);
  assert.equal(xirr([{ date: d('2026-01-01'), amount: -1000 }]), null);
});
test('money parsing, no float drift', () => {
  assert.equal(toMinor('0.1') + toMinor('0.2'), toMinor('0.3'));
  assert.equal(toMinor('12,5'), 1250);
  assert.equal(fromMinor(-1205), '-12.05');
  assert.throws(() => toMinor('1.234'));
  assert.equal(eurToRon(toMinor(100), 4.97), toMinor(497));
  assert.throws(() => eurToRon(100, 0));
});
