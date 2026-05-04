#!/usr/bin/env bash
# ─── PerFin Setup Script ─────────────────────────────────────────────────────
# One-command bootstrap. Idempotent — safe to run multiple times.
set -euo pipefail
cd "$(dirname "$0")"

echo "╔══════════════════════════════════════╗"
echo "║     PerFin — Setup & Launch          ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── 1. Environment ──────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "→ Creating .env from .env.example..."
  cp .env.example .env
  echo "  Done. Edit .env to configure ports and API key."
else
  echo "→ .env already exists, skipping."
fi

# ─── 2. Database ─────────────────────────────────────────────────────────────
DB_DIR="./ai_accountant/database"
if [ ! -f "$DB_DIR/ledger.db" ]; then
  echo "→ No database found. It will be created on first Docker launch."
else
  echo "→ Existing database found at $DB_DIR/ledger.db"
fi

# ─── 3. PDF upload directory ─────────────────────────────────────────────────
mkdir -p ./ai_accountant/data/pdf ./ai_accountant/data/processed ./ai_accountant/data/reports
echo "→ Data directories ready."

# ─── 4. LLM Model (optional) ─────────────────────────────────────────────────
MODEL_DIR="./models"
if [ -n "${LLM_MODEL_PATH:-}" ]; then
  MODEL_DIR="$LLM_MODEL_PATH"
fi
if [ -d "$MODEL_DIR" ] && ls "$MODEL_DIR"/*.gguf >/dev/null 2>&1; then
  echo "→ LLM model(s) found in $MODEL_DIR"
else
  echo "→ No .gguf model found in $MODEL_DIR"
  echo "  To use LLM categorization, download a model and place it in $MODEL_DIR/"
  echo "  Example: wget -P $MODEL_DIR/ https://huggingface.co/.../model.gguf"
  echo "  Starting without LLM — rule-based categorization still works."
fi

# ─── 5. Launch ───────────────────────────────────────────────────────────────
echo ""
echo "→ Building and starting containers..."
docker compose up -d --build

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  PerFin is running!                  ║"
echo "║                                      ║"
echo "║  Web UI:  http://localhost:${PYTHON_PORT:-8000}        ║"
echo "║  Node API: http://localhost:${NODE_PORT:-8001}/api/health ║"
echo "║                                      ║"
echo "║  docker compose logs -f   (view logs)║"
echo "║  docker compose down       (stop)    ║"
echo "╚══════════════════════════════════════╝"
