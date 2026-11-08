import { db } from './db.ts';
import { today } from './format.ts';

export interface RateResult { rate: number; rateDate: string; stale: boolean; source: 'cache' | 'api' }
const API = 'https://api.frankfurter.app';

/**
 * RON per 1 EUR for a given date (YYYY-MM-DD).
 * - Cached rates are reused forever for past dates (history is preserved).
 * - Frankfurter returns the last published (business-day) rate on or before the date; `rateDate` shows it.
 * - If the API fails: for today/future we fall back to the latest cached rate (flagged stale);
 *   for past dates we return null — a historical rate is NEVER silently replaced with another date's rate.
 */
export async function getRate(date: string, force = false): Promise<RateResult | null> {
  const t = today();
  const d = date > t ? t : date;
  if (!force || d !== t) {
    const hit = await db.rates.get(d);
    if (hit) return { rate: hit.rate, rateDate: hit.rateDate, stale: false, source: 'cache' };
  }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${API}/${d === t ? 'latest' : d}?from=EUR&to=RON`, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { date: string; rates: { RON?: number } };
    const rate = j.rates?.RON;
    if (!(typeof rate === 'number' && rate > 0)) throw new Error('bad payload');
    await db.rates.put({ id: d, date: d, rateDate: j.date, baseCurrency: 'EUR', targetCurrency: 'RON', rate, source: 'frankfurter.app' });
    return { rate, rateDate: j.date, stale: false, source: 'api' };
  } catch {
    if (d === t) {
      const last = (await db.rates.orderBy('date').reverse().first()) ?? null;
      if (last) return { rate: last.rate, rateDate: last.rateDate, stale: true, source: 'cache' };
    }
    return null;
  }
}
