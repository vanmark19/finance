import { useMemo, useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { useC } from '../ctx';
import { axis, Bar, Card, ChartBox, Empty, Note, PeriodBar, ronTip, tip } from '../components/ui';
import { db } from '../lib/db';
import { defaultPercentages } from '../lib/seed';
import { axisK, fmt, maj, pct } from '../lib/format';
import { inRange, totals } from '../lib/stats';

export default function Budget() {
  const { data, range, catMap } = useC();
  const { cats, txs, settings } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const inR = useMemo(() => inRange(txs, range), [txs, range]);
  const income = useMemo(() => totals(inR, catMap).income, [inR, catMap]);
  const parents = cats.filter(c => !c.parentId && c.type === 'expense' && c.isActive).sort((a, b) => a.sort - b.sort);
  const subs = (p: string) => cats.filter(c => c.parentId === p && c.isActive).sort((a, b) => a.sort - b.sort);
  const actual = (id: string, lvl: 'parentCategoryId' | 'subcategoryId') => inR.filter(x => x.type === 'expense' && x[lvl] === id).reduce((a, x) => a + x.amountInRON, 0);

  if (!settings.budgetingEnabled) return <Card><Empty>Sistemul de buget 50/30/20 este dezactivat.</Empty>
    <button className="btn-p w-full" onClick={() => db.settings.update('main', { budgetingEnabled: true })}>Activează</button></Card>;

  const totalPct = parents.reduce((a, p) => a + p.budgetPercentage, 0);
  const warnings = [
    Math.abs(totalPct - 100) > 0.01 && `Categoriile principale însumează ${totalPct.toFixed(1)}% (ar trebui 100%).`,
    ...parents.map(p => { const s = subs(p.id).reduce((a, x) => a + x.budgetPercentage, 0); return Math.abs(s - p.budgetPercentage) > 0.01 ? `${p.name}: subcategoriile însumează ${s.toFixed(1)}% față de ${p.budgetPercentage}%.` : false; }),
  ].filter(Boolean) as string[];
  const chart = parents.map(p => ({ name: p.name.split(' ')[0], Ideal: maj(income * p.budgetPercentage / 100), Real: maj(actual(p.id, 'parentCategoryId')) }));

  function startEdit() { setDraft(Object.fromEntries(cats.filter(c => c.type === 'expense').map(c => [c.id, String(c.budgetPercentage)]))); setErr(''); setEditing(true); }
  async function saveEdit() {
    const upd: [string, number][] = [];
    for (const [id, v] of Object.entries(draft)) { const n = parseFloat(v.replace(',', '.')); if (!(n >= 0 && n <= 100)) return setErr('Procentele trebuie să fie între 0 și 100.'); upd.push([id, n]); }
    await db.transaction('rw', db.categories, async () => { for (const [id, n] of upd) await db.categories.update(id, { budgetPercentage: n }); });
    setEditing(false);
  }
  async function reset() {
    if (!confirm('Resetezi alocările la 50/30/20 inițial?')) return;
    const d = defaultPercentages();
    await db.transaction('rw', db.categories, async () => { for (const c of await db.categories.toArray()) if (c.type === 'expense') await db.categories.update(c.id, { budgetPercentage: d[c.id] ?? 0 }); });
  }
  const pctInput = (id: string, v: number) => editing ?
    <input className="inp !w-20 !py-1.5 text-right" inputMode="decimal" aria-label="Procent" value={draft[id] ?? ''} onChange={e => setDraft({ ...draft, [id]: e.target.value })} /> : <span>{v}%</span>;

  return (
    <>
      <PeriodBar />
      <Card className="flex items-center justify-between"><div><div className="text-xs text-mute">Venituri în perioadă (baza bugetului)</div><div className="text-xl font-bold text-inc">{fmt(income)}</div></div>
        <div className="flex gap-2">{editing ? <><button className="btn-g !px-3 !py-2" onClick={() => setEditing(false)}>Anulează</button><button className="btn-p !px-3 !py-2" onClick={saveEdit}>Salvează</button></> :
          <><button className="btn-g !px-3 !py-2" onClick={startEdit}>Editează %</button><button className="btn-g !px-3 !py-2" onClick={reset}>Reset</button></>}</div></Card>
      {income === 0 && <Card><Note>Nu există venituri în perioada selectată, deci țintele sunt 0 și procentele de consum nu pot fi calculate. Cheltuielile sunt afișate în continuare.</Note></Card>}
      {editing && err && <p className="text-sm text-exp">{err}</p>}
      {warnings.map(w => <p key={w} className="rounded-xl bg-sav/15 px-3 py-2 text-xs text-sav">⚠ {w}</p>)}

      {parents.map(p => {
        const tgt = income * p.budgetPercentage / 100, act = actual(p.id, 'parentCategoryId'), used = tgt > 0 ? act / tgt : null;
        const invest = p.group === 'savings';
        return (
          <Card key={p.id}>
            <div className="flex items-center justify-between"><div className="font-bold" style={{ color: p.color }}>{p.name}{invest && <span className="ml-2 rounded-full bg-inv/20 px-2 py-0.5 text-[10px] font-semibold text-inv">investiții, nu consum</span>}</div>{pctInput(p.id, p.budgetPercentage)}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><div className="text-mute">Ideal</div><b>{fmt(tgt)}</b></div><div><div className="text-mute">Real</div><b>{fmt(act)}</b></div>
              <div><div className="text-mute">Diferență</div><b className={act > tgt && !invest ? 'text-exp' : 'text-inc'}>{fmt(act - tgt)}</b></div></div>
            <div className="mt-2"><Bar value={used} color={used != null && used > 1 && !invest ? '#fb7185' : p.color} /></div>
            <div className="mt-1 flex justify-between text-[11px] text-mute"><span>{used == null ? 'consum: n/a' : `${(used * 100).toFixed(0)}% din buget consumat`}</span>
              <span>real {income > 0 ? pct(act / income, 1) : '—'} vs ideal {p.budgetPercentage}% ({income > 0 ? ((act / income) * 100 - p.budgetPercentage).toFixed(1) : '—'} p.p.)</span></div>
            <div className="mt-3 space-y-2 border-t border-line pt-2">
              {subs(p.id).map(s => { const st = income * s.budgetPercentage / 100, sa = actual(s.id, 'subcategoryId'), su = st > 0 ? sa / st : null; return (
                <div key={s.id}><div className="flex items-center justify-between text-sm"><span>{s.name}</span>{pctInput(s.id, s.budgetPercentage)}</div>
                  <Bar value={su} color={su != null && su > 1 && !invest ? '#fb7185' : p.color} />
                  <div className="mt-0.5 flex justify-between text-[11px] text-mute"><span>{fmt(sa)} / {fmt(st)}</span><span>{su == null ? (sa > 0 ? 'fără buget alocat' : '') : `${(su * 100).toFixed(0)}%`}</span></div></div>); })}
            </div>
          </Card>
        );
      })}
      <ChartBox title="Țintă vs. real (RON)"><BarChart data={chart}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} />
        <Tooltip {...tip} formatter={ronTip} /><Legend wrapperStyle={{ fontSize: 12 }} /><RBar dataKey="Ideal" fill="#64748b" radius={[6, 6, 0, 0]} /><RBar dataKey="Real" fill="#818cf8" radius={[6, 6, 0, 0]} /></BarChart></ChartBox>
    </>
  );
}
