# ai-accountant-node

Node + Fastify spike reimplementing three PerFin endpoints (`/accounts`, `/transactions`, `/upload`). PDF parsing is delegated to a small Python sidecar that reuses the existing `pdfplumber`/`camelot` pipeline.

## Design

- **Same SQLite file** as the Python backend (`../ai_accountant/database/ledger.db`). Identical schema, identical constraints. Swap runtimes freely.
- **Response shapes match the React client's TypeScript types** (`ai_accountant_react/src/lib/types.ts`) — raw JSON, no `{status, data}` envelope. This is a minor contract change from the Python server, which the React app was clearly designed around.
- **Port 8001** (Python uses 8000). To point the React dev server at Node instead, edit `vite.config.ts` proxy target.

## Run

```bash
cd ai_accountant_node
npm install
npm run dev           # tsx watch on port 8001
```

Point the React dev server at this backend:

```ts
// ai_accountant_react/vite.config.ts
server: { proxy: { '/api': { target: 'http://localhost:8001' } } }
```

## PDF sidecar

`sidecar/pdf_extract.py` is invoked as a subprocess with the PDF path (and optional password) as argv. It imports `scripts.extract_pdf.PDFTransactionExtractor` from the sibling Python project and prints JSON rows to stdout. Requires the Python project's `venv` to be set up.

Override the Python interpreter with `PERFIN_PYTHON=/path/to/python` if needed.
