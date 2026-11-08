import type { Currency } from './money.ts';
const nf: Record<Currency, Intl.NumberFormat> = {
  RON: new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }),
  EUR: new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR' }),
};
export const fmt = (minor: number, c: Currency = 'RON') => nf[c].format(minor / 100);
export const maj = (minor: number) => Math.round(minor) / 100;
export const pct = (x: number | null | undefined, d = 2) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
export const monthLabel = (m: string) =>
  new Date(m + '-01T00:00:00').toLocaleDateString('ro-RO', { month: 'short', year: '2-digit' });
export const axisK = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));
