import { createContext, useContext } from 'react';
import type { Category, Settings, Snapshot, Tx } from './lib/db';
import type { CatMap, PeriodKey, Range } from './lib/stats';

export type Tab = 'home' | 'tx' | 'budget' | 'invest' | 'stats' | 'settings';
export interface Data { txs: Tx[]; cats: Category[]; snaps: Snapshot[]; settings: Settings }
export interface Ctx {
  data: Data; catMap: CatMap; period: PeriodKey; setPeriod: (p: PeriodKey) => void;
  custom: Range; setCustom: (r: Range) => void; range: Range; openTx: (t: Tx | null) => void; go: (t: Tab) => void;
}
export const C = createContext<Ctx>(null as unknown as Ctx);
export const useC = () => useContext(C);
