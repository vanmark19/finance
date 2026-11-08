import Dexie, { type Table } from 'dexie';
import type { Currency } from './money.ts';

export type Group = 'needs' | 'wants' | 'savings' | 'other';
export interface Category {
  id: string; name: string; type: 'income' | 'expense'; group: Group; color: string; icon: string;
  parentId: string | null; budgetPercentage: number; isActive: boolean; sort: number;
}
export interface Tx {
  id: string; type: 'income' | 'expense'; amount: number; currency: Currency; exchangeRate: number;
  amountInRON: number; date: string; parentCategoryId: string; subcategoryId: string;
  description: string; createdAt: number; updatedAt: number;
}
export interface Snapshot {
  id: string; date: string; valueRON: number; valueEUR: number; notes: string; createdAt: number;
}
export interface RateRow {
  id: string; date: string; rateDate: string; baseCurrency: 'EUR'; targetCurrency: 'RON'; rate: number; source: string;
}
export interface Settings {
  id: 'main'; baseCurrency: 'RON'; budgetingEnabled: boolean; theme: 'dark' | 'light' | 'system';
  initialSetupDate: string | null; initialPortfolioValueRON: number; initialPortfolioValueEUR: number;
  etfSubcategoryId: string | null; lastCategoryId: string | null;
  lastBackupAt: number | null; databaseVersion: number;
}

import { DB_VERSION } from './version.ts';
export { DB_VERSION };
export { APP_VERSION } from './version.ts';

class FinDB extends Dexie {
  transactions!: Table<Tx, string>;
  categories!: Table<Category, string>;
  snapshots!: Table<Snapshot, string>;
  rates!: Table<RateRow, string>;
  settings!: Table<Settings, string>;
  constructor() {
    super('fintrack');
    // Future schema changes: add this.version(2).stores({...}).upgrade(tx => ...) — never edit version 1.
    this.version(1).stores({
      transactions: 'id,date,type,subcategoryId,parentCategoryId',
      categories: 'id,parentId',
      snapshots: 'id,date',
      rates: 'id,date',
      settings: 'id',
    });
  }
}
export const db = new FinDB();
export const TABLES = ['transactions', 'categories', 'snapshots', 'rates', 'settings'] as const;

