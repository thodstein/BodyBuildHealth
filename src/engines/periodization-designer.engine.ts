/**
 * Periodization Designer + Goal Tracker + Habit Builder
 *
 * Periodization Designer: interactive mesocycle builder with drag-drop weeks
 * Goal Tracker: SMART goals with milestones, progress tracking, streak counting
 * Habit Builder: daily habit tracking with streaks and completion rates
 *
 * @module periodization-designer
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PeriodizationBlock {
  name: string;
  weeks: number;
  volumeLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  intensityLevel: 'low' | 'medium' | 'high' | 'very_high';
  frequencyDays: number;
  rpeTarget: number;
  rirTarget: number;
  focus: 'hypertrophy' | 'strength' | 'power' | 'peaking' | 'deload' | 'technique' | 'conditioning';
  description: string;
}

export interface MesocycleDesign {
  name: string;
  totalWeeks: number;
  blocks: PeriodizationBlock[];
  progressionModel: 'linear' | 'undulating' | 'block' | 'conjugate' | 'gpp_spp_peak';
  created: string;
}

export interface TrainingGoal {
  id: string;
  title: string;
  category: 'strength' | 'hypertrophy' | 'body_comp' | 'performance' | 'health' | 'habit';
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  targetDate: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'failed' | 'abandoned';
  progress: number; // 0-100%
  milestones: { value: number; date: string; achieved: boolean }[];
  notes: string;
}

export interface DailyHabit {
  id: string;
  name: string;
  category: 'nutrition' | 'training' | 'recovery' | 'mindset' | 'health';
  target: string;
  completions: { date: string; done: boolean; notes: string }[];
  streak: number;
  bestStreak: number;
  completionRate: number; // % last 30 days
}

export interface HabitStats {
  totalHabits: number;
  activeHabits: number;
  todayCompleted: number;
  todayTotal: number;
  weekCompletionRate: number;
  bestHabit: { name: string; streak: number };
  worstHabit: { name: string; streak: number };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Periodization Designer
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_TEMPLATES: Record<string, PeriodizationBlock> = {
  accumulation_hypertrophy: {
    name: 'Накопление (Гипертрофия)', weeks: 4,
    volumeLevel: 'high', intensityLevel: 'medium',
    frequencyDays: 4, rpeTarget: 7, rirTarget: 2.5,
    focus: 'hypertrophy',
    description: 'Высокий объём, 8-15 повторений. Много подсобки. Развитие мышечной выносливости.',
  },
  accumulation_strength: {
    name: 'Накопление (Сила)', weeks: 3,
    volumeLevel: 'medium', intensityLevel: 'medium',
    frequencyDays: 4, rpeTarget: 7.5, rirTarget: 2,
    focus: 'strength',
    description: 'Умеренный объём, 5-8 повторений. Фокус на технику и объём основных движений.',
  },
  intensification: {
    name: 'Интенсификация', weeks: 3,
    volumeLevel: 'medium', intensityLevel: 'high',
    frequencyDays: 4, rpeTarget: 8.5, rirTarget: 1,
    focus: 'strength',
    description: 'Снижение объёма, рост интенсивности. 3-5 повторений, высокие RPE.',
  },
  peaking: {
    name: 'Пик', weeks: 2,
    volumeLevel: 'low', intensityLevel: 'very_high',
    frequencyDays: 3, rpeTarget: 9, rirTarget: 0.5,
    focus: 'peaking',
    description: 'Минимальный объём, максимальная специфика. Синглы и двойки.',
  },
  deload: {
    name: 'Разгрузка', weeks: 1,
    volumeLevel: 'very_low', intensityLevel: 'low',
    frequencyDays: 3, rpeTarget: 5.5, rirTarget: 4,
    focus: 'deload',
    description: 'Восстановление ЦНС. 40-60% рабочих весов, мобильность.',
  },
  technique: {
    name: 'Технический блок', weeks: 2,
    volumeLevel: 'low', intensityLevel: 'low',
    frequencyDays: 5, rpeTarget: 6, rirTarget: 4,
    focus: 'technique',
    description: 'Низкая интенсивность, высокая частота. Темповые и паузные вариации.',
  },
  conditioning: {
    name: 'Кондиционный блок', weeks: 3,
    volumeLevel: 'high', intensityLevel: 'low',
    frequencyDays: 5, rpeTarget: 6, rirTarget: 3,
    focus: 'conditioning',
    description: 'Высокая плотность. Метконы, суперсеты, круговые тренировки.',
  },
  power: {
    name: 'Мощностной блок', weeks: 2,
    volumeLevel: 'low', intensityLevel: 'medium',
    frequencyDays: 3, rpeTarget: 7, rirTarget: 3,
    focus: 'power',
    description: 'Взрывная работа. 2-3 повторения с максимальной скоростью. VBT.',
  },
};

const PROGRESSION_MODELS = [
  { id: 'linear', name: 'Линейная периодизация', desc: 'Объём ↓, интенсивность ↑ от блока к блоку' },
  { id: 'undulating', name: 'Волновая (DUP)', desc: 'Сила/Гипертрофия/Мощность меняются ежедневно' },
  { id: 'block', name: 'Блочная', desc: 'Накопление → Трансформация → Реализация' },
  { id: 'conjugate', name: 'Сопряжённая (Westside)', desc: 'Max Effort + Dynamic Effort дни' },
  { id: 'gpp_spp_peak', name: 'GPP → SPP → Пик', desc: 'Общая подготовка → Специальная → Пик формы' },
];

export function getBlockTemplates(): PeriodizationBlock[] {
  return Object.values(BLOCK_TEMPLATES);
}

export function createMesocycle(name: string, blocks: string[], model: string): MesocycleDesign {
  const selectedBlocks = blocks.map(b => BLOCK_TEMPLATES[b] || BLOCK_TEMPLATES.accumulation_hypertrophy);
  return {
    name,
    totalWeeks: selectedBlocks.reduce((s, b) => s + b.weeks, 0),
    blocks: selectedBlocks,
    progressionModel: model as MesocycleDesign['progressionModel'],
    created: new Date().toISOString(),
  };
}

export function getProgressionModels() {
  return PROGRESSION_MODELS;
}

/** Generate a 12-week default periodization */
export function defaultPeriodization(goal: 'strength' | 'hypertrophy' | 'peaking'): MesocycleDesign {
  if (goal === 'hypertrophy') {
    return createMesocycle('12-недельная гипертрофия', [
      'accumulation_hypertrophy', 'accumulation_hypertrophy', 'deload',
      'accumulation_hypertrophy', 'intensification', 'deload',
    ], 'block');
  }
  if (goal === 'peaking') {
    return createMesocycle('12-недельный выход на пик', [
      'accumulation_strength', 'accumulation_strength', 'deload',
      'intensification', 'intensification', 'peaking', 'deload',
    ], 'gpp_spp_peak');
  }
  return createMesocycle('12-недельная сила', [
    'accumulation_strength', 'accumulation_strength', 'deload',
    'intensification', 'intensification', 'deload', 'peaking',
  ], 'block');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Goal Tracker
// ═══════════════════════════════════════════════════════════════════════════

const GOALS_KEY = 'he_training_goals';

export function loadGoals(): TrainingGoal[] {
  try { return JSON.parse(localStorage.getItem(GOALS_KEY) || '[]'); } catch { return []; }
}

function saveGoals(goals: TrainingGoal[]) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function createGoal(
  title: string, category: TrainingGoal['category'],
  targetValue: number, unit: string, targetDate: string,
): TrainingGoal {
  return {
    id: 'goal_' + Date.now(),
    title, category, targetValue, currentValue: 0, unit,
    startDate: new Date().toISOString().slice(0, 10),
    targetDate,
    status: 'not_started',
    progress: 0,
    milestones: [],
    notes: '',
  };
}

export function addGoal(goal: TrainingGoal): TrainingGoal[] {
  const goals = loadGoals();
  goals.push(goal);
  saveGoals(goals);
  return goals;
}

export function updateGoalProgress(id: string, currentValue: number): TrainingGoal[] {
  const goals = loadGoals();
  const idx = goals.findIndex(g => g.id === id);
  if (idx < 0) return goals;

  const goal = goals[idx];
  goal.currentValue = currentValue;
  goal.progress = Math.round(Math.min(100, (currentValue / goal.targetValue) * 100));

  if (goal.progress >= 100) goal.status = 'achieved';
  else if (goal.progress > 0) goal.status = 'in_progress';

  goals[idx] = goal;
  saveGoals(goals);
  return goals;
}

export function addMilestone(goalId: string, value: number): TrainingGoal[] {
  const goals = loadGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return goals;

  goal.milestones.push({ value, date: new Date().toISOString().slice(0, 10), achieved: false });
  saveGoals(goals);
  return goals;
}

export function checkMilestones(goalId: string): string[] {
  const goals = loadGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return [];

  const achieved: string[] = [];
  for (const m of goal.milestones) {
    if (!m.achieved && goal.currentValue >= m.value) {
      m.achieved = true;
      achieved.push(`🎯 Достигнут: ${m.value}${goal.unit}`);
    }
  }

  saveGoals(goals);
  return achieved;
}

export function getActiveGoals(): TrainingGoal[] {
  return loadGoals().filter(g => g.status !== 'achieved' && g.status !== 'abandoned');
}

export function getGoalStats(): { total: number; achieved: number; inProgress: number; abandoned: number } {
  const goals = loadGoals();
  return {
    total: goals.length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    inProgress: goals.filter(g => g.status === 'in_progress').length,
    abandoned: goals.filter(g => g.status === 'abandoned').length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Habit Builder
// ═══════════════════════════════════════════════════════════════════════════

const HABITS_KEY = 'he_habits';

const DEFAULT_HABITS: DailyHabit[] = [
  { id: 'water', name: 'Вода 3л+', category: 'nutrition', target: '3 литра', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
  { id: 'protein', name: 'Белок по норме', category: 'nutrition', target: '180г+', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
  { id: 'training', name: 'Тренировка', category: 'training', target: 'По плану', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
  { id: 'sleep', name: 'Сон 7.5ч+', category: 'recovery', target: '7.5+ часов', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
  { id: 'stretching', name: 'Растяжка 15мин', category: 'recovery', target: '15 минут', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
  { id: 'supplements', name: 'Все добавки', category: 'health', target: 'По списку', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
  { id: 'steps', name: '8000+ шагов', category: 'health', target: '8000 шагов', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
  { id: 'meditation', name: 'Медитация 10мин', category: 'mindset', target: '10 минут', completions: [], streak: 0, bestStreak: 0, completionRate: 0 },
];

export function loadHabits(): DailyHabit[] {
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_HABITS;
  } catch { return DEFAULT_HABITS; }
}

function saveHabits(habits: DailyHabit[]) {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

export function toggleHabit(habitId: string): DailyHabit[] {
  const habits = loadHabits();
  const today = new Date().toISOString().slice(0, 10);
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return habits;

  const existing = habit.completions.find(c => c.date === today);
  if (existing) {
    existing.done = !existing.done;
    existing.notes = existing.done ? '' : 'Пропущено';
  } else {
    habit.completions.push({ date: today, done: true, notes: '' });
  }

  // Recalculate streaks
  recalcStreaks(habits);

  saveHabits(habits);
  return habits;
}

function recalcStreaks(habits: DailyHabit[]) {
  for (const habit of habits) {
    const completions = [...habit.completions].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < completions.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);

      if (completions[i]?.date === expectedStr && completions[i].done) {
        streak++;
      } else if (i > 0 && completions[i]?.date !== expectedStr) {
        break;
      }
    }

    habit.streak = streak;
    if (streak > habit.bestStreak) habit.bestStreak = streak;

    // Completion rate (last 30 days)
    const last30 = completions.filter(c => {
      const d = new Date(c.date);
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 30);
      return d >= cutoff;
    });
    const done = last30.filter(c => c.done).length;
    habit.completionRate = last30.length > 0 ? Math.round((done / last30.length) * 100) : 0;
  }
}

export function addCustomHabit(name: string, category: DailyHabit['category'], target: string): DailyHabit[] {
  const habits = loadHabits();
  habits.push({
    id: 'habit_' + Date.now(),
    name, category, target, completions: [],
    streak: 0, bestStreak: 0, completionRate: 0,
  });
  saveHabits(habits);
  return habits;
}

export function getHabitStats(): HabitStats {
  const habits = loadHabits();
  const today = new Date().toISOString().slice(0, 10);

  let todayCompleted = 0;
  for (const h of habits) {
    if (h.completions.some(c => c.date === today && c.done)) todayCompleted++;
  }

  const sortedByStreak = [...habits].sort((a, b) => b.streak - a.streak);

  // Week completion rate
  const weekCompletions = habits.flatMap(h => h.completions.filter(c => {
    const d = new Date(c.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  }));
  const weekDone = weekCompletions.filter(c => c.done).length;
  const weekRate = weekCompletions.length > 0 ? Math.round((weekDone / weekCompletions.length) * 100) : 0;

  return {
    totalHabits: habits.length,
    activeHabits: habits.filter(h => h.completions.length > 0).length,
    todayCompleted,
    todayTotal: habits.length,
    weekCompletionRate: weekRate,
    bestHabit: sortedByStreak[0] ? { name: sortedByStreak[0].name, streak: sortedByStreak[0].streak } : { name: '', streak: 0 },
    worstHabit: sortedByStreak[sortedByStreak.length - 1] ? { name: sortedByStreak[sortedByStreak.length - 1].name, streak: sortedByStreak[sortedByStreak.length - 1].streak } : { name: '', streak: 0 },
  };
}
