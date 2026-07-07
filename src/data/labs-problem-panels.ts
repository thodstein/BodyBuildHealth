/**
 * labs-problem-panels.ts — Проблемно-ориентированные лабораторные панели
 *
 * 13 клинических сценариев, каждый со своим набором маркеров,
 * расшифровкой «что значит отклонение» и триггерными симптомами.
 *
 * Интеграция:
 *   - LabsScreen: режим «По проблеме» → выбор сценария → направление
 *   - symptom-lab-link.ts: симптом → рекомендуемая ProblemPanel
 *   - support-calculator: приоритетная коррекция по сценарию
 */

export type MarkerImportance = 'critical' | 'important' | 'optional';

export interface ProblemMarker {
  code: string;          // код из UCUM_MAP
  label: string;         // русское название
  importance: MarkerImportance;
  /** Что значит отклонение вверх */
  highMeaning?: string;
  /** Что значит отклонение вниз */
  lowMeaning?: string;
  /** Целевой диапазон */
  target?: string;
}

export interface ProblemPanel {
  id: string;
  title: string;
  problem: string;                 // описание проблемы (1 предложение)
  phase: string;                    // baseline | on_cycle | pct | any
  urgency: 'routine' | 'urgent' | 'emergency';
  markers: ProblemMarker[];
  clinicalNotes: string;            // врачебная заметка: что искать, дифдиагноз
  triggerSymptoms: string[];        // symptomId из symptom-solver.engine
  recommendedActions: string[];     // что делать помимо анализов
}

export const PROBLEM_PANELS: ProblemPanel[] = [

  // ════════════════════════════════════════════════════════════════
  //  БЛОК А: ДО КУРСА (baseline — расширение скрининга)
  // ════════════════════════════════════════════════════════════════

  {
    id: 'cardio_full',
    title: 'Расширенный сердечно-сосудистый скрининг',
    problem: 'Оценка сердечно-сосудистого риска перед курсом ААС: дислипидемия, тромбофилия, ГЛЖ, гипертензия',
    phase: 'baseline',
    urgency: 'routine',
    markers: [
      { code: 'LDL', label: 'ЛПНП', importance: 'critical', highMeaning: '↑ риск атеросклероза — старт статинов/бергамота', target: '<3.0 ммоль/л' },
      { code: 'HDL', label: 'ЛПВП', importance: 'critical', lowMeaning: '↓ антиатерогенная защита — омега-3, ниацин', target: '>1.0 ммоль/л' },
      { code: 'TG', label: 'Триглицериды', importance: 'important', highMeaning: '↑ риск на оральных ААС — омега-3 2-4 г/сут', target: '<1.7 ммоль/л' },
      { code: 'APO_B', label: 'Аполипопротеин B', importance: 'critical', highMeaning: '↑ число атерогенных частиц — точнее ЛПНП', target: '<1.0 г/л' },
      { code: 'APO_A1', label: 'Аполипопротеин A1', importance: 'important', lowMeaning: '↓ антиатерогенных частиц', target: '>1.1 г/л' },
      { code: 'LP_A', label: 'Липопротеин(a)', importance: 'critical', highMeaning: '>30 мг/дл — генетический риск, на курсе растёт', target: '<30 мг/дл' },
      { code: 'HOMOCYSTEINE', label: 'Гомоцистеин', importance: 'critical', highMeaning: '>12 мкмоль/л — эндотелиальная дисфункция, тромбоз', target: '<10 мкмоль/л' },
      { code: 'D_DIMER', label: 'D-димер', importance: 'important', highMeaning: '↑ риск тромбоза — необходим исходный уровень', target: '<0.5 мкг/мл' },
      { code: 'FIBRINOGEN', label: 'Фибриноген', importance: 'important', highMeaning: '↑ вязкость крови + воспаление', target: '2.0-4.0 г/л' },
      { code: 'NT_PROBNP', label: 'NT-proBNP', importance: 'critical', highMeaning: '>125 пг/мл — растяжение миокарда, риск ГЛЖ', target: '<125 пг/мл' },
      { code: 'BP_SYSTOLIC', label: 'АД систолическое', importance: 'critical', highMeaning: '>130 мм — гипертензия до курса = удвоенный риск', target: '<130 мм рт.ст.' },
      { code: 'BP_DIASTOLIC', label: 'АД диастолическое', importance: 'critical', highMeaning: '>85 мм — диастолическая дисфункция', target: '<85 мм рт.ст.' },
      { code: 'HR', label: 'ЧСС покоя', importance: 'important', highMeaning: '>90 — симпатическая гиперактивность', target: '60-80 уд/мин' },
      { code: 'ENDOTHELIN1', label: 'Эндотелин-1', importance: 'optional', highMeaning: '>3 пг/мл — эндотелиальная дисфункция', target: '<3.0 пг/мл' },
      { code: 'CRP', label: 'СРБ (hsCRP)', importance: 'important', highMeaning: '>2 мг/л — сосудистое воспаление', target: '<1.0 мг/л (hs)' },
    ],
    clinicalNotes: 'ЭхоКГ обязательно: ИММЛЖ, ФВ, ЛП, ПЖ. СМАД при пограничном АД. При LP_A >50 мг/дл + семейный анамнез тромбозов — генетическая панель тромбофилий.',
    triggerSymptoms: ['hypertension_symptoms', 'dyspnea', 'chest_pain', 'palpitations'],
    recommendedActions: [
      'ЭхоКГ с допплером (ИММЛЖ, ФВ, ЛП)',
      'СМАД при АД >130/85',
      'Консультация кардиолога при NT-proBNP >125',
      'Липидограмма развёрнутая (апоA1/B, Lp(a))',
    ],
  },

  {
    id: 'hormone_passport',
    title: 'Гормональный паспорт (полный эндокринный профиль)',
    problem: 'Исходный гормональный фон: тестостерон, эстрадиол, надпочечники, щитовидная. Доказательная база для ПКТ.',
    phase: 'baseline',
    urgency: 'routine',
    markers: [
      { code: 'TT', label: 'Тестостерон общий', importance: 'critical', lowMeaning: '↓ гипогонадизм — курс усугубит', target: '>400 нг/дл' },
      { code: 'FT', label: 'Тестостерон свободный', importance: 'critical', lowMeaning: '↓ биодоступный Т — рассчитать по SHBG+альбумину', target: '>9 пг/мл' },
      { code: 'E2', label: 'Эстрадиол', importance: 'critical', highMeaning: '↑ исходная гиперэстрогения', target: '15-35 пг/мл' },
      { code: 'SHBG', label: 'ГСПГ', importance: 'critical', highMeaning: '↑ снижает свободный Т; ↓ на оральных — резкий скачок', target: '20-45 нмоль/л' },
      { code: 'DHT', label: 'Дигидротестостерон', importance: 'important', highMeaning: '↑ риск алопеции/акне/простаты', target: '200-600 пг/мл' },
      { code: 'PRL', label: 'Пролактин', importance: 'important', highMeaning: '>15 нг/мл — пролактинома? Макропролактин?', target: '<12 нг/мл' },
      { code: 'LH', label: 'ЛГ', importance: 'critical', lowMeaning: '↓ гипогонадотропный гипогонадизм', target: '>3 мМЕ/мл' },
      { code: 'FSH', label: 'ФСГ', importance: 'critical', lowMeaning: '↓ нарушение сперматогенеза', target: '>3 мМЕ/мл' },
      { code: 'ANDROSTENEDIONE', label: 'Андростендион', importance: 'important', highMeaning: '↑ источник ароматизации, надпочечники', target: '<5 нмоль/л' },
      { code: 'PROGESTERONE', label: 'Прогестерон', importance: 'important', highMeaning: '↑ на 19-нор-стероидах; >1.5 нмоль/л — ВДКН?', target: '<1.3 нмоль/л' },
      { code: 'CORTISOL', label: 'Кортизол (утро)', importance: 'important', highMeaning: '↑ хронический стресс; ↓ надпочечниковая недостаточность', target: '150-450 нмоль/л' },
      { code: 'DHEA_S', label: 'ДГЭА-С', importance: 'important', lowMeaning: '↓ истощение надпочечников', target: '>180 мкг/дл' },
      { code: 'TSH', label: 'ТТГ', importance: 'critical', highMeaning: '>3.0 — субклинический гипотиреоз', target: '0.5-2.5 мМЕ/л' },
      { code: 'FT3', label: 'Т3 свободный', importance: 'important', lowMeaning: '↓ низкий Т3-синдром', target: '3.5-6.0 пмоль/л' },
      { code: 'FT4', label: 'Т4 свободный', importance: 'important', lowMeaning: '↓ гипотиреоз', target: '12-18 пмоль/л' },
      { code: 'INHB', label: 'Ингибин Б', importance: 'critical', lowMeaning: '↓ <80 пг/мл — угнетение сперматогенеза', target: '>100 пг/мл' },
      { code: 'AMH', label: 'АМГ', importance: 'optional', lowMeaning: '↓ функция клеток Сертоли', target: '>2.0 нг/мл' },
    ],
    clinicalNotes: 'При TT<300 + LH<3 — гипогонадотропный гипогонадизм (МРТ гипофиза). При SHBG>60 — гипертиреоз/эстрогены/цирроз. При PRL>25 — макропролактин, МРТ гипофиза. Утренний забор 8-9:00 натощак.',
    triggerSymptoms: ['libido_decrease', 'mood_swings', 'fatigue', 'gynecomastia'],
    recommendedActions: [
      'Забор крови 8:00-9:00 утра, натощак',
      'Исключить интенсивные тренировки за 48ч до забора',
      'При TT<300 — повторить через 2 нед + ГСПГ + альбумин',
      'При PRL>25 — макропролактин-тест + МРТ гипофиза',
    ],
  },

  {
    id: 'nutritional_passport',
    title: 'Нутритивно-минеральный паспорт',
    problem: 'Дефициты микронутриентов на старте усугубляются на курсе ААС: магний, цинк, D3, железо.',
    phase: 'baseline',
    urgency: 'routine',
    markers: [
      { code: 'VITD', label: 'Витамин D (25-OH)', importance: 'critical', lowMeaning: '↓ <30 нг/мл — дефицит; <20 — тяжёлый', target: '40-70 нг/мл' },
      { code: 'ZINC', label: 'Цинк (сыв.)', importance: 'important', lowMeaning: '↓ кофактор ароматазы и 5α-редуктазы', target: '12-18 мкмоль/л' },
      { code: 'MAGNESIUM', label: 'Магний (сыв.)', importance: 'important', lowMeaning: '↓ мышечные спазмы, аритмии, инсулинорезистентность', target: '0.8-1.0 ммоль/л' },
      { code: 'SELENIUM', label: 'Селен', importance: 'important', lowMeaning: '↓ <70 мкг/л — глутатионпероксидаза ↓', target: '90-130 мкг/л' },
      { code: 'COPPER', label: 'Медь', importance: 'optional', highMeaning: '↑ оксидативный стресс, конкуренция с Zn', target: '12-25 мкмоль/л' },
      { code: 'B12', label: 'Витамин B12', importance: 'important', lowMeaning: '↓ <250 пг/мл — нейропатия, анемия', target: '400-700 пг/мл' },
      { code: 'FOL', label: 'Фолат (B9)', importance: 'important', lowMeaning: '↓ <5 нг/мл — гипергомоцистеинемия', target: '>8 нг/мл' },
      { code: 'VITAMIN_E', label: 'Витамин E', importance: 'optional', lowMeaning: '↓ антиоксидантная защита ЛПНП', target: '>18 мкмоль/л' },
      { code: 'FERRITIN', label: 'Ферритин', importance: 'critical', highMeaning: '↑ >250 мкг/л — гемохроматоз? Воспаление?', target: '50-200 мкг/л' },
      { code: 'IRON', label: 'Железо сыв.', importance: 'important', lowMeaning: '↓ анемия; ↑ гемохроматоз', target: '14-28 мкмоль/л' },
      { code: 'TIBC', label: 'ОЖСС', importance: 'important', lowMeaning: '↑ железодефицит; ↓ воспаление', target: '50-68 мкмоль/л' },
    ],
    clinicalNotes: 'Дефицит D3 (<30) — коррекция 5000-10000 МЕ/сут 8-12 нед. Zn сывороточный <12 — пиколинат/глюконат 30-50 мг/сут. Mg сыв. <0.75 — цитрат/глицинат 300-400 мг/сут. Ферритин >250 + насыщение трансферрина >45% — HFE-ген (гемохроматоз).',
    triggerSymptoms: ['fatigue', 'muscle_cramps', 'weakness', 'joint_pain'],
    recommendedActions: [
      'Коррекция дефицита D3: 5000-10000 МЕ/сут с K2 (MK-7)',
      'Цинк + медь в соотношении 10:1 при длительном приёме',
      'Mg цитрат/глицинат 300-400 мг/сут перед сном',
      'При ферритине >250 — HFE-ген + УЗИ печени',
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  БЛОК Б: НА КУРСЕ (проблемно-ориентированные сценарии)
  // ════════════════════════════════════════════════════════════════

  {
    id: 'hypertension_workup',
    title: 'Давление растёт (гипертензивный сценарий)',
    problem: 'АД >130/85 на курсе ААС. Дифференциал: активация РААС, задержка Na+/H₂O, эндотелиальная дисфункция.',
    phase: 'on_cycle',
    urgency: 'urgent',
    markers: [
      { code: 'BP_SYSTOLIC', label: 'АД систолическое', importance: 'critical', highMeaning: '>140 — медикаментозная коррекция (телмисартан)', target: '<130 мм рт.ст.' },
      { code: 'BP_DIASTOLIC', label: 'АД диастолическое', importance: 'critical', highMeaning: '>90 — диастолическая дисфункция/ГЛЖ', target: '<85 мм рт.ст.' },
      { code: 'HR', label: 'ЧСС', importance: 'important', highMeaning: '>90 — компенсаторная тахикардия? небиволол?', target: '<80 уд/мин' },
      { code: 'K', label: 'Калий', importance: 'critical', lowMeaning: '↓ гипокалиемия (альдостерон, диуретики)', target: '4.0-5.0 ммоль/л' },
      { code: 'SODIUM', label: 'Натрий', importance: 'important', highMeaning: '↑ задержка Na+/H₂O (17α-алкил, трен)', target: '136-142 ммоль/л' },
      { code: 'NT_PROBNP', label: 'NT-proBNP', importance: 'critical', highMeaning: '↑ >200 пг/мл — ГЛЖ/растяжение миокарда', target: '<125 пг/мл' },
      { code: 'ENDOTHELIN1', label: 'Эндотелин-1', importance: 'important', highMeaning: '↑ эндотелиальная дисфункция', target: '<3.0 пг/мл' },
      { code: 'UACR', label: 'Альбумин/креатинин мочи', importance: 'important', highMeaning: '↑ >30 мг/г — гипертензивная нефропатия', target: '<30 мг/г' },
      { code: 'CYSTATIN_C', label: 'Цистатин C', importance: 'important', highMeaning: '↑ >1.0 мг/л — снижение СКФ (точнее креатинина)', target: '<0.95 мг/л' },
    ],
    clinicalNotes: 'Механизм: ААС → активация РААС (ренин↑ → ангиотензин II↑ → альдостерон↑) → задержка Na+/H₂O + вазоконстрикция. 17α-алкилированные — дополнительная задержка Na+. Тренболон — активация минералокортикоидных рецепторов. Первая линия: телмисартан 40-80 мг (ARB + PPAR-γ). Вторая: небиволол 2.5-5 мг (β1-селективный + NO).',
    triggerSymptoms: ['hypertension_symptoms', 'headache', 'dizziness', 'flushed_skin', 'dyspnea'],
    recommendedActions: [
      'Телмисартан 40 мг → титровать до 80 мг при АД >135/85',
      'Небиволол 2.5-5 мг при ЧСС >85 + АД >130',
      'Ограничение Na+ (<3 г/сут), ↑ K+ (4.5-5.0)',
      'ЭхоКГ при NT-proBNP >200 или АД >150/95',
    ],
  },

  {
    id: 'hepatotoxicity_workup',
    title: 'Печень болит / АЛТ >100 (гепатотоксический сценарий)',
    problem: 'Цитолиз и/или холестаз на курсе: дифференциал гепатоцеллюлярного vs холестатического повреждения.',
    phase: 'on_cycle',
    urgency: 'urgent',
    markers: [
      { code: 'ALT', label: 'АЛТ', importance: 'critical', highMeaning: '>80 — цитолиз (гепатоцеллюлярное). >200 — тяжёлый', target: '<45 Ед/л' },
      { code: 'AST', label: 'АСТ', importance: 'critical', highMeaning: '>80 — цитолиз. AST/ALT >2 = алкоголь/митохондрии', target: '<40 Ед/л' },
      { code: 'GGT', label: 'ГГТ', importance: 'critical', highMeaning: '>80 — холестаз (первый растёт на оральных)', target: '<55 Ед/л' },
      { code: 'ALP', label: 'Щелочная фосфатаза', importance: 'important', highMeaning: '>150 — холестаз (поздний маркёр)', target: '<130 Ед/л' },
      { code: 'BILE_ACIDS', label: 'Желчные кислоты', importance: 'critical', highMeaning: '>10 мкмоль/л — ранний холестаз (до ЩФ)', target: '<8 мкмоль/л' },
      { code: 'BIL', label: 'Билирубин общий', importance: 'important', highMeaning: '>25 — желтуха; >50 — отмена курса', target: '<18 мкмоль/л' },
      { code: 'DBIL', label: 'Билирубин прямой', importance: 'important', highMeaning: '↑ холестаз (прямой >50% общего)', target: '<5 мкмоль/л' },
      { code: 'CHOLINESTERASE', label: 'Холинэстераза', importance: 'important', lowMeaning: '↓ <4000 — снижение синтетической функции', target: '>5000 Ед/л' },
      { code: 'PREALBUMIN', label: 'Преальбумин', importance: 'important', lowMeaning: '↓ <180 мг/л — острое снижение синтеза белка', target: '>220 мг/л' },
      { code: 'ALB', label: 'Альбумин', importance: 'important', lowMeaning: '↓ <32 г/л — хроническая печёночная недостаточность', target: '>38 г/л' },
      { code: 'INR', label: 'МНО', importance: 'critical', highMeaning: '>1.3 — дефицит факторов свёртывания', target: '0.9-1.1' },
      { code: 'AMMONIA', label: 'Аммиак', importance: 'optional', highMeaning: '>60 мкмоль/л — портосистемная энцефалопатия', target: '<45 мкмоль/л' },
    ],
    clinicalNotes: 'R-фактор = ALT/ALP (отн. к верхней границе нормы): >5 = гепатоцеллюлярное (NAC, силимарин); <2 = холестатическое (TUDCA, урсодезоксихолевая); 2-5 = смешанное. При ALT>200 + BIL>50 = отмена оральных ААС + госпитализация. 17α-алкилированные: оксандролон (низкая токсичность), оксиметолон/метандиенон (высокая). Инъекционные: тренболон, болденон (умеренная токсичность).',
    triggerSymptoms: ['liver_pain', 'nausea', 'jaundice', 'fatigue', 'appetite_loss', 'gi_discomfort', 'yellow_eyes'],
    recommendedActions: [
      'NAC 1200-2400 мг/сут + TUDCA 500-1000 мг/сут',
      'Отмена оральных ААС при АЛТ>5×ULN (>200)',
      'УЗИ ОБП + допплер сосудов печени',
      'Госпитализация при ALT>500 или BIL>50 + INR>1.5',
      'Исключить вирусные гепатиты (HBsAg, anti-HCV)',
    ],
  },

  {
    id: 'gynecomastia_workup',
    title: 'Грудь болит / гинекомастия (эстрогенный сценарий)',
    problem: 'Боль/уплотнение в груди на курсе. Дифференциал: эстрогенная vs прогестиновая гинекомастия.',
    phase: 'on_cycle',
    urgency: 'urgent',
    markers: [
      { code: 'E2', label: 'Эстрадиол', importance: 'critical', highMeaning: '>40 пг/мл — эстрогенная гинекомастия (ароматизация)', target: '20-35 пг/мл' },
      { code: 'ESTRADIOL_SENS', label: 'Эстрадиол (чувств. метод)', importance: 'critical', highMeaning: '>120 пмоль/л — точный метод для низких уровней', target: '50-110 пмоль/л' },
      { code: 'PRL', label: 'Пролактин', importance: 'critical', highMeaning: '>15 нг/мл — лактационная гинекомастия', target: '<12 нг/мл' },
      { code: 'PROG', label: 'Прогестерон', importance: 'important', highMeaning: '>1.2 нг/мл — прогестиновая гинекомастия (дека/трен)', target: '<0.8 нг/мл' },
      { code: 'SHBG', label: 'ГСПГ', importance: 'important', lowMeaning: '↓ → ↑ свободный Т → ↑ ароматизация', target: '20-45 нмоль/л' },
      { code: 'DHT', label: 'ДГТ', importance: 'important', lowMeaning: '↓ на финастериде → ↑ E2/T-баланс', target: '200-600 пг/мл' },
      { code: 'ANDROSTENEDIONE', label: 'Андростендион', importance: 'optional', highMeaning: '↑ >6 нмоль/л — дополнительный источник E2', target: '<5 нмоль/л' },
    ],
    clinicalNotes: 'Эстрогенная: E2↑, PRL-N, Prog-N → анастрозол 0.5 мг 2р/нед. Прогестиновая: E2-N, Progesterone↑ (дека/трен) → каберголин 0.25 мг 2р/нед. Смешанная: E2↑ + Prog↑ — оба. Стадии Tanner: I — боль без уплотнения (обратимо); II — уплотнение <2 см (обратимо 80%); III — >2 см + фиброз (частично обратим); IV — сформированная ткань (только хирургия).',
    triggerSymptoms: ['gynecomastia', 'mood_swings', 'edema', 'libido_decrease'],
    recommendedActions: [
      'Анастрозол 0.5 мг 2р/нед при E2>40 пг/мл (титровать по E2-чувств.)',
      'Тамоксифен 10-20 мг/сут при уплотнении >1 см',
      'Каберголин 0.25 мг 2р/нед при PRL>18',
      'УЗИ молочных желёз при уплотнении >2 см',
    ],
  },

  {
    id: 'ed_libido_workup',
    title: 'Нет либидо / эректильная дисфункция (андрогенный сценарий)',
    problem: 'Снижение либидо или ЭД на курсе/после курса. Множественные причины: гормоны, нейростероиды, психогенно.',
    phase: 'any',
    urgency: 'routine',
    markers: [
      { code: 'TT', label: 'Тестостерон общий', importance: 'critical', lowMeaning: '↓ <300 — гипогонадизм; ↑ >1500 — избыток', target: '400-900 нг/дл' },
      { code: 'FT', label: 'Тестостерон свободный', importance: 'critical', lowMeaning: '↓ <7 пг/мл — низкий биодоступный Т', target: '9-25 пг/мл' },
      { code: 'E2', label: 'Эстрадиол', importance: 'critical', highMeaning: '↑ >50 — эстрогенная ЭД; ↓ <10 — сухость/отсутствие', target: '20-35 пг/мл' },
      { code: 'PRL', label: 'Пролактин', importance: 'critical', highMeaning: '>15 — гиперпролактинемическая ЭД', target: '<10 нг/мл' },
      { code: 'DHT', label: 'ДГТ', importance: 'important', lowMeaning: '↓ <150 пг/мл — финастерид/дутастерид', target: '250-600 пг/мл' },
      { code: 'SHBG', label: 'ГСПГ', importance: 'important', highMeaning: '↑ >50 — связывает свободный Т', target: '20-40 нмоль/л' },
      { code: 'CORTISOL', label: 'Кортизол', importance: 'important', highMeaning: '↑ >500 — стресс-индуцированная ЭД', target: '<400 нмоль/л' },
      { code: 'DHEA_S', label: 'ДГЭА-С', importance: 'important', lowMeaning: '↓ <120 мкг/дл — низкие нейростероиды', target: '>180 мкг/дл' },
      { code: 'TSH', label: 'ТТГ', importance: 'important', highMeaning: '>4 — гипотиреоз → депрессия + ЭД', target: '0.5-2.5 мМЕ/л' },
    ],
    clinicalNotes: 'Триада: (1) гормональная — TT↓/E2↑/PRL↑/DHT↓; (2) нейростероидная — DHEA-S↓, прогестерон↑; (3) психогенная — кортизол↑, все гормоны в норме. Пост-финастеридный синдром: DHT↓, TT-N, нейростероиды↓. Лечение: восстановить E2-баланс (20-35 пг/мл), PRL<10, DHT>200.',
    triggerSymptoms: ['libido_decrease', 'mood_swings', 'fatigue', 'insomnia'],
    recommendedActions: [
      'Восстановить E2 20-35 пг/мл (не ниже 15!)',
      'PRL>15 → каберголин 0.25 мг 2р/нед',
      'DHT↓ → отмена финастерида/дутастерида',
      'DHEA-S↓ → DHEA 25-50 мг/сут',
      'Психогенная → фосфатидилсерин 400-600 мг',
    ],
  },

  {
    id: 'polycythemia_workup',
    title: 'Густая кровь / гематокрит >52 (гематологический сценарий)',
    problem: 'Эритроцитоз на ААС: риск тромбоза, вязкость крови, дифференциал первичного vs вторичного.',
    phase: 'on_cycle',
    urgency: 'urgent',
    markers: [
      { code: 'HCT', label: 'Гематокрит', importance: 'critical', highMeaning: '>50 — мониторинг; >52 — терапевтическая флеботомия; >55 — опасность', target: '44-49%' },
      { code: 'HGB', label: 'Гемоглобин', importance: 'critical', highMeaning: '>175 г/л — полицитемия; >185 — флеботомия', target: '140-165 г/л' },
      { code: 'RBC', label: 'Эритроциты', importance: 'important', highMeaning: '>5.8 млн/мкл — эритроцитоз', target: '4.5-5.5 млн/мкл' },
      { code: 'PLT', label: 'Тромбоциты', importance: 'critical', highMeaning: '>450 — тромбоцитоз (риск тромбоза ×2)', target: '180-380×10⁹/л' },
      { code: 'FERRITIN', label: 'Ферритин', importance: 'critical', lowMeaning: '↓ <30 — железодефицит несмотря на ↑Hb', target: '50-200 мкг/л' },
      { code: 'IRON', label: 'Железо сыв.', importance: 'important', lowMeaning: '↓ дефицит железа; парентеральное?', target: '12-25 мкмоль/л' },
      { code: 'TRANSFERRIN', label: 'Трансферрин', importance: 'important', highMeaning: '↑ железодефицит', target: '2.0-3.2 г/л' },
      { code: 'ERYTHROPOIETIN', label: 'Эритропоэтин', importance: 'important', lowMeaning: '↓ <5 мМЕ/мл — вторичный (ААС-индуцированный)', target: '5-15 мМЕ/мл' },
      { code: 'D_DIMER', label: 'D-димер', importance: 'critical', highMeaning: '>0.5 — активный тромбоз?', target: '<0.3 мкг/мл' },
      { code: 'FIBRINOGEN', label: 'Фибриноген', importance: 'important', highMeaning: '>4.5 — гиперкоагуляция', target: '2.0-3.5 г/л' },
    ],
    clinicalNotes: 'Механизм: ААС → ↑ эритропоэтин-чувствительность BFU-E/CFU-E → ↑ эритропоэз → ↑ HCT. Эстрадиол ↑ → ↑ синтез эритропоэтина в почках. HCT>52%: флеботомия 500 мл + регидратация. Аспирин 100 мг/сут при HCT>48% + PLT>400. HCT>55% + PLT>500: госпитализация. Антикоагулянты: серрапептаза 20 мг + наттокиназа 2000 FU.',
    triggerSymptoms: ['flushed_skin', 'headache', 'dizziness', 'hypertension_symptoms', 'dyspnea'],
    recommendedActions: [
      'HCT>52%: флеботомия 500 мл + регидратация 2-3 л/сут',
      'Аспирин 100 мг/сут при HCT>48%',
      'Грейпфрут/нарингин 500 мг/сут (снижает гематокрит)',
      'Серрапептаза 20 мг + наттокиназа 2000 FU',
      'Омега-3 3-4 г/сут (антиагрегант)',
    ],
  },

  {
    id: 'renal_workup',
    title: 'Почки / пенится моча (нефрологический сценарий)',
    problem: 'Признаки почечной дисфункции на курсе: протеинурия, рост креатинина, гипертензивная нефропатия.',
    phase: 'on_cycle',
    urgency: 'urgent',
    markers: [
      { code: 'CREATININE', label: 'Креатинин', importance: 'critical', highMeaning: '↑ >120 мкмоль/л или рост >30% от baseline', target: '<105 мкмоль/л' },
      { code: 'CYSTATIN_C', label: 'Цистатин C', importance: 'critical', highMeaning: '>1.0 мг/л — точнее креатинина при мышечной массе', target: '<0.95 мг/л' },
      { code: 'EGFR', label: 'СКФ (CKD-EPI)', importance: 'critical', lowMeaning: '↓ <60 — ХБП; <90 — снижение', target: '>90 мл/мин' },
      { code: 'UREA', label: 'Мочевина', importance: 'important', highMeaning: '>7.5 ммоль/л — катаболизм + нарушение выведения', target: '<6.5 ммоль/л' },
      { code: 'URIC_ACID', label: 'Мочевая кислота', importance: 'important', highMeaning: '>420 мкмоль/л — подагра, уратная нефропатия', target: '<360 мкмоль/л' },
      { code: 'UACR', label: 'Альбумин/креатинин мочи', importance: 'critical', highMeaning: '>30 мг/г — микроальбуминурия; >300 — протеинурия', target: '<20 мг/г' },
      { code: 'PROTEIN_URINE', label: 'Протеинурия', importance: 'critical', highMeaning: '>150 мг/л — клубочковое повреждение', target: '<100 мг/л' },
      { code: 'NGAL', label: 'NGAL', importance: 'important', highMeaning: '>200 нг/мл — ОПП (опережает креатинин на 24-48ч)', target: '<130 нг/мл' },
      { code: 'KIM1', label: 'KIM-1', importance: 'optional', highMeaning: '>2.5 нг/мл — тубулярное повреждение', target: '<1.8 нг/мл' },
      { code: 'K', label: 'Калий', importance: 'critical', highMeaning: '>5.5 — гиперкалиемия при ХБП', target: '4.0-5.0 ммоль/л' },
      { code: 'SODIUM', label: 'Натрий', importance: 'important', lowMeaning: '↓ гипонатриемия (задержка воды)', target: '138-143 ммоль/л' },
    ],
    clinicalNotes: 'Механизмы: (1) гипертензивная нефропатия — АД↑ → гиперфильтрация → склероз клубочков; (2) прямая тубулотоксичность (трен, болденон); (3) рабдомиолиз (экстремальные тренировки) → КФК↑, миоглобин↑; (4) протеиновая нагрузка (>3 г/кг) → гиперфильтрация. CK>5000 — рабдомиолиз, гидратация + бикарбонат. Нефропротекция: телмисартан + астрагал.',
    triggerSymptoms: ['lower_back_pain', 'edema', 'urine_foam', 'fatigue', 'hypertension_symptoms'],
    recommendedActions: [
      'Телмисартан 40-80 мг (нефропротекция через ↓ внутриклубочкового давления)',
      'Астрагал 500-1000 мг/сут + кордицепс 1-2 г/сут',
      'Питьевой режим >2.5 л/сут (контроль по osmolarity)',
      'Ограничение белка до 2.0-2.2 г/кг при СКФ<60',
      'УЗИ почек + допплер при ↑креатинина >30%',
    ],
  },

  {
    id: 'neurotoxicity_workup',
    title: 'Нервы / тревога / бессонница (нейротоксический сценарий)',
    problem: 'Нейропсихиатрические симптомы на курсе: тревога, бессонница, агрессия, когнитивные нарушения.',
    phase: 'on_cycle',
    urgency: 'routine',
    markers: [
      { code: 'CORTISOL', label: 'Кортизол (утро)', importance: 'critical', highMeaning: '↑ >550 нмоль/л — хронический стресс; ↓ <120 — недостаточность', target: '180-420 нмоль/л' },
      { code: 'DHEA_S', label: 'ДГЭА-С', importance: 'important', lowMeaning: '↓ <120 — истощение надпочечников', target: '>180 мкг/дл' },
      { code: 'TSH', label: 'ТТГ', importance: 'important', highMeaning: '>3.5 — гипотиреоз → депрессия; ↓ <0.3 — гипертиреоз → тревога', target: '0.5-2.5 мМЕ/л' },
      { code: 'FT3', label: 'Т3 свободный', importance: 'important', lowMeaning: '↓ низкий Т3-синдром (↓ конверсии Т4→Т3)', target: '3.8-5.5 пмоль/л' },
      { code: 'GLU', label: 'Глюкоза', importance: 'important', lowMeaning: '↓ <3.5 ммоль/л — гипогликемия → тревога/потливость', target: '4.2-5.5 ммоль/л' },
      { code: 'INS', label: 'Инсулин', importance: 'optional', highMeaning: '>17 мМЕ/л — инсулинорезистентность → энергодефицит мозга', target: '5-12 мМЕ/л' },
      { code: 'B12', label: 'Витамин B12', importance: 'important', lowMeaning: '↓ <300 пг/мл — нейропатия, депрессия', target: '>400 пг/мл' },
      { code: 'FOL', label: 'Фолат (B9)', importance: 'important', lowMeaning: '↓ <5 нг/мл — нарушение синтеза нейротрансмиттеров', target: '>8 нг/мл' },
      { code: 'MAGNESIUM', label: 'Магний', importance: 'important', lowMeaning: '↓ <0.75 — NMDA-гиперактивация → тревога', target: '0.85-1.0 ммоль/л' },
      { code: 'HOMOCYSTEINE', label: 'Гомоцистеин', importance: 'optional', highMeaning: '>15 — нейротоксичность, повреждение ГЭБ', target: '<10 мкмоль/л' },
    ],
    clinicalNotes: 'Нейротоксичность ААС: (1) тренболон — прямой нейротоксический (β-амилоид↑, BDNF↓); (2) 17α-алкилированные — ГАМК-ергическая дисфункция; (3) нандролон — снижение нейростероидов (аллопрегнанолон↓). Нейропротекция: NAC 1200-2400 мг, Mg треонат 144 мг, B12 1000 мкг, фосфатидилсерин 400 мг.',
    triggerSymptoms: ['anxiety', 'insomnia', 'mood_swings', 'headache', 'fatigue'],
    recommendedActions: [
      'Mg L-треонат 144 мг/сут + L-теанин 200-400 мг',
      'NAC 1200 мг/сут (глутамат-глутаминовый цикл)',
      'Фосфатидилсерин 400-600 мг при кортизоле >500',
      'B12 1000 мкг + фолат 400 мкг (метилирование)',
      'Ашваганда 600 мг KSM-66 (кортизол ↓)',
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  БЛОК В: ПКТ / ПОСЛЕ КУРСА
  // ════════════════════════════════════════════════════════════════

  {
    id: 'hpta_recovery_fail',
    title: 'Не восстанавливается ось ГГЯ после 4 нед ПКТ',
    problem: 'ЛГ/ФСГ остаются подавлены, тестостерон <300 нг/дл после стандартного протокола ПКТ.',
    phase: 'pct',
    urgency: 'urgent',
    markers: [
      { code: 'LH', label: 'ЛГ', importance: 'critical', lowMeaning: '<2 мМЕ/мл — гипофиз не отвечает', target: '>4 мМЕ/мл' },
      { code: 'FSH', label: 'ФСГ', importance: 'critical', lowMeaning: '<2 мМЕ/мл — сперматогенез подавлен', target: '>4 мМЕ/мл' },
      { code: 'TT', label: 'Тестостерон общий', importance: 'critical', lowMeaning: '<300 нг/дл — гипогонадизм; <150 — тяжёлый', target: '>400 нг/дл' },
      { code: 'FT', label: 'Тестостерон свободный', importance: 'critical', lowMeaning: '<7 пг/мл', target: '>9 пг/мл' },
      { code: 'E2', label: 'Эстрадиол', importance: 'critical', highMeaning: '↑ парадоксальный рост на СЕРМ; ↓ <10 — супрессия', target: '15-30 пг/мл' },
      { code: 'PRL', label: 'Пролактин', importance: 'critical', highMeaning: '>15 — тормозит ГнРГ', target: '<10 нг/мл' },
      { code: 'SHBG', label: 'ГСПГ', importance: 'important', highMeaning: '↑ на СЕРМ — связывает Т', target: '25-45 нмоль/л' },
      { code: 'INHB', label: 'Ингибин Б', importance: 'critical', lowMeaning: '<80 — сперматогенез не запустился', target: '>100 пг/мл' },
      { code: 'CORTISOL', label: 'Кортизол', importance: 'important', highMeaning: '>500 — надпочечники компенсируют', target: '<400 нмоль/л' },
      { code: 'DHEA_S', label: 'ДГЭА-С', importance: 'important', lowMeaning: '<120 — истощение надпочечников', target: '>180 мкг/дл' },
      { code: 'TSH', label: 'ТТГ', importance: 'important', highMeaning: '>3 — гипотиреоз на ПКТ', target: '0.5-2.0 мМЕ/л' },
    ],
    clinicalNotes: 'При ЛГ/ФСГ>4 + TT<300: первичный гипогонадизм (тестикулярный) — резистентность к гонадотропинам. При ЛГ/ФСГ<2 + TT<300: вторичный (гипогонадотропный) — продлить ПКТ или заменить протокол. При PRL>25: пролактинома (МРТ). Варианты: кломифен 50 мг → тамоксифен 20 мг → ХГЧ 2000 МЕ 3р/нед + тамоксифен. После 8 нед без ответа — TRT.',
    triggerSymptoms: ['libido_decrease', 'fatigue', 'mood_swings', 'weakness'],
    recommendedActions: [
      'При ЛГ/ФСГ<2 после кломифена 50 мг: заменить на тамоксифен 20 мг 4 нед',
      'При PRL>15: каберголин 0.25 мг 2р/нед',
      'При TT<200 через 8 нед: ХГЧ 1500-2000 МЕ 3р/нед + тамоксифен',
      'После 12 нед без восстановления: консультация эндокринолога + TRT',
      'МРТ гипофиза при PRL>25 или ЛГ/FSH около нуля',
    ],
  },

  {
    id: 'fertility_extended',
    title: 'Не могу зачать / спермограмма 0 (фертильность — расширенный)',
    problem: 'Азооспермия или тяжёлая олигоспермия после курса ААС. Полный поиск причин и протокол восстановления.',
    phase: 'fertility',
    urgency: 'urgent',
    markers: [
      { code: 'LH', label: 'ЛГ', importance: 'critical', lowMeaning: '<2 — гипогонадотропный (нужен ХГЧ)', target: '>4 мМЕ/мл' },
      { code: 'FSH', label: 'ФСГ', importance: 'critical', lowMeaning: '<2 — нужен ХГЧ + ХМГ/рФСГ; >15 — первичная тестикулярная недостаточность', target: '4-12 мМЕ/мл' },
      { code: 'TT', label: 'Тестостерон', importance: 'critical', lowMeaning: '<300 — интратестикулярный Т ↓', target: '>400 нг/дл' },
      { code: 'FT', label: 'Тестостерон свободный', importance: 'important', lowMeaning: '<7 пг/мл', target: '>9 пг/мл' },
      { code: 'E2', label: 'Эстрадиол', importance: 'critical', highMeaning: '↑ ингибирует сперматогенез; ↓ <10 — сухость', target: '15-30 пг/мл' },
      { code: 'PRL', label: 'Пролактин', importance: 'critical', highMeaning: '>12 — гиперпролактинемия → ↓ ФСГ', target: '<10 нг/мл' },
      { code: 'INHB', label: 'Ингибин Б', importance: 'critical', lowMeaning: '<80 — клетки Сертоли не работают; <30 — тяжёлое', target: '>120 пг/мл' },
      { code: 'AMH', label: 'АМГ', importance: 'important', lowMeaning: '<2.0 — снижение резерва Сертоли', target: '>3.0 нг/мл' },
      { code: 'SHBG', label: 'ГСПГ', importance: 'important', highMeaning: '>50 — связывает Т, снижает внутритестикулярный', target: '20-40 нмоль/л' },
      { code: 'VITD', label: 'Витамин D', importance: 'important', lowMeaning: '<30 — рецепторы VDR на сперматозоидах', target: '>40 нг/мл' },
      { code: 'PSA', label: 'ПСА', importance: 'optional', highMeaning: '>4 нг/мл — исключить патологию простаты', target: '<2.5 нг/мл' },
    ],
    clinicalNotes: 'Протокол восстановления: (1) ХГЧ 1500-2000 МЕ 3р/нед 8-12 нед → восстановление интратестикулярного Т; (2) при отсутствии сперматозоидов через 12 нед — добавить ХМГ 75 МЕ 3р/нед или рФСГ 150 МЕ 3р/нед; (3) при PRL↑ — каберголин. Обследование: кариотип + микроделеции Y-хромосомы (AZFa/b/c) при персистирующей азооспермии. DFI >25% — оксидативный стресс (антиоксиданты 3 мес). Антиспермальные антитела — MAR-тест.',
    triggerSymptoms: ['libido_decrease', 'fatigue', 'mood_swings'],
    recommendedActions: [
      'ХГЧ 1500-2000 МЕ 3р/нед + анастрозол 0.5 мг 2р/нед (контроль E2)',
      'Через 8 нед: спермограмма. Нет спермы → +ХМГ 75 МЕ 3р/нед',
      'Кариотип + микроделеции Y (AZFa/b/c) при азооспермии >12 нед терапии',
      'DFI (>25%): NAC 1200 мг + CoQ10 300 мг + Zn 50 мг + Se 200 мкг 3 мес',
      'MAR-тест (антиспермальные антитела) при нормоспермии + бесплодии',
    ],
  },

  {
    id: 'joint_pain_workup',
    title: 'Суставы болят после курса (опорно-двигательный сценарий)',
    problem: 'Артралгии/миалгии после курса ААС. Дифференциал: низкий E2, подагра, аутоиммунный артрит, остеопороз.',
    phase: 'any',
    urgency: 'routine',
    markers: [
      { code: 'E2', label: 'Эстрадиол', importance: 'critical', lowMeaning: '<12 пг/мл — дефицит эстрогенов (классика на ИА)', target: '20-35 пг/мл' },
      { code: 'URIC_ACID', label: 'Мочевая кислота', importance: 'critical', highMeaning: '>420 мкмоль/л — подагра (диуретики, высокобелковая)', target: '<360 мкмоль/л' },
      { code: 'CRP', label: 'СРБ', importance: 'important', highMeaning: '>5 мг/л — воспаление; >20 — системное', target: '<3 мг/л' },
      { code: 'ESR', label: 'СОЭ', importance: 'important', highMeaning: '>20 мм/ч — воспаление', target: '<15 мм/ч' },
      { code: 'CA', label: 'Кальций', importance: 'important', lowMeaning: '↓ остеопороз', target: '2.25-2.5 ммоль/л' },
      { code: 'P', label: 'Фосфор', importance: 'important', highMeaning: '↑ почечная недостаточность', target: '0.9-1.35 ммоль/л' },
      { code: 'VITD', label: 'Витамин D', importance: 'critical', lowMeaning: '<30 — остеомаляция/остеопороз', target: '>45 нг/мл' },
      { code: 'PARATHYROID', label: 'Паратгормон', importance: 'important', highMeaning: '>65 пг/мл — вторичный гиперпаратиреоз', target: '20-45 пг/мл' },
      { code: 'OSTEOCALCIN', label: 'Остеокальцин', importance: 'optional', lowMeaning: '<10 — сниженное костеобразование', target: '12-25 нг/мл' },
      { code: 'CORTISOL', label: 'Кортизол', importance: 'important', highMeaning: '>500 — катаболизм коллагена', target: '<400 нмоль/л' },
    ],
    clinicalNotes: 'Три основных механизма: (1) гормональный — E2↓ + кортизол↑ → лизис коллагена суставов (ингибиторы ароматазы); (2) метаболический — ураты↑ (диуретики, белковая диета, дегидратация); (3) аутоиммунный — ААС как триггер (HLA-B27?). План: E2↑ (20-35 пг/мл), ураты↓, D3↑, кортизол↓.',
    triggerSymptoms: ['joint_pain', 'muscle_cramps', 'fatigue', 'weakness'],
    recommendedActions: [
      'Снизить дозу ИА при E2<15 пг/мл (боль в суставах = низкий E2)',
      'Мочевая кислота >420: аллопуринол 100-300 мг/сут',
      'D3 5000-10000 МЕ/сут + K2 (MK-7) 100 мкг + Mg 300 мг',
      'Глюкозамин 1500 мг + хондроитин 1200 мг + коллаген II типа',
      'Кортизол >500: ашваганда 600 мг + фосфатидилсерин 400 мг',
    ],
  },
];

/**
 * Поиск панели по id
 */
export function getProblemPanel(id: string): ProblemPanel | undefined {
  return PROBLEM_PANELS.find(p => p.id === id);
}

/**
 * Поиск панелей по симптому
 */
export function getProblemPanelsForSymptom(symptomId: string): ProblemPanel[] {
  return PROBLEM_PANELS.filter(p => p.triggerSymptoms.includes(symptomId));
}

/**
 * Поиск панелей по фазе
 */
export function getProblemPanelsForPhase(phase: string): ProblemPanel[] {
  if (phase === 'any') return PROBLEM_PANELS;
  return PROBLEM_PANELS.filter(p => p.phase === phase || p.phase === 'any');
}

/**
 * Все проблемные панели
 */
export function getAllProblemPanels(): ProblemPanel[] {
  return PROBLEM_PANELS;
}

/**
 * Маркеры панели в CSV-формате для копирования (направление)
 */
export function formatPanelAsReferral(panel: ProblemPanel): string {
  const phaseLabel: Record<string, string> = {
    baseline: 'ДО КУРСА', on_cycle: 'НА КУРСЕ', pct: 'ПКТ',
    fertility: 'ФЕРТИЛЬНОСТЬ', any: 'ЛЮБАЯ ФАЗА',
  };
  const lines: string[] = [
    `╔══════════════════════════════════════════════╗`,
    `║  НАПРАВЛЕНИЕ: ${panel.title}`,
    `║  Фаза: ${phaseLabel[panel.phase] || panel.phase}`,
    `║  Проблема: ${panel.problem}`,
    `╠══════════════════════════════════════════════╣`,
    `║  Лабораторные маркеры:`,
  ];
  for (const m of panel.markers) {
    const imp = { critical: '❗ОБЯЗАТЕЛЬНО', important: '▪️Важно', optional: '▫️Опционально' }[m.importance];
    lines.push(`║  ${imp}: ${m.label}${m.target ? ` (цель: ${m.target})` : ''}`);
  }
  lines.push(`╠══════════════════════════════════════════════╣`);
  lines.push(`║  Клинический комментарий:`);
  lines.push(`║  ${panel.clinicalNotes}`);
  lines.push(`╠══════════════════════════════════════════════╣`);
  lines.push(`║  Рекомендуемые действия:`);
  for (const action of panel.recommendedActions) {
    lines.push(`║  • ${action}`);
  }
  lines.push(`╚══════════════════════════════════════════════╝`);
  return lines.join('\n');
}
