import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import { useC } from '../ctx';
import { PERIODS, type PeriodKey } from '../lib/stats';
import { fmt, fmtDate } from '../lib/format';
import type { Tx } from '../lib/db';
import { CatIcon } from './icons';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`rounded-2xl bg-card p-4 shadow-sm shadow-black/10 border border-line ${className}`}>{children}</div>;

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-line p-5 pb-safe" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Închide" className="rounded-full p-2 text-mute" onClick={onClose}><X size={22} /></button></div>
        {children}
      </div>
    </div>
  );
}
export const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block"><span className="lbl">{label}</span>{children}</label>;

export function Kpi({ label, value, sub, color = 'text-ink' }: { label: string; value: string; sub?: ReactNode; color?: string }) {
  return <Card className="!p-3"><div className="text-xs text-mute">{label}</div><div className={`mt-1 text-lg font-bold leading-tight break-words ${color}`}>{value}</div>{sub && <div className="mt-1 text-[11px] text-mute">{sub}</div>}</Card>;
}
export const Empty = ({ children }: { children: ReactNode }) => <div className="py-8 text-center text-sm text-mute">{children}</div>;
export const H = ({ children }: { children: ReactNode }) => <h2 className="mb-1 mt-2 text-base font-bold">{children}</h2>;
export const Note = ({ children }: { children: ReactNode }) => <p className="text-xs leading-relaxed text-mute">{children}</p>;

export function ChartBox({ title, sub, h = 210, children }: { title: string; sub?: string; h?: number; children: ReactNode }) {
  return <Card><div className="text-sm font-semibold">{title}</div>{sub && <div className="mb-2 text-xs text-mute">{sub}</div>}
    <div style={{ height: h }} className="mt-2 w-full"><ResponsiveContainer width="100%" height="100%">{children as never}</ResponsiveContainer></div></Card>;
}
export const tip = { contentStyle: { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }, labelStyle: { color: 'var(--mute)' } };
export const ronTip = (v: unknown) => `${Number(v).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} RON`;
export const curTip = (c: string) => (v: unknown) => `${Number(v).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ${c}`;
export const axis = { stroke: 'var(--mute)', fontSize: 11, tickLine: false, axisLine: false } as const;

export function PeriodBar() {
  const { period, setPeriod, custom, setCustom } = useC();
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label="Perioadă" className="inp flex-1" value={period} onChange={e => setPeriod(e.target.value as PeriodKey)}>
        {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {period === 'custom' && <>
        <input type="date" aria-label="De la" className="inp flex-1" value={custom.from} max={custom.to} onChange={e => e.target.value && setCustom({ ...custom, from: e.target.value })} />
        <input type="date" aria-label="Până la" className="inp flex-1" value={custom.to} min={custom.from} onChange={e => e.target.value && setCustom({ ...custom, to: e.target.value })} />
      </>}
    </div>
  );
}

export function TxRow({ t }: { t: Tx }) {
  const { catMap, openTx } = useC();
  const sub = catMap.get(t.subcategoryId), par = catMap.get(t.parentCategoryId);
  const inc = t.type === 'income';
  return (
    <button onClick={() => openTx(t)} className="flex w-full items-center gap-3 py-3 text-left active:opacity-70">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: (sub?.color ?? '#64748b') + '30', color: sub?.color ?? '#64748b' }}><CatIcon name={sub?.icon ?? 'Tag'} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{t.description || sub?.name || '(categorie ștearsă)'}</span>
        <span className="block truncate text-xs text-mute">{par?.name} · {sub?.name} · {fmtDate(t.date)}</span>
      </span>
      <span className="text-right">
        <span className={`block font-semibold ${inc ? 'text-inc' : 'text-exp'}`}>{inc ? '+' : '−'}{fmt(t.amount, t.currency)}</span>
        {t.currency === 'EUR' && <span className="block text-[11px] text-mute">≈ {fmt(t.amountInRON)}</span>}
      </span>
    </button>
  );
}
export const Bar = ({ value, color = '#818cf8' }: { value: number | null; color?: string }) =>
  <div className="h-2 w-full overflow-hidden rounded-full bg-app"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, (value ?? 0) * 100))}%`, background: color }} /></div>;
