# Perfin — Phase Status

Living document. Updated as each phase completes.

**Spec:** [`docs/superpowers/specs/2026-05-04-perfin-redesign-design.md`](superpowers/specs/2026-05-04-perfin-redesign-design.md)

| Phase | Status | Tag | Plan | What ships |
|---|---|---|---|---|
| 0 — Foundations | ✅ **Done** | `v0.1.0-phase0` | [Phase 0 plan](superpowers/plans/2026-05-04-perfin-phase-0-foundations.md) | Monorepo, schema, auth, design system, sidebar shell |
| 1 — Core data loop | ✅ **Done** | `v0.2.0-phase1` | [Phase 1 plan](superpowers/plans/2026-05-05-perfin-phase-1-core-data-loop.md) | Upload → extract → categorize → see transactions on `/app/transactions` |
| 2 — Insights & Home | 🕓 Not started | — | — | Recurring + anomaly detectors (TS port), Home bento page, Insights feed, Inbox, scheduled nightly job, monthly narrative, budgets read-only. *Demo-able milestone.* |
| 3 — Agentic chat | 🕓 Not started | — | — | Ask page, Vercel AI SDK + Claude streaming, 9-tool agent, write-confirm flow, `agent_actions` audit log, Settings → Activity. *Screenshot moment.* |
| 4 — Multi-source ingestion | 🕓 Not started | — | — | Plaid Link, Postmark inbound email parsing, Connections page, scheduled syncs, sync error handling |
| 5 — SaaS skin | 🕓 Not started | — | — | Marketing site (`/`, `/pricing`, `/how-it-works`, `/security`), Stripe billing for Plus/Pro, billing settings, live-demo widget on landing, PWA manifest + service worker + push notifications |

After Phase 5: `v1.0.0` — publicly launchable.

---

## Cumulative budget

Per the design spec the rough estimate is **~10 weeks solo**. Each phase ends in a demo-able state, so the project can stop or pivot at any phase boundary with a real product in hand. Stopping after Phase 2 leaves a usable single-player AI accountant.

---

## Phase 0 completion notes

- **15 commits** between `b085522` and `c8f65cb`. Tag `v0.1.0-phase0`.
- 4 packages typecheck (`@perfin/db`, `@perfin/ui`, `@perfin/web`, `@perfin/worker`); 1 helper workspace (`@perfin/scripts`); 1 shared (`@perfin/config`).
- 50 unit tests pass; 23 DB tests against real Postgres pass; 2 Playwright e2e tests pass.
- Postgres runs in Docker on **port 5433** (5432 is taken by the user's host Postgres).
- Legacy SQLite ledger import works idempotently and tolerates missing `budgets` table.
- Web build < 250 kB First Load JS per route on every page (per Phase-0 acceptance bar).

---

## Phase 1 completion notes

- **2 commits** (`09ec158`, `45205a5`). Tag `v0.2.0-phase1`.
- 6 packages now typecheck cleanly (`@perfin/config`, `@perfin/db`, `@perfin/ui`, `@perfin/core`, `@perfin/extractors`, `@perfin/web`, `@perfin/worker`).
- **99 unit tests pass**: core 30, db 23, ui 26, extractors 13, worker 7.
- New packages: **`@perfin/core`** (money, text/dedupe-hash, normalize, 21-category taxonomy, rule engine, Claude Haiku 4.5 wrapper, orchestrator, 57 seed rules ported from legacy `merchant_rules.json`); **`@perfin/extractors`** (CSV with header sniff + debit/credit, Excel via SheetJS→CSV, PDF via `pdfjs-dist` legacy build, HDFC bank heuristic, mime/extension dispatch).
- Worker grew: HMAC sign/verify, in-memory job registry with EventEmitter SSE, full `extract → normalize → categorize → insert` pipeline (Postgres `onConflictDoNothing` dedup), `POST /jobs/upload` (HMAC-verified, async), `GET /jobs/:id/stream` (SSE).
- Web grew: React Query provider + typed fetcher + HMAC worker client; `POST /api/upload` (auth, persist to disk, dispatch to worker); `GET /api/transactions` (filtered, searchable); `PATCH /api/transactions/[id]`; `GET/POST /api/accounts`; Transactions page (table + filters + edit Sheet); Accounts page (grid + add modal); Upload page (drag-drop + live SSE progress); 3-step onboarding (welcome → currency → connect); sidebar with `lucide-react` icons + Upload CTA; onboarding route protection in middleware.
- Web build: 17 routes, all under the 250 kB First Load JS bar.
- Architecture observation: file storage is **local disk** under `data/uploads/` (gitignored). R2/S3 swap is deferred to Phase 5.

---

## Update protocol

When a phase completes:

1. Move it to ✅ **Done**.
2. Add the git tag (`vX.Y.Z-phaseN`).
3. Add a short completion-notes section below mirroring earlier ones.
4. Commit + push (`docs(phases): mark Phase N as done`).

When the next phase plan is written:

1. Move it to 📋 **Planned** with a link to the plan file.
2. Commit + push (`docs(phases): link Phase N plan`).
