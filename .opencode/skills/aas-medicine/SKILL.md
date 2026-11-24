---
name: AAS & Sports Medicine
description: Фарма-слой приложения ААС: каталог веществ (тестостерон, тренболон, нандролон, туринабол, SARMs, пептиды), PK/PD, дозы, ПКТ (тамоксифен, кломифен, ХГЧ), взаимодействия, риски, лабораторные нормы, БАДы и проверка фактов по источникам
---

# ААС / фармакология / спортивная медицина

Точка входа — аудит `docs/AAS-MEDICINE-GAP-AUDIT-2026-11.md` (что есть, чего нет, порядок работ).

## Карта слоя

- Вещества: `src/core/pharma-database.ts` + `src/core/pharma-db/*.ts` (по классам), `PHARMA_CLASSES` — список классов,
  которые вообще можно добавить в курс. Типы полей — `src/core/types.ts` (`PharmaSubstance`, `PK`, `PD`).
- PK/PD: `pharmacology.engine.ts` (3-компартмент), `pk-bateman.engine.ts` (эстеры, t½, интервалы, клиренс),
  `pk-pd.engine.ts`, `pkpd-superposition.engine.ts`.
- Дозы: `dosage.engine.ts` (мг/мкг/МЕ → мл), `dosage-safety.engine.ts` (шприц, гарды), `peptide-pro.engine.ts`.
- ПКТ/ТЗТ: `pct-timing.engine.ts`, `pct-planner.engine.ts`, `advanced-diagnostics.engine.ts`, `fertility.engine.ts`.
- Взаимодействия: `pharma-interactions.engine.ts` (правила AAS×AAS и AAS×препарат), `src/data/drug-interactions.ts`.
- Риски: `ped-risk-matrix.ts`, `risk-engine-v7*.ts`, `female-aas-risk.ts`.
- Лаборатория: `lab-norms.engine.ts` — единственный источник норм (контракт `docs/LAB-NORMS-SINGLE-SOURCE.md`),
  `src/data/lab-tier-ranges.ts`, `labs-phase-panels.ts`.
- Дневник: `injection-diary.engine.ts` / `injection-schedule.engine.ts`, UI в `ProfileScreen_v2/diaries`.

## Как проверить факт (обязательный маршрут)

1. `repo_pharma <вещество>` — что уже утверждает приложение: `PHARMA_DB` (ААС), поддерживающие базы ПКТ/БАД
   (`evidence-dosage-db.ts` — дозы с `references`, `support-dosing.ts` — протоколы, `support-substances.ts` — там
   тамоксифен, кломифен, ХГЧ, каберголин, витамины), правила `pharma-interactions.engine.ts`, женский протокол.
   База проверяемая, но не доказательство; у чисел из `evidence-dosage-db.ts` есть поле `references` — начинай с него.
2. `evidence_substance <name>` — каноническое имя, CID, CAS: чтобы не спутать эфиры, соли и «похожие» пептиды.
3. `evidence_drug_label <МНН>` — если есть официальный лейбл (тамоксифен, анастрозол, метформин, кленбутерол):
   доза, противопоказания, взаимодействия. У ААС и ПКТ-препаратов лейблов обычно нет — так и пиши «off-label».
4. `evidence_literature` / MCP `pubmed` — эффективность, ПКТ, дозы, риски; фиксируй уровень доказательности.
5. `evidence_trials` — если важен статус исследований по веществу.
6. `evidence_citation` — перед вставкой DOI/PMID в код, доку или память.
7. `repo_lab <код>` — норма и пороги (`UCUM_MAP`, женские границы), прежде чем менять число в движке.

Никогда не выдумывай t½, дозу, частоту инъекций и порог лаборатории. Нет данных — пиши «нет данных», а не
правдоподобное число. Числа в `PHARMA_DB` без источника помечай как непроверенные (см. аудит, P1).

## Инварианты

- Числа норм не дублировать по экранам: только `getLabNorm` / `LAB_TIERS`. Новый порог — сначала движок, потом UI.
- Каждое новое правило взаимодействия или порог идут с тестом и уровнем доказательности; источник — по скиллу
  `research` (PubMed/OpenAlex), не «из головы».
- Любой экран, где пользователь видит дозу, обязан нести медицинский дисклеймер (см. P0-1 в аудите).
- Не выдавать расчёт за назначение: текст «это информация, а не медицинская рекомендация» + эскалация к врачу при
  красных флагах (`supportProtocolEmergency.tsx`).
- Женская ветка — отдельная логика (`female-aas-risk.ts`, `docs/FEMALE_AAS_PROTOCOLS.md`), не частный случай мужской.

## Проверки

`npm run type-check`, `npm test` (`test:core` для движков, `test:ui` для экранов фармы), `npm run verify:apk-design`
при правках фарма-UI.

## Известные дыры (не «забыть», а знать)

ПКТ-препаратов нет в `PHARMA_DB`; оральные ААС без дневника приёма; `CourseEntry` без эстера и дней инъекций;
нет источников у чисел; нет гейтов согласия. Полный список с `file:line` — в аудите.
