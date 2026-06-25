/** shared.ts — общие константы/типы TrainingScreen (вынесено из монолита). */
export const WARMUP_LABELS: Record<string, string> = {
  jumping_jack: 'Прыжки Jumping Jack', arm_circles: 'Круги руками', leg_swings: 'Махи ногами',
  hip_circle: 'Круги тазом', ankle_mobility: 'Мобилизация голеностопа', shoulder_circle: 'Круги плечами',
  thoracic_rotation: 'Ротация грудного отдела', cat_camel: 'Кошка-корова', worlds_greatest: 'Глубокий выпад с ротацией',
  banded_clam: 'Ракушка с резинкой', external_rotation: 'Внешняя ротация плеча', bird_dog: 'Bird-dog',
  dead_bug: 'Dead bug', light_cardio: 'Лёгкое кардио', squat: 'Присед',
  deep_breathing: 'Глубокое дыхание', box_breathing: 'Квадратное дыхание',
};

export const GOALS = [
  { value: 'bulk', label: 'Масса', icon: '💪' },
  { value: 'cut', label: 'Сушка', icon: '🔥' },
  { value: 'strength', label: 'Сила', icon: '🏋️' },
  { value: 'maintenance', label: 'Поддержание', icon: '⚖️' },
  { value: 'recomp', label: 'Рекомпозиция', icon: '🔁' },
  { value: 'rehab', label: 'Реабилитация', icon: '🩹' },
] as const;

export const LEVELS = [
  { value: 'beginner', label: 'Новичок', icon: '🌱' },
  { value: 'intermediate', label: 'Средний', icon: '📈' },
  { value: 'advanced', label: 'Опытный', icon: '🏆' },
  { value: 'enhanced', label: 'Enhanced', icon: '⚡' },
] as const;

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export const GROUP_LABELS: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};
export const EQUIP_LABELS: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела', band: 'Резинка', kettlebell: 'Гиря', specialty_bar: 'Спецгриф' };
export const JOINT_LABELS: Record<string, string> = { high: 'высокая', med: 'средняя', low: 'низкая' };
export const PHASE_LABELS: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка' };
export const PHASE_HINTS: Record<string, string> = {
  accumulation: 'Фаза накопления: умеренная интенсивность, рост объёма, контроль техники и восстановления.',
  intensification: 'Фаза интенсификации: выше рабочие веса, меньше лишнего объёма, строгий контроль RPE.',
  peaking: 'Пиковая фаза: приоритет тяжёлых подходов, низкая усталость, больше отдыха между сессиями.',
  deload: 'Разгрузка: снижаем объём и интенсивность, восстанавливаем суставы и нервную систему.',
};

export type TrainingTab = 'plan' | 'runtime' | 'exercises' | 'calculators' | 'diary' | 'cycles' | 'history' | 'analytics' | 'methods' | 'visual' | 'programs' | 'timers' | 'progress' | 'mytraining' | 'programcalc' | 'reports' | 'srcbb';
export type TrainingPage = 'hero' | 'tabs';
export type TrainingGroup = 'training' | 'planning' | 'info' | null;

export const TAB_GROUPS: Record<string, { title: string; icon: string; tabs: TrainingTab[]; color: string }> = {
  training: { title: '🏋️ Тренировки', icon: '🏋️', tabs: ['runtime', 'timers'], color: 'var(--accent)' },
  planning: { title: '📐 Планирование', icon: '📐', tabs: ['srcbb', 'plan', 'cycles', 'programs', 'mytraining', 'methods', 'programcalc'], color: '#3b82f6' },
  info: { title: '📊 Инфо', icon: '📊', tabs: ['analytics', 'visual', 'progress', 'calculators', 'exercises', 'diary', 'history', 'reports'], color: '#8b5cf6' },
};

export const TAB_LABELS: Record<TrainingTab, string> = {
  plan: '📋 План', runtime: '▶ Тренировка', exercises: '🏋️ Упражнения', calculators: '📐 Калькуляторы',
  diary: '📝 Дневник', cycles: '🔄 Циклы', history: '📜 История', analytics: '📊 Аналитика',
  methods: '🧠 Методики', visual: '📈 Визуализация', programs: '📚 Программы', timers: '⏱ Таймеры',
  progress: '📏 Прогресс', mytraining: '⭐ Мои', programcalc: '🛠️ Ручной конструктор',
  reports: '📄 Отчёты',
  srcbb: '🏆 СРЦ/BB',
};

// ── Этап R/U: 3 плоские трассы планировщика (ПЛ / ББ / Ручной сбор), одна вкладка — один клик.
//   pl    → ПЛ (сила, СРЦ-авто)        → SRCBBScreen track='pl'
//   bb    → ББ (бодибилдинг, авто)     → SRCBBScreen track='bb'
//   manual→ Ручной сбор (план/циклы/программы/методики/калькулятор)
export type PlanningTrack = 'pl' | 'bb' | 'manual';
const PT_KEY = 'he_training_planning_track';
export function getPlanningTrack(): PlanningTrack {
  try { const v = localStorage.getItem(PT_KEY); return v === 'manual' || v === 'bb' ? v : 'pl'; } catch { return 'pl'; }
}
export function setPlanningTrack(t: PlanningTrack): void {
  try { localStorage.setItem(PT_KEY, t); } catch { /* ignore */ }
}
export const PL_PLANNING_TABS: TrainingTab[] = ['srcbb'];
export const BB_PLANNING_TABS: TrainingTab[] = ['srcbb'];
export const MANUAL_PLANNING_TABS: TrainingTab[] = ['plan', 'cycles', 'programs', 'mytraining', 'methods', 'programcalc'];
export function planningTabsFor(track: PlanningTrack): TrainingTab[] {
  if (track === 'manual') return MANUAL_PLANNING_TABS;
  return track === 'bb' ? BB_PLANNING_TABS : PL_PLANNING_TABS;
}
// Бэкворд-совместимость (старый импорт PlanningMode)
export type PlanningMode = PlanningTrack;
export const getPlanningMode = getPlanningTrack;
export const setPlanningMode = (m: string) => setPlanningTrack(m === 'constructor' ? 'manual' : m === 'src_auto' ? 'pl' : 'pl')
