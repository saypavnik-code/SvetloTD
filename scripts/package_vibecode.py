#!/usr/bin/env python3
"""Archive the built game and the minimal Vibe static server for authenticated deploy."""
from pathlib import Path
import tarfile

root = Path(__file__).resolve().parents[1]
assert (root / 'dist/index.html').is_file(), 'Run npm run build first'
archive = root / 'vibecode-bundle.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    tar.add(root / 'deploy/vibecode/server.mjs', arcname='server.mjs')
    tar.add(root / 'dist', arcname='dist')
print(f'Created {archive.name}')
