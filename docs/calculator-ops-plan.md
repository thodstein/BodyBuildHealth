# 🧮 Калькулятор поддержки — ОПЕРАЦИОННЫЙ ПЛАН

## Goal
Соединить старый IIFE-калькулятор с AutoCalculator в ОДИН цельный калькулятор с единой карточкой расчёта, понятными принципами выдачи, общей save/load панелью и визуальной структурой в стиле кнопок-карточек с попапами.

## Constraints & Preferences
- **Старый IIFE НЕ удалять** — переработать карточки, убрать дубли, сохранить кнопки+вывод
- **Единая карточка расчёта** — один блок вместо разрозненных «старая/новая схема»
- **Принцип расчёта** выбирается (🧠 Интеллектуально / 📋 Вручную) — уровень поддержки только для интеллекта
- **ОДНА save/load панель** — в плане, с комментариями; убрать дубли из карточки расчёта и AutoCalc
- **Week → PopupSelect** (кнопка-карточка с попапом выбора недели), не `<input range>`
- **Week в плане** — мини-кнопка с номером недели, открывает тот же попап
- **Избранное → подвкладка calculator** для сохранённых расчётов (план отдельно)
- **Все кнопки в 21 карточке → кнопка-карточка с попапом**, значение вводится в попапе
- **Сетка 2-3 колонки** для кнопок-карточек, стильно, с заголовками
- **Calc result save** → в `he_saved_calc_results` (загружается из Избранное → Расчёты)
- **AutoCalculator save** → только вводные, переименовано в «Сохранить вводные / Восстановить вводные»
- **Joint/boost** — то же поведение, но с уведомлениями (вариант «если плана нет → только своё, если есть → добавить»)
- **tsc --noEmit** + **vite build** — обязательны

---

## Progress

### ✅ Done (C1–C14)
| # | Задача | Статус |
|---|--------|--------|
| C1 | PopupBool, PopupNumber, PopupText — кнопка-карточка с попапом | ✅ |
| C2 | Card cols — сетка 2-3 колонки | ✅ |
| C3 | 37 BoolToggle → PopupBool | ✅ |
| C4 | 6 NumberSelect → PopupNumber | ✅ |
| C5 | 16 inline `<input>` → PopupNumber/PopupText | ✅ |
| C6 | hydrateState() — все поля (oda, dental, gi, toxic, epicrisis, inj, journal, labs, profile) | ✅ |
| C7 | Очистка: BoolToggle, NumberSelect, SELECT, TITRATION_RULES | ✅ |
| C8 | Budget pills → onLevelClick (синхронизация с supportLevel) | ✅ |
| C9 | Единая карточка расчёта v3.0 | ✅ |
| C10 | WeekSelect попап (единый для карточки и плана) | ✅ |
| C11 | Избранное → подвкладка calculator (he_saved_calc_results) | ✅ |
| C12 | Save calc result → Избранное | ✅ |
| C13 | AutoCalculator save переименован в «Сохранить вводные» | ✅ |
| C14 | tsc --noEmit 0 ошибок, vite build успешно | ✅ |

### ❌ Осталось (C15–C23)
| # | Задача | Приоритет | Описание |
|---|--------|-----------|----------|
| C15 | **ХГЧ — автоназначение** | HIGH | Если курс содержит ААС → добавить hCG в план автоматически (сейчас только через boostEnabled). Логика: проверить `state.pharma.aas.length > 0 && !state.pharma.hasHCG → вставить hCG 500 МЕ 2р/нед` |
| C16 | **«О подборе» — убрать/перенести** | HIGH | Сейчас текст «О подборе» рендерится внизу вкладки `genTab === 'calculator'`. Перенести в отдельную подвкладку `genTab === 'about'` или удалить. Файл: SupportScreen.tsx |
| C17 | **Сохранить план → Мои планы** | HIGH | После расчёта поддержки нет кнопки «Сохранить в Мои планы». Нужно: кнопка в карточке результата → запись в `he_my_plans` localStorage. Формат: `{ id, name, date, level, subs[], result }` |
| C18 | **Синхронизация RiskScreen ↔ support.engine.ts** | HIGH | Риски из support.engine.ts (TZ риск) должны отображаться в RiskScreen. Сейчас risk engine и support engine — разные. Нужен общий `riskStore` или передача через linked.risk |
| C19 | **Недельный редактор AAS** | MEDIUM | У препаратов в курсе нет startWeek/endWeek. Нужно: при добавлении AAS в AutoCalculator → поля "старт нед" / "конец нед". Влияет на понедельный расчёт риска |
| C20 | **AutoCalculator → результат → план (соединение)** | HIGH | После нажатия «Применить расчёт» результат AutoCalculator должен попадать в основной план поддержки (не только в setAutoCalcResult). Сейчас onApply только сохраняет в autoCalcResult, но не триггерит renderPlan |
| C21 | **Manual принцип (каталог)** | MEDIUM | calcPrinciple === 'manual' → открыть каталог поддержки с возможностью ручного выбора веществ. Сейчас manual ведёт в `setShowModal('manual')`, но модалка не реализована |
| C22 | **Week selector → влияние на рекомендации** | MEDIUM | Смена недели должна пересчитывать план: дозировки (титрация), риски (понедельная динамика), состав поддержки. Сейчас onWeekChange только показывает уведомление |
| C23 | **Joint/Boost уведомления** | LOW | Сейчас setJointNotification/setBoostNotification не отображаются в UI. Нужен toast-компонент или встроенный блок уведомлений |

---

## Key Decisions
- **save/load разделены на 3 уровня**: (1) AutoCalculator — только вводные, (2) карточка расчёта → результат в Избранное, (3) план → в Мои планы
- **WeekSelect — единый попап** для двух точек входа (карточка расчёта и план)
- **calcPrinciple** (intel/manual) — локальное состояние на уровне SupportScreen, не AutoCalculator
- **21 карточка → PopupXxx**: все значения показываются кнопкой, меняются в попапе (BoolToggle, NumberSelect, plain `<input>` → PopupBool, PopupNumber, PopupText)
- **Labs (лаборатория)** оставлены как есть (сетка чекбоксов + инлайн ввод, нецелесообразно в попап)
- **synergy-filter + conflict-resolve** остаются в recommendation-engine.ts, не меняются

---

## Data Flow
```
AutoCalculator.useEffect()
  → localStorage.setItem('he_autocalc_state', JSON.stringify(state))

SupportScreen.calcSupport()
  → const h = hydrateState()
    → localStorage.getItem('he_autocalc_state')
      → merge neuro, psych, genetics, hepatobiliary, cardio, urinary, goals,
        nutrition, contraindications, oda, dental, gi, toxicLoad,
        epicrisis, injection, journal, labs, profile [ВСЕ ПОЛЯ]
  → const state = { ...defaults, ...h, powerLevel }
  → calculateSupportTZ(state)
```

---

## Relevant Files
- `src/ui/screens/SupportScreen_parts/AutoCalculator.tsx` (~1013 строк) — core refactoring: all 21 cards → PopupXxx + Card cols
- `src/ui/screens/SupportScreen_parts/SupportModals.tsx` — +weekSelect modal + courseWeekState/setCourseWeekState/maxCourseWeek/onWeekChange props
- `src/ui/screens/SupportScreen.tsx:4848-4987` — единая карточка расчёта v3.0, calcPrinciple плюсы, AutoCalculator интеграция
- `src/ui/screens/SupportScreen.tsx:3297` — favTab pills + 'calculator' подвкладка
- `src/engines/support-calculator.engine.ts:490-547` — hydrateState (читает he_autocalc_state + he_support_plan_current + he_user_profile + he_course_data)
- `src/engines/recommendation-engine.ts` — evaluateRecommendations + applyBudget + computeBudgetRisk (не меняется)
- `src/data/support-index.ts` — обратные индексы + SYNERGY_GRAPH + CONFLICT_SCORE + BUDGET_TIER_MAP
- `src/data/support-catalog-data.ts` — ~300+ веществ поддержки

---

## 21 Card Mapping Summary

| # | Карточка | cols | PopupBool | PopupNumber | PopupSelect | PopupText | Inline |
|---|----------|------|-----------|-------------|-------------|-----------|--------|
| 1 | 👤 Профиль | 3 | 1 | 8 | 2 | — | — |
| 2 | 🧠 Неврология | 2 | 6 | 3 | 2 | — | — |
| 3 | 💉 Фарма стек | 2 | 8 | — | 1 | — | AAS picker |
| 4 | 🎯 Цели / Цикл | 2 | 7 | 2 | 2 | — | — |
| 5 | 🫁 Гепатобилиарная | 2 | 2 | — | 4 | — | — |
| 6 | 💧 Мочевыделительная | 2 | 4 | — | 4 | — | — |
| 7 | ❤️ ССС | 2 | 3 | 1 | 4 | — | — |
| 8 | 🦴 ОДА / Суставы | 2 | 2 | — | 1 | — | травмы |
| 9 | 🥗 Питание | 3 | 1 | 6 | 1 | — | — |
| 10 | 🩺 Противопоказания | 3 | 9 | — | — | 1 | — |
| 11 | 📓 Журнал | — | — | — | — | — | кнопка+список |
| 12 | 📋 Эпикриз | 2 | 5 | — | — | — | — |
| 13 | ☣️ Токсическая нагрузка | 2 | 3 | — | 1 | — | — |
| 14 | 🦷 Стоматология | 2 | 5 | — | — | — | — |
| 15 | 🧬 Генетика | 2 | — | — | 4 | — | — |
| 16 | 🫀 ЖКТ | 2 | 7 | — | — | — | — |
| 17 | 🧘 Психология | 3 | — | 3 | — | — | — |
| 18 | 💉 Инъекции | 2 | — | — | 4 | — | — |
| 19 | 🧪 Лаборатория | — | — | — | — | — | FullLabInput |
| 20 | 🧠 Расчёт поддержки | — | — | — | — | — | рекомендации |
| 21 | 📈 Динамика риска | — | — | — | — | — | график |

---

## Removed Components
| Компонент | Причина |
|-----------|---------|
| `BoolToggle` | Дубликат `PopupBool` |
| `NumberSelect` | Заменён на `PopupNumber` |
| `SELECT` (CSS const) | Не использовался |
| `TITRATION_RULES` (import) | Не использовался в AutoCalculator |

---

## hydrateState() — Coverage Before/After

| Поле | Было | Стало | Источник |
|------|------|-------|----------|
| neuro | ✅ | ✅ | he_autocalc_state |
| psych | ✅ | ✅ | he_autocalc_state |
| genetics | ✅ | ✅ | he_autocalc_state |
| hepatobiliary | ✅ | ✅ | he_autocalc_state |
| cardio | ✅ | ✅ | he_autocalc_state |
| urinary | ✅ | ✅ | he_autocalc_state |
| goals | ✅ | ✅ | he_autocalc_state |
| nutrition | ✅ | ✅ | he_autocalc_state |
| contraindications | ✅ | ✅ | he_autocalc_state |
| oda | ❌ | ✅ | he_autocalc_state |
| dental | ❌ | ✅ | he_autocalc_state |
| gi | ❌ | ✅ | he_autocalc_state |
| toxicLoad | ❌ | ✅ | he_autocalc_state |
| epicrisis | ❌ | ✅ | he_autocalc_state |
| injection | ❌ | ✅ | he_autocalc_state |
| journal | ❌ | ✅ | he_autocalc_state |
| labs | ❌ | ✅ | he_autocalc_state |
| profile | ❌ | ✅ | he_autocalc_state |
| profile (weight,age,sex...) | ✅ | ✅ | he_user_profile |
| pharma.aas | ✅ | ✅ | he_course_data |
| labs (preCourse/midCourse/postPCT) | ✅ | ✅ | he_labs_history |
