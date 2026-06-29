import type { Db } from '@perfin/db';

export interface ToolContext {
  userId: string;
  db: Db;
  threadId: number | null;
  currency: string;
}

export interface ProposalResult {
  kind: 'proposal';
  proposalId: number;
  tool: string;
  preview: string;
  args: Record<string, unknown>;
}

export function isProposal(v: unknown): v is ProposalResult {
  return !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'proposal';
}
