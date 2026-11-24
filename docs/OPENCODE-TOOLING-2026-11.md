# OpenCode-тулинг: инструменты, маршрутизация, процесс (2026-11)

Цель: агент в этом репозитории не отвечает по памяти и не гоняет пять grep'ов на один вопрос. У него есть
keyless-инструменты к внешним первоисточникам и к самому приложению, правило выбора инструмента по типу вопроса и
протокол доведения сложной задачи до зелёных проверок.

## Что добавлено и где лежит

| Файл                                          | Что даёт                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.opencode/plugins/evidence.ts`               | `evidence_literature` (PubMed + Europe PMC), `evidence_trials` (ClinicalTrials.gov v2), `evidence_drug_label` (DailyMed SPL), `evidence_substance` (PubChem), `evidence_citation` (Crossref + OpenAlex с флагом отзыва), `web_search` (DuckDuckGo HTML) и провайдер для встроенного `websearch` |
| `.opencode/plugins/repo-knowledge.ts`         | `repo_pharma` (PHARMA_DB + поддерживающие базы ПКТ/БАД + правила взаимодействий + женский протокол), `repo_lab` (UCUM_MAP, женские границы, пороги), `repo_doc` (поиск по `docs/`, `src/`, `scripts/` → `file:line`) |
| `.opencode/plugins/project-tools.ts`          | `project_verify`, `project_apk_preflight` (было раньше)                                                    |
| `.opencode/plugins/learning.ts`               | `project_learn`, `project_learn_skill`, `project_learn_config` + context-хук памяти (было раньше)          |
| `.opencode/commands/evidence.md`              | `/evidence` — факт-чек медицинского/фарма-утверждения по источникам                                        |
| `.opencode/commands/do.md`                    | `/do` — триаж → критерии → воркстримы → фан-аут → проверки до зелёного                                     |
| `.opencode/skills/research/SKILL.md`          | таблица «вопрос → инструмент», PubMed-синтаксис, DailyMed/CT.gov/PubChem/Crossref, уровни доказательности  |
| `.opencode/skills/aas-medicine/SKILL.md`      | обязательный маршрут проверки фарма-факта (приложение → вещество → лейбл → литература → цитата → норма)    |
| `.opencode/skills/orchestration/SKILL.md`     | триаж по осям работа/источник истины/риск, правило «факт до правки»                                        |
| `.opencode/agents/lead.md`, `worker.md`       | маршрутизация по вопросу и требование источника для чисел в правке                                          |
| `AGENTS.md`                                   | короткая карта инструментов, маршрутизация, автовыбор, лимиты                                              |
| `.opencode/plugin-syntax-check.cjs`           | синтаксическая проверка плагинов (tsconfig включает только `src/**`)                                        |

## Вопрос → инструмент

| Вопрос                                                                | Инструмент                                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Что уже знает приложение о веществе (PK, доза, риски, ПКТ-протокол)   | `repo_pharma`                                                     |
| Норма/порог лабораторного кода, женские границы                       | `repo_lab`                                                        |
| Что в наших доках/коде про X                                          | `repo_doc`                                                        |
| Эффективность, дозы, ПКТ, побочки, БАДы, тренировочные протоколы      | `evidence_literature`, MCP `pubmed`                               |
| Что набирают, фазы, статус исследований                               | `evidence_trials`                                                 |
| Официальная инструкция: доза, противопоказания, взаимодействия        | `evidence_drug_label`                                             |
| Идентичность вещества: CID, CAS, формула, синонимы                    | `evidence_substance`                                              |
| Ссылка настоящая, не отозвана                                         | `evidence_citation`                                               |
| Цены, вендоры, новости, софт, документация                            | `websearch` / `web_search`, `webfetch`, `browse`                  |
| Документация библиотек/API                                            | MCP `context7`                                                    |
| Небиомедицинская литература, цитатные графы                           | MCP `openalex`                                                    |

Правило: числа (доза, t½, порог нормы, размер эффекта) попадают в код только из источника. Нет источника — «нет
данных», а не правдоподобное значение.

## Процесс сложной задачи

1. **Триаж** — работа (код / данные / медицина / релиз), источник истины, риск. Определяет навык и проверки.
2. **Критерии приёмки** — каждый с командой, которая его доказывает.
3. **Воркстримы** — непересекающиеся файлы; общие файлы остаются у `lead`.
4. **Фан-аут** — `explore` для разведки, `worker` на воркстрим (в одном ходе), затем `reviewer` и `verifier`.
5. **Фан-ин** — `project_verify` и точечные команды до зелёного, максимум 5 раундов на падающую проверку.
6. **Отчёт** — файлы, вывод команд, оставшееся и риски. Без «в процессе» без следующего шага.

## Проверено живьём (24.11.2026)

- `repo_pharma('Тамоксифен')` → `support-dosing.ts:194` (10–40 mg daily, уровень A) + `evidence-dosage-db.ts:419`
  (10–20–40 мг, ПКТ 4–6 нед) с источниками в базе: FDA Nolvadex (NDA 17-970), ASCO 2020.
- `repo_lab('HCT')` → 36–52 %, ♀ 36–48 (`LAB_REFERENCES_FEMALE.Hct`, ×100).
- `evidence_literature('creatine[tiab] AND hypertrophy[tiab]')` → PubMed PMID 37432300 (SR/мета, PMC10180745) и др.
- `evidence_trials({intervention:'creatine', status:['recruiting']})` → NCT06503016, NCT07914270…
- `evidence_drug_label('clomiphene')` → лейблы DailyMed (setid 72719958-…), разделы INDICATIONS/DOSAGE.
- `evidence_substance('tamoxifen')` → PubChem CID 2733526, CAS 10540-29-1.
- `evidence_citation({doi:'10.1007/s40279-020-01343-3'})` → Sports Medicine 2020;50(11):1863-1871, OpenAlex W3086384266.
- `web_search('creatine loading dose evidence')` → 4 результата с URL и сниппетами.
- Встроенный `websearch` через провайдер DuckDuckGo: headless-прогон вернул 3 URL (PMC10180745, mdpi.com, PubMed).
- `repo_doc('BFR MRV', scope:'all')` → 5 находок с `file:line`.

### Автовыбор проверен end-to-end

Headless-прогон (`opencode run --archived --format json --auto --agent build --model v1/deepseek/deepseek-v4.1-flash-1017`)
на вопросе «какие дозы тамоксифена для ПКТ и на какие источники это опирается» сам, без подсказки в промпте, вызвал:
`repo_pharma` → `repo_doc` → `evidence_drug_label` → `evidence_literature` → `evidence_citation` → MCP
`pubmed_fetch_fulltext` → `project_learn`. Ответ собрался из данных приложения (`evidence-dosage-db.ts:419`) с внешней
проверкой PubMed, без выдуманных чисел.

## Ограничения этой сети

- 403: `api.fda.gov` (openFDA), `ods.od.nih.gov` (ODS/DLSD), `api.nal.usda.gov` (USDA FDC). Поэтому лейблы — DailyMed,
  вещество — PubChem, доказательства — PubMed/Europe PMC, а не эти API.
- RxNav Drug Interaction API отозван (`/REST/interaction/list.json` → 404): взаимодействия берём из лейбла
  (`evidence_drug_label`, раздел `interactions`/`precautions`) и локального `pharma-interactions.engine.ts`.
- DailyMed отдаёт XML только с `Accept: */*` (с `text/xml` — 406) — уже учтено в плагине.
- PubMed без ключа ~3 запроса/с; Europe PMC и OpenAlex — polite pool.

## Как расширять

- Новый внешний источник: функция `requestText/requestJson` + `editor.add` в `.opencode/plugins/evidence.ts`,
  описание с триггерами («дозы», «лейбл», «исследования»…), затем живой вызов и запись в этот файл.
- Новое знание о приложении: читать исходники как текст (плагин не может импортировать TS приложения) и возвращать
  `file:line`; проверять на реальных именах (рус/англ/id).
- После правок: `node .opencode/check-plugin-syntax.cjs .opencode/plugins/*.ts`, `npx prettier --check ".opencode/**"`,
  живой вызов инструмента, при изменении правил — `AGENTS.md` + соответствующий скилл.
