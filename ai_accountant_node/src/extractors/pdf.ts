import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import type { RawTransaction } from './normalize.js';

export class PdfPasswordError extends Error {
  constructor(msg = 'PDF is password-protected') {
    super(msg);
    this.name = 'PdfPasswordError';
  }
}

export async function extractPdf(buffer: Buffer, password?: string): Promise<RawTransaction[]> {
  const tmp = path.join(os.tmpdir(), `perfin-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await fs.promises.writeFile(tmp, buffer);

  try {
    const { stdout, stderr, exitCode } = await runSidecar(tmp, password);
    if (exitCode !== 0) {
      if (/password/i.test(stderr)) throw new PdfPasswordError();
      throw new Error(`PDF sidecar exited ${exitCode}: ${stderr.slice(0, 500)}`);
    }
    const parsed = JSON.parse(stdout) as { ok: boolean; transactions?: RawTransaction[]; error?: string; password_required?: boolean };
    if (!parsed.ok) {
      if (parsed.password_required) throw new PdfPasswordError(parsed.error ?? 'Password required');
      throw new Error(parsed.error ?? 'PDF extraction failed');
    }
    return parsed.transactions ?? [];
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
}

interface SidecarResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runSidecar(pdfPath: string, password?: string): Promise<SidecarResult> {
  return new Promise((resolve, reject) => {
    const args = [config.pdfSidecarScript, pdfPath];
    if (password) args.push(password);

    const child = spawn(config.pythonBin, args, {
      env: { ...process.env, PYTHONPATH: `${config.pythonProjectRoot}:${process.env.PYTHONPATH ?? ''}` },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', code => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });
}
