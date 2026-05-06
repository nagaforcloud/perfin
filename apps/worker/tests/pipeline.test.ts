import { describe, expect, it } from 'vitest';
import { runPipeline } from '../src/lib/pipeline';

describe('runPipeline', () => {
  it('extracts → normalizes → categorizes → returns row count (no DB write in unit test)', async () => {
    const csv = Buffer.from(
      'Date,Description,Amount\n2026-04-01,Swiggy Bangalore,-450\n2026-04-02,Salary,80000\n',
    );
    const out = await runPipeline({
      buffer: csv,
      fileName: 'apr.csv',
      userId: 1,
      uploadJobId: 0,
      writeToDb: false,
    });
    expect(out.extracted).toBe(2);
    expect(out.normalized).toBe(2);
    expect(out.categorized[0]?.category).toBe('Food');
    expect(out.categorized[1]?.category).toBe('Income');
  });
});
