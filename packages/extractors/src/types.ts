import type { RawRow } from '@perfin/core';

export interface ExtractInput {
  buffer: Buffer;
  fileName: string;
  password?: string;
}

export interface ExtractResult {
  rows: RawRow[];
  bank?: string;
  warnings: string[];
}

export type Extractor = (input: ExtractInput) => Promise<ExtractResult>;
