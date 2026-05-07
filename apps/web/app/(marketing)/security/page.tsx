import { Tile } from '@perfin/ui';

export default function SecurityPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <h1 className="text-3xl font-semibold">Security</h1>
      <Tile className="space-y-3">
        <h2 className="font-semibold">Data storage</h2>
        <p className="text-sm text-text-muted">Perfin stores your financial data in a PostgreSQL database you control. No multi-tenant table sharing. Your transactions, account credentials, and chat history are encrypted at rest and isolated to your database.</p>
      </Tile>
      <Tile className="space-y-3">
        <h2 className="font-semibold">Bank credentials</h2>
        <p className="text-sm text-text-muted">Plaid access tokens are encrypted with AES-256-GCM before storage. The encryption key (KMS) lives in environment variables, never in source code. Perfin never sees your bank login — Plaid handles that via their OAuth flow.</p>
      </Tile>
      <Tile className="space-y-3">
        <h2 className="font-semibold">AI data handling</h2>
        <p className="text-sm text-text-muted">Transaction descriptions and categories are sent to AI providers (Anthropic, OpenAI) for classification. Full account numbers, balances, and PII are stripped before sending. You can disable AI categorization and rely on rules-only classification.</p>
      </Tile>
      <Tile className="space-y-3">
        <h2 className="font-semibold">Infrastructure</h2>
        <p className="text-sm text-text-muted">The web app and worker run on a single VPS. The PostgreSQL database is on the same machine, firewalled to local-only connections. All internal communication (web → worker) uses HMAC-signed payloads.</p>
      </Tile>
    </section>
  );
}
