/**
 * Training Psychology + Coaching + Meal Prep + Mobility + PR Tracker
 *
 * Psychology: mental toughness, motivation phases, burnout prevention
 * Coaching: automated feedback, cue generation, form analysis
 * Meal Prep: weekly plans, grocery lists, batch cooking schedules
 * Mobility: FMS-like assessments, corrective exercises, ROM standards
 * PR Tracker: PR history, attempt planning, peaking readiness score
 *
 * @module coaching-psychology-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MotivationPhase {
  phase: 'honeymoon' | 'grind' | 'plateau' | 'breakthrough' | 'burnout';
  description: string;
  duration: string;
  signs: string[];
  interventions: string[];
  trainingAdjustment: string;
}

export interface CoachingCue {
  exercise: string;
  error: string;
  cue: string;
  type: 'internal' | 'external' | 'tactile';
  explanation: string;
}

export interface GroceryList {
  category: string;
  items: { name: string; amount: string; notes: string }[];
}

export interface MealPrepPlan {
  days: number;
  meals: { name: string; recipe: string; prepTime: string; storageTime: string }[];
  groceryList: GroceryList[];
  cookingSchedule: { time: string; task: string; durationMin: number }[];
  totalPrepTime: number;
  costEstimate: string;
}

export interface MobilityAssessment {
  test: string;
  target: string;
  instructions: string;
  pass: string;
  fail: string;
  correctiveExercises: string[];
  relatedExercises: string[];
}

export interface PRRecord {
  exercise: string;
  date: string;
  weight: number;
  reps: number;
  rpe: number;
  estimated1RM: number;
  bodyWeight: number;
  category: 'absolute' | 'rep_pr' | 'volume_pr' | 'technique_pr';
  notes: string;
  video?: string;
}

export interface PRStats {
  totalPRs: number;
  prByExercise: Record<string, number>;
  recentPRs: PRRecord[];
  bestLifts: Record<string, PRRecord>;
  prStreak: number;
  daysSinceLastPR: number;
  projectedNextPR: Record<string, { date: string; weight: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Training Psychology & Motivation
// ═══════════════════════════════════════════════════════════════════════════

const MOTIVATION_PHASES: MotivationPhase[] = [
  {
    phase: 'honeymoon', description: 'Начало новой программы — высокая мотивация, excitement.',
    duration: 'Недели 1-3', signs: ['Жду тренировку', 'Лёгкий подъём весов', 'Много энергии', 'Ищу инфо'],
    interventions: ['Записывать прогресс', 'Фото до/после', 'Не повышать объём резко'],
    trainingAdjustment: 'Следовать программе. Не добавлять лишнее.',
  },
  {
    phase: 'grind', description: 'Рабочая фаза. Веса растут, но мотивация средняя.',
    duration: 'Недели 4-8', signs: ['Стабильные тренировки', 'Умеренная энергия', 'Иногда скучно'],
    interventions: ['Разнообразить музыку', 'Тренироваться с партнёром', 'Микро-цели на тренировку'],
    trainingAdjustment: 'Продолжать программу. Можно менять подсобку.',
  },
  {
    phase: 'plateau', description: 'Прогресс замедлился. Веса стоят.',
    duration: 'Недели 8-12', signs: ['Та же нагрузка 2+ недель', 'RPE растёт без прибавки', 'Сомнения в программе'],
    interventions: ['Deload неделя', 'Сменить прогрессию', 'Проверить питание/сон', 'Новая музыка/одежда'],
    trainingAdjustment: 'Deload → сменить стимул (объём↔интенсивность).',
  },
  {
    phase: 'breakthrough', description: 'После плато — новый уровень. Всё летит.',
    duration: 'Недели 1-3 после плато', signs: ['PRы каждую неделю', 'Лёгкие веса', 'Уверенность растёт'],
    interventions: ['Записывать всё', 'Соревноваться с прошлым собой', 'Делиться с сообществом'],
    trainingAdjustment: 'Ехать на волне. Не переусердствовать.',
  },
  {
    phase: 'burnout', description: 'Перетренированность или потеря интереса.',
    duration: 'Разное', signs: ['Нет желания идти в зал', 'Упадок сил', 'Раздражительность', 'Болезни'],
    interventions: ['Полный отдых 3-7 дней', 'Сменить активность (плавание, йога)', 'Пересмотреть цели'],
    trainingAdjustment: 'Отдых → deload → новая программа с низкого объёма.',
  },
];

export function getMotivationPhases(): MotivationPhase[] { return MOTIVATION_PHASES; }
export function identifyPhase(weeksInProgram: number, lastPRDaysAgo: number, motivationScore: number, fatigueScore: number): MotivationPhase {
  if (fatigueScore > 0.8 && motivationScore < 3) return MOTIVATION_PHASES[4]; // burnout
  if (lastPRDaysAgo > 21 && weeksInProgram > 6) return MOTIVATION_PHASES[2]; // plateau
  if (weeksInProgram <= 3 && motivationScore > 4) return MOTIVATION_PHASES[0]; // honeymoon
  if (lastPRDaysAgo < 7 && motivationScore > 4) return MOTIVATION_PHASES[3]; // breakthrough
  return MOTIVATION_PHASES[1]; // grind
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Automated Coaching Cues
// ═══════════════════════════════════════════════════════════════════════════

const COACHING_CUES_DB: CoachingCue[] = [
  { exercise: 'squat', error: 'knee_valgus', cue: 'Разорви пол ногами', type: 'external', explanation: 'Представьте что разрываете пол между стоп — колени уходят наружу автоматически.' },
  { exercise: 'squat', error: 'butt_wink', cue: 'Стоп! На глубине где спина прямая', type: 'internal', explanation: 'Не уходите глубже точки где таз начинает подворачиваться. Работайте над мобильностью.' },
  { exercise: 'squat', error: 'forward_lean', cue: 'Грудь — фара, светит вперёд', type: 'external', explanation: 'Представьте что у вас фонарь на груди — он должен светить вперёд, а не в пол.' },
  { exercise: 'squat', error: 'heels_up', cue: 'Пятки — корни дерева', type: 'external', explanation: 'Представьте что пятки — корни, уходящие в землю. Давление через всю стопу.' },
  { exercise: 'deadlift', error: 'rounding_back', cue: 'Покажите логотип на груди', type: 'external', explanation: 'Представьте что на груди логотип — покажите его перед собой. Грудь вверх.' },
  { exercise: 'deadlift', error: 'hips_rise_first', cue: 'Толкайте пол ногами', type: 'external', explanation: 'Движение начинается с ног, не со спины. Представьте leg press.' },
  { exercise: 'deadlift', error: 'bar_away', cue: 'Брейте голени грифом', type: 'tactile', explanation: 'Гриф должен касаться голеней и бёдер всё движение. Как бритва.' },
  { exercise: 'bench', error: 'elbows_flared', cue: 'Согните гриф (попытайтесь)', type: 'external', explanation: 'Попытка согнуть гриф автоматически опускает локти ближе к телу.' },
  { exercise: 'bench', error: 'no_leg_drive', cue: 'Толкайте себя от штанги', type: 'external', explanation: 'Вместо "толкать штангу" — толкайте себя назад в скамью ногами.' },
  { exercise: 'bench', error: 'shoulders_up', cue: 'Лопатки в задние карманы', type: 'internal', explanation: 'Опустите плечи и сведите лопатки — представьте что кладёте их в задние карманы джинсов.' },
  { exercise: 'ohp', error: 'leaning_back', cue: 'Сожмите ягодицы (100-долларовая купюра)', type: 'internal', explanation: 'Сожмите ягодицы так будто держите купюру. Это стабилизирует корпус.' },
  { exercise: 'ohp', error: 'incomplete_lockout', cue: 'Бицепсы к ушам', type: 'internal', explanation: 'В верхней точке бицепсы касаются ушей. Полный локаут.' },
  { exercise: 'pullup', error: 'kipping', cue: 'Ноги — мёртвый груз', type: 'internal', explanation: 'Ноги неподвижны, носки вниз. Всё движение — спина и руки.' },
  { exercise: 'pullup', error: 'half_rep', cue: 'Грудь к перекладине', type: 'external', explanation: 'Не подбородок — грудь! Тянитесь грудью к перекладине.' },
];

export function getCuesForError(exercise: string, error: string): CoachingCue[] {
  return COACHING_CUES_DB.filter(c => c.exercise === exercise && c.error === error);
}

export function getAllCoachingCues(): CoachingCue[] { return COACHING_CUES_DB; }

export function getCuesByType(type: 'internal' | 'external' | 'tactile'): CoachingCue[] {
  return COACHING_CUES_DB.filter(c => c.type === type);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Meal Prep Plans (3 complete plans)
// ═══════════════════════════════════════════════════════════════════════════

const MEAL_PREP_PLANS: MealPrepPlan[] = [
  {
    days: 5, totalPrepTime: 150, costEstimate: '~4,000-5,500 ₽',
    meals: [
      { name: 'Завтрак: Овсяноблины', recipe: 'Овсянка 400г + яйца 10 шт + протеин 150г = 5 порций', prepTime: '20 мин', storageTime: '5 дней в холодильнике' },
      { name: 'Обед: Курица с рисом', recipe: 'Курица 1кг + рис 500г + брокколи 1кг = 5 порций', prepTime: '30 мин', storageTime: '4-5 дней' },
      { name: 'Ужин: Индейка с гречкой', recipe: 'Индейка 1кг + гречка 500г + овощная смесь 1кг = 5 порций', prepTime: '30 мин', storageTime: '4-5 дней' },
      { name: 'Перекус: Творог + орехи', recipe: 'Творог 1кг + миндаль 150г + мёд = 5 порций', prepTime: '5 мин', storageTime: '5 дней' },
    ],
    groceryList: [
      { category: 'Мясо/Рыба', items: [{ name: 'Куриная грудка', amount: '1 кг', notes: 'Филе без кости' }, { name: 'Индейка филе', amount: '1 кг', notes: '' }] },
      { category: 'Крупы', items: [{ name: 'Рис басмати', amount: '500 г', notes: '' }, { name: 'Гречка', amount: '500 г', notes: '' }, { name: 'Овсяные хлопья', amount: '400 г', notes: 'Долгой варки' }] },
      { category: 'Молочное/Яйца', items: [{ name: 'Яйца', amount: '10 шт', notes: '' }, { name: 'Творог 5%', amount: '1 кг', notes: '' }] },
      { category: 'Овощи', items: [{ name: 'Брокколи', amount: '1 кг', notes: 'Замороженная ок' }, { name: 'Овощная смесь', amount: '1 кг', notes: '' }] },
      { category: 'Орехи/Добавки', items: [{ name: 'Миндаль', amount: '150 г', notes: '' }, { name: 'Протеин', amount: '150 г', notes: 'Любой вкус' }] },
    ],
    cookingSchedule: [
      { time: '13:00', task: 'Поставить вариться рис и гречку (2 кастрюли)', durationMin: 5 },
      { time: '13:05', task: 'Курицу нарезать, на сковороду. Специи.', durationMin: 5 },
      { time: '13:10', task: 'Индейку нарезать, на вторую сковороду.', durationMin: 5 },
      { time: '13:20', task: 'Брокколи в пароварку/микроволновку', durationMin: 2 },
      { time: '13:30', task: 'Овсяноблины: смешать в блендере, жарить', durationMin: 15 },
      { time: '13:45', task: 'Разложить по контейнерам: курица+рис, индейка+гречка', durationMin: 10 },
      { time: '14:00', task: 'Творог разложить по контейнерам, орехи отдельно', durationMin: 5 },
      { time: '14:10', task: 'Уборка кухни. Готово!', durationMin: 10 },
    ],
  },
  {
    days: 5, totalPrepTime: 120, costEstimate: '~5,000-7,000 ₽',
    meals: [
      { name: 'Завтрак: Яйца + тост + авокадо', recipe: 'Яйца 10 шт + хлеб + авокадо 3 шт = 5 порций', prepTime: '10 мин', storageTime: 'Яйца варить утром (5 мин)' },
      { name: 'Обед: Говядина с бурым рисом', recipe: 'Говяжий фарш 1кг + бурый рис 500г = 5 порций', prepTime: '25 мин', storageTime: '4-5 дней' },
      { name: 'Ужин: Лосось с бататом', recipe: 'Лосось 1кг + батат 1.5кг + спаржа = 5 порций', prepTime: '35 мин', storageTime: '3-4 дня' },
      { name: 'Перекус: Греческий йогурт + ягоды', recipe: 'Йогурт 1кг + замороженные ягоды 500г = 5 порций', prepTime: '5 мин', storageTime: '5 дней' },
    ],
    groceryList: [
      { category: 'Мясо/Рыба', items: [{ name: 'Говяжий фарш 5%', amount: '1 кг', notes: '' }, { name: 'Лосось', amount: '1 кг', notes: 'Филе' }] },
      { category: 'Крупы/Овощи', items: [{ name: 'Бурый рис', amount: '500 г', notes: '' }, { name: 'Батат', amount: '1.5 кг', notes: '' }, { name: 'Спаржа', amount: '300 г', notes: '' }] },
      { category: 'Молочное/Яйца', items: [{ name: 'Яйца', amount: '10 шт', notes: '' }, { name: 'Греческий йогурт', amount: '1 кг', notes: 'Без сахара' }, { name: 'Авокадо', amount: '3 шт', notes: '' }] },
      { category: 'Хлеб/Ягоды', items: [{ name: 'Цельнозерновой хлеб', amount: '1 буханка', notes: '' }, { name: 'Замороженные ягоды', amount: '500 г', notes: '' }] },
    ],
    cookingSchedule: [
      { time: '12:00', task: 'Батат в духовку 200°C на 40 мин (целиком или кубиками)', durationMin: 5 },
      { time: '12:05', task: 'Бурый рис вариться (25-30 мин)', durationMin: 2 },
      { time: '12:10', task: 'Говяжий фарш на сковороду с луком и специями', durationMin: 10 },
      { time: '12:40', task: 'Лосось в духовку (рядом с бататом) на 15 мин при 180°C', durationMin: 2 },
      { time: '12:55', task: 'Спаржа бланшировать 3 мин', durationMin: 3 },
      { time: '13:00', task: 'Разложить по контейнерам', durationMin: 10 },
    ],
  },
];

export function getMealPrepPlans(): MealPrepPlan[] { return MEAL_PREP_PLANS; }

// ═══════════════════════════════════════════════════════════════════════════
// 4. Mobility Assessment
// ═══════════════════════════════════════════════════════════════════════════

const MOBILITY_ASSESSMENTS: MobilityAssessment[] = [
  {
    test: 'Deep Squat (Overhead)', target: 'Присед с руками над головой, пятки на полу',
    instructions: 'Ноги на ширине плеч, руки прямые над головой (палка/ПВХ). Присесть максимально глубоко без отрыва пяток.',
    pass: 'Бёдра ниже параллели, пятки на полу, руки над головой (не падают вперёд), спина прямая.',
    fail: 'Пятки отрываются = голеностоп. Руки падают = плечи/грудной. Спина круглится = бёдра/поясница.',
    correctiveExercises: ['Ankle mobilization', 'Hip 90/90 stretch', 'Thoracic spine foam rolling', 'Goblet squat pause'],
    relatedExercises: ['Squat', 'Front Squat', 'Overhead Squat'],
  },
  {
    test: 'Thomas Test (Hip Flexor)', target: 'Полное разгибание бедра без компенсации',
    instructions: 'Лечь на край стола/скамьи. Одна нога свисает, вторую обхватить и прижать к груди.',
    pass: 'Свисающее бедро полностью касается стола. Колено сгибается на 80°+.',
    fail: 'Бедро не касается = tight hip flexor. Колено не сгибается = tight rectus femoris.',
    correctiveExercises: ['Couch stretch', 'Half-kneeling hip flexor stretch', 'Band hip distraction'],
    relatedExercises: ['Squat', 'Deadlift'],
  },
  {
    test: 'Shoulder Flexion Test', target: 'Руки вертикально вверх, бицепсы к ушам',
    instructions: 'Стоя спиной к стене (пятки/ягодицы/плечи/голова касаются). Поднять руки вверх.',
    pass: 'Запястья касаются стены без прогиба в пояснице.',
    fail: 'Не достаёт до стены = tight lats/pecs. Прогиб в пояснице = компенсация.',
    correctiveExercises: ['Lat stretch', 'Pec doorway stretch', 'Wall slides', 'Dead hang'],
    relatedExercises: ['OHP', 'Pull-up', 'Snatch'],
  },
  {
    test: 'Hip Hinge (Toe Touch)', target: 'Наклон вперёд с прямыми ногами, касание пола',
    instructions: 'Ноги вместе, колени прямые. Медленный наклон вперёд, руки к полу.',
    pass: 'Касание пола пальцами или ладонями без боли в пояснице.',
    fail: 'Не достаёт до пола = tight hamstrings. Боль в пояснице = disc issue/неправильный паттерн.',
    correctiveExercises: ['RDL (light)', 'Jefferson curl', 'Elephant walks', 'Band hamstring stretch'],
    relatedExercises: ['Deadlift', 'RDL', 'Good Morning'],
  },
  {
    test: 'Active Straight Leg Raise (ASLR)', target: 'Подъём прямой ноги лёжа, 90°+',
    instructions: 'Лёжа на спине. Одна нога прямая, поднимается максимально вверх. Вторая прямая на полу.',
    pass: 'Подъём >80° без сгибания колена и отрыва второй ноги.',
    fail: '<80° = tight hamstrings. Вторая нога отрывается = слабый кор.',
    correctiveExercises: ['Band hamstring stretch', 'Dead bug', 'Straight leg raise (active)'],
    relatedExercises: ['Deadlift', 'Squat depth', 'L-sit'],
  },
  {
    test: 'Thoracic Rotation', target: 'Ротация грудного отдела 45°+ в каждую сторону',
    instructions: 'Сидя на пятках (сейдза), одна рука за голову. Поворот в сторону без движения таза.',
    pass: 'Локоть уходит за противоположное плечо. Таз неподвижен.',
    fail: 'Движение в пояснице вместо грудного = компенсация.',
    correctiveExercises: ['Thread the needle', 'Open book stretch', 'Thoracic foam rolling'],
    relatedExercises: ['All rotational sports', 'Golf', 'Tennis'],
  },
];

export function getMobilityAssessments(): MobilityAssessment[] { return MOBILITY_ASSESSMENTS; }
export function getAssessment(testName: string): MobilityAssessment | undefined {
  return MOBILITY_ASSESSMENTS.find(a => a.test.toLowerCase().includes(testName.toLowerCase()));
}
export function getFailedCorrectives(failedTests: string[]): string[] {
  const exercises: string[] = [];
  for (const test of failedTests) {
    const assessment = getAssessment(test);
    if (assessment) exercises.push(...assessment.correctiveExercises);
  }
  return [...new Set(exercises)];
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. PR Tracker
// ═══════════════════════════════════════════════════════════════════════════

const PR_KEY = 'he_pr_tracker';

export function loadPRs(): PRRecord[] {
  try { return JSON.parse(localStorage.getItem(PR_KEY) || '[]'); } catch { return []; }
}

function savePRs(prs: PRRecord[]) {
  prs.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(PR_KEY, JSON.stringify(prs.slice(-500)));
}

export function recordPR(pr: Omit<PRRecord, 'date' | 'estimated1RM'>): PRRecord {
  const record: PRRecord = {
    ...pr,
    date: new Date().toISOString().slice(0, 10),
    estimated1RM: pr.reps > 0 ? Math.round(pr.weight * (1 + pr.reps / 30)) : pr.weight,
  };
  const prs = loadPRs();
  prs.push(record);
  savePRs(prs);
  return record;
}

export function getPRStats(): PRStats {
  const prs = loadPRs();
  const prByExercise: Record<string, number> = {};
  const bestLifts: Record<string, PRRecord> = {};

  for (const pr of prs) {
    prByExercise[pr.exercise] = (prByExercise[pr.exercise] || 0) + 1;
    if (!bestLifts[pr.exercise] || pr.estimated1RM > bestLifts[pr.exercise].estimated1RM) {
      bestLifts[pr.exercise] = pr;
    }
  }

  // PR streak (consecutive days with at least 1 PR)
  let streakCount = 0;
  let daysSince = 999;
  const today = new Date();
  const dates = [...new Set(prs.map(p => p.date))].sort().reverse();

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (dates[i] === expectedStr) streakCount++;
    else { daysSince = i; break; }
  }

  // Projected next PR
  const projected: Record<string, { date: string; weight: number }> = {};
  for (const [exercise, best] of Object.entries(bestLifts)) {
    const exercisePRs = prs.filter(p => p.exercise === exercise).sort((a, b) => a.date.localeCompare(b.date));
    if (exercisePRs.length < 2) continue;

    const first = exercisePRs[0];
    const last = exercisePRs[exercisePRs.length - 1];
    const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000;
    const kgPerDay = daysDiff > 0 ? (last.estimated1RM - first.estimated1RM) / daysDiff : 0;

    if (kgPerDay > 0) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + Math.round(2.5 / kgPerDay));
      projected[exercise] = { date: nextDate.toISOString().slice(0, 10), weight: Math.round(last.estimated1RM + 2.5) };
    }
  }

  return {
    totalPRs: prs.length,
    prByExercise,
    recentPRs: prs.slice(0, 10),
    bestLifts,
    prStreak: streakCount,
    daysSinceLastPR: daysSince < 999 ? daysSince : (prs.length > 0 ? Math.round((Date.now() - new Date(prs[0].date).getTime()) / 86400000) : 999),
    projectedNextPR: projected,
  };
}

export function getPRsByExercise(exercise: string): PRRecord[] {
  return loadPRs().filter(p => p.exercise.toLowerCase().includes(exercise.toLowerCase()));
}

export function isPR(exercise: string, weight: number, reps: number): boolean {
  const estimated = reps > 0 ? weight * (1 + reps / 30) : weight;
  const best = loadPRs()
    .filter(p => p.exercise.toLowerCase() === exercise.toLowerCase())
    .reduce((max, p) => Math.max(max, p.estimated1RM), 0);
  return estimated > best;
}
