import { createDb, transactions, type Db } from '@perfin/db';
import {
  categorizeAll,
  createClaudeCategorizer,
  normalizeRow,
  SEED_RULES,
  type CategorizationResult,
  type NormalizedTxn,
} from '@perfin/core';
import { detectExtractor } from '@perfin/extractors';
import { env } from '../env';
import { emit } from './jobs';

export interface PipelineInput {
  buffer: Buffer;
  fileName: string;
  userId: string;
  uploadJobId: number;
  writeToDb?: boolean;
  db?: Db;
}

export interface PipelineOutput {
  extracted: number;
  normalized: number;
  inserted: number;
  warnings: string[];
  categorized: CategorizationResult[];
  rows: NormalizedTxn[];
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { buffer, fileName, userId, uploadJobId, writeToDb = true } = input;

  const extractor = detectExtractor({ buffer, fileName });
  if (!extractor) {
    emit(uploadJobId, { status: 'failed', error: 'unsupported file type' });
    return { extracted: 0, normalized: 0, inserted: 0, warnings: ['unsupported file type'], categorized: [], rows: [] };
  }

  emit(uploadJobId, { status: 'extracting' });
  const extracted = await extractor({ buffer, fileName });
  emit(uploadJobId, { status: 'extracting', extractedCount: extracted.rows.length });

  const rows: NormalizedTxn[] = [];
  for (const r of extracted.rows) {
    try { rows.push(normalizeRow(r)); }
    catch { /* skip rows with bad dates */ }
  }

  emit(uploadJobId, { status: 'categorizing' });
  const llm = env.ANTHROPIC_API_KEY
    ? createClaudeCategorizer({ apiKey: env.ANTHROPIC_API_KEY })
    : null;
  const categorized = await categorizeAll(
    rows.map((r) => r.description),
    { rules: SEED_RULES, llm },
  );

  let inserted = 0;
  if (writeToDb && rows.length) {
    emit(uploadJobId, { status: 'inserting' });
    const db = input.db ?? createDb(env.DATABASE_URL).db;
    const values = rows.map((r, i) => ({
      userId,
      date: r.date,
      description: r.description,
      rawDescription: r.rawDescription,
      amountCents: r.amountCents,
      category: categorized[i]!.category,
      sourceFile: r.sourceFile,
    }));
    const result = await db.insert(transactions).values(values).onConflictDoNothing().returning({ id: transactions.id });
    inserted = result.length;
  }

  emit(uploadJobId, { status: 'done', insertedCount: inserted });

  return {
    extracted: extracted.rows.length,
    normalized: rows.length,
    inserted,
    warnings: extracted.warnings,
    categorized,
    rows,
  };
}
