import type { Category, Tx } from './db.ts';
import { iso, today } from './format.ts';

export type PeriodKey = 'this_month' | 'last_month' | '3m' | '6m' | 'year' | 'all' | 'custom';
export interface Range { from: string; to: string }
export const PERIODS: [PeriodKey, string][] = [
  ['this_month', 'Luna aceasta'], ['last_month', 'Luna trecută'], ['3m', 'Ultimele 3 luni'],
  ['6m', 'Ultimele 6 luni'], ['year', 'Anul acesta'], ['all', 'Tot timpul'], ['custom', 'Interval personalizat'],
];

export function periodRange(k: PeriodKey, custom: Range, minDate: string | null): Range {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  const d = (yy: number, mm: number, dd: number) => iso(new Date(yy, mm, dd));
  switch (k) {
    case 'this_month': return { from: d(y, m, 1), to: d(y, m + 1, 0) };
    case 'last_month': return { from: d(y, m - 1, 1), to: d(y, m, 0) };
    case '3m': return { from: d(y, m - 2, 1), to: d(y, m + 1, 0) };
    case '6m': return { from: d(y, m - 5, 1), to: d(y, m + 1, 0) };
    case 'year': return { from: d(y, 0, 1), to: d(y, 11, 31) };
    case 'all': return { from: minDate ?? d(y, m, 1), to: today() };
    default: return custom;
  }
}
export function monthsIn(r: Range): string[] {
  const out: string[] = [];
  let [y, m] = r.from.slice(0, 7).split('-').map(Number);
  const end = r.to.slice(0, 7);
  for (let i = 0; i < 600; i++) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push(k);
    if (k >= end) break;
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export type CatMap = Map<string, Category>;
export const catMapOf = (c: Category[]): CatMap => new Map(c.map(x => [x.id, x]));
export const inRange = (t: Tx[], r: Range) => t.filter(x => x.date >= r.from && x.date <= r.to);
/** Investment expense = any expense whose parent category belongs to the "savings" group. */
export const isInvestment = (t: Tx, m: CatMap) => t.type === 'expense' && m.get(t.parentCategoryId)?.group === 'savings';

export interface Totals { income: number; consumption: number; investment: number; expense: number; net: number }
export function totals(t: Tx[], m: CatMap): Totals {
  let income = 0, consumption = 0, investment = 0;
  for (const x of t) {
    if (x.type === 'income') income += x.amountInRON;
    else if (isInvestment(x, m)) investment += x.amountInRON;
    else consumption += x.amountInRON;
  }
  return { income, consumption, investment, expense: consumption + investment, net: income - consumption - investment };
}
export interface Slice { id: string; name: string; color: string; value: number }
export function groupBy(t: Tx[], m: CatMap, level: 'parent' | 'sub', type: 'expense' | 'income' = 'expense'): Slice[] {
  const acc = new Map<string, number>();
  for (const x of t) {
    if (x.type !== type) continue;
    const id = level === 'parent' ? x.parentCategoryId : x.subcategoryId;
    acc.set(id, (acc.get(id) ?? 0) + x.amountInRON);
  }
  return [...acc].map(([id, value]) => {
    const c = m.get(id);
    return { id, name: c?.name ?? '(șters)', color: c?.color ?? '#64748b', value };
  }).sort((a, b) => b.value - a.value);
}
export interface MonthRow extends Totals { m: string; rate: number | null }
export function monthly(t: Tx[], m: CatMap, months: string[]): MonthRow[] {
  const buckets = new Map<string, Tx[]>(months.map(k => [k, []]));
  for (const x of t) buckets.get(x.date.slice(0, 7))?.push(x);
  return months.map(k => {
    const tt = totals(buckets.get(k) ?? [], m);
    return { m: k, ...tt, rate: tt.income > 0 ? tt.investment / tt.income : null };
  });
}
