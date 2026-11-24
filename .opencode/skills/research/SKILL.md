---
name: Research & Evidence
description: Найти и оценить источники по медицине, фармакологии, БАДам и тренировкам — evidence_literature/trials/drug_label/substance/citation, MCP pubmed/openalex, веб-поиск, уровни доказательности и проверка ссылок
---

# Research and evidence

Правило проекта: медицинский, фармакологический или нутриентный факт без источника не произносится. Сначала
источник — потом утверждение. «Я помню, что...» источником не считается.

## 1. Какой инструмент для какого вопроса

| Вопрос                                                              | Инструмент                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Эффективность, дозы, ПКТ, побочки, БАДы, тренировочные протоколы    | `evidence_literature` (PubMed + Europe PMC) или MCP `pubmed`  |
| Есть ли исследования, что набирают, фазы                            | `evidence_trials` (ClinicalTrials.gov)                        |
| Официальная инструкция: доза, противопоказания, взаимодействия      | `evidence_drug_label` (DailyMed SPL)                          |
| Что это за вещество: CID, формула, CAS, синонимы                    | `evidence_substance` (PubChem)                                |
| Ссылка настоящая и не отозвана                                      | `evidence_citation` (Crossref + OpenAlex `is_retracted`)      |
| Что уже знает наше приложение                                       | `repo_pharma`, `repo_lab`, `repo_doc`                         |
| Веб: цены, вендоры, форумы, новости, документация                   | `websearch` / `web_search` (DuckDuckGo), `webfetch`, `browse` |
| Литература вне биомедицины, цитатные графы, тренды, русские журналы | MCP `openalex` (270M+ работ)                                  |
| Документация библиотек/API                                          | MCP `context7`                                                |
| Факты об этом репозитории                                           | код (`read`/`grep`), `repo_doc`, `repo_pharma`, `repo_lab`    |

`evidence_*` и `web_search` — плагины `.opencode/plugins/evidence.ts`, без ключей и аккаунтов. Они же запасной
маршрут, если MCP `pubmed` недоступен.

## 2. Порядок для медицинского утверждения

1. Сформулируй вопрос как PICO: популяция × вмешательство × сравнение × исход.
2. `repo_pharma` / `repo_lab` — что приложение уже утверждает. Это проверяемая база, но не доказательство.
3. `evidence_literature` (или `pubmed_search_articles`, если MCP жив): 2–3 запроса с разными формулировками,
   фильтры по годам и типу публикации.
4. Есть препарат с официальным лейблом — `evidence_drug_label` (доза/противопоказания/взаимодействия — оттуда,
   не из блога).
5. Сомневаешься в веществе — `evidence_substance`, затем повтори поиск по каноническому имени.
6. Перед вставкой ссылки в отчёт — `evidence_citation` по DOI/PMID. Отозванную статью не цитировать.
7. В отчёте у каждого утверждения: источник (PubMed URL или DOI), уровень доказательности, размер эффекта.

## 3. PubMed

- Строй запрос по полям, не свободным текстом:
  - `creatine[tiab] AND hypertrophy[tiab] AND "Randomized Controlled Trial"[pt]`
  - `"Resistance Training"[mh] AND "Muscle Hypertrophy"[mh] AND 2020:2026[dp]`
  - `protein intake[tiab] AND "energy restriction"[tiab] AND athletes[mh]`
  - `pubmed pmc[sb]` — только со свободным полным текстом; `<doi>[doi]`, `<orcid>[auid]`, `"N Engl J Med"[ta]`,
    `2026/10/01:2026/10/31[edat]` работают.
- `pubmed_search_articles` (MCP) или `evidence_literature` (плагин, `source: 'pubmed'`). **Читай `notice`**: он
  показывает нераспознанные теги — иначе счётчик совпадений бессмысленный.
- Скрининг заголовков/абстрактов → `pubmed_fetch_articles` (PMIDs, `includeMesh`) → `pubmed_fetch_fulltext`
  (PMC → Europe PMC → Unpaywall). Нет полного текста — так и пиши: «абстракт».
- Сила доказательства: `pubmed_fetch_citation_metrics` (RCR, NIH percentile), `pubmed_find_related`.
- Цитаты: `pubmed_format_citations` (Vancouver) или строка из `evidence_citation`.
- **Никогда не печатай PMID/DOI по памяти**: `pubmed_convert_ids` / `evidence_citation`.

## 4. Europe PMC и препринты

- `evidence_literature` с `source: 'both'` даёт PubMed и Europe PMC за один вызов; EPMC-абстракты приходят
  сразу (у PubMed-записей — только метаданные и ссылка на PMC).
- Europe PMC не понимает PubMed-теги `[tiab]`/`[mh]` — инструмент их вычищает, но не смешивай синтаксисы в одном
  запросе, если вызываешь EPMC напрямую.
- Работают `PUB_YEAR:`, `FIRST_PDATE:[2019-01-01 TO 2026-12-31]`, `OPEN_ACCESS:y`, `DOI:`, `TITLE:`, `SRC:PPR`
  (препринты). `pubmed_europepmc_search` — когда PubMed пуст (препринты, патенты, EPMC-only OA).

## 5. ClinicalTrials.gov

- `evidence_trials`: `query`, `intervention`, `status` (`recruiting`, `active`, `completed`…), `phase`, `nctId`.
- Регистрация испытания ≠ доказательство эффекта: ищи публикацию результатов (`evidence_literature` по NCT-номеру
  или названию) и проверяй, совпадает ли заявленный исход с измеренным.

## 6. DailyMed (официальные лейблы)

- `evidence_drug_label` сначала ищет по имени (английское МНН), затем грузит первый лейбл; `setId` — точечно.
- `sections`: `boxed`, `indications`, `dosage`, `contraindications`, `warnings`, `precautions`, `interactions`,
  `adverse`, `populations`, `overdose`, `pharmacology`, `description`, `counseling`. Разделов может не быть —
  взаимодействия часто лежат внутри `precautions`, о чём инструмент предупреждает.
- У ААС и ПКТ-препаратов официальных американских лейблов обычно нет: доза/схема — PubMed + `repo_pharma`,
  и обязательно пометка «вне инструкции / off-label».

## 7. PubChem и идентичность вещества

- `evidence_substance`: CID, формула, масса, SMILES, CAS, синонимы. Нужен, чтобы не спутать эфиры, соли и
  «похожие» пептиды, и чтобы найти каноническое английское имя для PubMed.
- PubChem не даёт доз, ПКТ и клинических рекомендаций — не приписывай ему это.

## 8. Проверка ссылки

`evidence_citation` (`doi`, `pmid` или `title`): Crossref даёт журнал/год/том/страницы/авторов, OpenAlex —
цитируемость, тип и `is_retracted`. Флаг отзыва или `update-to` — стоп-сигнал: не цитировать, найти замену.

## 9. Веб

- `websearch` (встроенный, через провайдер DuckDuckGo) и `web_search` (тот же движок + `site`/`limit`) работают с
  этой машины; `webfetch` — открыть страницу, `browse` — JS-страницы и логины.
- С этой машины **403** отдают `api.fda.gov`, `ods.od.nih.gov`, USDA FDC (`api.nal.usda.gov`), DSLD
  (`api.ods.od.nih.gov`). Не трать на них раунды: лейблы — DailyMed, вещество — PubChem, доказательства — PubMed.
- Вторичные источники (Examine, Stronger by Science, MASS) — указатели: цитируй первоисточник, который они
  называют.

## 10. Уровни доказательности (в каждом отчёте)

- Иерархия: SR/мета-анализ РКИ > РКИ > проспективная когорта > поперечное/серия случаев > механистика/животные >
  мнение эксперта или анекдот. Указывай, на каком уровне стоит утверждение.
- Для каждого утверждения: популяция, n, доза/вмешательство, длительность, измеряемый исход, размер эффекта с CI,
  конфликт интересов, статус отзыва.
- Бодибилдинг-специфика: отделяй гипертрофию / силу / работоспособность; тренированные vs нетренированные;
  сравнения при уравненном объёме; прямые измерения (МРТ, КТ, DXA) vs биоимпеданс; форма и доза добавки.
  Шестинедельное исследование на новичках не переносится на продвинутых.
- Источники противоречат — покажи оба числа, не усредняй.

## 11. Результат

- Ответ по-русски; у каждого факта ссылка (PubMed URL или DOI) и уровень доказательности в скобках.
- Исследовательские отчёты — в `docs/` по правилам `bb-audit`: `<AREA>-<KIND>-<date>.md`, с `file:line`, когда
  вывод касается кода (пример: `docs/EXERCISE-CORRECTION-RESEARCH-REPORT.md`).
- Если исследование меняет константы движка (белок, объём, креатин), источник кладётся рядом с константой или в
  план-документ, тесты обновляются по скиллу `bb-engine`.

## 12. Лимиты

- NCBI: ~3 запроса/с без `NCBI_API_KEY`; батчь PMID. Europe PMC и OpenAlex — тоже polite pool.
- Hosted OpenAlex показывает метрику бюджета (`budget.remainingUsd`) — узкие запросы, скромный `per_page`, без
  исследовательских `sample`.
- `pubmed` MCP недоступен → `evidence_literature` (тот же PubMed через E-utilities), локальный stdio-сервер
  `npx -y @cyanheads/pubmed-mcp-server` (node ≥ 24) или `webfetch` на E-utilities.
- Не использовать PubMed для небиомедицинских вопросов (софт, право, цены) — это `web_search`/OpenAlex.
