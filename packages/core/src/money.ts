export function rupeesToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToRupees(cents: number): number {
  return cents / 100;
}

export interface FormatOptions {
  withSign?: boolean;
}

export function formatCurrency(
  cents: number,
  currency: string,
  opts: FormatOptions = {},
): string {
  const negative = cents < 0;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let body = formatter.format(Math.abs(cents) / 100);
  body = body.replace(/-/g, '\u2212');
  if (negative) return `\u2212${body}`;
  if (opts.withSign) return `+${body}`;
  return body;
}
