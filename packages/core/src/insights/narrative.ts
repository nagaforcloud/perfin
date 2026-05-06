import Anthropic from '@anthropic-ai/sdk';

export interface NarrativeInput {
  currentMonth: string;
  transactions: Array<{ id: number; date: string; category: string; amountCents: number; description: string }>;
}

export interface StatBlock {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  topCategory: string;
}

function buildStatBlock(input: NarrativeInput): StatBlock {
  const ym = input.currentMonth;
  let income = 0;
  let expenses = 0;
  const byCategory = new Map<string, number>();
  for (const t of input.transactions) {
    if (!t.date.startsWith(ym)) continue;
    if (t.amountCents > 0) income += t.amountCents;
    else {
      expenses += Math.abs(t.amountCents);
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Math.abs(t.amountCents));
    }
  }
  const savings = income - expenses;
  const savingsRate = income > 0 ? savings / income : 0;
  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other';
  return { income, expenses, savings, savingsRate, topCategory };
}

const SYSTEM = [
  'You write a one-paragraph monthly summary for a personal-finance app.',
  'Tone: warm, factual, never preachy. 50-80 words.',
  'Use the provided numbers exactly. Format money as locale-aware strings the caller already provides — do not reinvent currency.',
  'No bullet points. No markdown. Plain prose.',
].join('\n');

export interface NarrativeOptions {
  apiKey: string;
  model?: string;
  currency: string;
  formatCurrency: (cents: number) => string;
}

export interface Narrative {
  headline: string;
  body: string;
  stats: StatBlock;
}

export async function generateNarrative(
  input: NarrativeInput,
  opts: NarrativeOptions,
): Promise<Narrative> {
  const stats = buildStatBlock(input);
  const client = new Anthropic({ apiKey: opts.apiKey });
  const prompt = [
    `Month: ${input.currentMonth}`,
    `Income: ${opts.formatCurrency(stats.income)}`,
    `Expenses: ${opts.formatCurrency(stats.expenses)}`,
    `Saved: ${opts.formatCurrency(stats.savings)} (${(stats.savingsRate * 100).toFixed(0)}%)`,
    `Top spending category: ${stats.topCategory}`,
    `Currency: ${opts.currency}`,
  ].join('\n');

  const resp = await client.messages.create({
    model: opts.model ?? 'claude-sonnet-4-6',
    max_tokens: 320,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  const body = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return {
    headline: `Your ${input.currentMonth}`,
    body,
    stats,
  };
}

export const __test = { buildStatBlock };
