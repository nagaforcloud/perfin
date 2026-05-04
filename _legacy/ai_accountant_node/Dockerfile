# ─── Node Backend (Fastify API) ─────────────────────────────────────────────
FROM node:20-slim

# Python for the PDF extraction sidecar
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node deps first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy application code
COPY . .

EXPOSE 8001

# Default: start the dev server
CMD ["npx", "tsx", "src/server.ts"]
