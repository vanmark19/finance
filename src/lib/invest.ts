import type { Settings, Snapshot, Tx } from './db.ts';
import { allTimeReturn, chainLink, modifiedDietz, xirr } from './returns.ts';
import type { Flow } from './returns.ts';

export type Cur = 'RON' | 'EUR';
export interface Contribution { id: string; date: string; amount: number; currency: Cur }
/** Contributions are DERIVED from ETF expense transactions (single source of truth), on/after setup date. Each stays in its own currency. */
export function contributions(txs: Tx[], s: Pick<Settings, 'etfSubcategoryId' | 'initialSetupDate'>): Contribution[] {
  const t0 = s.initialSetupDate;
  if (!s.etfSubcategoryId || !t0) return [];
  return txs
    .filter(t => t.type === 'expense' && t.subcategoryId === s.etfSubcategoryId && t.date >= t0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => ({ id: t.id, date: t.date, amount: t.amount, currency: t.currency }));
}

export interface Point { date: string; value: number; invested: number; profit: number }
export interface PeriodRet { from: string; to: string; ret: number | null }
export interface Estimate { ret: number | null; reason: string | null }
/** One independent portfolio (RON or EUR). All amounts are minor units of `currency`; no conversion is ever applied. */
export interface Sleeve {
  currency: Cur; active: boolean; initial: number; contribTotal: number; investedAll: number; latestDate: string | null;
  value: number | null; investedAtLatest: number | null; profit: number | null; allTime: number | null; pending: number;
  points: Point[]; periods: PeriodRet[]; monthly: PeriodRet | null; annual: Estimate; annualized: Estimate; chained: number | null;
}
export interface Summary { latest: Snapshot | null; ron: Sleeve; eur: Sleeve }
const D = (s: string) => new Date(s + 'T00:00:00Z');

function sleeve(cur: Cur, s: Settings, snapsIn: Snapshot[], all: Contribution[]): Sleeve {
  const t0 = s.initialSetupDate as string;
  const initial = cur === 'RON' ? s.initialPortfolioValueRON : s.initialPortfolioValueEUR;
  const cons = all.filter(c => c.currency === cur);
  const val = (x: Snapshot) => (cur === 'RON' ? x.valueRON : x.valueEUR);
  const snaps = snapsIn.filter(x => x.date >= t0).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const upTo = (d: string) => cons.filter(c => c.date <= d);
  const investedAt = (d: string) => initial + upTo(d).reduce((a, c) => a + c.amount, 0);
  const contribTotal = cons.reduce((a, c) => a + c.amount, 0);
  const active = initial > 0 || cons.length > 0 || snaps.some(x => val(x) > 0);
  const points: Point[] = [{ date: t0, value: initial, invested: initial, profit: 0 },
    ...snaps.map(x => { const inv = investedAt(x.date); return { date: x.date, value: val(x), invested: inv, profit: val(x) - inv }; })];
  const periods: PeriodRet[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const flows: Flow[] = cons.filter(c => c.date > a.date && c.date <= b.date).map(c => ({ date: D(c.date), amount: c.amount }));
    periods.push({ from: a.date, to: b.date, ret: modifiedDietz(a.value, b.value, flows, D(a.date), D(b.date)) });
  }
  const none = 'Introdu cel puțin o evaluare a portofoliului.';
  const base: Sleeve = { currency: cur, active, initial, contribTotal, investedAll: initial + contribTotal, latestDate: null, value: null, investedAtLatest: null,
    profit: null, allTime: null, pending: 0, points, periods, monthly: null, annual: { ret: null, reason: none }, annualized: { ret: null, reason: none }, chained: null };
  if (!snaps.length || !active) return base;

  const latest = snaps[snaps.length - 1];
  const value = val(latest), invL = investedAt(latest.date);
  const target = new Date(D(latest.date).getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const baseIdx = points.reduce((k, p, i) => (p.date <= target && p.date < latest.date ? i : k), -1);
  let annual: Estimate = { ret: null, reason: 'Sunt necesare cel puțin 12 luni de istoric pentru randamentul anual.' };
  if (baseIdx >= 0) {
    const a = points[baseIdx];
    const flows: Flow[] = cons.filter(c => c.date > a.date && c.date <= latest.date).map(c => ({ date: D(c.date), amount: c.amount }));
    annual = { ret: modifiedDietz(a.value, value, flows, D(a.date), D(latest.date)), reason: null };
  }
  const xf: Flow[] = [];
  if (initial > 0) xf.push({ date: D(t0), amount: -initial });
  upTo(latest.date).forEach(c => xf.push({ date: D(c.date), amount: -c.amount }));
  xf.push({ date: D(latest.date), amount: value });
  const x = xirr(xf);
  return { ...base, latestDate: latest.date, value, investedAtLatest: invL, profit: value - invL, allTime: allTimeReturn(value, invL),
    pending: initial + contribTotal - invL, monthly: periods.length ? periods[periods.length - 1] : null, annual,
    annualized: x === null ? { ret: null, reason: 'Date insuficiente: sunt necesare ≥30 de zile între configurarea inițială și ultima evaluare.' } : { ret: x, reason: null },
    chained: chainLink(periods.map(p => p.ret)) };
}

export function computeInvest(s: Settings, snapsIn: Snapshot[], cons: Contribution[]): Summary | null {
  if (!s.initialSetupDate) return null;
  const t0 = s.initialSetupDate;
  const snaps = snapsIn.filter(x => x.date >= t0).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  return { latest: snaps.length ? snaps[snaps.length - 1] : null, ron: sleeve('RON', s, snapsIn, cons), eur: sleeve('EUR', s, snapsIn, cons) };
}
