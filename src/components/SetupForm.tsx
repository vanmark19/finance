import { useState } from 'react';
import { db, type Settings } from '../lib/db';
import { fromMinor, toMinor } from '../lib/money';
import { today } from '../lib/format';
import { Field, Note } from './ui';

/** Moment Zero (T0): each portfolio owned at setup is treated as invested capital with zero profit. RON and EUR portfolios are independent. */
export function SetupForm({ initial, onDone }: { initial?: Settings; onDone: () => void }) {
  const set = initial?.initialSetupDate ? initial : undefined;
  const [ron, setRon] = useState(set ? fromMinor(set.initialPortfolioValueRON) : '');
  const [eur, setEur] = useState(set ? fromMinor(set.initialPortfolioValueEUR) : '');
  const [date, setDate] = useState(set?.initialSetupDate ?? today());
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    let r: number, e: number;
    try { r = ron.trim() ? toMinor(ron) : 0; e = eur.trim() ? toMinor(eur) : 0; } catch { return setErr('Sumă invalidă (maximum 2 zecimale).'); }
    if (r < 0 || e < 0) return setErr('Valorile nu pot fi negative.');
    await db.settings.update('main', { initialSetupDate: date, initialPortfolioValueRON: r, initialPortfolioValueEUR: e });
    onDone();
  }
  return (
    <div className="space-y-4">
      <Note>Ai două portofolii separate: unul în RON și unul în EUR, fără conversie între ele. Introdu valoarea fiecăruia acum (lasă gol dacă nu ai). Se consideră cumpărate la această dată: capital investit inițial = valoarea introdusă, profit inițial = 0.</Note>
      <Field label="Portofoliu RON — valoare"><input className="inp" inputMode="decimal" placeholder="0.00" value={ron} onChange={e => setRon(e.target.value)} /></Field>
      <Field label="Portofoliu EUR — valoare"><input className="inp" inputMode="decimal" placeholder="0.00" value={eur} onChange={e => setEur(e.target.value)} /></Field>
      <Field label="Data configurării"><input type="date" className="inp" value={date} max={today()} onChange={e => e.target.value && setDate(e.target.value)} /></Field>
      {set && <Note>Atenție: modificarea acestor valori recalculează toată performanța istorică.</Note>}
      {err && <p className="text-sm text-exp" role="alert">{err}</p>}
      <button className="btn-p w-full" onClick={save}>{set ? 'Salvează' : 'Continuă'}</button>
    </div>
  );
}
