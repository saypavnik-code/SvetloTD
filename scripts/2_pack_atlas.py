import os
import subprocess
import sys

def pack():
    print("Запуск упаковщика текстур...")
    input_dir = "./raw_assets"
    output_dir = "./public/assets"
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Команда для Node.js утилиты
    cmd = [
        "npx", "free-tex-packer-cli",
        "--project", input_dir,
        "--output", output_dir,
        "--name", "game_atlas",
        "--format", "phaser3",
        "--ext", "png",
        "--allowRotation", "false",
        "--padding", "2"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("Атлас game_atlas.png успешно создан в /public/assets/")
    except subprocess.CalledProcessError as e:
        print(f"Ошибка упаковки: {e}")
        sys.exit(1)

if __name__ == "__main__":
    pack()
