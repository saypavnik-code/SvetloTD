import os
import subprocess
import sys

def pack_textures():
    print("Начинаю упаковку текстур для Phaser...")
    assets_dir = "./raw_assets"
    output_dir = "./public/assets/atlas"
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Пример использования бесплатного CLI инструмента (например, free-tex-packer-cli)
    # Команда соберет все PNG из raw_assets и создаст game_atlas.png и game_atlas.json
    command = [
        "npx", "free-tex-packer-cli",
        "--project", assets_dir,
        "--output", output_dir,
        "--format", "phaser3",
        "--ext", "png"
    ]
    
    try:
        subprocess.run(command, check=True)
        print("Упаковка успешно завершена!")
    except subprocess.CalledProcessError as e:
        print(f"Ошибка упаковки текстур: {e}")
        sys.exit(1)

if __name__ == "__main__":
    pack_textures()
