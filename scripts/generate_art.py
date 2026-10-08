#!/usr/bin/env python3
"""Generate 40x40 deterministic PNG terrain textures without external libraries."""
from pathlib import Path
import random
import struct
import zlib

SIZE = 40
OUT = Path(__file__).resolve().parents[1] / 'public/assets/tiles'


def png(rows: list[bytes], *, alpha: bool = False) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)
    raw = b''.join(b'\x00' + row for row in rows)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6 if alpha else 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def color(base: tuple[int, int, int], variance: int) -> bytes:
    return bytes(max(0, min(255, value + variance)) for value in base)


def texture(name: str, base: tuple[int, int, int], salt: int) -> None:
    rng = random.Random(salt)
    rows = []
    for y in range(SIZE):
        pixels = []
        for x in range(SIZE):
            noise = rng.randint(-11, 11)
            if name == 'grass':
                noise += 6 if (x + y * 2) % 13 < 3 else 0
                base_color = (46, 55, 43)
            elif name == 'path':
                noise += 5 if y % 9 in (0, 1) else 0
                base_color = (137, 115, 80)
            else:
                base_color = base
                noise = noise // 3
                if 11 < x < 29 and 11 < y < 29:
                    base_color = (163, 119, 51)
                if abs(x - SIZE//2) + abs(y - SIZE//2) < 8:
                    base_color = (230, 176, 75)
            pixels.append(color(base_color, noise))
        rows.append(b''.join(pixels))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / (name + '.png')).write_bytes(png(rows))


if __name__ == '__main__':
    texture('grass', (46, 55, 43), 10)
    texture('path', (137, 115, 80), 20)
    texture('base', (130, 91, 42), 30)

    # Readable top-down silhouette concepts, reproducibly generated from primitives.
    # Gameplay currently draws equivalent vector silhouettes; these assets are
    # replacements for the later sprite animation/atlas pipeline.
    sprite_defs = {
        'tower_arrow': ('tower', (187, 132, 39), (60, 43, 24)),
        'tower_cannon': ('tower', (112, 96, 83), (39, 35, 33)),
        'tower_magic': ('tower', (222, 173, 77), (90, 58, 80)),
        'tower_slow': ('tower', (95, 160, 175), (40, 65, 79)),
        'tower_acid': ('tower', (116, 156, 94), (48, 80, 48)),
        'tower_watchtower': ('tower', (194, 160, 87), (73, 63, 41)),
        'enemy_grunt': ('enemy', (111, 77, 51), (40, 31, 24)),
        'enemy_runner': ('enemy', (50, 117, 85), (23, 54, 41)),
        'enemy_golem': ('enemy', (111, 82, 62), (43, 37, 30)),
        'enemy_wyvern': ('enemy', (91, 86, 144), (40, 36, 71)),
        'enemy_boss': ('enemy', (119, 68, 54), (38, 21, 16)),
        'hero': ('hero', (246, 178, 80), (98, 63, 35)),
    }
    for name, (kind, main, edge) in sprite_defs.items():
        pixels = [[(0, 0, 0) for _ in range(SIZE)] for _ in range(SIZE)]
        for y in range(SIZE):
            for x in range(SIZE):
                dx, dy = x - 19.5, y - 19.5
                ax, ay = abs(dx), abs(dy)
                if kind == 'tower':
                    inside = max(ax, ay) <= 14
                    border = max(ax, ay) >= 11
                    highlight = ax <= 4 and ay <= 7
                elif kind == 'enemy':
                    inside = dx*dx + dy*dy <= 15*15
                    border = dx*dx + dy*dy >= 12*12
                    highlight = (y in (13, 14) and x in range(10, 14)) or (y in (13, 14) and x in range(26, 30))
                else:
                    inside = ay <= 15 and ax <= 15 - max(0, -dy)//2
                    border = ax >= 10 or ay >= 12
                    highlight = ay < 5 and ax < 5
                if inside:
                    pixels[y][x] = edge if border else ((250, 222, 141) if highlight else main)
        # Transparent areas preserve readability on every board terrain tile.
        rows = [b''.join(bytes((*rgb, 255 if rgb != (0, 0, 0) else 0)) for rgb in row) for row in pixels]
        dst = Path(__file__).resolve().parents[1] / 'public/assets/sprites' / (name + '.png')
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(png(rows, alpha=True))
    print('Generated 3 terrain textures and 12 prototype character/tower sprites')
