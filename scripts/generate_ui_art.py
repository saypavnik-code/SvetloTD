#!/usr/bin/env python3
"""Generate the interface icons and terrain tiles (Pillow, supersampled, deterministic).

Writes public/assets/ui/*.png (HUD icons, tower medallions) and public/assets/tiles/{grass_a-d,path_a-c}.png.
Run: python3 scripts/generate_ui_art.py   (needs Pillow; the PNGs are committed, so the game never needs this at runtime)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
UI = ROOT / 'public' / 'assets' / 'ui'
TILES = ROOT / 'public' / 'assets' / 'tiles'
S = 4  # supersampling

CREAM, AMBER, AMBER_DEEP, WALNUT, WALNUT_LIGHT = (243, 227, 188), (232, 169, 59), (138, 90, 28), (28, 22, 17), (74, 58, 40)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lighten(c, t):
    return lerp(c, (255, 255, 255), t)


def darken(c, t):
    return lerp(c, (0, 0, 0), t)


def layer(size):
    img = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def P(points):
    return [(x * S, y * S) for x, y in points]


def finish(img, size):
    return img.resize((size, size), Image.LANCZOS)


def radial_disc(d, cx, cy, r, inner, outer):
    for i in range(r * S, 0, -1):
        t = 1 - i / (r * S)
        d.ellipse([(cx * S - i), (cy * S - i), (cx * S + i), (cy * S + i)], fill=lerp(outer, inner, t ** 0.8) + (255,))


def rot_rect(cx, cy, length, width, ang):
    c, s = math.cos(ang), math.sin(ang)
    pts = [(-length / 2, -width / 2), (length / 2, -width / 2), (length / 2, width / 2), (-length / 2, width / 2)]
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in pts]


# ── glyphs (96x96 space) ────────────────────────────────────────────────────

def g_arrow(d):
    d.arc([x * S for x in (20, 18, 80, 78)], 200, 340, fill=CREAM + (255,), width=4 * S)
    d.line(P([(30, 68), (68, 28)]), fill=CREAM + (255,), width=4 * S)
    d.polygon(P([(76, 20), (60, 26), (70, 36)]), fill=lighten(AMBER, .35) + (255,))
    for off in ((0, 0), (6, 6)):
        d.polygon(P([(24 + off[0], 74 + off[1]), (28 + off[0], 62 + off[1]), (38 + off[0], 70 + off[1])]), fill=CREAM + (255,))


def g_cannon(d):
    d.polygon(P(rot_rect(52, 46, 46, 18, -0.5)), fill=(70, 58, 52, 255))
    d.polygon(P(rot_rect(52, 44, 44, 6, -0.5)), fill=(150, 130, 118, 255))
    d.ellipse(P([(66, 24), (80, 38)]), fill=(40, 32, 28, 255))
    d.ellipse([x * S for x in (24, 50, 50, 76)], fill=(110, 78, 44, 255), outline=(40, 28, 16, 255), width=2 * S)
    d.ellipse([x * S for x in (33, 59, 41, 67)], fill=CREAM + (255,))
    d.ellipse([x * S for x in (60, 62, 72, 74)], fill=(34, 30, 28, 255))


def g_magic(d):
    d.polygon(P([(48, 16), (66, 42), (48, 78), (30, 42)]), fill=lighten((150, 90, 210), .25) + (255,))
    d.polygon(P([(48, 16), (66, 42), (48, 48)]), fill=lighten((190, 140, 240), .3) + (255,))
    d.polygon(P([(48, 48), (66, 42), (48, 78)]), fill=(104, 58, 168, 255))
    d.polygon(P([(30, 42), (48, 48), (48, 78)]), fill=(128, 76, 196, 255))
    d.polygon(P([(76, 18), (78, 26), (86, 28), (78, 30), (76, 38), (74, 30), (66, 28), (74, 26)]), fill=CREAM + (255,))


def g_slow(d):
    for k in range(4):
        a = k * math.pi / 2 + 0.5
        d.polygon(P([(48 + math.cos(a) * 4, 42 + math.sin(a) * 4), (48 + math.cos(a - .28) * 30, 42 + math.sin(a - .28) * 30),
                     (48 + math.cos(a + .1) * 32, 42 + math.sin(a + .1) * 32)]), fill=CREAM + (255,))
    d.polygon(P([(40, 78), (56, 78), (52, 48), (44, 48)]), fill=(150, 124, 92, 255))
    d.ellipse(P([(43, 37), (53, 47)]), fill=AMBER + (255,), outline=(60, 44, 24, 255), width=S)


def g_acid(d):
    d.rectangle(P([(41, 20), (55, 36)]), fill=(200, 215, 205, 255))
    d.ellipse(P([(26, 34), (70, 80)]), fill=(70, 120, 70, 255))
    mask = Image.new('L', (96 * S, 96 * S), 0)
    ImageDraw.Draw(mask).ellipse(P([(26, 34), (70, 80)]), fill=255)
    liquid = Image.new('RGBA', (96 * S, 96 * S), (0, 0, 0, 0))
    ImageDraw.Draw(liquid).rectangle(P([(20, 54), (76, 84)]), fill=(150, 220, 90, 255))
    d._image.paste(liquid, (0, 0), Image.composite(mask, Image.new('L', mask.size, 0), liquid.split()[3]))
    d.ellipse(P([(34, 44), (40, 50)]), fill=(255, 255, 255, 150))
    for bx, by, br in ((46, 62, 3), (56, 68, 2), (40, 70, 2)):
        d.ellipse(P([(bx - br, by - br), (bx + br, by + br)]), fill=(235, 255, 205, 255))
    d.rectangle(P([(38, 18), (58, 22)]), fill=(120, 84, 50, 255))


def g_guard(d):
    d.polygon(P([(28, 22), (68, 22), (68, 50), (48, 76), (28, 50)]), fill=lighten(AMBER, .1) + (255,), outline=(90, 58, 20, 255))
    d.polygon(P([(34, 28), (62, 28), (62, 49), (48, 68), (34, 49)]), fill=AMBER_DEEP + (255,))
    d.ellipse(P([(40, 36), (56, 52)]), fill=CREAM + (255,))
    for k in range(8):
        a = k * math.pi / 4
        d.line(P([(48 + math.cos(a) * 10, 44 + math.sin(a) * 10), (48 + math.cos(a) * 14, 44 + math.sin(a) * 14)]), fill=CREAM + (255,), width=2 * S)


def medallion(glyph, tint):
    size = 96
    img, d = layer(size)
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([6 * S, 10 * S, 90 * S, 94 * S], fill=(0, 0, 0, 120))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3 * S)))
    d = ImageDraw.Draw(img)
    d.ellipse([4 * S, 4 * S, 92 * S, 92 * S], fill=AMBER_DEEP + (255,))
    d.ellipse([6 * S, 6 * S, 90 * S, 90 * S], fill=lighten(AMBER, .15) + (255,))
    d.ellipse([10 * S, 10 * S, 86 * S, 86 * S], fill=darken(AMBER_DEEP, .45) + (255,))
    radial_disc(d, 48, 48, 35, lighten(tint, .25), darken(tint, .55))
    glyph(d.__class__(img) if False else _bind(d, img))
    hl = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([16 * S, 12 * S, 80 * S, 46 * S], fill=(255, 255, 255, 38))
    img.alpha_composite(hl)
    return finish(img, size)


class _bind:
    """ImageDraw proxy that remembers its image (the acid glyph pastes a masked layer)."""
    def __init__(self, d, img):
        self._d, self._image = d, img

    def __getattr__(self, name):
        return getattr(self._d, name)


# ── HUD icons (64x64) ───────────────────────────────────────────────────────

def icon_heart():
    img, d = layer(64)
    shape = [(32, 56), (8, 32), (8, 20), (16, 10), (26, 10), (32, 18), (38, 10), (48, 10), (56, 20), (56, 32)]
    d.polygon(P(shape), fill=(120, 24, 28, 255))
    d.ellipse(P([(8, 8), (34, 34)]), fill=(214, 64, 64, 255)); d.ellipse(P([(30, 8), (56, 34)]), fill=(214, 64, 64, 255))
    d.polygon(P([(9, 26), (55, 26), (32, 56)]), fill=(214, 64, 64, 255))
    d.ellipse(P([(14, 13), (24, 22)]), fill=(255, 190, 190, 200))
    return finish(img, 64)


def icon_gold():
    img, d = layer(64)
    d.polygon(P([(32, 4), (56, 28), (32, 60), (8, 28)]), fill=AMBER_DEEP + (255,))
    d.polygon(P([(32, 8), (52, 28), (32, 54), (12, 28)]), fill=AMBER + (255,))
    d.polygon(P([(32, 8), (52, 28), (32, 30)]), fill=lighten(AMBER, .5) + (255,))
    d.polygon(P([(12, 28), (32, 30), (32, 54)]), fill=darken(AMBER, .18) + (255,))
    return finish(img, 64)


def icon_lumber():
    img, d = layer(64)
    d.rounded_rectangle(P([(6, 22), (50, 46)]), radius=4 * S, fill=(120, 80, 44, 255))
    d.rectangle(P([(10, 26), (46, 29)]), fill=(150, 108, 62, 255))
    d.ellipse(P([(38, 18), (62, 50)]), fill=(96, 62, 34, 255))
    d.ellipse(P([(42, 22), (58, 46)]), fill=(214, 170, 108, 255))
    d.ellipse(P([(47, 29), (53, 39)]), outline=(150, 104, 58, 255), width=S)
    return finish(img, 64)


# ── terrain (80x80, seamless) ───────────────────────────────────────────────

def wrap(draw_fn):
    for dx in (-80, 0, 80):
        for dy in (-80, 0, 80):
            draw_fn(dx, dy)


def grass(seed, flowers):
    rnd = random.Random(seed)
    img = Image.new('RGB', (80, 80), (44, 70, 40))
    px = img.load()
    for y in range(80):
        for x in range(80):
            j = rnd.randint(-5, 5)
            px[x, y] = (44 + j, 70 + j + 2, 40 + j)
    d = ImageDraw.Draw(img, 'RGBA')
    for _ in range(5):
        cx, cy, rx, ry = rnd.randint(0, 80), rnd.randint(0, 80), rnd.randint(10, 22), rnd.randint(8, 16)
        col = rnd.choice(((60, 92, 52, 40), (30, 52, 30, 46)))
        wrap(lambda dx, dy: d.ellipse([cx - rx + dx, cy - ry + dy, cx + rx + dx, cy + ry + dy], fill=col))
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    d = ImageDraw.Draw(img, 'RGBA')
    for _ in range(70):
        x, y, ln, a = rnd.randint(0, 79), rnd.randint(0, 79), rnd.randint(3, 7), rnd.uniform(-2.2, -0.9)
        col = rnd.choice(((86, 124, 66, 210), (60, 100, 52, 210), (30, 54, 30, 200), (110, 146, 78, 170)))
        wrap(lambda dx, dy: d.line([(x + dx, y + dy), (x + dx + math.cos(a) * ln, y + dy + math.sin(a) * ln)], fill=col, width=1))
    if flowers:
        for _ in range(2):
            x, y = rnd.randint(12, 68), rnd.randint(12, 68)
            col = rnd.choice(((240, 236, 210, 255), (232, 169, 59, 255), (190, 150, 230, 255)))
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=col)
            d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(250, 214, 80, 255))
    return img.convert('RGBA')


def path(seed):
    rnd = random.Random(seed)
    img = Image.new('RGB', (80, 80), (58, 44, 28))
    d = ImageDraw.Draw(img, 'RGBA')
    rows = ((0, 26, 0), (26, 54, 20), (54, 80, 0))
    for y0, y1, off in rows:
        x = off - 40
        while x < 80 + 40:
            w = 40 if rnd.random() < .5 else 40
            j = rnd.randint(-9, 9)
            base = (142 + j, 114 + j, 80 + j // 2)
            box = [x + 2, y0 + 2, x + w - 2, y1 - 2]
            wrap(lambda dx, dy, base=base, box=box: (
                d.rounded_rectangle([box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy], radius=6, fill=base),
                d.line([(box[0] + dx + 4, box[1] + dy + 1), (box[2] + dx - 4, box[1] + dy + 1)], fill=lighten(base, .22), width=1),
                d.line([(box[0] + dx + 4, box[3] + dy - 1), (box[2] + dx - 4, box[3] + dy - 1)], fill=darken(base, .3), width=1)))
            x += w
    img = img.filter(ImageFilter.GaussianBlur(.5))
    px = img.load()
    for y in range(80):
        for x in range(80):
            j = rnd.randint(-5, 5)
            r, g, b = px[x, y]
            px[x, y] = (max(0, min(255, r + j)), max(0, min(255, g + j)), max(0, min(255, b + j)))
    return img.convert('RGBA')


def main():
    UI.mkdir(parents=True, exist_ok=True)
    TILES.mkdir(parents=True, exist_ok=True)
    tints = {'arrow': (212, 149, 42), 'cannon': (140, 82, 52), 'magic': (150, 100, 220), 'slow': (70, 150, 170),
             'acid': (96, 160, 80), 'watchtower': (214, 170, 80)}
    glyphs = {'arrow': g_arrow, 'cannon': g_cannon, 'magic': g_magic, 'slow': g_slow, 'acid': g_acid, 'watchtower': g_guard}
    for name, fn in glyphs.items():
        medallion(fn, tints[name]).save(UI / f'tw_{name}.png', optimize=True)
    icon_heart().save(UI / 'icon_heart.png', optimize=True)
    icon_gold().save(UI / 'icon_gold.png', optimize=True)
    icon_lumber().save(UI / 'icon_lumber.png', optimize=True)
    for i, flowers in enumerate((False, False, False, True)):
        grass(100 + i, flowers).save(TILES / f'grass_{"abcd"[i]}.png', optimize=True)
    for i in range(3):
        path(200 + i).save(TILES / f'path_{"abc"[i]}.png', optimize=True)
    print('wrote', len(list(UI.glob('*.png'))), 'ui icons and 7 tiles')


if __name__ == '__main__':
    main()
