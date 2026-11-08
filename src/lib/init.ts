import { db } from './db.ts';
import { defaultSettings } from './defaults.ts';
import { seedCategories } from './seed.ts';

export async function initDb() {
  if ((await db.categories.count()) === 0) await db.categories.bulkAdd(seedCategories());
  if (!(await db.settings.get('main'))) await db.settings.add(defaultSettings());
}
