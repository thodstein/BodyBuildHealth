# ББ-авто: «экран сам перескакивает на другой» — диагностика и план

**Симптом (жалоба):** в ББ-авто экран часто и самопроизвольно перескакивает на другой
шаг/экран: пользователь открывает конструктор — и через мгновение уже «План» вместо
«Параметры»; работает в «Годовом плане» — и его выбрасывает на «План»; после возврата из
плеера/перезагрузки позиция теряется.

**Дата:** 2026-11-15 · **Область:** `BbAutoConstructor` (навигация), `TrainingScreen`
(выход из окна конструктора), встроенный `MacrocyclePanel` (годовой план).

---

## 0. TL;DR

Навигация внутри ББ-авто — это локальный `useState<Step>('params')`, который **никто не
сохранял**, зато **три разных места принудительно ставили шаг** без участия пользователя:
монтирование (`setStep('plan')`), приём годового контекста (`setStep('contest')`) и
внешнее событие `he-bb-plan-saved` (`setStep('plan')`). Плюс отправка плана в выполнение
«изображала» storage-событие, чтобы закрыть окно конструктора. Отсюда все «перескоки».

Что сделано (см. §3): позиция (шаг + неделя) сохраняется и восстанавливается; монтирование
больше не ставит шаг; hand-off годового плана открывает «План» (а не «Contest prep»);
внешнее событие не уводит со шага, где пользователь работает; выход в плеер — явное
событие `training-exit-constructor` вместо подделки `storage`.

Дополнительно (P2, §5): настоящее storage-событие из другого окна больше не уводит это окно
в конструктор, а смена шага скроллит реальный скроллер конструктора (`.tp-cbody`), а не
экран под оверлеем.

---

## 1. Факты кода (до правок)

| № | Где | Что происходит |
|---|---|---|
| N1 | `BbAutoConstructor.tsx:1952-1963` (эффект монтирования, FIX-19) | `setBuiltPlan(...); setBbWeekSel(1); setStep('plan')` — **безусловно**, если в `he_bb_plan_saved` что-то есть |
| N2 | `BbAutoConstructor.tsx:1961` + `2077-2103` | `applyAnnualBlockCtx(consumeAnnualBlockCtx())` на монтировании → `setStep('contest')`, ctx потребляется навсегда |
| N3 | `BbAutoConstructor.tsx:2041-2075` | обработчик `he-bb-plan-saved`: `setBuiltPlan` + `setStep('plan')` из любого места |
| N4 | `MacrocyclePanel.tsx:913`, `1305`, `2556` | **годовой планировщик встроен в шаг «Годовой план» этого же конструктора** (`BbAutoConstructor.tsx:4993`) и сам шлёт `he-bb-plan-saved` → N3 срабатывает внутри конструктора |
| N5 | `BbAutoConstructor.tsx:1216-1254` | персист `he_bb_auto_state_v1` **не содержит `step`** и `bbWeekSel` |
| N6 | `BbAutoConstructor.tsx:3711-3713` | отправка в выполнение пишет `he_training_tab` и вручную диспатчит `new StorageEvent('storage', { key: 'he_training_tab' })`; ловит это `TrainingScreen.tsx:553-561` (`setPage('tabs')`), т.е. окно конструктора закрывается «побочным эффектом» |
| N7 | `BbAutoConstructor.tsx:2065-2070` | при замене плана извне остаются `exerciseEdits`/`weightEntries` от **прежней** структуры (ключи `${week}-${si}-${ei}`) → вес чужого упражнения приклеивается к новому |
| N8 | `BbAutoConstructor.tsx:1217-1245` vs `1952+` | эффект автосохранения объявлен **выше** эффекта восстановления и на монтировании синхронно писал **дефолты** в `he_bb_auto_state_v1` — до чтения. Т.е. сохранённый снимок затирался сам собой (без этого гейта персист позиции был бы мёртвым) |

Что **не** является причиной (проверено):
- свайпы вкладок (`useSwipeTabs`) — оверлей конструктора `position: fixed`, срабатывает гард
  `insideFixedOverlay` (`src/ui/native/useSwipeTabs.ts:58-71,120`);
- `PlannerStepNav` не вызывает `onSelect` сам (`training-ui.tsx:314-361`);
- `usePlannerStepScroll` скроллит, но шаг не меняет (`training-ui.tsx:364-391`);
- переход из дневника (`TrainingDiaryHub:602-603`) и виджетные deep-link'и — осознанные
  пользовательские действия, их не трогаем.

---

## 2. Требуемое поведение

1. Вход в конструктор **никогда** не меняет шаг сам: открывается тот шаг, на котором
   пользователь остановился (если он валиден для текущего состояния), иначе «1 Параметры».
2. Шаг, невозможный без плана (`plan/weights/quality/adjust/contest`), не восстанавливается
   при отсутствии плана; `weights` (введённые веса живут только в памяти) → «План».
3. Hand-off годового плана (свежий `he_bb_plan_saved_ctx`) открывает **«План»** переданного
   цикла и предзаполняет «🏁 Contest prep», ничего не уводя в форму без действия пользователя.
4. Внешний `he-bb-plan-saved` **обновляет план**, но не уводит пользователя, если он на
   редактирующем шаге (`params/ped/split/contest/annual/tools`); на остальных — открывает
   «План». Вместо прыжка — сообщение.
5. Замена плана извне сбрасывает правки/веса прежней структуры (иначе вес чужого
   упражнения приклеивается к новому).
6. Выход в плеер — явное намерение (`training-exit-constructor`), а не побочный эффект
   storage-события.

---

## 3. Работы

- [x] **N1-N5.** Новый чистый модуль `src/ui/screens/TrainingScreen_parts/bb-auto-nav.ts`:
      `resolveBbAutoOpenStep`, `validBbAutoStep`, `shouldFollowExternalPlan`,
      `annualBlockCtxIsFresh`, `BB_EDITING_STEPS`. Политика навигации проверяема тестом без
      jsdom-рендера god-компонента.
- [x] **N5.** Персист `step` + `bbWeekSel` в `he_bb_auto_state_v1` (и в deps эффекта).
- [x] **N1.** Эффект монтирования: план восстанавливается молча, шаг — из сохранённой позиции.
- [x] **N2.** `applyAnnualBlockCtx(ctx)` больше не меняет шаг (никаких `setStep('contest')`):
      шаг решают монтирование/обработчик события, а функция только предзаполняет
      мета-состояния шага «🏁 Contest prep».
- [x] **N2.** Свежесть ctx: `annualBlockCtxIsFresh` (есть `ts` — берём его, иначе дату
      сохранённого плана; старше суток — чужой хвост). `MacrocyclePanel` пишет `ts`.
- [x] **N3/N4.** Обработчик `he-bb-plan-saved`: `stepRef` + `shouldFollowExternalPlan` —
      со шага «Годовой план» (там же встроенный планировщик) и с редактирующих шагов не
      прыгаем, показываем сообщение.
- [x] **N7.** Замена плана извне чистит `exerciseEdits/editsHistory/redosHistory/
      weightEntries/weightsApplied`.
- [x] **N6.** `training-exit-constructor` (dispatch в конструкторе → обработчик в
      `TrainingScreen`: `setPage('tabs')` + зона/вкладка). Убрана подделка `storage`.
- [x] **N6.** «Отправить в выполнение» теперь пишет `he_bb_plan_saved` (раньше план уходил
      в плеер, но не в хранилище — при следующем открытии конструктор восстанавливал старый).
- [x] **N8.** Персист пропускает первый проход (`persistReadyRef`): иначе снимок затирался
      дефолтами до восстановления, и ни настройки шагов 1–2, ни позиция не читались.
- [x] Регресс-тесты: `__tests__/bb-auto-nav.test.ts` (23 теста: чистая логика + source-guard'ы
      на `BbAutoConstructor.tsx`, `TrainingScreen.tsx`, `MacrocyclePanel.tsx`).

## 4. Проверка (факт)

```powershell
# новый регресс-тест
node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run `
  src/ui/screens/TrainingScreen_parts/__tests__/bb-auto-nav.test.ts `
  --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
# 1 файл, 23 теста — passed

# весь UI-блок ББ (соседние тесты не сломались)
node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run `
  "src/ui/screens/TrainingScreen_parts/__tests__/bb-" `
  --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
# 42 файла, 369 тестов — passed

# годовой планировщик (там появился ts в контексте)
node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run `
  src/ui/screens/SRCBBScreen_parts/__tests__/macrocycle-panel-audit-fixes.test.tsx `
  src/ui/screens/SRCBBScreen_parts/__tests__/macrocycle-panel-annual-build.test.tsx `
  --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
# 2 файла, 28 тестов — passed

# тесты, которые рендерят TrainingScreen (там новый обработчик события)
node ... run src/ui/screens/TrainingScreen_parts/__tests__/arm-lifting-nav.test.tsx `
  src/ui/screens/ProfileScreen_v2/__tests__/profile-deep-links.test.tsx
# 2 файла, 12 тестов — passed

# типы
node --max-old-space-size=3200 ./node_modules/typescript/bin/tsc --noEmit
# exit 0
```

Замечания по окружению (не дефекты кода):
- `npm run type-check` (лимит 4096 МБ) на 8-ГБ машине падает по памяти, если свободно < 3.8 ГБ;
  проверено с `--max-old-space-size=3200` — чисто. При 2600 МБ tsc честно упирается в heap.
- Прогон **всего** каталога `TrainingScreen_parts/__tests__` одним процессом падает по памяти
  (известное ограничение, см. `docs/BB-AUTO-MASTER-PLAN.md`); подмножество `bb-*` — зелёное.
- `cardio-user-flow.test.tsx > «протокол сессии открывается по клику…»` падает **до и после**
  правки (кардио, к конструктору ББ отношения не имеет) — пред-существующее, не трогал.

## 5. P2 — сделано (отдельный коммит)

Оба хвоста из первой волны закрыты.

### P2.1 Кросс-оконные `storage`-события

`TrainingScreen.tsx` пропускает навигацию через чистую политику
`shouldNavigateOnStorageEvent({ isTrusted, page })` (`bb-auto-nav.ts`):

| Событие | `isTrusted` | Поведение |
|---|---|---|
| Своё окно (`window.dispatchEvent(new StorageEvent(...))` — осознанный клик, напр. «Тренировка → ББ-авто» из дневника) | `false` | как раньше: зона «Планировщик» + окно конструктора нужного трека |
| Чужое окно/вкладка, у нас открыт конструктор | `true` | **игнор** — окно не подменяется и не закрывается |
| Чужое окно/вкладка, конструктор не открыт | `true` | как раньше (кросс-табовая синхронизация вкладки сохранилась) |

Трек/вкладка всё равно лежат в `localStorage` и применятся при следующем открытии
(`getPlanningTrack`), так что «дочернее окно → родитель» не ломается.
Заодно в белый список треков добавлен `arm`: раньше `'arm'` из другого окна
превращался в `'pl'` (в белом списке не было значения, хотя `getPlanningTrack` его знает).
Текущая страница читается через `pageRef` (у эффекта пустые зависимости).

### P2.2 Скролл при смене шага

`usePlannerStepScroll` (`training-ui.tsx`) целился в `.screen.training-screen`, но тот
лежит **под** fixed-оверлеем окна конструктора (`zIndex:102`), поэтому «наверх» визуально
не происходило: после смены шага оставался скролл предыдущего шага — читалось как «экран
перескочил на другой». Теперь скроллер — тело окна конструктора (`.tp-cbody`,
`overflow:auto`), найденное как предок навигации: `nav.closest('.tp-cbody')`; старый
контейнер оставлен фолбэком. Правило действует для всех конструкторов, использующих хук
(ББ-авто, ПЛ-авто, ручной сбор, кардио, ТА, единоборства, арм).

### Проверка P2

```powershell
node --max-old-space-size=3200 ./node_modules/typescript/bin/tsc --noEmit
# exit 0

node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run "src/ui/screens/TrainingScreen_parts/__tests__/bb-auto-nav.test.ts" --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
# 1 файл, 28 тестов — passed (было 23, +5 на P2)

node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run "src/ui/screens/TrainingScreen_parts/__tests__/bb-" --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
# 42 файла, 374 теста — passed, exit 0

node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run "src/ui/screens/ProfileScreen_v2/__tests__/profile-deep-links.test.tsx" "src/ui/screens/TrainingScreen_parts/__tests__/arm-lifting-nav.test.tsx" --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
# 2 файла, 12 тестов — passed (рендерят TrainingScreen целиком)

npm run verify:apk-design
# OK: all APK design markers in place
```

## 5.1 Что осталось за рамками (не дефекты «перескоков»)

- Чистка `he_bb_plan_saved_ctx` после применения (сейчас живёт до TTL 24 ч — не вредит,
  т.к. читается только как hand-off по `ts`).
- Папка `docs/` содержит неотслеживаемые аудит-артефакты прошлой сессии
  (`BB-CORE-BUILD-AUDIT-2026-11.md`, `BB-FINALIZE-VALIDATION-AUDIT-2026-11.md`,
  `bb-auto-constructor-audit-2026-11-15.md`) — решение об их судьбе отдельное.

## 6. Файлы

| Файл | Что |
|---|---|
| `src/ui/screens/TrainingScreen_parts/bb-auto-nav.ts` | **новый**: политика навигации (чистые функции) + `shouldNavigateOnStorageEvent` (P2) |
| `src/ui/screens/TrainingScreen_parts/__tests__/bb-auto-nav.test.ts` | **новый**: 28 тестов (логика + source-guard'ы; 23 в первой волне, +5 на P2) |
| `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx` | персист позиции, монтирование без прыжка, `applyAnnualBlockCtx` без смены шага, `stepRef`, гейт внешнего события, `persistReadyRef`, `training-exit-constructor`, сохранение плана при отправке в плеер |
| `src/ui/screens/TrainingScreen_parts/training-ui.tsx` | `usePlannerStepScroll` скроллит `.tp-cbody` (реальный скроллер конструктора) |
| `src/ui/screens/TrainingScreen.tsx` | обработчик `training-exit-constructor`; гейт storage-навигации + `pageRef` (P2) |
| `src/ui/screens/SRCBBScreen_parts/MacrocyclePanel.tsx` | `ts` в контексте передачи блока |
