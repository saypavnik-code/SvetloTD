#!/usr/bin/env python3
"""Generate the tower, enemy and hero sprites (Pillow, 4x supersampling, deterministic).

Writes public/assets/art/<name>.png (128x128, transparent, outlined, facing right where it matters).
Run: python3 scripts/generate_sprite_art.py   (needs Pillow; the PNGs are committed)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'art'
W, S = 128, 4
INK = (26, 18, 12)
AMBER, GOLD = (232, 169, 59), (250, 210, 110)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def light(c, t):
    return lerp(c, (255, 255, 255), t)


def dark(c, t):
    return lerp(c, (0, 0, 0), t)


def canvas(size=W):
    return Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))


def sc(pts):
    return [(x * S, y * S) for x, y in pts]


def paint(img, shape, c1, c2, axis='x', profile='lin'):
    """Fill `shape` (a callback drawing white on an L mask) with a gradient over its bounding box."""
    m = Image.new('L', img.size, 0)
    shape(ImageDraw.Draw(m))
    bb = m.getbbox()
    if not bb:
        return
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    g = Image.linear_gradient('L')
    g = (g if axis == 'y' else g.transpose(Image.Transpose.ROTATE_90)).resize((w, h))
    if profile == 'tri':
        g = g.point(lambda v: 255 - abs(v - 127) * 2)
    col = Image.composite(Image.new('RGBA', (w, h), c2 + (255,)), Image.new('RGBA', (w, h), c1 + (255,)), g)
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    layer.paste(col, (bb[0], bb[1]))
    img.paste(layer, (0, 0), m)


def poly(pts):
    return lambda d: d.polygon(sc(pts), fill=255)


def ell(x0, y0, x1, y1):
    return lambda d: d.ellipse([x0 * S, y0 * S, x1 * S, y1 * S], fill=255)


def rrect(x0, y0, x1, y1, r=3):
    return lambda d: d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=r * S, fill=255)


def rot_rect(cx, cy, length, width, ang):
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in
            ((-length / 2, -width / 2), (length / 2, -width / 2), (length / 2, width / 2), (-length / 2, width / 2))]


def lines(img, pts, color, width=1.5):
    ImageDraw.Draw(img, 'RGBA').line(sc(pts), fill=color, width=max(1, int(width * S)), joint='curve')


def dots(img, items):
    d = ImageDraw.Draw(img, 'RGBA')
    for x, y, r, col in items:
        d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=col)


def glow(img, x, y, r, color, alpha=150):
    n = img.size[0] // S
    r = min(r, min(x, y, n - x, n - y) / 1.25)   # keep the halo inside the canvas, never clipped at the edge
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=color + (alpha,))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(r * S * 0.45)))


def bricks(img, x0, y0, x1, y1, step=8, col=(0, 0, 0, 55)):
    d = ImageDraw.Draw(img, 'RGBA')
    for row, y in enumerate(range(y0 + step, y1, step)):
        d.line([((x0 + 2) * S, y * S), ((x1 - 2) * S, y * S)], fill=col, width=S)
        for x in range(x0 + 4 + (6 if row % 2 else 0), x1 - 2, 12):
            d.line([(x * S, (y - step) * S), (x * S, y * S)], fill=col, width=S)


def cyl(img, x0, y0, x1, y1, edge, mid, r=3):
    paint(img, rrect(x0, y0, x1, y1, r), edge, mid, 'x', 'tri')


def cone(img, cx, apex, base, hw, edge, mid):
    paint(img, poly([(cx, apex), (cx + hw, base), (cx - hw, base)]), edge, mid, 'x', 'tri')
    paint(img, ell(cx - hw - 3, base - 5, cx + hw + 3, base + 5), dark(edge, .2), mid, 'x', 'tri')


def merlons(img, x0, x1, y, n, color):
    w = (x1 - x0) / (2 * n - 1)
    for i in range(n):
        paint(img, rrect(x0 + i * 2 * w, y - 7, x0 + i * 2 * w + w, y + 2, 1), dark(color, .2), color, 'x', 'tri')


def flag(img, x, y, color):
    lines(img, [(x, y), (x, y - 16)], (70, 52, 36, 255), 1.6)
    paint(img, poly([(x, y - 16), (x + 14, y - 12), (x, y - 7)]), dark(color, .25), color, 'x')


def outlined(img, px=2.4):
    k = int(px * 2 * S) | 1
    dil = img.split()[3].filter(ImageFilter.MaxFilter(k))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(Image.new('RGBA', img.size, INK + (255,)), (0, 0), dil)
    out.alpha_composite(img)
    return out


def done(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    n = img.size[0] // S
    outlined(img).resize((n, n), Image.LANCZOS).save(OUT / f'{name}.png', optimize=True)


STONE, STONE_D = (176, 164, 142), (104, 94, 80)

# ── towers ──────────────────────────────────────────────────────────────────

def arrow(t2):
    im = canvas()
    if t2:
        glow(im, 64, 70, 40, (90, 170, 220), 70)
    top = 46 if t2 else 58
    cyl(im, 38, top, 90, 114, STONE_D, STONE)
    bricks(im, 38, top, 90, 114)
    paint(im, rrect(56, 94, 72, 114, 8), (50, 34, 22), (96, 66, 40), 'x', 'tri')
    paint(im, rrect(61, top + 16, 67, top + 34, 2), (20, 14, 10), (60, 44, 30), 'x')
    roof = ((70, 140, 176), (116, 190, 224)) if t2 else ((150, 58, 40), (212, 104, 62))
    merlons(im, 34, 94, top + 2, 4, STONE)
    cone(im, 64, 10 if t2 else 16, top - 4, 40, *roof)
    if t2:
        lines(im, [(52, 70), (62, 62), (58, 72), (72, 60)], GOLD + (255,), 2.2)
        glow(im, 62, 66, 8, GOLD, 120)
        flag(im, 64, 14, AMBER)
    else:
        flag(im, 64, 20, AMBER)
    return im


def cannon(t2):
    im = canvas()
    if t2:
        glow(im, 70, 56, 36, (230, 60, 40), 90)
    cyl(im, 22, 68, 106, 114, dark(STONE_D, .1), STONE_D, 5)
    bricks(im, 22, 68, 106, 114)
    merlons(im, 20, 108, 70, 5, (120, 108, 92))
    barrel = rot_rect(70, 52, 58 if t2 else 50, 24 if t2 else 20, -0.95)
    paint(im, lambda d: d.polygon(sc(barrel), fill=255), (44, 40, 40), (122, 116, 118), 'y', 'tri')
    mx, my = 70 + math.cos(-0.95) * 29, 52 + math.sin(-0.95) * 29
    paint(im, ell(mx - 13, my - 9, mx + 13, my + 9), (24, 20, 20), (84, 78, 80), 'x', 'tri')
    paint(im, ell(mx - 8, my - 5, mx + 8, my + 5), (6, 4, 4), (30, 24, 24))
    paint(im, ell(40, 76, 68, 104), (60, 40, 24), (140, 98, 56), 'x', 'tri')
    dots(im, [(54, 90, 3, (230, 200, 120, 255))] + [(x, 106, 6, (34, 30, 30, 255)) for x in (84, 96)] + [(90, 98, 6, (46, 42, 42, 255))])
    if t2:
        for x in (32, 44, 98):
            lines(im, [(x, 82), (x + 5, 90), (x, 98)], (255, 110, 70, 255), 2)
        glow(im, 40, 90, 14, (255, 90, 50), 90)
        lines(im, [(40, 70), (100, 70)], GOLD + (255,), 2)
    return im


def magic(t2):
    im = canvas()
    glow(im, 64, 34, 36 if t2 else 28, (190, 110, 255), 130)
    cyl(im, 50, 58, 78, 114, (52, 54, 86), (112, 116, 164), 4)
    bricks(im, 50, 58, 78, 114, 9)
    paint(im, ell(34, 100, 94, 120), (60, 56, 70), (120, 112, 120), 'x', 'tri')
    paint(im, ell(40, 52, 88, 68), (70, 60, 96), (150, 138, 190), 'x', 'tri')
    if t2:
        lines(im, [(40, 62), (88, 62)], GOLD + (255,), 2)
    s = 1.35 if t2 else 1.0
    cx, cy = 64, 32
    pts = [(cx, cy - 24 * s), (cx + 14 * s, cy), (cx, cy + 22 * s), (cx - 14 * s, cy)]
    paint(im, poly(pts), (110, 60, 190), (200, 150, 255), 'x')
    paint(im, poly([pts[0], pts[1], (cx, cy)]), (190, 140, 250), (245, 225, 255), 'x')
    paint(im, poly([pts[3], (cx, cy), pts[2]]), (80, 40, 150), (130, 80, 210), 'x')
    if t2:
        for ox, oy in ((-30, -4), (30, 8), (6, -34)):
            sh = [(cx + ox, cy + oy - 8), (cx + ox + 5, cy + oy), (cx + ox, cy + oy + 8), (cx + ox - 5, cy + oy)]
            paint(im, poly(sh), (130, 70, 210), (230, 190, 255), 'x')
    return im


def slow(t2):
    im = canvas()
    cyc = (120, 200, 235) if t2 else (96, 168, 176)
    if t2:
        glow(im, 64, 56, 44, (120, 220, 255), 90)
    paint(im, poly([(40, 114), (88, 114), (78, 56), (50, 56)]), dark(STONE_D, .1) if not t2 else (80, 130, 170), STONE if not t2 else (190, 230, 250), 'x', 'tri')
    bricks(im, 42, 56, 86, 114, 9)
    paint(im, rrect(56, 96, 72, 114, 7), (50, 34, 22), (96, 66, 40), 'x', 'tri')
    cone(im, 64, 34, 58, 18, (110, 70, 40), (176, 118, 70)) if not t2 else cone(im, 64, 34, 58, 18, (90, 150, 200), (200, 240, 255))
    for k in range(4):
        a = k * math.pi / 2 + 0.45
        blade = rot_rect(64 + math.cos(a) * 26, 50 + math.sin(a) * 26, 52, 12, a)
        paint(im, lambda d, blade=blade: d.polygon(sc(blade), fill=255), dark(cyc, .3), light(cyc, .35), 'y', 'tri')
        lines(im, [(64 + math.cos(a) * 6, 50 + math.sin(a) * 6), (64 + math.cos(a) * 50, 50 + math.sin(a) * 50)], (70, 52, 36, 255), 1.8)
    dots(im, [(64, 50, 6, AMBER + (255,)), (64, 50, 3, (120, 70, 20, 255))])
    if t2:
        for x, h in ((34, 22), (94, 26), (24, 14)):
            paint(im, poly([(x - 5, 114), (x, 114 - h), (x + 5, 114)]), (110, 190, 235), (235, 250, 255), 'x')
    return im


def acid():
    im = canvas()
    glow(im, 64, 38, 30, (150, 240, 90), 110)
    cyl(im, 34, 66, 94, 114, (86, 70, 54), (150, 126, 96), 7)
    paint(im, rrect(54, 92, 74, 114, 8), (40, 28, 20), (90, 62, 38), 'x', 'tri')
    cone(im, 64, 48, 70, 38, (56, 104, 62), (112, 176, 92))
    paint(im, ell(40, 34, 88, 58), (40, 36, 36), (100, 96, 96), 'x', 'tri')
    paint(im, ell(44, 36, 84, 52), (80, 170, 50), (180, 250, 110), 'y')
    dots(im, [(54, 40, 4, (220, 255, 190, 255)), (70, 44, 3, (235, 255, 210, 255)), (62, 28, 5, (190, 250, 140, 200)), (72, 18, 3, (200, 255, 160, 180)), (56, 12, 2.5, (210, 255, 170, 160))])
    paint(im, rrect(88, 70, 98, 100, 4), (60, 60, 64), (140, 140, 148), 'x', 'tri')
    dots(im, [(93, 104, 5, (130, 220, 80, 255))])
    return im


def watchtower():
    im = canvas()
    glow(im, 64, 24, 30, (255, 170, 60), 140)
    paint(im, rrect(42, 38, 86, 116, 3), dark(STONE_D, .1), STONE, 'x', 'tri')
    bricks(im, 42, 38, 86, 116, 8)
    paint(im, rrect(34, 30, 94, 44, 3), STONE_D, light(STONE, .1), 'x', 'tri')
    merlons(im, 34, 94, 32, 5, light(STONE, .05))
    paint(im, poly([(64, 6), (74, 28), (54, 28)]), (210, 110, 30), (255, 220, 120), 'x', 'tri')
    paint(im, rrect(56, 96, 72, 116, 7), (50, 34, 22), (96, 66, 40), 'x', 'tri')
    paint(im, rrect(58, 54, 70, 74, 3), (20, 14, 10), (70, 50, 34), 'x')
    paint(im, poly([(86, 50), (108, 50), (108, 84), (97, 94), (86, 84)]), dark(AMBER, .3), GOLD, 'x')
    dots(im, [(97, 66, 6, (120, 70, 20, 255)), (97, 66, 3, (255, 236, 170, 255))])
    return im



def ultimate(base, color):
    """An ultimate tower (v0.20.0): the tier-2 tower of its line on an elemental halo, with a gold base band and gems."""
    im = canvas()
    glow(im, 64, 66, 60, color, 170)
    im.alpha_composite(base(True))
    lines(im, [(26, 117), (102, 117)], GOLD + (255,), 3)
    dots(im, [(x, 117, 4, light(color, .35) + (255,)) for x in (34, 64, 94)] + [(64, 7, 5, light(color, .55) + (255,))])
    return im

# ── map objects (v0.22.0) ───────────────────────────────────────────────────
# The base fills the 2x2 centre of the square map (80 px, drawn from a 160 px texture); a portal marks a spawn tile
# (56 px, drawn from a 112 px texture). Both are symmetric enough to repeat four times without a mirrored copy.

def citadel():
    im = canvas(160)
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse([8 * S, 128 * S, 152 * S, 156 * S], fill=INK + (150,))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(3 * S)))
    glow(im, 80, 64, 34, (255, 176, 66), 140)   # small enough that the blur stays inside the canvas (no clipped box)
    paint(im, rrect(10, 116, 150, 148, 4), dark(STONE_D, .15), STONE_D, 'y')
    paint(im, rrect(26, 58, 134, 124, 3), dark(STONE_D, .1), STONE, 'x', 'tri')
    bricks(im, 26, 58, 134, 124, 9)
    merlons(im, 26, 134, 60, 7, light(STONE, .05))
    for x0 in (6, 122):
        cyl(im, x0, 46, x0 + 32, 128, STONE_D, STONE, 4)
        bricks(im, x0, 46, x0 + 32, 128, 9)
        cone(im, x0 + 16, 16, 50, 21, (140, 64, 24), (232, 150, 50))
        paint(im, rrect(x0 + 12, 74, x0 + 20, 92, 3), (20, 14, 10), dark(AMBER, .3), 'y')
    glow(im, 80, 106, 22, (255, 170, 60), 130)
    paint(im, rrect(64, 86, 96, 126, 13), (34, 22, 14), (110, 74, 42), 'x', 'tri')
    lines(im, [(80, 90), (80, 126)], (26, 18, 12, 200), 1.4)
    for y in (100, 112):
        lines(im, [(66, y), (94, y)], (200, 150, 70, 170), 1.2)
    paint(im, poly([(80, 8), (94, 34), (80, 64), (66, 34)]), (196, 112, 28), (255, 224, 140), 'x', 'tri')
    paint(im, poly([(80, 8), (94, 34), (80, 36)]), (255, 214, 120), (255, 250, 220), 'x')
    dots(im, [(80, 36, 4, (255, 250, 226, 220))])
    flag(im, 22, 44, AMBER)
    flag(im, 138, 44, AMBER)
    return im


def spawn_portal():
    im = canvas(112)
    c = 56
    d = ImageDraw.Draw(im, 'RGBA')
    ring = Image.new('RGBA', im.size, (0, 0, 0, 0))
    paint(ring, ell(6, 6, 106, 106), STONE_D, light(STONE, .05), 'y')
    paint(ring, ell(12, 12, 100, 100), dark(STONE_D, .35), STONE_D, 'y')
    im.alpha_composite(ring)
    d = ImageDraw.Draw(im, 'RGBA')
    for r in range(38, 2, -1):
        t = 1 - r / 38
        col = lerp((96, 40, 128), (8, 4, 14), t ** 0.7)
        d.ellipse([(c - r) * S, (c - r) * S, (c + r) * S, (c + r) * S], fill=col + (255,))
    d.ellipse([(c - 33) * S, (c - 33) * S, (c + 33) * S, (c + 33) * S], outline=(196, 70, 56, 255), width=2 * S)
    for k in range(3):
        a0 = k * 2 * math.pi / 3
        pts = [(c + math.cos(a0 + t * 2.2) * (30 - t * 20), c + math.sin(a0 + t * 2.2) * (30 - t * 20)) for t in [i / 12 for i in range(13)]]
        lines(im, pts, (190, 150, 240, 200), 2.0)
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        d.polygon(sc([(c + math.cos(a - .12) * 40, c + math.sin(a - .12) * 40), (c + math.cos(a + .12) * 40, c + math.sin(a + .12) * 40),
                      (c + math.cos(a + .1) * 47, c + math.sin(a + .1) * 47), (c + math.cos(a - .1) * 47, c + math.sin(a - .1) * 47)]), fill=AMBER + (255,))
    dots(im, [(c, c, 3, (255, 230, 200, 255))])
    return im


# ── enemies ─────────────────────────────────────────────────────────────────

def grunt():
    im = canvas()
    paint(im, ell(42, 100, 60, 116), (40, 28, 20), (86, 60, 40))
    paint(im, ell(68, 100, 86, 116), (40, 28, 20), (86, 60, 40))
    paint(im, rrect(38, 62, 90, 108, 14), (110, 52, 40), (196, 104, 70), 'x', 'tri')
    lines(im, [(40, 86), (88, 86)], (60, 36, 24, 255), 3)
    paint(im, poly([(34, 40), (14, 30), (30, 56)]), (96, 150, 60), (150, 200, 90))
    paint(im, poly([(94, 40), (114, 30), (98, 56)]), (96, 150, 60), (150, 200, 90))
    paint(im, ell(34, 20, 94, 76), (84, 128, 50), (150, 204, 92), 'x', 'tri')
    dots(im, [(52, 46, 7, (250, 232, 90, 255)), (76, 46, 7, (250, 232, 90, 255)), (53, 47, 3, (20, 14, 8, 255)), (77, 47, 3, (20, 14, 8, 255))])
    lines(im, [(50, 62), (64, 68), (78, 62)], (40, 26, 16, 255), 2.4)
    paint(im, poly([(54, 63), (58, 63), (56, 71)]), (230, 230, 220), (250, 250, 240))
    paint(im, poly(rot_rect(106, 82, 28, 7, -0.9)), (120, 128, 140), (214, 222, 232), 'y', 'tri')
    return im


def runner():
    im = canvas()
    lines(im, [(26, 70), (10, 58), (6, 66)], (80, 90, 98, 255), 5)
    for x in (44, 56, 78, 90):
        lines(im, [(x, 82), (x + (-5 if x < 64 else 6), 108)], (52, 60, 68, 255), 5)
    paint(im, ell(22, 56, 100, 96), (74, 84, 94), (150, 162, 172), 'y', 'tri')
    paint(im, poly([(86, 50), (96, 36), (100, 52)]), (74, 84, 94), (130, 140, 150))
    paint(im, ell(82, 48, 116, 80), (84, 94, 104), (164, 176, 186), 'y', 'tri')
    paint(im, poly([(108, 58), (124, 70), (108, 76)]), (60, 68, 76), (110, 120, 130))
    dots(im, [(100, 58, 4, (255, 90, 70, 255)), (101, 58, 2, (30, 8, 8, 255)), (122, 70, 3, (20, 20, 22, 255))])
    lines(im, [(104, 74), (114, 76)], (240, 240, 230, 255), 2)
    return im


def golem():
    im = canvas()
    paint(im, rrect(34, 100, 58, 118, 4), (70, 62, 56), (130, 120, 108), 'x', 'tri')
    paint(im, rrect(70, 100, 94, 118, 4), (70, 62, 56), (130, 120, 108), 'x', 'tri')
    paint(im, rrect(8, 44, 34, 100, 8), (86, 76, 66), (150, 138, 122), 'x', 'tri')
    paint(im, rrect(94, 44, 120, 100, 8), (86, 76, 66), (150, 138, 122), 'x', 'tri')
    paint(im, rrect(30, 36, 98, 106, 10), (92, 82, 72), (176, 162, 144), 'x', 'tri')
    paint(im, rrect(46, 12, 82, 44, 6), (96, 86, 76), (170, 156, 138), 'x', 'tri')
    glow(im, 64, 28, 16, (255, 170, 40), 110)
    dots(im, [(56, 28, 4.5, (255, 200, 70, 255)), (72, 28, 4.5, (255, 200, 70, 255))])
    lines(im, [(44, 54), (54, 70), (48, 84)], (50, 42, 36, 200), 2.2)
    lines(im, [(84, 60), (76, 76), (86, 92)], (50, 42, 36, 200), 2.2)
    dots(im, [(20, 52, 5, (90, 130, 60, 220)), (100, 96, 4, (90, 130, 60, 220)), (60, 100, 4, (90, 130, 60, 200))])
    return im


def wyvern():
    im = canvas()
    glow(im, 64, 70, 36, (150, 80, 220), 60)
    for sign in (-1, 1):
        wing = [(60, 72 + sign * 6), (28, 72 + sign * 50), (42, 72 + sign * 34), (34, 72 + sign * 60), (54, 72 + sign * 38), (58, 72 + sign * 66), (72, 72 + sign * 14)]
        paint(im, poly(wing), (70, 40, 120), (170, 110, 220), 'x')
        lines(im, [(62, 72 + sign * 8), (30, 72 + sign * 48)], (50, 28, 90, 255), 2)
        lines(im, [(64, 72 + sign * 10), (58, 72 + sign * 62)], (50, 28, 90, 255), 2)
    paint(im, poly([(40, 66), (6, 88), (14, 80), (42, 78)]), (88, 52, 140), (150, 100, 200))
    paint(im, ell(36, 60, 96, 84), (92, 54, 150), (176, 128, 232), 'y', 'tri')
    paint(im, poly([(88, 64), (118, 72), (88, 82)]), (100, 60, 160), (188, 140, 240))
    dots(im, [(100, 69, 3.5, (255, 220, 70, 255)), (101, 69, 1.6, (30, 10, 20, 255))])
    return im


def goliath():
    im = canvas()
    glow(im, 64, 66, 52, (230, 40, 30), 110)
    paint(im, rrect(34, 98, 60, 120, 5), (30, 24, 28), (80, 70, 76), 'x', 'tri')
    paint(im, rrect(68, 98, 94, 120, 5), (30, 24, 28), (80, 70, 76), 'x', 'tri')
    paint(im, poly([(26, 52), (102, 52), (92, 108), (36, 108)]), (36, 28, 34), (96, 82, 90), 'x', 'tri')
    paint(im, rrect(2, 40, 34, 100, 9), (36, 28, 34), (88, 74, 82), 'x', 'tri')
    paint(im, rrect(94, 40, 126, 100, 9), (36, 28, 34), (88, 74, 82), 'x', 'tri')
    for cx in (22, 106):
        paint(im, ell(cx - 18, 30, cx + 18, 62), (60, 44, 30), (180, 140, 60), 'x', 'tri')
        for k in (-1, 0, 1):
            paint(im, poly([(cx + k * 9 - 4, 36), (cx + k * 9, 14), (cx + k * 9 + 4, 36)]), (120, 100, 50), GOLD)
    paint(im, ell(40, 6, 88, 54), (30, 24, 30), (92, 80, 90), 'x', 'tri')
    paint(im, poly([(42, 20), (22, 2), (30, 28)]), (150, 130, 110), (236, 224, 200))
    paint(im, poly([(86, 20), (106, 2), (98, 28)]), (150, 130, 110), (236, 224, 200))
    paint(im, rrect(48, 26, 80, 38, 3), (10, 6, 8), (30, 20, 24), 'y')
    glow(im, 56, 32, 7, (255, 60, 40), 190)
    glow(im, 72, 32, 7, (255, 60, 40), 190)
    dots(im, [(56, 32, 3, (255, 150, 110, 255)), (72, 32, 3, (255, 150, 110, 255)), (64, 76, 6, (255, 70, 50, 255))])
    glow(im, 64, 76, 12, (255, 70, 40), 160)
    return im


def hero():
    im = canvas()
    glow(im, 64, 66, 46, (255, 190, 70), 110)
    paint(im, poly([(64, 46), (96, 118), (32, 118)]), (140, 40, 30), (230, 110, 60), 'x', 'tri')
    paint(im, ell(40, 104, 88, 120), (60, 50, 44), (120, 108, 96), 'x', 'tri')
    paint(im, rrect(40, 54, 88, 104, 12), (96, 100, 112), (210, 214, 226), 'x', 'tri')
    lines(im, [(42, 82), (86, 82)], (190, 140, 50, 255), 4)
    paint(im, ell(42, 22, 86, 66), (110, 114, 126), (226, 230, 240), 'x', 'tri')
    paint(im, rrect(50, 40, 78, 48, 2), (14, 12, 16), (50, 44, 50), 'y')
    paint(im, poly([(64, 24), (74, 4), (84, 28)]), (190, 120, 30), GOLD)
    paint(im, poly(rot_rect(104, 66, 62, 9, -1.2)), (130, 138, 150), (240, 244, 252), 'y', 'tri')
    paint(im, rrect(96, 84, 112, 90, 2), (130, 90, 30), GOLD)
    paint(im, ell(14, 62, 44, 98), (150, 100, 30), GOLD, 'x', 'tri')
    dots(im, [(29, 80, 5, (120, 60, 20, 255))])
    return im


SPRITES = {
    'arrow_t1': lambda: arrow(False), 'arrow_t2': lambda: arrow(True), 'cannon_t1': lambda: cannon(False), 'cannon_t2': lambda: cannon(True),
    'magic_t1': lambda: magic(False), 'magic_t2': lambda: magic(True), 'slow_t1': lambda: slow(False), 'slow_t2': lambda: slow(True),
    'fire_ult': lambda: ultimate(magic, (255, 120, 50)), 'water_ult': lambda: ultimate(slow, (140, 220, 250)),
    'earth_ult': lambda: ultimate(cannon, (200, 150, 90)), 'nature_ult': lambda: ultimate(arrow, (120, 220, 110)),
    'citadel': citadel, 'spawn_portal': spawn_portal,
    'acid_t1': acid, 'watchtower': watchtower, 'grunt': grunt, 'runner': runner, 'golem': golem, 'wyvern': wyvern, 'boss_goliath': goliath, 'hero': hero,
}


def main():
    for name, fn in SPRITES.items():
        done(fn(), name)
    print('wrote', len(SPRITES), 'sprites to', OUT)


if __name__ == '__main__':
    main()
