import type { ExtractResult } from '../types';

function num(s: string): number {
  return Number(s.replace(/,/g, ''));
}

const NUMBER_RE = /([\d,]+\.\d{2})/g;

export function isHdfc(lines: string[]): boolean {
  return lines.some((l) => /^HDFC BANK/i.test(l));
}

export function parseHdfc(lines: string[], fileName: string): ExtractResult {
  const warnings: string[] = [];
  const rows = [];

  for (const line of lines) {
    // Must start with a date-like pattern
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) continue;
    const date = dateMatch[1]!;

    // Extract all number tokens with their positions
    const numbers: { value: string; pos: number }[] = [];
    for (const m of line.matchAll(NUMBER_RE)) {
      numbers.push({ value: m[0], pos: m.index! });
    }
    if (numbers.length < 2) continue;

    // Last number is always the balance
    const balance = numbers.pop()!;
    if (numbers.length === 0) continue;

    // Extract narration: everything between date end and first number
    const dateEnd = dateMatch.index! + dateMatch[0].length;
    const firstNumStart = numbers[0]!.pos;
    const narration = line.slice(dateEnd, firstNumStart).trim();

    if (numbers.length === 2) {
      // withdrawal + deposit: two numbers before balance
      const withdrawal = num(numbers[0]!.value);
      const deposit = num(numbers[1]!.value);
      const amount = deposit - withdrawal;
      if (amount === 0) continue;
      rows.push({ date, description: narration, amount, sourceFile: fileName, account: null });
    } else {
      // One number before balance — must distinguish withdrawal vs deposit
      // Heuristic: if the gap between this number and the balance is large (>15 chars),
      // the deposit column is empty → it's a withdrawal (negative)
      // If the gap is small, the withdrawal column is empty → it's a deposit (positive)
      const amountNum = num(numbers[0]!.value);
      const gap = balance.pos - numbers[0]!.pos - numbers[0]!.value.length;
      const isDeposit = gap < 15;
      const amount = isDeposit ? amountNum : -amountNum;
      rows.push({ date, description: narration, amount, sourceFile: fileName, account: null });
    }
  }

  if (!rows.length) warnings.push('HDFC parser found no rows');
  return { rows, warnings };
}
