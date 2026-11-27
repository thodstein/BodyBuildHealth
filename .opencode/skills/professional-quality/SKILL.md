---
name: Professional App Quality
description: Доведение BodyBuildHealth до production-уровня: архитектура, безопасность, тесты, APK UX, производительность и релизная готовность
---

# Professional application quality

Этот навык применяется для крупных доработок и аудитов, когда нужно довести фичу до production-уровня, а не только
сделать happy path.

## Definition of done

1. Acceptance criteria измеримы и привязаны к команде/тесту/ручной проверке.
2. Данные имеют один canonical source; нет расхождения UI/engine/database.
3. Есть тесты на happy path, пустой/повреждённый ввод, границы, повторный запуск и offline/APK путь.
4. Ошибки видны пользователю безопасным русским текстом; нет silent success и выдуманных значений.
5. TypeScript, целевой Vitest, APK markers и diff-review пройдены.
6. Не затронуты `.env*`, `dist`, Android build output и чужой WIP.

## Архитектурные gates

- Pure parsing/calculation остаётся вне React/UI и по возможности пригоден для Worker.
- Async/storage/network имеют timeout, fallback, idempotency и обработку partial failure.
- Медицинские данные имеют provenance, unit/code normalization, uncertainty и disclaimer.
- OCR имеет web/API и offline fallback; APK нельзя считать обычным браузером.
- UI использует design tokens, safe-area, доступные tap targets и native-safe controls.
- Новые API/SDK проверяются по актуальной документации через `context7`.

## Обязательный review

После изменения: проверить diff, поиск дублей констант, тесты на отказ, типы, импорт/экспорт, локализацию, а также
производительность больших файлов/изображений. Для медицинских чисел дополнительно проверить источник и статус статьи.
