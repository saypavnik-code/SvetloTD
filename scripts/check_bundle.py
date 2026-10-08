#!/usr/bin/env python3
"""Project-defined performance budget, NOT a claimed VK platform size limit."""
import os
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
build = root / 'dist'
if not build.is_dir() or not (build / 'index.html').is_file():
    sys.exit('FAIL: dist/index.html missing')
size = sum(p.stat().st_size for p in build.rglob('*') if p.is_file())
limit_mb = float(os.environ.get('PROJECT_BUNDLE_BUDGET_MB', '30'))
print(f'Build size: {size / 1024**2:.2f} MiB; project budget: {limit_mb:.1f} MiB')
if size > limit_mb * 1024**2:
    sys.exit('FAIL: project bundle budget exceeded')
