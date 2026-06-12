/**
 * Restaurant Guide + Travel Workout Generator + Sleep Stack
 *
 * Restaurant Guide: 30+ items from popular chains with macros for athletes
 * Travel Workouts: no-equipment, hotel room, resistance band only
 * Sleep Stack: evidence-based supplement combinations for sleep quality
 *
 * @module restaurant-travel-sleep-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface RestaurantItem {
  chain: string;
  category: string;
  item: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  athleteRating: 'excellent' | 'good' | 'ok' | 'avoid';
  notes: string;
}

export interface TravelWorkout {
  name: string;
  durationMin: number;
  equipment: string[];
  exercises: { name: string; sets: number; reps: string; restSec: number; notes: string }[];
  warmup: string[];
  cooldown: string[];
}

export interface SleepStack {
  name: string;
  level: 'basic' | 'advanced' | 'extreme';
  supplements: { name: string; dosage: string; timing: string; mechanism: string }[];
  totalCost: string;
  expectedEffect: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Restaurant Macro Guide (25+ items)
// ═══════════════════════════════════════════════════════════════════════════

const RESTAURANT_DB: RestaurantItem[] = [
  // KFC / Rostic's
  { chain: 'KFC', category: 'Курица', item: 'Куриная грудка (оригинал) 1 шт', kcal: 180, protein: 24, fat: 9, carbs: 3, athleteRating: 'excellent', notes: 'Лучший выбор в KFC. Снимите кожу для экономии жира.' },
  { chain: 'KFC', category: 'Курица', item: 'Стрипсы 3 шт', kcal: 260, protein: 18, fat: 12, carbs: 20, athleteRating: 'good', notes: 'Панировка добавляет жиры и углеводы.' },
  { chain: 'KFC', category: 'Курица', item: 'Баскет 6 крыльев', kcal: 480, protein: 28, fat: 32, carbs: 18, athleteRating: 'ok', notes: 'Много жира. Только если нужно добить калории.' },
  { chain: 'KFC', category: 'Салаты', item: 'Цезарь с курицей', kcal: 310, protein: 22, fat: 18, carbs: 14, athleteRating: 'good', notes: 'Соус отдельно — половину.' },

  // McDonald's / Вкусно и точка
  { chain: 'McDonalds', category: 'Бургеры', item: 'Биг Мак', kcal: 550, protein: 27, fat: 30, carbs: 44, athleteRating: 'ok', notes: 'Макро-соотношение среднее. Не на сушке.' },
  { chain: 'McDonalds', category: 'Бургеры', item: 'Чизбургер', kcal: 300, protein: 15, fat: 14, carbs: 30, athleteRating: 'ok', notes: 'Мало белка. Лучше двойной.' },
  { chain: 'McDonalds', category: 'Бургеры', item: 'Двойной Чизбургер', kcal: 440, protein: 26, fat: 24, carbs: 32, athleteRating: 'good', notes: '2 шт = 52г белка за 880 ккал. Неплохо на массе.' },
  { chain: 'McDonalds', category: 'Завтрак', item: 'МакМаффин с яйцом', kcal: 310, protein: 18, fat: 13, carbs: 30, athleteRating: 'good', notes: 'Хороший завтрак. +1 шт для 36г белка.' },
  { chain: 'McDonalds', category: 'Салаты', item: 'Овощной салат + заправка', kcal: 180, protein: 3, fat: 14, carbs: 10, athleteRating: 'ok', notes: 'Заправка отдельно. Добавьте курицу.' },

  // Burger King
  { chain: 'Burger King', category: 'Бургеры', item: 'Воппер', kcal: 660, protein: 32, fat: 40, carbs: 50, athleteRating: 'ok', notes: 'Много калорий. Без майонеза — минус 150 ккал.' },
  { chain: 'Burger King', category: 'Бургеры', item: 'Двойной Воппер', kcal: 920, protein: 52, fat: 58, carbs: 52, athleteRating: 'good', notes: '52г белка! Половина дневной нормы. На массе — топ.' },

  // Шашлычные / Кавказская кухня
  { chain: 'Шашлычная', category: 'Мясо', item: 'Шашлык из курицы 200г', kcal: 300, protein: 50, fat: 10, carbs: 0, athleteRating: 'excellent', notes: 'Идеально. Только мясо, без соуса и хлеба.' },
  { chain: 'Шашлычная', category: 'Мясо', item: 'Люля-кебаб из баранины 200г', kcal: 450, protein: 35, fat: 32, carbs: 5, athleteRating: 'good', notes: 'Много жира, но качественный белок.' },
  { chain: 'Шашлычная', category: 'Гарнир', item: 'Рис/Картофель запечённый 200г', kcal: 240, protein: 4, fat: 2, carbs: 52, athleteRating: 'good', notes: 'Хороший источник углеводов.' },

  // Subway
  { chain: 'Subway', category: 'Сэндвичи', item: 'Куриная грудка 30см', kcal: 580, protein: 42, fat: 10, carbs: 80, athleteRating: 'excellent', notes: '42г белка! Цельнозерновой хлеб + все овощи. Лучший фастфуд.' },
  { chain: 'Subway', category: 'Сэндвичи', item: 'Индейка 30см', kcal: 560, protein: 38, fat: 8, carbs: 82, athleteRating: 'excellent', notes: 'Постный вариант. + двойное мясо для 60г+ белка.' },
  { chain: 'Subway', category: 'Сэндвичи', item: 'Тунец 30см', kcal: 680, protein: 36, fat: 34, carbs: 76, athleteRating: 'good', notes: 'Майонез в тунце. Попросите меньше майонеза.' },

  // Суши / Японская
  { chain: 'Суши', category: 'Роллы', item: 'Филадельфия ролл 8 шт', kcal: 380, protein: 18, fat: 14, carbs: 48, athleteRating: 'good', notes: 'Лосось + сливочный сыр. 2 порции = приём пищи.' },
  { chain: 'Суши', category: 'Роллы', item: 'Калифорния ролл 8 шт', kcal: 340, protein: 14, fat: 8, carbs: 52, athleteRating: 'ok', notes: 'Мало белка. Добавьте сашими.' },
  { chain: 'Суши', category: 'Сашими', item: 'Сашими лосось 10 шт', kcal: 220, protein: 32, fat: 12, carbs: 0, athleteRating: 'excellent', notes: '32г белка, 0 углеводов. Чистый протеин.' },

  // Пиццерия
  { chain: 'Пиццерия', category: 'Пицца', item: 'Пепперони 2 слайса', kcal: 560, protein: 24, fat: 26, carbs: 56, athleteRating: 'ok', notes: 'Не лучший выбор. Только при нехватке калорий.' },
  { chain: 'Пиццерия', category: 'Пицца', item: 'Курица + грибы 2 слайса', kcal: 480, protein: 28, fat: 18, carbs: 50, athleteRating: 'good', notes: 'Лучший вариант пиццы — куриная.' },

  // Столовая / Бизнес-ланч
  { chain: 'Столовая', category: 'Комплекс', item: 'Куриный суп + второе (котлета+гречка)', kcal: 650, protein: 38, fat: 22, carbs: 72, athleteRating: 'good', notes: 'Сбалансированный обед. Порция может быть мала — берите добавку гречки.' },
  { chain: 'Столовая', category: 'Комплекс', item: 'Рыбный день: треска + картофель + салат', kcal: 480, protein: 35, fat: 10, carbs: 60, athleteRating: 'excellent', notes: 'Отличный постный вариант.' },

  // Кофейни
  { chain: 'Starbucks', category: 'Напитки', item: 'Латте гранд 450мл', kcal: 190, protein: 12, fat: 7, carbs: 18, athleteRating: 'ok', notes: 'Молоко даёт белок. Без сиропа.' },
  { chain: 'Starbucks', category: 'Еда', item: 'Протеиновая коробка (яйца+сыр+виноград)', kcal: 350, protein: 24, fat: 20, carbs: 18, athleteRating: 'excellent', notes: '24г белка! Идеальный перекус в кофейне.' },
];

export function getRestaurantGuide(): RestaurantItem[] { return RESTAURANT_DB; }
export function getRestaurantByChain(chain: string): RestaurantItem[] {
  return RESTAURANT_DB.filter(r => r.chain.toLowerCase().includes(chain.toLowerCase()));
}
export function getTopAthleteChoices(): RestaurantItem[] {
  return RESTAURANT_DB.filter(r => r.athleteRating === 'excellent');
}
export function getHighProteinRestaurant(minProtein: number = 25): RestaurantItem[] {
  return RESTAURANT_DB.filter(r => r.protein >= minProtein).sort((a, b) => b.protein - a.protein);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Travel Workouts (5 types)
// ═══════════════════════════════════════════════════════════════════════════

const TRAVEL_WORKOUTS: TravelWorkout[] = [
  {
    name: 'Bodyweight Hotel Room HIIT', durationMin: 25, equipment: [],
    exercises: [
      { name: 'Jumping Jacks', sets: 3, reps: '30', restSec: 30, notes: 'Разогрев' },
      { name: 'Push-Ups', sets: 4, reps: 'MAX-2', restSec: 45, notes: 'Грудь к полу. Разные позиции рук.' },
      { name: 'Bulgarian Split Squats', sets: 3, reps: '12/нога', restSec: 45, notes: 'Задняя нога на кровати/стуле. BW.' },
      { name: 'Pike Push-Ups', sets: 3, reps: 'MAX', restSec: 45, notes: 'Ноги на кровати. Имитация OHP.' },
      { name: 'Reverse Lunges', sets: 3, reps: '15/нога', restSec: 30, notes: 'Медленно вниз, взрыв вверх.' },
      { name: 'Plank Shoulder Taps', sets: 3, reps: '20', restSec: 30, notes: 'Стабильность кора.' },
      { name: 'Burpees', sets: 3, reps: '10', restSec: 45, notes: 'Финишер.' },
    ],
    warmup: ['Jumping Jacks 2 мин', 'Arm Circles', 'Leg Swings', 'Torso Twists'],
    cooldown: ['Quad Stretch', 'Hamstring Stretch', 'Chest Doorway Stretch', 'Child Pose'],
  },
  {
    name: 'Resistance Band Full Body', durationMin: 30, equipment: ['band_set'],
    exercises: [
      { name: 'Band Squats', sets: 4, reps: '15', restSec: 45, notes: 'Band под стопами, на плечах.' },
      { name: 'Band Chest Press', sets: 4, reps: '15', restSec: 45, notes: 'Band за спиной, держать за ручки.' },
      { name: 'Band Row', sets: 4, reps: '15', restSec: 45, notes: 'Band под стопами, тянуть к поясу.' },
      { name: 'Band Shoulder Press', sets: 3, reps: '12', restSec: 45, notes: 'Band под стопами, жим вверх.' },
      { name: 'Band Pull-Apart', sets: 3, reps: '20', restSec: 30, notes: 'Задние дельты, осанка.' },
      { name: 'Band Bicep Curl', sets: 3, reps: '15', restSec: 30, notes: 'Медленная эксцентрика.' },
      { name: 'Band Tricep Pushdown', sets: 3, reps: '15', restSec: 30, notes: 'Закрепить band над дверью.' },
    ],
    warmup: ['Band Pull-Apart 2×20', 'Band Good Morning 2×15', 'Bodyweight Squat 20'],
    cooldown: ['Band Shoulder Stretch', 'Band Hamstring Stretch'],
  },
  {
    name: 'Prison Cell Workout (Minimal Space)', durationMin: 20, equipment: [],
    exercises: [
      { name: 'Push-Up variations (normal/wide/diamond)', sets: 1, reps: '10 каждой', restSec: 30, notes: '3 вариации × 10 = 1 подход. 3 круга.' },
      { name: 'Prisoner Squats', sets: 3, reps: '25', restSec: 30, notes: 'Руки за голову. Полная амплитуда.' },
      { name: 'Tricep Dips (стул)', sets: 3, reps: 'MAX', restSec: 30, notes: 'Стул/кровать сзади.' },
      { name: 'Superman Hold', sets: 3, reps: '30 сек', restSec: 15, notes: 'Нижняя часть спины.' },
      { name: 'Lying Leg Raises', sets: 3, reps: '15', restSec: 30, notes: 'Руки под ягодицами.' },
      { name: 'Wall Sit', sets: 2, reps: '60 сек', restSec: 30, notes: 'Квадрицепсы горят.' },
    ],
    warmup: ['High Knees 1 мин', 'Arm Circles', 'Torso Rotations'],
    cooldown: ['Full body stretch on floor'],
  },
  {
    name: '15-Minute AMRAP (Park/Hotel)', durationMin: 15, equipment: [],
    exercises: [
      { name: 'Burpees', sets: 1, reps: 'AMRAP 15 мин', restSec: 0, notes: '10 Burpees → 15 Air Squats → 10 Push-Ups → 20 Mountain Climbers → Repeat' },
    ],
    warmup: ['Light jog 2 мин', 'Dynamic stretching'],
    cooldown: ['Walk 2 мин', 'Deep breathing'],
  },
  {
    name: 'TRX / Suspension Trainer', durationMin: 35, equipment: ['suspension_trainer'],
    exercises: [
      { name: 'TRX Row', sets: 4, reps: '12', restSec: 45, notes: 'Ноги ближе = тяжелее.' },
      { name: 'TRX Chest Press', sets: 4, reps: '12', restSec: 45, notes: 'Наклон вперёд.' },
      { name: 'TRX Pistol Squat (assisted)', sets: 3, reps: '8/нога', restSec: 45, notes: 'Держась за ручки для баланса.' },
      { name: 'TRX Y-Deltoid Fly', sets: 3, reps: '12', restSec: 30, notes: 'Задние дельты.' },
      { name: 'TRX Hamstring Curl', sets: 3, reps: '12', restSec: 30, notes: 'Лёжа, пятки в петлях.' },
      { name: 'TRX Bicep Curl', sets: 3, reps: '15', restSec: 30, notes: 'Одной рукой.' },
      { name: 'TRX Tricep Extension', sets: 3, reps: '12', restSec: 30, notes: 'Лицом от крепления.' },
    ],
    warmup: ['TRX-assisted squat 2×10', 'Scapular activation'],
    cooldown: ['TRX chest stretch', 'TRX lat stretch'],
  },
];

export function getTravelWorkouts(): TravelWorkout[] { return TRAVEL_WORKOUTS; }
export function getWorkoutByEquipment(hasBands: boolean, hasTRX: boolean, duration: number): TravelWorkout[] {
  let filtered = TRAVEL_WORKOUTS;
  if (!hasBands) filtered = filtered.filter(w => !w.equipment.includes('band_set'));
  if (!hasTRX) filtered = filtered.filter(w => !w.equipment.includes('suspension_trainer'));
  if (duration > 0) filtered = filtered.filter(w => w.durationMin <= duration);
  return filtered;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Sleep Optimization Stacks
// ═══════════════════════════════════════════════════════════════════════════

const SLEEP_STACKS: SleepStack[] = [
  {
    name: 'Базовый (для всех)', level: 'basic',
    supplements: [
      { name: 'Магний бисглицинат', dosage: '400 мг', timing: 'За 60 мин до сна', mechanism: 'Глицин + магний → расслабление ЦНС, GABA-рецепторы' },
      { name: 'Мелатонин', dosage: '3 мг', timing: 'За 30 мин до сна', mechanism: 'Гормон сна. Сигнал "пора спать" эпифизу.' },
    ],
    totalCost: '~800 ₽/мес',
    expectedEffect: 'Засыпание быстрее на 15-20 мин. Глубже сон. Просыпаться легче.',
  },
  {
    name: 'Продвинутый (Тренболон/стресс)', level: 'advanced',
    supplements: [
      { name: 'Магний бисглицинат', dosage: '600 мг', timing: 'За 60 мин', mechanism: 'Повышенная доза при GABA-антагонизме тренболона' },
      { name: 'Мелатонин', dosage: '5 мг', timing: 'За 30 мин', mechanism: 'Повышенная доза при инсомнии на тренболоне' },
      { name: 'Глицин', dosage: '3-5 г', timing: 'За 30 мин', mechanism: 'Тормозной нейротрансмиттер. Снижает температуру тела для сна.' },
      { name: 'L-теанин', dosage: '200-400 мг', timing: 'За 60 мин', mechanism: 'Альфа-волны мозга. Расслабление без седации.' },
      { name: 'Ашваганда KSM-66', dosage: '600 мг', timing: 'За 60 мин', mechanism: 'Снижение кортизола. Адаптоген.' },
    ],
    totalCost: '~2,500 ₽/мес',
    expectedEffect: 'Противодействие тренболоновой бессоннице. Засыпание за 15-20 мин. Меньше ночных пробуждений.',
  },
  {
    name: 'Экстремальный (соревновательный сон)', level: 'extreme',
    supplements: [
      { name: 'Магний бисглицинат', dosage: '600 мг', timing: 'За 60 мин', mechanism: 'Основа' },
      { name: 'Мелатонин', dosage: '5 мг', timing: 'За 30 мин', mechanism: 'Основной гормон' },
      { name: 'Глицин', dosage: '5 г', timing: 'За 30 мин', mechanism: 'Охлаждение тела' },
      { name: 'L-теанин', dosage: '400 мг', timing: 'За 60 мин', mechanism: 'Альфа-волны' },
      { name: 'Апигенин (ромашка)', dosage: '50-100 мг', timing: 'За 60 мин', mechanism: 'GABA-A агонист. Противовоспалительное.' },
      { name: 'Инозитол', dosage: '2-4 г', timing: 'За 60 мин', mechanism: 'Снижение тревожности, улучшение качества сна.' },
    ],
    totalCost: '~4,000 ₽/мес',
    expectedEffect: 'Максимальное качество сна. Для соревнований, тяжёлых циклов, восстановления.',
  },
];

export function getSleepStacks(): SleepStack[] { return SLEEP_STACKS; }
