import type { ExtractResult } from '../types';
import { isHdfc, parseHdfc } from './hdfc';

export interface BankResult extends ExtractResult {
  bank?: string;
}

export function detectBank(lines: string[]): string | null {
  if (isHdfc(lines)) return 'hdfc';
  return null;
}

export function applyBank(lines: string[], fileName: string, bank: string | null): BankResult {
  if (bank === 'hdfc') return { ...parseHdfc(lines, fileName), bank };
  return { rows: [], warnings: ['no bank format matched (Phase 1 ships HDFC only)'] };
}
