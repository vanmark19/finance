// All amounts are integers in minor units (bani / euro cents). Never use floats for stored money.
export type Currency = 'RON' | 'EUR';

export function toMinor(input: string | number): number {
  const s = String(input).trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${input}`);
  const neg = s.startsWith('-');
  const [i, f = ''] = s.replace('-', '').split('.');
  const v = parseInt(i, 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
  return neg ? -v : v;
}

export function fromMinor(m: number): string {
  const a = Math.abs(m);
  return `${m < 0 ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

/** Convert EUR minor units to RON minor units with an explicit, dated rate (RON per 1 EUR). */
export function eurToRon(eurMinor: number, rate: number): number {
  if (!(rate > 0)) throw new Error('Exchange rate required');
  return Math.round(eurMinor * rate);
}
