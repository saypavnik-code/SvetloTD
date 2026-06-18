import os
from PIL import Image, ImageDraw

def create_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def generate_all_assets():
    asset_dir = "./raw_assets"
    create_dir(asset_dir)
    print("Генерация временных графических ассетов...")

    # 1. Тайлы окружения (64x64)
    # Трава
    grass = Image.new("RGBA", (64, 64), (34, 139, 34, 255))
    draw = ImageDraw.Draw(grass)
    draw.rectangle([0, 0, 63, 63], outline=(46, 125, 50, 255), width=2)
    # Добавим текстурных точек
    for x in range(8, 64, 16):
        for y in range(8, 64, 16):
            draw.rectangle([x, y, x+2, y+2], fill=(100, 180, 100, 255))
    grass.save(f"{asset_dir}/tile_grass.png")

    # Дорога (путь врагов)
    road = Image.new("RGBA", (64, 64), (210, 180, 140, 255))
    draw = ImageDraw.Draw(road)
    draw.rectangle([0, 0, 63, 63], outline=(139, 115, 85, 255), width=1)
    road.save(f"{asset_dir}/tile_road.png")

    # 2. Башни (64x64)
    # Базовая пушка
    tower_base = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tower_base)
    draw.ellipse([8, 8, 56, 56], fill=(100, 110, 120, 255), outline=(50, 55, 60, 255), width=3)
    draw.rectangle([24, 4, 40, 32], fill=(140, 150, 160, 255)) # дуло
    tower_base.save(f"{asset_dir}/tower_base.png")

    # Магическая башня
    tower_mage = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tower_mage)
    draw.polygon([(32, 4), (8, 56), (56, 56)], fill=(106, 27, 154, 255), outline=(171, 71, 188, 255), width=3)
    draw.ellipse([24, 20, 40, 36], fill=(0, 229, 255, 255)) # кристалл
    tower_mage.save(f"{asset_dir}/tower_mage.png")

    # 3. Враги (48x48)
    # Обычный враг (Гоблин)
    enemy_scout = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    draw = ImageDraw.Draw(enemy_scout)
    draw.ellipse([6, 6, 42, 42], fill=(198, 40, 40, 255), outline=(136, 14, 14, 255), width=2)
    # "Глаза", чтобы видно было направление
    draw.ellipse([14, 16, 20, 22], fill=(255, 255, 255, 255))
    draw.ellipse([28, 16, 34, 22], fill=(255, 255, 255, 255))
    enemy_scout.save(f"{asset_dir}/enemy_scout.png")

    # Тяжелый враг (Босс)
    enemy_heavy = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(enemy_heavy)
    draw.rectangle([8, 8, 56, 56], fill=(74, 20, 140, 255), outline=(123, 31, 162, 255), width=4)
    enemy_heavy.save(f"{asset_dir}/enemy_heavy.png")

    # 4. Снаряды (16x16)
    bullet = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bullet)
    draw.ellipse([2, 2, 14, 14], fill=(255, 235, 59, 255), outline=(245, 127, 23, 255), width=1)
    bullet.save(f"{asset_dir}/projectile_laser.png")

    print("Все заглушки успешно сгенерированы в папку /raw_assets!")

if __name__ == "__main__":
    generate_all_assets()
