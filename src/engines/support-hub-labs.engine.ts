/**
 * support-hub-labs.engine.ts — P8-добавка: LAB-мониторинг топ-веществ + alias-резолв.
 * Калькулятор поддержки не тронут. Чистые функции, без UI.
 *
 * Честность: где лабораторного маркера нет (мелатонин, коллаген, пробиотики) —
 * так и написано: контроль — дневник/шкала, а не выдуманный анализ.
 * system — только из 8 канонических (рендер группирует по SYSTEM_ORDER,
 * чужие системы дропаются): hepatic/renal/cardio/hematologic/coagulation/metabolic/hormonal/mineral.
 */

export interface HubLabMon {
  markerRu: string; markerEn: string; system: string;
  when: string; target: string;
  condition: string;
  note: string;
  tier1?: string;
  tier2?: string;
  tier3?: string;
}

/** Алиасы id каталога → ключи LAB-базы (точное совпадение тоже работает). */
export const LAB_ID_ALIASES: Record<string, string> = {
  zinc_sup: 'zinc', zinc_supplement: 'zinc',
  iron_supplement: 'iron', iron_lipofer: 'iron',
  magnesium_l_threonate: 'magnesium', magnesium: 'magnesium',
  curcumin_sup: 'curcumin',
  copper_supp: 'copper', copper_supplement: 'copper',
  selenium_sup: 'selenium',
  methylcobalamin: 'vitamin_b12', b12: 'vitamin_b12', cobalamin: 'vitamin_b12',
  metformin_mr: 'metformin',
  collagen_ii: 'collagen', collagen_uc2: 'collagen', col_ii: 'collagen',
  k2: 'vitamin_k2', k2_mk7: 'vitamin_k2', menaquinone: 'vitamin_k2',
  vit_c: 'vitamin_c', ascorbic: 'vitamin_c',
  folic_acid: 'folate', folacin: 'folate',
  retinol: 'vitamin_a',
  probiotic: 'probiotics',
  tudca_caps: 'TUDCA',
};

/**
 * Резолв записей мониторинга: exact → lowercase → alias → alias-lowercase.
 * Чинит и case-рассинхрон (TUDCA), и id-варианты каталога (zinc_sup vs zinc).
 */
export function resolveLabMonitor(db: Record<string, HubLabMon[]>, id: string): HubLabMon[] {
  if (!id) return [];
  if (db[id]) return db[id];
  const low = id.toLowerCase();
  if (db[low]) return db[low];
  const alias = LAB_ID_ALIASES[id] || LAB_ID_ALIASES[low];
  if (alias && db[alias]) return db[alias];
  return [];
}

/**
 * LAB_TOP20 — явные записи для топ-веществ, которых не было в LAB_MONITOR_DB.
 * Сливается поверх базы в резолвере (ключи не пересекаются с существующими).
 */
export const LAB_TOP20: Record<string, HubLabMon[]> = {
  creatine: [
    { markerRu: 'Креатинин', markerEn: 'CREATININE', system: 'renal', when: 'Каждые 8–12 нед при дозе ≥5 г/сут', target: '<115 мкмоль/л', condition: '↑ креатинин без падения СКФ — креатин, а не почка', note: 'Креатин ↑ сывороточный креатинин на 10–20% без падения СКФ. Точнее — цистатин C. Не путать с почечной недостаточностью.', tier1: '+10–30% от базы — допустимо, контроль цистатин C', tier2: '+30–50% — ↓ дозу, цистатин C + СКФ', tier3: '+50% или СКФ <60 — STOP, нефролог' },
    { markerRu: 'СКФ', markerEn: 'GFR', system: 'renal', when: 'Каждые 6–12 мес', target: '>90 мл/мин', condition: '↓ СКФ → истинное падение функции почек', note: 'При приёме креатина СКФ по креатинину занижена ложно; ориентир — цистатин C.' },
  ],
  vitamin_c: [
    { markerRu: 'Оксалаты мочи (маркера статуса нет)', markerEn: 'OXALATE', system: 'renal', when: 'При дозе >1000 мг/сут длительно', target: '—', condition: 'Специфичного маркера статуса C нет', note: 'Рутинный контроль не нужен. Риск — оксалатные камни при мегадозах >1000 мг/сут длительно. При МКБ в анамнезе — не превышать 500 мг/сут.' },
  ],
  vitamin_b12: [
    { markerRu: 'B12 сывороточный', markerEn: 'B12', system: 'hematologic', when: 'Каждые 6–12 мес', target: '300–900 пг/мл', condition: '↓ B12 → мегалобластоз, нейропатия', note: '200–300 — серая зона (смотреть ММК/гомоцистеин). На метформине/ИПП — падает на 10–20% за полгода.', tier1: '200–300 — B12 500–1000 мкг/сут', tier3: '<150 — B12 в/м, врач' },
    { markerRu: 'Гомоцистеин', markerEn: 'HOMOCYSTEINE', system: 'metabolic', when: 'Каждые 6–12 мес', target: '<12 мкмоль/л', condition: '↑ гомоцистеин → тканевой дефицит B12/фолата', note: 'Функциональный маркер точнее сывороточного B12. ↑ также при дефиците фолата/B6.' },
  ],
  selenium: [
    { markerRu: 'Селен сывороточный', markerEn: 'SELENIUM', system: 'mineral', when: 'Каждые 3–6 мес', target: '70–150 мкг/л', condition: '↑ Se → селеноз (волосы, ногти, чесночный запах)', note: 'Оптимум для GPx — 90–120 мкг/л. Не превышать 400 мкг/сут суммарно.', tier1: '>150 — ↓ дозу', tier3: 'Выпадение волос + ломкость ногтей — STOP, врач' },
  ],
  iodine: [
    { markerRu: 'ТТГ', markerEn: 'TSH', system: 'hormonal', when: 'Каждые 2–3 мес на старте', target: '0.4–4.0 мМЕ/л', condition: '↑ ТТГ → избыток йода блокирует синтез (эффект Вольфа–Чайкова)', note: 'Избыток йода (>1100 мкг/сут) может дать гипотиреоз или тиреоидит, особенно при АИТ.', tier1: 'ТТГ 4–10 — ↓ дозу йода', tier3: 'ТТГ >10 — STOP йод, эндокринолог' },
    { markerRu: 'Св. Т4', markerEn: 'FT4', system: 'hormonal', when: 'С ТТГ', target: '9–22 пмоль/л', condition: '↓ св.Т4 при ↑ ТТГ → гипотиреоз', note: 'Пара к ТТГ для различения субклиники и явного гипотиреоза.' },
  ],
  melatonin: [
    { markerRu: 'Дневник сна (маркера нет)', markerEn: '—', system: 'hormonal', when: 'Еженедельно', target: '—', condition: 'Сонливость днём → избыток дозы/поздний приём', note: 'Лабораторного маркера нет — контроль по дневнику сна (засыпание/пробуждения/бодрость). Старт 0.5–1 мг за 30–60 мин до сна; >5 мг обычно не лучше.' },
  ],
  collagen: [
    { markerRu: 'Шкала боли / WOMAC (маркера нет)', markerEn: '—', system: 'metabolic', when: 'Каждые 4 нед', target: '—', condition: 'Боль/скованность → эффект/нет эффекта', note: 'Лабораторного маркера нет — контроль по шкале боли и функции сустава. Эффект ждать 8–12 нед; принимать с витамином C.' },
  ],
  glucosamine: [
    { markerRu: 'Глюкоза', markerEn: 'GLUCOSE', system: 'metabolic', when: 'Каждые 4–8 нед у диабетиков', target: '<5.6 ммоль/л', condition: 'Возможен небольшой ↑ глюкозы', note: 'Влияние на гликемию спорно и мало, но у диабетиков — контроль. Аллергия на морепродукты — осторожность.', tier1: '>6.1 — контроль HbA1c' },
  ],
  chondroitin: [
    { markerRu: 'Шкала боли (маркера нет)', markerEn: '—', system: 'metabolic', when: 'Каждые 4–8 нед', target: '—', condition: 'Боль/функция сустава', note: 'Лабораторного маркера нет. Обычно в связке с глюкозамином; эффект — за 2–3 мес. При варфарине — контроль МНО (единичные сигналы).' },
  ],
  msm: [
    { markerRu: 'Переносимость ЖКТ (маркера нет)', markerEn: '—', system: 'metabolic', when: 'Первые 2 нед', target: '—', condition: 'Диарея/вздутие → превышение стартовой дозы', note: 'Лабораторного маркера нет. Титровать с 1 г/сут; >3 г/сут часто даёт ЖКТ-эффекты.' },
  ],
  vitamin_k2: [
    { markerRu: 'МНО (только на варфарине!)', markerEn: 'INR', system: 'coagulation', when: 'Через 1–2 нед после старта K2 на варфарине', target: '2.0–3.0 (по назначению)', condition: '↓ МНО → K2 антагонизирует варфарин', note: 'Вне варфарина рутинный маркер не нужен. На варфарине K2 может сбить МНО — КРИТИЧНО, только с врачом.', tier2: 'МНО вне цели — врач, коррекция дозы варфарина', tier3: 'МНО <1.5 на варфарине — срочно к врачу' },
  ],
  copper: [
    { markerRu: 'Медь + церулоплазмин', markerEn: 'COPPER', system: 'mineral', when: 'Каждые 3–6 мес на Zn >30 мг/сут', target: 'Cu 11–22 мкмоль/л', condition: '↓ Cu → анемия, нейтропения, миелопатия', note: 'Держать Zn:Cu ≈ 10:1. Анемия + лейкопения на фоне цинка — в первую очередь медь.', tier1: 'Низкая Cu — Cu 2 мг/сут врозь с Zn', tier3: 'Анемия + нейропатия — STOP Zn, невролог' },
  ],
  folate: [
    { markerRu: 'Фолат + гомоцистеин', markerEn: 'FOLATE', system: 'hematologic', when: 'Каждые 6–12 мес', target: 'Фолат >7 нмоль/л; Hcy <12', condition: '↑ Hcy → дефицит фолата/B12', note: 'ВАЖНО: фолат без B12 маскирует мегалобластоз при продолжающейся нейропатии B12-дефицита — всегда смотреть B12 вместе.', tier1: 'Hcy 12–15 — 5-МТГФ 400 мкг + B12' },
  ],
  vitamin_a: [
    { markerRu: 'Ретинол + АЛТ', markerEn: 'VITAMIN_A', system: 'hepatic', when: 'Каждые 3–6 мес при дозе >3000 мкг/сут', target: 'Ретинол 1.05–2.8 мкмоль/л; АЛТ <40', condition: '↑ АЛТ + ↑ ретинол → гипервитаминоз A', note: 'Хронический избыток → гепатотоксичность, остеопороз, тератогенность. Бета-каротин из еды безопаснее ретинола.', tier2: 'АЛТ 80–200 — STOP ретинол', tier3: 'АЛТ >200 — STOP, врач' },
  ],
  rhodiola: [
    { markerRu: 'Дневник АД/ЧСС (маркера нет)', markerEn: '—', system: 'cardio', when: 'Первые 2 нед', target: '<130/80', condition: '↑ АД/возбуждение → избыток дозы', note: 'Лабораторного маркера нет. Принимать утром/днём; вечером может дать бессонницу. При гипертонии — контроль АД.' },
  ],
  probiotics: [
    { markerRu: 'Дневник стула (маркера нет)', markerEn: '—', system: 'metabolic', when: 'Первые 2–4 нед', target: '—', condition: 'Вздутие/диарея дольше 2 нед → штамм не подошёл', note: 'Лабораторного маркера нет — контроль по шкале Bristol и вздутию. Адаптация 3–7 дней норма; дольше — смена штамма.' },
  ],
  taurine: [
    { markerRu: 'Дневник АД (маркера нет)', markerEn: '—', system: 'cardio', when: 'При ГБ — еженедельно', target: '<130/80', condition: 'АД/пульс', note: 'Рутинный маркер не нужен. При гипертонии возможен мягкий ↓ АД-эффект — контроль дневником, не заменяет терапию.' },
  ],
};
