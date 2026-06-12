/**
 * Goal System + Workout Timer + Gym Checklist + Rest Calculator
 *
 * Goal System: SMART goals, milestones, progress tracking, achievement
 * Workout Timer: EMOM, Tabata, HIIT, custom interval timers
 * Gym Checklist: pre-workout, during, post-workout checklists
 * Rest Calculator: optimal rest between sets, between exercises, between sessions
 * Music BPM Guide: optimal BPM for different training phases
 *
 * @module goal-timer-checklist-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SmartGoal {
  id: string;
  title: string;
  category: 'strength' | 'hypertrophy' | 'body_comp' | 'performance' | 'health' | 'habit' | 'skill' | 'competition';
  specific: string;
  measurable: { metric: string; startValue: number; targetValue: number; currentValue: number; unit: string };
  deadline: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'failed' | 'abandoned' | 'extended';
  progress: number;
  milestones: { value: number; date: string; achieved: boolean; celebration: string }[];
  notes: string;
  created: string;
  updated: string;
}

export interface WorkoutTimer {
  name: string;
  type: 'emom' | 'tabata' | 'hiit' | 'custom' | 'rest' | 'amrap';
  rounds: number;
  workSec: number;
  restSec: number;
  totalDurationMin: number;
  description: string;
}

export interface RestRecommendation {
  goal: string;
  intensity: string;
  exerciseType: string;
  optimalRestSec: number;
  range: string;
  atpRecovery: string;
  cnsRecovery: string;
  whenToExtend: string;
}

export interface GymChecklist {
  phase: string;
  items: { task: string; category: 'nutrition' | 'equipment' | 'mindset' | 'warmup' | 'recovery' | 'logistics'; priority: 'critical' | 'important' | 'optional' }[];
}

export interface BPMGuide {
  trainingPhase: string;
  bpmRange: string;
  genres: string[];
  exampleArtists: string[];
  energyLevel: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. SMART Goals System
// ═══════════════════════════════════════════════════════════════════════════

const GOALS_KEY = 'he_smart_goals';

export function loadGoals(): SmartGoal[] {
  try { return JSON.parse(localStorage.getItem(GOALS_KEY) || '[]'); } catch { return []; }
}
function saveGoals(goals: SmartGoal[]) { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)); }

export function createGoal(
  title: string, category: SmartGoal['category'], targetValue: number, unit: string, deadline: string, milestones: number[] = [],
): SmartGoal {
  return {
    id: 'goal_' + Date.now(), title, category,
    specific: '', measurable: { metric: '', startValue: 0, targetValue, currentValue: 0, unit },
    deadline, status: 'not_started', progress: 0,
    milestones: milestones.map(v => ({ value: v, date: '', achieved: false, celebration: '' })),
    notes: '', created: new Date().toISOString(), updated: new Date().toISOString(),
  };
}

export function addGoal(goal: SmartGoal): SmartGoal[] { const g = loadGoals(); g.push(goal); saveGoals(g); return g; }

export function updateGoalProgress(id: string, currentValue: number): SmartGoal[] {
  const goals = loadGoals(); const idx = goals.findIndex(g => g.id === id);
  if (idx < 0) return goals; const g = goals[idx];
  g.measurable.currentValue = currentValue;
  g.progress = Math.round(Math.min(100, (currentValue - g.measurable.startValue) / (g.measurable.targetValue - g.measurable.startValue) * 100));
  if (g.progress >= 100) g.status = 'achieved'; else if (g.progress > 0) g.status = 'in_progress';
  g.updated = new Date().toISOString();
  for (const m of g.milestones) { if (!m.achieved && currentValue >= m.value) { m.achieved = true; m.date = new Date().toISOString().slice(0, 10); } }
  goals[idx] = g; saveGoals(goals); return goals;
}

export function getGoalStats(): { total: number; achieved: number; inProgress: number; failed: number; activeStreak: number } {
  const goals = loadGoals();
  return {
    total: goals.length, achieved: goals.filter(g => g.status === 'achieved').length,
    inProgress: goals.filter(g => g.status === 'in_progress').length,
    failed: goals.filter(g => g.status === 'failed').length, activeStreak: 0,
  };
}

export function getActiveGoals(): SmartGoal[] { return loadGoals().filter(g => g.status === 'in_progress' || g.status === 'not_started'); }
export function getAchievedGoals(): SmartGoal[] { return loadGoals().filter(g => g.status === 'achieved').sort((a, b) => b.updated.localeCompare(a.updated)); }

// ═══════════════════════════════════════════════════════════════════════════
// 2. Workout Timer Presets
// ═══════════════════════════════════════════════════════════════════════════

const WORKOUT_TIMERS: WorkoutTimer[] = [
  { name: 'EMOM 10 (Every Minute On the Minute)', type: 'emom', rounds: 10, workSec: 0, restSec: 0, totalDurationMin: 10, description: 'Каждую минуту начинаете новый подход. Сколько осталось — ваш отдых. Идеально для кондиции.' },
  { name: 'EMOM 20', type: 'emom', rounds: 20, workSec: 0, restSec: 0, totalDurationMin: 20, description: '20 минут EMOM. Выносливость + плотность.' },
  { name: 'Tabata (классика)', type: 'tabata', rounds: 8, workSec: 20, restSec: 10, totalDurationMin: 4, description: '8 раундов: 20 сек работа / 10 сек отдых. Максимальная интенсивность.' },
  { name: 'Tabata Pro (16 раундов)', type: 'tabata', rounds: 16, workSec: 20, restSec: 10, totalDurationMin: 8, description: 'Двойная Tabata. 16 раундов ада.' },
  { name: 'HIIT 30/30', type: 'hiit', rounds: 10, workSec: 30, restSec: 30, totalDurationMin: 10, description: '30 сек работа / 30 сек отдых. Умеренная интервальная.' },
  { name: 'HIIT 40/20', type: 'hiit', rounds: 8, workSec: 40, restSec: 20, totalDurationMin: 8, description: '40 сек работа / 20 сек отдых. Высокая интенсивность.' },
  { name: 'HIIT 60/30 (продвинутый)', type: 'hiit', rounds: 10, workSec: 60, restSec: 30, totalDurationMin: 15, description: 'Минута работы, 30 сек отдых. Требует подготовки.' },
  { name: 'Rest Timer: 2 мин', type: 'rest', rounds: 1, workSec: 120, restSec: 0, totalDurationMin: 2, description: 'Отдых 2 минуты между подходами (сила).' },
  { name: 'Rest Timer: 3 мин', type: 'rest', rounds: 1, workSec: 180, restSec: 0, totalDurationMin: 3, description: 'Отдых 3 минуты (тяжёлые compound).' },
  { name: 'Rest Timer: 90 сек', type: 'rest', rounds: 1, workSec: 90, restSec: 0, totalDurationMin: 1.5, description: 'Отдых 90 сек (гипертрофия).' },
  { name: 'Rest Timer: 60 сек', type: 'rest', rounds: 1, workSec: 60, restSec: 0, totalDurationMin: 1, description: 'Отдых 60 сек (памп/изоляция).' },
  { name: 'AMRAP 10', type: 'amrap', rounds: 1, workSec: 600, restSec: 0, totalDurationMin: 10, description: 'As Many Rounds As Possible за 10 минут.' },
  { name: 'AMRAP 20', type: 'amrap', rounds: 1, workSec: 1200, restSec: 0, totalDurationMin: 20, description: 'AMRAP 20 минут. Кроссфит-стиль.' },
];

export function getWorkoutTimers(): WorkoutTimer[] { return WORKOUT_TIMERS; }
export function getTimersByType(type: string): WorkoutTimer[] { return WORKOUT_TIMERS.filter(t => t.type === type); }

// ═══════════════════════════════════════════════════════════════════════════
// 3. Rest Recommendations by Goal
// ═══════════════════════════════════════════════════════════════════════════

const REST_RECOMMENDATIONS: RestRecommendation[] = [
  { goal: 'strength', intensity: '85-100% 1RM', exerciseType: 'Compound (S/B/D)', optimalRestSec: 180, range: '120-300', atpRecovery: '3-5 минут для 95%+ ATP', cnsRecovery: 'ЦНС: 5-8 минут при 95%+', whenToExtend: 'RPE >9. Не готовы ментально. Скорость грифа упала.' },
  { goal: 'strength', intensity: '80-90% 1RM', exerciseType: 'Compound (S/B/D)', optimalRestSec: 150, range: '120-180', atpRecovery: '2-3 минуты', cnsRecovery: 'ЦНС: 3-5 минут', whenToExtend: 'Последние подходы.' },
  { goal: 'hypertrophy', intensity: '65-80% 1RM', exerciseType: 'Compound', optimalRestSec: 90, range: '60-120', atpRecovery: '1.5-2 минуты', cnsRecovery: 'Умеренная', whenToExtend: 'Тяжёлый день. RPE >8.' },
  { goal: 'hypertrophy', intensity: '60-75% 1RM', exerciseType: 'Isolation', optimalRestSec: 60, range: '45-90', atpRecovery: '1 минута', cnsRecovery: 'Низкая', whenToExtend: 'Drop sets — меньше отдыха. Heavy — больше.' },
  { goal: 'hypertrophy', intensity: '50-70% 1RM', exerciseType: 'Pump/Metabolic', optimalRestSec: 45, range: '30-60', atpRecovery: '30-60 сек', cnsRecovery: 'Минимальная', whenToExtend: 'При падении производительности >20%.' },
  { goal: 'endurance', intensity: '40-60% 1RM', exerciseType: 'All', optimalRestSec: 30, range: '15-45', atpRecovery: 'Минимальная', cnsRecovery: 'Нет', whenToExtend: 'Потеря формы.' },
  { goal: 'power', intensity: '50-70% 1RM + speed', exerciseType: 'Dynamic Effort', optimalRestSec: 60, range: '45-90', atpRecovery: '1 минута', cnsRecovery: 'Умеренная', whenToExtend: 'Скорость упала >10%.' },
];

export function getRestRecommendation(goal: string, intensity: string): RestRecommendation | undefined {
  return REST_RECOMMENDATIONS.find(r => r.goal === goal && r.intensity.includes(intensity.replace('%', '')));
}

export function getOptimalRest(goal: string, isCompound: boolean, rpe: number): number {
  let base = 120;
  if (goal === 'strength') base = rpe >= 9 ? 240 : rpe >= 8 ? 180 : 120;
  else if (goal === 'hypertrophy') base = isCompound ? 90 : 60;
  else if (goal === 'endurance') base = 30;
  else if (goal === 'power') base = 60;
  return base;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Gym Checklists
// ═══════════════════════════════════════════════════════════════════════════

const GYM_CHECKLISTS: GymChecklist[] = [
  {
    phase: 'Вечер перед тренировкой',
    items: [
      { task: 'Подготовить сумку: форма, обувь, пояс, бинты, наколенники', category: 'equipment', priority: 'critical' },
      { task: 'Подготовить pre-workout питание (если утром)', category: 'nutrition', priority: 'important' },
      { task: 'Проверить программу на завтра — знать свои веса', category: 'mindset', priority: 'important' },
      { task: 'Лечь спать до 23:00', category: 'recovery', priority: 'critical' },
      { task: 'Зарядить наушники/телефон', category: 'logistics', priority: 'optional' },
    ],
  },
  {
    phase: 'Утро перед тренировкой',
    items: [
      { task: 'Стакан воды сразу после пробуждения', category: 'nutrition', priority: 'critical' },
      { task: 'Лёгкий завтрак за 60-90 мин (овсянка + яйца или протеин)', category: 'nutrition', priority: 'critical' },
      { task: 'Кофеин 200-400 мг за 45-60 мин (опционально)', category: 'nutrition', priority: 'optional' },
      { task: 'Туалет (серьёзно — присед с полным кишечником = катастрофа)', category: 'logistics', priority: 'critical' },
      { task: 'Проверить программу — ментально пройти тренировку', category: 'mindset', priority: 'important' },
    ],
  },
  {
    phase: 'В раздевалке / перед разминкой',
    items: [
      { task: 'Переодеться, проверить всё на месте', category: 'equipment', priority: 'critical' },
      { task: 'Нанести магнезию / мел на руки (тяга)', category: 'equipment', priority: 'important' },
      { task: 'Налить воду + BCAA/EAA в бутылку', category: 'nutrition', priority: 'important' },
      { task: 'Включить музыку/наушники', category: 'mindset', priority: 'important' },
      { task: '5 мин кардио-разогрев (вело/дорожка)', category: 'warmup', priority: 'critical' },
    ],
  },
  {
    phase: 'Разминка',
    items: [
      { task: 'Динамическая растяжка целевых групп', category: 'warmup', priority: 'critical' },
      { task: 'Активация: band pull-apart (верх), clamshell (низ)', category: 'warmup', priority: 'important' },
      { task: 'Специфическая разминка: пустой гриф ×10-15', category: 'warmup', priority: 'critical' },
      { task: 'Ramp-up подходы: 40%×5, 60%×3, 75%×1', category: 'warmup', priority: 'critical' },
    ],
  },
  {
    phase: 'Во время тренировки',
    items: [
      { task: 'Телефон в режим "не беспокоить"', category: 'mindset', priority: 'critical' },
      { task: 'Записывать подходы (вес × повторения × RPE)', category: 'logistics', priority: 'critical' },
      { task: 'Пить воду каждые 10-15 минут', category: 'nutrition', priority: 'critical' },
      { task: 'Соблюдать время отдыха (таймер на телефоне)', category: 'logistics', priority: 'important' },
      { task: 'Следить за техникой — видео при необходимости', category: 'mindset', priority: 'important' },
      { task: 'Убирать веса за собой (не будьте тем парнем)', category: 'logistics', priority: 'critical' },
    ],
  },
  {
    phase: 'После тренировки',
    items: [
      { task: 'Post-workout shake в течение 30 мин (протеин + углеводы)', category: 'nutrition', priority: 'critical' },
      { task: 'Статическая растяжка нагруженных групп (10-15 мин)', category: 'recovery', priority: 'important' },
      { task: 'Душ (контрастный для восстановления)', category: 'recovery', priority: 'optional' },
      { task: 'Полноценный приём пищи через 60-90 мин', category: 'nutrition', priority: 'critical' },
      { task: 'Записать заметки о тренировке (что шло, что нет)', category: 'logistics', priority: 'important' },
    ],
  },
];

export function getGymChecklists(): GymChecklist[] { return GYM_CHECKLISTS; }

// ═══════════════════════════════════════════════════════════════════════════
// 5. Music BPM Guide
// ═══════════════════════════════════════════════════════════════════════════

const BPM_GUIDE: BPMGuide[] = [
  { trainingPhase: 'Разминка / Кардио', bpmRange: '120-140', genres: ['House', 'EDM', 'Pop'], exampleArtists: ['Calvin Harris', 'Avicii', 'Daft Punk'], energyLevel: 'Средняя' },
  { trainingPhase: 'Силовая работа (80-95% 1RM)', bpmRange: '140-160', genres: ['Hard Rock', 'Metal', 'Trap'], exampleArtists: ['Metallica', 'Rammstein', 'Travis Scott'], energyLevel: 'Высокая' },
  { trainingPhase: 'Гипертрофия / Памп', bpmRange: '130-150', genres: ['Hip-Hop', 'Rap', 'Phonk'], exampleArtists: ['Drake', 'Kendrick', 'Kordhell'], energyLevel: 'Средне-высокая' },
  { trainingPhase: 'Пик / PR попытка', bpmRange: '150-180', genres: ['Death Metal', 'Hardstyle', 'Dubstep'], exampleArtists: ['Slaughter to Prevail', 'Headhunterz', 'Skrillex'], energyLevel: 'Максимальная' },
  { trainingPhase: 'Заминка / Растяжка', bpmRange: '60-100', genres: ['Ambient', 'Lo-Fi', 'Classical'], exampleArtists: ['Brian Eno', 'Chopin', 'Lo-Fi Girl'], energyLevel: 'Низкая' },
  { trainingPhase: 'Кардио LISS', bpmRange: '100-130', genres: ['Deep House', 'Chillwave', 'Reggae'], exampleArtists: ['Kygo', 'Tycho', 'Bob Marley'], energyLevel: 'Низкая-средняя' },
];

export function getBPMGuide(): BPMGuide[] { return BPM_GUIDE; }
export function getBPMByPhase(phase: string): BPMGuide | undefined { return BPM_GUIDE.find(b => b.trainingPhase.includes(phase)); }

// ═══════════════════════════════════════════════════════════════════════════
// 6. Between-Session Recovery Guide
// ═══════════════════════════════════════════════════════════════════════════

export function getRecoveryHours(sessionDifficulty: number, sleepQuality: number): number {
  const base = 24 + sessionDifficulty * 3;
  const modifier = 1.5 - sleepQuality * 0.15;
  return Math.round(base * modifier);
}

export function canTrainToday(lastSessionHours: number, sessionDifficulty: number, sleepQuality: number, subjectiveReadiness: number): { canTrain: boolean; intensityMod: number; message: string } {
  const needed = getRecoveryHours(sessionDifficulty, sleepQuality);
  if (lastSessionHours < needed * 0.5) return { canTrain: false, intensityMod: 0, message: `Недостаточно восстановления. Нужно ${needed}ч, прошло ${lastSessionHours}ч.` };
  if (lastSessionHours < needed * 0.8 && subjectiveReadiness < 5) return { canTrain: true, intensityMod: -0.15, message: `Частичное восстановление. Снизьте интенсивность на 15%.` };
  if (subjectiveReadiness >= 7 && lastSessionHours >= needed) return { canTrain: true, intensityMod: 0.05, message: 'Отличное восстановление. Можно увеличить нагрузку.' };
  return { canTrain: true, intensityMod: 0, message: 'Готов к тренировке.' };
}
