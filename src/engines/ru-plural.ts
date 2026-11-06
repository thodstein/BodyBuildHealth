/**
 * ru-plural.ts — согласование числительных с существительными (русский).
 *
 * Зачем: тексты плана собираются шаблонами вида `\`${n} сетов\``, поэтому при
 * n = 1..4 получалось «1 недель», «3 тренировок», «2 сетов». Замер по 384
 * пользовательским текстам (отчёт/печать/rationale/валидация, 8 сплитов ×
 * 2 уровня × 1..6 недель): 1419 неверных форм.
 *
 * Важно: функция нужна только для ИМЕНИТЕЛЬНОГО счёта («3 сета», «4 недели»).
 * После предлогов и знаков сравнения нужен родительный падеж, и он уже верен:
 * «до 2 сетов», «из 4 сетов», «по 3 сета», «≥ 5 сетов» — такие места не трогаем.
 */

/** Формы существительного: [одно, 2–4, 5+]. */
export type RuPluralForms = readonly [one: string, few: string, many: string];

/** Нужная форма для числа `n`. */
export function ruForm(n: number, forms: RuPluralForms): string {
  const abs = Math.abs(Math.trunc(Number.isFinite(n) ? n : 0));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** «N + слово» в правильной форме: `ruCount(3, RU_SETS)` → «3 сета». */
export function ruCount(n: number, forms: RuPluralForms): string {
  return `${n} ${ruForm(n, forms)}`;
}

/**
 * «N прилагательное существительное» с согласованием обоих:
 * `ruAdjCount(3, RU_ADJ_WORKING, RU_SETS)` → «3 рабочих сета»,
 * `ruAdjCount(1, RU_ADJ_WORKING, RU_SETS)` → «1 рабочий сет».
 *
 * Формы прилагательного задаёт вызывающий: для мужского рода при 2–4 это
 * родительный мн. («рабочих»), для женского — именительный мн. («пустые»).
 */
export function ruAdjCount(n: number, adj: RuPluralForms, noun: RuPluralForms): string {
  return `${n} ${ruForm(n, adj)} ${ruForm(n, noun)}`;
}

/** Прилагательные, которые встречаются в счёте (формы подобраны под род). */
export const RU_ADJ_WORKING: RuPluralForms = ['рабочий', 'рабочих', 'рабочих'];
export const RU_ADJ_TRAINING: RuPluralForms = ['тренировочный', 'тренировочных', 'тренировочных'];
export const RU_ADJ_EMPTY_F: RuPluralForms = ['пустая', 'пустые', 'пустых'];

export const RU_WEEKS: RuPluralForms = ['неделя', 'недели', 'недель'];
export const RU_TRAININGS: RuPluralForms = ['тренировка', 'тренировки', 'тренировок'];
export const RU_SETS: RuPluralForms = ['сет', 'сета', 'сетов'];
export const RU_APPROACHES: RuPluralForms = ['подход', 'подхода', 'подходов'];
export const RU_EXERCISES: RuPluralForms = ['упражнение', 'упражнения', 'упражнений'];
export const RU_DAYS: RuPluralForms = ['день', 'дня', 'дней'];
export const RU_SESSIONS: RuPluralForms = ['сессия', 'сессии', 'сессий'];
export const RU_CYCLES: RuPluralForms = ['цикл', 'цикла', 'циклов'];
export const RU_POINTS: RuPluralForms = ['точка', 'точки', 'точек'];
export const RU_MEASUREMENTS: RuPluralForms = ['замер', 'замера', 'замеров'];
export const RU_ENTRIES: RuPluralForms = ['запись', 'записи', 'записей'];
export const RU_REPS: RuPluralForms = ['повторение', 'повторения', 'повторений'];
export const RU_MONTHS: RuPluralForms = ['месяц', 'месяца', 'месяцев'];
export const RU_HOURS: RuPluralForms = ['час', 'часа', 'часов'];
export const RU_MINUTES: RuPluralForms = ['минута', 'минуты', 'минут'];
export const RU_MUSCLES: RuPluralForms = ['мышца', 'мышцы', 'мышц'];
export const RU_INJECTIONS: RuPluralForms = ['инъекция', 'инъекции', 'инъекций'];
export const RU_MARKERS: RuPluralForms = ['маркер', 'маркера', 'маркеров'];
export const RU_ANOMALIES: RuPluralForms = ['аномалия', 'аномалии', 'аномалий'];
export const RU_FORECASTS: RuPluralForms = ['прогноз', 'прогноза', 'прогнозов'];
export const RU_SETTINGS: RuPluralForms = ['настройка', 'настройки', 'настроек'];
export const RU_OBSERVATIONS: RuPluralForms = ['измерение', 'измерения', 'измерений'];
export const RU_CARDS: RuPluralForms = ['карта', 'карты', 'карт'];
export const RU_ERRORS: RuPluralForms = ['ошибка', 'ошибки', 'ошибок'];
export const RU_WARNINGS: RuPluralForms = ['предупреждение', 'предупреждения', 'предупреждений'];
export const RU_ADJ_SECONDARY: RuPluralForms = ['вторичное', 'вторичных', 'вторичных'];
export const RU_ADJ_LEG: RuPluralForms = ['ножная', 'ножные', 'ножных'];
export const RU_ADJ_DIRECT: RuPluralForms = ['прямой', 'прямых', 'прямых'];
export const RU_ADJ_PRESS: RuPluralForms = ['жимовой', 'жимовых', 'жимовых'];
export const RU_ADJ_COMPLETED: RuPluralForms = ['завершённая', 'завершённых', 'завершённых'];
export const RU_CHANGES: RuPluralForms = ['изменение', 'изменения', 'изменений'];
export const RU_STEPS: RuPluralForms = ['шаг', 'шага', 'шагов'];
export const RU_OCCURRENCES: RuPluralForms = ['вхождение', 'вхождения', 'вхождений'];
export const RU_FACTS: RuPluralForms = ['факт', 'факта', 'фактов'];
export const RU_ADJ_DEAD: RuPluralForms = ['мёртвая', 'мёртвые', 'мёртвых'];
export const RU_ADJ_PAUSED: RuPluralForms = ['паузный', 'паузных', 'паузных'];
export const RU_ADJ_RECORDED: RuPluralForms = ['записанный', 'записанных', 'записанных'];
export const RU_ADJ_SAME: RuPluralForms = ['одинаковый', 'одинаковых', 'одинаковых'];
export const RU_SESSIONS_IN: RuPluralForms = ['сессии', 'сессиях', 'сессиях'];
export const RU_MEALS: RuPluralForms = ['приём', 'приёма', 'приёмов'];
export const RU_ADJ_UNIQUE: RuPluralForms = ['уникальный', 'уникальных', 'уникальных'];
export const RU_ADJ_DOSE: RuPluralForms = ['дозовое', 'дозовых', 'дозовых'];
export const RU_ADJ_UNILATERAL: RuPluralForms = ['унилатеральный', 'унилатеральных', 'унилатеральных'];
export const RU_BLOCKS: RuPluralForms = ['блок', 'блока', 'блоков'];
export const RU_EVENTS: RuPluralForms = ['ивент', 'ивента', 'ивентов'];
export const RU_EVENT_DAYS: RuPluralForms = ['ивент-день', 'ивент-дня', 'ивент-дней'];
export const RU_SUPPLEMENTS: RuPluralForms = ['препарат', 'препарата', 'препаратов'];
export const RU_TESTS: RuPluralForms = ['тест', 'теста', 'тестов'];
export const RU_SYMPTOMS: RuPluralForms = ['симптом', 'симптома', 'симптомов'];
export const RU_SECTIONS: RuPluralForms = ['раздел', 'раздела', 'разделов'];
export const RU_MECHANISMS: RuPluralForms = ['механизм', 'механизма', 'механизмов'];
export const RU_ORGANS: RuPluralForms = ['орган', 'органа', 'органов'];
export const RU_CONFLICTS: RuPluralForms = ['конфликт', 'конфликта', 'конфликтов'];
export const RU_PAIRS: RuPluralForms = ['пара', 'пары', 'пар'];
export const RU_NOTES: RuPluralForms = ['замечание', 'замечания', 'замечаний'];
export const RU_DUPLICATES: RuPluralForms = ['дубль', 'дубля', 'дублей'];
export const RU_ELEMENTS: RuPluralForms = ['элемент', 'элемента', 'элементов'];
export const RU_CORRECTIONS: RuPluralForms = ['коррекция', 'коррекции', 'коррекций'];
export const RU_REVEALS: RuPluralForms = ['раскрытие', 'раскрытия', 'раскрытий'];
export const RU_PATTERNS: RuPluralForms = ['паттерн', 'паттерна', 'паттернов'];
export const RU_FLAGS: RuPluralForms = ['флаг', 'флага', 'флагов'];
export const RU_KEYS: RuPluralForms = ['ключ', 'ключа', 'ключей'];
export const RU_PLATES: RuPluralForms = ['блин', 'блина', 'блинов'];
export const RU_PERCENTS: RuPluralForms = ['процент', 'процента', 'процентов'];
export const RU_STARTS: RuPluralForms = ['старт', 'старта', 'стартов'];
export const RU_DEPLETIONS: RuPluralForms = ['истощение', 'истощения', 'истощений'];
export const RU_PROGRAMS: RuPluralForms = ['программа', 'программы', 'программ'];
export const RU_PL_CYCLES: RuPluralForms = ['ПЛ-цикл', 'ПЛ-цикла', 'ПЛ-циклов'];
export const RU_HALL_SETS: RuPluralForms = ['зал-сет', 'зал-сета', 'зал-сетов'];
export const RU_ADJ_CRITICAL_F: RuPluralForms = ['критическая', 'критические', 'критических'];
export const RU_ADJ_CRITICAL_M: RuPluralForms = ['критический', 'критических', 'критических'];
export const RU_ADJ_BUILT: RuPluralForms = ['собранный', 'собранных', 'собранных'];
