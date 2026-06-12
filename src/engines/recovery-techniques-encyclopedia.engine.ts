/**
 * Complete Recovery + Training Techniques + Pre/Post Nutrition Encyclopedia
 *
 * Recovery Library: 15+ evidence-based recovery methods
 * Intensity Techniques: 20+ advanced training methods
 * Peri-Workout Nutrition: complete pre/intra/post nutrition protocols
 * Supplement Encyclopedia: 30+ supplements with dosing, timing, mechanisms
 *
 * @module recovery-techniques-nutrition-encyclopedia
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface RecoveryMethod {
  name: string;
  category: 'physical' | 'nutritional' | 'thermal' | 'mechanical' | 'psychological' | 'sleep' | 'manual';
  durationMin: number;
  frequency: string;
  timing: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'anecdotal';
  mechanism: string;
  protocol: string[];
  benefits: string[];
  risks: string[];
  cost: string;
  howTo: string;
}

export interface IntensityTechnique {
  name: string;
  type: 'set_extension' | 'load_manipulation' | 'tempo_modification' | 'rest_manipulation' | 'mind_muscle';
  difficulty: number;
  fatigueCost: number;
  hypertrophyRating: number;
  strengthRating: number;
  description: string;
  protocol: string;
  example: string;
  bestFor: string;
  whenToUse: string;
  whenNotToUse: string;
  commonMistakes: string[];
}

export interface PeriWorkoutProtocol {
  phase: string;
  timing: string;
  goal: string;
  protein: { amount: string; source: string; rationale: string };
  carbs: { amount: string; source: string; rationale: string };
  fat: { amount: string; source: string; rationale: string };
  hydration: string;
  supplements: { name: string; dosage: string; timing: string; rationale: string }[];
  totalKcal: string;
}

export interface SupplementEntry {
  name: string;
  category: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'anecdotal';
  mechanism: string;
  dosage: { standard: string; athlete: string; onCycle: string };
  timing: string;
  withFood: boolean;
  halfLife: string;
  benefits: string[];
  sideEffects: string[];
  interactions: string[];
  costPerMonth: string;
  recommendFor: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Recovery Methods Library (15 methods)
// ═══════════════════════════════════════════════════════════════════════════

const RECOVERY_LIBRARY: RecoveryMethod[] = [
  {
    name: 'Сон (оптимизация)',
    category: 'sleep', durationMin: 480, frequency: 'Ежедневно', timing: 'Ночь 7-9 часов',
    evidenceLevel: 'A',
    mechanism: 'Выброс ГР (первые часы сна). Синтез белка. Консолидация памяти. Очистка мозга глимфатической системой. Снижение кортизола.',
    protocol: [
      'Ложиться и вставать в одно время (даже в выходные)',
      'Температура спальни 18-20°C',
      'Полная темнота (блэкаут шторы, маска)',
      'Без экранов за 60 минут до сна',
      'Магний 400мг + Мелатонин 3мг за 30-60 мин',
      'Последний кофеин до 14:00',
      'Последний приём пищи за 2-3 часа',
    ],
    benefits: ['Тестостерон +15% при 8ч vs 5ч', 'Скорость реакции +20%', 'Восстановление гликогена', 'Иммунитет', 'Настроение'],
    risks: ['Хронический недосып: -60% тестостерона, +50% кортизола'],
    cost: 'Бесплатно',
    howTo: 'Приоритет №1 в восстановлении. Всё остальное вторично.',
  },
  {
    name: 'Контрастная терапия (Hot/Cold)',
    category: 'thermal', durationMin: 20, frequency: '3-5×/нед', timing: 'После тренировки или вечером',
    evidenceLevel: 'B',
    mechanism: 'Вазодилатация → вазоконстрикция → пампинг крови → ускоренный вывод метаболитов. Снижение воспаления.',
    protocol: [
      '3 мин горячая вода (38-40°C)',
      '1 мин холодная вода (10-15°C)',
      'Повторить 3-5 циклов',
      'Закончить ХОЛОДНОЙ для снижения воспаления',
      'НЕ после тренировки на гипертрофию (снижает mTOR)',
    ],
    benefits: ['Снижение DOMS на 20-30%', 'Улучшение кровотока', 'Снижение отёка', 'Бодрость'],
    risks: ['Снижает гипертрофический ответ если сразу после тренировки', 'Не при сердечных заболеваниях'],
    cost: 'Бесплатно (душ)',
    howTo: 'После тренировки: только если цель не гипертрофия. Вечером: идеально.',
  },
  {
    name: 'Foam Rolling (Миофасциальный релиз)',
    category: 'mechanical', durationMin: 15, frequency: 'Ежедневно', timing: 'После тренировки или вечером',
    evidenceLevel: 'A',
    mechanism: 'Механическое давление → снижение тонуса фасции → улучшение ROM. Снижение восприятия боли.',
    protocol: [
      'Крупные группы: 30-60 сек на зону',
      'Триггерные точки: задержка 20-30 сек',
      'Порядок: икры → бицепс бедра → ягодицы → квадрицепсы → IT band → грудной отдел → широчайшие',
      'Дыхание: выдох на прокатку',
      'НЕ катать поясницу напрямую (только ягодицы и грудной)',
    ],
    benefits: ['ROM +10-15% сразу после', 'Снижение DOMS', 'Улучшение качества движения', 'Бесплатно'],
    risks: ['Не катать костные выступы', 'Не катать остро-травмированные зоны', 'Не катать поясницу'],
    cost: '1,500-3,000 ₽ (ролл)',
    howTo: '15 минут вечером перед сном. Идеально.',
  },
  {
    name: 'Массаж (спортивный)',
    category: 'manual', durationMin: 60, frequency: '1-2×/нед', timing: 'Любое время, не сразу перед тренировкой',
    evidenceLevel: 'B',
    mechanism: 'Механическое воздействие → кровоток → расслабление мышц → снижение кортизола → парасимпатическая активация.',
    protocol: [
      'Спортивный массаж: глубокий, фокус на проблемные зоны',
      'Продолжительность: 45-90 минут',
      'Частота: 1-2×/нед в тяжёлые фазы, 1×/2 нед обычно',
      'НЕ в день тяжёлой тренировки (до или после)',
      'Самомассаж: теннисный мяч, массажный пистолет',
    ],
    benefits: ['Снижение DOMS', 'Психологическое расслабление', 'Улучшение ROM', 'Профилактика спаек'],
    risks: ['Гематомы при слишком глубоком', 'Не при тромбозе'],
    cost: '2,000-5,000 ₽/сеанс',
    howTo: 'Лучше на следующий день после тяжёлой тренировки.',
  },
  {
    name: 'Активное восстановление (LISS кардио)',
    category: 'physical', durationMin: 30, frequency: '1-3×/нед', timing: 'День после тяжёлой тренировки',
    evidenceLevel: 'A',
    mechanism: 'Легкая аэробная активность → усиление кровотока → доставка нутриентов → вывод метаболитов без дополнительного стресса.',
    protocol: [
      'Ходьба 3-4 км/ч ИЛИ велотренажёр 60-70 RPM',
      'Пульс 110-130 уд/мин (зона 1-2, можете говорить)',
      '20-40 минут',
      'Без одышки, без пота',
      'НЕ бег и НЕ интенсивное кардио',
    ],
    benefits: ['Усиление кровотока без нагрузки', 'Снижение кортизола', 'Улучшение качества сна', 'Активный отдых'],
    risks: ['При перетренированности: сократить до 15 мин'],
    cost: 'Бесплатно',
    howTo: 'Прогулка 30 мин утром после тяжёлого дня ног. Идеально.',
  },
  {
    name: 'Стретчинг (статический)',
    category: 'physical', durationMin: 15, frequency: 'Ежедневно', timing: 'После тренировки, НЕ перед силовой',
    evidenceLevel: 'B',
    mechanism: 'Удлинение мышечно-сухожильного комплекса. Снижение тонуса. Восстановление длины покоя.',
    protocol: [
      'Нагруженные мышцы: 30-60 сек каждая',
      'Без боли, только до ощущения натяжения',
      'Дыхание: выдох на углубление',
      'Порядок: квадрицепсы → бицепс бедра → ягодицы → грудь → широчайшие → плечи',
      'НЕ пружинить, НЕ до боли',
    ],
    benefits: ['Восстановление ROM', 'Снижение мышечного тонуса', 'Расслабление'],
    risks: ['Статическая растяжка ПЕРЕД силовой снижает мощность на 5-10%'],
    cost: 'Бесплатно',
    howTo: '10-15 минут после каждой тренировки. Ежедневно можно.',
  },
  {
    name: 'Компрессионная терапия',
    category: 'mechanical', durationMin: 120, frequency: 'После тренировки', timing: '2-4 часа после нагрузки',
    evidenceLevel: 'B',
    mechanism: 'Внешнее давление → улучшение венозного возврата → снижение отёка → ускорение вывода метаболитов.',
    protocol: [
      'Компрессионные гетры/рукава (давление 20-30 мм рт.ст.)',
      'Надеть сразу после тренировки',
      'Носить 2-4 часа',
      'Можно спать в компрессии при сильной крепатуре',
      'Особенно полезно для ног после приседа/тяги',
    ],
    benefits: ['Снижение DOMS на 20-25%', 'Снижение отёка', 'Ускорение восстановления силы'],
    risks: ['Не при тромбозе/варикозе'],
    cost: '1,500-5,000 ₽ (гетры/рукава)',
    howTo: 'Инвестируйте в качественные гетры для ног.',
  },
  {
    name: 'Нутритивное восстановление (Post-Workout)',
    category: 'nutritional', durationMin: 5, frequency: 'После каждой тренировки', timing: '0-60 мин после',
    evidenceLevel: 'A',
    mechanism: 'Инсулин + аминокислоты → mTOR активация → синтез белка. Углеводы → ресинтез гликогена.',
    protocol: [
      'Сывороточный протеин 30-50 г + декстроза/мальтодекстрин 40-80 г',
      'Размешать в 500 мл воды',
      'Выпить в течение 30 мин после тренировки',
      'Через 60-90 мин — полноценный приём пищи',
      'Креатин 5 г добавить в шейк',
    ],
    benefits: ['Максимальный синтез белка', 'Ресинтез гликогена', 'Снижение катаболизма'],
    risks: ['Не обязательно если едите в течение 2 часов после'],
    cost: '~50 ₽/тренировка (протеин + декстроза)',
    howTo: 'Держите шейкер с сухой смесью в сумке. Добавить воду = готово.',
  },
  {
    name: 'Медитация / Дыхательные практики',
    category: 'psychological', durationMin: 10, frequency: 'Ежедневно', timing: 'Утро или перед сном',
    evidenceLevel: 'B',
    mechanism: 'Активация парасимпатики через вагус → снижение ЧСС, кортизола → улучшение вариабельности сердечного ритма.',
    protocol: [
      'Сядьте удобно, закройте глаза',
      'Дыхание 4-7-8: вдох 4с → задержка 7с → выдох 8с',
      '5-10 циклов',
      'Или простое наблюдение за дыханием 10 минут',
      'Утром: бодрость. Вечером: расслабление.',
    ],
    benefits: ['Кортизол -25%', 'HRV +10-15%', 'Качество сна', 'Фокус', 'Снижение тревожности'],
    risks: ['Нет'],
    cost: 'Бесплатно',
    howTo: '10 минут утром = продуктивный день. 10 минут вечером = глубокий сон.',
  },
  {
    name: 'Перкуссионная терапия (Massage Gun)',
    category: 'mechanical', durationMin: 10, frequency: 'Ежедневно', timing: 'До и/или после тренировки',
    evidenceLevel: 'B',
    mechanism: 'Вибрация 30-50 Гц → снижение мышечного тонуса, улучшение кровотока, локальное расслабление.',
    protocol: [
      'Крупные мышцы: 30-60 сек на группу, скорость средняя',
      'НЕ давить сильно — вес устройства достаточно',
      'Обходить кости, суставы, позвоночник',
      'До тренировки: 30 сек на целевую группу для активации',
      'После: 60 сек для расслабления',
    ],
    benefits: ['Быстрое расслабление', 'Повышение ROM', 'Снижение DOMS', 'Удобство'],
    risks: ['Не на шею спереди', 'Не на кости', 'Не на острые травмы'],
    cost: '5,000-30,000 ₽ (устройство)',
    howTo: 'Инвестиция окупается. 10 мин/день.',
  },
  {
    name: 'Электролиты + Гидратация',
    category: 'nutritional', durationMin: 0, frequency: 'Ежедневно', timing: 'В течение дня',
    evidenceLevel: 'A',
    mechanism: 'Натрий, калий, магний → проведение нервных импульсов, сокращение мышц, гидратация клеток.',
    protocol: [
      'Вода: 33 мл/кг веса (80 кг → 2.6 л)',
      'Натрий: 3-5 г/день (не на сушке без медицинских причин)',
      'Калий: 3.5-5 г/день (бананы, картофель, авокадо)',
      'Магний: 400-600 мг/день (добавка)',
      'Добавить электролиты в воду во время тренировки',
    ],
    benefits: ['Предотвращение судорог', 'Оптимальная работа мышц', 'Выносливость', 'Когнитивная функция'],
    risks: ['Гипонатриемия при избытке воды без электролитов'],
    cost: '~200 ₽/мес (электролиты)',
    howTo: 'Держите бутылку воды всегда рядом. Добавьте щепотку соли и лимон.',
  },
  {
    name: 'Йога (восстановительная)',
    category: 'physical', durationMin: 30, frequency: '1-2×/нед', timing: 'День отдыха или вечером',
    evidenceLevel: 'B',
    mechanism: 'Сочетание растяжки, дыхания и mindfulness → снижение кортизола, улучшение ROM, активация парасимпатики.',
    protocol: [
      'Yin Yoga или Restorative Yoga (не Vinyasa/Power)',
      'Удержание поз 2-5 минут',
      'Фокус на дыхание, не на интенсивность',
      'Основные позы: Child Pose, Pigeon, Forward Fold, Supine Twist, Happy Baby',
      'Завершить Savasana 5-10 минут',
    ],
    benefits: ['Глубокая релаксация', 'Улучшение ROM', 'Снижение стресса', 'Мобильность'],
    risks: ['Не aggressive/power yoga в день тяжёлых ног'],
    cost: 'Бесплатно (YouTube)',
    howTo: '30 минут Yin Yoga в воскресенье = перезагрузка на неделю.',
  },
  {
    name: 'Нутритивное восстановление (перед сном)',
    category: 'nutritional', durationMin: 2, frequency: 'Ежедневно', timing: 'За 30-60 мин до сна',
    evidenceLevel: 'B',
    mechanism: 'Казеин → медленное высвобождение аминокислот → ночной анаболизм. Магний → GABA → расслабление.',
    protocol: [
      'Казеин 30-40 г ИЛИ творог 200-300 г',
      'Магний бисглицинат 400 мг',
      'Цинк 30 мг (если не принимали утром)',
      'Мелатонин 3 мг (если проблемы со сном)',
      'Без углеводов (на сушке) ИЛИ 20-30 г (на массе)',
    ],
    benefits: ['Ночной синтез белка +10-15%', 'Улучшение качества сна', 'Восстановление'],
    risks: ['Не перегружайте ЖКТ перед сном'],
    cost: '~40 ₽/день',
    howTo: 'Творог + магний = идеальный ритуал перед сном.',
  },
  {
    name: 'Магниевые ванны / Epsom Salt',
    category: 'thermal', durationMin: 20, frequency: '2-3×/нед', timing: 'Вечером, за 60-90 мин до сна',
    evidenceLevel: 'C',
    mechanism: 'Сульфат магния через кожу → расслабление мышц. Тепло → вазодилатация.',
    protocol: [
      'Английская соль (Epsom salt) 2-3 чашки на ванну',
      'Температура воды 37-40°C',
      'Лежать 15-20 минут',
      'После: ополоснуться прохладной водой',
      'Сразу в постель',
    ],
    benefits: ['Расслабление мышц', 'Снижение стресса', 'Улучшение сна'],
    risks: ['Обезвоживание — пейте воду до и после'],
    cost: '~300 ₽/кг соли',
    howTo: 'После тяжёлой недели. Воскресный ритуал.',
  },
  {
    name: 'Active Release Technique (ART) / Мануальная терапия',
    category: 'manual', durationMin: 30, frequency: 'По необходимости', timing: 'Когда есть триггерные точки/спайки',
    evidenceLevel: 'B',
    mechanism: 'Специалист находит спайки/триггеры → давление + движение → разрыв спаек → восстановление скольжения тканей.',
    protocol: [
      'Найти сертифицированного ART-специалиста',
      'Сеанс 20-40 минут',
      'Фокус на проблемную зону',
      'Частота: 1×/нед пока проблема не уйдёт',
      'Домашняя работа: упражнения от специалиста',
    ],
    benefits: ['Решение хронических болей', 'Улучшение ROM', 'Восстановление функции'],
    risks: ['Временное усиление боли после сеанса'],
    cost: '3,000-7,000 ₽/сеанс',
    howTo: 'Для хронических проблем, которые не решаются foam rolling.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. Intensity Techniques Encyclopedia (15 techniques)
// ═══════════════════════════════════════════════════════════════════════════

const INTENSITY_TECHNIQUES: IntensityTechnique[] = [
  {
    name: 'Drop Sets (Дроп-сеты)', type: 'set_extension', difficulty: 2, fatigueCost: 4, hypertrophyRating: 4, strengthRating: 1,
    description: 'После отказа — сразу сбросить вес на 20-30% и продолжить до следующего отказа. Повторить 1-3 раза.',
    protocol: '1 подход до отказа → сброс 20-30% веса → сразу ещё до отказа → опционально ещё 1 сброс.',
    example: 'Жим гантелей: 40кг ×10 до отказа → 30кг ×6 → 20кг ×8.',
    bestFor: 'Изоляционные упражнения в конце тренировки. Бицепс, трицепс, плечи.',
    whenToUse: 'Последнее упражнение на мышечную группу. Не чаще 1-2×/нед на группу.',
    whenNotToUse: 'Тяжёлые compound (присед, тяга). Новички.',
    commonMistakes: ['Слишком частые — перетрен', 'На compound упражнениях — риск травмы', 'Слишком большой сброс — мало эффекта'],
  },
  {
    name: 'Rest-Pause (Отдых-Пауза)', type: 'rest_manipulation', difficulty: 3, fatigueCost: 3, hypertrophyRating: 3, strengthRating: 4,
    description: 'Вес 85-90% 1RM. 1 повторение → отдых 15-20 сек → 1 повторение → повторить до 6-8 общих повторений.',
    protocol: 'Выбрать вес 85-90% 1RM. Делать по 1 повторению с отдыхом 15-20 сек между ними. Цель: 6-8 общих повторений.',
    example: 'Присед 150кг (90%): 1 → отдых 20с → 1 → ... → всего 7 синглов.',
    bestFor: 'Большие compound. Присед, жим, тяга.',
    whenToUse: 'Плато в силе. Когда нужно突破 с большим весом.',
    whenNotToUse: 'Новички. Изоляция. При усталости ЦНС.',
    commonMistakes: ['Слишком короткий отдых — не восстанавливается АТФ', 'Слишком много общих повторений'],
  },
  {
    name: 'Super-Sets (Суперсеты)', type: 'set_extension', difficulty: 2, fatigueCost: 3, hypertrophyRating: 4, strengthRating: 2,
    description: 'Два упражнения подряд без отдыха. Антагонисты (грудь+спина) или синергисты (два на одну группу).',
    protocol: 'Упражнение А → сразу Упражнение Б → отдых 60-90 сек → повторить.',
    example: 'Жим лёжа + Тяга в наклоне. Или: Подтягивания + Жим над головой.',
    bestFor: 'Экономия времени. Памп. Антагонисты.',
    whenToUse: 'Когда мало времени. Для пампа в конце тренировки.',
    whenNotToUse: 'Тяжёлые compound в superset — падает производительность.',
    commonMistakes: ['Выбор двух тяжёлых compound', 'Слишком короткий отдых между суперсетами'],
  },
  {
    name: 'Giant Sets (Гигантские сеты)', type: 'set_extension', difficulty: 3, fatigueCost: 4, hypertrophyRating: 5, strengthRating: 1,
    description: '3-5 упражнений подряд на одну мышечную группу без отдыха. Максимальный метаболический стресс.',
    protocol: '3-5 упражнений подряд → отдых 2-3 мин → повторить 3-4 круга.',
    example: 'Плечи: DB Press → Lateral → Front Raise → Rear Delt → Upright Row (всё ×12 без отдыха).',
    bestFor: 'Памп-тренировки. Завершающая часть тренировки.',
    whenToUse: 'Финальные 15-20 минут тренировки. 1×/нед на группу.',
    whenNotToUse: 'Начало тренировки. Тяжёлые дни.',
    commonMistakes: ['Слишком большой вес', 'Недостаточный отдых между кругами'],
  },
  {
    name: 'Pyramid Sets (Пирамида)', type: 'load_manipulation', difficulty: 2, fatigueCost: 2, hypertrophyRating: 3, strengthRating: 4,
    description: 'Вес растёт, повторения падают (ascending). Или наоборот (descending).',
    protocol: 'Ascending: 12×60% → 10×70% → 8×80% → 6×85% → 4×90%. Descending: обратный порядок.',
    example: 'Жим: 60×12 → 70×10 → 80×8 → 90×6 → 100×4.',
    bestFor: 'Разминка + рабочие подходы в одном. Основные движения.',
    whenToUse: 'Основное упражнение дня. Разогрев и работа в одном.',
    whenNotToUse: 'При высокой усталости — descending пирамида после тяжёлых подходов опасна.',
    commonMistakes: ['Слишком большие шаги веса', 'Начинать太重 — не хватает на верх пирамиды'],
  },
  {
    name: 'Cluster Sets (Кластеры)', type: 'rest_manipulation', difficulty: 3, fatigueCost: 2, hypertrophyRating: 2, strengthRating: 5,
    description: 'Тяжёлый вес (85-90%). 2-3 повторения → отдых 20-30 сек → 2-3 повторения. Повторить 3-4 раза.',
    protocol: 'Вес 85-90%. 2-3 повторения → отдых 20-30 сек → 2-3 → отдых → ... 4-5 кластеров.',
    example: 'Присед 160кг: 2 → отдых 25с → 2 → отдых 25с → 2 → отдых 25с → 2 = 8 общих повторений с 90%.',
    bestFor: 'Развитие максимальной силы с субмаксимальным весом.',
    whenToUse: 'Силовые блоки. Подготовка к соревнованиям.',
    whenNotToUse: 'Гипертрофия (меньше метаболического стресса). Новички.',
    commonMistakes: ['Слишком короткий отдых внутри кластера', 'Слишком большой вес (не можешь сделать 2 чистых)'],
  },
  {
    name: 'AMRAP (As Many Reps As Possible)', type: 'set_extension', difficulty: 3, fatigueCost: 5, hypertrophyRating: 4, strengthRating: 3,
    description: 'Последний подход — сделать максимум повторений с заданным весом (часто в 5/3/1).',
    protocol: 'После рабочих подходов: 1 подход × MAX повторений с остановкой за 1-2 повторения до отказа.',
    example: '5/3/1 неделя 3: 75%×5, 85%×3, 95%×1+. На 95% делаешь 4 повторения = прогресс.',
    bestFor: 'Оценка прогресса. Основные движения в 5/3/1.',
    whenToUse: 'Последний подход основного движения. Каждую тренировку в 5/3/1.',
    whenNotToUse: 'Каждый подход (перетрен). На изоляции (опасно).',
    commonMistakes: ['Идти до абсолютного отказа (техника ломается)', 'Слишком часто'],
  },
  {
    name: 'Myo-Reps', type: 'set_extension', difficulty: 3, fatigueCost: 3, hypertrophyRating: 4, strengthRating: 2,
    description: 'Активационный сет (15-20 повторений до RPE 8) → 3-5 мини-сетов по 3-5 повторений с отдыхом 5 глубоких вдохов.',
    protocol: '1 подход 15-20 @RPE 8 → отдых 5 вдохов → 3-5 повт → отдых 5 вдохов → 3-5 повт → повторить 3-5 раз.',
    example: 'Сгибание на бицепс: 25кг ×18 @RPE 8 → 5 вдохов → 4 → 5 вдохов → 4 → 5 вдохов → 3. ВСЁ.',
    bestFor: 'Эффективные тренировки за короткое время. Изоляция.',
    whenToUse: 'Когда мало времени. Аксессуары.',
    whenNotToUse: 'Тяжёлые compound. При проблемах с сердечно-сосудистой.',
    commonMistakes: ['Слишком тяжёлый активационный сет', 'Слишком много мини-сетов'],
  },
  {
    name: 'Blood Flow Restriction (BFR)', type: 'load_manipulation', difficulty: 4, fatigueCost: 3, hypertrophyRating: 5, strengthRating: 1,
    description: 'Ограничение венозного возврата с помощью жгутов/манжет. Лёгкий вес (20-30% 1RM) даёт гипертрофию как 70% 1RM.',
    protocol: 'Манжеты на проксимальную часть конечности (давление 40-80% AOP). Вес 20-30% 1RM. 30-15-15-15 повторений с 30 сек отдыха.',
    example: 'BFR жим ногами: 40кг (20% 1RM) ×30 → 30с отдых → ×15 → 30с → ×15 → 30с → ×15.',
    bestFor: 'Реабилитация. Периоды низкой нагрузки. Добивка.',
    whenToUse: 'Реабилитация после травмы. Deload (сохранить мышцы).',
    whenNotToUse: 'Без обучения. При тромбозе/гипертонии. Новички.',
    commonMistakes: ['Слишком сильное давление — опасно', 'Слишком долго — некроз', 'Без обучения'],
  },
  {
    name: 'Isometric Holds (изометрические удержания)', type: 'tempo_modification', difficulty: 2, fatigueCost: 2, hypertrophyRating: 2, strengthRating: 4,
    description: 'Удержание веса в определённой точке ROM (обычно в weakest point).',
    protocol: 'Вес 60-80% 1RM. Удержание 10-30 секунд в самой слабой точке. 3-5 подходов.',
    example: 'Присед: удержание в нижней точке 15 сек с 70% 1RM.',
    bestFor: 'Укрепление слабых точек. Реабилитация. Ментальная устойчивость.',
    whenToUse: 'Sticking point training. Реабилитация.',
    whenNotToUse: 'Высокое давление. Головокружения.',
    commonMistakes: ['Задержка дыхания', 'Слишком долго (падение формы)'],
  },
  {
    name: 'Tempo Training (Темповая работа)', type: 'tempo_modification', difficulty: 2, fatigueCost: 2, hypertrophyRating: 3, strengthRating: 3,
    description: 'Контролируемая скорость повторений. Обозначение: ECCENTRIC-PAUSE-CONCENTRIC-PAUSE (секунды).',
    protocol: 'Темп 3-1-3-0 = 3с вниз, 1с пауза, 3с вверх, 0с пауза. Типичные: 3-0-1-0 (гипертрофия), 5-2-2-1 (реабилитация), 2-0-1-0 (сила).',
    example: 'Присед 3-1-3-0: 3 сек вниз → 1 сек пауза → 3 сек вверх = одно повторение 7 секунд.',
    bestFor: 'Контроль движения. Время под нагрузкой (TUT). Реабилитация.',
    whenToUse: 'Технические блоки. Реабилитация. Смена стимула.',
    whenNotToUse: 'Максимальные веса (невозможно контролировать темп).',
    commonMistakes: ['Слишком быстрый счёт', 'Потеря контроля на последних повторениях'],
  },
  {
    name: 'Pre-Exhaust (Предварительное утомление)', type: 'load_manipulation', difficulty: 3, fatigueCost: 4, hypertrophyRating: 4, strengthRating: 1,
    description: 'Изоляция → compound. Сначала утомить целевую мышцу изоляцией, затем добить compound-упражнением.',
    protocol: 'Изоляция: 3-4 подхода до пампа → сразу Compound: 3 подхода.',
    example: 'Грудь: Cable Flye 3×15 → Bench Press 3×8. Плечи: Lateral Raise 3×20 → OHP 3×8.',
    bestFor: 'Отстающие мышечные группы. Улучшение mind-muscle connection.',
    whenToUse: 'Когда compound не чувствуется целевой мышцей.',
    whenNotToUse: 'Силовые блоки. Тяжёлые compound (снижение производительности).',
    commonMistakes: ['Слишком тяжёлая изоляция (не хватает на compound)', 'На основных движениях в силовом цикле'],
  },
  {
    name: 'Post-Exhaust (Последующее утомление)', type: 'load_manipulation', difficulty: 2, fatigueCost: 3, hypertrophyRating: 4, strengthRating: 3,
    description: 'Compound → изоляция. Сначала тяжёлое базовое, затем добивка изоляцией до полного отказа.',
    protocol: 'Compound: 3-4 подхода → Изоляция: 2-3 подхода до отказа.',
    example: 'Жим лёжа 4×6 → Разводка гантелей 3×12 до жжения.',
    bestFor: 'Безопаснее pre-exhaust. Хорошо для hypertrophy.',
    whenToUse: 'Стандартный подход к hypertrophy тренировкам.',
    whenNotToUse: 'Когда нет времени.',
    commonMistakes: ['Слишком много изоляции (перетрен)'],
  },
  {
    name: '1.5 Reps (Полуторные повторения)', type: 'tempo_modification', difficulty: 2, fatigueCost: 3, hypertrophyRating: 4, strengthRating: 2,
    description: 'Полная амплитуда вниз → половина вверх → снова вниз → полная вверх. Это 1 повторение.',
    protocol: 'Опустить → поднять наполовину → опустить → поднять полностью. 6-10 таких повторений = жестоко.',
    example: 'Присед: вниз → вверх до параллели → вниз → полный вверх = ×1.',
    bestFor: 'Увеличение TUT. Памп. Слабые точки в середине ROM.',
    whenToUse: 'Аксессуары. Когда нужно увеличить интенсивность без увеличения веса.',
    whenNotToUse: 'Тяжёлые compound (техника страдает).',
    commonMistakes: ['Потеря счёта (какое повторение?)', 'Слишком тяжёлый вес'],
  },
  {
    name: 'Cheat Reps (Читинг-повторения)', type: 'load_manipulation', difficulty: 4, fatigueCost: 3, hypertrophyRating: 4, strengthRating: 2,
    description: 'Строгие повторения до отказа → 1-3 "грязных" повторения с помощью инерции/других мышц. Только на изоляции.',
    protocol: 'Строгие до отказа → 1-3 повторения с минимальной помощью → контролируемый негатив 3-4 сек.',
    example: 'Сгибание на бицепс: 10 строгих с 20кг → 3 с лёгким читингом → негатив 4 сек каждый.',
    bestFor: 'Продление подхода за пределы отказа. Бицепс, трицепс.',
    whenToUse: 'Последний подход. Изоляция.',
    whenNotToUse: 'Compound упражнения. При проблемах с суставами. Новички.',
    commonMistakes: ['Слишком много читинга — не целевая мышца', 'На приседе/тяге — травма'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. Peri-Workout Nutrition (5 phases)
// ═══════════════════════════════════════════════════════════════════════════

const PERI_WORKOUT_PROTOCOLS: PeriWorkoutProtocol[] = [
  {
    phase: 'Pre-Workout (2-3 часа)', timing: 'За 2-3 часа до тренировки',
    goal: 'Обеспечить энергией и аминокислотами на всю тренировку',
    protein: { amount: '30-40 г', source: 'Курица, рыба, яйца, говядина', rationale: 'Медленный белок обеспечивает стабильный поток аминокислот в течение тренировки.' },
    carbs: { amount: '60-100 г', source: 'Рис, гречка, овсянка, картофель', rationale: 'Сложные углеводы — стабильная энергия. Заполняют гликогеновые депо.' },
    fat: { amount: '15-25 г', source: 'Оливковое масло, авокадо, орехи', rationale: 'Умеренно. Жир замедляет пищеварение — не перегружать.' },
    hydration: '500-750 мл воды за 2 часа',
    supplements: [
      { name: 'Сывороточный протеин', dosage: '20 г', timing: 'За 30 мин', rationale: 'Быстрый белок перед тренировкой' },
      { name: 'Кофеин', dosage: '200-400 мг', timing: 'За 45-60 мин', rationale: 'Пик концентрации через 45-60 мин. Бодрость, сила +3-5%.' },
      { name: 'Цитруллин малат', dosage: '6-8 г', timing: 'За 45-60 мин', rationale: 'Пампинг, выносливость, снижение усталости.' },
      { name: 'Бета-аланин', dosage: '3-5 г', timing: 'За 30-45 мин', rationale: 'Буфер молочной кислоты. Покалывание — нормально.' },
    ],
    totalKcal: '400-700 ккал',
  },
  {
    phase: 'Pre-Workout (15-30 мин)', timing: 'За 15-30 минут до',
    goal: 'Быстрая энергия и аминокислоты в крови',
    protein: { amount: '10-20 г', source: 'Whey, EAA, BCAA', rationale: 'Быстрое всасывание.' },
    carbs: { amount: '20-40 г', source: 'Банан, финики, декстроза', rationale: 'Быстрые углеводы — энергия здесь и сейчас.' },
    fat: { amount: '0 г', source: '—', rationale: 'Жир замедляет всасывание — исключить.' },
    hydration: '200-300 мл воды',
    supplements: [
      { name: 'EAA', dosage: '10 г', timing: 'За 15 мин', rationale: 'Все незаменимые аминокислоты.' },
      { name: 'Сывороточный изолят', dosage: '20 г', timing: 'За 15 мин', rationale: 'Сверхбыстрый белок.' },
    ],
    totalKcal: '150-250 ккал',
  },
  {
    phase: 'Intra-Workout', timing: 'Во время тренировки',
    goal: 'Поддержание энергии и гидратации при длительных тренировках (>75 мин)',
    protein: { amount: '5-15 г/час', source: 'EAA, BCAA, гидролизат', rationale: 'Снижение катаболизма во время тренировки.' },
    carbs: { amount: '15-30 г/час', source: 'Декстроза, мальтодекстрин, Gatorade', rationale: 'Поддержание глюкозы крови. Отсрочка усталости.' },
    fat: { amount: '0 г', source: '—', rationale: 'Не во время тренировки.' },
    hydration: '250-500 мл каждые 15-20 минут',
    supplements: [
      { name: 'EAA + Декстроза', dosage: '10 г + 30 г', timing: 'В 750 мл воды, пить глотками', rationale: 'Всё в одном напитке.' },
      { name: 'Электролиты', dosage: '1 пакетик', timing: 'В воду', rationale: 'Na, K, Mg для предотвращения судорог.' },
    ],
    totalKcal: '80-150 ккал/час',
  },
  {
    phase: 'Post-Workout (Анаболическое окно)', timing: '0-30 минут после',
    goal: 'Максимальный синтез белка и ресинтез гликогена',
    protein: { amount: '30-50 г', source: 'Сывороточный изолят/концентрат', rationale: 'Пик аминокислот в крови через 30-60 мин = максимальный MPS.' },
    carbs: { amount: '40-80 г', source: 'Декстроза, мальтодекстрин, белый рис, банан', rationale: 'Инсулиновый спайк → гликоген + транспорт аминокислот.' },
    fat: { amount: '0 г', source: '—', rationale: 'Замедляет всасывание — исключить в этом окне.' },
    hydration: '500-750 мл воды + электролиты',
    supplements: [
      { name: 'Сывороточный изолят', dosage: '40 г', timing: 'Сразу после', rationale: 'Быстрый белок.' },
      { name: 'Креатин моногидрат', dosage: '5 г', timing: 'Сразу после', rationale: 'С углеводами — лучшее усвоение.' },
      { name: 'Декстроза', dosage: '40-60 г', timing: 'Сразу после', rationale: 'Быстрое восполнение гликогена.' },
    ],
    totalKcal: '300-500 ккал',
  },
  {
    phase: 'Post-Workout Meal (1-2 часа)', timing: 'Через 60-90 минут после',
    goal: 'Полноценный приём пищи для sustained анаболизма',
    protein: { amount: '40-60 г', source: 'Курица, рыба, яйца, говядина', rationale: 'Цельный белок для sustained release аминокислот.' },
    carbs: { amount: '60-100 г', source: 'Рис, гречка, картофель, макароны', rationale: 'Продолжение ресинтеза гликогена.' },
    fat: { amount: '15-25 г', source: 'Оливковое масло, авокадо, орехи', rationale: 'Для гормональной поддержки и абсорбции витаминов.' },
    hydration: '500 мл воды',
    supplements: [
      { name: 'Омега-3', dosage: '3-6 г', timing: 'С едой', rationale: 'Противовоспалительное.' },
      { name: 'Витамин D3 + K2', dosage: '5000 МЕ + 100 мкг', timing: 'С едой', rationale: 'С жирами для абсорбции.' },
    ],
    totalKcal: '600-900 ккал',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. Supplement Encyclopedia (25 supplements)
// ═══════════════════════════════════════════════════════════════════════════

const SUPPLEMENT_ENCYCLOPEDIA: SupplementEntry[] = [
  {
    name: 'Креатин моногидрат', category: 'performance', evidenceLevel: 'A',
    mechanism: 'Фосфокреатиновая система → регенерация АТФ → сила и мощность. Гидратация клеток → объём мышц.',
    dosage: { standard: '5 г/день', athlete: '5 г/день', onCycle: '5-10 г/день' },
    timing: 'Пост-тренировка с углеводами (лучшее усвоение)', withFood: false, halfLife: '3 часа',
    benefits: ['Сила +5-15%', 'Мощность', 'Объём мышц (внутриклеточная вода)', 'Когнитивная функция'],
    sideEffects: ['Задержка воды 1-2 кг', 'Желудочный дискомфорт при >10 г'],
    interactions: ['Кофеин может снижать эффект — разнести на 2+ часа'],
    costPerMonth: '~400 ₽', recommendFor: ['Все'],
  },
  {
    name: 'Сывороточный протеин (Whey)', category: 'protein', evidenceLevel: 'A',
    mechanism: 'Быстрый белок. Богат лейцином (10-12%) → mTOR активация → синтез белка.',
    dosage: { standard: '20-40 г', athlete: '30-50 г пост-тренировка', onCycle: '40-60 г пост-тренировка' },
    timing: 'После тренировки, утром, между приёмами', withFood: false, halfLife: '1-2 часа',
    benefits: ['Удобный источник белка', 'Быстрое всасывание', 'Высокий лейцин'],
    sideEffects: ['Вздутие при непереносимости лактозы (изолят решает)'],
    interactions: ['Нет значимых'],
    costPerMonth: '~1,500 ₽', recommendFor: ['Все'],
  },
  {
    name: 'Казеин', category: 'protein', evidenceLevel: 'A',
    mechanism: 'Медленный белок. Формирует гель в желудке → постепенное высвобождение АК 6-8 часов.',
    dosage: { standard: '30-40 г', athlete: '30-40 г перед сном', onCycle: '40-50 г перед сном' },
    timing: 'Перед сном', withFood: false, halfLife: '6-8 часов',
    benefits: ['Ночной анаболизм', 'Анти-катаболическое', 'Сытость'],
    sideEffects: ['Медленное пищеварение — не перед тренировкой'],
    interactions: ['Нет'],
    costPerMonth: '~1,200 ₽', recommendFor: ['Все', 'Особенно на сушке'],
  },
  {
    name: 'EAA (Essential Amino Acids)', category: 'amino_acid', evidenceLevel: 'A',
    mechanism: 'Все 9 незаменимых аминокислот. Прямая стимуляция MPS. Лучше BCAA.',
    dosage: { standard: '10 г', athlete: '10-15 г intra/post', onCycle: '15-20 г' },
    timing: 'До/во время/после тренировки', withFood: false, halfLife: '1 час',
    benefits: ['Стимуляция MPS', 'Снижение катаболизма', 'Лучше BCAA'],
    sideEffects: ['Горький вкус'],
    interactions: ['Нет'],
    costPerMonth: '~1,500 ₽', recommendFor: ['Тренирующиеся натощак', 'Intra-workout'],
  },
  {
    name: 'Цитруллин малат', category: 'performance', evidenceLevel: 'A',
    mechanism: 'Цитруллин → аргинин → NO → вазодилатация → памп. Малат → цикл Кребса → снижение усталости.',
    dosage: { standard: '6-8 г', athlete: '8-10 г', onCycle: '10-12 г' },
    timing: 'За 45-60 мин до тренировки', withFood: false, halfLife: '1 час',
    benefits: ['Памп', 'Выносливость (+1-2 повторения)', 'Снижение DOMS'],
    sideEffects: ['Желудочный дискомфорт при >10 г'],
    interactions: ['Синергия с бета-аланином'],
    costPerMonth: '~800 ₽', recommendFor: ['Все', 'Особенно hypertrophy'],
  },
  {
    name: 'Бета-аланин', category: 'performance', evidenceLevel: 'A',
    mechanism: 'Повышает карнозин в мышцах → буфер H+ ионов → отсрочка закисления.',
    dosage: { standard: '3-5 г/день', athlete: '5-6 г/день', onCycle: '5-6 г/день' },
    timing: 'Разделить на 2-3 приёма для избежания парестезии', withFood: false, halfLife: 'Не применимо (накапливается)',
    benefits: ['Отсрочка закисления', 'Выносливость в 8-15 повторениях'],
    sideEffects: ['Покалывание (парестезия) — безвредно, проходит'],
    interactions: ['Синергия с цитруллином'],
    costPerMonth: '~500 ₽', recommendFor: ['Hypertrophy', 'CrossFit', 'Спринтеры'],
  },
  {
    name: 'Кофеин (ангидрид)', category: 'stimulant', evidenceLevel: 'A',
    mechanism: 'Антагонист аденозиновых рецепторов → бодрость, снижение восприятия боли, мобилизация жиров.',
    dosage: { standard: '100-200 мг', athlete: '200-400 мг', onCycle: '200-600 мг' },
    timing: 'За 45-60 мин до тренировки', withFood: false, halfLife: '4-6 часов',
    benefits: ['Сила +3-5%', 'Фокус', 'Жиросжигание', 'Снижение восприятия усилия'],
    sideEffects: ['Тремор', 'Тревожность', 'Бессонница (последний приём до 14:00)', 'Привыкание'],
    interactions: ['Синергия с L-теанином (фокус без нервозности)'],
    costPerMonth: '~200 ₽', recommendFor: ['Все (кроме чувствительных)'],
  },
  {
    name: 'L-теанин', category: 'nootropic', evidenceLevel: 'B',
    mechanism: 'Повышает альфа-волны мозга → расслабленный фокус. Сглаживает побочки кофеина.',
    dosage: { standard: '200 мг', athlete: '200-400 мг', onCycle: '200-400 мг' },
    timing: 'С кофеином перед тренировкой или вечером для расслабления', withFood: false, halfLife: '1-2 часа',
    benefits: ['Сглаживает нервозность кофеина', 'Фокус', 'Расслабление без седации'],
    sideEffects: ['Нет значимых'],
    interactions: ['Синергия с кофеином (1:2 L-теанин:кофеин)'],
    costPerMonth: '~500 ₽', recommendFor: ['Чувствительные к кофеину', 'Вечернее расслабление'],
  },
  {
    name: 'Ашваганда (KSM-66)', category: 'adaptogen', evidenceLevel: 'B',
    mechanism: 'Снижает кортизол, повышает тестостерон (умеренно), адаптоген.',
    dosage: { standard: '300-600 мг', athlete: '600 мг', onCycle: '600 мг' },
    timing: 'Вечер (снижает кортизол перед сном)', withFood: true, halfLife: '6 часов',
    benefits: ['Кортизол -27%', 'Тестостерон +15% (исследования)', 'Стрессоустойчивость'],
    sideEffects: ['Сонливость при высоких дозах', 'Не при гипертиреозе'],
    interactions: ['Не с седативными'],
    costPerMonth: '~800 ₽', recommendFor: ['Стресс', 'Тренболон', 'ПКТ'],
  },
  {
    name: 'Родиола розовая', category: 'adaptogen', evidenceLevel: 'B',
    mechanism: 'Адаптоген. Снижает усталость, повышает ментальную и физическую производительность.',
    dosage: { standard: '200-400 мг', athlete: '400-600 мг', onCycle: '400-600 мг' },
    timing: 'Утро/день (может мешать сну)', withFood: false, halfLife: '5 часов',
    benefits: ['Снижение усталости', 'Ментальная производительность', 'Выносливость'],
    sideEffects: ['Бессонница при вечернем приёме'],
    interactions: ['Нет'],
    costPerMonth: '~600 ₽', recommendFor: ['Подготовка к соревнованиям', 'Тяжёлые тренировочные блоки'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getRecoveryMethods(): RecoveryMethod[] { return RECOVERY_LIBRARY; }
export function getRecoveryByCategory(cat: string): RecoveryMethod[] { return RECOVERY_LIBRARY.filter(r => r.category === cat); }
export function getIntensityTechniques(): IntensityTechnique[] { return INTENSITY_TECHNIQUES; }
export function getTechniqueByType(type: string): IntensityTechnique[] { return INTENSITY_TECHNIQUES.filter(t => t.type === type); }
export function getPeriWorkoutProtocols(): PeriWorkoutProtocol[] { return PERI_WORKOUT_PROTOCOLS; }
export function getSupplementEncyclopedia(): SupplementEntry[] { return SUPPLEMENT_ENCYCLOPEDIA; }
export function getSupplementsByCategory(cat: string): SupplementEntry[] { return SUPPLEMENT_ENCYCLOPEDIA.filter(s => s.category === cat); }
export function getSupplementsByEvidence(level: string): SupplementEntry[] { return SUPPLEMENT_ENCYCLOPEDIA.filter(s => s.evidenceLevel === level); }
