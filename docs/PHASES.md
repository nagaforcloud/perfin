# Perfin — Phase Status

Living document. Updated as each phase completes.

**Spec:** [`docs/superpowers/specs/2026-05-04-perfin-redesign-design.md`](superpowers/specs/2026-05-04-perfin-redesign-design.md)

| Phase | Status | Tag | Plan | What ships |
|---|---|---|---|---|
| 0 — Foundations | ✅ **Done** | `v0.1.0-phase0` | [Phase 0 plan](superpowers/plans/2026-05-04-perfin-phase-0-foundations.md) | Monorepo, schema, auth, design system, sidebar shell |
| 1 — Core data loop | ✅ **Done** | `v0.2.0-phase1` | [Phase 1 plan](superpowers/plans/2026-05-05-perfin-phase-1-core-data-loop.md) | Upload → extract → categorize → see transactions on `/app/transactions` |
| 2 — Insights & Home | ✅ **Done** | `v0.3.0-phase2` | [Phase 2 plan](superpowers/plans/2026-05-06-perfin-phase-2-insights-and-home.md) | Recurring + anomaly detectors (TS port), Home bento page, Insights feed, Inbox, scheduled nightly job, monthly narrative, budgets read-only. *Demo-able milestone.* |
| 3 — Agentic chat | ✅ **Done** | `v0.4.0-phase3` | [Phase 3 plan](superpowers/plans/2026-05-06-perfin-phase-3-agentic-chat.md) | Ask page, Vercel AI SDK + Claude streaming, 9-tool agent, write-confirm flow, `agent_actions` audit log, Settings → Activity. *Screenshot moment.* |
| 4 — Multi-source ingestion | 📋 **Planned** | — | [Phase 4 plan](superpowers/plans/2026-05-06-perfin-phase-4-multi-source-ingestion.md) | Plaid Link, Postmark inbound email parsing, Connections page, scheduled syncs, sync error handling |
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

## Phase 2 completion notes

- **3 commits** behind tag `v0.3.0-phase2`. All 6 packages typecheck; full repo build clean.
- **128 unit tests pass**: core 51 (added 21 — recurring, anomalies, drift, narrative stat-block, budget status, KPI), db 23, ui 31 (added 5 — Stat, Sparkline, AreaSparkline, AITile), extractors 13, worker 10 (added 3 — scheduler, regenerate stub, plus prior).
- New `@perfin/core` modules: `recurring/` (cluster + cadence + confidence), `anomalies/` (large-amount, category-outlier, rare-merchant), `insights/drift.ts` (MoM ≥20% threshold), `insights/narrative.ts` (Claude Sonnet 4.6 monthly summary, deterministic stat block), `insights/generate.ts` (orchestrator), `budget/status.ts`, `home/kpi.ts`.
- New UI primitives: `Stat`, `Sparkline`, `AreaSparkline`, `AITile`.
- Worker grew: `node-cron` nightly scheduler (2:00, configurable, `CRON_DISABLED` flag), `regenerateForUser` (deletes-then-inserts recurring + anomalies + insights idempotently), HMAC-protected `POST /jobs/regenerate`.
- Web grew: `/api/home`, `/api/insights` + `[id]`, `/api/inbox`, `/api/budgets`, `/api/recurring`, `/api/test-regenerate` (dev-only). Pages: bento Home (hero net worth + area sparkline + KPI strip + today's insight tile + recent activity + inbox preview), Insights (tabbed feed + dismiss), Inbox (needs-review + open anomalies), Budgets (progress bars). Sidebar shows live inbox badge with 30s polling.
- Web build: 26 routes, all under the 250 kB First Load JS bar.

---

## Phase 3 completion notes

- **3 commits** behind tag `v0.4.0-phase3`. All 7 packages typecheck cleanly (added **`@perfin/agent`**); web (29 routes) + worker both build.
- **127 unit tests pass**: db 14, ui 31, core 51, extractors 13, agent 8, worker 10. (DB count went from 23 → 14 because schema-table assertions were consolidated when the new chat/proposals tables landed; coverage of the new tables is in the consolidated suite.)
- New `@perfin/agent` package — 5 read tools (`ledger.query`, `analytics.summary`, `recurring.detect`, `anomalies.list`, `forecast.cashflow`), 4 write **proposal** tools (`transaction.update`, `transaction.split`, `budget.upsert`, `goal.create` — all create rows in `agent_proposals` instead of mutating), `executeProposal` (atomic apply + audit-row write), system-prompt builder.
- DB migration **0001**: `chat_threads`, `chat_messages`, `agent_proposals` tables; `proposal_status` and `chat_role` enums. Migration is applied to local Postgres.
- Web grew: `POST /api/ask/stream` (Vercel AI SDK 4 + Claude Sonnet 4.6 streaming with tool-use, persists thread + messages); thread CRUD (`/api/ask/threads` + `[id]`); proposal `confirm`/`cancel`; agent `activity` audit endpoint; pages `/app/ask` (chat with `ChatBubble` + `ToolCard` + `ProposalCard` + `MessageComposer` + `StarterPrompts` + `ThreadList`) and `/app/settings/activity` (audit log). Sidebar gets a Settings link and v0.4 label.
- Build fix during verification: `/app/ask` uses `useSearchParams()`, which Next.js 15 requires inside a `<Suspense>` boundary for prerender. Wrapped the inner page accordingly.
- Architecture observation: write tools never mutate when the model calls them. `executeProposal` is the *only* code path that mutates, called by the explicit user-confirm endpoint. Every confirmed write writes a row to `agent_actions` with input/output/confirmed-by — surface in Settings → Activity.
- **Dependency note:** Vercel AI SDK pulls in `zod-to-json-schema@3.25.x` which requires zod 3.25+, but `next-auth@5.0.0-beta.25` breaks with zod ≥ 3.25. Resolved with a root `pnpm.overrides` pin to `zod-to-json-schema@3.24.5`.

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
