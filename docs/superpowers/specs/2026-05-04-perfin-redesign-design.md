# Perfin — Full Rebuild Design Spec

**Date:** 2026-05-04
**Status:** Approved by user, ready for implementation planning
**Supersedes:** `PERFIN_REDESIGN_PLAN.md`, `DESIGN.md`
**Author:** brainstorming session, accepted by user

---

## 0. Summary

Complete rebuild of the Perfin (AI Accountant) personal-finance application as a **pre-product SaaS**. New stack is **TypeScript end-to-end on a Turborepo monorepo** — Next.js 15 (App Router) + Fastify worker + Postgres + Drizzle + Claude Sonnet 4.6. **All Python is removed** — file extraction, categorization, recurring/anomaly detection, narrative generation are all reimplemented in TypeScript.

The app's UX is **bento / AI-modern, dark-first**, on a PWA shell. The headline differentiator is an **agentic chat surface** ("Ask Perfin") with read tools that execute immediately and write tools that propose changes for user confirmation. Three ingestion paths land on day one: PDF/CSV/Excel upload, Plaid bank connections, and email-forwarding parsing.

Five-phase rollout, ~10 weeks of solo work. Phases 1-2 produce a usable single-player app; phases 3-5 add the agent, multi-source ingest, and the SaaS skin (marketing site, pricing, billing, push notifications).

## 1. Brainstorming decisions (binding)

| # | Question | Decision |
|---|---|---|
| 1 | Audience | Pre-product SaaS — single-player today, SaaS-ready seams |
| 2 | Aesthetic | Bento / AI-modern, dark-first |
| 3 | Ingestion | Upload + Plaid + Email-forward, all in v1 |
| 4 | AI depth | Full agentic — extract, categorize, insight, chat, actions |
| 5 | Platform | Web + PWA, dark-first, fresh start |
| 6 | Architecture | Next.js 15 monolith + Fastify worker (Turborepo) |

## 2. Current-app analysis

Three coexisting codebases that overlap in confusing ways:

| Layer | Path | State |
|---|---|---|
| Original Python pipeline | `ai_accountant/` | Working: PDF→extract→normalize→rules→LLM→recurring/anomaly→Excel. CLI + Streamlit. Local llama.cpp. |
| Node port (Fastify) | `ai_accountant_node/` | ~70% done. Auth, accounts, txns, budgets, analytics endpoints live. Upload still shells to Python (`sidecar/pdf_extract.py`). No LLM categorization. |
| React UI | `ai_accountant_react/` | Skeleton. Vite + React 19 + Tailwind v4. 8 pages exist; data hooks wired. Three competing styling directions, none implemented end-to-end. |

### Strengths to preserve

- **Schema:** SQLite with INTEGER cents (no FP errors), WAL mode, UNIQUE on `(date, description, amount, source)`, indexes on every queried column. `user_id` columns already added — multi-tenancy is one FK away. Ports cleanly to Postgres.
- **API contract:** Node port returns raw JSON matching `lib/types.ts` — no `{status, data}` envelope.
- **Pipeline decomposition:** each Python stage (extract, normalize, categorize-rules, categorize-llm, detect-recurring, detect-anomalies, financial-summary) is a separable module. Translates piece by piece.
- **Currency-aware:** INR default, internationalization seam already present.
- **Eight-stage pipeline is genuinely a moat** — most PFM apps ship one or two of those stages. Translate, don't redesign.

### Gaps to close

- No agentic / chat surface anywhere. AI is invisible — it just changes a column.
- No insights layer surfaced to users. Anomaly + recurring data exists as endpoints, never reaches the user.
- Onboarding is cliff-shaped — landing on `/` empty shows zero state with no guidance.
- Three competing design specs, zero decisions.
- Streamlit UI (`ui.py`) duplicates the React app.
- No marketing surface (`/`, `/pricing`, `/security`).
- Plaid + email-forward: not started.
- PDF upload is synchronous and blocks the request; no progress UI.
- PWA in `package.json`, unused.
- No settings page, no category management UI, no notifications.
- Search is `LIKE %?%` — fine at thousands, bad at millions, no semantic.
- No tests on Node or React side.

### Keep / kill

**Keep (translate, don't rewrite the logic):** the 8-stage pipeline concepts, schema shape (cents-as-integer; UNIQUE constraint; per-user FKs), category taxonomy as a starting set, merchant-rules JSON as the seed for an editable rule UI.

**Kill:** all Python (`ai_accountant/`, `ai_accountant_node/sidecar/`); the Streamlit UI; llama.cpp; Excel as the *primary* output (becomes side feature); the current dark-glass styling; both competing design specs; the Vite SPA shell.

## 3. Information architecture

### Two surfaces, one app

```
perfin.app
├── (marketing)       SSG/SSR, public, SEO-indexed
│   ├── /             Landing (with live-demo widget)
│   ├── /pricing      Free / Plus $9 / Pro $19
│   ├── /how-it-works
│   ├── /security     trust surface
│   ├── /changelog
│   ├── /docs/*
│   └── /login, /signup
│
└── (app)             authenticated, no SEO
    ├── /onboarding/* 5-step first-run flow
    └── /app/*        sidebar shell
```

### App sidebar (8 items, in order)

| Item | Route | Purpose |
|---|---|---|
| Home | `/app` | Bento dashboard — net worth, KPIs, today's insight, recent activity, inbox preview |
| Transactions | `/app/transactions` | Full ledger; bulk edit, split, tag, search |
| Insights | `/app/insights` | Feed of anomalies, recurring, trends, forecasts, narratives |
| Ask | `/app/ask` | Conversational money agent |
| Accounts | `/app/accounts` | Bank connections, manual accounts, uploads, email forwarding |
| Budgets & Goals | `/app/budgets` | Per-category caps + savings goals with projection |
| Reports | `/app/reports` | Cash flow, categories, merchants, calendar heatmap, health score |
| Inbox | `/app/inbox` | Queue: txns to review, anomalies, agent proposals, sync errors. Sidebar badge count. |

**Footer (always visible):** "Connect data" dropdown, Settings, user menu.

### Pricing tiers

- **Free** — 1 account, 100 txns/mo, no Plaid, agent chat 30 calls/mo
- **Plus $9/mo** — Plaid, unlimited txns, agent chat 200/mo, Excel export
- **Pro $19/mo** — multi-account Plaid, unlimited agent, PDF report export, members (RBAC), priority support

### Out of scope for v1

Investment tracking, crypto wallets, bill pay, native iOS/Android, public sharing, receipt OCR as a first-class flow.

## 4. Design system

### Foundations

- **Typeface:** Inter Variable (UI) + JetBrains Mono Variable (numerics & code), via `@fontsource-variable`. Global `font-feature-settings: "ss01", "cv11", "tnum"`.
- **Theme:** CSS variables on `:root` (dark) and `[data-theme="light"]` (ships v1.1). Tailwind v4 `@theme` pulls from these.
- **Spacing:** 4-pt grid (`space-1` … `space-16`).
- **Radii:** `sm 6 / md 10 / lg 14 / xl 20 / full`. Default tile radius is `lg`.
- **Elevation:** two shadows only (`shadow-1` for tiles, `shadow-2` for modals/popovers). No glow, no glass blur except modal overlay.

### Tokens (dark, canonical)

```css
--bg: #08080B;
--surface: #101015;
--surface-2: #16161D;
--surface-3: #1C1C25;
--surface-hover: #20202A;
--border: #26262F;
--border-strong: #34343F;

--text: #F4F4F5;
--text-muted: #A1A1AA;
--text-subtle: #71717A;
--text-inverse: #0A0A0A;

--accent: #6366F1;        /* indigo — agentic / AI */
--accent-soft: rgba(99,102,241,.14);
--accent-hover: #7C7EF1;

--positive: #34D399;      /* income, gains */
--negative: #FB7185;      /* expenses, losses */
--warning: #FBBF24;
--info: #60A5FA;
```

### Color philosophy (load-bearing rules)

1. **Indigo is precious.** `--accent` appears only on: primary buttons, AI surfaces (Ask, Insights, agent action proposals), the active sidebar item, chart highlight strokes. Never on data values, default borders, or as decoration.
2. **Money colors are semantic, never decorative.** `--positive` on income/gains only. `--negative` on expense/loss only. They never appear on UI chrome.
3. **Surfaces stack subtly.** `bg → surface → surface-2 → surface-3`, each ~6% lighter. Tiles never use anything brighter than `surface-2`.
4. **Borders do the work shadows used to.** A 1px `--border` on every tile beats a heavy shadow.

### Numerics

- All money values use **JetBrains Mono with `tnum`** — column-perfect alignment in lists.
- Negative sign is **U+2212 (`−`)**, not hyphen. Sign is always present (`+` on income too).
- Currency symbol is left of value, no space. Locale-aware: ₹, $, €, £.
- Decimals always two for money in detail contexts; hidden if `.00` only in dense rows.

### Component library

Built on **shadcn/ui** (Radix-based) restyled to tokens:

Button (primary/secondary/ghost/danger; sm/md/lg) · Tile/Card (regular/raised/hero) · **AITile** (indigo-tinted, radial glow, action buttons inline) · Input/Textarea/Select/Combobox/DatePicker/DateRangePicker · Badge (income/expense/warning/info/accent/neutral) · Modal/Sheet/Popover/Tooltip/DropdownMenu/ContextMenu · Skeleton (row/tile/kpi/chart) · Toast/Banner · **ChatBubble + ToolCard** · TransactionRow · Sparkline + AreaSparkline · Recharts-based LineChart/AreaChart/BarChart/DonutChart/Heatmap · Stat (KPI cell) · Stepper · FileDropzone · EmptyState · CommandPalette (`⌘K`).

### Motion

- Hover: 120ms `background-color` only. Never transform.
- Modals/sheets: 200ms ease-out, fade + 4px translate.
- Toasts: 240ms slide-in right.
- Page transitions: none.
- Insight tiles: soft 600ms fade-in on first render.
- AI streaming text: char-by-char with a 1px blinking cursor — the only place we draw attention.

### Light mode (v1.1)

Token swap, no component changes. Surfaces invert to warm-paper (`#FBF9F4` bg, `#FFFFFF` surface, `#F5F1E8` surface-2). Indigo accent unchanged. Deferred to v1.1 to halve visual-QA surface in v1.

## 5. Pages

Each page: **purpose · layout · key behaviors · empty state.**

### 5.1 Home (`/app`)

**Purpose:** Single screen that answers *"what's happening with my money right now?"* and surfaces the one AI insight worth seeing today.

**Layout:** 12-col bento. Hero net-worth tile spans 2 rows × 6 cols (display value, 90-day sparkline, MoM delta). Right side: 4 KPI tiles (Income, Expenses, Savings rate, Top category). Below hero: full-width AI Insight tile (indigo, with action buttons). Bottom row: Recent activity (8 rows, 8 cols) + Inbox preview (4 cols). Reflows mobile to single column, hero first.

**Key behaviors:**
- AI Insight tile is regenerated daily by the worker. Only the highest-confidence, highest-impact insight per day shown. Dismissable.
- Hero sparkline interactive (hover for date+balance).
- Recent activity rows clickable → opens transaction edit Sheet.

**Empty state:** Bento collapses into a single "let's get you set up" stepper (rerun of onboarding step 3).

### 5.2 Transactions (`/app/transactions`)

**Purpose:** Power-user table for finding, editing, splitting, tagging, categorizing in bulk.

**Layout:** Sticky topbar (search + filters + Add/Export). Active filter chips below. Table with month-grouped sticky headers; columns: checkbox · Date · Description · Category badge · Account · Amount. Bulk-action bar appears at the bottom when rows selected (sticky, not floating). Row click opens 480px right Sheet with full detail (description edit, category change with AI suggestion, split, attach receipt, agent reasoning, change history, similar transactions).

**Key behaviors:**
- Search uses Postgres FTS + smart-parse for queries like *"groceries last quarter > $50"*; structured filters for common patterns, LLM only for complex.
- Split: one txn → N (each child links back to parent_transaction_id).
- Server-side pagination, 50/page. No infinite scroll.
- Keyboard: `↑↓` rows, `e` edit, `c` categorize, `del` delete, `⌘a` select all on page.

**Empty state:** Centered illustration + "Connect a bank account or upload a statement to see transactions here."

### 5.3 Insights (`/app/insights`)

**Purpose:** Standing feed of everything the AI has noticed. Answers "what is the AI actually doing?"

**Layout:** Tab strip (All · Anomalies · Recurring · Trends · Forecast · Savings opportunities). Card feed, single column, max-w 880px. Each card: type badge · headline · supporting body · 1-2 action buttons · "Snooze 30 days" · "Why am I seeing this?" popover with the agent's reasoning + the SQL/rule that produced it.

**Card types:** Anomaly · Recurring detected · Subscription cost rising · Category drift · Cash-flow forecast · Savings opportunity · Monthly narrative (auto-generated 1st of each month).

**Key behaviors:** Insights generated by nightly worker, persisted to `insights` table with confidence score. Top N per type surface. Every insight links to underlying transactions ("Show me" → filtered Transactions view).

**Empty state:** "Perfin needs ≥30 days of transactions to start generating insights. You have *N* days. Come back soon."

### 5.4 Ask (`/app/ask`)

**Purpose:** Chat with your money. The killer demo.

**Layout:** Two-column. 240px sidebar with recent threads + pinned. Main: chat thread (bubbles + ToolCard rows for tool calls) with sticky composer at the bottom. On empty, 6 rotating contextual suggestion cards.

**Key behaviors:**
- Vercel AI SDK + Claude Sonnet 4.6 streaming with tool-use. Tool calls render inline as `ToolCard` (`✓ ledger.query · 87 transactions · 152 ms`).
- **Read tools execute immediately**; **write tools return a proposal** rendered as an inline confirm card.
- Six starter prompts (rotate, contextual to user data): *"How am I doing this month?"* · *"What can I cut to save $500/mo?"* · *"Show me every Amazon over $200."* · *"Find subscriptions I forgot about."* · *"Forecast my cash flow for the next 60 days."* · *"Make me a budget for next month."*

**Empty state:** Big composer center-screen, suggestions below.

### 5.5 Accounts (`/app/accounts`)

**Purpose:** Manage data sources.

**Layout:** Tab strip (Bank connections · Manual accounts · Uploads · Email forwarding). Cards grid of accounts (logo, name, last-4, balance, last-sync, status dot). Per-card actions menu (rename, color, sync now, disconnect, view transactions). Add tile at end.

Email-forwarding tab: big readable address (`u_<hash>@in.perfin.app`) with copy button, per-bank instructions, last 20 parsed emails with success/fail.

**Key behaviors:** Plaid Link in modal; on success, accounts appear, first sync runs as background job with progress card. Disconnect → confirm modal explains historical txns stay. Sync errors (`ITEM_LOGIN_REQUIRED`) surface as red banner with reconnect CTA.

### 5.6 Budgets & Goals (`/app/budgets`)

**Purpose:** Per-category caps + savings goals with forecast.

**Layout:** Two sections. Budgets: rows in a single card — category · spent/budget (mono) · 8px progress bar (track surface-2; fill accent under, negative over) · `N days left in May` · ⋮ menu. Goals: card grid — name, progress ring, saved/target, AI projection (*"On pace · arriving Aug 22"* or *"Behind by $340"*).

**Key behaviors:** Budgets ping (toast + Inbox) at 80%, 100%, 120%. Goal projection runs nightly using cash-flow forecast. Agent can suggest a feasibility study from chat.

### 5.7 Reports (`/app/reports`)

**Purpose:** Deep-dive analytics.

**Layout:** Sticky date-range bar at top (presets: This month / Last month / This quarter / YTD / Custom). Vertical sections (jump-nav on the right): Cash flow (stacked area) · Categories (horizontal bars + treemap toggle) · Merchants (top 20 with sparklines) · Calendar heatmap (daily spend, GitHub-contribution style) · Health score (large number + breakdown) · Custom queries (Pro). Sticky export bar at bottom: CSV (free), Excel (Plus+), PDF (Pro).

### 5.8 Inbox (`/app/inbox`)

**Purpose:** Everything that needs your attention. Sidebar badge count.

**Layout:** Single column, max-w 720px. Card list: type icon · content · action right. Item types: needs-review txns, unconfirmed anomalies, agent action proposals, sync errors, budget breaches, recurring confirmations. Filters (All · Action needed · Informational), bulk-dismiss.

### 5.9 Onboarding (`/onboarding/*`)

5 steps, each its own route so resumable.

| Step | Route | Content |
|---|---|---|
| 1 | `/onboarding/welcome` | Hello, what you'll do, [Continue]. |
| 2 | `/onboarding/locale` | Currency (auto-guessed from IP), date format, week start. |
| 3 | `/onboarding/connect` | 3 cards: Plaid · Upload · Email. Skip allowed. |
| 4 | `/onboarding/agent` | Capabilities toggle (categorize / flag anomalies / propose actions). Defaults: first two on. |
| 5 | `/onboarding/done` | If ≥1 txn loaded: first auto-generated insight → [Take me to my dashboard]. Else: "Come back when your data lands." |

Skip-to-end always allowed. Onboarding re-runnable from Settings.

### 5.10 Settings (`/app/settings/*`)

**Tabs:** Profile · Connections · Categories & rules · Agent · Notifications · Billing · Members (Pro) · Security · Activity (audit log) · Danger zone.

Highlights:
- **Categories & rules:** drag-to-reorder priority, inline-edit, "test rule" button runs against last 30 days and shows what would have matched.
- **Agent:** per-capability and per-tool toggles; chat history retention (30/90/365/forever).
- **Activity:** every agent write action with timestamp, tool, input, output, who confirmed. CSV export.
- **Danger zone:** delete all data, delete account, export everything (JSON).

### 5.11 Marketing pages

Already covered in §3 IA. Tone: *quietly confident, evidence-rich.* Hero on `/` includes a **live-demo widget** — paste fake CSV → watch it categorize → see an insight generated. No signup required. Conversion lever.

## 6. Architecture

### 6.1 Repository (Turborepo)

```
perfin/
├── apps/
│   ├── web/              # Next.js 15 — marketing + app, App Router
│   └── worker/           # Fastify long-running service
├── packages/
│   ├── db/               # Drizzle schema, migrations, seed
│   ├── core/             # Pure-TS domain logic (categorize, recurring, anomaly,
│   │                     # forecast, narrative). No I/O, no env. Shared by web + worker.
│   ├── extractors/       # PDF / CSV / Excel / email parsers (Node-only)
│   ├── agent/            # Claude agent: tools, system prompts, schemas
│   ├── ui/               # shadcn-based component library, design tokens
│   ├── api-client/       # Typed fetch wrapper for web → worker calls
│   └── config/           # Shared eslint, tsconfig, tailwind preset
├── docs/                 # specs, plans, ADRs
└── turbo.json
```

The most important boundary: `packages/core` has **no I/O, no framework imports, no env vars.** Pure pipelines that take JSON in and return JSON out. This was the property that made the Python pipeline good — preserve it.

### 6.2 Database schema (Postgres + Drizzle)

Existing `accounts / transactions / budgets / users` ports cleanly. New tables:

```ts
users(id, email, password_hash, plan, created_at)
connections(id, user_id, provider, provider_account_id, access_token_enc,
            cursor, last_sync_at, status, error)
accounts(id, user_id, name, bank, type, currency, color,
         connection_id NULL, plaid_account_id NULL,
         balance_cents, created_at)
transactions(id, user_id, account_id, date, description, raw_description,
             amount_cents, category, subcategory, tags TEXT[],
             source_file, source_email_id, plaid_txn_id,
             parent_transaction_id NULL,
             pending BOOL, created_at, updated_at,
             UNIQUE(user_id, date, description, amount_cents, source))
budgets(id, user_id, category, amount_cents, period, account_id NULL,
        created_at, updated_at, UNIQUE(user_id, category, period, account_id))
goals(id, user_id, name, target_cents, deadline, source_account_id,
      saved_cents, status, created_at)
category_rules(id, user_id, priority, match_type, pattern, category,
               created_by, created_at)
recurring_series(id, user_id, merchant, category, amount_cents,
                 cadence, next_expected_at, confidence,
                 first_seen, last_seen, status)
anomalies(id, user_id, transaction_id, kind, score, reason,
          status ENUM(open, confirmed, dismissed), created_at)
insights(id, user_id, kind, headline, body, payload JSONB,
         confidence, surface ENUM(home, insights), action_taken,
         created_at, expires_at)
agent_actions(id, user_id, tool, input JSONB, output JSONB,
              confirmed_by, confirmed_at, undone_at NULL, created_at)
inbound_emails(id, user_id, from, subject, body_hash, parsed_txn_id NULL,
               status, error, received_at)
upload_jobs(id, user_id, file_name, mime, size_bytes,
            status ENUM(queued, extracting, categorizing, done, failed),
            extracted_count, started_at, finished_at, error)
sessions(id, user_id, token_hash, expires_at)               # Auth.js JWT sessions
```

Migrations in `packages/db/migrations` (drizzle-kit). **One-shot import script** translates the existing SQLite ledger to the new Postgres schema on day one.

### 6.3 Authentication

Auth.js (NextAuth) v5: credentials + Google OAuth. JWT sessions in httpOnly cookies. Magic-link is v1.1. RBAC scaffolded via `members(workspace_id, user_id, role)`; v1 ships single-player but the seam is built.

### 6.4 LLM strategy

- **Provider:** Claude **Sonnet 4.6** for the hot path (categorization, agent chat, insights, narrative). **Haiku 4.5** for cheap classifications (merchant normalization, simple yes/no).
- **SDK:** `@anthropic-ai/sdk` direct + Vercel AI SDK for streaming tool-use over RSC.
- **Prompt caching:** system prompt + tool schemas + user's category list + recent merchant cache sent as cache-control: ephemeral. Decisive for cost — agent chat goes from ~$0.04/turn to ~$0.005/turn after the first.
- **Vision (PDF OCR fallback):** image-only / scanned PDFs route the page render to Claude Sonnet 4.6 with vision. Behind a feature flag (cost + privacy opt-out).
- **Local-LLM-only mode:** packaging hook in `packages/agent` to swap provider — for Pro users who want fully-local. v2.

### 6.5 Data ingestion

```
                                ┌──────────────────────────────┐
[Plaid webhook] ────────────────│                              │
                                │   Worker: ingestion router   │
[Inbound email (Postmark)]──────│   - dedupe                   │
                                │   - extract (per source)     │
[Upload signed URL → R2] ───────│   - normalize                │
                                │   - categorize (rules→LLM)   │──→ Postgres
                                │   - detect recurring         │
                                │   - detect anomalies         │
                                │   - generate insight (if 1st)│
                                └──────────────────────────────┘
```

- **Upload:** browser POSTs to a presigned R2 URL (no file passes through the function). On success, web posts a job to the worker via `/jobs/upload` (HMAC-protected). Status polled via SSE on `/jobs/:id`; upload page shows live "Extracting page 4/12 → Found 247 → Categorizing…"
- **PDF extraction:** `pdfjs-dist` (95% case). For scans: render page to PNG with `node-canvas`, send to Claude vision. For password-protected: prompt for password in modal, retry. **Bank-format heuristics** (HDFC, ICICI, Chase, Wells Fargo, etc.) live in `packages/extractors/banks/*.ts` — translate the existing Python parsers verbatim with the same fixture PDFs.
- **CSV/Excel:** `csv-parse` + `xlsx`. Auto-detect column mapping with confidence; if low, show column-mapping modal. User confirmation persists to `connections` for future imports.
- **Plaid:** Plaid Link in browser → backend exchange → access token encrypted (AES-256-GCM with `KMS_KEY` env). Webhooks (`TRANSACTIONS_SYNC_UPDATES_AVAILABLE`, `ITEM_ERROR`) hit `/webhooks/plaid` on worker, which runs `transactionsSync` with cursor and feeds the same normalization pipeline.
- **Email forwarding:** Postmark inbound parse (`u_<hash>@in.perfin.app`) POSTs JSON to `/webhooks/postmark`. Worker auths user by `to:` hash; per-bank template parsing (regex first, LLM fallback).

### 6.6 Agent — write-confirm

Two tool kinds:
- **Read tools** execute immediately. Result streams back with a `ToolCard` (name, count, ms).
- **Write tools** *don't execute on call.* They return a structured proposal (args + human-readable preview). Chat renders an inline `[✓ Confirm] [Cancel]` card. On confirm, web app calls `/agent/confirm-action/:id` which executes the tool, writes to `agent_actions`, and emits the result back into the conversation.

This solves "what if the AI deletes my data" fear, makes audit trivial, and makes the chat a *negotiation* surface that feels safer than a blackbox agent.

**Tools (v1):**
- Read: `ledger.query(filters)`, `analytics.summary(date_range)`, `recurring.detect(category?)`, `anomalies.list(date_range)`, `forecast.cashflow(days)`
- Write: `transaction.update(id, patch)`, `transaction.split(id, splits)`, `budget.upsert(category, amount)`, `goal.create(name, target, deadline)`

System prompt explicit about: user's currency, top categories, account names, today's date, available tools, formatting rules, "ask one clarifying question if ambiguous."

### 6.7 Background jobs

- **Scheduler:** `node-cron` inside worker (single-process is fine at this scale). Graduate to BullMQ + Redis later via a `JobQueue` interface in `packages/core`.
- **Jobs:**
  - Hourly: Plaid `transactionsSync` for connected items
  - Nightly 02:00: regenerate insights, recurring refresh, anomaly scan; monthly narrative on the 1st
  - Every 6h: re-score budget projections, push Inbox notifications
  - Every 30s: drain `outbox` table for transactional emails

### 6.8 Notifications

- **In-app:** Inbox is the canonical surface. Sidebar badge = `count(inbox where status='open')`.
- **Push (PWA):** Web Push via VAPID. Opt-in from Settings → Notifications. Triggers: budget breach (100%, 120%), large anomaly (`score > 0.85`), agent action awaiting confirm, sync error.
- **Email:** Postmark transactional. Same triggers, opt-in per type. Daily/weekly digest as the engagement lever.

### 6.9 Hosting and cost

| Service | Plan | Est. monthly @ pre-product |
|---|---|---|
| Vercel | Pro | $20 |
| Fly.io worker (1× shared-cpu-1x) | | $5 |
| Neon Postgres | Free → Launch | $0–19 |
| Cloudflare R2 | | ~$1 |
| Postmark | Starter | $15 |
| Anthropic API | pay-per-use | $20–80 |
| Plaid | Sandbox free; production per-account | $0 sandbox / ~$0.30/account/mo prod |
| **Total** | | **~$60–140/mo while pre-revenue** |

## 7. Phased rollout

~10 weeks solo. Each phase ends in a demo-able state.

**Phase 0 — Foundations (Week 1).** Monorepo init · Drizzle schema + migrations · Auth.js + login/signup · Next.js shell with sidebar, theme tokens, design system primitives (Button, Tile, Input, Badge, Skeleton, Toast, Modal). One-shot SQLite→Postgres import script. *Ship: running shell on a real DB, no real features.*

**Phase 1 — Core data loop (Weeks 2-3).** `packages/extractors` (PDF + CSV + Excel) · `packages/core` categorizer (rules + Claude) · upload flow with R2 + worker job pipeline + SSE progress · Transactions page · Accounts page (manual only) · Onboarding steps 1-3 minus Plaid. *Ship: signup → drop a PDF → see categorized transactions in a table.*

**Phase 2 — Insights & Home (Weeks 4-5).** Recurring/anomaly detectors (TS port) · Home bento page · Insights feed · scheduled nightly job · Inbox · monthly narrative · budgets page (read-only). *Ship: the demo-able milestone.*

**Phase 3 — Agentic chat (Weeks 6-7).** Ask page · Vercel AI SDK streaming · 9-tool agent · write-confirm flow · `agent_actions` audit log · Settings → Activity. *Ship: the screenshot moment.*

**Phase 4 — Multi-source ingestion (Weeks 8-9).** Plaid Link · Postmark inbound · Connections page · scheduled syncs · sync error handling. *Ship: automatic data flow.*

**Phase 5 — SaaS skin (Week 10).** Marketing site · Stripe Plus/Pro · billing settings · live-demo widget · PWA manifest + service worker + push · invite-a-friend. *Ship: publicly launchable.*

## 8. Definition of done (per phase)

- `pnpm typecheck` clean across all packages
- `pnpm test` (Vitest) — `packages/core` ≥ 80% coverage; `packages/extractors/banks/*.ts` tested with real PDF fixtures (not committed; pulled from S3 by CI)
- Lighthouse ≥ 95 a11y on Home, Transactions, Login
- Playwright E2E happy-path: signup → upload sample CSV → see categorized txns → ask one question → see insight (gates each PR)
- No `console.error` in browser during happy-path
- Bundle < 250 kB gzipped JS per route
- Cost guard: agent calls cost-capped per user per day (hard limit + soft warning)

## 9. Risks

| Risk | Mitigation |
|---|---|
| Plaid SOC2/MSA review takes 4-8 weeks for production access | Apply at start of Phase 0. Until approved: sandbox-only in dev; ship Phase 4 with "Bank connections coming soon" if needed and unlock when approved. |
| PDF format zoo — every bank's statement is different | Translate Python parsers verbatim with the same fixture PDFs as test inputs. Don't try to be clever. |
| Agent hallucinates a tool result | Tool outputs always include raw count + the SQL/filter used; agent quotes them in the response with a `Source` link to underlying transactions. |
| Cost runaway on Claude | Per-user daily cap, prompt caching always on, Haiku for low-stakes calls, agent read-tool result caching (60s). |
| Single-dev velocity | Phases 1-2 deliver a usable single-player local app; 3-5 add the SaaS skin. If timeline slips, stop after Phase 2 — you still have a real app. |

## 10. Out of scope (deferred)

Investment tracking, crypto wallets, bill pay, native iOS/Android, public sharing, receipt OCR as a first-class flow, light mode (v1.1), local-LLM-only mode (v2), magic-link auth (v1.1), multi-user/RBAC (seam built, UI v2).

## 11. Files this design replaces

- `PERFIN_REDESIGN_PLAN.md` — superseded
- `DESIGN.md` — superseded
- `ai_accountant/` — entire directory removed in Phase 0
- `ai_accountant_node/` — replaced by `apps/worker/` and `packages/extractors/`, code patterns reused
- `ai_accountant_react/` — replaced by `apps/web/`, hooks/types reused as starting points
- `ai_accountant_skill_review_iter1.html` — removed
- `tailwind.theme.json`, `tokens.json` — replaced by `packages/ui/tokens.css`
