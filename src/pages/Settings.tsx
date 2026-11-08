import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Download, FileSpreadsheet, Plus, Upload } from 'lucide-react';
import { useC } from '../ctx';
import { Card, Field, H, Note, Sheet } from '../components/ui';
import { CatIcon, ICONS } from '../components/icons';
import { SetupForm } from '../components/SetupForm';
import { db, TABLES, type Category, type Group } from '../lib/db';
import { APP_VERSION, DB_VERSION } from '../lib/version';
import { initDb } from '../lib/init';
import { getRate } from '../lib/fx';
import { applyBackup, exportCsv, exportJson, validateBackup, type Backup } from '../lib/backup';
import { fmt, fmtDate } from '../lib/format';

type Edit = { cat: Category | null; parentOf?: string; kind?: 'parent' };

function CatForm({ e, onClose }: { e: Edit; onClose: () => void }) {
  const { data } = useC();
  const { cats, settings } = data;
  const cat = e.cat;
  const isParent = cat ? !cat.parentId : e.kind === 'parent';
  const [name, setName] = useState(cat?.name ?? '');
  const [color, setColor] = useState(cat?.color ?? cats.find(c => c.id === e.parentOf)?.color ?? '#818cf8');
  const [icon, setIcon] = useState(cat?.icon ?? 'Tag');
  const [parentId, setParentId] = useState(cat?.parentId ?? e.parentOf ?? '');
  const [type, setType] = useState<'income' | 'expense'>(cat?.type ?? 'expense');
  const [group, setGroup] = useState<Group>(cat?.group ?? 'other');
  const [active, setActive] = useState(cat?.isActive ?? true);
  const [err, setErr] = useState('');
  const [del, setDel] = useState(false);
  const [used, setUsed] = useState(0);
  const [target, setTarget] = useState('');
  const subType = cat?.type ?? cats.find(c => c.id === e.parentOf)?.type ?? 'expense';
  const parentOptions = cats.filter(c => !c.parentId && c.type === subType);
  const siblings = cats.filter(c => c.parentId && c.type === subType && c.id !== cat?.id);
  const hasSubs = !!cat && cats.some(c => c.parentId === cat.id);
  useEffect(() => { if (cat && !isParent) db.transactions.where('subcategoryId').equals(cat.id).count().then(setUsed); }, [cat, isParent]);

  async function save() {
    if (!name.trim()) return setErr('Numele este obligatoriu.');
    if (!isParent && !parentId) return setErr('Alege categoria principală.');
    const parent = cats.find(c => c.id === parentId);
    const row: Category = { id: cat?.id ?? crypto.randomUUID(), name: name.trim(), type: parent ? parent.type : type, group: parent ? parent.group : group, color, icon,
      parentId: isParent ? null : parentId, budgetPercentage: cat?.budgetPercentage ?? 0, isActive: active, sort: cat?.sort ?? Date.now() };
    await db.transaction('rw', db.categories, db.transactions, async () => {
      await db.categories.put(row);
      if (cat && !isParent && cat.parentId !== parentId) await db.transactions.where('subcategoryId').equals(cat.id).modify({ parentCategoryId: parentId });
      if (cat && isParent && cat.group !== group) await db.categories.where('parentId').equals(cat.id).modify({ group });
    });
    onClose();
  }
  async function remove() {
    if (!cat) return;
    if (isParent) { if (hasSubs) return setErr('Șterge sau mută mai întâi subcategoriile.'); await db.categories.delete(cat.id); return onClose(); }
    if (cat.id === settings.etfSubcategoryId) return setErr('Aceasta este subcategoria de investiții ETF. Alege alta în Setări → Investiții înainte să o ștergi.');
    if (used > 0) {
      const tg = cats.find(c => c.id === target);
      if (!tg?.parentId) return setErr('Alege subcategoria în care se mută tranzacțiile existente.');
      await db.transaction('rw', db.categories, db.transactions, async () => {
        await db.transactions.where('subcategoryId').equals(cat.id).modify({ subcategoryId: tg.id, parentCategoryId: tg.parentId! });
        await db.categories.delete(cat.id);
      });
    } else await db.categories.delete(cat.id);
    onClose();
  }
  return (
    <Sheet title={cat ? 'Editează categoria' : isParent ? 'Categorie principală nouă' : 'Subcategorie nouă'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nume"><input className="inp" value={name} onChange={ev => setName(ev.target.value)} /></Field>
        {isParent && !cat && <div className="grid grid-cols-2 gap-2">
          <Field label="Tip"><select className="inp" value={type} onChange={ev => setType(ev.target.value as 'income' | 'expense')}><option value="expense">Cheltuială</option><option value="income">Venit</option></select></Field>
          <Field label="Grup"><select className="inp" value={group} onChange={ev => setGroup(ev.target.value as Group)}><option value="needs">Needs</option><option value="wants">Wants</option><option value="savings">Savings & Investments</option><option value="other">Altele</option></select></Field></div>}
        {isParent && cat && cat.type === 'expense' && <Field label="Grup (influențează bugetul și clasificarea investițiilor)"><select className="inp" value={group} onChange={ev => setGroup(ev.target.value as Group)}><option value="needs">Needs</option><option value="wants">Wants</option><option value="savings">Savings & Investments</option><option value="other">Altele</option></select></Field>}
        {!isParent && <Field label="Categorie principală"><select className="inp" value={parentId} onChange={ev => setParentId(ev.target.value)}>{parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Culoare"><input type="color" className="inp !p-1 h-12" value={color} onChange={ev => setColor(ev.target.value)} /></Field>
          <Field label="Iconiță"><select className="inp" value={icon} onChange={ev => setIcon(ev.target.value)}>{Object.keys(ICONS).map(k => <option key={k}>{k}</option>)}</select></Field>
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={active} onChange={ev => setActive(ev.target.checked)} />Activă (cele inactive nu apar la tranzacții noi)</label>
        {err && <p className="text-sm text-exp" role="alert">{err}</p>}
        {del && cat && !isParent && used > 0 && <Field label={`${used} tranzacții folosesc această categorie. Mută-le în:`}><select className="inp" value={target} onChange={ev => setTarget(ev.target.value)}><option value="">— alege —</option>{siblings.map(s => <option key={s.id} value={s.id}>{cats.find(p => p.id === s.parentId)?.name} → {s.name}</option>)}</select></Field>}
        <div className="flex gap-2">
          {cat && !del && <button className="btn-d" onClick={() => { setDel(true); setErr(''); }}>Șterge</button>}
          {del ? <button className="btn-d flex-1" onClick={remove}>Confirmă ștergerea</button> : <button className="btn-p flex-1" onClick={save}>Salvează</button>}
        </div>
      </div>
    </Sheet>
  );
}

export default function SettingsPage() {
  const { data } = useC();
  const { settings, cats, txs, snaps } = data;
  const [sheet, setSheet] = useState<'setup' | Edit | null>(null);
  const lastRate = useLiveQuery(() => db.rates.orderBy('date').reverse().first(), []);
  const [rateMsg, setRateMsg] = useState('');
  const [imp, setImp] = useState<Backup | null>(null);
  const [impErr, setImpErr] = useState('');
  const [resetText, setResetText] = useState('');
  const [msg, setMsg] = useState('');
  const parents = cats.filter(c => !c.parentId).sort((a, b) => a.sort - b.sort);
  const etfSubs = cats.filter(c => c.parentId && c.type === 'expense');
  const catRow = (c: Category, indent = false) => (
    <button key={c.id} onClick={() => setSheet({ cat: c })} className={`flex w-full items-center gap-3 py-2.5 text-left ${indent ? 'pl-8' : ''} ${c.isActive ? '' : 'opacity-50'}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: c.color + '30', color: c.color }}><CatIcon name={c.icon} size={16} /></span>
      <span className="flex-1 text-sm font-medium">{c.name}</span><ChevronRight size={16} className="text-mute" /></button>);

  async function pickFile(f: File | undefined) {
    setImpErr(''); if (!f) return;
    try { const v = validateBackup(JSON.parse(await f.text())); if (v.ok) setImp(v.backup); else setImpErr(v.error); } catch { setImpErr('Fișierul nu este un JSON valid.'); }
  }
  async function doImport(mode: 'replace' | 'merge') {
    if (!imp) return;
    try { await applyBackup(imp, mode); setImp(null); setMsg('Import finalizat.'); } catch (e) { setImpErr(String(e instanceof Error ? e.message : e)); setImp(null); }
  }
  async function refreshRate() {
    setRateMsg('Se actualizează…');
    const r = await getRate(new Date().toISOString().slice(0, 10), true);
    setRateMsg(!r ? 'Indisponibil (ești offline?).' : r.stale ? 'Offline — se folosește ultimul curs salvat.' : `Actualizat: ${r.rate.toFixed(4)}`);
  }
  async function reset() {
    await db.transaction('rw', TABLES.map(t => db[t]), async () => { for (const t of TABLES) await db[t].clear(); });
    await initDb(); setResetText(''); setMsg('Aplicația a fost resetată.');
  }

  return (
    <>
      <H>Aspect</H>
      <Card><Field label="Temă"><select className="inp" value={settings.theme} onChange={e => db.settings.update('main', { theme: e.target.value as 'dark' | 'light' | 'system' })}><option value="dark">Întunecată</option><option value="light">Luminoasă</option><option value="system">Sistem</option></select></Field>
        <p className="mt-3 text-xs text-mute">Monedă de raportare: RON. Tranzacțiile pot fi în RON sau EUR.</p></Card>

      <H>Buget</H>
      <Card><label className="flex items-center justify-between"><span>Sistem de buget 50/30/20</span><input type="checkbox" className="h-6 w-6" checked={settings.budgetingEnabled} onChange={e => db.settings.update('main', { budgetingEnabled: e.target.checked })} /></label>
        <Note>Procentele se configurează în secțiunea Buget (Editează %).</Note></Card>

      <H>Investiții</H>
      <Card className="space-y-3">
        <Field label="Subcategorie considerată investiție în ETF"><select className="inp" value={settings.etfSubcategoryId ?? ''} onChange={e => db.settings.update('main', { etfSubcategoryId: e.target.value || null })}><option value="">— niciuna —</option>{etfSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Note>Cheltuielile din această subcategorie devin automat contribuții la portofoliu.</Note>
        <div className="rounded-xl bg-app p-3 text-sm">{settings.initialSetupDate ? <>Configurare inițială: <b>{fmtDate(settings.initialSetupDate)}</b><br />{fmt(settings.initialPortfolioValueRON)} + {fmt(settings.initialPortfolioValueEUR, 'EUR')}</> : 'Neconfigurat.'}</div>
        <button className="btn-g w-full" onClick={() => setSheet('setup')}>Editează configurarea inițială</button>
      </Card>

      <H>Categorii</H>
      <Card className="!py-2"><div className="divide-y divide-line">{parents.map(p => <div key={p.id}>{catRow(p)}{cats.filter(c => c.parentId === p.id).sort((a, b) => a.sort - b.sort).map(c => catRow(c, true))}
        <button className="py-2 pl-8 text-xs text-inv" onClick={() => setSheet({ cat: null, parentOf: p.id })}>+ subcategorie în {p.name}</button></div>)}</div>
        <button className="btn-g mt-2 flex w-full items-center justify-center gap-2" onClick={() => setSheet({ cat: null, kind: 'parent' })}><Plus size={18} />Categorie principală</button></Card>

      <H>Curs valutar EUR/RON</H>
      <Card className="space-y-2 text-sm">{lastRate ? <>Ultimul curs salvat: <b>{lastRate.rate.toFixed(4)}</b> (publicat {fmtDate(lastRate.rateDate)}, sursă {lastRate.source}). Poate fi depășit dacă ești offline.</> : 'Niciun curs salvat încă.'}
        <button className="btn-g w-full" onClick={refreshRate}>Actualizează cursul</button>{rateMsg && <Note>{rateMsg}</Note>}
        <Note>Fiecare tranzacție și evaluare își păstrează cursul din data ei; cursurile istorice lipsă nu sunt înlocuite automat cu cel de azi.</Note></Card>

      <H>Date și backup</H>
      <Card className="space-y-2">
        <button className="btn-p flex w-full items-center justify-center gap-2" onClick={async () => { await exportJson(); setMsg('Backup exportat.'); }}><Download size={18} />Exportă backup (JSON)</button>
        <button className="btn-g flex w-full items-center justify-center gap-2" onClick={() => exportCsv()}><FileSpreadsheet size={18} />Exportă tranzacții (CSV)</button>
        <label className="btn-g flex w-full cursor-pointer items-center justify-center gap-2"><Upload size={18} />Importă backup (JSON)<input type="file" accept="application/json,.json" className="hidden" onChange={e => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
        {impErr && <p className="text-sm text-exp" role="alert">{impErr}</p>}{msg && <p className="text-sm text-inc">{msg}</p>}
        <Note>{settings.lastBackupAt ? `Ultimul backup: ${new Date(settings.lastBackupAt).toLocaleDateString('ro-RO')}. ` : 'Nu ai exportat niciun backup. '}Datele rămân doar pe acest dispozitiv ({txs.length} tranzacții, {snaps.length} evaluări) — nu se trimit nicăieri.</Note></Card>

      <H>Despre</H>
      <Card className="text-sm text-mute">FinTrack v{APP_VERSION} · schemă bază de date v{DB_VERSION}</Card>

      <H>Zonă periculoasă</H>
      <Card className="space-y-2"><Note>Resetarea șterge definitiv toate tranzacțiile, evaluările și setările. Scrie <b>RESETEAZA</b> pentru a confirma.</Note>
        <input className="inp" value={resetText} onChange={e => setResetText(e.target.value)} placeholder="RESETEAZA" />
        <button className="btn-d w-full" disabled={resetText !== 'RESETEAZA'} onClick={reset}>Resetează aplicația</button></Card>

      {sheet === 'setup' && <Sheet title="Configurare inițială (T₀)" onClose={() => setSheet(null)}><SetupForm initial={settings} onDone={() => setSheet(null)} /></Sheet>}
      {sheet && sheet !== 'setup' && <CatForm e={sheet} onClose={() => setSheet(null)} />}
      {imp && <Sheet title="Confirmă importul" onClose={() => setImp(null)}>
        <p className="mb-3 text-sm">Backup din {new Date(imp.exportedAt).toLocaleString('ro-RO')}: {imp.data.transactions.length} tranzacții, {imp.data.categories.length} categorii, {imp.data.snapshots.length} evaluări, {imp.data.rates.length} cursuri.</p>
        <p className="mb-4 text-xs text-mute"><b>Înlocuiește</b> șterge datele actuale și le pune pe cele din fișier. <b>Îmbină</b> păstrează datele actuale și adaugă/actualizează înregistrările cu același ID.</p>
        <div className="flex gap-2"><button className="btn-d flex-1" onClick={() => doImport('replace')}>Înlocuiește tot</button><button className="btn-p flex-1" onClick={() => doImport('merge')}>Îmbină</button></div></Sheet>}
    </>
  );
}
