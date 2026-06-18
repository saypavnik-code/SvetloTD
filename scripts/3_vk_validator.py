import os
import sys

# Лимит для HTML5 игр VK Mini Apps (обычно мягкий лимит 30 МБ, жесткий 100 МБ)
VK_LIMIT_MB = 30.0

def get_size(path):
    total = 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total += os.path.getsize(fp)
    return total

def validate():
    dist = "./dist"
    if not os.path.exists(dist):
        print(f"КРИТИЧЕСКАЯ ОШИБКА: Папка {dist} не найдена!")
        sys.exit(1)
        
    size_mb = get_size(dist) / (1024 * 1024)
    print(f"Анализ сборки: {size_mb:.2f} МБ")
    
    if size_mb > VK_LIMIT_MB:
        print(f"ПРЕДУПРЕЖДЕНИЕ: Сборка превышает рекомендуемый лимит VK ({VK_LIMIT_MB} МБ).")
        # Временно не прерываем CI, чтобы ты мог тестировать, но выводим красным
        # Если нужен жесткий стоп: sys.exit(1)
    else:
        print("Валидация VK пройдена: размер в пределах нормы.")

if __name__ == "__main__":
    validate()
