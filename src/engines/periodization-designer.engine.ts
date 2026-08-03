/**
 * Periodization Designer + Visual Macrocycle Builder
 *
 * Visual designer: drag-drop phase blocks onto a timeline canvas (1-52 weeks)
 * Goal Tracker: SMART goals with milestones, progress tracking, streak counting
 * Habit Builder: daily habit tracking with streaks and completion rates
 *
 * @module periodization-designer
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types — Visual Designer
// ═══════════════════════════════════════════════════════════════════════════

export type PhaseKey =
  | 'accumulation_hypertrophy' | 'accumulation_strength'
  | 'intensification' | 'peaking' | 'deload' | 'technique'
  | 'conditioning' | 'power' | 'gpp' | 'transition';

export const PHASE_COLORS: Record<PhaseKey, string> = {
  accumulation_hypertrophy: '#3b82f6',
  accumulation_strength: '#2563eb',
  intensification: '#ef4444',
  peaking: '#f59e0b',
  deload: '#00e68a',
  technique: '#a855f7',
  conditioning: '#ec4899',
  power: '#f97316',
  gpp: '#6366f1',
  transition: '#6b7280',
};

export const PHASE_ICONS: Record<PhaseKey, string> = {
  accumulation_hypertrophy: '💪',
  accumulation_strength: '🏋️',
  intensification: '🔥',
  peaking: '⚡',
  deload: '🧘',
  technique: '🎯',
  conditioning: '🏃',
  power: '💥',
  gpp: '🔄',
  transition: '⏸',
};

export const PHASE_LABELS_RU: Record<PhaseKey, string> = {
  accumulation_hypertrophy: 'Накопление (гипертрофия)',
  accumulation_strength: 'Накопление (сила)',
  intensification: 'Интенсификация',
  peaking: 'Пик',
  deload: 'Разгрузка',
  technique: 'Технический блок',
  conditioning: 'Кондиционный блок',
  power: 'Мощностной блок',
  gpp: 'GPP (общая подготовка)',
  transition: 'Переходный период',
};

export interface DesignerPhaseBlock {
  id: string;
  phaseKey: PhaseKey;
  startWeek: number;  // 1-based
  endWeek: number;    // inclusive
  notes: string;
}

export interface MacrocycleDesign {
  id: string;
  name: string;
  totalWeeks: number;
  blocks: DesignerPhaseBlock[];
  sport: 'powerlifting' | 'bodybuilding' | 'general' | 'weightlifting' | 'crossfit';
  goal: 'strength' | 'hypertrophy' | 'peaking' | 'conditioning';
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Existing types (unchanged)
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
// 1. Visual Designer — timeline functions
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'he_macrocycle_designs';

export function createEmptyDesign(name?: string): MacrocycleDesign {
  return {
    id: 'design_' + Date.now(),
    name: name || 'Новый макроцикл',
    totalWeeks: 52,
    blocks: [],
    sport: 'general',
    goal: 'strength',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadDesigns(): MacrocycleDesign[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export function saveDesign(design: MacrocycleDesign): MacrocycleDesign[] {
  const list = loadDesigns();
  const idx = list.findIndex(d => d.id === design.id);
  design.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = design; else list.push(design);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function deleteDesign(id: string): MacrocycleDesign[] {
  const list = loadDesigns().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}


/** Check if a new block would overlap existing blocks. */
function checkBlockOverlap(
  blocks: DesignerPhaseBlock[],
  startWeek: number,
  endWeek: number,
  excludeId?: string,
): DesignerPhaseBlock[] {
  return blocks.filter(
    (b) => b.id !== excludeId && startWeek <= b.endWeek && endWeek >= b.startWeek,
  );
}

function setOverlapNotes(block: DesignerPhaseBlock, overlaps: DesignerPhaseBlock[]): DesignerPhaseBlock {
  const userNotes = block.notes.replace(/\s*\[OVERLAP:[^\]]*\]/g, '').trim();
  const overlapNotes = overlaps.length > 0
    ? `[OVERLAP: ${overlaps.map((b) => b.phaseKey + ' ' + b.startWeek + '-' + b.endWeek).join(', ')}]`
    : '';
  return { ...block, notes: [userNotes, overlapNotes].filter(Boolean).join(' ') };
}

export function addBlockToDesign(design: MacrocycleDesign, phaseKey: PhaseKey, startWeek: number): MacrocycleDesign {
  const block = getPhaseTemplate(phaseKey);
  if (!block) return design;
  const endWeek = Math.min(startWeek + block.weeks - 1, design.totalWeeks);
  const newBlock: DesignerPhaseBlock = {
    id: 'blk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    phaseKey, startWeek, endWeek, notes: '',
  };
  // P0-2: warn if overlapping existing blocks (UI should prevent this, but engine enforces)
  const overlaps = checkBlockOverlap(design.blocks, newBlock.startWeek, newBlock.endWeek);
  const markedBlock = setOverlapNotes(newBlock, overlaps);
  return { ...design, blocks: [...design.blocks, markedBlock].sort((a, b) => a.startWeek - b.startWeek), updatedAt: new Date().toISOString() };
}

export function removeBlockFromDesign(design: MacrocycleDesign, blockId: string): MacrocycleDesign {
  return { ...design, blocks: design.blocks.filter(b => b.id !== blockId), updatedAt: new Date().toISOString() };
}

export function moveBlockInDesign(design: MacrocycleDesign, blockId: string, newStart: number): MacrocycleDesign {
  const idx = design.blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return design;
  const block = design.blocks[idx];
  const dur = block.endWeek - block.startWeek + 1;
  const endWeek = Math.min(newStart + dur - 1, design.totalWeeks);
  const updated: DesignerPhaseBlock = { ...block, startWeek: Math.max(1, newStart), endWeek };
  const blocks = [...design.blocks];
  const moveOverlaps = checkBlockOverlap(blocks.filter((b) => b.id !== blockId), updated.startWeek, updated.endWeek);
  blocks[idx] = setOverlapNotes(updated, moveOverlaps);
  return { ...design, blocks: blocks.sort((a, b) => a.startWeek - b.startWeek), updatedAt: new Date().toISOString() };
}

/** Сдвинуть пересекающиеся блоки вправо, сохранив их исходный порядок и длительность. */
export function resolveDesignOverlaps(design: MacrocycleDesign): MacrocycleDesign {
  const sorted = [...design.blocks].sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek);
  const resolved: DesignerPhaseBlock[] = [];
  let previousEnd = 0;
  for (const block of sorted) {
    const duration = Math.max(1, block.endWeek - block.startWeek + 1);
    const startWeek = Math.max(1, previousEnd + 1, block.startWeek);
    const endWeek = Math.min(design.totalWeeks, startWeek + duration - 1);
    const next = setOverlapNotes({ ...block, startWeek, endWeek }, resolved);
    resolved.push(next);
    previousEnd = endWeek;
  }
  return { ...design, blocks: resolved, updatedAt: new Date().toISOString() };
}

export function resizeBlockInDesign(design: MacrocycleDesign, blockId: string, newEndWeek: number): MacrocycleDesign {
  const idx = design.blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return design;
  const block = design.blocks[idx];
  const endWeek = Math.max(block.startWeek, Math.min(newEndWeek, design.totalWeeks));
  const updated: DesignerPhaseBlock = { ...block, endWeek };
  const blocks = [...design.blocks];
  blocks[idx] = setOverlapNotes(updated, checkBlockOverlap(blocks.filter((b) => b.id !== blockId), updated.startWeek, updated.endWeek));
  return { ...design, blocks: blocks.sort((a, b) => a.startWeek - b.startWeek), updatedAt: new Date().toISOString() };
}

export function updateBlockNotes(design: MacrocycleDesign, blockId: string, notes: string): MacrocycleDesign {
  const idx = design.blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return design;
  const blocks = [...design.blocks];
  blocks[idx] = { ...blocks[idx], notes };
  return { ...design, blocks, updatedAt: new Date().toISOString() };
}

export function getDesignStats(design: MacrocycleDesign) {
  const totalWeeks = design.totalWeeks;
  const usedWeeks = design.blocks.reduce((s, b) => s + (b.endWeek - b.startWeek + 1), 0);
  const freeWeeks = totalWeeks - usedWeeks;
  const phaseCount: Record<string, number> = {};
  for (const b of design.blocks) {
    phaseCount[b.phaseKey] = (phaseCount[b.phaseKey] || 0) + 1;
  }
  // P1-2: detect gaps (uncovered weeks) and overlaps
  const covered = new Set<number>();
  const overlaps: Array<{ a: string; b: string; week: number }> = [];
  for (const b of design.blocks) {
    for (let w = b.startWeek; w <= b.endWeek; w++) {
      if (covered.has(w)) {
        // find the other block covering this week
        const other = design.blocks.find((ob) => ob.id !== b.id && w >= ob.startWeek && w <= ob.endWeek);
        if (other) overlaps.push({ a: b.phaseKey, b: other.phaseKey, week: w });
      }
      covered.add(w);
    }
  }
  const gapWeeks: number[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    if (!covered.has(w)) gapWeeks.push(w);
  }
  // Consolidate consecutive gap weeks into ranges
  const gapRanges: string[] = [];
  if (gapWeeks.length > 0) {
    let start = gapWeeks[0], prev = gapWeeks[0];
    for (let i = 1; i < gapWeeks.length; i++) {
      if (gapWeeks[i] === prev + 1) { prev = gapWeeks[i]; }
      else { gapRanges.push(start === prev ? String(start) : start + '-' + prev); start = gapWeeks[i]; prev = gapWeeks[i]; }
    }
    gapRanges.push(start === prev ? String(start) : start + '-' + prev);
  }
  return { totalWeeks, usedWeeks, freeWeeks, blockCount: design.blocks.length, phaseCount, overlapWeeks: overlaps.length, gapRanges, warnings: [...gapRanges.map((g) => '  ' + g + '  '), ...overlaps.map((o) => ' ' + o.a + '  ' + o.b + '  ' + o.week + '-')] };
}

export function getDefaultPresetDesigns(): MacrocycleDesign[] {
  return [
    createFromPhases('Классический 12-нед (сила)', 12, ['accumulation_strength', 'accumulation_strength', 'deload', 'intensification', 'intensification', 'deload', 'peaking', 'deload'], 'powerlifting', 'strength'),
    createFromPhases('Классический 16-нед (гипертрофия)', 16, ['accumulation_hypertrophy', 'accumulation_hypertrophy', 'deload', 'accumulation_hypertrophy', 'intensification', 'deload', 'accumulation_hypertrophy', 'intensification', 'deload', 'peaking', 'deload'], 'bodybuilding', 'hypertrophy'),
    createFromPhases('52-нед годовой план', 52, ['gpp', 'gpp', 'accumulation_strength', 'accumulation_strength', 'deload', 'intensification', 'intensification', 'deload', 'peaking', 'deload', 'transition', 'gpp', 'accumulation_hypertrophy', 'accumulation_hypertrophy', 'deload', 'intensification', 'intensification', 'deload', 'peaking', 'deload', 'transition'], 'general', 'strength'),
    createFromPhases('Блочная 8-нед (Issurin)', 8, ['accumulation_hypertrophy', 'intensification', 'peaking'], 'powerlifting', 'peaking'),
  ];
}

function createFromPhases(name: string, totalWeeks: number, phaseKeys: PhaseKey[], sport: MacrocycleDesign['sport'], goal: MacrocycleDesign['goal']): MacrocycleDesign {
  const design = createEmptyDesign(name);
  design.totalWeeks = totalWeeks;
  design.sport = sport;
  design.goal = goal;
  let cursor = 1;
  for (const pk of phaseKeys) {
    const tmpl = getPhaseTemplate(pk);
    if (!tmpl) continue;
    const end = cursor + tmpl.weeks - 1;
    if (end > totalWeeks) break;
    design.blocks.push({
      id: 'blk_' + pk + '_' + cursor,
      phaseKey: pk, startWeek: cursor, endWeek: end, notes: '',
    });
    cursor = end + 1;
  }
  return design;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Block Templates + Models (unchanged from original)
// ═══════════════════════════════════════════════════════════════════════════

export function getPhaseTemplate(key: PhaseKey): PeriodizationBlock | undefined {
  return BLOCK_TEMPLATES[key];
}

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
