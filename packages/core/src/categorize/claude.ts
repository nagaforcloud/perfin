import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, type Category, isCategory } from '../categories';

const SYSTEM = [
  'You are a transaction categorizer for a personal-finance app.',
  'Given a list of transaction descriptions, return one category per row.',
  'You must pick from this exact list:',
  CATEGORIES.join(', '),
  'If unsure, return "Needs Review". Never invent new categories.',
  'Reply ONLY with a JSON array of {index, category} objects, nothing else.',
].join('\n');

export interface ClaudeCategorizer {
  categorize(descriptions: string[]): Promise<Category[]>;
}

export interface ClaudeOptions {
  apiKey: string;
  model?: string;
  maxBatch?: number;
}

export function createClaudeCategorizer(opts: ClaudeOptions): ClaudeCategorizer {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? 'claude-haiku-4-5-20251001';
  const maxBatch = opts.maxBatch ?? 50;

  return {
    async categorize(descriptions) {
      const out: Category[] = [];
      for (let i = 0; i < descriptions.length; i += maxBatch) {
        const slice = descriptions.slice(i, i + maxBatch);
        const userBlock = slice
          .map((d, idx) => `${idx}. ${d}`)
          .join('\n');
        const resp = await client.messages.create({
          model,
          max_tokens: 1024,
          system: SYSTEM,
          messages: [{ role: 'user', content: userBlock }],
        });
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        const parsed = parseResponse(text, slice.length);
        out.push(...parsed);
      }
      return out;
    },
  };
}

function parseResponse(text: string, expected: number): Category[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return Array(expected).fill('Needs Review' as Category);
  try {
    const arr = JSON.parse(match[0]) as Array<{ index: number; category: string }>;
    const out: Category[] = Array(expected).fill('Needs Review' as Category);
    for (const item of arr) {
      if (item.index >= 0 && item.index < expected && isCategory(item.category)) {
        out[item.index] = item.category;
      }
    }
    return out;
  } catch {
    return Array(expected).fill('Needs Review' as Category);
  }
}

export const __test = { parseResponse };
