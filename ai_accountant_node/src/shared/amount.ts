const CENTS_PER_RUPEE = 100;

export function rupeesToCents(amount: number): number {
  return Math.round(amount * CENTS_PER_RUPEE);
}

export function centsToRupees(cents: number): number {
  return cents / CENTS_PER_RUPEE;
}
