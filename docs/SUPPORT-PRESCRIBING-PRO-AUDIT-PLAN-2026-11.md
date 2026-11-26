# Аудит конвейера назначения БАДов и препаратов поддержки (ноябрь 2026) — аудит + план

> Статус: **аудит выполнен, код не менялся** (кроме уже закоммиченного контура доз/UL из
> проходов 13–20). Документ фиксирует, как сегодня из состояния пользователя получается
> «вещество + доза + обоснование», какие места расходятся между собой, и в каком порядке это
> чинить. Числа не выдуманы: каждое — либо `file:line`, либо вывод пробы из §1.2, либо
> значение из реестра репозитория. Где нужен внешний источник (доза, порог) — так и написано
> «нет данных», решение вынесено в §5 «Осталось».
>
> Смежные документы, которые не дублируются: `docs/SUPPORT-PROTOCOLS-AUDIT-PLAN.md`
> (содержание протоколов: Hct, аспирин, ферменты, женщины), `docs/LAB-NORMS-SINGLE-SOURCE.md`
> (нормы/ступени анализов, §5 — «Бланк → вердикт»), `docs/SUPPORT-CALC-FULL-AUDIT-PLAN.md`
> (журнал проходов).

## §1. Что проверялось и как

### 1.1. Границы аудита

Только путь «состояние → план поддержки → доза → предупреждения»:

- `src/engines/support-plan/*` (движок), `src/engines/tz-mapper-engine.ts` (мост ТЗ),
  `src/data/lab-tier-*` (лаб-ступени), `src/data/support-*` (каталог, дозы, взаимодействия),
  `src/engines/support-limits.ts` + `NUTRIENT_UL` (UL-контур), `src/engines/*-report*` (отчёт),
  `src/ui/screens/Calculator/*` (что видит пользователь).
- Не проверялись: фарма-калькуляторы ААС (`PharmaScreen_parts/*`), пептиды, тренировки —
  это другие конвейеры; их дозы берутся из других реестров.

### 1.2. Как воспроизвести выводы

Пробы — одноразовые, зависимости тянутся через `vite-node` из репозитория. Сохранить как
`probe-prescribing.ts` в любом месте и выполнить:

```bash
node node_modules/vite-node/vite-node.mjs probe-prescribing.ts
```

```ts
// probe-prescribing.ts
const g: any = globalThis as any;
if (!g.localStorage) {
  const m = new Map<string, string>();
  g.localStorage = {getItem: (k: string) => (m.has(k) ? m.get(k) : null), setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear()};
}
if (!g.window) g.window = g;
const { runSupportUnified } = await import('D:/BodyBuildHealth/src/engines/support-plan/index.ts');
const { resolvePlanDose } = await import('D:/BodyBuildHealth/src/engines/support-plan/substances.ts');
const { DEFAULT_STATE } = await import('D:/BodyBuildHealth/src/ui/screens/Calculator/Calc.types.ts');
const { DEFAULT_DOSAGES } = await import('D:/BodyBuildHealth/src/data/support-database.ts');

// 1) доза: справочник против весовой таблицы
for (const id of ['selenium', 'zinc', 'vitamin_d3', 'taurine', 'coq10', 'milk_thistle', 'tudca'])
  console.log(id, 'DEFAULT=', DEFAULT_DOSAGES[id]?.mg, 'plan(80кг)=', resolvePlanDose(id, 80));

// 2) размер плана по уровню
for (const level of ['basic', 'mid', 'max']) {
  const st: any = {...DEFAULT_STATE, powerLevel: level, pharma: {...DEFAULT_STATE.pharma, phase: 'course',
    aas: [{id: 'test_enan', doseMgWeek: 500, weeks: 12}]}};
  const r: any = runSupportUnified(st);
  console.log(level, 'позиций:', r.substances.length, 'с дозой:', r.substances.filter((s: any) => s.doseMg > 0).length);
}
```

Вывод, на который опирается документ (снят в этом проходе):

```text
milk_thistle DEFAULT= 600  plan(80)= 600
tudca        DEFAULT= 1000 plan(80)= 1000
selenium     DEFAULT= 200  plan(80)= 57
zinc         DEFAULT= 30   plan(80)= 40
vitamin_d3   DEFAULT= 2000 plan(80)= 2280
taurine      DEFAULT= 2000 plan(80)= 1600
coq10        DEFAULT= 200  plan(80)= 240
basic позиций: 28 с дозой: 22
mid   позиций: 32 с дозой: 26
max   позиций: 47 с дозой: 41
```

Сверка «справочник против дозы каталога» (`catalogEntry().dosage.mg`) снята отдельной пробой
по тем же правилам и даёт пары: `tudca 1000 / 500`, `bergamot 500 / 1000`, `omega3 4000 / 2000`,
`nac 1200 / 600`, `potassium 200 / 300`, `vitamin_b6 25 / 50`, `p5p 25 / 50`,
`garlic 1200 / 1000`, `serrapeptase 10 / 20`, `cordyceps 1000 / 500`, `bromelain 500 / 1000`.

## §2. Как устроен конвейер сейчас (карта с `file:line`)

1. **Лабы → канон.** `labValuesForEngine` (`src/engines/support-plan/mapper-ctx.ts:78-...)`:
   формы бланка → канонические коды → мост написаний; производные (HOMA-IR из глюкозы+инсулина,
   худший из вчСРБ/СРБ, СКФ бланка главнее расчёта). Единственный читатель чисел анализа в плане.
2. **Список веществ.** Решается эвристиками и рукописными списками:
   - база `COURSE_FOUNDATION` — 6 «не-препаратов», всегда в плане (`support-plan/engine.ts:42`);
   - `modeCap` 3/5/8/99 и приоритетные списки для суставов/репродукции/нейро
     (`engine.ts:513-546`);
   - `mandatoryIds` — жёстко прописанные наборы под ААС (`engine.ts:552-564`);
   - обрезка `AUTO_PLAN_LIMIT` 28/40/48/56 (`engine.ts:41,565,568,597`);
   - лаб-добавки `tierAdj.addSubs` (`tz-mapper-engine.ts:1849-1866`) и синергии
     (`tz-mapper-engine.ts:1887-1899`);
   - стоп-листы и фазовые блоки (`engine-helpers.ts`, `shared-constants.ts`).
3. **Доза.** `resolvePlanDose` (`support-plan/substances.ts:163-165`) → `planDoseParts`
   (`substances.ts:119-157`), приоритет: весовая таблица (`substances.ts:15-42`) → справочник
   `DEFAULT_DOSAGES` → доза каталога → **фолбэк 500 мг** (`substances.ts:155`).
4. **Титрование.** `applyTitration` (`engine-helpers.ts:758-826`): недельный коэффициент
   0.5→1.0, клинические дозы телмисартана/небиволола/анастрозола/каберголина
   (`engine-helpers.ts:770-785`), затем UL-кап по `NUTRIENT_UL` (`821-824`), сырые дозы
   сохраняются для честных предупреждений.
5. **UL-контур.** `checkPlanUpperLimits` + `aggregateDailyLoad`
   (`engine-helpers.ts:198-243`), результат — `ulWarnings` и `dailyLoad` в результате
   (`support-plan/engine.ts:623,821-822`).
6. **Безопасность.** `checkInteractions` по `DRUG_INTERACTIONS` (97 правил,
   `src/data/drug-interactions.ts:15`) — `engine.ts:760-765`; противопоказания — по 10 флагам
   состояния, из них в маппинг идут 8 + возраст (`engine.ts:767-787,797-803`).
   И то и другое — **строки в массиве `contraindicationAlerts`**, состав плана они не меняют.
7. **Обоснование.** По одной строке на вещество из рукописной карты `SUBSTANCE_REASONS`
   (`substances.ts:47-98`), без ссылок; `q`/`k` механизмов приходят из ТЗ-модели
   (`tz-mapper-engine`, `derivedSupport`, q=`C` для деривации).
8. **Выход.** `PlanResult` → `Calc.mapper.tsx` → карточки, расписание, отчёт, экспорт врачу.

## §3. Находки

### P1 — расходятся числа, которые пользователь читает как одно назначение

**P1-1. Две базы дозы с разными приоритетами на разных экранах.**
`buildSubstances`/`resolvePlanDose` берут сначала `DEFAULT_DOSAGES` (`substances.ts:129-155`),
а `subDosage` (мост к карточке вещества, `Calc.mapper.tsx:713-721`) — сначала дозу каталога.
Результат из §1.2: `tudca` 1000 против 500, `omega3` 4000 против 2000, `nac` 1200 против 600,
`potassium` 200 против 300, `vitamin_b6` 25 против 50. Пока `doseDisplay` карточки строится из
плана, но любой экран, которому не передали `planDose`, показывает дозу каталога
(`CalcSubstanceDetail.tsx:64-66`). Это тот же класс, что проход 17 закрыл для магния.
*Проверка:* таблица пар из §1.2. *Чинить:* один резолвер, второй источник — display-only (§4 E1).

**P1-2. У записи дозы нет ни единицы, ни источника.**
Тип `SubstanceDosage` — `{ mg: number; timing: string }` (`support-meta.ts:2945-2948`).
Единица живёт в свободном тексте: `vitamin_b12: 1000 «утро (мкг)»`,
`hcg: 500 «2x/нед, схема 3/1 (МЕ)»`, `probiotics: 20 «млрд КОЕ»` (`support-meta.ts:3102-3110`).
Пересчёт делает `naturalFromMg`/`formatDefaultDose` по id — новый id без записи в таблицах
единиц молча становится «мг». Ссылки на источник у дозы нет вообще.
*Чинить:* поля `unit`/`source` в типе + миграция 74 записей, затем гард «нет дозы без единицы»
(§4 E1).

**P1-3. Лаб-титрация не меняет дозу.**
`computeTierAdjustments` возвращает `titrations` (например, «TUDCA ↑1000 мг (было 500)»,
`lab-tier-recommendations.ts:92`). Мост пишет `[TITR↑2× по …]` в текст причины и складывает
`titrationFactors` (`tz-mapper-engine.ts:1869-1877,2114`), но `support-plan/engine.ts` эту карту
**не читает** (единственный потребитель — `unifiedRec.subs`, `phaseAssignedDrugs`,
`protocolWarnings`, `engine.ts:111-121`). Дозу умножает только UI-фолбэк
`CalcSubstanceDetail.tsx:44,66`, а карточка плана — нет (`Calc.mapper.tsx:730-733`, комментарий
там же прямо говорит «лаб-титрация — ориентир»). Итог: рекомендация «×2 по ALT» печатается
рядом с неизменной дозой 1000.
*Чинить:* одна точка применения фактора к дозе плана + один экран (§4 E2).

**P1-4. Доза дописана в прозу лаб-ступени и расходится с карточкой.**
`LAB_TIERS` пишет дозу внутрь строки обоснования: «Силимарин 280 мг»
(`lab-tier-recommendations.ts:90`), «TUDCA 500 мг» (`:94`), «Бергамот ×2 (1000 мг)» (`:99`),
«Омега-3 ↑3 г» (`:103`), «Астрагал 500 мг» (`:114`). План для тех же веществ печатает
`resolvePlanDose`: `milk_thistle 600`, `tudca 1000`, `bergamot 500`, `omega3 4000`,
`astragalus 500` (§1.2). На одном экране — «280 мг» в причине и «600 мг» в дозе.
*Чинить:* доза — отдельное поле (`TierAddSub.dose` уже объявлен, но заполняется не везде),
проза — без чисел дозы (§4 E2).

**P1-5. DDI не видит препараты, которые человек принимает.**
`checkInteractions(substances)` (`engine.ts:760`) получает только id плана, а препараты
пользователя лежат в профиле (`core/types.ts:715 currentMedications`) и в `CalculatorState`
вообще отсутствуют: `NutritionData` в движке знает лишь `takenSupplements`
(`support-plan/types.ts:201-215`). Class-правила вида `@anticoagulant`, `@ssri`, `@nsaid`,
`@alpha_blocker`, `@nitrates` (`drug-interactions.ts:17,24-25,33-41,50`) могут сработать,
только если имя члена класса само оказалось в плане. Практически весь блок
class-правил в плане мёртв.
*Чинить:* передавать препараты профиля в DDI-контур нормализованными id + тест
«варфарин в профиле + K2 в плане → block» (§4 E3).

**P1-6. `severity: 'block'` не исключает вещество.**
`engine.ts:760-765` превращает блокирующее правило в строку `⛔ DDI: …`, и на этом всё:
состав плана остаётся прежним. То же с противопоказаниями (`engine.ts:799-801`). Пользователь
видит предупреждение рядом с назначением, но назначение не снимается и не помечается в карточке.
*Решение продуктовое:* снимать вещество, или оставлять с явной пометкой «нельзя» в карточке и
расписании. Молчаливое «предупреждение в списке» — худший из трёх вариантов (§4 E3).

**P1-7. Второй реестр взаимодействий недостижим из плана.**
Кроме 97 правил `DRUG_INTERACTIONS` (`drug-interactions.ts:15-...`, severity
`block|warn|monitor`), в репозитории есть `support-interactions-db.ts`: `INTERACTIONS_DB`
(286 пар) и `INTERACTION_LINKS_DB` (264 связи) с другой моделью (тип synergy/conflict/caution,
severity LOW/MEDIUM/HIGH). Их читают калькулятор взаимодействий, `biostack-safety`, `master-db`,
`score-engine` (`interactions-calculator.ts`, `biostack-safety.engine.ts`, `master-db.ts`), но не
движок плана. Правило, живущее только там, до плана не доходит; правило, живущее только тут, не
доходит до калькулятора. Проверка:
`grep -rl "support-interactions-db" src | grep -v __tests__` — движка плана в списке нет.
*Чинить:* либо слияние с одним источником, либо явный шов «профиль правил плана» + гард,
что новые правила не пишутся в один реестр в обход другого (§4 E4).

**P1-8. Слой доказательности существует, но не участвует в назначении.**
`EVIDENCE_DOSAGES` — 37 записей с `references` (`evidence-dosage-db.ts:42`), потребитель —
только `DosageCalculator.tsx`. `support-dosing.ts` — 90 записей с `evidenceLevel: 'A'|'B'|'C'`,
потребитель — только `UnifiedSynergyCalculator.tsx`. План не может ответить «почему эта доза»:
обоснование — 50 рукописных строк `SUBSTANCE_REASONS` без ссылок. При этом часть записей
`evidenceLevel: 'A'` описывает экстраполяцию с других показаний (известный случай — тамоксифен
в ПКТ, `docs/AGENTS-MEMORY.md`).
*Чинить:* один шов «план → evidence-запись (id дозы + ссылка + уровень)», уровень 'A' только
при совпадении показания (§4 E5).

### P2 — структура, из-за которой ошибки возвращаются

**P2-1. «Базовый» уровень — это 28 позиций, и хвост обрезается молча.**
`AUTO_PLAN_LIMIT.basic = 28` (`engine.ts:41`). Проба: один тестостерон-энантат на `basic` даёт
28 позиций (22 с дозой), на `max` с тренболоном и оралкой — 47. Обрезка `slice(0, planLimit)`
(`engine.ts:568,597`) не оставляет ни следа в результате: пользователь не знает, что ещё было
отобрано и отброшено. Для «поддержки» это ближе к полипрагмазии, чем к поддержке.
*Чинить:* решение по размеру (или по «сколько органных систем закрываем») + явная строка
«отброшено N позиций, потому что лимит уровня» (§4 E6).

**P2-2. Клинические дозы зашиты в код движка без источника и без врача.**
`applyTitration` (`engine-helpers.ts:770-785`): телмисартан 40/80/120 мг по стадии АД,
небиволол 2.5/5/7.5 мг по ЧСС, анастрозол 0.5/1/1.5 мг по суммарному тестостерону,
каберголин 0.125/0.25 мг по неделе курса; плюс недельный коэффициент 0.5→1.0. Это
самоназначение рецептурных препаратов по формуле в движке: ссылки нет, консультации нет,
в карточке число выглядит как «расчёт приложения».
*Чинить:* таблица с источниками + явная подпись «расчёт, не назначение; препарат — через врача»
(§4 E3/E5).

**P2-3. Противопоказания — 10 флагов и возраст.**
`ContraindicationsData` (`support-plan/types.ts:218-229`) и маппинг `engine.ts:767-787`:
болезни почек/печени/психики, ССЗ, диабет, эпилепсия, ЖКТ, простата, тромбофилия, аллергии
(строка без разбора) + `elderly`/`age_over_50`. Препараты, беременность, кормление, стадия ХБП
по СКФ (хотя СКФ считается) сюда не входят.
*Чинить:* СКФ → стадия ХБП как условие; препараты — в DDI; беременность/кормление — стоп-флаг
(§4 E3).

**P2-4. Бланк лаборатории не доходит до вердиктов плана.**
Границы `refLow/refHigh` читают только `LabsScreen.tsx:2549,2731` и HL7
(`labs.engine.ts:202-211`); `interpretLabs`, `LAB_TIERS`, зеркало дневника, отчёт и V7 считают по
своим таблицам. Подробности и таблица поверхностей — `docs/LAB-NORMS-SINGLE-SOURCE.md` §5.
*Чинить:* там же (этап E7 в §4, вне этого конвейера).

### P3 — латентное и требующее источника

**P3-1. Фолбэк 500 мг.** `planDoseParts` отдаёт 500 мг веществу, у которого нет ни весовой
правилы, ни `DEFAULT_DOSAGES`, ни дозы каталога (`substances.ts:155`). На типичных планах
(проба §1.2) не срабатывает: единственные `doseMg = 0` — 6 «не-препаратов» с собственным
текстом дозы. Но в данных остаётся правое число вместо «нет данных», а UI защищён только в
`planDoseOf` (`Calc.mapper.tsx:731`). *Чинить:* `undefined` вместо 500 (§4 E1).

**P3-2. Селен: весовая таблица ниже справочника.** `DEFAULT_DOSAGES.selenium = 200 мкг`,
весовая — `50/70 мкг на кг`, потолок 255 (`substances.ts:37-42`), при 80 кг это **57 мкг**.
Какое из двух чисел правильное — вопрос источника, которого в сессии нет; сейчас план
систематически назначает ~29% справочной дозы, и ни одна поверхность это не подписывает.
*Решение:* §5 (нужен источник).

## §4. Этапы работ (по приоритету, маленькими шагами)

Ни один этап не меняет числа без источника: где нужно решение по дозе/порогу — этап
останавливается на §5.

| # | Этап | Файлы | Проверка |
|---|------|-------|----------|
| E1 | Один резолвер дозы: `unit`/`source` в `SubstanceDosage`, справочник главнее каталога (или наоборот — решением), `undefined` вместо 500, реестр известных расхождений | `src/data/support-meta.ts`, `src/engines/support-plan/substances.ts`, `src/ui/screens/Calculator/Calc.mapper.tsx` | `npm run type-check`; новый `support-dose-single-source.test.ts`; `plan-dose-units`, `plan-schedule-dose-parity` |
| E2 | Лаб-титрация в дозу: одна точка применения фактора, `TierAddSub.dose` заполняется числом, проза без дозы | `src/engines/tz-mapper-engine.ts`, `src/engines/support-plan/engine.ts`, `src/data/lab-tier-recommendations.ts`, `CalcSubstanceDetail.tsx` | `npm run type-check`; `tz-*` и `lab-tier-*` сьюты; `calc-substance-limit-line` |
| E3 | Безопасность решает состав: препараты профиля в DDI, СКФ→стадия ХБП, решение по `block` (снять/пометить в карточке) | `src/engines/support-plan/{engine,types}.ts`, `src/data/drug-interactions.ts`, карточка плана | `npm run type-check`; новый `ddi-profile-meds.test.ts`; `plan-ul-warnings`, `support-calc-audit` |
| E4 | Один реестр взаимодействий или явный шов между двумя + гард против третьей копии | `src/data/support-interactions-db.ts`, `drug-interactions.ts`, `interactions-calculator.ts` | `npm run type-check`; `support-limits-registry`, `interactions-*` |
| E5 | Evidence-шов: доза → запись с `references`/`evidenceLevel`, уровень 'A' только при совпадении показания; подпись «расчёт, не назначение» у клинических доз | `src/data/evidence-dosage-db.ts`, `src/data/support-dosing.ts`, карточка плана, отчёт | `npm run type-check`; `evidence-dosage-ul-refs`, `e2-one-scale` |
| E6 | Размер плана и честная обрезка: лимит уровня объяснён, отброшенное названо | `src/engines/support-plan/engine.ts`, блок плана в UI | `npm run type-check`; `support-calc-e2e`, `calc-options-card` |
| E7 | Бланк лаборатории в вердикты (вне этого конвейера, по `LAB-NORMS-SINGLE-SOURCE.md` §5) | `lab-analysis.engine.ts`, `lab-tier-ranges.ts`, `comprehensive-report.engine.ts` | `npm run type-check`; `lab-*` сьюты |

Порядок не случаен: E1/E2 меняют числа в карточке, поэтому идут первыми и по одному; E3/E4
меняют состав плана; E5/E6 — подписи и объяснения; E7 — отдельная ветка анализов.

## §5. Что осталось за рамками (нужен источник или решение)

1. **Селен: 200 мкг против 57 мкг при 80 кг** (P3-2). Нужен первичный источник на целевую дозу
   и на потолок; до него — не правим, а подписываем расхождение (как сделано с калием:
   `src/data/potassium-action-thresholds.ts`).
2. **Смысл `block`** (P1-6): снимать вещество из плана или оставлять с пометкой «нельзя».
   Это продуктовое решение, а не техническое.
3. **Размер «базового» плана** (P2-1): 28 позиций — продуктовое ограничение или дефект?
   От ответа зависит E6.
4. **Клинические дозы телмисартана/небиволола/анастрозола/каберголина** (P2-2): нужна таблица
   с источниками; сейчас это формула без ссылки.
5. **Тамоксифен в ПКТ**: доза продублирована в трёх файлах и расходится
   (`evidence-dosage-db.ts:419-429`, `support-dosing.ts:194-204`, `aas-support-protocols.ts:49`);
   уровень 'A' не отражает ПКТ-доказательства. Правка — отдельным проходом с `evidence-database`.
6. **Фосфорные экстренные 0.4/2.5** — порог приложения без первичного источника (проход 209),
   к этому конвейеру не относится, но висит в том же реестре долга.

## §6. Чек-лист проверок (для любого этапа §4)

- [ ] `npm run type-check` — 0 ошибок (если падает по памяти: `node --max-old-space-size=6144 ./node_modules/typescript/bin/tsc --noEmit`).
- [ ] Целевой vitest: движок `src/engines/support-plan/__tests__`, плюс затронутые `src/engines/__tests__/plan-*`,
      `src/data/__tests__` для реестров данных.
- [ ] `calc-options-card` и `calc-substance-limit-line` — если менялись опции или карточка вещества.
- [ ] `npm run verify:apk-design` — если менялась разметка APK-экранов.
- [ ] `git diff --stat` по своим путям: чужие `M`/`??` не тронуты.
- [ ] В отчёте: что изменилось в числах карточки (до/после) и откуда взято число.
