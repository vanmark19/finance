import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftRight, BarChart3, Home, Plus, Settings as Cog, Target, TrendingUp } from 'lucide-react';
import { db, type Tx } from './lib/db';
import { C, type Data, type Tab } from './ctx';
import { catMapOf, periodRange, type PeriodKey, type Range } from './lib/stats';
import { iso } from './lib/format';
import { Sheet } from './components/ui';
import { TxForm } from './components/TxForm';
import { SetupForm } from './components/SetupForm';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budget from './pages/Budget';
import Investments from './pages/Investments';
import Statistics from './pages/Statistics';
import SettingsPage from './pages/Settings';

const TABS: [Tab, string, typeof Home][] = [['home', 'Acasă', Home], ['tx', 'Tranzacții', ArrowLeftRight], ['budget', 'Buget', Target], ['invest', 'Investiții', TrendingUp], ['stats', 'Statistici', BarChart3]];
const TITLES: Record<Tab, string> = { home: 'Acasă', tx: 'Tranzacții', budget: 'Buget 50/30/20', invest: 'Investiții', stats: 'Statistici', settings: 'Setări' };

export default function App() {
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);
  const snaps = useLiveQuery(() => db.snapshots.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('main'), []);
  const [tab, setTab] = useState<Tab>('home');
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [custom, setCustom] = useState<Range>(() => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) }; });
  const [edit, setEdit] = useState<{ tx: Tx | null } | null>(null);
  const [hideReminder, setHideReminder] = useState(false);

  const theme = settings?.theme;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1220' : '#f1f5f9');
    };
    apply(); mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const catMap = useMemo(() => catMapOf(cats ?? []), [cats]);
  const minDate = useMemo(() => (txs && txs.length ? txs.reduce((a, t) => (t.date < a ? t.date : a), txs[0].date) : null), [txs]);
  const range = useMemo(() => periodRange(period, custom, minDate), [period, custom, minDate]);

  if (!txs || !cats || !snaps || !settings) return <div className="p-10 text-center text-mute">Se încarcă…</div>;
  const data: Data = { txs, cats, snaps, settings };
  const stale = settings.lastBackupAt ? Date.now() - settings.lastBackupAt > 30 * 864e5 : txs.length >= 5;

  return (
    <C.Provider value={{ data, catMap, period, setPeriod, custom, setCustom, range, openTx: t => setEdit({ tx: t }), go: setTab }}>
      <div className="mx-auto min-h-screen max-w-3xl pb-32">
        <header className="pt-safe sticky top-0 z-30 flex items-center justify-between bg-app px-4 pb-2 backdrop-blur">
          <h1 className="text-2xl font-extrabold">{TITLES[tab]}</h1>
          <button aria-label="Setări" className={`rounded-full p-2 ${tab === 'settings' ? 'text-inv' : 'text-mute'}`} onClick={() => setTab('settings')}><Cog size={24} /></button>
        </header>
        {stale && !hideReminder && tab !== 'settings' && (
          <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl bg-sav/15 px-3 py-2 text-xs text-sav">
            <button className="text-left" onClick={() => setTab('settings')}>Nu ai exportat un backup de mult timp. Datele sunt doar pe acest dispozitiv — exportă un backup.</button>
            <button aria-label="Ascunde" onClick={() => setHideReminder(true)}>✕</button>
          </div>
        )}
        <main className="space-y-3 px-4">
          {tab === 'home' && <Dashboard />}
          {tab === 'tx' && <Transactions />}
          {tab === 'budget' && <Budget />}
          {tab === 'invest' && <Investments />}
          {tab === 'stats' && <Statistics />}
          {tab === 'settings' && <SettingsPage />}
        </main>

        <button aria-label="Adaugă tranzacție" onClick={() => setEdit({ tx: null })}
          className="fixed right-5 z-40 grid h-16 w-16 place-items-center rounded-full bg-inv text-white shadow-xl shadow-inv/40 transition active:scale-90"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}><Plus size={32} /></button>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto flex max-w-3xl">
            {TABS.map(([k, l, I]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${tab === k ? 'text-inv' : 'text-mute'}`}>
                <I size={23} />{l}
              </button>
            ))}
          </div>
        </nav>
      </div>
      {edit && <TxForm tx={edit.tx} onClose={() => setEdit(null)} />}
      {!settings.initialSetupDate && (
        <Sheet title="Configurare inițială" onClose={() => undefined}><SetupForm initial={settings} onDone={() => undefined} /></Sheet>
      )}
    </C.Provider>
  );
}
