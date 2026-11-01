#!/usr/bin/env python3
"""Generate 2D top-down sprites for towers, enemies, hero, citadel and portals.

All entity sprites are authored at 128x128 (drawn at ~40-64 px in-game) with a
shared Baltic-amber palette, consistent 2 px dark-ink outline, soft contact
shadow, and subtle top-left key light so towers and creeps read as one family.

Output:
  public/assets/art/<name>.png   (20 entity/tower sprites, 128x128)
  public/assets/art/citadel.png  (160x160 -> drawn 80x80)
  public/assets/art/spawn_portal.png (112x112 -> drawn 56x56)
"""

import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "art"
OUT.mkdir(parents=True, exist_ok=True)

S = 128  # canonical sprite size

# Shared palette — matches src/config/constants.ts & generate_ui_art.py
INK = (26, 18, 12, 255)
INK_SOFT = (26, 18, 12, 165)

STONE_DARK = (58, 52, 46, 255)
STONE_MID = (106, 96, 86, 255)
STONE_LIGHT = (164, 152, 136, 255)
STONE_HI = (212, 200, 182, 255)

WOOD_DARK = (74, 48, 28, 255)
WOOD_MID = (124, 84, 50, 255)
WOOD_LIGHT = (178, 128, 78, 255)

PINE_DARK = (32, 62, 40, 255)
PINE_MID = (58, 108, 68, 255)
PINE_LIGHT = (108, 168, 110, 255)

GOLD_DARK = (122, 86, 28, 255)
GOLD_MID = (196, 148, 58, 255)
GOLD_LIGHT = (244, 206, 112, 255)

AMBER = (242, 168, 59, 255)
AMBER_HI = (255, 226, 154, 255)

FIRE_DEEP = (168, 42, 22, 255)
FIRE_MID = (232, 92, 32, 255)
FIRE_HI = (255, 202, 86, 255)

ICE_DEEP = (34, 88, 138, 255)
ICE_MID = (78, 162, 218, 255)
ICE_HI = (202, 238, 255, 255)

ARC_DEEP = (74, 42, 138, 255)
ARC_MID = (146, 92, 228, 255)
ARC_HI = (224, 188, 255, 255)

ACID_DEEP = (46, 108, 34, 255)
ACID_MID = (118, 198, 58, 255)
ACID_HI = (212, 248, 128, 255)

IRON_DARK = (44, 48, 56, 255)
IRON_MID = (88, 96, 108, 255)
IRON_LIGHT = (148, 158, 172, 255)

FLESH_DARK = (96, 118, 72, 255)
FLESH_MID = (138, 168, 98, 255)
FLESH_HI = (182, 208, 138, 255)

CRIMSON_DARK = (112, 24, 28, 255)
CRIMSON = (188, 46, 48, 255)
CRIMSON_HI = (238, 112, 96, 255)


def new(size: int = S) -> Image.Image:
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def shadow_base(size: int = S, rx: int = 44, ry: int = 38, cy: int = 72) -> Image.Image:
    """Soft grounded ambient-occlusion contact shadow beneath a sprite."""
    im = new(size)
    d = ImageDraw.Draw(im)
    cx = size // 2
    d.ellipse((cx - rx - 4, cy - ry - 2, cx + rx + 4, cy + ry + 6), fill=(12, 8, 5, 95))
    d.ellipse((cx - rx + 2, cy - ry + 2, cx + rx - 2, cy + ry + 2), fill=(18, 12, 8, 145))
    return im.filter(ImageFilter.GaussianBlur(radius=4.0))


def outlined(img: Image.Image, width: int = 2, color=INK) -> Image.Image:
    """Dilate the solid opaque silhouette (alpha > 180) by `width` px into a dark outline.
    Soft glows and ground shadows (alpha <= 180) are preserved without turning into ink blobs.
    """
    alpha = img.split()[3]
    solid = alpha.point(lambda a: 255 if a > 180 else 0)
    expanded = solid
    for _ in range(width):
        expanded = expanded.filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(expanded, solid)
    ring_soft = ring.filter(ImageFilter.GaussianBlur(radius=0.45))
    out = Image.new("RGBA", img.size, color[:3] + (0,))
    out.putalpha(ring_soft)
    return Image.alpha_composite(out, img)


def glow(img: Image.Image, color, radius: int = 6, strength: float = 0.7) -> Image.Image:
    """Soft outer halo in `color` behind opaque pixels (kept <= 168 alpha so outlined() ignores it)."""
    alpha = img.split()[3].filter(ImageFilter.GaussianBlur(radius=radius))
    alpha = alpha.point(lambda a: min(168, int(a * strength)))
    halo = Image.new("RGBA", img.size, color[:3] + (0,))
    halo.putalpha(alpha)
    return Image.alpha_composite(halo, img)


def reg_poly(cx: float, cy: float, r: float, n: int, rot: float = 0.0):
    return [
        (cx + r * math.cos(rot + 2 * math.pi * i / n),
         cy + r * math.sin(rot + 2 * math.pi * i / n))
        for i in range(n)
    ]


def tower_pedestal(im: Image.Image, radius: int = 44, rim_color=STONE_LIGHT, core_color=STONE_MID):
    """Shared octagonal stone foundation with mortar grooves, corner rivets, and top-left rim light."""
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2 + 2
    outer = reg_poly(cx, cy, radius, 8, rot=math.pi / 8)
    inner = reg_poly(cx, cy - 1, radius - 6, 8, rot=math.pi / 8)
    core = reg_poly(cx, cy - 2, radius - 12, 8, rot=math.pi / 8)
    d.polygon(outer, fill=STONE_DARK)
    d.polygon(inner, fill=rim_color)
    d.polygon(core, fill=core_color)
    for i in (4, 5, 6):
        p1 = inner[i]
        p2 = inner[(i + 1) % 8]
        d.line([p1, p2], fill=STONE_HI, width=2)
    for i in range(8):
        d.line([inner[i], core[i]], fill=STONE_DARK, width=1)
        rx = (inner[i][0] + core[i][0]) * 0.5
        ry = (inner[i][1] + core[i][1]) * 0.5
        d.ellipse((rx - 1.5, ry - 1.5, rx + 1.5, ry + 1.5), fill=STONE_HI)


def brick_ring(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, count: int = 8, color=STONE_DARK):
    for i in range(count):
        a = 2 * math.pi * i / count
        x1 = cx + (r - 4) * math.cos(a)
        y1 = cy + (r - 4) * math.sin(a)
        x2 = cx + (r + 2) * math.cos(a)
        y2 = cy + (r + 2) * math.sin(a)
        d.line([(x1, y1), (x2, y2)], fill=color, width=2)


def cylindrical_sheen(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color=STONE_HI):
    """Crescent highlight on the upper-left quadrant of a circular turret body."""
    d.arc((cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2), start=195, end=265, fill=color, width=2)


def save(name: str, im: Image.Image) -> None:
    im.save(OUT / f"{name}.png", "PNG")


# ---------------------------------------------------------------------------
# TOWERS (14)
# ---------------------------------------------------------------------------

def spr_arrow_t1() -> Image.Image:
    im = shadow_base(S, 42, 36, 70)
    tower_pedestal(im, 42, WOOD_LIGHT, WOOD_MID)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=WOOD_DARK)
    d.ellipse((cx - 22, cy - 23, cx + 22, cy + 21), fill=WOOD_MID)
    for dy in (-12, -4, 4, 12):
        d.line([(cx - 18, cy + dy), (cx + 18, cy + dy)], fill=WOOD_DARK, width=2)
        d.line([(cx - 16, cy + dy - 1), (cx + 16, cy + dy - 1)], fill=WOOD_LIGHT, width=1)
    d.arc((cx - 22, cy - 22, cx + 22, cy + 22), start=205, end=335, fill=GOLD_LIGHT, width=5)
    d.arc((cx - 20, cy - 20, cx + 20, cy + 20), start=210, end=330, fill=WOOD_LIGHT, width=2)
    d.line([(cx - 18, cy - 8), (cx, cy + 12), (cx + 18, cy - 8)], fill=STONE_HI, width=2)
    d.line([(cx, cy + 16), (cx, cy - 26)], fill=WOOD_LIGHT, width=4)
    d.polygon([(cx, cy - 34), (cx - 8, cy - 20), (cx + 8, cy - 20)], fill=IRON_LIGHT)
    d.polygon([(cx, cy - 34), (cx - 3, cy - 20), (cx, cy - 22)], fill=STONE_HI)
    d.polygon([(cx - 6, cy + 16), (cx + 6, cy + 16), (cx, cy + 10)], fill=CRIMSON_HI)
    return outlined(im, 2)


def spr_arrow_t2() -> Image.Image:
    im = shadow_base(S, 46, 40, 70)
    tower_pedestal(im, 46, STONE_LIGHT, STONE_MID)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 30, cy - 30, cx + 30, cy + 30), fill=WOOD_DARK)
    d.ellipse((cx - 26, cy - 27, cx + 26, cy + 25), fill=WOOD_MID)
    brick_ring(d, cx, cy, 28, 8, GOLD_MID)
    cylindrical_sheen(d, cx, cy - 1, 25, GOLD_LIGHT)
    d.polygon([(cx - 28, cy - 6), (cx - 8, cy - 18), (cx - 6, cy - 10), (cx - 24, cy + 2)], fill=GOLD_LIGHT)
    d.polygon([(cx + 28, cy - 6), (cx + 8, cy - 18), (cx + 6, cy - 10), (cx + 24, cy + 2)], fill=GOLD_LIGHT)
    d.ellipse((cx - 12, cy - 19, cx - 4, cy - 11), fill=GOLD_MID)
    d.ellipse((cx + 4, cy - 19, cx + 12, cy - 11), fill=GOLD_MID)
    d.line([(cx - 24, cy - 2), (cx, cy + 14), (cx + 24, cy - 2)], fill=STONE_HI, width=2)
    for dx in (-5, 5):
        d.line([(cx + dx, cy + 16), (cx + dx, cy - 28)], fill=WOOD_LIGHT, width=3)
        d.polygon([(cx + dx, cy - 36), (cx + dx - 6, cy - 24), (cx + dx + 6, cy - 24)], fill=AMBER_HI)
    return outlined(im, 2)


def spr_cannon_t1() -> Image.Image:
    im = shadow_base(S, 44, 38, 70)
    tower_pedestal(im, 44, STONE_LIGHT, STONE_MID)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 26, cy - 24, cx + 26, cy + 26), fill=IRON_DARK)
    d.ellipse((cx - 22, cy - 22, cx + 22, cy + 22), fill=IRON_MID)
    cylindrical_sheen(d, cx, cy, 21, IRON_LIGHT)
    d.rounded_rectangle((cx - 12, cy - 36, cx + 12, cy + 8), radius=6, fill=IRON_DARK)
    d.rounded_rectangle((cx - 9, cy - 34, cx + 9, cy + 6), radius=4, fill=IRON_MID)
    d.line([(cx - 4, cy - 32), (cx - 4, cy + 4)], fill=IRON_LIGHT, width=2)
    d.rectangle((cx - 12, cy - 18, cx + 12, cy - 13), fill=GOLD_MID)
    d.rectangle((cx - 12, cy - 4, cx + 12, cy + 1), fill=GOLD_MID)
    d.ellipse((cx - 8, cy - 38, cx + 8, cy - 28), fill=INK)
    d.ellipse((cx - 4, cy + 8, cx + 4, cy + 16), fill=FIRE_MID)
    return outlined(im, 2)


def spr_cannon_t2() -> Image.Image:
    im = shadow_base(S, 46, 40, 70)
    tower_pedestal(im, 46, STONE_LIGHT, STONE_DARK)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    for a_deg in (45, 135, 225, 315):
        a = math.radians(a_deg)
        x = cx + 32 * math.cos(a)
        y = cy + 32 * math.sin(a)
        d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=GOLD_MID)
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=GOLD_LIGHT)
    d.ellipse((cx - 28, cy - 26, cx + 28, cy + 28), fill=IRON_DARK)
    d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=IRON_MID)
    d.rounded_rectangle((cx - 16, cy - 36, cx + 16, cy + 10), radius=8, fill=IRON_DARK)
    d.rounded_rectangle((cx - 13, cy - 34, cx + 13, cy + 8), radius=6, fill=IRON_LIGHT)
    d.rectangle((cx - 16, cy - 20, cx + 16, cy - 14), fill=GOLD_LIGHT)
    d.rectangle((cx - 16, cy - 4, cx + 16, cy + 2), fill=GOLD_LIGHT)
    d.ellipse((cx - 12, cy - 38, cx + 12, cy - 24), fill=INK)
    d.ellipse((cx - 8, cy - 35, cx + 8, cy - 27), fill=FIRE_MID)
    d.ellipse((cx - 4, cy - 33, cx + 4, cy - 29), fill=FIRE_HI)
    return outlined(im, 2)


def spr_magic_t1() -> Image.Image:
    im = shadow_base(S, 42, 36, 70)
    tower_pedestal(im, 42, STONE_LIGHT, ARC_DEEP)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=ARC_DEEP)
    d.polygon(reg_poly(cx, cy, 24, 6, rot=0), fill=ARC_MID)
    d.polygon(reg_poly(cx, cy, 18, 6, rot=math.pi / 6), fill=ARC_DEEP)
    d.polygon([(cx, cy - 28), (cx - 14, cy + 4), (cx, cy + 18), (cx + 14, cy + 4)], fill=ARC_MID)
    d.polygon([(cx, cy - 28), (cx - 14, cy + 4), (cx, cy - 2)], fill=ARC_HI)
    d.polygon([(cx, cy - 28), (cx, cy - 2), (cx + 14, cy + 4)], fill=(176, 124, 244, 255))
    d.ellipse((cx - 5, cy - 14, cx + 5, cy - 4), fill=(255, 255, 255, 235))
    return outlined(glow(im, ARC_MID, radius=7, strength=0.65), 2)


def spr_magic_t2() -> Image.Image:
    im = shadow_base(S, 46, 40, 70)
    tower_pedestal(im, 46, GOLD_LIGHT, ARC_DEEP)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 30, cy - 30, cx + 30, cy + 30), fill=ARC_DEEP)
    d.polygon(reg_poly(cx, cy, 28, 8, rot=0), fill=GOLD_MID)
    d.polygon(reg_poly(cx, cy, 23, 8, rot=math.pi / 8), fill=ARC_DEEP)
    for i in range(3):
        a = 2 * math.pi * i / 3 - math.pi / 2
        ox = cx + 22 * math.cos(a)
        oy = cy + 22 * math.sin(a)
        d.ellipse((ox - 6, oy - 6, ox + 6, oy + 6), fill=ARC_HI)
        d.ellipse((ox - 3, oy - 3, ox + 3, oy + 3), fill=(255, 255, 255, 240))
    d.polygon([(cx, cy - 26), (cx - 14, cy), (cx, cy + 20), (cx + 14, cy)], fill=ARC_MID)
    d.polygon([(cx, cy - 26), (cx - 10, cy - 2), (cx + 4, cy - 6)], fill=ARC_HI)
    return outlined(glow(im, ARC_HI, radius=8, strength=0.75), 2)


def spr_slow_t1() -> Image.Image:
    im = shadow_base(S, 42, 36, 70)
    tower_pedestal(im, 42, ICE_HI, ICE_DEEP)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=ICE_DEEP)
    for i in range(6):
        a = math.pi * i / 3
        x2 = cx + 24 * math.cos(a)
        y2 = cy + 24 * math.sin(a)
        d.line([(cx, cy), (x2, y2)], fill=ICE_HI, width=4)
    d.polygon(reg_poly(cx, cy, 14, 6, rot=math.pi / 6), fill=ICE_MID)
    d.polygon(reg_poly(cx, cy, 8, 6, rot=0), fill=ICE_HI)
    return outlined(glow(im, ICE_MID, radius=6, strength=0.6), 2)


def spr_slow_t2() -> Image.Image:
    im = shadow_base(S, 46, 40, 70)
    tower_pedestal(im, 46, ICE_HI, ICE_DEEP)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    for i in range(8):
        a = math.pi * i / 4
        tip = (cx + 34 * math.cos(a), cy + 34 * math.sin(a))
        l = (cx + 14 * math.cos(a - 0.3), cy + 14 * math.sin(a - 0.3))
        r = (cx + 14 * math.cos(a + 0.3), cy + 14 * math.sin(a + 0.3))
        d.polygon([tip, l, r], fill=ICE_MID if i % 2 else ICE_HI)
    d.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=ICE_DEEP)
    d.ellipse((cx - 11, cy - 11, cx + 11, cy + 11), fill=ICE_HI)
    d.ellipse((cx - 5, cy - 6, cx + 2, cy + 1), fill=(255, 255, 255, 245))
    return outlined(glow(im, ICE_HI, radius=8, strength=0.7), 2)


def spr_acid_t1() -> Image.Image:
    im = shadow_base(S, 44, 38, 70)
    tower_pedestal(im, 44, STONE_LIGHT, ACID_DEEP)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=IRON_DARK)
    d.ellipse((cx - 23, cy - 23, cx + 23, cy + 23), fill=ACID_DEEP)
    d.ellipse((cx - 19, cy - 19, cx + 19, cy + 19), fill=ACID_MID)
    for bx, by, br in ((-7, -5, 6), (8, -8, 4), (5, 7, 5), (-9, 8, 3)):
        d.ellipse((cx + bx - br, cy + by - br, cx + bx + br, cy + by + br), fill=ACID_HI)
        d.ellipse((cx + bx - br + 1, cy + by - br + 1, cx + bx, cy + by), fill=(248, 255, 210, 255))
    return outlined(glow(im, ACID_MID, radius=6, strength=0.6), 2)


def spr_watchtower() -> Image.Image:
    im = shadow_base(S, 44, 38, 70)
    tower_pedestal(im, 44, GOLD_LIGHT, STONE_MID)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=GOLD_DARK)
    d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=STONE_LIGHT)
    for i in range(8):
        a = math.pi * i / 4
        x2 = cx + 32 * math.cos(a)
        y2 = cy + 32 * math.sin(a)
        d.line([(cx, cy), (x2, y2)], fill=GOLD_LIGHT, width=3)
    d.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=FIRE_DEEP)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=AMBER)
    d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=AMBER_HI)
    return outlined(glow(im, AMBER, radius=8, strength=0.75), 2)


def spr_fire_ult() -> Image.Image:
    im = shadow_base(S, 48, 42, 72)
    tower_pedestal(im, 48, GOLD_LIGHT, FIRE_DEEP)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    for i in range(12):
        a = 2 * math.pi * i / 12
        r_tip = 44 if i % 2 == 0 else 36
        tip = (cx + r_tip * math.cos(a), cy + r_tip * math.sin(a))
        l = (cx + 20 * math.cos(a - 0.22), cy + 20 * math.sin(a - 0.22))
        r = (cx + 20 * math.cos(a + 0.22), cy + 20 * math.sin(a + 0.22))
        d.polygon([tip, l, r], fill=FIRE_MID if i % 2 == 0 else FIRE_HI)
    d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=FIRE_DEEP)
    d.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=FIRE_MID)
    d.ellipse((cx - 11, cy - 11, cx + 11, cy + 11), fill=FIRE_HI)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(255, 250, 220, 255))
    return outlined(glow(im, FIRE_MID, radius=9, strength=0.8), 2)


def spr_water_ult() -> Image.Image:
    im = shadow_base(S, 48, 42, 72)
    tower_pedestal(im, 48, ICE_HI, ICE_DEEP)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    for i in range(6):
        a = 2 * math.pi * i / 6
        tip = (cx + 44 * math.cos(a), cy + 44 * math.sin(a))
        l = (cx + 18 * math.cos(a - 0.28), cy + 18 * math.sin(a - 0.28))
        r = (cx + 18 * math.cos(a + 0.28), cy + 18 * math.sin(a + 0.28))
        d.polygon([tip, l, r], fill=ICE_HI)
        b = a + math.pi / 6
        tip2 = (cx + 34 * math.cos(b), cy + 34 * math.sin(b))
        l2 = (cx + 16 * math.cos(b - 0.2), cy + 16 * math.sin(b - 0.2))
        r2 = (cx + 16 * math.cos(b + 0.2), cy + 16 * math.sin(b + 0.2))
        d.polygon([tip2, l2, r2], fill=ICE_MID)
    d.polygon(reg_poly(cx, cy, 20, 6, rot=0), fill=ICE_DEEP)
    d.polygon(reg_poly(cx, cy, 14, 6, rot=math.pi / 6), fill=ICE_MID)
    d.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(255, 255, 255, 245))
    return outlined(glow(im, ICE_HI, radius=9, strength=0.8), 2)


def spr_earth_ult() -> Image.Image:
    im = shadow_base(S, 48, 42, 72)
    tower_pedestal(im, 48, STONE_HI, STONE_DARK)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.polygon(reg_poly(cx, cy, 36, 8, rot=0), fill=STONE_MID)
    d.polygon(reg_poly(cx, cy, 28, 8, rot=math.pi / 8), fill=STONE_LIGHT)
    for a_deg in (20, 85, 145, 210, 275, 330):
        a = math.radians(a_deg)
        x1 = cx + 8 * math.cos(a)
        y1 = cy + 8 * math.sin(a)
        x2 = cx + 32 * math.cos(a)
        y2 = cy + 32 * math.sin(a)
        d.line([(x1, y1), (x2, y2)], fill=AMBER_HI, width=4)
        d.line([(x1, y1), (x2, y2)], fill=FIRE_MID, width=2)
    d.polygon(reg_poly(cx, cy, 15, 6, rot=0), fill=STONE_DARK)
    d.polygon(reg_poly(cx, cy, 10, 6, rot=math.pi / 6), fill=AMBER)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=AMBER_HI)
    return outlined(glow(im, AMBER, radius=8, strength=0.7), 2)


def spr_nature_ult() -> Image.Image:
    im = shadow_base(S, 48, 42, 72)
    tower_pedestal(im, 48, WOOD_LIGHT, PINE_DARK)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    for i in range(6):
        a = 2 * math.pi * i / 6
        x2 = cx + 40 * math.cos(a)
        y2 = cy + 40 * math.sin(a)
        d.line([(cx, cy), (x2, y2)], fill=WOOD_MID, width=7)
        d.line([(cx, cy), (x2, y2)], fill=WOOD_LIGHT, width=3)
    for i in range(8):
        a = 2 * math.pi * i / 8
        lx = cx + 22 * math.cos(a)
        ly = cy + 22 * math.sin(a)
        d.ellipse((lx - 14, ly - 14, lx + 14, ly + 14), fill=PINE_DARK)
        d.ellipse((lx - 11, ly - 11, lx + 11, ly + 11), fill=PINE_MID)
    d.ellipse((cx - 22, cy - 22, cx + 22, cy + 22), fill=PINE_LIGHT)
    d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=AMBER)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=AMBER_HI)
    return outlined(glow(im, PINE_LIGHT, radius=8, strength=0.7), 2)


# ---------------------------------------------------------------------------
# ENEMIES (5) + HERO (1)
# ---------------------------------------------------------------------------

def spr_grunt() -> Image.Image:
    im = shadow_base(S, 34, 28, 76)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2 + 4
    d.polygon([(cx + 30, cy - 30), (cx + 48, cy - 18), (cx + 42, cy + 4), (cx + 26, cy - 8)], fill=IRON_LIGHT)
    d.line([(cx + 20, cy + 22), (cx + 34, cy - 26)], fill=WOOD_MID, width=5)
    d.ellipse((cx - 34, cy - 18, cx + 34, cy + 22), fill=CRIMSON_DARK)
    d.ellipse((cx - 28, cy - 14, cx + 28, cy + 18), fill=FLESH_DARK)
    d.ellipse((cx - 36, cy - 14, cx - 12, cy + 14), fill=IRON_MID)
    d.ellipse((cx + 12, cy - 14, cx + 36, cy + 14), fill=IRON_MID)
    d.ellipse((cx - 28, cy - 8, cx - 20, cy), fill=STONE_HI)
    d.ellipse((cx + 20, cy - 8, cx + 28, cy), fill=STONE_HI)
    d.ellipse((cx - 18, cy - 24, cx + 18, cy + 10), fill=IRON_DARK)
    d.ellipse((cx - 15, cy - 22, cx + 15, cy + 6), fill=IRON_LIGHT)
    d.polygon([(cx - 14, cy - 16), (cx - 28, cy - 34), (cx - 6, cy - 20)], fill=STONE_HI)
    d.polygon([(cx + 14, cy - 16), (cx + 28, cy - 34), (cx + 6, cy - 20)], fill=STONE_HI)
    d.ellipse((cx - 9, cy - 12, cx - 3, cy - 6), fill=FIRE_HI)
    d.ellipse((cx + 3, cy - 12, cx + 9, cy - 6), fill=FIRE_HI)
    return outlined(im, 2)


def spr_runner() -> Image.Image:
    im = shadow_base(S, 30, 26, 74)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    d.polygon([(cx, cy - 36), (cx - 26, cy + 20), (cx, cy + 10), (cx + 26, cy + 20)], fill=PINE_DARK)
    d.polygon([(cx, cy - 32), (cx - 20, cy + 16), (cx, cy + 6), (cx + 20, cy + 16)], fill=PINE_MID)
    d.polygon([(cx - 18, cy + 6), (cx - 38, cy - 20), (cx - 30, cy - 24), (cx - 12, cy)], fill=IRON_LIGHT)
    d.polygon([(cx + 18, cy + 6), (cx + 38, cy - 20), (cx + 30, cy - 24), (cx + 12, cy)], fill=IRON_LIGHT)
    d.polygon([(cx, cy - 38), (cx - 14, cy - 10), (cx + 14, cy - 10)], fill=PINE_LIGHT)
    d.ellipse((cx - 8, cy - 22, cx - 2, cy - 16), fill=AMBER_HI)
    d.ellipse((cx + 2, cy - 22, cx + 8, cy - 16), fill=AMBER_HI)
    return outlined(im, 2)


def spr_golem() -> Image.Image:
    im = shadow_base(S, 44, 38, 76)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2 + 2
    d.polygon(reg_poly(cx, cy, 42, 7, rot=0.2), fill=STONE_DARK)
    d.polygon(reg_poly(cx, cy - 2, 36, 7, rot=0.2), fill=STONE_MID)
    d.polygon(reg_poly(cx - 28, cy - 4, 16, 6), fill=STONE_LIGHT)
    d.polygon(reg_poly(cx + 28, cy - 4, 16, 6), fill=STONE_LIGHT)
    d.line([(cx - 18, cy - 20), (cx, cy - 4), (cx + 16, cy - 18)], fill=AMBER_HI, width=4)
    d.line([(cx, cy - 4), (cx - 6, cy + 22)], fill=AMBER, width=4)
    d.line([(cx, cy - 4), (cx + 12, cy + 18)], fill=AMBER, width=3)
    d.polygon(reg_poly(cx, cy - 20, 14, 6), fill=STONE_LIGHT)
    d.ellipse((cx - 8, cy - 24, cx - 2, cy - 18), fill=AMBER_HI)
    d.ellipse((cx + 2, cy - 24, cx + 8, cy - 18), fill=AMBER_HI)
    return outlined(glow(im, AMBER, radius=5, strength=0.45), 2)


def spr_wyvern() -> Image.Image:
    im = shadow_base(S, 42, 32, 80)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2
    left_wing = [(cx - 6, cy - 6), (cx - 54, cy - 28), (cx - 48, cy + 6), (cx - 32, cy + 18), (cx - 10, cy + 10)]
    right_wing = [(cx + 6, cy - 6), (cx + 54, cy - 28), (cx + 48, cy + 6), (cx + 32, cy + 18), (cx + 10, cy + 10)]
    d.polygon(left_wing, fill=ARC_DEEP)
    d.polygon(right_wing, fill=ARC_DEEP)
    d.polygon([(cx - 8, cy - 4), (cx - 48, cy - 22), (cx - 40, cy + 4), (cx - 12, cy + 6)], fill=ARC_MID)
    d.polygon([(cx + 8, cy - 4), (cx + 48, cy - 22), (cx + 40, cy + 4), (cx + 12, cy + 6)], fill=ARC_MID)
    d.line([(cx - 8, cy - 4), (cx - 48, cy - 22)], fill=ARC_HI, width=2)
    d.line([(cx + 8, cy - 4), (cx + 48, cy - 22)], fill=ARC_HI, width=2)
    d.ellipse((cx - 14, cy - 24, cx + 14, cy + 22), fill=ARC_DEEP)
    d.ellipse((cx - 10, cy - 20, cx + 10, cy + 18), fill=ARC_HI)
    d.polygon([(cx, cy + 20), (cx - 6, cy + 46), (cx, cy + 54), (cx + 6, cy + 46)], fill=ARC_MID)
    d.polygon([(cx, cy - 42), (cx - 12, cy - 18), (cx + 12, cy - 18)], fill=ARC_MID)
    d.ellipse((cx - 7, cy - 28, cx - 2, cy - 23), fill=AMBER_HI)
    d.ellipse((cx + 2, cy - 28, cx + 7, cy - 23), fill=AMBER_HI)
    return outlined(im, 2)


def spr_boss_goliath() -> Image.Image:
    im = shadow_base(S, 50, 44, 74)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2 + 2
    for i in range(10):
        a = 2 * math.pi * i / 10
        tip = (cx + 54 * math.cos(a), cy + 54 * math.sin(a))
        l = (cx + 34 * math.cos(a - 0.22), cy + 34 * math.sin(a - 0.22))
        r = (cx + 34 * math.cos(a + 0.22), cy + 34 * math.sin(a + 0.22))
        d.polygon([tip, l, r], fill=GOLD_LIGHT if i % 2 == 0 else CRIMSON)
    d.polygon(reg_poly(cx, cy, 40, 8, rot=math.pi / 8), fill=CRIMSON_DARK)
    d.polygon(reg_poly(cx, cy, 34, 8, rot=math.pi / 8), fill=IRON_DARK)
    d.polygon(reg_poly(cx, cy, 26, 8, rot=0), fill=CRIMSON)
    d.ellipse((cx - 16, cy - 12, cx + 16, cy + 18), fill=FIRE_MID)
    d.ellipse((cx - 10, cy - 6, cx + 10, cy + 12), fill=FIRE_HI)
    d.polygon(reg_poly(cx, cy - 22, 16, 6), fill=IRON_LIGHT)
    d.polygon([(cx - 12, cy - 28), (cx - 32, cy - 48), (cx - 6, cy - 34)], fill=GOLD_LIGHT)
    d.polygon([(cx + 12, cy - 28), (cx + 32, cy - 48), (cx + 6, cy - 34)], fill=GOLD_LIGHT)
    d.ellipse((cx - 9, cy - 24, cx - 2, cy - 17), fill=FIRE_HI)
    d.ellipse((cx + 2, cy - 24, cx + 9, cy - 17), fill=FIRE_HI)
    return outlined(glow(im, FIRE_MID, radius=7, strength=0.65), 2)


def spr_hero() -> Image.Image:
    im = shadow_base(S, 38, 34, 76)
    d = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2 + 2
    d.polygon([(cx - 28, cy - 10), (cx + 28, cy - 10), (cx + 36, cy + 38), (cx - 36, cy + 38)], fill=CRIMSON_DARK)
    d.polygon([(cx - 24, cy - 8), (cx + 24, cy - 8), (cx + 30, cy + 34), (cx - 30, cy + 34)], fill=CRIMSON)
    d.line([(cx + 28, cy + 24), (cx + 34, cy - 34)], fill=WOOD_LIGHT, width=6)
    d.rounded_rectangle((cx + 20, cy - 46, cx + 48, cy - 28), radius=4, fill=GOLD_LIGHT)
    d.rounded_rectangle((cx + 23, cy - 43, cx + 45, cy - 31), radius=3, fill=AMBER)
    d.polygon([(cx - 38, cy - 16), (cx - 16, cy - 16), (cx - 18, cy + 16), (cx - 27, cy + 26), (cx - 36, cy + 16)], fill=GOLD_LIGHT)
    d.polygon([(cx - 35, cy - 13), (cx - 19, cy - 13), (cx - 21, cy + 13), (cx - 27, cy + 21), (cx - 33, cy + 13)], fill=AMBER)
    d.ellipse((cx - 28, cy - 16, cx + 28, cy + 16), fill=GOLD_MID)
    d.ellipse((cx - 22, cy - 12, cx + 22, cy + 12), fill=GOLD_LIGHT)
    d.ellipse((cx - 15, cy - 22, cx + 15, cy + 8), fill=GOLD_LIGHT)
    d.polygon([(cx - 12, cy - 20), (cx - 6, cy - 34), (cx, cy - 22), (cx + 6, cy - 34), (cx + 12, cy - 20)], fill=AMBER_HI)
    d.ellipse((cx - 5, cy - 12, cx + 5, cy - 2), fill=AMBER_HI)
    return outlined(glow(im, AMBER, radius=7, strength=0.7), 2)


# ---------------------------------------------------------------------------
# MAP LANDMARKS: CITADEL (160x160) & SPAWN PORTAL (112x112)
# ---------------------------------------------------------------------------

def spr_citadel() -> Image.Image:
    """160x160 Baltic Amber Hall — strictly 4-way / mirror symmetric for art.test.mjs."""
    sz = 160
    im = new(sz)
    d = ImageDraw.Draw(im)
    cx, cy = sz // 2, sz // 2
    d.polygon(reg_poly(cx, cy, 72, 8, rot=math.pi / 8), fill=STONE_DARK)
    d.polygon(reg_poly(cx, cy, 66, 8, rot=math.pi / 8), fill=STONE_MID)
    d.polygon(reg_poly(cx, cy, 58, 8, rot=math.pi / 8), fill=STONE_LIGHT)
    for dx, dy in ((0, -60), (0, 60), (-60, 0), (60, 0)):
        d.ellipse((cx + dx - 10, cy + dy - 10, cx + dx + 10, cy + dy + 10), fill=GOLD_MID)
    for sx in (-1, 1):
        for sy in (-1, 1):
            bx, by = cx + sx * 42, cy + sy * 42
            d.ellipse((bx - 18, by - 18, bx + 18, by + 18), fill=STONE_DARK)
            d.ellipse((bx - 15, by - 15, bx + 15, by + 15), fill=PINE_DARK)
            d.ellipse((bx - 11, by - 11, bx + 11, by + 11), fill=PINE_MID)
            d.ellipse((bx - 5, by - 5, bx + 5, by + 5), fill=GOLD_LIGHT)
    d.rounded_rectangle((cx - 38, cy - 38, cx + 38, cy + 38), radius=10, fill=WOOD_DARK)
    d.rounded_rectangle((cx - 34, cy - 34, cx + 34, cy + 34), radius=8, fill=WOOD_MID)
    d.rectangle((cx - 34, cy - 4, cx + 34, cy + 4), fill=GOLD_MID)
    d.rectangle((cx - 4, cy - 34, cx + 4, cy + 34), fill=GOLD_MID)
    d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=GOLD_DARK)
    d.ellipse((cx - 20, cy - 20, cx + 20, cy + 20), fill=AMBER)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=AMBER_HI)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(255, 252, 230, 255))
    d.polygon([(cx - 42, cy - 42), (cx - 58, cy - 48), (cx - 42, cy - 54)], fill=AMBER)
    d.polygon([(cx + 42, cy - 42), (cx + 58, cy - 48), (cx + 42, cy - 54)], fill=AMBER)
    return outlined(glow(im, AMBER, radius=6, strength=0.55), 2)


def spr_spawn_portal() -> Image.Image:
    """112x112 Runic Void Portal — strictly 4-way symmetric for art.test.mjs."""
    sz = 112
    im = new(sz)
    d = ImageDraw.Draw(im)
    cx, cy = sz // 2, sz // 2
    d.ellipse((cx - 46, cy - 46, cx + 46, cy + 46), fill=STONE_DARK)
    d.ellipse((cx - 42, cy - 42, cx + 42, cy + 42), fill=STONE_MID)
    for i in range(8):
        a = 2 * math.pi * i / 8
        rx = cx + 38 * math.cos(a)
        ry = cy + 38 * math.sin(a)
        d.ellipse((rx - 5, ry - 5, rx + 5, ry + 5), fill=ARC_HI)
    d.ellipse((cx - 32, cy - 32, cx + 32, cy + 32), fill=ARC_DEEP)
    d.ellipse((cx - 25, cy - 25, cx + 25, cy + 25), fill=ARC_MID)
    for k in range(4):
        base = 2 * math.pi * k / 4
        pts = []
        for s_idx in range(14):
            t = s_idx / 13
            ang = base + t * 1.8
            r = 4 + t * 24
            pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
        d.line(pts, fill=ARC_HI, width=3)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=ARC_HI)
    d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=(255, 255, 255, 250))
    return outlined(glow(im, ARC_MID, radius=5, strength=0.6), 2)


def main() -> None:
    sprites = {
        "arrow_t1": spr_arrow_t1,
        "arrow_t2": spr_arrow_t2,
        "cannon_t1": spr_cannon_t1,
        "cannon_t2": spr_cannon_t2,
        "magic_t1": spr_magic_t1,
        "magic_t2": spr_magic_t2,
        "slow_t1": spr_slow_t1,
        "slow_t2": spr_slow_t2,
        "acid_t1": spr_acid_t1,
        "watchtower": spr_watchtower,
        "fire_ult": spr_fire_ult,
        "water_ult": spr_water_ult,
        "earth_ult": spr_earth_ult,
        "nature_ult": spr_nature_ult,
        "grunt": spr_grunt,
        "runner": spr_runner,
        "golem": spr_golem,
        "wyvern": spr_wyvern,
        "boss_goliath": spr_boss_goliath,
        "hero": spr_hero,
        "citadel": spr_citadel,
        "spawn_portal": spr_spawn_portal,
    }
    for name, fn in sprites.items():
        save(name, fn())
    print(f"Generated {len(sprites)} sprites in {OUT}")


if __name__ == "__main__":
    main()
