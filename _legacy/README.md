# PerFin — Personal Finance Dashboard

> Smart personal finance tracking with automated transaction categorization and LLM-powered insights. Glassmorphism dark UI in a 3-layer monorepo.

## Architecture

```
┌─────────────────────────────────────────┐
│  React 19 (Vite)         port 5173      │  Frontend
│  Glassmorphism dark fintech UI           │
├─────────────────────────────────────────┤
│  Node Fastify             port 8001     │  API Gateway
│  File extraction, auth, routing          │  (proxies analytics)
├─────────────────────────────────────────┤
│  Python Tornado           port 8000     │  Core Engine
│  Pipeline, LLM, anomaly detection        │
└─────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| API Gateway | Node.js, Fastify, TypeScript |
| Core Engine | Python 3.11, Tornado |
| Database | SQLite |
| AI | LLM-powered categorization, anomaly detection |
| Ops | Docker Compose, Docker |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local dev)
- Python 3.11+ (for local dev)

### Run with Docker

```bash
docker compose up -d
```

Services start on:
- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:8001
- **Core Engine**: http://localhost:8000

### Local Development

**Python core:**
```bash
cd ai_accountant
pip install -r requirements.txt
python start_server.py
```

**Node API:**
```bash
cd ai_accountant_node
npm install
npm run dev
```

**React frontend:**
```bash
cd ai_accountant_react
npm install
npm run dev
```

## Features

- **Multi-format import**: CSV, Excel, OFX, QIF, PDF (with OCR)
- **LLM-powered categorization**: Automatic transaction classification
- **Recurring transaction detection**: Identify subscriptions and bills
- **Anomaly detection**: Flag unusual spending patterns
- **Multi-account support**: Track checking, savings, credit cards
- **Budget tracking**: Set and monitor spending limits
- **Financial summaries**: Income, expenses, net worth over time
- **Export**: Excel reports for external use

## Dashboard Modules

- Net worth sparkline with animated counters
- Category breakdown (donut chart)
- Monthly income vs expenses (grouped bar)
- Top spending categories (horizontal bars)
- Savings rate trend (line chart)
- Month-grouped transaction list

## Design System

- **Background**: `#0F172A` (slate-900)
- **Primary**: `#1E40AF` (blue-800)
- **Accent**: `#059669` (emerald-600)
- **Font**: Plus Jakarta Sans
- **Style**: Glassmorphism dark fintech

## Project Structure

```
perfin/
├── ai_accountant/          # Python Tornado core
│   ├── api/                # REST endpoints
│   ├── core/               # Business logic, pipeline, LLM
│   ├── scripts/            # Extraction, categorization scripts
│   ├── database/           # SQLite ledger
│   └── tests/              # pytest suite
├── ai_accountant_node/     # Node Fastify API gateway
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   └── extractors/     # File parsing (CSV, Excel, PDF)
│   └── sidecar/            # Python PDF extraction
├── ai_accountant_react/    # React 19 frontend
│   ├── src/
│   │   ├── components/     # UI, charts, layout
│   │   ├── pages/          # Dashboard, accounts, analytics
│   │   ├── hooks/          # Custom data hooks
│   │   └── store/          # Zustand state management
│   └── public/             # Static assets
├── docs/                   # Design specs and plans
├── scripts/                # Setup and utility scripts
└── docker-compose.yml      # Container orchestration
```

## License

MIT
