import { createHash } from 'node:crypto';
import type { PlaidApi } from 'plaid';

export interface VerifyInput {
  client: PlaidApi;
  env: 'sandbox' | 'development' | 'production';
  signatureHeader: string | undefined;
  rawBody: string;
}

export async function verifyPlaidWebhook(input: VerifyInput): Promise<boolean> {
  if (input.env === 'sandbox') return true;
  if (!input.signatureHeader) return false;

  const parts = input.signatureHeader.split('.');
  if (parts.length !== 3) return false;
  let kid: string | null = null;
  try {
    const headerJson = Buffer.from(parts[0]!, 'base64url').toString('utf8');
    const parsed = JSON.parse(headerJson) as { kid?: string };
    kid = parsed.kid ?? null;
  } catch { return false; }
  if (!kid) return false;

  const bodyHash = createHash('sha256').update(input.rawBody).digest('hex');
  try {
    const payloadJson = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { request_body_sha256?: string };
    return payload.request_body_sha256 === bodyHash;
  } catch { return false; }
}
