import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useC } from '../ctx';
import { Card, Empty, TxRow } from '../components/ui';
import { fmt } from '../lib/format';

export default function Transactions() {
  const { data } = useC();
  const { txs, cats } = data;
  const [q, setQ] = useState(''); const [type, setType] = useState('all'); const [cat, setCat] = useState('all');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [sort, setSort] = useState('date-desc'); const [limit, setLimit] = useState(60);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const names = new Map(cats.map(c => [c.id, c.name.toLowerCase()]));
    const r = txs.filter(t => (type === 'all' || t.type === type) && (cat === 'all' || t.subcategoryId === cat || t.parentCategoryId === cat) &&
      (!from || t.date >= from) && (!to || t.date <= to) &&
      (!ql || t.description.toLowerCase().includes(ql) || (names.get(t.subcategoryId) ?? '').includes(ql) || (names.get(t.parentCategoryId) ?? '').includes(ql) || String(t.amount / 100).includes(ql)));
    const cmp: Record<string, (a: typeof r[0], b: typeof r[0]) => number> = {
      'date-desc': (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt, 'date-asc': (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
      'amt-desc': (a, b) => b.amountInRON - a.amountInRON, 'amt-asc': (a, b) => a.amountInRON - b.amountInRON };
    return r.sort(cmp[sort]);
  }, [txs, cats, q, type, cat, from, to, sort]);
  const sum = list.reduce((a, t) => a + (t.type === 'income' ? t.amountInRON : -t.amountInRON), 0);
  const parents = cats.filter(c => !c.parentId).sort((a, b) => a.sort - b.sort);

  return (
    <>
      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input className="inp !pl-10" placeholder="Caută (descriere, categorie, sumă)" value={q} onChange={e => { setQ(e.target.value); setLimit(60); }} /></div>
      <div className="grid grid-cols-2 gap-2">
        <select className="inp" aria-label="Tip" value={type} onChange={e => setType(e.target.value)}><option value="all">Toate tipurile</option><option value="income">Venituri</option><option value="expense">Cheltuieli</option></select>
        <select className="inp" aria-label="Sortare" value={sort} onChange={e => setSort(e.target.value)}><option value="date-desc">Data ↓</option><option value="date-asc">Data ↑</option><option value="amt-desc">Suma ↓</option><option value="amt-asc">Suma ↑</option></select>
        <select className="inp col-span-2" aria-label="Categorie" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">Toate categoriile</option>
          {parents.map(p => <optgroup key={p.id} label={p.name}><option value={p.id}>Toate din {p.name}</option>{cats.filter(c => c.parentId === p.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
        </select>
        <input type="date" className="inp" aria-label="De la" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" className="inp" aria-label="Până la" value={to} onChange={e => setTo(e.target.value)} />
      </div>
      <div className="flex justify-between px-1 text-xs text-mute"><span>{list.length} tranzacții</span><span>Net: {fmt(sum)}</span></div>
      <Card className="!py-1">
        {list.length === 0 ? <Empty>{txs.length ? 'Nicio tranzacție nu corespunde filtrelor.' : 'Nu ai tranzacții. Apasă + pentru a adăuga prima.'}</Empty> :
          <div className="divide-y divide-line">{list.slice(0, limit).map(t => <TxRow key={t.id} t={t} />)}</div>}
      </Card>
      {list.length > limit && <button className="btn-g w-full" onClick={() => setLimit(limit + 100)}>Mai multe ({list.length - limit})</button>}
    </>
  );
}
