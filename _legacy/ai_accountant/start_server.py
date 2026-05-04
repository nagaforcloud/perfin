#!/usr/bin/env python3
"""
AI Accountant — server entry point.

Usage:
    python start_server.py [--port 8000]

Opens: http://localhost:8000
"""

import argparse
import sys
from pathlib import Path

# Ensure the project root is on the path
ROOT = Path(__file__).resolve().parent
for p in [str(ROOT), str(ROOT.parent)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from api.server import run

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Accountant web server")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    args = parser.parse_args()

    print(f"\n  AI Accountant  →  http://localhost:{args.port}\n")
    run(port=args.port)
