import type { Settings } from './db.ts';
import { DB_VERSION } from './version.ts';

export const defaultSettings = (): Settings => ({
  id: 'main', baseCurrency: 'RON', budgetingEnabled: true, theme: 'dark', initialSetupDate: null,
  initialPortfolioValueRON: 0, initialPortfolioValueEUR: 0,
  etfSubcategoryId: 's-etfs', lastCategoryId: null, lastBackupAt: null, databaseVersion: DB_VERSION,
});
