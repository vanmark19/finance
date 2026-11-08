import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db, type Tx } from '../lib/db';
import { eurToRon, fromMinor, toMinor, type Currency } from '../lib/money';
import { getRate, type RateResult } from '../lib/fx';
import { fmtDate, today } from '../lib/format';
import { useC } from '../ctx';
import { Field, Sheet } from './ui';

export function TxForm({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const { data } = useC();
  const { cats, settings } = data;
  const [type, setType] = useState<'income' | 'expense'>(tx?.type ?? 'expense');
  const [amount, setAmount] = useState(tx ? fromMinor(tx.amount) : '');
  const [cur, setCur] = useState<Currency>(tx?.currency ?? 'RON');
  const [date, setDate] = useState(tx?.date ?? today());
  const [desc, setDesc] = useState(tx?.description ?? '');
  const parents = useMemo(() => cats.filter(c => !c.parentId && c.type === type).sort((a, b) => a.sort - b.sort), [cats, type]);
  const subsOf = (p: string) => cats.filter(c => c.parentId === p && (c.isActive || c.id === tx?.subcategoryId)).sort((a, b) => a.sort - b.sort);
  const allSubs = useMemo(() => cats.filter(c => c.parentId && c.type === type && (c.isActive || c.id === tx?.subcategoryId)), [cats, type, tx]);
  const [sub, setSub] = useState(tx?.subcategoryId ?? '');
  const [rate, setRate] = useState<RateResult | null>(null);
  const [rs, setRs] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [manual, setManual] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (allSubs.some(s => s.id === sub)) return;
    const last = allSubs.find(s => s.id === settings.lastCategoryId);
    setSub((last ?? allSubs[0])?.id ?? '');
  }, [allSubs, sub, settings.lastCategoryId]);

  useEffect(() => {
    if (cur === 'RON') { setRate(null); setRs('idle'); return; }
    if (tx && tx.currency === cur && tx.date === date) { setRate({ rate: tx.exchangeRate, rateDate: tx.date, stale: false, source: 'cache' }); setRs('idle'); return; }
    let off = false; setRs('loading'); setRate(null);
    getRate(date).then(r => { if (!off) { setRate(r); setRs(r ? 'idle' : 'missing'); } });
    return () => { off = true; };
  }, [cur, date, tx]);

  const isEtf = type === 'expense' && sub === settings.etfSubcategoryId;

  async function save() {
    setErr('');
    let minor: number;
    try { minor = toMinor(amount); } catch { return setErr('Sumă invalidă (maximum 2 zecimale).'); }
    if (minor <= 0) return setErr('Suma trebuie să fie pozitivă.');
    const subC = cats.find(c => c.id === sub);
    if (!subC?.parentId) return setErr('Alege o categorie.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('Alege o dată validă.');
    let r = 1;
    if (cur === 'EUR') {
      const m = parseFloat(manual.replace(',', '.'));
      r = m > 0 ? m : rate?.rate ?? 0;
      if (!(r > 0)) return setErr('Cursul EUR/RON nu este disponibil — introdu-l manual.');
    }
    const now = Date.now();
    await db.transactions.put({ id: tx?.id ?? crypto.randomUUID(), type, amount: minor, currency: cur, exchangeRate: r,
      amountInRON: cur === 'RON' ? minor : eurToRon(minor, r), date, parentCategoryId: subC.parentId, subcategoryId: sub,
      description: desc.trim(), createdAt: tx?.createdAt ?? now, updatedAt: now });
    await db.settings.update('main', { lastCategoryId: sub });
    onClose();
  }
  async function del() {
    if (tx && confirm('Ștergi definitiv această tranzacție?')) { await db.transactions.delete(tx.id); onClose(); }
  }
  const seg = (on: boolean, c = 'bg-inv') => `flex-1 rounded-xl py-3 font-semibold transition ${on ? c + ' text-white' : 'border border-line text-mute'}`;

  return (
    <Sheet title={tx ? 'Editează tranzacția' : 'Tranzacție nouă'} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <button className={seg(type === 'expense', 'bg-exp')} onClick={() => setType('expense')}>Cheltuială</button>
          <button className={seg(type === 'income', 'bg-inc')} onClick={() => setType('income')}>Venit</button>
        </div>
        <div className="flex gap-2">
          <input autoFocus={!tx} className="inp !text-2xl !font-bold flex-[2]" inputMode="decimal" placeholder="0.00" aria-label="Sumă" value={amount} onChange={e => setAmount(e.target.value)} />
          <div className="flex flex-1 gap-1">
            {(['RON', 'EUR'] as Currency[]).map(c => <button key={c} className={seg(cur === c)} onClick={() => setCur(c)}>{c}</button>)}
          </div>
        </div>
        {cur === 'EUR' && (
          <div className="rounded-xl bg-app p-3 text-xs text-mute">
            {rs === 'loading' && 'Se obține cursul EUR/RON…'}
            {rate && <>Curs: <b className="text-ink">1 EUR = {rate.rate.toFixed(4)} RON</b> ({fmtDate(rate.rateDate)}){rate.stale && <span className="text-sav"> — curs salvat, posibil depășit (offline)</span>}</>}
            {rs === 'missing' && <span className="text-sav">Cursul pentru această dată nu este disponibil (offline?). Introdu cursul manual.</span>}
            {(rs === 'missing' || rate?.stale) && <input className="inp mt-2" inputMode="decimal" placeholder="Curs manual RON/EUR, ex. 4.97" value={manual} onChange={e => setManual(e.target.value)} />}
          </div>
        )}
        <Field label="Categorie">
          <select className="inp" value={sub} onChange={e => setSub(e.target.value)}>
            {parents.map(p => <optgroup key={p.id} label={p.name}>{subsOf(p.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
          </select>
        </Field>
        {isEtf && <p className="rounded-xl bg-inv/15 p-3 text-xs text-inv">Această cheltuială va fi înregistrată automat și ca contribuție la portofoliul de investiții (o singură dată).</p>}
        <Field label="Data"><input type="date" className="inp" value={date} onChange={e => e.target.value && setDate(e.target.value)} /></Field>
        <Field label="Descriere (opțional)"><input className="inp" value={desc} onChange={e => setDesc(e.target.value)} maxLength={120} /></Field>
        {err && <p className="text-sm text-exp" role="alert">{err}</p>}
        <div className="flex gap-2">
          {tx && <button className="btn-d" onClick={del} aria-label="Șterge"><Trash2 size={20} /></button>}
          <button className="btn-p flex-1" onClick={save}>Salvează</button>
        </div>
      </div>
    </Sheet>
  );
}
