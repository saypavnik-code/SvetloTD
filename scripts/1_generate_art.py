import os
from PIL import Image, ImageDraw

# Цвета из твоего config.ts
COLORS = {
    'arrow_t1': (198, 142, 23),    # 0xC68E17
    'cannon_t1': (93, 64, 55),     # 0x5D4037
    'magic_t1': (245, 166, 35),    # 0xF5A623
    'slow_t1': (95, 138, 139),     # 0x5F8A8B
    'acid_t1': (107, 142, 107),    # 0x6B8E6B
    'watchtower': (212, 168, 75),  # 0xD4A84B
    'grunt': (74, 55, 40),         # 0x4A3728
    'runner': (44, 74, 62),        # 0x2C4A3E
    'golem': (92, 58, 33),         # 0x5C3A21
    'wyvern': (59, 52, 86),        # 0x3B3456
    'boss_goliath': (26, 10, 5)    # 0x1A0A05
}

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def draw_tower(filename, color, is_t2=False):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Основание
    draw.rectangle([8, 8, 56, 56], fill=(40, 35, 30), outline=(20, 15, 10), width=2)
    # Основной цвет башни
    pad = 4 if is_t2 else 12
    draw.rectangle([pad+8, pad+8, 56-pad, 56-pad], fill=color, outline=(0, 0, 0), width=2)
    img.save(filename)

def draw_enemy(filename, color, shape='circle', size=48):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = 4
    coords = [margin, margin, size-margin, size-margin]
    
    if shape == 'circle':
        draw.ellipse(coords, fill=color, outline=(0,0,0), width=2)
    elif shape == 'hex':
        draw.polygon([(size/2, margin), (size-margin, size/4), (size-margin, size*0.75), 
                      (size/2, size-margin), (margin, size*0.75), (margin, size/4)], 
                     fill=color, outline=(0,0,0), width=2)
    elif shape == 'diamond':
        draw.polygon([(size/2, margin), (size-margin, size/2), (size/2, size-margin), (margin, size/2)], 
                     fill=color, outline=(0,0,0), width=2)
                     
    img.save(filename)

def draw_tile(filename, bg_color, is_path=False):
    img = Image.new("RGBA", (64, 64), bg_color)
    draw = ImageDraw.Draw(img)
    if is_path:
        draw.rectangle([0, 0, 63, 63], outline=(100, 80, 50), width=2)
        draw.ellipse([28, 28, 36, 36], fill=(120, 100, 70)) # камешек
    else:
        draw.rectangle([0, 0, 63, 63], outline=(30, 35, 30), width=1)
    img.save(filename)

def generate_all():
    out = "./raw_assets"
    ensure_dir(out)
    print("Генерация базовых ассетов...")

    # Карты и тайлы
    draw_tile(f"{out}/tile_grass.png", (42, 38, 34))
    draw_tile(f"{out}/tile_path.png", (141, 118, 84), is_path=True)
    draw_tile(f"{out}/tile_base.png", (227, 166, 58))

    # Башни Т1 и поддержка
    towers = ['arrow_t1', 'cannon_t1', 'magic_t1', 'slow_t1', 'acid_t1', 'watchtower']
    for t in towers:
        draw_tower(f"{out}/{t}.png", COLORS[t])
        # Заглушки для T2
        if t != 'watchtower':
            draw_tower(f"{out}/{t.replace('_t1', '_t2')}.png", COLORS[t], is_t2=True)

    # Враги
    draw_enemy(f"{out}/enemy_grunt.png", COLORS['grunt'], 'circle')
    draw_enemy(f"{out}/enemy_runner.png", COLORS['runner'], 'diamond')
    draw_enemy(f"{out}/enemy_golem.png", COLORS['golem'], 'hex')
    draw_enemy(f"{out}/enemy_wyvern.png", COLORS['wyvern'], 'diamond')
    draw_enemy(f"{out}/enemy_boss.png", COLORS['boss_goliath'], 'hex', size=64)

    # Герой и снаряды
    draw_enemy(f"{out}/hero.png", (227, 166, 58), 'circle')
    draw_enemy(f"{out}/projectile.png", (255, 200, 100), 'circle', size=16)

    print(f"Успешно создано {len(os.listdir(out))} файлов.")

if __name__ == "__main__":
    generate_all()
