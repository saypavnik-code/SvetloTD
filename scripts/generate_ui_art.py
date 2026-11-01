#!/usr/bin/env python3
"""Generate Baltic-amber themed UI medallions, tower/resource icons, and 80x80 terrain tiles.

All icons are rendered at 4x supersampling and downsampled with LANCZOS for crisp
anti-aliased edges, metallic bevels, and distinct silhouettes tested by tests/art.test.mjs.
"""

import math
import random
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
UI_OUT = ROOT / "public" / "assets" / "ui"
TILE_OUT = ROOT / "public" / "assets" / "tiles"
UI_OUT.mkdir(parents=True, exist_ok=True)
TILE_OUT.mkdir(parents=True, exist_ok=True)

INK = (26, 20, 16, 255)
BRONZE_DARK = (92, 66, 30, 255)
BRONZE_MID = (154, 116, 52, 255)
BRONZE_HI = (232, 194, 114, 255)


def reg_poly(cx: float, cy: float, r: float, n: int, rot: float = -math.pi / 2):
    return [
        (cx + r * math.cos(rot + 2 * math.pi * i / n),
         cy + r * math.sin(rot + 2 * math.pi * i / n))
        for i in range(n)
    ]


def medallion(size: int, bg_top, bg_bot, shape: str = "circle") -> tuple[Image.Image, ImageDraw.ImageDraw, int]:
    """Create a 4x supersampled medallion canvas with bevelled bronze rim and transparent corners."""
    ss = size * 4
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = ss // 2, ss // 2
    r_outer = int(ss * 0.44)
    r_mid = int(ss * 0.39)
    r_inner = int(ss * 0.34)

    def draw_shape(r: int, fill):
        if shape == "circle":
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)
        elif shape == "hex":
            d.polygon(reg_poly(cx, cy, r, 6, rot=math.pi / 6), fill=fill)
        elif shape == "oct":
            d.polygon(reg_poly(cx, cy, r, 8, rot=math.pi / 8), fill=fill)
        elif shape == "diamond":
            d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)
        elif shape == "shield":
            pts = [
                (cx - int(r * 0.85), cy - int(r * 0.82)),
                (cx + int(r * 0.85), cy - int(r * 0.82)),
                (cx + int(r * 0.78), cy + int(r * 0.18)),
                (cx, cy + r),
                (cx - int(r * 0.78), cy + int(r * 0.18)),
            ]
            d.polygon(pts, fill=fill)

    draw_shape(r_outer, INK)
    draw_shape(int(r_outer * 0.94), BRONZE_DARK)
    draw_shape(r_mid, BRONZE_HI)
    draw_shape(int(r_mid * 0.94), BRONZE_MID)
    draw_shape(r_inner, bg_bot)

    sheen_r = int(r_inner * 0.88)
    d.pieslice((cx - sheen_r, cy - sheen_r, cx + sheen_r, cy + sheen_r), 195, 345, fill=bg_top)
    if shape in ("circle", "oct", "hex"):
        rivet_r = int((r_mid + r_inner) * 0.5)
        for a_deg in (45, 135, 225, 315):
            a = math.radians(a_deg)
            rx = int(cx + rivet_r * math.cos(a))
            ry = int(cy + rivet_r * math.sin(a))
            rr = max(3, ss // 48)
            d.ellipse((rx - rr, ry - rr, rx + rr, ry + rr), fill=BRONZE_HI, outline=INK)
    return im, d, ss


def finalize(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.Resampling.LANCZOS)


def save_ui(name: str, im: Image.Image) -> None:
    im.save(UI_OUT / f"{name}.png", "PNG")


def gen_builders() -> None:
    sz = 96
    # fire
    im, d, ss = medallion(sz, (190, 58, 26, 255), (98, 22, 14, 255), "oct")
    c = ss // 2
    d.polygon([(c, int(ss * 0.20)), (int(ss * 0.68), int(ss * 0.56)),
               (int(ss * 0.58), int(ss * 0.76)), (int(ss * 0.42), int(ss * 0.76)),
               (int(ss * 0.32), int(ss * 0.56))], fill=(255, 138, 42, 255), outline=INK)
    d.polygon([(c, int(ss * 0.32)), (int(ss * 0.58), int(ss * 0.58)),
               (c, int(ss * 0.72)), (int(ss * 0.42), int(ss * 0.58))], fill=(255, 232, 132, 255))
    save_ui("builder_fire", finalize(im, sz))

    # water
    im, d, ss = medallion(sz, (46, 128, 188, 255), (22, 62, 108, 255), "hex")
    c = ss // 2
    for i in range(6):
        a = math.pi * i / 3
        x2 = c + int(ss * 0.25 * math.cos(a))
        y2 = c + int(ss * 0.25 * math.sin(a))
        d.line([(c, c), (x2, y2)], fill=(214, 244, 255, 255), width=14)
    d.polygon(reg_poly(c, c, int(ss * 0.14), 6), fill=(116, 198, 246, 255), outline=INK)
    save_ui("builder_water", finalize(im, sz))

    # earth
    im, d, ss = medallion(sz, (138, 104, 68, 255), (72, 52, 34, 255), "oct")
    c = ss // 2
    d.polygon([(c, int(ss * 0.24)), (int(ss * 0.70), int(ss * 0.68)), (int(ss * 0.30), int(ss * 0.68))],
              fill=(206, 174, 132, 255), outline=INK)
    d.polygon([(c, int(ss * 0.24)), (int(ss * 0.52), int(ss * 0.68)), (int(ss * 0.30), int(ss * 0.68))],
              fill=(238, 212, 174, 255))
    save_ui("builder_earth", finalize(im, sz))

    # nature
    im, d, ss = medallion(sz, (64, 138, 72, 255), (28, 74, 36, 255), "circle")
    c = ss // 2
    d.polygon([(c, int(ss * 0.22)), (int(ss * 0.68), int(ss * 0.50)),
               (c, int(ss * 0.76)), (int(ss * 0.32), int(ss * 0.50))],
              fill=(146, 218, 118, 255), outline=INK)
    d.line([(c, int(ss * 0.26)), (c, int(ss * 0.72))], fill=INK, width=8)
    save_ui("builder_nature", finalize(im, sz))

    # light
    im, d, ss = medallion(sz, (224, 176, 68, 255), (132, 92, 24, 255), "circle")
    c = ss // 2
    for i in range(8):
        a = math.pi * i / 4
        r_tip = int(ss * (0.28 if i % 2 == 0 else 0.20))
        tip = (c + int(r_tip * math.cos(a)), c + int(r_tip * math.sin(a)))
        l = (c + int(ss * 0.10 * math.cos(a - 0.3)), c + int(ss * 0.10 * math.sin(a - 0.3)))
        r = (c + int(ss * 0.10 * math.cos(a + 0.3)), c + int(ss * 0.10 * math.sin(a + 0.3)))
        d.polygon([tip, l, r], fill=(255, 242, 178, 255))
    d.ellipse((c - 34, c - 34, c + 34, c + 34), fill=(255, 214, 96, 255), outline=INK)
    save_ui("builder_light", finalize(im, sz))

    # shadow
    im, d, ss = medallion(sz, (108, 64, 168, 255), (48, 24, 84, 255), "diamond")
    c = ss // 2
    d.ellipse((c - 72, c - 72, c + 72, c + 72), fill=(224, 192, 255, 255))
    d.ellipse((c - 36, c - 82, c + 84, c + 48), fill=(58, 30, 98, 255))
    save_ui("builder_shadow", finalize(im, sz))


def gen_damage_icons() -> None:
    sz = 64
    ss = sz * 4
    c = ss // 2

    # normal
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(c, 22), (c + 34, 70), (c + 22, 182), (c - 22, 182), (c - 34, 70)], fill=INK)
    d.polygon([(c, 32), (c + 24, 72), (c + 14, 174), (c - 14, 174), (c - 24, 72)], fill=(214, 222, 232, 255))
    d.rectangle((c - 56, 172, c + 56, 198), fill=BRONZE_HI, outline=INK, width=6)
    d.rectangle((c - 16, 196, c + 16, 234), fill=BRONZE_DARK, outline=INK, width=6)
    save_ui("dmg_normal", finalize(im, sz))

    # piercing
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(34, 34), (132, 48), (98, 82), (222, 206), (206, 222), (82, 98), (48, 132)],
              fill=(244, 206, 112, 255), outline=INK)
    d.polygon([(222, 34), (208, 132), (174, 98), (50, 222), (34, 206), (158, 82), (124, 48)],
              fill=(178, 224, 132, 255), outline=INK)
    save_ui("dmg_piercing", finalize(im, sz))

    # magic
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(c, 18), (c + 32, c - 32), (238, c), (c + 32, c + 32),
           (c, 238), (c - 32, c + 32), (18, c), (c - 32, c - 32)]
    d.polygon(pts, fill=(186, 128, 255, 255), outline=INK)
    d.ellipse((c - 38, c - 38, c + 38, c + 38), fill=(238, 214, 255, 255), outline=INK, width=6)
    save_ui("dmg_magic", finalize(im, sz))

    # siege
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((34, 72, 202, 236), fill=(68, 74, 84, 255), outline=INK, width=10)
    d.ellipse((62, 98, 118, 148), fill=(154, 164, 178, 255))
    d.polygon([(168, 22), (234, 34), (212, 96), (154, 78)], fill=(255, 168, 48, 255), outline=INK)
    save_ui("dmg_siege", finalize(im, sz))

    # chaos
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(26, 26), (168, 28), (232, 128), (168, 228), (58, 198), (118, 128)],
              fill=(232, 68, 54, 255), outline=INK)
    d.ellipse((72, 72, 176, 176), fill=(255, 196, 84, 255), outline=INK, width=8)
    save_ui("dmg_chaos", finalize(im, sz))


def gen_armor_icons() -> None:
    sz = 64
    ss = sz * 4
    c = ss // 2

    # unarmored
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(48, 44), (96, 36), (c, 78), (160, 36), (208, 44),
           (232, 108), (192, 124), (192, 226), (64, 226), (64, 124), (24, 108)]
    d.polygon(pts, fill=(198, 176, 142, 255), outline=INK)
    save_ui("armor_unarmored", finalize(im, sz))

    # light
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((28, 28, 196, 196), fill=(178, 128, 78, 255), outline=INK, width=10)
    d.ellipse((86, 86, 138, 138), fill=BRONZE_HI, outline=INK, width=6)
    d.polygon([(148, 148), (232, 196), (204, 232), (132, 172)], fill=BRONZE_MID, outline=INK)
    save_ui("armor_light", finalize(im, sz))

    # medium
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(18, 92), (108, 52), (c, 88), (148, 52), (238, 92),
               (222, 192), (148, 168), (c, 204), (108, 168), (34, 192)],
              fill=(152, 162, 178, 255), outline=INK)
    save_ui("armor_medium", finalize(im, sz))

    # heavy
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(c, 20), (198, 64), (204, 218), (c, 238), (52, 218), (58, 64)],
              fill=(124, 134, 148, 255), outline=INK)
    d.rectangle((78, 108, 178, 128), fill=INK)
    d.rectangle((c - 12, 108, c + 12, 206), fill=INK)
    save_ui("armor_heavy", finalize(im, sz))

    # fortified
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(28, 36), (76, 36), (76, 76), (104, 76), (104, 36), (152, 36),
           (152, 76), (180, 76), (180, 36), (228, 36), (236, 224), (20, 224)]
    d.polygon(pts, fill=(164, 152, 136, 255), outline=INK)
    save_ui("armor_fortified", finalize(im, sz))

    # heroic
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(22, 184), (36, 68), (88, 132), (c, 28), (168, 132), (220, 68), (234, 184)]
    d.polygon(pts, fill=(244, 202, 88, 255), outline=INK)
    save_ui("armor_heroic", finalize(im, sz))


def gen_hud_and_tower_icons() -> None:
    sz = 64
    im, d, ss = medallion(sz, (252, 214, 98, 255), (184, 128, 28, 255), "circle")
    c = ss // 2
    d.polygon(reg_poly(c, c, int(ss * 0.22), 6), fill=(255, 238, 158, 255), outline=INK)
    save_ui("icon_gold", finalize(im, sz))

    im, d, ss = medallion(sz, (108, 178, 92, 255), (44, 96, 48, 255), "hex")
    c = ss // 2
    d.polygon([(c, int(ss * 0.20)), (int(ss * 0.68), int(ss * 0.54)), (int(ss * 0.32), int(ss * 0.54))],
              fill=(152, 222, 118, 255), outline=INK)
    d.polygon([(c, int(ss * 0.36)), (int(ss * 0.72), int(ss * 0.70)), (int(ss * 0.28), int(ss * 0.70))],
              fill=(118, 192, 92, 255), outline=INK)
    d.rectangle((c - 14, int(ss * 0.68), c + 14, int(ss * 0.80)), fill=(138, 92, 48, 255), outline=INK)
    save_ui("icon_lumber", finalize(im, sz))

    im, d, ss = medallion(sz, (224, 72, 72, 255), (128, 24, 28, 255), "shield")
    c = ss // 2
    d.ellipse((c - 54, c - 48, c + 4, c + 10), fill=(255, 138, 138, 255))
    d.ellipse((c - 4, c - 48, c + 54, c + 10), fill=(255, 138, 138, 255))
    d.polygon([(c - 52, c - 12), (c + 52, c - 12), (c, c + 58)], fill=(255, 138, 138, 255))
    save_ui("icon_heart", finalize(im, sz))

    art_dir = ROOT / "public" / "assets" / "art"
    mapping = {
        "tw_arrow": ("arrow_t1", (118, 168, 94, 255), (52, 88, 44, 255), "circle"),
        "tw_cannon": ("cannon_t1", (168, 112, 74, 255), (84, 48, 32, 255), "oct"),
        "tw_magic": ("magic_t1", (152, 98, 224, 255), (68, 36, 124, 255), "hex"),
        "tw_slow": ("slow_t1", (92, 178, 232, 255), (34, 84, 134, 255), "hex"),
        "tw_acid": ("acid_t1", (132, 206, 68, 255), (48, 98, 28, 255), "oct"),
        "tw_watchtower": ("watchtower", (236, 182, 74, 255), (124, 82, 24, 255), "shield"),
    }
    for out_name, (spr_name, top_c, bot_c, shp) in mapping.items():
        im, _d, _ss = medallion(96, top_c, bot_c, shp)
        base_ic = finalize(im, 96)
        spr_path = art_dir / f"{spr_name}.png"
        if spr_path.exists():
            spr = Image.open(spr_path).convert("RGBA").resize((76, 76), Image.Resampling.LANCZOS)
            base_ic.alpha_composite(spr, (10, 10))
        save_ui(out_name, base_ic)


def gen_grass_tile(seed: int, flower_kind: int) -> Image.Image:
    rng = random.Random(seed)
    ss = 160
    im = Image.new("RGBA", (ss, ss), (52, 86, 48, 255))
    px = im.load()
    p1 = rng.uniform(0, math.tau)
    p2 = rng.uniform(0, math.tau)
    for y in range(ss):
        uy = math.tau * y / ss
        for x in range(ss):
            ux = math.tau * x / ss
            w = (
                math.sin(ux * 2 + p1) * math.cos(uy * 2 + p2)
                + 0.5 * math.sin((ux + uy) * 3 - p1)
                + 0.35 * math.cos((ux - uy * 2) * 4 + p2)
            )
            grain = rng.randint(-4, 4)
            delta = int(w * 8 + grain)
            r = max(34, min(78, 52 + delta))
            g = max(64, min(114, 88 + int(delta * 1.2)))
            b = max(32, min(70, 48 + int(delta * 0.7)))
            px[x, y] = (r, g, b, 255)

    d = ImageDraw.Draw(im)
    for _ in range(95):
        gx = rng.randint(6, ss - 7)
        gy = rng.randint(8, ss - 7)
        dark = (38, 66, 36, 220)
        light = (78, 122, 66, 235)
        d.line([(gx, gy + 2), (gx - 2, gy - 5)], fill=dark, width=2)
        d.line([(gx + 1, gy + 2), (gx + 3, gy - 4)], fill=light, width=2)

    if flower_kind == 1:
        for _ in range(5):
            fx = rng.randint(18, ss - 18)
            fy = rng.randint(18, ss - 18)
            d.ellipse((fx - 4, fy - 4, fx + 4, fy + 4), fill=(242, 184, 68, 255))
            d.ellipse((fx - 2, fy - 2, fx + 2, fy + 2), fill=(255, 236, 164, 255))
    elif flower_kind == 2:
        for _ in range(4):
            rx = rng.randint(18, ss - 18)
            ry = rng.randint(18, ss - 18)
            d.ellipse((rx - 6, ry - 4, rx + 6, ry + 5), fill=(40, 44, 38, 200))
            d.ellipse((rx - 5, ry - 4, rx + 5, ry + 3), fill=(112, 110, 102, 255))
            d.ellipse((rx - 3, ry - 3, rx + 2, ry), fill=(156, 152, 142, 255))
    elif flower_kind == 3:
        for _ in range(6):
            cx = rng.randint(16, ss - 16)
            cy = rng.randint(16, ss - 16)
            for dx, dy in ((-3, 0), (3, 0), (0, -3), (0, 3)):
                d.ellipse((cx + dx - 3, cy + dy - 3, cx + dx + 3, cy + dy + 3), fill=(92, 146, 78, 255))

    return im.resize((80, 80), Image.Resampling.LANCZOS)


def gen_path_tile(seed: int, variant: int) -> Image.Image:
    rng = random.Random(seed)
    ss = 160
    im = Image.new("RGBA", (ss, ss), (98, 82, 62, 255))
    px = im.load()
    for y in range(ss):
        for x in range(ss):
            n = rng.randint(-6, 6)
            px[x, y] = (96 + n, 80 + n, 60 + n, 255)

    d = ImageDraw.Draw(im)
    grid = 4
    cell = ss // grid
    for gy in range(grid):
        for gx in range(grid):
            ox = gx * cell + (6 if gy % 2 == 1 else 0)
            oy = gy * cell
            w = cell - 6
            h = cell - 6
            x0 = (ox + rng.randint(-2, 2)) % (ss - w - 2)
            y0 = (oy + rng.randint(-2, 2)) % (ss - h - 2)
            tone = rng.randint(-12, 14)
            base_c = (158 + tone, 136 + tone, 104 + tone, 255)
            hi_c = (min(235, 188 + tone), min(220, 166 + tone), min(190, 132 + tone), 255)
            sh_c = (78 + tone // 2, 64 + tone // 2, 48 + tone // 2, 255)
            d.rounded_rectangle((x0 + 2, y0 + 2, x0 + w + 2, y0 + h + 2), radius=8, fill=sh_c)
            d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=8, fill=base_c)
            d.arc((x0 + 2, y0 + 2, x0 + w - 2, y0 + h - 2), start=190, end=330, fill=hi_c, width=2)

    if variant == 1:
        for _ in range(10):
            ax = rng.randint(12, ss - 12)
            ay = rng.randint(12, ss - 12)
            d.ellipse((ax - 2, ay - 2, ax + 2, ay + 2), fill=(214, 174, 96, 210))
    elif variant == 2:
        for _ in range(8):
            mx = rng.randint(10, ss - 10)
            my = rng.randint(10, ss - 10)
            d.ellipse((mx - 4, my - 3, mx + 4, my + 3), fill=(76, 112, 62, 215))

    return im.resize((80, 80), Image.Resampling.LANCZOS)


def gen_tiles() -> None:
    for idx, suffix in enumerate(("a", "b", "c", "d")):
        gen_grass_tile(100 + idx * 17, idx).save(TILE_OUT / f"grass_{suffix}.png", "PNG")
    for idx, suffix in enumerate(("a", "b", "c")):
        gen_path_tile(300 + idx * 23, idx).save(TILE_OUT / f"path_{suffix}.png", "PNG")


def main() -> None:
    gen_builders()
    gen_damage_icons()
    gen_armor_icons()
    gen_hud_and_tower_icons()
    gen_tiles()
    print(f"Generated UI icons in {UI_OUT} and tiles in {TILE_OUT}")


if __name__ == "__main__":
    main()
