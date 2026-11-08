import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useC } from '../ctx';
import { axis, ChartBox, curTip, Empty, Kpi, PeriodBar, ronTip, TxRow, tip, Card, Note } from '../components/ui';
import type { Currency } from '../lib/money';
import { axisK, fmt, maj, monthLabel, pct } from '../lib/format';
import { groupBy, inRange, monthly, monthsIn, totals } from '../lib/stats';
import { computeInvest, contributions } from '../lib/invest';

export default function Dashboard() {
  const { data, range, catMap, go } = useC();
  const { txs, cats, settings, snaps } = data;
  const inR = useMemo(() => inRange(txs, range), [txs, range]);
  const t = useMemo(() => totals(inR, catMap), [inR, catMap]);
  const months = useMemo(() => monthsIn(range), [range]);
  const mo = useMemo(() => monthly(inR, catMap, months).map(r => ({ ...r, label: monthLabel(r.m), income: maj(r.income), expense: maj(r.expense), net: maj(r.net), rate: r.rate == null ? null : +(r.rate * 100).toFixed(1) })), [inR, catMap, months]);
  const parents = useMemo(() => groupBy(inR, catMap, 'parent').map(s => ({ ...s, v: maj(s.value) })), [inR, catMap]);
  const subs = useMemo(() => groupBy(inR, catMap, 'sub').slice(0, 8).map(s => ({ ...s, v: maj(s.value) })), [inR, catMap]);
  const inv = useMemo(() => computeInvest(settings, snaps, contributions(txs, settings)), [settings, snaps, txs]);
  const [pc, setPc] = useState<Currency>('RON');
  const sl = inv ? (pc === 'RON' ? inv.ron : inv.eur) : null;
  const pts = (sl?.points ?? []).filter(p => p.date >= range.from && p.date <= range.to).map(p => ({ d: p.date.slice(2), value: maj(p.value), invested: maj(p.invested), profit: maj(p.profit) }));
  const budget = useMemo(() => cats.filter(c => !c.parentId && c.type === 'expense' && c.isActive && c.budgetPercentage > 0).map(p => {
    const actual = inR.filter(x => x.type === 'expense' && x.parentCategoryId === p.id).reduce((a, x) => a + x.amountInRON, 0);
    return { name: p.name.split(' ')[0], ideal: t.income > 0 ? +(p.budgetPercentage).toFixed(1) : 0, actual: t.income > 0 ? +((actual / t.income) * 100).toFixed(1) : 0, color: p.color };
  }), [cats, inR, t.income]);
  const noTx = txs.length === 0;

  return (
    <>
      <PeriodBar />
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Venituri" value={fmt(t.income)} color="text-inc" />
        <Kpi label="Cheltuieli totale" value={fmt(t.expense)} color="text-exp" sub={<>Consum {fmt(t.consumption)} · <span className="text-inv">Investiții {fmt(t.investment)}</span></>} />
        <Kpi label="Investit în perioadă" value={fmt(t.investment)} color="text-inv" sub={t.income > 0 ? `${pct(t.investment / t.income, 1)} din venituri` : 'fără venituri'} />
        <Kpi label="Cash flow net" value={fmt(t.net)} color={t.net >= 0 ? 'text-inc' : 'text-exp'} sub="venituri − toate cheltuielile" />
        <Kpi label="Portofoliu RON" value={inv?.ron.value != null ? fmt(inv.ron.value) : '—'} color="text-inv" sub={inv?.ron.profit != null ? `profit ${fmt(inv.ron.profit)} (${pct(inv.ron.allTime)})` : 'adaugă o evaluare'} />
        <Kpi label="Portofoliu EUR" value={inv?.eur.value != null ? fmt(inv.eur.value, 'EUR') : '—'} color="text-inv" sub={inv?.eur.profit != null ? `profit ${fmt(inv.eur.profit, 'EUR')} (${pct(inv.eur.allTime)})` : 'adaugă o evaluare'} />
      </div>

      {noTx && <Card><Empty>Nicio tranzacție încă. Apasă <b>+</b> pentru prima.</Empty></Card>}

      <ChartBox title="Venituri vs. cheltuieli" sub="RON, pe luni">
        <BarChart data={mo}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} />
          <Tooltip {...tip} formatter={ronTip} /><Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Venituri" fill="#34d399" radius={[6, 6, 0, 0]} /><Bar dataKey="expense" name="Cheltuieli" fill="#fb7185" radius={[6, 6, 0, 0]} /></BarChart>
      </ChartBox>

      <ChartBox title="Cheltuieli pe categorii principale" h={230}>
        {parents.length ? <PieChart><Pie data={parents} dataKey="v" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">{parents.map(p => <Cell key={p.id} fill={p.color} />)}</Pie>
          <Tooltip {...tip} formatter={ronTip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart> : <div />}
      </ChartBox>
      {!parents.length && <Note>Nu există cheltuieli în perioada selectată.</Note>}

      <ChartBox title="Top subcategorii" sub="cele mai mari 8 cheltuieli" h={Math.max(150, subs.length * 34)}>
        <BarChart data={subs} layout="vertical" margin={{ left: 10 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" {...axis} width={100} />
          <Tooltip {...tip} formatter={ronTip} /><Bar dataKey="v" name="Total" radius={[0, 6, 6, 0]}>{subs.map(s => <Cell key={s.id} fill={s.color} />)}</Bar></BarChart>
      </ChartBox>

      <ChartBox title="Rata de economisire / investire" sub="% din venituri, lunar">
        <LineChart data={mo}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} width={36} unit="%" />
          <Tooltip {...tip} formatter={(v: unknown) => `${v}%`} /><Line type="monotone" dataKey="rate" name="Rată" stroke="#818cf8" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} /></LineChart>
      </ChartBox>

      <ChartBox title="Cash flow lunar" sub="venituri − cheltuieli, RON">
        <BarChart data={mo}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} />
          <Tooltip {...tip} formatter={ronTip} /><Bar dataKey="net" name="Net" radius={[6, 6, 0, 0]}>{mo.map(r => <Cell key={r.m} fill={r.net >= 0 ? '#34d399' : '#fb7185'} />)}</Bar></BarChart>
      </ChartBox>

      {settings.budgetingEnabled && (
        <ChartBox title="Alocare reală vs. ideală" sub={t.income > 0 ? '% din venituri' : 'Fără venituri în perioadă — nu se poate calcula'}>
          <BarChart data={budget}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} width={36} unit="%" />
            <Tooltip {...tip} formatter={(v: unknown) => `${v}%`} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ideal" name="Ideal" fill="#64748b" radius={[6, 6, 0, 0]} /><Bar dataKey="actual" name="Real" fill="#818cf8" radius={[6, 6, 0, 0]} /></BarChart>
        </ChartBox>
      )}

      <div className="flex gap-2">{(['RON', 'EUR'] as Currency[]).map(c => <button key={c} onClick={() => setPc(c)} className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${pc === c ? 'bg-inv text-white' : 'border border-line text-mute'}`}>Portofoliu {c}</button>)}</div>
      {pts.length > 0 && sl?.active ? <>
        <ChartBox title={`Evoluția portofoliului ${pc}`} sub={`valoare vs. capital investit (${pc})`}>
          <AreaChart data={pts}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} domain={['auto', 'auto']} />
            <Tooltip {...tip} formatter={curTip(pc)} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="value" name="Valoare" stroke="#818cf8" fill="#818cf8" fillOpacity={0.25} strokeWidth={2} />
            <Area type="stepAfter" dataKey="invested" name="Investit" stroke="#fbbf24" fill="none" strokeWidth={2} /></AreaChart>
        </ChartBox>
        <ChartBox title={`Evoluția profitului / pierderii ${pc}`} sub={`${pc}; contribuțiile nu sunt profit`}>
          <LineChart data={pts}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} />
            <Tooltip {...tip} formatter={curTip(pc)} /><Line type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} /></LineChart>
        </ChartBox>
      </> : <Card><Note>Graficele portofoliului {pc} apar după ce adaugi o evaluare în secțiunea <button className="underline" onClick={() => go('invest')}>Investiții</button> (în perioada selectată).</Note></Card>}

      <Card>
        <div className="mb-1 flex items-center justify-between"><span className="font-semibold">Tranzacții recente</span><button className="text-sm text-inv" onClick={() => go('tx')}>Toate</button></div>
        {txs.length === 0 ? <Empty>Nu există tranzacții.</Empty> :
          <div className="divide-y divide-line">{[...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 8).map(x => <TxRow key={x.id} t={x} />)}</div>}
      </Card>
    </>
  );
}
