import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus } from 'lucide-react';
import { useC } from '../ctx';
import { axis, Card, ChartBox, curTip, Empty, Field, H, Kpi, Note, Sheet, tip } from '../components/ui';
import { db, type Snapshot } from '../lib/db';
import { computeInvest, contributions } from '../lib/invest';
import { fromMinor, toMinor, type Currency } from '../lib/money';
import { axisK, fmt, fmtDate, maj, pct, today } from '../lib/format';

function SnapshotForm({ snap, onClose }: { snap: Snapshot | null; onClose: () => void }) {
  const { data } = useC();
  const t0 = data.settings.initialSetupDate as string;
  const prev = snap ?? [...data.snaps].filter(s => s.date >= t0).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const [date, setDate] = useState(snap?.date ?? today());
  const [ron, setRon] = useState(prev ? fromMinor(prev.valueRON) : '');
  const [eur, setEur] = useState(prev ? fromMinor(prev.valueEUR) : '');
  const [notes, setNotes] = useState(snap?.notes ?? '');
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    let r: number, e: number;
    try { r = ron.trim() ? toMinor(ron) : 0; e = eur.trim() ? toMinor(eur) : 0; } catch { return setErr('Sumă invalidă (maximum 2 zecimale).'); }
    if (r < 0 || e < 0) return setErr('Valorile nu pot fi negative.');
    if (date < t0) return setErr(`Data trebuie să fie ${fmtDate(t0)} sau ulterioară (data configurării inițiale).`);
    await db.snapshots.put({ id: snap?.id ?? crypto.randomUUID(), date, valueRON: r, valueEUR: e, notes: notes.trim(), createdAt: snap?.createdAt ?? Date.now() });
    onClose();
  }
  return (
    <Sheet title={snap ? 'Editează evaluarea' : 'Evaluare nouă a portofoliilor'} onClose={onClose}>
      <div className="space-y-4">
        <Note>Introdu valoarea de piață ACTUALĂ a fiecărui portofoliu (totalul, nu doar noile contribuții). Portofoliile RON și EUR sunt independente; contribuțiile din tranzacții nu se adaugă automat la evaluare. {!snap && prev ? 'Câmpurile sunt completate cu ultima evaluare — actualizează ambele valori.' : ''}</Note>
        <Field label="Portofoliu RON — valoare curentă"><input autoFocus className="inp" inputMode="decimal" placeholder="0.00" value={ron} onChange={e => setRon(e.target.value)} /></Field>
        <Field label="Portofoliu EUR — valoare curentă"><input className="inp" inputMode="decimal" placeholder="0.00" value={eur} onChange={e => setEur(e.target.value)} /></Field>
        <Field label="Data evaluării"><input type="date" className="inp" value={date} max={today()} onChange={e => e.target.value && setDate(e.target.value)} /></Field>
        <Field label="Note (opțional)"><input className="inp" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        {err && <p className="text-sm text-exp" role="alert">{err}</p>}
        <div className="flex gap-2">
          {snap && <button className="btn-d" onClick={async () => { if (confirm('Ștergi această evaluare? Istoricul de performanță se recalculează.')) { await db.snapshots.delete(snap.id); onClose(); } }}>Șterge</button>}
          <button className="btn-p flex-1" onClick={save}>Salvează</button>
        </div>
      </div>
    </Sheet>
  );
}

export default function Investments() {
  const { data, go } = useC();
  const { settings, snaps, txs } = data;
  const [form, setForm] = useState<{ s: Snapshot | null } | null>(null);
  const [cur, setCur] = useState<Currency>('RON');
  const cons = useMemo(() => contributions(txs, settings), [txs, settings]);
  const r = useMemo(() => computeInvest(settings, snaps, cons), [settings, snaps, cons]);
  if (!r) return <Card><Empty>Configurarea inițială nu este completă.</Empty><button className="btn-p w-full" onClick={() => go('settings')}>Deschide setările</button></Card>;

  const s = cur === 'RON' ? r.ron : r.eur;
  const f = (m: number) => fmt(m, cur);
  const hasVal = s.value != null;
  const col = (n: number | null) => (n == null ? '' : n >= 0 ? 'text-inc' : 'text-exp');
  const est = (e: { ret: number | null }) => (e.ret != null ? pct(e.ret) : '—');
  const pts = s.points.map(p => ({ d: p.date.slice(2), value: maj(p.value), invested: maj(p.invested) }));
  const per = s.periods.map(p => ({ d: p.to.slice(2), ret: p.ret == null ? null : +(p.ret * 100).toFixed(2) }));
  const myCons = cons.filter(c => c.currency === cur);
  const contribSeries = (() => { let c = s.initial; return [{ d: (settings.initialSetupDate as string).slice(2), v: maj(c) }, ...myCons.map(x => { c += x.amount; return { d: x.date.slice(2), v: maj(c) }; })]; })();
  const seg = (on: boolean) => `flex-1 rounded-xl py-3 font-semibold transition ${on ? 'bg-inv text-white' : 'border border-line text-mute'}`;

  return (
    <>
      <button className="btn-p flex w-full items-center justify-center gap-2" onClick={() => setForm({ s: null })}><Plus size={20} />Evaluare nouă a portofoliilor</button>
      <div className="flex gap-2"><button className={seg(cur === 'RON')} onClick={() => setCur('RON')}>Portofoliu RON</button><button className={seg(cur === 'EUR')} onClick={() => setCur('EUR')}>Portofoliu EUR</button></div>
      {!s.active ? <Card><Empty>Portofoliul {cur} nu are încă sold, contribuții sau evaluări.</Empty></Card> : <>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Total investit" value={f(s.investedAll)} color="text-inv" sub={`inițial ${f(s.initial)} + contribuții ${f(s.contribTotal)}`} />
          <Kpi label="Valoare portofoliu" value={hasVal ? f(s.value as number) : '—'} sub={s.latestDate ? `la ${fmtDate(s.latestDate)}` : 'nicio evaluare încă'} />
          <Kpi label="Profit / pierdere netă" value={hasVal ? f(s.profit as number) : '—'} color={col(s.profit)} sub="exclude contribuțiile" />
          <Kpi label="Randament total" value={pct(s.allTime)} color={col(s.allTime)} sub="profit / capital investit" />
          <Kpi label="Randament lunar (estimat)" value={s.monthly ? pct(s.monthly.ret) : '—'} color={col(s.monthly?.ret ?? null)} sub={s.monthly ? `${fmtDate(s.monthly.from)} → ${fmtDate(s.monthly.to)}` : 'necesită 2 puncte'} />
          <Kpi label="Randament anual (estimat)" value={est(s.annual)} color={col(s.annual.ret)} sub={s.annual.reason ?? 'ultimele 12 luni'} />
          <Kpi label="Randament anualizat (XIRR)" value={est(s.annualized)} color={col(s.annualized.ret)} sub={s.annualized.reason ?? 'bazat pe fluxuri datate'} />
          <Kpi label="Randament înlănțuit" value={pct(s.chained)} color={col(s.chained)} sub="produsul randamentelor pe perioade" />
        </div>
        {s.pending !== 0 && hasVal && <Card><Note>Contribuții după ultima evaluare: <b>{f(s.pending)}</b>. Nu sunt incluse în profit până nu adaugi o evaluare nouă.</Note></Card>}
        <ChartBox title={`Evoluția portofoliului ${cur}`} sub={`valoare vs. capital investit (${cur})`}>
          <AreaChart data={pts}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} domain={['auto', 'auto']} />
            <Tooltip {...tip} formatter={curTip(cur)} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="value" name="Valoare" stroke="#818cf8" fill="#818cf8" fillOpacity={0.25} strokeWidth={2} /><Area type="stepAfter" dataKey="invested" name="Investit" stroke="#fbbf24" fill="none" strokeWidth={2} /></AreaChart>
        </ChartBox>
        <ChartBox title="Contribuții cumulate în timp" sub={`capital investit, ${cur}`}><AreaChart data={contribSeries}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={axisK} width={40} domain={['auto', 'auto']} />
          <Tooltip {...tip} formatter={curTip(cur)} /><Area type="stepAfter" dataKey="v" name="Investit" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.2} strokeWidth={2} /></AreaChart></ChartBox>
        {per.length > 0 && <ChartBox title="Randament pe perioade (estimat)" sub="Modified Dietz între evaluări, %"><BarChart data={per}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" {...axis} /><YAxis {...axis} width={36} unit="%" />
          <Tooltip {...tip} formatter={(v: unknown) => `${v}%`} /><Bar dataKey="ret" name="Randament" radius={[6, 6, 0, 0]}>{per.map((p, i) => <Cell key={i} fill={(p.ret ?? 0) >= 0 ? '#34d399' : '#fb7185'} />)}</Bar></BarChart></ChartBox>}
      </>}

      <H>Evaluări (istoric)</H>
      <Card className="!py-1">
        {snaps.length === 0 ? <Empty>Nicio evaluare. Adaugă prima evaluare lunară.</Empty> :
          <div className="divide-y divide-line">{[...snaps].sort((a, b) => b.date.localeCompare(a.date)).map(x => (
            <button key={x.id} className="flex w-full items-center justify-between py-3 text-left" onClick={() => setForm({ s: x })}>
              <span className="font-medium">{fmtDate(x.date)}</span><span className="text-right text-sm"><b>{fmt(x.valueRON)}</b><br /><b>{fmt(x.valueEUR, 'EUR')}</b></span></button>))}</div>}
      </Card>
      <H>Contribuții {cur} (din tranzacții)</H>
      <Card className="!py-1">
        {myCons.length === 0 ? <Empty>Nicio contribuție în {cur} după configurarea inițială.</Empty> :
          <div className="divide-y divide-line">{[...myCons].reverse().map(c => <div key={c.id} className="flex justify-between py-3 text-sm"><span>{fmtDate(c.date)}</span><b>{f(c.amount)}</b></div>)}</div>}
      </Card>
      <Card><Note><b>Cum se calculează.</b> Portofoliile RON și EUR sunt urmărite separat, fiecare în moneda lui, fără curs de schimb și fără total combinat. Profitul = valoare − contribuții cumulate (contribuțiile nu sunt profit). Randamentele pe perioade (lunar/anual) sunt <b>estimate</b> cu metoda Modified Dietz, ponderând fiecare contribuție după timpul cât a fost investită. Randamentul anualizat folosește XIRR pe fluxuri datate și nu se afișează fără date suficiente.</Note></Card>
      {form && <SnapshotForm snap={form.s} onClose={() => setForm(null)} />}
    </>
  );
}
