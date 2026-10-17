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
def rotate(cell, turns):
    row, col = cell
    for _ in range(turns):
        row, col = col, size - 1 - row
    return (row, col)
ring_lo, ring_hi, spur_row = 2, size - 3, 8
route = ([(ring_lo, c) for c in range(ring_lo, ring_hi + 1)] + [(r, ring_hi) for r in range(ring_lo + 1, ring_hi + 1)]
         + [(ring_hi, c) for c in range(ring_hi - 1, ring_lo - 1, -1)] + [(r, ring_lo) for r in range(ring_hi - 1, spur_row - 1, -1)]
         + [(spur_row, c) for c in range(ring_lo + 1, 8)])
roads = {rotate(cell, turns) for turns in range(4) for cell in route}
board = [['B' if 8 <= x <= 9 and 8 <= y <= 9 else 'P' if (y, x) in roads else 'E' for x in range(size)] for y in range(size)]
assert all(board[y][x] == board[x][size - 1 - y] for y in range(size) for x in range(size)), 'rotation symmetry'
assert sum(cell == 'B' for row in board for cell in row) == 4
assert sum(cell == 'P' for row in board for cell in row) == 72
map_ts = (root / 'src/data/mapData.ts').read_text()
route_ts = (root / 'src/data/pathData.ts').read_text()
assert 'SPAWN_ROUTES' in map_ts and 'rotateCell' in map_ts and 'RING_INSET' in map_ts
assert 'BASE_CENTER_X' in route_ts and 'BASE_CENTER_Y' in route_ts and 'routeSuffixLengths' in route_ts
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
print('PASS: square rotation-symmetric map, 4 spawn routes, 40-wave definitions, pools, scene cleanup, 15 PNGs')
