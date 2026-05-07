export interface ParseInput {
  from: string;
  subject: string;
  body: string;
}

export interface ParsedEmail {
  bank: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
}

const HDFC_DEBIT = /Rs\s*([\d,]+(?:\.\d{2})?)\s+at\s+(.+?)\s+on\s+(\d{2})-(\d{2})-(\d{4})/i;
const HDFC_CREDIT = /Rs\s*([\d,]+(?:\.\d{2})?)\s+credited\s+.*on\s+(\d{2})-(\d{2})-(\d{4})/i;
const ICICI_DEBIT = /INR\s*([\d,]+(?:\.\d{2})?)\s+spent.*at\s+(.+?)\s+on\s+(\d{2})-(\d{2})-(\d{4})/i;

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function ddmmToIso(dd: string, mm: string, yyyy: string): string {
  return `${yyyy}-${mm}-${dd}`;
}

export function parseInboundEmail(input: ParseInput): ParsedEmail | null {
  const text = input.body;
  const fromLower = input.from.toLowerCase();

  if (fromLower.includes('hdfcbank')) {
    const debit = HDFC_DEBIT.exec(text);
    if (debit) {
      return {
        bank: 'hdfc',
        amount: -parseAmount(debit[1]!),
        description: debit[2]!.trim(),
        date: ddmmToIso(debit[3]!, debit[4]!, debit[5]!),
        currency: 'INR',
      };
    }
    const credit = HDFC_CREDIT.exec(text);
    if (credit) {
      return {
        bank: 'hdfc',
        amount: parseAmount(credit[1]!),
        description: 'Credit (HDFC)',
        date: ddmmToIso(credit[2]!, credit[3]!, credit[4]!),
        currency: 'INR',
      };
    }
  }

  if (fromLower.includes('icicibank')) {
    const debit = ICICI_DEBIT.exec(text);
    if (debit) {
      return {
        bank: 'icici',
        amount: -parseAmount(debit[1]!),
        description: debit[2]!.trim(),
        date: ddmmToIso(debit[3]!, debit[4]!, debit[5]!),
        currency: 'INR',
      };
    }
  }

  return null;
}
