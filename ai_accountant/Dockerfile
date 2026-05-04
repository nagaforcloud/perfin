# ─── Python Backend + React SPA ─────────────────────────────────────────────
# Stage 1: Build React frontend
FROM node:20-slim AS react-builder
WORKDIR /react
COPY ../ai_accountant_react/package.json ../ai_accountant_react/package-lock.json ./
RUN npm ci
COPY ../ai_accountant_react/ .
RUN npm run build

# Stage 2: Python API
FROM python:3.11-slim

# System deps for pdfplumber, camelot, and OCR (Phase 4 ready)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ghostscript \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Copy React build output into web/ for static serving
COPY --from=react-builder /react/dist ./web

# Create data directories
RUN mkdir -p data/pdf data/processed data/reports database

EXPOSE 8000

# Default: start the REST API server (serves React SPA at /)
CMD ["python", "start_server.py"]
