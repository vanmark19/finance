import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useC } from '../ctx';
import { axis, Bar, Card, ChartBox, curTip, Empty, H, Kpi, Note, PeriodBar, ronTip, tip } from '../components/ui';
import { axisK, fmt, fmtDate, iso, maj, monthLabel, pct, today } from '../lib/format';
import { groupBy, inRange, isInvestment, monthly, monthsIn, totals } from '../lib/stats';
import { computeInvest, contributions } from '../lib/invest';
import type { Currency } from '../lib/money';

type G = 'income' | 'expense' | 'savings' | 'cash' | 'invest';
const GROUPS: [G, string][] = [['income', 'Venituri'], ['expense', 'Cheltuieli'], ['savings', 'Economii'], ['cash', 'Cash flow'], ['invest', 'Investiții']];
const weekStart = (s: string) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };

export default function Statistics() {
  const { data, range, catMap } = useC();
  const { txs, cats, settings, snaps } = data;
  const [g, setG] = useState<G>('income');
  const [ic, setIc] = useState<Currency>('RON');
  const inR = useMemo(() => inRange(txs, range), [txs, range]);
  const t = useMemo(() => totals(inR, catMap), [inR, catMap]);
  const months = useMemo(() => monthsIn(range), [range]);
  const raw = useMemo(() => monthly(inR, catMap, months), [inR, catMap, months]);
  const mo = raw.map(r => ({ ...r, label: monthLabel(r.m), inc: maj(r.income), exp: maj(r.expense), net: maj(r.net), rate: r.rate == null ? null : +(r.rate * 100).toFixed(1) }));
  const nM = Math.max(1, months.length);
  const cum = (k: 'inc' | 'net') => { let c = 0; return mo.map(r => ({ label: r.label, v: +(c += r[k]).toFixed(2) })); };
  const inv = useMemo(() => computeInvest(settings, snaps, contributions(txs, settings)), [settings, snaps, txs]);
  const col = (n: number | null | undefined) => (n == null ? '' : n >= 0 ? 'text-inc' : 'text-exp');
  const donut = (s: ReturnType<typeof groupBy>) => s.map(x => ({ ...x, v: maj(x.value) }));

  const body = () => {
    if (g === 'income') {
      const best = raw.reduce((a, r) => (r.income > a.income ? r : a), raw[0]);
      const src = donut(groupBy(inR, catMap, 'sub', 'income'));
      return <>
        <div className="grid grid-cols-2 gap-3"><Kpi label="Venit total" value={fmt(t.income)} color="text-inc" /><Kpi label="Medie lunară" value={fmt(Math.round(t.income / nM))} />
          <Kpi label="Cea mai bună lună" value={best && best.income > 0 ? fmt(best.income) : '—'} sub={best && best.income > 0 ? monthLabel(best.m) : undefined} /><Kpi label="Surse de venit" value={String(src.length)} /></div>
        <ChartBox title="Venit lunar"><BarChart data={mo}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} /><Tooltip {...tip} formatter={ronTip} /><RBar dataKey="inc" name="Venit" fill="#34d399" radius={[6, 6, 0, 0]} /></BarChart></ChartBox>
        <ChartBox title="Venit cumulat" sub="evoluție în perioadă"><AreaChart data={cum('inc')}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} /><Tooltip {...tip} formatter={ronTip} /><Area type="monotone" dataKey="v" name="Cumulat" stroke="#34d399" fill="#34d399" fillOpacity={0.2} strokeWidth={2} /></AreaChart></ChartBox>
        <ChartBox title="Surse de venit" h={230}>{src.length ? <PieChart><Pie data={src} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80} stroke="none" paddingAngle={2}>{src.map((s, i) => <Cell key={s.id} fill={['#34d399', '#a78bfa', '#38bdf8', '#fbbf24', '#fb7185'][i % 5]} />)}</Pie><Tooltip {...tip} formatter={ronTip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart> : <div />}</ChartBox>
      </>;
    }
    if (g === 'expense') {
      const exps = inR.filter(x => x.type === 'expense');
      const biggest = exps.reduce<typeof exps[0] | null>((a, x) => (!a || x.amountInRON > a.amountInRON ? x : a), null);
      const subs = groupBy(inR, catMap, 'sub'), parents = groupBy(inR, catMap, 'parent');
      const end = range.to < today() ? range.to : today();
      const days = Math.max(1, Math.floor((Date.parse(end + 'T00:00:00Z') - Date.parse(range.from + 'T00:00:00Z')) / 864e5) + 1);
      const wd = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(d => ({ d, v: 0 }));
      for (const x of exps) wd[(new Date(x.date + 'T00:00:00').getDay() + 6) % 7].v += maj(x.amountInRON);
      const wk = new Map<string, number>(); for (const x of exps) { const k = weekStart(x.date); wk.set(k, (wk.get(k) ?? 0) + maj(x.amountInRON)); }
      const weeks = [...wk].sort().slice(-12).map(([k, v]) => ({ d: k.slice(5), v: +v.toFixed(2) }));
      const stack = months.map((m, i) => { const row: Record<string, string | number> = { label: monthLabel(m) }; for (const x of inRange(inR, { from: m + '-01', to: m + '-31' })) if (x.type === 'expense') { const n = catMap.get(x.parentCategoryId)?.name ?? '?'; row[n] = ((row[n] as number) ?? 0) + maj(x.amountInRON); } void i; return row; });
      const last = months[months.length - 1], prev = months[months.length - 2];
      const by = (m: string) => new Map(groupBy(inRange(inR, { from: m + '-01', to: m + '-31' }), catMap, 'parent').map(s => [s.id, s.value]));
      const cur = last ? by(last) : new Map<string, number>(), pv = prev ? by(prev) : new Map<string, number>();
      const ids = [...new Set([...cur.keys(), ...pv.keys()])];
      return <>
        <div className="grid grid-cols-2 gap-3"><Kpi label="Cheltuieli totale" value={fmt(t.expense)} color="text-exp" /><Kpi label="Medie lunară" value={fmt(Math.round(t.expense / nM))} />
          <Kpi label="Cheltuială zilnică medie" value={fmt(Math.round(t.consumption / days))} sub="doar consum, fără investiții" /><Kpi label="Cea mai mare cheltuială" value={biggest ? fmt(biggest.amountInRON) : '—'} sub={biggest ? `${biggest.description || catMap.get(biggest.subcategoryId)?.name} · ${fmtDate(biggest.date)}` : undefined} /></div>
        <Kpi label="Cea mai costisitoare categorie" value={subs[0]?.name ?? '—'} sub={subs[0] ? `${fmt(subs[0].value)} · ${t.expense ? pct(subs[0].value / t.expense, 0) : ''} din cheltuieli` : undefined} />
        <ChartBox title="Cheltuieli lunare pe categorii" h={230}><BarChart data={stack}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} /><Tooltip {...tip} formatter={ronTip} /><Legend wrapperStyle={{ fontSize: 12 }} />
          {parents.map(p => <RBar key={p.id} dataKey={p.name} stackId="a" fill={p.color} />)}</BarChart></ChartBox>
        <ChartBox title="Pe categorii principale" h={230}>{parents.length ? <PieChart><Pie data={donut(parents)} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80} stroke="none" paddingAngle={2}>{parents.map(p => <Cell key={p.id} fill={p.color} />)}</Pie><Tooltip {...tip} formatter={ronTip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart> : <div />}</ChartBox>
        <ChartBox title="Pe subcategorii" sub="top 10" h={Math.max(150, Math.min(10, subs.length) * 32)}><BarChart data={donut(subs.slice(0, 10))} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" {...axis} width={100} /><Tooltip {...tip} formatter={ronTip} /><RBar dataKey="v" name="Total" radius={[0, 6, 6, 0]}>{subs.slice(0, 10).map(s => <Cell key={s.id} fill={s.color} />)}</RBar></BarChart></ChartBox>
        <ChartBox title="Pe zilele săptămânii" sub="total cheltuit"><BarChart data={wd}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} /><Tooltip {...tip} formatter={ronTip} /><RBar dataKey="v" name="Cheltuit" fill="#fb7185" radius={[6, 6, 0, 0]} /></BarChart></ChartBox>
        <ChartBox title="Pe săptămâni" sub="ultimele 12 săptămâni din perioadă (luni–duminică)"><LineChart data={weeks}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} /><Tooltip {...tip} formatter={ronTip} /><Line type="monotone" dataKey="v" name="Cheltuit" stroke="#fb7185" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ChartBox>
        <Card><div className="mb-2 font-semibold">Comparație cu luna precedentă</div>
          {!prev ? <Empty>Selectează o perioadă de cel puțin 2 luni.</Empty> : <><div className="mb-1 flex justify-between text-xs text-mute"><span>{monthLabel(prev)} → {monthLabel(last)}</span></div>
            {ids.map(id => { const a = pv.get(id) ?? 0, b = cur.get(id) ?? 0; const d = b - a; return <div key={id} className="flex items-center justify-between border-t border-line py-2 text-sm"><span>{catMap.get(id)?.name}</span><span className="text-right"><span className="text-mute">{fmt(a)} → </span><b>{fmt(b)}</b> <span className={d > 0 ? 'text-exp' : 'text-inc'}>({d > 0 ? '+' : ''}{fmt(d)})</span></span></div>; })}</>}</Card>
      </>;
    }
    if (g === 'savings') {
      const rates = raw.filter(r => r.rate != null).map(r => r.rate as number);
      const sav = cats.filter(c => !c.parentId && c.type === 'expense' && c.isActive && c.budgetPercentage > 0);
      let c = 0; const accum = mo.map((r, i) => ({ label: r.label, v: +(c += maj(raw[i].investment)).toFixed(2) }));
      return <>
        <div className="grid grid-cols-2 gap-3"><Kpi label="Rata de economisire" value={t.income > 0 ? pct(t.investment / t.income, 1) : '—'} color="text-sav" sub="economii+investiții / venituri" />
          <Kpi label="Rata lunară medie" value={rates.length ? pct(rates.reduce((a, b) => a + b, 0) / rates.length, 1) : '—'} />
          <Kpi label="Contribuții acumulate" value={fmt(t.investment)} color="text-inv" /><Kpi label="Luni cu economii" value={`${raw.filter(r => r.investment > 0).length}/${nM}`} /></div>
        <ChartBox title="Rata de economisire lunară" sub="% din venituri"><LineChart data={mo}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} width={36} unit="%" /><Tooltip {...tip} formatter={(v: unknown) => `${v}%`} /><Line type="monotone" dataKey="rate" name="Rată" stroke="#fbbf24" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ChartBox>
        <ChartBox title="Economii acumulate" sub="evoluție cumulată (RON)"><AreaChart data={accum}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} /><Tooltip {...tip} formatter={ronTip} /><Area type="monotone" dataKey="v" name="Cumulat" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.2} strokeWidth={2} /></AreaChart></ChartBox>
        <Card><div className="mb-2 font-semibold">Real vs. ideal (% din venituri)</div>
          {!settings.budgetingEnabled ? <Note>Activează bugetul în Setări.</Note> : t.income <= 0 ? <Note>Fără venituri în perioadă.</Note> : sav.map(p => { const a = inR.filter(x => x.type === 'expense' && x.parentCategoryId === p.id).reduce((s, x) => s + x.amountInRON, 0) / t.income * 100;
            return <div key={p.id} className="mb-3"><div className="flex justify-between text-sm"><span>{p.name}</span><span>{a.toFixed(1)}% / {p.budgetPercentage}%</span></div><Bar value={a / Math.max(1, p.budgetPercentage)} color={p.color} /></div>; })}</Card>
      </>;
    }
    if (g === 'cash') {
      const pos = raw.filter(r => r.net > 0).length, neg = raw.filter(r => r.net < 0).length;
      return <>
        <div className="grid grid-cols-2 gap-3"><Kpi label="Cash flow net" value={fmt(t.net)} color={col(t.net)} /><Kpi label="Net mediu / lună" value={fmt(Math.round(t.net / nM))} color={col(t.net)} />
          <Kpi label="Luni pozitive" value={String(pos)} color="text-inc" /><Kpi label="Luni negative" value={String(neg)} color="text-exp" /></div>
        <ChartBox title="Venituri vs. cheltuieli"><BarChart data={mo}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} /><Tooltip {...tip} formatter={ronTip} /><Legend wrapperStyle={{ fontSize: 12 }} /><RBar dataKey="inc" name="Venituri" fill="#34d399" radius={[6, 6, 0, 0]} /><RBar dataKey="exp" name="Cheltuieli" fill="#fb7185" radius={[6, 6, 0, 0]} /></BarChart></ChartBox>
        <ChartBox title="Net lunar"><BarChart data={mo}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={36} /><Tooltip {...tip} formatter={ronTip} /><RBar dataKey="net" name="Net" radius={[6, 6, 0, 0]}>{mo.map(r => <Cell key={r.m} fill={r.net >= 0 ? '#34d399' : '#fb7185'} />)}</RBar></BarChart></ChartBox>
        <ChartBox title="Net cumulat"><LineChart data={cum('net')}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} /><Tooltip {...tip} formatter={ronTip} /><Line type="monotone" dataKey="v" name="Cumulat" stroke="#818cf8" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ChartBox>
      </>;
    }
    const sl = inv ? (ic === 'RON' ? inv.ron : inv.eur) : null;
    const f = (m: number) => fmt(m, ic);
    const toggle = <div className="flex gap-2">{(['RON', 'EUR'] as Currency[]).map(c => <button key={c} onClick={() => setIc(c)} className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${ic === c ? 'bg-inv text-white' : 'border border-line text-mute'}`}>Portofoliu {c}</button>)}</div>;
    if (!sl || !sl.active || sl.value == null) return <>{toggle}<Card><Empty>Adaugă cel puțin o evaluare pentru portofoliul {ic} în secțiunea Investiții.</Empty></Card></>;
    const pts = sl.points.map(p => ({ d: p.date.slice(2), value: maj(p.value), invested: maj(p.invested), growth: maj(p.profit) }));
    const per = sl.periods.map(p => ({ d: p.to.slice(2), ret: p.ret == null ? null : +(p.ret * 100).toFixed(2) }));
    return <>
      {toggle}
      <div className="grid grid-cols-2 gap-3"><Kpi label="Profit / pierdere totală" value={f(sl.profit as number)} color={col(sl.profit)} /><Kpi label="Randament total" value={pct(sl.allTime)} color={col(sl.allTime)} />
        <Kpi label="Contribuții totale" value={f(sl.contribTotal)} color="text-inv" sub="după configurarea inițială" /><Kpi label="Randament anual (estimat)" value={sl.annual.ret != null ? pct(sl.annual.ret) : '—'} sub={sl.annual.reason ?? undefined} /></div>
      <ChartBox title={`Evoluția portofoliului ${ic}`}><AreaChart data={pts}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} domain={['auto', 'auto']} /><Tooltip {...tip} formatter={curTip(ic)} /><Area type="monotone" dataKey="value" name="Valoare" stroke="#818cf8" fill="#818cf8" fillOpacity={0.25} strokeWidth={2} /></AreaChart></ChartBox>
      <ChartBox title="Contribuții vs. creștere" sub={`capital investit și profit/pierdere (${ic})`}><BarChart data={pts}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} /><Tooltip {...tip} formatter={curTip(ic)} /><Legend wrapperStyle={{ fontSize: 12 }} /><RBar dataKey="invested" name="Investit" stackId="s" fill="#fbbf24" /><RBar dataKey="growth" name="Profit/pierdere" stackId="s" fill="#34d399" /></BarChart></ChartBox>
      {per.length > 0 && <ChartBox title="Randamente pe perioade (estimate)" sub="Modified Dietz, %"><BarChart data={per}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} width={36} unit="%" /><Tooltip {...tip} formatter={(v: unknown) => `${v}%`} /><RBar dataKey="ret" name="Randament" radius={[6, 6, 0, 0]}>{per.map((p, i) => <Cell key={i} fill={(p.ret ?? 0) >= 0 ? '#34d399' : '#fb7185'} />)}</RBar></BarChart></ChartBox>}
      <Note>Portofoliile RON și EUR sunt separate, fără conversie. Detalii în secțiunea Investiții.</Note>
    </>;
  };
  void isInvestment; void H;
  return (
    <>
      <PeriodBar />
      <div className="grid grid-cols-5 gap-1 rounded-2xl bg-card p-1 border border-line">
        {GROUPS.map(([k, l]) => <button key={k} onClick={() => setG(k)} className={`rounded-xl py-2 text-[11px] font-semibold transition ${g === k ? 'bg-inv text-white' : 'text-mute'}`}>{l}</button>)}
      </div>
      {txs.length === 0 && g !== 'invest' ? <Card><Empty>Nu există date. Adaugă tranzacții pentru a vedea statistici.</Empty></Card> : body()}
    </>
  );
}
