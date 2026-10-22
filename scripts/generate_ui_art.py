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


# ── builder emblems, damage and armor icons (v0.22.0) ───────────────────────
INK = (26, 18, 12)
ELEMENT_TINTS = {'fire': (232, 121, 58), 'water': (98, 181, 229), 'earth': (156, 123, 84),
                 'nature': (109, 191, 103), 'light': (242, 227, 160), 'shadow': (142, 111, 191)}


def e_fire(d):
    d.polygon(P([(48, 11), (60, 30), (72, 46), (73, 62), (65, 76), (48, 83), (31, 76), (23, 62), (25, 47), (36, 35), (39, 47), (44, 28)]), fill=(255, 214, 128, 255))
    d.polygon(P([(48, 34), (58, 50), (60, 63), (54, 73), (48, 76), (41, 73), (36, 63), (40, 51), (44, 56)]), fill=(255, 128, 40, 255))
    d.polygon(P([(48, 55), (54, 65), (52, 73), (48, 75), (44, 73), (42, 65)]), fill=(255, 246, 206, 255))


def e_water(d):
    d.polygon(P([(48, 11), (66, 50), (30, 50)]), fill=(236, 248, 255, 255))
    d.ellipse(P([(28, 38), (68, 80)]), fill=(236, 248, 255, 255))
    d.polygon(P([(48, 20), (60, 50), (50, 50)]), fill=(150, 205, 240, 255))
    d.ellipse(P([(33, 52), (63, 78)]), fill=(150, 205, 240, 255))
    d.ellipse(P([(36, 52), (46, 66)]), fill=(255, 255, 255, 235))


def e_earth(d):
    d.polygon(P([(16, 74), (36, 32), (50, 56), (64, 24), (82, 74)]), fill=(240, 226, 196, 255))
    d.polygon(P([(64, 24), (82, 74), (62, 74), (56, 48)]), fill=(186, 158, 118, 255))
    d.polygon(P([(36, 32), (50, 56), (40, 74), (16, 74)]), fill=(206, 182, 142, 255))
    d.polygon(P([(64, 24), (71, 37), (64, 35), (58, 39)]), fill=(255, 255, 255, 255))
    d.rectangle(P([(20, 72), (78, 77)]), fill=(120, 88, 54, 255))


def e_nature(d):
    axis = (-math.pi / 4)
    cx, cy, half = 48, 46, 34
    top, bot = [], []
    for i in range(0, 21):
        t = i / 20
        along = -half + 2 * half * t
        width = 17 * math.sin(math.pi * t) ** 0.75
        for sign, out in ((-1, top), (1, bot)):
            x, y = along, sign * width
            out.append((cx + x * math.cos(axis) - y * math.sin(axis), cy + x * math.sin(axis) + y * math.cos(axis)))
    d.polygon(P(top + bot[::-1]), fill=(232, 250, 214, 255))
    d.polygon(P(bot + [(cx + half * math.cos(axis), cy + half * math.sin(axis))]), fill=(166, 214, 140, 255))
    d.line(P([(cx - half * math.cos(axis) - 4, cy - half * math.sin(axis) + 4), (cx + (half - 4) * math.cos(axis), cy + (half - 4) * math.sin(axis))]), fill=(70, 130, 64, 255), width=3 * S)
    d.line(P([(20, 78), (30, 66)]), fill=(120, 84, 50, 255), width=3 * S)


def e_light(d):
    for k in range(8):
        a = k * math.pi / 4
        reach = 36 if k % 2 == 0 else 28
        d.polygon(P([(48 + math.cos(a - .24) * 15, 48 + math.sin(a - .24) * 15), (48 + math.cos(a) * reach, 48 + math.sin(a) * reach),
                     (48 + math.cos(a + .24) * 15, 48 + math.sin(a + .24) * 15)]), fill=(255, 250, 226, 255))
    d.ellipse(P([(33, 33), (63, 63)]), fill=(255, 226, 140, 255))
    d.ellipse(P([(39, 39), (57, 57)]), fill=(255, 252, 232, 255))


def e_shadow(d):
    mask = Image.new('L', (96 * S, 96 * S), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse(P([(16, 18), (76, 78)]), fill=255)
    md.ellipse(P([(34, 8), (86, 60)]), fill=0)
    d._image.paste(Image.new('RGBA', mask.size, (232, 222, 250, 255)), (0, 0), mask)
    d.polygon(P([(70, 56), (72, 63), (79, 65), (72, 67), (70, 74), (68, 67), (61, 65), (68, 63)]), fill=(255, 255, 255, 255))
    d.polygon(P([(62, 22), (63.5, 27), (68, 28.5), (63.5, 30), (62, 35), (60.5, 30), (56, 28.5), (60.5, 27)]), fill=(255, 255, 255, 255))


EMBLEM_GLYPHS = {'fire': e_fire, 'water': e_water, 'earth': e_earth, 'nature': e_nature, 'light': e_light, 'shadow': e_shadow}


def icon64(draw):
    """A 64 px icon: flat shapes with the ink outline of the sprites, readable down to 16 px."""
    img, d = layer(64)
    draw(d)
    k = int(2.2 * 2 * S) | 1
    dil = img.split()[3].filter(ImageFilter.MaxFilter(k))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(Image.new('RGBA', img.size, INK + (255,)), (0, 0), dil)
    out.alpha_composite(img)
    return finish(out, 64)


def quad(p0, p1, w0, w1):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy)
    nx, ny = -dy / n, dx / n
    return [(p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2), (p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2),
            (p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2), (p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2)]


def star(cx, cy, r_out, r_in, points=5, rot=-math.pi / 2):
    return [(cx + math.cos(rot + i * math.pi / points) * (r_out if i % 2 == 0 else r_in),
             cy + math.sin(rot + i * math.pi / points) * (r_out if i % 2 == 0 else r_in)) for i in range(points * 2)]


def d_normal(d):
    d.polygon(P(quad((24, 40), (52, 12), 9, 3)), fill=(214, 220, 226, 255))
    d.polygon(P([(52, 12), (56, 8), (54, 15)]), fill=(214, 220, 226, 255))
    d.line(P([(26, 38), (50, 14)]), fill=(255, 255, 255, 255), width=S)
    d.polygon(P(quad((17, 33), (31, 47), 6, 6)), fill=(232, 169, 59, 255))
    d.polygon(P(quad((22, 42), (12, 52), 5, 5)), fill=(120, 80, 44, 255))
    d.ellipse(P([(7, 49), (15, 57)]), fill=(250, 210, 110, 255))


def d_piercing(d):
    d.polygon(P(quad((10, 54), (40, 24), 3.5, 3.5)), fill=(196, 150, 92, 255))
    d.polygon(P([(56, 8), (36, 16), (48, 28)]), fill=(222, 228, 234, 255))
    d.polygon(P([(56, 8), (36, 16), (44, 20)]), fill=(255, 255, 255, 255))
    for off in (0, 8):
        d.polygon(P([(10 + off, 54 + off * 0.0), (4 + off, 44), (18 + off, 52)]), fill=(243, 227, 188, 255))
    d.polygon(P([(10, 54), (20, 60), (12, 46)]), fill=(243, 227, 188, 255))


def d_magic(d):
    d.polygon(P([(32, 5), (50, 20), (50, 42), (32, 59), (14, 42), (14, 20)]), fill=(150, 100, 220, 255))
    d.polygon(P([(32, 5), (50, 20), (32, 30), (14, 20)]), fill=(206, 170, 250, 255))
    d.polygon(P([(32, 30), (50, 20), (50, 42), (32, 59)]), fill=(104, 62, 170, 255))
    d.polygon(P([(14, 20), (32, 30), (32, 59), (14, 42)]), fill=(128, 82, 196, 255))
    d.polygon(P(star(50, 12, 7, 2, 4, -math.pi / 2)), fill=(255, 250, 226, 255))


def d_siege(d):
    for y0, y1 in ((16, 6), (26, 14), (36, 24)):
        d.line(P([(4, y0 + 18), (22, y1 + 18)]), fill=(214, 220, 228, 255), width=3 * S)
    d.ellipse(P([(16, 20), (57, 61)]), fill=(70, 72, 82, 255))
    d.ellipse(P([(20, 24), (45, 49)]), fill=(112, 114, 126, 255))
    d.ellipse(P([(23, 27), (33, 37)]), fill=(190, 192, 202, 255))


def d_chaos(d):
    d.polygon(P([(28, 5), (6, 32), (28, 59), (26, 48), (32, 41), (25, 33), (31, 25), (26, 16)]), fill=(214, 76, 120, 255))
    d.polygon(P([(38, 5), (60, 32), (38, 59), (36, 48), (42, 41), (35, 33), (41, 25), (36, 16)]), fill=(150, 62, 176, 255))
    d.polygon(P([(14, 32), (20, 26), (24, 32), (20, 38)]), fill=(255, 226, 150, 255))
    d.polygon(P([(46, 32), (50, 26), (56, 32), (50, 38)]), fill=(255, 226, 150, 255))


DAMAGE_GLYPHS = {'normal': d_normal, 'piercing': d_piercing, 'magic': d_magic, 'siege': d_siege, 'chaos': d_chaos}


def a_unarmored(d):
    d.polygon(P([(18, 6), (46, 6), (50, 18), (45, 28), (50, 40), (44, 60), (38, 50), (32, 62), (26, 50), (20, 60), (15, 42), (19, 30), (14, 18)]), fill=(204, 176, 128, 255))
    d.line(P([(25, 13), (31, 26), (25, 38)]), fill=(120, 90, 56, 255), width=2 * S)
    d.line(P([(40, 15), (36, 28), (41, 40)]), fill=(120, 90, 56, 255), width=2 * S)


def a_light(d):
    d.ellipse(P([(8, 8), (56, 56)]), fill=(120, 78, 40, 255))
    d.ellipse(P([(13, 13), (51, 51)]), fill=(168, 116, 66, 255))
    d.ellipse(P([(24, 24), (40, 40)]), fill=(204, 208, 214, 255))
    d.ellipse(P([(28, 28), (36, 36)]), fill=(250, 210, 110, 255))
    for x, y in ((32, 17), (47, 32), (32, 47), (17, 32)):
        d.ellipse(P([(x - 2, y - 2), (x + 2, y + 2)]), fill=(250, 210, 110, 255))


def a_medium(d):
    d.polygon(P([(8, 8), (56, 8), (56, 30), (32, 60), (8, 30)]), fill=(120, 132, 150, 255))
    d.polygon(P([(13, 13), (51, 13), (51, 29), (32, 53), (13, 29)]), fill=(160, 172, 190, 255))
    d.polygon(P([(28, 13), (36, 13), (36, 48), (32, 53), (28, 48)]), fill=(224, 230, 238, 255))
    d.polygon(P([(13, 21), (51, 21), (51, 27), (13, 27)]), fill=(224, 230, 238, 255))


def a_heavy(d):
    d.rounded_rectangle(P([(14, 3), (50, 61)]), radius=5 * S, fill=(70, 74, 84, 255))
    d.rounded_rectangle(P([(18, 7), (46, 57)]), radius=3 * S, fill=(110, 116, 128, 255))
    d.rectangle(P([(30, 7), (34, 57)]), fill=(168, 174, 186, 255))
    for x, y in ((22, 12), (42, 12), (22, 28), (42, 28), (22, 44), (42, 44)):
        d.ellipse(P([(x - 2, y - 2), (x + 2, y + 2)]), fill=(214, 220, 228, 255))


def a_fortified(d):
    teeth = [(8, 6), (17, 6), (17, 13), (21, 13), (21, 6), (30, 6), (30, 13), (34, 13), (34, 6), (43, 6), (43, 13), (47, 13), (47, 6), (56, 6), (56, 58), (8, 58)]
    d.polygon(P(teeth), fill=(112, 102, 88, 255))
    d.polygon(P([(11, 16), (53, 16), (53, 55), (11, 55)]), fill=(176, 164, 142, 255))
    for y in (26, 36, 46):
        d.line(P([(11, y), (53, y)]), fill=(104, 94, 80, 255), width=S)
    for x, y0 in ((22, 16), (40, 16), (16, 26), (32, 26), (48, 26), (22, 36), (40, 36), (16, 46), (48, 46)):
        d.line(P([(x, y0), (x, y0 + 10)]), fill=(104, 94, 80, 255), width=S)
    d.rectangle(P([(26, 40), (38, 56)]), fill=(52, 40, 30, 255))
    d.ellipse(P([(26, 33), (38, 47)]), fill=(52, 40, 30, 255))


def a_heroic(d):
    d.polygon(P([(3, 22), (12, 14), (14, 3), (24, 11), (32, 4), (40, 11), (50, 3), (52, 14), (61, 22), (54, 26), (58, 36), (48, 34), (32, 61), (16, 34), (6, 36), (10, 26)]), fill=(180, 118, 34, 255))
    d.polygon(P([(16, 19), (24, 18), (32, 12), (40, 18), (48, 19), (47, 32), (32, 52), (17, 32)]), fill=(90, 56, 26, 255))
    d.polygon(P(star(32, 32, 15, 6.5, 5)), fill=(255, 201, 91, 255))
    d.polygon(P(star(32, 32, 7.5, 3.2, 5)), fill=(255, 244, 200, 255))


ARMOR_GLYPHS = {'unarmored': a_unarmored, 'light': a_light, 'medium': a_medium, 'heavy': a_heavy, 'fortified': a_fortified, 'heroic': a_heroic}


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
    for name, fn in EMBLEM_GLYPHS.items():
        medallion(fn, ELEMENT_TINTS[name]).save(UI / f'builder_{name}.png', optimize=True)
    for name, fn in DAMAGE_GLYPHS.items():
        icon64(fn).save(UI / f'dmg_{name}.png', optimize=True)
    for name, fn in ARMOR_GLYPHS.items():
        icon64(fn).save(UI / f'armor_{name}.png', optimize=True)
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
