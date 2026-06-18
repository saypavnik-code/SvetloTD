import os
import sys

VK_MAX_SIZE_MB = 30.0

def get_directory_size(directory):
    total_size = 0
    for dirpath, _, filenames in os.walk(directory):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

def check_limits():
    dist_dir = "./dist"
    if not os.path.exists(dist_dir):
        print(f"Директория {dist_dir} не найдена. Запустите сборку.")
        sys.exit(1)

    size_bytes = get_directory_size(dist_dir)
    size_mb = size_bytes / (1024 * 1024)
    
    print(f"Итоговый размер сборки: {size_mb:.2f} МБ")
    
    if size_mb > VK_MAX_SIZE_MB:
        print(f"ОШИБКА: Размер превышает лимит VK ({VK_MAX_SIZE_MB} МБ)!")
        sys.exit(1)
        
    print("Проверка пройдена: размер подходит для VK Mini Apps и VK Play.")

if __name__ == "__main__":
    check_limits()
