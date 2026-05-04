import type { FastifyInstance, FastifyRequest } from 'fastify';
import path from 'node:path';
import { config } from '../config.js';
import type { Ledger } from '../db.js';
import { extractCsv } from '../extractors/csv.js';
import { extractExcel } from '../extractors/excel.js';
import { extractPdf, PdfPasswordError } from '../extractors/pdf.js';
import { normalizeBatch, type RawTransaction } from '../extractors/normalize.js';
import { getUserFromRequest } from './auth.js';

function uid(req: FastifyRequest): number {
  return getUserFromRequest(req)?.userId ?? 1;
}

const SUPPORTED = new Set(['.csv', '.pdf', '.xls', '.xlsx', '.qif', '.ofx', '.qfx']);

const MAGIC_BYTES: Record<string, Buffer> = {
  '.pdf': Buffer.from('%PDF'),
  '.xlsx': Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  '.xls': Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
};

function validateMagic(buf: Buffer, ext: string): string | null {
  const expected = MAGIC_BYTES[ext];
  if (!expected) return null;
  if (buf.subarray(0, expected.length).equals(expected)) return null;
  return `File content does not match the declared extension '${ext}'. Please upload a valid file.`;
}

export function uploadRoutes(app: FastifyInstance, ledger: Ledger): void {
  app.post('/api/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file uploaded' };
    }

    const filename = data.filename;
    const ext = path.extname(filename).toLowerCase();
    if (!SUPPORTED.has(ext)) {
      reply.code(400);
      return { error: `Unsupported file type '${ext}'. Supported: .pdf, .csv, .xlsx, .xls` };
    }

    const body = await data.toBuffer();
    if (body.length > config.maxUploadBytes) {
      reply.code(400);
      return {
        error:
          `File is too large (${Math.floor(body.length / (1024 * 1024))} MB). ` +
          `Maximum allowed size is ${Math.floor(config.maxUploadBytes / (1024 * 1024))} MB.`,
      };
    }

    const magicErr = validateMagic(body, ext);
    if (magicErr) {
      reply.code(400);
      return { error: magicErr };
    }

    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const account = fields.account?.value?.trim() || 'Default';
    const password = fields.password?.value || undefined;
    const bankHint = fields.bank_hint?.value || undefined;
    void bankHint;

    if (!ledger.getAccountByName(account)) ledger.createAccount({ name: account });

    let raw: RawTransaction[];
    try {
      if (ext === '.csv') raw = extractCsv(body);
      else if (ext === '.xlsx' || ext === '.xls') raw = extractExcel(body);
      else raw = await extractPdf(body, password);
    } catch (e) {
      if (e instanceof PdfPasswordError) {
        reply.code(400);
        return { error: 'This PDF is password-protected. Please enter the PDF password and try again.', password_required: true };
      }
      reply.code(500);
      return { error: `Extraction failed: ${(e as Error).message}` };
    }

    const normalised = normalizeBatch(raw);
    const ledgerTxns = normalised.map(t => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      account,
      category: 'Needs Review',
    }));

    const inserted = ledger.insertTransactions(ledgerTxns, filename, uid(req));
    const skipped = normalised.length - inserted;
    const ocrUsed = raw.some(t => (t as Record<string, unknown>).ocr_used);

    reply.code(201);
    return {
      imported: inserted,
      skipped,
      errors: [] as string[],
      account,
      extracted: raw.length,
      normalised: normalised.length,
      source_file: filename,
      ocr_used: ocrUsed,
    };
  });
}
