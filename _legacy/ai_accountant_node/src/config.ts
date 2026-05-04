import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(__dirname, '..');
const pythonProjectRoot = path.resolve(projectRoot, '..', 'ai_accountant');

export const config = {
  port: Number(process.env.PORT ?? 8001),
  host: process.env.HOST ?? '127.0.0.1',

  databasePath: path.join(pythonProjectRoot, 'database', 'ledger.db'),

  pythonProjectRoot,
  pythonBin: process.env.PERFIN_PYTHON
    ?? path.join(pythonProjectRoot, 'venv', 'bin', 'python')
    ?? 'python3',
  pdfSidecarScript: path.join(projectRoot, 'sidecar', 'pdf_extract.py'),

  // Security — if set, all API requests require Authorization: Bearer <this key>
  apiKey: process.env.PERFIN_API_KEY ?? '',

  // Python backend for analytics/detection/categorization (same API key flows through)
  analyticsBackend: process.env.ANALYTICS_BACKEND ?? 'http://127.0.0.1:8000',

  maxUploadBytes: 50 * 1024 * 1024,

  validCategories: [
    'Income', 'Food', 'Groceries', 'Transport', 'Utilities', 'Shopping',
    'Rent', 'Insurance', 'Subscription', 'Investment', 'Transfer',
    'Medical', 'Entertainment', 'Travel', 'Education', 'Professional Services',
    'Home Maintenance', 'Personal Care', 'Gifts & Donations', 'Other', 'Needs Review',
  ],
} as const;
