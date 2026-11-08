import type { Category, Group } from './db.ts';

type Sub = [string, string, string, number];
interface P { id: string; name: string; type: 'income' | 'expense'; group: Group; color: string; icon: string; pct: number; subs: Sub[] }
const P: P[] = [
  { id: 'needs', name: 'Needs', type: 'expense', group: 'needs', color: '#38bdf8', icon: 'Home', pct: 50, subs: [
    ['food', 'Food & Drinks', 'Utensils', 20], ['transport', 'Transport', 'Bus', 10], ['education', 'Education', 'GraduationCap', 10],
    ['health', 'Health', 'HeartPulse', 5], ['housing', 'Housing', 'Home', 0], ['other-needs', 'Other Necessities', 'Package', 5]] },
  { id: 'wants', name: 'Wants', type: 'expense', group: 'wants', color: '#f59e0b', icon: 'Sparkles', pct: 30, subs: [
    ['entertainment', 'Entertainment', 'Clapperboard', 10], ['shopping', 'Shopping', 'ShoppingBag', 10],
    ['restaurants', 'Restaurants', 'UtensilsCrossed', 5], ['hobbies', 'Hobbies', 'Palette', 5],
    ['travel', 'Travel', 'Plane', 0], ['other-wants', 'Other Wants', 'Tag', 0]] },
  { id: 'savings', name: 'Savings & Investments', type: 'expense', group: 'savings', color: '#34d399', icon: 'PiggyBank', pct: 20, subs: [
    ['etfs', 'ETFs', 'TrendingUp', 15], ['cash-savings', 'Cash Savings', 'Wallet', 5], ['other-savings', 'Other Savings', 'Coins', 0]] },
  { id: 'income', name: 'Income', type: 'income', group: 'other', color: '#a78bfa', icon: 'Banknote', pct: 0, subs: [
    ['salary', 'Salary', 'Banknote', 0], ['scholarship', 'Scholarship', 'Award', 0], ['gifts', 'Gifts', 'Gift', 0], ['other-income', 'Other Income', 'Coins', 0]] },
];

export function seedCategories(): Category[] {
  const out: Category[] = []; let n = 0;
  for (const p of P) {
    out.push({ id: 'p-' + p.id, name: p.name, type: p.type, group: p.group, color: p.color, icon: p.icon, parentId: null, budgetPercentage: p.pct, isActive: true, sort: n++ });
    for (const [id, name, icon, pct] of p.subs)
      out.push({ id: 's-' + id, name, type: p.type, group: p.group, color: p.color, icon, parentId: 'p-' + p.id, budgetPercentage: pct, isActive: true, sort: n++ });
  }
  return out;
}
export const defaultPercentages = (): Record<string, number> =>
  Object.fromEntries(seedCategories().filter(c => c.type === 'expense').map(c => [c.id, c.budgetPercentage]));

