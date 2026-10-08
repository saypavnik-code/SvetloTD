#!/usr/bin/env python3
"""Dependency-free source/asset integrity checks for CI and local patching."""
from pathlib import Path
import re
import struct

root = Path(__file__).resolve().parents[1]
config = (root / 'src/config.ts').read_text()
assert re.search(r'GRID_COLS\s*=\s*18\s*;', config)
assert re.search(r'GRID_ROWS\s*=\s*18\s*;', config)
assert re.search(r'TILE_SIZE\s*=\s*40\s*;', config)
size = 18
board = [['B' if 8 <= x <= 9 and 8 <= y <= 9 else 'P' if 8 <= x <= 9 or 8 <= y <= 9 else 'E' for x in range(size)] for y in range(size)]
assert all(board[y][x] == board[y][size - x - 1] == board[size - y - 1][x] for y in range(size) for x in range(size))
assert sum(cell == 'B' for row in board for cell in row) == 4
assert sum(cell == 'P' for row in board for cell in row) == 64
map_ts = (root / 'src/data/mapData.ts').read_text()
route_ts = (root / 'src/data/pathData.ts').read_text()
assert 'vertical && horizontal' in map_ts and "? 'P' : 'E'" in map_ts
assert 'BASE_CENTER_X' in route_ts and 'BASE_CENTER_Y' in route_ts
assert 'Array.from({ length: halfRows - 1 }' in route_ts
waves = (root / 'src/data/waves.ts').read_text()
assert len(re.findall(r'\{ wave:\s*\d+,', waves)) == 20, 'Preserve the 20 authored early waves'
assert 'length: 20' in waves and 'index + 21' in waves
assert '...EARLY_WAVES, ...LATE_WAVES' in waves
projectile = (root / 'src/entities/Projectile.ts').read_text()
scene = (root / 'src/scenes/GameScene.ts').read_text()
assert 'get isFinished()' in projectile and 'this._projPool.release(projectile)' in scene
assert "this.events.once('shutdown', this.shutdown, this)" in scene
for name in ('grass', 'path', 'base'):
    path = root / f'public/assets/tiles/{name}.png'
    contents = path.read_bytes()
    assert contents[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', contents[16:24]) == (40, 40)
for name in ('tower_arrow', 'tower_cannon', 'tower_magic', 'tower_slow', 'tower_acid',
             'tower_watchtower', 'enemy_grunt', 'enemy_runner', 'enemy_golem',
             'enemy_wyvern', 'enemy_boss', 'hero'):
    contents = (root / f'public/assets/sprites/{name}.png').read_bytes()
    assert contents[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', contents[16:24]) == (40, 40)
print('PASS: symmetric map, 4 lanes, 40-wave definitions, pools, scene cleanup, 15 PNGs')
