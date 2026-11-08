export interface Flow { date: Date; amount: number } // contribution amount > 0 (money put in)

const DAY = 86_400_000;

/** Net profit = current value - cumulative contributions (contributions are never profit). */
export function netProfit(value: number, contributions: number): number {
  return value - contributions;
}

/** All-time return on contributed capital. null when nothing invested. */
export function allTimeReturn(value: number, contributions: number): number | null {
  return contributions > 0 ? (value - contributions) / contributions : null;
}

/** Modified Dietz estimated period return. Flows must fall inside (start, end]. */
export function modifiedDietz(
  begin: number, end: number, flows: Flow[], start: Date, endDate: Date,
): number | null {
  const total = endDate.getTime() - start.getTime();
  if (total <= 0) return null;
  let net = 0, weighted = 0;
  for (const f of flows) {
    const t = f.date.getTime();
    if (t < start.getTime() || t > endDate.getTime()) continue;
    net += f.amount;
    weighted += f.amount * ((endDate.getTime() - t) / total);
  }
  const denom = begin + weighted;
  return denom > 0 ? (end - begin - net) / denom : null;
}

/** Chain-link period returns: product(1+r)-1. Skips periods with null return. */
export function chainLink(returns: (number | null)[]): number | null {
  const valid = returns.filter((r): r is number => r !== null);
  return valid.length ? valid.reduce((a, r) => a * (1 + r), 1) - 1 : null;
}

/**
 * XIRR on dated cash flows (investor perspective: contributions negative, final value positive).
 * Returns null when data is insufficient (no sign change, or span under 30 days).
 */
export function xirr(flows: Flow[]): number | null {
  if (flows.length < 2) return null;
  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();
  const span = (sorted[sorted.length - 1].date.getTime() - t0) / DAY;
  if (span < 30) return null;
  if (!sorted.some(f => f.amount > 0) || !sorted.some(f => f.amount < 0)) return null;
  const npv = (r: number) =>
    sorted.reduce((s, f) => s + f.amount / Math.pow(1 + r, (f.date.getTime() - t0) / DAY / 365), 0);
  let lo = -0.9999, hi = 100;
  let flo = npv(lo), fhi = npv(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}
