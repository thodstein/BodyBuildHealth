/**
 * Biohacking + Environment + Social Training Engine
 *
 * Biohacking: cold exposure, sauna, fasting, red light therapy protocols
 * Environment: home gym optimizer, equipment recommendations by budget
 * Social Training: partner workouts, group motivation, coach feedback system
 * Longevity: anti-aging protocols, blood marker optimization, NAD+ etc.
 *
 * @module biohacking-environment-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BiohackingProtocol {
  name: string;
  category: 'cold' | 'heat' | 'fasting' | 'light' | 'supplement' | 'sleep' | 'breath';
  protocol: { step: number; action: string; duration: string; progression: string }[];
  frequency: string;
  benefits: string[];
  risks: string[];
  timing: 'morning' | 'afternoon' | 'evening' | 'post_workout' | 'before_bed' | 'anytime';
}

export interface HomeGymSetup {
  budget: 'minimal' | 'basic' | 'intermediate' | 'advanced' | 'dream';
  totalCost: string;
  equipment: { item: string; cost: string; essential: boolean; alternatives: string }[];
  possibleExercises: string[];
  limitations: string[];
}

export interface PartnerWorkout {
  name: string;
  type: 'alternating' | 'simultaneous' | 'spotter_intensive' | 'competition' | 'circuit';
  durationMin: number;
  exercises: { name: string; sets: number; reps: string; partnerRole: string; notes: string }[];
}

export interface LongevityProtocol {
  name: string;
  category: string;
  interventions: { name: string; dosage: string; frequency: string; evidence: string }[];
  targetOutcome: string;
  bloodMarkers: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Biohacking Protocols
// ═══════════════════════════════════════════════════════════════════════════

const BIOHACKING_PROTOCOLS: BiohackingProtocol[] = [
  {
    name: 'Холодовая экспозиция (Cold Plunge)',
    category: 'cold',
    protocol: [
      { step: 1, action: 'Начать с 30 сек при 15°C', duration: '30 сек', progression: 'Увеличивать на 15 сек каждую неделю' },
      { step: 2, action: 'Прогрессия до 3 мин при 10°C', duration: '3 мин', progression: 'Оптимальная длительность' },
      { step: 3, action: 'Продвинутый: 5-7 мин при 5-8°C', duration: '5-7 мин', progression: 'Только после адаптации' },
    ],
    frequency: '3-5×/нед. НЕ сразу после силовой (снижает mTOR).',
    benefits: ['Дофамин +250% на 3+ часа', 'Снижение воспаления', 'Ускорение recovery', 'Бурая жировая ткань ↑'],
    risks: ['Не после тренировки на гипертрофию', 'Противопоказано при сердечных заболеваниях', 'Гипотермия при >10 мин'],
    timing: 'morning',
  },
  {
    name: 'Сауна (Heat Exposure)',
    category: 'heat',
    protocol: [
      { step: 1, action: '10-15 мин при 80°C', duration: '10-15 мин', progression: 'Начинать с 10 мин' },
      { step: 2, action: 'Прогрессия до 20-30 мин при 80-100°C', duration: '20-30 мин', progression: '+5 мин/нед' },
      { step: 3, action: '4 цикла × 10-15 мин с охлаждением между', duration: '4×15 мин', progression: 'Продвинутый' },
    ],
    frequency: '4-7×/нед. Идеально после тренировки (усиливает ГР).',
    benefits: ['Гормон роста +300-500% (15-20 мин)', 'Кардиопротекция', 'Снижение общей смертности на 40%', 'Детоксикация'],
    risks: ['Обезвоживание', 'Не при беременности', 'Не перед соревнованиями (снижает мощность)'],
    timing: 'post_workout',
  },
  {
    name: 'Интервальное голодание 16:8 (для атлетов)',
    category: 'fasting',
    protocol: [
      { step: 1, action: 'Окно питания 12:00-20:00', duration: '8ч окно', progression: 'Начать с 12:12 → 14:10 → 16:8' },
      { step: 2, action: 'Тренировка в конце голодного окна', duration: '—', progression: 'BCAA/EAA перед тренировкой' },
      { step: 3, action: 'Первый приём пищи после тренировки', duration: '—', progression: 'Максимальный анаболический ответ' },
    ],
    frequency: 'Ежедневно или 5×/нед.',
    benefits: ['Аутофагия (клеточное очищение)', 'Инсулиночувствительность ↑', 'GH ↑'],
    risks: ['Потеря мышечной массы при недостатке белка', 'Не для хардгейнеров', 'Головные боли первые 3-5 дней'],
    timing: 'anytime',
  },
  {
    name: 'Дыхание Wim Hof',
    category: 'breath',
    protocol: [
      { step: 1, action: '30 глубоких вдохов (полный вдох, пассивный выдох)', duration: '2 мин', progression: 'Увеличивать до 40 вдохов' },
      { step: 2, action: 'Задержка на выдохе (максимально)', duration: '1-3 мин', progression: 'Увеличивается с практикой' },
      { step: 3, action: 'Глубокий вдох, задержка 15 сек', duration: '15 сек', progression: 'Стандарт' },
      { step: 4, action: 'Повторить цикл 3-4 раза', duration: '10-15 мин', progression: '3-4 цикла' },
    ],
    frequency: 'Ежедневно утром. Перед холодной экспозицией.',
    benefits: ['Контроль вегетативной НС', 'Противовоспалительное', 'Энергия и фокус', 'Усиление иммунитета'],
    risks: ['Не в воде/за рулём (риск потери сознания)', 'Не при эпилепсии', 'Не при беременности'],
    timing: 'morning',
  },
  {
    name: 'Red Light Therapy (Фотобиомодуляция)',
    category: 'light',
    protocol: [
      { step: 1, action: '660nm + 850nm панель, 10-15 мин на целевую зону', duration: '10-15 мин', progression: 'Расстояние 15-30 см' },
      { step: 2, action: 'Перед тренировкой: предварительная стимуляция мышц', duration: '5-10 мин', progression: 'На крупные группы' },
      { step: 3, action: 'Тестикулы: 5-10 мин для тестостерона (экспериментально)', duration: '5-10 мин', progression: 'Осторожно с дозой' },
    ],
    frequency: '3-5×/нед на мышцы. Ежедневно для кожи.',
    benefits: ['Ускорение восстановления', 'Коллаген и кожа', 'Потенциально тестостерон ↑', 'Митохондриальная функция'],
    risks: ['Минимальны при правильной дозировке', 'Защита глаз обязательна'],
    timing: 'anytime',
  },
];

export function getBiohackingProtocols(): BiohackingProtocol[] { return BIOHACKING_PROTOCOLS; }

// ═══════════════════════════════════════════════════════════════════════════
// 2. Home Gym Setup
// ═══════════════════════════════════════════════════════════════════════════

const HOME_GYM_SETUPS: HomeGymSetup[] = [
  {
    budget: 'minimal', totalCost: '5,000-15,000 ₽',
    equipment: [
      { item: 'Разборные гантели 2×15кг', cost: '3,500 ₽', essential: true, alternatives: 'Бутылки с водой/песком' },
      { item: 'Резиновые петли (набор)', cost: '2,000 ₽', essential: true, alternatives: '—' },
      { item: 'Коврик для фитнеса', cost: '1,000 ₽', essential: true, alternatives: '—' },
      { item: 'Турник в проём', cost: '1,500 ₽', essential: false, alternatives: 'Дверной турник' },
    ],
    possibleExercises: ['Отжимания', 'Подтягивания', 'Выпады', 'Приседания с гантелями', 'Тяга гантелей', 'Жим гантелей', 'Махи', 'Планка'],
    limitations: ['Нет тяжёлых компаундов', 'Ограниченная прогрессия', 'Нет приседа со штангой'],
  },
  {
    budget: 'basic', totalCost: '30,000-60,000 ₽',
    equipment: [
      { item: 'Силовая рама (half rack)', cost: '20,000 ₽', essential: true, alternatives: 'Squat stands' },
      { item: 'Олимпийский гриф 20кг', cost: '8,000 ₽', essential: true, alternatives: '—' },
      { item: 'Диски 100кг набор', cost: '12,000 ₽', essential: true, alternatives: 'Б/у диски' },
      { item: 'Скамья регулируемая', cost: '8,000 ₽', essential: true, alternatives: 'Flat bench' },
      { item: 'Гантели разборные', cost: '5,000 ₽', essential: false, alternatives: '—' },
    ],
    possibleExercises: ['Присед', 'Жим лёжа', 'Становая тяга', 'OHP', 'Row', 'Pull-up', 'RDL', 'Curl', 'Extension'],
    limitations: ['Нет тренажёров', 'Нет кабельных движений', 'Ограниченное пространство'],
  },
  {
    budget: 'intermediate', totalCost: '120,000-200,000 ₽',
    equipment: [
      { item: 'Full power rack', cost: '35,000 ₽', essential: true, alternatives: '—' },
      { item: 'Олимпийский гриф + женский гриф', cost: '20,000 ₽', essential: true, alternatives: '—' },
      { item: 'Диски 200кг', cost: '25,000 ₽', essential: true, alternatives: '—' },
      { item: 'Регулируемая скамья', cost: '12,000 ₽', essential: true, alternatives: '—' },
      { item: 'Кабельная станция', cost: '30,000 ₽', essential: false, alternatives: 'Петли + band' },
      { item: 'Гантельный ряд 2.5-25кг', cost: '25,000 ₽', essential: false, alternatives: 'Регулируемые гантели' },
      { item: 'Гири 16+24кг', cost: '8,000 ₽', essential: false, alternatives: '—' },
    ],
    possibleExercises: ['Все базовые + кабельные движения', 'Face pull', 'Tricep pushdown', 'Cable fly', 'Lat pulldown'],
    limitations: ['Нет жима ногами', 'Нет GHR', 'Ограничено пространством'],
  },
  {
    budget: 'advanced', totalCost: '350,000-600,000 ₽',
    equipment: [
      { item: 'Power rack + platform', cost: '60,000 ₽', essential: true, alternatives: '—' },
      { item: 'Буферные диски (crash pads)', cost: '40,000 ₽', essential: false, alternatives: 'Резиновое покрытие' },
      { item: 'GHD (Glute-Ham Developer)', cost: '40,000 ₽', essential: false, alternatives: 'Nordic curl strap' },
      { item: 'Leg press / hack squat combo', cost: '80,000 ₽', essential: false, alternatives: '—' },
      { item: 'Cable crossover', cost: '60,000 ₽', essential: false, alternatives: 'Functional trainer' },
      { item: 'Гантельный ряд до 50кг', cost: '50,000 ₽', essential: false, alternatives: '—' },
    ],
    possibleExercises: ['Полный арсенал: PL + BB + WL', 'GHR', 'Leg press', 'Все кабельные', 'Strongman implements'],
    limitations: ['Пространство 20-30 м²', 'Вентиляция', 'Шумоизоляция'],
  },
  {
    budget: 'dream', totalCost: '1,500,000+ ₽',
    equipment: [
      { item: 'Полный комплект Eleiko/Rogue', cost: '500,000 ₽', essential: true, alternatives: '—' },
      { item: 'Custom power rack', cost: '150,000 ₽', essential: true, alternatives: '—' },
      { item: 'Belt squat machine', cost: '120,000 ₽', essential: false, alternatives: '—' },
      { item: 'Reverse hyper', cost: '100,000 ₽', essential: false, alternatives: '—' },
      { item: 'Pulldown + row combo', cost: '150,000 ₽', essential: false, alternatives: '—' },
    ],
    possibleExercises: ['Всё что угодно', 'Специализированные PL/Strongman/WL'],
    limitations: ['Только бюджет и пространство'],
  },
];

export function getHomeGymSetups(): HomeGymSetup[] { return HOME_GYM_SETUPS; }

// ═══════════════════════════════════════════════════════════════════════════
// 3. Partner Workouts
// ═══════════════════════════════════════════════════════════════════════════

const PARTNER_WORKOUTS: PartnerWorkout[] = [
  {
    name: 'Push/Pull партнёрский', type: 'alternating', durationMin: 50,
    exercises: [
      { name: 'Bench Press', sets: 4, reps: '8-10', partnerRole: 'Страховка + смена веса', notes: 'Партнёр меняет диски пока вы отдыхаете' },
      { name: 'Barbell Row', sets: 4, reps: '8-10', partnerRole: 'Страховка', notes: 'Чередование без отдыха' },
      { name: 'DB Shoulder Press', sets: 3, reps: '10-12', partnerRole: 'Подача гантелей', notes: 'Партнёр подаёт гантели в верхней точке' },
      { name: 'Face Pull', sets: 3, reps: '15', partnerRole: '—', notes: 'Синхронно' },
    ],
  },
  {
    name: 'Ноги (Leg Day Massacre)', type: 'spotter_intensive', durationMin: 60,
    exercises: [
      { name: 'Squat', sets: 5, reps: '5-8', partnerRole: 'Spot + cues', notes: 'Партнёр сзади: "грудь вверх, колени наружу"' },
      { name: 'RDL', sets: 4, reps: '10', partnerRole: 'Форма', notes: 'Партнёр сбоку контролирует спину' },
      { name: 'Walking Lunge', sets: 3, reps: '20 шагов', partnerRole: 'Синхронно', notes: 'Идёте рядом друг с другом' },
      { name: 'Leg Extension (drop set)', sets: 3, reps: '12+10+8', partnerRole: 'Смена веса', notes: 'Партнёр быстро меняет вес для drop set' },
    ],
  },
  {
    name: 'Соревновательный (AMRAP)', type: 'competition', durationMin: 30,
    exercises: [
      { name: 'Pull-ups AMRAP', sets: 1, reps: 'MAX', partnerRole: 'Считает', notes: 'Кто больше за 2 мин' },
      { name: 'Push-ups AMRAP', sets: 1, reps: 'MAX', partnerRole: 'Считает', notes: 'Грудь касается пола' },
      { name: 'BW Squat AMRAP', sets: 1, reps: 'MAX', partnerRole: 'Считает', notes: 'Бёдра ниже параллели' },
      { name: 'Plank hold', sets: 1, reps: 'MAX время', partnerRole: 'Хронометраж', notes: 'Кто дольше. Проигравший — 10 burpees' },
    ],
  },
];

export function getPartnerWorkouts(): PartnerWorkout[] { return PARTNER_WORKOUTS; }

// ═══════════════════════════════════════════════════════════════════════════
// 4. Longevity Protocols
// ═══════════════════════════════════════════════════════════════════════════

const LONGEVITY_PROTOCOLS: LongevityProtocol[] = [
  {
    name: 'NAD+ Optimization', category: 'cellular',
    interventions: [
      { name: 'NMN', dosage: '500-1000 мг', frequency: 'Утро, натощак', evidence: 'Повышает NAD+ уровни. Клинические испытания продолжаются.' },
      { name: 'NR (Nicotinamide Riboside)', dosage: '300-600 мг', frequency: 'Утро', evidence: 'Альтернатива NMN. Схожий механизм.' },
      { name: 'Resveratrol', dosage: '500-1000 мг', frequency: 'С жирной пищей', evidence: 'Сиртуин-активатор. Синергия с NMN.' },
      { name: 'Интенсивные упражнения', dosage: '—', frequency: '3×/нед', evidence: 'Естественный подъём NAD+ через AMPK.' },
    ],
    targetOutcome: 'Замедление эпигенетического старения. Улучшение митохондриальной функции.',
    bloodMarkers: ['NAD+ (исследовательский)', 'Биологический возраст (Horvath clock)'],
  },
  {
    name: 'Senolytic Protocol', category: 'cellular',
    interventions: [
      { name: 'Fisetin', dosage: '20 мг/кг', frequency: '2 дня/мес (пульс-терапия)', evidence: 'Mayo Clinic: снижает сенесцентные клетки.' },
      { name: 'Quercetin', dosage: '500 мг', frequency: '2×/день 2 дня/мес', evidence: 'Синергия с физетином.' },
      { name: 'Интервальное голодание', dosage: '16:8', frequency: 'Ежедневно', evidence: 'Аутофагия — естественный сенолитик.' },
    ],
    targetOutcome: 'Элиминация стареющих клеток. Снижение inflammaging.',
    bloodMarkers: ['hs-CRP', 'IL-6', 'TNF-alpha'],
  },
  {
    name: 'Hormonal Optimization (Natural)', category: 'hormonal',
    interventions: [
      { name: 'Цинк + Магний', dosage: 'Zn 50мг + Mg 400мг', frequency: 'Перед сном', evidence: 'ZMA — классика для тестостерона.' },
      { name: 'Витамин D3', dosage: '5000 МЕ', frequency: 'Утро', evidence: 'Корреляция D3 и тестостерона.' },
      { name: 'Ашваганда KSM-66', dosage: '600 мг', frequency: 'Вечер', evidence: 'Снижает кортизол на 27%. ↑ тестостерон на 15%.' },
      { name: 'Сон 7.5-9ч', dosage: '—', frequency: 'Ежедневно', evidence: '1 нед <5ч сна снижает тестостерон на 10-15%.' },
      { name: 'Boron', dosage: '10 мг', frequency: 'Утро', evidence: '↑ свободный тестостерон на 25% в исследованиях.' },
    ],
    targetOutcome: 'Оптимизация естественного гормонального фона.',
    bloodMarkers: ['Тестостерон общий + свободный', 'SHBG', 'Эстрадиол', 'Кортизол'],
  },
];

export function getLongevityProtocols(): LongevityProtocol[] { return LONGEVITY_PROTOCOLS; }
