import { db, DB_VERSION, type Category, type RateRow, type Settings, type Snapshot, type Tx } from './db.ts';
import { fromMinor } from './money.ts';

export interface Backup {
  app: 'fintrack'; version: number; exportedAt: string;
  data: { transactions: Tx[]; categories: Category[]; snapshots: Snapshot[]; rates: RateRow[]; settings: Settings[] };
}
export async function buildBackup(): Promise<Backup> {
  const [transactions, categories, snapshots, rates, settings] = await Promise.all([
    db.transactions.toArray(), db.categories.toArray(), db.snapshots.toArray(), db.rates.toArray(), db.settings.toArray()]);
  return { app: 'fintrack', version: DB_VERSION, exportedAt: new Date().toISOString(), data: { transactions, categories, snapshots, rates, settings } };
}

type R = Record<string, unknown>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (x: unknown) => typeof x === 'string' && x.length > 0;
const int = (x: unknown) => Number.isInteger(x);
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const cur = (x: unknown) => x === 'RON' || x === 'EUR';

export function validateBackup(raw: unknown): { ok: true; backup: Backup } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!raw || typeof raw !== 'object') return fail('Fișierul nu este un backup valid (JSON invalid).');
  const b = raw as R;
  if (b.app !== 'fintrack') return fail('Fișierul nu provine din această aplicație.');
  if (!int(b.version) || (b.version as number) > DB_VERSION) return fail('Versiunea backup-ului este mai nouă decât aplicația. Actualizează aplicația.');
  const d = b.data as R | undefined;
  if (!d) return fail('Lipsesc datele din backup.');
  for (const k of ['transactions', 'categories', 'snapshots', 'rates', 'settings']) if (!Array.isArray(d[k])) return fail(`Secțiune lipsă sau invalidă: ${k}.`);
  const check = (name: string, arr: R[], ok: (x: R) => boolean) => {
    const ids = new Set<string>();
    for (let i = 0; i < arr.length; i++) {
      const x = arr[i];
      if (!x || typeof x !== 'object' || !str(x.id) || !ok(x)) return `${name}: înregistrarea #${i + 1} este invalidă.`;
      if (ids.has(x.id as string)) return `${name}: ID duplicat (${String(x.id)}).`;
      ids.add(x.id as string);
    }
    return null;
  };
  const errs = [
    check('Tranzacții', d.transactions as R[], x => (x.type === 'income' || x.type === 'expense') && int(x.amount) && (x.amount as number) > 0 && cur(x.currency) &&
      num(x.exchangeRate) && int(x.amountInRON) && DATE.test(String(x.date)) && str(x.parentCategoryId) && str(x.subcategoryId)),
    check('Categorii', d.categories as R[], x => str(x.name) && (x.type === 'income' || x.type === 'expense') && num(x.budgetPercentage) && typeof x.isActive === 'boolean'),
    check('Evaluări', d.snapshots as R[], x => DATE.test(String(x.date)) && int(x.valueRON) && int(x.valueEUR)),
    check('Cursuri', d.rates as R[], x => DATE.test(String(x.date)) && num(x.rate) && (x.rate as number) > 0),
    check('Setări', d.settings as R[], x => typeof x.budgetingEnabled === 'boolean' && int(x.initialPortfolioValueRON) && int(x.initialPortfolioValueEUR)),
  ].find(Boolean);
  if (errs) return fail(errs);
  return { ok: true, backup: b as unknown as Backup };
}

export async function applyBackup(b: Backup, mode: 'replace' | 'merge') {
  const T = [db.transactions, db.categories, db.snapshots, db.rates, db.settings];
  await db.transaction('rw', T, async () => {
    const cats = mode === 'replace' ? b.data.categories : [...(await db.categories.toArray()).filter(c => !b.data.categories.some(x => x.id === c.id)), ...b.data.categories];
    const ids = new Set(cats.map(c => c.id));
    for (const t of b.data.transactions) if (!ids.has(t.subcategoryId) || !ids.has(t.parentCategoryId)) throw new Error('Backup inconsistent: tranzacții cu categorii inexistente.');
    if (mode === 'replace') { if (!b.data.categories.length) throw new Error('Backup fără categorii.'); await Promise.all(T.map(t => t.clear())); }
    await db.categories.bulkPut(b.data.categories);
    await db.transactions.bulkPut(b.data.transactions);
    await db.snapshots.bulkPut(b.data.snapshots);
    await db.rates.bulkPut(b.data.rates);
    const s = b.data.settings[0];
    const cur0 = await db.settings.get('main');
    if (s && (mode === 'replace' || !cur0 || !cur0.initialSetupDate)) await db.settings.put({ ...s, id: 'main' });
  });
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function exportJson() {
  const b = await buildBackup();
  download(`fintrack-backup-${b.exportedAt.slice(0, 10)}.json`, JSON.stringify(b, null, 1), 'application/json');
  await db.settings.update('main', { lastBackupAt: Date.now() });
}
export async function exportCsv() {
  const [txs, cats] = await Promise.all([db.transactions.toArray(), db.categories.toArray()]);
  const m = new Map(cats.map(c => [c.id, c.name]));
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = txs.sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.type, fromMinor(t.amount), t.currency, fromMinor(t.amountInRON),
    q(m.get(t.parentCategoryId) ?? ''), q(m.get(t.subcategoryId) ?? ''), q(t.description)].join(','));
  download(`fintrack-tranzactii-${new Date().toISOString().slice(0, 10)}.csv`,
    '\uFEFF' + ['Date,Type,Amount,Currency,Amount RON,Parent category,Subcategory,Description', ...rows].join('\r\n'), 'text/csv;charset=utf-8');
}
