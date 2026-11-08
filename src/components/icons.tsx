import { Award, Banknote, Bus, Clapperboard, Coins, Gift, GraduationCap, HeartPulse, Home, Package, Palette, PiggyBank, Plane,
  ShoppingBag, Sparkles, Tag, TrendingUp, Utensils, UtensilsCrossed, Wallet, type LucideIcon } from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = { Award, Banknote, Bus, Clapperboard, Coins, Gift, GraduationCap, HeartPulse, Home, Package,
  Palette, PiggyBank, Plane, ShoppingBag, Sparkles, Tag, TrendingUp, Utensils, UtensilsCrossed, Wallet };
export function CatIcon({ name, size = 18 }: { name: string; size?: number }) {
  const I = ICONS[name] ?? Tag;
  return <I size={size} />;
}
