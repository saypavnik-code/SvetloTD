# Svetlogorsk TD

Tower Defence игра в духе Burbenog TD (WarCraft 3), реализованная на TypeScript + Phaser 3.

**[▶ Играть онлайн](https://ВАШ_ЛОГИН.github.io/svetlogorsk-td/)**

## Технологии

- TypeScript + Phaser 3
- Vite (сборка)
- Web Audio API (процедурная музыка и SFX, 0 аудиофайлов)
- GitHub Actions (CI/CD → GitHub Pages)

## Запуск локально

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

## Деплой на GitHub Pages

### Автоматически (рекомендуется)

1. Создайте репозиторий `svetlogorsk-td` на GitHub
2. Включите GitHub Pages в Settings → Pages → Source: **GitHub Actions**
3. Push в ветку `main` → деплой запустится автоматически

### Вручную

```bash
npm run deploy
```

## Геймплей

| Клавиша | Действие |
|---------|----------|
| 1–5 | Выбрать башню |
| ПКМ | Переместить героя |
| Q | Ударная волна (AoE) |
| W | Янтарный щит (баф башен) |
| U | Апгрейд башни |
| Del | Продать башню |
| Tab | Показать дальность всех башен |
| Space | Начать волну досрочно |
| Esc | Пауза |

## Структура

```
src/
  config.ts           — все константы
  data/               — башни, враги, волны, карта, матрица урона
  entities/           — Enemy, Tower, Projectile, Hero
  scenes/             — Boot, Menu, Game, GameOver
  systems/            — WaveManager, BuildSystem, Economy, Audio, SFX...
  ui/                 — HUD, TowerPanel, WaveInfo, FloatingText
  utils/              — EventBus, ObjectPool, helpers
```
